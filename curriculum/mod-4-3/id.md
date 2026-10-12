---
title: Capstone: Real-Time Event Streaming, Watermark & Penanganan Late Data
duration: 3 weeks
summary: Bangun mesin pemrosesan streaming real-time yang tangguh terhadap kegagalan pada data telemetri armada kendaraan: baca event kontinu dengan simulasi jitter jaringan seluler, hitung agregasi event time menggunakan tumbling dan sliding window, lacak high watermark monotonik dengan toleransi keterlambatan (allowed lateness), karantina data terlambat (late data) ke Dead-Letter Queue (DLQ), commit consumer offset secara atomik bersama akumulator window in-memory, dan pancarkan metrik secara idempoten ke DuckDB.
why: Dalam rekayasa data produksi modern, data tidak datang dalam file CSV bulanan yang rapi. Data tiba sebagai aliran kontinu dan tidak berurutan dari perangkat seluler, armada terhubung, dan sensor IoT. Desinkronisasi jam, sinyal lemah di terowongan, dan retry jaringan memastikan data tiba tidak berurutan (out of order). Jika pipeline Anda mengelompokkan data berdasarkan processing time (saat server menerima paket), metrik bisnis akan terdistorsi saat koneksi pulih, memicu lonjakan tarif semu dan keputusan operasional yang keliru. Capstone ini menantang Anda membangun mesin streaming event time murni dari nol yang menangani watermark, late data, dan pemulihan crash tanpa duplikasi.
---

## @outcomes
- Membedakan semantik event time, ingestion time, dan processing time di bawah latensi jaringan seluler dan variasi sinyal nyata
- Mengimplementasikan algoritma windowing tumbling dan sliding berbasis event time dengan batas matematis yang presisi
- Melacak high watermark yang monotonik dan menerapkan kebijakan toleransi lateness untuk memproses event stream yang out of order
- Mengisolasi event terlambat yang melanggar batas watermark ke dalam Dead-Letter Queue (DLQ) yang dapat diaudit lengkap dengan metadata diagnostik
- Menjamin checkpointing stream yang tahan crash melalui commit offset atomik dan penyimpanan analitis DuckDB yang idempoten

## @prereq
Modul 0.2 (terminal dan virtual environment), 1.2 (idempotensi, retry, dan operasi atomik), 2.1 (DuckDB dan penyimpanan analitis), 3.2 (Kafka, Redpanda, dan log event), serta 3.3 (Stream processing, windowing, dan watermark). Anda memerlukan Python 3.10+, ruang disk kosong sekitar 1 GB, dan DuckDB terpasang.

## @lesson Cara kerja capstone ini
Setiap lab di modul-modul sebelumnya memberi Anda fungsi bawaan, file pengujian unit yang terstruktur, dan kode kerangka yang terarah. Pada capstone ini, pendekatannya sengaja berbeda: **Anda menerima kontrak arsitektur teknis, data streaming telemetri realistis, dan suite pengujian otomatis yang menguji ketahanan kode Anda secara mendalam.**

Pemeriksa otomatis tidak menilai keindahan gaya penulisan kode Anda; sistem memeriksa **perilaku nyata, kontrak state, dan hasil yang dapat diobservasi**:
- Apakah engine streaming Anda menghasilkan metrik window event time yang akurat (perjalanan, penumpang, total tarif, dan rata-rata tarif) di DuckDB?
- Ketika event tiba tidak berurutan akibat jitter jaringan seluler, apakah event valid tetap dimasukkan ke dalam window terbuka yang sesuai?
- Ketika event yang sangat terlambat tiba setelah batas toleransi window berakhir, apakah data tersebut ditolak dari database dan dialihkan ke Dead-Letter Queue (`dlq/late_events.jsonl`)?
- Ketika proses dihentikan mendadak di tengah pemrosesan stream, apakah engine mampu melanjutkan dari offset terakhir dan memulihkan akumulator window terbuka dengan **nol duplikasi data** dan **nol data hilang**?
- Ketika dikonfigurasi untuk sliding window (`--window-slide 60`), apakah setiap event yang masuk memperbarui seluruh bucket window yang saling tumpang-tindih dengan benar?

Aturan pengerjaan:
1. **Bangun sendiri secara mandiri.** Kerjakan di direktori terisolasi Anda sendiri (misalnya `~/fleet`) di dalam virtual environment. Ruang kerja Anda memuat dua file utama: `stream_processor.py` dan `profile.json`.
2. **Lakukan verifikasi secara bertahap setelah setiap langkah:**
   ```bash
   python3 labs/mod-4-3/check.py ~/fleet --step 1
   python3 labs/mod-4-3/check.py ~/fleet --step 2
   python3 labs/mod-4-3/check.py ~/fleet --step 3
   python3 labs/mod-4-3/check.py ~/fleet --step 4
   python3 labs/mod-4-3/check.py ~/fleet --step 5
   python3 labs/mod-4-3/check.py ~/fleet --step all
   ```
3. **Gunakan petunjuk bertingkat jika mengalami kebuntuan:** Anda dapat meminta `--hint 1` (petunjuk halus), `--hint 2` (penjelasan konseptual), atau `--hint 3` (bocoran teknis mendalam). Usahakan menganalisis masalah sendiri minimal 30 menit sebelum meminta petunjuk.
4. **Pemeriksa akan menyerang ketahanan engine Anda.** Pada langkah 3, 4, dan 5, rangkaian uji coba menginjeksikan event buatan yang terlambat, memutus proses secara mendadak, dan menguji matematika sliding window terhadap tolok ukur kebenaran data.

Langkah persiapan workspace Anda:
```bash
mkdir -p ~/fleet && cd ~/fleet
python3 -m venv venv && source venv/bin/activate
pip install -r labs/mod-4-3/requirements.txt
python3 labs/mod-4-3/fetch_data.py
cp labs/mod-4-3/starter/stream_processor.py ~/fleet/stream_processor.py
```

## @lesson Semantik waktu: Event time, processing time & aliran data tidak berurutan
Dalam pemrosesan batch tradisional, waktu bersifat statis: file memuat data historis kemarin, dan Anda menjalankan kueri SQL atas seluruh snapshot tersebut. Dalam pemrosesan stream, waktu bersifat mengalir dan memiliki banyak dimensi. Terdapat tiga konsep waktu yang fundamental:

```
[Kejadian di Kendaraan Armada] ───> [Gateway Ingestion Jaringan] ───> [Engine Stream Processor]
          Event Time                          Ingestion Time                      Processing Time
     (t = 1704067250 UTC)                  (t = 1704067275 UTC)                 (t = 1704067282 UTC)
```

1. **Event Time:** Saat fisik ketika kejadian nyata berlangsung di lapangan, dicatat oleh jam sensor atau perangkat klien (contohnya saat penumpang menempelkan kartu pembayaran di armada `taxi_12`).
2. **Ingestion Time:** Saat ketika paket data menembus firewall backend dan dicatat ke dalam log terdistribusi (misalnya partisi Kafka atau Redpanda).
3. **Processing Time:** Waktu lokal jam dinding (wall-clock) dari node komputasi yang sedang mengeksekusi kode agregasi window.

### Jebakan Penggunaan Processing Time:
Mengapa kita tidak menyederhanakan arsitektur dengan hanya memakai processing time? Cara tersebut memang tidak membutuhkan watermark, tidak perlu melacak late data, dan bebas buffer memori.
Namun, bayangkan skenario armada kendaraan yang melintasi terowongan bawah tanah kota tanpa sinyal seluler:
- Sepuluh taksi menyelesaikan perjalanan penumpang antara pukul 08:00 dan 08:05.
- Karena berada di terowongan, modem seluler tidak dapat memancarkan paket data.
- Pada pukul 08:15, seluruh armada keluar dari terowongan dan kembali memperoleh sinyal 5G.
- Buffer telemetri lokal langsung mengirimkan 1.000 event secara serentak ke gateway dalam rentang dua detik.

Jika Anda mengelompokkan data berdasarkan **processing time**, pipeline Anda akan mencatat 0 perjalanan pada pukul 08:00-08:05, lalu mencatat lonjakan ekstrem sebesar 1.000 perjalanan pada pukul 08:15-08:16! Algoritma penetapan harga dinamis (surge pricing) akan menyimpulkan terjadi lonjakan permintaan darurat di terowongan pada 08:15 dan menaikkan tarif penumpang berkali-kali lipat, sementara menganggap pukul 08:00 tidak ada aktivitas pelanggan sama sekali.

Hanya **event-time windowing** yang mampu menyajikan kebenaran analitis. Tidak peduli kapan data tiba di server pengolah, event dari 08:02:30 harus secara akurat dimasukkan ke dalam window `[08:00:00, 08:05:00)`.

### Mengenal Dataset Seed:
**Catatan jujur: aliran ini sintetis.** `fetch_data.py` membuatnya dari random seed tetap untuk meniru kendaraan dengan pengiriman tertunda dan tidak berurutan; ini bukan telemetri taksi sungguhan (untuk data nyata, lihat Modul 4.1 dan 4.2). Yang nyata adalah masalahnya: setiap angka di bawah ini diukur pada 1.000 event tersebut.

Dataset seed kita (`labs/mod-4-3/data/events_seed.jsonl`) berisi 1.000 event telemetri armada deterministik dari 50 kendaraan di berbagai zona taksi perkotaan:
```json
{
  "event_id": "evt_0001",
  "vehicle_id": "taxi_29",
  "event_time": 1704067266,
  "zone_id": 186,
  "fare_amount": 28.53,
  "trip_distance": 5.48,
  "passenger_count": 1
}
```
Karena perangkat seluler mengalami fluktuasi latensi jaringan (network jitter), **346 event dalam dataset ini tiba tidak berurutan** (di mana `event_time < previous_event_time`). Engine streaming Anda harus menata keteraturan data ini secara matematis.

## @lesson Watermark, toleransi keterlambatan & mekanisme penggusuran window
Jika kita mengelompokkan data berdasarkan event time, muncul dilema arsitektur kritis: **berapa lama engine streaming harus menunggu sebelum menyatakan sebuah window selesai dan memancarkan hasilnya?**
Jika modem kendaraan baru terhubung kembali tiga hari kemudian, apakah kita harus membiarkan seluruh window masa lalu tetap terbuka di memori? Tentu tidak. Mempertahankan jutaan window terbuka di memori RAM akan memicu crash Out Of Memory (OOM).

Di sinilah konsep **watermark** hadir (pertama kali diformalkan oleh Tyler Akidau dkk. dalam model Google MillWheel dan Apache Beam).

```
Event Stream:  [e1: t=100] ──> [e2: t=250] ──> [e3: t=190] ──> [e4: t=400]
                                                                     │
                                                 Delay = 120s        ▼
                                          Watermark = 400 - 120 = 280
                                          Window dengan end <= 280 DITUTUP!
```

### 1. Definisi Watermark:
Watermark adalah metrik temporal yang monotonik dan tidak pernah mundur, yang mewakili tingkat kelengkapan aliran data. Ketika nilai watermark `W = t`, sistem menyatakan jaminan:
`"Kami memperkirakan tidak ada lagi event dengan event_time <= t yang akan tiba di masa mendatang."`

Dalam engine streaming kita, kita menerapkan **bounded out-of-orderness watermark** dengan jeda toleransi keterlambatan (allowed lateness delay) sebesar `D`:
`W_kandidat = t_event - D`
`W = max(W_sebelumnya, W_kandidat)`

Nilai watermark **tidak boleh bergerak mundur**, bahkan ketika event yang out of order tiba dengan timestamp yang lebih tua dari timestamp terbaru yang pernah dicatat.

### 2. Siklus Hidup dan Penggusuran Window (Eviction):
Sebuah window didefinisikan oleh interval setengah terbuka `[t_start, t_end)`.
- **Window Terbuka:** Selama `t_end > W`, window berstatus terbuka di memori RAM. Setiap event yang berada di rentang waktu tersebut ditambahkan ke akumulator window.
- **Penggusuran / Penutupan Window:** Begitu watermark bergerak maju hingga `t_end <= W`, window dinyatakan ditutup. Hasil agregasi final dipancarkan ke database analitik (DuckDB), dan akumulator di memori dihapus untuk menghemat RAM.

### 3. Out-of-Order vs. Late Data:
Sangat penting membedakan **event yang out of order** dengan **event yang late (terlambat)**:
- **Out-of-order event:** Event yang memiliki `t_event < t_terbaru_dilihat`, namun window tempatnya berada masih berstatus terbuka (`t_end > W`). Event ini **valid dan diterima**; metriknya langsung diakumulasikan ke window yang bersangkutan.
- **Late event:** Event yang window tujuannya sudah ditutup dan digusur dari memori (`t_end <= W`). Agregasi window tersebut sudah terlanjur dipancarkan ke konsumen hilir. Memasukkannya kembali akan merusak keabsahan laporan keuangan yang sudah terbit, sehingga event ini **ditolak dan dikarantina**.
- **Sliding window (keterbatasan yang diketahui):** sebuah event baru dikirim ke dead-letter hanya jika *semua* window-nya sudah tertutup. Jika sebagian tertutup dan sebagian masih terbuka, event memperbarui yang terbuka dan window yang sudah tertutup diam-diam tidak memilikinya. Engine sungguhan menghitung penjatuhan parsial seperti ini dalam sebuah metrik; ingat hal ini saat membandingkan hasil sliding dengan hitung ulang batch.

## @lesson Consumer offset, checkpointing & idempotensi analitik
Engine streaming beroperasi terus-menerus tanpa henti. Gangguan perangkat keras, restart kontainer, dan pembaruan sistem operasi adalah keniscayaan di lingkungan produksi. Engine yang tangguh harus mampu bertahan dari crash dengan semantik **exactly-once processing** di lapisan database.

```
Aliran Data Masuk (JSONL / Kafka)
           │
           ▼
┌───────────────────────┐
│ Stream Processor      │ ──[Simpan Checkpoint]──> offsets.json.tmp ──> [os.replace] ──> offsets.json
│ • Membaca baris N     │
│ • Update akumulator   │
└──────────┬────────────┘
           │
           ▼ [Pancarkan Window via Tabel Staging Sementara]
┌───────────────────────┐
│ DuckDB Warehouse      │ (DELETE WHERE pk IN staging; INSERT SELECT * FROM staging;)
│ PRIMARY KEY:          │
│ (start, end, zone_id) │
└───────────────────────┘
```

### 1. Kontrak Checkpoint (`offsets.json`):
Untuk melanjutkan pemrosesan tanpa harus mengulang pembacaan dari baris pertama, engine mencatat progres konsumsinya ke file checkpoint state:
```json
{
  "last_offset": 200,
  "high_watermark": 1704071400,
  "total_events_processed": 200,
  "total_late_events_dropped": 0,
  "total_windows_emitted": 118,
  "open_windows": {
    "1704071100_1704071400_186": {
      "trips": 4,
      "passengers": 7,
      "total_fare": 112.50
    }
  }
}
```

### 2. Aturan Pelestarian Akumulator In-Flight:
Kesalahan fatal yang sering dilakukan pemula adalah *hanya* menyimpan angka offset (`last_offset: 200`) dan melupakan akumulator window yang sedang berjalan di memori.
Jika proses terhenti saat window 5 menit baru terisi separuh, proses yang dimulai ulang dengan memori kosong akan memecah window tersebut menjadi dua fragmen: perjalanan sebelum crash dipancarkan dengan angka yang belum lengkap, dan perjalanan pasca-crash membentuk window terpisah yang cacat!
Untuk menjamin kontinuitas stream yang sempurna, checkpoint state wajib menyimpan angka offset **sekaligus data akumulator window yang masih terbuka (`open_windows`)**. Saat restart, akumulator terbuka dipulihkan kembali ke memori secara utuh.

### 3. Commit State Atomik via Rename POSIX:
Menulis langsung ke file `offsets.json` sangat berbahaya jika sistem operasi mati mendadak saat operasi tulis berlangsung:
```python
tmp_file = state_path.with_suffix(state_path.suffix + ".tmp")
tmp_file.write_text(json.dumps(state_data, indent=2))
tmp_file.replace(state_path)  # Atomik pada filesystem POSIX via syscall rename(2)
```
Proses lain atau prosedur pemulihan crash akan selalu membaca file JSON lama yang valid atau file JSON baru yang lengkap, tidak akan pernah menemukan file dengan isi terpotong separuh.

### 4. Idempotensi Penyimpanan di DuckDB:
Ketika engine pulih dari kegagalan, sistem biasanya membaca ulang beberapa event dari titik checkpoint terakhir. Jika operasi penulisan database adalah `INSERT` biasa, baris ganda akan merusak metrik analitik.
Kita menegakkan idempotensi di DuckDB menggunakan primary key komposit dan mekanisme staging:
```sql
CREATE TABLE IF NOT EXISTS windowed_metrics (
    window_start TIMESTAMP,
    window_end TIMESTAMP,
    zone_id INTEGER,
    total_trips BIGINT,
    total_passengers BIGINT,
    total_fare DOUBLE,
    avg_fare DOUBLE,
    emitted_at TIMESTAMP,
    PRIMARY KEY (window_start, window_end, zone_id)
);
```
Saat pemancaran window, baris dimasukkan ke tabel sementara, baris lama di tabel utama yang memiliki kecocokan `(window_start, window_end, zone_id)` dihapus, dan metrik terbaru disisipkan secara bersih.

## @lesson Tumbling vs. sliding window dan Dead-Letter Queue (DLQ)
Arsitektur streaming real-time menggunakan beberapa pola windowing bergantung pada kebutuhan analitik bisnis.

```
Tumbling Window (Size = 300s, Slide = 300s): Blok tetap, berdampingan, tanpa tumpang-tindih
[00:00 - 05:00)        [05:00 - 10:00)        [10:00 - 15:00)

Sliding Window (Size = 300s, Slide = 60s): Blok bergerak, saling tumpang-tindih
[00:00 - 05:00)
   [01:00 - 06:00)
      [02:00 - 07:00)
         [03:00 - 08:00)
            [04:00 - 09:00)
```

### 1. Tumbling Window:
Tumbling window mempartisi aliran waktu menjadi blok-blok tetap yang tidak saling tumpang-tindih.
Untuk ukuran window `L`, sebuah event pada timestamp `t` dimasukkan tepat ke **satu** window yang dimulai pada:
`t_start = floor(t / L) * L`
`t_end = t_start + L`
Tumbling window sangat ideal untuk penyelesaian transaksi finansial periodik (misalnya rekonsiliasi pendapatan per jam, rekap komisi harian pengemudi).

### 2. Sliding Window:
Sliding window menghasilkan metrik yang diperhalus secara kontinu seiring berjalannya waktu (misalnya rata-rata kecepatan armada 5 menit terakhir yang diperbarui setiap 60 detik).
Dengan durasi window `L` dan interval pergeseran `S` (di mana `S < L`):
Sebuah event pada timestamp `t` berada di beberapa window tumpang-tindih yang dimulai pada kelipatan bulat `k * S`:
`k * S <= t < k * S + L`
Maka batas indeks bilangan bulat `k` adalah:
`t - L < k * S <= t`, sehingga `(t - L) / S < k <= t / S`
Rentang nilai integer `k` bergerak dari:
`k_min = floor((t - L + S) / S)` hingga `k_max = floor(t / S)`
Untuk `L = 300 detik` dan `S = 60 detik`, setiap event masuk ke tepat `(300 / 60) = 5` window yang saling tumpang-tindih! Logika akumulator Anda harus memperbarui kelima bucket tersebut secara simultan.

### 3. Karantina Dead-Letter Queue (DLQ):
Ketika event tiba di mana seluruh window kandidatnya sudah digusur (`t_end <= W`), apa yang harus dilakukan?
Membuang data secara diam-diam menghilangkan jejak audit keuangan; memasukkannya ke window tertutup merusak integritas laporan analitik yang sudah diterbitkan.
Solusi standar industri adalah **Dead-Letter Queue (DLQ)**. Event yang terlambat dicatat ke dalam `<output-dir>/dlq/late_events.jsonl` beserta metadata audit:
```json
{
  "error_code": "LATE_EVENT",
  "event_id": "evt_0842",
  "event_time": 1704067280,
  "current_watermark": 1704067830,
  "dropped_at": "2024-01-08T12:00:00Z",
  "raw_payload": { ... }
}
```
Tim keandalan sistem (SRE) dapat memantau laju data yang masuk ke DLQ, memicu peringatan jika menara seluler tertentu mengalami keterlambatan paket parah, dan memproses ulang data tersebut di pipeline rekonsiliasi batch offline.

## @lab Lab: lima langkah membangun engine streaming produksi
Bangun file `stream_processor.py` dan `profile.json` di ruang kerja Anda secara bertahap, dan jalankan modul pemeriksa setelah menyelesaikan setiap langkah. Pemeriksa memakai aliran seed (sintetis, lihat pelajaran pertama) dan aliran pendek yang dibuatnya sendiri, lengkap dengan event out-of-order dan terlambat, menguji jitter jaringan, memutus proses secara mendadak, memverifikasi routing DLQ late data, dan memastikan kebenaran kalkulasi sliding window.

### @steps
1. **Persiapan.** Ikuti instruksi persiapan di Lesson 1 (buat direktori `~/fleet`, aktifkan virtual environment, pasang dependensi, jalankan `fetch_data.py`, salin template `starter/stream_processor.py`). Teliti struktur `events_seed.jsonl` menggunakan Python atau DuckDB.
2. **Langkah 1: Profiling data stream.** Lakukan profiling terhadap 1.000 event seed dan tuliskan hasilnya ke `profile.json` dengan 7 kunci utama: `total_stream_events`, `min_event_time`, `max_event_time`, `distinct_vehicles`, `out_of_order_count`, `busiest_zone_id`, dan `busiest_zone_event_count`. Uji dengan opsi `--step 1`.
3. **Langkah 2: Kontrak dasar tumbling event-time window.** Bangun penguraian argumen CLI dan kalkulasi tumbling window (`--window-size 300`, `--watermark-delay 120`). Agregasikan `total_trips`, `total_passengers`, `total_fare`, dan `avg_fare` ke file `<output-dir>/warehouse.duckdb` (tabel `windowed_metrics`). Pastikan eksekusi ulang menghasilkan nol duplikasi data. Uji dengan `--step 2`.
4. **Langkah 3: Perkembangan watermark & DLQ data terlambat.** Lacak high watermark monotonik (`W = max(W, t - delay)`). Gusur window yang telah tertutup ketika `t_end <= W`. Karantina event terlambat yang berada di luar window terbuka ke file `<output-dir>/dlq/late_events.jsonl` dengan kode kesalahan `error_code: "LATE_EVENT"`. Pemeriksa juga memberi aliran di mana event out-of-order akan menurunkan watermark yang ceroboh, dan aliran di mana watermark jatuh tepat di akhir sebuah window (window ditutup ketika `t_end <= W`, sama dengan termasuk). Uji dengan `--step 3`.
5. **Langkah 4: Checkpointing consumer offset & pemulihan crash.** Simpan offset stream dan akumulator window terbuka secara atomik ke `--state-file` (`.tmp` + `os.replace`). Penguji akan menyimulasikan proses mati mendadak setelah 150 event, melanjutkan kembali dengan stream penuh, dan memastikan engine berhasil menyelesaikan tugas tanpa ada data ganda atau hilang. Uji dengan `--step 4`.
6. **Langkah 5: Sliding window.** Tambahkan dukungan untuk argumen `--window-slide` (misalnya ukuran 300 detik dengan pergeseran 60 detik). Salurkan setiap event masuk ke seluruh bucket window tumpang-tindih yang aktif. Buktikan total perjalanan dan tarif teragregasi cocok dengan rasio perkalian teoritis (`(size / slide) * raw`). Uji dengan `--step 5` dan `--step all`.
7. **Bukti kelulusan.** Setelah opsi `--step all` berhasil lolos tanpa kegagalan, jalankan perintah `python3 scripts/prove.py mod-4-3 ~/fleet` untuk memperoleh kode verifikasi yang dapat dimasukkan ke aplikasi kursus.

### @files
- labs/mod-4-3/starter/stream_processor.py :: Template awal: salin ke ruang kerja Anda dan kembangkan engine streaming di sana :: starter
- labs/mod-4-3/check.py :: Skrip pemeriksa otomatis: lima langkah, petunjuk bertingkat, dan pengujian kegagalan sistem :: test
- labs/mod-4-3/fetch_data.py :: Menghasilkan dan memverifikasi integritas hash SHA-256 dataset stream seed :: config
- labs/mod-4-3/requirements.txt :: duckdb, pyarrow :: config

### @deliverables
- Perintah `python3 labs/mod-4-3/check.py ~/fleet --step all` berhasil lulus 100% di komputer Anda di dalam virtual environment
- Anda mampu menjelaskan mengapa processing time memicu lonjakan metrik palsu saat koneksi perangkat seluler mengalami gangguan
- Anda mampu menguraikan bagaimana bounded watermark memfasilitasi data out of order sekaligus membatasi penggunaan memori RAM
- Anda mampu menjelaskan mengapa checkpointing stream wajib menyimpan akumulator in-flight bersamaan dengan nilai consumer offset
- File `NOTES.md` Anda mencatat analisis arsitektur mengenai kompromi antara latensi rendah dan kelengkapan data terlambat

### @verify
```bash
python3 labs/mod-4-3/check.py ~/fleet --step all
python3 scripts/prove.py mod-4-3 ~/fleet
```

## @chaos Lonjakan data pasca-terowongan & distorsi penagihan tarif
### @scenario
Pada pukul 08:30 di hari Senin yang hujan, arus kendaraan komuter memasuki terowongan tol bawah laut sepanjang 3 kilometer. Koneksi jaringan seluler terputus total bagi ribuan kendaraan. Ketika armada keluar dari terowongan 12 menit kemudian, perangkat telematika di dalam kendaraan memancarkan 45.000 event penyelesaian perjalanan GPS yang tertimbun ke klaster Kafka pusat dalam durasi kurang dari lima detik.

Aplikasi streaming lama milik tim data mengelompokkan data berdasarkan **processing time** (menggunakan fungsi `datetime.now()` saat data tiba di server penampung). Hanya dalam lima detik, window processing time 08:42 mencatat 45.000 perjalanan selesai, sedangkan window antara pukul 08:30 hingga 08:41 tercatat kosong melompong dengan 0 perjalanan. Algoritma otomatis membaca terjadi lonjakan permintaan tak terduga, melipatgandakan tarif penumpang sebesar 4,5x dan mengirimkan armada kosong darurat ke mulut terowongan. Di saat bersamaan, laporan pendapatan pengemudi mencatat nol pemasukan selama 12 menit di terowongan, memicu ratusan tiket komplain ke layanan bantuan.

### @cause
Aplikasi lama mencampuradukkan waktu kedatangan paket di jaringan dengan waktu kejadian fisik di lapangan. Karena tidak menggunakan windowing berbasis event time dan tidak melacak watermark, fluktuasi latensi jaringan disalahartikan sebagai perubahan permintaan nyata di dunia fisik.

### @fix
1. **Beralih ke event time murni:** Batas interval window wajib dihitung secara ketat dari timestamp GPS sensor armada (`event_time`).
2. **Terapkan bounded watermark:** Majukan watermark secara monotonik dengan jeda toleransi keterlambatan yang memadai (misalnya 15 menit untuk perjalanan lintas terowongan).
3. **Karantina data yang benar-benar kedaluwarsa:** Jika event baru tiba setelah batas toleransi 15 menit berakhir, tolak event tersebut dari window operasional aktif dan salurkan ke Dead-Letter Queue untuk diaudit di luar alur transaksi utama.

### @pattern
Pisahkan secara mutlak antara event time dan waktu kedatangan jaringan dalam seluruh arsitektur data real-time. Terima data yang out of order selama masih dalam batas toleransi watermark, pertahankan akumulator aktif saat terjadi restart sistem, dan isolasi data yang terlambat ke dalam DLQ tanpa mencemari window analitik produksi yang telah diterbitkan.

## @quiz
### Mengapa pengelompokan telemetri streaming berdasarkan processing time menimbulkan bias analitik yang fatal saat terjadi gangguan sinyal seluler?
- [ ] Processing time membutuhkan akselerasi perangkat keras grafis khusus yang menguras daya baterai perangkat seluler pelacak armada kendaraan
- [x] Lonjakan latensi jaringan memusatkan data tertunda menjadi lonjakan semu dan mengabaikan waktu kejadian fisik sebenarnya di lapangan
- [ ] Processing time memaksa database analitik mengunci seluruh tabel transaksi dan menolak koneksi pembacaan concurrent dari dasbor
- [ ] Format serialisasi JSON secara ketat melarang timestamp yang diproduksi oleh jam sistem operasi internal pada kontainer Linux

> Ketika klien seluler melintasi area tanpa sinyal, perangkat menyimpan data di buffer lokal dan memancarkannya secara serentak begitu sinyal pulih. Jika dihitung berdasarkan processing time, seluruh data tertimbun masuk ke satu window penerimaan yang sama, memicu lonjakan semu dan menggambarkan periode sebelumnya seolah-olah kosong.

### Bagaimana perilaku bounded out-of-orderness watermark ketika menerima event yang memiliki timestamp lebih kecil daripada timestamp tertinggi yang pernah dilihat?
- [ ] Watermark langsung mundur ke belakang mengikuti timestamp yang lebih kecil tersebut dan membuka kembali bucket window yang telah ditutup sebelumnya
- [x] Watermark tidak berubah sama sekali karena nilai watermark bersifat monotonik dan hanya diperbolehkan bergerak maju ke waktu yang lebih baru
- [ ] Processor langsung mengalami crash fatal dan menghapus seluruh riwayat consumer offset yang tersimpan pada klaster broker streaming
- [ ] Watermark menghentikan sementara seluruh pemrosesan pipeline terdistribusi sampai administrator manusia mengonfirmasi status jaringan

> Watermark memberikan jaminan kelengkapan data temporal dan bersifat monotonik murni (tidak pernah bergerak mundur). Ketika event out of order tiba, watermark mempertahankan nilai tertingginya: `W = max(W_sebelumnya, ts - delay)`. Nilainya tidak akan pernah surut.

### Dalam pemrosesan streaming berbasis event time, apa perbedaan mendasar antara out-of-order event dan late event?
- [ ] Out-of-order event berasal dari modem seluler sedangkan late event dihasilkan secara eksklusif oleh sensor IoT berbasis kabel serat optik
- [x] Out-of-order event jatuh ke window terbuka yang batas akhirnya melebihi watermark, sedangkan late event masuk ke window yang sudah ditutup
- [ ] Out-of-order event dialihkan menuju Dead-Letter Queue sedangkan late event langsung dibuang tanpa meninggalkan catatan log audit sama sekali
- [ ] Out-of-order event tidak memiliki primary key yang valid sedangkan late event memiliki nilai nominal transaksi keuangan yang bernilai negatif

> Event berstatus out of order jika tiba setelah event lain dengan timestamp lebih baru, tetapi window tujuannya masih terbuka (`t_end > W`). Event ini berhasil diakumulasikan. Event berstatus late (terlambat) jika window tujuannya sudah ditutup (`t_end <= W`); karena metrik window tersebut sudah terlanjur dipancarkan, data terlambat dikarantina ke DLQ.

### Untuk sliding window dengan durasi 300 detik dan slide step 60 detik, ke dalam berapa window yang tumpang-tindih sebuah event pada timestamp 1704067250 akan dimasukkan?
- [ ] Tepat satu window karena engine streaming selalu membatasi setiap baris data agar hanya berkontribusi pada satu bucket agregasi data
- [x] Tepat lima window yang tumpang-tindih karena panjang durasi window dibagi dengan interval pergeseran menghasilkan lima periode 60 detik
- [ ] Tepat sepuluh window tumpang-tindih karena setiap bucket sliding window mewajibkan pasangan dua arah dengan batas interval di sebelahnya
- [ ] Tepat nol window sampai high watermark bergerak melampaui batas atas seluruh blok partisi analitik per jam pada database target

> Pada sliding window, jumlah window tumpang-tindih yang mencakup suatu timestamp adalah `(durasi / slide)`. Dengan durasi 300 detik dan slide 60 detik, didapat `(300 / 60) = 5`. Event tersebut masuk ke lima window mulai dari `[1704067020, 1704067320)` hingga `[1704067260, 1704067560)`.

### Mengapa stream processor wajib menyimpan akumulator window di memori bersamaan dengan consumer offset ke dalam state.json?
- [ ] Karena storage engine DuckDB membutuhkan file state JSON eksternal untuk merekonstruksi tabel kamus kompresi data berbasis kolom
- [x] Untuk mencegah pemecahan window yang sedang berjalan menjadi fragmen parsial jika processor mengalami crash sebelum window tertutup
- [ ] Karena kernel Linux POSIX secara otomatis mengosongkan seluruh tabel analitik database saat skrip Python berhenti mendadak tanpa izin
- [ ] Untuk mengenkripsi angka consumer offset dengan tanda tangan kriptografi guna mencegah serangan replay data pada jaringan cloud publik

> Jika sistem hanya mencatat angka offset, crash di tengah-tengah window akan menghapus state akumulasi di memori. Saat proses hidup kembali, data sebelum crash tidak dapat digabungkan dengan data setelah crash, menghasilkan window terfragmentasi dengan hitungan parsial. Menyimpan `open_windows` menjamin kontinuitas pemulihan yang mulus.

### Bagaimana analytical warehouse menjamin idempotensi saat stream processor memancarkan ulang metrik window setelah pulih dari crash?
- [ ] Dengan menolak setiap batch baru yang memuat timestamp serupa dengan data yang telah diproses sebelumnya melalui kode respon error
- [x] Dengan menetapkan primary key gabungan pada batas window dan zone ID, menghapus baris lama yang cocok, lalu menyisipkan data terbaru
- [ ] Dengan mematikan seluruh pipeline pemrosesan data secara otomatis begitu ditemukan data dengan identitas zona wilayah yang serupa
- [ ] Dengan menyimpan seluruh metrik ke file log teks tanpa versi dan menyerahkan proses pembersihan duplikasi kepada analis bisnis di dasbor

> Operasi tulis yang idempoten menjamin bahwa pemutaran ulang batch event yang sama akan menghasilkan kondisi database yang identik. Dengan menetapkan primary key komposit pada `(window_start, window_end, zone_id)` dan menjalankan upsert (staging lalu replace atomik), penulisan ulang window akan memperbarui data tanpa menambah baris ganda.

### Mengapa pola pertukaran file atomik (menulis ke .tmp lalu memanggil os.replace) diwajibkan saat menyimpan checkpoint stream ke disk?
- [ ] Karena fungsi penulisan file bawaan Python tidak mampu memproses objek dictionary kompleks yang memuat nilai pecahan desimal presisi tinggi
- [x] Karena menulis langsung ke file target dapat meninggalkan data JSON yang rusak dan terpotong separuh jika proses terhenti di tengah jalan
- [ ] Karena sistem operasi POSIX mewajibkan ekstensi file sementara sebelum mengizinkan hak akses tulis bagi proses aplikasi pengguna biasa
- [ ] Karena penggantian nama secara atomik secara otomatis menyinkronkan isi file ke berbagai server fisik pada klaster terdistribusi cloud

> Jika server kehilangan daya atau sistem operasi mematikan proses di tengah operasi simpan, menulis langsung ke `offsets.json` akan meninggalkan file yang korup dan terpotong separuh, memusnahkan riwayat checkpoint. Menulis ke file `.tmp` lalu memanggil `os.replace` menjamin file selalu dalam kondisi versi lama yang utuh atau versi baru yang lengkap.

### Apa fungsi operasional utama dari Dead-Letter Queue (DLQ) dalam arsitektur real-time event streaming produksi?
- [ ] Menyimpan event prioritas tinggi agar dapat diproses mendahului lalu lintas data reguler saat terjadi lonjakan beban sistem produksi
- [x] Mengarantina event yang kedaluwarsa atau rusak beserta metadata audit sehingga pipeline tetap berjalan tanpa menghilangkan jejak data
- [ ] Berfungsi sebagai lapisan memori cache penampung sementara guna mempercepat kueri analitik SQL pada tabel dimensi yang sering diakses
- [ ] Memperbaiki timestamp yang rusak secara otomatis menggunakan algoritma kecerdasan buatan sebelum dimasukkan kembali ke tabel warehouse

> Dead-Letter Queue memberikan isolasi kegagalan tanpa menghilangkan rekaman data. Jika sebuah event terlambat atau rusak, menghentikan seluruh pipeline akan melumpuhkan operasional data bersih lainnya, sedangkan membuangnya secara diam-diam menghilangkan jejak audit. DLQ mengarantina data bermasalah beserta metadata error untuk investigasi dan pemutaran ulang offline.

## @resources
- [The Dataflow Model: A Practical Approach to Balancing Correctness, Latency, and Cost (Akidau et al., VLDB 2015)](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf)
- [Streaming Systems: What, Where, When, and How of Large-Scale Data Processing (O'Reilly)](https://www.oreilly.com/library/view/streaming-systems/9781491983867/)
- [Apache Flink Documentation: Timely Stream Processing & Watermarks](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time-attribute/)
- [DuckDB Documentation: Window Functions and Upsert Statements](https://duckdb.org/docs/sql/statements/insert#insert-on-conflict)

