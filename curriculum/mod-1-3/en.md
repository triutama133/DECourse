---
title: Advanced SQL: Window Functions, Recursion and Execution Plans
duration: 3 weeks
summary: Solve real analytical problems with window functions (running totals, top-N, gaps and islands, sessions), recursive queries, and learn to read an execution plan and design indexes so the query is fast on 500,000 rows, not just on ten.
why: Tutorials test SELECT and WHERE on a few rows. In production a query that returned instantly in development scans 100 million rows, because nobody looked at the plan, and the logic needed window functions that were never taught.
---

## @outcomes
- Choose between ROW_NUMBER, RANK and DENSE_RANK, and explain what a window frame is and why the default one surprises people
- Write running totals, moving averages, top-N-per-group, latest-record-per-key and previous-row comparisons with window functions
- Solve gaps-and-islands and sessionization problems with the row-number and cumulative-sum patterns
- Write a recursive CTE for hierarchies and know how it terminates
- Read a PostgreSQL EXPLAIN ANALYZE plan, find the slow step, and design the fewest indexes that fix it
- Translate a query between SQLite, PostgreSQL, DuckDB and the cloud warehouses, and recognise the dialect differences that silently change an answer

## @prereq
Module 0.3 (joins, GROUP BY, NULL, CTEs). Part A of the lab runs in your browser or with Python's built-in SQLite; Part B uses PostgreSQL (an embedded copy is installed by `pip`, so Docker is optional).

## @lesson Window functions: calculate across rows without collapsing them
`GROUP BY` collapses many rows into one. A **window function** computes a value across a set of related rows and **keeps every row**. The syntax is `function(...) OVER (PARTITION BY ... ORDER BY ... frame)`:

- `PARTITION BY` splits the rows into independent groups (like GROUP BY, but rows survive). Omit it and the whole result is one partition.
- `ORDER BY` defines the order *inside* each partition. Many functions need it.
- The optional **frame** says which rows around the current one the function sees.

Example on KopiKu: each order's share of its customer's total, something GROUP BY alone cannot do because we want one output row per order:

```sql
WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items GROUP BY order_id
)
SELECT o.order_id,
       ROUND(100.0 * t.order_total / SUM(t.order_total) OVER (PARTITION BY o.customer_id), 1) AS pct_of_customer
FROM orders o JOIN t ON t.order_id = o.order_id;
```

**Ranking functions** number rows within a partition. They differ only in how they treat **ties**. On orders with totals 85,000 (three orders), 90,000 (two) and 95,000 (two), ordered by total:

| order_total | ROW_NUMBER | RANK | DENSE_RANK |
|---|---|---|---|
| 85,000 | 1 | 1 | 1 |
| 85,000 | 2 | 1 | 1 |
| 85,000 | 3 | 1 | 1 |
| 90,000 | 4 | 4 | 2 |
| 90,000 | 5 | 4 | 2 |
| 95,000 | 6 | 6 | 3 |

- `ROW_NUMBER()` gives every row a unique number, breaking ties arbitrarily unless your `ORDER BY` is unique. Add a tiebreaker (`ORDER BY order_total, order_id`) so results are deterministic.
- `RANK()` gives ties the same rank and then **skips** (1, 1, 1, 4).
- `DENSE_RANK()` gives ties the same rank without skipping (1, 1, 1, 2).
- `NTILE(4)` splits the ordered rows into 4 buckets of nearly equal size (quartiles); if the rows do not divide evenly, the first buckets get one extra.

Pick by the question: "the top 3 *orders*" is ROW_NUMBER; "the orders with the three highest *distinct totals*" is DENSE_RANK.

## @lesson Frames, running totals and the default-frame trap
For aggregates used as window functions (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`), the **frame** says which rows are included. The forms:

```sql
ROWS  BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW   -- from the first row to this one
ROWS  BETWEEN 6 PRECEDING AND CURRENT ROW           -- this row and the 6 before it (7 rows)
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW   -- by VALUE: includes all rows tied with this one
```

`ROWS` counts physical rows. `RANGE` works on the *values* of the ORDER BY column and treats equal values as one unit (called peers). PostgreSQL also has `GROUPS`.

**The trap:** when you write `ORDER BY` inside OVER and **no frame**, the default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. With ties this gives surprising running totals. Same data, two frames:

| order_id | order_total | default frame | `ROWS` frame |
|---|---|---|---|
| 103 | 85,000 | 255,000 | 85,000 |
| 109 | 85,000 | 255,000 | 170,000 |
| 117 | 85,000 | 255,000 | 255,000 |
| 102 | 90,000 | 435,000 | 345,000 |
| 111 | 90,000 | 435,000 | 435,000 |

With the default frame, the three tied rows all show 255,000 because each includes all of its peers. If you want a true row-by-row running total, **write the frame explicitly** (`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`) and use a unique ORDER BY. A related trap: `LAST_VALUE(x) OVER (ORDER BY x)` with the default frame returns the *current* row's value (the last row of its frame), not the partition's last value; add `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.

**Moving average** over the last 7 days per store: `AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`. Note the first six days average over fewer rows; decide whether you want that or `NULL` until a full window exists. Also note `ROWS` assumes one row per day: if some days are missing, "6 preceding rows" is not "6 preceding days". Generate a complete **date spine** (recursive CTE below) first, or use `RANGE` with an interval where your database supports it.

Aggregates over a partition **without** ORDER BY use the whole partition (a total on every row), which is what the share-of-total example used.

## @lesson Looking sideways: LAG, LEAD, latest-per-key and top-N
`LAG(x, n)` returns the value from `n` rows earlier in the partition, `LEAD(x, n)` from `n` rows later; both return NULL at the edges (or a default you supply). They answer "compared with the previous row":

```sql
SELECT customer_id, order_id,
       CAST(julianday(order_date)
            - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id))
            AS INTEGER) AS days_since_prev
FROM orders;
```

(`julianday` is SQLite; in PostgreSQL you subtract dates directly: `order_date - LAG(order_date) OVER (...)`.) `FIRST_VALUE` and `LAST_VALUE` return the first or last row of the frame.

**The latest-record-per-key pattern** is the most useful window trick in data engineering. Whenever a table holds several versions of the same entity (many address changes per customer, repeated events, CDC rows), keep one:

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY effective_ts DESC) AS rn
  FROM customer_changes
)
SELECT * FROM ranked WHERE rn = 1;
```

You cannot put a window function directly in `WHERE`, because windows are computed *after* WHERE, so you compute it in a CTE or subquery and filter outside. Snowflake, BigQuery and DuckDB offer `QUALIFY` as a shortcut (`... QUALIFY ROW_NUMBER() OVER (...) = 1`); PostgreSQL and SQLite do not, so know the portable form. The same pattern with `rn <= 3` gives **top-N per group**, and ordering by an update timestamp makes it the standard **de-duplication** step in pipelines. Make the ORDER BY unique (add a tiebreaker like the id) or the surviving row is arbitrary.

## @lesson Gaps, islands and sessions
Two classic problems show how window functions combine.

**Gaps and islands**: find runs of consecutive values, such as consecutive login days. The trick: for a sorted sequence with no repeats, `date - row_number` is **constant within a run** and changes when there is a gap.

```sql
WITH grouped AS (
  SELECT user_id, login_date,
         julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS grp
  FROM logins
)
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM grouped GROUP BY user_id, grp;
```

For user 1 (logins on March 1, 2, 3, then 5, 6, 7, 8) this yields two islands: 3 days and 4 days. If a date can repeat, de-duplicate first, or `ROW_NUMBER` will break the constant.

**Sessionization**: group a stream of clicks into sessions, where a new session starts after 30 minutes of inactivity. Mark each row that *starts* a session, then take a running sum of the marks:

```sql
WITH flagged AS (
  SELECT user_id, event_time,
         CASE WHEN LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) IS NULL
                OR strftime('%s', event_time)
                   - strftime('%s', LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)) > 1800
              THEN 1 ELSE 0 END AS is_new
  FROM user_clickstream
)
SELECT user_id, event_time,
       SUM(is_new) OVER (PARTITION BY user_id ORDER BY event_time ROWS UNBOUNDED PRECEDING) AS session_id
FROM flagged;
```

The shape is always the same: **flag the boundary, then cumulative-sum the flags to get a group id.** It reappears in event processing (Module 3.3) and in slowly changing dimensions (Module 1.4).

## @lesson Recursive CTEs: hierarchies and sequences
Some data is a tree or a graph: a category tree, an org chart, a bill of materials. The depth is unknown, so a fixed number of self-joins cannot walk it. A **recursive CTE** can:

```sql
WITH RECURSIVE tree AS (
  SELECT id, name, 0 AS depth, name AS path          -- anchor: the roots
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, tree.depth + 1, tree.path || ' > ' || c.name   -- step: children of the previous rows
  FROM categories c JOIN tree ON c.parent_id = tree.id
)
SELECT id, depth, path FROM tree;
```

It runs in rounds. The **anchor** query produces the first rows; then the **recursive** query is applied to the rows produced in the previous round, repeatedly, until a round returns nothing. The result is the union of all rounds. For the KopiKu categories this gives paths like `Coffee > Beans > Single Origin > Gayo` at depth 3.

Two safety rules. **It must terminate**: if the data contains a cycle (A's parent is B and B's parent is A) the query never ends; protect with a depth limit (`WHERE depth < 20`) and, in PostgreSQL, `CYCLE` detection. And keep it cheap: each round should do a small indexed join.

The other everyday use is **generating a sequence**, such as a **date spine** (one row per day, even days with no data), which you then LEFT JOIN facts onto so that quiet days show as zero rather than vanishing:

```sql
WITH RECURSIVE days(d) AS (
  SELECT date('2026-01-01') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < '2026-01-31'
)
SELECT d FROM days;
```

(PostgreSQL has `generate_series` for this; recursion is the portable fallback.)

## @lesson How the database runs your query: reading EXPLAIN
SQL says *what* you want; the database's **planner** decides *how*: which indexes to use, in what order to join, which algorithm to use. It estimates the cost of alternatives from **statistics** (row counts and value distributions per column, refreshed by `ANALYZE`) and picks the cheapest. Your job is to check that its choice is sensible. `EXPLAIN` shows the plan; `EXPLAIN ANALYZE` also **runs** the query and adds actual times and row counts (so wrap writes in a transaction you roll back). In PostgreSQL the useful form is `EXPLAIN (ANALYZE, BUFFERS)`.

A real plan from the lab's 500,000-row `events` table, before any index:

```text
Gather  (cost=1000.00..7776.17 rows=50 width=35) (actual time=0.748..21.027 rows=40 loops=1)
  ->  Parallel Seq Scan on events  (cost=0.00..6771.17 rows=21 width=35) (actual time=1.094..13.300 rows=13 loops=3)
        Filter: (customer_id = 4242)
        Rows Removed by Filter: 166653
        Buffers: shared hit=4167
Execution Time: 21.043 ms
```

Read it from the **innermost, most indented** node outward. `Seq Scan` reads the whole table (4,167 pages here) and throws away 166,653 rows per worker to keep 13: a lot of work for 40 result rows. Add the right index and the same kind of query becomes:

```text
Limit  (cost=0.42..41.40 rows=10 width=35) (actual time=0.028..0.036 rows=10 loops=1)
  ->  Index Scan using idx_events_customer_time on events  (actual time=0.027..0.035 rows=10 loops=1)
        Index Cond: (customer_id = 4242)
        Buffers: shared hit=10 read=3
Execution Time: 0.045 ms
```

Thirteen pages instead of 4,167, and 0.045 ms instead of 21 ms: nearly 500 times faster, on a table that is still small. Things to look for:

- **Scan type**: `Seq Scan` (whole table), `Index Scan` (follow the index, fetch rows), `Index Only Scan` (answer from the index alone), `Bitmap Index/Heap Scan` (collect many matches, then read pages in order). A Seq Scan is *correct* when you need most of the table; it is a smell when you need few rows.
- **Join algorithm**: `Nested Loop` (for each outer row, look up the inner; great when the outer side is small and the inner is indexed), `Hash Join` (build a hash table of one side; the usual choice for large unsorted inputs), `Merge Join` (both sides already sorted).
- **`Sort`** nodes and **`Rows Removed by Filter`**: signs of work an index could avoid.
- **Estimated vs actual rows** (`rows=` in the first parentheses versus the second). When these differ by orders of magnitude the planner is choosing blind. Example: on a table where columns `a` and `b` are always equal, `WHERE a = 7 AND b = 7` was estimated at **15 rows** and returned **2,000**, because the planner assumes the two conditions are independent. Fixes include fresh `ANALYZE`, extended statistics, or rewriting. Always compare these numbers before tuning anything else.
- **`loops`**: actual rows and time are *per loop*; multiply.
- **Cost** units are arbitrary and only comparable within one plan.

> **Tip:** Test on realistic volumes. On 1,000 rows every plan is fast and tells you nothing. Generate data at production scale (the lab does) before you judge a query.

## @lesson Indexes: what they are, which to build, what they cost
An **index** is a separate sorted structure that maps column values to row locations, like the index of a book. The default is a **B-tree**: it supports equality (`=`), ranges (`<`, `BETWEEN`) and ordering (`ORDER BY`), because it keeps keys sorted. Choosing indexes is a design skill with a few rules.

**Composite indexes and column order.** An index on `(customer_id, event_time DESC)` is sorted by customer, then by time within each customer. It can serve a query that filters on `customer_id` (the **leftmost prefix**) and, in the same index, deliver the rows already in time order, so `WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10` reads exactly 10 index entries and needs **no Sort**. It **cannot** help a query that filters only on `event_time`. The rule of thumb: equality columns first, then the range or sort column. In the lab, three index designs gave three plans for that query:

| Index | Plan for `WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10` |
|---|---|
| none | Parallel Seq Scan + Sort, 20 ms |
| `(customer_id)` | Bitmap Heap Scan + **Sort**, 0.10 ms |
| `(customer_id, event_type, event_time DESC)` | Bitmap Heap Scan + **Sort**, 0.08 ms (the extra column in the middle breaks the order) |
| `(customer_id, event_time DESC)` | **Index Scan**, no Sort, 0.06 ms |

**Sargability.** A condition is *sargable* (search-argument-able) if the database can use an index for it. Wrapping the indexed column in a function destroys that: `WHERE date(event_time) = '2026-01-10'` forces a Seq Scan (30 ms in the lab) because the index is on `event_time`, not on `date(event_time)`. Rewrite it as a range on the bare column, `event_time >= '2026-01-10' AND event_time < '2026-01-11'`, which returns the same 14,400 rows via an index in about 3 ms. The same applies to `LOWER(name) = ...`, arithmetic on a column, and a leading wildcard `LIKE '%abc'`. (Alternatively create an *expression index* on the expression.)

**Selectivity.** An index pays off when the predicate picks a small fraction of the table. In the lab `status = 'done'` matches 99.8% of rows, so even with an index the planner correctly chose a Seq Scan; `status = 'pending'` matches 0.2% and used the index. A **partial index** (`CREATE INDEX ... WHERE status = 'pending'`) indexes only the rare rows, making it tiny.

**Other kinds.** A **covering index** (`INCLUDE (...)`) stores extra columns so `Index Only Scan` need not touch the table. A **BRIN** index stores only the min and max per block of pages; on a very large, append-only table whose column correlates with physical order (event time), it works almost like a B-tree at a tiny fraction of the size: in the lab, **24 kB** versus **11 MB** for the B-tree on `event_time`, with the same query time (about 3 ms). Hash, GIN (arrays, JSON, full text) and GiST (geospatial) indexes serve special cases.

**The cost side.** Every index must be updated on every INSERT, UPDATE and DELETE, takes disk space (the `(customer_id, event_time)` index was 15 MB on a 33 MB table) and slows bulk loads. So the goal is the **fewest** indexes that make your real queries fast. The lab enforces it: at most three, and every one must be used. Columnar warehouses and lakehouses (Module 2.1 onward) mostly replace indexes with sorting, partitioning and statistics; the thinking carries over.

Finally, a few query habits that avoid problems before indexes are needed: select only the columns you need (not `*`), filter early, avoid `DISTINCT` as a band-aid for an accidental join fan-out (fix the join), prefer `EXISTS` to `IN (subquery)` for existence tests, be careful with `OR` across different columns, and avoid running a query per row from application code (the "N+1" pattern): one set-based query beats a thousand small ones.

## @lesson One question, many dialects: SQLite, PostgreSQL, DuckDB and the warehouses
SQL is a standard, but every engine speaks its own dialect, and in data engineering you will meet several: SQLite in the sandbox, PostgreSQL in application databases, DuckDB on a laptop, BigQuery or Snowflake in the warehouse (Module 2.6), Spark SQL in the lakehouse. The standard defines a core (SELECT, joins, GROUP BY, window functions, CTEs), and each engine adds functions, types and rules around it. Differences come in two kinds, and the second kind is the dangerous one.

**Differences that fail loudly.** The query errors out, you look it up, you fix it. We ran the same statements on SQLite 3.45, PostgreSQL 16 and DuckDB 1.5:

| Task | SQLite | PostgreSQL | DuckDB |
|---|---|---|---|
| Date plus 7 days | `date(d, '+7 days')` | `d + 7` | `d + 7` |
| Days between two dates | `julianday(b) - julianday(a)` | `b - a` | `b - a` |
| Truncate to month | `strftime('%Y-%m-01', d)` | `date_trunc('month', d)` | `date_trunc('month', d)` |
| Day of week (Saturday is 6) | `strftime('%w', d)` | `EXTRACT(dow FROM d)` | `EXTRACT(dow FROM d)` |
| Join text per group | `group_concat(x, ',')` | `string_agg(x, ',')` | both work |
| Position of text | `instr(x, 'p')` | `strpos(x, 'p')` | both work |
| Case-insensitive match | `LIKE` (ASCII) | `ILIKE` | `ILIKE` |
| `QUALIFY` (filter on a window) | syntax error | syntax error | works |
| Series of numbers | recursive CTE | `generate_series(1, 5)` | `generate_series(1, 5)` |

In the SQL Sandbox you therefore write `group_concat`, `julianday` and `strftime`, and the portable pattern for `QUALIFY` is a window function in a CTE followed by a filter (challenge w-11). The warehouses, from their documentation and not run in this course: BigQuery uses `DATE_DIFF(b, a, DAY)`, `DATE_TRUNC(d, MONTH)`, `STRING_AGG` and backticks for names; Snowflake uses `DATEDIFF('day', a, b)`, `DATEADD(day, 7, d)`, `LISTAGG`; both support `QUALIFY`. A tool such as **sqlglot** translates between dialects: it turned SQLite's `GROUP_CONCAT(name, ',')` into `STRING_AGG(name, ',')` for PostgreSQL and a Snowflake `DATEDIFF('day', a, b)` into `CAST(b AS DATE) - CAST(a AS DATE)`. Treat translators as a first draft to test, not as a guarantee.

**Differences that change the answer silently.** The query runs and the number is different. These cost real money, so learn them:

| Statement | SQLite | PostgreSQL | DuckDB |
|---|---|---|---|
| `SELECT 7 / 2` | **3** | **3** | **3.5** |
| `ORDER BY x` with a NULL (ascending) | NULL **first** | NULL **last** | NULL **last** |
| `'abc' LIKE 'ABC'` | true | false | false |
| `x, y ... GROUP BY x` (y not aggregated) | returns one arbitrary `y` | **error** | **error** |
| `INSERT 'abc'` into an `INTEGER` column | **stored as text** | error | error |
| `CAST('12abc' AS INTEGER)` | **12** | error | error |
| `SELECT "hello"` (double quotes) | the text `hello` if no such column | error | error |
| `SELECT 1 = 1` | `1` | `true` | `true` |

Read the third and fourth rows twice. A report that sorts by a nullable column puts the unknowns at the top in SQLite and at the bottom elsewhere, and moving a query from one engine to another reorders the result with no error: when order matters, write `NULLS FIRST` or `NULLS LAST` (PostgreSQL, DuckDB, Snowflake, BigQuery, and SQLite 3.30+). A `GROUP BY` that selects an ungrouped column is an *error* in PostgreSQL because the answer is ambiguous; SQLite returns one row's value without telling you, so a bug that PostgreSQL would catch passes silently in a prototype. When sqlglot moved a Snowflake `QUALIFY ROW_NUMBER() OVER (ORDER BY x)` to BigQuery it added `NULLS LAST`, which is the translator keeping the NULL order the same. And a dialect that is *forgiving* (storing `'abc'` in an integer column, reading `'12abc'` as 12) turns a data quality problem into a wrong number instead of an error. The pandas trap in Module 1.5 about guessing types is the same family.

**A working strategy.**

1. **Know your target engine** and test on it. A query that passes in the sandbox is not proven for the warehouse.
2. **Write the portable subset when you can**: CTEs, window functions, `CASE`, `COALESCE`, `CAST`, standard joins, `||`, explicit `NULLS FIRST/LAST`, half-open date ranges.
3. **Be explicit instead of relying on defaults**: decimals for ratios, `ORDER BY` with full tie-breakers, column lists in `INSERT`, and `GROUP BY` on every non-aggregated column.
4. **Wrap the differences**: in dbt (Module 2.3) cross-database macros such as `dbt.date_trunc` and `dbt.datediff` hide them, so a model runs on DuckDB in development and on a warehouse in production.
5. **When you meet a new engine**, answer these before writing queries: how are dates and time zones stored? what does `/` do with integers? where do NULLs sort? how are names quoted and compared (case, spaces)? are constraints and foreign keys enforced? how is a string aggregated? is there `QUALIFY`? how are `LIMIT`/`OFFSET` (or `TOP`, `FETCH FIRST`) spelled? what happens on a bad `CAST`?

The sandbox practice challenges **k-16 to k-23** (text, number, date functions and DDL, Module 0.3) and **w-11 to w-14** (QUALIFY, FILTER, date bucketing, a median without `MEDIAN()`) use exactly these ideas.

## @lab Lab: window-function puzzles and a PostgreSQL tuning exercise
Part A: ten analytical questions answered with window functions and a recursive CTE, checked automatically. Part B: given four slow queries on a 500,000-row table in PostgreSQL, create the fewest indexes that make them fast, and rewrite one query so an index can be used. Part B is checked by reading the actual execution plans.

### @steps
1. **Part A, in the browser (recommended).** Open the SQL Sandbox, pick a challenge from the list (they are tagged for this module: running total, latest order, days since previous order, share of total, ranking with ties, moving average, quartiles, category tree, plus the gaps-and-islands and sessionization challenges) and use "Check my answer". Each challenge switches to the right dataset for you.
2. **Part A, locally.** Open `labs/mod-1-3/answers.sql`, write one query under each marker, and run `python3 labs/mod-1-3/check.py`. It compares your results with the reference using Python's built-in SQLite.
3. Do not skip the *why*: for the running total, try the default frame and the explicit `ROWS` frame and see the difference on tied rows; for ranking, try all three ranking functions.
4. **Part B, setup.** Install the requirements (an embedded PostgreSQL is included; no Docker needed):

```bash
python -m pip install -r labs/mod-1-3/explain/requirements.txt
pytest labs/mod-1-3/explain -v
```

   All tests fail at first. That is the starting point. (To use your own PostgreSQL, for example the one from Docker, set `DATABASE_URL` to an empty scratch database.)
5. **Part B, tune.** Open `labs/mod-1-3/explain/queries.sql` and `indexes.sql`. Look at the four queries and decide which columns each filters and sorts on. Write the **fewest** `CREATE INDEX` statements in `indexes.sql` so that no query does a Seq Scan, and Q3 needs no Sort. Rewrite Q4 in `queries.sql` so that it returns the same answer but can use an index.
6. To see what the tests see, load the table into any PostgreSQL and run `EXPLAIN (ANALYZE, BUFFERS)` on each query before and after your change; compare estimated and actual rows, pages read and time.
7. Re-run the tests until they all pass. If one fails, its message says which rule you broke.

### @files
- labs/mod-1-3/answers.sql :: Part A working file: one query per marker :: starter
- labs/mod-1-3/check.py :: Part A checker (uses the datasets below) :: test
- labs/mod-1-3/datasets/kopiku.sql :: Dataset for most Part A questions :: data
- labs/mod-1-3/datasets/daily_sales.sql :: Dataset for the moving average :: data
- labs/mod-1-3/datasets/categories.sql :: Dataset for the recursive CTE :: data
- labs/mod-1-3/reference/answers.sql :: Part A reference answers (try first!) :: reference
- labs/mod-1-3/explain/queries.sql :: Part B: the four queries (rewrite Q4) :: starter
- labs/mod-1-3/explain/indexes.sql :: Part B: put your CREATE INDEX statements here :: starter
- labs/mod-1-3/explain/test_lab.py :: Part B tests that inspect real execution plans :: test
- labs/mod-1-3/explain/reference/indexes.sql :: Part B reference indexes :: reference
- labs/mod-1-3/explain/reference/queries.sql :: Part B reference queries :: reference

### @deliverables
- All ten Part A answers pass, in the sandbox or with `check.py`
- All ten Part B tests pass
- For Part B you can explain, with the plan in front of you, why `(customer_id, event_time DESC)` removes the Sort but `(customer_id, event_type, event_time DESC)` does not

### @verify
Part A: `python3 labs/mod-1-3/check.py` (or the sandbox buttons). Part B: `pytest labs/mod-1-3/explain -v`. Compare with the reference: `python3 labs/mod-1-3/check.py reference` and `LAB_DIR=reference pytest labs/mod-1-3/explain -v`.

## @chaos The dashboard query that was fast until March
### @scenario
A customer-activity page runs `SELECT * FROM events WHERE date(event_time) = CURRENT_DATE - 1 AND customer_id = 4242` against an events table. It was added in January when the table had 200,000 rows and responded in 40 ms. By March the table has 60 million rows, the page takes 25 seconds, the database CPU is at 100% at 09:00 when everyone opens the dashboard, and the team has already tried adding a bigger server twice.

Someone confirms an index exists: `CREATE INDEX ON events (event_time)`.

### @cause
Two compounding problems. First, the filter wraps the indexed column in a function, `date(event_time)`, so the `event_time` index **cannot be used** (the condition is not sargable), and the planner falls back to a sequential scan of all 60 million rows. Second, the one indexed column, `event_time`, is not even the selective one for this question: a single customer's few rows are the real target, so the right index starts with `customer_id`.

The query's cost grew in step with the table, which is why it was fine at 200,000 rows and a disaster at 60 million: a Seq Scan is O(n). A bigger server only delays the next failure.

### @fix
1. Rewrite the filter as a range on the bare column: `event_time >= CURRENT_DATE - 1 AND event_time < CURRENT_DATE`.
2. Create an index that matches the access path: `CREATE INDEX ON events (customer_id, event_time)`, so the database finds one customer and then a time range directly.
3. Check with `EXPLAIN (ANALYZE, BUFFERS)` on production-sized data: expect an Index Scan, a handful of pages and a response of milliseconds.
4. Use an index-friendly design for the long term (partition or BRIN on time, retention of old data), and add a slow-query alert so the next regression is found by a threshold, not a user.

### @pattern
Look at the plan, not at the server size. A function on an indexed column hides it from the index, and an index on the wrong column is the same as none.

## @quiz
### Three orders have the same total and the next order has a larger one. Which function gives the larger order the rank 2?
- [ ] `RANK()`, because it always counts how many rows come before the current one in the ordering
- [ ] `ROW_NUMBER()`, because it numbers the rows in the exact order in which they are returned
- [x] `DENSE_RANK()`, because ties share one rank and the next value continues without a gap
- [ ] `NTILE(2)`, because it divides the ordered rows into two buckets of nearly equal size

> RANK would give 4 (it skips after ties), ROW_NUMBER gives 4 as well, and NTILE is for buckets. DENSE_RANK gives ties the same rank and continues with the next integer.

### You write `SUM(x) OVER (ORDER BY x)` and rows with equal x all show the same running total. Why?
- [ ] The database caches the first result for equal values to avoid recalculating it every time
- [ ] `SUM` ignores the ORDER BY clause when two rows have the same value in the column
- [x] The default frame is RANGE, which also includes all rows tied with the current row
- [ ] Window functions are evaluated before WHERE, which merges the equal rows into one

> With ORDER BY and no frame the default is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, where tied rows are peers and all counted. Write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` for a row-by-row total.

### How do you keep only the newest row per customer from a table that holds many versions per customer?
- [ ] `SELECT DISTINCT customer_id, MAX(effective_ts)` and then join the result back by the timestamp alone
- [x] `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY effective_ts DESC)` in a CTE, keeping `rn = 1`
- [ ] `GROUP BY customer_id` and select every other column without any aggregate function at all
- [ ] `ORDER BY effective_ts DESC LIMIT 1`, which returns one newest row for each separate customer

> The window function numbers versions per customer, newest first; filtering rn = 1 keeps one row each. A plain LIMIT returns one row in total, and joining by timestamp alone can match other customers.

### In a gaps-and-islands query, why is `date - ROW_NUMBER()` the same for all rows in a run of consecutive dates?
- [ ] Both numbers are reset to zero by the database every time a new partition begins in the result
- [ ] ROW_NUMBER is computed from the date values themselves, so the difference is always exactly zero
- [x] Date and row number both rise by one per row, so their difference stays constant until a gap
- [ ] The database sorts the rows by the difference, which places consecutive dates together

> In a run, each next row has a date one day later and a row number one higher, so the subtraction cancels out. After a gap, the date jumps but the row number does not, so the difference changes.

### What stops a recursive CTE from running forever on a hierarchy?
- [ ] The database automatically stops after a fixed number of rounds, whatever the data looks like
- [ ] The `UNION ALL` keyword removes any row that was already produced earlier in the same query
- [x] The recursion ends when a round returns no new rows, so a cycle in the data would loop forever
- [ ] The anchor query limits the number of results that the recursive part is able to add later on in the query

> Each round feeds on the previous round's rows and stops when it produces none. Cycles in the data (A is the parent of B and B of A) never reach that state unless you add a depth limit or cycle detection.

### A query filters `WHERE date(event_time) = '2026-01-10'` and there is an index on `event_time`, yet the plan shows a sequential scan. What is the best fix?
- [ ] Add a second index on the same `event_time` column so that the planner has more choices to pick from
- [ ] Run `VACUUM FULL` on the table so that the planner trusts its existing indexes again afterwards
- [x] Rewrite as a range on the bare column: `event_time >= '2026-01-10' AND event_time < '2026-01-11'`
- [ ] Force an index scan with a planner hint, because the planner always picks the wrong access path

> Wrapping the column in a function means the index on the raw column cannot be searched. Comparing the bare column with a range is sargable and returns the same rows.

### You have `WHERE customer_id = ? ORDER BY event_time DESC LIMIT 10`. Which index lets PostgreSQL return the rows without a Sort step?
- [ ] `(event_time DESC, customer_id)` because the sorted column comes first in the key
- [ ] Separate single-column indexes on `customer_id` and on `event_time`, which are then combined
- [ ] `(customer_id, event_type, event_time DESC)` since it contains every column the query touches
- [x] `(customer_id, event_time DESC)`: equality column first, then the column used for sorting

> The index is ordered by customer and then by time within each customer, so one customer's rows are already in the wanted order. A different middle column breaks the ordering, and a leading sort column cannot be searched by customer.

### `EXPLAIN ANALYZE` shows a node with `rows=15` estimated and `rows=2000` actual. What does this tell you, and what do you do first?
- [ ] The query returned too many rows, so you should add a LIMIT clause to reduce the number of them
- [ ] The estimate is irrelevant, because only the final execution time of the query really matters
- [x] The planner's statistics mislead it, so refresh them with ANALYZE and check correlated columns
- [ ] The index is corrupted and must be rebuilt before the query can run in the right way again

> Large gaps between estimated and actual rows mean the planner chose a plan on wrong assumptions (stale statistics, correlated predicates). Fix the estimate first; the plan usually improves with it.

### The same query is moved from SQLite to PostgreSQL and the nullable column it sorts by now appears in a different position, with no error. Why?
- [ ] PostgreSQL sorts all text columns in reverse by default, so every column ends up in the opposite place
- [x] The engines place NULLs differently by default, so the order should be set with NULLS FIRST or LAST
- [ ] SQLite ignores `ORDER BY` for columns that contain NULL, so it returns the rows in any order
- [ ] PostgreSQL removes NULL rows before sorting, so they cannot appear in the result in any position

> In our run an ascending sort put NULL first in SQLite and last in PostgreSQL and DuckDB. Write `NULLS FIRST` or `NULLS LAST` when the order matters, instead of trusting a default.

### Why can `SELECT x, y FROM t GROUP BY x` be dangerous when the same query runs on SQLite and on PostgreSQL?
- [ ] SQLite computes the answer correctly, while PostgreSQL gives an inexact sum over the rows in each group
- [ ] It is safe on both engines, since a column that is not aggregated is always taken from the first row
- [x] PostgreSQL rejects the query as ambiguous, but SQLite returns an arbitrary `y` without any warning
- [ ] SQLite rejects it with an error, while PostgreSQL silently adds `y` to the `GROUP BY` list

> SQLite returned one row's `y` and PostgreSQL and DuckDB raised an error. A bug that a strict engine would catch can pass silently in a prototype, so list every non-aggregated column in `GROUP BY`.

## @resources
- [PostgreSQL docs: window functions tutorial](https://www.postgresql.org/docs/current/tutorial-window.html)
- [PostgreSQL docs: using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL docs: indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL docs: WITH queries (recursive)](https://www.postgresql.org/docs/current/queries-with.html)
- [SQLite: window functions](https://www.sqlite.org/windowfunctions.html)
