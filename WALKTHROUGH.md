# Panduan Belajar Pemula: Dari Nol Menjadi Data Engineer Profesional (Zero-to-Hero Walkthrough)

Selamat datang di **DataForge**. Platform ini dibangun dengan satu filosofi utama: **Anti-Tutorial-Hell**.

Jika Anda benar-benar awam dan bertanya:
> *"Apakah kurikulum ini benar-benar didesain agar orang awam bisa menjadi profesional sungguhan?"*

Jawabannya: **Ya, dengan syarat Anda benar-benar mempraktikkan kodenya, bukan sekadar membaca.**

Di dunia kerja nyata, seorang Data Engineer tidak dinilai dari berapa banyak video tutorial yang ditonton atau sertifikat kelulusan yang dipajang. Anda dinilai dari:
1. Apakah Anda bisa menulis pipeline data yang idempoten dan tahan banting (*fault-tolerant*)?
2. Apakah Anda mengerti apa yang terjadi di balik layar (memori, partisi disk, query execution plan, network shuffle)?
3. Ketika pipeline produksi meledak jam 3 pagi (OOM, disk WAL penuh, data duplikat), apakah Anda tahu cara mendiagnosis akar masalahnya (*root cause*) dan memperbaikinya?

Kurikulum 24 modul di platform ini dirancang berjenjang untuk melatih insting tersebut dari hari pertama.

---

> **Aturan main:** kerjakan sendiri. Jangan menyalin solusi referensi atau meminta AI menulis lab untuk Anda; bertanyalah untuk *memahami* setelah mencoba minimal 30 menit. Kode bukti tidak bisa membuktikan siapa yang menulis kode; yang dirugikan jika curang adalah Anda sendiri.

## 1. Arsitektur Belajar: Loop 4 Langkah Setiap Modul

Setiap modul di DataForge memiliki 4 komponen yang wajib Anda selesaikan secara berurutan:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   1. LESSONS    │ ──> │  2. HANDS-ON    │ ──> │ 3. CHAOS        │ ──> │    4. QUIZ      │
│  (Teori & Fondasi)│     │     LAB         │     │    SCENARIO     │     │  (Passing 80%)  │
│  ~2.500 kata    │     │(Starter vs Test)│     │ (Insiden Nyata) │     │  8 Soal Analisis│
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Langkah 1: Pelajari Lessons (Teori & Arsitektur)
- Buka tab **Lessons** di web app (`http://localhost:3000`).
- Anda bisa memilih bahasa pengantar (**ID** untuk Bahasa Indonesia atau **EN** untuk Bahasa Inggris) menggunakan tombol switch di navigasi atas.
- *Tips untuk remote job*: Mulailah membaca dalam Bahasa Indonesia untuk pemahaman konsep awal, lalu baca ulang versi Inggris agar Anda terbiasa dengan terminologi teknis global yang akan dipakai saat wawancara kerja.

### Langkah 2: Kerjakan Hands-on Lab
Semua lab berada di folder `labs/mod-X-Y/`. Setiap lab memiliki:
- **Starter code**: Kode awal yang sengaja belum lengkap atau memiliki bug sehingga pengujian otomatis (*unit tests*) akan gagal.
- **Test suite (`test_*.py` atau `verify.sh`)**: Kumpulan pengujian otomatis untuk memvalidasi solusi Anda.
- **Reference solution (`reference/`)**: Kunci jawaban berstandar industri jika Anda benar-benar mentok.

**Cara mengerjakan lab:**
1. Buka terminal di folder kursus. Belum punya foldernya? Buka halaman **Mulai di sini** di aplikasi (atau lihat bagian Quick Start di README): di sana ada perintah `git clone`, tautan ZIP, dan opsi GitHub Codespaces tanpa instalasi. Lalu:
   ```bash
   cd DECourse    # nama folder hasil clone atau ekstrak ZIP
   ```
2. Jalankan pengujian awal untuk melihat kegagalan yang diharapkan:
   ```bash
   pytest labs/mod-X-Y/test_lab.py -v
   # atau untuk lab berbasis bash:
   bash labs/mod-X-Y/verify.sh
   ```
3. Edit file implementasi yang diminta di petunjuk modul (misal `labs/mod-1-2/pipeline.py`).
4. Jalankan kembali pengujian sampai semua indikator tes berwarna **hijau (PASSED)**.
5. *Jika Anda buntu*: Intip implementasi di `labs/mod-X-Y/reference/`, pelajari mengapa polanya seperti itu, lalu tutup kembali dan tulis dengan pemahaman Anda sendiri.

### Langkah 3: Bedah Chaos Scenario
- Setiap modul menyertakan studi kasus kegagalan produksi nyata (*production failure*).
- Baca bagian **Gejala (Symptom)**, coba tebak penyebabnya sebelum membaca bagian **Akar Masalah (Root Cause)** dan **Solusi/Mitigasi (Mitigation)**.
- Ini adalah materi emas untuk menjawab pertanyaan wawancara kerja teknis bertipe: *"Ceritakan pengalaman ketika sistem data Anda mengalami kegagalan dan bagaimana Anda menanganinya."*

### Langkah 4: Kerjakan Kuis Evaluasi
- 8 sampai 10 pertanyaan skenario per modul.
- Ambang batas kelulusan adalah **80%** (minimal 7 dari 8 benar).
- Soal-soal tidak menguji hafalan sintaks, melainkan pemahaman konsep dan penalaran arsitektural.

---

## 2. Roadmap Pembelajaran: 4 Level Menuju Profesional

```
LEVEL 0: Fondasi Pemula (Minggu 1-7)
 ├── Modul 0.0: Python dari Nol (variabel, def, for, if, error, file, tes)
 ├── Modul 0.1: Lansekap Data Engineering (Batch vs Streaming, OLTP vs OLAP)
 ├── Modul 0.2: Terminal Linux Dasar, Git, dan Python Virtual Environments
 └── Modul 0.3: Relational Database & Fondasi SQL (SQLite & Postgres; fungsi, DDL, view)
      │
LEVEL 1: Core Engineering & Pemodelan Data (Minggu 8-25)
 ├── Modul 1.1: Shell Scripting Lanjutan, CLI Tools (jq, awk) & Docker Dasar
 ├── Modul 1.2: Production Python (Generators, Pydantic, Retry/Idempotency)
 ├── Modul 1.3: Advanced SQL, Window Functions, EXPLAIN & Dialek SQL
 ├── Modul 1.4: Dimensional Modeling (Star Schema, Fact/Dim, SCD Type 2)
 ├── Modul 1.5: pandas untuk Data Engineer (membersihkan, join, memori, Parquet)
 ├── Modul 1.6: Memasukkan Data (API, retry, pagination, checkpoint, schema drift)
 └── Modul 1.7: Di Luar SQL (key-value, dokumen, wide-column, graph; CAP, hashing)
      │
LEVEL 2: Modern Data Stack & Lakehouse (Minggu 26-40)
 ├── Modul 2.1: Format Kolumnar (Parquet), DuckDB & Polars Engine
 ├── Modul 2.2: Open Table Formats (Apache Iceberg & Delta Lake, ACID S3)
 ├── Modul 2.3: Data Transformation dengan dbt & Testing Framework
 ├── Modul 2.4: Orkestrasi Pipeline (Dagster & Airflow, Asset-Based DAG)
 ├── Modul 2.5: Kualitas Data, Data Contracts & Schema Evolution
 └── Modul 2.6: Cloud Data Warehouse (Snowflake, BigQuery, Redshift; partisi, biaya)
      │
LEVEL 3: Sistem Terdistribusi, Streaming, & AI Data (Minggu 41-58)
 ├── Modul 3.0: Dari Hadoop ke Spark (HDFS, MapReduce, YARN, Hive)
 ├── Modul 3.1: Apache Spark Internals (Shuffle, Memory Management, Skew Mitigation)
 ├── Modul 3.2: Event Streaming (Kafka: leader/ISR, Schema Registry, CDC Debezium)
 ├── Modul 3.3: Stream Processing Lanjutan (Event-Time, Watermarks, Tumbling/Sliding Windows)
 ├── Modul 3.4: Infrastruktur Cloud Terotomasi (Terraform) & FinOps (Cost Control)
 └── Modul 3.5: AI & Vector Data Engineering (pgvector, Semantic Search, RAG Pipeline)
      │
LEVEL 4: Capstone (Minggu 59-61)
 └── Modul 4.1: Pipeline Batch Nyata di Data Taksi NYC (kontrak + pemeriksa, Anda mengerjakan sendiri)
```

---

## 3. Fitur Pendukung Karir di DataForge

Selain kurikulum, aplikasi web lokal DataForge menyediakan 5 modul persiapan karir di bilah navigasi:

1. **SQL Sandbox (`#/playground`)**:
   - Engine SQLite berbasis WebAssembly yang berjalan langsung di browser tanpa instalasi database eksternal.
   - Dilengkapi dataset riil *KopiKu* dan tantangan interaktif berjenjang dengan auto-grader.
2. **Interview Simulator (`#/interview`)**:
   - Latihan wawancara terstruktur mencakup:
     - *System Design*: Desain ingestion pipeline 50 juta event/hari.
     - *Live SQL*: Soal analitik window functions dan self-joins.
     - *Incident Drill*: Skenario simulasi on-call darurat produksi.
3. **Portfolio Blueprints (`#/portfolio`)**:
   - 4 rancangan proyek capstone siap bangun lengkap dengan Architectural Decision Records (ADR) dan poin pembelaan wawancara (*interview defense notes*).
4. **ATS Resume Builder (`#/cv-builder`)**:
   - Generator resume berstandar format pencari kerja global dengan penilaian skor ATS berbasis kata kunci metrik rekayasa data.
5. **Remote Career Playbook (`#/remote-playbook`)**:
   - Panduan taktis menembus pasar kerja global: strategi pencarian lowongan remote US/Eropa, negosiasi gaji mata uang asing (USD/EUR), serta kiat komunikasi asinkron bahasa Inggris.
6. **Dashboard Kesiapan Kerja & Evaluasi Skill (`#/readiness`)**:
   - Laporan menyeluruh tingkat kesiapan karir real-time (0–100%) berdasarkan gabungan modul kurikulum, tantangan SQL yang diselesaikan, dan aset karir.
   - Evaluasi 6 domain kompetensi rekayasa data (SQL, Production Python, Lakehouse, dbt & Dagster, Distributed Streaming Spark/Kafka, Cloud Ops & AI).
   - Checklist kualifikasi pelamar kerja otomatis dan rencana aksi prioritas langkah berikutnya.
   - Fitur cetak / ekspor laporan resmi (PDF) untuk jejak progres belajar Anda.

---

## 4. Persiapan Lingkungan Belajar (Environment Setup)

### Menjalankan Platform Web
```bash
# Opsi 1 (Node.js):
npm start

# Opsi 2 (Python murni):
python3 app/server.js   # atau: python3 server.py
```
Buka browser di `http://localhost:3000`.

### Menyiapkan Lingkungan Python untuk Lab
Buat virtual environment terisolasi untuk mengerjakan lab:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
```

Setiap modul di folder `labs/` memiliki file `requirements.txt` masing-masing:
```bash
# Contoh untuk Modul 2.1 (DuckDB & Polars):
pip install -r labs/mod-2-1/requirements.txt
```

### Stack Docker Opsional (Untuk Level 2 & Level 3)
Beberapa lab lanjutan (seperti S3 di Modul 2.2 atau Kafka/CDC di Modul 3.2) memiliki opsi infrastruktur lokal menggunakan Docker Compose:
```bash
# Menyalakan SeaweedFS (S3 storage) untuk Lab 2.2:
docker compose up -d s3 s3-init

# Menyalakan Postgres & Redpanda (Kafka) untuk Lab 3.2:
docker compose up -d postgres redpanda connect redpanda-console
```
*(Catatan: Lab dasar dan unit test standar dirancang tetap dapat lulus tanpa Docker jika laptop Anda memiliki keterbatasan resource RAM).*

---

## 5. Rencana Jadwal Belajar yang Disarankan

| Jalur | Komitmen Waktu | Estimasi Durasi | Target Capaian |
|---|---|---|---|
| **Standar (Disarankan)** | 10–12 jam / minggu | ~36 minggu (9 bulan) | Penguasaan menyeluruh, menyelesaikan semua 24 lab, membangun 2 proyek portofolio penuh. |
| **Intensif (Fast-Track)** | 20–25 jam / minggu | ~18 minggu (4 bulan) | Fokus penuh, sekitar 1 modul per minggu. Butuh disiplin tinggi; jangan melewatkan lab dan kode bukti. |

### Aturan Emas Belajar:
1. **Jangan copy-paste membabi buta**: Ketik kode sendiri agar memori motorik tangan dan logika terbentuk.
2. **Urai pesan error**: Saat tes gagal, baca *traceback* secara perlahan. Belajar membaca pesan error adalah 70% dari pekerjaan harian seorang Data Engineer.
3. **Simpan progres di Git**: Buat repositori Git pribadi Anda sendiri dan commit setiap solusi lab yang berhasil Anda pecahkan. Ini bukti nyata portofolio belajar Anda.

Selamat belajar, dan selamat bertumbuh menjadi Data Engineer profesional!

