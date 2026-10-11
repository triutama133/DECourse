---
title: Database dan SQL 101: Mengajukan Pertanyaan pada Data
duration: 2 minggu
summary: Pelajari cara tabel relasional disusun dan tulis SQL yang akan Anda pakai setiap hari: memfilter, mengelompokkan, menggabungkan, serta jebakan NULL dan duplikasi join yang diam-diam menghasilkan angka salah.
why: Tutorial memperlakukan SQL sebagai sintaks untuk dihafal pada tabel yang sempurna. Di pekerjaan nyata sintaksnya mudah dan bahayanya adalah query yang berjalan mulus tetapi mengembalikan angka salah, karena NULL, join yang menggandakan baris, atau grain yang disalahpahami.
---

## @outcomes
- Membaca desain tabel dan menjelaskan arti primary key dan foreign key-nya
- Menulis query SELECT dengan filter, pengurutan, pengelompokan, dan agregasi, serta menjelaskan urutan SQL mengevaluasinya
- Memprediksi perilaku NULL dalam perbandingan, agregat, dan NOT IN
- Menggabungkan tabel dengan INNER dan LEFT join, dan mengenali saat join menggandakan baris dan merusak sebuah penjumlahan
- Mengubah data dengan aman lewat INSERT, UPDATE, dan DELETE dan menjelaskan apa yang dilindungi oleh transaksi

## @prereq
Modul 0.1 dan 0.2 membantu. Anda bisa mengerjakan seluruh lab di browser (SQL Sandbox) atau dengan modul `sqlite3` bawaan Python; tidak perlu instalasi.

## @lesson Tabel, baris, kolom, dan kunci
**Database relasional** menyimpan data dalam **tabel**. Tabel seperti lembar spreadsheet dengan aturan ketat: setiap kolom punya **nama dan tipe** (integer, teks, tanggal, desimal), dan setiap baris punya kolom yang sama. Data mini KopiKu punya empat tabel:

- `customers(customer_id, name, city, tier, signup_date)`: satu baris per pelanggan
- `products(product_id, name, origin, roast, price_idr)`: satu baris per produk kopi
- `orders(order_id, customer_id, order_date, status, payment_method, shipping_fee_idr)`: satu baris per pesanan
- `order_items(order_id, line_no, product_id, qty, unit_price_idr)`: satu baris per baris produk dalam sebuah pesanan

Mengapa empat tabel dan bukan satu lembar besar? Karena setiap *fakta* disimpan sekali. Kota pelanggan ada di `customers`; kalau Budi pindah, Anda mengubah satu baris, bukan 400 baris pesanan. Gagasan ini, disebut **normalisasi**, mencegah data saling bertentangan.

Dua jenis kunci membuat tabel-tabel itu bekerja bersama:

- **Primary key (PK)** mengidentifikasi sebuah baris secara unik: `customers.customer_id`. Tidak ada dua baris yang sama dan nilainya tidak pernah kosong. `order_items` memakai kunci *komposit*: `(order_id, line_no)` bersama-sama.
- **Foreign key (FK)** adalah kolom yang menunjuk ke primary key tabel lain: `orders.customer_id` merujuk ke `customers.customer_id`. Database bisa menegakkan bahwa Anda tidak dapat membuat pesanan untuk pelanggan yang tidak ada.

Tanyakan pada setiap tabel sebelum Anda meng-query-nya: **satu baris mewakili apa?** Itulah **grain** tabel. `orders` punya satu baris per pesanan, `order_items` satu baris per *baris produk*. Hampir setiap angka salah dalam analitik berasal dari lupa pada grain, seperti yang akan Anda lihat di pelajaran join.

Sepatah kata tentang spreadsheet. Excel sangat baik untuk pekerjaan kecil dan ad hoc. Ia kurang cocok bila data besar (Excel berhenti di 1.048.576 baris per sheet), dipakai banyak orang bersamaan, harus tetap konsisten (siapa pun bisa mengetik teks di kolom angka), atau harus diulang otomatis tiap malam. Database memberi Anda tipe, constraint, akses bersamaan, riwayat, dan kecepatan, dan itulah sebabnya pipeline memuat data ke dalamnya.

## @lesson Membaca data: SELECT, WHERE, ORDER BY
Query dasar punya bentuk tetap:

```sql
SELECT name, city
FROM customers
WHERE tier = 'Gold'
ORDER BY name;
```

Ini mengembalikan `Budi Santoso, Jakarta` dan `Wulan Kusuma, Bandung`. Bacalah dengan urutan yang *dipikirkan* database, bukan urutan penulisan: ia mengambil baris **FROM** `customers`, menyimpan yang **WHERE** `tier = 'Gold'`, memilih kolom di **SELECT**, dan terakhir mengurutkan dengan **ORDER BY**. Pakai `SELECT *` hanya saat menjelajah; di kode sungguhan sebutkan kolom yang Anda butuhkan.

Alat yang konstan dipakai di `WHERE`:

| Kebutuhan | Sintaks | Contoh |
|---|---|---|
| Perbandingan | `=`, `<>` (tidak sama), `<`, `<=`, `>`, `>=` | `qty >= 2` |
| Menggabung kondisi | `AND`, `OR`, `NOT` (pakai tanda kurung) | `tier = 'Gold' AND city = 'Jakarta'` |
| Salah satu dari beberapa nilai | `IN (...)` | `city IN ('Jakarta', 'Bandung')` |
| Rentang, inklusif | `BETWEEN a AND b` | `order_date BETWEEN '2026-01-10' AND '2026-01-20'` |
| Pola teks | `LIKE` dengan `%` (teks apa pun) dan `_` (satu karakter) | `name LIKE '%a'` |
| Nilai hilang | `IS NULL`, `IS NOT NULL` | `city IS NULL` |

Hal penting lain: `SELECT DISTINCT payment_method` membuang nilai berulang; `LIMIT 10` hanya mengembalikan baris pertama (bagus saat menjelajah tabel raksasa); `AS` mengganti nama kolom (`SUM(qty) AS units`). Nilai teks memakai tanda kutip tunggal (`'Gold'`); kutip ganda dalam SQL standar berarti nama kolom atau tabel.

> **Tip:** Kebiasaan yang mencegah sebagian besar kesalahan: sebelum menulis query rumit, jalankan `SELECT * FROM nama_tabel LIMIT 10` dan lihat baris asli. Lalu tambahkan satu klausa sekali waktu dan jalankan ulang. Ketika hasil tampak salah, hapus klausa satu per satu sampai tampak benar.

Catatan soal tanggal: database punya tipe tanggal, tetapi banyak data nyata menyimpan tanggal sebagai teks seperti `'2026-01-15'`. Format ISO (tahun-bulan-hari) istimewa karena urutan teksnya sama dengan urutan tanggalnya, itulah sebabnya `BETWEEN` bekerja padanya. Tanggal yang ditulis `15/01/2026` tidak terurut dan terbandingkan dengan benar: seragamkan sejak awal.

## @lesson NULL: nilai yang bukan nilai
`NULL` berarti **tidak diketahui atau hilang**. Ia bukan nol dan bukan string kosong, dan perilakunya berbeda dari yang lain. Ini sumber terbesar kesalahan diam-diam bagi pemula, jadi luangkan waktu di sini.

Aturannya: setiap perbandingan dengan NULL menghasilkan bukan benar maupun salah, melainkan **UNKNOWN**, dan `WHERE` hanya menyimpan baris yang kondisinya *benar*. Memakai pelanggan KopiKu (dua dari sepuluh tidak punya kota):

```sql
SELECT COUNT(*) FROM customers WHERE city = 'Jakarta';   -- 3
SELECT COUNT(*) FROM customers WHERE city <> 'Jakarta';  -- 5, bukan 7!
```

Tiga di Jakarta, lima di tempat lain, dan dua tidak diketahui kotanya. Query `<>` diam-diam melewatkan dua orang itu, karena `NULL <> 'Jakarta'` adalah UNKNOWN. Untuk menyertakan mereka Anda harus menyatakannya:

```sql
SELECT COUNT(*) FROM customers WHERE city <> 'Jakarta' OR city IS NULL;   -- 7
```

Anda tidak pernah bisa menguji NULL dengan `=`: `city = NULL` tidak pernah benar. Pakai `IS NULL` dan `IS NOT NULL`.

Tempat lain di mana NULL menggigit:

- **Agregat melewati NULL.** `COUNT(*)` menghitung baris (10), `COUNT(city)` menghitung nilai non-NULL (8), dan `AVG(x)` hanya merata-ratakan baris yang `x`-nya bukan NULL. Jika NULL benar-benar berarti nol bagi bisnis Anda ("tanpa diskon"), ubah dulu.
- **Aritmetika menyebarkan NULL.** `price - discount` adalah NULL bila `discount` NULL, sehingga total seluruh baris itu lenyap.
- **`NOT IN` dengan NULL di dalam daftar tidak mengembalikan apa pun.** `city NOT IN ('Jakarta', NULL)` cocok dengan nol baris, karena perbandingan dengan NULL adalah UNKNOWN untuk setiap baris. Ini bug produksi klasik ketika daftarnya berasal dari subquery yang kebetulan memuat NULL. Pilih `NOT EXISTS` atau anti-join LEFT JOIN (di bawah).
- **`COALESCE(a, b, ...)`** mengembalikan argumen pertama yang bukan NULL. `COALESCE(city, 'Unknown')` membuat kota yang hilang tampil sebagai `Unknown`.

> **Peringatan:** Ketika hitungan atau jumlah tampak "agak rendah", curigai NULL sebelum mencurigai datanya. Tambahkan `OR col IS NULL`, atau `COALESCE`, dan lihat apakah angkanya bergeser.

## @lesson Agregasi: GROUP BY dan HAVING
Agregasi meringkas banyak baris menjadi satu angka per kelompok. Fungsinya `COUNT`, `SUM`, `AVG`, `MIN`, dan `MAX`.

```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status;
```

Ini mengembalikan delivered 12, paid 2, cancelled 2, shipped 1, dan refunded 1. Setiap kolom non-agregat di `SELECT` juga harus muncul di `GROUP BY`; database perlu tahu kelompok mana yang dimiliki setiap baris keluaran.

Tiga hitungan sering tertukar:

- `COUNT(*)` menghitung baris.
- `COUNT(col)` menghitung baris yang `col`-nya bukan NULL.
- `COUNT(DISTINCT col)` menghitung nilai non-NULL yang berbeda (`COUNT(DISTINCT city)` adalah 5 di sini).

**WHERE vs HAVING.** `WHERE` memfilter *baris sebelum* pengelompokan; `HAVING` memfilter *kelompok setelah* agregasi. Untuk mencari pelanggan dengan tiga pesanan atau lebih:

```sql
SELECT customer_id, COUNT(*) AS n
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3;
```

Anda tidak bisa menaruh `COUNT(*) >= 3` di `WHERE`, karena pada tahap itu kelompok belum ada. Urutan logis lengkap yang diikuti SQL layak dihafal:

1. `FROM` dan `JOIN`: membangun baris yang dikerjakan
2. `WHERE`: memfilter baris
3. `GROUP BY`: membentuk kelompok
4. `HAVING`: memfilter kelompok
5. `SELECT`: menghitung kolom keluaran (inilah sebabnya alias `SELECT` tidak bisa dipakai di `WHERE`)
6. `ORDER BY`, lalu `LIMIT`

Waspadai pembagian bilangan bulat: di banyak database `7 / 2` adalah `3`. Tulis `7.0 / 2` atau cast ke desimal bila Anda ingin pecahan (misalnya persentase: `100.0 * bagian / total`).

## @lesson Join: menggabungkan tabel, dan bagaimana ia bisa salah
**Join** menyatukan baris dari dua tabel yang cocok pada sebuah kunci.

```sql
SELECT c.name, o.order_id, o.status
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id;
```

`c` dan `o` adalah alias tabel. Klausa `ON` menyatakan kolom mana yang harus cocok. `JOIN` biasa adalah **INNER JOIN**: hanya menyimpan pasangan yang cocok, sehingga pelanggan tanpa pesanan hilang dari hasil (`customers JOIN orders` punya 18 baris, satu per pesanan).

**LEFT JOIN** menyimpan *setiap* baris tabel kiri, mengisi sisi kanan dengan NULL bila tidak ada yang cocok (`customers LEFT JOIN orders` punya 20 baris: 18 pesanan ditambah dua pelanggan tanpa pesanan). Itu menjadikannya alat untuk pertanyaan tentang ketiadaan. Pelanggan yang tidak pernah memesan:

```sql
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;
```

Pola ini disebut **anti-join** dan mengembalikan Fajar Nugroho dan Rizky Saputra. (`RIGHT JOIN` adalah bayangan cerminnya, dan `FULL JOIN` menyimpan baris tak cocok dari kedua sisi; hampir selalu bisa ditulis ulang sebagai LEFT JOIN.)

> **Peringatan:** Taruh filter untuk tabel *kanan* dari LEFT JOIN di klausa `ON`, bukan di `WHERE`. `WHERE o.status = 'delivered'` membuang baris NULL yang baru saja dibuat LEFT JOIN, diam-diam mengubahnya kembali menjadi INNER JOIN.

**Jebakan fan-out.** Menggabungkan tabel pada satu grain dengan tabel pada grain yang lebih halus **mengulang** baris yang lebih kasar. `orders` punya satu baris per pesanan, `order_items` satu per baris produk, jadi menggabungkannya menghasilkan satu baris per *baris produk*: 24 baris untuk 18 pesanan. Apa pun yang disimpan per pesanan (seperti biaya kirim) kini terulang untuk setiap baris produk. Bandingkan:

```sql
-- Benar: satu baris per pesanan
SELECT SUM(shipping_fee_idr) FROM orders WHERE status = 'delivered';   -- 235.000

-- Salah: biaya terulang untuk tiap baris produk dalam pesanan
SELECT SUM(o.shipping_fee_idr)
FROM orders o JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'delivered';                                          -- 350.000
```

Query kedua berjalan tanpa error apa pun dan melaporkan pendapatan ongkir 49% terlalu tinggi. Pertahanan yang harus Anda jadikan kebiasaan: selalu ketahui grain tiap tabel; setelah join, periksa `COUNT(*)` terhadap yang Anda harapkan; jumlahkan nilai per pesanan hanya pada grain per pesanan, atau agregasikan tabel yang lebih halus lebih dulu (`SELECT order_id, SUM(qty * unit_price_idr) ... GROUP BY order_id`) lalu join hasilnya.

Join pada kunci yang tidak unik di *kedua* sisi adalah **join many-to-many**, yang melipatgandakan baris lebih jauh lagi. Jika jumlah baris setelah join lebih besar dari yang bisa Anda jelaskan, berhenti dan cari tahu mengapa sebelum lanjut.

## @lesson CASE, subquery, dan CTE
**CASE** adalah if/else-nya SQL, dipakai untuk membuat kategori. Di sini `order_totals` adalah total per pesanan, didefinisikan di contoh CTE di bawah:

```sql
SELECT order_id,
       CASE WHEN order_total < 100000 THEN 'small'
            WHEN order_total < 200000 THEN 'medium'
            ELSE 'large' END AS size
FROM order_totals;
```

**Subquery** adalah query di dalam query lain. Subquery skalar mengembalikan satu nilai, berguna untuk porsi dari total:

```sql
SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS pct
FROM orders
GROUP BY payment_method;
```

**CTE** (common table expression, `WITH nama AS (...)`) memberi nama pada hasil antara sehingga query panjang terbaca dari atas ke bawah seperti resep:

```sql
WITH order_totals AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT o.order_id, o.status, t.order_total
FROM orders o
JOIN order_totals t ON t.order_id = o.order_id;
```

Ini juga cara aman menghindari jebakan fan-out: hitung total grain yang lebih halus di CTE (satu baris per pesanan) sebelum join. Pilih CTE daripada subquery bersarang dalam: lebih mudah dibaca, di-debug (pilih dari tiap langkah sendiri-sendiri), dan ditinjau.

Gaya penulisan penting karena orang lain akan merawat SQL Anda. Taruh tiap klausa di barisnya sendiri, pakai alias yang jelas, jaga konsistensi huruf kapital keyword, dan tambahkan komentar yang menjelaskan *mengapa* sebuah filter ada ("kecualikan akun uji") bukan apa yang dilakukannya.

## @lesson Mengubah data dengan aman: DML, constraint, dan transaksi
Selain membaca, SQL mengubah data:

```sql
INSERT INTO customers (customer_id, name, city, tier, signup_date)
VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');

UPDATE customers SET tier = 'Silver' WHERE customer_id = 11;

DELETE FROM customers WHERE customer_id = 11;
```

> **Peringatan:** `UPDATE` dan `DELETE` tanpa `WHERE` mengubah **setiap baris**. Sebelum menjalankan keduanya, jalankan `WHERE` yang sama dalam `SELECT` dan periksa jumlah barisnya. Di produksi, jalankan di dalam transaksi (di bawah) dan periksa sebelum commit.

**Constraint** membiarkan database menolak data buruk alih-alih menyimpannya: `PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK (qty > 0)`. Aturan yang ditegakkan database berlaku tak peduli aplikasi mana yang menulis ke sana; aturan yang hanya ada di kode aplikasi berlaku sampai seseorang menulis skrip.

**Transaksi** mengelompokkan pernyataan sehingga berhasil atau gagal *bersama-sama*:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;      -- atau ROLLBACK; untuk membatalkan keduanya
```

Jika server crash di antara dua update, tidak ada yang berlaku; uang tidak pernah hilang. Transaksi memberi jaminan **ACID**: *Atomicity* (semua atau tidak sama sekali), *Consistency* (constraint selalu terpenuhi), *Isolation* (transaksi bersamaan tidak melihat pekerjaan setengah jadi satu sama lain), dan *Durability* (data yang sudah di-commit bertahan saat crash). Jaminan ini yang membuat database produksi bisa dipercaya, dan mengapa Modul 2.2 begitu peduli ketika data lake mencoba menambahkannya ke file biasa.

**Index** adalah struktur pencarian terpisah yang membuat pencarian baris berdasarkan sebuah kolom cepat, seperti indeks di belakang buku. Ia mempercepat pembacaan dan sedikit memperlambat penulisan; Modul 1.3 kembali membahas kapan dan bagaimana membuatnya.

Terakhir, **SQL punya dialek**. Inti pelajaran ini bekerja di mana-mana, tetapi fungsi tanggal, fungsi string, `LIMIT` versus `TOP`, dan fitur khusus berbeda antara SQLite (dipakai di sandbox kursus ini), PostgreSQL, MySQL, DuckDB, Snowflake, dan BigQuery. Ketika sesuatu gagal setelah menyalin query, periksa dialeknya dulu.

## @lab Lab: sepuluh pertanyaan tentang KopiKu
Anda data engineer baru dan pendiri toko punya sepuluh pertanyaan. Jawab dengan SQL pada dataset mini KopiKu: tabel pelanggan dengan kota NULL, pesanan dengan pembatalan dan refund, dan biaya kirim yang menggoda Anda membuat bug fan-out.

### @steps
1. Pilih tempat bekerja. **Di browser (disarankan):** buka SQL Sandbox dari aplikasi, pilih dataset KopiKu dan pilih sebuah tantangan; sandbox menjalankan query Anda dan memberi tahu apakah hasilnya cocok. **Lokal:** pakai file di bawah dengan SQLite bawaan Python, tanpa instalasi.
2. Untuk jalur lokal, buka `labs/mod-0-3/answers.sql`. Di bawah tiap penanda `-- k-N`, tulis satu query. Jangan hapus penandanya.
3. Periksa pekerjaan Anda kapan saja dengan pemeriksa, yang membandingkan hasil Anda dengan hasil referensi:

```bash
python3 labs/mod-0-3/check.py
```

4. Kerjakan pertanyaan berurutan; makin lama makin sulit. Pertanyaan 4, 6, dan 8 adalah jebakan dari materi (NULL, NULL-menjadi-Unknown dengan join, dan fan-out). Ketika sebuah pertanyaan gagal, baca pesan pemeriksa: ia memberi tahu apakah jumlah kolom, jumlah baris, atau nilainya yang berbeda.
5. Setelah tiap jawaban, jalankan `SELECT COUNT(*)` pada join perantara dan pastikan Anda bisa menjelaskan angkanya. Inilah kebiasaan yang melindungi Anda di pekerjaan nyata.
6. Opsional: buka database sendiri dengan `sqlite3 kopiku.db < labs/mod-0-3/datasets/kopiku.sql` bila Anda punya alat baris perintah `sqlite3`, dan jelajahi dengan `.tables` dan `.schema`.

### @files
- labs/mod-0-3/answers.sql :: File kerja Anda: satu query di bawah tiap penanda :: starter
- labs/mod-0-3/datasets/kopiku.sql :: Dataset (skema dan baris), juga dipakai sandbox :: data
- labs/mod-0-3/check.py :: Pemeriksa yang membandingkan hasil Anda dengan referensi :: test
- labs/mod-0-3/reference/answers.sql :: Jawaban referensi (coba sendiri dulu!) :: reference

### @deliverables
- Kesepuluh jawaban lulus, di sandbox atau dengan `check.py`
- Untuk pertanyaan 4 dan 8 Anda bisa menjelaskan dalam satu kalimat mengapa query yang "jelas" memberi angka salah
- Anda bisa menyebut grain dari keempat tabel

### @verify
Di sandbox, pakai tombol "Periksa jawaban" pada tiap tantangan. Secara lokal:

```bash
python3 labs/mod-0-3/check.py
```

Ia mencetak PASS, FAIL (beserta alasannya) atau TODO per pertanyaan dan totalnya. Untuk melihat seperti apa hasil yang benar sepenuhnya: `python3 labs/mod-0-3/check.py reference`.

## @chaos Pendapatan ongkir yang 49% terlalu tinggi
### @scenario
Tim keuangan bertanya mengapa dashboard menyebut KopiKu memperoleh Rp 350.000 dari ongkir pesanan terkirim di bulan Januari, sementara laporan penyedia pembayaran menyebut Rp 235.000. Query dashboard ditulis berbulan-bulan lalu dan berjalan tiap hari tanpa error apa pun. Tidak ada yang mengubahnya. Analis yang menulisnya sudah keluar.

Query itu menggabungkan `orders` dengan `order_items` karena filter produk ditambahkan kuartal lalu ("hanya hitung pesanan yang memuat biji Gayo"), dan menjumlahkan `shipping_fee_idr` di seluruh baris hasil join.

### @cause
`shipping_fee_idr` disimpan sekali per **pesanan**, tetapi setelah join ke `order_items` ada satu baris per **baris produk**. Pesanan dengan tiga baris produk biaya kirimnya terhitung tiga kali. Hasilnya salah tepat sebanding dengan banyaknya pesanan multi-baris, sehingga tampak masuk akal dan melebar seiring waktu ketika pelanggan mulai membeli lebih banyak produk per pesanan.

Tidak ada error karena SQL tidak punya cara untuk tahu bahwa jumlah itu dimaksudkan per pesanan: query valid, hanya maknanya yang salah.

### @fix
1. Tentukan grain yang Anda inginkan: ongkir per pesanan. Agregasikan atau filter pada grain itu: pakai `WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.order_id AND i.product_id = 1)` alih-alih join, sehingga setiap pesanan tetap satu baris.
2. Atau hitung tabel grain lebih halus dulu di CTE (pesanan distinct yang memuat produk itu) dan join *itu* ke `orders`.
3. Tambahkan tes rekonsiliasi: total ongkir di dashboard harus sama dengan `SELECT SUM(shipping_fee_idr) FROM orders WHERE ...` dan idealnya cocok dengan laporan penyedia pembayaran dalam toleransi.
4. Tambahkan pemeriksaan jumlah baris setelah join pada apa pun yang menjumlahkan nilai per pesanan.

### @pattern
Ketahui grain setiap tabel yang Anda join, dan jumlahkan nilai hanya pada grain tempat ia berada. Setelah join apa pun, tanyakan: apakah jumlah baris berubah dengan cara yang bisa saya jelaskan?

## @quiz
### Di tabel customers KopiKu, 8 dari 10 pelanggan punya kota (2 NULL), dan 3 tinggal di Jakarta. Berapa baris yang dikembalikan `WHERE city <> 'Jakarta'`?
- [ ] 7, karena setiap pelanggan yang tidak di Jakarta ikut masuk hasil, termasuk yang kotanya tidak diketahui
- [ ] 3, karena kondisi itu memilih persis baris yang sama dengan filter Jakarta
- [x] 5, karena pelanggan yang kotanya NULL gagal dalam perbandingan dan tidak ikut dalam hasil
- [ ] 10, karena `<>` mengabaikan kolom kota setiap kali ada nilai yang hilang di tabel

> Membandingkan NULL dengan apa pun menghasilkan UNKNOWN, dan WHERE hanya menyimpan baris yang kondisinya benar. Tambahkan `OR city IS NULL` untuk menyertakan kota yang tidak diketahui.

### Apa beda `COUNT(*)` dan `COUNT(city)`?
- [ ] Tidak ada; keduanya menghitung baris dalam kelompok, dan NULL hanya berpengaruh pada SUM dan AVG
- [ ] `COUNT(city)` menghitung kota yang berbeda sedangkan `COUNT(*)` menghitung setiap kota, termasuk yang berulang
- [x] `COUNT(*)` menghitung semua baris, sedangkan `COUNT(city)` hanya menghitung baris yang kotanya bukan NULL
- [ ] `COUNT(*)` lebih cepat, tetapi mengabaikan baris yang sudah dibuang oleh klausa WHERE

> COUNT(*) menghitung setiap baris; COUNT(kolom) melewati NULL; COUNT(DISTINCT kolom) menghitung nilai non-NULL yang berbeda.

### Query mana yang benar untuk mencari pelanggan yang belum pernah membuat pesanan?
- [ ] `SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL`
- [x] `SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL`
- [ ] `SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id = NULL`
- [ ] `SELECT c.name FROM customers c RIGHT JOIN orders o ON o.customer_id = c.customer_id WHERE c.customer_id IS NULL`

> LEFT JOIN menyimpan pelanggan tanpa pasangan, mengisi kolom pesanan dengan NULL; menguji `IS NULL` lalu memisahkan mereka. INNER JOIN membuangnya, dan `= NULL` tidak pernah benar.

### Seorang analis menggabungkan `orders` (satu baris per pesanan) dengan `order_items` (satu baris per baris produk) lalu menjalankan `SUM(shipping_fee_idr)`. Mengapa totalnya terlalu tinggi?
- [ ] SUM menambahkan nilai NULL seolah nol, yang membuat total tiap kelompok terlalu besar
- [ ] Join membuang pesanan yang tidak punya item, yang mengubah cara baris sisanya dikelompokkan
- [x] Setelah join, biaya tiap pesanan terulang sekali untuk tiap baris produk dalam pesanan itu
- [ ] Database menyimpan cache hasil sebelumnya lalu menambahkannya sekali lagi ke hasil yang baru

> Menggabungkan dengan tabel berbutir lebih halus mengulang baris yang lebih kasar. Nilai per pesanan harus dijumlahkan pada grain per pesanan, atau tabel yang lebih halus harus diagregasi lebih dulu.

### Apa beda WHERE dan HAVING?
- [ ] WHERE hanya bekerja pada kolom teks, sedangkan HAVING hanya pada kolom angka
- [ ] HAVING adalah sintaks lama, dan WHERE adalah penggantinya yang lebih baru dan kini dipakai kebanyakan tim
- [x] WHERE memfilter baris sebelum pengelompokan, sedangkan HAVING memfilter kelompok setelah agregasi
- [ ] WHERE hanya menerima satu kondisi sekali waktu, dan HAVING diperlukan untuk menggabungkan beberapa

> Urutan logisnya FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY. Agregat seperti COUNT(*) baru ada setelah pengelompokan, jadi kondisi atasnya ditaruh di HAVING.

### `SELECT 7 / 2` mengembalikan `3` di SQLite dan banyak database lain. Mengapa, dan bagaimana mendapat 3,5?
- [ ] Database sengaja membulatkan ke bawah, jadi pakai `ROUND(7 / 2, 1)` untuk mendapat bagian desimal
- [ ] Hasilnya benar, karena 7 dibagi 2 tidak punya nilai pasti di dalam database
- [x] Kedua operan integer, jadi berlaku pembagian bilangan bulat; pakai `7.0 / 2` untuk pecahan
- [ ] Pembagian tidak didukung pada angka literal, jadi angkanya harus dibaca dari kolom tabel

> Dengan dua integer kebanyakan database melakukan pembagian bilangan bulat. Menjadikan satu sisi desimal (7.0) menghasilkan pecahan, begitulah persentase seperti `100.0 * bagian / total` ditulis.

### Apa yang dijamin transaksi ketika dua UPDATE dibungkus BEGIN dan COMMIT, lalu server crash di antara keduanya?
- [ ] Update pertama tersimpan dan yang kedua hilang, sehingga Anda harus memperbaiki datanya
- [x] Tidak ada update yang diterapkan, karena perubahan berhasil atau gagal bersama-sama
- [ ] Kedua update diterapkan setelah server restart, disertai pesan peringatan
- [ ] Tidak ada jaminan kecuali ada index pada kolom yang diperbarui

> Atomicity: transaksi itu semua atau tidak sama sekali. Perubahan yang belum di-commit dibuang setelah crash, sehingga update parsial (seperti uang keluar dari satu rekening tetapi tidak tiba di rekening lain) tidak bisa bertahan.

### Anda menjalankan `UPDATE customers SET tier = 'Gold'` dan lupa klausa WHERE. Apa yang terjadi?
- [ ] Database menolak pernyataan itu, karena sebuah UPDATE harus selalu memuat kondisi
- [ ] Hanya baris pertama tabel yang diperbarui, karena tidak ada kondisi lain yang diberikan
- [ ] Hanya baris yang tier-nya saat ini NULL yang diperbarui, karena merekalah yang paling butuh nilai
- [x] Semua baris diperbarui, kecuali Anda menjalankannya dalam transaksi yang bisa di-rollback

> UPDATE dan DELETE tanpa WHERE mengenai semua baris. Pratinjau dengan SELECT yang memakai WHERE yang sama, periksa jumlahnya, dan pakai transaksi bila bisa.

## @resources
- [Referensi bahasa SQL SQLite](https://www.sqlite.org/lang.html)
- [Tutorial PostgreSQL: dasar-dasar SQL](https://www.postgresql.org/docs/current/tutorial-sql.html)
- [Dokumentasi modul sqlite3 Python](https://docs.python.org/3/library/sqlite3.html)
