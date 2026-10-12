# DataForge

A self-study data engineering course that runs in your browser: a curriculum with hands-on labs and "chaos" scenarios, a SQL sandbox with auto-checked challenges, interview practice, portfolio blueprints and a resume builder. UI languages: Indonesian and English.

> **Status:** 23 modules are complete in both **English and Indonesian** (curriculum, labs, chaos scenarios, and quizzes). The Level 4 capstone (4.1) is complete in English; its Indonesian version is still to be written.
> 
> 💡 **New to Data Engineering?** Read the [Beginner Walkthrough / Panduan Belajar Pemula](WALKTHROUGH.md) for a complete zero-to-pro study guide and learning loop.

## Learning contract (read this before you share the course)

This course only works if learners write the code **themselves**. The site says so on the Start here page and on every lab page: do not copy the reference solution and do not ask an AI to write the lab; use AI or people to *explain* concepts and errors after trying for at least 30 minutes. The proof codes (`scripts/prove.py`) show that the tests pass on the learner's computer, but they cannot prove who wrote the code, and the course gives no certificate. If you run this course for a group, say the rule out loud and consider reviewing code live.

## Quick start (new learners)

The site opens on a **Start here** page that walks you from zero to your first running lab. The short version:

```bash
git clone https://github.com/triutama133/DECourse.git && cd DECourse
python3 labs/shared/shopgen.py --out data     # creates the KopiKu sample data; proves Python works
python3 server.py                             # then open http://localhost:3000
```

No Git? Download the ZIP of this repository instead. Prefer not to install anything? Open the repository in **GitHub Codespaces** (the `.devcontainer/` folder sets up Python, Java, Terraform and every lab's dependencies). Press **Ctrl+K** inside the site to search every lesson.

**Browser preview of the first lab:** Lab 0.1 has a preview that runs the real pytest tests in the page (Python in WebAssembly via vendored Pyodide in `app/vendor/pyodide/`, about 15 MB, no CDN; nothing is sent to a server). It is only a taster and **does not count**: the course requires learners to set up Python, a venv and a terminal themselves (Module 0.2) and to repeat Lab 0.1 there, writing the code again without copying. The reference solution in the preview unlocks only after three test runs. `node scripts/verify_browser_labs.js` proves the preview in the real Pyodide.

**Proof that learners did the work themselves:** every lab ends with `python3 scripts/prove.py <module>` (for example `mod-0-1`; Lab 0.2 also needs the workspace path). It runs the lab's real tests on the learner's own computer and, only if all pass with none skipped, prints a short code such as `DF1:mod-0-1:8:v:3.12:linux:3f9a1c2e:b04d77a1:5c1e9b`. The learner pastes it into the lab page; the app checks that the tests are the course's current tests, that the work is not the reference solution or the untouched starter, and (for Lab 0.1) that it ran inside a venv. A module is marked complete automatically only when the quiz is passed **and** the proof is accepted (manual completion asks for confirmation). This is an honesty check, not security: anyone can read the scripts. `python3 scripts/test_proof.py` tests it end to end; `labs/proof.json` defines how each lab is proven.

## Run it

```bash
npm start          # or: python3 server.py
```

Open http://localhost:3000. Use the server; opening `index.html` directly will not load the SQL engine. No `npm install` is needed and nothing is fetched from a CDN. Your progress is stored in your browser only.

## What is here

| Part | What you get |
|---|---|
| **Curriculum** | 5 levels, 25 modules, about 63 weeks at the suggested pace. Each module has 5 to 7 lessons (about 2,000 to 2,800 words together), a runnable **lab with automated tests**, a **chaos scenario** (a realistic production failure, its cause and its fix) and an 8 to 10 question quiz with explanations (80% to pass). |
| **Labs** | Every lab lives in [labs/](labs/), has a starter that fails its tests and a reference solution that passes them. Run `python3 scripts/verify_labs.py` to re-prove it. |
| **SQL Sandbox** | A real SQLite engine in the browser (sql.js, vendored in `app/vendor/`), several datasets (including the KopiKu coffee-shop data used by the labs) and 48 challenges whose results are checked against a reference query (`node scripts/verify_sandbox.js` runs every solution on the same engine). SQLite dialect: no `QUALIFY`, use `julianday()`/`strftime()` for dates. |
| **Interview Sim** | System-design scenarios, SQL problems and incident drills. Sample answers are reference material, not graded. |
| **Portfolio** | Capstone blueprints with an ADR and interview-defense notes each. These are plans to build yourself, not finished projects. |
| **Resume builder** | Editor, live preview, print to PDF. The "ATS score" is a keyword and number-counting heuristic, not a real ATS result. |
| **Job Readiness Dashboard** | Overall readiness score, 6 competency domain matrices, hiring checklist, next action steps, and exportable PDF report. |

### The 25 modules

| | Module |
|---|---|
| **Level 0** | 0.0 Python from zero · 0.1 The data landscape · 0.2 Terminal, Python environments and Git · 0.3 Databases and SQL 101 (with functions, DDL and views) |
| **Level 1** | 1.1 Linux, shell and Docker · 1.2 Production Python · 1.3 Advanced SQL, execution plans and dialects · 1.4 Dimensional modeling · 1.5 pandas for data engineers · 1.6 Getting data in: files, APIs, databases · 1.7 Beyond SQL: key-value, document, wide-column and graph stores |
| **Level 2** | 2.1 Parquet, DuckDB and Polars · 2.2 Iceberg and Delta Lake · 2.3 dbt · 2.4 Dagster and Airflow · 2.5 Data quality and contracts · 2.6 Cloud data warehouses (Snowflake, BigQuery, Redshift) |
| **Level 3** | 3.0 From Hadoop to Spark (HDFS, MapReduce, YARN, Hive) · 3.1 Spark internals · 3.2 Kafka (clusters, Schema Registry) and CDC · 3.3 Event time, windows and watermarks · 3.4 Terraform and FinOps · 3.5 AI and vector data engineering (pgvector) |
| **Level 4** | 4.1 Capstone: a real pipeline on NYC taxi trips · 4.2 Capstone: fault-tolerant incremental API ingestion & checkpointing (USGS seismic data) |

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
