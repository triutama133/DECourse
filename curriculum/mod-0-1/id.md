---
title: Bengkel Kerja Anda: Terminal, Lingkungan Python, dan Git
duration: 1-2 minggu
summary: Belajar bekerja dengan nyaman di terminal, menjaga paket Python tiap proyek tetap terisolasi, dan memakai Git agar tidak ada hasil kerja yang hilang dan tidak ada rahasia yang bocor.
why: Tutorial mengira komputer Anda sudah siap. Lalu Anda bertemu "command not found", paket yang jalan di satu laptop tetapi tidak di laptop lain, atau API key yang ter-push ke GitHub, dan kursus berhenti di situ.
---

## @outcomes
- Berpindah folder dan memeriksa file lewat terminal, termasuk menggabungkan perintah dengan pipe
- Membuat lingkungan Python terisolasi untuk sebuah proyek dan mencatat dependensinya
- Membaca pesan error Python dari bawah ke atas dan menemukan baris yang penting
- Memakai Git untuk menyimpan snapshot pekerjaan, melihat riwayat, membatalkan kesalahan, dan menjauhkan file rahasia dari repositori
- Menjaga password dan API key tetap di luar kode dan di luar Git

## @prereq
Modul 0.0 (dasar perulangan Python, dictionary, set, dan membaca file CSV) diharapkan untuk skrip penghitung terakhir. Anda butuh komputer yang boleh Anda pasangi perangkat lunak: Linux, macOS, atau Windows 10/11 dengan WSL2 (disarankan di Windows karena hampir semua alat data mengasumsikan shell bergaya Linux).

## @part Terminal

## @lesson Mengapa engineer tinggal di terminal
Bayangkan hari Senin: atasan Anda meminta, "ganti nama 40 file di `data/` dan beri tahu saya berapa pesanan yang dibatalkan". Dengan mouse itu dua puluh menit mengklik, dan tidak ada yang bisa Anda ulang besok. Dengan beberapa perintah yang diketik, itu sepuluh detik, dan perintahnya sendiri adalah catatan yang bisa dibaca dan dijalankan ulang siapa pun. Karena itu modul ini dimulai dari terminal, dan karena itu **Anda mengetik setiap perintah di komputer Anda sendiri**: membaca tentang terminal hampir tidak mengajarkan apa-apa, mengetik di dalamnya mengajar dengan cepat.

Antarmuka grafis bagus untuk menjelajah. Ia buruk untuk **mengulang** sesuatu, **mencatat** apa yang Anda lakukan, dan **berjalan di mesin tanpa layar**. Server di cloud tidak punya desktop, dan job yang menjalankan pipeline Anda jam 2 pagi tidak punya mouse. Semua di mesin itu dikerjakan dengan perintah teks, dan semua yang Anda otomatisasi adalah perintah teks yang bisa dibaca, ditinjau, dan dijalankan ulang orang lain.

Program yang membaca perintah Anda adalah **shell** (biasanya `bash` atau `zsh`; PowerShell di Windows). Jendela yang menaunginya adalah **terminal**. Anda mengetik perintah, menekan Enter, dan melihat keluarannya. Beberapa kebiasaan membuatnya jauh tidak menakutkan:

- **Tekan Tab** untuk melengkapi nama file. Lebih cepat dan mencegah salah ketik.
- **Tekan panah Atas** untuk memanggil perintah sebelumnya, dan `Ctrl+R` untuk mencarinya.
- **Baca error-nya.** Sembilan dari sepuluh kali jawabannya ada di baris terakhir.
- **Minta bantuan dari perintahnya:** `ls --help`, atau `man ls` (tekan `q` untuk keluar).

Perintah-perintahnya datang dalam kelompok kecil. Untuk setiap kelompok: baca gunanya, jawab pertanyaannya, lalu coba di komputer Anda.

### Saya di mana, dan apa isinya?

Sebelum yang lain Anda perlu tahu **di folder mana Anda berdiri** dan **apa isinya**. Shell selalu punya *folder saat ini*; perintah yang menyebut file tanpa alamat lengkap (`data/orders.csv`) mencarinya mulai dari folder itu.

| Perintah | Fungsinya | Contoh |
|---|---|---|
| `pwd` | Cetak folder tempat Anda berada | `pwd` |
| `ls -la` | Daftar file, termasuk yang tersembunyi, dengan detail | `ls -la data` |
| `cd` | Pindah folder | `cd ~/kopiku` |

:::ask Anda berada di `~/kopiku/scripts`. Folder datanya `~/kopiku/data`. Anda menjalankan `head -5 data/orders.csv`. Apa yang terjadi?
@options
lima baris pertama file pesanan ditampilkan
lima baris pertama dihapus
* error: `data/` tidak ada di dalam `scripts/`
@why
`data/orders.csv` adalah **path relatif**: shell mencarinya mulai dari folder tempat Anda berada, `scripts/`, dan di dalamnya tidak ada `data/`. File itu satu tingkat di atas. Jalankan `pwd` dan `ls` dulu, atau tulis path dari tempat Anda berdiri: `../data/orders.csv`.
:::

> **Di komputer Anda, sekarang:** buka terminal lalu jalankan `pwd`, lalu `ls -la`, lalu `cd ..` dan `pwd` lagi. Perhatikan jawaban `pwd` berubah.

### Membuat, menyalin, memindah

| Perintah | Fungsinya | Contoh |
|---|---|---|
| `mkdir -p` | Membuat folder (dan induknya) | `mkdir -p kopiku/data` |
| `cp` | Menyalin file | `cp orders.csv backup.csv` |
| `mv` | Memindah atau mengganti nama | `mv old.csv new.csv` |

`mv` punya dua tugas yang tampak sama bagi shell: memindah file ke folder lain, dan menggantinya namanya di tempat.

:::ask Apa yang dilakukan ini, jika `old.csv` ada?
```bash
mv old.csv new.csv
```
@options
menyalin `old.csv` ke `new.csv`; keduanya ada sesudahnya
* mengganti nama: hanya `new.csv` yang ada sesudahnya
menghapus kedua file
@why
`mv` memindah. Ketika tujuannya nama baru di folder yang sama, "memindah" file sama dengan **mengganti namanya**. Pakai `cp` ketika Anda ingin menyimpan yang asli.
:::

> **Di komputer Anda, sekarang:** `mkdir -p ~/kopiku/data`, `cd ~/kopiku`, `echo "hello" > a.txt` (`echo` mencetak teks, dan `>` mengirimnya ke sebuah file, bukan ke layar; Materi 3 menjelaskannya), `cp a.txt b.txt`, `mv b.txt c.txt`, lalu `ls`. Anda harus melihat `a.txt` dan `c.txt`.

### Melihat isi file

| Perintah | Fungsinya | Contoh |
|---|---|---|
| `cat` | Menampilkan seluruh file | `cat notes.txt` |
| `head`, `tail` | Menampilkan baris pertama, baris terakhir | `head -5 orders.csv` |
| `less` | Menggulir file panjang (`q` untuk keluar) | `less events.ndjson` |

Jangan pernah membuka file sejuta baris di editor untuk "melihat isinya": `head` menunjukkan bentuknya dalam sekejap.

:::ask Perintah mana yang tepat sebagai pandangan pertama pada file yang sangat besar?
@options
`cat huge.csv`
`rm huge.csv`
* `head -5 huge.csv`
@why
`cat` akan mencetak setiap baris dan membanjiri layar Anda. `head -5` menampilkan hanya lima baris pertama (header dan beberapa baris), yang biasanya sudah cukup untuk memahami bentuk datanya.
:::

### Mencari dan menghitung

| Perintah | Fungsinya | Contoh |
|---|---|---|
| `grep` | Mencari baris yang mengandung teks | `grep "cancelled" orders.csv` |
| `wc -l` | Menghitung baris | `wc -l orders.csv` |

Bersama-sama keduanya menjawab "berapa pesanan yang dibatalkan?" tanpa membuka file: `grep -c "cancelled" orders.csv`.

### Yang berbahaya: rm

| Perintah | Fungsinya | Contoh |
|---|---|---|
| `rm` | **Menghapus permanen** (tanpa tempat sampah) | `rm notes.txt` |

> **Peringatan:** `rm` tidak bertanya dan tidak bisa dibatalkan, dan `rm -rf` menghapus seluruh pohon folder tanpa satu pertanyaan pun. Sebelum menjalankannya, jalankan `ls` pada path yang persis sama untuk melihat apa yang akan Anda hancurkan. Jangan pernah menjalankan perintah yang Anda salin dari internet tanpa memahaminya.

:::ask Anda ingin menghapus folder `old_data/`. Apa kebiasaan paling aman?
@options
* jalankan `ls old_data` dulu, periksa, lalu hapus
langsung `rm -rf old_data` dan berharap benar
pakai `rm` supaya masuk tempat sampah
@why
Di shell tidak ada tempat sampah. Melihat **path yang persis sama** dengan `ls` lebih dulu hanya butuh dua detik dan sudah menyelamatkan banyak orang dari hari yang buruk.
:::

**Pengguna Windows.** Pasang WSL2 (`wsl --install` di PowerShell administrator), lalu buka "Ubuntu" dari menu Start. Di dalamnya, semua yang ada di kursus ini bekerja persis seperti yang tertulis. Kalau Anda tetap di PowerShell biasa, banyak perintah punya padanan (`dir` untuk `ls`, `type` untuk `cat`, `Select-String` untuk `grep`) tetapi tutorial, Docker (alat yang mengemas program agar jalan di mana pun; Modul 1.1), dan alat data akan terus mengasumsikan shell Linux, jadi WSL2 menghemat banyak gesekan.

> 💡 **Jeda Praktik 1 (Eksplorasi Perintah Terminal):**
> Jangan hanya membaca tabel di atas! Buka jendela terminal Anda sekarang di direktori kursus ini dan coba perintah navigasi dasar:
> Ketik `pwd` untuk melihat direktori aktif Anda.
> Ketik `ls -la data` untuk melihat daftar file transaksi KopiKu.
> Ketik `head -5 data/orders.csv` untuk mengintip 5 baris pertama pesanan.
> Ketik `wc -l data/orders.csv` untuk menghitung total baris file.
> Setelah melihat data tampil di terminal Anda, lanjut ke Pelajaran 2 di bawah.

## @lesson Path, file, dan lingkungan
Mengapa skrip berkata "file not found" padahal file-nya ada di situ? Hampir selalu karena skrip berdiri di folder yang berbeda dari dugaan Anda. Memahami **path** menghapus seluruh kelas kebingungan ini.

### Path: alamat sebuah file

Setiap file punya **path**, alamatnya di sistem file. **Path absolut** dimulai dari root (`/home/budi/kopiku/data/orders.csv`). **Path relatif** dimulai dari tempat Anda berada sekarang (`data/orders.csv`). Beberapa pintasan yang akan sering Anda pakai: `~` adalah folder home Anda, `.` adalah folder saat ini, `..` adalah folder induk. Kalau skrip berkata "file not found", jalankan `pwd` dan `ls` dulu.

Perhatikan bagaimana path relatif menjadi absolut: shell menempelkannya pada folder tempat Anda berada.

:::trace Path relatif, diselesaikan
@code
import posixpath

cwd = "/home/budi/kopiku/scripts"
relative = "data/orders.csv"
absolute = posixpath.join(cwd, relative)
print(absolute)

fixed = posixpath.normpath(posixpath.join(cwd, "..", relative))
print(fixed)
@notes
3 | Anda berdiri di `scripts/`. Ini "folder saat ini", yang dicetak `pwd`.
5 | Shell menyambung folder saat ini dan path relatif. Itulah tempat yang sungguh-sungguh dicarinya.
6 | `/home/budi/kopiku/scripts/data/orders.csv`: tidak ada `data/` di dalam `scripts/`, jadi: "No such file or directory".
8 | `..` berarti "folder induk". Naik satu tingkat sebelum `data/orders.csv` mendarat di file yang sebenarnya.
:::

File yang namanya diawali titik (`.gitignore`, `.env`) **tersembunyi**; `ls -a` menampilkannya. Ekstensi file (`.csv`, `.py`) hanyalah petunjuk bagi manusia dan program, bukan jaminan isi.

> **Di komputer Anda, sekarang:** `cd ~`, lalu `ls`, lalu `ls -a`: nama tambahan apa yang muncul? Lalu `cd /tmp` dan `pwd`. Mana di antara `~`, `/tmp`, dan `..` yang path absolut, dan mana yang pintasan?

### Environment variable dan PATH

- **Environment variable** adalah nilai bernama yang bisa dibaca setiap program, seperti `HOME` atau `PATH`. `echo $HOME` menampilkan salah satunya. Nanti Anda akan memakainya untuk mengoper pengaturan dan secret ke program tanpa menuliskannya di kode.
- **`PATH`** adalah daftar folder yang dicari shell ketika Anda mengetik nama perintah, **berurutan, dan yang pertama cocok menang**. "command not found" berarti programnya tidak terpasang, atau tidak ada di folder pada `PATH` Anda.

:::ask Anda mengetik `pytest` dan shell menjawab `command not found`. Apa yang dikatakan itu?
@options
program pytest rusak di mesin ini
Anda salah mengetik password-nya
* tidak ada folder di `PATH` yang punya program bernama `pytest`
@why
Shell mencari nama itu di setiap folder `PATH`, berurutan. "command not found" berarti tidak satu pun punya: belum terpasang, atau terpasang di tempat yang tidak ada di `PATH`. Mengaktifkan virtual environment Python (dua materi berikutnya) bekerja dengan menaruh foldernya di **depan** `PATH`.
:::

> **Di komputer Anda, sekarang:** `echo $PATH` (foldernya dipisahkan `:`), lalu `which python3` untuk melihat folder mana yang menang.

### Bug diam-diam: encoding, akhir baris, permission

**Encoding teks dan akhir baris** menyebabkan bug diam-diam. File teks adalah byte (**byte** adalah potongan terkecil yang disimpan komputer; satu huruf biasa adalah satu byte) yang ditafsirkan lewat sebuah encoding, aturan yang menyatakan byte mana berarti karakter apa; pakai **UTF-8** di mana-mana dan sebutkan saat membuka file di kode. Windows dan Linux mengakhiri baris secara berbeda (`\r\n` vs `\n`); CSV yang dibuat di Windows bisa meninggalkan `\r` tak terlihat di akhir kolom terakhir, yang merusak perbandingan yang "tampak" identik.

**Permission.** File punya izin baca, tulis, dan eksekusi untuk pemilik, grup, dan lainnya. `ls -l` menampilkannya sebagai huruf (`-rwxr-xr-x`: `r` baca, `w` tulis, `x` jalankan; tiga kelompok berisi tiga, untuk pemilik, grup, dan lainnya). `chmod +x script.sh` memungkinkan Anda menjalankan skrip langsung. Anda terutama akan menemui permission sebagai "Permission denied", yang berarti pengguna yang menjalankan perintah tidak diizinkan melakukan aksi itu pada file itu.

:::ask Anda mendapat `Permission denied` saat menjalankan skrip yang baru diunduh. Langkah pertama yang benar?
@options
* cek `ls -l`, lalu `chmod +x` bila skripnya milik Anda
taruh `sudo` di depannya, supaya selalu berhasil
hapus file lalu unduh lagi
@why
`sudo` menjalankan perintah dengan kekuatan penuh dan membuat file yang kemudian hanya bisa diubah administrator: jangan "memperbaiki" error permission dengan itu secara membabi buta. Baca dulu flag permission-nya, lalu ubah hanya yang perlu, pada file yang Anda percayai.
:::

> 💡 **Jeda Praktik 2 (Eksplorasi Path & Variabel Lingkungan):**
> Coba periksa lingkungan shell Anda langsung di terminal:
> Ketik `echo $HOME` untuk melihat path direktori home Anda.
> Ketik `echo $PATH` untuk melihat daftar folder program yang dicari shell.
> Ketik `which python3` untuk mengetahui path absolut interpreter Python sistem Anda.
> Ketik `ls -l data/orders.csv` untuk melihat hak akses izin (permission) file tersebut.
> Anda sekarang paham bagaimana shell mencari program dan mengelola path. Lanjut ke Pelajaran 3 di bawah.

## @lesson Redirect dan pipe: alat kecil yang disambung
Mengapa merangkai perintah? Karena perintah yang mengerjakan **satu** tugas kecil mudah dipercaya, dan sepuluh tugas kecil yang disambung bisa menjawab pertanyaan yang tidak dirancang untuk satu program mana pun. Inilah gagasan di balik hampir setiap pipeline data yang akan Anda bangun.

### Dua simbol yang menyambung

Gagasan paling kuat di terminal adalah perintah mengerjakan satu tugas kecil, dan Anda menyambungnya.

- `|` (pipe) mengirim keluaran satu perintah ke perintah berikutnya.
- `>` menulis keluaran ke file (menggantikannya), dan `>>` menambahkan ke file.

### Baca pipe dari kiri ke kanan

Berapa pesanan per status? Coba pada file pesanan KopiKu yang Anda buat di Mulai dari sini (`python3 labs/shared/shopgen.py --out data`):

```bash
cut -d, -f4 data/orders.csv | tail -n +2 | sort | uniq -c | sort -rn
```

Jangan dijalankan dulu. Tebak dulu apa yang diserahkan setiap tahap ke tahap berikutnya, pada file kecil:

```
id,customer,total,status
1,7,150000,paid
2,3,90000,cancelled
3,7,25000,paid
```

:::ask Apa yang dicetak `cut -d, -f4 orders.csv` untuk file itu?
@options
seluruh file, header dan semua kolom
* kolom ke-4, satu nilai per baris, header ikut
hanya angkanya, tanpa header
@why
`-d,` menyatakan pemisahnya koma, dan `-f4` memilih field ke-4. Field ke-4 pada header (`status`) ikut keluar, itulah sebabnya tahap berikutnya melewati baris pertama.
:::

:::ask Mengapa `sort` harus datang SEBELUM `uniq -c` dalam pipe?
@options
`uniq` hanya bekerja pada angka terurut, bukan teks
* `uniq -c` hanya menghitung baris sama yang bersebelahan
itu membuat keluaran tampak lebih rapi, tidak lebih
@why
`uniq -c` hanya membandingkan sebuah baris dengan baris tepat sebelumnya. Untuk `paid, cancelled, paid` ia menghitung tiga kelompok berisi 1. Setelah `sort` ia melihat `cancelled, paid, paid` dan menghitung `1 cancelled` dan `2 paid`.
:::

Setiap tahap adalah langkah kecil yang sudah Anda kenal dari Python. Lihat pipeline yang sama ditulis sebagai Python, satu tahap per baris:

:::trace Pipe, tahap demi tahap
@code
column = ["status", "paid", "cancelled", "paid"]
no_header = column[1:]
ordered = sorted(no_header)
counts = {}
for status in ordered:
    counts[status] = counts.get(status, 0) + 1
print(counts)
@notes
1 | `cut -d, -f4`: kolom ke-4, termasuk header.
2 | `tail -n +2`: lewati baris pertama (header).
3 | `sort`: nilai yang sama berakhir berdekatan.
6 | `uniq -c`: hitung setiap rangkaian nilai sama. Perhatikan dictionary-nya bertambah.
:::

Bacalah dari kiri ke kanan: `cut` mengambil kolom ke-4 yang dipisah koma (statusnya), `tail -n +2` melewati baris header, `sort` mengelompokkan nilai yang sama, `uniq -c` menghitung rangkaian nilai yang sama, dan `sort -rn` terakhir menaruh hitungan terbesar di depan. Lima alat kecil menggantikan satu program, dan tidak ada yang dimuat ke memori sekaligus, jadi ia bekerja pada file yang jauh lebih besar dari RAM Anda. Modul 1.1 mengembangkan keterampilan ini secara mendalam.

Perhatikan bahwa keluarannya juga mengungkap data dunia nyata yang berantakan: Anda akan melihat `paid`, `PAID`, dan `Paid` dihitung sebagai kelompok terpisah. Terminal adalah tempat yang baik untuk *melihat data sebelum Anda menulis kode untuknya* — Modul 0.2 menangani pembersihan status ini dengan benar.

### Menulis ke file

:::ask Anda menjalankan `sort orders.csv > orders.csv`. Apa yang terjadi pada datanya?
@options
file terurut di tempat, seperti yang Anda mau
* file dikosongkan sebelum `sort` membacanya
tidak terjadi apa-apa: shell menolak menjalankannya
@why
`>` mengosongkan file tujuan begitu perintah dimulai. `sort` lalu membaca file yang sudah kosong. Untuk mengurutkan sebuah file ke file lain, tulis ke nama yang **berbeda**: `sort orders.csv > sorted.csv`. (Mengalihkan ke file yang sedang dibaca menghancurkannya.)
:::

Setiap program punya tiga aliran standar: input (`stdin`), output (`stdout`), dan error (`stderr`). Pipe membawa `stdout`; pesan error tetap muncul di layar Anda. Untuk menyimpan error juga, pakai `2>` (misalnya `python job.py > out.txt 2> errors.txt`). Memisahkan keduanya adalah alasan pipeline bisa gagal dengan jelas meski outputnya dialirkan ke tempat lain.

> 💡 **Jeda Praktik 3 (Piping Data KopiKu):**
> Mari buktikan kekuatan pipe langsung di terminal tanpa menulis program Python:
> Jalankan perintah berikut di root folder kursus:
> `cut -d, -f4 data/orders.csv | tail -n +2 | sort | uniq -c | sort -rn`
> Perhatikan bagaimana Anda bisa meringkas ribuan data transaksi KopiKu menjadi rekap status pesanan dalam sekejap! Lanjut ke Pelajaran 4 untuk mengisolasi lingkungan Python.

## @part Lingkungan Python dan Git

## @lesson Python: pasang sekali, lalu isolasi setiap proyek
Mengapa ini penting sejak hari pertama? Karena begitu Anda memasang sesuatu secara global dan itu merusak alat yang dibutuhkan sistem operasi Anda, Anda kehilangan satu sore. Virtual environment adalah asuransi murah untuk itu.

Periksa yang Anda punya: `python3 --version`. Untuk kursus ini pakai Python 3.10 atau lebih baru. Di Linux dan macOS, gunakan package manager sistem atau installer resmi; di Windows, bekerjalah di dalam WSL2 (halaman **Mulai di sini** menuntun cara memasangnya).

**Pengguna Ubuntu, Debian, dan WSL2:** sistem ini membawa Python tanpa alat venv. Pasang sekali dengan `sudo apt install -y python3-venv python3-pip`; tanpanya, baris `python3 -m venv` di bawah berhenti dengan pesan `ensurepip is not available` (diukur pada Ubuntu 24.04 yang baru dipasang).

Masalah intinya: paket Python dipasang di satu tempat, sedangkan proyek berbeda butuh versi berbeda. Proyek A butuh `pandas 1.5`, proyek B butuh `pandas 2.2`. Kalau semuanya dipasang global, cepat atau lambat satu proyek merusak yang lain, atau merusak alat Python bawaan sistem operasi Anda. Solusinya adalah **virtual environment**: folder privat dengan Python dan paketnya sendiri, per proyek.

Inilah seluruh gagasannya dalam beberapa baris. Shell mencari perintah di folder-folder `PATH`, berurutan, dan **yang pertama cocok menang**. Mengaktifkan virtual environment menaruh foldernya **di depan**:

:::trace Bagaimana mengaktifkan venv mengubah program mana yang berjalan
@code
path = ["/usr/local/bin", "/usr/bin"]
folders = {
    "/usr/local/bin": [],
    "/usr/bin": ["python3", "git"],
    "/home/budi/kopiku/venv/bin": ["python3", "pytest"],
}

def which(command):
    for folder in path:
        if command in folders[folder]:
            return folder + "/" + command
    return None

print(which("python3"))
print(which("pytest"))
path.insert(0, "/home/budi/kopiku/venv/bin")
print(which("python3"))
print(which("pytest"))
@notes
14 | `python3` ditemukan di `/usr/bin`: folder pertama yang punya menang.
15 | `pytest` tidak ada di folder mana pun di `PATH`: shell akan berkata `command not found`.
16 | Inilah yang dilakukan `source venv/bin/activate`: ia menaruh folder venv di urutan pertama.
17 | Nama yang sama sekarang menemukan Python milik venv, yang berisi paket proyek ini.
18 | Dan `pytest`, yang terpasang hanya di venv, juga ditemukan.
:::

:::ask Proyek A butuh `pandas 1.5` dan proyek B butuh `pandas 2.2`. Keduanya dipasang ke satu Python global. Apa yang terjadi?
@options
kedua versi bekerja berdampingan tanpa masalah
pip menolak memasang dan tidak mengubah apa pun
* memasang satu menggantikan yang lain: sebuah proyek rusak
@why
Satu instalasi Python menyimpan **satu** versi untuk setiap paket. Virtual environment memberi setiap proyek folder paket pribadinya sendiri, sehingga A dan B berhenti berebut.
:::

```bash
cd ~/kopiku
python3 -m venv venv              # membuat environment di ./venv
source venv/bin/activate          # mengaktifkannya (Windows PowerShell: venv\Scripts\Activate.ps1)
python --version                  # sekarang "python" berarti Python milik venv
python -m pip install requests    # terpasang hanya ke ./venv
python -m pip freeze > requirements.txt   # catat persis apa yang terpasang
deactivate                        # keluar dari environment
```

Tiga aturan menyelamatkan banyak sore para pemula:

1. **Selalu jalankan `python -m pip`, bukan `pip` saja.** Ini menjamin paket masuk ke Python yang sedang Anda pakai.
2. **Jangan pernah `sudo pip install`.** Itu mengubah Python sistem dan bisa merusak alat sistem operasi.
3. **Commit `requirements.txt`, jangan pernah folder `venv/`.** Folder itu besar, spesifik untuk mesin Anda, dan bisa dibuat ulang dengan satu perintah: `python -m pip install -r requirements.txt`.

Alat yang lebih baru (`uv`, `poetry`) mengerjakan hal yang sama dengan lebih cepat dan menambahkan lock file; konsepnya identik, jadi pelajari dulu dengan `venv`.

Sebelum membaca bagian berikutnya, jawab:

:::ask Perintah mana yang memasang `requests` ke Python yang sedang Anda pakai?
@options
`pip install requests`
* `python -m pip install requests`
`sudo pip install requests`
@why
`python -m pip` menjalankan pip milik Python **ini**, jadi paketnya mendarat di tempat Anda memakainya. `pip` saja mungkin milik Python lain, dan `sudo pip` mengubah Python sistem dan bisa merusak alat sistem operasi Anda.
:::

:::ask Mana di antara ini yang harus Anda commit ke Git?
@options
folder `venv/`
keduanya
* `requirements.txt`
@why
`venv/` besar, spesifik untuk mesin Anda, dan dibuat ulang dengan satu perintah dari `requirements.txt` (`python -m pip install -r requirements.txt`). Commit resepnya, bukan hasilnya.
:::

**Menjalankan skrip.** `python summarize.py data/orders.csv` menjalankan sebuah file; kata-kata setelah nama file masuk ke `sys.argv` dan diurai dengan rapi oleh modul standar `argparse`. Idiom `if __name__ == "__main__":` di bagian bawah berarti "jalankan bagian ini hanya ketika file dieksekusi langsung, bukan saat di-import", yang akan Anda pakai di setiap skrip yang kelak mungkin menjadi library.

**Membaca traceback.** Ketika Python gagal, ia mencetak *stack trace*. Bacalah **dari bawah**: baris terakhir menyebut jenis dan pesan error (`FileNotFoundError: [Errno 2] No such file or directory: 'data/orders.csv'`); baris di atasnya menunjukkan baris file mana yang memanggil apa. Frame terakhir di kode Anda sendiri biasanya tempat yang harus dilihat. Salin baris terakhir saat mencari bantuan atau bertanya ke orang.

> 💡 **Jeda Praktik 4 (Bangun Workspace & Virtual Environment):**
> Saatnya membangun bengkel kerja lokal Anda sendiri! Buka terminal dan jalankan:
> 1. Buat folder workspace: `mkdir -p ~/kopiku && cd ~/kopiku`
> 2. Buat virtual environment terisolasi: `python3 -m venv venv`
> 3. Aktifkan environment: `source venv/bin/activate`
> 4. Verifikasi: `which python` (pastikan outputnya menunjuk ke `~/kopiku/venv/bin/python`).
> Jangan dinonaktifkan dulu! Biarkan aktif dan lanjut ke Pelajaran 5 untuk menyiapkan Git.

## @lesson Git: jaring pengaman untuk semua yang Anda tulis
Mengapa Git sebelum Anda punya sesuatu yang bisa hilang? Karena pada hari Anda menimpa skrip yang berfungsi, Anda ingin tombol yang berkata "kembali ke kemarin".

Git mencatat snapshot proyek Anda sehingga Anda bisa melihat apa yang berubah, kembali ke kondisi mana pun sebelumnya, bereksperimen tanpa risiko, dan berkolaborasi. Tiga area menjelaskan hampir semuanya:

1. **Working tree**: file seperti adanya di disk sekarang.
2. **Staging area**: perubahan yang sudah *Anda pilih* untuk masuk ke snapshot berikutnya.
3. **Riwayat repositori**: rantai permanen snapshot, disebut **commit**.

Siklus dasarnya:

```bash
git init                         # mulai melacak folder ini (sekali)
git status                       # apa yang berubah? apa yang sudah di-stage?
git add summarize.py             # stage sebuah file untuk snapshot berikutnya
git commit -m "Add script that counts orders by status"   # ambil snapshot
git log --oneline                # daftar riwayat
git diff                         # lihat perubahan yang belum di-stage baris demi baris
```

Tebak dulu sebelum membaca bagian berikutnya:

:::ask Anda mengedit `a.py` dan `b.py`. Anda menjalankan `git add a.py` lalu `git commit -m "fix"`. Apa isi commit itu?
@options
* hanya `a.py`: hanya perubahan yang di-stage yang masuk ke commit
kedua file
tidak ada, Anda juga harus menjalankan `git push`
@why
Commit mengambil snapshot dari **staging area**, dan hanya `a.py` yang di-stage. `b.py` tetap file yang dimodifikasi di working tree. Itulah mengapa `git status` sebelum setiap commit berguna.
:::

**Commit yang baik** kecil dan pesannya menjelaskan *apa dan mengapa* ("Reject orders with non-positive totals"), bukan "update" atau "fix". Commit ketika satu hal sudah berfungsi. Commit kecil membuat kesalahan mudah ditemukan dan dibatalkan.

**Membatalkan dengan aman** (pelajari sebelum Anda membutuhkannya):

- Membuang perubahan yang belum di-commit pada sebuah file: `git restore file.py`
- Mengeluarkan file dari staging: `git restore --staged file.py`
- Membatalkan commit dengan menambah commit baru yang membalikkannya: `git revert <commit>`
- Memperbaiki pesan commit terakhir (yang belum dibagikan): `git commit --amend`

Anda mengedit `summarize.py` dan merusaknya. Belum ada yang di-commit. Perintah mana yang membuang suntingan dan mengembalikan versi commit terakhir?

:::ask Pilih perintah yang tepat.
@options
`git revert`
`git commit --amend`
* `git restore summarize.py`
@why
`git restore file` membuang suntingan yang belum di-commit pada sebuah file. `git revert` membatalkan sebuah **commit** dengan menambah commit baru, dan `git commit --amend` menulis ulang pesan commit terakhir. Hati-hati: `git restore` tidak bisa dibatalkan, suntingan itu hilang.
:::

**Branch** memungkinkan Anda bereksperimen tanpa menyentuh jalur utama: `git switch -c coba-parser-baru`, bekerja dan commit, lalu gabungkan (`git switch main && git merge coba-parser-baru`) atau buang. **Remote** seperti GitHub menyimpan salinan di tempat lain: `git remote add origin <url>` dan `git push -u origin main`. Repositori yang di-push adalah cadangan dan portofolio, tetapi juga sesuatu yang bisa dibaca orang lain, itulah mengapa dua poin berikutnya penting.

**`.gitignore`** mendaftar file yang tidak boleh dilacak Git: `venv/`, `.env`, `__pycache__/`, file data besar seperti `data/`. Catatan: mengabaikan file hanya berlaku untuk file yang belum di-commit. Kalau Anda sudah meng-commit `data/` sebelumnya, tambahkan ke `.gitignore` *dan* jalankan `git rm -r --cached data` untuk berhenti melacaknya.

> **Peringatan:** Riwayat Git permanen secara desain. File yang pernah di-commit hidup di setiap clone dan setiap commit lama, meski Anda menghapusnya di commit berikutnya. Karena itu secret tidak boleh pernah di-commit, bahkan "sementara".

:::ask Anda meng-commit `.env` berisi password, menyadarinya, dan menghapus file itu di commit berikutnya. Apakah password itu sudah aman?
@options
* tidak: commit sebelumnya masih menyimpannya untuk siapa pun yang punya clone
ya, file-nya sudah hilang dari folder
ya, karena commit lama tidak bisa dibaca
@why
Menghapus file di commit berikutnya hanya membuangnya dari snapshot terbaru. Commit lama masih berisinya. Anggap setiap secret yang ter-commit sudah terbuka: cabut dan ganti dulu (materi berikutnya).
:::


> 💡 **Jeda Praktik 5 (Inisialisasi Git & Proteksi .gitignore):**
> Masih di dalam folder `~/kopiku` dengan terminal Anda:
> 1. Inisialisasi pelacakan Git: `git init`
> 2. Buat file `.gitignore` agar folder venv dan data tidak ter-commit:
> `printf 'venv/\n.env\ndata/\n__pycache__/\n' > .gitignore`
> 3. Buat commit pertama Anda:
> `git add .gitignore && git commit -m "chore: initial commit with gitignore"`
> 4. Periksa riwayat Anda: `git log --oneline` (Anda resmi memiliki snapshot Git pertama!). Lanjut ke Pelajaran 6.

## @part Kebiasaan kerja yang aman

## @lesson Rahasia dan konfigurasi
Mengapa tidak menulis password langsung di kode saja? Karena kode dibagikan, disalin, dan di-push, jadi secret di dalam kode adalah secret di mana pun kode itu pergi.

**Rahasia (secret)** adalah apa pun yang memberi akses: password, API key, token, private key, connection string database yang berisi password. **Konfigurasi** adalah pengaturan yang berbeda antar lingkungan (host database di development vs produksi). Keduanya harus berada *di luar* kode Anda.

Versi pemula dari solusinya adalah environment variable:

```python
import os
db_password = os.environ["DB_PASSWORD"]      # gagal dengan jelas bila tidak ada: bagus
region = os.environ.get("REGION", "ap-southeast-1")   # dengan nilai bawaan yang tidak berbahaya
```

Tebak: apa yang terjadi?

:::ask `os.environ["DB_PASSWORD"]` dijalankan di mesin yang `DB_PASSWORD`-nya tidak pernah diatur. Apa yang terjadi?
@options
ia mengembalikan string kosong dan lanjut diam-diam
* ia berhenti dengan `KeyError`: keras dan cepat
ia mengembalikan password program lain
@why
Gagal seketika dan jelas lebih baik daripada berjalan setengah terkonfigurasi. `os.environ.get("REGION", "ap-southeast-1")` adalah versi untuk pengaturan yang **tidak berbahaya** dan punya nilai bawaan yang aman; jangan pernah memberi secret nilai bawaan.
:::

Untuk kerja lokal, taruh variabel di file bernama `.env` yang terdaftar di `.gitignore`, lalu muat dengan shell (`set -a; source .env; set +a`) atau library seperti `python-dotenv`. Di produksi, platform menyuntikkannya dari secrets manager. Commit sebuah `.env.example` berisi nilai palsu agar rekan tim tahu variabel apa saja yang ada.

Tebak urutan langkah daruratnya:

:::ask Sebuah API key di-push ke repositori publik. Apa hal PERTAMA yang dilakukan?
@options
* mencabut key di providernya dan membuat yang baru
menghapus file di commit baru
menunggu dan melihat apakah ada yang memakainya
@why
Bot memindai repositori publik dalam hitungan menit, jadi anggap key itu sudah disalin. Cabut dan ganti dulu. Membersihkan riwayat dan menambah `.gitignore` menyusul, dan menghapus file saja bukan perbaikan.
:::

Jika rahasia terlanjur di-commit atau di-push: **anggap sudah dicuri**, karena bot memindai repositori publik dalam hitungan menit. Urutan perbaikan penting: (1) **cabut dan ganti rahasia** di penyedianya, (2) baru bersihkan riwayat repositori bila perlu, (3) lalu tambahkan file ke `.gitignore` dan aktifkan secret scanning. Menghapus file di commit berikutnya *bukan* perbaikan.

> 💡 **Jeda Praktik 6 (Proteksi File Rahasia):**
> Lindungi rahasia sebelum terlanjur bocor!
> Di dalam `~/kopiku`, tambahkan aturan `.env` ke `.gitignore` (jika belum ada).
> Buat file contoh publik: `echo "DATABASE_URL=sqlite:///data/warehouse.db" > .env.example`
> Simpan ke Git:
> `git add .env.example && git commit -m "chore: add env template"`
> Sekarang repositori Anda aman dari kebocoran kredensial. Lanjut ke Pelajaran 7.

## @lesson Kebiasaan kerja yang membuat Anda lebih cepat
Mengapa menghabiskan satu materi untuk kebiasaan? Karena perbedaan dua pemula dengan keterampilan sama biasanya adalah seberapa cepat masing-masing keluar dari kebuntuan.

Beberapa disiplin kecil memisahkan orang yang menyelesaikan pekerjaan dari orang yang bergulat dengan alatnya.

- **Satu proyek, satu folder, satu repositori, satu environment.** Untuk kursus ini: `~/kopiku/` berisi `venv/`, `data/`, skrip Anda, `requirements.txt`, `.gitignore`, dan `README.md` singkat yang menjelaskan cara menjalankan.
- **Jauhkan data dari Git, dan buat agar bisa direproduksi.** Data itu besar dan berubah; *resep* yang menghasilkannya (perintah generator) masuk ke README. Ini kebiasaan reprodusibilitas, dan perekrut memperhatikannya.
- **Buat error mudah dibantu.** Saat meminta bantuan, sertakan perintah persis yang Anda jalankan, teks error lengkap (sebagai teks, bukan tangkapan layar), apa yang Anda harapkan, versi Python dan OS Anda, dan apa yang sudah Anda coba. Pertanyaan yang rapi dijawab dalam hitungan menit; yang samar diabaikan.
- **Baca sebelum menempel.** Pahami setiap perintah yang Anda salin. Utamakan dokumentasi resmi untuk langkah instalasi; tutorial cepat usang.
- **Pakai editor yang membantu.** Visual Studio Code dengan ekstensi Python memberi syntax highlighting, terminal terintegrasi, dan debugger. Keterampilan terminal di modul ini bekerja sama di dalamnya.

Permintaan bantuan mana yang cepat dijawab?

:::ask Pilih cara terbaik meminta bantuan untuk skrip yang gagal.
@options
tangkapan layar dan kata-kata "tidak jalan"
* perintah persisnya, teks error lengkap, OS Anda, apa yang dicoba
"tolong, mendesak" tanpa rincian
@why
Orang menjawab pertanyaan yang tersusun baik dalam hitungan menit: mereka bisa mereproduksi masalahnya dan melihat error-nya. Tangkapan layar tidak bisa dicari atau disalin, dan pertanyaan yang kabur tidak bisa dijawab.
:::

Terakhir, **latih siklusnya** sampai otomatis: buat perubahan kecil, jalankan, lihat hasilnya, commit. Semua yang datang kemudian di kursus ini (tes, container, orchestrator) adalah siklus yang sama dengan alat yang lebih baik.

**Membaca `summarize.py` sebelum mengeditnya.** Starter sudah menyiapkan dua alat standar Python untuk Anda:
- **`argparse`**: membaca nama file yang Anda ketik setelah `python3 summarize.py` (misalnya `data/orders.csv`) dan menyimpannya ke `args.path`.
- **`collections.Counter`**: dictionary khusus untuk menghitung — menulis `counts[status] += 1` otomatis dimulai dari `0` tanpa perlu menulis `counts.get(status, 0)`.

> 💡 **Jeda Praktik 7 (Lengkapi summarize.py & Validasi Workspace):**
> Saatnya membuktikan seluruh bengkel kerja Anda berfungsi:
> 0. Beri tahu shell di mana Anda meng-clone kursus ini (ubah path ke folder ANDA): `export COURSE=~/projects/DECourse` (folder dari Mulai di sini, langkah 3; `export` hanya berlaku di jendela terminal ini)
> 1. Masih di `~/kopiku`, salin generator dan buat datanya:
> `cp $COURSE/labs/shared/shopgen.py . && python3 shopgen.py --out data`
> 2. Salin starter skrip: `cp $COURSE/labs/mod-0-1/starter/summarize.py .`
> 3. Buka `summarize.py` di editor Anda, implementasikan penghitungan pesanan per status huruf kecil.
> 4. Commit skrip dan generator: `git add shopgen.py summarize.py && git commit -m "feat: count orders by status"`
> 5. Catat dependensi: `python -m pip freeze > requirements.txt && git add requirements.txt && git commit -m "chore: freeze requirements"`
> 6. Jalankan pemeriksa otomatis dari repositori kursus:
> `python3 $COURSE/labs/mod-0-1/check.py ~/kopiku`
> Jika semua baris PASS, selamat! Anda resmi memiliki lingkungan kerja data engineer profesional!

## @lab Lab: bangun workspace KopiKu Anda
Buat folder proyek yang akan Anda pakai di sisa kursus ini, dan buktikan ia disiapkan dengan benar lewat pemeriksa otomatis. Workspace Anda butuh lingkungan terisolasi, riwayat Git dengan commit yang masuk akal, `.gitignore` yang melindungi Anda, dan skrip kecil yang menghitung pesanan per status.

### @steps
1. Buat folder dan masuk ke dalamnya:

```bash
mkdir -p ~/kopiku && cd ~/kopiku
```

2. Buat dan aktifkan virtual environment, lalu buat commit pertama dengan `.gitignore` yang mengecualikan `venv/`, `.env`, `data/`, dan `__pycache__/`:

```bash
python3 -m venv venv
source venv/bin/activate            # Windows PowerShell: venv\Scripts\Activate.ps1
git init
printf 'venv/\n.env\ndata/\n__pycache__/\n' > .gitignore
git add .gitignore
git commit -m "Start project with a .gitignore"
```

3. Beri tahu shell di mana kursusnya (folder dari Mulai di sini, langkah 3; ubah jika Anda meng-clone di tempat lain, dan ulangi baris ini di setiap terminal baru), salin generator data ke proyek Anda, lalu buat datanya:

```bash
export COURSE=~/projects/DECourse
cp $COURSE/labs/shared/shopgen.py .
python3 shopgen.py --out data
```

4. Salin skrip starter ke proyek Anda dengan `cp $COURSE/labs/mod-0-1/starter/summarize.py .`, buka di editor, lalu implementasikan. Ia harus menghitung setiap `order_id` sekali dan mengelompokkan menurut status huruf kecil. Coba jalankan, dan bandingkan dengan one-liner terminal dari materi (ingat one-liner itu menghitung ganda duplikat, jadi angkanya akan sedikit berbeda: itulah intinya):

```bash
python3 summarize.py data/orders.csv
```

5. Commit skrip dan generator, catat dependensi (walau sekarang belum ada, file itu bagian dari kebiasaan) lalu commit lagi:

```bash
git add shopgen.py summarize.py
git commit -m "Add script that counts orders by status"
python -m pip freeze > requirements.txt
git add requirements.txt
git commit -m "Record dependencies in requirements.txt"
```

6. Jalankan pemeriksa dan perbaiki apa pun yang dilaporkan:

```bash
python3 $COURSE/labs/mod-0-1/check.py ~/kopiku
```

7. **Siapkan untuk Modul 0.2 dan buktikan workspace Anda.** Buat virtual environment bersama untuk folder kursus satu kali saja, pasang `pytest` (Modul 0.2 langsung memakainya setelah ini; jika tadi Anda baru mencoba `Lab 0.0` di pratinjau browser, jalankan juga `pytest labs/mod-0-0/test_lab.py -v` di sini), lalu buat kode bukti Modul 0.1 Anda:

```bash
cd ~/projects/DECourse
python3 -m venv venv && source venv/bin/activate
python -m pip install pytest
python3 scripts/prove.py mod-0-1 ~/kopiku
```

Perintah terakhir mencetak kode bukti. Tempel ke kotak **Bukti** di halaman lab Modul 0.1.

   Venv kedua ini milik **folder kursus** (`~/projects/DECourse`, atau tempat Anda meng-clone-nya di Mulai di sini, langkah 3), bukan milik `~/kopiku`: satu venv per proyek adalah kebiasaan yang normal. Inilah venv yang Anda pakai untuk semua modul berikutnya. Buat sekali saja; di awal setiap sesi belajar jalankan `cd ~/projects/DECourse` dan `source venv/bin/activate`, lalu pastikan prompt diawali `(venv)`.

### @files
- labs/mod-0-1/starter/summarize.py :: Kerangka skrip Anda: isi logika penghitungannya :: starter
- labs/mod-0-1/check.py :: Pemeriksa yang memeriksa workspace Anda :: test
- labs/mod-0-1/reference/summarize.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference
- labs/mod-0-1/reference/make_workspace.sh :: Membuat workspace yang sudah jadi secara otomatis :: reference

### @deliverables
- `python3 labs/mod-0-1/check.py ~/kopiku` mencetak PASS di setiap baris
- Riwayat Git Anda punya minimal tiga commit dengan pesan yang bermakna
- `venv/`, `data/`, dan `.env` tidak dilacak oleh Git
- 8 tes Lab 0.2 lulus di terminal Anda sendiri, di dalam venv Anda sendiri (penyiapan Anda sendiri, bukan pratinjau browser)

### @verify
Pemeriksa itulah verifikasinya:

```bash
python3 labs/mod-0-1/check.py ~/kopiku
```

Ia memeriksa environment, repositori, `.gitignore`, riwayat commit, bahwa tidak ada rahasia di seluruh riwayat, dan bahwa skrip Anda memberi hitungan yang benar. Setiap baris yang gagal mencetak petunjuk.

## @chaos API key yang menjadi publik
### @scenario
Seorang engineer junior membuat job kecil yang mengunduh kurs mata uang dari API berbayar. Agar cepat jalan, ia menempelkan API key di `config.py`, commit, dan mem-push repositori ke akun GitHub publik untuk dipamerkan di portofolionya. Tiga hari kemudian team lead menerima email dari penyedia API: pemakaian pada key itu 400 kali lebih tinggi dari normal, dan tagihan bulanannya menuju angka yang sangat besar. Job-nya sendiri masih berjalan baik.

### @cause
Key itu di-commit sebagai teks biasa dan repositorinya publik. Bot otomatis memindai setiap push publik untuk pola yang menyerupai key dan mulai memakai yang mereka temukan, biasanya dalam hitungan menit. Engineer junior itu lalu menghapus key dari `config.py` di commit baru, yang tidak mengubah apa pun: key masih ada di commit sebelumnya, terlihat oleh siapa pun yang membuka riwayat.

### @fix
1. **Cabut key itu segera** di penyedia dan terbitkan yang baru. Ini satu-satunya langkah yang benar-benar menghentikan kerugian.
2. Periksa log pemakaian penyedia untuk melihat key lama dipakai untuk apa.
3. Pindahkan key baru ke environment variable (`os.environ["RATES_API_KEY"]`), taruh `.env` di `.gitignore`, dan commit `.env.example` berisi nilai palsu.
4. Jika repositori harus tetap publik, hapus rahasia dari riwayat dengan alat seperti `git filter-repo` lalu force-push, tetapi anggap ini pembersihan, bukan keamanan: key lama sudah terlanjur bocor.
5. Aktifkan secret scanning milik platform dan tambahkan pemeriksaan pre-commit agar ini tidak terulang.

### @pattern
Rahasia tinggal di environment, tidak pernah di repositori. Jika suatu saat bocor, cabut dulu, bersihkan kemudian.

## @quiz
### Apa tujuan utama virtual environment Python?
- [ ] Membuat kode Python berjalan lebih cepat dengan mengompilasinya lebih dulu untuk mesin yang dipakai
- [x] Memberi setiap proyek paketnya sendiri, sehingga proyek yang butuh versi berbeda tidak berbenturan
- [ ] Melindungi kode Anda agar tidak dibaca pengguna lain yang berbagi komputer yang sama
- [ ] Memasang salinan kedua Python milik sistem operasi agar pembaruan tidak bisa mengubahnya

> Virtual environment adalah folder privat dengan Python dan paket terpasangnya sendiri, dibuat per proyek. Ia tidak berpengaruh pada kecepatan maupun kerahasiaan file.

### Anda meng-commit `data/orders.csv` minggu lalu dan kini menambahkan `data/` ke `.gitignore`. Apa yang terjadi pada file itu?
- [ ] Git menghapusnya dari riwayat repositori begitu baris itu ditambahkan
- [x] Ia tetap dilacak; ignore hanya untuk file yang belum dilacak. Pakai `git rm -r --cached data`
- [ ] Ia dihapus dari disk Anda saat `git pull` berikutnya
- [ ] Ia disembunyikan dari log tetapi tetap dilacak, dan edit berikutnya otomatis diabaikan oleh Git

> `.gitignore` hanya berlaku untuk file yang belum dilacak Git. File yang sudah di-commit terus dilacak sampai Anda mengeluarkannya dari index (dan tetap ada di commit lama).

### Apa yang dilakukan `grep "paid" orders.csv | wc -l`?
- [ ] Menghitung berapa file di folder saat ini yang mengandung kata "paid"
- [ ] Menghapus setiap baris yang mengandung "paid" dan mencetak jumlah baris yang tersisa
- [x] Menghitung berapa baris di orders.csv yang mengandung teks "paid" di mana pun
- [ ] Menulis kata "paid" ke orders.csv satu kali untuk setiap baris yang sudah ada

> `grep` mencetak baris yang cocok, dan pipe mengirimnya ke `wc -l` yang menghitung baris. Tidak ada yang diubah.

### Anda menjalankan `sort orders.csv > orders.csv`. Apa hasilnya?
- [ ] File terurut di tempat, yang merupakan cara biasa dan aman untuk mengurutkan file
- [ ] Perintah gagal dengan error karena masukan dan keluarannya file yang sama
- [x] File menjadi kosong, karena shell memotongnya sebelum `sort` sempat membaca
- [ ] File terurut dan salinan cadangan bernama orders.csv~ dibuat otomatis

> Shell membuka file keluaran untuk ditulis (mengosongkannya) sebelum menjalankan perintah. Tulis ke file baru lalu ganti namanya, atau pakai `sort -o`.

### Skrip Python crash dengan stack trace panjang. Ke mana Anda sebaiknya melihat pertama kali?
- [ ] Baris pertama trace, karena di situlah program mulai berjalan
- [x] Baris terakhir yang menyebut error-nya, lalu baris terakhir kode Anda sendiri di trace
- [ ] Bagian tengah trace, karena di situlah kode library berada
- [ ] Tidak ke mana pun: stack trace untuk pengembang Python dan tidak dimaksudkan dibaca pengguna

> Python mencetak rantai pemanggilan dari panggilan terluar ke terdalam. Baris akhir berisi jenis dan pesan error; frame terdekat di kode Anda biasanya penyebabnya.

### Mana pesan commit terbaik untuk perubahan yang membuat langkah pembersihan menolak total negatif?
- [ ] "update"
- [x] "Reject orders with a non-positive total"
- [ ] "Changed some stuff in pipeline.py and also fixed things"
- [ ] "WIP"

> Pesan yang baik menyebut apa yang berubah dan, bila perlu, mengapa. Pesan yang samar membuat riwayat tidak berguna saat Anda harus mencari bug.

### Anda tidak sengaja mem-push commit berisi password database ke repositori publik, lalu menghapus file itu di commit berikutnya. Apa yang harus dilakukan?
- [ ] Tidak perlu apa-apa lagi, karena password sudah tidak ada di versi terbaru kode itu
- [ ] Menjadikan repositori privat, yang mencegah siapa pun sudah menyalinnya sebelumnya
- [x] Mengganti password di database lebih dulu, baru membersihkan riwayat dan menambah pengaman
- [ ] Meminta dukungan GitHub menghapus repositori dan terus memakai password yang sama seperti sebelumnya

> Rahasia masih ada di commit lama dan mungkin sudah disalin. Mengganti kredensial adalah satu-satunya perbaikan yang benar-benar menghilangkan risiko. Pembersihan riwayat sifatnya sekunder.

### Mengapa `requirements.txt` di-commit ke Git tetapi folder `venv/` tidak?
- [ ] Git tidak bisa menyimpan folder yang berisi lebih dari seratus file
- [ ] `requirements.txt` terenkripsi sehingga aman dibagikan, sedangkan `venv/` tidak
- [x] Folder itu besar dan khusus mesin; file itu bisa membuat ulang environment-nya
- [ ] Python menolak berjalan jika folder `venv/` disimpan di dalam repositori

> `python -m pip install -r requirements.txt` membangun ulang environment di mesin mana pun, jadi hanya resepnya yang perlu dikontrol versinya.

## @resources
- [Dokumentasi Python: venv, membuat virtual environment](https://docs.python.org/3/library/venv.html)
- [Dokumentasi Python: tutorial argparse](https://docs.python.org/3/howto/argparse.html)
- [Buku Pro Git (gratis)](https://git-scm.com/book/en/v2)
- [Dokumen GitHub: menghapus data sensitif dari repositori](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
