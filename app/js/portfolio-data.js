// Portfolio Data: 3 Production-Grade Capstones with ADRs and Interview Defense Playbooks

window.PORTFOLIO_DATA = {
  projects: [
    {
      id: "proj-1",
      title: "The Zero-Cost Modern Lakehouse on Your Laptop",
      badge: "Modern Lakehouse",
      badgeColor: "emerald",
      summary: "End-to-end lakehouse platform running MinIO, Apache Iceberg, DuckDB, dbt Core, Dagster, and automated CI/CD with zero cloud expenses.",
      whyHiringManagersLoveIt: "Proves you understand table format internals (Iceberg metadata, snapshots, compaction), Software-Defined Assets, and CI/CD testing without relying on expensive SaaS tools. It shows engineering maturity over tool consumerism.",
      architecture: [
        "**Storage Layer**: MinIO S3-compatible object store running in Docker with partitioned storage buckets (raw, bronze, silver, gold).",
        "**Table Format Layer**: Apache Iceberg with PyIceberg / REST catalog providing ACID transactions, time travel, and schema evolution.",
        "**Transformation & Modeling**: dbt Core running against DuckDB vectorized in-process query engine with incremental merge models.",
        "**Orchestration**: Dagster Software-Defined Assets (SDAs) orchestrating partitioned data assets with backfilling capability.",
        "**Quality & Governance**: Data Contracts with Pydantic and Great Expectations checkpoint assertions on ingestion."
      ],
      adr: {
        title: "ADR-001: Selection of Apache Iceberg over Hive and Delta Lake",
        status: "Accepted",
        context: "We needed an open table format providing ACID transactions, schema evolution, and partition evolution for analytical workloads on object storage without cloud vendor lock-in.",
        decision: "We chose Apache Iceberg due to its metadata architecture (Catalog -> Metadata JSON -> Manifest List -> Manifest -> Data Files). Iceberg completely abstracts physical directory layout through hidden partitioning, preventing query failures when users filter on natural columns.",
        consequences: "Positive: Full snapshot isolation, zero-rewrite schema evolution, cross-engine interoperability (DuckDB, Trino, Spark). Negative: Requires background maintenance jobs (compaction and snapshot expiration) to manage manifest file bloat."
      },
      repoStructure: `lakehouse-core/
├── .github/workflows/ci.yml       # Slim CI pipeline (SQLFluff, pytest, dbt test)
├── docker-compose.yml             # MinIO + Iceberg REST Catalog + Dagster
├── dagster_pipelines/             # Software-Defined Assets
│   ├── assets/
│   │   ├── raw_ingestion.py
│   │   └── lakehouse_sync.py
│   └── repository.py
├── dbt_transforms/                # dbt Core project
│   ├── models/
│   │   ├── staging/
│   │   ├── intermediate/
│   │   └── marts/
│   └── tests/
├── tests/                         # pytest unit and integration tests
├── docs/adrs/                     # Architecture Decision Records
└── README.md                      # Comprehensive production docs`,
      interviewDefense: [
        "**Q: Why DuckDB instead of Snowflake or BigQuery?**\n*A:* DuckDB executes analytical queries directly on Parquet/Iceberg files using vectorized SIMD instructions without network serialization overhead. For datasets up to 100GB, DuckDB runs on a single node in seconds with zero cloud cost, demonstrating that architecture matters more than throwing cloud compute credits at simple problems.",
        "**Q: How do you handle schema evolution when an upstream column is renamed?**\n*A:* In Iceberg, columns are tracked by immutable integer field IDs rather than column names. When a column is renamed, Iceberg updates only the lightweight metadata JSON file without rewriting underlying Parquet files. Downstream queries resolve the new name seamlessly.",
        "**Q: How do you prevent small file performance degradation?**\n*A:* I implemented a scheduled Dagster maintenance asset that triggers PyIceberg / Spark compaction jobs using bin-packing to merge files smaller than 64MB into optimal 128MB Parquet files, followed by snapshot expiration to reclaim storage."
      ]
    },
    {
      id: "proj-2",
      title: "Real-Time CDC & Streaming Platform",
      badge: "Streaming & CDC",
      badgeColor: "amber",
      summary: "Production-grade Change Data Capture pipeline streaming PostgreSQL WAL events via Debezium and Redpanda into an Apache Iceberg lakehouse with real-time alerting.",
      whyHiringManagersLoveIt: "Demonstrates true distributed systems knowledge: log-centric architectures, offset management, out-of-order event handling with watermarks, and zero OLTP impact database replication.",
      architecture: [
        "**Source**: PostgreSQL database with `wal_level=logical` simulating live e-commerce transactions.",
        "**CDC Engine**: Debezium PostgreSQL Connector reading Write-Ahead Log events without acquiring table locks.",
        "**Streaming Backbone**: Redpanda (C++ Kafka-compatible engine) configured with 3 partitions and manual offset commit semantics.",
        "**Stream Processor**: Apache Flink / Spark Structured Streaming calculating rolling 5-minute transaction volume with watermarks.",
        "**Sink & Monitoring**: Apache Iceberg table on MinIO + Streamlit real-time dashboard displaying sub-second metrics."
      ],
      adr: {
        title: "ADR-002: Selection of Debezium WAL Decoding over Database Polling",
        status: "Accepted",
        context: "The business required sub-second transactional replication to analytics without degrading performance on the production transactional PostgreSQL database.",
        decision: "We implemented Debezium logical decoding via `pgoutput` plugin. Debezium tails the Write-Ahead Log (WAL) directly from disk without running `SELECT` queries on application tables.",
        consequences: "Positive: Zero table lock contention, captures DELETE events, captures intermediate updates that occurred between polls. Negative: Requires careful monitoring of Postgres WAL disk space to avoid filling database partitions if the CDC consumer lags."
      },
      repoStructure: `streaming-cdc-platform/
├── docker-compose.yml             # Postgres, Debezium Connect, Redpanda, Console
├── streaming_engine/
│   ├── flink_job.py               # Watermarked tumbling window processing
│   └── kafka_consumer.py          # Resilient consumer with DLQ and manual commit
├── debezium_connectors/
│   └── register_postgres.json     # Debezium CDC configuration
├── dashboard/
│   └── app.py                     # Real-time Streamlit monitor
├── tests/
│   └── test_cdc_events.py         # Unit tests simulating out-of-order events
└── docs/adrs/ADR-002.md`,
      interviewDefense: [
        "**Q: What happens if the CDC consumer crashes for 2 hours?**\n*A:* Redpanda stores the uncommitted messages safely in its persistent commit log. PostgreSQL retains WAL segments in its replication slot. Upon restart, the consumer resumes from the last committed offset and catches up. To prevent WAL disk exhaustion during prolonged outages, we set `max_slot_wal_keep_size` on Postgres.",
        "**Q: How do you handle late-arriving events in the streaming window?**\n*A:* We implement Event-Time Watermarking with a 3-minute allowed lateness threshold. Events arriving within 3 minutes of the watermark update the rolling aggregations. Events arriving later than 3 minutes bypass the state window and are emitted via a Flink side-output to an audit dead-letter queue.",
        "**Q: How do you guarantee exactly-once processing end-to-end?**\n*A:* Idempotent producer in Redpanda (`enable.idempotence=true`), combined with Flink two-phase commit checkpointing into Apache Iceberg snapshot commits, ensuring no duplicate rows even during worker node restarts."
      ]
    },
    {
      id: "proj-3",
      title: "Enterprise FinOps & Data Observability Engine",
      badge: "FinOps & Ops",
      badgeColor: "rose",
      summary: "Automated cost auditing and data contract enforcement engine that analyzes query history, detects unpartitioned scans, and flags schema drift across cloud warehouses.",
      whyHiringManagersLoveIt: "Direct business impact. Junior engineers talk about syntax; senior engineers talk about saving the company $100,000 in cloud bills and preventing pipeline outages before they hit executive dashboards.",
      architecture: [
        "**Metadata Ingestion**: Automated ingestion of cloud warehouse query history logs (Snowflake `QUERY_HISTORY` or BigQuery `INFORMATION_SCHEMA`).",
        "**Cost Anomaly Detector**: Python algorithms identifying unpartitioned full-table scans, repetitive expensive queries, and idle warehouse timeouts.",
        "**Automated Optimization Daemon**: Triggers partition pruning recommendations, automated table compaction, and generates cost attribution reports by team.",
        "**Contract Enforcement Gate**: GitHub Actions action that scans incoming dbt model PRs and blocks queries projected to exceed cost thresholds."
      ],
      adr: {
        title: "ADR-003: Automated Warehouse Query Timeout & Auto-Suspend Governance",
        status: "Accepted",
        context: "Cloud warehouse spend increased by 140% over two quarters due to unmonitored ad-hoc queries and long warehouse idle timeout configurations.",
        decision: "We implemented automated Infrastructure as Code rules setting warehouse `AUTO_SUSPEND = 60` seconds and enforcing statement execution timeouts of 1,800 seconds on analytical compute pools.",
        consequences: "Positive: Reduced overall compute spend by 42% in the first month without affecting production SLAs. Negative: Occasional heavy legitimate exploratory queries require explicit session timeout overrides."
      },
      repoStructure: `finops-observability/
├── terraform/                     # Warehouse governance & resource monitors
│   ├── warehouses.tf
│   └── alerts.tf
├── auditing_engine/
│   ├── query_analyzer.py          # Identifies unpartitioned scans & Cartesian joins
│   └── cost_allocator.py          # Attributes spend to engineering cost centers
├── contract_linter/
│   └── lint_data_contracts.py     # CI/CD action blocking breaking schema PRs
├── reports/
│   └── monthly_cost_report.md
└── README.md`,
      interviewDefense: [
        "**Q: How did you identify the biggest sources of wasted cloud spend?**\n*A:* I queried `INFORMATION_SCHEMA.QUERY_HISTORY` to compute cost per query ($Credits = WarehouseSize \\times ExecutionTime$). By sorting on total credits consumed, I discovered that 5% of queries accounted for 68% of total spend. The primary culprits were Cartesian non-equi joins and full-table scans on tables missing date partitioning.",
        "**Q: How do you enforce data quality without slowing down deployment velocity?**\n*A:* We use dbt Slim CI in GitHub Actions. By comparing the PR against the production manifest (`state:modified+`), we only run tests on models touched by the PR, keeping CI runtimes under 3 minutes while maintaining 100% test coverage.",
        "**Q: How do you measure the success of a data engineering initiative to executive leadership?**\n*A:* Through three quantifiable metrics: 1) Data Freshness & SLA adherence (percentage of morning dashboards updated before 7:00 AM), 2) Pipeline incident rate (mean time to detect and resolve schema violations), and 3) Cost efficiency (compute cost per million ingested events)."
      ]
    }
  ]
};

