---
title: Databases and SQL 101: Asking Questions of Data
duration: 2 weeks
summary: Learn how relational tables are organised and write the SQL you will use every day: filtering, grouping, joining, and the NULL and join-duplication traps that silently produce wrong numbers.
why: Tutorials treat SQL as syntax to memorise on perfect tables. In real work the syntax is easy and the danger is a query that runs fine and returns a wrong number, because of NULLs, a join that repeats rows, or a misunderstood grain.
---

## @outcomes
- Read a table design and say what its primary and foreign keys mean
- Write SELECT queries with filtering, sorting, grouping and aggregation, and explain the order in which SQL evaluates them
- Predict how NULL behaves in comparisons, aggregates and NOT IN
- Combine tables with INNER and LEFT joins, and spot when a join multiplies rows and corrupts a sum
- Make safe changes to data with INSERT, UPDATE and DELETE and explain what a transaction protects you from
- Transform values with text, number and date functions, and avoid the integer-division and date-range traps
- Define tables with types and constraints, change them with ALTER, and explain the difference between a view, a snapshot table and a materialized view

## @prereq
Modules 0.1 and 0.2 are helpful. You can do the whole lab in your browser (SQL Sandbox) or with the `sqlite3` module that ships with Python; no installation is needed.

## @lesson Tables, rows, columns and keys
A **relational database** stores data in **tables**. A table is like a spreadsheet with strict rules: every column has a **name and a type** (integer, text, date, decimal), and every row has the same columns. KopiKu's miniature data has four tables:

- `customers(customer_id, name, city, tier, signup_date)`: one row per customer
- `products(product_id, name, origin, roast, price_idr)`: one row per coffee product
- `orders(order_id, customer_id, order_date, status, payment_method, shipping_fee_idr)`: one row per order
- `order_items(order_id, line_no, product_id, qty, unit_price_idr)`: one row per product line within an order

Why four tables instead of one big sheet? Because each *fact* is stored once. A customer's city lives in `customers`; if Budi moves, you change one row, not 400 order rows. This idea, called **normalisation**, avoids contradictions.

Two kinds of key make the tables work together:

- A **primary key (PK)** uniquely identifies a row: `customers.customer_id`. No two rows share it and it is never empty. `order_items` uses a *composite* key: `(order_id, line_no)` together.
- A **foreign key (FK)** is a column that points at another table's primary key: `orders.customer_id` refers to `customers.customer_id`. The database can enforce that you cannot create an order for a customer who does not exist.

Ask of every table, before you query it: **what does one row represent?** This is the table's **grain**. `orders` has one row per order, `order_items` one row per *line*. Almost every wrong number in analytics comes from forgetting the grain, as you will see in the join lesson.

A word on spreadsheets. Excel is excellent for small, ad-hoc work. It falls short when data is large (Excel stops at 1,048,576 rows per sheet), shared by many people at once, must stay consistent (anyone can type text into a number column), or must be repeated automatically every night. A database gives you types, constraints, concurrent access, history and speed, and that is why pipelines load data into one.

## @lesson Reading data: SELECT, WHERE, ORDER BY
The basic query has a fixed shape:

```sql
SELECT name, city
FROM customers
WHERE tier = 'Gold'
ORDER BY name;
```

This returns `Budi Santoso, Jakarta` and `Wulan Kusuma, Bandung`. Read it in the order the database *thinks*, not the order you write: it takes the rows **FROM** `customers`, keeps those **WHERE** `tier = 'Gold'`, picks the columns in **SELECT**, and finally sorts with **ORDER BY**. Use `SELECT *` only while exploring; in real code name the columns you need.

The tools you will use constantly in `WHERE`:

| Need | Syntax | Example |
|---|---|---|
| Comparison | `=`, `<>` (not equal), `<`, `<=`, `>`, `>=` | `qty >= 2` |
| Combine conditions | `AND`, `OR`, `NOT` (use parentheses) | `tier = 'Gold' AND city = 'Jakarta'` |
| One of several values | `IN (...)` | `city IN ('Jakarta', 'Bandung')` |
| A range, inclusive | `BETWEEN a AND b` | `order_date BETWEEN '2026-01-10' AND '2026-01-20'` |
| Text pattern | `LIKE` with `%` (any text) and `_` (one character) | `name LIKE '%a'` |
| Missing value | `IS NULL`, `IS NOT NULL` | `city IS NULL` |

Other essentials: `SELECT DISTINCT payment_method` removes repeated values; `LIMIT 10` returns only the first rows (great while exploring a huge table); `AS` renames a column (`SUM(qty) AS units`). Text values use single quotes (`'Gold'`); double quotes mean a column or table name in standard SQL.

> **Tip:** The habit that prevents most errors: before writing a complicated query, run `SELECT * FROM the_table LIMIT 10` and look at real rows. Then add one clause at a time and re-run. When a result looks wrong, remove clauses until it looks right.

Note on dates: databases have date types, but a lot of real data stores dates as text like `'2026-01-15'`. The ISO format (year-month-day) is special because text order equals date order, which is why `BETWEEN` works on it. Dates written as `15/01/2026` do not sort or compare correctly: normalise them early.

## @lesson NULL: the value that is not a value
`NULL` means **unknown or missing**. It is not zero and not an empty string, and it behaves differently from everything else. This is the single biggest source of silent errors for beginners, so spend time here.

The rule: any comparison with NULL gives neither true nor false, but **UNKNOWN**, and `WHERE` keeps only rows where the condition is *true*. Using KopiKu's customers (two of the ten have no city):

```sql
SELECT COUNT(*) FROM customers WHERE city = 'Jakarta';   -- 3
SELECT COUNT(*) FROM customers WHERE city <> 'Jakarta';  -- 5, not 7!
```

Three are in Jakarta, five elsewhere, and two have an unknown city. The `<>` query silently leaves out those two, because `NULL <> 'Jakarta'` is UNKNOWN. To include them you must say so:

```sql
SELECT COUNT(*) FROM customers WHERE city <> 'Jakarta' OR city IS NULL;   -- 7
```

You can never test for NULL with `=`: `city = NULL` is never true. Use `IS NULL` and `IS NOT NULL`.

More places NULL bites:

- **Aggregates skip NULL.** `COUNT(*)` counts rows (10), `COUNT(city)` counts non-NULL values (8), and `AVG(x)` averages only the rows where `x` is not NULL. If NULL really means zero for your business ("no discount"), convert it first.
- **Arithmetic spreads NULL.** `price - discount` is NULL if `discount` is NULL, so the whole row's total vanishes.
- **`NOT IN` with a NULL in the list returns nothing.** `city NOT IN ('Jakarta', NULL)` matches zero rows, because the comparison with NULL is UNKNOWN for every row. This is a classic production bug when the list comes from a subquery that happens to contain a NULL. Prefer `NOT EXISTS` or a LEFT JOIN anti-join (below).
- **`COALESCE(a, b, ...)`** returns the first non-NULL argument. `COALESCE(city, 'Unknown')` makes missing cities show as `Unknown`.

> **Warning:** When a count or sum looks "a bit low", suspect NULL before suspecting the data. Add `OR col IS NULL`, or `COALESCE`, and see whether the numbers move.

## @lesson Text, number and date functions
Real columns are messy: names in mixed case, ratios that must be computed, dates stored as text. A **function** transforms a value inside the query, one result per row (an aggregate such as `SUM` collapses rows; a function does not). The examples run on the KopiKu dataset in the SQL Sandbox.

**Text.** `LENGTH(x)`, `UPPER(x)`, `LOWER(x)`, `TRIM(x)`, `REPLACE(x, 'a', 'b')`, `SUBSTR(x, start, length)` (positions start at 1, not 0), `INSTR(x, 'text')` (the position of the first match, 0 if none) and `||` to join text. To get the first name from `Budi Santoso`:

```sql
SELECT name, SUBSTR(name, 1, INSTR(name, ' ') - 1) AS first_name, LENGTH(name) AS name_length
FROM customers;       -- Budi Santoso | Budi | 12
```

`LIKE` matches patterns: `%` is any run of characters and `_` is exactly one, so `name LIKE 'A%'` finds names that start with A. Two traps, both checked on SQLite, PostgreSQL and DuckDB. First, `'a' || NULL` is **NULL** in all three, so one missing part empties the whole joined string; `COALESCE(part, '')` first, or use `concat()`, which skips NULL (PostgreSQL and DuckDB; the sandbox's SQLite 3.39 has no `concat()`). Second, `'abc' LIKE 'ABC'` is true in SQLite and **false** in PostgreSQL and DuckDB, which have `ILIKE` for case-insensitive matching. Module 1.3 has the full dialect table.

**Numbers.** `ROUND(x, 1)`, `CAST(x AS INTEGER)`, `COALESCE(a, b)` (first non-NULL; `COALESCE(city, 'Unknown')` turns the two NULL cities into a visible group of 2 customers) and `NULLIF(a, b)` (NULL when they are equal, which makes `x / NULLIF(y, 0)` return NULL instead of failing on division by zero). The trap to remember is **integer division**: in SQLite and PostgreSQL, `7 / 2` is **3**. KopiKu has 2 cancelled orders out of 18, so `SUM(status = 'cancelled') / COUNT(*)` returns **0**, and `100 * SUM(...) / COUNT(*)` returns 11, because the division still happens between integers. Make one side a decimal before dividing: `ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1)` returns **11.1**. DuckDB gives 3.5 for `7 / 2`, another reason to test on the engine you will use.

**Dates.** SQLite has no real date type: dates are text in the ISO format `YYYY-MM-DD`, which sorts correctly as text (`'2026-01-03' < '2026-01-10'`). A format such as `10/1/2026` does not: as text, `'10/1/2026' < '3/1/2026'` is true. Store dates in ISO form, always. The SQLite functions are `date(x, '+7 days')`, `strftime(format, x)` and `julianday(x)`:

```sql
SELECT strftime('%w', order_date) AS weekday, COUNT(*) FROM orders GROUP BY 1;   -- 0 = Sunday ... 6 = Saturday
SELECT date(order_date, '+7 days') FROM orders;                                   -- 2026-01-03 becomes 2026-01-10
SELECT julianday(MIN(o.order_date)) - julianday(c.signup_date) ...                 -- days between two dates (Budi: 61)
```

Two more habits. **Use half-open ranges**: `order_date >= '2026-01-10' AND order_date < '2026-01-20'` (4 KopiKu orders). `BETWEEN '2026-01-10' AND '2026-01-19'` looks the same on plain dates but silently drops anything later than midnight on the 19th when the column holds timestamps: we inserted `'2026-01-19 15:30:00'` and `BETWEEN` missed it while the half-open range found it. And **months are not all equal**: `date('2026-01-31', '+1 month')` is **2026-03-03** in SQLite (it computes February 31 and rolls over), while PostgreSQL's `DATE '2026-01-31' + INTERVAL '1 month'` is 2026-02-28. Store timestamps in UTC and convert to a local time zone only when showing them.

One performance rule that Module 1.3 explains with EXPLAIN: do not wrap an indexed column in a function inside `WHERE`. On a table with an index on `ts`, `WHERE strftime('%Y-%m', ts) = '2026-01'` made SQLite **scan the whole table**, and the equivalent range `ts >= '2026-01-01' AND ts < '2026-02-01'` **searched the index**.

## @lesson Aggregation: GROUP BY and HAVING
Aggregation collapses many rows into one number per group. The functions are `COUNT`, `SUM`, `AVG`, `MIN` and `MAX`.

```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status;
```

This returns delivered 12, paid 2, cancelled 2, shipped 1 and refunded 1. Every non-aggregated column in `SELECT` must also appear in `GROUP BY`; the database needs to know which group each output row belongs to.

Three counts are often confused:

- `COUNT(*)` counts rows.
- `COUNT(col)` counts rows where `col` is not NULL.
- `COUNT(DISTINCT col)` counts different non-NULL values (`COUNT(DISTINCT city)` is 5 here).

**WHERE vs HAVING.** `WHERE` filters *rows before* grouping; `HAVING` filters *groups after* aggregation. To find customers with three or more orders:

```sql
SELECT customer_id, COUNT(*) AS n
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3;
```

You cannot put `COUNT(*) >= 3` in `WHERE`, because at that stage the groups do not exist yet. The full logical order SQL follows is worth memorising:

1. `FROM` and `JOIN`: build the rows to work with
2. `WHERE`: filter rows
3. `GROUP BY`: form groups
4. `HAVING`: filter groups
5. `SELECT`: compute output columns (this is why you cannot use a `SELECT` alias in `WHERE`)
6. `ORDER BY`, then `LIMIT`

Beware integer division: in many databases `7 / 2` is `3`. Write `7.0 / 2` or cast to a decimal when you want a fraction (for example percentages: `100.0 * part / total`).

## @lesson Joins: combining tables, and how they go wrong
A **join** puts together rows from two tables that match on a key.

```sql
SELECT c.name, o.order_id, o.status
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id;
```

`c` and `o` are table aliases. The `ON` clause says which columns must match. A plain `JOIN` is an **INNER JOIN**: it keeps only matching pairs, so a customer with no orders disappears from the result (`customers JOIN orders` has 18 rows, one per order).

A **LEFT JOIN** keeps *every* row of the left table, filling the right side with NULLs where nothing matched (`customers LEFT JOIN orders` has 20 rows: 18 orders plus the two customers without any). That makes it the tool for questions about absence. Customers who never ordered:

```sql
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;
```

This pattern is the **anti-join** and returns Fajar Nugroho and Rizky Saputra. (`RIGHT JOIN` is the mirror image, and `FULL JOIN` keeps unmatched rows from both sides; you can nearly always rewrite them as LEFT JOINs.)

> **Warning:** Put filters on the *right* table of a LEFT JOIN in the `ON` clause, not in `WHERE`. A `WHERE o.status = 'delivered'` removes the NULL rows the LEFT JOIN just created, quietly turning it back into an INNER JOIN.

**The fan-out trap.** Joining a table at one grain to a table at a finer grain **repeats** the coarse rows. `orders` has one row per order, `order_items` one per line, so joining them gives one row per *line*: 24 rows for 18 orders. Anything stored per order (like the shipping fee) is now repeated for every line. Compare:

```sql
-- Correct: one row per order
SELECT SUM(shipping_fee_idr) FROM orders WHERE status = 'delivered';   -- 235,000

-- Wrong: fees repeated for each line of the order
SELECT SUM(o.shipping_fee_idr)
FROM orders o JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'delivered';                                          -- 350,000
```

The second query runs without any error and reports a shipping income 49% too high. Defences you should adopt as habits: always know the grain of each table; after a join, check `COUNT(*)` against what you expect; sum a per-order value only at the per-order grain, or aggregate the finer table first (`SELECT order_id, SUM(qty * unit_price_idr) ... GROUP BY order_id`) and then join that result.

A join on a key that is not unique on *both* sides is a **many-to-many join**, which multiplies rows even more. If the row count after joining is larger than you can explain, stop and find out why before continuing.

## @lesson CASE, subqueries and CTEs
**CASE** is SQL's if/else, used to create categories. Here `order_totals` is the per-order total, defined in the CTE example below:

```sql
SELECT order_id,
       CASE WHEN order_total < 100000 THEN 'small'
            WHEN order_total < 200000 THEN 'medium'
            ELSE 'large' END AS size
FROM order_totals;
```

A **subquery** is a query inside another. A scalar subquery returns one value, handy for shares of a total:

```sql
SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS pct
FROM orders
GROUP BY payment_method;
```

A **CTE** (common table expression, `WITH name AS (...)`) names an intermediate result so a long query reads from top to bottom, like a recipe:

```sql
WITH order_totals AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT o.order_id, o.status, t.order_total
FROM orders o
JOIN order_totals t ON t.order_id = o.order_id;
```

This is also the safe way to avoid the fan-out trap: compute the finer-grain total in a CTE (one row per order) before joining. Prefer CTEs over deeply nested subqueries: they are easier to read, debug (select from each step on its own) and review.

Style matters because other people will maintain your SQL. Put each clause on its own line, use clear aliases, keep keywords consistent in case, and add a comment that says *why* a filter exists ("exclude test accounts") rather than what it does.

## @lesson Changing data safely: DML, constraints and transactions
Besides reading, SQL changes data:

```sql
INSERT INTO customers (customer_id, name, city, tier, signup_date)
VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');

UPDATE customers SET tier = 'Silver' WHERE customer_id = 11;

DELETE FROM customers WHERE customer_id = 11;
```

> **Warning:** `UPDATE` and `DELETE` without a `WHERE` change **every row**. Before running either, run the same `WHERE` in a `SELECT` and check the row count. In production, run it inside a transaction (below) and check before committing.

**Constraints** let the database reject bad data instead of storing it: `PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK (qty > 0)`. A rule enforced by the database holds no matter which application writes to it; a rule that lives only in app code holds until someone writes a script.

A **transaction** groups statements so that they succeed or fail *together*:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;      -- or ROLLBACK; to undo both
```

If the server crashes between the two updates, neither takes effect; money is never lost. Transactions provide **ACID** guarantees: *Atomicity* (all or nothing), *Consistency* (constraints always hold), *Isolation* (concurrent transactions do not see each other's half-finished work) and *Durability* (committed data survives a crash). These guarantees are why production databases are trustworthy, and why Module 2.2 will care so much when lakes try to add them to plain files.

An **index** is a separate lookup structure that makes finding rows by a column fast, like the index of a book. It speeds reads and slows writes slightly; Module 1.3 returns to when and how to create them.

Finally, **SQL has dialects**. The core in this lesson works everywhere, but date functions, string functions, `LIMIT` versus `TOP`, and special features differ between SQLite (used in this course's sandbox), PostgreSQL, MySQL, DuckDB, Snowflake and BigQuery. When something fails after copying a query, check the dialect first.

## @lesson Defining tables: DDL, types and views
So far you read and changed rows. **DDL** (Data Definition Language) creates and changes the *structure*: `CREATE`, `ALTER` and `DROP`. A table you design yourself looks like this:

```sql
CREATE TABLE reviews (
  review_id   INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (customer_id),
  product_id  INTEGER NOT NULL REFERENCES products (product_id),
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (customer_id, product_id)          -- one review per customer per product
);
```

Each column has a **type**, optional **constraints**, and optionally a `DEFAULT`. We ran this kind of table and each constraint rejects a bad row: a `stars` of 9 fails with `CHECK constraint failed`, a missing `customer_id` with `NOT NULL constraint failed`, and a second review by the same customer of the same product with `UNIQUE constraint failed`. Choose types deliberately: whole numbers `INTEGER`, text `TEXT`, dates and times as real date types where the engine has them (ISO text in SQLite), and **money never as floating point**: in SQLite `0.1 + 0.2 = 0.3` is **false** (the sum is 0.30000000000000004), and PostgreSQL's `float8` behaves the same. KopiKu stores rupiah as `INTEGER` (`price_idr`), and engines with `DECIMAL(12, 2)` store exact decimals.

**The engine may not enforce what you declared.** This is a real SQLite behaviour we measured, and the reason this lesson exists:

- SQLite lets you insert `'abc'` into an `INTEGER` column and stores the text. PostgreSQL and DuckDB refuse with an error.
- SQLite **does not enforce foreign keys by default** (`PRAGMA foreign_keys` returns 0 in Python's SQLite and in the sandbox). We inserted an order for customer 99, who does not exist, and it was accepted. After `PRAGMA foreign_keys = ON` the same insert failed with `FOREIGN KEY constraint failed`, and PostgreSQL always refuses it.

A constraint you never verified is a hope. Test the constraints you rely on by trying to break them.

**Changing a table.** `ALTER TABLE customers ADD COLUMN email TEXT` adds a column, and every existing row gets NULL there (we checked). `DROP COLUMN` and `RENAME` exist (SQLite 3.35+, PostgreSQL, others). `DROP TABLE` removes the table and its data, so run it only on purpose. Changes to a shared table should be written as small, ordered **migration scripts** kept in version control, run the same way in every environment, and preferably **backwards compatible** (adding a nullable column does not break existing queries; renaming one does). Module 3.2 returns to schema changes in streams.

**Views.** A **view** gives a name to a query:

```sql
CREATE VIEW v_gold AS SELECT * FROM customers WHERE tier = 'Gold';
```

A view stores **the query, not the data**. We created `v_gold` when it matched 1 row, inserted another Gold customer, and the view immediately returned 2 rows. If the table underneath is dropped, the view stays but fails with `no such table` when used. `CREATE TABLE snap AS SELECT ...` (CTAS) is different: it stores a **snapshot** that does not change when the source does (it kept its rows while the view grew), and it loses the constraints of the original (the copy we made had no primary key, no `NOT NULL` and no `CHECK`). PostgreSQL and warehouses also offer **materialized views**: stored results that are **stale until refreshed**. In PostgreSQL a materialized view showed 2 rows after a third was inserted, and 3 only after `REFRESH MATERIALIZED VIEW`.

Why this matters for data engineers: views are how a team defines a metric in one place ("revenue" means this query) and how a warehouse exposes a safe subset of columns. The models you build with dbt in Module 2.3 are views and tables created by DDL that the tool writes for you; knowing what they are underneath is what lets you debug them.

## @lab Lab: ten questions about KopiKu
You are the new data engineer and the founder has ten questions. Answer them in SQL against the KopiKu miniature dataset: a customer table with NULL cities, orders with cancellations and refunds, and a shipping fee that tempts you into a fan-out bug.

### @steps
1. Choose where to work. **In the browser (recommended):** open the SQL Sandbox from the app, select the KopiKu dataset and pick a challenge; the sandbox runs your query and tells you whether the result matches. **Locally:** use the files below with Python's built-in SQLite, no installation needed.
2. For the local route, open `labs/mod-0-3/answers.sql`. Under each `-- k-N` marker, write one query. Do not remove the markers.
3. Check your work any time with the checker, which compares your result sets with the reference results:

```bash
python3 labs/mod-0-3/check.py
```

4. Do the questions in order; they get harder. Questions 4, 6 and 8 are the traps from the lessons (NULL, NULL-to-Unknown with a join, and fan-out). When a question fails, read the checker's message: it tells you whether the column count, row count, or values differ.
5. After each answer, run `SELECT COUNT(*)` on the intermediate join and make sure you can explain the number. This is the habit that protects you in real work.
6. Optional: open the database yourself with `sqlite3 kopiku.db < labs/mod-0-3/datasets/kopiku.sql` if you have the `sqlite3` command-line tool, and explore with `.tables` and `.schema`.

### @files
- labs/mod-0-3/answers.sql :: Your working file: one query under each marker :: starter
- labs/mod-0-3/datasets/kopiku.sql :: The dataset (schema and rows), also used by the sandbox :: data
- labs/mod-0-3/check.py :: Checker that compares your results with the reference :: test
- labs/mod-0-3/reference/answers.sql :: Reference answers (try first!) :: reference

### @deliverables
- All ten answers pass, in the sandbox or with `check.py`
- For questions 4 and 8 you can explain in one sentence why the "obvious" query gives a wrong number
- You can state the grain of each of the four tables

### @verify
In the sandbox, use the "Check my answer" button on each challenge. Locally:

```bash
python3 labs/mod-0-3/check.py
```

It prints PASS, FAIL (with the reason) or TODO per question and a total. To see what a fully correct run looks like: `python3 labs/mod-0-3/check.py reference`.

## @chaos The shipping income that was 49% too high
### @scenario
The finance team asks why the dashboard says KopiKu earned Rp 350,000 in shipping fees on delivered orders in January, while the payment provider's report says Rp 235,000. The dashboard query was written months ago and has run every day without any error. Nobody has changed it. The analyst who wrote it has left.

The query joins `orders` to `order_items` because a filter on product was added last quarter ("only count orders that contain Gayo beans"), and sums `shipping_fee_idr` across the joined rows.

### @cause
`shipping_fee_idr` is stored once per **order**, but after joining to `order_items` there is one row per order **line**. An order with three lines has its fee counted three times. The result is wrong exactly in proportion to how many multi-line orders there are, so it looked plausible and drifted over time as customers started buying more products per order.

No error is raised because SQL has no way to know the sum is meant to be per order: the query is valid, only its meaning is wrong.

### @fix
1. Decide the grain you want: shipping fee per order. Aggregate or filter at that grain: use `WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.order_id AND i.product_id = 1)` instead of joining, so each order stays one row.
2. Alternatively compute the finer-grain table first in a CTE (distinct orders containing the product) and join *that* to `orders`.
3. Add a reconciliation test: the dashboard's shipping total must equal `SELECT SUM(shipping_fee_idr) FROM orders WHERE ...` and ideally match the payment provider's report within a tolerance.
4. Add a row-count check after joins in anything that sums per-order values.

### @pattern
Know the grain of every table you join, and sum a value only at the grain where it lives. After any join, ask: did the row count change in a way I can explain?

## @quiz
### In the KopiKu customers table, 8 of 10 customers have a city (2 are NULL), and 3 live in Jakarta. How many rows does `WHERE city <> 'Jakarta'` return?
- [ ] 7, because every customer who is not in Jakarta is included in the result, including the ones whose city is unknown
- [ ] 3, because the condition selects exactly the same rows as the Jakarta filter does
- [x] 5, because customers whose city is NULL fail the comparison and are left out of the result
- [ ] 10, because `<>` ignores the city column whenever any value in the table is missing

> Comparing NULL with anything yields UNKNOWN, and WHERE keeps only rows where the condition is true. Add `OR city IS NULL` to include unknown cities.

### What is the difference between `COUNT(*)` and `COUNT(city)`?
- [ ] There is none; both count the rows in the group, and NULL only matters for SUM and AVG
- [ ] `COUNT(city)` counts distinct cities while `COUNT(*)` counts every city, repeats included
- [x] `COUNT(*)` counts all rows, while `COUNT(city)` counts only rows where city is not NULL
- [ ] `COUNT(*)` is faster, but it ignores rows that were already removed by the WHERE clause

> COUNT(*) counts every row; COUNT(column) skips NULLs; COUNT(DISTINCT column) counts different non-NULL values.

### Which query correctly finds customers who have never placed an order?
- [ ] `SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL`
- [x] `SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL`
- [ ] `SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id = NULL`
- [ ] `SELECT c.name FROM customers c RIGHT JOIN orders o ON o.customer_id = c.customer_id WHERE c.customer_id IS NULL`

> A LEFT JOIN keeps customers with no match, filling the order columns with NULL; testing `IS NULL` then isolates them. An INNER JOIN removes them, and `= NULL` is never true.

### An analyst joins `orders` (one row per order) to `order_items` (one row per line) and runs `SUM(shipping_fee_idr)`. Why is the total too high?
- [ ] SUM adds NULL values as if they were zero, which overstates the total of every group
- [ ] The join drops orders that have no items, which changes how the remaining rows are grouped
- [x] After the join, each order's fee is repeated once for every line that the order contains
- [ ] The database caches the earlier result and then adds it a second time to the new one

> Joining to a finer-grain table repeats the coarse-grain rows. A per-order value must be summed at the per-order grain, or the finer table must be aggregated first.

### What is the difference between WHERE and HAVING?
- [ ] WHERE works only on text columns, while HAVING works only on numeric columns
- [ ] HAVING is the older syntax, and WHERE is the newer replacement that most teams now use
- [x] WHERE filters rows before grouping, while HAVING filters the groups after aggregation
- [ ] WHERE accepts a single condition at a time, and HAVING is needed to combine several

> The logical order is FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY. Aggregates like COUNT(*) exist only after grouping, so conditions on them belong in HAVING.

### `SELECT 7 / 2` returns `3` in SQLite and many other databases. Why, and how do you get 3.5?
- [ ] The database rounds down on purpose, so use `ROUND(7 / 2, 1)` to get the decimal part
- [ ] The result is correct, because 7 divided by 2 has no exact value in a database
- [x] Both operands are integers, so integer division applies; use `7.0 / 2` for a fraction
- [ ] Division is not supported on literal numbers, so you must read them from a table column

> With two integers most databases perform integer division. Making one side a decimal (7.0) gives a fractional result, which is how percentages like `100.0 * part / total` are written.

### What does a transaction guarantee when two UPDATE statements are wrapped in BEGIN and COMMIT, and the server crashes between them?
- [ ] The first update is kept and the second is lost, so you must repair the data
- [x] Neither update is applied, because the changes succeed or fail together
- [ ] Both updates are applied after the server restarts, with a warning message
- [ ] Nothing is guaranteed unless an index exists on the updated columns

> Atomicity: a transaction is all or nothing. Uncommitted changes are discarded after a crash, so partial updates (like money leaving one account but not arriving in another) cannot persist.

### You run `UPDATE customers SET tier = 'Gold'` and forget the WHERE clause. What happens?
- [ ] The database refuses the statement, because an UPDATE must always contain a condition
- [ ] Only the first row of the table is updated, because no other condition was given
- [ ] Only the rows where tier is currently NULL are updated, since they need a value most
- [x] Every row is updated, unless it ran in a transaction that you are able to roll back

> UPDATE and DELETE without WHERE affect all rows. Preview with a SELECT using the same WHERE, check the count, and use a transaction when you can.

### Two of KopiKu's 18 orders are cancelled. Which SQLite expression returns the cancellation rate as 11.1 (percent)?
- [ ] `ROUND(100 * 2 / 18, 1)`, because multiplying by 100 first always keeps the decimals of the result
- [ ] `ROUND(2 / 18 * 100, 1)`, because the division comes first, so the fraction is multiplied afterwards
- [x] `ROUND(100.0 * 2 / 18, 1)`, because one decimal value makes the whole division keep its decimals
- [ ] `ROUND(2 / 18, 1) * 100`, because rounding the fraction first keeps the precision of the answer

> With integers only, SQLite truncates: `100 * 2 / 18` is 11 and `2 / 18` is 0. One decimal operand (100.0) forces decimal division, so the result is 11.11, which rounds to 11.1.

### A view `delivered_orders` was created over `orders`. Afterwards 5 more delivered orders are inserted. What does `SELECT COUNT(*) FROM delivered_orders` return?
- [ ] The count from the moment the view was created, because a view keeps a copy of the rows it selected
- [ ] An error, because a view must be dropped and created again whenever the table below it changes
- [ ] Only 5, because a view shows just the rows that were added after the day it was created
- [x] The old count plus the 5 new rows, because a view stores the query and runs it on the current data

> A view is a saved query, not saved data. A table made with `CREATE TABLE ... AS` is the snapshot that would keep the old count, and a materialized view stays stale until it is refreshed.

## @resources
- [SQLite SQL language reference](https://www.sqlite.org/lang.html)
- [PostgreSQL tutorial: SQL basics](https://www.postgresql.org/docs/current/tutorial-sql.html)
- [Python sqlite3 module documentation](https://docs.python.org/3/library/sqlite3.html)
