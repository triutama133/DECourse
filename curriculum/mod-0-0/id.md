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
Tidak ada. Anda tidak perlu pernah menulis kode, dan tidak masalah jika kursus sebelumnya membuat Anda bingung. Anda hanya perlu cara menjalankan Python: pratinjau di browser pada lab langsung bisa dipakai; Modul 0.2 lalu mengajarkan penyiapan yang benar di komputer Anda sendiri.

> [!IMPORTANT]
> **Cara Mengerjakan Lab (Panduan Pemula):**
> File kode `labs/mod-0-0/basics.py` adalah **file dokumen teks kode sumber**, bukan perintah shell terminal!
> - **Jangan** mengetik `labs/mod-0-0/basics.py` langsung di terminal bash (akan memicu error `Permission denied` atau `command not found`!).
> - **Buka di editor:** Klik nama file di sidebar editor (VS Code / Cursor), atau ketik `code labs/mod-0-0/basics.py`, atau edit langsung di kotak browser pada tab Lab.
> - **Terminal hanya untuk tes:** Gunakan terminal untuk menjalankan perintah tes otomatis (`pytest labs/mod-0-0/test_lab.py -v`).
> - **Ritme Belajar Ping-Pong:** Jangan membaca seluruh bab sampai habis baru mengoding! Ikuti tanda **👉 Jeda Praktik** di akhir setiap pelajaran untuk mencoba fungsi secara bertahap.

## @lesson Cara program berjalan: nilai, variabel, dan tipe
Program adalah daftar instruksi yang diikuti komputer **dari atas ke bawah, satu baris pada satu waktu**. Tidak ada yang dilewati dan tidak ada yang terjadi "di latar belakang" kecuali Anda memintanya. Ini model mental paling berguna dalam pemrograman: saat tersesat, taruh jari di baris pertama dan berjalanlah ke bawah.

Untuk bekerja, komputer harus mengingat sesuatu. Ia mengingat sebuah **nilai** (potongan data seperti `150000` atau `"paid"`) dan memberinya **nama** agar bisa dipakai lagi. Nilai bernama itu adalah **variabel**:

```python
total = 150000
status = "paid"
print(total)        # menampilkan 150000
```

Bacalah `total = 150000` sebagai "**biarkan nama `total` menunjuk ke nilai 150000**". Tanda `=` bukan "sama dengan" dalam matematika; ia adalah *penugasan* (assignment): hitung sisi kanan dulu, lalu tempelkan nama di kiri ke hasilnya. Karena itu `total = total + 1000` masuk akal di Python (ambil nilai lama, tambah 1000, tempelkan nama ke nilai baru) tetapi tidak masuk akal dalam matematika.

Setiap nilai punya **tipe**, yang memberi tahu Python apa yang boleh Anda lakukan dengannya. Lima yang akan Anda pakai setiap hari:

| Tipe | Contoh | Arti |
|---|---|---|
| `int` | `150000` | bilangan bulat |
| `float` | `3.5` | bilangan dengan desimal |
| `str` | `"paid"` | teks, selalu di dalam tanda kutip |
| `bool` | `True`, `False` | ya atau tidak |
| `None` | `None` | "tidak ada nilai" |

**Mengapa tipe penting, dengan masalah data engineering yang nyata.** File CSV hanya berisi teks. Total `150000` tiba sebagai *teks* `"150000"`, dan `"150000" + 1` gagal karena Python tidak mau menebak apakah Anda ingin menyambung teks atau berhitung. Anda mengonversi dengan sengaja: `int("150000") + 1` menghasilkan `150001`. Teks seperti `"Rp 1.250.000"` sama sekali tidak bisa dikonversi (Python memunculkan error), dan begitulah data kotor muncul di pipeline sungguhan. Periksa tipe dengan `type(total)`.

Dua jebakan yang perlu dipelajari sekarang. Pertama, uang harus berupa `int` dalam satuan terkecil, karena desimal disimpan secara biner dan tidak selalu bisa tepat: `0.1 + 0.2` adalah `0.30000000000000004`. Kedua, susun teks dengan **f-string**: `f"Order {1001}: Rp {total}"` memasukkan nilai ke dalam teks, dan lebih mudah dibaca daripada menyambung potongan dengan `+`. Fungsi angka bawaan yang sangat berguna adalah `abs(n)`, yang mengembalikan jarak positif dari nol: `abs(-45000)` menghasilkan `45000`. Ini sangat membantu saat memformat mata uang negatif di mana tanda minus harus berada di depan awalan rupiah (`"-Rp 45.000"`, bukan `"Rp -45.000"`).

Telusuri ini dengan tangan sebelum menjalankannya: `a = 2`, `b = a * 3`, `a = 10`, `print(b)`. Hasilnya `6`, bukan `30`. `b` mendapat nilai 6 pada saat penugasan; mengubah `a` kemudian tidak mengubah `b`. Jika Anda menebak 30, Anda baru saja mempelajari sesuatu yang penting.

> 💡 **Jeda Praktik 1 (Coba Sekarang):**
> Jangan membaca materi berikutnya dulu! Buka file kerja `labs/mod-0-0/basics.py` di Text Editor Anda (klik file di sidebar editor Anda atau ketik `code labs/mod-0-0/basics.py`). 
> Temukan fungsi `format_rupiah(amount)` (baris 13), hapus baris `raise NotImplementedError`, dan tulis logika format Rupiah Anda. Lalu uji di terminal:
> `pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v`
> Jika 4 tes berhasil hijau, selamat! Anda telah memecahkan fungsi pertama. Lanjut ke Pelajaran 2 di bawah.

## @lesson Koleksi: satu nilai tidak pernah cukup
Satu pesanan punya beberapa fakta, dan satu file punya ribuan pesanan. Python memberi Anda empat wadah. Mengetahui **mengapa masing-masing ada** memberi tahu Anda mana yang dipilih.

**List** (`[...]`): deretan hal yang berurutan, tempat posisi penting dan duplikat boleh ada. `orders = [row1, row2, row3]`. Anda membaca berdasarkan posisi mulai dari **0**: `orders[0]` yang pertama, `orders[-1]` yang terakhir, `orders[1:3]` adalah *irisan* (slice; posisi 1 dan 2). `len(orders)` menghitung, `orders.append(x)` menambah di akhir. Pakai list untuk "semua baris dari file".

**Dictionary** (`{...}`): mencari berdasarkan *nama*, bukan posisi. Satu pesanan adalah sebuah dict: 

```python
order = {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"}
print(order["status"])         # paid
print(order.get("note"))       # None: .get memberi None, bukan error, jika kuncinya tidak ada
order["status"] = "shipped"    # ubah sebuah nilai
```

Membaca kunci yang tidak ada dengan `order["note"]` memunculkan `KeyError`; `.get("note", "")` memberi nilai bawaan. Dict juga alat untuk **menghitung**: `counts[status] = counts.get(status, 0) + 1`. Ingat baris ini; Anda akan menulisnya berkali-kali. Untuk memeriksa kunci dan nilai secara bersamaan, gunakan `order.items()`: ia menghasilkan deretan pasangan `(kunci, nilai)`, yang memungkinkan Anda menelusuri keduanya atau mengurutkannya dalam pemeringkatan.

**Tuple** (`(...)`): kelompok kecil tetap yang tidak seharusnya berubah, seperti `("paid", 3)`. Fungsi sering mengembalikan tuple untuk memberi dua hal sekaligus.

**Set** (`{...}` tanpa kunci): kantong nilai **unik** tanpa urutan. `set([7, 3, 7, 5])` adalah `{3, 5, 7}`. Pakai untuk membuang duplikat, dan untuk bertanya "pernahkah saya melihat ini?" dengan sangat cepat memakai `x in seen`. Karena set tidak berurutan, gunakan fungsi bawaan `sorted(my_set)` kapan pun Anda memerlukan nilai-nilai unik tersebut kembali sebagai list yang terurut (misalnya, ID pelanggan dari terkecil ke terbesar: `sorted({7, 3, 5})` menghasilkan `[3, 5, 7]`).

Data file nyata karenanya biasanya adalah **list berisi dictionary**: list adalah file, setiap dict adalah satu baris, kuncinya adalah nama kolom. `orders` di lab terlihat persis seperti ini.

Satu gagasan untuk dikenal sejak awal: **mutable versus immutable**. List, dict, dan set bisa diubah di tempat; string, angka, dan tuple tidak. Ketika dua nama menunjuk ke list yang sama, perubahan lewat satu nama terlihat lewat nama yang lain. Itulah akar bug Python yang paling terkenal, yang diperlihatkan skenario chaos modul ini.

> 💡 **Jeda Praktik 2 (Coba Sekarang):**
> Buka kembali `labs/mod-0-0/basics.py` di editor Anda. Terapkan gagasan dictionary dan set yang baru saja Anda pelajari:
> 1. Kerjakan `count_by_status(orders)` menggunakan pola penghitungan dict `counts[status] = counts.get(status, 0) + 1`.
> 2. Kerjakan `unique_customer_ids(orders)` menggunakan `set` dan `sorted()`.
> Uji kedua fungsi ini di terminal:
> `pytest labs/mod-0-0/test_lab.py -k "TestCount or TestUnique" -v`

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

**Mengapa keputusan ada di mana-mana dalam pipeline.** Aturan Modul 0.1 adalah "jangan menebak dan jangan membuang diam-diam". Dalam kode, aturan itu adalah `if` dengan dua cabang: baris yang valid lanjut, baris yang tidak valid disisihkan *beserta alasannya*. `else` yang tidak melakukan apa-apa adalah cara data hilang tanpa jejak.

Pembagian dengan nol juga masalah keputusan: rata-rata dari list kosong bukan 0, ia tidak ada. `if not values: return None` menanganinya sebelum error terjadi. Lebih baik periksa kasus berbahaya lebih dulu lalu keluar lebih awal.

> 💡 **Jeda Praktik 3 (Coba Sekarang):**
> Buka `labs/mod-0-0/basics.py`, temukan fungsi `average_total(orders)`. Terapkan aturan pencegahan pembagian dengan nol: periksa apakah orders kosong terlebih dahulu (`if not orders: return None`). Lalu uji di terminal:
> `pytest labs/mod-0-0/test_lab.py -k TestAverageTotal -v`

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

> 💡 **Jeda Praktik 4 (Coba Sekarang):**
> Terapkan perulangan for, accumulator, pemotongan slicing, dan pemeringkatan:
> 1. Kerjakan `total_revenue(orders)` untuk menjumlahkan pesanan yang tidak dibatalkan.
> 2. Kerjakan `batches(items, size)` menggunakan loop `range(0, len(items), size)`.
> 3. Kerjakan `top_customers(orders, n)` menggunakan `sorted(..., key=lambda pair: (-pair[1], pair[0]))`.
> Uji di terminal:
> `pytest labs/mod-0-0/test_lab.py -k "TestTotal or TestBatches or TestTop" -v`

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

Pilih fungsi yang hanya bergantung pada masukannya dan me-return hasil tanpa mengubah hal lain (**fungsi murni**). Mereka mudah diuji dan aman dijalankan dua kali, sifat yang dibutuhkan pipeline (Modul 0.1: idempotensi).

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

> 💡 **Jeda Praktik 5 (Coba Sekarang):**
> Terapkan fungsi murni, penanganan error, dan pencegahan bug mutable default:
> 1. Kerjakan `safe_int(text, default=None)` dengan blok `try / except ValueError`.
> 2. Kerjakan `add_to_batch(order, batch=None)` dengan `if batch is None: batch = []`.
> 3. Kerjakan `split_valid(orders)` menggunakan fungsi `safe_int` yang Anda buat.
> Uji di terminal:
> `pytest labs/mod-0-0/test_lab.py -k "TestSafeInt or TestAddToBatch or TestSplitValid" -v`

## @lesson File, import, dan menjalankan skrip
Program membaca file. Pola standarnya:

```python
import csv

with open("orders.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
```

Mengapa setiap bagian ada. `open` memberi Anda sambungan ke file. **`with`** menjamin file ditutup saat blok selesai, bahkan jika terjadi error di dalamnya, sehingga Anda tidak membiarkan file terbuka (masalah nyata pada job yang berjalan lama). `encoding="utf-8"` menyatakan bagaimana byte menjadi teks; jika dihilangkan, program Anda berperilaku berbeda di komputer berbeda. `newline=""` adalah yang diminta modul csv agar pemisah baris di dalam nilai bertanda kutip tetap utuh. `csv.DictReader(f)` mengubah setiap baris menjadi dict dengan baris header sebagai kunci, sehingga Anda mendapat persis list berisi dictionary dari pelajaran 2. Semua nilainya string; mengonversinya adalah tugas Anda.

**Import** membawa kode yang ditulis orang lain. **Pustaka standar** (standard library) datang bersama Python dan tidak perlu dipasang: `csv`, `json`, `pathlib`, `datetime`, `statistics`. Pustaka lain (pandas, pydantic) dipasang dengan `pip` ke virtual environment Anda (Modul 0.2). File Anda sendiri `basics.py` juga sebuah **modul**: `import basics` menjalankannya sekali dan memberi fungsinya sebagai `basics.total_revenue(...)`. Begitulah tes lab memakai kode Anda.

Anda menjalankan skrip dengan `python3 myfile.py`. Baris yang umum di bagian bawah skrip adalah:

```python
if __name__ == "__main__":
    main()
```

Python mengisi nama khusus `__name__` dengan `"__main__"` hanya saat file *dijalankan langsung*. Ketika file lain meng-import-nya, `__name__` adalah nama modulnya, sehingga `main()` tidak berjalan. Akibatnya: file bisa berfungsi sebagai program dan sebagai pustaka yang bisa Anda uji.

Path: pakai `pathlib.Path("data") / "orders.csv"` daripada menyambung string, dan ingat bahwa path relatif dihitung dari folder tempat Anda memulai Python, yang biasanya jadi sebab `FileNotFoundError`.

> 💡 **Jeda Praktik 6 (Lengkapi Seluruh Lab):**
> Buka `labs/mod-0-0/basics.py`, kerjakan fungsi terakhir `read_orders(path)` menggunakan `with open(...)` dan `csv.DictReader`.
> Sekarang, jalankan seluruh rangkaian 31 unit test di terminal:
> `pytest labs/mod-0-0/test_lab.py -v`
> Jika semua 31 tes berwarna HIJAU, seluruh fondasi Python Anda telah terbukti bekerja!

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

`assert` memunculkan error jika kondisinya salah. Alat uji (pytest) menemukan fungsi bernama `test_...`, menjalankan semuanya dan melaporkan mana yang gagal dan mengapa. Lab punya 31 tes seperti itu: bacalah tes yang gagal sebagai **spesifikasi** (ia menyatakan persis apa yang diharapkan), bukan sebagai rintangan.

Anda tidak akan mengingat semuanya setelah sekali membaca, dan memang tidak diharapkan. Ketik contoh-contohnya, rusak dengan sengaja, dan lihat pesan errornya. Setiap fungsi lab di bawah melatih satu pelajaran; kerjakan berurutan dan jalankan tes setelah masing-masing.

## @lab Lab: sebelas fungsi kecil pada pesanan KopiKu
Tulis sebelas fungsi pendek, masing-masing melatih satu gagasan dari pelajaran: memformat angka, mengonversi teks dengan aman, mengulang dan menjumlahkan, menghitung dengan dictionary, membuang duplikat dengan set, memisahkan yang valid dari yang tidak, merata-rata tanpa membagi dengan nol, membuat peringkat, memotong list menjadi batch, menghindari jebakan nilai bawaan mutable, dan membaca file CSV. Tesnya (31) memberi tahu apa yang harus dilakukan setiap fungsi.

### @steps
1. Buka file kerja `labs/mod-0-0/basics.py` di Text Editor Anda (misal: klik file di sidebar VS Code/Cursor atau ketik `code labs/mod-0-0/basics.py`; *JANGAN dieksekusi langsung di bash!*). Baca isinya dari atas ke bawah. Setiap fungsi memiliki docstring dengan contoh dan nomor pelajaran yang bersangkutan.
2. Kerjakan berurutan mengikuti panduan **Jeda Praktik** di setiap akhir pelajaran, dan jalankan tes setelah SETIAP fungsi: `format_rupiah`, `count_by_status`, `unique_customer_ids`, `average_total`, `total_revenue`, `batches`, `top_customers`, `safe_int`, `add_to_batch`, `split_valid`, `read_orders`.

```bash
pytest labs/mod-0-0/test_lab.py -v                    # semuanya
pytest labs/mod-0-0/test_lab.py -v -k TestSafeInt     # hanya satu kelompok saat Anda bekerja
```

3. Saat tes gagal, bacalah seperti spesifikasi: nama tes menyatakan apa yang Anda rusak, baris terakhir menunjukkan nilai yang diharapkan dan yang sebenarnya. Cetak nilai di dalam fungsi Anda (`print(type(x), x)`) jika Anda ragu apa yang sedang Anda tangani.
4. Sebelum menjalankan, **tebak**: tulis tes mana yang Anda harapkan lulus. Ketika hasilnya mengejutkan, cari tahu mengapa. Kejutan itulah tempat belajar terjadi.
5. **Kerjakan yang sesungguhnya.** Kotak di browser di atas hanya pratinjau. Setelah Modul 0.2, ulangi lab ini di komputer Anda sendiri dalam venv Anda sendiri, tulis kodenya lagi **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-0-0` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-0-0/basics.py :: File kerja Anda: implementasikan sebelas fungsi TODO :: starter
- labs/mod-0-0/test_lab.py :: Ke-31 tes yang memeriksa pekerjaan Anda :: test
- labs/mod-0-0/requirements.txt :: pytest :: config
- labs/mod-0-0/reference/basics.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 31 tes di test_lab.py lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri** (lulus di pratinjau browser tidak dihitung)
- Anda bisa menjelaskan dengan kata-kata sendiri beda `print` dan `return`, serta beda list, dict, dan set
- Anda bisa menjelaskan mengapa `batch=[]` sebagai nilai bawaan adalah bug dan apa yang harus ditulis sebagai gantinya

### @verify
Jalankan tes dari root repositori:

```bash
pytest labs/mod-0-0/test_lab.py -v
python3 scripts/prove.py mod-0-0
```

Jalankan yang diketahui benar: awali perintah pertama dengan `LAB_DIR=reference`.

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
