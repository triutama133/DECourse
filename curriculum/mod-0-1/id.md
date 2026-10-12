---
title: Peta Dunia Data: Apa Sebenarnya Kerja Data Engineer?
duration: 1 minggu
summary: Pahami mengapa data engineering ada, apa bedanya dengan analis dan data scientist, lalu ikuti satu pesanan dari HP pelanggan sampai dashboard, termasuk semua cara ia bisa salah di tengah jalan.
why: Kebanyakan kursus langsung mengetik SELECT * di file yang sudah bersih. Di dunia kerja tidak ada yang menyerahkan data bersih: Anda menerima duplikat, format aneh, dan file yang terlambat, tetapi angkanya tetap diharapkan benar.
---

## @outcomes
- Menjelaskan dengan kata sederhana mengapa perusahaan memisahkan database analitik dari database produksi
- Membedakan pekerjaan data engineer, analytics engineer, data analyst, dan data scientist
- Menggambarkan perjalanan data dari sumber sampai dashboard dan menyebut apa yang bisa rusak di tiap tahap
- Mengenali lima masalah data yang paling sering muncul (duplikat, data terlambat, perubahan skema, nilai rusak, perubahan volume)
- Membaca file CSV kecil secara defensif dan membersihkannya dengan Python biasa

## @prereq
Modul 0.0 (Python dari nol) sangat disarankan: lab ini memakai fungsi, perulangan, dictionary, dan penanganan error yang dijelaskan Modul 0.0. Modul 0.2 menyiapkan komputer Anda dengan benar; untuk lab modul ini, Python 3.9+ apa pun cukup.

> [!IMPORTANT]
> **Pengingat Editor vs Terminal:**
> Buka dan edit file kode (seperti `labs/mod-0-1/pipeline.py`) menggunakan Text Editor Anda (VS Code / Cursor / tab Lab di aplikasi). Jangan menjalankan file kode langsung di terminal bash tanpa interpreter python (misal: jangan ketik `labs/mod-0-1/pipeline.py` di terminal). Perintah terminal hanya untuk pengujian, seperti `python3 labs/mod-0-1/test_lab.py -v`.

## @lesson Mengapa profesi ini ada: dua jenis database
Bayangkan **KopiKu**, toko online kecil yang menjual biji kopi spesialti dari Gayo, Toraja, dan Flores. Setiap kali pelanggan menekan "Bayar", website menulis satu baris baru ke database: siapa yang membeli, apa, berapa, kapan. Database itu ada untuk menjalankan toko. Ia harus menjawab pertanyaan kecil dengan sangat cepat ("apa isi keranjang pelanggan ini?") dan tidak boleh kehilangan satu pesanan pun. Jenis database seperti ini disebut **OLTP** (Online Transaction Processing). PostgreSQL dan MySQL adalah pilihan yang umum.

Lalu pendiri toko bertanya: "Berapa omset per kota, per minggu, selama dua tahun terakhir?" Untuk menjawabnya, database harus membaca jutaan baris, mengelompokkan, dan menjumlahkannya. Ini pertanyaan **OLAP** (Online Analytical Processing). Bentuk pekerjaannya sama sekali berbeda:

| | OLTP (menjalankan toko) | OLAP (memahami toko) |
|---|---|---|
| Pertanyaan khas | "Simpan pesanan ini." "Tampilkan keranjang #4821." | "Omset per kota per minggu sejak 2024?" |
| Baris yang disentuh per query | Segelintir | Jutaan |
| Kecepatan yang penting | Milidetik untuk satu permintaan | Detik atau menit untuk satu scan besar |
| Pengguna | Pelanggan, ribuan sekaligus | Beberapa analis dan dashboard |
| Data | Kondisi terkini | Seluruh riwayat |
| Tujuan desain | Tidak pernah kehilangan atau merusak tulisan | Membaca dan mengagregasi dengan cepat |

Kalau analis menjalankan query omset dua tahun langsung di database produksi, query itu berebut CPU, memori, dan disk dengan pelanggan. Checkout melambat, kadang timeout, dan toko kehilangan uang selagi seseorang membuat grafik. Sebagian tim menambahkan read replica untuk meredam ini, dan itu membantu, tetapi tidak menyelesaikan masalah lain: data dibentuk untuk menulis, bukan menganalisis; ia hanya menyimpan kondisi terkini tiap baris; dan ia terpisah dari sistem pembayaran, iklan, dan event website Anda.

Karena itu perusahaan menyalin data ke **sistem terpisah yang dibangun untuk analisis** (data warehouse atau lakehouse) dan menjaganya tetap mutakhir. Melakukan penyalinan itu dengan andal, setiap hari, dari puluhan sumber, dengan data yang benar dan terdokumentasi, adalah pekerjaan **data engineer**.

> **Tip:** Ketika seseorang bilang "kita butuh data warehouse", kebutuhan sebenarnya hampir selalu: "kita butuh angka yang bisa dipercaya tanpa memperlambat produk." Ingat kalimat itu; ia menjelaskan sebagian besar keputusan desain di kursus ini.

## @lesson Siapa mengerjakan apa: peran di sekitar data
Nama jabatan saling tumpang tindih dan berbeda antar perusahaan, jadi pikirkan **pekerjaannya**, bukan namanya. Pembagian yang umum, masih dengan KopiKu:

| Peran | Pertanyaan utama | Yang diserahkan |
|---|---|---|
| **Software engineer** | "Bagaimana kita membangun tokonya?" | Website, aplikasi, dan database produksi |
| **Data engineer** | "Bagaimana membawa data dari semua tempat ke satu tempat yang bisa dipercaya, tepat waktu?" | Pipeline, tabel, tes, monitoring |
| **Analytics engineer** | "Bagaimana mengubah tabel mentah menjadi definisi bisnis yang bersih dan dipakai bersama?" | Tabel terstruktur seperti `fct_orders` dan `dim_customers`, lengkap dengan dokumentasi |
| **Data analyst** | "Apa yang terjadi, dan mengapa?" | Dashboard, laporan, jawaban atas pertanyaan bisnis |
| **Data scientist / ML engineer** | "Apa yang akan terjadi, dan apa yang sebaiknya dilakukan?" | Prakiraan, rekomendasi, model |
| **Platform / DevOps engineer** | "Bagaimana menjalankan semua ini dengan aman?" | Server, jaringan, akses, alat deployment |

Di perusahaan kecil satu orang mengerjakan beberapa peran sekaligus. Di perusahaan besar tiap peran adalah satu tim. Yang tidak berubah adalah ketergantungannya: analis dan data scientist hanya bisa sebaik data yang mereka terima. Model yang dilatih dengan pesanan ganda belajar hal yang salah; dashboard di atas tabel yang diam-diam berhenti diperbarui menyesatkan CEO.

Cara yang berguna untuk menggambarkan hasil kerja data engineer: **produk seorang data engineer adalah kepercayaan**. Orang harus bisa membuka sebuah tabel, percaya angkanya, dan tahu seberapa baru data itu. Semua yang Anda pelajari di kursus ini (pengujian, idempotensi, kontrak data, monitoring) melayani satu tujuan itu.

Keterampilan yang penting, kira-kira sesuai urutan kursus ini: SQL, Python, command line dan Git, pemodelan data, format dan mesin penyimpanan, transformasi, orkestrasi, kualitas data, lalu sistem terdistribusi dan real-time. Anda tidak perlu semuanya di hari pertama; Anda perlu empat yang pertama untuk memulai dan kebiasaan mempelajari sisanya lewat masalah nyata.

## @lesson Perjalanan satu pesanan
Ikuti satu pesanan KopiKu, #4821, dari HP pelanggan sampai dashboard CEO. Setiap langkah adalah tahap yang dirancang dan dirawat oleh data engineer.

1. **Sumber.** Budi menekan "Bayar" di aplikasi. Backend menulis satu baris di tabel `orders` di PostgreSQL, dan website juga mengirim event klik ("purchase") ke pelacak analitik. Inilah **sumber**: database, aliran event, file dari mitra, API pihak ketiga (pembayaran, iklan).
2. **Ingestion.** Sebuah job menyalin data baru dan data yang berubah dari tiap sumber. Ia mungkin membaca database tiap jam, membaca file yang diunggah mitra tiap malam, atau mendengarkan aliran event. Di sinilah hal pertama yang sering salah, karena Anda tidak mengendalikan sumbernya.
3. **Penyimpanan mentah.** Data mendarat apa adanya di area **raw** (sering disebut bronze). Anda menyimpan aslinya supaya kalau langkah berikutnya punya bug, Anda bisa menjalankannya ulang dari input yang asli.
4. **Transformasi.** Job membersihkan data (memperbaiki tipe, menghapus duplikat, menyeragamkan status), menggabungkannya (pesanan dengan pelanggan dan produk), dan menghitung konsep bisnis (omset, pelanggan aktif). Hasilnya adalah lapisan **bersih** (silver) dan lapisan **terstruktur** (gold) yang dibentuk untuk menjawab pertanyaan.
5. **Penyajian.** Dashboard, notebook analis, model machine learning, dan kadang produk itu sendiri membaca tabel terstruktur.
6. **Operasi.** Sepanjang jalan, scheduler menjalankan job sesuai urutan, tes memeriksa data, dan monitoring memberi tahu bila ada yang terlambat atau salah. Inilah bagian yang dilewati tutorial dan dibayar perusahaan.

Dua istilah yang akan sering Anda temui:

- **Batch vs streaming.** Batch berarti memproses data dalam potongan menurut jadwal (tiap jam, tiap malam). Streaming berarti memproses setiap event dalam hitungan detik setelah terjadi. Sebagian besar pekerjaan data adalah batch. Streaming lebih rumit dan lebih mahal; pakai hanya jika sebuah keputusan bisnis benar-benar butuh data segar (deteksi fraud, stok langsung).
- **ETL vs ELT.** ETL mengubah data *sebelum* dimuat ke warehouse. ELT memuat data mentah lebih dulu lalu mengubahnya *di dalam* warehouse dengan SQL. Warehouse cloud modern cukup kuat dan murah sehingga ELT menjadi pilihan umum, itulah sebabnya alat seperti dbt (Modul 2.3) ada.

> **Tip:** Gambarlah perjalanan data untuk setiap sistem yang Anda kerjakan: kotak untuk sumber, panah untuk job, dan tanda di setiap tempat kegagalan tidak akan terlihat. Gambar itu adalah hasil kerja pertama yang paling berguna bagi data engineer.

## @lesson Lima cara data menjadi salah
Dataset KopiKu yang akan Anda pakai sepanjang kursus ini sengaja dibuat sedikit kotor, karena data nyata memang begitu. Masalah-masalah ini mencakup sebagian besar yang akan pernah Anda debug. Kenali sejak awal.

**1. Duplikat.** Pesanan yang sama muncul dua kali. Penyebab: job mencoba ulang setelah timeout lalu memuat file lagi; sumber mengirim "setidaknya sekali"; dua sumber melaporkan event yang sama. Akibat: omset terhitung dua kali. Pertahanan: beri setiap record kunci yang stabil dan buat pemuatan *idempoten* (dijalankan dua kali hasilnya sama), yang dibahas mendalam di Modul 2.4.

**2. Data terlambat atau hilang.** File mitra tiba pukul 09.40, bukan 06.00. Aplikasi seluler sempat offline dan baru mengirim event kemarin hari ini. Akibat: laporan kemarin salah, lalu diam-diam "membaik sendiri". Pertahanan: catat dua waktu (kapan kejadiannya dan kapan Anda menerimanya), dan rancang job agar memproses ulang beberapa hari terakhir.

**3. Perubahan skema (schema drift).** Tim sumber mengganti nama kolom `total` menjadi `total_amount`, atau mengubah integer menjadi teks, tanpa memberi tahu. Akibat: job Anda crash, atau lebih buruk, mengisi kolom dengan null dan jalan terus. Pertahanan: validasi bentuk data di pintu masuk dan sepakati *data contract* dengan produsen data (Modul 2.5).

**4. Nilai rusak.** Total negatif, `"Rp 1.250.000"` di tempat yang seharusnya angka, status yang ditulis `PAID`, `paid`, dan `Paid`, id pelanggan yang tidak ada, tanggal yang ditulis hari-dulu. Akibat: penjumlahan salah, join rusak, baris hilang tanpa suara. Pertahanan: parse dengan ketat, seragamkan, dan kirim baris yang tidak bisa dipercaya ke **karantina**, jangan menebak atau membuangnya diam-diam.

**5. Perubahan volume dan kecepatan.** Black Friday melipatgandakan trafik sepuluh kali, atau sebuah bug memotongnya setengah. Job yang biasanya lima menit kini lima jam, atau kehabisan memori. Akibat: dashboard terlambat, job crash, tagihan cloud yang mengejutkan. Pertahanan: ukur volume dan durasi, beri alert pada anomali, dan rancang untuk skala (Level 2 dan 3).

Ada kategori keenam yang layak disebut: **kegagalan infrastruktur** (server restart di tengah job, disk penuh, kredensial kedaluwarsa). Kurang menarik, tetapi menyebabkan banyak insiden jam 3 pagi. Pertahanan untuk keenamnya sama: **validasi di batas, buat setiap langkah aman dijalankan ulang, dan amati semuanya.**

> **Peringatan:** Kegagalan paling berbahaya adalah yang *diam-diam*. Crash terlihat dan beres dalam sejam. Pipeline yang berjalan "sukses" dan menulis angka salah bisa menyesatkan keputusan berminggu-minggu. Setiap kali merancang sesuatu di kursus ini, tanyakan: "kalau ini salah, bagaimana saya akan mengetahuinya?"

> 💡 **Jeda Praktik 1 (Eksplorasi Data Kotor):**
> Sebelum lanjut membaca teori format, buktikan kelima masalah ini di komputer Anda! Buka terminal di folder kursus, buat datanya, lalu intip file pesanan:
> `python3 labs/shared/shopgen.py --out data`
> `head -20 data/orders.csv`
> `grep -c "Rp " data/orders.csv` (total yang ditulis format teks)
> `grep -c ",-" data/orders.csv` (total bernilai minus/rusak)
> `cat data/manifest.json` (lihat daftar anomali yang sengaja ditanam generator)
> Anda sekarang melihat langsung apa yang dihadapi seorang data engineer di dunia nyata. Lanjut ke Pelajaran 5 di bawah.

## @lesson Format data yang akan Anda temui
Data datang dalam beberapa format file. Mengetahui jebakannya menghemat berjam-jam.

**CSV** (comma-separated values) adalah format pertukaran paling umum dan paling tidak andal. Ia tidak punya tipe: semua nilai adalah teks, sehingga `007`, `7`, dan `"7"` tidak bisa dibedakan sampai Anda memutuskan. Ia tidak punya standar untuk tanggal, pemisah desimal, tanda kutip, atau encoding; nama pelanggan yang mengandung koma atau baris baru merusak parsing yang naif. Selalu pakai parser CSV yang benar (modul `csv` Python), jangan pernah `line.split(",")`, dan selalu tentukan encoding (biasanya UTF-8).

**JSON** dan **NDJSON**. JSON menggambarkan data bersarang dan punya tipe dasar (string, angka, boolean, null). NDJSON (newline-delimited JSON) menaruh satu objek JSON per baris, sehingga Anda bisa memproses file raksasa baris demi baris tanpa memuat semuanya. Event klik dan log biasanya memakai NDJSON. Waspadai field yang kadang tidak ada dan angka yang datang sebagai string.

**Parquet** adalah format biner *kolumnar* untuk analitik. Ia menyimpan tiap kolom bersama-sama, terkompresi baik, dan mempertahankan tipe, sehingga membaca tiga kolom dari lima puluh hanya membaca tiga kolom itu. Anda akan memakainya intensif mulai Modul 2.1. Anda tidak bisa membukanya di editor teks, harga yang wajar untuk ukuran yang jauh lebih kecil dan kecepatan yang jauh lebih tinggi daripada CSV.

**Tabel database** adalah sumber utama lainnya. Anda membacanya dengan SQL, baik sebagai salinan penuh maupun dengan menangkap hanya yang berubah (change data capture, Modul 3.2).

Aturan praktis: CSV dan JSON untuk *pertukaran* (manusia dan sistem lain mengirimkannya kepada Anda); Parquet dan tabel database untuk *penyimpanan dan analisis*. Langkah pertama pipeline yang umum adalah mengubah yang pertama menjadi yang kedua, dengan tipe yang dipaksakan.

> 💡 **Jeda Praktik 2 (Parser Angka & Timestamp):**
> Jangan baca materi berikutnya dulu! Buka `labs/mod-0-1/pipeline.py` di Text Editor Anda (klik di sidebar atau ketik `code labs/mod-0-1/pipeline.py`).
> Terapkan konversi tipe data yang baru Anda pelajari:
> 1. Kerjakan `parse_total(raw)`: bersihkan "Rp" dan titik, ubah ke integer Rupiah, dan return `None` jika teks rusak/kosong.
> 2. Kerjakan `parse_ts(raw)`: terima kedua format timestamp dan ubah menjadi teks ISO "YYYY-MM-DDTHH:MM:SS" atau `None`.
> Uji kedua parser di terminal:
> `pytest labs/mod-0-1/test_lab.py -v -k TestParsers`
> Jika 2 tes parser PASSED, Anda siap melangkah ke aturan pembersihan defensif di Pelajaran 6.

## @lesson Cara kerja kursus ini, dan data KopiKu
Setiap modul punya empat bagian, dan sebaiknya dikerjakan berurutan:

1. **Materi** (halaman ini). Baca sambil membuka lab di sebelahnya.
2. **Lab.** Anda menulis kode sungguhan terhadap data KopiKu. Setiap lab punya tes otomatis sehingga Anda tahu solusi Anda benar-benar benar, bukan sekadar "jalan". Solusi referensi disertakan; buka hanya setelah Anda mencoba.
3. **Chaos lab.** Kegagalan produksi bergaya nyata. Tebak penyebabnya sebelum membaca jawaban. Debugging adalah keterampilan yang dibangun dengan berlatih.
4. **Kuis.** Pertanyaan pendek untuk memeriksa bahwa Anda memahami gagasannya, bukan sintaksnya.

Data untuk setiap lab berasal dari satu generator, `labs/shared/shopgen.py`. Dengan pengaturan yang sama ia selalu menghasilkan file yang sama, sehingga hasil Anda bisa diperiksa dengan tepat. Ia membuat pelanggan, produk, pesanan dan baris pesanan, event website, dan log perubahan pelanggan, lalu menanam masalah dari pelajaran sebelumnya dengan tingkat yang diketahui: baris duplikat, total bergaya `Rp 1.250.000`, status huruf campur, dua format tanggal, total negatif, id pelanggan yatim, baris JSON terpotong. Sebuah `manifest.json` mencatat persis apa yang ditanam, dan itulah cara tes mengetahui jawaban yang benar.

Dua kebiasaan akan membantu lebih daripada alat apa pun:

- **Lihat datanya dulu.** Sebelum menulis kode, buka file dan baca lima puluh baris. Setiap bug serius di kursus ini bisa terlihat dengan mata kalau Anda mau melihat.
- **Tuliskan arti "benar".** Untuk setiap job, nyatakan satu atau dua fakta yang harus berlaku pada outputnya (misalnya: "tiap pesanan muncul sekali"; "omset harian tidak pernah menghitung pesanan yang dibatalkan"). Kalimat-kalimat itu menjadi tes Anda.

> 💡 **Jeda Praktik 3 (Pembersihan Defensif & Agregasi Omset):**
> Buka kembali `labs/mod-0-1/pipeline.py` di editor Anda untuk menuntaskan seluruh lab:
> 1. Kerjakan `clean_orders(rows)`: pisahkan data menjadi `clean` dan `rejected` (dengan mencatat `reason` untuk setiap baris yang dibuang). Tangani duplikat order_id dengan mempertahankan baris pertama.
> 2. Kerjakan `daily_revenue(clean)`: hitung total omset per tanggal `YYYY-MM-DD` dengan mengabaikan status cancelled dan refunded.
> Jalankan seluruh pengujian di terminal:
> `pytest labs/mod-0-1/test_lab.py -v`
> Setelah semua 8 tes HIJAU, jalankan pipeline pada data riil:
> `python3 labs/mod-0-1/pipeline.py data/orders.csv`
> Selamat! Anda telah membangun pipeline pembersihan data defensif pertama Anda!

## @lab Lab: bersihkan file pesanan KopiKu
Anda punya file berisi baris pesanan dengan masalah-masalah di atas. Tulis empat fungsi kecil yang mengubahnya menjadi data yang bisa dipercaya dan menghitung omset harian. Ini versi mini dari apa yang dilakukan setiap pipeline: baca, validasi, seragamkan, karantina apa yang tidak bisa dipercaya, lalu hitung.

### @steps
1. Pastikan Python 3 berjalan (`python3 --version`). Jika Anda belum punya file kursus, ikuti dulu halaman **Mulai di sini** di aplikasi (di sana dijelaskan cara mengunduhnya dan di folder mana terminal dibuka; Modul 0.2 mengajarkan terminal dan Git dengan benar). Dari root repositori, buat datanya:

```bash
python3 labs/shared/shopgen.py --out data
```

2. Lihat dulu sebelum menulis kode. Baca file dan temukan masalahnya dengan mata Anda sendiri:

```bash
head -20 data/orders.csv
grep -c "Rp " data/orders.csv     # total yang ditulis sebagai teks
grep -c ",-" data/orders.csv      # total negatif
cat data/manifest.json            # apa yang ditanam, dan berapa banyak
```

3. Buka `labs/mod-0-1/pipeline.py` di Text Editor Anda (misal: klik di sidebar editor atau ketik `code labs/mod-0-1/pipeline.py`; jangan jalankan langsung di bash!). Empat fungsi melempar `NotImplementedError`. Implementasikan dengan urutan ini, jalankan tes setelah masing-masing:
   `parse_total`, lalu `parse_ts`, lalu `clean_orders`, lalu `daily_revenue`.
4. Putuskan apa yang dilakukan pada baris yang tidak bisa dipercaya. Aturan lab ini: **jangan menebak dan jangan membuang diam-diam.** Setiap baris yang dibuang masuk ke `rejected` dengan alasan singkat.
5. Jalankan program pada file asli dan bandingkan jumlah baris masuk dan keluar:

```bash
python3 labs/mod-0-1/pipeline.py data/orders.csv
```

6. Opsional: tulis tiga kalimat di `NOTES.md` yang menjelaskan masalah yang Anda temukan dan mana yang paling mengejutkan.
7. **Kerjakan yang sesungguhnya.** Kotak di browser di atas hanya pratinjau. Setelah Modul 0.2 (terminal, venv, Git), ulangi lab ini di komputer Anda sendiri: buat venv, `pip install pytest`, tulis ulang keempat fungsi di editor Anda **tanpa menyalin**, lalu jalankan `pytest labs/mod-0-1/test_lab.py -v` sampai hijau. Penyiapan itu bagian dari keterampilannya. Setelah itu jalankan `python3 scripts/prove.py mod-0-1` di dalam venv Anda: perintah itu mencetak kode bukti yang Anda tempel ke kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-0-1/pipeline.py :: File kerja Anda: implementasikan empat fungsi TODO :: starter
- labs/mod-0-1/test_lab.py :: Tes yang memeriksa pekerjaan Anda :: test
- labs/shared/shopgen.py :: Generator data KopiKu :: data
- labs/mod-0-1/reference/pipeline.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 8 tes di test_lab.py lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri** (lulus di pratinjau browser tidak dihitung)
- Setiap baris yang dibuang muncul di `rejected` dengan alasan
- Anda bisa menjelaskan masalah mana dari kelima masalah yang diwakili tiap baris yang ditolak atau diperbaiki

### @verify
Jalankan tes dari root repositori:

```bash
python3 labs/mod-0-1/test_lab.py -v
```

Semua tes harus mencetak `ok`. Untuk melihat seperti apa hasil yang lulus sebelum Anda mulai, jalankan tes terhadap solusi referensi: `LAB_DIR=reference python3 labs/mod-0-1/test_lab.py`.

## @chaos Omset hari Selasa yang berlipat dua
### @scenario
Rabu pagi CEO bertanya mengapa omset hari Selasa tepat dua kali lipat angka biasanya. Tidak ada yang istimewa: tidak ada kampanye, tidak ada perubahan harga. Job malam yang memuat pesanan ke database analitik melaporkan "sukses" setiap hari. Pesanan hari Selasa di database toko tampak normal.

Anda diberi log job itu: pada Selasa malam langkah pemuatan berjalan pukul 01.00, gagal pukul 01.07 dengan timeout jaringan saat *menulis*, dan scheduler otomatis mencobanya ulang pukul 01.10. Percobaan ulang selesai dengan normal.

### @cause
Job itu **menambahkan** (append) pesanan hari itu ke tabel analitik dengan `INSERT` biasa. Percobaan pertama sudah menulis sebagian besar baris sebelum timeout. Percobaan ulang mulai dari awal dan menulis *semua* baris lagi. Baris dari percobaan pertama tidak pernah dihapus, sehingga sebagian besar pesanan kini ada dua kali, dan setiap `SUM(total)` menghitungnya ganda.

Dua hal memperburuk keadaan: job melaporkan sukses setelah percobaan ulang sehingga tidak ada alert, dan tidak ada yang memeriksa bahwa setiap id pesanan hanya muncul sekali.

### @fix
1. Perbaiki datanya: untuk hari yang terdampak, hapus dan muat ulang barisnya, atau buang duplikat dengan menyisakan satu baris per `order_id`.
2. Buat pemuatan **idempoten**: ganti data hari itu dalam satu langkah atomik (hapus hari itu dan masukkan ulang dalam satu transaksi, atau pakai `MERGE`/upsert berkunci `order_id`) alih-alih menambahkan membabi buta.
3. Tambahkan pemeriksaan yang menggagalkan job bila ada `order_id` yang muncul lebih dari sekali, dan pemeriksaan yang membandingkan jumlah baris hari itu dengan sumbernya.

### @pattern
Anggap setiap job suatu hari akan berjalan dua kali. Kalau menjalankannya dua kali mengubah hasil, job itu belum selesai. Gagasan ini (idempotensi) muncul kembali di hampir setiap modul.

## @quiz
### Mengapa perusahaan biasanya membangun database analitik terpisah alih-alih membuat laporan langsung dari database produksi?
- [ ] Database produksi dirancang hanya menyimpan data satu tahun terakhir, sehingga riwayat lama tetap harus disimpan di sistem lain
- [x] Query analitik yang besar memperlambat transaksi pelanggan, dan tabel produksi dirancang untuk menulis, bukan untuk menganalisis
- [ ] Database analitik tidak memakan biaya karena hanya berisi salinan, sehingga memisahkannya selalu menurunkan tagihan bulanan
- [ ] Query SQL tidak bisa dijalankan di database produksi, sehingga analis harus mengekspor semua tabel ke spreadsheet terlebih dahulu

> Sistem produksi (OLTP) harus tetap cepat untuk tulisan kecil. Memindai jutaan baris di sana memperlambat produk, dan desainnya (kondisi terkini, banyak tabel kecil) kurang cocok untuk analisis riwayat.

### Dalam contoh KopiKu, peran mana yang terutama bertanggung jawab membawa data dari website, pembayaran, dan iklan ke satu tempat yang bisa dipercaya tepat waktu?
- [ ] Data analyst, yang membuat dashboard yang dibaca seluruh perusahaan setiap pagi
- [x] Data engineer, yang membangun dan menjalankan pipeline pemindah data
- [ ] Software engineer tim checkout, yang memegang skema database produksi
- [ ] Data scientist, yang melatih model peramal permintaan bulan depan

> Data engineer membangun dan menjalankan pipeline yang memindahkan dan menyiapkan data. Analis dan scientist memakai hasilnya; software engineer membangun sumbernya.

### Sebuah job malam memuat pesanan hari itu dengan menambahkannya ke tabel. Ia gagal di tengah dan scheduler mencobanya ulang otomatis. Apa hasil yang paling mungkin?
- [ ] Tabel tidak berubah, karena job yang gagal selalu membatalkan semua yang ditulisnya sebelum gagal
- [ ] Percobaan ulang mengenali baris yang sudah ada dan melewatinya, sehingga tiap pesanan tersimpan tepat sekali
- [x] Banyak pesanan termuat dua kali sehingga semua penjumlahan, hitungan, dan rata-rata hari itu terlalu tinggi
- [ ] Percobaan ulang lebih dulu menghapus seluruh tabel lalu membangunnya lagi, sehingga data benar tetapi lama muncul

> Append biasa tidak mengingat percobaan pertama. Kecuali pemuatan itu idempoten (ganti atau upsert berdasarkan kunci), percobaan ulang menambahkan barisnya lagi.

### Pernyataan mana tentang pemrosesan batch dan streaming yang benar?
- [ ] Streaming selalu desain yang lebih baik karena lebih baru dan karena itu menangani semua beban kerja dengan lebih murah
- [ ] Batch tidak sanggup menangani data besar, dan itu alasan utama perusahaan beralih ke streaming
- [x] Batch lebih sederhana dan terjadwal; streaming bereaksi dalam hitungan detik tetapi lebih sulit dijalankan
- [ ] Perusahaan harus memilih salah satu, karena sistem batch dan streaming tidak bisa berbagi data yang sama

> Sebagian besar analitik adalah batch. Streaming menambah kerumitan state, urutan, dan pemulihan kegagalan, yang sepadan untuk hal seperti deteksi fraud tetapi tidak untuk laporan mingguan.

### Apa alasan utama menyimpan salinan data masuk yang tidak diubah di lapisan raw?
- [ ] Data mentah memakai penyimpanan lebih sedikit daripada data bersih, sehingga menyimpannya lebih dulu menghemat biaya di setiap langkah berikutnya
- [ ] Salinan mentah membuat dashboard tampil lebih cepat karena datanya belum melewati transformasi yang lambat
- [x] Bila transformasi berikutnya punya bug, Anda bisa memperbaikinya dan menjalankan ulang semuanya dari input asli
- [ ] Peraturan perlindungan data mewajibkan setiap tabel di warehouse punya tabel mentah pendamping yang tidak disentuh

> Memproses ulang dari raw membuat perbaikan dan backfill mungkin. Kalau Anda hanya menyimpan data hasil transformasi, bug di transformasi bisa menghancurkan buktinya.

### Tim sumber mengganti nama kolom `total` menjadi `total_amount` tanpa memberi tahu Anda. Job Anda tetap jalan tetapi kolom omset kini kosong. Ini termasuk kategori masalah apa?
- [ ] Duplikat: kolom yang diganti namanya termuat berdampingan dengan yang lama, sehingga setiap pesanan muncul dua kali
- [ ] Data terlambat: nama kolom baru tiba setelah yang lama, sehingga omset terisi beberapa jam kemudian
- [x] Schema drift yang tidak ketahuan karena tidak ada yang memeriksa bentuk data masuk
- [ ] Lonjakan volume: job melambat begitu parah sampai berhenti menulis kolom omset

> Schema drift adalah perubahan struktur sumber. Bagian yang diam-diam itulah kegagalan sebenarnya: pemeriksaan di batas akan menghentikan job dengan error yang jelas.

### Mengapa Anda sebaiknya memakai modul `csv` Python dan bukan `line.split(",")` untuk membaca file CSV?
- [ ] `split` lebih lambat di setiap file, dan modul `csv` ditulis dalam bahasa C untuk menghindari biaya itu
- [ ] Modul `csv` mengubah setiap kolom ke tipe yang benar secara otomatis, sehingga tidak perlu pembersihan lagi
- [ ] `split` tidak bisa membaca file yang lebih besar dari memori, sedangkan modul `csv` selalu membaca satu baris sekali waktu
- [x] Nilai CSV berkutip bisa berisi koma, tanda kutip, atau baris baru, yang dipotong `split` di tempat yang salah

> Nilai seperti `"Santoso, Budi"` mengandung koma yang bukan pemisah. Modul csv mengikuti aturan kutipan. Perhatikan ia tetap mengembalikan semua nilai sebagai teks; mengubah tipe adalah tugas Anda.

### Sebuah pipeline berjalan tiap malam dan melaporkan sukses, tetapi selama tiga minggu menulis pesanan dengan total 0 karena bug parsing. Apa yang paling cepat menangkapnya?
- [ ] Menjalankan job yang sama di server lebih cepat supaya selesai sebelum ada yang membuka dashboard
- [x] Pemeriksaan pada output, seperti "tidak ada total nol atau negatif" dan "omset dalam rentang normal"
- [ ] Mengirim seluruh file log job ke CEO setiap pagi supaya ada yang membaca peringatannya
- [ ] Mengganti format input dari CSV ke JSON, yang punya tipe angka sungguhan sehingga tidak mungkin menghasilkan nol

> Sukses sebuah job hanya berarti kodenya berjalan. Pemeriksaan isi output yang menunjukkan apakah hasilnya masuk akal. Kegagalan senyap tertangkap oleh tes pada data, bukan pada eksekusi.

## @resources
- [Dokumentasi modul csv Python](https://docs.python.org/3/library/csv.html)
- [Python datetime: kode format strptime](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes)
