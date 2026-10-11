---
title: Pemodelan Dimensial: Merancang Tabel untuk Analitik
duration: 3 minggu
summary: Pelajari cara merancang star schema sebagaimana tim analitik sungguhan bekerja: tetapkan grain, pisahkan fakta dari dimensi, gunakan surrogate key, pertahankan histori dengan slowly changing dimension (SCD), dan uji bahwa model menghasilkan angka yang benar.
why: Tutorial daring sering mengklaim star schema sudah kuno dan menyuruh Anda menumpuk segalanya ke dalam satu tabel raksasa (One Big Table). Di dunia kerja nyata, tabel tanpa kejelasan grain melipatgandakan pendapatan, histori terhapus diam-diam, dan tidak ada yang tahu metrik mana yang benar.
---

## @outcomes
- Menjelaskan mengapa kebutuhan analitik membutuhkan desain tabel yang berbeda dari basis data aplikasi, serta mempraktikkan proses empat langkah pemodelan dimensional
- Menetapkan grain tabel fakta secara presisi dan mengidentifikasi measures, dimensi, serta degenerate dimension
- Memilih tipe SCD yang tepat (Tipe 0, 1, 2, atau 3) untuk setiap atribut, serta mengimplementasikan SCD Tipe 2 dengan rentang validitas dan as-of join
- Menerapkan surrogate key dan anggota khusus "unknown" agar setiap baris fakta selalu merujuk ke baris dimensi yang valid
- Menguji star schema untuk memastikan grain, integritas referensial, serta rekonsiliasi total angka dengan data sumber

## @prereq
Modul 0.3 dan 1.3 (join, jebakan fan-out, window function seperti LEAD, dan CTE rekursif). Lab ini menggunakan SQL murni pada SQLite ditambah script pembantu Python ringan; tidak perlu instalasi rumit.

## @lesson Mengapa analitik membutuhkan rancangan yang berbeda
Basis data operasional yang menjalankan aplikasi KopiKu dirancang secara **ternormalisasi**: setiap fakta dicatat satu kali saja di dalam banyak tabel kecil agar operasi tulis (insert, update) berlangsung cepat dan konsisten (Modul 0.3). Namun, pertanyaan bisnis seperti "berapa pendapatan per tier pelanggan per minggu berdasarkan tingkat sangrai kopi" membutuhkan join melintasi lima hingga enam tabel operasional. Query semacam ini lambat, rentan salah tulis, dan karena setiap analis menulis join dengan cara berbeda, dua dashboard yang berbeda bisa menampilkan angka yang saling bertentangan.

**Pemodelan dimensional (Dimensional Modeling)**, yang dipopulerkan oleh Ralph Kimball, merancang struktur tabel khusus untuk *menjawab pertanyaan*. Inti dari pendekatan ini adalah memisahkan dua jenis tabel:

- **Tabel Fakta (Fact Tables)** mencatat **peristiwa atau pengukuran numerik**: satu baris pesanan terjual, satu transaksi pembayaran berhasil, satu klik tayangan halaman. Tabel fakta berukuran sangat panjang (jutaan hingga miliaran baris), didominasi angka dan kunci referensi.
- **Tabel Dimensi (Dimension Tables)** mendeskripsikan **konteks di balik peristiwa tersebut**: siapa (pelanggan), apa (produk), kapan (tanggal), di mana (toko/lokasi). Tabel dimensi berukuran relatif lebih pendek tetapi lebar, penuh kolom teks deskriptif yang dipakai untuk filter, filter pencarian, dan pengelompokan (GROUP BY).

Ketika tabel dimensi diletakkan mengelilingi satu tabel fakta utama, polanya menyerupai bintang, sehingga dinamakan **star schema**:

```text
            dim_date
               |
dim_customer - fact_order_items - dim_product
```

Pertanyaan bisnis pun menjadi sederhana: cukup join tabel fakta ke beberapa dimensi kecil terkait dengan definisi metrik yang seragam bagi seluruh organisasi: `SUM(line_total_idr)` dikelompokkan berdasarkan `dim_customer.tier` dan `dim_date.month`. Lebih sedikit join, risiko salah hitung berkurang drastis, dan mesin query SQL modern dapat mengoptimalkannya dengan sangat kencang.

Perancangan star schema selalu dilakukan melalui empat langkah berurutan. Melewatkan urutan ini adalah penyebab paling umum lahirnya model data yang membingungkan:

1. **Pilih proses bisnis (business process).** Pemenuhan pesanan, pembayaran, sesi web. Satu proses bisnis, satu tabel fakta (pada tahap awal).
2. **Tetapkan grain.** Apa arti representasi dari tepat satu baris di tabel fakta? ("Satu baris per item pesanan.")
3. **Pilih dimensi.** Segala hal yang mendeskripsikan baris pada tingkat grain tersebut: tanggal, pelanggan, produk.
4. **Pilih fakta (ukuran numerik / measures).** Angka-angka numerik pada grain tersebut: kuantitas, harga satuan, subtotal item.

## @lesson Grain: kalimat paling krusial dalam pemodelan data
**Grain** adalah satu kalimat tunggal yang mendefinisikan apa makna tepat dari satu baris di dalam tabel fakta. Untuk KopiKu: *"satu baris mewakili satu item dalam pesanan: satu produk, dalam satu pesanan, pada satu harga tertentu."* Segala keputusan teknis selanjutnya diturunkan dari kalimat ini.

Mengapa kita harus sangat disiplin terhadap grain?

- **Grain menentukan dimensi mana saja yang boleh hadir.** Pada grain tingkat baris-item (order line), produk berhak ada di baris tersebut. Namun pada grain *tingkat pesanan* (satu baris mewakili keseluruhan transaksi checkout), produk tidak boleh diletakkan di sana karena satu pesanan bisa berisi banyak produk sekaligus. Jika Anda memaksakan dimensi yang tidak sesuai dengan grain, baris akan berlipat ganda secara tidak terkendali (jebakan fan-out dari Modul 0.3) atau dimensi tersebut menjadi ambigu.
- **Grain menentukan apa yang boleh dijumlahkan.** Metrik numerik (measures) hanya dapat dijumlahkan (SUM) dengan benar pada tingkat atau di atas tingkat grain miliknya sendiri. Biaya pengiriman yang dicatat satu kali per pesanan tetapi diduplikasi ke setiap baris item akan keliru besar jika dijumlahkan; simpan biaya kirim pada tabel fakta tingkat pesanan, atau alokasikan proporsinya secara eksplisit ke tiap item.
- **Grain dapat diuji secara otomatis.** Aturan "tidak boleh ada dua baris yang memiliki pasangan (order_id, line_no) yang sama" adalah tes integritas satu baris SQL yang mampu menangkap puluhan jenis bug pipa data sebelum masuk ke dashboard.

Prinsip praktis dalam menentukan grain:

- Simpan fakta pada **grain atomik terendah (lowest atomic grain)** yang memungkinkan. Data rinci selalu bisa diagregasi ke atas; namun data yang sudah terlanjur diagregasi tidak akan pernah bisa diurai kembali menjadi data rinci. (Tabel pra-agregasi berguna sebagai lapisan kedua untuk percepatan query, tetapi jangan pernah menjadikannya satu-satunya salinan data).
- **Jangan pernah mencampur grain berbeda dalam satu tabel fakta.** Tabel fakta yang mencampur baris pesanan gelondongan dan baris item detail adalah sarang malapetaka bug pelaporan.
- Tuliskan kalimat definisi grain pada bagian paling atas dokumentasi model data dan pastikan ada unit test otomatis yang memvalidasinya.

Klasifikasi tabel fakta berdasarkan cara data mengalir:

| Tipe Fakta | Satu baris mewakili... | Contoh | Sifat Pengukuran (Measures) |
|---|---|---|---|
| **Transaction** | satu kejadian sesaat | satu baris item pesanan | aditif penuh: kuantitas, nominal belanja |
| **Periodic snapshot** | status/kondisi pada interval waktu rutin | stok inventaris produk per hari | semi-aditif: saldo akhir (tidak boleh dijumlah lintas waktu) |
| **Accumulating snapshot** | siklus hidup satu proses yang diperbarui bertahap | pesanan dari dibuat, dibayar, dikirim, hingga selesai | tanggal timestamp dan durasi latensi antar-tahap |

Ukuran numerik (measures) juga dibedakan berdasarkan **kemampuan penjumlahan (additivity)**: *aditif penuh* (kuantitas, omset) dapat dijumlahkan di seluruh dimensi apa pun; *semi-aditif* (saldo rekening, stok gudang) dapat dijumlahkan lintas pelanggan tetapi keliru jika dijumlahkan melintasi dimensi tanggal; *non-aditif* (rasio, margin persentase, harga rata-rata) tidak boleh dijumlahkan sama sekali, sehingga selalu simpan pembilang dan penyebutnya secara terpisah lalu lakukan pembagian di akhir query.

## @lesson Tabel dimensi: konteks deskriptif pelaporan
Satu baris dimensi mendeskripsikan satu entitas spesifik (satu produk, satu pelanggan, satu tanggal kalender) dengan deretan atribut rinci yang dipakai untuk pengelompokan dan pemfilteran: `roast_level`, `origin`, `tier`, `city`. Dimensi yang dirancang dengan baik sengaja dibuat lebar dan tidak dinormalisasi (denormalized), karena dalam analitik kita menginginkan satu kali join langsung, bukan rantai join berjenjang.

Pola-pola dimensi standar yang akan selalu Anda temui di industri:

- **Dimensi Tanggal (Date Dimension).** Tabel fisik nyata dengan satu baris per hari kalender (lengkap dengan tahun, bulan, nama hari, nomor minggu, kuartal, flag akhir pekan, flag hari libur nasional). Dibuat langsung dari kalender (bukan diekstrak dari transaksi yang ada), sehingga hari-hari tanpa penjualan tetap terdaftar di laporan, dan seluruh perusahaan memiliki definisi yang seragam mengenai batas kuartal fiskal. Hampir setiap tabel fakta selalu terhubung ke dimensi ini.
- **Degenerate Dimension.** Nomor identifikasi transaksi yang tidak memiliki atribut tambahan sendiri, tetapi dipertahankan langsung sebagai kolom biasa di tabel fakta: contoh klasiknya adalah `order_id`. Kolom ini memungkinkan analis mengelompokkan baris-baris item kembali ke nomor pesanan aslinya tanpa perlu membuat tabel dimensi satu kolom yang sia-sia.
- **Role-Playing Dimension.** Satu tabel dimensi yang dirujuk beberapa kali oleh tabel fakta dengan peran berbeda: `order_date`, `ship_date`, dan `delivery_date` semuanya merujuk ke tabel `dim_date` yang sama. Implementasikan melalui SQL view atau alias tabel, bukan menduplikasi tabel fisiknya.
- **Junk Dimension.** Kumpulan banyak flag ber-kardinalitas rendah (metode pembayaran, status kurir, flag bungkus kado) yang digabungkan ke dalam satu tabel dimensi kecil daripada mengotori tabel fakta dengan puluhan kolom teks.
- **Conformed Dimension.** Dimensi bersama yang digunakan oleh berbagai tabel fakta dengan definisi makna yang konsisten: `dim_customer` yang sama digunakan untuk fakta pesanan maupun fakta tiket bantuan layanan pelanggan. Dimensi bersama ini adalah jembatan yang memungkinkan perbandingan lintas proses bisnis ("rata-rata komplain per tier pelanggan dibanding frekuensi belanja"). Matriks proses bisnis terhadap dimensi bersama ini disebut **bus matrix**, peta cetak biru arsitektur enterprise data warehouse.
- **Hierarki** (produk > kategori, kota > provinsi > negara) disimpan langsung sebagai kolom dalam satu dimensi lebar tanpa perlu dinormalisasi menjadi tabel terpisah.

Perbandingan tiga pola tata letak penyimpanan data:

| Karakteristik | Star Schema | Snowflake Schema | One Big Table (OBT) |
|---|---|---|---|
| Bentuk | Tabel fakta + dimensi terdenormalisasi | Dimensi dinormalisasi ke sub-tabel bertingkat | Semua data di-join jadi satu tabel lebar raksasa |
| Jumlah Join per Query | Sedikit | Banyak | Nol (tanpa join) |
| Biaya Penyimpanan / Pembaruan | Duplikasi teks minor di dimensi | Duplikasi paling minim | Duplikasi masif, sangat mahal saat update baris |
| Kejelasan Definisi Data | Sangat tinggi (grain & key eksplisit) | Menengah | Rendah: grain menjadi kabur dan membingungkan |
| Penggunaan Standar | Model inti gudang data enterprise | Jarang digunakan saat ini | Lapisan kemudahan untuk tool BI tertentu, dibentuk **dari** star schema |

Mesin database kolumnar modern (seperti DuckDB, BigQuery, Snowflake) mengompresi data berulang dengan sangat efisien, sehingga tabel lebar (OBT) murah untuk disimpan di disk. Hal ini membuat sebagian orang tergesa-gesa menyatakan star schema sudah usang. Pernyataan tersebut mencampuradukkan format penyimpanan fisik dengan perancangan logika bisnis. Masalah mendasar OBT jika dijadikan satu-satunya model data adalah hilangnya kepastian grain, pembaruan data (misal pelanggan pindah kota) terpaksa memodifikasi miliaran baris transaksi historis, dan setiap departemen akan tergoda membuat varian OBT versinya sendiri. Perlakukan star schema sebagai model kebenaran bersama yang teruji, lalu turunkan OBT di atasnya jika alat visualisasi tertentu membutuhkannya.

## @lesson Pengelolaan kunci: surrogate key dan anggota unknown
**Natural key (business key)** berasal langsung dari sistem sumber (`customer_id`, `product_id`). **Surrogate key** adalah bilangan bulat (integer) tanpa makna bisnis yang diterbitkan sendiri oleh gudang data (`customer_sk`). Tabel fakta wajib melakukan join ke dimensi menggunakan surrogate key. Alasannya sangat mendasar:

- **Isolasi dari anomali sistem sumber.** Dua sistem aplikasi berbeda bisa menggunakan format id yang sama untuk entitas berbeda; id sumber bisa didaur ulang, diberi penomoran baru, atau berubah tipe data setelah migrasi aplikasi.
- **Memungkinkan pencatatan histori.** Ketika atribut pelanggan berubah dan versi baru dibuat (SCD Tipe 2 di bawah), satu natural key akan memiliki beberapa baris rekaman; hanya surrogate key yang dapat menentukan *versi mana* yang berlaku pada saat transaksi terjadi.
- **Performa komputasi.** Join antar-integer jauh lebih cepat dan hemat memori dibandingkan join pada string UUID atau kode alfanumerik.

Selalu pertahankan natural key asli di dalam tabel dimensi sebagai kolom biasa, sehingga silsilah data (data lineage) tetap dapat dilacak balik ke aplikasi asal.

**Setiap baris fakta wajib merujuk ke baris dimensi yang nyata.** Namun data dunia nyata tidak pernah ideal: transaksi pesanan tiba untuk pelanggan yang belum terdaftar di snapshot pelanggan hari itu (*late-arriving dimension*), produk dihapus di sistem sumber, atau kolom bernilai NULL. Nilai foreign key NULL adalah racun: pada operasi INNER JOIN baris fakta akan hilang tanpa peringatan dan angka omset dashboard langsung menyusut. Solusi standar industri adalah **anggota unknown (unknown member)**: baris khusus di tabel dimensi dengan nomor kunci khusus (misalnya `customer_sk = -1`, `city = 'Unknown'`) tempat tabel fakta merujuk ketika entitas aslinya tidak ditemukan. Total omset tetap akurat 100%, data yang tidak dikenal terlihat jelas di laporan (dan dapat dihitung untuk memicu peringatan otomatis tim engineering), dan ketika data dimensi susulan tiba, kunci fakta dapat diperbaiki.

Pada data lab KopiKu, terdapat 32 baris pesanan milik pelanggan yang tidak terdaftar di tabel pelanggan sumber. Dengan anggota unknown, transaksi tersebut tercatat rapi di bawah kategori tier "Unknown" dengan nilai omset Rp 5.965.000; tanpa pola ini, omset tersebut akan lenyap diam-diam dari setiap query pelaporan per tier pelanggan.

## @lesson Slowly changing dimensions: merekam kebenaran masa lalu
Pelanggan berpindah domisili, produk berganti nama kemasan, tier loyalitas diperbarui. Nilai atribut dalam dimensi berubah secara **perlahan (slowly)** seiring waktu, dan Anda harus memutuskan apa yang harus ditampilkan oleh laporan tentang masa lalu. Keputusan arsitektur inilah yang dinamakan tipe **Slowly Changing Dimension (SCD)**:

| Tipe SCD | Perilaku Saat Atribut Berubah | Histori Disimpan? | Kasus Penggunaan Ideal |
|---|---|---|---|
| **0** | Nilai terkunci permanen; abaikan perubahan | Asli permanen | Tanggal lahir, tanggal pertama kali mendaftar |
| **1** | Timpa langsung nilai lama (overwrite) | Tidak ada | Koreksi kesalahan ketik nama, perbaikan typo data |
| **2** | Tambahkan **baris baru** (versi baru); simpan baris lama | Histori penuh | Segala hal di mana laporan masa lalu tidak boleh bergeser: kota, tier, sales owner |
| **3** | Tambahkan kolom baru untuk nilai sebelumnya (`previous_city`) | Satu langkah mundur | Kebutuhan khusus perbandingan sebelum vs sesudah |
| **4 / 6** | Mini-dimension untuk atribut super dinamis / kombinasi hybrid tipe 1, 2, dan 3 | Bervariasi | Arsitektur tingkat lanjut |

Mengapa ini sangat penting? Mari kita buktikan dengan data lab: tier pelanggan meningkat seiring akumulasi belanja mereka. Jika kita menghitung omset per tier **berdasarkan tier yang dimiliki pelanggan pada saat transaksi berlangsung**, omset kategori Gold bernilai Rp 97.650.000. Namun jika kita menghitung menggunakan tier **terkini** pelanggan (sebagaimana yang dihasilkan oleh penimpaan SCD Tipe 1), omset Gold melonjak menjadi **Rp 104.485.000**, selisih 7% lebih tinggi karena 444 transaksi item milik pelanggan dipindahkan historinya ke tier baru. Angka kedua tidak salah secara matematis, tetapi telah *menulis ulang histori secara sepihak*: laporan keuangan kuartal lalu yang sudah diaudit dan ditandatangani manajemen akan menampilkan angka yang berbeda jika dibuka kembali hari ini.

**Mekanisme teknis SCD Tipe 2.** Setiap versi entitas dicatat sebagai satu baris terpisah dengan rentang waktu validitas:

| customer_sk | customer_id | city | tier | valid_from | valid_to | is_current |
|---|---|---|---|---|---|---|
| 1 | 1 | Jakarta | Silver | 2026-01-01 | 2026-01-10 | 0 |
| 2 | 1 | Jakarta | Gold | 2026-01-10 | 2026-01-20 | 0 |
| 3 | 1 | Bandung | Gold | 2026-01-20 | 9999-12-31 | 1 |

`valid_from` bersifat inklusif, sedangkan `valid_to` bersifat eksklusif dan nilainya sama persis dengan `valid_from` versi berikutnya, sehingga garis waktu tersambung rapat tanpa celah dan tanpa tumpang tindih. Tanggal masa depan yang sangat jauh (`9999-12-31`) untuk versi yang sedang aktif mencegah perlunya logika penanganan NULL yang rumit dalam perbandingan waktu. Anda dapat membangun dimensi ini dari feed mutasi data hanya dengan satu fungsi window SQL (`LEAD(effective_ts, 1, '9999-12-31') OVER (PARTITION BY customer_id ORDER BY effective_ts)`), persis seperti tantangan d-1 di playground sandbox.

**Teknik as-of join.** Untuk menghubungkan transaksi fakta ke versi dimensi yang benar, lakukan join pada natural key **sekaligus** rentang tanggal transaksinya:

```sql
JOIN dim_customer c
  ON c.customer_id = o.customer_id
 AND o.order_ts >= c.valid_from
 AND o.order_ts <  c.valid_to
```

Jika Anda lupa menyertakan syarat rentang tanggal dan hanya melakukan join pada `customer_id`, setiap pesanan akan terhubung ke *seluruh* versi pelanggan tersebut: pada data lab, 7.123 baris pesanan membengkak menjadi **8.552** baris, lonjakan inflasi data palsu sebesar 20%. Ini adalah varian SCD Tipe 2 dari jebakan fan-out. Rangkaian pengujian data wajib memvalidasi bahwa jumlah baris fakta tidak berubah sebelum dan sesudah join dilakukan.

**Pemuatan bertahap (incremental load) pada Tipe 2** (saat Anda tidak memiliki feed mutasi bersih, melainkan hanya snapshot harian): bandingkan setiap baris baru yang masuk dengan versi aktif saat ini pada atribut yang dilacak; jika berbeda, tutup baris aktif (`valid_to = now`, `is_current = 0`) dan masukkan baris aktif baru. Gunakan operator `IS DISTINCT FROM` alih-alih `<>` agar perubahan dari atau ke nilai NULL tetap terdeteksi, dan pastikan langkah ini bersifat idempoten. Dua komplikasi dunia nyata yang harus diantisipasi: **perubahan yang datang terlambat (late-arriving changes)** yang mengharuskan pemotongan ulang rentang tanggal di antara versi yang sudah ada, serta **event yang tiba tidak berurutan (out-of-order events)** di mana Anda wajib mengurutkan data berdasarkan waktu kejadian di sistem sumber, bukan waktu data tiba di pipeline.

## @lesson Menjamin keandalan model: pengujian, alat, dan implementasi modern
Model data adalah kode program dan wajib memiliki rangkaian pengujian otomatis (automated testing). Kumpulan pengujian minimum yang wajib diterapkan (dan seluruhnya diuji dalam lab ini):

- **Uji Grain**: natural key tabel fakta (`order_id, line_no`) wajib bersifat unik tanpa duplikasi dan jumlah barisnya persis sama dengan data sumber.
- **Integritas Referensial**: tidak boleh ada foreign key tabel fakta yang bernilai NULL, dan seluruh foreign key wajib eksis di tabel dimensi terkait (di sinilah anggota unknown membuktikan nilainya).
- **Rekonsiliasi Angka**: `SUM(line_total_idr)` pada tabel fakta wajib identik dengan total belanja pada tabel transaksi sumber. Jika terjadi selisih, salah satu pipeline pasti mengalami kerusakan, dan Anda wajib mengetahuinya lewat unit test sebelum menjadi bahan temuan manajemen.
- **Uji Dimensi**: surrogate key bersifat unik, rentang tanggal SCD Tipe 2 tersambung tanpa celah, dan tepat satu versi aktif (`is_current = 1`) per entitas.
- **Verifikasi logika bisnis independen**: lab ini menghitung omset per tier saat transaksi berlangsung menggunakan kalkulasi terpisah dalam bahasa Python dan membandingkan hasilnya dengan output query SQL; dua implementasi berbeda yang menghasilkan angka identik adalah bukti keandalan arsitektur.

**Posisinya dalam modern data stack.** Dalam paradigma ELT modern (Modul 2.3), data mentah mendarat di lakehouse/warehouse, model **staging** membersihkan serta menstandardisasi skema kolom (seperti tabel `stg_` di lab), dan lapisan **marts** membangun model dimensional di atasnya: tabel berawalan `dim_*` dan `fct_*`. Fitur dbt test (`unique`, `not_null`, `relationships`) memverifikasi integritas kunci secara otomatis, dan fitur dbt `snapshot` mengelola SCD Tipe 2 tanpa perlu penulisan logika merge manual. Prinsip arsitekturalnya tetap identik apa pun alat bantu yang Anda gunakan.

Metodologi alternatif lain yang layak dipahami wawasannya: **Inmon** (enterprise data warehouse ternormalisasi yang mendistribusikan data ke data mart departemen), **Data Vault** (arsitektur berbasis hub, link, dan satellite yang dirancang untuk auditabilitas ekstrem dan integrasi puluhan sumber data), serta **Semantic Layer** (definisi metrik bisnis terpusat di atas tabel analitik). Star schema Ralph Kimball tetap menjadi standar industri paling umum untuk lapisan data yang dikonsumsi langsung oleh analis bisnis.

Kesalahan umum yang wajib dihindari: mencampur aduk grain yang berbeda; menaruh teks deskriptif panjang di tabel fakta alih-alih di dimensi; membiarkan foreign key bernilai NULL; menggunakan natural key di tabel fakta sehingga histori mustahil dicatat; menjumlahkan ukuran numerik non-aditif; membuat satu dimensi untuk setiap status flag alih-alih menyatukannya ke dalam junk dimension; dan merancang tabel sebelum memahami pertanyaan bisnis apa yang ingin dijawab. Selalu mulai dari pertanyaan bisnis, rumuskan grain dalam satu kalimat tegas, dan biarkan struktur tabel mengikuti secara alami.

## @lab Lab: membangun star schema KopiKu
Bangun data warehouse untuk KopiKu menggunakan SQL: dimensi tanggal, dimensi produk (SCD Tipe 1), dimensi pelanggan (SCD Tipe 2 lengkap dengan anggota unknown), dan tabel fakta pada grain item pesanan yang terhubung ke versi pelanggan yang valid pada saat pesanan dibuat. 13 unit test otomatis akan menguji integritas grain, referensial, rekonsiliasi nilai omset, serta verifikasi independen menggunakan script Python. Anda juga dibekali empat latihan sandbox interaktif di browser untuk melatih intuisi logika SCD.

### @steps
1. Buat data sintetis (jika belum ada) dan periksa hasil pembersihan data oleh skrip staging:

```bash
python3 labs/shared/shopgen.py --out data
python3 labs/mod-1-4/stage.py data warehouse.db
sqlite3 warehouse.db ".tables"        # opsional jika ada sqlite3; pengujian otomatis akan memverifikasinya
```

   `stage.py` memuat file CSV bersih ke dalam lima tabel `stg_`. Baca docstring di dalam file tersebut untuk melihat struktur kolom yang disediakan.
2. **Pemanasan di browser.** Buka SQL Sandbox dan selesaikan tantangan d-1 (membangun dimensi SCD Tipe 2 dari log perubahan dengan LEAD), d-2 (as-of join), d-3 (omset per tier saat transaksi), dan d-4 (dimensi tanggal dengan CTE rekursif). Konsep yang dilatihkan persis sama dengan tugas lab ini.
3. Buka file `labs/mod-1-4/warehouse.sql`. Komentar di bagian atas file adalah spesifikasi teknis: terdapat panduan kolom dan grain untuk keempat tabel yang harus Anda bangun. Tulis query DDL dan DML SQL secara bertahap, dimulai dari `dim_date` dan `dim_product`.
4. Bangun `dim_customer`. Buat versi awal pelanggan dari `stg_customers` (berlaku sejak signup) dan versi mutasi untuk setiap baris `stg_customer_changes`, kemudian hitung `valid_to` menggunakan fungsi window LEAD. Tambahkan baris khusus unknown member dengan surrogate key -1. Isi kota yang NULL dengan `'Unknown'`.
5. Bangun `fact_order_items` pada tahap akhir. Hubungkan setiap baris item ke pesanan induk dan ke versi pelanggan yang valid pada saat `order_ts` menggunakan teknik range join. Gunakan fungsi `COALESCE(..., -1)` untuk pesanan milik pelanggan tanpa profil agar tidak ada kunci bernilai NULL.
6. Jalankan pengujian otomatis dan cermati pesan kegagalan jika ada; pengujian akan menunjukkan aturan data mana yang dilanggar:

```bash
python3 labs/mod-1-4/test_lab.py -v
```

7. Eksplorasi model Anda dengan query analitik nyata: omset per tier per bulan, omset per profil sangrai, dan penjualan akhir pekan vs hari kerja. Kemudian, coba sengaja rusak model tersebut (misalnya dengan menghapus syarat rentang tanggal pada join pelanggan) dan amati bagaimana pengujian grain dan rekonsiliasi langsung mendeteksi kerusakan tersebut.

### @files
- labs/mod-1-4/warehouse.sql :: File kerja utama Anda: membangun empat tabel star schema :: starter
- labs/mod-1-4/stage.py :: Memuat data KopiKu yang sudah bersih ke tabel staging (disediakan) :: data
- labs/mod-1-4/test_lab.py :: 13 pengujian validasi model dan rekonsiliasi :: test
- labs/mod-1-4/answers.sql :: Tantangan sandbox dalam format file (pemanasan SCD) :: starter
- labs/mod-1-4/check.py :: Script pemeriksa otomatis untuk latihan pemanasan :: test
- labs/mod-1-4/reference/warehouse.sql :: Solusi referensi lengkap (coba kerjakan sendiri dulu!) :: reference

### @deliverables
- Seluruh 13 unit test pada `test_lab.py` berhasil lolos (PASS)
- Seluruh empat latihan sandbox pemanasan SCD berhasil diselesaikan
- Anda mampu menjelaskan grain dari setiap tabel dalam satu kalimat tegas, dan memahami apa yang terjadi pada jumlah baris fakta jika syarat rentang waktu pada join diabaikan

### @verify
```bash
python3 labs/mod-1-4/test_lab.py -v
python3 labs/mod-1-4/check.py
```

Bandingkan hasil kerja Anda dengan solusi referensi: `LAB_DIR=reference python3 labs/mod-1-4/test_lab.py`.

## @chaos Pendapatan pelanggan tier Gold yang bergeser setelah penutupan buku kuartal
### @scenario
Tim keuangan mempublikasikan laporan kuartalan resmi pada tanggal 5: pelanggan tier Gold menghasilkan omset Rp 97,7 juta. Satu bulan kemudian, dewan direksi meminta laporan kuartal yang sama untuk dipresentasikan kembali, namun angka di dashboard berubah menjadi Rp 104,5 juta. Tidak ada seorang pun analis yang mengubah query laporan tersebut. Tim data dituduh memanipulasi angka laporan keuangan.

Hal yang sebenarnya berubah: proses nightly batch pipeline menjalankan perintah `UPDATE dim_customer SET tier = s.tier FROM staging s WHERE ...` (penimpaan Tipe 1), dan selama sebulan terakhir program loyalitas menaikkan dan menurunkan tier beberapa pelanggan secara berkala.

### @cause
Dimensi menimpa langsung kolom tier pelanggan di tempat (in-place overwrite), dan query laporan melakukan join antara fakta dan dimensi berdasarkan customer key, sehingga seluruh transaksi masa lalu diberi label baru sesuai tier **terkini** pelanggan. Pelanggan yang saat bertransaksi berstatus Silver, namun minggu lalu dipromosikan menjadi Gold, menyebabkan seluruh histori belanjanya ditarik masuk ke perhitungan total Gold. Laporan tersebut konsisten secara internal pada satu titik waktu tertentu, tetapi histori masa lalunya bergeser secara liar.

Ini bukanlah bug penulisan sintaks SQL, melainkan kesalahan keputusan pemodelan arsitektur data (menerapkan Tipe 1 pada atribut yang mutlak membutuhkan Tipe 2). Tidak ada yang menyadarinya lebih awal karena tidak ada yang menanyakan: "apakah metrik resmi ini boleh berubah setelah dipublikasikan ke pemangku kepentingan?"

### @fix
1. Ubah kolom `tier` (dan `city`) menjadi **SCD Tipe 2**: simpan baris versi baru lengkap dengan `valid_from` dan `valid_to` untuk setiap perubahan data, dan hubungkan setiap fakta transaksi ke versi yang valid pada saat kejadian transaksi berlangsung.
2. Terapkan mekanisme pemuatan inkremental dengan langkah close-and-insert menggunakan operator `IS DISTINCT FROM`, dan jalankan dalam satu transaksi basis data yang idempoten agar aman saat dieksekusi berulang.
3. Rekonstruksi histori transaksi masa lalu dari log audit aplikasi sumber, sehingga perbaikan angka kuartal sebelumnya dicatat secara resmi, transparan, dan terdokumentasi.
4. Tambahkan automated data test yang membekukan angka laporan periode tertutup dan otomatis memicu alarm jika nilainya bergeser, serta buat dokumentasi Architectural Decision Record (ADR) untuk setiap atribut dimensi yang menentukan pilihan tipe SCD beserta alasannya.

### @pattern
Tentukan secara sadar untuk setiap atribut dimensi apakah histori masa lalunya boleh berubah atau tidak. Jika jawabannya "tidak boleh", atribut tersebut wajib dimodelkan sebagai SCD Tipe 2, dan tabel fakta wajib merujuk ke versi yang berlaku pada saat kejadian.

## @quiz
### Apa yang dimaksud dengan "grain" pada tabel fakta?
- [ ] Estimasi jumlah baris yang akan ditampung tabel fakta setelah berjalan selama satu tahun penuh
- [x] Pernyataan tepat tentang apa yang diwakili satu baris, misalnya satu baris per item pesanan
- [ ] Tipe data terkecil yang mampu menampung metrik numerik pada tabel fakta tanpa overflow
- [ ] Daftar seluruh tabel dimensi yang diizinkan untuk dihubungkan dengan tabel fakta terkait

> Grain adalah kalimat definisi dasar dari satu baris. Grain menentukan dimensi dan metrik mana saja yang berhak ada di tabel tersebut dan menjadi acuan utama pengujian integritas keunikan data.

### Satu pesanan memiliki tiga item belanja. Biaya pengiriman sebesar 20.000 dicatat satu kali pada pesanan dan disalin ke setiap baris item pada tabel fakta. Apa yang terjadi jika Anda menjumlahkan biaya pengiriman tersebut?
- [ ] Totalnya akurat, karena setiap baris item membawa informasi biaya pengiriman sah yang dimiliki pesanan
- [ ] Basis data mengeluarkan error, karena metrik dari dua grain berbeda tidak boleh digabung dalam satu query
- [x] Biaya pengiriman terhitung tiga kali, karena metrik itu berada pada grain pesanan, bukan baris item
- [ ] Hanya baris item pertama yang dihitung, karena nilai duplikat otomatis diabaikan oleh fungsi SUM

> Metrik numerik hanya dapat dijumlahkan secara benar pada tingkat grain miliknya sendiri. Simpan biaya pengiriman pada tabel fakta tingkat pesanan, atau alokasikan proporsinya secara eksplisit ke tiap item.

### Seorang pelanggan berpindah domisili dari Jakarta ke Bandung. Laporan penjualan tahun lalu harus tetap mencatat transaksi tersebut di Jakarta. Tipe SCD manakah yang wajib diterapkan?
- [ ] Tipe 1, yang menimpa nama kota secara langsung dan mempertahankan laporan tahun lalu tanpa perubahan
- [ ] Tipe 0, yang menyimpan nama kota baru tepat di samping nama kota lama pada baris yang sama
- [x] Tipe 2, yang menambah baris versi baru dan mempertahankan baris lama beserta rentang validitasnya
- [ ] Tipe 3, yang menyimpan seluruh histori perpindahan kota pelanggan ke dalam satu kolom teks tambahan

> Tipe 2 mempertahankan histori penuh: baris lama (yang valid sampai waktu pindah) tetap mencatat Jakarta dan transaksi masa lalu tetap merujuk ke baris tersebut. Tipe 1 menghapus histori, sedangkan Tipe 3 hanya menyimpan satu nilai sebelumnya.

### Anda menghubungkan tabel fakta ke dimensi pelanggan SCD Tipe 2 hanya menggunakan kolom `customer_id` tanpa rentang waktu. Masalah apa yang akan terjadi?
- [ ] Tidak terjadi masalah apa pun, karena surrogate key otomatis memilih versi yang paling tepat
- [ ] Query hanya akan menampilkan versi pelanggan yang sedang aktif dan mengabaikan versi lama
- [x] Tiap baris fakta cocok dengan semua versi pelanggannya, sehingga baris dan total berlipat ganda
- [ ] Operasi join langsung gagal dengan pesan error karena dimensi memiliki beberapa baris untuk satu kunci

> Tanpa batasan rentang tanggal validitas, satu transaksi pesanan akan terhubung ke seluruh baris versi milik pelanggan tersebut, memicu pelipatgandaan data (fan-out). Pada data lab, 7.123 baris membengkak menjadi 8.552 baris.

### Mengapa tabel fakta dihubungkan ke tabel dimensi menggunakan surrogate key alih-alih natural key?
- [ ] Natural key tidak dapat diindeks, sedangkan surrogate key selalu diindeks oleh mesin database modern
- [ ] Penggunaan surrogate key diwajibkan oleh standar SQL setiap kali tabel memiliki foreign key
- [x] Memisahkan gudang data dari perubahan sistem sumber dan membuat satu entitas punya banyak versi
- [ ] Surrogate key mengenkripsi identitas sumber agar tim analis tidak dapat melihat data pribadi pelanggan

> Surrogate key melindungi gudang data dari pendaurulangan atau perubahan format id dari aplikasi sumber, dan merupakan satu-satunya cara untuk membedakan versi mana dari SCD Tipe 2 yang harus dirujuk oleh tabel fakta.

### Sebuah transaksi pesanan tiba untuk pelanggan yang belum terdaftar di tabel dimensi pelanggan. Praktik terbaik apa yang harus dilakukan?
- [ ] Hapus pesanan tersebut dari tabel fakta hingga profil pelanggan muncul, lalu muat ulang datanya
- [ ] Isi foreign key pelanggan dengan nilai NULL agar baris fakta tetap tersimpan di tabel fakta
- [x] Arahkan ke baris anggota "unknown" sementara, lalu perbaiki kuncinya saat profil pelanggan tiba
- [ ] Buat baris dimensi baru secara otomatis yang menduplikasi atribut dari pelanggan transaksi sebelumnya

> Anggota unknown memastikan seluruh transaksi fakta tetap dapat di-join tanpa menghilangkan baris dalam operasi INNER JOIN, menjaga integritas omset total, serta memungkinkan pemantauan anomali secara transparan.

### Pernyataan manakah yang paling tepat mengenai perbandingan star schema versus One Big Table (OBT)?
- [ ] Star schema sudah usang karena penyimpanan kolumnar membuat optimasi join menjadi mustahil dilakukan
- [ ] OBT selalu lebih unggul karena menghilangkan kebutuhan terhadap pengelolaan kunci dan dokumentasi
- [x] Star schema adalah model teruji dengan grain yang jelas, dan OBT idealnya diturunkan dari model itu
- [ ] Snowflake schema wajib digunakan setiap kali sebuah dimensi memiliki lebih dari sepuluh kolom atribut

> Murahnya media penyimpanan mengubah efisiensi OBT di tingkat fisik, tetapi tidak menghapus kebutuhan bisnis akan kejelasan grain dan definisi entitas tunggal. Menjadikan OBT sebagai satu-satunya model mengaburkan grain dan menyulitkan pembaruan data.

### Pasangan pengujian data manakah yang paling efektif melindungi tabel fakta baru dari kesalahan fatal yang tersembunyi?
- [ ] Uji bahwa tabel tidak kosong dan uji bahwa waktu pemuatan data berlangsung di bawah satu menit
- [x] Uji keunikan pada grain yang dideklarasikan dan rekonsiliasi total angka dengan data sumber
- [ ] Uji bahwa setiap kolom memiliki deskripsi dan uji bahwa penamaan kolom menggunakan huruf kecil
- [ ] Uji bahwa tabel memiliki indeks dan uji bahwa seluruh metrik numerik bernilai angka positif

> Uji keunikan grain mendeteksi baris yang terduplikasi atau berlipat ganda; uji rekonsiliasi mendeteksi hilangnya atau terciptanya omset fiktif. Keduanya menangkap mayoritas kesalahan logika join dan transformasi data.

## @resources
- [Kimball Group: dimensional modeling techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [dbt docs: snapshots (Type 2 dimensions)](https://docs.getdbt.com/docs/build/snapshots)
- [SQLite: window functions (LEAD)](https://www.sqlite.org/windowfunctions.html)

