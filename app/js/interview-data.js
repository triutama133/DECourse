// Interview Simulator Data: System Design, SQL Arena, and Incident Post-Mortem Drills (Bilingual ID/EN)

window.INTERVIEW_DATA = {
  "systemDesignScenarios": [
    {
      "id": "sd-1",
      "title": {
        "id": "Pipeline Telemetri Ride-Hailing Real-Time (Uber / Grab)",
        "en": "Real-Time Ride-Hailing Telemetry Pipeline (Uber / Grab)"
      },
      "difficulty": "Hard",
      "tags": [
        "High Throughput",
        "Geospatial",
        "Kafka",
        "Flink",
        "Iceberg"
      ],
      "scenarioDescription": {
        "id": "Rancang platform data yang menerima ping lokasi GPS langsung dari 5 juta driver aktif setiap 4 detik (puncak 1,25 juta event/detik), mendukung pencocokan order secara instan (latensi di bawah 1 detik), dan menyimpan histori perjalanan ke lakehouse analitik untuk optimasi rute serta tarif dinamis.",
        "en": "Design a data platform that ingests real-time GPS locations from 5 million active drivers every 4 seconds (1.25M events/sec peak), enables real-time dispatch matching (sub-second latency), and stores historical trip trajectories in a lakehouse for pricing and route optimization analytics."
      },
      "stages": [
        {
          "stageName": {
            "id": "1. Klarifikasi Kebutuhan & Perhitungan Skala",
            "en": "1. Requirement Clarification & Scale Math"
          },
          "prompt": {
            "id": "Perjelas kebutuhan fungsional, batas latensi (SLA), retensi data, dan volume throughput sebelum memilih alat/teknologi.",
            "en": "Clarify functional requirements, latency SLAs, data retention, and compute traffic volume before proposing tools."
          },
          "sampleAnswer": "**Kebutuhan Fungsional & SLA:**\n- Ingest GPS ping real-time: (driver_id, lat, lon, heading, speed, timestamp, ride_status).\n- Sink latensi rendah: Lookup lokasi driver terkini untuk mesin pencocokan order (<500ms freshness).\n- Sink analitik: Histori rute perjalanan dan pendapatan driver disimpan lebih dari 3 tahun.\n\n**Perhitungan Skala (Scale Math):**\n- Driver aktif bersamaan: 5.000.000 driver.\n- Frekuensi ping: Setiap 4 detik.\n- Throughput tulis: $5.000.000 / 4 = 1.250.000$ event/detik.\n- Ukuran payload: ~200 byte per event.\n- Bandwidth jaringan masuk: $1.250.000 \\times 200\\text{ byte} = 250\\text{ MB/detik} = 2\\text{ Gbps}$.\n- Volume data harian: $250\\text{ MB/detik} \\times 86.400\\text{ detik} \\approx 21,6\\text{ TB/hari}$ uncompressed (~4-5 TB terkompresi Parquet)."
        },
        {
          "stageName": {
            "id": "2. Arsitektur Tingkat Tinggi (High-Level)",
            "en": "2. High-Level Architecture"
          },
          "prompt": {
            "id": "Gambarkan alur ingestion, stream processing, cache latensi rendah, dan penyimpanan analitik.",
            "en": "Draft the end-to-end ingestion, stream processing, low-latency cache, and analytical storage flow."
          },
          "sampleAnswer": "**Alur Arsitektur End-to-End:**\n1. **Edge Ingestion**: Aplikasi Mobile $\\rightarrow$ API Gateway (Envoy dengan mTLS) $\\rightarrow$ Cluster Kafka / Redpanda.\n   - Strategi partisi: Partisi berdasarkan Index Hexagon Geospasial `H3` (resolusi 7) atau `driver_id`.\n2. **Jalur Real-Time (<500ms)**:\n   - Stream Processing: Consumer group Apache Flink membaca Kafka.\n   - Hot Cache Sink: Tulis lokasi driver terkini ke cluster **Redis Geospatial / KeyDB** dengan TTL 15 detik.\n   - Layanan Dispatch meng-query Redis dengan `GEORADIUS` untuk mencari 10 driver terdekat dalam waktu <50ms.\n3. **Jalur Analitik / Lakehouse**:\n   - Flink / Spark Streaming micro-batch menulis ke tabel **Apache Iceberg** di S3/MinIO.\n   - Hidden partitioning berdasarkan `date(event_time)` dan `bucket(100, driver_id)`.\n   - Engine query hilir: Trino / StarRocks / DuckDB untuk pemodelan tarif dinamis dan ML feature store."
        },
        {
          "stageName": {
            "id": "3. Kasus Kerusakan & Antisipasi Kegagalan",
            "en": "3. Deep Dive & Failure Modes"
          },
          "prompt": {
            "id": "Bagaimana cara menangani lonjakan reconnect HP driver dari terowongan, partisi jaringan, dan masalah ribuan file kecil di Iceberg?",
            "en": "How do you handle mobile offline reconnect bursts, network partitions, and Iceberg small-file explosion?"
          },
          "sampleAnswer": "**Mitigasi Kegagalan Produksi:**\n1. **Offline Ping Bursts**: Saat driver keluar dari basement/terowongan, HP mengirim 200 ping sekaligus yang tertunda.\n   - Di Apache Flink, terapkan **Event-Time Watermark** (toleransi keterlambatan maksimal 2 menit).\n   - Jika ping berusia > 2 menit, lewati Redis cache (tidak relevan lagi untuk pencocokan instan) dan langsung arahkan ke data lake Iceberg.\n2. **Iceberg Small File Problem**: Menulis 1,25 juta event/detik langsung ke S3 menciptakan ribuan file Parquet mini.\n   - Flink meng-commit snapshot Iceberg setiap 1-2 menit dengan target ukuran file 128MB.\n   - Background daemon Iceberg menjalankan **Bin-Packing Compaction** setiap 1 jam dan **Z-Order sorting** harian pada `(h3_cell, event_time)`.\n3. **Jaminan Nol Kehilangan Data**: Topik Kafka dikonfigurasi dengan `acks=all`, replication factor 3, dan min.insync.replicas=2."
        }
      ]
    },
    {
      "id": "sd-2",
      "title": {
        "id": "Buku Besar Transaksi Keuangan dengan Pemrosesan Exactly-Once",
        "en": "Financial Transaction Ledger with Exactly-Once Processing"
      },
      "difficulty": "Hard",
      "tags": [
        "ACID",
        "Idempotency",
        "CDC",
        "Double-Entry",
        "Auditability"
      ],
      "scenarioDescription": {
        "id": "Rancang platform data untuk bank digital yang memproses pembayaran senilai $500 juta per hari. Sistem wajib menjamin nol transaksi hilang, nol tagihan ganda, jejak audit yang tidak bisa diubah (immutable), dan rekonsiliasi saldo sub-detik di berbagai payment gateway.",
        "en": "Design a data platform for a modern digital bank processing $500M in daily payments. The system must guarantee zero transaction loss, zero double-charging, complete immutable audit trails, and sub-second balance reconciliation across distributed payment gateways."
      },
      "stages": [
        {
          "stageName": {
            "id": "1. Batasan Kritis & Prinsip Utama",
            "en": "1. Requirements & Core Principles"
          },
          "prompt": {
            "id": "Apa saja batasan arsitektur mutlak yang tidak boleh dilanggar dalam perancangan buku besar finansial?",
            "en": "What are the non-negotiable architectural constraints for a financial ledger?"
          },
          "sampleAnswer": "**Prinsip Mutlak Rekayasa Keuangan:**\n- **Pembukuan Berpasangan (Double-Entry Bookkeeping)**: Setiap transaksi terdiri dari minimal satu debit dan satu kredit; jumlah debit wajib sama dengan jumlah kredit ($Aset = Liabilitas + Ekuitas$).\n- **Imutabilitas (Immutable)**: Baris data tidak pernah di-`UPDATE` atau di-`DELETE`. Koreksi saldo dilakukan melalui transaksi pembalik (compensating transaction).\n- **Idempotensi Ketat**: Payment gateway sering melakukan retry request; mengirim request pembayaran yang sama 10 kali harus menghasilkan tepat 1 mutasi buku besar.\n- **Auditabilitas Point-in-Time**: Kemampuan merekonstruksi saldo rekening pada milidetik manapun di masa lalu."
        },
        {
          "stageName": {
            "id": "2. Arsitektur Penulisan & Penyimpanan",
            "en": "2. Ingestion & Storage Architecture"
          },
          "prompt": {
            "id": "Rancang jalur penulisan transaksi dan lapisan persistensi buku besar.",
            "en": "Design the transaction write path and ledger persistence layer."
          },
          "sampleAnswer": "**Alur Arsitektur Penulisan Transaksi:**\n1. **Gerbang Idempotensi**:\n   - Ingestion API menerima request dengan `Idempotency-Key` (UUID v4) dari klien.\n   - Verifikasi transaksional menggunakan Redis distributed lock dan PostgreSQL unique index pada `(idempotency_key)`.\n2. **Inti Transaksional (OLTP)**:\n   - Buku besar utama disimpan di PostgreSQL / CockroachDB multi-region.\n   - Skema berpasangan: `ledger_entries (id, tx_id, account_id, amount, direction, created_at)`.\n3. **Ingestion Streaming & Analitik (OLAP)**:\n   - Debezium Change Data Capture membaca Write-Ahead Log (WAL) Postgres tanpa membebani transaksi aktif.\n   - Event dipancarkan ke Redpanda dengan transactional producer ID.\n   - Tabel Apache Iceberg di S3 menyimpan arsip transaksi dengan kepatuhan WORM (Write Once, Read Many)."
        },
        {
          "stageName": {
            "id": "3. Rekonsiliasi & Penanganan Kasus Ekstrem",
            "en": "3. Reconciliation & Edge Cases"
          },
          "prompt": {
            "id": "Bagaimana mendeteksi selisih saldo dan menangani webhook penyelesaian pembayaran yang datang terlambat?",
            "en": "How do you detect ledger discrepancies and handle out-of-order webhook settlements?"
          },
          "sampleAnswer": "**Mekanisme Rekonsiliasi:**\n1. **Pemeriksaan Real-Time Berkelanjutan**: Flink stream processor menghitung total saldo debit vs kredit setiap 10 detik; mengirim peringatan darurat ke PagerDuty jika $\\sum(\\text{debit}) - \\sum(\\text{kredit}) \\ne 0$.\n2. **Rekonsiliasi Batch Akhir Hari (EOD)**: Dagster pipeline mengunduh file settlement eksternal dari Visa/Mastercard/Stripe dan menjalankan query rekonsiliasi join otomatis terhadap buku besar internal. Transaksi yang belum cocok dialihkan ke antrean verifikasi manual.\n3. **Pengujian Kualitas Data**: Singular test otomatis di dbt memvalidasi invarian saldo dan memastikan tidak ada akun tanpa pemilik."
        }
      ]
    },
    {
      "id": "sd-3",
      "title": {
        "id": "Mesin Clickstream & Atribusi E-Commerce (1 Miliar Event/Hari)",
        "en": "E-Commerce Clickstream & Attribution Engine (1B Events/Day)"
      },
      "difficulty": "Hard",
      "tags": [
        "Clickstream",
        "Sessionization",
        "Attribution",
        "dbt",
        "DuckDB/Trino"
      ],
      "scenarioDescription": {
        "id": "Rancang mesin pelacakan aktivitas klik pengguna dan atribusi pemasaran multi-sentuh untuk retailer global dengan volume 1 miliar interaksi per hari. Tim pemasaran membutuhkan laporan first-touch, last-touch, dan linear attribution yang diperbarui setiap 30 menit.",
        "en": "Design a clickstream tracking and multi-touch marketing attribution engine for a global retailer processing 1 billion user interactions per day. Marketing teams require first-touch, last-touch, and linear attribution reporting updated every 30 minutes."
      },
      "stages": [
        {
          "stageName": {
            "id": "1. Perhitungan Skala & Kebutuhan",
            "en": "1. Scale & Requirements"
          },
          "prompt": {
            "id": "Tentukan skema data, logika pengelompokan sesi (sessionization), dan estimasi kapasitas penyimpanan untuk 1 miliar klik/hari.",
            "en": "Define data schemas, sessionization logic, and compute storage footprint for 1B daily clicks."
          },
          "sampleAnswer": "**Metrik Skala & Kebutuhan:**\n- 1.000.000.000 event/hari $\\approx 11.500$ event/detik rata-rata, puncak 35.000 event/detik.\n- Ukuran data mentah: ~300 GB/hari. Terkompresi Parquet: ~40 GB/hari.\n- Kebutuhan bisnis: Mengelompokkan event ke dalam sesi (timeout inaktivitas 30 menit) dan menghubungkan transaksi pembelian dengan riwayat channel iklan yang dilihat user dalam 30 hari terakhir."
        },
        {
          "stageName": {
            "id": "2. Arsitektur Pemrosesan Pipeline",
            "en": "2. Pipeline Architecture"
          },
          "prompt": {
            "id": "Rancang DAG untuk ingestion, sessionization, dan kalkulasi model atribusi pemasaran.",
            "en": "Outline the ingestion, sessionization, and attribution modeling DAG."
          },
          "sampleAnswer": "**Alur Pipeline:**\n1. **SDK / Ingestion**: Mobile & Web SDK mengirim event ke Amazon Kinesis / Redpanda.\n2. **Landing Staging**: Spark Streaming menulis micro-batch mentah ke tabel landing Apache Iceberg.\n3. **Sessionization (dbt Incremental / Dagster)**:\n   - Model sessionization berjalan per jam menggunakan fungsi SQL Window (`LAG(event_time)` dan kumulatif `SUM(is_new_session)`).\n4. **Mesin Atribusi**:\n   - Hubungkan `fct_orders` dengan touchpoint sesi user selama 30 hari sebelum checkout.\n   - Hitung:\n     - **First-Touch**: 100% komisi diberikan ke channel iklan pertama yang memperkenalkan user.\n     - **Last-Touch**: 100% komisi diberikan ke channel terakhir yang diklik sebelum bayar.\n     - **Linear (Multi-Touch)**: Membagi nilai belanja rata ke seluruh channel yang disentuh user."
        },
        {
          "stageName": {
            "id": "3. Optimasi Biaya & Query Skala Besar",
            "en": "3. Trade-offs & Optimization"
          },
          "prompt": {
            "id": "Bagaimana mengoptimalkan biaya query join 30 hari terhadap 30 miliar baris catatan aktivitas?",
            "en": "Explain how you optimize query costs on a 30-day attribution join across 30 billion records."
          },
          "sampleAnswer": "**Strategi Optimasi Biaya Query:**\n1. **Partition Pruning Tingkat Pengguna**: Saring event touchpoint dengan `user_id IN (SELECT DISTINCT user_id FROM todays_orders)` sebelum menjalankan query window attribution yang berat.\n2. **Z-Ordering & Clustering**: Terapkan Z-Order pada tabel Iceberg berdasarkan `(user_id, event_time)` agar data milik satu pengguna berada di file Parquet yang sama secara berdekatan.\n3. **Pemrosesan Incremental Berbasis Watermark**: Pertahankan tabel status atribusi persisten daripada memindai ulang seluruh histori 30 hari dari awal setiap 30 menit."
        }
      ]
    },
    {
      "id": "sd-4",
      "title": {
        "id": "Enterprise Lakehouse Multi-Tenant dengan Kepatuhan GDPR Right-to-be-Forgotten",
        "en": "Multi-Tenant Enterprise Lakehouse with GDPR Right-to-be-Forgotten"
      },
      "difficulty": "Hard",
      "tags": [
        "GDPR",
        "Lakehouse",
        "ACID",
        "Row-Level Security",
        "Iceberg"
      ],
      "scenarioDescription": {
        "id": "Rancang arsitektur lakehouse enterprise untuk platform SaaS B2B dengan 10.000 pelanggan bisnis. Sistem harus mengisolasi data antar-tenant secara mutlak dan mematuhi regulasi GDPR Penghapusan Data (Right-to-be-Forgotten) dalam 30 hari tanpa mengganggu performa analitik.",
        "en": "Design an enterprise lakehouse platform for a B2B SaaS with 10,000 corporate clients. The architecture must strictly enforce tenant data isolation and fulfill GDPR Right-to-be-Forgotten deletion mandates within 30 days without crippling lakehouse analytics."
      },
      "stages": [
        {
          "stageName": {
            "id": "1. Isolasi Data & Kepatuhan Regulasi",
            "en": "1. Isolation & Compliance Strategy"
          },
          "prompt": {
            "id": "Bandingkan pendekatan isolasi multi-tenant (database terpisah vs tabel bersama dengan row-level security) dan tantangan penghapusan data di penyimpanan Parquet berbasis objek.",
            "en": "Compare multi-tenant isolation strategies (database-per-tenant vs shared tables with RLS) and explain why GDPR deletes are notoriously difficult on Parquet object storage."
          },
          "sampleAnswer": "**Tantangan & Strategi Isolasi:**\n- File Parquet di object storage bersifat **Immutable** (tidak dapat dimodifikasi di tempat). Menghapus 1 baris ID user berarti membaca file 128MB, membuang 1 baris, dan menulis file Parquet baru! Jika ada 1.000 request hapus GDPR per hari, penulisan ulang file ini akan memicu ledakan biaya komputasi S3.\n- Solusi: Gunakan **Apache Iceberg Merge-on-Read (MoR)** dengan Positional Delete Files. Penghapusan baris hanya menulis file kecil berisi nomor baris yang dihapus tanpa menyentuh file Parquet asli. Pembersihan fisik dilakukan oleh compaction terjadwal mingguan."
        },
        {
          "stageName": {
            "id": "2. Alur Eksekusi Penghapusan Terjadwal",
            "en": "2. Automated Erasure Pipeline"
          },
          "prompt": {
            "id": "Rancang pipeline orkestrasi yang mengumpulkan request GDPR dan mengeksekusi penghapusan menyeluruh hingga ke backup dan metadata.",
            "en": "Architect the orchestration DAG that collects GDPR deletion requests and purges data across historical partitions and metadata catalogs."
          },
          "sampleAnswer": "**Alur Orkestrasi Penghapusan Data (GDPR):**\n1. **Tabel Antrean Permintaan**: Request penghapusan akun disimpan di tabel PostgreSQL `gdpr_erasure_requests (user_id, tenant_id, request_time, status)`.\n2. **Karantina Instan (T-0)**: Tambahkan filter Row-Level Security pada query engine (Trino) agar user yang meminta hapus langsung tidak terlihat di query analitik.\n3. **Pembersihan Batch Mingguan (T-7)**: Dagster pipeline membaca kumpulan ID yang perlu dihapus dan menjalankan `DELETE FROM lakehouse.events WHERE user_id IN (...)` memanfaatkan format Iceberg MoR.\n4. **Verifikasi & Sertifikat Audit**: Setelah file dikompilasi ulang dan snapshot lama kedaluwarsa, terbitkan bukti log audit bertanda tangan kriptografis untuk membuktikan data telah terhapus."
        }
      ]
    }
  ],
  "sqlArenaProblems": [
    {
      "id": "sql-1",
      "title": {
        "id": "Gaps & Islands: Menghitung Rentetan Aktivitas Pengguna Berturut-turut",
        "en": "The Gaps & Islands: Contiguous User Activity Streaks"
      },
      "difficulty": "Hard",
      "company": "Meta / Netflix",
      "category": "Window Functions & Analytical SQL",
      "problemStatement": {
        "id": "Diberikan tabel log aktivitas pengguna harian: `user_activity (user_id, activity_date)`.\nSatu pengguna bisa memiliki beberapa baris pada tanggal yang sama. Tulis query SQL untuk menghitung rentang hari aktif berturut-turut terpanjang (streak terpanjang) untuk setiap `user_id`.",
        "en": "Given a daily user activity log: `user_activity (user_id, activity_date)`.\nA user may have multiple entries per day. Write an SQL query to calculate the maximum contiguous active streak (longest daily streak) for each `user_id`."
      },
      "schema": "CREATE TABLE user_activity (user_id INT, activity_date DATE);",
      "solutionSql": "-- Langkah 1: Hilangkan duplikat tanggal untuk user yang sama\nWITH distinct_activity AS (\n    SELECT DISTINCT user_id, activity_date\n    FROM user_activity\n),\n-- Langkah 2: Berikan nomor urut dan hitung pengelompokan pulau (island)\nranked_activity AS (\n    SELECT\n        user_id,\n        activity_date,\n        activity_date - CAST(ROW_NUMBER() OVER (\n            PARTITION BY user_id \n            ORDER BY activity_date\n        ) AS INT) AS streak_island_group\n    FROM distinct_activity\n),\n-- Langkah 3: Hitung panjang hari dalam setiap kelompok pulau\nstreak_lengths AS (\n    SELECT\n        user_id,\n        streak_island_group,\n        COUNT(*) AS streak_days\n    FROM ranked_activity\n    GROUP BY user_id, streak_island_group\n)\n-- Langkah 4: Ambil streak terpanjang untuk masing-masing user\nSELECT\n    user_id,\n    MAX(streak_days) AS longest_active_streak\nFROM streak_lengths\nGROUP BY user_id\nORDER BY longest_active_streak DESC;",
      "explanation": {
        "id": "Kunci intuisi dari masalah Gaps & Islands adalah mengurangi tanggal berturut-turut dengan urutan angka yang bertambah secara seragam (`ROW_NUMBER()`). Tanggal yang berurutan bertambah dengan rasio yang sama dengan rank, sehingga selisih `activity_date - rank` selalu konstan untuk hari-hari berturut-turut. Saat ada jeda hari (gap), nilai selisih melompat dan membentuk 'pulau' (island) baru.",
        "en": "The key intuition of the Gaps and Islands problem is subtracting a monotonically increasing sequence (`ROW_NUMBER()`) from the date. Consecutive dates increment at the same rate as the rank, making `activity_date - rank` constant for consecutive streaks. A gap causes the constant value to jump, creating a new 'island'."
      },
      "complexity": "Time: $O(N \\log N)$ for sorting partition, Space: $O(N)$ for window state."
    },
    {
      "id": "sql-2",
      "title": {
        "id": "Atribusi Pemasaran First-Touch vs Last-Touch",
        "en": "First-Touch vs Last-Touch Marketing Attribution"
      },
      "difficulty": "Medium-Hard",
      "company": "Amazon / Shopify",
      "category": "Window Functions & Joins",
      "problemStatement": {
        "id": "Anda memiliki dua tabel:\n1. `marketing_touches (touch_id, user_id, channel, touch_time)`\n2. `orders (order_id, user_id, order_value, order_time)`\n\nTulis query untuk menentukan bagi setiap order:\n- `first_channel` iklan pertama yang disentuh user sebelum berbelanja.\n- `last_channel` iklan terakhir yang disentuh user tepat sebelum transaksi.\nHanya perhitungkan sentuhan iklan yang terjadi dalam 30 hari sebelum order dibuat.",
        "en": "You have two tables:\n1. `marketing_touches (touch_id, user_id, channel, touch_time)`\n2. `orders (order_id, user_id, order_value, order_time)`\n\nWrite a query that determines for each order:\n- The `first_channel` the user interacted with prior to the order.\n- The `last_channel` the user interacted with immediately prior to the order.\nOnly consider touches that occurred within 30 days prior to the order."
      },
      "schema": "CREATE TABLE marketing_touches (touch_id INT, user_id INT, channel TEXT, touch_time TIMESTAMP);\nCREATE TABLE orders (order_id INT, user_id INT, order_value NUMERIC, order_time TIMESTAMP);",
      "solutionSql": "WITH eligible_touches AS (\n    SELECT\n        o.order_id,\n        o.user_id,\n        o.order_value,\n        o.order_time,\n        t.channel,\n        t.touch_time,\n        ROW_NUMBER() OVER (\n            PARTITION BY o.order_id \n            ORDER BY t.touch_time ASC\n        ) AS touch_asc_rank,\n        ROW_NUMBER() OVER (\n            PARTITION BY o.order_id \n            ORDER BY t.touch_time DESC\n        ) AS touch_desc_rank\n    FROM orders o\n    INNER JOIN marketing_touches t\n        ON o.user_id = t.user_id\n       AND t.touch_time < o.order_time\n       AND t.touch_time >= o.order_time - INTERVAL '30 days'\n)\nSELECT\n    order_id,\n    user_id,\n    order_value,\n    order_time,\n    MAX(CASE WHEN touch_asc_rank = 1 THEN channel END) AS first_touch_channel,\n    MAX(CASE WHEN touch_desc_rank = 1 THEN channel END) AS last_touch_channel\nFROM eligible_touches\nGROUP BY order_id, user_id, order_value, order_time;",
      "explanation": {
        "id": "Kita melakukan join antara order dengan touchpoint pemasaran dalam rentang 30 hari, menghitung dual rank `ROW_NUMBER()` (ascending untuk first touch, descending untuk last touch), lalu mengagregasi hasilnya dengan `MAX(CASE WHEN ...)` kondisional.",
        "en": "We join orders to touches bounded by the 30-day lookback window, compute dual `ROW_NUMBER()` ranks (ascending for first touch, descending for last touch), and then aggregate using conditional `MAX(CASE WHEN...)`."
      },
      "complexity": "Time: $O(N \\log M)$ where $M$ is touches per user."
    },
    {
      "id": "sql-3",
      "title": {
        "id": "Deduplikasi Idempoten dengan Prioritas Versi Data",
        "en": "Idempotent Deduplication with Prioritized Versioning"
      },
      "difficulty": "Medium",
      "company": "Stripe / Snowflake",
      "category": "Deduplication & QUALIFY",
      "problemStatement": {
        "id": "Event stream memasukkan pembaruan data ke tabel staging append-only `order_events (event_id, order_id, status, payload_version, event_time)`.\nTulis query untuk mengambil 1 baris kebenaran tunggal terkini untuk setiap `order_id`, diprioritaskan pertama berdasarkan `payload_version` tertinggi, dan jika versi sama, berdasarkan `event_time` terbaru. Gunakan klausa `QUALIFY` modern.",
        "en": "An event stream pushes updates into an append-only staging table `order_events (event_id, order_id, status, payload_version, event_time)`.\nWrite a query to retrieve the current single truth record for each `order_id`, prioritized first by highest `payload_version`, and if versions are tied, by latest `event_time`. Optimize for Snowflake/BigQuery using `QUALIFY`."
      },
      "schema": "CREATE TABLE order_events (event_id TEXT, order_id TEXT, status TEXT, payload_version INT, event_time TIMESTAMP);",
      "solutionSql": "-- Sintaks modern Snowflake / BigQuery / DuckDB dengan klausa QUALIFY\nSELECT\n    order_id,\n    status,\n    payload_version,\n    event_time\nFROM order_events\nQUALIFY ROW_NUMBER() OVER (\n    PARTITION BY order_id \n    ORDER BY payload_version DESC, event_time DESC\n) = 1;",
      "explanation": {
        "id": "Klausa `QUALIFY` menyederhanakan filtering fungsi window tanpa memerlukan CTE atau subquery bertingkat. Pola ini sangat hemat memori dan sering ditanyakan interviewer di perusahaan skala modern.",
        "en": "The `QUALIFY` clause filters window functions directly without subqueries or CTE overhead, reducing query complexity and query planner shuffle memory."
      },
      "complexity": "Time: $O(N \\log K)$ where $K$ is events per order."
    },
    {
      "id": "sql-4",
      "title": {
        "id": "Perhitungan Rolling 7-Day Active Users (DAU/WAU Ratio)",
        "en": "Rolling 7-Day Active Users & Retention Calculation"
      },
      "difficulty": "Medium",
      "company": "LinkedIn / Airbnb",
      "category": "Window Framing & Self-Joins",
      "problemStatement": {
        "id": "Diberikan tabel login harian `user_logins (user_id, login_date)`.\nTulis query untuk menghitung metrik Rolling 7-Day Active Users untuk setiap tanggal dalam kurun waktu 90 hari terakhir (jumlah unik pengguna yang aktif dalam 7 hari terakhir dari tanggal pelaporan).",
        "en": "Given daily user logins table `user_logins (user_id, login_date)`.\nWrite a query calculating the Rolling 7-Day Active Users metric for every date over the last 90 days (count of distinct users active in the 7 days ending on that date)."
      },
      "schema": "CREATE TABLE user_logins (user_id INT, login_date DATE);",
      "solutionSql": "WITH date_spine AS (\n    SELECT DISTINCT login_date AS report_date\n    FROM user_logins\n    WHERE login_date >= CURRENT_DATE - INTERVAL '90 days'\n)\nSELECT\n    d.report_date,\n    COUNT(DISTINCT u.user_id) AS rolling_7d_active_users\nFROM date_spine d\nINNER JOIN user_logins u\n    ON u.login_date BETWEEN d.report_date - INTERVAL '6 days' AND d.report_date\nGROUP BY d.report_date\nORDER BY d.report_date ASC;",
      "explanation": {
        "id": "Menggunakan Date Spine yang di-join dengan rentang interval 7 hari memastikan tidak ada tanggal yang hilang dan menghitung pengguna unik dengan akurat tanpa double-counting dalam rentang 7 hari tersebut.",
        "en": "Joining against a contiguous date spine ensures no dates are skipped, accurately calculating distinct active users without double-counting."
      },
      "complexity": "Time: $O(D \\times U)$ where $D$ is date spine and $U$ is window slice."
    }
  ],
  "incidentPostMortemDrills": [
    {
      "id": "drill-1",
      "title": {
        "id": "Lonjakan Consumer Lag Kafka & Crash OOM di Jam Sibuk",
        "en": "Production Kafka Consumer Lag Spike & OOM Crash"
      },
      "scenario": {
        "id": "Pukul 14.15 WIB saat promo belanja tanggal kembar dimulai, antrean lag Kafka melonjak dari 5.000 menjadi 3.200.000 pesan. Container Flink/Spark mati karena Out Of Memory (OOMKilled exit code 137). Tim operasional menyatakan status insiden SEV-1.",
        "en": "At 2:15 PM during flash sale launch, Kafka consumer lag explodes from 5,000 to 3,200,000 messages. Worker containers crash with Out Of Memory (OOMKilled exit code 137). SEV-1 incident declared."
      },
      "rubric": [
        {
          "phase": {
            "id": "0-15 Menit: Triage Awal & Mitigasi Dampak",
            "en": "0-15 Min: Immediate Triage & Impact Mitigation"
          },
          "action": {
            "id": "Buka saluran komunikasi insiden (Slack #war-room). Periksa grafik metrik CPU, RAM, dan network di Grafana. Identifikasi apakah lag terjadi di seluruh partisi atau terkonsentrasi di 1 partisi tertentu (data skew). Naikkan alokasi RAM JVM executor sementara dan tingkatkan jumlah thread worker consumer.",
            "en": "Spin up #war-room Slack channel. Check Grafana partition lag distribution. Check if lag is uniform or concentrated in one hot partition (data skew). Temporarily scale up JVM executor memory and consumer worker threads."
          }
        },
        {
          "phase": {
            "id": "15-45 Menit: Analisis Akar Masalah",
            "en": "15-45 Min: Root Cause Analysis"
          },
          "action": {
            "id": "Periksa log stack trace sebelum container mati. Temukan apakah OOM disebabkan oleh batch size yang terlalu besar saat catch-up (`max.poll.records`), state rocksdb leak, atau satu transaksi berukuran gigabyte dari satu akun anomali.",
            "en": "Inspect crash logs for OOM heap dumps. Identify if crash was triggered by massive unthrottled catch-up poll batches (`max.poll.records`), state rocksdb leak, or giant anomalous payloads."
          }
        },
        {
          "phase": {
            "id": "45-60 Menit: Pemulihan & Solusi Permanen",
            "en": "45-60 Min: Resolution & Permanent Guardrail"
          },
          "action": {
            "id": "Terapkan pembatasan rate limiting pada consumer (`max.poll.records=500`). Aktifkan backpressure otomatis di framework streaming. Buat alert dini saat laju lag meningkat 3x dalam 5 menit.",
            "en": "Apply consumer polling rate limits (`max.poll.records=500`). Enable automated backpressure mechanisms. Configure early-warning alerts triggering on 3x lag velocity within 5 minutes."
          }
        }
      ]
    },
    {
      "id": "drill-2",
      "title": {
        "id": "Spark Shuffle Spill-to-Disk Membuat Pipeline Molor 6 Jam",
        "en": "Spark Shuffle Spill-to-Disk Memory Bottleneck"
      },
      "scenario": {
        "id": "Pipeline harian yang biasanya selesai dalam 35 menit tiba-tiba berjalan selama 5 jam dan belum selesai. Dashboard eksekutif pagi belum menerima data. Stage join di Spark terhenti pada task ke 199 dari 200.",
        "en": "Daily pipeline normally completing in 35 minutes has been running for 5 hours. Executive morning dashboards are stale. Spark stage hangs on task 199 of 200."
      },
      "rubric": [
        {
          "phase": {
            "id": "0-15 Menit: Diagnosa UI Spark",
            "en": "0-15 Min: Spark UI Diagnosis"
          },
          "action": {
            "id": "Buka Spark UI pada tab 'Stages'. Perhatikan durasi task: 199 task selesai dalam 2 menit, sementara 1 task terakhir memakan waktu 4 jam. Periksa kolom 'Shuffle Read Size' dan 'Spill (Memory / Disk)'.",
            "en": "Navigate to Spark UI Stages tab. Inspect task duration summary: 199 tasks finished in 2 minutes, 1 task has taken 4 hours. Check 'Spill (Memory)' and 'Spill (Disk)' metrics."
          }
        },
        {
          "phase": {
            "id": "15-45 Menit: Penanganan Data Skew",
            "en": "15-45 Min: Data Skew Remediation"
          },
          "action": {
            "id": "Akar masalah adalah data skew berat (misal kolom `merchant_id = NULL` atau satu merchant raksasa memiliki 50 juta baris). Terapkan teknik Salting pada join key atau aktifkan Adaptive Query Execution (`spark.sql.adaptive.skewJoin.enabled=true`).",
            "en": "Root cause identified as massive data skew on join key (e.g. `merchant_id = NULL` or top enterprise tenant). Apply salt prefix to join key or enable Adaptive Query Execution (`spark.sql.adaptive.skewJoin.enabled=true`)."
          }
        },
        {
          "phase": {
            "id": "45-60 Menit: Pencegahan Jangka Panjang",
            "en": "45-60 Min: Long-term Architecture Fix"
          },
          "action": {
            "id": "Pisahkan pemrosesan akun-akun raksasa ke jalur komputasi terpisah (isolated compute tier) dan buat aturan monitoring distribusi frekuensi key harian.",
            "en": "Isolate high-volume tenant keys into dedicated processing jobs and implement daily key distribution profiling in CI."
          }
        }
      ]
    }
  ]
};
