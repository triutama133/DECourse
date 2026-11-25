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
Module 0.3 (joins, GROUP BY, NULL, CTEs). You can prototype Part A in the browser SQL Sandbox; to complete the module and generate a proof code, save all 10 Part A queries in `labs/mod-1-3/answers.sql` (checked with Python's built-in SQLite), complete Part B in PostgreSQL (an embedded copy is installed by `pip`, so Docker is optional), and run `python3 scripts/prove.py mod-1-3`.

## @part Window functions and recursion

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
| 95,000 | 7 | 6 | 3 |

- `ROW_NUMBER()` gives every row a unique number, breaking ties arbitrarily unless your `ORDER BY` is unique. Add a tiebreaker (`ORDER BY order_total, order_id`) so results are deterministic.
- `RANK()` gives ties the same rank and then **skips** (1, 1, 1, 4).
- `DENSE_RANK()` gives ties the same rank without skipping (1, 1, 1, 2).
- `NTILE(4)` splits the ordered rows into 4 buckets of nearly equal size (quartiles); if the rows do not divide evenly, the first buckets get one extra.

Pick by the question: "the top 3 *orders*" is ROW_NUMBER; "the orders with the three highest *distinct totals*" is DENSE_RANK.

### See it: GROUP BY collapses, a window keeps every row

:::sqlsteps One row per customer, or one row per order?
@data kopiku
@stage 1. The orders: 18 rows, one per order
SELECT order_id, customer_id FROM orders ORDER BY customer_id, order_id
@say
Several customers have more than one order.
@stage 2. GROUP BY collapses them: one row per customer
SELECT customer_id, COUNT(*) AS orders_of_customer FROM orders GROUP BY customer_id ORDER BY customer_id
@say
The individual orders are gone. You can no longer see *which* order is which.
@stage 3. A window function keeps every order and adds the same number to each row
SELECT order_id, customer_id, COUNT(*) OVER (PARTITION BY customer_id) AS orders_of_customer FROM orders ORDER BY customer_id, order_id
@say
All 18 rows are still here. `PARTITION BY customer_id` made one little group per customer, and every row of the group got that group's count.
:::

:::ask Three orders tie for the lowest total, then comes a bigger total. What is the RANK() of the bigger one (ordered from smallest)?
@options
2
* 4
3
@why
`RANK()` gives ties the same rank and then **skips**: 1, 1, 1, then 4. `DENSE_RANK()` would not skip (1, 1, 1, 2), and `ROW_NUMBER()` would number the rows 1, 2, 3, 4 and break ties arbitrarily.
:::

:::drill sql Rank with ties
Show each order's `order_id` and `shipping_fee_idr`, and its rank by shipping fee, **highest fee first**, as `fee_rank`. Orders with the same fee must share the same rank (and the next rank skips).
@data kopiku
@names
@starter
-- write your query below this line

@check
/over\s*\(/ ## Use a window function: RANK() OVER (ORDER BY ...).
/rank\s*\(/ ## Use RANK(): ties share a rank and the next one skips.
@hint
`RANK() OVER (ORDER BY shipping_fee_idr DESC) AS fee_rank`
@solution
SELECT order_id, shipping_fee_idr, RANK() OVER (ORDER BY shipping_fee_idr DESC) AS fee_rank FROM orders;
:::

:::drill sql Number each customer's orders
Show `order_id`, `customer_id`, and `nth_order`: 1 for the customer's first order, 2 for the second, and so on (by `order_date`, then `order_id`). The numbering restarts for every customer.
@data kopiku
@names
@starter
-- write your query below this line

@check
/partition\s+by/ ## Restart the numbering for each customer: PARTITION BY customer_id.
/row_number/ ## Use ROW_NUMBER().
@hint
`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS nth_order`
@solution
SELECT order_id, customer_id, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS nth_order FROM orders;
:::

:::drill sql Keep every row, add a count
Show every order (`order_id`, `customer_id`) and, on the same row, how many orders its customer has in total, as `customer_orders`. Do **not** use GROUP BY: the 18 rows must stay.
@data kopiku
@names
@starter
-- write your query below this line

@check
/over\s*\(/ ## Use a window function: COUNT(*) OVER (PARTITION BY ...).
!/group\s+by/ ## Do not use GROUP BY here (it would collapse the rows).
@hint
`COUNT(*) OVER (PARTITION BY customer_id) AS customer_orders`
@solution
SELECT order_id, customer_id, COUNT(*) OVER (PARTITION BY customer_id) AS customer_orders FROM orders;
:::

> 💡 **Practice Pause 1 (Window Ranking & Partition Share):**
> Time to try ranking window functions and non-collapsing aggregations:
> 1. Open `labs/mod-1-3/answers.sql` in your text editor (or open the SQL Sandbox in your web browser!).
> 2. Solve the following 3 challenges under their markers:
>    - `w-4`: Compute each order's percentage share of that customer's total (`SUM(order_total) OVER (PARTITION BY customer_id)` without ORDER BY).
>    - `w-5`: Rank orders by largest `order_total` without skipping numbers on ties (`DENSE_RANK() OVER (ORDER BY order_total DESC)`).
>    - `w-7`: Split all orders into 4 equal quartiles (`NTILE(4) OVER (ORDER BY order_total, order_id)`).
> 3. Test in the terminal:
> `python3 labs/mod-1-3/check.py`
> When w-4, w-5, and w-7 show PASS, proceed to Lesson 2 to understand frames and running totals!

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

### See it: a running total and a moving average

Daily revenue of the Jakarta store for two weeks. Watch two columns being added, each looking at a different set of rows:

:::sqlsteps Frames: which rows does each row look at?
@data daily_sales
@stage 1. The days, in order
SELECT day, revenue FROM daily_sales WHERE store = 'jakarta' ORDER BY day
@say
14 days, one row per day.
@stage 2. A running total: this row and every row before it
SELECT day, revenue, SUM(revenue) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running FROM daily_sales WHERE store = 'jakarta' ORDER BY day
@say
`UNBOUNDED PRECEDING` means "from the very first row". The total only ever grows.
@stage 3. A 3-day moving average: this row and the 2 before it
SELECT day, revenue, ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 0) AS avg_3d FROM daily_sales WHERE store = 'jakarta' ORDER BY day
@say
The window slides. The first two days average over fewer rows, because there are not 2 rows before them yet.
:::

:::ask Three orders are tied at 85,000 and are ordered by total only. With the DEFAULT frame (no ROWS written), what running total does the first of the three show?
@options
* 255,000
85,000
170,000
@why
With `ORDER BY` and no frame, the default is `RANGE ...`, which treats tied rows as **peers**: each tied row includes all of its peers, so all three show 85,000 x 3 = 255,000. Write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` (and a unique ORDER BY) for a true row-by-row running total.
:::

:::drill sql A running total
For the `'jakarta'` store, show `day`, `revenue` and the running total of revenue so far as `running`, in day order. Write the frame explicitly with `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.
@data daily_sales
@names
@starter
-- write your query below this line

@check
/rows\s+between\s+unbounded\s+preceding\s+and\s+current\s+row/ ## Write the frame explicitly: ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW.
/where/ ## Only the 'jakarta' store.
@hint
`SUM(revenue) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running` and `WHERE store = 'jakarta'`
@solution
SELECT day, revenue, SUM(revenue) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running FROM daily_sales WHERE store = 'jakarta';
:::

:::drill sql A moving average per store
For **every** store, show `store`, `day` and the average revenue of the current day and the 2 days before it, **within that store**, as `avg_3d`. Use `PARTITION BY store`.
@data daily_sales
@names
@starter
-- write your query below this line

@check
/partition\s+by\s+(?:\w+\.)?store/ ## Keep the stores apart: PARTITION BY store.
/rows\s+between\s+2\s+preceding/ ## Use ROWS BETWEEN 2 PRECEDING AND CURRENT ROW.
@hint
`AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS avg_3d`
@solution
SELECT store, day, AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS avg_3d FROM daily_sales;
:::

> 💡 **Practice Pause 2 (Frames & Moving Averages):**
> Master row frame specifications for cumulative sums and rolling averages:
> 1. In `labs/mod-1-3/answers.sql` (or SQL Sandbox), solve 2 frame challenges:
>    - `w-1`: Running total of customer spend ordered by date (`SUM(...) OVER (PARTITION BY customer_id ORDER BY order_date, order_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`).
>    - `w-6`: 7-day moving average per store (`AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`).
> 2. Test in the terminal:
> `python3 labs/mod-1-3/check.py`
> When w-1 and w-6 show PASS, proceed to Lesson 3 to inspect neighboring rows with LAG/LEAD!

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

**The latest-record-per-key pattern** is the most useful window trick in data engineering. Whenever a table holds several versions of the same entity (many address changes per customer, repeated events, CDC, Change Data Capture, rows from database change logs), keep one:

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY effective_ts DESC) AS rn
  FROM customer_changes
)
SELECT * FROM ranked WHERE rn = 1;
```

You cannot put a window function directly in `WHERE`, because windows are computed *after* WHERE, so you compute it in a CTE or subquery and filter outside. Snowflake, BigQuery and DuckDB offer `QUALIFY` as a shortcut (`... QUALIFY ROW_NUMBER() OVER (...) = 1`); PostgreSQL and SQLite do not, so know the portable form. The same pattern with `rn <= 3` gives **top-N per group**, and ordering by an update timestamp makes it the standard **de-duplication** step in pipelines. Make the ORDER BY unique (add a tiebreaker like the id) or the surviving row is arbitrary.

### See it: LAG looks at the row before

:::sqlsteps Compare each day with the day before
@data daily_sales
@stage 1. The days
SELECT day, revenue FROM daily_sales WHERE store = 'jakarta' ORDER BY day
@say
One revenue per day.
@stage 2. LAG brings the previous row's value onto this row
SELECT day, revenue, LAG(revenue) OVER (ORDER BY day) AS yesterday FROM daily_sales WHERE store = 'jakarta' ORDER BY day
@say
The first day has no row before it, so `yesterday` is NULL.
@stage 3. Subtract: the change since yesterday
SELECT day, revenue, revenue - LAG(revenue) OVER (ORDER BY day) AS change FROM daily_sales WHERE store = 'jakarta' ORDER BY day
@say
A number minus NULL is NULL, so the first row's change is NULL too: a missing comparison, not a zero.
:::

:::drill sql Change since the day before
For the `'jakarta'` store, show `day`, `revenue` and the change since the previous day as `change` (the first day has no change: NULL). Order by day.
@data daily_sales
@names
@starter
-- write your query below this line

@check
/lag\s*\(/ ## Use LAG(revenue) OVER (ORDER BY day).
@hint
`revenue - LAG(revenue) OVER (ORDER BY day) AS change`
@solution
SELECT day, revenue, revenue - LAG(revenue) OVER (ORDER BY day) AS change FROM daily_sales WHERE store = 'jakarta' ORDER BY day;
:::

:::ask Can you write `WHERE ROW_NUMBER() OVER (PARTITION BY k ORDER BY t DESC) = 1` directly?
@options
yes, it is the standard way to filter
* no: WHERE runs first, so use a CTE
only in SQLite, other engines refuse it
@why
`WHERE` runs before window functions exist. So the portable pattern is two steps: `WITH ranked AS (SELECT *, ROW_NUMBER() OVER (...) AS rn FROM t) SELECT * FROM ranked WHERE rn = 1`. Snowflake, BigQuery and DuckDB have the shortcut `QUALIFY`; PostgreSQL and SQLite do not.
:::

:::drill sql The cheapest per roast
Show, for each `roast`, the single cheapest product: `roast` and `name`. Use `ROW_NUMBER()` in a CTE and keep rank 1 outside.
@data kopiku
@names
@starter
-- write your query below this line

@check
/row_number\s*\(/ ## Use ROW_NUMBER() OVER (PARTITION BY roast ORDER BY price_idr).
/with\s/ ## Compute the number in a CTE (WITH ...), then filter outside.
@hint
Compute `ROW_NUMBER() OVER (PARTITION BY roast ORDER BY price_idr) AS rn` inside a CTE over `products`, then select `roast` and `name` from that CTE `WHERE rn = 1`.
@solution
WITH ranked AS (SELECT roast, name, ROW_NUMBER() OVER (PARTITION BY roast ORDER BY price_idr) AS rn FROM products) SELECT roast, name FROM ranked WHERE rn = 1;
:::

> 💡 **Practice Pause 3 (Looking Sideways & De-duplication):**
> Retrieve the latest records and measure gaps between events:
> 1. In `labs/mod-1-3/answers.sql` (or SQL Sandbox), solve the following challenges:
>    - `w-2`: Select each customer's latest order using `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC)` (using `order_id DESC` as a tiebreaker) filtered to rank 1 in a CTE.
>    - `w-3`: Compute the day gap since the customer's previous order using `LAG(order_date)` and `julianday` subtraction.
> 2. Test in the terminal:
> `python3 labs/mod-1-3/check.py`
> When w-2 and w-3 show PASS, you have mastered core data engineering de-duplication! Proceed to Lesson 4 on gaps & islands.

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

(`ROWS UNBOUNDED PRECEDING` is shorthand for `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.) The shape is always the same: **flag the boundary, then cumulative-sum the flags to get a group id.** It reappears in event processing (Module 3.3) and in slowly changing dimensions (Module 1.4).

### See it: date minus row number

For user 1 (logins on March 1, 2, 3 and 5, 6, 7, 8) the island trick turns every streak into a constant:

:::sqlsteps Gaps and islands: date minus row number
@data logins
@stage 1. The login days of user 1
SELECT login_date FROM logins WHERE user_id = 1 ORDER BY login_date
@say
Seven days, with a gap on March 4.
@stage 2. Number the rows 1, 2, 3...
SELECT login_date, ROW_NUMBER() OVER (ORDER BY login_date) AS rn FROM logins WHERE user_id = 1 ORDER BY login_date
@say
The row number goes up by one every row.
@stage 3. Subtract the row number from the date
SELECT login_date, ROW_NUMBER() OVER (ORDER BY login_date) AS rn, julianday(login_date) - ROW_NUMBER() OVER (ORDER BY login_date) AS grp FROM logins WHERE user_id = 1 ORDER BY login_date
@say
Inside a streak both the date and the row number go up by one, so the difference stays **constant**. After the gap the date jumps by 2 while the row number goes up by 1, so the constant changes. Same constant = same island.
@stage 4. Group by the constant: one row per island
WITH g AS (SELECT login_date, julianday(login_date) - ROW_NUMBER() OVER (ORDER BY login_date) AS grp FROM logins WHERE user_id = 1) SELECT MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days FROM g GROUP BY grp ORDER BY streak_start
@say
Two islands: 3 days and 4 days.
:::

There is a second way to get the same groups, the one the clickstream example uses: **flag** the row where a new group starts, then take a **running sum** of the flags.

:::ask Why is `date - row_number` the same for every day of one streak?
@options
dates and row numbers are unrelated numbers
the database stores each streak internally
* both rise by one per day, so their gap stays constant
@why
In a streak every row is exactly one day after the previous row, so the date and the row number grow in lockstep. A gap makes the date jump more than the row number, and the difference changes: a new island starts. If a date can repeat, de-duplicate first.
:::

:::drill sql Which days start a streak?
For every login, show `user_id`, `login_date` and `starts`: `1` when this login **starts a new streak** (it is the user's first login, or more than 1 day after the user's previous login), otherwise `0`. Use `LAG` and `julianday`.
@data logins
@names
@starter
-- write your query below this line

@check
/lag\s*\(/ ## Use LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date) to see the previous login.
/case/ ## Use CASE WHEN ... THEN 1 ELSE 0 END.
@hint
Use `LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date)` for the previous day. In a `CASE` expression, return `1` when the previous date `IS NULL` or the `julianday()` gap is `> 1`, else `0`.
@solution
SELECT user_id, login_date, CASE WHEN LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date) IS NULL OR julianday(login_date) - julianday(LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date)) > 1 THEN 1 ELSE 0 END AS starts FROM logins;
:::

:::drill sql How many streaks does each user have?
Show `user_id` and the number of separate streaks, as `streaks`. Flag the streak starts in a CTE, then add the flags up per user.
@data logins
@names
@starter
-- write your query below this line

@check
/with\s/ ## Flag the starts in a CTE (WITH ...), then sum the flags.
/sum\s*\(/ ## SUM the flags per user.
@hint
`WITH flagged AS (SELECT user_id, CASE WHEN ... THEN 1 ELSE 0 END AS starts FROM logins) SELECT user_id, SUM(starts) AS streaks FROM flagged GROUP BY user_id;`
@solution
WITH flagged AS (SELECT user_id, CASE WHEN LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date) IS NULL OR julianday(login_date) - julianday(LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date)) > 1 THEN 1 ELSE 0 END AS starts FROM logins) SELECT user_id, SUM(starts) AS streaks FROM flagged GROUP BY user_id;
:::

:::drill sql Give every streak a number
Show `user_id`, `login_date` and `streak_no`: the number of the streak the login belongs to (1 for the first streak of the user, 2 for the second...). Flag the starts in a CTE, then take a **running sum** of the flags with a window.
@data logins
@names
@starter
-- write your query below this line

@check
/over\s*\(/ ## Use a running SUM(starts) OVER (PARTITION BY user_id ORDER BY login_date).
@hint
`SUM(starts) OVER (PARTITION BY user_id ORDER BY login_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS streak_no`
@solution
WITH flagged AS (SELECT user_id, login_date, CASE WHEN LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date) IS NULL OR julianday(login_date) - julianday(LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date)) > 1 THEN 1 ELSE 0 END AS starts FROM logins) SELECT user_id, login_date, SUM(starts) OVER (PARTITION BY user_id ORDER BY login_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS streak_no FROM flagged;
:::

> 💡 **Practice Pause 4 (Gaps, Islands, & Sessionization):**
> Combine window functions to solve advanced analytical patterns:
> 1. In `labs/mod-1-3/answers.sql` (or SQL Sandbox), solve the island and session challenges:
>    - `ch-3`: Find the longest consecutive login streak using the island constant `julianday(login_date) - ROW_NUMBER()`.
>    - `ch-4`: Sessionize web clickstream data by flagging gaps > 30 mins with `LAG` and accumulating session IDs with `SUM()`.
> 2. Test in the terminal:
> `python3 labs/mod-1-3/check.py`
> When ch-3 and ch-4 show PASS, proceed to Lesson 5 to traverse hierarchies with recursive CTEs!

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

### See it: a recursive query runs in rounds

:::sqlsteps The tree is walked one level per round
@data categories
@stage 1. Round 0, the anchor: the roots (no parent)
WITH RECURSIVE tree AS (SELECT id, name, 0 AS depth FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.id, c.name, tree.depth + 1 FROM categories c JOIN tree ON c.parent_id = tree.id) SELECT id, name, depth FROM tree WHERE depth <= 0
@say
The anchor query finds the root: Coffee.
@stage 2. Round 1: the children of the previous round
WITH RECURSIVE tree AS (SELECT id, name, 0 AS depth FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.id, c.name, tree.depth + 1 FROM categories c JOIN tree ON c.parent_id = tree.id) SELECT id, name, depth FROM tree WHERE depth <= 1
@say
The recursive part is applied to the rows of the previous round: Beans and Gear appear.
@stage 3. Round 2: their children
WITH RECURSIVE tree AS (SELECT id, name, 0 AS depth FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.id, c.name, tree.depth + 1 FROM categories c JOIN tree ON c.parent_id = tree.id) SELECT id, name, depth FROM tree WHERE depth <= 2
@say
Single Origin, Blends, Grinders and Brewers.
@stage 4. Until a round returns nothing
WITH RECURSIVE tree AS (SELECT id, name, 0 AS depth FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.id, c.name, tree.depth + 1 FROM categories c JOIN tree ON c.parent_id = tree.id) SELECT id, name, depth FROM tree
@say
The result is the union of all rounds: 12 rows. The query stops when a round finds no new children.
:::

:::ask In the data, category A's parent is B and B's parent is A. What does an unprotected `WITH RECURSIVE` do?
@options
returns the first two rows and stops
* loops forever without a depth limit
raises an error at once about the cycle
@why
A cycle means every round produces new rows forever. Always bound the recursion: a depth condition in the recursive part (and `CYCLE` detection in PostgreSQL).
:::

:::drill sql A date spine
Generate every day from `'2026-02-01'` to `'2026-02-07'` (inclusive) with a recursive CTE: one column `d`, one row per day.
@data categories
@names
@starter
-- write your query below this line

@check
/with\s+recursive/ ## Use WITH RECURSIVE.
/date\s*\(/ ## The step adds a day using date(...).
@hint
Start `WITH RECURSIVE days(d) AS (...)` with an anchor selecting `date('2026-02-01')`, `UNION ALL` a recursive step advancing by `'+1 day'` while `d < '2026-02-07'`, then select `d`.
@solution
WITH RECURSIVE days(d) AS (SELECT date('2026-02-01') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < '2026-02-07') SELECT d FROM days;
:::

:::drill sql Everything under Gear
Show how many categories sit **below** `Gear` (id 3) at any depth, as `descendants` (do not count Gear itself). Start the recursion at Gear.
@data categories
@names
@starter
-- write your query below this line

@check
/with\s+recursive/ ## Use WITH RECURSIVE.
@hint
Anchor the recursive CTE at `categories WHERE id = 3`, join children via `c.parent_id = sub.id` in the recursive step, then subtract 1 from `COUNT(*)` so Gear itself is not counted.
@solution
WITH RECURSIVE sub AS (SELECT id FROM categories WHERE id = 3 UNION ALL SELECT c.id FROM categories c JOIN sub ON c.parent_id = sub.id) SELECT COUNT(*) - 1 AS descendants FROM sub;
:::

> 💡 **Practice Pause 5 (Recursive CTE Hierarchy Tree - Part A Complete):**
> Traverse nested relations of arbitrary depth:
> 1. In `labs/mod-1-3/answers.sql` (or SQL Sandbox), solve the final Part A challenge:
>    - `w-8`: Construct the KopiKu category tree with `WITH RECURSIVE`: anchor at roots (`parent_id IS NULL`), join children iteratively, increment `depth`, and concatenate the breadcrumb `path`.
> 2. Verify all of Part A in the terminal:
> `python3 labs/mod-1-3/check.py`
> When you see `10/10 answers correct`, Part A of this lab is 100% complete! Proceed to Lessons 6 & 7 to dissect database query plans and indexing.

## @part Performance: plans and indexes

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

Read it from the **innermost, most indented** node outward. PostgreSQL stores tables in fixed 8 kB **pages** (blocks), and `Buffers:` reports how many pages were served from RAM cache (`shared hit`) versus fetched from disk (`read`). `Seq Scan` reads the whole table (4,167 pages here) and throws away 166,653 rows per worker to keep 13: a lot of work for 40 result rows. Add the right index and the same kind of query becomes:

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

> 🛠 **Try it (12 min, Python and SQLite).** Load `data/orders.csv` into SQLite (if `data/` does not exist yet, generate it first with `python3 labs/shared/shopgen.py --out data`):
> ```python
> import csv, sqlite3
> con = sqlite3.connect(":memory:")
> con.execute("CREATE TABLE orders(order_id, customer_id, order_ts, status, payment_method, total_idr)")
> con.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?)", list(csv.reader(open("data/orders.csv")))[1:])
> ```
> For each query print `EXPLAIN QUERY PLAN` (last column): (1) `WHERE customer_id = '479'`; (2) the same after `CREATE INDEX ix_cust ON orders(customer_id)`; (3) `WHERE lower(customer_id) = '479'` with the index in place; (4) `WHERE order_ts >= '2026-01-10' AND order_ts < '2026-01-11'` before and after `CREATE INDEX ix_ts ON orders(order_ts)`.
>
> **You should see:** `SCAN orders` for (1); `SEARCH orders USING INDEX ix_cust (customer_id=?)` for (2); `SCAN orders` again for (3), because a function on the column defeats the index (sargability); and for (4) a `SCAN` that becomes `SEARCH orders USING INDEX ix_ts (order_ts>? AND order_ts<?)`.

### See it: scan, search, and the function that defeats the index

The same idea in SQLite's own plan (`EXPLAIN QUERY PLAN`, last column): without an index the database scans the whole table; with one it searches.

:::sqlsteps Scan, search, scan again
@data kopiku
@stage 1. No index: the plan scans the whole table
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3
@say
`SCAN orders`: every row is read to find the few of customer 3.
@stage 2. After CREATE INDEX: the plan searches
CREATE INDEX ix_cust ON orders(customer_id); EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3
@say
`SEARCH orders USING INDEX ix_cust (customer_id=?)`: it goes straight to the matching rows.
@stage 3. A function on the column defeats the index
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id + 0 = 3
@say
The index is on `customer_id`, not on `customer_id + 0`, so the database scans again. A condition that cannot use an index is not **sargable**: keep the column bare and rewrite the rest.
:::

:::ask The table has an index on `order_date`. Which filter can use it?
@options
`WHERE strftime('%Y-%m', order_date) = '2026-01'`
`WHERE substr(order_date, 1, 7) = '2026-01'`
* `WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01'`
@why
Wrapping the indexed column in a function (`strftime`, `substr`) hides it from the index, so the database scans every row. The half-open range on the bare column is sargable and searches the index.
:::

:::drill sql Make it sargable
This query is correct but cannot use an index on `order_date`: it counts the orders of January 2026 with `strftime`. Rewrite it with a half-open range on the bare column (no function around `order_date`). One number, `orders`.
@data kopiku
@names
@starter
SELECT COUNT(*) AS orders FROM orders WHERE strftime('%Y-%m', order_date) = '2026-01';
@check
!/strftime\s*\([^)]*order_date|substr\s*\([^)]*order_date|date\s*\(\s*order_date/ ## Do not wrap order_date in a function.
/>=/ ## Start the range: order_date >= '2026-01-01'.
@hint
`WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01'`
@solution
SELECT COUNT(*) AS orders FROM orders WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01';
:::

:::drill sql Add the index
Create an index on `orders(customer_id)` so that looking up one customer's orders searches instead of scanning. (Name it anything.)
@data kopiku
@verify
SELECT COUNT(*) AS indexes_on_customer_id FROM pragma_index_list('orders') il JOIN pragma_index_info(il.name) ii WHERE ii.seqno = 0 AND ii.name = 'customer_id'
@starter
-- write your statement below this line

@check
/create\s+index/ ## Use CREATE INDEX name ON orders(customer_id).
@hint
Use `CREATE INDEX <index_name> ON <table>(<column>);`, choose any index name, target `orders`, and index `customer_id`.
@solution
CREATE INDEX ix_orders_customer ON orders(customer_id);
:::

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

:::ask An index is on `(customer_id, order_date)`. Which query can use it AND get the rows already in date order, with no separate sort?
@options
* `WHERE customer_id = 3 ORDER BY order_date DESC LIMIT 10`
`WHERE order_date = '2026-01-10' ORDER BY customer_id`
`WHERE order_date > '2026-01-01'`
@why
A composite index is sorted by its **leftmost** column first, then the next. A filter on `customer_id` uses the leftmost prefix, and inside one customer the rows are already sorted by date. A filter on `order_date` alone cannot use the index efficiently: the date is only sorted within each customer.
:::

:::ask `status = 'done'` matches 99.8% of the rows. Will an index on `status` help that query?
@options
yes: an index always speeds up any filter
only if the index is a BRIN index
* no: scanning beats an index at 99.8%
@why
Selectivity matters. An index on a column where one value covers almost the whole table saves nothing. A partial index on the rare value (`WHERE status = 'pending'`) is the useful one.
:::

:::drill sql A composite index
Create an index named `ix_cust_date` on `orders` with the columns `customer_id` and then `order_date` (in that order).
@data kopiku
@ordered
@verify
SELECT name FROM pragma_index_info('ix_cust_date') ORDER BY seqno
@starter
-- write your statement below this line

@check
/ix_cust_date/ ## Name the index ix_cust_date.
@hint
List both columns inside the parentheses of `CREATE INDEX ix_cust_date ON orders(...)`, putting `customer_id` first and `order_date` second.
@solution
CREATE INDEX ix_cust_date ON orders(customer_id, order_date);
:::

> 💡 **Practice Pause 6 (Query Tuning & PostgreSQL Index Optimization - Part B):**
> Apply the art of index tuning to a 500,000-row PostgreSQL table:
> 1. Open `labs/mod-1-3/explain/indexes.sql` and `labs/mod-1-3/explain/queries.sql` in your text editor.
> 2. Define at most 3 indexes in `indexes.sql` to eliminate all Sequential Scans and remove the Sort step on Q3. Rewrite Q4 in `queries.sql` to be sargable (using date range filters instead of the `date()` function).
> 3. Install the Part B dependencies (embedded PostgreSQL included; on Python 3.14 or if you prefer Docker, see the `DATABASE_URL` Docker fallback in the Lab section Step 4) and run the plan verification in your terminal:
> `python -m pip install -r labs/mod-1-3/explain/requirements.txt`
> `pytest labs/mod-1-3/explain -v`
> When all Part B tests are GREEN (PASSED), you have mastered database query plan optimization at a professional level! Proceed to Lesson 8 to explore SQL dialect nuances.

## @part Dialects, subtotals and JSON

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

Read the second and fourth rows twice. A report that sorts by a nullable column puts the unknowns at the top in SQLite and at the bottom elsewhere, and moving a query from one engine to another reorders the result with no error: when order matters, write `NULLS FIRST` or `NULLS LAST` (PostgreSQL, DuckDB, Snowflake, BigQuery, and SQLite 3.30+). Row 3 also points to **collation**, the rule that decides whether text comparisons ignore letter case. SQL Server's default collation is case-insensitive, so `WHERE status <> 'cancelled'` also drops `'CANCELLED'` rows, whereas PostgreSQL, DuckDB, Spark and Snowflake compare case-sensitively by default and keep them; normalise text (for example `lower(trim(status))`) before comparing across engines. A `GROUP BY` that selects an ungrouped column is an *error* in PostgreSQL because the answer is ambiguous; SQLite returns one row's value without telling you, so a bug that PostgreSQL would catch passes silently in a prototype. When sqlglot moved a Snowflake `QUALIFY ROW_NUMBER() OVER (ORDER BY x)` to BigQuery it added `NULLS LAST`, which is the translator keeping the NULL order the same. And a dialect that is *forgiving* (storing `'abc'` in an integer column, reading `'12abc'` as 12) turns a data quality problem into a wrong number instead of an error. The pandas trap in Module 1.5 about guessing types is the same family.

**A working strategy.**

1. **Know your target engine** and test on it. A query that passes in the sandbox is not proven for the warehouse.
2. **Write the portable subset when you can**: CTEs, window functions, `CASE`, `COALESCE`, `CAST`, standard joins, `||`, explicit `NULLS FIRST/LAST`, half-open date ranges.
3. **Be explicit instead of relying on defaults**: decimals for ratios, `ORDER BY` with full tie-breakers, column lists in `INSERT`, and `GROUP BY` on every non-aggregated column.
4. **Wrap the differences**: in dbt (Module 2.3) cross-database macros such as `dbt.date_trunc` and `dbt.datediff` hide them, so a model runs on DuckDB in development and on a warehouse in production.
5. **When you meet a new engine**, answer these before writing queries: how are dates and time zones stored? what does `/` do with integers? where do NULLs sort? how are names quoted and compared (case, spaces)? are constraints and foreign keys enforced? how is a string aggregated? is there `QUALIFY`? how are `LIMIT`/`OFFSET` (or `TOP`, `FETCH FIRST`) spelled? what happens on a bad `CAST`?

The sandbox practice challenges **k-16 to k-23** (text, number, date functions and DDL, Module 0.3) and **w-11 to w-14** (QUALIFY, FILTER, date bucketing, a median without `MEDIAN()`) use exactly these ideas.

> 🛠 **Try it (10 min, optional DuckDB preview).** Want to see dialect differences live before Module 2.1 introduces DuckDB systematically? Run `pip install duckdb` and execute each statement on SQLite (`sqlite3`) and on DuckDB, printing both results side by side: `SELECT 7/2`; `SELECT 'abc' LIKE 'ABC'`; `SELECT x FROM (SELECT 1 AS x UNION ALL SELECT NULL UNION ALL SELECT 2) ORDER BY x`; `SELECT x, y FROM (SELECT 1 AS x, 2 AS y UNION ALL SELECT 1, 3) GROUP BY x` (catch the error).
>
> **You should see:** `3` against `3.5`; `1` against `False`; NULL first against NULL last; an arbitrary row `(1, 2)` against a `Binder Error`. Four silent differences in four lines: which one would have fooled you?

:::ask A report sorts customers by `city`, which has some NULLs. You move the query from SQLite to PostgreSQL. What happens?
@options
PostgreSQL refuses to sort a column that has NULLs
nothing changes: every engine sorts NULLs the same way
* NULLs move from top to bottom, with no error
@why
SQLite puts NULLs first in ascending order; PostgreSQL, DuckDB and the warehouses put them last. The query runs in both and the order silently differs, so write NULLS FIRST or NULLS LAST when order matters.
:::

## @lesson Subtotals and grand totals: GROUPING SETS, ROLLUP and CUBE
A report often needs detail rows, subtotals and a grand total in one table. With a plain `GROUP BY` that takes one query per level, glued together with `UNION ALL` (challenge k-29 does it for a single total row). SQL has an extension of `GROUP BY` that computes several groupings in **one pass** over the data:

- `GROUPING SETS ((a), (b), ())` lists exactly the groupings you want: by `a`, by `b`, and the grand total `()`.
- `ROLLUP (a, b)` is the hierarchy detail, subtotal, total: the groupings `(a, b)`, `(a)` and `()`. Use it when `b` lives inside `a` (a city, then a payment method).
- `CUBE (a, b)` is every combination: `(a, b)`, `(a)`, `(b)` and `()`. Use it for cross-tabs where either dimension can be the subtotal.

In every result row, the columns that were *rolled up* show NULL. On the six KopiKu products:

```sql
SELECT roast, origin, COUNT(*) AS products
FROM products
GROUP BY GROUPING SETS ((roast), (origin), ());
-- dark 2, light 2, medium 2  |  six origins with 1 each  |  the total 6   (10 rows)
```

**The NULL problem.** A subtotal row has NULL in the rolled-up column, but your data can contain real NULLs too. Two KopiKu customers have no city, so `ROLLUP (tier, city)` returns, for the Bronze tier, two rows that look identical:

```sql
SELECT tier, city, COUNT(*) AS customers, GROUPING(city) AS city_rolled_up
FROM customers
GROUP BY ROLLUP (tier, city);
-- Bronze  NULL  1  0   <- the one Bronze customer with no city: a real NULL
-- Bronze  NULL  5  1   <- the subtotal of all five Bronze customers
-- ... 14 rows in all, the last one   NULL  NULL  10  1   is the grand total
```

`GROUPING(column)` returns 1 when the NULL is a rolled-up placeholder and 0 when the column took part in the grouping. Never use `city IS NULL` to recognise a subtotal: it matches the real NULLs too, and a report would show a customer count as a "subtotal". Label the rows with `GROUPING`, and only then make the labels pretty (for example `CASE WHEN GROUPING(city) = 1 THEN 'All cities' ELSE COALESCE(city, 'Unknown') END`). Note that `GROUPING(a, b)` with several columns returns a bit mask (0, 1, 3), not a count.

**Where it runs.** PostgreSQL and DuckDB run all three and returned identical rows for every query on this page. The warehouses support them as well (from their documentation, not run in this course). SQLite does not: `GROUP BY ROLLUP (...)` fails there with `no such function: rollup`. That is why the browser SQL Sandbox cannot practise it and the exercise below runs DuckDB on your computer. On an engine without them, fall back to several `GROUP BY` queries joined with `UNION ALL`.

> 🛠 **Try it (25 min, optional local DuckDB preview before Module 2.1).** If you installed `duckdb` above (`pip install duckdb`), load `labs/mod-1-3/datasets/kopiku.sql` with `con = duckdb.connect(); con.execute(open("labs/mod-1-3/datasets/kopiku.sql").read())` to try these queries locally (Module 2.1 builds DuckDB and columnar engines from scratch). In a file `rollup.py`, define three variables that hold SQL text:
> 1. `REVENUE_ROLLUP` returns `city`, `payment_method`, `revenue_idr` and `level`. Revenue is the sum of `qty * unit_price_idr` over the items of **delivered** orders. Give the detail rows per city and payment method, a subtotal per city and a grand total, using `ROLLUP`. `level` is 0 for a detail row, 1 for a city subtotal and 2 for the grand total (build it with `GROUPING`, not with `IS NULL`).
> 2. `STATUS_CUBE` returns `status`, `payment_method` and `orders`: the number of orders for every status and payment method, for every status alone, for every method alone, and the total, using `CUBE`.
> 3. `TIER_OR_METHOD` returns `tier`, `payment_method` and `orders`: the number of orders per customer tier and, in the same result, per payment method, and nothing else, using `GROUPING SETS`.
>
> **You should see:** 15 rows for the first, among them Jakarta 760000 at level 1, the grand total 2000000 at level 2, and, for the customers with no city, a detail row (bank_transfer, 250000, level 0) followed by their subtotal (250000, level 1), which only `level` can tell apart from a detail row; 19 rows for the second, ending with the total 18; 7 rows for the third: Bronze 6, Gold 6, Silver 6, then bank_transfer 3, card 7, cod 3 and ewallet 5.
>
> **Check it:** `python3 labs/tryit/check.py 1.3-9 ~/practice` (your `rollup.py` in `~/practice`). It runs your three queries on the KopiKu data and on a changed copy with a new city, a customer with no city and an order with no payment method, so a query that only works on today's data fails.

:::ask `GROUP BY ROLLUP (tier, city)` returns which groupings?
@options
* (tier, city), then (tier), then the grand total
(tier, city) and (city) only, with no total
every possible combination, like CUBE
@why
ROLLUP is the hierarchy detail, subtotal, total. For (a, b) that is (a, b), (a) and (). CUBE would add (b) as well, and GROUPING SETS lets you list exactly the groupings you want.
:::

:::ask In a ROLLUP result a row has NULL in `city`. How do you tell a subtotal row from a customer whose city is really missing?
@options
test city IS NULL: it matches only subtotals
* GROUPING(city): 1 marks a rolled-up row
count the NULLs and assume the first one is real
@why
Real NULLs and rollup placeholders both show NULL. `GROUPING(column)` returns 1 for a placeholder and 0 when the column took part in the grouping. `IS NULL` matches both kinds.
:::

## @lesson JSON inside SQL: reading and building semi-structured data
APIs, event trackers and application databases store JSON: a text (or JSON) column where each row has its own shape. You do not have to leave SQL to use it: SQLite, PostgreSQL and DuckDB all read and build JSON. The SQL Sandbox has a dataset for this, `app_events`: seven app events, each with a `payload` such as `{"user": {"id": 7, "plan": "pro"}, "action": "checkout", "items": [{"sku": "A1", "qty": 2, "price": 50000}], "device": "ios"}`.

**Reading fields.** A *path* starts at `$`, uses dots for objects and `[0]` for array positions. The operator `->>` returns the value as a SQL value, so you can filter, group and sum it. A key that is missing and a key that holds JSON `null` both come back as SQL NULL (use `json_type` if you must tell them apart), so wrap optional fields in `COALESCE`. **Exploding arrays:** `json_each` returns one row per element, and `->>` then reads the fields of each element:

```sql
SELECT payload ->> '$.action' AS action, COUNT(*) AS events FROM events GROUP BY 1;     -- checkout 4, view 3

SELECT e.event_id, COUNT(i.key) AS n_items                                              -- 2, 0, 1, 0, 0, 0, 1
FROM events e LEFT JOIN json_each(e.payload, '$.items') i GROUP BY e.event_id;
```

(`GROUP BY 1` is positional shorthand for grouping by the first column in the `SELECT` list, here, `action`.) Notice the `LEFT JOIN` in the second query. With a plain join (`FROM events e, json_each(...)`) an event with an empty array or no `items` at all produces **zero rows**, so it silently disappears from the result. That is right when you want line items, and wrong when you are counting events.

**Building JSON** goes the other way, for APIs and for storing a nested record in one column:

```sql
SELECT payload ->> '$.user.id' AS user_id, json_group_array(event_id) AS event_ids FROM events GROUP BY 1;   -- 7: [1,3]   8: [2,7]   9: [4,5]   10: [6]
SELECT json_object('event', event_id, 'user', payload ->> '$.user.id') FROM events WHERE event_id = 1;   -- {"event":1,"user":7}
```

**Dialects.** We ran the same questions on SQLite 3.39 (the sandbox), PostgreSQL 16 (`jsonb` column) and DuckDB 1.5:

| Task | SQLite | PostgreSQL | DuckDB |
|---|---|---|---|
| A text field | `payload ->> '$.user.plan'` | `payload -> 'user' ->> 'plan'` | `payload ->> '$.user.plan'` |
| A number field | `->>` returns an **integer** | returns **text**: cast with `::int` | returns **text**: cast with `::INT` |
| One row per array element | `json_each(payload, '$.items')` | `jsonb_array_elements(payload -> 'items')` | `json_each(payload, '$.items')` |
| Build an object | `json_object('a', 1)` | `jsonb_build_object('a', 1)` | `json_object('a', 1)` |
| Collect values into an array | `json_group_array(x)` | `jsonb_agg(x)` | `json_group_array(x)` |
| Missing key or JSON `null` | NULL | NULL | NULL |

Two differences deserve a second look. `qty * price` works in SQLite because `->>` kept the numbers, but in PostgreSQL and DuckDB it fails with `text * text` until you cast: a loud failure, easy to fix. The silent one: in PostgreSQL, `payload ->> '$.user.id'` returns **NULL for every row**, with no error, because the `$.user.id` path syntax is not PostgreSQL's (it looks for a key literally named `$.user.id`). A query ported between engines can return an empty column and pass every syntax check.

**Habits.** Check `json_valid(payload)` before parsing: one malformed row makes the whole query fail (`malformed JSON` in SQLite). In PostgreSQL prefer `jsonb`, which is parsed once and can be indexed, over `json`, which is kept as text. Above all, **parse once, then use typed columns**: a staging model (Module 2.3) turns the JSON into columns with real types, and everything downstream queries those, not the text.

> 🛠 **Try it (25 min, SQL Sandbox with the app_events dataset).** Choose the dataset *App events (JSON payloads)* and solve **j-1** (pull `user.id` and `user.plan` out of the payload), **j-2** (events per device, with a missing device shown as `unknown`), **j-3** (one row per item with its line total) and **j-4** (revenue per plan). For j-3, first use a plain join and then a `LEFT JOIN`, and count the rows each version returns. Then, in the editor, try `SELECT typeof(payload ->> '$.user.id') AS id_type, typeof(payload ->> '$.user.plan') AS plan_type FROM events` to compare the extracted types (you should see `integer` vs `text`, and `null` where `plan` is missing).
>
> **You should see:** j-1 returns 7 rows with a NULL plan for event 6; j-2 returns android 2, ios 2, unknown 2, web 1; j-3 returns 4 rows (events 1, 1, 3 and 7), because events 2, 4, 5 and 6 have no items; j-4 returns free 50000 and pro 310000. The plain join gives 4 rows for j-3 and the `LEFT JOIN` gives 8: the same 4 plus one row with empty values for each of events 2, 4, 5 and 6.

:::ask You count events with `FROM events e, json_each(e.payload, '$.items')` and some events vanish from the result. Why?
@options
json_each deletes rows that it has already read
events with items are counted twice by definition
* an event with an empty array gives zero rows
@why
A plain join with json_each yields one row per array element, so an event with no items has nothing to join to and disappears. Use a LEFT JOIN when you are counting events rather than line items.
:::

## @part Performance and interviews

## @lesson Cost-based optimizer join operators, MVCC VACUUM, Sargable tuning, and the 7 SQL interview patterns {optional}

When you inspect an `EXPLAIN ANALYZE` plan in PostgreSQL, Spark, Snowflake, or BigQuery, the **Cost-Based Optimizer (CBO)** does not just decide whether to use an index—it also chooses the physical algorithm used to join two tables:

| Physical Join Operator | How It Works Under the Hood | Complexity & Memory Profile | When the Optimizer Picks It (and When It Goes Wrong) |
|---|---|---|---|
| **Nested Loop Join** | For each row in the outer table, probes the inner table (either a full scan or an index lookup). | O(N × M) without index; O(N log M) with inner B-Tree index. Near-zero memory. | Best when the outer table is tiny (< 1,000 rows) and the inner join key is indexed. **Disaster** when stale `ANALYZE` statistics trick the CBO into thinking a 5M-row table has 10 rows! |
| **Hash Join** | Reads the smaller table (*build side*) into an in-memory hash table on the join key, then streams the larger table (*probe side*) through it in one pass. | O(N + M) CPU time; requires O(size of the build table) RAM (`work_mem`). | The default workhorse for large equijoins (`ON a.id = b.id`). **Danger:** If the build table exceeds `work_mem` / executor RAM, it **spills to disk** in multi-batch passes (`Batches: 16` in Postgres `EXPLAIN`). |
| **Sort-Merge Join** | Sorts both tables on the join key (or reads them pre-sorted from a B-Tree index / clustered table) and zips them together in lockstep. | O(N log N + M log M) if unsorted; O(N + M) if already sorted/clustered. | Best for very large inputs that are already sorted on the key, or when neither side fits in memory. PostgreSQL uses it only for equality conditions; an inequality join (`<=`, `>=`) falls back to a nested loop. |

**PostgreSQL MVCC Dead Tuples, `VACUUM`, and `ANALYZE`.** In PostgreSQL, an `UPDATE` or `DELETE` does not overwrite the old row in place; under **Multi-Version Concurrency Control (MVCC)**, PostgreSQL writes a brand-new row version (*tuple*) and marks the old one as a **dead tuple** so concurrent readers see a consistent snapshot. If a staging table receives 500,000 updates a day and `autovacuum` lags behind, the table bloats to several times its true size (slowing sequential scans) and column statistics go stale. Running `VACUUM` reclaims dead-tuple space for reuse; running `ANALYZE` refreshes the histogram and cardinality estimates that the CBO relies on to avoid disastrous Nested Loop Joins.

**"Before vs. After" Sargable Slow-Query Refactoring Clinic.** A predicate is **Sargable (*Search Argument Able*)** when the database engine can push it directly into a B-Tree index seek or columnar micro-partition zone map without evaluating a function on every row:

```sql
-- ❌ SLOW (about 32 s on 300,000 orders in SQLite: correlated subquery + functions on the columns)
SELECT c.customer_id, c.city,
       (SELECT SUM(o.total_idr) FROM orders o
        WHERE o.customer_id = c.customer_id
          AND strftime('%Y-%m', o.order_ts) = '2026-01'
          AND LOWER(o.status) = 'paid') AS jan_paid_idr
FROM customers c;

-- ✅ FAST (about 19 ms on the same data: range seek on index (status, order_ts, customer_id) + one pre-aggregated CTE)
WITH jan_paid AS (
    SELECT customer_id, SUM(total_idr) AS jan_paid_idr
    FROM orders
    WHERE status = 'paid'
      AND order_ts >= '2026-01-01T00:00:00'
      AND order_ts <  '2026-02-01T00:00:00'
    GROUP BY customer_id
)
SELECT c.customer_id, c.city, COALESCE(j.jan_paid_idr, 0) AS jan_paid_idr
FROM customers c
LEFT JOIN jan_paid j ON j.customer_id = c.customer_id;
```

**The 7 Canonical 45-Minute SQL Live-Coding Interview Blueprints.** Nearly every Data Engineering SQL technical screen tests a variation of these seven templates. Before writing a single `SELECT`, always state to the interviewer: **(1) the output grain**, **(2) how ties are broken**, and **(3) what happens on `NULL`s or missing dates**:

| # | Canonical SQL Interview Blueprint | Core SQL Skeleton & Edge-Case Guard |
|---|---|---|
| **1** | **Deterministic Deduplication / Latest State** | `QUALIFY ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY updated_at DESC, event_id DESC) = 1` (Always include a unique tie-breaker column after `updated_at`!). |
| **2** | **Sessionization (30-Min Inactivity Gap)** | `LAG(event_ts) OVER (PARTITION BY user_id ORDER BY event_ts)` → flag `CASE WHEN diff_min > 30 OR prev_ts IS NULL THEN 1 ELSE 0 END AS is_new` → outer `SUM(is_new) OVER (PARTITION BY user_id ORDER BY event_ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` creates `session_id`. |
| **3** | **Consecutive Streak / Gaps & Islands** | Deduplicate to distinct `(user_id, active_date)` first! Then subtract `DATE(active_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY active_date) || ' days') AS island_anchor`; rows in the same consecutive streak share the exact same `island_anchor`. |
| **4** | **Point-in-Time (`ASOF`) / SCD2 Attribution** | Join fact to dimension with `f.event_ts >= d.effective_from AND f.event_ts < COALESCE(d.effective_to, '9999-12-31')` (or picking `ROW_NUMBER() ... ORDER BY d.updated_at DESC = 1` where `d.updated_at <= f.event_ts`). Prevents future label leakage! |
| **5** | **Rolling 7-Day Window on Sparse Dates** | Generate a continuous calendar `date_spine` first, `LEFT JOIN` daily aggregates (`COALESCE(rev, 0)`), then use `AVG(rev) OVER (PARTITION BY store_id ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` so a missing Tuesday isn't skipped by row count. |
| **6** | **Cohort Retention Matrix (`Month 0..N`)** | CTE 1: `first_month = MIN(order_month) OVER (PARTITION BY user_id)`. CTE 2: `month_num = date_diff('month', first_month, order_month)` (DuckDB; `DATEDIFF('month', ...)` in Snowflake/T-SQL). Final: `COUNT(DISTINCT user_id) * 100.0 / MAX(cohort_size)` grouped by `(first_month, month_num)`. |
| **7** | **Multi-Fact Fan-Out Prevention** | Never join `accounts` to `transfers` (1:N) and `chargebacks` (1:M) in the same `FROM` clause (5 × 3 = 15 rows!). Pre-aggregate `transfers_by_account` and `chargebacks_by_account` into separate CTEs at the `account_id` grain first, then `LEFT JOIN` both to `accounts`. |

> 🛠 **Try it (20 min, Python with `sqlite3`).** Build a test table: 2,000 customers and 300,000 orders with random `order_ts` between 2025-07-01 and 2026-06-30 (ISO text), random statuses (`paid` three times as likely as `cancelled` or `refunded`) and amounts, and create the index `(status, order_ts, customer_id)` before running `ANALYZE`. Run `EXPLAIN QUERY PLAN` on the slow and fast queries above and find the line for `orders` in each. Then time both and check that they return the same total.
>
> **You should see:** the slow plan reads `CORRELATED SCALAR SUBQUERY` and `SCAN o`: a full scan of the orders for each of the 2,000 customers, because the functions on `order_ts` and `status` hide the columns from the index. The fast plan reads `SEARCH orders USING INDEX ix_orders (status=? AND order_ts>? AND order_ts<?)`. Both return the same total (`3192691000` on the data measured here, `random.seed(7)`), in about `31` to `33` seconds versus `18` to `19` ms. Your numbers will differ a little with your own random data; the gap will not. Measured with SQLite 3.46.

:::ask Which WHERE clause lets the database use an index on `order_date`?
@options
* order_date >= '2026-01-01' AND order_date < '2027-01-01'
strftime('%Y', order_date) = '2026'
substr(order_date, 1, 4) = '2026'
@why
A predicate is sargable when the engine can seek in the index directly. A function wrapped around the column forces it to compute the function for every row. A plain range on the bare column keeps the index usable.
:::

## @part SQL Server and T-SQL

## @lesson SQL Server and T-SQL: the dialect many job posts expect {optional}
Microsoft's data tools are everywhere in this job market: of 1,134 data engineering postings in TalentHub (2026-07-23 to 2026-11-21), **53.9%** name at least one of Azure, SQL Server, SSIS (SQL Server Integration Services, Microsoft's ETL tool), Power BI, Fabric or Synapse, and **10.8%** ask for SQL Server or T-SQL by name. Banks and older enterprises often keep years of business logic in SQL Server **stored procedures** and SSIS packages, and a new data engineer is expected to read them, fix them and eventually move them. You already know SQL: `SELECT`, joins, `GROUP BY` and window functions work the same in **T-SQL** (Transact-SQL, the dialect of SQL Server, Azure SQL, Synapse and Fabric Warehouse). This lesson is the short list of differences that trip people up.

**Run it on your laptop, free.** SQL Server's Developer edition runs in Docker:

```bash
docker run -d --name mssql -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Kopiku#Dev2026" \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2025-latest
docker exec -it mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Kopiku#Dev2026' -C
```

Microsoft asks for at least 2 GB of RAM, and the password must have at least eight characters from three of: upper case, lower case, digits, symbols (otherwise the container stops). `-C` trusts the server's self-signed certificate, because the ODBC 18 tools encrypt connections by default. Inside `sqlcmd`, a statement runs when you type `GO` on its own line: `GO` ends a **batch**, and it is a command of the tool, not of T-SQL. Measured: the image is 2.2 GB, published for amd64 (Intel and AMD processors), and a fresh container answered queries after about 7 seconds, using about 640 MB of memory while idle.

**The differences that matter:**

| You know (PostgreSQL, DuckDB, SQLite) | T-SQL | Note |
|---|---|---|
| `LIMIT 10` | `TOP (10)`, or `ORDER BY ... OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY` | `LIMIT` is a syntax error |
| `QUALIFY ROW_NUMBER() OVER (...) = 1` (DuckDB) | number the rows in a CTE, then `WHERE rn = 1` | no `QUALIFY` (same as PostgreSQL/SQLite) |
| `'a' \|\| 'b'` | `'a' + 'b'` or `CONCAT('a', 'b')` | `'a' + NULL` is `NULL`; `CONCAT` skips `NULL`s. `\|\|` works from SQL Server 2025 |
| `COALESCE(x, 0)` | the same, or `ISNULL(x, 0)` | |
| `7 / 2` | `3` | integer division, as in PostgreSQL and SQLite; DuckDB gives `3.5` |
| `to_date(s, 'DD/MM/YYYY')` (PostgreSQL) / `strptime(s, '%d/%m/%Y')` (DuckDB) | `TRY_CONVERT(date, s, 103)` | style numbers: `126` is ISO 8601, `103` is dd/mm/yyyy; `TRY_` returns `NULL` instead of failing |
| `NOW()`, `d + INTERVAL '1 day'` (PostgreSQL/DuckDB) / `date(d, '+1 day')` (SQLite) | `GETDATE()`, `DATEADD(day, 1, d)`, `DATEDIFF(day, a, b)` | |
| `"order"` | `[order]` | square brackets quote names |
| `CREATE TEMP TABLE t` | `#t` (your session), `##t` (everyone) | |
| `string_agg(x, ',' ORDER BY x)` (PostgreSQL/DuckDB) / `group_concat(x, ',')` (SQLite) | `STRING_AGG(x, ',') WITHIN GROUP (ORDER BY x)` | |
| `TEXT` | `NVARCHAR(n)` with `N'...'` literals | `N` means Unicode: `DATALENGTH(N'abc')` is 6 bytes |
| `CREATE OR REPLACE` (PostgreSQL/DuckDB) | `CREATE OR ALTER` | for procedures, views and functions |

**Collation: the difference that changes numbers silently.** A **collation** decides how text compares. SQL Server's default (`SQL_Latin1_General_CP1_CI_AS`, measured) is **case-insensitive** (`CI`) and accent-sensitive (`AS`), so `status <> 'cancelled'` also excludes `CANCELLED` and `Cancelled`. DuckDB, PostgreSQL, Spark and Snowflake compare case-sensitively by default, so the same `WHERE` keeps those rows. On the course data the same query gives Rp 100,360,000 in SQL Server and Rp 101,925,000 in DuckDB for 10 to 12 January. When you move a SQL Server job to a lakehouse, normalise text (`lower(trim(status))`) before you compare, or the migrated numbers will not match and nobody will know why.

**Stored procedures.** A procedure is named T-SQL with parameters, stored in the database and run with `EXEC`. Legacy pipelines are often a chain of them, scheduled by SQL Server Agent, SSIS or Data Factory (Lesson 10 of Module 2.6). A safe loading procedure looks like this:

```sql
CREATE OR ALTER PROCEDURE dbo.usp_load_daily_revenue @day DATE
AS
BEGIN
    SET NOCOUNT ON;      -- no "(1 row affected)" chatter
    SET XACT_ABORT ON;   -- any error rolls the whole transaction back
    BEGIN TRAN;
    MERGE daily_revenue AS t
    USING (SELECT ... WHERE order_ts >= @day AND order_ts < DATEADD(day, 1, @day) ...) AS s
    ON t.order_date = s.order_date
    WHEN MATCHED THEN UPDATE SET orders = s.orders, revenue_idr = s.revenue_idr
    WHEN NOT MATCHED BY TARGET THEN INSERT (order_date, orders, revenue_idr)
        VALUES (s.order_date, s.orders, s.revenue_idr);   -- MERGE must end with a semicolon
    COMMIT;
END;
```

**DDL, DML, DCL and TCL.** *Fundamentals of Data Engineering* sorts SQL statements into four kinds, and T-SQL has all four: **DDL** defines objects (`CREATE`, `ALTER`, `DROP`), **DML** reads and changes rows (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`), **DCL** controls access (`GRANT`, `REVOKE`, and in SQL Server also `DENY`, which wins over any grant), and **TCL** controls transactions (`BEGIN TRAN`, `COMMIT`, `ROLLBACK`). The procedure above uses DML inside TCL; Module 2.6 will cover DCL for warehouse roles.

> 🛠 **Try it (30 min, Docker and `sqlcmd`).** Start SQL Server as above and copy the data in: `docker cp data/orders.csv mssql:/tmp/orders.csv`. Create a database `kopiku` and a table `raw_orders` with the six columns of the file, all `NVARCHAR(50)`, and load it with `BULK INSERT raw_orders FROM '/tmp/orders.csv' WITH (FORMAT = 'CSV', FIRSTROW = 2)`. Count the rows whose `total_idr` is all digits (`NOT LIKE '%[^0-9]%'`) and whose `order_ts` converts with style 126. If the answer surprises you, find out why before going on. Then create `daily_revenue (order_date DATE PRIMARY KEY, orders INT, revenue_idr BIGINT)`, finish the procedure above for orders that are not cancelled, and run it for 10, 11 and 12 January, twice. Finally, try `LIMIT` and `QUALIFY` on `raw_orders`.
>
> **You should see:** `3634` rows loaded, but `0` clean ones: the file ends its lines with `\r\n`, so every `total_idr` kept an invisible `\r` and no total is "all digits". Add `ROWTERMINATOR = '0x0d0a'`, reload, and you get `3539`. Style 126 reads `3593` timestamps and style 103 the other `41`. After both runs `daily_revenue` has `3` days and `100360000` (`109`, `108` and `93` orders): running twice changed nothing. `LIMIT 3` fails with `Incorrect syntax near '3'`, `QUALIFY` with `Incorrect syntax near 'ROW_NUMBER'`. Measured on SQL Server 2025 (17.0) in Docker. Stop it afterwards with `docker rm -f mssql`; the image stays until you `docker rmi` it.

:::ask In SQL Server with its default collation, `WHERE status <> 'cancelled'` is run on rows holding 'Cancelled' and 'CANCELLED'. What happens?
@options
both are kept, because the text is not an exact match
* both are excluded: the collation ignores case
the query fails with a collation error
@why
SQL Server's default collation is case-insensitive (CI), so 'cancelled', 'Cancelled' and 'CANCELLED' are all equal. PostgreSQL and DuckDB compare case-sensitively, so the same query counts differently there.
:::

## @lab Lab: window-function puzzles and a PostgreSQL tuning exercise
Part A: ten analytical questions answered with window functions and a recursive CTE, checked automatically. Part B: given four slow queries on a 500,000-row table in PostgreSQL, create the fewest indexes that make them fast, and rewrite one query so an index can be used. Part B is checked by reading the actual execution plans.

> 💡 **Already finished via Practice Pauses 1–6?** If all 10 Part A queries in `labs/mod-1-3/answers.sql` pass `python3 labs/mod-1-3/check.py` and all 10 Part B tests pass `pytest labs/mod-1-3/explain -v`, you can skip straight to `python3 scripts/prove.py mod-1-3` in the verify section below to generate your completion proof code.

### @steps
1. **Part A: prototype in the browser, save locally.** You can prototype and test any Part A query in the browser **SQL Sandbox** (pick a challenge tagged for this module, `ch-3`, `ch-4`, and `w-1`..`w-8`: running total, latest order, days since previous order, share of total, ranking with ties, moving average, quartiles, category tree, gaps-and-islands, and sessionization, and click "Check my answer"; each challenge switches to the right dataset for you). To complete the module and generate a proof code, save all 10 Part A queries (`ch-3`, `ch-4`, `w-1`..`w-8`) under their markers in `labs/mod-1-3/answers.sql`.
2. **Part A: verify locally.** Run `python3 labs/mod-1-3/check.py`. It compares your results in `labs/mod-1-3/answers.sql` with the reference using Python's built-in SQLite (no extra installation needed).
3. Do not skip the *why*: for the running total, try the default frame and the explicit `ROWS` frame and see the difference on tied rows; for ranking, try all three ranking functions.
4. **Part B, setup.** Install the requirements (an embedded PostgreSQL is included; no Docker needed):

```bash
python -m pip install -r labs/mod-1-3/explain/requirements.txt
pytest labs/mod-1-3/explain -v
```

   Most tests fail at first (6 of the 10 with the starter). That is the starting point. (To use your own PostgreSQL, for example the one from Docker, set `DATABASE_URL` to an empty scratch database. On Python 3.14 `pip` skips `pgserver` (it has no build for 3.14 yet), so start PostgreSQL in Docker instead: `docker run -d --name kopiku-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg16 -c wal_level=logical`, then `docker exec kopiku-pg psql -U postgres -c "CREATE DATABASE lab13"` and `export DATABASE_URL=postgresql://postgres:dev@localhost:5432/lab13`. That one container serves Modules 1.3, 3.2 and 3.5 (it has pgvector and logical decoding); measured on Python 3.14, the reference passes all 10 tests this way.)
5. **Part B, tune.** Open `labs/mod-1-3/explain/queries.sql` and `indexes.sql`. Look at the four queries and decide which columns each filters and sorts on. Write the **fewest** `CREATE INDEX` statements in `indexes.sql` so that no query does a Seq Scan, and Q3 needs no Sort. Rewrite Q4 in `queries.sql` so that it returns the same answer but can use an index.
6. To see what the tests see, load the table into any PostgreSQL and run `EXPLAIN (ANALYZE, BUFFERS)` on each query before and after your change; compare estimated and actual rows, pages read and time.
7. Re-run the tests until all 10 Part A queries and all 10 Part B tests pass (if one fails, its message says which rule you broke), then generate your completion proof code with `python3 scripts/prove.py mod-1-3`.

### @files
- labs/mod-1-3/answers.sql :: Part A working file: one query per marker :: starter
- labs/mod-1-3/check.py :: Part A checker (uses the datasets below) :: test
- labs/mod-1-3/datasets/kopiku.sql :: Dataset for most Part A questions :: data
- labs/mod-1-3/datasets/daily_sales.sql :: Dataset for the moving average :: data
- labs/mod-1-3/datasets/categories.sql :: Dataset for the recursive CTE :: data
- labs/mod-1-3/datasets/logins.sql :: Dataset for the gaps-and-islands challenge (ch-3) :: data
- labs/mod-1-3/datasets/clickstream.sql :: Dataset for the sessionization challenge (ch-4) :: data
- labs/tryit/check.py :: Checks your Try it exercises, for example: python3 labs/tryit/check.py 1.3-9 ~/practice :: config
- labs/mod-1-3/reference/answers.sql :: Part A reference answers (try first!) :: reference
- labs/mod-1-3/explain/requirements.txt :: Part B Python dependencies (pytest, psycopg, embedded pgserver) :: config
- labs/mod-1-3/explain/queries.sql :: Part B: the four queries (rewrite Q4) :: starter
- labs/mod-1-3/explain/indexes.sql :: Part B: put your CREATE INDEX statements here :: starter
- labs/mod-1-3/explain/test_lab.py :: Part B tests that inspect real execution plans :: test
- labs/mod-1-3/explain/reference/indexes.sql :: Part B reference indexes :: reference
- labs/mod-1-3/explain/reference/queries.sql :: Part B reference queries :: reference

### @deliverables
- All ten Part A queries (`ch-3`, `ch-4`, `w-1`..`w-8`) saved in `labs/mod-1-3/answers.sql` pass `python3 labs/mod-1-3/check.py`
- All ten Part B tests in `labs/mod-1-3/explain/` pass `pytest labs/mod-1-3/explain -v` (and `python3 scripts/prove.py mod-1-3` generates your completion proof code)
- For Part B you can explain, with the plan in front of you, why `(customer_id, event_time DESC)` removes the Sort but `(customer_id, event_type, event_time DESC)` does not

### @verify
You can prototype Part A queries in the browser **SQL Sandbox** ("Check my answer"), then save all 10 queries (`ch-3`, `ch-4`, `w-1`..`w-8`) into `labs/mod-1-3/answers.sql`, complete Part B (`labs/mod-1-3/explain/`), and verify locally to generate your completion proof code:

```bash
python3 labs/mod-1-3/check.py
pytest labs/mod-1-3/explain -v
python3 scripts/prove.py mod-1-3
```

Compare with the reference: `python3 labs/mod-1-3/check.py reference` and `LAB_DIR=reference pytest labs/mod-1-3/explain -v`.

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

### A `GROUP BY ROLLUP (city, payment_method)` result has a row with `city` NULL. How do you tell a subtotal row from customers whose city is really unknown?
- [ ] Subtotal rows always come last in the output, so the position of the row tells you which one it is
- [ ] Subtotals show the text `'ALL'` instead of NULL, so a NULL always means a real unknown city
- [x] `GROUPING(city)` is 1 where city was rolled up into a subtotal, and 0 where the NULL is real data
- [ ] You cannot tell them apart, so replace NULL cities with a placeholder before every ROLLUP query

> ROLLUP marks a rolled-up column with NULL, which collides with real NULLs. `GROUPING(col)` returns 1 for a subtotal level and 0 for a real value, including a real NULL.

### In PostgreSQL, `SUM(payload->>'amount')` fails although every `amount` in the JSON is a number. Why?
- [ ] `->>` only works on top-level keys, and `amount` is stored one level further down inside the payload
- [x] `->>` returns the value as text, so it must be cast (say `::numeric`) before it can be summed
- [ ] SUM cannot read JSON columns at all; you have to copy the values into a table first
- [ ] The key must be written as a path, `'$.amount'`, or PostgreSQL does not find it

> `->>` extracts text; `->` extracts JSON. Arithmetic needs a cast. (A JSONPath string such as `'$.amount'` after `->>` is not a path in PostgreSQL: it silently returns NULL.)

### A SQL Server job filters `WHERE status <> 'cancelled'`. Moved to DuckDB unchanged, it reports higher revenue. What is the likely cause?
- [ ] DuckDB rounds every BIGINT total up to the nearest thousand rupiah
- [x] SQL Server's default collation ignores case, so it also dropped CANCELLED rows
- [ ] DuckDB reads the CSV twice when a filter compares text values
- [ ] SQL Server's `<>` operator skips NULLs, while DuckDB's version counts them as cancelled

> SQL Server's default collation (`..._CI_AS`) is case-insensitive, so `'CANCELLED' <> 'cancelled'` is false there and true in DuckDB, PostgreSQL, Spark and Snowflake. Normalise text before you compare.

## @resources
- [PostgreSQL docs: window functions tutorial](https://www.postgresql.org/docs/current/tutorial-window.html)
- [PostgreSQL docs: using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL docs: indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL docs: WITH queries (recursive)](https://www.postgresql.org/docs/current/queries-with.html)
- [SQLite: window functions](https://www.sqlite.org/windowfunctions.html)
