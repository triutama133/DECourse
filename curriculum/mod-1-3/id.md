---
title: SQL Lanjut: Window Function, Rekursi, dan Execution Plan
duration: 3 minggu
summary: Selesaikan masalah analitik nyata dengan window function (total berjalan, top-N, gaps and islands, sesi), query rekursif, dan belajar membaca execution plan serta merancang index agar query cepat pada 500.000 baris, bukan hanya pada sepuluh.
why: Tutorial menguji SELECT dan WHERE pada beberapa baris. Di produksi, query yang instan saat development memindai 100 juta baris karena tidak ada yang melihat plan-nya, dan logikanya butuh window function yang tidak pernah diajarkan.
---

## @outcomes
- Memilih antara ROW_NUMBER, RANK, dan DENSE_RANK, serta menjelaskan apa itu window frame dan mengapa frame bawaannya mengejutkan orang
- Menulis total berjalan, rata-rata bergerak, top-N per kelompok, record terbaru per kunci, dan perbandingan dengan baris sebelumnya memakai window function
- Menyelesaikan masalah gaps-and-islands dan sessionization dengan pola row-number dan jumlah kumulatif
- Menulis CTE rekursif untuk hierarki dan tahu bagaimana ia berhenti
- Membaca plan EXPLAIN ANALYZE PostgreSQL, menemukan langkah yang lambat, dan merancang index sesedikit mungkin yang memperbaikinya

## @prereq
Modul 0.3 (join, GROUP BY, NULL, CTE). Bagian A lab berjalan di browser Anda atau dengan SQLite bawaan Python; Bagian B memakai PostgreSQL (salinan tertanam dipasang oleh `pip`, jadi Docker opsional).

## @lesson Window function: menghitung lintas baris tanpa meleburnya
`GROUP BY` meleburkan banyak baris menjadi satu. **Window function** menghitung nilai atas sekumpulan baris yang berkaitan dan **mempertahankan setiap baris**. Sintaksnya `function(...) OVER (PARTITION BY ... ORDER BY ... frame)`:

- `PARTITION BY` membagi baris menjadi kelompok independen (seperti GROUP BY, tetapi barisnya tetap ada). Hilangkan dan seluruh hasil menjadi satu partisi.
- `ORDER BY` menentukan urutan *di dalam* tiap partisi. Banyak fungsi membutuhkannya.
- **Frame** opsional menyatakan baris-baris di sekitar baris saat ini yang terlihat oleh fungsi.

Contoh pada KopiKu: porsi tiap pesanan terhadap total pelanggannya, sesuatu yang tidak bisa dilakukan GROUP BY sendirian karena kita ingin satu baris keluaran per pesanan:

```sql
WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items GROUP BY order_id
)
SELECT o.order_id,
       ROUND(100.0 * t.order_total / SUM(t.order_total) OVER (PARTITION BY o.customer_id), 1) AS pct_of_customer
FROM orders o JOIN t ON t.order_id = o.order_id;
```

**Fungsi peringkat** memberi nomor pada baris dalam partisi. Perbedaannya hanya pada cara mereka memperlakukan **nilai kembar (tie)**. Pada pesanan bertotal 85.000 (tiga pesanan), 90.000 (dua), dan 95.000 (dua), diurutkan menurut total:

| order_total | ROW_NUMBER | RANK | DENSE_RANK |
|---|---|---|---|
| 85.000 | 1 | 1 | 1 |
| 85.000 | 2 | 1 | 1 |
| 85.000 | 3 | 1 | 1 |
| 90.000 | 4 | 4 | 2 |
| 90.000 | 5 | 4 | 2 |
| 95.000 | 6 | 6 | 3 |

- `ROW_NUMBER()` memberi setiap baris nomor unik, memutus seri secara acak kecuali `ORDER BY` Anda unik. Tambahkan pemutus seri (`ORDER BY order_total, order_id`) agar hasilnya deterministik.
- `RANK()` memberi peringkat sama pada baris kembar lalu **melompat** (1, 1, 1, 4).
- `DENSE_RANK()` memberi peringkat sama pada baris kembar tanpa melompat (1, 1, 1, 2).
- `NTILE(4)` membagi baris terurut menjadi 4 keranjang berukuran hampir sama (kuartil); bila baris tidak habis dibagi, keranjang awal mendapat satu baris ekstra.

Pilih sesuai pertanyaan: "3 *pesanan* teratas" adalah ROW_NUMBER; "pesanan dengan tiga *total berbeda* tertinggi" adalah DENSE_RANK.

## @lesson Frame, total berjalan, dan jebakan frame bawaan
Untuk agregat yang dipakai sebagai window function (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`), **frame** menyatakan baris mana yang disertakan. Bentuknya:

```sql
ROWS  BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW   -- dari baris pertama sampai baris ini
ROWS  BETWEEN 6 PRECEDING AND CURRENT ROW           -- baris ini dan 6 sebelumnya (7 baris)
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW   -- menurut NILAI: menyertakan semua baris yang kembar dengan ini
```

`ROWS` menghitung baris fisik. `RANGE` bekerja pada *nilai* kolom ORDER BY dan memperlakukan nilai yang sama sebagai satu kesatuan (disebut peer). PostgreSQL juga punya `GROUPS`.

**Jebakannya:** ketika Anda menulis `ORDER BY` di dalam OVER dan **tanpa frame**, bawaannya adalah `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Dengan nilai kembar ini memberi total berjalan yang mengejutkan. Data sama, dua frame:

| order_id | order_total | frame bawaan | frame `ROWS` |
|---|---|---|---|
| 103 | 85.000 | 255.000 | 85.000 |
| 109 | 85.000 | 255.000 | 170.000 |
| 117 | 85.000 | 255.000 | 255.000 |
| 102 | 90.000 | 435.000 | 345.000 |
| 111 | 90.000 | 435.000 | 435.000 |

Dengan frame bawaan, tiga baris kembar semuanya menampilkan 255.000 karena masing-masing menyertakan semua peer-nya. Jika Anda ingin total berjalan sungguhan baris demi baris, **tulis frame secara eksplisit** (`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`) dan pakai ORDER BY yang unik. Jebakan terkait: `LAST_VALUE(x) OVER (ORDER BY x)` dengan frame bawaan mengembalikan nilai baris *saat ini* (baris terakhir frame-nya), bukan nilai terakhir partisi; tambahkan `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.

**Rata-rata bergerak** 7 hari terakhir per toko: `AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`. Perhatikan enam hari pertama dirata-ratakan atas baris yang lebih sedikit; putuskan apakah Anda menginginkannya atau `NULL` sampai jendela penuh ada. Perhatikan juga `ROWS` mengasumsikan satu baris per hari: bila ada hari yang hilang, "6 baris sebelumnya" bukan "6 hari sebelumnya". Buat **date spine** lengkap (CTE rekursif di bawah) lebih dulu, atau pakai `RANGE` dengan interval bila database Anda mendukungnya.

Agregat atas partisi **tanpa** ORDER BY memakai seluruh partisi (total pada setiap baris), yang dipakai contoh porsi-terhadap-total tadi.

## @lesson Melihat ke samping: LAG, LEAD, terbaru-per-kunci, dan top-N
`LAG(x, n)` mengembalikan nilai dari `n` baris sebelumnya dalam partisi, `LEAD(x, n)` dari `n` baris sesudahnya; keduanya mengembalikan NULL di tepi (atau nilai bawaan yang Anda berikan). Keduanya menjawab "dibanding baris sebelumnya":

```sql
SELECT customer_id, order_id,
       CAST(julianday(order_date)
            - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id))
            AS INTEGER) AS days_since_prev
FROM orders;
```

(`julianday` adalah SQLite; di PostgreSQL Anda mengurangkan tanggal langsung: `order_date - LAG(order_date) OVER (...)`.) `FIRST_VALUE` dan `LAST_VALUE` mengembalikan baris pertama atau terakhir dari frame.

**Pola record-terbaru-per-kunci** adalah trik window paling berguna dalam data engineering. Setiap kali tabel menyimpan beberapa versi entitas yang sama (banyak perubahan alamat per pelanggan, event berulang, baris CDC), simpan satu:

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY effective_ts DESC) AS rn
  FROM customer_changes
)
SELECT * FROM ranked WHERE rn = 1;
```

Anda tidak bisa menaruh window function langsung di `WHERE`, karena window dihitung *setelah* WHERE, jadi hitung di CTE atau subquery dan filter di luarnya. Snowflake, BigQuery, dan DuckDB menyediakan `QUALIFY` sebagai jalan pintas (`... QUALIFY ROW_NUMBER() OVER (...) = 1`); PostgreSQL dan SQLite tidak, jadi ketahui bentuk portabelnya. Pola yang sama dengan `rn <= 3` menghasilkan **top-N per kelompok**, dan mengurutkan menurut stempel waktu update menjadikannya langkah **deduplikasi** standar di pipeline. Buat ORDER BY unik (tambah pemutus seri seperti id) atau baris yang bertahan akan acak.

## @lesson Gaps, islands, dan sesi
Dua masalah klasik menunjukkan bagaimana window function digabungkan.

**Gaps and islands**: temukan deretan nilai berurutan, seperti hari login berturut-turut. Triknya: untuk urutan terurut tanpa pengulangan, `tanggal - row_number` bernilai **konstan di dalam satu deretan** dan berubah saat ada celah.

```sql
WITH grouped AS (
  SELECT user_id, login_date,
         julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS grp
  FROM logins
)
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM grouped GROUP BY user_id, grp;
```

Untuk user 1 (login 1, 2, 3 Maret, lalu 5, 6, 7, 8) ini menghasilkan dua pulau: 3 hari dan 4 hari. Jika tanggal bisa berulang, deduplikasi dulu, atau `ROW_NUMBER` akan merusak konstanta itu.

**Sessionization**: kelompokkan aliran klik menjadi sesi, di mana sesi baru dimulai setelah 30 menit tidak aktif. Tandai setiap baris yang *memulai* sesi, lalu ambil jumlah berjalan dari tanda-tanda itu:

```sql
WITH flagged AS (
  SELECT user_id, event_time,
         CASE WHEN LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) IS NULL
                OR strftime('%s', event_time)
                   - strftime('%s', LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)) > 1800
              THEN 1 ELSE 0 END AS is_new
  FROM user_clickstream
)
SELECT user_id, event_time,
       SUM(is_new) OVER (PARTITION BY user_id ORDER BY event_time ROWS UNBOUNDED PRECEDING) AS session_id
FROM flagged;
```

Bentuknya selalu sama: **tandai batasnya, lalu jumlahkan kumulatif tanda itu untuk mendapat id kelompok.** Ia muncul lagi dalam pemrosesan event (Modul 3.3) dan dalam slowly changing dimension (Modul 1.4).

## @lesson CTE rekursif: hierarki dan urutan
Sebagian data berupa pohon atau graf: pohon kategori, bagan organisasi, bill of materials. Kedalamannya tidak diketahui, sehingga self-join dalam jumlah tetap tidak bisa menelusurinya. **CTE rekursif** bisa:

```sql
WITH RECURSIVE tree AS (
  SELECT id, name, 0 AS depth, name AS path          -- anchor: akar-akarnya
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, tree.depth + 1, tree.path || ' > ' || c.name   -- langkah: anak dari baris sebelumnya
  FROM categories c JOIN tree ON c.parent_id = tree.id
)
SELECT id, depth, path FROM tree;
```

Ia berjalan dalam putaran. Query **anchor** menghasilkan baris pertama; lalu query **rekursif** diterapkan pada baris yang dihasilkan putaran sebelumnya, berulang kali, sampai satu putaran tidak mengembalikan apa-apa. Hasilnya adalah gabungan semua putaran. Untuk kategori KopiKu ini menghasilkan path seperti `Coffee > Beans > Single Origin > Gayo` pada kedalaman 3.

Dua aturan keselamatan. **Ia harus berhenti**: bila data memuat siklus (induk A adalah B dan induk B adalah A) query tidak pernah selesai; lindungi dengan batas kedalaman (`WHERE depth < 20`) dan, di PostgreSQL, deteksi `CYCLE`. Dan jaga tetap murah: setiap putaran sebaiknya melakukan join kecil yang ber-index.

Pemakaian sehari-hari lainnya adalah **membangkitkan urutan**, seperti **date spine** (satu baris per hari, bahkan hari tanpa data), yang kemudian Anda LEFT JOIN-kan dengan fakta sehingga hari sepi tampil sebagai nol alih-alih lenyap:

```sql
WITH RECURSIVE days(d) AS (
  SELECT date('2026-01-01') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < '2026-01-31'
)
SELECT d FROM days;
```

(PostgreSQL punya `generate_series` untuk ini; rekursi adalah cadangan yang portabel.)

## @lesson Bagaimana database menjalankan query Anda: membaca EXPLAIN
SQL menyatakan *apa* yang Anda mau; **planner** database memutuskan *bagaimana*: index mana yang dipakai, urutan join, algoritma apa. Ia memperkirakan biaya berbagai alternatif dari **statistik** (jumlah baris dan sebaran nilai per kolom, diperbarui oleh `ANALYZE`) lalu memilih yang termurah. Tugas Anda adalah memeriksa bahwa pilihannya masuk akal. `EXPLAIN` menampilkan plan; `EXPLAIN ANALYZE` juga **menjalankan** query dan menambahkan waktu serta jumlah baris aktual (jadi bungkus penulisan dalam transaksi yang Anda rollback). Di PostgreSQL bentuk yang berguna adalah `EXPLAIN (ANALYZE, BUFFERS)`.

Plan asli dari tabel `events` 500.000 baris di lab, sebelum ada index:

```text
Gather  (cost=1000.00..7776.17 rows=50 width=35) (actual time=0.748..21.027 rows=40 loops=1)
  ->  Parallel Seq Scan on events  (cost=0.00..6771.17 rows=21 width=35) (actual time=1.094..13.300 rows=13 loops=3)
        Filter: (customer_id = 4242)
        Rows Removed by Filter: 166653
        Buffers: shared hit=4167
Execution Time: 21.043 ms
```

Bacalah dari node **paling dalam dan paling menjorok** ke luar. `Seq Scan` membaca seluruh tabel (4.167 halaman di sini) dan membuang 166.653 baris per worker untuk menyimpan 13: kerja berat untuk 40 baris hasil. Tambahkan index yang tepat dan query sejenis menjadi:

```text
Limit  (cost=0.42..41.40 rows=10 width=35) (actual time=0.028..0.036 rows=10 loops=1)
  ->  Index Scan using idx_events_customer_time on events  (actual time=0.027..0.035 rows=10 loops=1)
        Index Cond: (customer_id = 4242)
        Buffers: shared hit=10 read=3
Execution Time: 0.045 ms
```

Tiga belas halaman alih-alih 4.167, dan 0,045 ms alih-alih 21 ms: hampir 500 kali lebih cepat, pada tabel yang masih kecil. Hal yang perlu dicari:

- **Jenis scan**: `Seq Scan` (seluruh tabel), `Index Scan` (ikuti index, ambil baris), `Index Only Scan` (jawab dari index saja), `Bitmap Index/Heap Scan` (kumpulkan banyak kecocokan, lalu baca halaman berurutan). Seq Scan itu *benar* bila Anda butuh sebagian besar tabel; ia tanda bahaya bila Anda butuh sedikit baris.
- **Algoritma join**: `Nested Loop` (untuk tiap baris luar, cari yang dalam; bagus bila sisi luar kecil dan sisi dalam ber-index), `Hash Join` (bangun hash table dari satu sisi; pilihan lazim untuk masukan besar tak terurut), `Merge Join` (kedua sisi sudah terurut).
- Node **`Sort`** dan **`Rows Removed by Filter`**: tanda kerja yang bisa dihindari oleh index.
- **Baris perkiraan vs aktual** (`rows=` di kurung pertama dibanding kurung kedua). Bila keduanya berbeda berorde-orde besar, planner memilih dalam gelap. Contoh: pada tabel di mana kolom `a` dan `b` selalu sama, `WHERE a = 7 AND b = 7` diperkirakan **15 baris** dan mengembalikan **2.000**, karena planner mengasumsikan dua kondisi itu independen. Perbaikannya termasuk `ANALYZE` baru, statistik tambahan (extended statistics), atau menulis ulang query. Selalu bandingkan angka-angka ini sebelum menyetel hal lain.
- **`loops`**: baris dan waktu aktual dihitung *per loop*; kalikan.
- Satuan **cost** bersifat sembarang dan hanya bisa dibandingkan dalam satu plan.

> **Tip:** Uji pada volume yang realistis. Pada 1.000 baris setiap plan cepat dan tidak memberi tahu apa-apa. Bangkitkan data pada skala produksi (lab melakukannya) sebelum menilai sebuah query.

## @lesson Index: apa itu, mana yang dibangun, apa biayanya
**Index** adalah struktur terurut terpisah yang memetakan nilai kolom ke lokasi baris, seperti indeks di belakang buku. Bawaannya adalah **B-tree**: mendukung kesamaan (`=`), rentang (`<`, `BETWEEN`), dan pengurutan (`ORDER BY`), karena menjaga kunci tetap terurut. Memilih index adalah keterampilan desain dengan beberapa aturan.

**Index komposit dan urutan kolom.** Index pada `(customer_id, event_time DESC)` terurut menurut pelanggan, lalu menurut waktu di dalam tiap pelanggan. Ia bisa melayani query yang memfilter `customer_id` (**prefiks paling kiri**) dan, dalam index yang sama, menyerahkan baris yang sudah berurutan waktu, sehingga `WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10` membaca tepat 10 entri index dan **tidak butuh Sort**. Ia **tidak bisa** membantu query yang hanya memfilter `event_time`. Aturan praktisnya: kolom kesamaan dulu, lalu kolom rentang atau pengurutan. Di lab, tiga rancangan index memberi tiga plan untuk query itu:

| Index | Plan untuk `WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10` |
|---|---|
| tanpa index | Parallel Seq Scan + Sort, 20 ms |
| `(customer_id)` | Bitmap Heap Scan + **Sort**, 0,10 ms |
| `(customer_id, event_type, event_time DESC)` | Bitmap Heap Scan + **Sort**, 0,08 ms (kolom tambahan di tengah merusak urutan) |
| `(customer_id, event_time DESC)` | **Index Scan**, tanpa Sort, 0,06 ms |

**Sargability.** Sebuah kondisi *sargable* (search-argument-able) bila database bisa memakai index untuknya. Membungkus kolom ber-index dengan fungsi menghancurkannya: `WHERE date(event_time) = '2026-01-10'` memaksa Seq Scan (30 ms di lab) karena index ada pada `event_time`, bukan pada `date(event_time)`. Tulis ulang sebagai rentang pada kolom polos, `event_time >= '2026-01-10' AND event_time < '2026-01-11'`, yang mengembalikan 14.400 baris yang sama lewat index dalam sekitar 3 ms. Hal yang sama berlaku untuk `LOWER(name) = ...`, aritmetika pada kolom, dan wildcard di depan `LIKE '%abc'`. (Alternatifnya buat *expression index* pada ekspresi itu.)

**Selektivitas.** Index bermanfaat bila predikat memilih bagian kecil tabel. Di lab `status = 'done'` cocok dengan 99,8% baris, sehingga bahkan dengan index planner dengan benar memilih Seq Scan; `status = 'pending'` cocok dengan 0,2% dan memakai index. **Partial index** (`CREATE INDEX ... WHERE status = 'pending'`) hanya meng-index baris langka, sehingga sangat kecil.

**Jenis lain.** **Covering index** (`INCLUDE (...)`) menyimpan kolom tambahan sehingga `Index Only Scan` tidak perlu menyentuh tabel. Index **BRIN** hanya menyimpan nilai min dan max per blok halaman; pada tabel append-only yang sangat besar dengan kolom yang berkorelasi dengan urutan fisik (waktu event), ia bekerja hampir seperti B-tree pada sebagian kecil ukurannya: di lab, **24 kB** dibanding **11 MB** untuk B-tree pada `event_time`, dengan waktu query yang sama (sekitar 3 ms). Index Hash, GIN (array, JSON, full text), dan GiST (geospasial) melayani kasus khusus.

**Sisi biayanya.** Setiap index harus diperbarui pada setiap INSERT, UPDATE, dan DELETE, memakan ruang disk (index `(customer_id, event_time)` berukuran 15 MB pada tabel 33 MB) dan memperlambat bulk load. Jadi tujuannya adalah index **sesedikit mungkin** yang membuat query nyata Anda cepat. Lab menegakkannya: paling banyak tiga, dan masing-masing harus dipakai. Warehouse kolumnar dan lakehouse (Modul 2.1 dan seterusnya) sebagian besar menggantikan index dengan pengurutan, partisi, dan statistik; cara berpikirnya tetap berlaku.

Terakhir, beberapa kebiasaan query yang menghindari masalah sebelum index dibutuhkan: pilih hanya kolom yang Anda perlukan (bukan `*`), filter lebih awal, hindari `DISTINCT` sebagai tambalan untuk fan-out join yang tidak disengaja (perbaiki join-nya), pilih `EXISTS` daripada `IN (subquery)` untuk uji keberadaan, hati-hati dengan `OR` lintas kolom berbeda, dan hindari menjalankan query per baris dari kode aplikasi (pola "N+1"): satu query berbasis himpunan mengalahkan seribu query kecil.

## @lab Lab: teka-teki window function dan latihan tuning PostgreSQL
Bagian A: sepuluh pertanyaan analitik yang dijawab dengan window function dan CTE rekursif, diperiksa otomatis. Bagian B: diberi empat query lambat pada tabel 500.000 baris di PostgreSQL, buat index sesedikit mungkin yang membuatnya cepat, dan tulis ulang satu query agar bisa memakai index. Bagian B diperiksa dengan membaca execution plan yang sebenarnya.

### @steps
1. **Bagian A, di browser (disarankan).** Buka SQL Sandbox, pilih tantangan dari daftar (bertanda untuk modul ini: total berjalan, pesanan terbaru, hari sejak pesanan sebelumnya, porsi terhadap total, peringkat dengan nilai kembar, rata-rata bergerak, kuartil, pohon kategori, ditambah tantangan gaps-and-islands dan sessionization) dan pakai "Periksa jawaban". Setiap tantangan otomatis berpindah ke dataset yang tepat.
2. **Bagian A, lokal.** Buka `labs/mod-1-3/answers.sql`, tulis satu query di bawah tiap penanda, dan jalankan `python3 labs/mod-1-3/check.py`. Ia membandingkan hasil Anda dengan referensi memakai SQLite bawaan Python.
3. Jangan lewatkan *mengapa*-nya: untuk total berjalan, coba frame bawaan dan frame `ROWS` eksplisit dan lihat bedanya pada baris kembar; untuk peringkat, coba ketiga fungsi peringkat.
4. **Bagian B, persiapan.** Pasang requirement (PostgreSQL tertanam sudah termasuk; tidak perlu Docker):

```bash
python -m pip install -r labs/mod-1-3/explain/requirements.txt
pytest labs/mod-1-3/explain -v
```

   Semua tes gagal pada awalnya. Itulah titik awalnya. (Untuk memakai PostgreSQL Anda sendiri, misalnya dari Docker, set `DATABASE_URL` ke database sementara yang kosong.)
5. **Bagian B, tuning.** Buka `labs/mod-1-3/explain/queries.sql` dan `indexes.sql`. Lihat keempat query dan tentukan kolom mana yang difilter dan diurutkan masing-masing. Tulis pernyataan `CREATE INDEX` **sesedikit mungkin** di `indexes.sql` sehingga tidak ada query yang melakukan Seq Scan, dan Q3 tidak butuh Sort. Tulis ulang Q4 di `queries.sql` agar memberi jawaban sama tetapi bisa memakai index.
6. Untuk melihat apa yang dilihat tes, muat tabel ke PostgreSQL mana pun dan jalankan `EXPLAIN (ANALYZE, BUFFERS)` pada tiap query sebelum dan sesudah perubahan Anda; bandingkan baris perkiraan dan aktual, halaman yang dibaca, dan waktu.
7. Jalankan ulang tes sampai semuanya lulus. Jika ada yang gagal, pesannya menyebut aturan mana yang Anda langgar.

### @files
- labs/mod-1-3/answers.sql :: File kerja Bagian A: satu query per penanda :: starter
- labs/mod-1-3/check.py :: Pemeriksa Bagian A (memakai dataset di bawah) :: test
- labs/mod-1-3/datasets/kopiku.sql :: Dataset untuk sebagian besar pertanyaan Bagian A :: data
- labs/mod-1-3/datasets/daily_sales.sql :: Dataset untuk rata-rata bergerak :: data
- labs/mod-1-3/datasets/categories.sql :: Dataset untuk CTE rekursif :: data
- labs/mod-1-3/reference/answers.sql :: Jawaban referensi Bagian A (coba sendiri dulu!) :: reference
- labs/mod-1-3/explain/queries.sql :: Bagian B: keempat query (tulis ulang Q4) :: starter
- labs/mod-1-3/explain/indexes.sql :: Bagian B: taruh pernyataan CREATE INDEX Anda di sini :: starter
- labs/mod-1-3/explain/test_lab.py :: Tes Bagian B yang memeriksa execution plan asli :: test
- labs/mod-1-3/explain/reference/indexes.sql :: Index referensi Bagian B :: reference
- labs/mod-1-3/explain/reference/queries.sql :: Query referensi Bagian B :: reference

### @deliverables
- Kesepuluh jawaban Bagian A lulus, di sandbox atau dengan `check.py`
- Kesepuluh tes Bagian B lulus
- Untuk Bagian B Anda bisa menjelaskan, dengan plan di depan Anda, mengapa `(customer_id, event_time DESC)` menghilangkan Sort tetapi `(customer_id, event_type, event_time DESC)` tidak

### @verify
Bagian A: `python3 labs/mod-1-3/check.py` (atau tombol di sandbox). Bagian B: `pytest labs/mod-1-3/explain -v`. Bandingkan dengan referensi: `python3 labs/mod-1-3/check.py reference` dan `LAB_DIR=reference pytest labs/mod-1-3/explain -v`.

## @chaos Query dashboard yang cepat sampai bulan Maret
### @scenario
Halaman aktivitas pelanggan menjalankan `SELECT * FROM events WHERE date(event_time) = CURRENT_DATE - 1 AND customer_id = 4242` pada tabel events. Ditambahkan di bulan Januari saat tabel berisi 200.000 baris dan merespons dalam 40 ms. Pada bulan Maret tabel berisi 60 juta baris, halaman butuh 25 detik, CPU database 100% pukul 09.00 saat semua orang membuka dashboard, dan tim sudah dua kali mencoba menambah server yang lebih besar.

Seseorang memastikan index ada: `CREATE INDEX ON events (event_time)`.

### @cause
Dua masalah yang saling memperparah. Pertama, filter membungkus kolom ber-index dengan fungsi, `date(event_time)`, sehingga index pada `event_time` **tidak bisa dipakai** (kondisinya tidak sargable), dan planner kembali ke sequential scan atas seluruh 60 juta baris. Kedua, satu-satunya kolom ber-index, `event_time`, bahkan bukan yang selektif untuk pertanyaan ini: beberapa baris milik satu pelanggan adalah sasaran sebenarnya, jadi index yang tepat dimulai dengan `customer_id`.

Biaya query tumbuh seiring tabel, itulah sebabnya ia baik pada 200.000 baris dan bencana pada 60 juta: Seq Scan adalah O(n). Server yang lebih besar hanya menunda kegagalan berikutnya.

### @fix
1. Tulis ulang filter sebagai rentang pada kolom polos: `event_time >= CURRENT_DATE - 1 AND event_time < CURRENT_DATE`.
2. Buat index yang cocok dengan jalur akses: `CREATE INDEX ON events (customer_id, event_time)`, sehingga database menemukan satu pelanggan lalu rentang waktu secara langsung.
3. Periksa dengan `EXPLAIN (ANALYZE, BUFFERS)` pada data berukuran produksi: harapkan Index Scan, segelintir halaman, dan respons dalam milidetik.
4. Pakai desain yang ramah index untuk jangka panjang (partisi atau BRIN pada waktu, retensi data lama), dan tambahkan alert query lambat agar regresi berikutnya ditemukan oleh ambang batas, bukan oleh pengguna.

### @pattern
Lihat plan-nya, bukan ukuran servernya. Fungsi pada kolom ber-index menyembunyikannya dari index, dan index pada kolom yang salah sama saja dengan tidak ada.

## @quiz
### Tiga pesanan punya total yang sama dan pesanan berikutnya lebih besar. Fungsi mana yang memberi pesanan lebih besar itu peringkat 2?
- [ ] `RANK()`, karena ia selalu menghitung berapa baris yang ada sebelum baris saat ini dalam urutan
- [ ] `ROW_NUMBER()`, karena ia menomori baris persis menurut urutan baris itu dikembalikan
- [x] `DENSE_RANK()`, karena nilai kembar berbagi satu peringkat dan nilai berikutnya lanjut tanpa celah
- [ ] `NTILE(2)`, karena ia membagi baris terurut menjadi dua keranjang yang hampir sama besar

> RANK akan memberi 4 (melompat setelah nilai kembar), ROW_NUMBER juga 4, dan NTILE untuk keranjang. DENSE_RANK memberi peringkat sama pada nilai kembar dan melanjutkan dengan bilangan bulat berikutnya.

### Anda menulis `SUM(x) OVER (ORDER BY x)` dan baris dengan x sama semuanya menampilkan total berjalan yang sama. Mengapa?
- [ ] Database menyimpan cache hasil pertama untuk nilai yang sama agar tidak menghitung ulang
- [ ] `SUM` mengabaikan klausa ORDER BY ketika dua baris punya nilai yang sama di kolom itu
- [x] Frame bawaannya adalah RANGE, yang menyertakan semua baris yang kembar dengan baris saat ini
- [ ] Window function dievaluasi sebelum WHERE, yang menggabungkan baris yang sama menjadi satu

> Dengan ORDER BY tanpa frame, bawaannya adalah RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, di mana baris kembar adalah peer dan semuanya dihitung. Tulis `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` untuk total baris demi baris.

### Bagaimana menyimpan hanya baris terbaru per pelanggan dari tabel yang menyimpan banyak versi per pelanggan?
- [ ] `SELECT DISTINCT customer_id, MAX(effective_ts)` lalu join hasilnya kembali hanya dengan stempel waktu
- [x] `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY effective_ts DESC)` di CTE, lalu simpan `rn = 1`
- [ ] `GROUP BY customer_id` dan memilih setiap kolom lain tanpa fungsi agregat apa pun sama sekali
- [ ] `ORDER BY effective_ts DESC LIMIT 1`, yang mengembalikan satu baris terbaru untuk tiap pelanggan terpisah

> Window function menomori versi per pelanggan, terbaru dulu; memfilter rn = 1 menyimpan satu baris masing-masing. LIMIT biasa mengembalikan satu baris secara keseluruhan, dan join hanya dengan stempel waktu bisa mencocokkan pelanggan lain.

### Dalam query gaps-and-islands, mengapa `tanggal - ROW_NUMBER()` sama untuk semua baris dalam satu deretan tanggal berurutan?
- [ ] Keduanya direset ke nol oleh database setiap kali partisi baru dimulai dalam hasil query
- [ ] ROW_NUMBER dihitung dari nilai tanggalnya sendiri, sehingga selisihnya selalu persis nol
- [x] Tanggal dan nomor baris sama-sama naik satu per baris, sehingga selisihnya konstan sampai celah
- [ ] Database mengurutkan baris menurut selisihnya, yang menempatkan tanggal berurutan berdampingan

> Dalam satu deretan, setiap baris berikutnya bertanggal sehari kemudian dan bernomor satu lebih tinggi, sehingga pengurangan saling meniadakan. Setelah celah, tanggal melompat tetapi nomor baris tidak, sehingga selisihnya berubah.

### Apa yang menghentikan CTE rekursif agar tidak berjalan selamanya pada sebuah hierarki?
- [ ] Database otomatis berhenti setelah sejumlah putaran tetap, bagaimanapun bentuk datanya sebenarnya
- [ ] Kata kunci `UNION ALL` membuang setiap baris yang sudah dihasilkan sebelumnya dalam query itu
- [x] Rekursi berakhir ketika satu putaran tidak menghasilkan baris baru, sehingga siklus berputar selamanya
- [ ] Query anchor membatasi jumlah hasil yang bisa ditambahkan oleh bagian rekursif pada tiap putaran

> Setiap putaran memakai baris putaran sebelumnya dan berhenti ketika tidak menghasilkan apa-apa. Siklus dalam data (A induk B dan B induk A) tidak pernah mencapai keadaan itu kecuali Anda menambah batas kedalaman atau deteksi siklus.

### Sebuah query memfilter `WHERE date(event_time) = '2026-01-10'` dan ada index pada `event_time`, tetapi plan menunjukkan sequential scan. Apa perbaikan terbaiknya?
- [ ] Menambah index kedua pada kolom `event_time` yang sama agar planner punya lebih banyak pilihan untuk dipilih
- [ ] Menjalankan `VACUUM FULL` pada tabel agar planner kembali memercayai index yang ada sesudahnya
- [x] Menulis ulang sebagai rentang pada kolom polos: `event_time >= '2026-01-10' AND event_time < '2026-01-11'`
- [ ] Memaksa index scan dengan hint planner, karena planner selalu memilih jalur akses yang salah

> Membungkus kolom dengan fungsi berarti index pada kolom mentah tidak bisa dicari. Membandingkan kolom polos dengan rentang itu sargable dan mengembalikan baris yang sama.

### Anda punya `WHERE customer_id = ? ORDER BY event_time DESC LIMIT 10`. Index mana yang memungkinkan PostgreSQL mengembalikan baris tanpa langkah Sort?
- [ ] `(event_time DESC, customer_id)` karena kolom yang diurutkan berada pertama di kunci
- [ ] Index kolom tunggal terpisah pada `customer_id` dan pada `event_time`, yang lalu digabungkan
- [ ] `(customer_id, event_type, event_time DESC)` karena memuat setiap kolom yang disentuh query
- [x] `(customer_id, event_time DESC)`: kolom kesamaan dulu, lalu kolom yang dipakai untuk pengurutan

> Index terurut menurut pelanggan lalu menurut waktu di dalam tiap pelanggan, sehingga baris satu pelanggan sudah dalam urutan yang diinginkan. Kolom tengah yang berbeda merusak urutan, dan kolom pengurutan di depan tidak bisa dicari menurut pelanggan.

### `EXPLAIN ANALYZE` menunjukkan sebuah node dengan perkiraan `rows=15` dan aktual `rows=2000`. Apa artinya, dan apa yang dilakukan pertama kali?
- [ ] Query mengembalikan terlalu banyak baris, jadi tambahkan klausa LIMIT untuk mengurangi jumlahnya
- [ ] Perkiraan itu tidak relevan, karena hanya waktu eksekusi akhir query yang benar-benar penting
- [x] Statistik planner menyesatkannya, jadi segarkan dengan ANALYZE dan periksa kolom yang berkorelasi
- [ ] Index rusak dan harus dibangun ulang sebelum query bisa berjalan dengan benar kembali

> Selisih besar antara baris perkiraan dan aktual berarti planner memilih plan berdasarkan asumsi yang salah (statistik usang, predikat berkorelasi). Perbaiki perkiraannya lebih dulu; plan biasanya ikut membaik.

## @resources
- [Dokumen PostgreSQL: tutorial window function](https://www.postgresql.org/docs/current/tutorial-window.html)
- [Dokumen PostgreSQL: memakai EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Dokumen PostgreSQL: index](https://www.postgresql.org/docs/current/indexes.html)
- [Dokumen PostgreSQL: query WITH (rekursif)](https://www.postgresql.org/docs/current/queries-with.html)
- [SQLite: window function](https://www.sqlite.org/windowfunctions.html)
