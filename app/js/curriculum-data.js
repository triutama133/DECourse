// Comprehensive Bilingual Curriculum Data (ID & EN)
// Handcrafted for deep mutual understanding, first-principles mastery, and zero AI slop.

window.CURRICULUM_DATA = [
  {
    "levelId": "zero",
    "levelTitle": {
      "id": "Level 0: Fondasi Pemula (Dari Awam ke Mindset Engineer)",
      "en": "Level 0: Layman's Onboarding (From Novice to Engineer)"
    },
    "levelSubtitle": {
      "id": "Pahami analogi dunia nyata, mental model aliran data, setup komputer, dan fondasi database tanpa jargon rumit.",
      "en": "Understand real-world analogies, mental models of data flow, environment setup, and database fundamentals without confusing jargon."
    },
    "badge": {
      "id": "Mulai di Sini",
      "en": "Start Here"
    },
    "badgeColor": "blue",
    "modules": [
      {
        "id": "mod-0-1",
        "number": "0.1",
        "title": {
          "id": "Peta Dunia Data: Apa Sebenarnya Kerja Data Engineer?",
          "en": "The Data Landscape: What Does a Data Engineer Actually Do?"
        },
        "duration": {
          "id": "1 Minggu",
          "en": "1 Week"
        },
        "summary": {
          "id": "Pahami perbedaan nyata antara Data Engineer, Data Analyst, dan Data Scientist lewat analogi restoran, serta perjalanan data dari aplikasi ke dashboard.",
          "en": "Understand the true distinction between Data Engineers, Analysts, and Scientists through the restaurant analogy, and trace the path of data from user click to executive dashboard."
        },
        "whyTutorialsLie": {
          "id": "Tutorial langsung menyuruh Anda mengetik 'SELECT *' tanpa menjelaskan MENGAPA profesi ini ada. Akibatnya, pemula bingung apa bedanya database aplikasi biasa (Postgres) dengan Data Warehouse, dan kenapa data tidak bisa langsung ditarik dari kasir.",
          "en": "Tutorials jump straight into typing 'SELECT *' without explaining WHY this profession exists. Consequently, beginners don't understand the difference between transactional databases and analytical warehouses, or why you cannot query production app tables directly."
        },
        "concepts": [
          {
            "title": {
              "id": "Analogi Restoran Cepat Saji (Membedakan Peran di Dunia Data)",
              "en": "The Restaurant Analogy (Distinguishing Roles in Data)"
            },
            "content": {
              "id": "Bayangkan restoran burger:\n1. Software Engineer = Pelayan & Kasir. Tugasnya melayani pesanan pelanggan di kasir secepat mungkin (aplikasi e-commerce, web, HP).\n2. Data Engineer = Truk Logistik, Gudang Pusat, dan Sistem Distribusi Rantai Pasok. Mengambil bahan mentah dari ratusan cabang, mencuci sayuran kotor, membekukan daging, dan memastikan pasokan tiba di dapur analitik tepat waktu setiap pagi tanpa membuat kasir kewalahan.\n3. Data Analyst = Konsultan Menu. Menganalisis laporan penjualan untuk memberi tahu manajer: 'Burger varian apa yang paling laku bulan ini?'.\n4. Data Scientist = Koki Riset & Inovasi (R&D). Menggunakan algoritma untuk memprediksi: 'Berapa banyak stok roti yang harus disiapkan saat hujan deras minggu depan?'.",
              "en": "Imagine a fast-food chain:\n1. Software Engineers = Cashiers & Waiters. Their job is serving customer orders as fast as possible on the app or terminal.\n2. Data Engineers = Logistics Fleet, Central Warehouse, and Supply Chain. They collect raw ingredients from hundreds of branches, clean dirty data, and deliver fresh, structured supplies to analytical kitchens every morning without overloading the cashiers.\n3. Data Analysts = Menu Consultants. They analyze sales figures to tell leadership which items sell best.\n4. Data Scientists = R&D Chefs. They build predictive algorithms to forecast demand based on weather, pricing, and seasonality."
            }
          },
          {
            "title": {
              "id": "Mengapa Database Toko (OLTP) Tidak Boleh Dipakai Buat Laporan?",
              "en": "Why Transactional Databases (OLTP) Must Not Be Queried for Heavy Analytics"
            },
            "content": {
              "id": "Database aplikasi utama (seperti PostgreSQL/MySQL) didesain untuk transaksi satuan yang cepat (OLTP - Online Transaction Processing), seperti 'Simpan 1 pesanan baru'. Jika Anda menjalankan query berat seperti 'Hitung total omset 3 tahun terakhir dari 50 juta transaksi' langsung di database kasir, database kasir akan hang/terkunci, dan pembeli lain tidak bisa bayar! Inilah alasan diciptakan Data Warehouse / Lakehouse (OLAP - Online Analytical Processing) yang terpisah.",
              "en": "Production application databases (like PostgreSQL or MySQL) are optimized for single-record transactional operations (OLTP). If an analyst runs a heavy query across 50 million rows directly on the primary OLTP database, it locks tables, depletes memory, and crashes customer checkout. This is why analytical systems (OLAP warehouses and lakehouses) exist separately."
            }
          },
          {
            "title": {
              "id": "Perjalanan Sebuah Data (Dari Layar HP sampai Laporan CEO)",
              "en": "The Lifecycle of Data (From Mobile Screen to CEO Report)"
            },
            "content": {
              "id": "1. Event Source: User klik 'Beli' di aplikasi HP.\n2. Ingestion: Data pesanan dikirim lewat jaringan ke API backend.\n3. Processing/ETL: Data kotor dibersihkan, format tanggal distandarisasi, dan divalidasi.\n4. Storage/Warehouse: Data disimpan di gudang data analitik yang rapi dan terindeks.\n5. Consumption: Data disajikan ke dashboard BI (Tableau, Metabase) atau model AI.",
              "en": "1. Event Source: User clicks 'Buy' on their mobile phone.\n2. Ingestion: The order payload is transmitted over the network via APIs.\n3. Processing/ETL: Raw data is validated, schema-enforced, and transformed.\n4. Storage/Warehouse: Clean, structured data is persisted in analytical tables.\n5. Consumption: Metrics are visualized on BI dashboards or fed into ML models."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Melacak Aliran Data Nyata Sederhana",
            "en": "Hands-on Lab: Tracing a Minimal Data Pipeline"
          },
          "description": {
            "id": "Jalankan skrip Python mini yang mensimulasikan data transaksi masuk, membersihkan nama pelanggan yang hurufnya acak-acakan, memfilter data rusak, dan menghitung total omset.",
            "en": "Run a minimal Python script simulating incoming transaction events, cleaning inconsistent customer names, discarding malformed rows, and calculating total revenue."
          },
          "codeSnippet": "# mini_pipeline.py - Pipeline data pertamamu!\nraw_transactions = [\n    {\"order_id\": \"ORD001\", \"customer\": \"  budi santoso  \", \"amount\": \"150000\", \"status\": \"PAID\"},\n    {\"order_id\": \"ORD002\", \"customer\": \"SITI AMINAH\", \"amount\": \"200000\", \"status\": \"PAID\"},\n    {\"order_id\": \"ORD003\", \"customer\": \"anto\", \"amount\": \"invalid_number\", \"status\": \"FAILED\"},\n    {\"order_id\": \"ORD004\", \"customer\": \"  budi santoso  \", \"amount\": \"300000\", \"status\": \"PAID\"}\n]\n\nclean_data = []\ntotal_revenue = 0\n\nfor tx in raw_transactions:\n    if tx[\"status\"] == \"PAID\":\n        try:\n            clean_name = tx[\"customer\"].strip().title()\n            amount_numeric = int(tx[\"amount\"])\n            clean_data.append({\"customer\": clean_name, \"amount\": amount_numeric})\n            total_revenue += amount_numeric\n        except ValueError:\n            print(f\"Melewati data rusak: {tx}\")\n\nprint(f\"Transaksi Bersih: {clean_data}\")\nprint(f\"Total Omset: Rp {total_revenue:,}\")",
          "deliverables": [
            {
              "id": "Menjalankan skrip Python pertama tanpa error",
              "en": "Run the initial Python pipeline without errors"
            },
            {
              "id": "Memahami konsep: Ekstraksi -> Transformasi -> Pemuatan",
              "en": "Understand the pattern: Extract -> Transform -> Load"
            },
            {
              "id": "Melihat penanganan defensif terhadap data rusak",
              "en": "Observe defensive handling of malformed records"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: 'Database Toko Macet Karena Query Laporan'",
            "en": "Chaos Scenario: Production Database Locks Up from Analytical Query"
          },
          "scenario": {
            "id": "Seorang analis magang menjalankan query 'SELECT * FROM transactions' tanpa batas tanggal pada jam 12 siang saat flash sale. Server database kasir utama mendadak lambat 100x lipat dan ratusan pembeli gagal checkout.",
            "en": "An intern runs 'SELECT * FROM transactions' with no date filter at 12:00 PM during a flash sale. The primary OLTP database locks up and hundreds of customer checkout attempts fail."
          },
          "breakageReason": {
            "id": "Menggabungkan beban analitik berat ke dalam database transaksional operasional yang sedang melayani user aktif.",
            "en": "Combining heavy analytical full-table scans with high-throughput transactional OLTP workloads."
          },
          "fixGuide": {
            "id": "1. Segera batalkan (KILL) query analitik yang membebani master.\n2. Siapkan Read-Replica terpisah yang khusus melayani pembacaan data.\n3. Bangun pipeline Data Engineering yang mengekstrak data berkala ke Data Warehouse agar analis tidak pernah menyentuh database operasional.",
            "en": "1. Terminate (KILL) the offending query on the primary database.\n2. Configure an isolated Read-Replica for ad-hoc queries.\n3. Implement a proper data pipeline syncing data to an analytical warehouse."
          },
          "defensivePattern": {
            "id": "Prinsip Emas DE: Jangan pernah jalankan query analitik langsung di database produksi OLTP!",
            "en": "Golden Rule of DE: Never execute analytical full scans directly on transactional OLTP databases."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Apa perbedaan paling mendasar antara tanggung jawab Data Engineer dan Data Analyst?",
              "en": "What is the core distinction between a Data Engineer and a Data Analyst?"
            },
            "options": [
              {
                "id": "Data Engineer membuat grafik dashboard, Data Analyst memperbaiki server.",
                "en": "Data Engineers build dashboards, while Data Analysts fix servers."
              },
              {
                "id": "Data Engineer membangun pipa & fondasi infrastruktur agar data mengalir bersih dan andal, sedangkan Data Analyst menggunakan data tersebut untuk menjawab pertanyaan bisnis.",
                "en": "Data Engineers build the infrastructure and reliable pipelines, while Data Analysts query that data to answer business questions."
              },
              {
                "id": "Data Engineer hanya bekerja dengan Excel.",
                "en": "Data Engineers only use Excel spreadsheets."
              },
              {
                "id": "Tidak ada perbedaan sama sekali.",
                "en": "There is no difference between them."
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Data Engineer adalah arsitek dan tukang pipa data, sedangkan Data Analyst adalah konsumen data yang mencari wawasan bisnis.",
              "en": "Data Engineers are the architects and pipeline builders, while Data Analysts analyze the data to guide business decisions."
            }
          }
        ]
      },
      {
        "id": "mod-0-2",
        "number": "0.2",
        "title": {
          "id": "Setup Mesin Perang Pemula: Terminal, Python & Git",
          "en": "Beginner Environment Setup: Terminal, Python & Git"
        },
        "duration": {
          "id": "1-2 Minggu",
          "en": "1-2 Weeks"
        },
        "summary": {
          "id": "Hilangkan rasa takut pada layar hitam terminal. Kuasai navigasi folder dasar, Python virtual environment, dan cara menyimpan riwayat kode dengan Git.",
          "en": "Overcome fear of the command line. Master essential directory navigation, Python virtual environments, and source control with Git."
        },
        "whyTutorialsLie": {
          "id": "Tutorial sering menganggap pemula sudah paham 'tambahkan ke PATH' atau 'install dependensi'. Begitu muncul error kecil seperti 'command not found', pemula langsung merasa bodoh dan menyerah.",
          "en": "Tutorials assume beginners already know how to configure PATH variables and manage environments. When an error like 'command not found' appears, beginners get discouraged and give up."
        },
        "concepts": [
          {
            "title": {
              "id": "Mengapa Engineer Memakai Terminal daripada Mouse?",
              "en": "Why Engineers Use Terminals Over Mice"
            },
            "content": {
              "id": "Di server cloud tanpa monitor, Anda tidak punya tombol klik atau ikon desktop. Semua instruksi diberikan lewat teks terminal. Menguasai 5 perintah dasar terminal (`pwd`, `ls`, `cd`, `mkdir`, `cat`) sudah membuka 80% kemampuan navigasi sistem operasi.",
              "en": "On remote cloud servers, there is no graphical desktop or mouse cursor. Everything is controlled via the CLI. Mastering five core commands (`pwd`, `ls`, `cd`, `mkdir`, `cat`) unlocks 80% of daily navigation."
            }
          },
          {
            "title": {
              "id": "Python Virtual Environment (Kenapa Ruang Kerja Harus Rapi)",
              "en": "Python Virtual Environments (Why Isolation Matters)"
            },
            "content": {
              "id": "Jika Anda menginstall semua library langsung di laptop utama, versi library proyek A bisa bentrok dengan proyek B. Virtual Environment (`venv`) ibarat membuat ruangan tertutup khusus untuk proyek Anda, sehingga instalasi paket tidak mencemari sistem laptop.",
              "en": "Installing packages globally causes conflicting dependencies between projects. Virtual environments create isolated sandboxes for each project so package versions never collide."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Misi Pertama Terminal dan Lingkungan Python",
            "en": "Hands-on Lab: First Terminal Navigation and Python Environment"
          },
          "description": {
            "id": "Buka terminal Anda, buat folder proyek baru menggunakan command line, siapkan lingkungan Python virtual (venv), dan verifikasi instalasi.",
            "en": "Open your terminal, create a project folder using CLI commands, initialize a Python virtual environment, and verify package isolation."
          },
          "codeSnippet": "# 1. Cek direktori saat ini\npwd\n\n# 2. Buat folder proyek baru\nmkdir -p ~/data_projects/lab0\ncd ~/data_projects/lab0\n\n# 3. Buat dan aktifkan virtual environment\npython3 -m venv venv\nsource venv/bin/activate\n\n# 4. Verifikasi versi python aktif\npython --version",
          "deliverables": [
            {
              "id": "Menavigasi folder via terminal",
              "en": "Navigate directories via terminal"
            },
            {
              "id": "Mengaktifkan dan menonaktifkan virtual environment",
              "en": "Activate and deactivate Python virtual environments"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: 'ModuleNotFoundError & Command Not Found'",
            "en": "Chaos Scenario: ModuleNotFoundError and Environment Confusion"
          },
          "scenario": {
            "id": "Anda menulis skrip yang menggunakan library 'requests', tapi saat dijalankan muncul pesan: 'ModuleNotFoundError: No module named requests'.",
            "en": "You write a script importing 'requests', but running it returns: 'ModuleNotFoundError: No module named requests'."
          },
          "breakageReason": {
            "id": "Library belum diinstall di dalam virtual environment yang sedang aktif, atau skrip dijalankan di luar environment tersebut.",
            "en": "The dependency was not installed inside the active virtual environment, or the script was run with the wrong Python interpreter."
          },
          "fixGuide": {
            "id": "1. Pastikan tanda (venv) aktif di terminal.\n2. Jalankan: pip install requests.\n3. Jalankan kembali skrip dengan interpreter yang sesuai.",
            "en": "1. Verify (venv) is active in your prompt.\n2. Run: pip install requests.\n3. Execute the script again with the active interpreter."
          },
          "defensivePattern": {
            "id": "Selalu kunci dependensi ke dalam file requirements.txt.",
            "en": "Always pin dependencies in a version-controlled requirements.txt."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Perintah terminal apa yang digunakan untuk melihat daftar file di folder saat ini?",
              "en": "Which command lists the files and directories in your current folder?"
            },
            "options": [
              {
                "id": "ls (pada Linux/Mac)",
                "en": "ls (on Linux/Mac)"
              },
              {
                "id": "cd",
                "en": "cd"
              },
              {
                "id": "pwd",
                "en": "pwd"
              },
              {
                "id": "mkdir",
                "en": "mkdir"
              }
            ],
            "correct": 0,
            "explanation": {
              "id": "ls (list) menampilkan seluruh file dan folder di lokasi aktif Anda.",
              "en": "ls lists files and directories in your active working directory."
            }
          }
        ]
      },
      {
        "id": "mod-0-3",
        "number": "0.3",
        "title": {
          "id": "Database & SQL 101: Mengapa Excel Gagal di Data Besar",
          "en": "Database & SQL 101: Why Excel Fails at Scale"
        },
        "duration": {
          "id": "2 Minggu",
          "en": "2 Weeks"
        },
        "summary": {
          "id": "Pahami batasan Excel, anatomi tabel database (Baris, Kolom, Primary Key, Foreign Key), dan kuasai query SQL dasar (SELECT, WHERE, GROUP BY, JOIN).",
          "en": "Understand Excel limitations, table anatomy (Rows, Columns, Primary Keys, Foreign Keys), and master core SQL syntax (SELECT, WHERE, GROUP BY, JOIN)."
        },
        "whyTutorialsLie": {
          "id": "Tutorial sering mengajarkan SQL seperti menghafal rumus matematika abstrak. Di dunia nyata, SQL adalah bahasa percakapan logis untuk menanyakan pertanyaan bisnis ke database.",
          "en": "Tutorials treat SQL like abstract syntax drills. In production, SQL is how engineers converse logically with databases to answer operational questions."
        },
        "concepts": [
          {
            "title": {
              "id": "Mengapa Excel Gagal Ketika Data Membesar?",
              "en": "Why Excel Fails as Data Grows"
            },
            "content": {
              "id": "1. Batas Keras Baris: Excel hanya mampu menampung 1.048.576 baris.\n2. Crash Memori: File Excel 500 MB membuat laptop hang.\n3. Integritas Lemah: Siapa saja bisa tidak sengaja mengetik huruf di kolom harga atau merusak formula.\nDatabase dirancang untuk mengelola miliaran baris dengan aturan tipe data yang ketat dan kecepatan tinggi.",
              "en": "1. Hard Row Limit: Excel caps at 1,048,576 rows.\n2. Memory Exhaustion: A 500MB spreadsheet freezes consumer laptops.\n3. Poor Integrity: Anyone can accidentally paste text into numeric columns.\nDatabases are engineered to process billions of rows reliably with ACID consistency."
            }
          },
          {
            "title": {
              "id": "Anatomi Tabel Relasional (KTP dan Relasi)",
              "en": "Relational Table Anatomy (Keys and Relations)"
            },
            "content": {
              "id": "- Primary Key (PK): Seperti NIK/KTP. Nilai unik yang tidak boleh kembar dan tidak boleh kosong, penanda sah satu baris data.\n- Foreign Key (FK): Nomor NIK yang dipinjam di tabel lain untuk menghubungkan relasi antar entitas (misal kolom customer_id di tabel pesanan).",
              "en": "- Primary Key (PK): Unique, non-null identifier for a row.\n- Foreign Key (FK): References a Primary Key in another table to establish logical relationships."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Query SQL Bisnis Pertama Anda",
            "en": "Hands-on Lab: First Business SQL Queries"
          },
          "description": {
            "id": "Tulis query SQL untuk mengekstrak omset toko dan menggabungkan tabel pelanggan dengan tabel pesanan menggunakan JOIN.",
            "en": "Write SQL queries aggregating order volume and combining customer dimensions with transaction facts using JOINs."
          },
          "codeSnippet": "-- 1. Filter transaksi sukses\nSELECT customer_id, amount \nFROM orders \nWHERE status = 'COMPLETED';\n\n-- 2. Agregasi omset per pelanggan\nSELECT \n    c.name,\n    COUNT(o.order_id) AS total_orders,\n    SUM(o.amount) AS total_spent\nFROM customers c\nINNER JOIN orders o ON c.customer_id = o.customer_id\nWHERE o.status = 'COMPLETED'\nGROUP BY c.name\nORDER BY total_spent DESC;",
          "deliverables": [
            {
              "id": "Menulis query SELECT, WHERE, GROUP BY tanpa typo",
              "en": "Write syntactically clean SELECT, WHERE, GROUP BY queries"
            },
            {
              "id": "Memahami hasil penggabungan INNER JOIN",
              "en": "Interpret result sets produced by INNER JOINs"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: 'Nilai NULL Misterius yang Merusak Rata-rata'",
            "en": "Chaos Scenario: Silent NULL Values Skewing Aggregations"
          },
          "scenario": {
            "id": "Anda menjalankan AVG(discount) untuk menghitung diskon bulanan. Banyak baris bernilai NULL sehingga diabaikan oleh database, menghasilkan rata-rata yang salah total.",
            "en": "You run AVG(discount) to compute average promotional discount. NULL values are ignored by the aggregation function, severely overestimating true business discount rates."
          },
          "breakageReason": {
            "id": "Dalam SQL, NULL berarti ketiadaan nilai (unknown), bukan angka 0. AVG() mengabaikan baris NULL.",
            "en": "In SQL, NULL represents unknown/missing data, not numeric 0. AVG() drops NULL rows from the denominator."
          },
          "fixGuide": {
            "id": "Gunakan COALESCE(discount, 0) untuk mengganti nilai NULL dengan angka 0 sebelum dihitung.",
            "en": "Use COALESCE(discount, 0) to replace NULLs with 0 before passing to the aggregation function."
          },
          "defensivePattern": {
            "id": "Waspadai nilai NULL dalam perhitungan numerik; gunakan COALESCE secara eksplisit.",
            "en": "Always account for NULL semantics in arithmetic; wrap with COALESCE defensively."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Apa arti dari nilai NULL dalam SQL?",
              "en": "What does a NULL value represent in SQL?"
            },
            "options": [
              {
                "id": "Angka nol (0)",
                "en": "The number zero (0)"
              },
              {
                "id": "Teks kosong ('')",
                "en": "An empty string ('')"
              },
              {
                "id": "Ketiadaan nilai atau nilai yang belum diketahui",
                "en": "The absence of a value or unknown data"
              },
              {
                "id": "Sebuah pesan error",
                "en": "An error code"
              }
            ],
            "correct": 2,
            "explanation": {
              "id": "NULL merepresentasikan ketiadaan nilai (unknown value), bukan angka 0.",
              "en": "NULL represents missing or unknown data, distinct from zero or an empty string."
            }
          }
        ]
      }
    ]
  },
  {
    "levelId": "beginner",
    "levelTitle": {
      "id": "Level 1: Fondasi Rekayasa (The Software Engineering Mindset)",
      "en": "Level 1: Foundations (The Software Engineering Mindset)"
    },
    "levelSubtitle": {
      "id": "Tinggalkan notebook rapuh. Pelajari Linux, Python produksi, SQL tingkat lanjut, dan pemodelan dimensional.",
      "en": "Stop writing brittle notebooks. Learn Linux, production Python, advanced SQL, and dimensional modeling."
    },
    "badge": {
      "id": "Fondasi Rekayasa",
      "en": "Foundations"
    },
    "badgeColor": "emerald",
    "modules": [
      {
        "id": "mod-1-1",
        "number": "1.1",
        "title": {
          "id": "Linux, Shell Scripting & Docker untuk Data Engineer",
          "en": "Linux, Shell Scripting & Docker for Data Engineers"
        },
        "duration": {
          "id": "2-3 Minggu",
          "en": "2-3 Weeks"
        },
        "summary": {
          "id": "Kuasai pipa streaming, parsing log berkecepatan tinggi dengan awk/sed/jq, dan kontainerisasi pipeline data dengan Docker.",
          "en": "Master pipes, streams, log processing with awk/sed/jq, and containerize data workflows with Docker."
        },
        "whyTutorialsLie": {
          "id": "Tutorial menjalankan skrip di terminal laptop dengan akses root dan file 10 MB. Di produksi, pipeline berjalan di kontainer dengan RAM 512 MB, memproses log 20 GB, dan mati dengan Exit code 137 (OOMKilled) jika memori tidak dikelola.",
          "en": "Tutorials run everything in a local terminal where permissions are root and files are 10MB. In production, your pipeline runs in a minimal container with 512MB RAM, processes 20GB of malformed logs, and dies with exit code 137 (OOMKilled) if unmanaged."
        },
        "concepts": [
          {
            "title": {
              "id": "Standard Streams & Pipe Non-Blocking (64KB Buffer)",
              "en": "Standard Streams & Non-Blocking Pipes (64KB Buffer)"
            },
            "content": {
              "id": "Pahami stdin (0), stdout (1), stderr (2). Perintah cat file | grep | awk dapat mengalirkan gigabyte data melalui memori tanpa menulis ke disk, memanfaatkan buffer Linux pipe (biasanya 64KB).",
              "en": "Understand stdin (0), stdout (1), stderr (2). Why pipeline commands stream gigabytes through memory without writing intermediate files to disk via pipe buffers (typically 64KB)."
            }
          },
          {
            "title": {
              "id": "Parsing Teks Berkecepatan Tinggi (awk, sed, jq)",
              "en": "High-Performance Text Wrangling (awk, sed, jq)"
            },
            "content": {
              "id": "Memproses log JSON dan CSV gigabyte tanpa menjalankan Python. Memakai jq untuk filter JSON streaming dan awk untuk agregasi kolumnar dalam hitungan milidetik.",
              "en": "Processing gigabyte-scale JSON and CSV logs without booting Python. Using jq for streaming JSON filtering and awk for columnar aggregations in milliseconds."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Mesin Ingestion Log Streaming Terkontainerisasi",
            "en": "Hands-on Lab: Containerized Streaming Log Ingestion Engine"
          },
          "description": {
            "id": "Bangun pipeline terkontainerisasi yang memantau file log web gzipped, melakukan dekompresi streaming, mem-parsing metrik JSON via bash dan jq, dan menghasilkan CSV bersih siap muat.",
            "en": "Build a containerized pipeline that monitors gzipped web server logs, streams and uncompresses them in memory, parses structured JSON metrics via bash and jq, and outputs normalized CSV records."
          },
          "codeSnippet": "#!/usr/bin/env bash\nset -euo pipefail\n\nINPUT_DIR=\"${1:-/data/incoming}\"\nOUTPUT_FILE=\"${2:-/data/processed/metrics_$(date +%Y%m%d).csv}\"\n\necho \"timestamp,ip_address,endpoint,status_code,duration_ms\" > \"$OUTPUT_FILE\"\n\nfind \"$INPUT_DIR\" -name \"*.log.gz\" -print0 | while IFS= read -r -d '' file; do\n    zcat \"$file\" | jq -r -c 'select(.status >= 200) | [.timestamp, .client_ip, .path, .status, .duration_ms] | @csv' >> \"$OUTPUT_FILE\"\ndone",
          "deliverables": [
            {
              "id": "Dockerfile minimalis dengan bash dan jq",
              "en": "Minimal Dockerfile with bash and jq"
            },
            {
              "id": "Skrip bash dengan error handling ketat (set -euo pipefail)",
              "en": "Bash script with strict error handling (set -euo pipefail)"
            },
            {
              "id": "Nol footprint disk sementara saat dekompresi",
              "en": "Zero intermediate disk footprint during decompression"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Ledakan Multi-Line Stack Trace & Disk Penuh",
            "en": "Chaos Scenario: Multi-Line Stack Trace Explosion & Disk Exhaustion"
          },
          "scenario": {
            "id": "Aplikasi upstream menulis stack trace Java multi-line langsung ke file JSON log. Parser jq Anda crash dan scratch disk kontainer terisi 100%, memicu restart pod berturut-turut.",
            "en": "An upstream microservice writes multi-line Java stack traces directly into the JSON log. Your jq parser crashes and scratch disk fills to 100%, causing cascading pod restarts."
          },
          "breakageReason": {
            "id": "Skrip mengasumsikan JSON satu baris murni (ndjson). Karakter newline merusak spesifikasi ndjson.",
            "en": "The ingestion script assumed strictly single-line JSON (ndjson). Multi-line stack traces violate ndjson format."
          },
          "fixGuide": {
            "id": "1. Buat stream pre-filter dengan awk untuk membuang atau melipat baris rusak.\n2. Alihkan baris rusak ke Dead-Letter Queue (DLQ).\n3. Pasang trap handler (trap 'cleanup' EXIT INT TERM) untuk membersihkan file sementara.",
            "en": "1. Implement a pre-filtering stream buffer with awk.\n2. Route corrupted lines to a quarantine Dead-Letter Queue (DLQ).\n3. Add a trap handler to guarantee temporary file cleanup on exit."
          },
          "defensivePattern": {
            "id": "Jangan pernah berasumsi log 100% patuh skema. Pisahkan aliran valid dari karantina.",
            "en": "Never assume logs are 100% compliant. Always isolate valid streams from quarantine sinks."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa 'set -euo pipefail' penting di awal skrip bash data pipeline?",
              "en": "Why is 'set -euo pipefail' critical at the beginning of bash data pipeline scripts?"
            },
            "options": [
              {
                "id": "Mengaktifkan multi-threading di bash",
                "en": "Enables multi-threading in bash subshells"
              },
              {
                "id": "Membuat skrip berhenti jika ada perintah gagal, variabel tak terdefinisi diakses, atau command dalam pipe gagal",
                "en": "Ensures the script aborts if any command fails, undefined variables are read, or piped commands fail"
              },
              {
                "id": "Mengompresi output otomatis",
                "en": "Compresses output streams automatically"
              },
              {
                "id": "Memberi izin root",
                "en": "Grants root privileges"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "set -e menghentikan skrip jika ada error, set -u mencegah variabel kosong, set -o pipefail memastikan error di tengah pipe tetap ditangkap.",
              "en": "set -e exits on command errors, set -u treats unset variables as errors, and pipefail captures failures in intermediate pipeline stages."
            }
          }
        ]
      },
      {
        "id": "mod-1-2",
        "number": "1.2",
        "title": {
          "id": "Python Standar Rekayasa Produksi untuk Data Engineer",
          "en": "Production Python for Data Engineering"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Tinggalkan notebook rapuh. Bangun generator memori konstan O(1), validasi skema ketat dengan Pydantic v2, dan automated unit testing dengan pytest.",
          "en": "Write memory-efficient streaming generators, enforce schemas with Pydantic v2, and build automated pytest test suites."
        },
        "whyTutorialsLie": {
          "id": "Bootcamp mengajarkan 'import pandas as pd; df = pd.read_csv('file.csv')'. Di produksi, Anda punya dump transaksi 40 GB dan server worker hanya punya RAM 2 GB. Pandas memakan memori 4-6x lipat dan langsung membuat server OOMKilled.",
          "en": "Bootcamps teach pandas read_csv on tiny files. In production, you have a 40GB daily event dump and a 2GB RAM container. Pandas consumes 4-6x the file size in memory and immediately crashes your worker."
        },
        "concepts": [
          {
            "title": {
              "id": "Streaming Efisien Memori dengan Python Generators (O(1) Memory)",
              "en": "Memory-Efficient Streaming with Python Generators (O(1) Memory)"
            },
            "content": {
              "id": "Menggunakan yield dan itertools untuk memproses jutaan baris data satu per satu atau dalam chunk kecil dengan beban RAM konstan tanpa pernah memuat seluruh file ke memori.",
              "en": "Using yield and itertools to process millions of records with constant O(1) memory overhead instead of loading whole collections."
            }
          },
          {
            "title": {
              "id": "Data Contracts & Validasi Skema dengan Pydantic v2",
              "en": "Data Contracts & Schema Validation with Pydantic v2"
            },
            "content": {
              "id": "Memanfaatkan Pydantic v2 (berbasis Rust) untuk memvalidasi record di gerbang pipeline. Mem-parsing JSON mentah menjadi model bertipe ketat dengan validator custom.",
              "en": "Using Pydantic v2 (Rust-backed) to validate records at the boundary of your pipeline with strict types and coercion rules."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Pipeline Ingestion Resilien dengan Kontrak Skema",
            "en": "Hands-on Lab: Resilient Stream Ingestion Pipeline with Schema Contracts"
          },
          "description": {
            "id": "Bangun pipeline ETL Python yang men-stream record webhook, memvalidasi tiap record ke model Pydantic, dan memisahkan data rusak ke Dead-Letter File.",
            "en": "Build a Python ETL pipeline streaming records, validating against strict Pydantic models, and routing corrupt records to a quarantine dead-letter file."
          },
          "codeSnippet": "from typing import Iterator, Dict, Any, Tuple\nfrom pydantic import BaseModel, Field, field_validator\nimport json\n\nclass OrderEvent(BaseModel):\n    order_id: str = Field(..., min_length=5)\n    amount: float = Field(..., gt=0.0)\n    currency: str = Field(default=\"USD\")\n\ndef process_stream(lines: Iterator[str]) -> Iterator[Tuple[bool, Dict[str, Any]]]:\n    for line in lines:\n        try:\n            event = OrderEvent(**json.loads(line))\n            yield (True, event.model_dump())\n        except Exception as e:\n            yield (False, {\"raw\": line.strip(), \"error\": str(e)})",
          "deliverables": [
            {
              "id": "Skema Pydantic v2 dengan custom validators",
              "en": "Pydantic v2 schema with custom validators"
            },
            {
              "id": "Generator berbasis chunk dengan memori konstan",
              "en": "Generator-based pipeline with constant memory"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Tipe Data Bermutasi & Silent NaN Corruption",
            "en": "Chaos Scenario: Upstream Type Mutation & Silent NaN Corruption"
          },
          "scenario": {
            "id": "Provider upstream mendadak mengirim kolom amount dalam bentuk string berformat kurs ('$1,450.00') dan nilai string 'null'. Pipeline tanpa validasi memuat NaN yang merusak agregasi omset bulanan.",
            "en": "An upstream payment provider sends amount as formatted strings ('$1,450.00') and occasional string 'null'. An unvalidated pipeline silently loads NaN, corrupting revenue metrics."
          },
          "breakageReason": {
            "id": "Ketiadaan koersi tipe defensif dan tidak adanya data contract di gerbang ingestion.",
            "en": "Lack of defensive type coercion and absence of schema contracts at ingestion boundaries."
          },
          "fixGuide": {
            "id": "1. Tambahkan @field_validator(mode='before') untuk membersihkan simbol mata uang.\n2. Tolak string 'null' secara eksplisit.\n3. Tambahkan unit test pytest untuk memverifikasi berbagai variasi format angka.",
            "en": "1. Add a before field validator stripping currency symbols.\n2. Reject explicit 'null' strings.\n3. Add pytest cases asserting malformed inputs are quarantined."
          },
          "defensivePattern": {
            "id": "Validasi di gerbang depan. Jangan biarkan data eksternal kotor masuk ke data mart.",
            "en": "Validate at the gate. Never allow unvalidated external data into internal marts."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa Python generator memakai memori jauh lebih sedikit dibanding list biasa?",
              "en": "Why does a Python generator consume significantly less memory than a list?"
            },
            "options": [
              {
                "id": "Generator mengompilasi kode Python ke bahasa C",
                "en": "Generators compile Python code to C"
              },
              {
                "id": "Generator mengevaluasi item secara lazy satu per satu saat diminta (yield), bukan memuat semua ke RAM",
                "en": "Generators evaluate items lazily on demand, storing only one item in memory at a time"
              },
              {
                "id": "Generator mengompresi data dengan gzip",
                "en": "Generators compress memory with gzip"
              },
              {
                "id": "Generator menonaktifkan GIL",
                "en": "Generators bypass the Global Interpreter Lock"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Generators menggunakan lazy evaluation sehingga konsumsi memori konstan O(1) tidak peduli berapa juta baris yang diproses.",
              "en": "Generators evaluate lazily, keeping memory consumption constant O(1) regardless of dataset scale."
            }
          }
        ]
      },
      {
        "id": "mod-1-3",
        "number": "1.3",
        "title": {
          "id": "Penguasaan SQL Tingkat Lanjut & Analisis Execution Plan",
          "en": "Advanced SQL Mastery & Execution Plans"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Kuasai window functions, deteksi streak Gaps and Islands, sessionization klik, analisis EXPLAIN ANALYZE, dan penalaan indeks.",
          "en": "Master window functions, recursive CTEs, query profiling with EXPLAIN ANALYZE, and index tuning."
        },
        "whyTutorialsLie": {
          "id": "Tutorial hanya mengajarkan query sederhana pada data kecil. Di sistem riil, query yang cepat di 10.000 baris tiba-tiba time out saat tabel membengkak jadi 100 juta baris akibat Nested Loop join pada kolom tanpa indeks.",
          "en": "Tutorials test basic SELECT and WHERE. In production, a query that was fast on 10k rows times out on 100M rows due to a nested loop join on an unindexed column."
        },
        "concepts": [
          {
            "title": {
              "id": "Window Functions & Frame Specification (ROWS vs RANGE)",
              "en": "Advanced Window Functions & Frame Specifications"
            },
            "content": {
              "id": "Penguasaan mendalam ROWS BETWEEN vs RANGE BETWEEN, running totals, moving averages, dan fungsi pemeringkat (DENSE_RANK, ROW_NUMBER, NTILE).",
              "en": "Deep mastery of ROWS BETWEEN and RANGE BETWEEN, cumulative sums, moving averages, and ranking functions (DENSE_RANK, ROW_NUMBER, NTILE)."
            }
          },
          {
            "title": {
              "id": "Query Profiling dengan EXPLAIN ANALYZE",
              "en": "Query Profiling with EXPLAIN ANALYZE"
            },
            "content": {
              "id": "Membedah execution plan: Sequential Scan vs Index Scan, Nested Loop vs Hash Join vs Merge Join. Menemukan titik di mana estimasi baris meleset jauh dari baris riil.",
              "en": "Interpreting execution plans: Sequential Scan vs Index Scan, Nested Loop vs Hash Join. Identifying bottlenecks where estimated rows diverge from actual rows."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Mesin Sessionization Klik Pengguna",
            "en": "Hands-on Lab: Real-Time User Click Sessionization Engine"
          },
          "description": {
            "id": "Tulis query SQL berkinerja tinggi yang membagi klik pengguna berdasarkan batas sesi (inaktivitas > 30 menit) menggunakan window function LAG dan SUM kumulatif.",
            "en": "Write an optimized SQL query partitioning user clicks into sessions based on a 30-minute inactivity threshold using LAG and cumulative SUM."
          },
          "codeSnippet": "WITH lagged_events AS (\n    SELECT user_id, event_time,\n           LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev_time\n    FROM user_clickstream\n),\nsession_flags AS (\n    SELECT user_id, event_time,\n           CASE WHEN prev_time IS NULL OR EXTRACT(EPOCH FROM (event_time - prev_time)) > 1800 THEN 1 ELSE 0 END AS is_new_session\n    FROM lagged_events\n),\nsessionized AS (\n    SELECT user_id, event_time,\n           SUM(is_new_session) OVER (PARTITION BY user_id ORDER BY event_time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_id\n    FROM session_flags\n)\nSELECT user_id, session_id, MIN(event_time) AS session_start, MAX(event_time) AS session_end, COUNT(*) AS clicks\nFROM sessionized\nGROUP BY user_id, session_id;",
          "deliverables": [
            {
              "id": "Query sessionization berbasis window function",
              "en": "Sessionization query using window functions"
            },
            {
              "id": "Perbandingan execution plan sebelum dan sesudah indeks",
              "en": "Execution plan comparison before and after indexing"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Ledakan Cartesian & Disk Spill 80 GB",
            "en": "Chaos Scenario: Cartesian Explosion & Out-of-Disk Spill"
          },
          "scenario": {
            "id": "Analis menggabungkan tabel transaksi ke tabel promosi dengan syarat non-equi (start_date <= txn_date AND end_date >= txn_date). Query berjalan 4 jam dan menumpahkan 80 GB ke disk.",
            "en": "An analyst joins transactions to promotions on non-equi date ranges. As data grows, the query runs for 4 hours, spills 80GB of temp files to disk, and crashes the database."
          },
          "breakageReason": {
            "id": "Non-equi join tidak bisa menggunakan Hash Join tanpa indeks pendukung; database jatuh ke Nested Loop join O(N x M).",
            "en": "Non-equi joins cannot use Hash Joins without indexes; the database falls back to Nested Loop cross products."
          },
          "fixGuide": {
            "id": "1. Ganti non-equi join dengan partisi rentang tanggal.\n2. Buat composite BRIN atau B-Tree index pada (start_date, end_date).\n3. Naikkan work_mem secara hati-hati hanya untuk sesi query tersebut.",
            "en": "1. Replace broad non-equi joins with range partitions.\n2. Create composite BRIN or B-Tree indexes on (start_date, end_date).\n3. Tune work_mem selectively for that specific session."
          },
          "defensivePattern": {
            "id": "Selalu periksa EXPLAIN ANALYZE untuk mendeteksi Nested Loop pada tabel besar.",
            "en": "Always inspect EXPLAIN ANALYZE for nested loops on tables with over 100k rows."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Kapan indeks BRIN (Block Range Index) lebih disukai daripada B-Tree di PostgreSQL?",
              "en": "When is a BRIN index preferred over a B-Tree index in PostgreSQL?"
            },
            "options": [
              {
                "id": "Pada tabel kecil di bawah 100 baris",
                "en": "On small tables under 100 rows"
              },
              {
                "id": "Pada tabel append-only yang sangat besar di mana data tersimpan secara urut waktu di disk",
                "en": "On very large, append-only tables where data is naturally sorted on disk by time"
              },
              {
                "id": "Pada kolom UUID acak",
                "en": "On randomized UUID columns"
              },
              {
                "id": "Saat membutuhkan enkripsi",
                "en": "When encrypting data"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "BRIN menyimpan ringkasan min/max per blok fisik disk. Pada tabel raksasa yang berurutan waktu, BRIN memakan ukuran kurang dari 1% dari B-Tree.",
              "en": "BRIN stores min/max values for ranges of physical pages. On massive time-sorted tables, it takes <1% of the storage of a B-Tree."
            }
          }
        ]
      },
      {
        "id": "mod-1-4",
        "number": "1.4",
        "title": {
          "id": "Pemodelan Data Dimensional & Skema Modern (Kimball)",
          "en": "Dimensional Data Modeling & Modern Schemas"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Kuasai Kimball Star Schema, Facts vs Dimensions, SCD Type 1-6, dan debat arsitektur modern: Star Schema vs One Big Table (OBT).",
          "en": "Master Kimball Star Schemas, Facts vs Dimensions, SCD Types 1-6, and the modern debate: Star Schema vs One Big Table (OBT)."
        },
        "whyTutorialsLie": {
          "id": "Banyak yang mengklaim 'Star schema sudah mati, masukkan saja semua ke One Big Table di Snowflake!'. Di dunia nyata, pendekatan OBT mentah tanpa tata kelola memicu data duplikat, biaya update masif, dan tagihan cloud melonjak.",
          "en": "Tutorials claim star schemas are dead and to dump everything into One Big Table. In real companies, pure OBT leads to duplicate data, massive update costs, and runaway cloud bills."
        },
        "concepts": [
          {
            "title": {
              "id": "Arsitektur Inti Kimball Dimensional Modeling",
              "en": "Core Kimball Dimensional Architecture"
            },
            "content": {
              "id": "Fact Tables (Transaction, Periodic Snapshot, Accumulating Snapshot) dan Dimension Tables (Conformed, Role-Playing, Junk). Membangun Enterprise Data Bus Matrix.",
              "en": "Fact Tables (Transaction, Periodic Snapshot, Accumulating Snapshot) and Dimension Tables (Conformed, Role-Playing, Junk). Building the Enterprise Data Bus Matrix."
            }
          },
          {
            "title": {
              "id": "Slowly Changing Dimensions (SCD Type 1, 2, 3, 4, 6)",
              "en": "Slowly Changing Dimensions (SCD Types 1, 2, 3, 4, 6)"
            },
            "content": {
              "id": "Mengelola riwayat perubahan atribut pelanggan dari waktu ke waktu. Bedah SCD Type 2 dengan valid_from, valid_to, is_current, dan atomic merge logic.",
              "en": "Managing historical attribute changes over time. Deep dive into SCD Type 2 with valid_from, valid_to, and atomic upsert merge logic."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Pipeline SCD Type 2 Idempotent E-Commerce",
            "en": "Hands-on Lab: Enterprise E-Commerce Star Schema & SCD-2 Pipeline"
          },
          "description": {
            "id": "Rancang Star Schema untuk platform e-commerce dan tulis skrip SQL merge idempotent yang menangani perubahan alamat pelanggan via SCD Type 2.",
            "en": "Design a Kimball Star Schema for an e-commerce platform and write an idempotent SQL merge script handling address mutations via SCD Type 2."
          },
          "codeSnippet": "-- SCD Type 2 Idempotent Upsert for Dim_Customer\nUPDATE dim_customer\nSET valid_to = staging.updated_at, is_current = FALSE\nFROM staging_customer staging\nWHERE dim_customer.customer_id = staging.customer_id\n  AND dim_customer.is_current = TRUE\n  AND (dim_customer.address <> staging.address OR dim_customer.tier <> staging.tier);\n\nINSERT INTO dim_customer (customer_id, name, address, tier, valid_from, valid_to, is_current)\nSELECT staging.customer_id, staging.name, staging.address, staging.tier,\n       staging.updated_at, '9999-12-31'::timestamp, TRUE\nFROM staging_customer staging\nLEFT JOIN dim_customer current_dim ON staging.customer_id = current_dim.customer_id AND current_dim.is_current = TRUE\nWHERE current_dim.customer_id IS NULL;",
          "deliverables": [
            {
              "id": "DDL Star Schema dengan surrogate keys",
              "en": "Star Schema DDL with surrogate keys"
            },
            {
              "id": "Skrip upsert SCD Type 2 tanpa baris duplikat",
              "en": "Idempotent SCD Type 2 upsert script"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Race Condition Event Dimensi yang Tiba Terlambat",
            "en": "Chaos Scenario: Out-of-Order Dimension Event Race Condition"
          },
          "scenario": {
            "id": "Event pembaruan alamat pada jam 10:02 tiba lebih lambat daripada event jam 10:00 akibat network latency. Pipeline naif menandai record yang lebih lama sebagai yang aktif, mengacaukan alamat pengiriman.",
            "en": "An event updating address at 10:02 AM arrives after a 10:00 AM event due to network jitter. A naive pipeline marks the older record as current, corrupting customer delivery addresses."
          },
          "breakageReason": {
            "id": "Pipeline mengasumsikan urutan waktu kedatangan di antrean sama dengan urutan waktu kejadian riil (event time).",
            "en": "The pipeline assumed events arrive in strict chronological order and used arrival time instead of source event time."
          },
          "fixGuide": {
            "id": "1. Wajibkan pengurutan berdasarkan event_timestamp sumber.\n2. Hitung valid_to menggunakan window function LEAD(event_timestamp).\n3. Tolak atau karantina update yang lebih lama dari record aktif saat ini.",
            "en": "1. Enforce ordering by source event timestamp.\n2. Compute valid_to strictly using LEAD(event_timestamp).\n3. Quarantine updates older than the currently active record."
          },
          "defensivePattern": {
            "id": "Waktu kejadian (event time) selalu lebih tinggi prioritasnya daripada waktu tiba (arrival time).",
            "en": "Event time always trumps arrival time. Never rely on arrival sequence for historical dimensions."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa surrogate key (kunci buatan) lebih disukai daripada natural business key (seperti email) di tabel dimensi?",
              "en": "Why are surrogate keys preferred over natural business keys in dimension tables?"
            },
            "options": [
              {
                "id": "Karena database tidak mendukung string primary key",
                "en": "Because databases cannot index strings"
              },
              {
                "id": "Untuk mengisolasi warehouse dari mutasi key sumber dan memungkinkan pelacakan historis SCD-2 di mana 1 natural key memiliki banyak versi",
                "en": "To insulate the warehouse from source operational key changes and enable SCD-2 tracking where one natural key has multiple chronological versions"
              },
              {
                "id": "Supaya data otomatis terenkripsi",
                "en": "To automatically encrypt records"
              },
              {
                "id": "Agar query berjalan di RAM",
                "en": "To force queries into memory"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Surrogate key memungkinkan tabel dimensi menyimpan beberapa versi kronologis dari orang yang sama (SCD-2).",
              "en": "Surrogate keys allow the data warehouse to track multiple chronological versions of the same natural key in SCD-2."
            }
          }
        ]
      }
    ]
  },
  {
    "levelId": "intermediate",
    "levelTitle": {
      "id": "Level 2: Arsitektur Lakehouse Modern",
      "en": "Level 2: The Modern Lakehouse & Transformation"
    },
    "levelSubtitle": {
      "id": "Bangun lakehouse mandiri di laptop dengan Apache Iceberg, DuckDB, dbt Core, Dagster, dan Data Contracts.",
      "en": "Build local-first lakehouses with Apache Iceberg, DuckDB, dbt Core, Dagster, and Data Contracts."
    },
    "badge": {
      "id": "Lakehouse & Ops",
      "en": "Lakehouse & Ops"
    },
    "badgeColor": "amber",
    "modules": [
      {
        "id": "mod-2-1",
        "number": "2.1",
        "title": {
          "id": "Komputasi Kolumnar, DuckDB & Polars",
          "en": "Columnar Compute, DuckDB & Polars"
        },
        "duration": {
          "id": "2 Minggu",
          "en": "2 Weeks"
        },
        "summary": {
          "id": "Pahami eksekusi tervektorisasi, memori Apache Arrow, dan jalankan analitik puluhan juta baris di laptop dengan DuckDB dan Polars.",
          "en": "Understand vectorized execution, in-memory Apache Arrow, and run petabyte-scale analytics locally with DuckDB and Polars."
        },
        "whyTutorialsLie": {
          "id": "Banyak materi menyuruh Anda menyewa cluster Spark mahal di AWS EMR untuk data 15 GB. Di tahun 2026, data engineer modern memakai DuckDB dan Polars di laptop untuk menjalankan transformasi dalam hitungan detik dengan biaya cloud $0.",
          "en": "Tutorials make you spin up expensive AWS EMR clusters for 15GB datasets. Top engineers use DuckDB and Polars on single nodes to execute complex transformations in seconds with zero cloud infrastructure bills."
        },
        "concepts": [
          {
            "title": {
              "id": "Penyimpanan Berorientasi Baris vs Kolumnar (Parquet, Arrow)",
              "en": "Row-Oriented vs Columnar Storage (Parquet, Arrow)"
            },
            "content": {
              "id": "Mengapa format kolumnar menghasilkan kompresi 10-50x via Dictionary Encoding dan Bit Packing. Cara column projection dan predicate pushdown menghindari pembacaan 90% byte file.",
              "en": "Why columnar formats achieve 10-50x compression ratios via Dictionary Encoding and Bit Packing, and how projection skips reading 90% of file bytes."
            }
          },
          {
            "title": {
              "id": "Eksekusi Query Tervektorisasi & DuckDB",
              "en": "Vectorized Query Execution & DuckDB"
            },
            "content": {
              "id": "Cara DuckDB memproses data dalam vektor 2.048 baris menggunakan instruksi CPU SIMD. Membaca file Parquet langsung dari S3 tanpa mengunduh seluruh file.",
              "en": "How DuckDB processes data in vectors of 2,048 tuples using SIMD CPU instructions, querying remote S3 Parquet files directly without full downloads."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Analitik Skala 20 Juta Baris di Laptop",
            "en": "Hands-on Lab: Laptop-Scale Analytical Engine on 20 Million Records"
          },
          "description": {
            "id": "Gunakan DuckDB dan Polars untuk memproses data 20 juta baris langsung dari file Parquet terkompresi dengan konsumsi RAM di bawah 400 MB.",
            "en": "Use DuckDB and Polars to query 20 million rows directly from compressed Parquet files in under 3 seconds using less than 400MB RAM."
          },
          "codeSnippet": "import duckdb\nimport polars as pl\n\ncon = duckdb.connect(database=':memory:')\n\nquery = '''\nSELECT vendor_id, DATE_TRUNC('month', pickup_datetime) AS pickup_month,\n       COUNT(*) AS total_trips, ROUND(AVG(trip_distance), 2) AS avg_distance,\n       ROUND(SUM(total_amount), 2) AS total_revenue\nFROM read_parquet('data/yellow_tripdata_*.parquet')\nWHERE passenger_count > 0 AND total_amount > 0\nGROUP BY 1, 2\nORDER BY 2 DESC;\n'''\nresult_df = con.execute(query).pl()\nprint(result_df.head(5))",
          "deliverables": [
            {
              "id": "Skrip perbandingan memori Pandas vs DuckDB vs Polars",
              "en": "Benchmark comparing Pandas vs DuckDB vs Polars memory"
            },
            {
              "id": "Pembuktian predicate pushdown menghemat I/O >85%",
              "en": "Demonstrated predicate pushdown reducing I/O scan by >85%"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: OOM Spill Akibat Ledakan Kolom JSON Bersarang",
            "en": "Chaos Scenario: Out-of-Memory Spill on Nested Schema Explosion"
          },
          "scenario": {
            "id": "Pipeline menginferensi skema secara otomatis pada JSON semi-terstruktur dengan key dinamis yang bervariasi. Kolom meledak menjadi ribuan dan menghabiskan RAM 16 GB.",
            "en": "Your pipeline infers schema on dynamic JSON keys. Column cardinality explodes into thousands of fields, consuming 16GB RAM and crashing."
          },
          "breakageReason": {
            "id": "Key JSON dinamis berubah menjadi kolom baru dalam format kolumnar, memicu ledakan metadata dan memori.",
            "en": "Dynamic JSON keys turn into an explosion of columns in a columnar format, causing catastrophic memory overhead."
          },
          "fixGuide": {
            "id": "1. Jangan pernah inferensi skema otomatis pada data semi-terstruktur mentah.\n2. Simpan pasangan key-value dinamis ke dalam tipe Struct atau Map Arrow.\n3. Gunakan mode Polars lazy streaming (collect(streaming=True)).",
            "en": "1. Never infer dynamic schemas on raw semi-structured streams.\n2. Store arbitrary dynamic keys in Map or Struct types.\n3. Utilize Polars lazy streaming."
          },
          "defensivePattern": {
            "id": "Jangan biarkan user key yang dinamis mendikte skema kolumnar Anda.",
            "en": "Never allow dynamic user keys to dictate your physical columnar schema."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Bagaimana predicate pushdown mempercepat query saat membaca file Parquet?",
              "en": "How does predicate pushdown improve query performance when reading Parquet files?"
            },
            "options": [
              {
                "id": "Mengonversi file ke CSV sebelum dibaca",
                "en": "Converts Parquet files to CSV first"
              },
              {
                "id": "Membaca statistik min/max di metadata file untuk melompati row group yang tidak cocok dengan filter WHERE tanpa membaca isi datanya",
                "en": "Reads file metadata (min/max per row group) to skip row groups that don't match WHERE filters without reading data pages"
              },
              {
                "id": "Menjalankan query di GPU",
                "en": "Runs queries on GPUs"
              },
              {
                "id": "Mendekripsi file otomatis",
                "en": "Decrypts files"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Parquet menyimpan statistik min/max per row group. Predicate pushdown memeriksa ini terlebih dahulu dan melewatkan blok yang tidak relevan dari disk/S3.",
              "en": "Parquet stores min/max statistics per Row Group. Predicate pushdown checks these first and skips irrelevant data blocks entirely."
            }
          }
        ]
      },
      {
        "id": "mod-2-2",
        "number": "2.2",
        "title": {
          "id": "Format Tabel Terbuka: Apache Iceberg & Delta Lake",
          "en": "Open Table Formats: Apache Iceberg & Delta Lake"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Pahami pohon metadata Iceberg dari dasar, transaksi ACID di object storage, time travel, partisi tersembunyi, dan pemeliharaan compaction.",
          "en": "Understand table formats from the ground up: metadata trees, ACID transactions, time travel, and partition evolution."
        },
        "whyTutorialsLie": {
          "id": "Banyak materi memperlakukan data lake hanya sebagai folder Parquet di S3. Tanpa table format, data lake menderita korupsi parsial saat crash, directory listing yang lambat, dan tidak bisa menghapus baris untuk kepatuhan privasi.",
          "en": "Courses treat data lakes as folders of Parquet files in S3. Without table formats, you suffer partial write corruptions, slow directory listings, and impossible GDPR deletions."
        },
        "concepts": [
          {
            "title": {
              "id": "Arsitektur Metadata Apache Iceberg",
              "en": "Apache Iceberg Metadata Tree Architecture"
            },
            "content": {
              "id": "Catalog -> Metadata JSON -> Manifest List -> Manifest Files -> Data Files. Cara Iceberg menggantikan partisi berbasis folder fisik dengan pruning berbasis metadata.",
              "en": "Catalog -> Metadata JSON -> Manifest List -> Manifest Files -> Data Files. How Iceberg abstracts physical directories through metadata pruning."
            }
          },
          {
            "title": {
              "id": "Evolusi Partisi & Hidden Partitioning",
              "en": "Partition Evolution & Hidden Partitioning"
            },
            "content": {
              "id": "Mengapa partisi folder tradisional memecah query pengguna saat memfilter timestamp alami, dan bagaimana hidden partitioning Iceberg menyelesaikannya secara transparan.",
              "en": "Why traditional folder partitioning breaks queries when users filter by natural timestamps, and how hidden partitioning solves this."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Membangun Lakehouse Apache Iceberg di MinIO",
            "en": "Hands-on Lab: Building a Production Apache Iceberg Lakehouse on MinIO"
          },
          "description": {
            "id": "Pasang penyimpanan objek lokal MinIO S3 dan buat tabel Iceberg. Jalankan evolusi skema tanpa menulis ulang data lama dan uji query Time Travel.",
            "en": "Deploy local MinIO S3 storage, create Iceberg tables, evolve schemas without data rewrites, and query historical snapshots using Time Travel."
          },
          "codeSnippet": "from pyiceberg.catalog import load_catalog\nfrom pyiceberg.types import StringType\n\ncatalog = load_catalog(\"local\", **{\n    \"type\": \"sql\", \"uri\": \"sqlite:////tmp/iceberg.db\",\n    \"warehouse\": \"s3://warehouse/\",\n    \"s3.endpoint\": \"http://localhost:9000\",\n    \"s3.access-key-id\": \"minioadmin\",\n    \"s3.secret-access-key\": \"minioadmin\"\n})\n\ntable = catalog.load_table(\"analytics.orders\")\n\n# Evolusi skema: tambah kolom tanpa menulis ulang file Parquet lama\nwith table.update_schema() as update:\n    update.add_column(\"discount_code\", StringType())",
          "deliverables": [
            {
              "id": "Stack Docker MinIO dan Iceberg Catalog",
              "en": "Docker Compose stack with MinIO and Iceberg"
            },
            {
              "id": "Pembuktian time travel membaca snapshot historis",
              "en": "Time travel query reproducing historical state"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Konflik Commit Penulis Konkuren (OCC Conflict)",
            "en": "Chaos Scenario: Concurrent Writer Commit Collision"
          },
          "scenario": {
            "id": "Dua pipeline ETL mencoba menambahkan data ke tabel Iceberg yang sama di detik yang sama. Job B melempar CommitFailedException.",
            "en": "Two ETL jobs append to the same Iceberg table at the exact same second. Job B fails with CommitFailedException."
          },
          "breakageReason": {
            "id": "Iceberg menggunakan Optimistic Concurrency Control (OCC). Jika metadata basis berubah sebelum komit, penulisan ditolak untuk mencegah tumpang tindih data.",
            "en": "Iceberg uses Optimistic Concurrency Control (OCC). If the base snapshot changes before a writer commits, the commit is rejected."
          },
          "fixGuide": {
            "id": "1. Pasang retry policy dengan exponential backoff pada client Iceberg.\n2. Bedakan operasi append yang aman digabung dengan operasi overwrite.\n3. Gunakan coordinator tunggal untuk ingestion streaming kontinu.",
            "en": "1. Configure client retry policy with exponential backoff.\n2. Distinguish append operations from overwrites.\n3. Use a single coordinator for continuous streams."
          },
          "defensivePattern": {
            "id": "Desain pipeline dengan retry otomatis terhadap konflik commit OCC.",
            "en": "Always build automatic retry logic for OCC commit conflicts."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Bagaimana Apache Iceberg melakukan perubahan nama kolom tanpa menulis ulang file Parquet yang sudah ada di storage?",
              "en": "How does Apache Iceberg rename columns without rewriting existing Parquet files?"
            },
            "options": [
              {
                "id": "Mengubah isi file binary langsung",
                "en": "Modifies binary bytes in-place"
              },
              {
                "id": "Memberi Field ID unik berupa integer pada tiap kolom di metadata; nama kolom hanya sekadar label di metadata file",
                "en": "Assigns unique immutable integer field IDs to each column in metadata; column names are resolved in metadata without touching data files"
              },
              {
                "id": "Membuat symlink di S3",
                "en": "Creates symlinks in S3"
              },
              {
                "id": "Memuat seluruh file ke RAM",
                "en": "Loads all data into memory"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Iceberg melacak kolom berdasarkan integer Field ID unik, bukan nama string. Mengubah nama hanya memperbarui file metadata JSON kecil.",
              "en": "Iceberg tracks columns by immutable integer Field IDs. Renaming only updates the lightweight metadata JSON."
            }
          }
        ]
      },
      {
        "id": "mod-2-3",
        "number": "2.3",
        "title": {
          "id": "Rekayasa Transformasi dengan dbt Core & Data Contracts",
          "en": "Transformation Engineering with dbt Core & Data Contracts"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Bangun arsitektur berlapis (Staging -> Intermediate -> Marts), kelola model inkremental merge, dan kunci skema dengan Data Contracts.",
          "en": "Build clean medallion architectures (Staging -> Intermediate -> Marts), manage incremental models, and enforce strict Data Contracts."
        },
        "whyTutorialsLie": {
          "id": "Tutorial menampilkan model sederhana tanpa pengujian dan tanpa kontrak. Begitu tim produk mengubah skema di database utama, seluruh pipeline analitik runtuh tanpa peringatan.",
          "en": "Tutorials show simple models without tests, incremental logic, or contracts. When raw schemas change in production, whole analytics platforms break silently."
        },
        "concepts": [
          {
            "title": {
              "id": "Arsitektur Medallion di dbt",
              "en": "The Medallion Architecture in dbt"
            },
            "content": {
              "id": "Pemisahan lapisan bersih: Staging (stg_: pembersihan 1-to-1), Intermediate (int_: gabungan logika bisnis), dan Marts (fct_/dim_: model siap saji untuk analitik).",
              "en": "Clear layer separation: Staging (stg_: 1-to-1 cleanup), Intermediate (int_: business logic joins), and Marts (fct_/dim_: Kimball entities for business consumption)."
            }
          },
          {
            "title": {
              "id": "Data Contracts & dbt Slim CI",
              "en": "Data Contracts & dbt Slim CI"
            },
            "content": {
              "id": "Mengunci kontrak skema model (contract: enforced: true). Menjalankan Slim CI (state:modified+) di GitHub Actions untuk hanya menguji model yang diubah dalam pull request.",
              "en": "Enforcing model contracts (contract: enforced: true). Running Slim CI (state:modified+) in pull requests to test only modified models and save cloud costs."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Proyek dbt Core dengan Model Inkremental & Kontrak",
            "en": "Hands-on Lab: Enterprise dbt Core Project with Contracts and Slim CI"
          },
          "description": {
            "id": "Bangun proyek dbt Core memodelkan pendapatan berulang bulanan (MRR) dengan strategi incremental merge dan uji kontrak skema.",
            "en": "Build an enterprise dbt project modeling customer subscriptions and monthly recurring revenue (MRR) using incremental merge models and enforced contracts."
          },
          "codeSnippet": "{{\n  config(\n    materialized='incremental',\n    unique_key='subscription_id',\n    incremental_strategy='merge',\n    contract={'enforced': true}\n  )\n}}\n\nselect subscription_id, customer_id, monthly_amount_usd, status, updated_at\nfrom {{ ref('stg_subscriptions') }}\n{% if is_incremental() %}\n  where updated_at >= (select coalesce(max(updated_at), '1970-01-01') - interval '3 day' from {{ this }})\n{% endif %}",
          "deliverables": [
            {
              "id": "Proyek dbt Core modular dengan staging dan marts",
              "en": "Modular dbt project structure with staging and marts"
            },
            {
              "id": "Model inkremental dengan buffer lookback window",
              "en": "Incremental model with lookback buffer window"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Data Terlambat Hilang Karena Filter Watermark Ketat",
            "en": "Chaos Scenario: The Incremental High-Watermark Silent Data Loss"
          },
          "scenario": {
            "id": "Model inkremental memfilter 'where updated_at > max(updated_at)'. Data transaksi yang terlambat 10 menit tiba dengan timestamp lama dan terlewat selamanya dari data mart.",
            "en": "Your incremental model filters 'where updated_at > max(updated_at)'. A delayed transaction arrives with an older updated_at and is permanently skipped and lost from the mart."
          },
          "breakageReason": {
            "id": "Pertidaksamaan ketat pada watermark mengabaikan transaksi yang tiba terlambat karena gangguan jaringan.",
            "en": "Strict inequality on high watermarks skips late-arriving events that fall behind the latest recorded timestamp."
          },
          "fixGuide": {
            "id": "1. Tambahkan buffer lookback window (misal: kurangi 3 hari dari max watermark).\n2. Pastikan unique_key menangani upsert secara idempotent.\n3. Jadwalkan full-refresh mingguan untuk rekonsiliasi berkala.",
            "en": "1. Add a lookback buffer window (e.g. interval '3 day').\n2. Ensure unique_key handles idempotent upserts.\n3. Schedule periodic reconciliation full-refreshes."
          },
          "defensivePattern": {
            "id": "Jangan pernah percaya watermark tanpa buffer lookback pada batch model inkremental.",
            "en": "Never rely on exact high watermarks without lookback buffers in incremental batch models."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Apa keuntungan utama dbt Slim CI di pull request?",
              "en": "What is the primary benefit of dbt Slim CI in pull requests?"
            },
            "options": [
              {
                "id": "Mengecilkan ukuran file dbt",
                "en": "Compresses dbt files"
              },
              {
                "id": "Hanya membangun dan menguji model yang dimodifikasi di PR dan turunannya (state:modified+), menghemat hingga 90% waktu dan biaya warehouse",
                "en": "Only builds and tests modified models and their downstream dependencies (state:modified+), saving up to 90% in cloud warehouse costs and CI time"
              },
              {
                "id": "Menjalankan dbt di browser",
                "en": "Runs dbt in the browser"
              },
              {
                "id": "Memperbaiki typo SQL otomatis",
                "en": "Fixes SQL typos automatically"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Slim CI membandingkan manifest PR dengan manifest produksi untuk hanya menjalankan model yang terdampak perubahan.",
              "en": "Slim CI compares the PR manifest against production to execute only changed models and their downstream lineage."
            }
          }
        ]
      },
      {
        "id": "mod-2-4",
        "number": "2.4",
        "title": {
          "id": "Orkestrasi Berorientasi Aset Data (Dagster & Airflow)",
          "en": "Asset-Oriented Orchestration (Dagster & Airflow)"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Kuasai Software-Defined Assets (SDAs), eksekusi idempotent yang aman di-rerun, backfill historis berbasis partisi, dan sensor data.",
          "en": "Master Software-Defined Assets (SDAs), idempotent pipeline execution, partition-based backfilling, and dynamic sensors."
        },
        "whyTutorialsLie": {
          "id": "Tutorial Airflow hanya mengajarkan task dummy echo hello. Di dunia kerja, orkestrasi berbasis task acak kehilangan lineage data dan menduplikasi data saat rerun gagal.",
          "en": "Airflow tutorials show dummy tasks with 'echo hello'. In reality, task-centric orchestration loses track of data lineage, makes data recomputation a nightmare, and breaks when backfilling."
        },
        "concepts": [
          {
            "title": {
              "id": "Task-Centric (Airflow) vs Asset-Centric (Dagster)",
              "en": "Task-Centric (Airflow) vs Asset-Centric (Dagster)"
            },
            "content": {
              "id": "Mengapa berpikir tentang 'aset data apa yang ada dan apa dependensinya' (Dagster SDA) jauh lebih unggul daripada sekadar memikirkan 'urutan script apa yang dijalankan' (Airflow).",
              "en": "Why thinking in 'what data assets exist and what are their dependencies' (Dagster SDAs) is fundamentally superior for data engineering than thinking in arbitrary task graphs."
            }
          },
          {
            "title": {
              "id": "Prinsip Emas Idempotensi dalam Pipeline",
              "en": "The Golden Principle of Idempotency"
            },
            "content": {
              "id": "Jaminan bahwa menjalankan pipeline 100 kali untuk rentang tanggal yang sama menghasilkan kondisi akhir yang sama persis tanpa baris ganda (f(f(x)) = f(x)).",
              "en": "The guarantee that executing a pipeline 100 times for the same time partition yields the exact same target state without duplicates (f(f(x)) = f(x))."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Pipeline Dagster dengan Partisi Harian & Backfill",
            "en": "Hands-on Lab: Building a Production Dagster Pipeline with Partitioned Assets"
          },
          "description": {
            "id": "Bangun pipeline Dagster yang mendefinisikan Software-Defined Assets terpartisi harian dan uji eksekusi backfill historis 30 hari secara idempotent.",
            "en": "Build an end-to-end Dagster project defining daily partitioned assets and execute an idempotent historical backfill across 30 partitions."
          },
          "codeSnippet": "from dagster import asset, DailyPartitionsDefinition, AssetExecutionContext\nimport pandas as pd\n\ndaily_partitions = DailyPartitionsDefinition(start_date=\"2026-01-01\")\n\n@asset(partitions_def=daily_partitions)\ndef daily_telemetry(context: AssetExecutionContext) -> pd.DataFrame:\n    partition_date = context.partition_key\n    context.log.info(f\"Memproses partisi tanggal: {partition_date}\")\n    # Simulasikan pembacaan dan pembersihan idempotent\n    df = pd.DataFrame([{\"date\": partition_date, \"device_id\": \"D1\", \"val\": 42}])\n    return df",
          "deliverables": [
            {
              "id": "Aset Dagster dengan DailyPartitionsDefinition",
              "en": "Dagster asset with DailyPartitionsDefinition"
            },
            {
              "id": "Keberhasilan eksekusi backfill 30 partisi tanpa duplikasi",
              "en": "Successful 30-partition backfill run with zero duplicates"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Bencana Duplikasi Data Akibat Append Non-Idempotent",
            "en": "Chaos Scenario: The Non-Idempotent Append Disaster"
          },
          "scenario": {
            "id": "Job harian selesai 90%, lalu gagal menulis status akhir karena timeout jaringan. Orchestrator me-retry otomatis; karena menggunakan INSERT INTO tanpa pembersihan partisi, omset tercatat ganda di mart eksekutif.",
            "en": "A pipeline finishes 90%, times out on the status update, and auto-retries. Because it used INSERT INTO without partition cleanup, daily revenue is doubled."
          },
          "breakageReason": {
            "id": "Tidak menerapkan idempotensi di target penyimpanan.",
            "en": "Failure to enforce idempotency in the destination sink."
          },
          "fixGuide": {
            "id": "1. Pada database SQL: gunakan transaksi atomik DELETE sebelum INSERT, atau gunakan sintaks MERGE / INSERT OVERWRITE.\n2. Pada file storage: tulis ke folder partisi deterministik dengan atomic swap.\n3. Uji idempotensi dengan menjalankan job 3 kali berturut-turut dan pastikan jumlah baris tetap sama.",
            "en": "1. For SQL sinks: use atomic DELETE before INSERT, or MERGE/INSERT OVERWRITE.\n2. For file sinks: write to deterministic partition directories with atomic file swaps.\n3. Verify idempotency by running tasks multiple times."
          },
          "defensivePattern": {
            "id": "Jika menjalankan pipeline dua kali mengubah isi data, pipeline tersebut rusak secara definisi.",
            "en": "Every pipeline task must be idempotent. If running it twice changes state, it is broken by definition."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Apa arti dari sebuah langkah pipeline bersifat 'idempotent'?",
              "en": "What does it mean for a data pipeline step to be 'idempotent'?"
            },
            "options": [
              {
                "id": "Berjalan dalam waktu di bawah 1 detik",
                "en": "Runs in under 1 second"
              },
              {
                "id": "Menghasilkan hasil akhir yang sama persis tidak peduli berapa kali dijalankan dengan parameter input yang sama",
                "en": "Produces the exact same outcome regardless of how many times it is executed with the same parameters"
              },
              {
                "id": "Data terenkripsi otomatis",
                "en": "Encrypts data at rest"
              },
              {
                "id": "Tidak memerlukan memori RAM",
                "en": "Requires no RAM"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Idempotensi menjamin bahwa eksekusi berulang tidak memicu efek samping atau data duplikat.",
              "en": "Idempotency means f(f(x)) = f(x). Executing once or ten times produces identical target state."
            }
          }
        ]
      },
      {
        "id": "mod-2-5",
        "number": "2.5",
        "title": {
          "id": "Kualitas Data, Observabilitas & Data Contracts",
          "en": "Data Quality, Observability & Data Contracts"
        },
        "duration": {
          "id": "2 Minggu",
          "en": "2 Weeks"
        },
        "summary": {
          "id": "Beralih dari pemadam kebakaran reaktif menjadi pencegahan proaktif: spesifikasi Data Contracts, pengujian Great Expectations, dan pelacakan OpenLineage.",
          "en": "Shift from reactive debugging to proactive guarantees: Data Contracts specification, Great Expectations, and OpenLineage."
        },
        "whyTutorialsLie": {
          "id": "Di tutorial, pipeline dianggap selesai begitu data masuk ke tabel. Di industri nyata, reputasi Anda ditentukan oleh kepercayaan data: apakah data tiba tepat waktu? Apakah angkanya valid?",
          "en": "In tutorials, pipelines are treated as completed once the data lands in a table. In production, 60% of a data engineer's reputation depends on data trust."
        },
        "concepts": [
          {
            "title": {
              "id": "Data Contracts (Perjanjian Produsen & Konsumen)",
              "en": "Data Contracts (Producer-Consumer Agreements)"
            },
            "content": {
              "id": "Membuat kesepakatan formal berbasis YAML antara tim software engineer (penghasil data) dan tim data engineer (konsumen data) agar skema tidak bisa diubah sepihak tanpa tes CI.",
              "en": "Using open Data Contract specifications to create binding agreements between software engineering producers and data engineering consumers."
            }
          },
          {
            "title": {
              "id": "5 Pilar Observabilitas Data",
              "en": "The 5 Pillars of Data Observability"
            },
            "content": {
              "id": "Freshness (Ketepatan waktu), Volume (Kelengkapan baris), Schema (Struktur kolom), Quality (Akurasi nilai), dan Lineage (Silsilah ketergantungan antar tabel).",
              "en": "Freshness (timeliness), Volume (completeness), Schema (structure), Quality (accuracy), and Lineage (dependencies across heterogeneous tools)."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Gate Validasi Data Contract Otomatis di CI/CD",
            "en": "Hands-on Lab: Automated CI/CD Data Contract Validation & Quality Gates"
          },
          "description": {
            "id": "Definisikan spesifikasi Data Contract YAML untuk event checkout dan buat checkpoint validasi otomatis yang mengisolasi baris rusak ke karantina.",
            "en": "Define a YAML Data Contract for checkout events and build an automated validation checkpoint that halts ingestion on contractual violations."
          },
          "codeSnippet": "name: checkout_contract\nversion: 1.0.0\nowner: checkout-team\ndataset: production.orders_checkout\nschema:\n  fields:\n    - name: order_id\n      type: string\n      required: true\n    - name: amount\n      type: decimal(10,2)\n      required: true\n      minimum: 0.01",
          "deliverables": [
            {
              "id": "Spesifikasi Data Contract YAML formal",
              "en": "Formal Data Contract YAML specification"
            },
            {
              "id": "Skrip pengujian otomatis dengan karantina DLQ",
              "en": "Automated validation gate with quarantine DLQ"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Anomali Penurunan Volume Senyap (Silent Drop)",
            "en": "Chaos Scenario: The Silent Volume Drop Anomaly"
          },
          "scenario": {
            "id": "Upstream mengalami bug di mana pesanan internasional gagal masuk. Total baris harian turun 25%, tetapi semua baris yang masuk berformat valid. Tes skema biasa lolos, namun laporan omset CEO anjlok tak terjelaskan.",
            "en": "A checkout bug prevents international orders from completing. Total rows drop by 25%. Because incoming rows are syntactically valid, schema tests pass, masking an executive revenue collapse."
          },
          "breakageReason": {
            "id": "Hanya menguji struktur skema tanpa memantau distribusi volume dan statistik deret waktu.",
            "en": "Testing only schema syntax without testing data volume and distribution statistics."
          },
          "fixGuide": {
            "id": "1. Pasang deteksi anomali volume: bandingkan jumlah baris harian terhadap median 14 hari rolling (+- 2 sigma).\n2. Pasang pemantauan distribusi kategori (alert jika order internasional turun > 50%).\n3. Kirim notifikasi webhook otomatis ke tim on-call sebelum jam kantor dimulai.",
            "en": "1. Implement volume anomaly checks: compare partition row count against 14-day median (+- 2 sigma).\n2. Add categorical distribution monitoring.\n3. Trigger automated Slack alerts to on-call engineers before business hours."
          },
          "defensivePattern": {
            "id": "Tes skema hanya memverifikasi bentuk; tes volume dan distribusi memverifikasi realita bisnis.",
            "en": "Syntax checks only verify shape; volume and distributional checks verify business reality."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Apa lima pilar utama dalam observabilitas data modern?",
              "en": "What are the five core pillars of modern Data Observability?"
            },
            "options": [
              {
                "id": "CPU, RAM, Disk, Jaringan, GPU",
                "en": "CPU, RAM, Disk, Network, GPU"
              },
              {
                "id": "Freshness, Volume, Schema, Quality, dan Lineage",
                "en": "Freshness, Volume, Schema, Quality, and Lineage"
              },
              {
                "id": "Extract, Transform, Load, Test, View",
                "en": "Extract, Transform, Load, Test, View"
              },
              {
                "id": "Speed, Cost, Security, Cloud, Cache",
                "en": "Speed, Cost, Security, Cloud, Cache"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Observabilitas data modern diukur dari 5 pilar: Freshness, Volume, Schema, Quality, dan Lineage.",
              "en": "Modern data observability is defined by the 5 pillars: Freshness, Volume, Schema, Quality, and Lineage."
            }
          }
        ]
      }
    ]
  },
  {
    "levelId": "advanced",
    "levelTitle": {
      "id": "Level 3: Skala Besar & Streaming Real-Time",
      "en": "Level 3: Distributed Scale & Real-Time Streaming"
    },
    "levelSubtitle": {
      "id": "Kuasai komputasi terdistribusi (Spark Internals), event streaming (Kafka/Redpanda), CDC, Flink, dan Terraform IaC.",
      "en": "Master distributed computing internals (Spark/Flink), event streaming (Kafka/Redpanda), CDC, and Terraform IaC."
    },
    "badge": {
      "id": "Skala & Streaming",
      "en": "Scale & Streaming"
    },
    "badgeColor": "rose",
    "modules": [
      {
        "id": "mod-3-1",
        "number": "3.1",
        "title": {
          "id": "Sistem Terdistribusi & Anatomi Apache Spark",
          "en": "Distributed Computing & Apache Spark Internals"
        },
        "duration": {
          "id": "4 Minggu",
          "en": "4 Weeks"
        },
        "summary": {
          "id": "Pahami Catalyst optimizer, manajemen memori Tungsten, mekanisme Shuffle, dan cara mengatasi data skew parah.",
          "en": "Understand the Catalyst optimizer, Tungsten memory management, Shuffle dynamics, and debug severe data skew."
        },
        "whyTutorialsLie": {
          "id": "Sebagian besar kursus Spark hanya menyuruh memanggil df.groupBy().count(). Di produksi nyata, job pada data 100 GB bisa macet di 99% selama 4 jam karena 80% baris memiliki key NULL, menumpuk seluruh beban ke satu executor hingga crash kehabisan memori (OOM).",
          "en": "Most Spark courses say: 'Just call df.groupBy().count()'. In production, a job on 100GB hangs at 99% for 4 hours because 80% of records have null keys, hashing all records to a single executor and crashing it with Out of Memory."
        },
        "concepts": [
          {
            "title": {
              "id": "Model Memori Spark (Execution vs Storage vs Off-Heap)",
              "en": "Spark Architecture & Memory Model"
            },
            "content": {
              "id": "Driver, Cluster Manager, Executors. Memahami alokasi JVM On-Heap dan Off-Heap, jeda Garbage Collection, dan mengapa network shuffle adalah musuh utama performa Spark.",
              "en": "Driver, Cluster Manager, Executors. JVM Off-Heap vs On-Heap memory (Execution vs Storage memory), Garbage Collection overhead, and shuffle bottlenecks."
            }
          },
          {
            "title": {
              "id": "Diagnosis Data Skew & Teknik Key Salting",
              "en": "Data Skew Diagnosis & Salting Techniques"
            },
            "content": {
              "id": "Mendeteksi partisi timpang melalui Spark UI task timeline. Memperbaiki skew dengan menambahkan salt acak ke key join agar beban terdistribusi merata ke semua executor.",
              "en": "Identifying skewed partitions via Spark UI event timelines. Mitigating skew by adding random salt keys to distribute hot keys evenly across executors."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Tuning Performa PySpark & Mitigasi Data Skew",
            "en": "Hands-on Lab: Spark Performance Tuning & Skew Mitigation Lab"
          },
          "description": {
            "id": "Diberikan dataset 50 juta baris di mana 1 key mendominasi 70% data, profil job di Spark UI, terapkan key salting dan Adaptive Query Execution (AQE), memangkas waktu eksekusi dari 22 menit ke 1,5 menit.",
            "en": "Given a skewed dataset where one key dominates 70% of rows, profile the job in Spark UI, apply key salting and AQE, reducing runtime from 22 minutes to 1.5 minutes."
          },
          "codeSnippet": "from pyspark.sql import SparkSession\nfrom pyspark.sql import functions as F\n\nspark = SparkSession.builder \\\n    .appName(\"SkewMitigation\") \\\n    .config(\"spark.sql.adaptive.enabled\", \"true\") \\\n    .getOrCreate()\n\nSALT_FACTOR = 16\n# Tambahkan salt acak ke tabel besar yang timpang\nlarge_salted = large_df.withColumn(\"salt\", F.floor(F.rand() * SALT_FACTOR))\n\n# Gandakan tabel lookup kecil sebesar salt factor\nlookup_salted = lookup_df.withColumn(\"salt\", F.explode(F.array([F.lit(i) for i in range(SALT_FACTOR)])))\n\nbalanced_join = large_salted.join(lookup_salted, on=[\"join_key\", \"salt\"]).drop(\"salt\")",
          "deliverables": [
            {
              "id": "Perbandingan timeline Spark UI sebelum dan sesudah salting",
              "en": "Spark UI timeline comparison showing balanced executor distribution"
            },
            {
              "id": "Peningkatan kecepatan komputasi >10x tanpa disk spill",
              "en": "Benchmark showing >10x speedup with zero disk spill"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Siklus Kematian Executor Akibat Tumpahan Disk (Spill)",
            "en": "Chaos Scenario: The Spill-to-Disk Executor Death Spiral"
          },
          "scenario": {
            "id": "Job PySpark mengalami tumpahan memori ke disk puluhan gigabyte. Disk node penuh, jeda GC melebihi 30 detik, dan cluster manager kehilangan detak jantung (heartbeat) executor.",
            "en": "A PySpark job experiences massive disk spill (Memory Spill: 42GB). Node disks fill up, GC pauses exceed 30 seconds, and the cluster manager loses executor heartbeats."
          },
          "breakageReason": {
            "id": "Memori eksekusi tidak memadai dipadukan dengan partisi shuffle kardinalitas tinggi.",
            "en": "Insufficient execution memory combined with high partition cardinality and unoptimized wide shuffles."
          },
          "fixGuide": {
            "id": "1. Sesuaikan spark.sql.shuffle.partitions dari default 200 ke angka yang seimbang dengan data (misal: 1.200).\n2. Filter nilai NULL pada key join sebelum shuffle.\n3. Aktifkan Adaptive Query Execution (spark.sql.adaptive.enabled=true).",
            "en": "1. Tune spark.sql.shuffle.partitions to match core counts.\n2. Filter out null or dummy join keys before shuffle.\n3. Enable Adaptive Query Execution to coalesce small partitions automatically."
          },
          "defensivePattern": {
            "id": "Pantau selalu kolom Memory Spill dan Disk Spill di Spark UI. Disk spill adalah alarm bahaya kekurangan RAM.",
            "en": "Always monitor Memory Spill and Disk Spill in Spark UI. Any non-zero disk spill indicates memory starvation."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa data skew menyebabkan job Spark macet di 99% meski 99 dari 100 task sudah selesai?",
              "en": "Why does data skew cause a Spark job to hang at 99% progress even if 99 of 100 tasks are finished?"
            },
            "options": [
              {
                "id": "Karena task terakhir menunggu lisensi software",
                "en": "Because the final task is waiting for a software license"
              },
              {
                "id": "Karena partisi dengan hot key menampung mayoritas data dan 1 executor harus memproses semuanya sendirian sementara executor lain menganggur",
                "en": "Because the partition with the hot key contains 80% of total records and a single executor must process it sequentially while other executors sit idle"
              },
              {
                "id": "Karena driver kehabisan disk",
                "en": "Because the driver runs out of disk space"
              },
              {
                "id": "Karena Spark mengompresi hasil",
                "en": "Because Spark compresses results"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Dalam komputasi terdistribusi, kecepatan stage dibatasi oleh task paling lambat (the straggler). Partisi yang timpang menumpuk beban ke 1 worker sendirian.",
              "en": "In distributed computing, stage duration is bounded by the slowest task (the straggler). Skew forces one executor to process the vast majority of records alone."
            }
          }
        ]
      },
      {
        "id": "mod-3-2",
        "number": "3.2",
        "title": {
          "id": "Event Streaming & Change Data Capture (CDC)",
          "en": "Event Streaming & Change Data Capture (CDC)"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Kuasai arsitektur berbasis log dengan Kafka & Redpanda, manajemen offset, dan CDC tanpa mengunci database transaksional via Debezium.",
          "en": "Master log-centric architectures with Apache Kafka & Redpanda, offset management, and zero-impact CDC with Debezium."
        },
        "whyTutorialsLie": {
          "id": "Tutorial streaming hanya mengirim pesan acak ke Kafka dan mencetaknya di layar. Di dunia nyata, Anda harus menangani consumer lag jutaan pesan, poison pill yang merusak worker, dan membaca perubahan database langsung dari WAL tanpa mengganggu pelanggan.",
          "en": "Tutorials show pushing random messages to Kafka and printing them. In reality, you must handle consumer lag, poison pill messages, partition rebalances, and zero-impact database WAL streaming."
        },
        "concepts": [
          {
            "title": {
              "id": "Anatomi Append-Only Commit Log & Partisi",
              "en": "Append-Only Commit Logs & Partitions"
            },
            "content": {
              "id": "Topik, Partisi, dan Segment file. Mengapa partisi adalah unit paralelisme. Bagaimana Redpanda mencapai latensi mikrodetik dengan C++ tanpa overhead JVM.",
              "en": "Topics, Partitions, Segment files, and Commit Logs. Why partitions are the unit of parallelism. How Redpanda achieves ultra-low latency with C++ thread-per-core design."
            }
          },
          {
            "title": {
              "id": "Change Data Capture (CDC) dengan Debezium",
              "en": "Change Data Capture (CDC) with Debezium"
            },
            "content": {
              "id": "Mengapa polling berkala (SELECT ... WHERE updated_at > ...) mengunci tabel dan melewatkan data yang dihapus (DELETE). Cara Debezium membaca PostgreSQL Write-Ahead Log (WAL) dengan beban OLTP nol.",
              "en": "Why polling queries lock tables and miss DELETE operations. How Debezium streams PostgreSQL Write-Ahead Log (WAL) events with zero database lock contention."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Pipeline CDC PostgreSQL Real-Time ke Redpanda",
            "en": "Hands-on Lab: Real-Time PostgreSQL CDC to Redpanda Pipeline"
          },
          "description": {
            "id": "Nyalakan PostgreSQL (wal_level=logical), Debezium Connect, dan Redpanda via Docker. Alirkan event INSERT, UPDATE, dan DELETE secara real-time ke topik streaming.",
            "en": "Spin up PostgreSQL with logical decoding, Debezium, and Redpanda with Docker Compose. Ingest real-time INSERT, UPDATE, and DELETE operations as stream events."
          },
          "codeSnippet": "{\n  \"name\": \"pg-orders-cdc\",\n  \"config\": {\n    \"connector.class\": \"io.debezium.connector.postgresql.PostgresConnector\",\n    \"database.hostname\": \"postgres\",\n    \"database.dbname\": \"production\",\n    \"table.include.list\": \"public.orders\",\n    \"plugin.name\": \"pgoutput\",\n    \"tombstones.on.delete\": \"true\"\n  }\n}",
          "deliverables": [
            {
              "id": "Docker Compose stack Postgres CDC dan Redpanda",
              "en": "Docker Compose stack with Postgres CDC and Redpanda"
            },
            {
              "id": "Penangkapan event mutasi database dengan manual offset commit",
              "en": "Verified capture of database mutations with manual offset commits"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Badai Rebalance & Consumer Lag Menumpuk 2 Juta Pesan",
            "en": "Chaos Scenario: The Consumer Lag Avalanche & Rebalance Storm"
          },
          "scenario": {
            "id": "Downstream consumer mengalami pelambatan tulis ke database. Waktu proses melebihi max.poll.interval.ms. Broker mengira consumer mati dan memicu rebalance berulang tanpa henti.",
            "en": "A downstream consumer experiences slow writes exceeding max.poll.interval.ms. The broker assumes the consumer died, triggering infinite rebalance storms while lag balloons to 2M messages."
          },
          "breakageReason": {
            "id": "Melakukan proses I/O berat yang memblokir loop poll Kafka.",
            "en": "Blocking I/O processing synchronously inside the Kafka poll loop."
          },
          "fixGuide": {
            "id": "1. Pisahkan pengambilan pesan dari pemrosesan: poll di thread terpisah dan serahkan ke worker thread pool.\n2. Perkecil max.poll.records.\n3. Aktifkan Cooperative Sticky Rebalance (cooperative-sticky).",
            "en": "1. Decouple polling from processing via worker thread pools.\n2. Reduce max.poll.records.\n3. Enable Cooperative Sticky Rebalancing."
          },
          "defensivePattern": {
            "id": "Jangan pernah menjalankan pemrosesan I/O berat secara synchronous di dalam poll loop Kafka.",
            "en": "Never perform heavy I/O synchronously inside the Kafka poll loop without bounded batch sizes."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa CDC via transaction log (WAL) jauh lebih unggul dibanding query polling berkala (SELECT WHERE updated_at > last_sync)?",
              "en": "Why is Change Data Capture (CDC) via transaction logs superior to periodic polling queries?"
            },
            "options": [
              {
                "id": "CDC lebih murah biaya lisensinya",
                "en": "CDC has cheaper licensing costs"
              },
              {
                "id": "CDC membaca log transaksi langsung tanpa mengunci tabel, menangkap event DELETE, menangkap perubahan sementara antar jadwal, dan tidak membebani database utama",
                "en": "CDC reads database transaction logs without running queries, captures DELETE operations, captures intermediate updates, and causes near-zero load on the OLTP database"
              },
              {
                "id": "CDC otomatis membuat dashboard",
                "en": "CDC creates dashboards automatically"
              },
              {
                "id": "CDC tidak membutuhkan database",
                "en": "CDC requires no database"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Polling melewatkan data DELETE dan membebani server aplikasi, sedangkan CDC membaca stream mutasi langsung dari WAL tanpa lock.",
              "en": "Polling cannot capture DELETEs and burdens application databases; CDC reads WAL mutation streams natively with zero locks."
            }
          }
        ]
      },
      {
        "id": "mod-3-3",
        "number": "3.3",
        "title": {
          "id": "Pemrosesan Aliran Real-Time (Flink & Spark Streaming)",
          "en": "Real-Time Stream Processing (Flink & Spark Streaming)"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Kuasai Event Time vs Processing Time, Watermarks untuk data terlambat, Windowing (Tumbling/Sliding), dan stateful stream processing.",
          "en": "Master Event Time, Watermarks, Windowing (Tumbling, Sliding, Session), and Stateful Stream Processing."
        },
        "whyTutorialsLie": {
          "id": "Tutorial menghitung statistik berdasarkan waktu pesan tiba di server (Processing Time). Saat aplikasi mobile user kehilangan sinyal di jalan atau terowongan lalu menyinkronkan data 2 jam kemudian, pipeline processing-time menghasilkan laporan analitik yang salah total.",
          "en": "Tutorials calculate statistics based on 'when the message arrived at the server'. But when mobile apps go offline and sync 4 hours later, processing-time pipelines produce completely invalid analytics."
        },
        "concepts": [
          {
            "title": {
              "id": "Event Time vs Processing Time & Watermarks",
              "en": "Event Time vs Processing Time & Watermarks"
            },
            "content": {
              "id": "Mengapa waktu kejadian di perangkat user (Event Time) adalah satu-satunya dasar kebenaran analitik. Cara kerja Watermark sebagai sinyal penutup jendela waktu saat data terlambat datang.",
              "en": "Why Event Time is the only reliable basis for analytical correctness. How watermarks signal when the engine can close time windows for late-arriving records."
            }
          },
          {
            "title": {
              "id": "Stateful Processing & Checkpointing Exactly-Once",
              "en": "Stateful Processing & Exactly-Once Checkpointing"
            },
            "content": {
              "id": "Menyimpan akumulasi state di storage (RocksDB). Mekanisme checkpointing 2-phase commit untuk pemulihan deterministik saat worker crash.",
              "en": "State storage backends (RocksDB) and two-phase commit checkpointing ensuring deterministic recovery and end-to-end exactly-once semantics."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Deteksi Fraud Real-Time dengan Jendela Watermark",
            "en": "Hands-on Lab: Real-Time Fraud Detection with Watermarked Windows"
          },
          "description": {
            "id": "Bangun pipeline Spark Streaming / Flink yang menghitung volume transaksi 5 menit per akun dengan batas watermark keterlambatan 2 menit.",
            "en": "Build a streaming pipeline computing rolling 5-minute transaction volumes per account with a 2-minute watermark tolerance."
          },
          "codeSnippet": "stream_df = spark.readStream.format(\"kafka\") \\\n    .option(\"subscribe\", \"transactions\").load()\n\nparsed = stream_df.select(F.from_json(\"value\", schema).alias(\"data\")).select(\"data.*\") \\\n    .withWatermark(\"event_time\", \"2 minutes\")\n\nwindowed = parsed.groupBy(\n    F.window(\"event_time\", \"5 minutes\"), F.col(\"account_id\")\n).agg(F.count(\"*\").alias(\"tx_count\"), F.sum(\"amount\").alias(\"total_amount\"))",
          "deliverables": [
            {
              "id": "Pipeline streaming dengan definisi watermark eksplisit",
              "en": "Streaming pipeline code with explicit watermark definition"
            },
            {
              "id": "Uji coba membunuh job di tengah jalan dan resume tanpa data loss",
              "en": "Checkpoint recovery test killing streaming job and resuming"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Lonjakan Event Out-of-Order & State Store Membengkak",
            "en": "Chaos Scenario: Out-of-Order Burst & State Store Bloat"
          },
          "scenario": {
            "id": "50.000 perangkat IoT reconnect bersamaan setelah mati lampu 2 hari, memuntahkan log lama. Processor mencoba menahan semua state jendela historis di RAM hingga RocksDB kehabisan memori.",
            "en": "50,000 IoT devices reconnect simultaneously after a 2-day outage, dumping historical events. The stream engine tries holding all window states in memory, exhausting RocksDB."
          },
          "breakageReason": {
            "id": "Batas keterlambatan (allowed lateness) diset tidak terbatas sehingga state tidak pernah dibersihkan.",
            "en": "Allowed lateness was set unbounded, causing state stores to retain obsolete historical windows indefinitely."
          },
          "fixGuide": {
            "id": "1. Batasi toleransi keterlambatan ke angka bisnis yang wajar (misal: 30 menit).\n2. Buang data yang lebih tua dari watermark langsung ke side-output arsip.\n3. Batasi memori off-heap RocksDB.",
            "en": "1. Cap allowed lateness to a reasonable business tolerance.\n2. Route events older than the watermark to raw side-output archives.\n3. Bound RocksDB off-heap memory allocations."
          },
          "defensivePattern": {
            "id": "Batasi retensi state. Jangan pernah izinkan allowed lateness tanpa batas.",
            "en": "Set strict boundaries on state retention. Never allow unbounded lateness in streaming window aggregations."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Apa fungsi utama dari 'Watermark' dalam pemrosesan streaming?",
              "en": "What is the primary function of a 'Watermark' in stream processing?"
            },
            "options": [
              {
                "id": "Menempelkan watermark hak cipta",
                "en": "Stamps copyright on visualizations"
              },
              {
                "id": "Memberi sinyal kepada engine bahwa semua data hingga waktu T diasumsikan sudah tiba, sehingga jendela waktu bisa ditutup dan hasilnya dikeluarkan",
                "en": "Signals the stream engine that all events up to timestamp T have likely arrived, so the window can close and emit results"
              },
              {
                "id": "Menjeda aliran data",
                "en": "Pauses stream processing"
              },
              {
                "id": "Mengenal wajah user",
                "en": "Face recognition"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Watermark menyeimbangkan latensi dan kelengkapan data saat menangani event yang tiba tidak berurutan.",
              "en": "Watermarks balance latency against completeness for out-of-order event streams."
            }
          }
        ]
      },
      {
        "id": "mod-3-4",
        "number": "3.4",
        "title": {
          "id": "Infrastructure as Code (Terraform) & FinOps",
          "en": "Infrastructure as Code (Terraform) & FinOps"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Bangun infrastruktur data cloud dengan Terraform deklaratif, terapkan hak akses least-privilege, dan cegah pemborosan biaya gudang data cloud.",
          "en": "Provision scalable cloud lakehouses with Terraform, enforce IAM least-privilege, and optimize cloud warehouse costs."
        },
        "whyTutorialsLie": {
          "id": "Tutorial mengajarkan klik tombol di konsol web. Di perusahaan matang, 'click-ops' dilarang keras. Semua harus ditulis sebagai kode Terraform, diaudit, dan dikontrol biayanya. Query salah yang tidak sengaja cross join di Snowflake bisa membakar uang $10.000 dalam satu akhir pekan.",
          "en": "Tutorials show clicking buttons in web consoles. In production, click-ops is banned. Everything must be provisioned through Terraform, audited, and cost-controlled. A runaway query in Snowflake can burn $10,000 in a single weekend."
        },
        "concepts": [
          {
            "title": {
              "id": "Terraform Deklaratif untuk Platform Data",
              "en": "Declarative Terraform for Data Platforms"
            },
            "content": {
              "id": "Menulis modul HCL untuk bucket S3/GCS, kebijakan IAM, kunci KMS, dan resource warehouse Snowflake/BigQuery. Mengelola remote state dan lock DynamoDB.",
              "en": "Writing declarative HCL modules for S3/GCS buckets, IAM policies, KMS encryption keys, and Snowflake/BigQuery warehouses with remote state locking."
            }
          },
          {
            "title": {
              "id": "FinOps: Manajemen Pengeluaran Cloud Data",
              "en": "Data FinOps & Cost Governance"
            },
            "content": {
              "id": "Aturan lifecycle S3 Intelligent-Tiering, batas auto-suspend warehouse (60 detik), batas timeout query (statement timeout), dan alokasi biaya berbasis tag tim.",
              "en": "S3 Intelligent-Tiering lifecycle rules, Snowflake 60-second auto-suspend timeouts, hard statement timeouts, and cost attribution tagging."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Provisi Lakehouse Aman dengan Terraform",
            "en": "Hands-on Lab: Provisioning a Secure Cloud Lakehouse with Terraform"
          },
          "description": {
            "id": "Tulis kode Terraform modular yang memprovisi bucket Data Lake S3 dengan lifecycle tiering, enkripsi KMS, dan role IAM least-privilege.",
            "en": "Write modular Terraform code provisioning an S3 Data Lake with lifecycle rules, server-side KMS encryption, and least-privilege IAM roles."
          },
          "codeSnippet": "resource \"aws_s3_bucket\" \"lakehouse\" {\n  bucket = \"enterprise-lakehouse-${var.env}\"\n}\n\nresource \"aws_s3_bucket_lifecycle_configuration\" \"lakehouse_lifecycle\" {\n  bucket = aws_s3_bucket.lakehouse.id\n  rule {\n    id     = \"archive_raw\"\n    status = \"Enabled\"\n    transition {\n      days          = 90\n      storage_class = \"GLACIER\"\n    }\n  }\n}",
          "deliverables": [
            {
              "id": "File Terraform modular (main.tf, variables.tf)",
              "en": "Modular Terraform files (main.tf, variables.tf)"
            },
            {
              "id": "Kebijakan IAM least-privilege tanpa akses admin",
              "en": "Least-privilege IAM policy restricting write access"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Query Liar Akhir Pekan Membakar $12.000",
            "en": "Chaos Scenario: The Runaway $12,000 Weekend Query"
          },
          "scenario": {
            "id": "Seorang analis menjalankan cross-join tanpa filter pada warehouse X-Large di hari Jumat sore. Auto-suspend tidak sengaja mati. Cluster membakar puluhan credit per jam sepanjang akhir pekan.",
            "en": "An analyst runs an unpartitioned cross-join on an X-Large warehouse on Friday. Auto-suspend was accidentally disabled, burning credits all weekend."
          },
          "breakageReason": {
            "id": "Tidak ada batas waktu eksekusi (statement timeout) dan tidak ada resource monitor yang menghentikan warehouse saat kuota habis.",
            "en": "Lack of statement execution timeouts, disabled auto-suspend, and missing resource monitors."
          },
          "fixGuide": {
            "id": "1. Wajibkan di Terraform: auto_suspend = 60 detik.\n2. Pasang STATEMENT_TIMEOUT_IN_SECONDS = 3600 agar query terhenti otomatis setelah 1 jam.\n3. Pasang Resource Monitor yang men-suspend warehouse otomatis jika anggaran bulanan mencapai 100%.",
            "en": "1. Enforce auto_suspend = 60 in Terraform.\n2. Set STATEMENT_TIMEOUT_IN_SECONDS = 3600.\n3. Configure account-level Resource Monitors suspending warehouses if budgets reach 100%."
          },
          "defensivePattern": {
            "id": "Jangan pernah membuat komputasi cloud tanpa auto-suspend, statement timeout, dan hard billing monitor.",
            "en": "Never create cloud compute resources without automated auto-suspend, statement timeouts, and hard billing limits."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa click-ops (membuat server cloud lewat klik mouse di konsol) dilarang di tim data matang?",
              "en": "Why is click-ops (manually creating cloud resources in the web console) prohibited in mature teams?"
            },
            "options": [
              {
                "id": "Karena konsol web lebih lambat",
                "en": "Because web consoles are slower"
              },
              {
                "id": "Karena kreasi manual tidak bisa diaudit riwayatnya di Git, tidak bisa di-review di pull request, dan memicu configuration drift antar environment",
                "en": "Because manual creation lacks auditability, cannot be peer-reviewed in pull requests, creates configuration drift, and cannot be recreated in disaster recovery"
              },
              {
                "id": "Karena web konsol memungut biaya per klik",
                "en": "Because web consoles charge fees per click"
              },
              {
                "id": "Karena dilarang hukum",
                "en": "Because it is illegal"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "Infrastructure as Code (IaC) memastikan lingkungan kerja reproducible, auditable, dan dapat dibangun ulang otomatis.",
              "en": "IaC guarantees repeatable, version-controlled, auditable environments that deploy deterministically."
            }
          }
        ]
      },
      {
        "id": "mod-3-5",
        "number": "3.5",
        "title": {
          "id": "AI & Vector Data Engineering (Tren 2026)",
          "en": "AI & Vector Data Engineering (The 2026 Shift)"
        },
        "duration": {
          "id": "3 Minggu",
          "en": "3 Weeks"
        },
        "summary": {
          "id": "Bangun pipeline data tidak terstruktur, chunking semantik, pembuatan embedding berskala besar dengan caching, dan database vector (pgvector/Qdrant) untuk enterprise RAG.",
          "en": "Build unstructured data ingestion pipelines, chunking, scalable embedding generation, and vector databases (pgvector/Qdrant) for enterprise RAG."
        },
        "whyTutorialsLie": {
          "id": "Tutorial AI memperlakukan vector store seperti sulap magis. Mereka mengabaikan pembaruan inkremental dokumen, biaya token API yang mahal karena tidak ada caching hash, dan masalah zombie embedding yang memicu halusinasi pada model AI.",
          "en": "AI tutorials treat vector databases like black boxes. They ignore embedding drift, chunk overlap quality, token cost management, and incremental updates when source documents change."
        },
        "concepts": [
          {
            "title": {
              "id": "Pipeline Ingestion Data Tidak Terstruktur",
              "en": "Unstructured Data Ingestion Pipelines"
            },
            "content": {
              "id": "Mengekstrak teks dan tabel dari PDF, HTML, dan transkrip audio. Normalisasi teks dan strategi pemotongan (Fixed-size vs Semantic Chunking).",
              "en": "Extracting text and tables from PDFs, HTML, and audio transcriptions. Text normalization and semantic chunking strategies."
            }
          },
          {
            "title": {
              "id": "Indeks Vector HNSW & Caching Hash",
              "en": "HNSW Vector Indexing & Content Hash Caching"
            },
            "content": {
              "id": "Memahami algoritma indeks HNSW di pgvector/Qdrant. Menghitung hash SHA-256 tiap chunk agar pipeline inkremental tidak membayar ulang API embedding untuk teks yang tidak berubah.",
              "en": "Understanding HNSW graph indexing in pgvector/Qdrant. Using SHA-256 chunk hashing to avoid redundant embedding API calls on unchanged text."
            }
          }
        ],
        "lab": {
          "title": {
            "id": "Hands-on Lab: Pipeline Feeder RAG Multi-Tenant dengan pgvector",
            "en": "Hands-on Lab: Enterprise Multi-Tenant RAG Data Feeder Pipeline"
          },
          "description": {
            "id": "Bangun pipeline inkremental yang membaca dokumen perusahaan, memotong teks secara semantik, membuat embedding dengan caching hash, dan menyimpannya ke PostgreSQL dengan ekstensi pgvector.",
            "en": "Build an incremental pipeline parsing documents, chunking text semantically, generating embeddings with hash caching, and upserting into pgvector."
          },
          "codeSnippet": "import hashlib\n\ndef get_chunk_hash(text: str) -> str:\n    return hashlib.sha256(text.encode(\"utf-8\")).hexdigest()\n\n# Simpan ke tabel pgvector dengan pelacakan hash\ndef upsert_chunks(cur, doc_id: str, chunks: list):\n    cur.execute(\"DELETE FROM document_embeddings WHERE doc_id = %s\", (doc_id,))\n    for idx, c in enumerate(chunks):\n        h = get_chunk_hash(c[\"text\"])\n        cur.execute(\n            \"INSERT INTO document_embeddings (doc_id, chunk_index, chunk_hash, embedding) VALUES (%s, %s, %s, %s)\",\n            (doc_id, idx, h, c[\"embedding\"])\n        )",
          "deliverables": [
            {
              "id": "Pipeline pemotongan teks semantik dengan hashing",
              "en": "Semantic chunking pipeline with content hashing"
            },
            {
              "id": "Tabel PostgreSQL dengan ekstensi vector dan indeks HNSW",
              "en": "PostgreSQL schema with pgvector extension and HNSW index"
            }
          ]
        },
        "chaosLab": {
          "title": {
            "id": "Skenario Rusak: Zombie Embedding & Halusinasi Kontradiktif RAG",
            "en": "Chaos Scenario: The Zombie Embedding & RAG Hallucination Disaster"
          },
          "scenario": {
            "id": "Buku panduan karyawan direvisi dengan kebijakan baru. Pipeline naif hanya me-append chunk baru ke vector database tanpa menghapus versi lama. AI asisten memberikan dua jawaban berlawanan kepada karyawan.",
            "en": "An employee handbook is revised. A naive pipeline appends new chunks without pruning old versions. An enterprise AI assistant retrieves conflicting chunks, hallucinating contradictions."
          },
          "breakageReason": {
            "id": "Memperlakukan vector store sebagai sink append-only tanpa melacak siklus hidup dokumen dan propagasi penghapusan.",
            "en": "Treating vector databases as append-only sinks without tracking document lifecycle and deletion propagation."
          },
          "fixGuide": {
            "id": "1. Lacak doc_id dan versi pada tiap chunk.\n2. Terapkan strategi delete-and-replace atomik berdasarkan doc_id.\n3. Tambahkan soft-delete tombstone record dan filter chunk aktif saat similarity search (WHERE is_active = TRUE).",
            "en": "1. Track doc_id and version on every chunk.\n2. Enforce atomic delete-and-replace keyed on doc_id.\n3. Add soft-delete tombstone flags and filter active chunks during search."
          },
          "defensivePattern": {
            "id": "Data vector tetaplah data. Terapkan disiplin siklus hidup CRUD yang sama ketatnya dengan database transaksional.",
            "en": "Vector data is still data. Treat vector stores with the same strict CRUD and lifecycle discipline as transactional databases."
          }
        },
        "quiz": [
          {
            "question": {
              "id": "Mengapa indeks HNSW (Hierarchical Navigable Small World) lebih disukai dibanding IVFFlat pada database vector berkinerja tinggi?",
              "en": "Why is the HNSW index preferred over IVFFlat in high-traffic vector databases?"
            },
            "options": [
              {
                "id": "HNSW tidak memakai memori",
                "en": "HNSW uses zero memory"
              },
              {
                "id": "HNSW membangun grafik multi-layer yang memberikan pencarian tetangga terdekat sangat cepat dengan recall tinggi tanpa perlu melatih ulang indeks saat data bertambah",
                "en": "HNSW builds a multi-layer graph providing extremely fast approximate nearest neighbor search with high recall without requiring full table retraining as data grows"
              },
              {
                "id": "HNSW adalah algoritma kompresi file",
                "en": "HNSW is a file compression algorithm"
              },
              {
                "id": "HNSW hanya berjalan di CPU lama",
                "en": "HNSW only runs on legacy CPUs"
              }
            ],
            "correct": 1,
            "explanation": {
              "id": "HNSW adalah algoritma berbasis graf yang memberikan performa query dan recall superior serta mendukung penambahan data inkremental secara mulus.",
              "en": "HNSW is a graph-based indexing algorithm delivering superior query performance and recall, seamlessly supporting incremental insertions."
            }
          }
        ]
      }
    ]
  }
];
