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

## @part Reading tables

## @lesson Tables, rows, columns and keys
A **relational database** stores data in **tables**. A table is like a spreadsheet with strict rules: every column has a **name and a type** (integer, text, date, decimal), and every row has the same columns. In this module you work with **KopiKu**, an online coffee shop in miniature (10 customers, 6 products, 18 orders in January 2026). Every SQL drill has a **See the tables** line: open it any time to look at the real rows.

### Four tables, one idea each

- `customers(customer_id, name, city, tier, signup_date)`: one row per customer
- `products(product_id, name, origin, roast, price_idr)`: one row per coffee product
- `orders(order_id, customer_id, order_date, status, payment_method, shipping_fee_idr)`: one row per order
- `order_items(order_id, line_no, product_id, qty, unit_price_idr)`: one row per product line within an order

Why four tables instead of one big sheet? Because each *fact* is stored once. A customer's city lives in `customers`; if Budi moves, you change one row, not 400 order rows. This idea, called **normalisation**, avoids contradictions.

### Your first query

`SELECT` chooses what to show, `FROM` says which table. `*` means "every column":

```sql
SELECT * FROM customers;
```

:::drill sql Look at a table
Show every column and every row of the `products` table.
@data kopiku
@starter
-- write your query below this line

@check
/from\s+products/ ## Take the rows FROM the products table.
@hint
`SELECT * FROM products;` The star `*` means every column.
@solution
SELECT * FROM products;
:::

To get only some columns, list them after `SELECT`, separated by commas:

:::drill sql Choose the columns
Show only the `name` and the `price_idr` of every product.
@data kopiku
@starter
-- write your query below this line

@check
/name/ ## Select the name column.
/price_idr/ ## Select the price_idr column.
@hint
`SELECT name, price_idr FROM products;`
@solution
SELECT name, price_idr FROM products;
:::

### The grain: what does one row represent?

Ask of every table, before you query it: **what does one row represent?** This is the table's **grain**. `orders` has one row per order, `order_items` one row per *line* of an order. Almost every wrong number in analytics comes from forgetting the grain, as you will see in the join lesson. `COUNT(*)` counts rows, so it tells you quickly how big a table is:

```sql
SELECT COUNT(*) FROM customers;    -- 10
```

:::drill sql How many rows?
Count the rows of `order_items`. Give the column the name `lines`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/count\s*\(/ ## Use COUNT(*) to count the rows.
@hint
`SELECT COUNT(*) AS lines FROM order_items;` `AS` gives the result column a name.
@solution
SELECT COUNT(*) AS lines FROM order_items;
:::

:::ask What does ONE row of order_items represent?
@options
one order
one product in the catalogue
* one product line inside an order
@why
`order_items` has one row per **line** of an order: an order with three different products has three rows. That is why it has more rows (24) than `orders` (18).
:::

### Keys: how the tables find each other

Two kinds of key make the tables work together:

- A **primary key (PK)** uniquely identifies a row: `customers.customer_id`. No two rows share it and it is never empty. `order_items` uses a *composite* key: `(order_id, line_no)` together.
- A **foreign key (FK)** is a column that points at another table's primary key: `orders.customer_id` refers to `customers.customer_id`. The database can enforce that you cannot create an order for a customer who does not exist.

:::ask Which column is enough to identify ONE row of order_items?
@options
* `order_id` and `line_no` together
`order_id` alone
`line_no` alone
@why
An order can have several lines (so `order_id` repeats), and line number 1 exists in every order (so `line_no` repeats). Only the **pair** `(order_id, line_no)` is unique: a composite primary key.
:::

:::ask What happens if you INSERT a customer with a customer_id that already exists?
@options
the old row is replaced silently by the new one
two customers end up sharing the same id
* the database refuses: `UNIQUE constraint failed`
@why
A primary key must be unique, and the database enforces it. This is the point of keys: bad data is rejected at the door instead of being found later in a report.
:::

A word on spreadsheets. Excel is excellent for small, ad-hoc work. It falls short when data is large (Excel stops at 1,048,576 rows per sheet), shared by many people at once, must stay consistent (anyone can type text into a number column), or must be repeated automatically every night. A database gives you types, constraints, concurrent access, history and speed, and that is why pipelines load data into one.

> 🛠 **Try it (8 min, SQL Sandbox with the KopiKu dataset).**
> 1. Run `SELECT * FROM customers LIMIT 3;` and `SELECT * FROM order_items LIMIT 3;`. For each table say in one sentence what one row represents (its grain) and name its primary key.
> 2. Run `SELECT COUNT(*), COUNT(DISTINCT order_id) FROM orders;` and the same query on `order_items`.
> 3. Try to break a key: `INSERT INTO customers (customer_id, name) VALUES (1, 'Dup');`
>
> **You should see:** `18 18` for `orders` (one row per order) but `24 18` for `order_items` (several rows per order, which is why its key has two columns), and the error `UNIQUE constraint failed: customers.customer_id` for step 3.

## @lesson Reading data: SELECT, WHERE, ORDER BY
The basic query has a fixed shape. Read it in the order the database *thinks*, not the order you write it: it takes the rows **FROM** a table, keeps those **WHERE** a condition is true, picks the columns in **SELECT**, and finally sorts with **ORDER BY**. Watch the same query one step at a time:

:::sqlsteps The order the database thinks in
@data kopiku
@stage 1. FROM: take every row of the table
SELECT name, city, tier FROM customers
@say
`FROM customers` gives the database all 10 rows to work with.
@stage 2. WHERE: keep only the rows where the condition is true
SELECT name, city, tier FROM customers WHERE tier = 'Gold'
@say
Rows whose `tier` is not `'Gold'` are struck through: they are dropped. Two rows are left.
@stage 3. SELECT: pick the columns to show
SELECT name, city FROM customers WHERE tier = 'Gold'
@say
Only now are the columns chosen, so `tier` is no longer shown.
@stage 4. ORDER BY: sort what is left
SELECT name, city FROM customers WHERE tier = 'Gold' ORDER BY name
@say
The result is sorted by `name`. The full query is `SELECT name, city FROM customers WHERE tier = 'Gold' ORDER BY name;`.
:::

### Filtering rows with WHERE

`WHERE` keeps only the rows for which its condition is true. Text values use **single quotes** (`'Gold'`); double quotes mean a column or table name in standard SQL.

:::drill sql Filter and sort
Show the `name` and the `city` of the customers whose tier is `'Silver'`, sorted by `name`.
@data kopiku
@ordered
@starter
-- write your query below this line

@check
/where/ ## Use WHERE to keep only the Silver customers.
/order\s+by/ ## Use ORDER BY name to sort them.
@hint
`SELECT name, city FROM customers WHERE tier = 'Silver' ORDER BY name;`
@solution
SELECT name, city FROM customers WHERE tier = 'Silver' ORDER BY name;
:::

The conditions you will use constantly in `WHERE`:

| Need | Syntax | Example |
|---|---|---|
| Comparison | `=`, `<>` (not equal), `<`, `<=`, `>`, `>=` | `qty >= 2` |
| Combine conditions | `AND`, `OR`, `NOT` (use parentheses) | `tier = 'Gold' AND city = 'Jakarta'` |
| One of several values | `IN (...)` | `city IN ('Jakarta', 'Bandung')` |
| A range, inclusive | `BETWEEN a AND b` | `order_date BETWEEN '2026-01-10' AND '2026-01-20'` |
| Text pattern | `LIKE` with `%` (any text) and `_` (one character) | `name LIKE '%a'` |
| Missing value | `IS NULL`, `IS NOT NULL` | `city IS NULL` |

:::drill sql Compare numbers
Show the `order_id` and the `shipping_fee_idr` of the orders whose shipping fee is **at least** 20000.
@data kopiku
@starter
-- write your query below this line

@check
/>=/ ## "At least" means bigger than or equal: use >=.
@hint
`WHERE shipping_fee_idr >= 20000`
@solution
SELECT order_id, shipping_fee_idr FROM orders WHERE shipping_fee_idr >= 20000;
:::

:::drill sql AND
Show the `order_id` of the orders that are `'delivered'` **and** paid with `'card'`.
@data kopiku
@starter
-- write your query below this line

@check
/\band\b/ ## Join the two conditions with AND.
@hint
`WHERE status = 'delivered' AND payment_method = 'card'`
@solution
SELECT order_id FROM orders WHERE status = 'delivered' AND payment_method = 'card';
:::

:::drill sql One of several
Show the `name` of the customers who live in `'Jakarta'` or `'Bandung'`. Use `IN`.
@data kopiku
@starter
-- write your query below this line

@check
/\bin\s*\(/ ## Use IN ('...', '...').
@hint
`WHERE city IN ('Jakarta', 'Bandung')`
@solution
SELECT name FROM customers WHERE city IN ('Jakarta', 'Bandung');
:::

:::drill sql A range of dates
Show the `order_id` and `order_date` of the orders placed from `'2026-01-10'` to `'2026-01-20'`, both days included. Use `BETWEEN`.
@data kopiku
@starter
-- write your query below this line

@check
/between/ ## Use BETWEEN ... AND ...
@hint
`WHERE order_date BETWEEN '2026-01-10' AND '2026-01-20'`
@solution
SELECT order_id, order_date FROM orders WHERE order_date BETWEEN '2026-01-10' AND '2026-01-20';
:::

:::drill sql A text pattern
Show the `name` of the customers whose name starts with the letter `A`. Use `LIKE` with `%`.
@data kopiku
@starter
-- write your query below this line

@check
/like/ ## Use LIKE with a % pattern.
@hint
`WHERE name LIKE 'A%'`: the `%` stands for "any text after the A".
@solution
SELECT name FROM customers WHERE name LIKE 'A%';
:::

Other essentials: `SELECT DISTINCT payment_method` removes repeated values; `LIMIT 10` returns only the first rows (great while exploring a huge table); `AS` renames a column (`SUM(qty) AS units`); `DESC` after `ORDER BY` sorts from the biggest.

:::drill sql Top three
Show the `name` and `price_idr` of the **three most expensive** products, the most expensive first.
@data kopiku
@ordered
@starter
-- write your query below this line

@check
/order\s+by/ ## Sort with ORDER BY price_idr DESC.
/limit/ ## Keep only three rows with LIMIT 3.
@hint
`ORDER BY price_idr DESC LIMIT 3`
@solution
SELECT name, price_idr FROM products ORDER BY price_idr DESC LIMIT 3;
:::

:::drill sql Each value once
Show the different payment methods used in `orders`, each only once. Use `DISTINCT`.
@data kopiku
@starter
-- write your query below this line

@check
/distinct/ ## Use SELECT DISTINCT.
@hint
`SELECT DISTINCT payment_method FROM orders;`
@solution
SELECT DISTINCT payment_method FROM orders;
:::

> **Tip:** The habit that prevents most errors: before writing a complicated query, run `SELECT * FROM the_table LIMIT 10` and look at real rows. Then add one clause at a time and re-run. When a result looks wrong, remove clauses until it looks right.

**Dates.** Databases have date types, but a lot of real data stores dates as text like `'2026-01-15'`. The ISO format (year-month-day) is special because text order equals date order, which is why `BETWEEN` works on it. Dates written as `15/01/2026` do not sort or compare correctly: normalise them early.

> 💡 **Practice Pause 1 (SELECT & WHERE):**
> Open `labs/mod-0-3/answers.sql` in your editor (or open the SQL Sandbox in the web app).
> Solve challenge `-- k-1`: write a query returning `name` and `tier` from `customers` whose city is Jakarta (`WHERE city = 'Jakarta'`).
> Test your query in your terminal:
> `python3 labs/mod-0-3/check.py`
> Once k-1 reports PASS, congratulations! You have written your first query. Proceed to Lesson 3 to explore the NULL trap.

## @lesson NULL: the value that is not a value
`NULL` means **unknown or missing**. It is not zero and not an empty string, and it behaves differently from everything else. This is the single biggest source of silent errors for beginners, so spend time here. Two of the ten KopiKu customers have no city.

### Comparing with NULL gives "unknown"

The rule: any comparison with NULL gives neither true nor false, but **UNKNOWN**, and `WHERE` keeps only rows where the condition is *true*. Watch what happens to the two customers without a city:

:::sqlsteps Where do the NULL rows go?
@data kopiku
@stage 1. Every customer, with their city (two cities are NULL)
SELECT name, city FROM customers
@say
Rina and Rizky have no city: the table shows `NULL`.
@stage 2. WHERE city = 'Jakarta': 3 rows
SELECT name, city FROM customers WHERE city = 'Jakarta'
@say
Three customers live in Jakarta.
@stage 3. WHERE city <> 'Jakarta': 5 rows, not 7!
SELECT name, city FROM customers WHERE city <> 'Jakarta'
@say
Three are in Jakarta, five elsewhere, and two have an unknown city. The query silently leaves out those two: `NULL <> 'Jakarta'` is UNKNOWN, not true.
@stage 4. Say what you mean: OR city IS NULL gives 7
SELECT name, city FROM customers WHERE city <> 'Jakarta' OR city IS NULL
@say
Now the two NULL rows are included. To include them you must ask for them.
:::

:::ask How many customers does this return?
```sql
SELECT COUNT(*) FROM customers WHERE city <> 'Jakarta';
```
@options
* 5
7
3
@why
Three customers live in Jakarta, five live elsewhere, and two have no city. `NULL <> 'Jakarta'` is UNKNOWN, so the two unknown ones are left out: 5, not 7.
:::

You can never test for NULL with `=`: `city = NULL` is never true. Use `IS NULL` and `IS NOT NULL`.

:::drill sql Find the missing
Show the `name` of the customers whose `city` is unknown.
@data kopiku
@starter
-- write your query below this line

@check
/is\s+null/ ## Use IS NULL. (city = NULL is never true.)
@hint
`WHERE city IS NULL`
@solution
SELECT name FROM customers WHERE city IS NULL;
:::

:::drill sql Everyone not in Medan
Show the `name` of every customer whose city is **not** `'Medan'`, **including** the ones with an unknown city.
@data kopiku
@starter
-- write your query below this line

@check
/is\s+null/ ## The customers with an unknown city must be included: add OR city IS NULL.
@hint
`WHERE city <> 'Medan' OR city IS NULL`
@solution
SELECT name FROM customers WHERE city <> 'Medan' OR city IS NULL;
:::

### Aggregates skip NULL

`COUNT(*)` counts rows, `COUNT(city)` counts rows where `city` is **not** NULL, and `AVG(x)` averages only the rows where `x` is not NULL. If NULL really means zero for your business ("no discount"), convert it first.

:::drill sql Rows versus values
In one query, show `COUNT(*)` as `customers` and `COUNT(city)` as `with_city`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/count\s*\(\s*city\s*\)/ ## Use COUNT(city) for the cities that are not NULL.
@hint
`SELECT COUNT(*) AS customers, COUNT(city) AS with_city FROM customers;` You should see 10 and 8.
@solution
SELECT COUNT(*) AS customers, COUNT(city) AS with_city FROM customers;
:::

### COALESCE: give the missing a name

`COALESCE(a, b, ...)` returns the first argument that is not NULL. `COALESCE(city, 'Unknown')` makes missing cities show as `Unknown`, so they become a visible group instead of vanishing.

:::drill sql Fill the gaps
Show the `name` and the `city` of every customer, but show `'Unknown'` instead of NULL. Name the second column `city`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/coalesce/ ## Use COALESCE(city, 'Unknown').
@hint
`SELECT name, COALESCE(city, 'Unknown') AS city FROM customers;`
@solution
SELECT name, COALESCE(city, 'Unknown') AS city FROM customers;
:::

### More places NULL bites

- **Arithmetic spreads NULL.** `price - discount` is NULL if `discount` is NULL, so the whole row's total vanishes.
- **`NOT IN` with a NULL in the list returns nothing.** `x NOT IN (1, NULL)` is never true, because the comparison with NULL is UNKNOWN for every row. This is a classic production bug when the list comes from a subquery that happens to contain a NULL.

:::ask What does this return?
```sql
SELECT name FROM customers
WHERE city NOT IN (SELECT city FROM customers WHERE tier = 'Silver');
```
@options
the customers whose city is not a Silver customer's city
* no rows at all
3 rows
@why
One Silver customer has no city, so the list in `NOT IN` contains a NULL, and `city NOT IN (..., NULL)` is never true. The query returns **nothing**. Safer ways to say "not in": `NOT EXISTS`, `EXCEPT`, or the LEFT JOIN anti-join of the join lesson.
:::

> **Warning:** When a count or sum looks "a bit low", suspect NULL before suspecting the data. Add `OR col IS NULL`, or `COALESCE`, and see whether the numbers move.

> 💡 **Practice Pause 2 (Three-Valued Logic NULL Trap):**
> Open `labs/mod-0-3/answers.sql` and find marker `-- k-4`.
> Write a query returning the name of all customers whose city is NOT Jakarta (`city <> 'Jakarta'`), but REMEMBER to include customers whose city is unknown: add `OR city IS NULL`.
> Test in your terminal:
> `python3 labs/mod-0-3/check.py`
> Verify that k-4 reports PASS (returning 7 customers, not 5!). Proceed to Lesson 4 below.

## @part Calculating

## @lesson Text, number and date functions
Real columns are messy: names in mixed case, ratios that must be computed, dates stored as text. A **function** transforms a value inside the query, **one result per row** (an aggregate such as `SUM` collapses rows; a function does not). The examples run on the KopiKu dataset.

### Text functions

`LENGTH(x)`, `UPPER(x)`, `LOWER(x)`, `TRIM(x)`, `REPLACE(x, 'a', 'b')`, `SUBSTR(x, start, length)` (positions start at **1**, not 0), `INSTR(x, 'text')` (the position of the first match, 0 if none) and `||` to join text.

```sql
SELECT name, UPPER(name) AS shout, LENGTH(name) AS name_length FROM customers;
-- Budi Santoso | BUDI SANTOSO | 12
```

:::drill sql Shout and measure
Show each customer's `name`, the name in capitals as `name_upper`, and its length as `name_length`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/upper/ ## Use UPPER(name).
/length/ ## Use LENGTH(name).
@hint
`SELECT name, UPPER(name) AS name_upper, LENGTH(name) AS name_length FROM customers;`
@solution
SELECT name, UPPER(name) AS name_upper, LENGTH(name) AS name_length FROM customers;
:::

To cut a piece out, combine `SUBSTR` and `INSTR`. The first name is everything before the first space:

```sql
SELECT name, SUBSTR(name, 1, INSTR(name, ' ') - 1) AS first_name FROM customers;
-- Budi Santoso | Budi
```

:::drill sql The first name
Show each customer's `name` and their first name (everything before the first space) as `first_name`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/substr/ ## Use SUBSTR(name, 1, ...).
/instr/ ## Use INSTR(name, ' ') to find the space.
@hint
`SUBSTR(name, 1, INSTR(name, ' ') - 1)`: start at position 1 and take as many characters as there are before the space.
@solution
SELECT name, SUBSTR(name, 1, INSTR(name, ' ') - 1) AS first_name FROM customers;
:::

Join text with `||`. One trap: `'a' || NULL` is **NULL**, so one missing part empties the whole joined text.

:::ask What does this return for a customer whose city is NULL?
```sql
SELECT name || ' from ' || city FROM customers;
```
@options
* NULL
`Rina Pratama from `
`Rina Pratama from NULL`
@why
Joining with `||` and a NULL gives NULL: the whole text disappears. Use `COALESCE(city, 'somewhere')` first.
:::

:::drill sql A label
Show one column `label` that looks like `Budi Santoso (Gold)`: the name, a space, and the tier in brackets.
@data kopiku
@names
@starter
-- write your query below this line

@check
/\|\|/ ## Join the pieces with ||.
@hint
`name || ' (' || tier || ')' AS label`
@solution
SELECT name || ' (' || tier || ')' AS label FROM customers;
:::

### Number functions and the integer-division trap

`ROUND(x, 1)` rounds, `CAST(x AS INTEGER)` changes the type, `COALESCE(a, b)` takes the first non-NULL, and `NULLIF(a, b)` gives NULL when the two are equal (so `x / NULLIF(y, 0)` returns NULL instead of failing on division by zero).

The trap to remember is **integer division**: in SQLite and PostgreSQL, `7 / 2` is **3**. Make one side a decimal before dividing: `7.0 / 2` is 3.5.

:::ask What does this return?
```sql
SELECT 7 / 2;
```
@options
3.5
* 3
4
@why
Both numbers are whole numbers, so SQLite divides as whole numbers and drops the decimals: 3. Write `7.0 / 2` to get 3.5. This is how a percentage silently becomes 0.
:::

:::drill sql Price in thousands
Show each product's `name` and its price in thousands of rupiah, with one decimal, as `price_k` (for 85000 that is 85.0). Mind the integer division!
@data kopiku
@names
@starter
-- write your query below this line

@check
/round/ ## Use ROUND(..., 1).
/1000\.0/ ## Divide by 1000.0 (with .0), or the decimals are lost.
@hint
`ROUND(price_idr / 1000.0, 1) AS price_k`
@solution
SELECT name, ROUND(price_idr / 1000.0, 1) AS price_k FROM products;
:::

KopiKu has 2 cancelled orders out of 18. In SQLite a true comparison like `status = 'cancelled'` is `1` and a false one is `0`, so `SUM(status = 'cancelled')` counts the cancelled rows (Lesson 8 shows the portable `CASE WHEN`). `SUM(status = 'cancelled') / COUNT(*)` returns **0** (integer division!); `ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1)` returns **11.1**.

:::drill sql A percentage
What percent of all orders are `'cancelled'`? Show one number, rounded to one decimal, as `pct`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/100\.0/ ## Use 100.0 (with .0) so the division keeps its decimals.
@hint
`SELECT ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1) AS pct FROM orders;` You should see 11.1.
@solution
SELECT ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1) AS pct FROM orders;
:::

### Dates

SQLite has no real date type: dates are text in the ISO format `YYYY-MM-DD`, which sorts correctly as text (`'2026-01-03' < '2026-01-10'`). A format such as `10/1/2026` does not: as text, `'10/1/2026' < '3/1/2026'` is true. Store dates in ISO form, always. The SQLite functions are `date(x, '+7 days')`, `strftime(format, x)` and `julianday(x)`:

```sql
SELECT date(order_date, '+7 days') FROM orders;     -- 2026-01-03 becomes 2026-01-10
SELECT strftime('%w', order_date) FROM orders;      -- the weekday: 0 = Sunday ... 6 = Saturday
```

:::drill sql A week later
Show each order's `order_id`, its `order_date`, and the date seven days later as `due_date`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/date\s*\(/ ## Use date(order_date, '+7 days').
@hint
`date(order_date, '+7 days') AS due_date`
@solution
SELECT order_id, order_date, date(order_date, '+7 days') AS due_date FROM orders;
:::

**Use half-open ranges**: `order_date >= '2026-01-10' AND order_date < '2026-01-20'` (4 KopiKu orders). `BETWEEN '2026-01-10' AND '2026-01-19'` looks the same on plain dates but silently drops anything later than midnight on the 19th when the column holds timestamps: we inserted `'2026-01-19 15:30:00'` and `BETWEEN` missed it while the half-open range found it.

:::drill sql Half-open range
Count the orders placed on or after `'2026-01-10'` and **before** `'2026-01-20'`. Show one number as `orders`. Use `>=` and `<`, not `BETWEEN`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/>=/ ## Start with order_date >= '2026-01-10'.
/<\s*'2026-01-20'/ ## End with order_date < '2026-01-20' (a half-open range).
@hint
`WHERE order_date >= '2026-01-10' AND order_date < '2026-01-20'`
@solution
SELECT COUNT(*) AS orders FROM orders WHERE order_date >= '2026-01-10' AND order_date < '2026-01-20';
:::

:::advanced For later: dialect traps and performance
Two traps, both checked on SQLite, PostgreSQL and DuckDB. First, `'a' || NULL` is **NULL** in all three; `COALESCE(part, '')` first, or use `concat()`, which skips NULL (PostgreSQL and DuckDB; the sandbox's SQLite 3.39 has no `concat()`). Second, `'abc' LIKE 'ABC'` is true in SQLite and **false** in PostgreSQL and DuckDB, which have `ILIKE` for case-insensitive matching. DuckDB gives 3.5 for `7 / 2`, another reason to test on the engine you will use. Module 1.3 has the full dialect table.

**Months are not all equal**: `date('2026-01-31', '+1 month')` is **2026-03-03** in SQLite (it computes February 31 and rolls over), while PostgreSQL's `DATE '2026-01-31' + INTERVAL '1 month'` is 2026-02-28. Store timestamps in UTC and convert to a local time zone only when showing them.

**One performance rule** that Module 1.3 explains with EXPLAIN: do not wrap an indexed column in a function inside `WHERE`. On a table with an index on `ts`, `WHERE strftime('%Y-%m', ts) = '2026-01'` made SQLite **scan the whole table**, and the equivalent range `ts >= '2026-01-01' AND ts < '2026-02-01'` **searched the index**.
:::

> 🛠 **Try it (10 min, SQL Sandbox).** Solve the KopiKu challenges **k-16** (first name and name length), **k-17** (unknown cities) and **k-18** (cancellation rate) with the functions of this lesson. Note: SQLite treats a true comparison like `status = 'cancelled'` as `1` and false as `0`, so `SUM(status = 'cancelled')` counts cancelled rows (Lesson 8 shows portable `CASE WHEN`). Before you run k-18, predict the answer by hand, then try `SUM(status = 'cancelled') / COUNT(*)` without the `100.0` and see what integer division does.
>
> **You should see:** the sandbox says Correct for each challenge; the wrong attempt at k-18 shows `0`, the right one `11.1`.

## @lesson Aggregation: GROUP BY and HAVING
Aggregation collapses many rows into **one number per group**. The functions are `COUNT`, `SUM`, `AVG`, `MIN` and `MAX`. Without `GROUP BY` they work on the whole table and give one row:

```sql
SELECT COUNT(*) AS orders, MIN(order_date) AS first_day FROM orders;
```

:::drill sql Several numbers at once
In one query, show the `lowest` price (`MIN`), the `highest` price (`MAX`) and the `average` price (`AVG`) of the products, from the `products` table.
@data kopiku
@names
@starter
-- write your query below this line

@check
/min\s*\(/ ## Use MIN(price_idr).
/max\s*\(/ ## Use MAX(price_idr).
/avg\s*\(/ ## Use AVG(price_idr).
@hint
`SELECT MIN(price_idr) AS lowest, MAX(price_idr) AS highest, AVG(price_idr) AS average FROM products;`
@solution
SELECT MIN(price_idr) AS lowest, MAX(price_idr) AS highest, AVG(price_idr) AS average FROM products;
:::

### GROUP BY: one answer per group

`GROUP BY` forms a group for each different value of a column, and the aggregate runs once per group. Watch the rows being gathered into groups:

:::sqlsteps From rows to groups
@data kopiku
@stage 1. The rows we start with: 18 orders
SELECT order_id, payment_method FROM orders
@say
Every row is one order, with the way it was paid.
@stage 2. GROUP BY puts rows with the same payment method together
SELECT order_id, payment_method FROM orders ORDER BY payment_method
@say
Picture the rows sorted into piles, one pile per payment method.
@stage 3. One output row per pile
SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method
@say
`COUNT(*)` ran once for each pile. Four groups, four rows. The groups did not exist before `GROUP BY`, which is why they cannot be used in `WHERE`.
:::

Every non-aggregated column in `SELECT` must also appear in `GROUP BY`; the database needs to know which group each output row belongs to.

:::drill sql Orders per payment method
Show each `payment_method` and how many orders used it, as `orders`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/group\s+by/ ## Use GROUP BY payment_method.
@hint
`SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method;`
@solution
SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method;
:::

:::drill sql Units sold per product
Show each `product_id` and the total quantity sold, as `units` (the sum of `qty` in `order_items`).
@data kopiku
@names
@starter
-- write your query below this line

@check
/group\s+by/ ## Use GROUP BY product_id.
/sum\s*\(/ ## Use SUM(qty).
@hint
`SELECT product_id, SUM(qty) AS units FROM order_items GROUP BY product_id;`
@solution
SELECT product_id, SUM(qty) AS units FROM order_items GROUP BY product_id;
:::

### Three counts that look alike

- `COUNT(*)` counts rows.
- `COUNT(col)` counts rows where `col` is not NULL.
- `COUNT(DISTINCT col)` counts different non-NULL values.

:::drill sql Three counts
In one query over `customers`, show `COUNT(*)` as `customers`, `COUNT(city)` as `with_city`, and `COUNT(DISTINCT city)` as `cities`. You should see 10, 8 and 5.
@data kopiku
@names
@starter
-- write your query below this line

@check
/count\s*\(\s*distinct/ ## Use COUNT(DISTINCT city).
@hint
`SELECT COUNT(*) AS customers, COUNT(city) AS with_city, COUNT(DISTINCT city) AS cities FROM customers;`
@solution
SELECT COUNT(*) AS customers, COUNT(city) AS with_city, COUNT(DISTINCT city) AS cities FROM customers;
:::

### WHERE or HAVING?

`WHERE` filters *rows before* grouping; `HAVING` filters *groups after* aggregation. Follow one question through all the steps: customers with at least two delivered orders.

:::sqlsteps WHERE first, HAVING after
@data kopiku
@stage 1. All orders
SELECT customer_id, status FROM orders
@say
18 rows.
@stage 2. WHERE keeps only the delivered rows (before any grouping)
SELECT customer_id, status FROM orders WHERE status = 'delivered'
@say
The 6 rows that are not delivered are struck through: rows are filtered first.
@stage 3. GROUP BY makes one row per customer
SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'delivered' GROUP BY customer_id
@say
Now each customer has a count of delivered orders.
@stage 4. HAVING filters the groups
SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'delivered' GROUP BY customer_id HAVING COUNT(*) >= 2
@say
Customers whose group has fewer than two rows are dropped. You cannot write `COUNT(*) >= 2` in `WHERE`, because at that stage the groups do not exist yet.
:::

:::drill sql Busy payment methods
Show the `payment_method` and the number of orders, as `orders`, for the payment methods used by **more than 3** orders. Use `HAVING`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/having/ ## Filter the groups with HAVING.
@hint
`GROUP BY payment_method HAVING COUNT(*) > 3`
@solution
SELECT payment_method, COUNT(*) AS orders FROM orders GROUP BY payment_method HAVING COUNT(*) > 3;
:::

:::drill sql WHERE and HAVING together
Looking only at `'delivered'` orders, show each `payment_method` that has **at least 3** such orders, with the number as `orders`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/where/ ## Filter the delivered rows with WHERE first.
/having/ ## Then filter the groups with HAVING.
@hint
`WHERE status = 'delivered' GROUP BY payment_method HAVING COUNT(*) >= 3`
@solution
SELECT payment_method, COUNT(*) AS orders FROM orders WHERE status = 'delivered' GROUP BY payment_method HAVING COUNT(*) >= 3;
:::

:::ask Which of these runs FIRST?
@options
HAVING
SELECT
* WHERE
@why
The logical order is: `FROM` and `JOIN`, then `WHERE` (filter rows), `GROUP BY` (form groups), `HAVING` (filter groups), `SELECT` (compute the output columns; this is why a `SELECT` alias cannot be used in `WHERE`), and finally `ORDER BY` and `LIMIT`.
:::

Beware integer division here too: write `100.0 * part / total` for percentages.

> 💡 **Practice Pause 3 (Aggregation: GROUP BY & HAVING):**
> Apply aggregation logic to three challenges in `labs/mod-0-3/answers.sql`:
> 1. `-- k-2`: count orders per status (`GROUP BY status`, then `COUNT(*)`).
> 2. `-- k-3`: compute each order's total value (`SUM(qty * unit_price_idr)` grouped by `order_id`).
> 3. `-- k-7`: find customers with at least 2 delivered orders (`HAVING COUNT(*) >= 2`).
> Test these three queries in your terminal:
> `python3 labs/mod-0-3/check.py`
> When k-2, k-3, and k-7 PASS, you have mastered aggregation! Proceed to Lesson 6 on Joins.

## @part Combining data

## @lesson Joins: combining tables, and how they go wrong
A **join** puts together rows from two tables that match on a key. `c` and `o` below are table **aliases**, short names for the tables; the `ON` clause says which columns must match:

```sql
SELECT c.name, o.order_id, o.status
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id;
```

:::drill sql Customers and their orders
Show each customer's `name` together with the `order_id` and `status` of their orders. Use `JOIN ... ON`.
@data kopiku
@starter
-- write your query below this line

@check
/join/ ## Use JOIN.
/\bon\b/ ## Say which columns must match with ON.
@hint
`FROM customers c JOIN orders o ON o.customer_id = c.customer_id`
@solution
SELECT c.name, o.order_id, o.status FROM customers c JOIN orders o ON o.customer_id = c.customer_id;
:::

### INNER JOIN and LEFT JOIN

A plain `JOIN` is an **INNER JOIN**: it keeps only matching pairs, so a customer with no orders disappears from the result. A **LEFT JOIN** keeps *every* row of the left table, filling the right side with NULLs where nothing matched. Watch the difference:

:::sqlsteps Who disappears?
@data kopiku
@stage 1. The customers: 10 rows
SELECT customer_id, name FROM customers
@say
Ten customers. Two of them (Fajar and Rizky) never ordered.
@stage 2. JOIN orders: 18 rows (one per order)
SELECT c.name, o.order_id FROM customers c JOIN orders o ON o.customer_id = c.customer_id
@say
An INNER JOIN has one row per matching order. Fajar and Rizky have no order, so they vanished.
@stage 3. LEFT JOIN orders: 20 rows
SELECT c.name, o.order_id FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id
@say
The same 18 orders, plus 2 rows for the customers without orders, with `NULL` where the order would be.
@stage 4. Keep only the NULL rows: the customers who never ordered
SELECT c.name, o.order_id FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL
@say
This pattern is the **anti-join**: a LEFT JOIN, then `WHERE` the right side `IS NULL`. It answers questions about absence.
:::

(`RIGHT JOIN` is the mirror image, and `FULL JOIN` keeps unmatched rows from both sides; you can nearly always rewrite them as LEFT JOINs.)

:::drill sql Orders per customer, zeros included
Show each customer's `name` and how many orders they have, as `orders`: customers with no orders must show 0. Use a `LEFT JOIN`, and count a column of the **right** table.
@data kopiku
@names
@starter
-- write your query below this line

@check
/left\s+join/ ## Use LEFT JOIN, so customers without orders stay in the result.
/group\s+by/ ## Group by the customer.
/count\s*\(\s*o\./ ## Count a column of the orders table (COUNT(o.order_id)), not COUNT(*): COUNT(*) would count the empty row as 1.
@hint
`SELECT c.name, COUNT(o.order_id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.name;`
@solution
SELECT c.name, COUNT(o.order_id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.name;
:::

> **Warning:** Put filters on the *right* table of a LEFT JOIN in the `ON` clause, not in `WHERE`. A `WHERE o.status = 'delivered'` removes the NULL rows the LEFT JOIN just created, quietly turning it back into an INNER JOIN.

:::drill sql No delivered order
Show the `name` of the customers who have **no delivered order** (including those with no order at all). Put the `'delivered'` condition in the `ON` clause of a LEFT JOIN, then keep the rows where the order is NULL.
@data kopiku
@starter
-- write your query below this line

@check
/left\s+join/ ## Use LEFT JOIN.
/is\s+null/ ## Keep the rows where the order is NULL.
@hint
`LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' WHERE o.order_id IS NULL`
@solution
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' WHERE o.order_id IS NULL;
:::

### The fan-out trap

Joining a table at one grain to a table at a finer grain **repeats** the coarse rows. `orders` has one row per order, `order_items` one per line, so joining them gives one row per *line*: 24 rows for 18 orders. Anything stored per order (like the shipping fee) is now repeated for every line.

[[diagram:fanout]]

:::sqlsteps A join that quietly inflates a sum
@data kopiku
@stage 1. The delivered orders, with their shipping fee: 12 rows
SELECT order_id, shipping_fee_idr FROM orders WHERE status = 'delivered'
@say
One row per order, so one fee per order.
@stage 2. Join the order lines: some orders now appear twice
SELECT o.order_id, o.shipping_fee_idr FROM orders o JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'delivered'
@say
An order with two lines now has two rows, and its fee is repeated on each.
@stage 3. The wrong sum: fees repeated per line
SELECT SUM(o.shipping_fee_idr) AS shipping_total FROM orders o JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'delivered'
@say
350,000: the query runs without any error and reports a shipping income 49% too high.
@stage 4. The right sum: stay at the order grain
SELECT SUM(shipping_fee_idr) AS shipping_total FROM orders WHERE status = 'delivered'
@say
235,000. Sum a per-order value only at the per-order grain.
:::

Habits to adopt: always know the grain of each table; after a join, check `COUNT(*)` against what you expect; sum a per-order value only at the per-order grain, or aggregate the finer table first (`SELECT order_id, SUM(qty * unit_price_idr) ... GROUP BY order_id`) and then join that result.

:::ask Two tables are joined and the row count is larger than you can explain. What do you do?
@options
carry on: more rows just means more data
* stop and find out why: a non-unique key repeats rows
add DISTINCT so the repeats disappear
@why
A join on a key that is not unique on **both** sides multiplies rows (a many-to-many join even more). `DISTINCT` hides the symptom and can hide real repeated rows. Find the grain mismatch first.
:::

:::drill sql Sum without the fan-out
What is the total shipping fee of the orders whose status is `'paid'` or `'shipped'`? Show one number as `shipping_total`. Do **not** join `order_items`: the fee is per order.
@data kopiku
@names
@starter
-- write your query below this line

@check
/sum\s*\(/ ## Use SUM(shipping_fee_idr).
@hint
`SELECT SUM(shipping_fee_idr) AS shipping_total FROM orders WHERE status IN ('paid', 'shipped');`
@solution
SELECT SUM(shipping_fee_idr) AS shipping_total FROM orders WHERE status IN ('paid', 'shipped');
:::

:::drill sql Revenue per city
For the `'delivered'` orders, show each city and the sum of `qty * unit_price_idr` of their lines, as `revenue`. A NULL city should show as `'Unknown'`. You need three tables.
@data kopiku
@names
@starter
-- write your query below this line

@check
/join/ ## Join the tables: customers, orders and order_items.
/coalesce/ ## Show NULL cities as 'Unknown' with COALESCE.
@hint
`FROM customers c JOIN orders o ON ... JOIN order_items i ON ...` then `GROUP BY COALESCE(c.city, 'Unknown')`.
@solution
SELECT COALESCE(c.city, 'Unknown') AS city, SUM(i.qty * i.unit_price_idr) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items i ON i.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY COALESCE(c.city, 'Unknown');
:::

> 💡 **Practice Pause 4 (JOIN, Anti-Join & Fan-Out Prevention):**
> Solve the multi-table challenges in `labs/mod-0-3/answers.sql`:
> 1. `-- k-5`: find customers who never placed an order (`LEFT JOIN orders` then `WHERE o.order_id IS NULL`).
> 2. `-- k-6`: revenue per city for delivered orders, mapping NULL cities to 'Unknown' using `COALESCE(c.city, 'Unknown')`.
> 3. `-- k-8`: compute total shipping fees without fan-out (sum over the `orders` table alone!).
> Test in your terminal:
> `python3 labs/mod-0-3/check.py`
> Verify that k-5, k-6, and k-8 PASS! Proceed to Lesson 7 below.

## @lesson More ways to combine data: self-joins, CROSS JOIN and set operations
A join puts tables **side by side**: it adds columns. Three more tools complete the picture: a table joined to itself, every row paired with every row, and **stacking** results on top of each other.

### Self-join: a table against itself

To compare rows of the *same* table, join the table to itself under two aliases. Pairs of products with the same roast:

```sql
SELECT a.product_id AS product_a, b.product_id AS product_b, a.roast
FROM products a
JOIN products b ON a.roast = b.roast AND a.product_id < b.product_id;
```

This returns 3 pairs: (1, 4) medium, (2, 5) dark and (3, 6) light. The `<` is what makes it correct: without it every product is paired with itself and every pair appears twice (12 rows instead of 3). Remember the NULL lesson: two NULLs are never equal, so rows with a NULL in the joined column match nothing.

:::drill sql Pairs in the same tier
Show pairs of customers who have the same `tier`: the two names as `customer_a` and `customer_b`. Each pair must appear **once**, and nobody is paired with themselves.
@data kopiku
@names
@starter
-- write your query below this line

@check
/join/ ## Join the customers table to itself (two aliases).
/</ ## Use a.customer_id < b.customer_id so each pair appears once.
@hint
`FROM customers a JOIN customers b ON a.tier = b.tier AND a.customer_id < b.customer_id`
@solution
SELECT a.name AS customer_a, b.name AS customer_b FROM customers a JOIN customers b ON a.tier = b.tier AND a.customer_id < b.customer_id;
:::

### CROSS JOIN: every combination

A `CROSS JOIN` has no `ON`: every row of one side is paired with every row of the other. That is useful for building a **complete grid** of categories, so that combinations with no data still appear as 0 instead of silently vanishing (a chart with a missing bar is a lie of omission). Then `LEFT JOIN` the facts onto the grid and count a column of the *right* side (`COUNT(o.order_id)`, not `COUNT(*)`, which would count the empty row as 1).

:::drill sql Every combination
Show every combination of a product `roast` and a customer `tier`: two columns `roast` and `tier`, each combination once. Use `CROSS JOIN` on the distinct values.
@data kopiku
@names
@starter
-- write your query below this line

@check
/cross\s+join/ ## Use CROSS JOIN.
@hint
`FROM (SELECT DISTINCT roast FROM products) r CROSS JOIN (SELECT DISTINCT tier FROM customers) t`
@solution
SELECT r.roast, t.tier FROM (SELECT DISTINCT roast FROM products) r CROSS JOIN (SELECT DISTINCT tier FROM customers) t;
:::

The danger is the **accidental** cross join: forget the `ON` of a normal join and `customers` with `products` returns 10 x 6 = 60 rows; with two tables of a million rows it returns a trillion.

### Set operations: stacking results

Set operations stack the results of two queries. Both queries must return the same number of columns of compatible types, and columns are matched by **position**, not by name (swap two columns by mistake and the data mixes without any error). Using the tiers of customers in Jakarta (Gold, Bronze, Silver) and in Bandung (Silver, Gold):

| Operator | Keeps | Rows |
|---|---|---|
| `UNION ALL` | everything, duplicates too | 5 |
| `UNION` | everything, duplicates removed | 3 |
| `INTERSECT` | rows present in both | 2 (Gold, Silver) |
| `EXCEPT` | rows of the first missing from the second | 1 (Bronze) |

:::ask Jakarta has the tiers Gold, Bronze and Silver; Bandung has Silver and Gold. Which operator keeps only the rows that exist in BOTH results?
@options
UNION
EXCEPT
* INTERSECT
@why
`INTERSECT` keeps only the rows present in both results (Gold and Silver). `UNION` keeps everything from both (without repeats), and `EXCEPT` keeps the rows of the first result that are missing from the second.
:::

:::drill sql Cities of two groups
Show the different cities of the `'Gold'` customers **and** of the `'Silver'` customers together, each city once (a single column `city`). Use `UNION`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/union/ ## Use UNION.
@hint
`SELECT city FROM customers WHERE tier = 'Gold' UNION SELECT city FROM customers WHERE tier = 'Silver'`
@solution
SELECT city FROM customers WHERE tier = 'Gold' UNION SELECT city FROM customers WHERE tier = 'Silver';
:::

:::drill sql Bronze but not Gold
Show the cities where `'Bronze'` customers live but no `'Gold'` customer lives (one column `city`). Ignore customers with an unknown city. Use `EXCEPT`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/except/ ## Use EXCEPT.
@hint
`SELECT city FROM customers WHERE tier = 'Bronze' AND city IS NOT NULL EXCEPT SELECT city FROM customers WHERE tier = 'Gold'`
@solution
SELECT city FROM customers WHERE tier = 'Bronze' AND city IS NOT NULL EXCEPT SELECT city FROM customers WHERE tier = 'Gold';
:::

`UNION ALL` stacks everything and keeps duplicates. `UNION` also removes duplicates, which costs a sort and can hide real repeated rows, so it is the right choice only when a duplicate would be a mistake. Set operations compare whole rows and treat two NULLs as the same, unlike `=`.

> **Warning:** `NOT IN` with a subquery that can return a NULL returns **no rows at all**, because `x NOT IN (1, NULL)` is never true. `SELECT name FROM customers WHERE city NOT IN (SELECT city FROM customers WHERE tier = 'Silver')` returns 0 rows, since one Silver customer has no city. Adding `AND city IS NOT NULL` inside the subquery gives 3 rows. `NOT EXISTS`, `EXCEPT` and the LEFT JOIN anti-join do not have this trap, which is why they are the safer way to say "not in".

> 🛠 **Try it (25 min, SQL Sandbox with the KopiKu dataset).** Solve the KopiKu challenges **k-24** (a campaign list from two lists), **k-25** (customers who used both card and e-wallet), **k-26** (customers with no cancelled or refunded order), **k-27** (every tier and payment method, with zeros), **k-28** (pairs of customers in the same city) and **k-29** (a total row at the bottom). Before you run k-24, predict how many customers you get with `UNION` and with `UNION ALL`, then try both. For k-28, run it first with `a.customer_id <> b.customer_id` and count the rows, then fix it.
>
> **You should see:** k-24 returns 8 customers (`UNION ALL` would show 9, because customer 9 is in both lists); k-25 returns 4 (1, 2, 4, 7); k-26 returns 5 (1, 3, 5, 7, 9); k-27 returns 12 rows, with Gold and bank_transfer at 0; k-28 returns 4 pairs (`<>` gives 8, each pair twice); k-29 returns 6 rows, the last one `ALL` with 18.

## @lesson CASE, subqueries and CTEs
Three tools finish the everyday toolbox: **CASE** (if/else inside a query), the **subquery** (a query inside another), and the **CTE** (a named step, so a long query reads from top to bottom).

### CASE: if / else

**CASE** is SQL's if/else, used to create categories. The first `WHEN` that is true wins, like `if / elif / else` in Python:

```sql
SELECT name,
       CASE WHEN price_idr < 80000 THEN 'cheap'
            WHEN price_idr < 95000 THEN 'regular'
            ELSE 'premium' END AS segment
FROM products;
```

:::drill sql Label the products
Show each product's `name` and a `segment`: `'budget'` when `price_idr` is below 85000, `'standard'` when it is below 100000, and `'premium'` otherwise.
@data kopiku
@names
@starter
-- write your query below this line

@check
/case/ ## Use CASE WHEN ... THEN ... ELSE ... END.
@hint
`CASE WHEN price_idr < 85000 THEN 'budget' WHEN price_idr < 100000 THEN 'standard' ELSE 'premium' END AS segment`
@solution
SELECT name, CASE WHEN price_idr < 85000 THEN 'budget' WHEN price_idr < 100000 THEN 'standard' ELSE 'premium' END AS segment FROM products;
:::

`CASE` also makes portable counts: `SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)` counts the cancelled rows in every database.

:::drill sql Count with CASE
Show how many orders were `'cancelled'` as `cancelled` and how many were `'delivered'` as `delivered`, in one row, using `SUM(CASE WHEN ...)`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/case/ ## Use SUM(CASE WHEN ... THEN 1 ELSE 0 END).
@hint
`SELECT SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered FROM orders;`
@solution
SELECT SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered FROM orders;
:::

### A subquery: a query inside a query

A **scalar subquery** returns one value, handy for comparisons with a total or an average, and for shares of a total:

```sql
SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS pct
FROM orders
GROUP BY payment_method;
```

:::drill sql Above the average
Show the `name` of the products that cost **more than the average** product price. Use a subquery for the average.
@data kopiku
@starter
-- write your query below this line

@check
/\(\s*select/ ## Put a subquery in brackets: (SELECT AVG(price_idr) FROM products).
@hint
`WHERE price_idr > (SELECT AVG(price_idr) FROM products)`
@solution
SELECT name FROM products WHERE price_idr > (SELECT AVG(price_idr) FROM products);
:::

### A CTE: name an intermediate result

A **CTE** (common table expression, `WITH name AS (...)`) names an intermediate result, so a long query reads from top to bottom like a recipe. Watch one built in two steps:

:::sqlsteps A query as a recipe
@data kopiku
@stage 1. Step one, named order_totals: one row per order
WITH order_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT * FROM order_totals
@say
The CTE `order_totals` has one row per order. You can select from it on its own to check it.
@stage 2. Step two: join it to orders
WITH order_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT o.order_id, o.status, t.order_total FROM orders o JOIN order_totals t ON t.order_id = o.order_id
@say
Joining a one-row-per-order result to `orders` cannot fan out. This is the safe way to combine a finer-grain table: aggregate it first, then join.
@stage 3. Step three: use the result
WITH order_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT o.order_id, o.status, t.order_total FROM orders o JOIN order_totals t ON t.order_id = o.order_id WHERE t.order_total >= 200000
@say
Only the big orders are left.
:::

:::drill sql The three biggest lines
Using a CTE named `line_totals` (one row per order with `SUM(qty * unit_price_idr)` as `order_total`), show the **three orders with the biggest total**: `order_id` and `order_total`, biggest first.
@data kopiku
@ordered
@starter
-- write your query below this line

@check
/with\s+line_totals/ ## Start with WITH line_totals AS (...).
@hint
`WITH line_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT order_id, order_total FROM line_totals ORDER BY order_total DESC LIMIT 3;`
@solution
WITH line_totals AS (SELECT order_id, SUM(qty * unit_price_idr) AS order_total FROM order_items GROUP BY order_id) SELECT order_id, order_total FROM line_totals ORDER BY order_total DESC LIMIT 3;
:::

Prefer CTEs over deeply nested subqueries: they are easier to read, debug (select from each step on its own) and review. Style matters because other people will maintain your SQL. Put each clause on its own line, use clear aliases, keep keywords consistent in case, and add a comment that says *why* a filter exists ("exclude test accounts") rather than what it does.

> 💡 **Practice Pause 5 (CASE & CTE - Complete the Entire Lab):**
> Complete the final two queries in `labs/mod-0-3/answers.sql`:
> 1. `-- k-9`: categorize orders into 'small', 'medium', and 'large' using a CTE (`WITH ... AS`) and `CASE WHEN`.
> 2. `-- k-10`: compute the percentage share of each payment method using a scalar subquery `(SELECT COUNT(*) FROM orders)`.
> Now test all 10 answers in your terminal:
> `python3 labs/mod-0-3/check.py`
> If your score is **10/10 answers correct**, your entire foundational analytical SQL mastery is proven! Proceed to Lesson 9 for DML & Transactions.

## @part Changing and defining tables

## @lesson Changing data safely: DML, constraints and transactions
Besides reading, SQL **changes** data. Three statements do it, and each one asks for care.

### INSERT, UPDATE, DELETE

```sql
INSERT INTO customers (customer_id, name, city, tier, signup_date)
VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');

UPDATE customers SET tier = 'Silver' WHERE customer_id = 11;

DELETE FROM customers WHERE customer_id = 11;
```

In these drills the checker runs your statements and then looks at the table to see what is in it.

:::drill sql Add a customer
Add a new customer: id `11`, name `'Lina Marlina'`, city `'Medan'`, tier `'Bronze'`, signup date `'2026-02-01'`.
@data kopiku
@verify
SELECT customer_id, name, city, tier, signup_date FROM customers WHERE customer_id = 11
@starter
-- write your statement below this line

@check
/insert\s+into/ ## Use INSERT INTO customers ... VALUES (...).
@hint
`INSERT INTO customers (customer_id, name, city, tier, signup_date) VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');`
@solution
INSERT INTO customers (customer_id, name, city, tier, signup_date) VALUES (11, 'Lina Marlina', 'Medan', 'Bronze', '2026-02-01');
:::

> **Warning:** `UPDATE` and `DELETE` without a `WHERE` change **every row**. Before running either, run the same `WHERE` in a `SELECT` and check the row count. In production, run it inside a transaction (below) and check before committing.

:::ask What does this do?
```sql
UPDATE customers SET tier = 'Gold';
```
@options
* every customer changes: there is no WHERE
only the first customer changes
it fails with a syntax error
@why
Without a `WHERE`, an `UPDATE` touches every row. This is one of the most expensive typing mistakes in data work. Always write the `WHERE` first, check it with a `SELECT`, then change the data.
:::

:::drill sql Update only one row
Change the tier of customer `5` (Rina Pratama) to `'Gold'`. **Only** that customer must change.
@data kopiku
@verify
SELECT tier, COUNT(*) AS customers FROM customers GROUP BY tier ORDER BY tier
@starter
-- write your statement below this line

@check
/update/ ## Use UPDATE customers SET ... WHERE ...
/where/ ## Without WHERE every customer would change. Add WHERE customer_id = 5.
@hint
`UPDATE customers SET tier = 'Gold' WHERE customer_id = 5;`
@solution
UPDATE customers SET tier = 'Gold' WHERE customer_id = 5;
:::

:::drill sql Delete with a condition
Delete the orders whose status is `'cancelled'`. Check first with a `SELECT` what a `WHERE` would match; here, write the `DELETE`.
@data kopiku
@verify
SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY status
@starter
-- write your statement below this line

@check
/delete\s+from/ ## Use DELETE FROM orders WHERE ...
/where/ ## Add a WHERE, or every order is deleted.
@hint
`DELETE FROM orders WHERE status = 'cancelled';`
@solution
DELETE FROM orders WHERE status = 'cancelled';
:::

### Constraints: the database says no

**Constraints** let the database reject bad data instead of storing it: `PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK (qty > 0)`. A rule enforced by the database holds no matter which application writes to it; a rule that lives only in app code holds until someone writes a script.

### Transactions: all or nothing

A **transaction** groups statements so that they succeed or fail *together*:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;      -- or ROLLBACK; to undo both
```

If the server crashes between the two updates, neither takes effect; money is never lost.

:::ask You run BEGIN, then DELETE FROM orders WHERE status = 'cancelled', then ROLLBACK. How many orders are in the table now?
@options
16 orders: the delete stayed
0 orders: everything is gone
* 18 orders: ROLLBACK undid the delete
@why
`ROLLBACK` undoes everything since `BEGIN`. The delete would have left 16 orders; the rollback brings back the original 18. `COMMIT` would have made the delete permanent.
:::

:::advanced ACID, indexes and dialects
Transactions provide **ACID** guarantees: *Atomicity* (all or nothing), *Consistency* (constraints always hold), *Isolation* (concurrent transactions do not see each other's half-finished work) and *Durability* (committed data survives a crash). These guarantees are why production databases are trustworthy, and why Module 2.2 will care so much when lakes try to add them to plain files.

An **index** is a separate lookup structure that makes finding rows by a column fast, like the index of a book. It speeds reads and slows writes slightly; Module 1.3 returns to when and how to create them.

**SQL has dialects.** The core in this lesson works everywhere, but date functions, string functions, `LIMIT` versus `TOP`, and special features differ between SQLite (used in this course's sandbox), PostgreSQL, MySQL, DuckDB, Snowflake and BigQuery. When something fails after copying a query, check the dialect first.
:::

> 🛠 **Try it (8 min, SQL Sandbox).** A transaction lets you try a change and take it back. Run these as two separate runs: (1) `BEGIN; DELETE FROM orders WHERE status = 'cancelled'; SELECT COUNT(*) FROM orders;` and then (2) `ROLLBACK; SELECT COUNT(*) FROM orders;`. Then practise the safe habit: write `SELECT COUNT(*) FROM orders WHERE status = 'cancelled'` first, and only afterwards the `DELETE` with the same `WHERE`.
>
> **You should see:** `16` after the delete inside the transaction and `18` after `ROLLBACK`; the check query before the delete says `2`. Without `BEGIN` the delete would stay until you press **Reset data**.

## @lesson Defining tables: DDL, types and views
So far you read and changed rows. **DDL** (Data Definition Language) creates and changes the *structure*: `CREATE`, `ALTER` and `DROP`.

### CREATE TABLE: types and constraints

A table you design yourself has columns, each with a **type**, optional **constraints**, and optionally a `DEFAULT`:

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

We ran this kind of table and each constraint rejects a bad row: a `stars` of 9 fails with `CHECK constraint failed`, a missing `customer_id` with `NOT NULL constraint failed`, and a second review by the same customer of the same product with `UNIQUE constraint failed`. Choose types deliberately: whole numbers `INTEGER`, text `TEXT`, dates and times as real date types where the engine has them (ISO text in SQLite), and **money never as floating point**: in SQLite `0.1 + 0.2 = 0.3` is **false** (the sum is 0.30000000000000004). KopiKu stores rupiah as `INTEGER`.

:::drill sql Design a table
Create a table `tags` with three columns: `tag_id` (INTEGER, the primary key), `label` (TEXT, NOT NULL) and `product_id` (INTEGER).
@data kopiku
@verify
SELECT name, type, "notnull", pk FROM pragma_table_info('tags') ORDER BY cid
@starter
-- write your statement below this line

@check
/create\s+table\s+tags/ ## Use CREATE TABLE tags (...).
@hint
```sql
CREATE TABLE tags (
  tag_id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  product_id INTEGER
);
```
@solution
CREATE TABLE tags (tag_id INTEGER PRIMARY KEY, label TEXT NOT NULL, product_id INTEGER);
:::

:::advanced The engine may not enforce what you declared
This is a real SQLite behaviour we measured: SQLite lets you insert `'abc'` into an `INTEGER` column and stores the text (PostgreSQL and DuckDB refuse with an error). SQLite also **does not enforce foreign keys by default** (`PRAGMA foreign_keys` returns 0 in Python's SQLite and in the sandbox). We inserted an order for customer 99, who does not exist, and it was accepted. After `PRAGMA foreign_keys = ON` the same insert failed with `FOREIGN KEY constraint failed`, and PostgreSQL always refuses it. A constraint you never verified is a hope. Test the constraints you rely on by trying to break them.
:::

### ALTER TABLE: changing a table

`ALTER TABLE customers ADD COLUMN email TEXT` adds a column, and every existing row gets NULL there (we checked). `DROP COLUMN` and `RENAME` exist (SQLite 3.35+, PostgreSQL, others). `DROP TABLE` removes the table and its data, so run it only on purpose.

:::drill sql Add a column
Add a column `email` (TEXT) to the `customers` table. Do not remove anything.
@data kopiku
@verify
SELECT name, type FROM pragma_table_info('customers') ORDER BY cid
@starter
-- write your statement below this line

@check
/alter\s+table/ ## Use ALTER TABLE customers ADD COLUMN ...
@hint
`ALTER TABLE customers ADD COLUMN email TEXT;`
@solution
ALTER TABLE customers ADD COLUMN email TEXT;
:::

Changes to a shared table should be written as small, ordered **migration scripts** kept in version control, run the same way in every environment, and preferably **backwards compatible** (adding a nullable column does not break existing queries; renaming one does). Module 3.2 returns to schema changes in streams.

### Views: a name for a query

A **view** gives a name to a query:

```sql
CREATE VIEW v_gold AS SELECT * FROM customers WHERE tier = 'Gold';
```

A view stores **the query, not the data**. We created `v_gold` when it matched 1 row, inserted another Gold customer, and the view immediately returned 2 rows.

:::drill sql Create a view
Create a view `v_delivered` that shows the orders whose status is `'delivered'` (all columns).
@data kopiku
@verify
SELECT order_id, status FROM v_delivered ORDER BY order_id
@starter
-- write your statement below this line

@check
/create\s+view\s+v_delivered/ ## Use CREATE VIEW v_delivered AS SELECT ...
@hint
`CREATE VIEW v_delivered AS SELECT * FROM orders WHERE status = 'delivered';`
@solution
CREATE VIEW v_delivered AS SELECT * FROM orders WHERE status = 'delivered';
:::

:::ask A view and a snapshot table (CREATE TABLE snap AS SELECT ...) were both made when a source table had 5 rows. Then one more row is inserted into the source. What do they show?
@options
* the view shows 6 rows, the snapshot still 5
both the view and the snapshot show 6 rows
both the view and the snapshot show 5 rows
@why
A view stores the **query**, so it always reads the current data. A table created with `CREATE TABLE ... AS SELECT` (CTAS) stores a **snapshot** that does not change when the source does (and it loses the constraints of the original). PostgreSQL and warehouses also offer **materialized views**: stored results that are **stale until refreshed**.
:::

Why this matters for data engineers: views are how a team defines a metric in one place ("revenue" means this query) and how a warehouse exposes a safe subset of columns. The models you build with dbt in Module 2.3 are views and tables created by DDL that the tool writes for you; knowing what they are underneath is what lets you debug them.

> 🛠 **Try it (10 min, SQL Sandbox).** Create the `reviews` table from this lesson, then break it on purpose, one rule at a time: a review with 9 stars; the same customer reviewing the same product twice; a review without a customer. Read each error. Then create a view `v_delivered` (`SELECT * FROM orders WHERE status = 'delivered'`), count its rows, insert one more delivered order into `orders`, and count again.
>
> **You should see:** `CHECK constraint failed: stars BETWEEN 1 AND 5`, then `UNIQUE constraint failed: reviews.customer_id, reviews.product_id`, then `NOT NULL constraint failed: reviews.customer_id`; and a view whose count goes from `12` to `13` without you touching the view.

With Level 0 complete, you know Python basics, the terminal, Git, data cleaning and core SQL. Level 1 turns those tools into automated engineering work: shell pipelines and containers (`Module 1.1`), defensive Python jobs (`Module 1.2`), and analytical window functions (`Module 1.3`).

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
6. Optional: build the database yourself and explore it at a `sqlite>` prompt, with nothing to install (Python 3.12 or newer): `python3 -m sqlite3 kopiku.db < labs/mod-0-3/datasets/kopiku.sql`, then `python3 -m sqlite3 kopiku.db`. At `sqlite>` list the tables with `select name from sqlite_master where type = 'table';`, see how `orders` was created with `select sql from sqlite_master where name = 'orders';`, then try any query, ending each with `;`. Leave with `.quit`.

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

### `SELECT customer_id FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders)` returns no rows at all, although some customers have never ordered. What is the most likely cause?
- [x] At least one `orders.customer_id` is NULL, so every NOT IN comparison is unknown and no row passes
- [ ] NOT IN only works when the subquery returns a single value, so a list of ids always gives nothing back
- [ ] The subquery is run once per customer, and it times out quietly on a table as large as `orders`
- [ ] NOT IN compares text, so integer customer ids never match and are filtered out

> `x NOT IN (1, 2, NULL)` means `x <> 1 AND x <> 2 AND x <> NULL`, and the last part is never true. Use `NOT EXISTS`, or filter the NULLs out of the subquery.

### What is the difference between `UNION` and `UNION ALL`?
- [ ] `UNION` stacks the rows of both queries, `UNION ALL` keeps only the rows they have in common
- [ ] `UNION ALL` also sorts the combined result, which is why it is the slower one of the two
- [ ] There is none in practice; `ALL` only matters when both queries read from the same table
- [x] `UNION` removes duplicate rows from the combined result, while `UNION ALL` keeps every row

> Removing duplicates costs a sort or a hash. When duplicates cannot occur, or should be kept (adding up two months), `UNION ALL` is both correct and cheaper.

## @resources
- [SQLite SQL language reference](https://www.sqlite.org/lang.html)
- [PostgreSQL tutorial: SQL basics](https://www.postgresql.org/docs/current/tutorial-sql.html)
- [Python sqlite3 module documentation](https://docs.python.org/3/library/sqlite3.html)
