---
title: Python dari Nol: Arti Setiap Baris dan Mengapa Ia Ada
duration: 2-3 minggu
summary: Pelajari Python seperti yang dipakai data engineer: nilai dan tipe, list dan dictionary, if, for, def, error, dan file. Untuk setiap gagasan Anda melihat apa fungsinya, mengapa ia ada, dan apa persisnya yang dilakukan komputer langkah demi langkah, lalu membuktikannya dengan sebelas fungsi kecil pada data pesanan yang mirip aslinya.
why: Banyak kursus menunjukkan def dan for selama sepuluh menit lalu terburu-buru lanjut. Anda menyalin kode, jalan, dan tetap tidak bisa menjelaskannya. Data engineering adalah menulis gagasan-gagasan kecil ini ribuan kali, jadi dasar yang kabur berubah menjadi bug yang merugikan uang.
---

## @outcomes
- Menjelaskan apa itu variabel, tipe, list, dictionary, dan set, lalu memilih yang tepat untuk sebuah data
- Menelusuri program kecil baris demi baris dan menebak keluarannya tanpa menjalankannya
- Menulis keputusan if/elif/else serta perulangan for/while, dan menjelaskan mengapa perulangan atau keputusan itu diperlukan
- Menulis fungsi dengan def, parameter, return, dan nilai bawaan, serta menjelaskan beda print dan return
- Membaca pesan error dari bawah, dan memakai try/except tanpa menyembunyikan masalah yang sebenarnya
- Membaca file CSV dengan `with open` dan modul csv, serta menjelaskan apa yang dilakukan `import` dan `if __name__ == "__main__"`

## @prereq
Tidak ada. Anda tidak perlu pernah menulis kode, dan tidak masalah jika kursus sebelumnya membuat Anda bingung. Anda bisa mulai sekarang juga tanpa memasang apa pun dengan latihan di pelajaran dan **Pratinjau browser** pada lab; begitu Modul 0.1 (atau Mulai di sini) menyiapkan terminal lokal dan virtual environment Anda, Anda menjalankan tes serta `prove.py` di komputer sendiri untuk mengunci kode bukti Anda.

> [!IMPORTANT]
> **Versi singkat:** lab ini punya dua bagian. **Bagian A** adalah Python biasa (setelah Pelajaran 1 sampai 4), **Bagian B** adalah fungsi (setelah Pelajaran 5). Jangan membaca seluruh bab lebih dulu: bergantianlah antara pelajaran dan Jeda Praktiknya. Panduan lengkap "cara mengerjakan lab" muncul di akhir Pelajaran 1, tepat di tempat Anda pertama kali membutuhkannya.

## @part Dasar: nilai, koleksi, keputusan, dan perulangan

## @lesson Cara program berjalan: nilai, variabel, dan tipe
Program adalah daftar instruksi yang diikuti komputer **dari atas ke bawah, satu baris demi satu baris**. Tidak ada yang dilewati dan tidak ada yang terjadi "di latar belakang" kecuali Anda memintanya. Ini model mental yang paling berguna dalam pemrograman: saat Anda tersesat, letakkan jari di baris pertama lalu jalan ke bawah.

Di sini Anda belajar dengan mengerjakan. Setiap gagasan kecil diikuti **latihan** singkat: Anda menulis beberapa baris, menekan **Jalankan & periksa**, dan pemeriksa memberi tahu persis apa yang masih salah. Buntu? Tekan **Petunjuk**, dan kalau masih buntu, **Lihat jawaban** lalu ketik ulang sendiri. Latihan ini menjalankan Python di browser Anda, jadi tidak ada yang perlu dipasang. Terminal Anda sendiri (jendela tempat mengetik perintah ke komputer; Mulai di sini, langkah 2 menunjukkannya) tetap tempat kerja yang sesungguhnya: **Coba sendiri** dan lab di akhir materi memakainya.

### Menampilkan nilai: print()

**Mengapa:** program yang tidak bisa menunjukkan apa pun tidak berguna bagi Anda. `print()` adalah cara Anda melihat apa yang dikerjakan sebuah program.

`print()` menaruh sesuatu di layar. Teks ditulis di dalam tanda kutip; angka tidak:

```python
print("Halo")
print(150000)
```

> **Di mana saya mengetik ini?** Di sini juga: kotak latihan di bawah menjalankan Python di browser Anda, jadi tidak ada yang perlu dipasang. Nanti, di komputer Anda sendiri, Anda akan melakukan hal yang sama di terminal (Mulai di sini, langkah 4, menunjukkannya berdampingan). Untuk sekarang, pakai saja kotaknya.

:::drill python Cetak sebuah kata
Pakai `print()` untuk menampilkan kata `paid`. Ini teks, jadi ditulis di dalam tanda kutip.
@starter
# tulis baris Anda di bawah baris ini

@check
calls("print") ## Pakai fungsi print().
out == "paid" ## Program harus mencetak persis: paid
@hint
`print("paid")`: tanda kutip memberi tahu Python bahwa `paid` adalah teks, bukan nama.
@solution
print("paid")
:::

### Nilai dan variabel

Untuk bekerja, komputer harus mengingat sesuatu. Ia mengingat sebuah **nilai** (sepotong data seperti `150000` atau `"paid"`) dan memberinya **nama** supaya bisa dipakai lagi. Nilai bernama itu adalah **variabel**:

```python
total = 150000
status = "paid"
print(total)        # menampilkan 150000
```

> **Di mana saya mengetik ini?** Di kotak latihan pada halaman ini, dengan cara yang sama. Coba `print(total)` di sana: ia menampilkan `150000`. Di komputer Anda sendiri nanti, Anda bisa mengetik ketiga baris itu di prompt `>>>` terminal, tempat mengetik `total` saja juga menampilkan nilainya; di file `.py` yang disimpan tidak ada yang ditampilkan kecuali Anda `print`-nya.

Baca `total = 150000` sebagai "**biarkan nama `total` menunjuk ke nilai 150000**". Tanda `=` bukan tanda sama dengan dalam matematika; ia adalah *penugasan* (assignment): kerjakan sisi kanan dulu, lalu tempelkan nama di kiri pada hasilnya.

:::drill python Buat dua variabel
Buat variabel `price` yang berisi angka `25000`, dan variabel `drink` yang berisi teks `"Kopi Susu"`.
@starter
# tulis dua baris Anda di bawah baris ini

@check
price == 25000 ## `price` harus berisi angka 25000 (angka tidak memakai tanda kutip).
type(price) is int ## `price` harus berupa angka, bukan teks.
drink == "Kopi Susu" ## `drink` harus berisi teks "Kopi Susu" (teks memakai tanda kutip).
@hint
`price = 25000` dan `drink = "Kopi Susu"`: satu nama, satu `=`, satu nilai per baris.
@solution
price = 25000
drink = "Kopi Susu"
:::

### Sebuah nama menyimpan nilainya sampai Anda mengubahnya

Karena sisi kanan dikerjakan lebih dulu, `total = total + 1000` masuk akal di Python (ambil nilai lama, tambah 1000, tempelkan nama pada nilai baru) tetapi tidak masuk akal dalam matematika.

Telusuri dengan tangan sebelum menjalankannya: `a = 2`, `b = a * 3`, `a = 10`, `print(b)`. Hasilnya `6`, bukan `30`. `b` mendapat nilai 6 pada saat penugasan; mengubah `a` kemudian tidak mengubah `b`. Kalau Anda menebak 30, Anda baru saja belajar sesuatu yang penting.

Lihat bagaimana ia terjadi, dengan angka yang berbeda dari latihan di bawah:

:::trace Sebuah nama menyimpan nilainya
@code
a = 2
b = a * 3
a = 10
print(b)
@notes
2 | `b` dihitung **sekarang**, dari nilai `a` saat ini (2). Ia mendapat 6.
3 | `a` berubah, tetapi `b` sudah berisi 6. Tidak ada yang menghitungnya ulang.
4 | Jadi ini mencetak 6, bukan 30.
:::

:::drill python Ikuti nilainya
Baca tiga baris dari atas. Berapa angka yang dipegang `y` di akhir? Ganti `None` dengan angka itu. (Jalankan kalau mau memeriksa sendiri: `print(y)`.)
@starter
x = 5
y = x + 1
x = 20
answer = None
@check
answer == 6 ## `y` mendapat nilainya (6) ketika `x` bernilai 5. Mengubah `x` kemudian tidak mengubah `y`.
type(answer) is int ## `answer` harus berupa angka.
@hint
Jalan baris demi baris. Setelah baris 2, `y` bernilai 6. Baris 3 mengubah `x`, tetapi tidak ada yang membuat `y` dihitung ulang.
@solution
x = 5
y = x + 1
x = 20
answer = 6
:::

:::ask Apa yang akan tercetak?
```python
count = 10
count = count + 5
print(count)
```
@options
count
* 15
count + 5
@why
Python mengerjakan **sisi kanan dulu**: nilai lama `count` (10) ditambah 5 adalah 15, baru kemudian nama `count` menunjuk ke 15. `print` menampilkan nilainya, bukan namanya.
:::

### Tipe

Setiap nilai punya **tipe**, yang memberi tahu Python apa yang boleh Anda lakukan dengannya. Lima yang akan Anda pakai setiap hari:

| Tipe | Contoh | Arti |
|---|---|---|
| `int` | `150000` | bilangan bulat |
| `float` | `3.5` | angka dengan desimal |
| `str` | `"paid"` | teks, selalu di dalam tanda kutip |
| `bool` | `True`, `False` | ya atau tidak |
| `None` | `None` | "tidak ada nilai" |

`type(x)` memberi tahu tipe sebuah nilai:

```python
print(type(150000))
print(type("150000"))
```

Kedua baris itu tampak mirip, tetapi yang pertama angka dan yang kedua teks. **Uang adalah bilangan bulat.** Simpan uang sebagai `int` dalam satuan terkecil (rupiah), jangan pernah sebagai `float`: desimal disimpan dalam biner, sehingga `0.1 + 0.2` adalah `0.30000000000000004`, dan setelah sejuta baris kesalahan sekecil itu menjadi uang sungguhan.

:::drill python Angka atau teks?
Buat `price` berisi angka `25000` dan `price_text` berisi teks `"25000"` (angka yang sama, di dalam tanda kutip). Lalu cetak tipe masing-masing, satu per baris: pertama `price`, lalu `price_text`.
@starter
# tulis baris Anda di bawah baris ini

@check
price == 25000 and type(price) is int ## `price` harus berupa angka 25000 (tanpa tanda kutip).
price_text == "25000" ## `price_text` harus berupa teks "25000" (dengan tanda kutip).
out == "<class 'int'>\n<class 'str'>" ## Cetak type(price) di baris pertama dan type(price_text) di baris kedua. Anda harus melihat int, lalu str.
@hint
`print(type(price))` menampilkan tipe dari nilai yang ditunjuk `price`.
@solution
price = 25000
price_text = "25000"
print(type(price))
print(type(price_text))
:::

### Mengapa tipe penting: bug pertama setiap pekerjaan data

Semua yang masuk ke program Anda dari luar, file CSV (tabel dalam teks biasa), API web (cara meminta data dari program lain), formulir, datang sebagai **teks**. Ini dua pesanan KopiKu persis seperti Python membacanya dari file CSV:

```python
row1 = {"order_id": "1001", "status": "paid", "total_idr": "150000"}
row2 = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
```

(Setiap `{...}` adalah **dictionary**, satu baris berlabel tempat `row1["total_idr"]` mengambil nilai `"150000"`; Pelajaran 2 membahas dictionary secara penuh.) Lihat tanda kutipnya: `"150000"` adalah teks (`str`), bukan angka. Sekarang manajer Anda mengajukan tiga pertanyaan sederhana, dan teks itu memberi tiga jawaban salah **tanpa error apa pun**:

| Pertanyaannya | Yang Anda tulis | Jawaban Python | Mengapa |
|---|---|---|---|
| Total kedua pesanan? | `row1["total_idr"] + row2["total_idr"]` | `'15000090000'` | `+` pada teks menempelkan karakternya |
| Apakah 90.000 lebih besar dari 150.000? | `"90000" > "150000"` | `True` | teks dibandingkan karakter demi karakter, seperti kata di kamus, dan `"9"` datang setelah `"1"` |
| Total dari kecil ke besar? | `sorted(["150000", "90000", "25000"])` | `['150000', '25000', '90000']` | urutan karakter demi karakter yang sama |

Tidak ada yang crash. Program berjalan, laporan terkirim, dan setiap angka di dalamnya salah. Karena itu pekerjaan pertama seorang data engineer pada data baru apa pun adalah **memberi setiap nilai tipe yang benar, dengan sengaja**: `int("150000")` adalah angka `150000`, dan `str(150000)` adalah teks `"150000"`. Dengan angka, tiga pertanyaan yang sama memberi `240000`, `False`, dan `[25000, 90000, 150000]`.

Lihat bug diam-diam itu terjadi, satu baris demi satu baris, dengan angka kecil:

:::trace Teks menempel, angka menjumlah
@code
a = "150"
b = "90"
glued = a + b
total = int(a) + int(b)
print(glued, total)
@notes
3 | `+` pada **teks** menempelkan karakternya: `150` dan `90` menjadi `15090`. Tidak ada error, hanya jawaban yang salah.
4 | Ubah dulu setiap teks menjadi angka, dan `+` menjumlah: 240.
:::

Sebelum latihan, satu tebakan. Jangan dijalankan; pikirkan dulu:

:::ask Apa yang akan tercetak?
```python
print("2" + "3")
```
@options
5
sebuah error
* 23
@why
Tanda kutip membuat `"2"` dan `"3"` menjadi **teks**, dan `+` pada teks menempelkan karakternya: `23`. Python tidak menebak bahwa Anda bermaksud angka. Beginilah total harga berupa teks bisa salah tanpa error apa pun.
:::

:::drill python Jumlahkan harga sebagai angka
Dua harga datang dari sebuah file, jadi keduanya teks. Buat `price_sum` berisi totalnya **sebagai angka** (43000), bukan dua teks yang saling menempel.
@starter
price_a = "25000"
price_b = "18000"
price_sum = None
@check
price_sum == 43000 ## `price_sum` harus 43000. Kalau hasilnya 2500018000, kedua teks saling menempel: ubah masing-masing dengan int(...) dulu.
type(price_sum) is int ## `price_sum` harus berupa angka (int).
calls("int") ## Ubah dengan int(...) sebelum menjumlahkan.
@hint
`int("25000")` adalah angka 25000. Ubah kedua harga, lalu jumlahkan dengan `+`.
@solution
price_a = "25000"
price_b = "18000"
price_sum = int(price_a) + int(price_b)
:::

Tipe melindungi Anda dengan dua cara lagi:
- **Teks kotor gagal dengan keras, dan itu bagus.** `int("Rp 1.250.000")` memunculkan `ValueError: invalid literal for int() with base 10: 'Rp 1.250.000'`. Error yang menghentikan Anda lebih baik daripada angka salah yang tidak disadari siapa pun. Materi 6 menunjukkan cara menangkapnya dan menyisihkan baris yang buruk.
- **`None` bukan `0`.** Total yang hilang (`None`) berarti "kita tidak tahu"; `0` berarti "pesanannya gratis". Kalau tertukar, rata-rata dan total menjadi salah secara diam-diam.

:::drill python None bukan nol
`missing_total` bernilai `None`: kita tidak tahu totalnya. Cetak jawaban untuk pertanyaan "apakah `missing_total` sama dengan `0`?" (pakai `==`).
@starter
missing_total = None
# cetak perbandingan Anda di bawah baris ini

@check
calls("print") ## Pakai print(...) untuk menampilkan jawabannya.
out == "False" ## Anda harus melihat False: None ("kita tidak tahu") bukan 0 ("gratis").
@hint
`print(missing_total == 0)` mencetak `True` atau `False`.
@solution
missing_total = None
print(missing_total == 0)
:::

**Di mana Anda akan bertemu ini lagi.** Di mana-mana: database memberi tipe pada setiap kolom (Modul 0.3); pipeline mengonversi dan memeriksa tipe sebelum memuat apa pun (Modul 1.2); format file seperti Parquet (format file modern untuk data analitik) menyimpan tipe di samping datanya agar tidak ada yang menebak (Modul 2.1). Tugas pemanasan pertama di simulator kerja persis ini: harga bertipe teks, diubah menjadi angka.

> 🛠 **Coba sendiri (5 menit, Python di prompt `>>>`).** Di terminal ketik `python3`, lalu ketik (atau tempel) baris `row1` dan tekan Enter, kemudian baris `row2` dan tekan Enter: satu baris setiap kali. Jika Anda menempel keduanya sekaligus, prompt menampilkan `...`: Python menunggu akhir blok, jadi tekan Enter sekali lagi pada baris `...` yang kosong (bukan Ctrl+C, yang membatalkannya). Sebelum setiap pertanyaan di tabel, **tebak** jawabannya, lalu ketik kodenya dan bandingkan. Kemudian jawab tiga pertanyaan yang sama lagi dengan `int(...)` di sekitar setiap total.
>
> **Seharusnya Anda melihat:** `'15000090000'`, `True`, dan `['150000', '25000', '90000']` dengan teks; `240000`, `False`, dan `[25000, 90000, 150000]` dengan angka. Jika salah satu tebakan Anda keliru, itulah pelajarannya: tulis dalam satu kalimat mengapa.

### Mengambil satu nilai dari sebuah baris

Pada baris di atas, `row1["total_idr"]` artinya "dari baris `row1`, berikan nilai yang berlabel `total_idr`". Labelnya ditulis di dalam kurung siku, di dalam tanda kutip. Nilai yang keluar masih berupa teks, jadi perlu `int(...)` sebelum bisa dijumlahkan. Coba pada baris lain:

:::drill python Ambil satu nilai dari sebuah baris
`row` adalah satu pesanan, ditulis sebagai dictionary. Buat `total_number` berisi total pesanan itu **sebagai angka** (90000), dibaca dari label `"total_idr"`.
@starter
row = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
total_number = None
@check
total_number == 90000 ## `total_number` harus berupa angka 90000.
type(total_number) is int ## `total_number` harus berupa angka, bukan teks: bungkus nilainya dengan int(...).
uses("row") ## Baca nilainya dari `row`, jangan ketik 90000 lagi.
@hint
`row["total_idr"]` memberi teks `"90000"`. Bungkus dengan int(...) untuk mendapatkan angkanya.
@solution
row = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
total_number = int(row["total_idr"])
:::

### Menulis angka sebagai teks: f-string

Laporan menampilkan `Rp 1.250.000`, bukan `1250000`. Tiga alat kecil melakukannya, satu per satu. Pertama, **f-string** menaruh nilai di dalam teks: tulis `f` sebelum tanda kutip pembuka dan taruh nilainya di dalam kurung kurawal:

```python
total = 150000
print(f"Pesanan {1001}: Rp {total}")     # Pesanan 1001: Rp 150000
```

:::drill python Taruh angka di dalam teks
`amount` bernilai `45000`. Buat `label` berisi teks `Rp 45000` dengan f-string, supaya ia mengikuti `amount` kalau angkanya berubah.
@starter
amount = 45000
label = None
@check
label == "Rp 45000" ## `label` harus berupa teks Rp 45000.
"{" in code and "}" in code ## Pakai f-string: f"Rp {amount}".
uses("amount") ## Ambil nilainya dari variabel `amount`, jangan ketik 45000 lagi.
@hint
Tulis `f` sebelum tanda kutip pembuka, lalu taruh `{amount}` di tempat angkanya.
@solution
amount = 45000
label = f"Rp {amount}"
:::

### Pemisah ribuan

Kode format setelah titik dua mengubah cara angka ditulis. `f"{1250000:,}"` menghasilkan teks `"1,250,000"`, dengan koma di antara ribuan:

```python
print(f"{1250000:,}")
```

:::drill python Koma di antara ribuan
Buat `with_commas` berisi teks `amount` dengan koma di antara ribuan: `7,500,000`.
@starter
amount = 7500000
with_commas = None
@check
with_commas == "7,500,000" ## `with_commas` harus berupa teks 7,500,000.
":," in code ## Taruh kode format `:,` setelah nama di dalam kurung kurawal: {amount:,}
@hint
`f"{amount:,}"`: titik dua memulai kode format, koma meminta pemisah ribuan.
@solution
amount = 7500000
with_commas = f"{amount:,}"
:::

### Menukar karakter: .replace()

Orang Indonesia menulis pemisah ribuan sebagai titik. **`.replace(lama, baru)`** pada teks menukar karakter. Nilai teks punya aksi bantu seperti ini, disebut **method**: `"1,250,000".replace(",", ".")` menghasilkan `"1.250.000"`.

:::drill python Koma menjadi titik
`with_commas` adalah teks `7,500,000`. Buat `with_dots` berisi teks yang sama dengan titik sebagai pengganti koma.
@starter
with_commas = "7,500,000"
with_dots = None
@check
with_dots == "7.500.000" ## `with_dots` harus berupa teks 7.500.000.
calls("replace") ## Pakai method .replace(lama, baru) pada teks.
@hint
`with_commas.replace(",", ".")` menghasilkan teks baru; teks lamanya tetap.
@solution
with_commas = "7,500,000"
with_dots = with_commas.replace(",", ".")
:::

Digabung, `f"Rp {amount:,}".replace(",", ".")` menulis `1250000` sebagai `Rp 1.250.000`. Sekarang Anda tahu setiap bagian dari Langkah 1 lab: lab meminta Anda menggabungkannya sendiri pada angka-angkanya.

> [!IMPORTANT]
> **Cara Mengerjakan Lab (Panduan Pemula):**
> - **Lab ini punya dua bagian.** **Bagian A** adalah Python biasa, tanpa fungsi: setelah tiap Pelajaran 1 sampai 4 Anda mengisi beberapa variabel di file `labs/mod-0-0/practice.py` (ganti setiap `None` dengan kode Anda sendiri). **Bagian B** dimulai setelah Pelajaran 5, yang mengajarkan fungsi (`def`): file `labs/mod-0-0/basics.py` berisi sebelas fungsi untuk ditulis. Jangan membaca seluruh bab lebih dulu; bergantianlah antara pelajaran dan Jeda Praktiknya.
> - **Di mana:** di **Pratinjau browser** pada tab Lab (tanpa memasang apa pun; pakai tombol Bagian A / Bagian B), atau di terminal Anda sendiri jika Anda sudah mengikuti Mulai di sini (halaman lab menunjukkan empat perintah persiapannya, sekali saja). File-filenya adalah file teks yang Anda buka di editor (VS Code, atau `code labs/mod-0-0/practice.py`), bukan perintah: mengetik nama file di terminal menghasilkan `Permission denied` atau `command not found`. Perintah `pytest ...` di bawah setiap jeda (pytest menjalankan pemeriksaan otomatis; tombol **Jalankan tes** melakukan hal yang sama) memeriksa pekerjaan Anda, dan run itulah yang dihitung.
> - **Mencoba contoh di materi:** ketik di kotak latihan pada halaman, atau di prompt Python `>>>` terminal Anda (ketik `python3` lalu Enter; keluar dengan `exit()`). Perintah seperti `cd`, `ls`, dan `pytest` justru diketik di prompt `$` terminal, tidak pernah di `>>>`. Tidak yakin yang mana? **Mulai di sini, langkah 4** menunjukkan ketiganya.

> 💡 **Jeda Praktik 1 (Bagian A, Langkah 1):**
> Buka Bagian A lab: file `labs/mod-0-0/practice.py` di editor Anda, atau tab **Bagian A** pada Pratinjau browser di tab Lab. Baca bagian atas file sekali, lalu cari **Langkah 1**. Ia memberi Anda `amount`, `row1`, dan `row2`, serta dua variabel untuk diisi: ganti setiap `None` dengan kode Anda sendiri.
> 1. `formatted`: jumlah itu ditulis sebagai teks dengan titik, `Rp 1.250.000` (f-string dan `.replace` di atas).
> 2. `two_totals`: dua total di `row1` dan `row2` dijumlahkan sebagai **angka** (ambil tiap total dengan `row1["total_idr"]` dan `row2["total_idr"]`). Lihat kembali tiga jawaban salah di tabel: total ini adalah teks, jadi ubah dulu.
> Jalankan file untuk melihat nilai Anda: `python3 labs/mod-0-0/practice.py`. Lalu periksa Langkah 1: tekan **Jalankan tes** di pratinjau, atau di terminal (setelah persiapan sekali saja di halaman lab):
> `pytest labs/mod-0-0/test_practice.py -k Step1 -v`
> Anda seharusnya melihat `Rp 1.250.000` dan `240000`, dan tiga pemeriksaan lulus. Pemeriksaan yang gagal menyebutkan variabel mana yang salah, seharusnya berapa, dan sekarang berapa: `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is None `` hanya berarti Anda belum mengganti `None`. Lalu lanjut ke Pelajaran 2.

## @lesson Koleksi: satu nilai tidak pernah cukup
Satu pesanan punya beberapa fakta, dan sebuah file berisi ribuan pesanan. Python memberi Anda empat wadah: **list**, **dictionary**, **tuple**, dan **set**. Mengetahui **mengapa masing-masing ada** memberi tahu Anda mana yang dipilih. Seperti di Materi 1, setiap gagasan diikuti latihan.

### List: deretan berurutan

**Mengapa:** sebuah toko punya ribuan pesanan, dan satu variabel per pesanan itu mustahil. List menyimpan banyak nilai di bawah satu nama.

**List** (`[...]`) adalah deretan benda yang berurutan, tempat posisi penting dan duplikat boleh ada. `len()` memberi tahu **berapa banyak item** dalam sebuah list:

```python
products = ["Kopi Susu", "Americano", "Teh Tarik"]
print(len(products))     # 3: tiga item dalam list
```

:::drill python Berapa banyak item?
`prices` adalah sebuah list. Buat `how_many` berisi jumlah item di dalamnya, dengan `len()`.
@starter
prices = [25000, 22000, 18000, 30000]
how_many = None
@check
how_many == 4 ## `how_many` harus 4: list-nya punya empat item.
calls("len") ## Pakai len(prices) untuk menghitung itemnya.
@hint
`len(prices)` memberi tahu berapa banyak item yang dimiliki `prices`.
@solution
prices = [25000, 22000, 18000, 30000]
how_many = len(prices)
:::

### Posisi dimulai dari 0

Anda membaca satu item lewat **posisinya** (disebut juga indeks), ditulis di dalam kurung siku. Posisi dimulai dari **0**, jadi `products[0]` adalah item pertama dan `products[1]` item kedua. Posisi negatif menghitung dari belakang: `products[-1]` adalah item terakhir. **Irisan** (slice) `products[0:2]` mengambil posisi 0 dan 1 (berhenti *sebelum* angka kedua):

```python
products = ["Kopi Susu", "Americano", "Teh Tarik"]
print(products[0])       # Kopi Susu
print(products[-1])      # Teh Tarik
print(products[0:2])     # ['Kopi Susu', 'Americano']
```

Tebak dulu sebelum latihan:

:::ask Apa yang akan tercetak?
```python
letters = ["a", "b", "c", "d"]
print(letters[1], letters[-1])
```
@options
* b d
a d
b c
@why
Posisi dimulai dari 0, jadi `letters[1]` adalah item **kedua**, `"b"`. Posisi `-1` adalah item **terakhir**, `"d"`. `print` dengan dua nilai menaruh spasi di antaranya: `b d`.
:::

:::drill python Pertama dan terakhir
Buat `first` berisi item pertama `cities` dan `last` berisi item terakhir. Pakai posisi, jangan ketik namanya lagi.
@starter
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first = None
last = None
@check
first == "Jakarta" ## `first` harus "Jakarta": item pertama ada di posisi 0.
last == "Medan" ## `last` harus "Medan": posisi -1 adalah item terakhir.
uses("cities") ## Ambil dari list `cities` dengan [posisi].
@hint
`cities[0]` adalah item pertama; `cities[-1]` adalah yang terakhir.
@solution
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first = cities[0]
last = cities[-1]
:::

:::drill python Sebuah irisan
Buat `first_two` berisi dua kota pertama, sebagai list, dengan irisan.
@starter
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first_two = None
@check
first_two == ["Jakarta", "Bandung"] ## `first_two` harus ['Jakarta', 'Bandung'].
":" in code.split("first_two =")[-1] ## Pakai irisan: cities[0:2] (berhenti sebelum posisi 2).
@hint
`cities[0:2]` mulai dari posisi 0 dan berhenti sebelum posisi 2.
@solution
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first_two = cities[0:2]
:::

### Mengubah list

Sebuah list bisa berubah. `.append(x)` menambahkan `x` di akhir:

```python
products = ["Kopi Susu", "Americano"]
products.append("Teh Tarik")
print(products)          # ['Kopi Susu', 'Americano', 'Teh Tarik']
```

:::drill python Tambah satu di akhir
Tambahkan `"Medan"` di akhir list `cities`.
@starter
cities = ["Jakarta", "Bandung"]
# tulis baris Anda di bawah baris ini

@check
cities == ["Jakarta", "Bandung", "Medan"] ## `cities` harus berakhir dengan "Medan" dan mempertahankan dua kota sebelumnya.
calls("append") ## Pakai cities.append(...).
@hint
`cities.append("Medan")` mengubah list di tempat; Anda tidak perlu `cities = ...`.
@solution
cities = ["Jakarta", "Bandung"]
cities.append("Medan")
:::

### Menghitung: berapa semuanya, dan berapa dari satu jenis

Dua pertanyaan berbeda, dua alat berbeda. `len(list)` menjawab **berapa banyak item semuanya**. `list.count(x)` menjawab **berapa banyak item yang sama dengan `x`**:

```python
statuses = ["paid", "paid", "cancelled", "paid"]
print(len(statuses))             # 4: empat pesanan semuanya
print(statuses.count("paid"))    # 3: tiga di antaranya paid
```

Tebak dulu:

:::ask Apa yang akan tercetak?
```python
statuses = ["paid", "cancelled", "paid"]
print(len(statuses), statuses.count("paid"))
```
@options
3 3
2 3
* 3 2
@why
`len(statuses)` menghitung **setiap** item: 3. `statuses.count("paid")` hanya menghitung item yang sama dengan `"paid"`: 2. Angka pertama adalah "berapa semuanya", angka kedua adalah "berapa dari satu jenis".
:::

:::drill python Semuanya, dan satu jenis
`statuses` berisi status lima pesanan. Buat `all_orders` berisi jumlah pesanan, dan `paid_orders` berisi jumlah pesanan yang statusnya `"paid"`.
@starter
statuses = ["paid", "cancelled", "paid", "shipped", "paid"]
all_orders = None
paid_orders = None
@check
all_orders == 5 ## `all_orders` harus 5: pakai len(statuses), ia menghitung semuanya.
paid_orders == 3 ## `paid_orders` harus 3: pakai statuses.count("paid"), ia hanya menghitung yang sama.
calls("len") and calls("count") ## Pakai keduanya: len(...) untuk jumlah semuanya, .count(...) untuk satu jenis.
@hint
`len(statuses)` menghitung semua item. `statuses.count("paid")` hanya menghitung item yang sama dengan `"paid"`.
@solution
statuses = ["paid", "cancelled", "paid", "shipped", "paid"]
all_orders = len(statuses)
paid_orders = statuses.count("paid")
:::

### Dictionary: mencari berdasarkan nama

**Mengapa:** "posisi 3" tidak memberi tahu apa-apa tentang sebuah pesanan, tetapi `"status"` memberi tahu. Dictionary memungkinkan Anda meminta sebuah fakta menurut namanya.

**Dictionary** (`{...}`) mencari sesuatu berdasarkan *nama* (sebuah **key**) alih-alih posisi. Satu pesanan adalah sebuah dictionary:

```python
order = {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"}
print(order["status"])         # paid
print(order.get("note"))       # None: .get memberi None, bukan error, kalau key-nya tidak ada
```

Membaca key yang tidak ada dengan `order["note"]` memunculkan `KeyError`; `.get("note", "")` memberi nilai default.

:::drill python Cari berdasarkan key
Buat `status` berisi status `order`, dan `note` berisi catatannya. Pesanan ini tidak punya catatan, jadi pakai `.get` dengan default `"no note"`.
@starter
order = {"order_id": "1002", "status": "cancelled", "total_idr": "90000"}
status = None
note = None
@check
status == "cancelled" ## `status` harus "cancelled": baca dengan order["status"].
note == "no note" ## `note` harus "no note": pakai order.get("note", "no note") untuk key yang mungkin tidak ada.
calls("get") ## Pakai .get(...) untuk catatannya.
@hint
`order["status"]` membaca key yang ada. `order.get("note", "no note")` memberi default kalau key-nya tidak ada.
@solution
order = {"order_id": "1002", "status": "cancelled", "total_idr": "90000"}
status = order["status"]
note = order.get("note", "no note")
:::

### Mengubah dictionary

Menugaskan nilai ke sebuah key mengubahnya, atau menambahkannya kalau belum ada:

```python
order["status"] = "shipped"    # ubah sebuah nilai
order["courier"] = "JNE"       # tambah key baru
```

:::drill python Ubah dan tambah
Ubah status `order` menjadi `"shipped"` dan tambahkan key `"courier"` dengan nilai `"JNE"`.
@starter
order = {"order_id": "1003", "status": "paid"}
# tulis baris Anda di bawah baris ini

@check
order["status"] == "shipped" ## `order["status"]` harus "shipped".
order.get("courier") == "JNE" ## `order` harus punya key "courier" dengan nilai "JNE".
len(order) == 3 ## `order` harus punya tiga key: order_id, status, dan courier.
@hint
`order["status"] = "shipped"` dan `order["courier"] = "JNE"`.
@solution
order = {"order_id": "1003", "status": "paid"}
order["status"] = "shipped"
order["courier"] = "JNE"
:::

### Dictionary bisa menyimpan hitungan

Dictionary juga alat untuk menyimpan **hitungan per nama**, "berapa banyak dari setiap jenis". Ini pertanyaan yang berbeda dari `len`: `counts = {"paid": 3, "cancelled": 1}` berarti ada 3 pesanan paid dan 1 cancelled. `counts["paid"]` membaca satu hitungan, dan `len(counts)` adalah jumlah *jenis yang berbeda*, bukan jumlah pesanan. Cara membangun dictionary seperti itu dari banyak baris adalah tugas sebuah loop, yang diajarkan Materi 4. Di sini Anda hanya membacanya.

:::drill python Baca sebuah hitungan
Buat `paid_count` berisi jumlah pesanan paid, dan `kinds` berisi jumlah status yang berbeda, keduanya dibaca dari dictionary `counts`.
@starter
counts = {"paid": 3, "cancelled": 1, "shipped": 2}
paid_count = None
kinds = None
@check
paid_count == 3 ## `paid_count` harus 3: baca dengan counts["paid"].
kinds == 3 ## `kinds` harus 3: ada tiga status yang berbeda. len(counts) menghitung key-nya.
@hint
`counts["paid"]` adalah hitungan pesanan paid. `len(counts)` adalah jumlah key dalam dictionary.
@solution
counts = {"paid": 3, "cancelled": 1, "shipped": 2}
paid_count = counts["paid"]
kinds = len(counts)
:::

### Tuple: kelompok kecil yang tetap

**Tuple** (`(...)`) adalah kelompok kecil yang tetap dan tidak seharusnya berubah, seperti `("paid", 3)`. Fungsi sering mengembalikan tuple untuk memberikan dua hal sekaligus.

### Set: setiap nilai satu kali

**Set** adalah kantong berisi nilai **unik** tanpa urutan. `set([7, 3, 7, 5])` adalah `{3, 5, 7}`. Pakai untuk menghapus duplikat, dan untuk bertanya "apakah saya sudah pernah melihat ini?" dengan sangat cepat memakai `x in seen`. Karena set tidak berurutan, pakai fungsi bawaan `sorted(my_set)` kapan pun Anda butuh nilai uniknya kembali sebagai list berurutan:

```python
ids = [7, 3, 7, 5]
print(sorted(set(ids)))    # [3, 5, 7]
```

:::drill python Setiap id satu kali
`ids` punya pengulangan. Buat `unique_ids` berisi list id yang berbeda, masing-masing satu kali, dari yang terkecil.
@starter
ids = [4, 9, 4, 1, 9, 9]
unique_ids = None
@check
unique_ids == [1, 4, 9] ## `unique_ids` harus [1, 4, 9]: setiap id satu kali, dari yang terkecil.
calls("set") and calls("sorted") ## Pakai set(...) untuk membuang pengulangan dan sorted(...) untuk urutannya.
@hint
`set(ids)` menyimpan setiap nilai satu kali; `sorted(...)` mengubahnya menjadi list berurutan.
@solution
ids = [4, 9, 4, 1, 9, 9]
unique_ids = sorted(set(ids))
:::

### File sungguhan: list berisi dictionary

File data sungguhan biasanya berupa **list berisi dictionary**: list adalah file-nya, setiap dictionary adalah satu baris, key-nya adalah nama kolom. Ini tiga produk (setiap nilai berupa teks, seperti keluar dari file CSV, tabel dalam teks biasa yang cara membacanya diajarkan di Materi 7) dan tiga pertanyaan beserta jawabannya:

```python
products = [
    {"sku": "K1", "name": "Kopi Susu", "price_idr": "25000"},
    {"sku": "K2", "name": "Americano", "price_idr": "22000"},
    {"sku": "K3", "name": "Teh Tarik", "price_idr": "18000"},
]
product_count = len(products)                  # 3: len() menghitung barisnya
first_name = products[0]["name"]               # "Kopi Susu": [0] adalah baris PERTAMA, lalu ["name"] mengambil satu fakta dari dictionary itu
last_price = int(products[-1]["price_idr"])    # 18000: [-1] adalah baris TERAKHIR; int() karena harganya teks
print(product_count, first_name, last_price)   # 3 Kopi Susu 18000
```

Baca setiap baris dari dalam ke luar: `products[0]` adalah satu dictionary, dan `["name"]` membaca satu nilai darinya.

:::drill python Bertanya pada list berisi baris
`shops` adalah list berisi dictionary. Buat `shop_count` berisi jumlah baris, `first_city` berisi kota pada baris pertama, dan `last_staff` berisi staf pada baris terakhir **sebagai angka**.
@starter
shops = [
    {"city": "Jakarta", "staff": "12"},
    {"city": "Bandung", "staff": "8"},
    {"city": "Surabaya", "staff": "15"},
]
shop_count = None
first_city = None
last_staff = None
@check
shop_count == 3 ## `shop_count` harus 3: len(shops) menghitung barisnya.
first_city == "Jakarta" ## `first_city` harus "Jakarta": shops[0]["city"].
last_staff == 15 and type(last_staff) is int ## `last_staff` harus angka 15: shops[-1]["staff"] adalah teks, jadi bungkus dengan int(...).
@hint
Posisi dulu, key kemudian: `shops[0]["city"]`. Baris terakhir adalah `shops[-1]`. Nilainya teks, jadi `int(...)`.
@solution
shops = [
    {"city": "Jakarta", "staff": "12"},
    {"city": "Bandung", "staff": "8"},
    {"city": "Surabaya", "staff": "15"},
]
shop_count = len(shops)
first_city = shops[0]["city"]
last_staff = int(shops[-1]["staff"])
:::

### Dua nama, satu list

Satu gagasan untuk dikenal sejak awal: **mutable versus immutable**. List, dictionary, dan set bisa diubah di tempat; string, angka, dan tuple tidak. Ketika dua nama menunjuk ke list yang sama, perubahan lewat satu nama terlihat lewat nama yang lain. Itulah akar bug Python yang paling terkenal, yang ditunjukkan skenario chaos modul ini.

Perhatikan nama kedua ditempelkan pada list yang **sama** (lihat label di sebelah nilainya):

:::trace Nama kedua, list yang sama
@code
orders = ["x"]
copy = orders
copy.append("y")
print(orders)
@notes
2 | `copy = orders` **tidak** menyalin list: ia menempelkan nama kedua pada list yang sama. Kedua nama menunjukkan label yang sama.
3 | Mengubah list lewat `copy`...
4 | ...mengubah apa yang dilihat `orders` juga: ia mencetak `['x', 'y']`.
:::

:::drill python Dua nama, satu list
`b = a` tidak menyalin list: kedua nama menunjuk ke list yang sama. Setelah tiga baris itu, list apa yang dipegang `a`? Ganti `None` dengan list itu.
@starter
a = [1, 2]
b = a
b.append(3)
a_now = None
@check
a_now == [1, 2, 3] ## `a` memegang [1, 2, 3]: `b` adalah list yang sama dengan `a`, jadi append lewat `b` terlihat di `a`.
@hint
`b = a` membuat `b` menunjuk ke list yang sama dengan `a`. `b.append(3)` mengubah satu list itu.
@solution
a = [1, 2]
b = a
b.append(3)
a_now = [1, 2, 3]
:::

> 💡 **Jeda Praktik 2 (Bagian A, Langkah 2):**
> Di `practice.py` (atau tab **Bagian A**), kerjakan **Langkah 2** dengan list `orders` (list berisi dict, persis seperti yang diberikan file CSV) dan list `ids_seen`:
> 1. `order_count`: berapa pesanan di list itu (`len`).
> 2. `first_status`: status pesanan pertama (posisi `0`, lalu kunci `"status"`).
> 3. `last_total`: total pesanan terakhir (posisi `-1`), sebagai **angka**.
> 4. `unique_ids`: id yang berbeda di `ids_seen`, masing-masing sekali, dari yang terkecil (sebuah set, lalu `sorted`).
> Jalankan file untuk melihat nilai Anda, lalu periksa langkahnya:
> `pytest labs/mod-0-0/test_practice.py -k Step2 -v`
> Anda seharusnya melihat `4`, `paid`, `60000`, dan `[3, 5, 7]`, serta empat pemeriksaan lulus.

## @lesson Keputusan: if, elif, else
Keputusan adalah cara program memilih di antara jalur. Dalam data engineering hampir semua **validasi** adalah keputusan: apakah total ini angka? apakah statusnya salah satu yang kita kenal? Setiap keputusan dimulai dengan pertanyaan yang dijawab Python dengan `True` atau `False`.

### Pertanyaan yang dijawab Python dengan True atau False

Sebuah perbandingan mengajukan pertanyaan tentang dua nilai. Jawabannya adalah `bool` (`True` atau `False`):

| Pertanyaan | Tulis | Contoh |
|---|---|---|
| sama? | `==` | `stock == 12` |
| tidak sama? | `!=` | `status != "paid"` |
| lebih kecil / lebih besar? | `<` `>` | `stock < 20` |
| lebih kecil atau sama / lebih besar atau sama? | `<=` `>=` | `stock >= 20` |
| ada di kelompok ini? | `in` | `"paid" in ["paid", "shipped"]` |

```python
stock = 12
print(stock < 20)          # True
print(stock == 12)         # True: dua tanda sama dengan MENANYAKAN
print("a" in ["a", "b"])   # True
```

Hati-hati: satu `=` **menugaskan** (`stock = 12` menaruh 12 ke dalam nama), dua `==` **membandingkan** (`stock == 12` bertanya "apakah 12?"). Tertukar keduanya adalah kekeliruan pemula yang klasik.

:::ask Apa yang akan tercetak?
```python
print(5 == 5.0, "5" == 5)
```
@options
* True False
True True
False False
@why
`5` dan `5.0` adalah angka yang sama, jadi perbandingan pertama `True`. Tetapi `"5"` adalah **teks** dan `5` adalah angka, dan Python tidak pernah menganggap teks dan angka sama: `False`.
:::

:::drill python Ajukan sebuah pertanyaan
`stock` bernilai `12`. Buat `is_low` berisi jawaban untuk pertanyaan "apakah stoknya di bawah 20?". Sekarang harus `True`, dan mengikuti `stock` kalau angkanya berubah.
@starter
stock = 12

# tulis solusi Anda di bawah baris ini
@check
is_low is True ## `is_low` harus True: 12 di bawah 20.
uses("stock") ## Ajukan pertanyaan tentang variabel `stock`, jangan hanya mengetik True.
rerun_with("stock", 50)["is_low"] is False ## Ketika `stock` 50, `is_low` harus False. Pakai stock < 20.
@hint
`stock < 20` adalah pertanyaan yang jawabannya `True` atau `False`. Simpan jawabannya: `is_low = stock < 20`.
@solution
stock = 12
is_low = stock < 20
:::

### if: jalankan blok hanya ketika jawabannya True

Sebuah `if` menjalankan baris di bawahnya **hanya ketika pertanyaannya `True`**. Baris yang menjadi milik `if` **menjorok** (empat spasi) di bawah baris yang berakhir dengan titik dua. Di Python, indentasi *adalah* strukturnya, jadi indentasi yang salah berarti program yang salah.

```python
stock = 12
if stock < 20:
    print("reorder")
```

Tambahkan `else` untuk "kalau tidak". Perhatikan baris mana yang berjalan, dan mana yang dilewati:

:::trace Baris mana yang berjalan?
@code
stock = 12
if stock < 20:
    message = "reorder"
else:
    message = "enough"
print(message)
@notes
1 | `stock` mendapat nilai 12.
2 | Pertanyaannya: apakah 12 < 20? Ya, `True`.
3 | Karena jawabannya `True`, Python masuk ke blok yang menjorok di bawah `if`.
6 | Blok `else` dilewati seluruhnya. Sekarang program melanjutkan dengan baris pertama yang tidak menjorok di bawahnya.
:::

:::drill python if dan else
Tulis `if` / `else` sehingga `message` bernilai `"reorder"` ketika `stock` di bawah 20, dan `"enough"` kalau tidak.
@starter
stock = 12
# tulis if / else Anda di bawah baris ini

@check
has_node("If") ## Pakai if (dan else).
message == "reorder" ## Dengan stock 12, `message` harus "reorder".
rerun_with("stock", 50)["message"] == "enough" ## Dengan stock 50, `message` harus "enough".
rerun_with("stock", 20)["message"] == "enough" ## Dengan stock tepat 20, `message` harus "enough": 20 tidak di bawah 20.
@hint
```python
if stock < 20:
    message = "reorder"
else:
    message = "enough"
```
@solution
stock = 12
if stock < 20:
    message = "reorder"
else:
    message = "enough"
:::

### elif: lebih dari dua jalur

`elif` ("else if") menambah pertanyaan. Python menanyakannya **dari atas**, menjalankan blok **yang pertama** `True`, dan melewati semua yang lain:

```python
status = "refunded"
if status == "paid":
    print("hitung pendapatan")
elif status == "cancelled" or status == "refunded":
    print("tidak ada pendapatan")
else:
    print("status tidak dikenal: kirim ke karantina")
```

(Perhatikan `or` di baris `elif`: artinya "salah satu benar", bagian berikutnya membahas `and`, `or`, dan `not` secara penuh.)

:::drill python Tiga jalur
Tentukan `action` dari `status`: `"paid"` menghasilkan `"count it"`; `"cancelled"` atau `"refunded"` menghasilkan `"skip it"`; selain itu menghasilkan `"check it"`.
@starter
status = "refunded"
# tulis if / elif / else Anda di bawah baris ini

@check
has_node("If") ## Pakai if / elif / else.
action == "skip it" ## Dengan status "refunded", `action` harus "skip it".
rerun_with("status", "paid")["action"] == "count it" ## Dengan status "paid", `action` harus "count it".
rerun_with("status", "cancelled")["action"] == "skip it" ## Dengan status "cancelled", `action` harus "skip it".
rerun_with("status", "shipped")["action"] == "check it" ## Dengan status lain (misalnya "shipped"), `action` harus "check it".
@hint
Mulai dengan `if status == "paid":`, lalu `elif status == "cancelled" or status == "refunded":`, lalu `else:`.
@solution
status = "refunded"
if status == "paid":
    action = "count it"
elif status == "cancelled" or status == "refunded":
    action = "skip it"
else:
    action = "check it"
:::

### and, or, not

Gabungkan pertanyaan dengan `and` (keduanya harus benar), `or` (minimal satu), dan `not` (membalik jawabannya). `status in {"cancelled", "refunded"}` (kurung kurawal berisi nilai tanpa titik dua membentuk **set** dari Pelajaran 2) adalah cara singkat menulis beberapa `or`.

:::drill python Keduanya harus benar
Sebuah pesanan bisa dikirim ketika sudah dibayar **dan** ada stok. Buat `can_ship` bernilai `True` hanya ketika `paid` adalah `True` dan `stock` di atas 0.
@starter
paid = True
stock = 5

# tulis solusi Anda di bawah baris ini
@check
can_ship is True ## Dengan paid True dan stock 5, `can_ship` harus True.
rerun_with("stock", 0)["can_ship"] is False ## Dengan stock 0, `can_ship` harus False.
rerun_with("paid", False)["can_ship"] is False ## Ketika `paid` False, `can_ship` harus False.
uses("paid") and uses("stock") ## Pakai kedua variabel dalam satu pertanyaan yang digabung dengan `and`.
@hint
`paid and stock > 0`: dua pertanyaan yang digabung dengan `and`.
@solution
paid = True
stock = 5
can_ship = paid and stock > 0
:::

### Apa yang dianggap salah: truthiness

Dalam sebuah `if`, beberapa nilai dianggap **salah** tanpa menjadi `False`: `0`, `""` (teks kosong), `None`, `[]` (list kosong), `{}`. Semua yang lain dianggap benar. Jadi `if not rows:` berarti "kalau tidak ada baris". Namun hati-hati: `if total:` juga salah untuk total `0`, padahal itu bisa nilai yang sah sepenuhnya (pesanan gratis). Ketika nol itu sah, ajukan pertanyaan yang persis: `total is not None` (untuk `None`, Python selalu memakai `is None` / `is not None` alih-alih `==` / `!=`, karena hanya ada satu nilai `None`).

:::ask Apa yang akan tercetak?
```python
total = 0
if total:
    print("has a total")
else:
    print("no total")
```
@options
has a total
* no total
sebuah error
@why
`0` dianggap salah dalam sebuah `if`, jadi Python menjalankan `else`. Inilah jebakannya: pesanan gratis (total `0`) akan diperlakukan sebagai "tidak ada total". Ketika `0` adalah nilai yang sah, tulis `if total is not None:`.
:::

:::drill python Nol adalah nilai sungguhan
`total` bernilai `0`: pesanannya gratis, dan itu nilai sungguhan. Buat `has_total` bernilai `True` setiap kali `total` bukan `None` (jadi `True` untuk `0`), dan `False` ketika `None`.
@starter
total = 0

# tulis solusi Anda di bawah baris ini
@check
has_total is True ## Dengan total 0, `has_total` harus True: pesanan gratis tetap sebuah total.
rerun_with("total", None)["has_total"] is False ## Dengan total None, `has_total` harus False.
rerun_with("total", 250)["has_total"] is True ## Dengan total 250, `has_total` harus True.
"is not None" in code ## Ajukan pertanyaan yang persis: total is not None.
@hint
`total is not None` bernilai `True` untuk `0` dan `False` hanya untuk `None`.
@solution
total = 0
has_total = total is not None
:::

### Angka negatif: abs()

`abs(n)` memberi jarak dari nol, selalu positif: `abs(-45000)` adalah `45000`. Untuk menampilkan angka negatif dengan tanda minus di depan, tulis `abs(n)` dan taruh tandanya di depan sendiri, dengan `if` yang memeriksa apakah `n` di bawah nol. Ingat `str(n)` mengubah angka menjadi teks.

:::drill python Tanda minus di depan
`n` adalah bilangan bulat. Buat `signed` berisi teksnya: dengan `-` di depan ketika `n` negatif (`-450` menjadi `"-450"`), dan hanya digitnya kalau tidak (`450` menjadi `"450"`). Pakai `abs()`.
@starter
n = -450
# tulis if / else Anda di bawah baris ini

@check
signed == "-450" ## Dengan n -450, `signed` harus teks "-450".
rerun_with("n", 450)["signed"] == "450" ## Dengan n 450, `signed` harus teks "450" (tanpa minus).
rerun_with("n", 0)["signed"] == "0" ## Dengan n 0, `signed` harus "0".
calls("abs") ## Pakai abs(n) untuk mendapatkan digit tanpa tanda.
@hint
Ketika `n < 0`: `"-" + str(abs(n))`. Kalau tidak: `str(n)`.
@solution
n = -450
if n < 0:
    signed = "-" + str(abs(n))
else:
    signed = str(n)
:::

### Pembagian dengan nol adalah masalah keputusan

Rata-rata sebuah list adalah jumlahnya dibagi banyaknya angka. Python punya dua pembantu bawaan untuk itu: `sum(values)` menjumlahkan semua angka dalam list, dan `len(values)` menghitung itemnya. Untuk list **kosong** pembagiannya dengan nol dan Python berhenti dengan `ZeroDivisionError`. Rata-rata dari tidak ada apa pun bukan `0`, ia tidak ada: pakai `None`. Jaga kasus berbahaya itu lebih dulu dengan `if`.

:::drill python Rata-rata dari tidak ada apa pun
`scores` adalah list berisi angka. Buat `mean` berisi rata-ratanya. Ketika list kosong tidak ada rata-rata: `mean` harus `None`.
@starter
scores = [80, 90, 70]
# tulis if / else Anda di bawah baris ini

@check
mean == 80 ## Dengan scores [80, 90, 70], `mean` harus 80.0.
rerun_with("scores", [])["mean"] is None ## Dengan list kosong, `mean` harus None (dan program tidak boleh berhenti dengan ZeroDivisionError).
rerun_with("scores", [10])["mean"] == 10 ## Dengan scores [10], `mean` harus 10.0.
calls("sum") and calls("len") ## Pakai sum(scores) / len(scores).
@hint
`if len(scores) == 0:` beri `None`; `else:` jumlah dibagi panjangnya.
@solution
scores = [80, 90, 70]
if len(scores) == 0:
    mean = None
else:
    mean = sum(scores) / len(scores)
:::

**Mengapa keputusan ada di mana-mana dalam pipeline.** Aturan Modul 0.2 adalah "jangan menebak dan jangan membuang diam-diam". Dalam kode, aturan itu adalah `if` dengan dua cabang: baris yang valid dilanjutkan, baris yang tidak valid disisihkan *beserta alasannya*. `else` yang tidak melakukan apa-apa adalah cara data menghilang tanpa jejak.

> 💡 **Jeda Praktik 3 (Bagian A, Langkah 3):**
> Di `practice.py` (atau tab **Bagian A**), kerjakan **Langkah 3**:
> 1. `signed_text`: `signed_amount` ditulis seperti Langkah 1, tetapi jumlah negatif memiliki tanda minus di depan, `-Rp 45.000`, dan jumlah positif tidak, `Rp 500`. Pakai `if`, dan `abs()` dari atas.
> 2. `average`: rata-rata angka di `totals`, atau `None` jika `totals` kosong (`sum`, `len`, dan `if`).
> Jalankan file, lalu periksa langkahnya:
> `pytest labs/mod-0-0/test_practice.py -k Step3 -v`
> Anda seharusnya melihat `-Rp 45.000` dan `87500.0`, serta empat pemeriksaan lulus. Pemeriksa juga mencoba `totals` kosong: tanpa `if` Anda, file akan berhenti dengan `ZeroDivisionError`, dan pesannya menyebutkan di baris berapa.

## @lesson Pengulangan: for, while, dan comprehension
Sebuah file punya 100.000 baris. Anda tidak bisa menulis 100.000 baris kode, jadi Anda menulis instruksinya **sekali** dan membiarkan komputer mengulanginya. Itulah loop, dan ia adalah mesin setiap pipeline data.

### for: lakukan sesuatu untuk setiap item

Loop `for` mengambil item dalam sebuah list **satu per satu** dan menjalankan baris yang menjorok sekali untuk masing-masing. Perhatikan bagaimana ia berjalan:

:::trace Setiap putaran, item baru
@code
cities = ["Jakarta", "Bandung", "Medan"]
for city in cities:
    print(city)
print("done")
@notes
2 | Sebuah putaran dimulai: nama `city` ditempelkan pada item berikutnya dalam list.
3 | Baris yang menjorok berjalan sekali untuk item ini.
4 | Item habis, jadi loop selesai dan Python melanjutkan dengan baris berikutnya yang tidak menjorok.
:::

:::drill python Tampilkan setiap item
Pakai loop `for` untuk mencetak setiap nama di `names`, satu per baris.
@starter
names = ["Kopi", "Teh", "Susu"]
# tulis loop Anda di bawah baris ini

@check
has_node("For") ## Pakai loop for.
out == "Kopi\nTeh\nSusu" ## Harus mencetak Kopi, Teh, dan Susu, masing-masing di barisnya sendiri.
rerun_with("names", ["a", "b"])["__out__"] == "a\nb" ## Loop Anda harus bekerja untuk list apa pun: dengan ["a", "b"] harus mencetak a dan b.
@hint
`for name in names:` lalu, menjorok di baris berikutnya, `print(name)`.
@solution
names = ["Kopi", "Teh", "Susu"]
for name in names:
    print(name)
:::

### Akumulator: perbarui total di setiap putaran

Untuk menjumlahkan, mulai dengan nilai netral (`0`) **sebelum** loop, lalu perbarui di setiap putaran. **Pola akumulator** ini ada di balik penjumlahan, penghitungan, nilai maksimum, dan hampir setiap agregasi yang akan Anda tulis.

:::trace Total yang bertambah
@code
prices = [25000, 18000, 30000]
total = 0
for price in prices:
    total = total + price
print(total)
@notes
2 | Sebelum loop: mulai dengan nilai netral. Belum ada yang dijumlahkan.
4 | `total` yang baru adalah `total` lama ditambah `price` putaran ini. Perhatikan baris kuning: `total` bertambah di setiap putaran.
5 | Loop selesai. `total` berisi jumlah semua harga.
:::

:::ask Apa yang akan tercetak?
```python
total = 0
for n in [1, 2, 3]:
    total = n
print(total)
```
@options
* 3
6
0
@why
`total = n` **menggantikan** `total` di setiap putaran, jadi setelah putaran terakhir ia hanya berisi angka terakhir, 3. Untuk menjumlahkan Anda butuh `total = total + n`: nilai baru dibangun dari nilai lama.
:::

:::drill python Jumlahkan semuanya
Pakai loop `for` untuk membuat `total` berisi jumlah angka di `prices`. Jangan pakai `sum()` bawaan: yang dilatih di sini adalah loopnya.
@starter
prices = [25000, 18000, 30000]
total = 0
# tulis loop Anda di bawah baris ini

@check
has_node("For") ## Pakai loop for.
total == 73000 ## `total` harus 73000.
rerun_with("prices", [5, 5])["total"] == 10 ## Loop Anda harus bekerja untuk list apa pun: dengan [5, 5], `total` harus 10.
not calls("sum") ## Jangan pakai sum(): tulis loopnya sendiri.
@hint
`for price in prices:` lalu, menjorok: `total = total + price`.
@solution
prices = [25000, 18000, 30000]
total = 0
for price in prices:
    total = total + price
:::

Data dari file datang sebagai teks (Materi 1), jadi di dalam loop Anda biasanya mengubah setiap nilai dengan `int(...)` sebelum menjumlahkannya.

:::drill python Harga berupa teks
`texts` berisi harga sebagai teks. Buat `total` berisi jumlahnya **sebagai angka**.
@starter
texts = ["150000", "90000", "25000"]
total = 0
# tulis loop Anda di bawah baris ini

@check
total == 265000 ## `total` harus angka 265000, bukan teks yang menempel.
type(total) is int ## `total` harus berupa angka (int).
rerun_with("texts", ["1", "2"])["total"] == 3 ## Dengan ["1", "2"], `total` harus 3.
@hint
Ubah di dalam loop: `total = total + int(text)`.
@solution
texts = ["150000", "90000", "25000"]
total = 0
for text in texts:
    total = total + int(text)
:::

### if di dalam loop: hanya sebagian item

Taruh `if` di dalam loop untuk memperlakukan sebagian item secara berbeda. Setiap pesanan di bawah adalah dictionary; totalnya berupa teks.

:::drill python Lewati yang dibatalkan
Buat `revenue` berisi jumlah total (sebagai angka) dari pesanan yang statusnya **bukan** `"cancelled"`.
@starter
orders = [
    {"status": "paid", "total": "150000"},
    {"status": "cancelled", "total": "90000"},
    {"status": "paid", "total": "25000"},
]
revenue = 0
# tulis loop Anda di bawah baris ini

@check
revenue == 175000 ## `revenue` harus 175000: pesanan yang dibatalkan (90000) tidak boleh dihitung.
rerun_with("orders", [{"status": "cancelled", "total": "5"}])["revenue"] == 0 ## Dengan hanya pesanan yang dibatalkan, `revenue` harus tetap 0.
rerun_with("orders", [{"status": "paid", "total": "7"}, {"status": "shipped", "total": "3"}])["revenue"] == 10 ## Dengan paid 7 dan shipped 3, `revenue` harus 10.
has_node("If") ## Pakai if di dalam loop.
@hint
```python
for order in orders:
    if order["status"] != "cancelled":
        revenue = revenue + int(order["total"])
```
@solution
orders = [
    {"status": "paid", "total": "150000"},
    {"status": "cancelled", "total": "90000"},
    {"status": "paid", "total": "25000"},
]
revenue = 0
for order in orders:
    if order["status"] != "cancelled":
        revenue = revenue + int(order["total"])
:::

### Menghitung dengan dictionary

"Berapa banyak per status, per kota, per hari" adalah pertanyaan paling umum dalam data. Dictionary menyimpan satu hitungan per nama, dan satu baris melakukan pembaruannya:

```python
counts[status] = counts.get(status, 0) + 1
```

Baca dari kanan: `counts.get(status, 0)` adalah hitungan sejauh ini (`0` ketika status ini belum pernah terlihat), `+ 1` menambahkan yang ini, dan hasilnya disimpan kembali di key yang sama. Ingat baris ini; Anda akan menulisnya berkali-kali.

:::trace Menghitung per nama
@code
statuses = ["paid", "cancelled", "paid"]
counts = {}
for status in statuses:
    counts[status] = counts.get(status, 0) + 1
print(counts)
@notes
2 | Dictionary kosong: belum ada yang dihitung.
4 | `counts.get(status, 0)` memberi hitungan sejauh ini (0 untuk nama baru), +1 menambahkan yang ini, dan hasilnya disimpan kembali. Perhatikan dictionary-nya bertambah.
5 | Ketika loop selesai, `counts` punya satu hitungan per status yang berbeda.
:::

:::drill python Hitung per kota
`visits` mendaftar kota dari setiap kunjungan. Buat `counts` berupa dictionary berisi jumlah kunjungan per kota, seperti `{"Jakarta": 3, ...}`.
@starter
visits = ["Jakarta", "Medan", "Jakarta", "Jakarta", "Medan", "Bandung"]
counts = {}
# tulis loop Anda di bawah baris ini

@check
counts == {"Jakarta": 3, "Medan": 2, "Bandung": 1} ## `counts` harus {'Jakarta': 3, 'Medan': 2, 'Bandung': 1}.
rerun_with("visits", ["a", "b", "a"])["counts"] == {"a": 2, "b": 1} ## Dengan ["a", "b", "a"], `counts` harus {'a': 2, 'b': 1}.
has_node("For") ## Pakai loop for.
@hint
`for city in visits:` lalu `counts[city] = counts.get(city, 0) + 1`.
@solution
visits = ["Jakarta", "Medan", "Jakarta", "Jakarta", "Medan", "Bandung"]
counts = {}
for city in visits:
    counts[city] = counts.get(city, 0) + 1
:::

Baris yang sama bisa menjumlahkan **nilai** alih-alih satu-satu: `totals[city] = totals.get(city, 0) + amount`. Ketika setiap item adalah sepasang, loop bisa memisahkan kedua bagiannya sekaligus: `for city, amount in sales:`.

:::drill python Jumlahkan per nama
`sales` berisi pasangan `(city, amount)`. Buat `totals` berupa dictionary berisi jumlah nilai per kota, seperti `{"Jakarta": 125, ...}`.
@starter
sales = [("Jakarta", 100), ("Medan", 50), ("Jakarta", 25)]
totals = {}
# tulis loop Anda di bawah baris ini

@check
totals == {"Jakarta": 125, "Medan": 50} ## `totals` harus {'Jakarta': 125, 'Medan': 50}.
rerun_with("sales", [("a", 1), ("b", 2), ("a", 3)])["totals"] == {"a": 4, "b": 2} ## Dengan [("a", 1), ("b", 2), ("a", 3)], `totals` harus {'a': 4, 'b': 2}.
has_node("For") ## Pakai loop for.
@hint
`for city, amount in sales:` lalu `totals[city] = totals.get(city, 0) + amount`.
@solution
sales = [("Jakarta", 100), ("Medan", 50), ("Jakarta", 25)]
totals = {}
for city, amount in sales:
    totals[city] = totals.get(city, 0) + amount
:::

### Menelusuri dictionary: .items()

`counts.items()` memberi key **dan** value sekaligus, sehingga loop bisa mengambil keduanya: `for key, value in counts.items():`.

:::drill python Cetak setiap hitungan
Cetak satu baris per entri `counts`, dalam bentuk `paid: 3` (key, titik dua, spasi, value).
@starter
counts = {"paid": 3, "cancelled": 1}
# tulis loop Anda di bawah baris ini

@check
out == "paid: 3\ncancelled: 1" ## Harus mencetak `paid: 3` di satu baris dan `cancelled: 1` di baris berikutnya.
uses("items") ## Pakai counts.items() untuk mendapatkan key dan value bersama-sama.
rerun_with("counts", {"x": 2})["__out__"] == "x: 2" ## Dengan {"x": 2}, harus mencetak `x: 2`.
@hint
`for status, number in counts.items():` lalu `print(f"{status}: {number}")`.
@solution
counts = {"paid": 3, "cancelled": 1}
for status, number in counts.items():
    print(f"{status}: {number}")
:::

### Setiap nilai satu kali: set yang diisi dalam loop

Set menyimpan setiap nilai satu kali. Mulai dengan set kosong (`seen = set()`) dan masukkan nilai dengan `.add(x)`; menambahkan nilai yang sudah ada tidak mengubah apa-apa. Sesudahnya `sorted(...)` memberi urutannya.

:::drill python Setiap id satu kali, sebagai angka
`texts` berisi id pelanggan sebagai teks, dengan pengulangan. Buat `unique_ids` berisi list id yang berbeda **sebagai angka**, dari yang terkecil. Isi set dalam loop dengan `.add()`.
@starter
texts = ["7", "3", "7", "5", "3"]
seen = set()
# tulis loop Anda di bawah baris ini, lalu buat unique_ids

@check
unique_ids == [3, 5, 7] ## `unique_ids` harus [3, 5, 7]: angka (bukan teks), masing-masing satu kali, dari yang terkecil.
calls("add") ## Isi set dengan seen.add(...) di dalam loop.
has_node("For") ## Pakai loop for.
rerun_with("texts", ["2", "2", "1"])["unique_ids"] == [1, 2] ## Dengan ["2", "2", "1"], `unique_ids` harus [1, 2].
@hint
Di dalam loop: `seen.add(int(text))`. Setelah loop: `unique_ids = sorted(seen)`.
@solution
texts = ["7", "3", "7", "5", "3"]
seen = set()
for text in texts:
    seen.add(int(text))
unique_ids = sorted(seen)
:::

### range(): angka, dan langkah

`range(5)` memberi 0, 1, 2, 3, 4 (**bukan** 5: ia berhenti sebelum akhir). `range(2, 8)` memberi 2 sampai 7. `range(0, 10, 3)` melangkah tiga-tiga: 0, 3, 6, 9. Bungkus dengan `list(...)` untuk melihat angkanya. Bersama irisan (Materi 2) ia memotong list panjang menjadi bagian-bagian: `items[3:6]` adalah posisi 3, 4, dan 5.

```python
print(list(range(0, 10, 3)))    # [0, 3, 6, 9]
```

Di dalam loop, pasangkan setiap `start` dari `range(0, len(items), batch_size)` dengan irisan dinamis `items[start:start + batch_size]`, misalnya, saat `start` bernilai `3` dan `batch_size` bernilai `3`, itu mengambil `items[3:6]`.

:::drill python Dari mana setiap bagian mulai
`items` punya 10 item. Satu bagian panjangnya 3 item. Buat `starts` berisi list posisi tempat setiap bagian dimulai: `[0, 3, 6, 9]`. Pakai `range` dengan `len(items)`.
@starter
items = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]

# tulis solusi Anda di bawah baris ini
@check
starts == [0, 3, 6, 9] ## `starts` harus [0, 3, 6, 9].
calls("range") and calls("len") ## Pakai range(0, len(items), 3), dibungkus list(...).
rerun_with("items", [1, 2, 3, 4])["starts"] == [0, 3] ## Dengan 4 item, `starts` harus [0, 3].
@hint
`list(range(0, len(items), 3))`: dari 0, sampai panjang `items`, dengan langkah 3.
@solution
items = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
starts = list(range(0, len(items), 3))
:::

### Lewati satu, atau berhenti lebih awal

`continue` melewati sisa putaran ini dan lanjut ke putaran berikutnya. `break` meninggalkan loop sepenuhnya.

:::ask Apa yang akan tercetak?
```python
kept = []
for n in [1, 2, 3, 4]:
    if n == 3:
        continue
    kept.append(n)
print(kept)
```
@options
[1, 2, 3, 4]
* [1, 2, 4]
[1, 2]
@why
Ketika `n` adalah 3, `continue` melewati `append`, jadi 3 tidak pernah ditambahkan, tetapi loop **tetap berlanjut** ke 4. Dengan `break` sebagai ganti `continue`, loop berhenti di 3 dan list-nya `[1, 2]`.
:::

### Loop dalam satu baris: comprehension

**Comprehension** adalah loop yang membangun list dalam satu ekspresi: `[int(t) for t in texts]` berarti "untuk setiap `t` di `texts`, ambil `int(t)`". Itu loop yang sama dalam bentuk singkat. Pakai ketika muat dalam satu baris yang jelas; ketika Anda butuh cabang atau beberapa langkah, tulis loop biasa. Mudah dibaca lebih baik daripada pintar.

:::drill python Satu baris
Pakai list comprehension untuk membuat `ints` dari `texts`: setiap teks diubah menjadi angka.
@starter
texts = ["7", "3", "12"]

# tulis solusi Anda di bawah baris ini
@check
ints == [7, 3, 12] ## `ints` harus [7, 3, 12], sebagai angka.
has_node("ListComp") ## Pakai list comprehension: [ ... for ... in ...].
rerun_with("texts", ["5"])["ints"] == [5] ## Dengan ["5"], `ints` harus [5].
@hint
`[int(text) for text in texts]`
@solution
texts = ["7", "3", "12"]
ints = [int(text) for text in texts]
:::

### Meranking dengan sorted() dan key

Dalam pipeline data Anda sering meranking sesuatu (pelanggan dengan belanja terbanyak, Anda akan memakainya untuk `top_customers` di lab). `sorted(data, key=...)` menerima `key`: aturan kecil yang memberi tahu Python berdasarkan apa mengurutkan. Fungsi satu baris dengan `lambda` adalah cara praktis menulis aturan itu (setelah Pelajaran 5 Anda juga bisa menulis fungsi bantu `def` biasa lalu memberikan namanya sebagai `key=...`):

- `lambda pair: pair[1]` berarti: *"diberi satu `pair` seperti `(7, 100)`, kembalikan item keduanya (`100`)"*, `sorted()` memanggilnya untuk setiap item lalu mengurutkan menurut hasilnya.
- `key=lambda pair: (-pair[1], pair[0])` mengembalikan **tuple**: Python mengurutkan berdasarkan `-pair[1]` lebih dulu (tanda minus menaruh total terbesar di depan, karena `-250 < -100`) dan memakai `pair[0]` (id lebih kecil dulu) hanya untuk memutus seri.

:::drill python Ranking berdasarkan total
`pairs` berisi tuple `(customer_id, total)`. Buat `ranked` berisi pasangan yang diurutkan menurut total, **terbesar dulu**; ketika dua total sama, customer id yang lebih kecil didahulukan.
@starter
pairs = [(7, 100), (3, 100), (5, 250)]

# tulis solusi Anda di bawah baris ini
@check
ranked == [(5, 250), (3, 100), (7, 100)] ## `ranked` harus [(5, 250), (3, 100), (7, 100)].
has_node("Lambda") ## Pakai fungsi key yang ditulis dengan lambda.
rerun_with("pairs", [(1, 5), (2, 9)])["ranked"] == [(2, 9), (1, 5)] ## Dengan [(1, 5), (2, 9)], `ranked` harus [(2, 9), (1, 5)].
@hint
`sorted(pairs, key=lambda pair: (-pair[1], pair[0]))`: tanda minus membuat total terbesar berada di depan, dan id memutus seri.
@solution
pairs = [(7, 100), (3, 100), (5, 250)]
ranked = sorted(pairs, key=lambda pair: (-pair[1], pair[0]))
:::

### while: ulangi selama kondisi masih True

Loop `while` mengulang **selama sebuah pertanyaan tetap `True`**. Pakai ketika Anda tidak tahu berapa putaran yang dibutuhkan (mencoba ulang, membaca sampai habis). Bahayanya: kalau tidak ada yang di dalam loop membuat pertanyaannya salah, ia berjalan selamanya. Selalu tanyakan: "apa yang berubah di dalam loop sehingga ia berakhir?"

:::ask Berapa isi n di akhir?
```python
n = 3
while n > 0:
    n = n - 1
print(n)
```
@options
3
1
* 0
@why
Setiap putaran mengurangi 1: 3, 2, 1, 0. Ketika `n` adalah 0, pertanyaan `n > 0` menjadi `False`, loop berhenti, dan `n` adalah 0. Tanpa baris `n = n - 1` pertanyaannya akan tetap `True` selamanya.
:::

:::drill python Berapa kali?
Berapa kali Anda bisa mengurangi `3` dari `n` selama `n` masih setidaknya 3? Hitung putarannya di `steps`, dengan loop `while` (untuk `n = 10`: 10, 7, 4 semuanya minimal 3, jadi `steps` adalah 3).
@starter
n = 10
steps = 0
# tulis loop while Anda di bawah baris ini

@check
has_node("While") ## Pakai loop while.
steps == 3 ## Dengan n 10, `steps` harus 3.
rerun_with("n", 30)["steps"] == 10 ## Dengan n 30, `steps` harus 10.
rerun_with("n", 2)["steps"] == 0 ## Dengan n 2, `steps` harus 0: loop tidak boleh berjalan sama sekali.
@hint
`while n >= 3:` lalu, menjorok: `n = n - 3` dan `steps = steps + 1`.
@solution
n = 10
steps = 0
while n >= 3:
    n = n - 3
    steps = steps + 1
:::

> 💡 **Jeda Praktik 4 (Bagian A, Langkah 4):**
> Di `practice.py` (atau tab **Bagian A**), kerjakan **Langkah 4**. Satu perulangan `for order in orders:` bisa membangun beberapa hasil sekaligus. Sebelum perulangan, mulai `status_counts` sebagai `{}`, `revenue` sebagai `0`, dan sebuah set untuk id (`ids = set()`):
> 1. `status_counts`: pesanan per status, `{"paid": 2, "cancelled": 1, "delivered": 1}` (baris penghitung dari pelajaran ini).
> 2. `revenue`: jumlah total, sebagai angka, dari pesanan yang statusnya bukan `"cancelled"` dan bukan `"refunded"`.
> 3. `customer_ids`: nilai `customer_id` yang berbeda sebagai bilangan bulat, dari yang terkecil (isi set di dalam perulangan dengan `.add(...)`, yang memasukkan satu nilai ke set, lalu pakai `sorted`).
> 4. `batches`: `items` dipotong menjadi bagian berisi paling banyak `batch_size`, berurutan, `[[1, 2], [3, 4], [5]]` (`range` dengan langkah, dan slice).
> Jalankan file, lalu periksa langkahnya:
> `pytest labs/mod-0-0/test_practice.py -k Step4 -v`
> Anda seharusnya melihat `{'paid': 2, 'cancelled': 1, 'delivered': 1}`, `235000`, `[3, 5, 7]`, dan `[[1, 2], [3, 4], [5]]`. Ketika ke-15 pemeriksaan Bagian A lulus (`pytest labs/mod-0-0/test_practice.py -v`), Anda sudah menulis, dengan kode biasa, isi dari apa yang diubah Bagian B menjadi fungsi.

## @part Fungsi, error, dan file

## @lesson Fungsi: def, parameter, dan return
Lihat loop yang menjumlahkan total. Kalau Anda butuh jumlah yang sama di lima tempat, Anda tidak menyalin lima loop. Anda memberi baris-baris itu sebuah **nama** dan memakainya kembali. Itulah fungsi, dan ia ada karena tiga alasan: **pemakaian ulang** (tulis sekali), **kejelasan** (nama yang baik menjelaskan tujuannya, sehingga `total_revenue(orders)` terbaca seperti kalimat), dan **pengujian** (fungsi kecil dengan satu input dan satu output bisa diperiksa otomatis, begitulah lab bekerja).

### def: beri nama pada beberapa baris

`def` berarti "mendefinisikan". Baris yang menjorok di bawahnya adalah **badan** fungsi. Mendefinisikan fungsi **tidak** menjalankannya, hanya menjelaskannya. Untuk menjalankan badannya Anda **memanggil** fungsi dengan menulis namanya diikuti kurung:

```python
def say_hello():
    print("Halo")

say_hello()
say_hello()
```

:::trace Definisikan sekali, panggil dua kali
@code
def say_hello():
    print("Hello")

say_hello()
say_hello()
@notes
1 | `def` hanya menjelaskan fungsi dan memberinya nama. Belum ada yang tercetak.
4 | Sebuah panggilan: Python melompat ke badan fungsi. Lihat kotak baru di kanan: setiap panggilan mendapat ruangnya sendiri untuk variabelnya.
2 | Badan fungsi berjalan.
5 | Dipanggil lagi: badan yang sama berjalan untuk kedua kalinya.
:::

:::drill python Definisikan dan panggil
Definisikan fungsi `show_paid` yang mencetak kata `paid`. Lalu panggil sekali.
@starter
# tulis fungsi dan panggilan Anda di bawah baris ini

@check
defines("show_paid") ## Definisikan fungsi bernama show_paid: def show_paid():
out == "paid" ## Memanggilnya sekali harus mencetak: paid
calls("show_paid") ## Panggil fungsinya: show_paid()
@hint
```python
def show_paid():
    print("paid")

show_paid()
```
@solution
def show_paid():
    print("paid")

show_paid()
:::

### Parameter: beri fungsi sebuah input

Di antara kurung Anda mendaftar **parameter**: nama untuk input. Ketika Anda memanggil fungsi, nilai yang Anda berikan (**argumen**) ditempelkan pada nama parameter selama panggilan itu.

```python
def show_total(total):
    print("Rp", total)

show_total(5000)       # total adalah 5000 selama panggilan ini
show_total(7500)       # total adalah 7500 selama panggilan ini
```

:::drill python Fungsi dengan input
Definisikan `show_label(label)` yang mencetak `Label: ` diikuti label-nya (untuk `"Kopi"` ia mencetak `Label: Kopi`). Lalu panggil dengan `"Kopi"`.
@starter
# tulis fungsi dan panggilan Anda di bawah baris ini

@check
defines("show_label") ## Definisikan fungsi bernama show_label dengan satu parameter.
out == "Label: Kopi" ## Memanggil show_label("Kopi") harus mencetak: Label: Kopi
printed_by(show_label, "Teh") == "Label: Teh" ## show_label("Teh") harus mencetak: Label: Teh (pakai parameternya, jangan mengetik Kopi di dalam fungsi).
@hint
```python
def show_label(label):
    print("Label:", label)
```
`print` menaruh spasi di antara nilainya, jadi `print("Label:", label)` menghasilkan `Label: Kopi`.
@solution
def show_label(label):
    print("Label:", label)

show_label("Kopi")
:::

### return: serahkan jawabannya kembali

`print` hanya **menampilkan** sesuatu di layar; program tidak bisa memakainya sesudahnya. `return` **menyerahkan nilai kembali** kepada kode yang memanggil fungsi, sehingga bisa disimpan, dibandingkan, atau diteruskan. Fungsi yang mencetak tetapi tidak me-return memberi `None` kepada pemanggilnya. Pipeline berjalan tanpa layar, jadi fungsi harus **me-return** hasilnya.

Fungsi juga bisa mengembalikan **dua nilai sekaligus** (sebagai tuple dari Pelajaran 2) dipisahkan koma, lalu pemanggil membongkar keduanya:

```python
def split_non_negative(numbers):
    valid, invalid = [], []
    for n in numbers:
        if n >= 0:
            valid.append(n)
        else:
            invalid.append(n)
    return valid, invalid

good, bad = split_non_negative([10, -5, 20])   # good adalah [10, 20], bad adalah [-5]
```

:::trace return menyerahkan nilai kembali
@code
def double(n):
    result = n * 2
    return result

x = double(4)
print(x)
@notes
5 | Panggilan `double(4)`: `n` akan bernilai 4 di dalam fungsi.
2 | Fungsi menghitung `n * 2` dan menyimpannya di `result`. `result` ini hanya ada di dalam fungsi.
3 | `return` menyerahkan nilainya kembali dan meninggalkan fungsi.
6 | Kembali di luar: `x` sekarang berisi apa yang dikembalikan fungsi (8).
:::

:::ask Apa yang akan tercetak?
```python
def double(n):
    print(n * 2)

x = double(4)
print(x)
```
@options
8
* 8 lalu None
8 lalu 8
@why
Versi ini **mencetak** 8 di dalam fungsi (itu baris pertama), tetapi tidak me-`return` apa pun. Fungsi tanpa `return` memberi `None`, jadi `x` adalah `None` dan baris terakhir mencetak `None`. Mencetak untuk manusia; `return` untuk program.
:::

:::drill python Return, bukan print
Tulis `double(n)` supaya ia **me-return** dua kali `n` (jangan mencetak di dalamnya).
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("double") ## Definisikan fungsi bernama double dengan satu parameter.
double(4) == 8 ## double(4) harus mengembalikan 8 (pakai return).
double(0) == 0 ## double(0) harus mengembalikan 0.
double(2.5) == 5.0 ## double(2.5) harus mengembalikan 5.0.
has_node("Return") ## Pakai return untuk menyerahkan jawabannya kembali.
@hint
```python
def double(n):
    return n * 2
```
@solution
def double(n):
    return n * 2
:::

:::drill python Dua input
Tulis `total_price(price, quantity)` yang me-return harga dikali jumlah.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("total_price") ## Definisikan fungsi bernama total_price dengan dua parameter.
total_price(25000, 3) == 75000 ## total_price(25000, 3) harus mengembalikan 75000.
total_price(10, 0) == 0 ## total_price(10, 0) harus mengembalikan 0.
has_node("Return") ## Pakai return untuk menyerahkan jawabannya kembali.
@hint
Dua parameter dipisahkan koma: `def total_price(price, quantity):`.
@solution
def total_price(price, quantity):
    return price * quantity
:::

### Nilai default

`def format_money(amount, symbol="Rp"):` berarti pemanggil boleh menghilangkan `symbol`; maka nilainya `"Rp"`.

:::drill python Nilai default
Tulis `format_money(amount, symbol="Rp")` yang me-return simbol, sebuah spasi, dan jumlahnya: `format_money(500)` menghasilkan `"Rp 500"`, dan `format_money(5, "USD")` menghasilkan `"USD 5"`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("format_money") ## Definisikan fungsi bernama format_money.
format_money(500) == "Rp 500" ## format_money(500) harus mengembalikan "Rp 500".
format_money(5, "USD") == "USD 5" ## format_money(5, "USD") harus mengembalikan "USD 5".
format_money(7, symbol="SGD") == "SGD 7" ## Anda juga bisa menamai argumennya: format_money(7, symbol="SGD").
@hint
```python
def format_money(amount, symbol="Rp"):
    return f"{symbol} {amount}"
```
@solution
def format_money(amount, symbol="Rp"):
    return f"{symbol} {amount}"
:::

### Fungsi yang menjawab ya atau tidak

Fungsi yang me-return `True` atau `False` memberi nama pada sebuah pertanyaan. Dengan begitu loop Anda terbaca seperti kalimat.

:::drill python Fungsi ya atau tidak
Tulis `is_paid(order)` yang me-return `True` ketika `"status"` pesanan adalah `"paid"`, dan `False` kalau tidak.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("is_paid") ## Definisikan fungsi bernama is_paid dengan satu parameter.
is_paid({"status": "paid"}) is True ## is_paid({"status": "paid"}) harus mengembalikan True.
is_paid({"status": "shipped"}) is False ## is_paid({"status": "shipped"}) harus mengembalikan False.
@hint
Kembalikan jawaban dari pertanyaannya sendiri: `return order["status"] == "paid"`.
@solution
def is_paid(order):
    return order["status"] == "paid"
:::

:::drill python Pakai fungsi Anda sendiri
`is_paid` sudah ditulis untuk Anda. Pakai dalam loop untuk membuat `paid_count` berisi jumlah pesanan paid di `orders`.
@starter
def is_paid(order):
    return order["status"] == "paid"

orders = [{"status": "paid"}, {"status": "cancelled"}, {"status": "paid"}]
paid_count = 0
# tulis loop Anda di bawah baris ini

@check
paid_count == 2 ## `paid_count` harus 2.
calls("is_paid") ## Panggil is_paid(order) di dalam loop.
rerun_with("orders", [{"status": "shipped"}])["paid_count"] == 0 ## Tanpa pesanan paid, `paid_count` harus tetap 0.
@hint
```python
for order in orders:
    if is_paid(order):
        paid_count = paid_count + 1
```
@solution
def is_paid(order):
    return order["status"] == "paid"

orders = [{"status": "paid"}, {"status": "cancelled"}, {"status": "paid"}]
paid_count = 0
for order in orders:
    if is_paid(order):
        paid_count = paid_count + 1
:::

### Nama di dalam fungsi tetap di dalam

**Scope**: nama yang dibuat di dalam fungsi hanya ada selama fungsi berjalan; dunia luar tidak bisa melihatnya. Itu fitur: fungsi tidak bisa tanpa sengaja merusak variabel Anda yang lain. Pilih fungsi yang hanya bergantung pada inputnya dan me-return hasil tanpa mengubah apa pun yang lain (**fungsi murni**). Fungsi seperti itu mudah diuji dan aman dijalankan dua kali, sifat yang dibutuhkan pipeline (Modul 0.2: idempotensi).

:::ask Apa yang akan tercetak?
```python
def make_label():
    label = "Rp 500"

make_label()
print(label)
```
@options
`Rp 500`, fungsi yang membuatnya
`None`, fungsi tidak mengembalikan apa-apa
* error: `label` hanya lokal
@why
`label` dibuat **di dalam** `make_label`, dan ia hilang ketika fungsi selesai. Baris terakhir mencari `label` di luar dan Python berhenti dengan `NameError: name 'label' is not defined`. Untuk mengeluarkan nilainya, fungsi harus me-`return`-nya.
:::

### Jebakan yang perlu dikenal sekarang: list sebagai nilai default

Jangan pernah memakai nilai *mutable* (list atau dictionary) sebagai default: `def add(item, box=[]):`. Python membuat list itu **sekali**, ketika baris `def` dibaca, dan setiap panggilan yang tidak mengisi `box` berbagi list yang sama. Tebak dulu:

:::ask Apa yang dicetak panggilan kedua?
```python
def add(item, box=[]):
    box.append(item)
    return box

print(add(1))
print(add(2))
```
@options
* [1, 2]
[2]
[1]
@why
List default dibuat sekali dan **disimpan**. Panggilan pertama memasukkan 1; panggilan kedua mulai dengan list yang sama itu, yang sudah berisi 1, lalu menambahkan 2. Lihat di animasi berikutnya: list-nya tetap berlabel sama, `list#1`.
:::

:::trace Satu list, dipakai bersama oleh setiap panggilan
@code
def add(item, box=[]):
    box.append(item)
    return box

print(add(1))
print(add(2))
@notes
1 | Default `[]` dibuat **sekarang**, sekali, ketika baris `def` dibaca.
6 | Panggilan kedua: `box` tidak diberikan, jadi ia adalah list yang **sama** seperti sebelumnya (label sama), yang sudah berisi 1.
:::

Perbaikannya: pakai `None` sebagai default dan buat list baru di dalam: `if box is None: box = []`. Lebih baik lagi, saat pemanggil memberikan list sendiri, `box.append(item)` ikut mengubah list asli mereka, mengembalikan `box + [item]` membuat list **baru** sebagai gantinya (misalnya, `["a", "b"] + ["c"]` menghasilkan `["a", "b", "c"]` tanpa menyentuh list milik pemanggil). Skenario chaos modul ini menunjukkan apa yang dilakukan bug ini pada pipeline sungguhan, dan lab punya tes untuk keduanya.

:::drill python Perbaiki list yang dipakai bersama
`add` punya jebakannya. Perbaiki supaya setiap panggilan tanpa argumen kedua mulai dengan list kosong yang **baru**: `add(1)` menghasilkan `[1]` lalu `add(2)` menghasilkan `[2]`.
@starter
def add(item, box=[]):
    box.append(item)
    return box

# perbaiki bug pada kode di atas
@check
add(1) == [1] ## add(1) harus mengembalikan [1].
add(2) == [2] ## add(2) harus mengembalikan [2], bukan [1, 2]: setiap panggilan tanpa list harus mulai dari baru.
add(3, [1, 2]) == [1, 2, 3] ## add(3, [1, 2]) tetap harus mengembalikan [1, 2, 3].
"box=None" in code.replace(" ", "") ## Pakai None sebagai default: box=None, dan buat list di dalam fungsi.
@hint
```python
def add(item, box=None):
    if box is None:
        box = []
    box.append(item)
    return box
```
@solution
def add(item, box=None):
    if box is None:
        box = []
    box.append(item)
    return box
:::

**Mengetik fungsi di prompt `>>>`.** Setelah baris yang berakhir dengan `:`, seperti `def double(n):`, Python menampilkan `...` dan menjorokkan baris berikutnya untuk Anda. Ketika fungsi selesai, tekan **Enter sekali lagi pada baris kosong** untuk menyelesaikannya; tanpa baris kosong itu, apa pun yang Anda ketik berikutnya menjadi bagian dari fungsi. Untuk yang lebih panjang dari dua baris, file lebih mudah.

> 🛠 **Coba sendiri (8 menit, di file `fn.py`).** Tebak dulu setiap output di kepala Anda, baru jalankan.
> 1. Tulis `def show_square(n): print(n * n)` dan `def give_square(n): return n * n` (masing-masing di barisnya sendiri seperti biasa). Jalankan `a = show_square(4)` dan `b = give_square(4)`, lalu `print(a, b)`.
> 2. Tulis `def add(item, box=[]): box.append(item); return box` (dengan baris yang benar) dan jalankan `print(add(1))`, `print(add(2))`, `print(add(3))`. Lalu perbaiki agar setiap pemanggilan tanpa argumen kedua mulai dengan list kosong yang baru.
> 3. Tulis `total(orders)` yang menjumlahkan `int(order["total_idr"])` dari list dict pesanan, tanpa `print` di dalamnya. Periksa dengan `print(total([{"total_idr": "100"}, {"total_idr": "250"}]) == 350)` dan `print(total([]) == 0)`.
>
> **Seharusnya Anda melihat:** `16` dicetak oleh langkah 1, lalu `None 16` (`print` menampilkan, `return` mengembalikan); `add` yang salah mencetak `[1]`, `[1, 2]`, `[1, 2, 3]` dan yang sudah Anda perbaiki `[1]`, `[2]`, `[3]`; kedua pemeriksaan di langkah 3 bernilai `True`.

> 💡 **Jeda Praktik 5 (Bagian B: buka fungsinya):**
> Bagian B adalah separuh kedua lab: tab **Bagian B** pada Pratinjau browser, atau `labs/mod-0-0/basics.py` di editor Anda. Setiap fungsi di sana diawali seperti `def format_rupiah(amount):`, lalu deskripsinya di antara `"""`, lalu `raise NotImplementedError(...)`: penanda tempat yang berarti "belum ditulis". Hapus baris itu dan taruh kode yang Anda tulis di Bagian A di tempatnya, dengan dua perubahan: nilainya masuk sebagai parameter (`amount`, `orders`) alih-alih variabel di bagian atas file, dan jawabannya keluar dengan `return` alih-alih disimpan di variabel.
> Sebelumnya, di Bagian A (Langkah 1):
>
> ```python
> amount = 1250000                 # diberikan kepada Anda
> formatted = ...                  # baris Anda dari Langkah 1
> ```
>
> Sesudahnya, di Bagian B:
>
> ```python
> def format_rupiah(amount):       # tes yang memberi `amount`
>     text = ...                   # baris yang sama, dijorokkan
>     return text
> ```
>
> Sebuah tes memanggil `format_rupiah(1250000)` dan membandingkan apa yang Anda `return` dengan `"Rp 1.250.000"`. Lalu tambahkan `if` dari Langkah 3 untuk angka negatif.
> Lakukan untuk `format_rupiah` (Langkah 1 dan 3), `count_by_status` (Langkah 4), `unique_customer_ids` (Langkah 2 dan 4), `average_total` (rata-rata dari Langkah 3, atas total pesanan), `total_revenue` dan `batches` (Langkah 4), serta `top_customers` (`sorted` dengan `key` dari Pelajaran 4). Di Pratinjau browser klik **Jalankan tes**; di jalur terminal, `pytest` menjalankan pemeriksaan otomatis (`-k TestFormatRupiah` menjalankan satu kelompok itu saja, `-v` mencetak nama setiap tes):
> `pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v`
> Lalu lanjut ke Pelajaran 6.

## @lesson Saat ada yang salah: error dan try/except
Error bukan kegagalan pembelajar; error adalah program yang memberi tahu dengan tepat apa yang tidak bisa ia lakukan. Belajarlah membacanya, dan error menjadi hal paling berguna di layar Anda.

### Membaca sebuah error

Ketika Python berhenti ia mencetak **traceback**: jalur panggilan yang menuju masalah. **Bacalah dari bawah.** Baris terakhir menyebut jenis error dan pesannya; baris di atasnya menunjukkan di mana itu terjadi, dan baris terakhir yang menunjuk ke kode *Anda* biasanya tempat yang harus dilihat.

```python
order = {"order_id": "1001", "status": "paid"}
print(order["total_idr"])
```

Jalankan yang itu dengan tombol di bawah kode: baris terakhirnya berbunyi `KeyError: 'total_idr'`, karena dictionary tidak punya key tersebut. Error yang akan sering Anda temui:

| Error | Artinya | Contoh |
|---|---|---|
| `ValueError` | tipe benar, nilai mustahil | `int("abc")` |
| `TypeError` | tipe yang salah untuk aksi ini | `"a" + 1` |
| `KeyError` | key dictionary tidak ada | `order["note"]` |
| `IndexError` | posisi list terlalu besar | `[1, 2, 3][5]` |
| `ZeroDivisionError` | membagi dengan nol | `10 / 0` |
| `FileNotFoundError` | file tidak ada | `open("nope.csv")` |
| `NameError` | nama yang tidak dikenal Python (sering salah ketik) | `totl` |

:::ask Error apa ini?
```python
number = int("Rp 1.250.000")
```
@options
TypeError
KeyError
* ValueError
@why
`int` adalah alat yang tepat untuk teks, tetapi teks ini bukan bilangan bulat: **tipenya** baik dan **nilainya** mustahil. Itu `ValueError`. `TypeError` misalnya menjumlahkan teks dan angka.
:::

:::ask Error apa ini?
```python
statuses = ["paid", "cancelled", "paid"]
print(statuses[3])
```
@options
* IndexError
KeyError
ValueError
@why
List punya tiga item, di posisi 0, 1, dan 2. Posisi 3 tidak ada: `IndexError: list index out of range`. `KeyError` adalah gagasan yang sama untuk key dictionary.
:::

### try / except: tangkap error yang Anda duga

Anda bisa **menangkap** error yang Anda duga dan memutuskan apa yang dilakukan alih-alih berhenti:

:::trace try dan except
@code
text = "abc"
try:
    n = int(text)
    print("converted")
except ValueError:
    n = 0
print(n)
@notes
3 | `int("abc")` gagal dengan `ValueError`. Sisa blok `try` ditinggalkan.
5 | Python melompat ke `except` yang cocok. Baris `print("converted")` tidak pernah dijalankan.
7 | Program berlanjut seperti biasa, dengan `n` bernilai 0.
:::

Cara kerjanya: Python mencoba blok di bawah `try`. Kalau semuanya berhasil, `except` dilewati. Kalau terjadi `ValueError`, sisa blok `try` ditinggalkan dan blok `except` berjalan sebagai gantinya.

:::drill python Tangkap nilai yang buruk
Tulis `to_number(text)` yang me-return `int(text)`, atau `0` ketika teksnya bukan bilangan bulat.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("to_number") ## Definisikan fungsi bernama to_number dengan satu parameter.
to_number("42") == 42 ## to_number("42") harus mengembalikan 42.
to_number("abc") == 0 ## to_number("abc") harus mengembalikan 0: errornya tertangkap.
to_number("") == 0 ## to_number("") harus mengembalikan 0.
has_node("Try") ## Pakai try / except.
@hint
```python
def to_number(text):
    try:
        return int(text)
    except ValueError:
        return 0
```
@solution
def to_number(text):
    try:
        return int(text)
    except ValueError:
        return 0
:::

### Tangkap hanya yang Anda duga

Tiga aturan yang memisahkan pipeline yang baik dari yang berbahaya:

1. **Tangkap error spesifik yang Anda duga.** `except ValueError` adalah sebuah rencana. `except Exception: pass` (atau `except:` tanpa nama) adalah keputusan untuk menyembunyikan setiap bug di masa depan: salah ketik, file hilang, masalah data sungguhan, semuanya lenyap diam-diam, dan angka salah muncul tanpa tanda masalah. Modul 1.2 menunjukkan betapa mahalnya itu.
2. **Jaga blok `try` tetap kecil**: hanya baris yang bisa gagal.
3. **Munculkan error dengan sengaja** ketika fungsi Anda tidak bisa mengerjakan tugasnya: `raise ValueError("total must not be negative")`. Gagal dengan keras sejak awal lebih baik daripada meneruskan data buruk.

:::drill python Sembunyikan hanya yang Anda duga
`to_number` menangkap **setiap** jenis error. Nilai yang hilang (`None`) adalah masalah yang berbeda dan tidak boleh disembunyikan sebagai `0`: `int(None)` memunculkan `TypeError`. Ubah fungsinya supaya hanya menangkap `ValueError`.
@starter
def to_number(text):
    try:
        return int(text)
    except Exception:
        return 0

# perbaiki bug pada kode di atas
@check
to_number("abc") == 0 ## to_number("abc") tetap harus mengembalikan 0.
raises_error(TypeError, to_number, None) ## to_number(None) harus memunculkan TypeError (jangan disembunyikan sebagai 0). Tangkap hanya ValueError.
@hint
Ubah `except Exception:` menjadi `except ValueError:`.
@solution
def to_number(text):
    try:
        return int(text)
    except ValueError:
        return 0
:::

:::drill python Munculkan error dengan sengaja
Tulis `check_total(total)` yang me-return `total` ketika tidak negatif, dan **memunculkan** `ValueError("total must not be negative")` ketika di bawah nol.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("check_total") ## Definisikan fungsi bernama check_total dengan satu parameter.
check_total(500) == 500 ## check_total(500) harus mengembalikan 500.
check_total(0) == 0 ## check_total(0) harus mengembalikan 0: nol diperbolehkan.
raises_error(ValueError, check_total, -1) ## check_total(-1) harus memunculkan ValueError.
@hint
```python
def check_total(total):
    if total < 0:
        raise ValueError("total must not be negative")
    return total
```
@solution
def check_total(total):
    if total < 0:
        raise ValueError("total must not be negative")
    return total
:::

### Baris buruk adalah data, bug bukan

Baris buruk dari pelanggan adalah data yang *diduga*, jadi Anda menanganinya: sisihkan **beserta alasannya**, jangan pernah membuangnya diam-diam. File yang hilang atau kesalahan pemrograman *tidak* diduga, jadi biarkan gagal dengan keras.

:::drill python Sisihkan yang buruk
`rows` berisi nilai sebagai teks; sebagian bukan angka. Isi `good` dengan angka-angkanya (sebagai `int`) dan `bad` dengan teks yang tidak bisa diubah, keduanya dalam urutan semula. Pakai `try` / `except ValueError` di dalam loop.
@starter
rows = ["10", "x", "25", "", "7"]
good = []
bad = []
# tulis loop Anda di bawah baris ini

@check
good == [10, 25, 7] ## `good` harus [10, 25, 7].
bad == ["x", ""] ## `bad` harus ['x', '']: tidak ada yang dibuang diam-diam.
rerun_with("rows", ["1", "b"])["good"] == [1] and rerun_with("rows", ["1", "b"])["bad"] == ["b"] ## Dengan ["1", "b"], `good` harus [1] dan `bad` harus ['b'].
has_node("Try") ## Pakai try / except di dalam loop.
@hint
```python
for text in rows:
    try:
        good.append(int(text))
    except ValueError:
        bad.append(text)
```
@solution
rows = ["10", "x", "25", "", "7"]
good = []
bad = []
for text in rows:
    try:
        good.append(int(text))
    except ValueError:
        bad.append(text)
:::

> 💡 **Jeda Praktik 6 (Bagian B):**
> Terapkan fungsi murni, penanganan error, dan pencegahan bug mutable default:
> 1. Kerjakan `safe_int(text, default=None)` dengan blok `try / except ValueError`.
> 2. Kerjakan `add_to_batch(order, batch=None)` dengan `if batch is None: batch = []`, lalu kembalikan list **baru** dengan `batch + [order]` supaya Anda tidak mengubah list yang diberikan pemanggil.
> 3. Kerjakan `split_valid(orders)` menggunakan fungsi `safe_int` yang Anda buat.
> Klik **Jalankan tes**; ketiga grup itu harus bertanda ✓ (jalur terminal):
> `pytest labs/mod-0-0/test_lab.py -k "TestSafeInt or TestAddToBatch or TestSplitValid" -v`

## @lesson File, import, dan menjalankan skrip
Program membaca file, dan seorang data engineer membaca banyak sekali. Pola standarnya memakai `open`, `with`, dan sebuah pembaca. Materi ini membangunnya satu bagian demi satu bagian. Latihannya memberi Anda file contoh kecil, jadi Anda bisa mencoba semuanya di browser.

### Membuka file dan membaca teksnya

```python
with open("note.txt", encoding="utf-8") as f:
    text = f.read()
```

Mengapa setiap bagian. `open` memberi Anda sambungan ke file. **`with`** menjamin file ditutup ketika blok selesai, bahkan jika terjadi error di dalamnya, sehingga Anda tidak pernah membiarkan file terbuka (masalah nyata pada pekerjaan yang berjalan lama). `encoding="utf-8"` menyatakan bagaimana byte menjadi teks; kalau dihilangkan, program Anda berperilaku berbeda di komputer yang berbeda. `f.read()` memberi seluruh isi sebagai satu teks.

:::drill python Baca sebuah file
File `note.txt` ada di sebelah kode Anda. Baca seluruh teksnya ke dalam `text`, dengan `with open(...)`.
@file note.txt
Kopi Susu: 25000
@starter
# tulis baris Anda di bawah baris ini

@check
text.strip() == "Kopi Susu: 25000" ## `text` harus berisi isi note.txt: Kopi Susu: 25000
has_node("With") ## Pakai blok with, supaya file selalu ditutup.
calls("open") ## Pakai open("note.txt", ...).
@hint
```python
with open("note.txt", encoding="utf-8") as f:
    text = f.read()
```
@solution
with open("note.txt", encoding="utf-8") as f:
    text = f.read()
:::

### File CSV: baris sebagai dictionary

File CSV adalah teks dengan satu baris per baris data dan koma di antara nilai; baris pertama berisi nama kolom. Modul `csv` membacanya. `csv.DictReader(f)` mengubah setiap baris menjadi dictionary, memakai baris header sebagai key, sehingga Anda mendapat persis **list berisi dictionary** dari Materi 2. `newline=""` adalah yang diinginkan modul csv supaya pemisah baris di dalam nilai yang dikutip tetap utuh. Semua nilai berupa teks; mengubahnya adalah tugas Anda. (`import csv` di bagian atas memuat kotak perkakas CSV bawaan Python, bagian `import` di bawah menjelaskan cara kerja import.)

:::trace Dari file CSV ke list berisi dictionary
@file drinks.csv
name,price_idr
Kopi,25000
Teh,18000
@code
import csv

with open("drinks.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

print(rows[0])
@notes
3 | File dibuka. `with` akan menutupnya untuk kita di akhir blok.
4 | `csv.DictReader` membaca baris header (`name,price_idr`) dan mengubah setiap baris berikutnya menjadi dictionary. `list(...)` mengumpulkan semuanya.
6 | `rows[0]` adalah baris pertama: dictionary dengan nama header sebagai key. Kedua nilainya berupa teks.
:::

:::drill python Baca sebuah CSV
`products.csv` ada di sebelah kode Anda (kolom `sku`, `name`, dan `price_idr`). Baca ke dalam `rows`, sebuah list berisi dictionary, lalu cetak berapa banyak barisnya.
@file products.csv
sku,name,price_idr
K1,Kopi Susu,25000
K2,Americano,22000
K3,Teh Tarik,18000
@starter
import csv
# tulis baris Anda di bawah baris ini

@check
len(rows) == 3 ## `rows` harus berisi 3 dictionary, satu per baris di bawah header.
rows[0]["name"] == "Kopi Susu" ## "name" pada baris pertama harus Kopi Susu.
out == "3" ## Cetak jumlah barisnya: print(len(rows)).
calls("DictReader") ## Pakai csv.DictReader(f).
@hint
```python
with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(len(rows))
```
@solution
import csv
with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(len(rows))
:::

:::drill python Jumlahkan sebuah kolom
`rows` sudah dibaca untuk Anda. Buat `total` berisi jumlah kolom `price_idr` **sebagai angka**.
@file products.csv
sku,name,price_idr
K1,Kopi Susu,25000
K2,Americano,22000
K3,Teh Tarik,18000
@starter
import csv

with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

total = 0
# tulis loop Anda di bawah baris ini

@check
total == 65000 ## `total` harus 65000: ketiga harga sebagai angka.
has_node("For") ## Pakai loop for.
calls("int") ## Nilainya teks: ubah dengan int(...).
@hint
```python
for row in rows:
    total = total + int(row["price_idr"])
```
@solution
import csv

with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

total = 0
for row in rows:
    total = total + int(row["price_idr"])
:::

### Menulis file

Buka dengan `"w"` untuk **menulis**. Hati-hati: `"w"` mengosongkan file lebih dulu. `f.write(text)` memasukkan teksnya; tambahkan `\n` untuk pemisah baris.

:::drill python Tulis sebuah laporan
Tulis teks `Total: 65000` ke file baru `report.txt`, dengan `with open("report.txt", "w", ...)`.
@starter
# tulis baris Anda di bawah baris ini

@check
read_file("report.txt").strip() == "Total: 65000" ## report.txt harus berisi: Total: 65000
has_node("With") ## Pakai blok with.
@hint
```python
with open("report.txt", "w", encoding="utf-8") as f:
    f.write("Total: 65000")
```
@solution
with open("report.txt", "w", encoding="utf-8") as f:
    f.write("Total: 65000")
:::

### import: kode yang ditulis orang lain

**Import** membawa masuk kode yang ditulis orang lain. **Pustaka standar** (standard library) datang bersama Python dan tidak perlu dipasang: `csv`, `json`, `pathlib`, `datetime`, `statistics`. Pustaka lain (pandas untuk tabel, pydantic untuk memeriksa data) dipasang dengan `pip` (pemasang Python) ke dalam virtual environment Anda (salinan pribadi Python untuk satu proyek; Modul 0.1).

:::drill python Pakai pustaka standar
Import modul `statistics` dan buat `average` berisi rata-rata `prices` dengan `statistics.mean(...)`.
@starter
prices = [25000, 22000, 18000]
# tulis baris Anda di bawah baris ini

@check
average == 21666.666666666668 ## `average` harus rata-rata ketiga harga (sekitar 21666,67).
calls("mean") ## Pakai statistics.mean(prices).
rerun_with("prices", [10, 20])["average"] == 15 ## Dengan [10, 20], `average` harus 15.
@hint
`import statistics`, lalu `average = statistics.mean(prices)`.
@solution
import statistics

prices = [25000, 22000, 18000]
average = statistics.mean(prices)
:::

### File Anda sendiri adalah modul, dan __main__

File Anda sendiri `basics.py` juga sebuah **modul**: `import basics` menjalankannya sekali dan memberi fungsinya sebagai `basics.total_revenue(...)`. Begitulah tes lab memakai kode Anda. Anda menjalankan skrip dengan `python3 myfile.py`. Baris yang umum di bagian bawah skrip adalah:

```python
if __name__ == "__main__":
    main()
```

Python mengisi nama khusus `__name__` dengan `"__main__"` hanya ketika file *dijalankan langsung*. Ketika file lain meng-import-nya, `__name__` berisi nama modul, sehingga `main()` tidak berjalan. Efeknya: file berfungsi sebagai program sekaligus sebagai pustaka yang bisa Anda uji.

:::ask File shop.py dijalankan langsung: `python3 shop.py`
```python
# shop.py
def main():
    print("running")

if __name__ == "__main__":
    main()
```
@options
tidak ada
* running
sebuah error
@why
Dijalankan langsung, `__name__` adalah `"__main__"`, jadi `if` benar dan `main()` berjalan: `running` tercetak.
:::

:::ask File lain melakukan `import shop`. Apa yang dicetak import itu?
```python
# shop.py
def main():
    print("running")

if __name__ == "__main__":
    main()
```
@options
* tidak ada
running
sebuah error
@why
Saat di-import, `__name__` adalah `"shop"`, bukan `"__main__"`, jadi `main()` **tidak** dipanggil: import hanya membuat fungsinya tersedia. Karena itulah sebuah tes bisa meng-import file Anda tanpa memulai programnya.
:::

### Path: di mana file-nya?

Setelah `import pathlib`, pakai `pathlib.Path("data") / "orders.csv"` alih-alih menempel string. Path **relatif** relatif terhadap folder tempat Anda memulai Python, yang biasanya menjadi alasan error di bawah.

:::ask Apa yang terjadi ketika file tidak ada?
```python
with open("missing.csv", encoding="utf-8") as f:
    data = f.read()
```
@options
ValueError
* FileNotFoundError
`data` yang kosong
@why
Python berhenti dengan `FileNotFoundError: No such file or directory`. Ketika Anda melihatnya, periksa dulu **folder tempat Anda memulai Python** dan ejaan path-nya, sebelum hal lain.
:::

> 💡 **Jeda Praktik 7 (Bagian B: lengkapi lab):**
> Di `basics.py`, implementasikan fungsi terakhir `read_orders(path)` dengan `with open(...)` dan `csv.DictReader`.
> Klik **Jalankan tes** di setiap bagian, atau jalankan semuanya di terminal: ke-46 pemeriksaan seharusnya lulus, 15 di Bagian A dan 31 di Bagian B:
> `pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v`
> Pratinjau menunjukkan logika Anda benar; run di komputer Anda sendiri itulah yang dihitung. Di jalur terminal run itu sudah milik Anda: `python3 scripts/prove.py mod-0-0` mencetak kode bukti Anda.

## @lesson Menyatukan semuanya, dan cara men-debug
Sekarang Anda punya setiap bagian dari pipeline kecil: baca file (materi 7), ulangi baris-barisnya (4), putuskan apa yang valid (3), sisihkan yang buruk (6), hitung dengan dict (2), bungkus setiap langkah dalam fungsi (5). Inilah dia sebagai rencana yang bisa dibaca seperti cerita:

```python
def main(path):
    rows = read_orders(path)                 # file -> list berisi dict
    valid, invalid = split_valid(rows)       # keputusan + try/except, tidak ada yang dibuang diam-diam
    print(count_by_status(valid))            # menghitung dengan dict
    print(format_rupiah(total_revenue(valid)))
```

Perhatikan apa yang terjadi: `main` tidak berisi detail. Setiap fungsi punya satu tugas dan nama yang menyebutkannya. Beginilah pipeline profesional tetap mudah dibaca. Lihat versi kecilnya berjalan, dan perhatikan kotak di kanan: `main()` memanggil `total_revenue(...)`, dan setiap panggilan mendapat kotaknya sendiri dengan variabelnya sendiri.

:::trace Pipeline kecil, fungsi demi fungsi
@code
def read_orders():
    return [{"status": "paid", "total": "100"}, {"status": "cancelled", "total": "50"}]

def total_revenue(orders):
    total = 0
    for order in orders:
        if order["status"] != "cancelled":
            total = total + int(order["total"])
    return total

def main():
    orders = read_orders()
    print(total_revenue(orders))

main()
@notes
15 | Program mulai di sini: semua yang di atas hanya mendefinisikan fungsi. Sekarang `main()` dipanggil.
12 | `main` pertama-tama meminta data dari `read_orders()`.
13 | Lalu ia meneruskan baris-barisnya ke `total_revenue`. Kotak baru muncul untuk panggilan itu, dengan `total`-nya sendiri.
8 | Hanya pesanan paid yang dijumlahkan: yang dibatalkan dilewati oleh `if`.
9 | `return` menyerahkan hasilnya kembali ke `main`, dan kotak `total_revenue` menghilang.
:::

### Cara membaca kode yang tidak Anda tulis

Mulai dari bawah (biasanya titik masuknya), lalu baca nama dan parameter setiap fungsi sebelum badannya. Pilih input yang sangat kecil dan **telusuri** dengan tangan, tulis nilai setiap variabel di kertas setelah setiap baris. Kalau tebakan Anda dan hasilnya berbeda, Anda menemukan baris yang Anda salah pahami. Animasi di kursus ini melakukan hal yang sama untuk Anda; alat gratis pythontutor.com melakukannya untuk kode apa pun.

### Cara men-debug

1. **Baca error dari bawah.**
2. **Reproduksi dengan input terkecil.**
3. **Cetak atau periksa nilai tepat sebelum baris yang gagal** (`print(type(x), x)` menjawab setengah dari semua bug).
4. **Ubah satu hal pada satu waktu.**
5. **Tulis tes yang gagal karena bug itu**, perbaiki kodenya, dan simpan tesnya agar bug tidak kembali.

Berlatihlah pada tiga bug kecil. Masing-masing dimulai dalam keadaan rusak: jalankan, baca apa yang dikatakannya, dan perbaiki dengan rutinitas di atas.

:::drill python Bug 1: sebuah error
Ini berhenti dengan error. Baca baris terakhir pesannya, dan perbaiki kodenya supaya `total` adalah angka `43000`.
@starter
prices = ["25000", "18000"]
total = 0
for price in prices:
    total = total + price

# perbaiki bug pada kode di atas
@check
total == 43000 ## `total` harus 43000.
type(total) is int ## `total` harus berupa angka (int).
@hint
Errornya `TypeError`: Anda tidak bisa menjumlahkan teks ke angka. Harganya teks (Materi 1): ubah setiap harga dengan `int(price)`.
@solution
prices = ["25000", "18000"]
total = 0
for price in prices:
    total = total + int(price)
:::

:::drill python Bug 2: tanpa error, hasil salah
Ini seharusnya mencetak angka 1 sampai 5, tetapi mencetak 0 sampai 4. Perbaiki, tanpa menulis angkanya dengan tangan.
@starter
for n in range(5):
    print(n)

# perbaiki bug pada kode di atas
@check
out == "1\n2\n3\n4\n5" ## Harus mencetak 1, 2, 3, 4, dan 5, masing-masing di barisnya sendiri.
has_node("For") ## Pertahankan loop for.
@hint
`range(5)` mulai dari 0 dan berhenti sebelum 5. Beri ia awal dan akhir: `range(1, 6)`.
@solution
for n in range(1, 6):
    print(n)
:::

:::drill python Bug 3: jawabannya menghilang
`add_fee` seharusnya mengembalikan harga ditambah biaya 500, tetapi ia mengembalikan `None`. Mengapa? Perbaiki.
@starter
def add_fee(price):
    price + 500

# perbaiki bug pada kode di atas
@check
add_fee(1000) == 1500 ## add_fee(1000) harus mengembalikan 1500.
add_fee(0) == 500 ## add_fee(0) harus mengembalikan 500.
@hint
Fungsi menghitung `price + 500` lalu membuang hasilnya. Kata kunci mana yang menyerahkan nilai kembali?
@solution
def add_fee(price):
    return price + 500
:::

### Tes: pandangan pertama

Tes hanyalah kode yang memanggil fungsi Anda dan membandingkan dengan jawaban yang diharapkan:

```python
def test_format_rupiah():
    assert format_rupiah(1250000) == "Rp 1.250.000"
```

`assert` memunculkan error kalau kondisinya salah, dan tidak melakukan apa-apa kalau benar. Alat tes (pytest) menemukan fungsi bernama `test_...`, menjalankan semuanya dan melaporkan mana yang gagal dan mengapa. Lab punya 46 tes seperti itu: baca tes yang gagal sebagai **spesifikasi** (ia memberi tahu persis apa yang diharapkan), bukan sebagai penghalang.

:::drill python Tulis assert Anda sendiri
`double` sudah ditulis untuk Anda. Tambahkan setidaknya **dua** baris `assert` yang memeriksanya, dengan angka berbeda. Keduanya harus lulus.
@starter
def double(n):
    return n * 2

# tulis baris assert Anda di bawah baris ini

@check
count_nodes("Assert") >= 2 ## Tulis setidaknya dua baris assert, misalnya: assert double(2) == 4
@hint
`assert double(2) == 4` dan `assert double(10) == 20`. Ketika sebuah assert benar, tidak terjadi apa-apa; ketika salah, Python berhenti dengan AssertionError.
@solution
def double(n):
    return n * 2

assert double(2) == 4
assert double(10) == 20
:::

Anda tidak akan mengingat semuanya setelah satu kali membaca, dan memang tidak seharusnya. Ketik contohnya, rusak sengaja, dan lihat pesan errornya. Setiap fungsi lab melatih satu materi; kerjakan berurutan dan jalankan tesnya setelah masing-masing.

> 🛠 **Coba sendiri (15 menit).** Jalankan `python3 labs/mod-0-0/debug_me.py`. Isinya tiga fungsi kecil, masing-masing dengan satu bug, dan mencetak PASS atau FAIL untuk setiap fungsi. Perbaiki satu per satu dengan rutinitas dari pelajaran ini: baca error dari bawah, ulangi dengan input sekecil mungkin, periksa nilainya tepat sebelum baris yang gagal. Jangan menulis ulang fungsinya; temukan bug-nya.
>
> **Seharusnya Anda melihat:** tiga baris FAIL di awal (satu `TypeError`, dua jawaban salah) dan `all three fixed` di akhir. Lalu tulis satu kalimat per bug: petunjuk apa yang membawa Anda ke sana? Kalimat itulah keahliannya.

**Di mana gagasan-gagasan ini muncul dalam keseharian seorang data engineer.** Wajar bertanya apa hubungan latihan kecil ini dengan pekerjaannya. Hampir setiap tugas yang akan diberikan kepada Anda adalah gagasan-gagasan yang sama, hanya lebih besar:
- **Tipe:** data datang sebagai teks; Anda memberi setiap nilai tipe yang benar sebelum hal lain, atau total keluar salah tanpa error.
- **List dan dict:** sebuah file atau tabel adalah list berisi baris; setiap baris adalah dict dari kolom ke nilai.
- **Menghitung dengan dict:** "berapa banyak per kota, per status, per hari" adalah pertanyaan paling umum dalam data; SQL (bahasa untuk mengajukan pertanyaan ke database; Modul 0.3) melakukan hal yang sama dengan `GROUP BY`.
- **Set:** menghapus duplikat, dan bertanya "apakah kita sudah memuat ini?".
- **if dan try/except:** memutuskan baris mana yang valid, dan menyisihkan yang buruk alih-alih crash atau membuangnya diam-diam.
- **Fungsi dengan tes:** setiap langkah pipeline adalah fungsi, dan tesnya adalah cara Anda tahu ia masih bekerja setelah perubahan besok.

Lab berkembang dari sini: di Modul 1.2 gagasan yang sama menjadi pipeline sungguhan yang membaca file, mengonversi tipe, mengkarantina baris buruk, dan bisa dijalankan ulang dengan aman. Kalau sesuatu di modul ini masih terasa belum jelas, itu wajar setelah satu kali membaca: baca ulang materi yang Jeda Praktiknya paling sulit, dan ulangi Coba Sendirinya.

## @lab Lab: dari kode biasa ke sebelas fungsi kecil pada pesanan KopiKu
Dua bagian, pada data pesanan KopiKu. **Bagian A** (setelah Pelajaran 1 sampai 4) adalah Python biasa tanpa fungsi: Anda mengisi dua belas variabel. **Bagian B** (setelah Pelajaran 5 sampai 7) mengubah gagasan yang sama menjadi sebelas fungsi kecil.

> [!IMPORTANT]
> **Versi singkat, dalam tiga langkah.**
> 1. Setelah setiap Pelajaran 1 sampai 4, buka Bagian A (file `practice.py`, atau tab **Bagian A** pada pratinjau di bawah) dan ganti `None` pada langkah pelajaran itu dengan kode Anda sendiri.
> 2. Setelah Pelajaran 5 sampai 7, lakukan hal yang sama untuk fungsi-fungsi Bagian B (file `basics.py`, atau tab **Bagian B**).
> 3. Tekan **Run tests** (atau ketik baris `pytest` di terminal Anda). Setiap ✗ memberi tahu apa yang salah: perbaiki satu hal, jalankan lagi. Teks yang lebih panjang di bawah menjelaskan tiap bagian; baca sekali sekarang, dan kembali ke sana saat ada yang kurang jelas.

**Apa itu lab.** Setiap bagian adalah file yang Anda edit dan file **tes** yang memeriksanya. Di Bagian A, `practice.py` memberi Anda data dan dua belas variabel yang diisi `None`; Anda mengganti setiap `None` dengan kode Anda sendiri, dan `test_practice.py` menjalankan file Anda, dengan beberapa kumpulan data berbeda menggantikan yang diberikan, lalu memeriksa setiap variabel. Di Bagian B, `basics.py` berisi sebelas fungsi yang isinya kosong (masing-masing hanya berisi `raise NotImplementedError`), dan `test_lab.py` memanggil setiap fungsi dengan contoh, misalnya "`format_rupiah(1250000)` harus menghasilkan `"Rp 1.250.000"`". Sebuah pemeriksaan ✓ jika kode Anda memberi jawaban yang diharapkan, dan ✗ jika memberi jawaban lain atau crash. Anda selesai ketika ke-46 lulus: 15 di Bagian A dan 31 di Bagian B.

**Di mana mengerjakannya: pilih satu dari dua jalur.**

- **Jalur A, pratinjau browser** (tanpa instalasi, mulai di sini jika Anda belum menyiapkan terminal): kotak editor di bawah pada halaman ini punya tombol **Bagian A / Bagian B**. **Jalankan tes** menjalankan bagian yang sedang Anda buka, dan daftar di bawah tombol menampilkan setiap kelompok pemeriksaan (satu kelompok per langkah atau fungsi) sebagai ✓ atau ✗. Anda bisa menyelesaikan semua latihan Modul 0.0 di sini lebih dulu; begitu Modul 0.1 menyiapkan terminal lokal dan `venv` Anda, Anda menjalankan ulang lab dan `prove.py` secara lokal untuk mengunci kode bukti Anda (lulus di pratinjau saja belum menghasilkan kode bukti).
- **Jalur B, terminal Anda sendiri** (disarankan jika Anda sudah mengikuti Mulai di sini atau Modul 0.1): beginilah Anda akan bekerja di sepanjang kursus, dan menjalankan `prove.py` di sini mengunci kode bukti Anda. Siapkan sekali, di terminal:

```bash
cd ~/projects/DECourse                     # folder kursus Anda
python3 -m venv venv                       # sekali: Python pribadi untuk kursus
source venv/bin/activate                   # setiap terminal baru
python -m pip install -r labs/mod-0-0/requirements.txt    # sekali: pytest
```

  Pakai folder kursus Anda sendiri di baris pertama. Jika namanya mengandung spasi, beri garis miring terbalik sebelum spasinya: `cd ~/Documents/Learn\ DE/DECourse`. Setelah `source`, prompt diawali `(venv)`; Modul 0.1 menjelaskan apa itu venv. Lalu buka folder kursus di VS Code (File, Open Folder) dan klik `labs/mod-0-0/practice.py` (Bagian A) atau `labs/mod-0-0/basics.py` (Bagian B) untuk mengeditnya. Periksa satu langkah atau satu fungsi dengan, misalnya:

```bash
pytest labs/mod-0-0/test_practice.py -k Step1 -v       # Bagian A, langkah 1
pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v # Bagian B, satu fungsi
```

  Anda melihat satu baris per pemeriksaan yang diakhiri `PASSED` atau `FAILED`; di bawah kegagalan, pesannya menyebutkan apa yang salah. Di Bagian A ia menyebut nama variabelnya: `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is None `` (Anda belum mengganti `None`). Di Bagian B pada file yang belum disentuh isinya `E       NotImplementedError: TODO: implement format_rupiah`, yang hanya berarti Anda belum menulis fungsinya. `-k` memilih satu kelompok (pemeriksaan lain "deselected"); tanpa `-k` Anda melihat semuanya, dan baris terakhir menyebutkan, misalnya, `29 failed, 2 passed`.

Pelajaran 1 sampai 4 diakhiri langkah Bagian A, tanpa fungsi. Mulai Pelajaran 5, setiap **Jeda Praktik** menyebutkan fungsi Bagian B mana yang ditulis, sebagian besar dengan mengubah kode yang sudah Anda tulis di Bagian A menjadi fungsi.

**Putarannya, untuk setiap langkah dan fungsi.**
1. Baca deskripsinya di file: di Bagian A komentar di atas setiap variabel, di Bagian B teks di antara baris `"""`. Ia menyebutkan apa yang masuk dan apa yang harus keluar, dengan contoh.
2. Tulis percobaan Anda: ganti `None` (Bagian A) atau baris `raise NotImplementedError` (Bagian B).
3. Jalankan pemeriksaan dan cari kelompok langkah atau fungsi itu. Di awal, kelompok lain juga ✗; itu wajar, abaikan.
4. Jika kelompok Anda ✗, baca pesannya. `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is 'Rp 1,250,000' `` (Bagian A) atau `AssertionError: assert 'Rp 1,250,000' == 'Rp 1.250.000'` (Bagian B) sama-sama berarti: jawaban Anda `'Rp 1,250,000'`, yang diharapkan `'Rp 1.250.000'`. Perbedaannya, koma alih-alih titik, memberi tahu persis apa yang harus diubah.
5. Ubah satu hal, jalankan lagi. Memutar lima kali untuk satu langkah itu normal: begitulah programmer bekerja, bukan tanda Anda tidak bisa.

**Bagian A, dua belas variabel, dan mengapa data engineer membutuhkannya:**

| Langkah | Anda membuat | Di mana Anda membutuhkannya saat bekerja |
|---|---|---|
| 1 | `formatted`, `two_totals` | laporan menampilkan uang yang bisa dibaca orang; total dari file adalah teks sampai Anda mengubahnya menjadi angka |
| 2 | `order_count`, `first_status`, `last_total`, `unique_ids` | mencari sesuatu di baris data; setiap pelanggan dihitung sekali, karena file dikirim ulang dan baris berulang |
| 3 | `signed_text`, `average` | jumlah negatif (refund); hari tanpa pesanan tidak boleh membuat seluruh job crash |
| 4 | `status_counts`, `revenue`, `customer_ids`, `batches` | berapa per kategori (SQL menyebutnya `GROUP BY`, Modul 0.3); omzet yang dicocokkan Keuangan dengan Anda; mengirim data per bagian |

**Bagian B, sebelas fungsi, urut sesuai pelajaran, dan mengapa data engineer membutuhkan masing-masing:**

| Gagasan dari pelajaran | Fungsi | Apa yang dilakukannya | Di mana Anda membutuhkannya saat bekerja |
|---|---|---|---|
| 1 | `format_rupiah` | `1250000` menjadi `"Rp 1.250.000"` | laporan, dashboard, dan e-mail menampilkan uang yang bisa dibaca orang |
| 2 | `count_by_status` | berapa pesanan per status | pertanyaan paling umum tentang data apa pun: berapa per kategori (SQL menyebutnya `GROUP BY`, Modul 0.3) |
| 2 | `unique_customer_ids` | setiap pelanggan sekali, terurut | file dikirim ulang dan baris berulang; menghitung pelanggan dua kali menggelembungkan semua angka |
| 3 | `average_total` | rata-rata, atau `None` jika tidak ada pesanan | metrik harus tetap jalan di hari kosong tanpa membuat seluruh job crash |
| 4 | `total_revenue` | jumlah total yang tidak dibatalkan | omzet adalah angka yang dicocokkan Keuangan dengan Anda: teks ke angka, dan filter yang benar |
| 4 | `batches` | potong list menjadi bagian berukuran `size` | kirim data ke API atau database per bagian, bukan satu permintaan raksasa (Modul 1.6) |
| 4 | `top_customers` | `n` pelanggan dengan belanja terbesar | setiap laporan "10 teratas" |
| 5 | `add_to_batch` | menambah ke list tanpa jebakan "nilai bawaan mutable" | bug persis ini membuat data kemarin bocor ke run hari ini (lihat tab Chaos) |
| 6 | `safe_int` | teks ke angka, atau nilai bawaan jika tidak mungkin | mengonversi nilai kotor tanpa membuat run crash |
| 6 | `split_valid` | memisahkan baris baik dari yang rusak | baris rusak disisihkan dan dilaporkan, tidak pernah dibuang diam-diam (Modul 1.2) |
| 7 | `read_orders` | membaca file CSV menjadi list berisi dict | setiap pipeline dimulai dengan membaca file |

### @steps
1. Pilih jalur Anda (lihat "Di mana mengerjakannya" di atas): **Pratinjau browser** di bawah, atau file-file di VS Code dengan pemeriksaan di terminal Anda. Buka `practice.py` dan baca dari atas ke bawah sekali, tanpa menulis apa pun: data di bagian atas dan empat langkah.
2. Ikuti Jeda Praktik. Setelah Pelajaran 1 sampai 4: Langkah 1 sampai 4 Bagian A, di `practice.py`. Setelah Pelajaran 5: `format_rupiah`, `count_by_status`, `unique_customer_ids`, `average_total`, `total_revenue`, `batches`, dan `top_customers` di Bagian B (`basics.py`). Setelah Pelajaran 6: `safe_int`, `add_to_batch`, dan `split_valid`. Setelah Pelajaran 7: `read_orders`. Jalankan pemeriksaan setelah setiap langkah atau fungsi dan lihat hanya kelompoknya.
3. Ragu nilai apa yang ada di kode Anda? Tambahkan `print(type(x), x)` di atas baris yang Anda ragukan lalu jalankan lagi; cetakannya muncul saat Anda menjalankan file, atau di output pratinjau. Hapus setelah selesai. (Bagian A juga mencetak semua variabelnya setiap kali Anda menjalankan `practice.py`.)
4. Sebelum setiap run, **tebak** kelompok mana yang akan ✓. Ketika hasilnya mengejutkan, cari tahu mengapa: kejutan itulah tempat belajar terjadi.
5. **Kerjakan yang sesungguhnya.** Di jalur terminal Anda sudah melakukannya: setelah ke-46 lulus, jalankan perintah bukti di bawah. Di jalur pratinjau, tulis kedua bagian lagi di terminal Anda sendiri, di venv Anda sendiri, **tanpa menyalin** dari pratinjau. Dari folder kursus, dengan venv aktif:

```bash
pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v   # ke-46 pemeriksaan
pytest labs/mod-0-0/test_lab.py -v -k TestSafeInt                  # satu kelompok saat Anda bekerja
python3 scripts/prove.py mod-0-0                                   # setelah semuanya lulus: kode bukti Anda
```

   Buka kedua file di editor Anda (VS Code: File, Open Folder, lalu klik file-nya); itu file yang Anda edit, bukan perintah yang Anda ketik. Tempel kode buktinya ke kotak **Bukti** di halaman ini.

### @files
- labs/mod-0-0/practice.py :: Bagian A, file kerja Anda: Python biasa, isi kedua belas variabel :: starter
- labs/mod-0-0/basics.py :: Bagian B, file kerja Anda: implementasikan sebelas fungsi TODO :: starter
- labs/mod-0-0/debug_me.py :: Latihan debugging: tiga fungsi dengan satu bug masing-masing (pelajaran 8) :: config
- labs/mod-0-0/test_practice.py :: Ke-15 tes yang memeriksa Bagian A :: test
- labs/mod-0-0/test_lab.py :: Ke-31 tes yang memeriksa Bagian B :: test
- labs/mod-0-0/requirements.txt :: pytest :: config
- labs/mod-0-0/reference/practice.py :: Satu solusi yang mungkin untuk Bagian A (coba sendiri dulu!) :: reference
- labs/mod-0-0/reference/basics.py :: Satu solusi yang mungkin untuk Bagian B (coba sendiri dulu!) :: reference

### @deliverables
- Ke-46 pemeriksaan lulus (15 di test_practice.py, 31 di test_lab.py) **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri** (lulus di pratinjau browser tidak dihitung)
- Anda bisa menjelaskan dengan kata-kata sendiri perbedaan `print` dan `return`, serta antara list, dict, dan set
- Anda bisa menjelaskan mengapa `batch=[]` sebagai argumen bawaan adalah bug dan apa yang harus ditulis sebagai gantinya

### @verify
Jalankan tes dari akar repositori:

```bash
pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v
python3 scripts/prove.py mod-0-0
```

Run yang pasti benar: awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Batch yang mengingat kemarin
### @scenario
Sebuah tim kecil menulis job per jam yang mengelompokkan pesanan masuk menjadi batch sebelum dimuat. Fungsi pembantunya satu baris: `def add_to_batch(order, batch=[]): batch.append(order); return batch`. Dalam tes ia berfungsi: panggil dengan satu pesanan dan Anda mendapat list berisi pesanan itu.

Di produksi, job berjalan di dalam proses worker yang hidup lama. Setelah jam kedua, dashboard menampilkan lagi pesanan dari jam pertama; setelah sehari, pesanan yang sama muncul 24 kali dan omzet 24 kali terlalu tinggi. Memulai ulang worker memperbaikinya selama satu jam. Tidak ada yang bisa mereproduksi masalahnya dengan satu tes, sehingga orang mencurigai database, lalu jaringan.

### @cause
Di Python, nilai bawaan sebuah parameter dibuat **sekali**, saat baris `def` dieksekusi, bukan setiap kali fungsi dipanggil. `batch=[]` karena itu adalah satu list tunggal yang hidup selama prosesnya. Setiap pemanggilan yang tidak memberi list sendiri menambah ke list yang sama, sehingga ia mengingat semuanya dari pemanggilan sebelumnya. Proses baru (seperti dalam unit test, atau tepat setelah restart) menyembunyikan bug karena list-nya kosong lagi.

Penyebab yang lebih dalam adalah state tersembunyi: hasil fungsi bergantung pada sesuatu yang bukan masukan, yaitu apa yang dilakukan pemanggilan sebelumnya. Fungsi yang memberi jawaban berbeda untuk masukan yang sama tidak bisa diuji dengan sederhana dan tidak aman dijalankan dua kali.

### @fix
1. Pakai `None` sebagai nilai bawaan dan buat list di dalam fungsi: `if batch is None: batch = []`. Lebih baik lagi, kembalikan list **baru** (`return batch + [order]`) daripada mengubah list yang diberikan.
2. Tambahkan tes yang memanggil fungsi dua kali dan memastikan pemanggilan kedua tidak memuat pesanan dari pemanggilan pertama. Lab punya tes persis seperti itu (`test_never_remembers_previous_calls`).
3. Cari nilai bawaan mutable lain di basis kode (`=[]`, `={}`, `=set()`): linter seperti ruff menandainya otomatis (aturan B006). Jadikan pemeriksaan itu bagian dari build.
4. Pilih fungsi yang keluarannya hanya bergantung pada masukannya. Bila state memang diperlukan, simpan secara eksplisit (parameter atau objek), jangan pernah di nilai bawaan.

### @pattern
Nilai bawaan dibuat sekali. Fungsi harus memberi hasil yang sama untuk masukan yang sama; state tersembunyi mengubahnya menjadi pipeline yang berfungsi di tes dan gagal di produksi.

## @quiz
### Apa yang dilakukan baris `total = total + 1000` di Python?
- [ ] Ia menampilkan error, karena sebuah nilai tidak bisa sama dengan dirinya sendiri ditambah angka lain
- [ ] Ia menambah 1000 ke setiap variabel dalam program yang saat ini bernama total
- [x] Ia mengambil nilai total saat ini, menambah 1000, dan mengarahkan nama total ke hasilnya
- [ ] Ia menguji apakah total sama dengan total ditambah 1000 lalu menyimpan True atau False di total

> `=` adalah penugasan: sisi kanan dihitung dulu, lalu nama di kiri menunjuk ke hasilnya. Ia bukan tanda sama dengan dalam matematika.

### File CSV memberi Anda teks `"150000"` sebagai total sebuah pesanan. Apa yang Anda butuhkan sebelum bisa menambahkan 1000 padanya?
- [ ] Tidak ada, karena Python otomatis mengonversi teks yang tampak seperti angka untuk semua operator
- [ ] Taruh teks itu di dalam kurung siku agar menjadi list yang bisa ditambah oleh Python
- [ ] Hapus tanda kutip dari filenya sendiri, karena Python tidak bisa membaca nilai berupa teks
- [x] Konversi dengan int(...), karena file hanya berisi teks dan `"150000" + 1000` adalah error

> Semua yang dibaca dari CSV adalah string. Anda mengonversi secara eksplisit, dan teks seperti "Rp 1.250.000" tidak bisa dikonversi, begitulah data kotor muncul.

### Wadah mana yang paling tepat untuk mengingat id pelanggan yang sudah Anda lihat, supaya bisa cepat bertanya "sudah pernahkah saya lihat yang ini?"
- [ ] List, karena list menyimpan setiap id sesuai urutan ditemukan dan membolehkan id yang berulang
- [ ] Tuple, karena tuple bersifat tetap sehingga tidak mungkin berisi id yang sama dua kali
- [x] Set, karena ia menyimpan tiap nilai sekali dan menjawab `x in seen` dengan sangat cepat
- [ ] Dictionary dengan id sebagai nilai, karena dict satu-satunya wadah yang bisa menyimpan angka

> Set menyimpan nilai unik dan dibuat untuk uji keanggotaan. List juga bisa dipakai tetapi lebih lambat pada data besar dan menyimpan duplikat.

### Apa yang dicetak kode ini?  `a = 2`  `b = a * 3`  `a = 10`  `print(b)`
- [ ] 30, karena b selalu mengikuti nilai a yang sekarang
- [x] 6, karena b sudah mendapat nilai 6 dan perubahan a tidak menyentuhnya
- [ ] 10, karena penugasan terakhir dalam program menimpa semua penugasan sebelumnya
- [ ] Error, karena sebuah nama tidak bisa diberi nilai dua kali dalam satu program

> Nama menunjuk ke nilai. `b = a * 3` menghitung 6 saat itu. Mengubah `a` kemudian tidak menghitung ulang `b`.

### Apa beda print dan return dalam sebuah fungsi?
- [ ] Tidak ada: keduanya menampilkan hasil di layar, dan return hanya menghentikan fungsi lebih awal
- [x] print hanya menampilkan sesuatu di layar, sedangkan return menyerahkan nilai ke pemanggil fungsi
- [ ] return menampilkan nilai di layar dan menyimpannya ke file, sedangkan print hanya menyimpannya di memori
- [ ] print hanya bisa dipakai di dalam loop, dan return hanya di fungsi yang tidak punya parameter

> Pipeline berjalan tanpa layar. Hanya nilai yang di-return yang bisa disimpan, dibandingkan, atau diteruskan ke langkah berikutnya. Fungsi yang hanya mencetak memberi None kepada pemanggilnya.

### Mengapa `except Exception: pass` berbahaya dalam pipeline data?
- [x] Ia menyembunyikan setiap error di masa depan, sehingga data salah berlanjut tanpa tanda
- [ ] Ia membuat program lebih lambat, karena Python harus membuat objek exception untuk setiap baris
- [ ] Ia tidak diizinkan Python, sehingga program berhenti dengan syntax error begitu mulai berjalan
- [ ] Ia menghapus baris penyebab error dari file masukan, dan itu tidak bisa dibatalkan

> Tangkap error spesifik yang Anda duga (`except ValueError`) dan putuskan apa yang dilakukan pada barisnya. Menelan semuanya mengubah salah ketik, file hilang, dan data buruk menjadi hasil salah yang diam-diam.

### Apa yang terjadi dengan `def add(order, batch=[]): batch.append(order); return batch` ketika Anda memanggil `add("a")` lalu `add("b")`?
- [ ] Pemanggilan kedua mengembalikan ["b"], karena setiap pemanggilan mulai dengan list kosong yang baru
- [ ] Python melaporkan error pada pemanggilan kedua karena list bawaan sudah pernah dipakai
- [ ] Setiap pemanggilan mengubah salinan, jadi hasil ["a"] dan ["b"] tidak saling memengaruhi
- [x] Pemanggilan kedua mengembalikan ["a", "b"], karena list bawaan dibuat sekali dan dipakai bersama

> Nilai bawaan dibuat saat `def` berjalan, bukan di setiap pemanggilan. Pakai `batch=None` dan buat list di dalam fungsi.

### Apa yang dicapai `if __name__ == "__main__":` di bagian bawah sebuah skrip?
- [ ] Ia membuat skrip berjalan lebih cepat dengan melewati setiap fungsi yang tidak dipanggil langsung
- [x] Kode di bawahnya berjalan saat file dimulai langsung, tetapi tidak ketika di-import file lain
- [ ] Ia memeriksa bahwa skrip ditulis oleh pengembang utama proyek ini
- [ ] Ia membuat Python membaca file dua kali agar semua nama sudah terdefinisi sebelum dipakai

> `__name__` bernilai `"__main__"` hanya untuk file yang Anda jalankan. Meng-import file (misalnya dari tes) tidak memicu `main()`, sehingga file berfungsi sebagai program dan sebagai pustaka.

## @resources
- [Tutorial Python (resmi)](https://docs.python.org/3/tutorial/)
- [Python Tutor: lihat kode Anda berjalan langkah demi langkah](https://pythontutor.com/)
- [Think Python, edisi ke-3 (buku gratis)](https://allendowney.github.io/ThinkPython/)
- [Dokumentasi Python: modul csv](https://docs.python.org/3/library/csv.html)
- [Dokumentasi Python: error dan exception](https://docs.python.org/3/tutorial/errors.html)
