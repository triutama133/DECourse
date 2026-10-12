---
title: Capstone: A Real Data Pipeline on NYC Taxi Trips
duration: 3 weeks
summary: Build a complete batch pipeline on real public data, entirely by yourself: profile 2.96 million taxi trips, clean them with explicit rules, keep what you reject, model a star schema, publish two marts, and make the pipeline safe to rerun and to refuse a broken delivery. The lesson only gives the contract; a checker verifies each step against answers it computes independently.
why: Labs teach one skill on tidy data. A job gives you a messy file, a vague request and no tests. This capstone removes the training wheels: the data has real defects, the rules are yours to implement, and the only feedback is whether the numbers are right.
---

## @outcomes
- Profile an unfamiliar dataset and turn what you find into explicit, countable cleaning rules
- Separate clean data from rejected data without losing a single row, and reconcile the counts
- Model a star schema with a declared grain, dimension tables and a fact table that matches the source totals
- Publish marts whose definitions you can defend, avoiding traps such as grouping by a name that is not unique
- Make a pipeline idempotent, atomic and protected by quality gates, so that duplicates and broken deliveries cannot damage good data

## @prereq
Modules 0.2 (terminal, virtual environment), 1.2 (idempotency, retries), 1.4 (dimensional modeling), 1.5 (pandas habits) and 2.1 (Parquet and DuckDB) are the tools you will use; 2.5 (data quality gates) is the mindset. You need Python 3.10 or newer, about 1.5 GB of free disk space and a stable connection once, to download 50 MB.

## @lesson How this capstone works
Every lab so far told you which functions to write and ran tests against them. A capstone is different on purpose. **You get a contract, real data and a checker.** You decide how to build it: DuckDB or pandas, one script or many, SQL or Python. Nobody reviews your code. The checker looks only at **results**: the files your pipeline writes, the numbers inside them, and how the pipeline behaves when something goes wrong.

The rules of the game:

1. **You do it yourself.** Not with a copied solution, not by pasting the task into an AI and running the answer. The purpose is that you can do this alone in a job. If you use an AI or a search engine to understand a concept, fine; if it writes the pipeline, you will pass the checker and fail the next real task. The proof code at the end (like in every lab) only means something if it is honest.
2. **Work in your own folder** (for example `~/taxi`), inside your virtual environment (Module 0.2). Your workspace holds two files you write: `pipeline.py` and `profile.json`. The checker never edits them.
3. **Check after every step**, not at the end: `python3 labs/mod-4-1/check.py ~/taxi --step 2`. A FAIL line says what is wrong, sometimes with a short hint about where to look.
4. **Hints are levels, and you choose when.** `--hint 1` nudges, `--hint 2` explains the idea, `--hint 3` is almost the answer. Try for at least 30 minutes before you ask for level 1, and for level 3 only after you have already read the data yourself. Struggling is the point.
5. **The checker also attacks your pipeline.** In step 5 it runs your code on deliveries it makes itself: the same file twice, a file with a renamed column, a file in which 40% of the rows are broken. Real pipelines meet such things on a normal Tuesday.

Setup, once:

```bash
python3 -m venv ~/taxi/venv && source ~/taxi/venv/bin/activate
pip install -r labs/mod-4-1/requirements.txt          # duckdb and pyarrow
python3 labs/mod-4-1/fetch_data.py                    # 50 MB, verified by hash, into labs/mod-4-1/data/
cp labs/mod-4-1/starter/pipeline.py ~/taxi/pipeline.py
```

Expect roughly 15 to 25 hours in total. Each full run of your pipeline writes about 300 MB, and the checker runs it several times in a temporary folder that it deletes at the end.

## @lesson Meet the data
The **NYC Taxi and Limousine Commission (TLC)** publishes every yellow taxi trip as a monthly Parquet file (public data of the City of New York). We use **January 2024**: one file of about 50 MB with almost three million trips and 19 columns. The checker verifies the SHA-256 hash of your download, so everybody works on identical bytes.

| Column | Meaning |
|---|---|
| `VendorID` | the company that supplied the record (1, 2 or 6) |
| `tpep_pickup_datetime`, `tpep_dropoff_datetime` | start and end of the trip |
| `passenger_count` | passengers, entered by the driver |
| `trip_distance` | miles on the meter |
| `RatecodeID` | 1 Standard, 2 JFK, 3 Newark, 4 Nassau/Westchester, 5 Negotiated, 6 Group ride, 99 unknown |
| `store_and_fwd_flag` | whether the record was held in the vehicle before sending |
| `PULocationID`, `DOLocationID` | pickup and dropoff **zone id** (1 to 265) |
| `payment_type` | 0 Flex Fare, 1 Credit card, 2 Cash, 3 No charge, 4 Dispute, 5 Unknown, 6 Voided |
| `fare_amount`, `extra`, `mta_tax`, `tip_amount`, `tolls_amount`, `improvement_surcharge`, `congestion_surcharge`, `Airport_fee` | the parts of the bill |
| `total_amount` | what the passenger paid in total (tips on cash are not recorded) |

A second file, `taxi_zone_lookup.csv`, describes the **265 zones**: `LocationID`, `Borough`, `Zone`, `service_zone`.

**What we found when we profiled it** (we give no counts here on purpose: step 1 asks you to find them, and you will find the same things):

- The "January" file holds trips whose pickup time is as early as **2002-12-31** and as late as **2024-02-01**: some trips are outside January.
- Some trips end before they start, and some end at the very same second. A few last longer than 24 hours.
- Many trips have a total of zero or less (refunds and disputes); the most extreme is -900.00, the largest total is 5,000.00. A few trips claim more than 100 miles, and the longest says 312,722.3 miles.
- A block of rows (a few percent of the file) has NULL in `passenger_count`, `RatecodeID`, `store_and_fwd_flag`, `congestion_surcharge` and `Airport_fee` at once, and these are the very rows with `payment_type` 0: *Flex Fare* trips, a newer kind of record that does not fill the old fields. Other trips say 0 passengers.
- The busiest pickup zone is a major airport; not every one of the 265 zones appears as a pickup.
- **Cash trips** almost never have a tip, while most credit-card trips do. Cash tips are simply not recorded, so any tip statistic that includes cash is nonsense.
- The zone table has traps too: ids 264 and 265 are "Unknown" and "Outside of NYC", and ids **56 and 57 are both named "Corona"**. A zone *name* is not a key.

No duplicates exist in the real file, but a partner can send the same file twice, which is why your pipeline must handle it.

**Questions to ask any new dataset**, which you can reuse at work: What is one row (the grain)? What is the time range, and are there values outside it? Which columns can be NULL, and is NULL one reason or several? Which values are impossible (negative, zero, in the future)? Is there an identifier, and is it unique? Which codes need a dictionary? Which columns look similar but are not (the same name for two different things)? What is *missing on purpose* (cash tips)? Write the answers down before you write code.

## @lesson Your toolbox: DuckDB and a few lines of Python
The checker does not care which tools you use. We suggest **DuckDB**, because it reads Parquet and CSV directly, handles millions of rows in seconds on a laptop (the whole reference pipeline runs in about 4 seconds), and writes the Parquet and `.duckdb` files the contract asks for. Everything below is a generic reminder, tested on this very file, not a solution. Module 2.1 covers DuckDB in depth.

```python
import duckdb
con = duckdb.connect()                                   # in memory; duckdb.connect("file.duckdb") makes a database FILE
con.sql("DESCRIBE SELECT * FROM 'yellow_tripdata_2024-01.parquet'")    # columns and types
con.sql("SELECT count(*) AS trips, count(*) FILTER (WHERE tip_amount > 0) AS tipped FROM 'yellow_tripdata_2024-01.parquet'").fetchall()
# [(2964624, 2254230)]: FILTER counts only the rows that match, inside one query
```

Patterns you will need, each in one line:

- **Label rows by the first matching rule:** `CASE WHEN fare_amount < 0 THEN 'negative' WHEN fare_amount = 0 THEN 'zero' ELSE 'ok' END`. On this file that gives 2,926,283 ok, 37,448 negative and 893 zero. A `CASE` stops at the first `WHEN` that is true.
- **Remove identical rows:** `SELECT DISTINCT * FROM ...`.
- **Write a result as Parquet:** `COPY (SELECT ...) TO 'out/clean/trips.parquet' (FORMAT parquet)`. The folder must exist.
- **Create a table from a query, inside a database file:** `con = duckdb.connect("OUT/warehouse.duckdb")` then `con.execute("CREATE TABLE t AS SELECT ...")`. Close the connection (`con.close()`) before another process reads the file.
- **A stable id from values:** `hash(col1, col2, ...)` returns the same 64-bit number for the same values on every run.
- **Durations and calendars:** `date_diff('second', start, end) / 60.0` for minutes, `isodow(date)` for the day of the week (Saturday is 6), and `unnest(generate_series(DATE '2024-01-30', DATE '2024-02-02', INTERVAL 1 DAY))` for one row per day.
- **Read a CSV with its header:** `read_csv('taxi_zone_lookup.csv', header = true)`.

Python needs very little: `argparse` for the three arguments, `sys.exit(2)` to refuse a delivery, `print(json.dumps(...), file=sys.stderr)` for the reason, and `pathlib`/`shutil` (`mkdir`, `rename`, `rmtree`) for the temporary-folder swap of the previous lesson.

**A debugging routine that works for any pipeline.**

1. Run your pipeline and open the output with DuckDB. Look at ten rows before you look at totals.
2. Compare each count with the number in this lesson (about 1.2% rejected, 2,927,800 clean rows). If a count is off, the difference tells you where to look: a small difference is a rule, a factor of two is a join or a duplicate.
3. Test one rule at a time on the raw file with a plain `SELECT count(*) ... WHERE ...`, then compare with the reason counts in your rejected file.
4. When a checker line fails, read it literally. "expected 2,927,800, you have 2,927,801" means one row too many, so find that row: select the rows of your clean file that break a rule.
5. Change one thing at a time and rerun. A pipeline of this size runs in seconds, so there is no reason to guess.

## @lesson The contract
This lesson is the specification. Read it fully before step 2; the checker follows it to the letter.

**Command line.** `python pipeline.py --trips TRIPS.parquet --zones ZONES.csv --out OUT`. It reads a delivery with the 19 raw columns and writes everything below into the folder `OUT`.

**Exit codes.** `0`: the delivery was processed. `2`: a **quality gate** refused the delivery; in that case **nothing in OUT may change** (not one byte). Anything else means the pipeline crashed.

**Cleaning rules.** First remove duplicates: rows identical in **all 19 columns** are one trip, keep one. Then give each remaining row the **first** rule it breaks, in this order:

| Order | `reject_reason` | The row is rejected when |
|---|---|---|
| 1 | `pickup_outside_month` | pickup is before 2024-01-01 or on/after 2024-02-01 |
| 2 | `dropoff_not_after_pickup` | dropoff is at or before pickup |
| 3 | `trip_too_long` | the trip lasts more than 24 hours |
| 4 | `non_positive_total` | `total_amount` is 0 or less |
| 5 | `implausible_distance` | `trip_distance` is above 100 miles |

On the real file this rejects about 1.2% of the rows, and the checker compares your count per reason with its own. If you count each rule independently, the counts add up to more than the number of rejected rows, because **a few rows break more than one rule**; the first one wins, so each rejected row is counted once. Rows that pass all five rules are **clean**. A NULL `passenger_count` does *not* reject a row, and it stays NULL (do not invent 0 or 1).

**Output files.**

- `OUT/clean/trips.parquet`: **2,927,800** rows with exactly these 16 columns: `trip_id` (unique, never empty, the same row always gets the same id; a 64-bit hash of the 19 original values works), `vendor_id` integer, `pickup_at` and `dropoff_at` timestamps, `passenger_count` integer (NULL allowed), `trip_distance_miles` double, `rate_code` text (names from the table above, anything else "Unknown"), `pickup_zone_id` and `dropoff_zone_id` integers, `payment_method` text (names above, anything else "Unknown"), `fare_amount`, `tip_amount`, `tolls_amount` and `total_amount` doubles, `trip_minutes` double (the duration in minutes), `pickup_date` date.
- `OUT/rejected/trips_rejected.parquet`: the rejected rows with the **19 original columns plus `reject_reason`**.
- `OUT/quality_report.json`: `{"status": "passed", "rows_in", "duplicates_removed", "rows_rejected", "rows_clean", "reject_rate", "rejected_by_reason": {reason: count}}`. It must reconcile: `rows_in - duplicates_removed = rows_clean + rows_rejected`. The `reject_rate` is rejected rows divided by rows after de-duplication.
- `OUT/warehouse.duckdb`: a DuckDB database file with the tables below.

**The star schema** (grain of `fact_trip`: **one row per clean trip**):

- `dim_zone(zone_id, borough, zone, service_zone)`: the zone CSV, one row per zone id.
- `dim_date(date_key, date, day_of_week, is_weekend)`: one row per calendar day from the first to the last pickup date of the clean data; `date_key` is the date written as an integer like 20240115; `day_of_week` is the English day name; `is_weekend` is true on Saturday and Sunday.
- `dim_payment(payment_key, payment_method)`: seven rows, one per payment method name, each with its own key.
- `fact_trip(trip_id, pickup_date_key, pickup_zone_id, dropoff_zone_id, payment_key, passenger_count, trip_distance_miles, trip_minutes, fare_amount, tip_amount, total_amount)`.

**The marts** (tables in the same DuckDB file):

- `mart_daily(pickup_date, trips, revenue, avg_tip_pct)`: one row per pickup date. `revenue` is the sum of `total_amount`. `avg_tip_pct` is `100 * SUM(tip_amount) / SUM(fare_amount)` over the **credit-card** trips only, rounded to 2 decimals (cash tips are not recorded, see above).
- `mart_top_routes(pickup_zone_id, dropoff_zone_id, pickup_zone, dropoff_zone, trips, avg_minutes)`: the 10 routes with the most trips, where a route is the pair of **zone ids**; ties are broken by `pickup_zone_id`, then `dropoff_zone_id`; `avg_minutes` is the average `trip_minutes` rounded to 1 decimal; the zone names come from `dim_zone`.

**Quality gates** (the pipeline refuses the delivery and exits with 2 if any is true): one of the 19 required columns is missing; the delivery has zero rows; the reject rate is **above 5%**. On refusal, print one JSON line on stderr that says why (for example `{"status": "failed", "failure": "missing_columns"}`).

## @lesson Designing it so that it survives
The checker's step 5 is where most real pipelines fail, so design for it from the beginning instead of patching it on.

**Idempotent.** Running the same delivery twice must give the same result as running it once. The simplest way is to **rebuild the whole output from the input every time** (instead of appending to what is there): the output is a pure function of the delivery. This is Module 1.2 applied to files. Rows that appear twice inside one delivery are handled by the de-duplication rule; with a stable `trip_id` they also cannot enter the fact table twice.

**Atomic.** If the pipeline crashes halfway through writing, a reader must never see half of the new data and half of the old. Write the new output into a **temporary folder next to `OUT`**, and only when everything has succeeded swap it into place (rename the old folder away, rename the new one in, delete the old). A rename inside one file system is far safer than writing many files in place. After the swap leave no temporary folders behind: the checker looks.

**Gates before writes.** A refused delivery must change nothing. The cheapest way to guarantee that is to **compute everything you need for the decision first** (the column list, the row count, the reject rate), decide, and only then start writing. Combined with the temporary folder, a failed run cannot damage a good output; the checker compares a hash of the whole output folder before and after a refused delivery.

**Reject, do not fix silently.** The rejected file keeps the original columns and the reason, so a person (or a later, better rule) can look at the rows again. Quarantine plus counts is how you explain a revenue difference months later. If 40% of a delivery is rejected, the problem is almost certainly upstream: a gate that stops the load and raises an alert is worth more than a pipeline that quietly loads the other 60%.

**Reconcile.** After every step compare numbers with the layer before: `rows_in - duplicates = clean + rejected`, the fact table has as many rows as the clean file, the revenue in the marts sums to the revenue in the clean data. A join that repeats rows (the fan-out of Module 0.3) would make the fact table too big and inflate revenue, and it is exactly the kind of error that no exception reports.

**Work in small, visible steps.** Open `warehouse.duckdb` and the Parquet files in the DuckDB command line or a notebook and look at them after every step. Print counts. Compare with the numbers in this lesson. The profile you write in step 1 is not busywork: it is the table of numbers you will keep comparing your pipeline against.

## @lab Lab: five steps to a pipeline you can trust
Build `pipeline.py` and `profile.json` in your own workspace, one step at a time, with the checker after each step. The checker runs your pipeline on the real January file and on broken deliveries, and compares the results with answers it computes independently from the raw data.

### @steps
1. **Setup.** Follow the setup in the first lesson (virtual environment, `pip install -r labs/mod-4-1/requirements.txt`, `python3 labs/mod-4-1/fetch_data.py`, copy `starter/pipeline.py` to your workspace). Open the data with DuckDB and look at it: `DESCRIBE`, `count(*)`, a few rows, the min and max of the dates.
2. **Checker step 1: profile.** Create `profile.json` in your workspace with nine numbers computed from the **raw** file, counted independently of each other: `rows_total`, `pickup_outside_month` (pickup before 2024-01-01 or from 2024-02-01 on), `dropoff_not_after_pickup` (dropoff at or before pickup), `null_passenger_count`, `non_positive_total` (`total_amount` of 0 or less), `distance_over_100` (`trip_distance` above 100), `distinct_pickup_zones`, `busiest_pickup_zone_id` (the zone id with the most pickups), and `cash_trips_with_tip` (`payment_type` 2 with `tip_amount` above 0). Check: `python3 labs/mod-4-1/check.py ~/taxi --step 1`.
3. **Checker step 2: clean and reject.** In `pipeline.py` implement de-duplication, the five rules in order, the clean file, the rejected file and `quality_report.json` exactly as in the contract. Run it yourself first and compare with the numbers in the lesson. Check: `--step 2`. Before you run the checker, predict whether your count for `non_positive_total` will equal your step 1 number, and why not.
4. **Checker step 3: star schema.** Add `warehouse.duckdb` with the three dimensions and `fact_trip`. Reconcile the fact table with the clean file before you ask the checker. Check: `--step 3`.
5. **Checker step 4: marts.** Add `mart_daily` and `mart_top_routes`. Defend each definition to yourself (why only credit cards for tips? why ids and not names?). The checker also runs your pipeline on a small delivery built to expose a naming trap. Check: `--step 4`.
6. **Checker step 5: survive.** Make the pipeline idempotent, atomic and gated, as in the last lesson. The checker runs it five more times: twice on the same file, on a delivery in which every row appears twice, on a delivery with a renamed column, and on a delivery in which 40% of the rows are broken (the last two must exit with code 2 and leave your output folder byte-for-byte unchanged). Check: `--step 5` (under a minute with a fast pipeline).
7. **Stuck?** Re-read the matching lesson section, query the data, and only then ask for a hint: `python3 labs/mod-4-1/check.py ~/taxi --step 3 --hint 1` (then 2, then 3).
8. **Finish.** When `--step all` passes, run `python3 scripts/prove.py mod-4-1 ~/taxi` to get the proof code for the **Proof** box on this lab page. Then write down, in a file `NOTES.md` in your workspace, three sentences about what surprised you in the data and one thing you would monitor if this ran every night.

### @files
- labs/mod-4-1/starter/pipeline.py :: Your working file: copy it to your workspace and build the pipeline there :: starter
- labs/mod-4-1/check.py :: The checker: five steps, hints, proof :: test
- labs/mod-4-1/fetch_data.py :: Downloads the two input files and verifies their hash :: config
- labs/mod-4-1/requirements.txt :: duckdb, pyarrow :: config

### @deliverables
- `python3 labs/mod-4-1/check.py ~/taxi --step all` passes **on your own computer, in your own virtual environment**
- You can explain, in your own words, why a few rows break more than one rule and what "the first rule wins" means for the counts
- You can explain why the pipeline builds in a temporary folder and why the gate runs before anything is written
- You can say which two traps are in the data (cash tips, zone names) and how your pipeline avoids them
- Your `NOTES.md` states what surprised you and what you would monitor nightly

### @verify
```bash
python3 labs/mod-4-1/check.py ~/taxi --step all
python3 scripts/prove.py mod-4-1 ~/taxi
```

## @chaos The month that arrived twice
### @scenario
A taxi analytics team loads each monthly TLC file with a script that cleans the rows and **appends** them to a warehouse table. A revenue dashboard sums that table. One morning the finance lead asks why January revenue has doubled compared with the figure published last week.

The cause is dull: the partner's export job failed on its first attempt, was restarted, and delivered the January file a second time into the landing folder. The loader found a new file, so it processed it. almost three million duplicate trips were appended. Nothing failed, no test was red, and the dashboard drew a beautiful column twice as high as it should be. A second incident follows the first: while the team deleted the extra rows by hand, a bad delivery arrived in which a column had been renamed. The script crashed after it had already deleted the previous month from the table.

### @cause
The pipeline was not **idempotent**: processing the same data twice changed the result, because it appended instead of rebuilding or merging by a stable key. It had no **de-duplication rule** and no stable identifier for a trip. It also wrote **before it checked**: the schema problem was discovered halfway through, after the old data had already been modified, and there was no atomic swap, so a crash left the table in a state that matched neither the old nor the new delivery.

What made the damage large was the missing **reconciliation**: nobody compared the row count with the previous month or with the source, and no alert watched for a sudden doubling of volume. Every layer believed the one before it.

### @fix
1. **Rebuild instead of append**, or load with a merge by a stable `trip_id`: the same delivery twice must leave the same result. The rule "rows identical in all columns are one trip" removes duplicates inside a delivery.
2. **Keep a manifest of processed deliveries** (file name plus checksum) so that a delivery that was already loaded is recognised and skipped or reported.
3. **Gate before write** and write atomically: check columns, row count and reject rate first; build in a temporary folder; swap at the end. A refused delivery changes nothing.
4. **Reconcile and alert**: row counts per day against a recent average, revenue against the source system, `rows_in - duplicates = clean + rejected` in every run's report.
5. **Quarantine instead of deleting**: rejected rows with their reason, so an incident can be explained and repaired later.
6. **Practice the repair**: rerun the previous good month from the raw file. With an idempotent pipeline this is one command, and that is the real test of the design.

### @pattern
A pipeline is a pure function from a delivery to an output folder: same input, same output, and a bad input changes nothing. Check before you write, write somewhere safe, swap at the end, and count everything.

## @quiz
### The same January file is delivered twice. Which design gives the same warehouse as one delivery?
- [ ] Append every delivery to the existing tables, because each delivery is a separate event of its own
- [ ] Skip the cleaning rules for the second file, because the first copy was already cleaned earlier
- [x] Rebuild the output from each delivery and drop identical rows, so a repeated run changes nothing
- [ ] Delete the older rows by hand whenever the dashboard shows a total that looks suspiciously large

> Idempotence means the output is a function of the input, not of how many times the pipeline ran. Appending turns every retry into a duplicate.

### Counted independently, the five rules flag more rows in total than the pipeline rejects. What explains the difference?
- [ ] The pipeline loses some rows through a bug that is hidden in the Parquet writer used for the output
- [ ] The independent counts include the duplicate rows, which the pipeline removes before applying the rules
- [x] A few rows break more than one rule, and with "first rule wins" each rejected row is counted only once
- [ ] The rules apply only to the first 2.9 million rows, so the last rows of the file are never checked

> The sum of independent counts double-counts rows that break several rules. Assigning one reason per row makes the counts add up to the number of rejected rows.

### Thousands of trips have a NULL `passenger_count`. What does the contract do with them, and why?
- [ ] Set the count to 1, since a taxi trip needs at least one passenger to exist at all
- [ ] Reject them, because a missing value always makes the whole row useless for any analysis
- [x] Keep the rows and the NULL, because an invented number would be a fact nobody measured
- [ ] Set the count to 0, because zero is the standard way to say that something is unknown in data

> These are Flex Fare records that do not fill the old fields. Their fares and zones are fine, so rejecting them would lose revenue, and inventing a passenger count would create false facts.

### Why does `mart_daily` compute the tip percentage over credit-card trips only?
- [ ] Credit-card trips are the only ones present in the file, because the other payment types are hidden
- [ ] Cash tips are larger than card tips, which would make the daily percentage look much too high
- [x] Cash tips are hardly ever recorded in the data, so including cash would drag the whole figure down
- [ ] The DuckDB engine cannot add the tips of different payment types together in one single query

> A metric must use data that measures what it claims to. Almost every credit-card trip shows a tip; almost no cash trip does, because the meter does not capture cash tips.

### Zones 56 and 57 are both named "Corona". How should `mart_top_routes` define a route?
- [ ] By the pickup and dropoff zone names, because names are easier to read than numbers are
- [ ] By the borough of the pickup, since every borough has only one busiest route per day
- [x] By the pair of zone ids, then take the names from the zone table only to display them
- [ ] By the first letter of the zone name, so that similar places are grouped into one route

> A name is a label, not a key. Grouping by name merges different ids into one route and gives a different top 10 (the checker builds a delivery that proves it).

### A delivery arrives in which 40% of the rows break a cleaning rule. What should the pipeline do?
- [ ] Load the 60% that is valid and send the rest to quarantine without telling anyone about it
- [ ] Raise the allowed reject rate until the delivery passes, so the pipeline continues as usual
- [x] Refuse the whole delivery with a clear reason and exit code 2, keeping the earlier output
- [ ] Repair the broken rows automatically by guessing the most likely value for each of them

> A reject rate that high means something is wrong upstream (a unit change, a broken export). Stopping and alerting protects every downstream number; silently loading part of the data hides the problem.

### Why does the pipeline write into a temporary folder and rename it into place at the end?
- [ ] Renaming a folder compresses its contents, which makes the output smaller than writing it directly
- [ ] The operating system does not allow a program to write directly into a folder that already has files
- [x] A crash or a failed gate then leaves the old output complete and valid, never a half-written mix
- [ ] The checker can only read folders whose names end with a number, such as a process identifier

> Readers see either the previous complete output or the new complete output. The same idea protects checkpoint files in Module 1.6.

### The clean file has 2,927,800 rows, but `fact_trip` has more rows and a higher revenue. What is the most likely cause?
- [ ] DuckDB rounds every amount up when it writes a table, which adds a few cents to each of the trips
- [x] A join to a dimension with duplicate keys repeated some trips, so rows and revenue grew together
- [ ] The marts were built first, and their totals were added to the fact table afterwards by mistake
- [ ] The dim_date table has 31 rows, which makes a month of January look larger than it really is

> A duplicate key on the dimension side repeats the fact rows (the fan-out from Module 0.3). Reconciling both the row count and the sum with the clean file catches it.

## @resources
- [NYC TLC trip record data (the source, with monthly files)](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page)
- [TLC data dictionary for Yellow Taxi trip records (PDF)](https://www.nyc.gov/assets/tlc/downloads/pdf/data_dictionary_trip_records_yellow.pdf)
- [DuckDB: Parquet files](https://duckdb.org/docs/stable/data/parquet/overview)
- [DuckDB: friendly SQL](https://duckdb.org/docs/stable/sql/dialect/friendly_sql)
- [Python: sys.exit and exit codes](https://docs.python.org/3/library/sys.html#sys.exit)
