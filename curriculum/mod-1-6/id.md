---
title: Memasukkan Data: File, API, dan Database
duration: 2 minggu
summary: Pelajari bagaimana data sebenarnya masuk ke sebuah platform: memanggil API HTTP dengan autentikasi, membaca setiap halaman tanpa celah atau duplikat, bertahan dari rate limit dan kegagalan dengan retry dan backoff, memuat hanya yang baru dengan checkpoint, dan mendaratkan data mentah dengan aman sehingga pengulangan tidak pernah membuat duplikat. Anda membangunnya terhadap API palsu yang sengaja gagal.
why: Tutorial memanggil satu API sekali dan mencetak hasilnya. Ingestion sungguhan berjalan setiap malam terhadap layanan yang membagi halaman, membatasi Anda, timeout, dan berubah bentuk, dan kesalahan urutan dua baris bisa diam-diam menghilangkan pesanan satu hari penuh.
---

## @outcomes
- Menjelaskan cara umum data masuk ke platform (file, API, database, event) dan apa yang dijanjikan job ingestion yang tepercaya
- Membuat permintaan HTTP terautentikasi, membaca status code dan header, dan menjaga rahasia tetap di luar kode
- Membaca semua halaman API dengan pagination cursor atau offset, dan menjelaskan mengapa pagination offset bisa menduplikasi atau melewatkan record
- Menangani rate limit dan kegagalan dengan retry, exponential backoff, dan Retry-After, serta tahu apa yang tidak boleh diulang
- Membangun pemuatan inkremental yang idempoten dengan checkpoint yang ditulis dalam urutan yang benar
- Mendaratkan data mentah dengan metadata, meratakan JSON bersarang, dan mendeteksi schema drift

## @prereq
Modul 0.0 dan 1.2 (Python, error, idempotensi). Lab hanya butuh pustaka standar Python dan tidak butuh koneksi internet: tes menjalankan API palsu kecil di komputer Anda sendiri.

## @lesson Bagaimana data masuk ke platform
Semua yang dibangun data engineer dimulai dari **ingestion**: memindahkan data dari tempat ia dibuat ke tempat ia bisa dipakai. Sumbernya terbagi dalam empat keluarga:

- **File**: CSV, JSON, Parquet yang dijatuhkan di server, folder SFTP, atau penyimpanan cloud oleh mitra atau job ekspor.
- **API**: layanan (penyedia pembayaran, alat pemasaran, portal data terbuka pemerintah) yang Anda panggil lewat HTTP.
- **Database**: tabel di database operasional, dibaca secara bulk atau inkremental (Modul 3.2 membahas change data capture).
- **Event**: pesan dari Kafka, webhook, dan antrean (Modul 3.2).

Dua pilihan membentuk setiap job. **Pull atau push:** apakah Anda meminta data ke sumber sesuai jadwal (pull), atau sumber mengirim data ketika sesuatu terjadi (push, seperti pada webhook dan event)? **Penuh atau inkremental:** apakah Anda menyalin semuanya setiap kali (sederhana, benar, mahal seiring data tumbuh), atau hanya yang berubah sejak terakhir kali (murah, tetapi Anda harus melacak "sejak kapan" dan menangani pembaruan dan penghapusan)?

Apa yang dijanjikan **job ingestion yang tepercaya**, dan apa yang diajarkan modul ini untuk dibangun:

1. **Lengkap**: tidak ada record yang hilang, bahkan setelah crash atau rate limit.
2. **Tanpa duplikat, aman diulang**: menjalankannya dua kali menghasilkan hasil yang sama dengan sekali (idempotensi, Modul 1.2).
3. **Mentah dulu**: ia menyimpan apa yang diterima, tanpa diubah, sebelum pembersihan apa pun (kebiasaan ELT dari Modul 0.1), sehingga Anda bisa memproses ulang nanti tanpa memanggil sumber lagi.
4. **Teramati**: ia melaporkan berapa record yang diambil, berapa lama, berapa retry yang dibutuhkan, dan seberapa segar datanya.
5. **Sopan**: ia menghormati batas sumber dan gagal dengan jelas daripada menghantamnya.

Satu prinsip terakhir: sumber **tidak berada di bawah kendali Anda**. Ia bisa lambat, mengubah field-nya, mengembalikan error pukul 3 pagi, atau memblokir Anda karena penyalahgunaan. Kode yang ditulis seolah jaringan itu sempurna rusak di minggu pertama.

## @lesson API HTTP dalam sepuluh menit
API HTTP bekerja seperti halaman web untuk program. Anda mengirim **request** (metode seperti GET, sebuah URL, header, dan kadang body) dan menerima **response** (status code, header, dan body, biasanya JSON).

```text
GET /orders?limit=100&cursor=abc HTTP/1.1
Authorization: Bearer <token Anda>
Accept: application/json
```

**Status code** memberi tahu apa yang terjadi, dan kode Anda harus bereaksi berbeda untuk tiap keluarga:

| Kode | Arti | Apa yang dilakukan |
|---|---|---|
| 200 | OK | pakai body-nya |
| 400 | bad request: parameter Anda salah | perbaiki kode; mengulang percuma |
| 401, 403 | tidak terautentikasi, atau tidak diizinkan | perbaiki kredensial; jangan diulang |
| 404 | tidak ditemukan | perbaiki URL atau anggap "tidak ada data"; jangan diulang |
| 429 | **terlalu banyak permintaan**: Anda terkena rate limit | tunggu, lalu ulangi (lihat di bawah) |
| 500, 502, 503, 504 | server bermasalah | tunggu dan ulangi |

**Autentikasi** adalah cara API tahu siapa Anda: **API key** di header atau query string, **bearer token** (`Authorization: Bearer ...`), atau **OAuth**, tempat Anda menukar kredensial dengan token yang kedaluwarsa dan harus diperbarui. Apa pun metodenya, **kredensial adalah rahasia**: simpan di variabel lingkungan atau secret manager, jangan pernah di kode atau di Git (Modul 0.2), dan jangan di log. `build_request` di lab menaruh token di header, membangun URL dengan `urllib.parse.urlencode` dengan parameter terurut agar URL-nya bisa direproduksi, dan membuang parameter yang nilainya `None`.

Selalu pasang **timeout**. Tanpanya, koneksi yang menggantung memblokir job Anda selamanya. Masalah koneksi (server tidak terjangkau, reset, timeout) berbeda dari error HTTP: tidak ada status code, jadi Anda memperlakukannya seperti 5xx, sebagai sesuatu yang sementara.

Baca dokumentasi API untuk empat hal sebelum menulis kode: bagaimana **autentikasi** bekerja, bagaimana **pagination** bekerja, berapa **rate limit**-nya, dan bagaimana meminta **hanya perubahan** (parameter seperti `updated_since`). Banyak API diberi versi (`/v2/orders`); kunci versinya, karena perubahan tanpa pengumuman adalah cara job Anda rusak.

Anda bisa melakukan semua ini dengan pustaka standar Python (`urllib.request`), seperti di lab, atau dengan paket populer `requests`; gagasannya identik.

> 💡 **Jeda Praktik 1 (Konstruksi Request HTTP & Header Autentikasi):**
> Mulai bangun modul ingestion Anda dengan penyusunan request HTTP deterministik:
> 1. Buka file `labs/mod-1-6/ingest_lab.py` di Text Editor Anda (ingat: jangan dieksekusi langsung di bash!).
> 2. Implementasikan fungsi `build_request(url, token, params=None)`: buang parameter bernilai None, urutkan nama parameter dengan `urllib.parse.urlencode` (agar URL selalu konsisten), dan pasang header `Authorization: Bearer <token>` serta `Accept: application/json`.
> 3. Uji di terminal:
> `pytest labs/mod-1-6/test_lab.py -k TestBuildRequest -v`
> Ketika tes TestBuildRequest berstatus PASSED, lanjut ke Pelajaran 3 untuk menangani pagination dan retry jaringan!

## @lesson Membaca semua data: pagination, rate limit, dan retry
API tidak akan mengembalikan sejuta record sekaligus. Ia mengembalikan satu **halaman** dan memberi tahu cara mendapat yang berikutnya. Ada tiga gaya:

- **Pagination offset** (`?offset=20&limit=10`): sederhana, tetapi tidak aman pada data hidup. Jika record baru tiba saat Anda membaca, offset bergeser. Pada feed terbaru-dulu berisi 25 pesanan, membaca halaman 10 sementara 3 pesanan baru tiba setelah halaman pertama menghasilkan **28 baris diambil untuk 25 pesanan sebenarnya**: 3 duplikat (baris yang lebih lama bergeser ke halaman berikutnya). Baris yang dihapus menyebabkan kebalikannya, record terlewat. Ia juga lambat pada offset besar.
- **Nomor halaman** (`?page=3`): kelemahan yang sama.
- **Pagination cursor (keyset)** (`?cursor=abc`): setiap respons memuat `next_cursor` yang menandai persis di mana melanjutkan. Membaca feed yang sama dengan cara ini memberi 25 pesanan tanpa duplikat dan tanpa yang hilang. **Pilih cursor setiap kali API menyediakannya.** `fetch_all_cursor` di lab mengikuti `next_cursor` sampai tidak ada, dan `fetch_all_offset` memperlihatkan loop offset (berhenti ketika sebuah halaman lebih pendek dari `limit`; perhatikan bahwa ketika total adalah kelipatan pas dari `limit`, Anda butuh satu permintaan tambahan untuk melihat halaman kosong).

**Rate limit.** Untuk melindungi diri, API membatasi berapa banyak permintaan yang boleh Anda kirim, misalnya 100 per menit. Ketika Anda melampauinya, Anda menerima **429 Too Many Requests**, sering dengan header **`Retry-After`** yang menyatakan berapa detik harus menunggu. Respons yang sopan dan efektif adalah **menunggu selama itu persis**. Menghantam API membuat keadaan lebih buruk dan bisa membuat Anda diblokir.

**Retry dengan exponential backoff.** Jaringan dan server gagal sementara, jadi ulangi error yang *sementara* (429, 5xx, masalah koneksi), dan hanya itu. Setelah tiap kegagalan tunggu lebih lama: 1 detik, lalu 2, 4, 8, 16, dibatasi pada, misalnya, 30 (`backoff_delay` di lab: `min(cap, base * 2 ** (attempt - 1))`, menghasilkan 1, 2, 4, 8, 16, 30, 30). Penggandaan memberi server yang kewalahan waktu untuk pulih; di produksi tambahkan sedikit **jitter** acak agar seribu klien yang gagal bersamaan tidak semuanya mengulang pada saat yang sama. Pasang **batas jumlah retry**, dan ketika tercapai **gagal dengan lantang** dengan error terakhir, agar orkestrator (Modul 2.4) bisa memberi alert dan menjalankan ulang nanti. Jangan pernah mengulang 400, 401, 403, atau 404: jawabannya tidak akan berubah.

Mengulang hanya aman untuk operasi yang **idempoten**. GET yang membaca data adalah idempoten. POST yang membuat sesuatu bisa membuatnya dua kali jika percobaan pertama berhasil tetapi responsnya hilang; panggilan seperti itu butuh idempotency key bila API menyediakannya. Ingestion kebanyakan membaca, itulah mengapa ini kasus yang ramah.

Di lab Anda menguji semua ini terhadap **server HTTP sungguhan yang berjalan di komputer Anda**, yang menjawab 429 dengan `Retry-After` dan 500 sesuai permintaan. Fungsi `sleep` adalah parameter, sehingga tes mencatat waktu tunggu (1, 2, atau 7 detik) alih-alih benar-benar tidur. Merancang kode agar waktu dan jaringan bisa diganti saat tes adalah keterampilan tersendiri.

> 💡 **Jeda Praktik 2 (Resilient Network Fetching & Pagination):**
> Tangani fluktuasi jaringan, rate limit 429, dan pagination data:
> 1. Di `labs/mod-1-6/ingest_lab.py` pada text editor, implementasikan:
>    - `backoff_delay(attempt, base=1.0, cap=30.0)`: jeda eksponensial `min(cap, base * 2 ** (attempt - 1))`.
>    - `get_json(...)`: tangani retry pada 429 (baca header `Retry-After`), 5xx, dan connection error, tetapi langsung lempar `ApiError` untuk 4xx lainnya (401, 404).
>    - `fetch_all_cursor(...)`: telusuri seluruh halaman cursor sampai `next_cursor` bernilai None.
>    - `fetch_all_offset(...)`: loop pagination offset sampai jumlah record halaman < limit.
> 2. Uji di terminal:
> `pytest labs/mod-1-6/test_lab.py -k "TestBackoff or TestGetJson or TestPagination" -v`
> Ketika tes PASSED, lanjut ke Pelajaran 4 untuk mekanisme checkpoint pemuatan bertahap!

## @lesson Pemuatan inkremental dan checkpoint
Menyalin 5 tahun pesanan setiap malam itu boros. **Pemuatan inkremental** hanya mengambil yang baru atau berubah. Ia membutuhkan dua hal: parameter API seperti `updated_since`, dan sebuah **checkpoint** (disebut juga high-water mark atau watermark): titik sampai mana Anda sudah memuat, misalnya `updated_at` terbesar yang pernah Anda lihat.

Satu putaran lalu tampak seperti ini:

1. Baca checkpoint (tidak ada pada putaran pertama, yang memuat semuanya).
2. Ambil semuanya dengan `updated_since = checkpoint`.
3. **Tulis data ke tempat yang tahan lama.**
4. **Baru setelah itu** majukan checkpoint ke `updated_at` terbesar dari yang Anda ambil.

**Urutan langkah 3 dan 4 adalah baris terpenting modul ini.** Jika Anda menyimpan checkpoint lebih dulu dan penulisan kemudian gagal, putaran berikutnya mulai *setelah* data yang tidak pernah tersimpan: record-record itu hilang, diam-diam, selamanya. Dengan urutan yang benar, crash di antara 3 dan 4 hanya berarti putaran berikutnya mengambil record yang sama lagi, yang tidak berbahaya **jika pemuatannya idempoten**. Maka aturannya: *checkpoint hanya boleh menggambarkan data yang sudah tersimpan dengan aman.*

Cara membuat pemuatan idempoten:

- **Namai keluaran sesuai putaran** (`orders_<run_id>.jsonl`). Pengulangan putaran yang sama menimpa file yang sama, bukan menambah yang kedua.
- **Tulis secara atomik**: tulis file sementara di folder yang sama, lalu ganti namanya menimpa nama akhir (`os.replace`). File itu lengkap atau tidak ada, tidak pernah setengah tertulis. Lab menerapkan gagasan yang sama pada file checkpoint sendiri, sehingga crash tidak bisa meninggalkan checkpoint rusak.
- **Deduplikasi** berdasarkan id record, simpan versi dengan `updated_at` terbesar, karena record yang sama bisa muncul dua kali (pembaruan tiba di antara halaman).

Kasus tepi yang perlu dirancang. **Pembaruan**: record lama yang berubah punya `updated_at` baru, jadi ia muncul lagi, dan pemuatan Anda harus memperlakukannya sebagai versi baru (tes lab mengubah pesanan 3 menjadi "refunded"). **Penghapusan**: API berbasis `updated_since` biasanya tidak bisa memberi tahu bahwa sebuah record dihapus; cari flag soft-delete atau endpoint "deleted since", atau rekonsiliasi dengan pemuatan penuh sesekali, atau pakai change data capture (Modul 3.2). **Timestamp kembar dan pembaruan terlambat**: beberapa record bisa berbagi satu timestamp, dan jam berbeda, sehingga banyak tim membaca ulang jendela tumpang tindih kecil (beberapa menit terakhir) dan mengandalkan deduplikasi. **Tanpa `updated_since`**: kembali ke snapshot penuh dan bandingkan dengan yang sudah Anda miliki.

Checkpoint sendiri adalah state. Simpan di tempat tahan lama yang bertahan lebih lama dari mesin (file di penyimpanan cloud, sebuah tabel), dan buat mudah diperiksa dan di-reset untuk **backfill** (memuat ulang suatu periode dengan sengaja).

> 💡 **Jeda Praktik 3 (Penyimpanan State Checkpoint Atomik):**
> Amankan penanda high-water mark dari kegagalan crash sistem:
> 1. Di `labs/mod-1-6/ingest_lab.py` pada text editor, implementasikan kelas `Checkpoint(path)`:
>    - `load()`: baca file JSON dan kembalikan nilai checkpoint tersimpan, atau None jika file belum ada.
>    - `save(value)`: tulis `{"value": value}` ke file temporary di folder yang sama lalu tukar atomik dengan `os.replace()` agar crash tidak pernah merusak state.
> 2. Uji di terminal:
> `pytest labs/mod-1-6/test_lab.py -k TestCheckpoint -v`
> Ketika tes TestCheckpoint PASSED, lanjut ke Pelajaran 5 untuk perataan skema data mentah!

## @lesson Mendaratkan dan membentuk data mentah
Simpan apa yang Anda terima, sebagaimana Anda menerimanya, di area **landing** (disebut juga raw atau bronze, Modul 2.2). Jangan memperbaiki, mengganti nama, atau membuang apa pun pada tahap ini; lakukan pembersihan di langkah berikutnya yang bisa diulang (Modul 2.3). Alasannya praktis: jika pembersihan Anda punya bug, Anda bisa memperbaikinya dan memproses ulang dari salinan mentah alih-alih meminta sumber mengirim data bulan lalu lagi, yang mungkin sudah tidak tersedia.

Kebiasaan landing yang baik:

- **JSON Lines** (satu objek JSON per baris) adalah format yang aman, bisa ditambah, dan bisa dipecah untuk data API. Parquet lebih baik untuk volume besar, begitu bentuknya stabil.
- Tambahkan **metadata** ke setiap record: `_run_id`, `_source`, dan `_ingested_at` (`incremental_load` di lab melakukannya). Ketika sebuah angka tampak salah, ini memberi tahu putaran mana yang membawanya.
- **Partisi menurut tanggal ingestion** (`dt=2026-02-01/`), agar data satu hari mudah ditemukan, diproses ulang, atau dihapus (lab menulis persis path itu).
- Jaga file pada **ukuran yang wajar**: bukan satu file mungil per permintaan (masalah file kecil, Modul 3.0 dan 2.6), bukan satu file raksasa.

**Meratakan JSON bersarang.** API mengembalikan objek dan array bersarang, tetapi tabel itu datar. Objek bersarang menjadi kolom (`customer.address.city` menjadi `customer_address_city`); sebuah **array** butuh keputusan. Menyimpannya sebagai string JSON dalam satu kolom adalah default aman untuk landing (`flatten_record` di lab), dan langkah berikutnya meledakkannya menjadi **tabel anak** dengan satu baris per elemen dan id induknya (`items` sebuah pesanan menjadi tabel `order_items`, grain dari Modul 1.4).

**Schema drift.** Bentuk API akan berubah: field baru muncul, field menghilang, angka tiba sebagai teks `"Rp 6.000"`. Memuatnya diam-diam itu berbahaya. `detect_schema_drift` di lab membandingkan record yang masuk dengan skema yang Anda harapkan dan melaporkan **kolom baru**, **kolom hilang**, dan **perubahan tipe** (dengan setiap tipe yang terlihat). Lalu tentukan kebijakan: **gagalkan** pemuatan (ketat, aman untuk data keuangan), **karantina** record yang janggal dan lanjutkan, atau **evolusikan** skema otomatis (nyaman, berisiko). Tuliskan kebijakan itu sebagai data contract dengan penyedia atau konsumen Anda (Modul 2.5), dan beri alert saat drift terdeteksi.

> 💡 **Jeda Praktik 4 (Perataan JSON & Deteksi Schema Drift):**
> Bentuk data mentah menjadi tabular dan lindungi kontrak skema data:
> 1. Di `labs/mod-1-6/ingest_lab.py` pada text editor, selesaikan 2 fungsi struktur data:
>    - `flatten_record(record, sep="_")`: ratakan objek bersarang (misal `customer.address.city` -> `customer_address_city`), pertahankan array sebagai string JSON dengan kunci terurut.
>    - `detect_schema_drift(expected, records)`: bandingkan record masuk terhadap skema ekspektasi dan laporkan kolom baru (`new_columns`), kolom hilang (`missing_columns`), serta anomali perubahan tipe data (`type_changes`).
> 2. Uji di terminal:
> `pytest labs/mod-1-6/test_lab.py -k "TestFlatten or TestSchemaDrift" -v`
> Ketika tes PASSED, lanjut ke Pelajaran 6 untuk merangkai pipeline ingestion inkremental penuh!

## @lesson File, database, dan menjalankannya sungguhan
**File.** Mitra menjatuhkan file, dan file penuh kejutan: encoding (selalu sebut UTF-8 secara eksplisit, Modul 0.0), pemisah baris di dalam kutipan, header yang berubah, **file terlambat atau hilang**, dan file yang sama dikirim dua kali. Praktiknya: tunggu sampai file selesai ditulis sepenuhnya (file penanda, atau ukuran yang stabil), catat **nama file dan checksum** dari semua yang dimuat sehingga pengiriman duplikat dikenali, dan jadikan kedatangan sebagai kejadian yang dipantau ("file pukul 06:00 belum datang").

**Database.** Pilihannya **salinan tabel penuh** (sederhana, berat bagi sumber), **salinan inkremental menurut timestamp atau id yang naik** (logika checkpoint yang sama seperti di atas; ia melewatkan penghapusan dan mengandalkan `updated_at` yang tepercaya), dan **change data capture** dari log (Modul 3.2). Apa pun pilihan Anda, baca dari **replika** bila mungkin dan hindari query panjang pada primary produksi (Modul 1.3). Hormati batas tim aplikasi seperti Anda menghormati batas API.

**Bangun atau beli.** Konektor terkelola (Airbyte, Fivetran, dan lainnya) menangani sumber umum, pagination, retry, dan perubahan skema untuk Anda. Beli untuk sumber populer yang konektornya matang; bangun ketika sumbernya tidak lazim, ketika Anda butuh kendali atas biaya atau latensi, atau ketika konektor menyembunyikan perilaku yang harus Anda pahami. Tahu cara membangunnya, seperti di lab ini, adalah yang membuat Anda bisa menilai dan men-debug konektor.

**Mengoperasikan job ingestion.**

- **Catat dan ukur**: record diambil, halaman, retry, waktu tunggu, durasi, byte tertulis, checkpoint sebelum dan sesudah. Job yang "berhasil" dengan nol record sering rusak; beri alert pada **kesegaran** (usia data terbaru) dan **volume** (Modul 2.5).
- **Rekonsiliasi**: bandingkan jumlah yang Anda muat dengan yang dikatakan sumber. Ini pemeriksaan kelengkapan termurah.
- **Backfill dengan sengaja**: punya cara terdokumentasi untuk me-reset checkpoint dan memuat ulang suatu periode, dan pastikan pengulangannya idempoten.
- **Uji tanpa layanan asli**: server palsu seperti milik lab memungkinkan Anda menguji 429, 500, timeout, dan token buruk dalam hitungan detik. Tambahkan **contract test** yang sesekali berjalan terhadap API asli untuk menangkap perubahan.
- **Rahasia dan batas**: token di secret manager, dirotasi; laju permintaan dikonfigurasi dan didokumentasikan.

Kini Anda bisa menjawab: "Bagaimana Anda meng-ingest dari API berhalaman secara andal?" (cursor, retry dengan backoff, penanganan rate limit, checkpoint setelah penulisan tahan lama, landing idempoten, pemeriksaan skema). "Bagaimana jika job crash di tengah?" (checkpoint tidak maju, jadi pengulangan mengambil data yang sama dan menimpa file yang sama). "Mengapa bukan pagination offset?" (ia menduplikasi atau melewatkan ketika data berubah saat Anda membaca).

> 💡 **Jeda Praktik 5 (Pipeline Ingestion Inkremental Idempoten - Lab Tuntas):**
> Rangkai alur kerja ingestion produksi yang tahan banting:
> 1. Di `labs/mod-1-6/ingest_lab.py` pada text editor, implementasikan fungsi `incremental_load(...)`:
>    - Muat checkpoint, ambil data dengan `fetch_all_cursor(..., since=checkpoint)`.
>    - Deduplikasi per id (ambil versi dengan `updated_at` tertinggi).
>    - Tulis data mentah ke `landing_dir/dt=<today>/orders_<run_id>.jsonl` dengan metadata audit (`_run_id`, `_source`, `_ingested_at`) secara atomik.
>    - Perbarui checkpoint HANYA SETELAH file data berhasil mendarat.
> 2. Jalankan seluruh rangkaian pengujian di terminal:
> `pytest labs/mod-1-6/test_lab.py -v`
> Ketika semua 37 tes berstatus PASSED, pipeline data ingestion Anda telah memenuhi standar industri data engineering!

## @lab Lab: ingest dari API yang tidak stabil, dengan aman
Bangun inti job ingestion terhadap **API HTTP palsu yang berjalan di komputer Anda sendiri** (dijalankan oleh tes; tidak perlu internet atau akun): pembuatan request dan autentikasi, retry dengan exponential backoff dan `Retry-After`, pagination cursor dan offset, checkpoint atomik, perataan, deteksi schema drift, dan pemuatan inkremental yang idempoten yang mendaratkan JSON Lines. Tesnya (37) memeriksa setiap perilaku, termasuk crash simulasi antara penulisan file dan penyimpanan checkpoint.

### @steps
1. Baca `labs/mod-1-6/ingest_lab.py` lalu 70 baris pertama `test_lab.py` untuk melihat API palsunya (ia Python biasa: server HTTP kecil dalam sebuah thread). `ApiError` sudah disediakan.
2. Kerjakan sesuai urutan file dan jalankan tes setelah SETIAP fungsi:

```bash
pytest labs/mod-1-6/test_lab.py -v
pytest labs/mod-1-6/test_lab.py -v -k "GetJson or Pagination"      # satu kelompok pada satu waktu
```

3. **Request dan retry dulu.** Implementasikan `build_request` dan `backoff_delay`, lalu `get_json`. Sebelum menjalankan tes, tulis di kertas daftar waktu tunggu yang Anda harapkan untuk urutan "500, 503, lalu berhasil", dan untuk "429 dengan Retry-After 7, lalu 429 dengan Retry-After 2, lalu berhasil".
4. **Pagination.** Implementasikan loop cursor lebih dulu, lalu loop offset. Jalankan `fetch_all_offset` terhadap data yang ukurannya kelipatan pas dari ukuran halaman dan hitung permintaannya.
5. **Checkpoint, flatten, drift.** Ini kecil dan murni. Untuk `Checkpoint.save`, jelaskan dalam satu kalimat apa yang bisa salah jika Anda menulis file langsung.
6. **Pemuatan inkremental.** Tulis paling akhir. Sebelum menjalankan `test_a_crash_before_the_checkpoint_is_repaired_by_rerunning`, jelaskan mengapa urutan langkah Anda membuatnya lulus. Lalu tukar langkah 5 dan 6 dengan sengaja dan lihat tes mana yang gagal.
7. **Kerjakan yang sesungguhnya.** Setelah Modul 0.2, tulis kodenya lagi di venv Anda sendiri **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-1-6` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-1-6/ingest_lab.py :: File kerja Anda: implementasikan fungsi TODO dan class Checkpoint :: starter
- labs/mod-1-6/test_lab.py :: Ke-37 tes, termasuk API HTTP palsunya :: test
- labs/mod-1-6/requirements.txt :: pytest :: config
- labs/mod-1-6/reference/ingest_lab.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 37 tes lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri**
- Anda bisa menjelaskan, dengan sebuah angka, mengapa pagination offset bisa menduplikasi record, dan mengapa cursor tidak
- Anda bisa menjelaskan status code mana yang diulang dan mana yang tidak, dan untuk apa `Retry-After`
- Anda bisa menjelaskan mengapa checkpoint disimpan setelah data ditulis, dan apa yang terjadi setelah crash di antaranya

### @verify
```bash
pytest labs/mod-1-6/test_lab.py -v
python3 scripts/prove.py mod-1-6
```

Jalankan yang diketahui benar: awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Checkpoint yang maju sebelum datanya mendarat
### @scenario
Sebuah job malam memuat pesanan dari API penyedia pembayaran. Agar tidak "membuang" waktu, seorang developer menyimpan checkpoint baru begitu halaman terakhir selesai diambil, lalu menulis record ke penyimpanan cloud. Ini berjalan berbulan-bulan.

Pada suatu malam layanan penyimpanan mengalami gangguan singkat saat job sedang menulis. Penulisan gagal dan job keluar dengan error, tetapi checkpoint sudah maju ke akhir data yang sempat diambil. Orkestrator mengulang job pada pagi hari; ia membaca checkpoint baru, meminta pesanan setelahnya kepada API, dan menemukan hanya beberapa. Job melaporkan **sukses**. Tiga minggu kemudian tim keuangan menyadari bahwa omset satu malam, 4.200 pesanan, hilang dari warehouse dan dari setiap laporan yang dibangun di atasnya, dan dashboard milik penyedia sendiri menunjukkan selisihnya.

### @cause
Langkah-langkahnya salah urutan. Checkpoint menyatakan bahwa data sampai suatu titik sudah dimuat dengan aman, tetapi datanya belum tersimpan, sehingga kegagalan di antaranya menciptakan **celah permanen**: pesanan-pesanan itu lebih tua daripada checkpoint dan tidak akan pernah diminta lagi. Tidak ada yang mendeteksinya, karena pengulangan berhasil dan tidak ada yang membandingkan jumlah dengan sumber.

Faktor yang memperparah: tidak ada rekonsiliasi antara total penyedia dan warehouse, tidak ada alert volume (jumlah baris malam itu hanya sebagian kecil dari biasanya), dan job yang tidak dirancang untuk diulang, sehingga tidak ada yang bisa begitu saja "memuat ulang malam itu".

### @fix
1. **Tulis dulu, checkpoint terakhir**, dalam urutan itu, dan perlakukan keduanya sebagai satu kesatuan: file checkpoint diganti secara atomik hanya setelah file data berada di tempatnya (`incremental_load` di lab, dan tes crash-nya).
2. Buat pemuatan **idempoten** (keluaran dinamai menurut run id, rename atomik, deduplikasi menurut id), sehingga mengulang malam yang gagal atau mencurigakan selalu aman.
3. **Backfill malam yang hilang** dengan me-reset checkpoint ke sebelum malam itu dan mengulang; periksa jumlahnya terhadap penyedia.
4. Tambahkan **rekonsiliasi**: bandingkan jumlah dan total nilai record yang dimuat per hari dengan laporan penyedia sendiri, dan beri alert saat ada selisih.
5. Tambahkan **alert volume dan kesegaran** (Modul 2.5): malam dengan 5% dari jumlah baris normal harus memicu alert meskipun job "berhasil".
6. Tambahkan **jendela replay**: baca ulang beberapa jam terakhir pada setiap putaran dan andalkan deduplikasi, sehingga celah kecil dari sebab apa pun sembuh sendiri.

### @pattern
Checkpoint hanya boleh menggambarkan data yang sudah tersimpan dengan aman. Atur langkah agar crash menyebabkan pengulangan, bukan kehilangan, lalu buktikan dengan membandingkan terhadap sumber.

## @quiz
### API menjawab `429 Too Many Requests` dengan header `Retry-After: 7`. Apa yang harus dilakukan klien?
- [ ] Mengulang segera dan secepat mungkin, karena server akan menerima permintaan pada percobaan kedua
- [ ] Menghentikan job selamanya dan melaporkan error, karena rate limit tidak pernah bisa ditangani klien
- [x] Menunggu sekitar 7 detik, lalu mengulang, karena server memberi tahu klien kapan boleh mencoba lagi
- [ ] Segera pindah ke API key lain, agar batasnya dihitung terhadap identitas yang berbeda setiap kali

> `Retry-After` menyatakan berapa lama harus menunggu. Menghantam server memperburuk masalah dan bisa membuat klien diblokir.

### Error HTTP mana di bawah ini yang TIDAK boleh diulang oleh klien?
- [ ] 503 Service Unavailable, karena server kelebihan beban dan mungkin bisa menjawab sebentar lagi
- [ ] 500 Internal Server Error, karena gangguan sementara di server sering hilang pada percobaan berikutnya
- [ ] Timeout koneksi, karena jaringan atau server bisa saja sebentar tidak tersedia
- [x] 401 Unauthorized, karena kredensialnya salah dan permintaan yang sama akan gagal lagi

> Ulangi masalah sementara (429, 5xx, error koneksi). Error yang berarti "permintaan Anda salah" (400, 401, 403, 404) tidak akan berubah dengan menunggu.

### Mengapa exponential backoff menunggu 1, 2, 4, 8 detik, bukan satu detik tetap setiap kali?
- [ ] Waktu tunggu yang berlipat memakai lebih sedikit memori di program klien daripada yang sama panjang setiap kali
- [x] Server yang kewalahan punya waktu untuk pulih, dan banyak klien tidak mengulang bersamaan
- [ ] Standar HTTP mewajibkan waktu tunggu berupa pangkat dua, dan server menolak waktu tunggu yang lain
- [ ] Ia menjamin permintaan berhasil pada percobaan keempat, sehingga tidak butuh retry lagi

> Waktu tunggu yang bertambah mengurangi tekanan pada layanan yang gagal. Jitter acak menyebarkan klien yang gagal bersamaan. Batas retry dan kegagalan yang lantang tetap diperlukan.

### Pada feed terbaru-dulu, 3 pesanan tiba setelah Anda membaca halaman 1 dengan pagination offset. Apa yang bisa terjadi pada halaman 2?
- [ ] Tidak ada, karena offset adalah angka tetap yang selalu menunjuk ke record yang sama, apa pun yang disisipkan
- [x] Sebagian baris bergeser ke halaman berikutnya dan muncul lagi, sehingga hasilnya memuat duplikat
- [ ] Server menutup koneksi, karena klien tidak boleh membaca feed saat baris sedang ditambahkan
- [ ] Halaman berikutnya kosong, karena record baru membuat offset sebelumnya tidak valid bagi semua klien

> Penyisipan menggeser offset berikutnya. Pada contoh lab 25 pesanan terambil sebagai 28 baris. Pagination cursor (keyset) menghindarinya.

### Apa urutan yang benar untuk satu putaran inkremental?
- [ ] Simpan checkpoint baru, lalu ambil data, lalu tulis, agar putaran berikutnya mulai secepat mungkin
- [ ] Ambil data, simpan checkpoint, lalu tulis datanya, karena checkpoint adalah langkah yang lebih murah
- [x] Baca checkpoint, ambil, tulis data secara tahan lama, dan baru setelah itu simpan checkpoint baru
- [ ] Tulis data dan checkpoint bersamaan, karena urutannya tidak pernah penting bagi job

> Checkpoint hanya boleh menggambarkan data yang sudah tersimpan. Dengan urutan ini crash menyebabkan pengulangan, yang ditoleransi pemuatan idempoten, dan tidak pernah kehilangan.

### Mengapa menulis file ke nama sementara lalu mengganti namanya?
- [ ] Mengganti nama file mengompresnya, sehingga file akhir memakai ruang lebih kecil daripada yang ditulis langsung
- [ ] File sementara bebas dari kuota disk, yang membuat pemuatan besar selesai tanpa error
- [x] File akhir lengkap atau tidak ada, sehingga crash tidak pernah meninggalkan file yang setengah tertulis
- [ ] Sistem operasi mewajibkan setiap file diganti namanya sekali sebelum program lain boleh membacanya

> Rename atomik (`os.replace`) membuat pergantian bersifat semua-atau-tidak-sama-sekali. Teknik yang sama melindungi file checkpoint.

### Pengulangan run id yang sama harus meninggalkan berapa file di folder landing untuk putaran itu?
- [ ] Dua, satu untuk tiap percobaan, karena setiap putaran harus menyimpan salinannya sendiri untuk jejak audit
- [x] Satu, karena keluaran dinamai menurut run id sehingga pengulangan menimpa file yang sama
- [ ] Nol, karena pengulangan menghapus keluarannya ketika menemukan bahwa datanya sudah dimuat
- [ ] Sebanyak jumlah halaman, karena setiap halaman API harus disimpan dalam filenya sendiri

> Menamai keluaran menurut run id ditambah penimpaan atomik membuat pemuatan idempoten: menjalankannya lagi memberi hasil yang sama dengan sekali.

### API mulai mengirim `total_idr` sebagai teks "Rp 6.000" untuk sebagian record. Apa yang harus dilakukan job ingestion?
- [ ] Memuatnya diam-diam, karena warehouse akan mengonversi teks itu menjadi angka saat seseorang mengkuerinya
- [ ] Membuang record itu, supaya tabel tetap bersih dan tidak ada yang perlu diberi tahu soal masalahnya
- [x] Mendeteksinya sebagai schema drift, lalu gagal atau karantina sesuai kebijakan tim, dan beri alert ke pemilik
- [ ] Mengonversi setiap kolom setiap record menjadi teks, agar perubahan tipe tidak pernah lagi menimbulkan masalah

> Perubahan tipe yang diam-diam merusak angka hilir. Deteksi drift, terapkan kebijakan eksplisit (gagal, karantina, atau evolusi), dan beri tahu pemiliknya.

## @resources
- [MDN: kode status respons HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [MDN: header Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
- [Python: urllib.request](https://docs.python.org/3/library/urllib.request.html)
- [Slack API: pagination (contoh cursor)](https://api.slack.com/docs/pagination)
- [AWS Architecture Blog: Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [JSON Lines](https://jsonlines.org/)
