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
- Menerjemahkan query antara SQLite, PostgreSQL, DuckDB, dan warehouse cloud, serta mengenali perbedaan dialek yang diam-diam mengubah jawaban

## @prereq
Modul 0.3 (join, GROUP BY, NULL, CTE). Bagian A lab berjalan di browser Anda atau dengan SQLite bawaan Python; Bagian B memakai PostgreSQL (salinan tertanam dipasang oleh `pip`, jadi Docker opsional).

## @part Window function dan rekursi

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

> 💡 **Jeda Praktik 1 (Peringkat Window & Pembagian Partisi):**
> Saatnya mencoba window function ranking dan agregasi tanpa GROUP BY:
> 1. Buka file `labs/mod-1-3/answers.sql` di Text Editor Anda (atau buka SQL Sandbox di web browser!).
> 2. Kerjakan 3 tantangan berikut di bawah penandanya:
>    - `w-4`: Hitung persentase pesanan terhadap total pesanan pelanggan (`SUM(order_total) OVER (PARTITION BY customer_id)` tanpa ORDER BY).
>    - `w-5`: Beri peringkat pesanan berdasarkan `order_total` terbesar tanpa ada angka lompat saat seri (`DENSE_RANK() OVER (ORDER BY order_total DESC)`).
>    - `w-7`: Bagi seluruh pesanan menjadi 4 kuartil seimbang (`NTILE(4) OVER (ORDER BY order_total, order_id)`).
> 3. Uji di terminal:
> `python3 labs/mod-1-3/check.py`
> Ketika w-4, w-5, dan w-7 berstatus PASS, lanjut ke Pelajaran 2 untuk memahami frame dan running total!

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

> 💡 **Jeda Praktik 2 (Frame & Moving Average):**
> Kuasai spesifikasi frame baris untuk akumulasi dan rata-rata berjalan:
> 1. Di `labs/mod-1-3/answers.sql` (atau SQL Sandbox), kerjakan 2 tantangan frame:
>    - `w-1`: Akumulasi total belanja pelanggan (running total) dari waktu ke waktu (`SUM(...) OVER (PARTITION BY customer_id ORDER BY order_date, order_id)`).
>    - `w-6`: Rata-rata bergerak 7 hari per toko (`AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`).
> 2. Uji di terminal:
> `python3 labs/mod-1-3/check.py`
> Ketika w-1 dan w-6 PASS, lanjut ke Pelajaran 3 untuk melihat data tetangga dengan LAG/LEAD!

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

> 💡 **Jeda Praktik 3 (Melihat Baris Lain & Deduplikasi):**
> Ambil baris terbaru dan bandingkan jarak antar-event:
> 1. Di `labs/mod-1-3/answers.sql` (atau SQL Sandbox), kerjakan tantangan berikut:
>    - `w-2`: Ambil pesanan paling baru per pelanggan menggunakan `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)` lalu filter rank 1 di CTE.
>    - `w-3`: Hitung jeda hari sejak pesanan sebelumnya menggunakan `LAG(order_date)` dan selisih `julianday`.
> 2. Uji di terminal:
> `python3 labs/mod-1-3/check.py`
> Ketika w-2 dan w-3 PASS, Anda telah menguasai pola deduplikasi inti data engineering! Lanjut ke Pelajaran 4 tentang gaps & islands.

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

> 💡 **Jeda Praktik 4 (Gaps, Islands, & Sessionization):**
> Gabungkan window function untuk memecahkan pola analitik tingkat lanjut:
> 1. Di `labs/mod-1-3/answers.sql` (atau SQL Sandbox), selesaikan tantangan pulau dan sesi:
>    - `ch-3`: Cari rekor streak hari login terpanjang menggunakan trik pulau `julianday(login_date) - ROW_NUMBER()`.
>    - `ch-4`: Analisis sesi klik web (sessionization) dengan menandai jarak > 30 menit lewat `LAG` lalu akumulasikan session ID dengan `SUM()`.
> 2. Uji di terminal:
> `python3 labs/mod-1-3/check.py`
> Ketika ch-3 dan ch-4 PASS, lanjut ke Pelajaran 5 untuk menelusuri hierarki dengan CTE rekursif!

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

> 💡 **Jeda Praktik 5 (CTE Rekursif Pohon Hierarki - Bagian A Tuntas):**
> Telusuri relasi berjenjang tak terbatas tanpa batasan tingkat kedalaman:
> 1. Di `labs/mod-1-3/answers.sql` (atau SQL Sandbox), selesaikan tantangan terakhir Bagian A:
>    - `w-8`: Bangun pohon kategori produk KopiKu dengan `WITH RECURSIVE`: tentukan anchor akar (`parent_id IS NULL`), sambungkan ke node turunan, hitung kedalaman `depth`, dan rangkai string `path`.
> 2. Uji seluruh Bagian A di terminal:
> `python3 labs/mod-1-3/check.py`
> Ketika Anda melihat pesan `10/10 answers correct`, Bagian A lab ini 100% tuntas! Lanjut ke Pelajaran 6 & 7 untuk membedah query plan dan index database.

## @part Performa: plan dan indeks

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

> 🛠 **Coba sendiri (12 menit, Python dan SQLite).** Muat `data/orders.csv` ke SQLite (pakai lagi skrip Anda dari Modul 0.2). Untuk setiap query, cetak `EXPLAIN QUERY PLAN` (kolom terakhir): (1) `WHERE customer_id = '479'`; (2) yang sama setelah `CREATE INDEX ix_cust ON orders(customer_id)`; (3) `WHERE lower(customer_id) = '479'` dengan index sudah ada; (4) `WHERE order_ts >= '2026-01-10' AND order_ts < '2026-01-11'` sebelum dan sesudah `CREATE INDEX ix_ts ON orders(order_ts)`.
>
> **Seharusnya Anda melihat:** `SCAN orders` untuk (1); `SEARCH orders USING INDEX ix_cust (customer_id=?)` untuk (2); `SCAN orders` lagi untuk (3), karena fungsi pada kolom membuat index tidak terpakai (sargability); dan untuk (4) sebuah `SCAN` yang berubah menjadi `SEARCH orders USING INDEX ix_ts (order_ts>? AND order_ts<?)`.

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

> 💡 **Jeda Praktik 6 (Tuning Query & Optimalisasi Index PostgreSQL - Bagian B):**
> Terapkan seni tuning indeks pada PostgreSQL tabel 500.000 baris:
> 1. Buka file `labs/mod-1-3/explain/indexes.sql` dan `labs/mod-1-3/explain/queries.sql` di text editor.
> 2. Definisikan maksimal 3 indeks di `indexes.sql` untuk menghapus seluruh Sequential Scan dan meniadakan operasi Sort pada Q3. Tulis ulang Q4 di `queries.sql` agar sargable (gunakan rentang tanggal alih-alih fungsi `date()`).
> 3. Jalankan pengujian plan di terminal:
> `pytest labs/mod-1-3/explain -v`
> Ketika semua tes Bagian B berwarna HIJAU (PASSED), Anda telah menguasai optimasi query planner di tingkat profesional! Lanjut ke Pelajaran 8 untuk melihat ragam dialek SQL.

## @part Dialek, subtotal, dan JSON

## @lesson Satu pertanyaan, banyak dialek: SQLite, PostgreSQL, DuckDB, dan warehouse
SQL adalah standar, tetapi setiap engine berbicara dalam dialeknya sendiri, dan dalam data engineering Anda akan bertemu beberapa: SQLite di sandbox, PostgreSQL di database aplikasi, DuckDB di laptop, BigQuery atau Snowflake di warehouse (Modul 2.6), Spark SQL di lakehouse. Standar mendefinisikan inti (SELECT, join, GROUP BY, window function, CTE), dan setiap engine menambah fungsi, tipe, dan aturan di sekelilingnya. Perbedaan datang dalam dua jenis, dan jenis kedua adalah yang berbahaya.

**Perbedaan yang gagal dengan keras.** Query error, Anda mencari tahu, Anda memperbaikinya. Kami menjalankan pernyataan yang sama di SQLite 3.45, PostgreSQL 16, dan DuckDB 1.5:

| Tugas | SQLite | PostgreSQL | DuckDB |
|---|---|---|---|
| Tanggal ditambah 7 hari | `date(d, '+7 days')` | `d + 7` | `d + 7` |
| Selisih hari antar tanggal | `julianday(b) - julianday(a)` | `b - a` | `b - a` |
| Potong ke bulan | `strftime('%Y-%m-01', d)` | `date_trunc('month', d)` | `date_trunc('month', d)` |
| Hari dalam minggu (Sabtu = 6) | `strftime('%w', d)` | `EXTRACT(dow FROM d)` | `EXTRACT(dow FROM d)` |
| Menyambung teks per kelompok | `group_concat(x, ',')` | `string_agg(x, ',')` | keduanya bisa |
| Posisi teks | `instr(x, 'p')` | `strpos(x, 'p')` | keduanya bisa |
| Pencocokan tak peka huruf | `LIKE` (ASCII) | `ILIKE` | `ILIKE` |
| `QUALIFY` (filter atas window) | syntax error | syntax error | berfungsi |
| Deret angka | CTE rekursif | `generate_series(1, 5)` | `generate_series(1, 5)` |

Di SQL Sandbox Anda karena itu menulis `group_concat`, `julianday`, dan `strftime`, dan pola portabel untuk `QUALIFY` adalah window function di dalam CTE diikuti filter (challenge w-11). Warehouse, dari dokumentasinya dan tidak dijalankan di kursus ini: BigQuery memakai `DATE_DIFF(b, a, DAY)`, `DATE_TRUNC(d, MONTH)`, `STRING_AGG`, dan backtick untuk nama; Snowflake memakai `DATEDIFF('day', a, b)`, `DATEADD(day, 7, d)`, `LISTAGG`; keduanya mendukung `QUALIFY`. Alat seperti **sqlglot** menerjemahkan antar dialek: ia mengubah `GROUP_CONCAT(name, ',')` SQLite menjadi `STRING_AGG(name, ',')` untuk PostgreSQL dan `DATEDIFF('day', a, b)` Snowflake menjadi `CAST(b AS DATE) - CAST(a AS DATE)`. Perlakukan penerjemah sebagai draf pertama untuk diuji, bukan jaminan.

**Perbedaan yang mengubah jawaban secara diam-diam.** Query berjalan dan angkanya berbeda. Ini memakan biaya nyata, jadi pelajari:

| Pernyataan | SQLite | PostgreSQL | DuckDB |
|---|---|---|---|
| `SELECT 7 / 2` | **3** | **3** | **3,5** |
| `ORDER BY x` dengan NULL (menaik) | NULL **di awal** | NULL **di akhir** | NULL **di akhir** |
| `'abc' LIKE 'ABC'` | benar | salah | salah |
| `x, y ... GROUP BY x` (y tidak diagregasi) | mengembalikan satu `y` sembarang | **error** | **error** |
| `INSERT 'abc'` ke kolom `INTEGER` | **disimpan sebagai teks** | error | error |
| `CAST('12abc' AS INTEGER)` | **12** | error | error |
| `SELECT "hello"` (tanda kutip ganda) | teks `hello` bila tak ada kolom itu | error | error |
| `SELECT 1 = 1` | `1` | `true` | `true` |

Baca baris ketiga dan keempat dua kali. Laporan yang mengurutkan menurut kolom nullable menaruh yang tak diketahui di atas di SQLite dan di bawah di tempat lain, dan memindahkan query dari satu engine ke engine lain mengubah urutan hasil tanpa error: bila urutan penting, tulis `NULLS FIRST` atau `NULLS LAST` (PostgreSQL, DuckDB, Snowflake, BigQuery, dan SQLite 3.30+). `GROUP BY` yang memilih kolom tak ter-grup adalah *error* di PostgreSQL karena jawabannya ambigu; SQLite mengembalikan nilai dari satu baris tanpa memberi tahu, sehingga bug yang akan ditangkap PostgreSQL lolos diam-diam di prototipe. Ketika sqlglot memindahkan `QUALIFY ROW_NUMBER() OVER (ORDER BY x)` dari Snowflake ke BigQuery ia menambahkan `NULLS LAST`, yaitu penerjemah menjaga urutan NULL tetap sama. Dan dialek yang *memaafkan* (menyimpan `'abc'` di kolom integer, membaca `'12abc'` sebagai 12) mengubah masalah kualitas data menjadi angka yang salah alih-alih error. Jebakan pandas di Modul 1.5 tentang menebak tipe adalah keluarga yang sama.

**Strategi kerja.**

1. **Kenali engine target Anda** dan uji di sana. Query yang lolos di sandbox belum terbukti untuk warehouse.
2. **Tulis subset portabel bila bisa**: CTE, window function, `CASE`, `COALESCE`, `CAST`, join standar, `||`, `NULLS FIRST/LAST` eksplisit, rentang tanggal setengah terbuka.
3. **Eksplisit alih-alih mengandalkan default**: desimal untuk rasio, `ORDER BY` dengan pemutus seri lengkap, daftar kolom di `INSERT`, dan `GROUP BY` pada setiap kolom yang tidak diagregasi.
4. **Bungkus perbedaannya**: di dbt (Modul 2.3) makro lintas database seperti `dbt.date_trunc` dan `dbt.datediff` menyembunyikannya, sehingga model berjalan di DuckDB saat pengembangan dan di warehouse saat produksi.
5. **Saat bertemu engine baru**, jawab ini sebelum menulis query: bagaimana tanggal dan zona waktu disimpan? apa yang dilakukan `/` pada bilangan bulat? di mana NULL terurut? bagaimana nama dikutip dan dibandingkan (huruf besar-kecil, spasi)? apakah constraint dan foreign key ditegakkan? bagaimana string diagregasi? apakah ada `QUALIFY`? bagaimana `LIMIT`/`OFFSET` (atau `TOP`, `FETCH FIRST`) ditulis? apa yang terjadi pada `CAST` yang buruk?

Challenge latihan sandbox **k-16 sampai k-23** (fungsi teks, angka, tanggal dan DDL, Modul 0.3) dan **w-11 sampai w-14** (QUALIFY, FILTER, pengelompokan tanggal, median tanpa `MEDIAN()`) memakai persis gagasan-gagasan ini.

> 🛠 **Coba sendiri (10 menit, pratinjau opsional DuckDB).** Ingin melihat perbedaan dialek secara langsung sebelum Modul 2.1 membahas DuckDB secara sistematis? Jalankan `pip install duckdb` lalu eksekusi setiap pernyataan di SQLite (`sqlite3`) dan di DuckDB, lalu cetak kedua hasilnya berdampingan: `SELECT 7/2`; `SELECT 'abc' LIKE 'ABC'`; `SELECT x FROM (SELECT 1 AS x UNION ALL SELECT NULL UNION ALL SELECT 2) ORDER BY x`; `SELECT x, y FROM (SELECT 1 AS x, 2 AS y UNION ALL SELECT 1, 3) GROUP BY x` (tangkap error-nya).
>
> **Seharusnya Anda melihat:** `3` dibanding `3.5`; `1` dibanding `False`; NULL di awal dibanding NULL di akhir; sebuah baris sembarang `(1, 2)` dibanding `Binder Error`. Empat perbedaan diam-diam dalam empat baris: mana yang akan menipu Anda?

## @lesson Subtotal dan total akhir: GROUPING SETS, ROLLUP, dan CUBE
Sebuah laporan sering butuh baris detail, subtotal, dan total akhir dalam satu tabel. Dengan `GROUP BY` biasa itu memerlukan satu query per tingkat, disambung dengan `UNION ALL` (tantangan k-29 melakukannya untuk satu baris total). SQL punya perluasan `GROUP BY` yang menghitung beberapa pengelompokan dalam **satu kali lewat** data:

- `GROUPING SETS ((a), (b), ())` mendaftar persis pengelompokan yang Anda mau: per `a`, per `b`, dan total akhir `()`.
- `ROLLUP (a, b)` adalah hierarki detail, subtotal, total: pengelompokan `(a, b)`, `(a)`, dan `()`. Pakai bila `b` berada di dalam `a` (sebuah kota, lalu metode bayar).
- `CUBE (a, b)` adalah semua kombinasi: `(a, b)`, `(a)`, `(b)`, dan `()`. Pakai untuk tabel silang di mana salah satu dimensi bisa menjadi subtotal.

Pada setiap baris hasil, kolom yang *digulung* menampilkan NULL. Pada enam produk KopiKu:

```sql
SELECT roast, origin, COUNT(*) AS products
FROM products
GROUP BY GROUPING SETS ((roast), (origin), ());
-- dark 2, light 2, medium 2  |  enam origin masing-masing 1  |  total 6   (10 baris)
```

**Masalah NULL.** Baris subtotal punya NULL di kolom yang digulung, tetapi data Anda juga bisa berisi NULL sungguhan. Dua pelanggan KopiKu tidak punya kota, jadi `ROLLUP (tier, city)` mengembalikan, untuk tier Bronze, dua baris yang tampak identik:

```sql
SELECT tier, city, COUNT(*) AS customers, GROUPING(city) AS city_rolled_up
FROM customers
GROUP BY ROLLUP (tier, city);
-- Bronze  NULL  1  0   <- satu pelanggan Bronze tanpa kota: NULL sungguhan
-- Bronze  NULL  5  1   <- subtotal kelima pelanggan Bronze
-- ... 14 baris seluruhnya, yang terakhir   NULL  NULL  10  1   adalah total akhir
```

`GROUPING(kolom)` mengembalikan 1 bila NULL itu hanyalah penanda hasil gulungan dan 0 bila kolom itu ikut dalam pengelompokan. Jangan pernah memakai `city IS NULL` untuk mengenali subtotal: ia juga cocok dengan NULL sungguhan, dan laporan akan menampilkan jumlah pelanggan sebagai "subtotal". Beri label baris dengan `GROUPING`, baru kemudian percantik labelnya (misalnya `CASE WHEN GROUPING(city) = 1 THEN 'Semua kota' ELSE COALESCE(city, 'Unknown') END`). Perhatikan bahwa `GROUPING(a, b)` dengan beberapa kolom mengembalikan bit mask (0, 1, 3), bukan hitungan.

**Di mana ia berjalan.** PostgreSQL dan DuckDB menjalankan ketiganya dan mengembalikan baris yang identik untuk setiap query di halaman ini. Gudang data juga mendukungnya (dari dokumentasi mereka, tidak dijalankan di kursus ini). SQLite tidak: `GROUP BY ROLLUP (...)` gagal di sana dengan `no such function: rollup`. Karena itu SQL Sandbox di browser tidak bisa melatihnya dan latihan di bawah memakai DuckDB di komputer Anda. Pada mesin tanpa fitur ini, kembalilah ke beberapa query `GROUP BY` yang digabung dengan `UNION ALL`.

> 🛠 **Coba sendiri (25 menit, pratinjau opsional DuckDB lokal sebelum Modul 2.1).** Jika Anda sudah memasang `duckdb` di atas (`pip install duckdb`), muat dataset KopiKu di `labs/mod-1-3/datasets/kopiku.sql` dengan `con = duckdb.connect(); con.execute(open("labs/mod-1-3/datasets/kopiku.sql").read())` untuk mencoba query berikut di komputer Anda (Modul 2.1 membahas DuckDB dan engine kolumnar secara menyeluruh). Di file `rollup.py`, definisikan tiga variabel yang berisi teks SQL:
> 1. `REVENUE_ROLLUP` mengembalikan `city`, `payment_method`, `revenue_idr`, dan `level`. Omzet adalah jumlah `qty * unit_price_idr` dari item pesanan **delivered**. Berikan baris detail per kota dan metode bayar, subtotal per kota, dan total akhir, memakai `ROLLUP`. `level` bernilai 0 untuk baris detail, 1 untuk subtotal kota, dan 2 untuk total akhir (bangun dengan `GROUPING`, bukan dengan `IS NULL`).
> 2. `STATUS_CUBE` mengembalikan `status`, `payment_method`, dan `orders`: jumlah pesanan untuk setiap status dan metode bayar, untuk setiap status saja, untuk setiap metode saja, dan totalnya, memakai `CUBE`.
> 3. `TIER_OR_METHOD` mengembalikan `tier`, `payment_method`, dan `orders`: jumlah pesanan per tier pelanggan dan, dalam hasil yang sama, per metode bayar, dan tidak ada yang lain, memakai `GROUPING SETS`.
>
> **Yang harus Anda lihat:** 15 baris untuk yang pertama, di antaranya Jakarta 760000 pada level 1, total akhir 2000000 pada level 2, dan, untuk pelanggan tanpa kota, satu baris detail (bank_transfer, 250000, level 0) diikuti subtotalnya (250000, level 1), yang hanya bisa dibedakan dari baris detail lewat `level`; 19 baris untuk yang kedua, berakhir dengan total 18; 7 baris untuk yang ketiga: Bronze 6, Gold 6, Silver 6, lalu bank_transfer 3, card 7, cod 3, dan ewallet 5.
>
> **Periksa:** `python3 labs/tryit/check.py 1.3-9 ~/practice` (file `rollup.py` Anda di `~/practice`). Ia menjalankan ketiga query Anda pada data KopiKu dan pada salinan yang diubah dengan kota baru, pelanggan tanpa kota, dan pesanan tanpa metode bayar, sehingga query yang hanya berhasil pada data hari ini akan gagal.

## @lesson JSON di dalam SQL: membaca dan membangun data semi-terstruktur
API, pelacak event, dan database aplikasi menyimpan JSON: kolom teks (atau JSON) yang tiap barisnya punya bentuk sendiri. Anda tidak perlu meninggalkan SQL untuk memakainya: SQLite, PostgreSQL, dan DuckDB semuanya bisa membaca dan membangun JSON. SQL Sandbox punya dataset untuk ini, `app_events`: tujuh event aplikasi, masing-masing dengan `payload` seperti `{"user": {"id": 7, "plan": "pro"}, "action": "checkout", "items": [{"sku": "A1", "qty": 2, "price": 50000}], "device": "ios"}`.

**Membaca field.** Sebuah *path* dimulai dari `$`, memakai titik untuk objek dan `[0]` untuk posisi array. Operator `->>` mengembalikan nilainya sebagai nilai SQL, jadi bisa difilter, dikelompokkan, dan dijumlahkan. Kunci yang hilang dan kunci yang berisi JSON `null` sama-sama kembali sebagai NULL SQL (pakai `json_type` bila harus membedakannya), jadi bungkus field opsional dengan `COALESCE`. **Memecah array:** `json_each` mengembalikan satu baris per elemen, lalu `->>` membaca field tiap elemen:

```sql
SELECT payload ->> '$.action' AS action, COUNT(*) AS events FROM events GROUP BY 1;     -- checkout 4, view 3

SELECT e.event_id, COUNT(i.key) AS n_items                                              -- 2, 0, 1, 0, 0, 0, 1
FROM events e LEFT JOIN json_each(e.payload, '$.items') i GROUP BY e.event_id;
```

Perhatikan `LEFT JOIN` pada query kedua. Dengan join biasa (`FROM events e, json_each(...)`) event dengan array kosong atau tanpa `items` sama sekali menghasilkan **nol baris**, sehingga ia hilang diam-diam dari hasil. Itu benar bila Anda menginginkan item pesanan, dan salah bila Anda sedang menghitung event.

**Membangun JSON** berjalan ke arah sebaliknya, untuk API dan untuk menyimpan satu record bersarang dalam satu kolom:

```sql
SELECT payload ->> '$.user.id' AS user_id, json_group_array(event_id) AS event_ids FROM events GROUP BY 1;   -- 7: [1,3]   8: [2,7]   9: [4,5]   10: [6]
SELECT json_object('event', event_id, 'user', payload ->> '$.user.id') FROM events WHERE event_id = 1;   -- {"event":1,"user":7}
```

**Dialek.** Kami menjalankan pertanyaan yang sama di SQLite 3.39 (sandbox), PostgreSQL 16 (kolom `jsonb`), dan DuckDB 1.5:

| Tugas | SQLite | PostgreSQL | DuckDB |
|---|---|---|---|
| Field teks | `payload ->> '$.user.plan'` | `payload -> 'user' ->> 'plan'` | `payload ->> '$.user.plan'` |
| Field angka | `->>` mengembalikan **integer** | mengembalikan **teks**: cast dengan `::int` | mengembalikan **teks**: cast dengan `::INT` |
| Satu baris per elemen array | `json_each(payload, '$.items')` | `jsonb_array_elements(payload -> 'items')` | `json_each(payload, '$.items')` |
| Membangun objek | `json_object('a', 1)` | `jsonb_build_object('a', 1)` | `json_object('a', 1)` |
| Mengumpulkan nilai ke array | `json_group_array(x)` | `jsonb_agg(x)` | `json_group_array(x)` |
| Kunci hilang atau JSON `null` | NULL | NULL | NULL |

Dua perbedaan layak dilihat dua kali. `qty * price` berjalan di SQLite karena `->>` mempertahankan angkanya, tetapi di PostgreSQL dan DuckDB ia gagal dengan `text * text` sampai Anda melakukan cast: kegagalan yang berisik dan mudah diperbaiki. Yang diam-diam: di PostgreSQL, `payload ->> '$.user.id'` mengembalikan **NULL untuk setiap baris**, tanpa error, karena sintaks path `$.user.id` bukan milik PostgreSQL (ia mencari kunci yang namanya persis `$.user.id`). Query yang dipindahkan antar mesin bisa mengembalikan kolom kosong dan lolos semua pemeriksaan sintaks.

**Kebiasaan.** Periksa `json_valid(payload)` sebelum mengurai: satu baris yang rusak membuat seluruh query gagal (`malformed JSON` di SQLite). Di PostgreSQL pilih `jsonb`, yang diurai sekali dan bisa diindeks, daripada `json`, yang disimpan sebagai teks. Terutama, **urai sekali, lalu pakai kolom bertipe**: model staging (Modul 2.3) mengubah JSON menjadi kolom dengan tipe sebenarnya, dan semua yang di hilir menanyakan kolom itu, bukan teksnya.

> 🛠 **Coba sendiri (25 menit, SQL Sandbox dengan dataset app_events).** Pilih dataset *Event aplikasi (payload JSON)* dan selesaikan **j-1** (ambil `user.id` dan `user.plan` dari payload), **j-2** (event per perangkat, dengan perangkat yang hilang ditampilkan sebagai `unknown`), **j-3** (satu baris per item beserta total barisnya), dan **j-4** (omzet per paket). Untuk j-3, pakai dulu join biasa lalu `LEFT JOIN`, dan hitung baris yang dikembalikan tiap versi. Lalu, di editor, coba `SELECT payload ->> '$.user.id' FROM events` dan `SELECT payload ->> '$.user.plan' FROM events` dan bandingkan tipe kolomnya.
>
> **Yang harus Anda lihat:** j-1 mengembalikan 7 baris dengan plan NULL untuk event 6; j-2 mengembalikan android 2, ios 2, unknown 2, web 1; j-3 mengembalikan 4 baris (event 1, 1, 3, dan 7), karena event 2, 4, 5, dan 6 tidak punya item; j-4 mengembalikan free 50000 dan pro 310000. Join biasa memberi 4 baris untuk j-3 dan `LEFT JOIN` memberi 8: 4 baris yang sama ditambah satu baris bernilai kosong untuk tiap event 2, 4, 5, dan 6.

## @part Performa dan wawancara

## @lesson Operator join cost-based optimizer, MVCC VACUUM, tuning Sargable, dan 7 pola wawancara SQL {optional}

Saat Anda membaca rencana eksekusi `EXPLAIN ANALYZE` di PostgreSQL, Spark, Snowflake, atau BigQuery, **Cost-Based Optimizer (CBO)** tidak hanya memutuskan apakah akan memakai indeks—ia juga memilih algoritma fisik untuk menggabungkan (join) dua tabel:

| Operator Join Fisik | Cara Kerja di Balik Layar | Kompleksitas & Profil Memori | Kapan Optimizer Memilihnya (dan Kapan Menjadi Bencana) |
|---|---|---|---|
| **Nested Loop Join** | Untuk setiap baris di tabel luar, mencari pasangan di tabel dalam (baik lewat full scan maupun pencarian indeks). | O(N × M) tanpa indeks; O(N log M) dengan indeks B-Tree di tabel dalam. Memori hampir nol. | Terbaik saat tabel luar sangat kecil (< 1.000 baris) dan kunci tabel dalam terindeks. **Bencana** saat statistik `ANALYZE` yang usang menipu CBO hingga mengira tabel 5 juta baris hanya berisi 10 baris! |
| **Hash Join** | Membaca tabel yang lebih kecil (*build side*) ke dalam hash table di memori berdasarkan kunci join, lalu mengalirkan tabel besar (*probe side*) melewatinya dalam satu lintasan. | Waktu CPU O(N + M); membutuhkan RAM sebesar O(ukuran tabel build) (`work_mem`). | Pekerja utama untuk equijoin besar (`ON a.id = b.id`). **Bahaya:** Jika tabel build melebihi batas `work_mem` / RAM executor, hash table akan **tumpah ke disk (spill)** dalam banyak batch (`Batches: 16` di `EXPLAIN` Postgres). |
| **Sort-Merge Join** | Mengurutkan kedua tabel pada kunci join (atau membacanya dalam keadaan sudah terurut dari indeks B-Tree / clustering key) lalu menyatukannya secara beriringan. | O(N log N + M log M) jika belum terurut; O(N + M) jika sudah terurut/terklaster. | Terbaik untuk input sangat besar yang sudah terurut pada kuncinya, atau ketika tidak ada sisi yang muat di memori. PostgreSQL hanya memakainya untuk kondisi kesamaan; join pertidaksamaan (`<=`, `>=`) kembali ke nested loop. |

**Dead Tuple MVCC PostgreSQL, `VACUUM`, dan `ANALYZE`.** Di PostgreSQL, perintah `UPDATE` atau `DELETE` tidak menimpa baris lama secara langsung di disk; di bawah **Multi-Version Concurrency Control (MVCC)**, PostgreSQL menulis versi baris baru (*tuple*) dan menandai baris lama sebagai **dead tuple** agar pembaca konkuren tetap melihat snapshot yang konsisten. Jika tabel staging menerima 500.000 update sehari dan `autovacuum` tertinggal, ukuran tabel membengkak beberapa kali lipat dari ukuran sebenarnya (memperlambat sequential scan) dan statistik kolom menjadi usang. Menjalankan `VACUUM` membebaskan ruang dead tuple agar bisa dipakai ulang; menjalankan `ANALYZE` memperbarui histogram dan estimasi kardinalitas yang dibutuhkan CBO agar tidak salah memilih Nested Loop Join.

**Klinik Refactoring Query Lambat "Sebelum vs. Sesudah" (Predikat Sargable).** Sebuah kondisi filter disebut **Sargable (*Search Argument Able*)** jika engine database dapat mendorongnya langsung ke pencarian indeks B-Tree atau zone map partisi kolumnar tanpa harus menghitung fungsi pada setiap baris:

```sql
-- ❌ LAMBAT (sekitar 32 detik pada 300.000 pesanan di SQLite: correlated subquery + fungsi pada kolom)
SELECT c.customer_id, c.city,
       (SELECT SUM(o.total_idr) FROM orders o
        WHERE o.customer_id = c.customer_id
          AND strftime('%Y-%m', o.order_ts) = '2026-01'
          AND LOWER(o.status) = 'paid') AS jan_paid_idr
FROM customers c;

-- ✅ CEPAT (sekitar 19 ms pada data yang sama: pencarian rentang pada indeks (status, order_ts, customer_id) + satu CTE pra-agregasi)
WITH jan_paid AS (
    SELECT customer_id, SUM(total_idr) AS jan_paid_idr
    FROM orders
    WHERE status = 'paid'
      AND order_ts >= '2026-01-01T00:00:00'
      AND order_ts <  '2026-02-01T00:00:00'
    GROUP BY customer_id
)
SELECT c.customer_id, c.city, COALESCE(j.jan_paid_idr, 0) AS jan_paid_idr
FROM customers c
LEFT JOIN jan_paid j ON j.customer_id = c.customer_id;
```

**7 Cetak Biru Utama Live-Coding SQL 45 Menit dalam Wawancara Data Engineer.** Hampir setiap tes teknis SQL Data Engineering menguji variasi dari tujuh pola ini. Sebelum menulis satu kata `SELECT`, selalu sebutkan kepada pewawancara: **(1) grain hasil akhir**, **(2) aturan pemecah seri (tie-breaker)**, dan **(3) perlakuan terhadap `NULL` atau tanggal yang kosong**:

| # | Cetak Biru Wawancara SQL | Kerangka Inti SQL & Penjaga Kasus Tepi |
|---|---|---|
| **1** | **Deduplikasi Deterministik / State Terbaru** | `QUALIFY ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY updated_at DESC, event_id DESC) = 1` (Selalu tambahkan kolom tie-breaker unik setelah `updated_at`!). |
| **2** | **Sessionization (Jeda Inaktivitas 30 Menit)** | `LAG(event_ts) OVER (PARTITION BY user_id ORDER BY event_ts)` → tandai `CASE WHEN diff_min > 30 OR prev_ts IS NULL THEN 1 ELSE 0 END AS is_new` → `SUM(is_new) OVER (PARTITION BY user_id ORDER BY event_ts)` di query luar membentuk `session_id`. |
| **3** | **Streak Hari Berturut-turut / Gaps & Islands** | Deduplikasi dulu ke `(user_id, active_date)` unik! Lalu kurangi `DATE(active_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY active_date) || ' days') AS island_anchor`; hari-hari yang berurutan akan memiliki `island_anchor` yang persis sama. |
| **4** | **Atribusi Point-in-Time (`ASOF`) / SCD2** | Join fakta ke dimensi dengan `f.event_ts >= d.effective_from AND f.event_ts < COALESCE(d.effective_to, '9999-12-31')` (atau memilih versi terbaru di mana `d.updated_at <= f.event_ts`). Mencegah kebocoran masa depan (future label leakage)! |
| **5** | **Rolling 7 Hari pada Tanggal yang Bolong** | Bangun kalender kontinu `date_spine` terlebih dahulu, `LEFT JOIN` agregat harian (`COALESCE(rev, 0)`), lalu gunakan `AVG(rev) OVER (PARTITION BY store_id ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` agar hari Selasa yang tanpa transaksi tidak terlewati. |
| **6** | **Matriks Retensi Kohort (`Bulan 0..N`)** | CTE 1: `first_month = MIN(order_month) OVER (PARTITION BY user_id)`. CTE 2: `month_num = selisih_bulan(order_month, first_month)`. Hasil: `COUNT(DISTINCT user_id) * 100.0 / MAX(cohort_size)` dikelompokkan per `(first_month, month_num)`. |
| **7** | **Pencegahan Fan-Out Multi-Fakta** | Jangan pernah men-join `accounts` ke `transfers` (1:N) dan `chargebacks` (1:M) dalam satu klausa `FROM` yang sama (5 × 3 = 15 baris!). Pra-agregasi `transfers_by_account` dan `chargebacks_by_account` di CTE terpisah pada grain `account_id` terlebih dahulu, baru `LEFT JOIN` keduanya ke `accounts`. |

> 🛠 **Coba sendiri (20 menit, Python dengan `sqlite3`).** Bangun tabel uji: 2.000 pelanggan dan 300.000 pesanan dengan `order_ts` acak antara 2025-07-01 dan 2026-06-30 (teks ISO), status acak (`paid` tiga kali lebih mungkin daripada `cancelled` atau `refunded`) dan nominal acak, lalu buat indeks `(status, order_ts, customer_id)` sebelum menjalankan `ANALYZE`. Jalankan `EXPLAIN QUERY PLAN` pada query lambat dan cepat di atas, lalu temukan baris untuk `orders` di masing-masing. Setelah itu ukur waktu keduanya dan pastikan totalnya sama.
>
> **Seharusnya Anda melihat:** plan yang lambat berbunyi `CORRELATED SCALAR SUBQUERY` dan `SCAN o`: scan penuh atas pesanan untuk setiap 2.000 pelanggan, karena fungsi pada `order_ts` dan `status` menyembunyikan kolomnya dari indeks. Plan yang cepat berbunyi `SEARCH orders USING INDEX ix_orders (status=? AND order_ts>? AND order_ts<?)`. Keduanya memberi total yang sama (`3192691000` pada data yang diukur di sini, `random.seed(7)`), dalam sekitar `31` sampai `33` detik versus `18` sampai `19` ms. Angka Anda akan sedikit berbeda dengan data acak Anda sendiri; selisihnya tidak. Diukur dengan SQLite 3.46.

## @part SQL Server dan T-SQL

## @lesson SQL Server dan T-SQL: dialek yang diharapkan banyak lowongan {optional}
Alat data Microsoft ada di mana-mana di pasar kerja ini: dari 1.134 lowongan data engineering di TalentHub (2026-07-23 sampai 2026-11-21), **53,9%** menyebut setidaknya satu dari Azure, SQL Server, SSIS, Power BI, Fabric, atau Synapse, dan **10,8%** meminta SQL Server atau T-SQL secara eksplisit. Bank dan perusahaan lama sering menyimpan logika bisnis bertahun-tahun di **stored procedure** SQL Server dan paket SSIS, dan data engineer baru diharapkan bisa membacanya, memperbaikinya, dan suatu saat memindahkannya. Anda sudah menguasai SQL: `SELECT`, join, `GROUP BY`, dan window function bekerja sama di **T-SQL** (Transact-SQL, dialek SQL Server, Azure SQL, Synapse, dan Fabric Warehouse). Pelajaran ini adalah daftar pendek perbedaan yang sering menjebak.

**Jalankan di laptop Anda, gratis.** Edisi Developer SQL Server berjalan di Docker:

```bash
docker run -d --name mssql -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Kopiku#Dev2026" \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2025-latest
docker exec -it mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Kopiku#Dev2026' -C
```

Microsoft meminta RAM minimal 2 GB, dan password harus minimal delapan karakter dari tiga kelompok: huruf besar, huruf kecil, angka, simbol (jika tidak, container berhenti). `-C` mempercayai sertifikat self-signed server, karena tool ODBC 18 mengenkripsi koneksi secara default. Di dalam `sqlcmd`, perintah dijalankan saat Anda mengetik `GO` di barisnya sendiri: `GO` mengakhiri sebuah **batch**, dan ia perintah milik tool, bukan bagian T-SQL. Diukur: image-nya 2,2 GB, diterbitkan untuk amd64 (prosesor Intel dan AMD), dan container baru menjawab query setelah sekitar 7 detik, memakai sekitar 640 MB memori saat diam.

**Perbedaan yang penting:**

| Yang Anda kenal (PostgreSQL, DuckDB, SQLite) | T-SQL | Catatan |
|---|---|---|
| `LIMIT 10` | `TOP (10)`, atau `ORDER BY ... OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY` | `LIMIT` adalah syntax error |
| `QUALIFY ROW_NUMBER() OVER (...) = 1` | beri nomor baris di CTE, lalu `WHERE rn = 1` | tidak ada `QUALIFY` |
| `'a' \|\| 'b'` | `'a' + 'b'` atau `CONCAT('a', 'b')` | `'a' + NULL` hasilnya `NULL`; `CONCAT` melewati `NULL`. `\|\|` berlaku mulai SQL Server 2025 |
| `COALESCE(x, 0)` | sama, atau `ISNULL(x, 0)` | |
| `7 / 2` | `3` | pembagian integer, seperti PostgreSQL; DuckDB memberi `3.5` |
| `strptime(s, '%d/%m/%Y')` | `TRY_CONVERT(date, s, 103)` | nomor style: `126` adalah ISO 8601, `103` adalah dd/mm/yyyy; `TRY_` mengembalikan `NULL` alih-alih gagal |
| `now()`, `d + INTERVAL 1 DAY` | `GETDATE()`, `DATEADD(day, 1, d)`, `DATEDIFF(day, a, b)` | |
| `"order"` | `[order]` | kurung siku mengutip nama |
| `CREATE TEMP TABLE t` | `#t` (sesi Anda), `##t` (semua orang) | |
| `string_agg(x, ',' ORDER BY x)` | `STRING_AGG(x, ',') WITHIN GROUP (ORDER BY x)` | |
| `TEXT` | `NVARCHAR(n)` dengan literal `N'...'` | `N` berarti Unicode: `DATALENGTH(N'abc')` adalah 6 byte |
| `CREATE OR REPLACE` | `CREATE OR ALTER` | untuk procedure, view, dan function |

**Collation: perbedaan yang mengubah angka diam-diam.** **Collation** menentukan cara teks dibandingkan. Default SQL Server (`SQL_Latin1_General_CP1_CI_AS`, diukur) **tidak peka huruf besar-kecil** (`CI`) dan peka aksen (`AS`), sehingga `status <> 'cancelled'` juga mengecualikan `CANCELLED` dan `Cancelled`. DuckDB, PostgreSQL, Spark, dan Snowflake membandingkan dengan peka huruf besar-kecil secara default, sehingga `WHERE` yang sama tetap menyimpan baris itu. Pada data kursus, query yang sama memberi Rp 100.360.000 di SQL Server dan Rp 101.925.000 di DuckDB untuk 10 sampai 12 Januari. Saat Anda memindahkan job SQL Server ke lakehouse, normalkan teks (`lower(trim(status))`) sebelum membandingkan, atau angka hasil migrasi tidak akan cocok dan tidak ada yang tahu sebabnya.

**Stored procedure.** Procedure adalah T-SQL bernama dengan parameter, disimpan di database dan dijalankan dengan `EXEC`. Pipeline lama sering berupa rangkaian procedure yang dijadwalkan SQL Server Agent, SSIS, atau Data Factory (Pelajaran 10 Modul 2.6). Procedure pemuatan yang aman terlihat seperti ini:

```sql
CREATE OR ALTER PROCEDURE dbo.usp_load_daily_revenue @day DATE
AS
BEGIN
    SET NOCOUNT ON;      -- tanpa pesan "(1 row affected)"
    SET XACT_ABORT ON;   -- error apa pun membatalkan seluruh transaksi
    BEGIN TRAN;
    MERGE daily_revenue AS t
    USING (SELECT ... WHERE order_ts >= @day AND order_ts < DATEADD(day, 1, @day) ...) AS s
    ON t.order_date = s.order_date
    WHEN MATCHED THEN UPDATE SET orders = s.orders, revenue_idr = s.revenue_idr
    WHEN NOT MATCHED BY TARGET THEN INSERT (order_date, orders, revenue_idr)
        VALUES (s.order_date, s.orders, s.revenue_idr);   -- MERGE wajib diakhiri titik koma
    COMMIT;
END;
```

**DDL, DML, DCL, dan TCL.** *Fundamentals of Data Engineering* membagi perintah SQL menjadi empat jenis, dan T-SQL punya keempatnya: **DDL** mendefinisikan objek (`CREATE`, `ALTER`, `DROP`), **DML** membaca dan mengubah baris (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`), **DCL** mengatur akses (`GRANT`, `REVOKE`, dan di SQL Server juga `DENY`, yang mengalahkan grant apa pun), dan **TCL** mengatur transaksi (`BEGIN TRAN`, `COMMIT`, `ROLLBACK`). Procedure di atas memakai DML di dalam TCL; Modul 2.6 menunjukkan DCL untuk role warehouse.

> 🛠 **Coba sendiri (30 menit, Docker dan `sqlcmd`).** Jalankan SQL Server seperti di atas dan salin datanya: `docker cp data/orders.csv mssql:/tmp/orders.csv`. Buat database `kopiku` dan tabel `raw_orders` dengan enam kolom file itu, semuanya `NVARCHAR(50)`, lalu muat dengan `BULK INSERT raw_orders FROM '/tmp/orders.csv' WITH (FORMAT = 'CSV', FIRSTROW = 2)`. Hitung baris yang `total_idr`-nya hanya angka (`NOT LIKE '%[^0-9]%'`) dan `order_ts`-nya bisa dikonversi dengan style 126. Jika jawabannya mengejutkan, cari tahu sebabnya sebelum lanjut. Lalu buat `daily_revenue (order_date DATE PRIMARY KEY, orders INT, revenue_idr BIGINT)`, lengkapi procedure di atas untuk pesanan yang tidak dibatalkan, dan jalankan untuk 10, 11, dan 12 Januari, dua kali. Terakhir, coba `LIMIT` dan `QUALIFY` pada `raw_orders`.
>
> **Seharusnya Anda melihat:** `3634` baris dimuat, tetapi `0` yang bersih: file-nya mengakhiri baris dengan `\r\n`, sehingga setiap `total_idr` menyimpan `\r` yang tak terlihat dan tidak ada total yang "hanya angka". Tambahkan `ROWTERMINATOR = '0x0d0a'`, muat ulang, dan Anda mendapat `3539`. Style 126 membaca `3593` timestamp dan style 103 sisanya, `41`. Setelah kedua run, `daily_revenue` berisi `3` hari dan `100360000` (`109`, `108`, dan `93` pesanan): menjalankan dua kali tidak mengubah apa pun. `LIMIT 3` gagal dengan `Incorrect syntax near '3'`, `QUALIFY` dengan `Incorrect syntax near 'ROW_NUMBER'`. Diukur pada SQL Server 2025 (17.0) di Docker. Hentikan sesudahnya dengan `docker rm -f mssql`; image-nya tetap ada sampai Anda menjalankan `docker rmi`.

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

   Sebagian besar tes gagal pada awalnya (6 dari 10 dengan starter). Itulah titik awalnya. (Untuk memakai PostgreSQL Anda sendiri, misalnya dari Docker, set `DATABASE_URL` ke database sementara yang kosong. Di Python 3.14 `pip` melewati `pgserver` (belum ada build untuk 3.14), jadi jalankan PostgreSQL di Docker: `docker run -d --name kopiku-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg16 -c wal_level=logical`, lalu `docker exec kopiku-pg psql -U postgres -c "CREATE DATABASE lab13"` dan `export DATABASE_URL=postgresql://postgres:dev@localhost:5432/lab13`. Satu container itu melayani Modul 1.3, 3.2, dan 3.5 (ada pgvector dan logical decoding); diukur di Python 3.14, referensinya lulus 10 tes dengan cara ini.)
5. **Bagian B, tuning.** Buka `labs/mod-1-3/explain/queries.sql` dan `indexes.sql`. Lihat keempat query dan tentukan kolom mana yang difilter dan diurutkan masing-masing. Tulis pernyataan `CREATE INDEX` **sesedikit mungkin** di `indexes.sql` sehingga tidak ada query yang melakukan Seq Scan, dan Q3 tidak butuh Sort. Tulis ulang Q4 di `queries.sql` agar memberi jawaban sama tetapi bisa memakai index.
6. Untuk melihat apa yang dilihat tes, muat tabel ke PostgreSQL mana pun dan jalankan `EXPLAIN (ANALYZE, BUFFERS)` pada tiap query sebelum dan sesudah perubahan Anda; bandingkan baris perkiraan dan aktual, halaman yang dibaca, dan waktu.
7. Jalankan ulang tes sampai semuanya lulus. Jika ada yang gagal, pesannya menyebut aturan mana yang Anda langgar.

### @files
- labs/mod-1-3/answers.sql :: File kerja Bagian A: satu query per penanda :: starter
- labs/mod-1-3/check.py :: Pemeriksa Bagian A (memakai dataset di bawah) :: test
- labs/mod-1-3/datasets/kopiku.sql :: Dataset untuk sebagian besar pertanyaan Bagian A :: data
- labs/mod-1-3/datasets/daily_sales.sql :: Dataset untuk rata-rata bergerak :: data
- labs/mod-1-3/datasets/categories.sql :: Dataset untuk CTE rekursif :: data
- labs/tryit/check.py :: Pemeriksa latihan Try it, misalnya: python3 labs/tryit/check.py 1.3-9 ~/practice :: config
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
- [x] `DENSE_RANK()`, karena nilai kembar berbagi peringkat dan nilai berikutnya lanjut tanpa celah
- [ ] `NTILE(2)`, karena ia membagi baris terurut menjadi dua keranjang yang hampir sama besar

> RANK akan memberi 4 (melompat setelah nilai kembar), ROW_NUMBER juga 4, dan NTILE untuk keranjang. DENSE_RANK memberi peringkat sama pada nilai kembar dan melanjutkan dengan bilangan bulat berikutnya.

### Anda menulis `SUM(x) OVER (ORDER BY x)` dan baris dengan x sama semuanya menampilkan total berjalan yang sama. Mengapa?
- [ ] Database menyimpan cache hasil pertama untuk nilai yang sama agar tidak menghitung ulang setiap kali
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
- [x] Tanggal dan nomor baris sama-sama naik satu per baris, jadi selisihnya konstan hingga celah
- [ ] Database mengurutkan baris menurut selisihnya, yang menempatkan tanggal berurutan berdampingan

> Dalam satu deretan, setiap baris berikutnya bertanggal sehari kemudian dan bernomor satu lebih tinggi, sehingga pengurangan saling meniadakan. Setelah celah, tanggal melompat tetapi nomor baris tidak, sehingga selisihnya berubah.

### Apa yang menghentikan CTE rekursif agar tidak berjalan selamanya pada sebuah hierarki?
- [ ] Database otomatis berhenti setelah sejumlah putaran tetap, bagaimanapun bentuk datanya sebenarnya di tabel
- [ ] Kata kunci `UNION ALL` membuang setiap baris yang sudah dihasilkan sebelumnya dalam query itu
- [x] Rekursi berakhir ketika satu putaran tidak menghasilkan baris baru, sehingga siklus berputar selamanya
- [ ] Query anchor membatasi jumlah hasil yang bisa ditambahkan oleh bagian rekursif pada tiap putaran berikutnya

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
- [x] `(customer_id, event_time DESC)`: kolom kesamaan dulu, lalu kolom yang dipakai mengurutkan

> Index terurut menurut pelanggan lalu menurut waktu di dalam tiap pelanggan, sehingga baris satu pelanggan sudah dalam urutan yang diinginkan. Kolom tengah yang berbeda merusak urutan, dan kolom pengurutan di depan tidak bisa dicari menurut pelanggan.

### `EXPLAIN ANALYZE` menunjukkan sebuah node dengan perkiraan `rows=15` dan aktual `rows=2000`. Apa artinya, dan apa yang dilakukan pertama kali?
- [ ] Query mengembalikan terlalu banyak baris, jadi tambahkan klausa LIMIT untuk mengurangi jumlahnya
- [ ] Perkiraan itu tidak relevan, karena hanya waktu eksekusi akhir query yang benar-benar penting
- [x] Statistik planner menyesatkannya, jadi jalankan ANALYZE dan periksa kolom yang berkorelasi
- [ ] Index rusak dan harus dibangun ulang sebelum query bisa berjalan dengan benar kembali

> Selisih besar antara baris perkiraan dan aktual berarti planner memilih plan berdasarkan asumsi yang salah (statistik usang, predikat berkorelasi). Perbaiki perkiraannya lebih dulu; plan biasanya ikut membaik.

### Query yang sama dipindah dari SQLite ke PostgreSQL dan kolom nullable yang diurutkannya kini muncul di posisi berbeda, tanpa error. Mengapa?
- [ ] PostgreSQL mengurutkan semua kolom teks terbalik secara default, sehingga setiap kolom berakhir di tempat sebaliknya
- [x] Kedua engine menaruh NULL berbeda secara default, sehingga urutan sebaiknya diatur dengan NULLS FIRST atau LAST
- [ ] SQLite mengabaikan `ORDER BY` untuk kolom yang berisi NULL, sehingga ia mengembalikan baris dalam urutan apa pun
- [ ] PostgreSQL membuang baris NULL sebelum mengurutkan, sehingga mereka tidak muncul di posisi mana pun pada hasil

> Pada proses kami, pengurutan menaik menaruh NULL di awal pada SQLite dan di akhir pada PostgreSQL dan DuckDB. Tulis `NULLS FIRST` atau `NULLS LAST` bila urutan penting, alih-alih memercayai default.

### Mengapa `SELECT x, y FROM t GROUP BY x` bisa berbahaya ketika query yang sama berjalan di SQLite dan di PostgreSQL?
- [ ] SQLite menghitung jawabannya dengan benar, sedangkan PostgreSQL memberi jumlah tak tepat atas baris tiap kelompok
- [ ] Ia aman di kedua engine, karena kolom yang tidak diagregasi selalu diambil dari baris pertama
- [x] PostgreSQL menolak query itu karena ambigu, tetapi SQLite mengembalikan `y` sembarang tanpa peringatan
- [ ] SQLite menolaknya dengan error, sedangkan PostgreSQL diam-diam menambahkan `y` ke daftar `GROUP BY`

> SQLite mengembalikan `y` dari satu baris, sedangkan PostgreSQL dan DuckDB memunculkan error. Bug yang akan ditangkap engine ketat bisa lolos diam-diam di prototipe, jadi cantumkan setiap kolom tak teragregasi di `GROUP BY`.

### Hasil `GROUP BY ROLLUP (city, payment_method)` punya baris dengan `city` NULL. Bagaimana membedakan baris subtotal dari pelanggan yang kotanya memang tidak diketahui?
- [ ] Baris subtotal selalu muncul paling akhir, jadi posisi baris memberi tahu Anda yang mana
- [ ] Subtotal menampilkan teks `'ALL'` alih-alih NULL, jadi NULL selalu berarti kota yang benar-benar tidak diketahui
- [x] `GROUPING(city)` bernilai 1 di baris tempat city digulung menjadi subtotal, dan 0 jika NULL-nya data asli
- [ ] Keduanya tidak bisa dibedakan, jadi ganti kota NULL dengan penanda sebelum setiap query ROLLUP

> ROLLUP menandai kolom yang digulung dengan NULL, yang bertabrakan dengan NULL asli. `GROUPING(col)` mengembalikan 1 untuk level subtotal dan 0 untuk nilai asli, termasuk NULL asli.

### Di PostgreSQL, `SUM(payload->>'amount')` gagal padahal setiap `amount` di JSON berupa angka. Mengapa?
- [ ] `->>` hanya bekerja pada key tingkat atas, dan `amount` disimpan satu tingkat lebih dalam di payload
- [x] `->>` mengembalikan teks, jadi nilainya harus di-cast (misalnya `::numeric`) sebelum dijumlahkan
- [ ] SUM sama sekali tidak bisa membaca kolom JSON; nilainya harus disalin ke tabel lebih dulu
- [ ] Key-nya harus ditulis sebagai path, `'$.amount'`, atau PostgreSQL tidak menemukannya

> `->>` mengambil teks; `->` mengambil JSON. Aritmetika butuh cast. (String JSONPath seperti `'$.amount'` setelah `->>` bukan path di PostgreSQL: hasilnya diam-diam NULL.)

### Job SQL Server memfilter `WHERE status <> 'cancelled'`. Dipindah ke DuckDB tanpa diubah, pendapatannya jadi lebih tinggi. Apa penyebab yang paling mungkin?
- [ ] DuckDB membulatkan setiap total BIGINT ke atas ke ribuan rupiah terdekat
- [x] Collation default SQL Server tidak peka huruf besar-kecil, jadi CANCELLED juga terbuang
- [ ] DuckDB membaca CSV dua kali ketika sebuah filter membandingkan nilai teks
- [ ] Operator `<>` SQL Server melewati NULL, sedangkan DuckDB menghitungnya sebagai cancelled

> Collation default SQL Server (`..._CI_AS`) tidak peka huruf besar-kecil, sehingga `'CANCELLED' <> 'cancelled'` bernilai false di sana dan true di DuckDB, PostgreSQL, Spark, dan Snowflake. Normalkan teks sebelum membandingkan.

## @resources
- [Dokumen PostgreSQL: tutorial window function](https://www.postgresql.org/docs/current/tutorial-window.html)
- [Dokumen PostgreSQL: memakai EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Dokumen PostgreSQL: index](https://www.postgresql.org/docs/current/indexes.html)
- [Dokumen PostgreSQL: query WITH (rekursif)](https://www.postgresql.org/docs/current/queries-with.html)
- [SQLite: window function](https://www.sqlite.org/windowfunctions.html)
