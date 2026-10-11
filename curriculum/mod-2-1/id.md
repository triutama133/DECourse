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
Modul 1.2 (streaming memori) dan Modul 1.3 (SQL analitik, execution plan). Jalankan `pip install -r labs/mod-2-1/requirements.txt` untuk memasang DuckDB, Polars, dan PyArrow.

## @lesson Baris versus kolom: arsitektur penyimpanan data
Sebuah tabel pada dasarnya adalah kisi (grid) dua dimensi. Untuk menyimpannya ke dalam media disk atau RAM, kisi tersebut harus diratakan menjadi urutan byte linear, dan terdapat dua pendekatan mendasar:

Penyimpanan **berorientasi baris (row-oriented)** menuliskan satu baris data utuh secara berurutan: `(pesanan 1: id, pelanggan, status, total) (pesanan 2: ...)`. Ini adalah cara kerja file CSV dan basis data transaksional seperti PostgreSQL. Format ini sempurna untuk transaksi OLTP di mana aplikasi mengakses **satu rekaman utuh**: mengambil detail pesanan #4821, memperbarui statusnya, atau menyisipkan pesanan baru. Seluruh byte dari satu rekaman berada berdampingan di disk.

Penyimpanan **berorientasi kolom (column-oriented)** menuliskan seluruh nilai dari satu kolom secara bersamaan: `(semua id) (semua pelanggan) (semua status) (semua total)`. Pertanyaan analitik bisnis hampir tidak pernah membutuhkan seluruh kolom rekaman. Pertanyaan seperti "total nominal belanja berdasarkan status pesanan" hanya menyentuh **dua kolom** dari total lima puluh kolom yang ada di tabel. Dengan format kolumnar, mesin hanya membaca dua kolom tersebut dari disk dan sama sekali tidak menyentuh 48 kolom lainnya; sebaliknya pada format baris, mesin terpaksa membaca seluruh byte dari setiap baris hanya untuk mengambil dua atribut yang dibutuhkan.

Tiga keunggulan utama format kolumnar:

1. **Efisiensi I/O Disk yang Ekstrem.** Membaca 2 dari 50 kolom berarti membaca hanya sekitar 4% volume data. Pada lab praktis, Anda akan melihat laporan mesin analitik bertuliskan `PROJECT 3/7 COLUMNS`: hanya tiga dari tujuh kolom yang dimuat ke memori.
2. **Rasio Kompresi Jauh Lebih Tinggi.** Nilai-nilai dalam satu kolom memiliki tipe data yang seragam dan pola yang berulang (`'mobile'`, `'mobile'`, `'desktop'`, ...). Karakteristik ini memungkinkan teknik kompresi tingkat tinggi seperti **dictionary encoding** (menyimpan setiap string unik satu kali lalu menggantinya dengan bilangan bulat kecil), **run-length encoding** (mencatat `'mobile' x 1000`), **delta encoding** (mencatat selisih angka pada timestamp terurut), dan **bit-packing** (hanya memakai jumlah bit yang benar-benar dibutuhkan oleh nilai maksimum).
3. **Komputasi CPU Sangat Cepat.** Menjumlahkan sebuah kolom angka menjadi perulangan sederhana pada larik array angka yang bersambungan di RAM, yang dieksekusi oleh CPU modern dengan sangat optimal.

Konsekuensinya adalah kebalikannya: membaca atau memperbarui **satu baris utuh** mengharuskan mesin membuka setiap kolom terpisah. Oleh karena itu, format kolumnar sangat ideal untuk analitik dan pemuatan data batch masif, namun buruk untuk penulisan baris tunggal frekuensi tinggi. Itulah mengapa arsitektur produksi memisahkan database OLTP untuk aplikasi dan format kolumnar untuk analitik.

Pengukuran nyata pada tabel event berisi 5.000.000 baris dengan tujuh kolom (id, timestamp, kategori, dan nominal) yang dihasilkan oleh skrip lab:

| Format File | Ukuran di Disk |
|---|---|
| CSV murni | 273 MB |
| Parquet, kompresi snappy, terurut berdasarkan timestamp | 65 MB |
| Parquet, kompresi zstd, terurut berdasarkan timestamp | **40 MB** |
| Parquet, kompresi zstd, baris dalam urutan acak | 66 MB |

Dua baris terakhir tabel di atas memperlihatkan wawasan penting: data yang *sama persis*, ketika disimpan dalam urutan acak, berukuran 65% lebih besar, karena timestamp yang terurut dan nilai berulang berada bersebelahan sehingga algoritma kompresi bekerja jauh lebih efektif. Cara Anda mengurutkan data sebelum menulisnya adalah keputusan performa arsitektur.

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

**Dua optimasi kunci yang membuat query Parquet sangat kencang:**

- **Projection Pushdown (Column Pruning).** Mesin analitik hanya membaca kolom-kolom yang secara eksplisit diminta oleh query dan mengabaikan sisa kolom lainnya.
- **Predicate Pushdown (Filter Pushdown).** Sebelum membaca halaman data dari disk, mesin membandingkan klausa filter WHERE dengan statistik min/max di footer, lalu **melewati (skipping) seluruh row group yang mustahil memuat data target**. Jika rentang timestamp suatu row group adalah pukul 09:00 s.d. 09:15 dan query meminta data pukul 14:00 s.d. 15:00, seluruh row group tersebut dilewati tanpa dibaca sama sekali.

Efektivitas predicate pushdown sangat bergantung pada **urutan sortir baris (sort order)**. Pada file lab berisi 5 juta baris (50 row group masing-masing 100.000 baris), filter rentang waktu satu jam hanya perlu membaca **5 dari 50 row group** pada file yang terurut waktu, namun harus membaca **seluruh 50 row group** pada file dengan data acak: rentang min/max setiap row group pada data acak mencakup rentang sepanjang hari, sehingga tidak ada satu pun yang dapat dilewati. Di lab praktis, Anda akan mengimplementasikan fungsi keputusan ini sendiri (`row_groups_to_read`): hanya bermodalkan metadata footer, tentukan row group mana saja yang wajib dibaca.

Pelajaran praktis untuk perancangan pipeline:

- **Urutkan atau kelompokkan data berdasarkan kolom yang paling sering difilter** (biasanya kolom tanggal/waktu transaksi) saat menulis file Parquet.
- **Ukuran row group dan file yang ideal.** Ukuran row group sekitar 100.000 hingga 1.000.000 baris memberikan keseimbangan terbaik antara efektivitas skipping dan overhead metadata. Target ukuran satu file Parquet adalah 100 MB hingga 1 GB. Ribuan file berukuran kecil (beberapa kilobyte) akan memperlambat query (dikenal sebagai **small files problem**), yang harus diperbaiki melalui proses pemadatan (compaction).
- **File Parquet bersifat immutable.** Anda tidak dapat memperbarui satu baris di tempat; modifikasi data berarti menulis file Parquet baru.

## @lesson Apache Arrow dan eksekusi tervektorisasi (vectorized)
**Apache Arrow** adalah format data kolumnar standar untuk representasi **di dalam memori RAM**, pasangan serasi dari Parquet yang berada di disk. Nilai terbesar Arrow adalah standardisasi memori bersama: DuckDB, Polars, pandas (dengan backend PyArrow), Spark, dan database dapat bertukar data di RAM **tanpa serialisasi dan tanpa penyalinan memori (zero-copy)**. Itulah mengapa konversi `duckdb_result.pl()` (ke Polars) atau `.arrow()` berlangsung seketika.

Bagaimana mesin query modern menghitung data kolom secara kilat? Basis data konvensional memproses data **satu baris demi satu baris** ("tuple-at-a-time" / model iterator Volcano), yang membayar overhead pemanggilan fungsi dan conditional branch pada setiap nilai. Mesin analitik kolumnar modern menerapkan **eksekusi tervektorisasi (vectorized execution)**: mereka memproses **satu batch larik nilai** (DuckDB memproses vektor berisi 2.048 nilai) sekaligus dalam perulangan loop CPU yang rapat. Manfaatnya: data tetap berada di CPU L1/L2 cache, overhead loop diamortisasi melintasi ribuan nilai, compiler dapat mengaktifkan instruksi **SIMD** (Single Instruction Multiple Data: satu instruksi CPU memproses banyak angka sekaligus), dan filter dievaluasi sebelum kolom lain dimuat ke memori (**late materialization**). Dipadukan dengan multi-threading, sebuah laptop mampu memaksimalkan seluruh bandwidth memori perangkat kerasnya.

Prinsip penting yang harus menjadi kebiasaan kerja Anda: **nyatakan logika transformasi sebagai operasi berbasis kolom utuh** (melalui query SQL atau ekspresi dataframe) dan biarkan mesin C++/Rust yang menjalankan loop-nya. Perulangan loop `for` Python baris demi baris membayar overhead interpreter Python yang sangat mahal pada tiap elemen; logika yang sama jika ditulis sebagai ekspresi SQL DuckDB atau Polars akan berjalan ratusan kali lebih cepat.

## @lesson DuckDB: mesin analitik SQL langsung di dalam proses aplikasi
**DuckDB** adalah basis data analitik OLAP yang berjalan **langsung di dalam proses Python Anda** (in-process), mirip seperti SQLite namun dirancang khusus untuk pemindaian data masif dan agregasi analitik (kolumnar, tervektorisasi, paralel). Anda tidak memerlukan server database terpisah, cukup pasang library dan langsung query file di disk:

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

**Mengolah data yang lebih besar dari kapasitas RAM (Out-of-Core Processing).** DuckDB secara otomatis menumpahkan data sementara ke disk (spill to disk) saat kebutuhan memori query melebihi batas yang ditentukan: `SET memory_limit = '2GB'; SET temp_directory = '/tmp/duck'`. Pada pengujian lab, pengurutan 5.000.000 baris di bawah batas memori 200 MB selesai dalam 0,3 detik dengan puncak konsumsi RAM hanya 194 MB tanpa mengalami crash OOM. Konfigurasi berguna lainnya: `SET threads = 4` untuk membatasi pemakaian core CPU di lingkungan container bersama.

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

Konsep kunci di balik performa Polars adalah **lazy evaluation**. Pemanggilan `scan_parquet` beserta rantai transformasi di bawahnya hanya merumuskan sebuah *rencana (plan)* komputasi; pemanggilan `.collect()` memerintahkan query optimizer untuk menganalisis dan mengeksekusi rencana tersebut secara optimal. Optimizer menerapkan pushdown yang sama, dan `.explain()` membuktikannya:

```text
Parquet SCAN [ev.parquet]
PROJECT 3/7 COLUMNS
SELECTION: col("event_type") == "purchase"
```

Hanya tiga dari tujuh kolom yang dimuat, dan filter dieksekusi di dalam pembacaan file. (`pl.read_parquet` adalah versi *eager*: memuat seluruh data ke memori terlebih dahulu dan kehilangan optimasi pushdown; selalu prioritaskan `scan_*` untuk memproses file). Polars secara default memanfaatkan seluruh core CPU dan memiliki fitur streaming untuk data yang melebihi kapasitas RAM.

**Bagaimana dengan pandas?** pandas sangat populer dan sangat bagus untuk dataset kecil, eksplorasi awal, serta ekosistem visualisasi/machine learning. Namun kelemahannya muncul saat skala data membesar: pandas memuat tabel utuh ke RAM, merepresentasikan teks string sebagai Python object (yang memboroskan memori), dan sebagian besar operasinya berjalan di single thread. Pengujian terukur pada file yang sama berisi 5 juta baris, masing-masing dijalankan pada proses Python bersih:

| Percobaan: Agregasi `amount` berdasarkan `event_type` | Durasi Waktu | Puncak Konsumsi RAM |
|---|---|---|
| pandas: `read_csv`, lalu groupby | 3.5 detik | 662 MB |
| pandas: `read_parquet` (semua kolom), lalu groupby | 0.8 detik | 1.081 MB |
| pandas: `read_parquet(columns=[2 kolom])` | 0.6 detik | 576 MB |
| DuckDB langsung membaca file CSV | 0.5 detik | 332 MB |
| DuckDB langsung membaca file Parquet | **0.1 detik** | **80 MB** |
| Polars lazy membaca file Parquet | 0.2 detik | 160 MB |

Perhatikan baris kedua: membaca Parquet ke pandas mengonsumsi memori *lebih banyak* daripada membaca CSV, karena pandas harus mewujudkan seluruh tujuh kolom sebagai Python object di RAM. Membatasi kolom yang dibaca (`columns=[...]`) memangkas konsumsi RAM hingga separuhnya. Mesin modern seperti DuckDB dan Polars yang mendorong filter dan proyeksi langsung ke pembacaan file sama sekali tidak pernah menyusun tabel utuh di RAM.

Panduan praktis memilih alat:

| Karakteristik Beban Kerja | Alat Rekomendasi |
|---|---|
| Puluhan s.d. ratusan ribu baris, eksplorasi interaktif, plotting | pandas |
| Analisa berbasis SQL terhadap file; operasi join masif dan agregasi; "SELECT di folder Parquet" | **DuckDB** |
| Pipeline data Python dengan transformasi bertahap; arsitektur kode modular yang reusable | **Polars** |
| Data jauh melebihi kapasitas disk satu server; banyak proses penulisan bersamaan | Mesin terdistribusi (Apache Spark, Modul 3.1) atau cloud data warehouse |

DuckDB dan Polars saling terhubung erat melalui format memori Apache Arrow, sehingga Anda dapat mengombinasikannya: gunakan SQL DuckDB untuk join dan agregasi berat, lalu lanjutkan dengan Polars untuk manipulasi logika Python. Fakta di dunia kerja: **satu laptop/server tunggal mampu mengolah data ratusan gigabyte** jika format file dan tata letaknya dirancang dengan benar, jadi beralihlah ke cluster terdistribusi hanya ketika pengukuran data membuktikan Anda benar-benar membutuhkannya.

## @lesson Tata letak partisi, tipe data, dan jebakan umum
**Partisi Direktori (Partitioning).** Membagi data ke dalam sub-folder berdasarkan nilai kolom tertentu (`month=2026-01/`) memungkinkan mesin query melewati seluruh folder yang tidak relevan saat ada filter pada kolom tersebut (partition pruning). Panduan praktis: partisi data hanya pada **kolom ber-kardinalitas rendah yang rutin difilter** (seperti tanggal atau wilayah), jangan pernah partisi pada ID transaksi; hindari pembagian partisi yang melahirkan ribuan file mini; dan prioritaskan **pengurutan data di dalam file** untuk kolom ber-kardinalitas tinggi karena statistik row group Parquet dapat menanganinya dengan sangat efisien. Partisi berlebihan (*over-partitioning*) adalah kesalahan paling umum data engineer pemula.

**Disiplin Tipe Data:**

- **Uang dan Nilai Moneter.** Jangan pernah menyimpan nilai mata uang sebagai floating-point IEEE 754 (`0.1 + 0.2 != 0.3`). Gunakan integer dalam satuan terkecil (rupiah atau sen, seperti di KopiKu) atau tipe data `DECIMAL` berpresisi tetap. Seluruh perhitungan omset pada lab ini wajib menghasilkan integer karena alasan tersebut.
- **Timestamp dan Zona Waktu.** Tentukan secara tegas apakah kolom disimpan dalam waktu lokal atau UTC; tipe data `TIMESTAMP` tanpa zona waktu bersifat ambigu. Praktik terbaik: selalu simpan data dalam standar UTC di lapisan penyimpanan.
- **Identitas Berupa Angka.** Inferensi otomatis pada file CSV sering membaca nomor telepon atau kode pos `00123` sebagai angka numerik 123, yang menghilangkan nol di depan. Nyatakan kolom tersebut secara eksplisit sebagai string/teks.
- **Pergeseran Skema (Schema Drift).** Kolom yang bertipe `int` pada file bulan Januari namun berubah menjadi `string` pada bulan Maret akan menggagalkan query pembacaan banyak file. Lakukan validasi skema ketat pada gerbang ingestion (Modul 2.5).

Kebiasaan rekayasa yang baik: hindari `SELECT *` pada data kolumnar karena mematikan column pruning; lakukan filter sedini mungkin pada kolom yang terurut; tulis file Parquet dengan kompresi zstd dan ukuran row group eksplisit; prioritaskan sedikit file berukuran besar daripada ribuan file mini; dan selalu lakukan verifikasi dengan perintah `EXPLAIN` serta pengujian benchmark nyata sebelum mempercayai klaim performa apa pun.

## @lab Lab: konversi CSV ke Parquet, dua mesin analitik, dan implementasi pushdown
Konversikan tabel operasional KopiKu ke dalam format Parquet terkompresi, jawab pertanyaan bisnis yang sama menggunakan SQL di DuckDB dan lazy dataframe di Polars (buktikan kedua mesin menghasilkan angka omset yang identik dengan verifikasi independen SQLite), serta implementasikan logika predicate pushdown sendiri langsung dari metadata footer Parquet. Terakhir, lakukan pengujian benchmark mandiri pada data berskala lebih besar untuk membandingkan performa ketiga alat.

### @steps
1. Pasang dependensi yang diperlukan dan jalankan pengujian awal untuk melihat spesifikasi yang diharapkan:

```bash
python -m pip install -r labs/mod-2-1/requirements.txt
pytest labs/mod-2-1 -v          # Seluruh pengujian akan gagal pada awalnya
```

2. Buka file `labs/mod-2-1/analytics.py`. Implementasikan fungsi `to_parquet` menggunakan perintah DuckDB `COPY (SELECT * FROM read_csv(...)) TO ... (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE ...)`. Unit test akan memvalidasi jumlah baris, kompresi zstd, tipe data hasil inferensi, serta memastikan konfigurasi `row_group_size` menghasilkan beberapa row group yang teratur.
3. Implementasikan fungsi `revenue_by_month_roast_duckdb`: join data baris item pesanan, pesanan, dan produk (dari tiga file Parquet terpisah), lalu kembalikan tuple `(month, roast_level, revenue)` terurut berdasarkan bulan dan tingkat sangrai. Pastikan nilai omset bertipe integer.
4. Implementasikan logika analitik yang sama persis di Polars secara **lazy** (`scan_parquet` ... `collect()`). Kesesuaian output membuktikan dua mesin analitik modern berbeda menghasilkan angka yang konsisten dan identik dengan hasil kalkulasi SQLite independen.
5. Implementasikan fungsi `row_groups_to_read(path, column, lo, hi)` hanya dengan membaca metadata `pyarrow.parquet.ParquetFile(path).metadata` dan atribut `statistics` tiap row group. Sebuah row group boleh dilewati hanya jika nilai max berada di bawah `lo` atau nilai min berada di atas `hi`. Jalankan pengujian pushdown: pada data terurut waktu, fungsi Anda seharusnya hanya membaca 1 s.d. 3 row group; sedangkan pada data acak hampir seluruh row group harus dibaca.
6. Lakukan benchmark mandiri. Buat dataset sintetis berukuran lebih besar dan bandingkan durasi serta puncak konsumsi RAM antara pandas, DuckDB, dan Polars untuk kalkulasi agregasi yang sama (gunakan utilitas `/usr/bin/time -v python script.py` di Linux):

```python
import duckdb
duckdb.sql("""COPY (SELECT i AS event_id, 1767225600 + i // 100 AS event_ts, (hash(i) % 20000)::INT AS customer_id,
                    round((hash(i * 17) % 100000) / 100.0, 2) AS amount
             FROM range(5000000) t(i) ORDER BY event_ts)
             TO 'events.parquet' (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE 100000)""")
```

7. Buat file pembanding dengan urutan data acak `ORDER BY hash(event_id)` dan amati perbedaan ukuran file di disk serta jumlah row group yang tersentuh saat difilter pada rentang waktu satu jam.

### @files
- labs/mod-2-1/analytics.py :: File kerja utama Anda: empat fungsi inti yang harus diimplementasikan :: starter
- labs/mod-2-1/test_lab.py :: Rangkaian 10 pengujian otomatis validasi komparatif :: test
- labs/mod-2-1/requirements.txt :: Dependensi library: duckdb, polars, pyarrow, pytest :: config
- labs/mod-2-1/reference/analytics.py :: Solusi referensi lengkap (coba kerjakan sendiri dulu!) :: reference

### @deliverables
- Seluruh 10 unit test di `test_lab.py` berhasil lolos (PASS)
- Anda dapat membuktikan melalui `EXPLAIN` (DuckDB) dan `.explain()` (Polars) bahwa kedua mesin berhasil melakukan projection pushdown dan filter pushdown langsung di node pemindaian file
- Anda mencatat tabel perbandingan hasil benchmark mandiri (durasi waktu dan konsumsi RAM) untuk ketiga alat analitik beserta ringkasan penyebab perbedaannya

### @verify
```bash
pytest labs/mod-2-1 -v
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

> Statistik metadata hanya efektif jika nilai data mengelompok secara teratur. Pada pengujian lab, hanya 5 dari 50 row group yang perlu dibaca pada data terurut, sedangkan pada data acak seluruh 50 row group wajib dibaca.

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

