// Comprehensive Curriculum Data: Beginner, Intermediate, Advanced
// Built with First Principles, Production Reality Checks, Hands-on Labs, and Chaos Engineering Scenarios.

window.CURRICULUM_DATA = [
  {
    levelId: "zero",
    levelTitle: "Level 0: The Layman's Onboarding (Dari Nol Awam ke Mindset Engineer)",
    levelSubtitle: "Pahami analogi dunia nyata, mental model aliran data, setup komputer, dan fondasi database tanpa jargon membingungkan.",
    badge: "Start Here (Awam)",
    badgeColor: "blue",
    modules: [
      {
        id: "mod-0-1",
        number: "0.1",
        title: "Peta Dunia Data: Apa Sebenarnya Kerja Data Engineer?",
        duration: "1 Minggu",
        summary: "Pahami perbedaan nyata antara Data Engineer, Data Analyst, dan Data Scientist lewat analogi restoran, serta perjalanan data dari aplikasi ke dashboard.",
        whyTutorialsLie: "Tutorial langsung menyuruh Anda mengetik 'SELECT *' atau 'import pandas' tanpa menjelaskan MENGAPA profesi ini ada. Akibatnya, pemula bingung apa bedanya database biasa (Postgres) dengan Data Warehouse, dan kenapa data tidak bisa langsung ditarik dari aplikasi kasir.",
        concepts: [
          {
            title: "Analogi Restoran Cepat Saji (Membedakan Peran di Dunia Data)",
            content: "Bayangkan restoran burger:\n1. Software Engineer (Backend/Frontend) = Kasir & Pelayan. Tugasnya melayani pelanggan yang pesan burger di kasir secepat mungkin (aplikasi e-commerce, web, HP).\n2. Data Engineer = Truk Logistik, Gudang Pusat, dan Sistem Distribusi Rantai Pasok. Mengambil bahan mentah dari ratusan cabang, mencuci sayuran yang kotor, membekukan daging, dan memastikan pasokan tiba di dapur analitik tepat waktu setiap pagi tanpa membuat kasir kewalahan.\n3. Data Analyst = Konsultan Menu. Menganalisis laporan penjualan untuk memberi tahu manajer: 'Burger varian apa yang paling laku bulan ini?'.\n4. Data Scientist = Koki Riset & Inovasi (R&D). Menggunakan algoritma untuk memprediksi: 'Berapa banyak stok roti yang harus disiapkan saat hujan deras minggu depan?'."
          },
          {
            title: "Mengapa Database Biasa (OLTP) Tidak Boleh Dipakai Buat Laporan?",
            content: "Database aplikasi toko online Anda (seperti PostgreSQL/MySQL) didesain untuk transaksi cepat (OLTP - Online Transaction Processing), seperti 'Simpan 1 pesanan baru'. Jika Anda menjalankan query berat seperti 'Hitung total omset 3 tahun terakhir dari 50 juta transaksi' langsung di database kasir, database kasir akan hang/terkunci, dan pembeli lain tidak bisa bayar! Inilah alasan diciptakan Data Warehouse / Lakehouse (OLAP - Online Analytical Processing) yang terpisah."
          },
          {
            title: "Perjalanan Sebuah Data (Dari Layar HP sampai Laporan CEO)",
            content: "1. Event Source: User klik 'Beli' di aplikasi HP.\n2. Ingestion: Data pesanan dikirim lewat jaringan ke API.\n3. Processing/ETL: Data kotor (ada typo, format tanggal berbeda-beda) dibersihkan dan distandarisasi.\n4. Storage/Warehouse: Data disimpan di gudang data yang rapi dan terorganisir.\n5. Consumption: Data disajikan ke dashboard BI (Tableau, Metabase) atau model AI."
          }
        ],
        lab: {
          title: "Hands-on Lab: Melacak Aliran Data Nyata Sederhana",
          description: "Sebagai pemula, buatlah diagram alur data pertama Anda dan jalankan skrip Python mini yang mensimulasikan data transaksi masuk, membersihkan nama pelanggan yang hurufnya acak-acakan, dan menghitung total omset.",
          codeSnippet: `# mini_pipeline.py - Pipeline data pertamamu dalam 20 baris!
raw_transactions = [
    {"order_id": "ORD001", "customer": "  budi santoso  ", "amount": "150000", "status": "PAID"},
    {"order_id": "ORD002", "customer": "SITI AMINAH", "amount": "200000", "status": "PAID"},
    {"order_id": "ORD003", "customer": "anto", "amount": "invalid_number", "status": "FAILED"},
    {"order_id": "ORD004", "customer": "  budi santoso  ", "amount": "300000", "status": "PAID"}
]

clean_data = []
total_revenue = 0

for tx in raw_transactions:
    # 1. Filter: Hanya ambil transaksi yang sukses (PAID)
    if tx["status"] == "PAID":
        try:
            # 2. Transformasi: Bersihkan spasi dan ubah huruf jadi format Rapi (Title Case)
            clean_name = tx["customer"].strip().title()
            amount_numeric = int(tx["amount"])
            
            clean_data.append({"customer": clean_name, "amount": amount_numeric})
            total_revenue += amount_numeric
        except ValueError:
            print(f"Melewati data rusak: {tx}")

print(f"Transaksi Bersih: {clean_data}")
print(f"Total Omset Berhasil: Rp {total_revenue:,}")`,
          deliverables: [
            "Menjalankan skrip Python pertama tanpa error",
            "Memahami konsep dasar: Ekstraksi (raw) -> Transformasi (clean) -> Agregasi (total revenue)",
            "Melihat secara langsung bagaimana data kotor ('invalid_number') dapat ditangani dengan aman"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario Pemula: 'Database Toko Macet Karena Query Laporan'",
          scenario: "Seorang Data Analyst magang menjalankan query 'SELECT * FROM transactions' tanpa filter tanggal pada jam 12 siang saat promo kilat (Flash Sale). Server database kasir utama mendadak lambat 100x lipat dan ratusan pembeli gagal checkout.",
          breakageReason: "Menggabungkan beban analitik berat ke dalam database transaksional operasional yang sedang melayani user aktif.",
          fixGuide: "1. Segera batalkan (KILL) query analitik yang sedang berjalan di database utama.\n2. Buat Read-Replica terpisah yang khusus melayani pembacaan data tanpa membebani master.\n3. Bangun pipeline Data Engineering yang mengekstrak data berkala ke Data Warehouse/Lakehouse agar tim analitik tidak pernah menyentuh database operasional.",
          defensivePattern: "Prinsip Emas DE: Jangan pernah jalankan query analitik langsung di database produksi OLTP!"
        },
        quiz: [
          {
            question: "Apa perbedaan paling mendasar antara tanggung jawab Data Engineer dan Data Analyst?",
            options: [
              "Data Engineer membuat visualisasi grafik dashboard, sedangkan Data Analyst memperbaiki server.",
              "Data Engineer membangun pipa & fondasi infrastruktur agar data mengalir bersih dan andal, sedangkan Data Analyst menggunakan data tersebut untuk menjawab pertanyaan bisnis.",
              "Data Engineer hanya bekerja dengan Excel, sedangkan Data Analyst menggunakan Supercomputer.",
              "Tidak ada perbedaan sama sekali."
            ],
            correct: 1,
            explanation: "Data Engineer adalah arsitek dan tukang pipa (supply chain data), sedangkan Data Analyst adalah konsumen data yang menganalisis tren bisnis untuk membantu pengambilan keputusan manajemen."
          },
          {
            question: "Mengapa kita memisahkan database OLTP (transaksional) dengan Data Warehouse OLAP (analitikal)?",
            options: [
              "Supaya perusahaan bisa membeli lebih banyak lisensi software.",
              "Karena database OLTP dioptimalkan untuk baca/tulis satuan yang sangat cepat agar aplikasi tidak lemot, sedangkan OLAP dioptimalkan untuk memindai jutaan baris data sekaligus tanpa mengganggu user yang sedang belanja.",
              "Karena OLTP tidak bisa menyimpan angka.",
              "Karena OLAP tidak menggunakan listrik."
            ],
            correct: 1,
            explanation: "OLTP fokus pada kecepatan transaksi harian (Create, Read, Update, Delete per user), sedangkan OLAP fokus pada agregasi data berskala masif untuk analisis bisnis jangka panjang."
          }
        ]
      },
      {
        id: "mod-0-2",
        number: "0.2",
        title: "Setup Mesin Perang Pemula: Terminal, Python, & Git Tanpa Frustrasi",
        duration: "1-2 Minggu",
        summary: "Hilangkan rasa takut pada layar hitam terminal. Kuasai navigasi folder dasar, Python environment, dan cara menyimpan riwayat kode dengan Git.",
        whyTutorialsLie: "Tutorial sering menganggap pemula sudah paham istilah seperti 'cd ke direktori', 'tambahkan ke PATH', atau 'install dependencies'. Ketika muncul error kecil seperti 'command not found', pemula langsung merasa bodoh dan menyerah.",
        concepts: [
          {
            title: "Mengapa Engineer Memakai Terminal Hitam daripada Mouse?",
            content: "Mouse sangat bagus untuk manusia browsing, tapi sangat lambat untuk otomatisasi. Di server cloud tanpa monitor (headless), Anda tidak punya tombol klik atau ikon desktop. Semua instruksi diberikan lewat teks terminal. Menguasai 5 perintah dasar terminal (`pwd`, `ls`, `cd`, `mkdir`, `cat`) sudah membuka 80% kemampuan navigasi sistem operasi."
          },
          {
            title: "Python Virtual Environment (Kenapa Kamar Belajar Harus Rapi)",
            content: "Jika Anda menginstall semua library langsung di laptop utama, versi library proyek A bisa bentrok dengan proyek B dan merusak sistem laptop Anda. Konsep Virtual Environment (`venv`) ibarat membuat ruangan tertutup khusus untuk proyek Anda, sehingga instalasi paket tidak mencemari laptop."
          },
          {
            title: "Git: Mesin Waktu Bagi Programmer",
            content: "Pernahkah Anda menyimpan file: `laporan_final.docx`, `laporan_final_revisi.docx`, `laporan_final_revisi_fix_bismillah.docx`? Git memecahkan masalah ini dengan elegan. Git adalah mesin waktu yang mencatat setiap jengkal perubahan kode Anda (`git commit`) sehingga Anda bisa kembali ke masa lalu jika kode rusak."
          }
        ],
        lab: {
          title: "Hands-on Lab: Misi Pertama Terminal dan Lingkungan Python",
          description: "Buka terminal Anda, buat folder proyek baru menggunakan command line, siapkan lingkungan Python virtual (`venv`), dan jalankan program pembaca file otomatis.",
          codeSnippet: `# Jalankan perintah ini di Terminal Linux / Mac / WSL:

# 1. Cek di mana Anda berada saat ini
pwd

# 2. Buat folder belajar baru
mkdir -p ~/belajar-de/latihan-1
cd ~/belajar-de/latihan-1

# 3. Buat Python Virtual Environment
python3 -m venv venv

# 4. Aktifkan Virtual Environment
source venv/bin/activate
# (Tanda (venv) akan muncul di kiri baris terminal Anda)

# 5. Cek versi python di dalam venv
python --version

# Selamat! Ruang kerja terisolasi Anda sudah aktif sempurna.`,
          deliverables: [
            "Mampu membuka terminal dan menavigasi folder tanpa bantuan mouse",
            "Mampu membuat dan mengaktifkan Python virtual environment (`source venv/bin/activate`)",
            "Memahami cara keluar dari virtual environment (`deactivate`)"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario Pemula: 'ModuleNotFoundError & Command Not Found'",
          scenario: "Anda menulis skrip yang menggunakan library tertentu, tapi saat dijalankan muncul pesan merah: `ModuleNotFoundError: No module named 'requests'`. Anda panik mengira laptop Anda rusak.",
          breakageReason: "Library belum diinstall di virtual environment aktif, atau Anda menjalankan script di luar virtual environment yang memiliki dependensi tersebut.",
          fixGuide: "1. Cek apakah tanda `(venv)` sudah menyala di terminal Anda. Jika belum, jalankan `source venv/bin/activate`.\n2. Jalankan `pip install requests` untuk mengunduh library ke dalam lingkungan tersebut.\n3. Jalankan kembali script Anda dengan `python main.py`.",
          defensivePattern: "Selalu pastikan virtual environment aktif sebelum menginstall library atau menjalankan skrip."
        },
        quiz: [
          {
            question: "Perintah terminal apa yang digunakan untuk melihat daftar isi file dan folder di direktori saat ini?",
            options: [
              "`ls` (pada Linux/Mac) atau `dir` (pada Windows)",
              "`pwd`",
              "`cd`",
              "`exit`"
            ],
            correct: 0,
            explanation: "`ls` (list) menampilkan seluruh file dan folder di lokasi Anda saat ini, sedangkan `pwd` (print working directory) memberi tahu lokasi path Anda saat ini."
          },
          {
            question: "Mengapa kita sangat dianjurkan menggunakan Python Virtual Environment (`venv`)?",
            options: [
              "Supaya laptop berjalan 100x lebih cepat.",
              "Untuk mengisolasi paket dan dependensi antar proyek agar tidak saling bentrok atau merusak konfigurasi sistem laptop.",
              "Agar tidak perlu membayar internet.",
              "Karena Python tidak bisa berjalan tanpa venv."
            ],
            correct: 1,
            explanation: "Virtual Environment mengisolasi pustaka proyek sehingga upgrade library di satu proyek tidak akan mematahkan proyek lama lainnya di komputer Anda."
          }
        ]
      },
      {
        id: "mod-0-3",
        number: "0.3",
        title: "Database & SQL 101: Mengapa Excel Gagal di Data Besar",
        duration: "2 Minggu",
        summary: "Pahami batasan Excel, anatomi tabel database (Baris, Kolom, Primary Key, Foreign Key), dan kuasai query SQL dasar (SELECT, WHERE, GROUP BY, JOIN) dengan visualisasi mudah.",
        whyTutorialsLie: "Banyak tutorial mengajarkan SQL seperti menghafal rumus matematika abstrak. Di dunia nyata, SQL adalah bahasa percakapan manusia dengan database untuk menanyakan pertanyaan bisnis logis.",
        concepts: [
          {
            title: "Mengapa Excel Gagal Ketika Data Membesar?",
            content: "1. Batas Baris Keras: Excel hanya mampu menampung 1.048.576 baris. Bisnis menengah saja bisa menghasilkan jutaan transaksi per bulan!\n2. Memory Crash: Membuka file Excel 500 MB membuat laptop hang dan kipas berbunyi kencang.\n3. Integritas Data Lemah: Di Excel, seseorang bisa tidak sengaja mengetik huruf di kolom harga, atau menghapus formula tanpa sadar.\nDatabase dirancang untuk mengelola miliaran baris dengan aman, cepat, dan dengan aturan tipe data yang ketat."
          },
          {
            title: "Anatomi Tabel Relasional (Seperti KTP dan Akta Nikah)",
            content: "- Baris (Row / Record): Satu entitas nyata (misal: 1 orang pelanggan bernama Budi).\n- Kolom (Column / Field): Atribut dari entitas tersebut (Nama, Email, Kota, Saldo).\n- Primary Key (PK): Seperti Nomor Induk Kependudukan (NIK/KTP). Nilai unik yang tidak boleh kembar dan tidak boleh kosong, penanda sah satu baris.\n- Foreign Key (FK): Nomor NIK yang dipinjam di tabel lain untuk menghubungkan relasi (misal di tabel Pesanan ada kolom `customer_id` untuk tahu siapa yang beli)."
          },
          {
            title: "Peta Logika SQL: Bahasa Bertanya ke Database",
            content: "- `SELECT`: Kolom apa yang ingin kamu lihat?\n- `FROM`: Dari lemari/tabel mana data itu diambil?\n- `WHERE`: Filter atau syarat apa yang harus dipenuhi? (misal hanya yang belanja > Rp 100.000)\n- `GROUP BY`: Bagaimana kamu ingin mengelompokkan data? (misal total belanja per kota)\n- `ORDER BY`: Urutkan dari yang terbesar atau terkecil?\n- `JOIN`: Gabungkan dua lemari/tabel yang memiliki kunci penghubung yang sama!"
          }
        ],
        lab: {
          title: "Hands-on Lab: Menulis 4 Query SQL Bisnis Pertama Anda",
          description: "Gunakan in-browser SQL playground bawaan DataForge untuk menulis query SQL pertama Anda terhadap database toko e-commerce.",
          codeSnippet: `-- 1. Menampilkan semua pelanggan dari kota Jakarta
SELECT name, email, tier 
FROM customers 
WHERE city = 'Jakarta';

-- 2. Menghitung total omset toko dari pesanan yang sukses
SELECT 
    SUM(amount) AS total_omset_usd,
    COUNT(*) AS jumlah_transaksi
FROM orders 
WHERE status = 'COMPLETED';

-- 3. Menggabungkan tabel Customers dan Orders (JOIN) untuk melihat siapa yang belanja paling banyak
SELECT 
    c.name,
    c.tier,
    COUNT(o.order_id) AS total_pesanan,
    SUM(o.amount) AS total_pengeluaran
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.name, c.tier
ORDER BY total_pengeluaran DESC;`,
          deliverables: [
            "Menulis query SELECT dan WHERE tanpa typo sintaks",
            "Memahami cara kerja agregasi SUM() dan COUNT() bersama GROUP BY",
            "Melihat secara langsung hasil INNER JOIN antara dua tabel yang berhubungan"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario Pemula: 'Nilai NULL Misterius yang Merusak Perhitungan Rata-rata'",
          scenario: "Seorang manajer meminta laporan 'Berapa rata-rata diskon yang diberikan bulan ini?'. Anda menjalankan `AVG(discount)`. Ternyata banyak pelanggan tidak mendapat diskon sehingga nilainya `NULL` (bukan 0). Database mengabaikan nilai NULL sehingga angka rata-rata diskon menjadi terlalu tinggi dan menyesatkan keputusan bisnis!",
          breakageReason: "Dalam SQL, `NULL` berarti 'tidak diketahui / ketiadaan nilai', bukan angka nol (`0`). Fungsi agregasi seperti `AVG()` mengabaikan baris NULL, bukan menghitungnya sebagai 0.",
          fixGuide: "1. Kenali sifat NULL: NULL bukan spasi kosong dan bukan angka 0.\n2. Gunakan fungsi `COALESCE(discount, 0)` untuk mengubah nilai NULL menjadi angka 0 sebelum dihitung.\n3. Jalankan `AVG(COALESCE(discount, 0))` untuk mendapatkan nilai rata-rata yang benar secara akuntansi bisnis.",
          defensivePattern: "Selalu waspada terhadap nilai NULL dalam perhitungan numerik. Gunakan COALESCE untuk menetapkan nilai default yang aman."
        },
        quiz: [
          {
            question: "Apa arti dari nilai `NULL` di dalam database SQL?",
            options: [
              "Angka nol (`0`).",
              "Teks kosong (`''`).",
              "Ketiadaan nilai atau nilai yang tidak diketahui (unknown/missing value).",
              "Sebuah pesan error."
            ],
            correct: 2,
            explanation: "`NULL` merepresentasikan nilai yang tidak ada atau tidak diketahui. Ia tidak sama dengan angka 0 atau string kosong."
          },
          {
            question: "Kapan kita menggunakan `INNER JOIN` dibandingkan `LEFT JOIN`?",
            options: [
              "`INNER JOIN` hanya mengembalikan baris yang memiliki kecocokan di kedua tabel, sedangkan `LEFT JOIN` mengembalikan SEMUA baris dari tabel kiri meskipun tidak ada pasangannya di tabel kanan.",
              "`INNER JOIN` hanya untuk tabel kecil.",
              "`LEFT JOIN` mengubah data menjadi huruf kecil.",
              "Keduanya memiliki hasil yang sama persis."
            ],
            correct: 0,
            explanation: "`INNER JOIN` hanya menampilkan data yang berpasangan di kedua tabel. `LEFT JOIN` mempertahankan semua baris dari tabel utama (kiri) dan mengisi `NULL` jika tidak ada pasangan di tabel kanan."
          }
        ]
      }
    ]
  },
  {
    levelId: "beginner",
    levelTitle: "Level 1: Foundations (The Software Engineering Mindset)",
    levelSubtitle: "Stop writing brittle notebooks. Learn Linux, production Python, advanced SQL, and dimensional modeling.",
    badge: "Foundations",
    badgeColor: "emerald",
    modules: [
      {
        id: "mod-1-1",
        number: "1.1",
        title: "Linux, Shell Scripting & Docker for Data Engineers",
        duration: "2-3 Weeks",
        summary: "Master pipes, streams, log processing with awk/sed/jq, and containerize data workflows with Docker.",
        whyTutorialsLie: "Tutorials run everything in a local terminal where permissions are root, files are 10MB, and scripts never crash. In production, your pipeline runs in a minimal Alpine/Debian container with 512MB RAM, processes 20GB of malformed syslog files, and dies with exit code 137 if memory isn't managed.",
        concepts: [
          {
            title: "Standard Streams & Non-Blocking Pipes",
            content: "Understanding stdin (0), stdout (1), stderr (2). Why pipeline commands `cat file | grep | awk` can stream gigabytes of data through memory without saving to disk, utilizing Linux pipe buffers (typically 64KB)."
          },
          {
            title: "High-Performance Text Wrangling (awk, sed, jq)",
            content: "Processing gigabyte-scale JSON and CSV logs without booting Python. Using `jq` for streaming JSON filtering (`jq -c '.user | select(.active == true)'`), and `awk` for columnar aggregations in milliseconds."
          },
          {
            title: "Production Docker & Multi-Stage Builds",
            content: "Writing lean Dockerfiles for data jobs. Understanding layer caching, non-root user security, bind mounts vs volumes, and container health checks for orchestrators."
          }
        ],
        lab: {
          title: "Hands-on Lab: Containerized High-Throughput Log Ingestion Engine",
          description: "Build a containerized pipeline that monitors an incoming directory of gzipped web server logs, streams and unzips them, parses structured JSON metrics via bash and jq, and outputs normalized CSV records ready for database copy.",
          codeSnippet: `#!/usr/bin/env bash
# ingest_logs.sh - Resilient streaming log processor
set -euo pipefail

INPUT_DIR="\${1:-/data/incoming}"
OUTPUT_FILE="\${2:-/data/processed/metrics_\$(date +%Y%m%d).csv}"

echo "timestamp,ip_address,endpoint,status_code,response_time_ms" > "$OUTPUT_FILE"

# Process all .gz logs using streaming pipe without writing intermediate uncompressed files to disk
find "$INPUT_DIR" -name "*.log.gz" -print0 | while IFS= read -r -d '' file; do
    echo "Processing $file..."
    zcat "$file" | jq -r -c 'select(.status >= 200) | [.timestamp, .client_ip, .request_path, .status, .duration_ms] | @csv' >> "$OUTPUT_FILE"
done

echo "Ingestion completed successfully: $(wc -l < "$OUTPUT_FILE") rows generated."`,
          deliverables: [
            "Dockerfile using python:3.12-slim with jq and curl installed",
            "Bash script with strict error handling (`set -euo pipefail`)",
            "Docker Compose mounting `/data/incoming` and `/data/processed`",
            "Zero intermediate disk footprint during decompression"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Multi-Line Log Explosion & Disk Exhaustion",
          scenario: "An upstream microservice was upgraded to Java Spring Boot and began writing multi-line stack traces directly into the JSON log file. Your downstream jq parser crashes with `parse error: Invalid numeric literal` and the container's scratch disk fills to 100%, causing cascading pod restarts.",
          breakageReason: "The ingestion script assumed strictly single-line JSON (`ndjson`). Multi-line stack traces broken across newlines violate the ndjson spec, causing `jq -c` to fail and accumulate temporary uncompressed buffer files on disk.",
          fixGuide: "1. Implement a pre-filtering stream buffer using `awk` to fold multi-line stack traces or discard malformed lines.\n2. Wrap parsing in a subshell with a quarantine Dead-Letter Queue (`DLQ`) for malformed lines (`grep -v '^{' malformed.log >> /quarantine/corrupt.log`).\n3. Add a trap handler (`trap 'cleanup' EXIT INT TERM`) to guarantee temporary files are wiped even if the script aborts.",
          defensivePattern: "Never assume structured logs are 100% compliant. Always separate valid records from quarantine streams with zero pipeline stoppage."
        },
        quiz: [
          {
            question: "Why is `set -euo pipefail` critical at the beginning of bash data pipeline scripts?",
            options: [
              "It enables multi-threading in bash subshells.",
              "It ensures the script exits if any command fails, if an unset variable is accessed, or if any command in a pipe fails.",
              "It compresses the output stream automatically.",
              "It grants the script root privileges."
            ],
            correct: 1,
            explanation: "`set -e` exits on error, `set -u` treats unset variables as errors, and `set -o pipefail` ensures a pipeline returns the exit code of the last failing command rather than the final command."
          },
          {
            question: "What happens if a containerized data job running in Kubernetes or ECS exceeds its memory limit?",
            options: [
              "The Linux kernel terminates it with SIGKILL (Exit code 137: OOMKilled).",
              "The container automatically pages data to host swap space.",
              "The job slows down but continues executing.",
              "A Python exception is always thrown."
            ],
            correct: 0,
            explanation: "When memory limit is reached and swap is disabled, the Linux cgroup OOM killer sends SIGKILL (137) immediately without warning or Python stack traces."
          }
        ]
      },
      {
        id: "mod-1-2",
        number: "1.2",
        title: "Production Python for Data Engineering",
        duration: "3 Weeks",
        summary: "Write memory-efficient streaming generators, enforce schemas with Pydantic v2, and build automated pytest test suites.",
        whyTutorialsLie: "Bootcamps teach `import pandas as pd; df = pd.read_csv('100mb_file.csv')`. But in production, you have a 40GB daily event dump and a worker node with 2GB RAM. Pandas consumes 4-6x the file size in memory and immediately crashes your pipeline.",
        concepts: [
          {
            title: "Memory-Efficient Streaming with Generators",
            content: "Using Python's `yield` and `itertools` to process millions of records one row or batch at a time with $O(1)$ constant memory overhead instead of loading whole collections."
          },
          {
            title: "Data Contracts & Schema Validation with Pydantic v2",
            content: "Using Pydantic v2 (Rust-backed) to validate records at the boundary of your pipeline. Parsing raw JSON into typed models with field validators, coercive conversions, and error reporting."
          },
          {
            title: "Automated Unit & Integration Testing with pytest",
            content: "Testing data transformations like real software. Using pytest fixtures, parameterization, mock HTTP responses, and in-memory DuckDB/SQLite databases to test pipeline logic without network dependencies."
          }
        ],
        lab: {
          title: "Hands-on Lab: Resilient Stream Ingestion Pipeline with Schema Contracts",
          description: "Build a Python ETL pipeline that streams records from a simulated third-party webhook API, validates each record against a strict Pydantic model, sends valid records to a target sink, and routes invalid records to a quarantine dead-letter file with error diagnostics.",
          codeSnippet: `from typing import Iterator, Dict, Any, Tuple
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import json

class OrderEvent(BaseModel):
    order_id: str = Field(..., min_length=5)
    customer_id: str
    amount: float = Field(..., gt=0.0)
    currency: str = Field(default="USD")
    created_at: datetime

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        valid_currencies = {"USD", "EUR", "GBP", "IDR"}
        if v.upper() not in valid_currencies:
            raise ValueError(f"Unsupported currency: {v}")
        return v.upper()

def process_event_stream(raw_stream: Iterator[str]) -> Iterator[Tuple[bool, Dict[str, Any]]]:
    """Processes raw JSON lines with O(1) memory overhead and strict validation."""
    for line in raw_stream:
        try:
            payload = json.loads(line)
            event = OrderEvent(**payload)
            yield (True, event.model_dump())
        except Exception as e:
            yield (False, {"raw_payload": line.strip(), "error": str(e), "timestamp": datetime.utcnow().isoformat()})`,
          deliverables: [
            "Pydantic v2 schema with custom validators and sanitization",
            "Generator-based pipeline consuming files in chunks",
            "Dead-Letter Queue (DLQ) file handler for corrupt rows",
            "Full pytest test suite covering valid, boundary, and corrupt data"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Upstream Type Mutation & Silent NaN Corruption",
          scenario: "The upstream payment provider unexpectedly sends `amount` as formatted strings with currency symbols (e.g., `\"$1,450.00\"`) and occasional string `\"null\"` values. An unvalidated pipeline either crashes with `ValueError: could not convert string to float` or silently loads `NaN`, corrupting daily revenue calculations by $250,000.",
          breakageReason: "Lack of defensive type coercion and absence of schema contracts at the ingestion boundary.",
          fixGuide: "1. Add a `@field_validator('amount', mode='before')` in Pydantic to strip currency symbols and commas before parsing.\n2. Reject explicit string `\"null\"` values by raising a validation error.\n3. Assert in your pytest suite that malformed formats are correctly normalized or routed to DLQ without corrupting downstream aggregations.",
          defensivePattern: "Parse at the gate. Never let unvalidated external data enter your internal data marts."
        },
        quiz: [
          {
            question: "Why does a Python generator function using `yield` consume significantly less memory than a function returning a list?",
            options: [
              "Generators compile Python code to C.",
              "Generators evaluate items lazily on demand, storing only one item in memory at a time.",
              "Generators compress each row using gzip in memory.",
              "Generators bypass the Python Global Interpreter Lock (GIL)."
            ],
            correct: 1,
            explanation: "Generators use lazy evaluation, returning one item at a time via `yield` and pausing execution until the next item is requested, keeping memory consumption constant $O(1)$ regardless of dataset size."
          },
          {
            question: "In automated testing for data pipelines, what is the best practice for testing database interactions?",
            options: [
              "Always run tests against the live production database to ensure real-world accuracy.",
              "Skip database tests because SQL cannot be tested automatically.",
              "Use an ephemeral in-memory database (like DuckDB or SQLite) or a disposable test container with mock seed data.",
              "Only test syntax using regex."
            ],
            correct: 2,
            explanation: "Using disposable in-memory engines (like DuckDB) or test containers ensures fast, isolated, deterministic tests that can run in any CI/CD runner without external state or credentials."
          }
        ]
      },
      {
        id: "mod-1-3",
        number: "1.3",
        title: "Advanced SQL Mastery & Execution Plans",
        duration: "3 Weeks",
        summary: "Master window functions, recursive CTEs, query profiling with EXPLAIN ANALYZE, and index tuning.",
        whyTutorialsLie: "Tutorials teach `SELECT * FROM table WHERE id = 1` or basic `GROUP BY`. But real senior interviews and production systems test Gaps & Islands, multi-day retention rollups, and why a query that worked on 10,000 rows times out on 100,000,000 rows due to a nested loop join on an unindexed column.",
        concepts: [
          {
            title: "Advanced Window Functions & Frame Specifications",
            content: "Deep mastery of `ROWS BETWEEN ... AND ...`, `RANGE BETWEEN`, cumulative sums, moving averages, and ranking functions (`DENSE_RANK`, `ROW_NUMBER`, `NTILE`)."
          },
          {
            title: "Gaps & Islands and Sessionization",
            content: "Solving classic data engineering problems: finding contiguous streaks of activity, detecting missing sequence IDs in audit logs, and sessionizing event streams using window difference techniques."
          },
          {
            title: "Query Profiling with EXPLAIN ANALYZE",
            content: "Understanding query execution plans: Sequential Scan vs Index Scan vs Bitmap Index Scan, Nested Loop vs Hash Join vs Merge Join. Identifying bottlenecks where estimated rows diverge from actual rows."
          }
        ],
        lab: {
          title: "Hands-on Lab: Query Optimization & Real-Time Sessionization Engine",
          description: "Given a 5-million row clickstream table, write an optimized SQL query that partitions clicks by user, identifies session boundaries (inactivity > 30 minutes), generates unique session IDs, and aggregates session duration and conversion metrics.",
          codeSnippet: `-- Sessionization with 30-minute inactivity threshold
WITH lagged_events AS (
    SELECT
        user_id,
        event_time,
        event_type,
        LAG(event_time) OVER (
            PARTITION BY user_id
            ORDER BY event_time
        ) AS prev_event_time
    FROM user_clickstream
),
session_flags AS (
    SELECT
        user_id,
        event_time,
        event_type,
        CASE
            WHEN prev_event_time IS NULL THEN 1
            WHEN EXTRACT(EPOCH FROM (event_time - prev_event_time)) > 1800 THEN 1
            ELSE 0
        END AS is_new_session
    FROM lagged_events
),
session_grouped AS (
    SELECT
        user_id,
        event_time,
        event_type,
        SUM(is_new_session) OVER (
            PARTITION BY user_id
            ORDER BY event_time
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS session_id
    FROM session_flags
)
SELECT
    user_id,
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(*) AS total_clicks,
    ROUND(EXTRACT(EPOCH FROM (MAX(event_time) - MIN(event_time)))::numeric / 60, 2) AS duration_minutes
FROM session_grouped
GROUP BY user_id, session_id;`,
          deliverables: [
            "Optimized sessionization SQL query using window functions",
            "Gaps and Islands solution detecting missing transactional invoice IDs",
            "Execution plan comparison before and after indexing strategies",
            "Demonstrated reduction in buffer reads from 1.2M to 4,500"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Cartesian Explosion & Dreaded Out-of-Disk Spill",
          scenario: "An analyst writes a query joining a transaction table to a promotions table on `promotions.start_date <= transactions.txn_date AND promotions.end_date >= transactions.txn_date`. As the table grows to 50M rows, the query runs for 4 hours, spills 80GB of temp files to disk, and crashes the database server.",
          breakageReason: "Non-equi joins cannot use Hash Joins or Merge Joins without indexes; the database falls back to Nested Loop joins or Cartesian cross products, causing $O(N \\times M)$ complexity.",
          fixGuide: "1. Inspect the execution plan with `EXPLAIN (ANALYZE, BUFFERS)` to spot the nested loop.\n2. Replace broad non-equi joins with range partitioning or pre-bucketed date intervals.\n3. Create composite BRIN or B-Tree indexes on `(start_date, end_date)` to allow index range scans.\n4. Increase `work_mem` cautiously only for the specific session, not globally.",
          defensivePattern: "Always check `EXPLAIN ANALYZE` for row estimation errors and nested loops on tables with $>100k$ rows."
        },
        quiz: [
          {
            question: "What is the difference between `ROWS BETWEEN 1 PRECEDING AND CURRENT ROW` and `RANGE BETWEEN 1 PRECEDING AND CURRENT ROW`?",
            options: [
              "There is no difference; they are aliases.",
              "`ROWS` considers physical row offset counts, while `RANGE` considers the logical values of the `ORDER BY` expression.",
              "`RANGE` can only be used with date types, while `ROWS` only works with integers.",
              "`ROWS` executes in memory, while `RANGE` executes on disk."
            ],
            correct: 1,
            explanation: "`ROWS` looks at a fixed physical count of preceding rows, whereas `RANGE` looks at the value delta based on the ordered column (e.g., all rows whose timestamp falls within 1 day, including peer duplicates)."
          },
          {
            question: "When is a BRIN (Block Range Index) preferred over a B-Tree index in PostgreSQL or analytical databases?",
            options: [
              "When querying highly randomized UUIDs.",
              "When indexing small tables with fewer than 100 rows.",
              "When indexing very large, append-only tables where data is naturally physically sorted on disk (like transaction timestamps).",
              "When foreign key constraints are needed."
            ],
            correct: 2,
            explanation: "BRIN indexes store min/max values for ranges of physical disk pages. On massive tables sorted naturally by time, BRIN takes $<1\%$ of the disk space of a B-Tree index while providing fast range pruning."
          }
        ]
      },
      {
        id: "mod-1-4",
        number: "1.4",
        title: "Dimensional Data Modeling & Modern Schemas",
        duration: "3 Weeks",
        summary: "Master Kimball Star Schemas, Facts vs Dimensions, SCD Types 1-6, and the modern debate: Star Schema vs One Big Table (OBT).",
        whyTutorialsLie: "Many modern tutorials claim: 'Dimensional modeling is dead, just dump everything into One Big Table (OBT) in Snowflake or BigQuery!' But in real companies, pure OBT leads to duplicate data, massive update costs, broken single-source-of-truth, and astronomical cloud storage costs. Senior engineers know exactly when to use Star Schema and when to use OBT.",
        concepts: [
          {
            title: "Kimball Dimensional Modeling Core Architecture",
            content: "Fact Tables (Transaction, Periodic Snapshot, Accumulating Snapshot) and Dimension Tables (Conformed, Role-Playing, Junk, Degenerate). The Enterprise Data Bus Matrix."
          },
          {
            title: "Slowly Changing Dimensions (SCD Type 1, 2, 3, 4, 6)",
            content: "Managing historical attribute changes over time. Deep dive into SCD Type 2 with `valid_from`, `valid_to`, and `is_current` flags, and atomic upsert merge logic."
          },
          {
            title: "The Modern Debate: Star Schema vs One Big Table (OBT)",
            content: "Understanding columnar storage compression (Parquet, ORC, Snowflake micro-partitions) and how it affects joins vs denormalization trade-offs. Why Star Schema remains king for governance, while OBT is used in final reporting marts."
          }
        ],
        lab: {
          title: "Hands-on Lab: Enterprise E-Commerce Star Schema & SCD-2 Pipeline",
          description: "Design a production-grade Star Schema for an e-commerce platform with customer dimensions, product dimensions, and order line fact tables. Write an idempotent SQL merge script that handles customer address changes via SCD Type 2.",
          codeSnippet: `-- SCD Type 2 Idempotent Upsert for Dim_Customer
-- Step 1: Expire old records where attributes changed
UPDATE dim_customer
SET
    valid_to = staging.updated_at,
    is_current = FALSE
FROM staging_customer staging
WHERE dim_customer.customer_id = staging.customer_id
  AND dim_customer.is_current = TRUE
  AND (
      dim_customer.email <> staging.email
      OR dim_customer.address <> staging.address
      OR dim_customer.tier <> staging.tier
  );

-- Step 2: Insert new version for changed and newly created records
INSERT INTO dim_customer (
    customer_id,
    first_name,
    last_name,
    email,
    address,
    tier,
    valid_from,
    valid_to,
    is_current
)
SELECT
    staging.customer_id,
    staging.first_name,
    staging.last_name,
    staging.email,
    staging.address,
    staging.tier,
    staging.updated_at AS valid_from,
    '9999-12-31 23:59:59'::timestamp AS valid_to,
    TRUE AS is_current
FROM staging_customer staging
LEFT JOIN dim_customer current_dim
    ON staging.customer_id = current_dim.customer_id
   AND current_dim.is_current = TRUE
WHERE current_dim.customer_id IS NULL;`,
          deliverables: [
            "Kimball Enterprise Bus Matrix mapping 4 business processes",
            "DDL for Fact and Dimension tables with surrogate keys",
            "Idempotent SCD Type 2 ETL script with zero duplicate active records",
            "Analytical query comparing monthly revenue by customer tier at the time of purchase"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Out-of-Order Dimension Event Race Condition",
          scenario: "An event stream updates a customer's address at 10:02 AM, but due to network jitter, the update with timestamp 10:00 AM arrives at 10:05 AM. The naive SCD-2 pipeline expires the 10:02 record and marks the older 10:00 record as current, corrupting customer delivery addresses across downstream systems.",
          breakageReason: "The pipeline assumed events arrive in strict chronological order and used pipeline ingestion time instead of source event time for valid intervals.",
          fixGuide: "1. Enforce ordering by source event timestamp (`event_timestamp`), not ingestion timestamp.\n2. In the SCD-2 logic, ensure `valid_to` is calculated strictly by the next chronological event timestamp using window function `LEAD(event_timestamp)`.\n3. Reject or quarantine updates whose event timestamp is older than the current active record unless running an explicit historical backfill.",
          defensivePattern: "Event time always trumps arrival time. Never build historical dimensions relying on queue arrival sequence."
        },
        quiz: [
          {
            question: "In Kimball dimensional modeling, what is an 'Accumulating Snapshot' fact table best used for?",
            options: [
              "Logging every single transaction click as it occurs.",
              "Tracking a predictable business process with distinct milestone states from start to completion (e.g., order placed, approved, shipped, delivered).",
              "Storing snapshot balances at the end of each month.",
              "Storing user profile changes."
            ],
            correct: 1,
            explanation: "Accumulating snapshot fact tables model processes with defined milestones, where a single row is updated as each milestone date occurs (e.g., order lifecycle)."
          },
          {
            question: "Why should surrogate keys (integer or synthetic hash) be used instead of natural business keys (like email or username) in dimension tables?",
            options: [
              "Because databases do not support string primary keys.",
              "To isolate the data warehouse from changes in source operational keys and to enable SCD-2 historical tracking where one natural key has multiple versions.",
              "To make queries run in memory without disk access.",
              "To automatically encrypt sensitive data."
            ],
            correct: 1,
            explanation: "Surrogate keys allow the data warehouse to track multiple chronological versions of the same natural key (SCD-2) and insulate downstream marts from upstream source key mutations or reassignments."
          }
        ]
      }
    ]
  },
  {
    levelId: "intermediate",
    levelTitle: "Level 2: The Modern Lakehouse & Transformation",
    levelSubtitle: "Build local-first lakehouses with Apache Iceberg, DuckDB, dbt Core, Dagster, and Data Contracts.",
    badge: "Lakehouse & Ops",
    badgeColor: "amber",
    modules: [
      {
        id: "mod-2-1",
        number: "2.1",
        title: "Columnar Compute, DuckDB & Polars",
        duration: "2 Weeks",
        summary: "Understand vectorized execution, in-memory Apache Arrow, and run petabyte-scale analytics locally with DuckDB and Polars.",
        whyTutorialsLie: "Tutorials make you spin up expensive AWS EMR clusters or cloud warehouses for 15GB datasets. In 2026, top data engineers use DuckDB and Polars on single nodes to execute complex transformations in seconds with zero cloud infrastructure bills.",
        concepts: [
          {
            title: "Row-Oriented vs Columnar Storage (Parquet, Arrow)",
            content: "Why columnar formats achieve 10-50x compression ratios via Dictionary Encoding, Bit Packing, and Run-Length Encoding (RLE). How column projection and predicate pushdown avoid reading 90% of file bytes."
          },
          {
            title: "Vectorized Query Execution & DuckDB",
            content: "How DuckDB processes data in vectors of 2,048 tuples using SIMD CPU instructions. Querying remote S3 Parquet files directly over HTTP without downloading the whole file."
          },
          {
            title: "Polars: High-Performance Dataframes in Rust",
            content: "Why Polars outperforms Pandas by 20x: Rust memory safety, multithreaded query planner, lazy evaluation (`lazy()`), and streaming mode for datasets larger than available RAM."
          }
        ],
        lab: {
          title: "Hands-on Lab: Laptop-Scale Analytical Engine on 20 Million Records",
          description: "Use DuckDB and Polars to query a 20-million row dataset (Taxi/E-Commerce) directly from compressed Parquet files, compute multi-metric aggregations, and export summary marts in under 3 seconds using less than 400MB RAM.",
          codeSnippet: `import duckdb
import polars as pl
import time

# DuckDB reading Parquet with predicate pushdown and direct Iceberg/S3 capability
con = duckdb.connect(database=':memory:')

query = """
SELECT 
    vendor_id,
    DATE_TRUNC('month', pickup_datetime) AS pickup_month,
    COUNT(*) AS total_trips,
    ROUND(AVG(trip_distance), 2) AS avg_distance,
    ROUND(SUM(total_amount), 2) AS total_revenue,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY tip_amount) AS p95_tip
FROM read_parquet('data/yellow_tripdata_*.parquet')
WHERE passenger_count > 0 
  AND total_amount BETWEEN 2.5 AND 1000.0
GROUP BY 1, 2
ORDER BY 2 DESC, 5 DESC;
"""

start = time.perf_counter()
result_df = con.execute(query).pl()
elapsed = time.perf_counter() - start

print(f"Processed 20M rows in {elapsed:.2f}s with zero cloud infrastructure!")
print(result_df.head(5))`,
          deliverables: [
            "Script benchmarking Pandas vs DuckDB vs Polars memory and CPU utilization",
            "Demonstrated predicate pushdown reducing I/O scan by >85%",
            "Lazy evaluation pipeline in Polars streaming mode on data > RAM"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Out-of-Memory Spill on Nested Schema Explosion",
          scenario: "Your Polars pipeline ingests deeply nested semi-structured JSON with dynamic, arbitrary keys. A standard `pl.read_ndjson` attempts to infer schema by inspecting all keys, causing memory to explode to 16GB and crashing the worker.",
          breakageReason: "Dynamic JSON keys with high cardinality turn into an explosion of columns in a columnar format, causing catastrophic memory overhead.",
          fixGuide: "1. Never infer dynamic schema on raw semi-structured data; specify explicit Arrow schemas.\n2. Treat arbitrary dynamic key-value pairs as a `Struct` or `Map` type rather than top-level columns.\n3. Utilize Polars lazy streaming (`pl.scan_ndjson().select(...).collect(streaming=True)`).",
          defensivePattern: "Never let raw dynamic user keys dictate your columnar schema. Enforce strict boundaries."
        },
        quiz: [
          {
            question: "How does predicate pushdown improve query performance when reading Parquet files?",
            options: [
              "It converts the Parquet file to CSV before reading.",
              "It reads file metadata (min/max values per row group) to skip entire row groups that don't match the `WHERE` filter without reading the data pages.",
              "It runs queries on the GPU.",
              "It decrypts the file."
            ],
            correct: 1,
            explanation: "Parquet stores min and max statistics for each column within each Row Group. Predicate pushdown inspects these statistics first and skips reading irrelevant blocks entirely from disk or S3."
          },
          {
            question: "Why can DuckDB query a 100GB Parquet file on a laptop with only 16GB of RAM?",
            options: [
              "Because it uses streaming vector chunks and out-of-core execution, spilling to disk only when needed and never holding the entire dataset in RAM.",
              "Because it automatically deletes rows that don't fit in RAM.",
              "Because it compresses RAM using zstandard.",
              "Because it sends the query to cloud servers automatically."
            ],
            correct: 0,
            explanation: "DuckDB processes data in small vectors (chunks of 2,048 rows) and features an out-of-core execution engine that streams data through memory, keeping RAM usage bounded."
          }
        ]
      },
      {
        id: "mod-2-2",
        number: "2.2",
        title: "Open Table Formats: Apache Iceberg & Delta Lake",
        duration: "3 Weeks",
        summary: "Understand table formats from the ground up: metadata trees, ACID transactions, time travel, and partition evolution.",
        whyTutorialsLie: "Most courses treat the data lake as a directory of Parquet files in S3. But real enterprise data lakes without table formats suffer from partial write corruption, slow $O(N)$ S3 directory listings, inability to delete rows for GDPR, and broken concurrent writes.",
        concepts: [
          {
            title: "The Architecture of Apache Iceberg",
            content: "Catalog $\\rightarrow$ Metadata JSON file $\\rightarrow$ Manifest List $\\rightarrow$ Manifest Files $\\rightarrow$ Data Files. How Iceberg replaces directory-based partitioning with metadata-driven file pruning."
          },
          {
            title: "ACID Guarantees & Optimistic Concurrency Control (OCC)",
            content: "How Iceberg achieves atomic commits on object stores (S3/GCS/MinIO). What happens during concurrent writes: commit conflict detection, retry mechanisms, and snapshot isolation."
          },
          {
            title: "Partition Evolution & Hidden Partitioning",
            content: "Why traditional Hive partitioning (`/year=2026/month=10/`) breaks queries when users filter by raw timestamp, and how Iceberg's hidden partitioning solves this without requiring users to supply partition columns in queries."
          },
          {
            title: "Lakehouse Maintenance & Compaction",
            content: "Solving the 'small file problem'. Running bin-packing compaction, snapshot expiration to reclaim storage, and orphan file removal."
          }
        ],
        lab: {
          title: "Hands-on Lab: Building a Production Apache Iceberg Lakehouse on MinIO",
          description: "Deploy a local MinIO S3 object store with PyIceberg / DuckDB. Create an Iceberg table, perform concurrent writes, evolve the schema by adding and renaming columns without rewriting underlying Parquet files, and query historical snapshots using Time Travel.",
          codeSnippet: `from pyiceberg.catalog import load_catalog
from pyiceberg.schema import Schema
from pyiceberg.types import NestedField, StringType, DoubleType, TimestampType
import pyarrow as pa

# Connect to local Iceberg REST catalog / SQLite catalog
catalog = load_catalog("local", **{
    "type": "sql",
    "uri": "sqlite:////tmp/iceberg_catalog.db",
    "warehouse": "s3://warehouse/",
    "s3.endpoint": "http://localhost:9000",
    "s3.access-key-id": "minioadmin",
    "s3.secret-access-key": "minioadmin"
})

# Load or create table
table = catalog.load_table("analytics.fct_orders")

# Schema Evolution: Add column with zero data rewrite
with table.update_schema() as update:
    update.add_column("discount_code", StringType(), doc="Promotional coupon")

# Time travel query: read previous snapshot
snapshots = table.snapshots()
first_snapshot_id = snapshots[0].snapshot_id

historical_table = catalog.load_table("analytics.fct_orders")
historical_data = historical_table.scan(snapshot_id=first_snapshot_id).to_arrow()
print(f"Historical snapshot {first_snapshot_id} has {len(historical_data)} rows.")`,
          deliverables: [
            "Local MinIO + Iceberg Docker compose stack",
            "Demonstrated schema evolution without data rewrite",
            "Time travel SQL query reproducing exact historical metrics",
            "Automated compaction job merging small files into 128MB optimal files"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Concurrent Writer Commit Collision",
          scenario: "Two automated ETL jobs attempt to append data to the same Iceberg table at the exact same second. Job A commits snapshot `v2`, while Job B throws `CommitFailedException: Requirement failed: current table metadata uuid changed` and fails the batch.",
          breakageReason: "Iceberg uses Optimistic Concurrency Control (OCC). If the metadata base snapshot changes before a writer commits, the commit is rejected to prevent silent overwrites.",
          fixGuide: "1. Configure client retry policy with exponential backoff and jitter (`commit.retry.num-retries=5`).\n2. For streaming workloads, use a dedicated single-writer or micro-batch coordinator.\n3. Distinguish between append operations (which can merge manifests without conflict) and overwrite operations.",
          defensivePattern: "Design data pipelines with automatic retry on OCC commit conflicts, ensuring idempotent re-evaluation."
        },
        quiz: [
          {
            question: "How does Apache Iceberg perform schema evolution (like renaming or dropping a column) without rewriting existing Parquet data files?",
            options: [
              "It renames columns inside the binary Parquet file directly.",
              "It assigns a unique immutable integer field ID to each column and tracks mappings in the table metadata, ignoring names in the data files.",
              "It creates symlinks for each column in S3.",
              "It loads all data into RAM and writes new files."
            ],
            correct: 1,
            explanation: "Iceberg uses unique integer Field IDs for every column. When a column is renamed or dropped, only the lightweight metadata JSON is updated; existing data files remain unchanged."
          },
          {
            question: "Why is the 'small file problem' particularly dangerous in an object storage data lake (S3/GCS)?",
            options: [
              "Because object stores cannot store files smaller than 1MB.",
              "Because millions of small files cause massive metadata overhead, slow query planning, and excessive HTTP GET request costs ($0.0004 per 1,000 requests).",
              "Because small files corrupt the CPU cache.",
              "Because small files cannot be compressed."
            ],
            correct: 1,
            explanation: "Millions of small files degrade query engines with excessive metadata operations and network latency, while racking up huge S3 API listing and GET charges. Compaction into 128MB-512MB files is essential."
          }
        ]
      },
      {
        id: "mod-2-3",
        number: "2.3",
        title: "Transformation Engineering with dbt Core & Data Contracts",
        duration: "3 Weeks",
        summary: "Build clean medallion architectures (Staging -> Intermediate -> Marts), manage incremental models, and enforce strict Data Contracts.",
        whyTutorialsLie: "Tutorials show simple `SELECT * FROM raw` models without tests, without incremental logic, and without contracts. When raw schemas change in production, whole analytics platforms break silently and reporting dashboards display garbage.",
        concepts: [
          {
            title: "The Medallion Architecture in dbt",
            content: "Clear layer separation: Staging (`stg_`: 1-to-1 with raw, rename, type-cast), Intermediate (`int_`: business logic, joins), and Marts (`fct_`, `dim_`: Kimball entities for business consumption)."
          },
          {
            title: "Incremental Models & Merge Strategies",
            content: "Writing performant incremental models in dbt using `merge`, `append`, and `delete+insert` strategies. Handling unique keys, partition filters, and `--full-refresh` backfill safety."
          },
          {
            title: "Data Contracts & Schema Constraints in dbt",
            content: "Enforcing model contracts (`contract: {enforced: true}`). Preventing downstream breaking changes by failing compilation if an analyst removes a column or changes data types."
          },
          {
            title: "dbt Slim CI & Automated Testing",
            content: "Running only models modified in a git Pull Request and their downstream dependents (`dbt build --select state:modified+`) using previous manifest artifacts to save compute."
          }
        ],
        lab: {
          title: "Hands-on Lab: Enterprise dbt Core Project with Contracts and Slim CI",
          description: "Build an enterprise dbt project modeling customer subscriptions and monthly recurring revenue (MRR). Implement incremental merge models, enforce schema contracts, write singular and generic tests, and configure a GitHub Actions slim CI pipeline.",
          codeSnippet: `{{
  config(
    materialized='incremental',
    unique_key='subscription_id',
    incremental_strategy='merge',
    contract={'enforced': true}
  )
}}

with source_data as (
    select * from {{ ref('stg_stripe__subscriptions') }}
    {% if is_incremental() %}
        where updated_at >= (select coalesce(max(updated_at), '1970-01-01') from {{ this }})
    {% endif %}
),

enriched as (
    select
        subscription_id,
        customer_id,
        plan_name,
        monthly_amount_usd,
        status,
        created_at,
        updated_at
    from source_data
)

select * from enriched`,
          deliverables: [
            "Complete dbt Core project structure with sources, staging, intermediate, and marts",
            "Incremental model using merge strategy with high watermark filter",
            "Contract definition in `schema.yml` with enforced types and descriptions",
            "Custom singular dbt test verifying MRR is never negative"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Incremental High-Watermark Silent Data Loss",
          scenario: "Your incremental model filters `where updated_at > (select max(updated_at) from {{ this }})`. An upstream transaction is delayed by 10 minutes and arrives with an `updated_at` older than the current max. The incremental run completes successfully, but the delayed row is permanently skipped and lost from the mart.",
          breakageReason: "Strict inequality on high-watermarks misses late-arriving records that fall behind the latest recorded timestamp.",
          fixGuide: "1. Add a lookback buffer window: `where updated_at >= (select max(updated_at) - interval '3 day' from {{ this }})`.\n2. Ensure the `unique_key` handles idempotent upserting of overlapping records.\n3. Schedule a weekly `--full-refresh` or partition-level backfill to reconcile discrepancies.",
          defensivePattern: "Never trust exact high watermarks without lookback buffers in incremental batch models."
        },
        quiz: [
          {
            question: "Why should `source()` and `ref()` functions always be used instead of hardcoded table names in dbt models?",
            options: [
              "Because hardcoded table names throw syntax errors in SQL.",
              "Because `ref()` builds the Directed Acyclic Graph (DAG) for dependency resolution and allows dbt to switch target schemas (dev vs prod) dynamically.",
              "Because `ref()` compresses tables automatically.",
              "Because `ref()` encrypts table data."
            ],
            correct: 1,
            explanation: "`ref()` and `source()` enable dbt to determine execution order (lineage graph) and dynamically compile appropriate target databases and schemas based on the active environment (e.g. dev, ci, prod)."
          },
          {
            question: "What is the primary benefit of dbt 'Slim CI' in pull requests?",
            options: [
              "It minimizes the size of dbt repository code.",
              "It only builds and tests models that were modified in the PR and their direct downstream dependencies, saving up to 90% in cloud warehouse costs and CI time.",
              "It runs dbt in a lightweight Docker container.",
              "It automatically fixes SQL syntax errors."
            ],
            correct: 1,
            explanation: "Slim CI compares the PR branch with production manifest state (`state:modified+`), executing only changed models and their downstream lineage instead of the entire project."
          }
        ]
      },
      {
        id: "mod-2-4",
        number: "2.4",
        title: "Asset-Oriented Orchestration (Dagster & Airflow)",
        duration: "3 Weeks",
        summary: "Master Software-Defined Assets (SDAs), idempotent pipeline execution, partition-based backfilling, and dynamic sensors.",
        whyTutorialsLie: "Airflow tutorials show: `task1 >> task2 >> task3` with dummy `BashOperator(bash_command='echo hello')`. In reality, task-centric orchestration loses track of data lineage, makes data recomputation a nightmare, and breaks when backfilling historical partitions concurrently.",
        concepts: [
          {
            title: "Task-Centric (Airflow) vs Asset-Centric (Dagster)",
            content: "Why thinking in 'what data assets exist and what are their dependencies' (Dagster SDAs) is fundamentally superior for data engineering than thinking in 'what arbitrary tasks to run' (Airflow)."
          },
          {
            title: "Idempotency & Re-runnability",
            content: "The gold standard of data engineering: running a pipeline 100 times for the same time window must produce the exact same result without duplicate rows. Implementing partition overwrites and atomic file swaps."
          },
          {
            title: "Partitioning & Historical Backfilling",
            content: "Defining hourly and daily partitioned assets. Backfilling 2 years of historical data concurrently across worker pools without overwhelming upstream APIs or database connection pools."
          }
        ],
        lab: {
          title: "Hands-on Lab: Building a Production Dagster Pipeline with Partitioned Assets",
          description: "Build an end-to-end Dagster project defining partitioned data assets: raw weather telemetry API ingestion $\\rightarrow$ PyIceberg staging $\\rightarrow$ dbt aggregation marts. Configure automated daily partitioning and test an idempotent historical backfill of 30 partitions.",
          codeSnippet: `from dagster import asset, DailyPartitionsDefinition, AssetExecutionContext
import pandas as pd
import requests

daily_partitions = DailyPartitionsDefinition(start_date="2026-01-01")

@asset(partitions_def=daily_partitions)
def raw_daily_telemetry(context: AssetExecutionContext) -> pd.DataFrame:
    """Fetches daily telemetry partition idempotently."""
    partition_date = context.partition_key
    context.log.info(f"Ingesting partition for {partition_date}")
    
    url = f"https://api.example.com/telemetry?date={partition_date}"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    
    df = pd.DataFrame(resp.json())
    df["partition_date"] = partition_date
    return df

@asset(partitions_def=daily_partitions)
def cleaned_daily_telemetry(context: AssetExecutionContext, raw_daily_telemetry: pd.DataFrame) -> pd.DataFrame:
    """Cleans and deduplicates records for the partition."""
    df = raw_daily_telemetry.drop_duplicates(subset=["device_id", "timestamp"])
    return df`,
          deliverables: [
            "Complete Dagster repository with asset definitions and dependencies",
            "Configured DailyPartitionsDefinition with IOManager saving to local MinIO/Parquet",
            "Successful backfill run of 30 historical partitions with zero race conditions",
            "Dagster UI asset lineage graph screenshot and execution logs"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Non-Idempotent Append Disaster",
          scenario: "An orchestrator job ingesting daily sales runs at 2:00 AM, finishes 90%, but experiences a network timeout writing the completion log. The orchestrator's retry policy automatically triggers a retry at 2:05 AM. The table was configured with `INSERT INTO`, resulting in duplicated revenue across the entire company for that day.",
          breakageReason: "Failure to enforce idempotency in the destination sink.",
          fixGuide: "1. For SQL sinks: Use partition deletion before insertion (`DELETE FROM table WHERE partition_date = '...'` inside an atomic transaction) or `MERGE` / `INSERT OVERWRITE`.\n2. For file/lake sinks: Write to a deterministic partition directory with atomic overwrite.\n3. Verify idempotency by running the orchestrator task 3 times consecutively and asserting row count remains constant.",
          defensivePattern: "Every pipeline task must be idempotent. If running it twice changes the state, it is broken by definition."
        },
        quiz: [
          {
            question: "What does it mean for a data pipeline step to be 'idempotent'?",
            options: [
              "It runs in under 1 second.",
              "It produces the exact same outcome and target state regardless of how many times it is executed with the same input parameters.",
              "It encrypts its data at rest.",
              "It requires no CPU or memory."
            ],
            correct: 1,
            explanation: "Idempotency means $f(f(x)) = f(x)$. Executing the pipeline once, twice, or ten times with the same input parameters results in the exact same target state without side effects or duplicates."
          },
          {
            question: "In Dagster, what is a Software-Defined Asset (SDA)?",
            options: [
              "A software license purchased for data tools.",
              "A declaration of an asset that should exist in storage, defined by a function that knows how to compute it and what upstream assets it depends on.",
              "A cloud server instance.",
              "A database password."
            ],
            correct: 1,
            explanation: "Software-Defined Assets tie the definition of the data asset (its schema, lineage, partition, description) directly to the code that produces it, focusing orchestration on the data itself rather than arbitrary task graphs."
          }
        ]
      },
      {
        id: "mod-2-5",
        number: "2.5",
        title: "Data Quality, Observability & Data Contracts",
        duration: "2 Weeks",
        summary: "Shift from reactive debugging to proactive guarantees: Data Contracts specification, Great Expectations, and OpenLineage.",
        whyTutorialsLie: "In tutorials, pipelines are treated as completed once the data lands in a table. In production, 60% of a data engineer's reputation depends on data trust: did the data arrive on time? Is it complete? Are there anomalies? If you don't catch anomalies, your CEO will.",
        concepts: [
          {
            title: "Data Contracts (The Modern Producer-Consumer Agreement)",
            content: "Using open Data Contract specifications (YAML schema, SLA, semantics) to create binding agreements between software engineering teams (producers) and data teams (consumers)."
          },
          {
            title: "Automated Data Quality Profiling (Great Expectations / Soda)",
            content: "Implementing automated test suites: expectation of non-null, value ranges, uniqueness, categorical values, and distributional anomaly detection (e.g., alert if row count deviates > 25% from 30-day moving average)."
          },
          {
            title: "Data Observability & Lineage Tracking (OpenLineage)",
            content: "The 5 pillars of data observability: Freshness, Volume, Schema, Quality, and Lineage. Tracking dataset inputs, outputs, and job runs across heterogeneous tools."
          }
        ],
        lab: {
          title: "Hands-on Lab: Automated CI/CD Data Contract Validation & Quality Gates",
          description: "Define a YAML Data Contract for a customer checkout event stream. Build a pre-commit quality gate using Great Expectations and Python that halts pipeline ingestion, quarantine corrupt events, and alerts a mock Slack webhook when schema violations occur.",
          codeSnippet: `name: orders_checkout_contract
version: 1.0.0
owner: checkout-backend-team
dataset: production.events.orders_checkout
sla:
  freshness: "15 minutes"
  availability: "99.9%"
schema:
  type: record
  fields:
    - name: order_id
      type: string
      required: true
      unique: true
    - name: customer_id
      type: string
      required: true
    - name: checkout_amount
      type: decimal(10,2)
      required: true
      minimum: 0.01
    - name: payment_status
      type: string
      enum: ["PENDING", "COMPLETED", "FAILED"]`,
          deliverables: [
            "Formal Data Contract YAML specification file",
            "Great Expectations checkpoint script executing automated validations",
            "Automated alerting webhook notification with failure diagnostics",
            "Quarantine DLQ sink for events failing contractual validation"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Silent Volume Drop Anomaly",
          scenario: "Upstream checkout pipeline experiences a bug where international users cannot complete orders. Total daily rows drop from 500,000 to 380,000. All rows that arrive are 100% syntactically valid, so traditional schema tests pass. The executive dashboard shows an unexplained 24% revenue drop on Monday morning.",
          breakageReason: "Testing only schema syntax without testing data volume and distribution statistics.",
          fixGuide: "1. Implement volume anomaly checks: compare incoming partition count against rolling 14-day median $\\pm 2\\sigma$.\n2. Add categorical distribution monitoring: alert if the percentage of international orders drops by $>50%$.\n3. Trigger automated Slack alerts to both the data and engineering on-call rotations before business hours.",
          defensivePattern: "Syntax checks only verify shape; volume and distributional checks verify business reality."
        },
        quiz: [
          {
            question: "What is the primary objective of implementing Data Contracts between upstream producers and the data team?",
            options: [
              "To legally sue developers if their code breaks.",
              "To establish an explicit, versioned API-like schema and SLA agreement so upstream teams cannot silently alter schemas or data semantics without breaking CI checks.",
              "To replace SQL databases with NoSQL.",
              "To increase cloud storage."
            ],
            correct: 1,
            explanation: "Data Contracts treat internal data as a first-class product, enforcing explicit schemas, SLAs, and semantics at the producer boundary to prevent silent breaking changes."
          },
          {
            question: "What are the five core pillars of modern Data Observability?",
            options: [
              "CPU, RAM, Disk, Network, GPU.",
              "Freshness, Volume, Schema, Quality, and Lineage.",
              "Extraction, Transformation, Loading, Testing, Dashboarding.",
              "Speed, Cost, Complexity, Redundancy, Scalability."
            ],
            correct: 1,
            explanation: "Modern data observability is defined by the 5 pillars: Freshness (timeliness), Volume (completeness), Schema (structure), Quality (accuracy), and Lineage (dependencies)."
          }
        ]
      }
    ]
  },
  {
    levelId: "advanced",
    levelTitle: "Level 3: Scale & Real-Time Streaming",
    levelSubtitle: "Master distributed computing internals (Spark/Flink), event streaming (Kafka/Redpanda), CDC, and Terraform IaC.",
    badge: "Scale & Streaming",
    badgeColor: "rose",
    modules: [
      {
        id: "mod-3-1",
        number: "3.1",
        title: "Distributed Computing & Apache Spark Internals",
        duration: "4 Weeks",
        summary: "Understand the Catalyst optimizer, Tungsten memory management, Shuffle dynamics, and debug severe data skew.",
        whyTutorialsLie: "Most Spark courses say: 'Just call `df.groupBy().count()` and Spark handles the rest!' In production, a job on 100GB of data hangs at 99% for 4 hours because 80% of records have `null` user keys, hashing all records to a single executor and crashing it with Out of Memory.",
        concepts: [
          {
            title: "Spark Architecture & Memory Model",
            content: "Driver, Cluster Manager, Executors. JVM Off-Heap vs On-Heap memory (Execution memory vs Storage memory vs User memory). Garbage collection overhead."
          },
          {
            title: "The Catalyst Optimizer & Physical Plans",
            content: "Analyzing `df.explain(True)`. Parsing $\\rightarrow$ Analyzed Logical Plan $\\rightarrow$ Optimized Logical Plan $\\rightarrow$ Physical Plans $\\rightarrow$ Cost-Based Model $\\rightarrow$ Whole-Stage Code Generation (Tungsten)."
          },
          {
            title: "Spark Join Strategies & Shuffle Mechanics",
            content: "Broadcast Hash Join (BHJ), Shuffle Hash Join (SHJ), Sort-Merge Join (SMJ). Why shuffles (exchanging data across the network) are the #1 killer of Spark performance."
          },
          {
            title: "Data Skew Diagnosis & Salting Techniques",
            content: "Identifying skewed partitions via the Spark UI event timeline. Fixing skew by adding random salt keys (`salt = floor(rand() * 10)`) to distribute hot keys evenly across executors."
          }
        ],
        lab: {
          title: "Hands-on Lab: Spark Performance Tuning & Skew Mitigation Lab",
          description: "Given a deliberately skewed dataset of 50 million records where one key dominates 70% of rows, profile the job in the Spark UI, inspect stage execution times, apply key salting and Adaptive Query Execution (AQE), reducing execution time from 22 minutes to 1.5 minutes.",
          codeSnippet: `from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder \\
    .appName("SkewMitigationLab") \\
    .config("spark.sql.adaptive.enabled", "true") \\
    .config("spark.sql.adaptive.skewJoin.enabled", "true") \\
    .getOrCreate()

# Salting a skewed dataframe before join
SALT_FACTOR = 16

# Add random salt to large skewed table
large_skewed_df = large_df.withColumn("salt", F.floor(F.rand() * SALT_FACTOR))

# Replicate dimension table by the salt factor
lookup_salted_df = lookup_df.withColumn("salt_array", F.array([F.lit(i) for i in range(SALT_FACTOR)])) \\
    .withColumn("salt", F.explode("salt_array")) \\
    .drop("salt_array")

# Join on composite key (original_key + salt) to distribute hot key across 16 executors
balanced_join_df = large_skewed_df.join(
    lookup_salted_df,
    on=["join_key", "salt"],
    how="inner"
).drop("salt")`,
          deliverables: [
            "Spark UI screenshot showing initial skewed executor task timeline (one task running 15x longer)",
            "PySpark script implementing key salting and broadcast join thresholds",
            "Spark UI comparison showing balanced task distribution across all executors",
            "Benchmark showing >10x speedup and zero disk spill"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Spill-to-Disk Executor Death Spiral",
          scenario: "A PySpark job performing a wide aggregation experiences massive disk spill (`Spill (Memory): 42 GB`, `Spill (Disk): 18 GB`). Node disks fill up, garbage collection pauses exceed 30 seconds, and the cluster manager loses heartbeat with executors, killing the job after 3 hours.",
          breakageReason: "Insufficient execution memory combined with high partition cardinality and unoptimized wide shuffle.",
          fixGuide: "1. Increase `spark.sql.shuffle.partitions` from default 200 to match data volume and cluster core count (e.g., 1,200).\n2. Filter out null or dummy join keys before shuffle joins.\n3. Enable Adaptive Query Execution (`spark.sql.adaptive.enabled = true`) to coalesce small partitions automatically.\n4. Tune `spark.memory.fraction` and executor memory overhead.",
          defensivePattern: "Always monitor Memory Spill and Disk Spill in the Spark UI. Any non-zero disk spill is an immediate warning of memory starvation."
        },
        quiz: [
          {
            question: "Under what condition will Spark select a Broadcast Hash Join (BHJ) over a Sort-Merge Join (SMJ)?",
            options: [
              "When both tables have more than 1 billion rows.",
              "When one of the joined tables is smaller than `spark.sql.autoBroadcastJoinThreshold` (default 10MB) or an explicit `broadcast()` hint is supplied.",
              "When tables are partitioned on different columns.",
              "When running on a single CPU core."
            ],
            correct: 1,
            explanation: "If one table is small enough to fit into executor memory, Spark broadcasts the entire table to every worker node, eliminating the expensive network shuffle required by Sort-Merge Joins."
          },
          {
            question: "Why does data skew cause a Spark job to hang at 99% progress even if 99 of 100 tasks are finished?",
            options: [
              "Because the final task is waiting for a software license.",
              "Because the partition with the hot key contains 80% of the total records and a single executor must process all of it sequentially while other executors sit idle.",
              "Because Spark pauses execution to compress results.",
              "Because the driver node runs out of disk space."
            ],
            correct: 1,
            explanation: "In distributed computing, the overall stage runtime is bounded by the slowest task (the straggler). A skewed partition forces one executor to crunch the vast majority of records alone while other cores remain idle."
          }
        ]
      },
      {
        id: "mod-3-2",
        number: "3.2",
        title: "Event Streaming & Change Data Capture (CDC)",
        duration: "3 Weeks",
        summary: "Master log-centric architectures with Apache Kafka & Redpanda, offset management, and zero-impact CDC with Debezium.",
        whyTutorialsLie: "Most streaming tutorials show a single Python script pushing random messages to a Kafka topic and another script printing them. In reality, you must handle consumer lag, poison pill messages, partition rebalances, exactly-once semantics, and extracting database changes without locking production OLTP tables.",
        concepts: [
          {
            title: "Kafka & Redpanda Core Internals",
            content: "Topics, Partitions, Segment files, the Append-Only Commit Log. Why partitions are the unit of parallelism. How Redpanda achieves ultra-low latency with C++ and thread-per-core architecture."
          },
          {
            title: "Consumer Groups & Offset Management",
            content: "Consumer group rebalancing protocols (Eager vs Cooperative Sticky). Offset commit strategies (auto-commit vs manual commit). Handling poison pill messages without freezing the partition."
          },
          {
            title: "Change Data Capture (CDC) with Debezium",
            content: "Why polling databases (`SELECT * WHERE updated_at > ...`) locks tables, misses deletions, and creates spikes. How Debezium reads PostgreSQL Write-Ahead Logs (WAL) or MySQL binlog with zero query overhead."
          },
          {
            title: "Delivery Semantics (At-least-once vs Exactly-once)",
            content: "Understanding idempotent producers (`enable.idempotence=true`), Kafka transactions, and how consumer deduplication achieves end-to-end exactly-once delivery."
          }
        ],
        lab: {
          title: "Hands-on Lab: Real-Time PostgreSQL CDC to Redpanda Pipeline",
          description: "Spin up PostgreSQL, Debezium Connect, and Redpanda with Docker Compose. Configure WAL logical decoding, ingest real-time INSERT, UPDATE, and DELETE row events as Kafka messages, and build a Python consumer that reconstructs an audit trail.",
          codeSnippet: `{
  "name": "postgres-cdc-orders",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "dbz_password",
    "database.dbname": "production",
    "database.server.name": "prod_server",
    "table.include.list": "public.orders",
    "plugin.name": "pgoutput",
    "publication.autocreate.mode": "filtered",
    "tombstones.on.delete": "true"
  }
}`,
          deliverables: [
            "Docker Compose stack with Postgres (wal_level=logical), Debezium, and Redpanda",
            "Verified capture of INSERT, UPDATE, and DELETE operations as structured JSON events",
            "Python consumer with manual offset commit after successful sink write",
            "Handling of tombstone records for deleted rows"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Consumer Lag Avalanche & Rebalance Storm",
          scenario: "A downstream analytics consumer experiences a slow database insertion (taking 500ms per record instead of 2ms). Processing time exceeds `max.poll.interval.ms`. Kafka broker assumes the consumer is dead, revokes its partitions, and triggers a rebalance. The consumer rejoins, fails again, triggering an infinite rebalance storm while consumer lag reaches 2,000,000 messages.",
          breakageReason: "Blocking processing inside the Kafka poll loop causing heartbeat/poll interval timeouts.",
          fixGuide: "1. Decouple polling from processing: poll messages in one thread and dispatch to a bounded worker thread pool.\n2. Increase `max.poll.interval.ms` or decrease `max.poll.records` to ensure batches finish comfortably within the threshold.\n3. Implement Cooperative Sticky Rebalancing (`cooperative-sticky`) so healthy consumers aren't paused during rebalances.",
          defensivePattern: "Never perform heavy I/O synchronously inside the Kafka poll loop without bounded batch sizes."
        },
        quiz: [
          {
            question: "Why is Change Data Capture (CDC) via database transaction logs superior to periodic polling queries (`SELECT ... WHERE updated_at > last_sync`)?",
            options: [
              "CDC uses less network bandwidth and produces prettier JSON.",
              "CDC reads the database Write-Ahead Log without running queries, captures DELETE operations, captures intermediate updates that occurred between polls, and causes near-zero load on the OLTP database.",
              "CDC automatically indexes all database tables.",
              "CDC requires no database credentials."
            ],
            correct: 1,
            explanation: "Polling queries cannot capture DELETE operations, miss intermediate state changes that were quickly overridden, and place heavy analytical query loads on transactional databases. CDC streams log events natively with zero database locks."
          },
          {
            question: "If a Kafka topic has 6 partitions and you spin up 8 consumers in the same consumer group, how many consumers will actively receive data?",
            options: [
              "All 8 consumers.",
              "Only 6 consumers; 2 consumers will remain idle as hot standbys because each partition can be assigned to only one consumer per consumer group.",
              "Only 1 consumer.",
              "Kafka will crash."
            ],
            correct: 1,
            explanation: "Within a consumer group, each partition is consumed by exactly one consumer at a time. If there are more consumers than partitions, the excess consumers sit idle waiting for a failure/rebalance."
          }
        ]
      },
      {
        id: "mod-3-3",
        number: "3.3",
        title: "Real-Time Stream Processing (Flink & Spark Streaming)",
        duration: "3 Weeks",
        summary: "Master Event Time, Watermarks, Windowing (Tumbling, Sliding, Session), and Stateful Stream Processing.",
        whyTutorialsLie: "Tutorials calculate rolling statistics based on 'when the message arrived at the server' (Processing Time). But when mobile apps go offline in an airplane or subway and sync 4 hours later, processing-time pipelines produce completely invalid analytics and destroy financial reporting accuracy.",
        concepts: [
          {
            title: "Event Time vs Processing Time vs Ingestion Time",
            content: "Why Event Time (the exact timestamp when the user performed the action) is the only reliable basis for analytical correctness in distributed systems."
          },
          {
            title: "Watermarks & Late-Arriving Data Handling",
            content: "What is a watermark? A heuristic assertion that the system has observed all events up to timestamp $T$. Defining watermark lag tolerances and side-outputting late records that arrive beyond the watermark."
          },
          {
            title: "Windowing Strategies & Stateful Processing",
            content: "Tumbling (fixed non-overlapping), Sliding (overlapping), and Session (gap-driven) windows. Managing state backends (RocksDB in Flink) and checkpointing for fault-tolerance."
          }
        ],
        lab: {
          title: "Hands-on Lab: Real-Time Fraud Detection with Watermarked Windows",
          description: "Build a Spark Structured Streaming / Flink pipeline that processes a real-time stream of financial transactions, computes rolling 5-minute transaction volume per account with a 2-minute watermark tolerance, flags anomaly spikes, and writes late-arriving events to a dead-letter sink.",
          codeSnippet: `from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder \\
    .appName("RealTimeFraudDetection") \\
    .getOrCreate()

# Streaming read from Kafka topic
stream_df = spark.readStream \\
    .format("kafka") \\
    .option("kafka.bootstrap.servers", "localhost:9092") \\
    .option("subscribe", "financial_transactions") \\
    .load()

# Parse JSON and define Event Time Watermark
parsed_df = stream_df.select(F.from_json(F.col("value").cast("string"), schema).alias("data")).select("data.*") \\
    .withWatermark("event_time", "2 minutes")

# 5-minute tumbling window with watermark
windowed_aggregations = parsed_df \\
    .groupBy(
        F.window("event_time", "5 minutes"),
        F.col("account_id")
    ) \\
    .agg(
        F.count("*").alias("tx_count"),
        F.sum("amount").alias("total_amount")
    )

# Write stream to console or Iceberg sink with checkpointing
query = windowed_aggregations.writeStream \\
    .format("console") \\
    .outputMode("update") \\
    .option("checkpointLocation", "/tmp/spark_checkpoints/fraud") \\
    .start()`,
          deliverables: [
            "Streaming pipeline code with explicit watermark definition",
            "Demonstrated aggregation updating in real time as events flow",
            "Demonstrated handling and side-routing of out-of-order events arriving 90 seconds late",
            "Checkpoint recovery: killing the streaming job mid-stream and resuming without data loss"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Out-of-Order Burst & State Store Bloat",
          scenario: "An IoT fleet suffers a connectivity blackout; 50,000 devices reconnect simultaneously, dumping 2 days worth of queued telemetry events with historical timestamps into the stream. The stream processor attempts to hold all historical window states in memory, RocksDB runs out of memory, and checkpoints fail.",
          breakageReason: "A massive burst of events arriving far behind the current watermark causes state store memory exhaustion if allowed lateness is set too wide or unbounded.",
          fixGuide: "1. Cap allowed lateness to a reasonable business tolerance (e.g., 30 minutes).\n2. Any events older than the watermark threshold are dropped from state calculation and routed immediately to a raw archival / DLQ sink.\n3. Configure RocksDB off-heap memory bounds and enable incremental checkpointing.",
          defensivePattern: "Set strict boundaries on state retention. Never allow unbounded lateness in streaming window aggregations."
        },
        quiz: [
          {
            question: "What is the primary function of a 'Watermark' in stream processing engines like Flink and Spark?",
            options: [
              "To stamp a copyright watermark on data visualizations.",
              "To signal the stream engine that it can close a time window and emit final results because all events up to timestamp $T$ have likely arrived.",
              "To pause the stream when network bandwidth is low.",
              "To encrypt messages."
            ],
            correct: 1,
            explanation: "Watermarks tell the engine how late events can arrive before a window is closed and materialized, balancing latency against completeness for out-of-order event streams."
          },
          {
            question: "Why is checkpointing essential for achieving 'Exactly-Once' processing in streaming architectures?",
            options: [
              "It deletes old data from the database.",
              "It periodically snapshots the engine's internal state and stream source offsets to durable storage, allowing the engine to recover to an exact known consistent state upon failure.",
              "It speeds up CPU execution.",
              "It enables multi-threading."
            ],
            correct: 1,
            explanation: "Checkpointing captures consistent snapshots of both the consumer offsets and state store. If an executor or node crashes, the system rolls back to the latest checkpoint and replays stream events deterministically."
          }
        ]
      },
      {
        id: "mod-3-4",
        number: "3.4",
        title: "Infrastructure as Code (Terraform) & FinOps",
        duration: "3 Weeks",
        summary: "Provision scalable cloud lakehouses with Terraform, enforce IAM least-privilege, and optimize cloud warehouse costs.",
        whyTutorialsLie: "Most courses show you clicking buttons in the AWS or GCP web console. In production, click-ops is banned. Everything must be provisioned through Terraform code, audited, versioned, and cost-controlled. An unmonitored Snowflake or BigQuery query can easily run up a $10,000 bill in a single weekend.",
        concepts: [
          {
            title: "Terraform for Data Platforms",
            content: "Writing declarative HCL modules for S3/GCS buckets, IAM policies, KMS encryption keys, Snowflake/BigQuery warehouses, and orchestrator compute clusters. Managing remote state and locks with DynamoDB."
          },
          {
            title: "IAM Least-Privilege & Data Security",
            content: "Configuring fine-grained role-based access control (RBAC). Why data pipelines must never use admin credentials. Enforcing KMS customer-managed keys and private VPC endpoints for data transit."
          },
          {
            title: "Data FinOps (Financial Operations)",
            content: "Strategies to stop burning cash: S3 Intelligent-Tiering and lifecycle rules, Snowflake auto-suspend timeouts (e.g. 60 seconds), partition pruning audit, spot instances for batch clusters, and cost attribution tagging."
          }
        ],
        lab: {
          title: "Hands-on Lab: Provisioning a Secure Cloud Lakehouse with Terraform",
          description: "Write modular Terraform code that provisions an S3 Data Lake (Raw, Staging, Marts) with lifecycle rules, server-side KMS encryption, least-privilege IAM roles for ingestion services, and cost anomaly budget alerts.",
          codeSnippet: `resource "aws_s3_bucket" "lakehouse_storage" {
  bucket = "enterprise-lakehouse-data-\${var.environment}"

  tags = {
    Environment = var.environment
    CostCenter  = "DataEngineering"
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "lakehouse_lifecycle" {
  bucket = aws_s3_bucket.lakehouse_storage.id

  rule {
    id     = "archive_raw_events"
    status = "Enabled"

    filter {
      prefix = "raw-events/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}`,
          deliverables: [
            "Modular Terraform files (`main.tf`, `variables.tf`, `outputs.tf`)",
            "Configured S3 lifecycle rules saving >60% on long-term raw data storage",
            "Least-privilege IAM policies restricting write access strictly to specific prefixes",
            "Automated cost budget alert triggering if monthly spend exceeds threshold"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Runaway $12,000 Weekend Query",
          scenario: "An analyst runs an unpartitioned cross-join on a 5-billion row table on a Snowflake `X-Large` warehouse on Friday afternoon. Auto-suspend was accidentally disabled in the warehouse configuration. The cluster runs at full capacity all weekend, burning 16 credits/hour ($48/hour) plus query compute, racking up thousands of dollars in wasted budget.",
          breakageReason: "Lack of statement timeout limits, disabled warehouse auto-suspend, and missing resource monitors.",
          fixGuide: "1. Enforce strict Terraform definitions for warehouses: `auto_suspend = 60` and `auto_resume = true`.\n2. Set `STATEMENT_TIMEOUT_IN_SECONDS = 3600` so runaway queries abort automatically after 1 hour.\n3. Configure account-level Snowflake Resource Monitors to suspend warehouses if monthly budget hits 100%.",
          defensivePattern: "Never create cloud compute resources without automated auto-suspend, statement timeouts, and hard billing limits."
        },
        quiz: [
          {
            question: "Why is 'Click-Ops' (manually creating cloud resources in the web console) prohibited in mature data engineering teams?",
            options: [
              "Because web consoles charge an extra fee per click.",
              "Because manual creation lacks auditability, cannot be peer-reviewed in pull requests, creates configuration drift, and cannot be recreated in disaster recovery.",
              "Because web consoles are slower than the CLI.",
              "Because Terraform is required by law."
            ],
            correct: 1,
            explanation: "Infrastructure as Code (IaC) ensures repeatable, version-controlled, auditable environments that can be deployed deterministically across dev, staging, and prod without human configuration error."
          },
          {
            question: "What is the single most effective way to prevent catastrophic cloud compute bills in Snowflake or BigQuery?",
            options: [
              "Deleting all tables every Friday.",
              "Configuring aggressive auto-suspend timeouts (e.g., 60 seconds), maximum query execution timeouts, and hard account-level resource billing monitors.",
              "Switching entirely to CSV files.",
              "Running all queries without indexes."
            ],
            correct: 1,
            explanation: "Short auto-suspend times stop idle clusters immediately, query execution timeouts kill runaway Cartesian queries, and resource monitors stop warehouses when budget thresholds are reached."
          }
        ]
      },
      {
        id: "mod-3-5",
        number: "3.5",
        title: "AI & Vector Data Engineering (The 2026 Shift)",
        duration: "3 Weeks",
        summary: "Build unstructured data ingestion pipelines, chunking, scalable embedding generation, and vector databases (pgvector/Qdrant) for enterprise RAG.",
        whyTutorialsLie: "Most AI tutorials show: `docs = load_pdf(); index = create_vector_store(docs)`. They ignore embedding drift, chunk overlap quality, token cost management, incremental updates when documents change, and metadata filtering at scale.",
        concepts: [
          {
            title: "Unstructured Data Ingestion Pipelines",
            content: "Extracting text and tables from PDFs, HTML, markdown, and audio transcriptions. Deduplication and text normalization."
          },
          {
            title: "Chunking Strategies & Embedding Generation at Scale",
            content: "Fixed-size vs Recursive Character vs Semantic Chunking. Generating vector embeddings with rate-limited worker pools and caching to avoid repeated expensive LLM API calls."
          },
          {
            title: "Vector Databases & Indexing Algorithms",
            content: "Understanding HNSW (Hierarchical Navigable Small World) and IVFFlat indexes in pgvector and Qdrant. Cosine similarity vs Euclidean distance vs Dot product."
          },
          {
            title: "Incremental Updates & Document Lifecycle in RAG",
            content: "Handling document updates and deletions: how to avoid stale vector retrieval when upstream source documents are updated or deleted."
          }
        ],
        lab: {
          title: "Hands-on Lab: Enterprise Multi-Tenant RAG Data Feeder Pipeline",
          description: "Build an incremental data pipeline that monitors corporate document folders, parses PDFs, splits them into semantic chunks, generates vector embeddings with rate-limiting, and upserts them into a pgvector database with tenant isolation and metadata filtering.",
          codeSnippet: `import hashlib
from typing import List, Dict, Any
import psycopg2
from pgvector.psycopg2 import register_vector

def compute_chunk_hash(text: str) -> str:
    """Deterministic hash to avoid re-embedding unchanged text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def upsert_document_chunks(conn, tenant_id: str, doc_id: str, chunks: List[Dict[str, Any]]):
    """Upserts document chunks with pgvector embeddings idempotently."""
    register_vector(conn)
    with conn.cursor() as cur:
        # Delete prior chunks for document if updating
        cur.execute("DELETE FROM document_embeddings WHERE tenant_id = %s AND doc_id = %s", (tenant_id, doc_id))
        
        for idx, chunk in enumerate(chunks):
            chunk_hash = compute_chunk_hash(chunk["text"])
            cur.execute("""
                INSERT INTO document_embeddings 
                (tenant_id, doc_id, chunk_index, chunk_text, chunk_hash, embedding, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (tenant_id, doc_id, idx, chunk["text"], chunk_hash, chunk["embedding"]))
    conn.commit()`,
          deliverables: [
            "Document parsing and semantic chunking module",
            "Hash-based caching layer preventing redundant embedding API calls",
            "PostgreSQL schema with `vector` extension and HNSW index",
            "Metadata-filtered hybrid search combining full-text search and vector similarity"
          ]
        },
        chaosLab: {
          title: "Chaos Scenario: The Zombie Embedding & RAG Hallucination Disaster",
          scenario: "An employee handbook is updated with new company policy on benefits. A naive vector pipeline appends the new chunks to the vector database without deleting the previous chunks. An enterprise AI assistant retrieves both contradictory chunks, leading to hallucinated and conflicting answers to employees.",
          breakageReason: "Treating vector databases as append-only sinks without tracking document version lifecycle and deletion propagation.",
          fixGuide: "1. Enforce document-level lineage: track `doc_id` and `version` on every chunk.\n2. Use an atomic delete-and-replace or upsert strategy keyed on `(tenant_id, doc_id)`.\n3. Add soft-delete tombstone records and filter active chunks during similarity search (`WHERE is_active = TRUE`).",
          defensivePattern: "Vector data is still data. Treat vector stores with the same strict CRUD and lifecycle discipline as transactional databases."
        },
        quiz: [
          {
            question: "Why is the HNSW (Hierarchical Navigable Small World) index preferred over IVFFlat in high-traffic vector databases?",
            options: [
              "HNSW uses zero memory.",
              "HNSW builds a multi-layer graph providing extremely fast approximate nearest neighbor search with high recall without requiring full table retraining as data grows.",
              "HNSW only works on CPU.",
              "HNSW is an encryption standard."
            ],
            correct: 1,
            explanation: "HNSW is a graph-based indexing algorithm that delivers superior query performance and recall under high query loads, and seamlessly supports incremental data insertions."
          },
          {
            question: "Why should content hashes (like SHA-256) be computed for document chunks before sending them to an embedding model API?",
            options: [
              "To compress the text.",
              "To cache embeddings and avoid costly API calls for unchanged text chunks during pipeline re-runs.",
              "To convert text to numbers.",
              "To satisfy GDPR requirements."
            ],
            correct: 1,
            explanation: "Embedding generation via LLM APIs is slow and costs money per token. Hashing each chunk allows the pipeline to skip re-embedding identical text across incremental re-runs, saving thousands of dollars."
          }
        ]
      }
    ]
  }
];

