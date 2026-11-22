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
Tidak ada. Anda tidak perlu pernah menulis kode, dan tidak masalah jika kursus sebelumnya membuat Anda bingung. Anda hanya perlu cara menjalankan Python: pratinjau di browser pada lab langsung bisa dipakai; Modul 0.1 lalu mengajarkan penyiapan yang benar di komputer Anda sendiri.

> [!IMPORTANT]
> **Cara Mengerjakan Lab (Panduan Pemula):**
> - **Lab ini punya dua bagian.** **Bagian A** adalah Python biasa, tanpa fungsi: setelah tiap Pelajaran 1 sampai 4 Anda mengisi beberapa variabel di file `labs/mod-0-0/practice.py` (ganti setiap `None` dengan kode Anda sendiri). **Bagian B** dimulai setelah Pelajaran 5, yang mengajarkan fungsi (`def`): file `labs/mod-0-0/basics.py` berisi sebelas fungsi untuk ditulis. Jangan membaca seluruh bab lebih dulu; bergantianlah antara pelajaran dan Jeda Praktiknya.
> - **Di mana:** di **Pratinjau browser** pada tab Lab (tanpa memasang apa pun; pakai tombol Bagian A / Bagian B), atau di terminal Anda sendiri jika Anda sudah mengikuti Mulai di sini (halaman lab menunjukkan empat perintah persiapannya, sekali saja). File-filenya adalah file teks yang Anda buka di editor (VS Code, atau `code labs/mod-0-0/practice.py`), bukan perintah: mengetik nama file di terminal menghasilkan `Permission denied` atau `command not found`. Perintah `pytest ...` di bawah setiap jeda memeriksa pekerjaan Anda, dan run itulah yang dihitung.
> - **Mencoba contoh di materi:** ketik di prompt Python `>>>` di terminal Anda (ketik `python3` lalu Enter untuk masuk; keluar dengan `exit()`), atau di pratinjau browser. Perintah seperti `cd`, `ls`, dan `pytest` diketik di prompt terminal `$`, tidak pernah di `>>>`. Ragu yang mana? **Mulai di sini, langkah 4** ("Tiga tempat Anda mengetik") menunjukkan ketiganya beserta tampilannya.

## @part Dasar: nilai, koleksi, keputusan, dan perulangan

## @lesson Cara program berjalan: nilai, variabel, dan tipe
Program adalah daftar instruksi yang diikuti komputer **dari atas ke bawah, satu baris demi satu baris**. Tidak ada yang dilewati dan tidak ada yang terjadi "di latar belakang" kecuali Anda memintanya. Ini model mental yang paling berguna dalam pemrograman: saat Anda tersesat, letakkan jari di baris pertama lalu jalan ke bawah.

Di sini Anda belajar dengan mengerjakan. Setiap gagasan kecil diikuti **latihan** singkat: Anda menulis beberapa baris, menekan **Jalankan & periksa**, dan pemeriksa memberi tahu persis apa yang masih salah. Buntu? Tekan **Petunjuk**, dan kalau masih buntu, **Lihat jawaban** lalu ketik ulang sendiri. Latihan ini menjalankan Python di browser Anda, jadi tidak ada yang perlu dipasang. Terminal Anda sendiri tetap tempat kerja yang sesungguhnya: **Coba sendiri** dan lab di akhir materi memakainya.

### Menampilkan nilai: print()

`print()` menaruh sesuatu di layar. Teks ditulis di dalam tanda kutip; angka tidak:

```python
print("Halo")
print(150000)
```

> **Di mana saya mengetik ini?** Untuk mencoba cepat: buka terminal, ketik `python3`, tekan Enter, lalu ketik ketiga baris itu di prompt `>>>`, Enter setelah setiap baris. `print(total)` menampilkan `150000`. Di `>>>` Anda juga bisa mengetik `total` saja dan Python menampilkan nilainya; di file `.py` yang disimpan, tidak ada yang tampil kecuali Anda mem-`print`-nya. Keluar dengan `exit()`. (Mulai di sini, langkah 4, menjelaskan terminal, `>>>`, dan file berdampingan.)

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
count + 5
* 15
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

Semua yang masuk ke program Anda dari luar, file CSV, API web, formulir, datang sebagai **teks**. Ini dua pesanan KopiKu persis seperti Python membacanya dari file CSV:

```python
row1 = {"order_id": "1001", "status": "paid", "total_idr": "150000"}
row2 = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
```

Lihat tanda kutipnya: `"150000"` adalah teks (`str`), bukan angka. Sekarang manajer Anda mengajukan tiga pertanyaan sederhana, dan teks itu memberi tiga jawaban salah **tanpa error apa pun**:

| Pertanyaannya | Yang Anda tulis | Jawaban Python | Mengapa |
|---|---|---|---|
| Total kedua pesanan? | `row1["total_idr"] + row2["total_idr"]` | `'15000090000'` | `+` pada teks menempelkan karakternya |
| Apakah 90.000 lebih besar dari 150.000? | `"90000" > "150000"` | `True` | teks dibandingkan karakter demi karakter, seperti kata di kamus, dan `"9"` datang setelah `"1"` |
| Total dari kecil ke besar? | `sorted(["150000", "90000", "25000"])` | `['150000', '25000', '90000']` | urutan karakter demi karakter yang sama |

Tidak ada yang crash. Program berjalan, laporan terkirim, dan setiap angka di dalamnya salah. Karena itu pekerjaan pertama seorang data engineer pada data baru apa pun adalah **memberi setiap nilai tipe yang benar, dengan sengaja**: `int("150000")` adalah angka `150000`, dan `str(150000)` adalah teks `"150000"`. Dengan angka, tiga pertanyaan yang sama memberi `240000`, `False`, dan `[25000, 90000, 150000]`.

Sebelum latihan, satu tebakan. Jangan dijalankan; pikirkan dulu:

:::ask Apa yang akan tercetak?
```python
print("2" + "3")
```
@options
5
* 23
sebuah error
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

**Di mana Anda akan bertemu ini lagi.** Di mana-mana: database memberi tipe pada setiap kolom (Modul 0.3); pipeline mengonversi dan memeriksa tipe sebelum memuat apa pun (Modul 1.2); format file seperti Parquet menyimpan tipe di samping datanya agar tidak ada yang menebak (Modul 2.1). Tugas pemanasan pertama di simulator kerja persis ini: harga bertipe teks, diubah menjadi angka.

> 🛠 **Coba sendiri (5 menit, Python di prompt `>>>`).** Di terminal ketik `python3`, lalu ketik (atau tempel) baris `row1` dan tekan Enter, kemudian baris `row2` dan tekan Enter: satu baris setiap kali. Jika Anda menempel keduanya sekaligus, prompt menampilkan `...`: Python menunggu akhir blok, jadi tekan Enter sekali lagi pada baris `...` yang kosong (bukan Ctrl+C, yang membatalkannya). Sebelum setiap pertanyaan di tabel, **tebak** jawabannya, lalu ketik kodenya dan bandingkan. Kemudian jawab tiga pertanyaan yang sama lagi dengan `int(...)` di sekitar setiap total.
>
> **Seharusnya Anda melihat:** `'15000090000'`, `True`, dan `['150000', '25000', '90000']` dengan teks; `240000`, `False`, dan `[25000, 90000, 150000]` dengan angka. Jika salah satu tebakan Anda keliru, itulah pelajarannya: tulis dalam satu kalimat mengapa.

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

> 💡 **Jeda Praktik 1 (Bagian A, Langkah 1):**
> Buka Bagian A lab: file `labs/mod-0-0/practice.py` di editor Anda, atau tab **Bagian A** pada Pratinjau browser di tab Lab. Baca bagian atas file sekali, lalu cari **Langkah 1**. Ia memberi Anda `amount`, `row1`, dan `row2`, serta dua variabel untuk diisi: ganti setiap `None` dengan kode Anda sendiri.
> 1. `formatted`: jumlah itu ditulis sebagai teks dengan titik, `Rp 1.250.000` (f-string dan `.replace` di atas).
> 2. `two_totals`: dua total di `row1` dan `row2` dijumlahkan sebagai **angka**. Lihat kembali tiga jawaban salah di tabel: total ini adalah teks, jadi ubah dulu.
> Jalankan file untuk melihat nilai Anda: `python3 labs/mod-0-0/practice.py`. Lalu periksa Langkah 1: tekan **Jalankan tes** di pratinjau, atau di terminal (setelah persiapan sekali saja di halaman lab):
> `pytest labs/mod-0-0/test_practice.py -k Step1 -v`
> Anda seharusnya melihat `Rp 1.250.000` dan `240000`, dan tiga pemeriksaan lulus. Pemeriksaan yang gagal menyebutkan variabel mana yang salah, seharusnya berapa, dan sekarang berapa: `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is None `` hanya berarti Anda belum mengganti `None`. Lalu lanjut ke Pelajaran 2.

## @lesson Koleksi: satu nilai tidak pernah cukup
Satu pesanan punya beberapa fakta, dan sebuah file berisi ribuan pesanan. Python memberi Anda empat wadah: **list**, **dictionary**, **tuple**, dan **set**. Mengetahui **mengapa masing-masing ada** memberi tahu Anda mana yang dipilih. Seperti di Materi 1, setiap gagasan diikuti latihan.

### List: deretan berurutan

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
a d
* b d
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
* 3 2
2 3
@why
`len(statuses)` menghitung **setiap** item: 3. `statuses.count("paid")` hanya menghitung item yang sama dengan `"paid"`: 2. Angka pertama adalah "berapa semuanya", angka kedua adalah "berapa dari satu jenis".
:::

:::drill python Semuanya, dan satu jenis
`statuses` berisi status beberapa pesanan. Buat `all_orders` berisi jumlah pesanan, dan `paid_orders` berisi jumlah pesanan yang statusnya `"paid"`.
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

File data sungguhan biasanya berupa **list berisi dictionary**: list adalah file-nya, setiap dictionary adalah satu baris, key-nya adalah nama kolom. Ini tiga produk (setiap nilai berupa teks, seperti keluar dari file CSV) dan empat pertanyaan beserta jawabannya:

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
Keputusan adalah cara program memilih di antara jalur. Dalam data engineering hampir semua **validasi** adalah keputusan: apakah total ini angka? apakah status ini kita kenal?

```python
status = "refunded"
if status == "paid":
    print("hitung omsetnya")
elif status == "cancelled" or status == "refunded":
    print("tanpa omset")
else:
    print("status tidak dikenal: kirim ke karantina")
```

Cara kerjanya: Python memeriksa kondisi dari atas, menjalankan blok dari kondisi **pertama** yang benar, lalu melewati semua yang lain. Blok adalah apa pun yang **menjorok** (indentasi) di bawah titik dua; di Python indentasi adalah strukturnya (biasanya empat spasi), jadi indentasi yang salah adalah program yang salah.

Kondisi adalah ekspresi yang menghasilkan `True` atau `False`. Perbandingan: `==` sama dengan (dua tanda; satu `=` adalah penugasan!), `!=`, `<`, `>`, `<=`, `>=`, dan `in` untuk keanggotaan (`status in {"cancelled", "refunded"}`). Gabungkan dengan `and`, `or`, `not`.

**Truthiness** menghemat ketikan: `0`, `""`, `None`, `[]`, `{}` dianggap salah di dalam `if`, selain itu dianggap benar. Jadi `if not rows:` berarti "jika tidak ada baris". Tetapi hati-hati: `if total:` juga salah untuk total `0`, padahal itu bisa nilai yang sah. Bila nol sah, tulis `if total is not None:`.

**Mengapa keputusan ada di mana-mana dalam pipeline.** Aturan Modul 0.2 adalah "jangan menebak dan jangan membuang diam-diam". Dalam kode, aturan itu adalah `if` dengan dua cabang: baris yang valid lanjut, baris yang tidak valid disisihkan *beserta alasannya*. `else` yang tidak melakukan apa-apa adalah cara data hilang tanpa jejak.

**Uang negatif.** `abs(n)` memberi jarak dari nol, selalu positif: `abs(-45000)` adalah `45000`. Untuk menulis jumlah negatif sebagai `-Rp 45.000`, format `abs(amount)` dan taruh tanda minus di depannya sendiri, dengan `if` yang memeriksa apakah jumlahnya di bawah nol.

Pembagian dengan nol juga masalah keputusan: rata-rata dari list kosong bukan 0, ia tidak ada. Gunakan fungsi bawaan `sum(values)` (menjumlahkan semua angka dalam list) dan `len(values)` (menghitung jumlah item), lalu jaga dengan `if`: `if not values: avg = None` menangani list kosong sebelum error terjadi, sedangkan `else: avg = sum(values) / len(values)` berjalan aman saat ada data. Biasakan memeriksa kasus berbahaya lebih dulu.

> 💡 **Jeda Praktik 3 (Bagian A, Langkah 3):**
> Di `practice.py` (atau tab **Bagian A**), kerjakan **Langkah 3**:
> 1. `signed_text`: `signed_amount` ditulis seperti Langkah 1, tetapi jumlah negatif memiliki tanda minus di depan, `-Rp 45.000`, dan jumlah positif tidak, `Rp 500`. Pakai `if`, dan `abs()` dari atas.
> 2. `average`: rata-rata angka di `totals`, atau `None` jika `totals` kosong (`sum`, `len`, dan `if`).
> Jalankan file, lalu periksa langkahnya:
> `pytest labs/mod-0-0/test_practice.py -k Step3 -v`
> Anda seharusnya melihat `-Rp 45.000` dan `87500.0`, serta empat pemeriksaan lulus. Pemeriksa juga mencoba `totals` kosong: tanpa `if` Anda, file akan berhenti dengan `ZeroDivisionError`, dan pesannya menyebutkan di baris berapa.

## @lesson Pengulangan: for, while, dan comprehension
Sebuah file punya 100.000 baris. Anda tidak bisa menulis 100.000 baris kode, jadi Anda menulis instruksinya **sekali** dan membiarkan komputer mengulanginya. Itulah perulangan (loop), dan ia adalah mesin dari setiap pipeline data.

```python
total = 0
for order in orders:            # ambil baris satu per satu: tiap putaran, `order` menunjuk ke baris berikutnya
    total = total + int(order["total_idr"])
print(total)
```

Telusuri dengan tiga baris (150000, 80000, 120000). Sebelum loop `total` bernilai 0. Putaran 1: `order` adalah baris 1, jadi `total` menjadi 150000. Putaran 2: 230000. Putaran 3: 350000. Loop berhenti karena baris habis, dan print menampilkan 350000. **Pola akumulator** ini (mulai dengan nilai netral, perbarui setiap putaran) ada di balik jumlah, hitungan, maksimum, dan hampir setiap agregasi yang akan Anda tulis.

Alat-alat yang berguna, masing-masing menyelesaikan satu gangguan tertentu:

- `range(5)` menghasilkan 0, 1, 2, 3, 4 (bukan 5!). `range(0, 100, 10)` melangkah sepuluh-sepuluh. Pakai saat butuh posisi atau jumlah pengulangan.
- `enumerate(rows)` memberi posisi *dan* itemnya: `for i, row in enumerate(rows):`. Lebih baik daripada menyimpan penghitung sendiri.
- `zip(a, b)` menelusuri dua list bersamaan.
- `continue` melompat ke putaran berikutnya (pesanan dibatalkan: tidak ada yang ditambah). `break` keluar dari loop sepenuhnya.

**Comprehension** adalah loop yang ditulis sebagai satu ekspresi: `ids = [int(o["customer_id"]) for o in orders]` membangun list; `{int(o["customer_id"]) for o in orders}` membangun set; `{k: v for ...}` membangun dict. Ia loop yang sama dalam bentuk singkat. Pakai bila muat di satu baris yang jelas; bila perlu cabang `if/else` atau beberapa langkah, tulis loop biasa. Mudah dibaca lebih baik daripada akal-akalan.

**Mengurutkan dan memeringkat dengan `sorted()`**: Dalam pipeline data, Anda akan sering memeringkat data (misalnya pelanggan dengan total belanjaan terbesar). Fungsi bawaan `sorted(data, key=...)` menerima fungsi `key` yang memberi tahu Python nilai apa yang dijadikan patokan urutan. Fungsi kecil satu baris bernama **lambda** (`lambda x: ...`) sering dipakai sebagai key ini. Sebagai contoh, untuk mengurutkan pasangan `(customer_id, total)` dari total terbesar ke terkecil, tulis `sorted(pairs, key=lambda pair: -pair[1])` (tanda minus membalik urutan sehingga nilai terbesar muncul pertama). Jika dua pelanggan memiliki total yang sama persis dan Anda ingin memecah seri berdasarkan ID pelanggan terkecil, kembalikan sebuah tuple dari fungsi key: `key=lambda pair: (-pair[1], pair[0])`. Python membandingkan elemen pertama tuple terlebih dahulu, dan hanya memeriksa elemen kedua jika elemen pertama bernilai sama.

Loop `while` mengulang **selama sebuah kondisi benar**: `while attempts < 3:`. Pakai saat Anda tidak tahu berapa putaran yang dibutuhkan (mencoba ulang, membaca sampai habis). Bahayanya: jika tidak ada yang membuat kondisi menjadi salah di dalam loop, ia berjalan selamanya. Selalu tanyakan: "apa yang berubah di dalam loop sehingga ia berakhir?"

> 💡 **Jeda Praktik 4 (Bagian A, Langkah 4):**
> Di `practice.py` (atau tab **Bagian A**), kerjakan **Langkah 4**. Satu perulangan `for order in orders:` bisa membangun beberapa hasil sekaligus. Sebelum perulangan, mulai `status_counts` sebagai `{}`, `revenue` sebagai `0`, dan sebuah set untuk id (`ids = set()`):
> 1. `status_counts`: pesanan per status, `{"paid": 2, "cancelled": 1, "delivered": 1}` (baris penghitung dari Pelajaran 2).
> 2. `revenue`: jumlah total, sebagai angka, dari pesanan yang statusnya bukan `"cancelled"` dan bukan `"refunded"`.
> 3. `customer_ids`: nilai `customer_id` yang berbeda sebagai bilangan bulat, dari yang terkecil (isi set di dalam perulangan dengan `.add(...)`, yang memasukkan satu nilai ke set, lalu pakai `sorted`).
> 4. `batches`: `items` dipotong menjadi bagian berisi paling banyak `batch_size`, berurutan, `[[1, 2], [3, 4], [5]]` (`range` dengan langkah, dan slice).
> Jalankan file, lalu periksa langkahnya:
> `pytest labs/mod-0-0/test_practice.py -k Step4 -v`
> Anda seharusnya melihat `{'paid': 2, 'cancelled': 1, 'delivered': 1}`, `235000`, `[3, 5, 7]`, dan `[[1, 2], [3, 4], [5]]`. Ketika ke-15 pemeriksaan Bagian A lulus (`pytest labs/mod-0-0/test_practice.py -v`), Anda sudah menulis, dengan kode biasa, isi dari apa yang diubah Bagian B menjadi fungsi.

## @part Fungsi, error, dan file

## @lesson Fungsi: def, parameter, dan return
Lihat loop yang menjumlahkan total. Jika Anda butuh jumlah yang sama di lima tempat, Anda tidak menyalin lima loop. Anda memberi loop itu sebuah **nama** dan memakainya ulang. Itulah fungsi, dan ia ada karena tiga alasan: **pemakaian ulang** (tulis sekali), **kejelasan** (nama yang baik menjelaskan tujuannya, jadi `total_revenue(orders)` terbaca seperti kalimat), dan **pengujian** (fungsi kecil dengan satu masukan dan satu keluaran bisa diperiksa otomatis, begitulah lab ini bekerja).

```python
def total_revenue(orders):             # def = "define": di sini kita hanya menjelaskan; belum ada yang berjalan
    total = 0
    for order in orders:
        total = total + int(order["total_idr"])
    return total                       # return = serahkan jawabannya dan tinggalkan fungsi

result = total_revenue(my_orders)      # memanggil fungsi: sekarang badannya berjalan
```

Bagian-bagiannya: `def`, **nama**, **parameter** dalam tanda kurung (masukan; `orders` adalah nama penampung), titik dua, lalu **badan** yang menjorok. Saat Anda *memanggilnya*, nilai yang Anda berikan (**argumen**) ditempelkan ke nama parameter selama pemanggilan.

**return versus print**, kebingungan yang paling menyakiti pemula. `print` hanya *menampilkan* sesuatu di layar; program tidak bisa memakainya setelah itu. `return` *menyerahkan nilai kembali* ke kode yang memanggil fungsi sehingga ia bisa disimpan, dibandingkan, atau diteruskan. Fungsi yang mencetak tetapi tidak me-return memberi `None` kepada pemanggilnya. Pipeline berjalan tanpa layar, jadi fungsi harus **me-return** hasilnya.

**Nilai bawaan**: `def safe_int(text, default=None):` berarti pemanggil boleh menghilangkan `default`. **Scope**: nama yang dibuat di dalam fungsi hanya ada selama fungsi berjalan; dunia luar tidak bisa melihatnya, dan itu fitur (fungsi tidak bisa merusak variabel Anda yang lain secara tidak sengaja).

**Jebakan untuk dikenal sekarang.** Jangan pernah memakai nilai *mutable* (list atau dict) sebagai nilai bawaan: `def add(order, batch=[]):`. Python membuat list itu **sekali**, saat baris `def` dibaca, dan setiap pemanggilan yang tidak mengisi `batch` memakainya bersama. Pemanggilan kedua melihat apa yang ditambahkan pemanggilan pertama. Pakai `batch=None` dan buat list baru di dalam. Skenario chaos memperlihatkan akibatnya pada pipeline nyata, dan lab punya tesnya.

Pilih fungsi yang hanya bergantung pada masukannya dan me-return hasil tanpa mengubah hal lain (**fungsi murni**). Mereka mudah diuji dan aman dijalankan dua kali, sifat yang dibutuhkan pipeline (Modul 0.2: idempotensi).

**Mengetik fungsi di prompt `>>>`.** Setelah baris yang diakhiri `:`, seperti `def double(n):`, Python menampilkan `...` dan menjorokkan baris berikutnya untuk Anda. Setelah fungsinya lengkap, tekan **Enter sekali lagi pada baris kosong** untuk menyelesaikannya; tanpa baris kosong itu, apa pun yang Anda ketik berikutnya menjadi bagian dari fungsi. Untuk yang lebih dari dua baris, file lebih mudah.

> 🛠 **Coba sendiri (8 menit, di file `fn.py`).** Tebak dulu setiap output di kepala Anda, baru jalankan.
> 1. Tulis `def show_square(n): print(n * n)` dan `def give_square(n): return n * n` (masing-masing di barisnya sendiri seperti biasa). Jalankan `a = show_square(4)` dan `b = give_square(4)`, lalu `print(a, b)`.
> 2. Tulis `def add(item, box=[]): box.append(item); return box` (dengan baris yang benar) dan jalankan `print(add(1))`, `print(add(2))`, `print(add(3))`. Lalu perbaiki agar setiap pemanggilan tanpa argumen kedua mulai dengan list kosong yang baru.
> 3. Tulis `total(orders)` yang menjumlahkan `int(order["total_idr"])` dari list dict pesanan, tanpa `print` di dalamnya. Periksa dengan `total([{"total_idr": "100"}, {"total_idr": "250"}]) == 350` dan `total([]) == 0`.
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
Error bukan kegagalan pelajar; ia adalah program yang memberi tahu persis apa yang tidak bisa dilakukannya. Belajarlah membacanya. **Traceback** mendaftar jalur pemanggilan; **bacalah dari bawah**. Baris terakhir menyebut jenis error dan pesannya (`ValueError: invalid literal for int() with base 10: 'Rp 1.250.000'`); baris di atasnya menunjukkan di mana ia terjadi, dan baris terakhir yang menunjuk ke kode *Anda* biasanya tempat untuk melihat.

Error yang akan terus Anda temui: `ValueError` (tipe benar, nilai mustahil: `int("abc")`), `TypeError` (tipe salah: `"a" + 1`), `KeyError` (kunci dict tidak ada), `IndexError` (posisi list terlalu besar), `ZeroDivisionError`, `FileNotFoundError`, `NameError` (salah ketik nama), `IndentationError`.

Anda bisa **menangkap** error yang Anda duga dan memutuskan apa yang dilakukan:

```python
def safe_int(text, default=None):
    try:
        return int(text)
    except ValueError:       # hanya jenis error ini
        return default
```

Cara kerjanya: Python mencoba blok di bawah `try`. Jika semua berjalan, `except` dilewati. Jika `ValueError` terjadi, sisa `try` ditinggalkan dan blok `except` berjalan sebagai gantinya.

Tiga aturan yang memisahkan pipeline yang baik dari yang berbahaya:

1. **Tangkap error spesifik yang Anda duga.** `except ValueError` adalah rencana. `except Exception: pass` (atau `except:` kosong) adalah keputusan menyembunyikan setiap bug di masa depan: salah ketik, file hilang, masalah data sungguhan, semuanya lenyap diam-diam, dan angka salah muncul tanpa tanda masalah. Modul 1.2 menunjukkan betapa mahalnya itu.
2. **Buat blok `try` tetap kecil**: hanya baris yang bisa gagal.
3. **Angkat error dengan sengaja** (`raise`) saat fungsi Anda tidak bisa melakukan tugasnya: `raise ValueError("total must not be negative")`. Gagal dengan lantang lebih awal lebih baik daripada meneruskan data buruk.

Baris buruk dari pelanggan adalah data yang *diduga*, jadi Anda menanganinya (menyisihkannya beserta alasan). File hilang atau kesalahan pemrograman *tidak diduga*, jadi biarkan gagal dengan lantang.

> 💡 **Jeda Praktik 6 (Bagian B):**
> Terapkan fungsi murni, penanganan error, dan pencegahan bug mutable default:
> 1. Kerjakan `safe_int(text, default=None)` dengan blok `try / except ValueError`.
> 2. Kerjakan `add_to_batch(order, batch=None)` dengan `if batch is None: batch = []`.
> 3. Kerjakan `split_valid(orders)` menggunakan fungsi `safe_int` yang Anda buat.
> Klik **Jalankan tes**; ketiga grup itu harus bertanda ✓ (jalur terminal):
> `pytest labs/mod-0-0/test_lab.py -k "TestSafeInt or TestAddToBatch or TestSplitValid" -v`

## @lesson File, import, dan menjalankan skrip
Program membaca file. Pola standarnya:

```python
import csv

with open("orders.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
```

Mengapa setiap bagian ada. `open` memberi Anda sambungan ke file. **`with`** menjamin file ditutup saat blok selesai, bahkan jika terjadi error di dalamnya, sehingga Anda tidak membiarkan file terbuka (masalah nyata pada job yang berjalan lama). `encoding="utf-8"` menyatakan bagaimana byte menjadi teks; jika dihilangkan, program Anda berperilaku berbeda di komputer berbeda. `newline=""` adalah yang diminta modul csv agar pemisah baris di dalam nilai bertanda kutip tetap utuh. `csv.DictReader(f)` mengubah setiap baris menjadi dict dengan baris header sebagai kunci, sehingga Anda mendapat persis list berisi dictionary dari pelajaran 2. Semua nilainya string; mengonversinya adalah tugas Anda.

**Import** membawa kode yang ditulis orang lain. **Pustaka standar** (standard library) datang bersama Python dan tidak perlu dipasang: `csv`, `json`, `pathlib`, `datetime`, `statistics`. Pustaka lain (pandas, pydantic) dipasang dengan `pip` ke virtual environment Anda (Modul 0.1). File Anda sendiri `basics.py` juga sebuah **modul**: `import basics` menjalankannya sekali dan memberi fungsinya sebagai `basics.total_revenue(...)`. Begitulah tes lab memakai kode Anda.

Anda menjalankan skrip dengan `python3 myfile.py`. Baris yang umum di bagian bawah skrip adalah:

```python
if __name__ == "__main__":
    main()
```

Python mengisi nama khusus `__name__` dengan `"__main__"` hanya saat file *dijalankan langsung*. Ketika file lain meng-import-nya, `__name__` adalah nama modulnya, sehingga `main()` tidak berjalan. Akibatnya: file bisa berfungsi sebagai program dan sebagai pustaka yang bisa Anda uji.

Path: pakai `pathlib.Path("data") / "orders.csv"` daripada menyambung string, dan ingat bahwa path relatif dihitung dari folder tempat Anda memulai Python, yang biasanya jadi sebab `FileNotFoundError`.

> 💡 **Jeda Praktik 7 (Bagian B: lengkapi lab):**
> Di `basics.py`, implementasikan fungsi terakhir `read_orders(path)` dengan `with open(...)` dan `csv.DictReader`.
> Klik **Jalankan tes** di setiap bagian, atau jalankan semuanya di terminal: ke-46 pemeriksaan seharusnya lulus, 15 di Bagian A dan 31 di Bagian B:
> `pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v`
> Pratinjau menunjukkan logika Anda benar; run di komputer Anda sendiri itulah yang dihitung. Di jalur terminal run itu sudah milik Anda: `python3 scripts/prove.py mod-0-0` mencetak kode bukti Anda.

## @lesson Menyatukan semuanya, dan cara men-debug
Sekarang Anda punya setiap bagian dari pipeline kecil: baca file (pelajaran 7), ulangi baris-barisnya (4), putuskan mana yang valid (3), sisihkan yang buruk (6), hitung dengan dict (2), bungkus tiap langkah dalam fungsi (5). Berikut sebagai rencana yang bisa dibaca seperti cerita:

```python
def main(path):
    rows = read_orders(path)                 # file -> list berisi dict
    valid, invalid = split_valid(rows)       # keputusan + try/except, tidak ada yang dibuang diam-diam
    print(count_by_status(valid))            # menghitung dengan dict
    print(format_rupiah(total_revenue(valid)))
```

Perhatikan apa yang terjadi: `main` tidak berisi detail. Setiap fungsi punya satu tugas dan nama yang menyebutkannya. Beginilah pipeline profesional tetap mudah dibaca.

**Cara membaca kode yang tidak Anda tulis.** Mulai dari bawah (biasanya titik masuk), lalu baca nama dan parameter setiap fungsi sebelum badannya. Pilih masukan yang sangat kecil dan **telusuri** dengan tangan, tulis nilai tiap variabel di kertas setelah setiap baris. Jika tebakan Anda dan keluarannya berbeda, Anda menemukan baris yang salah Anda pahami. Alat gratis pythontutor.com memperlihatkan eksekusi ini langkah demi langkah.

**Cara men-debug.** (1) Baca error dari bawah. (2) Ulangi dengan masukan sekecil mungkin. (3) Cetak atau periksa nilai *tepat sebelum* baris yang gagal (`print(type(x), x)` menjawab separuh dari semua bug). (4) Ubah satu hal pada satu waktu. (5) Tulis **tes** yang gagal karena bug itu, perbaiki kodenya, dan simpan tesnya agar bug itu tidak kembali.

**Tes**, pandangan pertama. Tes hanyalah kode yang memanggil fungsi Anda dan membandingkannya dengan jawaban yang diharapkan:

```python
def test_format_rupiah():
    assert format_rupiah(1250000) == "Rp 1.250.000"
```

`assert` memunculkan error jika kondisinya salah. Alat uji (pytest) menemukan fungsi bernama `test_...`, menjalankan semuanya dan melaporkan mana yang gagal dan mengapa. Lab punya 46 tes seperti itu: bacalah tes yang gagal sebagai **spesifikasi** (ia menyatakan persis apa yang diharapkan), bukan sebagai rintangan.

Anda tidak akan mengingat semuanya setelah sekali membaca, dan memang tidak diharapkan. Ketik contoh-contohnya, rusak dengan sengaja, dan lihat pesan errornya. Setiap fungsi lab di bawah melatih satu pelajaran; kerjakan berurutan dan jalankan tes setelah masing-masing.

> 🛠 **Coba sendiri (15 menit).** Jalankan `python3 labs/mod-0-0/debug_me.py`. Isinya tiga fungsi kecil, masing-masing dengan satu bug, dan mencetak PASS atau FAIL untuk setiap fungsi. Perbaiki satu per satu dengan rutinitas dari pelajaran ini: baca error dari bawah, ulangi dengan input sekecil mungkin, periksa nilainya tepat sebelum baris yang gagal. Jangan menulis ulang fungsinya; temukan bug-nya.
>
> **Seharusnya Anda melihat:** tiga baris FAIL di awal (satu `TypeError`, dua jawaban salah) dan `all three fixed` di akhir. Lalu tulis satu kalimat per bug: petunjuk apa yang membawa Anda ke sana? Kalimat itulah keahliannya.

**Di mana gagasan ini muncul dalam keseharian data engineer.** Wajar bertanya apa hubungan latihan-latihan kecil ini dengan pekerjaan ini. Hampir setiap tugas yang akan Anda terima adalah gagasan yang sama, hanya lebih besar:
- **Tipe:** data tiba sebagai teks; Anda memberi setiap nilai tipe yang benar sebelum apa pun, atau total jadi salah tanpa error.
- **List dan dict:** sebuah file atau tabel adalah list berisi baris; setiap baris adalah dict dari kolom ke nilai.
- **Menghitung dengan dict:** "berapa per kota, per status, per hari" adalah pertanyaan paling umum dalam data; `GROUP BY` di SQL (Modul 0.3) adalah gagasan yang sama.
- **Set:** membuang duplikat, dan bertanya "apakah ini sudah pernah dimuat?".
- **if dan try/except:** memutuskan baris mana yang valid, dan menyisihkan yang rusak alih-alih crash atau membuangnya diam-diam.
- **Fungsi dengan tes:** setiap langkah pipeline adalah fungsi, dan tesnya adalah cara Anda tahu ia masih berjalan setelah perubahan besok.

Lab akan tumbuh dari sini: di Modul 1.2 gagasan yang sama menjadi pipeline sungguhan yang membaca file, mengonversi tipe, mengarantina baris rusak, dan aman dijalankan ulang. Jika sesuatu di modul ini masih terasa belum jelas, itu wajar setelah sekali baca: baca ulang pelajaran yang Jeda Praktiknya paling sulit, dan kerjakan lagi Coba sendiri-nya.

## @lab Lab: dari kode biasa ke sebelas fungsi kecil pada pesanan KopiKu
Dua bagian, pada data pesanan KopiKu. **Bagian A** (setelah Pelajaran 1 sampai 4) adalah Python biasa tanpa fungsi: Anda mengisi dua belas variabel. **Bagian B** (setelah Pelajaran 5 sampai 7) mengubah gagasan yang sama menjadi sebelas fungsi kecil.

**Apa itu lab.** Setiap bagian adalah file yang Anda edit dan file **tes** yang memeriksanya. Di Bagian A, `practice.py` memberi Anda data dan dua belas variabel yang diisi `None`; Anda mengganti setiap `None` dengan kode Anda sendiri, dan `test_practice.py` menjalankan file Anda, dengan beberapa kumpulan data berbeda menggantikan yang diberikan, lalu memeriksa setiap variabel. Di Bagian B, `basics.py` berisi sebelas fungsi yang isinya kosong (masing-masing hanya berisi `raise NotImplementedError`), dan `test_lab.py` memanggil setiap fungsi dengan contoh, misalnya "`format_rupiah(1250000)` harus menghasilkan `"Rp 1.250.000"`". Sebuah pemeriksaan ✓ jika kode Anda memberi jawaban yang diharapkan, dan ✗ jika memberi jawaban lain atau crash. Anda selesai ketika ke-46 lulus: 15 di Bagian A dan 31 di Bagian B.

**Di mana mengerjakannya: pilih satu dari dua jalur.**

- **Jalur A, pratinjau browser** (tanpa memasang apa pun): kotak editor di bawah pada halaman ini punya tombol **Bagian A / Bagian B**. **Jalankan tes** menjalankan bagian yang sedang Anda buka, dan daftar di bawah tombol menampilkan setiap kelompok pemeriksaan (satu kelompok per langkah atau fungsi) sebagai ✓ atau ✗. Lulus di pratinjau tidak dihitung: Anda mengerjakan lab ini lagi di terminal Anda sendiri.
- **Jalur B, terminal Anda sendiri** (disarankan jika Anda sudah mengikuti Mulai di sini): beginilah Anda akan bekerja di sepanjang kursus, dan run-nya dihitung. Siapkan sekali, di terminal:

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

**Bagian B, sebelas fungsinya, urut sesuai pelajaran, dan mengapa data engineer membutuhkan masing-masing:**

| Gagasan dari pelajaran | Fungsi | Apa yang dilakukannya | Di mana Anda membutuhkannya saat bekerja |
|---|---|---|---|
| 1 | `format_rupiah` | `1250000` menjadi `"Rp 1.250.000"` | laporan, dashboard, dan e-mail menampilkan uang yang bisa dibaca orang |
| 2 | `count_by_status` | berapa pesanan per status | pertanyaan paling umum tentang data apa pun: berapa per kategori (SQL menyebutnya `GROUP BY`, Modul 0.3) |
| 2 | `unique_customer_ids` | setiap pelanggan sekali, terurut | file dikirim ulang dan baris berulang; menghitung pelanggan dua kali menggelembungkan semua angka |
| 3 | `average_total` | rata-rata, atau `None` jika tidak ada pesanan | metrik harus tetap jalan di hari kosong tanpa membuat seluruh job crash |
| 4 | `total_revenue` | jumlah total yang tidak dibatalkan | omzet adalah angka yang dicocokkan Keuangan dengan Anda: teks ke angka, dan filter yang benar |
| 4 | `batches` | potong list menjadi bagian berukuran `size` | kirim data ke API atau database per bagian, bukan satu permintaan raksasa (Modul 1.6) |
| 4 | `top_customers` | `n` pelanggan dengan belanja terbesar | setiap laporan "10 teratas" |
| 6 | `safe_int` | teks ke angka, atau nilai bawaan jika tidak mungkin | mengonversi nilai kotor tanpa membuat run crash |
| 5 | `add_to_batch` | menambah ke list tanpa jebakan "nilai bawaan mutable" | bug persis ini membuat data kemarin bocor ke run hari ini (lihat tab Chaos) |
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

Di produksi, job berjalan di dalam proses worker yang hidup lama. Setelah jam kedua, dashboard menampilkan lagi pesanan dari jam pertama; setelah sehari, pesanan yang sama muncul 24 kali dan omset 24 kali terlalu tinggi. Memulai ulang worker memperbaikinya selama satu jam. Tidak ada yang bisa mereproduksi masalahnya dengan satu tes, sehingga orang mencurigai database, lalu jaringan.

### @cause
Di Python, nilai bawaan sebuah parameter dibuat **sekali**, saat baris `def` dieksekusi, bukan setiap kali fungsi dipanggil. `batch=[]` karena itu adalah satu list tunggal yang hidup selama prosesnya. Setiap pemanggilan yang tidak memberi list sendiri menambah ke list yang sama, sehingga ia mengingat semuanya dari pemanggilan sebelumnya. Proses baru (seperti dalam unit test, atau tepat setelah restart) menyembunyikan bug karena list-nya kosong lagi.

Penyebab yang lebih dalam adalah state tersembunyi: hasil fungsi bergantung pada sesuatu yang bukan masukan, yaitu apa yang dilakukan pemanggilan sebelumnya. Fungsi yang memberi jawaban berbeda untuk masukan yang sama tidak bisa diuji dengan sederhana dan tidak aman dijalankan dua kali.

### @fix
1. Pakai `None` sebagai nilai bawaan dan buat list di dalam fungsi: `if batch is None: batch = []`. Lebih baik lagi, kembalikan list **baru** (`return batch + [order]`) daripada mengubah list yang diberikan.
2. Tambahkan tes yang memanggil fungsi dua kali dan memastikan pemanggilan kedua tidak memuat pesanan dari pemanggilan pertama. Lab punya tes persis seperti itu (`test_never_remembers_previous_calls`).
3. Cari nilai bawaan mutable lain di basis kode (`=[]`, `={}`, `=set()`): linter seperti ruff menandainya otomatis (aturan B006). Jadikan pemeriksaan itu bagian dari build.
4. Pilih fungsi yang keluarannya hanya bergantung pada masukannya. Bila state memang diperlukan, simpan secara eksplisit (parameter atau objek), jangan pernah di nilai bawaan.

### @pattern
Nilai bawaan dibuat sekali. Fungsi harus memberi hasil yang sama untuk masukan yang sama; state tersembunyi mengubah pipeline menjadi yang berfungsi di tes dan gagal di produksi.

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
- [x] Pemanggilan kedua mengembalikan "a", "b", karena list bawaan dibuat sekali dan dipakai bersama

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
