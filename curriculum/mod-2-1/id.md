---
title: Penyimpanan Kolumnar, Parquet, DuckDB, dan Polars
duration: 2 minggu
summary: Pahami mengapa mesin analitik modern menyimpan data berdasarkan kolom, bagaimana struktur internal file Parquet dilewati (skipping) saat query, dan gunakan DuckDB serta Polars untuk mengolah puluhan juta baris di satu laptop dengan konsumsi RAM dan kecepatan terukur.
why: Banyak tutorial menyuruh Anda langsung menyalakan cluster terdistribusi hanya untuk memproses file sebesar 15 GB. Satu laptop modern dengan format file dan mesin eksekusi yang tepat mampu menyelesaikannya dalam hitungan detik. Memahami prinsip ini menghemat waktu berbulan-bulan dan mencegah tagihan cloud jutaan rupiah.
---

## @outcomes
- Menjelaskan perbedaan mendasar tata letak baris (row-oriented) dan kolom (column-oriented), serta mengapa format kolumnar membuat proses pemindaian analitik jauh lebih hemat I/O dan kencang
- Menguraikan struktur fisik file Parquet (row group, column chunk, page, serta footer statistics) dan cara mesin query memanfaatkan metadata tersebut untuk melewati data yang tidak relevan
- Mengonversi CSV ke Parquet dengan rasio kompresi optimal dan ukuran row group yang tepat, serta membuktikan pengaruh urutan sortir data terhadap ukuran file dan efektivitas skipping
- Mengeksekusi query langsung di atas file menggunakan DuckDB (SQL) dan Polars (lazy dataframe), serta membaca execution plan untuk memverifikasi filter pushdown dan column pruning
- Mengambil keputusan berbasis data terukur kapan harus menggunakan pandas, Polars, DuckDB, atau beralih ke mesin terdistribusi

## @prereq
Modul 1.2 (streaming memori) dan Modul 1.3 (SQL analitik, execution plan). Jalankan `pip install -r labs/mod-2-1/requirements.txt` untuk memasang DuckDB, Polars, PyArrow, dan pandas.

## @part Cara kerja penyimpanan kolumnar

## @lesson Baris versus kolom: arsitektur penyimpanan data
Sebuah tabel pada dasarnya adalah kisi (grid) dua dimensi. Untuk menyimpannya ke dalam media disk atau RAM, kisi tersebut harus diratakan menjadi urutan byte linear, dan terdapat dua pendekatan mendasar:

Penyimpanan **berorientasi baris (row-oriented)** menuliskan satu baris data utuh secara berurutan: `(pesanan 1: id, pelanggan, status, total) (pesanan 2: ...)`. Ini adalah cara kerja file CSV dan basis data transaksional seperti PostgreSQL. Format ini sempurna untuk transaksi OLTP di mana aplikasi mengakses **satu rekaman utuh**: mengambil detail pesanan #4821, memperbarui statusnya, atau menyisipkan pesanan baru. Seluruh byte dari satu rekaman berada berdampingan di disk.

Penyimpanan **berorientasi kolom (column-oriented)** menuliskan seluruh nilai dari satu kolom secara bersamaan: `(semua id) (semua pelanggan) (semua status) (semua total)`. Pertanyaan analitik bisnis hampir tidak pernah membutuhkan seluruh kolom rekaman. Pertanyaan seperti "total nominal belanja berdasarkan status pesanan" hanya menyentuh **dua kolom** dari total lima puluh kolom yang ada di tabel. Dengan format kolumnar, mesin hanya membaca dua kolom tersebut dari disk dan sama sekali tidak menyentuh 48 kolom lainnya; sebaliknya pada format baris, mesin terpaksa membaca seluruh byte dari setiap baris hanya untuk mengambil dua atribut yang dibutuhkan.

:::talk Dua kolom dari lima puluh
@teacher Sebuah tabel punya 50 kolom dan 100 juta baris. Query Anda hanya butuh dua di antaranya: `status` dan `total_idr`. Di file berorientasi baris, nilai-nilai satu baris berdekatan, baris demi baris. Di file berorientasi kolom, semua nilai satu kolom berdekatan.
@ask Kira-kira berapa banyak dari file yang harus dibaca untuk menjawab query itu?
@choice Semuanya di kedua tata letak: file selalu dibaca dari awal sampai akhir | Itu benar untuk file baris, di mana setiap baris membawa semua 50 nilai. File kolom menyimpan setiap kolom di tempatnya sendiri, sehingga yang lain boleh tidak dibaca. Coba lagi.
@choice * Sekitar 2/50 dari data pada file kolom, tetapi semuanya pada file baris | Betul. Tata letak kolom memungkinkan mesin membaca hanya dua kolom yang dibutuhkan, sehingga pekerjaan, dan tagihan cloud, menyusut hingga 25 kali di sini.
@choice Sekitar separuhnya di kedua tata letak | Tidak ada tata letak yang menghasilkan "separuh". Coba lagi.
@teacher Karena itulah analitik memakai kolom dan toko online memakai baris: toko membaca satu pesanan utuh, analitik membaca beberapa kolom dari jutaan pesanan.
:::

Tiga keunggulan utama format kolumnar:

1. **Efisiensi I/O Disk yang Ekstrem.** Membaca 2 dari 50 kolom berarti membaca hanya sekitar 4% volume data. Pada contoh benchmark 7 kolom di Pelajaran 5, Anda akan melihat laporan mesin analitik bertuliskan `PROJECT 3/7 COLUMNS`: hanya tiga dari tujuh kolom yang dimuat ke memori.
2. **Rasio Kompresi Jauh Lebih Tinggi.** Nilai-nilai dalam satu kolom memiliki tipe data yang seragam dan pola yang berulang (`'mobile'`, `'mobile'`, `'desktop'`, ...). Karakteristik ini memungkinkan teknik kompresi tingkat tinggi seperti **dictionary encoding** (menyimpan setiap string unik satu kali lalu menggantinya dengan bilangan bulat kecil), **run-length encoding (RLE)** (mencatat `'mobile' x 1000` sekali alih-alih mengulang `'mobile'` 1.000 kali), **delta encoding** (mencatat selisih angka pada timestamp terurut), dan **bit-packing** (hanya memakai jumlah bit yang benar-benar dibutuhkan oleh nilai maksimum).
3. **Komputasi CPU Sangat Cepat.** Menjumlahkan sebuah kolom angka menjadi perulangan sederhana pada larik array angka yang bersambungan di RAM, yang dieksekusi oleh CPU modern dengan instruksi **SIMD** (Single Instruction, Multiple Data, menjumlahkan 4 hingga 16 angka dalam satu siklus CPU alih-alih satu baris pada satu waktu).

Konsekuensinya adalah kebalikannya: membaca atau memperbarui **satu baris utuh** mengharuskan mesin membuka setiap kolom terpisah. Oleh karena itu, format kolumnar sangat ideal untuk analitik dan pemuatan data batch masif, namun buruk untuk penulisan baris tunggal frekuensi tinggi. Itulah mengapa arsitektur produksi memisahkan database OLTP untuk aplikasi (Modul 0.2) dan format kolumnar untuk analitik.

Pengukuran nyata pada tabel benchmark ilustratif berisi 5.000.000 baris dengan tujuh kolom (id, timestamp, kategori, dan nominal) yang ditulis dengan DuckDB dan Parquet (terpisah dari tabel uji 1.000.000 baris yang lebih kecil di `test_lab.py`; di sini **Snappy** mengutamakan kecepatan dekompresi dan **Zstd / Zstandard** menghasilkan ukuran file lebih kecil dengan kecepatan sebanding):

| Format File | Ukuran di Disk |
|---|---|
| CSV murni | 273 MB |
| Parquet, kompresi snappy, terurut berdasarkan timestamp | 65 MB |
| Parquet, kompresi zstd, terurut berdasarkan timestamp | **40 MB** |
| Parquet, kompresi zstd, baris dalam urutan acak | 66 MB |

Dua baris terakhir tabel di atas memperlihatkan wawasan penting: data yang *sama persis*, ketika disimpan dalam urutan acak, berukuran 65% lebih besar, karena timestamp yang terurut dan nilai berulang berada bersebelahan sehingga algoritma kompresi bekerja jauh lebih efektif. Cara Anda mengurutkan data sebelum menulisnya adalah keputusan performa arsitektur.

> 🛠 **Coba sendiri (10 menit, Python).** Jalankan `pip install pandas pyarrow`, lalu impor `os`, `import pandas as pd`, dan `import pyarrow.parquet as pq`. Muat `data/orders.csv` dengan `pd.read_csv(..., dtype={"customer_id": "string"})` dan simpan dengan `df.to_parquet("orders.parquet")`. Bandingkan ukuran kedua file dengan `os.path.getsize`. Lalu buka `pq.ParquetFile("orders.parquet").metadata.row_group(0)` dan, untuk setiap `column(i)`, cetak `path_in_schema` dan `total_compressed_size`. Kolom mana yang paling besar, mana yang paling kecil, dan mengapa? Terakhir, hitung berapa porsi byte Parquet yang harus dibaca query "total per status" (kolom `status` dan `total_idr`), dan bandingkan dengan CSV, yang setiap byte-nya harus dibaca.
>
> **Seharusnya Anda melihat:** CSV-nya `195075` byte dan file Parquet sekitar 77.000 (angka persisnya sedikit bergeser menurut versi library), jauh di bawah separuhnya. `order_ts` adalah kolom terbesar (sekitar 37 KB: hampir setiap nilainya berbeda), `status` dan `payment_method` yang terkecil (1 sampai 2 KB: segelintir nilai yang berulang), dan `status` ditambah `total_idr` sekitar 9% dari byte Parquet.

:::ask Sebuah tabel punya 50 kolom dan 100 juta baris. Sebuah query hanya menjumlahkan kolom `amount`. Tata letak mana yang membaca data paling sedikit?
@options
* tata letak kolom: hanya membaca nilai amount
tata letak baris: membaca tiap rekaman utuh
keduanya membaca sama, ukuran file-nya sama besar
@why
Penyimpanan kolom menyatukan semua nilai satu kolom, jadi mesin hanya membaca byte kolom itu (sekitar 1/50 tabel). Tata letak baris harus membaca setiap baris utuh untuk sampai ke satu field.
:::

:::trace Dari baris ke kolom
@code
rows = [(1, "paid", 150), (2, "cancelled", 90), (3, "paid", 25)]
ids = [r[0] for r in rows]
statuses = [r[1] for r in rows]
amounts = [r[2] for r in rows]
print(sum(amounts))
@notes
1 | **Tata letak baris**: setiap tuple adalah satu rekaman utuh. Untuk menjumlahkan satu field, Anda tetap melewati setiap rekaman.
2 | **Tata letak kolom, langkah 1**: semua id berdampingan.
4 | **Tata letak kolom, langkah 3**: semua amount berdampingan. Query total hanya menyentuh daftar ini.
5 | Penjumlahan membaca satu daftar dan mengabaikan dua lainnya. Data sama, urutan di disk berbeda.
:::

:::drill python Baris ke kolom
Tulis `to_columns(rows, names)`: `rows` adalah daftar tuple, `names` nama kolom. Kembalikan dictionary yang memetakan tiap nama ke daftar nilai kolom itu, sesuai urutan baris.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("to_columns") ## Definisikan to_columns(rows, names).
to_columns([(1, "a"), (2, "b")], ["id", "tag"]) == {"id": [1, 2], "tag": ["a", "b"]} ## Tiap nama mendapat daftar kolomnya.
to_columns([], ["x"]) == {"x": []} ## Tanpa baris: setiap kolom berupa daftar kosong.
to_columns([(5, 6, 7)], ["a", "b", "c"]) == {"a": [5], "b": [6], "c": [7]} ## Berlaku untuk jumlah kolom berapa pun.
@hint
Pasangkan setiap indeks kolom `i` dengan nama kolomnya memakai `enumerate(names)`, lalu petakan tiap nama ke daftar yang mengumpulkan `row[i]` dari setiap tuple di `rows`.
@solution
def to_columns(rows, names):
    return {name: [row[i] for row in rows] for i, name in enumerate(names)}
:::

## @lesson Membedah jeroan file Apache Parquet
**Apache Parquet** adalah standar terbuka format file kolumnar untuk dunia analitik, yang didukung langsung oleh DuckDB, Polars, Spark, pandas, Snowflake, BigQuery, dan hampir seluruh platform data modern. File Parquet memiliki arsitektur hierarkis berlapis:

```text
file
 ├─ row group 0           (irisan horizontal: sekitar 100.000 s.d. 1.000.000 baris)
 │    ├─ column chunk: event_id   ─ pages (terkompresi & ter-encode)
 │    ├─ column chunk: event_ts   ─ pages
 │    └─ ...
 ├─ row group 1
 │    └─ ...
 └─ footer                (skema + tiap column chunk: offset, ukuran, encoding, min, max, null count)
```

- **Row group** adalah irisan horizontal tabel. Di dalam setiap row group, setiap kolom disimpan sebagai **column chunk**, dan tiap chunk dibagi lagi menjadi **pages** (unit terkecil untuk kompresi dan encoding).
- **Footer** di bagian akhir file adalah rahasia kecepatan Parquet. Footer menyimpan skema tabel dan **statistik metadata** untuk setiap column chunk di setiap row group: nilai minimum, nilai maksimum, serta jumlah nilai null. Mesin pembaca Parquet akan membaca footer terlebih dahulu (hanya beberapa kilobyte), sehingga mesin langsung mengetahui lokasi byte tiap kolom dan rentang nilai dari setiap chunk.
- Seluruh kolom bersifat **strictly typed** (integer, decimal, timestamp, string, struct bertingkat); kekacauan "semua data adalah teks" seperti di CSV lenyap sepenuhnya.
- Algoritma kompresi dapat ditentukan per file atau per kolom: **snappy** (sangat cepat, kompresi moderat), **zstd** (standar emas modern: rasio kompresi sangat tinggi dengan kecepatan dekompresi impresif), dan **gzip** (arsip lama, lambat).

> 💡 **Jeda Praktik: Konversi CSV ke Parquet dengan DuckDB**
> 1. Buka file `labs/mod-2-1/analytics.py` di Text Editor (VS Code / Cursor). Jangan mengeksekusi file Python langsung di bash terminal tanpa interpreter.
> 2. Temukan fungsi `to_parquet(csv_path, parquet_path, row_group_size=100_000)`. Jalankan SQL DuckDB dari Python dengan `duckdb.connect().execute("...")` (dibahas lengkap di Pelajaran 4), menggunakan perintah `COPY (SELECT * FROM read_csv('...', header=true)) TO '...' (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE ...)` untuk mengonversi CSV ke Parquet terkompresi zstd dengan ukuran row group yang ditentukan. Ingat bahwa klausa target path pada `COPY ... TO` tidak menerima placeholder parameter `?`, jadi susun query SQL sebagai f-string dengan path yang dibersihkan.
> 3. Buka terminal Anda dan jalankan pengujian unit konversi Parquet:
> `pytest labs/mod-2-1/test_lab.py -v -k TestToParquet`
> 4. Pastikan ke-4 pengujian lulus (`4 passed`). Amati bagaimana tipe data berhasil diinferensikan secara otomatis dan kompresi ZSTD diterapkan pada tiap row group.

:::talk Melewati tanpa membaca
@teacher Sebuah file Parquet dipotong menjadi row group, dan footer-nya menyimpan `order_ts` terkecil dan terbesar dari setiap group. Anda meminta pesanan pada satu jam saja di tanggal 12 Januari.
@ask Kapan mesin bisa melewati sebagian besar row group?
@choice Tidak pernah: melewati hanya bisa dengan index database | Parquet tidak punya index, tetapi statistik min/maks melakukan pekerjaan yang sama bila datanya berurutan. Coba lagi.
@choice Selalu, karena footer mendaftar setiap group | Footer hanya menyebut nilai terkecil dan terbesar tiap group. Kalau setiap group berisi waktu dari sebulan penuh, tidak ada yang bisa dikesampingkan. Coba lagi.
@choice * Ketika file diurutkan menurut `order_ts`, sehingga setiap group mencakup rentang waktu yang sempit | Betul. Pada data terurut rentang sebuah group sempit, jadi footer membuktikan bahwa sebagian besar group tidak mungkin berisi jam itu. Pada file berurutan acak, rentang setiap group tumpang tindih dengan jam itu, dan tidak ada yang dilewati.
@teacher Jadi cara Anda mengurutkan data saat menulis menentukan seberapa banyak yang bisa dilewati query nanti, tanpa file atau index tambahan.
:::

**Dua optimasi kunci yang membuat query Parquet sangat kencang:**

- **Projection Pushdown (Column Pruning).** Mesin analitik hanya membaca kolom-kolom yang secara eksplisit diminta oleh query dan mengabaikan sisa kolom lainnya.
- **Predicate Pushdown (Filter Pushdown).** Sebelum membaca halaman data dari disk, mesin membandingkan klausa filter WHERE dengan statistik min/max di footer, lalu **melewati (skipping) seluruh row group yang mustahil memuat data target**. Jika rentang timestamp suatu row group adalah pukul 09:00 s.d. 09:15 dan query meminta data pukul 14:00 s.d. 15:00, seluruh row group tersebut dilewati tanpa dibaca sama sekali.

Efektivitas predicate pushdown sangat bergantung pada **urutan sortir baris (sort order)**. Pada contoh benchmark 5 juta baris (50 row group masing-masing 100.000 baris), filter rentang waktu satu jam hanya perlu membaca **5 dari 50 row group** pada file yang terurut waktu, namun harus membaca **seluruh 50 row group** pada file dengan data acak: rentang min/max setiap row group pada data acak mencakup rentang sepanjang hari, sehingga tidak ada satu pun yang dapat dilewati. Statistiknya sama persis; tata letaknyalah yang menentukan apakah statistik itu berguna. Di lab praktis, Anda akan mengimplementasikan fungsi keputusan ini sendiri (`row_groups_to_read`, di mana `test_lab.py` menguji tabel 1 juta baris dengan 20 row group dan mengharapkan 1 hingga 3 row group pada data terurut): hanya bermodalkan metadata footer, tentukan row group mana saja yang wajib dibaca.

Pelajaran praktis untuk perancangan pipeline:

- **Urutkan atau kelompokkan data berdasarkan kolom yang paling sering difilter** (biasanya kolom tanggal/waktu transaksi) saat menulis file Parquet.
- **Ukuran row group dan file yang ideal.** Ukuran row group sekitar 100.000 hingga 1.000.000 baris memberikan keseimbangan terbaik antara efektivitas skipping dan overhead metadata. Target ukuran satu file Parquet adalah 100 MB hingga 1 GB. Ribuan file berukuran kecil lambat diproses (masing-masing butuh pembukaan file, pembacaan footer, dan pencatatan metadata); inilah **small files problem**, yang diperbaiki melalui proses pemadatan (compaction, Modul 2.2).
- **File Parquet bersifat immutable.** Anda tidak dapat memperbarui satu baris di tempat; modifikasi data berarti menulis file Parquet baru. Format tabel terbuka (Modul 2.2) membangun pembaruan yang aman di atas fondasi ini.

:::ask Satu file Parquet punya 3 row group. Footer menyatakan `total` 0 sampai 100 di group 0, 100 sampai 200 di group 1, dan 200 sampai 300 di group 2. Anda menjalankan query `WHERE total > 250`. Berapa row group yang harus dibaca engine?
@options
ketiga row group, untuk memastikan
* hanya satu (group 2)
tidak ada, footer tidak bisa dipercaya
@why
Setiap row group menyimpan statistik min/max di footer. Group 0 dan 1 punya maksimum di bawah 250, jadi engine **melewatinya** tanpa membaca datanya. Inilah predicate pushdown, dan mengapa data yang terurut (rentang sempit) lebih banyak dilewati.
:::

> 💡 **Jeda Praktik: Implementasi Predicate Pushdown Mandiri**
> 1. Di Text Editor pada `labs/mod-2-1/analytics.py`, arahkan ke fungsi `row_groups_to_read(parquet_path, column, lo, hi)`.
> 2. Buka metadata file menggunakan `pq.ParquetFile(parquet_path).metadata`. Temukan indeks kolom target, lalu lakukan iterasi pada tiap row group. Baca `statistics`: jika statistik tidak ada atau tidak memiliki min/max, row group wajib dibaca (tambahkan ke daftar); jika ada, periksa apakah rentang `[stats.min, stats.max]` beririsan dengan `[lo, hi]` (`stats.max >= lo and stats.min <= hi`).
> 3. Uji logika skipping Anda di terminal:
> `pytest labs/mod-2-1/test_lab.py -v -k TestPushdown`
> 4. Pastikan ke-3 pengujian lulus (`3 passed`). Perhatikan bagaimana data yang terurut waktu hanya membutuhkan 1 hingga 3 row group untuk dibaca, sedangkan data acak memaksa mesin membaca hampir seluruh row group.

## @lesson Apache Arrow dan eksekusi tervektorisasi (vectorized)
**Apache Arrow** adalah format data kolumnar standar untuk representasi **di dalam memori RAM**, pasangan serasi dari Parquet yang berada di disk. Nilai terbesar Arrow adalah standardisasi memori bersama: DuckDB, Polars, pandas (dengan backend PyArrow), Spark, dan database dapat bertukar data di RAM **tanpa serialisasi dan tanpa penyalinan memori (zero-copy)**. Itulah mengapa konversi `duckdb_result.pl()` (ke Polars) atau `.arrow()` berlangsung seketika.

Bagaimana mesin query modern menghitung data kolom secara kilat? Basis data konvensional memproses data **satu baris demi satu baris** ("tuple-at-a-time"), yang membayar overhead pemanggilan fungsi dan conditional branch pada setiap nilai. Mesin analitik kolumnar modern menerapkan **eksekusi tervektorisasi (vectorized execution)**: mereka memproses **satu batch larik nilai** (DuckDB memproses vektor berisi 2.048 nilai) sekaligus dalam perulangan loop CPU yang rapat. Manfaatnya: data tetap berada di CPU L1/L2 cache, overhead loop diamortisasi melintasi ribuan nilai, compiler dapat mengaktifkan instruksi **SIMD** (Single Instruction Multiple Data: satu instruksi CPU memproses banyak angka sekaligus), dan filter dievaluasi sebelum kolom lain dimuat ke memori (**late materialization**). Dipadukan dengan multi-threading, sebuah laptop mampu memaksimalkan seluruh bandwidth memori perangkat kerasnya.

Prinsip penting yang harus menjadi kebiasaan kerja Anda: **nyatakan logika transformasi sebagai operasi berbasis kolom utuh** (melalui query SQL atau ekspresi dataframe) dan biarkan mesin C++/Rust yang menjalankan loop-nya. Perulangan loop `for` Python baris demi baris membayar overhead interpreter Python yang sangat mahal pada tiap elemen (Modul 1.2); logika yang sama jika ditulis sebagai ekspresi SQL DuckDB atau Polars akan berjalan jauh lebih cepat.

> 🛠 **Coba sendiri (5 menit, Python).** Jalankan `pip install duckdb`. Jumlahkan `x * 2` untuk setiap `x` dari 0 sampai 1.999.999 dengan `x % 3 == 0`, dua kali: sekali dengan loop `for` Python atas `range(2_000_000)`, dan sekali dengan satu query DuckDB lewat `duckdb.sql("SELECT sum(x * 2) FROM range(2000000) t(x) WHERE x % 3 = 0").fetchall()[0][0]` (di SQL DuckDB, `range(N) t(x)` adalah fungsi generator tabel bawaan yang menghasilkan baris `0..N-1` pada kolom `x`, dibahas lebih lanjut di Pelajaran 4). Ukur waktu masing-masing dengan `time.perf_counter()` dan pastikan kedua jawabannya sama.
>
> **Seharusnya Anda melihat:** kedua jawaban bernilai `1333332666666`; loop-nya butuh sekitar 90 sampai 160 ms dan DuckDB sekitar 20 ms. Query DuckDB yang pertama juga membayar biaya awal sekali saja (sekitar 45 ms di laptop kami), jadi jalankan untuk kedua kalinya untuk melihat kecepatan sebenarnya. Rasionya tergantung mesin Anda (harapkan antara 2 dan 15 kali), tetapi arahnya tidak pernah berubah: logika yang sama sebagai satu operasi kolom mengalahkan loop baris demi baris.

:::ask Sebuah job melakukan `for` loop Python atas 10 juta baris untuk menambah 1 pada tiap harga. Kebiasaan mana yang lebih baik?
@options
pertahankan loop dan jalankan di mesin lebih besar
* tulis satu ekspresi seluruh kolom
ubah harga ke teks agar penambahan lebih mudah
@why
Operasi seluruh kolom menjalankan loop di dalam kode terkompilasi atas memori yang berurutan, sering puluhan kali lebih cepat daripada loop Python yang membayar overhead interpreter per nilai.
:::

## @part Alat dan tata letak

## @lesson DuckDB: mesin analitik SQL langsung di dalam proses aplikasi
**DuckDB** adalah basis data analitik OLAP yang berjalan **langsung di dalam proses Python Anda** (in-process), mirip seperti SQLite namun dirancang khusus untuk pemindaian data masif dan agregasi analitik (kolumnar, tervektorisasi, paralel). Anda tidak memerlukan server database terpisah, cukup pasang library dan langsung query file di disk:

:::talk Database tanpa server
@teacher Seorang pembelajar ingin menjalankan SQL pada file Parquet 2 GB di laptopnya. Seorang rekan berkata: "pakai saja DuckDB". Ia bertanya apakah ia harus memasang server database dulu dan memuat file ke dalamnya.
@ask Apa jawabannya?
@choice Ya: pasang server, buat tabel, dan muat file lebih dulu | Begitulah cara kerja database klasik, tetapi DuckDB berbeda. Coba lagi.
@choice * Tidak: DuckDB berjalan di dalam proses Python-nya dan bisa mengquery file langsung, tanpa server dan tanpa langkah memuat | Betul. `duckdb.sql("SELECT ... FROM 'orders.parquet'")` hanya membaca kolom dan row group yang dibutuhkan. Karena itu ia cocok untuk file, notebook, dan tes.
@choice Tidak, tetapi hanya untuk file di bawah 100 MB | Tidak ada batas semacam itu: DuckDB bisa menumpahkan ke disk untuk data yang lebih besar dari memori. Coba lagi.
@teacher Database tertanam adalah pustaka, bukan layanan: mesinnya hidup di dalam program Anda.
:::

```python
import duckdb

duckdb.sql("SELECT device, count(*) AS n FROM 'ev.parquet' GROUP BY device ORDER BY device").show()

# Membaca banyak file sekaligus dengan pola glob; folder gaya Hive (month=2026-01/) otomatis menjadi kolom
duckdb.sql("SELECT * FROM read_parquet('lake/*/*.parquet', hive_partitioning = true) LIMIT 5")

# Membaca file CSV langsung dengan inferensi tipe data otomatis
duckdb.sql("SELECT * FROM read_csv('orders.csv')")
```

Hasil query dapat dipindahkan ke berbagai format tanpa overhead konversi teks: `rel.df()` menghasilkan pandas DataFrame, `rel.pl()` menghasilkan Polars DataFrame, dan `rel.arrow()` menghasilkan tabel Apache Arrow. Menulis data ke disk dilakukan menggunakan perintah SQL `COPY`, dengan opsi partisi otomatis ke dalam struktur folder:

```python
con = duckdb.connect()
con.sql("""COPY (SELECT * FROM read_csv('events.csv'))
           TO 'lake' (FORMAT PARQUET, COMPRESSION zstd, PARTITION_BY (event_type))""")
```

Perintah di atas akan menulis folder terstruktur seperti `lake/event_type=purchase/data_0.parquet`. (Catatan penting: target path pada `COPY ... TO` adalah bagian dari teks SQL; parameter tersebut tidak bisa menggunakan placeholder parameter `?`). Untuk menyimpan tabel secara persisten, gunakan `duckdb.connect("warehouse.duckdb")`; namun untuk analisa sementara di pipeline, query langsung terhadap file Parquet sudah lebih dari cukup. DuckDB juga dapat membaca data langsung dari Amazon S3 atau URL HTTP (melalui ekstensi `httpfs`), di mana DuckDB hanya mengunduh footer dan chunk kolom yang dibutuhkan melalui HTTP range request tanpa mengunduh seluruh file bergiga-gigabyte.

**Membaca rencana eksekusi (Execution Plan).** Perintah `EXPLAIN` memperlihatkan strategi eksekusi mesin. Untuk query `SELECT device, sum(amount) FROM read_parquet('ev.parquet') WHERE event_type = 'purchase' GROUP BY device`, node pembaca menampilkan:

```text
READ_PARQUET
  Projections: device, amount
  Filters: event_type='purchase'
```

Perhatikan bahwa **proyeksi kolom** (hanya dua kolom yang dibaca) dan **filter** dieksekusi langsung di dalam node pembacaan file: inilah bukti nyata projection pushdown dan predicate pushdown. Jika filter muncul di node terpisah di *atas* node pembacaan, itu menandakan data dibaca seluruhnya terlebih dahulu baru kemudian disaring. Gunakan `EXPLAIN ANALYZE` untuk melihat metrik durasi waktu nyata per node.

**Mengolah data yang lebih besar dari kapasitas RAM (Out-of-Core Processing).** DuckDB secara otomatis menumpahkan data sementara ke disk (spill to disk) saat kebutuhan memori query melebihi batas yang ditentukan: `SET memory_limit = '2GB'; SET temp_directory = '/tmp/duck'`. Pada pengujian, pengurutan 5.000.000 baris di bawah batas memori 200 MB selesai dalam 0,3 detik dengan puncak konsumsi RAM hanya 194 MB tanpa dihentikan paksa oleh OS akibat kehabisan memori (Modul 1.1). Konfigurasi berguna lainnya: `SET threads = 4` untuk membatasi pemakaian core CPU di lingkungan container bersama.

**File di object storage.** Di platform sungguhan, file Parquet ini tinggal di object storage seperti Amazon S3, bukan di laptop, dan setiap file yang dibuka DuckDB adalah satu request jaringan yang memakan waktu dan, di S3, uang. Anda bisa melihatnya tanpa akun AWS: **moto** adalah program open-source yang menjawab seperti S3 di komputer Anda sendiri (Modul 3.4 memakainya untuk Terraform). Jalankan di terminalnya sendiri dan biarkan tetap berjalan, lalu arahkan DuckDB ke sana:

```bash
python -m pip install "moto[server]"
moto_server -p 5055          # setiap request dicetak di sini, satu baris per request
```

```python
import boto3, duckdb
boto3.client("s3", endpoint_url="http://127.0.0.1:5055", aws_access_key_id="test", aws_secret_access_key="test",
             region_name="ap-southeast-3").create_bucket(Bucket="kopiku-raw", CreateBucketConfiguration={"LocationConstraint": "ap-southeast-3"})
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs")
con.execute("""CREATE SECRET local_s3 (TYPE s3, KEY_ID 'test', SECRET 'test', REGION 'ap-southeast-3',
               ENDPOINT '127.0.0.1:5055', URL_STYLE 'path', USE_SSL false)""")
```

> 🛠 **Coba sendiri (20 menit, Python, perlu S3 tiruan di atas).** Tulis 200.000 pesanan ke `s3://kopiku-raw/orders` dengan `COPY ... TO`, dipartisi per `order_date`, dari `SELECT range AS order_id, 10000 + (range * 37) % 500000 AS total_idr, DATE '2026-11-01' + CAST(range % 30 AS INTEGER) AS order_date FROM range(200000)`. Lalu, setiap kali dengan koneksi **baru** dan secret yang sama (DuckDB menyimpan cache file yang sudah dibacanya), hitung baris untuk `order_date = DATE '2026-11-21'`, untuk semua hari, dan untuk `total_idr > 400000`, dengan membaca memakai `hive_partitioning = true`. Hitung baris request yang dicetak moto untuk setiap query.
>
> **Seharusnya Anda melihat:** `6666` baris dari **3** request untuk satu hari: satu listing folder, file pertama (untuk mengetahui nama kolom), dan file hari itu. Semua hari menghasilkan `200000` baris dari **31** request: listing ditambah ke-30 file. Filter `total_idr` menghasilkan `41892` baris tetapi juga butuh **31**: hanya kolom partisi yang membuat DuckDB bisa melewati file tanpa membukanya. Di S3 setiap request ditagih dan menambah jeda, jadi kolom partisi sebuah tabel sebaiknya kolom yang paling sering difilter query-nya. Diukur dengan DuckDB 2.0.1 dan moto 5.2.5.

:::ask File Parquet punya 50 kolom dan query Anda memakai 3 di antaranya. Apa yang dibaca engine?
@options
seluruh file, semua 50 kolom
hanya 3 baris pertama tabel
* terutama ketiga kolom itu, ditambah footer
@why
Penyimpanan kolumnar menyimpan nilai setiap kolom bersama-sama, jadi membaca 3 dari 50 kolom membaca sekitar 3/50 data. Karena itu query analitik cepat di Parquet dan `SELECT *` adalah kebiasaan buruk pada tabel lebar.
:::

> 💡 **Jeda Praktik: Analisis SQL Kolumnar dengan DuckDB**
> 1. Di Text Editor pada `labs/mod-2-1/analytics.py`, buka fungsi `revenue_by_month_roast_duckdb(data_dir)`.
> 2. Tulis query SQL DuckDB yang membaca `order_items.parquet`, `orders.parquet`, dan `products.parquet` menggunakan fungsi `read_parquet(...)`. Gabungkan ketiga tabel (JOIN), kelompokkan berdasarkan format bulan `strftime(o.order_ts, '%Y-%m')` dan `p.roast_level`, lalu hitung omset `SUM(i.qty * i.unit_price_idr)` dengan tipe `BIGINT` (integer). Urutkan hasil berdasarkan bulan dan tingkat sangrai (`ORDER BY 1, 2`).
> 3. Jalankan pengujian DuckDB di terminal Anda:
> `pytest labs/mod-2-1/test_lab.py -v -k "test_duckdb_result or test_revenue_is_an_int"`
> 4. Pastikan pengujian lulus (`2 passed`). Verifikasi bahwa omset yang dihasilkan bertipe integer tanpa kesalahan presisi desimal.

## @lesson Polars dan panduan memilih alat analitik
**Polars** adalah library dataframe modern berkecepatan tinggi yang ditulis dalam bahasa Rust, dibangun di atas fondasi Apache Arrow, dengan antarmuka **ekspresi deklaratif**:

```python
import polars as pl

q = (
    pl.scan_parquet("ev.parquet")                  # Evaluasi lambat (lazy): belum ada data yang dibaca
      .filter(pl.col("event_type") == "purchase")
      .group_by("device")
      .agg(pl.len().alias("n"), pl.col("amount").sum().alias("total"))
)
print(q.explain())      # Menampilkan rencana eksekusi teroptimasi
df = q.collect()        # Eksekusi komputasi nyata
```

:::talk Belum ada yang berjalan
@teacher Di Polars Anda menulis: `q = pl.scan_parquet("events.parquet").filter(pl.col("status") == "delivered").select("payment_method", "total_idr")`. File itu punya 50 kolom dan 100 juta baris. Barisnya selesai seketika.
@ask Apakah Polars sudah membaca datanya?
@choice Ya, tetapi sangat cepat | Pemindaian 100 juta baris tidak seketika. Coba lagi.
@choice * Belum: `scan_parquet` bersifat lazy, jadi `q` hanya sebuah rencana, dan pembacaan terjadi pada `.collect()` | Betul. Karena belum ada yang berjalan, optimiser masih bisa mendorong filter dan dua kolom itu ke dalam scan, sehingga sebagian besar file tidak pernah dibaca.
@choice Ia baru membaca beberapa baris pertama untuk menebak tipe | Ia membaca footer file untuk skema, bukan datanya. Coba lagi.
@teacher Lazy berarti "gambarkan dulu, jalankan sekali": alat itu melihat seluruh pertanyaan sebelum menyentuh data.
:::

Konsep kunci di balik performa Polars adalah **lazy evaluation**. Pemanggilan `scan_parquet` beserta rantai transformasi di bawahnya hanya merumuskan sebuah *rencana (plan)* komputasi; pemanggilan `.collect()` memerintahkan query optimizer untuk menganalisis dan mengeksekusi rencana tersebut secara optimal. Optimizer menerapkan pushdown yang sama, dan `.explain()` membuktikannya:

```text
Parquet SCAN [ev.parquet]
PROJECT 3/7 COLUMNS
SELECTION: col("event_type") == "purchase"
```

Hanya tiga dari tujuh kolom yang dimuat, dan filter dieksekusi di dalam pembacaan file. (`pl.read_parquet` adalah versi *eager*: memuat seluruh data ke memori terlebih dahulu dan kehilangan optimasi pushdown; selalu prioritaskan `scan_*` untuk memproses file). Polars secara default memanfaatkan seluruh core CPU dan memiliki fitur streaming untuk data yang melebihi kapasitas RAM.

**Bagaimana dengan pandas?** pandas sangat populer dan sangat bagus untuk dataset kecil, eksplorasi awal, serta ekosistem visualisasi/machine learning. Namun kelemahannya muncul saat skala data membesar: pandas memuat tabel utuh ke RAM, merepresentasikan teks string sebagai Python object (yang memboroskan memori), dan sebagian besar operasinya berjalan di single thread. Pengujian terukur pada tabel benchmark ilustratif 5 juta baris dengan 7 kolom yang sama dari Pelajaran 1 (terpisah dari tabel uji 1 juta baris yang lebih kecil di `test_lab.py`), masing-masing dijalankan pada proses Python bersih (pada pengujian pandas, puncak konsumsi memori mencakup baseline sekitar 100 hingga 150 MB untuk mengimpor Python bersama `pandas` dan `pyarrow`; `duckdb` mandiri memiliki jejak impor yang lebih kecil):

| Percobaan: Agregasi `amount` berdasarkan `event_type` | Durasi Waktu | Puncak Konsumsi RAM |
|---|---|---|
| pandas: `read_csv`, lalu groupby | 3.5 detik | 662 MB |
| pandas: `read_parquet` (semua kolom), lalu groupby | 0.8 detik | 1.081 MB |
| pandas: `read_parquet(columns=[2 kolom])` | 0.6 detik | 576 MB |
| DuckDB langsung membaca file CSV | 0.5 detik | 332 MB |
| DuckDB langsung membaca file Parquet | **0.1 detik** | **80 MB** |
| Polars lazy membaca file Parquet | 0.2 detik | 160 MB |

Perhatikan baris kedua: membaca Parquet ke pandas mengonsumsi memori *lebih banyak* daripada membaca CSV, karena pandas harus mewujudkan seluruh tujuh kolom sebagai Python object di RAM. Membatasi kolom yang dibaca (`columns=[...]`) memangkas konsumsi RAM hingga separuhnya. Mesin modern seperti DuckDB dan Polars yang mendorong filter dan proyeksi langsung ke pembacaan file sama sekali tidak pernah menyusun tabel utuh di RAM. (Angka pastinya bergantung pada mesin dan versi library Anda; ukur sendiri seperti pada Langkah 6 lab. Rasio perbandingannyalah pelajarannya.)

Panduan praktis memilih alat:

| Karakteristik Beban Kerja | Alat Rekomendasi |
|---|---|
| Puluhan s.d. ratusan ribu baris, eksplorasi interaktif, plotting | pandas |
| Analisa berbasis SQL terhadap file; operasi join masif dan agregasi; "SELECT di folder Parquet" | **DuckDB** |
| Pipeline data Python dengan transformasi bertahap; arsitektur kode modular yang reusable | **Polars** |
| Data jauh melebihi kapasitas disk satu server; banyak proses penulisan bersamaan | Mesin terdistribusi (Apache Spark, Modul 3.1) atau cloud data warehouse |

DuckDB dan Polars saling terhubung erat melalui format memori Apache Arrow, sehingga Anda dapat mengombinasikannya: gunakan SQL DuckDB untuk join dan agregasi berat, lalu lanjutkan dengan Polars untuk manipulasi logika Python. Fakta di dunia kerja: **satu laptop/server tunggal mampu mengolah data ratusan gigabyte** jika format file dan tata letaknya dirancang dengan benar, jadi beralihlah ke cluster terdistribusi hanya ketika pengukuran data membuktikan Anda benar-benar membutuhkannya.

> 💡 **Jeda Praktik: Analisis Kolumnar Lazy dengan Polars**
> 1. Di Text Editor pada `labs/mod-2-1/analytics.py`, buka fungsi `revenue_by_month_roast_polars(data_dir)`.
> 2. Implementasikan pipeline analitik yang sama secara **lazy** menggunakan `pl.scan_parquet(...)`. Rangkai `.join(orders, on="order_id").join(products, on="product_id")` untuk menggabungkan tabel, tambahkan kolom turunan dengan `.with_columns(month=pl.col("order_ts").dt.strftime("%Y-%m"), line=pl.col("qty") * pl.col("unit_price_idr"))`, kelompokkan dengan `.group_by("month", "roast_level")`, agregasikan dengan `.agg(pl.col("line").sum().alias("revenue"))`, urutkan dengan `.sort("month", "roast_level")`, jalankan dengan `.collect()`, lalu ubah baris hasilnya menjadi tuple Python biasa dengan `.iter_rows()`.
> 3. Jalankan pengujian engine di terminal:
> `pytest labs/mod-2-1/test_lab.py -v -k TestEngines`
> 4. Pastikan seluruh 3 pengujian engine lulus (`3 passed`). Amati bagaimana dua mesin berbeda (DuckDB dan Polars) menghasilkan output yang 100% identik dengan hasil independen SQLite.

:::ask Di Polars Anda menulis `scan_parquet(...).filter(...).select(...)` dan sepertinya tidak terjadi apa-apa. Mengapa?
@options
filenya kosong, jadi tidak ada yang dijalankan
ia menunggu thread latar belakang memuat data
* ia hanya menyusun rencana; collect() pemicunya
@why
Itulah lazy evaluation: rantai itu mendeskripsikan kerja, dan `.collect()` memicunya. Karena optimizer melihat seluruh rencana, ia bisa mendorong filter ke dalam scan dan hanya membaca kolom yang dipilih.
:::

## @lesson Tata letak partisi, tipe data, dan jebakan umum
:::talk Partisi per pelanggan?
@teacher Seorang analis beralasan: "query sering memfilter menurut pelanggan, jadi saya akan mempartisi dataset menurut hari dan menurut `customer_id`". Ada 100.000 pelanggan dan data 30 hari.
@ask Menjadi apa tata letak foldernya?
@choice * Hingga tiga juta file kecil, sehingga mendaftar dan membukanya lambat | Betul: 30 hari kali 100.000 pelanggan. Setiap file kecil, setiap pembukaan adalah satu permintaan, dan beban tambahannya menelan manfaat pemangkasan.
@choice Segelintir file besar, karena Parquet menggabungkan partisi kecil dengan sendirinya | Tidak ada yang menggabungkannya untuk Anda: satu folder per nilai berarti satu file kecil per nilai. Coba lagi.
@choice Hanya 30 folder, karena partisi hanyalah satu hari | Tidak bila Anda juga mempartisi menurut `customer_id`: setiap hari terpecah lagi menjadi satu folder per pelanggan. Coba lagi.
@teacher Partisi menurut kolom dengan sedikit nilai berbeda yang sering difilter query, seperti hari. Untuk sisanya, urutkan data di dalam file dan biarkan statistik min/maks melewati yang tidak perlu.
:::

**Partisi Direktori (Partitioning).** Membagi data ke dalam sub-folder berdasarkan nilai kolom tertentu (`month=2026-01/`) memungkinkan mesin query melewati seluruh folder yang tidak relevan saat ada filter pada kolom tersebut (partition pruning). Panduan praktis: partisi data hanya pada **kolom ber-kardinalitas rendah yang rutin difilter** (seperti tanggal atau wilayah), jangan pernah partisi pada ID transaksi; hindari pembagian partisi yang melahirkan ribuan file mini (100 pelanggan × 365 hari = puluhan ribu file kecil); dan prioritaskan **pengurutan data di dalam file** untuk kolom ber-kardinalitas tinggi karena statistik row group Parquet dapat menanganinya dengan sangat efisien. Partisi berlebihan (*over-partitioning*) adalah kesalahan paling umum data engineer pemula.

**Disiplin Tipe Data:**

- **Uang dan Nilai Moneter.** Jangan pernah menyimpan nilai mata uang sebagai floating-point IEEE 754 (`0.1 + 0.2 != 0.3`). Gunakan integer dalam satuan terkecil (rupiah atau sen, seperti di KopiKu) atau tipe data `DECIMAL` berpresisi tetap. Seluruh perhitungan omset pada lab ini wajib menghasilkan integer karena alasan tersebut.
- **Timestamp dan Zona Waktu.** Tentukan secara tegas apakah kolom disimpan dalam waktu lokal atau UTC; tipe data `TIMESTAMP` tanpa zona waktu bersifat ambigu. Praktik terbaik: selalu simpan data dalam standar UTC di lapisan penyimpanan.
- **Identitas Berupa Angka.** Inferensi otomatis pada file CSV sering membaca nomor telepon atau kode pos `00123` sebagai angka numerik 123, yang menghilangkan nol di depan. Nyatakan kolom tersebut secara eksplisit sebagai string/teks. Inferensi mengambil sampel dari awal file, sehingga kolom yang berupa angka pada 10.000 baris pertama lalu berisi teks di bagian bawah akan memicu kegagalan; tetapkan tipe data secara eksplisit atau perbesar sampel baris.
- **Pergeseran Skema (Schema Drift).** Kolom yang bertipe `int` pada file bulan Januari namun berubah menjadi `string` pada bulan Maret akan menggagalkan query pembacaan banyak file. Lakukan validasi skema ketat pada gerbang ingestion (Modul 2.5).

Kebiasaan rekayasa yang baik: hindari `SELECT *` pada data kolumnar karena mematikan column pruning; lakukan filter sedini mungkin pada kolom yang terurut; tulis file Parquet dengan kompresi zstd dan ukuran row group eksplisit; prioritaskan sedikit file berukuran besar daripada ribuan file mini; pisahkan data mentah dari salinan hasil konversi (lapisan raw dari Modul 0.2); dan selalu lakukan verifikasi dengan perintah `EXPLAIN` serta pengujian benchmark nyata sebelum mempercayai klaim performa apa pun.

> 💡 **Jeda Praktik: Verifikasi Seluruh Rangkaian Pengujian Kolumnar**
> 1. Setelah semua empat fungsi dalam `labs/mod-2-1/analytics.py` selesai diimplementasikan, jalankan seluruh rangkaian tes dari terminal:
> `pytest labs/mod-2-1 -v`
> 2. Pastikan ke-10 pengujian lulus sempurna tanpa hambatan (`10 passed`).
> 3. Hasilkan kode bukti penyelesaian Anda dengan menjalankan:
> `python3 scripts/prove.py mod-2-1`
> 4. Perhatikan bahwa `pytest` hanya memverifikasi kebenaran hasil, untuk mengukur dan membandingkan waktu eksekusi serta puncak konsumsi memori antara pandas, DuckDB, dan Polars, lakukan benchmark pada Langkah 6 di bagian lab di bawah.

:::ask Tabel Anda berisi data harian 5 tahun, dan query hampir selalu memfilter satu tanggal. Kolom partisi mana yang masuk akal?
@options
* tanggal atau bulan, yang dipakai untuk filter
id pesanan, sehingga tiap baris punya folder
nama pelanggan, karena paling deskriptif
@why
Partisi pada kolom yang Anda filter dan yang jumlah nilainya wajar. Id akan membuat jutaan folder dan file kecil, yaitu masalah file kecil lagi.
:::

:::ask Sebuah pipeline menyimpan uang sebagai floating point. Total pendapatan kadang menjadi 0.30000000000000004, bukan 0.3. Apa perbaikannya?
@options
bulatkan setiap nilai ke 12 desimal saat dibaca
* bilangan bulat rupiah atau sen, atau DECIMAL
ganti ke floating point 128-bit yang lebih besar
@why
Float biner tidak bisa menyatakan kebanyakan pecahan desimal dengan tepat, sehingga galat menyelinap. Bilangan bulat dalam satuan mata uang terkecil, atau DECIMAL, bersifat eksak.
:::

## @lesson Matriks serialisasi & kompresi (Lampiran A) serta arsitektur internal NoSQL (LSM-Tree vs. B-Tree) {optional}

*(Sintesis opsional: referensi ini menjembatani format file yang Anda pakai di sini dengan indeks `B+Tree` database relasional dari Modul 0.3/1.3 dan mesin penyimpanan `LSM-Tree` berkecepatan tulis tinggi di balik database wide-column Modul 1.7.)*

Dua pertanyaan arsitektur penyimpanan selalu muncul dalam tinjauan produksi (Bab 6 & Lampiran A *Fundamentals of Data Engineering* karya Reis & Housley) maupun wawancara senior data engineer: **(1) Format file dan codec kompresi apa yang paling tepat untuk tiap tahap pipeline?** dan **(2) Bagaimana mesin penyimpanan NoSQL (`LSM-Tree`) berbeda dari database relasional (`B+Tree`) saat kita menarik atau menyajikan data?**

**1. Matriks Trade-Off Serialisasi & Kompresi (Lampiran A Reis & Housley).**

| Format | Tata Letak | Evolusi Skema | Kompresi & Splittability | Kasus Penggunaan Produksi Terbaik |
|---|---|---|---|---|
| **Apache Parquet** | **Kolumnar** (Row Group → Column Chunk → Page + statistik Footer) | Baik (tambah/hapus kolom; berbasis ID di Iceberg/Delta) | Tinggi (`4×–10×` via Dictionary + RLE + Bit-packing + **Zstd / Snappy**). Dapat dibagi (splittable) per row group. | **Standar utama penyimpanan lakehouse & warehouse analitik** (`S3/GCS`, Spark, DuckDB, Polars, BigQuery, Snowflake). |
| **Apache ORC** | **Kolumnar** (Stripe + Index/Data/Footer) | Baik | Kompresi sangat tinggi dengan **Zstd / Zlib**. Splittable per stripe. | Klaster analitik skala besar berbasis Hive / Trino / Presto. |
| **Apache Avro** | **Biner berbasis baris** (skema JSON di dalam header file) | **Terbaik di kelasnya** (resolusi skema reader/writer penuh di Schema Registry) | Penanda blok splittable; dipadukan dengan **Snappy / Deflate**. | **Payload event streaming Kafka**, log CDC, dan landing zone padat-tulis yang membaca satu baris utuh sekaligus. |
| **Protocol Buffers (Protobuf)** | **Biner berbasis baris** (tag nomor field `1, 2, 3`) | **Terbaik di kelasnya** (aman backward/forward lewat ID tag nomor) | Ukuran paket jaringan sangat ringkas; memerlukan framing agar file dapat dibagi (splittable). | **Microservice gRPC, telemetri mobile, dan topik Kafka berkecepatan tinggi**. |
| **Apache Arrow (IPC / Feather)** | **Kolumnar di memori** (buffer byte zero-copy) | Spesifikasi tipe memori yang presisi | Framing **LZ4 / Zstd** opsional untuk transfer jaringan cepat. | **Pertukaran memori zero-copy** antara Python, Polars, DuckDB, Spark Pandas UDF, dan Flight RPC. |
| **CSV / JSONL** | **Teks berbasis baris** | Tidak ada (teks tanpa tipe, rawan schema drift diam-diam) | Hanya splittable jika tidak dikompresi atau memakai `bzip2`; **CSV Gzip TIDAK splittable**! | Pertukaran file manual atau pendaratan awal API pihak ketiga sebelum diubah ke Parquet Bronze. |

*Aturan Praktis Codec Kompresi:* Gunakan **Zstandard (`Zstd`)** untuk data lake Parquet hangat/dingin (rasio kompresi lebih hemat *sekaligus* dekompresi lebih cepat daripada Gzip) dan **Snappy** atau **LZ4** untuk buffer streaming/shuffle panas yang mengutamakan latensi CPU rendah. Jangan pernah menyimpan file CSV multi-gigabyte sebagai satu file `.csv.gz` di S3/GCS: karena **Gzip tidak dapat dibagi (non-splittable)**, klaster Spark atau DuckDB dengan 100 core terpaksa menyerahkan seluruh file itu ke **1 core CPU saja**!

**2. Arsitektur Internal `B+Tree` Relasional vs. `LSM-Tree` (Log-Structured Merge-Tree) NoSQL.** Saat membangun pipeline ingestion, Anda akan sering menarik data dari sistem NoSQL (**MongoDB** document store, **DynamoDB / Redis** key-value store, **Cassandra / Bigtable** wide-column store):

| Mesin Penyimpanan | Digunakan Oleh | Jalur Tulis (Write Path) | Jalur Baca (Read Path) | Dampak bagi Data Engineer (Ingestion & Serving) |
|---|---|---|---|---|
| **B+Tree** (Berorientasi halaman, update halaman di tempat + WAL) | PostgreSQL, MySQL, SQL Server, Oracle | Menulis ke **WAL** (*Write-Ahead Log*, log append-only untuk ketahanan data sebelum halaman data diubah), lalu memodifikasi halaman B-Tree berukuran tetap `8 KB / 16 KB` di tempat (memicu I/O disk acak saat penulisan padat). | **Pembacaan titik & rentang O(log N) yang sangat cepat** menelusuri pointer pohon berimbang. | Tarik data menggunakan **WAL Change Data Capture (Debezium)** alih-alih melakukan polling `SELECT *`, agar tidak berebut kunci halaman (page lock) dengan transaksi OLTP. |
| **LSM-Tree** (Append-only MemTable → SSTable immutable + Compaction) | Cassandra, RocksDB, Bigtable, HBase, ScyllaDB | Menulis ke WAL + **MemTable** terurut di RAM; menguras secara berurutan ke file **SSTable (Sorted String Table)** immutable di disk; proses latar **Compaction** menggabungkan SSTable. | Memeriksa MemTable + memeriksa SSTable dengan bantuan **Bloom Filter** (yang memberi tahu dalam O(1) apakah suatu kunci *pasti tidak ada* di sebuah SSTable). | **Throughput tulis super tinggi** untuk telemetri IoT dan online feature store. Tarik perubahan ke hilir melalui **DynamoDB Streams / MongoDB Change Streams** ke Parquet Bronze. |

> 🛠 **Coba sendiri (15 menit, Python dengan `pandas` dan `pyarrow`).** Baca `data/orders.csv` sebagai teks, simpan baris yang `total_idr`-nya hanya berisi angka dan jadikan `order_id`, `customer_id`, dan `total_idr` integer, lalu ulang barisnya 30 kali. Tulis tabel yang sama dengan enam cara: CSV, CSV ber-gzip, dan Parquet dengan `compression=` `"none"`, `"snappy"`, `"gzip"`, dan `"zstd"` (`pyarrow.parquet.write_table`). Bandingkan ukuran filenya, dan tebak urutannya sebelum melihat.
>
> **Seharusnya Anda melihat:** `107400` baris. CSV `5,650,952` byte, CSV ber-gzip `1,419,659`, Parquet tanpa kompresi `770,696`, Snappy `402,243`, gzip `168,852`, dan Zstd `163,042`. Encoding bawaan Parquet (dictionary dan run-length) sudah membuatnya tujuh kali lebih kecil daripada CSV sebelum codec apa pun berjalan, dan di sini Zstd sedikit mengungguli gzip sambil mendekompresi lebih cepat. Diukur dengan pyarrow 26.0.1 pada data bawaan kursus.

## @part Di bawah abstraksi

## @lesson Block, file, dan object storage, konsistensi, dan cache
Bab 6 *Fundamentals of Data Engineering* dimulai di bawah warehouse dan lake, dengan "bahan mentah" yang membentuk setiap sistem penyimpanan. Tiga jenis penyimpanan muncul di setiap diskusi arsitektur, dan mencampuradukkannya membuat pipeline lambat atau rusak.

| | **Block storage** | **File storage** | **Object storage** |
|---|---|---|---|
| Yang Anda dapat | Disk mentah berisi blok berukuran tetap, diformat oleh sistem operasi satu mesin | Pohon folder dan file bersama lewat jaringan (NFS, SMB) | Bucket datar berisi objek utuh, masing-masing ditemukan lewat key-nya, lewat HTTP |
| Contoh di cloud | AWS EBS, Azure Managed Disks, Google Persistent Disk | AWS EFS, Azure Files, Google Filestore | S3, Azure Blob dan ADLS Gen2, Google Cloud Storage |
| Mengubah sebagian | Bisa: tulis ulang blok mana pun | Bisa: tambahkan ke atau edit file | Tidak: ganti seluruh objek |
| Rename folder | Satu operasi | Satu operasi | Tidak ada folder sungguhan: salin dan hapus setiap objek (ADLS Gen2 dengan hierarchical namespace adalah pengecualiannya) |
| Pemakaian umum | File data database, boot disk VM | Folder home bersama, alat yang butuh file system POSIX (antarmuka file-dan-folder standar Unix/Linux) | Data lake, tabel lakehouse, backup, apa pun yang besar |
| Biaya dan skala | Termahal per GB, umumnya satu mesin pada satu waktu | Di tengah | Termurah per GB, praktis tak terbatas |

Dua nama lama yang akan Anda temui di pekerjaan **brownfield** (proyek yang memodernisasi sistem lama yang sudah berjalan, bukan membangun dari nol): **RAID** menggabungkan beberapa disk menjadi satu, untuk kecepatan (striping), untuk keamanan (mirroring atau parity), atau keduanya; **SAN** (storage area network) melayani block storage ke banyak server lewat jaringan khusus. Block storage di cloud adalah gagasan yang sama sebagai layanan terkelola.

**Mengapa object storage membentuk lakehouse.** Karena objek tidak bisa diedit atau di-rename dengan murah, kebiasaan lama Hadoop menulis hasil ke folder sementara lalu me-rename-nya di akhir berubah menjadi ribuan request copy di S3. Format tabel seperti Delta Lake dan Iceberg (Modul 2.2) tidak pernah me-rename file data: mereka menulis file baru lalu meng-commit satu perubahan metadata kecil, itulah sebabnya mereka bekerja di object storage.

**Konsistensi: kapan pembaca melihat sebuah penulisan?** Sistem **strongly consistent** ketika setiap pembacaan setelah penulisan yang berhasil melihat penulisan itu. Ia **eventually consistent** ketika pembaca bisa melihat data lama untuk sementara, sampai semua salinan menyusul. Sistem terdistribusi memilih di antara keduanya karena menunggu semua salinan memakan latensi dan ketersediaan. Contoh: S3 memberi konsistensi read-after-write yang kuat untuk semua objek sejak Desember 2020 (sebelumnya, list tepat setelah penulisan bisa melewatkan objek baru); pembacaan DynamoDB eventually consistent kecuali Anda meminta strongly consistent read; Cassandra membiarkan setiap query memilih berapa replika yang harus menjawab. Ketika pipeline "kadang-kadang" melewatkan data baru, tanyakan jenis konsistensi apa yang diberikan penyimpanannya.

**Cache dan CDN.** **Cache** menyimpan salinan data di penyimpanan yang lebih cepat (memori alih-alih disk, server dekat alih-alih yang jauh), menukar kesegaran dengan kecepatan: Redis di Modul 1.7 dan cache hasil query di cloud warehouse adalah cache. **CDN** (content delivery network, Lampiran B buku itu) menyimpan cache file di server yang dekat dengan pengguna, begitulah gambar dashboard atau unduhan dataset publik tetap cepat di seluruh dunia. Setiap cache butuh aturan kapan salinannya terlalu tua.

> 🛠 **Coba sendiri (15 menit, Python dengan `boto3` dan `moto[s3]`).** Di dalam `with mock_aws():` (S3 palsu milik moto yang berjalan di proses, tanpa akun), buat bucket dan simpan 1.500 objek kecil di bawah `raw/2026-01/`. Hitung request API dengan `s3.meta.events.register("before-call.s3", counter)`, lalu "rename folder"-nya menjadi `archive/2026-01/`: list key-nya (dengan paginator), salin setiap objek ke key barunya, dan hapus yang lama dengan `delete_objects` (paling banyak 1.000 key per panggilan). Lakukan hal yang sama dengan 1.500 file di disk Anda sendiri dan `os.rename`.
>
> **Seharusnya Anda melihat:** `1504` request untuk object store (`2` halaman list, `1500` copy, `2` batch delete), dengan `0` objek tersisa di bawah `raw/` dan `1500` di bawah `archive/`; file system cukup satu `os.rename`. Di S3 sungguhan setiap request itu ditagih dan butuh beberapa milidetik lewat jaringan, itulah sebabnya tata letak lake dirancang agar tidak ada yang pernah di-rename. Diukur dengan moto 5.2.5 dan boto3 1.44.9.

:::ask Mengapa object storage mendorong lakehouse ke format tabel seperti Iceberg dan Delta?
@options
object storage terlalu lambat untuk tabel apa pun
object storage hanya menerima file CSV
* rename menyalin data, jadi commit butuh log
@why
Menulis ke folder sementara lalu mengganti namanya bekerja di file system, tetapi di object storage rename menyalin setiap objek. Format tabel menyelesaikan perubahan dengan menulis satu file metadata kecil.
:::

## @lab Lab: konversi CSV ke Parquet, dua mesin analitik, dan implementasi pushdown
Konversikan tabel operasional KopiKu ke dalam format Parquet terkompresi, jawab pertanyaan bisnis yang sama menggunakan SQL di DuckDB dan lazy dataframe di Polars (buktikan kedua mesin menghasilkan angka omset yang identik dengan verifikasi independen SQLite), serta implementasikan logika predicate pushdown sendiri langsung dari metadata footer Parquet. Terakhir, lakukan pengujian benchmark mandiri pada data berskala lebih besar untuk membandingkan performa ketiga alat.

### @steps
> **Sudah menyelesaikan Jeda Praktik 1–5?** File `labs/mod-2-1/analytics.py` Anda sudah selesai diimplementasikan dan lulus seluruh 10 pengujian! Anda dapat langsung melompat ke Langkah 6 (benchmark pandas vs. DuckDB vs. Polars), Langkah 7, dan **@verify** (`python3 scripts/prove.py mod-2-1`) di bawah.

1. Pasang dependensi yang diperlukan dan jalankan pengujian awal untuk melihat spesifikasi yang diharapkan:

```bash
python -m pip install -r labs/mod-2-1/requirements.txt
pytest labs/mod-2-1 -v          # Seluruh pengujian akan gagal pada awalnya
```

2. Buka file `labs/mod-2-1/analytics.py`. Implementasikan fungsi `to_parquet` menggunakan perintah DuckDB `COPY (SELECT * FROM read_csv(...)) TO ... (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE ...)`. Unit test akan memvalidasi jumlah baris, kompresi zstd, tipe data hasil inferensi, serta memastikan konfigurasi `row_group_size` menghasilkan beberapa row group yang teratur.
3. Implementasikan fungsi `revenue_by_month_roast_duckdb`: join data baris item pesanan, pesanan, dan produk (dari tiga file Parquet terpisah), lalu kembalikan tuple `(month, roast_level, revenue)` terurut berdasarkan bulan dan tingkat sangrai. Pastikan nilai omset bertipe integer.
4. Implementasikan logika analitik yang sama persis di Polars secara **lazy** (`scan_parquet` ... `collect()`). Kesesuaian output membuktikan dua mesin analitik modern berbeda menghasilkan angka yang konsisten dan identik dengan hasil kalkulasi SQLite independen.
5. Implementasikan fungsi `row_groups_to_read(path, column, lo, hi)` hanya dengan membaca metadata `pyarrow.parquet.ParquetFile(path).metadata` dan atribut `statistics` tiap row group. Sebuah row group boleh dilewati hanya jika nilai max berada di bawah `lo` atau nilai min berada di atas `hi`. Jalankan pengujian pushdown: pada data terurut waktu, fungsi Anda seharusnya hanya membaca 1 s.d. 3 row group; sedangkan pada data acak hampir seluruh row group harus dibaca.
6. Lakukan benchmark mandiri. Buat dataset sintetis berukuran lebih besar dan bandingkan durasi serta puncak konsumsi RAM antara pandas, DuckDB, dan Polars untuk kalkulasi agregasi yang sama (gunakan utilitas `/usr/bin/time -v python script.py` di Linux, atau `resource.getrusage` di dalam proses yang *baru*):

```python
import duckdb
duckdb.sql("""COPY (SELECT i AS event_id, 1767225600 + i // 100 AS event_ts, (hash(i) % 20000)::INT AS customer_id,
                    CASE i % 3 WHEN 0 THEN 'purchase' WHEN 1 THEN 'view' ELSE 'click' END AS event_type,
                    CASE i % 2 WHEN 0 THEN 'mobile' ELSE 'desktop' END AS device,
                    round((hash(i * 17) % 100000) / 100.0, 2) AS amount
             FROM range(5000000) t(i) ORDER BY event_ts)
             TO 'events.parquet' (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE 100000)""")
```

7. Buat file pembanding dengan urutan data acak `ORDER BY hash(event_id)` dan amati perbedaan ukuran file di disk serta jumlah row group yang tersentuh saat difilter pada rentang waktu satu jam.

### @files
- labs/mod-2-1/analytics.py :: File kerja utama Anda: empat fungsi inti yang harus diimplementasikan :: starter
- labs/mod-2-1/test_lab.py :: Rangkaian 10 pengujian otomatis validasi komparatif :: test
- labs/mod-2-1/requirements.txt :: Dependensi library: duckdb, polars, pyarrow, pandas, pytest :: config
- labs/mod-2-1/reference/analytics.py :: Solusi referensi lengkap (coba kerjakan sendiri dulu!) :: reference

### @deliverables
- Seluruh 10 unit test di `test_lab.py` berhasil lolos (PASS)
- Anda dapat membuktikan melalui `EXPLAIN` (DuckDB) dan `.explain()` (Polars) bahwa kedua mesin berhasil melakukan projection pushdown dan filter pushdown langsung di node pemindaian file
- Anda mencatat tabel perbandingan hasil benchmark mandiri (durasi waktu dan konsumsi RAM) untuk ketiga alat analitik beserta ringkasan penyebab perbedaannya

### @verify
```bash
pytest labs/mod-2-1 -v
python3 scripts/prove.py mod-2-1
```

Jalankan pengujian terhadap solusi referensi pembanding: `LAB_DIR=reference pytest labs/mod-2-1 -v`.

## @chaos Cluster server mahal yang sebenarnya tidak pernah dibutuhkan
### @scenario
Sebuah pipeline batch harian memproses dan mengagregasi log event mentah berformat CSV sebesar 40 GB. Pipeline tersebut dijalankan di atas cluster cloud 16 node, membutuhkan waktu 55 menit per eksekusi, dan menelan biaya sewa server sekitar Rp 8 juta per bulan. Seorang engineer baru menyadari bahwa mayoritas waktu 55 menit tersebut dihabiskan untuk membaca dan mem-parsing teks CSV, dan dashboard pelaporan sebenarnya hanya menggunakan 5 dari total 38 kolom yang tersedia.

Rekan kerjanya bersikeras bahwa "data besar membutuhkan infrastruktur besar", dan menganggap format Parquet tidak akan banyak membantu karena "cluster 16 server sudah sangat kencang".

### @cause
Terjadi pemborosan berlipat ganda pada tiga lapisan berbeda. Pertama, format CSV adalah teks: setiap eksekusi membuang siklus CPU berharga untuk mem-parsing 40 GB karakter teks menjadi tipe data biner. Kedua, CSV berorientasi baris, sehingga seluruh 38 kolom terpaksa dibaca dari jaringan/disk padahal hanya 5 kolom yang dibutuhkan (hanya sekitar 13% data yang berguna). Ketiga, tanpa pengurutan data dan metadata statistik, tidak ada cara untuk melewati data yang tidak relevan, sehingga filter harian terpaksa memindai seluruh isi file. Cluster server bukanlah solusi atas inefisiensi ini; cluster hanya membuat rencana query yang boros selesai sedikit lebih cepat dengan membakar biaya server.

### @fix
1. Ubah format data satu kali pada saat ingestion pertama kali mendarat: simpan CSV mentah, lalu konversi menjadi file **Parquet terkompresi zstd** yang sudah memiliki tipe data presisi, berukuran jauh lebih kecil, dan terurut berdasarkan tanggal event.
2. Baca hanya 5 kolom yang digunakan (projection pushdown) dan terapkan filter tanggal agar row group yang tidak relevan dapat langsung dilewati (predicate pushdown).
3. Lakukan benchmark ulang terhadap query agregasi tersebut di satu laptop/mesin tunggal menggunakan DuckDB atau Polars. Beberapa gigabyte Parquet terkompresi umumnya dapat diproses dalam hitungan detik hingga menit di satu mesin.
4. Pertahankan cluster terdistribusi hanya untuk beban kerja yang berdasarkan pengukuran nyata benar-benar melampaui kapasitas satu mesin server, dan pantau biaya komputasi per pipeline secara transparan.

### @pattern
Perbaiki format file dan tata letak data sebelum Anda terburu-buru meningkatkan kapasitas perangkat keras. File kolumnar bertipe presisi, terurut, dipadukan dengan mesin analitik berbasis pushdown mampu mengubah mayoritas beban kerja "big data" menjadi pemrosesan ringan di satu server tunggal.

## @quiz
### Mengapa file kolumnar umumnya berukuran jauh lebih kecil dan diproses lebih cepat dibandingkan file CSV untuk query yang hanya membutuhkan 2 dari 50 kolom?
- [ ] File kolumnar menyimpan angka dalam bentuk biner murni sehingga baris teks tidak perlu di-parse ulang oleh mesin apa pun
- [x] Mesin hanya membaca chunk kolom yang perlu, dan tiap kolom terkompresi sangat baik karena nilainya seragam dan sejenis
- [ ] Mesin analitik menyimpan seluruh isi file secara permanen di RAM sehingga pembacaan berikutnya menjadi instan
- [ ] Format kolumnar otomatis menghapus baris-baris data yang tidak relevan dari disk saat file pertama kali ditulis

> Tata letak kolumnar memungkinkan column pruning (hanya membaca 2 dari 50 kolom) dan kompresi tinggi karena nilai dalam satu kolom memiliki tipe dan karakteristik serupa. Kelemahannya adalah pada operasi pembaruan rekaman baris tunggal.

### Untuk apa metadata statistik min dan max di bagian footer file Parquet digunakan?
- [ ] Memberi tahu mesin algoritma kompresi apa yang digunakan agar mesin dapat memilih decoder yang tepat
- [x] Memungkinkan mesin melewati seluruh row group yang rentang nilainya tidak mungkin memenuhi filter WHERE
- [ ] Menyimpan urutan sortir tabel secara permanen sehingga query tidak lagi memerlukan klausa ORDER BY
- [ ] Memverifikasi integritas checksum file agar terbukti tidak mengalami kerusakan saat disalin antar-storage

> Predicate pushdown membandingkan syarat filter query dengan nilai minimum dan maksimum tiap row group di footer, dan melewati row group yang tidak memenuhi syarat tanpa membaca halaman datanya sama sekali.

### Data yang sama berisi 5 juta baris ditulis ke dalam dua file Parquet terpisah: file pertama terurut berdasarkan timestamp, sedangkan file kedua dalam urutan acak. Apa perbedaannya saat difilter pada rentang waktu satu jam?
- [ ] Tidak ada perbedaan sama sekali karena statistik footer dihitung dari kumpulan nilai data yang identik pada kedua file
- [ ] File acak diproses lebih cepat karena baris yang cocok tersebar merata di seluruh thread prosesor
- [x] File terurut membuat sebagian besar row group dilewati, sedangkan pada file acak rentangnya saling tumpang tindih
- [ ] File yang terurut tidak dapat difilter sama sekali karena algoritma filter membutuhkan kolom dengan distribusi nilai acak

> Statistik metadata hanya efektif jika nilai data mengelompok secara teratur. Pada contoh benchmark, hanya 5 dari 50 row group yang perlu dibaca pada data terurut dan seluruh 50 pada data acak (sedangkan pada pengujian lab 1 juta baris / 20 row group, hanya 1–3 dari 20 pada data terurut vs hampir seluruhnya pada data acak).

### Pada execution plan DuckDB, di manakah filter `WHERE event_type = 'purchase'` seharusnya berada untuk performa yang paling optimal?
- [ ] Di dalam node FILTER terpisah setelah proses agregasi agar kelompok yang dihitung menjadi lebih sedikit
- [ ] Di dalam node setelah proses join karena filter data selalu diaplikasikan paling akhir setelah semua baris tersedia
- [x] Di dalam node pemindaian READ_PARQUET pada bagian Filters, sehingga baris yang tidak cocok dibuang saat pembacaan
- [ ] Filter tidak pernah ditampilkan pada execution plan karena optimizer selalu menghapusnya demi menghemat waktu

> Filter yang tercantum di dalam daftar `Filters:` pada node pembacaan menandakan filter telah didorong ke lapisan storage (filter pushdown). Jika filter muncul di node terpisah di atas scan, itu berarti data dibaca seluruhnya terlebih dahulu ke RAM baru disaring.

### Apa perbedaan mendasar antara `pl.read_parquet` dan `pl.scan_parquet` pada Polars?
- [ ] `scan_parquet` hanya dapat membaca file di disk lokal, sedangkan `read_parquet` dirancang khusus untuk cloud object storage
- [ ] `read_parquet` bersifat lazy dan membangun execution plan, sedangkan `scan_parquet` langsung memuat file utuh ke memori
- [x] `scan_parquet` bersifat lazy, sehingga optimizer dapat mendorong filter dan pemilihan kolom sebelum data dibaca dari disk
- [ ] Tidak ada perbedaan teknis selain penamaan fungsi karena Polars selalu mengoptimasi seluruh query sebelum dieksekusi

> Fungsi `scan_*` mengembalikan LazyFrame yang rencana eksekusinya dioptimasi saat `.collect()` dipanggil. Sebaliknya `read_*` bersifat eager: memuat seluruh tabel ke memori terlebih dahulu sehingga kehilangan potensi optimasi pushdown.

### Mengapa nilai mata uang harus disimpan sebagai bilangan bulat dalam satuan terkecil alih-alih tipe floating-point?
- [ ] Bilangan bulat selalu mengonsumsi ruang disk yang lebih sedikit di Parquet dibandingkan floating-point dalam semua skenario
- [ ] Tipe data floating-point tidak dapat dijumlahkan oleh mesin analitik seperti DuckDB dan Polars
- [x] Floating-point biner tidak bisa menyimpan banyak pecahan desimal secara eksak, sehingga jumlahnya melenceng
- [ ] Format Parquet tidak mendukung tipe data floating-point sehingga akan otomatis dikonversi menjadi teks string saat ditulis

> Pecahan biner floating-point memiliki sifat `0.1 + 0.2 != 0.3`. Menggunakan integer (rupiah atau sen) atau tipe data decimal berpresisi tetap menjamin hasil penjumlahan selalu eksak dan dapat direkonsiliasi.

### Anda mempartisi dataset Parquet berdasarkan `customer_id` (100.000 nilai unik) dan tanggal harian. Dampak negatif apa yang paling mungkin terjadi?
- [ ] Query menjadi jauh lebih cepat karena baris tiap pelanggan berada di folder tersendiri yang berukuran kecil
- [ ] Ukuran dataset menyusut drastis karena setiap folder partisi dikompresi menggunakan codec khusus
- [x] Jutaan file kecil, dengan listing lambat, pembukaan file lambat, dan manfaat pruning yang sangat minim
- [ ] Tidak terjadi dampak apa pun karena mesin query secara otomatis menggabungkan partisi kecil saat query berjalan

> Partisi direktori hanya ideal untuk kolom ber-kardinalitas rendah yang rutin difilter. Mempartisi kolom ber-kardinalitas tinggi memicu masalah ribuan file kecil (*small files problem*); gunakan pengurutan data di dalam file untuk kebutuhan tersebut.

### Seorang rekan kerja mengatakan "data kita sudah 20 GB, kita wajib segera menyalakan cluster Spark". Respon profesional apa yang paling tepat?
- [ ] Setuju sepenuhnya, karena dataset apa pun yang melebihi kapasitas RAM laptop mutlak membutuhkan komputasi terdistribusi
- [ ] Menolak mentah-mentah, karena cluster terdistribusi selalu lebih lambat daripada laptop tunggal untuk semua beban kerja
- [x] Konversi data ke Parquet zstd terurut, lalu ukur performa satu agregasi di DuckDB atau Polars sebelum memutuskan apa pun
- [ ] Muat seluruh 20 GB data tersebut ke dalam pandas terlebih dahulu karena pandas adalah standar de facto pengolahan data Python

> Keputusan arsitektur harus didasarkan pada data terukur. Dengan format kolumnar dan mesin berbasis pushdown, data 20 GB sering kali dapat diproses di satu laptop dalam hitungan detik. Pindahlah ke cluster hanya jika data terukur membuktikan kebutuhan tersebut.

## @resources
- [Apache Parquet documentation](https://parquet.apache.org/docs/)
- [DuckDB documentation](https://duckdb.org/docs/)
- [Polars user guide](https://docs.pola.rs/)
- [Apache Arrow documentation](https://arrow.apache.org/docs/)

