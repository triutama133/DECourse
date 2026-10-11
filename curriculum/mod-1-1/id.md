---
title: Linux, Shell Scripting, dan Docker untuk Data Engineer
duration: 2-3 minggu
summary: Memproses teks bergigabyte dengan beberapa alat shell, menulis skrip yang gagal dengan jelas alih-alih diam-diam, menjadwalkannya, dan mengemas job dalam container agar berjalan sama di mana-mana.
why: Tutorial menjalankan semuanya di laptop dengan RAM 16 GB dan terminal yang ramah. Job produksi berjalan di container minimal 512 MB, terjadwal, tanpa ada yang mengawasi, dan kegagalan yang keluar dengan kode 0 lebih buruk daripada crash.
---

## @outcomes
- Menggabungkan grep, cut, sort, uniq, awk, dan jq untuk meringkas file teks dan JSON besar tanpa memuatnya ke memori
- Menulis skrip Bash yang berhenti saat error, membersihkan sisa kerjanya sendiri, dan melaporkan masalah dengan exit code yang benar
- Menjelaskan mengapa sebuah pipeline bisa sukses padahal tahap awalnya gagal, dan mencegahnya
- Menjadwalkan job dengan cron dan menghindari kejutan yang lazim (environment, tumpang tindih, zona waktu)
- Menulis Dockerfile yang cepat dibangun, berjalan sebagai pengguna non-root dan dapat direproduksi, serta mendiagnosis container yang dimatikan karena memakai terlalu banyak memori

## @prereq
Modul 0.2 dan 0.3: dasar terminal, Git, dan gagasan virtual environment Python. Docker hanya dibutuhkan untuk bagian runtime opsional di lab; pemeriksaan otomatisnya tidak memerlukannya.

## @lesson Cara program Unix berpikir: proses, stream, dan exit code
Segala yang Anda jalankan adalah sebuah **proses**: program dengan memorinya sendiri, id numerik (PID), dan tiga aliran standar: **stdin** (masukan), **stdout** (keluaran), dan **stderr** (error dan diagnostik). Karena perintah hanya membaca dan menulis aliran byte, Anda bisa menyambung perintah apa pun ke perintah lain dengan `|`. Inilah desain yang membuat shell kuat: program kecil, satu tugas masing-masing, disambung bersama.

Setiap proses berakhir dengan **exit code**, angka 0 sampai 255. Menurut konvensi **0 berarti sukses** dan selain itu berarti gagal. Shell menyimpan yang terakhir di `$?`:

```bash
grep -q "paid" data/orders.csv ; echo $?     # 0 bila ditemukan, 1 bila tidak, 2 bila error
```

Exit code adalah cara scheduler, sistem CI, dan container memutuskan apakah job Anda berhasil. Skrip yang mencetak "ERROR" tetapi tetap keluar dengan 0 berbohong kepada semua sistem di sekitarnya. Dua operator memakai exit code secara langsung: `a && b` menjalankan `b` hanya jika `a` sukses, dan `a || b` menjalankan `b` hanya jika `a` gagal.

Beberapa kode yang akan Anda temui:

| Kode | Arti |
|---|---|
| 0 | Sukses |
| 1 | Kegagalan umum (yang dipakai kebanyakan program) |
| 2 | Salah pakai perintah (argumen buruk) |
| 126 / 127 | Perintah ditemukan tetapi tidak bisa dieksekusi / perintah tidak ditemukan |
| 137 | Dimatikan dengan SIGKILL (128 + 9). Di container ini biasanya berarti **kehabisan memori** |
| 143 | Dihentikan dengan SIGTERM (128 + 15): permintaan sopan untuk berhenti, misalnya dari `docker stop` |

Perintah proses yang berguna: `ps aux` (daftar proses), `top` atau `htop` (tampilan langsung CPU dan memori), `kill <pid>` (kirim SIGTERM), `kill -9 <pid>` (SIGKILL, tidak bisa ditangkap, pakai sebagai pilihan terakhir), dan `Ctrl+C` (kirim SIGINT ke proses latar depan).

## @lesson Perkakas pengolah teks
Sebagian besar data di server datang sebagai teks. Alat-alat ini memungkinkan Anda memeriksa dan meringkasnya dalam hitungan detik, dan mereka **streaming**: memproses satu baris sekali waktu, sehingga pemakaian memori tetap datar bahkan pada file 50 GB. Pakai untuk eksplorasi dan untuk job sederhana yang tangguh.

| Alat | Tugas | Contoh |
|---|---|---|
| `head`, `tail` | Baris pertama atau terakhir | `tail -n +2 f.csv` (lewati header) |
| `wc -l` | Hitung baris | `wc -l events.ndjson` |
| `grep` | Simpan baris yang cocok (`-v` membalik, `-c` menghitung) | `grep -c "cancelled" orders.csv` |
| `cut` | Ambil kolom menurut pemisah | `cut -d, -f4 orders.csv` |
| `sort` | Urutkan baris (`-n` numerik, `-r` terbalik, `-u` unik, `-k` per kolom) | `sort -t, -k6 -n orders.csv` |
| `uniq -c` | Hitung baris sama yang **bersebelahan** | `... \| sort \| uniq -c` |
| `tr` | Terjemahkan atau hapus karakter | `tr 'A-Z' 'a-z'` |
| `sed` | Cari dan ganti dalam aliran | `sed 's/Rp //'` |
| `awk` | Olah kolom, hitung, agregasi | lihat di bawah |

Dua jebakan. Pertama, `uniq` hanya meringkas duplikat yang *bersebelahan*, jadi hampir selalu Anda `sort` dulu. Kedua, `sort` mengikuti aturan locale Anda; untuk pengurutan byte yang cepat dan dapat diprediksi pakai `LC_ALL=C sort`.

**awk** adalah bahasa pemrograman mungil untuk kolom. Ia membaca satu baris, memecahnya menjadi field (`$1`, `$2`, ...), dan menjalankan kode Anda. `NR` adalah nomor baris dan `END { ... }` berjalan sekali di akhir. Menghitung pesanan per status, tanpa membedakan huruf besar kecil, termasuk baris duplikat:

```bash
awk -F, 'NR > 1 { n[tolower($4)]++ } END { for (s in n) print s, n[s] }' data/orders.csv | sort
```

Pada data KopiKu ini mencetak `cancelled 362`, `delivered 2148`, `paid 374`, `refunded 174`, `shipped 576`. Perhatikan ia menghitung baris duplikat juga, sehingga berbeda dari hitungan tanpa duplikat di Modul 0.2; Anda harus memutuskan apakah duplikat berpengaruh sebelum mempercayai hitungan apa pun.

> **Peringatan:** `awk -F,` dan `cut -d,` memecah di setiap koma, sehingga rusak pada nilai CSV seperti `"Santoso, Budi"`. Keduanya baik untuk file sederhana yang sudah dikenal. Untuk CSV sungguhan dengan field berkutip pakai modul `csv` Python, `csvkit`, atau Miller (`mlr`).

**Mencari dan memproses berkelompok.** `find data -name '*.gz' -print0 | xargs -0 -n1 gzip -t` menguji setiap file terkompresi, satu per perintah; `-print0` dan `-0` membuatnya aman untuk nama file yang mengandung spasi.

## @lesson jq: gagasan yang sama untuk JSON
Event klik dan log biasanya berupa **NDJSON**: satu objek JSON per baris. `jq` adalah `awk` untuk JSON. Hal pokoknya:

```bash
head -2 data/events.ndjson | jq -c '{event_id, event_type}'
# {"event_id":"e00085531","event_type":"page_view"}
# {"event_id":"e00017290","event_type":"page_view"}
```

- `.field` memilih sebuah field; `.a.b` masuk lebih dalam; `.[]` mengiterasi array.
- `select(kondisi)` menyimpan item yang cocok: `jq 'select(.event_type == "purchase")'`.
- `-r` mencetak string mentah (tanpa tanda kutip), `-c` mencetak JSON ringkas satu baris, `@tsv` dan `@csv` memformat array menjadi baris tabel: `jq -r '[.event_id, .event_type] | @tsv'`.
- `-R` membaca setiap baris masukan sebagai teks mentah, bukan JSON, yang menjadi kunci parsing yang **tangguh**:

```bash
jq -R -c 'fromjson? | select(type == "object")' data/events.ndjson | wc -l
```

`fromjson` mengurai satu baris sebagai JSON; tanda `?` menahan error ketika baris rusak, sehingga baris buruk dilewati alih-alih membatalkan seluruh proses. Pada event KopiKu ini menyimpan 89.987 dari 90.900 baris (913 sisanya terpotong) dalam sekitar setengah detik di laptop.

> **Peringatan:** `jq -s` ("slurp") memuat *seluruh* masukan ke memori sebagai satu array. Praktis sekaligus berbahaya: pada file besar, inilah cara persis container dimatikan. Pilih bentuk streaming (satu objek per baris) dan agregasikan dengan `sort | uniq -c`, atau pindah ke DuckDB (Modul 2.1) bila Anda butuh analitik sungguhan.

Kapan berhenti memakai alat shell? Ketika logikanya butuh percabangan, state, retry, atau tes. Pipeline shell lima tahap itu menyenangkan; skrip Bash 300 baris adalah beban. Beralihlah ke Python (Modul 1.2) ketika Anda mulai butuh array berisi array atau ingin menguji logikanya dengan unit test.

## @lesson Menulis skrip yang gagal dengan jelas
Skrip hanyalah perintah dalam sebuah file. Baris pertama, **shebang**, menyebut interpreternya: `#!/usr/bin/env bash`. Jalankan dengan `bash script.sh`, atau `chmod +x script.sh && ./script.sh`.

Secara bawaan Bash **terus berjalan setelah error**. Itu kebalikan dari kebutuhan job data. Mulailah setiap skrip dengan mode ketat:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e`: langsung keluar ketika sebuah perintah gagal.
- `-u`: perlakukan pemakaian variabel yang belum diset sebagai error (menangkap salah ketik seperti `$DATAA_DIR`).
- `-o pipefail`: pipeline gagal bila *tahap mana pun* gagal, bukan hanya yang terakhir. Tanpanya, `zcat rusak.gz | wc -l` keluar dengan 0 meski `zcat` gagal di tengah jalan.

Catatan: `-e` tidak terpicu di dalam kondisi `if`, di rantai `&&`/`||`, atau pada perintah yang kegagalannya Anda uji sendiri. Ia jaring pengaman, bukan pengganti berpikir.

Kebiasaan yang menjaga skrip tetap andal:

- **Beri tanda kutip pada variabel**: `"$file"`, bukan `$file`. Tanpa kutip, nama yang mengandung spasi menjadi dua argumen.
- **Validasi argumen**: `file="${1:?usage: report.sh <events.ndjson>}"` berhenti dengan pesan bila argumen tidak ada.
- **Bersihkan dengan `trap`**: `tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT` menghapus file sementara baik skrip sukses, gagal, maupun diinterupsi.
- **Tulis keluaran secara atomik**: tulis ke `out.csv.tmp`, lalu `mv out.csv.tmp out.csv`. Rename di file system yang sama bersifat atomik, sehingga pembaca melihat file lama yang lengkap atau file baru yang lengkap, tidak pernah yang setengah tertulis.
- **Log ke stderr, hasil ke stdout**: `echo "starting" >&2`. Ini menjaga aliran data tetap bersih untuk pipe.
- **Buat idempoten**: jalankan dua kali, hasil sama. Pakai path keluaran yang deterministik lalu timpa, atau tulis per partisi tanggal.
- **Lint**: `shellcheck script.sh` menemukan sebagian besar kesalahan kutip dan logika secara otomatis. Jalankan di CI.

## @lesson Menjadwalkan job dengan cron
**cron** menjalankan perintah menurut jadwal. Ubah tabel Anda dengan `crontab -e`. Setiap baris punya lima field waktu lalu perintahnya:

```text
# m  h  dom mon dow  command
  0  2   *   *   *   /opt/kopiku/run_report.sh >> /var/log/kopiku/report.log 2>&1
 */15 *  *   *   *   /opt/kopiku/check_inbox.sh
```

Baris pertama berjalan pukul 02.00 setiap hari. Ketahui kejutan-kejutan ini sebelum ia menghabiskan satu malam Anda:

- **Environment minimal.** cron tidak memuat profil shell Anda. `PATH` pendek, virtual environment Anda tidak aktif, environment variable Anda tidak ada. Pakai path absolut, set variabel di dalam skrip, dan panggil `/opt/kopiku/venv/bin/python` secara langsung.
- **Keluaran senyap.** Keluaran dikirim ke email atau tidak ke mana-mana. Arahkan kedua aliran ke file log (`>> log 2>&1`) agar Anda bisa melihat apa yang terjadi.
- **Eksekusi tumpang tindih.** Jika satu putaran lebih lama dari interval, salinan kedua mulai dan keduanya bertabrakan. Jaga dengan kunci: `flock -n /tmp/report.lock /opt/kopiku/run_report.sh`.
- **Zona waktu.** cron memakai zona waktu server, dan pergeseran jam musim panas bisa melewati atau mengulang satu jam. Server sebaiknya berjalan di UTC, dan jadwal ditulis dengan itu dalam benak.
- **Tanpa dependensi, tanpa retry, tanpa riwayat.** cron tidak tahu bahwa job B harus menunggu job A, tidak akan mencoba ulang, dan tidak menyimpan catatan eksekusi.

Poin terakhir itulah alasan pipeline sungguhan pindah ke **orchestrator** seperti Airflow atau Dagster (Modul 2.4), yang menambah dependensi, retry, backfill, dan UI. cron tetap alat yang tepat untuk job sederhana yang mandiri di satu mesin.

## @lesson Container: lingkungan yang sama di mana-mana
"Di mesin saya jalan" adalah masalah tertua dalam perangkat lunak. Job Anda bergantung pada versi Python tertentu, library, paket sistem, dan tata letak file; server punya yang berbeda. **Container** mengemas aplikasi bersama semua yang dibutuhkannya untuk berjalan, terisolasi dari host, sehingga berperilaku sama di laptop Anda, di CI, dan di produksi.

Dua istilah yang harus dibedakan:

- **Image** adalah templat baca-saja: file system yang dikemas dan perintah bawaannya. Dibangun sekali dari sebuah **Dockerfile**.
- **Container** adalah instans image yang sedang berjalan (atau berhenti). Anda bisa memulai banyak container dari satu image.

Container bukan mesin virtual: mereka berbagi kernel host, sehingga mulai dalam sedetik dan memakai sedikit memori, tetapi terisolasi menurut proses, file system, dan pengaturan jaringan.

Dockerfile minimal untuk job Python:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ .
RUN useradd --create-home appuser
USER appuser
ENTRYPOINT ["python", "etl.py"]
CMD ["/data/orders.csv"]
```

Bangun dan jalankan, dengan memasang (mount) folder data dari komputer Anda ke dalam container secara read-only:

```bash
docker build -t kopiku-etl .
docker run --rm -v "$PWD/data:/data:ro" kopiku-etl
```

Mengapa setiap baris tampak seperti itu:

- **`FROM python:3.12-slim`**: selalu pin tag versi. `latest` berubah di bawah Anda dan merusak reprodusibilitas. Image `slim` jauh lebih kecil daripada yang penuh; Alpine lebih kecil lagi tetapi memakai library C yang berbeda, yang sering berarti paket Python harus dikompilasi dari sumber, jadi slim adalah bawaan yang lebih aman.
- **Layer caching.** Setiap instruksi membuat sebuah **layer**, dan Docker memakai ulang layer bila masukannya tidak berubah. Menyalin hanya `requirements.txt` lebih dulu, memasang, *baru* menyalin kode berarti suntingan kode sehari-hari tidak memicu instalasi ulang semua dependensi. Taruh yang paling jarang berubah di atas.
- **`--no-cache-dir`** menghentikan pip menyimpan paket unduhan di dalam image, menjaganya tetap kecil.
- **Pengguna non-root.** Proses di container berjalan sebagai root secara bawaan. Jika aplikasi dibobol, root di dalam container adalah masalah yang jauh lebih besar. Jalankan sebagai pengguna biasa. (Saat memasang folder, kepemilikan file kemudian penting: pastikan pengguna itu bisa membaca data yang dipasang.)
- **Bentuk exec (`["python", "etl.py"]`)** menjalankan program Anda langsung sebagai proses utama, sehingga ia menerima sinyal berhenti dan keluar dengan bersih. Bentuk shell (`CMD python etl.py`) membungkusnya dalam shell yang bisa menelan sinyal.
- **`ENTRYPOINT` plus `CMD`**: entrypoint adalah programnya, `CMD` memberi argumen bawaan yang bisa ditimpa oleh `docker run`.
- **`.dockerignore`** mendaftar file yang tidak boleh dikirim ke proses build: virtual environment, data, `.git`, `.env`. Ia mempercepat build dan mencegah rahasia terpanggang ke dalam image.

Hal lain yang akan Anda pakai: **volume dan bind mount** menyimpan data di luar container (container itu sekali pakai: apa pun yang ditulis di dalamnya hilang bersamanya); **environment variable** (`-e KEY=value`) mengirim konfigurasi; **`docker compose`** menggambarkan beberapa layanan (database, broker, job Anda) dalam satu file YAML dan menaruhnya di jaringan bersama tempat mereka saling menemukan lewat nama layanan; dan **multi-stage build** mengompilasi di satu tahap dan hanya menyalin hasilnya ke image akhir yang kecil.

## @lesson Batas sumber daya dan job yang mati dengan kode 137
Container bisa diberi batas: `docker run --memory 512m --cpus 1 ...`, atau di konfigurasi orchestrator. Jika sebuah proses di container memakai memori melebihi batasnya, **OOM killer** kernel Linux mematikannya dengan SIGKILL. Anda melihat exit code **137** dan, di `docker inspect`, `"OOMKilled": true`. Tidak ada traceback Python, karena proses tidak sempat mencetaknya: dari dalam ia hanya lenyap, itulah sebabnya kegagalan ini membingungkan pemula.

Penyebab yang lazim dalam kerja data:

- **Memuat semuanya sekaligus**: `pandas.read_csv` pada file yang jauh lebih besar dari memori (pandas sering butuh beberapa kali ukuran file di RAM), `jq -s`, atau `list(rows)` pada iterator raksasa.
- **Pertumbuhan tanpa batas**: mengumpulkan hasil dalam list atau dictionary yang tumbuh mengikuti masukan.
- **Fan-out**: join atau explode yang melipatgandakan baris.

Perbaikannya mengikuti prinsip yang sama: **proses secara stream atau dalam potongan terbatas, dan jaga memori sebanding dengan satu batch, bukan dengan seluruh masukan.** Alat shell di modul ini melakukannya secara alami; Modul 1.2 menunjukkan versi Python-nya (generator), dan Modul 2.1 menunjukkan engine (DuckDB, Polars) yang menumpahkan ke disk alih-alih mati.

Batas terkait yang perlu dipantau: **disk** (disk penuh membuat penulisan gagal dengan cara aneh, jadi bersihkan file sementara dan pantau pemakaian), throttling **CPU** (job Anda hanya jadi lambat), dan **file terbuka**. Ketika container berperilaku aneh, perintah pertama adalah `docker logs <nama>`, `docker stats` (memori dan CPU langsung), `docker inspect <nama>` (exit code, OOMKilled), dan `docker exec -it <nama> sh` (melihat-lihat di dalam).

## @lab Lab: laporan shell dan container untuk job KopiKu
Bagian A: tulis skrip shell yang tangguh untuk meringkas file event website, yang berisi baris rusak dan duplikat. Bagian B: kemas job Python kecil menjadi image Docker yang baik. Keduanya diperiksa otomatis.

### @steps
1. Buat data jika belum, dan lihat file event sebelum menulis apa pun:

```bash
python3 labs/shared/shopgen.py --out data
head -3 data/events.ndjson
wc -l data/events.ndjson
```

2. Bagian A. Buka `labs/mod-1-1/report.sh`. Implementasikan sehingga mencetak baris yang dijelaskan di komentar header-nya. Bangun pipeline tahap demi tahap di terminal Anda dulu; ketika tiap bagian mencetak angka yang benar, pindahkan ke skrip. Pakai `jq -R 'fromjson? ...'` untuk parsing yang tangguh dan `sort -u` untuk membuang id event duplikat.
3. Buat skrip profesional: mode ketat, argumen wajib dengan pesan penggunaan, `mktemp` untuk file sementara apa pun, dan `trap` untuk menghapusnya. Jalankan `shellcheck` bila Anda punya.
4. Jalankan tes bagian A seiring Anda bekerja:

```bash
python3 labs/mod-1-1/test_lab.py TestReportScript -v
```

5. Bagian B. Buka `labs/mod-1-1/Dockerfile` dan `.dockerignore`. Starter-nya bisa dibangun, tetapi melanggar beberapa praktik baik: base image tanpa pin, tanpa layer caching, pengguna root, perintah bentuk shell, tanpa daftar abaikan. Perbaiki satu per satu dengan materi sebagai panduan.
6. Jalankan pemeriksaan Dockerfile:

```bash
python3 labs/mod-1-1/test_lab.py TestDockerfile -v
```

7. Opsional, jika Docker terpasang: bangun dan jalankan sungguhan, lalu coba batas memori.

```bash
docker build -t kopiku-etl labs/mod-1-1
docker run --rm -v "$PWD/data:/data:ro" kopiku-etl
docker run --rm --memory 64m -v "$PWD/data:/data:ro" kopiku-etl
```

### @files
- labs/mod-1-1/report.sh :: File kerja Anda untuk bagian A :: starter
- labs/mod-1-1/Dockerfile :: File kerja Anda untuk bagian B (perbaiki masalahnya) :: starter
- labs/mod-1-1/.dockerignore :: File kerja Anda: apa yang dijauhkan dari image :: starter
- labs/mod-1-1/app/etl.py :: Job Python yang dikontainerkan (sudah disediakan) :: data
- labs/mod-1-1/app/requirements.txt :: Dependensinya (sudah disediakan) :: data
- labs/mod-1-1/test_lab.py :: Tes yang memeriksa kedua bagian :: test
- labs/mod-1-1/reference/report.sh :: Solusi referensi bagian A (coba sendiri dulu!) :: reference
- labs/mod-1-1/reference/Dockerfile :: Solusi referensi bagian B :: reference

### @deliverables
- `python3 labs/mod-1-1/test_lab.py` lulus semua tes
- report.sh memberi angka yang benar pada `data/events.ndjson` dan gagal dengan exit code bukan nol bila tidak diberi file atau filenya tidak ada
- Anda bisa menjelaskan apa yang dicegah oleh masing-masing dari enam perbaikan di Dockerfile Anda

### @verify
Jalankan kedua bagian sekaligus dari root repositori:

```bash
python3 labs/mod-1-1/test_lab.py -v
```

Untuk membandingkan dengan hasil yang sudah benar: `LAB_DIR=reference python3 labs/mod-1-1/test_lab.py`.

## @chaos File parsial yang dimuat "dengan sukses"
### @scenario
Setiap malam pukul 01.00 sebuah job cron membaca ekspor pesanan kemarin, file terkompresi gzip yang diunggah mitra ke folder bersama, dan memuat totalnya ke warehouse. Pada tanggal 12 dashboard keuangan menunjukkan omset hanya 6% dari normal. Log job menulis `done` dan exit code-nya 0. File di disk tampak baik, dan menjalankan ulang job secara manual pukul 10.00 memberi angka yang benar.

Skripnya: `zcat /incoming/orders.csv.gz | awk -F, '{...}' > /warehouse/daily.csv`.

### @cause
Unggahan mitra masih berlangsung ketika job mulai pukul 01.00. File sudah ada tetapi belum lengkap, dan gzip melaporkan "unexpected end of file". Namun dalam pipeline, exit code adalah milik perintah **terakhir**: `zcat` gagal, `awk` dengan senang hati memproses baris yang diterimanya dan keluar dengan 0, sehingga skrip sukses. Keluaran yang tidak lengkap menggantikan file lengkap hari sebelumnya karena job menulis langsung ke path akhir.

Tidak ada yang memeriksa bahwa masukan lengkap, bahwa keluaran masuk akal, atau bahwa tahap-tahap awal pipeline sukses.

### @fix
1. Tambahkan `set -euo pipefail` agar kegagalan di tahap mana pun menggagalkan skrip (dalam uji coba, gzip terpotong yang dialirkan ke `wc -l` mencetak hitungan parsial dan tetap keluar dengan 0 sampai `pipefail` diset).
2. Verifikasi masukan sebelum dipakai: `gzip -t file.gz`, dan tunggu penanda selesai (file `_SUCCESS` atau checksum yang dipublikasikan mitra) alih-alih menebak jam.
3. Tulis keluaran ke file sementara dan `mv` ke tempatnya hanya setelah semuanya sukses, sehingga eksekusi gagal tidak pernah menggantikan data yang baik.
4. Tambahkan pemeriksaan kewajaran pada hasil (jumlah baris atau omset dalam rentang beberapa hari terakhir) yang menggagalkan job bila ada yang janggal.
5. Beri alert ketika job gagal atau tidak berjalan sama sekali.

### @pattern
Sebuah pipeline sukses hanya bila setiap tahapnya sukses. Verifikasi masukan, gagal pada tahap mana pun, dan jangan pernah menimpa keluaran yang baik dengan keluaran yang belum diverifikasi.

## @quiz
### Apa yang diubah `set -o pipefail` dalam skrip Bash?
- [ ] Membuat setiap perintah dalam skrip berjalan paralel sehingga pipeline selesai lebih cepat
- [x] Pipeline gagal bila perintah mana pun di dalamnya gagal, tidak hanya yang terakhir
- [ ] Mencegah skrip membuat file sementara atau menulis ke disk
- [ ] Membuat skrip berhenti setiap kali variabel yang belum diset dipakai dalam perintah apa pun

> Tanpa pipefail, exit code pipeline adalah milik perintah terakhirnya, sehingga kegagalan awal (seperti zcat yang terpotong) bisa tersembunyi. Variabel yang belum diset adalah tugas `set -u`.

### Container keluar dengan kode 137 dan log berhenti mendadak tanpa pesan error. Apa penyebab yang paling mungkin?
- [ ] Kode Python melempar exception yang tidak ditangani, yang selalu dicetak sebelum keluar
- [ ] Dockerfile memakai bentuk shell untuk CMD, bukan bentuk exec
- [x] Proses dimatikan oleh sistem karena melebihi batas memori yang diberikan kepadanya
- [ ] Image dibangun dari base image yang terlalu kecil untuk menjalankan Python

> 137 adalah 128 + 9: proses menerima SIGKILL. Di container itu biasanya OOM killer kernel; proses tidak sempat mencetak apa pun.

### Mengapa `sort | uniq -c` perlu `sort` lebih dulu?
- [ ] `uniq` hanya bisa membaca file dari disk dan tidak menerima masukan lewat pipe, sehingga perlu file sementara
- [ ] `sort` menerjemahkan teks ke format biner yang kemudian bisa dipahami dan dihitung oleh `uniq`
- [x] `uniq` hanya menggabungkan baris identik yang bersebelahan, jadi baris sama harus diurutkan berdampingan
- [ ] `sort` membuang baris kosong dan baris header yang kalau tidak akan membuat `uniq` salah menghitung

> uniq membandingkan tiap baris hanya dengan baris sebelumnya. Pengurutan mengumpulkan baris yang sama sehingga tiap nilai berbeda dihitung sekali.

### Di Dockerfile, mengapa menyalin `requirements.txt` dan menjalankan `pip install` sebelum menyalin sisa kode?
- [ ] pip menolak memasang paket bila kode aplikasi sudah ada di dalam image
- [x] Docker memakai ulang layer dependensi bila hanya kode berubah, sehingga build ulang cepat
- [ ] File system di container menjadi baca-saja setelah instruksi COPY pertama dijalankan
- [ ] Urutannya tidak berpengaruh nyata, tetapi menjadi konvensi agar Dockerfile lebih mudah dibaca orang

> Setiap instruksi membuat layer yang di-cache. Dependensi jarang berubah dan kode sering berubah, jadi menaruh instalasi sebelum penyalinan kode menghindari instalasi ulang setiap kali.

### Mengapa container sebaiknya berjalan sebagai pengguna non-root?
- [ ] Pengguna root tidak bisa membaca file yang disalin ke image dengan instruksi COPY
- [ ] Proses non-root memakai lebih sedikit memori karena melewati beberapa pemeriksaan kernel
- [x] Jika aplikasi dibobol, penyerang hanya mendapat hak akses yang jauh lebih sedikit
- [ ] Docker tidak akan memulai container yang proses utamanya berjalan sebagai root

> Hak akses minimum membatasi kerusakan akibat kerentanan. Ini praktik keamanan, bukan syarat dari Docker.

### Job cron berjalan baik saat Anda menjalankannya manual tetapi gagal saat dijalankan cron, dengan `command not found`. Apa penjelasan yang paling mungkin?
- [ ] cron hanya menjalankan skrip yang ditulis dalam bahasa shell itu sendiri, dan tidak bisa memulai program Python atau Perl
- [ ] File skrip kehilangan izin eksekusi tepat pada saat cron memulainya untuk pertama kali
- [x] cron berjalan dengan environment minimal: PATH pendek, tanpa profil login, dan tanpa virtual environment yang aktif
- [ ] cron tidak bisa menjalankan perintah yang membaca atau menulis file di disk, hanya perintah yang mencetak ke layar

> cron tidak memuat profil login shell Anda. Pakai path absolut, set variabel yang dibutuhkan di dalam skrip, dan panggil Python milik virtual environment secara langsung.

### Apa yang dilakukan `jq -R 'fromjson?'` pada file yang sebagian barisnya rusak?
- [ ] Memperbaiki baris JSON rusak dengan menebak kurung, kutip, dan koma yang hilang, lalu tetap memakainya
- [ ] Berhenti di baris rusak pertama dan melaporkan nomor baris itu sebagai error fatal
- [x] Mengurai tiap baris sendiri-sendiri dan diam-diam melewati baris yang bukan JSON valid, tanpa gagal
- [ ] Memuat seluruh file ke memori lebih dulu agar setiap baris rusak bisa ditemukan sebelum parsing

> `-R` membaca baris mentah, `fromjson` mengurai satu baris, dan `?` menahan error saat gagal, sehingga satu baris buruk tidak membatalkan proses. Hitung apa yang Anda lewati agar kehilangannya terlihat.

### Pendekatan mana yang membuat keluaran skrip aman dari kondisi setengah tertulis bila skrip gagal di tengah?
- [ ] Menulis langsung ke file akhir dan menghapusnya di trap bila skrip gagal
- [x] Menulis ke file sementara di folder yang sama, lalu me-rename-nya ke tempatnya di akhir
- [ ] Menjalankan skrip dua kali dan membandingkan kedua keluaran sebelum memakai salah satunya
- [ ] Mengarahkan keluaran skrip ke `/dev/null` dan membuat file sebenarnya dari log

> Rename di file system yang sama bersifat atomik, sehingga pembaca melihat file lama yang lengkap atau file baru yang lengkap. Pendekatan trap-lalu-hapus masih memperlihatkan file parsial selama skrip berjalan.

## @resources
- [Manual GNU Bash](https://www.gnu.org/software/bash/manual/bash.html)
- [Manual jq](https://jqlang.github.io/jq/manual/)
- [ShellCheck](https://www.shellcheck.net/)
- [Dokumen Docker: praktik terbaik Dockerfile](https://docs.docker.com/build/building/best-practices/)
