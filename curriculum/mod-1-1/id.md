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
Modul 0.0 dan 0.1: dasar Python, dasar terminal, Git, dan gagasan virtual environment Python. Pasang `jq` (misalnya `brew install jq` di macOS atau `sudo apt install jq` di Debian/Ubuntu) untuk Pelajaran 3–4 dan lab, serta `pytest` (`pip install pytest`) jika Anda ingin menjalankan `scripts/prove.py`. Docker hanya dibutuhkan untuk bagian runtime opsional di lab; pemeriksaan otomatisnya tidak memerlukannya.

## @part Alat shell dan skrip

## @lesson Cara program Unix berpikir: proses, stream, dan exit code
Setiap kali Anda menjalankan perintah, komputer memulai sebuah **proses**: salinan program yang sedang berjalan. Bayangkan seorang pekerja di mejanya. Ia punya buku catatan sendiri (**memori**-nya) dan nomor lencana (**PID**-nya, id proses). Ia juga punya tiga saluran standar ke dunia luar: **stdin**, tempat masukannya datang; **stdout**, tempat keluaran normalnya pergi; dan **stderr**, tempat ia melaporkan error, dipisahkan dari keluaran normal. Setiap perintah membaca teks masuk dan menulis teks keluar, sehingga Anda bisa menyambung perintah apa pun ke perintah lain dengan **pipe** `|`: keluaran yang satu menjadi masukan yang berikutnya. Alat kecil, satu tugas masing-masing, disambung bersama: itulah yang membuat shell kuat.

Setiap proses berakhir dengan **exit code**, angka 0 sampai 255. Menurut konvensi **0 berarti sukses** dan selain itu berarti gagal. Shell menyimpan yang terakhir di `$?` (jika `data/orders.csv` belum dibuat, buat file contoh KopiKu lebih dulu dengan `python3 labs/shared/shopgen.py --out data`):

```bash
grep -q "paid" data/orders.csv ; echo $?     # 0 bila ditemukan, 1 bila tidak, 2 bila error
```

Exit code adalah cara scheduler (seperti **cron**, dibahas di Pelajaran 5), sistem **CI** (Continuous Integration, yang menjalankan pemeriksaan otomatis atas kode Anda), dan container memutuskan apakah job Anda berhasil. Skrip yang mencetak "ERROR" tetapi tetap keluar dengan 0 berbohong kepada semua sistem di sekitarnya. Dua operator memakai exit code secara langsung: `a && b` menjalankan `b` hanya jika `a` sukses, dan `a || b` menjalankan `b` hanya jika `a` gagal.

:::ask Apa yang dicetak ini jika `data/orders.csv` TIDAK mengandung kata `zzzz`?
```bash
grep -q zzzz data/orders.csv && echo FOUND || echo MISSING
```
@options
FOUND
* MISSING
kedua baris
@why
`grep -q` berhasil (exit code 0) hanya ketika menemukan kecocokan. Ia tidak menemukan apa pun, jadi keluar dengan 1: `&&` melewati `echo FOUND`, dan `||` menjalankan `echo MISSING`. Beginilah skrip bercabang berdasarkan berhasil dan gagal.
:::

Kode yang akan Anda temui lebih dulu:

| Kode | Arti |
|---|---|
| 0 | Sukses |
| 1 | Kegagalan umum (yang dipakai kebanyakan program) |
| 2 | Salah pakai perintah (argumen buruk) |
| 127 | Perintah tidak ditemukan |

:::advanced Nanti saja: kode lain dan perintah untuk memantau serta menghentikan program
Anda tidak membutuhkannya hari ini. Pelajaran 7 memakai kode 137 lagi, lengkap dengan ceritanya.

| Kode | Arti |
|---|---|
| 126 | Perintah ditemukan tetapi tidak bisa dieksekusi |
| 137 | Dimatikan dengan SIGKILL (128 + 9: **sinyal** adalah pesan yang dikirim sistem ke program). Di container ini biasanya berarti **kehabisan memori** |
| 143 | Dihentikan dengan SIGTERM (128 + 15): permintaan sopan untuk berhenti, misalnya dari `docker stop` |

Perintah proses yang berguna: `ps aux` (daftar proses), `top` atau `htop` (tampilan langsung CPU dan memori), `kill <pid>` (kirim SIGTERM), `kill -9 <pid>` (SIGKILL, tidak bisa ditangkap, pakai sebagai pilihan terakhir), dan `Ctrl+C` (kirim SIGINT ke proses latar depan).
:::

> 🛠 **Coba sendiri (8 menit, terminal).** Dari folder kursus (jalankan `python3 labs/shared/shopgen.py --out data` lebih dulu jika `data/orders.csv` belum ada), jalankan setiap perintah lalu `echo $?`: `grep -q delivered data/orders.csv`, `grep -q zzzz data/orders.csv`, `grep -q x /no/such/file`, `false`, `bash -c 'exit 7'`. Lalu simpan skrip `job.sh` berisi baris `#!/bin/bash` (memberi tahu sistem untuk menjalankannya dengan Bash), `set -e` (berhenti pada perintah pertama yang gagal, keduanya dibahas tuntas di Pelajaran 4), `echo start`, `false`, `echo never printed`; jalankan `bash job.sh` dan periksa `echo $?`. Setelah selesai, bersihkan dengan `rm job.sh`.
>
> **Seharusnya Anda melihat:** `0`, `1`, `2`, `1`, `7`; dan untuk skripnya `start` lalu exit code `1`. Hapus `set -e` dan jalankan lagi: baris terakhir kini ikut tercetak, dan exit code-nya menjadi `0`, sebuah kebohongan kepada setiap scheduler.

:::drill python Perintah mana yang jalan?
Di shell, `a && b && c` menjalankan perintah berikutnya hanya jika yang sebelumnya **berhasil** (exit code 0). Tulis `commands_run(codes)`: `codes` adalah daftar exit code yang *akan* dikembalikan tiap perintah, berurutan. Kembalikan berapa banyak yang benar-benar dijalankan.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("commands_run") ## Definisikan commands_run(codes).
commands_run([0, 0, 0]) == 3 ## Semua berhasil: ketiganya jalan.
commands_run([0, 1, 0]) == 2 ## Yang kedua jalan dan gagal; yang ketiga dilewati.
commands_run([1, 0, 0]) == 1 ## Yang pertama gagal: tidak ada setelahnya yang jalan.
commands_run([]) == 0 ## Tanpa perintah, tidak ada yang jalan.
@hint
Hitung perintah satu per satu. Setelah perintah yang kodenya bukan 0, berhenti.
@solution
def commands_run(codes):
    ran = 0
    for code in codes:
        ran += 1
        if code != 0:
            break
    return ran
:::

:::ask Sebuah skrip mencetak 'ERROR: file missing' lalu selesai normal dengan exit code 0. Apa kesimpulan cron atau sistem CI?
@options
* berhasil: hanya exit code yang dihitung
job gagal, karena kata ERROR dicetak oleh skrip
tidak ada, karena ia abaikan teks dan kode
@why
Scheduler, CI, dan container membaca exit code, bukan teksnya. Skrip yang mencetak error lalu keluar 0 melaporkan sukses ke semua sistem di sekitarnya. Pakai exit code bukan nol saat ada yang salah.
:::

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

Pada data KopiKu ini mencetak `cancelled 362`, `delivered 2148`, `paid 374`, `refunded 174`, `shipped 576`. Perhatikan ia menghitung baris duplikat juga, sehingga berbeda dari hitungan tanpa duplikat di Modul 0.1; Anda harus memutuskan apakah duplikat berpengaruh sebelum mempercayai hitungan apa pun.

> **Peringatan:** `awk -F,` dan `cut -d,` memecah di setiap koma, sehingga rusak pada nilai CSV seperti `"Santoso, Budi"`. Keduanya baik untuk file sederhana yang sudah dikenal. Untuk CSV sungguhan dengan field berkutip pakai modul `csv` Python, `csvkit`, atau Miller (`mlr`).

**Mencari dan memproses berkelompok.** `find data -name '*.gz' -print0 | xargs -0 -n1 gzip -t` menguji setiap file terkompresi, satu per perintah; `-print0` dan `-0` membuatnya aman untuk nama file yang mengandung spasi.

> 💡 **Jeda Praktik 1 (Eksplorasi Data Stream di Terminal):**
> Mari buktikan konsep pemrosesan teks Unix ini langsung di komputer Anda! Buka terminal di folder repositori kursus:
> 1. Buat data event jika belum ada: `python3 labs/shared/shopgen.py --out data`
> 2. Intip 3 baris pertama event NDJSON: `head -3 data/events.ndjson`
> 3. Hitung total baris log event: `wc -l data/events.ndjson`
> 4. Hitung event bertipe purchase: `grep -c "purchase" data/events.ndjson`
> **Seharusnya Anda melihat:** tiga baris JSON yang panjang (yang ketiga terpotong di tengah: baris rusak yang sengaja ditanam data), lalu `90900 data/events.ndjson`, lalu `15079`. Data Anda sudah siap! Lanjut ke Pelajaran 3 untuk membedah data JSON dengan `jq`.

:::drill python Jebakan uniq
Perintah shell `uniq -c` hanya menggabungkan duplikat yang **bertetangga**. Tulis `uniq_c(lines)`: kembalikan daftar pasangan `(count, line)`, tiap pasangan adalah deretan baris identik yang berdampingan.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("uniq_c") ## Definisikan uniq_c(lines).
uniq_c(["a", "a", "b"]) == [(2, "a"), (1, "b")] ## Dua baris a yang bertetangga menjadi satu pasangan.
uniq_c(["a", "b", "a"]) == [(1, "a"), (1, "b"), (1, "a")] ## Tidak bertetangga: a TIDAK digabung. Karena itu Anda `sort` dulu.
uniq_c(sorted(["a", "b", "a"])) == [(2, "a"), (1, "b")] ## Setelah diurutkan, duplikat menjadi bertetangga.
uniq_c([]) == [] ## Tidak ada masukan, tidak ada keluaran.
@hint
Telusuri baris-barisnya. Jika sebuah baris sama dengan sebelumnya, tambah 1 pada hitungan terakhir; jika tidak, mulai pasangan baru.
@solution
def uniq_c(lines):
    out = []
    for line in lines:
        if out and out[-1][1] == line:
            out[-1] = (out[-1][0] + 1, line)
        else:
            out.append((1, line))
    return out
:::

:::ask Anda menjalankan `cut -d, -f4 orders.csv | uniq -c` pada file tak terurut dan status yang sama muncul tiga kali. Mengapa?
@options
file berisi karakter tersembunyi di setiap barisnya
* uniq hanya menggabung tetangga, jadi urutkan kolomnya dulu
uniq hanya menghitung 100 baris pertama yang dilihat
@why
`uniq` membandingkan tiap baris dengan baris tepat sebelumnya. Nilai sama yang berjauhan tetap terpisah, jadi pipeline yang lazim adalah `sort | uniq -c`.
:::

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

`fromjson` mengurai satu baris sebagai JSON; tanda `?` menahan error ketika baris rusak, sehingga baris buruk dilewati alih-alih membatalkan seluruh proses. Pada event KopiKu ini menyimpan 89.987 dari 90.900 baris (913 sisanya terpotong) dalam kurang dari satu detik di laptop.

> **Peringatan:** `jq -s` ("slurp") memuat *seluruh* masukan ke memori sebagai satu array. Praktis sekaligus berbahaya: pada file besar, inilah cara persis container dimatikan. Pilih bentuk streaming (satu objek per baris) dan agregasikan dengan `sort | uniq -c`, atau pindah ke DuckDB (Modul 2.1) bila Anda butuh analitik sungguhan.

Kapan berhenti memakai alat shell? Ketika logikanya butuh percabangan, state, retry, atau tes. Pipeline shell lima tahap itu menyenangkan; skrip Bash 300 baris adalah beban. Beralihlah ke Python (Modul 1.2) ketika Anda mulai butuh array berisi array atau ingin menguji logikanya dengan unit test.

> 💡 **Jeda Praktik 2 (Eksperimen Parsing JSON dengan jq):**
> Coba perkakas `jq` langsung di terminal Anda, dan kenali baris rusak yang sengaja ditanam data:
> 1. Dua baris yang bersih: `head -2 data/events.ndjson | jq -c '{event_id, event_type}'`
> 2. Lima baris, seperti cara yang biasanya Anda coba pertama: `head -5 data/events.ndjson | jq -c '{event_id, event_type}'`
> 3. Parsing yang tahan error: `jq -R -c 'fromjson? | select(type == "object")' data/events.ndjson | head -3`
> **Seharusnya Anda melihat:** langkah 1 mencetak `{"event_id":"e00085531","event_type":"page_view"}` dan satu baris pendek lagi. Langkah 2 mencetak dua baris yang sama, lalu berhenti dengan `jq: parse error`: baris ketiga file itu terpotong di tengah (Anda sudah melihatnya di Jeda 1), dan `jq` biasa menyerah pada baris rusak pertama. Langkah 3 melewati baris itu dan mencetak tiga objek JSON lengkap, diawali `e00085531`, `e00017290`, dan `e00061551`. Baris rusak dilewati tanpa crash! Lanjut ke Pelajaran 4 untuk menulis skrip yang aman.

Di modul `json` Python, `json.loads(line)` mengurai satu string JSON dan melempar `json.JSONDecodeError` jika barisnya rusak. Karena JSON yang valid juga bisa berupa angka, string, atau list, periksa `isinstance(obj, dict)` bila Anda hanya menginginkan objek JSON.

:::drill python Lewati baris yang rusak
Sebuah file event berisi satu objek JSON per baris, dan sebagian baris terpotong. `jq 'fromjson?'` melewati yang rusak. Tulis `good_events(lines)`: kembalikan daftar objek hasil parse (dictionary) dari setiap baris yang JSON-nya valid **dan** berupa objek. Lewati yang lain tanpa melempar error.
@starter
import json
# tulis fungsi Anda di bawah baris ini

@check
defines("good_events") ## Definisikan good_events(lines).
good_events(['{"a": 1}', '{"a":', '{"b": 2}']) == [{"a": 1}, {"b": 2}] ## Baris yang terpotong dilewati.
good_events(["5", '"text"', "[1]"]) == [] ## JSON valid, tetapi bukan objek: dilewati juga.
good_events([]) == [] ## Tanpa baris, tanpa event.
good_events(["", '{"x": null}']) == [{"x": None}] ## Baris kosong dilewati; null di dalam objek tidak masalah.
@hint
Telusuri tiap baris dan urai di dalam blok `try` / `except` yang melewati JSON rusak; simpan hasil urai hanya jika bertipe dictionary.
@solution
import json
def good_events(lines):
    out = []
    for line in lines:
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            out.append(obj)
    return out
:::

:::ask Kapan sebaiknya berhenti menulis pipeline shell dan pindah ke Python?
@options
begitu pipeline punya lebih dari dua tahap saja
tidak pernah, karena alat shell selalu lebih cepat
* saat butuh percabangan, state, retry, atau unit test
@why
Pipeline lima tahap itu menyenangkan, tetapi logika dengan cabang, ingatan antar baris, retry, atau tes sebaiknya ada di kode yang bisa diuji. Skrip Bash 300 baris adalah beban.
:::

## @lesson Menulis skrip yang gagal dengan jelas
Skrip hanyalah perintah dalam sebuah file. Baris pertama, **shebang**, menyebut interpreternya: `#!/usr/bin/env bash`. Jalankan dengan `bash script.sh`, atau `chmod +x script.sh && ./script.sh`.

Secara bawaan Bash **terus berjalan setelah error**. Itu kebalikan dari kebutuhan job data. Mulailah setiap skrip dengan mode ketat:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e`: langsung keluar ketika sebuah perintah gagal.
- `-u`: perlakukan pemakaian variabel yang belum diset sebagai error (menangkap salah ketik seperti `$DATAA_DIR`).
- `-o pipefail`: pipeline gagal bila *tahap mana pun* gagal, bukan hanya yang terakhir. Tanpanya, `zcat broken.gz | wc -l` keluar dengan 0 meski `zcat` gagal di tengah jalan.

:::ask Sebuah pipeline adalah `zcat broken.gz | wc -l`. `zcat` gagal di tengah karena file rusak, `wc` tetap menghitung apa yang diterimanya. Tanpa `-o pipefail`, exit code apa yang dilaporkan pipeline?
@options
* 0: hanya tahap terakhir (`wc`) yang dilaporkan
bukan nol: `zcat` gagal, jadi pipeline juga
127: perintah tidak ditemukan
@why
Secara default pipeline melaporkan exit code **tahap terakhirnya**. `wc -l` berhasil, jadi pipeline tampak baik-baik saja padahal datanya tidak lengkap. `set -o pipefail` membuat pipeline gagal jika **tahap mana pun** gagal.
:::

Catatan: `-e` tidak terpicu di dalam kondisi `if`, di rantai `&&`/`||`, atau pada perintah yang kegagalannya Anda uji sendiri. Ia jaring pengaman, bukan pengganti berpikir.

Kebiasaan yang menjaga skrip tetap andal:

- **Beri tanda kutip pada variabel**: `"$file"`, bukan `$file`. Tanpa kutip, nama yang mengandung spasi menjadi dua argumen.
- **Validasi argumen**: `file="${1:?usage: report.sh <events.ndjson>}"` berhenti dengan pesan bila argumen tidak ada.
- **Bersihkan dengan `trap`**: `tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT` menghapus file sementara baik skrip sukses, gagal, maupun diinterupsi.
- **Tulis keluaran secara atomik**: tulis ke `out.csv.tmp`, lalu `mv out.csv.tmp out.csv`. Rename di file system yang sama bersifat atomik, sehingga pembaca melihat file lama yang lengkap atau file baru yang lengkap, tidak pernah yang setengah tertulis.
- **Log ke stderr, hasil ke stdout**: `echo "starting" >&2`. Ini menjaga aliran data tetap bersih untuk pipe.
- **Buat idempoten**: jalankan dua kali, hasil sama. Pakai path keluaran yang deterministik lalu timpa, atau tulis per partisi tanggal.
- **Lint**: `shellcheck script.sh` menemukan sebagian besar kesalahan kutip dan logika secara otomatis. Jalankan di CI.

:::ask `file="my report.csv"` dan skrip menjalankan `wc -l $file` (tanpa tanda kutip). Apa yang diterima `wc`?
@options
satu argumen: nama `my report.csv`
* dua argumen: `my` dan `report.csv`
tidak ada: shell berhenti sebelum menjalankannya
@why
Tanpa tanda kutip, shell memecah nilainya di spasi. Selalu tulis `"$file"`. `shellcheck` menandai persis kesalahan ini.
:::

:::talk Ke mana pesan itu pergi?
@teacher Skrip Anda mencetak hasilnya dengan `echo "total=42"` dan kemajuannya dengan `echo "starting..." >&2`. Anda menjalankannya begini: `bash report.sh > result.txt`. Tanda `>` mengirim keluaran normal skrip ke dalam file.
@ask Setelah selesai, apa isi `result.txt`?
@choice Kedua baris, karena keduanya dicetak oleh skrip yang sama | Keduanya keluar dari skrip yang sama, tetapi lewat dua saluran berbeda, seperti dua pipa. `>` hanya mengambil yang normal. Coba lagi.
@choice * Hanya `total=42`: pesan kemajuan lewat saluran error dan muncul di layar Anda | Betul. `>&2` mengirim pesan ke stderr, yang tidak ditangkap oleh `>`, sehingga file data Anda tetap bersih sementara kemajuan tetap terlihat di layar.
@choice Hanya `starting...`, karena dicetak lebih dulu | Urutan tidak penting di sini: yang menentukan adalah saluran mana yang dipakai setiap baris. Coba lagi.
@teacher Karena itulah skrip mencatat log ke stderr dan mencetak hasil ke stdout: pipa atau file menerima data yang bersih, dan manusia tetap melihat pesannya.
:::

> 💡 **Jeda Praktik 3 (Bangun report.sh - Bagian A):**
> Saatnya mengerjakan Bagian A dari lab ini!
> 1. Buka `labs/mod-1-1/report.sh` di editor teks Anda dan baca komentar header-nya, di sana tercantum 6 jenis baris keluaran `key=value` (`lines_total`, `malformed_lines`, `valid_events`, `unique_event_ids`, `distinct_users`, dan `type.<event_type>`) serta pemakaian `mktemp` dengan `trap` untuk pembersihan. Saat menjalankannya secara manual, selalu sertakan file masukan, misalnya `bash labs/mod-1-1/report.sh data/events.ndjson`.
> 2. Terapkan mode ketat `set -euo pipefail`, validasi argumen input `$1`, bersihkan file sementara dengan `mktemp` dan `trap`, lalu bangun pipeline ringkasan metrik menggunakan `jq`, `sort -u`, dan `wc -l`.
> 3. Uji pekerjaan Anda di terminal:
> `python3 labs/mod-1-1/test_lab.py TestReportScript -v`
> Setiap tes mencetak satu baris yang berakhir dengan `ok` atau `FAIL`, dan baris terakhir berbunyi `OK` bila kelima tes lulus. Di awal beberapa sudah berbunyi `ok` (skrip yang tidak berbuat apa-apa pun tetap gagal dengan keras tanpa argumen), jadi Anda baru selesai ketika seluruh keluaran berakhir dengan `OK`. Maka skrip stream Unix profesional Anda sudah jadi! Lanjut ke Pelajaran 5 tentang Cron.

## @part Menjalankan job: cron, container, dan batas

## @lesson Menjadwalkan job dengan cron
**cron** menjalankan perintah menurut jadwal. Ubah tabel Anda dengan `crontab -e`. Setiap baris punya lima field waktu lalu perintahnya:

```text
# m  h  dom mon dow  command
  0  2   *   *   *   /opt/kopiku/run_report.sh >> /var/log/kopiku/report.log 2>&1
 */15 *  *   *   *   /opt/kopiku/check_inbox.sh
```

Lima field tersebut adalah **menit** (`m`, 0–59), **jam** (`h`, 0–23), **tanggal dalam bulan** (`dom`, 1–31), **bulan** (`mon`, 1–12), dan **hari dalam seminggu** (`dow`, 0–7, dengan 0 dan 7 adalah Minggu serta `1-5` berarti Senin sampai Jumat). Tanda `*` berarti "setiap", `*/15` berarti "setiap kelipatan 15" (sintaks langkah), dan `a-b` berarti rentang inklusif. Jadi baris pertama berjalan pukul 02.00 setiap hari, dan baris kedua berjalan setiap 15 menit. Ketahui kejutan-kejutan ini sebelum ia menghabiskan satu malam Anda:

- **Environment minimal.** cron tidak memuat profil shell Anda. `PATH` pendek, virtual environment Anda tidak aktif, environment variable Anda tidak ada. Pakai path absolut, set variabel di dalam skrip, dan panggil `/opt/kopiku/venv/bin/python` secara langsung.
- **Keluaran senyap.** Keluaran dikirim ke email atau tidak ke mana-mana. Arahkan kedua aliran ke file log (`>> log 2>&1`) agar Anda bisa melihat apa yang terjadi.
- **Eksekusi tumpang tindih.** Jika satu putaran lebih lama dari interval, salinan kedua mulai dan keduanya bertabrakan. Jaga dengan kunci: `flock -n /tmp/report.lock /opt/kopiku/run_report.sh`.
- **Zona waktu.** cron memakai zona waktu server, dan pergeseran jam musim panas bisa melewati atau mengulang satu jam. Server sebaiknya berjalan di UTC, dan jadwal ditulis dengan mempertimbangkan hal tersebut.
- **Tanpa dependensi, tanpa retry, tanpa riwayat.** cron tidak tahu bahwa job B harus menunggu job A, tidak akan mencoba ulang, dan tidak menyimpan catatan eksekusi.

:::ask Skrip Anda berjalan di terminal tetapi gagal di bawah cron dengan `python: command not found`. Apa penyebab yang paling mungkin?
@options
cron tidak mendukung skrip Python
ekspresi jadwalnya salah
* cron punya environment minimal: `PATH` pendek, tanpa venv
@why
cron tidak memuat profil shell Anda. Pakai path absolut (`/opt/kopiku/venv/bin/python`), atur variabel di dalam skrip, dan alihkan output ke log (`>> log 2>&1`) supaya Anda bisa melihat apa yang terjadi.
:::

:::talk Ketika pekerjaan lebih lama daripada jadwalnya
@teacher Sebuah baris cron menjalankan laporan setiap 15 menit. Suatu hari database lambat, dan satu putaran memakan 20 menit.
@ask Apa yang dilakukan cron pada menit ke-15, saat putaran pertama masih berjalan?
@choice Ia menunggu putaran pertama selesai, baru memulai yang berikutnya | cron tidak tahu dan tidak peduli apa yang sedang dikerjakan pekerjaan Anda. Ia hanya melihat jam. Coba lagi.
@choice Ia menghentikan putaran pertama dan memulai yang baru | cron tidak pernah mematikan pekerjaan Anda. Coba lagi.
@choice * Ia tetap memulai salinan kedua, sehingga dua putaran bekerja bersamaan | Betul. cron hanya mengawasi jam, jadi kedua salinan bisa menulis file yang sama dan bertabrakan. Kunci seperti `flock -n` membuat salinan kedua menolak berjalan.
@teacher cron adalah jam yang sangat sederhana: tidak menunggu, tidak mencoba ulang, tidak mengingat putaran sebelumnya. Karena itu pipeline yang lebih besar nanti pindah ke orchestrator di kursus ini.
:::

Poin terakhir itulah alasan pipeline sungguhan pindah ke **orchestrator** seperti Airflow atau Dagster (Modul 2.4), yang menambah dependensi, retry, backfill, dan UI. cron tetap alat yang tepat untuk job sederhana yang mandiri di satu mesin.

> 🛠 **Coba sendiri (10 menit, terminal).** Anda tidak bisa menunggu sampai tengah malam, jadi latih tiga hal yang paling sering menjebak orang.
> 1. Tulis baris cron lima kolom untuk: setiap hari pukul 02:30; setiap 15 menit; pukul 06:00 hanya di hari kerja; tengah malam pada hari pertama setiap bulan.
> 2. Lihat seperti apa environment minimal cron: `env -i PATH=/usr/bin:/bin sh -c 'echo "HOME=[$HOME] VIRTUAL_ENV=[$VIRTUAL_ENV]"'`, lalu `echo "HOME=[$HOME] VIRTUAL_ENV=[$VIRTUAL_ENV]"` di shell Anda sendiri (catatan: `VIRTUAL_ENV` hanya terisi saat virtual environment Python sedang aktif).
> 3. Run yang tumpang tindih (khusus Linux; macOS tidak menyertakan `flock` secara bawaan): di satu terminal jalankan `flock -n /tmp/demo.lock sleep 20`; di terminal kedua jalankan `flock -n /tmp/demo.lock echo second; echo $?`.
>
> **Seharusnya Anda melihat:** `30 2 * * *`, `*/15 * * * *`, `0 6 * * 1-5`, `0 0 1 * *`; `HOME=[] VIRTUAL_ENV=[]` di environment minimal (shell Anda memiliki `HOME`, dan `VIRTUAL_ENV` saat venv aktif); dan `1` dari `flock` kedua tanpa `second` tercetak: kuncinya sedang dipegang, jadi salinan yang tumpang tindih menolak berjalan.

:::ask Apa yang dilakukan baris cron `*/15 * * * * /opt/kopiku/check_inbox.sh`?
@options
* menjalankan skrip tiap 15 menit, sepanjang hari, setiap hari
menjalankan skrip sekali, pada menit ke-15 lewat tengah malam
menjalankan skrip 15 kali sehari pada jam acak
@why
Lima field-nya adalah menit, jam, tanggal, bulan, hari dalam seminggu. `*/15` pada field menit berarti tiap menit ke-15, dan bintang berarti setiap jam dan setiap hari.
:::

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

:::talk Mengapa setiap build memakan waktu berminit-menit?
@teacher Seorang pembelajar menulis `COPY . .` lebih dulu dan `RUN pip install -r requirements.txt` sesudahnya. Ia mengubah satu baris kodenya sendiri lalu membangun ulang image.
@ask Apa yang dilakukan Docker pada langkah `pip install`?
@choice Melewatinya, karena requirements tidak berubah | Memang begitu, kalau sebelumnya hanya `requirements.txt` yang disalin. Tetapi `COPY . .` menyalin seluruh proyek, dan file yang diedit ikut di dalamnya, sehingga layer itu berubah. Coba lagi.
@choice * Menjalankannya lagi dan mengunduh semua paket, karena ada langkah sebelumnya yang berubah | Betul. Docker memakai ulang sebuah layer hanya jika semua yang ada sebelumnya tidak berubah. Satu baris yang diedit di folder yang disalin merusak cache, dan semua langkah sesudahnya dibangun ulang.
@choice Menanyakan kepada Anda apakah layer lama mau dipakai lagi | Docker tidak pernah bertanya: ia memutuskan dari apa yang berubah. Coba lagi.
@teacher Jadi salin `requirements.txt` lebih dulu, instal, dan salin kode Anda paling akhir. Taruh yang paling jarang berubah di atas, dan build harian Anda selesai dalam hitungan detik.
:::

Mengapa setiap baris tampak seperti itu:

- **`FROM python:3.12-slim`**: selalu pin tag versi. `latest` berubah sewaktu-waktu tanpa sepengetahuan Anda dan merusak reprodusibilitas. Image `slim` jauh lebih kecil daripada yang penuh; Alpine lebih kecil lagi tetapi memakai library C yang berbeda, yang sering berarti paket Python harus dikompilasi dari sumber, jadi slim adalah bawaan yang lebih aman.
- **Layer caching.** Setiap instruksi membuat sebuah **layer**, dan Docker memakai ulang layer bila masukannya tidak berubah. Menyalin hanya `requirements.txt` lebih dulu, memasang, *baru* menyalin kode berarti suntingan kode sehari-hari tidak memicu instalasi ulang semua dependensi. Taruh yang paling jarang berubah di atas.
- **`--no-cache-dir`** menghentikan pip menyimpan paket unduhan di dalam image, menjaganya tetap kecil.
- **Pengguna non-root.** Proses di container berjalan sebagai root secara bawaan. Jika aplikasi dibobol, root di dalam container adalah masalah yang jauh lebih besar. Jalankan sebagai pengguna biasa. (Saat memasang folder, kepemilikan file kemudian penting: pastikan pengguna itu bisa membaca data yang dipasang.)
- **Bentuk exec (`["python", "etl.py"]`)** menjalankan program Anda langsung sebagai proses utama, sehingga ia menerima sinyal berhenti dan keluar dengan bersih. Bentuk shell (`CMD python etl.py`) membungkusnya dalam shell yang bisa menelan sinyal.
- **`ENTRYPOINT` plus `CMD`**: entrypoint adalah programnya, `CMD` memberi argumen bawaan yang bisa ditimpa oleh `docker run`.
- **`.dockerignore`** mendaftar file yang tidak boleh dikirim ke proses build: virtual environment, data, `.git`, `.env`. Ia mempercepat build dan mencegah rahasia ikut tertanam ke dalam image.

Hal lain yang akan Anda pakai: **volume dan bind mount** menyimpan data di luar container (container itu sekali pakai: apa pun yang ditulis di dalamnya hilang bersamanya); **environment variable** (`-e KEY=value`) mengirim konfigurasi; **`docker compose`** menggambarkan beberapa layanan (database, broker, job Anda) dalam satu file YAML dan menaruhnya di jaringan bersama tempat mereka saling menemukan lewat nama layanan; dan **multi-stage build** mengompilasi di satu tahap dan hanya menyalin hasilnya ke image akhir yang kecil.

> 💡 **Jeda Praktik 4 (Optimasi Dockerfile & .dockerignore - Bagian B):**
> Saatnya mengemas aplikasi ke container standar produksi:
> 1. Buka `labs/mod-1-1/Dockerfile` dan `labs/mod-1-1/.dockerignore` di editor teks Anda.
> 2. Perbaiki Dockerfile: pin `FROM python:3.12-slim`, tetapkan `WORKDIR /app`, salin `app/requirements.txt` dan jalankan `pip install --no-cache-dir -r requirements.txt` (atau atur `PIP_NO_CACHE_DIR`) sebelum menyalin `app/`, buat lalu beralih ke pengguna non-root (`RUN useradd --create-home appuser` lalu `USER appuser`), dan ganti `CMD` bentuk shell di starter dengan bentuk exec `ENTRYPOINT ["python", "etl.py"]` serta `CMD ["/data/orders.csv"]`.
> 3. Pastikan `.dockerignore` mengecualikan folder `venv/`, `data/`, `.git/`, dan `.env`.
> 4. Uji di terminal:
> `python3 labs/mod-1-1/test_lab.py TestDockerfile -v`
> Jika kedelapan tes Dockerfile berakhir dengan `ok` dan baris terakhir berbunyi `OK`, container Anda sudah siap kirim ke produksi! Lanjut ke Pelajaran 7 untuk memahami batas memori & exit code 137.

:::ask Anda memulai tiga container dari image yang sama. Berapa image yang ada?
@options
tiga: setiap container punya image sendiri-sendiri
* satu: container hanya salinan berjalannya
nol, karena image hilang begitu ia dijalankan
@why
Image adalah templat read-only yang dibangun sekali dari Dockerfile. Container adalah instans yang berjalan (atau berhenti) darinya, dan Anda bisa memulai sebanyak yang Anda mau dari image yang sama.
:::

:::ask Mengapa tim mengemas job dalam container, bukan sekadar menyalin skrip ke server?
@options
container membuat kodenya sendiri berjalan jauh lebih cepat
container berarti tidak ada server yang dibutuhkan lagi
* job membawa Python dan library-nya sendiri
@why
Container mengemas aplikasi beserta semua kebutuhannya, terisolasi dari host. Itu mengakhiri 'di mesin saya jalan': laptop, uji, dan produksi memakai lingkungan yang sama.
:::

## @lesson Batas sumber daya dan job yang mati dengan kode 137
Container bisa diberi batas: `docker run --memory 512m --cpus 1 ...`, atau di konfigurasi orchestrator. Jika sebuah proses di container memakai memori melebihi batasnya, **OOM killer** kernel Linux mematikannya dengan SIGKILL. Anda melihat exit code **137** dan, di `docker inspect`, `"OOMKilled": true`. Tidak ada traceback Python, karena proses tidak sempat mencetaknya: dari dalam ia hanya lenyap, itulah sebabnya kegagalan ini membingungkan pemula.

:::ask Job container berakhir dengan exit code **137** dan `OOMKilled: true`. Apa yang terjadi?
@options
skrip mengalami error biasa dan mengembalikan 137
* kernel membunuhnya: ia melebihi batas memorinya
`docker stop` memintanya berhenti dengan sopan
@why
137 = 128 + 9: proses menerima SIGKILL. Dalam container dengan batas memori ini adalah OOM killer. Penghentian sopan (`docker stop`) memberi 143 (128 + 15, SIGTERM). Obatnya adalah memproses sebagai stream atau potongan terbatas, bukan memuat semuanya sekaligus.
:::

:::talk Tanpa pesan error sama sekali
@teacher Sebuah pekerjaan dalam container berjalan dua puluh menit lalu container-nya begitu saja hilang. Lognya berhenti di tengah pekerjaan, tanpa traceback Python dan tanpa teks error.
@ask Apa yang harus dilihat lebih dulu?
@choice Kode Python, baris demi baris, untuk mencari syntax error | Syntax error akan dilaporkan di awal, dengan traceback. Pekerjaan ini berjalan dua puluh menit. Coba lagi.
@choice * Exit code dan `docker inspect`: kode 137 dengan `OOMKilled: true` berarti kernel mematikannya karena memakai terlalu banyak memori | Betul. Proses itu tidak sempat mencetak apa pun, itulah mengapa tidak ada traceback. Perbaikannya adalah memproses secara stream atau dalam potongan terbatas, bukan memburu bug di satu baris.
@choice Ekspresi jadwal pekerjaan itu | Pekerjaan itu memang mulai dan berjalan. Jadwal bukan masalahnya. Coba lagi.
@teacher Saat pekerjaan lenyap tanpa pesan, pikirkan "dimatikan dari luar", dan tanyakan pada sistem, bukan pada kode.
:::

Penyebab yang lazim dalam kerja data:

- **Memuat semuanya sekaligus**: `pandas.read_csv` pada file yang jauh lebih besar dari memori (pandas sering butuh beberapa kali ukuran file di RAM), `jq -s`, atau `list(rows)` pada iterator raksasa.
- **Pertumbuhan tanpa batas**: mengumpulkan hasil dalam list atau dictionary yang tumbuh mengikuti masukan.
- **Fan-out**: join atau explode yang melipatgandakan baris.

Perbaikannya mengikuti prinsip yang sama: **proses secara stream atau dalam potongan terbatas, dan jaga memori sebanding dengan satu batch, bukan dengan seluruh masukan.** Alat shell di modul ini melakukannya secara alami; Modul 1.2 menunjukkan versi Python-nya (generator), dan Modul 2.1 menunjukkan engine (DuckDB, Polars) yang memindahkan sementara ke disk (spill to disk) alih-alih mati.

Batas terkait yang perlu dipantau: **disk** (disk penuh membuat penulisan gagal dengan cara aneh, jadi bersihkan file sementara dan pantau pemakaian), throttling **CPU** (job Anda hanya jadi lambat), dan **file terbuka**. Ketika container berperilaku aneh, perintah pertama adalah `docker logs <nama>`, `docker stats` (memori dan CPU langsung), `docker inspect <nama>` (exit code, OOMKilled), dan `docker exec -it <nama> sh` (melihat-lihat di dalam).

> 🛠 **Coba sendiri (10 menit).**
> 1. Exit code 137 adalah 128 + 9, sinyal SIGKILL yang membunuh container yang melewati batas memorinya. Buktikan: `sleep 100 & kill -9 $!; wait $!; echo $?`.
> 2. Bandingkan memori. Di Python, tulis dua fungsi yang menjumlahkan total yang valid dari `data/orders.csv` (ingat untuk membersihkan awalan `"Rp "` atau koma serta mengabaikan nilai negatif atau non-angka): satu membaca seluruh file ke list dulu (`list(csv.reader(...))`), yang lain menjumlahkan baris demi baris. Bungkus setiap pemanggilan dengan `tracemalloc` (`tracemalloc.start()` sebelumnya, `tracemalloc.get_traced_memory()[1]` sesudahnya, lalu `tracemalloc.stop()`) dan cetak puncaknya dalam KiB.
>
> **Seharusnya Anda melihat:** `137`, dan puncak sekitar 1.500 KiB untuk versi list dengan `csv.reader` (sekitar 2.000 KiB jika Anda memakai `DictReader`) dibanding sekitar 40 KiB untuk versi streaming, bagaimanapun cara menulisnya (kira-kira 40 kali lebih kecil di file kecil ini). Pada file seribu kali lebih besar, rasio itulah yang menentukan apakah container-nya selamat.

:::ask Sebuah container yang menjalankan job pandas berhenti dengan exit code 137 tanpa pesan error Python. Apa yang paling mungkin terjadi?
@options
* melebihi batas memorinya dan kernel mematikannya
kode Python punya syntax error di baris terakhirnya
ekspresi jadwalnya ditulis dengan cara yang salah
@why
137 adalah 128 + 9: proses menerima SIGKILL. Saat container melewati batas memori, OOM killer melakukannya, sehingga tidak ada traceback. Proses dalam chunk atau stream agar memori tetap datar.
:::

## @lab Lab: laporan shell dan container untuk job KopiKu
Bagian A: tulis skrip shell yang tangguh untuk meringkas file event website, yang berisi baris rusak dan duplikat. Bagian B: kemas job Python kecil menjadi image Docker yang baik. Keduanya diperiksa otomatis.

> **Sudah menyelesaikan Jeda Praktik 3 dan 4?** Anda sudah membangun dan menguji kedua bagiannya, langsung lompat ke **@verify** di bawah (dan opsional Langkah 7 jika Docker terpasang).

### @steps
1. Buat data jika belum, dan lihat file event sebelum menulis apa pun:

```bash
python3 labs/shared/shopgen.py --out data
head -3 data/events.ndjson
wc -l data/events.ndjson
```

2. Bagian A. Buka `labs/mod-1-1/report.sh`. Implementasikan sehingga mencetak baris yang dijelaskan di komentar header-nya. Bangun pipeline tahap demi tahap di terminal Anda dulu; ketika tiap bagian mencetak angka yang benar, pindahkan ke skrip. Pakai `jq -R 'fromjson? ...'` untuk parsing yang tangguh dan `sort -u` untuk membuang id event duplikat.
3. Buat skrip profesional: mode ketat, argumen wajib dengan pesan penggunaan, `mktemp` untuk file sementara apa pun, dan `trap` untuk menghapusnya. Jalankan `shellcheck` bila Anda punya.
4. Jalankan tes bagian A seiring Anda bekerja (`test_lab.py` memakai modul bawaan Python `unittest`, jadi nama kelas seperti `TestReportScript` berjalan langsung tanpa `pytest`):

```bash
python3 labs/mod-1-1/test_lab.py TestReportScript -v
```

5. Bagian B. Buka `labs/mod-1-1/Dockerfile` dan `.dockerignore`. Starter-nya bisa dibangun, tetapi melanggar beberapa praktik baik yang diperiksa `TestDockerfile`: base image tanpa pin, tanpa `WORKDIR`, tanpa layer caching, cache pip masih disimpan (`--no-cache-dir` / `PIP_NO_CACHE_DIR`), pengguna root, perintah bentuk shell, tanpa daftar abaikan (`venv`, `data`, `.git`, `.env`), serta memastikan tidak ada rahasia tertanam di Dockerfile. Perbaiki satu per satu dengan pelajaran sebagai panduan.
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
- labs/mod-1-1/reference/.dockerignore :: Daftar abaikan referensi untuk bagian B :: reference

### @deliverables
- `python3 labs/mod-1-1/test_lab.py` lulus semua tes
- report.sh memberi angka yang benar pada `data/events.ndjson` dan gagal dengan exit code bukan nol bila tidak diberi file atau filenya tidak ada
- Anda bisa menjelaskan apa yang dicegah oleh masing-masing dari delapan pemeriksaan di `TestDockerfile` (Dockerfile dan `.dockerignore`)

### @verify
Jalankan kedua bagian sekaligus dari root repositori:

```bash
python3 labs/mod-1-1/test_lab.py -v
python3 scripts/prove.py mod-1-1    # membutuhkan pytest (pip install pytest)
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
