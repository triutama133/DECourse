---
title: Komputasi Terdistribusi dan Internal Apache Spark
duration: 4 minggu
summary: Pahami bagaimana Apache Spark membagi beban komputasi ke klaster mesin, pelajari cara membaca physical execution plans, serta kenali dan atasi masalah paling krusial di dunia nyata (shuffle networks, bad joins, data skew) melalui pengukuran nyata pada dataset dengan hot key.
why: Banyak kursus hanya mengajarkan cara memanggil groupBy().count() di tutorial mainan. Di lingkungan produksi nyata, sebuah job 100 GB bisa tersangkut di angka 99% selama berjam-jam karena satu key menampung mayoritas baris data, satu task memikul seluruh beban komputasi, sementara ratusan core klaster menganggur menunggunya.
---

## @outcomes
- Menjelaskan kapan penggunaan distributed engine benar-benar dibenarkan, serta menguraikan fungsi driver, executor, job, stage, task, dan partisi pada Apache Spark
- Membedakan transformasi narrow vs wide, serta mengidentifikasi titik terjadinya shuffle network di dalam physical execution plan
- Memilih strategi join yang optimal (broadcast hash join vs sort-merge join), serta menjelaskan mekanisme kerja Catalyst optimizer, Tungsten engine, dan Adaptive Query Execution (AQE)
- Mendiagnosis anomali data skew melalui metrik ukuran partisi dan Spark UI, serta menyelesaikannya menggunakan broadcast join, AQE skew join handling, atau teknik salting
- Menerapkan prinsip-prinsip utama manajemen memori dan performa eksekusi pada aplikasi PySpark

## @prereq
Modul 2.1 (Parquet, engine pemrosesan, batas kapasitas mesin tunggal) dan Modul 1.3 (join relational, execution plans). Wajib terinstal Java versi 17 atau lebih baru (`java -version`) dan dependensi Python via `pip install -r labs/mod-3-1/requirements.txt`. Lab modul ini mengeksekusi Spark dalam local mode langsung di komputer Anda.

## @lesson Kapan Anda butuh cluster, dan berapa biaya yang harus dibayar
Modul 2.1 ditutup dengan aturan emas arsitektur: satu mesin fisik modern dengan arsitektur memori teroptimasi (DuckDB atau Polars) mampu melangkah jauh lebih jauh daripada perkiraan mayoritas tim data. Namun saat skala data melampaui batas fisik mesin tunggal tersebut, **Apache Spark** adalah engine terdistribusi yang menjadi standar emas industri: ia memecah dataset raksasa menjadi potongan-potongan **partisi**, memprosesnya secara paralel melintasi ratusan mesin dalam sebuah klaster, lalu menggabungkan hasil akhirnya.

Kapan Anda benar-benar membutuhkan Spark: volume data (atau kompleksitas komputasi) sudah tidak muat lagi di dalam kapasitas disk, RAM, dan batas toleransi waktu satu mesin; Anda membutuhkan throughput komputasi dari ratusan CPU cores secara paralel; atau organisasi tempat Anda bekerja sudah memiliki platform Spark terkelola (seperti Databricks, AWS EMR, Google Cloud Dataproc, atau Apache Spark on Kubernetes) lengkap dengan tata kelola keamanan dan integrasinya. Kapan Anda **tidak** membutuhkannya: untuk memproses data Parquet berukuran beberapa ratus gigabyte, menjalankan DuckDB atau Polars di satu VM berukuran besar sering kali jauh lebih cepat, hemat, dan tidak rumit.

Mengoperasikan klaster terdistribusi memiliki harga operasional nyata yang mahal:

- **Beban Koordinasi (Coordination Overhead).** Menginisiasi job, menjadwalkan task ke worker, dan memindahkan data antar mesin membutuhkan waktu handshake. Sebuah job berukuran kecil jika dijalankan di Spark justru akan berjalan jauh lebih lambat daripada skrip Python sederhana di laptop.
- **Kemacetan Jaringan (The Network Bottleneck).** Data yang terpaksa berpindah antar mesin melintasi kabel jaringan (dikenal sebagai operasi **shuffle**) memiliki latensi beberapa kali lipat lebih lambat dibandingkan data yang diproses lokal di memori CPU. Hampir seluruh seni optimasi performa Spark berpusat pada satu misi: *memindahkan lebih sedikit data melalui jaringan, dan sesedikit mungkin frekuensinya*.
- **Pola Kegagalan Baru (New Failure Modes).** Fenomena data skew (ketimpangan distribusi data), tekanan memori JVM pada satu executor, mesin worker yang mendadak mati (spot instance reclamation), serta kompleksitas investigasi log lintas ratusan kontainer.
- **Biaya Finansial (Cloud Cost).** Klaster cloud yang dibiarkan menyala menganggur atau dikonfigurasi secara boros tanpa optimasi adalah cara tercepat menghabiskan anggaran cloud perusahaan.

Gunakan Spark hanya ketika hasil pengukuran metrik membuktikan bahwa satu mesin fisik tidak lagi memadai, lalu kuasai mekanisme internalnya agar Anda dapat memanfaatkan daya komputasi klaster tersebut secara efisien.

## @lesson Arsitektur: driver, executor, stage, dan task
Sebuah aplikasi Apache Spark (**Spark Application**) terdiri dari komponen runtime utama:

- **Driver**: proses komputasi utama yang mengeksekusi fungsi `main()` dari program Anda. Driver bertugas menganalisis kode, membangun execution plan, membaginya menjadi potongan-potongan stage, dan menjadwalkan task ke para pekerja. Memori driver menampung rencana DAG dan seluruh data yang Anda tarik secara eksplisit melalui perintah `collect()`.
- **Executors**: proses worker (JVM instances) yang berjalan di mesin-mesin klaster. Setiap executor memiliki alokasi memori tertentu dan sejumlah **CPU cores**; setiap core mengeksekusi tepat satu task pada satu waktu.
- **Cluster Manager**: komponen infrastruktur yang mengalokasikan mesin fisik ke aplikasi Spark (seperti standalone manager bawaan Spark, Apache YARN, Kubernetes, atau cloud managed control plane). Dalam **local mode** (`master("local[4]")`, seperti yang digunakan pada lab modul ini), driver dan empat worker threads berbagi satu proses JVM yang sama: lingkungan sempurna untuk pembelajaran dan pengujian otomatis tanpa biaya cloud.

Hirarki pembagian kerja di Spark dibagi ke dalam lapisan-lapisan yang wajib Anda pahami saat membaca Spark UI:

| Istilah | Makna Operasional |
|---|---|
| **Job** | Setiap kali kode memicu sebuah action (`count()`, `write`, `collect()`), Spark meluncurkan tepat satu Job |
| **Stage** | Sekumpulan task yang dapat dieksekusi secara berurutan tanpa perlu memindahkan data melintasi jaringan; batas Stage ditentukan oleh operasi shuffle |
| **Task** | Unit kerja terkecil dari sebuah Stage yang memproses **satu partisi data**; unit inilah yang dieksekusi pada satu CPU core |
| **Partition** | Potongan slice logis dari dataset; satu partisi fisik bersesuaian dengan tepat satu task eksekusi |

Sebagai contoh: sebuah DataFrame dengan 200 partisi yang dieksekusi di atas klaster dengan total 50 CPU cores akan menjalankan 50 task secara simultan, diselesaikan dalam empat "gelombang (waves)" eksekusi. Oleh karena itu, **jumlah dan ukuran partisi** adalah kenop kontrol paling vital di Spark: partisi yang terlalu sedikit membuat CPU cores menganggur tanpa pekerjaan, partisi yang terlalu banyak menghabiskan waktu sia-sia untuk overhead penjadwalan ribuan task mini, dan sedikit partisi berukuran raksasa (data skew) akan membuat seluruh klaster lumpuh menunggu satu worker lambat. Ukuran partisi yang sehat di lingkungan produksi berada di rentang **100 MB hingga 200 MB**.

Cara kerja kode PySpark: Anda menulis ekspresi DataFrame atau query SQL di Python; instruksi tersebut langsung diterjemahkan menjadi rencana eksekusi JVM; task kemudian dieksekusi oleh engine JVM di dalam executor. Pustaka **PySpark** hanyalah lapisan tipis wrapper: operasi DataFrame standar tidak pernah mengeksekusi runtime Python terhadap baris data, itulah sebabnya performanya setara dengan Java murni. Kode Python baru benar-benar dieksekusi di executor saat Anda menggunakan Python **UDF (User Defined Functions)**, yang membawa penalti performa sangat berat.

## @lesson Lazy evaluation, transformasi narrow dan wide
Operasi komputasi di Apache Spark terbagi menjadi dua kategori fundamental:

- **Transformations** (`filter`, `select`, `withColumn`, `join`, `groupBy`): mendeskripsikan DataFrame baru dan **tidak mengeksekusi komputasi apa pun**. Pemanggilan fungsi ini hanya menyusun execution plan di memori driver.
- **Actions** (`count`, `collect`, `show`, `write`): memerintahkan engine untuk mengeksekusi keseluruhan rancangan plan yang telah disusun.

Sifat **eksekusi malas (lazy evaluation)** ini memungkinkan Spark melihat seluruh rantai pipeline data dari awal hingga akhir sebelum memutar roda komputasi. Dengan demikian, pengoptimal query dapat melakukan optimasi tingkat tinggi: membuang kolom yang tidak terpakai (column pruning), mendorong filter langsung ke pembacaan file Parquet di disk (predicate pushdown), dan menyusun ulang urutan join. Namun konsekuensinya, error logika baru akan meledak saat action dipanggil, dan memanggil dua action pada DataFrame yang sama akan mengeksekusi ulang seluruh pipeline dari nol kecuali jika Anda menyimpannya di cache (`cache()` atau `persist()`).

Transformasi data dibedakan berdasarkan pola aliran datanya:

- **Narrow Transformations** (`filter`, `select`, `map`, `withColumn`): setiap partisi output hanya bergantung pada tepat satu partisi input. Tidak ada perpindahan data antar mesin. Rangkaian transformasi narrow digabungkan (pipelined) ke dalam satu Stage yang sama.
- **Wide Transformations** (`groupBy`, `join`, `distinct`, `orderBy`, `repartition`): setiap partisi output membutuhkan data yang berasal dari *banyak* partisi input, sehingga baris-baris data harus didistribusikan ulang berdasarkan hash key melintasi kabel jaringan klaster. Peristiwa ini disebut **shuffle**, dan menjadi penanda **batas antar-Stage (stage boundary)**: stage sebelumnya menulis output perantara ke disk lokal executor berdasarkan partisi hash key baru, kemudian stage berikutnya mengambil potongan data tersebut melalui jaringan.

Anda dapat mengamati fenomena ini secara transparan melalui rencana eksekusi fisik (`df.explain()`). Berikut adalah representasi query agregasi group-by dari lab praktikum:

```text
* HashAggregate (5)                      <- final aggregation, after the shuffle
+- Exchange (4)                          <- the SHUFFLE: hashpartitioning(customer_id, 8)
   +- * HashAggregate (3)                <- partial aggregation BEFORE the shuffle
      +- * Project (2)
         +- * Range (1)
```

Baca rencana eksekusi dari baris paling bawah ke atas. Perhatikan bahwa Spark melakukan pra-agregasi parsial *sebelum* data dikirim lewat jaringan (**map-side combine**) agar data yang dikirim lewat shuffle hanyalah subtotal parsial dan bukan jutaan baris mentah: optimasi otomatis cerdas yang disediakan oleh engine. Node bertuliskan `Exchange` adalah node yang wajib Anda cermati: **hitung jumlah node Exchange dalam plan, maka Anda akan mengetahui secara pasti berapa kali operasi shuffle jaringan terjadi.** Dalam lab praktikum, Anda akan membangun fungsi pendeteksi ini: pipeline narrow menghasilkan 0 Exchange, sebuah group-by menghasilkan 1 Exchange, dan sebuah sort-merge join menghasilkan 2 Exchange (satu untuk masing-masing sisi tabel).

Dua kaidah emas performa: (1) action mahal pada DataFrame yang tidak di-cache akan dihitung ulang setiap kali dipanggil, maka gunakan `df.cache()` pada DataFrame yang digunakan berulang kali dan lepaskan dengan `df.unpersist()`; (2) rancangan query yang unggul adalah rancangan dengan **jumlah shuffle paling minimal** dan **volume data shuffle sekecil mungkin**, yang berarti memfilter baris dan membuang kolom yang tidak perlu sebelum operasi join atau group-by dilakukan.

## @lesson Sang pengoptimal: Catalyst, Tungsten, dan Adaptive Query Execution (AQE)
Baik Anda menulis query menggunakan DataFrame API maupun Spark SQL murni, seluruh instruksi melewati engine internal yang sama melalui tiga pilar teknologi:

1. **Catalyst Query Optimizer**: engine pengoptimal logis yang mengubah query deklaratif Anda menjadi *logical plan*. Catalyst menerapkan aturan transformasi berbasis aturan (rule-based rewrites) seperti **predicate pushdown**, **column pruning**, penyederhanaan ekspresi konstanta, penataan ulang urutan join berdasarkan statistik data, hingga menghasilkan serangkaian alternatif *physical plan* yang paling efisien. Inilah alasan mengapa DataFrame selalu mengalahkan kode RDD tulisan tangan: engine memahami intensi semantik kode Anda dan mampu mengoptimalkannya.
2. **Tungsten Engine**: engine eksekusi level hardware yang menyimpan data dalam format biner terpadu yang sangat kompak (sering kali dialokasikan di luar JVM off-heap memory) untuk meminimalkan beban garbage collection (GC). Tungsten menerapkan **whole-stage code generation**: seluruh operator dalam satu stage dikompilasi saat runtime menjadi satu fungsi bytecode Java monolitik tanpa adanya overhead virtual function call di setiap baris data. Tanda bintang `*` di depan nama operator pada physical plan menandakan bahwa operator tersebut telah tergabung dalam whole-stage codegen.
3. **Adaptive Query Execution (AQE)**: fitur modern yang aktif secara default di Spark versi 3 ke atas. Sebelum query berjalan, estimasi ukuran data sering kali meleset; AQE menyelesaikan dilema ini dengan mengevaluasi ulang rencana eksekusi *secara dinamis saat runtime* berdasarkan ukuran data aktual yang tercatat pasca-shuffle. AQE mampu **menggabungkan (coalesce)** ratusan partisi shuffle mini menjadi sedikit partisi ideal, **mengubah sort-merge join menjadi broadcast join secara otomatis** jika salah satu sisi ternyata berukuran kecil setelah difilter, serta **memecah partisi yang mengalami data skew** menjadi sub-partisi kecil.

Keahlian membaca physical plan adalah kompetensi wajib data engineer senior: gunakan perintah `df.explain("formatted")` dan cermati (a) **tipe strategi join**, (b) node **Exchange** dan skema partisi hash-nya, (c) apakah **filter dan seleksi kolom didorong langsung ke dalam scan storage** (pushdown), serta (d) **jumlah partisi eksekusi**. Tab SQL pada antarmuka web Spark UI menampilkan diagram visual yang sama lengkap dengan jumlah baris nyata dan durasi waktu eksekusi setiap operator.

## @lesson Strategi join dan biaya shuffle
Operasi join pada sistem terdistribusi bertugas mempertemukan baris data yang memiliki nilai kunci (key) yang sama ke satu node mesin yang sama. Spark memilih salah satu strategi join berikut:

| Strategi Join | Cara Kerja Arsitektur | Kapan Digunakan |
|---|---|---|
| **Broadcast Hash Join (BHJ)** | Sisi tabel kecil disalin utuh ke seluruh executor; setiap partisi tabel besar melakukan join lokal di memori. **Nol shuffle pada tabel besar.** | Salah satu tabel berukuran kecil (di bawah threshold `spark.sql.autoBroadcastJoinThreshold`, default 10 MB) |
| **Sort-Merge Join (SMJ)** | Kedua sisi tabel di-shuffle melintasi jaringan berdasarkan join key dan diurutkan (sorted); partisi yang cocok digabungkan | Kedua tabel sama-sama berukuran besar (strategi default untuk big data) |
| **Shuffle Hash Join (SHJ)** | Kedua tabel di-shuffle berdasarkan join key; hash table dibangun di memori dari sisi yang lebih kecil | Ukuran data sedang dan biaya sorting dinilai terlalu mahal |
| **Broadcast Nested Loop / Cartesian** | Membandingkan setiap pasang baris data secara cross product | Query join tanpa kondisi kesamaan (non-equality joins): sangat berbahaya dan boros |

Dampak pemilihan strategi join sangat dramatis bahkan di laptop pengujian lokal. Pada pengujian join antara 3 juta baris tabel event dan 1.001 baris tabel customer menggunakan 4 CPU cores di lab modul ini, query yang sama membutuhkan waktu **2,58 detik dengan Sort-Merge Join** dan melesat menjadi hanya **0,85 detik dengan Broadcast Hash Join**—tiga kali lipat lebih kencang—karena tabel event raksasa sama sekali tidak perlu di-shuffle lewat jaringan. Perbedaan ini terlihat jelas pada physical plan:

```text
SortMergeJoin Inner          BroadcastHashJoin Inner BuildRight
:- Exchange   (shuffle)      +- BroadcastExchange   (the small side only)
+- Exchange   (shuffle)
```

Aturan praktis lapangan: **jika salah satu tabel berukuran kecil, lakukan broadcast secara eksplisit** (`F.broadcast(small_df)`, atau naikkan threshold broadcast) dan periksa kembali physical plan. Jika kedua tabel sama-sama raksasa, operasi shuffle tidak dapat dihindari, maka buat proses shuffle seringan mungkin: filter baris sedini mungkin, pilih kolom yang relevan saja, dan tentukan jumlah partisi yang seimbang.

**Shuffle Partitions.** Jumlah partisi yang dihasilkan pasca-shuffle dikendalikan oleh konfigurasi `spark.sql.shuffle.partitions` (bernilai default 200). Untuk data berukuran kecil, angka 200 terlalu banyak (menciptakan overhead 200 task kerdil); untuk data raksasa ratusan gigabyte, angka 200 terlalu sedikit (partisi menjadi terlalu besar hingga tumpah/spill ke disk). Mekanisme auto-coalescing AQE menangani kasus pertama secara otomatis; namun untuk data masif, Anda wajib menyetel parameter ini agar setiap partisi pasca-shuffle memiliki ukuran ideal sekitar **100 MB hingga 200 MB**.

**Mengapa shuffle sangat mahal?** Setiap operasi shuffle melibatkan serialisasi objek ke byte, penulisan ke disk lokal worker, transfer paket via kartu jaringan, dan deserialisasi kembali di sisi penerima, ditambah fakta bahwa stage downstream tidak dapat dimulai sebelum seluruh task stage upstream selesai. Teknik menghindari shuffle: terapkan broadcast join, agregasi data sebelum di-join, lakukan teknik **bucketing** pada tabel Parquet/Delta/Iceberg berdasarkan join key (dihitung sekali saat penulisan, mengeliminasi shuffle di seluruh query join di masa depan), serta hindari operasi `distinct` dan `orderBy` global pada dataset mentah jika tidak benar-benar dibutuhkan.

## @lesson Data skew: ketika satu task memikul seluruh beban komputasi
Operasi shuffle memetakan seluruh baris data yang memiliki nilai hash key yang sama ke dalam satu partisi yang sama. Jika nilai key di dunia nyata **terdistribusi secara tidak merata** (**data skew**), satu partisi akan menerima volume data yang jauh lebih masif dibandingkan partisi lainnya. Karena durasi total sebuah stage ditentukan oleh **task yang paling lambat (straggler)**, maka keseluruhan stage akan tertahan menunggu satu task tersebut sementara ratusan CPU cores lainnya menganggur. Gejala klasiknya di Spark UI: indikator progres stage menunjukkan status "199 of 200 tasks complete" dan tersangkut di angka tersebut selama berjam-jam.

Data skew hampir selalu disebabkan oleh keberadaan **hot key**. Penyebab paling lazim di industri: nilai default atau placeholder (`customer_id = 0` atau `-1` untuk transaksi anonim tanpa akun, string kosong `''`), nilai `NULL` (seluruh null dikelompokkan ke satu partisi dalam group-by), produk viral yang mendominasi transaksi toko, aktivitas akun bot crawling, atau kode wilayah negara tertentu yang mendominasi populasi pengguna.

Dataset praktikum modul ini mensimulasikan kondisi nyata di mana 70% event transaksi dimiliki oleh `customer_id = 0`. Setelah dilakukan hash partitioning ke dalam 8 partisi, sebaran ukuran partisi menjadi:

```text
[2,200,366  121,618  121,124  120,272  113,221  112,257  109,813  101,329]    (3,000,000 rows)
largest / median = 18.8          (the same data with uniform keys: 1.08)
```

Satu partisi menampung **73%** dari total data! Task yang menangani partisi tersebut harus memproses data 18 kali lipat lebih banyak dibandingkan task normal. Di klaster produksi nyata, kondisi ini menyebabkan satu task berjalan berjam-jam, memori executor tertekan hebat (tumpah ke disk melalui disk spill, atau mati total akibat JVM Out-Of-Memory error), dan pemborosan biaya server klaster yang luar biasa.

**Cara mendiagnosis di Spark UI.** Buka stage yang lambat dan amati tabel **Task Metrics Summary**: jika metrik *Max* durasi task atau *Shuffle Read Size* bernilai puluhan kali lipat lebih tinggi daripada nilai *Median*, itu adalah bukti mutlak terjadinya data skew. Munculnya indikator "Spill (Memory)" dan "Spill (Disk)" pada task tersebut semakin mengonfirmasinya. Di level kode, hitung nilai **skew ratio** (ukuran partisi terbesar dibagi ukuran partisi median) seperti yang Anda bangun di lab; rasio di atas 5 menandakan masalah serius.

**Solusi penanganan skew, dari yang paling sederhana hingga mahir:**

1. **Pisahkan atau filter hot key.** Jika nilai hot key hanyalah data sampah (NULL atau placeholder tanpa atribut), filter data tersebut sebelum shuffle. Jika data tersebut valid (seperti transaksi tamu anonim), pisahkan alur logikanya: proses `customer_id = 0` secara independen tanpa operasi join (karena tamu tidak memiliki profil customer di tabel master), lalu lakukan operasi `union` dengan hasil join data normal lainnya.
2. **Lakukan broadcast pada sisi tabel kecil.** Jika salah satu tabel berukuran kecil, tabel besar tidak akan di-shuffle sama sekali, sehingga masalah skew lenyap seketika. Pada lab modul ini, opsi broadcast adalah yang tercepat (0,85 detik).
3. **Aktifkan pemecahan partisi adaptif (AQE Skew Join).** Dengan mengaktifkan `spark.sql.adaptive.skewJoin.enabled = true`, engine Spark secara otomatis mendeteksi partisi shuffle yang ukurannya melampaui batas median, memecah partisi raksasa tersebut menjadi sub-partisi kecil, dan menduplikasi baris pasangan dari tabel lawan. Physical plan akan menampilkan label `SortMergeJoin(skew=true)`. Di lab modul ini, join yang sama selesai dalam **0,93 detik** (turun dari 2,58 detik) dengan hasil yang identik sempurna, tanpa perlu mengubah satu baris pun logika kode aplikasi.
4. **Teknik Salting.** Tambahkan kolom acak **salt** (bernilai integer dari 0 hingga N-1) pada tabel besar yang mengalami skew, sehingga satu hot key terpecah menjadi N kombinasi key baru `(key, salt)`; kemudian pada tabel kecil pasangannya, gandakan setiap baris sebanyak N kali (menggunakan fungsi explode array) untuk setiap kemungkinan nilai salt; lalu lakukan join pada pasangan kunci majemuk `(key, salt)`. Hot key kini terdistribusi merata ke N partisi berbeda:

```python
SALT = 8
large_salted = large.withColumn("salt", F.floor(F.rand() * SALT).cast("int"))
small_salted = small.withColumn("salt", F.explode(F.array([F.lit(i) for i in range(SALT)])))
joined = large_salted.join(small_salted, ["key", "salt"]).drop("salt")
```

Pada lab modul ini, teknik salting berhasil memangkas skew ratio dari 18,8 menjadi hanya **1,7** dan memangkas waktu join menjadi 1,82 detik. Teknik ini membutuhkan memori tambahan pada tabel pasangan (karena digandakan N kali) serta kode yang lebih kompleks, gunakan salting ketika broadcast tidak memungkinkan dan optimasi AQE tidak mencukupi (misalnya saat kedua tabel sama-sama raksasa).

Urutan kecepatan pada dataset lab: Broadcast Join (0,85 s), AQE Skew Join (0,93 s), Salting (1,82 s), dan Plain Sort-Merge Join (2,58 s). Di klaster berskala terabyte, jurang perbedaan waktu ini melonjak dari hitungan detik menjadi selisih berjam-jam lamanya.

## @lesson Manajemen memori, Python UDFs, tata letak file, dan aturan praktis
**Memori Executor JVM** dialokasikan ke dalam dua ruang utama: **Execution Memory** (digunakan untuk operasi komputasi shuffle, buffer join hash table, sorting, dan agregasi) dan **Storage Memory** (digunakan untuk menampung cache DataFrame). Kedua area ini berada di bawah model Unified Memory Management dan dapat saling meminjam ruang secara dinamis, ditambah cadangan **Overhead Memory** untuk kebutuhan internal OS, network buffer, dan runtime PySpark. Jika kebutuhan komputasi melampaui kapasitas RAM yang tersedia, Spark melakukan **spill** (menulis kelebihan data ke disk lokal—proses melambat drastis namun aplikasi tidak mati); jika disk spill pun kehabisan ruang atau alokasi kontainer terlampaui, executor akan di-kill oleh cluster manager (`OOMKilled`). Tanda-tanda di Spark UI: metrik "Spill (Memory/Disk)", jeda panjang pada Garbage Collection (GC), atau executor yang restart berulang kali. Solusi: perbesar memori per executor; naikkan jumlah partisi agar data per task lebih kecil; bereskan anomali data skew (salah satu penyebab OOM yang paling sering); dan jangan pernah memanggil `collect()` untuk dataset besar ke memori driver.

**Python UDFs adalah pembunuh performa.** Fungsi UDF kustom yang ditulis dalam bahasa Python memaksa setiap baris data diserialisasi keluar dari proses JVM, dikirim melalui IPC socket ke proses worker Python, dieksekusi baris demi baris, lalu diserialisasi kembali ke JVM. Proses ini melumpuhkan seluruh optimasi Catalyst dan Tungsten. Selalu prioritaskan fungsi bawaan PySpark (`F.when`, `F.regexp_replace`, `F.date_trunc`, `F.coalesce`, dan ratusan fungsi native lainnya) yang dieksekusi langsung di level JVM bytecode. Jika logika bisnis benar-benar mengharuskan pustaka eksternal Python (seperti model machine learning atau pustaka saintifik), gunakan **Pandas UDFs (Vectorized UDFs)** berbasis Apache Arrow yang mentransfer data dalam format columnar batch efisien.

**Tata Letak File dan Storage** (menerapkan prinsip dari Modul 2.1): simpan data dalam format Parquet atau open table format agar filter dan seleksi kolom didorong ke storage scan; hindari masalah ribuan file kecil (*small files problem*—karena setiap file memicu overhead pembuatan satu task dan ribuan panggilan metadata object storage); gunakan `coalesce(n)` untuk memperkecil jumlah file output tanpa memicu shuffle jaringan; dan gunakan `repartition(n, col)` hanya jika Anda secara sadar ingin menyusun ulang tata letak data berdasarkan partisi kunci tertentu.

**Aturan Emas PySpark Produksi:**

- Terapkan filter dan seleksi kolom **sedini mungkin** di awal rantai komputasi.
- Selalu pertimbangkan **Broadcast Join** untuk tabel dimensi kecil; verifikasi kemunculannya di physical plan.
- Pantau **ukuran dan jumlah partisi**; targetkan ukuran partisi stabil di kisaran 100 MB hingga 200 MB.
- Gunakan `cache()` hanya untuk DataFrame yang digunakan berkali-kali dalam action berbeda dan membutuhkan komputasi berat untuk dihitung ulang.
- Hindari Python UDF baris tunggal; gunakan built-in functions atau Pandas UDFs.
- Pantang memanggil `df.collect()` atau `df.toPandas()` untuk dataset besar ke memori driver.
- **Baca physical plan dan amati Spark UI sebelum mengubah konfigurasi apa pun.** Mayoritas masalah performa bersumber dari data skew, join tanpa broadcast, atau jutaan file kecil.
- Uji kebenaran logika transformasi pada data terisolasi dalam **local mode** di laptop pengujian sebelum mendeploy job ke klaster cloud.

**Operasional Produksi.** Jalankan aplikasi menggunakan perintah `spark-submit` atau job orchestrator terkelola; alokasikan resource secara terukur (jumlah executor, core, RAM); manfaatkan fitur **Dynamic Allocation** agar klaster dapat melakukan auto-scaling worker sesuai antrean beban kerja; serta pantau biaya infrastruktur secara berkala. Jadikan Spark UI sebagai dashboard kendali utama Anda: tab *Jobs* dan *Stages* untuk melihat progres dan summary task, tab *SQL* untuk membaca plan dengan metrik real, tab *Storage* untuk melihat penggunaan cache, serta tab *Executors* untuk memantau konsumsi memori, GC pause, dan disk spill.

## @lab Lab: membaca physical plan, mendeteksi skew, dan memperbaikinya
Eksekusi Spark dalam local mode langsung di komputer Anda. Anda akan membangun serangkaian fungsi Python untuk **menginspeksi** karakteristik internal query (menghitung jumlah node shuffle Exchange, mengukur rasio skew partisi) serta fungsi untuk **memperbaiki** anomali performa (broadcast join, teknik salting, dan aktivasi konfigurasi adaptive skew join). Seluruh perbaikan akan diuji secara otomatis untuk membuktikan bahwa hasil kalkulasi data tetap identik dengan join standar namun dengan karakteristik plan dan keseimbangan partisi yang jauh lebih unggul.

### @steps
1. Verifikasi instalasi runtime Java dan instal dependensi Python:

```bash
java -version        # wajib versi 17 atau lebih baru
python -m pip install -r labs/mod-3-1/requirements.txt
pytest labs/mod-3-1 -v       # seluruh pengujian akan gagal pada awalnya (membutuhkan ~20 detik setelah selesai)
```

2. Pelajari file pengujian `labs/mod-3-1/test_lab.py`. Test suite ini membangun dataset simulasi dengan skew ekstrem (70% event transaksi dimiliki oleh `customer_id = 0`) serta tabel dimensi customer berisi 1.001 baris, dan secara sengaja menonaktifkan fitur broadcast otomatis agar struktur physical plan dapat diuji secara deterministik.
3. Buka file starter `labs/mod-3-1/spark_lab.py`. Fungsi pembantu `plan_text` telah disediakan untuk menangkap output `df.explain("formatted")` ke dalam string teks. Implementasikan fungsi `count_exchanges` (bagian details pada formatted plan mencantumkan node seperti `(5) Exchange`; perhatikan bahwa `BroadcastExchange` tidak dihitung sebagai shuffle jaringan). Jalankan pengujian pada `TestPlans`.
4. Implementasikan fungsi `partition_sizes` dan `skew_ratio`. Amati output statistik untuk dataset dengan hot key dibandingkan dengan dataset yang terdistribusi seragam, dan pahami mengapa satu partisi menampung data masif.
5. Implementasikan fungsi `add_salt`, `explode_salt`, dan `salted_join`. Buktikan bahwa output data hasil salted join identik dengan plain join, dan bahwa nilai skew ratio pada partisi majemuk `(customer_id, salt)` menurun drastis menjadi seimbang.
6. Implementasikan fungsi `broadcast_join` dan amati perubahan node plan-nya di mana node Exchange pada tabel event lenyap.
7. Implementasikan fungsi konfigurasi `enable_skew_join` (parameter konfigurasi tercantum pada docstring) serta fungsi verifikasi `uses_skew_join`. Pengujian akan mengeksekusi join dan memverifikasi bahwa plan adaptif akhir memuat atribut `skew=true`.
8. Eksplorasi mandiri: bandingkan durasi eksekusi antara versi plain join, broadcast, salting, dan AQE untuk ukuran baris data yang lebih besar (`N` jutaan baris) menggunakan modul `time.time()`; cetak physical plan ke terminal; coba ubah parameter `spark.sql.shuffle.partitions`. Buka Spark UI di browser (hapus konfigurasi `spark.ui.enabled=false`; buka port http://localhost:4040) dan temukan task terpanjang pada stage plain join.

### @files
- labs/mod-3-1/spark_lab.py :: File kerja implementasi: fungsi inspeksi physical plan dan penanganan skew :: starter
- labs/mod-3-1/test_lab.py :: Suite pengujian otomatis (membangun dataset skew dan memverifikasi plan) :: test
- labs/mod-3-1/requirements.txt :: Dependensi pyspark dan pytest :: config
- labs/mod-3-1/reference/spark_lab.py :: Referensi solusi lengkap (jadikan pembanding setelah mencoba mandiri!) :: reference

### @deliverables
- Seluruh 12 skenario pengujian di `test_lab.py` lulus dengan sukses
- Mampu menunjukkan dari hasil cetak physical plan Anda: satu query dengan 0 shuffle, satu query dengan 1 shuffle, dan satu query dengan 2 shuffle, serta menunjukkan baris penandanya
- Mampu menjelaskan secara matematis berdasarkan ukuran partisi mengapa plain join jauh lebih lambat daripada salted join pada dataset ini

### @verify
```bash
pytest labs/mod-3-1 -v
```

Verifikasi terhadap solusi referensi: `LAB_DIR=reference pytest labs/mod-3-1 -v`. Pengujian akan dilewati secara otomatis jika runtime Java tidak terdeteksi di sistem.

## @chaos Job yang tersangkut di 199 dari 200 task selama berjam-jam
### @scenario
Sebuah batch job Spark harian menggabungkan 80 juta baris data event pesanan dengan tabel master pelanggan untuk menghitung total pendapatan berdasarkan tier keanggotaan. Biasanya job ini selesai dalam waktu 12 menit. Setelah tim marketing merilis fitur guest checkout (pembelian tanpa registrasi akun) yang mencatat nilai placeholder `customer_id = 0` untuk pembeli anonim, durasi runtime job melonjak drastis melampaui satu jam, dan pada hari Jumat kemarin job tersebut gagal total akibat executor JVM Out-Of-Memory error pada percobaan retry ketiga.

Tampilan antarmuka Spark UI menunjukkan bahwa pada stage join, sebanyak 199 dari 200 task selesai tuntas hanya dalam 4 menit, namun ada 1 task yang masih terus berjalan dengan volume pembacaan shuffle mencapai 28 GB sementara median task lainnya hanya membaca 140 MB data. Seluruh mesin lain di klaster berada dalam kondisi menganggur.

### @cause
Sekitar 70% dari total transaksi kini memiliki guest ID 0. Dalam operasi sort-merge join, Spark melakukan shuffle dan membagi baris data berdasarkan nilai hash dari `customer_id`, sehingga seluruh transaksi dengan customer ID 0 dipetakan ke dalam **satu partisi tunggal**: satu task worker terpaksa memproses data 200 kali lipat lebih banyak dibandingkan task normal lainnya, mengalami disk spill hebat, dan pada akhirnya melebihi batas memori kontainer JVM. Sebanyak 199 task lainnya selesai seketika dan CPU cores-nya menganggur sia-sia. Menambah jumlah mesin di klaster sama sekali tidak akan membantu, karena satu kunci tunggal (single key) tidak dapat dipecah oleh algoritma hash partitioner konvensional.

Perubahan pada karakteristik *data* di aplikasi hulu (penambahan nilai placeholder baru) memicu degradasi performa fatal pada kode pipeline data yang tidak pernah diubah sama sekali oleh tim data.

### @fix
1. **Solusi Cepat (Immediate)**: aktifkan penanganan skew adaptif (`spark.sql.adaptive.skewJoin.enabled = true`), yang secara otomatis memecah partisi raksasa tersebut saat runtime, atau lakukan broadcast pada tabel customer jika ukurannya relatif kecil.
2. **Solusi Arsitektural (Structural)**: perlakukan guest ID sebagai kasus khusus. Filter baris dengan `customer_id = 0` sebelum operasi join, lakukan agregasi langsung pada baris-baris tersebut tanpa join (karena tamu anonim tidak memiliki relasi atribut pelanggan), lalu gabungkan hasilnya menggunakan `union`. Gunakan teknik salting jika kedua tabel sama-sama masif.
3. **Deteksi Lebih Awal**: catat metrik skew ratio partisi shuffle atau rasio max/median durasi task untuk stage-stage penting dan kirimkan peringatan otomatis jika terjadi anomali; pasang assertion pengecekan proporsi key yang paling dominan di lapisan ingestion (Modul 2.5).
4. **Cegah dari Sumbernya**: sepakati bersama tim produk backend bahwa pesanan tamu harus menggunakan nilai `NULL` (didampingi kolom penanda boolean `is_guest`) alih-alih menggunakan angka ID semu (magic id), dan tuangkan kesepakatan tersebut ke dalam data contract resmi.

### @pattern
Data skew adalah karakteristik intrinsik dari distribusi data, bukan kelemahan mesin klaster. Ukur keseimbangan ukuran partisi, atasi hot key yang mendominasi (broadcast, partisi terpisah, AQE skew join, salting), dan waspadai kemunculan nilai placeholder baru dari aplikasi hulu.

## @quiz
### Dalam sebuah job Apache Spark, apa yang dimaksud dengan batasan stage (stage boundary)?
- [ ] Titik di mana program driver menyalin seluruh hasil data perantara kembali ke memori lokalnya sendiri
- [ ] Baris kode di mana sebuah DataFrame disimpan ke dalam cache dan transformasi berikutnya mulai membaca dari disk
- [x] Titik terjadinya shuffle, saat baris harus didistribusikan ulang melintasi jaringan berdasarkan kunci baru
- [ ] Momen ketika sebuah task selesai dieksekusi dan executor yang bebas mengambil partisi antrean berikutnya

> Transformasi narrow digabungkan (pipelined) di dalam satu stage yang sama. Transformasi wide (groupBy, join) membutuhkan data dari banyak partisi, sehingga mewajibkan operasi shuffle jaringan yang sekaligus mengakhiri satu stage dan memulai stage baru.

### Manakah dari transformasi berikut yang TIDAK membutuhkan operasi shuffle jaringan?
- [ ] `groupBy("customer_id").count()`, karena setiap grup output bergantung pada baris-baris dari banyak partisi berbeda
- [ ] `orderBy("order_ts")`, karena pengurutan global harus membandingkan baris-baris data yang tersebar di berbagai partisi
- [ ] Operasi sort-merge `join` pada kolom `customer_id`, karena kedua sisi tabel harus diredistribusikan berdasarkan join key
- [x] `filter("amount > 10")`, karena setiap partisi output hanya bergantung secara independen pada satu partisi input saja

> Transformasi narrow seperti filter, select, dan withColumn bekerja secara terisolasi partisi demi partisi tanpa perpindahan data. Operasi groupBy, orderBy, dan join pada key memicu Exchange (shuffle).

### Sebuah tabel berisi 3 juta baris digabungkan (join) dengan tabel dimensi berisi 1.001 baris. Rencana eksekusi mana yang biasanya paling cepat, dan apa alasannya?
- [ ] Sort-merge join, karena pengurutan kedua input menjamin kunci-kunci yang cocok berada bersebelahan di disk
- [ ] Cartesian product, karena membandingkan setiap pasang baris satu kali dan tidak menghasilkan partisi yang timpang
- [x] Broadcast hash join: tabel kecil disalin ke semua executor, jadi tabel besar tak perlu di-shuffle lewat jaringan
- [ ] Shuffle hash join dengan 200 partisi, karena semakin banyak partisi selalu membuat proses join selesai lebih cepat

> Melakukan broadcast pada sisi tabel kecil mengeliminasi kebutuhan shuffle pada tabel besar. Pada lab praktikum, broadcast join selesai dalam 0,85 detik dibandingkan 2,58 detik untuk sort-merge join.

### Apa gejala paling jelas dari terjadinya data skew yang terlihat pada antarmuka web Spark UI?
- [ ] Setiap task di dalam stage menunjukkan durasi eksekusi yang persis sama, dan stage tidak pernah selesai berjalan
- [ ] Memori driver menunjukkan penggunaan yang sangat tinggi meskipun tidak ada perintah pengambilan data collect
- [x] Segelintir task membutuhkan waktu jauh lebih lama dan membaca volume shuffle data jauh lebih besar daripada nilai median task lainnya
- [ ] Jumlah total executor mendadak turun menjadi nol, dan aplikasi job berada dalam status menunggu tanpa batas

> Total waktu penyelesaian suatu stage ditentukan oleh task yang paling lambat (straggler). Sebuah task yang memiliki metrik shuffle read size atau durasi waktu puluhan kali lipat dari median menandakan adanya hot key (skew).

### Bagaimana mekanisme kerja fitur penanganan skew join pada Adaptive Query Execution (AQE)?
- [ ] Menghapus baris-baris data dari hot key dari hasil query sehingga operasi join dapat selesai tanpa melibatkan data tersebut
- [ ] Mengubah setiap join di dalam query menjadi cartesian product sehingga nilai kunci tidak lagi dipedulikan
- [x] Memecah partisi shuffle raksasa menjadi sub-partisi lebih kecil, lalu menduplikasi baris pasangannya dari tabel lawan
- [ ] Menaikkan parameter `spark.sql.shuffle.partitions` secara permanen menjadi 2.000 untuk seluruh query di sesi tersebut

> AQE mengukur ukuran partisi shuffle secara dinamis saat runtime. Partisi yang jauh melampaui batas median dipecah menjadi sub-partisi kecil dan dipasangkan dengan salinan data tabel lawan, ditandai dengan label `skew=true` pada physical plan.

### Bagaimana teknik salting mampu meredakan masalah data skew pada operasi join?
- [ ] Mengenkripsi nilai join key sehingga nilai hot key tidak lagi dikenali oleh fungsi hashing bawaan
- [ ] Menambahkan baris acak dummy ke tabel kecil sehingga seluruh variasi key muncul dengan frekuensi yang sama persis
- [x] Salt acak memecah satu hot key menjadi beberapa key turunan, dan tabel kecil diduplikasi untuk setiap nilai salt
- [ ] Mengurutkan tabel besar berdasarkan hot key sehingga seluruh baris dapat diproses di dalam satu task berurutan

> Tabel besar diberikan kolom salt acak (0 hingga N-1) dan tabel kecil di-explode menjadi N salinan, sehingga beban hot key terdistribusi merata ke N partisi berbeda sementara setiap baris tetap menemukan pasangannya.

### Mengapa Anda umumnya harus menghindari penggunaan Python UDF di dalam job PySpark?
- [ ] Fungsi Python tidak dapat membaca kolom bertipe string atau numerik, melainkan hanya mampu membaca satu baris utuh
- [ ] Spark menolak mengeksekusi job apa pun yang memuat kode kustom pengguna kecuali jika klaster berjalan dalam local mode
- [x] Setiap baris harus dikirim keluar dari JVM ke runtime Python lalu kembali lagi, sehingga lambat dan mematikan optimasi
- [ ] Fungsi UDF selalu menghasilkan kalkulasi salah jika menemukan nilai NULL, sehingga tidak aman digunakan pada operasi join

> Fungsi bawaan (built-in) dieksekusi langsung di dalam lingkungan bytecode JVM yang teroptimasi dan mendukung predicate pushdown. Python UDF baris tunggal membayar biaya serialisasi IPC yang mahal dan menyembunyikan logika dari Catalyst optimizer.

### Durasi runtime sebuah batch job harian melonjak dari 12 menit menjadi lebih dari 1 jam setelah rilis fitur baru yang menyematkan ID placeholder 0 pada 70% baris data. Langkah apa yang harus dicoba pertama kali?
- [ ] Menggandakan jumlah mesin di klaster menjadi dua kali lipat agar hot key tersebut dapat diproses secara paralel
- [ ] Mengganti operasi join dengan perulangan loop di driver, karena loop lebih mudah di-debug daripada stage eksekusi yang rumit
- [x] Periksa rasio skew partisi, lalu coba broadcast join atau aktifkan AQE skew handling sebelum solusi yang lebih berat
- [ ] Menyetel jumlah partisi shuffle menjadi satu agar keseluruhan dataset dapat diproses terkonsentrasi di satu mesin

> Satu nilai kunci tidak dapat dipecah oleh algoritma hash partitioning biasa, sehingga menambah mesin tidak akan menyelesaikan masalah. Konfirmasi ketimpangan partisi, lalu atasi dengan broadcast, AQE skew handling, atau teknik salting.

## @resources
- [Dokumentasi Resmi Apache Spark](https://spark.apache.org/docs/latest/)
- [Panduan Penyetelan Performa Spark SQL](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [Referensi API PySpark](https://spark.apache.org/docs/latest/api/python/)
- [Panduan Penggunaan Web UI Spark](https://spark.apache.org/docs/latest/web-ui.html)

