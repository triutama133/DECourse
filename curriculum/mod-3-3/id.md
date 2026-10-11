---
title: Pemrosesan Stream Real-Time: Event Time, Windows, dan Watermarks
duration: 3 minggu
summary: Pahami perbedaan fundamental event time vs processing time, windowing, watermarks, manajemen state dan checkpoints, serta kondisi jaminan exactly-once dalam streaming, melalui pemodelan simulasi watermark di Python murni dan verifikasi langsung terhadap job Spark Structured Streaming nyata.
why: Banyak tutorial pemula menghitung metrik event berdasarkan waktu saat server menerima pesan. Ketika aplikasi seluler pengguna offline selama empat jam lalu mengunggah tumpukan transaksi kemarin secara serentak, pipeline berbasis processing time akan memuntahkan laporan analitik bisnis yang sepenuhnya salah.
---

## @outcomes
- Membedakan konsep event time dari processing time secara presisi dan menjelaskan mengapa kalkulasi berbasis event time menghasilkan metrik analitik yang benar
- Memetakan aliran event ke dalam tumbling windows, sliding (hopping) windows, dan session windows
- Menjelaskan secara akurat kapan hasil agregasi window dipancarkan (emitted), event terlambat (late data) mana yang dihitung atau dibuang, serta trade-off latensi vs kelengkapan data pada watermark
- Menguraikan mekanisme state, checkpoints, perilaku restart pasca-kegagalan, dan prasyarat arsitektural untuk mencapai jaminan hasil exactly-once
- Membangun job Spark Structured Streaming yang membaca data dari Apache Kafka, serta membandingkan arsitektur micro-batch Spark dengan arsitektur record-at-a-time Apache Flink

## @prereq
Modul 3.1 (dasar Apache Spark) dan Modul 3.2 (Kafka, offsets, jaminan at-least-once). Bagian A dari lab praktikum ini menggunakan Python murni tanpa dependensi eksternal; Bagian B membutuhkan runtime Java 17+ serta instalasi dependensi via `pip install -r labs/mod-3-3/requirements.txt`.

## @lesson Event time versus processing time
Setiap event di dalam aliran data streaming memiliki dua stempel waktu (timestamps) yang sangat berbeda artinya:

- **Event Time**: waktu ketika suatu peristiwa fisik nyata benar-benar terjadi di dunia nyata (contoh: pelanggan menekan tombol "Bayar" di aplikasi ponsel pada pukul 10:03:12).
- **Processing Time**: waktu ketika server atau engine streaming Anda pertama kali menerima dan memproses event tersebut (pukul 10:03:15 jika jaringan lancar, atau pukul 14:30 jika ponsel pelanggan sempat offline tanpa sinyal selama empat jam).

Jika Anda mengelompokkan dan mengagregasi data berdasarkan *processing time*, hasil kalkulasi analitik Anda akan terdistorsi oleh fluktuasi latensi jaringan, downtime server upstream, dan backlog antrean. Sebagai contoh: pasca penanganan insiden jaringan, pipeline yang mengejar ketertinggalan data akan memproses data enam jam dalam kurun waktu lima menit, sehingga grafik "transaksi per menit" di dashboard eksekutif akan menampilkan lonjakan vertikal palsu raksasa yang tidak pernah ada di dunia nyata. Aplikasi mobile, perangkat sensor IoT, batch upload mitra eksternal, serta mekanisme auto-retry jaringan pasti menghasilkan data yang tiba **terlambat (late data) dan tidak berurutan (out-of-order)**.

Kalkulasi analitik yang benar wajib menggunakan **event time**: mengelompokkan data berdasarkan kapan transaksi tersebut *benar-benar terjadi*. Namun penggunaan event time memunculkan tantangan baru: karena data masa lalu bisa tiba terlambat kapan saja, **kapan sebuah jendela waktu (time window) dapat dinyatakan benar-benar selesai?** Pada pukul 10:05:00 di dunia nyata, jendela waktu 10:00 hingga 10:05 sudah berakhir di jam dinding, namun event transaksi pukul 10:03 mungkin masih tersangkut di jaringan seluler dan sedang dalam perjalanan. Jika Anda menunggu selamanya, Anda tidak akan pernah memancarkan laporan; jika Anda langsung memancarkan hasil saat jam 10:05:00, angka Anda pasti tidak lengkap. Engine streaming modern menjawab dilema ini menggunakan mekanisme **watermark**, yaitu batas toleransi keterlambatan yang menyeimbangkan antara **latensi** (seberapa cepat laporan dipancarkan) dan **kelengkapan (completeness)** (seberapa banyak data terlambat yang masih ditolerir). Memahami trade-off ini secara presisi adalah inti dari modul ini.

Prinsip penting arsitektur: jika sebuah keputusan bisnis masih dapat menunggu laporan dalam hitungan jam, **pendekatan batch jauh lebih sederhana, murah, dan stabil** (Modul 0.1). Kompleksitas engine stream processing dibenarkan untuk skenario deteksi fraud realtime, dashboard operasional toko langsung, alerting otomatis, serta penyaluran data cepat ke sistem hilir.

## @lesson Windowing (jendela waktu)
Operasi agregasi matematika (seperti `count`, `sum`, `avg`) pada aliran data streaming yang tidak terbatas (unbounded) membutuhkan batasan kelompok waktu yang terhingga, yang diwujudkan dalam bentuk **Window** berbasis event time:

| Tipe Window | Karakteristik Bentuk | Contoh Kasus Penggunaan |
|---|---|---|
| **Tumbling Window** | Ukuran durasi tetap (fixed size), saling berdampingan tanpa tumpang tindih (non-overlapping) | Menghitung total transaksi per blok 5 menit: `[10:00, 10:05)`, `[10:05, 10:10)` |
| **Sliding (Hopping) Window** | Ukuran durasi tetap, saling tumpang tindih (overlapping), bergeser dengan interval slide yang lebih kecil | Rata-rata transaksi 5 menit terakhir, diperbarui setiap 1 menit sekali |
| **Session Window** | Ukuran dinamis: kelompok aktivitas aktif yang dipisahkan oleh jeda waktu ketidakaktifan (inactivity gap) | Sesi interaksi pengguna web: sesi ditutup setelah 30 menit tanpa aktivitas klik baru |

Setiap event tunggal dipetakan ke dalam: tepat **satu** tumbling window, sebanyak `size / slide` jendela **sliding** windows (jendela 5 menit yang bergeser setiap 1 menit memetakan satu event ke dalam 5 window berbeda secara simultan), serta satu **session** window (dua sesi terpisah dapat bergabung/merge jika event terlambat tiba dan menjembatani celah di antara keduanya). Batasan window bersifat setengah terbuka (half-open interval `[start, end)`): batas awal inklusif dan batas akhir eksklusif, sehingga transaksi tepat pada pukul 10:05:00 masuk ke dalam jendela `[10:05, 10:10)`.

Pada Bagian A lab praktikum, Anda akan mengimplementasikan fungsi `window_starts(ts, size, slide)` yang menghitung batas awal setiap window yang memuat timestamp tertentu, dan memvalidasi bahwa konfigurasi tumbling menghasilkan 1 window sementara konfigurasi sliding 300s/60s menghasilkan tepat 5 window. Pada Apache Spark, ekspresi deklaratif ekuivalennya ditulis sebagai `F.window("event_time", "5 minutes")` (tumbling) atau `F.window("event_time", "5 minutes", "1 minute")` (sliding). State agregasi di memori dilacak secara unik berdasarkan kombinasi kunci waktu dan dimensi bisnis: pasangan `(key, window)`.

## @lesson Watermarks: kapan sebuah window dinyatakan selesai?
**Watermark** adalah estimasi engine streaming tentang "seberapa jauh kemajuan event time telah tercapai": sebuah komitmen bahwa **event yang stempel waktunya lebih lama dari watermark diprediksi tidak akan tiba lagi**. Pada Apache Spark Structured Streaming, rumus perhitungannya didefinisikan sebagai:

```text
watermark = (timestamp event paling baru yang pernah terlihat) - (delay batas toleransi)
```

Nilai delay adalah batas toleransi keterlambatan yang Anda tentukan. Dengan konfigurasi `withWatermark("event_time", "2 minutes")`, jika event paling baru yang diterima sejauh ini bertimestamp 10:07, maka posisi watermark berada di 10:05: "Engine streaming memperlakukan seluruh event sebelum 10:05 sebagai data yang pada dasarnya sudah lengkap." Dalam mode append (`OutputMode.Append()`), **sebuah window akan dipancarkan hasilnya dan ditutup saat posisi watermark telah melampaui batas akhir (end time) window tersebut**.

Mekanisme internal ini sangat halus dan kerap disalahpahami, berikut adalah kronologi nyata dari sebuah job Spark (yang direproduksi secara identik oleh model Python pada lab): tumbling window 5 menit, delay watermark 2 menit, satu file data per micro-batch:

| Batch | Daftar Event yang Tiba (event time → value) | Posisi Watermark Awal | Peristiwa yang Terjadi di Engine |
|---|---|---|---|
| 0 | a 10:01 (10), a 10:02 (20), b 10:03 (5) | none (belum ada) | Tidak ada window yang dipancarkan. Nilai max event = 10:03, watermark baru untuk batch berikutnya menjadi **10:01** |
| 1 | a 10:06 (30), b 10:07 (7), a 10:04 (99) | 10:01 | Belum ada window yang dipancarkan (tidak ada window yang berakhir $\le$ 10:01). Max event = 10:07, watermark menjadi **10:05** |
| 2 | a 10:11 (1), **a 10:03 (1000)**, b 10:06 (50) | 10:05 | Event 10:03 berada *di belakang* watermark, namun window induknya `[10:00, 10:05)` masih terbuka di memori, sehingga event ini **tetap dihitung**. Di akhir batch, window `[10:00, 10:05)` resmi **dipancarkan (emitted)**: akun a = count 4, total 1.129; akun b = count 1, total 5. Watermark naik menjadi 10:09 |
| 3 | a 10:16 (2) | 10:09 | Tidak ada window yang dipancarkan (window `[10:05, 10:10)` berakhir di 10:10, di atas 10:09). Watermark naik menjadi 10:14 |
| 4 | a 10:30 (3) | 10:14 | Window `[10:05, 10:10)` resmi dipancarkan: akun a = 1 / 30, akun b = 2 / 57. Watermark naik menjadi 10:28 |
| pasca | (batch kosong pemicu tambahan) | 10:28 | Window `[10:10, 10:15)` dan `[10:15, 10:20)` resmi dipancarkan |

Kaidah operasional yang wajib dipatuhi oleh model streaming Anda:

1. **Watermark dihitung dari data batch sebelumnya.** Event-event pada batch yang sedang berjalan hanya akan memajukan posisi watermark untuk evaluasi *batch berikutnya*.
2. **Window dipancarkan di akhir batch pertama yang posisi watermark awalnya telah mencapai atau melampaui batas akhir window tersebut**, lalu state window tersebut langsung dihapus dari memori.
3. **Data terlambat (late) TIDAK selalu dibuang (dropped).** Event yang timestamp-nya tertinggal di belakang watermark tetap dihitung *selama window penampungnya belum dipancarkan dan belum diev документов*. Hanya event yang seluruh window penampungnya **sudah dipancarkan dan dihapus** yang akan **dibuang (dropped)**.
4. Nilai watermark **pantang bergerak mundur (monotonik naik)**.
5. Eksekusi sebuah **batch kosong tambahan (empty batch)** di akhir proses berfungsi memajukan watermark untuk menutup dan memancarkan window-window terakhir yang menggantung saat aliran data berhenti. (Aliran data yang mendadak sunyi akan menahan window terakhirnya tanpa dipancarkan; untuk stream bervolume rendah, kirimkan sinyal event heartbeat buatan secara berkala).

Pengujian late-event di lab modul ini menunjukkan sisi sebaliknya: setelah window `[10:00, 10:05)` selesai dipancarkan dan dihapus dari memori, sebuah event terlambat bertimestamp 10:02 dengan nominal 5.000 tiba pada batch berikutnya. **Tidak ada window yang dipancarkan dan state lama tidak dibangun ulang: event tersebut dibuang secara diam-diam (dropped).** Event itu lenyap dari seluruh hasil kalkulasi. Itulah harga dari toleransi keterlambatan yang terhingga, dan alasan mengapa Anda wajib **menentukan delay berdasarkan data riil**: ukur distribusi keterlambatan event historis (misalnya persentil ke-99 dari selisih waktu kedatangan dikurangi event time), serta ingat selalu bahwa **semakin besar delay yang Anda pilih, semakin tinggi latensi pemancaran hasil dan semakin membengkak konsumsi RAM state memori Anda**.

**Penanganan Data yang Dibuang (Dropped Data).** Catat jumlahnya sebagai metrik operasional khusus; simpan seluruh aliran *raw event* ke penyimpanan dingin (data lake) secara paralel, sehingga batch job rekonsiliasi harian (Modul 2.3) dapat menghitung ulang angka presisi 100%; atau pada Apache Flink, alirkan data yang terlewat tersebut ke **side output** stream. Pola umum di industri adalah menggabungkan hasil streaming perkiraan cepat (fast approximate) dengan batch reconciliation yang presisi sempurna.

**Mode Output (Output Modes):**
- **Append**: setiap baris hasil agregasi hanya ditulis tepat satu kali saat window resmi final ditutup (membutuhkan watermark untuk windowed aggregation).
- **Update**: hanya menulis baris-baris agregasi yang mengalami perubahan nilai sejak batch terakhir (cocok untuk dashboard yang membutuhkan estimasi awal yang terus direvisi).
- **Complete**: menulis ulang keseluruhan tabel hasil agregasi di setiap batch (hanya aman untuk hasil agregasi berukuran kecil).

## @lesson State, checkpoints, dan jaminan exactly-once
Operasi agregasi berbasis waktu harus **mengingat riwayat data** di antara kedatangan event: seperti subtotal berjalan dan jumlah transaksi untuk setiap window yang masih terbuka. Memori internal ini disebut **State**. Dua implikasi arsitektural krusial:

**State wajib memiliki batas ukuran (bounded state).** State sebuah window hanya akan dihapus dari memori saat posisi watermark telah melampaui batas akhir window tersebut—inilah tujuan utama diciptakannya konsep watermark! Jika Anda menghapus konfigurasi watermark, engine Spark terpaksa mempertahankan seluruh state window di masa lalu selamanya di dalam RAM, karena secara teori event transaksi purba bisa saja tiba sewaktu-waktu. Perbandingan nyata yang diukur pada job lab modul ini setelah memproses 120 micro-batches data:

| Konfigurasi Job | Jumlah Baris State setelah 120 Batches | Ukuran Memori State |
|---|---|---|
| Menggunakan Watermark (delay 10 menit) | ~40 baris (stabil dan datar) | 15 KB |
| Tanpa Watermark | 1.187 baris (tumbuh linier tanpa henti) | 277 KB, dan terus membengkak |

Pada skala produksi nyata (jutaan akun transaksi pelanggan, berjalan berbulan-bulan), konfigurasi tanpa watermark akan berujung pada executor kehabisan memori (JVM OOM crash) atau disk state store penuh hingga job mati permanen (skenario chaos lab modul ini). Untuk state berukuran masif di produksi, gunakan **RocksDB state store provider** (fitur bawaan di Spark 3.2+ dan Apache Flink) yang menyimpan state di disk SSD lokal dan bukan di JVM heap.

**State wajib selamat dari kegagalan mesin (Fault Tolerance).** Job streaming dirancang berjalan tanpa henti selama berminggu-minggu, sementara mesin server di cloud bisa mati sewaktu-waktu. Spark menulis **checkpoint** secara atomik ke storage persisten (seperti HDFS, Amazon S3, atau GCS): mencakup **offset sumber data** yang telah selesai dibaca, **snapshot state internal** dari setiap operator, dan metadata eksekusi. Saat direstart dengan path checkpoint yang sama, job akan melanjutkan pemrosesan tepat dari titik terakhir ia terhenti tanpa kehilangan window state. Pengujian lab mendemonstrasikan dua perilaku:

- Jalankan job, lalu jalankan kembali dengan path checkpoint yang **sama** tanpa adanya data input baru: **tidak ada window yang dipancarkan ulang**.
- Jalankan job dengan direktori checkpoint **baru** yang kosong: job akan membaca ulang seluruh data dari awal dan memancarkan kembali window yang sama. *Progress eksekusi tersimpan di dalam checkpoint, bukan di kode aplikasi.* Menghapus atau salah menunjuk folder checkpoint adalah kecelakaan fatal yang sering terjadi di industri. Perubahan drastis pada logika query (mengubah kunci agregasi) juga dapat membuat checkpoint lama tidak kompatibel.

**Prasyarat Jaminan Hasil Exactly-Once.** Output dari sebuah pipeline streaming hanya akan mencapai efek exactly-once murni jika ketiga rantai arsitektur berikut terpenuhi secara simultan:

1. **Sumber data bersifat replayable** (seperti topic Kafka dengan retensi offset, atau file storage): pasca-kegagalan, engine dapat membaca ulang data yang sama.
2. **Pelacakan progres dan state disimpan secara atomik via checkpoint**: engine dapat pulih ke kondisi konsisten yang terkoordinasi.
3. **Penyimpanan tujuan (Sink) bersifat idempoten atau transaksional**: pengiriman ulang output suatu batch pasca-kegagalan tidak menggandakan data di target. Pada fungsi Spark `foreachBatch`, manfaatkan parameter `batch_id` sebagai idempotency key (misalnya query SQL `MERGE INTO`, atau mencatat riwayat batch ID yang telah selesai); tabel format seperti Apache Iceberg dan Delta Lake menyediakan atomic commit native. Pada Apache Flink, protokol **Two-Phase Commit (2PC)** pada transactional sink (seperti Kafka producer) mengoordinasikan penulisan output secara selaras dengan interval checkpointing.

Tanpa pemenuhan syarat ketiga, Anda hanya memiliki jaminan at-least-once dengan potensi rekaman data duplikat (Modul 3.2). Dengan memadukan ketiganya, Anda memperoleh *efek exactly-once* yang sempurna.

## @lesson Spark Structured Streaming dan Apache Flink
**Apache Spark Structured Streaming** memandang aliran streaming sebagai sebuah tabel yang bertambah terus tanpa batas (unbounded table) dan menggunakan DataFrame dan SQL API deklaratif yang sama persis dengan mode batch. Logika transformasi batch Anda sering kali dapat dipindahkan ke streaming dengan sedikit adaptasi. Di balik layar, engine-nya bekerja dengan paradigma **micro-batch**: mengeksekusi serangkaian mini batch job secara berulang dan cepat terhadap data yang baru tiba. Arsitektur ini memberikan throughput data raksasa, toleransi kesalahan yang tangguh dari engine batch, serta latensi end-to-end berkisar antara hitungan detik hingga sub-detik.

**Apache Flink** adalah engine streaming sejati yang memproses data **baris demi baris (record-at-a-time)** menggunakan serangkaian operator komputasi yang terus aktif di memori, menghasilkan latensi ultra-rendah dalam hitungan milidetik murni. Flink menyediakan **DataStream API** tingkat rendah yang memberikan kontrol penuh atas **keyed state**, **timers** (fungsi pemicu berbasis event-time atau processing-time), **event-time windowing lengkap dengan toleransi keterlambatan (allowed lateness) dan side outputs**, pemrosesan pola kompleks (Complex Event Processing / CEP), serta fitur **Savepoints** (snapshot state portabel yang dapat dipicu manual untuk migrasi versi aplikasi atau perubahan topologi klaster tanpa kehilangan state). Mekanisme fault tolerance Flink menggunakan algoritma **Chandy-Lamport distributed snapshots**: tanda batas checkpoint (checkpoint barriers) mengalir bersama aliran data melewati graf operator untuk mencatat state yang konsisten secara asinkron tanpa menghentikan pemrosesan data.

| Parameter | Spark Structured Streaming | Apache Flink |
|---|---|---|
| Model Pemrosesan | Micro-batch di atas engine batch Spark | Native stream processing (record-by-record) |
| Latensi Tipikal | Hitungan detik (sub-detik dengan continuous processing) | Milidetik murni (sub-10ms) |
| Antarmuka API | DataFrame dan SQL terpadu bersama batch | DataStream API, Table API, dan Flink SQL |
| Penanganan Late Data | Watermark; event di luar batas langsung dibuang | Watermark didukung *allowed lateness* dan *side outputs* |
| Pengelolaan State | State store bawaan (In-Memory atau RocksDB), Checkpoints | Keyed state native, RocksDB backend, Checkpoints, dan Savepoints |
| Keunggulan Utama | Satu engine terpadu untuk batch dan streaming, ekosistem adopsi luas | Latensi ultra-rendah, fleksibilitas kontrol waktu dan state yang sangat kaya |

Pilihlah berdasarkan toleransi latensi bisnis dan kompetensi teknis tim. Untuk mayoritas kebutuhan analitik di mana latensi data "dalam kurun waktu 1 menit" sudah memuaskan dan tim telah menguasai Spark, Structured Streaming adalah pilihan yang sangat pragmatis; sedangkan untuk kebutuhan deteksi kecurangan transaksi finansial berlatensi milidetik atau alur logika berbasis timer yang kompleks, Apache Flink adalah spesialis tak tertandingi. Pustaka *Kafka Streams* menjadi alternatif ringan ketiga jika Anda ingin memproses stream langsung di dalam microservice JVM tanpa perlu mengelola klaster komputasi terpisah.

**Membaca Data dari Apache Kafka menggunakan Structured Streaming:**

```python
schema = StructType([
    StructField("account_id", StringType()),
    StructField("event_time", TimestampType()),
    StructField("amount", DoubleType()),
])

raw = (spark.readStream.format("kafka")
       .option("kafka.bootstrap.servers", "localhost:19092")
       .option("subscribe", "transactions")
       .option("startingOffsets", "earliest")
       .load())                                   # key dan value tiba dalam format biner BINARY

parsed = (raw.select(F.from_json(F.col("value").cast("string"), schema).alias("data"))
             .select("data.*")
             .withWatermark("event_time", "2 minutes"))

windowed = (parsed.groupBy(F.window("event_time", "5 minutes", "1 minute"), "account_id")
                  .agg(F.count("*").alias("tx_count"), F.sum("amount").alias("total_amount")))
```

Dua jebakan klasik yang sering dilakukan pemula: payload kolom `value` dari Kafka tiba dalam bentuk tipe data biner mentah, sehingga wajib di-cast menjadi string terlebih dahulu sebelum diparsing oleh fungsi `from_json`; serta parameter konfigurasi `kafka.bootstrap.servers` wajib didefinisikan. Deklarasi fungsi `F.window` dengan dua argumen durasi secara otomatis membentuk sliding window.

Pola arsitektur streaming lainnya: **Stream-Static Joins** memperkaya data stream dengan tabel dimensi statis (seperti lookup profil customer); **Stream-Stream Joins** mewajibkan deklarasi watermark di kedua belah pihak beserta rentang waktu toleransi batas agar state pasangan join yang belum cocok dapat dibersihkan; **Deduplikasi Realtime** (`dropDuplicatesWithinWatermark`) menghapus event duplikat berbasis ID dengan memanfaatkan watermark sebagai batas retensi state; serta pengaturan **Triggers**: gunakan `processingTime="1 minute"` untuk micro-batch kontinu, atau opsi `availableNow=True` untuk pemrosesan inkremental terjadwal (memproses seluruh data baru yang tersedia lalu mematikan job), pola cerdas untuk meraih efisiensi biaya tanpa perlu menyalakan server klaster 24 jam nonstop.

## @lesson Mengoperasikan sistem streaming di produksi
Job streaming adalah layanan komputasi jangka panjang yang tidak pernah berhenti berjalan, dan memiliki karakteristik kegagalan yang berbeda dari batch pipeline biasa:

- **Pantau Throughput dan Metrik Lag secara Ketat.** Bandingkan tingkat kedatangan data (input rate) terhadap kapasitas laju pemrosesan per batch; jika pemrosesan lebih lambat, consumer lag (Modul 3.2) akan terus melonjak tanpa batas. Pantau durasi per batch, lag sumber data, **watermark delay** (seberapa jauh watermark tertinggal di belakang jam realtime server), serta **pertumbuhan ukuran memori state**.
- **Antisipasi Fenomena Backpressure.** Lonjakan traffic mendadak tidak boleh merusak memori job: batasi kuota pembacaan data per batch (`maxOffsetsPerTrigger` untuk Kafka, `maxFilesPerTrigger` untuk file) serta siapkan kapasitas alokasi resource komputasi untuk menghadapi jam sibuk.
- **Prosedur Restart dan Upgrade Kode.** Pahami apakah perubahan kode Anda kompatibel dengan skema checkpoint yang ada, jaga integritas snapshot savepoint/checkpoint, dan simulasikan prosedur pemulihan restart secara rutin.
- **Strategi Reproses Data (Reprocessing).** Saat terjadi bug logika kode, Anda harus memutar ulang riwayat data: putar mundur offset Kafka ke posisi masa lalu, atau jalankan batch job rekonsiliasi untuk menghitung ulang rentang periode tertentu dari data mentah di lakehouse (Modul 2.2 dan 2.3). Pola yang mempertahankan aliran raw events memungkinkan pipeline streaming bertindak sebagai perkiraan realtime cepat sementara batch job bertindak sebagai koreksi data presisi. (Ini adalah filosofi *Lambda Architecture*. Alternatif modernnya adalah *Kappa Architecture* yang hanya menggunakan streaming engine tunggal dengan memutar ulang log bervolume retensi panjang).
- **Penegakan Kualitas Data Tetap Berlaku** (Modul 2.5): ukur rasio event terlambat (late data rate), jumlah data yang dibuang (dropped events), persentase nilai null, dan anomali duplikasi sebagai metrik observabilitas dengan threshold alert otomatis.
- **Pengujian Deterministik.** Terapkan metodologi pengujian seperti yang dilakukan pada lab modul ini: kendalikan aliran data pengujian menggunakan file dengan timestamp terurut eksplisit, jalankan dalam mode `availableNow`, dan bandingkan outputnya terhadap model matematika independen. Hindari pengujian rapuh yang mengandalkan fungsi jeda waktu `sleep()` jam dinding.
- **Efisiensi Biaya Cloud.** Klaster komputasi yang menyala 24/7 menelan biaya cloud konstan. Jika dashboard bisnis hanya dipantau setiap sepuluh menit sekali, menjalankan job terjadwal dengan trigger `availableNow=True` setiap sepuluh menit bisa jauh lebih murah dibandingkan menjalankan streaming nonstop.

## @lab Lab: memodelkan watermark, lalu memverifikasinya terhadap Spark nyata
Lab ini terdiri dari dua bagian yang saling melengkapi: Bagian A membangun model logika windowing dan watermark dalam Python murni hingga mereproduksi tabel perilaku modul secara presisi. Bagian B membangun job nyata Apache Spark Structured Streaming yang memproses file micro-batch, membuktikan bahwa **hasil emisi window Spark identik 100% dengan prediksi model Anda**, memverifikasi pemulihan dari checkpoint, serta membuktikan pembuangan event yang benar-benar terlambat.

### @steps
1. Instal dependensi dan jalankan pengujian awal (Bagian B membutuhkan Java 17+; pengujian akan dilewati jika Java tidak ditemukan):

```bash
python -m pip install -r labs/mod-3-3/requirements.txt
pytest labs/mod-3-3 -v         # seluruh pengujian akan gagal pada awalnya
```

2. **Bagian A: Model Python Murni.** Buka `labs/mod-3-3/windows.py`. Implementasikan fungsi `window_starts`, kemudian kelas agregator `WindowedAggregator` mengikuti spesifikasi pada docstring. Jalankan pengujian `pytest labs/mod-3-3/test_windows.py -v`. Jadikan tabel kronologi batch pada materi modul sebagai panduan utama; saat ada test yang gagal, petakan posisi watermark dan status open windows pada setiap akhir batch.
3. Cermati secara mendalam tiga skenario pengujian data terlambat: skenario data terlambat yang tetap dihitung (karena window masih terbuka), skenario data terlambat yang dibuang (karena window telah dipancarkan), dan skenario event purba yang tidak boleh membangun ulang window lama.
4. **Bagian B: Job Structured Streaming Nyata.** Buka file `labs/mod-3-3/stream_job.py`. Fungsi pembantu `write_batch_file` telah disediakan (perhatikan bahwa fungsi ini menyetel modification time file secara berurutan agar Spark membacanya dalam urutan kronologis yang konsisten). Implementasikan fungsi `run_available_now` mengikuti panduan pada docstring.
5. Jalankan suite pengujian `pytest labs/mod-3-3/test_stream.py -v` (membutuhkan waktu sekitar 20 detik). Pengujian pertama adalah inti pembuktian modul ini: untuk lima batch data yang sama persis, window yang dipancarkan oleh Spark identik dengan hasil perhitungan model Python Anda.
6. Lakukan eksplorasi mandiri: hilangkan deklarasi `withWatermark` dan amati bagaimana Spark menolak mode penulisan append; ubah nilai watermark delay menjadi 0 dan 10 menit lalu prediksi window apa saja yang akan dipancarkan oleh model sebelum Anda mengeksekusi Spark; cetak metrik `query.recentProgress` untuk mengamati metrik watermark dan jumlah baris state per batch.
7. Eksplorasi opsional: nyalakan broker Kafka lokal (`docker compose up -d redpanda`), publikasikan event JSON menggunakan producer dari Modul 3.2, dan jalankan pipeline Kafka Structured Streaming seperti yang dicontohkan pada materi pelajaran.

### @files
- labs/mod-3-3/windows.py :: File kerja Bagian A: implementasi windowing dan model simulasi watermark :: starter
- labs/mod-3-3/test_windows.py :: Suite pengujian Bagian A (10 pengujian) :: test
- labs/mod-3-3/stream_job.py :: File kerja Bagian B: implementasi job Spark Structured Streaming :: starter
- labs/mod-3-3/test_stream.py :: Suite pengujian Bagian B (5 pengujian; membandingkan Spark dengan model) :: test
- labs/mod-3-3/requirements.txt :: Dependensi pytest dan pyspark :: config
- labs/mod-3-3/reference/windows.py :: Solusi referensi Bagian A (coba kerjakan mandiri terlebih dahulu!) :: reference
- labs/mod-3-3/reference/stream_job.py :: Solusi referensi Bagian B :: reference

### @deliverables
- Bagian A: seluruh 10 pengujian di `test_windows.py` lulus dengan sukses
- Bagian B: seluruh 5 pengujian di `test_stream.py` lulus, termasuk pembuktian "Spark memancarkan hasil yang persis diprediksi oleh model"
- Mampu menjelaskan berdasarkan tabel modul mengapa event bertimestamp 10:03 pada batch 2 tetap dihitung sementara event bertimestamp 10:02 yang tiba belakangan dibuang

### @verify
```bash
pytest labs/mod-3-3/test_windows.py -v
pytest labs/mod-3-3/test_stream.py -v        # membutuhkan runtime Java
```

Verifikasi terhadap kode referensi: tambahkan prefix `LAB_DIR=reference`.

## @chaos Streaming job tanpa watermark yang kehabisan memori
### @scenario
Sebuah pipeline deteksi fraud realtime menghitung akumulasi transaksi per rekening nasabah dalam tumbling window 5 menit dari sebuah topic Apache Kafka. Pipeline ini awalnya dibangun sebagai prototipe cepat dan langsung dinaikkan ke lingkungan produksi tanpa menyertakan konfigurasi watermark. Selama dua minggu pertama, pipeline berjalan stabil tanpa kendala. Namun suatu hari, sebanyak 50.000 mesin terminal pembayaran EDC (IoT) yang sempat terisolasi akibat gangguan jaringan telekomunikasi regional serentak tersambung kembali ke internet dan mengunggah akumulasi data transaksi dua hari terakhir secara bersamaan.

Dalam beberapa jam berikutnya, ukuran state store memori job melonjak drastis dari beberapa ratus megabyte menjadi puluhan gigabyte, durasi eksekusi micro-batch membengkak, para executor JVM dimatikan paksa oleh cluster manager karena melampaui batas alokasi RAM (`OOMKilled`), dan job terjebak dalam siklus restart tanpa henti (crash loop) karena saat menyala ia gagal memuat kembali snapshot state raksasa dari folder checkpoint.

### @cause
Tanpa adanya konfigurasi watermark, engine Spark tidak pernah memiliki dasar acuan untuk mengetahui kapan sebuah jendela waktu dapat dinyatakan selesai dan final. Akibatnya, Spark terpaksa mempertahankan seluruh state window historis yang pernah ada di memori selamanya, karena berasumsi event masa lalu bisa tiba kapan saja. Pada kondisi operasional normal, pertambahan data historis berjalan perlahan sehingga kebocoran memori ini tidak terdeteksi; namun banjir data backlog 2 hari sekaligus secara instan menciptakan puluhan ribu window masa lalu baru untuk setiap nasabah, dan tidak ada satu pun window yang dapat dievakuasi atau dihapus dari memori. Pengukuran lab modul ini membuktikan: job tanpa watermark menumbuhkan state secara linier hingga 1.187 baris dalam 120 batch, berbanding lurus dengan stabilitas 40 baris konstan pada job yang menggunakan watermark.

Faktor pendukung kegagalan: dashboard pemantauan hanya menampilkan metrik throughput pesan per detik dan tidak memantau metrik ukuran memori state store maupun watermark delay, sehingga tim engineer tidak pernah menerima peringatan dini sebelum insiden meledak.

### @fix
1. Tambahkan konfigurasi `withWatermark("event_time", "<delay>")` dengan nilai delay yang ditentukan berdasarkan pengukuran distribusi keterlambatan riil data, sehingga ukuran state memiliki batas atas pasti dan window lama otomatis dipancarkan lalu dihapus dari memori.
2. Tentukan kebijakan penanganan untuk data yang melampaui batas delay: catat jumlahnya sebagai metrik analitik, dan simpan seluruh aliran raw event ke storage data lakehouse agar batch job rekonsiliasi dapat menghitung ulang angka historis secara presisi.
3. Pulihkan job yang sedang terjebak crash loop: karena folder checkpoint lama telah tercemar oleh state bengkak yang korup, jalankan job dari **direktori checkpoint baru** mulai dari offset Kafka yang aman dengan query teroptimasi yang telah diperbaiki.
4. Gunakan provider **RocksDB state store** untuk beban state berukuran besar, serta batasi kuota pembacaan batch (`maxOffsetsPerTrigger`) agar lonjakan traffic tidak melumpuhkan executor.
5. Pasang pemantauan dan alert otomatis pada **metrik ukuran state store, watermark delay, dan durasi micro-batch**, serta lakukan simulasi uji beban backlog data di staging environment sebelum rilis produksi.

### @pattern
Dalam pemrosesan berbasis event time, watermark adalah instrumen mutlak yang membatasi pertumbuhan ukuran state dan mendefinisikan kondisi final data. Sebuah stateful streaming job tanpa watermark pada hakikatnya adalah memory leak terencana yang hanya tinggal menunggu waktu meledak.

## @quiz
### Apa alasan paling mendasar untuk mengagregasi data berdasarkan event time dan bukan processing time?
- [ ] Event time selalu bernilai lebih kecil daripada processing time, sehingga proses agregasi selesai jauh lebih cepat
- [x] Keterlambatan jaringan dan kedatangan data tidak berurutan akan memasukkan event ke dalam window waktu yang salah
- [ ] Processing time tidak dapat dibaca oleh engine streaming, sehingga tidak ada pilihan lain selain event time
- [ ] Event time memungkinkan job untuk melewati pembuatan checkpoint, karena tidak ada state yang perlu disimpan di memori

> Fluktuasi jaringan, pemadaman sistem, dan mekanisme retry membuat waktu kedatangan pesan tidak dapat diandalkan. Mengelompokkan data berdasarkan waktu transaksi nyata menghasilkan kalkulasi analitik yang independen dari gangguan jaringan atau antrean backlog.

### Sebuah window 5 menit bergeser (slide) setiap 1 menit. Ke dalam berapa banyak window sebuah event tunggal akan dipetakan?
- [ ] Tepat satu window, karena sebuah event hanya dapat menjadi bagian dari window yang memiliki timestamp awal yang sama dengannya
- [ ] Dua window, karena window yang dimulai saat event tiba dan window sebelum event tersebut keduanya memuat event yang sama
- [x] Lima window, karena durasi window dibagi interval pergeseran menghasilkan jumlah window yang saling tumpang tindih
- [ ] Enam puluh window, karena terdapat satu window untuk setiap detik di dalam durasi satu menit panjang window

> Dengan ukuran window 300 detik dan interval pergeseran 60 detik, setiap event tunggal dipetakan ke dalam 300 / 60 = 5 jendela window yang saling tumpang tindih secara simultan.

### Dengan konfigurasi delay watermark 2 menit, event paling baru yang diterima sejauh ini bertimestamp 10:07. Apa arti dari posisi watermark tersebut?
- [ ] Bahwa setiap window yang berakhir sebelum 10:09 telah selesai, karena engine menambahkan delay ke waktu terbaru
- [x] Event lebih lama dari 10:05 dianggap tak akan tiba, sehingga window yang berakhir $\le$ 10:05 dapat ditutup
- [ ] Bahwa aliran stream akan dihentikan sementara hingga pukul 10:09 untuk memberi waktu event terlambat tiba
- [ ] Bahwa seluruh event yang memiliki timestamp setelah 10:05 akan dibuang dari hasil akhir perhitungan data

> Posisi Watermark = event time terbaru dikurangi nilai delay toleransi = 10:05. Seluruh window yang berakhir pada atau sebelum 10:05 dapat dipancarkan hasilnya; event yang lebih baru dari watermark tidak akan pernah dibuang.

### Sebuah event dengan event time 10:03 tiba saat posisi watermark berada di 10:05, dan window penampungnya [10:00, 10:05) belum dipancarkan. Apa yang terjadi?
- [ ] Event tersebut langsung dibuang (dropped), karena stempel waktunya lebih lama daripada posisi watermark saat ini
- [ ] Event tersebut membuat window ekstra baru khusus untuk dirinya sendiri agar keterlambatannya dilaporkan terpisah
- [x] Event tersebut tetap dihitung di dalam windownya itu, yang kemudian dipancarkan hasilnya di akhir batch yang sama
- [ ] Keseluruhan job streaming gagal seketika dengan pesan exception error yang melaporkan pelanggaran aturan watermark

> Terlambat bukan berarti langsung dibuang: event yang berada di belakang watermark tetap dihitung selama window penampungnya masih terbuka di memori. Hanya event yang windownya telah resmi dipancarkan dan dihapus yang akan dibuang.

### Mengapa proses agregasi streaming tanpa konfigurasi watermark pada akhirnya pasti kehabisan memori (OOM)?
- [ ] File-file checkpoint dimuat ulang ke dalam memori executor secara terus-menerus pada setiap siklus micro-batch Spark
- [ ] Spark menduplikasi salinan dari setiap rekaman data yang masuk ke memori driver hingga driver kehabisan memori
- [x] State setiap window harus disimpan di memori tanpa batas, karena event baru bisa saja tiba untuk window mana pun
- [ ] Mode penulisan output complete otomatis diaktifkan dan menuliskan keseluruhan isi tabel hasil di setiap siklus

> Watermark adalah mekanisme yang mengizinkan pemancaran dan penghapusan state window lama dari memori. Tanpa watermark, ukuran state tumbuh tanpa batas (pada lab: membengkak ke 1.187 baris dalam 120 batch dibanding 40 baris konstan).

### Anda mengeksekusi ulang job streaming dengan data input yang sama persis namun mengarahkannya ke direktori checkpoint BARU yang kosong. Apa yang terjadi?
- [ ] Tidak ada data yang diproses, karena job mengingat seluruh riwayat input sebelumnya langsung di sistem sumber
- [ ] Job melanjutkan pemrosesan dari offset terakhir, karena progres eksekusi disimpan menyatu dengan data input
- [x] Job memulai eksekusi dari awal dan memancarkan kembali window yang sama, karena progres disimpan di checkpoint
- [ ] Job gagal dengan pesan error, karena direktori checkpoint wajib sudah memiliki file sebelum job dapat dijalankan

> Offset pembacaan dan data state disimpan secara eksklusif di dalam checkpoint. Menggunakan checkpoint baru berarti sistem menganggap belum ada progres sama sekali, sehingga seluruh data diproses dan dipancarkan ulang dari awal.

### Kombinasi arsitektur mana yang wajib dipenuhi untuk mencapai jaminan hasil end-to-end exactly-once pada Spark Streaming?
- [ ] Sumber data yang dapat diputar ulang (replayable) dan delay watermark yang sangat besar agar tidak ada data terlambat
- [x] Sumber data yang replayable, progres dan state via checkpoint, serta target sink yang idempoten atau transaksional
- [ ] Sumber data apa saja dan sink penulisan append biasa, asalkan job dapat direstart dengan cepat saat terjadi kegagalan
- [ ] Penyimpanan checkpoint di disk lokal komputer driver dan pemilihan mode penulisan output yang disetel ke complete

> Sumber data harus dapat dibaca ulang, engine harus mampu memulihkan state konsisten via checkpoint, dan penulisan ulang batch yang sama pasca-crash tidak boleh menggandakan data di target (idempotent writes via batch id, atau atomic table commits).

### Apa perbedaan arsitektural paling mendasar antara Spark Structured Streaming dan Apache Flink?
- [ ] Spark tidak mampu membaca data dari Apache Kafka, sedangkan Flink memiliki server Kafka internal di dalam engine-nya
- [ ] Flink hanya mampu memproses data dalam mode batch, dan Spark adalah satu-satunya engine streaming yang sesungguhnya
- [x] Spark memproses data secara micro-batch dengan latensi detik, sedangkan Flink memproses rekaman satu per satu
- [ ] Spark tidak mendukung jendela waktu berbasis event-time, yang hanya tersedia pada Flink dan Kafka Streams

> Model Spark adalah micro-batch di atas engine komputasi batch (sederhana, throughput tinggi, latensi hitungan detik); Flink memproses data per baris secara native dengan latensi milidetik serta kontrol state dan timer yang sangat kaya. Keduanya mendukung event time dan watermarks.

## @resources
- [Dokumentasi Apache Spark: Structured Streaming](https://spark.apache.org/docs/latest/)
- [Dokumentasi Resmi Apache Flink](https://flink.apache.org/)
- [Dokumentasi Resmi Apache Kafka](https://kafka.apache.org/documentation/)

