---
title: pandas untuk Data Engineer: Bersihkan, Bentuk Ulang, dan Ringkas Data
duration: 2 minggu
summary: Pelajari bagian pandas yang dipakai data engineer setiap hari: memuat file dengan tipe yang benar, menemukan apa yang salah di dalamnya, membersihkan dengan operasi seluruh kolom alih-alih loop, mengelompokkan, mem-pivot dan meranking, menggabungkan tabel tanpa melipatgandakan baris, dan menjaga memori dengan kategori, chunk, dan Parquet. Anda membersihkan ekspor pesanan yang sengaja berantakan dan memeriksa setiap angkanya.
why: Tutorial menampilkan pandas pada CSV yang rapi dan melakukan loop per baris dengan apply. File sungguhan punya angka nol di depan yang hilang, tanggal yang bukan tanggal, dan duplikat dari ekspor yang diulang, dan loop per baris yang memakan 6 detik untuk sejuta baris adalah beda antara pipeline yang selesai dan yang tidak.
---

## @outcomes
- Menjelaskan apa itu DataFrame, Series, index, dan dtype, dan kapan pandas adalah alat yang tepat dibanding SQL atau Spark
- Memuat CSV dengan tipe eksplisit sehingga id mempertahankan angka nol di depan, penanda kosong dikenali, dan tanggal yang buruk menjadi nilai kosong
- Memprofil file untuk mencari null dan duplikat sebelum mengubah apa pun, lalu membersihkannya dengan operasi vektor, bukan loop per baris
- Mengelompokkan, mengagregasi, mem-pivot, dan meranking data, serta menambah total berjalan dan selisih hari per pelanggan
- Menggabungkan dua tabel dengan merge yang tidak bisa diam-diam melipatgandakan baris, dan menemukan baris yang tidak cocok
- Mengurangi memori dengan kategori dan integer yang lebih kecil, membaca file per chunk, dan memilih Parquet daripada CSV

## @prereq
Modul 0.0 dan 0.1 (fungsi Python, loop, virtual environment) dan 0.3 (GROUP BY dan join SQL). Lab butuh `pandas` dan `pyarrow` di virtual environment Anda (`pip install -r labs/mod-1-5/requirements.txt`).

## @lesson Apa itu pandas, dan kapan memakainya
**pandas** adalah pustaka Python untuk bekerja dengan tabel di memori. Dua objek intinya:

- **Series**: satu kolom, daftar nilai dengan label untuk tiap nilai (**index**) dan satu **dtype** (tipe dari setiap nilai: `int64`, `float64`, teks, datetime, ...);
- **DataFrame**: sebuah tabel, yaitu kumpulan Series yang berbagi satu index. Setiap kolom punya dtype-nya sendiri.

Jika Anda sudah tahu SQL, Anda sudah tahu sebagian besar gagasannya, hanya penulisannya yang berubah:

| SQL | pandas |
|---|---|
| `SELECT a, b` | `df[["a", "b"]]` |
| `WHERE x > 3` | `df[df["x"] > 3]` (sebuah **boolean mask**) |
| `SELECT a * b AS c` | `df.assign(c=df["a"] * df["b"])` |
| `GROUP BY k` dengan `SUM`, `COUNT` | `df.groupby("k").agg(...)` |
| `JOIN` | `df.merge(other, on=..., how=...)` |
| `ORDER BY x DESC` | `df.sort_values("x", ascending=False)` |
| `ROW_NUMBER() OVER (PARTITION BY k ...)` | `df.groupby("k").cumcount() + 1` |

Model mental yang paling penting: **pandas bekerja pada seluruh kolom sekaligus.** `df["quantity"] * df["unit_price_idr"]` mengalikan sejuta pasang dalam satu panggilan, di kode yang sudah dikompilasi. Hampir tidak pernah Anda menulis loop `for` atas baris. Kita akan mengukur seberapa besar bedanya di pelajaran 3.

**Kapan pandas adalah alat yang tepat?** Pakai ketika data muat di memori satu mesin (pelajaran 6 menunjukkan cara memperkirakannya), ketika Anda mengeksplorasi, membersihkan, atau membentuk ulang file, ketika Anda menulis transformasi kecil dalam Python, dan ketika Anda perlu menguji logika dengan cepat. Pilih **SQL di warehouse atau DuckDB** ketika data sudah ada di sana, karena mesinnya hanya membaca yang dibutuhkan dan Anda tidak menyalin data keluar. Pilih **Spark** (Modul 3.1) ketika satu mesin tidak cukup. Data engineer memakai ketiganya; pandas adalah alat paling tajam untuk melihat file baru pertama kali dan untuk langkah kecil di antaranya.

Dua kebiasaan untuk dimulai. Pertama, **lihat sebelum mengubah**: `df.head()`, `df.dtypes`, `df.shape`, `df.isna().sum()`, `df["country"].value_counts()`. Kedua, **jangan mengedit di tempat tanpa alasan**: bangun frame baru dari yang lama (`assign`, `rename`, `dropna`), yang juga membuat fungsi Anda mudah diuji, seperti di lab.

## @lesson Memuat file dengan benar
`pd.read_csv("orders.csv")` bekerja pada file bersih dan diam-diam merusak file yang berantakan. File tidak punya tipe; pandas **menebak**, dan tebakan itulah yang menimbulkan masalah. Empat hal yang harus Anda tentukan sendiri:

1. **Id adalah teks, bukan angka.** Id pelanggan seperti `00042` adalah label, bukan kuantitas. Jika dibaca sebagai angka, pandas menyimpan `42`: angka nol di depan hilang, dan join terhadap tabel pelanggan (yang berisi `"00042"`) gagal atau, lebih buruk, cocok dengan baris yang salah. Pada file pesanan berantakan kita, id pelanggan pertama yang terbaca secara default adalah `211` alih-alih `00211`, dan merge atasnya memunculkan `ValueError: You are trying to merge on int64 and str columns`. Perbaikan: `dtype={"customer_id": "string"}`.
2. **Penanda kosong.** pandas sudah menganggap sel kosong, `NA`, `N/A`, dan `null` sebagai kosong, tetapi file Anda mungkin memakai `-` atau `unknown`. Beri tahu: `na_values=["-"]`. Kalau tidak, satu `-` mengubah seluruh kolom harga menjadi teks.
3. **Integer yang bisa kosong.** Kolom `int64` biasa tidak bisa menyimpan nilai kosong, jadi satu sel kosong diam-diam mengubah seluruh kolom menjadi float (`3.0`). Tipe integer nullable `"Int64"` (I besar) menjaga integer dan menampilkan `<NA>`.
4. **Tanggal di-parse, dan kegagalan ditangani dengan sengaja.** `pd.to_datetime(col, format="%Y-%m-%d", errors="coerce")` mengubah teks menjadi datetime sungguhan dan mengubah apa pun yang bukan tanggal (`"yesterday"`, `"2026-02-30"`, sel kosong) menjadi `NaT` ("not a time"), alih-alih membuat job malam crash atau, lebih buruk, menebak.

Berguna juga saat membaca file besar: `usecols=[...]` hanya memuat kolom yang dibutuhkan, `nrows=1000` untuk pratinjau, dan `encoding="utf-8"` sebaiknya disebut terang-terangan (Modul 0.0).

**Profil sebelum membersihkan.** Di lab Anda menulis `data_quality_report`, yang menghitung baris, null per kolom, dan id yang berulang. Untuk ekspor 2.080 baris itu, ia menemukan **80 id pesanan berulang, 25 tanggal tak terpakai, 37 kuantitas kosong, dan 30 harga kosong**. Itu 4% baris berulang dan sekitar 5% tak terpakai, wajar untuk ekspor sungguhan dan itulah alasan langkah ini ada. Pipeline yang tidak menghitung apa yang dibuangnya tidak bisa menjelaskan nanti mengapa sebuah total berubah. Simpan hitungan seperti ini: itulah metrik kualitas data pertama Anda (Modul 2.5).

`NaN` perlu dibahas sebentar. Di pandas angka kosong adalah `NaN` (dan tanggal kosong `NaT`), dan sebagian besar agregasi **melewatinya**: `pd.Series([1, None, 3]).sum()` adalah 4.0 dan `.mean()` adalah 2.0, bukan 1.33. Biasanya itu yang Anda inginkan dan kadang jebakan: rata-rata atas kolom yang 30% kosong menggambarkan 70% sisanya. Selalu tahu berapa banyak yang kosong ketika Anda menyebut sebuah angka.

## @lesson Membersihkan dengan operasi seluruh kolom
Pembersihan adalah daftar pendek langkah yang berulang. Masing-masing punya bentuk vektornya:

- **Teks**: accessor `.str` menerapkan metode string ke setiap nilai: `df["country"].str.strip().str.upper()`. Pada ekspor kita negara muncul sebagai `" id"`, `"Id"`, `"ID "`, dan `"ID"`; setelah satu baris hanya ada satu nilai.
- **Tanggal**: accessor `.dt`: `df["order_date"].dt.strftime("%Y-%m")`, `.dt.month`, `.dt.day_name()`.
- **Duplikat**: `df.drop_duplicates(subset="order_id", keep="first")`. Tentukan **kuncinya** (id pesanan, bukan seluruh baris) dan salinan mana yang menang.
- **Kosong**: `df.dropna(subset=[...])` untuk membuang baris yang tak terpakai bagi tujuan Anda, atau `fillna(value)` untuk memberi nilai default. Membuang adalah keputusan tentang data, jadi hitung apa yang Anda buang.
- **Menyaring**: boolean mask, `df[df["status"] == "paid"]`; gabungkan mask dengan `&`, `|`, `~` dan kurung: `df[(df["status"] == "paid") & (df["quantity"] > 1)]`.
- **Kolom baru**: `df.assign(revenue_idr=df["quantity"] * df["unit_price_idr"])`.
- **Tipe**: `astype("int64")`, `pd.to_numeric(..., errors="coerce")`.

**Mengapa bukan `apply`?** `df.apply(lambda row: row["quantity"] * row["unit_price_idr"], axis=1)` memberi jawaban yang benar dan begitulah banyak tutorial menulisnya. Kami mengukurnya pada tabel **1.000.000 baris**: perkalian kolom memakan **1,8 milidetik**, `apply` per baris memakan **5,7 detik**, sekitar **3.100 kali lebih lambat**, dan loop `itertuples` biasa atas hanya 200.000 baris memakan 0,9 detik. Loop menjalankan kode Python sejuta kali; operasi kolom menjalankan satu loop yang sudah dikompilasi. Ketika Anda tergoda menulis `apply`, cari fungsi bawaan: `.str`, `.dt`, `np.where`, `clip`, `map` dengan dictionary, `groupby`. Tes lab melarang `apply`, `iterrows`, dan `itertuples` di tempat jawaban vektor tersedia, agar kebiasaan itu terbentuk.

**Jangan merantai assignment.** `df[df["a"] > 1]["b"] = 9` tampak memperbarui baris, tetapi bagian pertama mengembalikan salinan (mungkin sementara), sehingga assignment-nya hilang. Kami menjalankannya pada pandas 2.2.3 dan 3.0.6: `df["b"]` tetap `[0, 0, 0]` dan pandas memberi peringatan. Tulis dalam satu langkah: `df.loc[df["a"] > 1, "b"] = 9`. Lebih baik lagi, hindari mengedit dan bangun frame baru, itulah sebabnya fungsi di lab mengembalikan frame baru dan membiarkan inputnya (tes memeriksanya).

Aturan terakhir: **pembersihan adalah sebuah fungsi**. `clean_orders(raw) -> clean`, fungsi murni dari satu frame ke frame lain, bisa diuji dengan frame lima baris, dijalankan lagi pada file besok, dan dibaca rekan kerja. Notebook dengan empat puluh sel yang harus dijalankan dalam urutan yang benar tidak bisa.

## @lesson Group, pivot, dan rank
**`groupby`** adalah jantung analitik di pandas: pecah tabel menjadi kelompok, hitung sesuatu per kelompok, gabungkan hasilnya kembali. Bentuk paling jelas adalah **named aggregation**:

```python
df.groupby("country", as_index=False).agg(
    orders=("order_id", "nunique"),
    revenue_idr=("revenue_idr", "sum"),
    avg_order_idr=("revenue_idr", "mean"),
)
```

Setiap keyword menjadi kolom keluaran, didefinisikan sebagai `(kolom, fungsi)`. Perhatikan `nunique`: itu adalah `COUNT(DISTINCT order_id)`. `count` menghitung nilai yang tidak kosong dan `size` menghitung baris; keduanya berbeda ketika ada nilai kosong, jadi pilih dengan sengaja. `as_index=False` menjaga kunci kelompok sebagai kolom biasa, yang lebih mudah di-merge, diuji, dan ditulis nanti.

**Pivot table** mengubah nilai satu kolom menjadi kolom: omset per bulan (baris) dan negara (kolom). `pivot_table(index=..., columns=..., values=..., aggfunc="sum", fill_value=0)` melakukannya. `fill_value=0` penting: bulan tanpa penjualan di suatu negara akan menjadi `NaN`, yang diperlakukan grafik dan penjumlahan berikutnya berbeda dari nol. Apakah "tidak ada penjualan" itu nol atau tidak diketahui? Putuskan, lalu tuliskan.

**Window tanpa fungsi window.** `ROW_NUMBER`, total berjalan, dan `LAG` di SQL punya padanan langsung setelah Anda mengurutkan dan mengelompokkan:

```python
out = df.sort_values(["customer_id", "order_date", "order_id"])
by_customer = out.groupby("customer_id")
out["order_number"] = by_customer.cumcount() + 1                 # 1, 2, 3 ... per customer
out["revenue_to_date"] = by_customer["revenue_idr"].cumsum()      # running total
out["days_since_previous"] = by_customer["order_date"].diff().dt.days   # LAG-style gap
```

Pengurutan datang lebih dulu dan **menyertakan pemutus seri** (`order_id`) membuat hasilnya sama setiap kali, yang dibutuhkan sebuah tes. **Top N per kelompok** adalah gagasan yang sama: urutkan menurut nilai menurun di dalam tiap kelompok, lalu simpan baris yang `cumcount() + 1`-nya paling banyak N. Seri butuh aturan (di lab, nama produk A sampai Z), kalau tidak dua proses pada data yang sama bisa berbeda.

Periksa agregat Anda terhadap perhitungan independen. Tes lab menghitung ulang setiap total dengan Python biasa atas baris yang benar lalu membandingkannya; dalam kerja Anda sendiri, periksa satu kelompok dengan tangan dan bandingkan total keseluruhan dengan sumbernya (Modul 2.5). `groupby` yang diam-diam membuang baris dengan kunci kosong (`groupby` melewati kunci `NaN` secara default) adalah cara klasik meleset beberapa persen tanpa disadari.

## @lesson Menggabungkan tabel tanpa melipatgandakan baris
`orders.merge(customers, on="customer_id", how="left")` adalah `LEFT JOIN`. Argumen `how` memilih `inner`, `left`, `right`, atau `outer`, persis seperti di SQL (Modul 0.3), dan jebakan yang sama berlaku: **fan-out**. Jika tabel kanan punya kunci yang sama dua kali, setiap baris kiri yang cocok diulang.

Kami mengukurnya pada pesanan yang sudah bersih: 1.911 pesanan dan daftar pelanggan yang 30 pelanggannya tanpa sengaja tercantum dua kali. Left join mengembalikan **2.187 baris** alih-alih 1.911, dan kolom omset berjumlah **378.380.000 alih-alih 331.555.000**, kelebihan **14,1%**, tanpa error dan dengan hasil yang tampak sangat masuk akal. Dashboard yang dibangun di atasnya akan salah dan tak seorang pun tahu sebabnya.

Pertahanannya satu argumen: **`validate="m:1"`** ("banyak pesanan ke satu pelanggan"). Sekarang pandas memeriksa kunci di tabel kanan dan memunculkan `MergeError` begitu ada kunci yang berulang. Pakai `validate` di setiap merge yang Anda tulis: `"1:1"`, `"m:1"`, atau `"1:m"`, mana pun yang Anda yakini benar. Ia mengubah asumsi menjadi tes. Bandingkan juga `len()` sebelum dan sesudah.

Kebiasaan join lain:

- **Temukan baris yang tidak cocok (anti-join).** Pesanan kita menyebut 20 id pelanggan yang tidak ada di daftar pelanggan (`00201` sampai `00220`). `set(orders["customer_id"]) - set(customers["customer_id"])` menemukannya; atau `merge(..., how="left", indicator=True)` menambah kolom `_merge` yang menampilkan baris `left_only`. Yatim adalah temuan kualitas data untuk dilaporkan, bukan untuk disembunyikan.
- **Isi dengan sengaja.** Setelah join, pesanan tanpa pelanggan punya `NaN` di `tier`. Di lab mereka menjadi `"unknown"`, kategori yang terlihat, alih-alih diam-diam hilang dari `groupby` berikutnya (yang melewati kunci kosong).
- **Tipe kunci sama di kedua sisi.** Masalah int versus teks dari pelajaran 2 muncul di sini sebagai error; dengan dua kolom teks yang berbeda spasi atau huruf besar-kecil ia muncul sebagai *nol kecocokan* tanpa error. Periksa tingkat kecocokan segera setelah join.
- **Nama kolom berbeda**: `left_on="cust"`, `right_on="customer_id"`. **Nama sama untuk kolom lain** mendapat akhiran `_x`/`_y`: pilih akhiran eksplisit dengan `suffixes=`.
- **`concat`** menumpuk tabel dengan kolom sama (beberapa file harian menjadi satu). Pastikan kolomnya sejajar dan reset index.

Alat berguna terakhir adalah `pd.testing.assert_frame_equal(actual, expected)`: ia membandingkan dua frame dan memberi tahu persis apa yang berbeda. Begitulah tes di lab bekerja, dan begitulah seharusnya Anda menguji transformasi Anda sendiri.

## @lesson Memori, chunk, dan Parquet
pandas menyimpan seluruh tabel di RAM. Berapa banyak RAM? Lebih dari ukuran file. Kami membuat tabel pesanan **1.000.000 baris** (CSV **47,7 MB**) dan membacanya dengan pengaturan default: pada pandas 3.0.6 ia menempati **83 MB** di memori (1,75 kali file), dan pada pandas 2.2.3 **247 MB, 5,2 kali file**, karena pandas lama menyimpan setiap nilai teks sebagai objek Python tersendiri. Aturan praktis: **rencanakan 2 sampai 10 kali ukuran file**, ukur dengan `df.memory_usage(deep=True).sum()`, dan periksa sebelum membaca ekspor 20 GB di laptop 16 GB.

**Kecilkan.** Kolom dengan sedikit nilai berbeda (negara, produk, status) bisa disimpan sebagai **kategori**: tabel menyimpan tiap nilai berbeda sekali dan satu kode integer kecil per baris. Kolom integer jarang butuh 64 bit. Pada sejuta baris yang sama, mengubah teks beragam-rendah menjadi `category` dan men-downcast integer menurunkan memori dari **78 MB menjadi 40 MB di pandas 3.0.6, dan dari 242 MB menjadi 84 MB di 2.2.3** (`shrink_memory` di lab). Nilainya identik. Jangan ubah id unik menjadi kategori: ia akan menyimpan satu kode *dan* satu label per baris, yang justru lebih besar. Aturan lab adalah "nilai berbeda kurang dari setengah jumlah baris".

**Baca per chunk.** Ketika file tidak muat, `pd.read_csv(path, usecols=[...], chunksize=100_000)` mengembalikan iterator DataFrame. Untuk tiap chunk, hitung **hasil parsial**, lalu gabungkan hasil parsialnya:

```python
parts = []
for chunk in pd.read_csv(path, usecols=["country", "quantity", "unit_price_idr"], chunksize=100_000):
    parts.append((chunk["quantity"] * chunk["unit_price_idr"]).groupby(chunk["country"]).sum())
total = pd.concat(parts).groupby(level=0).sum()
```

Ini bekerja untuk hal yang bisa digabungkan: jumlah, hitungan, minimum, maksimum. Rata-rata adalah `sum / count` dari jumlah gabungan, bukan rata-rata dari rata-rata. **Waspadai apa pun yang butuh seluruh file.** Deduplikasi tiap chunk secara terpisah melewatkan duplikat yang jatuh di chunk berbeda. Pada ekspor kita baris yang diulang berdekatan, jadi chunk 100 baris hanya melewatkan 1 dari 80 duplikat, tetapi jika eksporter mengulang berjam-jam kemudian, jaraknya jauh dan mereka akan lolos. Median, rank global, dan join dua file besar tidak bisa dilakukan per chunk; saat itulah Anda pindah ke database, DuckDB, atau Spark.

**Pakai Parquet, bukan CSV, untuk data yang Anda simpan.** CSV adalah teks: ia menyimpan `2026-01-15` sebagai sepuluh karakter, tidak punya tipe (pelajaran 2 ada karena itu), dan harus dibaca dari byte pertama sampai terakhir. **Parquet** adalah format biner, **kolumnar**, terkompresi (Modul 2.1) yang menyimpan tipe. Pada sejuta baris yang sama file Parquet berukuran **9,1 MB dibanding 47,7 MB** untuk CSV, sekitar **5 kali lebih kecil**, dan membaca hanya dua kolom memakan **0,03 detik dibanding 0,27** untuk CSV (`usecols` tetap harus memindai seluruh file teks). `df.to_parquet("orders.parquet", index=False)` menulisnya dan `pd.read_parquet(path, columns=[...])` hanya membaca kolom yang diminta. Antar langkah pipeline, serahkan Parquet, bukan CSV.

**Menguji kode data.** Lab memperlihatkan kebiasaannya: tiap fungsi kecil dan murni, menerima frame dan mengembalikan frame, dan punya tes dari beberapa baris yang jawabannya bisa Anda hitung dengan tangan, ditambah satu tes pada file realistis terhadap jawaban yang dihitung secara independen. Ketika sebuah fungsi bisa diuji dengan lima baris, ia cukup sederhana untuk dipercaya.

## @lab Lab: bersihkan dan ringkas ekspor pesanan yang berantakan
Bersihkan ekspor pesanan KopiKu dengan pandas: muat dengan tipe yang benar, profil, bersihkan, hitung omset per negara dan bulan, ranking produk, tambah riwayat per pelanggan, gabungkan daftar pelanggan dengan aman, lalu kecilkan, baca per chunk, dan tulis Parquet. Ke-35 tes memeriksa tiap fungsi secara mandiri terhadap jawaban yang dihitung dengan Python biasa, dan melarang loop per baris.

### @steps
1. Buat atau aktifkan virtual environment Anda (Modul 0.2) dan pasang requirements lab: `pip install -r labs/mod-1-5/requirements.txt`.
2. Baca bagian atas `labs/mod-1-5/orders_data.py`, tulis filenya dengan `python3 -c "from orders_data import make_orders; open('orders_raw.csv','w').write(make_orders()[0])"` (jalankan di dalam `labs/mod-1-5`), dan **jelajahi sebelum menulis kode**: `head`, `dtypes`, `isna().sum()`, `value_counts()` pada country, berapa id pesanan yang berulang. Catat temuan Anda.
3. Kerjakan `labs/mod-1-5/orders_lab.py` dari atas dan jalankan tes setelah SETIAP fungsi:

```bash
pytest labs/mod-1-5/test_lab.py -v
pytest labs/mod-1-5/test_lab.py -v -k "Load or Quality"      # satu kelompok pada satu waktu
```

4. **Muat, laporkan, bersihkan.** Sebelum menjalankan `TestClean`, perkirakan berapa baris yang akan tersisa (petunjuk: pakai laporan kualitas Anda). Setelah lulus, ubah `keep="first"` menjadi `keep="last"` dan lihat tes mana yang memperhatikannya dan mengapa.
5. **Agregasi, pivot, rank, window.** Bandingkan `revenue_by_country` dengan `GROUP BY` SQL pada data yang sama (muat ke SQLite atau DuckDB) dan pastikan angkanya sama.
6. **Join.** Hapus `validate` dari merge Anda, buat daftar pelanggan berisi duplikat dan lihat jumlah barisnya. Pasang kembali `validate`.
7. **Memori dan file.** Panggil `shrink_memory` dan cetak memori sebelum dan sesudah; tulis Parquet dan bandingkan ukuran file dengan CSV.
8. **Kerjakan yang sesungguhnya.** Tulis seluruh file lagi di virtual environment Anda sendiri **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-1-5` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-1-5/orders_lab.py :: File kerja Anda: implementasikan fungsi TODO :: starter
- labs/mod-1-5/orders_data.py :: Membuat ekspor berantakan dan daftar pelanggan (disediakan, jangan diubah) :: config
- labs/mod-1-5/test_lab.py :: Ke-35 tes :: test
- labs/mod-1-5/requirements.txt :: pandas, pyarrow, pytest :: config
- labs/mod-1-5/reference/orders_lab.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 35 tes lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri, di virtual environment Anda sendiri**
- Anda bisa menjelaskan mengapa id pelanggan harus dibaca sebagai teks, dan apa yang dilakukan `na_values` dan `errors="coerce"`
- Anda bisa menunjukkan dengan angka mengapa `apply` per baris adalah alat yang salah, dan menyebut fungsi bawaan penggantinya
- Anda bisa menjelaskan dari apa `validate="m:1"` melindungi Anda, dan apa yang terjadi pada omset di contoh fan-out (+14,1%)
- Anda bisa menyebut kapan pandas bukan lagi alat yang tepat dan apa yang dipakai sebagai gantinya

### @verify
```bash
pytest labs/mod-1-5/test_lab.py -v
python3 scripts/prove.py mod-1-5
```

Untuk menjalankan solusi yang diketahui benar, awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Join yang menggandakan omset
### @scenario
Sebuah tim analitik kecil membuat laporan omset bulanan di notebook: muat pesanan, merge daftar pelanggan untuk mendapat tier tiap pelanggan, group by tier, kirim tabelnya ke kepala keuangan. Berjalan berbulan-bulan dan totalnya cocok dengan kas toko.

Pada suatu bulan ekspor CRM yang menghasilkan daftar pelanggan diubah: pelanggan yang naik tier kini muncul di dua baris, satu untuk tiap tier yang pernah dimilikinya. Tiga puluh pelanggan terpengaruh. Tidak ada yang gagal. Merge-nya left join biasa, notebook berjalan hijau, dan tabel omsetnya tampak seperti biasa, kecuali totalnya **14% lebih tinggi** dari kas. Kepala keuangan baru menyadarinya karena perhitungan bonus kuartal didasarkan pada angka itu, dan saat itu tiga laporan bulanan sudah terkirim.

### @cause
Merge mengizinkan hubungan **many-to-many**: setiap pesanan cocok dengan dua baris pelanggan, sehingga diulang, dan omset dijumlahkan dua kali untuk pelanggan-pelanggan itu. pandas melakukan apa yang diminta dan tidak punya pendapat tentang apakah hasilnya masuk akal. Tidak ada yang memintanya memeriksa.

Faktor yang memperparah: notebook tidak punya pemeriksaan bahwa jumlah baris setelah merge sama dengan sebelumnya, "daftar pelanggan" tidak punya tes keunikan di sumbernya, dan tak seorang pun merekonsiliasi total keseluruhan dengan sistem sumber. Laporan itu bergantung pada asumsi (satu baris per pelanggan) yang benar pada hari ditulis dan tidak pernah dituliskan sebagai pemeriksaan.

### @fix
1. **Nyatakan hubungannya**: `merge(..., validate="m:1")`. Proses berikutnya akan memunculkan `MergeError` pada hari duplikat muncul, dan laporan tidak akan terkirim.
2. **Tegaskan jumlah baris** setelah setiap join (`len(out) == len(orders)`) dan tulis tes yang memberi fungsi pelanggan duplikat dan mengharapkan error (lab melakukannya).
3. **Uji keunikan di sumber**: `customer_id` harus unik di tabel pelanggan (Modul 2.5).
4. **Rekonsiliasi total** dengan sistem pencatat pada setiap proses, dan beri alert pada selisih di atas toleransi kecil.
5. **Hitung ulang laporan yang terdampak** dari join yang sudah benar dan beri tahu orang yang memakainya, lengkap dengan besar kesalahannya.
6. **Selesaikan aturan bisnisnya**: jika pelanggan memang punya beberapa tier dari waktu ke waktu, tabelnya butuh tanggal berlaku dan join point-in-time (slowly changing dimension, Modul 1.4), bukan merge polos.

### @pattern
Join adalah klaim tentang kunci. Tuliskan klaimnya (`validate=`), periksa jumlah baris, dan rekonsiliasi total dengan sumber independen, agar hasil yang salah menghentikan pipeline alih-alih sampai ke dashboard.

## @quiz
### Id pelanggan seperti `00042` dibaca oleh `pd.read_csv` dengan pengaturan default. Apa yang tersimpan, dan apa perbaikan yang tepat?
- [ ] Teks "00042", karena pandas selalu menjaga karakter persis seperti yang tertulis di dalam file
- [x] Angka 42 sehingga nol di depannya hilang; baca kolom itu sebagai teks dengan `dtype="string"`
- [ ] Sebuah tanggal, karena pandas mengubah setiap nilai lima digit menjadi datetime saat melihatnya
- [ ] Sebuah error, karena pandas menolak membaca kolom apa pun yang berawalan nol di dalam file

> pandas menebak angka untuk kolom yang hanya berisi digit. Id adalah label, bukan kuantitas, jadi deklarasikan sebagai teks; kalau tidak, join terhadap tabel yang berisi `"00042"` gagal atau salah cocok.

### Apa alasan utama memilih `df["quantity"] * df["unit_price_idr"]` daripada `df.apply(lambda row: ..., axis=1)`?
- [ ] Bentuk kolom lebih sedikit diketik, tetapi kedua bentuk berjalan dengan kecepatan yang persis sama di semua tabel
- [ ] `apply` sudah usang, sehingga ia memunculkan error begitu tabel punya lebih dari seribu baris
- [x] Satu loop terkompilasi berjalan atas seluruh kolom; ia sekitar 3.000 kali lebih cepat pada sejuta baris
- [ ] Hanya bentuk kolom yang bisa menangani nilai kosong, karena `apply` selalu gagal ketika bertemu `NaN`

> Operasi vektor berjalan di kode terkompilasi atas seluruh kolom. Fungsi Python yang dipanggil per baris adalah jalur lambat: 1,8 ms dibanding 5,7 detik untuk 1.000.000 baris.

### `pd.Series([1, None, 3]).mean()` mengembalikan 2.0. Mengapa?
- [ ] pandas mengganti nilai kosong dengan nol sebelum merata-ratakan, yang akan memberi 1,33 sebagai hasilnya
- [x] Nilai kosong dilewati, sehingga hasilnya (1 + 3) / 2, dan Anda harus menghitung berapa yang dilewati itu.
- [ ] pandas memberi peringatan dan mengembalikan median karena tidak bisa menghitung rata-rata dari data kosong
- [ ] Nilai kosong diperlakukan sebagai nilai sebelumnya, sehingga seri itu dibaca sebagai 1, 1, 3 secara default

> Sebagian besar agregasi mengabaikan `NaN`. Itu praktis, tetapi rata-rata atas kolom yang hampir kosong hanya menggambarkan baris yang ada, jadi selalu hitung nilai yang kosong.

### Mengapa `df[df["a"] > 1]["b"] = 9` tidak andal memperbarui `df`, dan apa cara menulis yang aman?
- [ ] Ia bekerja seperti yang tertulis; versi yang aman hanyalah pilihan gaya yang disukai sebagian tim
- [ ] Ia gagal karena kolom `b` adalah nama yang dicadangkan; ganti nama kolom lalu jalankan baris yang sama
- [x] Bagian pertama bisa berupa salinan, jadi perubahannya hilang; pakai `df.loc[df["a"] > 1, "b"] = 9`
- [ ] Ia mengubah seluruh kolom, bukan hanya baris yang dipilih; pakai `df["b"] = 9` untuk memperbaikinya

> Bentuk berantai meng-assign ke objek sementara. Kami menjalankannya pada pandas 2.2.3 dan 3.0.6 dan aslinya tetap tidak berubah. Satu assignment `.loc[mask, kolom]` eksplisit dan berfungsi.

### Tabel `orders` di-left-join ke tabel `customers` yang 30 pelanggannya muncul dua kali. Apa yang terjadi?
- [ ] pandas otomatis memunculkan error, karena kunci duplikat tidak pernah diizinkan dalam sebuah merge
- [ ] Duplikat dibuang diam-diam, dan jumlah baris setelah join sama dengan jumlah sebelumnya
- [x] Pesanan yang cocok diulang, sehingga baris dan omset naik tanpa error kecuali `validate` diatur
- [ ] Hanya pelanggan pertama yang cocok dipakai dan yang kedua diabaikan, sehingga totalnya tetap benar

> Inilah fan-out: 1.911 pesanan menjadi 2.187 baris dan omset naik 14,1%. `validate="m:1"` membuat pandas memunculkan `MergeError`.

### Anda harus menjumlah omset per negara dari CSV 40 GB di laptop berkapasitas memori 16 GB. Pendekatan mana yang berhasil?
- [ ] Baca seluruh file sekaligus dengan pengaturan default, karena pandas memampatkan data di memori
- [x] Baca hanya kolom yang dibutuhkan per chunk dan tambahkan jumlah parsial tiap chunk ke total berjalan
- [ ] Ubah setiap kolom menjadi `category`, yang membuat seluruh file muat dengan sendirinya di ukuran memori berapa pun
- [ ] Urutkan file lebih dulu, karena data yang terurut memakai memori lebih sedikit dari yang tidak terurut

> `usecols` ditambah `chunksize` menjaga hanya satu chunk di memori, dan jumlah bisa digabungkan antar chunk. Operasi yang butuh seluruh file (median, rank global, join besar) butuh alat lain.

### Apa yang membuat Parquet format yang lebih baik daripada CSV untuk data yang akan dibaca langkah-langkah berikutnya?
- [ ] Ia teks biasa yang bisa dibuka di editor apa pun, sehingga lebih mudah ditinjau daripada sebuah CSV
- [x] Ia menyimpan tipe dan memampatkan per kolom; pada tes kami ia 5 kali lebih kecil dan lebih cepat dibaca
- [ ] Ia satu-satunya format yang bisa ditulis pandas, sehingga setiap langkah pipeline wajib memakainya untuk ekspor
- [ ] Ia membuang baris duplikat secara otomatis, yang berarti tidak perlu langkah pembersihan sebelum menulis

> Parquet menyimpan tipe dan memampatkan per kolom, sehingga pembaca bisa melewati kolom yang tidak dibutuhkan: 9,1 MB dibanding 47,7 MB, dan 0,03 detik dibanding 0,27 untuk dua kolom.

### Anda mendeduplikasi file besar dengan memanggil `drop_duplicates` pada tiap chunk secara terpisah. Apa risikonya?
- [ ] Tidak ada; hasilnya selalu identik dengan mendeduplikasi seluruh file sekaligus, apa pun urutannya
- [ ] pandas menolak menjalankan `drop_duplicates` pada sebuah chunk, sehingga panggilannya langsung error
- [x] Duplikat di chunk berbeda tidak pernah dibandingkan, sehingga sebagian salinan lolos ke tabel keluaran
- [ ] Chunk digabung kembali dalam urutan acak, sehingga salinan pertama yang disimpan berbeda di setiap proses

> Deduplikasi butuh seluruh ruang kunci. Chunking aman untuk jumlah, hitungan, dan hasil lain yang bisa digabung, bukan untuk operasi global; pakai database atau pendekatan dua tahap untuk itu.

## @resources
- [pandas: 10 minutes to pandas](https://pandas.pydata.org/docs/user_guide/10min.html)
- [pandas: merge, join, concatenate (lihat `validate`)](https://pandas.pydata.org/docs/user_guide/merging.html)
- [pandas: group by (split, apply, combine)](https://pandas.pydata.org/docs/user_guide/groupby.html)
- [pandas: scaling to large datasets](https://pandas.pydata.org/docs/user_guide/scale.html)
- [pandas: copy-on-write](https://pandas.pydata.org/docs/user_guide/copy_on_write.html)
- [Dokumentasi Apache Parquet](https://parquet.apache.org/docs/)
