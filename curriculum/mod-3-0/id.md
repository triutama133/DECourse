---
title: Dari Hadoop ke Spark: HDFS, MapReduce, YARN, dan Hive
duration: 2 minggu
summary: Pahami tumpukan big data yang ada sebelum Spark dan lakehouse: bagaimana HDFS menyimpan file di banyak mesin, bagaimana MapReduce menghitung di atasnya, bagaimana YARN membagi klaster, dan bagaimana Hive menaruh SQL di atasnya. Anda membangun ulang setiap gagasan dalam model Python kecil yang bisa diuji, dan melihat bagian mana yang masih penting hari ini.
why: Wawancara dan lowongan kerja masih menyebut Hadoop, HDFS, dan Hive, tetapi kebanyakan tutorial melewatkannya. Tanpa sejarah ini, shuffle, partisi, dan "pindahkan kode ke data" di Spark tampak seperti sulap, dan Anda tidak bisa menjelaskan mengapa tumpukan modern berbentuk seperti sekarang.
---

## @outcomes
- Menjelaskan mengapa data yang terlalu besar untuk satu mesin melahirkan penyimpanan dan komputasi scale-out, dan mengapa "kegagalan itu normal" membentuk desainnya
- Menjelaskan bagaimana HDFS memecah file menjadi blok, mereplikasinya lintas rak, dan bertahan dari kegagalan node, serta menjelaskan masalah file kecil dengan angka
- Menelusuri job MapReduce (map, shuffle, reduce) dengan tangan, menjelaskan fungsi combiner, dan menulis reduce-side join
- Menjelaskan apa yang dijadwalkan YARN dan mengapa manajemen sumber daya dipisahkan dari MapReduce
- Menjelaskan apa itu Hive dan metastore-nya, mengapa tabel adalah "schema on read" di atas file, dan bagaimana Hive mengarah ke Iceberg
- Memetakan setiap komponen era Hadoop ke padanan modernnya dan membicarakannya secara akurat dalam wawancara

## @prereq
Modul 0.0 (Python) dan Modul 2.1 (file kolumnar) membantu. Lab ini memakai Python murni dan tidak butuh klaster. Modul 3.1 (Spark) dibangun langsung di atas modul ini.

## @lesson Mengapa Hadoop diciptakan
Sekitar tahun 2003, sebuah perusahaan pencarian tidak bisa menyimpan web di satu komputer. Satu mesin, sebesar apa pun, punya batas: satu disk menampung beberapa terabyte, membacanya makan waktu berjam-jam, dan mesin terbesar harganya jauh lebih dari sepuluh kali harga sepuluh mesin biasa. Ada dua cara tumbuh. **Scale up** berarti membeli mesin yang lebih besar; ia menabrak langit-langit dan tembok harga. **Scale out** berarti menyambung banyak mesin biasa dan membiarkan mereka berbagi pekerjaan; ia tidak punya langit-langit, tetapi melahirkan masalah baru.

Masalah utamanya adalah kegagalan. Jika satu disk rusak sekali dalam beberapa tahun, klaster 4.000 mesin dengan masing-masing 12 disk kehilangan sebuah disk **hampir setiap hari**. Google menjelaskan jawabannya dalam dua makalah: Google File System (2003) untuk penyimpanan, dan MapReduce (2004) untuk komputasi. Doug Cutting dan rekan-rekannya membangun versi open source-nya, dan Apache **Hadoop** (sejak 2006) menjadi fondasi dekade big data pertama. Gagasan desainnya, yang akan Anda temui lagi di Spark dan Kafka, adalah: **anggap mesin pasti gagal, simpan beberapa salinan data, dan buat komputasi bisa dijalankan ulang**.

Hadoop adalah keluarga empat bagian yang diikuti modul ini berurutan:

| Bagian | Tugas | Gagasan satu kalimat |
|---|---|---|
| **HDFS** | menyimpan file | potong file menjadi blok dan salin tiap blok ke beberapa mesin |
| **MapReduce** | menghitung | kirim fungsi kecil ke tempat data berada, lalu gabungkan hasilnya |
| **YARN** | membagi klaster | memutuskan job mana mendapat mesin mana |
| **Hive** | query dengan SQL | tabel adalah deskripsi yang dibentangkan di atas file |

Gagasan kedua mengalir melalui semuanya: **pindahkan komputasi ke data, bukan data ke komputasi**. Memindahkan blok 1 GB lewat jaringan untuk menjalankan program satu kilobyte itu boros; mengirim program ke mesin yang sudah menyimpan blok itu murah. Prinsip yang sama akan Anda temui lagi sebagai partition pruning, predicate pushdown, dan data locality.

## @lesson HDFS: sistem file yang terbuat dari banyak mesin
Hadoop Distributed File System menyimpan file raksasa di mesin biasa. Sebuah **file** dipotong menjadi **blok** berukuran tetap (bawaannya **128 MiB**; sistem file disk biasa memakai blok 4 KiB). Setiap blok **direplikasi**: secara bawaan **tiga salinan** pada tiga mesin berbeda. Blok terakhir sebuah file sepanjang yang dibutuhkan saja (file 300 MiB menjadi blok 128, 128, dan 44 MiB; `split_into_blocks` di lab melakukan persis ini).

Dua jenis mesin bekerja sama. **NameNode** adalah direktorinya: ia menyimpan di memori namespace (folder dan file) dan, untuk setiap file, daftar blok serta mesin mana yang menyimpan masing-masing. **DataNode** menyimpan byte yang sesungguhnya. DataNode mengirim heartbeat ke NameNode setiap beberapa detik beserta laporan blok miliknya. Jika heartbeat berhenti, NameNode menyatakan node itu mati dan memerintahkan pembuatan salinan blok-bloknya di tempat lain sampai setiap blok kembali punya tiga replika. Begitulah HDFS menyembuhkan dirinya.

**Membaca** sebuah file: klien bertanya kepada NameNode "di mana blok-blok file ini?", lalu membaca setiap blok **langsung dari DataNode** (salinan terdekat). NameNode tidak pernah membawa data file, jadi ia bukan hambatan throughput. **Menulis**: klien meminta NameNode memberi DataNode untuk blok pertama, dan data mengalir lewat sebuah **pipeline** (klien ke DataNode 1, yang meneruskan ke DataNode 2, yang meneruskan ke DataNode 3).

**Rack awareness.** Mesin berada di rak yang berbagi satu switch dan satu catu daya. Kehilangan satu rak utuh adalah kejadian nyata. Kebijakan penempatan bawaan untuk tiga replika: **replika pertama di mesin penulis sendiri, kedua di mesin pada rak yang berbeda, ketiga di mesin lain pada rak yang sama dengan yang kedua**. Ini memberi toleransi kegagalan tingkat rak sambil menjaga sebagian besar lalu lintas tulis di dalam satu rak. `place_replicas` di lab mengimplementasikannya persis, dan `blocks_lost` menunjukkan bahwa sebuah blok hilang hanya jika mesin dari *setiap* replikanya gagal.

**Masalah file kecil.** NameNode menyimpan satu objek di memori untuk setiap file, direktori, dan blok; aturan praktis yang sering dikutip adalah sekitar **150 byte** per objek. `metadata_objects` di lab membuat akibatnya terlihat. Satu terabyte yang disimpan sebagai file 1 GiB adalah 1.024 file dengan 8 blok masing-masing: **9.216 objek**, sekitar 1,4 MB memori NameNode. Terabyte yang sama sebagai file 1 MiB adalah **2.097.152 objek**, sekitar **300 MB**, atau 227 kali lebih banyak, untuk data yang identik. Puluhan juta file kecil bisa menghabiskan memori NameNode dan menjatuhkan seluruh klaster (lihat skenario chaos). HDFS dibuat untuk **file yang sedikit dan besar**.

Batasan lain: file bisa ditambah di akhir tetapi tidak diedit di tengah, jadi HDFS cocok untuk data "tulis sekali, baca berkali-kali"; satu NameNode tunggal akan menjadi titik kegagalan tunggal, sehingga klaster produksi menjalankan NameNode standby dengan journal bersama (**HA**); dan **erasure coding** (Hadoop 3) menyimpan blok paritas, bukan salinan penuh, misalnya enam blok data ditambah tiga blok paritas, yang berbiaya 1,5 kali data dan bukan 3 kali.

## @lesson MapReduce: menghitung dengan memindahkan kode
MapReduce adalah cara menulis komputasi terdistribusi sebagai dua fungsi sederhana. Anda menyediakan **mapper** dan **reducer**; framework mengerjakan bagian sulit menjalankannya di banyak mesin.

Contoh klasiknya menghitung kata. Masukan dipecah menjadi potongan (satu per blok). Setiap potongan ditangani **map task**, yang membaca record dan mengeluarkan pasangan **(key, value)**: untuk baris `"to be or not to be"` mapper mengeluarkan `("to", 1), ("be", 1), ("or", 1), ...`. Lalu datang langkah yang membuat semuanya berfungsi, yaitu **shuffle**: setiap pasangan dengan key yang sama dikirim ke **reducer yang sama**, dan setiap reducer menerima key-nya dalam keadaan terurut. Sebuah **reduce task** lalu melihat `("be", [1, 1])` dan mengeluarkan `("be", 2)`.

```
potongan input --> MAP --> pasangan (key,value) --> SHUFFLE (kelompokkan per key, kirim ke reducer) --> REDUCE --> keluaran
```

Reducer mana yang mendapat key mana? Sebuah **partitioner**: `hash(key) % jumlah_reducer`. Ia harus memberi jawaban yang sama di setiap mesin, jadi dipakai hash yang stabil (lab memakai CRC32; `hash()` bawaan Python berubah antar eksekusi dan akan salah). Semua soal **skew** dari Modul 3.1 bermula di sini: satu key yang sangat umum mengirim semua pasangannya ke satu reducer.

**Combiner** adalah reducer mini yang berjalan di sisi map, sebelum shuffle, untuk memperkecil apa yang harus melewati jaringan. Pada word count di lab, 13 kata menghasilkan 13 pasangan; dengan combiner hanya **7 pasangan** (satu per kata berbeda) yang di-shuffle, dan jawabannya identik. Jaringan adalah sumber daya yang mahal, jadi ini penting.

**Join** memakai mesin yang sama. Pada **reduce-side join**, kedua masukan dipetakan ke `(customer_id, record bertag)`, sehingga shuffle membawa baris seorang pelanggan dan semua pesanan pelanggan itu ke reducer yang sama, yang kemudian bisa menggabungkannya. Anda menulisnya di lab (`revenue_per_city`). Ini juga persis yang dilakukan Spark pada sort-merge join.

**Toleransi kegagalan** berasal dari sifat sederhana: sebuah task bersifat **deterministik** (masukan sama, keluaran sama) dan masukannya tersimpan tahan lama. Jika mesin mati di tengah task, framework menjalankan task yang sama lagi di tempat lain. `retry_task` di lab menunjukkan gagasannya, dan pelajaran fungsi murni di Modul 0.0 adalah mengapa ini aman. Framework juga bisa menjalankan duplikat task yang sangat lambat (**speculative execution**) dan mengambil mana yang selesai lebih dulu.

**Mengapa MapReduce memudar.** Di antara map dan reduce, dan di antara akhir satu job dan awal job berikutnya, data ditulis ke disk dan (untuk keluaran job) ke HDFS dengan tiga replika. Tugas seperti machine learning, yang memutari data yang sama berkali-kali, membayar biaya itu di setiap iterasi. Menulis analisis nyata sebagai rantai job MapReduce juga lambat ditulis dan lambat dijalankan. Spark menyimpan data antara di memori dan merencanakan seluruh rantai sebagai satu graf (Modul 3.1), tetapi ia tetap **melakukan shuffle per key persis seperti dijelaskan di sini**. Jika Anda paham pelajaran ini, shuffle Spark bukan lagi misteri.

## @lesson YARN: membagi klaster
Pada Hadoop pertama, satu komponen menjalankan job MapReduce *dan* memutuskan mesin mana mengerjakan apa. Akibatnya klaster hanya bisa menjalankan MapReduce. **YARN** (Yet Another Resource Negotiator, Hadoop 2) memisahkan kedua tugas itu, sehingga Spark, Tez, Flink, dan lainnya bisa berbagi mesin yang sama.

Bagian-bagiannya: sebuah **ResourceManager** (satu per klaster) tahu memori dan CPU yang bebas di setiap mesin dan memutuskan siapa mendapat apa. Sebuah **NodeManager** di setiap mesin meluncurkan dan mengawasi **container**, yaitu irisan memori dan CPU pada satu mesin. Setiap aplikasi punya **ApplicationMaster**: container pertama sebuah job, yang meminta container tambahan kepada ResourceManager dan menjalankan task job di dalamnya.

Sebuah **scheduler** menentukan urutan ketika permintaan melebihi kapasitas. Yang paling sederhana adalah FIFO: siapa datang dulu dilayani dulu, yang membuat satu job raksasa bisa menghalangi semua orang. Scheduler **Capacity** dan **Fair** membagi klaster antar tim atau job. `allocate_containers` di lab adalah scheduler FIFO first-fit mainan: ia menaruh tiap permintaan pada mesin pertama yang muat dan membiarkan sisanya **pending**. Pekerjaan pending yang menunggu sumber daya adalah tanda paling umum dari klaster yang kelebihan beban, di YARN maupun di Kubernetes.

Hari ini Spark bisa berjalan di YARN (masih umum di on-premises), di Kubernetes (kini lebih umum di cloud), atau di layanan terkelola yang tidak memperlihatkan scheduler. Konsepnya sama: aplikasi meminta container dengan ukuran memori dan CPU, dan sesuatu memutuskan di mana ia berjalan. Ketika executor Spark dimatikan karena melebihi batas memorinya (Modul 3.1), itu adalah YARN atau Kubernetes yang menegakkan ukuran container.

## @lesson Hive: SQL di atas file
Menulis MapReduce dalam Java untuk setiap pertanyaan itu pekerjaan lambat. **Hive** (dari Facebook, sekitar 2008) membiarkan Anda menulis **SQL**; Hive menerjemahkannya menjadi job. Gagasan kuncinya: tabel Hive bukan format penyimpanan khusus. Ia adalah **deskripsi yang dibentangkan di atas file** di HDFS: nama tabel, daftar kolom dan tipenya, serta folder tempat file berada.

Deskripsi itu tinggal di **Hive Metastore**, sebuah database relasional kecil. Untuk setiap tabel ia menyimpan skema, lokasi, format file, dan yang penting, daftar **partisi** (folder seperti `order_date=2026-01-15/`). File datanya sendiri tidak disentuh, sehingga ini disebut **schema on read**: skema diterapkan saat Anda membaca, bukan ditegakkan saat menulis. File yang salah di folder itu tidak ditolak saat tiba; ia gagal (atau memberi NULL) ketika seseorang mengkuerinya. Anda akan mengenali masalah yang diciptakan data contract (Modul 2.5) untuk diselesaikan.

Hive dimulai dengan file teks dan pindah ke format kolumnar, **ORC** dan **Parquet**, dengan alasan dari Modul 2.1. Mesin eksekusinya pindah dari MapReduce ke **Tez** dan kemudian juga Spark, karena MapReduce terlalu lambat untuk SQL interaktif. Mesin terpisah seperti **Impala** dan **Presto/Trino** membaca tabel yang sama di memori untuk query cepat.

Hive Metastore bertahan melewati semua ini, dan ia bagian yang paling mungkin Anda temui di tumpukan modern: Spark, Trino, Athena, dan lainnya masih memakainya (atau AWS Glue Catalog, yang berperan sama) untuk mengetahui "tabel apa yang ada dan di mana". Kelemahannya ada pada format tabel: tabel Hive adalah folder berisi file, tanpa commit atomik, listing direktori yang lambat di penyimpanan cloud, tanpa penulis konkuren yang aman, dan tanpa time travel. **Apache Iceberg** (Modul 2.2) dibuat untuk memperbaiki persis ini sambil mempertahankan gagasan "file terbuka ditambah katalog".

## @lesson Mengapa Spark dan lakehouse menggantikan sebagian besarnya, dan apa yang tersisa
Tiga perubahan bersama menjelaskan pergeseran itu:

1. **Memori dan graf.** Spark menyimpan data antara di memori dan merencanakan seluruh job sebagai satu graf, bukan rantai job yang terikat disk. Untuk pekerjaan bertahap dan iteratif ia jauh lebih cepat, dan API-nya (DataFrame, SQL) jauh lebih ramah daripada MapReduce yang ditulis tangan.
2. **Object storage.** Penyimpanan objek cloud (S3, GCS, Azure storage) menjadi murah, tahan lama, dan nyaris tak terbatas. Mereka memisahkan **penyimpanan dari komputasi**: Anda menyimpan data di S3 dengan biaya receh dan menyalakan klaster hanya selama dibutuhkan. Klaster HDFS sebaliknya membayar mesin (dan disknya) sepanjang waktu karena komputasi dan penyimpanan berada di kotak yang sama.
3. **Layanan terkelola dan format tabel terbuka.** Mengoperasikan klaster Hadoop adalah kerja berat. Spark terkelola, warehouse, dan tabel Iceberg/Delta memindahkan pekerjaan itu ke penyedia.

Apa yang tersisa, agar Anda bicara akurat: banyak perusahaan **on-premises** masih menjalankan HDFS dan YARN, terutama bank besar, telekomunikasi, dan platform lama; **Hive Metastore** dan folder berpartisi ala Hive ada di mana-mana; **pustaka Hadoop** (konektor S3A, pembaca Parquet dan ORC) ada di dalam Spark; dan konsepnya (blok, replikasi, shuffle, locality, scheduler) adalah kosakata sistem terdistribusi. Apakah keahlian Hadoop muncul di lowongan di pasar *Anda* adalah hal yang perlu dicek pada lowongan nyata sebelum Anda memutuskan seberapa dalam mempelajarinya.

Tabel terjemahan untuk wawancara:

| Era Hadoop | Hari ini, biasanya |
|---|---|
| HDFS | S3, GCS, atau Azure storage (object storage), kadang masih HDFS |
| MapReduce | Spark (juga Flink, dan mesin SQL seperti Trino) |
| YARN | Kubernetes, atau YARN di on-premises, atau layanan terkelola |
| Tabel Hive | Tabel Iceberg atau Delta dengan katalog |
| Hive Metastore | Hive Metastore, AWS Glue Catalog, atau katalog Iceberg |
| Oozie (workflow) | Airflow atau Dagster (Modul 2.4) |
| HBase | Cassandra, DynamoDB, atau Bigtable (Modul 1.7) |
| Sqoop (impor database) | Debezium dan Kafka Connect (Modul 3.2), atau Airbyte/Fivetran |
| ZooKeeper (koordinasi) | konsensus bawaan, seperti KRaft milik Kafka |

**Pertanyaan yang kini bisa Anda jawab:** "Mengapa tiga replika?" (kegagalan itu normal; dua akan menyisakan satu salinan saat gagal; tiga juga memungkinkan satu salinan di luar rak). "Apa itu shuffle?" (pengelompokan keluaran map per key lewat jaringan; langkah yang mahal di MapReduce dan Spark). "Mengapa Spark menggantikan MapReduce?" (di memori, perencanaan graf, API lebih ramah). "Apa itu masalah file kecil?" (objek metadata menghabiskan memori NameNode; di S3 itu biaya listing dan membuka banyak file).

## @lab Lab: HDFS, MapReduce, dan YARN dalam miniatur
Bangun tiga model kecil yang deterministik dalam Python murni: pemecahan blok HDFS, penempatan replika sadar-rak, kegagalan, dan aritmetika file kecil; mesin MapReduce (map, partisi, shuffle, reduce, combiner, reduce-side join, pengulangan task); dan scheduler YARN mainan. Tidak perlu klaster, dan tesnya (38) memeriksa setiap perilaku yang dijelaskan pelajaran.

### @steps
1. Baca `labs/mod-3-0/hadoop_lab.py` dari atas ke bawah. Docstring tiap fungsi punya contoh dan menyebut pelajaran mana yang menjelaskannya.
2. Kerjakan sesuai urutan file, dan jalankan tes setelah SETIAP fungsi:

```bash
pytest labs/mod-3-0/test_lab.py -v
pytest labs/mod-3-0/test_lab.py -v -k "Blocks or Replica"      # satu kelompok pada satu waktu
```

3. **HDFS dulu.** Sebelum menulis `place_replicas`, gambar enam mesin dan tiga rak pada tes di kertas dan putuskan dengan tangan ke mana replika blok yang ditulis dari `a1` pergi. Lalu kodekan dan bandingkan.
4. **MapReduce berikutnya.** Tulis `partition` dan `shuffle`, lalu cetak `lab.shuffle(pairs, 3)` untuk masukan kecil dan baca hasilnya: inilah yang diterima setiap reducer di klaster sungguhan. Lalu bangun `run_job` dan combiner. Bandingkan `shuffled_pairs` dengan dan tanpa combiner.
5. **Join-nya.** Tulis `revenue_per_city` sebagai reduce-side join. Sebelum menjalankan, tebak apa yang dilihat reducer untuk satu pelanggan.
6. Eksperimen: ubah jumlah reducer, ukuran blok, atau combiner dan tebak setiap hasilnya lebih dulu. Lalu pakai `metadata_objects` untuk menghitung berapa memori NameNode yang dibutuhkan 50 juta file kecil.
7. **Kerjakan yang sesungguhnya.** Setelah Modul 0.2, tulis kodenya lagi di venv Anda sendiri **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-3-0` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-3-0/hadoop_lab.py :: File kerja Anda: implementasikan lima belas fungsi TODO :: starter
- labs/mod-3-0/test_lab.py :: Ke-38 tes yang memeriksa pekerjaan Anda :: test
- labs/mod-3-0/requirements.txt :: pytest :: config
- labs/mod-3-0/reference/hadoop_lab.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 38 tes lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri** (lab ini tidak punya pratinjau browser)
- Anda bisa menjelaskan penempatan replika bawaan HDFS dan mengapa sebuah blok bertahan dari hilangnya satu rak
- Anda bisa menjelaskan apa yang diubah combiner dan apa yang tidak bisa diubahnya (jawabannya), memakai angka 13 dan 7 dari tes word count
- Anda bisa menjelaskan masalah file kecil dengan contoh 9.216 versus 2.097.152 objek

### @verify
```bash
pytest labs/mod-3-0/test_lab.py -v
python3 scripts/prove.py mod-3-0
```

Jalankan yang diketahui benar: awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Empat puluh juta file kecil
### @scenario
Sebuah tim memasukkan event clickstream ke HDFS. Agar data cepat masuk ke lake, sebuah job menulis **satu file per micro-batch per partisi** setiap menit, masing-masing file beberapa ratus kilobyte. Ini berjalan berbulan-bulan. Setelah kampanye pemasaran jumlah partisi bertambah, dan jumlah file melewati empat puluh juta.

Pertama, listing direktori menjadi lambat, dan setiap query menghabiskan beberapa menit hanya untuk membuka file. Lalu NameNode mulai berhenti lama karena garbage collection, dan akhirnya kehabisan heap dan restart, membawa seluruh klaster bersamanya. Setiap job gagal dengan error koneksi, padahal tidak ada DataNode dan tidak ada disk yang bermasalah. Memulai ulang NameNode memakan lebih dari satu jam karena ia harus memuat dan memverifikasi metadata setiap file.

### @cause
Setiap file dan setiap blok adalah objek di memori NameNode. Empat puluh juta file, masing-masing dengan setidaknya satu blok, sekitar 80 juta objek; pada kira-kira 150 byte masing-masing itu **sekitar 12 GB** heap hanya untuk metadata, sebelum beban kerja apa pun (aritmetika yang sama dengan `metadata_objects` dan `namenode_memory_bytes` di lab: satu terabyte sebagai file 1 MiB adalah 227 kali lebih banyak objek daripada sebagai file 1 GiB). HDFS dirancang untuk file yang sedikit dan besar, dan volume datanya kecil; yang menjadi masalah adalah *jumlahnya*. Dashboard pemantauan yang menampilkan pemakaian disk dan CPU tetap hijau, karena tidak satu pun dari keduanya adalah batasnya.

Kesalahan yang sama di object storage (S3) tidak merusak NameNode, tetapi merugikan dengan cara lain: listing yang lambat, satu permintaan per file, dan Spark lebih banyak menghabiskan waktu membuka file daripada membacanya.

### @fix
1. Hentikan penulisnya dan **compact**: gabungkan file kecil menjadi file sedikitnya satu blok (128 MiB atau lebih) dengan job batch, lalu hapus yang kecil. Lakukan partisi demi partisi agar klaster tetap bisa dipakai.
2. Ubah pipeline agar tidak pernah membuat file kecil: tulis batch lebih besar lebih jarang, atau tulis ke log (Kafka) dan biarkan sebuah job menghasilkan file besar, atau pakai format tabel dengan compaction bawaan (Iceberg, Modul 2.2).
3. **Pantau jumlah objek** (file ditambah blok) dan heap NameNode, dengan alert jauh sebelum batasnya, bukan hanya disk dan CPU.
4. Tetapkan kebijakan dan pemeriksaan di code review: target ukuran file untuk setiap dataset, dan tes yang gagal jika sebuah job menulis file jauh lebih kecil dari itu.
5. Untuk keamanan jangka panjang, partisi berdasarkan sesuatu dengan nilai lebih sedikit, dan pakai **federation** atau pindahkan penyimpanan ke object storage yang metadatanya tidak ditahan di memori satu mesin.

### @pattern
Sumber daya yang langka tidak selalu yang tampak jelas. Metadata dan jumlah file bisa menghabiskan sistem yang punya banyak disk dan CPU, jadi ukurlah hal yang sungguh-sungguh menjadi batasnya.

## @quiz
### Mengapa HDFS secara bawaan menyimpan setiap blok di beberapa mesin?
- [ ] Membaca dari tiga mesin sekaligus selalu membuat satu file terunduh tiga kali lebih cepat
- [x] Mesin dan disk sering rusak di klaster besar, jadi salinan tambahan menjaga data tetap utuh
- [ ] Setiap salinan dienkripsi secara berbeda, sehingga penyerang butuh ketiganya untuk membacanya
- [ ] NameNode tidak bisa menyimpan lokasi sebuah blok kecuali blok itu ada di setidaknya tiga node

> Pada skala klaster kegagalan itu normal. Tiga replika (satu di luar rak) membuat blok bertahan dari hilangnya satu mesin atau satu rak utuh, dan NameNode mereplikasi ulang ketika node mati.

### Apa yang dilakukan NameNode?
- [ ] Ia menyimpan data file dan mengirimkannya ke klien yang memintanya lewat kartu jaringannya
- [x] Ia menyimpan direktori dan lokasi blok di memori, sedangkan DataNode menyimpan byte asli
- [ ] Ia menjalankan task map dan reduce, karena ia tahu mesin mana yang bebas setiap saat
- [ ] Ia mengompresi blok sebelum ditulis dan mendekompresinya untuk setiap pembacaan klien

> NameNode adalah direktori (namespace dan peta blok). Klien lalu membaca blok langsung dari DataNode, jadi data file tidak pernah mengalir melaluinya.

### Mengapa jutaan file kecil menjadi masalah bagi HDFS?
- [ ] File kecil tidak bisa direplikasi, sehingga hanya ada di satu mesin tanpa salinan tambahan
- [ ] HDFS menolak membuka file yang lebih kecil dari ukuran blok 128 MiB saat ia dibaca kembali
- [x] Setiap file dan blok adalah objek metadata di memori NameNode, sehingga bisa habis
- [ ] File kecil disimpan tanpa kompresi, yang membuat disk setiap DataNode cepat penuh

> Biayanya adalah metadata, bukan byte. Di lab satu terabyte sebagai file 1 MiB butuh 2.097.152 objek, 227 kali lebih banyak daripada sebagai file 1 GiB.

### Pada word count MapReduce, apa tujuan shuffle?
- [ ] Mengacak urutan kata agar tidak ada reducer yang menerima terlalu banyak masukan
- [ ] Menyalin blok masukan ke tiga mesin sebelum task map mana pun boleh dimulai
- [x] Mengirim pasangan ber-key sama ke satu reducer, agar ia melihat semua nilai key itu
- [ ] Mengurutkan keluaran akhir menurut jumlah agar kata terbanyak dicetak di baris pertama

> Shuffle mengelompokkan keluaran map per key lewat jaringan. Ia juga langkah yang mahal, dan operasi yang sama disebut shuffle oleh Spark.

### Apa yang diubah combiner pada job MapReduce?
- [ ] Ia mengubah jawaban akhir, karena menggabungkan key berbeda yang tampak mirip sebelum direduksi
- [ ] Ia membuat mapper berjalan di lebih banyak mesin, sehingga job butuh lebih sedikit task reduce lagi
- [x] Ia memperkecil data di sisi map sebelum shuffle, sehingga lebih sedikit lewat jaringan, hasil sama
- [ ] Ia menyimpan keluaran map di HDFS dengan tiga replika, agar mapper yang gagal tidak perlu diulang

> Di lab, 13 pasangan keluaran map menjadi 7 pasangan yang di-shuffle dengan combiner, dengan hasil identik. Combiner hanya bekerja untuk operasi yang hasil parsialnya bisa digabung, seperti penjumlahan.

### Mengapa task MapReduce yang gagal bisa langsung dijalankan lagi di mesin lain?
- [x] Task deterministik dan masukannya tahan lama, jadi menjalankannya lagi memberi keluaran yang sama
- [ ] Mesin yang gagal menyimpan snapshot memorinya yang dimuat mesin berikutnya sebelum melanjutkan
- [ ] YARN menjamin tidak ada mesin yang gagal saat menjalankan task, sehingga kasus itu tidak terjadi
- [ ] Reducer menunggu sampai semua mapper berhasil sekali, lalu jawaban akhir diambil dari proses pertama

> Task murni yang bisa diulang atas masukan yang tahan lama membuat pengulangan aman. Sifat yang sama membuat langkah pipeline idempoten (Modul 0.1).

### Apa itu Hive Metastore?
- [ ] Cache yang menyimpan hasil query terbaru agar Hive bisa menjawabnya tanpa membaca file apa pun
- [ ] Format file khusus yang menyimpan tabel Hive di HDFS dengan transaksi dan time travel bawaan
- [x] Database kecil yang mencatat skema, lokasi, dan partisi setiap tabel di atas file yang mendasarinya
- [ ] Scheduler yang memutuskan query Hive mana yang berjalan lebih dulu saat mesin klaster terlalu sedikit

> Tabel Hive adalah deskripsi yang dibentangkan di atas file. Metastore menyimpan deskripsi itu, dan ia hidup lebih lama daripada Hive: Spark, Trino, dan Athena masih memakainya atau Glue Catalog.

### Pernyataan mana yang paling baik menjelaskan mengapa Spark dan object storage cloud sebagian besar menggantikan MapReduce dan HDFS?
- [ ] MapReduce tidak bisa memproses lebih dari satu terabyte data, dan HDFS tidak bisa menyimpan jenis file apa pun
- [x] Spark menyimpan data di memori dengan API ramah, dan object storage memisahkan penyimpanan dari komputasi
- [ ] Perusahaan berhenti menyimpan data dalam file sama sekali, karena database modern tidak butuh format file
- [ ] Hadoop dilarang oleh penyedia cloud, sehingga setiap perusahaan harus pindah ke vendor lain sekaligus

> Eksekusi graf di memori, object storage tahan lama yang murah dengan komputasi sesuai kebutuhan, dan layanan terkelola membuat tumpukan lama mahal dijalankan. Konsepnya (blok, shuffle, locality) tetap hidup.

## @resources
- [Apache Hadoop: Arsitektur HDFS](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html)
- [Makalah Google File System (2003)](https://research.google/pubs/the-google-file-system/)
- [MapReduce: Simplified Data Processing on Large Clusters (2004)](https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/)
- [Apache Hadoop YARN](https://hadoop.apache.org/docs/stable/hadoop-yarn/hadoop-yarn-site/YARN.html)
- [Apache Hive: Memulai](https://hive.apache.org/docs/latest/)
