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

## @part Memuat dan membersihkan

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

> 🛠 **Coba sendiri (10 menit, Python).** Dengan virtual environment Anda aktif, jalankan `pip install pandas`. Muat `data/orders.csv` dengan `pd.read_csv`. Cetak `df.shape` dan `df.dtypes`. Terjemahkan tiga query SQL ke pandas: `SELECT COUNT(*) FROM orders`, `SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY 2 DESC`, dan jumlah baris dengan `WHERE status = 'delivered'`. Lalu ulangi hitungan status setelah `df["status"].str.strip().str.lower()` dan bandingkan.
>
> **Seharusnya Anda melihat:** `(3634, 6)`; hitungan status mentah yang memuat varian seperti `DELIVERED`, tepat `2080` baris `delivered` pada hitungan yang persis sama, dan setelah huruf kecil lima status: `delivered 2148`, `shipped 576`, `paid 374`, `cancelled 362`, `refunded 174`.

:::ask Mengapa pengguna pandas hampir tidak pernah menulis `for` loop atas baris?
@options
* panggilan kolom di kode terkompilasi
pandas melarang loop dalam bentuk apa pun
loop memberi jawaban berbeda dari kolom
@why
`df['quantity'] * df['unit_price_idr']` mengalikan sejuta pasang dalam satu panggilan, dalam kode terkompilasi. Loop Python membayar overhead interpreter pada setiap baris.
:::

## @lesson Memuat file dengan benar
:::talk Apa yang terjadi pada 00042?
@teacher File pelanggan KopiKu punya sebuah id yang tertulis `00042`. Seorang pembelajar memuat file itu dengan `pd.read_csv("customers.csv")` dan mencetak id pelanggan tersebut.
@ask Apa yang ditampilkan pandas untuk id itu?
@choice `00042`, karena pandas mempertahankan karakternya persis seperti tertulis | pandas tidak sekadar menyalin karakter. Ia melihat kolom penuh angka dan menebak "ini bilangan". Coba lagi.
@choice Error, karena id diawali angka nol | Tidak ada error, dan itulah masalahnya: tidak ada yang mengeluh. Coba lagi.
@choice * `42`: pandas menebak bilangan, dan angka nol di depan hilang | Betul. Kolom berisi angka tampak seperti bilangan, jadi pandas menyimpan 42. Join dengan tabel yang masih berisi `"00042"` lalu tidak menemukan pasangan, diam-diam.
@teacher Id adalah label, bukan kuantitas: tidak ada yang menjumlahkan dua id pelanggan. Beri tahu pandas, dengan `dtype="string"` untuk kolom id.
:::

`pd.read_csv("orders.csv")` bekerja pada file bersih dan diam-diam merusak file yang berantakan. File tidak punya tipe; pandas **menebak**, dan tebakan itulah yang menimbulkan masalah. Empat hal yang harus Anda tentukan sendiri:

1. **Id adalah teks, bukan angka.** Id pelanggan seperti `00042` adalah label, bukan kuantitas. Jika dibaca sebagai angka, pandas menyimpan `42`: angka nol di depan hilang, dan join terhadap tabel pelanggan (yang berisi `"00042"`) gagal atau, lebih buruk, cocok dengan baris yang salah. Pada file pesanan berantakan kita, id pelanggan pertama yang terbaca secara default adalah `211` alih-alih `00211`, dan merge atasnya memunculkan `ValueError: You are trying to merge on int64 and str columns`. Perbaikan: `dtype={"customer_id": "string"}`.
2. **Penanda kosong.** pandas sudah menganggap sel kosong, `NA`, `N/A`, dan `null` sebagai kosong, tetapi file Anda mungkin memakai `-` atau `unknown`. Beri tahu: `na_values=["-"]`. Kalau tidak, satu `-` mengubah seluruh kolom harga menjadi teks.
3. **Integer yang bisa kosong.** Kolom `int64` biasa tidak bisa menyimpan nilai kosong, jadi satu sel kosong diam-diam mengubah seluruh kolom menjadi float (`3.0`). Tipe integer nullable `"Int64"` (I besar) menjaga integer dan menampilkan `<NA>`.
4. **Tanggal di-parse, dan kegagalan ditangani dengan sengaja.** `pd.to_datetime(col, format="%Y-%m-%d", errors="coerce")` mengubah teks menjadi datetime sungguhan dan mengubah apa pun yang bukan tanggal (`"yesterday"`, `"2026-02-30"`, sel kosong) menjadi `NaT` ("not a time"), alih-alih membuat job malam crash atau, lebih buruk, menebak.

Berguna juga saat membaca file besar: `usecols=[...]` hanya memuat kolom yang dibutuhkan, `nrows=1000` untuk pratinjau, dan `encoding="utf-8"` sebaiknya disebut terang-terangan (Modul 0.0).

**Profil sebelum membersihkan.** Di lab Anda menulis `data_quality_report`, yang menghitung baris, null per kolom, dan id yang berulang. Untuk ekspor 2.080 baris itu, ia menemukan **80 id pesanan berulang, 25 tanggal tak terpakai, 37 kuantitas kosong, dan 30 harga kosong**. Itu 4% baris berulang dan sekitar 5% tak terpakai, wajar untuk ekspor sungguhan dan itulah alasan langkah ini ada. Pipeline yang tidak menghitung apa yang dibuangnya tidak bisa menjelaskan nanti mengapa sebuah total berubah. Simpan hitungan seperti ini: itulah metrik kualitas data pertama Anda (Modul 2.5).

`NaN` perlu dibahas sebentar. Di pandas angka kosong adalah `NaN` (dan tanggal kosong `NaT`), dan sebagian besar agregasi **melewatinya**: `pd.Series([1, None, 3]).sum()` adalah 4.0 dan `.mean()` adalah 2.0, bukan 1.33. Biasanya itu yang Anda inginkan dan kadang jebakan: rata-rata atas kolom yang 30% kosong menggambarkan 70% sisanya. Selalu tahu berapa banyak yang kosong ketika Anda menyebut sebuah angka.

### File Excel berantakan (.xlsx)

Tim keuangan dan operasional jarang mengirim CSV yang rapi, mereka mengirim file `.xlsx` dengan judul perusahaan di tiga baris pertama, banyak tab, sel yang digabung (*merged cells*), dan baris penutup `"GRAND TOTAL"` di paling bawah. Pakai `pd.read_excel` (membutuhkan paket `openpyxl`) dengan batas yang eksplisit:

```python
budget = pd.read_excel(
    "monthly_targets.xlsx",
    sheet_name="Q1_Sales",
    skiprows=3,
    dtype={"branch_id": "string"},
)
```

Selalu periksa `budget.head()` **dan** `budget.tail()` agar baris ringkasan `"TOTAL"` tidak ikut dijumlahkan bersama cabang asli. Ubah `.xlsx` ke Parquet sekali saja di gerbang ingesti agar pipeline hilir tidak pernah membaca spreadsheet lagi.

:::ask Sebuah id pelanggan adalah `00042` di tabel pelanggan. Anda membaca file pesanan dengan `pd.read_csv` bawaan (tanpa `dtype`). Seperti apa id itu di `orders`?
@options
`"00042"`: pandas menyimpannya persis seperti tertulis
* `42`: pandas menebak angka, nolnya hilang
`NaN`: pandas tidak bisa membaca nol di depan
@why
Sebuah file tidak punya tipe dan pandas **menebak**. Id adalah label, bukan kuantitas: baca sebagai teks dengan `dtype={"customer_id": "string"}` (atau `str`).
:::

:::ask Apa yang dikembalikan `pd.Series([1, None, 3]).mean()`?
@options
1.33, karena nilai yang hilang dihitung sebagai 0
sebuah error
* 2.0, karena nilai yang hilang dilewati
@why
Sebagian besar agregasi pandas **melewati** `NaN`: rata-ratanya (1 + 3) / 2 = 2.0. Itu biasanya yang Anda inginkan dan kadang jebakan: rata-rata atas kolom yang 30% hilang menggambarkan 70% lainnya. Selalu tahu berapa nilai yang hilang saat Anda menyebut sebuah angka.
:::

> 💡 **Jeda Praktik 1 (Memuat Data & Laporan Kualitas Data):**
> Mulai bangun modul analitik data dengan pemuatan tipe yang presisi:
> 1. Pastikan virtual environment Anda aktif dan pasang dependensi lab (`pip install -r labs/mod-1-5/requirements.txt`), lalu buka file `labs/mod-1-5/orders_lab.py` di Text Editor Anda (ingat: jangan dieksekusi langsung di bash!).
> 2. Implementasikan fungsi `load_orders(source)` dengan parameter tipe ketat (`dtype={"order_id": "string", "customer_id": "string"}`, integer nullable `"Int64"` untuk quantity, `na_values=["-"]` agar unit_price_idr menjadi float64 NaN, dan `pd.to_datetime` dengan `errors="coerce"`).
> 3. Implementasikan fungsi `data_quality_report(df)` yang menghitung jumlah total baris, jumlah null per kolom, dan jumlah id pesanan duplikat.
> 4. Uji di terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestLoad or TestQualityReport" -v`
> Ketika tes PASSED, lanjut ke Pelajaran 3 untuk pembersihan data secara vektor!

## @lesson Membersihkan dengan operasi seluruh kolom
Pembersihan adalah daftar pendek langkah yang berulang. Masing-masing punya bentuk vektornya:

- **Teks**: accessor `.str` menerapkan metode string ke setiap nilai: `df["country"].str.strip().str.upper()`. Pada ekspor kita negara muncul sebagai `" id"`, `"Id"`, `"ID "`, dan `"ID"`; setelah satu baris hanya ada satu nilai.
- **Tanggal**: accessor `.dt`: `df["order_date"].dt.strftime("%Y-%m")`, `.dt.month`, `.dt.day_name()`.
- **Duplikat**: `df.drop_duplicates(subset="order_id", keep="first")`. Tentukan **kuncinya** (id pesanan, bukan seluruh baris) dan salinan mana yang menang.
- **Kosong**: `df.dropna(subset=[...])` untuk membuang baris yang tak terpakai bagi tujuan Anda, atau `fillna(value)` untuk memberi nilai default. Membuang adalah keputusan tentang data, jadi hitung apa yang Anda buang.
- **Menyaring**: boolean mask, `df[df["status"] == "paid"]`; gabungkan mask dengan `&`, `|`, `~` dan kurung: `df[(df["status"] == "paid") & (df["quantity"] > 1)]`.
- **Kolom baru**: `df.assign(revenue_idr=df["quantity"] * df["unit_price_idr"])`.
- **Tipe**: `astype("int64")`, `pd.to_numeric(..., errors="coerce")`.

:::talk Sejuta baris
@teacher Anda punya 1.000.000 pesanan dan ingin pendapatan setiap baris: jumlah dikali harga satuan. Seorang pembelajar menulis loop yang mengunjungi setiap baris lalu mengalikan. Yang lain menulis `df["quantity"] * df["unit_price_idr"]`.
@ask Mana yang lebih cepat, dan kira-kira berapa kali lipat?
@choice Loop, karena sederhana dan mengerjakan satu hal setiap kali | Loop Python menjalankan satu langkah setiap kali di dalam Python, itulah cara yang lambat. Coba lagi.
@choice * Versi kolom, lebih dari seribu kali lipat: satu loop terkompilasi berjalan atas seluruh kolom | Betul. Python dipanggil sekali, bukan sejuta kali. Pada pengukuran di pelajaran, hasilnya milidetik melawan detik.
@choice Hampir sama, karena keduanya melakukan perkalian yang sama | Hitungannya sama, tetapi mesinnya tidak. Coba lagi.
@teacher Jadi di pandas, berpikirlah dalam kolom utuh. Saat Anda menulis loop atas baris, atau `apply` dengan `axis=1`, tanyakan apakah satu operasi kolom bisa mengerjakannya.
:::

**Mengapa bukan `apply`?** `df.apply(lambda row: row["quantity"] * row["unit_price_idr"], axis=1)` memberi jawaban yang benar dan begitulah banyak tutorial menulisnya. Kami mengukurnya pada tabel **1.000.000 baris**: perkalian kolom memakan **1,8 milidetik**, `apply` per baris memakan **5,7 detik**, sekitar **3.100 kali lebih lambat** (mesin Anda akan mengukur angka lain, tetapi selisihnya tetap di atas seribu kali), dan loop `itertuples` biasa atas hanya 200.000 baris memakan 0,9 detik. Loop menjalankan kode Python sejuta kali; operasi kolom menjalankan satu loop yang sudah dikompilasi. Ketika Anda tergoda menulis `apply`, cari fungsi bawaan: `.str`, `.dt`, `np.where` (setelah `import numpy as np`, untuk if-else vektor), `clip`, `map` dengan dictionary, `groupby`. Tes lab melarang `apply`, `iterrows`, dan `itertuples` di tempat jawaban vektor tersedia, agar kebiasaan itu terbentuk.

**Jangan merantai assignment.** `df[df["a"] > 1]["b"] = 9` tampak memperbarui baris, tetapi bagian pertama mengembalikan salinan (mungkin sementara), sehingga assignment-nya hilang. Kami menjalankannya pada pandas 2.2.3 dan 3.0.6: `df["b"]` tetap `[0, 0, 0]` dan pandas memberi peringatan. Tulis dalam satu langkah: `df.loc[df["a"] > 1, "b"] = 9`. Lebih baik lagi, hindari mengedit dan bangun frame baru, itulah sebabnya fungsi di lab mengembalikan frame baru dan membiarkan inputnya (tes memeriksanya).

Aturan terakhir: **pembersihan adalah sebuah fungsi**. `clean_orders(raw) -> clean`, fungsi murni dari satu frame ke frame lain, bisa diuji dengan frame lima baris, dijalankan lagi pada file besok, dan dibaca rekan kerja. Notebook dengan empat puluh sel yang harus dijalankan dalam urutan yang benar tidak bisa.

### Zona waktu dan resampling deret waktu

**Mengapa:** server aplikasi mencatat pesanan kopi Jakarta pada `"2026-01-31 18:30:00"` dalam **UTC** (waktu universal). Dalam **WIB (`UTC+7`, `Asia/Jakarta`)**, pesanan itu terjadi pada `"2026-02-01 01:30:00"`, **Februari**, bukan Januari. Memperlakukan timestamp UTC sebagai tanggal lokal diam-diam menggeser pesanan malam ke bulan yang salah dan merusak rekonsiliasi keuangan.

Dua aturan mencegah hampir semua bug zona waktu:
1. **Simpan timestamp dalam UTC di dalam sistem (`utc=True`),** lalu ubah ke **zona waktu** bisnis (`dt.tz_convert("Asia/Jakarta")`) hanya saat mengelompokkan hari bisnis atau pelaporan. Jika timestamp masuk belum punya zona waktu (**naive**), pasang zona sumber aslinya dulu dengan `dt.tz_localize("UTC")` (jangan menebak).
2. **Pakai `resample` untuk deret waktu berkesinambungan:** `groupby("date")` biasa diam-diam melewati hari tanpa pesanan. Menjadikan timestamp sebagai index lalu menjalankan `df.set_index("order_ts").resample("D")["revenue_idr"].sum().fillna(0)` (**resampling**) menjamin satu baris untuk setiap hari kalender (dan berlaku juga untuk per jam `"h"` atau per minggu `"W"`).

Lihat bagaimana timestamp UTC melewati tengah malam ke hari berikutnya di WIB:

:::trace Tengah malam UTC menjadi besok di WIB
@code
from datetime import datetime, timedelta, timezone

wib = timezone(timedelta(hours=7))
utc_ts = datetime(2026, 1, 31, 18, 30, tzinfo=timezone.utc)
wib_ts = utc_ts.astimezone(wib)
print(utc_ts.date(), "->", wib_ts.date())
@notes
3 | WIB (`Asia/Jakarta`) tetap di `UTC+7` (tanpa pergantian daylight saving).
4 | Server mencatat pesanan ini dalam UTC pada 31 Januari pukul 18:30.
5 | Konversi ke WIB memajukan jam 7 jam ke `2026-02-01 01:30`.
6 | Tanggal UTC masih Januari, tetapi tanggal bisnis Indonesia sudah Februari!
:::

:::ask Sebuah pesanan dicatat pada `2026-01-31 18:00:00 UTC`. Tanggal bisnis WIB (`UTC+7`) manakah yang benar?
@options
`2026-01-31`: tanggal kalender tidak pernah berubah
* `2026-02-01`: menambah 7 jam melewati tengah malam
`2026-01-30`: WIB tertinggal tujuh jam dari UTC
@why
WIB (`Asia/Jakarta`) adalah `UTC+7`. Menambah 7 jam pada pukul `18:00` tanggal 31 Januari menghasilkan `01:00` tanggal **1 Februari** (`2026-02-01`). Menyimpan UTC lalu mengonversi secara eksplisit menghindari selisih tutup buku akhir bulan.
:::

Untuk mengurai string timestamp ISO di Python biasa (termasuk yang berakhiran `"Z"` untuk UTC), gunakan `datetime.fromisoformat(s.replace("Z", "+00:00"))`, lalu konversi dengan `.astimezone(...)` dan format dengan `.strftime("%Y-%m-%d")`.

:::drill python Ubah timestamp UTC menjadi tanggal bisnis WIB
Tulis `wib_date(iso_utc)`: `iso_utc` adalah string timestamp ISO dalam UTC seperti `"2026-01-31T18:30:00Z"` atau `"2026-01-31T10:00:00+00:00"`. Ubah ke WIB (`UTC+7`) dan kembalikan tanggalnya dalam format `"YYYY-MM-DD"`.
@starter
from datetime import datetime, timedelta, timezone

# tulis fungsi Anda di bawah baris ini

@check
defines("wib_date") ## Definisikan wib_date(iso_utc).
wib_date("2026-01-31T18:30:00Z") == "2026-02-01" ## 18:30 UTC + 7 jam melewati tengah malam ke 1 Februari WIB.
wib_date("2026-01-31T10:00:00+00:00") == "2026-01-31" ## 10:00 UTC + 7 jam adalah 17:00 WIB di hari yang sama.
wib_date("2026-03-01T17:00:00Z") == "2026-03-02" ## Tepat 17:00 UTC adalah pukul 00:00 hari berikutnya di WIB.
@hint
Urai string ISO menjadi datetime UTC (ingat `"Z"` berarti `"+00:00"`), konversi ke zona waktu tetap `+7` jam, lalu format tanggal hasilnya sebagai `"YYYY-MM-DD"`.
@solution
from datetime import datetime, timedelta, timezone

def wib_date(iso_utc):
    dt = datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
    wib = timezone(timedelta(hours=7))
    return dt.astimezone(wib).strftime("%Y-%m-%d")
:::

:::ask Apa yang terjadi pada `df[df["a"] > 1]["b"] = 9`?
@options
* perubahan masuk ke salinan sementara dan hilang
ia mengisi `b` dengan 9 di mana `a > 1`, seperti yang dimaksud
ia memunculkan error dan menghentikan skrip
@why
Bagian pertama (`df[df["a"] > 1]`) mengembalikan salinan yang mungkin sementara, sehingga penugasan tidak pernah sampai ke `df`. Tulis dalam satu langkah: `df.loc[df["a"] > 1, "b"] = 9`.
:::

:::ask Anda butuh `quantity * unit_price` untuk 1.000.000 baris. Mana alat yang tepat?
@options
`df.apply(lambda row: row["quantity"] * row["unit_price"], axis=1)`
loop `for` pada `df.iterrows()`
* `df["quantity"] * df["unit_price"]`, operasi seluruh kolom
@why
Operasi seluruh kolom (vectorised) berjalan di kode yang dikompilasi. Kursus mengukur perkalian kolom 1,8 milidetik melawan 5,7 detik untuk `apply` baris demi baris: sekitar 3.100 kali lebih lambat di mesin itu (di laptop terbaru kami mendapat sekitar 1.400 kali, jadi harapkan selisih lebih dari seribu kali).
:::

> 💡 **Jeda Praktik 2 (Pembersihan Vektor Tanpa Apply):**
> Bersihkan data secara efisien tanpa loop python atau method apply:
> 1. Di `labs/mod-1-5/orders_lab.py` pada text editor, implementasikan 3 fungsi pembersihan:
>    - `clean_orders(df)`: standarisasi teks dengan accessor `.str.strip()` dan casing, buang duplikat dengan `drop_duplicates(subset="order_id", keep="first")`, buang nilai kosong dengan `dropna`, ubah quantity ke `int64`, dan reset index.
>    - `paid_only(df)`: filter hanya baris dengan status `"paid"` menggunakan boolean mask dan reset index.
>    - `add_revenue(df)`: tambahkan kolom `revenue_idr = quantity * unit_price_idr` pada salinan DataFrame.
> 2. Uji di terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestClean or TestPaidAndRevenue" -v`
> Ketika tes PASSED, lanjut ke Pelajaran 4 untuk agregasi, pivot, dan ranking!

## @part Menggabungkan dan membesarkan skala

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

:::talk Ke mana pelanggan tanpa kota pergi?
@teacher Pada tabel pesanan kecil, total pendapatan adalah 250 (ribu rupiah), dan 70 di antaranya milik pelanggan yang `city`-nya hilang. Anda menjalankan `df.groupby("city")["revenue"].sum()` dan menjumlahkan hasilnya.
@ask Total berapa yang Anda dapat, dibandingkan dengan total sebenarnya?
@choice Total sebenarnya: setiap baris termasuk ke suatu kelompok | Nilai yang hilang bukan kelompok, menurut pandas secara bawaan. Coba lagi.
@choice * Kurang dari total sebenarnya: secara bawaan `groupby` membuang baris yang kuncinya hilang, sehingga pendapatannya lenyap diam-diam | Betul. Pada contoh mini di pelajaran, kelompok-kelompok itu berjumlah 180, bukan 250. Berikan `dropna=False` untuk menyimpan satu kelompok bagi kota yang hilang, dan bandingkan total dengan sumber.
@choice Error, karena `city` punya nilai hilang | Tidak ada error, dan itulah mengapa ia berbahaya. Coba lagi.
@teacher Setelah `groupby`, jumlahkan kelompok-kelompoknya dan bandingkan dengan total seluruh tabel. Selisih berarti ada baris yang jatuh.
:::

**Pivot table** mengubah nilai satu kolom menjadi kolom: omset per bulan (baris) dan negara (kolom). `pivot_table(index=..., columns=..., values=..., aggfunc="sum", fill_value=0)` melakukannya. `fill_value=0` penting: bulan tanpa penjualan di suatu negara akan menjadi `NaN`, yang diperlakukan grafik dan penjumlahan berikutnya berbeda dari nol. Apakah "tidak ada penjualan" itu nol atau tidak diketahui? Putuskan, lalu tuliskan.

### Membongkar tabel lebar (unpivot): pd.melt()

**Mengapa:** spreadsheet buatan manusia sering datang dalam bentuk **lebar** (*wide*): satu kolom per bulan (`branch | Jan | Feb | Mar`). SQL dan dbt sulit menyaring atau menjumlahkan lintas bulan jika setiap bulan adalah nama kolom terpisah. **`melt`** (**unpivot**) melakukan kebalikan persis dari `pivot_table`, mengubah kolom lebar kembali menjadi baris panjang rapi (`branch | month | revenue_idr`):

```python
long_df = pd.melt(
    wide_df,
    id_vars=["branch"],
    var_name="month",
    value_name="revenue_idr",
)
```

:::drill python Unpivot spreadsheet lebar
Inilah yang dilakukan `pd.melt()` di balik layar. Tulis `unpivot(rows, id_col)`: `rows` adalah daftar dictionary lebar (setiap key selain `id_col` adalah kolom bulan). Kembalikan list berisi dictionary panjang `{id_col: ..., "month": ..., "value": ...}` sesuai urutan masukan.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("unpivot") ## Definisikan unpivot(rows, id_col).
unpivot([{"branch": "JKT", "Jan": 10, "Feb": 20}], "branch") == [{"branch": "JKT", "month": "Jan", "value": 10}, {"branch": "JKT", "month": "Feb", "value": 20}] ## Satu baris lebar menjadi satu baris panjang per kolom bulan.
unpivot([{"store": "BDG", "Q1": 5}], "store") == [{"store": "BDG", "month": "Q1", "value": 5}] ## Berlaku untuk nama id_col apa pun.
unpivot([], "branch") == [] ## Masukan kosong mengembalikan list kosong.
@hint
Gunakan loop bersarang: untuk setiap dictionary di `rows`, telusuri pasangan key-value-nya dan buat dictionary baru berisi 3 key (`id_col`, `"month"`, `"value"`) untuk setiap key yang bukan `id_col`.
@solution
def unpivot(rows, id_col):
    out = []
    for row in rows:
        for k, v in row.items():
            if k != id_col:
                out.append({id_col: row[id_col], "month": k, "value": v})
    return out
:::

**Window tanpa fungsi window.** `ROW_NUMBER`, total berjalan, dan `LAG` di SQL punya padanan langsung setelah Anda mengurutkan dan mengelompokkan:

```python
out = df.sort_values(["customer_id", "order_date", "order_id"])
by_customer = out.groupby("customer_id")
out["order_number"] = by_customer.cumcount() + 1                 # 1, 2, 3 ... per customer
out["customer_revenue_to_date"] = by_customer["revenue_idr"].cumsum()  # running total
out["days_since_previous"] = by_customer["order_date"].diff().dt.days   # LAG-style gap
```

Pengurutan datang lebih dulu dan **menyertakan pemutus seri** (`order_id`) membuat hasilnya sama setiap kali, yang dibutuhkan sebuah tes. **Top N per kelompok** adalah gagasan yang sama: urutkan menurut nilai menurun di dalam tiap kelompok, lalu simpan baris yang `cumcount() + 1`-nya paling banyak N. Seri butuh aturan (di lab, nama produk A sampai Z), kalau tidak dua proses pada data yang sama bisa berbeda.

Periksa agregat Anda terhadap perhitungan independen. Tes lab menghitung ulang setiap total dengan Python biasa atas baris yang benar lalu membandingkannya; dalam kerja Anda sendiri, periksa satu kelompok dengan tangan dan bandingkan total keseluruhan dengan sumbernya (Modul 2.5). `groupby` yang diam-diam membuang baris dengan kunci kosong (`groupby` melewati kunci `NaN` secara default) adalah cara klasik meleset beberapa persen tanpa disadari.

> 💡 **Jeda Praktik 3 (Agregasi, Pivot, & Window History):**
> Bangun ringkasan analitik dan metrik historis pelanggan:
> 1. Di `labs/mod-1-5/orders_lab.py` pada text editor, implementasikan 4 fungsi analitik:
>    - `revenue_by_country(df)`: named aggregation `groupby` (`nunique`, `sum`, `mean`) diurutkan berdasarkan revenue terbesar.
>    - `monthly_revenue(df)`: pivot table dengan indeks format `"YYYY-MM"` dan `fill_value=0`.
>    - `top_products_per_country(df, n=2)`: ambil N produk terlaris per negara dengan pemutus seri alfabet nama produk.
>    - `add_customer_history(df)`: hitung urutan pesanan per pelanggan (`cumcount() + 1`), total berjalan kumulatif (`cumsum()`), dan selisih hari (`diff().dt.days`).
> 2. Uji di terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestAggregate or TestPivot or TestTopN or TestWindow" -v`
> Ketika tes PASSED, lanjut ke Pelajaran 5 tentang penggabungan tabel defensif!

:::drill python Total per kelompok
Inilah yang dilakukan `groupby(...).sum()`. Tulis `group_sum(rows, key, value)`: `rows` adalah daftar dictionary; kembalikan dictionary yang memetakan tiap nilai field `key` ke **jumlah** field `value` atas barisnya.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("group_sum") ## Definisikan group_sum(rows, key, value).
group_sum([{"c": "ID", "r": 10}, {"c": "SG", "r": 5}, {"c": "ID", "r": 7}], "c", "r") == {"ID": 17, "SG": 5} ## Baris dengan negara sama dijumlahkan.
group_sum([], "c", "r") == {} ## Tanpa baris, tanpa kelompok.
group_sum([{"s": "a", "n": 1}], "s", "n") == {"a": 1} ## Berlaku untuk nama field apa pun.
@hint
Simpan dictionary total: `totals[row[key]] = totals.get(row[key], 0) + row[value]`.
@solution
def group_sum(rows, key, value):
    totals = {}
    for row in rows:
        totals[row[key]] = totals.get(row[key], 0) + row[value]
    return totals
:::

:::ask Sebuah kolom punya 10 baris, 2 di antaranya kosong. Apa yang dikembalikan `count` dan `size` pada groupby pandas?
@options
keduanya memberi 10, karena keduanya sama saja
* count memberi 8 (tak kosong), size memberi 10 (baris)
count memberi 10 dan size memberi 8
@why
`count` melewati nilai kosong dan `size` menghitung baris. Keduanya berbeda saat ada celah, jadi pilih dengan sengaja. `nunique` adalah `COUNT(DISTINCT ...)`.
:::

## @lesson Menggabungkan tabel tanpa melipatgandakan baris
`orders.merge(customers, on="customer_id", how="left")` adalah `LEFT JOIN`. Argumen `how` memilih `inner`, `left`, `right`, atau `outer`, persis seperti di SQL (Modul 0.3), dan jebakan yang sama berlaku: **fan-out**. Jika tabel kanan punya kunci yang sama dua kali, setiap baris kiri yang cocok diulang.

:::talk Pelanggan yang muncul dua kali
@teacher Tabel pelanggan seharusnya berisi satu baris per pelanggan, tetapi pemuatan yang buruk menyisakan 30 pelanggan muncul dua kali. Sekarang Anda melakukan left join 1.911 pesanan ke tabel itu.
@ask Apa yang Anda dapatkan?
@choice * Lebih banyak baris daripada pesanan: setiap pesanan milik pelanggan ganda muncul dua kali, dan pendapatan membesar | Betul. Tanpa error, tanpa peringatan, hanya angka pendapatan yang lebih besar. Pelajaran mengukur 1.911 pesanan menjadi 2.187 baris.
@choice Error, karena kunci ganda tidak boleh ada dalam join | pandas tidak menghentikan Anda dengan sendirinya. Coba lagi.
@choice Tetap 1.911 baris, karena pandas membuang duplikatnya | pandas tidak pernah membuangnya diam-diam. Coba lagi.
@teacher Minta pandas memeriksanya untuk Anda: `validate="m:1"` berarti "banyak pesanan ke SATU pelanggan" dan memunculkan error jika tabel pelanggan berisi duplikat.
:::

Kami mengukurnya pada pesanan yang sudah bersih: 1.911 pesanan dan daftar pelanggan yang 30 pelanggannya tanpa sengaja tercantum dua kali. Left join mengembalikan **2.187 baris** alih-alih 1.911, dan kolom omset berjumlah **378.380.000 alih-alih 331.555.000**, kelebihan **14,1%**, tanpa error dan dengan hasil yang tampak sangat masuk akal. Dashboard yang dibangun di atasnya akan salah dan tak seorang pun tahu sebabnya.

[[diagram:dupkey]]

Pertahanannya satu argumen: **`validate="m:1"`** ("banyak pesanan ke satu pelanggan"). Sekarang pandas memeriksa kunci di tabel kanan dan memunculkan `MergeError` begitu ada kunci yang berulang. Pakai `validate` di setiap merge yang Anda tulis: `"1:1"`, `"m:1"`, atau `"1:m"`, mana pun yang Anda yakini benar. Ia mengubah asumsi menjadi tes. Bandingkan juga `len()` sebelum dan sesudah.

Kebiasaan join lain:

- **Temukan baris yang tidak cocok (anti-join).** Pesanan kita menyebut 20 id pelanggan yang tidak ada di daftar pelanggan (`00201` sampai `00220`). `set(orders["customer_id"]) - set(customers["customer_id"])` menemukannya; atau `merge(..., how="left", indicator=True)` menambah kolom `_merge` yang menampilkan baris `left_only`. Data yatim (orphan) adalah temuan kualitas data untuk dilaporkan, bukan untuk disembunyikan.
- **Isi dengan sengaja.** Setelah join, pesanan tanpa pelanggan punya `NaN` di `tier`. Di lab mereka menjadi `"unknown"`, kategori yang terlihat, alih-alih diam-diam hilang dari `groupby` berikutnya (yang melewati kunci kosong).
- **Tipe kunci sama di kedua sisi.** Masalah int versus teks dari pelajaran 2 muncul di sini sebagai error; dengan dua kolom teks yang berbeda spasi atau huruf besar-kecil ia muncul sebagai *nol kecocokan* tanpa error. Periksa tingkat kecocokan segera setelah join.
- **Nama kolom berbeda**: `left_on="cust"`, `right_on="customer_id"`. **Nama sama untuk kolom lain** mendapat akhiran `_x`/`_y`: pilih akhiran eksplisit dengan `suffixes=`.
- **`concat`** menumpuk tabel dengan kolom sama (beberapa file harian menjadi satu). Pastikan kolomnya sejajar dan reset index.

Alat berguna terakhir adalah `pd.testing.assert_frame_equal(actual, expected)`: ia membandingkan dua frame dan memberi tahu persis apa yang berbeda. Begitulah tes di lab bekerja, dan begitulah seharusnya Anda menguji transformasi Anda sendiri.

:::ask Tabel pelanggan mencantumkan 30 pelanggan dua kali karena kesalahan. Anda menjalankan `orders.merge(customers, on="customer_id", how="left")` pada 1.911 pesanan. Apa yang Anda dapat?
@options
* lebih dari 1.911 baris: duplikat mengulang pesanan, tanpa error
1.911 baris: left join mempertahankan ukuran kiri
error dimunculkan karena key berulang
@why
Ini jebakan fan-out dari SQL. Kursus mengukur 2.187 baris dan pendapatan 14,1% terlalu tinggi. Pertahanannya satu argumen, `validate="m:1"`, yang memunculkan `MergeError` begitu sebuah key berulang di sisi kanan.
:::

> 💡 **Jeda Praktik 4 (Join Defensif & Anti-Join Deteksi Data Yatim (Orphan)):**
> Gabungkan dataset secara aman tanpa risiko fan-out pengganda omset:
> 1. Di `labs/mod-1-5/orders_lab.py` pada text editor, implementasikan 2 fungsi penggabungan:
>    - `join_customers(orders, customers)`: left join ke tabel pelanggan dengan `validate="m:1"` untuk mencegah duplikasi baris, serta isi tier yang tidak ditemukan dengan `"unknown"`.
>    - `orphan_customer_ids(orders, customers)`: temukan id pelanggan yang ada di tabel orders tetapi tidak terdaftar di customers (anti-join).
> 2. Uji di terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestJoin" -v`
> Ketika tes PASSED, integritas join Anda terjamin aman! Lanjut ke Pelajaran 6 untuk optimasi memori dan format Parquet.

:::drill python Berapa baris setelah join?
Inner join menghasilkan satu baris keluaran untuk **setiap pasangan yang cocok**. Tulis `rows_after_join(left_keys, right_keys)`: keduanya adalah daftar kunci (satu kunci per baris). Kembalikan berapa baris yang dihasilkan inner join pada kunci itu.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("rows_after_join") ## Definisikan rows_after_join(left_keys, right_keys).
rows_after_join([1, 2, 3], [1, 2, 3]) == 3 ## Kunci unik di kedua sisi: satu baris per kunci.
rows_after_join([1, 2], [1, 1, 2]) == 3 ## Kunci 1 muncul dua kali di kanan: baris kirinya berulang, 2 + 1 baris.
rows_after_join([1, 1], [1, 1]) == 4 ## 2 × 2 pasangan cocok: duplikat berlipat.
rows_after_join([1, 2], [9]) == 0 ## Tidak ada kunci yang cocok.
@hint
Untuk tiap kunci di kiri, hitung berapa kali ia muncul di kanan: `right_keys.count(k)`, lalu jumlahkan.
@solution
def rows_after_join(left_keys, right_keys):
    return sum(right_keys.count(k) for k in left_keys)
:::

## @lesson Memori, chunk, dan Parquet
pandas menyimpan seluruh tabel di RAM. Berapa banyak RAM? Lebih dari ukuran file. Kami membuat tabel pesanan **1.000.000 baris** (CSV **47,7 MB**) dan membacanya dengan pengaturan default: pada pandas 3.0.6 ia menempati **83 MB** di memori (1,75 kali file), dan pada pandas 2.2.3 **247 MB, 5,2 kali file**, karena pandas lama menyimpan setiap nilai teks sebagai objek Python tersendiri. Aturan praktis: **rencanakan 2 sampai 10 kali ukuran file**, ukur dengan `df.memory_usage(deep=True).sum()`, dan periksa sebelum membaca ekspor 20 GB di laptop 16 GB.

**Kecilkan.** Kolom dengan sedikit nilai berbeda (negara, produk, status) bisa disimpan sebagai **kategori**: tabel menyimpan tiap nilai berbeda sekali dan satu kode integer kecil per baris. Kolom integer jarang butuh 64 bit. Pada sejuta baris yang sama (setelah pembersihan dan penguraian tanggal, yang mengurangi memori sekitar 5 MB), mengubah teks beragam-rendah menjadi `category` dan men-downcast integer menurunkan memori dari **78 MB menjadi 40 MB di pandas 3.0.6, dan dari 242 MB menjadi 84 MB di 2.2.3** (`shrink_memory` di lab). Nilainya identik. Jangan ubah id unik menjadi kategori: ia akan menyimpan satu kode *dan* satu label per baris, yang justru lebih besar. Aturan lab adalah "nilai berbeda kurang dari setengah jumlah baris".

**Baca per chunk.** Ketika file tidak muat, `pd.read_csv(path, usecols=[...], chunksize=100_000)` mengembalikan iterator DataFrame. Untuk tiap chunk, hitung **hasil parsial**, lalu gabungkan hasil parsialnya:

```python
parts = []
for chunk in pd.read_csv(path, usecols=["country", "quantity", "unit_price_idr"], chunksize=100_000):
    parts.append((chunk["quantity"] * chunk["unit_price_idr"]).groupby(chunk["country"]).sum())
total = pd.concat(parts).groupby(level=0).sum()
```

:::talk Median dari median
@teacher Sebuah file terlalu besar, jadi Anda membacanya per potongan. Di potongan 1 nilainya 1, 2, dan 100, dan mediannya 2. Di potongan 2 nilainya 3 dan 4, dan mediannya 3,5. Anda merata-ratakan kedua median untuk mendapat median seluruh file: 2,75.
@ask Apakah 2,75 median yang sebenarnya?
@choice Ya: median dari median adalah median | Periksa dengan tangan: urutkan kelima nilai: 1, 2, 3, 4, 100. Yang di tengah adalah 3. Coba lagi.
@choice * Tidak: median sebenarnya 3. Median tidak bisa digabung dari potongan, tidak seperti jumlah dan hitungan | Betul. Median sebuah potongan melupakan bagaimana nilainya dibanding potongan lain. Jumlah, hitungan, minimum, dan maksimum bisa digabung dengan aman, median butuh semua data (atau alat lain).
@choice Cukup dekat, jadi tidak masalah | Pada data yang miring selisihnya bisa besar, dan Anda tidak akan tahu. Coba lagi.
@teacher Sebelum memotong sebuah perhitungan, tanyakan: "bisakah hasil parsialnya digabung?" Jika tidak, pakai alat yang melihat semua data, seperti DuckDB atau Polars.
:::

Ini bekerja untuk hal yang bisa digabungkan: jumlah, hitungan, minimum, maksimum. Rata-rata adalah `sum / count` dari jumlah gabungan, bukan rata-rata dari rata-rata. **Waspadai apa pun yang butuh seluruh file.** Deduplikasi tiap chunk secara terpisah melewatkan duplikat yang jatuh di chunk berbeda. Pada ekspor kita baris yang diulang berdekatan, jadi chunk 100 baris hanya melewatkan 1 dari 80 duplikat, tetapi jika eksporter mengulang berjam-jam kemudian, jaraknya jauh dan mereka akan lolos. Median, rank global, dan join dua file besar tidak bisa dilakukan per chunk; saat itulah Anda pindah ke database, DuckDB, atau Spark.

**Pakai Parquet, bukan CSV, untuk data yang Anda simpan.** CSV adalah teks: ia menyimpan `2026-01-15` sebagai sepuluh karakter, tidak punya tipe (pelajaran 2 ada karena itu), dan harus dibaca dari byte pertama sampai terakhir. **Parquet** adalah format biner, **kolumnar**, terkompresi (Modul 2.1) yang menyimpan tipe. Pada sejuta baris yang sama file Parquet berukuran **9,1 MB dibanding 47,7 MB** untuk CSV, sekitar **5 kali lebih kecil**, dan membaca hanya dua kolom memakan **0,03 detik dibanding 0,27** untuk CSV (`usecols` tetap harus memindai seluruh file teks). `df.to_parquet("orders.parquet", index=False)` menulisnya dan `pd.read_parquet(path, columns=[...])` hanya membaca kolom yang diminta. Antar langkah pipeline, serahkan Parquet, bukan CSV.

**Menguji kode data.** Lab memperlihatkan kebiasaannya: tiap fungsi kecil dan murni, menerima frame dan mengembalikan frame, dan punya tes dari beberapa baris yang jawabannya bisa Anda hitung dengan tangan, ditambah satu tes pada file realistis terhadap jawaban yang dihitung secara independen. Ketika sebuah fungsi bisa diuji dengan lima baris, ia cukup sederhana untuk dipercaya.

> 💡 **Jeda Praktik 5 (Efisiensi Memori, Chunking, & Format Parquet - Lab Tuntas):**
> Kuasai teknik pemrosesan dataset besar dan format data modern:
> 1. Di `labs/mod-1-5/orders_lab.py` pada text editor, selesaikan 4 fungsi performa:
>    - `shrink_memory(df)`: optimasi tipe dengan mengubah teks berkardinalitas rendah (< 50% baris) menjadi `category` dan downcast integer.
>    - `chunked_revenue_by_country(path, chunksize=500)`: baca file CSV per batch kolom tertentu dan akumulasikan omset per negara tanpa memuat seluruh file.
>    - `write_parquet(df, path)` & `read_parquet_columns(path, columns)`: simpan dan baca kolom spesifik file Parquet tanpa index pandas.
> 2. Jalankan seluruh suite pengujian di terminal:
> `pytest labs/mod-1-5/test_lab.py -v`
> 3. Ketika semua 35 tes berstatus PASSED, hasilkan kode bukti untuk halaman lab:
> `python3 scripts/prove.py mod-1-5`

:::drill python Rata-rata dari rata-rata itu salah
Anda membaca file besar dalam chunk, dan tiap chunk menghasilkan `(sum, count)`. Tulis `combined_mean(parts)`: `parts` adalah daftar pasangan `(sum, count)`; kembalikan rata-rata dari **semua** nilai bersama-sama. Daftar kosong menghasilkan `0`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("combined_mean") ## Definisikan combined_mean(parts).
combined_mean([(10, 2), (30, 2)]) == 10 ## 40 atas 4 nilai.
combined_mean([(50, 1), (90, 9)]) == 14 ## 140 atas 10 nilai. Rata-rata dari dua rata-rata chunk (50 dan 10) adalah 30: salah.
combined_mean([]) == 0 ## Tanpa chunk, tanpa rata-rata.
@hint
Tangani list kosong terlebih dahulu (kembalikan `0`). Selain itu, jumlahkan seluruh sum dari semua chunk dan seluruh count dari semua chunk, lalu bagi satu kali di akhir.
@solution
def combined_mean(parts):
    if not parts:
        return 0
    return sum(s for s, _ in parts) / sum(c for _, c in parts)
:::

:::ask CSV 40 GB tidak muat di memori, dan Anda membacanya per chunk. Perhitungan mana yang aman dilakukan per chunk lalu digabung?
@options
median, dengan mengambil median tiap chunk
menghapus duplikat hanya di dalam tiap chunk
* sum atau count: hasilnya tinggal dijumlah
@why
Jumlah, hitungan, minimum, dan maksimum bisa digabung dengan bersih. Rata-rata butuh jumlah dan hitungan digabung dulu. Duplikat yang jatuh di chunk berbeda terlewat jika tiap chunk dideduplikasi sendiri.
:::

## @lesson Engine vektorisasi satu-node modern: eksekusi lazy Polars dan zero-copy Apache Arrow {optional}

*(Pratinjau opsional: pelajaran ini memberi gambaran awal Apache Arrow dan Polars agar Anda melihat bagaimana engine satu-node melampaui batas pandas; Modul 2.1 membahas engine kolumnar, DuckDB, dan cara kerja Arrow secara menyeluruh dari awal.)*

Meskipun `pandas` tetap digunakan secara luas di banyak basis kode produksi, ada dua batas arsitektur yang muncul ketika ukuran dataset di satu mesin tumbuh dari 100 MB menjadi 20 GB:
1. **Eksekusi Satu Inti CPU (Single-Core) & Materialisasi Eager:** `pandas` standar menjalankan operasi pada satu thread CPU dan mengalokasikan DataFrame perantara baru di RAM pada setiap langkah rangkaian method (`df[df.status == 'paid'].groupby('city')...`), sehingga itulah sebabnya Wes McKinney, pembuat pandas, menyarankan **RAM 5 sampai 10 kali ukuran dataset**.
2. **Biaya Serialisasi Antar-Alat:** Dahulu, memindahkan tabel dari engine SQL ke pandas berarti menyalin dan mengurai ulang setiap nilai di memori.

Rekayasa data Python modern menyelesaikan kedua masalah tersebut dengan **Apache Arrow** dan **Polars** (bersama **DuckDB**, yang akan Anda uji langsung di Modul 2.1):

| Kemampuan | `pandas` (Eager DataFrame) | `Polars` (`import polars as pl`) | `Apache Arrow` (`pyarrow`) |
|---|---|---|---|
| **Tata Letak Memori** | Array NumPy (atau berbasis Arrow via `dtype_backend="pyarrow"`). | Buffer kolumnar **Apache Arrow** asli yang ditulis dengan Rust. | Standar memori kolumnar universal yang dipakai bersama oleh Polars, DuckDB, Spark, serta konektor BigQuery/Snowflake. |
| **Model Eksekusi** | **Eager & Single-Threaded:** Mengeksekusi setiap baris kode seketika pada 1 core CPU. | **Lazy & Multithreaded (`LazyFrame`):** Menyusun rencana query (query plan), mendorong filter ke row-group Parquet, dan berjalan paralel di seluruh core CPU. | **Transfer Zero-Copy:** Memungkinkan DuckDB men-query tabel Arrow dari Polars/pandas (`df.to_arrow()`) tanpa menyalin datanya. |
| **Streaming Out-of-Core** | Loop manual `chunksize=` pada CSV. | Engine streaming bawaan: `pl.scan_parquet(...).collect(engine="streaming")` mengolah data per batch, sehingga bisa menangani data yang lebih besar dari RAM. | Pembaca batch IPC / Feather & Parquet berbasis memory-mapped (`mmap`). |

**Menulis Pipeline Polars Lazy dengan Predicate Pushdown.** Perhatikan bagaimana `pl.scan_parquet()` (berbeda dengan `read_parquet()`) tidak langsung memuat file ke RAM saat dipanggil. Sebaliknya, Polars memeriksa seluruh rangkaian transformasi Anda, memangkas kolom yang tidak dipakai (*projection pushdown*), melewati row-group Parquet yang statistik min/max-nya tidak memenuhi filter (*predicate pushdown*), dan baru mengeksekusi rencana optimal tersebut secara paralel di seluruh thread Rust saat `.collect()` atau `.sink_parquet()` dipanggil:

```python
import polars as pl

# Rencana query lazy: hanya membaca kolom yang dibutuhkan, dan bisa melewati row group yang min/max-nya tidak cocok dengan filter
lazy_plan = (
    pl.scan_parquet("data/orders_*.parquet")
    .filter(
        (pl.col("status") == "paid")
        & (pl.col("order_ts") >= "2026-01-01")
    )
    .group_by("city")
    .agg([
        pl.len().alias("paid_orders"),
        pl.col("total_idr").sum().alias("revenue_idr"),
    ])
    .sort("revenue_idr", descending=True)
)

# Periksa rencana eksekusi optimal (menampilkan pushdown SELECTION dan PROJECT ke dalam Parquet SCAN)
print(lazy_plan.explain())

# Eksekusi di seluruh core CPU dengan batas memori streaming out-of-core
result_df = lazy_plan.collect(engine="streaming")   # Polars 1.25+; kode lama memakai streaming=True, yang dihapus di Polars 2

# Penyerahan zero-copy ke Apache Arrow / DuckDB / Pandas bila diperlukan:
arrow_tbl = result_df.to_arrow()
```

> 🛠 **Coba sendiri (15 menit, Python dengan `polars`, `pandas`, dan `pyarrow`).** Baca `data/orders.csv` dengan pandas sebagai teks, simpan baris yang `total_idr`-nya hanya berisi angka lalu jadikan integer, ulang barisnya 30 kali (`pd.concat([df] * 30)`), dan tulis sebagai 10 file Parquet `big/part-00.parquet` … `big/part-09.parquet`. Bangun rencana lazy dengan `pl.scan_parquet("big/*.parquet")`: simpan `status == "delivered"` (persis ejaan itu, seperti di Coba sendiri pertama modul ini), kelompokkan per `payment_method`, hitung pesanan dan jumlahkan `total_idr`, urutkan menurut jumlahnya secara menurun (descending). Cetak `.explain()` sebelum collect, lalu collect dengan `engine="streaming"` dan bandingkan dengan hal yang sama di pandas.
>
> **Seharusnya Anda melihat:** `107400` baris di disk. Di dalam node `Parquet SCAN` plan-nya menyebut `PROJECT 3/6 COLUMNS` dan `SELECTION: col("status") == "delivered"`: filter dan daftar kolom pindah ke dalam scan, jadi tiga kolom lainnya tidak pernah dibaca. Empat metode pembayaran, dipimpin `cod` dengan `15600` pesanan dan `5349150000`, persis sama dengan hitungan dan jumlah dari pandas. Diukur dengan Polars 2.1.0 dan pandas 3.1.1 pada data bawaan kursus.

:::ask Apa yang dilakukan `pl.scan_parquet(...)` yang tidak dilakukan `pl.read_parquet(...)`?
@options
* ia membangun rencana, sehingga bagian tak terpakai dilewati
ia membaca file lebih cepat dengan mengabaikan datanya
ia mengubah file menjadi CSV terlebih dahulu
@why
`scan_*` bersifat lazy: Polars melihat seluruh rantai, lalu hanya membaca kolom yang dibutuhkan dan melewati row group yang statistiknya mengeliminasi filter. `read_*` memuat semuanya lebih dulu.
:::

## @lab Lab: bersihkan dan ringkas ekspor pesanan yang berantakan
Bersihkan ekspor pesanan KopiKu dengan pandas: muat dengan tipe yang benar, profil, bersihkan, hitung omset per negara dan bulan, ranking produk, tambah riwayat per pelanggan, gabungkan daftar pelanggan dengan aman, lalu kecilkan, baca per chunk, dan tulis Parquet. Ke-35 tes memeriksa tiap fungsi secara mandiri terhadap jawaban yang dihitung dengan Python biasa, dan melarang loop per baris.

### @steps
> **Sudah menyelesaikan Jeda Praktik 1–5?** File `labs/mod-1-5/orders_lab.py` Anda sudah selesai diimplementasikan! Anda bisa langsung melompat ke pemeriksaan refleksi pada langkah 4–7 dan menjalankan `python3 scripts/prove.py mod-1-5` di langkah 8.

1. Buat atau aktifkan virtual environment Anda (Modul 0.1) dan pasang requirements lab: `pip install -r labs/mod-1-5/requirements.txt`.
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
- [x] Satu loop terkompilasi berjalan atas seluruh kolom; ia lebih dari seribu kali lebih cepat pada sejuta baris
- [ ] Hanya bentuk kolom yang bisa menangani nilai kosong, karena `apply` selalu gagal ketika bertemu `NaN`

> Operasi vektor berjalan di kode terkompilasi atas seluruh kolom. Fungsi Python yang dipanggil per baris adalah jalur lambat: di mesin yang kami ukur, 1,8 ms dibanding 5,7 detik untuk 1.000.000 baris.

### `pd.Series([1, None, 3]).mean()` mengembalikan 2.0. Mengapa?
- [ ] pandas mengganti nilai kosong dengan nol sebelum merata-ratakan, yang akan memberi 1,33 sebagai hasilnya
- [x] Nilai kosong dilewati, sehingga hasilnya (1 + 3) / 2, dan Anda harus menghitung berapa yang dilewati itu
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
