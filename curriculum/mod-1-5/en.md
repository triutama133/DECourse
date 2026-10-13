---
title: pandas for Data Engineers: Clean, Reshape and Summarise Data
duration: 2 weeks
summary: Learn the part of pandas that data engineers use every day: loading files with the right types, finding what is wrong with them, cleaning with whole-column operations instead of loops, grouping, pivoting and ranking, joining without multiplying rows, and keeping memory under control with categories, chunks and Parquet. You clean a deliberately messy orders export and check every number.
why: Tutorials show pandas on a tidy CSV and loop over rows with apply. Real files have leading zeros that disappear, dates that are not dates and duplicates from retried exports, and a row-by-row loop that takes 6 seconds on a million rows is the difference between a pipeline that finishes and one that does not.
---

## @outcomes
- Explain what a DataFrame, a Series, an index and a dtype are, and when pandas is the right tool compared with SQL or Spark
- Load a CSV with explicit types so that ids keep their leading zeros, missing markers are recognised and bad dates become missing values
- Profile a file for nulls and duplicates before changing anything, and clean it with vectorised operations rather than row-by-row loops
- Group, aggregate, pivot and rank data, and add running totals and gaps per customer
- Join two tables with a merge that cannot silently multiply rows, and find the rows that did not match
- Reduce memory with categories and smaller integers, read a file in chunks, and choose Parquet over CSV

## @prereq
Modules 0.0 and 0.1 (Python functions, loops, virtual environments) and 0.3 (SQL grouping and joins). The lab needs `pandas` and `pyarrow` in your virtual environment (`pip install -r labs/mod-1-5/requirements.txt`).

## @lesson What pandas is, and when to use it
**pandas** is the Python library for working with tables in memory. Its two core objects are:

- a **Series**: one column, a list of values with a label for each value (the **index**) and one **dtype** (the type of every value: `int64`, `float64`, text, datetime, ...);
- a **DataFrame**: a table, which is a set of Series sharing one index. Each column has its own dtype.

If you know SQL you already know most of the ideas, only the spelling changes:

| SQL | pandas |
|---|---|
| `SELECT a, b` | `df[["a", "b"]]` |
| `WHERE x > 3` | `df[df["x"] > 3]` (a **boolean mask**) |
| `SELECT a * b AS c` | `df.assign(c=df["a"] * df["b"])` |
| `GROUP BY k` with `SUM`, `COUNT` | `df.groupby("k").agg(...)` |
| `JOIN` | `df.merge(other, on=..., how=...)` |
| `ORDER BY x DESC` | `df.sort_values("x", ascending=False)` |
| `ROW_NUMBER() OVER (PARTITION BY k ...)` | `df.groupby("k").cumcount() + 1` |

The mental model that matters most: **pandas works on whole columns at once.** `df["quantity"] * df["unit_price_idr"]` multiplies a million pairs in one call, in compiled code. You almost never write a `for` loop over rows. We will measure how much that matters in lesson 3.

**When is pandas the right tool?** Use it when the data fits in memory on one machine (lesson 6 shows how to estimate that), when you are exploring, cleaning or reshaping files, when you write a small transformation in Python, and when you need to test logic quickly. Prefer **SQL in a warehouse or DuckDB** when the data already lives there, because the engine reads only what it needs and you avoid copying data out. Prefer **Spark** (Module 3.1) when one machine is not enough. A data engineer uses all three; pandas is the sharpest tool for the first look at a new file and for the small steps in between.

Two habits to start with. First, **look before you change**: `df.head()`, `df.dtypes`, `df.shape`, `df.isna().sum()`, `df["country"].value_counts()`. Second, **never edit in place without a reason**: build a new frame from the old one (`assign`, `rename`, `dropna`), which also makes your function easy to test, as in the lab.

## @lesson Loading a file correctly
`pd.read_csv("orders.csv")` works on a clean file and quietly damages a messy one. A file has no types; pandas **guesses**, and the guess is what causes the trouble. Four things to set yourself:

1. **Ids are text, not numbers.** A customer id like `00042` is a label, not a quantity. Read it as a number and pandas stores `42`: the leading zeros are gone, and a join against the customer table (which has `"00042"`) fails or, worse, matches the wrong rows. In our messy orders file the first customer id read by default is `211` instead of `00211`, and merging on it raises `ValueError: You are trying to merge on int64 and str columns`. Fix: `dtype={"customer_id": "string"}`.
2. **Missing markers.** pandas already treats an empty cell, `NA`, `N/A` and `null` as missing, but your file may use `-` or `unknown`. Tell it: `na_values=["-"]`. Otherwise one `-` turns the whole price column into text.
3. **Integers that can be missing.** A plain `int64` column cannot hold a missing value, so one empty cell silently turns the whole column into floats (`3.0`). The nullable integer type `"Int64"` (capital I) keeps integers and shows `<NA>`.
4. **Dates are parsed, and failures are handled on purpose.** `pd.to_datetime(col, format="%Y-%m-%d", errors="coerce")` turns text into real datetimes and turns anything that is not a date (`"yesterday"`, `"2026-02-30"`, an empty cell) into `NaT` ("not a time"), instead of crashing a nightly job or, worse, guessing.

Also useful when reading big files: `usecols=[...]` loads only the columns you need, `nrows=1000` previews, and `encoding="utf-8"` should be said out loud (Module 0.0).

**Profile before you clean.** In the lab you write `data_quality_report`, which counts rows, nulls per column and repeated ids. For the 2,080-line export it finds **80 repeated order ids, 25 unusable dates, 37 missing quantities and 30 missing prices**. That is 4% of lines repeated and about 5% unusable, which is normal for a real export and is the reason this step exists. A pipeline that does not count what it removes cannot tell you later why a total changed. Keep such counts: they are your first data quality metric (Module 2.5).

`NaN` deserves a moment. In pandas a missing number is `NaN` (and a missing date `NaT`), and most aggregations **skip** it: `pd.Series([1, None, 3]).sum()` is 4.0 and `.mean()` is 2.0, not 1.33. That is usually what you want and sometimes a trap: a mean over a column that is 30% missing describes the other 70%. Always know how many are missing when you quote a number.

> 💡 **Practice Pause 1 (Loading Data & Data Quality Report):**
> Start building your analytics module with precise type specification:
> 1. Open `labs/mod-1-5/orders_lab.py` in your text editor (remember: do not execute directly in bash!).
> 2. Implement `load_orders(source)` with strict types (`dtype={"order_id": "string", "customer_id": "string"}`, nullable `"Int64"` for quantity, `na_values=["-"]` for float64 unit_price_idr NaNs, and `pd.to_datetime` with `errors="coerce"`).
> 3. Implement `data_quality_report(df)` returning row count, null count per column, and duplicate order id count.
> 4. Test in the terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestLoad or TestQualityReport" -v`
> When tests show PASSED, proceed to Lesson 3 for vectorised data cleaning!

## @lesson Cleaning with whole-column operations
Cleaning is a short list of repeated moves. Each has a vectorised form:

- **Text**: the `.str` accessor applies a string method to every value: `df["country"].str.strip().str.upper()`. In our export the country appears as `" id"`, `"Id"`, `"ID "` and `"ID"`; after one line there is one value.
- **Dates**: the `.dt` accessor: `df["order_date"].dt.strftime("%Y-%m")`, `.dt.month`, `.dt.day_name()`.
- **Duplicates**: `df.drop_duplicates(subset="order_id", keep="first")`. Decide the **key** (the order id, not the whole row) and which copy wins.
- **Missing**: `df.dropna(subset=[...])` to drop rows that are unusable for your purpose, or `fillna(value)` to give a default. Dropping is a decision about the data, so count what you drop.
- **Filtering**: a boolean mask, `df[df["status"] == "paid"]`; combine masks with `&`, `|`, `~` and brackets: `df[(df["status"] == "paid") & (df["quantity"] > 1)]`.
- **New columns**: `df.assign(revenue_idr=df["quantity"] * df["unit_price_idr"])`.
- **Types**: `astype("int64")`, `pd.to_numeric(..., errors="coerce")`.

**Why not `apply`?** `df.apply(lambda row: row["quantity"] * row["unit_price_idr"], axis=1)` gives the right answer and is how many tutorials write it. We measured it on a table of **1,000,000 rows**: the column multiplication took **1.8 milliseconds**, the row-by-row `apply` took **5.7 seconds**, about **3,100 times slower**, and a plain `itertuples` loop over just 200,000 rows took 0.9 seconds. The loop runs Python code a million times; the column operation runs one compiled loop. When you feel the urge to write `apply`, search for a built-in: `.str`, `.dt`, `np.where`, `clip`, `map` with a dictionary, `groupby`. The lab tests forbid `apply`, `iterrows` and `itertuples` where a vectorised answer exists, so you learn the habit.

**Do not chain assignments.** `df[df["a"] > 1]["b"] = 9` looks like it updates rows, but the first part returns a (possibly temporary) copy, so the assignment is lost. We ran it on pandas 2.2.3 and 3.0.6: `df["b"]` stays `[0, 0, 0]` and pandas warns. Write it in one step: `df.loc[df["a"] > 1, "b"] = 9`. Better still, avoid editing and build new frames, which is also why the lab's functions return a new frame and leave their input alone (the tests check that).

A final rule: **cleaning is a function**. `clean_orders(raw) -> clean`, a pure function from one frame to another, can be tested with a five-row frame, run again on tomorrow's file, and read by a colleague. A notebook with forty cells that must run in the right order cannot.

> 💡 **Practice Pause 2 (Vectorised Cleaning Without Apply):**
> Clean data efficiently without python loops or apply methods:
> 1. In `labs/mod-1-5/orders_lab.py` in your text editor, implement 3 cleaning functions:
>    - `clean_orders(df)`: standardize text with `.str.strip()` and casing, drop duplicate order_ids (`keep="first"`), drop missing rows, cast quantity to `int64`, and reset index.
>    - `paid_only(df)`: filter rows where status is `"paid"` using boolean masking and reset index.
>    - `add_revenue(df)`: add `revenue_idr = quantity * unit_price_idr` on a DataFrame copy.
> 2. Test in the terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestClean or TestPaidAndRevenue" -v`
> When tests show PASSED, proceed to Lesson 4 for aggregations, pivoting, and ranking!

## @lesson Group, pivot and rank
**`groupby`** is the heart of analytics in pandas: split the table into groups, compute something per group, put the results back. The clearest form is **named aggregation**:

```python
df.groupby("country", as_index=False).agg(
    orders=("order_id", "nunique"),
    revenue_idr=("revenue_idr", "sum"),
    avg_order_idr=("revenue_idr", "mean"),
)
```

Each keyword becomes an output column, defined as `(column, function)`. Notice `nunique`: it is `COUNT(DISTINCT order_id)`. `count` counts non-missing values and `size` counts rows; they differ when there are missing values, so choose on purpose. `as_index=False` keeps the group key as a normal column, which is easier to merge, test and write out later.

**Pivot tables** turn one column's values into columns: revenue by month (rows) and country (columns). `pivot_table(index=..., columns=..., values=..., aggfunc="sum", fill_value=0)` does it. The `fill_value=0` matters: a month with no sales in a country would otherwise be `NaN`, which charts and later sums treat differently from zero. Is "no sales" a zero or an unknown? Decide, then write it down.

**Windows without a window function.** SQL's `ROW_NUMBER`, running totals and `LAG` have direct equivalents once you sort and group:

```python
out = df.sort_values(["customer_id", "order_date", "order_id"])
by_customer = out.groupby("customer_id")
out["order_number"] = by_customer.cumcount() + 1                 # 1, 2, 3 ... per customer
out["revenue_to_date"] = by_customer["revenue_idr"].cumsum()      # running total
out["days_since_previous"] = by_customer["order_date"].diff().dt.days   # LAG-style gap
```

The sort comes first and **including a tie-breaker** (`order_id`) makes the result the same every time, which is what a test needs. **Top N per group** is the same idea: sort by value descending inside each group, then keep rows whose `cumcount() + 1` is at most N. Ties need a rule (in the lab, product name A to Z), otherwise two runs on identical data can disagree.

Check your aggregates against an independent calculation. The lab tests recompute every total with plain Python over the correct rows and compare; in your own work, spot-check one group by hand and compare the grand total with the source (Module 2.5). A groupby that silently drops rows with a missing key (`groupby` skips `NaN` keys by default) is a classic way to be off by a few percent without noticing.

> 💡 **Practice Pause 3 (Aggregations, Pivots, & Window History):**
> Build analytical summaries and customer historical metrics:
> 1. In `labs/mod-1-5/orders_lab.py` in your text editor, implement 4 analytical functions:
>    - `revenue_by_country(df)`: named aggregation `groupby` (`nunique`, `sum`, `mean`) sorted descending by revenue.
>    - `monthly_revenue(df)`: pivot table indexed by `"YYYY-MM"` with `fill_value=0`.
>    - `top_products_per_country(df, n=2)`: top N products per country with alphabetical tie-breaking.
>    - `add_customer_history(df)`: compute customer order number (`cumcount() + 1`), cumulative revenue (`cumsum()`), and day gap (`diff().dt.days`).
> 2. Test in the terminal:
> `pytest labs/mod-1-5/test_lab.py -k "revenue_by_country or monthly_revenue or top_products or customer_history" -v`
> When tests show PASSED, proceed to Lesson 5 on defensive table merges!

## @lesson Joining tables without multiplying rows
`orders.merge(customers, on="customer_id", how="left")` is `LEFT JOIN`. The `how` argument selects `inner`, `left`, `right` or `outer`, exactly as in SQL (Module 0.3), and the same trap applies: **the fan-out**. If the right-hand table has the same key twice, every matching left row is repeated.

We measured it on the cleaned orders: 1,911 orders and a customer list where 30 customers were accidentally listed twice. The left join returned **2,187 rows** instead of 1,911, and the revenue column summed to **378,380,000 instead of 331,555,000**, an overstatement of **14.1%**, with no error and a result that looks perfectly reasonable. A dashboard built on this would be wrong and nobody would see why.

The defence is one argument: **`validate="m:1"`** ("many orders to one customer"). Now pandas checks the right-hand keys and raises `MergeError` the moment a key repeats. Use `validate` on every merge you write: `"1:1"`, `"m:1"` or `"1:m"`, whichever you believe is true. It turns an assumption into a test. Also compare `len()` before and after.

Other join habits:

- **Find unmatched rows (an anti-join).** Our orders mention 20 customer ids that are not in the customer list (`00201` to `00220`). `set(orders["customer_id"]) - set(customers["customer_id"])` finds them; or `merge(..., how="left", indicator=True)` adds a `_merge` column showing `left_only` rows. Orphans are a data quality finding to report, not something to hide.
- **Fill deliberately.** After the join, orders with no customer have `NaN` in `tier`. In the lab they become `"unknown"`, a visible category, instead of silently vanishing from a later `groupby` (which skips missing keys).
- **Same key type on both sides.** The int-versus-text problem from lesson 2 appears here as an error; with two text columns that differ by spaces or case it appears as *zero matches* and no error. Check the match rate right after the join.
- **Different column names**: `left_on="cust"`, `right_on="customer_id"`. **Same names for other columns** get `_x`/`_y` suffixes: pick explicit ones with `suffixes=`.
- **`concat`** stacks tables with the same columns (several daily files into one). Check the columns line up and reset the index.

A last useful tool is `pd.testing.assert_frame_equal(actual, expected)`: it compares two frames and tells you exactly what differs. It is how the lab tests, and how you should test your own transformations.

> 💡 **Practice Pause 4 (Defensive Joins & Orphan Anti-Join):**
> Merge datasets safely without fan-out revenue doubling risks:
> 1. In `labs/mod-1-5/orders_lab.py` in your text editor, implement 2 merge functions:
>    - `join_customers(orders, customers)`: left join with `validate="m:1"` to prevent accidental row multiplication, and fill unmatched customer tiers with `"unknown"`.
>    - `orphan_customer_ids(orders, customers)`: identify customer ids present in orders but missing from customers (anti-join).
> 2. Test in the terminal:
> `pytest labs/mod-1-5/test_lab.py -k "TestJoin" -v`
> When tests show PASSED, your joins are fan-out protected! Proceed to Lesson 6 for memory optimization and Parquet.

## @lesson Memory, chunks and Parquet
pandas keeps the entire table in RAM. How much RAM? More than the file. We generated an orders table of **1,000,000 rows** (a **47.7 MB** CSV) and read it with default settings: on pandas 3.0.6 it occupied **83 MB** in memory (1.75 times the file), and on pandas 2.2.3 **247 MB, 5.2 times the file**, because older pandas stores every text value as a separate Python object. Rule of thumb: **plan for 2 to 10 times the file size**, measure with `df.memory_usage(deep=True).sum()`, and check before you read a 20 GB export on a 16 GB laptop.

**Shrink it.** Columns with few distinct values (country, product, status) can be stored as **categories**: the table keeps each distinct value once and a small integer code per row. Integer columns rarely need 64 bits. On the same million rows, converting low-variety text to `category` and downcasting integers took memory from **78 MB to 40 MB on pandas 3.0.6, and from 242 MB to 84 MB on 2.2.3** (`shrink_memory` in the lab). The values are identical. Do not turn a unique id into a category: it would store one code *and* one label per row, which is bigger. The lab's rule is "fewer distinct values than half the rows".

**Read in chunks.** When the file does not fit, `pd.read_csv(path, usecols=[...], chunksize=100_000)` returns an iterator of DataFrames. For each chunk, compute a **partial result**, then combine the partials:

```python
parts = []
for chunk in pd.read_csv(path, usecols=["country", "quantity", "unit_price_idr"], chunksize=100_000):
    parts.append((chunk["quantity"] * chunk["unit_price_idr"]).groupby(chunk["country"]).sum())
total = pd.concat(parts).groupby(level=0).sum()
```

This works for things you can combine: sums, counts, minimum, maximum. A mean is `sum / count` computed from the combined sums, not a mean of means. **Beware of anything that needs the whole file.** Deduplicating each chunk separately misses duplicates that land in different chunks. In our export the retried lines sit next to each other, so chunks of 100 rows missed just 1 of the 80 duplicates, but if the exporter retried hours later they would be far apart and survive. A median, a global rank and a join of two large files cannot be done chunk by chunk; that is when you move to a database, DuckDB or Spark.

**Use Parquet, not CSV, for data you keep.** CSV is text: it stores `2026-01-15` as ten characters, has no types (lesson 2 existed because of that) and must be read from the first byte to the last. **Parquet** is a binary, **columnar**, compressed format (Module 2.1) that stores types. On the same million rows the Parquet file was **9.1 MB against 47.7 MB** for CSV, about **5 times smaller**, and reading just two columns took **0.03 seconds against 0.27** for CSV (`usecols` still had to scan the whole text file). `df.to_parquet("orders.parquet", index=False)` writes it and `pd.read_parquet(path, columns=[...])` reads only the columns you ask for. Between steps of a pipeline, hand over Parquet, not CSV.

**Testing data code.** The lab shows the habit: each function is small and pure, takes frames in and returns frames out, and has tests built from a few rows whose answer you can work out by hand, plus one test on the realistic file against an independently computed answer. When a function can be tested with five rows, it is simple enough to trust.

> 💡 **Practice Pause 5 (Memory Efficiency, Chunking, & Parquet Format - Lab Complete):**
> Master large-dataset processing techniques and modern columnar storage:
> 1. In `labs/mod-1-5/orders_lab.py` in your text editor, complete the 4 performance functions:
>    - `shrink_memory(df)`: optimize types by converting low-cardinality text (< 50% rows) to `category` and downcasting integers.
>    - `chunked_revenue_by_country(path, chunksize=500)`: process CSV in batches of select columns and combine partial sums without loading the full file.
>    - `write_parquet(df, path)` & `read_parquet_columns(path, columns)`: write Parquet without pandas index and read requested columns.
> 2. Run the complete test suite in the terminal:
> `pytest labs/mod-1-5/test_lab.py -v`
> When all 35 tests show PASSED, your production pandas lab is 100% complete!

## @lab Lab: clean and summarise a messy orders export
Clean the KopiKu orders export with pandas: load it with the right types, profile it, clean it, compute revenue by country and month, rank products, add per-customer history, join the customer list safely, and then make it smaller, read it in chunks and write Parquet. The 35 tests check each function independently against an answer computed in plain Python, and forbid row-by-row loops.

### @steps
1. Create or activate your virtual environment (Module 0.2) and install the lab requirements: `pip install -r labs/mod-1-5/requirements.txt`.
2. Read the top of `labs/mod-1-5/orders_data.py`, write the file with `python3 -c "from orders_data import make_orders; open('orders_raw.csv','w').write(make_orders()[0])"` (run it inside `labs/mod-1-5`), and **explore it before writing code**: `head`, `dtypes`, `isna().sum()`, `value_counts()` on country, how many repeated order ids. Write down what you find.
3. Work through `labs/mod-1-5/orders_lab.py` from the top and run the tests after EACH function:

```bash
pytest labs/mod-1-5/test_lab.py -v
pytest labs/mod-1-5/test_lab.py -v -k "Load or Quality"      # one group at a time
```

4. **Load, report, clean.** Before running `TestClean`, predict how many rows should remain (hint: use your quality report). After it passes, change `keep="first"` to `keep="last"` and see which test notices and why.
5. **Aggregate, pivot, rank, window.** Compare `revenue_by_country` with a SQL `GROUP BY` on the same data (load it into SQLite or DuckDB) and confirm the numbers match.
6. **Join.** Remove `validate` from your merge, make the customer list contain a duplicate and look at the row count. Put `validate` back.
7. **Memory and files.** Call `shrink_memory` and print memory before and after; write Parquet and compare the file size with the CSV.
8. **Do it for real.** Write the whole file again in your own virtual environment **without copying**, then run `python3 scripts/prove.py mod-1-5` to get the proof code for the **Proof** box on this lab page.

### @files
- labs/mod-1-5/orders_lab.py :: Your working file: implement the TODO functions :: starter
- labs/mod-1-5/orders_data.py :: Makes the messy export and the customer list (provided, do not edit) :: config
- labs/mod-1-5/test_lab.py :: The 35 tests :: test
- labs/mod-1-5/requirements.txt :: pandas, pyarrow, pytest :: config
- labs/mod-1-5/reference/orders_lab.py :: One possible solution (try on your own first!) :: reference

### @deliverables
- All 35 tests pass **on your own computer, run from your own terminal, in your own virtual environment**
- You can explain why a customer id must be read as text, and what `na_values` and `errors="coerce"` do
- You can show with a number why `apply` over rows is the wrong tool, and name the built-in that replaces it
- You can explain what `validate="m:1"` protects you from, and what happened to revenue in the fan-out example (+14.1%)
- You can say when pandas stops being the right tool and what to use instead

### @verify
```bash
pytest labs/mod-1-5/test_lab.py -v
python3 scripts/prove.py mod-1-5
```

To run the known-good solution instead, prefix the first command with `LAB_DIR=reference`.

## @chaos The join that doubled the revenue
### @scenario
A small analytics team builds the monthly revenue report in a notebook: load orders, merge in the customer list to get each customer's tier, group by tier, send the table to the finance lead. It runs for months and the totals match the shop's till.

One month the CRM export that produces the customer list is changed: a customer who upgraded now appears on two lines, one for each tier they have had. Thirty customers are affected. Nothing fails. The merge is a normal left join, the notebook runs green, and the revenue table looks as usual, except that the total is **14% higher** than the till. The finance lead notices only because the quarter's bonus calculation is based on the number, and by then three monthly reports have gone out.

### @cause
The merge allowed a **many-to-many** relationship: each order matched two customer rows, so it was repeated, and revenue was summed twice for those customers. pandas does what you ask and has no opinion about whether the result is plausible. Nobody had asked it to check.

Contributing factors: the notebook had no check that the row count after the merge equals the row count before, the "customer list" had no uniqueness test at its source, and no one reconciled the grand total with the source system. The report depended on an assumption (one row per customer) that was true on the day it was written and was never written down as a check.

### @fix
1. **Declare the relationship**: `merge(..., validate="m:1")`. The next run would raise `MergeError` the day the duplicates appeared, and the report would not have gone out.
2. **Assert the row count** after every join (`len(out) == len(orders)`) and write a test that gives the function a duplicated customer and expects an error (the lab does this).
3. **Test uniqueness at the source**: `customer_id` must be unique in the customer table (Module 2.5).
4. **Reconcile the total** against the system of record on every run, and alert on a difference above a small tolerance.
5. **Recalculate the affected reports** from the corrected join and tell the people who used them, with the size of the error.
6. **Resolve the business rule**: if a customer legitimately has several tiers over time, the table needs validity dates and a point-in-time join (slowly changing dimensions, Module 1.4), not a bare merge.

### @pattern
A join is a claim about keys. Write the claim down (`validate=`), check the row count, and reconcile a total with an independent source, so that a wrong result stops the pipeline instead of reaching a dashboard.

## @quiz
### A customer id such as `00042` is read by `pd.read_csv` with default settings. What is stored, and what is the right fix?
- [ ] The text "00042", because pandas always keeps the characters exactly as they appear in the file
- [x] The number 42, so leading zeros are lost; read the column as text with `dtype="string"`
- [ ] A date, because pandas converts any five-digit value to a datetime when it sees one
- [ ] An error, because pandas refuses to read any column that begins with zeros in the file

> pandas guesses numbers for digit-only columns. Ids are labels, not quantities, so declare them as text; otherwise joins against a table that has `"00042"` fail or mismatch.

### What is the main reason to prefer `df["quantity"] * df["unit_price_idr"]` over `df.apply(lambda row: ..., axis=1)`?
- [ ] The column form uses less typing, but both forms run at exactly the same speed on every table
- [ ] `apply` is deprecated, so it raises an error as soon as a table has more than a thousand rows
- [x] One compiled loop runs over the whole column; it was about 3,000 times faster on a million rows
- [ ] The column form is the only one that can handle missing values, since `apply` always fails on `NaN`

> Vectorised operations run in compiled code over the whole column. A Python function called once per row is the slow path: 1.8 ms against 5.7 s on 1,000,000 rows.

### `pd.Series([1, None, 3]).mean()` returns 2.0. Why?
- [ ] pandas replaces the missing value with zero before averaging, which would give 1.33 instead
- [x] Missing values are skipped, so it is (1 + 3) / 2, and you should count how many were skipped.
- [ ] pandas raises a warning and returns the median because it cannot compute a mean of missing data
- [ ] The missing value is treated as the previous value, so the series is read as 1, 1, 3 by default

> Most aggregations ignore `NaN`. That is convenient, but a mean over a mostly-missing column describes only the rows that exist, so always count the missing values.

### Why does `df[df["a"] > 1]["b"] = 9` not reliably update `df`, and what is the safe way to write it?
- [ ] It works as written; the safe version is only a style choice preferred by some teams
- [ ] It fails because column `b` is a reserved name; rename the column and then run the same line
- [x] The first part may return a copy, so the change is lost; use `df.loc[df["a"] > 1, "b"] = 9`
- [ ] It changes the whole column instead of the selected rows; use `df["b"] = 9` to fix that instead

> The chained form assigns into a temporary object. We ran it on pandas 2.2.3 and 3.0.6 and the original stayed unchanged. A single `.loc[mask, column]` assignment is explicit and works.

### An `orders` table is left-joined to a `customers` table in which 30 customers appear twice. What happens?
- [ ] pandas raises an error automatically, because duplicate keys are never allowed in a merge
- [ ] The duplicates are removed quietly, and the number of rows after the join is the same as before
- [x] Matching orders are repeated, so rows and revenue grow with no error unless `validate` is set
- [ ] Only the first matching customer is used and the second is ignored, so the totals remain correct

> This is the fan-out: 1,911 orders became 2,187 rows and revenue rose by 14.1%. `validate="m:1"` makes pandas raise `MergeError` instead.

### You must total revenue per country from a 40 GB CSV on a laptop with 16 GB of memory. Which approach works?
- [ ] Read the whole file at once with the default settings, because pandas compresses data in memory
- [x] Read only the needed columns in chunks and add each chunk's partial sums to the running totals
- [ ] Convert every column to `category`, which makes the whole file fit by definition in any memory size
- [ ] Sort the file first, since sorted data uses less memory than unsorted data in a DataFrame

> `usecols` plus `chunksize` keeps only one chunk in memory, and sums combine across chunks. Operations that need the whole file (median, global rank, big joins) need another tool.

### What makes Parquet a better format than CSV for data that later steps will read?
- [ ] It is plain text that people can open in any editor, so it is easier to review than a CSV
- [x] It stores types and compresses by column; in our test it was 5 times smaller and read faster
- [ ] It is the only format that pandas can write, so every pipeline step must use it for exports
- [ ] It removes duplicate rows automatically, which means no cleaning step is needed before writing

> Parquet stores types and compresses by column, so readers can skip the columns they do not need: 9.1 MB against 47.7 MB, and 0.03 s against 0.27 s for two columns.

### You deduplicate a large file by calling `drop_duplicates` on each chunk separately. What is the risk?
- [ ] None; the result is always identical to deduplicating the whole file at once, whatever the order
- [ ] pandas refuses to run `drop_duplicates` on a chunk, so the call fails with an error immediately
- [x] Duplicates in different chunks are never compared, so some copies survive in the output tables.
- [ ] The chunks are merged back in random order, so the first copy kept differs on every single run

> Deduplication needs the whole key space. Chunking is safe for sums, counts and similar combinable results, not for global operations; use a database or a two-pass approach for those.

## @resources
- [pandas: 10 minutes to pandas](https://pandas.pydata.org/docs/user_guide/10min.html)
- [pandas: merge, join, concatenate (see `validate`)](https://pandas.pydata.org/docs/user_guide/merging.html)
- [pandas: group by (split, apply, combine)](https://pandas.pydata.org/docs/user_guide/groupby.html)
- [pandas: scaling to large datasets](https://pandas.pydata.org/docs/user_guide/scale.html)
- [pandas: copy-on-write](https://pandas.pydata.org/docs/user_guide/copy_on_write.html)
- [Apache Parquet documentation](https://parquet.apache.org/docs/)
