# DataForge

A self-study data engineering course that runs in your browser: a curriculum with hands-on labs and "chaos" scenarios, a SQL sandbox with auto-checked challenges, interview practice, portfolio blueprints and a resume builder. UI languages: Indonesian and English.

> **Status:** All 17 modules are complete in both **English and Indonesian** (curriculum, labs, chaos scenarios, and quizzes).

## Run it

```bash
npm start          # or: python3 server.py
```

Open http://localhost:3000. Use the server; opening `index.html` directly will not load the SQL engine. No `npm install` is needed and nothing is fetched from a CDN. Your progress is stored in your browser only.

## What is here

| Part | What you get |
|---|---|
| **Curriculum** | 4 levels, 17 modules, about 45 weeks at the suggested pace. Each module has 5 to 7 lessons (about 2,000 to 2,800 words together), a runnable **lab with automated tests**, a **chaos scenario** (a realistic production failure, its cause and its fix) and an 8-question quiz with explanations (80% to pass). |
| **Labs** | Every lab lives in [labs/](labs/), has a starter that fails its tests and a reference solution that passes them. Run `python3 scripts/verify_labs.py` to re-prove it. |
| **SQL Sandbox** | A real SQLite engine in the browser (sql.js, vendored in `app/vendor/`), several datasets (including the KopiKu coffee-shop data used by the labs) and challenges whose results are checked against a reference query. SQLite dialect: no `QUALIFY`, use `julianday()`/`strftime()` for dates. |
| **Interview Sim** | System-design scenarios, SQL problems and incident drills. Sample answers are reference material, not graded. |
| **Portfolio** | Capstone blueprints with an ADR and interview-defense notes each. These are plans to build yourself, not finished projects. |
| **Resume builder** | Editor, live preview, print to PDF. The "ATS score" is a keyword and number-counting heuristic, not a real ATS result. |

### The 17 modules

| | Module |
|---|---|
| **Level 0** | 0.1 The data landscape · 0.2 Terminal, Python environments and Git · 0.3 Databases and SQL 101 |
| **Level 1** | 1.1 Linux, shell and Docker · 1.2 Production Python · 1.3 Advanced SQL and execution plans · 1.4 Dimensional modeling |
| **Level 2** | 2.1 Parquet, DuckDB and Polars · 2.2 Iceberg and Delta Lake · 2.3 dbt · 2.4 Dagster and Airflow · 2.5 Data quality and contracts |
| **Level 3** | 3.1 Spark internals · 3.2 Kafka and CDC · 3.3 Event time, windows and watermarks · 3.4 Terraform and FinOps · 3.5 AI and vector data engineering (pgvector) |

### How the labs were verified

Each lab was run against the real tool, not a mock: DuckDB, Polars, PyIceberg and delta-rs, dbt-duckdb, Dagster, PySpark (Java 17), a real Kafka 3.9 broker (KRaft) with `confluent-kafka`, PostgreSQL logical decoding (`pgoutput`) and pgvector through an embedded PostgreSQL, and Terraform with the real AWS provider planning offline (no AWS account needed). Reference solutions pass, starters fail; tests that need a tool you have not installed (Terraform, Java, a Kafka broker) skip themselves with a message.

```bash
pip install -r labs/mod-2-3/requirements.txt     # each lab lists its own requirements
python3 scripts/verify_labs.py mod-2-3           # one module, or no argument for all
pytest labs/mod-2-3 -v                           # as a learner: edit the files, run the tests
LAB_DIR=reference pytest labs/mod-2-3 -v         # run the tests against the reference solution
```

The Docker stack (`docker-compose.yml`, images pinned) was brought up and checked by hand: Postgres seeded and healthy; Redpanda passes the real-Kafka lab tests; the Debezium connector in `labs/mod-3-2/debezium-orders.json` streams real snapshot, insert, update, delete and tombstone events; PyIceberg creates, appends to and reads a table on the S3 service. The Docker-based steps are not part of the automated tests. If something fails for you, please open an issue.

## Optional lab infrastructure (Docker)

```bash
docker compose up -d s3 s3-init                                # Lab 2.2: S3 storage + 'warehouse' bucket (optional)
docker compose up -d postgres redpanda connect redpanda-console   # Lab 3.2: CDC (optional; the graded tests do not need it)
```

S3 endpoint http://localhost:8333 (SeaweedFS; access key `dataforge`, secret `dataforge-secret`, path-style addressing, region `us-east-1`), Redpanda Console http://localhost:8080, Kafka Connect REST http://localhost:8083, Postgres `localhost:5432` (`production` DB, seeded by [labs/postgres-init.sql](labs/postgres-init.sql)). The credentials are for local use only.

## Layout

```
app/                 static web app (no build step)
  index.html  css/style.css
  js/app.js          UI and hash routing (#/curriculum/mod-1-3/lab)
  js/curriculum-data.js  GENERATED from curriculum/ and labs/ (do not edit by hand)
  js/*-data.js       interview, portfolio, resume, remote-career content (ID/EN)
  js/playground.js   SQL sandbox datasets, challenges, checker
  vendor/sqljs/      SQLite compiled to WebAssembly (MIT)
  server.js          static server with path-traversal protection
curriculum/          the course source: levels.json and <module>/en.md (+ id.md)
labs/                one folder per module, plus shared/ (data generators and test helpers)
scripts/             build-curriculum.js, verify_labs.py and authoring helpers
docker-compose.yml   optional local lab stack
server.py            Python alternative to server.js
```

Editing the course: change `curriculum/<module>/en.md` or a lab file, run `node scripts/build-curriculum.js` (add `--check` to validate without writing), and reload the app.

## License

MIT (sql.js is MIT, see `app/vendor/sqljs/LICENSE`).
