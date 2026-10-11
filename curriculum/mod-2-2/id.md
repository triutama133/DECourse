---
title: Format Tabel Terbuka: Apache Iceberg dan Delta Lake
duration: 3 minggu
summary: Pelajari bagaimana format tabel terbuka mengubah folder berisi file Parquet biasa menjadi tabel produksi sejati dengan transaksi ACID, histori snapshot, evolusi skema tanpa rewrite, dan row-level delete, dengan memeriksa langsung pohon metadata Iceberg dan transaction log Delta Lake di disk.
why: Banyak kursus memperlakukan data lake sebatas folder berisi file Parquet. Tanpa format tabel terbuka, Anda akan menghadapi pembacaan data parsial, konflik penulisan konkuren, mustahilnya penghapusan baris GDPR, dan kerusakan skema diam-diam—masalah nyata yang melahirkan teknologi table format.
---

## @outcomes
- Menjelaskan masalah-masalah teknis spesifik pada arsitektur "folder berisi file Parquet" yang diselesaikan oleh format tabel terbuka
- Menggambarkan pohon metadata Apache Iceberg (katalog, file metadata, manifest list, manifest, data files) dan menjelaskan fungsi arsitektur dari setiap lapisannya
- Menjelaskan mekanisme atomic commit, cara optimistic concurrency control menyelesaikan dua proses penulisan bersamaan, dan jaminan snapshot isolation bagi pembaca
- Mempraktikkan time travel, row-level delete, serta evolusi skema dan partisi, dan memahami mengapa perintah delete tidak menghapus data secara fisik seketika
- Membandingkan arsitektur Apache Iceberg dan Delta Lake (pohon metadata versus transaction log) serta menguasai tugas pemeliharaan berkala tabel produksi

## @prereq
Modul 2.1 (Parquet, row group, statistik min/max). Jalankan `pip install -r labs/mod-2-2/requirements.txt` untuk memasang PyIceberg dan delta-rs; tidak memerlukan Docker maupun akun cloud karena lab menggunakan katalog SQLite lokal dan folder disk biasa.

## @lesson Masalah besar di balik folder berisi file Parquet
Modul 2.1 telah memberi Anda format file kolumnar yang sangat efisien. Langkah logis berikutnya adalah membangun sebuah **data lake**: menyimpan ribuan file Parquet di dalam object storage murah (Amazon S3, GCS, MinIO, atau folder lokal) lalu mengeksekusi query di atasnya. Namun di lingkungan produksi nyata, deretan masalah berikut akan langsung muncul:

1. **Ketiadaan Atomic Writes.** Pipeline batch yang menulis 200 file Parquet dapat tiba-tiba mati setelah menulis 120 file. Pembaca (analis/dashboard) kini melihat data yang baru terisi 60%, tanpa ada penanda bahwa proses tersebut gagal. Sebaliknya, pipeline yang berniat mengganti data dengan menghapus file lama lalu menulis file baru menciptakan celah waktu di mana tabel tampak kosong melompong.
2. **Ketiadaan Konsistensi Pembacaan (Consistent View).** Query yang melakukan listing folder lalu mulai membaca file dari disk berisiko membaca sebagian file baru dari proses penulisan yang belum selesai, sehingga data menjadi korup atau tidak sinkron.
3. **Konflik Antara Penulis Konkuren (Conflicting Writers).** Dua pipeline yang menulis data ke folder yang sama secara bersamaan tidak memiliki mekanisme koordinasi. Hasil salah satu proses dapat tertimpa tanpa jejak, atau tabel berakhir dengan jutaan baris duplikat.
4. **Mustahil Melakukan Row-Level Changes.** File Parquet bersifat immutable (tidak dapat dimodifikasi di tempat). Permintaan seperti "hapus data pengguna #4821" (kewajiban hukum regulasi privasi seperti GDPR / UU PDP) atau "perbarui status pesanan ini" memaksa engineer mencari setiap file yang memuat baris tersebut, menulis ulang seluruh file secara manual, dan menukar file di disk tanpa mengganggu query aktif.
5. **Operasi Listing Objek Sangat Lambat.** Cloud object storage melakukan operasi listing file secara lambat (maksimal beberapa ribu objek per detik). Tabel analitik berisi 500.000 file membutuhkan waktu bermenit-menit hanya untuk *mengetahui* file apa saja yang harus dibaca, bahkan sebelum membaca byte pertama.
6. **Perubahan Skema Sangat Rentan Rusak.** Mengubah nama kolom membuat query terhadap file lama gagal; menambah kolom membuat file lama kehilangan nilai tersebut; mengubah tipe data memicu error parsing tergantung urutan file yang dibaca.
7. **Kehilangan Histori dan Time Travel.** Anda tidak dapat memeriksa "seperti apa bentuk data tabel ini kemarin pagi" atau membatalkan (rollback) pemuatan data yang rusak.
8. **Partisi Berbasis Nama Folder** (`month=2026-01/`) memaksa setiap pengguna mengetahui struktur folder fisik; query dengan filter `WHERE order_ts > ...` gagal memanfaatkan folder partisi dan terpaksa memindai seluruh data dari awal (full table scan).

**Format tabel terbuka (Open Table Formats)** menyelesaikan seluruh masalah di atas melalui satu konsep revolusioner: **mendefinisikan tabel bukan sebagai "seluruh file yang berada di folder", melainkan sebagai daftar file eksplisit dan berversi yang dicatat di dalam lapisan metadata, serta memodifikasi tabel dengan mengganti pointer metadata tersebut secara atomik.** File data fisik tetap berupa file Parquet biasa yang immutable; format tabel menambahkan lapisan metadata cerdas di atasnya.

Tiga format tabel terbuka utama di industri saat ini adalah **Apache Iceberg**, **Delta Lake**, dan **Apache Hudi**. Mereka bukan format file penyimpanan (datanya tetap Parquet) dan bukan mesin komputasi: Spark, Trino, Flink, DuckDB, Snowflake, BigQuery, dan alat lainnya dapat membaca dan menulis format ini. Dipadukan dengan mesin query dan katalog metadata, lahirlah arsitektur **Lakehouse**: keandalan transaksi ACID setara data warehouse tradisional di atas media penyimpanan murah data lake.

## @lesson Arsitektur Iceberg: pohon metadata hierarkis
Arsitektur Apache Iceberg dirancang sebagai **pohon file metadata immutable (metadata tree)** dengan satu pointer atomik tunggal di bagian puncaknya:

```text
catalog                 "tabel shop.orders -> file metadata aktif"          (satu pointer atomik)
  └─ metadata.json      skema, spesifikasi partisi, daftar snapshot, snapshot aktif
       └─ manifest list (snap-*.avro)   satu per snapshot: daftar manifest yang membentuk versi tersebut
            └─ manifest (*.avro)        daftar file Parquet data beserta statistik min/max dan partisi
                 └─ data file (*.parquet)
```

Mari kita telaah tabel nyata dari lab praktis setelah menerima dua kali operasi penambahan data (append). File `metadata.json` mencatat skema tabel lengkap dengan **field id numerik**, spesifikasi partisi, dan daftar snapshot:

```json
{ "format-version": 2,
  "location": "file:///.../warehouse/shop/orders",
  "schemas": [{"fields": [{"id": 1, "name": "order_id", "type": "long"}, "...", {"id": 4, "name": "status", "type": "string"}]}],
  "partition-specs": [{"spec-id": 0, "fields": [{"source-id": 3, "transform": "day", "name": "order_day"}]}],
  "snapshots": [
    {"snapshot-id": 450127879888050227, "manifest-list": "snap-4501...avro",
     "summary": {"operation": "append", "added-records": "3", "total-records": "3"}},
    {"snapshot-id": 6372821490839696416, "parent-snapshot-id": 450127879888050227, "manifest-list": "snap-6372...avro",
     "summary": {"operation": "append", "added-records": "2", "total-records": "5"}}],
  "refs": {"main": {"snapshot-id": 6372821490839696416, "type": "branch"}} }
```

Bacalah dari lapisan paling atas. **Katalog (Catalog)** mencatat file metadata versi mana yang sedang aktif saat ini. File metadata tersebut mendaftarkan seluruh **snapshot** (masing-masing mewakili satu kondisi utuh tabel pada titik waktu tertentu); `refs.main` menunjuk ke snapshot aktif terkini. Setiap snapshot merujuk ke satu **manifest list**, yang mendaftarkan sekumpulan file **manifest**; setiap manifest mendaftarkan file-file data Parquet fisik beserta statistik rinci (jumlah rekaman, batas nilai min dan max per kolom, serta nilai partisi file). Daun terbawah dari pohon ini adalah file Parquet fisik.

Mengapa Iceberg membagi metadata ke dalam banyak lapisan hierarki? Jawabannya adalah **skalabilitas dan pruning tingkat tinggi.** Saat merencanakan eksekusi query, mesin pembaca cukup membaca file metadata kecil, lalu membaca manifest list, dan memanfaatkan ringkasan partisi serta statistik min/max di dalam manifest untuk **melewati (skip) seluruh file manifest dan file data sebelum membuka satu pun file Parquet**, sepenuhnya tanpa operasi listing direktori. Itulah rahasia mengapa tabel Iceberg dengan jutaan file data mampu menyusun rencana query hanya dalam satu detik.

Di media penyimpanan disk, struktur folder lab setelah tiga kali operasi penulisan data tampak seperti ini:

```text
warehouse/shop/orders/
  metadata/
    00000-....metadata.json   00001-....metadata.json   00002-....   00003-....    (satu per versi tabel)
    snap-....avro (x3)        ....-m0.avro (x3)                                     (manifest lists, manifests)
  data/
    order_day=2026-01-01/00000-0-....parquet
    order_day=2026-01-02/00000-0-....parquet   00000-0-....parquet
```

Perhatikan bahwa **tidak ada satu pun file yang pernah dimodifikasi di tempat**. Operasi penulisan baru akan menambahkan file data baru, file manifest baru, manifest list baru, dan satu file `metadata.json` baru. Seluruh file versi lama tetap utuh di tempatnya. Karakteristik inilah yang memungkinkan fitur histori masa lalu, time travel, dan pembacaan paralel yang sepenuhnya aman. Iceberg juga mendukung **delete files** (catatan baris yang harus disembunyikan) untuk operasi row-level delete.

## @lesson Mekanisme Commit, transaksi ACID, dan penulis konkuren
Setiap modifikasi pada tabel Iceberg dieksekusi melalui prosedur **commit**: (1) tulis file-file data Parquet yang baru, (2) tulis file manifest baru, manifest list baru, dan file `metadata.json` baru, (3) minta katalog metadata untuk **menukar pointer tabel secara atomik (atomic swap)** dari file metadata lama ke file metadata baru, *namun hanya jika pointer katalog saat itu masih sama dengan versi saat proses dimulai*. Langkah 1 dan 2 tidak terlihat oleh pembaca (hanya file yatim tanpa referensi). Langkah 3 adalah satu operasi atomik tunggal (compare-and-swap di katalog). Hasilnya, pembaca hanya akan melihat versi lama yang utuh atau versi baru yang utuh, tidak pernah separuh versi. Pipeline yang mengalami crash di langkah 1 hanya meninggalkan file tanpa referensi yang tidak berbahaya, bukan tabel yang rusak. Inilah prinsip **Atomisitas (Atomicity)**.

Pendekatan ini menerapkan **Optimistic Concurrency Control (OCC)**: proses penulisan tidak mengambil distributed lock; mereka bekerja dengan asumsi tidak ada pihak lain yang mengubah tabel, dan memverifikasinya di langkah commit. Jika dua pipeline penulisan mulai bekerja dari snapshot yang sama dan pipeline pertama berhasil commit, maka operasi compare-and-swap pipeline kedua akan gagal. Langkah berikutnya bergantung pada apakah kedua perubahan tersebut saling *berkonflik*. Pada pengujian lab, pipeline kedua yang memegang metadata lama mencoba melakukan operasi append setelah pipeline pertama commit; PyIceberg mencatat log `Commit failed due to a concurrent update, retrying` dan **berhasil commit pada percobaan ulang**, karena dua operasi append menulis file-file independen yang tidak saling berbenturan, sehingga pipeline kedua dapat me-refresh metadata acuan dan mengulang komit di atas versi terbaru. Sebaliknya, jika dua pipeline mencoba **menghapus atau menimpa baris yang sama**, atau satu pipeline menimpa partisi yang baru saja ditambahkan oleh pipeline lain, kedua operasi tersebut bertentangan dan commit kedua akan gagal dengan error yang harus ditangani engineer.

Bagi proses pembacaan (reader), jaminan yang diberikan adalah **Snapshot Isolation**: query dimulai dari satu snapshot tertentu dan melihat data yang konsisten dari snapshot tersebut sepanjang masa hidup query, bahkan saat puluhan pipeline penulisan melakukan commit baru. Pembaca tidak pernah memblokir penulis, dan pembaca tidak pernah melihat hasil pemuatan separuh jalan. Sifat **Durability** dijamin oleh ketahanan media cloud storage; **Consistency** ditegakkan oleh skema tabel dan protokol commit.

Panduan implementasi praktis:

- Operasi append dari banyak pipeline paralel berjalan sangat mulus; namun *operasi overwrite bersamaan* memerlukan koordinasi yang cermat. Pola umum di industri: pipeline streaming melakukan append terus-menerus, dan satu job pemeliharaan melakukan pemadatan (compaction); atur konfigurasi pemadatan agar tidak menimpa partisi yang sedang aktif ditulis oleh streaming.
- Katalog metadata adalah koordinator pusat tunggal: katalog wajib mendukung pembaruan pointer secara atomik (misalnya PostgreSQL, layanan REST Catalog, AWS Glue, Nessie, atau Unity Catalog). Katalog juga menjadi tempat penegakan aturan hak akses (**access control**).
- Percobaan ulang komit memiliki batas (PyIceberg melakukan retry beberapa kali dengan backoff). Pipeline produksi Anda wajib memicu alert monitoring jika sebuah commit akhirnya gagal permanen.

## @lesson Time travel, penghapusan baris, dan alasan data tidak langsung musnah
Karena setiap commit menghasilkan snapshot baru dan snapshot lama tetap disimpan, Anda mendapatkan kapabilitas **Time Travel** secara cuma-cuma: membaca kondisi tabel pada snapshot id atau timestamp tertentu di masa lalu. Pada lab praktis, setelah tabel menerima penambahan data berturut-turut sebanyak 3, 2, dan 2 baris, membaca snapshot 0 menghasilkan 3 baris dan membaca snapshot 2 menghasilkan 7 baris. Fitur ini sangat berharga untuk debugging insiden ("seperti apa kondisi data saat dashboard eksekutif rusak tadi malam?"), mereproduksi dataset pelatihan model machine learning, audit regulasi, dan melakukan **rollback instan** jika ada pemuatan batch yang rusak.

Operasi manipulasi baris individual (**Row-Level Changes** seperti `DELETE`, `UPDATE`, `MERGE`) adalah keunggulan utama format tabel dibanding folder Parquet biasa. Format tabel menerapkan dua strategi teknis:

| Strategi | Mekanisme Eksekusi Delete | Biaya Tulis (Write) | Biaya Baca (Read) |
|---|---|---|---|
| **Copy-on-Write (CoW)** | Menulis ulang seluruh file Parquet yang memuat baris yang dihapus, tanpa menyertakan baris tersebut | Sangat tinggi (menulis ulang file utuh) | Nol (file data selalu bersih) |
| **Merge-on-Read (MoR)** | Menulis file kecil berisi daftar penanda baris yang dihapus (**delete file**); pembaca menggabungkannya saat query | Sangat rendah | Sedikit lebih tinggi hingga proses compaction berjalan |

Copy-on-write ideal untuk tabel analitik yang jarang diperbarui namun rutin dibaca dalam volume besar. Merge-on-read ideal untuk pipeline yang menerima pembaruan baris berfrekuensi tinggi (seperti Change Data Capture, Modul 3.2). Di lab praktis, perintah `table.delete(EqualTo("status", "cancelled"))` menghasilkan snapshot baru dengan operasi `delete`; tabel kemudian menampilkan 5 baris aktif, namun **snapshot 2 yang diambil sebelum delete tetap mengembalikan 7 baris**.

Fakta teknis ini melahirkan konsekuensi hukum yang sangat krusial: **Operasi DELETE pada format tabel terbuka hanya menyembunyikan baris dari snapshot aktif; operasi tersebut sama sekali tidak memusnahkan data dari media penyimpanan fisik.** File data Parquet lama yang memuat baris tersebut masih tersimpan di bucket storage dan masih dirujuk oleh snapshot-snapshot lama, sehingga data tersebut masih bisa dibaca melalui query time travel. Untuk koreksi bisnis biasa, ini adalah fitur proteksi data yang luar biasa. Namun untuk **permintaan penghapusan data privasi (GDPR / Hak untuk Dilupakan)**, ini adalah jebakan kepatuhan hukum: data pribadi pengguna sebenarnya masih tersimpan di storage Anda. Untuk menghapusnya secara fisik, Anda wajib **mengusangkan snapshot lama (expire snapshots)** sehingga tidak ada lagi metadata yang merujuk file tersebut, kemudian **menghapus file yatim (remove orphan files)** dari bucket penyimpanan fisik, serta menangani cadangan backup dan tabel turunan. Rancang kebijakan retensi dan penghapusan data secara sadar untuk setiap tabel.

## @lesson Evolusi skema, evolusi partisi, dan hidden partitioning
**Evolusi Skema (Schema Evolution).** Iceberg mengidentifikasi setiap kolom menggunakan **numeric field id** permanen yang tidak pernah berubah, bukan berdasarkan nama teks atau posisi urutan kolom. Field ID ini tercatat di metadata (`{"id": 4, "name": "status"}`) dan di dalam setiap file Parquet data. Konsekuensinya sangat revolusioner dan terbukti pada pengujian lab:

- **Mengubah Nama Kolom (Rename):** hanya file metadata yang diperbarui; ID 4 sekarang bernama `order_status`; file data Parquet lama tetap memegang field ID 4, dan query yang memanggil nama baru tetap membacanya dengan sempurna.
- **Menambah Kolom Baru (Add):** kolom baru (misal ID 6, `channel`) ditambahkan; file data lama yang tidak memiliki field ID 6 otomatis mengembalikan nilai `NULL` saat di-query.
- **Menghapus Kolom (Drop):** ID kolom tersebut dipensiunkan permanen dan tidak akan pernah digunakan kembali, sehingga data pada file lama tidak akan pernah salah dibaca sebagai kolom baru.
- Jumlah file data Parquet sebelum dan sesudah operasi rename plus add terbukti sama persis. **Nol byte data yang ditulis ulang.**

Bandingkan dengan file Parquet biasa yang mencocokkan kolom berdasarkan *nama teks*: mengubah nama kolom membuat file lama tidak terbaca; menghapus kolom lalu menambahkan kolom baru dengan nama sama membuat data lama tertafsir salah. Iceberg juga mendukung perluasan tipe data yang aman (int menjadi long) dan penataan ulang urutan kolom. Perubahan yang secara inheren tidak aman (seperti mempersempit tipe data) akan ditolak secara tegas oleh engine.

**Hidden Partitioning.** Pada format Hive lama, Anda terpaksa membuat kolom tiruan `month`, struktur folder `month=2026-01/`, dan setiap pengguna wajib menyertakan filter `WHERE month = '2026-01'` jika tidak ingin query-nya memindai seluruh data. Iceberg menyimpan **fungsi transformasi partisi (partition transform)** dari kolom yang sudah ada: contohnya transformasi `day(order_ts)` yang dinamai `order_day`. Pengguna cukup menulis filter alami `WHERE order_ts >= '2026-01-10'`; mesin query memahami relasi transformasi tersebut, secara otomatis menerjemahkannya ke nilai partisi yang relevan, dan memangkas file data yang tidak perlu. Tidak ada kolom tiruan tambahan dan pengguna mustahil salah melakukan filter. Transformasi partisi yang didukung mencakup `year`, `month`, `day`, `hour`, `bucket(N, col)` (hashing ke N bucket untuk id berkardinalitas tinggi), dan `truncate(W, col)`.

**Evolusi Partisi (Partition Evolution).** Jika volume data meningkat drastis sehingga partisi bulanan menjadi terlalu besar, Anda dapat mengubah skema partisi (misalnya dari `month` menjadi `day`) **tanpa menulis ulang data historis**. File data lama tetap menggunakan skema partisi lama, file data baru menggunakan skema partisi baru, dan metadata Iceberg mencatat skema partisi mana yang berlaku untuk setiap file, sehingga query optimizer mampu mengeksekusi rencana query melintasi kedua era partisi dengan benar. Pada format direktori konvensional, mengubah skema partisi berarti menulis ulang seluruh isi tabel data lake Anda dari awal.

## @lesson Delta Lake: arsitektur berbasis transaction log
**Delta Lake** mencapai tujuan yang serupa menggunakan arsitektur yang berbeda: buku besar transaksi terurut (**transaction log**) yang terdiri dari kumpulan file commit JSON di dalam folder `_delta_log/` tepat di samping file data Parquet.

```text
delta_orders/
  order_day=2026-01-01/part-....parquet
  order_day=2026-01-02/part-....parquet
  _delta_log/
    00000000000000000000.json      <- versi 0
    00000000000000000001.json      <- versi 1
    00000000000000000002.json      <- versi 2
```

Setiap file commit JSON berisi serangkaian **aksi (actions)**, ditulis satu objek JSON per baris. Struktur nyata dari lab:

```text
version 0: commitInfo, protocol, metaData, add      (pembuatan tabel: skema, versi protokol, file data pertama)
version 1: commitInfo, add                          (append: menambahkan file data baru)
version 3: commitInfo, add, remove                  (delete: menghapus file lama dan menambahkan file hasil penulisan ulang)
```

Status aktif tabel pada saat tertentu adalah **hasil rekonsiliasi pemutaran ulang (replay) seluruh log dari awal**: mulai dari kondisi kosong, terapkan setiap aksi `add` (tambah file) dan `remove` (hapus file) dari setiap commit; kumpulan file yang tersisa adalah daftar file data yang valid saat ini. Agar proses ini tidak melambat seiring bertambahnya transaksi, Delta Lake secara berkala menerbitkan file **checkpoint** (file Parquet yang merangkum status tabel terkini, default tiap 10 commit), sehingga pembaca cukup membaca checkpoint terbaru ditambah beberapa commit sesudahnya. Commit bersifat atomik karena pembuatan file log nomor urut berikutnya menggunakan mekanisme "put if absent": jika dua proses mencoba membuat `...0003.json` bersamaan, hanya satu yang menang dan proses lainnya harus mengulang. Fitur time travel membaca data pada nomor versi log tertentu (di lab, versi 2 berisi 6 baris; operasi delete di versi 3 menyisakan 5 baris, dan versi 2 tetap dapat dibaca utuh).

Perintah **`VACUUM`** adalah operasi pembersihan fisik Delta Lake: menghapus file data di storage yang sudah tidak lagi dirujuk oleh versi tabel dalam rentang batas retensi (default 7 hari). Sebelum perintah `VACUUM` dieksekusi, data yang dihapus tetap dapat dibaca melalui time travel, karakteristik yang serupa dengan Apache Iceberg.

Perbandingan komparatif Apache Iceberg dan Delta Lake:

| Fitur Utama | Apache Iceberg | Delta Lake |
|---|---|---|
| Sumber Kebenaran Tunggal | Pohon file metadata hierarkis + pointer katalog atomik | Buku besar log JSON terurut (ditambah file checkpoint) |
| Mekanisme Atomic Commit | Compare-and-swap pada pointer katalog metadata | Penulisan file log JSON berikutnya secara atomik (put if absent) |
| Identifikasi Kolom Skema | Field ID numerik permanen | Nama kolom secara default (mendukung column mapping) |
| Pendekatan Partisi | Hidden partitioning, evolusi partisi dinamis | Kolom partisi fisik (tersedia fitur liquid clustering) |
| Keunggulan Terbesar | Netralitas terhadap berbagai query engine, hidden partitioning, skala metadata masif | Integrasi native yang sangat dalam dengan Apache Spark dan Databricks, model log sederhana |
| Ekosistem Tipikal | Arsitektur multi-engine (Trino, Flink, DuckDB, Snowflake, Spark) | Platform terpusat Databricks dan Apache Spark |

Kedua format ini kini semakin konvergen, dan berbagai alat perantara telah hadir untuk menghubungkan kedua format tersebut. Panduan praktis memilih: gunakan **Delta Lake** jika ekosistem utama Anda berpusat pada Databricks dan Spark; gunakan **Apache Iceberg** jika Anda memprioritaskan independensi arsitektur bebas vendor di berbagai mesin komputasi (Trino, Flink, DuckDB, Spark). Opsi ketiga adalah **Apache Hudi**, yang sangat kuat untuk pemrosesan inkremental dan upsert berkecepatan tinggi. Prinsip-prinsip inti dalam modul ini (snapshot, atomic commit, field id, pruning, pemeliharaan) berlaku setara untuk ketiganya.

## @lesson Pengoperasian tabel di produksi: pemeliharaan dan katalog
Tabel lakehouse bukanlah sesuatu yang "dibuat lalu ditinggalkan". Setiap commit menambahkan file baru ke storage, dan tanpa perawatan rutin, performa tabel akan mengalami degradasi. Rangkaian tugas pemeliharaan berkala yang wajib dijadwalkan:

- **Pemadatan File (Compaction):** pemuatan data berfrekuensi tinggi (seperti pipeline streaming yang menulis file tiap menit) menciptakan ribuan file mini, yang memperlambat penyusunan rencana query dan pembacaan data (*small files problem* dari Modul 2.1). Job pemeliharaan berkala akan menulis ulang kumpulan file mini tersebut menjadi file Parquet berukuran optimal (128 MB hingga 1 GB) serta mengurutkannya (clustering/Z-order) untuk memaksimalkan skipping data. Di Delta operasi ini bernama `OPTIMIZE`; di Iceberg bernama `rewrite_data_files`.
- **Pengusangan Snapshot (Expire Snapshots):** menghapus referensi snapshot lama yang melampaui batas retensi, sehingga ukuran metadata tetap ramping dan data yang telah dihapus dapat benar-benar dihilangkan secara fisik. Langkah ini menentukan seberapa jauh ke belakang time travel dapat digunakan.
- **Pembersihan File Yatim (Remove Orphan Files):** menghapus file data fisik di bucket yang tidak dirujuk oleh snapshot mana pun (misalnya file sisa dari proses penulisan yang gagal), dengan jeda batas aman agar tidak menghapus file dari commit yang sedang aktif berjalan.
- **Penulisan Ulang Manifest (Rewrite Manifests):** menggabungkan manifest-manifest berukuran kecil agar proses penyusunan rencana query tetap kilat.
- **Monitoring Berkelanjutan:** pantau metrik jumlah file data, rata-rata ukuran file, jumlah snapshot aktif, dan usia snapshot tertua. Pasang alert alarm sebelum tabel melambat, bukan setelah pengguna mengeluh.

**Peran Katalog Metadata.** Katalog memetakan nama tabel ke file metadata aktif terkini dan menjamin operasi pointer swap atomik. Ragam pilihan katalog meliputi: katalog berbasis basis data relasional (seperti SQLite di lab ini; bagus untuk belajar lokal), **Hive Metastore (HMS)**, **AWS Glue Data Catalog**, **REST Catalog** (antarmuka HTTP API standar terbuka yang diimplementasikan oleh Apache Polaris, Project Nessie, Unity Catalog, dan Tabular), serta katalog terkelola cloud. Katalog juga merupakan tempat penegakan tata kelola data (**governance** dan RBAC). Pilihlah katalog yang didukung oleh seluruh mesin query Anda, karena kataloglah yang menentukan mesin mana saja yang dapat mengakses dan berbagi tabel lakehouse Anda.

Praktik perancangan terbaik: buat partisi secara moderat (partisi harian adalah standar paling umum) dan biarkan pengurutan data serta statistik min/max menangani filter beresolusi tinggi; jangan pernah partisi pada kolom ber-kardinalitas tinggi. Lakukan penulisan dalam batch besar. Tetapkan kebijakan batas retensi snapshot dan prosedur penghapusan sejak awal. Rancang jalur penulisan data yang terpusat dan teruji konkurensinya, karena kegagalan data di lapisan lakehouse membutuhkan biaya investigasi yang sangat mahal.

## @lab Lab: membangun tabel lakehouse dan membedah struktur internalnya
Bangun tabel Apache Iceberg produksi, lakukan manipulasi data bertahap, dan buktikan janji-janji arsitektur table format melalui unit test otomatis: verifikasi pembuatan snapshot, pembacaan time travel, operasi delete yang mempertahankan histori, evolusi skema tanpa penulisan ulang data, dan inspeksi langsung struktur file metadata di disk. Kemudian lakukan observasi yang sama terhadap transaction log Delta Lake.

### @steps
1. Pasang dependensi yang diperlukan dan jalankan pengujian awal untuk melihat spesifikasi yang diharapkan:

```bash
python -m pip install -r labs/mod-2-2/requirements.txt
pytest labs/mod-2-2 -v
```

2. Pelajari file `labs/mod-2-2/lakehouse.py`. Fungsi pembantu `make_catalog` telah disediakan: sebuah katalog Iceberg lokal dengan backend SQLite dan direktori warehouse di folder disk lokal. Implementasikan fungsi `create_orders_table`: skema lima kolom dengan field ID numerik eksplisit, serta partisi harian (**day**) pada kolom `order_ts` yang dinamai `order_day`.
3. Implementasikan fungsi `append_batch`, `snapshot_ops`, `count_as_of`, dan `delete_status`. Jalankan pengujian pytest setelah menyelesaikan setiap fungsi. Pembacaan time travel (`count_as_of`) menggunakan pemanggilan `table.scan(snapshot_id=...)`; pengujian delete memastikan bahwa snapshot yang diambil sebelum operasi delete tetap mengembalikan baris yang dihapus.
4. Implementasikan fungsi `evolve` (menambahkan kolom baru `channel`, mengubah nama kolom `status` menjadi `order_status` dalam satu commit atomik). Unit test akan memverifikasi bahwa **tidak ada file data yang ditulis ulang**, baris lama mengembalikan nilai `NULL` untuk kolom `channel`, dan snapshot lama tetap dapat dibaca secara normal.
5. Implementasikan fungsi `layout`: hitung secara langsung di sistem file disk jumlah file metadata `.metadata.json`, file manifest list, file manifest, serta file data Parquet. Buka file metadata `*.metadata.json` terbaru di teks editor Anda dan temukan skema kolom, spesifikasi partisi, daftar snapshot, dan pointer `refs`.
6. Bagian B, Delta Lake: implementasikan fungsi `delta_write_versions`, `delta_rows_at`, `delta_delete`, dan `delta_log_actions`. Buka file log `_delta_log/*.json` di editor dan cocokkan daftar aksi yang Anda kembalikan dengan aksi nyata yang tertulis di file (`protocol`, `metaData`, `add`, `remove`).
7. Eksplorasi mandiri di luar pengujian: buat dua koneksi bersamaan ke tabel yang sama dan lakukan append dari keduanya; amati daftar file data setelah operasi delete; coba masukkan baris baru menggunakan nama kolom lama setelah `evolve` dieksekusi dan pelajari pesan error yang dimunculkan.
8. Opsional, dengan Docker: jalankan tabel yang sama di object storage yang kompatibel dengan S3. Jalankan `docker compose up -d s3 s3-init`, lalu buat katalog dengan `SqlCatalog("s3", uri="sqlite:///catalog.db", warehouse="s3://warehouse/", **{"s3.endpoint": "http://localhost:8333", "s3.access-key-id": "dataforge", "s3.secret-access-key": "dataforge-secret", "s3.path-style-access": "true", "s3.region": "us-east-1"})`. Lakukan append satu batch, baca kembali, lalu tampilkan daftar objek di bucket (`curl "http://localhost:8333/warehouse?list-type=2"`) dan cocokkan dengan hasil hitungan `layout` Anda. (Diperiksa manual: create, append, dan read berfungsi pada stack ini.)

### @files
- labs/mod-2-2/lakehouse.py :: File kerja utama Anda: fungsi Iceberg dan Delta Lake yang wajib diimplementasikan :: starter
- labs/mod-2-2/test_lab.py :: Rangkaian 12 pengujian otomatis validasi arsitektur lakehouse :: test
- labs/mod-2-2/requirements.txt :: Dependensi pyiceberg (dengan sqlite, pyarrow, pyiceberg-core), deltalake, pytest :: config
- labs/mod-2-2/reference/lakehouse.py :: Solusi referensi lengkap (coba kerjakan sendiri dulu!) :: reference

### @deliverables
- Seluruh 12 unit test di `test_lab.py` berhasil lolos (PASS)
- Anda dapat membuktikan dengan menunjukkan file-file nyata di disk, file mana saja yang diciptakan oleh operasi `append` dan file mana yang dibiarkan utuh
- Anda mampu menjelaskan dalam dua kalimat mengapa menghapus data satu pengguna belum membuat data tersebut benar-benar hilang dari media penyimpanan

### @verify
```bash
pytest labs/mod-2-2 -v
```

Jalankan pengujian terhadap solusi referensi pembanding: `LAB_DIR=reference pytest labs/mod-2-2 -v`. Catatan: penulisan data ke tabel Iceberg dengan partisi harian membutuhkan modul C binding `pyiceberg-core`; file requirements sudah menyertakannya.

## @chaos Permintaan penghapusan data privasi yang ternyata tidak benar-benar terhapus
### @scenario
Seorang pelanggan menggunakan hak privasi hukumnya dan meminta KopiKu untuk menghapus seluruh data pribadinya. Tim data menjalankan perintah SQL row-level `DELETE` pada tabel Iceberg `orders` untuk customer id pelanggan tersebut, dan memverifikasi bahwa query `SELECT ... WHERE customer_id = 4242` kini mengembalikan hasil kosong. Tim data mengonfirmasi ke tim legal bahwa data pelanggan telah berhasil dimusnahkan.

Enam minggu kemudian, auditor regulasi perlindungan data yang diberikan akses baca menjalankan query time travel terhadap snapshot bulan sebelumnya, dan berhasil menarik riwayat pesanan lengkap milik pelanggan tersebut beserta nama dan alamat pengirimannya langsung dari bucket data lake.

### @cause
Operasi delete hanya menghasilkan *snapshot baru* di mana baris pelanggan disembunyikan dari query aktif. Snapshot-snapshot sebelumnya, beserta file-file data Parquet fisik yang memuat baris tersebut, sama sekali tidak tersentuh di bucket storage karena Iceberg tidak pernah memodifikasi file di tempat. Fitur time travel (dan siapa pun yang memiliki akses baca langsung ke storage bucket) masih dapat mengakses data tersebut secara utuh. Tim data tidak pernah menjadwalkan prosedur pengusangan snapshot (snapshot expiry), sehingga histori lama tersimpan tanpa batas waktu; proses pembersihan file yatim tidak pernah dijalankan; dan salinan data masih tersisa di tabel mart hilir serta file backup.

Tidak ada bug teknis di sini: inilah cara kerja resmi format tabel dalam melindungi histori data. Kesalahan fatalnya adalah menganggap "query menghasilkan data kosong" sama dengan "data telah musnah secara fisik dari disk".

### @fix
1. Eksekusi prosedur **pengusangan snapshot (expire snapshots)** yang melampaui batas jendela retensi, lalu jalankan perintah **pembersihan file yatim (remove orphan files)**, sehingga tidak ada lagi metadata yang merujuk file data lama dan storage provider dapat menghapus file fisik tersebut.
2. Tetapkan **kebijakan retensi formal per tabel** (misalnya, usangkan snapshot otomatis setelah 7 hari) yang durasinya lebih pendek daripada batas waktu hukum penyelesaian permohonan penghapusan data.
3. Lacak alur penghapusan data secara menyeluruh (end-to-end): tabel turunan di hilir, ekstrak data mart, search index, cache, dan cadangan backup wajib memiliki prosedur penghapusan tersinkronisasi. Pertimbangkan teknik **crypto-shredding** (menghapus kunci enkripsi data pengguna) untuk kasus data yang sangat sensitif.
4. Batasi akses izin baca langsung ke raw object storage bucket dan batasi hak eksekusi query time travel ke snapshot usang, serta verifikasi penghapusan fisik melalui pengujian audit nyata (jalankan query time travel dan listing file storage setelah proses pemeliharaan selesai).
5. Rancang arsitektur model data di mana data identitas pribadi (PII) dipisahkan dari tabel fakta transaksi (misalnya di tabel dimensi identitas kecil terpisah) sehingga proses penghapusan data privasi hanya menyentuh sedikit file.

### @pattern
Pada format tabel terbuka, operasi delete hanya menyembunyikan data, sedangkan operasi pemeliharaanlah yang memusnahkannya secara fisik. Jadikan prosedur pengusangan snapshot dan pembersihan file yatim sebagai bagian mutlak dari setiap alur penghapusan data privasi, dan selalu verifikasi hasilnya.

## @quiz
### Apa konsep inti mendasar yang sama-sama diterapkan oleh Apache Iceberg, Delta Lake, dan Apache Hudi?
- [ ] Menyimpan data ke dalam format file biner baru pengganti Parquet yang lebih cepat dibaca
- [x] Mendefinisikan tabel sebagai daftar file berversi di metadata, yang diubah secara atomik
- [ ] Memindahkan seluruh data ke server database terkelola yang memasang lock pada setiap query
- [ ] Mengompresi seluruh isi folder menjadi satu file arsip tunggal yang wajib diunduh utuh oleh mesin query

> File data fisik tetap berupa Parquet biasa. Yang ditambahkan oleh open table format adalah lapisan metadata terstruktur yang mencatat secara presisi file mana saja yang membentuk setiap versi tabel, dan operasi commit menukar pointer metadata tersebut secara atomik.

### Pada pohon metadata Apache Iceberg, manakah urutan hierarki yang benar dari puncak teratas ke bawah?
- [ ] Data file, manifest, manifest list, metadata file, lalu entri katalog tabel
- [ ] Manifest list, entri katalog, data file, metadata file, lalu manifest partisi
- [x] Entri katalog, lalu metadata file, lalu manifest list, lalu manifest, lalu data file
- [ ] Metadata file, data file, entri katalog, manifest, lalu manifest list setiap snapshot

> Katalog menunjuk ke file metadata aktif, file metadata mendaftarkan seluruh snapshot; setiap snapshot menunjuk ke manifest list, manifest list menunjuk ke manifest, dan manifest mendaftarkan file data Parquet beserta statistiknya.

### Dua pipeline memuat data ke tabel Iceberg yang sama. Pipeline B mulai bekerja dari snapshot lama dan mencoba commit operasi append setelah pipeline A berhasil commit. Skenario apa yang paling mungkin terjadi?
- [ ] Data pipeline A tertimpa tanpa peringatan karena proses penulisan terakhir selalu menggantikan isi tabel
- [ ] Tabel terkunci bagi pipeline B hingga pipeline A selesai, lalu kedua data digabung oleh katalog
- [x] Compare-and-swap gagal, pipeline B me-refresh metadata dan mengulang commit, lalu append berhasil
- [ ] Struktur tabel menjadi rusak sehingga kedua pipeline harus diulang dari awal setelah restore backup

> Komit bersifat optimistik: penukaran pointer hanya berhasil jika snapshot acuan belum berubah. Karena dua operasi append independen tidak saling berbenturan data, klien me-refresh metadata dan mengulang komit di atas versi terbaru; konflik baru memicu error jika terjadi penimpaan data yang sama.

### Anda mengubah nama kolom `status` menjadi `order_status` pada tabel Apache Iceberg. Apa yang terjadi pada file-file data Parquet yang sudah ada di disk?
- [ ] File-file tersebut ditulis ulang di latar belakang dengan nama kolom baru, yang memakan waktu berjam-jam untuk tabel besar
- [ ] File-file lama menjadi rusak dan tidak bisa dibaca sehingga data lama harus dimuat ulang dari sistem sumber
- [x] File-file tersebut sama sekali tidak tersentuh, karena kolom dilacak berdasarkan field ID dan hanya metadata yang berubah
- [ ] File-file tersebut mempertahankan nama lama sehingga query terhadap data lama wajib memanggil nama lama

> Iceberg melacak setiap kolom menggunakan field ID numerik permanen yang tercatat di metadata dan di dalam file data. Mengubah nama kolom hanya memperbarui label nama untuk field ID tersebut di file metadata, tanpa menulis ulang data Parquet.

### Manfaat apa yang diberikan oleh hidden partitioning bagi pengguna query dibanding format partisi direktori konvensional gaya Hive?
- [ ] Mengenkripsi nilai partisi agar analis bisnis tidak dapat melihat pembagian data di storage
- [x] Filter pada kolom asli (seperti order_ts) memangkas file tanpa memerlukan kolom partisi khusus
- [ ] Menghilangkan kebutuhan partisi karena mesin query membaca seluruh file secara paralel
- [ ] Menyimpan setiap partisi di katalog yang berbeda agar tabel dapat diskalakan ke lebih banyak pengguna

> Tabel menyimpan fungsi transformasi dari kolom nyata (misalnya day dari order_ts). Klausa filter pada kolom asli secara otomatis diterjemahkan oleh engine menjadi nilai partisi yang relevan, sehingga pengguna tidak mungkin melewatkan optimasi pruning.

### Setelah menjalankan `DELETE FROM orders WHERE customer_id = 4242`, query time travel ke snapshot minggu lalu masih menampilkan baris pelanggan tersebut. Mengapa, dan bagaimana cara memusnahkan data tersebut secara fisik?
- [ ] Operasi delete gagal secara diam-diam sehingga Anda harus menjalankannya ulang dengan level isolasi lebih tinggi
- [ ] Katalog metadata mengalami caching oleh engine sehingga Anda harus me-restart cluster untuk melihat perubahannya
- [x] Snapshot lama masih merujuk file lama, jadi Anda harus mengusangkan snapshot dan membersihkan file yatim
- [ ] Fitur time travel selalu mengabaikan operasi delete karena selalu membaca file sumber awal pemuatan

> Operasi delete menghasilkan snapshot baru yang menyembunyikan baris; delete tidak pernah mengedit file Parquet di tempat. Sebelum snapshot lama diusangkan (expired) dan file fisik yang tidak lagi dirujuk dibersihkan, data tersebut tetap tersimpan dan dapat diakses.

### Bagaimana cara Delta Lake menentukan kondisi aktif terkini dari sebuah tabel?
- [ ] Melakukan listing seluruh file di folder dan membaca file-file terbaru yang baru saja dibuat
- [ ] Bertanya ke server basis data eksternal file mana saja yang menjadi bagian dari tabel saat ini
- [x] Memutar ulang aksi add dan remove di `_delta_log`, dimulai dari checkpoint terbaru yang valid
- [ ] Membaca satu file manifest tunggal yang ditulis ulang secara utuh setiap kali ada commit baru

> Buku besar transaksi Delta Lake adalah daftar commit JSON terurut. Menerapkan aksi add dan remove menghasilkan daftar file data yang valid saat ini; file checkpoint mencegah pemutaran ulang dari versi 0.

### Sebuah pipeline streaming melakukan operasi append ke tabel setiap 1 menit selama tiga bulan, dan query analitik perlahan menjadi sangat lambat. Apa penyebab paling mungkin dan solusi standarnya?
- [ ] Tabel memiliki partisi yang terlalu sedikit sehingga Anda harus mempartisinya berdasarkan customer id
- [x] Ada ribuan file kecil dan snapshot berlebih, sehingga compaction dan snapshot expiry perlu dijadwalkan
- [ ] File Parquet melambat seiring bertambahnya usia sehingga data harus dikonversi ke CSV sebelum dibaca
- [ ] Ruang penyimpanan katalog metadata mulai habis sehingga tabel harus dipindahkan ke server katalog yang lebih besar

> Commit kecil yang berfrekuensi tinggi menciptakan ribuan file data mini dan file manifest kecil yang memperlambat perencanaan query dan proses pemindaian. Pemadatan berkala (compaction), pengusangan snapshot, dan penulisan ulang manifest memulihkan performa tabel.

## @resources
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
- [Apache Iceberg table spec](https://iceberg.apache.org/spec/)
- [PyIceberg documentation](https://py.iceberg.apache.org/)
- [Delta Lake documentation](https://docs.delta.io/latest/)
- [delta-rs (Python deltalake) documentation](https://delta-io.github.io/delta-rs/)

