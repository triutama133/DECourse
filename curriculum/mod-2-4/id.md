---
title: Orkestrasi Data dengan Dagster dan Airflow
duration: 3 minggu
summary: Pahami peran krusial orkestrator dalam pipeline modern (dependensi, retry, backfill, observabilitas), aturan idempotensi yang menjamin keamanan data, serta bangun pipeline harian di Dagster berbasis partitioned assets berdampingan dengan komparasi ekuivalennya di Airflow.
why: Banyak tutorial Airflow pemula hanya mengajarkan task echo hello world. Di lingkungan produksi nyata, orkestrator adalah benteng pertahanan yang mencegah retry menggandakan kalkulasi revenue, memungkinkan backfill data 90 hari tanpa merusak riwayat, dan memberi peringatan pada pukul 06:00 jika pipeline pukul 02:00 ternyata gagal berjalan.
---

## @outcomes
- Menjelaskan fungsi sejati orkestrator di luar sekadar cron, serta batasan apa yang sengaja bukan menjadi tanggung jawabnya
- Menguraikan anatomi sebuah run: jadwal (schedule), data interval atau partisi, relasi dependensi, kebijakan retry, dan mekanisme backfill
- Menerapkan prinsip idempotensi mutlak sehingga setiap task atau partisi data aman untuk dieksekusi ulang kapan saja
- Membangun pipeline terpartisi di Dagster lengkap dengan resources, asset checks, retry policy, dan jadwal berbasis zona waktu, serta mengujinya secara otomatis
- Membaca dan memahami DAG modern berbasis Airflow TaskFlow API, serta membandingkan paradigma task-centric vs asset-centric secara objektif

## @prereq
Modul 1.1 (cron), Modul 1.2 (idempotensi, retry), dan Modul 2.3 (dbt). Jalankan `pip install -r labs/mod-2-4/requirements.txt` untuk menginstal Dagster. Kode Airflow dipaparkan sebagai materi perbandingan konseptual dan tidak diwajibkan diinstal untuk lab lokal.

## @part Konsep orkestrasi

## @lesson Apa yang dilakukan orchestrator, dan apa yang bukan tugasnya
Pada Modul 1.1, cron menjalankan skrip Python semata-mata berdasarkan penunjuk jam. Cron sama sekali tidak mengetahui apakah Job B membutuhkan output valid dari Job A, tidak memiliki mekanisme auto-retry jika terjadi kegagalan jaringan sementara, tidak menyimpan rekaman riwayat eksekusi, dan tidak bisa memperingatkan Anda jika suatu jadwal terlewatkan. Dalam pipeline data nyata yang terdiri dari puluhan tahapan dan dimiliki oleh lintas tim, pertanyaan operasional berkembang drastis: *tahapan mana yang harus jalan setelah apa? apa yang terjadi jika langkah ekstraksi gagal pada pukul 03:00 pagi? bagaimana cara menjalankan ulang data 30 hari ke belakang setelah perbaikan bug tanpa merusak dashboard bisnis? bagaimana kita memantau apakah pipeline kita sehat?*

**Orchestrator** (orkestrator) adalah control plane arsitektural yang menjawab semua tantangan tersebut. Orkestrator menyediakan kapabilitas inti:

- **Penjadwalan (Scheduling)**: menjalankan pekerjaan berdasarkan jadwal waktu (time-based schedule) atau event-driven (kedatangan file baru di S3, update pada dataset upstream).
- **Manajemen Dependensi (Dependencies)**: menyusun graf terarah yang menegaskan prasyarat eksekusi; langkah independen berjalan paralel, sedangkan langkah dependen menunggu hingga pendahulunya tuntas.
- **Retry Otomatis dan Timeout**: percobaan ulang otomatis dengan jeda waktu terencana (exponential backoff), serta batas durasi eksekusi maksimum agar proses yang menggantung tidak memakan resource selamanya.
- **State dan Riwayat Terpusat**: setiap run dan setiap langkah dicatat statusnya, log eksekusi tersimpan rapi, metrik durasi tercatat, dan semuanya dapat dicari melalui antarmuka web.
- **Backfill**: mengeksekusi ulang rentang data masa lalu secara terkontrol dan berurutan saat terjadi perubahan logika bisnis atau pemulihan bencana data.
- **Alerting dan Observabilitas**: mengirimkan notifikasi instan saat terjadi kegagalan, run yang terlewat (missing SLA), atau langkah yang durasi jalannya jauh melampaui batas normal.
- **Parameterisasi dan Konfigurasi**: memisahkan kode pipeline dari variabel dinamis, seperti rentang tanggal eksekusi, target environment (staging vs prod), dan manajemen kredensial.

Apa yang **bukan** tugas orkestrator: orkestrator bukanlah tempat untuk melakukan pemrosesan data komputasi berat. Orkestrator kelas produksi bertindak sebagai **pemicu (trigger)** dan **pemantau (monitor)** pekerjaan; pekerjaan komputasi berat itu sendiri harus dieksekusi di engine yang memang dirancang untuk tujuan tersebut, seperti model dbt di data warehouse, distributed job di Apache Spark, query analitik di DuckDB/ClickHouse, atau micro-batch di polars/pandas container. Kode orkestrasi Anda harus dibuat sangat ramping: hanya berisi deklarasi dependensi, penjadwalan, dan wiring arsitektur, sedangkan logika bisnis data murni tetap berada di fungsi Python modular dan SQL yang dapat diuji tersendiri (unit testable).

Dua ekosistem orkestrator yang paling dominan di industri adalah **Apache Airflow** (standar de facto industri yang sudah lama mapan, berpusat pada task/tugas, digunakan oleh ribuan korporasi global) dan **Dagster** (orkestrator modern yang berpusat pada data asset, dirancang mengikuti aliran lifecycle data). Ada pula alternatif lain seperti Prefect, Kestra, dan Mage; namun begitu Anda menguasai prinsip fundamental di modul ini, konsep tersebut dapat ditransfer ke platform mana pun dengan mudah.

> 🛠 **Coba sendiri (20 menit, Python).** Bangun orkestrator mini. Dependensinya adalah `{"extract": [], "clean": ["extract"], "audit": ["extract"], "load": ["clean"], "report": ["load"]}`, dan setiap task adalah fungsi Python kecil. Buat `load` memunculkan `RuntimeError("warehouse busy")` pada dua panggilan pertamanya dan berhasil pada panggilan ketiga. Tulis `run(retries)`: mulai sebuah task hanya jika semua task hulunya berhasil, ulangi sampai `retries` kali tambahan saat ia gagal, tandai `failed` jika jatah ulang habis, dan tandai semua yang ada di hilir kegagalan sebagai `skipped`. Cetak satu baris per percobaan dan status akhir setiap task. Jalankan dengan `retries=2` dan sekali lagi dengan `retries=1`.
>
> **Seharusnya Anda melihat:** dengan `retries=2`, `load` gagal dua kali (`warehouse busy`) dan berhasil pada percobaan ke-3, dan kelima task berakhir `success`. Dengan `retries=1`, `load` berakhir `failed`, `report` menjadi `skipped`, dan `extract`, `clean`, serta `audit` tetap `success`: `audit` tidak bergantung pada `load`, jadi kegagalan itu tidak menghentikannya. Loop kecil itulah inti setiap orkestrator: dependensi, retry, dan status untuk setiap task.

:::drill python Task mana yang jalan lebih dulu?
Tulis `run_order(deps)`: `deps` memetakan tiap task ke daftar task yang dibutuhkannya lebih dulu, misalnya `{"load": ["extract"], "extract": []}`. Kembalikan daftar semua task dalam urutan jalan yang valid. Jika beberapa task siap bersamaan, ambil menurut urutan abjad.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("run_order") ## Definisikan run_order(deps).
run_order({"load": ["extract"], "extract": []}) == ["extract", "load"] ## extract harus sebelum load.
run_order({"c": ["a", "b"], "b": ["a"], "a": []}) == ["a", "b", "c"] ## c butuh a dan b; b butuh a.
run_order({"b": [], "a": [], "c": ["a"]}) == ["a", "b", "c"] ## a dan b sama-sama siap: urut abjad. c hanya menunggu a.
run_order({}) == [] ## Tanpa task, tanpa urutan.
@hint
Ulangi: ambil setiap task yang belum selesai dan semua kebutuhannya sudah selesai; pilih yang pertama menurut abjad; tandai selesai.
@solution
def run_order(deps):
    done = []
    while len(done) < len(deps):
        ready = sorted(t for t in deps if t not in done and all(d in done for d in deps[t]))
        done.append(ready[0])
    return done
:::

## @lesson Konsep inti: runs, intervals, dan partitions
Graf dependensi di orkestrator dimodelkan sebagai **DAG (Directed Acyclic Graph)**: node melambangkan task atau asset data, tanda panah melambangkan "berjalan setelah" atau "bergantung pada", dan sifat **acyclic** memastikan tidak ada lingkaran setan/rekursi tak berujung (no circular dependencies), sehingga urutan eksekusi selalu deterministik.

:::talk Hari mana yang diproses putaran pukul 02:00?
@teacher Sebuah pekerjaan harian dijadwalkan pukul 02:00 setiap malam. Putaran yang mulai pukul 02:00 pada 6 Januari akan memproses "pesanan hari itu".
@ask Pesanan hari mana yang seharusnya diproses?
@choice 6 Januari, karena itu tanggal di kalender saat ia berjalan | Pukul 02:00 pada 6 Januari hampir tidak ada yang sudah memesan: harinya baru saja dimulai. Coba lagi.
@choice * 5 Januari: interval yang berakhir tengah malam, tepat sebelum putaran | Betul. Orchestrator berjalan setelah sebuah interval berakhir, dan menyerahkan awal dan akhir interval itu kepada tugas. Putaran tanggal 6 memproses tanggal 5.
@choice Keduanya, untuk berjaga-jaga | Memproses keduanya akan menghitung 5 Januari dua kali ketika putaran berikutnya mengerjakannya lagi. Coba lagi.
@teacher Tanggal tempat sebuah putaran berada adalah interval yang dicakupnya, bukan saat ia kebetulan mulai. Itulah yang membuat retry dan backfill menghasilkan hasil yang sama.
:::

Konsep yang paling sering membingungkan insinyur pemula adalah **data interval** (istilah di Airflow) atau **partition** (istilah di Dagster). Pipeline harian yang dijadwalkan berjalan pada pukul 02:00 tanggal 6 Januari **bukanlah** memproses data tanggal 6 Januari. Pipeline tersebut bertugas memproses **data tanggal 5 Januari**, karena data transaksi tanggal 5 Januari baru resmi lengkap dan ditutup saat jam menunjukkan tepat tengah malam 23:59:59. Orkestrator memodelkan prinsip ini secara eksplisit: setiap run selalu terikat pada interval data yang menjadi tanggung jawabnya (`2026-01-05`), yang diinjeksikan ke dalam kode Anda sebagai **logical date** (variabel `ds` di Airflow) atau **partition key** (`context.partition_key` di Dagster). Kode pipeline Anda wajib membaca dan memproses data **khusus untuk interval tersebut**, dan pantang membaca waktu "saat ini" (wall-clock time). Jika suatu run diulang besok, atau dilakukan backfill bulan depan, ia harus selalu menghasilkan output yang identik untuk tanggal 5 Januari. Menggunakan waktu sistem (`datetime.now()` atau fungsi database `CURRENT_DATE()`) di dalam task akan merusak konsistensi ini secara diam-diam.

Satu detail Airflow 3 yang perlu Anda tahu: string cron biasa seperti `schedule="0 2 * * *"` memberi run pukul 02:00 *saat ia dimulai* sebagai logical date-nya, tanpa interval sebelumnya. Kalau Anda ingin run pukul 02:00 tanggal 6 mencakup 5 Januari, pakai `CronDataIntervalTimetable("0 2 * * *", timezone="Asia/Jakarta")` (dari `airflow.timetables.interval`), atau kurangi satu hari di satu tempat saja dalam kode Anda. Dicek dengan Airflow 3.1.8. Aturannya tetap sama: pakai tanggal yang diberikan run, dan putuskan di satu tempat hari mana yang dimaksud.

Kosakata penting lainnya dalam dunia orkestrasi:

- **Task / Op / Asset**: unit terkecil dari pekerjaan yang dieksekusi. Relasi antar unit ini membentuk DAG.
- **Schedule dan Trigger**: penentu kapan suatu run dimulai (ekspresi cron seperti `0 2 * * *` dengan **zona waktu** eksplisit, atau berdasarkan pemicu event eksternal).
- **Sensor**: mekanisme orkestrator yang menunggu kondisi tertentu terpenuhi sebelum melanjutkan langkah, seperti menunggu file mendarat di object storage atau menunggu partisi tabel upstream selesai dibuat.
- **Retry**: percobaan ulang otomatis saat task gagal. Terapkan retry hanya untuk kegagalan bersifat *transient* (koneksi database putus sesaat, limit rate API eksternal); jangan pernah retry kegagalan deterministik (data corrupt, syntax error, bug logika kode) karena pasti akan selalu gagal berulang kali.
- **Concurrency Limits** (pools, tags, slots): batas kuota paralelisme untuk membatasi berapa banyak task atau partisi yang boleh berjalan serentak guna melindungi sistem database sumber agar tidak tumbang.
- **Backfill**: proses mengeksekusi sekumpulan partisi atau interval data masa lalu, baik untuk data historis baru maupun kalkulasi ulang.
- **Catchup**: konfigurasi scheduler apakah ia harus otomatis mengeksekusi semua interval masa lalu yang terlewat sejak `start_date` ketika DAG pertama kali diaktifkan.

Aturan emas komunikasi antar-langkah: **alirkan referensi metadata, jangan alirkan payload data utuh**. Output task yang dikirim via metadata store orkestrator (seperti XCom di Airflow) hanya ditujukan untuk nilai kecil (file path, nama partisi, jumlah baris yang diproses). Payload data berukuran besar harus selalu ditulis ke storage persistensi (tabel staging, file Parquet, cloud bucket), dan langkah downstream berikutnya akan membaca data langsung dari storage tersebut.

> 💡 **Jeda Praktik 1 (Mendefinisikan Resource & Partisi Harian):**
> *Catatan persiapan & jembatan:* Dari folder kursus dengan venv aktif, instal dependensi terlebih dahulu (`python -m pip install -r labs/mod-2-4/requirements.txt`). Materi 5 menjelaskan resource dan asset Dagster secara lengkap, jadi Anda boleh menunggu hingga Materi 5 untuk memulai lab atau langsung mengikuti sintaks awal di bawah ini sekarang.
> 1. Buka teks editor Anda (VS Code / Cursor), buka file `labs/mod-2-4/orchestration.py`, lalu hapus baris awal `raise NotImplementedError(...)` (ingat: jangan mengeksekusi file `.py` langsung di terminal bash tanpa interpreter atau argumen).
> 2. Definisikan resource `Paths` dan partisi harian `daily` selama 30 hari (`end_date` bersifat eksklusif, mencakup 2026-01-01 hingga 2026-01-30):
> ```python
> from dagster import ConfigurableResource, DailyPartitionsDefinition
> class Paths(ConfigurableResource):
>     data_dir: str
>     warehouse_dir: str
> daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")
> ```
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k test_partitions_are_the_30_days_of_january -v`
> 4. **Indikator Sukses:** Tes lulus, mengonfirmasi tepat 30 partisi dari 2026-01-01 hingga 2026-01-30.

:::drill python Interval data dari satu run harian
Pipeline harian memproses hari **sebelumnya**. Tulis `interval_for(run_date)`: `run_date` adalah string seperti `"2026-01-06"`. Kembalikan tuple `(start, end)` berupa string: awal hari sebelumnya dan awal `run_date` itu sendiri.
@starter
from datetime import date, timedelta
# tulis fungsi Anda di bawah baris ini

@check
defines("interval_for") ## Definisikan interval_for(run_date).
interval_for("2026-01-06") == ("2026-01-05", "2026-01-06") ## Run tanggal 6 Januari memproses 5 Januari.
interval_for("2026-03-01") == ("2026-02-28", "2026-03-01") ## Melewati pergantian bulan dengan benar.
interval_for("2026-01-01") == ("2025-12-31", "2026-01-01") ## Dan pergantian tahun.
@hint
Ubah `run_date` menjadi objek `date` dengan `date.fromisoformat`, kurangi satu hari memakai `timedelta`, lalu format kedua tanggal kembali ke string ISO.
@solution
from datetime import date, timedelta
def interval_for(run_date):
    end = date.fromisoformat(run_date)
    start = end - timedelta(days=1)
    return (start.isoformat(), end.isoformat())
:::

## @lesson Idempotensi dan backfill: aturan yang membuat segalanya aman
Modul 0.2 telah mengenalkan konsepnya dan Modul 1.2 memperdalam tekniknya, namun di dalam orkestrator, idempotensi adalah syarat mutlak yang tidak bisa ditawar: **Setiap langkah dalam pipeline harus aman untuk dieksekusi berkali-kali untuk interval data yang sama tanpa mengubah hasil akhir.** Orkestrator melakukan retry otomatis, teknisi manusia sering kali menekan tombol trigger ulang, dan operasi backfill memproses ulang riwayat data; jika eksekusi ganda mengakibatkan metrik revenue berlipat ganda, maka bencana finansial hanya tinggal menunggu waktu.

Pola-pola arsitektur idempotensi yang diuji dalam lab modul ini:

- **Tulis per partisi dan timpa (Write by partition and replace).** Langkah untuk tanggal `2026-01-05` harus menulis output ke direktori atau partisi khusus tanggal tersebut (`daily_orders/date=2026-01-05/`) dan **menimpanya secara bersih (overwrite)**. Jangan pernah menggunakan operasi append buta ke tabel target.
- **Atomic writes.** Tulis output terlebih dahulu ke temporary staging file atau table terisolasi, lalu lakukan swap atau rename secara atomik di akhir transaksi, sehingga jika task mendadak mati di tengah jalan, output parsial yang rusak tidak akan mencemari data yang sudah ada sebelumnya.
- **Deterministik.** Input data yang sama harus selalu menghasilkan output byte demi byte yang persis sama: urutkan baris data sebelum disimpan, hilangkan fungsi penunjuk waktu realtime dalam komputasi data, dan tetapkan random seed jika ada proses stokastik.
- **Turunkan seluruh state dari interval.** Hindari ketergantungan pada jam dinding server, status eksekusi task yang berjalan beberapa jam lalu, atau variabel global yang dapat berubah secara mutable.
- **Side effects yang idempoten.** Operasi eksternal seperti pengiriman notifikasi email atau pemanggilan API pembayaran mitra harus memiliki deduplikasi berbasis idempotency key, atau melakukan verifikasi apakah tindakan tersebut sudah tuntas dicatat sebelumnya.

Dengan fondasi idempotensi yang kokoh, operasi **backfill** menjadi sangat elegan dan aman: Anda cukup memerintahkan orkestrator untuk menjalankan langkah yang sama untuk setiap interval data di masa lampau. Ancaman backfill bergeser dari risiko korupsi data ke risiko operasional: jika Anda memicu backfill 365 partisi sekaligus tanpa pembatasan kuota, sistem database sumber bisa lumpuh seketika akibat kehabisan resource (skenario chaos lab modul ini). Selain itu, jika Anda melakukan backfill pada **data upstream**, Anda harus memastikan partisi downstream terkait ikut diperbarui, hal yang dilacak secara otomatis dalam paradigma asset-based. Oleh karena itu, selalu pasang batas konkurensi (concurrency limits), jadwalkan backfill di luar jam sibuk operasional (off-peak), dan tentukan rentang eksekusi secara hati-hati.

Dalam lab praktikum modul ini, Anda tidak sekadar mempercayai teori ini di atas kertas, melainkan mengujinya melalui rangkaian pengujian otomatis: mematerialisasi partisi dua kali dan membandingkan byte outputnya; melakukan backfill 7 hari sebanyak dua kali dan memverifikasi laporan pendapatan tidak berlipat ganda; serta mengarahkan resource ke direktori yang hilang dan memastikan pipeline **gagal secara eksplisit (fail loudly)**, bukan pura-pura sukses menghasilkan data kosong.

:::ask Sebuah backfill menjalankan ulang hari `2026-01-05`. Rancangan output mana yang aman dijalankan dua kali?
@options
tambahkan baris hari itu ke satu file `all.csv` yang terus bertambah
tulis ke nama file acak di setiap run
* timpa `out/date=2026-01-05/part.csv` secara atomik
@why
Job yang idempoten meninggalkan hasil yang sama baik dijalankan sekali maupun lima kali. Menambahkan menduplikasi hari itu pada run kedua; path deterministik per partisi yang **diganti** tidak. Inilah aturan yang membuat backfill dan retry aman.
:::

> 💡 **Jeda Praktik 2 (Asset Terpartisi & Operasi Atomic Write):**
> 1. Buka file `labs/mod-2-4/orchestration.py` di teks editor Anda.
> 2. Impor `asset`, `AssetExecutionContext`, dan `MaterializeResult` dari `dagster`, lalu implementasikan `@asset(partitions_def=daily, ...)` untuk `daily_orders(context: AssetExecutionContext, paths: Paths)`: baca file `orders.csv`, saring baris yang tanggalnya cocok dengan `context.partition_key`, bersihkan total Rupiah dan status transaksi, serta tulis baris yang diurutkan ke `daily_orders/date=<day>/orders.ndjson`.
> 3. Terapkan pola penulisan atomik: tulis ke file temporary terlebih dahulu, lalu timpa file target (`os.replace`) agar eksekusi ulang menghasilkan file yang identik.
> 4. Uji sifat idempotensi di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_one_partition or test_running_the_same_partition" -v`
> 5. **Indikator Sukses:** Tes berstatus `PASSED` membuktikan eksekusi partisi dua kali menghasilkan output file yang byte demi byte sama persis.

## @part Alat-alatnya

## @lesson Airflow: DAG berbasis task
**Apache Airflow** mendefinisikan seluruh pipeline data menggunakan kode Python murni. Arsitektur komponen utamanya meliputi: **scheduler** yang memantau jadwal dan memutuskan kapan task harus jalan, **DAG processor** yang membaca dan mem-parsing file kode Python, **workers** (dijalankan via executor: LocalExecutor, CeleryExecutor, atau KubernetesExecutor) yang mengeksekusi instruksi task, **metadata database** (biasanya PostgreSQL) yang menyimpan state seluruh run dan task, serta **API server dan web UI** tempat insinyur memantau log dan memicu eksekusi.

:::talk Tugas yang bertanya pada jam
@teacher Sebuah tugas harian memilih hari yang dimuat dengan `datetime.now()`. Ia berjalan baik setiap malam. Pada 9 Januari Anda memulai backfill untuk memuat ulang 1 sampai 7 Januari.
@ask Hari apa saja yang sebenarnya dimuat backfill itu?
@choice * Tanggal hari ini, berulang-ulang: tugas bertanya pada jam, bukan pada interval yang diberikan kepadanya | Betul. Setiap putaran backfill menanyakan `now()`, mendapat 9 Januari, dan memuat hari yang sama tujuh kali, sementara 1 sampai 7 Januari tetap hilang.
@choice 1 sampai 7 Januari, karena penjadwal menyerahkan tanggal-tanggal itu | Penjadwal memang menyerahkan interval, tetapi tugas ini mengabaikannya dan bertanya pada jam. Coba lagi.
@choice Gagal, karena `datetime.now()` tidak diizinkan di dalam tugas | Python mengizinkannya, dan itulah masalahnya. Coba lagi.
@teacher Pakai interval yang diserahkan orchestrator (logical date-nya), jangan pernah jam. Maka retry atau backfill memuat persis hari yang dimaksud.
:::

Berikut adalah implementasi DAG lengkap menggunakan Airflow TaskFlow API modern (terverifikasi berjalan dengan Airflow 3.1.8, memakai `airflow dags test`):

```python
from datetime import timedelta
import pendulum
from airflow.sdk import dag, task


@dag(
    dag_id="kopiku_daily",
    schedule="0 2 * * *",                                   # setiap hari pukul 02:00 pagi
    start_date=pendulum.datetime(2026, 1, 1, tz="Asia/Jakarta"),
    catchup=False,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
)
def kopiku_daily():
    @task
    def extract(ds=None):                                   # ds = logical date, contoh: '2026-01-05'
        print(f"extracting orders for {ds}")
        return {"day": ds, "rows": 120}

    @task
    def transform(batch: dict):
        return {"day": batch["day"], "revenue": 1_000_000}

    @task
    def load(result: dict):
        print(f"replace the partition for {result['day']}")   # proses load yang idempoten

    load(transform(extract()))


kopiku_daily()
```

Anda dapat menguji DAG di atas secara lokal untuk satu tanggal spesifik tanpa perlu menyalakan seluruh daemon scheduler melalui perintah CLI: `airflow dags test kopiku_daily 2026-01-05`. Fungsi Python berdekorator `@task` otomatis bertransformasi menjadi task node di Airflow, relasi pemanggilan antar fungsi menentukan graf dependensi, dan nilai kembalian kecil dipertukarkan lewat mekanisme XCom. Kebijakan retry dikonfigurasi fleksibel baik di level DAG maupun task individual.

Prinsip penting dalam pengoperasian Airflow:

- **Operators dan Providers.** Airflow menyediakan ekosistem ratusan paket provider resmi (konektor database, cloud services AWS/GCP/Azure, dbt, Spark) dengan operator dan hooks siap pakai. Manfaatkan operator ini untuk *memicu* eksekusi eksternal daripada membebani worker Airflow dengan komputasi berat.
- **Jaga file DAG tetap ringan.** Engine DAG processor Airflow mem-parsing seluruh file Python di direktori DAG secara berkala (setiap beberapa detik). Kode yang diletakkan di top-level (seperti koneksi database aktif, query berat, atau import pustaka raksasa) akan dieksekusi di setiap siklus parsing dan memperlambat seluruh scheduler. Simpan kode komputasi hanya di dalam badan fungsi task.
- **Connections dan Variables.** Kelola kredensial rahasia dan parameter konfigurasi menggunakan fitur Connections dan Variables Airflow yang terintegrasi dengan secret manager (HashiCorp Vault, AWS Secrets Manager), hindari hardcoding kredensial di dalam file Python.
- **Airflow 3** (rilis arsitektur modern) memindahkan penulisan DAG ke package `airflow.sdk`, memisahkan API server mandiri, mendukung versioning DAG, dan memperkenalkan konsep **assets**: Anda dapat mendeklarasikan bahwa suatu task menghasilkan dataset tertentu dan menjadwalkan task hilir secara otomatis saat asset hulu diperbarui:

```python
from airflow.sdk import asset

@asset(schedule="@daily", uri="file:///warehouse/daily_orders")
def daily_orders(): ...

@asset(schedule=daily_orders, uri="file:///warehouse/daily_revenue")   # otomatis jalan saat daily_orders update
def daily_revenue(): ...
```

Banyak organisasi memilih menggunakan managed service Airflow di cloud (seperti Amazon MWAA, Google Cloud Composer, atau Astronomer) untuk mengeliminasi beban perawatan infrastruktur scheduler dan worker database sendiri.

> 🛠 **Coba sendiri (5 menit, pena dan kertas: pemeriksaan desain DAG).** Perhatikan `@dag` Airflow di atas. Mengapa pembacaan file atau query database harus berada *di dalam* `@task def extract()`, bukan di tingkat atas file di luar `@task`? Dan jika Anda menjalankan backfill `2026-01-01` sampai `2026-01-07`, nilai tanggal apa yang wajib dipakai `extract()` dan `load()` alih-alih `datetime.now()`?

:::ask Di Airflow Anda menetapkan `retries=3` pada task yang menambahkan baris ke sebuah tabel. Apa yang harus benar agar retry aman?
@options
* task bersifat idempoten saat diulang
scheduler di-restart di antara tiap percobaan
task selalu berjalan di worker yang sama
@why
Retry menjalankan task lagi, mungkin setelah sebagian outputnya sudah tertulis. Jika task mengganti irisannya (hapus lalu masukkan, atau MERGE), pengulangan tidak berbahaya; append buta akan menggandakan baris.
:::

## @lesson Dagster: pipeline sebagai asset
:::talk Tugas atau aset?
@teacher Sang pendiri bertanya: "Apakah tabel pendapatan segar pagi ini?" Di alat yang berpusat pada tugas Anda bisa menjawab "apakah pekerjaan muat berhasil?". Di alat yang berpusat pada aset Anda bisa menjawab hal yang berbeda.
@ask Apa perbedaan pertanyaan yang menjadi titik awal tiap alat?
@choice * Alat berpusat tugas melacak langkah yang berjalan; alat berpusat aset melacak produk data (tabel, file) dan kapan masing-masing terakhir diperbarui | Betul. Yang pertama berkata "pekerjaannya hijau". Yang kedua berkata "tabel pendapatan terakhir dibangun pukul 02:10, dari pesanan yang segar". Keduanya berguna; sang pendiri menanyakan yang kedua.
@choice Tidak ada perbedaan: keduanya hanya menjadwalkan kode | Keduanya menjadwalkan kode, tetapi apa yang mereka lacak berbeda. Coba lagi.
@choice Alat berpusat aset tidak bisa berjalan terjadwal | Aset juga bisa punya jadwal. Coba lagi.
@teacher Pekerjaan hijau tidak membuktikan tabel segar. Lacak hal yang benar-benar dipakai orang.
:::

**Dagster** bertolak dari paradigma yang sangat berbeda. Alih-alih bertanya "task mana yang harus berjalan dalam urutan apa?", Dagster bertanya: "**data asset apa yang seharusnya ada di sistem kita, dan apa dependensinya?**". Sebuah **asset** merepresentasikan tabel database, file data lake, atau model machine learning nyata; fungsi berdekorator `@asset` mendefinisikan komputasi logis untuk memproduksi asset tersebut (`@asset` adalah decorator Python dari `dagster` yang mendaftarkan fungsi ke dalam graf dependensi, sedangkan pewarisan `ConfigurableResource` mendefinisikan konfigurasi bertipe (seperti `Paths`) yang diinjeksikan otomatis sebagai argumen fungsi asset untuk dependency injection yang bersih). Relasi dependensi terbentuk langsung antar asset, sehingga orkestrator memahami secara tepat kapan suatu data usang (stale), asset hilir mana yang terdampak oleh perubahan hulu, dan partisi mana yang perlu dihitung ulang.

Inti arsitektur pipeline pada lab praktikum modul ini dirancang sebagai berikut:

```python
daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")

class Paths(ConfigurableResource):                 # konfigurasi path dan kredensial dikelola via resource
    data_dir: str
    warehouse_dir: str

@asset(partitions_def=daily, retry_policy=RetryPolicy(max_retries=2, delay=1))
def daily_orders(context: AssetExecutionContext, paths: Paths) -> MaterializeResult:
    day = context.partition_key                    # '2026-01-05': interval partisi yang sedang diproses
    ...                                            # baca data transaksi hari tersebut, lakukan pembersihan
    _atomic_write(out_path_for(day), cleaned)      # timpa file partisi secara atomik
    return MaterializeResult(metadata={"rows": len(cleaned)})

@asset(partitions_def=daily, deps=[daily_orders])  # partisi yang sama dari asset hulu
def daily_revenue(...): ...

@asset(deps=[AssetDep(daily_revenue, partition_mapping=AllPartitionMapping())])
def revenue_report(...): ...                       # non-partisi: bergantung pada seluruh partisi harian yang ada
```

Konsep esensial yang akan Anda terapkan dalam pengerjaan lab:

- **Partisi (Partitions).** Definisi `DailyPartitionsDefinition` menghasilkan satu partisi untuk setiap tanggal. Dagster mencatat secara presisi untuk setiap asset dan partisi: apakah partisi tersebut sudah dimaterialisasi, kapan waktu eksekusinya, dan metadata apa yang dihasilkan. Web UI menyediakan matriks visual di mana Anda dapat memilih kotak tanggal tertentu untuk meluncurkan operasi **backfill**. Asset terpartisi dapat bergantung pada partisi yang identik di upstream-nya, atau (menggunakan partition mapping seperti `AllPartitionMapping`) bergantung pada agregasi seluruh partisi harian masa lalu seperti pada laporan ringkasan bulanan.
- **Resources.** Semua konfigurasi spesifik lingkungan (lokasi direktori storage, koneksi database, API tokens) dipisahkan ke dalam *resource* yang diinjeksikan secara otomatis ke dalam fungsi asset. Pengujian otomatis Anda dapat mengeksekusi asset yang sama persis terhadap direktori temporary pengujian hanya dengan memasukkan instance resource yang berbeda: ini adalah pola *dependency injection* murni yang membuat pipeline Anda dapat diuji secara terisolasi tanpa mencemari data produksi.
- **Asset Checks.** Pernyataan kualitas data (data quality assertions) yang terikat langsung pada suatu asset, dieksekusi bersamaan dengan proses materialisasi, dan statusnya divisualisasikan langsung di web UI (`daily_orders_has_unique_ids`). Kegagalan pada pengecekan kualitas data dapat dikonfigurasi untuk memblokir eksekusi materialisasi asset hilir secara otomatis.
- **Retry Policy, Schedules, dan Sensors.** Objek `RetryPolicy` menangani percobaan ulang saat terjadi error; `ScheduleDefinition` mengikat ekspresi cron dan zona waktu ke pipeline job; sedangkan *sensor* memantau kemunculan kondisi eksternal tertentu untuk memicu eksekusi dinamis.
- **Definitions.** Objek `Definitions(assets=..., schedules=..., resources=...)` merangkum seluruh artefak yang dimuat Dagster ke dalam satu titik registrasi resmi. Perintah `dagster dev -f orchestration.py` meluncurkan web UI lokal lengkap dengan graf visual asset, histori run, dan pencatatan log.
- **Data Lineage dan Observabilitas Bawaan.** Karena graf dependensi didefinisikan secara eksplisit di level data, orkestrator dapat langsung menjawab pertanyaan krusial: "tabel ini memberi makan dashboard analitik mana saja?" dan "jika skema data ini berubah, siapa saja downstream consumers yang terdampak?".

Dagster juga memiliki integrasi native yang luar biasa dengan dbt (setiap model dbt otomatis diidentifikasi sebagai asset dalam graf lineage Dagster), menyatukan transformasi SQL dan proses Python ke dalam satu peta arsitektur data terpadu.

> 💡 **Jeda Praktik 3 (Retry Policy & Prinsip Fail Loudly):**
> 1. Buka file `labs/mod-2-4/orchestration.py` di teks editor Anda.
> 2. Pasang kebijakan retry pada asset `daily_orders` menggunakan `retry_policy=RetryPolicy(max_retries=2, delay=1)` untuk menangani gangguan sementara secara terencana.
> 3. Pastikan kode Anda melempar error eksplisit jika path input data tidak ditemukan (jangan mengembalikan list kosong atau pura-pura sukses): periksa keberadaan direktori/file dan biarkan `FileNotFoundError` terangkat.
> 4. Uji perilaku penanganan kegagalan di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_a_missing_input or test_the_daily_asset_retries" -v`
> 5. **Indikator Sukses:** Tes berstatus `PASSED`, mengonfirmasi kegagalan eksplisit saat input hilang dan bahwa konfigurasi `RetryPolicy` (`max_retries >= 1`) terpasang pada `daily_orders`.

> 💡 **Jeda Praktik 4 (Asset Checks & Schedule Berbasis Zona Waktu):**
> 1. Buka file `labs/mod-2-4/orchestration.py` di teks editor Anda.
> 2. Implementasikan asset `daily_revenue` (agregasi order non-cancelled/refunded) dan `revenue_report` (agregasi seluruh hari menggunakan `AllPartitionMapping`).
> 3. Tambahkan dua fungsi `@asset_check` yang mengembalikan `AssetCheckResult`: `daily_orders_has_unique_ids` (menerima `context: AssetCheckExecutionContext` dan `paths: Paths`) serta `revenue_is_never_negative`.
> 4. Definisikan `daily_job = define_asset_job("daily_kopiku_job", selection=[daily_orders, daily_revenue])` dan `daily_schedule` dengan `name="daily_kopiku_schedule"`, cron `0 2 * * *`, dan timezone `Asia/Jakarta`, lalu daftarkan semuanya ke dalam `defs = Definitions(...)`.
> 5. Verifikasi seluruh asset, check, dan definisi schedule di terminal:
>    `pytest labs/mod-2-4 -v`
> 6. **Indikator Sukses:** Seluruh 10 tes berstatus `PASSED`, memverifikasi `daily_orders`, `daily_revenue`, `revenue_report`, kedua asset check (`daily_orders_has_unique_ids` dan `revenue_is_never_negative`), serta definisi `daily_kopiku_schedule`.

:::ask Apa beda pertanyaan awal Dagster dibanding Airflow?
@options
server mana yang menjalankan tiap skrip
* aset data mana yang harus ada dan butuh apa
berapa kali tiap task harus di-retry
@why
Dagster memodelkan data yang diinginkan (tabel, file, model) dan menurunkan eksekusi dari dependensinya. Airflow memodelkan task dan urutannya. Keduanya bisa menyatakan pipeline yang sama.
:::

## @lesson Memilih dan mengoperasikan orchestrator
Komparasi objektif antara kedua filosofi orkestrasi data:

| | Task-centric (Airflow Klasik) | Asset-centric (Dagster; Airflow 3 assets) |
|---|---|---|
| Satuan Pemikiran | Tugas komputasi yang harus berjalan | Asset data yang harus tersedia |
| Pertanyaan Inti | "Langkah apa yang berjalan setelah langkah apa?" | "Data apa yang sedang usang, dan apa saja turunannya?" |
| Mekanisme Backfill | Menjalankan ulang instance task untuk rentang tanggal | Mematerialisasi partisi terpilih; status keusangan hilir terdeteksi otomatis |
| Data Lineage | Harus dirangkai manual atau menggunakan plugin eksternal | Terbentuk secara native sejak deklarasi kode awal |
| Keunggulan Utama | Ekosistem komunitas raksasa, ketersediaan talenta luas, fleksibel untuk segala workflow non-data (ML ops, maintenance infrastruktur) | Model berbasis data murni, kemudahan unit testing lokal, fitur partisi dan assertions terintegrasi |
| Risiko yang Diwaspadai | Rentan menghasilkan graf spageti yang rumit; logika bisnis sering bocor ke dalam konfigurasi DAG | Ekosistem integrasi yang lebih kecil; membutuhkan adaptasi pergeseran pola pikir bagi tim yang terbiasa dengan Airflow |

Tidak ada satu platform yang "secara mutlak lebih superior". Airflow tetap menjadi standar industri yang paling banyak diterapkan di enterprise, dan hadirnya fitur asset di Airflow 3 menjembatani perbedaan filosofis ini; di sisi lain, Dagster memberikan kenyamanan pengembangan yang luar biasa bagi tim yang fokus utamanya adalah memproduksi data warehouse dan analitik marts berkualitas tinggi. Pilihlah berdasarkan keahlian tim, arsitektur data yang sudah ada, dan karakteristik beban kerja; serta pastikan logika transformasi Anda selalu portabel (fungsi Python modular dan SQL murni) agar keputusan platform orkestrasi tetap dapat diganti jika dibutuhkan di masa depan.

**Praktik Terbaik Pengoperasian Orkestrator Produksi:**

- **Siapkan notifikasi untuk tiga skenario**: kegagalan run (failed run), **kehilangan jadwal run** (missing run, misal jadwal pukul 02:00 tidak pernah terpicu sama sekali), dan **keterlambatan durasi run** (pelanggaran batas SLA atau data freshness). Skenario kedua sering kali diabaikan oleh banyak tim data, padahal keheningan tanpa pesan error sering disangka sebagai kesuksesan semu.
- **Gagal secara eksplisit (Fail loudly).** Jika suatu langkah tidak menemukan data input yang diharapkan, buat langkah tersebut melempar error dan gagal, jangan biarkan ia menulis file kosong dan melaporkan status sukses hijau (lab praktikum ini menguji perilaku ini secara ketat).
- **Batasi konkurensi (Concurrency Limits)** untuk menjaga sistem bersama (database transaksional sumber, koneksi API pihak ketiga, kapasitas data warehouse), terutama saat menjalankan operasi backfill dalam volume besar.
- **Pemisahan lingkungan kerja (Environment Isolation)** antara development, staging, dan production; terapkan deployment kode orkestrasi melalui automated CI/CD pipeline yang dilengkapi pengujian menyeluruh.
- **Terapkan pengujian pada tiga tingkatan**: unit test untuk memverifikasi logika transformasi murni; integration test untuk mengeksekusi pipeline lokal pada sample data terisolasi (menggunakan Dagster `materialize` atau Airflow `dags test`); serta assertion checks data langsung di dalam pipeline saat berjalan.
- **Jaga kode orkestrasi tetap ramping dan ukuran DAG tetap modular.** Menulis satu DAG raksasa monolitik yang menangani seluruh proses bisnis perusahaan akan menimbulkan masalah pemeliharaan yang sama buruknya dengan skrip cron lawas.
- **Dokumentasikan kepemilikan dan panduan insiden (runbooks)**: siapa insinyur yang bertanggung jawab jika terjadi kegagalan, prosedur investigasi awal yang harus dilakukan, serta langkah aman untuk melakukan eksekusi ulang.

Anti-pattern yang wajib dihindari: pemanggilan `now()` di dalam badan task; operasi penambahan baris (append) tanpa partisi; pengiriman data besar melalui mekanisme XCom; query database berat di top-level file DAG Airflow; retry tanpa henti untuk error deterministik; serta meluncurkan backfill ratusan partisi tanpa batasan konkurensi.

> 🛠 **Coba sendiri (10 menit, Python).** Sebuah job seharusnya berhasil setiap hari pukul 02:00. Run yang berhasil di Januari 2026 ada pada tanggal 1, 2, 4, 5, 8, 9, dan 10. Dengan `datetime.date` dan `timedelta`, tulis `missing_runs(success_dates, start, end)` yang mengembalikan hari-hari tanpa run yang berhasil, lalu cetak hari yang hilang antara 2026-01-01 dan 2026-01-10 serta rentang terpanjang hari hilang yang berturut-turut.
>
> **Seharusnya Anda melihat:** `2026-01-03`, `2026-01-06`, dan `2026-01-07`, dan rentang terpanjang `2` hari. Perhatikan bahwa tidak ada yang gagal di hari-hari itu: tidak ada yang berjalan sama sekali, jadi peringatan kegagalan tidak akan pernah berbunyi. Inilah peringatan "run yang hilang" dari daftar di atas.

:::ask Sebuah tim baru harus memilih antara Airflow dan Dagster. Apa dasar pemilihan yang jujur?
@options
alat mana yang namanya lebih terkenal
alat berfitur lebih sedikit karena lebih sederhana
* keahlian tim, stack yang ada, dan bentuk kerja
@why
Tidak ada alat yang terbaik untuk semua kasus. Airflow paling luas dipakai; Dagster cocok untuk kerja yang sebagian besar menghasilkan tabel dan model. Pilih berdasarkan tim, stack yang ada, dan bentuk pekerjaannya.
:::

## @lesson Mengawasi pipeline Anda: log, metrik, dan alert
> **Intinya:** Pipeline yang gagal dengan keras mudah diperbaiki. Yang berbahaya adalah yang gagal diam-diam, atau pelan-pelan, atau "sukses" dengan isi kosong. Monitoring adalah kebiasaan mengumpulkan tiga jenis bukti (log, metrik, dan alert) agar Anda tahu sebelum pengguna Anda tahu.

Bayangkan sebuah dapur. **Buku catatan** merekam apa yang terjadi dan kapan ("10.03 oven mati"). **Termometer oven** dan total di mesin kasir adalah **metrik**: angka yang Anda baca dari waktu ke waktu ("seberapa panas tiap menit?"). **Detektor asap** adalah **alert**: aturan yang menepuk bahu Anda saat sesuatu butuh Anda sekarang. Pipeline data membutuhkan ketiganya.

| Sinyal | Apa itu | Cocok untuk | Contoh di pipeline |
|---|---|---|---|
| **Log** | baris teks tentang satu kejadian | mencari tahu *persis apa* yang terjadi dalam satu run | `ERROR order 1007: total is not a number` |
| **Metrik** | angka yang diukur berulang kali | melihat tren dan membandingkan hari ini dengan yang normal | baris dimuat, detik yang dipakai, kegagalan per hari |
| **Alert** | aturan pada sebuah metrik yang memberi tahu orang | diberi tahu, bukan harus mengecek | "tidak ada data baru selama 6 jam" |

### Apa yang diukur pada sebuah job data

Empat angka menceritakan sebagian besar kisahnya, untuk hampir semua pipeline:

1. **Apakah berhasil?** Jumlah dan laju kegagalan pada run-run terakhir.
2. **Berapa lama?** Job yang tiba-tiba empat kali lebih lama memperingatkan Anda sebelum rusak.
3. **Berapa banyak data yang berpindah?** Baris dibaca dan baris ditulis. Job yang "sukses" dan menulis nol baris adalah kegagalan yang diam.
4. **Seberapa segar hasilnya?** Umur data terbaru (Modul 2.5 materi 5 membahas pemeriksaan pada datanya; materi ini mengawasi job-nya).

Mulai dengan ringkasan biasa dari run-run terbaru:

:::drill python Ringkas run-run terbaru
Tulis `summarize_runs(runs)`: `runs` adalah list dictionary seperti `{"ok": True, "seconds": 12}`. Kembalikan dictionary dengan `runs` (berapa banyak), `failures` (berapa yang `ok`-nya false), `failure_rate` (kegagalan dibagi jumlah run, `0` bila tak ada run), dan `avg_seconds` (rata-rata `seconds`, `0` bila tak ada run).
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("summarize_runs") ## Definisikan summarize_runs(runs).
summarize_runs([{"ok": True, "seconds": 10}, {"ok": False, "seconds": 30}]) == {"runs": 2, "failures": 1, "failure_rate": 0.5, "avg_seconds": 20} ## Satu kegagalan dari dua run, rata-rata 20 detik.
summarize_runs([]) == {"runs": 0, "failures": 0, "failure_rate": 0, "avg_seconds": 0} ## Tanpa run: nol semua, dan tanpa pembagian dengan nol.
summarize_runs([{"ok": True, "seconds": 4}] * 4)["failure_rate"] == 0 ## Semua baik: laju kegagalan 0.
@hint
Hitung dengan `sum(1 for r in runs if not r["ok"])`, dan jaga `if not runs:` sebelum membagi.
@solution
def summarize_runs(runs):
    if not runs:
        return {"runs": 0, "failures": 0, "failure_rate": 0, "avg_seconds": 0}
    failures = sum(1 for r in runs if not r["ok"])
    return {
        "runs": len(runs),
        "failures": failures,
        "failure_rate": failures / len(runs),
        "avg_seconds": sum(r["seconds"] for r in runs) / len(runs),
    }
:::

:::ask Sebuah job malam berakhir dengan exit code 0 dan scheduler menampilkan "sukses", tetapi ia memuat 0 baris karena file sumbernya kosong. Sinyal mana yang akan menangkapnya?
@options
jumlah kegagalan, karena run ditandai sukses
tingkat log, karena baris INFO selalu ditulis
* volume: baris yang dimuat dibanding normalnya
@why
Tidak ada yang gagal, jadi jumlah kegagalan tetap nol dan log tampak normal. Hanya metrik tentang datanya (baris yang ditulis, dibandingkan dengan malam yang normal) yang menunjukkan bahwa run itu tidak mengerjakan apa-apa. Itulah mengapa Anda mengawasi volume selain keberhasilan.
:::

### Lambat juga berarti rusak

Run yang memakan 100 detik padahal biasanya 11 adalah gejala: data lebih banyak, kunci (lock), sumber yang lambat. Untuk menilai "lebih lambat dari biasa" pakai **median** durasi sebelumnya (nilai tengah), bukan rata-rata, agar satu run aneh di masa lalu tidak menyembunyikan perlambatan yang nyata.

:::drill python Apakah run ini luar biasa lambat?
Tulis `is_slow(seconds, history, factor)`: `history` adalah list durasi sebelumnya. Kembalikan `True` bila `seconds` **lebih dari** `factor` kali **median** history, selain itu `False`. Dengan history kosong kembalikan `False` (tak ada yang dibandingkan). Modul `statistics` punya `median`.
@starter
import statistics
# tulis fungsi Anda di bawah baris ini

@check
defines("is_slow") ## Definisikan is_slow(seconds, history, factor).
is_slow(100, [10, 12, 11], 3) == True ## Mediannya 11, dan 100 lebih dari 3 × 11.
is_slow(30, [10, 12, 11], 3) == False ## 30 di bawah 33.
is_slow(33, [10, 12, 11], 3) == False ## Tepat 3 × 11 tidak lebih dari itu.
is_slow(5, [], 2) == False ## Tanpa history: tak ada yang dibandingkan.
is_slow(100, [10, 10, 10, 1000], 3) == True ## Satu run aneh 1000 tidak boleh menyembunyikan perlambatan: mediannya tetap 10.
@hint
Kembalikan `False` lebih awal jika `history` kosong; jika tidak, hitung nilai tengah dengan `statistics.median` lalu periksa apakah `seconds` benar-benar lebih besar dari `factor` kali median tersebut.
@solution
import statistics
def is_slow(seconds, history, factor):
    if not history:
        return False
    return seconds > factor * statistics.median(history)
:::

### Alert yang tetap dipercaya orang

:::talk Diam terlihat seperti sukses
@teacher Alert Anda berbunyi setiap kali sebuah pekerjaan gagal. Jumat malam lalu server yang menjalankan penjadwal dimatikan karena kesalahan. Pekerjaan akhir pekan tidak pernah berjalan. Pada hari Senin tim keuangan bertanya mengapa angkanya berhenti di hari Jumat.
@ask Mengapa tidak ada alert yang berbunyi?
@choice Sistem alert-nya rusak | Mungkin baik-baik saja: ia hanya bereaksi pada kegagalan. Coba lagi.
@choice Pekerjaannya gagal diam-diam dan alert terlewat | Pekerjaannya tidak gagal: ia tidak pernah mulai, jadi tidak ada kegagalan untuk dilaporkan. Coba lagi.
@choice * Tidak ada yang gagal: pekerjaan yang tidak pernah berjalan tidak melaporkan error, sehingga diam terlihat seperti sukses | Betul. Anda butuh alert untuk putaran yang hilang, misalnya "tidak ada putaran sukses dalam 26 jam terakhir". Ia mengawasi ketiadaan kabar baik.
@teacher Beri alert saat gagal, tetapi juga saat terlambat dan saat sunyi.
:::

Alert harus berarti "seseorang harus bertindak". Dua kebiasaan menjaganya tetap begitu. Pertama, beri alert untuk **gejala yang penting** (tak ada data segar, tiga kegagalan berturut-turut), bukan untuk setiap kejadian kecil. Kedua, beri job retry-nya dulu: task yang gagal sekali lalu berhasil pada retry bukan keadaan darurat. Alert yang berbunyi tiap malam tanpa sebab mengajari semua orang untuk mengabaikannya. Ini disebut **alert fatigue**, dan begitulah insiden nyata terlewat.

Lihat aturan yang baru memberi alert setelah tiga kegagalan **berturut-turut**:

:::trace Alert setelah tiga kegagalan berturut-turut
@code
results = [True, False, False, True, False, False, False]
streak = 0
for ok in results:
    if ok:
        streak = 0
    else:
        streak += 1
    if streak >= 3:
        print("ALERT")
@notes
5 | Sebuah sukses mengatur ulang deretan menjadi nol: satu run yang baik menghapus kekhawatiran.
7 | Setiap kegagalan menambah satu pada deretan. Dua kegagalan pertama tidak pernah mencapai 3, karena sebuah sukses menyelanya.
9 | Hanya tiga kegagalan terakhir berturut-turut yang mencapai 3: inilah saat sebuah alert dikirim.
:::

:::ask Scheduler Anda memanggil Anda setiap kali sebuah task gagal sekali, padahal retry memperbaiki 9 dari 10 kegagalan. Apa perubahan terbaik?
@options
* beri alert hanya bila tetap gagal setelah retry
bisukan semua alert di malam hari, agar Anda bisa tidur
naikkan retry menjadi dua puluh, supaya tak pernah memberi alert lagi
@why
Alert harus berarti seseorang perlu bertindak. Satu kegagalan yang diperbaiki retry bukan itu, dan alarm palsu terus-menerus melatih orang mengabaikan pager. Beri alert pada gejala yang tersisa setelah retry. Membisukan di malam hari menyembunyikan masalah nyata, dan retry tanpa akhir hanya menunda kabar buruk.
:::

:::drill python Alert setelah N kegagalan
Tulis `alert_after(results, n)`: `results` adalah list boolean, yang tertua dulu, dengan `True` berarti run sukses. Kembalikan `True` hanya bila ada setidaknya `n` hasil dan **`n` hasil terakhir semuanya kegagalan**.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("alert_after") ## Definisikan alert_after(results, n).
alert_after([True, False, False, False], 3) == True ## Tiga run terakhir semuanya gagal.
alert_after([False, False, True, False], 3) == False ## Ada sukses di antara tiga terakhir.
alert_after([False, False], 3) == False ## Hasil kurang dari tiga sejauh ini.
alert_after([], 1) == False ## Tidak ada run sama sekali.
alert_after([True, False], 1) == True ## n = 1: run terakhir gagal.
@hint
Pastikan dulu `results` memiliki minimal `n` entri, lalu ambil irisan `n` elemen terakhir dan periksa bahwa tidak ada satu pun yang bernilai `True`.
@solution
def alert_after(results, n):
    return len(results) >= n and not any(results[-n:])
:::

### Metrik yang bisa dibaca dasbor

Log untuk orang yang membaca satu run. Metrik untuk grafik. Cara umum menerbitkannya adalah format teks kecil yang dipakai **Prometheus**, program yang mengumpulkan metrik dengan membaca halaman berisi baris teks tiap beberapa detik; **Grafana** lalu menggambar grafiknya dan bisa mengirim alert. Setiap baris berisi nama, label opsional dalam kurung kurawal, dan sebuah angka:

```text
kopiku_rows_loaded{job="orders"} 3617
kopiku_job_duration_seconds{job="orders"} 0.42
```

Airflow dan Dagster menampilkan riwayat run di layar mereka sendiri, dan Airflow juga bisa mengirim metriknya ke sistem seperti StatsD atau OpenTelemetry (periksa dokumentasi versi Anda). Skrip biasa bisa menulis baris-barisnya sendiri ke sebuah file di akhir run.

:::drill python Tulis satu baris metrik
Tulis `metric_line(name, value, labels)`: kembalikan teks satu metrik. Dengan label bentuknya `name{key="value",key2="value2"} angka`, dengan label **diurutkan menurut key**. Tanpa label cukup `name angka`. `metric_line("rows_loaded", 3617, {"job": "orders"})` adalah `rows_loaded{job="orders"} 3617`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("metric_line") ## Definisikan metric_line(name, value, labels).
metric_line("rows_loaded", 3617, {"job": "orders"}) == 'rows_loaded{job="orders"} 3617' ## Satu label.
metric_line("up", 1, {}) == "up 1" ## Tanpa label: tanpa kurung kurawal.
metric_line("duration_seconds", 0.42, {"job": "orders", "env": "prod"}) == 'duration_seconds{env="prod",job="orders"} 0.42' ## Dua label, diurutkan menurut key.
metric_line("x", 2, {"b": "1", "a": "2", "c": "3"}) == 'x{a="2",b="1",c="3"} 2' ## Label sebanyak apa pun.
@hint
Tangani dict `labels` kosong sebagai string dua bagian biasa; jika tidak kosong, urutkan key-nya, format tiap pasangan menjadi `key="value"`, gabungkan dengan koma, lalu bungkus dengan `{...}` (menggandakan kurung kurawal di dalam f-string).
@solution
def metric_line(name, value, labels):
    if not labels:
        return f"{name} {value}"
    inner = ",".join(f'{k}="{labels[k]}"' for k in sorted(labels))
    return f"{name}{{{inner}}} {value}"
:::

:::ask Pertanyaan mana yang membutuhkan metrik, bukan log?
@options
apa pesan error persis dari crash semalam?
* bagaimana waktu run berubah selama 30 hari terakhir?
baris input mana yang membuat parser gagal pada hari Selasa?
@why
Tren atas banyak run adalah angka yang diukur berulang kali: sebuah metrik, digambar sebagai grafik. Pesan error persis dan baris yang merusak parser adalah rincian satu kejadian, jadi tempatnya di log.
:::

### Pipeline Anda belum selesai sampai seseorang bisa melihatnya

Sebelum menyebut sebuah job selesai, jawab lima pertanyaan: di mana lognya, tiga angka apa yang ia terbitkan (sukses, durasi, baris), apa yang dianggap terlalu lambat atau terlalu kosong, siapa yang menerima alert, dan apa yang pertama kali mereka lakukan (**runbook**, Modul 2.5 materi 7). Jika Anda tak bisa menjawab, job itu berjalan dalam gelap.

> 🛠 **Coba sendiri (10 menit, Python).** Di komputer Anda sendiri, tulis `metrics_demo.py`: fungsi `run_job()` yang berpura-pura memuat 3617 baris (pakai `time.sleep(0.2)`), mengukur berapa lama ia berjalan, dan menulis tiga baris ke file `metrics.prom`: `kopiku_job_success{job="orders"} 1`, `kopiku_job_duration_seconds{job="orders"} <detik>`, dan `kopiku_rows_loaded{job="orders"} 3617`. Jalankan dua kali, lalu `cat metrics.prom` dan `grep success metrics.prom`.
>
> **Yang harus Anda lihat:** ketiga barisnya, dengan durasi mendekati `0.2` (misalnya `0.2012`). Setiap run menimpa file dengan nilai terbaru, jadi file selalu menunjukkan run terakhir. Sekarang ubah job agar melempar error sebelum menulis: file menyimpan angka lama, itulah mengapa sistem nyata juga mencatat *kapan* file ditulis (kesegaran).

## @lesson Stack orkestrasi lokal berbasis Docker Compose dan panduan aman backfill produksi

Saat Anda mewarisi pipeline produksi pada 90 hari pertama bekerja (atau membangun proyek end-to-end seperti di *DataTalksClub Data Engineering Zoomcamp*), dua keterampilan operasional ini menjaga sistem Anda tetap reproducible dan mencegah gangguan fatal di produksi:

**1. Stack Data Lokal Multi-Container (`docker-compose.yaml`).** Pipeline produksi tidak pernah bergantung pada kalimat "di laptop saya jalan kok." Repositori data yang dapat direproduksi mendefinisikan database, worker ingestion, dan orchestrator di dalam satu `docker-compose.yaml` yang berbagi jaringan bridge terisolasi, healthcheck, dan volume bernama:

```yaml
services:
  postgres-warehouse:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${PG_USER:-kopiku}
      POSTGRES_PASSWORD: ${PG_PASS:-local_dev_only}
      POSTGRES_DB: ${PG_DB:-kopiku_dw}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kopiku -d kopiku_dw"]
      interval: 5s
      retries: 5

  ingest-worker:
    build: .
    depends_on:
      postgres-warehouse:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://kopiku:local_dev_only@postgres-warehouse:5432/kopiku_dw
    command: ["python3", "-m", "pipeline.ingest", "--date", "${LOGICAL_DATE:-2026-01-15}"]

volumes:
  pg_data:
```

Perhatikan `condition: service_healthy`: `depends_on` biasa hanya menunggu proses container menyala, bukan menunggu PostgreSQL selesai menginisialisasi disk dan siap menerima koneksi TCP!

**2. Panduan 6 Langkah Aman Backfill Produksi.** Cepat atau lambat, perubahan rumus bisnis atau perbaikan bug penguraian mengharuskan Anda melakukan **backfill data historis 12 bulan** pada tabel berukuran multi-terabyte. Menjalankan backfill tanpa pembatas di produksi dapat merobohkan database sumber, memicu tagihan warehouse yang tidak direncanakan, mengunci dashboard BI, dan mengirim ulang email pemasaran Reverse ETL (mendorong metrik warehouse kembali ke CRM dan aplikasi operasional) untuk setiap pesanan historis. Ikuti 6 langkah ini setiap kali melakukan backfill:

| Langkah | Tindakan | Mengapa Mencegah Insiden Produksi |
|---|---|---|
| **1. Bisukan Efek Samping Hilir** | Matikan sementara **sinkronisasi Reverse ETL, webhook Slack/email, dan auto-retraining ML** yang terhubung ke tabel target. | Mencegah terkirimnya ulang pesan CRM "Selamat datang VIP!" untuk pesanan tahun 2025. |
| **2. Dry-Run & Estimasi Biaya pada 1 Partisi** | Jalankan backfill untuk satu tanggal logis (`--start 2026-01-01 --end 2026-01-01`) lalu kalikan byte yang dipindai & durasi dengan 365. | Menangkap bug full-table scan tersembunyi sebelum dikalikan 365×. |
| **3. Batasi Konkurensi (`max_active_runs`)** | Atur `max_active_runs=2` atau `max_concurrency=4` di Airflow/Dagster/Kestra. | Mencegah 365 worker paralel membanjiri database OLTP sumber atau slot warehouse. |
| **4. Gunakan Batch Rentang Partisi daripada 365 Run Harian Terpisah** | Di cloud warehouse (`BigQuery / Snowflake / Databricks`), proses per rentang bulan atau gunakan `dbt microbatch` (mode inkremental terpartisi milik dbt) / penggantian partisi. | 12 run bulanan membayar biaya tetap sebuah query (perencanaan, membaca metadata, tagihan minimum) 12 kali, bukan 365 kali. |
| **5. Bangun di Tabel Staging/Clone Dulu (Blue-Green Swap)** | Pada tabel Gold kritis, buat zero-copy clone (salinan tabel warehouse instan berbasis metadata saja: `CREATE TABLE fct_orders_backfill CLONE fct_orders`), jalankan backfill di sana, uji dengan tes, lalu tukar secara atomik ke tabel produksi dengan `ALTER TABLE ... SWAP WITH` (blue-green swap). | Dashboard BI eksekutif tidak pernah melihat tabel setengah kosong selama proses backfill 4 jam. |
| **6. Rekonsiliasi Total & Aktifkan Kembali Sinkronisasi Hilir** | Bandingkan jumlah baris dan total metrik (`SUM(net_revenue_idr)`) sebelum vs. sesudah, majukan watermark Reverse ETL agar baris lama tidak dikirim ulang, lalu aktifkan kembali job hilir. | Membuktikan backfill menuntaskan masalah tanpa efek samping liar. |

> 🛠 **Coba sendiri (15 menit, Python dengan DuckDB).** Muat `data/orders.csv` dengan `read_csv(..., all_varchar=true)`, simpan baris yang `total_idr`-nya hanya angka dan `order_ts`-nya lolos `TRY_CAST(order_ts AS TIMESTAMP)`. Buat dua tabel kosong `(order_date DATE, orders BIGINT, revenue_idr BIGINT)`. "Backfill" 2026-01-10, 11, dan 12 ke keduanya, satu hari setiap kali, dengan menghitung pesanan yang tidak dibatalkan (bandingkan `lower(trim(status))`: file-nya menulisnya dengan tiga cara): ke tabel pertama dengan `INSERT` biasa, ke tabel kedua dengan `DELETE` hari itu lalu `INSERT`, dalam satu transaksi. Jalankan seluruh backfill untuk kedua kalinya, seperti setelah crash, dan cetak jumlah baris dan total pendapatan kedua tabel setelah setiap run.
>
> **Seharusnya Anda melihat:** setelah run pertama kedua tabel berisi `3` baris dan `100360000`. Setelah run kedua tabel `INSERT` biasa berisi `6` baris dan `200720000`, setiap hari terhitung dua kali, sedangkan tabel yang mengganti per hari tetap `3` dan `100360000`. (Jika hanya membandingkan `status <> 'cancelled'`, hasilnya `101925000`: pesanan yang ditulis `CANCELLED` atau `Cancelled` lolos sebagai pendapatan.) Tabel kedua itulah yang direkonsiliasi pada langkah 6 runbook. Diukur dengan DuckDB 2.0.1 pada data bawaan kursus.

:::ask Di file docker-compose, aplikasi punya `depends_on: postgres`. Mengapa saat start tetap bisa gagal dengan 'connection refused'?
@options
* depends_on menunggu start, bukan kesiapan layanan
depends_on hanya bekerja untuk kontainer Python
Postgres menolak koneksi dari kontainer lain
@why
Kontainer yang sudah start belum tentu layanan yang siap. Tambahkan healthcheck pada Postgres dan pakai `condition: service_healthy` agar aplikasi baru start setelah database menjawab.
:::

## @lab Lab: pipeline harian di Dagster, diuji layaknya software
Bangun pipeline pemrosesan data harian KopiKu sebagai rangkaian asset terkelola di Dagster: lakukan pembersihan data transaksi per partisi harian, hitung ringkasan pendapatan harian, buat laporan agregasi seluruh hari, pasang asset checks untuk menjamin kualitas data, tetapkan kebijakan retry, dan pasang penjadwalan berbasis zona waktu Asia/Jakarta. Suite pengujian akan mengeksekusi pipeline Anda menggunakan engine orkestrasi nyata terhadap direktori filesystem temporary.

### @steps
> **Sudah menyelesaikan Jeda Praktik 1–5?** Asset, check, dan schedule Dagster Anda sudah selesai dibangun dan terverifikasi, langsung lompat ke Langkah 6 untuk menjelajahi Dagster UI atau Langkah 7 untuk tantangan lanjutan.

1. Di terminal, masuk ke folder kursus dan aktifkan venv Anda (`cd ~/projects/DECourse`, lalu `source venv/bin/activate`). Instal dependensi, buat data transaksi awal, lalu pelajari suite pengujian terlebih dahulu:

```bash
python -m pip install -r labs/mod-2-4/requirements.txt
python3 labs/shared/shopgen.py --out data
pytest labs/mod-2-4 -v          # pengujian akan gagal sampai Anda mengimplementasikan definisi Dagster
```

2. Buka file starter `labs/mod-2-4/orchestration.py`. Baca docstring modul yang menjadi spesifikasi teknis lengkap: pembuatan resource `Paths`, definisi partisi harian `daily` dari rentang 2026-01-01 hingga 2026-01-30, tiga asset data, dua asset checks, satu job, satu schedule, dan sebuah objek `Definitions`.
3. Implementasikan resource `Paths` (sebagai subclass `ConfigurableResource`) dan partisi `daily`. Lanjutkan dengan mengimplementasikan asset `daily_orders`: untuk setiap kunci tanggal partisi, baca file `orders.csv`, terapkan aturan pembersihan data dari modul sebelumnya, dan **timpa** file partisi harian target secara atomik. Jalankan `pytest labs/mod-2-4 -k "TestDailyOrders and not unique_ids"` secara bertahap (check `unique_ids` baru dibuat di Langkah 4).
4. Implementasikan asset `daily_revenue` (bergantung pada partisi yang bersesuaian di `daily_orders`) dan asset `revenue_report` (bergantung pada seluruh partisi: gunakan `AssetDep` dengan mapping `AllPartitionMapping`). Lanjutkan dengan mengimplementasikan kedua fungsi asset checks, definisi job, dan schedule. Ingat bahwa fungsi berdekorator `@asset_check` menerima argumen `AssetCheckExecutionContext`.
5. Jalankan seluruh rangkaian unit test. Perhatikan secara seksama pengujian idempotensi dan backfill: pengujian ini mengeksekusi ulang partisi yang sama berkali-kali dan membandingkan integritas output akhir.
6. Jalankan antarmuka grafis Dagster secara lokal:

```bash
dagster dev -f labs/mod-2-4/orchestration.py
```

   Buka antarmuka web di browser (http://localhost:3000), buka tampilan graf asset lineage, pilih beberapa rentang partisi tanggal dari `daily_orders` dan `daily_revenue`, luncurkan eksekusi backfill, lalu materialisasikan asset `revenue_report`. Picu kembali backfill untuk rentang tanggal yang sama dan pastikan angka pendapatan pada laporan akhir tidak mengalami perubahan atau duplikasi.

> 💡 **Jeda Praktik 5 (Uji Backfill & Eksplorasi Dagster UI):**
> 1. Jalankan suite pengujian lengkap di terminal:
>    `pytest labs/mod-2-4 -v`
> 2. Luncurkan web UI Dagster di terminal untuk melihat grafik lineage:
>    `dagster dev -f labs/mod-2-4/orchestration.py`
> 3. Buka browser pada alamat `http://localhost:3000`, amati DAG asset `daily_orders` -> `daily_revenue` -> `revenue_report`, pilih beberapa tanggal partisi untuk meluncurkan backfill manual, dan pastikan tidak ada duplikasi data.
> 4. **Indikator Sukses:** Seluruh 10 tes `test_lab.py` berstatus `PASSED` dan UI menampilkan status materialisasi berwarna hijau.

7. Tantangan lanjutan (stretch goals): tambahkan sensor yang otomatis aktif saat file `orders.csv` baru tiba; tambahkan check yang melempar peringatan jika suatu hari menghasilkan 0 pesanan; pasang konfigurasi limit konkurensi pada backfill; atau tulis ulang pipeline tersebut menjadi DAG Airflow TaskFlow ekuivalen dan jalankan menggunakan perintah `airflow dags test`.

### @files
- labs/mod-2-4/orchestration.py :: File kerja utama: deklarasi definisi Dagster yang harus dibangun :: starter
- labs/mod-2-4/test_lab.py :: Suite pengujian otomatis (mengeksekusi pipeline langsung menggunakan engine Dagster) :: test
- labs/mod-2-4/requirements.txt :: Konfigurasi dependensi dagster, dagster-webserver, dan pytest :: config
- labs/mod-2-4/reference/orchestration.py :: Referensi solusi lengkap (jadikan pembanding setelah mencoba mandiri!) :: reference

### @deliverables
- Seluruh 10 skenario pengujian di `test_lab.py` lulus dengan sukses
- Berhasil mengeksekusi backfill dari web UI Dagster dan membuktikan eksekusi ulang tidak mengubah integritas isi laporan
- Mampu menjelaskan secara tepat baris kode mana yang menjamin sifat idempotensi `daily_orders` dan baris mana yang memastikan ketiadaan data input gagal secara eksplisit (fail loudly)

### @verify
```bash
pytest labs/mod-2-4 -v
```

Verifikasi terhadap kode referensi: `LAB_DIR=reference pytest labs/mod-2-4 -v`.

## @chaos Backfill yang melumpuhkan sistem checkout
### @scenario
Sebuah bug pada logika pembersihan data ditemukan menyebabkan angka kalkulasi pendapatan 365 hari ke belakang salah hitung. Seorang data engineer memperbaiki logika kodenya dan langsung memicu proses backfill untuk seluruh 365 partisi harian sekaligus melalui web UI Dagster, dengan ekspektasi proses akan selesai saat pagi hari. Karena orkestrator tidak dikonfigurasi dengan batas konkurensi (no concurrency limits), engine scheduler langsung mengeksekusi ke-365 worker proses secara serentak. Setiap worker menjalankan query pembacaan data transaksi harian langsung ke **database replika produksi**, yang pada saat bersamaan juga melayani lalu lintas pengguna di halaman web "Pesanan Saya".

Dalam hitungan menit, utilisasi CPU pada database replika melonjak hingga 100%, query halaman "Pesanan Saya" mengalami timeout massal, ribuan tiket komplain pelanggan membanjiri tim support, dan celakanya, karena task yang timeout otomatis melakukan retry ulang, beban traffic query yang menghantam database bukannya mereda melainkan justru berlipat ganda.

### @cause
Operasi backfill ini sebenarnya aman dari segi *integritas data* (karena setiap partisi dirancang idempoten), namun sangat berbahaya dari sisi *beban infrastruktur operasional*. Tidak ada pembatasan kuota konkurensi yang mengontrol berapa banyak partisi yang boleh jalan paralel, sumber data pipeline menumpang langsung pada sistem replika transaksional yang melayani end-user, dan kebijakan auto-retry memperparah lonjakan query terhadap database yang sedang sekarat. Orkestrator hanya menjalankan perintah tepat sesuai konfigurasi yang diberikan oleh engineer.

### @fix
1. Segera batalkan (kill/stop) seluruh run backfill yang sedang berjalan, fitur ini didukung secara native baik di Dagster maupun Airflow, agar database replika memiliki ruang untuk pulih.
2. Tetapkan **concurrency limits**: pasang batas maksimum paralel run untuk operasi backfill dan terapkan batasan berbasis pool/tag untuk semua task yang mengakses database sumber (misalnya, dibatasi maksimum 3 task secara simultan).
3. Jadwalkan eksekusi backfill berskala besar di **luar jam sibuk operasional (off-peak)**, jalankan secara bertahap dalam batch kecil (misalnya, satu bulan per eksekusi), serta pantau metrik utilisasi database sumber secara aktif.
4. Jangan pernah membaca data analitik langsung dari database transaksional operasional: salin data mentah ke storage data lake atau staging data warehouse terlebih dahulu (Modul 2.2), lalu biarkan proses backfill membaca data langsung dari data lake tersebut.
5. Terapkan strategi **exponential backoff** dan batasi jumlah percobaan retry untuk dependensi eksternal yang rentan kelebihan beban, serta pasang peringatan (alert) otomatis jika terjadi lonjakan percobaan retry secara mendadak.

### @pattern
Operasi backfill melipatgandakan beban infrastruktur pipeline Anda sebesar jumlah partisi yang diproses. Selalu batasi kuota konkurensi, lindungi sistem sumber yang digunakan bersama, dan picu pemrosesan data historis masif secara terukur dan bertahap.

## @quiz
### Job harian yang dijadwalkan berjalan pada pukul 02:00 tanggal 6 Januari seharusnya memproses data interval yang mana?
- [ ] Data transaksi tanggal 6 Januari, karena itu adalah tanggal kalender saat run mulai dieksekusi
- [x] Data 5 Januari, karena intervalnya baru berakhir pada tengah malam dan run ini bertugas memprosesnya
- [ ] Data apa pun yang paling baru tersedia di database pada pukul 02:00, menggunakan waktu realtime server saat job berjalan
- [ ] Seluruh data historis yang ada di tabel, karena job tidak memiliki mekanisme untuk mengetahui rentang interval kerjanya

> Sebuah run data selalu terikat pada interval data yang menjadi tanggung jawabnya. Run pada pukul 02:00 tanggal 6 bertugas memproses data interval yang baru saja selesai ditutup (tanggal 5), dan kode pipeline Anda wajib menggunakan logical date tersebut, bukan waktu jam dinding server saat itu.

### Mengapa penggunaan fungsi `datetime.now()` di dalam task menjadi masalah fatal dalam pipeline yang diorkestrasi?
- [ ] Fungsi tersebut dilarang dan tidak dapat diakses di dalam task karena server worker tidak memiliki akses ke jam sistem
- [ ] Penggunaan fungsi tersebut memperlambat kinerja task secara drastis karena harus menghubungi server NTP eksternal di setiap pemanggilan
- [x] Retry atau backfill di masa depan akan memakai waktu hari ini, sehingga data interval lama tidak bisa direproduksi secara konsisten
- [ ] Masalah ini hanya terjadi di Airflow, karena Dagster secara otomatis menggantikan fungsi jam sistem dengan partition key

> Task harus menurunkan seluruh input komputasinya secara deterministik dari interval atau partisi yang dieksekusi, sehingga eksekusi ulang di masa depan akan selalu menghasilkan output yang identik.

### Pola perancangan mana yang menjamin proses data loading harian bersifat idempoten?
- [ ] Menambahkan (append) baris data harian ke satu tabel raksasa dan menghapus data duplikat secara berkala di setiap akhir pekan
- [x] Menulis output harian ke direktori atau partisi yang diturunkan dari kunci tanggal, lalu menggantinya secara atomik
- [ ] Menyimpan counter total run yang sukses dan melewati eksekusi jika nomor run lebih tinggi dari run sebelumnya
- [ ] Menjalankan task tepat satu kali sehari dan menonaktifkan fitur retry agar task tidak pernah memiliki kesempatan dieksekusi dua kali

> Menimpa partisi berbasis tanggal secara atomik menghasilkan kondisi akhir yang selalu konsisten berapa kali pun task tersebut dieksekusi ulang. Mengandalkan metode append atau berasumsi "task hanya akan berjalan sekali" pasti akan rusak saat terjadi retry otomatis atau operasi backfill.

### Apa perbedaan filosofis mendasar antara model klasik Airflow dan model asset Dagster?
- [ ] Airflow hanya mampu menjalankan kode Python murni, sedangkan Dagster dirancang untuk mengeksekusi query SQL dan perintah shell
- [ ] Dagster sama sekali tidak memiliki kapabilitas penjadwalan waktu, sehingga selalu membutuhkan cron eksternal untuk menjalankannya
- [x] Airflow berpusat pada task yang dieksekusi, sedangkan Dagster berpusat pada data asset yang harus tersedia beserta dependensinya
- [ ] Airflow tidak mendukung mekanisme retry saat terjadi kegagalan, sedangkan Dagster melakukan retry secara otomatis untuk seluruh operasi

> Sistem task-centric memodelkan apa yang berjalan dan urutan langkahnya; sistem asset-centric memodelkan data apa yang seharusnya ada dan apa dependensinya, menjadikan lineage, status keusangan (staleness), dan backfill partisi sebagai kapabilitas kelas satu (first-class citizens).

### Pada lab modul ini, mengapa lokasi path data didefinisikan sebagai `ConfigurableResource` dan bukan sebagai konstanta hardcoded di kode asset?
- [ ] Konstanta dilarang keras di dalam asset Dagster karena nilainya dievaluasi terlalu dini oleh compiler Python
- [x] Asset yang sama bisa dijalankan pada data uji sementara maupun data produksi hanya dengan mengganti instance resource
- [ ] Resource membuat eksekusi asset jauh lebih cepat karena Dagster melakukan caching otomatis terhadap hasil setiap resource
- [ ] Lokasi path tersebut akan otomatis disimpan di dalam output metadata asset, yang ditolak secara default oleh engine Dagster

> Resource menginjeksi konfigurasi spesifik lingkungan dan manajemen kredensial ke dalam asset, menjaga kode tetap dapat diuji secara terisolasi (testable) dan portabel di berbagai lingkungan (dev, test, prod).

### Informasi apa yang seharusnya dialirkan secara langsung dari satu langkah orkestrasi ke langkah berikutnya?
- [ ] Seluruh DataFrame berukuran jutaan baris data, yang dialirkan melewati database metadata bawaan orkestrator
- [ ] Objek koneksi database aktif yang dibuka pada langkah pertama pipeline untuk digunakan bersama oleh seluruh langkah
- [x] Referensi atau metadata kecil seperti path file atau jumlah baris, sedangkan payload data utuh disimpan di storage persisten
- [ ] Tidak ada data apa pun, karena suatu langkah tidak pernah diizinkan untuk memiliki dependensi terhadap output langkah lainnya

> Pertukaran data antar task melalui metadata store orkestrator (seperti XCom) dirancang khusus untuk payload kecil. Data analitik berukuran besar harus disimpan di storage persistensi yang kemudian dibaca langsung oleh langkah downstream.

### Operasi backfill 365 partisi diluncurkan tanpa batasan apa pun hingga menyebabkan database sumber mengalami overload. Apa solusi perbaikan yang paling tepat?
- [ ] Menambah batas maksimum percobaan retry agar setiap partisi yang gagal mencoba kembali lebih sering
- [ ] Menghapus seluruh partisi dari jadwal agar scheduler tidak dapat memicu eksekusi partisi tersebut lagi
- [x] Menambah batas konkurensi, menjalankan bertahap di luar jam sibuk, dan membaca dari data lake alih-alih replika database transaksi
- [ ] Memindahkan database sumber ke server dengan spesifikasi CPU lebih besar dan mempertahankan pengaturan backfill tanpa batas tersebut

> Operasi backfill melipatgandakan beban kerja infrastruktur sebesar jumlah partisi yang diproses. Batasi konkurensi, distribusikan eksekusi secara bertahap, dan hindari query analitik terhadap database transaksional.

### Peringatan (alert) operasional apa yang paling sering luput dari sistem pemantauan pipeline data di perusahaan?
- [ ] Notifikasi saat suatu task melempar exception error yang tercatat di dalam log worker
- [ ] Notifikasi saat tagihan biaya data warehouse bulanan melonjak lebih dari sepuluh persen dalam sebulan
- [x] Notifikasi saat run terjadwal tidak terpicu atau terlambat, karena tanpa kabar sering dikira sukses
- [ ] Notifikasi saat seorang insinyur melakukan merge commit kode baru ke repositori pipeline

> Kegagalan task sangat mudah terdeteksi dari log error; namun ketiadaan eksekusi sama sekali (missing runs) kerap tidak disadari karena tidak memicu pesan error. Pantau ketiadaan run dan keterlambatan penyelesaian data (freshness dan SLA breaches) berdampingan dengan pemantauan error.

## @resources
- [Dokumentasi Dagster](https://docs.dagster.io/)
- [Dokumentasi Apache Airflow](https://airflow.apache.org/docs/apache-airflow/stable/)
- [Tutorial TaskFlow API di Airflow](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)

