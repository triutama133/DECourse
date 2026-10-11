// CV Data: ATS Resume Blueprint, Metric Formula Library, and Scoring Engine

window.CV_DATA = {
  formulaGuideline: {
    name: "The XYZ Impact Formula",
    formula: "Accomplished [X], as measured by [Y], by doing [Z]",
    explanation: {
      id: "Perekrut global dan filter ATS mencari dampak hasil rekayasa yang terukur, bukan sekadar daftar deskripsi tugas pasif. Jangan tulis 'Bertanggung jawab membuat pipeline data'. Sebutkan volume data, penurunan latensi, penghematan biaya server, atau peningkatan keandalan.",
      en: "Hiring managers and ATS filters look for measurable engineering outcomes, not passive job descriptions. Never write 'Responsible for data pipelines'. Instead, quantify the volume, latency reduction, cost savings, or reliability improvement."
    },
    examples: [
      {
        bad: "Responsible for creating ETL pipelines in Python and SQL.",
        good: "Architected end-to-end Lakehouse ingestion engine in Python and Apache Iceberg, processing 45M daily events with 99.98% pipeline uptime."
      },
      {
        bad: "Used Snowflake and dbt to build dashboards.",
        good: "Refactored 80+ legacy dbt models and implemented partition pruning in Snowflake, reducing monthly warehouse compute spend by 38% ($45,000/year)."
      },
      {
        bad: "Managed Kafka clusters and fixed broken jobs.",
        good: "Engineered real-time CDC pipeline using Debezium and Redpanda, reducing data freshness latency from 4 hours to sub-15 seconds across 12 microservices."
      }
    ]
  },

  bulletLibrary: [
    {
      category: "Lakehouse & Storage (Iceberg / Delta / MinIO)",
      bullets: [
        "Architected an open Lakehouse platform using Apache Iceberg, DuckDB, and MinIO, eliminating cloud vendor lock-in and enabling ACID snapshot isolation across 15TB of analytical data.",
        "Engineered automated Iceberg table maintenance workflows (bin-packing compaction and snapshot expiration), reducing S3 metadata GET operations by 65% and improving query latency by 4x.",
        "Implemented schema evolution and hidden partitioning strategies in Apache Iceberg, preventing pipeline breakages across 40+ upstream schema migrations."
      ]
    },
    {
      category: "Real-Time Streaming & CDC (Kafka / Redpanda / Flink)",
      bullets: [
        "Deployed real-time Change Data Capture (CDC) using Debezium and Redpanda on PostgreSQL, streaming 12,000 tx/sec with zero locking overhead on the primary transactional database.",
        "Engineered stateful Apache Flink stream processing pipeline with 3-minute event-time watermarking, processing out-of-order financial events with end-to-end exactly-once delivery guarantees.",
        "Tuned Kafka consumer thread pools and sticky partition assignors, mitigating rebalance storms and slashing consumer lag from 1.5M messages to near-zero."
      ]
    },
    {
      category: "Transformation, Modeling & CI/CD (dbt / SQL / Git)",
      bullets: [
        "Designed enterprise Kimball Dimensional Star Schema and Bus Matrix across 6 business processes, consolidating 25 disparate data silos into a single source of truth.",
        "Implemented dbt Slim CI in GitHub Actions using state:modified+ comparisons, reducing pull-request test execution runtime from 35 minutes to 3.5 minutes.",
        "Enforced strict Data Contracts and Pydantic schema validation at ingestion boundaries, eliminating 95% of downstream data mart breakages caused by upstream schema drift."
      ]
    },
    {
      category: "Distributed Compute & Tuning (Spark / PySpark)",
      bullets: [
        "Diagnosed severe data skew in PySpark shuffle joins and applied key salting techniques, reducing critical daily batch runtime from 4.5 hours to 32 minutes.",
        "Tuned Spark Catalyst physical plans and JVM executor memory allocations, completely eliminating memory spill-to-disk errors across 80GB shuffle stages.",
        "Replaced inefficient iterative loop queries with vectorized PySpark window aggregations, scaling processing throughput to 100M+ rows daily."
      ]
    },
    {
      category: "Cloud Governance & FinOps (AWS / GCP / Terraform)",
      bullets: [
        "Authored modular Terraform infrastructure-as-code for multi-environment Lakehouse (Dev/Staging/Prod), enforcing IAM least-privilege policies and automated KMS encryption.",
        "Conducted comprehensive warehouse query auditing and implemented automated auto-suspend and statement timeout policies, saving $52,000 in annual cloud compute spend.",
        "Configured S3 Intelligent-Tiering and automated glacier lifecycle policies, cutting long-term analytical storage costs by 48%."
      ]
    }
  ],

  sampleResume: {
    personal: {
      fullName: "Alex Pratama",
      title: "Senior Data Engineer",
      email: "alex.pratama@email.com",
      phone: "+62 812-3456-7890",
      location: "Jakarta, Indonesia (Open to Remote)",
      linkedin: "linkedin.com/in/alex-pratama-de",
      github: "github.com/alex-pratama"
    },
    summary: "Senior Data Engineer with 4+ years of experience designing high-throughput distributed pipelines, modern Lakehouse architectures, and real-time streaming systems. Proven track record of slashing cloud compute spend by 40%+, implementing zero-lock CDC, and achieving 99.98% pipeline SLA using Apache Iceberg, dbt Core, Redpanda/Kafka, and Dagster.",
    skills: {
      languages: "Python (Pydantic, PySpark, Polars, pytest), SQL (PostgreSQL, DuckDB, Trino), Bash, Rust (Basic)",
      storageTableFormats: "Apache Iceberg, Delta Lake, MinIO, Parquet, S3, PostgreSQL, Redis",
      processingStreaming: "Apache Spark / PySpark, DuckDB, Apache Flink, Apache Kafka, Redpanda, Debezium CDC",
      orchestrationOps: "Dagster (Software-Defined Assets), Apache Airflow, dbt Core, Docker, Terraform, GitHub Actions (CI/CD)",
      observabilityQuality: "Data Contracts, Great Expectations, OpenLineage, SQLFluff, Prometheus"
    },
    experience: [
      {
        company: "PayWave Financial",
        role: "Senior Data Platform Engineer",
        period: "2024 - Present",
        location: "Jakarta, Indonesia",
        highlights: [
          "Architected real-time Change Data Capture (CDC) streaming using Debezium and Redpanda from PostgreSQL, reducing analytics data latency from 4 hours to sub-15 seconds across 10M+ daily transactions.",
          "Implemented Apache Iceberg Lakehouse on MinIO/S3 with automated bin-packing compaction, reducing downstream Trino query scan times by 62%.",
          "Engineered dbt Core transformation layer enforcing strict Data Contracts and slim CI/CD, eliminating 90% of downstream reporting anomalies.",
          "Conducted warehouse cost optimization by refactoring unpartitioned queries and setting automated statement timeouts, saving $38,000 in annual cloud infrastructure expenses."
        ]
      },
      {
        company: "OmniRetail Commerce",
        role: "Data Engineer",
        period: "2022 - 2024",
        location: "Jakarta, Indonesia",
        highlights: [
          "Designed Kimball Star Schema and automated daily ingestion pipelines processing 35GB of clickstream and order data using Python and PySpark.",
          "Tuned skewed PySpark shuffle joins using key salting and broadcast join hints, reducing execution time from 2.5 hours to 28 minutes.",
          "Built Dagster orchestration workflows with automated daily partitions, managing reliable idempotent backfills for 18 months of historical telemetry."
        ]
      }
    ],
    projects: [
      {
        name: "Zero-Cost Modern Lakehouse Engine",
        tech: "MinIO, Apache Iceberg, DuckDB, dbt Core, Dagster, Docker",
        description: "Open-source local lakehouse with ACID transactions, time travel, schema evolution, and automated CI/CD with full Architectural Decision Records (ADRs)."
      },
      {
        name: "Real-Time Fraud Detection CDC Pipeline",
        tech: "Postgres WAL, Debezium, Redpanda, PySpark Streaming, Iceberg",
        description: "Sub-second CDC streaming architecture with event-time watermarking, detecting transaction volume anomalies and handling out-of-order mobile events."
      }
    ]
  },

  scoringEngine: {
    rules: [
      {
        id: "metrics_density",
        name: "Quantifiable Metrics & Numbers",
        description: "Bullets should contain measurable numbers (%, $, GB/TB, ms, events/sec).",
        weight: 25
      },
      {
        id: "modern_tech_stack",
        name: "Modern Data Stack Presence",
        description: "Detects modern standards (Iceberg, DuckDB, dbt, Dagster, Kafka/Redpanda, CI/CD, Contracts).",
        weight: 25
      },
      {
        id: "de_differentiation",
        name: "DE vs DA Role Differentiation",
        description: "Rewards distributed systems, latency, throughput, reliability, and penalizes purely passive reporting phrases.",
        weight: 25
      },
      {
        id: "action_verbs",
        name: "Strong Engineering Action Verbs",
        description: "Detects active verbs: Architected, Engineered, Optimized, Refactored, Provisioned, Deployed.",
        weight: 25
      }
    ]
  }
};

