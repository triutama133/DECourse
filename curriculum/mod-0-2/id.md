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
Modul 0.0 (Python dari nol) dan Modul 0.1 (terminal, virtual environment, dan `pytest`) mempersiapkan Anda untuk modul ini: lab ini memakai fungsi, perulangan, dictionary, penanganan error, dan menjalankan `pytest` di dalam venv kursus Anda (`python -m pip install -r labs/mod-0-2/requirements.txt`). Python 3.10+ apa pun bisa dipakai, dan pratinjau browser juga tersedia jika Anda ingin mencoba cepat dulu.

> [!IMPORTANT]
> **Pengingat Editor vs Terminal:**
> Buka dan edit file kode (seperti `labs/mod-0-2/pipeline.py`) menggunakan Text Editor Anda (VS Code / Cursor / tab Lab di aplikasi). Jangan menjalankan file kode langsung di terminal bash tanpa interpreter python (misal: jangan ketik `labs/mod-0-2/pipeline.py` di terminal). Gunakan terminal untuk menjalankan skrip Python (seperti `python labs/mod-0-2/pipeline.py`), memeriksa file, dan menjalankan pengujian (seperti `pytest labs/mod-0-2/test_lab.py -v`).

## @part Pekerjaannya dan orang-orangnya

## @lesson Mengapa profesi ini ada: dua jenis database
Bayangkan **KopiKu**, toko online kecil yang menjual biji kopi spesialti dari Gayo, Toraja, dan Flores. Setiap kali pelanggan menekan "Bayar", website menulis satu baris baru ke database: siapa yang membeli, apa, berapa, kapan. Database itu ada untuk menjalankan toko. Ia harus menjawab pertanyaan kecil dengan sangat cepat ("apa isi keranjang pelanggan ini?") dan tidak boleh kehilangan satu pesanan pun. Jenis database seperti ini disebut **OLTP** (Online Transaction Processing). PostgreSQL dan MySQL adalah pilihan yang umum.

Lalu pendiri toko bertanya: "Berapa pendapatan (omzet) per kota, per minggu, selama dua tahun terakhir?" Untuk menjawabnya, database harus membaca jutaan baris, mengelompokkan, dan menjumlahkannya. Ini pertanyaan **OLAP** (Online Analytical Processing). Bentuk pekerjaannya sama sekali berbeda:

| | OLTP (menjalankan toko) | OLAP (memahami toko) |
|---|---|---|
| Pertanyaan khas | "Simpan pesanan ini." "Tampilkan keranjang #4821." | "Pendapatan per kota per minggu sejak 2024?" |
| Baris yang disentuh per query | Segelintir | Jutaan |
| Kecepatan yang penting | Milidetik untuk satu permintaan | Detik atau menit untuk satu scan besar |
| Pengguna | Pelanggan, ribuan sekaligus | Beberapa analis dan dashboard |
| Data | Kondisi terkini | Seluruh riwayat |
| Tujuan desain | Tidak pernah kehilangan atau merusak operasi penulisan | Membaca dan mengagregasi dengan cepat |

Kalau analis menjalankan query pendapatan dua tahun langsung di **database produksi** (database aktif yang menjalankan toko), query itu berebut CPU, memori, dan disk dengan pelanggan. Checkout melambat, kadang **timeout** (gagal karena permintaan menunggu jawaban terlalu lama), dan toko kehilangan uang selagi seseorang membuat grafik. Sebagian tim menambahkan **read replica** (salinan khusus-baca dari database produksi yang terus diperbarui untuk query) untuk meredam ini, dan itu membantu, tetapi tidak menyelesaikan masalah lain: data dibentuk untuk menulis, bukan menganalisis; ia hanya menyimpan kondisi terkini tiap baris; dan ia terpisah dari sistem pembayaran, iklan, dan event website Anda.

Karena itu perusahaan menyalin data ke **sistem terpisah yang dibangun untuk analisis** (data warehouse atau **lakehouse**, yang menggabungkan penyimpanan file cloud murah dengan tabel SQL bergaya warehouse) dan menjaganya tetap mutakhir. Melakukan penyalinan itu dengan andal, setiap hari, dari puluhan sumber, dengan data yang benar dan terdokumentasi, adalah pekerjaan **data engineer**.

> **Tip:** Ketika seseorang bilang "kita butuh data warehouse", kebutuhan sebenarnya hampir selalu: "kita butuh angka yang bisa dipercaya tanpa memperlambat produk." Ingat kalimat itu; ia menjelaskan sebagian besar keputusan desain di kursus ini.

> 🛠 **Coba sendiri (10 menit, dengan Python).** Buat datanya (Anda sudah melakukannya di Mulai di sini; jika folder `data/` hilang, jalankan lagi `python labs/shared/shopgen.py --out data` di dalam venv kursus aktif dari folder kursus) dan baca `data/orders.csv` dengan `csv.DictReader` dari Modul 0.0 untuk merasakan bedanya **pencarian satu titik OLTP** dan **pemindaian penuh OLAP**:
> 1. Telusuri `3634` baris dan isi dict `by_id` dengan kunci `order_id` (`by_id[row["order_id"]] = row`). Berapa banyak kunci duplikat yang menimpa baris sebelumnya sehingga `len(by_id)` lebih pendek dari `3634`? Perhatikan mencari `by_id["1001"]` langsung menyentuh **satu** item seketika (OLTP).
> 2. Sekarang pindai seluruh baris untuk menghitung berapa pesanan di setiap status huruf kecil (`status = row["status"].strip().lower()`, lalu `counts[status] = counts.get(status, 0) + 1`, baris penghitung dari Modul 0.0). Perhatikan ia harus membaca **semua** `3634` baris (OLAP).
>
> **Seharusnya Anda melihat:** `len(by_id)` bernilai `3599` (artinya ada `35` ID pesanan duplikat di file!), sedangkan `counts` mengunjungi setiap baris dan menghasilkan `delivered: 2148, shipped: 576, paid: 374, cancelled: 362, refunded: 174`. Modul 0.3 menunjukkan bagaimana database SQL melakukan keduanya lewat pencarian `PRIMARY KEY` dibanding pemindaian `GROUP BY`.

## @lesson Siapa mengerjakan apa: peran di sekitar data
Nama jabatan saling tumpang tindih dan berbeda antar perusahaan, jadi pikirkan **pekerjaannya**, bukan namanya. Pembagian yang umum, masih dengan KopiKu:

| Peran | Pertanyaan utama | Yang diserahkan |
|---|---|---|
| **Software engineer** | "Bagaimana kita membangun tokonya?" | Website, aplikasi, dan database produksi |
| **Data engineer** | "Bagaimana membawa data dari semua tempat ke satu tempat yang bisa dipercaya, tepat waktu?" | Pipeline, tabel, tes, monitoring |
| **Analytics engineer** | "Bagaimana mengubah tabel mentah menjadi definisi bisnis yang bersih dan dipakai bersama?" | Tabel terstruktur seperti `fct_orders` (`fct_` = fakta/kejadian) dan `dim_customers` (`dim_` = dimensi/entitas), lengkap dengan dokumentasi |
| **Data analyst** | "Apa yang terjadi, dan mengapa?" | Dashboard, laporan, jawaban atas pertanyaan bisnis |
| **Data scientist / ML engineer** | "Apa yang akan terjadi, dan apa yang sebaiknya dilakukan?" | Prakiraan, rekomendasi, model |
| **Platform / DevOps engineer** | "Bagaimana menjalankan semua ini dengan aman?" | Server, jaringan, akses, alat deployment |

Di perusahaan kecil satu orang mengerjakan beberapa peran sekaligus. Di perusahaan besar tiap peran adalah satu tim. Yang tidak berubah adalah ketergantungannya: analis dan data scientist hanya bisa sebaik data yang mereka terima. Model yang dilatih dengan pesanan ganda belajar hal yang salah; dashboard di atas tabel yang diam-diam berhenti diperbarui menyesatkan CEO.

Cara yang berguna untuk menggambarkan hasil kerja data engineer: **produk seorang data engineer adalah kepercayaan**. Orang harus bisa membuka sebuah tabel, percaya angkanya, dan tahu seberapa baru data itu. Semua yang Anda pelajari di kursus ini (pengujian, idempotensi, kontrak data, monitoring) melayani satu tujuan itu.

Keterampilan yang penting, kira-kira sesuai urutan kursus ini: SQL, Python, command line dan Git, pemodelan data, format dan mesin penyimpanan, transformasi, orkestrasi, kualitas data, lalu sistem terdistribusi dan real-time. Anda tidak perlu semuanya di hari pertama; Anda perlu empat yang pertama untuk memulai dan kebiasaan mempelajari sisanya lewat masalah nyata.

> 🛠 **Coba sendiri (5 menit, pena dan kertas).** Siapa yang mengerjakan? Tulis perannya (software engineer, data engineer, analytics engineer, data analyst, data scientist, atau platform engineer) untuk setiap tugas: (a) job malam yang menyalin pesanan ke warehouse dan memberi peringatan jika terlambat; (b) dashboard pendapatan mingguan per kota; (c) model yang memprediksi pelanggan mana yang akan berhenti memesan; (d) halaman checkout toko; (e) tabel `fct_orders` yang terdokumentasi dengan satu definisi "pendapatan" yang disepakati; (f) klaster yang menjalankan semua job.
>
> *Bandingkan:* (a) data engineer, (b) data analyst, (c) data scientist, (d) software engineer, (e) analytics engineer, (f) platform engineer. Lalu tulis dua kalimat: tugas mana yang akan menjadi tugas Anda di perusahaan berisi lima orang, dan mana yang tidak ingin Anda kerjakan sendirian?

## @lesson Gambaran besar: lima perhentian, enam kebiasaan, dan orang-orangnya
> **Intinya:** Setiap pekerjaan data engineering memindahkan data melewati lima perhentian (yang disebut **tahap siklus hidup** / *lifecycle stages* di buku Reis & Housley): data lahir (generation), tersimpan (storage), dikumpulkan (ingestion), dibersihkan dan dibentuk (transformation), lalu diserahkan kepada orang (serving). Enam kebiasaan (disebut **undercurrents** di buku itu) berjalan di bawah kelimanya: keamanan, manajemen data, DataOps, arsitektur data, orkestrasi, dan software engineering. Sebagian besar pekerjaan adalah soal orang-orang di kiri dan kanan Anda.

Alat berganti tiap tahun, tetapi peta ini tidak. Apa pun yang Anda temui nanti di kursus ini, entah SQL, Parquet, Spark, Kafka, atau dbt, ia berada di salah satu dari lima perhentian. Peta ini berasal dari buku *Fundamentals of Data Engineering* karya Joe Reis dan Matt Housley.

### Lima perhentian, sebagai perjalanan biji kopi

Biji kopi bepergian dari kebun sampai ke cangkir Anda. Data bepergian dengan cara yang sama, dalam lima perhentian. KopiKu menjual biji kopi spesialti secara online, jadi ikuti datanya:

| Perhentian | Biji kopi | Data KopiKu | Yang biasanya salah |
|---|---|---|---|
| **1. Generation** | ditanam di kebun, oleh orang lain | situs web menulis satu baris saat pelanggan menekan "Bayar"; penyedia pembayaran mengirim bukti | pemiliknya mengubahnya tanpa memberi tahu Anda |
| **2. Storage** | menunggu di gudang | file, database, dan tabel warehouse tempat data beristirahat di antara langkah | disk penuh, atau tak ada yang tahu salinan mana yang benar |
| **3. Ingestion** | dijemput truk | job malam yang menyalin pesanan baru dari database toko ke platform Anda | sumber mati, lambat, atau bentuknya berubah |
| **4. Transformation** | disangrai dan diracik | baris mentah menjadi tabel bersih: tipe yang benar, satu baris per pesanan, satu arti yang jelas untuk "pendapatan" | dua tim menghitung "pendapatan" dengan dua cara |
| **5. Serving** | diseduh dan dituang | dashboard pendiri, pertanyaan seorang analis, model prediksi | angkanya datang terlambat, atau salah |

Modul-modul kursus ini menyusuri jalan yang sama: generation dan ingestion (Modul 1.6 dan 3.2), storage (1.7, 2.1, 2.2, dan 2.6), transformation (0.3, 1.3, 1.4, dan 2.3), dan serving (2.6 dan 3.5).

:::ask Sang pendiri berkata: "Dashboard menunjukkan pendapatan nol untuk kemarin, padahal saya melihat pesanan kemarin di database toko." Perhentian mana yang Anda periksa lebih dulu?
@options
generation: pelanggan mungkin berhenti membayar kemarin
* ingestion: penyalinan pesanan semalam mungkin tidak berjalan
serving: pendiri mungkin melihat layar yang salah
@why
Pesanannya ada di sumber (generation berhasil), jadi angkanya hilang di tengah jalan. Tersangka pertama adalah truknya: job yang mengumpulkan pesanan dan membawanya ke platform. Kegagalan diam-diam di sana membuat dashboard kosong sementara toko tampak baik-baik saja.
:::

### Enam kebiasaan (undercurrents) di bawah setiap perhentian

Ini bukan perhentian tambahan. Reis & Housley menyebutnya **undercurrents** karena ini adalah kebiasaan yang Anda perlukan di *setiap* tahap siklus hidup, dan masing-masing sebenarnya adalah pertanyaan yang terus Anda ajukan:

- **Keamanan**: siapa yang boleh melihat ini? Nomor telepon pelanggan tidak boleh terlihat oleh setiap anak magang.
- **Manajemen data**: apakah angka ini benar, dan apakah kita boleh menyimpannya? (Kualitas, definisi yang jelas, privasi.)
- **DataOps**: apakah kita akan tahu saat ini rusak? Tes dan alarm otomatis, seperti alat pendeteksi asap di dapur.
- **Arsitektur data**: bagaimana bagian-bagiannya saling cocok, dan bisakah satu diganti tanpa merusak yang lain?
- **Orkestrasi**: dalam urutan apa, dan pada jam berapa? Seperti dapur: susu harus dikukus sebelum dituang. **Orchestrator** adalah program yang menjalankan job Anda dalam urutan yang benar dan memberi tahu saat ada yang gagal (Modul 2.4).
- **Software engineering**: bisakah orang lain membaca, menguji, dan mengubah kode ini tahun depan?

Itulah sebabnya lowongan data engineer terdengar seperti pekerjaan DevOps atau software engineering: kebiasaan-kebiasaan ini bagian dari pekerjaannya.

:::ask Seseorang bertanya: "Bolehkah anak magang baru membaca nomor telepon pelanggan di tabel analitik?" Pertanyaan ini tentang kebiasaan yang mana?
@options
software engineering, yang menjaga kode tetap terbaca
* keamanan, yang menentukan siapa boleh melihat apa
orkestrasi, yang mengatur urutan jalannya semua job
@why
"Siapa boleh melihat apa" adalah keamanan. Orkestrasi soal urutan dan waktu job, dan software engineering soal kode yang bisa dibaca dan diubah orang lain. Data engineer yang baik mengajukan pertanyaan keamanan di setiap perhentian, bukan hanya di akhir.
:::

Materi berikutnya membahas dua hal yang sama pentingnya dengan alat: seberapa besar pekerjaan data sebuah perusahaan seharusnya, dan orang-orang yang akan Anda ajak bekerja setiap hari.

## @lesson Seberapa besar pekerjaan data yang cocok untuk sebuah perusahaan, dan dengan siapa Anda bekerja
Rancangan yang sama bisa tepat untuk satu perusahaan dan keliru untuk yang lain. Bayangkan tiga bisnis kopi yang semuanya meminta Anda membuat "sebuah dashboard":

| Tahap | Bisnisnya | Yang diminta | Yang biasanya cocok |
|---|---|---|---|
| **1. Mulai dengan data** | gerobak kopi dengan tablet dan spreadsheet penjualan | beberapa angka yang bisa dipercaya pemiliknya | alat siap pakai: layanan yang menyalin data untuk Anda, database analisis kecil yang berjalan di satu laptop (DuckDB), beberapa tabel bersih |
| **2. Berkembang dengan data** | lima kafe dan toko online; laporan rusak saat sumber berubah; dua tim menyebut dua angka "pendapatan" yang berbeda | satu arti yang disepakati untuk setiap angka, dan laporan yang tidak rusak | tes, definisi yang disepakati, **data contract** (janji tertulis tentang kolom mana yang akan tetap stabil, Modul 2.5), orchestrator (Modul 2.4), tabel yang dirancang baik |
| **3. Memimpin dengan data** | jaringan dengan aplikasi yang merekomendasikan minuman dan memeriksa pembayaran untuk penipuan: data adalah bagian dari produk | jawaban dalam hitungan detik, untuk jutaan pelanggan | sistem khusus di tempat yang memberi keunggulan, seperti **streaming** (memproses event saat terjadi, Modul 3.3), ditambah **governance** yang kuat (aturan tentang siapa boleh memakai data apa) |

Buku itu menyebut ini tahap-tahap *kematangan data*. Kesalahan klasik adalah perusahaan tahap 1 yang membangun platform tahap 3: berbulan-bulan mengerjakan klaster server sebelum ada yang melihat satu angka berguna.

Buku itu juga menyebut dua jenis data engineer, dan mesin kopi menjelaskannya. **Tipe A** (A untuk *abstraction*) membeli mesin siap pakai dan menghindari membangun apa yang bisa dibeli. **Tipe B** (B untuk *build*) membangun mesin khusus karena tak ada di pasaran yang cocok. Engineer Tipe A berguna di setiap tahap; Tipe B kebanyakan berguna pada tahap 2 dan 3.

:::ask Sebuah kafe satu orang dengan satu spreadsheet meminta Anda memasang klaster server untuk streaming real-time. Apa langkah pertama yang paling berguna?
@options
* tanyakan keputusan yang didukung angka itu, lalu pilih alat paling sederhana
bangun klasternya sekarang, karena kafe pasti akan tumbuh ke sana
tolak pekerjaannya, karena spreadsheet tidak akan pernah bisa diperbaiki
@why
Perusahaan tahap 1 butuh beberapa angka tepercaya dengan cepat. Tanyakan keputusan apa yang akan mereka buat dengan angka itu dan seberapa sering mereka melihatnya, lalu pilih alat paling sederhana yang melayaninya. Membangun untuk tahap 3 di masa depan menghabiskan berbulan-bulan dan tidak menghasilkan apa pun hari ini.
:::

### Orang-orang di kiri dan kanan Anda

Di database lowongan TalentHub, 64% dari 1.130 lowongan data engineering menyebut komunikasi atau *stakeholder* (orang yang meminta, memakai, atau terdampak pekerjaan data Anda). Itu lebih banyak daripada yang menyebut Spark (46%) dan hampir sebanyak yang menyebut Python (69%). Buku itu menyatakannya terang-terangan: tim data jarang gagal karena teknologi.

- **Hulu: orang yang menghasilkan data**, biasanya application engineer. Bagi mereka database ada untuk menjalankan aplikasi, dan laporan Anda adalah efek samping. Saat mereka merusak pipeline Anda, keluhan tidak menghasilkan apa-apa. Jelaskan apa yang rusak di hilir dan siapa yang bergantung padanya, dan sepakati tertulis kolom mana yang akan mereka jaga stabil (sebuah data contract, Modul 2.5).
- **Hilir: orang yang memakai data:** analis, data scientist, manajer. Mereka sering meminta solusi yang pernah mereka dengar ("kami butuh dashboard real-time") alih-alih masalah yang mereka punya. Tanyakan tentang keputusannya: *Apa yang akan Anda lakukan saat angka ini berubah, dan seberapa cepat Anda perlu bertindak?* Jika jawabannya "kami melihatnya di rapat Senin", job harian yang andal mengalahkan sistem streaming.

:::ask Seorang analis berkata: "Kami butuh dashboard real-time." Apa balasan yang paling berguna?
@options
"Real-time itu mahal dan rumit, jadi jawaban saya tidak."
* "Keputusan apa yang diambil, dan seberapa cepat?"
"Alat streaming mana yang Anda inginkan untuk membangunnya?"
@why
Orang sering meminta solusi yang pernah mereka dengar. Bertanya tentang keputusan mengembalikannya ke masalah yang sebenarnya. Jika jawabannya "kami melihatnya di rapat Senin", job harian yang andal mengalahkan sistem streaming. Menolak atau memilih alat melewati percakapan yang penting.
:::

> 🛠 **Coba sendiri (10 menit, kertas dan simulator).** Pertama buka simulator kematangan di halaman Ringkasan Modul (klik "Peta materi" lalu gulir ke bawah di bawah peta materi) dan temukan, untuk setiap tahap, pilihan yang disebutnya **Pas ukurannya**. Biayanya adalah model pengajaran kasar, bukan harga terukur: pakai untuk melihat bentuk trade-off-nya. Lalu tulis catatan cakupan tiga baris untuk KopiKu dari apa yang sudah modul ini ceritakan tentangnya: (1) tahap kematangannya, dan fakta yang memberi tahu Anda; (2) siapa yang menghasilkan data pesanan dan siapa yang memakai angka pendapatan; (3) Tipe A atau Tipe B, dan satu pertanyaan yang akan Anda ajukan kepada CEO sebelum memutuskan.
>
> **Seharusnya Anda melihat:** tahap 1: satu database situs web, sang pendiri mengajukan pertanyaan pertama, belum ada yang bisa dianalisis. Situs web (dan siapa pun yang membangunnya) menghasilkan pesanan; sang pendiri memakai angka pendapatan. Tipe A, setelah bertanya sesuatu seperti "apa yang akan Anda putuskan dengan angka ini, dan seberapa sering?". Jika pertanyaan Anda tentang alat, bukan keputusan, coba lagi.

### Dua gagasan lagi dari buku

**1. Siklus hidup data yang lebih luas.** Kelima perhentian menggambarkan apa yang dibangun engineer. Bisnis juga memutuskan berapa lama data harus disimpan, siapa boleh melihatnya, kapan harus diarsipkan dan kapan harus dihapus, sering kali karena hukum atau kontrak mengatakannya. Bagian hukum, keuangan, atau keamanan yang memutuskannya, bukan Anda. Tetapi Andalah yang harus menjalankannya di setiap salinan data: file mentah, warehouse, cadangan, dan ekspor (Modul 2.5 menunjukkan betapa sulitnya satu perintah "hapus pelanggan ini").

**2. Menghadap ke dalam atau ke luar.** Engineer **internal-facing** membangun untuk perusahaan itu sendiri: pipeline, warehouse, dashboard dan laporan untuk analis dan manajer. Itu sebagian besar pekerjaan data engineering, dan itulah yang dilatih kursus ini lebih dulu. Engineer **external-facing** membangun sistem data yang dipakai pelanggan di dalam produk: dashboard penjualan di dalam aplikasi, rekomendasi di situs web, pipeline event di balik sebuah fitur. Keterampilannya sama, tetapi tuntutannya lebih ketat: jauh lebih banyak pengguna sekaligus, jawaban dalam waktu kurang dari satu detik, dan kesalahan dilihat pelanggan, bukan rekan kerja (Modul 2.6 membandingkan keduanya). Banyak pekerjaan mencampur keduanya, jadi tanyakan saat wawancara mana yang lebih condong dipilih peran itu.

> 🛠 **Coba sendiri (10 menit, pena dan kertas).** Untuk setiap tugas KopiKu, tulis *internal* atau *external*, dan perhentian siklus hidup tempatnya berada atau "siklus hidup data yang lebih luas" jika keputusannya datang dari luar engineering: (1) dashboard pendapatan mingguan untuk sang pendiri; (2) halaman "penjualan Anda bulan ini" di dalam aplikasi yang dijual KopiKu kepada pemilik kafe; (3) "pelanggan yang membeli Gayo juga membeli…" di situs web; (4) salinan malam dari database pesanan ke warehouse; (5) menghapus data pribadi pelanggan saat mereka menutup akun; (6) anggap bagian keuangan menyatakan catatan pesanan harus disimpan sepuluh tahun.
>
> **Seharusnya Anda melihat:** (1) internal, serving; (2) external, serving (analitik untuk pelanggan); (3) external, serving, dibangun di atas transformation; (4) internal, ingestion ke storage; (5) internal (dipicu aksi pelanggan, dijalankan di seluruh salinan internal), siklus hidup data yang lebih luas: aturannya datang dari hukum privasi dan kebijakan perusahaan, dan engineering menjalankannya di setiap salinan; (6) internal, juga siklus hidup data yang lebih luas: bagian keuangan menetapkan periodenya, dan engineering mengubahnya menjadi aturan siklus hidup penyimpanan (Modul 3.4). Jika Anda menaruh (5) atau (6) di satu perhentian saja, perhatikan bahwa keduanya menyentuh setiap perhentian sekaligus.

## @part Data yang akan Anda kerjakan

## @lesson Perjalanan satu pesanan
Ikuti satu pesanan KopiKu, #4821, dari HP pelanggan sampai dashboard CEO. Setiap langkah adalah tahap yang dirancang dan dirawat oleh data engineer.

1. **Sumber.** Budi menekan "Bayar" di aplikasi. Backend menulis satu baris di tabel `orders` di PostgreSQL, dan website juga mengirim event klik ("purchase") ke pelacak analitik. Inilah **sumber**: database, aliran event, file dari mitra, API pihak ketiga (pembayaran, iklan).
2. **Ingestion.** Sebuah job menyalin data baru dan data yang berubah dari tiap sumber. Ia mungkin membaca database tiap jam, membaca file yang diunggah mitra tiap malam, atau mendengarkan aliran event. Di sinilah hal pertama yang sering salah, karena Anda tidak mengendalikan sumbernya.
3. **Penyimpanan mentah.** Data mendarat apa adanya di area **raw** (sering disebut bronze). Anda menyimpan aslinya supaya kalau langkah berikutnya punya bug, Anda bisa menjalankannya ulang dari input yang asli.
4. **Transformasi.** Job membersihkan data (memperbaiki tipe, menghapus duplikat, menyeragamkan status), menggabungkannya (pesanan dengan pelanggan dan produk), dan menghitung konsep bisnis (pendapatan, pelanggan aktif). Hasilnya adalah lapisan **bersih** (silver) dan lapisan **terstruktur** (gold) yang dibentuk untuk menjawab pertanyaan.
5. **Penyajian.** Dashboard, notebook analis, model machine learning, dan kadang produk itu sendiri membaca tabel terstruktur.
6. **Operasi.** Sepanjang jalan, scheduler menjalankan job sesuai urutan, tes memeriksa data, dan monitoring memberi tahu bila ada yang terlambat atau salah. Inilah bagian yang dilewati tutorial dan dibayar perusahaan.

Dua istilah yang akan sering Anda temui:

- **Batch vs streaming.** Batch berarti memproses data dalam potongan menurut jadwal (tiap jam, tiap malam). Streaming berarti memproses setiap event dalam hitungan detik setelah terjadi. Sebagian besar pekerjaan data adalah batch. Streaming lebih rumit dan lebih mahal; pakai hanya jika sebuah keputusan bisnis benar-benar butuh data segar (deteksi fraud, stok langsung).
- **ETL vs ELT.** **ETL** (*Extract, Transform, Load*) mengubah data *sebelum* dimuat ke warehouse. **ELT** (*Extract, Load, Transform*) memuat data mentah lebih dulu lalu mengubahnya *di dalam* warehouse dengan SQL. Warehouse cloud modern cukup kuat dan murah sehingga ELT menjadi pilihan umum, itulah sebabnya alat seperti dbt (Modul 2.3) ada.

> **Tip:** Gambarlah perjalanan data untuk setiap sistem yang Anda kerjakan: kotak untuk sumber, panah untuk job, dan tanda di setiap tempat kegagalan tidak akan terlihat. Gambar itu adalah hasil kerja pertama yang paling berguna bagi data engineer.

> 🛠 **Coba sendiri (10 menit, di terminal).** Bawa satu file melewati perjalanannya dengan perintah, dari folder kursus (dengan venv aktif): `python labs/shared/shopgen.py --out data` (sumber), `mkdir -p raw && cp data/orders.csv raw/orders_$(date +%F).csv` (ingestion dan penyimpanan mentah; `$(date +%F)` menyisipkan tanggal hari ini dalam format `YYYY-MM-DD`), dan `cut -d, -f4 raw/orders_$(date +%F).csv | tail -n +2 | sort | uniq -c | sort -rn` (transformasi pertama: jumlah pesanan per status). Sebutkan dalam satu kalimat tahap mana yang baru saja Anda kerjakan dan mana yang masih kurang sebelum sebuah dashboard bisa membaca data ini.
>
> **Seharusnya Anda melihat:** `2080 delivered` di paling atas dan, lebih ke bawah, `34 DELIVERED` dan `34 Delivered`: status yang sama ditulis tiga cara. Sebuah langkah transformasi harus memperbaikinya sebelum ada yang bisa memercayai hitungannya, dan karena Anda menyalin ke `raw/` lebih dulu, Anda bisa memperbaikinya berulang kali tanpa meminta file lagi ke sumbernya. Anda baru saja menjalankan **sumber**, **ingestion**, **penyimpanan mentah**, dan sedikit **transformasi**; yang masih kurang sebelum dashboard bisa membacanya adalah **transformasi** penuh (pembersihan, deduplikasi, dan pemodelan), **penyajian** (memuat ke tabel warehouse untuk dashboard), dan **operasi** (penjadwalan, pengujian data, dan monitoring).

## @lesson Lima cara data menjadi salah
Dataset KopiKu yang akan Anda pakai sepanjang kursus ini sengaja dibuat sedikit kotor, karena data nyata memang begitu. Masalah-masalah ini mencakup sebagian besar yang akan pernah Anda debug. Kenali sejak awal.

**1. Duplikat.** Pesanan yang sama muncul dua kali. Penyebab: job mencoba ulang setelah timeout lalu memuat file lagi; sumber mengirim "setidaknya sekali"; dua sumber melaporkan event yang sama. Akibat: pendapatan terhitung dua kali. Pertahanan: beri setiap record kunci yang stabil dan buat pemuatan *idempoten* (dijalankan dua kali hasilnya sama), yang dibahas mendalam di Modul 2.4.

**2. Data terlambat atau hilang.** File mitra tiba pukul 09.40, bukan 06.00. Aplikasi seluler sempat offline dan baru mengirim event kemarin hari ini. Akibat: laporan kemarin salah, lalu diam-diam "membaik sendiri". Pertahanan: catat dua waktu (kapan kejadiannya dan kapan Anda menerimanya), dan rancang job agar memproses ulang beberapa hari terakhir.

**3. Perubahan skema (schema drift).** **Skema** adalah daftar nama kolom dan tipe data yang diharapkan. Tim sumber mengganti nama kolom `total` menjadi `total_amount`, atau mengubah integer menjadi teks, tanpa memberi tahu. Akibat: job Anda crash, atau lebih buruk, mengisi kolom dengan **null** (nilai kosong/hilang, seperti `None` di Python) dan jalan terus. Pertahanan: validasi bentuk data di pintu masuk dan sepakati *data contract* dengan produsen data (Modul 2.5).

**4. Nilai rusak.** Total negatif, `"Rp 1.250.000"` di tempat yang seharusnya angka, status yang ditulis `PAID`, `paid`, dan `Paid`, id pelanggan yang tidak ada, tanggal yang ditulis hari-dulu. Akibat: penjumlahan salah, join rusak, baris hilang tanpa suara. Pertahanan: parse dengan ketat, seragamkan, dan kirim baris yang tidak bisa dipercaya ke **karantina**, jangan menebak atau membuangnya diam-diam.

**5. Perubahan volume dan kecepatan.** Black Friday melipatgandakan trafik sepuluh kali, atau sebuah bug memotongnya setengah. Job yang biasanya lima menit kini lima jam, atau kehabisan memori. Akibat: dashboard terlambat, job crash, tagihan cloud yang mengejutkan. Pertahanan: ukur volume dan durasi, beri alert pada anomali, dan rancang untuk skala (Level 2 dan 3).

Ada kategori keenam yang layak disebut: **kegagalan infrastruktur** (server restart di tengah job, disk penuh, kredensial kedaluwarsa). Kurang menarik, tetapi menyebabkan banyak insiden jam 3 pagi. Pertahanan untuk keenamnya sama: **validasi di batas, buat setiap langkah aman dijalankan ulang, dan amati semuanya.**

> **Peringatan:** Kegagalan paling berbahaya adalah yang *diam-diam*. Crash terlihat dan beres dalam sejam. Pipeline yang berjalan "sukses" dan menulis angka salah bisa menyesatkan keputusan berminggu-minggu. Setiap kali merancang sesuatu di kursus ini, tanyakan: "kalau ini salah, bagaimana saya akan mengetahuinya?"

:::ask Pendapatan berlipat dua semalam. Penyebabnya: sebuah job diulang setelah timeout dan memuat file yang sama dua kali. Perbaikan mana yang menyelesaikan masalah semacam ini untuk selamanya?
@options
hapus salinan kedua secara manual setiap pagi
jalankan job lebih jarang supaya gagal lebih sedikit
* key record yang stabil plus load yang idempoten
@why
Duplikat datang dari retry, pengiriman "at least once", dan sumber yang tumpang tindih, jadi mereka akan terus datang. Key yang stabil ditambah load yang idempoten membuat pengulangan tidak berbahaya alih-alih sesuatu yang harus Anda ingat untuk dibersihkan.
:::

:::ask Sebuah tim sumber mengganti nama `total` menjadi `total_amount` tanpa memberi tahu Anda. Job Anda tetap berjalan dan mengisi kolom `total` dengan null. Pertahanan mana yang menangkap ini di pintu masuk?
@options
memori lebih besar untuk job agar sanggup
* validasi skema data saat tiba di pintu masuk
dashboard lebih besar untuk mendeteksinya lebih awal
@why
Ini **schema drift**, dan berbahaya karena tidak ada yang crash. Memeriksa kolom dan tipe saat data tiba mengubah kerusakan diam-diam menjadi kegagalan yang keras dan awal.
:::

:::drill python Temukan id yang berulang
Tulis `repeated_ids(rows)`: id pesanan yang muncul **lebih dari sekali** di `rows` (list berisi dict dengan `"order_id"`), masing-masing sekali, terurut.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("repeated_ids") ## Definisikan repeated_ids(rows).
repeated_ids([{"order_id": "1"}, {"order_id": "2"}, {"order_id": "1"}, {"order_id": "3"}, {"order_id": "1"}, {"order_id": "2"}]) == ["1", "2"] ## Id 1 dan 2 muncul lebih dari sekali: ["1", "2"].
repeated_ids([{"order_id": "7"}, {"order_id": "8"}]) == [] ## Tanpa pengulangan menghasilkan list kosong.
repeated_ids([]) == [] ## Input kosong menghasilkan list kosong.
@hint
Hitung setiap id pesanan dengan dictionary (`counts[order_id] = counts.get(order_id, 0) + 1`), lalu simpan id yang hitungannya di atas 1 dan urutkan.
@solution
def repeated_ids(rows):
    counts = {}
    for row in rows:
        counts[row["order_id"]] = counts.get(row["order_id"], 0) + 1
    return sorted(i for i, n in counts.items() if n > 1)
:::

> 💡 **Jeda Praktik 1 (Eksplorasi Data Kotor):**
> Sebelum lanjut membaca teori format, lihat contoh nyata nilai rusak, duplikat, dan id pelanggan tanpa pasangan di data KopiKu pada komputer Anda! Buka terminal di folder kursus (dengan venv kursus aktif), buat datanya, lalu intip file pesanan:
> `python labs/shared/shopgen.py --out data`
> `head -20 data/orders.csv`
> `grep -c "Rp " data/orders.csv` (total yang ditulis format teks)
> `grep -c ",-" data/orders.csv` (total bernilai minus/rusak)
> `cat data/manifest.json` (JSON adalah teks kunci-nilai terstruktur yang dijelaskan di pelajaran berikut; `manifest.json` mencatat semua anomali yang ditanam generator)
> **Seharusnya Anda melihat:** `37` untuk hitungan `Rp ` dan `17` untuk hitungan `,-`. `manifest.json` mencatat persis apa yang ditanam generator (misalnya `"formatted_total": 37` dan `"negative_total": 17`), jadi Anda bisa mencocokkan temuan Anda dengannya.
> Anda sekarang melihat langsung apa yang dihadapi seorang data engineer di dunia nyata. Lanjut ke Pelajaran 7 di bawah.

## @lesson Format data yang akan Anda temui
Data datang dalam beberapa format file. Mengetahui jebakannya menghemat berjam-jam.

**CSV** (comma-separated values) adalah format pertukaran paling umum dan paling tidak andal. Ia tidak punya tipe: semua nilai adalah teks, sehingga `007`, `7`, dan `"7"` tidak bisa dibedakan sampai Anda memutuskan. Ia tidak punya standar untuk tanggal, pemisah desimal, tanda kutip, atau encoding; nama pelanggan yang mengandung koma atau baris baru merusak parsing yang naif. Selalu pakai parser CSV yang benar (modul `csv` Python), jangan pernah `line.split(",")`, dan selalu tentukan encoding (biasanya UTF-8).

**JSON** dan **NDJSON**. JSON menggambarkan data bersarang sebagai pasangan kunci-nilai, misalnya, `{"order_id": 4821, "total": 150000, "paid": true, "coupon": null}`, dan punya tipe dasar (string, angka, boolean, `null`, yang menjadi `None` di Python). NDJSON (newline-delimited JSON) menaruh satu objek JSON per baris, sehingga Anda bisa memproses file raksasa baris demi baris tanpa memuat semuanya. Event klik dan log biasanya memakai NDJSON. Waspadai field yang kadang tidak ada dan angka yang datang sebagai string.

**Parquet** adalah format biner *kolumnar* untuk analitik. Ia menyimpan tiap kolom bersama-sama, terkompresi baik, dan mempertahankan tipe, sehingga membaca tiga kolom dari lima puluh hanya membaca tiga kolom itu. Anda akan memakainya intensif mulai Modul 2.1. Anda tidak bisa membukanya di editor teks, harga yang wajar untuk ukuran yang jauh lebih kecil dan kecepatan yang jauh lebih tinggi daripada CSV.

**Tabel database** adalah sumber utama lainnya. Anda membacanya dengan SQL, baik sebagai salinan penuh maupun dengan menangkap hanya yang berubah (change data capture, Modul 3.2).

Aturan praktis: CSV dan JSON untuk *pertukaran* (manusia dan sistem lain mengirimkannya kepada Anda); Parquet dan tabel database untuk *penyimpanan dan analisis*. Langkah pertama pipeline yang umum adalah mengubah yang pertama menjadi yang kedua, dengan tipe yang dipaksakan.

**Membaca dua format tanggal di Python (`datetime.strptime`).** Tanggal dari file CSV sering mencampur gaya seperti `"2026-01-31T14:03:00"` dan `"31/01/2026 14:03"`. Pustaka standar Python punya `from datetime import datetime`, yang menyediakan `datetime.strptime(text, fmt)` untuk mencocokkan teks dengan pola format dan memunculkan `ValueError` jika tidak cocok. Kode formatnya peka huruf besar/kecil: `%Y` = tahun 4 digit, `%m` = bulan (bukan `%M` = menit), `%d` = tanggal, `%H` = jam 24-jam, `%S` = detik. Tangkap `ValueError` untuk mencoba pola berikutnya, lalu ubah hasil yang sah kembali ke teks ISO standar dengan `dt.strftime("%Y-%m-%dT%H:%M:%S")`:

```python
from datetime import datetime
for fmt in ("%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M"):
    try:
        iso = datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%dT%H:%M:%S")
        break
    except ValueError:
        continue
```

:::drill python Baca sebuah persentase
Tulis `parse_percent(raw)`: `"12%"` atau `" 12 % "` menghasilkan angka `12`; teks yang bukan bilangan bulat dengan `%` opsional (misalnya `"abc"`, `""`) menghasilkan `None`, tidak pernah error.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("parse_percent") ## Definisikan parse_percent(raw).
parse_percent("12%") == 12 ## "12%" harus menghasilkan 12.
parse_percent(" 7 % ") == 7 ## Spasi di sekitar angka dan % harus diabaikan: 7.
parse_percent("abc") is None ## Teks yang tidak terbaca menghasilkan None, bukan error.
parse_percent("") is None ## Sel kosong menghasilkan None.
@hint
Hapus spasi dan `%`, lalu `int(...)` di dalam `try` / `except ValueError` yang mengembalikan `None`.
@solution
def parse_percent(raw):
    text = raw.replace("%", "").strip()
    try:
        return int(text)
    except ValueError:
        return None
:::

:::drill python Satu format tanggal
Tulis `parse_day(raw)`: tanggal dengan hari lebih dulu seperti `"31/01/2026"` menghasilkan teks ISO `"2026-01-31"`; apa pun yang bukan tanggal valid dalam format itu (`"2026-01-31"`, `"31/02/2026"`, `""`) menghasilkan `None`. Pakai `datetime.strptime`.
@starter
from datetime import datetime

# tulis fungsi Anda di bawah baris ini

@check
defines("parse_day") ## Definisikan parse_day(raw).
parse_day("31/01/2026") == "2026-01-31" ## "31/01/2026" harus menghasilkan "2026-01-31".
parse_day("05/03/2026") == "2026-03-05" ## Hari dulu: "05/03/2026" adalah 5 Maret: "2026-03-05".
parse_day("31/02/2026") is None ## 31 Februari tidak ada: None.
parse_day("2026-01-31") is None ## Format yang berbeda tidak diterima di sini: None.
parse_day("") is None ## Sel kosong menghasilkan None.
@hint
Di dalam blok `try`, parse `raw` dengan `datetime.strptime(raw, "%d/%m/%Y")` lalu ubah hasilnya ke teks ISO dengan `.strftime("%Y-%m-%d")`; tangkap `ValueError` dan kembalikan `None` jika teks kosong, bukan tanggal kalender yang sah, atau memakai format lain.
@solution
from datetime import datetime

def parse_day(raw):
    try:
        return datetime.strptime(raw, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None
:::

> 💡 **Jeda Praktik 2 (Parser Angka & Timestamp):**
> Jangan baca materi berikutnya dulu! Buka `labs/mod-0-2/pipeline.py` di Text Editor Anda (klik di sidebar atau ketik `code labs/mod-0-2/pipeline.py`).
> Terapkan konversi tipe data yang baru Anda pelajari:
> 1. Kerjakan `parse_total(raw)`: bersihkan `"Rp"` dan titik, ubah ke integer Rupiah, dan return `None` jika teks rusak/kosong.
> 2. Kerjakan `parse_ts(raw)`: coba kedua pola `datetime.strptime` di atas dan kembalikan teks ISO `"YYYY-MM-DDTHH:MM:SS"` atau `None`.
> Uji kedua parser di terminal:
> `pytest labs/mod-0-2/test_lab.py -v -k TestParsers`
> Jika kedua tes parser PASSED, lanjut ke Pelajaran 8 dan Jeda Praktik 3 di bawah untuk menyelesaikan `clean_orders` dan `daily_revenue`.

## @lesson Cara kerja kursus ini, dan data KopiKu
Setiap modul punya empat bagian, dan sebaiknya dikerjakan berurutan:

1. **Materi** (halaman ini). Baca sambil membuka lab di sebelahnya.
2. **Lab.** Anda menulis kode sungguhan terhadap data KopiKu. Setiap lab punya tes otomatis sehingga Anda tahu solusi Anda benar-benar benar, bukan sekadar "jalan". Solusi referensi disertakan; buka hanya setelah Anda mencoba.
3. **Chaos lab.** Kegagalan produksi bergaya nyata. Tebak penyebabnya sebelum membaca jawaban. Debugging adalah keterampilan yang dibangun dengan berlatih.
4. **Kuis.** Pertanyaan pendek untuk memeriksa bahwa Anda memahami gagasannya, bukan sintaksnya.

Data untuk setiap lab berasal dari satu generator, `labs/shared/shopgen.py`. Dengan pengaturan yang sama ia selalu menghasilkan file yang sama, sehingga hasil Anda bisa diperiksa dengan tepat. Ia membuat pelanggan, produk, pesanan dan baris pesanan, event website, dan log perubahan pelanggan, lalu menanam masalah dari pelajaran sebelumnya dengan tingkat yang diketahui: baris duplikat, total bergaya `Rp 1.250.000`, status huruf campur, dua format tanggal, total negatif, id pelanggan tanpa pasangan (orphan), baris JSON terpotong. Sebuah `manifest.json` mencatat persis apa yang ditanam, dan itulah cara tes mengetahui jawaban yang benar.

Dua kebiasaan akan membantu lebih daripada alat apa pun:

- **Lihat datanya dulu.** Sebelum menulis kode, buka file dan baca lima puluh baris. Setiap bug serius di kursus ini bisa terlihat dengan mata kalau Anda mau melihat.
- **Tuliskan arti "benar".** Untuk setiap job, nyatakan satu atau dua fakta yang harus berlaku pada outputnya (misalnya: "tiap pesanan muncul sekali"; "pendapatan harian tidak pernah menghitung pesanan yang dibatalkan"). Kalimat-kalimat itu menjadi tes Anda.

> 💡 **Jeda Praktik 3 (Pembersihan Defensif & Agregasi Pendapatan):**
> Buka kembali `labs/mod-0-2/pipeline.py` di editor Anda untuk menuntaskan seluruh lab:
> 1. Kerjakan `clean_orders(rows)`: pisahkan data menjadi `clean` dan `rejected` (dengan mencatat `reason` untuk setiap baris yang dibuang). Tangani duplikat order_id dengan mempertahankan baris pertama.
> 2. Kerjakan `daily_revenue(clean)`: hitung total pendapatan per tanggal `YYYY-MM-DD` dengan mengabaikan status cancelled dan refunded.
> Jalankan seluruh pengujian di terminal (dengan venv kursus aktif, di mana `python` bekerja di macOS, Linux, maupun Windows):
> `pytest labs/mod-0-2/test_lab.py -v`
> Setelah semua 8 tes HIJAU, jalankan pipeline pada data riil lalu buat kode bukti Anda:
> `python labs/mod-0-2/pipeline.py data/orders.csv`
> `python scripts/prove.py mod-0-2`
> **Seharusnya Anda melihat:** `3634 rows in, 3582 clean, 52 rejected` (52 itu terdiri dari 35 duplikat dan 17 total negatif), lalu pendapatan beberapa hari pertama, diawali `2026-01-01 Rp 36,725,000`. Angka pertama itu sama dengan yang dicatat `manifest.json` untuk 2026-01-01.
> Selamat! Anda telah membangun pipeline pembersihan data defensif pertama Anda!

## @lab Lab: bersihkan file pesanan KopiKu
Anda punya file baris pesanan KopiKu dengan masalah dari materi: total ditulis sebagai teks, dua format tanggal, duplikat, nilai mustahil. Tulis empat fungsi kecil yang mengubahnya menjadi data yang bisa dipercaya, lalu hitung pendapatan per hari. Ini miniatur dari yang dilakukan setiap pipeline: baca, periksa, bersihkan, sisihkan yang tidak bisa dipercaya, lalu hitung.

| Fungsi | Apa yang dilakukannya | Di mana Anda membutuhkannya saat bekerja |
|---|---|---|
| `parse_total` | `"Rp 1.250.000"` atau `"150000"` menjadi angka rupiah, atau `None` jika tidak bisa dipahami | setiap sumber menulis uang dengan caranya sendiri; laporan butuh satu tipe angka |
| `parse_ts` | dua format tanggal (`"2026-01-31T14:03:00"`, `"31/01/2026 14:03"`) menjadi satu format standar | pendapatan per hari, pengiriman terlambat, "7 hari terakhir": semua butuh tanggal yang bisa dibandingkan |
| `clean_orders` | menyimpan baris yang baik dengan tipe yang benar, dan memasukkan setiap baris rusak ke `rejected` beserta alasannya | inti pipeline: tidak ada yang salah masuk ke laporan, dan tidak ada yang dibuang tanpa jejak |
| `daily_revenue` | pendapatan per hari, tanpa pesanan yang dibatalkan dan dikembalikan | angka yang ditanyakan pendiri setiap pagi |

Fungsi-fungsinya saling membangun: `clean_orders` memakai `parse_total` dan `parse_ts`, dan `daily_revenue` memakai hasil `clean_orders`. Karena itu urutannya penting.

### @steps
> **Sudah menulis `labs/mod-0-2/pipeline.py` selama Jeda Praktik 2–3?** Lewati Langkah 1–3 dan langsung lompat ke Langkah 4–5 untuk memverifikasi dan menjalankan `prove.py`.

1. Buka **Pratinjau browser** di atas dan baca `pipeline.py` dari atas ke bawah sekali: empat fungsi kosong, masing-masing dengan deskripsi dan contoh nyata dari file.
2. Tulis sesuai urutan ini, jalankan tes setelah setiap fungsi dan lihat hanya kelompoknya: `parse_total`, lalu `parse_ts`, lalu `clean_orders`, lalu `daily_revenue`.
3. Aturan untuk baris yang tidak bisa dipercaya: **jangan pernah menebak dan jangan pernah membuang diam-diam.** Setiap baris yang Anda tinggalkan masuk ke `rejected` dengan alasan singkat.
4. **Buat dan periksa file aslinya** (menjalankan `shopgen.py` **wajib dilakukan jika Anda belum punya `data/orders.csv`**, kalau tidak perintah `pipeline.py data/orders.csv` di Langkah 5 akan gagal dengan `FileNotFoundError`). Di terminal, dari folder kursus dengan venv kursus aktif (di dalam venv aktif, `python` bekerja di semua OS termasuk Windows):

```bash
python labs/shared/shopgen.py --out data
head -20 data/orders.csv           # 20 baris pertama
grep -c "Rp " data/orders.csv      # berapa total yang ditulis sebagai teks
cat data/manifest.json             # apa yang ditanam di file, dan berapa banyak
```

5. **Kerjakan yang sesungguhnya.** Di komputer Anda sendiri, dengan venv kursus dari Modul 0.1 aktif, tulis lagi keempat fungsi di editor **tanpa menyalin** dari pratinjau, lalu dari folder kursus:

```bash
pytest labs/mod-0-2/test_lab.py -v                  # sampai semua tes lulus
python labs/mod-0-2/pipeline.py data/orders.csv     # jalankan pada file asli: baris masuk, bersih, ditolak
python scripts/prove.py mod-0-2                     # kode bukti untuk kotak Bukti di halaman ini
```

6. Opsional: tulis tiga kalimat di `NOTES.md` tentang masalah yang Anda temukan dan mana yang paling mengejutkan.

### @files
- labs/mod-0-2/pipeline.py :: File kerja Anda: implementasikan empat fungsi TODO :: starter
- labs/mod-0-2/test_lab.py :: Tes yang memeriksa pekerjaan Anda :: test
- labs/shared/shopgen.py :: Generator data KopiKu :: data
- labs/mod-0-2/reference/pipeline.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 8 tes di test_lab.py lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri** (lulus di pratinjau browser tidak dihitung)
- Setiap baris yang dibuang muncul di `rejected` dengan alasan
- Anda bisa menjelaskan masalah mana dari kelima masalah yang diwakili tiap baris yang ditolak atau diperbaiki

### @verify
Jalankan tes dari root repositori:

```bash
pytest labs/mod-0-2/test_lab.py -v
```

Semua 8 tes harus lulus (`8 passed`). Untuk melihat seperti apa hasil yang lulus sebelum Anda mulai, jalankan tes terhadap solusi referensi: `LAB_DIR=reference pytest labs/mod-0-2/test_lab.py -v`.

## @chaos Pendapatan hari Selasa yang berlipat dua
### @scenario
Rabu pagi CEO bertanya mengapa pendapatan hari Selasa tepat dua kali lipat angka biasanya. Tidak ada yang istimewa: tidak ada kampanye, tidak ada perubahan harga. Job malam yang memuat pesanan ke database analitik melaporkan "sukses" setiap hari. Pesanan hari Selasa di database toko tampak normal.

Anda diberi log job itu: pada Selasa malam langkah pemuatan berjalan pukul 01.00, gagal pukul 01.07 dengan timeout jaringan saat *menulis*, dan scheduler otomatis mencobanya ulang pukul 01.10. Percobaan ulang selesai dengan normal.

### @cause
Job itu **menambahkan** (append) pesanan hari itu ke tabel analitik dengan `INSERT` biasa. Percobaan pertama sudah menulis sebagian besar baris sebelum timeout. Percobaan ulang mulai dari awal dan menulis *semua* baris lagi. Baris dari percobaan pertama tidak pernah dihapus, sehingga sebagian besar pesanan kini ada dua kali, dan setiap `SUM(total)` menghitungnya ganda.

Dua hal memperburuk keadaan: job melaporkan sukses setelah percobaan ulang sehingga tidak ada alert, dan tidak ada yang memeriksa bahwa setiap id pesanan hanya muncul sekali.

### @fix
1. Perbaiki datanya: untuk hari yang terdampak, hapus dan muat ulang barisnya, atau buang duplikat dengan menyisakan satu baris per `order_id`.
2. Buat pemuatan **idempoten**: ganti data hari itu dalam satu **langkah atomik** (tuntas semua atau batal semua, tidak pernah berhenti di tengah), hapus hari itu dan masukkan ulang dalam satu **transaksi** database (sekelompok perubahan yang sukses bersama atau batal bersama), atau pakai `MERGE`/**upsert** (perbarui baris yang sudah ada, masukkan yang baru) berkunci `order_id`, alih-alih menambahkan membabi buta.
3. Tambahkan pemeriksaan yang menggagalkan job bila ada `order_id` yang muncul lebih dari sekali, dan pemeriksaan yang membandingkan jumlah baris hari itu dengan sumbernya.

### @pattern
Anggap setiap job suatu hari akan berjalan dua kali. Kalau menjalankannya dua kali mengubah hasil, job itu belum selesai. Gagasan ini (idempotensi) muncul kembali di hampir setiap modul.

## @quiz
### Mengapa perusahaan biasanya membangun database analitik terpisah alih-alih membuat laporan langsung dari database produksi?
- [ ] Database produksi dirancang hanya menyimpan data satu tahun terakhir, sehingga riwayat lama tetap harus disimpan di sistem lain
- [x] Query analitik yang besar memperlambat transaksi pelanggan, dan tabel produksi dirancang untuk menulis, bukan untuk menganalisis
- [ ] Database analitik tidak memakan biaya karena hanya berisi salinan, sehingga memisahkannya selalu menurunkan tagihan bulanan
- [ ] Query SQL tidak bisa dijalankan di database produksi, sehingga analis harus mengekspor semua tabel ke spreadsheet terlebih dahulu

> Sistem produksi (OLTP) harus tetap cepat untuk operasi penulisan kecil. Memindai jutaan baris di sana memperlambat produk, dan desainnya (kondisi terkini, banyak tabel kecil) kurang cocok untuk analisis riwayat.

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

> Memproses ulang dari raw membuat perbaikan dan **backfill** (menjalankan ulang pipeline untuk tanggal-tanggal lampau guna memperbaiki atau mengisi riwayat) mungkin dilakukan. Kalau Anda hanya menyimpan data hasil transformasi, bug di transformasi bisa menghancurkan buktinya.

### Tim sumber mengganti nama kolom `total` menjadi `total_amount` tanpa memberi tahu Anda. Job Anda tetap jalan tetapi kolom pendapatan kini kosong. Ini termasuk kategori masalah apa?
- [ ] Duplikat: kolom yang diganti namanya termuat berdampingan dengan yang lama, sehingga setiap pesanan muncul dua kali
- [ ] Data terlambat: nama kolom baru tiba setelah yang lama, sehingga pendapatan terisi beberapa jam kemudian
- [x] Schema drift yang tidak ketahuan karena tidak ada yang memeriksa bentuk data masuk
- [ ] Lonjakan volume: job melambat begitu parah sampai berhenti menulis kolom pendapatan

> Schema drift adalah perubahan struktur sumber. Bagian yang diam-diam itulah kegagalan sebenarnya: pemeriksaan di batas akan menghentikan job dengan error yang jelas.

### Mengapa Anda sebaiknya memakai modul `csv` Python dan bukan `line.split(",")` untuk membaca file CSV?
- [ ] `split` lebih lambat di setiap file, dan modul `csv` ditulis dalam bahasa C untuk menghindari biaya itu
- [ ] Modul `csv` mengubah setiap kolom ke tipe yang benar secara otomatis, sehingga tidak perlu pembersihan lagi
- [ ] `split` tidak bisa membaca file yang lebih besar dari memori, sedangkan modul `csv` selalu membaca satu baris sekali waktu
- [x] Nilai CSV berkutip bisa berisi koma, tanda kutip, atau baris baru, yang dipotong `split` di tempat yang salah

> Nilai seperti `"Santoso, Budi"` mengandung koma yang bukan pemisah. Modul csv mengikuti aturan kutipan. Perhatikan ia tetap mengembalikan semua nilai sebagai teks; mengubah tipe adalah tugas Anda.

### Sebuah pipeline berjalan tiap malam dan melaporkan sukses, tetapi selama tiga minggu menulis pesanan dengan total 0 karena bug parsing. Apa yang paling cepat menangkapnya?
- [ ] Menjalankan job yang sama di server lebih cepat supaya selesai sebelum ada yang membuka dashboard
- [x] Pemeriksaan pada output, seperti "tidak ada total nol atau negatif" dan "pendapatan dalam rentang normal"
- [ ] Mengirim seluruh file log job ke CEO setiap pagi supaya ada yang membaca peringatannya
- [ ] Mengganti format input dari CSV ke JSON, yang punya tipe angka sungguhan sehingga tidak mungkin menghasilkan nol

> Sukses sebuah job hanya berarti kodenya berjalan. Pemeriksaan isi output yang menunjukkan apakah hasilnya masuk akal. Kegagalan senyap tertangkap oleh tes pada data, bukan pada eksekusi.

### Sebuah startup berisi dua orang menyimpan angkanya di spreadsheet. CEO meminta dashboard real-time berbasis Kafka untuk rapat direksi hari Senin. Apa respons pertama yang terbaik?
- [ ] Bangun pipeline streaming sesuai permintaan, karena perusahaan tetap akan butuh streaming saat tumbuh
- [x] Tanyakan keputusan apa yang diambil dari angka itu dan seberapa sering, lalu tawarkan batch harian yang andal
- [ ] Tolak, dan terus kirim spreadsheet lewat email sampai perusahaan sudah merekrut tim data lengkapnya sendiri nanti
- [ ] Mulai dengan klaster Kafka kecil dan job Spark agar tim bisa belajar streaming sambil berjalan

> Ini perusahaan tahap 1: keputusan mingguan butuh angka harian yang bisa dipercaya, bukan kesegaran di bawah satu detik. Membangun platform tahap 3 lebih dulu menghabiskan waktu tim berbulan-bulan sebelum ada angka yang berguna.

### Mana di antara ini yang termasuk enam kebiasaan (undercurrents), bukan lima perhentian (tahap siklus hidup)?
- [ ] Ingestion: menyalin data dari sistem sumber ke platform Anda
- [ ] Serving: menyerahkan hasilnya ke dashboard, analis, dan model
- [x] Orkestrasi: menjalankan setiap langkah dengan urutan yang benar, dengan retry
- [ ] Transformasi: mengubah record mentah menjadi tabel yang bisa dipercaya untuk analisis

> Tahapnya adalah generation, storage, ingestion, transformation, dan serving. Security, data management, DataOps, data architecture, orchestration, dan software engineering mengalir di bawah semuanya.

## @resources
- [Dokumentasi modul csv Python](https://docs.python.org/3/library/csv.html)
- [Python datetime: kode format strptime](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes)
