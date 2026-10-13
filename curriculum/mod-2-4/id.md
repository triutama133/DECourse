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

Apa yang **bukan** tugas orkestrator: orkestrator bukanlah tempat untuk melakukan pemrosesan data komputasi berat. Orkestrator kelas produksi bertindak sebagai **pemicu (trigger)** dan **pemantau (monitor)** pekerjaan; pekerjaan komputasi berat itu sendiri harus dieksekusi di engine yang memang dirancang untuk tujuan tersebut—seperti model dbt di data warehouse, distributed job di Apache Spark, query analitik di DuckDB/ClickHouse, atau micro-batch di polars/pandas container. Kode orkestrasi Anda harus dibuat sangat ramping: hanya berisi deklarasi dependensi, penjadwalan, dan wiring arsitektur, sedangkan logika bisnis data murni tetap berada di fungsi Python modular dan SQL yang dapat diuji tersendiri (unit testable).

Dua ekosistem orkestrator yang paling dominan di industri adalah **Apache Airflow** (standar de facto industri yang sudah lama mapan, berpusat pada task/tugas, digunakan oleh ribuan korporasi global) dan **Dagster** (orkestrator modern yang berpusat pada data asset, dirancang mengikuti aliran lifecycle data). Ada pula alternatif lain seperti Prefect, Kestra, dan Mage; namun begitu Anda menguasai prinsip fundamental di modul ini, konsep tersebut dapat ditransfer ke platform mana pun dengan mudah.

## @lesson Konsep inti: runs, intervals, dan partitions
Graf dependensi di orkestrator dimodelkan sebagai **DAG (Directed Acyclic Graph)**: node melambangkan task atau asset data, tanda panah melambangkan "berjalan setelah" atau "bergantung pada", dan sifat **acyclic** memastikan tidak ada lingkaran setan/rekursi tak berujung (no circular dependencies), sehingga urutan eksekusi selalu deterministik.

Konsep yang paling sering membingungkan insinyur pemula adalah **data interval** (istilah di Airflow) atau **partition** (istilah di Dagster). Pipeline harian yang dijadwalkan berjalan pada pukul 02:00 tanggal 6 Januari **bukanlah** memproses data tanggal 6 Januari. Pipeline tersebut bertugas memproses **data tanggal 5 Januari**, karena data transaksi tanggal 5 Januari baru resmi lengkap dan ditutup saat jam menunjukkan tepat tengah malam 23:59:59. Orkestrator memodelkan prinsip ini secara eksplisit: setiap run selalu terikat pada interval data yang menjadi tanggung jawabnya (`2026-01-05`), yang diinjeksikan ke dalam kode Anda sebagai **logical date** (variabel `ds` di Airflow) atau **partition key** (`context.partition_key` di Dagster). Kode pipeline Anda wajib membaca dan memproses data **khusus untuk interval tersebut**, dan pantang membaca waktu "saat ini" (wall-clock time). Jika suatu run diulang besok, atau dilakukan backfill bulan depan, ia harus selalu menghasilkan output yang identik untuk tanggal 5 Januari. Menggunakan waktu sistem (`datetime.now()` atau fungsi database `CURRENT_DATE()`) di dalam task akan merusak konsistensi ini secara diam-diam.

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
> 1. Buka teks editor Anda (VS Code / Cursor), lalu buka file `labs/mod-2-4/orchestration.py` (ingat: jangan mengeksekusi file `.py` langsung di terminal bash tanpa interpreter atau argumen).
> 2. Deklarasikan class resource `Paths(ConfigurableResource)` dengan atribut string `data_dir` dan `warehouse_dir`.
> 3. Buat definisi partisi harian `daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")` (catatan: `end_date` bersifat eksklusif sehingga partisi mencakup 30 hari Januari 2026).
> 4. Jalankan pengujian di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k test_partitions_are_the_30_days_of_january -v`
> 5. **Indikator Sukses:** Tes berstatus `PASSED` mengonfirmasi 30 partisi dari 2026-01-01 hingga 2026-01-30.

## @lesson Idempotensi dan backfill: aturan yang membuat segalanya aman
Modul 0.1 telah mengenalkan konsepnya dan Modul 1.2 memperdalam tekniknya, namun di dalam orkestrator, idempotensi adalah syarat mutlak yang tidak bisa ditawar: **Setiap langkah dalam pipeline harus aman untuk dieksekusi berkali-kali untuk interval data yang sama tanpa mengubah hasil akhir.** Orkestrator melakukan retry otomatis, teknisi manusia sering kali menekan tombol trigger ulang, dan operasi backfill memproses ulang riwayat data; jika eksekusi ganda mengakibatkan metrik revenue berlipat ganda, maka bencana finansial hanya tinggal menunggu waktu.

Pola-pola arsitektur idempotensi yang diuji dalam lab modul ini:

- **Tulis per partisi dan timpa (Write by partition and replace).** Langkah untuk tanggal `2026-01-05` harus menulis output ke direktori atau partisi khusus tanggal tersebut (`daily_orders/date=2026-01-05/`) dan **menimpanya secara bersih (overwrite)**. Jangan pernah menggunakan operasi append buta ke tabel target.
- **Atomic writes.** Tulis output terlebih dahulu ke temporary staging file atau table terisolasi, lalu lakukan swap atau rename secara atomik di akhir transaksi, sehingga jika task mendadak mati di tengah jalan, output parsial yang rusak tidak akan mencemari data yang sudah ada sebelumnya.
- **Deterministik.** Input data yang sama harus selalu menghasilkan output byte demi byte yang persis sama: urutkan baris data sebelum disimpan, hilangkan fungsi penunjuk waktu realtime dalam komputasi data, dan tetapkan random seed jika ada proses stokastik.
- **Turunkan seluruh state dari interval.** Hindari ketergantungan pada jam dinding server, status eksekusi task yang berjalan beberapa jam lalu, atau variabel global yang dapat berubah secara mutable.
- **Side effects yang idempoten.** Operasi eksternal seperti pengiriman notifikasi email atau pemanggilan API pembayaran mitra harus memiliki deduplikasi berbasis idempotency key, atau melakukan verifikasi apakah tindakan tersebut sudah tuntas dicatat sebelumnya.

Dengan fondasi idempotensi yang kokoh, operasi **backfill** menjadi sangat elegan dan aman: Anda cukup memerintahkan orkestrator untuk menjalankan langkah yang sama untuk setiap interval data di masa lampau. Ancaman backfill bergeser dari risiko korupsi data ke risiko operasional: jika Anda memicu backfill 365 partisi sekaligus tanpa pembatasan kuota, sistem database sumber bisa lumpuh seketika akibat kehabisan resource (skenario chaos lab modul ini). Selain itu, jika Anda melakukan backfill pada **data upstream**, Anda harus memastikan partisi downstream terkait ikut diperbarui—hal yang dilacak secara otomatis dalam paradigma asset-based. Oleh karena itu, selalu pasang batas konkurensi (concurrency limits), jadwalkan backfill di luar jam sibuk operasional (off-peak), dan tentukan rentang eksekusi secara hati-hati.

Dalam lab praktikum modul ini, Anda tidak sekadar mempercayai teori ini di atas kertas, melainkan mengujinya melalui rangkaian pengujian otomatis: mematerialisasi partisi dua kali dan membandingkan byte outputnya; melakukan backfill 7 hari sebanyak dua kali dan memverifikasi laporan pendapatan tidak berlipat ganda; serta mengarahkan resource ke direktori yang hilang dan memastikan pipeline **gagal secara eksplisit (fail loudly)**, bukan pura-pura sukses menghasilkan data kosong.

> 💡 **Jeda Praktik 2 (Asset Terpartisi & Operasi Atomic Write):**
> 1. Buka file `labs/mod-2-4/orchestration.py` di teks editor Anda.
> 2. Implementasikan fungsi `@asset(partitions_def=daily, ...)` untuk `daily_orders(context: AssetExecutionContext, paths: Paths)`: baca file `orders.csv`, saring baris yang tanggalnya cocok dengan `context.partition_key`, bersihkan total Rupiah dan status transaksi, serta tulis baris yang diurutkan ke file output JSON (`date=<day>/orders.ndjson`).
> 3. Terapkan pola penulisan atomik: tulis ke file temporary terlebih dahulu, lalu timpa file target (`os.replace`) agar eksekusi ulang menghasilkan file yang identik.
> 4. Uji sifat idempotensi di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_one_partition or test_running_the_same_partition" -v`
> 5. **Indikator Sukses:** Tes berstatus `PASSED` membuktikan eksekusi partisi dua kali menghasilkan output file yang byte demi byte sama persis.

## @lesson Airflow: DAG berbasis task
**Apache Airflow** mendefinisikan seluruh pipeline data menggunakan kode Python murni. Arsitektur komponen utamanya meliputi: **scheduler** yang memantau jadwal dan memutuskan kapan task harus jalan, **DAG processor** yang membaca dan mem-parsing file kode Python, **workers** (dijalankan via executor: LocalExecutor, CeleryExecutor, atau KubernetesExecutor) yang mengeksekusi instruksi task, **metadata database** (biasanya PostgreSQL) yang menyimpan state seluruh run dan task, serta **API server dan web UI** tempat insinyur memantau log dan memicu eksekusi.

Berikut adalah implementasi DAG lengkap menggunakan Airflow TaskFlow API modern (terverifikasi kompatibel dengan Airflow versi 3.3):

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

> 💡 **Jeda Praktik 3 (Retry Policy & Prinsip Fail Loudly):**
> 1. Buka file `labs/mod-2-4/orchestration.py` di teks editor Anda.
> 2. Pasang kebijakan retry pada asset `daily_orders` menggunakan `retry_policy=RetryPolicy(max_retries=2, delay=1)` untuk menangani gangguan sementara secara terencana.
> 3. Pastikan kode Anda melempar error eksplisit jika path input data tidak ditemukan (jangan mengembalikan list kosong atau pura-pura sukses): periksa keberadaan direktori/file dan biarkan `FileNotFoundError` terangkat.
> 4. Uji perilaku penanganan kegagalan di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_a_missing_input or test_the_daily_asset_retries" -v`
> 5. **Indikator Sukses:** Tes berstatus `PASSED` mengonfirmasi pipeline gagal secara eksplisit saat input hilang dan otomatis mencoba ulang saat terjadi kegagalan sementara.

## @lesson Dagster: pipeline sebagai asset
**Dagster** bertolak dari paradigma yang sangat berbeda. Alih-alih bertanya "task mana yang harus berjalan dalam urutan apa?", Dagster bertanya: "**data asset apa yang seharusnya ada di sistem kita, dan apa dependensinya?**". Sebuah **asset** merepresentasikan tabel database, file data lake, atau model machine learning nyata; fungsi berdekorator `@asset` mendefinisikan komputasi logis untuk memproduksi asset tersebut. Relasi dependensi terbentuk langsung antar asset, sehingga orkestrator memahami secara tepat kapan suatu data usang (stale), asset hilir mana yang terdampak oleh perubahan hulu, dan partisi mana yang perlu dihitung ulang.

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

> 💡 **Jeda Praktik 4 (Asset Checks & Schedule Berbasis Zona Waktu):**
> 1. Buka file `labs/mod-2-4/orchestration.py` di teks editor Anda.
> 2. Implementasikan asset `daily_revenue` (agregasi order non-cancelled/refunded) dan `revenue_report` (agregasi seluruh hari menggunakan `AllPartitionMapping`).
> 3. Pasang dua asset check: `daily_orders_has_unique_ids` dan `revenue_is_never_negative`.
> 4. Konfigurasikan jadwal harian `daily_schedule` dengan cron `0 2 * * *` dan timezone `Asia/Jakarta`, lalu daftarkan semuanya ke dalam objek `defs = Definitions(...)`.
> 5. Uji asset check dan schedule di terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_the_unique_ids_check or test_the_schedule" -v`
> 6. **Indikator Sukses:** Tes berstatus `PASSED` mengonfirmasi integrasi asset check dan spesifikasi schedule 02:00 WIB berjalan sempurna.

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

- **Siapkan notifikasi untuk tiga skenario**: kegagalan run (failed run), **kehilangan jadwal run** (missing run—misal jadwal pukul 02:00 tidak pernah terpicu sama sekali), dan **keterlambatan durasi run** (pelanggaran batas SLA atau data freshness). Skenario kedua sering kali diabaikan oleh banyak tim data, padahal keheningan tanpa pesan error sering disangka sebagai kesuksesan semu.
- **Gagal secara eksplisit (Fail loudly).** Jika suatu langkah tidak menemukan data input yang diharapkan, buat langkah tersebut melempar error dan gagal, jangan biarkan ia menulis file kosong dan melaporkan status sukses hijau (lab praktikum ini menguji perilaku ini secara ketat).
- **Batasi konkurensi (Concurrency Limits)** untuk menjaga sistem bersama (database transaksional sumber, koneksi API pihak ketiga, kapasitas data warehouse), terutama saat menjalankan operasi backfill dalam volume besar.
- **Pemisahan lingkungan kerja (Environment Isolation)** antara development, staging, dan production; terapkan deployment kode orkestrasi melalui automated CI/CD pipeline yang dilengkapi pengujian menyeluruh.
- **Terapkan pengujian pada tiga tingkatan**: unit test untuk memverifikasi logika transformasi murni; integration test untuk mengeksekusi pipeline lokal pada sample data terisolasi (menggunakan Dagster `materialize` atau Airflow `dags test`); serta assertion checks data langsung di dalam pipeline saat berjalan.
- **Jaga kode orkestrasi tetap ramping dan ukuran DAG tetap modular.** Menulis satu DAG raksasa monolitik yang menangani seluruh proses bisnis perusahaan akan menimbulkan masalah pemeliharaan yang sama buruknya dengan skrip cron lawas.
- **Dokumentasikan kepemilikan dan panduan insiden (runbooks)**: siapa insinyur yang bertanggung jawab jika terjadi kegagalan, prosedur investigasi awal yang harus dilakukan, serta langkah aman untuk melakukan eksekusi ulang.

Anti-pattern yang wajib dihindari: pemanggilan `now()` di dalam badan task; operasi penambahan baris (append) tanpa partisi; pengiriman data besar melalui mekanisme XCom; query database berat di top-level file DAG Airflow; retry tanpa henti untuk error deterministik; serta meluncurkan backfill ratusan partisi tanpa batasan konkurensi.

## @lab Lab: pipeline harian di Dagster, diuji layaknya software
Bangun pipeline pemrosesan data harian KopiKu sebagai rangkaian asset terkelola di Dagster: lakukan pembersihan data transaksi per partisi harian, hitung ringkasan pendapatan harian, buat laporan agregasi seluruh hari, pasang asset checks untuk menjamin kualitas data, tetapkan kebijakan retry, dan pasang penjadwalan berbasis zona waktu Asia/Jakarta. Suite pengujian akan mengeksekusi pipeline Anda menggunakan engine orkestrasi nyata terhadap direktori filesystem temporary.

### @steps
1. Instal dependensi dan buat data transaksi awal, lalu pelajari suite pengujian terlebih dahulu:

```bash
python -m pip install -r labs/mod-2-4/requirements.txt
python3 labs/shared/shopgen.py --out data
pytest labs/mod-2-4 -v          # pengujian akan gagal sampai Anda mengimplementasikan definisi Dagster
```

2. Buka file starter `labs/mod-2-4/orchestration.py`. Baca docstring modul yang menjadi spesifikasi teknis lengkap: pembuatan resource `Paths`, definisi partisi harian `daily` dari rentang 2026-01-01 hingga 2026-01-30, tiga asset data, dua asset checks, satu job, satu schedule, dan sebuah objek `Definitions`.
3. Implementasikan resource `Paths` (sebagai subclass `ConfigurableResource`) dan partisi `daily`. Lanjutkan dengan mengimplementasikan asset `daily_orders`: untuk setiap kunci tanggal partisi, baca file `orders.csv`, terapkan aturan pembersihan data dari modul sebelumnya, dan **timpa** file partisi harian target secara atomik. Jalankan `pytest labs/mod-2-4 -k TestDailyOrders` secara bertahap.
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
- labs/mod-2-4/requirements.txt :: Konfigurasi dependensi dagster dan pytest :: config
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
1. Segera batalkan (kill/stop) seluruh run backfill yang sedang berjalan—fitur ini didukung secara native baik di Dagster maupun Airflow—agar database replika memiliki ruang untuk pulih.
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
- [ ] Notifikasi saat seorang insinyur melakukan merge commit kode baru ke repository repositori pipeline

> Kegagalan task sangat mudah terdeteksi dari log error; namun ketiadaan eksekusi sama sekali (missing runs) kerap tidak disadari karena tidak memicu pesan error. Pantau ketiadaan run dan keterlambatan penyelesaian data (freshness dan SLA breaches) berdampingan dengan pemantauan error.

## @resources
- [Dokumentasi Dagster](https://docs.dagster.io/)
- [Dokumentasi Apache Airflow](https://airflow.apache.org/docs/apache-airflow/stable/)
- [Tutorial TaskFlow API di Airflow](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)

