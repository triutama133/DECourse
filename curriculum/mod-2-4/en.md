---
title: Orchestration with Dagster and Airflow
duration: 3 weeks
summary: Learn what an orchestrator adds to a pipeline (dependencies, retries, backfills, visibility), the idempotency rule that makes it safe, and build the same daily pipeline in Dagster as partitioned assets, with Airflow's equivalent shown side by side.
why: Airflow tutorials show tasks that echo hello. In production an orchestrator is what stops a retry from double-counting revenue, lets you reprocess 90 days safely, and tells you at 06:00 that the 02:00 run never happened.
---

## @outcomes
- Explain what an orchestrator provides beyond cron, and what it deliberately does not do
- Describe a run in terms of a schedule, a data interval or partition, dependencies, retries and a backfill
- Apply the idempotency rule so any task or partition can be re-run safely
- Build a partitioned Dagster pipeline with a resource, asset checks, a retry policy and a schedule, and test it
- Read an Airflow TaskFlow DAG, and compare task-centric and asset-centric orchestration honestly

## @prereq
Modules 1.1 (cron), 1.2 (idempotency, retries) and 2.3 (dbt). `pip install -r labs/mod-2-4/requirements.txt` installs Dagster. Airflow is shown in code and is not required for the lab.

## @lesson What an orchestrator does, and what it doesn't
In Module 1.1 cron ran a script at a time. It had no idea that job B needs job A's output, did not retry, kept no history, and could not tell you a run was missing. A real pipeline has dozens of steps owned by different people, and the questions multiply: *what runs after what? what if a step fails at 03:00? how do I rerun the last 30 days after a bug fix? how do I know the pipeline is healthy?*

An **orchestrator** is the control plane that answers those. It provides:

- **Scheduling**: run on a time schedule, or when something happens (a file arrives, an upstream dataset updates).
- **Dependencies**: a graph that says what must finish before what starts, so independent work runs in parallel and dependent work waits.
- **Retries and timeouts**: automatic re-attempts with delays, and a limit on how long a step may run.
- **State and history**: every run, every step, its logs, timing and result, kept and searchable.
- **Backfills**: re-run a range of past intervals in a controlled way.
- **Alerting and observability**: notify on failure, on a missed run, on a step that is slower than usual.
- **Parameterisation and configuration**: the same code with different dates, environments and credentials.

What it does *not* do: it is not where the heavy data processing happens. A good orchestrator **triggers** work (a dbt run, a Spark job, a Python function, a warehouse query) and watches it; the processing runs in the engine built for it (Module 2.1 onward). A pipeline's orchestration code should be thin: dependencies, scheduling and wiring, with business logic in ordinary, testable functions and SQL.

The two systems you will meet most are **Apache Airflow** (the long-standing standard, task-centric, in use at a very large number of companies) and **Dagster** (asset-centric, designed around the data being produced). Others exist (Prefect, Kestra, Mage, cloud-native schedulers); the concepts transfer.

> 🛠 **Try it (20 min, Python).** Build a mini orchestrator. The dependencies are `{"extract": [], "clean": ["extract"], "audit": ["extract"], "load": ["clean"], "report": ["load"]}`, and every task is a small Python function. Make `load` raise `RuntimeError("warehouse busy")` on its first two calls and succeed on the third. Write `run(retries)`: start a task only when all its upstream tasks succeeded, retry it up to `retries` extra times when it raises, mark it `failed` when the retries run out, and mark everything downstream of a failure `skipped`. Print one line per attempt and the final state of every task. Run it with `retries=2` and again with `retries=1`.
>
> **You should see:** with `retries=2`, `load` fails twice (`warehouse busy`) and succeeds on attempt 3, and all five tasks end `success`. With `retries=1`, `load` ends `failed`, `report` is `skipped`, and `extract`, `clean` and `audit` are still `success`: `audit` does not depend on `load`, so the failure does not stop it. That small loop is the core of every orchestrator: dependencies, retries, and a state for each task.

## @lesson Core concepts: runs, intervals and partitions
**A DAG** (directed acyclic graph) is the graph of steps: nodes are tasks or assets, arrows are "runs after" or "depends on", and **acyclic** means no loops, so there is always a valid order.

The concept that trips up newcomers is the **data interval** (Airflow) or **partition** (Dagster). A daily pipeline scheduled at 02:00 on 6 January is not "doing 6 January's work". It is processing **5 January's data**, because 5 January only finished at midnight. Orchestrators model this explicitly: every run is tied to the interval of data it covers (`2026-01-05`), exposed to your code as the **logical date** (Airflow's `ds`) or the **partition key** (Dagster's `context.partition_key`). Your code must read data **for that interval**, never for "now". If a run is retried tomorrow, or backfilled next month, it must produce the same result for 5 January. Using the wall clock (`datetime.now()`, `current_date`) inside a task silently breaks this.

Other vocabulary:

- **Task / op / asset**: a unit of work. **Dependencies** between them form the DAG.
- **Schedule** and **trigger**: when a run starts (a cron expression such as `0 2 * * *`, in a stated **time zone**, or an event).
- **Sensor**: a step or trigger that waits for a condition, such as a file landing or an upstream table updating.
- **Retries**: attempts again after a failure, with a delay. Retry *transient* problems (timeouts, rate limits); do not retry deterministic ones (bad data, a code bug), which will fail the same way every time.
- **Concurrency limits** (pools, tags, slots): cap how many tasks of a kind run at once, to protect shared systems.
- **Backfill**: run a past range of intervals, new or again.
- **Catchup**: whether the scheduler automatically creates runs for intervals it missed since the start date.

Pass **references, not data**, between steps. Task outputs travel through the orchestrator's metadata store (Airflow's XCom); that is for small values such as a file path or a row count. Large data goes through storage (a table, a Parquet folder) and the next step reads it from there.

> 💡 **Practice Pause 1 (Defining Resources & Daily Partitions):**
> 1. In your text editor (VS Code / Cursor), open `labs/mod-2-4/orchestration.py` (do not run `.py` files directly in bash without arguments or interpreters).
> 2. Define the resource class `Paths(ConfigurableResource)` with string attributes `data_dir` and `warehouse_dir`.
> 3. Create the daily partitions definition: `daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")` (note: `end_date` is exclusive, covering 30 days of January 2026).
> 4. Run the partition test in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k test_partitions_are_the_30_days_of_january -v`
> 5. **Success Indicator:** The test passes, confirming exactly 30 partitions from 2026-01-01 through 2026-01-30.

## @lesson Idempotency and backfills: the rule that makes everything else safe
Module 0.1 gave you the rule, Module 1.2 the techniques, and the orchestrator is where it becomes non-negotiable. **Every step must be safe to run more than once for the same interval.** Orchestrators retry automatically, humans re-trigger runs, and backfills re-run history; if running twice doubles the numbers, one of those will eventually happen to you.

The patterns, all of which the lab tests:

- **Write by partition and replace.** The step for `2026-01-05` writes to a location derived from that date (`daily_orders/date=2026-01-05/`) and **overwrites** it. Never "append to the table".
- **Atomic writes.** Write to a temporary file or staging table, then rename or swap, so a failure leaves the previous complete output.
- **Deterministic output.** Same input, same bytes: sort rows, avoid "now" in the data, fix random seeds.
- **Derive everything from the interval.** No dependence on wall-clock time, on what ran earlier today, or on mutable global state.
- **Idempotent side effects.** Sending an email or calling a payment API twice is a bug; use idempotency keys or record what was already done.

A **backfill** is then simple and safe: run the same step for each past interval. Its dangers are operational: 365 partitions started at once can flood the systems they read from (this module's chaos lab), and a backfill that **recomputes upstream data** must make sure downstream partitions are recomputed too, which is exactly what asset-based dependencies keep track of. Backfills should have a concurrency limit, run off-peak, and be launched deliberately with a clear range.

The lab has you test these properties instead of trusting them: materialise a partition twice and compare the bytes; backfill seven days twice and check the report does not double-count; point the resource at a missing directory and check that the run **fails**, not "succeeds" with nothing.

> 💡 **Practice Pause 2 (Partitioned Assets & Atomic Writes):**
> 1. Open `labs/mod-2-4/orchestration.py` in your text editor.
> 2. Implement `@asset(partitions_def=daily, ...)` for `daily_orders(context: AssetExecutionContext, paths: Paths)`: read `orders.csv`, filter rows matching `context.partition_key`, clean totals and status, and write sorted rows to `date=<day>/orders.ndjson`.
> 3. Use an atomic write pattern: write to a temporary file first, then atomically replace the target file (`os.replace`) so reruns remain completely idempotent.
> 4. Test idempotency in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_one_partition or test_running_the_same_partition" -v`
> 5. **Success Indicator:** Tests report `PASSED`, proving that executing the same partition twice produces byte-for-byte identical output.

## @lesson Airflow: DAGs of tasks
**Apache Airflow** defines pipelines as Python files. Its components: a **scheduler** that decides what runs and when, a **DAG processor** that parses your files, **workers** (via an *executor*, local, Celery or Kubernetes) that run tasks, a **metadata database** with the state of everything, and an **API server and UI** to view and trigger runs.

A complete DAG using the TaskFlow API (verified to run with Airflow 3.3):

```python
from datetime import timedelta
import pendulum
from airflow.sdk import dag, task


@dag(
    dag_id="kopiku_daily",
    schedule="0 2 * * *",                                   # every day at 02:00
    start_date=pendulum.datetime(2026, 1, 1, tz="Asia/Jakarta"),
    catchup=False,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
)
def kopiku_daily():
    @task
    def extract(ds=None):                                   # ds = the logical date, e.g. '2026-01-05'
        print(f"extracting orders for {ds}")
        return {"day": ds, "rows": 120}

    @task
    def transform(batch: dict):
        return {"day": batch["day"], "revenue": 1_000_000}

    @task
    def load(result: dict):
        print(f"replace the partition for {result['day']}")   # idempotent load

    load(transform(extract()))


kopiku_daily()
```

You can run it locally for one date without the scheduler: `airflow dags test kopiku_daily 2026-01-05`. The `@task` functions become tasks, the data flow between them defines the dependencies, and the small return values are passed through XCom. Retries are configured per DAG or per task.

Points worth knowing:

- **Operators and providers.** Airflow ships hundreds of integrations (databases, cloud services, dbt, Spark) as provider packages with ready-made operators and hooks, a major reason for its popularity. Use them to *trigger* work rather than doing heavy processing inside the Airflow worker.
- **Keep DAG files light.** Airflow re-parses them continuously; code at the top level (database calls, big imports) runs on every parse and slows the whole system. Do heavy work inside tasks.
- **Connections and variables** hold credentials and settings, ideally backed by a secrets manager, never hard-coded in the DAG.
- **Airflow 3** (the current major line) moved authoring into the `airflow.sdk` package, split out an API server, versions DAGs, and added **assets**: you can declare that a task produces or consumes a dataset and schedule downstream work when the upstream asset updates. The same two-step pipeline can be written asset-style:

```python
from airflow.sdk import asset

@asset(schedule="@daily", uri="file:///warehouse/daily_orders")
def daily_orders(): ...

@asset(schedule=daily_orders, uri="file:///warehouse/daily_revenue")   # runs when daily_orders updates
def daily_revenue(): ...
```

Many teams run Airflow as a managed service (Amazon MWAA, Google Cloud Composer, Astronomer) rather than operating it themselves.

> 💡 **Practice Pause 3 (Retry Policies & Failing Loudly):**
> 1. Open `labs/mod-2-4/orchestration.py` in your text editor.
> 2. Add retry behavior to `daily_orders` using `retry_policy=RetryPolicy(max_retries=2, delay=1)` to absorb transient failures.
> 3. Ensure your asset raises an explicit error when input data is missing (do not return an empty list or pretend to succeed): verify directory/file existence and let `FileNotFoundError` propagate.
> 4. Test failure behavior in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_a_missing_input or test_the_daily_asset_retries" -v`
> 5. **Success Indicator:** Tests report `PASSED`, verifying explicit failures on missing inputs and automated retries on transient errors.

## @lesson Dagster: pipelines as assets
**Dagster** starts from a different question. Instead of "which tasks run in what order", it asks "**which data assets should exist, and what do they depend on?**". An **asset** is a table, file or model; a function decorated with `@asset` says how to produce it. Dependencies are between assets, so the orchestrator knows what is stale, what a change affects downstream, and what to rebuild.

The lab's pipeline, in essence:

```python
daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")

class Paths(ConfigurableResource):                 # configuration and secrets live in resources
    data_dir: str
    warehouse_dir: str

@asset(partitions_def=daily, retry_policy=RetryPolicy(max_retries=2, delay=1))
def daily_orders(context: AssetExecutionContext, paths: Paths) -> MaterializeResult:
    day = context.partition_key                    # '2026-01-05': the interval this run is about
    ...                                            # read that day's data, clean it
    _atomic_write(out_path_for(day), cleaned)      # replace the partition's file
    return MaterializeResult(metadata={"rows": len(cleaned)})

@asset(partitions_def=daily, deps=[daily_orders])  # same partition of the upstream asset
def daily_revenue(...): ...

@asset(deps=[AssetDep(daily_revenue, partition_mapping=AllPartitionMapping())])
def revenue_report(...): ...                       # unpartitioned: depends on every day computed so far
```

Concepts you will use in the lab:

- **Partitions.** A `DailyPartitionsDefinition` creates one partition per day (30 here). Dagster tracks, per asset and partition, whether and when it was materialised. The UI shows a grid you can select from to **backfill** exactly the partitions you want. A partitioned asset can depend on the *same* partition of its upstream, or (with a partition mapping) on all of them, as the report does.
- **Resources.** Anything environment-specific (paths, database connections, API keys) is a *resource* passed into assets. The tests run the same assets against a temporary directory by supplying a different resource: this is dependency injection, and it is how you keep code testable and secrets out of source.
- **Asset checks.** Data-quality assertions attached to an asset, run alongside materialisation, with a result shown in the UI (`daily_orders_has_unique_ids`). A failed check can block downstream work.
- **Retry policy, schedules and sensors.** `RetryPolicy` retries a failing step; a `ScheduleDefinition` ties a cron expression (and time zone) to a job; a *sensor* triggers runs when a condition occurs.
- **Definitions.** `Definitions(assets=..., schedules=..., resources=...)` bundles everything Dagster loads. `dagster dev -f orchestration.py` starts a local UI with the asset graph, runs and logs.
- **Lineage and observability** come for free, because the dependency graph is explicit: you can answer "which dashboards does this table feed?" and "what is stale?".

Dagster integrates with dbt (every dbt model becomes an asset in the same graph), so staging, marts and Python assets sit in one lineage.

> 💡 **Practice Pause 4 (Asset Checks & Timezone-Aware Schedules):**
> 1. Open `labs/mod-2-4/orchestration.py` in your text editor.
> 2. Implement `daily_revenue` (aggregating non-cancelled/refunded orders) and `revenue_report` (aggregating all days via `AllPartitionMapping`).
> 3. Add two asset checks: `daily_orders_has_unique_ids` and `revenue_is_never_negative`.
> 4. Configure `daily_schedule` with cron `0 2 * * *` and timezone `Asia/Jakarta`, then register everything in `defs = Definitions(...)`.
> 5. Test checks and schedules in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_the_unique_ids_check or test_the_schedule" -v`
> 6. **Success Indicator:** Tests report `PASSED`, confirming asset checks and schedule definitions.

## @lesson Choosing and operating an orchestrator
The two philosophies compared honestly:

| | Task-centric (classic Airflow) | Asset-centric (Dagster; Airflow 3 assets) |
|---|---|---|
| Unit of thought | A task that runs | A data asset that should exist |
| Core question | "What runs after what?" | "What is stale, and what depends on it?" |
| Backfills | Re-run task instances for date ranges | Materialise selected partitions; downstream staleness is known |
| Lineage | Reconstructed or added | Native |
| Strengths | Huge ecosystem, hiring pool, flexible for any workflow (ML, infrastructure, notifications) | Data-first model, testability, partitions and quality checks built in |
| Watch out for | Easy to build tangled DAGs; business logic leaking into DAG files | A smaller ecosystem; a different mental model for teams used to Airflow |

Neither is "fundamentally superior". Airflow is the most widely deployed, and its assets feature narrows the gap; Dagster is excellent when the work is mostly producing tables and models. Choose by the team's skills, the existing platform and the workload, and keep the logic portable (plain Python functions and SQL) so that the choice remains reversible.

**Operating one well:**

- **Alert on three things**: a failed run, a **missing** run (the 02:00 job never started), and a **late or slow** one (an SLA or freshness breach). The second is the one teams forget, because silence looks like success.
- **Fail loudly.** A step that finds no input should fail, not write an empty result and report success (the lab tests this).
- **Limit concurrency** to protect shared systems (source databases, APIs, the warehouse), especially for backfills.
- **Separate environments** (development, staging, production) and deploy pipeline code through CI like any software, with tests.
- **Test at three levels**: unit tests for transformation functions; integration tests that execute the pipeline on small data (Dagster's `materialize`, Airflow's `dags test`) as the lab does; and data checks inside the pipeline.
- **Keep orchestration code thin and DAGs small and readable.** One giant DAG that does everything is as hard to operate as the script it replaced.
- **Document ownership and runbooks**: who is paged, what the first checks are, how to safely re-run.

Anti-patterns to avoid: using `now()` inside tasks; appending instead of replacing; passing large data through XCom; heavy imports or queries at the top of an Airflow DAG file; retrying deterministic failures forever; and launching a huge backfill with no concurrency limit.

> 🛠 **Try it (10 min, Python).** A job is supposed to succeed every day at 02:00. Its successful runs in January 2026 were on the 1st, 2nd, 4th, 5th, 8th, 9th and 10th. Using `datetime.date` and `timedelta`, write `missing_runs(success_dates, start, end)` that returns the days with no successful run, and print the missing days between 2026-01-01 and 2026-01-10 plus the longest stretch of consecutive missing days.
>
> **You should see:** `2026-01-03`, `2026-01-06` and `2026-01-07`, and a longest stretch of `2` days. Notice that nothing failed on those days: nothing ran at all, so no failure alert would ever fire. This is the "missing run" alert from the list above.

## @lab Lab: a daily pipeline in Dagster, tested like software
Build the KopiKu daily pipeline as Dagster assets: clean orders per day, compute daily revenue, a report over all days, checks, a retry policy, and a Jakarta-time schedule. The tests exercise it with the real orchestration engine against temporary folders.

### @steps
1. Install and generate the data, then read the tests first:

```bash
python -m pip install -r labs/mod-2-4/requirements.txt
python3 labs/shared/shopgen.py --out data
pytest labs/mod-2-4 -v          # fails until you implement the definitions
```

2. Open `labs/mod-2-4/orchestration.py`. The docstring is the specification: a `Paths` resource, a daily partition definition from 2026-01-01 to 2026-01-30, three assets, two checks, a job, a schedule and a `Definitions` object.
3. Implement `Paths` (a `ConfigurableResource`) and `daily`. Then `daily_orders`: for the partition's day, read `orders.csv`, apply the cleaning rules from the earlier modules, and **replace** the day's file atomically. Run `pytest labs/mod-2-4 -k TestDailyOrders` as you go.
4. Implement `daily_revenue` (depends on the same partition of `daily_orders`) and `revenue_report` (depends on all partitions: use `AssetDep` with `AllPartitionMapping`). Then the two checks, the job and the schedule. Remember that `@asset_check` functions take an `AssetCheckExecutionContext`.
5. Run the whole suite. Pay attention to the idempotency and backfill tests: they re-run partitions and compare outputs.
6. Look at it for real:

```bash
dagster dev -f labs/mod-2-4/orchestration.py
```

   Open the UI (http://localhost:3000), find the asset graph, select a range of partitions of `daily_orders` and `daily_revenue`, launch a backfill, then materialise `revenue_report`. Re-launch the same backfill and confirm the report does not change.

> 💡 **Practice Pause 5 (Backfill Verification & Dagster UI):**
> 1. In your terminal, run the complete automated test suite:
>    `pytest labs/mod-2-4 -v`
> 2. Launch the local Dagster UI to inspect the asset lineage graph:
>    `dagster dev -f labs/mod-2-4/orchestration.py`
> 3. Open `http://localhost:3000` in your browser, observe the asset DAG `daily_orders` -> `daily_revenue` -> `revenue_report`, pick date partitions to launch a backfill, and confirm no duplicate data is introduced.
> 4. **Success Indicator:** All 10 tests in `test_lab.py` report `PASSED` and Dagster UI shows green materializations.

7. Stretch goals: add a sensor that triggers when a new `orders.csv` appears; add a check that fails when a day has zero orders; set a concurrency limit on the backfill; or write the same pipeline as the Airflow DAG shown in the lesson and run it with `airflow dags test`.

### @files
- labs/mod-2-4/orchestration.py :: Your working file: the Dagster definitions to build :: starter
- labs/mod-2-4/test_lab.py :: The tests (they execute your pipeline with Dagster) :: test
- labs/mod-2-4/requirements.txt :: dagster and pytest :: config
- labs/mod-2-4/reference/orchestration.py :: One possible solution (try first!) :: reference

### @deliverables
- All 10 tests pass
- You launched a backfill from the Dagster UI and re-ran it without changing the report
- You can explain which line of your code makes `daily_orders` idempotent and which makes a failed input fail loudly

### @verify
```bash
pytest labs/mod-2-4 -v
```

Known-good run: `LAB_DIR=reference pytest labs/mod-2-4 -v`.

## @chaos The backfill that took checkout down
### @scenario
A bug in the cleaning logic means 365 days of revenue are wrong. The engineer fixes it and launches a backfill of every daily partition from the Dagster UI, expecting it to finish overnight. The orchestrator is configured with no concurrency limit, so it starts all 365 runs at once. Each run reads that day's orders from the **production replica database**, which also serves the customer-facing "my orders" page.

Within minutes the replica's CPU is at 100%, the "my orders" page times out, support tickets begin to arrive, and, because the failing runs are retried automatically, the load increases rather than falling.

### @cause
Backfilling is safe in terms of *data* (each partition is idempotent) but dangerous in terms of *load*. Nothing limited how many runs executed concurrently, the pipeline's source was a shared system serving users, and the retry policy multiplied requests against an already struggling database. The orchestrator did exactly what it was told.

### @fix
1. Stop the backfill, which Dagster and Airflow both allow, and let the replica recover.
2. Set **concurrency limits**: a cap on concurrent runs for the backfill and a tag-based or pool-based limit on tasks that read from that database (for example, 3 at a time).
3. Run large backfills **off-peak**, in batches (a month at a time), and watch the source system's load.
4. Do not read analytical data from a transactional replica at all: land the data in the lake or warehouse once (Module 2.2) and let the backfill read from there.
5. Use **backoff** and a retry limit that fits a struggling dependency, and alert on a surge of retries.

### @pattern
A backfill multiplies your pipeline's load by the number of partitions. Limit concurrency, protect shared sources, and launch big reprocessing deliberately.

## @quiz
### A daily job scheduled for 02:00 on 6 January should process which data?
- [ ] The data from 6 January, because that is the calendar date on which the run was started
- [x] The data from 5 January, because that interval ended at midnight and the run follows it
- [ ] Whatever data is newest at 02:00, using the current time that the server reports to the job
- [ ] All of the data in the table, since the job has no way to know which interval it covers

> A run is tied to the data interval it covers. A 02:00 run on the 6th processes the interval that just finished (the 5th), and your code must use the logical date, not the wall clock.

### Why is using `datetime.now()` inside a task a problem for orchestrated pipelines?
- [ ] The function is not available inside tasks, because workers do not have access to a clock
- [ ] It makes the task slower, since each call has to contact an external time server first
- [x] A retry or backfill would use today's time, so a past interval would not be reproduced
- [ ] It is only a problem in Airflow, since Dagster replaces the clock with the partition key

> Tasks must derive their inputs from the interval or partition they are run for, so re-running them later gives the same result.

### Which design makes a daily load idempotent?
- [ ] Append the day's rows to one big table and delete the duplicates at the end of each week
- [x] Write the day's output to a location derived from the date, replacing it atomically
- [ ] Keep a counter of completed runs and skip any run whose number is higher than the last one
- [ ] Run the task once per day and turn off retries, so that it can never execute twice

> Replacing a date-keyed partition atomically gives the same final state however many times it runs. Appending or relying on "it only runs once" breaks on retries and backfills.

### What is the main difference between Airflow's classic model and Dagster's asset model?
- [ ] Airflow can only run Python code, while Dagster is also able to run SQL and shell commands
- [ ] Dagster has no scheduling features at all, so it always needs to be used together with cron
- [x] Airflow centres on the tasks that run, while Dagster centres on data assets and their links
- [ ] Airflow does not support retries of failed work, while Dagster retries every single operation

> Task-centric systems model what runs and in what order; asset-centric systems model what data should exist and what it depends on, which makes lineage, staleness and partition backfills first-class.

### In the lab, why is the data path a `ConfigurableResource` and not a constant in the asset code?
- [ ] Constants are not allowed inside Dagster assets, because they are evaluated much too early on
- [x] The same assets can run on test data or on production data by supplying a different resource
- [ ] Resources make the asset run faster, because Dagster caches the result of every single resource
- [ ] The path would otherwise be stored in the asset's output, which Dagster refuses to accept

> Resources inject environment-specific configuration and secrets, keeping assets testable and portable across environments.

### What should be passed directly from one orchestrated step to the next?
- [ ] Complete DataFrames of millions of rows, carried through the orchestrator's metadata database
- [ ] Open database connections that were created inside the first step of the whole pipeline
- [x] Small values or references, such as a path or a row count, with the data kept in storage
- [ ] Nothing at all, since steps are never allowed to depend on the output of any other step

> Task outputs travel through the orchestrator's metadata store, so they should be small. Data goes through storage that the next step reads.

### A backfill of 365 partitions is launched without any limits, and the source database becomes overloaded. What is the right fix?
- [ ] Increase the number of retries so that every failed partition is attempted several more times
- [ ] Delete the partitions from the schedule so that they are no longer able to start at all anymore
- [x] Add concurrency limits, run in batches off-peak, and read from the lake instead of the replica
- [ ] Move the source database to a larger server and keep the same unlimited backfill settings

> Backfills multiply load by the number of partitions. Limit concurrency, spread the work out and avoid reading analytics from a transactional system.

### Which alert is most often missing from a pipeline's monitoring?
- [ ] An alert when a task fails with an exception that was written to the run's logs by the worker
- [ ] An alert when the cost of the warehouse goes up by more than ten percent within one month
- [x] An alert when a scheduled run never started or ran late, because silence looks like success
- [ ] An alert when a developer merges a change into the repository that holds the pipeline code

> Failures are visible; absences are not. Monitor for missing and late runs (freshness and SLA) as well as for errors.

## @resources
- [Dagster documentation](https://docs.dagster.io/)
- [Apache Airflow documentation](https://airflow.apache.org/docs/apache-airflow/stable/)
- [Airflow: TaskFlow API tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)
