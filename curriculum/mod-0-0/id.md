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
> - **Mulai sederhana, lalu lab:** Pelajaran 1 sampai 4 masing-masing diakhiri **Jeda Praktik** dengan cara sederhana: beberapa baris Python biasa, diketik di prompt `>>>` atau di file latihan, belum memakai fungsi. Pelajaran 5 mengajarkan fungsi (`def`); dari sana jedanya mengarahkan Anda ke lab, tempat Anda mengubah kode yang sudah Anda tulis menjadi fungsi-fungsinya. Jangan membaca seluruh bab lebih dulu; bergantianlah antara pelajaran dan jedanya.
> - **Lab, mulai Pelajaran 5:** di **Pratinjau browser** pada tab Lab, atau di terminal Anda sendiri jika Anda sudah mengikuti Mulai di sini (halaman lab menunjukkan empat perintah persiapannya, sekali saja). Kode lab ada di file `labs/mod-0-0/basics.py`. Itu file teks yang Anda buka di editor (VS Code, atau `code labs/mod-0-0/basics.py`), bukan perintah: mengetik namanya di terminal menghasilkan `Permission denied` atau `command not found`. Perintah `pytest ...` di bawah setiap jeda menjalankan tesnya di sana, dan run itulah yang dihitung.
> - **Mencoba contoh di materi:** ketik di prompt Python `>>>` di terminal Anda (ketik `python3` lalu Enter untuk masuk; keluar dengan `exit()`), atau di pratinjau browser. Perintah seperti `cd`, `ls`, dan `pytest` diketik di prompt terminal `$`, tidak pernah di `>>>`. Ragu yang mana? **Mulai di sini, langkah 4** ("Tiga tempat Anda mengetik") menunjukkan ketiganya beserta tampilannya.

## @part Dasar: nilai, koleksi, keputusan, dan perulangan

## @lesson Cara program berjalan: nilai, variabel, dan tipe
Program adalah daftar instruksi yang diikuti komputer **dari atas ke bawah, satu baris pada satu waktu**. Tidak ada yang dilewati dan tidak ada yang terjadi "di latar belakang" kecuali Anda memintanya. Ini model mental paling berguna dalam pemrograman: saat tersesat, taruh jari di baris pertama dan berjalanlah ke bawah.

### Nilai dan variabel

Untuk bekerja, komputer harus mengingat sesuatu. Ia mengingat sebuah **nilai** (potongan data seperti `150000` atau `"paid"`) dan memberinya **nama** agar bisa dipakai lagi. Nilai bernama itu adalah **variabel**:

```python
total = 150000
status = "paid"
print(total)        # menampilkan 150000
```

> **Di mana saya mengetik ini?** Untuk mencoba cepat: buka terminal, ketik `python3`, tekan Enter, lalu ketik ketiga baris itu di prompt `>>>`, Enter setelah setiap baris. `print(total)` menampilkan `150000`. Di `>>>` Anda juga bisa mengetik `total` saja dan Python menampilkan nilainya; di file `.py` yang disimpan, tidak ada yang tampil kecuali Anda mem-`print`-nya. Keluar dengan `exit()`. (Mulai di sini, langkah 4, menjelaskan terminal, `>>>`, dan file berdampingan.)

Bacalah `total = 150000` sebagai "**biarkan nama `total` menunjuk ke nilai 150000**". Tanda `=` bukan "sama dengan" dalam matematika; ia adalah *penugasan* (assignment): hitung sisi kanan dulu, lalu tempelkan nama di kiri ke hasilnya. Karena itu `total = total + 1000` masuk akal di Python (ambil nilai lama, tambah 1000, tempelkan nama ke nilai baru) tetapi tidak masuk akal dalam matematika.

### Tipe

Setiap nilai punya **tipe**, yang memberi tahu Python apa yang boleh Anda lakukan dengannya. Lima yang akan Anda pakai setiap hari:

| Tipe | Contoh | Arti |
|---|---|---|
| `int` | `150000` | bilangan bulat |
| `float` | `3.5` | bilangan dengan desimal |
| `str` | `"paid"` | teks, selalu di dalam tanda kutip |
| `bool` | `True`, `False` | ya atau tidak |
| `None` | `None` | "tidak ada nilai" |

### Mengapa tipe penting: bug pertama di setiap pekerjaan data

Semua yang masuk ke program Anda dari luar, file CSV, API web, formulir, masuk sebagai **teks**. Ini dua pesanan KopiKu persis seperti yang dibaca Python dari file CSV:

```python
row1 = {"order_id": "1001", "status": "paid", "total_idr": "150000"}
row2 = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
```

Perhatikan tanda kutipnya: `"150000"` adalah teks (`str`), bukan angka. Sekarang atasan Anda bertanya tiga hal sederhana, dan teks itu memberi tiga jawaban salah **tanpa error apa pun**:

| Pertanyaannya | Yang Anda tulis | Jawaban Python | Mengapa |
|---|---|---|---|
| Total dua pesanan? | `row1["total_idr"] + row2["total_idr"]` | `'15000090000'` | `+` pada teks menyambung karakternya |
| Apakah 90.000 lebih besar dari 150.000? | `"90000" > "150000"` | `True` | teks dibandingkan karakter demi karakter, seperti kata di kamus, dan `"9"` datang setelah `"1"` |
| Total dari kecil ke besar? | `sorted(["150000", "90000", "25000"])` | `['150000', '25000', '90000']` | urutan karakter demi karakter yang sama |

Tidak ada yang crash. Programnya berjalan, laporannya terkirim, dan setiap angka di dalamnya salah. Karena itulah tugas pertama data engineer dengan data baru apa pun adalah **memberi setiap nilai tipe yang benar, dengan sengaja**: `int("150000")` adalah angka `150000`. Dengan angka, tiga pertanyaan yang sama menjawab `240000`, `False`, dan `[25000, 90000, 150000]`. Periksa apa yang Anda pegang dengan `type(x)`: `type(row1["total_idr"])` menampilkan `<class 'str'>`.

Tipe melindungi Anda dengan dua cara lagi:
- **Teks kotor gagal dengan keras, dan itu bagus.** `int("Rp 1.250.000")` memunculkan `ValueError: invalid literal for int() with base 10: 'Rp 1.250.000'`. Error yang menghentikan Anda lebih baik daripada angka salah yang tidak disadari siapa pun. Pelajaran 6 menunjukkan cara menangkapnya dan menyisihkan baris yang rusak.
- **`None` bukan `0`.** Total yang hilang (`None`) berarti "kita tidak tahu"; `0` berarti "pesanannya gratis". `None == 0` adalah `False`. Kalau tertukar, rata-rata dan total jadi salah diam-diam.

**Di mana Anda akan bertemu ini lagi.** Di mana-mana: database memberi setiap kolom sebuah tipe (Modul 0.3); pipeline mengonversi dan memeriksa tipe sebelum memuat apa pun (Modul 1.2); format file seperti Parquet menyimpan tipe di samping datanya sehingga tidak ada yang perlu menebak (Modul 2.1). Tugas pemanasan pertama di simulator kerja persis ini: harga yang diketik sebagai teks, diubah menjadi angka.

> 🛠 **Coba sendiri (5 menit, Python di prompt `>>>`).** Di terminal ketik `python3`, lalu ketik (atau tempel) baris `row1` dan tekan Enter, kemudian baris `row2` dan tekan Enter: satu baris setiap kali. Jika Anda menempel keduanya sekaligus, prompt menampilkan `...`: Python menunggu akhir blok, jadi tekan Enter sekali lagi pada baris `...` yang kosong (bukan Ctrl+C, yang membatalkannya). Sebelum setiap pertanyaan di tabel, **tebak** jawabannya, lalu ketik kodenya dan bandingkan. Kemudian jawab tiga pertanyaan yang sama lagi dengan `int(...)` di sekitar setiap total.
>
> **Seharusnya Anda melihat:** `'15000090000'`, `True`, dan `['150000', '25000', '90000']` dengan teks; `240000`, `False`, dan `[25000, 90000, 150000]` dengan angka. Jika salah satu tebakan Anda keliru, itulah pelajarannya: tulis dalam satu kalimat mengapa.

### Memformat teks dan angka (`abs`, f-string, `.replace`)

Beberapa alat kecil bawaan ini langsung berguna sejak hari pertama:

- **Jebakan desimal:** simpan uang sebagai `int` dalam satuan terkecil (rupiah atau sen), karena desimal disimpan secara biner dan `0.1 + 0.2` menghasilkan `0.30000000000000004`.
- **`abs(n)`** mengembalikan jarak dari nol (selalu tidak negatif): `abs(-45000)` adalah `45000`. Berguna di Pelajaran 3 saat memformat uang negatif (`"-Rp 45.000"`, bukan `"Rp -45.000"`).
- **Urutan penugasan:** telusuri `a = 2`, `b = a * 3`, `a = 10`, `print(b)` di kertas sebelum dijalankan. Hasilnya `6`, bukan `30`, karena `b` mendapat `6` saat ditugaskan dan mengubah `a` belakangan tidak menghitung ulang `b`.
- **f-string & kode format:** menaruh `f"..."` sebelum tanda kutip membuat Python menyisipkan nilai di dalam `{...}` (misalnya `f"Order {1001}: Rp {total}"`), dan menambahkan `:,` di `{amount:,}` menyisipkan koma pemisah ribuan: `f"{1250000:,}"` menghasilkan `"1,250,000"`.
- **`.replace(old, new)` pada teks:** string punya aksi bawaan bernama *method*. Memanggil `"1,250,000".replace(",", ".")` menukar setiap koma menjadi titik, menghasilkan `"1.250.000"`. Bersama-sama keduanya memformat angka gaya Indonesia.

> 🛠 **Coba sendiri (10 menit, Python di file latihan): Jeda Praktik 1, cara sederhana.** Belum ada fungsi: hanya variabel, f-string, dan `.replace`. Sekali saja, di terminal, buat folder untuk file latihan Anda: `mkdir -p ~/practice`. Di VS Code pilih File, New File, ketik tiga baris ini, lalu simpan (File, Save As) sebagai `pause1.py` di dalam folder `practice` di folder rumah Anda. Lalu jalankan dari terminal dengan `python3 ~/practice/pause1.py`:
>
> `amount = 1250000`
> `text = f"Rp {amount:,}"`
> `print(text)`
>
> Hasilnya `Rp 1,250,000`, dengan koma. Ubah baris kedua agar komanya menjadi titik, jalankan lagi, lalu coba `amount` bernilai `0`, `999`, dan `1000`. Angka negatif butuh `if`, yang datang di Pelajaran 3.
>
> **Seharusnya Anda melihat:** `Rp 1.250.000`, `Rp 0`, `Rp 999`, dan `Rp 1.000`. Simpan file-nya: di Pelajaran 5 baris-baris inilah yang menjadi fungsi pertama lab.

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

> 🛠 **Coba sendiri (10 menit, Python di file latihan): Jeda Praktik 2, cara sederhana.** Buat `~/practice/pause2.py` yang diawali list empat pesanan ini (list berisi dict, persis seperti yang diberikan file CSV):
>
> ```python
> orders = [
>     {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"},
>     {"order_id": "1002", "customer_id": "3", "status": "cancelled", "total_idr": "90000"},
>     {"order_id": "1003", "customer_id": "7", "status": "paid", "total_idr": "25000"},
>     {"order_id": "1004", "customer_id": "5", "status": "delivered", "total_idr": "60000"},
> ]
> ```
>
> Lalu, masih tanpa perulangan, cetak: berapa jumlah pesanannya (`len`); status pesanan pertama; total pesanan terakhir. Hitung dua status secara manual dengan baris penghitung: `counts = {}`, lalu `counts["paid"] = counts.get("paid", 0) + 1`, cetak `counts`, lakukan lagi untuk `"paid"` dan sekali untuk `"cancelled"`, cetak lagi. Terakhir masukkan keempat nilai `customer_id` ke sebuah set dan cetak berapa pelanggan yang berbeda, lalu bandingkan `sorted([7, 3, 7, 5])` dengan `sorted(set([7, 3, 7, 5]))`.
>
> **Seharusnya Anda melihat:** `4`, `paid`, `60000`; `{'paid': 1}` lalu `{'paid': 2, 'cancelled': 1}`; `3` pelanggan berbeda; `[3, 5, 7, 7]` dibanding `[3, 5, 7]`. Menghitung secara manual memang sengaja lambat: perulangan di Pelajaran 4 melakukan persis ini untuk setiap pesanan.

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

Pembagian dengan nol juga masalah keputusan: rata-rata dari list kosong bukan 0, ia tidak ada. Gunakan fungsi bawaan `sum(values)` (menjumlahkan semua angka dalam list) dan `len(values)` (menghitung jumlah item), lalu jaga dengan `if`: `if not values: avg = None` menangani list kosong sebelum error terjadi, sedangkan `else: avg = sum(values) / len(values)` berjalan aman saat ada data. Biasakan memeriksa kasus berbahaya lebih dulu.

> 🛠 **Coba sendiri (10 menit, Python di file latihan): Jeda Praktik 3, cara sederhana.** Di `~/practice/pause3.py`: (1) isi `amount = -45000` dan pakai `if` dengan `abs()` agar angka negatif ditulis `-Rp 45.000` sementara angka positif tetap menghasilkan `Rp 45.000`; (2) isi `totals = []` dan cetak rata-ratanya dengan `sum(totals) / len(totals)` (`sum` menjumlahkan list berisi angka, `len` menghitung isinya), tetapi hanya jika list-nya tidak kosong, dan cetak `None` jika kosong; jalankan, lalu ubah `totals` menjadi `[150000, 25000]` dan jalankan lagi.
>
> **Seharusnya Anda melihat:** `-Rp 45.000`, lalu `None` untuk list kosong dan `87500.0` untuk dua total itu. Tanpa `if`, list kosong menghentikan program Anda dengan `ZeroDivisionError`.

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

> 🛠 **Coba sendiri (15 menit, Python di file latihan): Jeda Praktik 4, cara sederhana.** Salin list `orders` dari Jeda 2 ke `~/practice/pause4.py`. Dengan satu perulangan `for order in orders:`, bangun tiga hal sekaligus: `counts` (pesanan per status, dengan baris penghitung dari Pelajaran 2), `revenue` (jumlah `int(order["total_idr"])` untuk pesanan yang statusnya bukan `"cancelled"` atau `"refunded"`), dan `ids` (sebuah set: `ids = set()` sebelum perulangan, `ids.add(int(order["customer_id"]))` di dalamnya, yang memasukkan satu nilai ke set). Cetak setelah perulangan, dengan `sorted(ids)`. Lalu potong `items = [1, 2, 3, 4, 5]` menjadi bagian berisi 2 dengan `for start in range(0, len(items), 2):` dan slice `items[start:start + 2]`, kumpulkan potongannya dalam sebuah list.
>
> **Seharusnya Anda melihat:** `{'paid': 2, 'cancelled': 1, 'delivered': 1}`, `235000`, `[3, 5, 7]`, dan `[[1, 2], [3, 4], [5]]`. Anda sekarang sudah menulis, dengan cara sederhana, isi dari lima dari sebelas fungsi lab.

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

Pilih fungsi yang hanya bergantung pada masukannya dan me-return hasil tanpa mengubah hal lain (**fungsi murni**). Mereka mudah diuji dan aman dijalankan dua kali, sifat yang dibutuhkan pipeline (Modul 0.1: idempotensi).

**Mengetik fungsi di prompt `>>>`.** Setelah baris yang diakhiri `:`, seperti `def double(n):`, Python menampilkan `...` dan menjorokkan baris berikutnya untuk Anda. Setelah fungsinya lengkap, tekan **Enter sekali lagi pada baris kosong** untuk menyelesaikannya; tanpa baris kosong itu, apa pun yang Anda ketik berikutnya menjadi bagian dari fungsi. Untuk yang lebih dari dua baris, file lebih mudah.

> 🛠 **Coba sendiri (8 menit, di file `fn.py`).** Tebak dulu setiap output di kepala Anda, baru jalankan.
> 1. Tulis `def show_square(n): print(n * n)` dan `def give_square(n): return n * n` (masing-masing di barisnya sendiri seperti biasa). Jalankan `a = show_square(4)` dan `b = give_square(4)`, lalu `print(a, b)`.
> 2. Tulis `def add(item, box=[]): box.append(item); return box` (dengan baris yang benar) dan jalankan `print(add(1))`, `print(add(2))`, `print(add(3))`. Lalu perbaiki agar setiap pemanggilan tanpa argumen kedua mulai dengan list kosong yang baru.
> 3. Tulis `total(orders)` yang menjumlahkan `int(order["total_idr"])` dari list dict pesanan, tanpa `print` di dalamnya. Periksa dengan `total([{"total_idr": "100"}, {"total_idr": "250"}]) == 350` dan `total([]) == 0`.
>
> **Seharusnya Anda melihat:** `16` dicetak oleh langkah 1, lalu `None 16` (`print` menampilkan, `return` mengembalikan); `add` yang salah mencetak `[1]`, `[1, 2]`, `[1, 2, 3]` dan yang sudah Anda perbaiki `[1]`, `[2]`, `[3]`; kedua pemeriksaan di langkah 3 bernilai `True`.

> 💡 **Jeda Praktik 5 (Buka lab):**
> Sekarang buka lab: **Pratinjau browser** di tab Lab, atau `labs/mod-0-0/basics.py` di editor Anda pada jalur terminal (halaman lab menunjukkan persiapan sekali saja). Setiap fungsi di sana diawali seperti `def format_rupiah(amount):`, lalu deskripsinya di antara `"""`, lalu `raise NotImplementedError(...)`: penanda tempat yang berarti "belum ditulis". Hapus baris itu dan taruh kode Anda sendiri dari Jeda 1 sampai 4 di tempatnya, dengan dua perubahan: nilainya masuk sebagai parameter (`amount`, `orders`) alih-alih variabel yang Anda ketik, dan jawabannya keluar dengan `return` alih-alih `print`.
> Sebelumnya, di Jeda 1:
>
> ```python
> amount = 1250000
> text = ...                 # baris Anda dari Jeda 1
> print(text)
> ```
>
> Sesudahnya, di lab:
>
> ```python
> def format_rupiah(amount):
>     text = ...             # baris yang sama, dijorokkan
>     return text
> ```
>
> `amount` tidak lagi mendapat nilai dari Anda: tes yang memberinya, dengan memanggil misalnya `format_rupiah(1250000)`. Lalu tambahkan `if` dari Jeda 3 untuk angka negatif.
> Lakukan untuk `format_rupiah` (Jeda 1 dan 3), `count_by_status` dan `unique_customer_ids` (Jeda 4), `average_total` (Jeda 3, tetapi atas total pesanan), `total_revenue` dan `batches` (Jeda 4), serta `top_customers` (`sorted` dengan `key` dari Pelajaran 4). Di Pratinjau browser klik **Jalankan tes**; di jalur terminal, `pytest` menjalankan semua pemeriksaan otomatis (flag `-k TestFormatRupiah` memilih kelompok itu saja dan `-v` menampilkan nama tiap tes):
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

> 💡 **Jeda Praktik 6 (Coba Sekarang):**
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

**Import** membawa kode yang ditulis orang lain. **Pustaka standar** (standard library) datang bersama Python dan tidak perlu dipasang: `csv`, `json`, `pathlib`, `datetime`, `statistics`. Pustaka lain (pandas, pydantic) dipasang dengan `pip` ke virtual environment Anda (Modul 0.2). File Anda sendiri `basics.py` juga sebuah **modul**: `import basics` menjalankannya sekali dan memberi fungsinya sebagai `basics.total_revenue(...)`. Begitulah tes lab memakai kode Anda.

Anda menjalankan skrip dengan `python3 myfile.py`. Baris yang umum di bagian bawah skrip adalah:

```python
if __name__ == "__main__":
    main()
```

Python mengisi nama khusus `__name__` dengan `"__main__"` hanya saat file *dijalankan langsung*. Ketika file lain meng-import-nya, `__name__` adalah nama modulnya, sehingga `main()` tidak berjalan. Akibatnya: file bisa berfungsi sebagai program dan sebagai pustaka yang bisa Anda uji.

Path: pakai `pathlib.Path("data") / "orders.csv"` daripada menyambung string, dan ingat bahwa path relatif dihitung dari folder tempat Anda memulai Python, yang biasanya jadi sebab `FileNotFoundError`.

> 💡 **Jeda Praktik 7 (Lengkapi Seluruh Lab):**
> Di `basics.py`, kerjakan fungsi terakhir `read_orders(path)` menggunakan `with open(...)` dan `csv.DictReader`.
> Klik **Jalankan tes** sekali lagi (atau jalankan semua tes di terminal): ke-31 tes seharusnya lulus. Di jalur pratinjau, setelah Modul 0.2 Anda menulis ulang lab ini di komputer Anda sendiri dan menjalankan ke-31 tes di sana:
> `pytest labs/mod-0-0/test_lab.py -v`
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

`assert` memunculkan error jika kondisinya salah. Alat uji (pytest) menemukan fungsi bernama `test_...`, menjalankan semuanya dan melaporkan mana yang gagal dan mengapa. Lab punya 31 tes seperti itu: bacalah tes yang gagal sebagai **spesifikasi** (ia menyatakan persis apa yang diharapkan), bukan sebagai rintangan.

Anda tidak akan mengingat semuanya setelah sekali membaca, dan memang tidak diharapkan. Ketik contoh-contohnya, rusak dengan sengaja, dan lihat pesan errornya. Setiap fungsi lab di bawah melatih satu pelajaran; kerjakan berurutan dan jalankan tes setelah masing-masing.

> 🛠 **Coba sendiri (15 menit).** Jalankan `python3 labs/mod-0-0/debug_me.py`. Isinya tiga fungsi kecil, masing-masing dengan satu bug, dan mencetak PASS atau FAIL untuk setiap fungsi. Perbaiki satu per satu dengan rutinitas dari pelajaran ini: baca error dari bawah, ulangi dengan input sekecil mungkin, periksa nilainya tepat sebelum baris yang gagal. Jangan menulis ulang fungsinya; temukan bug-nya.
>
> **Seharusnya Anda melihat:** tiga baris FAIL di awal (satu `TypeError`, dua jawaban salah) dan `all three fixed` di akhir. Lalu tulis satu kalimat per bug: petunjuk apa yang membawa Anda ke sana? Kalimat itulah keahliannya.

**Di mana gagasan ini muncul dalam keseharian data engineer.** Wajar bertanya apa hubungan sebelas fungsi kecil dengan pekerjaan ini. Hampir setiap tugas yang akan Anda terima adalah gagasan yang sama, hanya lebih besar:
- **Tipe:** data tiba sebagai teks; Anda memberi setiap nilai tipe yang benar sebelum apa pun, atau total jadi salah tanpa error.
- **List dan dict:** sebuah file atau tabel adalah list berisi baris; setiap baris adalah dict dari kolom ke nilai.
- **Menghitung dengan dict:** "berapa per kota, per status, per hari" adalah pertanyaan paling umum dalam data; `GROUP BY` di SQL (Modul 0.3) adalah gagasan yang sama.
- **Set:** membuang duplikat, dan bertanya "apakah ini sudah pernah dimuat?".
- **if dan try/except:** memutuskan baris mana yang valid, dan menyisihkan yang rusak alih-alih crash atau membuangnya diam-diam.
- **Fungsi dengan tes:** setiap langkah pipeline adalah fungsi, dan tesnya adalah cara Anda tahu ia masih berjalan setelah perubahan besok.

Lab akan tumbuh dari sini: di Modul 1.2 gagasan yang sama menjadi pipeline sungguhan yang membaca file, mengonversi tipe, mengarantina baris rusak, dan aman dijalankan ulang. Jika sesuatu di modul ini masih terasa belum jelas, itu wajar setelah sekali baca: baca ulang pelajaran yang Jeda Praktiknya paling sulit, dan kerjakan lagi Coba sendiri-nya.

## @lab Lab: sebelas fungsi kecil pada pesanan KopiKu
Tulis sebelas fungsi pendek, masing-masing melatih satu gagasan dari pelajaran, pada data pesanan KopiKu.

**Apa itu lab.** File `basics.py` berisi sebelas fungsi yang isinya kosong: masing-masing hanya berisi `raise NotImplementedError`. Anda yang menulis isinya. File kedua, `test_lab.py`, berisi 31 **tes**: program kecil yang memanggil fungsi Anda dengan sebuah contoh dan memeriksa jawabannya, misalnya "`format_rupiah(1250000)` harus menghasilkan `"Rp 1.250.000"`". Sebuah tes ✓ jika fungsi Anda memberi jawaban yang diharapkan, dan ✗ jika memberi jawaban lain atau crash. Anda selesai ketika ke-31 tes ✓.

**Di mana mengerjakannya: pilih satu dari dua jalur.**

- **Jalur A, pratinjau browser** (tanpa memasang apa pun): kotak editor di bawah pada halaman ini berisi file-nya, **Jalankan tes** menjalankan ke-31 tes, dan daftar di bawah tombol menampilkan setiap kelompok tes (satu kelompok per fungsi) sebagai ✓ atau ✗. Lulus di pratinjau tidak dihitung: setelah Modul 0.2 Anda menulis lab ini lagi di komputer sendiri.
- **Jalur B, terminal Anda sendiri** (disarankan jika Anda sudah mengikuti Mulai di sini): beginilah Anda akan bekerja di sepanjang kursus, dan run-nya dihitung. Siapkan sekali, di terminal:

```bash
cd ~/projects/DECourse                     # folder kursus Anda
python3 -m venv venv                       # sekali: Python pribadi untuk kursus
source venv/bin/activate                   # setiap terminal baru
python -m pip install -r labs/mod-0-0/requirements.txt    # sekali: pytest
```

  Pakai folder kursus Anda sendiri di baris pertama. Jika namanya mengandung spasi, beri garis miring terbalik sebelum spasinya: `cd ~/Documents/Learn\ DE/DECourse`. Setelah `source`, prompt diawali `(venv)`; Modul 0.2 menjelaskan apa itu venv. Lalu buka folder kursus di VS Code (File, Open Folder) dan klik `labs/mod-0-0/basics.py` untuk mengeditnya. Jalankan tes satu fungsi, misalnya:

```bash
pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v
```

  Anda melihat satu baris per tes yang diakhiri `PASSED` atau `FAILED`; di bawah kegagalan, baris yang diawali `E` menyebutkan apa yang salah. Pada file yang belum disentuh isinya `E       NotImplementedError: TODO: implement format_rupiah`, yang hanya berarti Anda belum menulisnya. `-k TestFormatRupiah` memilih satu kelompok (27 tes lainnya "deselected"); tanpa `-k` Anda melihat ke-31 tes, dan baris terakhir menyebutkan, misalnya, `29 failed, 2 passed`.

Pelajaran 1 sampai 4 diakhiri latihan dengan cara sederhana, tanpa fungsi. Mulai Pelajaran 5, setiap **Jeda Praktik** menyebutkan fungsi lab mana yang ditulis, sebagian besar dengan mengubah kode yang sudah Anda tulis menjadi fungsi.

**Putarannya, untuk setiap fungsi.**
1. Baca deskripsi fungsi di file: teks di antara baris `"""` menyebutkan apa yang masuk dan apa yang harus keluar, dengan contoh.
2. Tulis percobaan Anda, menggantikan baris `raise NotImplementedError`.
3. Klik **Jalankan tes** dan cari kelompok fungsi itu. Di awal, kelompok lain juga ✗; itu wajar, abaikan.
4. Jika kelompok Anda ✗, klik dan baca pesannya. Baris seperti `AssertionError: assert 'Rp 1,250,000' == 'Rp 1.250.000'` berarti: fungsi Anda mengembalikan `'Rp 1,250,000'` (kiri), tes mengharapkan `'Rp 1.250.000'` (kanan). Perbedaannya, koma alih-alih titik, memberi tahu persis apa yang harus diubah.
5. Ubah satu hal, jalankan lagi. Memutar lima kali untuk satu fungsi itu normal: begitulah programmer bekerja, bukan tanda Anda tidak bisa.

**Sebelas fungsinya, urut sesuai pelajaran, dan mengapa data engineer membutuhkan masing-masing:**

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
1. Pilih jalur Anda (lihat "Di mana mengerjakannya" di atas): **Pratinjau browser** di bawah, atau `labs/mod-0-0/basics.py` di VS Code dengan tes di terminal Anda. Baca seluruh file dari atas ke bawah sekali, tanpa menulis apa pun: sebelas fungsi, masing-masing dengan deskripsinya.
2. Ikuti Jeda Praktik. Pelajaran 1 sampai 4: berlatih dengan cara sederhana, belum ada lab. Setelah Pelajaran 5: `format_rupiah`, `count_by_status`, `unique_customer_ids`, `average_total`, `total_revenue`, `batches`, dan `top_customers`. Setelah Pelajaran 6: `safe_int`, `add_to_batch`, dan `split_valid`. Setelah Pelajaran 7: `read_orders`. Jalankan tes setelah setiap fungsi dan lihat hanya kelompoknya.
3. Ragu nilai apa yang ada di dalam fungsi Anda? Tambahkan `print(type(x), x)` di atas baris yang Anda ragukan lalu jalankan lagi; cetakannya muncul di output. Hapus setelah selesai.
4. Sebelum setiap run, **tebak** kelompok mana yang akan ✓. Ketika hasilnya mengejutkan, cari tahu mengapa: kejutan itulah tempat belajar terjadi.
5. **Kerjakan yang sesungguhnya.** Di jalur terminal Anda sudah melakukannya: setelah ke-31 tes lulus, jalankan perintah bukti di bawah. Di jalur pratinjau, setelah Modul 0.2 tulis lab ini lagi di komputer Anda sendiri, di venv Anda sendiri, **tanpa menyalin** dari pratinjau. Dari folder kursus, dengan venv aktif:

```bash
pytest labs/mod-0-0/test_lab.py -v                    # semuanya
pytest labs/mod-0-0/test_lab.py -v -k TestSafeInt     # satu kelompok saat Anda bekerja
python3 scripts/prove.py mod-0-0                      # setelah ke-31 lulus: kode bukti Anda
```

   Buka `labs/mod-0-0/basics.py` di editor Anda (VS Code: File, Open Folder, lalu klik file-nya); itu file yang Anda edit, bukan perintah yang Anda ketik. Tempel kode buktinya ke kotak **Bukti** di halaman ini.

### @files
- labs/mod-0-0/basics.py :: File kerja Anda: implementasikan sebelas fungsi TODO :: starter
- labs/mod-0-0/debug_me.py :: Latihan debugging: tiga fungsi dengan satu bug masing-masing (pelajaran 8) :: config
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
