# DataForge: The Anti-Tutorial-Hell Data Engineering Operating System

> **A comprehensive, production-grade learning system and web application designed for self-mastery from Beginner to Advanced, complete with Chaos Labs, System Design Simulators, Portfolio Blueprints with ADRs, and an ATS CV Builder.**

---

## ⚡ Quick Start (Launch Web App)

The DataForge web application runs with **zero external npm dependencies** and is 100% self-contained.

### Option 1: Node.js
```bash
npm start
# OR
node app/server.js
```

### Option 2: Python
```bash
python3 server.py
```

Then open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## 🧭 Why "Anti-Tutorial-Hell"?

Most data engineering courses fail students because they teach **syntax on clean toy datasets** (Iris, Titanic, pre-cleaned CSVs). In the real world:
- 70% of engineering time is spent on dirty data, schema drift, network partitions, late-arriving events, and out-of-memory errors.
- Real systems require **Data Contracts**, **idempotent pipelines**, **automated tests (`pytest`)**, **CI/CD**, and **cost optimization (FinOps)**.
- Hiring managers reject cookie-cutter Kaggle portfolios within 5 seconds.

DataForge enforces a **4-Pillar Engineering Framework**:
1. **First Principles Before Frameworks**: Understand memory layout, disk serialization, and distributed shuffles before touching tools.
2. **Chaos & Breakage Labs**: Every module features deliberate production failures (corrupt schemas, OOM executors, race conditions, non-idempotent appends).
3. **Production Rigor**: Data contracts, unit testing, dbt slim CI, and automated verification gates.
4. **Proof-of-Work Portfolios**: 3 enterprise capstones accompanied by Architectural Decision Records (ADRs) and interview defense scripts.

---

## 📚 Curriculum Matrix

### 🟢 Level 1: Foundations (The Software Engineering Mindset)
- **Module 1.1**: Modern Linux, Shell Scripting & Docker for Data Pipelines
- **Module 1.2**: Production Python for DE (Generators, Pydantic v2, pytest fixtures)
- **Module 1.3**: Advanced SQL Mastery & Execution Plans (Window functions, Gaps & Islands, EXPLAIN ANALYZE)
- **Module 1.4**: Dimensional Data Modeling (Kimball Star Schema, Facts, Dims, SCD Types 1-6, OBT)

### 🟡 Level 2: The Modern Lakehouse & Transformation
- **Module 2.1**: Columnar Compute, DuckDB & Polars (Vectorized execution, Apache Arrow)
- **Module 2.2**: Open Table Formats: Apache Iceberg & Delta Lake (Metadata trees, ACID commits, hidden partitioning, compaction)
- **Module 2.3**: Transformation with dbt Core & Data Contracts (Medallion architecture, incremental merges, slim CI)
- **Module 2.4**: Asset-Oriented Orchestration: Dagster & Airflow (Software-Defined Assets, idempotency, backfills)
- **Module 2.5**: Data Quality, Observability & Contracts (Great Expectations, OpenLineage, SLA monitors)

### 🔴 Level 3: Distributed Scale & Real-Time Streaming
- **Module 3.1**: Distributed Computing & Apache Spark Internals (Catalyst optimizer, Tungsten, data skew salting, OOM debugging)
- **Module 3.2**: Event Streaming & Change Data Capture (Kafka / Redpanda, WAL logical decoding with Debezium, consumer lag)
- **Module 3.3**: Real-Time Stream Processing: Flink & Spark Streaming (Event time, watermarks, tumbling/sliding windows)
- **Module 3.4**: Infrastructure as Code (Terraform) & FinOps (Least privilege, automated auto-suspend, cost auditing)
- **Module 3.5**: AI & Vector Data Engineering (Unstructured document pipelines, semantic chunking, pgvector/Qdrant RAG)

---

## 🎯 Career Acceleration Suite

### 1. Interactive Interview Simulator
- **System Design Studio**: 8 enterprise scenarios (Uber ride telemetry, Financial ledger with double-entry, E-commerce 1B clicks, GDPR lakehouse deletion) with 4-phase interactive scoring rubrics.
- **SQL & Data Modeling Arena**: 15+ LeetCode-hard and FAANG interview problems with solution reveals and execution plans.
- **Incident Post-Mortem Drills**: 60-minute crisis triage protocols (The Silent Metric Drop, Upstream Breaking Schema Push, Runaway Cloud Spend).

### 2. Portfolio Architecture Blueprints
- **Capstone 1**: The Zero-Cost Modern Lakehouse (MinIO + Iceberg + DuckDB + dbt Core + Dagster + CI/CD).
- **Capstone 2**: Real-Time CDC & Streaming Platform (Postgres WAL + Debezium + Redpanda + Flink/Spark + Iceberg).
- **Capstone 3**: Enterprise FinOps & Observability Engine (Query log audit, Iceberg compaction optimizer).
- Includes formal **Architectural Decision Records (ADR-001, ADR-002, ADR-003)** and interview defense playbooks.

### 3. ATS CV Architect & Scorer
- Powered by the Google XYZ formula: *"Accomplished [X], as measured by [Y], by doing [Z]"*.
- Real-time scoring against 4 criteria: Metrics Density, Modern Tech Stack Signals, DE vs DA Differentiation, and Action Verbs.
- One-click print/PDF preview and senior DE template.

---

## 🐳 Optional Local Lab Stack (Docker)

To spin up real local infrastructure for hands-on labs (MinIO S3, Postgres CDC, Redpanda):
```bash
docker compose up -d
```
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)
- **Redpanda Console**: [http://localhost:8080](http://localhost:8080)
- **Postgres CDC**: `localhost:5432` (`production` DB, `wal_level=logical`)

---

## 📂 Repository Structure

```
dataengineeringCourse/
├── app/                      # Interactive Web Application
│   ├── index.html            # Main SPA Interface
│   ├── css/style.css         # Modern dark-mode styling
│   ├── js/
│   │   ├── app.js            # App controller & routing
│   │   ├── curriculum-data.js# Full syllabus, labs & chaos scenarios
│   │   ├── interview-data.js # System design, SQL arena & incident drills
│   │   ├── portfolio-data.js # 3 Capstones, ADRs & interview defense
│   │   ├── cv-data.js        # CV builder & ATS scoring rules
│   │   └── playground.js     # In-browser SQL execution engine
│   └── server.js             # Zero-dependency Node.js server
├── curriculum/               # Deep-dive guides & notes
├── labs/                     # Hands-on code templates & chaos exercises
├── career/                   # Career assets (CV, ADRs, rubrics)
├── docker-compose.yml        # Local lab infrastructure
├── package.json              # Project scripts
└── server.py                 # Python web server
```

# DECourse
