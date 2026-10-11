---
title: Cloud Data Warehouse: Cara Kerja Snowflake, BigQuery, dan Redshift
duration: 2 minggu
summary: Pahami apa yang terjadi di dalam cloud data warehouse: penyimpanan kolumnar yang dipotong menjadi micro-partition beserta statistiknya, komputasi paralel, distribusi dan join, harga berbasis pemindaian dan berbasis waktu, bulk loading, caching, dan konkurensi. Anda memodelkan setiap mekanisme dalam Python murni dan mengukur bagaimana tata letak mengubah pekerjaan yang dilakukan sebuah query.
why: Setiap lowongan menyebut Snowflake, BigQuery, atau Redshift, dan setiap bootcamp menunjukkannya dalam demo klik-klik. Tanpa memahami mekanismenya Anda tidak bisa menjelaskan mengapa satu query berbiaya sepuluh kali query lain, bagaimana menata tabel, atau bagaimana memuat data dengan benar.
---

## @outcomes
- Menjelaskan apa itu cloud data warehouse, dan apa bedanya dengan database operasional dan dengan lakehouse
- Menjelaskan micro-partition, zone map, partition pruning, dan clustering, serta mengukur bagaimana tata letak mengubah jumlah data yang dibaca sebuah query
- Menjelaskan paralelisme MPP, gaya distribusi, dan mengapa join yang co-located tidak memindahkan data
- Memperkirakan dan mengurangi biaya sebuah query pada harga berbasis pemindaian dan berbasis waktu
- Memuat data secara bulk dengan file berukuran tepat, serta menjelaskan result caching, konkurensi, dan antrean
- Membandingkan Snowflake, BigQuery, dan Redshift secara akurat, dan memilih antara warehouse dan lakehouse

## @prereq
Modul 1.4 (pemodelan dimensional), 2.1 (penyimpanan kolumnar dan Parquet), dan 3.4 (dasar FinOps) membantu. Lab ini memakai Python murni dan tidak butuh akun cloud.

## @lesson Apa itu cloud data warehouse
Database operasional (Modul 0.1) dibuat untuk membaca dan menulis beberapa baris dengan sangat cepat bagi banyak pengguna. **Data warehouse** dibuat untuk pekerjaan yang berlawanan: **memindai data dalam jumlah sangat besar dan mengagregasinya** untuk beberapa analis dan dashboard. SQL yang sama, mesin yang berbeda.

Dua gagasan membuatnya cepat, dan Anda sudah mengenal keduanya. **Penyimpanan kolumnar** (Modul 2.1) menyimpan tiap kolom bersama, sehingga query yang butuh tiga dari lima puluh kolom hanya membaca ketiganya, dan nilai yang mirip terkompresi dengan baik. **Massively parallel processing (MPP)** membagi satu query ke banyak mesin, masing-masing mengerjakan irisan datanya sendiri, lalu menggabungkan hasil parsial.

Cloud warehouse menambah gagasan ketiga: **pisahkan penyimpanan dari komputasi**. Data tinggal di object storage cloud yang murah dan tahan lama; komputasi adalah sekumpulan mesin yang Anda nyalakan, ukur, dan hentikan secara mandiri. Sepuluh tim bisa mengkueri data yang sama dengan sepuluh klaster komputasi terpisah yang tidak saling memperlambat, dan Anda membayar komputasi hanya selama berjalan. Tiga nama yang paling sering Anda temui:

| | Snowflake | BigQuery | Redshift |
|---|---|---|---|
| Komputasi | **Virtual warehouse** yang Anda ukur dan suspend | **Serverless**: Google mengalokasikan "slot" per query | Sebuah **klaster** (node RA3) atau Redshift Serverless |
| Penyimpanan | Object storage cloud, dikelola sebagai micro-partition | Penyimpanan kolumnar Google (Capacitor), dikelola | Penyimpanan terkelola (RA3) atau disk lokal |
| Tuas biaya utama | Detik waktu warehouse (credit) | Byte yang dipindai (on-demand) atau slot yang dicadangkan | Jam node, atau waktu komputasi serverless |
| Alat tata letak | Clustering key | Partitioning dan clustering | Sort key dan distribution key |

(Detail produk berubah; cek dokumentasi terkini sebelum mengandalkan sebuah detail.)

**Lakehouse** (Modul 2.2) menyimpan data dalam file terbuka seperti Parquet di object storage, dengan format tabel (Iceberg, Delta) yang menyediakan transaksi, dan membiarkan beberapa mesin mengkuerinya, termasuk DuckDB, Spark, dan semakin sering, warehouse itu sendiri (tabel eksternal atau Iceberg). Warehouse menyimpan data dalam format terkelola miliknya. Bedanya adalah siapa yang mengendalikan format data dan mesinnya; mekanisme dalam modul ini berlaku untuk keduanya.

Di mana posisinya: data mentah mendarat di object storage (Modul 2.2, 3.4), alat seperti dbt (Modul 2.3) membangun tabel yang dimodelkan di dalam warehouse, dan analis serta alat BI mengkuerinya. Semua yang Anda pelajari tentang grain, dimensi, dan fakta (Modul 1.4) adalah cara tabel-tabel itu seharusnya dibentuk.

## @lesson Cara data disimpan: micro-partition, zone map, dan pruning
Warehouse tidak menyimpan tabel sebagai satu file besar. Ia memotongnya menjadi banyak **micro-partition** (nama Snowflake; BigQuery dan Redshift punya padanannya), masing-masing memuat irisan baris dalam bentuk kolumnar, biasanya puluhan hingga ratusan megabyte. Untuk setiap partisi dan setiap kolom ia mencatat **statistik** yang murah: nilai terkecil dan terbesar, sebuah **zone map**. Ini tinggal di metadata, sehingga membacanya nyaris tanpa biaya.

Sekarang jalankan `WHERE order_date BETWEEN '2026-03-01' AND '2026-03-07'`. Untuk setiap partisi mesin memeriksa statistiknya: jika tanggal terbesar partisi itu sebelum 1 Maret, atau yang terkecil setelah 7 Maret, **tidak ada baris di dalamnya yang bisa cocok**, sehingga ia dilewati tanpa dibuka. Ini **partition pruning**, dan ia alasan terbesar mengapa query warehouse bisa menyentuh 3% tabel, bukan seluruhnya. Lab mengimplementasikannya: `build_micro_partitions`, `prune`, dan `scan`.

**Ia hanya bekerja jika nilai yang mirip disimpan bersama.** Generator di lab (`make_rows` di file tes, dipanggil di sini dengan 100.000 baris) membuat pesanan sepanjang 365 hari dalam urutan acak. Dipotong menjadi 100 partisi berisi 1.000 baris, setiap partisi berisi pesanan dari hampir setiap hari, sehingga min-nya di awal tahun dan max-nya di akhir: **semua 100 partisi cocok** dengan filter satu minggu. Urutkan baris yang sama menurut `order_date` lebih dulu lalu potong lagi: **3 partisi** cocok. Data sama, query sama, 1.874 baris hasil yang sama, **sepertigapuluh pekerjaan**. `average_overlap` di lab mengukurnya: 100,0 partisi saling tumpang tindih pada tata letak acak, 3,0 pada yang ter-cluster.

Pengurutan itulah yang dimaksud **clustering**. Di Snowflake Anda mendefinisikan **clustering key** dan layanan menjaga tabel tetap kira-kira terurut seiring data tiba. Di BigQuery Anda **mempartisi** tabel menurut kolom tanggal atau integer (partisi adalah satuan yang bisa dilewati sepenuhnya) dan **men-cluster**-nya menurut hingga empat kolom lain yang diurutkan di dalam tiap partisi. Di Redshift **sort key** mengurutkan baris di disk agar zone map bekerja. Prinsipnya sama: **pilih kolom yang paling sering Anda filter, dan jaga data terurut menurutnya**.

Aturan praktis yang mengikuti: cluster pada kolom yang muncul di `WHERE` dan `JOIN` (tanggal lebih dulu untuk data event); kolom berkardinalitas sangat tinggi (id unik) kurang baik di-cluster untuk filter rentang; dan terlalu banyak partisi mungil, seperti pada masalah file kecil di Modul 3.0, menambah overhead. Clustering membutuhkan biaya pemeliharaan, jadi ia untung pada tabel **besar** yang difilter berulang kali.

Penghematan kedua datang dari **kolom**. Di lab, memilih hanya `total` dari tabel ter-cluster menagih **24.000 byte**, dibanding **158.041** untuk kelima kolom, karena penyimpanan kolumnar hanya membaca kolom yang Anda sebut. Terhadap tata letak acak, query satu kolom yang sama menagih 800.000 byte: 33 kali lebih banyak. `SELECT *` membuang keunggulan kolumnar.

## @lesson Komputasi: kerja paralel, distribusi, dan join
**MPP.** Warehouse menyebar tabel ke banyak node komputasi (Redshift menyebut unit pekerja per node **slice**), dan setiap node memindai bagiannya sendiri secara paralel; hasilnya digabung di koordinator (leader node Redshift). Lebih banyak node berarti lebih banyak paralelisme, sampai ada sesuatu yang harus dipindahkan antar node.

**Join adalah tempat data berpindah.** Untuk me-join pesanan dan pelanggan pada `customer_id`, baris yang cocok harus bertemu di node yang sama. Jika berada di node berbeda, satu atau kedua tabel harus dikirim lewat jaringan (**shuffle**, seperti di Modul 3.0). Redshift membiarkan Anda memilih **gaya distribusi** per tabel:

- **KEY**: baris dengan nilai kolom pilihan yang sama masuk ke node yang sama (seperti `distribute(..., style="key")` di lab).
- **EVEN**: baris dibagikan round-robin; seimbang, tetapi join butuh perpindahan data.
- **ALL**: setiap node menyimpan salinan penuh; ideal untuk tabel dimensi kecil.
- **AUTO**: layanan yang memutuskan dan bisa mengubahnya seiring tabel tumbuh.

`join_rows_moved` di lab menangkap aturannya: jika kedua tabel didistribusikan menurut join key maka join-nya **co-located dan tidak memindahkan baris**; jika satu sisi adalah tabel kecil yang direplikasi (ALL), juga tidak ada baris; jika hanya satu sisi berada pada join key, sisi lainnya didistribusikan ulang; jika tidak ada, keduanya di-shuffle ulang. Karena itu tabel fakta besar didistribusikan pada join key yang paling umum dan dimensi kecil direplikasi. Snowflake dan BigQuery membuat pilihan ini otomatis, jadi Anda menyetel lebih sedikit, tetapi biaya yang sama ada di dalam mesin, dan Anda melihatnya sebagai waktu yang dihabiskan di langkah "repartition" atau "shuffle" pada query profile.

**Skew** juga muncul di sini: jika satu nilai key (pelanggan dengan separuh dari semua pesanan) jatuh di satu node, node itu mengerjakan separuh pekerjaan sementara yang lain menunggu. Cari langkah yang tidak seimbang pada query profile.

**Mengukur komputasi.** Di Snowflake sebuah **virtual warehouse** hadir dalam ukuran (X-Small, Small, Medium, ...); setiap naik satu ukuran menggandakan mesin dan credit per jam. Warehouse yang lebih besar sering menyelesaikan query berat lebih cepat dengan total biaya kurang lebih sama, tetapi tidak memberi manfaat bagi query yang sudah kecil; auto-suspend (Modul 3.4) menjaga waktu menganggur tetap murah. BigQuery mengalokasikan **slot** (satuan komputasi) per query secara otomatis, atau Anda mencadangkan jumlah tetap. Klaster Redshift provisioned diukur dalam node; Redshift Serverless menskala sesuai kebutuhan.

## @lesson Biaya: harga berbasis pemindaian dan berbasis waktu
Warehouse menagih dengan dua cara dasar, dan Anda harus tahu mana yang Anda pakai (Modul 3.4 memperkenalkan keduanya).

**Berbasis pemindaian** (BigQuery on-demand): Anda membayar per **byte yang diproses** setiap query, beberapa dolar per terabyte (cek harga terkini). `query_cost(bytes_billed, price_per_tb)` di lab adalah rumus itu. Semua dalam pelajaran 2 karenanya adalah uang: partition pruning dan pemilihan kolom memangkas byte secara langsung. Sebuah query bisa **diperkirakan sebelum dijalankan** (dry run BigQuery melaporkan byte-nya), dan batas keras bisa dipasang pada byte maksimum yang ditagih sebuah query sehingga kesalahan gagal, bukan menagih.

**Berbasis waktu** (Snowflake, Redshift, BigQuery dengan kapasitas cadangan): Anda membayar komputasi **selama ia menyala**, berapa pun yang dipindainya. Di sini penghematan dari pruning adalah *waktu*: query yang lebih cepat menahan warehouse lebih sebentar dan membiarkannya suspend lebih cepat.

Ilustrasi dengan harga contoh lab $5 per TB. Sebuah tile dashboard refresh setiap 15 menit (96 kali sehari) dan, pada tabel tanpa cluster, memindai 2 TB setiap kali: 96 × 2 × $5 = **$960 sehari**. Jika clustering dan pemilihan kolom mengurangi pemindaian menjadi 3% (seperti pengukuran lab), tile yang sama berbiaya **$28,80 sehari**. Teks query tidak berubah; tata letaknya yang berubah.

**Cache** mengurangi biaya. **Result cache** mengembalikan jawaban tersimpan ketika query yang sama dijalankan lagi dan tabel di bawahnya tidak berubah (BigQuery dan Snowflake sama-sama melakukannya untuk waktu terbatas, dan hasil cache tidak ditagih untuk pemindaian). `ResultCache` di lab memperlihatkan logikanya: key-nya adalah SQL yang dinormalisasi ditambah versi setiap tabel, sehingga perubahan pada tabel mana pun membatalkan hasil. Warehouse juga meng-cache data di node komputasi, sehingga query yang diulang lebih cepat pada kali kedua. **Materialized view** dan tabel pra-agregasi (dibangun dengan dbt, Modul 2.3) menyimpan hasil agregasi berat sehingga dashboard membaca tabel kecil, bukan memindai fakta.

Penyimpanan juga ada biayanya. **Time travel** (mengkueri atau memulihkan data pada saat sebelumnya) menyimpan data lama selama jendela retensi, yang Anda bayar penyimpanannya: bawaan Snowflake satu hari (hingga 90 pada edisi tertentu); BigQuery tujuh hari. Retensi panjang pada tabel besar yang sering ditulis ulang bisa membengkak.

## @lesson Memuat data: bulk, bukan baris demi baris
Warehouse dibuat untuk **bulk load**, bukan menyisipkan satu baris pada satu waktu seperti aplikasi. Jalur standarnya: taruh file di object storage, lalu minta warehouse memuatnya: Snowflake `COPY INTO` dari sebuah **stage** (dan Snowpipe untuk pemuatan kontinu), **load job** BigQuery dari Cloud Storage, `COPY` Redshift dari S3. Mereka membaca file secara paralel, memvalidasi, mengonversi, dan menulis micro-partition.

**Ukuran file penting.** Panduan Snowflake adalah file berukuran sekitar **100 hingga 250 MB terkompresi**, karena file yang sangat kecil menambah overhead per file (masalah file kecil lagi) dan satu file raksasa tidak bisa dibaca paralel. Panduan Redshift adalah jumlah file yang merupakan **kelipatan jumlah slice**, agar setiap slice memuat pekerjaan yang sama banyak. `plan_load_files` di lab menggabungkan keduanya: untuk pemuatan 10 GiB pada klaster dengan 16 slice ia merencanakan **48 file** berukuran sekitar 213 MiB (kelipatan 16, dan di bawah 250 MiB).

Praktik lain:

- Pilih format kolumnar terkompresi seperti **Parquet** untuk pemuatan; pakai CSV hanya bila terpaksa, dan waspadai kutipan, encoding, dan nilai kotor dari Modul 0.1.
- **Muat ke tabel staging lebih dulu**, validasi, lalu **MERGE** ke tabel akhir, sehingga pemuatan yang diulang tidak pernah membuat duplikat (idempotensi, Modul 1.2; model inkremental dbt, Modul 2.3).
- Untuk pembaruan kecil yang sering, pilih micro-batch (tiap menit) daripada streaming insert tingkat baris, yang lebih mahal dan di beberapa sistem terbatas.
- **Tabel eksternal** membiarkan warehouse mengkueri file di object storage tanpa memuatnya (Redshift Spectrum, tabel eksternal BigQuery, tabel eksternal dan Iceberg Snowflake): fleksibel, tetapi biasanya lebih lambat daripada data yang dimuat karena tidak ada statistik warehouse dan tidak ada clustering.
- **Unloading** (`COPY INTO` ke bucket, `UNLOAD`, `EXPORT DATA`) menulis hasil query kembali ke object storage untuk sistem lain.

Catat **dari mana setiap pemuatan berasal dan kapan**: nama file, id pemuatan, jumlah baris, dan baris yang ditolak. Merekonsiliasi jumlah antara sumber dan warehouse (Modul 2.5) adalah pemeriksaan kualitas data termurah yang ada.

## @lesson Konkurensi, tata kelola, dan memilih
**Konkurensi.** Warehouse punya komputasi terbatas. Ketika query yang datang lebih banyak daripada yang bisa dijalankan sekaligus, sisanya **mengantre**. `simulate_queue` di lab memperlihatkannya: lima job 10 detik pada dua slot selesai pada detik 10, 10, 20, 20, dan 30, jadi pengguna terakhir menunggu 20 detik sebelum job-nya bahkan mulai. Obatnya sama di mana-mana: isolasi beban kerja pada komputasi terpisah (satu warehouse untuk ETL, satu untuk dashboard, satu untuk analis), pakai fitur multi-cluster atau auto-scaling untuk lonjakan, dan perpendek query berat dengan alat tata letak di atas. Isolasi juga membuat tagihan bisa dibebankan ke sebuah tim (Modul 3.4).

**Tata kelola.** Data engineer mengatur akses, bukan hanya tabel. Bagian-bagian umumnya: **role** dengan hak akses yang diberikan kepada role, bukan kepada orang (hierarki role Snowflake, IAM BigQuery, grup dan role Redshift); **column masking** dan **row access policy** agar analis melihat email yang disamarkan atau hanya baris wilayahnya; **enkripsi** saat disimpan dan dikirim (warehouse menanganinya; Anda mengelola kebijakan key); dan **audit log** tentang siapa mengkueri apa. Data pribadi butuh perhatian ekstra (Modul 3.5, permintaan penghapusan).

Dua fitur yang akan Anda dengar: **zero-copy cloning** (Snowflake) membuat salinan tabel atau database sebagai metadata, yang hanya memakan penyimpanan untuk perubahan, ideal untuk lingkungan uji; dan **secure data sharing** membiarkan akun lain mengkueri data Anda tanpa menyalin.

**Memilih.** Tidak ada pemenang universal. Ringkasan yang adil:

| | Kekuatan | Waspadai |
|---|---|---|
| **Snowflake** | Mudah dijalankan, isolasi kuat dengan virtual warehouse, lintas cloud, berbagi data | Kontrol biaya butuh disiplin (warehouse menganggur, ukuran) |
| **BigQuery** | Tanpa server, kuat untuk pemindaian sangat besar, terintegrasi erat dengan Google Cloud | Kejutan biaya berbasis pemindaian; partisi dan cluster dengan benar |
| **Redshift** | Integrasi AWS mendalam, biaya terprediksi pada beban stabil | Lebih banyak penyetelan (distribution dan sort key), ukuran klaster |
| **Lakehouse** (Spark, Trino, DuckDB pada Iceberg/Delta) | Format terbuka, tanpa lock-in, satu salinan data untuk banyak mesin | Lebih banyak yang dioperasikan sendiri, fitur tata kelola bawaan lebih sedikit |

Dalam praktik, pilihan sering ditentukan oleh penyedia cloud perusahaan dan kontrak yang ada. Yang berpindah di antara semuanya adalah yang Anda pelajari di sini: **tata letak** (pruning), **byte dan waktu** (biaya), **perpindahan** (distribusi dan shuffle), **bulk loading**, dan **isolasi**.

Pertanyaan yang kini bisa Anda jawab: "Mengapa query ini mahal?" (ia memindai banyak partisi atau kolom; lihat partisi yang dipindai dan byte yang ditagih). "Bagaimana membuatnya lebih murah?" (filter pada kolom clustering atau partisi, pilih hanya kolom yang perlu, pra-agregasi). "Apa beda harga Snowflake dan BigQuery?" (waktu komputasi versus byte yang dipindai). "Mengapa ukuran file 100 hingga 250 MB?" (paralelisme tanpa overhead per file).

## @lab Lab: bagaimana warehouse menghemat pekerjaan
Modelkan mekanisme modul ini dalam Python murni: micro-partition dengan zone map, pruning dan pemindaian, ukuran kualitas clustering, biaya query, gaya distribusi dan perpindahan data join, perencanaan bulk load, result cache, dan antrean query konkuren. Tesnya (42) memeriksa setiap aturan, dan memungkinkan Anda mereproduksi pengukuran kunci: query yang sama memindai 100 dari 100 partisi pada data acak dan sekitar 3 dari 100 pada data ter-cluster.

### @steps
1. Baca `labs/mod-2-6/warehouse_lab.py` dari atas ke bawah. `value_bytes` sudah disediakan; yang lain punya docstring yang merupakan spesifikasi dan menyebut pelajarannya.
2. Kerjakan sesuai urutan file dan jalankan tes setelah SETIAP fungsi:

```bash
pytest labs/mod-2-6/test_lab.py -v
pytest labs/mod-2-6/test_lab.py -v -k "Prune or Scan"          # satu kelompok pada satu waktu
```

3. **Partisi dulu.** Tulis `build_micro_partitions` dan cetak `min` dan `max` kolom `order_date` untuk tiga partisi pertama pada tata letak acak dan yang ter-cluster. Katakan dengan lantang mengapa yang satu bisa dilewati dan yang lain tidak.
4. **Scan dan biaya.** Setelah `scan` lulus, jalankan pada kedua tata letak dengan filter satu minggu dan dengan satu kolom dan lima kolom. Tulis keempat angka (partisi dipindai, byte ditagih) dalam tabel, dan hitung biaya dolarnya dengan `query_cost`.
5. **Distribusi.** Tebak `join_rows_moved` untuk lima kombinasi distribusi sebelum Anda mengimplementasikannya, lalu bandingkan dengan tes.
6. **Pemuatan, caching, dan antrean.** Rencanakan file untuk pemuatan 10 GiB pada 16 slice, lalu ubah jumlah slice menjadi 12 dan 20 dan tebak jumlah file.
7. **Kerjakan yang sesungguhnya.** Setelah Modul 0.2, tulis kodenya lagi di venv Anda sendiri **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-2-6` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-2-6/warehouse_lab.py :: File kerja Anda: implementasikan fungsi TODO dan ResultCache :: starter
- labs/mod-2-6/test_lab.py :: Ke-42 tes yang memeriksa pekerjaan Anda :: test
- labs/mod-2-6/requirements.txt :: pytest :: config
- labs/mod-2-6/reference/warehouse_lab.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 42 tes lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri**
- Anda bisa menjelaskan, dengan angka hasil ukuran Anda sendiri, mengapa clustering mengubah partisi yang dipindai dan byte yang ditagih
- Anda bisa menjelaskan apa itu join co-located dan mana dari lima kombinasi distribusi yang butuh perpindahan data terbanyak
- Anda bisa menjelaskan cara menentukan ukuran file pemuatan dan mengapa jumlah file harus sesuai dengan jumlah slice

### @verify
```bash
pytest labs/mod-2-6/test_lab.py -v
python3 scripts/prove.py mod-2-6
```

Jalankan yang diketahui benar: awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Dashboard yang memindai seluruh tabel setiap lima belas menit
### @scenario
Dashboard eksekutif sebuah perusahaan punya dua belas tile, masing-masing didukung query pada tabel events 20 TB di warehouse berharga pemindaian. Tabel dimuat sesuai urutan event tiba dan tidak dipartisi. Setiap tile memfilter "7 hari terakhir" dan menampilkan dua kolom, tetapi query ditulis `SELECT * FROM events WHERE event_date >= ...` oleh seorang analis yang menyalin template, dan dashboard di-refresh setiap 15 menit.

Tidak ada yang lambat, karena warehouse-nya besar, jadi tidak ada yang menyadarinya selama sebulan. Lalu bagian keuangan bertanya mengapa tagihan warehouse menjadi tiga kali lipat. Item termahal dalam riwayat query adalah dua belas query dashboard itu sendiri, masing-masing ditagih karena memindai sebagian besar tabel di setiap refresh.

### @cause
Tiga kesalahan tata letak dan query saling mengalikan. Tabel tidak **dipartisi atau di-cluster menurut `event_date`**, sehingga filter tanggal tidak bisa memangkas partisi (tata letak acak di lab memindai 100 dari 100 partisi; yang ter-cluster 3 dari 100). `SELECT *` membaca **semua kolom**, bukan dua yang dibutuhkan (kelima kolom di lab ditagih 6,6 kali byte satu kolom). Dan **laju refresh** mengulang pemborosan itu 96 kali sehari. Dengan harga contoh lab, tile yang memindai 2 TB per refresh berbiaya 96 × 2 × $5 = $960 sehari; pada 3% dari itu berbiaya $28,80.

Tidak ada yang melihatnya lebih awal karena dashboard berfungsi dan cepat; biaya hanya terlihat di faktur bulanan, tanpa anggaran atau alert per query (Modul 3.4).

### @fix
1. **Partisi tabel menurut `event_date` dan cluster menurut kolom filter paling umum**, lalu verifikasi dengan query plan bahwa partisi yang dipindai turun menjadi beberapa persen.
2. Ganti `SELECT *` dengan kolom yang dibutuhkan, dan tetapkan kebijakan: lint query saat review, dan **wajibkan filter partisi** pada tabel besar sehingga query tanpa filter gagal, bukan menagih (`require_partition_filter` BigQuery).
3. Taruh **tabel ringkasan** (misalnya hitungan harian per jenis event, dibangun dengan dbt) di belakang dashboard, sehingga tile membaca ribuan baris, bukan terabyte, dan turunkan laju refresh bila datanya tidak berubah.
4. Andalkan **result caching** dan cache bawaan alat BI untuk query yang identik.
5. Tambahkan **anggaran dan batas byte per query**, kelompokkan query per dashboard dengan label atau tag, dan tinjau sepuluh query termahal setiap minggu.

### @pattern
Di warehouse, biaya adalah jumlah data yang disentuh sebuah query. Tata letak, pilihan kolom, dan laju refresh yang menentukannya, bukan kecerdikan SQL-nya.

## @quiz
### Mengapa warehouse bisa melewati sebagian besar partisi untuk `WHERE order_date BETWEEN '2026-03-01' AND '2026-03-07'`?
- [ ] Ia menyimpan index setiap id pesanan dan memakainya untuk menemukan data tujuh hari itu secara langsung
- [ ] Ia menghapus tanggal lain dari tabel selama query berjalan, sehingga hanya tersisa satu minggu
- [x] Setiap partisi menyimpan tanggal min dan max, jadi partisi yang tak mungkin cocok tidak dibuka
- [ ] Ia mengompresi tiap hari ke filenya sendiri, dan file hari lain diabaikan oleh sistem file

> Zone map (min dan max per partisi dan kolom) memungkinkan mesin membuktikan bahwa sebuah partisi tidak berisi yang cocok. Ini hanya bekerja baik jika data di-cluster menurut kolom filter.

### Query yang sama memindai 100 dari 100 partisi pada satu tata letak dan 3 dari 100 pada yang lain. Apa yang paling mungkin berbeda?
- [ ] Tata letak pertama memakai format file lebih cepat yang perlu membaca lebih banyak partisi agar lebih cepat
- [x] Tata letak kedua di-cluster menurut kolom filter, jadi nilai yang mirip berada di partisi yang sama
- [ ] Tata letak kedua punya lebih sedikit baris, karena pruning hanya berlaku bila tabelnya sangat kecil
- [ ] Tata letak pertama terkompresi, dan partisi terkompresi selalu harus dibaca penuh

> Urutan acak memberi setiap partisi rentang min-max yang lebar, sehingga semuanya beririsan dengan filter. Mengurutkan menurut kolom filter membuat rentang sempit dan sebagian besar tidak beririsan.

### Mengapa `SELECT *` sering jauh lebih mahal daripada memilih dua kolom di warehouse kolumnar?
- [ ] Warehouse mengonversi setiap kolom menjadi teks sebelum mengembalikan baris ke aplikasi klien
- [x] Penyimpanan kolumnar hanya membaca kolom yang Anda sebut, jadi `SELECT *` membayar byte setiap kolom
- [ ] `SELECT *` tidak bisa memakai result cache, yang membuat setiap query menghitung ulang datanya dari sumber
- [ ] Hasil yang lebar selalu dikirim ke klien lewat koneksi jaringan yang lebih lambat daripada yang sempit

> Di lab, satu kolom ditagih 24.000 byte dibanding 158.041 untuk lima kolom pada tabel ter-cluster yang sama.

### Dua tabel besar di-join pada `customer_id`. Pengaturan mana yang memindahkan baris paling sedikit lewat jaringan?
- [ ] Kedua tabel disebar merata secara round-robin, sehingga setiap node mendapat jumlah baris yang sama
- [ ] Kedua tabel didistribusikan menurut `order_id`, karena ia key unik yang ada di keduanya
- [x] Kedua tabel didistribusikan menurut `customer_id`, jadi baris yang cocok sudah ada di satu node
- [ ] Kedua tabel direplikasi ke setiap node, karena salinan selalu lebih murah daripada tata letak lain

> Join co-located tidak memindahkan apa pun. Mereplikasi dimensi kecil juga membantu, tetapi salinan tabel besar di mana-mana memakan penyimpanan dan waktu pemuatan.

### Apa arti bahwa cloud warehouse memisahkan penyimpanan dari komputasi?
- [ ] Data disimpan di pusat data berbeda untuk setiap pengguna, dan tiap pengguna membayar penyimpanan terpisah
- [ ] Warehouse bisa menyimpan data tetapi tidak bisa menjalankan query, jadi produk lain harus dipasang untuk mengkuerinya nanti
- [x] Data berada di penyimpanan bersama yang murah, sementara klaster komputasi dinyalakan, diukur, dan dihentikan sendiri
- [ ] Komputasi selalu berjalan di mesin yang sama dengan data, itu sebabnya query tidak butuh jaringan sama sekali

> Klaster komputasi independen bisa mengkueri data yang sama tanpa saling memperlambat, dan Anda membayar komputasi hanya saat berjalan.

### Mengapa merencanakan file bulk load sekitar 100 hingga 250 MB, dan jumlah file yang sesuai dengan slice?
- [ ] File yang lebih besar ditolak setiap warehouse, dan file yang lebih kecil sama sekali tidak bisa dikompresi
- [x] Ia menyeimbangkan overhead per file dengan paralelisme, dan memberi tiap loader pekerjaan yang sama banyak
- [ ] Ukuran file menentukan clustering key, dan jumlah file menentukan harga per terabyte yang disimpan
- [ ] Warehouse hanya bisa membaca satu file pada satu waktu, jadi banyak file diperlukan agar pemuatan maju

> File mungil menambah overhead (masalah file kecil); satu file raksasa tidak bisa dimuat paralel; jumlah yang merupakan kelipatan slice menjaga semuanya sibuk.

### Result cache mengembalikan jawaban tersimpan untuk query yang diulang. Kapan ia TIDAK boleh dipakai?
- [ ] Ketika teks query memakai huruf kapital, bukan huruf kecil, pada kata kuncinya
- [ ] Ketika dua analis menjalankan query itu berturutan di warehouse yang sama dalam beberapa menit
- [x] Ketika tabel mana pun yang dibaca query itu sudah berubah sejak jawaban tersebut disimpan
- [ ] Ketika query mengembalikan lebih dari sepuluh baris ke aplikasi klien yang memintanya

> Key cache adalah SQL yang dinormalisasi ditambah versi setiap tabel yang dibacanya. Tabel yang berubah mengubah key-nya, sehingga jawaban lama tidak dipakai lagi.

### Lima query 10 detik tiba bersamaan pada dua slot. Kapan yang terakhir selesai, dan apa obat standar untuk antrean panjang?
- [ ] Pada detik 10; tidak perlu obat, karena setiap warehouse menjalankan semua query secara bersamaan
- [ ] Pada detik 50; obatnya membeli satu query lebih besar yang menjalankan kelima job dalam satu batch
- [x] Pada detik 30; isolasikan beban kerja, skalakan keluar untuk lonjakan, dan perpendek query berat
- [ ] Pada detik 20; obatnya menghapus hasil lama, karena antrean disebabkan penyimpanan yang penuh

> Dua slot menjalankan dua job pada satu waktu: 10, 10, 20, 20, 30 detik. Isolasi, auto-scaling, dan tata letak yang lebih baik mengurangi waktu tunggu.

## @resources
- [Dokumentasi Snowflake: micro-partition dan data clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [Dokumentasi BigQuery: tabel berpartisi dan ter-cluster](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [Dokumentasi Amazon Redshift: gaya distribusi](https://docs.aws.amazon.com/redshift/latest/dg/c_choosing_dist_sort.html)
- [Dokumentasi Snowflake: menyiapkan file data untuk dimuat](https://docs.snowflake.com/en/user-guide/data-load-considerations-prepare)
- [Amazon Redshift: praktik terbaik memuat data](https://docs.aws.amazon.com/redshift/latest/dg/c_loading-data-best-practices.html)
- [BigQuery: memperkirakan dan mengendalikan biaya](https://cloud.google.com/bigquery/docs/best-practices-costs)
