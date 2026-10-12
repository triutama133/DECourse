---
title: Capstone: Ingesti API Inkremental Berdaya Tahan Tinggi & Checkpointing
duration: 3 minggu
summary: Bangun pipeline ingesti inkremental kelas produksi dengan data ilmiah nyata: ekstrak data seismik berhalaman dari USGS Earthquake Hazards API, negosiasikan rate limit (HTTP 429) dan gangguan transient (5xx) dengan exponential backoff dan jitter, isolasi payload beracun ke Dead-Letter Queue (DLQ), lakukan upsert ke DuckDB dengan deduplikasi CDC, dan jamin ketahanan crash melalui checkpointing atomik.
why: Di dunia kerja data engineering nyata, data jarang sekali tiba dalam berkas CSV bulanan yang rapi. Sebaliknya, Anda mengekstrak data terus-menerus dari REST API pihak ketiga yang membatasi panggilan, mengalami crash sewaktu-waktu, mengembalikan payload rusak, dan merevisi data masa lalu. Capstone ini menyingkirkan roda bantu: Anda harus membangun mesin ingesti yang bertahan dari crash di tengah jalan, menjamin nol rekaman ganda, tidak pernah kehilangan state, dan mengisolasi rekaman rusak tanpa mematikan seluruh alur kerja.
---

## @outcomes
- Mengambil data dari REST API berhalaman secara andal menggunakan watermarking berbasis kursor dan kontrak paginasi defensif
- Menerapkan ketahanan jaringan produksi menggunakan exponential backoff, jitter, dan negosiasi header HTTP 429 `Retry-After`
- Menjamin ketahanan crash transaksional menggunakan pola atomic file swap dan state checkpointing
- Mengisolasi rekaman rusak dan cacat ke dalam Dead-Letter Queue (DLQ) yang dapat diaudit lengkap dengan kode kesalahan dan payload mentah
- Melakukan Change Data Capture (CDC) upsert dan backfill historis ke DuckDB tanpa merusak watermark inkremental di produksi

## @prereq
Modul 0.2 (terminal dan virtual environment), 1.2 (idempotensi, retry, dan operasi atomik), 1.6 (ingesti API, paginasi, dan watermark), serta 2.1 (DuckDB dan Parquet). Anda memerlukan Python 3.10+, ruang disk kosong sekitar 1 GB, dan instalasi DuckDB.

## @lesson Cara kerja capstone ini
Setiap lab pada modul-modul sebelumnya memberi Anda fungsi-fungsi yang telah ditentukan rangkanya, berkas pengujian otomatis, dan petunjuk langkah demi langkah. Capstone ini sengaja dirancang berbeda: **Anda menerima kontrak teknis, data publik nyata, dan sebuah suite pemeriksa otomatis yang menyerang pipeline Anda.**

Tidak ada yang menilai keindahan penulisan kode Anda. Suite pemeriksa hanya menilai **perilaku dan hasil yang dapat diamati secara objektif**:
- Apakah pipeline Anda menghasilkan skema yang tepat di DuckDB dengan tipe data geografis yang akurat?
- Saat server hulu memutus soket TCP di tengah proses sinkronisasi, apakah pipeline Anda dapat melanjutkan kerja pada eksekusi berikutnya dengan **nol baris duplikat** dan **nol data yang hilang**?
- Saat API mengembalikan HTTP 429 (Too Many Requests), apakah pipeline Anda mundur secara teratur mengikuti header `Retry-After` dari server?
- Saat server hulu mengirimkan koordinat terbalik atau JSON rusak, apakah pipeline tetap memproses data bersih sembari menulis rekaman bermasalah ke Dead-Letter Queue (DLQ)?
- Saat Anda menjalankan backfill historis untuk data tahun lalu, apakah high-watermark produksi tetap terjaga secara ketat tanpa tergeser mundur?

Aturan main capstone:
1. **Kerjakan sendiri.** Bekerjalah di folder terisolasi Anda sendiri (misalnya `~/seismic`) di dalam virtual environment Anda. Workspace Anda memuat dua berkas yang Anda bangun: `pipeline.py` dan `profile.json`.
2. **Periksa secara bertahap setelah setiap langkah:**
   ```bash
   python3 labs/mod-4-2/check.py ~/seismic --step 1
   python3 labs/mod-4-2/check.py ~/seismic --step 2
   python3 labs/mod-4-2/check.py ~/seismic --step 3
   python3 labs/mod-4-2/check.py ~/seismic --step 4
   python3 labs/mod-4-2/check.py ~/seismic --step 5
   python3 labs/mod-4-2/check.py ~/seismic --step all
   ```
3. **Gunakan petunjuk bertingkat jika buntu:** Anda dapat meminta `--hint 1` (dorongan kecil), `--hint 2` (penjelasan konsep), atau `--hint 3` (bocoran teknis detail). Usahakan menganalisis masalah minimal 30 menit sebelum meminta bantuan petunjuk.
4. **Pemeriksa menyerang pipeline Anda.** Pada langkah 3, 4, dan 5, sistem pengujian menjalankan server HTTP lokal yang menyuntikkan pemutusan koneksi soket mendadak, rate limit HTTP 429, pemadaman server 503, payload beracun, dan pembaruan rekaman CDC. Sistem produksi di dunia nyata menghadapi hal-hal ini setiap minggunya.

Siapkan workspace Anda:
```bash
mkdir -p ~/seismic && cd ~/seismic
python3 -m venv venv && source venv/bin/activate
pip install -r labs/mod-4-2/requirements.txt
python3 labs/mod-4-2/fetch_data.py
cp labs/mod-4-2/starter/pipeline.py ~/seismic/pipeline.py
```

## @lesson Mengenal datanya: USGS Earthquake Hazards API
**United States Geological Survey (USGS)** mengoperasikan Earthquake Hazards Program yang menyediakan data seismik gempa bumi global secara terbuka (public domain). Endpoint API publik mereka mengembalikan feed berformat GeoJSON:
`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson`

Kita menggunakan data gempa global bermagnitudo 2,5 atau lebih dari minggu pertama Januari 2024 (513 rekaman), termasuk gempa bumi berkekuatan dahsyat magnitudo 7,5 di Semenanjung Noto, Jepang (`us6000m0xl`).

```
GeoJSON Feature Collection
├── metadata: { generated, count, title, status }
└── features: [ Array of Feature Objects ]
    ├── type: "Feature"
    ├── id: "us6000m0xl"            <-- Pengidentifikasi unik kejadian
    ├── properties:
    │   ├── mag: 7.5                <-- Magnitudo (Double, bisa null)
    │   ├── place: "2024 Noto..."   <-- Deskripsi wilayah
    │   ├── time: 1704067395140     <-- Waktu kejadian dalam epoch ms (UTC)
    │   ├── updated: 1708819584040  <-- Waktu revisi dalam epoch ms (UTC)
    │   ├── status: "reviewed"      <-- "automatic" vs "reviewed"
    │   ├── tsunami: 1              <-- 1 jika ada peringatan tsunami, 0 jika tidak
    │   ├── sig: 2470               <-- Tingkat signifikansi
    │   └── type: "earthquake"
    └── geometry:
        ├── type: "Point"
        └── coordinates: [lon, lat, depth_km]  <-- JEBAKAN UTAMA!
```

### Jebakan Data Ilmiah di Dunia Nyata:
1. **Urutan Koordinat yang Terbalik:** Dalam bahasa lisan, orang biasa menyebut "Latitude, Longitude" (Lintang, Bujur). Namun dalam standar formal GeoJSON (RFC 7946), koordinat selalu diurutkan sebagai `[longitude, latitude, elevation/depth]`.
   - `coordinates[0]` adalah **Longitude / Bujur** (rentang valid: -180,0 sampai 180,0)
   - `coordinates[1]` adalah **Latitude / Lintang** (rentang valid: -90,0 sampai 90,0)
   - `coordinates[2]` adalah **Kedalaman (depth) dalam kilometer**
   Jika Anda memetakan `lat = coords[0]`, gempa bumi dengan bujur di luar +/-90 derajat (seperti Jepang atau Indonesia, kira-kira 95 sampai 145 derajat Bujur Timur) akan langsung menggagalkan validasi rentang lintang Anda!
2. **SCD Type 1 & Waktu Revisi (`updated`):** Data kegempaan berevolusi seiring waktu. Ketika getaran terdeteksi, stasiun seismik otomatis membuat rekaman awal (`status: "automatic"`). Beberapa jam kemudian, ahli geofisika mengoreksi episentrum dan magnitudo, lalu memperbarui status menjadi `status: "reviewed"` dengan nilai timestamp `updated > time`. Pipeline yang watermark-nya hanya mengikuti `time` kejadian tidak akan pernah melihat revisi ini. **Lacak watermark pada `updated`** (waktu perubahan terakhir) dan minta ke API hanya yang berubah dengan `updatedafter`; lakukan upsert berdasarkan id event.
3. **Nilai Null dan Pengukuran Negatif:** Gempa mikro atau ledakan tambang dapat memiliki magnitudo null atau bernilai negatif (skala logaritmik Richter memperbolehkan angka di bawah 0). Kedalaman dapat bernilai 0 atau negatif (gempa di pegunungan di atas permukaan laut). Skema Anda harus menerima float nullable tanpa mengalami error.
4. **Strategi Paginasi (Offset vs Keyset Watermark):** REST API umumnya menawarkan paginasi offset (`limit` dan `offset`). Walau mudah dipahami, paginasi murni offset mengalami pemindaian O(N) pada offset dalam dan dapat bergeser jika ada data baru masuk bersamaan. Dalam arsitektur data modern, kita menggabungkan watermark pada waktu `updated` (filter `updatedafter`) dengan offset halaman di dalam satu sesi sinkronisasi untuk menjamin eksekusi yang cepat dan idempoten. Filter tetap konstan selama offset bergerak.
5. **Menjaga Kamus Data Domain:** API ilmiah memuat kode spesifik domain seperti `magType` (`ml` skala Richter lokal, `mw` magnitudo momen, `md` durasi). Jangan pernah membuang atribut domain ini saat ekstraksi; analis bergantung pada tipe magnitudo untuk memvalidasi akurasi kalibrasi sensor fisik.

## @lesson Ketahanan jaringan: Backoff, Jitter & Rate Limits
Dalam sistem terdistribusi, jaringan pada dasarnya tidak pernah dapat dipercaya 100% (*Fallacies of Distributed Computing #1: Jaringan selalu andal*). Pipeline data produksi wajib bertahan dari gangguan jaringan tanpa perlu bantuan manusia.

```
Request ───────> [Server API]
                   │
                   ├──> HTTP 429 (Too Many Requests) ──> Baca header `Retry-After` ──> Sleep & Retry
                   ├──> HTTP 500 / 503 (Server Error)  ──> Exponential Backoff + Jitter ──> Sleep & Retry
                   └──> HTTP 400 (Bad Request)         ──> Fatal Non-retryable Error    ──> Exit code 2
```

### 1. HTTP 429 Too Many Requests & `Retry-After`:
Ketika API membatasi panggilan Anda, server REST standar mengembalikan status HTTP 429 disertai header `Retry-After` yang menyatakan berapa detik klien harus berhenti sejenak:
```python
if response.status_code == 429:
    retry_after = response.headers.get("Retry-After")
    delay = float(retry_after) if retry_after else base_backoff
    time.sleep(delay)
```

### 2. Exponential Backoff dengan Jitter:
Untuk kesalahan sementara di sisi server (HTTP 500, 502, 503, 504) atau batas waktu koneksi, melakukan retry seketika (*masalah thundering herd*) justru akan merobohkan server yang sedang pulih. Sebaliknya, naikkan waktu tunggu secara eksponensial:
```text
wait = base * 2 ** attempt + jitter        (attempt = 0, 1, 2, ...; dengan base = 1 detik: sekitar 1, 2, 4, 8 detik)
```
Jitter adalah penambahan nilai acak kecil (sekitar plus minus 10%) agar ribuan worker ekstraksi tidak menembak server secara bersamaan pada detik yang sama persis.

### 3. Kesalahan Fatal Klien yang Tidak Boleh Di-retry (HTTP 4xx):
Tidak semua error boleh di-retry. Jika server mengembalikan `HTTP 400 Bad Request`, `401 Unauthorized`, atau `404 Not Found`, mengulang 5 kali hanya akan menghasilkan kegagalan 5 kali dan membuang waktu. Kesalahan fatal klien harus mencatat pesan diagnostik yang jelas dan segera keluar dengan exit code `2` tanpa merusak state checkpoint.

### 4. Batas Waktu Soket dan Higienitas Koneksi:
Kesalahan umum pemula adalah mengeksekusi panggilan HTTP tanpa menyertakan batas waktu eksplisit (misalnya `urllib.request.urlopen(url)`). Jika middlebox jaringan memutus paket diam-diam, thread dapat menggantung selamanya tanpa batas, mengunci cron job dan menghentikan pipeline. Selalu terapkan timeout eksplisit (misalnya 15-30 detik). Selain itu, gunakan context manager Python (`with ... as resp:`) guna menjamin soket ditutup seketika dan mencegah kebocoran file descriptor pada pemrosesan batch bervolume tinggi.

## @lesson Checkpointing stateful & penyimpanan tahan crash
Pipeline inkremental didefinisikan oleh kemampuannya mengekstrak **hanya data baru sejak eksekusi terakhir**, serta melanjutkan proses secara aman setelah proses dihentikan paksa.

```
State Checkpoint (state.json):
{
  "high_watermark_epoch_ms": 1704367849415,       <-- nilai properties.updated terbesar yang sudah DI-COMMIT
  "high_watermark_iso": "2024-01-04T11:30:49Z",
  "last_sync_utc": "2024-01-08T00:00:00Z",
  "total_records_ingested": 450,
  "total_dlq_records": 5
}
```

### Jebakan Penulisan Checkpoint:
Pertimbangkan skenario fatal berikut:
1. Ekstraktor mengunduh data Halaman 3.
2. Ekstraktor menulis watermark baru ke `state.json`.
3. Aliran listrik mati atau OOM-killer mematikan proses sebelum data ditulis ke basis data.
4. Saat dijalankan kembali, ekstraktor membaca `state.json`, mengira Halaman 3 sudah tuntas, dan melompatinya! **Data hilang permanen.**

Atau kebalikannya:
1. Ekstraktor menulis sebagian data ke tabel.
2. Sistem crash sebelum `state.json` sempat diperbarui.
3. Saat dijalankan kembali, ekstraktor membaca `state.json` lama, mengambil ulang Halaman 3, dan menyisipkannya begitu saja. **Data duplikat merusak metrik.**

### Solusi Desain yang Tepat:
1. **Tulis data ke penyimpanan analitis terlebih dahulu.**
2. **Perbarui nilai watermark di memori hanya setelah penulisan data berhasil.**
3. **Tulis berkas `state.json` melalui pola atomic rename:**
   ```python
   tmp_file = state_path.with_suffix(".tmp")
   tmp_file.write_text(json.dumps(state_data))
   os.replace(tmp_file, state_path)  # Operasi atomik pada filesystem POSIX
   ```
4. **Penulisan Idempoten di Tujuan (Upsert):** Saat pulih dari crash, pipeline pasti akan memproses kembali sebagian rekaman yang sudah sempat tersimpan. Tabel tujuan wajib menggunakan operasi `UPSERT` atau query deduplikasi berdasarkan `event_id` dengan mempertahankan baris yang memiliki nilai `updated_epoch_ms` terbesar.
5. **Semantik Rename POSIX:** Di Linux dan sistem operasi turunan POSIX, fungsi `os.replace` memetakan langsung ke pemanggilan sistem `rename(2)`. Jika berkas `state.json` sudah ada sebelumnya, berkas tersebut diganti secara atomik dalam satu siklus filesystem tunggal. Klien pembaca yang berjalan bersamaan akan selalu membaca versi JSON valid sebelumnya atau versi JSON valid terbaru, tidak pernah membaca potongan buffer yang rusak setengah jadi.

## @lesson Dead-Letter Queue (DLQ) & Backfill Historis
Di lingkungan produksi, skema data hulu dapat berubah dan sensor di lapangan dapat rusak. Jika 1 rekaman dari 10.000 memuat `latitude = 999.0` atau kehilangan ID, apa yang harus dilakukan pipeline Anda?
- **Opsi A (Batalkan seluruh batch):** Seluruh pipeline mati. Dashboard operasional tidak diperbarui selama 48 jam sampai ada engineer yang memperbaikinya. (Tidak dapat diterima).
- **Opsi B (Buang baris rusak diam-diam):** Data hilang tanpa jejak audit. Saat auditor menanyakan hilangnya rekaman penting, tidak ada bukti yang tertinggal. (Sangat berbahaya).
- **Opsi C (Dead-Letter Queue - DLQ):** Pipeline memvalidasi setiap rekaman masuk terhadap kontrak skema yang ketat. Rekaman valid disimpan ke warehouse; rekaman rusak diisolasi ke Dead-Letter Queue (`dlq/rejected.jsonl`) beserta metadata audit:
  ```json
  {
    "error_code": "INVALID_COORDINATES",
    "reason": "Latitude 125.0 out of range [-90, 90]",
    "failed_at": "2024-01-08T12:00:00Z",
    "raw_payload": { ... }
  }
  ```
  Pipeline terus berjalan memproses data bersih tanpa gangguan, sementara tim reliability engineer dapat memantau jumlah rekaman DLQ dan memeriksa berkas karantina.

### Backfill Historis & Rekonsiliasi Data:
Seringkali tim hulu memperbaiki kalibrasi sensor masa lalu dan meminta: *"Tolong ambil ulang seluruh data untuk bulan Desember 2023."*
Pipeline Anda menyediakan subperintah `backfill`:
```bash
python pipeline.py backfill --api-url URL --output-dir OUT --state-file OUT/state.json --start 2023-12-01 --end 2023-12-31
```
**Aturan Emas Backfill:** Perintah backfill harus memuat data historis ke dalam warehouse menggunakan aturan upsert yang sama, **TETAPI SAMA SEKALI TIDAK BOLEH MENGUBAH ATAU MENGGESER WATERMARK DI `state.json`!** Jika proses backfill Desember 2023 mengubah `state.json`, eksekusi terjadwal berikutnya akan mengira watermark saat ini berada di bulan Desember 2023 dan menyedot ulang seluruh data berbulan-bulan secara mubazir.

Terakhir, selalu terapkan perhitungan **rekonsiliasi** yang ketat: di akhir setiap sesi sinkronisasi, verifikasi hukum invariansi `total_records_fetched == valid_records_persisted + dlq_records_quarantined`. Jika penjumlahan angka ini tidak cocok, berarti ada baris data yang bocor diam-diam di memori tanpa jejak audit.

## @lab Lab: lima tahapan membangun pipeline yang dapat diandalkan
Bangun `pipeline.py` dan `profile.json` di workspace Anda sendiri, langkah demi langkah, menggunakan alat pemeriksa setelah setiap tahap. Pemeriksa menjalankan pipeline Anda pada data nyata USGS, menyimulasikan pemutusan koneksi, memicu throttle HTTP 429, menyuntikkan data beracun, dan menguji isolasi backfill.

### @steps
1. **Setup.** Ikuti petunjuk setup di Lesson 1 (buat folder `~/seismic`, aktifkan venv, instal requirements, jalankan `fetch_data.py`, salin `starter/pipeline.py`). Periksa berkas `earthquakes_seed.json` dengan Python atau DuckDB.
2. **Langkah 1: Profiling data mentah.** Analisis dataset mentah dan buat `profile.json` dengan 9 nilai kunci: `total_features`, `max_magnitude`, `min_magnitude`, `tsunami_alert_count`, `max_depth_km`, `min_depth_km`, `min_time_epoch_ms`, `max_time_epoch_ms`, dan `noto_peninsula_event_id`. Periksa dengan `--step 1`.
3. **Langkah 2: Kontrak ingesti baseline.** Implementasikan subperintah `pipeline.py ingest` dengan argumen CLI (`--api-url`, `--output-dir`, `--state-file`, `--batch-size`). Lakukan paginasi (`limit` dan `offset` berbasis 1), ekstrak koordinat dengan benar (`lon = coords[0]`, `lat = coords[1]`, `depth = coords[2]`), simpan data bersih ke `<output-dir>/warehouse.duckdb` dalam tabel `events` dengan minimal kolom `event_id` (primary key), `time_utc`, `updated_epoch_ms`, `latitude`, `longitude`, `depth_km`, `magnitude`, dan `status`, lalu simpan `state.json`. Periksa dengan `--step 2`.
4. **Langkah 3: Watermarking stateful & pemulihan crash.** Catat timestamp `updated` terbesar yang sudah di-commit sebagai `high_watermark_epoch_ms`, dan pada eksekusi berikutnya kirim `updatedafter` (waktu ISO-8601 UTC, misalnya `2024-01-04T11:30:49.415`) agar hanya event baru atau yang direvisi yang kembali; mengurangi satu detik sebagai tumpang tindih aman karena upsert Anda idempoten. Gunakan penulisan file sementara atomik (`.tmp` + `os.replace`) untuk `state.json`. Pemeriksa menyimulasikan pemutusan soket di tengah jalan, memastikan checkpoint tidak pernah mendahului data, mengunci warehouse agar penulisan gagal dan checkpoint tidak boleh bergerak, serta memverifikasi bahwa eksekusi lanjutan menghasilkan nol duplikat dan nol data hilang. Periksa dengan `--step 3`.
5. **Langkah 4: Ketahanan jaringan.** Tambahkan mekanisme retry dengan exponential backoff untuk error 5xx. Periksa header HTTP 429 `Retry-After` dan tunggu setidaknya selama itu (pemeriksa mengukur jeda antar permintaan). Keluar dengan kode `2`, tanpa retry, jika terjadi error fatal 4xx. Periksa dengan `--step 4`.
6. **Langkah 5: DLQ, CDC upsert & backfill.** Validasi koordinat, timestamp, dan ID. Arahkan rekaman rusak ke `<output-dir>/dlq/rejected.jsonl`. Lakukan upsert rekaman hasil revisi di DuckDB tanpa membuat baris ganda. Implementasikan subperintah `backfill` (`--api-url --output-dir --state-file --start --end --batch-size`); ia menerima `--state-file` hanya agar pemeriksa dapat membuktikan Anda tidak pernah menulisnya, dan revisi yang lebih lama dari sebuah event tidak boleh menimpa yang lebih baru. Periksa dengan `--step 5` dan `--step all`.
7. **Bukti kelulusan.** Saat `--step all` lulus, jalankan `python3 scripts/prove.py mod-4-2 ~/seismic` untuk mencetak kode bukti bagi aplikasi kursus.

### @files
- labs/mod-4-2/starter/pipeline.py :: Template kerja awal Anda: salin ke workspace dan bangun pipeline di sana :: starter
- labs/mod-4-2/check.py :: Pemeriksa otomatis: lima tahap pengujian, petunjuk bertingkat, dan pengujian kegagalan :: test
- labs/mod-4-2/fetch_data.py :: Mengunduh dataset seismik USGS dan memverifikasi hash SHA-256 :: config
- labs/mod-4-2/requirements.txt :: duckdb, pyarrow :: config

### @deliverables
- Perintah `python3 labs/mod-4-2/check.py ~/seismic --step all` lulus di komputer Anda di dalam virtual environment
- Anda dapat menjelaskan mengapa koordinat GeoJSON mengurutkan bujur sebelum lintang dan risiko tertukarnya indeks
- Anda dapat menjelaskan mengapa berkas state checkpoint wajib diperbarui secara atomik setelah penulisan data selesai
- Anda dapat menjelaskan bagaimana Dead-Letter Queue memungkinkan ketersediaan tinggi tanpa menyembunyikan kerusakan data
- Berkas `NOTES.md` di workspace Anda memuat analisis arsitektural tentang isolasi state antara backfill dan proses inkremental

### @verify
```bash
python3 labs/mod-4-2/check.py ~/seismic --step all
python3 scripts/prove.py mod-4-2 ~/seismic
```

## @chaos Crash server di tengah sinkronisasi & racun koordinat
### @scenario
Pada hari Sabtu pukul 03.15 UTC, server API hulu mengalami kehabisan memori saat menyajikan Halaman 4 dari pengiriman batch berkala. Di tengah pengiriman data, koneksi soket TCP terputus mendadak. Saat cron job berjalan satu jam kemudian, pipeline seorang engineer junior telah memperbarui watermark state sebelum data berhasil ditulis ke disk—akibatnya 150 rekaman gempa hilang permanen, termasuk peringatan tsunami lepas pantai.

Pada saat yang sama, stasiun sensor seismik baru di Pasifik Selatan memancarkan data dengan posisi lintang dan bujur terbalik, mengirim `[lat, lon]` alih-alih standar `[lon, lat]`. Pipeline tanpa validasi batas koordinat langsung memasukkan nilai lintang 175 derajat Selatan, merusak layer spasial GIS analitik dan mengacaukan visualisasi peta.

### @cause
Pipeline tersebut tidak bersifat transaksional dan tidak defensif. Watermark diperbarui sebelum penulisan selesai, sehingga penghentian mendadak menghilangkan data permanen. Pipeline juga tidak memiliki validasi skema masuk, memercayai koordinat geografis dari hulu secara buta tanpa memeriksa bahwa lintang selalu berada dalam rentang -90 sampai 90.

### @fix
1. **Tulis penyimpanan sebelum checkpoint:** Tulis data batch ke DuckDB terlebih dahulu. Hanya ketika penulisan sukses barulah Anda menaikkan watermark dan menyimpan `state.json`.
2. **Swap berkas atomik:** Tulis ke `state.json.tmp` dan gunakan `os.replace` agar berkas checkpoint tidak pernah tertinggal dalam keadaan rusak sebagian.
3. **Upsert yang idempoten:** Lakukan deduplikasi berdasarkan `event_id` dan `updated_epoch_ms` agar pemrosesan ulang tidak pernah melipatgandakan baris.
4. **Karantina ke Dead-Letter Queue:** Validasi lintang antara -90 dan 90 serta bujur antara -180 dan 180. Arahkan koordinat bermasalah ke `dlq/rejected.jsonl` beserta metadata diagnostik.

### @pattern
Pipeline ingesti harus memperlakukan jaringan dan penyedia data hulu sebagai komponen yang tidak tepercaya dan rentan gagal. Simpan data sebelum memperbarui checkpoint, pastikan penulisan bersifat idempoten, dan karantina data beracun ke DLQ tanpa menghentikan pemrosesan data bersih lainnya.

## @quiz
### Dalam standar format GeoJSON (RFC 7946), bagaimana koordinat spasial disusun untuk geometri Point, dan apa jebakan umumnya?
- [ ] Koordinat selalu disimpan dalam format lintang lalu bujur, menyebabkan mesin render GIS crash jika nilainya melebihi sembilan puluh derajat
- [x] Koordinat disimpan sebagai [bujur, lintang, elevasi], dan membalik posisinya akan membalik peta dunia atau melanggar batas lintang bumi
- [ ] Koordinat disimpan sebagai string teks ISO-6709 yang membutuhkan ekspresi reguler kompleks untuk memisahkan derajat, menit, dan arah
- [ ] Koordinat disimpan sebagai satu kesatuan string geohash tunggal yang wajib diurai menggunakan pustaka geospasial khusus sebelum disimpan

> Format GeoJSON RFC 7946 secara tegas menetapkan urutan [bujur, lintang, elevasi/kedalaman]. Mengingat bahasa sehari-hari sering menyebut "lintang, bujur", urutan indeks sering terbalik. Karena batas lintang adalah -90 sampai 90 sedangkan bujur -180 sampai 180, membalik urutan menyebabkan bujur > 90 gagal validasi lintang.

### Saat REST API hulu membatasi panggilan ekstraktor dengan respon HTTP 429 (Too Many Requests), apa tindakan arsitektural yang benar?
- [ ] Segera melakukan pengulangan request dua puluh kali dalam perulangan tanpa henti sampai koneksi diterima kembali oleh server hulu jaringan
- [x] Memeriksa header Retry-After, tidur selama durasi waktu yang diminta server, dan menerapkan pola exponential backoff jika header absen
- [ ] Menghentikan eksekusi pipeline secara permanen, menghapus berkas basis data lokal di disk, dan mengirim email ke penyedia layanan API
- [ ] Mengubah request menjadi metode HTTP GET tanpa menyertakan user-agent guna mengelabui pembatas IP hulu agar ekstraksi data berlanjut

> Standar penanganan HTTP 429 Too Many Requests adalah memeriksa keberadaan header 'Retry-After', menghentikan eksekusi sementara selama waktu yang diminta, dan menerapkan exponential backoff bertahap jika header tidak disediakan. Memaksa retry seketika justru memperburuk pembatasan akses.

### Mengapa berkas checkpoint state (seperti state.json) wajib diperbarui dengan pola atomic file swap (tulis ke .tmp lalu os.replace)?
- [x] Karena menulis langsung ke berkas yang sedang ada dapat merusak isi berkas JSON jika proses tiba-tiba mati di tengah jalan penulisan data
- [ ] Karena kernel sistem operasi POSIX secara otomatis mengenkripsi seluruh berkas yang dipindahkan menggunakan pemanggilan sistem rename atomik
- [ ] Karena menulis ke berkas sementara merupakan satu-satunya metode di Python yang memperbolehkan banyak thread menulis berkas bersamaan
- [ ] Karena mesin penyimpanan DuckDB mewajibkan seluruh berkas state eksternal memiliki ekstensi berkas .tmp sebelum dapat dibuka kembali

> Jika sistem tiba-tiba mengalami crash atau kehabisan memori saat menulis langsung ke state.json, berkas tersebut akan rusak setengah jalan dan menghancurkan riwayat checkpoint. Menulis ke berkas sementara lalu menggantinya secara atomik menjamin berkas selalu utuh (versi lama atau versi baru).

### Bagaimana seharusnya perilaku Change Data Capture (CDC) upsert ketika sebuah rekaman masuk memiliki primary key yang sama dengan rekaman lama?
- [ ] Rekaman baru harus selalu dibuang seketika karena basis data analitis modern selalu memberlakukan sifat append-only tanpa adanya pengecualian
- [x] Rekaman baru menggantikan rekaman lama hanya jika nilai timestamp pembaruan (updated) terbukti lebih besar atau sama dengan rekaman yang ada
- [ ] Pipeline menyisipkan rekaman baru sebagai baris baru dan menambahkan foreign key khusus yang mengarah ke identitas versi rekaman lama
- [ ] Rekaman baru harus langsung memicu pembersihan menyeluruh tabel dan mengulang penarikan seluruh data historis dari awal pertama kali

> Dalam aliran data CDC dan dimensi yang berubah lambat (SCD), pembaruan entitas diverifikasi dengan membandingkan timestamp versi atau waktu pembaruan. Jika updated_baru >= updated_lama, data lama diperbarui mencerminkan keadaan terkini; jika lebih tua, data diabaikan.

### Apa perbedaan operasional paling mendasar antara proses ingesti inkremental terjadwal dan proses backfill historis?
- [ ] Ingesti inkremental membaca berkas Parquet sedangkan proses backfill historis hanya diperbolehkan mengekstrak berkas mentah CSV tanpa kompresi
- [x] Ingesti inkremental menaikkan nilai high-watermark pada state, sedangkan proses backfill wajib membiarkan watermark produksi tidak berubah
- [ ] Ingesti inkremental berjalan di DuckDB lokal sedangkan proses backfill historis wajib dijalankan pada kluster besar Apache Spark di cloud
- [ ] Ingesti inkremental membuang rekaman yang salah sedangkan proses backfill wajib mengalami crash seketika jika menemukan nilai bernilai null

> Eksekusi inkremental memajukan checkpoint high-watermark pada state.json agar jadwal berikutnya mengambil data terbaru. Backfill mengambil rentang masa lampau; jika backfill mengubah state.json, watermark produksi akan tergeser mundur sehingga merusak jadwal produksi berikutnya.

### Saat sebuah batch berisi 100 data tiba dari API dengan 3 data memiliki koordinat rusak, apa fungsi dari Dead-Letter Queue (DLQ)?
- [ ] DLQ membuang 3 data rusak secara diam-diam agar dashboard analitis tidak pernah mendeteksi adanya metrik atau data yang hilang di sistem
- [x] DLQ mengarahkan 3 rekaman cacat ke wadah audit beserta metadata kegagalan sembari membiarkan 97 rekaman yang valid disimpan ke warehouse
- [ ] DLQ membatalkan seluruh 100 data yang masuk dan memaksa pipeline berhenti total dengan exception fatal sampai ada perbaikan dari engineer
- [ ] DLQ secara otomatis menebak koordinat yang tepat menggunakan model kecerdasan buatan lalu menyisipkan rekaman perbaikan ke dalam tabel

> Dead-Letter Queue mengisolasi rekaman rusak tanpa menghentikan aliran data utama. Data bersih tetap mengalir ke konsumen analitis, sementara rekaman yang cacat disimpan ke tempat karantina beserta alasan kegagalan dan waktu kejadian untuk keperluan audit.

### Mengapa variasi acak (jitter) ditambahkan pada exponential backoff ketika mengulang panggilan jaringan yang gagal di banyak worker?
- [x] Untuk mencegah seluruh pekerja ekstraksi melakukan sinkronisasi waktu tunggu yang sama dan menembak server hulu secara serentak bersamaan
- [ ] Untuk mengenkripsi muatan HTTP request menggunakan kunci acak agar terlindung dari manipulasi cache oleh proxy perantara di jaringan publik
- [ ] Untuk memadatkan ukuran header permintaan sebelum dikirimkan sehingga menghemat konsumsi lebar pita jaringan jarak jauh berskala global
- [ ] Untuk mengelabui gateway API hulu agar memperlakukan setiap percobaan ulang seolah-olah berasal dari wilayah geografis yang berbeda-beda

> Tanpa jitter, banyak worker yang gagal bersamaan akan menunggu selama durasi yang sama persis (2, 4, 8 detik) lalu menyerang server hulu pada detik yang sama (masalah thundering herd). Penambahan jitter memecah keserentakan ini sehingga beban terdistribusi rata.

### Jika sebuah API mendukung paginasi limit/offset dan filter timestamp (starttime), kesalahan fatal apa yang terjadi jika offset dinaikkan bersamaan dengan memajukan starttime?
- [ ] Klien HTTP menghasilkan error protokol karena server REST melarang penggabungan parameter penyaringan waktu dengan batasan numerik
- [x] Sejumlah data terlewat karena menerapkan offset lebih dari satu pada irisan waktu yang sudah terfilter akan melompati data yang valid
- [ ] Basis data analitis crash karena DuckDB tidak dapat menerima masukan baris data yang difilter oleh lebih dari satu kriteria pencarian
- [ ] Server API menganggap permintaan tersebut sebagai serangan siber distributed denial-of-service dan memblokir alamat IP klien selamanya

> Jika starttime dimajukan ke timestamp tertinggi halaman sebelumnya, hasil kueri server hulu sudah terpotong hanya memuat data setelah waktu tersebut. Jika Anda juga menyertakan offset=101, server akan melompati 100 data pertama dari daftar baru itu, menimbulkan data loss parah.

## @resources
- [USGS Earthquake API Documentation](https://earthquake.usgs.gov/fdsnws/event/1/)
- [RFC 7946 - The GeoJSON Format Specification](https://datatracker.ietf.org/doc/html/rfc7946)
- [Exponential Backoff And Jitter - AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [DuckDB Python API & SQL Reference](https://duckdb.org/docs/api/python/overview)
