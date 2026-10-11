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
Modul 0.1 membantu tetapi tidak wajib. Anda butuh komputer yang boleh Anda pasangi perangkat lunak: Linux, macOS, atau Windows 10/11 dengan WSL2 (disarankan di Windows karena hampir semua alat data mengasumsikan shell bergaya Linux).

## @lesson Mengapa engineer tinggal di terminal
Antarmuka grafis bagus untuk menjelajah. Ia buruk untuk **mengulang** pekerjaan, **mencatat** apa yang Anda lakukan, dan **berjalan di mesin tanpa layar**. Server cloud tidak punya desktop, dan job yang menjalankan pipeline Anda pukul 2 pagi tidak punya mouse. Semua di mesin-mesin itu dikerjakan dengan perintah teks, dan semua yang Anda otomatisasi adalah perintah teks yang bisa dibaca, ditinjau, dan dijalankan ulang orang lain.

Program yang membaca perintah Anda disebut **shell** (biasanya `bash` atau `zsh`; PowerShell di Windows). Jendela yang menampungnya adalah **terminal**. Anda mengetik perintah, menekan Enter, dan melihat keluarannya. Beberapa kebiasaan membuatnya jauh tidak menakutkan:

- **Tekan Tab** untuk melengkapi nama file. Lebih cepat dan mencegah salah ketik.
- **Tekan panah Atas** untuk memanggil perintah sebelumnya, dan `Ctrl+R` untuk mencarinya.
- **Baca error-nya.** Sembilan dari sepuluh kali jawabannya ada di baris terakhir.
- **Minta bantuan ke perintahnya:** `ls --help`, atau `man ls` (tekan `q` untuk keluar).

Perintah yang akan Anda pakai setiap hari:

| Perintah | Fungsi | Contoh |
|---|---|---|
| `pwd` | Menampilkan folder tempat Anda berada | `pwd` |
| `ls -la` | Mendaftar file, termasuk yang tersembunyi, dengan detail | `ls -la data` |
| `cd` | Pindah folder | `cd ~/kopiku` |
| `mkdir -p` | Membuat folder (beserta induknya) | `mkdir -p kopiku/data` |
| `cp`, `mv` | Menyalin, memindah, atau mengganti nama | `mv lama.csv baru.csv` |
| `rm` | **Menghapus permanen** (tidak ada tempat sampah) | `rm catatan.txt` |
| `cat`, `head`, `tail` | Menampilkan seluruh file, baris pertama, baris terakhir | `head -5 orders.csv` |
| `less` | Menggulir file panjang (`q` untuk keluar) | `less events.ndjson` |
| `grep` | Mencari baris yang mengandung teks | `grep "cancelled" orders.csv` |
| `wc -l` | Menghitung baris | `wc -l orders.csv` |

> **Peringatan:** `rm` tidak bertanya dan tidak bisa dibatalkan, dan `rm -rf` menghapus seluruh pohon folder tanpa satu pertanyaan pun. Sebelum menjalankannya, jalankan `ls` pada path yang persis sama untuk melihat apa yang akan Anda hancurkan. Jangan pernah menjalankan perintah hasil salinan dari internet tanpa memahaminya.

**Pengguna Windows.** Pasang WSL2 (`wsl --install` di PowerShell administrator), lalu buka "Ubuntu" dari menu Start. Di dalamnya, semua yang ada di kursus ini bekerja persis seperti tertulis. Jika Anda tetap di PowerShell biasa, banyak perintah punya padanan (`dir` untuk `ls`, `type` untuk `cat`, `Select-String` untuk `grep`) tetapi tutorial, Docker, dan alat data akan terus mengasumsikan shell Linux, jadi WSL2 menghemat banyak kerepotan.

## @lesson Path, file, dan lingkungan
Setiap file punya **path**, alamatnya di sistem file. **Path absolut** dimulai dari root (`/home/budi/kopiku/data/orders.csv`). **Path relatif** dimulai dari tempat Anda sekarang (`data/orders.csv`). Beberapa jalan pintas yang konstan dipakai: `~` adalah folder home Anda, `.` adalah folder saat ini, `..` adalah folder induk. Kalau sebuah skrip bilang "file not found", penyebabnya hampir selalu Anda berdiri di folder yang berbeda dari dugaan; jalankan `pwd` dan `ls` lebih dulu.

File yang namanya diawali titik (`.gitignore`, `.env`) bersifat **tersembunyi**; `ls -a` menampilkannya. Ekstensi file (`.csv`, `.py`) hanya petunjuk bagi manusia dan program, bukan jaminan isi.

Dua bagian lingkungan penting sejak awal:

- **Environment variable** adalah nilai bernama yang bisa dibaca setiap program, seperti `HOME` atau `PATH`. `echo $HOME` menampilkan salah satunya. Nanti Anda memakainya untuk mengirim pengaturan dan rahasia ke program tanpa menuliskannya di kode.
- **`PATH`** adalah daftar folder yang dicari shell saat Anda mengetik nama perintah. "command not found" berarti programnya belum terpasang, atau tidak berada di folder yang ada di `PATH`. Mengaktifkan virtual environment Python (pelajaran berikut) bekerja dengan menaruh foldernya di depan `PATH`.

**Encoding teks dan akhir baris** menyebabkan bug yang diam-diam. File teks adalah byte yang ditafsirkan lewat sebuah encoding; pakai **UTF-8** di mana-mana dan sebutkan saat membuka file di kode. Windows dan Linux mengakhiri baris dengan cara berbeda (`\r\n` vs `\n`); CSV yang dibuat di Windows bisa meninggalkan `\r` tak terlihat di akhir kolom terakhir, yang merusak perbandingan yang "tampak" identik.

**Izin (permission).** File punya izin baca, tulis, dan eksekusi untuk pemilik, grup, dan lainnya. `ls -l` menampilkannya (`-rwxr-xr-x`). `chmod +x script.sh` membuat skrip bisa dijalankan langsung. Anda akan lebih sering menemuinya sebagai "Permission denied", yang artinya pengguna yang menjalankan perintah tidak diizinkan melakukan aksi itu pada file tersebut. Jangan "memperbaikinya" dengan `sudo` secara membabi buta: itu menjalankan perintah dengan kuasa penuh dan membuat file yang kemudian hanya bisa diubah administrator.

## @lesson Redirect dan pipe: alat kecil yang disambung
Gagasan paling kuat di terminal adalah perintah mengerjakan satu tugas kecil, dan Anda menyambungkannya. Dua simbol melakukan penyambungan.

- `|` (pipe) mengirim keluaran satu perintah ke perintah berikutnya.
- `>` menulis keluaran ke file (menggantikan isinya), dan `>>` menambahkannya di akhir file.

Coba ini pada data KopiKu setelah Lab 0.1. Berapa pesanan per status?

```bash
cut -d, -f4 data/orders.csv | tail -n +2 | sort | uniq -c | sort -rn
```

Baca dari kiri ke kanan: `cut` mengambil kolom ke-4 yang dipisah koma (status), `tail -n +2` melewati baris judul, `sort` mengelompokkan nilai yang sama, `uniq -c` menghitung deretan nilai yang sama, dan `sort -rn` terakhir menaruh hitungan terbesar di atas. Lima alat kecil menggantikan sebuah program, dan tidak ada yang dimuat ke memori sekaligus, jadi cara ini berjalan pada file yang jauh lebih besar dari RAM Anda. Modul 1.1 mengembangkan keterampilan ini lebih dalam.

Perhatikan keluarannya juga memperlihatkan masalah data dari Modul 0.1: Anda akan melihat `paid`, `PAID`, dan `Paid` sebagai kelompok terpisah. Terminal adalah tempat yang bagus untuk *melihat data sebelum menulis kode untuknya*.

> **Peringatan:** `>` mengganti file tujuan seketika dan tanpa suara. `sort data.csv > data.csv` menghancurkan file itu (shell mengosongkannya sebelum `sort` membaca). Tulis ke file baru, lalu ganti namanya.

Setiap program punya tiga aliran standar: masukan (`stdin`), keluaran (`stdout`), dan error (`stderr`). Pipe membawa `stdout`; pesan error tetap muncul di layar Anda. Untuk menyimpan error juga, pakai `2>` (misalnya `python job.py > out.txt 2> errors.txt`). Pemisahan inilah yang membuat pipeline bisa gagal dengan jelas meski keluarannya sedang dialirkan ke tempat lain.

## @lesson Python: pasang sekali, lalu isolasi setiap proyek
Periksa yang Anda punya: `python3 --version`. Untuk kursus ini pakai Python 3.10 atau lebih baru. Di Linux dan macOS, gunakan package manager sistem atau installer resmi; di Windows, bekerjalah di dalam WSL2.

Masalah intinya: paket Python dipasang di satu tempat, sedangkan proyek berbeda butuh versi berbeda. Proyek A butuh `pandas 1.5`, proyek B butuh `pandas 2.2`. Kalau semuanya dipasang global, cepat atau lambat satu proyek merusak yang lain, atau merusak alat Python bawaan sistem operasi Anda. Solusinya adalah **virtual environment**: folder privat dengan Python dan paketnya sendiri, per proyek.

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

**Menjalankan skrip.** `python summarize.py data/orders.csv` menjalankan sebuah file; kata-kata setelah nama file masuk ke `sys.argv` dan diurai dengan rapi oleh modul standar `argparse`. Idiom `if __name__ == "__main__":` di bagian bawah berarti "jalankan bagian ini hanya ketika file dieksekusi langsung, bukan saat di-import", yang akan Anda pakai di setiap skrip yang kelak mungkin menjadi library.

**Membaca traceback.** Ketika Python gagal, ia mencetak *stack trace*. Bacalah **dari bawah**: baris terakhir menyebut jenis dan pesan error (`FileNotFoundError: [Errno 2] No such file or directory: 'data/orders.csv'`); baris di atasnya menunjukkan baris file mana yang memanggil apa. Frame terakhir di kode Anda sendiri biasanya tempat yang harus dilihat. Salin baris terakhir saat mencari bantuan atau bertanya ke orang.

## @lesson Git: jaring pengaman untuk semua yang Anda tulis
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

**Commit yang baik** kecil dan pesannya menjelaskan *apa dan mengapa* ("Reject orders with non-positive totals"), bukan "update" atau "fix". Commit ketika satu hal sudah berfungsi. Commit kecil membuat kesalahan mudah ditemukan dan dibatalkan.

**Membatalkan dengan aman** (pelajari sebelum Anda membutuhkannya):

- Membuang perubahan yang belum di-commit pada sebuah file: `git restore file.py`
- Mengeluarkan file dari staging: `git restore --staged file.py`
- Membatalkan commit dengan menambah commit baru yang membalikkannya: `git revert <commit>`
- Memperbaiki pesan commit terakhir (yang belum dibagikan): `git commit --amend`

**Branch** memungkinkan Anda bereksperimen tanpa menyentuh jalur utama: `git switch -c coba-parser-baru`, bekerja dan commit, lalu gabungkan (`git switch main && git merge coba-parser-baru`) atau buang. **Remote** seperti GitHub menyimpan salinan di tempat lain: `git remote add origin <url>` dan `git push -u origin main`. Repositori yang di-push adalah cadangan dan portofolio, tetapi juga sesuatu yang bisa dibaca orang lain, itulah mengapa dua poin berikutnya penting.

**`.gitignore`** mendaftar file yang tidak boleh dilacak Git: `venv/`, `.env`, `__pycache__/`, file data besar seperti `data/`. Catatan: mengabaikan file hanya berlaku untuk file yang belum di-commit. Kalau Anda sudah meng-commit `data/` sebelumnya, tambahkan ke `.gitignore` *dan* jalankan `git rm -r --cached data` untuk berhenti melacaknya.

> **Peringatan:** Riwayat Git permanen secara desain. File yang pernah di-commit hidup di setiap clone dan setiap commit lama, meski Anda menghapusnya di commit berikutnya. Karena itu rahasia tidak boleh di-commit, bahkan "sementara".

## @lesson Rahasia dan konfigurasi
**Rahasia (secret)** adalah apa pun yang memberi akses: password, API key, token, private key, connection string database yang berisi password. **Konfigurasi** adalah pengaturan yang berbeda antar lingkungan (host database di development vs produksi). Keduanya harus berada *di luar* kode Anda.

Versi pemula dari solusinya adalah environment variable:

```python
import os
db_password = os.environ["DB_PASSWORD"]      # gagal dengan jelas bila tidak ada: bagus
region = os.environ.get("REGION", "ap-southeast-1")   # dengan nilai bawaan yang tidak berbahaya
```

Untuk kerja lokal, taruh variabel di file bernama `.env` yang terdaftar di `.gitignore`, lalu muat dengan shell (`set -a; source .env; set +a`) atau library seperti `python-dotenv`. Di produksi, platform menyuntikkannya dari secrets manager. Commit sebuah `.env.example` berisi nilai palsu agar rekan tim tahu variabel apa saja yang ada.

Jika rahasia terlanjur di-commit atau di-push: **anggap sudah dicuri**, karena bot memindai repositori publik dalam hitungan menit. Urutan perbaikan penting: (1) **cabut dan ganti rahasia** di penyedianya, (2) baru bersihkan riwayat repositori bila perlu, (3) lalu tambahkan file ke `.gitignore` dan aktifkan secret scanning. Menghapus file di commit berikutnya *bukan* perbaikan.

## @lesson Kebiasaan kerja yang membuat Anda lebih cepat
Beberapa disiplin kecil memisahkan orang yang menyelesaikan pekerjaan dari orang yang bergulat dengan alatnya.

- **Satu proyek, satu folder, satu repositori, satu environment.** Untuk kursus ini: `~/kopiku/` berisi `venv/`, `data/`, skrip Anda, `requirements.txt`, `.gitignore`, dan `README.md` singkat yang menjelaskan cara menjalankan.
- **Jauhkan data dari Git, dan buat agar bisa direproduksi.** Data itu besar dan berubah; *resep* yang menghasilkannya (perintah generator) masuk ke README. Ini kebiasaan reprodusibilitas, dan perekrut memperhatikannya.
- **Buat error mudah dibantu.** Saat meminta bantuan, sertakan perintah persis yang Anda jalankan, teks error lengkap (sebagai teks, bukan tangkapan layar), apa yang Anda harapkan, versi Python dan OS Anda, dan apa yang sudah Anda coba. Pertanyaan yang rapi dijawab dalam hitungan menit; yang samar diabaikan.
- **Baca sebelum menempel.** Pahami setiap perintah yang Anda salin. Utamakan dokumentasi resmi untuk langkah instalasi; tutorial cepat usang.
- **Pakai editor yang membantu.** Visual Studio Code dengan ekstensi Python memberi syntax highlighting, terminal terintegrasi, dan debugger. Keterampilan terminal di modul ini bekerja sama di dalamnya.

Terakhir, **latih siklusnya** sampai otomatis: buat perubahan kecil, jalankan, lihat hasilnya, commit. Semua yang datang kemudian di kursus ini (tes, container, orchestrator) adalah siklus yang sama dengan alat yang lebih baik.

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

3. Salin generator data dari repositori kursus ke proyek Anda dan buat datanya. Ganti `<course-repo>` dengan lokasi tempat Anda meng-clone kursus ini:

```bash
cp <course-repo>/labs/shared/shopgen.py .
python3 shopgen.py --out data
```

4. Salin `starter/summarize.py` (ditampilkan di bawah) dari repositori kursus ke proyek Anda dan implementasikan. Ia harus menghitung setiap `order_id` sekali dan mengelompokkan menurut status huruf kecil. Coba jalankan, dan bandingkan dengan one-liner terminal dari materi (ingat one-liner itu menghitung ganda duplikat, jadi angkanya akan sedikit berbeda: itulah intinya):

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
python3 <course-repo>/labs/mod-0-2/check.py ~/kopiku
```

### @files
- labs/mod-0-2/starter/summarize.py :: Kerangka skrip Anda: isi logika penghitungannya :: starter
- labs/mod-0-2/check.py :: Pemeriksa yang memeriksa workspace Anda :: test
- labs/mod-0-2/reference/summarize.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference
- labs/mod-0-2/reference/make_workspace.sh :: Membuat workspace yang sudah jadi secara otomatis :: reference

### @deliverables
- `python3 labs/mod-0-2/check.py ~/kopiku` mencetak PASS di setiap baris
- Riwayat Git Anda punya minimal tiga commit dengan pesan yang bermakna
- `venv/`, `data/`, dan `.env` tidak dilacak oleh Git

### @verify
Pemeriksa itulah verifikasinya:

```bash
python3 labs/mod-0-2/check.py ~/kopiku
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
