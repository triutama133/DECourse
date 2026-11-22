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
Module 0.0 (Python from zero) and Module 0.1 (terminal, virtual environments and `pytest`) prepare you for this module: the lab uses functions, loops, dictionaries, error handling and running `pytest` inside your course venv (`python -m pip install -r labs/mod-0-2/requirements.txt`). Any Python 3.10+ works, and the browser preview works first if you just want to try quickly.

> [!IMPORTANT]
> **Editor vs Terminal Reminder:**
> Open and edit code files (such as `labs/mod-0-2/pipeline.py`) in your text editor (VS Code / Cursor / the Lab tab in the app). Do not run the code file directly in bash without the python interpreter (e.g. do not type `labs/mod-0-2/pipeline.py` in your shell). Use the terminal only for test commands, such as `pytest labs/mod-0-2/test_lab.py -v`.

## @part The job and the people

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

> 🛠 **Try it (10 min, in Python).** Generate the data (`python3 labs/shared/shopgen.py --out data`) and read `data/orders.csv` with `csv.DictReader` from Module 0.0 to feel the difference between an **OLTP point lookup** and an **OLAP full scan**:
> 1. Walk the `3634` rows and build a dict `by_id` keyed by `order_id` (`by_id[row["order_id"]] = row`). How many duplicate keys overwrite an earlier row, leaving `len(by_id)` shorter than `3634`? Notice looking up `by_id["1001"]` touches **one** item instantly (OLTP).
> 2. Now run a full scan across every row to count how many orders belong to each lowercase status (`counts[status] = counts.get(status, 0) + 1`, the counting line from Module 0.0). Notice it must touch **all** `3634` rows (OLAP).
>
> **You should see:** `len(by_id)` is `3599` (so `35` duplicate order IDs appear in the file!), while `counts` visits every row to summarise categories. Module 0.3 shows how SQL databases do both with `PRIMARY KEY` lookups vs `GROUP BY` scans.

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

> 🛠 **Try it (5 min, pen and paper).** Who does the work? Write the role (software engineer, data engineer, analytics engineer, data analyst, data scientist or platform engineer) for each task: (a) a nightly job that copies orders into the warehouse and alerts when it is late; (b) a dashboard of weekly revenue per city; (c) a model that predicts which customers will stop ordering; (d) the checkout page of the shop; (e) a documented `fct_orders` table with one agreed definition of "revenue"; (f) a cluster that runs all the jobs.
>
> *Compare:* (a) data engineer, (b) data analyst, (c) data scientist, (d) software engineer, (e) analytics engineer, (f) platform engineer. Then write two sentences: which of these tasks would be yours at a five-person company, and which would you not want to do alone?

## @lesson The big picture: the lifecycle, the undercurrents, and the people
> **In short:** Every data engineering job, whatever its tools, moves data through five stages: generation, storage, ingestion, transformation and serving. Six "undercurrents" run under all five: security, data management, DataOps, data architecture, orchestration and software engineering. What you build should fit how far along the company is with data. Most of the job is working with the people on either side of you.

This map comes from *Fundamentals of Data Engineering* by Joe Reis and Matt Housley. It helps when the list of tools feels endless: every tool you will meet fits somewhere on it.

**The five stages** (this course teaches them in roughly this order):

- **Generation.** Data is born in systems you usually do not own: the app's database, a payment provider, a phone, a log. Their owners can change them without asking you. (Module 1.6, 3.2)
- **Storage.** Where data rests at every step: files, databases, warehouses, lakehouse tables. (Modules 1.7, 2.1, 2.2, 2.6)
- **Ingestion.** Copying data from the sources to your platform. This is where most breakages start: sources go down, slow you down, or change shape. (Modules 1.6, 3.2)
- **Transformation.** Turning raw records into tables people can trust: right types, one row per thing, clear definitions. (Modules 0.3, 1.3, 1.4, 2.3)
- **Serving.** Handing the result to the people and programs that use it: dashboards, analysts, machine-learning models, other applications. (Modules 2.6, 3.5)

**The six undercurrents** are not stages; they are habits you need in every stage. Security (who may see what), data management (quality, definitions, privacy), DataOps (automating, testing and watching pipelines), data architecture (choosing how the pieces fit), orchestration (running steps in the right order) and software engineering (code that others can read, test and change). This is why job postings ask a data engineer for skills that sound like DevOps or software engineering: they are part of the job.

## @lesson Data maturity, engineer types, and working with people
The book describes three stages of *data maturity*. A good design for one stage is a bad design for another.

| Stage | What it looks like | What usually works |
|---|---|---|
| **1. Starting with data** | Spreadsheets and CSV exports, no warehouse, leaders want a few reliable numbers | Ready-made tools: a managed loader, a simple warehouse or DuckDB, a few clean tables |
| **2. Scaling with data** | Many sources, reports that break when a source changes, teams with different "revenue" numbers | Tests, agreed definitions, data contracts, an orchestrator, modeled tables |
| **3. Leading with data** | Data is part of the product: recommendations, fraud checks, self-service for many teams | Custom systems where they give an edge, such as streaming, plus strong governance |

The book also names two kinds of data engineer. **Type A** (A for *abstraction*) uses ready-made services and avoids building what can be bought. **Type B** (B for *build*) builds custom systems. Type A engineers are useful at every stage; Type B engineers mostly pay off at stages 2 and 3. The classic mistake is a stage-1 company building a stage-3 platform: months of work on clusters before anyone sees a single useful number.

### The people on either side of you
In the TalentHub job database, 64% of the 1,130 data engineering postings mention communication or stakeholders. That is more than mention Spark (46%) and almost as many as mention Python (69%). The book puts it plainly: data teams rarely fail because of technology.

- **Upstream: the people who produce the data**, usually application engineers. To them, the database exists to run the app; your reports are a side effect. When they break your pipeline, a complaint does nothing. Explain what breaks downstream and who depends on it, and agree in writing which columns they will keep stable (a *data contract*, Module 2.5).
- **Downstream: the people who use the data:** analysts, data scientists, managers. They often ask for a solution they have heard of ("we need a real-time dashboard") instead of the problem they have. Ask about the decision instead: *What will you do when this number changes, and how quickly do you need to act?* If the answer is "we look at it in the Monday meeting", a reliable daily job beats a streaming system.

> 🛠 **Try it (10 min, paper and the simulator).** First open the maturity simulator at the top of this page and find, for each stage, the choice it calls right-sized. Its costs are a rough teaching model, not measured prices: use it to see the shape of the trade-off. Then write a three-line scoping note for KopiKu from what this module has told you about it: (1) its maturity stage, and the fact that told you; (2) who produces the orders data and who uses the revenue number; (3) Type A or Type B, and the one question you would ask the CEO before deciding.
>
> **You should see:** stage 1: one website database, the founder asking first questions, nothing to analyse with yet. The website (and whoever builds it) produces the orders; the founder uses the revenue number. Type A, after asking something like "what will you decide with this number, and how often?". If your question was about tools rather than the decision, try again.

**Two more distinctions from the book.** First, the **data engineering lifecycle** is only part of the wider **data lifecycle** of a business. The five stages describe what engineers build: generation, storage, ingestion, transformation, serving. The business also decides how long data must be kept, who may see it, when it must be archived and when it must be deleted, often because a law or a contract says so. Those decisions are made by legal, finance or security, not by you, but you are the one who has to carry them out in every copy of the data: the raw files, the warehouse, the backups and the exports (Module 2.5 shows how hard a single "delete this customer" can be).

Second, data engineers face **inward** or **outward**. **Internal-facing** engineers build for the company itself: pipelines, a warehouse, dashboards and reports for analysts and managers. That is most data engineering jobs, and it is what this course trains first. **External-facing** engineers build data systems that customers use inside the product: a sales dashboard inside an app, recommendations on a website, an event pipeline behind a feature. The same skills apply, but the requirements are stricter: many more users at once, answers in under a second, and a mistake is seen by customers instead of a colleague (Module 2.6 compares the two). Many jobs mix both, so ask in an interview which one the role leans towards.

> 🛠 **Try it (10 min, pen and paper).** For each KopiKu task, write *internal* or *external*, and either the lifecycle stage it belongs to or "wider data lifecycle" if the decision comes from outside engineering: (1) a weekly revenue dashboard for the founder; (2) a "your sales this month" page inside the app KopiKu sells to café owners; (3) "customers who bought Gayo also bought…" on the website; (4) a nightly copy of the orders database into the warehouse; (5) deleting a customer's personal data when they close their account; (6) suppose finance says order records must be kept for ten years: setting that up.
>
> **You should see:** (1) internal, serving; (2) external, serving (customer-facing analytics); (3) external, serving, built on transformation; (4) internal, ingestion into storage; (5) wider data lifecycle: the rule comes from privacy law and the company's policy, and engineering carries it out in every copy; (6) wider data lifecycle as well: finance sets the period, and engineering turns it into storage lifecycle rules (Module 3.4). If you put (5) or (6) under a single stage, notice that they touch every stage at once.

## @part The data you will work with

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

> 🛠 **Try it (10 min, in the terminal).** Walk one file through the journey with commands, from the course folder: `python3 labs/shared/shopgen.py --out data` (source), `mkdir -p raw && cp data/orders.csv raw/orders_$(date +%F).csv` (ingestion and raw storage), and `cut -d, -f4 raw/orders_*.csv | tail -n +2 | sort | uniq -c | sort -rn` (a first transformation: orders per status). Say in one sentence which stages you just did and which are still missing before a dashboard could read this.
>
> **You should see:** `2080 delivered` at the top and, further down, `34 DELIVERED` and `34 Delivered`: the same status written three ways. A transformation step has to fix that before anyone can trust a count, and because you copied to `raw/` first, you can fix it again and again without asking the source for the file.

## @lesson The five ways data goes wrong
The KopiKu dataset you will use throughout this course is deliberately a little dirty, because real data is. These problems cover most of what you will ever debug. Learn to recognise them early.

**1. Duplicates.** The same order appears twice. Causes: a job retried after a timeout and loaded the file again; a source sends "at least once"; two sources both report the same event. Effect: revenue is counted twice. Defence: give every record a stable key and make loads *idempotent* (running twice leaves the same result), which Module 2.4 covers in depth.

**2. Late or missing data.** A partner's file arrives at 09:40 instead of 06:00. A mobile app was offline and sends yesterday's events today. Effect: yesterday's report is wrong, then silently "fixes itself". Defence: record two times (when it happened and when you received it), and design jobs to reprocess recent days.

**3. Schema drift.** A source team renames `total` to `total_amount`, or turns an integer into text, without telling you. Effect: your job crashes, or worse, fills a column with nulls and carries on. Defence: validate the shape of data at the door and agree *data contracts* with producers (Module 2.5).

**4. Bad values.** Negative totals, `"Rp 1.250.000"` where a number should be, a status written as `PAID`, `paid` and `Paid`, a customer id that does not exist, a date written day-first. Effect: wrong sums, broken joins, rows silently dropped. Defence: parse strictly, normalise, and send rows you cannot trust to a **quarantine** instead of guessing or discarding them quietly.

**5. Volume and speed changes.** Black Friday multiplies traffic by ten, or a bug halves it. A job that took five minutes now takes five hours, or runs out of memory. Effect: late dashboards, crashed jobs, surprise cloud bills. Defence: measure volumes and durations, alert on anomalies, and design for scale (Levels 2 and 3).

There is a sixth category worth naming: **infrastructure failures** (a server restarts mid-job, a disk fills, a credential expires). They are less interesting but cause many 3 a.m. incidents. The common defence for all six is the same trio: **validate at the boundary, make every step safe to re-run, and observe everything.**

> **Warning:** The most dangerous failures are the *silent* ones. A crash is visible and gets fixed in an hour. A pipeline that runs "successfully" and writes wrong numbers can mislead decisions for weeks. When you design anything in this course, ask: "if this went wrong, how would I find out?"

:::ask Revenue doubled overnight. The cause: a job was retried after a timeout and loaded the same file twice. Which fix solves this kind of problem for good?
@options
delete the second copy by hand each morning
run the job less often
* give every record a stable key and make the load idempotent: running twice leaves the same result
@why
Duplicates come from retries, "at least once" delivery and overlapping sources, so they will keep coming. A stable key plus an idempotent load makes a repeat harmless instead of something you must remember to clean.
:::

:::ask A source team renames `total` to `total_amount` without telling you. Your job keeps running and fills the `total` column with nulls. Which defence catches this at the door?
@options
more memory for the job
* validate the shape of the data when it arrives, and agree a data contract with the producer
a bigger dashboard
@why
This is **schema drift**, and it is dangerous because nothing crashes. Checking the columns and types on arrival turns a silent corruption into a loud, early failure.
:::

:::drill python Find the repeated ids
Write `repeated_ids(rows)`: the order ids that appear **more than once** in `rows` (a list of dicts with `"order_id"`), each once, sorted.
@starter
# write your function below this line

@check
defines("repeated_ids") ## Define repeated_ids(rows).
repeated_ids([{"order_id": "1"}, {"order_id": "2"}, {"order_id": "1"}, {"order_id": "3"}, {"order_id": "1"}, {"order_id": "2"}]) == ["1", "2"] ## Ids 1 and 2 appear more than once: ["1", "2"].
repeated_ids([{"order_id": "7"}, {"order_id": "8"}]) == [] ## No repeats gives an empty list.
repeated_ids([]) == [] ## An empty input gives an empty list.
@hint
Count each id with a dictionary (`counts[id] = counts.get(id, 0) + 1`), then keep the ids whose count is above 1 and sort them.
@solution
def repeated_ids(rows):
    counts = {}
    for row in rows:
        counts[row["order_id"]] = counts.get(row["order_id"], 0) + 1
    return sorted(i for i, n in counts.items() if n > 1)
:::

> 💡 **Practice Pause 1 (Explore Dirty Data):**
> Before reading about data formats, prove these five problems on your computer! Open a terminal in the course folder, generate the dataset, and inspect the order file:
> `python3 labs/shared/shopgen.py --out data`
> `head -20 data/orders.csv`
> `grep -c "Rp " data/orders.csv` (totals written as formatted text)
> `grep -c ",-" data/orders.csv` (negative/corrupted totals)
> `cat data/manifest.json` (JSON is structured key-value text explained in the next lesson; `manifest.json` lists every anomaly planted by the generator)
> You are now looking directly at what real data engineers deal with every day. Proceed to Lesson 6 below.

## @lesson The formats you will meet
Data arrives in a handful of file formats. Knowing their traps saves hours.

**CSV** (comma-separated values) is the most common exchange format and the least reliable. It has no types: every value is text, so `007` and `7` and `"7"` are indistinguishable until you decide. It has no standard for dates, decimal separators, quoting or encoding; a customer name containing a comma or a line break breaks naive parsing. Always use a real CSV parser (Python's `csv` module), never `line.split(",")`, and always state the encoding (usually UTF-8).

**JSON** and **NDJSON**. JSON describes nested data and has basic types (string, number, boolean, null). NDJSON (newline-delimited JSON) puts one JSON object per line, which lets you process a huge file one line at a time without loading it all. Click events and logs commonly use NDJSON. Watch for fields that are sometimes missing and for numbers that arrive as strings.

**Parquet** is a *columnar* binary format used for analytics. It stores each column together, compresses well, and keeps the types, so reading three columns out of fifty only reads those three. You will use it heavily from Module 2.1 onward. You cannot open it in a text editor, which is a fair price for being much smaller and faster than CSV.

**Database tables** are the other main source. You read them with SQL, either as a full copy or by capturing only what changed (change data capture, Module 3.2).

A rule of thumb: CSV and JSON are for *exchange* (humans and other systems send them to you); Parquet and database tables are for *storage and analysis*. A common first step in a pipeline is turning the former into the latter, with types enforced.

**Parsing two date formats in Python (`datetime.strptime`).** Dates from CSV files often mix styles like `"2026-01-31T14:03:00"` and `"31/01/2026 14:03"`. Python's standard library includes `from datetime import datetime`, whose `datetime.strptime(text, fmt)` tries parsing text against a format template (`"%Y-%m-%dT%H:%M:%S"` for ISO or `"%d/%m/%Y %H:%M"` for day/month/year) and raises `ValueError` if it does not match. Catch `ValueError` to try the next format, then format the valid result cleanly back to standard ISO text with `dt.strftime("%Y-%m-%dT%H:%M:%S")`.

:::drill python Read a percentage
Write `parse_percent(raw)`: `"12%"` or `" 12 % "` gives the number `12`; text that is not a whole number with an optional `%` (for example `"abc"`, `""`) gives `None`, never an error.
@starter
# write your function below this line

@check
defines("parse_percent") ## Define parse_percent(raw).
parse_percent("12%") == 12 ## "12%" should give 12.
parse_percent(" 7 % ") == 7 ## Spaces around the number and the % must be ignored: 7.
parse_percent("abc") is None ## Unreadable text gives None, not an error.
parse_percent("") is None ## An empty cell gives None.
@hint
Remove the spaces and the `%`, then `int(...)` inside `try` / `except ValueError` that returns `None`.
@solution
def parse_percent(raw):
    text = raw.replace("%", "").strip()
    try:
        return int(text)
    except ValueError:
        return None
:::

:::drill python One date format
Write `parse_day(raw)`: a day-first date such as `"31/01/2026"` gives the ISO text `"2026-01-31"`; anything that is not a valid date in that format (`"2026-01-31"`, `"31/02/2026"`, `""`) gives `None`. Use `datetime.strptime`.
@starter
from datetime import datetime

# write your function below this line

@check
defines("parse_day") ## Define parse_day(raw).
parse_day("31/01/2026") == "2026-01-31" ## "31/01/2026" should give "2026-01-31".
parse_day("05/03/2026") == "2026-03-05" ## Day first: "05/03/2026" is 5 March: "2026-03-05".
parse_day("31/02/2026") is None ## 31 February does not exist: None.
parse_day("2026-01-31") is None ## A different format is not accepted here: None.
parse_day("") is None ## An empty cell gives None.
@hint
```python
def parse_day(raw):
    try:
        return datetime.strptime(raw, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None
```
@solution
from datetime import datetime

def parse_day(raw):
    try:
        return datetime.strptime(raw, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None
:::

> 💡 **Practice Pause 2 (Number & Timestamp Parsers):**
> Do not read the next section yet! Open `labs/mod-0-2/pipeline.py` in your text editor (click it in the sidebar or type `code labs/mod-0-2/pipeline.py`).
> Apply the type conversions you just learned:
> 1. Implement `parse_total(raw)`: strip `"Rp"` and dots, convert to an integer, and return `None` if unreadable or empty.
> 2. Implement `parse_ts(raw)`: try both `datetime.strptime` formats above and return ISO text `"YYYY-MM-DDTHH:MM:SS"` or `None`.
> Test both parsers in your terminal:
> `pytest labs/mod-0-2/test_lab.py -v -k TestParsers`
> When both parser tests show PASSED, you are ready for defensive cleaning rules in Lesson 7.

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

> 💡 **Practice Pause 3 (Defensive Cleaning & Revenue Aggregation):**
> Return to `labs/mod-0-2/pipeline.py` in your editor to complete the full lab:
> 1. Implement `clean_orders(rows)`: partition rows into `clean` and `rejected` (recording `reason` for each dropped row). Deduplicate order_ids by keeping the first occurrence.
> 2. Implement `daily_revenue(clean)`: sum revenue per date `YYYY-MM-DD`, excluding cancelled and refunded orders.
> Run the complete test suite in your terminal:
> `pytest labs/mod-0-2/test_lab.py -v`
> Once all 8 tests are GREEN, run the pipeline against the real dataset:
> `python3 labs/mod-0-2/pipeline.py data/orders.csv`
> Congratulations! You have built your first defensive data cleaning pipeline!

## @lab Lab: clean the KopiKu orders file
You have a file of KopiKu order rows with the problems from the lessons: totals written as text, two date formats, duplicates, impossible values. Write four small functions that turn it into data you can trust, then compute revenue per day. This is a miniature of what every pipeline does: read, check, clean, set aside what you cannot trust, then compute.

| Function | What it does | Where you will need it at work |
|---|---|---|
| `parse_total` | `"Rp 1.250.000"` or `"150000"` becomes the number of rupiah, or `None` when it cannot be understood | every source writes money its own way; reports need one number type |
| `parse_ts` | two date formats (`"2026-01-31T14:03:00"`, `"31/01/2026 14:03"`) become one standard format | revenue per day, late deliveries, "last 7 days": all need dates you can compare |
| `clean_orders` | keeps the good rows with the right types, and puts every bad row in `rejected` with a reason | the core of a pipeline: nothing wrong goes into reports, and nothing is thrown away without a trace |
| `daily_revenue` | revenue per day, without cancelled and refunded orders | the number the founder asks for every morning |

The functions build on each other: `clean_orders` uses `parse_total` and `parse_ts`, and `daily_revenue` uses the result of `clean_orders`. That is why the order matters.

### @steps
1. Open the **Browser preview** below and read `pipeline.py` from top to bottom once: four empty functions, each with its description and real examples from the file.
2. Write them in this order, running the tests after each and looking only at its group: `parse_total`, then `parse_ts`, then `clean_orders`, then `daily_revenue`.
3. The rule for a row you cannot trust: **never guess and never drop silently.** Every row you leave out goes into `rejected` with a short reason.
4. Optional, if you did Start here: look at the real file with your own eyes. In the terminal, from the course folder:

```bash
python3 labs/shared/shopgen.py --out data
head -20 data/orders.csv           # the first 20 lines
grep -c "Rp " data/orders.csv      # how many totals are written as text
cat data/manifest.json             # what was planted in the file, and how much
```

5. **Do it for real.** On your own computer, with the course venv from Module 0.1 active, write the four functions again in your editor **without copying** from the preview, then from the course folder:

```bash
pytest labs/mod-0-2/test_lab.py -v                  # until all tests pass
python3 labs/mod-0-2/pipeline.py data/orders.csv    # run it on the real file: rows in, clean, rejected
python3 scripts/prove.py mod-0-2                    # your proof code for the Proof box on this page
```

6. Optional: write three sentences in a `NOTES.md` about the problems you found and which one surprised you.

### @files
- labs/mod-0-2/pipeline.py :: Your working file: implement the four TODO functions :: starter
- labs/mod-0-2/test_lab.py :: The tests that check your work :: test
- labs/shared/shopgen.py :: Generator for the KopiKu data :: data
- labs/mod-0-2/reference/pipeline.py :: One possible solution (try first!) :: reference

### @deliverables
- All 8 tests in test_lab.py pass **on your own computer, run from your own terminal** (a pass in the browser preview does not count)
- Every dropped row appears in `rejected` with a reason
- You can explain which of the five problems each rejected or repaired row represents

### @verify
Run the tests from the repository root:

```bash
pytest labs/mod-0-2/test_lab.py -v
```

All 8 tests should pass (`8 passed`). To see what a passing run looks like before you start, run the tests against the reference solution: `LAB_DIR=reference pytest labs/mod-0-2/test_lab.py -v`.

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

### A two-person startup keeps its numbers in spreadsheets. The CEO asks for a Kafka-based real-time dashboard for the Monday board meeting. What is the best first response?
- [ ] Build the streaming pipeline as asked, because the company will need streaming anyway once it starts to grow
- [x] Ask what decision the number drives and how often, then offer a reliable daily batch with ready-made tools
- [ ] Refuse, and keep emailing the spreadsheet until the company has hired a full data team of its own
- [ ] Start with a small Kafka cluster and a Spark job so the team can learn streaming along the way

> This is a stage-1 company: a weekly decision needs trustworthy daily numbers, not sub-second freshness. Building a stage-3 platform first costs months of the team's time before any useful number appears.

### Which of these is one of the six undercurrents rather than one of the five lifecycle stages?
- [ ] Ingestion: copying data from the source systems into your platform
- [ ] Serving: handing the results to dashboards, analysts and models
- [x] Orchestration: running every step in the right order, with retries
- [ ] Transformation: turning raw records into trustworthy tables for analysis

> The stages are generation, storage, ingestion, transformation and serving. Security, data management, DataOps, data architecture, orchestration and software engineering run underneath all of them.

## @resources
- [Python csv module documentation](https://docs.python.org/3/library/csv.html)
- [Python datetime: strptime format codes](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes)
