---
title: Production Python for Data Engineering
duration: 3 weeks
summary: Turn a throwaway script into a job you can trust in production: validated inputs, streaming that keeps memory flat, safe retries, clear logs and automated tests.
why: Bootcamps teach pandas on a small, clean file. In production the same code meets a file that does not fit in memory, a currency symbol in a number column, and a network call that fails one time in a hundred, and nobody is watching when it breaks.
---

## @outcomes
- Structure a Python data job as small, testable functions with input and output at the edges
- Validate every incoming record with Pydantic v2 and send bad records to a quarantine with a reason
- Process files larger than memory with iterators and generators, and measure memory with tracemalloc
- Make a job safe to run twice: atomic writes, deterministic output, retries only for transient errors
- Write pytest tests with fixtures and parametrisation, including tests for memory use and failure behaviour

## @prereq
Modules 0.1 and 0.3, and basic Python (functions, loops, dictionaries, files). A virtual environment with `pip install -r labs/mod-1-2/requirements.txt`.

## @part Building the job

## @lesson From script to job: structure and boundaries
A beginner's script is one long file that reads a file, loops, prints. It works once. A **job** has to run every night, be understood by someone else, be tested without a real data source, and fail in a way that people notice. The difference is mostly structure.

Start from one rule: **keep the logic pure and push input/output to the edges.** A *pure function* takes values and returns values and touches nothing else. It is trivial to test: call it, check the result. Reading files, calling APIs and writing to databases are *side effects*; keep them in a thin outer layer.

```python
def parse_total(raw: str) -> int | None:      # pure: easy to test
    ...

def run(input_path, output_path):              # edge: reads, writes, logs
    for row in read_orders(input_path):
        ...
```

A reasonable layout for a small job:

```text
kopiku_etl/
  pyproject.toml        # dependencies, tool settings
  src/kopiku_etl/
    models.py           # data shapes and validation
    pipeline.py         # the steps (pure where possible)
    cli.py              # argument parsing, exit codes
  tests/
```

For this module's lab everything is in one file to keep it readable, but the *separation* is already there: `OrderRow` (shape), `validate` (pure), `run` (I/O), `main` (command line).

**A command-line interface** is how schedulers and people run your job. `argparse` (standard library) gives you named arguments, defaults, `--help` and usage errors for free. Return an **exit code** from `main()` and call `sys.exit(main())`, as in Module 1.1: `0` for success, non-zero for failure, and different numbers for different failures if the caller needs to tell them apart.

**Configuration** (paths, thresholds, hostnames) comes from arguments or environment variables, never hard-coded; **secrets** only from the environment (Module 0.1).

Finally, **type hints** (`def f(x: int) -> str`) do not change how Python runs, but they document intent, let editors catch mistakes, and let a checker such as `mypy` or `pyright` find bugs before you run the code. Notice `-> int | None` above uses Python 3.10+ union syntax ("returns either an integer or `None`").

**Two pieces of syntax you will meet across Modules 1.2–1.7:**
- **Classes (`class Name:`)** bundle data and functions into objects that remember. The end of this lesson explains them step by step; Pydantic's models in the next lesson are classes.
- **Decorators (`@name`)**: a short line directly above a `def` that wraps or registers that function/method with extra behaviour — for example `@field_validator` in Pydantic or `@pytest.fixture` in tests.

> 🛠 **Try it (12 min, in `etl_try.py`).** Write a **pure** function `parse_total(raw)` that returns an int, or `None` when the text is not a non-negative whole number (it should understand the `Rp 150.000` style too). It must pass:
> `assert parse_total("150000") == 150000`
> `assert parse_total("Rp 150.000") == 150000`
> `assert parse_total("-5000") is None`
> `assert parse_total("abc") is None`
> `assert parse_total("") is None`
>
> Then write `run(path)`, the edge: it opens `data/orders.csv`, calls `parse_total` on every `total_idr`, and returns the number of valid and invalid rows. Nothing else may touch the file.
>
> **You should see:** no assertion error, and `run("data/orders.csv")` returns `(3617, 17)`. Notice that you tested `parse_total` without any file. Try to do the same with a version that opens the file inside the function and feel the difference.

### Classes: objects that remember

A function forgets everything when it finishes. Sometimes you need something that **remembers**: a counter that keeps its total, a checkpoint that knows how far a run got, a cache that holds results. For that, Python has **classes**. A class is a recipe for making **objects**. Each object keeps its own data, and has its own functions, called **methods**.

```python
class RunningTotal:
    def __init__(self):            # runs once, when an object is made
        self.total = 0             # `self` is this object; `self.total` is data it remembers

    def add(self, amount):         # a method: a function that belongs to the object
        self.total = self.total + amount

    def show(self):
        return f"Rp {self.total:,}".replace(",", ".")
```

Read it top to bottom. `RunningTotal()` makes a new object and runs `__init__`, which gives it a `total` of 0. `a.add(150000)` runs `add` with `self` being `a`, so it changes `a`'s total, and only `a`'s. You never type `self` when you call a method: Python passes the object for you. Inside the class, `self.` is how a method reaches the object's data; without it, `total` would be a plain variable that vanishes when the method ends.

```python
a = RunningTotal()
b = RunningTotal()
a.add(150000)
a.add(90000)
b.add(25000)
print(a.show(), b.show())          # Rp 240.000 Rp 25.000
```

Two objects, two separate totals: that is the whole idea. Two things go wrong the first time:
- **Forgetting `self.` when you set the data** (`counts = {}` instead of `self.counts = {}` in `__init__`). The data vanishes, and the next method stops with `AttributeError: 'OrderTally' object has no attribute 'counts'`.
- **Writing the dict directly under `class ...:`** instead of in `__init__`. Then every object shares that one dict: the same trap as the mutable default argument in Module 0.0.

You will write classes like these: a `Checkpoint` that remembers where a run stopped (Module 1.6), a key-value store with expiry (Module 1.7), a topic with offsets (Module 3.2). Pydantic's `OrderRow` in the next lesson is also a class, but there you only list its fields.

> 🛠 **Try it (12 min, Python).** Write a class `OrderTally` that counts orders per status. `__init__(self)` starts an empty dict in `self.counts`. `add(self, status)` adds one to that status (the counting line from Module 0.0, on `self.counts`). `count(self, status)` returns how many were added for a status, and `0` for a status it has never seen. Then make two tallies: add `"paid"`, `"paid"` and `"cancelled"` to the first and `"paid"` to the second, and print `first.count("paid")`, `first.count("cancelled")`, `second.count("paid")` and `second.count("refunded")`.
>
> **You should see:** `2`, `1`, `1` and `0`: each tally keeps its own counts. If you write `counts = {}` without `self.` in `__init__`, the first `add` stops with `AttributeError: 'OrderTally' object has no attribute 'counts'`; add `self.` and it works.

## @lesson Validate at the boundary with Pydantic
The most reliable pipelines distrust their inputs. Data crosses a **boundary** (a file, an API, a queue) and you convert it from "whatever the sender produced" to "a value my code can rely on". Do this once, at the door; everything after the door can then assume clean data.

**Pydantic v2** is the standard library for this. You describe the shape as a class; Pydantic parses and checks data against it, in compiled Rust code, so it is fast.

```python
from typing import Literal
from pydantic import BaseModel, Field, field_validator

class OrderRow(BaseModel):
    order_id: int = Field(gt=0)
    status: Literal["paid", "shipped", "delivered", "cancelled", "refunded"]
    total_idr: int = Field(gt=0)

    @field_validator("status", mode="before")
    @classmethod
    def normalise_status(cls, v):
        return v.strip().lower() if isinstance(v, str) else v
```

Ideas to understand:

- **Coercion.** By default Pydantic is *lax*: the text `"150000"` becomes the integer `150000`, which is perfect for CSV where everything is text. In **strict** mode (`ConfigDict(strict=True)`) it refuses to convert; use that for typed sources such as JSON APIs where a string in a number field means something is wrong.
- **Constraints** (`gt=0`, `min_length=5`, `Literal[...]`) express business rules declaratively.
- **Validators** (`field_validator`) handle messy-but-recoverable input. `@classmethod` marks a method that receives the class (`cls`) instead of an instance because Pydantic runs `mode="before"` *before* constructing the `OrderRow` object — which is where you strip `"Rp 1.250.000"` down to `"1250000"`, or try `datetime.strptime(v.strip(), "%d/%m/%Y %H:%M")` for formats such as `"31/01/2026 14:03"` before letting Pydantic parse ISO timestamps.
- **Errors are data.** `OrderRow.model_validate(row)` either returns an object or raises `ValidationError`; its `.errors()` lists every problem with the field location and an error type:

```python
# status="teleported", total_idr="-5"
# [{'loc': ('status',), 'type': 'literal_error', ...},
#  {'loc': ('total_idr',), 'type': 'greater_than', 'msg': 'Input should be greater than 0'}]
```

Use that to build a **reason string** for each rejected row. `model_dump(mode="json")` turns a validated object into plain JSON-safe values (a `datetime` becomes ISO text).

The pattern that follows is the **quarantine** (also called dead-letter) queue. Never choose between "crash the whole job on one bad row" and "silently drop it". Write good rows to the output, bad rows to a quarantine file with the original row, its position and the reason, and count both. A human or a later job can inspect and fix the quarantine; nothing is lost, and the main output stays trustworthy. Also decide a **threshold**: if more than, say, 5% of rows are rejected, the job should fail, because that means something upstream changed rather than a few messy rows.

> **Tip:** Validation is not only for files. The same model can validate API responses, messages from a queue, and configuration. One definition of "a valid order", reused everywhere, is itself a small data contract (Module 2.5).

> 💡 **Practice Pause 1 (Data Validation with Pydantic OrderRow):**
> Start building your ETL module by crafting the boundary validation model:
> 1. Open `labs/mod-1-2/etl.py` in your text editor (remember: do not execute directly in bash!).
> 2. Complete the `OrderRow` class and `validate(row: dict)` function. Add validators to clean Rupiah text (`"Rp 1.250.000"` -> `1250000`), normalize status with lowercase/strip, and support both ISO and `DD/MM/YYYY` timestamps.
> 3. Test your model in the terminal:
> `pytest labs/mod-1-2/test_lab.py -k TestOrderRow -v`
> When all TestOrderRow tests are PASSED, your validation boundary is rock solid! Proceed to Lesson 3 on streaming generators.

## @lesson Streaming: keeping memory flat
A computer has far less memory than disk, and a production container often has a few hundred megabytes. A job that loads the whole input into memory works on your test file and dies on the real one. The cure is to process data as a **stream**: read a bit, handle it, write it, forget it.

Python's tool for this is the **iterator**, and the easiest way to write one is a **generator**: a function that uses `yield` (or `yield from` to delegate each item from another iterable) instead of `return` once with a full list.

```python
def read_orders(path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)      # one row at a time
```

Calling `read_orders(path)` does not read anything; it returns a generator. Each time the caller asks for the next item, the function runs until the next `yield`, hands over one row, and pauses. At any moment only one row (plus whatever your code keeps) is in memory, regardless of file size. Two properties surprise newcomers:

- **Laziness hides errors.** Because nothing runs until something consumes the generator, a bug in it appears later and elsewhere than where you created it. A `FileNotFoundError` appears at the first `next()`, not at the call.
- **A generator is used up.** Iterate it twice and the second pass is empty. Create a new one if you need another pass.

Building blocks you will use: `enumerate` (add a row number), `zip`, generator expressions `(f(x) for x in rows)`, and the `itertools` module: `islice` (take the first N), `chain` (join iterables), and from Python 3.12 `batched` (group items into tuples of N, which is how you send rows to a database in chunks of, say, 1,000).

**How much do you actually save?** Measure instead of guessing. On a 120,000-row, 5.8 MB CSV of orders, `tracemalloc` (standard library) reports:

- streaming through the validator and writing as you go: **9 MB peak**
- reading all rows into a list of dicts and validating them into a list: **213 MB peak**, 37 times the file size, because every row becomes a Python dict full of Python objects, each with its own overhead
- for comparison, pandas holds the same file in about 9 MB, because it stores columns compactly; but turn the same data into one Python object per row and the cost explodes

```python
import tracemalloc
tracemalloc.start()
run(big_file, "out.ndjson", "quarantine.ndjson")
current, peak = tracemalloc.get_traced_memory()
print(f"peak {peak / 1e6:.0f} MB")
```

So the lesson is not "pandas is bad" but "know what your data structure costs". Pandas can read in pieces too (`read_csv(..., chunksize=100_000)`), and engines like DuckDB and Polars (Module 2.1) process data larger than memory for you. Use plain streaming Python for row-by-row logic such as validation; use those engines for aggregation.

One thing a stream cannot do for free is **de-duplication**: remembering which ids you saw needs memory proportional to the number of distinct ids. A set of integers is cheap (millions fit comfortably), but know that this is where memory grows, and use the right tool (a database, or a sorted merge) when the id space is huge.

### See it: a generator runs only when asked

Calling a generator function does **not** run its body. Each `next()` runs it up to the next `yield`, then pauses. Watch where the prints appear:

:::trace A generator pauses at each yield
@code
def read_numbers():
    for n in [10, 20, 30]:
        print("producing", n)
        yield n

stream = read_numbers()
print("created, nothing has run yet")
first = next(stream)
print("got", first)
second = next(stream)
print("got", second)
@notes
6 | Calling the function only **creates** the generator (look at `stream` on the right). Nothing inside has run.
7 | So this prints before any "producing" line.
8 | `next()` starts the function body. It runs until the first `yield`.
3 | The first "producing 10" appears only now.
4 | `yield` hands `10` back and **pauses** here. The function's own variables are kept for later.
10 | The second `next()` resumes right after the `yield`: the loop moves on to 20.
:::

:::ask What do the two prints show?
```python
rows = (n * 2 for n in [1, 2, 3])
print(list(rows))
print(list(rows))
```
@options
`[2, 4, 6]` then `[2, 4, 6]`
`[2, 4, 6]` then an error
* `[2, 4, 6]` then `[]`
@why
A generator is **used up** after one pass: the second `list(rows)` finds nothing left. If you need another pass, create a new generator (call the function again).
:::

:::ask `rows = read_orders("missing.csv")` is a generator function. On which line does the `FileNotFoundError` appear?
@options
* later, when something first asks for a row (`next(rows)` or a `for` loop)
on the line that calls `read_orders(...)`
never, generators hide errors
@why
Laziness hides errors: calling the function runs nothing, so the file is only opened when the first row is requested. A bug in a generator shows up later and somewhere else than where you created it.
:::

:::drill python Write a lazy generator
Write `doubled(numbers)` as a **generator** (use `yield`, not `return`) that gives each number times two, one at a time.
@starter
# write your generator below this line

@check
defines("doubled") ## Define a function named doubled with one parameter.
has_node("Yield") ## Use yield: a generator hands items out one at a time.
list(doubled([1, 2, 3])) == [2, 4, 6] ## list(doubled([1, 2, 3])) should be [2, 4, 6].
next(doubled([5, 6])) == 10 ## next(doubled([5, 6])) should be 10: the first item only.
not isinstance(doubled([1]), list) ## It must return a generator, not a finished list.
@hint
```python
def doubled(numbers):
    for n in numbers:
        yield n * 2
```
@solution
def doubled(numbers):
    for n in numbers:
        yield n * 2
:::

:::drill python Keep only the good rows
Write a generator `good_totals(rows)`: for each row (a dict with a `"total"` text) yield the total **as a number**, but skip rows whose total is not a whole number (use `try` / `except ValueError`, never a bare `except`).
@starter
# write your generator below this line

@check
defines("good_totals") ## Define a function named good_totals with one parameter.
has_node("Yield") ## Use yield.
list(good_totals([{"total": "100"}, {"total": "x"}, {"total": "250"}])) == [100, 250] ## With totals "100", "x", "250" it should give [100, 250]: the bad one is skipped.
list(good_totals([])) == [] ## An empty input gives nothing.
has_node("Try") ## Use try / except ValueError.
@hint
```python
def good_totals(rows):
    for row in rows:
        try:
            yield int(row["total"])
        except ValueError:
            pass
```
(Skipping is fine **here** because this is a drill; in a real pipeline the bad row goes to quarantine, as the next lesson shows.)
@solution
def good_totals(rows):
    for row in rows:
        try:
            yield int(row["total"])
        except ValueError:
            pass
:::

> 💡 **Practice Pause 2 (Data Streaming with read_orders Generator):**
> Create a memory-efficient data reader that never loads whole files into RAM:
> 1. In `labs/mod-1-2/etl.py` in your text editor, locate the `read_orders(path)` function.
> 2. Implement a lazy generator using `with open(path, newline="", encoding="utf-8") as f:` and `csv.DictReader(f)` with `yield from` (never convert it to `list(csv.DictReader(f))`).
> 3. Test memory consumption and generator laziness in the terminal:
> `pytest labs/mod-1-2/test_lab.py -k TestStreaming -v`
> When TestStreaming tests are PASSED (peak memory stays flat under 30 MB even across 120k rows), your stream is ready! Proceed to Lesson 4 on retries and idempotency.

## @part Making it reliable

## @lesson Errors, retries and idempotency
**Catch specific exceptions, handle what you can, let the rest fail loudly.** `except Exception: pass` is the most expensive line you can write, because it turns every future bug into silent data loss. Catch the narrowest type (`ValidationError`, `FileNotFoundError`), do something deliberate (quarantine, retry, exit with a code), and add context when re-raising: `raise RuntimeError("loading orders failed") from exc` keeps the original traceback attached.

**Distinguish two kinds of failure:**

1. **Bad data** (a negative total). Retrying will never fix it. Quarantine it.
2. **Transient failures** (a timeout, a rate limit, a dropped connection). Retrying probably will fix it, after a pause.

Retry the second kind with **exponential backoff and jitter**: wait 1 s, then 2 s, then 4 s, each multiplied by a random factor so that many clients do not retry at the same instant. Always cap the number of attempts and re-raise at the end.

```python
def retry(fn, attempts=4, base=0.5, retry_on=(ConnectionError, TimeoutError)):
    for n in range(1, attempts + 1):
        try:
            return fn()
        except retry_on:
            if n == attempts:
                raise
            time.sleep(base * 2 ** (n - 1) * (0.5 + random.random()))
```

(Only retry operations that are **safe to repeat**. Retrying a payment without an idempotency key charges twice.)

That brings us to **idempotency**, introduced in Module 0.2: running the job twice must leave the same result as running it once. Techniques you can apply today:

- **Deterministic output.** Same input gives byte-identical output: keep input order, `json.dumps(..., sort_keys=True)`, no timestamps of "now" inside the data.
- **Atomic writes.** Write to `output.tmp` and `os.replace("output.tmp", "output")` at the end. A reader sees the old complete file or the new complete file; a crash mid-run leaves the old one intact. Clean up `.tmp` files in a `try/except` so a failed run leaves nothing behind.
- **Replace, don't append.** Write a day's output to a path that contains the date and overwrite it, instead of appending to one growing file.

These three are exactly what Lab 1.2 tests.

### See it: quarantine, do not drop

Bad data is not retried and not thrown away: it is **set aside with a reason**. Watch three rows go through:

:::trace Clean rows continue, bad rows are quarantined
@code
rows = [{"id": 1, "total": "100"}, {"id": 2, "total": "-5"}, {"id": 3, "total": "x"}]
clean = []
quarantine = []
for row in rows:
    try:
        total = int(row["total"])
        if total <= 0:
            raise ValueError("total must be positive")
        clean.append(row["id"])
    except ValueError as exc:
        quarantine.append({"id": row["id"], "reason": str(exc)})
print(clean, quarantine)
@notes
6 | `int("x")` fails right here for row 3. Rows 1 and 2 pass this line.
8 | Row 2 converts fine but breaks a business rule, so the code raises on purpose.
9 | Only a row that got through both checks reaches `clean`.
11 | A rejected row is **kept**, together with the reason. Nothing disappears silently.
:::

:::ask Which of these failures is worth retrying?
@options
a negative order total
a missing column in the CSV header
* a connection timeout while calling an API
@why
**Transient** failures (a timeout, a rate limit, a dropped connection) will probably succeed after a pause. **Bad data** (a negative total, a missing column) will fail the same way every time: retrying wastes time, so quarantine it or fail loudly.
:::

:::ask The job crashes halfway through writing `output.tmp`, and the last step `os.replace("output.tmp", "output")` never runs. What does a reader of `output` see?
@options
* the old, complete file
half of the new file
nothing, the file is deleted
@why
That is the point of the atomic write: the new data is built beside the real file and swapped in with one step at the end. A crash leaves the old complete file intact, so a reader never sees a half-written one.
:::

:::drill python Retry, then give up
`make_flaky` is given: it makes a function that raises `ConnectionError` a few times and then works. Write `retry(fn, attempts=3)`: call `fn()` and return its result; when it raises `ConnectionError`, try again, up to `attempts` calls in total; after the last failed attempt, **raise** the error again. Any other kind of error must not be retried.
@starter
def make_flaky(failures):
    """A function that raises ConnectionError `failures` times, then returns "ok"."""
    def flaky():
        flaky.calls += 1
        if flaky.calls <= failures:
            raise ConnectionError("network blip")
        return "ok"
    flaky.calls = 0
    return flaky

# write retry(fn, attempts=3) below this line

@check
defines("retry") ## Define retry(fn, attempts=3).
retry(make_flaky(0)) == "ok" ## A function that works the first time gives its result.
retry(make_flaky(2), 4) == "ok" ## A function that fails twice and then works should succeed with 4 attempts.
(lambda f: (raises_error(ConnectionError, retry, f, 3), f.calls)[1] == 3)(make_flaky(10)) ## When it always fails, retry must call it exactly 3 times and then raise the ConnectionError again.
raises_error(ValueError, retry, lambda: int("x"), 3) ## A ValueError is bad data, not a network blip: it must be raised at once, not retried.
@hint
```python
def retry(fn, attempts=3):
    for n in range(1, attempts + 1):
        try:
            return fn()
        except ConnectionError:
            if n == attempts:
                raise
```
@solution
def make_flaky(failures):
    """A function that raises ConnectionError `failures` times, then returns "ok"."""
    def flaky():
        flaky.calls += 1
        if flaky.calls <= failures:
            raise ConnectionError("network blip")
        return "ok"
    flaky.calls = 0
    return flaky


def retry(fn, attempts=3):
    for n in range(1, attempts + 1):
        try:
            return fn()
        except ConnectionError:
            if n == attempts:
                raise
:::

> 💡 **Practice Pause 3 (Idempotent Pipeline & Quarantine run):**
> Assemble the complete ETL workflow that is safe to re-run:
> 1. In `labs/mod-1-2/etl.py` in your text editor, implement the `run(input_path, output_path, quarantine_path)` function.
> 2. Use atomic writes (write to temporary `.tmp` files then swap with `os.replace`), track duplicate `order_id` using a set, stream clean records to `output_path` (sorted-key NDJSON), and route failed rows to `quarantine_path` capturing the rejection reason.
> 3. Test the pipeline in the terminal:
> `pytest labs/mod-1-2/test_lab.py -k TestRun -v`
> When all TestRun tests are PASSED, your pipeline is idempotent and resilient against bad data! Proceed to Lessons 5 & 6 on logging (`TestLogging`) and testing.

## @lesson Logging and run summaries
`print` is for scripts; **`logging`** is for jobs. It adds timestamps, severity levels and routing (to a file, to the console, to a collector), and lets whoever runs your job choose how much to see without editing code.

```python
import logging
logger = logging.getLogger("kopiku_etl")        # one logger per module/package

logger.info("read=%d valid=%d duplicates=%d invalid=%d", read, valid, dup, invalid)
logger.error("reject rate %.2f%% is above the limit", rate * 100)
```

Configure it once at the entry point (`logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")`) and never in library code. Pass values as arguments (`%d`), not by building the string yourself, so formatting happens only if the message is emitted.

Levels in practice: `DEBUG` (detail for developers), `INFO` (normal milestones and the **run summary**), `WARNING` (odd but handled), `ERROR` (the job failed or a record was lost). Do not log every row; log counts. Never log secrets or personal data.

The most useful single log line in any pipeline is the **run summary**: how many rows were read, how many were valid, how many rejected and why, how long it took. It is your first and cheapest monitoring: a sudden change in those numbers between nights is often the first sign of an upstream problem, which is why the lab asks you to log it and the exit code reflects the reject rate.

> 🛠 **Try it (12 min, Python).** Extend `run` from the previous Try it: call `logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")` once, in the entry point, and log the run summary as one INFO line with `read`, `valid`, `duplicates` and `invalid`. Count a row as invalid when its `total_idr` is not plain digits (so `Rp 150.000` and negative numbers are invalid here), and as a duplicate when it is valid and its `order_id` was already seen. If the invalid share is above 1%, log an ERROR and exit with `sys.exit(1)`.
>
> **You should see:** a line like `2026-.. INFO read=3634 valid=3545 duplicates=35 invalid=54`, then an ERROR (54 of 3,634 is about 1.5%) and `echo $?` printing `1`. The same run with `print` would have no time, no level and no way to be filtered or alerted on. In your lab, check your summary log line with `pytest labs/mod-1-2/test_lab.py -k TestLogging -v`.

## @lesson Testing data code with pytest
Tests are how you change code without fear. For data jobs they also document, in executable form, what "correct" means. **pytest** is the standard tool: put functions named `test_*` in files named `test_*.py` and run `pytest`.

```python
def test_status_is_normalised():
    assert validate({**GOOD, "status": " PAID "}).status == "paid"
```

Notice `{**GOOD, "status": " PAID "}` creates a shallow copy of the baseline `GOOD` dictionary with `"status"` replaced, so tests never mutate shared fixtures.

Features worth learning early:

- **`pytest.mark.parametrize`** runs one test body over many cases, which is perfect for messy-data rules:

```python
@pytest.mark.parametrize("raw,expected", [("Rp 1.250.000", 1250000), ("150000", 150000)])
def test_total_accepts_rupiah_text(raw, expected):
    assert validate({**GOOD, "total_idr": raw}).total_idr == expected
```

- **`pytest.raises`** asserts that bad input fails the right way: `with pytest.raises(ValidationError): validate({**GOOD, "total_idr": "-5"})`.
- **Fixtures** (`@pytest.fixture`) build reusable test inputs or resources, with setup and cleanup. The built-in `tmp_path` fixture gives each test its own temporary folder, so tests never share or pollute files. `caplog` captures log messages so you can assert on them; `monkeypatch` temporarily replaces functions or environment variables.

What to test in a pipeline:

1. **Each rule on tiny, hand-made rows**, especially the ugly ones you have seen in real data. Bugs live at the edges.
2. **The whole job on a sample file**, comparing counts with a known truth (the lab's tests compare with the generator's ground truth, not with your own code).
3. **Behaviour, not just values**: that a rerun gives identical output, that a failed run keeps the previous output, that the exit code is right, that memory stays flat.
4. **Regressions**: when a production bug is found, first write a test that reproduces it, then fix it. The bug can never silently return.

Keep tests fast and independent of the network and the clock. A test suite that runs in seconds gets run on every change; one that takes ten minutes is ignored.

> 💡 **Practice Pause 4 (CLI Entrypoint & Full Test Suite):**
> Complete the production command-line interface and run full verification:
> 1. In `labs/mod-1-2/etl.py` in your text editor, complete the `main(argv=None)` function using `argparse`: accept `input`, `output`, `quarantine`, and optional `--max-reject-rate` (default `0.05`). Return exit code `0` on success, `1` if reject rate exceeds threshold, and `2` if input file cannot be read.
> 2. Test CLI and the entire suite in the terminal:
> `pytest labs/mod-1-2/test_lab.py -v`
> 3. Try running the script directly from terminal on KopiKu data:
> `python3 labs/mod-1-2/etl.py data/orders.csv /tmp/clean.ndjson /tmp/quarantine.ndjson`
> When all tests are GREEN (PASSED), you have completed an enterprise-grade defensive Python ETL job! Proceed to Lesson 7 on choosing the right tools.

## @lesson Tooling, dependencies and when Python is the right tool
**Pin your dependencies.** `requirements.txt` with exact or bounded versions (`pydantic>=2.5,<3`) makes builds repeatable; a lock file (`uv`, `pip-tools`, `poetry`) makes them exactly repeatable. An unpinned install that pulls a new major version overnight is a classic cause of "it worked yesterday".

**Automate the boring checks.** A formatter and linter (`ruff` does both) end style debates and catch real mistakes (unused variables, undefined names). A type checker (`mypy`, `pyright`) catches wrong-type bugs. Run them with your tests in CI, and optionally on each commit with `pre-commit`.

**Performance in one paragraph.** CPython runs one thread of Python bytecode at a time (the **GIL**), so threads help for *waiting* work (many network calls, disk reads) but not for CPU-heavy work; for that use multiple processes (`multiprocessing`, `concurrent.futures.ProcessPoolExecutor`) or, better, a vectorised engine. Measure before optimising (`cProfile`, or just timing): the slow part is rarely where you guess.

**Choosing the right tool.** Plain Python is excellent for glue: calling APIs, validating records, moving and reshaping data of moderate size, orchestrating other tools. For **heavy aggregation, joins and analytics on large data**, SQL engines (DuckDB, Module 2.1; a warehouse, Module 2.3) and dataframe engines (Polars, Spark) are far faster and use memory far better than hand-written loops. A good data engineer writes the validation and plumbing in Python and pushes the heavy computation to the engine built for it.

> 🛠 **Try it (10 min, terminal).** In a fresh virtual environment run `pip install ruff`. Save `bad.py` with the lines `import os`, `import json`, `x=1` and `print( x )`. Run `ruff check bad.py`, then `ruff check --fix bad.py`, then `ruff format bad.py` and look at the file. Finally run `pip freeze > requirements.txt` and read its first lines.
>
> **You should see:** one `F401` ("imported but unused") for `os` and one for `json`; the fix removes both imports; the formatter turns the rest into `x = 1` and `print(x)`; `requirements.txt` lists exact versions such as `ruff==0.x.y`. Which of these checks would you want on every pull request?

## @lesson Concurrent I/O, bulk database loading, integration testing, and live-coding patterns {optional}

As you move from small scripts to production data pipelines and technical interviews, four engineering patterns separate a job-ready Data Engineer from a beginner:

**1. Bounded Concurrent I/O (`ThreadPoolExecutor` + Rate Limiting).** Fetching 400 clinic or store API endpoints sequentially at `250 ms` network latency per call takes `100 seconds` of mostly waiting on sockets. Launching 400 threads at once, however, triggers instant `HTTP 429 Too Many Requests` bans or exhausts database connections. Production Python ingestion uses a **bounded worker pool** paired with a thread-safe **Semaphore / token spacing**:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading, time

_rate_lock = threading.Lock()
_next_allowed_ts = 0.0

def throttled_fetch(endpoint: str, fetch_fn, min_interval_sec: float = 0.05) -> dict:
    """Guarantees at most 20 requests/sec across all worker threads."""
    global _next_allowed_ts
    with _rate_lock:
        now = time.monotonic()
        wait = max(0.0, _next_allowed_ts - now)
        _next_allowed_ts = max(now, _next_allowed_ts) + min_interval_sec
    if wait > 0:
        time.sleep(wait)
    return fetch_fn(endpoint)

def fetch_all_bounded(endpoints: list[str], fetch_fn, max_workers: int = 8) -> list[dict]:
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(throttled_fetch, ep, fetch_fn): ep for ep in endpoints}
        for fut in as_completed(futures):
            results.append(fut.result())
    return results
```

**2. Bulk Database Loading vs. Row-by-Row `INSERT`s.** Never load 500,000 rows into PostgreSQL or a cloud warehouse using a Python `for` loop with `cursor.execute("INSERT ...")`. Measured on PostgreSQL 16 with psycopg 3.3, loading 100,000 rows over a local connection took **34 to 39 seconds** as a loop of `INSERT`s, **2.6 seconds** with `executemany()` (psycopg 3 pipelines the statements) and **0.1 seconds** with `COPY`.
- **PostgreSQL:** Stream rows straight into PostgreSQL's `COPY ... FROM STDIN` protocol. In psycopg 3: `with cur.copy("COPY stg_orders (order_id, customer_id, status, total_idr) FROM STDIN") as cp:` and then `cp.write_row(row)` for each row. (Older code uses psycopg2's `cursor.copy_expert(sql, file)` for the same thing.)
- **Cloud Warehouses:** Write Snappy-compressed Parquet chunks and trigger a single bulk load job (`snowflake.connector.pandas_tools.write_pandas`, BigQuery `load_table_from_uri`, or Redshift/Snowflake `COPY INTO`).

**3. Unit Tests vs. End-to-End ELT Integration Tests.**
- **Unit Test (`test_parse_row`):** Calls your pure function `clean_order(raw_dict)` in memory with zero files, network sockets, or databases (`< 1 ms` per test).
- **Integration Test (`test_pipeline_end_to_end`):** Wires a mocked HTTP source + your Pydantic validation gate + an ephemeral SQLite/DuckDB database in `tmp_path`, runs the job twice, and asserts that: (a) valid rows land in the target table with exact integer sums, (b) bad rows land in `quarantine.jsonl`, and (c) the second run produces **zero duplicate rows** (idempotency).

**4. The 5 Canonical Python Data Engineering Live-Coding Interview Patterns.** Most 45-minute Python screens for data engineers test some version of these five:

| # | Interview Pattern | What the Interviewer Is Checking | Key Python Construct |
|---|---|---|---|
| **1** | **Constant-Memory `yield` Streaming & Chunking** | You don't call `.readlines()` or load a 50 GB file into a list. | `def stream_valid(path):` with `yield row` + `itertools.islice` batching |
| **2** | **Exponential Backoff + Jitter & Atomic Checkpointing** | You retry only `429 / 5xx`, honor `Retry-After`, and save state via `os.replace`. | `delay = min(cap, base * (2 ** attempt)) * random.uniform(0.5, 1.0)` |
| **3** | **Nested JSON Flattening & Schema Drift Diffing** | You explode `order -> items[]` into parent/child rows without losing empty-item orders, and flag added/removed keys. | `expected_keys - actual_keys` set algebra + explicit parent/child tuples |
| **4** | **Salted `HMAC-SHA256` PII Tokenization** | You know plain `sha256(phone)` is reversible via rainbow tables and use a secret salt + constant-time comparison. | `hmac.new(salt.encode(), norm_email.encode(), hashlib.sha256).hexdigest()` |
| **5** | **In-Memory Sliding Window / Watermark Eviction** | You maintain rolling 5-minute counts over an event stream by evicting expired timestamps rather than keeping all history in RAM. | `collections.deque` or `heapq` keyed by `event_ts` |

> 🛠 **Try it (15 min, Python).** Fake an API call with `def fetch(ep): time.sleep(0.25); return {"ep": ep}` and fetch 40 endpoints three ways: a plain loop, `fetch_all_bounded` above with 8 workers and no throttle, and the same with the 20-per-second throttle. (Give `fetch_all_bounded` a `min_interval_sec` parameter that it passes on to `throttled_fetch`, so `0` switches the throttle off.) Time each with `time.perf_counter()` and check that all three return 40 results. Before running, predict the three times from the numbers alone.
>
> **You should see:** about `10.0` s for the loop (40 × 0.25 s), about `1.25` s with 8 workers (5 waves of 8), and about `2.2` s with the throttle: the 40th request may not start before 39 × 0.05 = 1.95 s, whatever the pool size, and then takes its 0.25 s. The throttle, not the pool, sets the speed once the API has a rate limit. Measured with Python 3.14.

## @part Working on a team

## @lesson Pre-commit hooks, virtual environments, and Agile data team pull requests {optional}

On a real data engineering team, you rarely work alone on the `main` branch. Every change goes through a feature branch (`git switch -c feat/add-store-scd2`), automated **pre-commit hooks** on your laptop, a **GitHub Actions CI** run, and a **Pull Request (PR)** reviewed by a teammate.

**1. Automated Pre-Commit Hooks (`.pre-commit-config.yaml`).** Waiting until code reaches GitHub to discover that you accidentally staged a 200 MB CSV export, left a private API key in a script, or broke Python formatting wastes everyone's time. The `pre-commit` framework runs fast local checks *before* `git commit` is allowed to succeed:

```yaml
# .pre-commit-config.yaml — runs automatically on every `git commit`
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: check-added-large-files
        args: ['--maxkb=500']          # Blocks accidental commit of raw CSV/Parquet dumps
      - id: detect-private-key         # Blocks PEM/SSH/API private keys before they enter Git history
      - id: check-yaml                 # Validates dbt schema.yml and GitHub Actions workflows
      - id: end-of-file-fixer
      - id: trailing-whitespace

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff                       # Fast Rust-based Python linter (replaces flake8 + isort)
        args: [--fix]
      - id: ruff-format                # Deterministic Python formatter (replaces black)
```

Once you run `pip install pre-commit && pre-commit install`, Git runs those seven checks automatically on every commit, and the commit stops if one fails.

**2. Modern Environment Isolation (`venv` and `uv`).** Whether a team uses standard `python3 -m venv .venv` with `requirements.txt` or modern `pyproject.toml` with `uv` (`uv venv && uv pip sync`), the rule is identical: **one project, one isolated environment, pinned versions committed to Git, virtual environment directory ignored in `.gitignore`**.

**3. How Data Engineers Write Pull Requests in Agile Sprints.** A software engineer's PR screenshot shows a UI button; a **data engineer's PR description must show data proof**. When you open a PR on a real team, include four lines in the summary:
- **Grain & Contract:** What is the primary key of the new/modified table, and did the grain change?
- **Row & Money Reconciliation Proof:** Before vs. after row count and key metric sum (e.g., `fact_orders: 3,599 rows before -> 3,599 rows after; net_revenue_idr: Rp 1,208,770,000 -> Rp 1,208,770,000 (0.00% drift)`).
- **Query Cost / Runtime Impact:** Bytes scanned or execution time before vs. after (e.g., `BigQuery dry-run scan dropped from 42.1 GB to 1.4 GB via date partition pruning`).
- **Backfill & Rollback Plan:** Does merging this PR require a historical backfill (`dbt run --full-refresh` or date-range backfill), and how do we revert if downstream BI dashboards break?

> 🛠 **Try it (5 min, terminal).** Inside any Git repo, inspect `.git/hooks/`. Even without installing third-party tools, you can create an executable `.git/hooks/pre-commit` shell script (first line `#!/bin/sh`, then `chmod +x .git/hooks/pre-commit`) that runs `git diff --cached --name-only | grep -E '\.(csv|parquet|db)$' && echo "ERROR: Do not commit data files!" && exit 1 || exit 0`. Try `git add` on a dummy `.csv` file and commit it, then do the same with a `.txt` file.
>
> **You should see:** the `.csv` commit stops: the hook prints the file name and `ERROR: Do not commit data files!`, and `echo $?` right after `git commit` shows `1`. The `.txt` commit goes through. If nothing happens, check `chmod +x`: without it Git skips the hook and only prints a `hint:` that it was ignored because it is not executable. Measured with Git 2.53.

## @lab Lab: a validated, streaming, idempotent ETL
Build the production version of the cleaning job from Module 0.2. It reads the dirty KopiKu orders, validates each row with a Pydantic model, writes good rows and quarantined rows to separate files, never holds the file in memory, can be run twice safely, and signals success or failure with its exit code. Tests are written for you, and they check behaviour (memory, repeat runs, failures), not just values.

### @steps
1. Set up (continue in your `~/kopiku` project from Module 0.1, or work inside the course repository). Install the requirements and generate the data:

```bash
python -m pip install -r labs/mod-1-2/requirements.txt
python3 labs/shared/shopgen.py --out data
```

2. Read `labs/mod-1-2/test_lab.py` first. It is the specification. Notice what it checks for: counts against the generator's ground truth, memory under 30 MB on a 120,000-row file, byte-identical outputs on rerun, previous output preserved when a run fails, exit codes 0, 1 and 2.
3. Open `labs/mod-1-2/etl.py` and implement, in this order, running the tests after each step:
   `OrderRow` (constraints and validators), then `validate`, then `read_orders` (a generator), then `run`, then `main`.
4. In `run`, use the quarantine pattern: for each row either write it to the output or write `{"row", "reason", "raw"}` to the quarantine, and count what happens. Build the reason from the first validation error. Do the duplicate check only for rows that validated.
5. Make `run` atomic: write to `<path>.tmp` files and `os.replace` them at the end; in a `try/except` remove the temporary files and re-raise on any failure.
6. Run the tests, then run the program on the real data and look at the quarantine:

```bash
pytest labs/mod-1-2 -v
python labs/mod-1-2/etl.py data/orders.csv clean.ndjson quarantine.ndjson; echo "exit code: $?"
head -3 quarantine.ndjson
```

7. Stretch goals: add `--max-reject-rate` handling that logs an error and returns 1; add a retry helper and a test that uses `monkeypatch` to simulate two failures before success; add type hints and run `mypy`.

### @files
- labs/mod-1-2/etl.py :: Your working file: fill in the TODOs :: starter
- labs/mod-1-2/test_lab.py :: The specification, as pytest tests :: test
- labs/mod-1-2/requirements.txt :: Dependencies for the lab :: config
- labs/shared/labtools.py :: Helper that loads your module and generates the data :: data
- labs/mod-1-2/reference/etl.py :: One possible solution (try first!) :: reference

### @deliverables
- `pytest labs/mod-1-2` passes (28 tests)
- Running the program on `data/orders.csv` prints a log summary line and writes both output files
- You can explain why the memory test would fail if `read_orders` returned a list

### @verify
```bash
pytest labs/mod-1-2 -v
```

Compare with a known-good run: `LAB_DIR=reference pytest labs/mod-1-2 -v`. If the memory test fails, you are probably holding all rows at once; use `tracemalloc` as shown in the lesson to find where.

## @chaos The revenue that lost 1% without an error
### @scenario
A pandas job loads the daily orders file and reports revenue. After a refactor, everything runs without errors, but the finance team notices that the dashboard is consistently about 1% below the payment provider's figures. The gap does not grow or shrink and no one can explain it. Tests pass because they use a small clean sample.

The relevant line is: `df["total_idr"] = pd.to_numeric(df["total_idr"], errors="coerce")`, followed by `df["total_idr"].sum()`.

### @cause
About 1% of the real rows have the total written as text such as `Rp 1.250.000`. With `errors="coerce"`, pandas turns any value it cannot parse into **NaN** instead of raising an error, and `sum()` skips NaN by default. The unparseable rows silently contribute zero. The developer added `errors="coerce"` to stop an earlier crash, which "fixed" the symptom and hid the data problem.

The pipeline had no validation at the boundary, no count of unparseable values, and no reconciliation against an independent total.

### @fix
1. Remove `errors="coerce"`, or keep it only if you immediately count and handle the NaNs: `bad = df["total_idr"].isna().sum()`, and fail or quarantine when `bad > 0`.
2. Parse known formats explicitly (strip `Rp` and the thousands dots) and send everything else to a quarantine with the original value.
3. Validate rows at the boundary with a model (as in this module) so a bad value has a name, a position and a reason.
4. Add a test using a row with a currency-formatted total; the clean sample hid the bug precisely because it contained no ugly rows.
5. Reconcile output totals against an independent source and alert on differences.

### @pattern
Never convert an error into a missing value without counting it. Silent coercion turns a loud, fixable failure into a quiet, permanent loss.

## @quiz
### Why does a generator-based `read_orders` keep memory flat on a very large file?
- [ ] It compresses each row in memory, so the whole file occupies much less space than usual
- [x] It hands over one row at a time, so only the current row is held in memory at any moment
- [ ] It reads the file in a background thread, which frees the memory used by the main thread
- [ ] It stores the rows on disk in a temporary file and reads them back only when they are printed

> A generator runs until `yield`, returns one item and pauses. Rows already processed are not retained, so memory depends on one row, not on file size.

### In Pydantic v2, what does `@field_validator("total_idr", mode="before")` allow you to do?
- [ ] Skip validation of the field entirely when the incoming value is of type string
- [ ] Run your function after the field has been parsed, so it can inspect the final integer
- [x] Clean the raw input before Pydantic parses it, for example `Rp 1.250.000` to `1250000`
- [ ] Define a default value that is used whenever the incoming row does not contain the field

> A before-validator receives the raw value, so it can strip symbols and formats. Pydantic then performs its normal parsing and constraint checks on the cleaned value.

### What is the main purpose of a quarantine (dead-letter) file in a validation pipeline?
- [ ] It makes the pipeline run faster because rejected rows do not need to be checked again
- [ ] It guarantees that rows with errors are repaired automatically before the next scheduled run
- [x] It keeps rejected rows with reasons, so nothing is silently lost and the output stays clean
- [ ] It stores a backup copy of every valid row so that the output can be rebuilt after a crash

> Crashing on one bad row or silently dropping it are both bad choices. A quarantine preserves the evidence for inspection and repair, and counts of rejects can alert you to upstream problems.

### Which kind of error should a job retry with exponential backoff?
- [ ] A row with a negative total, because the next attempt may read a different value
- [ ] A schema mismatch between the file and the model, because it may fix itself overnight
- [x] A network timeout when calling an API, which is safe to call again with the same request
- [ ] A syntax error in your own code, which can sometimes vanish after the interpreter restarts

> Retries help with transient failures. Bad data and bugs are deterministic: the same input fails the same way every time. Also retry only operations that are safe to repeat.

### How do you make a job's file output safe against a crash halfway through writing?
- [ ] Write directly to the final file and call `flush()` after every row that is written
- [x] Write to a temporary file and use `os.replace` to move it into place when finished
- [ ] Open the final file in append mode so that earlier content is never overwritten
- [ ] Wrap the write loop in `try/except Exception: pass` so that a crash is never raised

> A rename on the same file system is atomic. Readers see either the old complete file or the new complete file. A crash before the rename leaves the old output untouched.

### Your code does `except Exception: pass` around the parsing of each row. What is the main risk?
- [ ] The interpreter becomes slower because every exception must be created and stored
- [ ] Python raises a warning on start-up because bare exception handlers are not allowed
- [x] Every future bug there is swallowed, so wrong results appear without any sign of trouble
- [ ] The program will no longer be able to run in a container because the exit code stays at zero

> Swallowing all exceptions turns errors into silent data loss. Catch specific exceptions, handle them deliberately, and count what you handled.

### What does `pytest.mark.parametrize` give you?
- [ ] It runs the test suite in parallel across the available CPU cores to finish faster
- [ ] It records the arguments of each function call so that failing tests can be replayed
- [x] It runs the same test body over a table of inputs and expected outputs, one test per row
- [ ] It generates random inputs automatically to search for cases that your code cannot handle

> Parametrisation is ideal for rules over messy data: add one line per case instead of copying a test. Each case is reported separately.

### `pd.to_numeric(col, errors="coerce")` followed by `col.sum()` is dangerous on unvalidated data. Why?
- [ ] `coerce` converts every value to a string first, which makes the sum slower than usual
- [ ] `sum()` raises an exception for columns that were created by `to_numeric`
- [x] Unparseable values become NaN, and `sum()` skips NaN, so rows silently contribute zero
- [ ] `to_numeric` changes the original CSV file on disk, which corrupts later reads of the data

> The error is converted into a missing value that later aggregations ignore. Count the NaNs and fail or quarantine instead of coercing silently.

## @resources
- [Pydantic documentation](https://docs.pydantic.dev/latest/)
- [pytest documentation](https://docs.pytest.org/en/stable/)
- [Python docs: logging HOWTO](https://docs.python.org/3/howto/logging.html)
- [Python docs: itertools](https://docs.python.org/3/library/itertools.html)
- [Python docs: tracemalloc](https://docs.python.org/3/library/tracemalloc.html)
