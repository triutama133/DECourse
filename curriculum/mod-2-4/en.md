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

## @part Orchestration concepts

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

:::drill python Which task runs first?
Write `run_order(deps)`: `deps` maps each task to the list of tasks it needs first, e.g. `{"load": ["extract"], "extract": []}`. Return a list of all tasks in a valid run order. When several tasks are ready at once, take them in alphabetical order.
@starter
# write your function below this line

@check
defines("run_order") ## Define run_order(deps).
run_order({"load": ["extract"], "extract": []}) == ["extract", "load"] ## extract must come before load.
run_order({"c": ["a", "b"], "b": ["a"], "a": []}) == ["a", "b", "c"] ## c needs a and b; b needs a.
run_order({"b": [], "a": [], "c": ["a"]}) == ["a", "b", "c"] ## a and b are both ready: alphabetical order. c waits for a only.
run_order({}) == [] ## No tasks, no order.
@hint
Repeat: take every task that is not done and whose needs are all done; pick the alphabetically first one; mark it done.
@solution
def run_order(deps):
    done = []
    while len(done) < len(deps):
        ready = sorted(t for t in deps if t not in done and all(d in done for d in deps[t]))
        done.append(ready[0])
    return done
:::

## @lesson Core concepts: runs, intervals and partitions
**A DAG** (directed acyclic graph) is the graph of steps: nodes are tasks or assets, arrows are "runs after" or "depends on", and **acyclic** means no loops, so there is always a valid order.

:::talk Which day does the 02:00 run process?
@teacher A daily job is scheduled for 02:00 every night. The run that starts at 02:00 on 6 January is about to process "the day's orders".
@ask Which day's orders should it process?
@choice 6 January, because that is the date on the calendar when it runs | At 02:00 on 6 January almost nobody has ordered yet: the day has only just begun. Try again.
@choice * 5 January: the interval that ended at midnight, just before the run | Yes. An orchestrator runs after an interval has ended, and hands the task that interval's start and end. The run on the 6th processes the 5th.
@choice Both days, to be safe | Processing both would count 5 January twice when the next run does it again. Try again.
@teacher The date a run belongs to is the interval it covers, not the moment it happens to start. That is what makes retries and backfills reproduce the same result.
:::

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
> *Setup & bridge note:* From the course folder with your venv active, install dependencies first (`python -m pip install -r labs/mod-2-4/requirements.txt`). Lesson 5 explains Dagster assets and resources in full, so you can either wait until Lesson 5 to start the lab or follow the starter syntax below right now.
> 1. In your text editor (VS Code / Cursor), open `labs/mod-2-4/orchestration.py` and remove the starter `raise NotImplementedError(...)` line (do not run `.py` files directly in bash without arguments or interpreters).
> 2. Define the `Paths` resource and the 30-day `daily` partition definition (`end_date` is exclusive, covering 2026-01-01 through 2026-01-30):
> ```python
> from dagster import ConfigurableResource, DailyPartitionsDefinition
> class Paths(ConfigurableResource):
>     data_dir: str
>     warehouse_dir: str
> daily = DailyPartitionsDefinition(start_date="2026-01-01", end_date="2026-01-31")
> ```
> 3. Run the partition test in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k test_partitions_are_the_30_days_of_january -v`
> 4. **Success Indicator:** The test passes, confirming exactly 30 partitions from 2026-01-01 through 2026-01-30.

:::drill python The data interval of a daily run
A daily pipeline processes the **previous** day. Write `interval_for(run_date)`: `run_date` is a string like `"2026-01-06"`. Return a tuple `(start, end)` of strings: the start of the day before and the start of `run_date` itself.
@starter
from datetime import date, timedelta
# write your function below this line

@check
defines("interval_for") ## Define interval_for(run_date).
interval_for("2026-01-06") == ("2026-01-05", "2026-01-06") ## The run on 6 January processes 5 January.
interval_for("2026-03-01") == ("2026-02-28", "2026-03-01") ## It crosses month ends correctly.
interval_for("2026-01-01") == ("2025-12-31", "2026-01-01") ## And year ends.
@hint
Parse `run_date` into a `date` object with `date.fromisoformat`, subtract one day using `timedelta`, and format both dates back to ISO strings.
@solution
from datetime import date, timedelta
def interval_for(run_date):
    end = date.fromisoformat(run_date)
    start = end - timedelta(days=1)
    return (start.isoformat(), end.isoformat())
:::

## @lesson Idempotency and backfills: the rule that makes everything else safe
Module 0.2 gave you the rule, Module 1.2 the techniques, and the orchestrator is where it becomes non-negotiable. **Every step must be safe to run more than once for the same interval.** Orchestrators retry automatically, humans re-trigger runs, and backfills re-run history; if running twice doubles the numbers, one of those will eventually happen to you.

The patterns, all of which the lab tests:

- **Write by partition and replace.** The step for `2026-01-05` writes to a location derived from that date (`daily_orders/date=2026-01-05/`) and **overwrites** it. Never "append to the table".
- **Atomic writes.** Write to a temporary file or staging table, then rename or swap, so a failure leaves the previous complete output.
- **Deterministic output.** Same input, same bytes: sort rows, avoid "now" in the data, fix random seeds.
- **Derive everything from the interval.** No dependence on wall-clock time, on what ran earlier today, or on mutable global state.
- **Idempotent side effects.** Sending an email or calling a payment API twice is a bug; use idempotency keys or record what was already done.

A **backfill** is then simple and safe: run the same step for each past interval. Its dangers are operational: 365 partitions started at once can flood the systems they read from (this module's chaos lab), and a backfill that **recomputes upstream data** must make sure downstream partitions are recomputed too, which is exactly what asset-based dependencies keep track of. Backfills should have a concurrency limit, run off-peak, and be launched deliberately with a clear range.

The lab has you test these properties instead of trusting them: materialise a partition twice and compare the bytes; backfill seven days twice and check the report does not double-count; point the resource at a missing directory and check that the run **fails**, not "succeeds" with nothing.

:::ask A backfill reruns the day `2026-01-05`. Which output design is safe to run twice?
@options
append the day's rows to one growing `all.csv` file
write to a random filename on every run
* overwrite `out/date=2026-01-05/part.csv` atomically
@why
An idempotent job leaves the same result whether it runs once or five times. Appending duplicates the day on the second run; a deterministic per-partition path that is **replaced** does not. This is the rule that makes backfills and retries safe.
:::

> 💡 **Practice Pause 2 (Partitioned Assets & Atomic Writes):**
> 1. Open `labs/mod-2-4/orchestration.py` in your text editor.
> 2. Import `asset`, `AssetExecutionContext`, and `MaterializeResult` from `dagster`, then implement `@asset(partitions_def=daily, ...)` for `daily_orders(context: AssetExecutionContext, paths: Paths)`: read `orders.csv`, filter rows matching `context.partition_key`, clean totals and status, and write sorted rows to `daily_orders/date=<day>/orders.ndjson`.
> 3. Use an atomic write pattern: write to a temporary file first, then atomically replace the target file (`os.replace`) so reruns remain completely idempotent.
> 4. Test idempotency in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_one_partition or test_running_the_same_partition" -v`
> 5. **Success Indicator:** Tests report `PASSED`, proving that executing the same partition twice produces byte-for-byte identical output.

## @part The tools

## @lesson Airflow: DAGs of tasks
**Apache Airflow** defines pipelines as Python files. Its components: a **scheduler** that decides what runs and when, a **DAG processor** that parses your files, **workers** (via an *executor*, local, Celery or Kubernetes) that run tasks, a **metadata database** with the state of everything, and an **API server and UI** to view and trigger runs.

:::talk The task that asks the clock
@teacher A daily task picks the day to load with `datetime.now()`. It works fine every night. On 9 January you start a backfill to reload 1 January through 7 January.
@ask Which days does the backfill actually load?
@choice * Today's date, over and over: the task asks the clock, not the interval it was given | Yes. Every backfilled run asks `now()`, gets 9 January and loads the same day seven times, while 1 to 7 January stay missing.
@choice 1 to 7 January, because the scheduler passes those dates | The scheduler does pass the interval, but this task ignores it and asks the clock. Try again.
@choice It fails, because `datetime.now()` is not allowed in a task | Python allows it, and that is the problem. Try again.
@teacher Use the interval the orchestrator hands you (its logical date), never the clock. Then a retry or a backfill loads exactly the day it was meant to.
:::

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

> 🛠 **Try it (5 min, pen and paper — DAG design check).** Look at the Airflow `@dag` above. Why should `read_csv` or database queries stay *inside* `@task def extract()`, never at the top of the file outside `@task`? And if you backfill `2026-01-01` through `2026-01-07`, what value must `extract()` and `load()` use instead of `datetime.now()`?

:::ask In Airflow you set `retries=3` on a task that appends rows to a table. What must be true for retries to be safe?
@options
* the task is idempotent on reruns
the scheduler is restarted between each attempt
the task runs on the same worker every time
@why
A retry runs the task again, possibly after it already wrote part of its output. If the task replaces its slice (delete-then-insert or MERGE), a repeat is harmless; a blind append would duplicate rows.
:::

## @lesson Dagster: pipelines as assets
:::talk Tasks or assets?
@teacher The founder asks: "Is the revenue table fresh this morning?" In a task-centred tool you can answer "did the load job succeed?". In an asset-centred tool you can answer something different.
@ask What is the difference in the question each tool starts from?
@choice * A task-centred tool tracks the steps that ran; an asset-centred tool tracks the data products (tables, files) and when each was last updated | Yes. The first says "the job ran green". The second says "the revenue table was last built at 02:10, from fresh orders". Both are useful; the founder asked the second question.
@choice There is no difference: both only schedule code | Both schedule code, but what they keep track of differs. Try again.
@choice An asset-centred tool cannot run on a schedule | Assets can have schedules too. Try again.
@teacher A green job does not prove a fresh table. Track the thing people actually use.
:::

**Dagster** starts from a different question. Instead of "which tasks run in what order", it asks "**which data assets should exist, and what do they depend on?**". An **asset** is a table, file or model; a function decorated with `@asset` says how to produce it (`@asset` is a Python decorator from `dagster` that registers your function in the dependency graph, and subclassing `ConfigurableResource` defines typed settings — such as `Paths` — passed automatically into asset functions for clean dependency injection). Dependencies are between assets, so the orchestrator knows what is stale, what a change affects downstream, and what to rebuild.

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

> 💡 **Practice Pause 3 (Retry Policies & Failing Loudly):**
> 1. Open `labs/mod-2-4/orchestration.py` in your text editor.
> 2. Add retry behavior to `daily_orders` using `retry_policy=RetryPolicy(max_retries=2, delay=1)` to absorb transient failures.
> 3. Ensure your asset raises an explicit error when input data is missing (do not return an empty list or pretend to succeed): verify directory/file existence and let `FileNotFoundError` propagate.
> 4. Test failure behavior in terminal:
>    `pytest labs/mod-2-4/test_lab.py -k "test_a_missing_input or test_the_daily_asset_retries" -v`
> 5. **Success Indicator:** Tests report `PASSED`, verifying explicit failures on missing inputs and that the `RetryPolicy` configuration (`max_retries >= 1`) is attached to `daily_orders`.

> 💡 **Practice Pause 4 (Asset Checks & Timezone-Aware Schedules):**
> 1. Open `labs/mod-2-4/orchestration.py` in your text editor.
> 2. Implement `daily_revenue` (aggregating non-cancelled/refunded orders) and `revenue_report` (aggregating all days via `AllPartitionMapping`).
> 3. Add two `@asset_check` functions returning `AssetCheckResult`: `daily_orders_has_unique_ids` (taking `context: AssetCheckExecutionContext` and `paths: Paths`) and `revenue_is_never_negative`.
> 4. Define `daily_job = define_asset_job("daily_kopiku_job", selection=[daily_orders, daily_revenue])` and `daily_schedule` with `name="daily_kopiku_schedule"`, cron `0 2 * * *`, and timezone `Asia/Jakarta`, then register everything in `defs = Definitions(...)`.
> 5. Verify all assets, checks, and schedule definitions in terminal:
>    `pytest labs/mod-2-4 -v`
> 6. **Success Indicator:** All 10 tests report `PASSED`, verifying `daily_orders`, `daily_revenue`, `revenue_report`, both asset checks (`daily_orders_has_unique_ids` and `revenue_is_never_negative`), and the `daily_kopiku_schedule` definition.

:::ask How does Dagster's starting question differ from Airflow's?
@options
which server should run each of the scripts
* which data assets should exist and what they need
how many times each task should be retried
@why
Dagster models the data you want (tables, files, models) and derives the run from their dependencies. Airflow models the tasks and their order. Both can express the same pipeline.
:::

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

:::ask A new team needs to pick between Airflow and Dagster. What is the honest basis for choosing?
@options
whichever tool has the more famous name
the tool with fewer features, as it is simpler
* team skills, existing stack and shape of the work
@why
Neither tool is better in every case. Airflow is the most widely deployed; Dagster fits work that is mostly producing tables and models. Choose by team, existing stack and the shape of the work.
:::

## @lesson Watching your pipelines: logs, metrics and alerts
> **In short:** A pipeline that fails loudly is easy to fix. The dangerous one fails quietly, or slowly, or "succeeds" with nothing in it. Monitoring is the habit of collecting three kinds of evidence (logs, metrics and alerts) so you find out before your users do.

Think of a kitchen. The **logbook** records what happened and when ("10:03 the oven tripped"). The **oven thermometer** and the till total are **metrics**: numbers you read over time ("how hot was it every minute?"). The **smoke detector** is an **alert**: a rule that taps your shoulder when something needs you now. A data pipeline needs all three.

| Signal | What it is | Good for | Example in a pipeline |
|---|---|---|---|
| **Logs** | text lines about single events | finding out *what exactly* happened in one run | `ERROR order 1007: total is not a number` |
| **Metrics** | numbers, measured again and again | seeing trends and comparing today with normal | rows loaded, seconds taken, failures per day |
| **Alerts** | a rule on a metric that notifies a person | being told, instead of having to look | "no new data for 6 hours" |

### What to measure in a data job

Four numbers tell you most of the story, for almost any pipeline:

1. **Did it succeed?** The failure count and failure rate over the last runs.
2. **How long did it take?** A job that suddenly takes four times longer is warning you before it breaks.
3. **How much data moved?** Rows read and rows written. A job that "succeeds" and writes zero rows is the quiet failure.
4. **How fresh is the result?** The age of the newest data (Module 2.5 lesson 5 covers checks on the data itself; this lesson watches the job).

Start with a plain summary of the recent runs:

:::drill python Summarise the recent runs
Write `summarize_runs(runs)`: `runs` is a list of dictionaries like `{"ok": True, "seconds": 12}`. Return a dictionary with `runs` (how many), `failures` (how many had `ok` false), `failure_rate` (failures divided by runs, `0` when there are no runs) and `avg_seconds` (the mean of `seconds`, `0` when there are no runs).
@starter
# write your function below this line

@check
defines("summarize_runs") ## Define summarize_runs(runs).
summarize_runs([{"ok": True, "seconds": 10}, {"ok": False, "seconds": 30}]) == {"runs": 2, "failures": 1, "failure_rate": 0.5, "avg_seconds": 20} ## One failure in two runs, 20 seconds on average.
summarize_runs([]) == {"runs": 0, "failures": 0, "failure_rate": 0, "avg_seconds": 0} ## No runs: zeros, and no division by zero.
summarize_runs([{"ok": True, "seconds": 4}] * 4)["failure_rate"] == 0 ## All good: a failure rate of 0.
@hint
Count with `sum(1 for r in runs if not r["ok"])`, and guard `if not runs:` before dividing.
@solution
def summarize_runs(runs):
    if not runs:
        return {"runs": 0, "failures": 0, "failure_rate": 0, "avg_seconds": 0}
    failures = sum(1 for r in runs if not r["ok"])
    return {
        "runs": len(runs),
        "failures": failures,
        "failure_rate": failures / len(runs),
        "avg_seconds": sum(r["seconds"] for r in runs) / len(runs),
    }
:::

:::ask A nightly job ends with exit code 0 and the scheduler shows "success", but it loaded 0 rows because the source file was empty. Which signal would catch it?
@options
the failure count, because the run is marked as success
the log level, because INFO lines are always written
* the volume: rows loaded, compared with the usual number
@why
Nothing failed, so the failure count stays at zero and the log looks normal. Only a metric about the data (rows written, compared with a normal night) shows that the run did no real work. This is why you watch volume as well as success.
:::

### Slow is also broken

A run that takes 100 seconds when it usually takes 11 is a symptom: more data, a lock, a slow source. To judge "slower than usual" use the **median** of the past durations (the middle value), not the mean, so that one old freak run does not hide a real slowdown.

:::drill python Is this run unusually slow?
Write `is_slow(seconds, history, factor)`: `history` is a list of past durations. Return `True` when `seconds` is **more than** `factor` times the **median** of the history, otherwise `False`. With an empty history return `False` (there is nothing to compare with). The `statistics` module has `median`.
@starter
import statistics
# write your function below this line

@check
defines("is_slow") ## Define is_slow(seconds, history, factor).
is_slow(100, [10, 12, 11], 3) == True ## The median is 11, and 100 is more than 3 × 11.
is_slow(30, [10, 12, 11], 3) == False ## 30 is under 33.
is_slow(33, [10, 12, 11], 3) == False ## Exactly 3 × 11 is not more than that.
is_slow(5, [], 2) == False ## No history: nothing to compare with.
is_slow(100, [10, 10, 10, 1000], 3) == True ## One freak run of 1000 must not hide the slowdown: the median is still 10.
@hint
Return `False` early when `history` is empty; otherwise compute the middle value with `statistics.median` and check whether `seconds` strictly exceeds `factor` times that median.
@solution
import statistics
def is_slow(seconds, history, factor):
    if not history:
        return False
    return seconds > factor * statistics.median(history)
:::

### Alerts that people still trust

:::talk Silence looks like success
@teacher Your alerts fire whenever a job fails. Last Friday night the server that runs the scheduler was shut down by mistake. The weekend jobs never ran. On Monday the finance team asks why the numbers stopped on Friday.
@ask Why did no alert fire?
@choice The alert system was broken | Probably it was fine: it only reacts to failures. Try again.
@choice The jobs failed quietly and the alert missed them | The jobs did not fail: they never started, so there was no failure to report. Try again.
@choice * Nothing failed: a job that never runs reports no error, so the silence looked like success | Yes. You need an alert for the missing run, for example "no successful run in the last 26 hours". It watches for the absence of good news.
@teacher Alert on failure, but also on lateness and on silence.
:::

An alert should mean "a person must act". Two habits keep it that way. First, alert on **symptoms that matter** (no fresh data, three failures in a row), not on every small event. Second, give the job its retries first: a task that fails once and succeeds on the retry is not an emergency. An alert that fires every night for nothing teaches everyone to ignore it. This is called **alert fatigue**, and it is how real incidents get missed.

Watch a rule that alerts only after three failures **in a row**:

:::trace Alert after three failures in a row
@code
results = [True, False, False, True, False, False, False]
streak = 0
for ok in results:
    if ok:
        streak = 0
    else:
        streak += 1
    if streak >= 3:
        print("ALERT")
@notes
5 | A success resets the streak to zero: one good run clears the worry.
7 | Each failure adds one to the streak. The first two failures never reach 3, because a success interrupted them.
9 | Only the last three failures in a row reach 3: this is the moment an alert would be sent.
:::

:::ask Your scheduler pages you every time a task fails once, but its retries fix 9 failures out of 10. What is the best change?
@options
* alert only if the task still fails after retries
mute every alert during the night, so you can sleep
raise the retries to twenty, so that it never alerts again
@why
An alert must mean that a person needs to act. A single failure that the retry fixes is not that, and constant false alarms train people to ignore the pager. Alert on the symptom that remains after retries. Muting at night hides real problems, and endless retries only delay the bad news.
:::

:::drill python Alert after N failures
Write `alert_after(results, n)`: `results` is a list of booleans, oldest first, where `True` means the run succeeded. Return `True` only when there are at least `n` results and the **last `n` are all failures**.
@starter
# write your function below this line

@check
defines("alert_after") ## Define alert_after(results, n).
alert_after([True, False, False, False], 3) == True ## The last three runs all failed.
alert_after([False, False, True, False], 3) == False ## A success is among the last three.
alert_after([False, False], 3) == False ## Fewer than three results so far.
alert_after([], 1) == False ## No runs at all.
alert_after([True, False], 1) == True ## n = 1: the last run failed.
@hint
First check that `results` has at least `n` entries, then slice the last `n` elements and verify that none of them is `True`.
@solution
def alert_after(results, n):
    return len(results) >= n and not any(results[-n:])
:::

### Metrics a dashboard can read

Logs are for people reading one run. Metrics are for charts. A common way to publish them is a tiny text format used by **Prometheus**, a program that collects metrics by reading a page of text lines every few seconds; **Grafana** then draws the charts and can send the alerts. Each line is a name, optional labels in curly brackets, and a number:

```text
kopiku_rows_loaded{job="orders"} 3617
kopiku_job_duration_seconds{job="orders"} 0.42
```

Airflow and Dagster show run history in their own screens, and Airflow can also send its metrics to systems such as StatsD or OpenTelemetry (check your version's documentation). A plain script can write its own lines to a file at the end of a run.

:::drill python Write one metric line
Write `metric_line(name, value, labels)`: return the text of one metric. With labels it is `name{key="value",key2="value2"} number`, with the labels **sorted by key**. With no labels it is just `name number`. `metric_line("rows_loaded", 3617, {"job": "orders"})` is `rows_loaded{job="orders"} 3617`.
@starter
# write your function below this line

@check
defines("metric_line") ## Define metric_line(name, value, labels).
metric_line("rows_loaded", 3617, {"job": "orders"}) == 'rows_loaded{job="orders"} 3617' ## One label.
metric_line("up", 1, {}) == "up 1" ## No labels: no curly brackets.
metric_line("duration_seconds", 0.42, {"job": "orders", "env": "prod"}) == 'duration_seconds{env="prod",job="orders"} 0.42' ## Two labels, sorted by key.
metric_line("x", 2, {"b": "1", "a": "2", "c": "3"}) == 'x{a="2",b="1",c="3"} 2' ## Any number of labels.
@hint
Handle an empty `labels` dict as a plain two-part string; otherwise sort the keys, format each pair as `key="value"`, join them with commas, and wrap them in `{...}` (doubling braces inside an f-string).
@solution
def metric_line(name, value, labels):
    if not labels:
        return f"{name} {value}"
    inner = ",".join(f'{k}="{labels[k]}"' for k in sorted(labels))
    return f"{name}{{{inner}}} {value}"
:::

:::ask Which question needs metrics rather than logs?
@options
what was the exact error message of last night's crash?
* how did the run time change over the last 30 days?
which input row made the parser fail on Tuesday?
@why
A trend over many runs is a number measured again and again: a metric, drawn as a chart. The exact error message and the row that broke the parser are details of one event, so they live in the logs.
:::

### Your pipeline is not done until someone can see it

Before you call a job finished, answer five questions: where are its logs, which three numbers does it publish (success, duration, rows), what counts as too slow or too empty, who gets the alert, and what do they do first (the **runbook**, Module 2.5 lesson 7). If you cannot answer, the job is running blind.

> 🛠 **Try it (10 min, Python).** On your own computer, write `metrics_demo.py`: a function `run_job()` that pretends to load 3617 rows (use `time.sleep(0.2)`), measures how long it took, and writes three lines to a file `metrics.prom`: `kopiku_job_success{job="orders"} 1`, `kopiku_job_duration_seconds{job="orders"} <seconds>` and `kopiku_rows_loaded{job="orders"} 3617`. Run it twice, then `cat metrics.prom` and `grep success metrics.prom`.
>
> **You should see:** the three lines, with a duration close to `0.2` (for example `0.2012`). Each run overwrites the file with the newest values, so the file always shows the last run. Now change the job to raise an error before writing: the file keeps the old numbers, which is why real systems also record *when* the file was written (freshness).

## @lesson Dockerized local orchestration stack and the safe production backfill runbook

When you inherit a production pipeline in your first 90 days on the job (or build an end-to-end project like in the *DataTalksClub Data Engineering Zoomcamp*), two operational skills keep your systems reproducible and prevent catastrophic outages:

**1. Multi-Container Local Data Stack (`docker-compose.yaml`).** Production pipelines never rely on "it worked on my laptop's global Python install." A reproducible data repository defines its database, ingestion worker, and orchestrator in a single `docker-compose.yaml` sharing an isolated bridge network, healthchecks, and named volumes:

```yaml
services:
  postgres-warehouse:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${PG_USER:-kopiku}
      POSTGRES_PASSWORD: ${PG_PASS:-local_dev_only}
      POSTGRES_DB: ${PG_DB:-kopiku_dw}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kopiku -d kopiku_dw"]
      interval: 5s
      retries: 5

  ingest-worker:
    build: .
    depends_on:
      postgres-warehouse:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://kopiku:local_dev_only@postgres-warehouse:5432/kopiku_dw
    command: ["python3", "-m", "pipeline.ingest", "--date", "${LOGICAL_DATE:-2026-01-15}"]

volumes:
  pg_data:
```

Notice `condition: service_healthy`: `depends_on` alone only waits for the container process to start, not for PostgreSQL to finish initializing and accept TCP connections!

**2. The 6-Step Safe Production Backfill Runbook.** Sooner or later, a business logic change or fixed parsing bug requires you to **backfill 12 months of historical data** across a multi-terabyte table. Running an unthrottled backfill in production can crash the source database, run up an unplanned warehouse bill, lock BI dashboards, and re-send Reverse ETL (pushing warehouse metrics back to CRM and operational apps) marketing emails for every historical order. Follow this 6-step runbook every time:

| Step | Action | Why It Prevents a Production Incident |
|---|---|---|
| **1. Mute Downstream Side-Effects** | Disable or pause **Reverse ETL syncs, Slack/email webhook triggers, and ML auto-retraining** connected to the target table. | Prevents re-sending "Welcome VIP!" CRM messages for orders from 2025. |
| **2. Dry-Run & Estimate Cost on 1 Partition** | Run the backfill for a single logical date (`--start 2026-01-01 --end 2026-01-01`) and multiply bytes scanned & runtime by 365. | Catches a hidden full-table scan before multiplying it 365×. |
| **3. Cap Concurrency (`max_active_runs`)** | Set `max_active_runs=2` or `max_concurrency=4` in Airflow/Dagster/Kestra. | Prevents 365 parallel workers from saturating the source OLTP database or warehouse slot pool. |
| **4. Prefer Chunked Partition Batches Over 365 Single-Day Runs** | In cloud warehouses (`BigQuery / Snowflake / Databricks`), process monthly ranges or use `dbt microbatch` (dbt's partitioned incremental mode) / partition replacement. | 12 monthly runs pay the fixed cost of a query (planning, reading metadata, minimum billing) 12 times instead of 365. |
| **5. Build into a Staging/Clone Table First (Blue-Green Swap)** | On critical Gold tables, create a zero-copy clone (an instant metadata-only warehouse table copy: `CREATE TABLE fct_orders_backfill CLONE fct_orders`), run the backfill there, verify tests, then swap atomically with `ALTER TABLE ... SWAP WITH` (a blue-green swap). | Downstream BI dashboards never see a half-empty or inconsistent table during a 4-hour backfill. |
| **6. Reconcile Totals & Re-Enable Downstream Syncs** | Compare row counts and invariant sums (`SUM(net_revenue_idr)`) before and after, advance the Reverse ETL watermark so historical rows aren't re-sent, and unpause downstream jobs. | Proves the backfill solved the issue with zero unintended side effects. |

> 🛠 **Try it (15 min, Python with DuckDB).** Load `data/orders.csv` with `read_csv(..., all_varchar=true)`, keeping rows whose `total_idr` is all digits and whose `order_ts` survives `TRY_CAST(order_ts AS TIMESTAMP)`. Create two empty tables `(order_date DATE, orders BIGINT, revenue_idr BIGINT)`. "Backfill" 2026-01-10, 11 and 12 into both, one day at a time, counting the orders that are not cancelled (compare `lower(trim(status))`: the file spells it three ways): into the first with a plain `INSERT`, into the second with `DELETE` of that day and then `INSERT`, in one transaction. Run the whole backfill a second time, as you would after a crash, and print the row count and total revenue of both tables after each run.
>
> **You should see:** after the first run both tables hold `3` rows and `100360000`. After the second run the plain-`INSERT` table holds `6` rows and `200720000`, every day counted twice, while the replace-the-day table still holds `3` and `100360000`. (Compare only `status <> 'cancelled'` and you get `101925000`: the orders written `CANCELLED` or `Cancelled` slip through as revenue.) That second table is what step 6 of the runbook reconciles against. Measured with DuckDB 2.0.1 on the course's default data.

:::ask In a docker-compose file the app has `depends_on: postgres`. Why can it still fail with 'connection refused' at start-up?
@options
* depends_on waits for the start, not for readiness
depends_on only works with Python containers
Postgres refuses connections from other containers
@why
A started container is not a ready service. Add a healthcheck to Postgres and use `condition: service_healthy` so the app starts only once the database answers.
:::

## @lab Lab: a daily pipeline in Dagster, tested like software
Build the KopiKu daily pipeline as Dagster assets: clean orders per day, compute daily revenue, a report over all days, checks, a retry policy, and a Jakarta-time schedule. The tests exercise it with the real orchestration engine against temporary folders.

### @steps
> **Already finished Practice Pauses 1–5?** Your Dagster assets, checks, and schedule are already built and verified, jump straight to Step 6 to explore the Dagster UI or Step 7 for stretch goals.

1. In the terminal, go to the course folder and activate your venv (`cd ~/projects/DECourse`, then `source venv/bin/activate`). Install dependencies, generate the data, and read the tests first:

```bash
python -m pip install -r labs/mod-2-4/requirements.txt
python3 labs/shared/shopgen.py --out data
pytest labs/mod-2-4 -v          # fails until you implement the definitions
```

2. Open `labs/mod-2-4/orchestration.py`. The docstring is the specification: a `Paths` resource, a daily partition definition from 2026-01-01 to 2026-01-30, three assets, two checks, a job, a schedule and a `Definitions` object.
3. Implement `Paths` (a `ConfigurableResource`) and `daily`. Then `daily_orders`: for the partition's day, read `orders.csv`, apply the cleaning rules from the earlier modules, and **replace** the day's file atomically. Run `pytest labs/mod-2-4 -k "TestDailyOrders and not unique_ids"` as you go (the `unique_ids` check comes in Step 4).
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
- labs/mod-2-4/requirements.txt :: dagster, dagster-webserver, and pytest :: config
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
