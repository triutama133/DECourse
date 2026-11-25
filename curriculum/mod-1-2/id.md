---
title: Python Produksi untuk Data Engineering
duration: 3 minggu
summary: Ubah skrip sekali pakai menjadi job yang bisa dipercaya di produksi: masukan yang divalidasi, streaming yang menjaga memori tetap datar, retry yang aman, log yang jelas, dan tes otomatis.
why: Bootcamp mengajarkan pandas pada file kecil yang bersih. Di produksi, kode yang sama bertemu file yang tidak muat di memori, simbol mata uang di kolom angka, dan panggilan jaringan yang gagal satu dari seratus kali, dan tidak ada yang mengawasi saat ia rusak.
---

## @outcomes
- Menyusun job data Python sebagai fungsi-fungsi kecil yang bisa diuji, dengan input dan output di tepi
- Memvalidasi setiap record masuk dengan Pydantic v2 dan mengirim record buruk ke karantina beserta alasannya
- Memproses file yang lebih besar dari memori dengan iterator dan generator, serta mengukur memori dengan tracemalloc
- Membuat job aman dijalankan dua kali: tulis atomik, keluaran deterministik, retry hanya untuk error sementara
- Menulis tes pytest dengan fixture dan parametrisasi, termasuk tes untuk pemakaian memori dan perilaku saat gagal

## @prereq
Modul 0.1, 0.2, dan 1.1 (atau dasar Python: fungsi, loop, dictionary, file, virtual environment, dan exit code). Virtual environment dengan `pip install -r labs/mod-1-2/requirements.txt`.

## @part Membangun job-nya

## @lesson Dari skrip ke job: struktur dan batas
Skrip pemula adalah satu file panjang yang membaca file, mengulang, lalu mencetak. Ia berfungsi sekali. Sebuah **job** harus berjalan tiap malam, dipahami orang lain, diuji tanpa sumber data sungguhan, dan gagal dengan cara yang disadari orang. Perbedaannya sebagian besar ada pada struktur.

Mulai dari satu aturan: **jaga logika tetap murni dan dorong input/output ke tepi.** *Fungsi murni* menerima nilai dan mengembalikan nilai tanpa menyentuh hal lain. Ia sangat mudah diuji: panggil, periksa hasilnya. Membaca file, memanggil API, dan menulis ke database adalah *efek samping*; simpan di lapisan luar yang tipis.

```python
def parse_total(raw: str) -> int | None:      # murni: mudah diuji
    ...

def run(input_path, output_path):              # tepi: membaca, menulis, mencatat log
    for row in read_orders(input_path):
        ...
```

(Label `: str` dan `-> int | None` pada `parse_total` adalah *type hint*, artinya ia menerima teks dan mengembalikan integer atau `None`. Anda akan mempelajarinya secara utuh di **Pelajaran 2**; Anda belum perlu menulisnya pada latihan pelajaran ini.)

Tata letak yang wajar untuk job kecil:

```text
kopiku_etl/
  pyproject.toml        # dependensi, pengaturan alat
  src/kopiku_etl/
    models.py           # bentuk data dan validasi
    pipeline.py         # langkah-langkahnya (murni sebisa mungkin)
    cli.py              # parsing argumen, exit code
  tests/
```

Untuk lab modul ini semuanya ada dalam satu file agar mudah dibaca, tetapi *pemisahannya* sudah ada: `OrderRow` (bentuk), `validate` (murni), `run` (I/O), `main` (command line).

**Antarmuka command-line** adalah cara scheduler dan manusia menjalankan job Anda. `argparse` (pustaka standar) memberi argumen bernama, nilai bawaan, `--help`, dan error penggunaan secara gratis. Kembalikan **exit code** dari `main()` dan panggil `sys.exit(main())`, seperti di Modul 1.1: `0` untuk sukses, bukan nol untuk gagal, dan angka berbeda untuk kegagalan berbeda bila pemanggil perlu membedakannya.

**Konfigurasi** (path, ambang batas, hostname) datang dari argumen atau environment variable, tidak pernah di-hardcode; **rahasia** hanya dari environment (Modul 0.1).

**Tiga potong sintaks Python baru mulai dari sini: class, type hint, dan decorator.** Anda baru saja melihat sekilas type hint di atas, dan ketiganya muncul di sisa modul ini, jadi mereka punya pelajaran singkat sendiri tepat setelah ini (**Pelajaran 2**). Anda belum perlu menulis salah satunya pada latihan pelajaran ini.

> 🛠 **Coba sendiri (12 menit, di `etl_try.py`).** Tulis fungsi **murni** `parse_total(raw)` yang mengembalikan int, atau `None` jika teksnya bukan bilangan bulat yang tidak negatif (ia juga harus mengerti gaya `Rp 150.000`). Fungsi itu harus lulus:
> `assert parse_total("150000") == 150000`
> `assert parse_total("Rp 150.000") == 150000`
> `assert parse_total("-5000") is None`
> `assert parse_total("abc") is None`
> `assert parse_total("") is None`
>
> Lalu tulis `run(path)`, bagian tepinya: ia membuka `path` (berikan `"data/orders.csv"` saat memanggilnya), memanggil `parse_total` untuk setiap `total_idr`, dan mengembalikan jumlah baris yang valid dan tidak valid. Tidak ada bagian lain yang boleh menyentuh file.
>
> **Seharusnya Anda melihat:** tidak ada assertion error, dan `run("data/orders.csv")` mengembalikan `(3617, 17)`. Perhatikan bahwa Anda menguji `parse_total` tanpa file apa pun. Coba lakukan hal yang sama pada versi yang membuka file di dalam fungsinya, dan rasakan bedanya.


:::drill python Fungsi murni di jantung sebuah job
Tulis `parse_total(raw)`: `raw` adalah teks dari CSV. Bisa berupa `"150000"` atau `"Rp 1.250.000"` (titik adalah pemisah ribuan). Kembalikan jumlahnya sebagai `int`. Jika teks bukan sebuah jumlah (misalnya `"abc"` atau string kosong), kembalikan `None` alih-alih melempar error.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("parse_total") ## Definisikan parse_total(raw).
parse_total("150000") == 150000 ## Angka biasa menjadi int.
parse_total("Rp 1.250.000") == 1250000 ## Awalan dan titik dihapus.
parse_total("abc") is None ## Bukan jumlah: None, tanpa crash.
parse_total("") is None ## Teks kosong juga bukan jumlah.
@hint
Hapus `Rp`, spasi, dan titik; jika sisanya `.isdigit()`, kembalikan `int(...)`, jika tidak `None`.
@solution
def parse_total(raw):
    cleaned = raw.replace("Rp", "").replace(" ", "").replace(".", "")
    if cleaned.isdigit():
        return int(cleaned)
    return None
:::

:::ask Mengapa logika disimpan di fungsi murni dan akses file serta jaringan didorong ke tepi job?
@options
fungsi murni berjalan lebih cepat dari kode apa pun
* fungsi murni bisa diuji dengan memanggilnya dengan nilai
tepi adalah satu-satunya tempat Python mengizinkan I/O
@why
Fungsi murni menerima nilai dan mengembalikan nilai tanpa menyentuh hal lain, jadi tes hanyalah panggilan dan pemeriksaan. Membaca file, memanggil API, dan menulis database tetap di lapisan luar yang tipis.
:::

## @lesson Class, type hint, dan decorator: tiga hal yang dibaca di Pelajaran 4
Di Pelajaran 4 Anda akan bertemu kode seperti `class OrderRow(BaseModel):`, `order_id: int = Field(gt=0)`, dan `@field_validator("status")`. Semuanya tampak aneh sampai Anda tahu tiga ide kecil: **class**, **type hint**, dan **decorator**. Masing-masing hanya beberapa baris. Anda tidak perlu menjadi ahli: Anda perlu bisa membacanya, dan menulis bentuk sederhananya sendiri.

### Class: cetak biru untuk sesuatu yang punya data dan tindakan

**Mengapa:** dictionary menyimpan data satu pesanan, dan fungsi melakukan sesuatu padanya, tetapi keduanya terpisah dan tidak ada yang menyatukannya. **Class** menyatukan data dan tindakan menjadi satu benda.

```python
class Order:
    def __init__(self, order_id, total):
        self.order_id = order_id
        self.total = total

    def is_big(self):
        return self.total >= 100000

order = Order(1001, 150000)
print(order.total)       # 150000
print(order.is_big())    # True
```

Istilahnya, satu per satu:

- **Class** adalah cetak biru. `Order` menjelaskan apa yang dimiliki dan bisa dilakukan setiap pesanan.
- **Object** (disebut juga **instance**) adalah satu benda yang dibuat dari cetak biru itu. `Order(1001, 150000)` membuat satu object.
- `__init__` berjalan sekali, saat object dibuat. Ia menyimpan data awal.
- `self` berarti "object ini". `self.total = total` menulis nilainya ke object, sehingga tiap object menyimpan datanya sendiri.
- **Attribute** adalah sepotong data pada object (`order.total`). **Method** adalah fungsi di dalam class (`order.is_big()`).

Lihat dua object menyimpan data masing-masing:

:::trace Dua pesanan, dua set data
@code
class Order:
    def __init__(self, order_id, total):
        self.order_id = order_id
        self.total = total

    def is_big(self):
        return self.total >= 100000

a = Order(1, 150000)
b = Order(2, 20000)
print(a.is_big(), b.is_big())
@notes
1 | `class Order:` hanya menjelaskan cetak birunya. Belum ada yang dibuat.
9 | `Order(1, 150000)` membuat sebuah object. Python menjalankan `__init__` dengan `self` menunjuk object baru, dan menyimpan 1 dan 150000 di dalamnya.
10 | Object kedua yang terpisah dengan datanya sendiri: 2 dan 20000.
11 | `a.is_big()` menjalankan method pada object `a`, jadi `self.total` bernilai 150000: True. Untuk `b` nilainya 20000: False.
:::

:::ask Pada `self.total = total`, apa yang diwakili `self`?
@options
* satu object yang sedang dibuat atau dipakai saat ini
class `Order` itu sendiri, yang dipakai bersama semua pesanan
variabel khusus yang diisi Python dengan nilai total
@why
`self` adalah object yang sedang dikerjakan method. Karena tiap object punya `self` sendiri, `a.total` dan `b.total` bernilai berbeda walau keduanya berasal dari class yang sama.
:::

:::drill python Keranjang yang mengingat
Tulis class `Cart` dengan method `add(price)` yang mengingat harga, dan method `total()` yang mengembalikan jumlah semua yang ditambahkan (0 untuk keranjang baru). Dua keranjang **tidak boleh** berbagi isinya.
@starter
# tulis class Anda di bawah baris ini

@check
defines("Cart") ## Definisikan class Cart.
(lambda c: (c.add(10), c.add(5), c.total())[-1])(Cart()) == 15 ## 10 + 5.
Cart().total() == 0 ## Keranjang baru kosong.
(lambda a, b: (a.add(7), b.total())[-1])(Cart(), Cart()) == 0 ## Keranjang lain tidak melihat item itu.
(lambda c: (c.add(1), c.add(1), c.total())[-1])(Cart()) == 2 ## Harga sama dua kali dihitung dua kali.
@hint
Di `__init__` tulis `self.items = []`. `add` melakukan `self.items.append(price)`; `total` mengembalikan `sum(self.items)`.
@solution
class Cart:
    def __init__(self):
        self.items = []

    def add(self, price):
        self.items.append(price)

    def total(self):
        return sum(self.items)
:::

### Type hint: label yang menyatakan nilai itu seharusnya apa

**Mengapa:** saat membaca `def add_tax(price, rate)`, Anda harus menebak apakah `price` angka atau teks. **Type hint** menyatakannya: `price: int`.

```python
def add_tax(price: int, rate: float = 0.11) -> int:
    return int(price * (1 + rate))
```

`price: int` berarti "price seharusnya bilangan bulat"; `-> int` berarti "fungsi ini mengembalikan bilangan bulat". Hint lain yang akan Anda lihat: `list[str]` (list berisi teks), `dict[str, int]` (kunci teks, nilai bilangan bulat), `int | None` (bilangan bulat atau tidak ada) dan `Literal["paid", "shipped"]` (hanya salah satu nilai persis ini).

Fakta terpenting: **Python sendiri tidak memeriksa hint.** `add_tax("abc")` tetap berjalan dan gagal belakangan dengan cara yang jelek. Hint dibaca editor dan library seperti Pydantic, yang *memang* memeriksa data terhadapnya. Itulah seluruh ide Pelajaran 4.

:::ask Apa yang terjadi bila Anda menjalankan `def f(x: int): return x` lalu memanggil `f("hello")`?
@options
Python berhenti dengan TypeError sebelum fungsi berjalan
ia mengubah "hello" menjadi angka lebih dulu
* ia berjalan dan mengembalikan "hello": Python tidak menegakkan hint
@why
Hint adalah label. Python mengabaikannya saat menjalankan kode Anda. Alat seperti Pydantic (atau editor) membacanya dan melakukan pemeriksaannya untuk Anda.
:::

:::drill python Tulis hint-nya
Tulis `add_tax(price, rate)` dengan hint `price: int`, `rate: float`, dan `-> int`. Ia mengembalikan harga ditambah pajak, sebagai bilangan bulat: `add_tax(100000, 0.11)` adalah `111000`. `rate` punya default `0.11`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("add_tax") ## Definisikan add_tax.
add_tax(100000, 0.11) == 111000 ## 100000 ditambah 11%.
add_tax(100000) == 111000 ## Rate default adalah 0.11.
add_tax(200, 0.5) == 300 ## Rate lain.
add_tax.__annotations__ == {"price": int, "rate": float, "return": int} ## Ketiga hint tertulis.
@hint
Beri anotasi `: type` pada tiap parameter, taruh nilai bawaan `= 0.11` setelah type hint, tambahkan `-> int` sebelum titik dua, dan pakai `round(...)` agar hasil pecahan menjadi bilangan bulat yang tepat.
@solution
def add_tax(price: int, rate: float = 0.11) -> int:
    return round(price * (1 + rate))
:::

### Dataclass: class yang menuliskan bagian membosankan untuk Anda

Banyak class hanya menyimpan data. Library standar bisa menulis `__init__` untuk Anda dari type hint:

```python
from dataclasses import dataclass

@dataclass
class Order:
    order_id: int
    total: int

o = Order(1001, 150000)
print(o)                     # Order(order_id=1001, total=150000)
print(o == Order(1001, 150000))   # True
```

Baris `@dataclass` adalah sebuah decorator (bagian berikutnya). Ia memberi class sebuah `__init__`, tampilan cetak yang terbaca, dan `==` secara gratis. `BaseModel` milik Pydantic melangkah lebih jauh: ia juga **memeriksa** data terhadap hint.

:::drill python Sebuah dataclass
Tulis dataclass `Product` dengan dua field: `name` (teks) dan `price` (bilangan bulat). `Product("tea", 5000) == Product("tea", 5000)` harus `True`.
@starter
from dataclasses import dataclass
# tulis class Anda di bawah baris ini

@check
defines("Product") ## Definisikan class Product.
Product("tea", 5000).price == 5000 ## Ia menyimpan harganya.
Product("tea", 5000) == Product("tea", 5000) ## Field sama: sama.
(Product("tea", 5000) == Product("tea", 6000)) == False ## Harga berbeda: tidak sama.
uses("dataclass") ## Anda memakai @dataclass.
@hint
Taruh `@dataclass` di baris di atas `class Product:` dan tulis `name: str` dan `price: int` di dalamnya.
@solution
from dataclasses import dataclass

@dataclass
class Product:
    name: str
    price: int
:::

### Decorator: label yang membungkus sebuah fungsi

**Mengapa:** kadang Anda ingin menambahkan perilaku ekstra yang sama ke banyak fungsi: memeriksa masukan, menghitung pemanggilan, mengulang saat gagal. **Decorator** melakukannya tanpa mengubah tiap fungsi. Baris `@nama` di atas sebuah `def` berarti: "serahkan fungsi ini ke `nama`, dan pakai apa yang dikembalikannya sebagai gantinya".

```python
def shout(fn):
    def wrapper(*args):
        return fn(*args).upper()
    return wrapper

@shout
def greet(name):
    return "hello " + name

print(greet("sari"))   # HELLO SARI
```

Lihat apa sebenarnya yang dilakukan `@shout`:

:::trace Decorator membungkus sebuah fungsi
@code
def shout(fn):
    def wrapper(*args):
        return fn(*args).upper()
    return wrapper

@shout
def greet(name):
    return "hello " + name

print(greet("sari"))
@notes
1 | `shout` adalah fungsi yang menerima fungsi lain, `fn`.
2 | Di dalamnya ia membuat fungsi baru, `wrapper`. Ia akan memanggil `fn` lalu mengubah hasilnya menjadi huruf besar.
4 | `shout` mengembalikan wrapper, bukan yang asli.
6 | Baris `@shout` berarti `greet = shout(greet)`: nama `greet` kini menunjuk **wrapper**.
10 | Memanggil `greet("sari")` menjalankan wrapper, yang menjalankan `greet` asli, lalu mengubahnya menjadi huruf besar: HELLO SARI.
:::

Di pelajaran-pelajaran berikutnya Anda kebanyakan akan **memakai** decorator buatan orang lain: `@field_validator(...)` dan `@classmethod` di Pydantic, `@pytest.fixture` dan `@pytest.mark.parametrize` di tes, `@task` dan `@dag` di Airflow. Menulis sendiri adalah keterampilan yang akan Anda pakai sesekali.

:::ask Pada kode `@field_validator("status")` di atas sebuah method, apa yang dilakukan baris `@` itu?
@options
ia membuat method berjalan dua kali, sekali untuk tiap status
* ia mendaftarkan method sebagai pemeriksa field itu
ia mengubah method menjadi komentar sehingga Python mengabaikannya
@why
Decorator menerima fungsi di bawahnya dan mengembalikan sesuatu untuk dipakai sebagai gantinya. Decorator Pydantic mengingat method Anda dan memanggilnya saat memvalidasi field `status`.
:::

Satu detail yang perlu diperhatikan pada `wrapper(*args)` di atas: menulis `*args` pada definisi fungsi mengumpulkan sejumlah argumen posisional berapa pun (nol, satu, dua, atau lebih) ke dalam sebuah tuple bernama `args`. Menulis `fn(*args)` membongkar kembali tuple tersebut menjadi argumen terpisah saat memanggil fungsi aslinya, sehingga wrapper bisa bekerja pada fungsi dengan tanda tangan apa pun.

:::drill python Tulis sebuah decorator
Tulis decorator `twice(fn)`: fungsi baru memanggil `fn` dua kali dengan argumen yang sama dan mengembalikan **list berisi kedua hasilnya**. Jadi `twice(lambda x: x + 1)(5)` adalah `[6, 6]`.
@starter
# tulis decorator Anda di bawah baris ini

@check
defines("twice") ## Definisikan twice(fn).
twice(lambda x: x + 1)(5) == [6, 6] ## Dipanggil dua kali, kedua hasil.
twice(lambda a, b: a * b)(3, 4) == [12, 12] ## Beberapa argumen diteruskan.
(lambda c: (twice(lambda: c.append(1))(), len(c))[1])([]) == 2 ## Fungsinya benar-benar berjalan dua kali.
@hint
Ikuti pola `shout` di atas: definisikan fungsi dalam `wrapper(*args)` yang memanggil `fn(*args)` dua kali lalu mengumpulkan kedua hasilnya ke dalam list, kemudian kembalikan fungsi wrapper-nya sendiri (tanpa memanggilnya).
@solution
def twice(fn):
    def wrapper(*args):
        return [fn(*args), fn(*args)]
    return wrapper
:::

### Sekarang baca kode dari Pelajaran 4

Anda sudah bisa membaca setiap baris contoh ini:

```python
class OrderRow(BaseModel):                 # class yang memperluas BaseModel (ia mewarisi kemampuannya)
    order_id: int = Field(gt=0)            # attribute dengan type hint, dan aturan: lebih besar dari 0
    status: Literal["paid", "shipped"]     # hint: hanya dua nilai ini yang diizinkan
```

`class OrderRow(BaseModel)` berarti "OrderRow adalah class baru yang **mewarisi** semua yang bisa dilakukan BaseModel, dan menambahkan field-nya sendiri". Satu kalimat itu sudah semua pewarisan yang Anda perlukan di kursus ini.

> 🛠 **Coba sendiri (10 menit, Python).** Di komputer Anda sendiri: buat `shapes.py` berisi dataclass `Order` (field `order_id: int` dan `total: int`), fungsi `shout(fn)` seperti di atas, dan dua baris di bagian bawah yang mencetak sebuah order dan memanggil fungsi yang di-decorate. Jalankan `python3 shapes.py`.
>
> **Yang harus Anda lihat:** order tercetak sebagai `Order(order_id=1001, total=150000)` dan hasil fungsi ber-decorator dalam huruf besar. Jika muncul `NameError: name 'dataclass' is not defined`, Anda lupa `from dataclasses import dataclass`.

## @lesson Fungsi adalah nilai: lambda, kunci pengurutan, dan rekursi
Fungsi di Python adalah nilai seperti angka atau teks. Anda bisa menyimpannya di variabel, memasukkannya ke list, dan menyerahkannya ke fungsi lain. Satu fakta itu menjelaskan `sorted(..., key=...)`, `lambda`, decorator (pelajaran sebelumnya), dan banyak kode data engineering. Pelajaran ini juga menunjukkan **rekursi**: fungsi yang memanggil dirinya sendiri, cara menelusuri data berkedalaman tak tentu, seperti JSON bersarang atau pohon folder.

### Menyerahkan fungsi ke fungsi

```python
def total_of(order):
    return order["total"]

orders = [{"id": 1, "total": 50}, {"id": 2, "total": 90}]
print(sorted(orders, key=total_of))   # total terkecil lebih dulu
```

`key=total_of` menyerahkan fungsinya itu sendiri (tanpa kurung: Anda tidak memanggilnya). `sorted` memanggilnya sekali untuk tiap pesanan guna mendapat nilai pengurutan.

### lambda: fungsi kecil tanpa nama

Untuk fungsi satu baris yang dipakai sekali, `lambda` menghemat `def`:

```python
sorted(orders, key=lambda order: order["total"], reverse=True)   # total terbesar dulu
max(orders, key=lambda order: order["total"])["id"]              # id pesanan terbesar
```

`lambda order: order["total"]` berarti "diberi `order`, kembalikan `order["total"]`". Sebuah lambda hanya bisa berisi satu ekspresi. Bila perlu lebih, tulis `def` biasa.

:::ask Apa yang dilakukan `sorted(words, key=len)`?
@options
mengurutkan kata menurut abjad
menghitung ada berapa kata lalu mengembalikan angka itu
* mengurutkan kata dari yang terpendek ke terpanjang
@why
`key=len` menyerahkan fungsi `len` ke `sorted`, yang memanggilnya pada tiap kata untuk mendapat angka pengurutan. Kata diurutkan menurut angka itu: panjangnya.
:::

:::drill python Urutkan dengan key
Tulis `by_total(orders)`: `orders` adalah list dictionary berisi `id` dan `total`. Kembalikan list **id**, diurutkan menurut `total` dari terbesar ke terkecil. (Pakai `sorted` dengan `key=`.)
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("by_total") ## Definisikan by_total(orders).
by_total([{"id": 1, "total": 50}, {"id": 2, "total": 90}]) == [2, 1] ## Terbesar dulu.
by_total([]) == [] ## Tanpa pesanan.
by_total([{"id": 7, "total": 5}]) == [7] ## Satu pesanan.
calls("sorted") ## Anda memakai sorted(...).
@hint
`sorted(orders, key=lambda o: o["total"], reverse=True)`, lalu ambil id-nya.
@solution
def by_total(orders):
    ordered = sorted(orders, key=lambda o: o["total"], reverse=True)
    return [o["id"] for o in ordered]
:::

:::drill python Sebuah list fungsi
Tulis `apply_all(funcs, x)`: `funcs` adalah list fungsi. Kembalikan list berisi hasil pemanggilan tiap fungsi pada `x`, berurutan. `apply_all([abs, str], -3)` adalah `[3, "-3"]`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("apply_all") ## Definisikan apply_all(funcs, x).
apply_all([abs, str], -3) == [3, "-3"] ## Dua fungsi.
apply_all([], 5) == [] ## Tanpa fungsi.
apply_all([lambda v: v + 1, lambda v: v * 2], 10) == [11, 20] ## Lambda juga bisa.
@hint
Fungsi adalah nilai biasa, sehingga Anda bisa meloop `funcs`, memanggil setiap fungsi dengan `x`, lalu mengumpulkan hasil kembaliannya ke dalam list baru.
@solution
def apply_all(funcs, x):
    return [fn(x) for fn in funcs]
:::

### Rekursi: fungsi yang memanggil dirinya sendiri

Sebagian data tidak punya kedalaman tetap: dokumen JSON dengan objek di dalam objek, folder dengan folder di dalam folder. Loop tidak tahu berapa tingkat yang harus ditempuh. Fungsi **rekursif** menyelesaikan satu potongan kecil dan memanggil dirinya untuk sisa yang lebih kecil.

(`isinstance(x, list)` bertanya "apakah `x` sebuah list?". Bagian `sum(... for item in x)` mirip list comprehension tanpa kurung siku.) Setiap fungsi rekursif butuh dua bagian:

1. **base case**: kapan berhenti, dengan jawaban sederhana (sebuah angka adalah jumlahnya sendiri);
2. **recursive case**: pecah masalah menjadi potongan lebih kecil, panggil diri sendiri pada tiap potongan, dan gabungkan jawabannya.

```python
def total(x):
    if isinstance(x, list):                  # recursive case: list berisi hal-hal yang lebih kecil
        return sum(total(item) for item in x)
    return x                                  # base case: angka biasa
```

Lihat ia turun lalu naik kembali:

:::trace Rekursi pada list bersarang
@code
def total(x):
    if isinstance(x, list):
        return sum(total(item) for item in x)
    return x

print(total([1, [2, 3]]))
@notes
2 | List bukan angka biasa, jadi kita ambil recursive case.
3 | Untuk tiap item kita panggil `total` lagi: pertama 1 (sebuah angka: base case mengembalikan 1), lalu `[2, 3]` (list lagi: putaran lain yang menjumlahkan 2 dan 3 menjadi 5).
4 | Base case: angka biasa adalah totalnya sendiri. Tanpa ini fungsi akan memanggil dirinya selamanya.
6 | Jawabannya: 1 + 5 = 6.
:::

:::ask Sebuah fungsi rekursif tidak punya base case. Apa yang terjadi saat dipanggil?
@options
* ia terus memanggil dirinya sampai Python menghentikannya dengan RecursionError
ia mengembalikan None karena tidak ada yang dikerjakan
ia berjalan sekali lalu berhenti sendiri
@why
Setiap panggilan membuat panggilan lain, sehingga panggilan menumpuk sampai Python mencapai batasnya (sekitar 1.000 tingkat) dan melempar `RecursionError`. Base case-lah yang mengakhiri rantai itu.
:::

:::drill python Temukan sebuah key di mana saja
Tulis `find_values(data, key)`: `data` adalah struktur bersarang berisi dictionary dan list (seperti JSON yang sudah di-parse). Kembalikan list nilai dari **setiap** entri dictionary yang kuncinya `key`, di mana pun letaknya, sesuai urutan ditemukan.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("find_values") ## Definisikan find_values(data, key).
find_values({"a": 1, "b": {"a": 2}}, "a") == [1, 2] ## Key muncul di dua tingkat.
find_values([{"id": 1}, {"id": 2, "x": [{"id": 3}]}], "id") == [1, 2, 3] ## Di dalam list di dalam dictionary.
find_values({"a": 1}, "zzz") == [] ## Key tidak pernah muncul.
find_values(5, "a") == [] ## Nilai biasa tidak punya apa-apa untuk dicari.
@hint
Jika `data` dictionary: untuk tiap `k, v` tambahkan `v` bila `k == key`, dan rekursi ke `v`. Jika list: rekursi ke tiap item. Selain itu kembalikan list kosong.
@solution
def find_values(data, key):
    found = []
    if isinstance(data, dict):
        for k, v in data.items():
            if k == key:
                found.append(v)
            found.extend(find_values(v, key))
    elif isinstance(data, list):
        for item in data:
            found.extend(find_values(item, key))
    return found
:::

Rekursi adalah alat yang tepat untuk pohon. Untuk list datar biasa, loop `for` lebih sederhana dan tidak bisa menabrak batas kedalaman, jadi pakai loop di sana.

> 🛠 **Coba sendiri (10 menit, Python).** Di komputer Anda sendiri, dalam file `nested.py`, tempel sebuah dictionary bersarang kecil (pesanan palsu dengan `customer` dan `items`, tiap item berupa dictionary), lalu tulis `find_values` dan cetak setiap `sku` di dalamnya. Jalankan `python3 nested.py`.
>
> **Yang harus Anda lihat:** list semua nilai `sku`, di mana pun letaknya. Jika muncul `RecursionError`, sebuah panggilan rekursif tidak mendapat data yang lebih kecil: periksa base case Anda.

## @lesson Validasi di batas dengan Pydantic
Pipeline yang paling andal tidak mempercayai masukannya. Data melintasi sebuah **batas** (file, API, antrean) dan Anda mengubahnya dari "apa pun yang dihasilkan pengirim" menjadi "nilai yang bisa diandalkan kode saya". Lakukan sekali, di pintu; semua yang setelah pintu bisa mengasumsikan data bersih.

**Pydantic v2** adalah pustaka standar untuk ini. Anda menggambarkan bentuknya sebagai kelas; Pydantic mengurai dan memeriksa data terhadapnya, dalam kode Rust terkompilasi, sehingga cepat.

```python
from typing import Literal
from pydantic import BaseModel, Field, field_validator

class OrderRow(BaseModel):
    order_id: int = Field(gt=0)
    status: Literal["paid", "shipped", "delivered", "cancelled", "refunded"]
    total_idr: int = Field(gt=0)

    @field_validator("status", mode="before")
    @classmethod
    def normalise_status(cls, v):
        return v.strip().lower() if isinstance(v, str) else v
```

Gagasan yang perlu dipahami:

- **Koersi.** Secara bawaan Pydantic bersifat *lax*: teks `"150000"` menjadi integer `150000`, sempurna untuk CSV di mana semuanya teks. Dalam mode **strict** (`ConfigDict(strict=True)`) ia menolak mengonversi; pakai untuk sumber bertipe seperti API JSON di mana string di field angka berarti ada yang salah.
- **Constraint** (`gt=0`, `min_length=5`, `Literal[...]`) menyatakan aturan bisnis secara deklaratif.
- **Validator** (`field_validator`) menangani masukan berantakan tetapi bisa dipulihkan. `@classmethod` menandai method yang menerima kelas (`cls`) alih-alih instance karena Pydantic menjalankan `mode="before"` *sebelum* membangun objek `OrderRow` — di situlah Anda memangkas `"Rp 1.250.000"` menjadi `"1250000"`, atau mencoba `datetime.strptime(v.strip(), "%d/%m/%Y %H:%M")` untuk format seperti `"31/01/2026 14:03"` sebelum membiarkan Pydantic mengurai stempel waktu ISO.
- **Error adalah data.** `OrderRow.model_validate(row)` mengembalikan objek atau melempar `ValidationError`; `.errors()`-nya mendaftar setiap masalah beserta lokasi field dan jenis error:

```python
# status="teleported", total_idr="-5"
# [{'loc': ('status',), 'type': 'literal_error', ...},
#  {'loc': ('total_idr',), 'type': 'greater_than', 'msg': 'Input should be greater than 0'}]
```

Pakai itu untuk membuat **string alasan** bagi tiap baris yang ditolak. `model_dump(mode="json")` mengubah objek tervalidasi menjadi nilai biasa yang aman untuk JSON (`datetime` menjadi teks ISO).

Pola yang mengikutinya adalah antrean **karantina** (disebut juga dead-letter). Jangan memilih antara "crash seluruh job karena satu baris buruk" dan "membuangnya diam-diam". Tulis baris baik ke keluaran, baris buruk ke file karantina beserta baris aslinya, posisinya, dan alasannya, dan hitung keduanya. Manusia atau job berikutnya bisa memeriksa dan memperbaiki karantina; tidak ada yang hilang, dan keluaran utama tetap bisa dipercaya. Tentukan juga **ambang batas**: jika lebih dari, katakanlah, 5% baris ditolak, job harus gagal, karena itu berarti ada yang berubah di hulu, bukan sekadar beberapa baris berantakan.

> **Tip:** Validasi bukan hanya untuk file. Model yang sama bisa memvalidasi respons API, pesan dari antrean, dan konfigurasi. Satu definisi "pesanan yang valid" yang dipakai ulang di mana-mana adalah sebuah data contract kecil (Modul 2.5).

:::drill python Mengapa baris ini ditolak?
Tulis `reasons(row)`: `row` adalah dictionary dari CSV (semua teks). Kembalikan daftar alasan penolakan, dengan urutan ini: `"bad status"` jika `status` bukan salah satu dari `paid`, `cancelled`, `shipped`; `"bad total"` jika `total_idr` bukan bilangan bulat nol atau lebih. Baris yang baik menghasilkan `[]`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("reasons") ## Definisikan reasons(row).
reasons({"status": "paid", "total_idr": "150000"}) == [] ## Baris yang baik tanpa alasan.
reasons({"status": "teleported", "total_idr": "150000"}) == ["bad status"] ## Status tak dikenal.
reasons({"status": "paid", "total_idr": "-5"}) == ["bad total"] ## Total negatif.
reasons({"status": "x", "total_idr": "abc"}) == ["bad status", "bad total"] ## Kedua masalah, dengan urutan yang ditentukan.
@hint
Periksa status dengan `in`. Untuk total: `row["total_idr"].isdigit()` bernilai False untuk "-5" dan "abc".
@solution
def reasons(row):
    out = []
    if row["status"] not in ("paid", "cancelled", "shipped"):
        out.append("bad status")
    if not row["total_idr"].isdigit():
        out.append("bad total")
    return out
:::

:::ask Field JSON API `total` seharusnya angka tetapi datang sebagai teks "150000". Kapan validasi strict lebih baik?
@options
untuk file CSV, tempat semua nilai memang berupa teks
tidak pernah: mode lax selalu pilihan yang aman dipakai
* untuk sumber bertipe seperti JSON API, bukan CSV
@why
CSV hanya berisi teks, jadi koersi lax ('150000' menjadi 150000) memang yang Anda mau. JSON API sudah punya angka, jadi string di sana berarti ada yang rusak di hulu, dan mode strict menolaknya.
:::

### Mencocokkan pola teks berantakan: regular expression (regex)

**Mengapa:** kolom teks nyata jarang rapi. Gaji di Indonesia datang sebagai `"Rp 8.000.000 - 12.000.000/Bulan"`, catatan pesanan menyelipkan kode seperti `"Paid ORD-2026-0042 today"`, dan nomor telepon mencampur spasi, strip, serta `+62`. Merantai sepuluh `.replace()` langsung patah saat muncul karakter baru. **Regular expression** (**regex**) menggambarkan *bentuk* teks yang Anda cari alih-alih mendaftar tiap karakter persisnya.

Segelintir balok dasar sudah cukup untuk membaca dan menulis sebagian besar regex data engineering (selalu tulis pola Python sebagai raw string `r"..."` agar garis miring terbalik tetap utuh):

| Simbol | Arti | Contoh |
|---|---|---|
| `\d` | satu angka `0–9` | `r"\d+"` cocok dengan `"150000"` |
| `\w` | satu huruf, angka, atau `_` | `r"\w+"` cocok dengan `"kopi_susu"` |
| `\s` | spasi, tab, atau baris baru | `r"\s+"` merapikan spasi ganda |
| `+`, `*`, `?` | satu atau lebih, nol atau lebih, opsional (0/1) | `r"Rp\s*"` cocok dengan `"Rp"` dan `"Rp "` |
| `[...]` / `[^...]` | karakter dalam himpunan / **bukan** dalam himpunan | `r"[^0-9]"` cocok dengan tiap non-angka |
| `^` dan `$` | awal dan akhir teks | `r"^ORD-\d+$"` memvalidasi kode penuh |
| `(...)` | grup tangkap: ambil bagian dalamnya saja | `r"ORD-(\d+)"` menangkap `"42"` |

Tiga fungsi pada modul bawaan `re` mengerjakan hampir semuanya:
- `re.search(pattern, text)` mencari kecocokan **pertama** (mengembalikan objek match atau `None`).
- `re.findall(pattern, text)` mengembalikan **list** berisi semua kecocokan.
- `re.sub(pattern, replacement, text)` mengganti setiap kecocokan (di SQL warehouse padanannya adalah `REGEXP_REPLACE`).

Lihat `re.sub` dan `re.findall` membersihkan teks berantakan langkah demi langkah:

:::trace Bersihkan dan ekstrak dengan regex
@code
import re

raw_price = "Rp 8.500.000/bln"
digits_only = re.sub(r"[^0-9]", "", raw_price)
amount = int(digits_only)

note = "Batch: ORD-104 and ORD-209"
codes = re.findall(r"ORD-\d+", note)
print(amount, codes)
@notes
4 | `[^0-9]` cocok dengan apa pun yang **bukan** angka (`Rp`, spasi, titik, `/bln`), lalu `re.sub` menghapus semuanya.
5 | Sekarang `"8500000"` berubah bersih menjadi `int`.
8 | `re.findall` memindai seluruh teks dan mengumpulkan setiap `ORD-` yang diikuti satu atau lebih angka.
:::

:::ask Apa yang dikembalikan `re.findall(r"\d", "ORD-42")`?
@options
* `['4', '2']`: `\d` mencocokkan satu angka sekali waktu
`['42']`: `\d` selalu menggabungkan angka bersebelahan
`['ORD-42']`: `\d` mencocokkan seluruh kode pesanan
@why
Tanpa `+`, `\d` hanya mencocokkan **satu** angka, jadi `"42"` menjadi dua kecocokan `['4', '2']`. Tambahkan `+` (`r"\d+"`) untuk mencocokkan satu atau lebih angka berurutan sebagai `['42']`.
:::

:::drill python Ekstrak kode pesanan dengan regex
Tulis `extract_codes(text)`: kembalikan list berisi setiap kode pesanan yang cocok dengan `ORD-` diikuti satu atau lebih angka (misalnya `"ORD-104"`). Pakai modul `re` bawaan Python.
@starter
import re

# tulis fungsi Anda di bawah baris ini

@check
defines("extract_codes") ## Definisikan extract_codes(text).
calls("findall") ## Pakai re.findall(pattern, text).
extract_codes("Paid ORD-104 and ORD-209 today") == ["ORD-104", "ORD-209"] ## Kedua kode harus diekstrak berurutan.
extract_codes("No orders here") == [] ## Tanpa kecocokan mengembalikan list kosong.
extract_codes("ORD-7! and ORD-9999.") == ["ORD-7", "ORD-9999"] ## Berlaku untuk panjang angka berapa pun dan tanda baca di sekitarnya.
@hint
Pakai `re.findall` dengan pola raw string yang diawali `ORD-` diikuti simbol angka (`\d`) dan penanda satu-atau-lebih (`+`).
@solution
import re

def extract_codes(text):
    return re.findall(r"ORD-\d+", text)
:::

> 💡 **Jeda Praktik 1 (Validasi Data dengan Pydantic OrderRow):**
> Mulai bangun modul ETL Anda dengan membuat model validasi batas:
> 1. Buka file `labs/mod-1-2/etl.py` di Text Editor Anda (ingat: jangan dieksekusi langsung di bash!).
> 2. Lengkapi kelas `OrderRow` dan fungsi `validate(row: dict)`. Tambahkan validator untuk membersihkan teks Rupiah (`"Rp 1.250.000"` -> `1250000`), normalisasi status lowercase/strip, serta dukung format tanggal ISO dan `DD/MM/YYYY`.
> 3. Uji model Anda di terminal:
> `pytest labs/mod-1-2/test_lab.py -k TestOrderRow -v`
> Ketika semua tes `TestOrderRow` berstatus PASSED, fondasi validasi Anda sudah kokoh! Lanjut ke Pelajaran 5 tentang streaming generator.

## @lesson Streaming: menjaga memori tetap datar
Komputer punya memori jauh lebih sedikit daripada disk, dan container produksi sering hanya punya beberapa ratus megabyte. Job yang memuat seluruh masukan ke memori berhasil di file uji Anda dan mati di file sungguhan. Obatnya adalah memproses data sebagai **stream**: baca sedikit, tangani, tulis, lupakan.

Alat Python untuk ini adalah **iterator**, dan cara termudah menulisnya adalah **generator**: fungsi yang memakai `yield` (atau `yield from` untuk meneruskan tiap item dari iterable lain) alih-alih `return` sekali dengan list penuh.

```python
def read_orders(path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)      # satu baris sekali waktu
```

Memanggil `read_orders(path)` tidak membaca apa pun; ia mengembalikan sebuah generator. Setiap kali pemanggil meminta item berikutnya, fungsi berjalan sampai `yield` berikutnya, menyerahkan satu baris, lalu berhenti sejenak. Pada saat mana pun hanya satu baris (ditambah apa yang disimpan kode Anda) berada di memori, berapa pun ukuran file. Dua sifat yang mengejutkan pendatang baru:

- **Evaluasi malas (lazy) menyembunyikan error.** Karena tidak ada yang berjalan sampai sesuatu mengonsumsi generator, bug di dalamnya muncul belakangan dan di tempat lain dari tempat Anda membuatnya. `FileNotFoundError` muncul pada `next()` pertama, bukan saat pemanggilan.
- **Generator habis dipakai.** Iterasi dua kali dan putaran kedua kosong. Buat yang baru bila Anda butuh putaran lain.

Bahan bangunan yang akan Anda pakai: `enumerate` (menambah nomor baris), `zip`, generator expression `(f(x) for x in rows)`, dan modul `itertools`: `islice` (ambil N pertama), `chain` (menyambung iterable), dan sejak Python 3.12 `batched` (mengelompokkan item menjadi tuple berisi N, cara Anda mengirim baris ke database dalam potongan, misalnya 1.000).

**Seberapa besar penghematannya?** Ukur, jangan menebak. Pada CSV pesanan 120.000 baris berukuran 5,8 MB, `tracemalloc` (pustaka standar) melaporkan:

- streaming melewati validator dan menulis seiring jalan: **puncak 9 MB**
- membaca semua baris ke list berisi dict lalu memvalidasinya ke list: **puncak 213 MB**, 37 kali ukuran file, karena setiap baris menjadi dict Python penuh objek Python, masing-masing dengan overhead sendiri
- sebagai pembanding, pandas menampung file yang sama sekitar 9 MB, karena menyimpan kolom secara padat; tetapi ubah data yang sama menjadi satu objek Python per baris dan biayanya meledak

```python
import tracemalloc
tracemalloc.start()
run(big_file, "out.ndjson", "quarantine.ndjson")
current, peak = tracemalloc.get_traced_memory()
print(f"peak {peak / 1e6:.0f} MB")
```

Jadi pelajarannya bukan "pandas itu buruk" melainkan "ketahui biaya struktur data Anda". Pandas juga bisa membaca per potongan (`read_csv(..., chunksize=100_000)`), dan engine seperti DuckDB dan Polars (Modul 2.1) memproses data lebih besar dari memori untuk Anda. Pakai Python streaming biasa untuk logika per baris seperti validasi; pakai engine itu untuk agregasi.

Satu hal yang tidak bisa dilakukan stream secara gratis adalah **deduplikasi**: mengingat id mana yang sudah terlihat butuh memori sebanding dengan jumlah id berbeda. Set berisi integer murah (jutaan masih muat dengan nyaman), tetapi ketahuilah di sinilah memori bertambah, dan pakai alat yang tepat (database, atau merge terurut) bila ruang id-nya sangat besar.

### Lihat sendiri: generator hanya berjalan ketika diminta

Memanggil fungsi generator **tidak** menjalankan badannya. Setiap `next()` menjalankannya sampai `yield` berikutnya, lalu berhenti sejenak. Perhatikan di mana print muncul:

:::trace Generator berhenti di setiap yield
@code
def read_numbers():
    for n in [10, 20, 30]:
        print("producing", n)
        yield n

stream = read_numbers()
print("created, nothing has run yet")
first = next(stream)
print("got", first)
second = next(stream)
print("got", second)
@notes
6 | Memanggil fungsinya hanya **membuat** generator (lihat `stream` di kanan). Belum ada yang berjalan di dalamnya.
7 | Jadi ini tercetak sebelum baris "producing" mana pun.
8 | `next()` memulai badan fungsi. Ia berjalan sampai `yield` pertama.
3 | "producing 10" yang pertama baru muncul sekarang.
4 | `yield` menyerahkan `10` dan **berhenti sejenak** di sini. Variabel milik fungsi disimpan untuk nanti.
10 | `next()` kedua melanjutkan tepat setelah `yield`: loop maju ke 20.
:::

:::ask Apa yang ditunjukkan kedua print?
```python
rows = (n * 2 for n in [1, 2, 3])
print(list(rows))
print(list(rows))
```
@options
`[2, 4, 6]` lalu `[2, 4, 6]`
`[2, 4, 6]` lalu error
* `[2, 4, 6]` lalu `[]`
@why
Generator **habis dipakai** setelah satu putaran: `list(rows)` kedua tidak menemukan apa-apa lagi. Kalau butuh putaran lagi, buat generator baru (panggil fungsinya lagi).
:::

:::ask `rows = read_orders("missing.csv")` adalah fungsi generator. Di baris mana `FileNotFoundError` muncul?
@options
* nanti, ketika sesuatu pertama kali meminta baris
di baris yang memanggil `read_orders(...)`
tidak pernah: generator menelan error
@why
Evaluasi malas (lazy) menyembunyikan error: memanggil fungsi tidak menjalankan apa-apa, jadi file baru dibuka ketika baris pertama diminta. Bug di generator muncul lebih lambat dan di tempat lain daripada tempat Anda membuatnya.
:::

:::drill python Tulis generator lazy
Tulis `doubled(numbers)` sebagai **generator** (pakai `yield`, bukan `return`) yang memberi setiap angka dikali dua, satu per satu.
@starter
# tulis generator Anda di bawah baris ini

@check
defines("doubled") ## Definisikan fungsi bernama doubled dengan satu parameter.
has_node("Yield") ## Pakai yield: generator menyerahkan item satu per satu.
list(doubled([1, 2, 3])) == [2, 4, 6] ## list(doubled([1, 2, 3])) harus [2, 4, 6].
next(doubled([5, 6])) == 10 ## next(doubled([5, 6])) harus 10: hanya item pertama.
not isinstance(doubled([1]), list) ## Ia harus mengembalikan generator, bukan list yang sudah jadi.
@hint
Lakukan loop pada `numbers` dan pakai `yield` (alih-alih membangun list lalu memakai `return`) untuk mengeluarkan tiap angka dikali 2 satu per satu.
@solution
def doubled(numbers):
    for n in numbers:
        yield n * 2
:::

:::drill python Simpan hanya baris yang baik
Tulis generator `good_totals(rows)`: untuk setiap baris (dict dengan `"total"` berupa teks) berikan total **sebagai angka**, tetapi lewati baris yang totalnya bukan bilangan bulat (pakai `try` / `except ValueError`, jangan pernah memakai bare `except`).
@starter
# tulis generator Anda di bawah baris ini

@check
defines("good_totals") ## Definisikan fungsi bernama good_totals dengan satu parameter.
has_node("Yield") ## Pakai yield.
list(good_totals([{"total": "100"}, {"total": "x"}, {"total": "250"}])) == [100, 250] ## Dengan total "100", "x", "250" harus memberi [100, 250]: yang buruk dilewati.
list(good_totals([])) == [] ## Input kosong tidak memberi apa-apa.
has_node("Try") ## Pakai try / except ValueError.
@hint
Lakukan loop pada `rows` dan bungkus konversi `row["total"]` dengan `int(...)` di dalam blok `try`; `yield` angkanya jika berhasil dan tangkap `ValueError` untuk melewati baris yang rusak. (Melewati itu boleh **di sini** karena ini latihan; di pipeline sungguhan baris buruk masuk karantina, seperti yang ditunjukkan Pelajaran 6.)
@solution
def good_totals(rows):
    for row in rows:
        try:
            yield int(row["total"])
        except ValueError:
            pass
:::

> 💡 **Jeda Praktik 2 (Streaming Data dengan Generator read_orders):**
> Buat pembaca data hemat memori yang tidak memuat seluruh file ke RAM:
> 1. Di file `labs/mod-1-2/etl.py` pada text editor, temukan fungsi `read_orders(path)`.
> 2. Terapkan generator lazy menggunakan `with open(path, newline="", encoding="utf-8") as f:` dan `csv.DictReader(f)` bersama `yield from` (jangan pernah mengubahnya menjadi `list(csv.DictReader(f))`).
> 3. Uji sifat evaluasi malas (lazy) generator di terminal:
> `pytest labs/mod-1-2/test_lab.py -k test_read_orders_is_a_lazy_generator -v`
> (Tes `TestStreaming` lainnya, `test_memory_stays_flat_on_a_big_file`, memanggil `etl.run()` dan akan lulus tepat setelah Jeda Praktik 3 mengimplementasikan `run()`.) Jika `test_read_orders_is_a_lazy_generator` PASSED, generator Anda siap! Lanjut ke Pelajaran 6 tentang retry dan idempotensi.

## @part Membuatnya andal

## @lesson Error, retry, dan idempotensi
**Tangkap exception yang spesifik, tangani yang bisa Anda tangani, biarkan sisanya gagal dengan jelas.** `except Exception: pass` adalah baris termahal yang bisa Anda tulis, karena mengubah setiap bug di masa depan menjadi kehilangan data yang senyap. Tangkap tipe yang paling spesifik (`ValidationError`, `FileNotFoundError`), lakukan sesuatu yang disengaja (karantina, retry, keluar dengan kode), dan tambahkan konteks saat melempar ulang: `raise RuntimeError("loading orders failed") from exc` mempertahankan traceback aslinya.

**Bedakan dua jenis kegagalan:**

1. **Data buruk** (total negatif). Mengulang tidak akan pernah memperbaikinya. Karantina.
2. **Kegagalan sementara** (timeout, rate limit, koneksi putus). Mengulang kemungkinan besar memperbaikinya, setelah jeda.

Ulangi jenis kedua dengan **exponential backoff dan jitter**: tunggu 1 dtk, lalu 2 dtk, lalu 4 dtk, masing-masing dikali faktor acak agar banyak klien tidak mengulang pada detik yang sama. Selalu batasi jumlah percobaan dan lempar ulang di akhir.

```python
def retry(fn, attempts=4, base=1.0, retry_on=(ConnectionError, TimeoutError)):
    for n in range(1, attempts + 1):
        try:
            return fn()
        except retry_on:
            if n == attempts:
                raise
            time.sleep(base * 2 ** (n - 1) * (0.5 + random.random()))
```

(Ulangi hanya operasi yang **aman diulang**. Mengulang pembayaran tanpa idempotency key menagih dua kali.)

Itu membawa kita ke **idempotensi**, yang diperkenalkan di Modul 0.2: menjalankan job dua kali harus menghasilkan hasil yang sama dengan sekali. Teknik yang bisa Anda terapkan hari ini:

- **Keluaran deterministik.** Masukan sama memberi keluaran identik byte demi byte: pertahankan urutan masukan, `json.dumps(..., sort_keys=True)`, tanpa stempel waktu "sekarang" di dalam data.
- **Tulis atomik.** Tulis ke `output.tmp` dan `os.replace("output.tmp", "output")` di akhir. Pembaca melihat file lama yang lengkap atau file baru yang lengkap; crash di tengah menyisakan yang lama utuh. Bersihkan file `.tmp` dalam `try/except` agar eksekusi yang gagal tidak meninggalkan apa pun.
- **Ganti, jangan tambah.** Tulis keluaran sehari ke path yang memuat tanggalnya dan timpa, alih-alih menambahkan ke satu file yang terus membesar.

Ketiganya persis yang diuji Lab 1.2.

### Lihat sendiri: karantina, jangan dibuang

Data buruk tidak diulang dan tidak dibuang: ia **disisihkan beserta alasannya**. Perhatikan tiga baris melaluinya:

:::trace Baris bersih lanjut, baris buruk dikarantina
@code
rows = [{"id": 1, "total": "100"}, {"id": 2, "total": "-5"}, {"id": 3, "total": "x"}]
clean = []
quarantine = []
for row in rows:
    try:
        total = int(row["total"])
        if total <= 0:
            raise ValueError("total must be positive")
        clean.append(row["id"])
    except ValueError as exc:
        quarantine.append({"id": row["id"], "reason": str(exc)})
print(clean, quarantine)
@notes
6 | `int("x")` gagal tepat di sini untuk baris 3. Baris 1 dan 2 lolos baris ini.
8 | Baris 2 berhasil diubah tetapi melanggar aturan bisnis, jadi kode memunculkan error dengan sengaja.
9 | Hanya baris yang lolos kedua pemeriksaan yang sampai ke `clean`.
11 | Baris yang ditolak **disimpan**, beserta alasannya. Tidak ada yang hilang diam-diam.
:::

:::ask Kegagalan mana di antara ini yang layak diulang?
@options
total pesanan negatif
kolom yang hilang di header CSV
* timeout koneksi saat memanggil API
@why
Kegagalan **sementara** (timeout, batas laju, koneksi putus) kemungkinan berhasil setelah jeda. **Data buruk** (total negatif, kolom hilang) akan gagal dengan cara yang sama setiap kali: mengulang membuang waktu, jadi karantina atau gagal dengan jelas.
:::

:::ask Job crash di tengah penulisan `output.tmp`, dan langkah terakhir `os.replace("output.tmp", "output")` tidak pernah berjalan. Apa yang dilihat pembaca `output`?
@options
* file lama yang lengkap
setengah file baru
tidak ada, file-nya terhapus
@why
Itulah gunanya penulisan atomik: data baru dibangun di samping file sebenarnya dan ditukar dengan satu langkah di akhir. Crash meninggalkan file lama yang lengkap utuh, sehingga pembaca tidak pernah melihat file yang setengah tertulis.
:::

:::drill python Ulangi, lalu menyerah
`make_flaky` sudah diberikan: ia membuat fungsi yang memunculkan `ConnectionError` beberapa kali lalu berhasil. Tulis `retry(fn, attempts=3)`: panggil `fn()` dan kembalikan hasilnya; ketika ia memunculkan `ConnectionError`, coba lagi, sampai `attempts` panggilan seluruhnya; setelah percobaan terakhir gagal, **munculkan** error itu lagi. Jenis error lain tidak boleh diulang.
@starter
def make_flaky(failures):
    """Fungsi yang memunculkan ConnectionError sebanyak `failures` kali, lalu mengembalikan "ok"."""
    def flaky():
        flaky.calls += 1
        if flaky.calls <= failures:
            raise ConnectionError("network blip")
        return "ok"
    flaky.calls = 0
    return flaky

# tulis retry(fn, attempts=3) di bawah baris ini

@check
defines("retry") ## Definisikan retry(fn, attempts=3).
retry(make_flaky(0)) == "ok" ## Fungsi yang berhasil pada percobaan pertama memberi hasilnya.
retry(make_flaky(2), 4) == "ok" ## Fungsi yang gagal dua kali lalu berhasil harus sukses dengan 4 percobaan.
(lambda f: (raises_error(ConnectionError, retry, f, 3), f.calls)[1] == 3)(make_flaky(10)) ## Ketika selalu gagal, retry harus memanggilnya tepat 3 kali lalu memunculkan ConnectionError lagi.
raises_error(ValueError, retry, lambda: int("x"), 3) ## ValueError adalah data buruk, bukan gangguan jaringan: ia harus dimunculkan seketika, tidak diulang.
@hint
Pakai loop `for` sebanyak `attempts` kali; di dalam `try`, kembalikan `fn()`. Tangkap hanya `ConnectionError` (agar error lain langsung naik), dan pada percobaan terakhir lempar ulang dengan `raise` kosong. Lihat contoh `retry` di awal pelajaran ini jika Anda macet.
@solution
def make_flaky(failures):
    """Fungsi yang memunculkan ConnectionError sebanyak `failures` kali, lalu mengembalikan "ok"."""
    def flaky():
        flaky.calls += 1
        if flaky.calls <= failures:
            raise ConnectionError("network blip")
        return "ok"
    flaky.calls = 0
    return flaky


def retry(fn, attempts=3):
    for n in range(1, attempts + 1):
        try:
            return fn()
        except ConnectionError:
            if n == attempts:
                raise
:::

> 💡 **Jeda Praktik 3 (Pipeline Idempoten & Karantina run):**
> Rangkai alur kerja ETL lengkap yang aman dijalankan ulang:
> 1. Di file `labs/mod-1-2/etl.py` pada text editor, implementasikan fungsi `run(input_path, output_path, quarantine_path)`.
> 2. Gunakan penulisan atomik (tulis ke file sementara `.tmp` lalu tukar dengan `os.replace`), lacak duplikat `order_id` menggunakan set, kirim data bersih ke `output_path` (format NDJSON dengan kunci terurut), dan kirim baris gagal ke `quarantine_path` mencatat alasan penolakannya.
> 3. Uji pipeline di terminal:
> `pytest labs/mod-1-2/test_lab.py -k TestRun -v`
> Jika semua tes TestRun PASSED, pipeline Anda sudah idempoten dan toleran terhadap data buruk! Lanjut ke Pelajaran 7 & 8 untuk logging (`TestLogging`) dan testing.

## @lesson Logging dan ringkasan eksekusi
`print` untuk skrip; **`logging`** untuk job. Ia menambah stempel waktu, tingkat keparahan, dan perutean (ke file, ke konsol, ke pengumpul), dan membiarkan siapa pun yang menjalankan job memilih seberapa banyak yang ingin dilihat tanpa mengubah kode.

```python
import logging
logger = logging.getLogger("kopiku_etl")        # satu logger per modul/paket

logger.info("read=%d valid=%d duplicates=%d invalid=%d", read, valid, dup, invalid)
logger.error("reject rate %.2f%% is above the limit", rate * 100)
```

Konfigurasikan sekali di titik masuk (`logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")`) dan jangan pernah di kode pustaka. Kirim nilai sebagai argumen (`%d`), bukan dengan menyusun string sendiri, agar pemformatan hanya terjadi bila pesan benar-benar dikeluarkan.

Tingkat dalam praktik: `DEBUG` (detail untuk pengembang), `INFO` (tonggak normal dan **ringkasan eksekusi**), `WARNING` (aneh tetapi tertangani), `ERROR` (job gagal atau sebuah record hilang). Jangan mencatat setiap baris; catat jumlah. Jangan pernah mencatat rahasia atau data pribadi.

Baris log tunggal yang paling berguna di pipeline mana pun adalah **ringkasan eksekusi**: berapa baris dibaca, berapa valid, berapa ditolak dan mengapa, berapa lama. Itu monitoring pertama dan termurah Anda: perubahan mendadak angka-angka itu antar malam sering menjadi tanda pertama masalah di hulu, itulah sebabnya lab meminta Anda mencatatnya dan exit code mencerminkan tingkat penolakan.

> 🛠 **Coba sendiri (12 menit, Python).** Kembangkan `run` dari Coba sendiri Pelajaran 1 (`etl_try.py`): panggil `logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")` satu kali, di titik masuk program, dan log ringkasan run sebagai satu baris INFO berisi `read`, `valid`, `duplicates`, dan `invalid`. Hitung sebuah baris sebagai tidak valid jika `total_idr`-nya bukan angka biasa (jadi `Rp 150.000` dan angka negatif tidak valid di sini), dan sebagai duplikat jika ia valid dan `order_id`-nya sudah pernah terlihat. Jika porsi yang tidak valid di atas 1%, log sebuah ERROR dan keluar dengan `sys.exit(1)`.
>
> **Seharusnya Anda melihat:** baris seperti `2026-.. INFO read=3634 valid=3545 duplicates=35 invalid=54`, lalu sebuah ERROR (54 dari 3.634 kira-kira 1,5%) dan `echo $?` mencetak `1`. Run yang sama dengan `print` tidak punya waktu, tidak punya level, dan tidak bisa difilter atau dijadikan peringatan. Di lab Anda, periksa baris log ringkasan dengan `pytest labs/mod-1-2/test_lab.py -k TestLogging -v`.

:::drill python Ringkasan run
Baris log paling berguna dari sebuah job adalah ringkasan run-nya. Tulis `run_summary(outcomes)`: `outcomes` adalah daftar berisi satu kata per baris masukan: `"valid"`, `"duplicate"`, atau `"invalid"`. Kembalikan dictionary dengan kunci `read`, `valid`, `duplicates`, dan `invalid` berisi jumlahnya.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("run_summary") ## Definisikan run_summary(outcomes).
run_summary(["valid", "valid", "duplicate", "invalid"]) == {"read": 4, "valid": 2, "duplicates": 1, "invalid": 1} ## Empat baris dibaca, dibagi menurut hasil.
run_summary([]) == {"read": 0, "valid": 0, "duplicates": 0, "invalid": 0} ## Masukan kosong tetap menghasilkan keempat kunci.
run_summary(["invalid"] * 3)["read"] == 3 ## read menghitung setiap baris.
@hint
`read` adalah `len(outcomes)`; yang lain adalah `outcomes.count("valid")` dan seterusnya.
@solution
def run_summary(outcomes):
    return {
        "read": len(outcomes),
        "valid": outcomes.count("valid"),
        "duplicates": outcomes.count("duplicate"),
        "invalid": outcomes.count("invalid"),
    }
:::

:::ask Ringkasan run semalam: read=100000, invalid=200. Malam ini: read=100000, invalid=30000. Bagaimana membacanya dengan baik?
@options
* ada perubahan di hulu: lihat alasan baris yang ditolak
job malam ini lebih cepat, jadi angkanya pasti wajar
logging rusak dan sebaiknya dimatikan dulu untuk sementara
@why
Hitungan yang melonjak antar malam sering menjadi tanda pertama perubahan di hulu, misalnya format baru atau field yang diganti nama. Ringkasan run adalah monitoring termurah Anda, jadi selidiki alasannya.
:::

## @lesson Menguji kode data dengan pytest
Tes adalah cara Anda mengubah kode tanpa takut. Untuk job data, tes juga mendokumentasikan, dalam bentuk yang bisa dijalankan, apa arti "benar". **pytest** adalah alat standar: taruh fungsi bernama `test_*` di file bernama `test_*.py` dan jalankan `pytest`.

```python
def test_status_is_normalised():
    assert validate({**GOOD, "status": " PAID "}).status == "paid"
```

Perhatikan bahwa `{**GOOD, "status": " PAID "}` membuat salinan dictionary dasar `GOOD` dengan kunci `"status"` diganti, sehingga tiap tes tidak pernah merusak data patokan bersama.

Fitur yang layak dipelajari lebih awal:

- **`pytest.mark.parametrize`** menjalankan satu badan tes pada banyak kasus, sempurna untuk aturan data berantakan:

```python
@pytest.mark.parametrize("raw,expected", [("Rp 1.250.000", 1250000), ("150000", 150000)])
def test_total_accepts_rupiah_text(raw, expected):
    assert validate({**GOOD, "total_idr": raw}).total_idr == expected
```

- **`pytest.raises`** menegaskan bahwa masukan buruk gagal dengan cara yang benar: `with pytest.raises(ValidationError): validate({**GOOD, "total_idr": "-5"})`.
- **Fixture** (`@pytest.fixture`) membangun masukan atau sumber daya uji yang bisa dipakai ulang, dengan setup dan cleanup. Fixture bawaan `tmp_path` memberi setiap tes folder sementaranya sendiri, sehingga tes tidak pernah berbagi atau mencemari file. `caplog` menangkap pesan log agar bisa Anda tegaskan; `monkeypatch` sementara mengganti fungsi atau environment variable.

Apa yang diuji dalam pipeline:

1. **Setiap aturan pada baris kecil buatan tangan**, terutama yang jelek yang pernah Anda lihat di data nyata. Bug tinggal di tepi.
2. **Seluruh job pada file contoh**, membandingkan hitungan dengan kebenaran yang diketahui (tes lab membandingkan dengan ground truth generator, bukan dengan kode Anda sendiri).
3. **Perilaku, bukan hanya nilai**: bahwa eksekusi ulang memberi keluaran identik, bahwa eksekusi gagal mempertahankan keluaran sebelumnya, bahwa exit code benar, bahwa memori tetap datar.
4. **Regresi**: ketika bug produksi ditemukan, tulis dulu tes yang mereproduksinya, baru perbaiki. Bug itu tidak akan bisa kembali dengan diam-diam.

Jaga tes tetap cepat dan bebas dari jaringan dan jam. Rangkaian tes yang berjalan dalam hitungan detik dijalankan di setiap perubahan; yang butuh sepuluh menit diabaikan.

Agar CLI Anda mudah diuji dengan `pytest`, terima parameter `argv=None` di `main` lalu teruskan ke `argparse`:

```python
parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("output")
parser.add_argument("quarantine")
parser.add_argument("--max-reject-rate", type=float, default=0.05)
args = parser.parse_args(argv)
```

Selalu teruskan `argv` ke `parser.parse_args(argv)`. Ketika `argv` bernilai `None` (saat dijalankan normal lewat terminal), `argparse` membaca `sys.argv[1:]`; ketika `pytest` memanggil `etl.main([...])`, meneruskan `argv` membuat `argparse` mem-parse argumen uji alih-alih rusak karena flag command line milik `pytest` sendiri.

> 💡 **Jeda Praktik 4 (CLI Entrypoint & Uji Rangkaian Penuh):**
> Lengkapi antarmuka command line produksi dan jalankan verifikasi menyeluruh:
> 1. Di file `labs/mod-1-2/etl.py` pada text editor, lengkapi fungsi `main(argv=None)` dengan pola `argparse` di atas: terima argumen `input`, `output`, `quarantine`, serta `--max-reject-rate` (default `0.05`). Kembalikan exit code `0` untuk sukses, `1` jika tingkat penolakan melebihi batas, dan `2` jika file input tidak bisa dibaca.
> 2. Jalankan seluruh suite tes (termasuk `TestLogging`, uji memori 120.000 baris `TestStreaming`, dan `TestMain`) di terminal:
> `pytest labs/mod-1-2/test_lab.py -v`
> 3. Jalankan skrip pada data KopiKu dan buat kode bukti lab Anda:
> `python3 labs/mod-1-2/etl.py data/orders.csv /tmp/clean.ndjson /tmp/quarantine.ndjson`
> `python3 scripts/prove.py mod-1-2`
> Ketika seluruh 28 tes berwarna HIJAU (PASSED), Anda telah menuntaskan job ETL Python defensif kelas enterprise! Lanjut ke Pelajaran 9 untuk memilih perkakas yang tepat.

:::ask Anda punya satu aturan untuk diuji (total bisa 'Rp 1.250.000' atau '150000') dengan banyak contoh masukan. Fitur pytest mana yang cocok?
@options
fixture yang menghapus semua file tes yang ada
* parametrize: satu isi tes, banyak kasus
tes yang berulang sampai akhirnya berhasil lolos
@why
`pytest.mark.parametrize` menjalankan isi tes yang sama sekali per kasus dan melaporkan tiap kasus terpisah, cocok untuk aturan data berantakan dengan banyak contoh.
:::

## @lesson Perkakas, dependensi, dan kapan Python adalah alat yang tepat
**Pin dependensi Anda.** `requirements.txt` dengan versi pasti atau berbatas (`pydantic>=2.5,<3`) membuat build dapat diulang; lock file (`uv`, `pip-tools`, `poetry`) membuatnya dapat diulang secara persis. Instalasi tanpa pin yang menarik versi mayor baru semalam adalah penyebab klasik "kemarin masih jalan".

**Otomatisasi pemeriksaan yang membosankan.** Formatter dan linter (`ruff` melakukan keduanya) mengakhiri debat gaya dan menangkap kesalahan nyata (variabel tak terpakai, nama tak terdefinisi). Pemeriksa tipe (`mypy`, `pyright`) menangkap bug salah tipe. Jalankan bersama tes Anda di CI, dan opsional di setiap commit dengan `pre-commit`.

**Performa dalam satu paragraf.** CPython menjalankan satu thread bytecode Python sekali waktu (**GIL**), sehingga thread membantu untuk pekerjaan *menunggu* (banyak panggilan jaringan, pembacaan disk) tetapi tidak untuk pekerjaan berat CPU; untuk itu pakai banyak proses (`multiprocessing`, `concurrent.futures.ProcessPoolExecutor`) atau, lebih baik, engine tervektorisasi. Ukur sebelum mengoptimalkan—bagian yang lambat jarang berada di tempat yang Anda tebak. Pakai `tracemalloc` (Pelajaran 5) untuk RAM, `timeit` untuk satu fungsi, dan `python3 -m cProfile -s cumtime job.py` di terminal untuk mengurutkan tiap fungsi berdasarkan total waktu CPU sebelum mengubah kode apa pun.

**Memilih alat yang tepat.** Python biasa sangat baik untuk perekat: memanggil API, memvalidasi record, memindah dan membentuk ulang data berukuran sedang, mengorkestrasi alat lain. Untuk **agregasi berat, join, dan analitik pada data besar**, engine SQL (DuckDB, Modul 2.1; warehouse, Modul 2.3) dan engine dataframe (Polars, Spark) jauh lebih cepat dan memakai memori jauh lebih baik daripada loop tulisan tangan. Data engineer yang baik menulis validasi dan perpipaan di Python dan mendorong komputasi berat ke engine yang dibangun untuknya.

> 🛠 **Coba sendiri (10 menit, terminal).** Di virtual environment yang baru, jalankan `pip install ruff`. Simpan `bad.py` berisi baris `import os`, `import json`, `x=1`, dan `print( x )`. Jalankan `ruff check bad.py`, lalu `ruff check --fix bad.py`, lalu `ruff format bad.py` dan lihat file-nya. Terakhir jalankan `pip freeze > requirements.txt` dan baca baris-baris pertamanya.
>
> **Seharusnya Anda melihat:** satu `F401` ("imported but unused") untuk `os` dan satu untuk `json`; perbaikannya menghapus kedua import itu; formatter mengubah sisanya menjadi `x = 1` dan `print(x)`; `requirements.txt` mencantumkan versi persis seperti `ruff==0.x.y`. Pemeriksaan mana yang Anda inginkan di setiap pull request?

:::ask `pip install pydantic` tanpa pin menarik versi mayor baru semalam dan job rusak. Apa yang mencegahnya?
@options
memasang ulang library tersebut setiap pagi
menghindari penggunaan library sama sekali
* pin versinya, mis. pydantic>=2.5,<3
@why
Versi persis atau berbatas membuat build bisa diulang, dan lock file membuatnya persis sama. Tanpa pin, rilis baru bisa mengubah perilaku saat Anda tidur.
:::

## @lesson I/O konkuren, pemuatan database massal, integration testing, dan pola live-coding {optional}

Saat Anda beralih dari skrip kecil ke pipeline produksi dan wawancara teknis, empat pola rekayasa ini membedakan Data Engineer siap kerja dari pemula:

**1. I/O Konkuren Terbatas (`ThreadPoolExecutor` + Rate Limiting).** Mengambil data dari 400 endpoint API cabang secara berurutan dengan latensi jaringan `250 ms` per panggilan memakan waktu `100 detik` hanya untuk menunggu soket. Namun, meluncurkan 400 thread sekaligus akan memicu pemblokiran `HTTP 429 Too Many Requests` seketika atau menghabiskan koneksi database. Pipeline Python produksi menggunakan **worker pool terbatas** yang dipadukan dengan **pengatur laju (rate limiter) thread-safe**:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading, time

_rate_lock = threading.Lock()
_next_allowed_ts = 0.0

def throttled_fetch(endpoint: str, fetch_fn, min_interval_sec: float = 0.05) -> dict:
    """Menjamin maksimal 20 request/detik di seluruh worker thread."""
    global _next_allowed_ts
    with _rate_lock:
        now = time.monotonic()
        wait = max(0.0, _next_allowed_ts - now)
        _next_allowed_ts = max(now, _next_allowed_ts) + min_interval_sec
    if wait > 0:
        time.sleep(wait)
    return fetch_fn(endpoint)

def fetch_all_bounded(endpoints: list[str], fetch_fn, max_workers: int = 8) -> list[dict]:
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(throttled_fetch, ep, fetch_fn): ep for ep in endpoints}
        for fut in as_completed(futures):
            results.append(fut.result())
    return results
```

**2. Pemuatan Database Massal (Bulk Load) vs. `INSERT` Baris demi Baris.** Jangan pernah memuat 500.000 baris ke PostgreSQL atau cloud warehouse menggunakan loop `for` Python dengan `cursor.execute("INSERT ...")`. Diukur di PostgreSQL 16 dengan psycopg 3.3, memuat 100.000 baris lewat koneksi lokal butuh **34 sampai 39 detik** dengan loop `INSERT`, **2,6 detik** dengan `executemany()` (psycopg 3 mem-pipeline perintahnya), dan **0,1 detik** dengan `COPY`.
- **PostgreSQL:** Alirkan baris langsung ke protokol `COPY ... FROM STDIN` milik PostgreSQL. Di psycopg 3: `with cur.copy("COPY stg_orders (order_id, customer_id, status, total_idr) FROM STDIN") as cp:` lalu `cp.write_row(row)` untuk setiap baris. (Kode lama memakai `cursor.copy_expert(sql, file)` dari psycopg2 untuk hal yang sama.)
- **Cloud Warehouse:** Tulis potongan Parquet terkompresi Snappy lalu picu satu perintah bulk load (`snowflake.connector.pandas_tools.write_pandas`, BigQuery `load_table_from_uri`, atau `COPY INTO`).

**3. Unit Test vs. End-to-End ELT Integration Test.**
- **Unit Test (`test_parse_row`):** Memanggil fungsi murni `clean_order(raw_dict)` di memori tanpa menyentuh file, jaringan, atau database (`< 1 ms` per tes).
- **Integration Test (`test_pipeline_end_to_end`):** Menghubungkan tiruan (mock) sumber HTTP + gerbang validasi Pydantic + database sementara SQLite/DuckDB di `tmp_path`, menjalankan job dua kali berturut-turut, lalu memverifikasi bahwa: (a) baris valid masuk ke tabel target dengan total integer persis, (b) baris rusak masuk ke `quarantine.jsonl`, dan (c) eksekusi kedua menghasilkan **nol baris duplikat** (idempoten).

**4. 5 Pola Utama Live-Coding Python dalam Wawancara Data Engineer.** Sebagian besar wawancara Python 45 menit untuk data engineer menguji salah satu versi dari lima pola ini:

| # | Pola Wawancara | Apa yang Diuji Pewawancara | Konstruksi Kunci Python |
|---|---|---|---|
| **1** | **Streaming `yield` Memori Konstan & Chunking** | Anda tidak memanggil `.readlines()` atau memuat file 50 GB ke dalam list di RAM. | `def stream_valid(path):` dengan `yield row` + batching `itertools.islice` |
| **2** | **Exponential Backoff + Jitter & Atomic Checkpointing** | Hanya me-retry `429 / 5xx`, mematuhi `Retry-After`, dan menyimpan state via `os.replace`. | `delay = min(cap, base * (2 ** attempt)) * random.uniform(0.5, 1.0)` |
| **3** | **Perataan JSON Bersarang & Deteksi Schema Drift** | Memecah `order -> items[]` menjadi baris induk/anak tanpa menghilangkan pesanan kosong, serta mendeteksi kunci baru/hilang. | Aljabar himpunan `expected_keys - actual_keys` + tuple induk/anak |
| **4** | **Tokenisasi PII `HMAC-SHA256` Ber-Salt** | Memahami bahwa `sha256(telepon)` biasa mudah dibongkar rainbow table sehingga wajib memakai secret salt. | `hmac.new(salt.encode(), norm_email.encode(), hashlib.sha256).hexdigest()` |
| **5** | **Sliding Window di Memori / Pembersihan/Eviction Watermark** | Menghitung agregat bergulir 5 menit pada aliran event dengan membuang timestamp kedaluwarsa agar RAM tidak bocor. | `collections.deque` atau `heapq` berdasarkan `event_ts` |

> 🛠 **Coba sendiri (15 menit, Python).** Palsukan panggilan API dengan `def fetch(ep): time.sleep(0.25); return {"ep": ep}` dan ambil 40 endpoint dengan tiga cara: loop biasa, `fetch_all_bounded` di atas dengan 8 worker tanpa throttle, dan cara yang sama dengan throttle 20 per detik. (Beri `fetch_all_bounded` parameter `min_interval_sec` yang diteruskan ke `throttled_fetch`, sehingga `0` mematikan throttle.) Ukur masing-masing dengan `time.perf_counter()` dan pastikan ketiganya mengembalikan 40 hasil. Sebelum menjalankan, tebak ketiga waktunya hanya dari angka-angkanya.
>
> **Seharusnya Anda melihat:** sekitar `10.0` detik untuk loop (40 × 0,25 detik), sekitar `1.25` detik dengan 8 worker (5 gelombang berisi 8), dan sekitar `2.2` detik dengan throttle: request ke-40 baru boleh mulai setelah 39 × 0,05 = 1,95 detik, berapa pun ukuran pool-nya, lalu butuh 0,25 detik. Begitu API punya batas laju, throttle-lah yang menentukan kecepatan, bukan pool. Diukur dengan Python 3.14.

:::drill python Berapa lama 400 panggilan API?
Setiap panggilan API menunggu `latency_ms` milidetik. Dengan `workers` panggilan berjalan bersamaan, panggilan berjalan dalam putaran. Tulis `seconds_needed(calls, latency_ms, workers)`: kembalikan total waktu dalam detik (sebuah angka).
@starter
import math
# tulis fungsi Anda di bawah baris ini

@check
defines("seconds_needed") ## Definisikan seconds_needed(calls, latency_ms, workers).
seconds_needed(400, 250, 1) == 100 ## Satu per satu: 400 × 0,25 dtk = 100 dtk.
seconds_needed(400, 250, 20) == 5 ## 20 sekaligus: 20 putaran × 0,25 dtk = 5 dtk.
seconds_needed(3, 1000, 2) == 2 ## 3 panggilan pada 2 worker butuh 2 putaran 1 dtk.
seconds_needed(0, 250, 5) == 0 ## Tanpa panggilan, tanpa waktu.
@hint
Bagi `calls` dengan `workers` lalu bulatkan ke atas dengan `math.ceil` untuk mendapat jumlah putaran, kemudian kalikan dengan `latency_ms` dan ubah milidetik ke detik (bagi dengan 1000).
@solution
import math
def seconds_needed(calls, latency_ms, workers):
    rounds = math.ceil(calls / workers)
    return rounds * latency_ms / 1000
:::

:::ask 400 endpoint API harus diambil. Mengapa tidak memulai 400 thread sekaligus?
@options
* API akan balas 429: batasi jumlah worker
thread hanya bisa dimulai sepuluh sekaligus saja
400 thread selalu lebih lambat daripada satu thread
@why
Thread membantu karena kerjanya kebanyakan menunggu, tetapi konkurensi tanpa batas memicu rate limit dan menghabiskan koneksi. Pool terbatas dengan pembatasan laju memberi sebagian besar percepatan dengan aman.
:::

## @part Bekerja dalam tim

## @lesson Pre-commit hook, virtual environment, dan pull request tim data Agile {optional}

Di tim data engineering sesungguhnya, Anda hampir tidak pernah bekerja sendirian langsung di branch `main`. Setiap perubahan dibuat di branch fitur (`git switch -c feat/add-store-scd2`), melewati **pre-commit hook** otomatis di laptop, diuji oleh **GitHub Actions CI**, lalu ditinjau rekan setim lewat **Pull Request (PR)**.

**1. Pre-Commit Hook Otomatis (`.pre-commit-config.yaml`).** Menunggu sampai kode di-push ke GitHub baru menyadari bahwa Anda tidak sengaja men-commit file CSV 200 MB, meninggalkan private key API, atau merusak format Python sangat membuang waktu tim. Framework `pre-commit` menjalankan pemeriksaan lokal cepat *sebelum* `git commit` diizinkan berhasil:

```yaml
# .pre-commit-config.yaml — berjalan otomatis setiap kali `git commit` dijalankan
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: check-added-large-files
        args: ['--maxkb=500']          # Memblokir commit file data mentah CSV/Parquet berukuran besar
      - id: detect-private-key         # Memblokir private key PEM/SSH/API sebelum masuk ke riwayat Git
      - id: check-yaml                 # Memvalidasi schema.yml dbt dan workflow GitHub Actions
      - id: end-of-file-fixer
      - id: trailing-whitespace

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff                       # Linter Python super cepat berbasis Rust (pengganti flake8 + isort)
        args: [--fix]
      - id: ruff-format                # Formatter Python deterministik (pengganti black)
```

Begitu Anda menjalankan `pip install pre-commit && pre-commit install`, Git menjalankan ketujuh pemeriksaan itu secara otomatis pada setiap commit, dan commit berhenti jika salah satunya gagal.

**2. Isolasi Environment Modern (`venv` dan `uv`).** Baik tim Anda memakai `python3 -m venv .venv` standar dengan `requirements.txt` maupun `pyproject.toml` modern dengan `uv` (`uv venv && uv pip sync`), aturannya tetap satu: **satu proyek, satu virtual environment terisolasi, versi paket terkunci di-commit ke Git, dan folder `.venv/` wajib masuk `.gitignore`**.

**3. Cara Data Engineer Menulis Pull Request (PR) dalam Sprint Agile.** Jika PR software engineer menampilkan tangkapan layar tombol UI, **deskripsi PR seorang data engineer wajib menampilkan bukti rekonsiliasi data**. Saat membuka PR di tim produksi, selalu cantumkan empat poin ini:
- **Grain & Kontrak:** Apa primary key dari tabel baru/yang diubah, dan apakah grain-nya berubah?
- **Bukti Rekonsiliasi Baris & Uang:** Jumlah baris dan total metrik utama sebelum vs. sesudah perubahan (contoh: `fact_orders: 3.599 baris sebelum -> 3.599 baris sesudah; net_revenue_idr: Rp 1.208.770.000 -> Rp 1.208.770.000 (selisih 0,00%)`).
- **Dampak Biaya / Waktu Eksekusi Query:** Byte yang dipindai atau durasi jalan sebelum vs. sesudah (contoh: `BigQuery dry-run turun dari 42,1 GB ke 1,4 GB berkat partition pruning tanggal`).
- **Rencana Backfill & Rollback:** Apakah merge PR ini membutuhkan backfill historis (`dbt run --full-refresh` atau backfill rentang tanggal), dan bagaimana cara memulihkannya jika dashboard BI hilir terdampak?

> 🛠 **Coba sendiri (5 menit, terminal).** Di dalam repositori Git mana pun, lihat isi folder `.git/hooks/`. Tanpa pustaka tambahan sekalipun, Anda dapat membuat skrip shell `.git/hooks/pre-commit` (baris pertama `#!/bin/sh`, lalu `chmod +x .git/hooks/pre-commit`) berisi `git diff --cached --name-only | grep -E '\.(csv|parquet|db)$' && echo "ERROR: Jangan commit file data!" && exit 1 || exit 0`. Coba `git add` sebuah file `.csv` contoh lalu commit, kemudian lakukan hal yang sama dengan file `.txt`.
>
> **Seharusnya Anda melihat:** commit `.csv` berhenti: hook mencetak nama file dan `ERROR: Jangan commit file data!`, dan `echo $?` tepat setelah `git commit` menampilkan `1`. Commit `.txt` berhasil. Jika tidak terjadi apa-apa, periksa `chmod +x`: tanpanya Git melewati hook dan hanya mencetak `hint:` bahwa hook diabaikan karena tidak bisa dieksekusi. Diukur dengan Git 2.53.

:::ask Apa yang perlu ada di deskripsi pull request seorang data engineer tetapi tidak dibutuhkan pengembang UI?
@options
tangkapan layar tombol yang sudah selesai dibuat
* bukti data: grain, jumlah baris, dan cek sebelum/sesudah
nama semua orang yang me-review kode itu tahun lalu
@why
Peninjau tidak bisa melihat data dari membaca kode. Deskripsi harus menyebut grain dan kontrak tabel, menunjukkan hitungan atau contoh keluaran, dan menjelaskan bagaimana perubahan dicek.
:::

## @lab Lab: ETL tervalidasi, streaming, dan idempoten
Bangun versi produksi dari job pembersihan di Modul 0.2. Ia membaca pesanan KopiKu yang kotor, memvalidasi tiap baris dengan model Pydantic, menulis baris baik dan baris karantina ke file terpisah, tidak pernah menahan file di memori, aman dijalankan dua kali, dan memberi sinyal sukses atau gagal lewat exit code-nya. Tesnya sudah ditulis untuk Anda, dan memeriksa perilaku (memori, eksekusi ulang, kegagalan), bukan hanya nilai.

### @steps
> **Sudah menyelesaikan Jeda Praktik 1–4?** File `labs/mod-1-2/etl.py` Anda sudah selesai, langsung lompat ke Langkah 7 untuk menjalankan verifikasi penuh dan membuat kode bukti Anda.

1. Persiapan di dalam repositori kursus (Anda akan mengedit `labs/mod-1-2/etl.py`). Pasang requirement dan buat datanya:

```bash
python -m pip install -r labs/mod-1-2/requirements.txt
python3 labs/shared/shopgen.py --out data
```

2. Baca dulu `labs/mod-1-2/test_lab.py`. Itulah spesifikasinya. Perhatikan apa yang diperiksanya: hitungan terhadap ground truth generator, memori di bawah 30 MB pada file 120.000 baris, keluaran identik byte demi byte saat dijalankan ulang, keluaran sebelumnya tetap ada saat eksekusi gagal, exit code 0, 1, dan 2.
3. Buka `labs/mod-1-2/etl.py` dan implementasikan, dengan urutan ini, jalankan tes setelah tiap langkah:
   `OrderRow` (constraint dan validator), lalu `validate`, lalu `read_orders` (sebuah generator), lalu `run`, lalu `main`.
4. Di `run`, pakai pola karantina: untuk tiap baris tulis ke keluaran atau tulis `{"row", "reason", "raw"}` ke karantina, dan hitung yang terjadi. Susun alasan dari error validasi pertama (diawali nama field yang gagal). Lakukan pemeriksaan duplikat hanya untuk baris yang lolos validasi.
5. Buat `run` atomik: tulis ke file `f"{output_path}.tmp"` dan `f"{quarantine_path}.tmp"` lalu `os.replace` di akhir; dalam `try/except` hapus file sementara dan lempar ulang pada kegagalan apa pun.
6. Di `main(argv=None)`, parse `input`, `output`, `quarantine`, dan `--max-reject-rate` (default `0.05`) dengan `argparse` (teruskan `argv` ke `parser.parse_args(argv)`). Kembalikan `0` saat sukses, catat error dan kembalikan `1` bila `stats.reject_rate > args.max_reject_rate`, dan kembalikan `2` bila file input tidak bisa dibaca (`OSError`).
7. Jalankan tes, jalankan program pada data asli (menulis ke `/tmp/` agar repositori tetap bersih), lihat karantinanya, dan buat kode bukti Anda:

```bash
pytest labs/mod-1-2 -v
python3 labs/mod-1-2/etl.py data/orders.csv /tmp/clean.ndjson /tmp/quarantine.ndjson; echo "exit code: $?"
head -3 /tmp/quarantine.ndjson
python3 scripts/prove.py mod-1-2
```

8. Tantangan tambahan opsional: tambahkan helper retry dan tes yang memakai `monkeypatch` untuk mensimulasikan dua kegagalan sebelum sukses; tambahkan type hint dan jalankan `mypy`.

### @files
- labs/mod-1-2/etl.py :: File kerja Anda: isi bagian TODO :: starter
- labs/mod-1-2/test_lab.py :: Spesifikasinya, dalam bentuk tes pytest :: test
- labs/mod-1-2/requirements.txt :: Dependensi untuk lab :: config
- labs/shared/labtools.py :: Helper yang memuat modul Anda dan membuat data :: data
- labs/mod-1-2/reference/etl.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- `pytest labs/mod-1-2` lulus (28 tes)
- Menjalankan program pada `data/orders.csv` mencetak baris ringkasan log dan menulis kedua file keluaran
- Anda bisa menjelaskan mengapa tes memori akan gagal bila `read_orders` mengembalikan list

### @verify
```bash
pytest labs/mod-1-2 -v
python3 scripts/prove.py mod-1-2
```

Bandingkan dengan hasil yang sudah benar: `LAB_DIR=reference pytest labs/mod-1-2 -v`. Jika tes memori gagal, kemungkinan Anda menahan semua baris sekaligus; pakai `tracemalloc` seperti di pelajaran untuk menemukan tempatnya.

## @chaos Omset yang kehilangan 1% tanpa error
### @scenario
Sebuah job pandas memuat file pesanan harian dan melaporkan omset. Setelah refactor, semuanya berjalan tanpa error, tetapi tim keuangan memperhatikan dashboard secara konsisten sekitar 1% di bawah angka penyedia pembayaran. Selisihnya tidak membesar atau mengecil dan tidak ada yang bisa menjelaskannya. Tes lulus karena memakai contoh kecil yang bersih.

Baris yang relevan: `df["total_idr"] = pd.to_numeric(df["total_idr"], errors="coerce")`, diikuti `df["total_idr"].sum()`.

### @cause
Sekitar 1% baris asli menulis total sebagai teks seperti `Rp 1.250.000`. Dengan `errors="coerce"`, pandas mengubah nilai yang tidak bisa diurai menjadi **NaN** alih-alih melempar error, dan `sum()` melewati NaN secara bawaan. Baris yang tidak terurai diam-diam menyumbang nol. Pengembang menambahkan `errors="coerce"` untuk menghentikan crash sebelumnya, yang "memperbaiki" gejalanya dan menyembunyikan masalah datanya.

Pipeline itu tidak punya validasi di batas, tidak menghitung nilai yang tak terurai, dan tidak merekonsiliasi dengan total independen.

### @fix
1. Hapus `errors="coerce"`, atau pertahankan hanya jika Anda langsung menghitung dan menangani NaN-nya: `bad = df["total_idr"].isna().sum()`, lalu gagal atau karantina bila `bad > 0`.
2. Urai format yang dikenal secara eksplisit (buang `Rp` dan titik ribuan) dan kirim yang lain ke karantina beserta nilai aslinya.
3. Validasi baris di batas dengan model (seperti di modul ini) sehingga nilai buruk punya nama, posisi, dan alasan.
4. Tambahkan tes memakai baris dengan total berformat mata uang; contoh yang bersih menyembunyikan bug itu justru karena tidak berisi baris jelek.
5. Rekonsiliasi total keluaran dengan sumber independen dan beri alert pada selisih.

### @pattern
Jangan pernah mengubah error menjadi nilai hilang tanpa menghitungnya. Koersi senyap mengubah kegagalan yang keras dan bisa diperbaiki menjadi kehilangan yang sunyi dan permanen.

## @quiz
### Mengapa `read_orders` berbasis generator menjaga memori tetap datar pada file yang sangat besar?
- [ ] Ia mengompresi setiap baris di memori, sehingga seluruh file memakai ruang yang jauh lebih kecil dari biasanya
- [x] Ia menyerahkan satu baris sekali waktu, sehingga hanya baris yang sedang diproses yang ada di memori
- [ ] Ia membaca file di thread latar belakang, yang membebaskan memori yang dipakai thread utama
- [ ] Ia menyimpan baris di file sementara pada disk dan membacanya kembali hanya saat baris itu dicetak

> Generator berjalan sampai `yield`, mengembalikan satu item, lalu berhenti sejenak. Baris yang sudah diproses tidak disimpan, jadi memori bergantung pada satu baris, bukan ukuran file.

### Di Pydantic v2, apa yang memungkinkan `@field_validator("total_idr", mode="before")` untuk Anda lakukan?
- [ ] Melewati validasi field sepenuhnya ketika nilai yang masuk bertipe string
- [ ] Menjalankan fungsi Anda setelah field diurai, sehingga bisa memeriksa integer akhirnya
- [x] Membersihkan masukan mentah sebelum diurai Pydantic, mis. `Rp 1.250.000` jadi `1250000`
- [ ] Menentukan nilai bawaan yang dipakai setiap kali baris masuk tidak memuat field tersebut

> Before-validator menerima nilai mentah, sehingga bisa membuang simbol dan format. Pydantic lalu menjalankan parsing normal dan pemeriksaan constraint pada nilai yang sudah dibersihkan.

### Apa tujuan utama file karantina (dead-letter) dalam pipeline validasi?
- [ ] Membuat pipeline berjalan lebih cepat karena baris yang ditolak tidak perlu diperiksa lagi
- [ ] Menjamin baris yang error diperbaiki otomatis sebelum eksekusi terjadwal berikutnya
- [x] Menyimpan baris ditolak dan alasannya agar tak hilang diam-diam, keluaran tetap bersih
- [ ] Menyimpan salinan cadangan setiap baris valid agar keluaran bisa dibangun ulang setelah crash

> Crash karena satu baris buruk atau membuangnya diam-diam sama-sama pilihan buruk. Karantina mengawetkan bukti untuk diperiksa dan diperbaiki, dan jumlah penolakan bisa memberi alert tentang masalah di hulu.

### Jenis error mana yang sebaiknya diulang job dengan exponential backoff?
- [ ] Baris dengan total negatif, karena percobaan berikutnya mungkin membaca nilai yang berbeda
- [ ] Ketidakcocokan skema antara file dan model, karena bisa saja membaik sendiri semalam
- [x] Timeout jaringan saat memanggil API yang aman untuk dipanggil ulang dengan permintaan sama
- [ ] Syntax error di kode Anda sendiri, yang kadang bisa hilang setelah interpreter dimulai ulang

> Retry membantu untuk kegagalan sementara. Data buruk dan bug bersifat deterministik: masukan yang sama gagal dengan cara yang sama setiap kali. Ulangi juga hanya operasi yang aman diulang.

### Bagaimana membuat keluaran file sebuah job aman dari crash di tengah penulisan?
- [ ] Menulis langsung ke file akhir dan memanggil `flush()` setelah setiap baris yang ditulis
- [x] Menulis ke file sementara lalu memakai `os.replace` untuk memindahkannya saat selesai
- [ ] Membuka file akhir dalam mode append agar isi sebelumnya tidak pernah tertimpa
- [ ] Membungkus loop penulisan dengan `try/except Exception: pass` agar crash tidak pernah dilempar

> Rename di file system yang sama bersifat atomik. Pembaca melihat file lama yang lengkap atau file baru yang lengkap. Crash sebelum rename meninggalkan keluaran lama tidak tersentuh.

### Kode Anda memakai `except Exception: pass` di sekitar parsing tiap baris. Apa risiko utamanya?
- [ ] Interpreter menjadi lebih lambat karena setiap exception harus dibuat dan disimpan
- [ ] Python mengeluarkan peringatan saat start karena penangan exception telanjang tidak diizinkan
- [x] Setiap bug di masa depan pada kode itu tertelan, jadi hasil salah muncul tanpa tanda masalah
- [ ] Program tidak bisa lagi berjalan di container karena exit code tetap nol

> Menelan semua exception mengubah error menjadi kehilangan data yang senyap. Tangkap exception spesifik, tangani dengan sengaja, dan hitung apa yang Anda tangani.

### Apa yang diberikan `pytest.mark.parametrize`?
- [ ] Menjalankan rangkaian tes paralel di seluruh core CPU yang tersedia agar selesai lebih cepat
- [ ] Merekam argumen setiap pemanggilan fungsi agar tes yang gagal bisa diputar ulang
- [x] Menjalankan badan tes yang sama pada tabel masukan dan hasil harapan, satu tes per baris
- [ ] Membuat masukan acak secara otomatis untuk mencari kasus yang tidak bisa ditangani kode Anda

> Parametrisasi ideal untuk aturan pada data berantakan: tambahkan satu baris per kasus alih-alih menyalin tes. Setiap kasus dilaporkan sendiri-sendiri.

### `pd.to_numeric(col, errors="coerce")` diikuti `col.sum()` berbahaya pada data yang belum divalidasi. Mengapa?
- [ ] `coerce` mengubah setiap nilai menjadi string lebih dulu, yang membuat penjumlahan lebih lambat dari biasanya
- [ ] `sum()` melempar exception untuk kolom yang dibuat oleh `to_numeric`
- [x] Nilai yang tidak terurai menjadi NaN, dan `sum()` melewati NaN, sehingga baris itu diam-diam menyumbang nol
- [ ] `to_numeric` mengubah file CSV asli di disk, yang merusak pembacaan data berikutnya

> Error diubah menjadi nilai hilang yang diabaikan agregasi berikutnya. Hitung NaN-nya lalu gagal atau karantina, jangan koersi secara senyap.

## @resources
- [Dokumentasi Pydantic](https://docs.pydantic.dev/latest/)
- [Dokumentasi pytest](https://docs.pytest.org/en/stable/)
- [Dokumen Python: logging HOWTO](https://docs.python.org/3/howto/logging.html)
- [Dokumen Python: itertools](https://docs.python.org/3/library/itertools.html)
- [Dokumen Python: tracemalloc](https://docs.python.org/3/library/tracemalloc.html)
