---
title: Capstone: Mengorkestrasi Pipeline Harian dengan Apache Airflow
duration: 3 weeks
summary: Bangun pipeline harian Apache Airflow untuk pemrosesan data lowongan kerja secara mandiri: lima task dalam satu rantai dependensi, jadwal yang berjalan sekali per hari, retry yang memulihkan keterlambatan file, quality gate yang menolak data rusak, serta pemuatan data yang dapat diulang atau dijalankan acak tanpa menduplikasi satu baris pun. Anda menerima kontrak teknis dan tujuh file kiriman harian; sistem penguji otomatis akan menjalankan DAG Anda dan memverifikasi hasilnya secara independen.
why: Banyak tutorial di internet hanya mengajarkan pembuatan DAG dengan tiga perintah print sederhana. Di dunia kerja nyata, Anda bertanggung jawab atas pipeline yang wajib beroperasi setiap malam, mampu bertahan saat file kiriman datang terlambat, menolak pengiriman yang mayoritas memuat data sampah, dan aman dijalankan ulang untuk tanggal masa lalu mana pun tanpa merusak konsistensi angka analitik. Airflow disyaratkan di sekitar sepertiga lowongan kerja data engineering yang kami survei, dan hampir setiap wawancara teknis menguji pemahaman Anda tentang apa yang terjadi pada data saat sebuah task mengalami kegagalan dan di-retry.
---

## @outcomes
- Menulis DAG Airflow 3 menggunakan TaskFlow API: jadwal harian (@daily), start date tetap yang timezone-aware, konfigurasi retry, rantai dependensi task, dan pertukaran nilai kecil antar-task
- Menggunakan logical date (`ds`) agar setiap eksekusi task murni merupakan fungsi deterministik dari tanggalnya, serta memahami prinsip catchup, backfill, dan data interval
- Menjamin pemuatan data ke analytical warehouse bersifat idempoten: tanggal yang sama dapat dijalankan dua kali, atau dengan urutan acak, dan menghasilkan data yang persis sama
- Mengubah file yang belum tiba menjadi percobaan retry otomatis dan kiriman data yang rusak menjadi penolakan yang tidak memodifikasi kondisi data di warehouse
- Menguji DAG secara lokal tanpa scheduler aktif menggunakan fungsi `dag.test()`, serta membaca status task dan riwayat percobaan (attempt)

## @prereq
Modul 0.2 (virtual environment), 1.2 (idempotensi, retry), 1.6 (ingesti, checkpoint), 2.1 (DuckDB), dan 2.4 (konsep orkestrasi; labnya memakai Dagster, di sini Anda mempelajari Airflow). Anda memerlukan Python 3.10 hingga 3.13, ruang disk kosong sekitar 1 GB (instalasi Airflow sendiri membutuhkan sekitar 450 MB), dan beberapa menit untuk mengunduh paket dependensi.

## @lesson Cara kerja capstone ini
Anda menerima sebuah **kontrak arsitektur**, **tujuh file pengiriman harian** berisi postingan lowongan kerja, serta **skrip pemeriksa otomatis**. Anda memiliki kebebasan penuh dalam merancang implementasi kode DAG Anda. Skrip pemeriksa hanya mengevaluasi hasil akhir yang dapat diamati: bagaimana parser Airflow membaca file DAG Anda, apa yang dituliskan oleh task ke database warehouse, serta bagaimana pipeline merespons saat file datang terlambat atau saat pengiriman data mengalami kerusakan parah. Sebagaimana halnya modul capstone lain dalam kursus ini, **Anda mengerjakannya sendiri secara mandiri**: tanpa menyalin solusi referensi dan tanpa membiarkan AI menulis seluruh kode untuk Anda. Kode bukti kelulusan di akhir capstone ini hanya memiliki arti jika dicapai melalui kerja keras Anda sendiri.

Dataset yang digunakan merupakan **data sintetis terarah**: skrip `fetch_data.py` menghasilkan data dari seed angka tetap untuk meniru karakteristik postingan lowongan kerja yang dikumpulkan dari empat portal karier (pekerjaan yang sama tercantum di beberapa portal, penulisan gaji dengan berbagai gaya teks, penulisan nama skill yang beragam, serta baris teks yang terpotong). Data ini tidak di-scrape dari situs mana pun secara ilegal. Namun, ragam kekacauan datanya mencerminkan kondisi lapangan yang sebenarnya.

Cara kerja skrip pemeriksa agar Anda memahami alur pengujiannya:

1. Sistem menyalin file `.py` di root direktori ruang kerja Anda ke dalam **folder privat sementara** dan membuat folder Airflow home khusus di sana (`<workspace>/.check/`, yang dihapus otomatis di akhir pengujian). Pengaturan dan database Airflow lokal Anda sendiri tidak akan tersentuh.
2. Sistem mengimpor file DAG Anda menggunakan parser internal Airflow untuk menginspeksi konfigurasinya: jadwal, start date, catchup, daftar task, urutan dependensi, dan pengaturan retry.
3. Sistem mengeksekusi DAG Anda menggunakan method **`dag.test()`** untuk serangkaian tanggal yang dipilih. Fungsi ini menjalankan seluruh task dalam satu proses Python lokal, tanpa memerlukan daemon scheduler yang berjalan di background, serta mematuhi konfigurasi retry. Sistem juga menetapkan variabel lingkungan `JOBS_INBOX`, `JOBS_WAREHOUSE`, dan `JOBS_QUARANTINE`.
4. Sistem membandingkan data di warehouse dengan nilai kebenaran yang dihitung secara independen dari file mentah, kemudian menyerang ketahanan pipeline Anda: pengujian rerun, eksekusi tanggal dengan urutan terbalik, file yang sengaja dibuat terlambat beberapa detik, serta kiriman data yang 60% isinya berupa teks sampah.

Langkah persiapan workspace (hanya perlu dijalankan sekali):

```bash
python3 -m venv ~/airflow-lab/venv && source ~/airflow-lab/venv/bin/activate
PYV=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
pip install -r labs/mod-4-4/requirements.txt \
  --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-3.1.8/constraints-$PYV.txt"
python3 labs/mod-4-4/fetch_data.py            # generates the seven deliveries and checks their hash
cp labs/mod-4-4/starter/jobs_pipeline.py ~/airflow-lab/jobs_pipeline.py
```

Argumen `--constraint` mengunci versi dependensi yang telah teruji kompatibel secara resmi dengan Airflow; menginstal Airflow tanpa constraint file sering kali menimbulkan konflik versi library di Python. Proses instalasi memerlukan waktu sekitar 2 hingga 5 menit. Pemeriksaan penuh atas seluruh langkah memerlukan waktu sekitar dua menit, karena engine Airflow memerlukan beberapa detik untuk melakukan bootstrapping internal pada setiap pengujian run.

Bantuan petunjuk tersedia dalam tiga level bertingkat (`--hint 1`, `2`, `3`). Luangkan waktu minimal 30 menit untuk menganalisis masalah sebelum meminta petunjuk. Menghadapi pesan error secara mandiri adalah cara terbaik melatih kemampuan membaca pesan diagnostik Airflow, keterampilan yang akan sangat sering Anda gunakan di lingkungan kerja produksi.

## @lesson Mengenal data pengiriman
Setiap hari, tepat satu file pengiriman tiba di folder inbox: mulai dari `jobs_2026-03-01.jsonl` hingga `jobs_2026-03-07.jsonl`. Setiap baris mewakili satu postingan lowongan kerja dalam format objek JSON:

```json
{"source": "glints", "source_job_id": "gl-164", "title": "qa engineer", "company": "Rajawali Energi", "location": "Jakarta",
 "salary_text": "Rp 12-15jt", "posted_at": "2026-03-02", "skills": ["Power BI", "SQL", " Communication ", "leadership"]}
```

Kekacauan yang sengaja disematkan ke dalam file-file data ini:

- **Baris data rusak.** Beberapa baris terpotong di tengah jalan sehingga menghasilkan JSON tidak valid, beberapa baris tidak memuat field wajib atau bernilai string kosong setelah di-trim, dan beberapa baris mencantumkan format tanggal `posted_at` yang tidak valid (misalnya `31/02/2026` atau teks `yesterday`).
- **Satu hari memuat data yang mayoritas sampah.** Perhatikan rasio baris yang tidak dapat digunakan per file pengiriman: pengiriman pada salah satu hari memiliki rasio kegagalan yang jauh lebih buruk daripada hari-hari lainnya. Pipeline produksi wajib mampu mendeteksi anomali ini.
- **Pekerjaan yang sama di beberapa portal.** Posisi dari perusahaan, judul, dan lokasi yang sama dapat muncul di dua, tiga, atau empat portal kerja sekaligus, di mana setiap baris memiliki `source_job_id` uniknya masing-masing. Judul dan nama perusahaan ditulis dengan kombinasi huruf kapital yang berbeda serta spasi tambahan.
- **Teks rentang gaji dalam berbagai variasi format**: misalnya `Rp 8.000.000 - 12.000.000/Bulan`, `IDR 7,000,000 - 9,000,000 per month`, `Rp 5-10jt`, `Rp 6,5-8,5jt`, `Rp 9.000.000/Bulan`, teks tanpa angka seperti `Negotiable`, atau tidak ada data gaji sama sekali (null/kosong).
- **Variasi penulisan skill**: misalnya `SQL`, `sql`, ` Sql `, `powerbi`, `Power-BI`, `postgres`, dan `gcp`.
- **Postingan ulang (reposts).** Suatu pekerjaan dapat diposting kembali pada hari berikutnya. Dalam pemodelan data harian, kemunculan tersebut dihitung sebagai postingan baru yang aktif pada hari itu.

Pertanyaan yang wajib Anda selesaikan sebelum mulai menulis kode (langkah 1 pada skrip penguji meminta Anda menghitung sembilan angka profil data): berapa total baris teks yang ada, berapa baris yang tidak dapat digunakan dan apa rincian alasan kegagalannya untuk masing-masing dari ketiga kategori, berapa portal sumber data yang tercatat, portal mana yang paling banyak memuat postingan, berapa baris yang mencantumkan informasi gaji, dan hari mana yang memiliki kualitas data terburuk. Hitung angka-angka ini menggunakan skrip Python sederhana. Jangan melewati langkah ini: angka-angka tersebut merupakan tolok ukur rekonsiliasi data pertama Anda yang akan dicocokkan dengan hasil pipeline nantinya.

## @lesson Airflow dalam lima belas menit
**Apache Airflow** adalah platform orkestrasi untuk mendefinisikan, menjadwalkan, dan memantau alur kerja data secara terprogram menggunakan bahasa Python. Anda merancang dependensi alur kerja; Airflow mengelola penjadwalannya, mengeksekusi task sesuai urutan, menangani retry otomatis saat terjadi error, mencatat setiap riwayat percobaan eksekusi, serta menyajikan visualisasinya melalui antarmuka web.

- **DAG** (directed acyclic graph) adalah representasi alur kerja: sekumpulan task beserta hubungan ketergantungan antar-task tanpa adanya perulangan siklis (loop). DAG didefinisikan dalam file Python biasa yang **diimpor berulang kali secara berkala oleh scheduler Airflow** untuk mendeteksi apakah terjadi perubahan konfigurasi. Oleh karena itu, level teratas (top-level) file DAG harus sangat ringan dan terbebas dari side-effect: dilarang membuka koneksi database, dilarang membaca isi file, dilarang memanggil request jaringan, dan dilarang menggunakan `datetime.now()` di pengaturan. Pekerjaan pemrosesan data nyata wajib diletakkan *di dalam* fungsi task, yang hanya dieksekusi saat dijadwalkan.
- **Task** adalah satu unit kerja terisolasi. Dalam TaskFlow API modern, Anda cukup menulis fungsi Python biasa dan membubuhkan dekorator `@task`; nama fungsi tersebut secara otomatis menjadi ID task. Memanggil fungsi task layaknya fungsi biasa (`validate(extract())`) mendefinisikan urutan eksekusi sekaligus jalur pertukaran data antar-task.
- **Pertukaran data.** Nilai yang di-return oleh sebuah task diteruskan ke task berikutnya melalui database metadata Airflow (mekanisme *XCom*). Fitur ini dirancang khusus untuk memindahkan data **berukuran kecil**: path file, angka ringkasan baris, atau tanggal. Jangan pernah me-return dataset berisi ribuan baris data; simpan data tersebut ke dalam file staging atau tabel database dan kembalikan lokasi path penyimpanannya.
- **Jadwal dan tanggal logis (logical date).** Konfigurasi `schedule="@daily"` membuat satu jadwal eksekusi per hari. Setiap run memiliki *logical date* unik, dan fungsi task dapat menerima nilai ini dalam format string `ds` (misalnya `"2026-03-02"`) cukup dengan menambahkan parameter `ds` pada fungsi. **Gunakan parameter `ds` ini alih-alih tanggal hari ini**: run untuk tanggal 2 Maret harus selalu memproses file kiriman 2 Maret baik saat dieksekusi tepat pada 2 Maret, pada 9 Maret (karena terlambat), maupun saat proses backfill historis.
- **Start date dan catchup.** Pengaturan `start_date` menentukan titik awal jadwal alur kerja; nilai ini wajib berupa tanggal tetap yang timezone-aware, bukan `datetime.now()` (start date yang berubah setiap kali file diimpor akan merusak konsistensi penjadwal). Opsi `catchup=True` akan memicu eksekusi massal untuk setiap hari yang terlewat sejak `start_date` begitu DAG diaktifkan; sedangkan dengan `catchup=False`, sistem hanya menjadwalkan eksekusi untuk periode baru dan membiarkan periode masa lalu dieksekusi secara manual bila diperlukan (*backfill*).
- **Retry.** Parameter `retries` dan `retry_delay` (di dalam `default_args`) menentukan berapa kali dan berapa lama jeda tunggu saat sebuah task yang gagal dicoba kembali. Task yang *melempar exception* dianggap gagal dan akan dijadwalkan untuk retry. Task yang diam-diam mengembalikan hasil yang salah akan dianggap sukses oleh Airflow, dan kerusakan data tidak akan terdeteksi. Di lingkungan produksi nyata jeda retry biasanya berdurasi beberapa menit; dalam lab capstone ini jeda retry dibatasi maksimal 5 detik agar pemeriksa otomatis tidak menunggu terlalu lama.
- **Status (States).** Task dapat berstatus `success`, `failed`, `up_for_retry`, atau `upstream_failed` (tidak dijalankan karena task sebelumnya mengalami kegagalan). Sebuah run berstatus `success` atau `failed`.
- **`max_active_runs=1`** membatasi agar hanya ada satu run aktif dari DAG ini pada satu waktu, mencegah dua hari pemrosesan menulis ke tabel database yang sama secara bersamaan.

Dekorator `@dag` menerima parameter `dag_id`, `schedule`, `start_date`, `catchup`, `max_active_runs`, `default_args`, dan `tags`. Anda mengimpor dekorator ini melalui `from airflow.sdk import dag, task`. Untuk mencoba secara mandiri: perintah `airflow standalone` menjalankan seluruh sistem lengkap dengan server web (terminal akan menampilkan kredensial login); fungsi `dag.test(logical_date=...)` mengeksekusi satu run penuh di dalam proses terminal Anda sendiri, yang merupakan mekanisme yang dipakai oleh skrip penguji dan sangat disarankan untuk Anda gunakan selama pengembangan. Pengujian kami mencatat waktu eksekusi sekitar 10 detik untuk satu run penuh DAG lima task, di mana sebagian besar waktu dipakai untuk inisialisasi internal Airflow.

Dua prinsip utama yang jauh lebih krusial daripada sekadar operator Airflow: **jadikan setiap task sebagai fungsi murni dari tanggal dan inputnya saja**, serta **jadikan setiap operasi penyimpanan menggantikan (replace) data lama alih-alih menambahkan (append)**. Seluruh materi berikutnya dalam modul ini berfokus pada penerapan kedua prinsip tersebut.

## @lesson Kontrak arsitektur teknis
Pelajaran ini merupakan spesifikasi formal alur kerja. Skrip pemeriksa otomatis menguji kepatuhan kode Anda terhadap kontrak ini secara ketat.

**File dan lingkungan kerja.** Direktori ruang kerja Anda memuat file `jobs_pipeline.py` (file utama DAG; modul pembantu diizinkan asalkan berupa file `.py` yang berada di direktori yang sama, bukan di subfolder) dan file `profile.json`. Skrip penguji menyediakan tiga variabel lingkungan; baca variabel-variabel ini **di dalam fungsi task** saat dieksekusi, bukan di level teratas file saat modul diimpor: `JOBS_INBOX` (folder penyedia file `jobs_YYYY-MM-DD.jsonl`), `JOBS_WAREHOUSE` (lokasi path file database DuckDB), dan `JOBS_QUARANTINE` (folder penampung baris data yang ditolak). File staging untuk pertukaran data antar-task dapat diletakkan di dalam subfolder dari direktori warehouse.

**Konfigurasi DAG.** Menggunakan `dag_id` bernama `jobs_pipeline`; frekuensi satu run per hari (`@daily`); konfigurasi `start_date` tetap yang timezone-aware tidak lebih lambat dari 2026-03-01; opsi `catchup=False`; konfigurasi `max_active_runs=1`; setiap task memiliki `retries` minimal 2 serta `retry_delay` lebih dari 0 dan maksimal 5 detik. Terdiri dari lima task yang terhubung dalam satu rantai dependensi sekuensial dengan ID persis seperti ini: `extract` → `validate` → `transform` → `load` → `publish_mart`.

**Operasi yang dijalankan masing-masing task untuk tanggal `ds`:**

1. `extract`: mencari keberadaan file `jobs_<ds>.jsonl` di dalam folder inbox. Jika file belum ditemukan, **lemparkan exception** (karena pengiriman file mungkin hanya terlambat beberapa detik; Airflow akan menangani kondisi ini melalui retry otomatis).
2. `validate`: membaca baris data (abaikan baris kosong) dan menolak baris data berdasarkan urutan validasi berikut: baris bukan berupa objek JSON yang valid (`invalid_json`); salah satu dari kolom `source`, `source_job_id`, `title`, atau `company` hilang atau bernilai kosong setelah di-trim (`missing_field`); kolom `posted_at` bukan merupakan format tanggal ISO `YYYY-MM-DD` (`bad_date`). Jika **lebih dari 50%** dari total baris data dinyatakan tidak valid, **lemparkan exception**: kiriman data pada hari tersebut ditolak sepenuhnya. Jika tidak melampaui ambang batas kegagalan, tuliskan baris-baris yang ditolak ke file `JOBS_QUARANTINE/rejected_<ds>.jsonl` (satu objek JSON per baris memuat alasan `reason` dan teks asli `line`), lalu teruskan baris data yang valid ke task berikutnya.
3. `transform`: untuk setiap baris data yang valid, susun nilai `job_key` = `company|title|location`, di mana setiap komponen di-trim, spasi berlebih dirapatkan menjadi satu spasi, dan diubah menjadi huruf kecil. Baris data dengan `job_key` yang identik dianggap sebagai **satu pekerjaan yang sama** (postingan yang terdaftar di beberapa portal kerja sekaligus): pertahankan nilai atribut dari baris yang pertama kali muncul di file, dan hitung jumlah portal uniknya sebagai `n_sources`. Kolom `title`, `company`, dan `location` disimpan dalam format bersih tersebut. Parsing teks `salary_text` menjadi batas minimum dan maksimum **dalam mata uang IDR per bulan**: ekstrak angka dari teks; jika teks memuat kata `jt`, kalikan dengan satu juta dengan koma sebagai pemisah desimal, jika tidak, tanda titik dan koma berfungsi sebagai pemisah ribuan; jika hanya ada satu angka maka nilai minimum sama dengan maksimum; jika tidak memuat angka maka kedua batas bernilai NULL.

   | Format `salary_text` | min | max |
   |---|---|---|
   | `Rp 8.000.000 - 12.000.000/Bulan` | 8000000 | 12000000 |
   | `IDR 7,000,000 - 9,000,000 per month` | 7000000 | 9000000 |
   | `Rp 5-10jt` | 5000000 | 10000000 |
   | `Rp 6,5-8,5jt` | 6500000 | 8500000 |
   | `Rp 9.000.000/Bulan` | 9000000 | 9000000 |
   | `Negotiable`, string kosong, atau tidak ada | NULL | NULL |

   Normalisasi setiap skill: lakukan trim, rapatkan spasi, ubah ke huruf kecil, lalu terapkan pemetaan alias berikut: `postgres` → `postgresql`, `powerbi` → `power bi`, `power-bi` → `power bi`, `py` → `python`, `gcp` → `google cloud`, `amazon s3` → `s3`. Setiap pekerjaan mencatat setiap skill maksimal satu kali.
4. `load`: menulis data ke dalam tabel di bawah ini **khusus untuk tanggal `ds` yang sedang diproses**, menggantikan data apa pun yang sebelumnya ada untuk tanggal tersebut, dan dilakukan secara atomik (seluruhnya tersimpan atau tidak sama sekali).
5. `publish_mart`: membangun ulang tabel mart analitik `mart_skill_demand(skill, job_postings, share_pct)` dari tabel-tabel utama untuk seluruh tanggal yang telah termuat: `job_postings` adalah jumlah baris pada tabel `job_skills` untuk skill tersebut, dan `share_pct` dihitung dengan rumus `100 * job_postings / (total baris di tabel jobs)` dibulatkan hingga 1 angka desimal.

**Struktur tabel** di dalam `JOBS_WAREHOUSE`: tabel `jobs(ds DATE, job_key, title, company, location, salary_min_idr BIGINT, salary_max_idr BIGINT, n_sources INTEGER)` dengan satu baris per kombinasi `ds` dan `job_key`, serta tabel relasi `job_skills(ds DATE, job_key, skill)`.

## @lesson Merancang pipeline agar tahan banting
**Seluruh operasi merupakan fungsi deterministik dari tanggal.** Jika sebuah task menanyakan "hari apa sekarang?" alih-alih "tanggal berapa run ini ditujukan?", menjalankan ulang jadwal masa lalu akan menghasilkan data yang salah. Setiap nama file, filter `WHERE`, dan path output di pipeline ini wajib dibangun berdasarkan parameter `ds`.

**Gantikan data lama, jangan pernah menambah secara membabi buta (replace, never append).** Bug paling klasik di Airflow: task menyisipkan baris dengan append, task mengalami timeout lalu di-retry, dan seluruh baris data masuk dua kali lipat. Solusinya adalah menerapkan prinsip idempotensi dari Modul 1.2 pada partisi tanggal: di dalam satu transaksi database, *hapus baris data untuk tanggal tersebut, lalu sisipkan data yang baru*. Dijalankan satu kali maupun lima kali berturut-turut, isi tabel akan tetap sama persis. Eksekusi ini wajib dibungkus dalam satu transaksi agar kegagalan di tengah proses tidak meninggalkan kondisi tabel yang kosong atau terpotong. Tabel mart juga dibangun ulang secara total dari tabel fakta, bukan ditambahkan secara inkremental, dengan alasan ketahanan yang sama. Menjalankan ulang pipeline di tengah proses backfill, atau mengeksekusi tanggal 4 Maret mendahului 3 Maret, tidak akan pernah merusak akurasi data.

**Kegagalan adalah informasi; keheningan adalah bahaya.** File yang belum ada saat `extract` berjalan wajib memicu error exception: Airflow kemudian akan menunggu selama jeda `retry_delay` lalu mencoba kembali, sehingga file yang terlambat beberapa detik akan berhasil diproses pada percobaan berikutnya. Jika task `extract` justru diam dan mengembalikan hasil kosong, status DAG akan tetap hijau tetapi data hari tersebut hilang tanpa jejak. Logika yang sama berlaku untuk kiriman data yang mayoritas berupa data rusak: memuat 40% data yang tersisa secara diam-diam akan menyajikan laporan harian yang tidak lengkap ke manajemen. Lemparkan exception di task `validate` sebelum ada data yang ditulis ke database; Airflow akan menandai task gagal, task-task setelahnya berstatus `upstream_failed`, sementara data kemarin dan tabel mart analitik tetap terjaga aman. Tim engineering akan menerima notifikasi peringatan dan dapat mengambil keputusan yang tepat.

**Kirimkan nilai kecil antar-task, simpan data besar di storage.** Task hanya boleh me-return path file dan angka ringkasan baris. File staging sementara yang dinamai berdasarkan tanggal sangat aman digunakan, dan percobaan retry akan langsung menimpa file tersebut secara bersih.

**Jaga agar proses impor level teratas tetap ringan.** Airflow melakukan parsing terhadap file DAG secara terus-menerus. Mengimpor library seperti `os`, `json`, atau `duckdb` di awal file diperbolehkan; namun membuka koneksi database atau membaca isi folder inbox di level teratas file sangat dilarang.

**Lakukan pengujian dini menggunakan `dag.test()`.** Setelah selesai menulis sebuah fungsi task, jalankan DAG untuk satu tanggal tertentu secara lokal dan periksa isi tabel database DuckDB Anda. Skrip pemeriksa otomatis menggunakan mekanisme pengujian yang persis sama, sehingga apa yang Anda amati di terminal lokal adalah apa yang dinilai oleh sistem penguji.

## @lab Lab: lima langkah membangun pipeline produksi harian di Airflow
Bangun file `jobs_pipeline.py` dan `profile.json` di direktori ruang kerja Anda secara bertahap, dan jalankan modul pemeriksa setelah menyelesaikan setiap langkah. Pemeriksa akan mengeksekusi DAG Anda pada file pengiriman riil serta file yang sengaja dirusak, lalu membandingkan isi database warehouse Anda dengan hasil perhitungan independen.

### @steps
1. **Persiapan lingkungan.** Ikuti panduan persiapan di pelajaran pertama (buat virtual environment, instal paket dengan constraint file resmi, jalankan `fetch_data.py`, dan salin template awal ke direktori kerja Anda). Buka salah satu file pengiriman harian dan periksa seratus baris data pertama secara manual untuk memahami variasinya.
2. **Pemeriksa langkah 1: profiling data.** Buat file `profile.json` yang memuat sembilan metrik hasil analisis dari ketujuh file pengiriman mentah: `files` (jumlah file pengiriman), `lines_total` (total baris tidak kosong), `invalid_json_lines`, `lines_missing_required` (JSON valid namun ada kolom wajib yang hilang atau kosong), `lines_bad_date` (JSON valid, kolom wajib lengkap, namun `posted_at` bukan tanggal ISO), `distinct_sources` (jumlah portal sumber unik di antara baris JSON valid), `busiest_source` (portal sumber dengan baris terbanyak), `lines_with_salary` (baris JSON valid yang memuat teks gaji), dan `worst_day` (tanggal pengiriman, seperti `2026-03-04`, yang memiliki persentase baris rusak tertinggi). Uji dengan perintah: `python3 labs/mod-4-4/check.py ~/airflow-lab --step 1`.
3. **Pemeriksa langkah 2: struktur DAG.** Tuliskan struktur DAG sesuai spesifikasi kontrak teknis beserta lima task yang terhubung dalam satu rantai dependensi, meskipun task-task tersebut belum memproses data nyata (cukup mengembalikan nilai sederhana terlebih dahulu). Jalankan pengujian `--step 2` dan perbaiki konfigurasi yang ditandai oleh sistem penguji.
4. **Pemeriksa langkah 3: pemrosesan satu hari.** Lengkapi logika di dalam fungsi-fungsi task agar mampu memproses satu hari pengiriman secara penuh: validasi, transformasi, pemuatan ke tabel DuckDB, dan pembaruan mart analitik. Uji secara mandiri terlebih dahulu menggunakan fungsi `dag.test()` untuk satu tanggal, cocokkan jumlah barisnya dengan profil yang Anda peroleh di langkah 1, lalu jalankan pengujian `--step 3`.
5. **Pemeriksa langkah 4: idempotensi dan urutan eksekusi.** Skrip penguji akan mengeksekusi enam hari data dengan urutan acak, termasuk dua pengujian rerun pada tanggal yang sama. Pastikan operasi pemuatan data Anda menimpa data lama untuk tanggal yang bersangkutan dan tabel mart dibangun ulang dengan benar. Cobalah merusak kode Anda secara sengaja terlebih dahulu (misalnya hapus perintah DELETE, lalu jalankan tanggal yang sama dua kali) untuk melihat dampak penggandaan data di tabel. Jalankan pengujian `--step 4`.
6. **Pemeriksa langkah 5: ketahanan terhadap kegagalan.** Sebuah file pengiriman disimulasikan datang terlambat beberapa detik; kiriman tanggal 5 Maret disimulasikan memuat mayoritas data rusak. Pastikan skrip Anda mampu memulihkan diri pada kasus pertama dan menghentikan pemrosesan secara aman tanpa memodifikasi database pada kasus kedua. Jalankan pengujian `--step 5`.
7. **Mengalami kendala?** Baca kembali materi pelajaran yang relevan, periksa struktur data mentah serta teks pesan kesalahan dari Airflow, lalu gunakan petunjuk bertingkat jika diperlukan: `python3 labs/mod-4-4/check.py ~/airflow-lab --step 3 --hint 1` (kemudian 2, lalu 3).
8. **Penyelesaian.** Ketika pengujian `--step all` berhasil lulus seutuhnya, jalankan perintah `python3 scripts/prove.py mod-4-4 ~/airflow-lab` untuk menghasilkan kode verifikasi kelulusan. Tuliskan file `NOTES.md` di direktori kerja Anda: tuliskan tiga kalimat mengenai hal yang paling mengejutkan Anda dalam Airflow, serta aspek apa saja yang akan Anda pantau jika pipeline ini berjalan setiap malam di produksi (misalnya persentase baris data yang ditolak per hari dan usia keterlambatan file kiriman terbaru).

### @files
- labs/mod-4-4/starter/jobs_pipeline.py :: File template awal kerja: salin ke ruang kerja Anda dan kembangkan DAG di sana :: starter
- labs/mod-4-4/check.py :: Skrip pemeriksa otomatis: lima langkah pengujian, petunjuk bertingkat, dan kode bukti :: test
- labs/mod-4-4/fetch_data.py :: Menghasilkan tujuh file pengiriman sintetis dan memverifikasi hash integritasnya :: config
- labs/mod-4-4/requirements.txt :: Spesifikasi versi Airflow 3.1.8 dan DuckDB beserta panduan instalasi :: config

### @deliverables
- Perintah `python3 labs/mod-4-4/check.py ~/airflow-lab --step all` berhasil lulus seutuhnya **di komputer Anda sendiri, di dalam virtual environment Anda**
- Anda mampu menjelaskan apa itu parameter `ds`, mengapa task wajib menggunakannya alih-alih tanggal hari ini, serta apa dampak dari opsi `catchup=False`
- Anda mampu menguraikan mengapa operasi `load` wajib menjalankan delete dan insert dalam satu transaksi database, dan apa konsekuensi fatal jika task melakukan append pada setiap percobaan retry
- Anda mampu menjelaskan mengapa file yang hilang wajib melempar exception alih-alih mengembalikan hasil kosong, serta mengapa kiriman rusak harus menggagalkan task sebelum data sempat ditulis
- File `NOTES.md` Anda mencatat evaluasi teknis mengenai hal yang Anda pelajari serta strategi pemantauan harian pipeline di produksi

### @verify
```bash
python3 labs/mod-4-4/check.py ~/airflow-lab --step all
python3 scripts/prove.py mod-4-4 ~/airflow-lab
```

## @chaos Retry yang melipatgandakan baris tabel
### @scenario
Sebuah tim rekayasa data mengelola pipeline harian di Airflow yang memuat data lowongan kerja ke analytical warehouse untuk menyuplai dasbor tren rekrutmen. Task `load` membaca file pengiriman hari itu lalu menyisipkan baris-baris data ke tabel `jobs` menggunakan perintah append biasa. Pipeline ini berjalan lancar selama berbulan-bulan tanpa kendala.

Pada suatu malam, server database mengalami lonjakan beban sehingga task `load` mengalami timeout setelah berhasil menyisipkan sebagian besar baris data. Scheduler Airflow menjalankan fungsinya sesuai konfigurasi: menjadwalkan retry otomatis untuk task yang gagal tersebut. Percobaan retry membaca file yang sama dan menyisipkan kembali seluruh baris data dari awal ke dalam tabel. Keesokan paginya pada dasbor visualisasi, tanggal tersebut menampilkan jumlah lowongan dua kali lipat lebih banyak dan grafik kebutuhan keahlian mencatat lonjakan drastis yang tidak wajar. Seminggu kemudian tim menyadari bahwa data hari Minggu sebelumnya juga mengalami penggelembungan serupa: seorang engineer sempat me-rerun jadwal hari itu secara manual untuk memastikan kebersihan data, dan eksekusi tersebut menyisipkan data tambahan ke tabel yang sama.

### @cause
Task pemuatan data tersebut **tidak bersifat idempoten**. Operasi retry otomatis, rerun manual oleh operator, dan proses backfill historis memiliki hakikat yang sama di mata data: eksekusi ulang dari task yang sama untuk tanggal yang sama. Task yang melakukan append akan mengubah setiap eksekusi ulang menjadi baris duplikat. Di samping itu, tabel mart analitik menambahkan data baru ke total sebelumnya alih-alih dibangun ulang secara menyeluruh, sehingga satu pemuatan ganda merusak tampilan dasbor analitik secara permanen.

Faktor penyebab lain: operasi load tidak dibungkus dalam transaksi atomik sehingga crash meninggalkan data parsial yang menggantung di database; tidak ada proses rekonsiliasi yang membandingkan jumlah baris tersimpan dengan jumlah baris di file mentah; serta pipeline tidak pernah diuji terhadap skenario eksekusi ganda pada tanggal yang sama.

### @fix
1. **Gantikan partisi data dalam satu transaksi atomik**: hapus seluruh baris untuk tanggal yang bersangkutan, sisipkan baris yang baru, lalu commit transaksi. Rerun dapat dilakukan berkali-kali dengan aman.
2. **Bangun ulang tabel turunan** (tabel mart analitik) langsung dari tabel fakta dasar alih-alih menambahkan angka secara akumulatif.
3. **Uji sifat idempotensi** di dalam pipeline CI: jalankan pemrosesan tanggal yang sama dua kali berturut-turut lalu bandingkan sidik jari tabel (jumlah baris dan hash checksum), sebagaimana yang diuji oleh skrip pemeriksa.
4. **Lakukan rekonsiliasi metrik**: catat jumlah baris yang dibaca, ditolak, dan dimuat pada setiap run, serta aktifkan peringatan otomatis jika jumlah baris yang termuat tidak sesuai dengan data valid.
5. **Perbaiki data historis**: jalankan ulang eksekusi untuk tanggal-tanggal yang terdampak. Pada pipeline yang telah idempoten, tindakan ini cukup berupa satu perintah rerun, dan angka yang akurat akan langsung pulih di dasbor tanpa memerlukan manipulasi SQL manual.

### @pattern
Di dalam sistem orkestrasi data, operasi retry, rerun manual, dan backfill adalah peristiwa normal dalam siklus hidup operasional, bukan anomali. Rancang setiap task sedemikian rupa sehingga eksekusi ulang untuk tanggal yang sama menghasilkan kondisi data yang identik: jadikan tanggal sebagai parameter utama, gunakan prinsip replace alih-alih append, dan pastikan seluruh operasi tulis bersifat all-or-nothing.

## @quiz
### Mengapa `start_date` sebuah DAG wajib berupa tanggal tetap dan bukan `datetime.now()`?
- [ ] Airflow secara otomatis menolak mengimpor file DAG apa pun yang mencantumkan jam saat ini dalam setting konfigurasi sistem
- [ ] Tanggal tetap membuat eksekusi task berjalan lebih cepat karena Airflow dapat mencatat jadwal di cache disk
- [x] File DAG diimpor berulang kali oleh scheduler, sehingga tanggal dinamis akan terus mengubah jadwal eksekusi
- [ ] Penggunaan start date dinamis diperbolehkan asalkan tidak dikombinasikan dengan konfigurasi retry pada task

> File DAG diparsing secara terus-menerus oleh Airflow scheduler. Jika start date berubah pada setiap siklus parsing, jadwal eksekusi tidak akan pernah stabil dan tanggal logis dari run yang dihasilkan kehilangan makna keteraturannya.

### Sebuah DAG run dijadwalkan untuk logical date 2026-03-02 tetapi baru dieksekusi pada 9 Maret. File mana yang harus dibaca oleh `extract`?
- [ ] File bertanggal 9 Maret karena itulah hari di mana task tersebut secara fisik sedang berjalan di server produksi backend
- [x] File bertanggal 2 Maret yang diambil dari parameter `ds`, karena run tersebut ditujukan bagi tanggal itu
- [ ] File terbaru yang ada di folder inbox, karena kiriman paling baru selalu memuat data yang paling akurat
- [ ] Seluruh file pengiriman selama bulan Maret, karena Airflow tidak dapat mengetahui tanggal spesifik run

> Parameter `ds` merepresentasikan tanggal logis yang menjadi target pemrosesan run tersebut. Menggunakan `ds` menjamin bahwa eksekusi yang terlambat, rerun manual, maupun backfill historis selalu menghasilkan data yang identik dengan eksekusi tepat waktu.

### Sebuah task menyisipkan 1.000 baris ke tabel lalu mengalami crash. Airflow me-retry task tersebut. Bagaimana desain yang tepat?
- [ ] Menonaktifkan fitur retry untuk seluruh task pemuatan data, karena retry hanya akan memperburuk kondisi
- [ ] Menghitung ulang jumlah baris setelah setiap percobaan dan menghapus data duplikat secara manual di pagi hari
- [x] Menghapus data tanggal tersebut lalu menyisipkannya kembali dalam satu transaksi sehingga retry aman diulang
- [ ] Menyisipkan data ke tabel kedua pada setiap percobaan lalu membiarkan dasbor memilih data yang paling baru

> Idempotensi adalah prinsip arsitektur yang paling mendasar: input yang sama untuk tanggal yang sama harus menghasilkan kondisi tabel yang sama, tidak peduli berapa kali task dijalankan ulang. Membungkus operasi delete dan insert dalam satu transaksi menjamin integritas all-or-nothing.

### File pengiriman harian belum tiba saat task `extract` mulai berjalan. Apa yang semestinya dilakukan oleh `extract`?
- [ ] Mengembalikan hasil kosong dan berstatus sukses agar seluruh task berikutnya di dalam pipeline tetap hijau tanpa hambatan
- [x] Memicu exception agar Airflow menandai percobaan tersebut gagal dan menjadwalkan retry beberapa saat kemudian
- [ ] Membuat file kosong dengan format nama yang sesuai agar task-task berikutnya tetap memiliki data untuk dibaca
- [ ] Mengabaikan task tersebut secara diam-diam dan membiarkan jadwal esok hari melengkapi data yang belum masuk

> Kegagalan yang eksplisit adalah informasi diagnostik yang berharga, sedangkan status sukses dengan data kosong adalah lubang data yang berbahaya. Memicu exception akan mengaktifkan mekanisme retry Airflow, yang akan berhasil memproses file begitu pengiriman tiba.

### Mengapa pipeline menolak pengiriman file jika lebih dari separuh baris data di dalamnya dinyatakan tidak valid?
- [ ] Airflow tidak memiliki kapasitas penyimpanan untuk menampung lebih dari 50% data tertolak di folder karantina storage lokal
- [ ] DuckDB tidak dapat menerima pembuatan tabel yang memuat lebih sedikit baris valid dibandingkan baris rusak
- [x] Tingkat kegagalan setinggi itu mengindikasikan masalah hulu yang parah, dan memprosesnya akan merusak warehouse
- [ ] Percobaan retry akan berjalan tanpa henti karena baris yang ditolak akan di-retry sampai menjadi data valid

> Jika 40% data yang tersisa tetap dimuat, laporan harian akan tampak normal di permukaan tetapi memuat angka yang salah fatal. Menggagalkan eksekusi di task `validate` sebelum data sempat ditulis melindungi integritas warehouse, dan task-task berikutnya berakhir aman dengan status `upstream_failed`.

### Mengapa task dalam Airflow sebaiknya mengembalikan nilai berupa path file atau angka ringkasan dan bukan data mentah itu sendiri?
- [ ] Fungsi Python di dalam task tidak diizinkan mengembalikan list objek, melainkan hanya angka tunggal atau string teks biasa
- [ ] Airflow secara otomatis menghapus setiap list kembalian yang memuat lebih dari sepuluh item sebelum task lanjut
- [x] Nilai kembalian task disimpan di database metadata Airflow (XCom), yang hanya dirancang untuk muatan bernilai kecil
- [ ] Mengembalikan kumpulan data mentah merusak sifat idempotensi task karena task berikutnya menerima salinan data

> Nilai return task disimpan di tabel metadata Airflow melalui XCom. Menyimpan dataset besar di sana akan membebani database operasional dan memperlambat sistem. Simpan data di file atau tabel database dan teruskan informasi lokasinya saja.

### Mengapa mengeksekusi operasi berat di level teratas (top-level) file DAG, seperti membuka koneksi database, merupakan praktik buruk?
- [ ] Kode top-level hanya berjalan satu kali sehingga koneksi database akan terbuka permanen selama umur operasional klaster
- [x] Airflow mengimpor file secara berulang dan berkala, sehingga kode tersebut akan dieksekusi terus dan membebani server
- [ ] Airflow melarang seluruh baris import di level teratas file DAG selain modul paket airflow resmi yang terverifikasi
- [ ] Scheduler akan mengabaikan DAG apa pun jika proses parsing top-level memerlukan waktu lebih dari beberapa milidetik

> Proses parsing file DAG berlangsung terus-menerus dalam frekuensi tinggi di scheduler. Batasi kode top-level hanya untuk deklarasi import dasar dan konfigurasi DAG; letakkan seluruh beban kerja pemrosesan data di dalam fungsi task.

### Dengan konfigurasi `catchup=False`, apa yang terjadi saat Anda mengaktifkan DAG yang memiliki `start_date` tiga bulan lalu?
- [ ] Airflow langsung mengeksekusi seluruh jadwal tiga bulan lalu secara paralel untuk mengejar ketertinggalan waktu kalender
- [x] Airflow hanya menjadwalkan eksekusi baru mulai saat ini, sedangkan periode masa lalu dijalankan manual jika perlu
- [ ] DAG akan berstatus jeda (paused) sampai ada operator yang memilih tanggal eksekusi secara manual lewat web UI
- [ ] Airflow akan menghapus jadwal lama dan memilih start date baru secara acak untuk keberlanjutan pipeline

> Fitur catchup akan memicu eksekusi otomatis untuk setiap interval jadwal yang terlewat di masa lalu. Menonaktifkannya (`catchup=False`) menjaga agar eksekusi historis tetap berada di bawah kendali penuh Anda melalui perintah backfill yang disengaja.

## @resources
- [Airflow: DAGs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html)
- [Airflow: the TaskFlow tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)
- [Airflow: best practices](https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html)
- [Airflow: DAG runs (logical date, catchup, backfill)](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html)
- [Airflow: installing from PyPI (constraint files)](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html)

