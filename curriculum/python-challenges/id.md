# Tantangan Python (Indonesia)

Struktur dan id harus sama persis dengan en.md. Kode, ekspresi pemeriksaan, dan jawaban tidak diterjemahkan; yang diterjemahkan hanya judul, soal, pesan, dan petunjuk.

## @challenge b01 | 1 | Dasar
:::drill python Jaga angka tetap dalam rentang
Tulis `clamp(x, lo, hi)`: kembalikan `lo` jika `x` di bawahnya, `hi` jika `x` di atasnya, selain itu `x`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("clamp") ## Definisikan clamp(x, lo, hi).
clamp(5, 0, 10) == 5 ## Di dalam rentang: tidak berubah.
clamp(-3, 0, 10) == 0 ## Di bawah rentang: lo.
clamp(42, 0, 10) == 10 ## Di atas rentang: hi.
clamp(10, 0, 10) == 10 ## Tepat di tepi tidak masalah.
@hint
`min(hi, max(lo, x))`, atau dua pernyataan `if`.
@solution
def clamp(x, lo, hi):
    return min(hi, max(lo, x))
:::

## @challenge b02 | 1 | Dasar
:::drill python Hitung huruf vokal
Tulis `count_vowels(text)`: berapa banyak huruf a, e, i, o, u dalam teks, tanpa membedakan huruf besar atau kecil.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("count_vowels") ## Definisikan count_vowels(text).
count_vowels("Kopi Susu") == 4 ## o, i, u, u.
count_vowels("RHYTHM") == 0 ## Tidak ada vokal sama sekali.
count_vowels("AEIOU aeiou") == 10 ## Huruf kapital juga dihitung.
count_vowels("") == 0 ## Teks kosong.
@hint
Ubah teks ke huruf kecil, lalu hitung karakter yang `in "aeiou"`.
@solution
def count_vowels(text):
    return sum(1 for ch in text.lower() if ch in "aeiou")
:::

## @challenge b03 | 1 | Dasar
:::drill python Baca dari belakang
Tulis `is_palindrome(text)`: `True` jika teks terbaca sama dari depan dan dari belakang, **mengabaikan huruf besar-kecil, spasi, dan tanda baca** (hanya huruf dan angka yang dihitung).
@starter
# tulis fungsimu di bawah baris ini

@check
defines("is_palindrome") ## Definisikan is_palindrome(text).
is_palindrome("Kasur ini rusak") == True ## Spasi dan huruf kapital tidak berpengaruh.
is_palindrome("A man, a plan, a canal: Panama") == True ## Tanda baca tidak berpengaruh.
is_palindrome("kopi") == False ## Bukan palindrom.
is_palindrome("") == True ## Tidak ada yang berbeda dari kedua arah.
@hint
Simpan hanya karakter `ch.isalnum()`, ubah ke huruf kecil, lalu bandingkan dengan versi terbaliknya `s[::-1]`.
@solution
def is_palindrome(text):
    s = "".join(ch.lower() for ch in text if ch.isalnum())
    return s == s[::-1]
:::

## @challenge b04 | 1 | Dasar
:::drill python Uang dengan titik
Tulis `rupiah(n)`: `n` adalah bilangan bulat rupiah. Kembalikan teks dengan titik pemisah ribuan, seperti `"Rp 1.250.000"`. Bilangan negatif mendapat tanda minus di depan: `"-Rp 5.000"`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("rupiah") ## Definisikan rupiah(n).
rupiah(1250000) == "Rp 1.250.000" ## Titik di antara ribuan.
rupiah(999) == "Rp 999" ## Tanpa titik di bawah 1.000.
rupiah(0) == "Rp 0" ## Nol.
rupiah(-5000) == "-Rp 5.000" ## Minus di depan.
@hint
`f"{abs(n):,}"` menghasilkan koma; `.replace(",", ".")` mengubahnya menjadi titik.
@solution
def rupiah(n):
    text = "Rp " + f"{abs(n):,}".replace(",", ".")
    return "-" + text if n < 0 else text
:::

## @challenge b05 | 1 | Dasar
:::drill python Fizz dan buzz
Tulis `fizzbuzz(n)`: sebuah list untuk bilangan 1 sampai `n`. Kelipatan 3 menjadi `"Fizz"`, kelipatan 5 menjadi `"Buzz"`, kelipatan keduanya menjadi `"FizzBuzz"`, bilangan lain tetap berupa bilangan.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("fizzbuzz") ## Definisikan fizzbuzz(n).
fizzbuzz(5) == [1, 2, "Fizz", 4, "Buzz"] ## Lima yang pertama.
fizzbuzz(15)[-1] == "FizzBuzz" ## 15 adalah kelipatan keduanya.
fizzbuzz(0) == [] ## Tidak ada yang dikerjakan.
fizzbuzz(3)[1] == 2 ## Bilangan yang tidak cocok aturan tetap bilangan, bukan teks.
@hint
Uji kelipatan keduanya (`i % 15 == 0`) lebih dulu.
@solution
def fizzbuzz(n):
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(i)
    return out
:::

## @challenge b06 | 1 | Dasar
:::drill python Jumlahkan angkanya
Tulis `digit_sum(n)`: jumlah semua digit dari bilangan bulat `n` (nol atau lebih). `digit_sum(1203)` adalah 6.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("digit_sum") ## Definisikan digit_sum(n).
digit_sum(1203) == 6 ## 1 + 2 + 0 + 3.
digit_sum(0) == 0 ## Nol.
digit_sum(999) == 27 ## 9 + 9 + 9.
digit_sum(7) == 7 ## Satu digit.
@hint
`str(n)` memberi digit sebagai karakter; `int(ch)` mengubah satu karakter kembali menjadi angka.
@solution
def digit_sum(n):
    return sum(int(ch) for ch in str(n))
:::

## @challenge b07 | 1 | Dasar
:::drill python Rapikan sebuah nama
Tulis `tidy_name(text)`: hapus spasi berlebih (di ujung dan antar kata) dan beri huruf kapital di awal tiap kata: `"  sari   wulan "` menjadi `"Sari Wulan"`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("tidy_name") ## Definisikan tidy_name(text).
tidy_name("  sari   wulan ") == "Sari Wulan" ## Spasi berlebih hilang, kapital ditambahkan.
tidy_name("BUDI") == "Budi" ## Hanya huruf pertama yang tetap kapital.
tidy_name("") == "" ## Tidak ada masukan, tidak ada keluaran.
tidy_name("andi p. kusuma") == "Andi P. Kusuma" ## Berlaku untuk jumlah kata berapa pun.
@hint
`text.split()` memecah pada spasi sebanyak apa pun; `" ".join(...)` menyambung kata dengan satu spasi.
@solution
def tidy_name(text):
    return " ".join(word.capitalize() for word in text.split())
:::

## @challenge b08 | 1 | Dasar
:::drill python Rata-rata, dengan aman
Tulis `average(nums)`: rata-rata sebuah list angka, atau `None` bila list kosong (bukan error).
@starter
# tulis fungsimu di bawah baris ini

@check
defines("average") ## Definisikan average(nums).
average([2, 4, 6]) == 4 ## Rata-rata 2, 4, dan 6.
average([5]) == 5 ## Satu angka.
average([]) is None ## Tidak ada yang dirata-ratakan.
average([1, 2]) == 1.5 ## Hasil boleh berdesimal.
@hint
Periksa `if not nums:` dulu, lalu `sum(nums) / len(nums)`.
@solution
def average(nums):
    if not nums:
        return None
    return sum(nums) / len(nums)
:::

## @challenge c01 | 2 | Koleksi
:::drill python Hapus duplikat, pertahankan urutan
Tulis `dedupe(items)`: list baru dengan tiap nilai satu kali, menurut urutan kemunculan **pertamanya**.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("dedupe") ## Definisikan dedupe(items).
dedupe([3, 1, 3, 2, 1]) == [3, 1, 2] ## Kemunculan pertama, berurutan.
dedupe([]) == [] ## List kosong.
dedupe(["a", "a", "a"]) == ["a"] ## Semuanya sama.
(lambda xs: (dedupe(xs), xs)[1])([1, 1]) == [1, 1] ## List asli tidak berubah.
@hint
Simpan set `seen` dan list hasil; tambahkan hanya jika nilainya belum ada di `seen`.
@solution
def dedupe(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
:::

## @challenge c02 | 2 | Koleksi
:::drill python Yang teratas
Tulis `top_n(counts, n)`: `counts` memetakan nama ke angka. Kembalikan `n` nama dengan angka terbesar, terbesar dulu. Jika dua nama punya angka sama, yang lebih dulu menurut abjad didahulukan.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("top_n") ## Definisikan top_n(counts, n).
top_n({"a": 5, "b": 9, "c": 1}, 2) == ["b", "a"] ## Dua terbesar.
top_n({"x": 3, "b": 3, "m": 3}, 2) == ["b", "m"] ## Seri: urut abjad.
top_n({"a": 1}, 5) == ["a"] ## Meminta lebih banyak daripada yang ada.
top_n({}, 3) == [] ## Tidak ada yang diurutkan.
@hint
`sorted(counts, key=lambda name: (-counts[name], name))[:n]`
@solution
def top_n(counts, n):
    return sorted(counts, key=lambda name: (-counts[name], name))[:n]
:::

## @challenge c03 | 2 | Koleksi
:::drill python Tukar kunci dan nilai
Tulis `invert(d)`: dictionary baru yang setiap nilai `d`-nya menjadi kunci dan setiap kuncinya menjadi nilai. (Semua nilai `d` berbeda.)
@starter
# tulis fungsimu di bawah baris ini

@check
defines("invert") ## Definisikan invert(d).
invert({"a": 1, "b": 2}) == {1: "a", 2: "b"} ## Kunci dan nilai tertukar.
invert({}) == {} ## Kosong.
invert({"paid": "P"}) == {"P": "paid"} ## Berlaku juga untuk nilai teks.
@hint
`{value: key for key, value in d.items()}`
@solution
def invert(d):
    return {value: key for key, value in d.items()}
:::

## @challenge c04 | 2 | Koleksi
:::drill python Hitung kata-katanya
Tulis `count_words(text)`: dictionary yang menghitung tiap kata dalam teks, tanpa membedakan huruf besar atau kecil. Kata dipisah spasi.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("count_words") ## Definisikan count_words(text).
count_words("a b a") == {"a": 2, "b": 1} ## a dua kali, b sekali.
count_words("Kopi kopi KOPI") == {"kopi": 3} ## Huruf kapital tidak berpengaruh.
count_words("") == {} ## Tidak ada kata.
count_words("x") == {"x": 1} ## Satu kata.
@hint
Ulangi `text.lower().split()` dan pakai `counts[w] = counts.get(w, 0) + 1`.
@solution
def count_words(text):
    counts = {}
    for w in text.lower().split():
        counts[w] = counts.get(w, 0) + 1
    return counts
:::

## @challenge c05 | 2 | Koleksi
:::drill python Satu list datar
Tulis `flatten(lists)`: `lists` adalah list berisi list. Kembalikan satu list dengan semua itemnya secara berurutan.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("flatten") ## Definisikan flatten(lists).
flatten([[1, 2], [3], [4, 5]]) == [1, 2, 3, 4, 5] ## Digabung berurutan.
flatten([]) == [] ## Tidak ada list.
flatten([[], [1], []]) == [1] ## List kosong tidak masalah.
flatten([["a"]]) == ["a"] ## Berlaku untuk teks.
@hint
`[x for sub in lists for x in sub]`
@solution
def flatten(lists):
    return [x for sub in lists for x in sub]
:::

## @challenge c06 | 2 | Koleksi
:::drill python Potong menjadi batch
Tulis `chunks(items, size)`: list berisi list, masing-masing berisi hingga `size` item, berurutan. Yang terakhir boleh lebih pendek.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("chunks") ## Definisikan chunks(items, size).
chunks([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]] ## Batch terakhir lebih pendek.
chunks([1, 2], 5) == [[1, 2]] ## Hanya satu batch.
chunks([], 3) == [] ## Tanpa item, tanpa batch.
chunks([1, 2, 3, 4], 2) == [[1, 2], [3, 4]] ## Pas tepat.
@hint
`range(0, len(items), size)` memberi awal tiap batch; potong `items[i:i + size]`.
@solution
def chunks(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]
:::

## @challenge c07 | 2 | Koleksi
:::drill python Dua list menjadi satu dictionary
Tulis `to_dict(keys, values)`: pasangkan keduanya menjadi dictionary. Jika satu list lebih panjang, abaikan item kelebihannya.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("to_dict") ## Definisikan to_dict(keys, values).
to_dict(["a", "b"], [1, 2]) == {"a": 1, "b": 2} ## Dipasangkan.
to_dict(["a", "b", "c"], [1, 2]) == {"a": 1, "b": 2} ## Kunci berlebih diabaikan.
to_dict([], [1]) == {} ## Tidak ada yang dipasangkan.
to_dict(["x"], ["y", "z"]) == {"x": "y"} ## Nilai berlebih diabaikan.
@hint
`dict(zip(keys, values))`: `zip` berhenti pada list yang lebih pendek.
@solution
def to_dict(keys, values):
    return dict(zip(keys, values))
:::

## @challenge c08 | 2 | Koleksi
:::drill python Gabungkan dua dictionary
Tulis `merge(a, b)`: dictionary **baru** dengan semua kunci keduanya. Jika sebuah kunci ada di keduanya, nilai dari `b` yang menang. Jangan ubah `a` atau `b`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("merge") ## Definisikan merge(a, b).
merge({"x": 1}, {"y": 2}) == {"x": 1, "y": 2} ## Kedua kunci tersimpan.
merge({"x": 1}, {"x": 9}) == {"x": 9} ## b menang.
(lambda a: (merge(a, {"z": 0}), a)[1])({"q": 1}) == {"q": 1} ## a tidak berubah.
merge({}, {}) == {} ## Kosong.
@hint
`{**a, **b}` membangun dictionary baru; kunci yang datang belakangan menang.
@solution
def merge(a, b):
    return {**a, **b}
:::

## @challenge c09 | 2 | Koleksi
:::drill python Urutkan pesanan
Tulis `sort_orders(orders)`: `orders` adalah list dictionary berisi `id` dan `total`. Kembalikan list **id**, dengan total terbesar lebih dulu. Jika total sama, id yang lebih kecil lebih dulu.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("sort_orders") ## Definisikan sort_orders(orders).
sort_orders([{"id": 2, "total": 50}, {"id": 1, "total": 90}]) == [1, 2] ## Total terbesar lebih dulu.
sort_orders([{"id": 5, "total": 10}, {"id": 3, "total": 10}]) == [3, 5] ## Seri: id lebih kecil dulu.
sort_orders([]) == [] ## Tanpa pesanan.
sort_orders([{"id": 1, "total": 7}]) == [1] ## Satu pesanan.
@hint
Urutkan dengan `key=lambda o: (-o["total"], o["id"])`, lalu ambil id-nya.
@solution
def sort_orders(orders):
    ordered = sorted(orders, key=lambda o: (-o["total"], o["id"]))
    return [o["id"] for o in ordered]
:::

## @challenge c10 | 2 | Koleksi
:::drill python Apa yang sama?
Tulis `common(a, b)`: nilai yang ada di **kedua** list, masing-masing sekali, sebagai list terurut.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("common") ## Definisikan common(a, b).
common([1, 2, 3, 3], [3, 2, 9]) == [2, 3] ## Nilai yang sama, sekali, terurut.
common([1], [2]) == [] ## Tidak ada yang sama.
common([], [1]) == [] ## Satu list kosong.
common(["b", "a"], ["a", "b"]) == ["a", "b"] ## Berlaku untuk teks.
@hint
Set dibuat untuk ini: `sorted(set(a) & set(b))`.
@solution
def common(a, b):
    return sorted(set(a) & set(b))
:::

## @challenge d01 | 3 | Fungsi dan error
:::drill python Angka atau cadangan
Tulis `safe_int(text, default=0)`: ubah teks menjadi bilangan bulat; jika tidak bisa, kembalikan `default`. Jangan biarkan error lolos.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("safe_int") ## Definisikan safe_int(text, default=0).
safe_int("42") == 42 ## Angka yang benar.
safe_int(" 7 ") == 7 ## Spasi di sekitar angka tidak masalah.
safe_int("abc") == 0 ## Bukan angka: nilai default.
safe_int("4.5", -1) == -1 ## Desimal bukan bilangan bulat: default buatanmu sendiri.
safe_int("") == 0 ## Teks kosong.
@hint
`try:` `return int(text)` `except ValueError:` `return default`
@solution
def safe_int(text, default=0):
    try:
        return int(text)
    except ValueError:
        return default
:::

## @challenge d02 | 3 | Fungsi dan error
:::drill python Di mana letaknya?
Tulis `first_index(items, target)`: posisi `target` pertama dalam list, atau `-1` bila tidak ada. (Jangan pakai `.index`, yang melempar error.)
@starter
# tulis fungsimu di bawah baris ini

@check
defines("first_index") ## Definisikan first_index(items, target).
first_index(["a", "b", "c"], "b") == 1 ## Ditemukan di posisi 1.
first_index([4, 4, 4], 4) == 0 ## Yang pertama.
first_index([1, 2], 9) == -1 ## Tidak ditemukan.
first_index([], 1) == -1 ## List kosong.
@hint
`for i, x in enumerate(items):` memberi posisi dan nilai sekaligus.
@solution
def first_index(items, target):
    for i, x in enumerate(items):
        if x == target:
            return i
    return -1
:::

## @challenge d03 | 3 | Fungsi dan error
:::drill python Argumen sebanyak apa pun
Tulis `total(*numbers)`: jumlahkan angka sebanyak apa pun yang diberikan: `total(1, 2, 3)` adalah 6. Tanpa angka hasilnya 0.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("total") ## Definisikan total(*numbers).
total(1, 2, 3) == 6 ## Tiga angka.
total() == 0 ## Tanpa angka.
total(5) == 5 ## Satu angka.
total(0.5, 0.5) == 1.0 ## Desimal berfungsi.
@hint
Parameter yang ditulis `*numbers` mengumpulkan semua argumen tambahan dalam sebuah tuple; `sum(numbers)` menjumlahkannya.
@solution
def total(*numbers):
    return sum(numbers)
:::

## @challenge d04 | 3 | Fungsi dan error
:::drill python Coba lagi
Tulis `retry(fn, times)`: panggil `fn()` hingga `times` kali. Kembalikan hasilnya pada saat pertama berhasil. Jika setiap percobaan melempar error, lemparkan error **terakhir**.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("retry") ## Definisikan retry(fn, times).
retry(lambda: 5, 3) == 5 ## Langsung berhasil.
(lambda c: retry(lambda: (c.append(1), 1 / 0 if len(c) < 3 else "ok")[1], 5))([]) == "ok" ## Gagal dua kali, berhasil pada yang ketiga.
raises_error(ZeroDivisionError, retry, lambda: 1 / 0, 2) == True ## Selalu gagal: error dilemparkan pada akhirnya.
(lambda c: (raises_error(ValueError, retry, lambda: (c.append(1), int("x"))[1], 4), len(c))[1])([]) == 4 ## Ia benar-benar mencoba 4 kali.
@hint
Ulangi `for attempt in range(times)`; `try: return fn()`; `except Exception as e: last = e`; setelah loop `raise last`.
@solution
def retry(fn, times):
    last = None
    for attempt in range(times):
        try:
            return fn()
        except Exception as e:
            last = e
    raise last
:::

## @challenge d05 | 3 | Fungsi dan error
:::drill python Baca baris pengaturan
Tulis `parse_kv(text)`: teksnya seperti `"a=1;b=2"`. Kembalikan `{"a": "1", "b": "2"}`. Lewati potongan kosong. Hanya tanda `=` **pertama** yang memisah, jadi `"url=x=y"` menghasilkan `{"url": "x=y"}`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("parse_kv") ## Definisikan parse_kv(text).
parse_kv("a=1;b=2") == {"a": "1", "b": "2"} ## Dua pengaturan.
parse_kv("") == {} ## Tidak ada.
parse_kv("a=1;;b=2;") == {"a": "1", "b": "2"} ## Potongan kosong dilewati.
parse_kv("url=x=y") == {"url": "x=y"} ## Hanya = pertama yang memisah.
@hint
`piece.split("=", 1)` memisah paling banyak satu kali.
@solution
def parse_kv(text):
    out = {}
    for piece in text.split(";"):
        if piece:
            key, value = piece.split("=", 1)
            out[key] = value
    return out
:::

## @challenge d06 | 3 | Fungsi dan error
:::drill python Jebakan list bersama
Tulis `add_item(item, bucket=None)`: kembalikan list **baru** berisi `bucket` (list kosong bila tak diberikan) dengan `item` ditambahkan di akhir. Memanggilnya dua kali tanpa bucket harus menghasilkan dua list terpisah. (Jangan pernah memakai `[]` sebagai nilai default.)
@starter
# tulis fungsimu di bawah baris ini

@check
defines("add_item") ## Definisikan add_item(item, bucket=None).
add_item(1) == [1] ## Memulai list baru.
(add_item(1), add_item(2))[1] == [2] ## Panggilan kedua tidak mengingat yang pertama.
add_item(3, [1, 2]) == [1, 2, 3] ## Menambah ke list yang kamu berikan.
(lambda b: (add_item(9, b), b)[1])([1]) == [1] ## List yang kamu berikan tidak diubah.
@hint
`if bucket is None: bucket = []`, lalu kembalikan `bucket + [item]`.
@solution
def add_item(item, bucket=None):
    if bucket is None:
        bucket = []
    return bucket + [item]
:::

## @challenge d07 | 3 | Fungsi dan error
:::drill python Rekatkan dua fungsi
Tulis `compose(f, g)`: kembalikan fungsi baru yang, diberi `x`, mengembalikan `f(g(x))`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("compose") ## Definisikan compose(f, g).
compose(lambda x: x + 1, lambda x: x * 2)(5) == 11 ## g dulu (10), lalu f (11).
compose(str.upper, str.strip)("  hi ") == "HI" ## Berlaku untuk fungsi apa pun.
compose(len, str)(12345) == 5 ## str dulu, lalu len.
compose(abs, abs)(-3) == 3 ## Fungsi yang sama dua kali.
@hint
Definisikan fungsi kecil di dalam `compose` lalu kembalikan (jangan dipanggil).
@solution
def compose(f, g):
    def combined(x):
        return f(g(x))
    return combined
:::

## @challenge d08 | 3 | Fungsi dan error
:::drill python Tolak nilai yang buruk
Tulis `validate_age(age)`: kembalikan `age` jika ia bilangan bulat dari 0 sampai 120. Selain itu **lemparkan** `ValueError`. (Nilai buruk harus menghentikan program, bukan lolos.)
@starter
# tulis fungsimu di bawah baris ini

@check
defines("validate_age") ## Definisikan validate_age(age).
validate_age(30) == 30 ## Umur yang benar dikembalikan.
validate_age(0) == 0 ## 0 diperbolehkan.
raises_error(ValueError, validate_age, 200) == True ## Terlalu besar: ValueError.
raises_error(ValueError, validate_age, -1) == True ## Negatif: ValueError.
raises_error(ValueError, validate_age, "30") == True ## Teks bukan bilangan bulat: ValueError.
@hint
Periksa `isinstance(age, int)` dan `0 <= age <= 120`; jika gagal, `raise ValueError("...")`.
@solution
def validate_age(age):
    if not isinstance(age, int) or not 0 <= age <= 120:
        raise ValueError("age must be a whole number from 0 to 120")
    return age
:::

## @challenge e01 | 4 | Pola data
:::drill python Total berjalan
Tulis `running_total(nums)`: list yang tiap itemnya adalah jumlah semua angka sampai dan termasuk posisi itu: `[1, 2, 3]` menghasilkan `[1, 3, 6]`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("running_total") ## Definisikan running_total(nums).
running_total([1, 2, 3]) == [1, 3, 6] ## Jumlah kumulatif.
running_total([]) == [] ## Kosong.
running_total([5, -5, 5]) == [5, 0, 5] ## Angka negatif juga.
running_total([10]) == [10] ## Satu angka.
@hint
Simpan variabel `total`, tambahkan tiap angka ke dalamnya, dan tambahkan total itu ke hasil.
@solution
def running_total(nums):
    total = 0
    out = []
    for x in nums:
        total += x
        out.append(total)
    return out
:::

## @challenge e02 | 4 | Pola data
:::drill python Baris terbaru per kunci
Tulis `latest_per_key(rows)`: `rows` adalah list `(key, timestamp, value)`. Kembalikan dictionary yang memetakan tiap key ke value dari barisnya dengan **timestamp terbesar**. (Baris bisa berada dalam urutan apa pun.)
@starter
# tulis fungsimu di bawah baris ini

@check
defines("latest_per_key") ## Definisikan latest_per_key(rows).
latest_per_key([("a", 1, "x"), ("a", 3, "z"), ("a", 2, "y")]) == {"a": "z"} ## Timestamp terbesar menang.
latest_per_key([("a", 1, 10), ("b", 5, 20)]) == {"a": 10, "b": 20} ## Tiap kunci sendiri-sendiri.
latest_per_key([]) == {} ## Tanpa baris.
latest_per_key([("k", 2, "late"), ("k", 1, "early")]) == {"k": "late"} ## Urutan dalam list tidak berpengaruh.
@hint
Simpan dictionary `key -> (timestamp, value)` dan ganti hanya bila timestamp baru lebih besar.
@solution
def latest_per_key(rows):
    best = {}
    for key, ts, value in rows:
        if key not in best or ts > best[key][0]:
            best[key] = (ts, value)
    return {key: pair[1] for key, pair in best.items()}
:::

## @challenge e03 | 4 | Pola data
:::drill python Pecah menjadi sesi
Tulis `sessionize(times, gap)`: `times` adalah list detik berupa bilangan bulat. Urutkan, lalu mulai **sesi baru** setiap kali jarak dari event sebelumnya **lebih dari** `gap`. Kembalikan sesi sebagai list berisi list.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("sessionize") ## Definisikan sessionize(times, gap).
sessionize([1, 2, 10, 11], 5) == [[1, 2], [10, 11]] ## Jarak 8 memulai sesi baru.
sessionize([10, 1, 2], 5) == [[1, 2], [10]] ## Masukan tak terurut berfungsi.
sessionize([1, 6], 5) == [[1, 6]] ## Jarak tepat 5 bukan lebih dari 5.
sessionize([], 5) == [] ## Tanpa event.
@hint
Ulangi `sorted(times)`. Mulai list dalam baru bila `t - previous > gap`, selain itu tambahkan ke yang terakhir.
@solution
def sessionize(times, gap):
    sessions = []
    for t in sorted(times):
        if sessions and t - sessions[-1][-1] <= gap:
            sessions[-1].append(t)
        else:
            sessions.append([t])
    return sessions
:::

## @challenge e04 | 4 | Pola data
:::drill python Nama kolom dalam snake_case
Tulis `to_snake(text)`: ubah teks ke huruf kecil, ubah setiap deretan karakter yang bukan huruf atau angka menjadi satu `_`, dan buang `_` di ujung. `"Total (IDR)"` menjadi `"total_idr"`.
@starter
import re
# tulis fungsimu di bawah baris ini

@check
defines("to_snake") ## Definisikan to_snake(text).
to_snake("Order ID") == "order_id" ## Spasi menjadi garis bawah.
to_snake("Total (IDR)") == "total_idr" ## Kurung dan spasi menjadi satu garis bawah, tanpa yang di ujung.
to_snake("  already_snake ") == "already_snake" ## Spasi di ujung dibuang.
to_snake("A--B") == "a_b" ## Deretan simbol menjadi satu garis bawah.
@hint
`re.sub(r"[^a-z0-9]+", "_", text.lower())` lalu `.strip("_")`.
@solution
import re
def to_snake(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
:::

## @challenge e05 | 4 | Pola data
:::drill python Ratakan JSON bersarang
Tulis `flatten_json(d)`: ubah dictionary bersarang menjadi satu tingkat, dengan kunci digabung titik: `{"a": {"b": 1}}` menjadi `{"a.b": 1}`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("flatten_json") ## Definisikan flatten_json(d).
flatten_json({"a": {"b": 1}}) == {"a.b": 1} ## Dua tingkat.
flatten_json({"x": 1, "y": {"z": 2, "w": {"v": 3}}}) == {"x": 1, "y.z": 2, "y.w.v": 3} ## Tiga tingkat.
flatten_json({}) == {} ## Kosong.
flatten_json({"a": []}) == {"a": []} ## List adalah nilai, tidak diratakan.
@hint
Ulangi item-itemnya. Jika nilainya dictionary, panggil `flatten_json` padanya dan tambahkan awalan `key + "."` ke tiap kuncinya.
@solution
def flatten_json(d):
    out = {}
    for key, value in d.items():
        if isinstance(value, dict):
            for inner_key, inner_value in flatten_json(value).items():
                out[key + "." + inner_key] = inner_value
        else:
            out[key] = value
    return out
:::

## @challenge e06 | 4 | Pola data
:::drill python Masuk keranjang yang mana?
Tulis `bucket_of(value, edges)`: `edges` adalah list terurut seperti `[10, 100]`. Kembalikan jumlah tepi yang **lebih kecil atau sama dengan** `value`: itulah nomor keranjang (0 berarti di bawah tepi pertama).
@starter
import bisect
# tulis fungsimu di bawah baris ini

@check
defines("bucket_of") ## Definisikan bucket_of(value, edges).
bucket_of(5, [10, 100]) == 0 ## Di bawah tepi pertama.
bucket_of(10, [10, 100]) == 1 ## Tepi itu sendiri masuk keranjang atas.
bucket_of(99, [10, 100]) == 1 ## Di antara tepi.
bucket_of(100, [10, 100]) == 2 ## Di tepi terakhir.
bucket_of(7, []) == 0 ## Tanpa tepi: semuanya di keranjang 0.
@hint
`bisect.bisect_right(edges, value)` menghitung persis itu.
@solution
import bisect
def bucket_of(value, edges):
    return bisect.bisect_right(edges, value)
:::

## @challenge e07 | 4 | Pola data
:::drill python Sisipkan atau ganti
Tulis `upsert(table, rows, key)`: `table` dan `rows` adalah list dictionary; `key` menyebut field yang mengenali sebuah baris. Kembalikan list **baru**: baris dengan kunci yang sudah ada di tabel **menggantikan**nya (posisi sama); kunci baru ditambahkan di akhir. Jangan ubah `table`.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("upsert") ## Definisikan upsert(table, rows, key).
upsert([{"id": 1, "v": "a"}], [{"id": 1, "v": "b"}], "id") == [{"id": 1, "v": "b"}] ## Diganti.
upsert([{"id": 1, "v": "a"}], [{"id": 2, "v": "b"}], "id") == [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}] ## Ditambah di akhir.
upsert([], [{"id": 1}, {"id": 1}], "id") == [{"id": 1}] ## Kunci sama dua kali dalam rows menghasilkan satu baris.
(lambda t: (upsert(t, [{"id": 1, "v": "z"}], "id"), t)[1])([{"id": 1, "v": "a"}]) == [{"id": 1, "v": "a"}] ## Tabel tidak berubah.
@hint
Salin tabel, catat posisi tiap kunci dalam dictionary, lalu ganti atau tambahkan untuk setiap baris baru.
@solution
def upsert(table, rows, key):
    out = list(table)
    position = {row[key]: i for i, row in enumerate(out)}
    for row in rows:
        if row[key] in position:
            out[position[row[key]]] = row
        else:
            position[row[key]] = len(out)
            out.append(row)
    return out
:::

## @challenge e08 | 4 | Pola data
:::drill python Rata-rata bergerak
Tulis `moving_avg(nums, k)`: rata-rata dari setiap jendela **penuh** berisi `k` angka berturutan. Untuk 5 angka dan `k = 3` ada 3 jendela. Jika angkanya kurang dari `k`, kembalikan list kosong.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("moving_avg") ## Definisikan moving_avg(nums, k).
moving_avg([1, 2, 3, 4, 5], 3) == [2, 3, 4] ## Tiga jendela.
moving_avg([10, 20], 2) == [15] ## Satu jendela.
moving_avg([1, 2], 3) == [] ## Angka lebih sedikit daripada jendela.
moving_avg([4], 1) == [4] ## Jendela satu.
@hint
`for i in range(len(nums) - k + 1)` memberi awal tiap jendela; rata-ratakan `nums[i:i + k]`.
@solution
def moving_avg(nums, k):
    return [sum(nums[i:i + k]) / k for i in range(len(nums) - k + 1)]
:::

## @challenge e09 | 4 | Pola data
:::drill python Baris CSV dengan tanda kutip
Tulis `split_csv_line(line)`: pecah satu baris CSV menjadi field-fieldnya. Field dalam tanda kutip ganda boleh berisi koma: `'a,"b,c",d'` punya tiga field. Pakai modul `csv` standar, bukan `split(",")`.
@starter
import csv
# tulis fungsimu di bawah baris ini

@check
defines("split_csv_line") ## Definisikan split_csv_line(line).
split_csv_line("a,b,c") == ["a", "b", "c"] ## Baris sederhana.
split_csv_line('a,"b,c",d') == ["a", "b,c", "d"] ## Koma di dalam kutip tidak memisah.
split_csv_line('x,"say ""hi""",y') == ["x", 'say "hi"', "y"] ## Kutip ganda berarti satu kutip.
calls("reader") == True ## Kamu memakai csv.reader.
@hint
`next(csv.reader([line]))` membaca satu baris dan mengembalikan field-fieldnya sebagai list.
@solution
import csv
def split_csv_line(line):
    return next(csv.reader([line]))
:::

## @challenge e10 | 4 | Pola data
:::drill python Pivot kecil
Tulis `pivot(rows)`: `rows` adalah list `(city, status, count)`. Kembalikan dictionary berisi dictionary: `{city: {status: total}}`, menjumlahkan count bila kota dan status yang sama muncul lebih dari sekali.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("pivot") ## Definisikan pivot(rows).
pivot([("JKT", "paid", 2), ("JKT", "cancelled", 1)]) == {"JKT": {"paid": 2, "cancelled": 1}} ## Satu kota, dua status.
pivot([("JKT", "paid", 2), ("JKT", "paid", 3)]) == {"JKT": {"paid": 5}} ## Pasangan berulang dijumlahkan.
pivot([("A", "x", 1), ("B", "x", 4)]) == {"A": {"x": 1}, "B": {"x": 4}} ## Dua kota.
pivot([]) == {} ## Tidak ada.
@hint
`out.setdefault(city, {})` memberi dictionary dalam; lalu `inner[status] = inner.get(status, 0) + count`.
@solution
def pivot(rows):
    out = {}
    for city, status, count in rows:
        inner = out.setdefault(city, {})
        inner[status] = inner.get(status, 0) + count
    return out
:::

## @challenge f01 | 5 | Objek dan rekursi
:::drill python Bangun sebuah stack
Tulis class `Stack` dengan `push(x)`, `pop()` (mengembalikan item yang terakhir dimasukkan), `peek()` (melihatnya tanpa mengeluarkan), dan `len(stack)` (jumlah item). `pop()` atau `peek()` pada stack kosong melempar `IndexError`.
@starter
# tulis class-mu di bawah baris ini

@check
defines("Stack") ## Definisikan class Stack.
(lambda s: (s.push(1), s.push(2), s.pop())[-1])(Stack()) == 2 ## Terakhir masuk, pertama keluar.
(lambda s: (s.push(1), s.push(2), s.peek(), len(s))[-1])(Stack()) == 2 ## peek tidak mengeluarkan.
(lambda s: (s.push("a"), s.pop(), len(s))[-1])(Stack()) == 0 ## Kosong lagi setelah pop.
raises_error(IndexError, Stack().pop) == True ## Pop pada yang kosong: IndexError.
raises_error(IndexError, Stack().peek) == True ## Peek pada yang kosong: IndexError.
@hint
Simpan list di `self.items` (dibuat di `__init__`). Definisikan `__len__` agar `len(stack)` berfungsi.
@solution
class Stack:
    def __init__(self):
        self.items = []

    def push(self, x):
        self.items.append(x)

    def pop(self):
        return self.items.pop()

    def peek(self):
        return self.items[-1]

    def __len__(self):
        return len(self.items)
:::

## @challenge f02 | 5 | Objek dan rekursi
:::drill python Sebuah penghitung
Tulis class `Tally` dengan `add(x)` (hitung satu lagi untuk `x`), `count(x)` (berapa banyak sejauh ini, 0 bila tak pernah ditambah), dan `most_common()` (item dengan hitungan tertinggi; bila seri, yang pertama menurut abjad; `None` bila kosong).
@starter
# tulis class-mu di bawah baris ini

@check
defines("Tally") ## Definisikan class Tally.
(lambda t: (t.add("a"), t.add("a"), t.add("b"), t.count("a"))[-1])(Tally()) == 2 ## a ditambahkan dua kali.
Tally().count("zzz") == 0 ## Tak pernah ditambah: 0.
(lambda t: (t.add("b"), t.add("a"), t.most_common())[-1])(Tally()) == "a" ## Seri: urut abjad.
(lambda t: (t.add("x"), t.add("y"), t.add("y"), t.most_common())[-1])(Tally()) == "y" ## Hitungan tertinggi.
Tally().most_common() is None ## Kosong: None.
@hint
Simpan dictionary di `self.counts`. Untuk `most_common`, `min(self.counts, key=lambda k: (-self.counts[k], k))`.
@solution
class Tally:
    def __init__(self):
        self.counts = {}

    def add(self, x):
        self.counts[x] = self.counts.get(x, 0) + 1

    def count(self, x):
        return self.counts.get(x, 0)

    def most_common(self):
        if not self.counts:
            return None
        return min(self.counts, key=lambda k: (-self.counts[k], k))
:::

## @challenge f03 | 5 | Objek dan rekursi
:::drill python Jumlahkan list bersarang
Tulis `sum_nested(x)`: `x` adalah sebuah angka, atau list yang boleh berisi angka dan list lain, sedalam apa pun. Kembalikan jumlah semua angkanya. Pakai rekursi.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("sum_nested") ## Definisikan sum_nested(x).
sum_nested(5) == 5 ## Satu angka.
sum_nested([1, [2, 3], [[4]]]) == 10 ## List di dalam list.
sum_nested([]) == 0 ## List kosong.
sum_nested([[], [[]], 7]) == 7 ## List kosong di dalamnya.
@hint
Jika `x` adalah list, kembalikan `sum(sum_nested(item) for item in x)`; jika bukan, kembalikan `x`.
@solution
def sum_nested(x):
    if isinstance(x, list):
        return sum(sum_nested(item) for item in x)
    return x
:::

## @challenge f04 | 5 | Objek dan rekursi
:::drill python Seberapa dalam?
Tulis `depth(d)`: berapa tingkat dictionary yang ada. `{}` dan `{"a": 1}` berkedalaman 1; `{"a": {"b": 2}}` berkedalaman 2.
@starter
# tulis fungsimu di bawah baris ini

@check
defines("depth") ## Definisikan depth(d).
depth({}) == 1 ## Dictionary kosong adalah satu tingkat.
depth({"a": 1}) == 1 ## Satu tingkat.
depth({"a": {"b": 2}}) == 2 ## Dua tingkat.
depth({"a": 1, "b": {"c": {"d": 3}}}) == 3 ## Cabang terdalam yang dihitung.
@hint
`1 + max((depth(v) for v in d.values() if isinstance(v, dict)), default=0)`
@solution
def depth(d):
    return 1 + max((depth(v) for v in d.values() if isinstance(v, dict)), default=0)
:::

## @challenge f05 | 5 | Objek dan rekursi
:::drill python Generator batch
Tulis `batches(items, size)` sebagai **generator** (dengan `yield`): ia membagikan list berisi hingga `size` item satu per satu, sehingga tidak pernah membangun semua batch sekaligus.
@starter
# tulis generator-mu di bawah baris ini

@check
defines("batches") ## Definisikan batches(items, size).
list(batches([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]] ## Batch-batchnya, satu per satu.
list(batches([], 3)) == [] ## Tanpa item, tanpa batch.
hasattr(batches([1], 1), "__next__") == True ## Ia generator, bukan list.
next(batches(range(10), 4)) == [0, 1, 2, 3] ## Berfungsi juga untuk iterable apa pun, seperti range.
@hint
Kumpulkan item di list `batch`; `yield batch` saat isinya `size` item lalu mulai yang baru; setelah loop, yield sisanya.
@solution
def batches(items, size):
    batch = []
    for x in items:
        batch.append(x)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
:::

## @challenge f06 | 5 | Objek dan rekursi
:::drill python Hitung pemanggilan
Tulis `count_calls(fn)`: sebuah **decorator** yang mengembalikan fungsi baru yang memanggil `fn` dengan argumen yang sama dan memberi hasilnya, serta menyimpan jumlah pemanggilan sejauh ini di `wrapper.calls`.
@starter
# tulis decorator-mu di bawah baris ini

@check
defines("count_calls") ## Definisikan count_calls(fn).
(lambda f: (f(), f(), f.calls)[-1])(count_calls(lambda: 1)) == 2 ## Dua pemanggilan terhitung.
count_calls(lambda a, b: a + b)(2, 3) == 5 ## Hasil dan argumen diteruskan.
count_calls(lambda: 1).calls == 0 ## Mulai dari nol.
(lambda f: (f(x=4), f.calls)[-1])(count_calls(lambda x: x)) == 1 ## Argumen bernama juga berfungsi.
@hint
Definisikan `wrapper(*args, **kwargs)` di dalamnya; tambah 1 pada `wrapper.calls`, lalu `return fn(*args, **kwargs)`. Atur `wrapper.calls = 0` sebelum mengembalikan `wrapper`.
@solution
def count_calls(fn):
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return fn(*args, **kwargs)
    wrapper.calls = 0
    return wrapper
:::

## @challenge f07 | 5 | Objek dan rekursi
:::drill python Class Money
Tulis class `Money` yang dibuat dengan `Money(amount)` (bilangan bulat). Ia punya atribut `amount`, `Money(5) + Money(7)` menghasilkan `Money(12)`, dan dua `Money` dengan jumlah sama dianggap sama (`==`).
@starter
# tulis class-mu di bawah baris ini

@check
defines("Money") ## Definisikan class Money.
Money(5).amount == 5 ## Ia mengingat jumlahnya.
(Money(5) + Money(7)).amount == 12 ## Penjumlahan menghasilkan Money baru.
Money(5) == Money(5) ## Jumlah sama: sama.
(Money(5) == Money(6)) == False ## Jumlah berbeda: tidak sama.
@hint
Definisikan `__init__`, `__add__` (kembalikan `Money(self.amount + other.amount)`), dan `__eq__`.
@solution
class Money:
    def __init__(self, amount):
        self.amount = amount

    def __add__(self, other):
        return Money(self.amount + other.amount)

    def __eq__(self, other):
        return isinstance(other, Money) and self.amount == other.amount
:::

## @challenge f08 | 5 | Objek dan rekursi
:::drill python Setiap jalur dalam sebuah pohon
Tulis `walk(tree)` sebagai **generator**: `tree` adalah dictionary bersarang, dengan dictionary berarti folder dan nilai lain berarti file. Yield jalur setiap file, digabung dengan `/`: `{"a": {"b": 1}, "c": 2}` menghasilkan `"a/b"` dan `"c"`.
@starter
# tulis generator-mu di bawah baris ini

@check
defines("walk") ## Definisikan walk(tree).
sorted(walk({"a": {"b": 1}, "c": 2})) == ["a/b", "c"] ## Dua file.
sorted(walk({})) == [] ## Pohon kosong.
sorted(walk({"x": {"y": {"z": 0}}})) == ["x/y/z"] ## Tiga tingkat dalamnya.
sorted(walk({"a": 1, "b": {"c": 2, "d": 3}})) == ["a", "b/c", "b/d"] ## Campuran.
@hint
Untuk tiap `name, value`: jika `value` dictionary, ulangi `walk(value)` dan `yield name + "/" + inner`; jika bukan, `yield name`.
@solution
def walk(tree):
    for name, value in tree.items():
        if isinstance(value, dict):
            for inner in walk(value):
                yield name + "/" + inner
        else:
            yield name
:::
