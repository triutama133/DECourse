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
Modul 0.2 dan 0.3, serta dasar Python (fungsi, loop, dictionary, file). Virtual environment dengan `pip install -r labs/mod-1-2/requirements.txt`.

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

**Konfigurasi** (path, ambang batas, hostname) datang dari argumen atau environment variable, tidak pernah ditulis keras di kode; **rahasia** hanya dari environment (Modul 0.2).

Terakhir, **type hint** (`def f(x: int) -> str`) tidak mengubah cara Python berjalan, tetapi mendokumentasikan maksud, membantu editor menangkap kesalahan, dan memungkinkan pemeriksa seperti `mypy` atau `pyright` menemukan bug sebelum kode dijalankan. Tambahkan ke signature fungsi sejak awal.

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
- **Validator** (`field_validator`) menangani masukan berantakan tetapi bisa dipulihkan. `mode="before"` berjalan *sebelum* parsing Pydantic sendiri, di situlah Anda memangkas `"Rp 1.250.000"` menjadi `"1250000"` dan membiarkan Pydantic menyelesaikan konversinya.
- **Error adalah data.** `OrderRow.model_validate(row)` mengembalikan objek atau melempar `ValidationError`; `.errors()`-nya mendaftar setiap masalah beserta lokasi field dan jenis error:

```python
# status="teleported", total_idr="-5"
# [{'loc': ('status',), 'type': 'literal_error', ...},
#  {'loc': ('total_idr',), 'type': 'greater_than', 'msg': 'Input should be greater than 0'}]
```

Pakai itu untuk membuat **string alasan** bagi tiap baris yang ditolak. `model_dump(mode="json")` mengubah objek tervalidasi menjadi nilai biasa yang aman untuk JSON (`datetime` menjadi teks ISO).

Pola yang mengikutinya adalah antrean **karantina** (disebut juga dead-letter). Jangan memilih antara "crash seluruh job karena satu baris buruk" dan "membuangnya diam-diam". Tulis baris baik ke keluaran, baris buruk ke file karantina beserta baris aslinya, posisinya, dan alasannya, dan hitung keduanya. Manusia atau job berikutnya bisa memeriksa dan memperbaiki karantina; tidak ada yang hilang, dan keluaran utama tetap bisa dipercaya. Tentukan juga **ambang batas**: jika lebih dari, katakanlah, 5% baris ditolak, job harus gagal, karena itu berarti ada yang berubah di hulu, bukan sekadar beberapa baris berantakan.

> **Tip:** Validasi bukan hanya untuk file. Model yang sama bisa memvalidasi respons API, pesan dari antrean, dan konfigurasi. Satu definisi "pesanan yang valid" yang dipakai ulang di mana-mana adalah sebuah data contract kecil (Modul 2.5).

## @lesson Streaming: menjaga memori tetap datar
Komputer punya memori jauh lebih sedikit daripada disk, dan container produksi sering hanya punya beberapa ratus megabyte. Job yang memuat seluruh masukan ke memori berhasil di file uji Anda dan mati di file sungguhan. Obatnya adalah memproses data sebagai **stream**: baca sedikit, tangani, tulis, lupakan.

Alat Python untuk ini adalah **iterator**, dan cara termudah menulisnya adalah **generator**: fungsi yang memakai `yield` alih-alih `return`.

```python
def read_orders(path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)      # satu baris sekali waktu
```

Memanggil `read_orders(path)` tidak membaca apa pun; ia mengembalikan sebuah generator. Setiap kali pemanggil meminta item berikutnya, fungsi berjalan sampai `yield` berikutnya, menyerahkan satu baris, lalu berhenti sejenak. Pada saat mana pun hanya satu baris (ditambah apa yang disimpan kode Anda) berada di memori, berapa pun ukuran file. Dua sifat yang mengejutkan pendatang baru:

- **Kemalasan menyembunyikan error.** Karena tidak ada yang berjalan sampai sesuatu mengonsumsi generator, bug di dalamnya muncul belakangan dan di tempat lain dari tempat Anda membuatnya. `FileNotFoundError` muncul pada `next()` pertama, bukan saat pemanggilan.
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

## @lesson Error, retry, dan idempotensi
**Tangkap exception yang spesifik, tangani yang bisa Anda tangani, biarkan sisanya gagal dengan jelas.** `except Exception: pass` adalah baris termahal yang bisa Anda tulis, karena mengubah setiap bug di masa depan menjadi kehilangan data yang senyap. Tangkap tipe tersempit (`ValidationError`, `FileNotFoundError`), lakukan sesuatu yang disengaja (karantina, retry, keluar dengan kode), dan tambahkan konteks saat melempar ulang: `raise RuntimeError("loading orders failed") from exc` mempertahankan traceback aslinya.

**Bedakan dua jenis kegagalan:**

1. **Data buruk** (total negatif). Mengulang tidak akan pernah memperbaikinya. Karantina.
2. **Kegagalan sementara** (timeout, rate limit, koneksi putus). Mengulang kemungkinan besar memperbaikinya, setelah jeda.

Ulangi jenis kedua dengan **exponential backoff dan jitter**: tunggu 1 dtk, lalu 2 dtk, lalu 4 dtk, masing-masing dikali faktor acak agar banyak klien tidak mengulang pada detik yang sama. Selalu batasi jumlah percobaan dan lempar ulang di akhir.

```python
def retry(fn, attempts=4, base=0.5, retry_on=(ConnectionError, TimeoutError)):
    for n in range(1, attempts + 1):
        try:
            return fn()
        except retry_on:
            if n == attempts:
                raise
            time.sleep(base * 2 ** (n - 1) * (0.5 + random.random()))
```

(Ulangi hanya operasi yang **aman diulang**. Mengulang pembayaran tanpa idempotency key menagih dua kali.)

Itu membawa kita ke **idempotensi**, yang diperkenalkan di Modul 0.1: menjalankan job dua kali harus meninggalkan hasil yang sama dengan sekali. Teknik yang bisa Anda terapkan hari ini:

- **Keluaran deterministik.** Masukan sama memberi keluaran identik byte demi byte: pertahankan urutan masukan, `json.dumps(..., sort_keys=True)`, tanpa stempel waktu "sekarang" di dalam data.
- **Tulis atomik.** Tulis ke `output.tmp` dan `os.replace("output.tmp", "output")` di akhir. Pembaca melihat file lama yang lengkap atau file baru yang lengkap; crash di tengah menyisakan yang lama utuh. Bersihkan file `.tmp` dalam `try/except` agar eksekusi yang gagal tidak meninggalkan apa pun.
- **Ganti, jangan tambah.** Tulis keluaran sehari ke path yang memuat tanggalnya dan timpa, alih-alih menambahkan ke satu file yang terus membesar.

Ketiganya persis yang diuji Lab 1.2.

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

## @lesson Menguji kode data dengan pytest
Tes adalah cara Anda mengubah kode tanpa takut. Untuk job data, tes juga mendokumentasikan, dalam bentuk yang bisa dijalankan, apa arti "benar". **pytest** adalah alat standar: taruh fungsi bernama `test_*` di file bernama `test_*.py` dan jalankan `pytest`.

```python
def test_status_is_normalised():
    assert validate({**GOOD, "status": " PAID "}).status == "paid"
```

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

## @lesson Perkakas, dependensi, dan kapan Python adalah alat yang tepat
**Pin dependensi Anda.** `requirements.txt` dengan versi pasti atau berbatas (`pydantic>=2.5,<3`) membuat build dapat diulang; lock file (`uv`, `pip-tools`, `poetry`) membuatnya dapat diulang secara persis. Instalasi tanpa pin yang menarik versi mayor baru semalam adalah penyebab klasik "kemarin masih jalan".

**Otomatisasi pemeriksaan yang membosankan.** Formatter dan linter (`ruff` melakukan keduanya) mengakhiri debat gaya dan menangkap kesalahan nyata (variabel tak terpakai, nama tak terdefinisi). Pemeriksa tipe (`mypy`, `pyright`) menangkap bug salah tipe. Jalankan bersama tes Anda di CI, dan opsional di setiap commit dengan `pre-commit`.

**Performa dalam satu paragraf.** CPython menjalankan satu thread bytecode Python sekali waktu (**GIL**), sehingga thread membantu untuk pekerjaan *menunggu* (banyak panggilan jaringan, pembacaan disk) tetapi tidak untuk pekerjaan berat CPU; untuk itu pakai banyak proses (`multiprocessing`, `concurrent.futures.ProcessPoolExecutor`) atau, lebih baik, engine tervektorisasi. Ukur sebelum mengoptimalkan (`cProfile`, atau sekadar pengukuran waktu): bagian yang lambat jarang berada di tempat yang Anda tebak.

**Memilih alat yang tepat.** Python biasa sangat baik untuk perekat: memanggil API, memvalidasi record, memindah dan membentuk ulang data berukuran sedang, mengorkestrasi alat lain. Untuk **agregasi berat, join, dan analitik pada data besar**, engine SQL (DuckDB, Modul 2.1; warehouse, Modul 2.3) dan engine dataframe (Polars, Spark) jauh lebih cepat dan memakai memori jauh lebih baik daripada loop tulisan tangan. Data engineer yang baik menulis validasi dan perpipaan di Python dan mendorong komputasi berat ke engine yang dibangun untuknya.

## @lab Lab: ETL tervalidasi, streaming, dan idempoten
Bangun versi produksi dari job pembersihan di Modul 0.1. Ia membaca pesanan KopiKu yang kotor, memvalidasi tiap baris dengan model Pydantic, menulis baris baik dan baris karantina ke file terpisah, tidak pernah menahan file di memori, aman dijalankan dua kali, dan memberi sinyal sukses atau gagal lewat exit code-nya. Tesnya sudah ditulis untuk Anda, dan memeriksa perilaku (memori, eksekusi ulang, kegagalan), bukan hanya nilai.

### @steps
1. Persiapan (lanjutkan di proyek `~/kopiku` dari Modul 0.2, atau bekerja di dalam repositori kursus). Pasang requirement dan buat datanya:

```bash
python -m pip install -r labs/mod-1-2/requirements.txt
python3 labs/shared/shopgen.py --out data
```

2. Baca dulu `labs/mod-1-2/test_lab.py`. Itulah spesifikasinya. Perhatikan apa yang diperiksanya: hitungan terhadap ground truth generator, memori di bawah 30 MB pada file 120.000 baris, keluaran identik byte demi byte saat dijalankan ulang, keluaran sebelumnya tetap ada saat eksekusi gagal, exit code 0, 1, dan 2.
3. Buka `labs/mod-1-2/etl.py` dan implementasikan, dengan urutan ini, jalankan tes setelah tiap langkah:
   `OrderRow` (constraint dan validator), lalu `validate`, lalu `read_orders` (sebuah generator), lalu `run`, lalu `main`.
4. Di `run`, pakai pola karantina: untuk tiap baris tulis ke keluaran atau tulis `{"row", "reason", "raw"}` ke karantina, dan hitung yang terjadi. Susun alasan dari error validasi pertama. Lakukan pemeriksaan duplikat hanya untuk baris yang lolos validasi.
5. Buat `run` atomik: tulis ke file `<path>.tmp` dan `os.replace` di akhir; dalam `try/except` hapus file sementara dan lempar ulang pada kegagalan apa pun.
6. Jalankan tes, lalu jalankan program pada data asli dan lihat karantinanya:

```bash
pytest labs/mod-1-2 -v
python labs/mod-1-2/etl.py data/orders.csv clean.ndjson quarantine.ndjson; echo "exit code: $?"
head -3 quarantine.ndjson
```

7. Tantangan tambahan: tambahkan penanganan `--max-reject-rate` yang mencatat error dan mengembalikan 1; tambahkan helper retry dan tes yang memakai `monkeypatch` untuk mensimulasikan dua kegagalan sebelum sukses; tambahkan type hint dan jalankan `mypy`.

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
```

Bandingkan dengan hasil yang sudah benar: `LAB_DIR=reference pytest labs/mod-1-2 -v`. Jika tes memori gagal, kemungkinan Anda menahan semua baris sekaligus; pakai `tracemalloc` seperti di materi untuk menemukan tempatnya.

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
