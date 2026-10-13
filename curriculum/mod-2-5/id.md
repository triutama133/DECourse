---
title: Kualitas Data, Observabilitas, dan Data Contracts
duration: 2 minggu
summary: Pelajari cara mendefinisikan kualitas data, menempatkan assertions pada layer arsitektur yang tepat, menyepakati data contracts dengan tim produsen, memantau anomali freshness, volume, skema, dan distribusi, serta menangani insiden data dengan membangun gerbang kualitas (quality gate) yang fungsional.
why: Dalam tutorial pemula, sebuah pipeline dianggap selesai saat data mendarat di tabel target. Di lingkungan produksi nyata, kredibilitas seorang data engineer dipertaruhkan pada kepercayaan: apakah data tiba tepat waktu, apakah isinya lengkap, dan apakah angka kalkulasinya valid? Masalah data yang tidak melempar error traceback justru merupakan masalah yang paling mahal biayanya.
---

## @outcomes
- Mendefinisikan kualitas data ke dalam dimensi-dimensi yang dapat diuji secara objektif dan memetakan setiap dimensi ke dalam bentuk assertion check
- Menempatkan assertions pada layer yang tepat (source contract, ingestion gate, transformation tests, post-load monitoring) serta memahami batas kemampuan deteksi masing-masing layer
- Menulis data contract formal mencakup skema, batasan nilai, kepemilikan tim, dan SLA, serta menegakkannya menggunakan validation gate dan tabel karantina
- Mendeteksi anomali freshness, lonjakan/penurunan volume, pergeseran skema, dan drift distribusi menggunakan statistik robust untuk mencegah kelelahan notifikasi (alert fatigue)
- Menjalankan manajemen insiden data secara profesional: deteksi dini, triase dampak, komunikasi transparan ke stakeholder, perbaikan data, dan post-mortem tanpa menyalahkan individu (blameless)

## @prereq
Modul 0.1 (lima penyebab rusaknya data), Modul 1.2 (validasi dan karantina), serta Modul 2.3 (dbt tests). Jalankan `pip install -r labs/mod-2-5/requirements.txt` untuk menginstal PyYAML dan pytest.

## @lesson Apa arti "kualitas": dimensi yang dapat diuji
Istilah "data kotor" atau "data rusak" terlalu ambigu untuk ditindaklanjuti secara teknis. Kualitas data pada hakikatnya adalah **kesesuaian data untuk tujuan penggunaan spesifik (fitness for purpose)**. Agar dapat diuji secara otomatis dalam pipeline rekayasa data, konsep kualitas dipecah menjadi beberapa dimensi terukur. Menggunakan contoh data pesanan KopiKu:

| Dimensi | Pertanyaan Inti | Contoh Pengecekan pada Pesanan |
|---|---|---|
| **Kelengkapan (Completeness)** | Apakah semua data yang seharusnya ada benar-benar hadir? | Kolom `order_id` tidak boleh bernilai NULL; volume pesanan kemarin sebanding dengan hari biasa |
| **Validitas (Validity)** | Apakah setiap nilai mematuhi format dan rentang nilai yang diizinkan? | Nilai `status` wajib salah satu dari lima opsi valid; `total_idr` bernilai bilangan bulat positif; `order_ts` berformat ISO timestamp |
| **Keunikan (Uniqueness)** | Apakah setiap entitas dunia nyata hanya dicatat tepat satu kali? | Nilai `order_id` unik dan tidak terduplikasi |
| **Konsistensi (Consistency)** | Apakah data yang saling berhubungan menghasilkan kesimpulan yang selaras? | Total revenue di tabel fact sama dengan total di tabel raw source; customer pada pesanan terdaftar di tabel master |
| **Akurasi (Accuracy)** | Apakah data mencerminkan realitas fisik yang sebenarnya? | Angka pendapatan sesuai dengan laporan settlement payment gateway (membutuhkan external source of truth) |
| **Ketepatan Waktu (Freshness)** | Apakah data cukup mutakhir untuk kebutuhan analitik saat ini? | Catatan transaksi pesanan paling baru berumur kurang dari 24 jam yang lalu |
| **Integritas Referensial (Integrity)** | Apakah relasi antar entitas tetap utuh dan valid? | Setiap `customer_id` di tabel transaksi ada di tabel dimensi pelanggan |

Mengapa standarisasi dimensi ini sangat krusial? Bagi seorang data analyst atau pengambil keputusan bisnis, satu kali saja mereka menemukan angka anomali di dashboard analitik, mereka akan kehilangan kepercayaan pada seluruh platform data dan kembali menghitung metrik secara manual di spreadsheet pribadi. Model machine learning yang dilatih dengan data yang terduplikasi atau mengalami pergeseran distribusi akan mengalami penurunan performa secara hening tanpa melempar error. Dan yang terpenting: **biaya memperbaiki cacat data di hilir jauh lebih mahal daripada mencegahnya di hulu**. Kesalahan yang ditangkap di gerbang ingestion hanyalah satu baris yang masuk karantina; sedangkan kesalahan yang ditemukan oleh pelanggan atau direksi keuangan akan bermuara pada insiden perusahaan, revisi laporan keuangan publik, dan hancurnya reputasi tim data.

Dari mana asal rusaknya data? Sebagian besar masalah data berasal dari **perubahan di sistem hulu (upstream)** dan bukan dari bug kode pipeline Anda: tim backend merevisi format kolom tanpa pemberitahuan, deployment rilis baru menyisipkan bug transaksional, mitra payment gateway terlambat mengirim batch file, atau definisi bisnis yang berbeda antar divisi. Seorang data engineer tidak bisa menghentikan seluruh perubahan di dunia, tetapi ia bisa memastikan seluruh anomali menjadi **terlihat seketika, terdeteksi sedini mungkin, dan memiliki kepemilikan yang jelas**.

## @lesson Pertahanan berlapis (defence in layers)
Tidak ada satu jenis assertion pun yang mampu menangkap semua ragam cacat data. Oleh karena itu, arsitektur kualitas data dibangun menggunakan strategi **pertahanan berlapis (defence in layers)** dengan prinsip **shift left**: tangkap masalah sedekat mungkin dengan sumber asalnya sebelum mencemari lapisan data lakehouse berikutnya.

| Lapisan (Layer) | Tanggung Jawab Operasional | Apa yang Ditangkap | Perkakas (Tools) |
|---|---|---|---|
| **1. Source Agreement (Contract)** | Tim produsen dan tim konsumen menyepakati struktur skema dan semantik secara tertulis; produsen menguji kontrak di CI mereka sebelum deploy | Breaking changes *sebelum* kode baru dirilis ke produksi | Data contracts, schema registries, automated CI di sisi producer |
| **2. Ingestion Gate** | Memvalidasi payload data yang masuk terhadap kontrak; mengkarantina baris cacat; membatalkan seluruh proses jika rasio error melampaui batas toleransi | Nilai korup, perubahan tipe data mendadak, kolom wajib yang hilang | Validasi Python (Modul 1.2), Pydantic, Great Expectations, Soda |
| **3. Transformation Tests** | Menguji ekspektasi bisnis di setiap layer model transformasi: keunikan primary key, foreign key integrity, aturan logika bisnis | Duplikasi akibat fan-out join SQL, bug logika transformasi, relasi data terputus | dbt data tests (Modul 2.3), query rekonsiliasi |
| **4. Observability Monitoring** | Memantau karakteristik dataset secara holistik pasca-load: anomali kesegaran waktu, lonjakan/penurunan volume, drift skema, dan pergeseran distribusi | Masalah sistemik yang tidak tertulis di dalam unit test | Deteksi anomali statistik, platform data observability |
| **5. Human Process & Governance** | Kepemilikan dataset eksplisit, perutean alert on-call, dokumentasi runbook perbaikan, dan evaluasi pasca-insiden (post-mortem) | Masalah tersembunyi yang lolos dari seluruh filter otomatis | Tim on-call, proses eskalasi insiden, kesepakatan SLA |

Dua hukum fundamental yang wajib Anda pegang teguh: Pertama, **unit test menangkap masalah yang sudah Anda antisipasi di pikiran Anda; monitoring menangkap anomali yang sama sekali tidak terpikirkan sebelumnya.** Test skema kolom tidak akan pernah berbunyi jika sepertiga transaksi tiba-tiba menghilang karena bug di payment gateway; tetapi volume monitor akan langsung membunyikan alarm. Kedua, **sebuah pengecekan kualitas hanya berguna jika ia terhubung ke tindakan nyata**: test yang gagal namun diabaikan di kanal Slack hanyalah hiasan visual. Tentukan untuk setiap check: apakah ia harus *memblokir (block)* pipeline agar data busuk tidak menyebar ke dashboard, memberi *peringatan (warn)* dan lanjut jalan, atau sekadar dicatat ke dalam log audit.

Dalam lab modul ini, Anda akan membangun layer 1 hingga 4 secara mandiri ke dalam sebuah arsitektur quality gate yang utuh.

## @lesson Data contracts: tuliskan kesepakatan secara eksplisit
**Data contract** adalah kesepakatan formal yang terikat versi antara **data producer** (misalnya tim backend checkout) dan **data consumers** (tim data platform dan analitik). Tanpa kontrak tertulis, tim backend dapat mengubah nama kolom `order_status` menjadi `status_code` sesuka hati dan baru menyadarinya seminggu kemudian saat menerima email kemarahan dari pimpinan bisnis. Dengan data contract, rencana perubahan tersebut wajib didiskusikan dan diuji otomatis di CI sebelum kode backend di-merge ke master.

Sebuah data contract memuat komponen penting:

- **Skema (Schema)**: nama-nama kolom, tipe data presisi, status wajib (required/nullable), serta batasan nilai (minimum/maximum, allowed values, regex format, dan syarat keunikan).
- **Semantik Bisnis (Semantics)**: definisi logis dari makna setiap field (apakah `total_idr` sudah memperhitungkan diskon voucher? apakah `order_ts` disimpan dalam UTC atau waktu lokal WIB?). Banyak bencana data terjadi bukan karena tipe data salah, melainkan karena salah tafsir semantik.
- **Service Level Agreements (SLAs)**: target kesegaran data ("data mendarat maksimal 24 jam setelah pesanan dibuat"), batas kelengkapan volume, dan ketersediaan feed.
- **Kepemilikan (Ownership)**: siapa tim atau engineer pemilik data tersebut dan kontak darurat eskalasi.
- **Aturan Versioning**: bagaimana pengumuman deprecation dilakukan dan batasan mana saja yang dikategorikan sebagai breaking changes.

Kontrak data pada lab modul ini didefinisikan dalam format YAML mesin yang dibaca langsung oleh kode validasi:

```yaml
name: orders
version: 1.0.0
owner: checkout-team
fields:
  - name: order_id
    type: integer
    required: true
    unique: true
    minimum: 1
  - name: status
    type: string
    required: true
    allowed: [paid, shipped, delivered, cancelled, refunded]
  - name: total_idr
    type: integer
    required: true
    minimum: 1
sla:
  freshness_hours: 24
  max_reject_rate: 0.10
```

Karena file kontrak berbentuk *machine-readable*, artefak ini dapat mengendalikan **kedua belah pihak secara simetris**: pipeline CI milik tim backend menjalankan linter untuk memastikan payload API atau event keluaran mereka tidak melanggar kontrak, sementara ingestion gate di pipeline milik tim data memverifikasi setiap file yang masuk terhadap kontrak yang sama. (Inisiatif industri seperti *Open Data Contract Standard* dan spesifikasi *datacontract CLI* menyediakan standar terbuka untuk format ini; lab modul ini menggunakan format minimalis agar Anda memahami setiap roda penggeraknya).

**Breaking vs Non-Breaking Changes.** Menambahkan kolom opsional baru umumnya bersifat non-breaking (kompatibel). Namun menghapus kolom, mengubah nama field, mengganti tipe data dari integer ke string, mempersempit daftar nilai yang diizinkan, atau mengubah arti definisi bisnis adalah **breaking change**. Tindakan ini mewajibkan peningkatan versi major (misalnya 1.x ke 2.0), periode transisi adaptasi, dan migrasi terencana. Terapkan semantic versioning: patch untuk bug fix dokumentasi, minor untuk penambahan kolom yang kompatibel, dan major untuk perubahan breaking.

Data contract bukan alat untuk saling melempar kesalahan, melainkan sarana untuk membuat **ekspektasi antar tim dapat diuji secara otomatis**. Kontrak ini hanya akan berhasil jika tim produsen menganggap kualitas data sebagai bagian dari kriteria "Definition of Done" fitur mereka.

> 💡 **Jeda Praktik 1 (Mendefinisikan Data Contract YAML):**
> 1. Buka teks editor Anda (VS Code / Cursor), lalu buka file `labs/mod-2-5/contracts/orders.yaml` (ingat: jangan mengeksekusi file `.yaml` langsung di bash terminal).
> 2. Lengkapi spesifikasi kontrak: tetapkan `name: orders`, `version: 1.0.0`, `owner: checkout-team`, dan deklarasikan 6 field (`order_id`, `customer_id`, `order_ts`, `status`, `payment_method`, `total_idr`) beserta batasan nilai dan SLA (`freshness_hours: 24`, `max_reject_rate: 0.10`).
> 3. Uji keabsahan kontrak data di terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestContractFile -v`
> 4. **Indikator Sukses:** Seluruh tes `TestContractFile` berstatus `PASSED` membuktikan kontrak valid dan lengkap.

## @lesson Ingestion gate: ketat di pintu masuk, karantina data yang gagal
Di perbatasan gerbang penyerapan (ingestion boundary), terapkan validasi **secara ketat** terhadap spesifikasi kontrak data, dan alihkan setiap baris yang cacat ke **tabel karantina (quarantine)** lengkap beserta alasan spesifik kegagalannya (mengadopsi pola dari Modul 1.2). Sikap ketat di lapisan ini sangat disengaja: jika kontrak menetapkan bahwa `total_idr` bertipe integer, maka kemunculan nilai teks seperti `"Rp 1.250.000"` adalah pelanggaran kontrak yang harus dilaporkan kembali ke produsen, bukan sesuatu yang ditebak-tebak secara diam-diam. Proses parsing dan standardisasi untuk ketidakteraturan yang sudah dimaklumi adalah tugas eksplisit dari staging layer (Modul 2.3).

Ketika dieksekusi terhadap file transaksi KopiKu (3.634 baris), quality gate lab modul ini menghasilkan ringkasan berikut:

| Hasil Evaluasi | Jumlah Baris |
|---|---|
| Valid | 3.394 baris |
| Masuk Karantina | 240 baris (6,6%) |
| rincian: status di luar nilai yang diizinkan (`PAID`, `Shipped`...) | 112 kasus |
| rincian: timestamp bukan format ISO standar (`31/01/2026 14:03`) | 41 kasus |
| rincian: total bukan bilangan bulat (`Rp 1.250.000`) | 37 kasus |
| rincian: duplikasi primary key `order_id` | 33 kasus |
| rincian: nilai total di bawah batas minimum (negatif) | 17 kasus |

Perhatikan apa yang Anda peroleh dari arsitektur ini: **daftar masalah yang terukur, konkret, dan terklasifikasi rapi untuk dilaporkan kembali ke tim backend produsen**, bukan lagi sekadar komplain abstrak bahwa "datanya berantakan". Setiap baris di karantina membawa metadata alasan penolakannya sendiri, memudahkan teknisi manusia untuk memutuskan apakah data tersebut harus diperbaiki, diminta kirim ulang, atau dihapus secara aman.

Prinsip perancangan ingestion gate produksi:

- **Catat seluruh error pada setiap baris**, bukan hanya error pertama yang ditemukan, agar tim produsen dapat memperbaiki semua cacat data dalam satu siklus rilis.
- **Baris yang ditolak tidak boleh menghanguskan keunikan primary key.** Jika sebuah baris dengan `order_id = 5` ditolak karena status tidak valid, baris berikutnya yang valid dengan id yang sama tidak boleh dituduh sebagai duplikat. (Pengujian lab modul ini menguji skenario halus ini secara khusus).
- **Gunakan ambang batas (threshold) untuk mengubah rasio error menjadi keputusan operasional.** Sebagian kecil baris cacat (beberapa persen) adalah hal lazim dan cukup dialirkan ke karantina; namun jika **rasio penolakan (reject rate)** melampaui batas SLA kontrak (misalnya 10%), maka keseluruhan feed dianggap rusak sistemik dan **seluruh proses load harus digagalkan seketika** daripada membiarkan tabel analytical downstream terisi data yang compang-camping.
- **Urutan evaluasi berjenjang (Fail-Fast).** Jika skema struktural sudah menyimpang (seperti nama kolom utama hilang), pengecekan level baris tidak ada gunanya: segera hentikan proses dengan pesan kegagalan skema yang jelas.
- **Simpan bukti historis**: tulis file karantina dan laporan ringkasan evaluasi di setiap siklus run agar tren anomali kualitas data dapat dipantau dari waktu ke waktu.

> 💡 **Jeda Praktik 2 (Membangun Ingestion Gate & Karantina):**
> 1. Buka file `labs/mod-2-5/quality.py` di teks editor Anda.
> 2. Implementasikan fungsi `load_contract(path)` dan `validate_rows(rows, contract)`: periksa secara ketat aturan field (missing, wrong type, minimum, allowed, duplicate) dan masukkan baris bermasalah ke list `quarantined` beserta daftar errornya.
> 3. Uji validasi baris di terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestValidateRows -v`
> 4. **Indikator Sukses:** Sebanyak 13 tes berstatus `PASSED`, memverifikasi bahwa 3.394 baris valid diterima dan 240 baris cacat dikarantina dengan pesan error yang presisi.

## @lesson Monitoring: freshness, volume, schema, dan distribution
Pengecekan di tingkat baris (row-level checks) hanya mampu memeriksa data per satu baris individual. **Pemantauan di tingkat dataset (dataset-level monitoring)** mengamati *karakteristik bentuk dari keseluruhan pengiriman data* dan mampu mendeteksi anomali berbahaya di mana setiap baris tampak valid secara individu namun secara kolektif salah total. Inilah pilar utama dari **observabilitas data (data observability)**:

1. **Freshness (Kesegaran)**: seberapa baru timestamp data paling mutakhir? `check_freshness(latest, now, 24h)`. Mendeteksi upstream pipeline yang macet atau job pengiriman data pihak ketiga yang diam-diam berhenti berjalan.
2. **Volume**: berapa jumlah total baris yang tiba dibandingkan dengan pola normal historis? Mendeteksi bug produsen yang memotong segmen pelanggan tertentu, file terpotong parsial saat upload, atau job producer yang berulang tanpa kendali.
3. **Skema (Schema Drift)**: apakah ada kolom yang dihapus, berganti nama, atau berubah tipe datanya? Mendeteksi perubahan skema sebelum query analitik di warehouse mengalami runtime error.
4. **Distribusi (Distribution Shift)**: apakah *konten proporsional* di dalam kolom mengalami pergeseran drastis? Misalnya proporsi status pesanan, rasio nilai NULL pada kolom tertentu, atau rentang nilai numerik. Mendeteksi bug halus di mana nilai fallback darurat membanjiri sebuah kolom.
5. **Data Lineage**: memetakan asal-usul tabel dan job hulu yang memberi makan tabel ini, serta laporan hilir apa saja yang bergantung padanya. Lineage menjadi fondasi agar 4 pilar di atas dapat ditindaklanjuti secara efektif.

**Pengecekan volume membutuhkan pendekatan statistik robust.** Pendekatan buku teks pemula sering kali menggunakan aturan batas 3 kali standar deviasi dari rata-rata ($mean \pm 3\sigma$). Kelemahan fatalnya: nilai mean dan standard deviation sangat rentan terdistorsi oleh data ekstrem di masa lalu (outliers), sehingga satu hari abnormal di masa lalu akan merentangkan batas toleransi menjadi terlampau lebar hingga anomali nyata di masa depan lolos tanpa terdeteksi. Alternatif yang tangguh (robust) adalah menggunakan nilai **Median** dan **MAD (Median Absolute Deviation)**:

```text
spread = max(1.4826 * MAD, 5% of median, 1)     # 1.4826 membuat skala MAD setara dengan standar deviasi normal
band   = median ± 3 * spread
```

Pada dataset lab modul ini, data historis 14 hari sebelum hari terakhir memiliki nilai median 113,5 pesanan. Batas toleransi yang dihasilkan berada pada rentang **96,5 hingga 130,5 pesanan**; hari terakhir mencatat 115 pesanan (lulus verifikasi). Ketika 40% pesanan pada hari tersebut dihapus dalam simulasi pengujian, volume anjlok menjadi sekitar 69 pesanan dan langsung tertangkap oleh monitor volume sebagai anomali. Pengujian lab juga membuktikan ketangguhan metode ini: pada riwayat data `[120] * 13 + [1200]` (terdapat satu hari outlier ekstrem 1.200), aturan rata-rata konvensional akan meloloskan angka anomali 400 sebagai batas wajar; sedangkan metode Median-dan-MAD tetap menolaknya dengan tepat. Batas minimum penahan (`5% of median`, `1`) mencegah ambang batas menyusut menjadi nol saat data historis bersifat konstan sempurna.

Panduan praktis lapangan:

- **Perhatikan Pola Musiman (Seasonality).** Volume transaksi hari Sabtu tentu berbeda dengan hari Selasa. Bandingkan volume data dengan hari yang sama di minggu-minggu sebelumnya, atau gunakan model baseline harian agar tim on-call Anda tidak terbangun oleh alarm palsu setiap akhir pekan.
- **Deteksi Pergeseran Distribusi (Distribution Shift)** dapat dihitung dengan mudah menggunakan rumus **Total Variation Distance** antara dua distribusi kategori: setengah dari jumlah selisih absolut persentase proporsi. Nilainya bergerak dari 0 (identik sempurna) hingga 1 (berbeda total). Sebagai contoh, perbandingan `{paid: 0.8, cancelled: 0.2}` terhadap `{paid: 0.6, cancelled: 0.4}` menghasilkan nilai TVD sebesar 0,2: menandakan 20% distribusi status mengalami pergeseran yang layak untuk diinvestigasi.
- **Kelelahan Notifikasi (Alert Fatigue) adalah musuh utama.** Banjir peringatan yang terlalu berisik akan melatih manusia untuk mengabaikannya, hingga akhirnya insiden bencana nyata luput dari perhatian. Mulailah dengan sedikit assertions bernilai tinggi, tetapkan level keparahan yang jelas (`block` vs `warn`), sertakan pesan kontekstual yang dapat ditindaklanjuti ("volume pada 2026-01-30 adalah 69, batas ekspektasi 96 hingga 130"), dan evaluasi ambang batas setiap kali terjadi false alarm.

> 💡 **Jeda Praktik 3 (Pemeriksaan Statistik Monitoring Dataset):**
> 1. Buka file `labs/mod-2-5/quality.py` di teks editor Anda.
> 2. Implementasikan empat fungsi monitoring: `check_schema(header, contract)`, `check_freshness(latest, now, max_age_hours)`, `volume_anomaly(history, today, k=3.0)` menggunakan Median dan MAD dengan ambang batas bawah, serta `distribution_shift(before, after)` menggunakan rumus Total Variation Distance.
> 3. Uji seluruh fungsi monitoring di terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestSmallChecks -v`
> 4. **Indikator Sukses:** Seluruh 6 tes `TestSmallChecks` berstatus `PASSED` mengonfirmasi keandalan deteksi statistik terhadap drift dan anomali.

## @lesson Lineage, perkakas pendukung, dan level layanan (SLA)
**Data Lineage** merekam jejak aliran data dari hulu ke hilir: dashboard eksekutif ini membaca data mart ini, yang dibangun dari model staging ini, yang bersumber dari tabel mentah ini, yang di-load oleh pipeline job ini. Lineage menjawab dua pertanyaan operasional paling kritis dalam insiden data: *Analisis Dampak (Impact Analysis)*: "Database sumber ini sedang offline, dashboard mana saja yang akan terdampak?" dan *Akar Masalah (Root Cause Analysis)*: "Angka pendapatan di laporan ini salah, dari baris data mana kesalahan ini bermula?". Orkestrator modern dan dbt memproduksi metadata lineage secara otomatis (Modul 2.3 dan 2.4), dan **OpenLineage** adalah standar terbuka universal untuk memancarkan metadata ini dalam bentuk event terstruktur:

```json
{ "eventType": "COMPLETE", "eventTime": "2026-01-31T02:10:00Z",
  "run":  { "runId": "3c1f..." },
  "job":  { "namespace": "kopiku", "name": "build_fct_order_items" },
  "inputs":  [ { "namespace": "warehouse", "name": "stg_orders" } ],
  "outputs": [ { "namespace": "warehouse", "name": "fct_order_items" } ] }
```

(Format di atas adalah representasi ringkas; event OpenLineage asli membawa metadata skema dan jumlah baris data). Di atas layer lineage, platform **Data Catalog** menambahkan dokumentasi kepemilikan tim, deskripsi bisnis, dan fitur pencarian metadata perusahaan.

**Ekosistem Perkakas (Tools).** Di dunia kerja nyata, Anda jarang membangun seluruh infrastruktur ini dari nol. Pustaka seperti *Great Expectations* dan *Soda* memungkinkan deklarasi assertions sebagai kode Python atau YAML deklaratif; *dbt data tests* mengamankan layer transformasi SQL; *pandera* memvalidasi skema DataFrame di memori; sementara *Elementary* serta platform observabilitas komersial (Monte Carlo, Acceldata) menyediakan deteksi anomali machine learning dan visualisasi lineage menyeluruh. Prinsip kerjanya identik dengan apa yang Anda pelajari di lab ini. Urutan adopsi yang rasional: mulai dari dbt tests dan ingestion quality gate sederhana, tambahkan pemantauan anomali volume pada tabel paling kritis, dan baru adopsi platform enterprise ketika pemeliharaan manual mulai membebani tim.

**Service Levels untuk Data.** Mengadopsi prinsip keandalan Site Reliability Engineering (SRE): **SLI (Service Level Indicator)** adalah metrik yang diukur secara nyata (misalnya, jumlah jam sejak pesanan transaksi terbaru tiba), **SLO (Service Level Objective)** adalah target operasional yang disepakati bersama ("keterlambatan di bawah 24 jam untuk 99% dari total hari dalam sebulan"), dan **SLA (Service Level Agreement)** adalah komitmen legal kontraktual yang memiliki konsekuensi nyata jika dilanggar. Konsep ini mengubah kualitas data dari harapan angan-angan menjadi parameter terukur yang dapat dinegosiasikan. Pantau metrik **data downtime** (durasi di mana data rusak atau hilang) serta waktu deteksi (MTTD) dan pemulihan (MTTR). Tetapkan **data ownership** eksplisit untuk setiap dataset penting: tim mana yang bertanggung jawab dan siapa yang harus dipanggil saat alarm berbunyi.

## @lesson Ketika sistem rusak: manajemen respons insiden
Insiden cacat data pasti akan terjadi di lingkungan produksi suatu hari nanti. Hal yang membedakan tim rekayasa data matang dari tim amatir adalah cara mereka merespons insiden tersebut:

1. **Deteksi (Detect).** Pemantauan otomatis mendeteksi anomali dan mengirimkan peringatan sebelum pengguna bisnis menyadarinya. Ukur seberapa sering pengguna komplain *sebelum* sistem Anda sendiri membunyikan alarm: itulah celah deteksi (detection gap) Anda.
2. **Triase (Triage).** Seberapa parah dampaknya? Siapa saja pengguna dan dashboard yang terpengaruh (manfaatkan data lineage)? Apakah data busuk masih terus mengalir masuk? Hentikan pendarahan terlebih dahulu: jeda sementara pipeline hilir atau pasang banner peringatan di dashboard terdampak agar keputusan bisnis tidak diambil berdasarkan angka yang salah.
3. **Komunikasi (Communicate).** Beri tahu para pemangku kepentingan secara proaktif, lugas, dan transparan: apa masalah yang terjadi, laporan mana yang terdampak, langkah mitigasi yang sedang dilakukan, dan kapan pembaruan status berikutnya akan diberikan. Kepercayaan bisnis tetap terjaga jika bug diumumkan secara terbuka; namun kepercayaan akan runtuh total jika bug ditemukan sendiri oleh pengguna.
4. **Perbaikan Data (Fix and Repair).** Perbaiki akar masalah pada kode atau koordinasikan dengan tim hulu, kemudian **pulihkan integritas data**: jalankan kembali komputasi partisi data yang terdampak (di sinilah arsitektur pipeline idempoten dari Modul 2.4 membuktikan nilainya yang tak ternilai) dan verifikasi kebenaran angka melalui query rekonsiliasi.
5. **Evaluasi Pembelajaran (Learn).** Gelar sesi **blameless post-mortem** singkat: susun kronologi kejadian, evaluasi dampak bisnis, cari akar masalah fundamental, analisis mengapa sistem terlambat mendeteksi, serta tetapkan tindakan pencegahan konkret lengkap dengan penanggung jawabnya (tambahkan klausul kontrak baru, pasang assertion test baru, atau sesuaikan ambang batas alert). Fokuskan evaluasi pada kelemahan sistem, bukan mencari kambing hitam individu.

Tiga kebiasaan yang mempermudah penanganan insiden: miliki dokumen **runbook** untuk setiap dataset kritikal (cara memeriksa kesehatan data, prosedur eksekusi ulang, dan eskalasi); simpan riwayat **karantina dan laporan evaluasi** di setiap run agar waktu awal terjadinya masalah dapat dilacak dengan presisi; serta tambahkan **regression check** baru untuk setiap insiden masa lalu agar bug yang sama tidak akan pernah terulang kembali di masa depan.

> 💡 **Jeda Praktik 4 (Orkestrasi Quality Gate & Penanganan Insiden):**
> 1. Buka file `labs/mod-2-5/quality.py` di teks editor Anda.
> 2. Implementasikan fungsi `run_gate(orders_csv, contract_yaml, out_dir, now=None)`: jalankan evaluasi berjenjang (periksa skema, validasi baris, kesegaran data, dan volume), tulis `orders_valid.ndjson` serta `quarantine.ndjson`, dan kembalikan ringkasan status (`pass`, `warn`, atau `fail`).
> 3. Uji perilaku orkestrasi di terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestRunGate -v`
> 4. **Indikator Sukses:** Seluruh 5 tes `TestRunGate` berstatus `PASSED` membuktikan gerbang menghentikan proses saat skema berubah atau reject rate melampaui SLA.

## @lab Lab: membangun data quality gate
Tulis spesifikasi data contract resmi untuk feed transaksi pesanan KopiKu dan implementasikan quality gate Python yang menegakkannya secara ketat: validasi integritas baris data dengan isolasi karantina, deteksi pergeseran skema (schema drift), pemantauan kesegaran data (freshness), pemantauan volume anomali berbasis Median-dan-MAD, serta kalkulasi pergeseran distribusi (Total Variation Distance). Sebanyak 26 pengujian otomatis akan memverifikasi setiap fungsi dan menguji keandalan gerbang Anda terhadap variasi data yang sengaja dirusak.

### @steps
1. Instal dependensi dan buat data simulasi awal, lalu baca spesifikasi pengujian terlebih dahulu untuk memahami ekspektasi perilakunya:

```bash
python -m pip install -r labs/mod-2-5/requirements.txt
python3 labs/shared/shopgen.py --out data
pytest labs/mod-2-5 -v          # pengujian akan gagal pada awalnya
```

2. **Tulis Data Contract.** Buka file `labs/mod-2-5/contracts/orders.yaml`. Header file telah mencantumkan enam kolom dan aturan validasinya; lengkapi blok `fields:` dan blok `sla:`. Aturan yang salah atau terlewat akan memicu kegagalan pada unit test, jadikan pesan test sebagai panduan perbaikan.
3. Buka `labs/mod-2-5/quality.py` dan implementasikan fungsi `load_contract` serta `validate_rows`. Terapkan validasi secara ketat. Kembalikan seluruh error pada setiap baris sesuai format pesan yang ditentukan pada docstring, pertahankan urutan data input, dan pastikan baris yang ditolak tidak menghanguskan keunikan primary key.
4. Implementasikan fungsi-fungsi pengecekan modular: `check_schema`, `check_freshness`, `volume_anomaly` (menggunakan rumus Median dan MAD beserta nilai batas bawahnya), serta `distribution_shift` (Total Variation Distance).
5. Implementasikan fungsi orkestrasi gerbang `run_gate`, yang menjalankan pengecekan secara berurutan (skema, kontrak baris, freshness, volume), menghasilkan output file `orders_valid.ndjson` dan `quarantine.ndjson`, serta mengembalikan laporan evaluasi berstatus `pass`, `warn`, atau `fail`. Hentikan eksekusi segera pada kegagalan pertama.
6. Jalankan rangkaian pengujian otomatis. Kemudian **eksekusi quality gate Anda terhadap data transaksi nyata**, baca file laporannya, dan amati beberapa baris pertama file karantina beserta statistik alasan penolakannya.

> 💡 **Jeda Praktik 5 (Verifikasi Menyeluruh & Inspeksi Karantina):**
> 1. Jalankan seluruh suite pengujian otomatis di terminal:
>    `pytest labs/mod-2-5 -v`
> 2. Amati hasil evaluasi: 26 tes berhasil diverifikasi dalam waktu sekitar 1 detik.
> 3. **Indikator Sukses:** Seluruh 26 pengujian di `test_lab.py` berstatus `PASSED` (100% lulus).

7. Lakukan eksperimen mandiri dengan merusak file data dan perhatikan respons sistem: ubah nama satu kolom, hapus 40% data pada hari terakhir, ganti 25% nilai total menjadi format teks `Rp ...`, dan majukan waktu `now` sebanyak tiga hari. Untuk setiap skenario, evaluasi apakah pesan status yang dihasilkan memberi instruksi yang jelas bagi engineer on-call.
8. Tantangan lanjutan (stretch goals): tambahkan pengecekan rasio nilai NULL per kolom; bandingkan volume hari terakhir terhadap hari yang sama pada minggu sebelumnya; tulis ulang spesifikasi kontrak ke format Open Data Contract Standard; tambahkan argumen CLI `--now` beserta kode exit (0 pass, 1 warn, 2 fail) agar gate dapat diintegrasikan ke dalam orkestrator seperti Airflow atau Dagster.

### @files
- labs/mod-2-5/contracts/orders.yaml :: File kontrak data: lengkapi aturan kolom dan konfigurasi SLA :: starter
- labs/mod-2-5/quality.py :: File implementasi kerja: fungsi-fungsi quality gate yang harus dibangun :: starter
- labs/mod-2-5/test_lab.py :: Suite pengujian otomatis yang mencakup 26 skenario pengujian :: test
- labs/mod-2-5/requirements.txt :: Konfigurasi dependensi pyyaml dan pytest :: config
- labs/mod-2-5/reference/contracts/orders.yaml :: Referensi kontrak data lengkap (coba kerjakan mandiri terlebih dahulu!) :: reference
- labs/mod-2-5/reference/quality.py :: Referensi implementasi quality gate :: reference

### @deliverables
- Seluruh 26 pengujian di `test_lab.py` lulus dengan sukses
- Quality gate Anda pada file data riil melaporkan 3.394 baris valid dan 240 baris karantina dengan lima kategori alasan penolakan yang sesuai dengan materi modul
- Mampu menjelaskan alasan matematis mengapa pengecekan volume menggunakan Median dan MAD, serta apa yang diinformasikan oleh keempat eksperimen data rusak kepada insinyur on-call

### @verify
```bash
pytest labs/mod-2-5 -v
```

Verifikasi terhadap solusi referensi: `LAB_DIR=reference pytest labs/mod-2-5 -v`.

## @chaos Bug checkout yang lolos dari semua pengujian
### @scenario
Sebuah pembaruan fitur pada alur checkout aplikasi belanja menyisipkan bug fatal: transaksi dari pelanggan internasional selalu gagal pada tahapan pembayaran sehingga rekaman pesanan tidak pernah terbuat di database. Namun transaksi dari pelanggan domestik berjalan normal tanpa kendala. Seluruh data pesanan yang *berhasil* masuk ke database memiliki kualitas yang sempurna: tipe data akurat, status valid, ID unik, dan nominal total bernilai positif. Akibatnya, job ingestion harian melaporkan status sukses hijau, seluruh assertion test dbt lulus sempurna, dan validasi data contract tidak menolak satu baris pun.

Empat hari kemudian, tim finance menyadari bahwa total pendapatan harian merosot sekitar sepertiga dan menanyakan apakah terjadi penurunan daya beli pasar secara tiba-tiba. Sementara itu, tim marketing sudah terlanjur memangkas anggaran iklan karena mengira efektivitas kampanye internasional mereka gagal.

### @cause
Semua data yang mendarat di database memang berstatus valid; namun kegagalan fatal terletak pada data yang *tidak pernah tiba sama sekali*. Pengecekan di tingkat baris dan assertion skema hanya mengevaluasi data yang ada; instrumen tersebut buta terhadap ketiadaan data. Pipeline tidak dilengkapi pemantauan volume yang membandingkan jumlah transaksi harian terhadap pola historis wajar, sehingga penurunan volume sebesar sepertiga berlangsung tanpa terdeteksi selama empat hari sementara keputusan strategis bisnis terlanjur dibuat berdasarkan data cacat tersebut. Status "sukses" pada pipeline hanyalah pertanda bahwa kode berjalan tanpa crash, bukan jaminan bahwa data yang tiba telah lengkap.

### @fix
1. Tambahkan **pemantauan anomali volume** pada feed pesanan (menggunakan statistik Median dan MAD dibandingkan terhadap hari yang sama pada minggu sebelumnya) yang memancarkan peringatan **warn** dalam hitungan jam. Di lab praktikum, penurunan volume 40% langsung tertangkap oleh batas wajar 96 hingga 130 pesanan.
2. Pasang **pemeriksaan pergeseran distribusi** pada segmentasi pesanan (proporsi pesanan domestik vs internasional) sehingga lenyapnya transaksi internasional akan langsung terdeteksi sebagai anomali pergeseran distribusi.
3. Perbaiki bug pada alur checkout aplikasi backend, lalu **pulihkan rekaman pesanan yang hilang** dari catatan log percobaan payment gateway dan proses ulang (reprocess) data partisi untuk hari-hari yang terdampak.
4. Publikasikan revisi laporan analitik yang terdampak, komunikasikan insiden secara transparan kepada seluruh pemangku kepentingan (termasuk tim marketing), dan pasang threshold alert terpadu pada metrik volume transaksi harian.
5. Susun dokumen blameless post-mortem dengan kesepakatan tegas: setiap feed data yang berdampak kritikal pada bisnis wajib dipasangi monitor volume dan kesegaran data (freshness) sebelum dinyatakan siap tayang di produksi.

### @pattern
Unit test mengevaluasi keabsahan data yang tiba; monitoring mengevaluasi apakah data yang seharusnya tiba benar-benar hadir. Sebuah pipeline produksi kelas dunia membutuhkan kedua pilar tersebut secara seimbang.

## @quiz
### Dimensi kualitas data mana yang terutama diuji oleh pemeriksaan "jumlah pesanan kemarin berada di dalam rentang normal"?
- [ ] Keunikan (Uniqueness), karena pengidentifikasi pesanan harus berbeda untuk setiap pesanan dalam feed
- [ ] Validitas (Validity), karena setiap kolom harus mematuhi format dan rentang nilai yang diizinkan
- [x] Kelengkapan (Completeness), karena data hilang hanya terlihat jika dibandingkan dengan volume normal
- [ ] Integritas (Integrity), karena setiap pesanan harus merujuk ke data pelanggan yang ada di tabel master

> Pengecekan volume mendeteksi ketiadaan data (absence of data), hal yang mustahil dilihat oleh uji validitas atau keunikan di level baris. Ini adalah bentuk pengecekan kelengkapan data (dan observabilitas).

### Apa manfaat paling mendasar dari penerapan data contract antara tim produsen dan tim konsumen?
- [ ] Membuat query analitik di data warehouse berjalan jauh lebih cepat karena kedua tim menggunakan konvensi penamaan yang sama
- [ ] Menghilangkan kebutuhan untuk melakukan pengujian data karena kontrak itu sendiri menjamin data sudah bersih
- [x] Membuat ekspektasi kedua pihak eksplisit dan dapat diuji otomatis, sehingga breaking change dibahas sebelum rilis
- [ ] Mengalihkan seluruh beban tanggung jawab kualitas data dari tim produsen ke pundak tim konsumen data

> Kontrak mendokumentasikan skema, semantik, SLA, dan kepemilikan dalam format machine-readable sehingga kedua belah pihak dapat mengujinya secara otomatis dan merencanakan perubahan secara terkoordinasi. Kontrak tidak menghilangkan perlunya pengujian data.

### Sebuah baris data memiliki nilai `status = "PAID"` sementara data contract hanya mengizinkan huruf kecil `paid`. Apa tindakan yang harus diambil oleh ingestion gate yang ketat?
- [ ] Mengubahnya secara diam-diam menjadi huruf kecil agar baris tersebut dapat langsung masuk ke data warehouse tanpa penundaan
- [x] Mengkarantina baris tersebut beserta alasan penolakannya, dan biarkan proses staging menormalisasi kasus yang diketahui secara terencana
- [ ] Menghapus baris data tersebut tanpa menyimpan catatan log apa pun karena status tersebut hanyalah perbedaan sepele pada huruf besar-kecil
- [ ] Menghentikan keseluruhan proses ingestion seketika karena satu nilai tidak valid sudah cukup untuk membuat feed tidak dapat digunakan

> Di perbatasan ingestion, pelanggaran kontrak dicatat alasannya dan baris dialihkan ke karantina. Pembersihan data untuk inkonsistensi yang sudah dimaklumi dilakukan secara eksplisit di lapisan staging. Menggagalkan seluruh load hanya dilakukan jika rasio penolakan melampaui batas toleransi.

### Mengapa aturan Median-dan-MAD jauh lebih unggul dibandingkan Rata-rata dan Standar Deviasi untuk pemantauan volume data?
- [ ] Jauh lebih hemat komputasi, yang sangat berdampak ketika riwayat data hanya memiliki sedikit angka pengamatan
- [ ] Selalu menghasilkan rentang ambang batas yang lebih sempit sehingga setiap perubahan kecil pada volume langsung terdeteksi
- [x] Outlier di masa lalu tidak melebarkan rentang toleransi, sehingga anomali nyata di masa depan tetap terdeteksi
- [ ] Dapat diterapkan langsung pada data kategorikal, sedangkan rata-rata dan deviasi hanya dapat bekerja pada angka numerik

> Nilai rata-rata dan standar deviasi sangat mudah ditarik oleh keberadaan outlier masa lalu, yang memperlebar ambang batas dan menyamarkan anomali di masa depan. Median dan MAD kebal terhadap distorsi outlier tersebut.

### Pipeline harian melaporkan sukses hijau dan seluruh test lulus, namun sepertiga pesanan tidak pernah sampai ke tabel target. Pengecekan mana yang paling mampu menangkap masalah ini?
- [ ] Pengecekan keunikan (uniqueness test) pada primary key pesanan di fact table data warehouse
- [ ] Pengecekan nilai yang diterima (accepted-values test) pada kolom status di model staging pesanan
- [x] Monitor anomali volume, yang membandingkan jumlah baris hari ini dengan pola historis normal
- [ ] Pengecekan nilai tidak kosong (not-null test) pada kolom identitas pelanggan saat data di-ingest

> Seluruh data yang berhasil tiba memang valid secara individu. Hanya perbandingan volume terhadap ekspektasi historis yang mampu mendeteksi ketiadaan baris data yang gagal terkirim.

### Apa arti nilai Total Variation Distance sebesar 0,2 antara dua distribusi status pesanan?
- [ ] Sebanyak dua puluh persen dari total baris pada pengiriman data terbaru ditolak oleh tahap validasi kontrak
- [ ] Pengiriman data terbaru memiliki total volume baris dua puluh persen lebih banyak dibandingkan pengiriman sebelumnya
- [x] Sekitar seperlima dari keseluruhan distribusi perlu digeser antar kategori agar kedua distribusi menjadi identik
- [ ] Kedua distribusi sudah cukup dekat untuk dianggap sama persis sehingga tidak memerlukan evaluasi manual lebih lanjut

> Total Variation Distance adalah setengah dari jumlah selisih absolut persentase proporsi: mencerminkan fraksi pergeseran distribusi. Nilai 0 berarti identik dan nilai 1 berarti berbeda sepenuhnya.

### Setelah insiden data berhasil ditangani dan diperbaiki, langkah apa yang wajib dilakukan paling akhir?
- [ ] Menghapus seluruh file karantina dan log error agar run berikutnya dapat dimulai dari kondisi yang benar-benar bersih
- [ ] Mengembalikan versi dashboard ke versi sebelumnya dan menutup tiket dukungan setelah semua pengguna diberi tahu
- [x] Menggelar blameless post-mortem dengan aksi konkret dan pemilik yang jelas, seperti check atau klausul kontrak baru
- [ ] Menghapus alert yang sempat berbunyi karena jika dibiarkan akan terus membunyikan alarm peringatan yang sama

> Pembelajaran menutup siklus insiden: identifikasi apa yang mendeteksi masalah, apa yang bisa mendeteksinya lebih cepat, dan tambahkan check, alert, atau aturan kontrak baru agar masalah serupa tertangkap secara otomatis di kemudian hari.

### Sebuah gerbang ingestion menolak 35% baris data dari suatu file kiriman, sementara kontrak hanya mentolerir maksimum 10%. Apa tindakan yang paling benar?
- [ ] Memasukkan 65% baris data yang valid ke database dan mengirimkan 35% sisanya ke karantina tanpa membunyikan alert apa pun sama sekali
- [x] Menggagalkan seluruh proses load dan membunyikan alarm insiden, karena feed itu kemungkinan besar rusak sejak dari sumbernya
- [ ] Menaikkan batas ambang toleransi pada kontrak menjadi 40% agar pengiriman kali ini lulus dan pipeline dapat terus berjalan
- [ ] Memperbaiki baris yang ditolak secara otomatis dengan menebak nilai yang dimaksud, lalu memuat seluruh data ke database

> Sebagian kecil baris cacat adalah hal rutin yang cukup masuk karantina. Namun rasio penolakan yang jauh melampaui batas kesepakatan menandakan kegagalan sistemik dari hulu, sehingga pipeline harus gagal secara eksplisit daripada mempublikasikan data yang rusak parah.

## @resources
- [Dokumentasi Great Expectations](https://docs.greatexpectations.io/)
- [Dokumentasi Soda](https://docs.soda.io/)
- [Spesifikasi OpenLineage](https://openlineage.io/)
- [Open Data Contract Standard](https://github.com/bitol-io/open-data-contract-standard)
- [Dokumentasi dbt: data tests](https://docs.getdbt.com/docs/build/data-tests)

