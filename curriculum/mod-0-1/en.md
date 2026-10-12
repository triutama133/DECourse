---
title: The Data Landscape: What a Data Engineer Actually Does
duration: 1 week
summary: Understand why data engineering exists, how it differs from analysis and data science, and follow one order from a customer's phone to a dashboard, including every way it can go wrong.
why: Most courses start by typing SELECT * on a clean file. On the job, nobody hands you clean data: you receive duplicates, odd formats and late files, and people still expect the numbers to be right.
---

## @outcomes
- Explain in plain words why companies keep a separate analytics database instead of reporting from the production one
- Tell apart the work of a data engineer, analytics engineer, data analyst and data scientist
- Describe the path of data from source to dashboard and name what can break at each stage
- Recognise the five most common data problems (duplicates, late data, schema drift, bad values, volume changes) when you see them
- Read a small CSV file defensively and clean it with plain Python

## @prereq
Module 0.0 (Python from zero) is strongly recommended: the lab uses functions, loops, dictionaries and error handling that Module 0.0 explains. Module 0.2 sets up your computer properly; for this module's lab, any Python 3.9+ works.

> [!IMPORTANT]
> **Editor vs Terminal Reminder:**
> Open and edit code files (such as `labs/mod-0-1/pipeline.py`) in your text editor (VS Code / Cursor / the Lab tab in the app). Do not run the code file directly in bash without the python interpreter (e.g. do not type `labs/mod-0-1/pipeline.py` in your shell). Use the terminal only for test commands, such as `python3 labs/mod-0-1/test_lab.py -v`.

## @lesson Why this job exists: two kinds of database
Imagine **KopiKu**, a small online shop that sells specialty coffee beans from Gayo, Toraja and Flores. Every time a customer taps "Pay", the website writes one new row to a database: who bought, what, how much, when. That database exists to run the shop. It must answer small questions very fast ("what is in this customer's cart?") and it must never lose an order. This kind of database is called **OLTP** (Online Transaction Processing). PostgreSQL and MySQL are the usual choices.

Now the founder asks: "How much revenue did we make per city, per week, for the last two years?" To answer, the database must read millions of rows, group them, and add them up. This is an **OLAP** (Online Analytical Processing) question. It is a completely different shape of work:

| | OLTP (running the shop) | OLAP (understanding the shop) |
|---|---|---|
| Typical question | "Save this order." "Show cart #4821." | "Revenue per city per week since 2024?" |
| Rows touched per query | A handful | Millions |
| Speed that matters | Milliseconds for one request | Seconds or minutes for one big scan |
| Users | Customers, thousands at once | A few analysts and dashboards |
| Data | Current state | Full history |
| Design goal | Never lose or corrupt a write | Read and aggregate fast |

If an analyst runs the two-year revenue query directly on the production database, it competes with customers for the same CPU, memory and disk. Checkouts get slower, sometimes they time out, and the shop loses money while someone makes a chart. Some teams add a read replica to soften this, and that helps, but it does not fix the other problems: the data is shaped for writing, not for analysis; it only keeps the current state of each row; and it lives in a different system from your payments, your ads and your website events.

So companies copy the data into a **separate system built for analysis** (a data warehouse or a lakehouse) and keep it up to date. Doing that copying reliably, every day, for dozens of sources, with data that is correct and explained, is the job of the **data engineer**.

> **Tip:** When someone says "we need a data warehouse", the real need is almost always: "we need trustworthy numbers without slowing down the product." Keep that sentence in mind; it explains most design decisions in this course.

## @lesson Who does what: roles around data
Job titles overlap and differ between companies, so think in terms of **work**, not titles. Here is the usual split, using KopiKu again.

| Role | Main question | What they hand over |
|---|---|---|
| **Software engineer** | "How do we build the shop?" | The website, app and production database |
| **Data engineer** | "How do we get data from everywhere to one trustworthy place, on time?" | Pipelines, tables, tests, monitoring |
| **Analytics engineer** | "How do we turn raw tables into clean, shared business definitions?" | Modeled tables such as `fct_orders` and `dim_customers`, documented |
| **Data analyst** | "What happened, and why?" | Dashboards, reports, answers to business questions |
| **Data scientist / ML engineer** | "What will happen, and what should we do?" | Forecasts, recommendations, models |
| **Platform / DevOps engineer** | "How do we run all of this safely?" | Servers, networks, access, deployment tooling |

At a small company one person does several of these jobs. At a large company each one is a team. What does not change is the dependency: analysts and data scientists can only be as good as the data they receive. A model trained on duplicated orders learns the wrong thing; a dashboard built on a table that silently stopped updating misleads the CEO.

A useful way to describe the data engineer's output is: **the product of a data engineer is trust**. People should be able to open a table, believe its numbers, and know how fresh they are. Everything you will learn in this course (testing, idempotency, contracts, monitoring) serves that one goal.

Skills that matter, roughly in the order this course teaches them: SQL, Python, the command line and Git, data modeling, storage formats and engines, transformation, orchestration, data quality, and then distributed and real-time systems. You do not need all of them on day one; you need the first four to get started and a habit of learning the rest on real problems.

## @lesson The journey of one order
Follow a single KopiKu order, #4821, from the customer's phone to the CEO's dashboard. Each step is a stage that data engineers design and maintain.

1. **Source.** Budi taps "Pay" in the app. The backend writes a row in the `orders` table in PostgreSQL, and the website also sends a click event ("purchase") to an analytics tracker. These are the **sources**: databases, event streams, files from partners, third-party APIs (payments, ads).
2. **Ingestion.** A job copies new and changed data out of each source. It might read the database every hour, read a file a partner uploads each night, or listen to a stream of events. This is the first place things go wrong, because you do not control the source.
3. **Raw storage.** The data lands unchanged in a **raw** area (often called bronze). You keep the original so that if a later step has a bug, you can run it again from the real input.
4. **Transformation.** Jobs clean the data (fix types, remove duplicates, standardise statuses), combine it (orders with customers and products) and compute business concepts (revenue, active customer). The result is a **clean** layer (silver) and a **modeled** layer (gold) shaped for questions.
5. **Serving.** Dashboards, analysts' notebooks, machine learning models and sometimes the product itself read the modeled tables.
6. **Operations.** Throughout, schedulers run the jobs in order, tests check the data, and monitoring tells you when something is late or wrong. This is the part tutorials skip and companies pay for.

Two vocabulary points you will meet constantly:

- **Batch vs streaming.** Batch means processing data in chunks on a schedule (every hour, every night). Streaming means processing each event within seconds of it happening. Most data work is batch. Streaming is more complex and more expensive; use it only when a business decision really needs fresh data (fraud checks, live inventory).
- **ETL vs ELT.** ETL transforms data *before* loading it into the warehouse. ELT loads the raw data first and transforms it *inside* the warehouse with SQL. Modern cloud warehouses are powerful and cheap enough that ELT is the common default, which is why tools like dbt (Module 2.3) exist.

> **Tip:** Draw the journey for any system you work with: boxes for sources, arrows for jobs, and a mark wherever a failure would go unnoticed. That drawing is a data engineer's most useful first deliverable.

## @lesson The five ways data goes wrong
The KopiKu dataset you will use throughout this course is deliberately a little dirty, because real data is. These problems cover most of what you will ever debug. Learn to recognise them early.

**1. Duplicates.** The same order appears twice. Causes: a job retried after a timeout and loaded the file again; a source sends "at least once"; two sources both report the same event. Effect: revenue is counted twice. Defence: give every record a stable key and make loads *idempotent* (running twice leaves the same result), which Module 2.4 covers in depth.

**2. Late or missing data.** A partner's file arrives at 09:40 instead of 06:00. A mobile app was offline and sends yesterday's events today. Effect: yesterday's report is wrong, then silently "fixes itself". Defence: record two times (when it happened and when you received it), and design jobs to reprocess recent days.

**3. Schema drift.** A source team renames `total` to `total_amount`, or turns an integer into text, without telling you. Effect: your job crashes, or worse, fills a column with nulls and carries on. Defence: validate the shape of data at the door and agree *data contracts* with producers (Module 2.5).

**4. Bad values.** Negative totals, `"Rp 1.250.000"` where a number should be, a status written as `PAID`, `paid` and `Paid`, a customer id that does not exist, a date written day-first. Effect: wrong sums, broken joins, rows silently dropped. Defence: parse strictly, normalise, and send rows you cannot trust to a **quarantine** instead of guessing or discarding them quietly.

**5. Volume and speed changes.** Black Friday multiplies traffic by ten, or a bug halves it. A job that took five minutes now takes five hours, or runs out of memory. Effect: late dashboards, crashed jobs, surprise cloud bills. Defence: measure volumes and durations, alert on anomalies, and design for scale (Levels 2 and 3).

There is a sixth category worth naming: **infrastructure failures** (a server restarts mid-job, a disk fills, a credential expires). They are less interesting but cause many 3 a.m. incidents. The common defence for all six is the same trio: **validate at the boundary, make every step safe to re-run, and observe everything.**

> **Warning:** The most dangerous failures are the *silent* ones. A crash is visible and gets fixed in an hour. A pipeline that runs "successfully" and writes wrong numbers can mislead decisions for weeks. When you design anything in this course, ask: "if this went wrong, how would I find out?"

## @lesson The formats you will meet
Data arrives in a handful of file formats. Knowing their traps saves hours.

**CSV** (comma-separated values) is the most common exchange format and the least reliable. It has no types: every value is text, so `007` and `7` and `"7"` are indistinguishable until you decide. It has no standard for dates, decimal separators, quoting or encoding; a customer name containing a comma or a line break breaks naive parsing. Always use a real CSV parser (Python's `csv` module), never `line.split(",")`, and always state the encoding (usually UTF-8).

**JSON** and **NDJSON**. JSON describes nested data and has basic types (string, number, boolean, null). NDJSON (newline-delimited JSON) puts one JSON object per line, which lets you process a huge file one line at a time without loading it all. Click events and logs commonly use NDJSON. Watch for fields that are sometimes missing and for numbers that arrive as strings.

**Parquet** is a *columnar* binary format used for analytics. It stores each column together, compresses well, and keeps the types, so reading three columns out of fifty only reads those three. You will use it heavily from Module 2.1 onward. You cannot open it in a text editor, which is a fair price for being much smaller and faster than CSV.

**Database tables** are the other main source. You read them with SQL, either as a full copy or by capturing only what changed (change data capture, Module 3.2).

A rule of thumb: CSV and JSON are for *exchange* (humans and other systems send them to you); Parquet and database tables are for *storage and analysis*. A common first step in a pipeline is turning the former into the latter, with types enforced.

## @lesson How this course works, and the KopiKu data
Each module has four parts, and they are meant to be done in order:

1. **Lessons** (this page). Read them with the lab open next to you.
2. **Lab.** You write real code against the KopiKu data. Every lab has automatic tests so you know whether your solution is actually correct, not just "runs". A reference solution is included; open it only after you have tried.
3. **Chaos lab.** A real-style production failure. Guess the cause before reading the answer. Debugging is a skill you build by practising it.
4. **Quiz.** Short questions that check you understood the ideas, not the syntax.

The data for every lab comes from one generator, `labs/shared/shopgen.py`. With the same settings it always produces the same files, so your results can be checked exactly. It creates customers, products, orders and order lines, website events, and a log of customer changes, and it plants the problems from the previous lesson at known rates: duplicate rows, `Rp 1.250.000`-style totals, mixed-case statuses, two date formats, negative totals, orphan customer ids, truncated JSON lines. A `manifest.json` records exactly what was planted, which is how the tests know the right answer.

Two habits will help more than any tool:

- **Look at the data first.** Before writing any code, open the file and read fifty rows. Every serious bug in this course can be seen by eye if you look.
- **Write down what "correct" means.** For each job, state one or two facts that must be true of its output (for example: "each order appears once"; "daily revenue never counts cancelled orders"). Those sentences become your tests.

## @lab Lab: clean the KopiKu orders file
You have a file of order rows with the problems described above. Write four small functions that turn it into trustworthy data and compute daily revenue. This is a miniature version of what every pipeline does: read, validate, normalise, quarantine what you cannot trust, then compute.

### @steps
1. Make sure you can run Python 3 (`python3 --version`). If you do not have the course files yet, follow the **Start here** page of the app first (it shows how to download them and where to open a terminal; Module 0.2 teaches the terminal and Git properly). From the repository root, generate the data:

```bash
python3 labs/shared/shopgen.py --out data
```

2. Look before you code. Read the file and find the problems with your own eyes:

```bash
head -20 data/orders.csv
grep -c "Rp " data/orders.csv     # totals written as text
grep -c ",-" data/orders.csv      # negative totals
cat data/manifest.json            # what was planted, and how much
```

3. Open `labs/mod-0-1/pipeline.py` in your text editor (e.g. click it in your editor sidebar or type `code labs/mod-0-1/pipeline.py`; do not execute directly in bash!). Four functions raise `NotImplementedError`. Implement them in this order, running the tests after each one:
   `parse_total`, then `parse_ts`, then `clean_orders`, then `daily_revenue`.
4. Decide what to do with a row you cannot trust. The rule for this lab: **never guess and never drop silently.** Every dropped row goes into `rejected` with a short reason.
5. Run the program on the real file and compare the count of rows in and out:

```bash
python3 labs/mod-0-1/pipeline.py data/orders.csv
```

6. Optional: write three sentences in a `NOTES.md` describing the problems you found and which one surprised you.
7. **Do it for real.** The in-browser box above is only a preview. After Module 0.2 (terminal, venv, Git), repeat this lab on your own computer: create a venv, `pip install pytest`, write the four functions again in your own editor **without copying**, and run `pytest labs/mod-0-1/test_lab.py -v` until it is green. That setup is part of the skill. Then run `python3 scripts/prove.py mod-0-1` inside your venv: it prints a proof code that you paste into the **Proof** box on this lab page.

### @files
- labs/mod-0-1/pipeline.py :: Your working file: implement the four TODO functions :: starter
- labs/mod-0-1/test_lab.py :: The tests that check your work :: test
- labs/shared/shopgen.py :: Generator for the KopiKu data :: data
- labs/mod-0-1/reference/pipeline.py :: One possible solution (try first!) :: reference

### @deliverables
- All 8 tests in test_lab.py pass **on your own computer, run from your own terminal** (a pass in the browser preview does not count)
- Every dropped row appears in `rejected` with a reason
- You can explain which of the five problems each rejected or repaired row represents

### @verify
Run the tests from the repository root:

```bash
python3 labs/mod-0-1/test_lab.py -v
```

All tests should print `ok`. To see what a passing run looks like before you start, run the tests against the reference solution: `LAB_DIR=reference python3 labs/mod-0-1/test_lab.py`.

## @chaos The Tuesday revenue that doubled
### @scenario
On Wednesday morning the CEO asks why Tuesday's revenue is exactly twice the usual figure. Nothing special happened: no campaign, no price change. The nightly job that loads orders into the analytics database reports "success" every day. Orders in the shop database for Tuesday look normal.

You are given the job's log: on Tuesday night the load step ran at 01:00, failed at 01:07 with a network timeout while *writing*, and the scheduler automatically retried it at 01:10. The retry finished normally.

### @cause
The job **appends** the day's orders to the analytics table with a plain `INSERT`. The first attempt wrote most of the rows before the timeout. The retry started from the beginning and wrote *all* the rows again. The first run's rows were never removed, so most orders now exist twice, and any `SUM(total)` double-counts them.

Two things made it worse: the job reports success after the retry, so no alert fired, and nothing checks that each order id appears only once.

### @fix
1. Repair the data: for the affected day, delete and reload the rows, or remove the duplicates by keeping one row per `order_id`.
2. Make the load **idempotent**: replace the day's data in one atomic step (delete the day and insert it in one transaction, or use `MERGE`/upsert keyed on `order_id`) instead of blindly appending.
3. Add a check that fails the job if any `order_id` appears more than once, and a check that compares the day's row count with the source.

### @pattern
Assume every job will run twice someday. If running it twice changes the result, the job is not finished. This idea (idempotency) comes back in almost every module.

## @quiz
### Why do companies usually build a separate analytics database instead of reporting directly from the production database?
- [ ] Production databases are designed to keep only the most recent year of data, so older history has to live in a different system anyway
- [x] Big analytical queries slow down customer transactions, and production tables are designed for writing rather than for analysis
- [ ] Analytical databases cost nothing to run because they only hold copies, so splitting them out always lowers the monthly bill
- [ ] SQL queries cannot run against a production database, so analysts must export every table into spreadsheets before they can use it

> Production (OLTP) systems must stay fast for small writes. Scanning millions of rows on them slows the product, and their design (current state, many small tables) is poorly suited to historical analysis.

### In the KopiKu example, which role is mainly responsible for getting data from the website, payments and ads into one trustworthy place on time?
- [ ] The data analyst, who builds the dashboards that the whole company reads every morning
- [x] The data engineer, who builds and runs the pipelines that move data between systems
- [ ] The software engineer on the checkout team, who owns the production database schema
- [ ] The data scientist, who trains the models that forecast next month's demand

> The data engineer builds and runs the pipelines that move and prepare data. Analysts and scientists use the result; software engineers build the sources.

### A nightly job loads the day's orders by appending them to a table. It fails halfway and the scheduler retries it automatically. What is the most likely result?
- [ ] The table is unchanged, because a failed job always rolls back everything it wrote before the failure
- [ ] The retry notices which rows already exist and skips them, so each order is stored exactly once
- [x] Many orders are loaded twice, so every sum, count and average for that day is too high until fixed
- [ ] The retry first deletes the whole table and rebuilds it, so the data stays correct but slow to appear

> A plain append has no memory of the first attempt. Unless the load is idempotent (replace or upsert by key), the retry adds the rows again.

### Which statement about batch and streaming processing is accurate?
- [ ] Streaming is always the better design because it is newer and therefore handles every workload more cheaply
- [ ] Batch processing cannot cope with large data, which is the main reason companies move to streaming
- [x] Batch is simpler and runs on a schedule; streaming reacts within seconds but is harder to build and run
- [ ] A company must choose one of the two, because batch and streaming systems cannot share the same data

> Most analytics is batch. Streaming adds state, ordering and failure-recovery complexity, which is justified for things like fraud detection but not for a weekly report.

### What is the main reason to keep an unchanged copy of incoming data in a raw layer?
- [ ] Raw data takes less storage than cleaned data, so keeping it first saves money on every later step
- [ ] A raw copy makes dashboards load faster because the data has not yet been through any slow transformation
- [x] If a later transformation has a bug, you can fix it and rerun everything from the real original input
- [ ] Data protection regulations require every table in a warehouse to have a matching untouched raw table

> Reprocessing from raw is what makes fixes and backfills possible. If you only store transformed data, a bug in the transformation may destroy the evidence.

### A source team renames a column from `total` to `total_amount` without telling you. Your job keeps running but the revenue column is now empty. Which problem category is this?
- [ ] Duplicates: the renamed column was loaded alongside the old one, so every order now appears twice
- [ ] Late data: the new column name arrives after the old one, so revenue is filled in a few hours later
- [x] Schema drift that went unnoticed because nothing checked the shape of the incoming data
- [ ] A volume spike: the job slowed down so much that it stopped writing the revenue column

> Schema drift is a change in the structure of the source. The silent part is the real failure: a boundary check would have stopped the job with a clear error.

### Why should you use Python's `csv` module instead of `line.split(",")` to read a CSV file?
- [ ] `split` is slower on every file, and the `csv` module is written in C to avoid that cost
- [ ] The `csv` module converts every column to the right type automatically, so no further cleaning is needed
- [ ] `split` cannot read files larger than memory, while the `csv` module always reads one row at a time
- [x] A quoted CSV value can contain commas, quotes or line breaks, which `split` cuts in the wrong place

> A quoted value like `"Santoso, Budi"` contains a comma that is not a separator. The csv module follows the quoting rules. Note it still returns every value as text; converting types is your job.

### A pipeline runs every night and reports success, but for three weeks it has been writing orders with a total of 0 because of a parsing bug. What would have caught this soonest?
- [ ] Running the same job on a faster server so that it finishes before anyone opens the dashboard
- [x] Checks on the output, such as "no total is zero or negative" and "revenue is in a normal range"
- [ ] Sending the job's full log file to the CEO every morning so someone reads the warnings
- [ ] Changing the input format from CSV to JSON, which has real number types and so cannot produce a zero

> Success of the job only says the code ran. Checks on the content of the output say whether the result is believable. Silent failures are caught by tests on data, not on execution.

## @resources
- [Python csv module documentation](https://docs.python.org/3/library/csv.html)
- [Python datetime: strptime format codes](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes)
