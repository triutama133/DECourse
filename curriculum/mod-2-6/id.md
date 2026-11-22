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

## @part Cara kerja warehouse

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

> 🛠 **Coba sendiri (10 menit, Python).** Pakai lagi `orders.parquet` dari Modul 2.1 (atau buat lagi dengan `df.to_parquet`). Dari metadatanya, ambil `total_compressed_size` setiap kolom dan hitung porsi byte yang dibutuhkan `SELECT status, SUM(total_idr) ... GROUP BY status`. Anggap tabel aslinya 2 TB dengan harga $5 per TB, lalu cetak biaya satu kali menjalankan query itu dibanding `SELECT *`, dan biaya per hari jika sebuah tile dashboard menjalankannya 96 kali.
>
> **Seharusnya Anda melihat:** porsi `9.1%`, jadi `0.181 TB` yang dipindai: sekitar `$0.91` per run dan `$87` per hari, dibanding `$10` per run dan `$960` per hari untuk `SELECT *`. "Dry run" sebuah warehouse menghitung perkiraan ini dari metadata sebelum menjalankan apa pun. (BigQuery menagih ukuran kolom yang tidak terkompresi, bukan byte terkompresi yang Anda pakai di sini, tetapi idenya sama.)

## @lesson Cara data disimpan: micro-partition, zone map, dan pruning
Warehouse tidak menyimpan tabel sebagai satu file besar. Ia memotongnya menjadi banyak **micro-partition** (nama Snowflake; BigQuery dan Redshift punya padanannya), masing-masing memuat irisan baris dalam bentuk kolumnar, biasanya puluhan hingga ratusan megabyte. Untuk setiap partisi dan setiap kolom ia mencatat **statistik** yang murah: nilai terkecil dan terbesar, sebuah **zone map**. Ini tinggal di metadata, sehingga membacanya nyaris tanpa biaya.

Sekarang jalankan `WHERE order_date BETWEEN '2026-03-01' AND '2026-03-07'`. Untuk setiap partisi mesin memeriksa statistiknya: jika tanggal terbesar partisi itu sebelum 1 Maret, atau yang terkecil setelah 7 Maret, **tidak ada baris di dalamnya yang bisa cocok**, sehingga ia dilewati tanpa dibuka. Ini **partition pruning**, dan ia alasan terbesar mengapa query warehouse bisa menyentuh 3% tabel, bukan seluruhnya. Lab mengimplementasikannya: `build_micro_partitions`, `prune`, dan `scan`.

**Ia hanya bekerja jika nilai yang mirip disimpan bersama.** Generator di lab (`make_rows` di file tes, dipanggil di sini dengan 100.000 baris) membuat pesanan sepanjang 365 hari dalam urutan acak. Dipotong menjadi 100 partisi berisi 1.000 baris, setiap partisi berisi pesanan dari hampir setiap hari, sehingga min-nya di awal tahun dan max-nya di akhir: **semua 100 partisi cocok** dengan filter satu minggu. Urutkan baris yang sama menurut `order_date` lebih dulu lalu potong lagi: **3 partisi** cocok. Data sama, query sama, 1.874 baris hasil yang sama, **sepertigapuluh pekerjaan**. `average_overlap` di lab mengukurnya: 100,0 partisi saling tumpang tindih pada tata letak acak, 3,0 pada yang ter-cluster.

Pengurutan itulah yang dimaksud **clustering**. Di Snowflake Anda mendefinisikan **clustering key** dan layanan menjaga tabel tetap kira-kira terurut seiring data tiba. Di BigQuery Anda **mempartisi** tabel menurut kolom tanggal atau integer (partisi adalah satuan yang bisa dilewati sepenuhnya) dan **men-cluster**-nya menurut hingga empat kolom lain yang diurutkan di dalam tiap partisi. Di Redshift **sort key** mengurutkan baris di disk agar zone map bekerja. Prinsipnya sama: **pilih kolom yang paling sering Anda filter, dan jaga data terurut menurutnya**.

Aturan praktis yang mengikuti: cluster pada kolom yang muncul di `WHERE` dan `JOIN` (tanggal lebih dulu untuk data event); kolom berkardinalitas sangat tinggi (id unik) kurang baik di-cluster untuk filter rentang; dan terlalu banyak partisi mungil, seperti pada masalah file kecil di Modul 3.0, menambah overhead. Clustering membutuhkan biaya pemeliharaan, jadi ia untung pada tabel **besar** yang difilter berulang kali.

:::advanced DDL produksi untuk BigQuery, Snowflake, dan Redshift
**DDL Produksi Berdampingan: Mendeklarasikan Partisi, Clustering, dan Sort Key di Cloud Warehouse Nyata.** Dalam pekerjaan sehari-hari, Anda mendeklarasikan tata letak fisik ini melalui SQL DDL (atau di dalam blok `config(...)` model dbt Anda). Bandingkan bagaimana tabel `fct_orders` yang sama persis dideklarasikan di ketiga cloud data warehouse utama:

```sql
-- 1. Google BigQuery: Partisi per tanggal (1 kolom) + Cluster hingga 4 kolom
--    require_partition_filter = TRUE menolak query apa pun yang lupa menulis WHERE order_date ...
CREATE TABLE analytics.fct_orders (
  order_id      STRING,
  customer_id   STRING,
  order_date    DATE,
  status        STRING,
  net_total_idr INT64
)
PARTITION BY order_date
CLUSTER BY status, customer_id
OPTIONS (
  require_partition_filter = TRUE,
  partition_expiration_days = 1095
);

-- 2. Snowflake: Semua tabel otomatis dipotong menjadi micro-partition (masing-masing 50 sampai 500 MB data tak terkompresi, disimpan terkompresi);
--    tambahkan CLUSTER BY pada tabel multi-TB agar background service menjaga zone map tetap rapat
CREATE TABLE analytics.fct_orders (
  order_id      VARCHAR,
  customer_id   VARCHAR,
  order_date    DATE,
  status        VARCHAR,
  net_total_idr NUMBER(18, 0)
)
CLUSTER BY (order_date, status);

-- Periksa kedalaman tumpang-tindih (overlap) clustering Snowflake (persis seperti average_overlap di lab kita!):
SELECT SYSTEM$CLUSTERING_INFORMATION('analytics.fct_orders', '(order_date, status)');

-- 3. Amazon Redshift: DISTKEY menempatkan baris join di node yang sama; SORTKEY mengurutkan zone map di disk
CREATE TABLE analytics.fct_orders (
  order_id      VARCHAR(64)   ENCODE zstd,
  customer_id   VARCHAR(64)   ENCODE zstd,
  order_date    DATE          ENCODE az64,
  status        VARCHAR(32)   ENCODE bytedict,
  net_total_idr BIGINT        ENCODE az64
)
DISTSTYLE KEY DISTKEY (customer_id)
COMPOUND SORTKEY (order_date, status);
```

Penghematan kedua datang dari **kolom**. Di lab, memilih hanya `total` dari tabel ter-cluster menagih **24.000 byte**, dibanding **158.041** untuk kelima kolom, karena penyimpanan kolumnar hanya membaca kolom yang Anda sebut. Terhadap tata letak acak, query satu kolom yang sama menagih 800.000 byte: 33 kali lebih banyak. `SELECT *` membuang keunggulan kolumnar.
:::

> 💡 **Jeda Praktik 1 (Micro-Partisi, Zone Map & Partition Pruning):**
> 1. Buka teks editor Anda (VS Code / Cursor), lalu buka file `labs/mod-2-6/warehouse_lab.py` (ingat: jangan mengeksekusi file `.py` langsung di bash terminal tanpa interpreter atau argumen).
> 2. Implementasikan fungsi `build_micro_partitions(rows, target_rows, cluster_key=None)` untuk memotong baris data dan mencatat nilai min/max tiap kolom.
> 3. Implementasikan fungsi `prune(partitions, column, low, high)` yang memangkas partisi berdasarkan zone map, serta fungsi `scan(...)` yang membaca kolom tertentu dari partisi terpilih.
> 4. Uji di terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestMicroPartitions or TestPrune or TestScan" -v`
> 5. **Indikator Sukses:** Sebanyak 17 tes lulus mengonfirmasi bahwa kueri hanya menyentuh partisi yang relevan dan hanya membaca byte kolom yang diminta.

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

:::advanced Membaca query profile warehouse
**Cara Membaca Query Profile di Cloud Warehouse (4 Bottleneck Produksi Utama).** Saat sebuah query warehouse berjalan 8 menit atau menghabiskan $50, jangan menebak-nebak—buka **Query Profile** (Snowflake *Query Profile*, BigQuery *Execution Details*, Redshift `SVL_QUERY_SUMMARY` / `EXPLAIN`). Setiap Senior Data Engineer langsung memeriksa empat indikator ini:

| Gejala di Query Profile | Apa yang Terlihat di Graf Eksekusi | Akar Masalah | Solusi Produksi |
|---|---|---|---|
| **1. Partition Pruning Gagal** | `Partitions scanned: 4,820 / 4,850` (99,4%) | Memfilter kolom yang tidak di-cluster, atau membungkus kolom partisi dengan fungsi (`WHERE DATE(event_ts) = ...` atau `MERGE` tanpa filter partisi) | Tulis ulang predikat menjadi kolom partisi murni (`event_ts >= ... AND event_ts < ...`) atau cluster tabel pada kunci filter |
| **2. Spill ke Disk / S3 (Local / Remote Spill)** | `Bytes spilled to local storage: 48 GB` / `Bytes spilled to remote storage: 190 GB` | Operasi `GROUP BY`, `COUNT(DISTINCT)`, atau `ROW_NUMBER() OVER (...)` melampaui RAM worker sehingga membuang state sementara ke SSD dan S3! | Pangkas kolom/baris sebelum window/join, pecah menjadi dua tahap, atau naikkan ukuran warehouse sementara (`Small -> Large`) khusus untuk transformasi berat tersebut |
| **3. Ledakan Network Broadcast / Shuffle** | `Repartition / Broadcast: 78% waktu eksekusi`, miliaran baris dikirim lewat jaringan | Men-join dua tabel besar pada kunci yang tidak co-located, atau terjadi join fan-out `M:N` tanpa sengaja (Modul 1.4) | Pastikan keunikan kunci join (`1:N`), samakan `DISTKEY` / clustering key, atau lakukan pra-agregasi sebelum join |
| **4. Worker Timpang (Straggler Skew)** | `Max worker time: 420s · Median worker time: 6s` | 90% baris memiliki `customer_id IS NULL` atau `'GUEST'` sehingga menumpuk di satu node worker MPP | Pisahkan baris `NULL` sebelum join (gabungkan kembali dengan `UNION ALL` di akhir) atau gunakan key salting (Modul 3.1) |
:::

> 💡 **Jeda Praktik 2 (Metrik Overlap Clustering & Distribusi MPP):**
> 1. Buka file `labs/mod-2-6/warehouse_lab.py` di teks editor Anda.
> 2. Implementasikan fungsi `average_overlap(partitions, column)` untuk mengukur efektivitas clustering partisi.
> 3. Implementasikan fungsi `distribute(rows, key, nodes, style)` (gaya `key`, `even`, `all`) dan `join_rows_moved(...)` untuk memodelkan perpindahan baris saat operasi join berlangsung di mesin MPP.
> 4. Uji di terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestClusteringQuality or TestDistribution or TestJoinMovement" -v`
> 5. **Indikator Sukses:** Sebanyak 13 tes lulus membuktikan bahwa join yang co-located dan replikasi dimensi kecil tidak memindahkan data lewat jaringan.

## @part Biaya, pemuatan, dan tata kelola

## @lesson Biaya: harga berbasis pemindaian dan berbasis waktu
Warehouse menagih dengan dua cara dasar, dan Anda harus tahu mana yang Anda pakai (Modul 3.4 memperkenalkan keduanya).

**Berbasis pemindaian** (BigQuery on-demand): Anda membayar per **byte yang diproses** setiap query, beberapa dolar per terabyte (cek harga terkini). `query_cost(bytes_billed, price_per_tb)` di lab adalah rumus itu. Semua dalam pelajaran 2 karenanya adalah uang: partition pruning dan pemilihan kolom memangkas byte secara langsung. Sebuah query bisa **diperkirakan sebelum dijalankan** (dry run BigQuery melaporkan byte-nya), dan batas keras bisa dipasang pada byte maksimum yang ditagih sebuah query sehingga kesalahan gagal, bukan menagih.

**Berbasis waktu** (Snowflake, Redshift, BigQuery dengan kapasitas cadangan): Anda membayar komputasi **selama ia menyala**, berapa pun yang dipindainya. Di sini penghematan dari pruning adalah *waktu*: query yang lebih cepat menahan warehouse lebih sebentar dan membiarkannya suspend lebih cepat.

Ilustrasi dengan harga contoh lab $5 per TB. Sebuah tile dashboard refresh setiap 15 menit (96 kali sehari) dan, pada tabel tanpa cluster, memindai 2 TB setiap kali: 96 × 2 × $5 = **$960 sehari**. Jika clustering dan pemilihan kolom mengurangi pemindaian menjadi 3% (seperti pengukuran lab), tile yang sama berbiaya **$28,80 sehari**. Teks query tidak berubah; tata letaknya yang berubah.

**Cache** mengurangi biaya. **Result cache** mengembalikan jawaban tersimpan ketika query yang sama dijalankan lagi dan tabel di bawahnya tidak berubah (BigQuery dan Snowflake sama-sama melakukannya untuk waktu terbatas, dan hasil cache tidak ditagih untuk pemindaian). `ResultCache` di lab memperlihatkan logikanya: key-nya adalah SQL yang dinormalisasi ditambah versi setiap tabel, sehingga perubahan pada tabel mana pun membatalkan hasil. Warehouse juga meng-cache data di node komputasi, sehingga query yang diulang lebih cepat pada kali kedua. **Materialized view** dan tabel pra-agregasi (dibangun dengan dbt, Modul 2.3) menyimpan hasil agregasi berat sehingga dashboard membaca tabel kecil, bukan memindai fakta.

Penyimpanan juga ada biayanya. **Time travel** (mengkueri atau memulihkan data pada saat sebelumnya) menyimpan data lama selama jendela retensi, yang Anda bayar penyimpanannya: bawaan Snowflake satu hari (hingga 90 pada edisi tertentu); BigQuery tujuh hari. Retensi panjang pada tabel besar yang sering ditulis ulang bisa membengkak.

> 💡 **Jeda Praktik 3 (Model Biaya Berbasis Pemindaian):**
> 1. Buka file `labs/mod-2-6/warehouse_lab.py` di teks editor Anda.
> 2. Implementasikan fungsi `query_cost(bytes_billed, price_per_tb=5.0)` dengan rumus `(bytes_billed / 1e12) * price_per_tb`.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-2-6/test_lab.py -k test_query_cost -v`
> 4. **Indikator Sukses:** Tes berstatus `PASSED` membuktikan kalkulasi biaya pemindaian dolar per terabyte presisi.

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

:::advanced Bulk load produksi dan MERGE yang idempoten
**SQL Produksi untuk Bulk-Load & `MERGE` Idempoten (Snowflake, BigQuery, Redshift).** Perhatikan bagaimana ketiga warehouse memuat file Parquet dari object storage secara paralel, dan bagaimana perintah `MERGE` **wajib** menyertakan filter pemangkas partisi pada tabel target (`t.order_date >= ...`) agar tidak memindai seluruh tabel fakta historis:

```sql
-- LANGKAH 1: Bulk-load Parquet dari object storage cloud ke tabel staging
-- Snowflake (melalui External Stage yang menunjuk ke s3://kopiku-raw/orders/)
COPY INTO analytics.stg_orders
FROM @analytics.s3_orders_stage/dt=2026-10-19/
FILE_FORMAT = (TYPE = PARQUET)
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = 'ABORT_STATEMENT';

-- BigQuery (LOAD DATA native dari Parquet di GCS)
LOAD DATA OVERWRITE analytics.stg_orders
FROM FILES (
  format = 'PARQUET',
  uris = ['gs://kopiku-raw/orders/dt=2026-10-19/*.parquet']
);

-- Redshift (COPY paralel dari S3 memakai IAM Role terlampir — nol kunci rahasia di kode!)
TRUNCATE TABLE analytics.stg_orders;
COPY analytics.stg_orders
FROM 's3://kopiku-raw/orders/dt=2026-10-19/'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftS3ReadRole'
FORMAT AS PARQUET;

-- LANGKAH 2: MERGE idempoten dari staging ke tabel fakta target yang terpartisi
-- Syarat tanggal tambahan membuat warehouse bisa melewati partisi lama fct_orders, tetapi batasnya harus
-- berasal dari batch INI: order_date tertua di dalamnya (termasuk update terlambat untuk pesanan lama).
-- BigQuery:  DECLARE cutoff DATE DEFAULT (SELECT MIN(order_date) FROM analytics.stg_orders);
-- Snowflake: SET cutoff = (SELECT MIN(order_date) FROM analytics.stg_orders);   -- lalu tulis $cutoff
MERGE INTO analytics.fct_orders AS t
USING (
  SELECT * FROM analytics.stg_orders
  QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1
) AS s
ON t.order_id = s.order_id
   AND t.order_date >= cutoff               -- jangan pernah "2 hari terakhir" yang tetap: lihat di bawah
WHEN MATCHED AND s.updated_at > t.updated_at THEN
  UPDATE SET status = s.status, net_total_idr = s.net_total_idr, updated_at = s.updated_at
WHEN NOT MATCHED THEN
  INSERT (order_id, customer_id, order_date, status, net_total_idr, updated_at)
  VALUES (s.order_id, s.customer_id, s.order_date, s.status, s.net_total_idr, s.updated_at);
```

**Mengapa batasnya harus berasal dari batch.** Jendela tetap seperti "dua hari terakhir" tampak aman dan membuat `MERGE` murah, tetapi ia rusak begitu sebuah pesanan lama berubah: refund untuk pesanan tiga minggu lalu tidak cocok dengan baris mana pun di dalam jendela, sehingga `WHEN NOT MATCHED` memasukkannya sebagai baris *kedua* dan pesanan itu terhitung dua kali. Direproduksi di DuckDB 2.0.1: dengan batas tetap, refund terlambat untuk pesanan lama menjadi duplikat (`paid 100` dan `refunded 0` untuk `order_id` yang sama); dengan batas yang diambil dari `order_date` tertua di batch, pesanan itu diperbarui di tempat, menjalankan ulang batch yang sama tidak mengubah apa pun, dan setiap pesanan tetap punya tepat satu baris.
:::

> 💡 **Jeda Praktik 4 (Perencanaan File Bulk Load Paralel):**
> 1. Buka file `labs/mod-2-6/warehouse_lab.py` di teks editor Anda.
> 2. Implementasikan fungsi `plan_load_files(total_bytes, slices, target_file_bytes=200 * MiB, max_file_bytes=250 * MiB)` yang menyeimbangkan ukuran file ideal dan kelipatan slice komputasi.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-2-6/test_lab.py -k TestLoadPlanning -v`
> 4. **Indikator Sukses:** Keempat pengujian `TestLoadPlanning` berstatus `PASSED` membuktikan pembagian irisan file pemuatan optimal tanpa menimbulkan overhead file kecil.

## @lesson Konkurensi, tata kelola, dan memilih
**Konkurensi.** Warehouse punya komputasi terbatas. Ketika query yang datang lebih banyak daripada yang bisa dijalankan sekaligus, sisanya **mengantre**. `simulate_queue` di lab memperlihatkannya: lima job 10 detik pada dua slot selesai pada detik 10, 10, 20, 20, dan 30, jadi pengguna terakhir menunggu 20 detik sebelum job-nya bahkan mulai. Obatnya sama di mana-mana: isolasi beban kerja pada komputasi terpisah (satu warehouse untuk ETL, satu untuk dashboard, satu untuk analis), pakai fitur multi-cluster atau auto-scaling untuk lonjakan, dan perpendek query berat dengan alat tata letak di atas. Isolasi juga membuat tagihan bisa dibebankan ke sebuah tim (Modul 3.4).

**Tata kelola.** Data engineer mengatur akses, bukan hanya tabel. Bagian-bagian umumnya: **role** dengan hak akses yang diberikan kepada role, bukan kepada orang (hierarki role Snowflake, IAM BigQuery, grup dan role Redshift); **column masking** dan **row access policy** agar analis melihat email yang disamarkan atau hanya baris wilayahnya; **enkripsi** saat disimpan dan dikirim (warehouse menanganinya; Anda mengelola kebijakan key); dan **audit log** tentang siapa mengkueri apa. Data pribadi butuh perhatian ekstra (Modul 3.5, permintaan penghapusan).

Dua fitur yang akan Anda dengar: **zero-copy cloning** (Snowflake) membuat salinan tabel atau database sebagai metadata, yang hanya memakan penyimpanan untuk perubahan, ideal untuk lingkungan uji; dan **secure data sharing** membiarkan akun lain mengkueri data Anda tanpa menyalin.

:::advanced SQL tata kelola produksi, dan konvergensi warehouse dan lakehouse
**SQL Tata Kelola Produksi: Dynamic Data Masking, Row-Level Security & Zero-Copy Clone.** Daripada memelihara dua tabel terpisah ("tabel disamarkan" dan "tabel asli"), cloud warehouse modern menegakkan penyamaran kolom PII dan isolasi baris multi-tenant langsung di kebijakan katalog:

```sql
-- 1. Dynamic Column Masking (sintaks Snowflake; BigQuery melakukan hal yang sama dengan policy tag pada kolom):
--    Analis biasa melihat '***@domain.com'; hanya PII_COMPLIANCE_ROLE yang melihat email asli
CREATE OR REPLACE MASKING POLICY governance.email_mask AS (val STRING) RETURNS STRING ->
  CASE
    WHEN CURRENT_ROLE() IN ('PII_COMPLIANCE_ROLE', 'ACCOUNTADMIN') THEN val
    ELSE REGEXP_REPLACE(val, '^[^@]+', '***')
  END;

ALTER TABLE analytics.dim_customer
  MODIFY COLUMN email SET MASKING POLICY governance.email_mask;

-- 2. Multi-Tenant Row Access Policy (Menegakkan Isolasi Embedded Analytics):
CREATE OR REPLACE ROW ACCESS POLICY governance.tenant_isolation
  AS (row_tenant_id VARCHAR) RETURNS BOOLEAN ->
  CURRENT_ROLE() = 'PLATFORM_ADMIN'
  OR EXISTS (
    SELECT 1 FROM governance.role_tenant_map m
    WHERE m.role_name = CURRENT_ROLE() AND m.tenant_id = row_tenant_id
  );

ALTER TABLE analytics.fct_orders
  ADD ROW ACCESS POLICY governance.tenant_isolation ON (tenant_id);

-- 3. Zero-Copy Cloning untuk Pengujian CI/CD Aman (salinan berupa metadata saja: Anda hanya membayar penyimpanan untuk data yang berubah sesudahnya):
CREATE DATABASE analytics_pr_482 CLONE analytics_prod;
-- Jalankan dbt build --target pr_482 terhadap skala produksi nyata, lalu hapus setelah PR selesai:
DROP DATABASE analytics_pr_482;
```

**Memilih.** Tidak ada pemenang universal. Ringkasan yang adil:

| | Kekuatan | Waspadai |
|---|---|---|
| **Snowflake** | Mudah dijalankan, isolasi kuat dengan virtual warehouse, lintas cloud, berbagi data | Kontrol biaya butuh disiplin (warehouse menganggur, ukuran) |
| **BigQuery** | Tanpa server, kuat untuk pemindaian sangat besar, terintegrasi erat dengan Google Cloud | Kejutan biaya berbasis pemindaian; partisi dan cluster dengan benar |
| **Redshift** | Integrasi AWS mendalam, biaya terprediksi pada beban stabil | Lebih banyak penyetelan (distribution dan sort key), ukuran klaster |
| **Lakehouse** (Spark, Trino, DuckDB pada Iceberg/Delta) | Format terbuka, tanpa lock-in, satu salinan data untuk banyak mesin | Lebih banyak yang dioperasikan sendiri, fitur tata kelola bawaan lebih sedikit |

Dalam praktik, pilihan sering ditentukan oleh penyedia cloud perusahaan dan kontrak yang ada. Yang berpindah di antara semuanya adalah yang Anda pelajari di sini: **tata letak** (pruning), **byte dan waktu** (biaya), **perpindahan** (distribusi dan shuffle), **bulk loading**, dan **isolasi**.

**Konvergensi Warehouse dan Lakehouse (Tabel Native vs. External Parquet vs. Managed Apache Iceberg).** Di Bab 3 dan 6 *Fundamentals of Data Engineering*, Reis & Housley memprediksi menyatunya data warehouse dan data lake. Saat ini Anda tidak lagi dipaksa memilih antara terkunci penuh di satu vendor (vendor lock-in) atau merakit semuanya dari nol. Setiap cloud warehouse besar kini mendukung tiga mode penyimpanan tabel:

| Mode Tabel Cloud | Lokasi Fisik File | Pemilik Metadata & Compaction | Trade-off Performa & Interoperabilitas |
|---|---|---|---|
| **1. Tabel Native Warehouse** (Snowflake Internal, BigQuery Native, Redshift Managed) | Di dalam bucket internal milik vendor warehouse | Mesin warehouse secara otomatis penuh | Pruning & clustering tercepat langsung dari bawaan, tetapi mesin lain (Spark/DuckDB) tidak bisa membaca file-nya langsung tanpa biaya ekspor/konektor |
| **2. Tabel Eksternal Mentah** (File Parquet/CSV biasa di S3/GCS/ADLS) | Di dalam bucket object storage milik Anda sendiri | Tidak ada (mengandalkan listing folder S3) | Tanpa transaksi ACID, lambat saat jumlah file mencapai jutaan, tanpa compaction otomatis |
| **3. Tabel Open Lakehouse** (Snowflake Iceberg / Polaris, BigQuery BigLake Iceberg, Redshift Iceberg) | Di dalam bucket S3/GCS/ADLS milik Anda dalam format terbuka **Apache Iceberg** | Katalog terbuka Iceberg (REST / Glue / Polaris / Unity) | **Keputusan pintu dua arah (reversible):** Spark, DuckDB, Trino, dan Flink bisa membaca file Parquet yang sama di tempatnya, tanpa salinan; seberapa dekat kecepatannya dengan native bergantung pada engine dan perawatan tabel (compaction), jadi ukurlah pada query Anda sendiri |

Pertanyaan yang kini bisa Anda jawab: "Mengapa query ini mahal?" (ia memindai banyak partisi atau kolom; lihat partisi yang dipindai dan byte yang ditagih). "Bagaimana membuatnya lebih murah?" (filter pada kolom clustering atau partisi, pilih hanya kolom yang perlu, pra-agregasi). "Apa beda harga Snowflake dan BigQuery?" (waktu komputasi versus byte yang dipindai). "Mengapa ukuran file 100 hingga 250 MB?" (paralelisme tanpa overhead per file).
:::

> 💡 **Jeda Praktik 5 (Result Caching & Antrean Konkurensi):**
> 1. Buka file `labs/mod-2-6/warehouse_lab.py` di teks editor Anda.
> 2. Implementasikan class `ResultCache`: normalisasi spasi dan huruf kapital query SQL, simpan versi tabel, serta batalkan cache jika tabel dasar mengalami pembaruan.
> 3. Implementasikan fungsi `simulate_queue(query_durations, slots)` untuk memodelkan waktu tuntas kueri yang bersaing dalam slot konkurensi.
> 4. Jalankan pengujian di terminal:
>    `pytest labs/mod-2-6/test_lab.py -k "TestResultCache or TestQueueing" -v`
> 5. **Indikator Sukses:** Sebanyak 8 tes berstatus `PASSED` membuktikan keandalan invalidasi result cache dan akurasi simulasi antrean slot.

## @part Penyajian, dan warehouse sungguhan

## @lesson Menyajikan dan mengganti: semantic layer, reverse ETL, federation, data mesh, dan strangler fig
> **Intinya:** Menyajikan data lebih dari sekadar dashboard. **Semantic layer** mendefinisikan setiap metrik bisnis sekali saja, sehingga setiap tool mendapat angka yang sama. **Reverse ETL** mengirim hasil dari warehouse kembali ke tool operasional, sehingga harus aman untuk diulang. **Federation** meng-query beberapa sistem tanpa menyalinnya lebih dulu. **Data mesh** menyerahkan kepemilikan data kepada tim domain. Dan saat Anda mewarisi pipeline lama, pola **strangler fig** menggantinya sedikit demi sedikit, membandingkan yang lama dan yang baru sampai keduanya sepakat.

Gagasan-gagasan ini berasal dari bab 3, 8, dan 9 *Fundamentals of Data Engineering*. Bersikaplah realistis tentang seberapa sering Anda akan menemui masing-masing: di database lowongan TalentHub, 37% dari 1.130 lowongan data engineering menyebut tool BI atau dashboard, 18% menyebut migrasi atau sistem lama, 5% menyebut semantic layer atau metrics layer, dan kurang dari 1% menyebut reverse ETL. Pelajari gagasannya karena gagasan itu menjelaskan masalah yang tetap akan Anda temui, bukan karena setiap lowongan memintanya secara eksplisit.

1. **Semantic layer (metrics layer).** Mengapa tim keuangan dan marketing membawa dua angka "net revenue" yang berbeda ke rapat yang sama? Karena setiap dashboard atau spreadsheet menulis rumusnya sendiri: satu mengurangi diskon dan pajak, yang lain lupa mengecualikan pesanan yang di-refund. Semantic layer (dbt MetricFlow, Cube, LookML) mendefinisikan metrik sekali saja, dalam kode yang di-version-control, dan setiap tool meminta angkanya dari sana.
2. **Reverse ETL.** Pipeline biasa menyalin data *keluar dari* tool operasional ke warehouse. Reverse ETL menyalin hasil yang sudah dimodelkan, seperti lifetime value pelanggan atau penanda "VIP", *kembali ke* tool seperti CRM. Tool itu bertindak berdasarkan apa yang Anda kirim: mengirim email ke pelanggan dan mengubah penawarannya. Jadi setiap record yang Anda kirim membawa **idempotency key** yang deterministik, dibangun dari isinya, agar pengulangan hanya memperbarui dan tidak bertindak dua kali. Dan Anda memutuskan dengan hati-hati apa yang tidak dikirim: pelanggan dengan nilai nol atau negatif tidak boleh memicu kampanye otomatis.
3. **Strangler fig.** Anda akan sering mewarisi pipeline lama (stored procedure 3.000 baris, skrip cron yang tak dipahami siapa pun) alih-alih mulai dari nol. Menulis ulang semuanya sekaligus itu berisiko. Pola strangler fig (dinamai oleh Martin Fowler) menggantinya sedikit demi sedikit. Bangun versi baru dari satu metrik. Jalankan yang lama dan yang baru berdampingan. Laporkan setiap tanggal saat keduanya berbeda, dan seberapa besar. Pindahkan konsumen hanya setelah perbedaannya terjelaskan. Setiap perbedaan adalah bug di kode baru, atau bug lama yang baru saja Anda temukan.
4. **Federation, data mesh, dan penyajian cepat.**
   - *Federation:* engine seperti Trino dan DuckDB bisa men-join tabel PostgreSQL, file Parquet di S3, dan tabel warehouse dalam satu query tanpa menyalinnya lebih dulu. Itu ideal untuk eksplorasi; join yang Anda jalankan setiap hari tetap lebih baik di tabel yang dimaterialisasi.
   - *Data mesh:* untuk perusahaan besar tempat satu tim data pusat sudah menjadi hambatan. Empat prinsipnya: tim domain memiliki datanya, data diperlakukan sebagai produk, tim platform menyediakan alat self-service, dan aturan tata kelola dibagi bersama dan diotomatiskan.
   - *Penyajian cepat:* analitik untuk pelanggan yang harus menjawab dalam milidetik memakai engine seperti ClickHouse, Druid, atau Pinot. *Feature store* machine learning menyimpan fitur yang sama di store offline untuk training dan store online untuk prediksi langsung, agar model melihat nilai yang sama di keduanya.

```python
import hashlib

def make_reverse_etl_key(customer_id, sync_date, net_ltv_idr):
    raw = f"{customer_id}:{sync_date}:{net_ltv_idr}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
```

> 🛠 **Coba sendiri (20 menit, di terminal Anda sendiri).** Di `strangler_reverse_etl.py`, tulis `run_strangler_and_reverse_etl(orders, legacy_daily_totals, sync_date)`. Setiap pesanan punya `order_id, customer_id, order_date, status, gross_idr, discount_idr, tax_idr`; `legacy_daily_totals` memetakan tanggal ke net revenue versi pipeline lama. Net revenue adalah gross dikurangi diskon dikurangi pajak, hanya dihitung untuk pesanan `paid`, `shipped`, dan `delivered`. Kembalikan dict berisi:
> `semantic_daily`: tanggal → net revenue, untuk setiap tanggal yang punya pesanan · `drift_report`: satu `{date, legacy_idr, semantic_idr, delta_idr}` per tanggal saat lama dan baru berbeda, urut tanggal, dengan `delta_idr = semantic - legacy` · `reverse_etl_payloads`: satu `{customer_id, net_ltv_idr, tier_action, idempotency_key}` per pelanggan yang layak dikirim, urut `customer_id`; `tier_action` adalah `VIP_UPGRADE` mulai 200000 ke atas, selain itu `STANDARD_SYNC`; key dibuat seperti kode di atas.
> Data nyata itu berantakan: pikirkan bagaimana sebuah status bisa ditulis, tanggal mana yang mungkin dimiliki satu sisi tetapi tidak oleh sisi lain, dan pelanggan mana yang tidak boleh dikirim.
> **Periksa:** `python3 labs/tryit/check.py 2.6-1 ~/practice` (buntu? tambahkan `--hint 1`, lalu 2 dan 3)

**Tiga jenis analitik, tiga set kebutuhan.** Buku ini (bab 9) membedakan untuk siapa analitiknya, karena audiens menentukan hampir setiap pilihan teknis:

| | Analitik bisnis | Analitik operasional | Analitik tertanam (untuk pelanggan) |
|---|---|---|---|
| Untuk siapa | analis, manajer | tim operasional dan peringatan otomatis | pelanggan Anda, di dalam produk Anda |
| Pertanyaan | apa yang terjadi dan mengapa | apa yang sedang terjadi sekarang, bertindak atasnya | bagaimana kondisi akun *saya* |
| Contoh KopiKu | pendapatan mingguan per kota dan roast | "sebuah toko akan kehabisan biji Gayo hari ini" | KopiKu menjual software kasirnya ke kafe; setiap pemilik melihat dashboard penjualannya sendiri |
| Kesegaran data | harian biasanya cukup | detik sampai menit | menit sampai jam, tergantung produknya |
| Waktu per query | beberapa detik masih bisa diterima | detik | jauh di bawah satu detik |
| Pengguna sekaligus | puluhan | beberapa orang, banyak pemeriksaan otomatis | ratusan sampai ribuan, sering di menit yang sama |
| Biaya sebuah kesalahan | keputusan yang salah di kemudian hari | kehabisan stok atau fraud yang terlewat | pelanggan lain melihat data Anda: kebocoran data |

Analitik tertanam adalah yang paling sulit. Ia bersifat **multi-tenant**: satu set tabel melayani banyak pelanggan (tenant), jadi isolasinya harus ditegakkan oleh sistem, bukan oleh setiap developer yang harus ingat menulis `WHERE`. Ambil tenant dari sesi login, jangan pernah dari nilai yang bisa diubah pengguna di URL, dan biarkan database yang menegakkannya dengan **row-level security** (PostgreSQL), **row access policy** (Snowflake), atau **row-level security** di BigQuery (pelajaran 6). Kecepatan datang dari mengerjakan pekerjaan berat sebelum pelanggan datang: tabel pra-agregasi per tenant dan hari atau bulan yang dibangun pipeline, atau engine penyajian seperti ClickHouse, Druid, atau Pinot (poin 4 di atas).

> 🛠 **Coba sendiri (15 menit, Python).** Dengan DuckDB dan `SET threads = 1`, buat 5.000.000 pesanan untuk 2.000 tenant: `SELECT range AS order_id, range % 2000 AS customer_id, DATE '2025-01-01' + CAST((range // 2000) % 700 AS INTEGER) AS order_date, 10000 + (range * 37) % 500000 AS total_idr FROM range(5000000)`. Bangun tabel `monthly` berisi pendapatan per pelanggan dan bulan. Lalu ukur waktu query dashboard sebuah tenant, "pendapatan per bulan untuk pelanggan ?", sebanyak 100 kali untuk pelanggan acak, sekali pada pesanan mentah dan sekali pada `monthly`, lalu bandingkan mediannya. Pastikan keduanya memberi baris yang sama. Terakhir, buang `WHERE customer_id = ?` dan hitung berapa nilai `customer_id` berbeda yang kemudian dibaca query itu.
>
> **Seharusnya Anda melihat:** `monthly` berisi `48000` baris (24 bulan untuk masing-masing 2.000 pelanggan) dan dibangun dalam sekitar sepersepuluh detik. Pada CPU laptop (AMD Ryzen 5 PRO 4650U, DuckDB 2.0.1) mediannya sekitar `13` ms pada pesanan mentah dan sekitar `0.9` ms pada `monthly`, sekitar 14 kali lebih cepat, dengan hasil yang identik: kira-kira 75 berbanding 1.100 query per detik per core. Jika 1.000 kafe membuka dashboard lima grafik di menit yang sama, itu 5.000 query, sekitar 83 per detik: lebih dari yang bisa dilayani satu core dari pesanan mentah, dan hanya sebagian kecil satu core dari `monthly`. Tanpa `WHERE`, dashboard itu diam-diam menjumlahkan pesanan kesemua `2000` tenant dan menampilkannya kepada satu kafe. Waktu Anda akan berbeda; rasionya seharusnya tidak jauh berbeda.

## @lesson Bedah mendalam: Arsitektur Google BigQuery, pemodelan ARRAY<STRUCT>, FinOps & Sandbox Gratis
**Google BigQuery** muncul di **12,7%** dari 1.130 lowongan data engineering yang diukur di TalentHub (2026-07-23 sampai 2026-11-20), di belakang Databricks (34,8%) dan Snowflake (25,8%), dan sedikit di atas Redshift (11,7%). Ia tetap warehouse *sungguhan* yang paling mudah untuk berlatih, karena sandbox-nya tidak butuh kartu pembayaran, dan desainnya menjelaskan banyak hal tentang yang lain. Anda perlu memahami bagaimana arsitektur internalnya menentukan cara Anda memodelkan tabel, memasukkan stream, dan mengendalikan biaya di GCP.

### 1. Cara kerja BigQuery di balik layar (Colossus, Capacitor, Dremel & Dynamic Shuffle)
Berbeda dari Snowflake atau Redshift—di mana Anda memilih ukuran klaster (`X-Small`, `4 node`) dan data di-cache di SSD lokal worker—BigQuery memisahkan **empat** lapisan secara independen di seluruh pusat data Google:

| Lapisan BigQuery | Teknologi Internal Google | Fungsi & Mengapa Penting bagi Data Engineer |
|---|---|---|
| **1. Penyimpanan Terdistribusi** | **Colossus** + **Capacitor** | Menyimpan data dalam format kolumnar **Capacitor** di atas sistem file terdistribusi **Colossus** yang direplikasi lintas-zone. Setiap kolom dan sub-kolom memiliki header statistik min/max, null, dan kamus untuk pemangkasan instan. |
| **2. Pohon Komputasi Multi-Tenant** | **Dremel** (di atas **Borg**) | Saat Anda menjalankan query, BigQuery mengalokasikan ribuan **slot** stateless (CPU virtual) yang disusun membentuk **pohon eksekusi Dremel**: *Leaf slots* membaca blok Capacitor dari Colossus secara paralel; *Mixer slots* mengagregasi hasil parsial menuju *Root*. |
| **3. Shuffle Terdistribusi di RAM** | **BigQuery RAM Shuffle** | Daripada menulis file spill shuffle ke disk lokal worker, Leaf slots mengirim bucket hash perantara ke **lapisan RAM shuffle bersama** yang terpisah. Itulah sebabnya BigQuery bisa menambah atau melepas slot di tengah jalannya query! |
| **4. Jaringan Petabit** | **Jupiter** | Menghubungkan Colossus, slot Dremel, dan lapisan RAM Shuffle dengan bandwidth petabit/detik sehingga pembacaan storage jarak jauh hampir secepat SSD lokal. |

**Konsekuensi arsitektur:** Karena BigQuery tidak memiliki cache SSD lokal yang menempel permanen pada VM worker khusus, Anda tidak bisa mengandalkan "cache disk klaster yang sudah hangat" untuk menutupi tata letak tabel yang buruk. Setiap query yang tidak mengenai result cache akan membaca langsung dari Colossus, sehingga **partisi, clustering, pemilihan kolom spesifik, dan pemodelan bersarang `ARRAY<STRUCT>`** menjadi wajib.

### 2. Senjata Utama Pemodelan Data BigQuery: Kolom Bersarang & Berulang (`ARRAY<STRUCT>` dan `UNNEST`)
Pada database relasional tradisional (atau Star Schema Kimball, Modul 1.4), sebuah pesanan dengan 4 item barang dibagi ke dalam dua tabel (`fct_orders` dan `fct_order_items`), yang membutuhkan `JOIN` terdistribusi pada `order_id` saat di-query. Jika Anda meratakannya menjadi One Big Table (OBT), kolom header pesanan (`customer_id`, `order_date`, `city`) akan terduplikasi 4 kali.

Di Bab 8 *Fundamentals of Data Engineering* dan panduan resmi arsitektur BigQuery, pola kanoniknya adalah **mendenormalisasi relasi induk-anak (1:N) ke dalam satu baris yang sama menggunakan `ARRAY<STRUCT<...>>` (`REPEATED RECORD`)**:

```sql
-- 1. Buat tabel terpartisi & ter-cluster dengan ARRAY<STRUCT> bersarang untuk rincian item pesanan:
CREATE TABLE analytics.fct_orders_nested (
  order_id      STRING,
  customer_id   STRING,
  order_date    DATE,
  city          STRING,
  items         ARRAY<STRUCT<
    sku         STRING,
    roast       STRING,
    qty         INT64,
    unit_idr    INT64
  >>
)
PARTITION BY order_date
CLUSTER BY city, customer_id;

-- 2. Query metrik level header menyentuh NOL byte kolom items (tanpa fan-out, tanpa join!):
SELECT city, COUNT(order_id) AS order_count
FROM analytics.fct_orders_nested
WHERE order_date = DATE '2026-10-19'
GROUP BY city;

-- 3. Query metrik level item memakai CROSS JOIN UNNEST(items) — berada di baris fisik yang sama!
SELECT
  o.city,
  item.roast,
  SUM(item.qty * item.unit_idr) AS roast_revenue_idr
FROM analytics.fct_orders_nested AS o
CROSS JOIN UNNEST(o.items) AS item
WHERE o.order_date = DATE '2026-10-19'
GROUP BY o.city, item.roast;
```

**Mengapa `ARRAY<STRUCT>` sangat unggul di BigQuery (dan DuckDB / Parquet):**
1. **Nol shuffle jaringan:** Baris induk pesanan dan rincian item anaknya tersimpan di dalam row group Capacitor/Parquet yang sama pada Leaf slot yang sama. Operasi `UNNEST` hanyalah perulangan pointer lokal di cache CPU, bukan hash join melintasi jaringan.
2. **Bebas jebakan fan-out pada query header:** Menghitung `COUNT(order_id)` langsung menghitung jumlah pesanan (1 baris per pesanan) tanpa terlipatgandakan oleh jumlah item barang.
3. **Pemangkasan sub-kolom (Sub-column pruning):** Capacitor menyimpan `items.roast`, `items.qty`, dan `items.unit_idr` sebagai sub-kolom fisik terpisah di disk. Query di atas bahkan tidak membaca byte `items.sku`!

> 🛠 **Coba sendiri (10 menit, Python dengan DuckDB — berjalan lokal tanpa akun cloud!).** DuckDB dan Parquet menggunakan representasi kolumnar bersarang yang sama persis dengan BigQuery Capacitor. Di Python, jalankan `import duckdb; con = duckdb.connect()` lalu eksekusi:
> `con.execute("CREATE TABLE orders_nested AS SELECT 'O-1' AS order_id, 'Jakarta' AS city, [{'sku':'GAYO','qty':2,'price':45000}, {'sku':'TORAJA','qty':1,'price':55000}] AS items UNION ALL SELECT 'O-2', 'Jakarta', [{'sku':'GAYO','qty':3,'price':45000}]")`.
> Pertama jalankan `SELECT city, COUNT(order_id) AS orders FROM orders_nested GROUP BY city` (grain pesanan). Kedua, buka array-nya persis seperti BigQuery: `SELECT o.city, it.sku, SUM(it.qty * it.price) AS rev FROM orders_nested o, UNNEST(o.items) AS t(it) GROUP BY o.city, it.sku ORDER BY rev DESC`.
>
> **Seharusnya Anda melihat:** query header mengembalikan `('Jakarta', 2)` tanpa duplikasi item, dan query `UNNEST` mengembalikan `[('Jakarta', 'GAYO', 225000), ('Jakarta', 'TORAJA', 55000)]` tanpa join terdistribusi!

### 3. Batas Partisi BigQuery & Streaming CDC Upsert (Storage Write API)
- **Batas partisi:** Satu tabel BigQuery maksimal memiliki **10.000 partisi** (sekitar 27 tahun partisi harian), dan satu job maksimal mengubah 4.000 di antaranya, yang penting untuk backfill besar (halaman kuota Google, diperbarui 2026-11-20). Jika Anda menabrak batas itu, partisilah per `DATE_TRUNC(order_date, MONTH)` dan `CLUSTER BY order_date, customer_id`: clustering di dalam setiap partisi bulanan tetap memangkas per hari.
- **CDC real-time tanpa job `MERGE` berulang (tidak tersedia di sandbox: butuh streaming):** Menjalankan `MERGE` setiap beberapa menit pada tabel multi-TB itu mahal. BigQuery bisa menerima change data capture melalui **Storage Write API**: deklarasikan `PRIMARY KEY (order_id) NOT ENFORCED` pada tabel dan stream baris dengan pseudocolumn `_CHANGE_TYPE` bernilai `UPSERT` atau `DELETE`. Dengan `OPTIONS (max_staleness = INTERVAL 15 MINUTE)`, BigQuery menerapkan perubahannya di latar belakang paling tidak sekali per interval, menukar sedikit kesegaran dengan biaya dan latensi query yang lebih rendah.

### 4. FinOps BigQuery: On-Demand ($/TiB) vs. BigQuery Editions (Autoscaling Slots)
BigQuery memiliki dua model penagihan utama yang wajib Anda sesuaikan dengan pola beban kerja:

| Model Penagihan | Cara Penagihan | Paling Tepat Untuk | Guardrail FinOps Wajib |
|---|---|---|---|
| **On-Demand** | **~$6,25 per TiB yang dipindai** (1 TiB pertama/bulan gratis) | Beban kerja sporadis, startup, dan tabel yang sudah terpartisi rapat | Pasang `maximum_bytes_billed` di setiap query/profil dbt dan `require_partition_filter = TRUE` pada semua tabel besar |
| **BigQuery Editions** (*Standard, Enterprise, Enterprise Plus*) | **Slot-hour** (~$0,04–$0,06/slot-jam, autoscale dalam kelipatan 50 slot) | Dashboard frekuensi tinggi dan ETL korporat padat yang memindai ratusan TiB/hari | Pasang plafon **`max_slots` reservation yang ketat** (mis. `baseline = 0, max_slots = 100`); tanpa plafon, satu query buruk bisa langsung men-scale ke 1.600 slot! |

Harga di atas adalah harga daftar Google untuk AS di halaman harganya pada November 2026 (edisi Standard $0,04, Enterprise $0,06 per slot-jam, bayar sesuai pemakaian); region dan komitmen lain berbeda, jadi periksa halamannya sebelum Anda memperkirakan biaya.

### 5. Panduan Praktik Langsung: Google BigQuery Free Sandbox & Guardrail Snowflake
Ketika Anda siap mencoba pola-pola ini di cloud warehouse sungguhan tanpa biaya, gunakan **sandbox Google BigQuery**: tanpa kartu pembayaran.

> **Status:** langkah sandbox mengikuti dokumentasi Google per November 2026 (halaman sandbox diperbarui 2026-11-10, halaman instalasi 2026-11-17, halaman kuota 2026-11-20), tetapi kursus belum menjalankannya pada akun sungguhan, jadi panduan di bawah tidak menyebut angka BigQuery hasil ukur. Jika ada langkah yang tidak sesuai dengan yang Anda lihat, laporkan (tautannya ada di halaman **Mulai di sini**).

Batasan sandbox, menurut halaman sandbox Google:

| Batas | Nilai |
|---|---|
| Penyimpanan | 10 GiB **untuk seumur hidup sandbox**; menghapus data tidak mengembalikannya |
| Query | 1 TiB data yang diproses per bulan |
| Kedaluwarsa | setiap tabel, view, dan partisi terhapus otomatis setelah 60 hari |
| Tidak tersedia | streaming insert, DML (`INSERT`, `UPDATE`, `DELETE`, `MERGE`), Data Transfer Service |

Jadi di sandbox Anda memuat file dengan **load job**, bukan `INSERT` atau `MERGE`, dan menjaga data uji tetap kecil, karena jatah penyimpanan tidak pernah kembali. Pola `MERGE` dan CDC di atas butuh project yang penagihannya aktif.

**1. Aktifkan BigQuery Sandbox & pasang CLI `gcloud` / `bq`.**
Buka `https://console.cloud.google.com/bigquery`, masuk dengan akun Google, buat sebuah project (mis. `kopiku-de-sandbox`), lalu pasang Google Cloud CLI di Linux / WSL2:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates gnupg curl
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update && sudo apt-get install -y google-cloud-cli
gcloud init
```

**2. Buktikan Pemangkasan Kolom dengan `--dry_run` (Biaya $0, 0 Byte Ditagih).**

```bash
# Dry-run memilih HANYA 1 kolom (name) vs. SEMUA 5 kolom (SELECT *):
bq query --use_legacy_sql=false --dry_run \
  'SELECT name FROM `bigquery-public-data.usa_names.usa_1910_current`'

bq query --use_legacy_sql=false --dry_run \
  'SELECT * FROM `bigquery-public-data.usa_names.usa_1910_current`'
```

- **Mengapa angkanya berbeda:** `usa_1910_current` memiliki 5 kolom (`state`, `gender`, `year`, `name`, `number`). BigQuery menyimpan setiap kolom secara terpisah dan hanya menagih kolom yang dibaca query (pelajaran 2), jadi query satu kolom melaporkan byte yang jauh lebih sedikit daripada `SELECT *`. Tebak rasionya, lalu catat kedua angkanya: kursus akan menambahkan nilai terukur di sini setelah dijalankan pada akun sungguhan.

**3. Pasang Guardrail Batas Byte & Audit `INFORMATION_SCHEMA.JOBS_BY_USER`.**

```bash
# Tolak eksekusi jika query akan memindai lebih dari 200 MB (200.000.000 byte):
bq query --use_legacy_sql=false --maximum_bytes_billed=200000000 \
  'SELECT name, SUM(number) AS total_births
   FROM `bigquery-public-data.usa_names.usa_1910_current`
   WHERE state = "CA"
   GROUP BY name ORDER BY total_births DESC LIMIT 5'

# Audit byte tertagih, konsumsi slot_ms, dan cache hit Anda:
bq query --use_legacy_sql=false \
  'SELECT creation_time, total_bytes_processed, total_bytes_billed, total_slot_ms, cache_hit
   FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_USER
   ORDER BY creation_time DESC LIMIT 5'
```

**4. Padanan di Snowflake: Pemutus Arus Kredit (`RESOURCE MONITOR`).**
Pada Snowflake yang berbasis waktu aktif, kunci `AUTO_SUSPEND = 60`, `STATEMENT_TIMEOUT_IN_SECONDS = 1800`, dan pemutus kredit otomatis:

```sql
CREATE OR REPLACE RESOURCE MONITOR kopiku_monthly_guardrail
  WITH CREDIT_QUOTA = 50 FREQUENCY = MONTHLY START_TIMESTAMP = IMMEDIATELY
  TRIGGERS ON 80 PERCENT DO NOTIFY ON 100 PERCENT DO SUSPEND_IMMEDIATE;

CREATE OR REPLACE WAREHOUSE kopiku_etl_wh
  WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE STATEMENT_TIMEOUT_IN_SECONDS = 1800
  RESOURCE_MONITOR = kopiku_monthly_guardrail;
```

> 🛠 **Coba sendiri (15 menit, terminal, opsional jika Anda memasang `bq`).** Jalankan kedua perintah `--dry_run` di atas pada `usa_1910_current`, lalu jalankan query `WHERE state = "CA"` dua kali berturut-turut dan periksa `INFORMATION_SCHEMA.JOBS_BY_USER`.
>
> **Seharusnya Anda melihat:** setiap dry run mencetak byte yang akan diproses, dan `SELECT *` beberapa kali lipat query satu kolom. Eksekusi sungguhan pertama query `CA` menunjukkan `cache_hit = false`; eksekusi kedua yang identik dijawab dari result cache, dengan `cache_hit = true` dan `total_bytes_billed = 0` (`ResultCache` dari pelajaran 4, di warehouse sungguhan). Catat jumlah byte dan waktu Anda; belum ada nilai terukur yang dicantumkan di sini.

## @lesson Konektor Python ke warehouse, hierarki peran RBAC, mart rollup BI, serta tabel eksternal vs. native

Memadukan praktik produksi terbaik dari *Data Engineering 101*, *DataTalksClub Data Engineering Zoomcamp*, dan *Google Business Intelligence*, empat alur kerja praktis ini melengkapi keahlian cloud data warehouse Anda:

**1. Konektor Pemuatan Massal Python ke Cloud Warehouse (`Snowflake` & `BigQuery`).** Saat pipeline Python memuat DataFrame bersih ke cloud warehouse, jangan pernah melakukan loop baris demi baris dengan `cursor.execute("INSERT INTO ...")`. Gunakan SDK bulk loader kolumnar resmi yang mengunggah buffer Parquet/Arrow terkompresi langsung ke cloud storage dan memicu job pemuatan paralel:

```python
# --- A. SNOWFLAKE: Pemuatan Massal Arrow/Parquet via write_pandas + Query Berparameter ---
import snowflake.connector
from snowflake.connector.pandas_tools import write_pandas

conn = snowflake.connector.connect(
    user="SVC_ELT_LOADER",
    account="kopiku-ap-southeast-1",
    private_key_file="/secrets/rsa_key.p8",   # Autentikasi key-pair (jangan hardcode password!)
    warehouse="WH_LOADING_XS",
    database="PROD_DW",
    schema="RAW"
)
# Mengunggah potongan Parquet terkompresi secara paralel & menjalankan COPY INTO di balik layar:
success, nchunks, nrows, _ = write_pandas(conn, cleaned_df, "STG_ORDERS", auto_create_table=False)

# Selalu gunakan placeholder berparameter (%s), JANGAN f-string, untuk mencegah SQL injection:
with conn.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM STG_ORDERS WHERE order_date = %s", ("2026-02-02",))

# --- B. GOOGLE BIGQUERY: Job Pemuatan Arrow/Parquet Zero-Copy ---
from google.cloud import bigquery

bq = bigquery.Client(project="kopiku-prod")
job_config = bigquery.LoadJobConfig(
    write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    time_partitioning=bigquery.TimePartitioning(field="order_date"),
    clustering_fields=["store_id", "status"],
)
# Mengunggah DataFrame sebagai Parquet terkompresi ke Colossus dalam satu job batch:
load_job = bq.load_table_from_dataframe(
    cleaned_df, "kopiku-prod.raw_kopiku.stg_orders$20260202", job_config=job_config
)
load_job.result()  # Menunggu penggantian partisi atomik selesai
```

**2. Hierarki Role-Based Access Control (RBAC) di Cloud Warehouse.** Di Snowflake, BigQuery, dan Databricks Unity Catalog, jangan pernah memberikan izin tabel langsung ke akun pengguna individu, dan jangan pernah menjalankan pipeline sebagai `ACCOUNTADMIN` / `Project Owner`. Pisahkan **Peran Akses** (objek apa yang boleh dibaca/ditulis) dari **Peran Fungsional** (jabatan kerja):

```sql
-- Pola Least-Privilege RBAC Snowflake / Warehouse:
CREATE ROLE IF NOT EXISTS ROLE_ELT_WRITER;
CREATE ROLE IF NOT EXISTS ROLE_BI_READER;

GRANT USAGE ON WAREHOUSE WH_BI_XS TO ROLE ROLE_BI_READER;
GRANT USAGE ON DATABASE PROD_DW TO ROLE ROLE_BI_READER;
GRANT USAGE ON SCHEMA PROD_DW.MARTS TO ROLE ROLE_BI_READER;

-- Berikan akses baca ke seluruh tabel mart saat ini DAN yang akan dibuat di masa depan:
GRANT SELECT ON ALL TABLES IN SCHEMA PROD_DW.MARTS TO ROLE ROLE_BI_READER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA PROD_DW.MARTS TO ROLE ROLE_BI_READER;

-- Berikan peran fungsional ke akun layanan Looker/Tableau:
GRANT ROLE ROLE_BI_READER TO USER SVC_LOOKER_BI;
```

**3. External Table vs. Native Managed Table & Mart Rollup BI.** Baik BigQuery maupun Snowflake dapat men-query file Parquet/Iceberg di bucket GCS/S3 Anda secara langsung lewat **External Table** (`CREATE EXTERNAL TABLE ... OPTIONS(format='PARQUET', uris=['gs://kopiku-lake/orders/*.parquet'])`), atau memuatnya ke dalam **Native Table**:
- **External Table:** Nol biaya duplikasi storage di warehouse; cocok untuk arsip log dingin atau eksplorasi sesekali. Namun, perencanaan query lebih lambat dan optimasi clustering/BI Engine lebih terbatas (kecuali memakai **BigLake / tabel Iceberg**).
- **Native Table + Mart Rollup Pra-Agregasi untuk BI:** Untuk dashboard eksekutif di Tableau atau Looker, simpan fakta atomik di tabel native terpartisi/terklaster, lalu bangun **Tabel Target Rollup** (`mart_daily_store_rollup` pada grain `(order_date, store_id, product_category)`). Mengarahkan Tableau ke rollup harian berisi 50.000 baris alih-alih tabel fakta 2 miliar baris berarti setiap filter membaca 40.000 kali lebih sedikit baris (2.000.000.000 / 50.000), dan di warehouse yang menagih per byte yang dipindai, tagihannya ikut menyusut.

> 🛠 **Coba sendiri (15 menit, Python dengan DuckDB).** Muat baris `data/orders.csv` yang `total_idr`-nya hanya angka dan `order_ts`-nya lolos `TRY_CAST`, lalu buat tabel fakta yang lebih besar dengan mengulangnya 300 kali (`CROSS JOIN range(300)`), berisi `order_date`, `payment_method`, `status` (diubah ke huruf kecil dan di-trim: file-nya menulisnya dengan beberapa cara), dan `total_idr`. Bangun rollup pada grain `(order_date, payment_method, status)` dengan `count(*)` dan `sum(total_idr)`. Jawab pertanyaan dashboard "pendapatan per metode pembayaran, bukan cancelled, 10 sampai 16 Januari" dari kedua tabel, pastikan jawabannya identik, dan ukur setiap query lima kali.
>
> **Seharusnya Anda melihat:** `1061700` baris fakta dan `557` baris rollup, empat total yang sama dari keduanya (`bank_transfer` pertama dengan `20436000000`), dan median sekitar `13` ms pada tabel fakta melawan `3` ms pada rollup. Di warehouse yang menagih per byte yang dipindai, selisih itu juga berupa uang, bukan hanya waktu. Rollup hanya berhasil karena setiap filter di dashboard adalah kolom pada grain-nya: minta pendapatan per pelanggan dan ia tidak bisa menjawab. Diukur dengan DuckDB 2.0.1 pada data bawaan kursus.

## @part Stack data Microsoft

## @lesson Azure dan Microsoft Fabric: ADLS, Data Factory, Synapse, dan OneLake
Azure muncul di **41,7%** dari 1.134 lowongan data engineering di TalentHub (2026-07-23 sampai 2026-11-21), lebih banyak daripada AWS (41,4%) atau Google Cloud (28,0%) dalam hitungan yang sama. **Azure Data Factory** muncul di 17,1%, **Microsoft Fabric** di 10,7%, dan **Azure Synapse** di 10,1%. Tidak ada yang benar-benar baru bagi Anda: setiap layanan Microsoft di bawah mengerjakan tugas yang sudah Anda kerjakan dengan alat open source di kursus ini. Pelajari pemetaan dan namanya, dan lowongan yang penuh istilah Microsoft menjadi mudah dibaca.

| Yang Anda bangun di kursus ini | Di Azure | Di Microsoft Fabric |
|---|---|---|
| Object storage (S3 di Modul 2.1) | **ADLS Gen2**: Blob Storage dengan hierarchical namespace, sehingga folder sungguhan dan rename murah | **OneLake**, dibangun di atas ADLS: satu lake untuk seluruh organisasi |
| Ingestion dan orkestrasi (Modul 1.6, 2.4) | Pipeline **Azure Data Factory** | **Data Factory** di Fabric (pipeline dan Dataflow Gen2) |
| SQL warehouse (Modul 2.6, T-SQL di 1.3) | **Synapse** dedicated SQL pool, **Azure SQL Database** | **Fabric Warehouse** (T-SQL) |
| Spark (Modul 3.1) | **Azure Databricks**, Synapse Spark pool | **Data Engineering** di Fabric (notebook, Spark) |
| Tabel lakehouse (Modul 2.2) | Tabel Delta di ADLS | Item **Lakehouse**: tabel Delta Parquet atau Iceberg di OneLake |
| Streaming (Modul 3.2, 3.3) | **Event Hubs** (juga menerima klien Kafka) | **Real-Time Intelligence** |
| BI (Modul 1.4) | **Power BI** | Power BI, membaca OneLake langsung |

**Azure Data Factory (ADF) dalam enam kata.** Dokumentasi Microsoft mendefinisikan bagian-bagiannya, dan masing-masing setara dengan sesuatu yang Anda kenal:
- **Pipeline** adalah "pengelompokan logis aktivitas yang bersama-sama menjalankan satu tugas": DAG di Modul 2.4.
- **Activity** adalah satu langkah: *Copy* (memindahkan data antarpenyimpanan), *Lookup* (membaca satu nilai), *Stored Procedure*, *Notebook*, *ForEach*, *If Condition*.
- **Linked service** "mirip sekali" dengan connection string: di mana penyimpanannya dan cara login.
- **Dataset** adalah "tampilan data yang diberi nama" di dalam sebuah linked service: satu tabel, satu folder, satu pola file.
- **Trigger** memulai pipeline: menurut jadwal jam dinding, sesuai permintaan, dan tipe lain seperti tumbling window dan event penyimpanan.
- **Integration runtime** adalah komputasi yang mengerjakannya. Versi Azure menjangkau endpoint publik; **self-hosted integration runtime** adalah program kecil yang Anda pasang di dalam jaringan perusahaan, sehingga ADF bisa menjangkau SQL Server on-premises atau jaringan privat tanpa membukanya ke internet. Perusahaan yang menyimpan data di server sendiri, termasuk bank, menghubungkan ADF dengan cara ini.

Activity saling meneruskan nilai dengan ekspresi seperti `@{activity('LookupOldWaterMarkActivity').output.firstRow.WatermarkValue}`, dan setiap pipeline disimpan sebagai JSON, yang bisa disimpan ADF di Git. Perlakukan JSON itu seperti kode: review, beri versi, deploy lewat CI (Modul 3.4), jangan hanya diklik di portal.

**Synapse dan Fabric.** Synapse (2019) menyatukan warehouse, Spark, dan pipeline dalam satu workspace Azure. **Fabric** (2023) melangkah lebih jauh: ia software as a service dengan satu lake untuk setiap workload. Microsoft menyatakan engine Fabric (T-SQL, Spark, Analysis Services, dan lainnya) semuanya menyimpan tabel di OneLake dalam format terbuka **Delta Parquet**, sehingga tabel yang ditulis warehouse bisa dibaca notebook Spark tanpa disalin. Dua gagasan Fabric datang langsung dari *Fundamentals of Data Engineering*:
- **Shortcut** adalah "objek di OneLake yang menunjuk ke lokasi penyimpanan lain" (ADLS, S3, Google Cloud Storage, dan lainnya); ia "berperilaku seperti symbolic link". Membaca lewat shortcut adalah **data virtualization**: data tetap di tempatnya dan di-query di sana.
- **Mirroring** "terus-menerus mereplikasi data dari database operasional ke OneLake sebagai tabel Delta yang siap untuk analitik": change data capture (Modul 3.2) sebagai fitur terkelola.

Microsoft menerbitkan rencana migrasi dan *Fabric Migration Assistant* untuk memindahkan Synapse dedicated SQL pool ke Fabric Warehouse, yang menunjukkan arah platformnya: harapkan sistem Synapse yang sudah ada di pekerjaan brownfield dan Fabric di proyek baru.

**Berlatih tanpa akun perusahaan.** Bagian Azure dan Fabric di pelajaran ini tidak dijalankan untuk kursus ini, karena butuh akun. Pilihan Anda: **trial Fabric** memberi akses gratis selama 60 hari (sebagai kapasitas F4 atau F64); **Azure for Students** memberi kredit US$100 tanpa kartu kredit, memakai alamat e-mail akademik; akun Azure biasa memberi beberapa layanan gratis selama 12 bulan pertama. Sisanya berjalan lokal: T-SQL di Docker (Modul 1.3), tabel Delta dengan `deltalake` (Modul 2.2), Power BI Desktop di Windows (Modul 1.4), dan pola Data Factory di bawah.

**Mewarisi alat ETL berbasis GUI.** Selain Data Factory, lowongan menyebut **SSIS** (SQL Server Integration Services, 6,1%), **Talend** (4,7%), **Informatica** (4,1%), dan **Pentaho** (2,0%); jika Data Factory dan konektor terkelola seperti Fivetran ikut dihitung, **30,2%** menyebut setidaknya satu alat semacam ini. Anda lebih sering merawat atau memigrasikan alat ini daripada memulai dengannya, dan semuanya punya bentuk yang sama:
- **Koneksi** (*connection manager* di SSIS, *linked service* di ADF): di mana setiap sumber dan target berada. Daftar dulu semuanya; itulah lineage Anda.
- **Control flow**: urutan langkah dan apa yang terjadi saat gagal (di SSIS, task yang dihubungkan *precedence constraint*). Inilah DAG-nya.
- **Data flow**: sumber, transformasi (lookup, derived column, conditional split), tujuan. Sebagian besar logika bisnis tersembunyi di sini, atau di SQL sebuah task *Execute SQL* yang memanggil stored procedure.
- **Parameter dan variabel**: tanggal, path, dan nama environment, hal-hal yang berubah antar-run.
- **Jadwal**: paket SSIS biasanya di-deploy ke katalog SSIS (`SSISDB`) dan dijalankan oleh job **SQL Server Agent**; periksa riwayat Agent sebelum mengubah apa pun.

Paket SSIS adalah file `.dtsx`, yaitu XML: Anda bisa mencarinya dengan `grep` untuk nama tabel dan SQL, dan membandingkan dua versinya di Git. Untuk memigrasikannya, lakukan seperti pola strangler fig di Pelajaran 7: bangun ulang satu output setiap kali, jalankan yang lama dan yang baru berdampingan, bandingkan jumlah baris dan totalnya, dan pindah hanya ketika keduanya cocok. Konektor terkelola (Fivetran, Airbyte, copy activity Data Factory) hanya mengerjakan bagian *extract dan load*: transformasinya pindah ke SQL atau dbt.

> 🛠 **Coba sendiri (25 menit, SQL Server di Docker dari Modul 1.3).** Tutorial Microsoft *Incrementally copy a table using Azure portal* membangun pola ADF yang paling umum: dua activity **Lookup** membaca watermark lama (dari `watermarktable`) dan yang baru (`MAX(LastModifytime)` dari sumber), activity **Copy** menyalin baris dengan `LastModifytime > lama AND <= baru`, dan activity **Stored Procedure**, `usp_write_watermark`, menyimpan watermark baru. Buat `data_source_table` dari tutorial itu (5 orang, diubah 2017-09-01 sampai 2017-09-05), `watermarktable`-nya (mulai 2010-01-01), dan `usp_write_watermark` di database `kopiku` Anda. Lalu tulis `usp_run_pipeline @run_no` yang menjalankan keempat activity secara berurutan, menyalin ke tabel `sink_copy` yang mencatat `run_no`. Jalankan; tambahkan baris 6 (2017-09-06 02:23) dan 7 (2017-09-07 09:01) dari tutorial dan jalankan lagi; jalankan sekali lagi tanpa perubahan. Terakhir, sisipkan baris 8 dengan `LastModifytime` 2017-09-06 23:00, seolah-olah tertahan di suatu tempat, dan jalankan untuk keempat kalinya. Bandingkan baris di sumber dengan baris yang tersalin.
>
> **Seharusnya Anda melihat:** run 1 memindahkan watermark dari `2010-01-01` ke `2017-09-05 08:06` dan menyalin `5` baris, run 2 menyalin `2`, run 3 menyalin `0`. Run 4 juga menyalin `0`: baris 8 bertanda waktu sebelum watermark yang tersimpan (`2017-09-07 09:01`), sehingga sumber berakhir dengan `8` baris dan salinan dengan `7`, dan tidak ada error yang memberi tahu Anda. Watermark memercayai jam milik sumber. Ini masalah "ties dan late updates" di Modul 1.6, dan obatnya sama: baca ulang sedikit tumpang tindih sebelum watermark dan buat pemuatannya idempoten, atau pilih menurut waktu baris dimuat alih-alih timestamp bisnis, seperti model dbt di Modul 2.3. Diukur pada SQL Server 2025 (17.0) di Docker.

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

> 💡 **Jeda Praktik 6 (Verifikasi Lengkap & Bukti Kode):**
> 1. Di terminal, jalankan seluruh rangkaian uji otomatis:
>    `pytest labs/mod-2-6/test_lab.py -v`
> 2. Hasilkan kode bukti verifikasi kelulusan:
>    `python3 scripts/prove.py mod-2-6`
> 3. **Indikator Sukses:** Seluruh 42 pengujian berstatus `PASSED` (100% lulus dalam < 1 detik) dan token bukti tercetak di terminal.

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

### Mengapa setiap record yang dikirim reverse ETL ke CRM membawa idempotency key yang deterministik?
- [ ] Agar CRM bisa mengurutkan record yang masuk sesuai urutan perhitungan di warehouse
- [ ] Untuk mengenkripsi data pelanggan selama berpindah antara warehouse dan CRM
- [x] Agar pengulangan memperbarui record yang sama, bukan memicu tindakannya dua kali
- [ ] Karena CRM menolak setiap request yang tidak membawa id acak unik di header-nya

> Tool itu bertindak berdasarkan apa yang Anda kirim (email, penawaran). Key yang dibangun dari isi record membuat pengulangan tidak berbahaya: isi sama, key sama, satu efek.

### Apa yang diminta pola strangler fig terhadap pipeline lama yang Anda warisi?
- [x] Bangun ulang satu metrik demi satu, jalankan lama dan baru berdampingan, jelaskan selisihnya, lalu pindah
- [ ] Bekukan pipeline lama dan tulis ulang semuanya sekaligus dalam satu akhir pekan panjang dengan rencana tes
- [ ] Pertahankan pipeline lama selamanya dan bangun fitur baru di sistem terpisah di sebelahnya
- [ ] Hapus kode lama lebih dulu agar tidak ada yang bergantung padanya, lalu bangun ulang dari kebutuhannya

> Setiap selisih antara lama dan baru adalah bug di kode baru atau bug lama yang baru Anda temukan. Konsumen baru dipindahkan setelah angkanya terjelaskan.

### Azure Data Factory harus menyalin tabel dari SQL Server di dalam jaringan privat sebuah bank. Apa yang dibutuhkan?
- [ ] Alamat IP publik pada SQL Server agar integration runtime Azure bisa terhubung
- [x] Self-hosted integration runtime yang dipasang di dalam jaringan, dekat server itu
- [ ] Shortcut Fabric yang menunjuk ke file data SQL Server di disk lokal server tersebut
- [ ] Trigger tumbling window, karena trigger jadwal tidak bisa menjangkau server privat

> Integration runtime Azure menjangkau endpoint publik. Self-hosted integration runtime berjalan di dalam jaringan privat dan terhubung keluar ke Data Factory, sehingga database tidak perlu dibuka ke luar.

## @resources
- [Dokumentasi Snowflake: micro-partition dan data clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [Dokumentasi BigQuery: tabel berpartisi dan ter-cluster](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [Dokumentasi Amazon Redshift: gaya distribusi](https://docs.aws.amazon.com/redshift/latest/dg/c_choosing_dist_sort.html)
- [Dokumentasi Snowflake: menyiapkan file data untuk dimuat](https://docs.snowflake.com/en/user-guide/data-load-considerations-prepare)
- [Amazon Redshift: praktik terbaik memuat data](https://docs.aws.amazon.com/redshift/latest/dg/c_loading-data-best-practices.html)
- [BigQuery: memperkirakan dan mengendalikan biaya](https://cloud.google.com/bigquery/docs/best-practices-costs)
