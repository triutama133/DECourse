# DataForge

A self-study data engineering course that runs in your browser: a curriculum with hands-on labs and "chaos" scenarios, a SQL sandbox with auto-checked challenges, interview practice, portfolio blueprints and a resume builder. UI languages: Indonesian and English.

> **Status:** All 27 modules (Levels 0 to 4, including the 4.4 Airflow capstone) are complete in both **English and Indonesian** (curriculum, interactive steps/drills, labs, chaos scenarios, and quizzes).
> 
> 💡 **New to Data Engineering?** Read the [Beginner Walkthrough / Panduan Belajar Pemula](WALKTHROUGH.md) for a complete zero-to-pro study guide and learning loop.

## Learning contract (read this before you share the course)

This course only works if learners write the code **themselves**. The site says so on the Start here page and on every lab page: do not copy the reference solution and do not ask an AI to write the lab; use AI or people to *explain* concepts and errors after trying for at least 30 minutes. The proof codes (`scripts/prove.py`) show that the tests pass on the learner's computer, but they cannot prove who wrote the code, and the course gives no certificate. If you run this course for a group, say the rule out loud and consider reviewing code live.

## Quick start (new learners)

The site opens on a **Start here** page that walks you from zero to your first running lab. The short version:

```bash
git clone https://github.com/triutama133/DECourse.git && cd DECourse
python3 labs/shared/shopgen.py --out data     # creates the KopiKu sample data; proves Python works
python3 scripts/doctor.py                     # checks folder, Python, Git, venv and data; prints the fix for anything missing
python3 server.py                             # or npm start; then open http://localhost:3000
```

**Stuck on setup?** `python3 scripts/doctor.py mod-2-3` (any module) also checks that module's packages, tools (jq, Java, Docker, Terraform) and environment variables (`DATABASE_URL`, `KOPIKU_DB`), and that your venv still works after a Python upgrade. It only looks; it changes nothing.

**Labs are verified, starters included:** `python3 scripts/verify_labs.py` proves that every reference solution passes and that every starter fails *because it is unfinished*, not because it is broken (a syntax error, an import that cannot work, a dbt compile error). Its `--self-test` checks those rules in CI.

No Git? Download the ZIP of this repository instead. Prefer not to install anything? Open the repository in **GitHub Codespaces** (the `.devcontainer/` folder sets up Python, Java, Terraform and every lab's dependencies). Press **Ctrl+K** inside the site to search every lesson.

**Browser preview of the first labs:** Labs 0.0 and 0.2 have a preview that runs the real pytest tests in the page (Python in WebAssembly via vendored Pyodide in `app/vendor/pyodide/`, about 15 MB, no CDN; nothing is sent to a server). It is only a taster and **does not count**: the course requires learners to set up Python, a venv and a terminal themselves (Module 0.1) and to repeat Lab 0.2 there, writing the code again without copying. The reference solution in the preview unlocks only once at least half of the test groups have passed in one run. `node scripts/verify_browser_labs.js` proves the preview in the real Pyodide.

**Proof that learners did the work themselves:** every lab ends with `python3 scripts/prove.py <module>` (for example `mod-0-2`; Lab 0.1 also needs the workspace path). It runs the lab's real tests on the learner's own computer and, only if all pass with none skipped, prints a short code such as `DF1:mod-0-2:8:v:3.12:linux:3f9a1c2e:b04d77a1:5c1e9b`. The learner pastes it into the lab page; the app checks that the tests are the course's current tests, that the work is not the reference solution or the untouched starter, and (for Lab 0.2) that it ran inside a venv. A module is marked complete automatically only when the quiz is passed **and** the proof is accepted (manual completion asks for confirmation). This is an honesty check, not security: anyone can read the scripts. `python3 scripts/test_proof.py` tests it end to end; `labs/proof.json` defines how each lab is proven.

## Ask the course offline (optional AI tutor)

A small AI model that runs on your own computer and answers from the course itself, in English or Indonesian. It is a helper for when you are stuck, not a replacement for the lessons: it shows the lessons it used so you can read the real text, and it says so when the course does not cover your question. After the one-time download nothing leaves your computer. It is **off by default** and you can turn it on and off at any time.

**Turn it on and off in the course (easiest):** start the course with `npm start` or `python3 server.py`, then click **🎓 Tutor** in the top bar. The first time it walks you through two steps:

1. **Install Ollama once per computer** (the free program that runs the model). Windows and macOS: the installer from https://ollama.com/download. Linux: `curl -fsSL https://ollama.com/install.sh | sh`. Then close and reopen your terminal and start the course again.
2. **Download the model once** (about 2 GB, needs internet): click **Download model** in the tutor panel, or run `ollama pull qwen2.5:3b`.

After that, clicking **Tutor** starts the model for you (a green dot means it is ready) and **Turn tutor off** in the panel releases the memory and stops it. Closing the course also stops it. If Ollama was already running because you started it yourself (the Windows and macOS apps do this at login), the course leaves it running and only frees the model's memory.

**Moving the course to another machine:** the model is not part of the repository (it is about 2 GB and listed in `.gitignore`), so every computer downloads it once. On the new machine, run `python3 scripts/tutor.py --check`: it prints what is installed and the exact command for anything missing, top to bottom, until it says "Ready". You need about 4 GB of free RAM and 2 GB of disk; no graphics card.

**In a terminal instead** (no browser needed):

```bash
python3 scripts/tutor.py                          # chat, type exit to leave (needs `ollama serve` running)
python3 scripts/tutor.py "what is a backfill?"    # one question
python3 scripts/tutor.py --lang id "apa itu primary key?"
python3 scripts/tutor.py --search "window function"   # no model needed: lists the matching lessons
```

On a laptop CPU an answer takes about 5 to 25 seconds. With an AMD or Intel integrated graphics chip, reading your question gets about twice as fast (writing the answer does not): start the course server with `OLLAMA_IGPU_ENABLE=1 npm start`, or run `OLLAMA_IGPU_ENABLE=1 ollama serve` yourself. A bigger model such as `DF_TUTOR_MODEL=qwen2.5:7b` (terminal) is smarter but about twice as slow. Small models can still be wrong: when the tutor and a lesson disagree, trust the lesson. `node scripts/test_tutor_js.js` and `python3 scripts/tutor.py --self-test` test the search and the start/stop switch without needing a model.

## Run it

```bash
npm start          # or: python3 server.py
```

Open http://localhost:3000. Use the server; opening `index.html` directly will not load the SQL engine. No `npm install` is needed and nothing is fetched from a CDN. Your progress is stored in your browser only.

## What is here

| Part | What you get |
|---|---|
| **Curriculum** | 5 levels, 27 modules and 214 lessons, about 70 weeks at the suggested pace. Each module has 5 to 12 short lessons (18 of them marked optional for a first pass), a runnable **lab with automated tests**, a **chaos scenario** (a realistic production failure, its cause and its fix) and an 8 to 13 question quiz with explanations (80% to pass). Lessons open as small screens (one idea each) with predict questions, drills you can run in the page and "watch it run" animations; every drill ends with a box that sends you to do it on your own computer. A failing Python check explains the error in plain words. Above each lesson you can switch between **Steps**, **With a teacher** (a teacher walks you through one step at a time, with short conversations for the ideas beginners stumble on, in every module from 0.0 to 4.4 (78 conversations), and an **I am lost: ask the teacher** button that asks the offline tutor about exactly that part) and **One page**. |
| **Labs** | Every lab lives in [labs/](labs/), has a starter that fails its tests and a reference solution that passes them. Run `python3 scripts/verify_labs.py` to re-prove it. |
| **Python Lab** | 51 Python challenges in six levels (basics, collections, functions and errors, data patterns, objects and recursion, and seven small mini-projects), each checked automatically in the browser, in English and Indonesian. A spaced **warm-up** brings back challenges you solved days ago and asks you to rebuild them from an empty file, for muscle memory. Source: `curriculum/python-challenges/`; `node scripts/build-challenges.js` generates the app data. It sits beside the SQL Sandbox under *Practice Lab*. |
| **Glossary** | 294 terms in plain words (English and Indonesian), each linked to the lesson that teaches it. Open it from the header, from Ctrl+K, or by clicking a bold term inside a lesson. `node scripts/test_glossary.js` checks every entry against its lesson. |
| **SQL Sandbox** | A real SQLite engine in the browser (sql.js, vendored in `app/vendor/`), several datasets (including the KopiKu coffee-shop data used by the labs) and 59 challenges whose results are checked against a reference query (`node scripts/verify_sandbox.js` runs every solution on the same engine). SQLite dialect: no `QUALIFY`, use `julianday()`/`strftime()` for dates. |
| **Job Career Mode** | Story-driven job simulator across 4 companies (board postings, recruiter pitches, Day-1 onboarding, slack/terminal missions) verified against local `scripts/job_sim.py` gates. |
| **Interview Sim** | Interactive 3-round **Panel Loop Simulator** (SQL whiteboards, architecture diagrams, incident alerts, follow-up probes, Hiring Committee scorecard) plus 7 practice drills including live SQLite WASM execution & hostile-data grading in SQL Arena. |
| **AI tutor (optional)** | An offline helper that answers from the lessons themselves, in English or Indonesian, and shows the lessons it used. Off by default; see *Ask the course offline* above. |
| **Portfolio** | Capstone blueprints with an ADR and interview-defense notes each. These are plans to build yourself, not finished projects. |
| **Resume builder** | Editor, live preview, print to PDF. The "ATS score" is a keyword and number-counting heuristic, not a real ATS result. |
| **Job Readiness Dashboard** | Overall readiness score, 6 competency domain matrices, hiring checklist, next action steps, and exportable PDF report. |

### The 27 modules

| | Module |
|---|---|
| **Level 0** | 0.0 Python from zero · 0.1 Terminal, Python environments and Git · 0.2 The data landscape · 0.3 Databases and SQL 101 (with functions, DDL and views) |
| **Level 1** | 1.1 Linux, shell and Docker · 1.2 Production Python · 1.3 Advanced SQL, execution plans and dialects · 1.4 Dimensional modeling · 1.5 pandas for data engineers · 1.6 Getting data in: files, APIs, databases · 1.7 Beyond SQL: key-value, document, wide-column and graph stores |
| **Level 2** | 2.1 Parquet, DuckDB and Polars · 2.2 Iceberg and Delta Lake · 2.3 dbt · 2.4 Dagster and Airflow · 2.5 Data quality and contracts · 2.6 Cloud data warehouses (Snowflake, BigQuery, Redshift) |
| **Level 3** | 3.0 From Hadoop to Spark (HDFS, MapReduce, YARN, Hive) · 3.1 Spark internals · 3.2 Kafka (clusters, Schema Registry) and CDC · 3.3 Event time, windows and watermarks · 3.4 Terraform and FinOps · 3.5 AI and vector data engineering (pgvector) |
| **Level 4** | 4.1 Capstone: a real pipeline on NYC taxi trips · 4.2 Capstone: fault-tolerant incremental API ingestion & checkpointing (USGS seismic data) · 4.3 Capstone: real-time event streaming, watermarks & late data handling (fleet telemetry) · 4.4 Capstone: orchestrate a daily pipeline with Apache Airflow (job postings) |

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
  js/*-data.js       interview, portfolio, resume, remote-career content (ID/EN); glossary-data.js is the hand-written glossary
  js/playground.js   SQL sandbox datasets, challenges, checker
  js/tutor.js        the optional offline tutor (search + chat panel)
  vendor/sqljs/      SQLite compiled to WebAssembly (MIT)
  vendor/pyodide/    Python compiled to WebAssembly (labs preview, drills, Python Lab)
  server.js          static server with path-traversal protection; also starts/stops the tutor's model
curriculum/          the course source: levels.json and <module>/en.md (+ id.md), python-challenges/
labs/                one folder per module, plus shared/ (data generators and test helpers)
scripts/             build-curriculum.js, verify_labs.py, doctor.py, prove.py, tutor.py, the other checks and authoring helpers
docker-compose.yml   optional local lab stack
server.py            Python alternative to server.js (also supports the Tutor switch)
.github/workflows/   CI: runs every check below on each push
```

Editing the course: change `curriculum/<module>/en.md` (and `id.md`, keep the two in step) or a lab file, run `node scripts/build-curriculum.js` (add `--check` to validate without writing), and reload the app. The generated files `app/js/curriculum-data.js`, `browser-labs-data.js` and `proof-data.js` are committed; CI fails if they are out of date.

## Run all the checks

The same checks CI runs (see [.github/workflows/ci.yml](.github/workflows/ci.yml)). Run the ones that match what you changed:

| You changed | Run |
|---|---|
| A lesson, quiz or glossary entry | `node scripts/build-curriculum.js --check` · `node scripts/test_steps.js` · `node scripts/test_glossary.js` |
| A drill or a Python/SQL example in a lesson | `node scripts/verify_drills.js` · `node scripts/verify_sql_drills.js` · `node scripts/verify_lesson_pads.js` |
| A lab, a starter or its tests | `python3 scripts/verify_labs.py mod-X-Y` · `python3 scripts/test_proof.py` · `python3 scripts/test_tryit.py` |
| The browser lab preview | `node scripts/verify_browser_labs.js` |
| The SQL Sandbox or the Python Lab | `node scripts/verify_sandbox.js` · `node scripts/build-challenges.js --check` |
| Job simulator, interview, portfolio | `python3 scripts/job_sim.py --self-test` · `node scripts/verify_simulators.js` · `python3 scripts/verify_portfolio.py self-test` |
| The tutor | `node scripts/test_tutor_js.js` · `python3 scripts/tutor.py --self-test` |
| The setup checker | `python3 scripts/doctor.py --self-test` |

One thing no script can check is whether a quiz answer is *right* (only that the quiz is well formed). When you edit a quiz, read the marked answer against the lesson.

## License

MIT (sql.js is MIT, see `app/vendor/sqljs/LICENSE`).
