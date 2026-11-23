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
- Membaca job Spark dalam Scala atau Java beserta stack trace JVM-nya, lalu menerjemahkan job itu ke PySpark

## @prereq
Modul 2.1 (Parquet, engine pemrosesan, batas kapasitas mesin tunggal) dan Modul 1.3 (join relational, execution plans). Wajib terinstal Java versi 17 atau lebih baru (`java -version`) dan dependensi Python via `pip install -r labs/mod-3-1/requirements.txt`. Lab modul ini mengeksekusi Spark dalam local mode langsung di komputer Anda.

## @part Cara Spark menjalankan kode Anda

## @lesson Kapan Anda butuh cluster, dan berapa biaya yang harus dibayar
Modul 2.1 ditutup dengan aturan emas arsitektur: satu mesin fisik modern dengan arsitektur memori teroptimasi (DuckDB atau Polars) mampu melangkah jauh lebih jauh daripada perkiraan mayoritas tim data. Namun saat skala data melampaui batas fisik mesin tunggal tersebut, **Apache Spark** adalah engine terdistribusi yang menjadi standar emas industri: ia memecah dataset raksasa menjadi potongan-potongan **partisi**, memprosesnya secara paralel melintasi ratusan mesin dalam sebuah klaster, lalu menggabungkan hasil akhirnya.

Kapan Anda benar-benar membutuhkan Spark: volume data (atau kompleksitas komputasi) sudah tidak muat lagi di dalam kapasitas disk, RAM, dan batas toleransi waktu satu mesin; Anda membutuhkan throughput komputasi dari ratusan CPU cores secara paralel; atau organisasi tempat Anda bekerja sudah memiliki platform Spark terkelola (seperti Databricks, AWS EMR, Google Cloud Dataproc, atau Apache Spark on Kubernetes) lengkap dengan tata kelola keamanan dan integrasinya. Kapan Anda **tidak** membutuhkannya: untuk memproses data Parquet berukuran beberapa ratus gigabyte, menjalankan DuckDB atau Polars di satu VM berukuran besar sering kali jauh lebih cepat, hemat, dan tidak rumit.

Mengoperasikan klaster terdistribusi memiliki harga operasional nyata yang mahal:

- **Beban Koordinasi (Coordination Overhead).** Menginisiasi job, menjadwalkan task ke worker, dan memindahkan data antar mesin membutuhkan waktu handshake. Sebuah job berukuran kecil jika dijalankan di Spark justru akan berjalan jauh lebih lambat daripada skrip Python sederhana di laptop.
- **Kemacetan Jaringan (The Network Bottleneck).** Data yang terpaksa berpindah antar mesin melintasi kabel jaringan (dikenal sebagai operasi **shuffle**) memiliki latensi beberapa kali lipat lebih lambat dibandingkan data yang diproses lokal di memori CPU. Hampir seluruh seni optimasi performa Spark berpusat pada satu misi: *memindahkan lebih sedikit data melalui jaringan, dan sesedikit mungkin frekuensinya*.
- **Pola Kegagalan Baru (New Failure Modes).** Fenomena data skew (ketimpangan distribusi data), tekanan memori JVM pada satu executor, mesin worker yang mendadak mati (spot instance reclamation), serta kompleksitas investigasi log lintas ratusan kontainer.
- **Biaya Finansial (Cloud Cost).** Klaster cloud yang dibiarkan menyala menganggur atau dikonfigurasi secara boros tanpa optimasi adalah cara tercepat menghabiskan anggaran cloud perusahaan.

Gunakan Spark hanya ketika hasil pengukuran metrik membuktikan bahwa satu mesin fisik tidak lagi memadai, lalu kuasai mekanisme internalnya agar Anda dapat memanfaatkan daya komputasi klaster tersebut secara efisien.

> 🛠 **Coba sendiri (10 menit, Python).** Anda tidak butuh Spark untuk merasakan biaya koordinasi. Tulis `work(n)` yang mengembalikan `sum(i * i % 7 for i in range(n))`. Ukur waktu `[work(n) for _ in range(tasks)]` dalam satu proses, lalu hal yang sama dengan `multiprocessing.Pool(4).map(work, [n] * tasks)`. Coba dua job: 4 task dengan `n = 1000`, dan 8 task dengan `n = 1_500_000`. Pastikan kedua cara memberi jawaban yang sama. (Taruh kodenya di bawah `if __name__ == "__main__":` dan jalankan sebagai file.)
>
> **Seharusnya Anda melihat:** untuk job yang sangat kecil, satu proses butuh sekitar 0,2 ms dan pool sekitar 20 ms, kira-kira seratus kali *lebih lambat*; untuk job besar, satu proses butuh sekitar 780 ms dan pool sekitar 235 ms, kira-kira tiga kali lebih cepat dengan 4 worker. Menyalakan worker dan mengirim task memakan biaya tetap, jadi paralel hanya menang jika setiap task cukup besar untuk membayarnya.

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

Cara kerja kode PySpark: Anda menulis ekspresi DataFrame atau query SQL di Python; instruksi tersebut langsung diterjemahkan menjadi rencana eksekusi JVM; task kemudian dieksekusi oleh engine JVM di dalam executor. Pustaka **PySpark** hanyalah lapisan tipis wrapper: operasi DataFrame standar tidak pernah mengeksekusi runtime Python terhadap baris data, itulah sebabnya performanya setara dengan Java murni. Kode Python baru benar-benar dieksekusi di executor saat Anda mendaftarkan fungsi kustom Python **UDF (User-Defined Function — dibahas di Pelajaran 8)**, yang membawa penalti serialisasi sangat berat.

> 🛠 **Coba sendiri (15 menit, Python).** Modelkan job dua stage dengan tangan: total `total_idr` per `payment_method` dari `data/orders.csv` (ambil hanya baris yang totalnya berupa digit semua, 3.580 baris). **Stage 1:** bagi barisnya menjadi 8 partisi dengan `rows[i::8]`; setiap task menghitung jumlah sebagian per metode pembayaran untuk partisinya sendiri. **Shuffle:** kirim setiap jumlah sebagian ke salah satu dari 4 partisi reduce yang dipilih dengan `zlib.crc32(key.encode()) % 4`. **Stage 2:** setiap dari 4 task reduce menjumlahkan jumlah sebagian yang diterimanya. Hitung task di setiap stage dan record yang melewati shuffle, lalu bandingkan hasilnya dengan `groupby` pandas.
>
> **Seharusnya Anda melihat:** `8` task di stage 1, `4` di stage 2, hanya `32` record yang di-shuffle alih-alih 3.580 (jumlah sebagian dihitung sebelum shuffle), dan hasil yang sama dengan pandas: `bank_transfer 303975000`, `card 312380000`, `cod 302230000`, `ewallet 291140000`. Keempat partisi reduce memuat `[1, 0, 1, 2]` key: satu task reduce tidak mendapat pekerjaan, miniatur dari masalah ukuran partisi di atas.

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

> 💡 **Jeda Praktik 1 (Rencana Eksekusi & Penghitungan Shuffle):**
> 1. Buka file `labs/mod-3-1/spark_lab.py` di teks editor Anda. Jangan jalankan file Python ini langsung di terminal tanpa modul penguji.
> 2. Implementasikan fungsi `count_exchanges(df)` untuk menghitung kemunculan node `Exchange` pada teks physical plan berformat (`df.explain("formatted")`). Ingat bahwa `BroadcastExchange` bukan shuffle data tabel besar dan tidak boleh dihitung.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-1/test_lab.py -k "test_narrow or test_a_group_by or test_a_sort_merge_join" -v`
> 4. **Indikator Sukses:** Sebanyak 3 pengujian berstatus `PASSED`, memvalidasi bahwa transformasi narrow menghasilkan 0 exchange, group-by memicu 1 exchange, dan sort-merge join membutuhkan 2 exchange.

## @lesson Sang pengoptimal: Catalyst, Tungsten, dan Adaptive Query Execution (AQE)
Baik Anda menulis query menggunakan DataFrame API maupun Spark SQL murni, seluruh instruksi melewati engine internal yang sama melalui tiga pilar teknologi:

1. **Catalyst Query Optimizer**: engine pengoptimal logis yang mengubah query deklaratif Anda menjadi *logical plan*. Catalyst menerapkan aturan transformasi berbasis aturan (rule-based rewrites) seperti **predicate pushdown**, **column pruning**, penyederhanaan ekspresi konstanta, penataan ulang urutan join berdasarkan statistik data, hingga menghasilkan serangkaian alternatif *physical plan* yang paling efisien. Inilah alasan mengapa DataFrame selalu mengalahkan kode **RDD** tulisan tangan (API koleksi terdistribusi tingkat rendah generasi awal Spark sebelum DataFrame, yang menganggap baris sebagai objek buram): Catalyst memahami skema kolom dan filter Anda sehingga mampu mengoptimalkannya.
2. **Tungsten Engine**: engine eksekusi level hardware yang menyimpan data dalam format biner terpadu yang sangat kompak (sering kali dialokasikan di luar JVM off-heap memory) untuk meminimalkan beban garbage collection (GC). Tungsten menerapkan **whole-stage code generation**: seluruh operator dalam satu stage dikompilasi saat runtime menjadi satu fungsi bytecode Java monolitik tanpa adanya overhead virtual function call di setiap baris data. Tanda bintang `*` di depan nama operator pada physical plan menandakan bahwa operator tersebut telah tergabung dalam whole-stage codegen.
3. **Adaptive Query Execution (AQE)**: fitur modern yang aktif secara default di Spark versi 3 ke atas. Sebelum query berjalan, estimasi ukuran data sering kali meleset; AQE menyelesaikan dilema ini dengan mengevaluasi ulang rencana eksekusi *secara dinamis saat runtime* berdasarkan ukuran data aktual yang tercatat pasca-shuffle. AQE mampu **menggabungkan (coalesce)** ratusan partisi shuffle mini menjadi sedikit partisi ideal, **mengubah sort-merge join menjadi broadcast join secara otomatis** jika salah satu sisi ternyata berukuran kecil setelah difilter, serta **memecah partisi yang mengalami data skew** menjadi sub-partisi kecil.

Keahlian membaca physical plan adalah kompetensi wajib data engineer senior: gunakan perintah `df.explain("formatted")` dan cermati (a) **tipe strategi join**, (b) node **Exchange** dan skema partisi hash-nya, (c) apakah **filter dan seleksi kolom didorong langsung ke dalam scan storage** (pushdown), serta (d) **jumlah partisi eksekusi**. Tab SQL pada antarmuka web Spark UI menampilkan diagram visual yang sama lengkap dengan jumlah baris nyata dan durasi waktu eksekusi setiap operator.

> 🛠 **Coba sendiri (10 menit, Python).** DuckDB punya optimizer dengan gagasan pushdown yang sama. Simpan `orders.parquet` seperti di Modul 2.1 dan jalankan `duckdb.sql("EXPLAIN SELECT payment_method, count(*) FROM 'orders.parquet' WHERE status = 'delivered' GROUP BY payment_method")`, lalu cetak teks rencananya (`.fetchall()[0][1]`). Lalu jelaskan `SELECT * FROM 'orders.parquet'`. Temukan node scan di keduanya dan baca `Projections` dan `Filters`-nya.
>
> **Seharusnya Anda melihat:** di rencana pertama scan Parquet hanya mencantumkan `payment_method` di bawah `Projections` dan `status='delivered'` di bawah `Filters`: optimizer mendorong keduanya ke dalam scan, sehingga kolom lain tidak pernah dibaca dan baris difilter saat dibaca. Di rencana kedua scan memproyeksikan keenam kolom dan tidak punya filter. `explain("formatted")` milik Spark menampilkan gagasan yang sama sebagai `PushedFilters` dan `ReadSchema`.

## @part Join, skew, dan tuning

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

> 💡 **Jeda Praktik 2 (Broadcast Hash Join Tanpa Shuffle):**
> 1. Buka file `labs/mod-3-1/spark_lab.py` di teks editor Anda.
> 2. Implementasikan fungsi `broadcast_join(large, small, key)` dengan menyiarkan sisi tabel kecil ke seluruh executor via `F.broadcast(small)`.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-1/test_lab.py -k test_a_broadcast_join_does_not_shuffle_the_big_table -v`
> 4. **Indikator Sukses:** Pengujian berstatus `PASSED`, membuktikan terbentuknya node `BroadcastHashJoin` pada physical plan dengan 0 exchange pada tabel besar.

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

### Lihat sendiri: satu key panas, satu task kelebihan beban

Delapan baris disebar ke 3 partisi menurut key-nya. Enam baris berbagi key yang sama:

:::trace Semua baris satu key mendarat di satu partisi
@code
keys = ["a", "a", "a", "a", "a", "a", "b", "c"]
partitions = {0: [], 1: [], 2: []}
for k in keys:
    partitions[ord(k) % 3].append(k)
print({p: len(rows) for p, rows in partitions.items()})
@notes
4 | Key yang sama selalu memberi nomor partisi yang sama. Perhatikan partisi 1 terisi dengan setiap `"a"`.
5 | Satu partisi memegang 6 dari 8 baris. Di Spark itu berarti satu task berjalan lama sementara yang lain menganggur: stage selesai hanya ketika task paling lambat selesai.
:::

:::ask Sebuah key join bernilai NULL pada 60% baris. Setelah shuffle, ke mana semua baris itu pergi?
@options
* semuanya ke satu partisi: satu task mengerjakannya
mereka tersebar merata ke semua partisi
join membuangnya sebelum shuffle
@why
Hash partitioning bersifat deterministik: key yang sama (termasuk NULL) selalu pergi ke tempat yang sama. Key panas karena itu membuat satu task kelebihan beban, sementara executor lain menganggur. Perbaikan: tangani NULL secara terpisah, broadcast sisi yang kecil, atau **salt** key panasnya.
:::

:::drill python Beri salt pada key panas
Tulis `salted_counts(keys, buckets)`: beri baris-baris nomor 0, 1, 2, ... secara berurutan, ganti nama setiap key menjadi `key#` ditambah nomor baris modulo `buckets` (jadi `"a"` menjadi `"a#0"`, `"a#1"`, ...), dan kembalikan dictionary yang menghitung baris per key bersalt. Key panas sekarang terpecah menjadi `buckets` kelompok yang lebih kecil.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("salted_counts") ## Definisikan salted_counts(keys, buckets).
salted_counts(["a"] * 6, 3) == {"a#0": 2, "a#1": 2, "a#2": 2} ## Enam baris "a" dengan 3 bucket: dua baris di setiap a#0, a#1, a#2.
salted_counts(["a", "a", "b"], 2) == {"a#0": 1, "a#1": 1, "b#0": 1} ## Nomor baris 0, 1, 2: a#0, a#1, b#0 (2 % 2 adalah 0).
salted_counts([], 4) == {} ## Tanpa baris, tanpa hitungan.
max(salted_counts(["x"] * 100, 4).values()) == 25 ## 100 baris satu key di 4 bucket: masing-masing 25, kelompok terbesar 25 (bukan 100).
@hint
```python
def salted_counts(keys, buckets):
    counts = {}
    for i, key in enumerate(keys):
        salted = key + "#" + str(i % buckets)
        counts[salted] = counts.get(salted, 0) + 1
    return counts
```
@solution
def salted_counts(keys, buckets):
    counts = {}
    for i, key in enumerate(keys):
        salted = key + "#" + str(i % buckets)
        counts[salted] = counts.get(salted, 0) + 1
    return counts
:::

> 💡 **Jeda Praktik 3 (Diagnostik Data Skew & Ukuran Partisi):**
> 1. Buka file `labs/mod-3-1/spark_lab.py` di teks editor Anda.
> 2. Implementasikan fungsi `partition_sizes(df, cols, n)` untuk mempartisi DataFrame berdasarkan kolom kunci dan menghitung jumlah baris di setiap partisi.
> 3. Implementasikan fungsi `skew_ratio(sizes)` yang membagi ukuran partisi terbesar dengan nilai median.
> 4. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-1/test_lab.py -k TestSkew -v`
> 5. **Indikator Sukses:** Sebanyak 3 pengujian di `TestSkew` berstatus `PASSED`, membuktikan secara empiris bahwa dataset hot key menghasilkan skew ratio > 10 dibandingkan < 1,5 pada dataset seragam.

**Solusi penanganan skew, dari yang paling sederhana hingga mahir:**

1. **Pisahkan atau filter hot key.** Jika nilai hot key hanyalah data sampah (NULL atau placeholder tanpa atribut), filter data tersebut sebelum shuffle. Jika data tersebut valid (seperti transaksi tamu anonim), pisahkan alur logikanya: proses `customer_id = 0` secara independen tanpa operasi join (karena tamu tidak memiliki profil customer di tabel master), lalu lakukan operasi `union` dengan hasil join data normal lainnya.
2. **Lakukan broadcast pada sisi tabel kecil.** Jika salah satu tabel berukuran kecil, tabel besar tidak akan di-shuffle sama sekali, sehingga masalah skew lenyap seketika. Pada lab modul ini, opsi broadcast adalah yang tercepat (0,85 detik).
3. **Aktifkan pemecahan partisi adaptif (AQE Skew Join).** Dengan mengaktifkan `spark.sql.adaptive.skewJoin.enabled = true`, engine Spark secara otomatis mendeteksi partisi shuffle yang ukurannya melampaui batas median, memecah partisi raksasa tersebut menjadi sub-partisi kecil, dan menduplikasi baris pasangan dari tabel lawan. Physical plan akan menampilkan label `SortMergeJoin(skew=true)`. Di lab modul ini, join yang sama selesai dalam **0,93 detik** (turun dari 2,58 detik) dengan hasil yang identik sempurna, tanpa perlu mengubah satu baris pun logika kode aplikasi.
4. **Teknik Salting.** Bayangkan 1.000.000 baris `orders` semuanya memiliki `customer_id = 0`. Hashing biasa akan mengirim semuanya ke satu task yang kelebihan beban. Dengan `salt = 2`, tandai setiap order secara acak dengan `0` atau `1` (`(0, 0)`, `(0, 1)`), dan gandakan satu baris `customers` untuk `0` menjadi dua baris (`(0, 0)` dan `(0, 1)`): kini tiap kunci majemuk hanya memproses separuh order di partisi berbeda dan tetap cocok saat join! Secara umum, tambahkan kolom acak **salt** (bernilai integer dari 0 hingga N-1) pada tabel besar yang mengalami skew, sehingga satu hot key terpecah menjadi N kombinasi key baru `(key, salt)`; kemudian pada tabel kecil pasangannya, gandakan setiap baris sebanyak N kali (menggunakan fungsi explode array) untuk setiap kemungkinan nilai salt; lalu lakukan join pada pasangan kunci majemuk `(key, salt)`. Hot key kini terdistribusi merata ke N partisi berbeda:

```python
SALT = 8
large_salted = large.withColumn("salt", F.floor(F.rand() * SALT).cast("int"))
small_salted = small.withColumn("salt", F.explode(F.array([F.lit(i) for i in range(SALT)])))
joined = large_salted.join(small_salted, ["key", "salt"]).drop("salt")
```

Pada lab modul ini, teknik salting berhasil memangkas skew ratio dari 18,8 menjadi hanya **1,7** dan memangkas waktu join menjadi 1,82 detik. Teknik ini membutuhkan memori tambahan pada tabel pasangan (karena digandakan N kali) serta kode yang lebih kompleks, gunakan salting ketika broadcast tidak memungkinkan dan optimasi AQE tidak mencukupi (misalnya saat kedua tabel sama-sama raksasa).

Urutan kecepatan pada dataset lab: Broadcast Join (0,85 s), AQE Skew Join (0,93 s), Salting (1,82 s), dan Plain Sort-Merge Join (2,58 s). Di klaster berskala terabyte, jurang perbedaan waktu ini melonjak dari hitungan detik menjadi selisih berjam-jam lamanya.

> 💡 **Jeda Praktik 4 (Penanganan Skew: Salting & Adaptive Query Execution):**
> 1. Buka file `labs/mod-3-1/spark_lab.py` di teks editor Anda.
> 2. Implementasikan fungsi `add_salt(df, factor, seed=4)`, `explode_salt(df, factor)`, dan `salted_join(large, small, key, factor)`.
> 3. Implementasikan konfigurasi `enable_skew_join(spark)` dan fungsi deteksi `uses_skew_join(df)`.
> 4. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-1/test_lab.py -k "TestSalting or TestAdaptiveExecution" -v`
> 5. **Indikator Sukses:** Sebanyak 5 pengujian berstatus `PASSED`, membuktikan bahwa teknik salting meratakan rasio partisi menjadi < 3 dan konfigurasi AQE berhasil memicu `SortMergeJoin(skew=true)` saat runtime.

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

> 🛠 **Coba sendiri (15 menit, Python).** Lihat masalah file kecil. Ulangi baris `data/orders.csv` 30 kali (sekitar 109.000 baris) dengan `pd.concat([df] * 30)`. Tulis sekali sebagai `sf/one/all.parquet`, dan sekali lagi dipotong menjadi 1.000 bagian sebagai `sf/many/p0000.parquet` dan seterusnya. Bandingkan total byte di setiap folder, dan ukur waktu `SELECT count(*) FROM read_parquet('<folder>/*.parquet')` di DuckDB untuk keduanya. Hapus `sf/` setelahnya.
>
> **Seharusnya Anda melihat:** kedua folder menjawab `109020`, tetapi 1.000 file kecil memakan sekitar 7,4 MB dibanding sekitar 0,4 MB untuk satu file (kompresi dan overhead per file sama-sama dirugikan), dan query atasnya puluhan kali lebih lambat (sekitar 60 ms dibanding 1,5 ms di sini). Setiap file memakan biaya listing, membuka, dan membaca footer, itulah sebabnya klaster yang menulis ribuan file kecil butuh compaction.

## @part Spark di produksi dengan Databricks

## @lesson Spark Produksi di Databricks: Unity Catalog, Auto Loader, Photon, Workflows & FinOps {optional}
Seluruh mekanisme internal Spark yang baru saja Anda pelajari—Catalyst, Tungsten, AQE, shuffle, broadcast join, dan data skew—adalah mesin utama di balik **Databricks**, yang muncul di **34,8%** dari 1.130 lowongan data engineering yang diukur di TalentHub (2026-07-23 sampai 2026-11-20), dan di 53,4% dari 517 lowongan yang menyebut Spark. Berikut adalah bagaimana platform Databricks produksi menyatukan seluruh komponen tersebut di atas AWS, Azure, atau GCP.

### 1. Control Plane vs. Cloud Data Plane & Unity Catalog (`catalog.schema.table`)
Databricks memisahkan arsitekturnya ke dalam dua batas keamanan:
- **Databricks Control Plane** (dikelola oleh Databricks): menjalankan antarmuka web UI, repositori kode/notebook, penjadwal **Workflows**, serta layanan tata kelola metadata **Unity Catalog**.
- **Cloud Account Data Plane Anda** (VPC AWS, VPC GCP, atau VNet Azure milik perusahaan Anda): data mentah dan kurasi tidak pernah keluar dari bucket S3 / ADLS Gen2 / GCS milik Anda sendiri, dan node komputasi Spark/Photon menyala di dalam private subnet Anda.

**Unity Catalog** menegakkan satu **namespace SQL 3 tingkat (`catalog.schema.table`)** yang seragam di seluruh workspace:

```sql
-- 1. Namespace tiga tingkat: <catalog>.<schema>.<table>
--    Isolasi lingkungan kerja berdasarkan catalog (kopiku_dev, kopiku_staging, kopiku_prod)
USE CATALOG kopiku_prod;
USE SCHEMA analytics;

-- 2. Buat Tabel Managed Delta dengan Liquid Clustering & Predictive Optimization
CREATE TABLE kopiku_prod.analytics.fct_orders (
  order_id      STRING,
  customer_id   STRING,
  order_date    DATE,
  status        STRING,
  net_total_idr BIGINT
)
USING DELTA
CLUSTER BY (order_date, status)
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true'
);

-- 3. Berikan hak akses terperinci (RBAC) di Unity Catalog
GRANT USE CATALOG ON CATALOG kopiku_prod TO `analytics_engineers`;
GRANT SELECT ON TABLE kopiku_prod.analytics.fct_orders TO `bi_analysts`;
```

- **Nol kunci rahasia S3 di dalam kode:** Unity Catalog menggunakan **Storage Credentials** (yang terhubung ke AWS IAM Role, GCP Service Account, atau Azure Managed Identity) dan **External Locations**, sehingga skrip PySpark Anda tidak pernah menyimpan kunci akses S3 statis.
- **Lineage Tingkat Kolom Otomatis:** Karena setiap query dan job PySpark melewati Unity Catalog, sistem otomatis memetakan silsilah data (lineage) dari tabel Bronze hingga ke kolom dashboard BI dan model ML.

### 2. Arsitektur Medallion (`Bronze → Silver → Gold`) & Auto Loader (`cloudFiles`)
Di Databricks, pipeline disusun mengikuti **Arsitektur Medallion** (pola lapisan raw → staging → mart yang sama dengan yang Anda bangun di Modul 1.6 dan 2.3):
- **Bronze (Ingesti Mentah):** Tabel append-only yang menyimpan payload mentah dari S3/ADLS/Kafka apa adanya ditambah kolom metadata audit (`_metadata.file_path`, `_ingested_at`).
- **Silver (Tervalidasi, Terdeduplikasi & Bersih):** Menegakkan kontrak skema, menghapus duplikat berdasarkan primary key, menyamarkan PII, dan memproses merge SCD2/CDF.
- **Gold (Agregasi Bisnis & Mart Semantik):** Tabel Star Schema (`dim_*`, `fct_*`) dan metrik siap pakai yang disajikan melalui **Databricks Serverless SQL Warehouses** ke alat BI.

**Mengapa Auto Loader (`cloudFiles`) jauh lebih unggul daripada `spark.read.parquet("s3://...")` biasa:**
Saat sebuah bucket S3 menampung 2 juta file JSON atau CSV setelah berjalan setahun, memanggil `spark.read.json("s3://bucket/events/*")` memaksa Spark melakukan operasi `LIST` direktori S3 atas 2 juta file tersebut di setiap eksekusi. **Databricks Auto Loader (`cloudFiles`)** menyelesaikannya dengan:
1. Menggunakan notifikasi event cloud (SNS/SQS di AWS, Event Grid di Azure, Pub/Sub di GCP) atau incremental listing yang dicatat di dalam **checkpoint RocksDB**, sehingga hanya menemukan *file yang baru mendarat* dalam waktu $O(1)$.
2. Mendukung evolusi skema otomatis dan menampung field JSON yang rusak atau berubah tipe ke dalam kolom khusus **`_rescued_data`** alih-alih membuat pipeline malam Anda mati total pada jam 3 pagi!

```python
# Ingesti Bronze Produksi dengan Databricks Auto Loader di PySpark:
bronze_stream = (
    spark.readStream
    .format("cloudFiles")
    .option("cloudFiles.format", "json")
    .option("cloudFiles.schemaLocation", "s3://kopiku-meta/schemas/orders_bronze")
    .option("cloudFiles.inferColumnTypes", "true")
    .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
    .option("rescuedDataColumn", "_rescued_data")
    .load("s3://kopiku-landing/orders/")
    .selectExpr("*", "_metadata.file_path AS _source_file", "current_timestamp() AS _ingested_at")
)

(
    bronze_stream.writeStream
    .format("delta")
    .option("checkpointLocation", "s3://kopiku-meta/checkpoints/orders_bronze")
    .option("mergeSchema", "true")
    # trigger(availableNow=True) memproses semua file baru secara micro-batch, lalu langsung mematikan klaster (biaya idle $0!)
    .trigger(availableNow=True)
    .toTable("kopiku_prod.bronze.orders_raw")
)
```

> **Aturan FinOps Streaming vs. Batch:** Perhatikan `.trigger(availableNow=True)`! Daripada membiarkan klaster streaming menyala 24 jam penuh menunggu file, `availableNow=True` menyalakan klaster job sementara setiap 15 atau 60 menit, memproses seluruh file baru sejak checkpoint RocksDB terakhir dengan jaminan tepat-satu-kali (exactly-once), lalu langsung mematikan klaster begitu selesai.

### 3. Lakeflow Declarative Pipelines (Delta Live Tables) & Quality Expectations
Persis seperti Modul 2.5 yang mengajarkan karantina data kotor di gerbang ingesti, Databricks menyediakan **Lakeflow Declarative Pipelines (Delta Live Tables / DLT)** di mana Anda mendeklarasikan aturan kualitas data (**Expectations**) langsung pada definisi tabel:

```python
import dlt
from pyspark.sql import functions as F

@dlt.table(
    name="silver_orders",
    comment="Pesanan bersih dan terdeduplikasi dengan pendapatan positif terverifikasi",
    cluster_by=["order_date", "status"]
)
@dlt.expect("valid_customer_id", "customer_id IS NOT NULL")          # Catat metrik pelanggaran di log, baris tetap masuk
@dlt.expect_or_drop("positive_amount", "net_total_idr >= 0")         # Buang baris bernilai negatif secara otomatis
@dlt.expect_or_fail("primary_key_present", "order_id IS NOT NULL")   # Hentikan pipeline seketika jika PK kosong
def build_silver_orders():
    return (
        dlt.read_stream("orders_raw")
        .filter(F.col("_rescued_data").isNull())
        .withWatermark("order_ts", "2 hours")
        .dropDuplicates(["order_id"])
    )
```

### 4. Komputasi & FinOps Databricks: Photon, All-Purpose vs. Job Clusters & DABs
Di Databricks, tagihan bulanan Anda terdiri dari dua komponen: **Biaya VM Cloud + EBS/S3** (dibayar ke AWS/GCP/Azure) ditambah **DBU (Databricks Units)** (dibayar ke Databricks per detik klaster menyala). Tiga aturan ini mencegah sebagian besar biaya Databricks yang bisa dihindari. Tarif DBU berbeda per cloud, region, tier, dan jenis compute, jadi baca tarif untuk akun Anda di halaman harga Databricks; yang tetap adalah urutannya:

| Jenis Komputasi | Tarif DBU Relatif | Kapan Digunakan | Kesalahan FinOps Klasik yang Wajib Dihindari |
|---|---|---|---|
| **All-Purpose (Interactive) Cluster** | **Paling Mahal** | Eksplorasi ad-hoc dan debugging notebook di jam kerja | **Jangan pernah menjalankan pipeline produksi terjadwal di All-Purpose Cluster.** Tarif DBU-nya lebih tinggi daripada jobs compute dan klaster tetap menyala selama ekor idle sebelum auto-termination. |
| **Jobs Compute (Ephemeral Job Cluster)** | **Paling Hemat** | Job PySpark, dbt, dan Auto Loader terjadwal di Databricks Workflows | Selalu gunakan Job Cluster sementara (atau Serverless Jobs) yang menyala saat job mulai, memakai worker Spot/Preemptible (dengan node Driver On-Demand), dan langsung mati saat job selesai. |
| **SQL Warehouse (Serverless + Photon)** | **Di tengah** (warehouse serverless bisa turun ke nol) | Dashboard BI (Power BI, Tableau, Looker), model SQL dbt, dan query analis | Gunakan **Serverless SQL Warehouse** dengan **Photon** (mesin eksekusi C++ tervektorisasi milik Databricks) dan auto-stop yang pendek, agar lonjakan query BI cepat mendapat kapasitas dan waktu idle tidak ditagih. |

**Deployment Berbasis GitOps (Databricks Asset Bundles / DABs):** Sama seperti Modul 3.4 yang melarang ClickOps di konsol AWS, tim produksi tidak menjadwalkan job dengan mengklik manual di UI Databricks. Gunakan **Databricks Asset Bundles (`databricks.yml`)** atau **Terraform Databricks Provider** (`databricks_job`, `databricks_catalog`, `databricks_grants`) di dalam Git sehingga perintah `databricks bundle validate` dan `databricks bundle deploy -t prod` men-deploy Workflows, kebijakan ukuran klaster, dan hak akses Unity Catalog secara terotomasi dari CI/CD.

### 5. Praktik Langsung: Mencoba di Databricks Free Edition (Tanpa Kartu Kredit)
Anda sudah menjalankan Apache Spark asli (`pyspark`) dan Delta Lake asli (`deltalake` / `delta-rs`) secara lokal di laptop Anda pada Modul 2.2 dan 3.1. Untuk mempraktikkan Unity Catalog, SQL Warehouses, Notebooks, dan Workflows langsung di antarmuka Databricks sungguhan dengan biaya **$0**:
1. Buka `https://signup.databricks.com` dan pilih **Databricks Free Edition** (Databricks menyebutnya edisi tanpa biaya untuk pelajar dan penghobi; berjalan di komputasi serverless dengan batas pemakaian, dan Anda tidak butuh akun AWS, GCP, atau Azure sendiri).
2. Di SQL Editor atau Notebook Python, jalankan SQL namespace 3 tingkat (`CREATE TABLE main.default.kopiku_orders USING DELTA CLUSTER BY (order_date) AS ...`), jalankan `DESCRIBE HISTORY main.default.kopiku_orders`, dan uji `SELECT * FROM main.default.kopiku_orders VERSION AS OF 0` untuk melihat mekanisme `_delta_log` dari Modul 2.2 bekerja nyata di dalam Unity Catalog!

> 🛠 **Coba sendiri (20 menit, PySpark dari venv lab, Java 17).** Auto Loader butuh Databricks, tetapi gagasan intinya berjalan di Spark biasa: sebuah file stream mengingat di **checkpoint** file mana yang sudah dibacanya. Tulis tiga file JSON-lines kecil berisi masing-masing 4 pesanan ke `landing/`. Baca foldernya dengan `spark.readStream.schema("order_id LONG, status STRING, total_idr LONG").json("landing")`, tulis sebagai Parquet ke `bronze/` dengan `option("checkpointLocation", "chk")` dan `.trigger(availableNow=True)`, tunggu dengan `awaitTermination()`, lalu cetak jumlah `numInputRows` dari `query.recentProgress` dan jumlah baris `bronze/`. Tambahkan dua file lagi dan jalankan lagi; jalankan untuk ketiga kalinya tanpa ada yang baru; lalu timpa `orders-0.json` dengan pesanan yang dikoreksi (`order_id` baru) dengan nama yang sama dan jalankan untuk keempat kalinya.
>
> **Seharusnya Anda melihat:** `12` baris baru di run 1, `8` di run 2 (`20` di bronze), `0` di run 3, dan `0` lagi di run 4: file koreksi itu memakai nama yang sudah dikenal checkpoint, sehingga barisnya tidak pernah masuk dan tidak ada yang melaporkannya. Auto Loader berperilaku sama secara default, itulah sebabnya mitra harus mengirim koreksi sebagai file baru, dan menghapus checkpoint (yang memproses ulang semuanya) adalah sebuah keputusan, bukan perbaikan. Di Databricks Anda akan menulis `.format("cloudFiles")` dan mendapat inferensi skema serta penanganan kolom baru di atasnya. Diukur dengan Spark 4.3.0 dalam mode lokal.

## @part Membaca kode Spark dalam Scala dan Java

## @lesson Membaca job Spark dalam Scala dan Java {optional}
Spark sendiri ditulis dalam Scala, begitu pula banyak pipeline lama atau yang menuntut performa tinggi. Java atau Scala muncul di **16,9%** dari 1.130 lowongan data engineering yang diukur di TalentHub (2026-07-23 sampai 2026-11-20). Sedikit dari pekerjaan itu yang meminta Anda menulis Scala di hari pertama. Banyak yang akan meminta Anda membaca job yang sudah ada, menemukan bug di dalamnya, atau memindahkannya ke PySpark. API DataFrame memakai nama method yang sama di ketiga bahasa, jadi membaca sebagian besar soal mengetahui daftar pendek perbedaannya.

**Job yang sama dalam Scala dan PySpark.** Kursus menyertakannya sebagai `labs/mod-3-1/scala/revenue_job.scala`:

```scala
import org.apache.spark.sql.functions._
import spark.implicits._

case class Order(orderId: Long, customerId: Long, status: String, totalIdr: Long)

val orders = Seq(
  Order(1, 10, "paid", 150000), Order(2, 10, "cancelled", 90000),
  Order(3, 11, "paid", 200000), Order(4, 12, "shipped", 120000),
  Order(5, 11, "paid", 50000)
).toDS()

val revenue = orders
  .filter($"status" =!= "cancelled")
  .groupBy($"customerId")
  .agg(sum($"totalIdr").as("revenueIdr"), count(lit(1)).as("orders"))
  .orderBy($"revenueIdr".desc)
```

```python
from pyspark.sql import functions as F

revenue = (orders
  .filter(F.col("status") != "cancelled")
  .groupBy("customerId")
  .agg(F.sum("totalIdr").alias("revenueIdr"), F.count(F.lit(1)).alias("orders"))
  .orderBy(F.col("revenueIdr").desc()))
```

**Perbedaan yang penting saat membaca:**

| Scala atau Java | PySpark | Catatan |
|---|---|---|
| `val x = ...` / `var x = ...` | `x = ...` | `val` tidak bisa diisi ulang, `var` bisa. Sebagian besar kode Spark memakai `val`. |
| `case class Order(orderId: Long, ...)` | skema, atau `Row` | Record bertipe. `Seq(...).toDS()` mengubah daftarnya menjadi **Dataset[Order]**. |
| `$"status"` atau `col("status")` | `F.col("status")` | `$"..."` butuh `import spark.implicits._`. |
| `===` dan `=!=` | `==` dan `!=` | Di Scala, `==` membandingkan kedua *objek* kolom dan mengembalikan `Boolean` biasa, sehingga `filter($"status" == "cancelled")` tidak bisa dikompilasi: pesannya berbunyi `filter` `cannot be applied to (Boolean)`. |
| `&&`, `\|\|`, `!` | `&`, `\|`, `~` | Python butuh kurung di setiap kondisi; Scala tidak. |
| `.as("name")` | `.alias("name")` | Pada Dataset, `.as[Long]` (kurung siku) berbeda: ia mengubah tipe. |
| `.desc` | `.desc()` | Scala membolehkan pemanggilan method tanpa argumen tanpa kurung. |
| `o => o.totalIdr` | `lambda o: o.totalIdr` | Lambda Scala pada Dataset bertipe tidak terbaca oleh optimiser, sama seperti UDF Python (Pelajaran 7). |
| `Dataset[Row]` = `DataFrame` | `DataFrame` | Python hanya punya versi tanpa tipe. |

**Java** memakai API yang sama dengan lebih banyak kata: `Dataset<Row> df = spark.read().parquet(path);`, `col("status").notEqual("cancelled")`, dan `functions.sum("totalIdr")`. Nama method-nya sama; tanda bacanya yang berubah.

**Cara job JVM dibangun dan dijalankan.** Proyek Scala punya `build.sbt` (sbt) atau `pom.xml` (Maven, lazim untuk Java) yang mencantumkan versi Spark dan versi Scala. Keduanya harus cocok: library yang dibangun untuk Scala `2.12` tidak bisa dimuat di Spark yang dibangun untuk `2.13`, itulah sebabnya nama konektor berakhiran `_2.13` (Modul 3.3). Hasil build-nya berupa JAR, dijalankan dengan `spark-submit --class com.kopiku.RevenueJob revenue-job.jar 2026-01-15`. `--class` adalah object yang punya method `main`; argumen sesudah JAR diteruskan kepadanya. Untuk bereksperimen, `spark-shell` adalah REPL Scala dengan session `spark` yang sudah siap, padanan `pyspark`. Ia sudah ada di dalam paket `pyspark` yang Anda pasang untuk lab.

**Membaca stack trace JVM.** Error Spark dari Scala, Java, maupun PySpark datang sebagai stack trace Java, sering lebih dari 100 baris. Tiga aturan untuk membacanya:
1. Baca **baris pertama** untuk kelas exception dan pesannya. Error Spark 4 membawa kelas dalam kurung siku, misalnya `[UNRESOLVED_COLUMN.WITH_SUGGESTION]`, yang bisa Anda cari di dokumentasi Spark.
2. Lewati baris `at org.apache.spark...`. Itu kode Spark sendiri, dan hampir tidak pernah menjadi tempat bug Anda. Cari baris `at` pertama yang menyebut package atau file *Anda*.
3. Jika ada baris **`Caused by:`**, yang terakhir adalah akar masalahnya. Baris di atasnya hanya menunjukkan bagaimana error itu merambat naik.

Di PySpark, trace Java yang sama dibungkus trace Python, dan baris yang perlu dibaca adalah yang diawali `pyspark.errors.exceptions...`.

> 🛠 **Coba sendiri (20 menit, terminal, perlu Java 17 dan venv lab; langkah 1 lab di bawah menunjukkan cara memasang Java).** Dengan venv aktif, jalankan job Scala-nya: `spark-shell --master "local[2]" -i labs/mod-3-1/scala/revenue_job.scala`. Job itu diakhiri dengan mencetak pesanan bernilai minimal Rp 100.000. Lalu, tanpa melihat kode PySpark di atas, tulis `revenue_job.py` yang membangun lima pesanan yang sama dan mencetak tabel dan baris yang sama. Terakhir jalankan `spark-shell --master "local[2]" -i labs/mod-3-1/scala/typo_job.scala`. Temukan akar masalah di trace-nya, lalu buat kesalahan yang sama di file PySpark Anda dan bandingkan kedua pesannya.
>
> **Seharusnya Anda melihat:** kedua job mencetak pelanggan `11` dengan `250000` dari `2` pesanan, lalu `10` dengan `150000` dan `12` dengan `120000`, serta baris `big orders: 1,3,4`. `spark-shell` melaporkan `Using Scala version 2.13.18` dan selesai dalam sekitar 15 detik. Job typo gagal dengan `[UNRESOLVED_COLUMN.WITH_SUGGESTION]` untuk `total_idr` dan menyarankan `totalIdr` lebih dulu; PySpark memunculkan kelas error yang sama, sebagai `pyspark.errors.exceptions.captured.AnalysisException`. Diukur dengan Spark 4.3.0 dan OpenJDK 17.

## @lab Lab: membaca physical plan, mendeteksi skew, dan memperbaikinya
Eksekusi Spark dalam local mode langsung di komputer Anda. Anda akan membangun serangkaian fungsi Python untuk **menginspeksi** karakteristik internal query (menghitung jumlah node shuffle Exchange, mengukur rasio skew partisi) serta fungsi untuk **memperbaiki** anomali performa (broadcast join, teknik salting, dan aktivasi konfigurasi adaptive skew join). Seluruh perbaikan akan diuji secara otomatis untuk membuktikan bahwa hasil kalkulasi data tetap identik dengan join standar namun dengan karakteristik plan dan keseimbangan partisi yang jauh lebih unggul.

### @steps
1. Verifikasi instalasi runtime Java dan instal dependensi Python. Spark berjalan di Java virtual machine, jadi `java -version` harus mencetak versi 17 atau lebih baru. Jika muncul `command not found` (hal biasa di Ubuntu atau WSL2 yang baru dipasang), pasang dulu:

```bash
sudo apt install -y openjdk-17-jre-headless   # Ubuntu, Debian, dan WSL2
```

Di macOS, unduh installer gratis **Temurin 17** (`.pkg`) dari adoptium.net, jalankan, lalu buka terminal baru; atau, jika Anda memakai Homebrew, `brew install --cask temurin@17`. Diukur pada Ubuntu 24.04 yang baru dipasang: `java` belum ada, baris `apt` memasang OpenJDK 17, lalu solusi referensi lab ini lulus 12 tesnya dalam sekitar 17 detik dengan PySpark 4.3.


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

> 💡 **Jeda Praktik 5 (Verifikasi Lengkap Spark Lab & Pemeriksaan Java 17):**
> 1. Pastikan runtime Java 17+ telah aktif di komputer Anda (`java -version`).
> 2. Di terminal, jalankan seluruh rangkaian pengujian:
>    `pytest labs/mod-3-1/test_lab.py -v`
> 3. Jalankan pengujian pembanding terhadap solusi referensi:
>    `LAB_DIR=reference pytest labs/mod-3-1/test_lab.py -v`
> 4. **Indikator Sukses:** Seluruh 12 pengujian berstatus `PASSED`, memvalidasi pemahaman komprehensif Anda tentang rencana eksekusi, join terdistribusi, dan penanganan data skew di Apache Spark.

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
- [x] Segelintir task memakan waktu jauh lebih lama dan membaca volume shuffle jauh melampaui median task lainnya
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

### Sebuah job Scala berisi `orders.filter($"status" == "paid")`. Apa yang terjadi?
- [x] Tidak bisa dikompilasi: `==` memberi Boolean, padahal `filter` butuh Column
- [ ] Berjalan dan menyimpan setiap pesanan paid, persis seperti versi dengan `===`
- [ ] Berjalan tetapi tidak menghasilkan baris, karena perbandingannya selalu false
- [ ] Bisa dikompilasi, lalu gagal saat dijalankan dengan error UNRESOLVED_COLUMN

> Di Scala, `==` membandingkan kedua objek itu sendiri dan menghasilkan Boolean. Perbandingan kolom memakai `===` dan `=!=`, dan compiler menolak `filter(Boolean)` dengan pesan "cannot be applied to (Boolean)".

## @resources
- [Dokumentasi Resmi Apache Spark](https://spark.apache.org/docs/latest/)
- [Panduan Penyetelan Performa Spark SQL](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [Referensi API PySpark](https://spark.apache.org/docs/latest/api/python/)
- [Panduan Penggunaan Web UI Spark](https://spark.apache.org/docs/latest/web-ui.html)

