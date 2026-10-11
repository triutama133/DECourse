// Portfolio Data: 3 Production-Grade Capstones with ADRs and Interview Defense Playbooks (Bilingual ID/EN)

window.PORTFOLIO_DATA = {
  "projects": [
    {
      "id": "proj-1",
      "title": {
        "id": "The Zero-Cost Modern Lakehouse di Laptop Anda",
        "en": "The Zero-Cost Modern Lakehouse on Your Laptop"
      },
      "badge": {
        "id": "Modern Lakehouse",
        "en": "Modern Lakehouse"
      },
      "badgeColor": "emerald",
      "summary": {
        "id": "Platform lakehouse end-to-end yang berjalan di laptop menggunakan MinIO, Apache Iceberg, DuckDB, dbt Core, Dagster, dan automated CI/CD tanpa biaya cloud sepeser pun.",
        "en": "End-to-end lakehouse platform running MinIO, Apache Iceberg, DuckDB, dbt Core, Dagster, and automated CI/CD with zero cloud expenses."
      },
      "whyHiringManagersLoveIt": {
        "id": "Membuktikan Anda memahami jeroan format tabel (metadata Iceberg, snapshot, pemadatan/compaction), Software-Defined Assets, dan pengujian CI/CD tanpa bergantung pada tools SaaS berbayar. Menunjukkan kematangan rekayasa daripada sekadar konsumerisme alat.",
        "en": "Proves you understand table format internals (Iceberg metadata, snapshots, compaction), Software-Defined Assets, and CI/CD testing without relying on expensive SaaS tools. It shows engineering maturity over tool consumerism."
      },
      "architecture": [
        {
          "id": "**Lapisan Penyimpanan**: MinIO (object storage kompatibel S3) berjalan di Docker dengan pemisahan bucket bertahap (raw, bronze, silver, gold).",
          "en": "**Storage Layer**: MinIO S3-compatible object store running in Docker with partitioned storage buckets (raw, bronze, silver, gold)."
        },
        {
          "id": "**Lapisan Format Tabel**: Apache Iceberg dengan REST catalog memberikan transaksi ACID, time travel, dan evolusi skema tanpa penulisan ulang data.",
          "en": "**Table Format Layer**: Apache Iceberg with PyIceberg / REST catalog providing ACID transactions, time travel, and schema evolution."
        },
        {
          "id": "**Transformasi & Pemodelan**: dbt Core yang mengeksekusi query di DuckDB (mesin analitik tervektorisasi berkecepatan tinggi) dengan model incremental merge.",
          "en": "**Transformation & Modeling**: dbt Core running against DuckDB vectorized in-process query engine with incremental merge models."
        },
        {
          "id": "**Orkestrasi**: Dagster Software-Defined Assets (SDA) yang mengelola dependensi aset data berpartisi dengan kemampuan backfilling otomatis.",
          "en": "**Orchestration**: Dagster Software-Defined Assets (SDAs) orchestrating partitioned data assets with backfilling capability."
        },
        {
          "id": "**Kualitas & Tata Kelola Data**: Data Contracts dengan Pydantic dan Great Expectations yang memverifikasi integritas data sebelum masuk ke lakehouse.",
          "en": "**Quality & Governance**: Data Contracts with Pydantic and Great Expectations checkpoint assertions on ingestion."
        }
      ],
      "adr": {
        "title": {
          "id": "ADR-001: Pemilihan Apache Iceberg Menggantikan Hive dan Delta Lake",
          "en": "ADR-001: Selection of Apache Iceberg over Hive and Delta Lake"
        },
        "status": "Accepted",
        "context": {
          "id": "Kami memerlukan format tabel terbuka yang menyediakan transaksi ACID, evolusi skema, dan partisi tersembunyi (hidden partitioning) untuk beban kerja analitik di object storage tanpa keterikatan pada vendor cloud tertentu.",
          "en": "We needed an open table format providing ACID transactions, schema evolution, and partition evolution for analytical workloads on object storage without cloud vendor lock-in."
        },
        "decision": {
          "id": "Kami memilih Apache Iceberg karena arsitektur metadatanya yang hierarkis (Catalog -> Metadata JSON -> Manifest List -> Manifest -> Data Files). Iceberg sepenuhnya mengabstraksi tata letak direktori fisik melalui hidden partitioning, mencegah kegagalan query saat pengguna memfilter kolom tanggal alami.",
          "en": "We chose Apache Iceberg due to its metadata architecture (Catalog -> Metadata JSON -> Manifest List -> Manifest -> Data Files). Iceberg completely abstracts physical directory layout through hidden partitioning, preventing query failures when users filter on natural columns."
        },
        "consequences": {
          "id": "Positif: Isolasi snapshot penuh, evolusi skema tanpa rewrite file Parquet, interoperabilitas multi-engine (DuckDB, Trino, Spark). Negatif: Memerlukan proses background maintenance berkala (compaction dan snapshot expiration) untuk mengelola penumpukan file manifes.",
          "en": "Positive: Full snapshot isolation, zero-rewrite schema evolution, cross-engine interoperability (DuckDB, Trino, Spark). Negative: Requires background maintenance jobs (compaction and snapshot expiration) to manage manifest file bloat."
        }
      },
      "repoStructure": "lakehouse-core/\n├── .github/workflows/ci.yml       # Slim CI pipeline (SQLFluff, pytest, dbt test)\n├── docker-compose.yml             # MinIO + Iceberg REST Catalog + Dagster\n├── dagster_pipelines/             # Software-Defined Assets\n│   ├── assets/\n│   │   ├── raw_ingestion.py\n│   │   └── lakehouse_sync.py\n│   └── repository.py\n├── dbt_transforms/                # dbt Core project\n│   ├── models/\n│   │   ├── staging/\n│   │   ├── intermediate/\n│   │   └── marts/\n│   └── tests/\n├── tests/                         # pytest unit and integration tests\n├── docs/adrs/                     # Architecture Decision Records\n└── README.md                      # Comprehensive production docs",
      "interviewDefense": [
        {
          "id": "**T: Mengapa memilih DuckDB daripada Snowflake atau BigQuery?**\n*J:* DuckDB mengeksekusi query analitik langsung pada file Parquet/Iceberg menggunakan instruksi vektor SIMD tanpa overhead serialisasi jaringan. Untuk data hingga 100GB, DuckDB berjalan di laptop dalam hitungan detik dengan biaya nol, membuktikan bahwa arsitektur yang efisien lebih penting daripada membakar anggaran cloud pada masalah sederhana.",
          "en": "**Q: Why DuckDB instead of Snowflake or BigQuery?**\n*A:* DuckDB executes analytical queries directly on Parquet/Iceberg files using vectorized SIMD instructions without network serialization overhead. For datasets up to 100GB, DuckDB runs on a single node in seconds with zero cloud cost, demonstrating that architecture matters more than throwing cloud compute credits at simple problems."
        },
        {
          "id": "**T: Bagaimana Anda menangani perubahan nama kolom (schema evolution) di data hulu?**\n*J:* Di Apache Iceberg, setiap kolom dilacak berdasarkan Integer Field ID yang tidak berubah, bukan berdasarkan nama kolom teks. Ketika nama kolom diubah, Iceberg hanya memperbarui file metadata JSON yang sangat ringan tanpa menulis ulang file Parquet di disk. Query hilir tetap berjalan lancar.",
          "en": "**Q: How do you handle schema evolution when an upstream column is renamed?**\n*A:* In Iceberg, columns are tracked by immutable integer field IDs rather than column names. When a column is renamed, Iceberg updates only the lightweight metadata JSON file without rewriting underlying Parquet files. Downstream queries resolve the new name seamlessly."
        },
        {
          "id": "**T: Bagaimana Anda mengatasi masalah ribuan file kecil (Small File Problem)?**\n*J:* Saya menerapkan proses maintenance berkala terjadwal di Dagster yang memicu PyIceberg compaction job menggunakan teknik bin-packing untuk menggabungkan file-file di bawah 64MB menjadi file Parquet berukuran optimal 128MB, diikuti pembersihan snapshot lama untuk menghemat kapasitas storage.",
          "en": "**Q: How do you prevent small file performance degradation?**\n*A:* I implemented a scheduled Dagster maintenance asset that triggers PyIceberg / Spark compaction jobs using bin-packing to merge files smaller than 64MB into optimal 128MB Parquet files, followed by snapshot expiration to reclaim storage."
        }
      ]
    },
    {
      "id": "proj-2",
      "title": {
        "id": "Platform Streaming CDC Real-Time dengan Debezium & Redpanda",
        "en": "Real-Time CDC & Streaming Platform"
      },
      "badge": {
        "id": "Streaming & CDC",
        "en": "Streaming & CDC"
      },
      "badgeColor": "amber",
      "summary": {
        "id": "Pipeline Change Data Capture (CDC) standar produksi yang men-stream event WAL PostgreSQL melalui Debezium dan Redpanda ke lakehouse Apache Iceberg lengkap dengan alert real-time.",
        "en": "Production-grade Change Data Capture pipeline streaming PostgreSQL WAL events via Debezium and Redpanda into an Apache Iceberg lakehouse with real-time alerting."
      },
      "whyHiringManagersLoveIt": {
        "id": "Menunjukkan penguasaan sistem terdistribusi sejati: arsitektur berbasis commit-log, manajemen offset, penanganan event terlambat dengan watermarks, dan replikasi database tanpa membebani OLTP.",
        "en": "Demonstrates true distributed systems knowledge: log-centric architectures, offset management, out-of-order event handling with watermarks, and zero OLTP impact database replication."
      },
      "architecture": [
        {
          "id": "**Sumber Transaksional**: Database PostgreSQL dengan `wal_level=logical` yang mensimulasikan transaksi e-commerce langsung.",
          "en": "**Source**: PostgreSQL database with `wal_level=logical` simulating live e-commerce transactions."
        },
        {
          "id": "**Mesin CDC**: Debezium PostgreSQL Connector membaca Write-Ahead Log langsung tanpa melakukan query table lock pada tabel transaksi.",
          "en": "**CDC Engine**: Debezium PostgreSQL Connector reading Write-Ahead Log events without acquiring table locks."
        },
        {
          "id": "**Tulang Punggung Streaming**: Redpanda (mesin C++ kompatibel Kafka) dikonfigurasi dengan 3 partisi dan commit offset manual yang tangguh.",
          "en": "**Streaming Backbone**: Redpanda (C++ Kafka-compatible engine) configured with 3 partitions and manual offset commit semantics."
        },
        {
          "id": "**Pemroses Aliran Data**: Apache Flink / Spark Streaming menghitung rolling volume transaksi 5 menit dengan event-time watermark.",
          "en": "**Stream Processor**: Apache Flink / Spark Structured Streaming calculating rolling 5-minute transaction volume with watermarks."
        },
        {
          "id": "**Sink & Pemantauan**: Tabel Iceberg di MinIO + dashboard Streamlit real-time yang memantau metrik sub-detik.",
          "en": "**Sink & Monitoring**: Apache Iceberg table on MinIO + Streamlit real-time dashboard displaying sub-second metrics."
        }
      ],
      "adr": {
        "title": {
          "id": "ADR-002: Pemilihan Debezium WAL Decoding daripada Database Polling",
          "en": "ADR-002: Selection of Debezium WAL Decoding over Database Polling"
        },
        "status": "Accepted",
        "context": {
          "id": "Bisnis membutuhkan replikasi transaksi dengan latensi sub-detik ke data lakehouse tanpa mengurangi performa query pada database PostgreSQL produksi.",
          "en": "The business required sub-second transactional replication to analytics without degrading performance on the production transactional PostgreSQL database."
        },
        "decision": {
          "id": "Kami mengimplementasikan decoding logis Debezium via plugin `pgoutput`. Debezium membaca log Write-Ahead (WAL) langsung dari disk tanpa menjalankan query `SELECT * FROM table WHERE updated_at > ...`.",
          "en": "We implemented Debezium logical decoding via `pgoutput` plugin. Debezium tails the Write-Ahead Log (WAL) directly from disk without running `SELECT` queries on application tables."
        },
        "consequences": {
          "id": "Positif: Nol konflik lock tabel, menangkap event DELETE dan intermediate updates yang terlewat oleh polling. Negatif: Perlu memantau kapasitas disk WAL Postgres secara ketat agar disk tidak penuh saat consumer mengalami lag.",
          "en": "Positive: Zero table lock contention, captures DELETE events, captures intermediate updates that occurred between polls. Negative: Requires careful monitoring of Postgres WAL disk space to avoid filling database partitions if the CDC consumer lags."
        }
      },
      "repoStructure": "streaming-cdc-platform/\n├── docker-compose.yml             # Postgres, Debezium Connect, Redpanda, Console\n├── streaming_engine/\n│   ├── flink_job.py               # Watermarked tumbling window processing\n│   └── kafka_consumer.py          # Resilient consumer with DLQ and manual commit\n├── debezium_connectors/\n│   └── register_postgres.json     # Debezium CDC configuration\n├── dashboard/\n│   └── app.py                     # Real-time Streamlit monitor\n├── tests/\n│   └── test_cdc_events.py         # Unit tests simulating out-of-order events\n└── docs/adrs/ADR-002.md",
      "interviewDefense": [
        {
          "id": "**T: Apa yang terjadi jika consumer CDC mati selama 2 jam?**\n*J:* Redpanda menyimpan pesan yang belum ter-commit di commit log persistennya. PostgreSQL menahan segmen WAL di slot replikasi. Saat dinyalakan kembali, consumer melanjutkan dari offset terakhir yang tercatat. Untuk mencegah disk Postgres penuh saat downtime lama, kami menetapkan batas `max_slot_wal_keep_size`.",
          "en": "**Q: What happens if the CDC consumer crashes for 2 hours?**\n*A:* Redpanda stores the uncommitted messages safely in its persistent commit log. PostgreSQL retains WAL segments in its replication slot. Upon restart, the consumer resumes from the last committed offset and catches up. To prevent WAL disk exhaustion during prolonged outages, we set `max_slot_wal_keep_size` on Postgres."
        },
        {
          "id": "**T: Bagaimana Anda menangani data yang datang terlambat (late data) pada streaming window?**\n*J:* Kami menerapkan Event-Time Watermarking dengan toleransi keterlambatan 3 menit. Data yang tiba dalam rentang 3 menit akan memperbarui rolling agregasi. Data yang terlambat lebih dari 3 menit akan dialihkan melalui Flink Side-Output ke antrean Dead-Letter Queue untuk audit.",
          "en": "**Q: How do you handle late-arriving events in the streaming window?**\n*A:* We implement Event-Time Watermarking with a 3-minute allowed lateness threshold. Events arriving within 3 minutes of the watermark update the rolling aggregations. Events arriving later than 3 minutes bypass the state window and are emitted via a Flink side-output to an audit dead-letter queue."
        },
        {
          "id": "**T: Bagaimana cara menjamin pemrosesan exactly-once secara end-to-end?**\n*J:* Mengaktifkan idempotent producer di Redpanda (`enable.idempotence=true`), digabungkan dengan checkpointing Flink two-phase commit ke snapshot Iceberg, sehingga tidak akan pernah ada data ganda bahkan saat node worker restart mendadak.",
          "en": "**Q: How do you guarantee exactly-once processing end-to-end?**\n*A:* Idempotent producer in Redpanda (`enable.idempotence=true`), combined with Flink two-phase commit checkpointing into Apache Iceberg snapshot commits, ensuring no duplicate rows even during worker node restarts."
        }
      ]
    },
    {
      "id": "proj-3",
      "title": {
        "id": "Mesin FinOps & Observabilitas Data Perusahaan",
        "en": "Enterprise FinOps & Data Observability Engine"
      },
      "badge": {
        "id": "FinOps & Ops",
        "en": "FinOps & Ops"
      },
      "badgeColor": "rose",
      "summary": {
        "id": "Sistem audit biaya otomatis dan penegakan Data Contract yang menganalisis histori query, mendeteksi scan tabel tanpa partisi, dan menandai pergeseran skema di data warehouse cloud.",
        "en": "Automated cost auditing and data contract enforcement engine that analyzes query history, detects unpartitioned scans, and flags schema drift across cloud warehouses."
      },
      "whyHiringManagersLoveIt": {
        "id": "Dampak bisnis langsung. Engineer junior berbicara tentang sintaks; engineer senior berbicara tentang cara menghemat $100.000 tagihan cloud perusahaan dan mencegah kegagalan pipeline sebelum sampai ke dashboard direksi.",
        "en": "Direct business impact. Junior engineers talk about syntax; senior engineers talk about saving the company $100,000 in cloud bills and preventing pipeline outages before they hit executive dashboards."
      },
      "architecture": [
        {
          "id": "**Ingestion Metadata**: Pengambilan otomatis histori query dari warehouse cloud (Snowflake `QUERY_HISTORY` atau BigQuery `INFORMATION_SCHEMA`).",
          "en": "**Metadata Ingestion**: Automated ingestion of cloud warehouse query history logs (Snowflake `QUERY_HISTORY` or BigQuery `INFORMATION_SCHEMA`)."
        },
        {
          "id": "**Detektor Anomali Biaya**: Algoritma Python yang mendeteksi scan tabel penuh tanpa partisi, query mahal yang diulang-ulang, dan warehouse idle yang lupa dimatikan.",
          "en": "**Cost Anomaly Detector**: Python algorithms identifying unpartitioned full-table scans, repetitive expensive queries, and idle warehouse timeouts."
        },
        {
          "id": "**Daemon Optimasi Otomatis**: Menghasilkan rekomendasi pemadatan tabel (compaction), perbaikan pruning partisi, dan laporan biaya per divisi kerja.",
          "en": "**Automated Optimization Daemon**: Triggers partition pruning recommendations, automated table compaction, and generates cost attribution reports by team."
        },
        {
          "id": "**Gerbang Penegakan Kontrak Data**: GitHub Actions yang memindai setiap Pull Request dbt model baru dan menolak query yang diprediksi melebihi batas anggaran.",
          "en": "**Contract Enforcement Gate**: GitHub Actions action that scans incoming dbt model PRs and blocks queries projected to exceed cost thresholds."
        }
      ],
      "adr": {
        "title": {
          "id": "ADR-003: Kebijakan Timeout Query & Auto-Suspend Otomatis di Warehouse",
          "en": "ADR-003: Automated Warehouse Query Timeout & Auto-Suspend Governance"
        },
        "status": "Accepted",
        "context": {
          "id": "Biaya data warehouse melonjak 140% dalam dua kuartal berturut-turut akibat query ad-hoc yang tidak terawasi dan durasi idle warehouse yang dibiarkan menyala berjam-jam.",
          "en": "Cloud warehouse spend increased by 140% over two quarters due to unmonitored ad-hoc queries and long warehouse idle timeout configurations."
        },
        "decision": {
          "id": "Kami menerapkan aturan Infrastructure as Code yang mewajibkan `AUTO_SUSPEND = 60` detik pada seluruh warehouse dan menetapkan batas waktu maksimal eksekusi query (timeout) 1.800 detik.",
          "en": "We implemented automated Infrastructure as Code rules setting warehouse `AUTO_SUSPEND = 60` seconds and enforcing statement execution timeouts of 1,800 seconds on analytical compute pools."
        },
        "consequences": {
          "id": "Positif: Memangkas total biaya komputasi sebesar 42% pada bulan pertama tanpa mengganggu SLA produksi. Negatif: Beberapa query eksplorasi analis yang sangat berat memerlukan konfigurasi sesi khusus.",
          "en": "Positive: Reduced overall compute spend by 42% in the first month without affecting production SLAs. Negative: Occasional heavy legitimate exploratory queries require explicit session timeout overrides."
        }
      },
      "repoStructure": "finops-observability/\n├── terraform/                     # Warehouse governance & resource monitors\n│   ├── warehouses.tf\n│   └── alerts.tf\n├── auditing_engine/\n│   ├── query_analyzer.py          # Identifies unpartitioned scans & Cartesian joins\n│   └── cost_allocator.py          # Attributes spend to engineering cost centers\n├── contract_linter/\n│   └── lint_data_contracts.py     # CI/CD action blocking breaking schema PRs\n├── reports/\n│   └── monthly_cost_report.md\n└── README.md",
      "interviewDefense": [
        {
          "id": "**T: Bagaimana Anda menemukan sumber pemborosan biaya cloud terbesar?**\n*J:* Saya mengekstrak `INFORMATION_SCHEMA.QUERY_HISTORY` untuk menghitung rasio biaya per query. Dengan mengurutkan query termahal, ditemukan bahwa hanya 5% query yang menghabiskan 68% total anggaran komputasi. Penyebab utamanya adalah Cartesian Join dan scan tabel miliaran baris tanpa filter partisi tanggal.",
          "en": "**Q: How did you identify the biggest sources of wasted cloud spend?**\n*A:* I queried `INFORMATION_SCHEMA.QUERY_HISTORY` to compute cost per query ($Credits = WarehouseSize \\times ExecutionTime$). By sorting on total credits consumed, I discovered that 5% of queries accounted for 68% of total spend. The primary culprits were Cartesian non-equi joins and full-table scans on tables missing date partitioning."
        },
        {
          "id": "**T: Bagaimana Anda memastikan kualitas data tanpa memperlambat kecepatan rilis tim?**\n*J:* Kami menerapkan dbt Slim CI di GitHub Actions. Dengan membandingkan PR terhadap manifest produksi (`state:modified+`), CI hanya menguji model dbt yang disentuh oleh PR tersebut, menjaga runtime CI di bawah 3 menit sambil mempertahankan cakupan pengujian 100%.",
          "en": "**Q: How do you enforce data quality without slowing down deployment velocity?**\n*A:* We use dbt Slim CI in GitHub Actions. By comparing the PR against the production manifest (`state:modified+`), we only run tests on models touched by the PR, keeping CI runtimes under 3 minutes while maintaining 100% test coverage."
        },
        {
          "id": "**T: Bagaimana Anda mengukur keberhasilan inisiatif Data Engineering kepada pimpinan eksekutif?**\n*J:* Menggunakan tiga metrik kuantitatif: 1) Kesegaran Data & Kepatuhan SLA (% dashboard pagi yang selesai sebelum jam 07:00), 2) Tingkat Insiden Pipeline (kecepatan mendeteksi dan menyelesaikan kegagalan skema), dan 3) Efisiensi Biaya (biaya komputasi per satu juta event yang di-ingest).",
          "en": "**Q: How do you measure the success of a data engineering initiative to executive leadership?**\n*A:* Through three quantifiable metrics: 1) Data Freshness & SLA adherence (percentage of morning dashboards updated before 7:00 AM), 2) Pipeline incident rate (mean time to detect and resolve schema violations), and 3) Cost efficiency (compute cost per million ingested events)."
        }
      ]
    }
  ]
};
