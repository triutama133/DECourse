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
- Mengubah nilai dengan fungsi teks, angka, dan tanggal, serta menghindari jebakan pembagian bilangan bulat dan rentang tanggal
- Mendefinisikan tabel dengan tipe dan constraint, mengubahnya dengan ALTER, dan menjelaskan beda view, tabel snapshot, dan materialized view

## @prereq
Modul 0.1 dan 0.2 membantu. Anda bisa mengerjakan seluruh lab di browser (SQL Sandbox) atau dengan modul `sqlite3` bawaan Python; tidak perlu instalasi.

## @part Membaca tabel

## @lesson Tabel, baris, kolom, dan kunci
**Database relasional** menyimpan data dalam **tabel**. Tabel seperti spreadsheet dengan aturan ketat: setiap kolom punya **nama dan tipe** (integer, teks, tanggal, desimal), dan setiap baris punya kolom yang sama. Di modul ini Anda bekerja dengan **KopiKu**, toko kopi online versi mini (10 pelanggan, 6 produk, 18 pesanan pada Januari 2026). Setiap latihan SQL punya baris **Lihat tabel-tabelnya**: buka kapan saja untuk melihat baris sungguhannya.

### Empat tabel, satu gagasan masing-masing

- `customers(customer_id, name, city, tier, signup_date)`: satu baris per pelanggan
- `products(product_id, name, origin, roast, price_idr)`: satu baris per produk kopi
- `orders(order_id, customer_id, order_date, status, payment_method, shipping_fee_idr)`: satu baris per pesanan
- `order_items(order_id, line_no, product_id, qty, unit_price_idr)`: satu baris per baris produk dalam sebuah pesanan

Mengapa empat tabel dan bukan satu lembar besar? Karena setiap *fakta* disimpan sekali. Kota seorang pelanggan ada di `customers`; kalau Budi pindah, Anda mengubah satu baris, bukan 400 baris pesanan. Gagasan ini, disebut **normalisasi**, menghindari kontradiksi.

### Query pertama Anda

`SELECT` memilih apa yang ditampilkan, `FROM` menyebut tabelnya. `*` berarti "semua kolom":

```sql
SELECT * FROM customers;
```

:::drill sql Lihat sebuah tabel
Tampilkan semua kolom dan semua baris tabel `products`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/from\s+products/ ## Ambil barisnya FROM tabel products.
@hint
`SELECT * FROM products;` Tanda bintang `*` berarti semua kolom.
@solution
SELECT * FROM products;
:::

Untuk menampilkan sebagian kolom saja, sebutkan setelah `SELECT`, dipisahkan koma:

:::drill sql Pilih kolomnya
Tampilkan hanya `name` dan `price_idr` dari setiap produk.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/name/ ## Pilih kolom name.
/price_idr/ ## Pilih kolom price_idr.
@hint
`SELECT name, price_idr FROM products;`
@solution
SELECT name, price_idr FROM products;
:::

### Grain: satu baris mewakili apa?

Tanyakan pada setiap tabel, sebelum Anda mengquery-nya: **satu baris mewakili apa?** Itulah **grain** tabel tersebut. `orders` punya satu baris per pesanan, `order_items` satu baris per *baris produk* dalam pesanan. Hampir setiap angka salah dalam analitik datang dari melupakan grain, seperti yang akan Anda lihat di materi join. `COUNT(*)` menghitung baris, jadi cepat memberi tahu seberapa besar sebuah tabel:

```sql
SELECT COUNT(*) FROM customers;    -- 10
```

:::drill sql Berapa banyak baris?
Hitung baris `order_items`. Beri kolomnya nama `lines`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/count\s*\(/ ## Pakai COUNT(*) untuk menghitung baris.
@hint
`SELECT COUNT(*) AS lines FROM order_items;` `AS` memberi nama pada kolom hasil.
@solution
SELECT COUNT(*) AS lines FROM order_items;
:::

:::ask SATU baris order_items mewakili apa?
@options
satu pesanan
satu produk di katalog
* satu baris produk di dalam pesanan
@why
`order_items` punya satu baris per **baris produk** dalam sebuah pesanan: pesanan dengan tiga produk berbeda punya tiga baris. Karena itu barisnya lebih banyak (24) daripada `orders` (18).
:::

### Key: cara tabel-tabel saling menemukan

Dua jenis key membuat tabel-tabel bekerja bersama:

- **Primary key (PK)** mengidentifikasi sebuah baris secara unik: `customers.customer_id`. Tidak ada dua baris yang berbagi nilainya dan ia tidak pernah kosong. `order_items` memakai key *komposit*: `(order_id, line_no)` bersama-sama.
- **Foreign key (FK)** adalah kolom yang menunjuk ke primary key tabel lain: `orders.customer_id` merujuk ke `customers.customer_id`. Database bisa memaksa bahwa Anda tidak bisa membuat pesanan untuk pelanggan yang tidak ada.

:::ask Kolom mana yang cukup untuk mengidentifikasi SATU baris order_items?
@options
* `order_id` dan `line_no` bersama-sama
`order_id` saja
`line_no` saja
@why
Sebuah pesanan bisa punya beberapa baris (jadi `order_id` berulang), dan nomor baris 1 ada di setiap pesanan (jadi `line_no` berulang). Hanya **pasangan** `(order_id, line_no)` yang unik: primary key komposit.
:::

:::ask Apa yang terjadi jika Anda INSERT pelanggan dengan customer_id yang sudah ada?
@options
baris lama diganti diam-diam
dua pelanggan berbagi id
* database menolak: `UNIQUE constraint failed: customers.customer_id`
@why
Primary key harus unik, dan database menegakkannya. Itulah gunanya key: data buruk ditolak di pintu, bukan ditemukan belakangan di laporan.
:::

Catatan tentang spreadsheet. Excel sangat bagus untuk pekerjaan kecil dan sekali pakai. Ia kurang cocok ketika data besar (Excel berhenti di 1.048.576 baris per lembar), dipakai banyak orang sekaligus, harus tetap konsisten (siapa pun bisa mengetik teks di kolom angka), atau harus diulang otomatis setiap malam. Database memberi Anda tipe, constraint, akses bersamaan, riwayat, dan kecepatan, dan itulah sebabnya pipeline memuat data ke dalamnya.

> 🛠 **Coba sendiri (8 menit, SQL Sandbox dengan dataset KopiKu).**
> 1. Jalankan `SELECT * FROM customers LIMIT 3;` dan `SELECT * FROM order_items LIMIT 3;`. Untuk setiap tabel, sebutkan dalam satu kalimat apa yang diwakili satu baris (grain-nya) dan sebutkan primary key-nya.
> 2. Jalankan `SELECT COUNT(*), COUNT(DISTINCT order_id) FROM orders;` dan query yang sama pada `order_items`.
> 3. Coba rusak sebuah key: `INSERT INTO customers (customer_id, name) VALUES (1, 'Dup');`
>
> **Seharusnya Anda melihat:** `18 18` untuk `orders` (satu baris per pesanan) tetapi `24 18` untuk `order_items` (beberapa baris per pesanan, itulah sebabnya key-nya terdiri dari dua kolom), dan error `UNIQUE constraint failed: customers.customer_id` di langkah 3.

## @lesson Membaca data: SELECT, WHERE, ORDER BY
Query dasar punya bentuk yang tetap. Bacalah dalam urutan *berpikir* database, bukan urutan Anda menulisnya: ia mengambil baris **FROM** sebuah tabel, menyimpan yang **WHERE** kondisinya benar, memilih kolom di **SELECT**, dan terakhir mengurutkan dengan **ORDER BY**. Lihat query yang sama satu langkah demi satu langkah:

:::sqlsteps Urutan berpikir database
@data kopiku
@stage 1. FROM: ambil setiap baris tabel
SELECT name, city, tier FROM customers
@say
`FROM customers` memberi database semua 10 baris untuk dikerjakan.
@stage 2. WHERE: simpan hanya baris yang kondisinya benar
SELECT name, city, tier FROM customers WHERE tier = 'Gold'
@say
Baris yang `tier`-nya bukan `'Gold'` dicoret: baris itu dibuang. Tersisa dua baris.
@stage 3. SELECT: pilih kolom yang ditampilkan
SELECT name, city FROM customers WHERE tier = 'Gold'
@say
Baru sekarang kolom dipilih, jadi `tier` tidak ditampilkan lagi.
@stage 4. ORDER BY: urutkan yang tersisa
SELECT name, city FROM customers WHERE tier = 'Gold' ORDER BY name
@say
Hasilnya diurutkan menurut `name`. Query lengkapnya `SELECT name, city FROM customers WHERE tier = 'Gold' ORDER BY name;`.
:::

### Menyaring baris dengan WHERE

`WHERE` menyimpan hanya baris yang kondisinya benar. Nilai teks memakai **tanda kutip tunggal** (`'Gold'`); tanda kutip ganda berarti nama kolom atau tabel dalam SQL standar.

:::drill sql Saring dan urutkan
Tampilkan `name` dan `city` pelanggan yang tier-nya `'Silver'`, diurutkan menurut `name`.
@data kopiku
@ordered
@starter
-- tulis query Anda di bawah baris ini

@check
/where/ ## Pakai WHERE untuk menyimpan hanya pelanggan Silver.
/order\s+by/ ## Pakai ORDER BY name untuk mengurutkannya.
@hint
`SELECT name, city FROM customers WHERE tier = 'Silver' ORDER BY name;`
@solution
SELECT name, city FROM customers WHERE tier = 'Silver' ORDER BY name;
:::

Kondisi yang akan sering Anda pakai di `WHERE`:

| Kebutuhan | Sintaks | Contoh |
|---|---|---|
| Perbandingan | `=`, `<>` (tidak sama), `<`, `<=`, `>`, `>=` | `qty >= 2` |
| Menggabungkan kondisi | `AND`, `OR`, `NOT` (pakai kurung) | `tier = 'Gold' AND city = 'Jakarta'` |
| Salah satu dari beberapa nilai | `IN (...)` | `city IN ('Jakarta', 'Bandung')` |
| Rentang, termasuk ujungnya | `BETWEEN a AND b` | `order_date BETWEEN '2026-01-10' AND '2026-01-20'` |
| Pola teks | `LIKE` dengan `%` (teks apa saja) dan `_` (satu karakter) | `name LIKE '%a'` |
| Nilai yang hilang | `IS NULL`, `IS NOT NULL` | `city IS NULL` |

:::drill sql Bandingkan angka
Tampilkan `order_id` dan `shipping_fee_idr` pesanan yang ongkos kirimnya **minimal** 20000.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/>=/ ## "Minimal" berarti lebih besar atau sama dengan: pakai >=.
@hint
`WHERE shipping_fee_idr >= 20000`
@solution
SELECT order_id, shipping_fee_idr FROM orders WHERE shipping_fee_idr >= 20000;
:::

:::drill sql AND
Tampilkan `order_id` pesanan yang `'delivered'` **dan** dibayar dengan `'card'`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/\band\b/ ## Gabungkan kedua kondisi dengan AND.
@hint
`WHERE status = 'delivered' AND payment_method = 'card'`
@solution
SELECT order_id FROM orders WHERE status = 'delivered' AND payment_method = 'card';
:::

:::drill sql Salah satu dari beberapa
Tampilkan `name` pelanggan yang tinggal di `'Jakarta'` atau `'Bandung'`. Pakai `IN`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/\bin\s*\(/ ## Pakai IN ('...', '...').
@hint
`WHERE city IN ('Jakarta', 'Bandung')`
@solution
SELECT name FROM customers WHERE city IN ('Jakarta', 'Bandung');
:::

:::drill sql Rentang tanggal
Tampilkan `order_id` dan `order_date` pesanan yang dibuat dari `'2026-01-10'` sampai `'2026-01-20'`, kedua harinya termasuk. Pakai `BETWEEN`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/between/ ## Pakai BETWEEN ... AND ...
@hint
`WHERE order_date BETWEEN '2026-01-10' AND '2026-01-20'`
@solution
SELECT order_id, order_date FROM orders WHERE order_date BETWEEN '2026-01-10' AND '2026-01-20';
:::

:::drill sql Pola teks
Tampilkan `name` pelanggan yang namanya diawali huruf `A`. Pakai `LIKE` dengan `%`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/like/ ## Pakai LIKE dengan pola %.
@hint
`WHERE name LIKE 'A%'`: `%` berarti "teks apa saja setelah A".
@solution
SELECT name FROM customers WHERE name LIKE 'A%';
:::

Hal penting lain: `SELECT DISTINCT payment_method` menghapus nilai yang berulang; `LIMIT 10` hanya mengembalikan baris-baris pertama (bagus saat menjelajahi tabel besar); `AS` mengganti nama kolom (`SUM(qty) AS units`); `DESC` setelah `ORDER BY` mengurutkan dari yang terbesar.

:::drill sql Tiga teratas
Tampilkan `name` dan `price_idr` **tiga produk termahal**, yang termahal lebih dulu.
@data kopiku
@ordered
@starter
-- tulis query Anda di bawah baris ini

@check
/order\s+by/ ## Urutkan dengan ORDER BY price_idr DESC.
/limit/ ## Simpan hanya tiga baris dengan LIMIT 3.
@hint
`ORDER BY price_idr DESC LIMIT 3`
@solution
SELECT name, price_idr FROM products ORDER BY price_idr DESC LIMIT 3;
:::

:::drill sql Setiap nilai satu kali
Tampilkan metode pembayaran yang berbeda di `orders`, masing-masing hanya sekali. Pakai `DISTINCT`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/distinct/ ## Pakai SELECT DISTINCT.
@hint
`SELECT DISTINCT payment_method FROM orders;`
@solution
SELECT DISTINCT payment_method FROM orders;
:::

> **Saran:** Kebiasaan yang mencegah sebagian besar kesalahan: sebelum menulis query yang rumit, jalankan `SELECT * FROM nama_tabel LIMIT 10` dan lihat baris sungguhannya. Lalu tambahkan satu klausa pada satu waktu dan jalankan ulang. Ketika hasil tampak salah, hapus klausa satu per satu sampai terlihat benar.

**Tanggal.** Database punya tipe tanggal, tetapi banyak data nyata menyimpan tanggal sebagai teks seperti `'2026-01-15'`. Format ISO (tahun-bulan-hari) istimewa karena urutan teks sama dengan urutan tanggal, itulah sebabnya `BETWEEN` bekerja padanya. Tanggal yang ditulis `15/01/2026` tidak terurut dan tidak terbanding dengan benar: normalkan sejak awal.

> 💡 **Jeda Praktik 1 (SELECT & WHERE):**
> Buka file `labs/mod-0-3/answers.sql` di editor Anda (atau buka SQL Sandbox di aplikasi web).
> Kerjakan tantangan `-- k-1`: tulis query untuk mengembalikan kolom `name` dan `tier` dari tabel `customers` yang berdomisili di Jakarta (`WHERE city = 'Jakarta'`).
> Uji query Anda di terminal:
> `python3 labs/mod-0-3/check.py`
> Jika k-1 mencetak PASS, selamat! Anda telah menulis query pertama Anda. Lanjut ke Pelajaran 3 untuk mengenal jebakan NULL.

## @lesson NULL: nilai yang bukan nilai
`NULL` berarti **tidak diketahui atau hilang**. Ia bukan nol dan bukan string kosong, dan perilakunya berbeda dari segala hal lain. Ini sumber terbesar kesalahan diam-diam bagi pemula, jadi luangkan waktu di sini. Dua dari sepuluh pelanggan KopiKu tidak punya kota.

### Membandingkan dengan NULL memberi "tidak diketahui"

Aturannya: setiap perbandingan dengan NULL tidak memberi benar maupun salah, melainkan **UNKNOWN**, dan `WHERE` hanya menyimpan baris yang kondisinya *benar*. Lihat apa yang terjadi pada dua pelanggan tanpa kota:

:::sqlsteps Ke mana baris NULL pergi?
@data kopiku
@stage 1. Setiap pelanggan, dengan kotanya (dua kota bernilai NULL)
SELECT name, city FROM customers
@say
Rina dan Rizky tidak punya kota: tabel menampilkan `NULL`.
@stage 2. WHERE city = 'Jakarta': 3 baris
SELECT name, city FROM customers WHERE city = 'Jakarta'
@say
Tiga pelanggan tinggal di Jakarta.
@stage 3. WHERE city <> 'Jakarta': 5 baris, bukan 7!
SELECT name, city FROM customers WHERE city <> 'Jakarta'
@say
Tiga di Jakarta, lima di tempat lain, dan dua punya kota yang tidak diketahui. Query ini diam-diam melewatkan kedua baris itu: `NULL <> 'Jakarta'` adalah UNKNOWN, bukan benar.
@stage 4. Katakan yang Anda maksud: OR city IS NULL memberi 7
SELECT name, city FROM customers WHERE city <> 'Jakarta' OR city IS NULL
@say
Sekarang kedua baris NULL ikut. Untuk menyertakannya Anda harus memintanya.
:::

:::ask Berapa pelanggan yang dikembalikan query ini?
```sql
SELECT COUNT(*) FROM customers WHERE city <> 'Jakarta';
```
@options
* 5
7
3
@why
Tiga pelanggan tinggal di Jakarta, lima tinggal di tempat lain, dan dua tidak punya kota. `NULL <> 'Jakarta'` adalah UNKNOWN, jadi kedua yang tidak diketahui ikut terbuang: 5, bukan 7.
:::

Anda tidak pernah bisa menguji NULL dengan `=`: `city = NULL` tidak pernah benar. Pakai `IS NULL` dan `IS NOT NULL`.

:::drill sql Temukan yang hilang
Tampilkan `name` pelanggan yang `city`-nya tidak diketahui.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/is\s+null/ ## Pakai IS NULL. (city = NULL tidak pernah benar.)
@hint
`WHERE city IS NULL`
@solution
SELECT name FROM customers WHERE city IS NULL;
:::

:::drill sql Semua yang bukan di Medan
Tampilkan `name` setiap pelanggan yang kotanya **bukan** `'Medan'`, **termasuk** yang kotanya tidak diketahui.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/is\s+null/ ## Pelanggan dengan kota tidak diketahui harus ikut: tambahkan OR city IS NULL.
@hint
`WHERE city <> 'Medan' OR city IS NULL`
@solution
SELECT name FROM customers WHERE city <> 'Medan' OR city IS NULL;
:::

### Agregat melewati NULL

`COUNT(*)` menghitung baris, `COUNT(city)` menghitung baris yang `city`-nya **bukan** NULL, dan `AVG(x)` hanya merata-ratakan baris yang `x`-nya bukan NULL. Kalau NULL benar-benar berarti nol bagi bisnis Anda ("tanpa diskon"), ubah dulu.

:::drill sql Baris versus nilai
Dalam satu query, tampilkan `COUNT(*)` sebagai `customers` dan `COUNT(city)` sebagai `with_city`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/count\s*\(\s*city\s*\)/ ## Pakai COUNT(city) untuk kota yang bukan NULL.
@hint
`SELECT COUNT(*) AS customers, COUNT(city) AS with_city FROM customers;` Anda harus melihat 10 dan 8.
@solution
SELECT COUNT(*) AS customers, COUNT(city) AS with_city FROM customers;
:::

### COALESCE: beri nama pada yang hilang

`COALESCE(a, b, ...)` mengembalikan argumen pertama yang bukan NULL. `COALESCE(city, 'Unknown')` membuat kota yang hilang tampil sebagai `Unknown`, sehingga menjadi kelompok yang terlihat alih-alih menghilang.

:::drill sql Isi yang kosong
Tampilkan `name` dan `city` setiap pelanggan, tetapi tampilkan `'Unknown'` sebagai pengganti NULL. Beri kolom kedua nama `city`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/coalesce/ ## Pakai COALESCE(city, 'Unknown').
@hint
`SELECT name, COALESCE(city, 'Unknown') AS city FROM customers;`
@solution
SELECT name, COALESCE(city, 'Unknown') AS city FROM customers;
:::

### Tempat lain NULL menggigit

- **Aritmetika menyebarkan NULL.** `price - discount` adalah NULL kalau `discount` NULL, sehingga total seluruh baris menghilang.
- **`NOT IN` dengan NULL di dalam daftar tidak mengembalikan apa pun.** `x NOT IN (1, NULL)` tidak pernah benar, karena perbandingan dengan NULL adalah UNKNOWN untuk setiap baris. Ini bug produksi klasik ketika daftarnya datang dari subquery yang kebetulan berisi NULL.

:::ask Apa yang dikembalikan query ini?
```sql
SELECT name FROM customers
WHERE city NOT IN (SELECT city FROM customers WHERE tier = 'Silver');
```
@options
pelanggan yang kotanya bukan kota pelanggan Silver
* tidak ada baris sama sekali
3 baris
@why
Satu pelanggan Silver tidak punya kota, jadi daftar di `NOT IN` berisi NULL, dan `city NOT IN (..., NULL)` tidak pernah benar. Query ini mengembalikan **tidak ada**. Cara yang lebih aman untuk mengatakan "tidak ada di": `NOT EXISTS`, `EXCEPT`, atau anti-join LEFT JOIN di materi join.
:::

> **Peringatan:** Ketika hitungan atau jumlah tampak "agak rendah", curigai NULL sebelum mencurigai datanya. Tambahkan `OR col IS NULL`, atau `COALESCE`, dan lihat apakah angkanya bergerak.

> 💡 **Jeda Praktik 2 (Jebakan Tiga Nilai Logika NULL):**
> Buka `labs/mod-0-3/answers.sql`, temukan penanda `-- k-4`.
> Tulis query untuk mengambil nama semua pelanggan yang kotanya BUKAN Jakarta (`city <> 'Jakarta'`), tetapi INGAT menyertakan pelanggan yang kotanya tidak diketahui: tambahkan `OR city IS NULL`.
> Uji di terminal:
> `python3 labs/mod-0-3/check.py`
> Pastikan k-4 mencetak PASS (menghasilkan 7 pelanggan, bukan 5!). Lanjut ke Pelajaran 4 di bawah.

## @part Menghitung

## @lesson Fungsi teks, angka, dan tanggal
Kolom nyata itu berantakan: nama dengan huruf campur, rasio yang harus dihitung, tanggal yang disimpan sebagai teks. **Fungsi** mengubah sebuah nilai di dalam query, **satu hasil per baris** (agregat seperti `SUM` menggabungkan baris; fungsi tidak). Contohnya berjalan pada dataset KopiKu.

### Fungsi teks

`LENGTH(x)`, `UPPER(x)`, `LOWER(x)`, `TRIM(x)`, `REPLACE(x, 'a', 'b')`, `SUBSTR(x, awal, panjang)` (posisi dimulai dari **1**, bukan 0), `INSTR(x, 'teks')` (posisi kecocokan pertama, 0 jika tidak ada), dan `||` untuk menyambung teks.

```sql
SELECT name, UPPER(name) AS shout, LENGTH(name) AS name_length FROM customers;
-- Budi Santoso | BUDI SANTOSO | 12
```

:::drill sql Huruf besar dan panjang
Tampilkan `name` setiap pelanggan, nama dalam huruf kapital sebagai `name_upper`, dan panjangnya sebagai `name_length`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/upper/ ## Pakai UPPER(name).
/length/ ## Pakai LENGTH(name).
@hint
`SELECT name, UPPER(name) AS name_upper, LENGTH(name) AS name_length FROM customers;`
@solution
SELECT name, UPPER(name) AS name_upper, LENGTH(name) AS name_length FROM customers;
:::

Untuk memotong sebagian, gabungkan `SUBSTR` dan `INSTR`. Nama depan adalah semua yang ada sebelum spasi pertama:

```sql
SELECT name, SUBSTR(name, 1, INSTR(name, ' ') - 1) AS first_name FROM customers;
-- Budi Santoso | Budi
```

:::drill sql Nama depan
Tampilkan `name` setiap pelanggan dan nama depannya (semua sebelum spasi pertama) sebagai `first_name`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/substr/ ## Pakai SUBSTR(name, 1, ...).
/instr/ ## Pakai INSTR(name, ' ') untuk menemukan spasinya.
@hint
`SUBSTR(name, 1, INSTR(name, ' ') - 1)`: mulai di posisi 1 dan ambil karakter sebanyak yang ada sebelum spasi.
@solution
SELECT name, SUBSTR(name, 1, INSTR(name, ' ') - 1) AS first_name FROM customers;
:::

Sambung teks dengan `||`. Satu jebakan: `'a' || NULL` adalah **NULL**, jadi satu bagian yang hilang mengosongkan seluruh teks sambungan.

:::ask Apa hasil ini untuk pelanggan yang kotanya NULL?
```sql
SELECT name || ' from ' || city FROM customers;
```
@options
* NULL
`Rina Pratama from `
`Rina Pratama from NULL`
@why
Menyambung dengan `||` dan sebuah NULL menghasilkan NULL: seluruh teks lenyap. Pakai `COALESCE(city, 'somewhere')` lebih dulu.
:::

:::drill sql Sebuah label
Tampilkan satu kolom `label` yang berbentuk `Budi Santoso (Gold)`: nama, spasi, dan tier di dalam kurung.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/\|\|/ ## Sambung bagian-bagiannya dengan ||.
@hint
`name || ' (' || tier || ')' AS label`
@solution
SELECT name || ' (' || tier || ')' AS label FROM customers;
:::

### Fungsi angka dan jebakan pembagian bilangan bulat

`ROUND(x, 1)` membulatkan, `CAST(x AS INTEGER)` mengubah tipe, `COALESCE(a, b)` mengambil yang pertama bukan NULL, dan `NULLIF(a, b)` menghasilkan NULL ketika keduanya sama (sehingga `x / NULLIF(y, 0)` menghasilkan NULL alih-alih gagal karena pembagian nol).

Jebakan yang harus diingat adalah **pembagian bilangan bulat**: di SQLite dan PostgreSQL, `7 / 2` adalah **3**. Jadikan satu sisi desimal sebelum membagi: `7.0 / 2` adalah 3,5.

:::ask Apa hasil ini?
```sql
SELECT 7 / 2;
```
@options
3.5
* 3
4
@why
Kedua angka adalah bilangan bulat, jadi SQLite membagi sebagai bilangan bulat dan membuang desimalnya: 3. Tulis `7.0 / 2` untuk mendapat 3,5. Beginilah persentase diam-diam menjadi 0.
:::

:::drill sql Harga dalam ribuan
Tampilkan `name` setiap produk dan harganya dalam ribuan rupiah, satu desimal, sebagai `price_k` (untuk 85000 menjadi 85.0). Waspadai pembagian bilangan bulat!
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/round/ ## Pakai ROUND(..., 1).
/1000\.0/ ## Bagi dengan 1000.0 (dengan .0), atau desimalnya hilang.
@hint
`ROUND(price_idr / 1000.0, 1) AS price_k`
@solution
SELECT name, ROUND(price_idr / 1000.0, 1) AS price_k FROM products;
:::

KopiKu punya 2 pesanan batal dari 18. Di SQLite perbandingan benar seperti `status = 'cancelled'` bernilai `1` dan yang salah `0`, jadi `SUM(status = 'cancelled')` menghitung baris yang dibatalkan (Materi 8 menunjukkan `CASE WHEN` yang portabel). `SUM(status = 'cancelled') / COUNT(*)` menghasilkan **0** (pembagian bilangan bulat!); `ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1)` menghasilkan **11.1**.

:::drill sql Sebuah persentase
Berapa persen dari semua pesanan yang `'cancelled'`? Tampilkan satu angka, dibulatkan satu desimal, sebagai `pct`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/100\.0/ ## Pakai 100.0 (dengan .0) agar pembagian mempertahankan desimalnya.
@hint
`SELECT ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1) AS pct FROM orders;` Anda harus melihat 11.1.
@solution
SELECT ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1) AS pct FROM orders;
:::

### Tanggal

SQLite tidak punya tipe tanggal sungguhan: tanggal adalah teks dalam format ISO `YYYY-MM-DD`, yang terurut dengan benar sebagai teks (`'2026-01-03' < '2026-01-10'`). Format seperti `10/1/2026` tidak: sebagai teks, `'10/1/2026' < '3/1/2026'` benar. Simpan tanggal dalam bentuk ISO, selalu. Fungsi SQLite-nya adalah `date(x, '+7 days')`, `strftime(format, x)`, dan `julianday(x)`:

```sql
SELECT date(order_date, '+7 days') FROM orders;     -- 2026-01-03 menjadi 2026-01-10
SELECT strftime('%w', order_date) FROM orders;      -- hari: 0 = Minggu ... 6 = Sabtu
```

:::drill sql Seminggu kemudian
Tampilkan `order_id` setiap pesanan, `order_date`-nya, dan tanggal tujuh hari kemudian sebagai `due_date`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/date\s*\(/ ## Pakai date(order_date, '+7 days').
@hint
`date(order_date, '+7 days') AS due_date`
@solution
SELECT order_id, order_date, date(order_date, '+7 days') AS due_date FROM orders;
:::

**Pakai rentang setengah terbuka**: `order_date >= '2026-01-10' AND order_date < '2026-01-20'` (4 pesanan KopiKu). `BETWEEN '2026-01-10' AND '2026-01-19'` tampak sama pada tanggal biasa tetapi diam-diam membuang apa pun setelah tengah malam tanggal 19 ketika kolom berisi timestamp: kami memasukkan `'2026-01-19 15:30:00'` dan `BETWEEN` melewatkannya sementara rentang setengah terbuka menemukannya.

:::drill sql Rentang setengah terbuka
Hitung pesanan yang dibuat pada atau setelah `'2026-01-10'` dan **sebelum** `'2026-01-20'`. Tampilkan satu angka sebagai `orders`. Pakai `>=` dan `<`, bukan `BETWEEN`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/>=/ ## Mulai dengan order_date >= '2026-01-10'.
/<\s*'2026-01-20'/ ## Akhiri dengan order_date < '2026-01-20' (rentang setengah terbuka).
@hint
`WHERE order_date >= '2026-01-10' AND order_date < '2026-01-20'`
@solution
SELECT COUNT(*) AS orders FROM orders WHERE order_date >= '2026-01-10' AND order_date < '2026-01-20';
:::

:::advanced Nanti saja: jebakan dialek dan performa
Dua jebakan, keduanya diperiksa pada SQLite, PostgreSQL, dan DuckDB. Pertama, `'a' || NULL` adalah **NULL** di ketiganya; `COALESCE(part, '')` lebih dulu, atau pakai `concat()`, yang melewati NULL (PostgreSQL dan DuckDB; SQLite 3.39 di sandbox tidak punya `concat()`). Kedua, `'abc' LIKE 'ABC'` benar di SQLite dan **salah** di PostgreSQL dan DuckDB, yang punya `ILIKE` untuk pencocokan tak peka huruf. DuckDB memberi 3,5 untuk `7 / 2`, alasan lain untuk menguji pada mesin yang akan Anda pakai. Modul 1.3 punya tabel dialek lengkap.

**Bulan tidak semuanya sama**: `date('2026-01-31', '+1 month')` adalah **2026-03-03** di SQLite (ia menghitung 31 Februari dan meluap), sedangkan `DATE '2026-01-31' + INTERVAL '1 month'` di PostgreSQL adalah 2026-02-28. Simpan timestamp dalam UTC dan ubah ke zona waktu lokal hanya saat menampilkannya.

**Satu aturan performa** yang dijelaskan Modul 1.3 dengan EXPLAIN: jangan membungkus kolom ber-indeks dengan fungsi di dalam `WHERE`. Pada tabel dengan indeks di `ts`, `WHERE strftime('%Y-%m', ts) = '2026-01'` membuat SQLite **memindai seluruh tabel**, dan rentang yang setara `ts >= '2026-01-01' AND ts < '2026-02-01'` **mencari lewat indeks**.
:::

> 🛠 **Coba sendiri (10 menit, SQL Sandbox).** Selesaikan tantangan KopiKu **k-16** (nama depan dan panjang nama), **k-17** (kota yang tidak diketahui), dan **k-18** (tingkat pembatalan) dengan fungsi-fungsi dari pelajaran ini. Catatan: SQLite menganggap perbandingan benar seperti `status = 'cancelled'` bernilai `1` dan salah bernilai `0`, jadi `SUM(status = 'cancelled')` menghitung baris yang dibatalkan (Pelajaran 8 menunjukkan `CASE WHEN` yang portabel). Sebelum menjalankan k-18, tebak jawabannya dengan tangan, lalu coba `SUM(status = 'cancelled') / COUNT(*)` tanpa `100.0` dan lihat apa yang dilakukan pembagian bilangan bulat.
>
> **Seharusnya Anda melihat:** sandbox menyatakan Benar untuk setiap tantangan; percobaan k-18 yang salah menampilkan `0`, yang benar `11.1`.

## @lesson Agregasi: GROUP BY dan HAVING
Agregasi menggabungkan banyak baris menjadi **satu angka per kelompok**. Fungsinya `COUNT`, `SUM`, `AVG`, `MIN`, dan `MAX`. Tanpa `GROUP BY` ia bekerja pada seluruh tabel dan menghasilkan satu baris:

```sql
SELECT COUNT(*) AS orders, MIN(order_date) AS first_day FROM orders;
```

:::drill sql Beberapa angka sekaligus
Dalam satu query, tampilkan harga `lowest` (`MIN`), `highest` (`MAX`), dan `average` (`AVG`) dari produk, dari tabel `products`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/min\s*\(/ ## Pakai MIN(price_idr).
/max\s*\(/ ## Pakai MAX(price_idr).
/avg\s*\(/ ## Pakai AVG(price_idr).
@hint
`SELECT MIN(price_idr) AS lowest, MAX(price_idr) AS highest, AVG(price_idr) AS average FROM products;`
@solution
SELECT MIN(price_idr) AS lowest, MAX(price_idr) AS highest, AVG(price_idr) AS average FROM products;
:::

### GROUP BY: satu jawaban per kelompok

`GROUP BY` membentuk satu kelompok untuk setiap nilai berbeda dari sebuah kolom, dan agregatnya berjalan sekali per kelompok. Lihat baris-baris dikumpulkan menjadi kelompok:

:::sqlsteps Dari baris ke kelompok
@data kopiku
@stage 1. Baris yang kita mulai: 18 pesanan
SELECT order_id, payment_method FROM orders
@say
Setiap baris adalah satu pesanan, dengan cara pembayarannya.
@stage 2. GROUP BY menaruh baris dengan metode pembayaran sama bersama-sama
SELECT order_id, payment_method FROM orders ORDER BY payment_method
@say
Bayangkan baris-barisnya disusun menjadi tumpukan, satu tumpukan per metode pembayaran.
@stage 3. Satu baris hasil per tumpukan
SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method
@say
`COUNT(*)` berjalan sekali untuk setiap tumpukan. Empat kelompok, empat baris. Kelompok belum ada sebelum `GROUP BY`, itulah sebabnya tidak bisa dipakai di `WHERE`.
:::

Setiap kolom non-agregat di `SELECT` juga harus ada di `GROUP BY`; database perlu tahu setiap baris hasil milik kelompok yang mana.

:::drill sql Pesanan per metode pembayaran
Tampilkan setiap `payment_method` dan berapa pesanan yang memakainya, sebagai `orders`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/group\s+by/ ## Pakai GROUP BY payment_method.
@hint
`SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method;`
@solution
SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method;
:::

:::drill sql Unit terjual per produk
Tampilkan setiap `product_id` dan total kuantitas yang terjual, sebagai `units` (jumlah `qty` di `order_items`).
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/group\s+by/ ## Pakai GROUP BY product_id.
/sum\s*\(/ ## Pakai SUM(qty).
@hint
`SELECT product_id, SUM(qty) AS units FROM order_items GROUP BY product_id;`
@solution
SELECT product_id, SUM(qty) AS units FROM order_items GROUP BY product_id;
:::

### Tiga hitungan yang tampak mirip

- `COUNT(*)` menghitung baris.
- `COUNT(col)` menghitung baris yang `col`-nya bukan NULL.
- `COUNT(DISTINCT col)` menghitung nilai berbeda yang bukan NULL.

:::drill sql Tiga hitungan
Dalam satu query atas `customers`, tampilkan `COUNT(*)` sebagai `customers`, `COUNT(city)` sebagai `with_city`, dan `COUNT(DISTINCT city)` sebagai `cities`. Anda harus melihat 10, 8, dan 5.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/count\s*\(\s*distinct/ ## Pakai COUNT(DISTINCT city).
@hint
`SELECT COUNT(*) AS customers, COUNT(city) AS with_city, COUNT(DISTINCT city) AS cities FROM customers;`
@solution
SELECT COUNT(*) AS customers, COUNT(city) AS with_city, COUNT(DISTINCT city) AS cities FROM customers;
:::

### WHERE atau HAVING?

`WHERE` menyaring *baris sebelum* pengelompokan; `HAVING` menyaring *kelompok setelah* agregasi. Ikuti satu pertanyaan melalui semua langkahnya: pelanggan dengan setidaknya dua pesanan delivered.

:::sqlsteps WHERE dulu, HAVING sesudahnya
@data kopiku
@stage 1. Semua pesanan
SELECT customer_id, status FROM orders
@say
18 baris.
@stage 2. WHERE menyimpan hanya baris delivered (sebelum pengelompokan apa pun)
SELECT customer_id, status FROM orders WHERE status = 'delivered'
@say
6 baris yang bukan delivered dicoret: baris disaring lebih dulu.
@stage 3. GROUP BY membuat satu baris per pelanggan
SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'delivered' GROUP BY customer_id
@say
Sekarang setiap pelanggan punya hitungan pesanan delivered.
@stage 4. HAVING menyaring kelompok
SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'delivered' GROUP BY customer_id HAVING COUNT(*) >= 2
@say
Pelanggan yang kelompoknya punya kurang dari dua baris dibuang. Anda tidak bisa menulis `COUNT(*) >= 2` di `WHERE`, karena pada tahap itu kelompok belum ada.
:::

:::drill sql Metode pembayaran yang ramai
Tampilkan `payment_method` dan jumlah pesanan, sebagai `orders`, untuk metode pembayaran yang dipakai **lebih dari 3** pesanan. Pakai `HAVING`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/having/ ## Saring kelompok dengan HAVING.
@hint
`GROUP BY payment_method HAVING COUNT(*) > 3`
@solution
SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method HAVING COUNT(*) > 3;
:::

:::drill sql WHERE dan HAVING bersama
Hanya melihat pesanan `'delivered'`, tampilkan setiap `payment_method` yang punya **setidaknya 3** pesanan seperti itu, dengan jumlahnya sebagai `orders`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/where/ ## Saring baris delivered dengan WHERE lebih dulu.
/having/ ## Lalu saring kelompoknya dengan HAVING.
@hint
`WHERE status = 'delivered' GROUP BY payment_method HAVING COUNT(*) >= 3`
@solution
SELECT payment_method, COUNT(*) AS orders FROM orders WHERE status = 'delivered' GROUP BY payment_method HAVING COUNT(*) >= 3;
:::

:::ask Mana di antara ini yang berjalan PERTAMA?
@options
HAVING
SELECT
* WHERE
@why
Urutan logisnya: `FROM` dan `JOIN`, lalu `WHERE` (menyaring baris), `GROUP BY` (membentuk kelompok), `HAVING` (menyaring kelompok), `SELECT` (menghitung kolom hasil; karena itu alias `SELECT` tidak bisa dipakai di `WHERE`), dan terakhir `ORDER BY` dan `LIMIT`.
:::

Waspadai juga pembagian bilangan bulat di sini: tulis `100.0 * part / total` untuk persentase.

> 💡 **Jeda Praktik 3 (Agregasi GROUP BY & HAVING):**
> Terapkan logika agregasi pada tiga tantangan di `labs/mod-0-3/answers.sql`:
> 1. `-- k-2`: hitung jumlah pesanan per status (`GROUP BY status`, lalu `COUNT(*)`).
> 2. `-- k-3`: hitung nilai tiap pesanan (`SUM(qty * unit_price_idr)` dikelompokkan per `order_id`).
> 3. `-- k-7`: cari pelanggan dengan minimal 2 pesanan berstatus delivered (`HAVING COUNT(*) >= 2`).
> Uji ketiga query ini di terminal:
> `python3 labs/mod-0-3/check.py`
> Jika k-2, k-3, dan k-7 PASS, Anda telah menguasai agregasi data! Lanjut ke Pelajaran 6 tentang Join.

## @part Menggabungkan data

## @lesson Join: menggabungkan tabel, dan bagaimana ia bisa salah
**Join** menyatukan baris dari dua tabel yang cocok pada sebuah key. `c` dan `o` di bawah adalah **alias** tabel, nama pendek untuk tabelnya; klausa `ON` menyebut kolom mana yang harus cocok:

```sql
SELECT c.name, o.order_id, o.status
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id;
```

:::drill sql Pelanggan dan pesanannya
Tampilkan `name` setiap pelanggan bersama `order_id` dan `status` pesanannya. Pakai `JOIN ... ON`.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/join/ ## Pakai JOIN.
/\bon\b/ ## Sebutkan kolom yang harus cocok dengan ON.
@hint
`FROM customers c JOIN orders o ON o.customer_id = c.customer_id`
@solution
SELECT c.name, o.order_id, o.status FROM customers c JOIN orders o ON o.customer_id = c.customer_id;
:::

### INNER JOIN dan LEFT JOIN

`JOIN` biasa adalah **INNER JOIN**: ia hanya menyimpan pasangan yang cocok, sehingga pelanggan tanpa pesanan menghilang dari hasil. **LEFT JOIN** menyimpan *setiap* baris tabel kiri, mengisi sisi kanan dengan NULL di tempat tidak ada yang cocok. Lihat bedanya:

:::sqlsteps Siapa yang menghilang?
@data kopiku
@stage 1. Pelanggan: 10 baris
SELECT customer_id, name FROM customers
@say
Sepuluh pelanggan. Dua di antaranya (Fajar dan Rizky) tidak pernah memesan.
@stage 2. JOIN orders: 18 baris (satu per pesanan)
SELECT c.name, o.order_id FROM customers c JOIN orders o ON o.customer_id = c.customer_id
@say
INNER JOIN punya satu baris per pesanan yang cocok. Fajar dan Rizky tidak punya pesanan, jadi mereka lenyap.
@stage 3. LEFT JOIN orders: 20 baris
SELECT c.name, o.order_id FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id
@say
18 pesanan yang sama, ditambah 2 baris untuk pelanggan tanpa pesanan, dengan `NULL` di tempat pesanannya.
@stage 4. Simpan hanya baris NULL: pelanggan yang tidak pernah memesan
SELECT c.name, o.order_id FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL
@say
Pola ini adalah **anti-join**: LEFT JOIN, lalu `WHERE` sisi kanan `IS NULL`. Ia menjawab pertanyaan tentang ketiadaan.
:::

(`RIGHT JOIN` adalah bayangan cerminnya, dan `FULL JOIN` menyimpan baris yang tidak cocok dari kedua sisi; hampir selalu bisa ditulis ulang sebagai LEFT JOIN.)

:::drill sql Pesanan per pelanggan, termasuk nol
Tampilkan `name` setiap pelanggan dan berapa pesanannya, sebagai `orders`: pelanggan tanpa pesanan harus menampilkan 0. Pakai `LEFT JOIN`, dan hitung kolom dari tabel **kanan**.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/left\s+join/ ## Pakai LEFT JOIN, supaya pelanggan tanpa pesanan tetap ada di hasil.
/group\s+by/ ## Kelompokkan per pelanggan.
/count\s*\(\s*o\./ ## Hitung kolom tabel orders (COUNT(o.order_id)), bukan COUNT(*): COUNT(*) akan menghitung baris kosong sebagai 1.
@hint
`SELECT c.name, COUNT(o.order_id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.name;`
@solution
SELECT c.name, COUNT(o.order_id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.name;
:::

> **Peringatan:** Taruh filter untuk tabel *kanan* LEFT JOIN di klausa `ON`, bukan di `WHERE`. `WHERE o.status = 'delivered'` membuang baris NULL yang baru saja dibuat LEFT JOIN, diam-diam mengubahnya kembali menjadi INNER JOIN.

:::drill sql Tanpa pesanan delivered
Tampilkan `name` pelanggan yang **tidak punya pesanan delivered** (termasuk yang tidak punya pesanan sama sekali). Taruh kondisi `'delivered'` di klausa `ON` sebuah LEFT JOIN, lalu simpan baris yang pesanannya NULL.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/left\s+join/ ## Pakai LEFT JOIN.
/is\s+null/ ## Simpan baris yang pesanannya NULL.
@hint
`LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' WHERE o.order_id IS NULL`
@solution
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' WHERE o.order_id IS NULL;
:::

### Jebakan fan-out

Menggabungkan tabel pada satu grain dengan tabel pada grain yang lebih halus **mengulang** baris yang kasar. `orders` punya satu baris per pesanan, `order_items` satu per baris produk, jadi menggabungkannya menghasilkan satu baris per *baris produk*: 24 baris untuk 18 pesanan. Apa pun yang disimpan per pesanan (seperti ongkos kirim) sekarang diulang untuk setiap baris produk.

[[diagram:fanout]]

:::sqlsteps Join yang diam-diam menggelembungkan jumlah
@data kopiku
@stage 1. Pesanan delivered, dengan ongkos kirimnya: 12 baris
SELECT order_id, shipping_fee_idr FROM orders WHERE status = 'delivered'
@say
Satu baris per pesanan, jadi satu ongkos per pesanan.
@stage 2. Gabungkan baris produk: sebagian pesanan sekarang muncul dua kali
SELECT o.order_id, o.shipping_fee_idr FROM orders o JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'delivered'
@say
Pesanan dengan dua baris produk sekarang punya dua baris, dan ongkosnya diulang di masing-masing.
@stage 3. Jumlah yang salah: ongkos diulang per baris produk
SELECT SUM(o.shipping_fee_idr) AS shipping_total FROM orders o JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'delivered'
@say
350.000: query berjalan tanpa error apa pun dan melaporkan pendapatan ongkos kirim 49% terlalu tinggi.
@stage 4. Jumlah yang benar: tetap pada grain pesanan
SELECT SUM(shipping_fee_idr) AS shipping_total FROM orders WHERE status = 'delivered'
@say
235.000. Jumlahkan nilai per pesanan hanya pada grain per pesanan.
:::

Kebiasaan yang perlu dipakai: selalu tahu grain setiap tabel; setelah join, bandingkan `COUNT(*)` dengan yang Anda harapkan; jumlahkan nilai per pesanan hanya pada grain per pesanan, atau agregasikan tabel yang lebih halus lebih dulu (`SELECT order_id, SUM(qty * unit_price_idr) ... GROUP BY order_id`) lalu gabungkan hasilnya.

:::ask Dua tabel digabung dan jumlah barisnya lebih besar dari yang bisa Anda jelaskan. Apa yang Anda lakukan?
@options
lanjut saja: lebih banyak baris berarti lebih banyak data
* berhenti dan cari tahu mengapa sebelum melanjutkan: join pada key yang tidak unik mengulang baris
tambahkan DISTINCT untuk menyembunyikan pengulangan
@why
Join pada key yang tidak unik di **kedua** sisi melipatgandakan baris (many-to-many lebih parah lagi). `DISTINCT` menyembunyikan gejalanya dan bisa menyembunyikan baris berulang yang nyata. Cari dulu ketidakcocokan grain-nya.
:::

:::drill sql Jumlah tanpa fan-out
Berapa total ongkos kirim pesanan yang statusnya `'paid'` atau `'shipped'`? Tampilkan satu angka sebagai `shipping_total`. **Jangan** gabungkan `order_items`: ongkos itu per pesanan.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/sum\s*\(/ ## Pakai SUM(shipping_fee_idr).
@hint
`SELECT SUM(shipping_fee_idr) AS shipping_total FROM orders WHERE status IN ('paid', 'shipped');`
@solution
SELECT SUM(shipping_fee_idr) AS shipping_total FROM orders WHERE status IN ('paid', 'shipped');
:::

:::drill sql Pendapatan per kota
Untuk pesanan `'delivered'`, tampilkan setiap kota dan jumlah `qty * unit_price_idr` baris-barisnya, sebagai `revenue`. Kota NULL harus tampil sebagai `'Unknown'`. Anda butuh tiga tabel.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/join/ ## Gabungkan tabelnya: customers, orders, dan order_items.
/coalesce/ ## Tampilkan kota NULL sebagai 'Unknown' dengan COALESCE.
@hint
`FROM customers c JOIN orders o ON ... JOIN order_items i ON ...` lalu `GROUP BY COALESCE(c.city, 'Unknown')`.
@solution
SELECT COALESCE(c.city, 'Unknown') AS city, SUM(i.qty * i.unit_price_idr) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY COALESCE(c.city, 'Unknown');
:::

> 💡 **Jeda Praktik 4 (JOIN, Anti-Join & Pencegahan Fan-Out):**
> Kerjakan tantangan penggabungan tabel di `labs/mod-0-3/answers.sql`:
> 1. `-- k-5`: cari pelanggan yang belum pernah memesan (`LEFT JOIN orders` lalu `WHERE o.order_id IS NULL`).
> 2. `-- k-6`: omset per kota untuk pesanan delivered, ubah kota NULL menjadi 'Unknown' dengan `COALESCE(c.city, 'Unknown')`.
> 3. `-- k-8`: hitung total ongkir pesanan delivered tanpa terkena fan-out (jumlahkan kolom dari tabel `orders` saja!).
> Uji di terminal:
> `python3 labs/mod-0-3/check.py`
> Pastikan k-5, k-6, dan k-8 mencetak PASS! Lanjut ke Pelajaran 7 di bawah.

## @lesson Cara lain menggabungkan data: self-join, CROSS JOIN, dan operasi himpunan
Join menaruh tabel **berdampingan**: ia menambah kolom. Tiga alat lagi melengkapi gambarnya: tabel yang digabung dengan dirinya sendiri, setiap baris dipasangkan dengan setiap baris, dan **menumpuk** hasil satu di atas yang lain.

### Self-join: tabel melawan dirinya sendiri

Untuk membandingkan baris dari tabel yang *sama*, gabungkan tabel itu dengan dirinya sendiri di bawah dua alias. Pasangan produk dengan roast yang sama:

```sql
SELECT a.product_id AS product_a, b.product_id AS product_b, a.roast
FROM products a
JOIN products b ON a.roast = b.roast AND a.product_id < b.product_id;
```

Ini menghasilkan 3 pasangan: (1, 4) medium, (2, 5) dark, dan (3, 6) light. Tanda `<` yang membuatnya benar: tanpanya setiap produk dipasangkan dengan dirinya sendiri dan setiap pasangan muncul dua kali (12 baris, bukan 3). Ingat pelajaran NULL: dua NULL tidak pernah sama, jadi baris dengan NULL di kolom join tidak cocok dengan apa pun.

:::drill sql Pasangan dengan tier yang sama
Tampilkan pasangan pelanggan yang punya `tier` sama: kedua namanya sebagai `customer_a` dan `customer_b`. Setiap pasangan harus muncul **sekali**, dan tidak ada yang dipasangkan dengan dirinya sendiri.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/join/ ## Gabungkan tabel customers dengan dirinya sendiri (dua alias).
/</ ## Pakai a.customer_id < b.customer_id agar setiap pasangan muncul sekali.
@hint
`FROM customers a JOIN customers b ON a.tier = b.tier AND a.customer_id < b.customer_id`
@solution
SELECT a.name AS customer_a, b.name AS customer_b FROM customers a JOIN customers b ON a.tier = b.tier AND a.customer_id < b.customer_id;
:::

### CROSS JOIN: setiap kombinasi

`CROSS JOIN` tidak punya `ON`: setiap baris satu sisi dipasangkan dengan setiap baris sisi lain. Berguna untuk membangun **grid lengkap** kategori, supaya kombinasi tanpa data tetap muncul sebagai 0 alih-alih diam-diam lenyap (grafik dengan batang yang hilang adalah kebohongan karena menghilangkan). Lalu `LEFT JOIN` faktanya ke grid dan hitung kolom dari sisi *kanan* (`COUNT(o.order_id)`, bukan `COUNT(*)`, yang akan menghitung baris kosong sebagai 1).

:::drill sql Setiap kombinasi
Tampilkan setiap kombinasi `roast` produk dan `tier` pelanggan: dua kolom `roast` dan `tier`, setiap kombinasi sekali. Pakai `CROSS JOIN` pada nilai-nilai yang berbeda.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/cross\s+join/ ## Pakai CROSS JOIN.
@hint
`FROM (SELECT DISTINCT roast FROM products) r CROSS JOIN (SELECT DISTINCT tier FROM customers) t`
@solution
SELECT r.roast, t.tier FROM (SELECT DISTINCT roast FROM products) r CROSS JOIN (SELECT DISTINCT tier FROM customers) t;
:::

Bahayanya adalah cross join yang **tidak disengaja**: lupa `ON` pada join biasa dan `customers` dengan `products` menghasilkan 10 x 6 = 60 baris; dengan dua tabel berisi sejuta baris ia menghasilkan satu triliun.

### Operasi himpunan: menumpuk hasil

Operasi himpunan menumpuk hasil dua query. Kedua query harus mengembalikan jumlah kolom yang sama dengan tipe yang kompatibel, dan kolom dicocokkan berdasarkan **posisi**, bukan nama (menukar dua kolom tanpa sengaja mencampur data tanpa error). Memakai tier pelanggan di Jakarta (Gold, Bronze, Silver) dan di Bandung (Silver, Gold):

| Operator | Menyimpan | Baris |
|---|---|---|
| `UNION ALL` | semuanya, duplikat juga | 5 |
| `UNION` | semuanya, duplikat dihapus | 3 |
| `INTERSECT` | baris yang ada di keduanya | 2 (Gold, Silver) |
| `EXCEPT` | baris pertama yang tidak ada di kedua | 1 (Bronze) |

:::ask Jakarta punya tier Gold, Bronze, dan Silver; Bandung punya Silver dan Gold. Operator mana yang hanya menyimpan baris yang ada di KEDUA hasil?
@options
UNION
EXCEPT
* INTERSECT
@why
`INTERSECT` hanya menyimpan baris yang ada di kedua hasil (Gold dan Silver). `UNION` menyimpan semuanya dari keduanya (tanpa pengulangan), dan `EXCEPT` menyimpan baris hasil pertama yang tidak ada di yang kedua.
:::

:::drill sql Kota dari dua kelompok
Tampilkan kota-kota yang berbeda dari pelanggan `'Gold'` **dan** pelanggan `'Silver'` bersama-sama, setiap kota sekali (satu kolom `city`). Pakai `UNION`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/union/ ## Pakai UNION.
@hint
`SELECT city FROM customers WHERE tier = 'Gold' UNION SELECT city FROM customers WHERE tier = 'Silver'`
@solution
SELECT city FROM customers WHERE tier = 'Gold' UNION SELECT city FROM customers WHERE tier = 'Silver';
:::

:::drill sql Bronze tetapi bukan Gold
Tampilkan kota tempat pelanggan `'Bronze'` tinggal tetapi tidak ada pelanggan `'Gold'` yang tinggal (satu kolom `city`). Abaikan pelanggan dengan kota tidak diketahui. Pakai `EXCEPT`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/except/ ## Pakai EXCEPT.
@hint
`SELECT city FROM customers WHERE tier = 'Bronze' AND city IS NOT NULL EXCEPT SELECT city FROM customers WHERE tier = 'Gold'`
@solution
SELECT city FROM customers WHERE tier = 'Bronze' AND city IS NOT NULL EXCEPT SELECT city FROM customers WHERE tier = 'Gold';
:::

`UNION ALL` menumpuk semuanya dan mempertahankan duplikat. `UNION` juga menghapus duplikat, yang memerlukan pengurutan dan bisa menyembunyikan baris berulang yang nyata, jadi hanya tepat dipilih ketika duplikat akan menjadi kesalahan. Operasi himpunan membandingkan seluruh baris dan menganggap dua NULL sama, tidak seperti `=`.

> **Peringatan:** `NOT IN` dengan subquery yang bisa mengembalikan NULL mengembalikan **tidak ada baris sama sekali**, karena `x NOT IN (1, NULL)` tidak pernah benar. `SELECT name FROM customers WHERE city NOT IN (SELECT city FROM customers WHERE tier = 'Silver')` mengembalikan 0 baris, karena satu pelanggan Silver tidak punya kota. Menambahkan `AND city IS NOT NULL` di dalam subquery memberi 3 baris. `NOT EXISTS`, `EXCEPT`, dan anti-join LEFT JOIN tidak punya jebakan ini, itulah sebabnya mereka cara yang lebih aman untuk mengatakan "tidak ada di".

> 🛠 **Coba sendiri (25 menit, SQL Sandbox dengan dataset KopiKu).** Selesaikan tantangan KopiKu **k-24** (daftar kampanye dari dua daftar), **k-25** (pelanggan yang memakai kartu dan e-wallet), **k-26** (pelanggan tanpa pesanan cancelled atau refunded), **k-27** (setiap tier dan metode bayar, dengan nol), **k-28** (pasangan pelanggan sekota), dan **k-29** (baris total di bawah). Sebelum menjalankan k-24, tebak berapa pelanggan yang Anda dapat dengan `UNION` dan dengan `UNION ALL`, lalu coba keduanya. Untuk k-28, jalankan dulu dengan `a.customer_id <> b.customer_id` dan hitung barisnya, lalu perbaiki.
>
> **Yang harus Anda lihat:** k-24 mengembalikan 8 pelanggan (`UNION ALL` akan menampilkan 9, karena pelanggan 9 ada di kedua daftar); k-25 mengembalikan 4 (1, 2, 4, 7); k-26 mengembalikan 5 (1, 3, 5, 7, 9); k-27 mengembalikan 12 baris, dengan Gold dan bank_transfer bernilai 0; k-28 mengembalikan 4 pasang (`<>` memberi 8, tiap pasangan dua kali); k-29 mengembalikan 6 baris, yang terakhir `ALL` dengan 18.

## @lesson CASE, subquery, dan CTE
Tiga alat melengkapi kotak perkakas sehari-hari: **CASE** (if/else di dalam query), **subquery** (query di dalam query lain), dan **CTE** (langkah yang diberi nama, supaya query panjang terbaca dari atas ke bawah).

### CASE: if / else

**CASE** adalah if/else-nya SQL, dipakai untuk membuat kategori. `WHEN` pertama yang benar menang, seperti `if / elif / else` di Python:

```sql
SELECT name,
       CASE WHEN price_idr < 80000 THEN 'cheap'
            WHEN price_idr < 95000 THEN 'regular'
            ELSE 'premium' END AS segment
FROM products;
```

:::drill sql Beri label produk
Tampilkan `name` setiap produk dan sebuah `segment`: `'budget'` ketika `price_idr` di bawah 85000, `'standard'` ketika di bawah 100000, dan `'premium'` selain itu.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/case/ ## Pakai CASE WHEN ... THEN ... ELSE ... END.
@hint
`CASE WHEN price_idr < 85000 THEN 'budget' WHEN price_idr < 100000 THEN 'standard' ELSE 'premium' END AS segment`
@solution
SELECT name, CASE WHEN price_idr < 85000 THEN 'budget' WHEN price_idr < 100000 THEN 'standard' ELSE 'premium' END AS segment FROM products;
:::

`CASE` juga membuat hitungan yang portabel: `SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)` menghitung baris yang dibatalkan di setiap database.

:::drill sql Menghitung dengan CASE
Tampilkan berapa pesanan yang `'cancelled'` sebagai `cancelled` dan berapa yang `'delivered'` sebagai `delivered`, dalam satu baris, memakai `SUM(CASE WHEN ...)`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/case/ ## Pakai SUM(CASE WHEN ... THEN 1 ELSE 0 END).
@hint
`SELECT SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered FROM orders;`
@solution
SELECT SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered FROM orders;
:::

### Subquery: query di dalam query

**Subquery skalar** mengembalikan satu nilai, berguna untuk membandingkan dengan total atau rata-rata, dan untuk porsi dari total:

```sql
SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS pct
FROM orders
GROUP BY payment_method;
```

:::drill sql Di atas rata-rata
Tampilkan `name` produk yang harganya **lebih dari rata-rata** harga produk. Pakai subquery untuk rata-ratanya.
@data kopiku
@starter
-- tulis query Anda di bawah baris ini

@check
/\(\s*select/ ## Taruh subquery dalam kurung: (SELECT AVG(price_idr) FROM products).
@hint
`WHERE price_idr > (SELECT AVG(price_idr) FROM products)`
@solution
SELECT name FROM products WHERE price_idr > (SELECT AVG(price_idr) FROM products);
:::

### CTE: beri nama pada hasil antara

**CTE** (common table expression, `WITH nama AS (...)`) memberi nama pada hasil antara, sehingga query panjang terbaca dari atas ke bawah seperti resep. Lihat satu query yang dibangun dalam dua langkah:

:::sqlsteps Query sebagai resep
@data kopiku
@stage 1. Langkah satu, bernama order_totals: satu baris per pesanan
WITH order_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT * FROM order_totals
@say
CTE `order_totals` punya satu baris per pesanan. Anda bisa memilih darinya sendirian untuk memeriksanya.
@stage 2. Langkah dua: gabungkan dengan orders
WITH order_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT o.order_id, o.status, t.order_total FROM orders o JOIN order_totals t ON t.order_id = o.order_id
@say
Menggabungkan hasil satu-baris-per-pesanan dengan `orders` tidak bisa fan-out. Inilah cara aman menggabungkan tabel yang lebih halus: agregasikan dulu, baru gabungkan.
@stage 3. Langkah tiga: pakai hasilnya
WITH order_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT o.order_id, o.status, t.order_total FROM orders o JOIN order_totals t ON t.order_id = o.order_id WHERE t.order_total >= 200000
@say
Hanya pesanan besar yang tersisa.
:::

:::drill sql Tiga pesanan terbesar
Memakai CTE bernama `line_totals` (satu baris per pesanan dengan `SUM(qty * unit_price_idr)` sebagai `order_total`), tampilkan **tiga pesanan dengan total terbesar**: `order_id` dan `order_total`, yang terbesar dulu.
@data kopiku
@ordered
@starter
-- tulis query Anda di bawah baris ini

@check
/with\s+line_totals/ ## Mulai dengan WITH line_totals AS (...).
@hint
`WITH line_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT order_id, order_total FROM line_totals ORDER BY order_total DESC LIMIT 3;`
@solution
WITH line_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT order_id, order_total FROM line_totals ORDER BY order_total DESC LIMIT 3;
:::

Pilih CTE daripada subquery bersarang dalam: lebih mudah dibaca, di-debug (pilih dari setiap langkah sendirian), dan ditinjau. Gaya penting karena orang lain akan memelihara SQL Anda. Taruh setiap klausa di barisnya sendiri, pakai alias yang jelas, jaga huruf kata kunci konsisten, dan tambahkan komentar yang menjelaskan *mengapa* sebuah filter ada ("kecualikan akun uji") bukan apa yang dilakukannya.

> 💡 **Jeda Praktik 5 (CASE & CTE - Tuntaskan Seluruh Lab):**
> Tuntaskan dua query terakhir di `labs/mod-0-3/answers.sql`:
> 1. `-- k-9`: kelompokkan pesanan menjadi 'small', 'medium', dan 'large' menggunakan CTE `WITH ... AS` dan `CASE WHEN`.
> 2. `-- k-10`: hitung persentase porsi tiap metode pembayaran menggunakan subquery skalar `(SELECT COUNT(*) FROM orders)`.
> Sekarang uji seluruh 10 jawaban Anda di terminal:
> `python3 labs/mod-0-3/check.py`
> Jika skor Anda **10/10 answers correct**, seluruh fondasi SQL analitik Anda telah terbukti sempurna! Lanjut ke Pelajaran 9 untuk DML & Transaksi.

## @part Mengubah dan mendefinisikan tabel

## @lesson Mengubah data dengan aman: DML, constraint, dan transaksi
Selain membaca, SQL **mengubah** data. Tiga pernyataan melakukannya, dan masing-masing menuntut kehati-hatian.

### INSERT, UPDATE, DELETE

```sql
INSERT INTO customers (customer_id, name, city, tier, signup_date)
VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');

UPDATE customers SET tier = 'Silver' WHERE customer_id = 11;

DELETE FROM customers WHERE customer_id = 11;
```

Dalam latihan ini pemeriksa menjalankan pernyataan Anda lalu melihat isi tabelnya.

:::drill sql Tambah pelanggan
Tambahkan pelanggan baru: id `11`, nama `'Lina Marlina'`, kota `'Medan'`, tier `'Bronze'`, tanggal daftar `'2026-02-01'`.
@data kopiku
@verify
SELECT customer_id, name, city, tier, signup_date FROM customers WHERE customer_id = 11
@starter
-- tulis pernyataan Anda di bawah baris ini

@check
/insert\s+into/ ## Pakai INSERT INTO customers ... VALUES (...).
@hint
`INSERT INTO customers (customer_id, name, city, tier, signup_date) VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');`
@solution
INSERT INTO customers (customer_id, name, city, tier, signup_date) VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');
:::

> **Peringatan:** `UPDATE` dan `DELETE` tanpa `WHERE` mengubah **setiap baris**. Sebelum menjalankan keduanya, jalankan `WHERE` yang sama dalam `SELECT` dan periksa jumlah barisnya. Di produksi, jalankan di dalam transaksi (di bawah) dan periksa sebelum commit.

:::ask Apa yang dilakukan ini?
```sql
UPDATE customers SET tier = 'Gold';
```
@options
* mengubah tier SETIAP pelanggan, karena tidak ada WHERE
mengubah tier pelanggan pertama
gagal dengan error
@why
Tanpa `WHERE`, sebuah `UPDATE` menyentuh setiap baris. Ini salah satu kesalahan ketik termahal dalam pekerjaan data. Selalu tulis `WHERE` lebih dulu, periksa dengan `SELECT`, baru ubah datanya.
:::

:::drill sql Ubah hanya satu baris
Ubah tier pelanggan `5` (Rina Pratama) menjadi `'Gold'`. **Hanya** pelanggan itu yang boleh berubah.
@data kopiku
@verify
SELECT tier, COUNT(*) AS customers FROM customers GROUP BY tier ORDER BY tier
@starter
-- tulis pernyataan Anda di bawah baris ini

@check
/update/ ## Pakai UPDATE customers SET ... WHERE ...
/where/ ## Tanpa WHERE setiap pelanggan akan berubah. Tambahkan WHERE customer_id = 5.
@hint
`UPDATE customers SET tier = 'Gold' WHERE customer_id = 5;`
@solution
UPDATE customers SET tier = 'Gold' WHERE customer_id = 5;
:::

:::drill sql Hapus dengan kondisi
Hapus pesanan yang statusnya `'cancelled'`. Periksa dulu dengan `SELECT` apa yang akan cocok dengan sebuah `WHERE`; di sini, tulis `DELETE`-nya.
@data kopiku
@verify
SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY status
@starter
-- tulis pernyataan Anda di bawah baris ini

@check
/delete\s+from/ ## Pakai DELETE FROM orders WHERE ...
/where/ ## Tambahkan WHERE, atau semua pesanan terhapus.
@hint
`DELETE FROM orders WHERE status = 'cancelled';`
@solution
DELETE FROM orders WHERE status = 'cancelled';
:::

### Constraint: database berkata tidak

**Constraint** membiarkan database menolak data buruk alih-alih menyimpannya: `PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK (qty > 0)`. Aturan yang ditegakkan database berlaku apa pun aplikasi yang menulis ke dalamnya; aturan yang hanya hidup di kode aplikasi berlaku sampai seseorang menulis skrip.

### Transaksi: semua atau tidak sama sekali

**Transaksi** mengelompokkan pernyataan sehingga berhasil atau gagal *bersama-sama*:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;      -- atau ROLLBACK; untuk membatalkan keduanya
```

Jika server crash di antara dua update, tidak ada yang berlaku; uang tidak pernah hilang.

:::ask Anda menjalankan BEGIN, lalu DELETE FROM orders WHERE status = 'cancelled', lalu ROLLBACK. Berapa pesanan di tabel sekarang?
@options
16
0
* 18, seperti semula: ROLLBACK membatalkan penghapusan
@why
`ROLLBACK` membatalkan semuanya sejak `BEGIN`. Penghapusan akan menyisakan 16 pesanan; rollback mengembalikan 18 yang semula. `COMMIT` akan membuat penghapusan permanen.
:::

:::advanced ACID, indeks, dan dialek
Transaksi memberi jaminan **ACID**: *Atomicity* (semua atau tidak sama sekali), *Consistency* (constraint selalu berlaku), *Isolation* (transaksi yang berjalan bersamaan tidak melihat pekerjaan setengah jadi satu sama lain), dan *Durability* (data yang sudah di-commit bertahan dari crash). Jaminan inilah yang membuat database produksi bisa dipercaya, dan mengapa Modul 2.2 sangat peduli ketika lake mencoba menambahkannya ke file biasa.

**Indeks** adalah struktur pencarian terpisah yang membuat pencarian baris berdasarkan kolom menjadi cepat, seperti indeks sebuah buku. Ia mempercepat pembacaan dan sedikit memperlambat penulisan; Modul 1.3 kembali membahas kapan dan bagaimana membuatnya.

**SQL punya dialek.** Inti di materi ini berjalan di mana-mana, tetapi fungsi tanggal, fungsi string, `LIMIT` versus `TOP`, dan fitur khusus berbeda antara SQLite (dipakai di sandbox kursus ini), PostgreSQL, MySQL, DuckDB, Snowflake, dan BigQuery. Ketika sesuatu gagal setelah menyalin query, periksa dialeknya lebih dulu.
:::

> 🛠 **Coba sendiri (8 menit, SQL Sandbox).** Transaksi memungkinkan Anda mencoba sebuah perubahan lalu menariknya kembali. Jalankan ini sebagai dua kali jalan terpisah: (1) `BEGIN; DELETE FROM orders WHERE status = 'cancelled'; SELECT COUNT(*) FROM orders;` lalu (2) `ROLLBACK; SELECT COUNT(*) FROM orders;`. Lalu latih kebiasaan aman: tulis dulu `SELECT COUNT(*) FROM orders WHERE status = 'cancelled'`, baru setelahnya `DELETE` dengan `WHERE` yang sama.
>
> **Seharusnya Anda melihat:** `16` setelah delete di dalam transaksi dan `18` setelah `ROLLBACK`; query pemeriksa sebelum delete menghasilkan `2`. Tanpa `BEGIN`, penghapusannya akan bertahan sampai Anda menekan **Reset data**.

## @lesson Mendefinisikan tabel: DDL, tipe, dan view
Sejauh ini Anda membaca dan mengubah baris. **DDL** (Data Definition Language) membuat dan mengubah *struktur*: `CREATE`, `ALTER`, dan `DROP`.

### CREATE TABLE: tipe dan constraint

Tabel yang Anda rancang sendiri punya kolom, masing-masing dengan **tipe**, **constraint** opsional, dan opsional `DEFAULT`:

```sql
CREATE TABLE reviews (
  review_id   INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (customer_id),
  product_id  INTEGER NOT NULL REFERENCES products (product_id),
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (customer_id, product_id)          -- satu ulasan per pelanggan per produk
);
```

Kami menjalankan tabel semacam ini dan setiap constraint menolak baris buruk: `stars` bernilai 9 gagal dengan `CHECK constraint failed`, `customer_id` yang hilang dengan `NOT NULL constraint failed`, dan ulasan kedua dari pelanggan yang sama untuk produk yang sama dengan `UNIQUE constraint failed`. Pilih tipe dengan sengaja: bilangan bulat `INTEGER`, teks `TEXT`, tanggal dan waktu sebagai tipe tanggal sungguhan di mesin yang punya (teks ISO di SQLite), dan **uang jangan pernah sebagai floating point**: di SQLite `0.1 + 0.2 = 0.3` itu **salah** (jumlahnya 0.30000000000000004). KopiKu menyimpan rupiah sebagai `INTEGER`.

:::drill sql Rancang sebuah tabel
Buat tabel `tags` dengan tiga kolom: `tag_id` (INTEGER, primary key), `label` (TEXT, NOT NULL), dan `product_id` (INTEGER).
@data kopiku
@verify
SELECT name, type, "notnull", pk FROM pragma_table_info('tags') ORDER BY cid
@starter
-- tulis pernyataan Anda di bawah baris ini

@check
/create\s+table\s+tags/ ## Pakai CREATE TABLE tags (...).
@hint
```sql
CREATE TABLE tags (
  tag_id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  product_id INTEGER
);
```
@solution
CREATE TABLE tags (tag_id INTEGER PRIMARY KEY, label TEXT NOT NULL, product_id INTEGER);
:::

:::advanced Mesin mungkin tidak menegakkan apa yang Anda deklarasikan
Ini perilaku SQLite nyata yang kami ukur: SQLite membiarkan Anda memasukkan `'abc'` ke kolom `INTEGER` dan menyimpan teksnya (PostgreSQL dan DuckDB menolak dengan error). SQLite juga **tidak menegakkan foreign key secara default** (`PRAGMA foreign_keys` mengembalikan 0 di SQLite milik Python dan di sandbox). Kami memasukkan pesanan untuk pelanggan 99, yang tidak ada, dan diterima. Setelah `PRAGMA foreign_keys = ON` insert yang sama gagal dengan `FOREIGN KEY constraint failed`, dan PostgreSQL selalu menolaknya. Constraint yang tidak pernah Anda verifikasi hanyalah harapan. Uji constraint yang Anda andalkan dengan mencoba merusaknya.
:::

### ALTER TABLE: mengubah tabel

`ALTER TABLE customers ADD COLUMN email TEXT` menambah kolom, dan setiap baris yang ada mendapat NULL di situ (sudah kami periksa). `DROP COLUMN` dan `RENAME` ada (SQLite 3.35+, PostgreSQL, lainnya). `DROP TABLE` menghapus tabel dan datanya, jadi jalankan hanya dengan sengaja.

:::drill sql Tambah kolom
Tambahkan kolom `email` (TEXT) ke tabel `customers`. Jangan hapus apa pun.
@data kopiku
@verify
SELECT name, type FROM pragma_table_info('customers') ORDER BY cid
@starter
-- tulis pernyataan Anda di bawah baris ini

@check
/alter\s+table/ ## Pakai ALTER TABLE customers ADD COLUMN ...
@hint
`ALTER TABLE customers ADD COLUMN email TEXT;`
@solution
ALTER TABLE customers ADD COLUMN email TEXT;
:::

Perubahan pada tabel bersama sebaiknya ditulis sebagai **skrip migrasi** kecil dan berurutan yang disimpan di version control, dijalankan dengan cara yang sama di setiap lingkungan, dan sebaiknya **kompatibel ke belakang** (menambah kolom nullable tidak merusak query yang ada; mengganti namanya merusak). Modul 3.2 kembali membahas perubahan skema di stream.

### View: nama untuk sebuah query

**View** memberi nama pada sebuah query:

```sql
CREATE VIEW v_gold AS SELECT * FROM customers WHERE tier = 'Gold';
```

View menyimpan **query-nya, bukan datanya**. Kami membuat `v_gold` ketika cocok dengan 1 baris, memasukkan pelanggan Gold lain, dan view langsung mengembalikan 2 baris.

:::drill sql Buat sebuah view
Buat view `v_delivered` yang menampilkan pesanan dengan status `'delivered'` (semua kolom).
@data kopiku
@verify
SELECT order_id, status FROM v_delivered ORDER BY order_id
@starter
-- tulis pernyataan Anda di bawah baris ini

@check
/create\s+view\s+v_delivered/ ## Pakai CREATE VIEW v_delivered AS SELECT ...
@hint
`CREATE VIEW v_delivered AS SELECT * FROM orders WHERE status = 'delivered';`
@solution
CREATE VIEW v_delivered AS SELECT * FROM orders WHERE status = 'delivered';
:::

:::ask Sebuah view dan tabel snapshot (CREATE TABLE snap AS SELECT ...) dibuat ketika tabel sumber punya 5 baris. Lalu satu baris lagi dimasukkan ke sumber. Apa yang ditampilkan keduanya?
@options
* view menampilkan 6 baris; snapshot masih menampilkan 5
keduanya menampilkan 6 baris
keduanya menampilkan 5 baris
@why
View menyimpan **query-nya**, jadi ia selalu membaca data terkini. Tabel yang dibuat dengan `CREATE TABLE ... AS SELECT` (CTAS) menyimpan **snapshot** yang tidak berubah ketika sumbernya berubah (dan ia kehilangan constraint aslinya). PostgreSQL dan warehouse juga menawarkan **materialized view**: hasil tersimpan yang **basi sampai di-refresh**.
:::

Mengapa ini penting bagi data engineer: view adalah cara tim mendefinisikan sebuah metrik di satu tempat ("revenue" berarti query ini) dan cara warehouse membuka subset kolom yang aman. Model yang Anda bangun dengan dbt di Modul 2.3 adalah view dan tabel yang dibuat oleh DDL yang ditulis alat itu untuk Anda; mengetahui apa mereka sebenarnya di bawahnya membuat Anda bisa men-debug-nya.

> 🛠 **Coba sendiri (10 menit, SQL Sandbox).** Buat tabel `reviews` dari pelajaran ini, lalu rusak dengan sengaja, satu aturan demi satu aturan: ulasan dengan 9 bintang; pelanggan yang sama mengulas produk yang sama dua kali; ulasan tanpa pelanggan. Baca setiap error-nya. Lalu buat view `v_delivered` (`SELECT * FROM orders WHERE status = 'delivered'`), hitung barisnya, masukkan satu pesanan delivered lagi ke `orders`, dan hitung lagi.
>
> **Seharusnya Anda melihat:** `CHECK constraint failed: stars BETWEEN 1 AND 5`, lalu `UNIQUE constraint failed: reviews.customer_id, reviews.product_id`, lalu `NOT NULL constraint failed: reviews.customer_id`; dan view yang jumlahnya berubah dari `12` menjadi `13` tanpa Anda menyentuh view itu.

Dengan Level 0 selesai, Anda tahu dasar Python, terminal, Git, pembersihan data, dan SQL inti. Level 1 mengubah alat-alat itu menjadi pekerjaan rekayasa otomatis: pipeline shell dan container (`Modul 1.1`), job Python yang defensif (`Modul 1.2`), dan fungsi window analitik (`Modul 1.3`).

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
6. Opsional: bangun database sendiri dan jelajahi di prompt `sqlite>`, tanpa memasang apa pun (Python 3.12 atau lebih baru): `python3 -m sqlite3 kopiku.db < labs/mod-0-3/datasets/kopiku.sql`, lalu `python3 -m sqlite3 kopiku.db`. Di `sqlite>` tampilkan tabelnya dengan `select name from sqlite_master where type = 'table';`, lihat cara `orders` dibuat dengan `select sql from sqlite_master where name = 'orders';`, lalu coba query apa pun, masing-masing diakhiri `;`. Keluar dengan `.quit`.

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

### Dua dari 18 pesanan KopiKu dibatalkan. Ekspresi SQLite mana yang mengembalikan angka cancellation rate sebesar 11,1 (persen)?
- [ ] `ROUND(100 * 2 / 18, 1)`, karena mengalikan dengan 100 lebih dulu selalu mempertahankan desimal hasilnya
- [ ] `ROUND(2 / 18 * 100, 1)`, karena pembagian dilakukan lebih dulu, lalu pecahannya dikalikan sesudahnya
- [x] `ROUND(100.0 * 2 / 18, 1)`, karena satu nilai desimal membuat pembagian mempertahankan desimalnya
- [ ] `ROUND(2 / 18, 1) * 100`, karena membulatkan pecahan lebih dulu menjaga ketelitian jawabannya

> Dengan bilangan bulat saja, SQLite memotong: `100 * 2 / 18` adalah 11 dan `2 / 18` adalah 0. Satu operand desimal (100.0) memaksa pembagian desimal, sehingga hasilnya 11,11 yang dibulatkan menjadi 11,1.

### View `delivered_orders` dibuat di atas `orders`. Setelah itu 5 pesanan delivered lagi dimasukkan. Apa yang dikembalikan `SELECT COUNT(*) FROM delivered_orders`?
- [ ] Hitungan pada saat view dibuat, karena view menyimpan salinan baris yang dipilihnya
- [ ] Sebuah error, karena view harus di-drop dan dibuat ulang setiap kali tabel di bawahnya berubah
- [ ] Hanya 5, karena view hanya menampilkan baris yang ditambahkan setelah hari ia dibuat
- [x] Hitungan lama ditambah 5 baris baru, karena view menjalankan querynya pada data terkini

> View adalah query tersimpan, bukan data tersimpan. Tabel hasil `CREATE TABLE ... AS` adalah snapshot yang mempertahankan hitungan lama, dan materialized view tetap basi sampai di-refresh.

### `SELECT customer_id FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders)` tidak mengembalikan baris sama sekali, padahal ada pelanggan yang belum pernah memesan. Apa penyebab yang paling mungkin?
- [x] Ada `orders.customer_id` yang NULL, jadi setiap perbandingan NOT IN tidak diketahui dan tak ada yang lolos
- [ ] NOT IN hanya bekerja jika subquery mengembalikan satu nilai, jadi daftar id selalu menghasilkan hasil kosong
- [ ] Subquery dijalankan sekali per pelanggan, dan diam-diam habis waktu pada tabel sebesar `orders`
- [ ] NOT IN membandingkan teks, jadi customer id berupa angka tidak pernah cocok dan tersaring

> `x NOT IN (1, 2, NULL)` berarti `x <> 1 AND x <> 2 AND x <> NULL`, dan bagian terakhir tidak pernah benar. Pakai `NOT EXISTS`, atau saring NULL dari subquery.

### Apa beda `UNION` dan `UNION ALL`?
- [ ] `UNION` menumpuk baris kedua query, `UNION ALL` hanya menyimpan baris yang sama di keduanya
- [ ] `UNION ALL` juga mengurutkan hasil gabungannya, itulah sebabnya ia yang lebih lambat dari keduanya
- [ ] Dalam praktik tidak ada bedanya; `ALL` hanya berpengaruh jika kedua query membaca tabel yang sama
- [x] `UNION` membuang baris duplikat dari hasil gabungan, sedangkan `UNION ALL` menyimpan setiap baris

> Membuang duplikat butuh sort atau hash. Jika duplikat tidak mungkin terjadi, atau memang harus disimpan (menjumlahkan dua bulan), `UNION ALL` benar sekaligus lebih murah.

## @resources
- [Referensi bahasa SQL SQLite](https://www.sqlite.org/lang.html)
- [Tutorial PostgreSQL: dasar-dasar SQL](https://www.postgresql.org/docs/current/tutorial-sql.html)
- [Dokumentasi modul sqlite3 Python](https://docs.python.org/3/library/sqlite3.html)
