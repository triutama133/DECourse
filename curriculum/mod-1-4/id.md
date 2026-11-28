---
title: Pemodelan Dimensial: Merancang Tabel untuk Analitik
duration: 3 minggu
summary: Pelajari cara merancang star schema sebagaimana tim analitik sungguhan bekerja: tetapkan grain, pisahkan fakta dari dimensi, gunakan surrogate key, pertahankan histori dengan slowly changing dimension (SCD), dan uji bahwa model menghasilkan angka yang benar.
why: Tutorial daring sering mengklaim star schema sudah kuno dan menyuruh Anda menumpuk segalanya ke dalam satu tabel raksasa (One Big Table). Di dunia kerja nyata, tabel tanpa kejelasan grain melipatgandakan pendapatan, histori terhapus diam-diam, dan tidak ada yang tahu metrik mana yang benar.
---

## @outcomes
- Menjelaskan mengapa kebutuhan analitik membutuhkan desain tabel yang berbeda dari basis data aplikasi, serta mempraktikkan proses empat langkah pemodelan dimensional
- Menetapkan grain tabel fakta secara presisi dan mengidentifikasi measures, dimensi, serta degenerate dimension
- Memilih tipe SCD yang tepat (Tipe 0, 1, 2, atau 3) untuk setiap atribut, serta mengimplementasikan SCD Tipe 2 dengan rentang validitas dan as-of join
- Menerapkan surrogate key dan anggota khusus "unknown" agar setiap baris fakta selalu merujuk ke baris dimensi yang valid
- Menguji star schema untuk memastikan grain, integritas referensial, serta rekonsiliasi total angka dengan data sumber

## @prereq
Modul 0.3 dan 1.3 (join, jebakan fan-out, window function seperti LEAD, dan CTE rekursif). Lab ini menggunakan SQL murni pada SQLite ditambah skrip pembantu Python ringan; tidak perlu instalasi tambahan untuk `test_lab.py` atau `check.py` (pasang `pytest` lewat `pip install pytest` jika Anda ingin menjalankan `scripts/prove.py`).

## @part Merancang star schema

## @lesson Mengapa analitik membutuhkan rancangan yang berbeda
Basis data operasional yang menjalankan aplikasi KopiKu dirancang secara **ternormalisasi**: setiap fakta dicatat satu kali saja di dalam banyak tabel kecil agar operasi tulis (insert, update) berlangsung cepat dan konsisten (Modul 0.3). Namun, pertanyaan bisnis seperti "berapa pendapatan per tier pelanggan per minggu berdasarkan tingkat sangrai kopi" membutuhkan join melintasi lima hingga enam tabel operasional. Query semacam ini lambat, rentan salah tulis, dan karena setiap analis menulis join dengan cara berbeda, dua dashboard yang berbeda bisa menampilkan angka yang saling bertentangan.

**Pemodelan dimensional (Dimensional Modeling)**, yang dipopulerkan oleh Ralph Kimball, merancang struktur tabel khusus untuk *menjawab pertanyaan*. Inti dari pendekatan ini adalah memisahkan dua jenis tabel:

- **Tabel Fakta (Fact Tables)** mencatat **peristiwa atau pengukuran numerik**: satu baris pesanan terjual, satu transaksi pembayaran berhasil, satu klik tayangan halaman. Tabel fakta berukuran sangat panjang (jutaan hingga miliaran baris), didominasi angka dan kunci referensi.
- **Tabel Dimensi (Dimension Tables)** mendeskripsikan **konteks di balik peristiwa tersebut**: siapa (pelanggan), apa (produk), kapan (tanggal), di mana (toko/lokasi). Tabel dimensi berukuran relatif lebih pendek tetapi lebar, penuh kolom teks deskriptif yang dipakai untuk pemfilteran, pencarian, dan pengelompokan (GROUP BY).

Ketika tabel dimensi diletakkan mengelilingi satu tabel fakta utama, polanya menyerupai bintang, sehingga dinamakan **star schema**:

```text
            dim_date
               |
dim_customer - fact_order_items - dim_product
```

Pertanyaan bisnis pun menjadi sederhana: cukup join tabel fakta ke beberapa dimensi kecil terkait dengan definisi metrik yang seragam bagi seluruh organisasi: `SUM(line_total_idr)` dikelompokkan berdasarkan `dim_customer.tier` dan `dim_date.month`. Lebih sedikit join, risiko salah hitung berkurang drastis, dan mesin query SQL modern dapat mengoptimalkannya dengan sangat kencang.

Perancangan star schema selalu dilakukan melalui empat langkah berurutan. Melewatkan urutan ini adalah penyebab paling umum lahirnya model data yang membingungkan:

1. **Pilih proses bisnis (business process).** Pemenuhan pesanan, pembayaran, sesi web. Satu proses bisnis, satu tabel fakta (pada tahap awal).
2. **Tetapkan grain.** Apa arti representasi dari tepat satu baris di tabel fakta? ("Satu baris per item pesanan.")
3. **Pilih dimensi.** Segala hal yang mendeskripsikan baris pada tingkat grain tersebut: tanggal, pelanggan, produk.
4. **Pilih fakta (ukuran numerik / measures).** Angka-angka numerik pada grain tersebut: kuantitas, harga satuan, subtotal item.

> 🛠 **Coba sendiri (10 menit, SQL Sandbox).** Jawab "revenue per kota dan tier untuk pesanan delivered" pada tabel KopiKu yang ternormalisasi (revenue = `qty * unit_price_idr`), diurutkan dengan `ORDER BY revenue DESC`. Hitung berapa tabel yang harus Anda join dan berapa syarat `ON` yang harus benar. Lalu gambar di kertas star schema untuk pertanyaan yang sama: tabel mana yang menyimpan revenue, tabel mana yang menyimpan kota dan tier?
>
> **Seharusnya Anda melihat:** tiga tabel (`orders`, `customers`, `order_items`) dan dua join, dan baris pertama `Bandung, Gold, 455000` diikuti `Surabaya, Bronze, 365000`. Di sketsa Anda ada satu tabel fakta baris pesanan (revenue-nya) yang menunjuk ke dimensi pelanggan (kota, tier): analis menulis satu join alih-alih mengingat tiga tabel.

**Tiga tingkat model: konseptual, logis, fisik.** Sebelum langkah-langkah itu ada pertanyaan *seberapa rinci* sebuah model. Tim menggambarkan desain dalam tiga tingkat, masing-masing untuk audiens berbeda, dan melompat langsung ke `CREATE TABLE` adalah cara salah paham tertanam di dalam tabel:

| Tingkat | Menjawab | Audiens | Contoh KopiKu |
|---|---|---|---|
| **Konseptual** | Benda apa saja yang ada dan bagaimana hubungannya, dalam bahasa bisnis | Orang bisnis | "Pelanggan membuat pesanan. Pesanan berisi produk. Satu produk bisa ada di banyak pesanan." |
| **Logis** | Atribut, kunci, dan berapa banyak yang saling terkait, tanpa bergantung pada database tertentu | Engineer dan analis | `customer(customer_id, name, city, tier)`, `order(order_id, customer_id)`, dan `order_item(order_id, product_id, qty)` dengan kunci `(order_id, product_id)`: hubungan banyak-ke-banyak antara pesanan dan produk menjadi entitasnya sendiri |
| **Fisik** | Bagaimana satu engine tertentu menyimpannya: tipe, constraint, indeks, partisi | Engine dan orang yang menjalankannya | Di SQLite: uang `INTEGER` dalam rupiah, `NOT NULL`, `CHECK (qty > 0)`, foreign key. Di BigQuery: partisi per tanggal pesanan, cluster per pelanggan |

Tingkat konseptual adalah tempat kesalahan mahal ditangkap dengan murah: "bisakah satu pesanan milik dua pelanggan?" adalah obrolan dua menit di papan tulis, dan migrasi dua minggu setelah tabelnya ada. Empat langkah di atas (proses, grain, dimensi, fakta) adalah desain logis untuk analitik; satu model logis lalu bisa punya beberapa versi fisik, satu per engine.

Tingkat fisik berbeda antar-engine lebih jauh daripada yang dikira kebanyakan orang. Database aplikasi seperti SQLite atau PostgreSQL **menegakkan** kunci: baris yang salah ditolak. Cloud warehouse umumnya **tidak**: di tabel standar Snowflake, `PRIMARY KEY`, `FOREIGN KEY`, dan `UNIQUE` berstatus "optional, not enforced" (hanya `NOT NULL` dan `CHECK` yang ditegakkan), dan dokumentasi BigQuery memperingatkan bahwa "key constraints aren't enforced" dan query atas tabel yang constraint-nya dilanggar "might return incorrect results", karena optimizer memercayai kunci yang Anda deklarasikan. Di warehouse, tes di pelajaran 6 mengerjakan tugas yang di aplikasi dikerjakan constraint.

> 🛠 **Coba sendiri (15 menit, Python).** Ubah model logis di atas menjadi model fisik di SQLite dengan `sqlite3`: tabel `customers`, `products`, `orders`, dan `order_items`, dengan primary key, foreign key (`REFERENCES`), `NOT NULL`, dan `CHECK (qty > 0)`. Jalankan `PRAGMA foreign_keys = ON` lebih dulu. Masukkan 11 baris ini satu per satu dan tangkap `sqlite3.IntegrityError`: customers `(1,'Ani','Bandung','Gold')` dan `(2,'Budi','Surabaya','Bronze')`; products `(10,'Gayo')` dan `(11,'Toraja')`; orders `(100,1)`, `(101,2)`, `(102,99)`; order items `(100,10,2)`, `(100,11,1)`, `(100,10,1)`, `(101,11,-1)`. Hitung baris yang tersimpan. Lalu jalankan lagi tanpa `PRAGMA`, dan sekali lagi tanpa constraint sama sekali.
>
> **Seharusnya Anda melihat:** dengan constraint, **8** baris tersimpan dan 3 ditolak: `FOREIGN KEY constraint failed` (pesanan 102 untuk pelanggan yang tidak ada), `UNIQUE constraint failed: order_items.order_id, order_items.product_id` (produk yang sama dua kali dalam satu pesanan), dan `CHECK constraint failed: qty > 0`. Tanpa `PRAGMA`, **9** tersimpan: SQLite tidak menegakkan foreign key kecuali Anda menyalakannya, jadi pesanan yatim itu masuk diam-diam. Tanpa constraint, kesebelasnya tersimpan, dan itulah keadaan normal di warehouse. Diukur dengan SQLite 3.46; versi lama memakai kata-kata pesan yang sedikit berbeda.

:::ask Apa yang membuat star schema lebih mudah bagi analis dibanding database aplikasi yang ternormalisasi?
@options
ia menyimpan tiap fakta di banyak tabel kecil untuk hemat ruang
ia menghilangkan kebutuhan menulis JOIN sama sekali
* satu tabel fakta dengan beberapa dimensi kecil
@why
Sebuah pertanyaan menjadi satu tabel fakta plus beberapa dimensi, dengan definisi yang sama bagi setiap analis: lebih sedikit join, lebih sedikit kesalahan, dan dua dashboard yang sepakat.
:::

## @lesson Grain: kalimat paling krusial dalam pemodelan data
**Grain** adalah satu kalimat tunggal yang mendefinisikan apa makna tepat dari satu baris di dalam tabel fakta. Untuk KopiKu: *"satu baris mewakili satu item dalam pesanan: satu produk, dalam satu pesanan, pada satu harga tertentu."* Segala keputusan teknis selanjutnya diturunkan dari kalimat ini.

Mengapa kita harus sangat disiplin terhadap grain?

- **Grain menentukan dimensi mana saja yang boleh hadir.** Pada grain tingkat baris-item (order line), produk berhak ada di baris tersebut. Namun pada grain *tingkat pesanan* (satu baris mewakili keseluruhan transaksi checkout), produk tidak boleh diletakkan di sana karena satu pesanan bisa berisi banyak produk sekaligus. Jika Anda memaksakan dimensi yang tidak sesuai dengan grain, baris akan berlipat ganda secara tidak terkendali (jebakan fan-out dari Modul 0.3) atau dimensi tersebut menjadi ambigu.
- **Grain menentukan apa yang boleh dijumlahkan.** Metrik numerik (measures) hanya dapat dijumlahkan (SUM) dengan benar pada tingkat atau di atas tingkat grain miliknya sendiri. Biaya pengiriman yang dicatat satu kali per pesanan tetapi diduplikasi ke setiap baris item akan keliru besar jika dijumlahkan; simpan biaya kirim pada tabel fakta tingkat pesanan, atau alokasikan proporsinya secara eksplisit ke tiap item.
- **Grain dapat diuji secara otomatis.** Aturan "tidak boleh ada dua baris yang memiliki pasangan (order_id, line_no) yang sama" adalah tes integritas satu baris SQL yang mampu menangkap puluhan jenis bug pipa data sebelum masuk ke dashboard.

Prinsip praktis dalam menentukan grain:

- Simpan fakta pada **grain atomik terendah (lowest atomic grain)** yang memungkinkan. Data rinci selalu bisa diagregasi ke atas; namun data yang sudah terlanjur diagregasi tidak akan pernah bisa diurai kembali menjadi data rinci. (Tabel pra-agregasi berguna sebagai lapisan kedua untuk percepatan query, tetapi jangan pernah menjadikannya satu-satunya salinan data).
- **Jangan pernah mencampur grain berbeda dalam satu tabel fakta.** Tabel fakta yang mencampur baris pesanan gelondongan dan baris item detail adalah sarang malapetaka bug pelaporan.
- Tuliskan kalimat definisi grain pada bagian paling atas dokumentasi model data dan pastikan ada unit test otomatis yang memvalidasinya.

Klasifikasi tabel fakta berdasarkan cara data mengalir:

| Tipe Fakta | Satu baris mewakili... | Contoh | Sifat Pengukuran (Measures) |
|---|---|---|---|
| **Transaction** | satu kejadian sesaat | satu baris item pesanan | aditif penuh: kuantitas, nominal belanja |
| **Periodic snapshot** | status/kondisi pada interval waktu rutin | stok inventaris produk per hari | semi-aditif: saldo akhir (tidak boleh dijumlah lintas waktu) |
| **Accumulating snapshot** | siklus hidup satu proses yang diperbarui bertahap | pesanan dari dibuat, dibayar, dikirim, hingga selesai | tanggal timestamp dan durasi latensi antar-tahap |

Ukuran numerik (measures) juga dibedakan berdasarkan **kemampuan penjumlahan (additivity)**: *aditif penuh* (kuantitas, omset) dapat dijumlahkan di seluruh dimensi apa pun; *semi-aditif* (saldo rekening, stok gudang) dapat dijumlahkan lintas pelanggan tetapi keliru jika dijumlahkan melintasi dimensi tanggal; *non-aditif* (rasio, margin persentase, harga rata-rata) tidak boleh dijumlahkan sama sekali, sehingga selalu simpan pembilang dan penyebutnya secara terpisah lalu lakukan pembagian di akhir query.

:::ask Kalimat mana yang merupakan pernyataan grain yang baik untuk tabel fakta?
@options
"tabel penjualan, seluruhnya"
* "satu baris per baris pesanan: satu produk, satu harga"
"pesanan dan pelanggan dan produk"
@why
Grain menyatakan dengan tepat **apa arti satu baris**. Ia menentukan dimensi mana yang boleh ada di baris, apa yang bisa dijumlahkan, dan ia bisa diuji: "tidak ada dua baris yang berbagi (order_id, line_no) yang sama". Nama tabel atau daftar subjek tidak menyatakan apa itu satu baris.
:::

:::ask `shipping_fee_idr` disimpan sekali per pesanan, tetapi Anda menyalinnya ke setiap baris pesanan. Apa yang salah ketika Anda menjumlahkannya?
@options
tidak ada: totalnya sama
* pesanan dengan tiga baris dihitung tiga kali
jumlahnya menjadi NULL karena pengulangan
@why
Ukuran hanya dijumlahkan dengan benar pada (atau di atas) grain-nya sendiri. Menyalin nilai per pesanan ke baris yang lebih halus adalah jebakan fan-out lagi: simpan pada grain pesanan, atau alokasikan ke baris-baris secara eksplisit.
:::

:::drill sql Uji grain-nya
Tampilkan berapa pasangan `(order_id, line_no)` yang muncul **lebih dari sekali** di `order_items`, sebagai `violations`. Model dengan grain yang bersih mengembalikan 0. Kelompokkan menurut kolom grain dan simpan kelompok yang punya lebih dari satu baris.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/group\s+by/ ## Kelompokkan menurut kolom grain: order_id, line_no.
/having/ ## Simpan hanya kelompok dengan COUNT(*) > 1.
@hint
Gunakan subquery yang mengelompokkan `order_items` menurut `order_id, line_no` dan mempertahankan kelompok dengan `HAVING COUNT(*) > 1`, lalu hitung jumlah baris subquery tersebut sebagai `violations`.
@solution
SELECT COUNT(*) AS violations FROM (SELECT order_id, line_no FROM order_items GROUP BY order_id, line_no HAVING COUNT(*) > 1);
:::

> 🛠 **Coba sendiri (10 menit, SQL Sandbox).** `orders` menyimpan `shipping_fee_idr` per pesanan. Hitung total ongkir dengan dua cara: `SELECT SUM(shipping_fee_idr) FROM orders;` dan jumlah yang sama setelah join `orders` ke `order_items` pada `order_id`. Lalu nyatakan grain setiap tabel dalam satu kalimat, dan di grain mana ongkir boleh dijumlahkan.
>
> **Seharusnya Anda melihat:** `355000` lalu `470000`, yang 32% terlalu tinggi: pesanan dengan tiga baris dihitung tiga kali. Ongkir milik grain pesanan, bukan grain baris pesanan.

## @lesson Tabel dimensi: konteks deskriptif pelaporan
Satu baris dimensi mendeskripsikan satu entitas spesifik (satu produk, satu pelanggan, satu tanggal kalender) dengan deretan atribut rinci yang dipakai untuk pengelompokan dan pemfilteran: `roast_level`, `origin`, `tier`, `city`. Dimensi yang dirancang dengan baik sengaja dibuat lebar dan tidak dinormalisasi (denormalized), karena dalam analitik kita menginginkan satu kali join langsung, bukan rantai join berjenjang.

:::talk Fakta atau dimensi?
@teacher Sebuah warehouse punya dua jenis tabel. **Dimensi** menggambarkan sesuatu: siapa, apa, di mana, kapan. **Fakta** mencatat kejadian dan angka yang Anda jumlahkan: setiap penjualan, setiap klik. Ambil satu baris pesanan KopiKu: produk Gayo, dibeli Ani dari Bandung pada 12 Januari, jumlah 2, total baris Rp 90.000.
@ask Mana yang termasuk ke tabel fakta sebagai ukuran (measure)?
@choice Kota pelanggan, Bandung | Kota menggambarkan pelanggan: ia masuk ke dimensi pelanggan, sekali saja, bukan diulang di setiap baris. Coba lagi.
@choice * Total baris, Rp 90.000 | Betul. Itu angka yang Anda jumlahkan dari banyak baris, dan itulah ukuran. Siapa, apa, dan kapan menjadi kunci yang menunjuk ke dimensi.
@choice Nama produk, Gayo | Nama menggambarkan produk, jadi ia tinggal di dimensi produk. Coba lagi.
@teacher Uji cepat: "bisakah saya menjumlahkan atau merata-ratakannya?" Berarti itu ukuran untuk tabel fakta. "Apakah ini menggambarkan sesuatu?" Berarti itu atribut untuk dimensi.
:::

Pola-pola dimensi standar yang akan selalu Anda temui di industri:

- **Dimensi Tanggal (Date Dimension).** Tabel fisik nyata dengan satu baris per hari kalender (lengkap dengan tahun, bulan, nama hari, nomor minggu, kuartal, flag akhir pekan, flag hari libur nasional). Dibuat langsung dari kalender (bukan diekstrak dari transaksi yang ada), sehingga hari-hari tanpa penjualan tetap terdaftar di laporan, dan seluruh perusahaan memiliki definisi yang seragam mengenai batas kuartal fiskal. Hampir setiap tabel fakta selalu terhubung ke dimensi ini.
- **Degenerate Dimension.** Nomor identifikasi transaksi yang tidak memiliki atribut tambahan sendiri, tetapi dipertahankan langsung sebagai kolom biasa di tabel fakta: contoh klasiknya adalah `order_id`. Kolom ini memungkinkan analis mengelompokkan baris-baris item kembali ke nomor pesanan aslinya tanpa perlu membuat tabel dimensi satu kolom yang sia-sia.
- **Role-Playing Dimension.** Satu tabel dimensi yang dirujuk beberapa kali oleh tabel fakta dengan peran berbeda: `order_date`, `ship_date`, dan `delivery_date` semuanya merujuk ke tabel `dim_date` yang sama. Implementasikan melalui SQL view atau alias tabel, bukan menduplikasi tabel fisiknya.
- **Junk Dimension.** Kumpulan banyak flag ber-kardinalitas rendah (metode pembayaran, status kurir, flag bungkus kado) yang digabungkan ke dalam satu tabel dimensi kecil daripada mengotori tabel fakta dengan puluhan kolom teks.
- **Conformed Dimension.** Dimensi bersama yang digunakan oleh berbagai tabel fakta dengan definisi makna yang konsisten: `dim_customer` yang sama digunakan untuk fakta pesanan maupun fakta tiket bantuan layanan pelanggan. Dimensi bersama ini adalah jembatan yang memungkinkan perbandingan lintas proses bisnis ("rata-rata komplain per tier pelanggan dibanding frekuensi belanja"). Matriks proses bisnis terhadap dimensi bersama ini disebut **bus matrix**, peta cetak biru arsitektur enterprise data warehouse.
- **Hierarki** (produk > kategori, kota > provinsi > negara) disimpan langsung sebagai kolom dalam satu dimensi lebar tanpa perlu dinormalisasi menjadi tabel terpisah.

Perbandingan tiga pola tata letak penyimpanan data:

| Karakteristik | Star Schema | Snowflake Schema | One Big Table (OBT) |
|---|---|---|---|
| Bentuk | Tabel fakta + dimensi terdenormalisasi | Dimensi dinormalisasi ke sub-tabel bertingkat | Semua data di-join jadi satu tabel lebar raksasa |
| Jumlah Join per Query | Sedikit | Banyak | Nol (tanpa join) |
| Biaya Penyimpanan / Pembaruan | Duplikasi teks minor di dimensi | Duplikasi paling minim | Duplikasi masif, sangat mahal saat update baris |
| Kejelasan Definisi Data | Sangat tinggi (grain & key eksplisit) | Menengah | Rendah: grain menjadi kabur dan membingungkan |
| Penggunaan Standar | Model inti gudang data enterprise | Jarang digunakan saat ini | Lapisan kemudahan untuk tool BI tertentu, dibentuk **dari** star schema |

Mesin database kolumnar modern (seperti DuckDB, BigQuery, Snowflake) mengompresi data berulang dengan sangat efisien, sehingga tabel lebar (OBT) murah untuk disimpan di disk. Hal ini membuat sebagian orang tergesa-gesa menyatakan star schema sudah usang. Pernyataan tersebut mencampuradukkan format penyimpanan fisik dengan perancangan logika bisnis. Masalah mendasar OBT jika dijadikan satu-satunya model data adalah hilangnya kepastian grain, pembaruan data (misal pelanggan pindah kota) terpaksa memodifikasi miliaran baris transaksi historis, dan setiap departemen akan tergoda membuat varian OBT versinya sendiri. Perlakukan star schema sebagai model kebenaran bersama yang teruji, lalu turunkan OBT di atasnya jika alat visualisasi tertentu membutuhkannya.

:::ask "Satu tabel besar" yang sudah di-join sebelumnya adalah satu-satunya model, dan seorang pelanggan pindah kota. Apa masalahnya?
@options
* setiap baris pelanggan itu berubah dan grain tersembunyi
tidak ada: penyimpanan murah, jadi tidak apa-apa
tabelnya menjadi star schema yang benar
@why
Masalah satu tabel besar sebagai **satu-satunya** model bukan ukurannya: ia menyembunyikan grain, membuat pembaruan mahal, dan mengundang setiap tim mendefinisikan sesuatu secara berbeda. Bangun ia **dari** star sebagai lapisan kemudahan, bukan sebagai penggantinya.
:::

Di warehouse, setiap baris dimensi biasanya diberi id integer buatan warehouse yang disebut **surrogate key** (misalnya `product_sk`), sambil tetap menyimpan id asli dari sistem sumber (**natural key**, misalnya `product_id`) sebagai kolom biasa, Pelajaran 4 menjelaskan alasannya secara rinci.

:::drill sql Dimensi produk dengan surrogate key
Bangun dimensi produk kecil: `product_sk` (surrogate key: 1, 2, 3... menurut urutan `product_id`), `product_id` (natural key, disimpan sebagai kolom biasa), dan `name`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/row_number/ ## Buat surrogate key dengan ROW_NUMBER() OVER (ORDER BY product_id).
@hint
Pilih dari `products` menggunakan `ROW_NUMBER() OVER (ORDER BY product_id)` dengan alias `product_sk`, diikuti `product_id` dan `name`.
@solution
SELECT ROW_NUMBER() OVER (ORDER BY product_id) AS product_sk, product_id, name FROM products;
:::

> 💡 **Jeda Praktik 1 (Dimensi Tanggal Tanpa Celah Kalender):**
> Latih pembuatan tabel dimensi tanggal kalender:
> 1. Buka file `labs/mod-1-4/answers.sql` di editor teks Anda (atau buka SQL Sandbox di browser).
> 2. Selesaikan tantangan `d-4`: Bangkitkan 7 hari kalender tanpa celah mulai `2026-01-01` menggunakan `WITH RECURSIVE`. Hitung `date_key` integer (YYYYMMDD), `full_date`, `day_name` (nama hari dalam bahasa Inggris: `Sunday`–`Saturday`), dan flag `is_weekend` (1 untuk Sabtu dan Minggu).
> 3. Uji di terminal:
> `python3 labs/mod-1-4/check.py`
> Ketika tantangan d-4 lulus (PASS), Anda telah memahami cara membuat kalender analitik! Lanjut ke Pelajaran 4 & 5 tentang kunci dan dimensi Slowly Changing Dimensions (SCD).

## @lesson Pengelolaan kunci: surrogate key dan anggota unknown
**Natural key (business key)** berasal langsung dari sistem sumber (`customer_id`, `product_id`). **Surrogate key** adalah bilangan bulat (integer) tanpa makna bisnis yang diterbitkan sendiri oleh gudang data (`customer_sk`). Tabel fakta wajib melakukan join ke dimensi menggunakan surrogate key. Alasannya sangat mendasar:

- **Isolasi dari anomali sistem sumber.** Dua sistem aplikasi berbeda bisa menggunakan format id yang sama untuk entitas berbeda; id sumber bisa didaur ulang, diberi penomoran baru, atau berubah tipe data setelah migrasi aplikasi.
- **Memungkinkan pencatatan histori.** Ketika atribut pelanggan berubah dan versi baru dibuat (SCD Tipe 2 di bawah), satu natural key akan memiliki beberapa baris rekaman; hanya surrogate key yang dapat menentukan *versi mana* yang berlaku pada saat transaksi terjadi.
- **Performa komputasi.** Join antar-integer jauh lebih cepat dan hemat memori dibandingkan join pada string UUID atau kode alfanumerik.

Selalu pertahankan natural key asli di dalam tabel dimensi sebagai kolom biasa, sehingga silsilah data (data lineage) tetap dapat dilacak balik ke aplikasi asal.

:::talk Pelanggan yang belum ada
@teacher Pukul 09:00 seorang pelanggan membayar sebuah pesanan. Catatan pelanggannya baru dimuat ke warehouse pukul 10:00, tetapi baris pesanan dimuat pukul 09:30. Jadi baris itu tiba, dan pelanggannya belum ada di dimensi pelanggan.
@ask Apa yang terbaik dilakukan terhadap baris itu?
@choice Membuangnya sampai pelanggan tiba, lalu memuatnya lagi | Pendapatannya hilang dari setiap laporan di antara waktu itu, dan seseorang harus ingat memuatnya nanti. Coba lagi.
@choice Menyimpan NULL di kunci pelanggan | Kunci NULL lenyap dari setiap inner join, sehingga pendapatannya tetap hilang diam-diam. Coba lagi.
@choice * Menunjuknya ke baris pelanggan "unknown", lalu memperbaiki kuncinya ketika pelanggan sebenarnya tiba | Betul. Barisnya tetap bisa di-join, total tetap benar, dan celahnya terlihat: Anda bisa menghitung berapa baris yang masih bertuliskan "unknown".
@teacher Anggota unknown adalah baris nyata di dimensi, biasanya dengan kunci -1. Baris fakta selalu punya sesuatu untuk ditunjuk.
:::

**Setiap baris fakta wajib merujuk ke baris dimensi yang nyata.** Namun data dunia nyata tidak pernah ideal: transaksi pesanan tiba untuk pelanggan yang belum terdaftar di snapshot pelanggan hari itu (*late-arriving dimension*), produk dihapus di sistem sumber, atau kolom bernilai NULL. Nilai foreign key NULL adalah racun: pada operasi INNER JOIN baris fakta akan hilang tanpa peringatan dan angka omset dashboard langsung menyusut. Solusi standar industri adalah **anggota unknown (unknown member)**: baris khusus di tabel dimensi dengan nomor kunci khusus (misalnya `customer_sk = -1`, `city = 'Unknown'`) tempat tabel fakta merujuk ketika entitas aslinya tidak ditemukan. Total omset tetap akurat 100%, data yang tidak dikenal terlihat jelas di laporan (dan dapat dihitung untuk memicu peringatan otomatis tim engineering), dan ketika data dimensi susulan tiba, kunci fakta dapat diperbaiki.

Pada data lab KopiKu, terdapat 32 baris pesanan milik pelanggan yang tidak terdaftar di tabel pelanggan sumber. Dengan anggota unknown, transaksi tersebut tercatat rapi di bawah kategori tier "Unknown" dengan nilai omset Rp 5.965.000; tanpa pola ini, omset tersebut akan lenyap diam-diam dari setiap query pelaporan per tier pelanggan.

:::ask Sebuah pesanan tiba untuk pelanggan yang belum ada di ekstrak pelanggan. Tabel fakta digabung ke dimensi dengan INNER JOIN. Apa yang terjadi pada pesanan itu?
@options
ia disimpan dan tampil sebagai Unknown
* hilang diam-diam; totalnya turun
join berhenti dengan error yang jelas
@why
Baris fakta yang key-nya tidak cocok dengan baris dimensi mana pun lenyap dalam inner join, tanpa error. Perbaikan standarnya adalah **unknown member** (misalnya key -1, "Unknown") yang ditunjuk setiap fakta yatim, sehingga pendapatannya tetap terlihat dan terhitung.
:::

:::drill sql Pertahankan yang yatim
Tampilkan `order_id` setiap pesanan dan `name` pelanggannya, tetapi tampilkan `'Unknown'` ketika pelanggan tidak ada di `customers`. Setiap pesanan harus tetap ada di hasil (pemeriksa menyisipkan pesanan yatim tambahan untuk menguji `'Unknown'`). Pakai `LEFT JOIN` dan `COALESCE`.
@data kopiku
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/left\s+join/ ## Pakai LEFT JOIN supaya pesanan tanpa pelanggan tetap ada.
/coalesce/ ## Tampilkan 'Unknown' dengan COALESCE(c.name, 'Unknown').
@hint
Mulai dari `orders`, lakukan `LEFT JOIN customers` pada `customer_id`, dan bungkus kolom nama pelanggan dengan `COALESCE(..., 'Unknown')` beralias `name`.
@solution
SELECT o.order_id, COALESCE(c.name, 'Unknown') AS name FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id;
:::

> 🛠 **Coba sendiri (10 menit, Python).** Dengan file KopiKu yang sudah dibuat (jalankan `python3 labs/shared/shopgen.py --out data` lebih dulu jika folder `data/` belum ada), temukan pesanan yang `customer_id`-nya tidak ada di `data/customers.csv`, dan berapa baris pesanan milik mereka. Lalu putuskan: jika tabel fakta mewajibkan key pelanggan yang nyata, apa yang terjadi pada baris-baris itu, dan bagaimana anggota "Unknown" menyelamatkannya?
>
> **Seharusnya Anda melihat:** `16` pesanan dan `32` baris pesanan (angka yang disebut pelajaran ini). Tulis satu kalimat yang akan Anda cantumkan di dokumentasi model tentang mereka.

## @part Riwayat, kepercayaan, dan pendekatan lain

## @lesson Slowly changing dimensions: merekam kebenaran masa lalu
Pelanggan berpindah domisili, produk berganti nama kemasan, tier loyalitas diperbarui. Nilai atribut dalam dimensi berubah secara **perlahan (slowly)** seiring waktu, dan Anda harus memutuskan apa yang harus ditampilkan oleh laporan tentang masa lalu. Keputusan arsitektur inilah yang dinamakan tipe **Slowly Changing Dimension (SCD)**:

:::talk Laporan tentang tahun lalu
@teacher Ani tinggal di Jakarta sepanjang tahun lalu dan membeli banyak kopi. Pada bulan Maret ia pindah ke Bandung, dan tabel pelanggan diperbarui: kotanya sekarang tertulis Bandung.
@ask Seseorang menjalankan ulang laporan pendapatan tahun lalu per kota. Apa yang ditampilkan untuk pesanan lama Ani?
@choice * Bandung: pembaruan menimpa Jakarta, sehingga sejarah ditulis ulang | Betul. Menimpa hanya menyimpan kebenaran terbaru, jadi laporan tahun lalu diam-diam berubah setelah kepindahan. Pendapatan Jakarta menyusut, dan tidak ada yang salah pada laporannya.
@choice Jakarta, karena pesanan mengingat di mana ia tinggal | Baris pesanan hanya menunjuk ke "pelanggan 7". Kota ada di tabel pelanggan, dan tabel itu sekarang menulis Bandung. Coba lagi.
@choice Error, karena datanya berubah | Tidak ada error, dan itulah bahayanya: angkanya begitu saja berubah. Coba lagi.
@teacher Agar tahun lalu tetap benar, jangan menimpa. Tambahkan **baris baru** untuk versi yang baru, beserta tanggal berlakunya. Itulah dimensi Tipe 2.
:::

| Tipe SCD | Perilaku Saat Atribut Berubah | Histori Disimpan? | Kasus Penggunaan Ideal |
|---|---|---|---|
| **0** | Nilai terkunci permanen; abaikan perubahan | Asli permanen | Tanggal lahir, tanggal pertama kali mendaftar |
| **1** | Timpa langsung nilai lama (overwrite) | Tidak ada | Koreksi kesalahan ketik nama, perbaikan typo data |
| **2** | Tambahkan **baris baru** (versi baru); simpan baris lama | Histori penuh | Segala hal di mana laporan masa lalu tidak boleh bergeser: kota, tier, sales owner |
| **3** | Tambahkan kolom baru untuk nilai sebelumnya (`previous_city`) | Satu langkah mundur | Kebutuhan khusus perbandingan sebelum vs sesudah |
| **4 / 6** | Mini-dimension untuk atribut super dinamis / kombinasi hybrid tipe 1, 2, dan 3 | Bervariasi | Arsitektur tingkat lanjut |

Mengapa ini sangat penting? Mari kita buktikan dengan data lab: tier pelanggan berubah seiring waktu. Jika kita menghitung omset per tier **berdasarkan tier yang dimiliki pelanggan pada saat transaksi berlangsung**, omset kategori Gold bernilai Rp 97.650.000. Namun jika kita menghitung menggunakan tier **terkini** pelanggan (sebagaimana yang dihasilkan oleh penimpaan SCD Tipe 1), omset Gold melonjak menjadi **Rp 104.485.000**, selisih 7% lebih tinggi, sebanyak 444 baris pesanan milik pelanggan yang sejak itu berubah kota atau tier-nya. Angka kedua tidak salah secara matematis, tetapi telah *menulis ulang histori secara sepihak*: laporan keuangan kuartal lalu yang sudah diaudit dan ditandatangani manajemen akan menampilkan angka yang berbeda jika dibuka kembali hari ini.

**Mekanisme teknis SCD Tipe 2.** Setiap versi entitas dicatat sebagai satu baris terpisah dengan rentang waktu validitas:

| customer_sk | customer_id | city | tier | valid_from | valid_to | is_current |
|---|---|---|---|---|---|---|
| 1 | 1 | Jakarta | Silver | 2026-01-01 | 2026-01-10 | 0 |
| 2 | 1 | Jakarta | Gold | 2026-01-10 | 2026-01-20 | 0 |
| 3 | 1 | Bandung | Gold | 2026-01-20 | 9999-12-31 | 1 |

`valid_from` bersifat inklusif, sedangkan `valid_to` bersifat eksklusif dan nilainya sama persis dengan `valid_from` versi berikutnya, sehingga garis waktu tersambung rapat tanpa celah dan tanpa tumpang tindih. Tanggal masa depan yang sangat jauh (`9999-12-31 00:00:00`) untuk versi yang sedang aktif mencegah perlunya logika penanganan NULL yang rumit dalam perbandingan waktu. Anda dapat membangun dimensi ini dari feed mutasi data hanya dengan satu fungsi window SQL (`LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts)`), persis seperti tantangan d-1 di playground sandbox (catatan: `warehouse.sql` memakai timestamp ISO-8601 dengan huruf `T`, sehingga tanggal masa depannya adalah `'9999-12-31T00:00:00'`).

**Teknik as-of join.** Untuk menghubungkan transaksi fakta ke versi dimensi yang benar, lakukan join pada natural key **sekaligus** rentang tanggal transaksinya:

```sql
JOIN dim_customer c
  ON c.customer_id = o.customer_id
 AND o.order_ts >= c.valid_from
 AND o.order_ts <  c.valid_to
```

[[diagram:scd]]

Jika Anda lupa menyertakan syarat rentang tanggal dan hanya melakukan join pada `customer_id`, setiap pesanan akan terhubung ke *seluruh* versi pelanggan tersebut: pada data lab, 7.123 baris pesanan membengkak menjadi **8.552** baris, lonjakan inflasi data palsu sebesar 20%. Ini adalah varian SCD Tipe 2 dari jebakan fan-out. Rangkaian pengujian data wajib memvalidasi bahwa jumlah baris fakta tidak berubah sebelum dan sesudah join dilakukan.

**Pemuatan bertahap (incremental load) pada Tipe 2** (saat Anda tidak memiliki feed mutasi bersih, melainkan hanya snapshot harian): bandingkan setiap baris baru yang masuk dengan versi aktif saat ini pada atribut yang dilacak; jika berbeda, tutup baris aktif (`valid_to = now`, `is_current = 0`) dan masukkan baris aktif baru. Gunakan operator `IS DISTINCT FROM` alih-alih `<>` agar perubahan dari atau ke nilai NULL tetap terdeteksi, dan pastikan langkah ini bersifat idempoten. Dua komplikasi dunia nyata yang harus diantisipasi: **perubahan yang datang terlambat (late-arriving changes)** yang mengharuskan pemotongan ulang rentang tanggal di antara versi yang sudah ada, serta **event yang tiba tidak berurutan (out-of-order events)** di mana Anda wajib mengurutkan data berdasarkan waktu kejadian di sistem sumber, bukan waktu data tiba di pipeline.

### Lihat sendiri: as-of join, dan apa yang terjadi tanpa rentang waktu

Pelanggan 1 punya tiga versi di dimensi dan tiga pesanan. Perhatikan join-nya:

:::sqlsteps As-of join
@data scd_demo
@stage 1. Tiga pesanan pelanggan 1
SELECT order_id, customer_id, order_ts FROM orders_small WHERE customer_id = 1 ORDER BY order_ts
@say
Tiga fakta, tiga momen waktu.
@stage 2. Tiga versi pelanggan 1 di dimensi
SELECT customer_sk, city, tier, valid_from, valid_to FROM dim_customer WHERE customer_id = 1 ORDER BY valid_from
@say
Silver sampai 10 Januari, Gold sampai 20 Januari, lalu Gold di Bandung. Setiap versi punya rentang berlaku.
@stage 3. SALAH: join hanya pada customer_id
SELECT o.order_id, o.order_ts, d.tier, d.valid_from FROM orders_small o JOIN dim_customer d ON d.customer_id = o.customer_id WHERE o.customer_id = 1 ORDER BY o.order_id, d.valid_from
@say
3 pesanan x 3 versi = **9 baris**. Setiap pesanan cocok dengan setiap versi: penggelembungan diam-diam (jebakan fan-out versi Type 2).
@stage 4. BENAR: join pada key DAN rentang waktu
SELECT o.order_id, o.order_ts, d.tier, d.valid_from FROM orders_small o JOIN dim_customer d ON d.customer_id = o.customer_id AND o.order_ts >= d.valid_from AND o.order_ts < d.valid_to WHERE o.customer_id = 1 ORDER BY o.order_id
@say
Kembali ke **3 baris**: setiap pesanan bertemu persis versi yang benar saat itu terjadi. `valid_from` inklusif dan `valid_to` eksklusif, sehingga rentangnya menyusun garis waktu tanpa celah dan tanpa tumpang tindih.
:::

:::ask Pesanan digabung ke dimensi hanya pada `customer_id`, tanpa rentang waktu. Pelanggan 1 punya 3 pesanan dan 3 versi. Berapa baris yang keluar untuk pelanggan itu?
@options
3
6
* 9
@why
Tanpa kondisi waktu, setiap pesanan cocok dengan setiap versi pelanggannya: 3 x 3 = 9. Tes yang menegaskan "jumlah baris fakta tidak berubah setelah join" menangkap ini seketika.
:::

:::drill sql Hanya versi saat ini
Tampilkan `customer_id`, `city`, dan `tier` dari versi **saat ini** setiap pelanggan (baris yang terbuka ujungnya), diurutkan menurut `customer_id`.
@data scd_demo
@ordered
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/is_current|9999/ ## Pakai flag is_current (atau valid_to terbuka 9999-12-31).
@hint
`WHERE is_current = 1`
@solution
SELECT customer_id, city, tier FROM dim_customer WHERE is_current = 1 ORDER BY customer_id;
:::

:::drill sql Hitung fan-out
Tampilkan berapa baris **tambahan** yang dibuat join yang salah (hanya pada `customer_id`) dibandingkan jumlah pesanan: satu angka, `extra_rows` (baris join yang salah dikurangi jumlah baris `orders_small`).
@data scd_demo
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/join/ ## Hitung baris orders_small JOIN dim_customer ON customer_id.
@hint
Kurangkan dua subquery skalar `COUNT(*)`: satu menghitung hasil join `orders_small` dan `dim_customer` hanya pada `customer_id`, dikurangi satu yang menghitung `orders_small`, dengan alias `extra_rows`.
@solution
SELECT (SELECT COUNT(*) FROM orders_small o JOIN dim_customer d ON d.customer_id = o.customer_id) - (SELECT COUNT(*) FROM orders_small) AS extra_rows;
:::

:::drill sql Apa yang benar pada 15 Januari?
Tampilkan `tier` yang dimiliki pelanggan `1` pada `'2026-01-15 00:00:00'`, memakai rentang setengah terbuka (`>= valid_from AND < valid_to`).
@data scd_demo
@names
@starter
-- tulis query Anda di bawah baris ini

@check
/valid_to/ ## Pakai ujung rentang: < valid_to.
/valid_from/ ## Pakai awal rentang: >= valid_from.
@hint
Pilih `tier` dari `dim_customer` dengan `customer_id = 1` serta timestamp `'2026-01-15 00:00:00'` berada di `>= valid_from` dan `< valid_to`.
@solution
SELECT tier FROM dim_customer WHERE customer_id = 1 AND '2026-01-15 00:00:00' >= valid_from AND '2026-01-15 00:00:00' < valid_to;
:::

> 💡 **Jeda Praktik 2 (SCD Tipe 2 & As-of Join):**
> Kuasai pelacakan histori pelanggan dan join berbasis rentang waktu:
> 1. Di `labs/mod-1-4/answers.sql` (atau SQL Sandbox), selesaikan 3 tantangan SCD:
>    - `d-1`: Bangun dimensi SCD Tipe 2 dari `customer_changes` menggunakan `LEAD(effective_ts)` untuk menentukan `valid_to` dan flag `is_current`.
>    - `d-2`: Hubungkan pesanan ke tier pelanggan saat transaksi terjadi (as-of join: `order_ts >= valid_from AND order_ts < valid_to`).
>    - `d-3`: Agregasikan total omset per tier pelanggan saat transaksi dan pastikan tidak terjadi duplikasi baris fan-out.
> 2. Uji di terminal:
> `python3 labs/mod-1-4/check.py`
> Ketika semua 4 tantangan `d-1` sampai `d-4` berstatus PASS (4/4 correct), pemahaman SCD Anda sudah solid! Lanjut ke Pelajaran 6 untuk pengujian dan perakitan skema bintang.

## @lesson Menjamin keandalan model: pengujian, alat, dan implementasi modern
Model data adalah kode program dan wajib memiliki rangkaian pengujian otomatis (automated testing). Kumpulan pengujian minimum yang wajib diterapkan (dan seluruhnya diuji dalam lab ini):

- **Uji Grain**: natural key tabel fakta (`order_id, line_no`) wajib bersifat unik tanpa duplikasi dan jumlah barisnya persis sama dengan data sumber.
- **Integritas Referensial**: tidak boleh ada foreign key tabel fakta yang bernilai NULL, dan seluruh foreign key wajib eksis di tabel dimensi terkait (di sinilah anggota unknown membuktikan nilainya).
- **Rekonsiliasi Angka**: `SUM(line_total_idr)` pada tabel fakta wajib identik dengan total belanja pada tabel transaksi sumber. Jika terjadi selisih, salah satu pipeline pasti mengalami kerusakan, dan Anda wajib mengetahuinya lewat unit test sebelum menjadi bahan temuan manajemen.
- **Uji Dimensi**: surrogate key bersifat unik, rentang tanggal SCD Tipe 2 tersambung tanpa celah, dan tepat satu versi aktif (`is_current = 1`) per entitas.
- **Verifikasi logika bisnis independen**: lab ini menghitung omset per tier saat transaksi berlangsung menggunakan kalkulasi terpisah dalam bahasa Python dan membandingkan hasilnya dengan output query SQL; dua implementasi berbeda yang menghasilkan angka identik adalah bukti keandalan arsitektur.

**Posisinya dalam modern data stack.** Dalam paradigma ELT modern (Modul 2.3), data mentah mendarat di lakehouse/warehouse, model **staging** membersihkan serta menstandardisasi skema kolom (seperti tabel `stg_` di lab), dan lapisan **marts** membangun model dimensional di atasnya: tabel berawalan `dim_*` dan `fct_*`. Fitur dbt test (`unique`, `not_null`, `relationships`) memverifikasi integritas kunci secara otomatis, dan fitur dbt `snapshot` mengelola SCD Tipe 2 tanpa perlu penulisan logika merge manual. Prinsip arsitekturalnya tetap identik apa pun alat bantu yang Anda gunakan.

Metodologi alternatif lain yang layak dipahami wawasannya: **Inmon** (enterprise data warehouse ternormalisasi yang mendistribusikan data ke data mart departemen), **Data Vault** (arsitektur berbasis hub, link, dan satellite yang dirancang untuk auditabilitas ekstrem dan integrasi puluhan sumber data), serta **Semantic Layer** (definisi metrik bisnis terpusat di atas tabel analitik). Star schema Ralph Kimball tetap menjadi standar industri paling umum untuk lapisan data yang dikonsumsi langsung oleh analis bisnis.

Kesalahan umum yang wajib dihindari: mencampur aduk grain yang berbeda; menaruh teks deskriptif panjang di tabel fakta alih-alih di dimensi; membiarkan foreign key bernilai NULL; menggunakan natural key di tabel fakta sehingga histori mustahil dicatat; menjumlahkan ukuran numerik non-aditif; membuat satu dimensi untuk setiap status flag alih-alih menyatukannya ke dalam junk dimension; dan merancang tabel sebelum memahami pertanyaan bisnis apa yang ingin dijawab. Selalu mulai dari pertanyaan bisnis, rumuskan grain dalam satu kalimat tegas, dan biarkan struktur tabel mengikuti secara alami.

> 💡 **Jeda Praktik 3 (Bangun Star Schema KopiKu di warehouse.sql):**
> Waktunya membangun gudang data star schema produksi lengkap!
> 1. Buat data KopiKu jika belum ada (`python3 labs/shared/shopgen.py --out data`), lalu siapkan tabel staging di terminal:
> `python3 labs/mod-1-4/stage.py data warehouse.db`
> 2. Buka `labs/mod-1-4/warehouse.sql` di editor teks Anda.
> 3. Tulis DDL & DML untuk 4 tabel: `dim_date` (tanpa celah), `dim_product` (surrogate key), `dim_customer` (SCD Tipe 2 dengan anggota unknown `customer_sk = -1`), dan `fact_order_items` (grain item pesanan dengan as-of join).
> 4. Uji seluruh integritas skema bintang di terminal:
> `python3 labs/mod-1-4/test_lab.py -v`
> 5. Karena `test_lab.py` berjalan di `:memory:`, tulis tabel `dim_*` dan `fact_order_items` yang sesungguhnya ke file `warehouse.db` di disk (diperlukan untuk query interaktif atau Metabase di Pelajaran 8):
> `python3 -c "import sqlite3; sqlite3.connect('warehouse.db').executescript(open('labs/mod-1-4/warehouse.sql').read())"` (atau `sqlite3 warehouse.db < labs/mod-1-4/warehouse.sql`)
> Ketika ke-13 unit test berakhir dengan `ok` dan baris terakhir berbunyi `OK`, star schema KopiKu Anda telah memenuhi standar enterprise!

:::ask Tes grain pada tabel fakta ber-grain 'satu baris per item pesanan' memeriksa apa?
@options
* natural key unik dan jumlah baris cocok
bahwa setiap kolom berisi setidaknya satu NULL
bahwa dimensi punya lebih banyak baris daripada fakta
@why
Mencampur grain adalah bug pemodelan paling umum. Jika natural key tidak unik atau jumlahnya berbeda dari sumber, baris terduplikasi atau hilang, dan setiap penjumlahan menjadi salah.
:::

## @lesson Cara lain memodelkan: Inmon, Data Vault, dan satu tabel besar
> **Intinya:** Star schema bukan satu-satunya desain. **Inmon** menyimpan warehouse ternormalisasi untuk seluruh perusahaan lalu membangun star schema darinya. **Data Vault** memecah data menjadi hub, link, dan satellite agar banyak sumber yang terus berubah bisa dimuat paralel dan setiap nilai lama tetap tersimpan. **Satu tabel besar** (one big table) menggabungkan semuanya di awal demi kecepatan. Masing-masing menyelesaikan masalah yang berbeda, dan perusahaan besar sering memadukannya.

Bab 8 *Fundamentals of Data Engineering* membandingkan pendekatan-pendekatan ini. Di database lowongan TalentHub, 59% dari 1.130 lowongan data engineering menyebut pemodelan data, dan 36 di antaranya (3%) menyebut Data Vault, kebanyakan di perusahaan besar dan konsultan (NTT DATA, Accenture, B. Braun, Traveloka, Indosat), sering untuk posisi Snowflake atau Databricks.

| Pendekatan | Bentuk | Unggul dalam | Harganya |
|---|---|---|---|
| **Inmon** | Warehouse ternormalisasi (3NF, Third Normal Form, di mana tiap atribut non-kunci hanya bergantung pada kunci tabel) untuk seluruh perusahaan, dengan mart star schema per departemen yang dibangun darinya | Satu versi untuk setiap fakta, sedikit duplikasi | Banyak join; perubahan perlu koordinasi lintas perusahaan |
| **Kimball** (modul ini) | Tabel fakta dengan grain yang dinyatakan, dikelilingi dimensi | Pertanyaan yang mudah dan cepat untuk analis dan tool BI | Menyatukan banyak sumber yang berubah ke dimensi bersama butuh kerja di awal |
| **Data Vault** | Hub (business key), link (hubungan), dan satellite (atribut sepanjang waktu), dimuat insert-only | Menyerap sumber baru dan sumber yang berubah; menyimpan riwayat lengkap untuk audit | Terlalu banyak join untuk analis, sehingga biasanya dibangun star schema di atasnya |
| **Satu tabel besar** | Satu tabel lebar per grain, semuanya sudah di-join di awal | Tanpa join saat query; scan kolom yang cepat | Menyembunyikan grain yang tercampur; satu atribut yang berubah bisa berarti menulis ulang partisi raksasa |

### Di dalam Data Vault
Kimball memakai surrogate key 1, 2, 3 yang dibagikan berurutan. Dengan lima belas sumber yang dimuat bersamaan, membagikan nomor berurutan menjadi hambatan, dan pelanggan yang sama mendapat nomor berbeda di setiap sistem. Data Vault justru menurunkan setiap key dari business key itu sendiri dengan hash, sehingga setiap loader menghitung key yang sama secara mandiri. Standar Data Vault 2.0 umumnya memakai MD5; modul ini memakai SHA-256, yang cara kerjanya sama. Di pustaka standar Python, `hashlib.sha256(s.encode("utf-8")).hexdigest()` mengubah string `s` menjadi byte UTF-8 lalu mengembalikan hash SHA-256 heksadesimal sepanjang 64 karakter.

Sebelum di-hash, normalisasikan setiap masukan dengan menghapus spasi di kedua ujung lalu mengubahnya ke huruf besar, dan gabungkan key multi-bagian dengan `|`:

```text
hk_customer = SHA-256("C-101")          # key hub: customer_id yang sudah dinormalisasi
hk_link     = SHA-256("C-101|O-5001")   # key link: pelanggan dan pesanan, digabung dengan |
hash_diff   = SHA-256("BANDUNG|GOLD")   # satellite: sidik jari atribut yang dilacak
```

- **Hub** (`hub_customer`): hanya business key, hash key-nya, kapan pertama kali terlihat (`load_ts`) dan dari mana (`record_source`). Tanpa deskripsi.
- **Link** (`link_customer_order`): hubungan antar-hub. Link dirancang many-to-many, sehingga aturan bisnis yang berubah dari one-to-many menjadi many-to-many tidak merusak tabel.
- **Satellite** (`sat_customer`): atribut yang berubah sepanjang waktu, seperti kota dan tier, dengan sidik jari `hash_diff`. Satellite bersifat insert-only: baris baru hanya ditambahkan saat sidik jarinya berbeda dari baris *terakhir* pelanggan itu. Tidak ada yang ditimpa, sehingga riwayat lengkapnya tetap ada.

> 🛠 **Coba sendiri (20 menit, di terminal Anda sendiri).** Di file `~/practice/datavault.py`, tulis `build_data_vault(events, record_source="kopiku_oms")`. Setiap event adalah dict dengan `customer_id`, `order_id`, `city`, `tier`, dan `load_ts`, dan event bisa datang dengan urutan apa pun. Kembalikan dict berisi empat list dict, dengan key berikut:
> `hub_customer`: `hk_customer, customer_id, load_ts, record_source` · `hub_order`: `hk_order, order_id, load_ts, record_source`
> `link_customer_order`: `hk_link, hk_customer, hk_order, load_ts, record_source` · `sat_customer`: `hk_customer, city, tier, hash_diff, load_ts, record_source`
> Hitung hash sesuai aturan di atas: business key di-trim dan dijadikan huruf besar (simpan pula nilai `customer_id` dan `order_id` yang sudah di-trim dan berhuruf besar ke dalam `hub_customer` dan `hub_order`); key link adalah `CUSTOMER|ORDER`; `hash_diff` adalah `CITY|TIER`, keduanya di-trim dan dijadikan huruf besar. Pikirkan arti "pertama kali terlihat" saat event datang tidak berurutan, dan apa yang harus ditinggalkan di satellite oleh pelanggan yang pindah ke Bandung lalu kembali ke Jakarta.
> **Periksa:** `python3 labs/tryit/check.py 1.4-1 ~/practice` (buntu? tambahkan `--hint 1`, lalu 2 dan 3)

:::drill python Kunci sama, hash sama
Sebuah hub Data Vault dikunci oleh hash dari **business key**. Kunci harus menghasilkan hash yang sama bagaimanapun cara mengetiknya. Tulis `dv_hash(text)`: hapus spasi di kedua ujung, ubah teks menjadi huruf besar, lalu kembalikan hash SHA-256 sebagai string heksadesimal 64 karakter.
@starter
import hashlib
# tulis fungsi Anda di bawah baris ini

@check
defines("dv_hash") ## Definisikan dv_hash(text).
dv_hash("c-001") == dv_hash("  C-001 ") ## Huruf besar-kecil dan spasi di ujung tidak mengubah hash.
dv_hash("c-001") != dv_hash("c-002") ## Kunci berbeda menghasilkan hash berbeda.
len(dv_hash("c-001")) == 64 ## SHA-256 dalam heksa adalah 64 karakter.
dv_hash("c-001") == hashlib.sha256(b"C-001").hexdigest() ## Itu adalah SHA-256 dari teks bersih "C-001".
@hint
Bersihkan `text` dengan menghapus spasi di kedua ujung dan mengubahnya ke huruf besar, ubah ke byte UTF-8, lalu kembalikan hex digest SHA-256 dengan `hashlib`.
@solution
import hashlib
def dv_hash(text):
    return hashlib.sha256(text.strip().upper().encode("utf-8")).hexdigest()
:::

:::ask Apa isi tabel hub di Data Vault?
@options
semua atribut deskriptif milik pelanggan tersebut
* hanya business key, hash-nya, waktu muat, dan sumbernya
hubungan banyak-ke-banyak antara dua tabel
@why
Hub sengaja dibuat tipis: business key, hash key, kapan pertama terlihat, dan asalnya. Deskripsi ada di satellite dan hubungan ada di link.
:::

## @part Memakai model: dashboard

## @lesson Dari star schema ke dashboard: menyajikan model ke alat BI
Star schema dibangun untuk dibaca, dan sebagian besar pembacanya memakai alat BI (business intelligence). Dari 1.130 lowongan data engineering yang diukur di TalentHub (2026-07-23 sampai 2026-11-20), **36,8%** menyebut alat BI atau dashboard. Per nama: Power BI **17,6%**, Tableau **9,4%**, Looker **4,2%**, Excel **3,0%**, Metabase **1,0%**, dan Superset **0,9%**. Di banyak tim, analis yang membuat grafiknya, tetapi data engineer junior sering diminta membuat dashboard pertama juga, dan selalu menjadi orang yang dipanggil ketika angkanya tampak salah.

**Apa yang dikerjakan setiap alat BI,** apa pun namanya:

| Langkah | Apa yang terjadi | Biasanya dipegang siapa |
|---|---|---|
| Hubungkan | Alat membaca database, warehouse, atau file | Data engineer |
| Model | Tabel, relasi (kunci mana menyambung ke mana), dan **measure** (perhitungan bernama seperti pendapatan) | Data engineer atau analytics engineer |
| Bertanya | Sebuah pertanyaan menjadi grafik atau tabel | Analis |
| Dashboard | Beberapa grafik di satu halaman, dengan filter | Analis |
| Bagikan dan segarkan | Siapa boleh melihatnya, dan seberapa segar datanya | Keduanya |

Alat-alat itu berbeda di layarnya, bukan di langkah-langkah ini. Pelajari langkahnya sekali di alat mana pun, dan alat berikutnya butuh hitungan hari, bukan bulan.

**Tiga aturan yang menjaga angka dashboard tetap benar.** Ketiganya langsung dari modul ini, dan itulah yang akan ditanyakan kepada Anda ketika sebuah angka tampak salah:
1. **Agregasikan pada grain yang tepat.** Tabel fakta berisi satu baris per *baris* pesanan. "Rata-rata nilai pesanan" adalah total pendapatan dibagi jumlah *pesanan*; merata-ratakan total per baris memberi rata-rata per *baris*, angka yang berbeda dan lebih kecil.
2. **Pakai riwayat yang disimpan model.** Pendapatan per tier pelanggan harus memakai tier *pada saat pembelian* (kunci SCD Type 2 di tabel fakta, pelajaran 5), bukan tier pelanggan saat ini.
3. **Rekonsiliasi.** Setiap angka di dashboard harus sama dengan query SQL yang bisa Anda jalankan sendiri. Jika berbeda, salah satunya keliru, dan Anda perlu tahu yang mana sebelum orang lain tahu.

Dua kebiasaan lagi: tampilkan kapan data terakhir diperbarui, dan jangan pernah membandingkan hari, minggu, atau bulan yang belum selesai dengan yang sudah selesai.

**Berlatih pada model Anda sendiri dengan Metabase.** Power BI dan Tableau paling sering disebut lowongan, tetapi Power BI Desktop butuh Windows (Microsoft mencantumkan Windows 10 atau Windows Server 2016 sebagai syarat minimum). Metabase gratis, open source, dan berjalan di mana pun Docker berjalan, dan ia membaca file SQLite yang dibangun lab Anda. Pastikan lebih dulu `warehouse.db` benar-benar berisi tabel `dim_*` dan `fact_order_items` di disk (`test_lab.py` berjalan di `:memory:`, jadi tidak menulis tabel-tabel tersebut ke `warehouse.db`):

```bash
python3 labs/mod-1-4/stage.py data warehouse.db
python3 -c "import sqlite3; sqlite3.connect('warehouse.db').executescript(open('labs/mod-1-4/warehouse.sql').read())"
# atau, jika CLI sqlite3 terpasang: sqlite3 warehouse.db < labs/mod-1-4/warehouse.sql
```

Lalu jalankan Metabase dari folder yang berisi `warehouse.db` Anda (port 3001, karena situs kursus memakai 3000):

```bash
docker run -d --name metabase -p 3001:3000 -v "$PWD":/data metabase/metabase:v0.65.6.3
```

Buka `http://localhost:3001`, buat akun admin, lalu pakai **Add your data** (atau Admin settings, Databases), pilih **SQLite**, dan isi path `/data/warehouse.db`. Di menu **+ New**, **SQL query** menulis pertanyaan dalam SQL, **Question** membuatnya dengan klik, dan **Dashboard** mengumpulkan pertanyaan tersimpan di satu halaman. Diukur pada Metabase v0.65.6.3: image-nya 831 MB, siap sekitar 37 detik setelah dijalankan, membaca `warehouse.db` dengan izin file biasa, dan setiap query di bawah mengembalikan angka yang persis sama dengan SQLite. Semua yang Anda bangun tersimpan di dalam container, jadi `docker rm -f metabase` menghapusnya; `docker rmi metabase/metabase:v0.65.6.3` membebaskan ruang disk sesudahnya.

> 🛠 **Coba sendiri (30 menit, Docker dan warehouse Lab 1.4 Anda).** Bangun dashboard bernama *KopiKu sales* dengan empat pertanyaan tersimpan: pendapatan per hari (`dim_date.full_date`), pendapatan per tier pelanggan pada saat pembelian, 5 produk teratas menurut pendapatan, dan rata-rata nilai pesanan. Lalu buat dua kesalahan klasik dengan sengaja: rata-rata nilai pesanan dihitung sebagai `AVG(line_total_idr)`, dan pendapatan per tier memakai tier pelanggan *saat ini* (join `dim_customer` untuk kedua kalinya pada `customer_id` dengan `is_current = 1`).
>
> **Seharusnya Anda melihat** (dengan data hasil generator bawaan kursus dan warehouse yang lulus tes lab): total pendapatan `1208770000` selama `30` hari, hari terbaik `2026-01-25` dengan `45265000`; per tier pada saat pembelian `Bronze 840400000`, `Silver 264755000`, `Gold 97650000`, `Unknown 5965000`; produk teratas `Java Preanger medium 250g` dengan `215220000`; dan rata-rata nilai pesanan sekitar `337457`. Kedua kesalahan memberi `169700` (rata-rata per *baris*, separuh nilai sebenarnya) dan Gold `104485000`, bukan `97650000`, karena sebagian pelanggan baru menjadi Gold setelah membeli. Kedua angka yang salah itu tampak sangat wajar di grafik, dan justru karena itulah aturan 3 ada.

:::advanced Model yang sama di Power BI (tidak dijalankan kursus: butuh Windows)
Di Power BI Desktop langkah-langkahnya punya nama lain. **Get data** memuat tabel (misalnya keempat tabel yang diekspor ke CSV, masing-masing satu `SELECT *`). **Model view** adalah tempat Anda menggambar relasi, dari kunci setiap dimensi ke kunci yang cocok di tabel fakta (satu ke banyak). **Measure** ditulis dalam DAX, misalnya `Revenue = SUM(fact_order_items[line_total_idr])` dan `Avg order value = DIVIDE([Revenue], DISTINCTCOUNT(fact_order_items[order_id]))`; `DIVIDE` mengembalikan kosong, bukan error, ketika pembaginya nol. Panduan pemodelan Microsoft sendiri adalah star schema dari modul ini: ia menyarankan setiap tabel model menjadi tabel dimensi atau tabel fakta dan menulis "avoid mixing the two types together for a single table". Aturan grain, riwayat, dan rekonsiliasi di atas berlaku tanpa perubahan.
:::

:::drill python Nilai pesanan rata-rata pada grain yang benar
Tabel fakta punya satu baris per **item** pesanan: tiap item adalah `(order_id, amount)`. "Nilai pesanan rata-rata" adalah total pendapatan dibagi jumlah **pesanan**, bukan jumlah item. Tulis `avg_order_value(lines)`; untuk daftar kosong kembalikan `0`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("avg_order_value") ## Definisikan avg_order_value(lines).
avg_order_value([("o1", 10), ("o1", 20), ("o2", 30)]) == 30 ## Total 60 atas 2 pesanan (bukan 3 item): 30.
avg_order_value([("o1", 50)]) == 50 ## Satu pesanan, satu item.
avg_order_value([("a", 10), ("b", 10), ("c", 10), ("c", 10)]) == 40 / 3 ## 40 atas 3 pesanan.
avg_order_value([]) == 0 ## Tidak ada yang dirata-ratakan.
@hint
Kembalikan `0` jika `lines` kosong; jika tidak, bagi jumlah seluruh nominal item dengan banyaknya `order_id` unik (misalnya menggunakan `set`).
@solution
def avg_order_value(lines):
    if not lines:
        return 0
    total = sum(amount for _, amount in lines)
    orders = len({order_id for order_id, _ in lines})
    return total / orders
:::

:::ask Sebuah dashboard menampilkan 'nilai pesanan rata-rata' yang dihitung sebagai rata-rata `line_total_idr` pada fakta item pesanan. Apa yang salah?
@options
tidak ada: item dan pesanan adalah hal yang sama
seharusnya memakai tabel dimensi sebagai gantinya
* rata-rata item, bukan pesanan: terlalu kecil
@why
Fakta punya satu baris per item pesanan. Nilai pesanan rata-rata adalah pendapatan dibagi jumlah pesanan; merata-ratakan total item menghasilkan item rata-rata, yang lebih rendah saat pesanan punya beberapa item.
:::

## @lab Lab: membangun star schema KopiKu
Bangun data warehouse untuk KopiKu menggunakan SQL: dimensi tanggal, dimensi produk (SCD Tipe 1), dimensi pelanggan (SCD Tipe 2 lengkap dengan anggota unknown), dan tabel fakta pada grain item pesanan yang terhubung ke versi pelanggan yang valid pada saat pesanan dibuat. 13 unit test otomatis akan menguji integritas grain, referensial, rekonsiliasi nilai omset, serta verifikasi independen menggunakan script Python. Anda juga dibekali empat latihan sandbox interaktif di browser untuk melatih intuisi logika SCD.

> **Sudah menyelesaikan Jeda Praktik 1–3?** Anda sudah menyelesaikan tantangan pemanasan maupun `warehouse.sql`, langsung lompat ke **@verify** di bawah.

### @steps
1. Buat data sintetis (jika belum ada) dan periksa hasil pembersihan data oleh skrip staging:

```bash
python3 labs/shared/shopgen.py --out data
python3 labs/mod-1-4/stage.py data warehouse.db
python3 -m sqlite3 warehouse.db "select name from sqlite_master where type = 'table'"   # Python 3.12+; atau lewati: tes melakukannya untuk Anda
```

   `stage.py` memuat file CSV bersih ke dalam lima tabel `stg_`. Baca docstring di dalam file tersebut untuk melihat struktur kolom yang disediakan.
2. **Pemanasan di browser.** Buka SQL Sandbox dan selesaikan tantangan d-1 (membangun dimensi SCD Tipe 2 dari log perubahan dengan LEAD), d-2 (as-of join), d-3 (omset per tier saat transaksi), dan d-4 (dimensi tanggal dengan CTE rekursif). Konsep yang dilatihkan persis sama dengan tugas lab ini.
3. Buka file `labs/mod-1-4/warehouse.sql`. Komentar di bagian atas file adalah spesifikasi teknis: terdapat panduan kolom dan grain untuk keempat tabel yang harus Anda bangun. Tulis query DDL dan DML SQL secara bertahap, dimulai dari `dim_date` dan `dim_product`.
4. Bangun `dim_customer`. Buat versi awal pelanggan dari `stg_customers` (berlaku sejak signup) dan versi mutasi untuk setiap baris `stg_customer_changes`, kemudian hitung `valid_to` menggunakan fungsi window LEAD. Tambahkan baris khusus unknown member dengan surrogate key -1. Isi kota yang NULL dengan `'Unknown'`.
5. Bangun `fact_order_items` pada tahap akhir. Hubungkan setiap baris item ke pesanan induk dan ke versi pelanggan yang valid pada saat `order_ts` menggunakan teknik range join. Gunakan fungsi `COALESCE(..., -1)` untuk pesanan milik pelanggan tanpa profil agar tidak ada kunci bernilai NULL.
6. Jalankan pengujian otomatis (`test_lab.py` memakai pustaka bawaan Python `unittest`, jadi `python3 ...` berjalan tanpa instalasi tambahan) dan cermati pesan kegagalan jika ada; pengujian akan menunjukkan aturan data mana yang dilanggar:

```bash
python3 labs/mod-1-4/test_lab.py -v
```

7. Isi `warehouse.db` di disk. Karena `test_lab.py` berjalan di `:memory:`, jalankan skrip `warehouse.sql` Anda terhadap `warehouse.db` agar tabel `dim_*` dan `fact_order_items` yang sesungguhnya tersimpan (diperlukan untuk query interaktif atau Metabase di Pelajaran 8):

```bash
python3 -c "import sqlite3; sqlite3.connect('warehouse.db').executescript(open('labs/mod-1-4/warehouse.sql').read())"
# atau, jika CLI sqlite3 terpasang: sqlite3 warehouse.db < labs/mod-1-4/warehouse.sql
```

8. Eksplorasi model Anda dengan query analitik nyata: omset per tier per bulan, omset per profil sangrai, dan penjualan akhir pekan vs hari kerja. Kemudian, coba sengaja rusak model tersebut (misalnya dengan menghapus syarat rentang tanggal pada join pelanggan) dan amati bagaimana pengujian grain dan rekonsiliasi langsung mendeteksi kerusakan tersebut.

### @files
- labs/mod-1-4/warehouse.sql :: File kerja utama Anda: membangun empat tabel star schema :: starter
- labs/mod-1-4/stage.py :: Memuat data KopiKu yang sudah bersih ke tabel staging (disediakan) :: data
- labs/mod-1-4/test_lab.py :: 13 pengujian validasi model dan rekonsiliasi :: test
- labs/mod-1-4/answers.sql :: Tantangan sandbox dalam format file (pemanasan SCD) :: starter
- labs/mod-1-4/datasets/scd_demo.sql :: Dataset SCD Tipe 2 kecil yang dipakai sandbox dan check.py :: data
- labs/mod-1-4/check.py :: Script pemeriksa otomatis untuk latihan pemanasan :: test
- labs/mod-1-4/reference/warehouse.sql :: Solusi referensi lengkap (coba kerjakan sendiri dulu!) :: reference
- labs/mod-1-4/reference/answers.sql :: Jawaban referensi untuk empat tantangan pemanasan :: reference

### @deliverables
- Seluruh 13 unit test pada `test_lab.py` berhasil lolos (PASS)
- Seluruh empat latihan sandbox pemanasan SCD berhasil diselesaikan
- Anda mampu menjelaskan grain dari setiap tabel dalam satu kalimat tegas, dan memahami apa yang terjadi pada jumlah baris fakta jika syarat rentang waktu pada join diabaikan

### @verify
```bash
python3 labs/mod-1-4/test_lab.py -v
python3 labs/mod-1-4/check.py
python3 scripts/prove.py mod-1-4    # membutuhkan pytest (pip install pytest)
```

Bandingkan hasil kerja Anda dengan solusi referensi: `LAB_DIR=reference python3 labs/mod-1-4/test_lab.py` dan `python3 labs/mod-1-4/check.py reference`.

## @chaos Pendapatan pelanggan tier Gold yang bergeser setelah penutupan buku kuartal
### @scenario
Tim keuangan mempublikasikan laporan kuartalan resmi pada tanggal 5: pelanggan tier Gold menghasilkan omset Rp 97,7 juta. Satu bulan kemudian, dewan direksi meminta laporan kuartal yang sama untuk dipresentasikan kembali, namun angka di dashboard berubah menjadi Rp 104,5 juta. Tidak ada seorang pun analis yang mengubah query laporan tersebut. Tim data dituduh memanipulasi angka laporan keuangan.

Hal yang sebenarnya berubah: proses nightly batch pipeline menjalankan perintah `UPDATE dim_customer SET tier = s.tier FROM staging s WHERE ...` (penimpaan Tipe 1), dan selama sebulan terakhir program loyalitas menaikkan dan menurunkan tier beberapa pelanggan secara berkala.

### @cause
Dimensi menimpa langsung kolom tier pelanggan di tempat (in-place overwrite), dan query laporan melakukan join antara fakta dan dimensi berdasarkan customer key, sehingga seluruh transaksi masa lalu diberi label baru sesuai tier **terkini** pelanggan. Pelanggan yang saat bertransaksi berstatus Silver, namun minggu lalu dipromosikan menjadi Gold, menyebabkan seluruh histori belanjanya ditarik masuk ke perhitungan total Gold. Laporan tersebut konsisten secara internal pada satu titik waktu tertentu, tetapi histori masa lalunya bergeser secara liar.

Ini bukanlah bug penulisan sintaks SQL, melainkan kesalahan keputusan pemodelan arsitektur data (menerapkan Tipe 1 pada atribut yang mutlak membutuhkan Tipe 2). Tidak ada yang menyadarinya lebih awal karena tidak ada yang menanyakan: "apakah metrik resmi ini boleh berubah setelah dipublikasikan ke pemangku kepentingan?"

### @fix
1. Ubah kolom `tier` (dan `city`) menjadi **SCD Tipe 2**: simpan baris versi baru lengkap dengan `valid_from` dan `valid_to` untuk setiap perubahan data, dan hubungkan setiap fakta transaksi ke versi yang valid pada saat kejadian transaksi berlangsung.
2. Terapkan mekanisme pemuatan inkremental dengan langkah close-and-insert menggunakan operator `IS DISTINCT FROM`, dan jalankan dalam satu transaksi basis data yang idempoten agar aman saat dieksekusi berulang.
3. Rekonstruksi histori transaksi masa lalu dari log audit aplikasi sumber, sehingga perbaikan angka kuartal sebelumnya dicatat secara resmi, transparan, dan terdokumentasi.
4. Tambahkan pengujian data otomatis yang membekukan angka laporan periode tertutup dan memicu peringatan jika nilainya bergeser, serta dokumentasikan untuk setiap atribut dimensi tipe SCD apa yang dipilih beserta alasannya.

### @pattern
Tentukan secara sadar untuk setiap atribut dimensi apakah histori masa lalunya boleh berubah atau tidak. Jika jawabannya "tidak boleh", atribut tersebut wajib dimodelkan sebagai SCD Tipe 2, dan tabel fakta wajib merujuk ke versi yang berlaku pada saat kejadian.

## @quiz
### Apa yang dimaksud dengan "grain" pada tabel fakta?
- [ ] Estimasi jumlah baris yang akan ditampung tabel fakta setelah berjalan selama satu tahun penuh
- [x] Pernyataan tepat tentang apa yang diwakili satu baris, misalnya satu baris per item pesanan
- [ ] Tipe data terkecil yang mampu menampung metrik numerik pada tabel fakta tanpa overflow
- [ ] Daftar seluruh tabel dimensi yang diizinkan untuk dihubungkan dengan tabel fakta terkait

> Grain adalah kalimat definisi dasar dari satu baris. Grain menentukan dimensi dan metrik mana saja yang berhak ada di tabel tersebut dan menjadi acuan utama pengujian integritas keunikan data.

### Satu pesanan memiliki tiga item belanja. Biaya pengiriman sebesar 20.000 dicatat satu kali pada pesanan dan disalin ke setiap baris item pada tabel fakta. Apa yang terjadi jika Anda menjumlahkan biaya pengiriman tersebut?
- [ ] Totalnya akurat, karena setiap baris item membawa informasi biaya pengiriman sah yang dimiliki pesanan
- [ ] Basis data mengeluarkan error, karena metrik dari dua grain berbeda tidak boleh digabung dalam satu query
- [x] Biaya pengiriman terhitung tiga kali, karena metrik itu berada pada grain pesanan, bukan baris item
- [ ] Hanya baris item pertama yang dihitung, karena nilai duplikat otomatis diabaikan oleh fungsi SUM

> Metrik numerik hanya dapat dijumlahkan secara benar pada tingkat grain miliknya sendiri. Simpan biaya pengiriman pada tabel fakta tingkat pesanan, atau alokasikan proporsinya secara eksplisit ke tiap item.

### Seorang pelanggan berpindah domisili dari Jakarta ke Bandung. Laporan penjualan tahun lalu harus tetap mencatat transaksi tersebut di Jakarta. Tipe SCD manakah yang wajib diterapkan?
- [ ] Tipe 1, yang menimpa nama kota secara langsung dan mempertahankan laporan tahun lalu tanpa perubahan
- [ ] Tipe 0, yang menyimpan nama kota baru tepat di samping nama kota lama pada baris yang sama
- [x] Tipe 2, yang menambah baris versi baru dan mempertahankan baris lama beserta rentang validitasnya
- [ ] Tipe 3, yang menyimpan seluruh histori perpindahan kota pelanggan ke dalam satu kolom teks tambahan

> Tipe 2 mempertahankan histori penuh: baris lama (yang valid sampai waktu pindah) tetap mencatat Jakarta dan transaksi masa lalu tetap merujuk ke baris tersebut. Tipe 1 menghapus histori, sedangkan Tipe 3 hanya menyimpan satu nilai sebelumnya.

### Anda menghubungkan tabel fakta ke dimensi pelanggan SCD Tipe 2 hanya menggunakan kolom `customer_id` tanpa rentang waktu. Masalah apa yang akan terjadi?
- [ ] Tidak terjadi masalah apa pun, karena surrogate key otomatis memilih versi yang paling tepat
- [ ] Query hanya akan menampilkan versi pelanggan yang sedang aktif dan mengabaikan versi lama
- [x] Tiap baris fakta cocok dengan semua versi pelanggannya, sehingga baris dan total berlipat ganda
- [ ] Operasi join langsung gagal dengan pesan error karena dimensi memiliki beberapa baris untuk satu kunci

> Tanpa batasan rentang tanggal validitas, satu transaksi pesanan akan terhubung ke seluruh baris versi milik pelanggan tersebut, memicu pelipatgandaan data (fan-out). Pada data lab, 7.123 baris membengkak menjadi 8.552 baris.

### Mengapa tabel fakta dihubungkan ke tabel dimensi menggunakan surrogate key alih-alih natural key?
- [ ] Natural key tidak dapat diindeks, sedangkan surrogate key selalu diindeks oleh mesin database modern
- [ ] Penggunaan surrogate key diwajibkan oleh standar SQL setiap kali tabel memiliki foreign key
- [x] Memisahkan gudang data dari perubahan sistem sumber dan membuat satu entitas punya banyak versi
- [ ] Surrogate key mengenkripsi identitas sumber agar tim analis tidak dapat melihat data pribadi pelanggan

> Surrogate key melindungi gudang data dari pendaurulangan atau perubahan format id dari aplikasi sumber, dan merupakan satu-satunya cara untuk membedakan versi mana dari SCD Tipe 2 yang harus dirujuk oleh tabel fakta.

### Sebuah transaksi pesanan tiba untuk pelanggan yang belum terdaftar di tabel dimensi pelanggan. Praktik terbaik apa yang harus dilakukan?
- [ ] Hapus pesanan tersebut dari tabel fakta hingga profil pelanggan muncul, lalu muat ulang datanya
- [ ] Isi foreign key pelanggan dengan nilai NULL agar baris fakta tetap tersimpan di tabel fakta
- [x] Arahkan ke baris anggota "unknown" sementara, lalu perbaiki kuncinya saat profil pelanggan tiba
- [ ] Buat baris dimensi baru secara otomatis yang menduplikasi atribut dari pelanggan transaksi sebelumnya

> Anggota unknown memastikan seluruh transaksi fakta tetap dapat di-join tanpa menghilangkan baris dalam operasi INNER JOIN, menjaga integritas omset total, serta memungkinkan pemantauan anomali secara transparan.

### Pernyataan manakah yang paling tepat mengenai perbandingan star schema versus One Big Table (OBT)?
- [ ] Star schema sudah usang karena penyimpanan kolumnar membuat optimasi join menjadi mustahil dilakukan
- [ ] OBT selalu lebih unggul karena menghilangkan kebutuhan terhadap pengelolaan kunci dan dokumentasi
- [x] Star schema adalah model teruji dengan grain yang jelas, dan OBT idealnya diturunkan dari model itu
- [ ] Snowflake schema wajib digunakan setiap kali sebuah dimensi memiliki lebih dari sepuluh kolom atribut

> Murahnya media penyimpanan mengubah efisiensi OBT di tingkat fisik, tetapi tidak menghapus kebutuhan bisnis akan kejelasan grain dan definisi entitas tunggal. Menjadikan OBT sebagai satu-satunya model mengaburkan grain dan menyulitkan pembaruan data.

### Pasangan pengujian data manakah yang paling efektif melindungi tabel fakta baru dari kesalahan fatal yang tersembunyi?
- [ ] Uji bahwa tabel tidak kosong dan uji bahwa waktu pemuatan data berlangsung di bawah satu menit
- [x] Uji keunikan pada grain yang dideklarasikan dan rekonsiliasi total angka dengan data sumber
- [ ] Uji bahwa setiap kolom memiliki deskripsi dan uji bahwa penamaan kolom menggunakan huruf kecil
- [ ] Uji bahwa tabel memiliki indeks dan uji bahwa seluruh metrik numerik bernilai angka positif

> Uji keunikan grain mendeteksi baris yang terduplikasi atau berlipat ganda; uji rekonsiliasi mendeteksi hilangnya atau terciptanya omset fiktif. Keduanya menangkap mayoritas kesalahan logika join dan transformasi data.

### Di satellite Data Vault, kapan baris baru ditambahkan untuk seorang pelanggan?
- [ ] Setiap kali ada event untuk pelanggan itu, jadi satellite berisi satu baris per pemuatan
- [ ] Hanya saat business key berubah, karena atributnya disimpan di hub
- [ ] Sekali sehari, sebagai snapshot setiap pelanggan, ada perubahan atau tidak
- [x] Saat hash_diff atribut barunya berbeda dari baris satellite terakhir pelanggan itu

> Satellite bersifat insert-only dan menyimpan perubahan: bandingkan sidik jari baru dengan baris terakhir, bukan dengan semua baris yang pernah ada, sehingga pelanggan yang kembali ke kota sebelumnya tetap mendapat baris baru.

### Mengapa Data Vault menurunkan key dengan meng-hash business key alih-alih membagikan surrogate key 1, 2, 3?
- [x] Setiap loader menghitung key yang sama secara mandiri, sehingga banyak sumber bisa dimuat paralel
- [ ] Hash lebih pendek daripada integer, sehingga tabelnya jauh lebih hemat ruang disk
- [ ] Hash menyembunyikan customer id, sehingga vault aman dibagikan ke luar perusahaan
- [ ] Angka berurutan tidak diizinkan sebagai primary key di sebagian besar cloud data warehouse saat ini

> Membagikan nomor berurutan butuh satu penghitung pusat, yang menjadi hambatan saat sumbernya banyak dan memberi pelanggan yang sama nomor berbeda. Hash dari business key yang dinormalisasi sama di mana pun.

### Sebuah dashboard menampilkan "rata-rata nilai pesanan" sebagai `AVG(line_total_idr)` pada tabel fakta per baris pesanan. Apa yang salah?
- [ ] Tidak ada, karena setiap baris milik tepat satu pesanan sehingga rata-ratanya sama saja
- [x] Ia merata-ratakan baris, bukan pesanan: pesanan dua baris dihitung dua kali, hasilnya terlalu kecil
- [ ] Ia hanya salah jika ada pesanan yang batal, karena AVG diam-diam melewati setiap baris yang dibatalkan
- [ ] AVG tidak bisa dipakai untuk uang dalam rupiah, sehingga database membulatkan jawabannya

> Rata-rata nilai pesanan adalah total pendapatan dibagi jumlah pesanan yang berbeda. Pada warehouse KopiKu, AVG atas baris memberi 169.700 dibanding 337.457 per pesanan (pelajaran 8).

## @resources
- [Kimball Group: dimensional modeling techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [dbt docs: snapshots (Type 2 dimensions)](https://docs.getdbt.com/docs/build/snapshots)
- [SQLite: window functions (LEAD)](https://www.sqlite.org/windowfunctions.html)

