---
title: Di Luar SQL: Database Key-Value, Dokumen, Wide-Column, dan Graf
duration: 2 minggu
summary: Pelajari mengapa keluarga database lain ada, apa kelebihan dan kekurangan masing-masing, dan cara memilih berdasarkan pola akses. Anda membangun ulang inti key-value store, document store, cincin consistent hashing, replikasi quorum, dan tabel wide-column dalam Python murni, lalu melihat apa yang harus dilakukan data engineer ketika data berada di sistem seperti itu.
why: Bootcamp bilang "pakai MongoDB untuk data fleksibel dan Cassandra untuk skala" lalu berhenti. Tanpa tahu cara kerjanya Anda tidak bisa memilih, tidak bisa memodelkan data untuknya, dan tidak bisa dengan andal memasukkan datanya ke warehouse, tempat sebagian besar pekerjaan data engineering dimulai.
---

## @outcomes
- Menjelaskan apa keunggulan database relasional, dan tekanan apa yang melahirkan database key-value, dokumen, wide-column, dan graf
- Menyatakan teorema CAP dengan benar, dan menjelaskan arti eventual consistency dalam praktik
- Memilih di antara keluarga database berdasarkan pola akses, dan menjelaskan trade-off-nya
- Menjelaskan partition key, clustering key, consistent hashing, serta baca dan tulis quorum, dan mengapa partition key yang buruk menciptakan titik panas
- Menjelaskan bagaimana data diekstrak dari sistem seperti itu (change stream, ekspor) dan mengapa analitik tidak boleh dijalankan di operational store
- Meratakan dokumen menjadi tabel dan menangani schema drift saat ingestion

## @prereq
Modul 0.3 (dasar SQL) dan 1.3 (index) membantu. Lab ini memakai Python murni (Modul 0.0 sudah cukup); tidak ada database yang perlu dipasang.

## @lesson Mengapa ada database lain
Database relasional unggul dalam satu hal: menjaga **data terstruktur dan saling terkait tetap benar** sementara banyak orang membaca dan mengubahnya, dan menjawab **pertanyaan yang tidak Anda rencanakan** dengan SQL. Tabel, key, join, dan transaksi (Modul 0.3) menyelesaikan rentang masalah yang sangat luas, dan untuk kebanyakan aplikasi ia tetap pilihan pertama yang tepat.

Keluarga lain muncul karena **tekanan** yang kurang ditangani baik oleh satu server relasional:

- **Skala dan volume tulis.** Satu mesin punya batas. Menyebar satu database logis ke banyak mesin (sharding) mungkin dilakukan dengan SQL tetapi sulit, karena join dan transaksi lintas mesin lambat dan rumit.
- **Latensi.** Beberapa pertanyaan harus dijawab dalam semilidetik ("apakah sesi ini valid?"), yang menyarankan menyimpan data di memori dengan pencarian paling sederhana.
- **Bentuk data.** Sebagian data bersarang dan berbeda dari record ke record (katalog produk yang tiap kategorinya punya atribut berbeda), atau sebagian besar berupa *relasi* (jejaring sosial).
- **Ketersediaan.** Keranjang belanja yang tidak bisa ditulis ketika satu pusat data tidak terjangkau kehilangan penjualan.

Keluarga NoSQL adalah jawaban atas tekanan ini, dan setiap jawaban ada harganya. Pertukaran utamanya: **melepas sebagian kekuatan umum SQL (query ad hoc, join, transaksi ketat) demi skala, kecepatan, atau fleksibilitas untuk pola akses tertentu**. Jadi pertanyaannya tidak pernah "mana yang lebih baik" tetapi "**bagaimana data ini akan diakses?**".

Dua gagasan membantu Anda bernalar tentang pertukaran itu. **Teorema CAP** menyatakan bahwa ketika **partisi jaringan** terjadi (sebagian mesin tidak bisa berbicara dengan yang lain), sistem terdistribusi harus memilih antara **konsistensi** (setiap pembacaan melihat tulisan terbaru, sehingga sebagian permintaan harus ditolak) dan **ketersediaan** (setiap permintaan mendapat jawaban, yang mungkin basi). Partisi tidak bisa dikesampingkan, jadi pilihan sesungguhnya adalah C atau A *selama* partisi. **PACELC** menambahkan kasus sehari-hari: bahkan tanpa partisi ada pertukaran antara **latensi** dan **konsistensi**, karena menunggu lebih banyak replika itu lebih lambat. Banyak sistem NoSQL memilih ketersediaan dan latensi rendah dan menawarkan **eventual consistency**: jika penulisan berhenti, semua replika konvergen, tetapi pembacaan bisa sesaat mengembalikan nilai lama. Yang lain membiarkan Anda memilih per query, seperti yang akan Anda lihat pada quorum.

ACID (transaksi atomik, konsisten, terisolasi, tahan lama) adalah janji relasional. Sebagian sistem NoSQL melonggarkannya (kadang bercanda disebut BASE: basically available, soft state, eventually consistent), dan banyak yang kemudian menambahkan transaksi terbatas. Selalu baca apa yang dijamin produk tertentu.

## @lesson Key-value store: database paling sederhana
Key-value store adalah dictionary raksasa: Anda **set** sebuah nilai di bawah sebuah **key** dan **get** kembali lewat key itu. Itu saja. Tampaknya terlalu sederhana untuk berguna, tetapi justru itu yang membuatnya sangat cepat: tidak ada yang perlu direncanakan, diurai, atau di-join. Contoh: **Redis**, Memcached, dan DynamoDB dalam bentuk paling sederhananya.

**Redis** menyimpan data di memori dan juga menawarkan *struktur* data sebagai nilai: string, hash (dictionary kecil), list, set, dan **sorted set** (set yang diurutkan menurut skor, sempurna untuk papan peringkat). Ia bisa menulis ke disk (snapshot, atau log append-only) agar data bertahan setelah restart, tetapi kekuatannya adalah kecepatan, bukan menyimpan segalanya selamanya.

Dua fitur menentukan bagaimana key-value store dipakai:

- **TTL (time to live).** Sebuah key bisa kedaluwarsa otomatis setelah sejumlah detik. Sesi, one-time password, dan hasil cache memakainya. `KeyValueStore` di lab mengedaluwarsakan key ketika `clock() >= waktu_set + ttl`; jam disuntikkan sehingga tes tidak perlu tidur.
- **Eviction.** Memori terbatas. Ketika penuh, store harus membuang sesuatu; **LRU** (least recently used) membuang key yang paling lama tidak disentuh. Lab mengimplementasikannya dengan dictionary terurut, tempat setiap `get` atau `set` memindahkan key ke ujung "terbaru".

**Untuk apa:** meng-cache hasil query mahal, sesi, rate limiting (hitung permintaan per pengguna per menit), penghitung, papan peringkat, feature flag, antrean job kecil. **Bukan untuk:** menanyakan "semua pelanggan di Jakarta yang belanja di atas 1 juta", karena satu-satunya pintu masuk adalah key. Jika Anda perlu menemukan data lewat hal selain key, Anda harus memelihara key tambahan sendiri, dan pada titik itu keluarga lain mungkin lebih cocok.

Data engineer bertemu key-value store sebagai *lapisan penyajian* pipeline (feature store, pencarian real-time) dan sebagai cache yang membuat data pipeline tampak basi. Ingat bahwa cache adalah **salinan**: ketika sumber berubah, salinan itu salah sampai ia kedaluwarsa atau di-invalidasi.

## @lesson Database dokumen: bentuk yang fleksibel
Database dokumen menyimpan **dokumen**, biasanya JSON (MongoDB menyimpan bentuk biner bernama BSON; batas 16 MB per dokumen), dikelompokkan dalam **collection**. Sebuah dokumen bisa berisi objek bersarang dan array, dan dua dokumen dalam collection yang sama bisa punya field berbeda. Contoh: **MongoDB**, Couchbase, Firestore.

```json
{ "_id": "1001", "customer": {"name": "Sari", "city": "Jakarta"},
  "items": [ {"sku": "KS-1", "qty": 2}, {"sku": "ES-9", "qty": 1} ], "status": "paid" }
```

Seluruh pesanan, beserta barisnya, adalah **satu dokumen**: Anda membaca dan menulisnya dalam satu operasi, tanpa join. Itulah pilihan pemodelan utama, **embedding versus referencing**. Embed data yang dibaca bersama dan milik induknya (baris pesanan di dalam pesanan). Referensikan (simpan sebuah id) data yang dipakai bersama atau tumbuh tanpa batas, seperti semua pesanan seorang pelanggan, yang akan membuat satu dokumen pelanggan tumbuh selamanya.

Database ini **tidak menegakkan skema secara bawaan**; strukturnya adalah apa pun yang ditulis aplikasi. Ini **schema on read**, gagasan yang sama dengan Hive (Modul 3.0). Cepat untuk memulai dan berbahaya kemudian: field yang dieja dua cara, angka yang disimpan sebagai teks di sebagian dokumen, field yang hilang di dokumen lama. Aturan validasi ada, tetapi Anda harus mengaktifkannya.

Anda mengkueri dengan bahasa berbentuk dokumen: `{"customer.city": "Jakarta", "total": {"$gte": 100000}}` (`DocumentStore.find` di lab mendukung path bertitik dan operator `$gt $gte $lt $lte $ne $in`). **Index** penting persis seperti di SQL: tanpanya, sebuah query **memindai setiap dokumen**. Di lab, mencari satu pengguna di antara 10.000 dokumen memindai **10.000** dokumen tanpa index, dan **10** dengan index. Aggregation pipeline (filter, group, sort, project secara bertahap) mencakup pertanyaan bergaya analitik, dan sejak versi 4.0 MongoDB mendukung transaksi multi-dokumen, meskipun tujuan desainnya tetap menyimpan data terkait dalam satu dokumen.

**Untuk apa:** konten, katalog, profil pengguna, apa pun yang bersarang dan berkembang, tempat aplikasi membaca objek utuh. **Jebakan:** array tanpa batas di dalam dokumen, tanpa join (sehingga data yang berulang harus diperbarui di banyak tempat), dan schema drift.

**Bagi data engineer** ini adalah sumber NoSQL yang paling umum. Dokumen harus **diratakan** menjadi baris: objek bersarang menjadi kolom (`customer_city`), array menjadi tabel anak dengan satu baris per elemen dan id induknya (`items` di atas menjadi tabel `order_items`). Rencanakan untuk field yang muncul dan hilang, dan untuk perubahan tipe, dengan gagasan kontrak dari Modul 2.5.

## @lesson Wide-column dan store berpartisi: skala sejak desain
Cassandra, ScyllaDB, DynamoDB, Bigtable, dan HBase dibangun untuk menyebar data ke **banyak mesin** dan tetap bekerja saat sebagian gagal. Meski bernama "wide-column", cara terbaik memahaminya adalah lewat **primary key**, yang punya dua bagian:

- **Partition key** menentukan *mesin mana* yang menyimpan baris. Semua baris dengan partition key yang sama tinggal bersama.
- **Clustering key** (DynamoDB: sort key) menentukan **urutan baris di dalam** partisi, yang secara fisik terurut.

`WideColumnTable("customer_id", "order_ts")` di lab memodelkan ini: semua pesanan seorang pelanggan membentuk satu partisi, diurutkan menurut waktu, sehingga "10 pesanan terakhir pelanggan 7" atau "pesanan pelanggan 7 pada Januari" adalah pembacaan cepat atas **satu** irisan terurut. Menanyakan "semua pesanan Januari untuk setiap pelanggan" tidak punya jawaban efisien, dan lab menolak query tanpa partition key. Inilah **pemodelan berbasis query**: di database relasional Anda merancang tabel dari data dan menulis query apa pun kemudian; di sini Anda **mendaftar query lebih dulu**, lalu merancang satu tabel per query, mengulang (denormalisasi) data seperlunya. Ini pergeseran mental terbesar.

**Bagaimana partisi ditempatkan.** Cara naifnya `hash(key) % jumlah_node`, tetapi saat Anda menambah satu node hampir semua key berpindah. Lab mengukurnya pada 10.000 key dari 4 ke 5 node: **modulo hashing memindahkan 79,5% key**. **Consistent hashing** menaruh node (dan banyak posisi *virtual* per node) pada sebuah cincin; sebuah key menjadi milik node berikutnya searah jarum jam. Menambah node hanya mengambil bagiannya: `HashRing` di lab memindahkan **19,9%** key, sekitar seperlima, dan setiap key yang pindah menuju node baru. Virtual node penting untuk keseimbangan: dengan satu posisi per node, ketiga node di lab memegang 0,2%, 99,4%, dan 0,4% key; dengan 200 posisi masing-masing mereka memegang 28%, 33%, dan 39%.

**Replikasi dan konsistensi yang bisa diatur.** Setiap partisi disalin ke *N* replika (umumnya 3). Sebuah penulisan diakui setelah **W** replika mengonfirmasi; sebuah pembacaan bertanya ke **R** replika dan mengembalikan versi terbaru. Jika **R + W > N**, himpunan baca mana pun beririsan dengan himpunan tulis mana pun, sehingga pembacaan **pasti** melihat tulisan terakhir yang diakui. Dengan N = 3: W=2, R=2 aman ("quorum"); W=1, R=1 cepat tetapi bisa mengembalikan data basi; W=3, R=1 aman untuk pembacaan tetapi penulisan gagal jika satu replika mati. `ReplicaSet` di lab memperlihatkan persis ini, termasuk `Unavailable` ketika terlalu sedikit replika hidup. Anda membayar konsistensi dengan latensi dan ketersediaan, itulah PACELC dalam praktik.

**Penulisan murah** karena desain log-structured: penulisan ditambahkan ke commit log dan tabel memori, lalu di-flush ke file terurut yang tidak bisa diubah (SSTable) yang digabung kemudian (**compaction**). Penghapusan tidak benar-benar menghapus: ia menulis **tombstone**, yang baru dibuang setelah masa aman; banyak tombstone memperlambat pembacaan.

**Apa yang salah:** **hot partition** (satu partition key menerima sebagian besar lalu lintas, seperti tanggal hari ini) membebani satu mesin sementara yang lain tidur; partisi yang tumbuh tanpa batas; dan query yang butuh pemindaian penuh. **DynamoDB** menambah operasi terkelola dan batas keras 400 KB per item, dan Anda membayar menurut kapasitas atau per permintaan.

## @lesson Graf, pencarian, time-series, dan lainnya
Beberapa pola akses bukan satu pun dari yang di atas.

**Database graf** (Neo4j, Amazon Neptune) menyimpan **node** dan **relasi** (edge), keduanya dengan properti, dan menjadikan *menelusuri relasi* sebagai operasi cepat. Di SQL, "teman dari teman dari teman" butuh satu self-join per lompatan dan cepat melambat; database graf berjalan langsung di edge. Pakai bila pertanyaannya tentang koneksi: jaringan fraud (akun yang berbagi perangkat dan alamat), rekomendasi, analisis jaringan dan dependensi, data lineage. Bahasa query Neo4j adalah Cypher, misalnya `MATCH (a:Account)-[:USES]->(d:Device)<-[:USES]-(b:Account) RETURN a, b`. Ia bukan pilihan pertama untuk pelaporan tabular.

**Mesin pencari** (Elasticsearch, OpenSearch) membangun **inverted index** (kata ke daftar dokumen) sehingga bisa mencocokkan teks, meranking hasil menurut relevansi, dan memfilter dengan cepat. Mereka untuk kotak pencarian dan penjelajahan log, bukan sistem pencatat utama.

**Database time-series** (TimescaleDB, InfluxDB) disetel untuk data yang banyak ditambah dan diindeks menurut waktu (metrik, pembacaan sensor), dengan retensi dan downsampling otomatis. **Database vektor** menyimpan embedding untuk pencarian kemiripan (Modul 3.5). Banyak dari ini adalah fitur sistem lain: PostgreSQL melakukan time series dengan ekstensi dan pencarian vektor dengan pgvector.

Pelajaran untuk disimpan: sebuah keluarga database adalah kumpulan **optimasi untuk sebuah pola akses**. Jika Anda tahu polanya, keluarganya biasanya mengikuti; jika Anda belum tahu polanya, mulailah dengan database relasional dan pelajari polanya dulu.

## @lesson Memilih, dan apa yang dilakukan data engineer dengannya
Panduan keputusan singkat, didorong oleh cara data dibaca:

| Pola akses utama | Biasanya |
|---|---|
| Banyak pertanyaan berbeda, join, kebenaran ketat | relasional (PostgreSQL, MySQL) |
| Mencari satu hal lewat id, cepat; cache; sesi; penghitung | key-value (Redis, DynamoDB) |
| Membaca dan menulis objek bersarang utuh; bentuknya bervariasi | dokumen (MongoDB) |
| Volume tulis sangat besar, query diketahui lewat key dan waktu, selalu menyala | wide-column (Cassandra, DynamoDB, Bigtable) |
| Pertanyaannya tentang relasi dan jalur | graf (Neo4j) |
| Teks bebas dan relevansi | mesin pencari (Elasticsearch) |
| Metrik sepanjang waktu | time-series |
| Analitik atas riwayat yang sangat besar | **bukan ini**: warehouse atau lakehouse (Modul 2.2 dan 2.6) |

Perusahaan memakai beberapa sekaligus (**polyglot persistence**): PostgreSQL untuk pesanan, Redis untuk sesi, Elasticsearch untuk pencarian, Cassandra untuk event. Itu melipatgandakan tempat data berada, dan itulah mengapa data engineer ada.

**Tugas Anda di sekitarnya.**

1. **Jangan pernah menjalankan analitik di operational store.** Pemindaian atas MongoDB atau Cassandra produksi bersaing dengan pelanggan dan sering gagal karena timeout. Salin data ke analytical store.
2. **Ekstrak secara inkremental.** Pakai change feed sistemnya: change stream MongoDB, DynamoDB Streams, CDC Cassandra, atau konektor Debezium (Modul 3.2). Gunakan ekspor penuh ke object storage untuk data kecil atau yang jarang berubah.
3. **Ratakan dan beri tipe.** Ubah dokumen menjadi tabel seperti pelajaran 3, putuskan cara menangani field yang hilang dan polimorfik, dan catat skema yang Anda asumsikan.
4. **Perhatikan konsistensi.** Membaca dari replika bisa mengembalikan data lama, dan snapshot yang diambil saat penulisan berlanjut bisa tidak konsisten antar partisi. Catat kapan dan dari mana Anda membaca.
5. **Hormati pola akses.** Jika Anda harus mengkueri atribut yang tidak diindeks store, minta tim aplikasi menambah index atau tabel turunan, daripada memindai.

Kini Anda bisa menjawab pertanyaan yang lazim: "Mengapa tidak MongoDB untuk semuanya?" (tanpa join, schema drift, analitik terbatas). "Apa itu partition key?" (menentukan penempatan dan satuan penskalaan). "Apa arti R + W > N?" (pembacaan beririsan dengan penulisan, jadi melihat tulisan terbaru, dengan harga latensi dan ketersediaan). "Mengapa consistent hashing?" (menambah atau membuang node memindahkan sebagian kecil key, bukan hampir semuanya).

## @lab Lab: lima gagasan database dalam Python murni
Bangun lima model kecil yang deterministik: **key-value store** dengan TTL dan eviction LRU, **document store** dengan query dan index, **cincin consistent hashing**, **replikasi quorum**, dan **tabel wide-column**. Tesnya (36) memeriksa setiap perilaku yang dijelaskan pelajaran, termasuk angkanya: index yang memangkas pemindaian dari 10.000 dokumen menjadi 10, modulo hashing yang memindahkan 79,5% key dibanding 19,9% untuk cincin, dan aturan quorum.

### @steps
1. Baca `labs/mod-1-7/nosql_lab.py` dari atas ke bawah. Docstring tiap class adalah spesifikasinya, beserta pelajaran yang menjelaskannya.
2. Kerjakan sesuai urutan file dan jalankan tes setelah SETIAP class:

```bash
pytest labs/mod-1-7/test_lab.py -v
pytest labs/mod-1-7/test_lab.py -v -k TestKeyValueStore       # satu kelompok pada satu waktu
```

3. **Key-value dulu.** Sebelum menjalankan, tebak apa yang dikembalikan `keys()` setelah `set a, set b, get a, set c` dengan `max_items=2`. Lalu tulis class-nya dan periksa.
4. **Dokumen.** Bangun `insert` dan `find` biasa; lalu operator; lalu index. Cetak `last_scanned` sebelum dan sesudah `create_index` dan catat selisihnya.
5. **Cincin dan quorum.** Setelah `HashRing` lulus, ukur sendiri berapa dari 10.000 key yang pindah dengan `zlib.crc32(key) % n` ketika n naik dari 4 ke 5, dan bandingkan dengan cincin Anda. Untuk `ReplicaSet`, isi tabel pasangan (R, W) untuk N = 3 dan tandai mana yang bisa mengembalikan data basi; periksa dengan kode Anda.
6. **Wide-column.** Tebak apa yang dilakukan `query` dengan partition key yang hilang dan mengapa sistem sungguhan menolaknya.
7. **Kerjakan yang sesungguhnya.** Setelah Modul 0.2, tulis kodenya lagi di venv Anda sendiri **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-1-7` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-1-7/nosql_lab.py :: File kerja Anda: implementasikan lima class TODO :: starter
- labs/mod-1-7/test_lab.py :: Ke-36 tes yang memeriksa pekerjaan Anda :: test
- labs/mod-1-7/requirements.txt :: pytest :: config
- labs/mod-1-7/reference/nosql_lab.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 36 tes lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri**
- Anda bisa menjelaskan mengapa `R + W > N` menjamin pembacaan melihat tulisan terbaru, dan menyebut satu pasangan (R, W) untuk N = 3 yang bisa mengembalikan data basi
- Anda bisa menjelaskan mengapa consistent hashing memindahkan jauh lebih sedikit key daripada modulo hashing, memakai angka 19,9% dan 79,5%
- Anda bisa menyebut keluarga mana yang Anda pilih untuk sesi, untuk katalog pesanan dengan atribut bervariasi, dan untuk laju tulis sangat tinggi pembacaan sensor, beserta alasannya

### @verify
```bash
pytest labs/mod-1-7/test_lab.py -v
python3 scripts/prove.py mod-1-7
```

Jalankan yang diketahui benar: awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Partition key yang berupa tanggal
### @scenario
Sebuah tim memindahkan log event dari PostgreSQL ke store wide-column "agar skalanya besar". Tabelnya dirancang sebagai `PRIMARY KEY (event_date, event_id)`: partition key-nya tanggal, event satu hari diurutkan menurut id. Dalam tes, dengan beberapa ribu baris, semuanya cepat. Query-nya persis yang dibutuhkan produk: "semua event pada hari tertentu".

Di produksi, pada hari dengan 20 juta event, masalah dimulai tengah malam. Setiap penulisan hari berjalan masuk ke **satu partisi**, yang tinggal di tiga mesin dari klaster tiga puluh. Ketiga mesin itu mencapai CPU 100%, latensi tulis naik dari milidetik menjadi detik, penulisan mulai timeout dan dicoba ulang, dan percobaan ulang memperburuknya. Dua puluh tujuh mesin lain nyaris menganggur. Menambah mesin tidak mengubah apa-apa. Keesokan paginya, dengan hari yang sudah selesai, partisi lama itu tenang sempurna dan hari baru mengulang masalahnya.

### @cause
Partition key menentukan di mana data tinggal, dan **tanggal adalah key berkardinalitas rendah yang tumbuh sepanjang hari di tempat yang sama**: pada saat mana pun, semua penulisan berbagi satu nilai. Kapasitas klaster hanya jumlah mesinnya jika beban tersebar; dengan satu hot partition kapasitasnya adalah milik tiga mesin. Lab menunjukkan efek yang sama dalam skala kecil: dengan satu posisi virtual per node, cincin menaruh 99,4% key di satu node; dan `WideColumnTable` yang dipartisi menurut konstanta menaruh semua barisnya dalam satu partisi, berapa pun jumlah node.

Query "semua event suatu hari" tampak seperti pola akses, tetapi itu pola **baca**. Pola **tulis** (apa yang ditulis pada saat yang sama) sama pentingnya saat memilih partition key.

### @fix
1. Ganti partition key menjadi sesuatu dengan **kardinalitas tinggi yang menyebar penulisan**: misalnya `(event_date, bucket)` dengan `bucket = hash(event_id) % 64`, atau `(customer_id, event_date)`. Membaca satu hari penuh lalu berarti mengkueri 64 bucket secara paralel dan menggabungkan, pertukaran yang disengaja.
2. Jaga **ukuran partisi tetap terbatas** (partisi tidak boleh tumbuh tanpa batas): masukkan bucket waktu seperti jam ke dalam key.
3. **Uji dengan kemiringan yang realistis**, bukan beberapa ribu baris yang merata: uji beban dengan laju puncak sebenarnya dan lihat beban per partisi dan per node, bukan rata-rata klaster.
4. **Pantau metrik per partisi** (partisi terpanas, permintaan yang di-throttle), bukan hanya CPU rata-rata. DynamoDB dan Cassandra sama-sama menyediakannya.
5. Untuk analitik ("semua event satu hari untuk setiap pelanggan"), jangan pakai tabel ini: alirkan event ke lakehouse (Modul 2.2) dan kueri di sana.

### @pattern
Rancang partition key untuk pola tulis sekaligus pola baca. Kapasitas store terdistribusi hanya sebesar penyebaran bebannya.

## @quiz
### Pada key-value store, apa yang dilakukan TTL?
- [ ] Ia membatasi berapa banyak key yang boleh dimuat store, dan membuang key tertua saat batas tercapai
- [x] Ia membuat key kedaluwarsa otomatis setelah sejumlah detik, sehingga sesi dan cache membersihkan diri
- [ ] Ia menentukan jumlah replika yang harus mengonfirmasi penulisan, agar store tetap bisa konsisten
- [ ] Ia mengurutkan key menurut waktu perubahan terakhir, sehingga query rentang menurut waktu jadi mungkin

> TTL adalah masa kedaluwarsa (time to live). Batas ukuran dengan eviction LRU adalah fitur lain, dan jumlah replika adalah pengaturan replikasi.

### Mengapa index membuat query dokumen jauh lebih cepat?
- [ ] Ia menyalin seluruh collection ke memori agar setiap query bisa berjalan tanpa menyentuh disk sama sekali
- [ ] Ia membuang dokumen duplikat dari collection agar lebih sedikit dokumen yang perlu dibandingkan
- [x] Ia membiarkan database langsung melompat ke dokumen yang cocok, bukan memindai semuanya satu per satu
- [ ] Ia mengubah setiap dokumen menjadi baris tabel, sehingga database bisa memakai join SQL biasa

> Di lab, mencari satu pengguna di antara 10.000 dokumen memindai 10.000 dokumen tanpa index dan 10 dengan index.

### Apa yang dikatakan teorema CAP tentang partisi jaringan?
- [ ] Sistem hanya bisa terpartisi bila memakai database relasional dengan transaksi yang ketat
- [ ] Partisi membuat konsistensi dan ketersediaan sama-sama mustahil, jadi sistem harus dihentikan
- [x] Saat partisi, sistem memilih konsistensi (menolak permintaan) atau ketersediaan (jawaban basi)
- [ ] Sistem selalu bisa menjaga konsistensi dan ketersediaan sekaligus jika menambah replika setiap item

> Partisi tidak bisa dikesampingkan pada sistem terdistribusi, jadi pilihan sesungguhnya adalah C atau A selama partisi. PACELC menambahkan latensi versus konsistensi saat tidak ada partisi.

### Dengan N = 3 replika, pengaturan mana yang menjamin pembacaan melihat tulisan terakhir yang diakui?
- [ ] W = 1 dan R = 1, karena satu replika yang menerima tulisan juga yang melayani pembacaan
- [x] W = 2 dan R = 2, karena R + W lebih besar dari N, jadi setiap himpunan baca beririsan dengan himpunan tulis
- [ ] W = 1 dan R = 2, karena membaca dari lebih banyak replika daripada yang ditulis selalu menemukan nilai terbaru
- [ ] Pengaturan apa pun, asalkan replika berada di pusat data berbeda dan punya jaringan cepat

> Aturannya R + W > N. Dengan W = 1 dan R = 2, himpunan 1 dan 2 dari 3 replika tidak harus beririsan, dan ReplicaSet di lab memperlihatkan pembacaan basi.

### Mengapa consistent hashing lebih disukai daripada `hash(key) % jumlah_node` saat ukuran klaster berubah?
- [ ] Ia membuat fungsi hash sendiri lebih cepat dihitung, sehingga setiap pencarian key lebih murah
- [ ] Ia menjamin setiap node memegang jumlah key yang persis sama, setimpang apa pun datanya
- [x] Menambah atau membuang node hanya memindahkan sebagian kecil key, bukan hampir semuanya
- [ ] Ia menghapus kebutuhan replikasi, karena setiap key otomatis tersimpan di setiap node

> Di lab, naik dari 4 ke 5 node memindahkan 79,5% dari 10.000 key dengan modulo hashing dan 19,9% dengan cincin. Virtual node menjaga keseimbangan.

### Apa arti "pemodelan berbasis query" untuk database wide-column seperti Cassandra?
- [ ] Anda menulis query aplikasi hanya setelah tabel ada, karena database akan menyesuaikan diri dengannya
- [x] Anda mendaftar query lebih dulu dan merancang satu tabel untuk tiap query, mengulang data seperlunya
- [ ] Anda menormalisasi semua data ke bentuk normal ketiga agar query apa pun bisa dijawab dengan join
- [ ] Anda membiarkan database memilih partition key dengan menganalisis query pertama setelah peluncuran

> Store ini menjawab query lewat partition key secara efisien dan tidak bisa join, jadi tabel dibentuk oleh query-nya dan data diduplikasi dengan sengaja.

### Sebuah tabel dipartisi menurut tanggal event, dan hari ini menerima semua penulisan. Apa masalah yang paling mungkin?
- [ ] Klaster kehabisan ruang disk di setiap mesin pada saat yang sama karena format tanggal
- [ ] Query menurut tanggal gagal, karena tanggal tidak bisa menjadi partition key di database semacam itu
- [x] Hot partition: mesin satu partisi kelebihan beban sementara sisa klaster nyaris menganggur
- [ ] Replika tidak sepakat soal tanggal, sehingga pembacaan mengembalikan data hari yang salah ke aplikasi

> Partition key menentukan penempatan, dan tanggal memusatkan semua penulisan terkini di satu tempat. Tambahkan bucket atau pakai key berkardinalitas tinggi.

### Mengapa analitik tidak boleh dijalankan langsung di operational NoSQL store, dan apa yang dilakukan sebagai gantinya?
- [ ] Store NoSQL tidak bisa dibaca lebih dari satu klien sekaligus, jadi datanya diekspor setahun sekali
- [ ] Analitik membutuhkan data terenkripsi penuh, yang tidak pernah diizinkan pada operational store
- [x] Pemindaian besar bersaing dengan pelanggan dan sering timeout, sehingga data disalin ke warehouse
- [ ] Operational store menghapus datanya setiap hari, sehingga analis harus menyalinnya sebelum hilang

> Operational store melayani satu pola akses. Ekstrak secara inkremental dengan change stream atau CDC, ratakan dokumennya, dan kueri salinannya.

## @resources
- [Dokumentasi Redis: tipe data](https://redis.io/docs/latest/develop/data-types/)
- [Manual MongoDB](https://www.mongodb.com/docs/manual/)
- [Dokumentasi Apache Cassandra](https://cassandra.apache.org/doc/latest/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [Neo4j: manual Cypher](https://neo4j.com/docs/cypher-manual/current/)
- [Dynamo: Amazon's Highly Available Key-value Store (makalah)](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html)
