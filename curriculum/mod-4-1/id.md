---
title: Capstone: Pipeline Data Nyata pada Rekaman Perjalanan Taksi NYC
duration: 3 minggu
summary: Bangun pipeline batch lengkap di atas data publik dunia nyata secara mandiri: lakukan profiling 2,96 juta perjalanan taksi, bersihkan dengan aturan eksplisit, simpan data yang ditolak ke karantina, bentuk skema bintang di DuckDB, terbitkan dua data mart, dan buat pipeline aman dari eksekusi ulang serta mampu menolak pengiriman data yang rusak. Pelajaran ini hanya memberikan kontrak; pemeriksa otomatis memverifikasi tiap langkah secara independen.
why: Sebagian besar lab mengajarkan satu keahlian terisolasi pada data yang sudah rapi. Di dunia kerja nyata, Anda menerima file berantakan, permintaan yang samar, dan tanpa tes bawaan. Capstone ini mencopot roda bantu latihan: datanya memiliki cacat nyata, aturan validasi harus Anda bangun sendiri, dan satu-satunya umpan balik adalah kebenaran hasil akhir.
---

## @outcomes
- Melakukan profiling dataset asing dan mengubah temuan anomali menjadi aturan pembersihan data yang eksplisit dan terhitung
- Memisahkan data bersih dari data yang ditolak tanpa kehilangan satu baris pun, serta merekonsiliasi total jumlah baris
- Merancang skema bintang (star schema) dengan grain yang dideklarasikan secara presisi, tabel dimensi, dan tabel fakta yang cocok dengan total sumber
- Menerbitkan data mart dengan definisi bisnis yang kokoh, menghindari jebakan fatal seperti agregasi berdasarkan nama yang tidak unik
- Membangun pipeline yang idempoten, atomik, dan dilindungi gerbang kualitas data (quality gates) agar pengiriman duplikat atau skema rusak tidak merusak data yang sudah ada

## @prereq
Modul 0.2 (terminal, virtual environment), 1.2 (idempotensi, retries), 1.4 (pemodelan dimensional), 1.5 (kebiasaan pandas) dan 2.1 (Parquet dan DuckDB) adalah perkakas yang akan Anda gunakan; 2.5 (data quality gates) adalah pola pikirnya. Anda membutuhkan Python 3.10 atau yang lebih baru, ruang disk kosong sekitar 1,5 GB, serta koneksi internet stabil satu kali untuk mengunduh dataset sebesar 50 MB.

## @lesson Cara kerja capstone ini
Setiap lab sejauh ini memberitahu Anda fungsi mana yang harus ditulis dan menjalankan pengujian otomatis terhadapnya. Capstone ini sengaja dirancang berbeda. **Anda menerima kontrak kerja, data nyata, dan sebuah skrip pemeriksa (checker).** Anda bebas menentukan cara membangunnya: DuckDB atau pandas, satu skrip atau modular, SQL atau Python murni. Tidak ada yang memeriksa gaya penulisan kode Anda. Pemeriksa hanya menilai **hasil akhir**: berkas-berkas yang dihasilkan pipeline Anda, keakuratan angka di dalamnya, dan bagaimana perilaku pipeline saat menghadapi anomali data.

Aturan main capstone:

1. **Kerjakan sendiri secara mandiri.** Jangan menyalin solusi orang lain, dan jangan menempelkan instruksi tugas ke AI lalu menjalankan kodenya tanpa paham. Tujuannya adalah agar Anda mampu menyelesaikan masalah rekayasa data secara mandiri di pekerjaan nyata. Jika Anda memakai AI atau mesin pencari untuk memahami suatu konsep, itu hal yang wajar; namun jika AI yang menuliskan pipeline-nya, Anda mungkin lulus pemeriksa otomatis tetapi akan gagal pada tugas dunia kerja sesungguhnya. Kode bukti di akhir (seperti pada setiap lab) hanya bernilai jika dicapai dengan jujur.
2. **Bekerja di folder proyek Anda sendiri** (misalnya `~/taxi`), di dalam virtual environment Anda (Modul 0.2). Workspace Anda menyimpan dua file yang Anda buat: `pipeline.py` dan `profile.json`. Skrip pemeriksa tidak akan pernah mengubah file Anda.
3. **Jalankan pemeriksaan di setiap langkah**, bukan hanya di akhir: `python3 labs/mod-4-1/check.py ~/taxi --step 2`. Baris FAIL akan menjelaskan letak kesalahannya, terkadang disertai petunjuk singkat tentang area yang perlu diperiksa.
4. **Petunjuk bertingkat sesuai kebutuhan Anda.** Opsi `--hint 1` memberi senggolan arah (*nudge*), `--hint 2` menjelaskan model mental/konsepnya, dan `--hint 3` memberikan panduan teknis yang sangat mendalam. Berusahalah minimal 30 menit sebelum membuka level 1, dan buka level 3 hanya jika Anda sudah meneliti datanya sendiri. Proses menganalisis masalah adalah inti pembelajarannya.
5. **Pemeriksa juga akan menguji ketahanan pipeline Anda.** Pada step 5, pemeriksa akan menjalankan kode Anda di atas beberapa skenario pengiriman yang sengaja dirusak: file yang sama dikirim dua kali, file dengan kolom yang diganti namanya, serta file dengan 40% data cacat. Pipeline di dunia nyata menghadapi insiden seperti ini setiap hari.

Persiapan awal (dijalankan satu kali):

```bash
python3 -m venv ~/taxi/venv && source ~/taxi/venv/bin/activate
pip install -r labs/mod-4-1/requirements.txt          # duckdb dan pyarrow
python3 labs/mod-4-1/fetch_data.py                    # 50 MB, diverifikasi hash, ke labs/mod-4-1/data/
cp labs/mod-4-1/starter/pipeline.py ~/taxi/pipeline.py
```

Alokasikan waktu sekitar 15 hingga 25 jam secara keseluruhan. Setiap eksekusi penuh pipeline Anda akan menghasilkan data sekitar 300 MB, dan skrip pemeriksa akan menjalankannya beberapa kali di dalam folder sementara yang otomatis dihapus setelah selesai.

## @lesson Mengenal datanya
**NYC Taxi and Limousine Commission (TLC)** menerbitkan setiap rekaman perjalanan taksi kuning sebagai file bulanan berformat Parquet (data publik resmi Kota New York). Kita menggunakan data **Januari 2024**: satu file berukuran sekitar 50 MB yang memuat hampir tiga juta perjalanan dengan 19 kolom. Skrip pemeriksa memverifikasi hash SHA-256 dari file unduhan Anda, sehingga setiap peserta bekerja di atas data biner yang identik.

| Kolom | Arti |
|---|---|
| `VendorID` | Kode perusahaan penyedia perangkat argo taksi (1, 2, atau 6) |
| `tpep_pickup_datetime`, `tpep_dropoff_datetime` | Waktu penjemputan dan penurunan penumpang |
| `passenger_count` | Jumlah penumpang yang dimasukkan oleh pengemudi |
| `trip_distance` | Jarak tempuh perjalanan dalam mil pada odometer |
| `RatecodeID` | 1 Standar, 2 JFK, 3 Newark, 4 Nassau/Westchester, 5 Negosiasi, 6 Rombongan, 99 Lainnya |
| `store_and_fwd_flag` | Status apakah rekaman disimpan di memori kendaraan sebelum dikirim |
| `PULocationID`, `DOLocationID` | ID zona lokasi jemput dan antar (1 s.d. 265) |
| `payment_type` | 0 Flex Fare, 1 Kartu kredit, 2 Tunai, 3 Tanpa biaya, 4 Sengketa, 5 Tidak diketahui, 6 Dibatalkan |
| `fare_amount`, `extra`, `mta_tax`, `tip_amount`, `tolls_amount`, `improvement_surcharge`, `congestion_surcharge`, `Airport_fee` | Komponen rincian biaya tagihan |
| `total_amount` | Total nominal yang dibayar penumpang (tip tunai tidak terekam di sistem) |

File pendukung kedua, `taxi_zone_lookup.csv`, mendeskripsikan **265 zona lokasi**: `LocationID`, `Borough`, `Zone`, `service_zone`.

**Temuan anomali saat data ini di-profile** (Anda akan menemukan angka yang sama, dan step 1 meminta sembilan angka ini):

- File "Januari" ini memuat perjalanan dengan waktu penjemputan seawal **2002-12-31** dan selambat **2024-02-01**: ada sejumlah perjalanan di luar bulan Januari.
- Sebagian perjalanan berakhir sebelum dimulai, dan sebagian berakhir tepat di detik yang sama. Beberapa berdurasi lebih dari 24 jam.
- Banyak perjalanan memiliki nilai total nol atau negatif (transaksi refund dan sengketa); nilai paling ekstrem adalah -900,00, dan total argo terbesar mencapai 5.000,00. Beberapa perjalanan mengklaim jarak di atas 100 mil, bahkan yang terjauh tertulis 312.722,3 mil.
- Sekelompok baris (beberapa persen dari file) bernilai NULL serentak pada kolom `passenger_count`, `RatecodeID`, `store_and_fwd_flag`, `congestion_surcharge`, dan `Airport_fee`, dan baris-baris itu juga yang memiliki `payment_type` 0: rekaman tipe *Flex Fare*, skema baru yang tidak mengisi kolom-kolom lama. Perjalanan lain mencatat 0 penumpang.
- Zona penjemputan tersibuk adalah sebuah bandara besar; tidak semua dari 265 zona muncul sebagai lokasi jemput.
- **Perjalanan tunai** hampir tidak pernah mencatat tip, sedangkan sebagian besar perjalanan kartu kredit mencatatnya. Tip tunai memang tidak terekam oleh argo taksi, sehingga statistik tip yang menggabungkan transaksi tunai akan menyesatkan analisis bisnis.
- Tabel zona juga memiliki jebakan: ID 264 dan 265 adalah "Unknown" dan "Outside of NYC", serta ID **56 dan 57 dua-duanya bernama "Corona"**. Nama zona bukanlah primary key yang unik.

File asli tidak memiliki baris duplikat identik, namun sistem upstream mitra dapat mengirimkan file yang sama dua kali, itulah sebabnya pipeline Anda wajib menangani potensi duplikasi.

**Pertanyaan wajib sebelum memproses dataset baru**: Apa definisi satu baris (grain)? Berapa rentang waktunya, dan apakah ada data yang bocor di luar rentang? Kolom mana saja yang bisa bernilai NULL, dan apakah ada alasan berbeda di balik nilai NULL tersebut? Nilai apa saja yang tidak masuk akal (negatif, nol, tanggal masa depan)? Apakah ada identifier unik? Kode status mana yang membutuhkan kamus referensi? Kolom apa yang terlihat mirip namun sebenarnya berbeda (nama sama untuk ID berbeda)? Apa yang *sengaja tidak dicatat oleh sistem hulu* (seperti tip tunai)? Catat jawabannya sebelum Anda menulis kode.

## @lesson Kotak perkakas Anda: DuckDB dan beberapa baris Python
Pemeriksa tidak membatasi perkakas apa yang Anda pakai. Kami menyarankan **DuckDB**, karena DuckDB dapat membaca Parquet dan CSV secara langsung, memproses jutaan baris dalam hitungan detik di satu laptop (seluruh pipeline referensi selesai dalam waktu sekitar 4 detik), serta mampu menulis berkas Parquet dan file database `.duckdb` yang disyaratkan kontrak. Penjelasan di bawah ini adalah penyegar konsep generik yang diuji langsung pada file ini, bukan jawaban kode utuh. Modul 2.1 membahas DuckDB secara mendalam.

```python
import duckdb
con = duckdb.connect()                                   # di memori; duckdb.connect("file.duckdb") membuat FILE database
con.sql("DESCRIBE SELECT * FROM 'yellow_tripdata_2024-01.parquet'")    # membaca kolom dan tipe
con.sql("SELECT count(*) AS trips, count(*) FILTER (WHERE tip_amount > 0) AS tipped FROM 'yellow_tripdata_2024-01.parquet'").fetchall()
# [(2964624, 2254230)]: FILTER menghitung baris yang cocok di dalam satu query tunggal
```

Pola-pola SQL yang Anda butuhkan:

- **Memberi label baris berdasarkan aturan pertama yang cocok:** `CASE WHEN fare_amount < 0 THEN 'negative' WHEN fare_amount = 0 THEN 'zero' ELSE 'ok' END`. Pada file ini menghasilkan 2.926.283 ok, 37.448 negatif, dan 893 nol. Klausa `CASE` berhenti mengevaluasi begitu menemukan kondisi `WHEN` pertama yang bernilai benar.
- **Menghapus baris duplikat identik:** `SELECT DISTINCT * FROM ...`.
- **Menulis hasil query sebagai Parquet:** `COPY (SELECT ...) TO 'out/clean/trips.parquet' (FORMAT parquet)`. Folder tujuan harus sudah ada.
- **Membuat tabel dari query di dalam file database:** `con = duckdb.connect("OUT/warehouse.duckdb")` lalu `con.execute("CREATE TABLE t AS SELECT ...")`. Selalu tutup koneksi (`con.close()`) sebelum proses lain membaca file database tersebut.
- **Menghasilkan ID stabil dari kombinasi nilai:** `hash(col1, col2, ...)` mengembalikan angka 64-bit yang deterministik untuk kombinasi nilai yang sama pada setiap eksekusi.
- **Durasi waktu dan kalender tanggal:** `date_diff('second', start, end) / 60.0` untuk durasi menit, `isodow(date)` untuk hari dalam sepekan (Sabtu bernilai 6), dan `unnest(generate_series(DATE '2024-01-30', DATE '2024-02-02', INTERVAL 1 DAY))` untuk deret tanggal harian.
- **Membaca CSV lengkap dengan header:** `read_csv('taxi_zone_lookup.csv', header = true)`.

Kebutuhan Python sangat ringkas: modul `argparse` untuk menerima argumen CLI, `sys.exit(2)` untuk menolak pengiriman data yang gagal uji kualitas, `print(json.dumps(...), file=sys.stderr)` untuk mencetak alasan kegagalan, serta `pathlib`/`shutil` (`mkdir`, `rename`, `rmtree`) untuk operasi pergantian folder temporer secara atomik.

**Rutinitas debugging untuk pipeline data produksi**:

1. Jalankan pipeline dan buka hasilnya dengan DuckDB. Periksa sampel sepuluh baris data sebelum Anda memeriksa angka agregat total.
2. Bandingkan setiap jumlah baris dengan tolok ukur di pelajaran ini (sekitar 1,2% ditolak, 2.927.800 baris bersih). Jika ada selisih, besaran selisih memberi tahu letak masalahnya: selisih kecil biasanya terkait urutan aturan, sedangkan selisih kelipatan dua umumnya dipicu oleh join atau duplikasi data.
3. Uji aturan satu per satu pada file mentah dengan query sederhana `SELECT count(*) ... WHERE ...`, lalu cocokkan dengan jumlah per kategori alasan di file data yang Anda tolak.
4. Ketika pemeriksaan skrip checker gagal, baca pesannya secara harfiah. Pesan "expected 2,927,800, you have 2,927,801" berarti ada kelebihan satu baris; temukan baris tersebut dengan memfilter baris bersih yang melanggar aturan.
5. Ubah satu hal dalam satu waktu lalu uji kembali. Pipeline sebesar ini selesai dalam hitungan detik, sehingga tidak ada alasan untuk menebak-nebak tanpa data.

## @lesson Kontrak teknis
Bagian ini adalah spesifikasi teknis formal. Baca secara menyeluruh sebelum memulai step 2; skrip pemeriksa mengikuti kontrak ini secara persis.

**Antarmuka Baris Perintah (CLI).** `python pipeline.py --trips TRIPS.parquet --zones ZONES.csv --out OUT`. Skrip membaca file pengiriman dengan 19 kolom mentah dan menulis seluruh berkas luaran ke dalam folder `OUT`.

**Kode Keluar (Exit Codes).** `0`: pengiriman data berhasil diproses. `2`: **gerbang kualitas (quality gate)** menolak pengiriman data; dalam kondisi ini, **tidak boleh ada perubahan satu byte pun di dalam folder OUT**. Kode keluar lainnya menandakan pipeline mengalami crash/error tak terduga.

**Aturan Pembersihan Data.** Pertama, hapus duplikat: baris yang identik pada **keseluruhan 19 kolom** dianggap sebagai satu perjalanan, simpan satu saja. Kemudian, tandai setiap baris yang tersisa dengan **aturan pertama** yang dilanggarnya, mengikuti urutan prioritas ini:

| Urutan | `reject_reason` | Baris ditolak jika |
|---|---|---|
| 1 | `pickup_outside_month` | Waktu jemput sebelum 2024-01-01 atau pada/setelah 2024-02-01 |
| 2 | `dropoff_not_after_pickup` | Waktu antar sama dengan atau mendahului waktu jemput |
| 3 | `trip_too_long` | Durasi perjalanan melebihi 24 jam |
| 4 | `non_positive_total` | Nilai `total_amount` bernilai 0 atau negatif |
| 5 | `implausible_distance` | Jarak `trip_distance` melebihi 100 mil |

Pada file data nyata, aturan ini menolak sekitar 1,2% baris, dan pemeriksa membandingkan hitungan per alasan Anda dengan hitungannya sendiri. Jika tiap aturan dihitung terpisah, jumlahnya melebihi jumlah baris yang ditolak, karena **beberapa baris melanggar lebih dari satu aturan**; aturan yang urutannya lebih awal menang, sehingga setiap baris yang ditolak hanya dihitung satu kali. Baris yang lolos dari kelima aturan dinyatakan **bersih (clean)**. Nilai NULL pada `passenger_count` *bukanlah* alasan penolakan, dan nilai tersebut harus tetap dibiarkan NULL (jangan mengarang nilai 0 atau 1).

**Berkas Luaran.**

- `OUT/clean/trips.parquet`: Memuat **2.927.800** baris dengan persis 16 kolom berikut: `trip_id` (unik, tidak boleh kosong, baris yang sama selalu menghasilkan ID yang sama; hash 64-bit dari 19 kolom asli sangat ideal), `vendor_id` integer, `pickup_at` dan `dropoff_at` timestamp, `passenger_count` integer (NULL diperbolehkan), `trip_distance_miles` double, `rate_code` teks (nama standar dari tabel di atas, selain itu "Unknown"), `pickup_zone_id` dan `dropoff_zone_id` integer, `payment_method` teks (nama standar di atas, selain itu "Unknown"), `fare_amount`, `tip_amount`, `tolls_amount`, dan `total_amount` bertipe double, `trip_minutes` double (durasi perjalanan dalam menit), `pickup_date` bertipe date.
- `OUT/rejected/trips_rejected.parquet`: Memuat baris-baris yang ditolak dengan **19 kolom asli ditambah kolom `reject_reason`**.
- `OUT/quality_report.json`: Laporan dengan format `{"status": "passed", "rows_in", "duplicates_removed", "rows_rejected", "rows_clean", "reject_rate", "rejected_by_reason": {reason: count}}`. Angkanya harus terekonsiliasi: `rows_in - duplicates_removed = rows_clean + rows_rejected`. Nilai `reject_rate` adalah jumlah baris ditolak dibagi jumlah baris setelah deduplikasi.
- `OUT/warehouse.duckdb`: Berkas database DuckDB yang memuat tabel-tabel di bawah ini.

**Skema Bintang (Star Schema)** (Grain dari `fact_trip`: **satu baris per perjalanan bersih**):

- `dim_zone(zone_id, borough, zone, service_zone)`: Dari CSV zona, satu baris per ID lokasi.
- `dim_date(date_key, date, day_of_week, is_weekend)`: Satu baris per hari kalender dari tanggal jemput paling awal hingga paling akhir dari data bersih; `date_key` ditulis sebagai integer format YYYYMMDD (misal 20240115); `day_of_week` nama hari bahasa Inggris; `is_weekend` bernilai true untuk Sabtu dan Minggu.
- `dim_payment(payment_key, payment_method)`: Tujuh baris, satu baris per nama metode pembayaran dengan key unik masing-masing.
- `fact_trip(trip_id, pickup_date_key, pickup_zone_id, dropoff_zone_id, payment_key, passenger_count, trip_distance_miles, trip_minutes, fare_amount, tip_amount, total_amount)`.

**Data Mart** (Tabel analitik di dalam file database DuckDB yang sama):

- `mart_daily(pickup_date, trips, revenue, avg_tip_pct)`: Satu baris per tanggal penjemputan. Kolom `revenue` adalah jumlah dari `total_amount`. Kolom `avg_tip_pct` adalah `100 * SUM(tip_amount) / SUM(fare_amount)` khusus untuk transaksi **kartu kredit**, dibulatkan hingga 2 desimal (karena tip tunai tidak terekam).
- `mart_top_routes(pickup_zone_id, dropoff_zone_id, pickup_zone, dropoff_zone, trips, avg_minutes)`: Sepuluh rute dengan volume perjalanan terbanyak, di mana sebuah rute didefinisikan oleh pasangan **ID zona lokasi**; jika terjadi nilai imbang (*ties*), urutkan berdasarkan `pickup_zone_id` lalu `dropoff_zone_id`; `avg_minutes` adalah rata-rata `trip_minutes` dibulatkan 1 desimal; nama zona diambil melalui join ke `dim_zone`.

**Gerbang Kualitas (Quality Gates)** (Pipeline wajib menolak pengiriman data dan keluar dengan kode 2 jika kondisi ini terjadi): Salah satu dari 19 kolom wajib tidak ditemukan; file pengiriman berisi 0 baris; atau rasio baris ditolak melebihi **5% (reject_rate > 0.05)**. Saat penolakan terjadi, cetak satu baris JSON ke stderr yang menjelaskan alasannya (contohnya `{"status": "failed", "failure": "missing_columns"}`).

## @lesson Merancang agar pipeline bertahan di produksi
Langkah 5 pada skrip pemeriksa adalah titik di mana sebagian besar pipeline data gagal, oleh karena itu rancanglah ketahanan ini sejak awal arsitektur.

**Idempoten.** Menjalankan pipeline dua kali pada file pengiriman yang sama harus menghasilkan status warehouse yang identik seperti saat dijalankan satu kali. Pendekatan paling bersih adalah **membangun ulang luaran dari nol untuk setiap pengiriman** (alih-alih melakukan append pada data yang sudah ada): luaran adalah fungsi murni dari data masukan. Ini adalah penerapan prinsip Modul 1.2 pada berkas penyimpanan. Baris yang muncul ganda di dalam satu file ditangani oleh aturan deduplikasi; dan dengan `trip_id` yang deterministik, data tidak akan pernah masuk ganda ke tabel fakta.

**Atomik.** Jika pipeline mengalami crash di tengah proses penulisan, aplikasi hilir tidak boleh membaca kondisi data setengah baru dan setengah lama. Tuliskan seluruh luaran baru ke dalam **folder temporer di samping folder `OUT`**, dan hanya setelah seluruh proses kalkulasi dan validasi berhasil 100%, lakukan pergantian (*atomic swap*) ke lokasi akhir (rename folder lama ke cadangan, rename folder temporer ke OUT, hapus folder lama). Operasi rename di sistem berkas lokal bersifat atomik dan jauh lebih aman daripada menulis berkas satu per satu di tempat. Setelah swap selesai, pastikan tidak ada folder sementara yang tertinggal: pemeriksa akan memverifikasi kebersihannya.

**Uji gerbang sebelum menulis.** Pengiriman data yang ditolak tidak boleh mengubah data yang sudah ada. Cara paling efektif adalah **menghitung seluruh indikator keputusan terlebih dahulu** (daftar kolom, jumlah baris, rasio penolakan), membuat keputusan validasi, dan baru memulai proses penulisan jika semua gerbang lolos. Dikombinasikan dengan folder temporer, eksekusi yang gagal tidak akan pernah merusak data produksi yang valid; pemeriksa membandingkan hash seluruh folder sebelum dan sesudah pengiriman data rusak untuk memastikan keutuhan datanya.

**Karantina, jangan hapus diam-diam.** Berkas data yang ditolak tetap menyimpan seluruh kolom asli beserta alasan spesifik penolakannya, sehingga insinyur atau analis dapat mengaudit kembali data tersebut di kemudian hari. Pola karantina dan pencatatan alasan adalah cara Anda menjelaskan selisih angka laporan keuangan beberapa bulan kemudian. Jika 40% data tiba-tiba ditolak, masalahnya hampir pasti ada di sistem produsen hulu: gerbang yang menghentikan pemuatan dan membunyikan alarm jauh lebih berharga daripada pipeline yang diam-diam memuat 60% sisa data yang cacat.

**Rekonsiliasi angka di setiap lapisan.** Bandingkan metrik dengan lapisan sebelumnya di setiap tahap: `rows_in - duplicates = clean + rejected`, tabel fakta memiliki jumlah baris yang cocok dengan file data bersih, dan total revenue di mart cocok dengan total revenue data bersih. Operasi join yang menggandakan baris (jebakan fan-out dari Modul 0.3) akan menggelembungkan tabel fakta dan merusak angka omset tanpa memicu error exception apapun.

**Bekerja dalam tahapan kecil yang terverifikasi.** Buka file Parquet dan database `warehouse.duckdb` melalui terminal DuckDB atau notebook di setiap langkah. Cetak jumlah barisnya. Cocokkan dengan angka panduan pada pelajaran ini. File `profile.json` yang Anda buat di langkah 1 bukan sekadar tugas administratif: file tersebut adalah tabel kebenaran yang akan terus Anda jadikan patokan rekonsiliasi.

## @lab Lab: lima langkah menuju pipeline yang dapat dipercaya
Bangun file `pipeline.py` dan `profile.json` di workspace Anda secara bertahap, lalu uji dengan skrip pemeriksa setelah menyelesaikan tiap langkah. Pemeriksa akan mengeksekusi pipeline Anda di atas file Januari asli dan beberapa file uji anomali, lalu membandingkannya dengan tolok ukur referensi.

### @steps
1. **Persiapan.** Ikuti instruksi setup pada pelajaran pertama (virtual environment, `pip install -r labs/mod-4-1/requirements.txt`, unduh data dengan `python3 labs/mod-4-1/fetch_data.py`, salin `starter/pipeline.py` ke folder workspace Anda). Buka data dengan DuckDB dan teliti strukturnya: jalankan `DESCRIBE`, `count(*)`, beberapa baris sampel, serta nilai minimum dan maksimum tanggal penjemputan.
2. **Pemeriksa langkah 1: profiling.** Buat file `profile.json` di workspace Anda dengan sembilan angka statistik yang dihitung langsung dari file **mentah**, di mana tiap metrik dihitung secara independen: `rows_total`, `pickup_outside_month` (pickup sebelum 2024-01-01 atau mulai 2024-02-01), `dropoff_not_after_pickup` (dropoff pada atau sebelum pickup), `null_passenger_count`, `non_positive_total` (`total_amount` bernilai nol atau negatif), `distance_over_100` (`trip_distance` melebihi 100), `distinct_pickup_zones`, `busiest_pickup_zone_id` (ID zona dengan penjemputan terbanyak), dan `cash_trips_with_tip` (`payment_type` 2 dengan `tip_amount` di atas 0). Uji dengan perintah: `python3 labs/mod-4-1/check.py ~/taxi --step 1`.
3. **Pemeriksa langkah 2: bersihkan dan karantina.** Di dalam `pipeline.py`, implementasikan logika deduplikasi, evaluasi 5 aturan pembersihan berurutan, pembuatan file data bersih, file data karantina, serta `quality_report.json` persis sesuai kontrak. Jalankan secara mandiri terlebih dahulu dan cocokkan angkanya dengan panduan. Uji dengan: `python3 labs/mod-4-1/check.py ~/taxi --step 2`. Sebelum menjalankan pemeriksa, prediksi apakah angka penolakan `non_positive_total` Anda akan sama persis dengan angka di langkah 1, dan jelaskan mengapa ada selisih.
4. **Pemeriksa langkah 3: skema bintang.** Tambahkan pembuatan berkas database `warehouse.duckdb` yang memuat tiga tabel dimensi dan tabel `fact_trip`. Rekonsiliasi jumlah baris dan total argo tabel fakta dengan file data bersih sebelum menjalankan pengujian. Uji dengan: `python3 labs/mod-4-1/check.py ~/taxi --step 3`.
5. **Pemeriksa langkah 4: data mart.** Tambahkan pembuatan `mart_daily` dan `mart_top_routes`. Pastikan Anda memahami rasionalisasi di balik tiap formula (mengapa tip hanya dihitung dari transaksi kartu kredit? mengapa rute didefinisikan berdasarkan ID dan bukan nama zona?). Skrip pemeriksa juga akan menguji pipeline Anda di atas file kecil yang dirancang khusus untuk menguji jebakan nama zona ganda. Uji dengan: `python3 labs/mod-4-1/check.py ~/taxi --step 4`.
6. **Pemeriksa langkah 5: ketahanan produksi.** Buat pipeline Anda idempoten, atomik, dan dilindungi gerbang kualitas sesuai petunjuk pelajaran terakhir. Skrip pemeriksa akan menjalankannya lima kali lagi: dua kali pada file yang sama, satu kali pada file di mana setiap baris muncul dua kali, satu kali pada file dengan kolom yang diubah namanya, dan satu kali pada file dengan 40% data rusak (dua skenario terakhir harus keluar dengan kode 2 dan tidak mengubah folder keluaran Anda sama sekali). Uji dengan: `python3 labs/mod-4-1/check.py ~/taxi --step 5` (selesai di bawah satu menit pada pipeline yang optimal).
7. **Mengalami kebuntuan?** Baca kembali materi terkait, teliti datanya dengan query, dan baru gunakan opsi petunjuk: `python3 labs/mod-4-1/check.py ~/taxi --step 3 --hint 1` (kemudian level 2, lalu level 3).
8. **Penyelesaian.** Ketika pengujian `--step all` lulus seluruhnya, jalankan `python3 scripts/prove.py mod-4-1 ~/taxi` untuk memperoleh kode bukti verifikasi dan tempelkan ke kotak **Bukti** pada halaman web lab ini. Kemudian tuliskan 3 kalimat di berkas `NOTES.md` di workspace Anda mengenai hal apa yang paling mengejutkan Anda pada data ini serta satu metrik yang wajib dipantau jika pipeline ini berjalan setiap malam.

### @files
- labs/mod-4-1/starter/pipeline.py :: Berkas kerja awal: salin ke workspace Anda dan bangun pipeline di sana :: starter
- labs/mod-4-1/check.py :: Skrip pemeriksa otomatis: 5 langkah pengujian, petunjuk, dan bukti verifikasi :: test
- labs/mod-4-1/fetch_data.py :: Skrip pengunduh dua berkas data masukan dengan verifikasi checksum hash :: config
- labs/mod-4-1/requirements.txt :: Pustaka dependensi: duckdb, pyarrow :: config

### @deliverables
- Perintah `python3 labs/mod-4-1/check.py ~/taxi --step all` berhasil lulus **di komputer Anda sendiri, di dalam virtual environment Anda**
- Anda dapat menjelaskan dengan kata-kata sendiri mengapa beberapa baris melanggar lebih dari satu aturan dan apa arti "aturan pertama menang" bagi konsistensi perhitungan
- Anda dapat menjelaskan mengapa pipeline dibangun di dalam folder sementara dan mengapa gerbang kualitas dievaluasi sebelum penulisan dilakukan
- Anda dapat menjelaskan dua jebakan yang ada pada data (tip transaksi tunai dan kesamaan nama zona lokasi) serta cara pipeline Anda menanganinya
- Berkas `NOTES.md` Anda mencatat temuan anomali data serta metrik observabilitas harian

### @verify
```bash
python3 labs/mod-4-1/check.py ~/taxi --step all
python3 scripts/prove.py mod-4-1 ~/taxi
```

## @chaos Bulan yang tiba dua kali
### @scenario
Sebuah tim analitik taksi memuat file data bulanan TLC menggunakan skrip yang membersihkan baris data lalu melakukan operasi **append** ke tabel database warehouse. Sebuah dashboard laporan eksekutif menjumlahkan angka dari tabel tersebut. Suatu pagi, pimpinan keuangan bertanya mengapa total omset bulan Januari melonjak dua kali lipat dibandingkan angka yang dilaporkan minggu sebelumnya.

Penyebabnya sederhana: proses ekspor data dari sistem mitra mengalami kegagalan pada percobaan pertama, lalu di-restart otomatis oleh scheduler, dan mengirimkan file bulan Januari untuk kedua kalinya ke folder penerimaan. Skrip pemuat mendeteksi adanya file baru dan langsung memprosesnya. Hampir tiga juta rekaman perjalanan duplikat ditambahkan ke tabel fakta. Tidak ada error yang muncul, tidak ada tes yang gagal, dan dashboard menggambar grafik omset dua kali lebih tinggi dari realitas. Masalah kedua menyusul: ketika tim mencoba menghapus baris ekstra tersebut secara manual di database produksi, pengiriman data baru tiba dengan nama kolom yang berubah. Skrip mengalami crash setelah menghapus data bulan sebelumnya, meninggalkan database dalam kondisi rusak.

### @cause
Pipeline tersebut tidak bersifat **idempoten**: memproses data yang sama dua kali menghasilkan status akhir yang berbeda karena menggunakan operasi append alih-alih membangun ulang atau melakukan merge berdasarkan kunci yang stabil. Pipeline juga tidak memiliki **aturan deduplikasi** dan tidak memiliki identifier unik deterministik untuk setiap perjalanan. Selain itu, pipeline melakukan penulisan **sebelum memverifikasi skema data**: masalah skema baru disadari di tengah proses setelah data lama terlanjur diubah, tanpa mekanisme pergantian atomik sehingga kegagalan skrip merusak integritas tabel.

Dampak insiden membesar akibat tidak adanya **proses rekonsiliasi**: tidak ada pemeriksaan jumlah baris terhadap bulan sebelumnya atau terhadap data sumber, dan tidak ada sistem peringatan dini yang memantau lonjakan volume transaksi yang tidak wajar.

### @fix
1. **Bangun ulang alih-alih append**, atau muat data dengan mekanisme merge berdasarkan `trip_id` yang deterministik: memproses file pengiriman yang sama dua kali harus meninggalkan hasil akhir yang identik. Aturan bahwa "baris yang identik di semua kolom adalah satu perjalanan yang sama" membuang duplikasi di dalam file pengiriman.
2. **Kelola manifes berkas yang telah diproses** (nama file beserta checksum hash) agar pengiriman file yang sudah pernah dimuat dapat dikenali dan dilewati atau dilaporkan.
3. **Evaluasi gerbang sebelum menulis** dan gunakan mekanisme penulisan atomik: periksa kolom, jumlah baris, dan rasio penolakan di awal; bangun data di folder temporer; lakukan swap nama di akhir. Pengiriman data yang ditolak tidak boleh mengubah data produksi.
4. **Rekonsiliasi dan pasang alert**: bandingkan jumlah baris harian dengan rata-rata historis, rekonsiliasi total omset dengan sistem sumber, dan pastikan rumus `rows_in - duplicates = clean + rejected` terpenuhi pada setiap laporan proses.
5. **Karantina alih-alih menghapus**: simpan rekaman yang ditolak lengkap dengan alasannya, agar insiden dapat dianalisis dan diperbaiki di masa mendatang.
6. **Lakukan simulasi pemulihan berkala**: jalankan ulang pemrosesan data bulan sebelumnya langsung dari berkas mentah. Pada pipeline yang idempoten, proses ini hanya membutuhkan satu perintah eksekusi.

### @pattern
Pipeline adalah fungsi murni dari data masukan ke folder keluaran: masukan yang sama menghasilkan keluaran yang sama, dan masukan yang rusak tidak mengubah apapun. Verifikasi sebelum menulis, tulis di lokasi aman, lakukan swap di akhir, dan hitung semua metriknya.

## @quiz
### File Januari yang sama dikirim dua kali. Desain mana yang menghasilkan isi warehouse yang identik seperti pemrosesan satu kali?
- [ ] Menambahkan setiap pengiriman ke tabel yang ada, karena setiap pengiriman adalah event terpisah
- [ ] Melewatkan aturan pembersihan untuk file kedua, karena salinan pertama sudah dibersihkan sebelumnya
- [x] Membangun ulang output dari tiap pengiriman serta membuang duplikat, sehingga eksekusi ulang aman
- [ ] Menghapus baris lama secara manual setiap kali angka dashboard terlihat mencurigakan bagi tim bisnis

> Sifat idempoten berarti luaran adalah fungsi dari masukan data, bukan berapa kali pipeline dijalankan. Operasi append mengubah setiap percobaan ulang menjadi duplikasi data.

### Dihitung secara independen, kelima aturan menandai lebih banyak baris secara total daripada yang ditolak pipeline. Apa penyebab selisih tersebut?
- [ ] Pipeline kehilangan beberapa baris akibat bug tersembunyi pada writer Parquet yang dipakai untuk menulis output
- [ ] Perhitungan independen mencakup baris duplikat, yang dihapus oleh pipeline sebelum aturan dijalankan
- [x] Beberapa baris melanggar beberapa aturan; dengan aturan pertama yang menang, tiap baris dihitung sekali saja
- [ ] Aturan hanya memeriksa 2,9 juta baris pertama, sehingga baris-baris terakhir pada file tidak pernah diuji

> Penjumlahan hitungan independen menghitung ganda baris yang melanggar beberapa aturan sekaligus. Memberikan satu alasan penolakan per baris memastikan total alasan cocok dengan jumlah baris yang ditolak.

### Ribuan perjalanan memiliki nilai NULL pada kolom `passenger_count`. Apa tindakan kontrak terhadapnya, dan mengapa?
- [ ] Mengubahnya menjadi 1, karena perjalanan taksi membutuhkan minimal satu penumpang agar bisa terjadi
- [ ] Menolak baris tersebut, karena nilai yang hilang selalu membuat baris data tidak berguna bagi analitik
- [x] Mempertahankan baris dan nilai NULL, karena angka rekaan adalah fakta palsu yang tidak pernah diukur
- [ ] Mengubahnya menjadi 0, karena angka nol adalah cara standar untuk menyatakan ketidaktahuan dalam data

> Ini adalah rekaman Flex Fare yang memang tidak mengisi kolom lama. Tarif dan lokasinya valid sehingga menolaknya akan menghilangkan omset bisnis, dan mengarang angka penumpang akan menciptakan fakta palsu.

### Mengapa `mart_daily` hanya menghitung persentase tip untuk perjalanan yang menggunakan kartu kredit?
- [ ] Perjalanan kartu kredit adalah satu-satunya metode bayar di file, karena metode lain disembunyikan
- [ ] Tip tunai bernilai lebih besar dari tip kartu, sehingga persentase harian akan tampak terlalu tinggi
- [x] Tip tunai hampir tidak pernah dicatat dalam data, sehingga memasukkannya mencemari angka persentase
- [ ] Mesin DuckDB tidak mampu menjumlahkan tip dari beberapa metode pembayaran berbeda dalam satu query

> Sebuah metrik harus dihitung dari data yang benar-benar merefleksikan nilai aslinya. Hampir semua transaksi kartu kredit mencatatkan tip; sebaliknya hampir tidak ada transaksi tunai yang mencatatkan tip karena argo fisik tidak merekam uang tip tunai.

### Zona 56 dan 57 dua-duanya bernama "Corona". Bagaimana seharusnya `mart_top_routes` mendefinisikan sebuah rute?
- [ ] Berdasarkan nama zona jemput dan antar, karena nama tempat jauh lebih mudah dipahami daripada nomor ID angka
- [ ] Berdasarkan borough penjemputan, karena setiap wilayah kota hanya memiliki satu rute tersibuk per hari
- [x] Berdasarkan pasangan ID zona, lalu mengambil nama zona dari tabel dimensi hanya untuk kebutuhan tampilan
- [ ] Berdasarkan huruf pertama nama zona, sehingga lokasi yang berdekatan dikelompokkan ke dalam satu rute

> Nama adalah label deskriptif, bukan primary key unik. Mengelompokkan berdasarkan nama akan menggabungkan dua ID zona berbeda menjadi satu rute semu dan menghasilkan daftar 10 rute tersibuk yang salah.

### Pengiriman data baru tiba di mana 40% barisnya melanggar aturan pembersihan. Tindakan apa yang tepat diambil oleh pipeline?
- [ ] Memuat 60% data yang valid lalu memindahkan sisanya ke karantina tanpa memberi tahu siapapun tentangnya
- [ ] Menaikkan ambang batas reject rate yang diizinkan agar pengiriman lolos dan proses berjalan normal seperti biasa
- [x] Menolak seluruh pengiriman dengan alasan jelas dan exit code 2, menjaga output lama tetap utuh tak berubah
- [ ] Memperbaiki baris yang rusak secara otomatis dengan menebak nilai yang paling masuk akal untuk tiap kolom

> Tingkat penolakan setinggi itu mengindikasikan adanya kerusakan sistem di hulu (seperti salah konversi satuan atau kegagalan ekspor). Menghentikan pemrosesan dan membunyikan alarm melindungi seluruh laporan analitik hilir.

### Mengapa pipeline menulis seluruh berkas ke folder temporer lalu melakukan rename folder di akhir proses?
- [ ] Operasi rename otomatis mengompresi isi seluruh folder, membuat ukuran output jauh lebih hemat dibandingkan biasa
- [ ] Sistem operasi melarang keras program menulis file baru langsung ke folder yang sudah memiliki isi data
- [x] Kegagalan sistem atau penolakan gerbang menjaga data lama tetap utuh, tanpa meninggalkan campuran data rusak
- [ ] Skrip pemeriksa hanya dapat membaca folder yang memiliki angka di akhir namanya seperti ID proses sistem

> Konsumen hilir hanya akan membaca versi data lama yang lengkap atau versi data baru yang lengkap. Konsep atomik ini juga melindungi berkas checkpoint pada Modul 1.6.

### Berkas data bersih memiliki 2.927.800 baris, namun `fact_trip` memiliki baris dan omset yang lebih besar. Apa penyebabnya?
- [ ] DuckDB membulatkan setiap angka ke atas saat menulis tabel, yang menambahkan beberapa sen ke tiap trip
- [x] Join ke tabel dimensi yang memiliki primary key duplikat menggandakan baris fakta, memicu ledakan fan-out
- [ ] Data mart dibangun terlebih dahulu, dan total angkanya tidak sengaja ditambahkan ke tabel fakta belakangan
- [ ] Tabel dim_date memiliki 31 baris kalender, yang membuat data bulan Januari terlihat membesar dari aslinya

> Duplikasi primary key pada sisi tabel dimensi akan menggandakan baris fakta saat di-join (efek fan-out dari Modul 0.3). Memeriksa rekonsiliasi jumlah baris dan total nominal dengan data bersih akan menangkap anomali ini.

## @resources
- [NYC TLC trip record data (sumber resmi dengan berkas bulanan)](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page)
- [TLC data dictionary for Yellow Taxi trip records (PDF)](https://www.nyc.gov/assets/tlc/downloads/pdf/data_dictionary_trip_records_yellow.pdf)
- [DuckDB: Parquet files](https://duckdb.org/docs/stable/data/parquet/overview)
- [DuckDB: friendly SQL](https://duckdb.org/docs/stable/sql/dialect/friendly_sql)
- [Python: sys.exit and exit codes](https://docs.python.org/3/library/sys.html#sys.exit)
