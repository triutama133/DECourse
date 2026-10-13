---
title: Capstone: Orchestrate a Daily Pipeline with Apache Airflow
duration: 3 weeks
summary: Build a daily Apache Airflow pipeline for job postings entirely by yourself: five tasks in a chain, a schedule that runs once per day, retries that heal a late file, a quality gate that refuses a broken delivery, and loads that can be repeated or run out of order without duplicating a single row. You get a contract and seven daily deliveries; a checker runs your DAG and verifies the results.
why: Tutorials show a DAG with three print statements. A job gives you a pipeline that must run every night, survive a file that arrives late, refuse a delivery that is mostly garbage, and be rerun for any past day without making the numbers wrong. Airflow appears in roughly a third of the data engineering job posts we sampled, and almost every interview asks what happens when a task is retried.
---

## @outcomes
- Write an Airflow 3 DAG with the TaskFlow API: a daily schedule, a fixed start date, retries, a chain of tasks and small values passed between them
- Use the logical date (`ds`) so that every task is a function of its day, and explain what catchup, backfill and data intervals mean
- Make a load idempotent: the same day can run twice, or out of order, and leave exactly the same data
- Turn a missing file into a retry and a broken delivery into a refused run that changes nothing
- Test a DAG without a scheduler using `dag.test()`, and read task states and attempts

## @prereq
Modules 0.2 (virtual environment), 1.2 (idempotency, retries), 1.6 (ingestion, checkpoints), 2.1 (DuckDB) and 2.4 (orchestration concepts; its lab used Dagster, here you meet Airflow). You need Python 3.10 to 3.13, about 1 GB of free disk space (Airflow alone is about 450 MB) and a few minutes for the install.

## @lesson How this capstone works
You get a **contract**, **seven daily deliveries** of job postings and a **checker**. You decide how to write the DAG. The checker looks only at results: how Airflow sees your DAG file, what your tasks write to the warehouse, and how the run behaves when a file is late or a delivery is broken. As in the other capstones, **you do it yourself**: no copied solution and no AI writing the pipeline for you. The proof code at the end is only worth something if it is honest.

The data is **synthetic**: `fetch_data.py` generates it from a fixed seed to imitate job postings collected from four job sites (the same job on several sites, salaries written in many ways, skills spelled in many ways, broken lines). It is not scraped from any site. What is real is the kind of mess.

How the checker works, so that nothing surprises you:

1. It copies the top-level `.py` files of your workspace into a **private folder** and creates its own Airflow home there (`<workspace>/.check/`, deleted at the end). Your own Airflow settings and database are never touched.
2. It imports your DAG with Airflow and inspects it: schedule, start date, catchup, tasks, order, retries.
3. It runs your DAG with **`dag.test()`** for chosen dates. This executes all tasks of a run in one process, without a scheduler, and honours retries. It sets the environment variables `JOBS_INBOX`, `JOBS_WAREHOUSE` and `JOBS_QUARANTINE`.
4. It compares the warehouse with answers it computes itself from the raw files, and it attacks your pipeline: reruns, a different order of days, a file that arrives a few seconds late, a delivery that is 60% garbage.

Setup, once:

```bash
python3 -m venv ~/airflow-lab/venv && source ~/airflow-lab/venv/bin/activate
PYV=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
pip install -r labs/mod-4-4/requirements.txt \
  --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-3.1.8/constraints-$PYV.txt"
python3 labs/mod-4-4/fetch_data.py            # generates the seven deliveries and checks their hash
cp labs/mod-4-4/starter/jobs_pipeline.py ~/airflow-lab/jobs_pipeline.py
```

The `--constraint` file pins the versions Airflow was tested with; installing Airflow without it often ends in conflicts. Expect 2 to 5 minutes. A full check of all five steps takes about two minutes, because Airflow needs several seconds to start for every run.

Hints come in three levels (`--hint 1`, `2`, `3`). Try for at least 30 minutes before you ask. Struggling is how you learn to read Airflow's error messages, and you will read many of them at work.

## @lesson Meet the deliveries
Every day one file arrives in the inbox: `jobs_2026-03-01.jsonl` to `jobs_2026-03-07.jsonl`. One line is one posting as a JSON object:

```json
{"source": "glints", "source_job_id": "gl-164", "title": "qa engineer", "company": "Rajawali Energi", "location": "Jakarta",
 "salary_text": "Rp 12-15jt", "posted_at": "2026-03-02", "skills": ["Power BI", "SQL", " Communication ", "leadership"]}
```

What is wrong with these files, on purpose:

- **Broken lines.** Some lines are cut in the middle (invalid JSON), some have an empty or missing required field, some have a `posted_at` that is not a date (`31/02/2026`, `yesterday`).
- **One day is mostly garbage.** Look at the share of unusable lines per file: the delivery of one day is far worse than the others. A pipeline must notice.
- **The same job on several sites.** The same company, title and location can appear on two, three or four job sites, each line with its own `source_job_id`. Title and company are written in different capital letters and with extra spaces.
- **Salary in many styles**, as text: `Rp 8.000.000 - 12.000.000/Bulan`, `IDR 7,000,000 - 9,000,000 per month`, `Rp 5-10jt`, `Rp 6,5-8,5jt`, `Rp 9.000.000/Bulan`, and often nothing, or words such as `Negotiable`.
- **Skills spelled in many ways**: `SQL`, `sql`, ` Sql `, `powerbi`, `Power-BI`, `postgres`, `gcp`.
- **Reposts.** A job can appear again on a later day. That is a new posting on that day.

Questions to answer before you write any code (step 1 asks you for nine numbers about these files): how many lines are there, how many are unusable and for which of the three reasons, how many sources exist, which is the busiest, how many lines carry a salary, and which day is the worst. Work them out with a few lines of Python. Do not skip this: the counts are your first reconciliation numbers, the ones you compare your pipeline against.

> 💡 **Practice Pause 1 (Step 1: Delivery Profiling & profile.json Creation):**
> 1. Create `profile.json` in your workspace folder (`~/airflow-lab/profile.json`) using your text editor.
> 2. Compute the 9 statistical metrics across all 7 delivery files in inbox: `files`, `lines_total`, `invalid_json_lines`, `lines_missing_required`, `lines_bad_date`, `distinct_sources`, `busiest_source`, `lines_with_salary`, and `worst_day`.
> 3. Run the step 1 check in terminal:
>    `python3 labs/mod-4-4/check.py ~/airflow-lab --step 1`
> 4. **Success Indicator:** All 9 metrics report `PASS`, confirming your delivery profiling matches reference truth.

## @lesson Airflow in fifteen minutes
**Apache Airflow** runs and watches workflows that you define in Python. You describe the work; Airflow schedules it, runs it in order, retries failures, records every attempt and shows it all in a web page.

- A **DAG** (directed acyclic graph) is a workflow: tasks and the order between them, with no loops. A DAG is defined in an ordinary Python file that Airflow **imports again and again** to see whether it changed. Therefore the top level of a DAG file must be light and free of side effects: no database connections, no reading of files, no network calls, no `datetime.now()` in a setting. Real work belongs *inside* the tasks, which run only when scheduled.
- A **task** is one unit of work. In the TaskFlow API you write a normal function and decorate it with `@task`; its name becomes the task id. Calling tasks like functions (`validate(extract())`) defines both the order and how data moves.
- **Passing data.** The return value of a task travels to the next one through Airflow's metadata database (an *XCom*). That is meant for **small** values: a path, a count, a date. Never return a data set of thousands of rows; write it to a file or table and return where it is.
- **Schedule and logical date.** `schedule="@daily"` creates one run per day. Each run has a *logical date*, and tasks can receive it as a text `ds` (`"2026-03-02"`) by naming a parameter `ds` in the function. **Use it instead of today's date**: the run for 2 March must process 2 March's file whether it runs on 2 March, on 9 March (late) or during a backfill.
- **Start date and catchup.** `start_date` is where the schedule begins; it must be a fixed, timezone-aware date, never `now()` (a start date that moves every time the file is imported makes the schedule meaningless). `catchup=True` would create a run for every missed day since `start_date` as soon as the DAG is switched on; with `catchup=False` you start new runs only and run history deliberately yourself (a *backfill*).
- **Retries.** `retries` and `retry_delay` (in `default_args`) say how often and after how long a failed task is tried again. A task that *raises an exception* has failed and is retried. A task that quietly returns something wrong has succeeded, and nobody will ever know. In real systems the delay is minutes; in this lab it must be at most 5 seconds, because the checker waits for it.
- **States.** A task is `success`, `failed`, `up_for_retry`, or `upstream_failed` (it did not run because something before it failed). A run is `success` or `failed`.
- **`max_active_runs=1`** lets only one run of this DAG be active at a time, so that two days do not write into the same tables at once.

The `@dag` decorator takes `dag_id`, `schedule`, `start_date`, `catchup`, `max_active_runs`, `default_args` and `tags`. You import the decorators with `from airflow.sdk import dag, task`. To try things yourself: `airflow standalone` starts the whole system with a web page (the terminal prints the login); `dag.test(logical_date=...)` runs one run in your own process, which is what the checker uses and what you should use while developing. We measured about 10 seconds for a complete run of a five-task DAG, most of it Airflow starting up.

Two habits that matter more than any operator: **make every task a function of its date and its inputs only**, and **make every write replace rather than append**. The rest of this module is about exactly that.

> 💡 **Practice Pause 2 (Step 2: DAG Structure & Task Chain Contract Settings):**
> 1. Open `jobs_pipeline.py` in your workspace (`~/airflow-lab/jobs_pipeline.py`) using your text editor.
> 2. Define the `@dag` with `dag_id="jobs_pipeline"`, `schedule="@daily"`, `catchup=False`, `max_active_runs=1`, fixed `start_date` (e.g., 2026-03-01 UTC), and five `@task` functions chained sequentially: `extract` → `validate` → `transform` → `load` → `publish_mart` with retries >= 2 and retry_delay <= 5s.
> 3. Run the step 2 check in terminal:
>    `python3 labs/mod-4-4/check.py ~/airflow-lab --step 2`
> 4. **Success Indicator:** All DAG configuration checks report `PASS`, ensuring the DAG file imports cleanly and top-level parsing finishes quickly.

## @lesson The contract
This lesson is the specification. The checker follows it to the letter.

**Files and environment.** Your workspace holds `jobs_pipeline.py` (the DAG; helper modules are allowed, but only as `.py` files next to it, not in sub-folders) and `profile.json`. The checker sets three environment variables; read them **inside the tasks**, when they run, not when the file is imported: `JOBS_INBOX` (folder with `jobs_YYYY-MM-DD.jsonl`), `JOBS_WAREHOUSE` (path of the DuckDB file to write), `JOBS_QUARANTINE` (folder for rejected lines). Staging files for passing data between tasks go in a sub-folder of the warehouse folder.

**The DAG.** `dag_id` `jobs_pipeline`; one run per day (`@daily`); a fixed, timezone-aware `start_date` no later than 2026-03-01; `catchup` off; `max_active_runs` 1; every task with `retries` of at least 2 and a `retry_delay` of more than 0 and at most 5 seconds. Five tasks, in a chain, with exactly these ids: `extract` → `validate` → `transform` → `load` → `publish_mart`.

**What each task does for the day `ds`.**

1. `extract`: finds `jobs_<ds>.jsonl` in the inbox. If the file does not exist, **raise an exception** (the delivery may simply be late; Airflow will retry).
2. `validate`: reads the lines (ignore blank lines) and rejects a line when, in this order: it is not a JSON object (`invalid_json`); one of `source`, `source_job_id`, `title`, `company` is missing or empty after trimming (`missing_field`); `posted_at` is not an ISO date `YYYY-MM-DD` (`bad_date`). If **more than 50%** of the lines are rejected, **raise**: the delivery is refused. Otherwise write the rejected lines to `JOBS_QUARANTINE/rejected_<ds>.jsonl`, one JSON object per line with a `reason` and the original `line`, and pass the valid ones on.
3. `transform`: for every valid line build `job_key` = `company|title|location`, each part trimmed, with runs of whitespace collapsed to one space and lower-cased. Lines with the same `job_key` are **one job** (the same posting on several sites): keep the values of the first one in file order and count the distinct `source` values as `n_sources`. `title`, `company` and `location` are stored in that cleaned form. Parse `salary_text` into a minimum and a maximum **in IDR per month**: take the numbers in the text; if the text contains `jt` they are millions with a decimal comma, otherwise dots and commas are thousand separators; one number means minimum = maximum; no number means both NULL.

   | `salary_text` | min | max |
   |---|---|---|
   | `Rp 8.000.000 - 12.000.000/Bulan` | 8000000 | 12000000 |
   | `IDR 7,000,000 - 9,000,000 per month` | 7000000 | 9000000 |
   | `Rp 5-10jt` | 5000000 | 10000000 |
   | `Rp 6,5-8,5jt` | 6500000 | 8500000 |
   | `Rp 9.000.000/Bulan` | 9000000 | 9000000 |
   | `Negotiable`, empty, missing | NULL | NULL |

   Normalise every skill: trim, collapse whitespace, lower-case, then apply the aliases `postgres` → `postgresql`, `powerbi` → `power bi`, `power-bi` → `power bi`, `py` → `python`, `gcp` → `google cloud`, `amazon s3` → `s3`. A job lists each skill once.
4. `load`: writes the tables below **for this `ds` only**, replacing whatever that date held before, and either all of it or none of it.
5. `publish_mart`: rebuilds `mart_skill_demand(skill, job_postings, share_pct)` from the tables, for all loaded days: `job_postings` is the number of rows of `job_skills` with that skill, `share_pct` is `100 * job_postings / (number of rows in jobs)` rounded to 1 decimal.

**Tables** in `JOBS_WAREHOUSE`: `jobs(ds DATE, job_key, title, company, location, salary_min_idr BIGINT, salary_max_idr BIGINT, n_sources INTEGER)` with one row per `ds` and `job_key`, and `job_skills(ds DATE, job_key, skill)`.

> 💡 **Practice Pause 3 (Step 3: One-Day End-to-End Run: Validation, Transformation & Warehouse):**
> 1. Open `jobs_pipeline.py` in your workspace using your text editor.
> 2. Complete all five task implementations using logical date `ds`: quarantine bad lines, normalize salaries and skill aliases, load into DuckDB tables `jobs` and `job_skills`, and rebuild `mart_skill_demand`.
> 3. Run the step 3 check in terminal:
>    `python3 labs/mod-4-4/check.py ~/airflow-lab --step 3`
> 4. **Success Indicator:** All step 3 checks report `PASS`, confirming a single-day run produces 100% accurate warehouse rows and mart metrics.

## @lesson Designing it so that it survives
**Everything is a function of the date.** If a task asks "what is today?" instead of "which day is this run for?", rerunning an old day gives a wrong answer. Every file name, every `WHERE`, every output path in this pipeline is built from `ds`.

**Replace, never append.** The classic Airflow bug: a task appends its rows, a retry runs it again, and the rows exist twice. The remedy is the idempotence of Module 1.2 applied to a date partition: inside one transaction, *delete the rows of this date, then insert them*. Run it once or five times, the table is the same. Do it in a transaction so that a crash between the delete and the insert leaves yesterday's content, not a hole. The mart is rebuilt completely from the tables instead of being added to, for the same reason. A rerun in the middle of a backfill, or starting with 4 March before 3 March, then cannot make the numbers wrong.

**Failure is information; silence is not.** A missing file must make `extract` raise: Airflow then waits `retry_delay` and tries again, and a file that arrives a few seconds late is picked up by the retry. If `extract` returned an empty result instead, the run would be green and the day would be empty. The same logic applies to a delivery that is mostly garbage: loading the good 40% quietly would put a partial day into the warehouse. Raise in `validate`, before anything is written; Airflow marks the task failed, the tasks after it end as `upstream_failed`, and yesterday's data and the mart stay exactly as they were. Someone is notified (in production by an alert) and decides.

**Small values between tasks, real data in storage.** Return paths and counts. Staging files named after the date are fine, and a retry simply overwrites them.

**Light imports.** Airflow parses your file constantly. Imports of `os`, `json`, `duckdb` are fine; connecting to a database or reading the inbox at the top of the file is not.

**Test with `dag.test()` early and often.** After each task you write, run the DAG for one date yourself and look at the warehouse. The checker uses exactly this, so what you see is what it sees.

> 💡 **Practice Pause 4 (Step 4: Rerun Idempotence & Out-of-Order Backfill):**
> 1. Open `jobs_pipeline.py` in your workspace using your text editor.
> 2. Ensure task `load` follows the replace pattern (DELETE rows matching `ds` before INSERT inside one DuckDB transaction) and `publish_mart` fully rebuilds the mart from base tables.
> 3. Run the step 4 check in terminal:
>    `python3 labs/mod-4-4/check.py ~/airflow-lab --step 4`
> 4. **Success Indicator:** All step 4 checks report `PASS`, verifying repeated reruns and arbitrary backfill execution order never duplicate records.

## @lab Lab: five steps to a pipeline Airflow can run every night
Build `jobs_pipeline.py` and `profile.json` in your own workspace, one step at a time, with the checker after each step. The checker runs your DAG on the real deliveries and on broken ones, and compares the warehouse with answers it computes independently.

### @steps
1. **Setup.** Follow the setup in the first lesson (virtual environment, install with the constraint file, `fetch_data.py`, copy the starter into your workspace). Open a delivery and read a hundred lines by eye.
2. **Checker step 1: profile.** Create `profile.json` with nine keys, computed from all seven raw files: `files` (number of delivery files), `lines_total` (non-blank lines), `invalid_json_lines`, `lines_missing_required` (valid JSON but a required field is missing or empty), `lines_bad_date` (valid JSON, required fields present, `posted_at` not an ISO date), `distinct_sources` (among lines that are valid JSON), `busiest_source` (the `source` with the most such lines), `lines_with_salary` (valid JSON lines whose `salary_text` is a non-empty text), and `worst_day` (the file's date, like `2026-03-04`, with the highest share of unusable lines). Check: `python3 labs/mod-4-4/check.py ~/airflow-lab --step 1`.
3. **Checker step 2: the DAG file.** Write the DAG with the settings of the contract and the five tasks in a chain, even if the tasks do nothing yet (they may just return a value). Run `--step 2`; fix what the checker lists.
4. **Checker step 3: one day.** Fill in the tasks so that one day goes through: validate, transform, load, mart. Try it yourself first with `dag.test()` for a single date, compare the row counts with the counts you found in step 1, then run `--step 3`.
5. **Checker step 4: reruns and order.** The checker runs six days in a mixed order, including two repeats. Make sure your load replaces the rows of its date and your mart is rebuilt. Break it on purpose first (remove the delete, run the same day twice) and see what the table looks like. Run `--step 4`.
6. **Checker step 5: survive.** A delivery arrives a few seconds late; a delivery of 5 March is mostly garbage. Make the first heal itself and the second fail without touching anything. Run `--step 5`.
7. **Stuck?** Re-read the matching lesson, look at the data and at the Airflow error text, and only then ask: `python3 labs/mod-4-4/check.py ~/airflow-lab --step 3 --hint 1` (then 2, then 3).
8. **Finish.** When `--step all` passes, run `python3 scripts/prove.py mod-4-4 ~/airflow-lab` for the proof code. Write `NOTES.md` in your workspace: three sentences about what surprised you in Airflow, and what you would monitor if this ran every night (for example the share of rejected lines per day and the age of the newest delivery).

> 💡 **Practice Pause 5 (Step 5: Late Delivery Healing, Quality Gates, & Proof Token):**
> 1. In `jobs_pipeline.py`, ensure task `extract` raises an exception when a file is missing (triggering Airflow retries) and task `validate` raises an exception when rejected lines exceed 50% (halting the run safely without modifying warehouse tables).
> 2. Run step 5 and the complete verification suite in terminal:
>    `python3 labs/mod-4-4/check.py ~/airflow-lab --step all`
> 3. Generate your Capstone verification proof token:
>    `python3 scripts/prove.py mod-4-4 ~/airflow-lab`
> 4. **Success Indicator:** All verification checks report `PASS` and your completion proof token is printed to terminal.

### @files
- labs/mod-4-4/starter/jobs_pipeline.py :: Your working file: copy it to your workspace and build the DAG there :: starter
- labs/mod-4-4/check.py :: The checker: five steps, hints, proof :: test
- labs/mod-4-4/fetch_data.py :: Generates the seven synthetic deliveries and verifies their hash :: config
- labs/mod-4-4/requirements.txt :: Airflow 3.1.8 and DuckDB, with the install command :: config

### @deliverables
- `python3 labs/mod-4-4/check.py ~/airflow-lab --step all` passes **on your own computer, in your own virtual environment**
- You can explain what `ds` is, why a task must use it instead of today's date, and what `catchup=False` changes
- You can explain why `load` deletes and inserts in one transaction, and what would happen to a table that was appended to on every retry
- You can explain why a missing file must raise instead of returning an empty result, and why a refused delivery must fail before anything is written
- Your `NOTES.md` states what surprised you and what you would monitor every night

### @verify
```bash
python3 labs/mod-4-4/check.py ~/airflow-lab --step all
python3 scripts/prove.py mod-4-4 ~/airflow-lab
```

## @chaos The retry that doubled the rows
### @scenario
A small team runs a nightly Airflow pipeline that loads job postings into a warehouse for a hiring dashboard. The `load` task reads the day's file and appends the rows to a `jobs` table. It has worked for months.

One night the warehouse is slow and the `load` task times out after it has already inserted most of the rows. Airflow does what it is configured to do: it retries the task. The retry reads the same file and appends the same rows again. On the dashboard, that day shows twice as many postings and a skill-demand chart in which one skill has suddenly doubled. A week later the team notices that the chart for the previous Sunday is also too high: someone had cleared and rerun that day by hand "to be safe", and it was appended too.

### @cause
The task was **not idempotent**. A retry, a manual rerun and a backfill are all the same thing to the data: the same task for the same date, run again. A task that appends turns each of them into a duplicate. The mart added to its previous totals instead of being rebuilt, so one duplicate load changed the dashboard for good.

Contributing causes: the load was not wrapped in a transaction, so a crash left half a day; nobody compared the number of loaded rows with the number of rows in the file; and the pipeline had no test that ran the same date twice.

### @fix
1. **Replace the partition, in one transaction**: delete the rows of the date, insert the new ones, commit. Rerun as often as you like.
2. **Rebuild derived tables** (the mart) from the base tables instead of adding to them.
3. **Test idempotence** in CI: run a date twice and compare a fingerprint of the tables (row counts and a hash), exactly as the checker does.
4. **Reconcile**: log the number of lines read, rejected and loaded per run, and alert when the loaded count does not match.
5. **Repair**: rerun the affected dates. With an idempotent pipeline this is a command, and the corrected numbers appear in the dashboard without any manual SQL.

### @pattern
In an orchestrator, retries, reruns and backfills are normal, not exceptional. Design every task so that running it again for the same date produces the same result: use the date, replace instead of append, and make the write all-or-nothing.

## @quiz
### Why must a DAG's `start_date` be a fixed date and not `datetime.now()`?
- [ ] Airflow refuses to import any DAG file that mentions the current time in a setting
- [ ] A fixed date makes the tasks run faster, since Airflow can cache the schedule on disk
- [x] The file is imported again and again, so a moving date would keep changing the schedule
- [ ] A moving start date is allowed, but it cannot be used together with retries on the tasks

> The DAG file is parsed repeatedly. If the start date changes at every parse, there is no stable schedule and the dates of the runs no longer mean anything.

### A run is for the logical date 2026-03-02 but it executes on 9 March. Which file should `extract` read?
- [ ] The file of 9 March, because that is the day on which the task is actually running
- [x] The file of 2 March, taken from the run's `ds`, because the run belongs to that day
- [ ] The newest file in the inbox, since the newest delivery is always the most correct one
- [ ] Every file of March, because Airflow cannot know which single day the run is meant for

> `ds` is the date the run is for. Using it makes a late run, a rerun and a backfill produce the same result as the original run.

### A task appends 1,000 rows to a table and then crashes. Airflow retries it. What is the right design?
- [ ] Turn retries off for load tasks, since a retry can only make things worse
- [ ] Count the rows after every retry and delete the duplicates by hand during the morning
- [x] Delete that date's rows and insert them again in one transaction, so a retry is safe
- [ ] Append the rows to a second table on each attempt and let the dashboard pick the newest

> Idempotence is the property that matters: the same input for the same date gives the same table, however many times the task runs. A transaction makes the replacement all-or-nothing.

### The delivery file for a day is not there yet when `extract` runs. What should `extract` do?
- [ ] Return an empty result and succeed, so the rest of the pipeline stays green
- [x] Raise an exception, so that Airflow marks the attempt failed and retries it later
- [ ] Create an empty file with the right name so that the later tasks have something to read
- [ ] Skip the task silently and let tomorrow's run fill in the missing day on its own

> A failure is information, an empty success is a silent hole. An exception triggers the retry, which picks the file up when it arrives.

### Why does the pipeline refuse a delivery in which more than half of the lines are rejected?
- [ ] Airflow cannot store more than 50% rejected lines in the quarantine folder
- [ ] DuckDB does not accept tables built from fewer valid rows than rejected rows
- [x] A reject rate that high points to a problem upstream, and a partial day would look complete
- [ ] The retry would otherwise run forever, because rejected lines are retried until they are valid

> The valid 40% would look like a normal day but would be wrong. Failing in `validate`, before anything is written, protects the warehouse, and the downstream tasks end as `upstream_failed`.

### Why should tasks return a path or a count rather than the data itself?
- [ ] Python functions inside tasks cannot return lists, only single numbers and text
- [ ] Airflow deletes every returned list with more than ten items before the next task starts
- [x] Returned values are stored in Airflow's metadata database, meant for small values only
- [ ] Returning data makes the task non-idempotent, since the next task receives a copy of it

> The return value travels through an XCom in the metadata database. Put the data in a file or table and pass where it is.

### Why is a lot of work at the top level of a DAG file, such as opening the database, a bad idea?
- [ ] Top-level code runs only once, so the database would stay open for the whole life of the cluster
- [x] Airflow imports the file repeatedly, so that code would run over and over and slow things down
- [ ] Airflow forbids all imports at the top level of a DAG file, except for the airflow package itself
- [ ] The scheduler skips any DAG whose top-level code takes more than a few milliseconds to run

> Parsing happens continuously and at scale. Keep the top level to imports and the DAG definition; do real work inside the tasks.

### With `catchup=False`, what happens when you switch on a DAG whose `start_date` is three months ago?
- [ ] Airflow runs all the missed days at once, in parallel, to catch up as quickly as possible
- [x] It only schedules new runs from now on; past days are backfilled deliberately if wanted
- [ ] The DAG is paused until someone chooses the days to run in the web interface
- [ ] Airflow deletes the old schedule and picks a new start date at random for the DAG

> Catchup would create a run for each missed interval automatically. Turning it off keeps history under your control, and backfills are explicit.

## @resources
- [Airflow: DAGs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html)
- [Airflow: the TaskFlow tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)
- [Airflow: best practices](https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html)
- [Airflow: DAG runs (logical date, catchup, backfill)](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html)
- [Airflow: installing from PyPI (constraint files)](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html)
