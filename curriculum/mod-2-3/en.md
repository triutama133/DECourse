---
title: Transformation with dbt: SQL Models, Tests and Incremental Loads
duration: 3 weeks
summary: Build a tested, documented transformation layer with dbt: staging and mart models, data tests, an incremental model that survives late-changing data, and snapshots for history, then run it twice and prove the second run is correct.
why: Tutorials show a few models with no tests. In production, raw data changes after it was loaded, an incremental model quietly stops being correct, and nobody notices until a number is wrong in front of the board.
---

## @outcomes
- Explain what dbt does (and does not do) in an ELT stack, and structure a project into sources, staging and marts
- Write models with `ref()` and `source()`, choose materializations, and read dbt's build output
- Add generic and singular tests with the right severity, and use documentation and freshness checks
- Write an incremental model that handles updated and late-arriving rows, and explain why "only new dates" is wrong
- Build a Type 2 history table with a snapshot, and run slim CI so a pull request builds only what it changed

## @prereq
Modules 1.3 and 1.4 (window functions, dimensional modeling) and 2.1 (DuckDB). `pip install -r labs/mod-2-3/requirements.txt` installs dbt Core and the DuckDB adapter; no warehouse account is needed.

## @lesson ELT and where dbt fits
Module 0.1 introduced **ELT**: load raw data into the warehouse first, then transform it *inside* the warehouse with SQL. That is a good idea for the reasons given there (the warehouse is powerful and cheap, and raw data is preserved), but it leaves a practical problem. A transformation layer written as a pile of SQL scripts is fragile: nobody knows which script depends on which, what order to run them in, whether the output is correct, or what any table means.

**dbt** (data build tool) applies software-engineering practice to that SQL layer. You write each transformation as a **model**: one `SELECT` statement in one file. dbt then:

- works out the **dependency graph** (DAG) from references between models, and runs them in the right order;
- **materializes** each model as a view or table (or an incremental table) by wrapping your `SELECT` in `CREATE ... AS`;
- runs **tests** on the results, and generates **documentation** and lineage;
- supports **environments**, so the same code builds in a developer's schema, in CI and in production;
- keeps everything in **Git**: reviewed, versioned, reproducible.

What dbt does *not* do: extract or load data (a different tool brings raw data in; Module 2.4 orchestrates both) and it does not store or compute anything itself. It generates SQL and sends it to your warehouse (Snowflake, BigQuery, Postgres, DuckDB and more, through **adapters**). **dbt Core** is the open-source command-line tool used in this course; dbt Cloud adds a hosted service around it.

A model in full:

```sql
-- models/marts/dim_customers.sql
select
    customer_id,
    full_name,
    coalesce(city, 'Unknown') as city,
    tier
from {{ ref('stg_customers') }}
```

The `{{ ... }}` is **Jinja**, a templating language dbt evaluates before running the SQL. `ref('stg_customers')` does two things: it resolves to the correct table name for the current environment (`dev_alice.stg_customers` or `analytics.stg_customers`), and it records a dependency, so dbt builds `stg_customers` first.

## @lesson Project anatomy and the dbt commands
A project is a folder:

```text
kopiku_dbt/
  dbt_project.yml        project name, folder layout, default configs per folder
  profiles.yml           how to connect (kept outside Git in real projects; the lab reads the path from an env var)
  models/
    sources.yml          declares the raw tables dbt reads but does not build
    staging/             stg_*.sql  (+ schema.yml with tests)
    marts/               dim_*.sql, fct_*.sql
  snapshots/             history tables (SCD Type 2)
  tests/                 singular tests: SQL files that return failing rows
  macros/                reusable Jinja functions
```

Two functions connect SQL to the graph:

- **`source('raw', 'orders')`** refers to a table dbt does not own (loaded by someone else). Declaring sources in `sources.yml` documents them, names them in one place, and lets dbt check their **freshness**.
- **`ref('model')`** refers to another model, as above.

The commands you will use:

| Command | What it does |
|---|---|
| `dbt run` | Build the models (create views/tables) |
| `dbt test` | Run all tests |
| `dbt build` | Run models, tests, snapshots and seeds **in dependency order**, skipping children of failures |
| `dbt compile` | Render the Jinja to plain SQL without running it (`target/compiled/`) |
| `dbt ls --select ...` | List what a selection matches |
| `dbt docs generate` | Build the documentation site and lineage graph |

Select parts of the graph with `--select`: `stg_orders` (one model), `stg_orders+` (it and everything downstream), `+fct_daily_revenue` (it and everything upstream), `tag:daily`, `state:modified+` (what changed since a saved state; see CI below). The output of the lab's first build on the KopiKu data:

```text
Done. PASS=21 WARN=1 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=22
```

Twenty-two items: seven models (four views, three tables, one of them incremental), one snapshot and fourteen tests. If a model fails, `dbt build` marks the models and tests downstream of it as `SKIP`, so bad data never flows on to the marts silently.

## @lesson Layers and materializations
A convention that has proved itself in thousands of projects is three layers:

1. **Staging** (`stg_`): one model per source table, a thin cleaning layer. Rename columns, cast types, parse formats, remove exact duplicates, pick the latest version of each key. No joins, no business logic. Materialized as **views** (cheap, always fresh).
2. **Intermediate** (`int_`, optional): reusable building blocks that join or reshape staging models.
3. **Marts** (`dim_`, `fct_`): business entities ready for analysts, shaped as the dimensional models of Module 1.4. Materialized as **tables** (or incremental tables), because people query them directly.

(People map these loosely to the *medallion* names: raw is bronze, staging and intermediate are silver, marts are gold. The names matter less than keeping the layers separate and the dependencies one-directional.)

A **materialization** decides how a model is stored:

| Materialization | Stored as | Build cost | Query cost | Use for |
|---|---|---|---|---|
| `view` | A saved query | None | Re-runs the query each time | Staging, light logic |
| `table` | A full table, rebuilt each run | Whole table each run | Fast | Marts of modest size |
| `incremental` | A table updated with only new/changed rows | Only the new data | Fast | Large, append-heavy facts |
| `ephemeral` | Inlined as a CTE, never created | None | Part of the downstream query | Tiny helper logic |

Set defaults per folder in `dbt_project.yml` (`staging: +materialized: view`) and override per model with `{{ config(materialized='incremental') }}`.

**A real staging model** from the lab. The raw `orders` table is append-only: an update to an order arrives as a *new row* with a later `_loaded_at`. Staging must keep the latest version of each order and clean the mess from Module 0.1, here in DuckDB's SQL dialect:

```sql
with ranked as (
    select
        order_id::bigint as order_id,
        coalesce(try_strptime(order_ts, '%Y-%m-%dT%H:%M:%S'),
                 try_strptime(order_ts, '%d/%m/%Y %H:%M')) as order_ts,
        lower(trim(status)) as status,
        try_cast(replace(regexp_replace(total_idr, '^\s*[Rr][Pp]\s*', ''), '.', '') as bigint) as total_idr,
        _loaded_at,
        row_number() over (partition by order_id order by _loaded_at desc) as rn   -- latest version wins (Module 1.3)
    from {{ source('raw', 'orders') }}
)
select order_id, order_ts, cast(order_ts as date) as order_date, status, total_idr, _loaded_at
from ranked
where rn = 1 and order_ts is not null and total_idr > 0
```

`try_strptime` and `try_cast` return NULL instead of failing on bad input, which lets you filter or quarantine explicitly. (Dialects differ: Snowflake and BigQuery have `try_to_timestamp`, `safe_cast`. A **macro**, below, can hide such differences.)

## @lesson Tests and documentation: trust, written down
dbt's tests turn "the data should satisfy X" into code that runs on every build. Two kinds:

**Generic tests**, declared in YAML next to the model, are parameterised checks that ship with dbt:

```yaml
models:
  - name: stg_orders
    columns:
      - name: order_id
        data_tests: [unique, not_null]
      - name: status
        data_tests:
          - accepted_values:
              arguments:
                values: [paid, shipped, delivered, cancelled, refunded]
  - name: fct_order_items
    columns:
      - name: customer_id
        data_tests:
          - relationships:
              arguments: { to: ref('dim_customers'), field: customer_id }
              config: { severity: warn }
```

`unique` and `not_null` check keys; `accepted_values` checks a closed set; `relationships` checks referential integrity (every fact's customer exists in the dimension). Under the hood each is a SQL query that **returns the rows that violate the rule**; the test passes when it returns none.

**Singular tests** are your own SQL files in `tests/`, again returning bad rows:

```sql
-- tests/assert_line_total_matches_qty_times_price.sql
select order_id, line_no
from {{ ref('fct_order_items') }}
where line_total_idr <> qty * unit_price_idr
```

**Severity** is a design decision: `error` (default) fails the build and, with `dbt build`, skips downstream models; `warn` reports and continues. Use `error` for things that make the data *wrong* (duplicate keys), and `warn` for things you want to **see without blocking** the business. In the lab, the `relationships` test raises `WARN 32`: 32 order lines belong to customers who are missing from the customer extract, the same orphans found in Module 1.4. Blocking the whole pipeline for them would be harmful; ignoring them silently would be worse. Options such as `store_failures: true` save the failing rows to a table so someone can investigate.

More checks worth knowing: **source freshness** (`freshness: {warn_after: {count: 12, period: hour}}` with a `loaded_at_field` raises an alert when a raw table has not been updated), **unit tests** (since dbt 1.8: give a model small mock inputs and assert the output, testing your logic, not your data), and **model contracts** (`contract: {enforced: true}` with declared column names and types: the build fails if a model's output stops matching, which protects consumers from accidental schema changes; Module 2.5 covers contracts in depth).

**Documentation** lives beside the code: `description:` fields in the YAML, and `dbt docs generate` produces a browsable site with a **lineage graph** showing which models feed which. A model without a description of its **grain** is unfinished.

## @lesson Incremental models: the part where correctness is easy to lose
A table model rebuilds everything on every run. When the fact table has billions of rows, that is slow and expensive. An **incremental model** processes only new or changed data and applies it to the existing table:

```sql
{{ config(materialized='incremental', unique_key='order_date', incremental_strategy='delete+insert') }}

select ...
from {{ ref('fct_order_items') }}
{% if is_incremental() %}
where <only the data that is new or changed since the last run>
{% endif %}
```

- `is_incremental()` is true when the target table exists and you are not running with `--full-refresh`.
- `{{ this }}` refers to the table being built, so you can ask it "what is the latest thing you already have?" (the **watermark**).
- `unique_key` plus an **incremental strategy** say how new rows are applied: `append` (just insert; correct only if rows can never repeat), `merge` (update matching keys, insert new ones), or `delete+insert` (delete the keys being rewritten, then insert; works well on engines without MERGE).

The classic mistake is choosing the wrong **watermark**. The tempting version is "only process dates after the latest date in the table", and it is wrong whenever existing data can change. In the lab, a second load arrives containing 50 new orders on a new day, **and** 20 refunds and cancellations for orders from 25 January that were already loaded. They arrive as new rows (later `_loaded_at`) in the append-only raw table. A naive model that only adds new dates keeps the old numbers for the 25th: 106 orders and Rp 39,370,000, when the true figures are **86 orders and Rp 32,585,000**, an overstatement of **20.8%** that never corrects itself because the model never looks at that day again.

The correct logic recomputes **every date that had any order loaded since the last run**:

```sql
with orders as (
    select order_date, _loaded_at from {{ ref('stg_orders') }}
),
lines as (
    select * from {{ ref('fct_order_items') }}
    {% if is_incremental() %}
    where order_date in (
        select distinct order_date from orders
        where _loaded_at > (select max(max_loaded_at) from {{ this }})
    )
    {% endif %}
)
select order_date, count(distinct ...) as orders, sum(...) as revenue_idr, max(loaded_at) as max_loaded_at
from lines group by order_date
```

Three details that the lab will teach you the hard way:

- **Use the ingestion time as the watermark** (`_loaded_at`, when the row *arrived*), not the business time (`order_date`). Business time says when something happened; ingestion time says what is new to you. Late and updated data has an old business date and a new ingestion time.
- **`ref()` must be outside the `is_incremental()` block.** dbt reads every `ref` when it builds the graph, before it knows whether the run is incremental. A `ref` hidden inside the condition fails with "dbt was unable to infer all dependencies"; declare it in a CTE above (or add a `-- depends_on: {{ ref('...') }}` hint).
- **Prove it.** The lab's tests compare the incrementally maintained table with a from-scratch calculation on the raw data after the second load. Any incremental model deserves exactly that test, because an incorrect incremental model looks perfectly healthy. `dbt run --full-refresh` rebuilds from scratch (use it after logic changes) and a periodic full refresh is a cheap safety net.

## @lesson Snapshots, macros and CI
**Snapshots** capture the history of a table that is overwritten in place, producing a **Type 2 slowly changing dimension** (Module 1.4) without hand-written SQL:

```sql
{% snapshot customers_snapshot %}
{{ config(target_schema='snapshots', unique_key='customer_id', strategy='check', check_cols=['city', 'tier']) }}
select customer_id, city, tier from {{ ref('stg_customers') }}
{% endsnapshot %}
```

Each run compares the current rows with the stored versions. With the `check` strategy, if `city` or `tier` differs, dbt closes the old row (`dbt_valid_to` set) and inserts a new one (`dbt_valid_from` set, `dbt_valid_to` NULL). (The `timestamp` strategy uses an `updated_at` column instead and is more efficient when one exists.) In the lab, after the second load in which 5 customers moved, the snapshot table holds **1,005 rows**: 1,000 current plus the 5 old versions. Two cautions: a snapshot only knows what it *saw* (changes between two runs are invisible, so run snapshots often), and it is hard to rebuild if lost, so treat the table as precious.

**Macros** are Jinja functions that generate SQL, for logic you repeat:

```sql
{% macro parse_rupiah(column) -%}
    try_cast(replace(regexp_replace({{ column }}, '^\s*[Rr][Pp]\s*', ''), '.', '') as bigint)
{%- endmacro %}

-- used as:   {{ parse_rupiah('total_idr') }} as total_idr
```

dbt **packages** (such as `dbt_utils` and `dbt_expectations`) bundle ready-made macros and tests; install them via `packages.yml` and `dbt deps`. Do not over-use Jinja: SQL that is readable beats clever templates.

**CI/CD.** Because dbt code is plain files in Git, a pull request can run a CI job: build the changed models into a temporary schema and run their tests, so a broken model never merges. Building the whole project on every pull request is slow and costly, so use **state comparison** (slim CI). Save the production run's `manifest.json`; on a pull request run `dbt build --select state:modified+ --defer --state path/to/prod-state`. `state:modified+` means "models whose code changed, and everything downstream of them"; `--defer` makes unchanged upstream models read from production instead of rebuilding. In the lab project, changing only `stg_order_items` selects that model and the models downstream of it (`fct_order_items` and `fct_daily_revenue`) together with their tests, while `dim_customers` and `stg_customers` are left out.

A healthy workflow: develop in a personal schema, open a pull request, let CI run slim `dbt build`, get a code review, merge, and let the orchestrator run production on a schedule (Module 2.4). Document the grain and the tests with the code, and treat a failing test as an incident, not noise.

## @lab Lab: a tested dbt project, run twice
You get a DuckDB database of raw KopiKu tables (append-only, dirty, with duplicates) and a dbt project with sources configured and every model stubbed. Fill in the staging layer, the marts, the incremental model, the tests and a snapshot. The tests run `dbt build`, then simulate a **second load** (new orders, orders that changed status, customers who moved) and run it again, comparing your incremental table with a full recalculation.

### @steps
1. Install and load the raw data:

```bash
python -m pip install -r labs/mod-2-3/requirements.txt
python3 labs/shared/shopgen.py --out data
export KOPIKU_DB=$PWD/kopiku.duckdb
python3 labs/mod-2-3/load_raw.py data $KOPIKU_DB
```

2. Explore the raw tables with DuckDB (`duckdb kopiku.duckdb` or Python). Find the problems: duplicate rows, two timestamp formats, `Rp` totals, mixed-case statuses. Check `select count(*), count(distinct order_id) from raw.orders`.
3. Work inside `labs/mod-2-3/kopiku_dbt/`. Each stub model has a comment that is its specification. Build **staging first** (`stg_customers`, `stg_products`, `stg_orders`, `stg_order_items`) and check as you go:

```bash
cd labs/mod-2-3/kopiku_dbt
dbt run --select staging --profiles-dir .
```

4. Build the marts: `dim_customers`, `fct_order_items` (grain: one row per order line), then `fct_daily_revenue` as an **incremental** model. Re-read the lesson on watermarks before you write its filter.
5. Add the tests in the two `schema.yml` files (the TODO comments list them), one singular test in `tests/`, and the snapshot in `snapshots/`. Run everything:

```bash
dbt build --profiles-dir .
```

   Expect passes and one warning for the orphan customers.
6. Simulate the later load and build again. Then compare `fct_daily_revenue` with a full rebuild (`dbt run --select fct_daily_revenue --full-refresh`): they must match.

```bash
python3 ../load_raw.py ../../../data $KOPIKU_DB --next
dbt build --profiles-dir .
```

7. Run the lab's tests, which do all of the above in a clean temporary copy:

```bash
pytest labs/mod-2-3 -v
```

8. Optional: save `target/manifest.json` to a folder, change one staging model, and run `dbt ls --select state:modified+ --state <folder> --profiles-dir .` to see slim CI's selection. Then break the incremental model on purpose (filter on `order_date` instead of `_loaded_at`), re-run the tests and watch exactly which test catches it.

### @files
- labs/mod-2-3/kopiku_dbt/dbt_project.yml :: Project configuration (provided) :: config
- labs/mod-2-3/kopiku_dbt/models/sources.yml :: Declares the raw tables (provided) :: config
- labs/mod-2-3/kopiku_dbt/models/staging/stg_orders.sql :: Staging stub: the most interesting cleaning (fill in) :: starter
- labs/mod-2-3/kopiku_dbt/models/staging/stg_customers.sql :: Staging stub (fill in) :: starter
- labs/mod-2-3/kopiku_dbt/models/marts/fct_order_items.sql :: Mart stub: one row per order line :: starter
- labs/mod-2-3/kopiku_dbt/models/marts/fct_daily_revenue.sql :: Incremental model stub (the hard part) :: starter
- labs/mod-2-3/kopiku_dbt/models/staging/schema.yml :: Add the staging tests here :: starter
- labs/mod-2-3/kopiku_dbt/models/marts/schema.yml :: Add the mart tests here :: starter
- labs/mod-2-3/load_raw.py :: Loads raw tables and simulates a later load (provided) :: data
- labs/mod-2-3/test_lab.py :: The tests: build, second load, build, compare :: test
- labs/mod-2-3/reference/kopiku_dbt/models/marts/fct_daily_revenue.sql :: Reference incremental model (try first!) :: reference
- labs/mod-2-3/reference/kopiku_dbt/models/staging/stg_orders.sql :: Reference staging model :: reference
- labs/mod-2-3/reference/kopiku_dbt/snapshots/customers_snapshot.sql :: Reference snapshot :: reference

### @deliverables
- All 13 tests pass, including the one that compares the incremental table with a full recalculation after the second load
- `dbt build` shows passing tests and exactly one warning (orphan customers)
- You can explain why the incremental filter uses `_loaded_at` and why `ref()` sits outside the `is_incremental()` block

### @verify
```bash
pytest labs/mod-2-3 -v        # about 30 seconds: it runs dbt twice
```

Known-good run: `LAB_DIR=reference pytest labs/mod-2-3 -v`.

## @chaos The revenue that was never corrected
### @scenario
KopiKu's daily revenue table is an incremental model: "each night, add the days that are newer than the latest day already in the table". The dashboard works, the tests pass, and nobody has touched the model in months.

Finance reconciles a month-end and finds that the dashboard's revenue for the 25th is 20.8% higher than the payment provider's: 106 orders and Rp 39.4 million, against 86 orders and Rp 32.6 million. Digging in, the team finds that on the 26th, 20 orders from the 25th were refunded or cancelled. Every refund ever issued has had the same effect: the day's number is frozen at what it was when the day first loaded.

### @cause
The watermark is business time (`order_date`). Late changes to existing orders have an old `order_date` and so fall outside "newer than the latest day", and the model never reprocesses that day. The raw table recorded the refunds correctly, as new rows with a later load time; the incremental logic simply never asked "what changed since the last run?".

The model passed every test because the tests checked structure (unique dates, no nulls), not that the table equals what a full recalculation would give.

### @fix
1. Change the watermark to **ingestion time** (`_loaded_at`), and recompute **every date touched by rows loaded since the last run**, using `delete+insert` on the date key so the result replaces the old row.
2. Repair history: `dbt run --select fct_daily_revenue --full-refresh` rebuilds all days from the corrected raw data; tell finance that the earlier figures were restated.
3. Add a **reconciliation test** that compares the incremental table with a full recalculation (or a sample of days) and run it on every build.
4. Schedule a periodic full refresh as a safety net, and alert on large day-over-day changes in a closed period.
5. Document the model's incremental logic and the assumption it makes about late-arriving data.

### @pattern
An incremental model is only correct if it handles rows that change after they first arrive. Choose the watermark by when data *arrived*, and prove correctness against a full rebuild.

## @quiz
### In a dbt project, what does `{{ ref('stg_orders') }}` do?
- [ ] It copies the model's data into the current file so that the query can run without needing any join
- [x] It resolves the table name for the current environment and records a dependency on that model
- [ ] It refreshes the model's source data from the original system every time the query is executed
- [ ] It marks the model as private so that no other model in the project is able to read it

> `ref()` makes dbt build the referenced model first and substitutes the right schema and table name per environment (developer, CI or production).

### Which statement about `dbt build` is correct?
- [ ] It only creates the models and leaves it to the user to run the tests separately afterwards
- [ ] It loads the raw data from the source systems into the warehouse before transforming it later on
- [x] It runs models, tests and snapshots in dependency order, skipping what depends on a failure
- [ ] It deletes and recreates the whole warehouse so that each run starts from a clean state again

> `build` combines run, test, snapshot and seed in DAG order. If a model or its test fails, the downstream nodes are skipped so bad data does not flow on.

### Why use `severity: warn` on the `relationships` test between orders and customers in the lab?
- [ ] Warnings are faster to run than errors, which keeps the build time of the project low
- [ ] The test would otherwise delete the orphan rows from the fact table to keep it consistent
- [x] The orphans should be visible and tracked, but they should not stop the whole pipeline
- [ ] A relationships test is not able to fail, so it can only ever produce warnings

> Severity is a design choice. Errors fail the build for data that is wrong; warnings make known, tolerable problems visible without blocking the business.

### An incremental model loads "dates newer than the latest date in the table". What is the flaw?
- [ ] It runs too slowly because it must scan the entire table to find the latest date each time
- [ ] It cannot work with the delete+insert strategy, which needs a primary key to be unique anywhere
- [x] Changes to rows with old dates arrive later and are never reprocessed, so the data goes stale
- [ ] It creates a new table on every run, which breaks the references from other models

> Business-time watermarks miss late and updated rows. Use ingestion time to detect what is new and recompute the affected business dates.

### Why does dbt report "unable to infer all dependencies" when a `ref()` is placed inside `{% if is_incremental() %}`?
- [ ] The `is_incremental()` function is only available in dbt Cloud, and not in the dbt Core command line
- [ ] Jinja does not allow SQL keywords to appear inside a conditional block of a model file at all
- [x] dbt reads every ref when it builds the graph, before it knows whether the run is incremental or not
- [ ] The referenced model is not materialized as a table, so it cannot be used inside an incremental model

> Refs are collected at parse time. Declare them outside the conditional (for example in a CTE) or add a depends_on comment.

### What does a dbt snapshot with `strategy='check'` do on each run?
- [ ] It deletes the table and rebuilds it so that only the latest version of each row remains
- [x] It compares chosen columns with the stored rows and adds a new version when they differ
- [ ] It checks that the source table has no duplicate rows and stops the run if it finds any
- [ ] It copies the whole source table into a new schema with a timestamp in the table name

> The check strategy closes the old version (sets `dbt_valid_to`) and inserts a new row (`dbt_valid_from`) whenever the monitored columns change, which gives a Type 2 dimension.

### What does `dbt build --select state:modified+ --defer --state prod-state` achieve in CI?
- [ ] It builds every model in the project, and then compares the result with the production tables afterwards
- [ ] It builds the models that were modified in production, to test them against the new data coming in
- [x] It builds only changed models and their downstream models, reading unchanged parents from production
- [ ] It skips all tests to make the pull request build finish as quickly as it can possibly manage

> `state:modified+` selects changed models plus everything downstream of them. `--defer` lets those models read unchanged upstream models from the production state, saving time and cost.

### The incremental model's tests all pass, yet the numbers are wrong. What is the most valuable test to add?
- [ ] A not_null test on every column of the table, so that missing values are found early on in the build
- [ ] A test that the table has more rows today than it had yesterday after each run of the project
- [x] A reconciliation of the incremental table with a full recalculation from the raw data each run
- [ ] A uniqueness test on the date column, which proves the model has no duplicates in it at all

> Structural tests cannot detect stale or missing updates. Comparing with a from-scratch calculation catches an incorrect incremental logic directly.

## @resources
- [dbt documentation](https://docs.getdbt.com/)
- [dbt: incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [dbt: data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt: snapshots](https://docs.getdbt.com/docs/build/snapshots)
- [dbt-duckdb adapter](https://github.com/duckdb/dbt-duckdb)
