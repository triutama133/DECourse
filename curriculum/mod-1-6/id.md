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

## @part Mengambil data dari API

## @lesson Bagaimana data masuk ke platform
> **Intinya:** Data datang sebagai file, panggilan API, pembacaan database, atau event. Anda memilih pull atau push, dan penuh atau inkremental. Job yang bisa dipercaya itu lengkap, aman diulang, mentah dulu, bisa diamati, dan sopan kepada sumbernya.
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

> 🛠 **Coba sendiri (3 menit, pena dan kertas).** Untuk setiap kasus, tulis keluarga sumbernya (file, API, database, event), pull atau push, dan penuh atau inkremental.
> 1. Seorang mitra mengunggah `sales.csv` ke folder SFTP setiap malam.
> 2. Penyedia pembayaran memanggil URL milik Anda setiap kali pembayaran berhasil.
> 3. Sebuah job menjalankan `SELECT * FROM orders WHERE updated_at > :last_run` setiap jam.
> 4. Sebuah aplikasi menerbitkan setiap klik ke topic Kafka.
>
> Lalu pilih janji yang paling sulit dari kelima janji (lengkap, aman diulang, mentah dulu, bisa diamati, sopan) untuk setiap kasus, dan jelaskan alasannya dalam satu kalimat.
>
> *Bandingkan setelah selesai:* 1 adalah file yang Anda tarik (penuh, atau inkremental jika file hanya berisi baris baru); 2 adalah event yang didorong ke Anda (inkremental secara alami); 3 adalah database yang Anda tarik secara inkremental; 4 adalah aliran event: aplikasi mendorong ke log dan consumer Anda menariknya dari sana. Latihan ini tidak punya pemeriksa: jawaban di atas itulah pemeriksaannya.

## @lesson API HTTP dalam sepuluh menit
> **Intinya:** Sebuah request terdiri dari metode, URL, dan header; jawabannya berupa status, header, dan JSON. 2xx berarti beres, 4xx berarti request Anda salah (jangan diulang), 429 dan 5xx berarti coba lagi nanti. Jauhkan rahasia dari kode dan selalu pasang timeout.
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

> 🛠 **Coba sendiri (10 menit, praktik langsung).** Jalankan API latihan di terminal kedua dan biarkan menyala: `python3 labs/mod-1-6/fakeapi.py` (isinya 25 pesanan; tokennya `learner-token`; docstring file itu mendaftar endpoint-nya).
> 1. Di terminal pertama: `curl -i "localhost:8765/orders?limit=3"`. Status apa yang Anda dapat, dan mengapa?
> 2. Perbaiki sendiri dengan menambahkan header `-H "Authorization: Bearer learner-token"`. Baca baris status, header `Content-Type`, dan JSON-nya. Apa isi `next_cursor`?
> 3. Di `try_http.py`, hanya dengan `urllib` dari standard library, lakukan GET ke URL yang sama dengan header itu dan cetak status code serta daftar id pesanan. Lalu panggil tanpa header, tangkap error-nya, dan cetak kodenya.
>
> **Seharusnya Anda melihat:** `401` untuk langkah 1, lalu `HTTP/1.0 200 OK`, `application/json`, dan `"next_cursor": "3"` untuk langkah 2, dan dari skrip Anda `200 [1, 2, 3]` diikuti `401`.
>
> **Periksa:** simpan skrip-skrip latihan ini dalam satu folder, misalnya `~/practice`, dan jalankan `python3 labs/tryit/check.py 1.6-2 ~/practice`. Pemeriksa menjalankan salinan API latihannya sendiri, jadi hentikan milik Anda (Ctrl+C) lebih dulu.

## @lesson Membaca semua data: pagination, rate limit, dan retry
> **Intinya:** Halaman offset bergeser saat data berubah (duplikat dan celah); cursor tidak. Saat mendapat 429, tunggu selama yang dikatakan `Retry-After`; saat mendapat 5xx, ulangi dengan jeda yang makin panjang dan ada batasnya; jangan pernah mengulang 4xx lainnya.
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

> 🛠 **Coba sendiri (15 menit, praktik langsung).** Biarkan API latihan tetap menyala. Mulai setiap langkah dari keadaan bersih dengan `curl localhost:8765/reset`.
> 1. *Halaman offset bergeser.* Baca halaman 1 dengan `curl -H "Authorization: Bearer learner-token" "localhost:8765/orders_offset?limit=10&offset=0"`. Sekarang biarkan 3 pesanan baru datang (`.../arrive?n=3`, header yang sama). Baca halaman 2 dengan `offset=10`. Id mana di halaman 2 yang sudah ada di halaman 1?
> 2. *Cursor tidak bergeser.* Di `cursor_all.py`, baca **semua** pesanan dari `/orders?limit=10` dengan mengikuti `next_cursor` sampai kosong, dan panggil `/arrive?n=3` sekali tepat setelah halaman pertama. Cetak berapa id yang Anda kumpulkan dan berapa yang unik.
> 3. *Rate limit.* Panggil `/limited` dari `limited.py`. Saat mendapat 429, cetak statusnya dan nilai `Retry-After`, tidur tepat selama itu, panggil lagi, dan cetak status yang baru.
>
> **Seharusnya Anda melihat:** halaman 1 berisi id 25 turun sampai 16, dan halaman 2 mengulang 18, 17, dan 16; skrip cursor mencetak `28 28`; skrip rate limit mencetak `429 2.0` lalu `200`.
>
> **Periksa:** `python3 labs/tryit/check.py 1.6-3 ~/practice` (perlu `cursor_all.py` dan `limited.py`; hentikan dulu API latihan Anda sendiri). Pemeriksa juga mencoba `limited.py` Anda pada server yang meminta waktu tunggu berbeda, jadi baca header-nya, jangan menulis angkanya langsung di kode.

## @lesson Pemuatan inkremental dan checkpoint
> **Intinya:** Checkpoint menyatakan sejauh mana Anda sudah sampai. Tulis datanya dulu, baru checkpoint-nya, dan buat pemuatannya aman diulang (ganti atau hapus duplikat), agar crash hanya berarti mengulang, bukan kehilangan data.
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

> 🛠 **Coba sendiri (15 menit, praktik langsung).** Tulis `load.py` untuk API latihan: baca pesanan dengan cursor (`limit=5`) dan tambahkan ke `out.jsonl`; **setelah** setiap halaman ditulis, simpan `{"cursor": ...}` ke `checkpoint.json` (tulis file sementara, lalu `os.replace`). Saat skrip mulai, ia melanjutkan dari `checkpoint.json` jika file itu ada. Taruh `time.sleep(1)` setelah menulis setiap halaman, agar Anda sempat menghentikannya.
> 1. Jalankan `curl localhost:8765/reset`, lalu mulai `load.py` dan tekan Ctrl+C setelah kira-kira dua halaman. Bandingkan `wc -l out.jsonl` dengan cursor di `checkpoint.json`: mengapa file bisa berisi lebih banyak baris daripada yang dikatakan checkpoint?
> 2. Jalankan `load.py` lagi sampai selesai, lalu jalankan `python3 -c "import json; ids=[json.loads(l)['id'] for l in open('out.jsonl')]; print(len(ids), len(set(ids)))"`. Buat loader Anda menghapus duplikat berdasarkan `id` sampai ia mencetak `25 25`.
> 3. Sekarang rusak dengan sengaja: hapus `out.jsonl` dan `checkpoint.json`, reset API-nya, dan tukar urutannya (simpan checkpoint **lebih dulu**, tidur, baru tulis halamannya). Hentikan saat tidur, jalankan sampai selesai, lalu jalankan lagi pemeriksaan dari langkah 2.
>
> **Seharusnya Anda melihat:** di langkah 1 lebih banyak baris daripada yang tersirat dari checkpoint (halaman yang sedang diproses sudah ditulis tetapi belum di-checkpoint); `25 25` di langkah 2; di langkah 3 kurang dari 25 baris, dan id yang hilang membentuk satu halaman berisi lima. Halaman itu hilang selamanya, dan itulah sebabnya checkpoint disimpan paling akhir.
>
> **Periksa:** `python3 labs/tryit/check.py 1.6-4 ~/practice` memeriksa versi `load.py` dari langkah 1 dan 2 (checkpoint disimpan paling akhir). Pemeriksa menghentikan skrip Anda sendiri, seperti Ctrl+C, lalu menjalankannya lagi.

## @part Mendaratkan dan menjalankannya

## @lesson Mendaratkan dan membentuk data mentah
> **Intinya:** Daratkan data mentah tanpa diubah, beserta metadata dan partisi tanggal. Ratakan objek bersarang menjadi kolom, simpan list sebagai teks JSON, dan deteksi saat sebuah field berubah tipe.
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

> 🛠 **Coba sendiri (10 menit, praktik langsung).** Dengan API latihan menyala, ambil satu pesanan yang datanya bersarang: `curl -H "Authorization: Bearer learner-token" localhost:8765/orders/1`.
> 1. Tulis `flatten(record)` di `flat.py`: objek bersarang menjadi kolom yang dinamai menurut jalurnya (`customer_address_city`), list disimpan sebagai teks JSON. Kode Anda harus lulus pemeriksaan ini (`order1` adalah JSON dari `/orders/1` yang sudah di-parse):
>    `flat = flatten(order1)`
>    `assert flat["customer_address_city"] == "Jakarta"`
>    `assert flat["customer_id"] == 7`
>    `assert flat["items"] == '[{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}]'`
>    `assert "customer" not in flat`
> 2. Buat salinan `flat` yang `total_idr`-nya berupa teks `"Rp 1.000"`. Di `flat.py`, tulis juga `type_changes(old, new)`: ia mengembalikan list berisi satu teks, misalnya `total_idr: int -> str`, untuk setiap field yang ada di kedua record dan tipenya berubah (list kosong jika tidak ada yang berubah). Cetak hasilnya untuk `flat` dan salinan Anda.
>
> **Seharusnya Anda melihat:** tidak ada assertion error, dan untuk langkah 2 `['total_idr: int -> str']`. Itulah schema drift, ditemukan dalam empat baris kode.
>
> **Periksa:** `python3 labs/tryit/check.py 1.6-5 ~/practice` juga mencoba `flat.py` pada record lain.

## @lesson File, database, dan menjalankannya sungguhan
> **Intinya:** File: tunggu sampai lengkap dan catat nama serta checksum-nya. Database: baca dari replika dan pakai kolom inkremental. Jalankan dengan hitungan, rekonsiliasi, dan backfill yang disengaja.
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

> 🛠 **Coba sendiri (10 menit, praktik langsung).** Buat file KopiKu (`python3 labs/shared/shopgen.py --out data`) dan perlakukan `data/orders.csv` sebagai kiriman dari mitra. Tulis ketiga langkah dalam satu skrip, `load_orders.py`.
> 1. Dengan modul `csv`, hitung jumlah baris dan jumlah nilai `order_id` yang unik. Bandingkan dengan `orders_rows`, `orders_distinct`, dan `orders_duplicate_rows` di `data/manifest.json`.
> 2. Muat file ke tabel SQLite yang primary key-nya `order_id` (pakai `INSERT OR REPLACE`), lalu cetak jumlah barisnya.
> 3. Jalankan pemuatan untuk kedua kalinya di skrip yang sama, lalu cetak lagi jumlah barisnya.
>
> **Seharusnya Anda melihat:** `3634 3599` di langkah 1 (35 baris duplikat, sesuai manifest), lalu `3599` dan `3599` di langkah 2 dan 3. Bandingkan juga dengan `wc -l data/orders.csv`: hasilnya 3635, karena ada baris header. Menghitung baris di setiap perpindahan adalah cara termurah untuk membuktikan tidak ada yang hilang.
>
> **Periksa:** `python3 labs/tryit/check.py 1.6-6 ~/practice` (skrip Anda membaca `data/orders.csv` relatif terhadap folder tempat ia dijalankan).

## @lesson Verifikasi webhook HMAC-SHA256, ekstraksi diferensial, streaming S3, dan dlt deklaratif

Dalam Bab 7 (*Ingestion*) buku *Fundamentals of Data Engineering* dan pipeline cloud modern (seperti workshop `dlt` pada *DataTalksClub Data Engineering Zoomcamp*), terdapat empat pola ingestion produksi yang menjembatani mekanika HTTP mentah dengan platform data enterprise:

**1. Push Ingestion: Verifikasi Webhook `HMAC-SHA256` & Perlindungan Replay Attack.** Saat layanan Anda *menarik (pull)* data dari API, Anda berautentikasi dengan API key. Namun saat layanan eksternal (Stripe, Shopify, Midtrans, GitHub) *mendorong (push)* event ke URL webhook Anda (`POST /webhooks/orders`), siapa pun di internet bisa mengirim request POST palsu yang berpura-pura menjadi pesanan lunas. Penerima webhook produksi wajib memverifikasi tiga hal sebelum menerima payload:
1. **Tanda Tangan Kriptografis (`HMAC-SHA256`):** Hitung `expected = "sha256=" + hmac.new(secret.encode(), f"{timestamp}.{raw_body}".encode(), hashlib.sha256).hexdigest()`.
2. **Perbandingan Waktu-Konstan (`hmac.compare_digest`):** Jangan gunakan `signature == expected` (yang membocorkan informasi waktu byte demi byte); selalu gunakan `hmac.compare_digest(signature, expected)`.
3. **Pemeriksaan Jendela Waktu Replay:** Tolak webhook mana pun yang `timestamp`-nya berselisih lebih dari `300 detik` (5 menit) dari waktu server saat ini, sehingga penyerang yang menyadap paket valid tidak dapat memutarnya ulang keesokan harinya.

**2. Ekstraksi Snapshot vs. Diferensial (Differential Extraction).** Banyak sistem mitra tidak menyediakan aliran perubahan (CDC), melainkan hanya mengirim dump penuh harian (`customers_2026_02_02.json`). Memuat ulang seluruh snapshot setiap hari memboroskan storage warehouse dan menyembunyikan baris mana yang benar-benar berubah. **Differential extractor** membandingkan snapshot hari ini dengan state kemarin berdasarkan primary key (`id`) dan hanya mengeluarkan selisih murninya:
- **`inserts`:** Kunci yang ada hari ini tetapi belum ada kemarin.
- **`updates`:** Kunci yang ada di kedua hari tetapi isi atributnya berubah.
- **`deletes`:** Kunci yang ada kemarin tetapi hilang hari ini (sangat penting untuk mendeteksi penghapusan!).
- **`unchanged_count`:** Kunci dengan atribut identik (dilewati agar tabel hilir tidak ditulis ulang secara sia-sia).

**3. Streaming Multipart Langsung ke Cloud Storage (`boto3` / `gcsfs`).** Di lingkungan produksi AWS atau GCP, worker ingestion jarang menulis file besar ke disk lokal container (yang bersifat sementara dan sering dibatasi 512 MB). Sebagai gantinya, mereka mengalirkan buffer langsung ke S3 atau GCS menggunakan multipart upload stream (`s3_client.upload_fileobj(file_like_stream, Bucket="kopiku-raw", Key="orders/dt=2026-02-02/part-000.parquet")`).

**4. Ingestion Python Deklaratif dengan `dlt` (`data load tool`).** Setelah Anda menguasai cara membangun cursor pagination, retry backoff, dan normalisasi skema secara manual menggunakan `urllib`, tim data modern sering menggunakan **`dlt` (`import dlt`)** di produksi untuk memangkas kode berulang sekaligus menangani normalisasi JSON bersarang, peringatan evolusi skema, dan penyimpanan state watermark inkremental secara otomatis ke DuckDB, BigQuery, Snowflake, maupun S3:

```python
import dlt

@dlt.resource(name="orders", write_disposition="merge", primary_key="order_id")
def kopiku_orders_source(
    updated_after=dlt.sources.incremental("updated_at", initial_value="2026-01-01T00:00:00Z")
):
    # Menghasilkan halaman record JSON mulai dari watermark terakhir yang tersimpan
    for page in paginate_orders_api(since=updated_after.last_value):
        yield page

# Muat satu baris kode ke DuckDB lokal untuk tes, atau ganti destination="bigquery" / "snowflake" di produksi!
pipeline = dlt.pipeline(pipeline_name="kopiku_ingest", destination="duckdb", dataset_name="raw_kopiku")
load_info = pipeline.run(kopiku_orders_source())
```

> 🛠 **Coba sendiri (20 menit, Python — Lab Keamanan Webhook & Ekstraksi Diferensial).** Buat file `~/practice/webhook_diff.py` dan implementasikan dua fungsi:
> 1. `verify_webhook_batch(events, secret, now_ts, tolerance_sec=300)`: setiap event di `events` adalah dict `{"event_id": str, "timestamp": int, "body": str, "signature": str}` di mana tanda tangan yang valid adalah `"sha256=" + hmac_sha256(secret, f"{timestamp}.{body}")`. Menggunakan `hmac.compare_digest`, validasi setiap event:
>    - Jika `abs(now_ts - event["timestamp"]) > tolerance_sec`, tambahkan `{"event_id": ..., "reason": "stale_timestamp"}` ke `rejected`.
>    - Jika tanda tangan tidak cocok, tambahkan `{"event_id": ..., "reason": "invalid_signature"}` ke `rejected`.
>    - Jika `event_id` sudah pernah diterima sebelumnya di dalam batch yang sama, lewati (deduplikasi idempoten).
>    - Jika lolos semua, urai `json.loads(event["body"])` dan tambahkan ke `accepted`.
>    - Kembalikan `{"accepted": accepted, "rejected": rejected}`.
> 2. `compute_snapshot_diff(prev_rows, curr_rows, pk="id")`: diberikan list dict kemarin dan list dict hari ini, kembalikan `{"inserts": [...], "updates": [...], "deletes": [...], "unchanged_count": int}` di mana `inserts` dan `updates` adalah list dict baris saat ini yang diurutkan berdasarkan `row[pk]`, dan `deletes` adalah list terurut dari nilai primary key yang terhapus (`row[pk]`).
>
> **Periksa:** `python3 labs/tryit/check.py 1.6-7 ~/practice`

## @part Cara lain data tiba

## @lesson Driver database, file drop, EDI, dan data sharing {optional}
Bab 7 *Fundamentals of Data Engineering* mendaftar cara-cara data sampai ke sebuah platform. Modul ini sudah membahas API, file, dan webhook; empat cara lagi muncul di pekerjaan nyata, terutama di perbankan, ritel, dan logistik.

**1. Koneksi database langsung: ODBC dan JDBC.** Saat Anda membaca database sumber dengan `psycopg` atau SQLAlchemy, sebuah **driver** mengubah query Anda menjadi protokol jaringan database itu. **ODBC** (untuk C dan sebagian besar bahasa) dan **JDBC** (untuk Java, dan karena itu untuk Spark) adalah antarmuka driver standar: `spark.read.jdbc(...)` milik Spark, Power BI, SSIS, dan Data Factory semuanya terhubung lewat keduanya. Aturannya sama dengan API: baca dari **replica**, bukan primary yang melayani pelanggan; tarik per halaman atau per rentang, bukan satu `SELECT *` raksasa; dan untuk apa pun yang besar atau sering, pilih change data capture (Modul 3.2) daripada pembacaan penuh berulang.

**2. File drop lewat SFTP.** Banyak mitra masih mengirim file setiap malam ke server **SFTP** (transfer file lewat SSH): rekening koran bank, daftar harga pemasok, laporan settlement penyedia pembayaran. Mitra menulis file-nya, Anda mengambilnya. Jebakannya sama dengan Pelajaran 6 modul ini, ditambah tiga milik sendiri: tunggu sampai file lengkap (mitra sering mengunggah `x.csv.tmp` lalu me-rename-nya, atau mengirim file penanda `.done`), jangan pernah memproses file yang sama dua kali (simpan daftar nama dan checksum yang sudah diproses), dan ketahui siapa yang harus dihubungi ketika file tidak datang. Autentikasi dengan SSH key, bukan password.

**3. EDI: dokumen bisnis antarperusahaan.** **Electronic Data Interchange** adalah cara perusahaan besar bertukar purchase order, invoice, dan pemberitahuan pengiriman jauh sebelum ada API. File EDI adalah teks yang terdiri dari **segmen** yang diakhiri `~`, dengan **elemen** yang dipisahkan `*`. Dalam standar AS ANSI X12, purchase order adalah transaction set **850**: `BEG` memuat nomor dan tanggal pesanan, setiap `PO1` adalah satu baris (jumlah, satuan, harga, kode produk), `CTT` menyatakan berapa barisnya, dan `SE` menyatakan berapa segmen dokumen itu. Kedua hitungan itu adalah checksum milik file itu sendiri: parser yang tidak membandingkannya akan memuat pesanan yang terpotong tanpa sadar. (Eropa dan sebagian besar Asia memakai UN/EDIFACT, dengan nama segmen yang berbeda dan gagasan yang sama.)

**4. Data sharing.** Alih-alih menyalin data ke mitra, beberapa platform membiarkan penyedia **membagikan** tabel yang hidup: konsumen meng-query-nya di akunnya sendiri, penyedia membayar penyimpanan dan konsumen membayar komputasi, dan tidak ada yang diekspor. Snowflake Secure Data Sharing, Delta Sharing (Databricks, protokol terbuka), dan Analytics Hub milik BigQuery bekerja dengan cara ini. Ini menghilangkan file drop sepenuhnya, tetapi hanya berhasil jika kedua pihak memakai platform yang mendukungnya.

> 🛠 **Coba sendiri (20 menit, Python).** Tulis `parse_850(path)` yang membaca `labs/shared/edi/po_850.edi`, memecahnya menjadi segmen dan elemen, lalu mengembalikan nomor dan tanggal pesanan (dari `BEG`), baris-barisnya (dari setiap `PO1`: nomor baris, jumlah, satuan, harga satuan, kode produk, total baris), dan total pesanan. Lalu buat ia memeriksa file terhadap dirinya sendiri: angka di `CTT` harus sama dengan jumlah baris `PO1`, dan angka di `SE` harus sama dengan jumlah segmen dari `ST` sampai `SE`, keduanya ikut dihitung. Jalankan pada `po_850.edi` dan pada `po_850_broken.edi`.
>
> **Seharusnya Anda melihat:** pesanan `PO-2026-0042` bertanggal `20260115` dengan tiga baris, `BEAN-ARABICA-1KG` `1700000`, `CUP-PAPER-12OZ` `60000`, dan `MILK-OAT-CASE` `1200000`, total `2960000`, dan kedua pemeriksaan lulus (`3` baris, `7` segmen). File yang rusak tetap bisa di-parse tanpa error, tetapi baris gelas hilang: `2` baris ditemukan padahal `CTT` bilang `3`, dan `6` segmen padahal `SE` bilang `7`. Tanpa pemeriksaan itu Anda akan memuat pesanan senilai `2900000` dan tidak ada yang tahu.

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
- labs/mod-1-6/fakeapi.py :: API latihan kecil untuk latihan Try it (jalankan di terminal kedua) :: config
- labs/tryit/check.py :: Pemeriksa latihan Try it, misalnya: python3 labs/tryit/check.py 1.6-3 ~/practice :: config
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
