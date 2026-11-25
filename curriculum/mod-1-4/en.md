---
title: Dimensional Modeling: Designing Tables for Analytics
duration: 3 weeks
summary: Learn to design star schemas the way analytics teams do: declare the grain, separate facts from dimensions, use surrogate keys, keep history with slowly changing dimensions, and test that the model gives the right numbers.
why: Tutorials say star schemas are dead and to dump everything into one big table. In real companies, tables without a clear grain double-count revenue, history gets overwritten, and nobody can say which number is right.
---

## @outcomes
- Explain why analytics uses a different table design from the application database, and follow the four-step dimensional design process
- Declare the grain of a fact table and identify measures, dimensions and degenerate dimensions
- Choose between SCD Types 0, 1, 2 and 3 for an attribute, and implement Type 2 with validity ranges and an as-of join
- Use surrogate keys and an "unknown" member so that every fact row points at a real dimension row
- Test a star schema for grain, referential integrity and reconciliation with the source

## @prereq
Modules 0.3 and 1.3 (joins, the fan-out trap, window functions such as LEAD, recursive CTEs). The lab uses plain SQL on SQLite plus a short Python helper; nothing extra to install for `test_lab.py` or `check.py` (install `pytest` via `pip install pytest` if you want to run `scripts/prove.py`).

## @part Designing a star schema

## @lesson Why analytics needs a different design
The application database that runs KopiKu is **normalised**: every fact is stored once, in many small tables, so writes are safe and fast (Module 0.3). A question like "revenue per customer tier per week by roast level" would need five or six joins across tables designed for something else, written by an analyst who must remember how they connect. It is slow, error-prone, and every analyst writes it slightly differently, so two dashboards disagree.

**Dimensional modeling**, popularised by Ralph Kimball, designs tables for *asking questions*. The idea is to separate two kinds of tables:

- **Fact tables** record **events or measurements**: an order line was sold, a payment was made, a page was viewed. They are long (millions or billions of rows) and mostly numbers and keys.
- **Dimension tables** describe **the things the facts are about**: who (customer), what (product), when (date), where (store). They are short and wide, full of text attributes people filter and group by.

Arranged around one fact table with a dimension on each side, the picture looks like a star, hence **star schema**:

```text
            dim_date
               |
dim_customer - fact_order_items - dim_product
```

A question becomes one fact table joined to a few small dimensions, with the same definitions for everyone: `SUM(line_total_idr)` grouped by `dim_customer.tier` and `dim_date.month`. Fewer joins, fewer chances to get it wrong, and queries that engines run quickly.

The design is done in four steps, in order. Skipping the order is the most common cause of confused models:

1. **Choose the business process.** Order fulfilment, payments, web sessions. One process, one fact table (to begin with).
2. **Declare the grain.** What does one row of the fact table represent? ("One row per order line.")
3. **Choose the dimensions.** Everything that describes a row at that grain: date, customer, product.
4. **Choose the facts (measures).** The numbers at that grain: quantity, unit price, line total.

> 🛠 **Try it (10 min, SQL Sandbox).** Answer "revenue per city and tier for delivered orders" on the normalised KopiKu tables (revenue = `qty * unit_price_idr`), ordered with `ORDER BY revenue DESC`. Count how many tables you had to join and how many `ON` conditions you had to get right. Then sketch on paper the star schema for the same question: which table holds the revenue, which tables hold city and tier?
>
> **You should see:** three tables (`orders`, `customers`, `order_items`) and two joins, and a first row `Bandung, Gold, 455000` followed by `Surabaya, Bronze, 365000`. In your sketch there is one fact table of order lines (the revenue) pointing at a customer dimension (city, tier): the analyst writes one join instead of remembering three tables.

**Three levels of a model: conceptual, logical, physical.** Before any of these steps there is a question of *how detailed* a model is. Teams describe a design at three levels, each for a different audience, and skipping straight to `CREATE TABLE` is how misunderstandings get baked into tables:

| Level | Answers | Audience | KopiKu example |
|---|---|---|---|
| **Conceptual** | Which things exist and how they relate, in business words | Business people | "A customer places orders. An order contains products. A product can be in many orders." |
| **Logical** | Attributes, keys and how many of each relate, independent of any database | Engineers and analysts | `customer(customer_id, name, city, tier)`, `order(order_id, customer_id)`, and `order_item(order_id, product_id, qty)` with key `(order_id, product_id)`: the many-to-many between orders and products becomes its own entity |
| **Physical** | How one specific engine stores it: types, constraints, indexes, partitioning | The engine and the people who run it | In SQLite: `INTEGER` money in rupiah, `NOT NULL`, `CHECK (qty > 0)`, foreign keys. In BigQuery: partition by order date, cluster by customer |

The conceptual level is where you catch the expensive mistakes cheaply: "can one order belong to two customers?" is a two-minute conversation on a whiteboard and a two-week migration after the tables exist. The four steps above (process, grain, dimensions, facts) are logical design for analytics; one logical model can then have several physical versions, one per engine.

The physical level differs more between engines than most people expect. An application database such as SQLite or PostgreSQL **enforces** keys: a bad row is refused. A cloud warehouse mostly does **not**: in Snowflake's standard tables, `PRIMARY KEY`, `FOREIGN KEY` and `UNIQUE` are "optional, not enforced" (only `NOT NULL` and `CHECK` are), and BigQuery's documentation warns that "key constraints aren't enforced" and that queries over tables with violated constraints "might return incorrect results", because the optimizer trusts the keys you declare. In a warehouse, the tests of lesson 6 do the job the constraints did in the application.

> 🛠 **Try it (15 min, Python).** Turn the logical model above into a physical one in SQLite with `sqlite3`: tables `customers`, `products`, `orders` and `order_items`, with primary keys, foreign keys (`REFERENCES`), `NOT NULL` and `CHECK (qty > 0)`. Run `PRAGMA foreign_keys = ON` first. Insert these 11 rows one at a time and catch `sqlite3.IntegrityError`: customers `(1,'Ani','Bandung','Gold')` and `(2,'Budi','Surabaya','Bronze')`; products `(10,'Gayo')` and `(11,'Toraja')`; orders `(100,1)`, `(101,2)`, `(102,99)`; order items `(100,10,2)`, `(100,11,1)`, `(100,10,1)`, `(101,11,-1)`. Count the stored rows. Then run it again without the `PRAGMA`, and once more with no constraints at all.
>
> **You should see:** with constraints, **8** rows stored and 3 refused: `FOREIGN KEY constraint failed` (order 102 for a customer who does not exist), `UNIQUE constraint failed: order_items.order_id, order_items.product_id` (the same product twice in one order) and `CHECK constraint failed: qty > 0`. Without the `PRAGMA`, **9** are stored: SQLite does not enforce foreign keys unless you switch them on, so the orphan order slips in silently. With no constraints, all **11** are stored, which is the normal situation in a warehouse. Measured with SQLite 3.46; older versions word the messages slightly differently.

:::ask What makes a star schema easier for analysts than the normalised application database?
@options
it stores each fact in many tiny tables to save space
it removes the need to ever write a JOIN
* a fact table with a few small dimensions
@why
A question becomes a fact table plus a few dimensions, with the same definitions for every analyst: fewer joins, fewer mistakes, and two dashboards that agree.
:::

## @lesson The grain: the most important sentence in the model
The **grain** is a single sentence that says what one row of a fact table means. For KopiKu: *"one row per order line: one product, in one order, at one price."* Everything else follows from it.

Why obsess over it?

- **It decides which dimensions are allowed.** At the order-line grain, product belongs on the row. At an *order* grain (one row per order), product does not, because an order has several. If you let a dimension that does not match the grain in, rows multiply (the fan-out trap from Module 0.3) or the dimension becomes ambiguous.
- **It decides what you can add up.** Measures only sum correctly at, or above, their own grain. A shipping fee stored once per order but copied onto every order line is wrong to sum; either store it at the order grain, or allocate it across lines explicitly.
- **It is testable.** "No two rows share the same (order_id, line_no)" is a one-line test that catches a whole class of bugs.

Rules of thumb:

- Store facts at the **lowest atomic grain** you can afford. You can always summarise detail up; you can never recover detail from a summary. (Pre-aggregated tables are useful as a *second* layer for speed, never as the only copy.)
- **Never mix grains in one fact table.** A table with some rows per order line and some rows per order is a bug factory.
- Write the grain sentence at the top of the model's documentation and in a test.

Types of fact tables, by how rows arrive:

| Type | One row is... | Example | Measures |
|---|---|---|---|
| **Transaction** | one event | an order line | additive: quantity, amount |
| **Periodic snapshot** | the state at a regular time | stock level per product per day | semi-additive: balances (do not sum across time) |
| **Accumulating snapshot** | one process instance, updated as it progresses | an order with placed, paid, shipped, delivered dates | dates and durations |

Measures also differ in **additivity**: *additive* (quantity, revenue) can be summed across every dimension; *semi-additive* (account balance, inventory) can be summed across customers but not across time; *non-additive* (ratios, percentages, averages) cannot be summed at all, so store the numerator and denominator and divide at the end.

:::ask Which sentence is a good grain statement for a fact table?
@options
"the sales table, all of it"
* "one row per order line: one product, one price"
"orders and customers and products"
@why
A grain says exactly **what one row means**. It decides which dimensions may sit on the row, what can be summed, and it can be tested: "no two rows share the same (order_id, line_no)". A table name or a list of subjects does not say what a row is.
:::

:::ask A `shipping_fee_idr` is stored once per order, but you copy it onto every order line. What goes wrong when you sum it?
@options
nothing: the total is the same
* an order with three lines counts three times
the sum becomes NULL because of the repeats
@why
Measures sum correctly only at (or above) their own grain. Copying a per-order value onto finer rows is the fan-out trap again: store it at the order grain, or allocate it across lines explicitly.
:::

:::drill sql Test the grain
Show how many `(order_id, line_no)` pairs appear **more than once** in `order_items`, as `violations`. A model with a clean grain returns 0. Group by the grain columns and keep the groups with more than one row.
@data kopiku
@names
@starter
-- write your query below this line

@check
/group\s+by/ ## Group by the grain columns: order_id, line_no.
/having/ ## Keep only the groups with COUNT(*) > 1.
@hint
Use a subquery that groups `order_items` by `order_id, line_no` and keeps groups with `HAVING COUNT(*) > 1`, then count the rows of that subquery as `violations`.
@solution
SELECT COUNT(*) AS violations FROM (SELECT order_id, line_no FROM order_items GROUP BY order_id, line_no HAVING COUNT(*) > 1);
:::

> 🛠 **Try it (10 min, SQL Sandbox).** `orders` holds a `shipping_fee_idr` per order. Compute the total fee two ways: `SELECT SUM(shipping_fee_idr) FROM orders;` and the same sum after joining `orders` to `order_items` on `order_id`. Then state the grain of each table in one sentence, and at which grain a shipping fee may be summed.
>
> **You should see:** `355000` and then `470000`, which is 32% too high: an order with three lines is counted three times. The fee belongs to the order grain, not the order-line grain.

## @lesson Dimensions: descriptive context
A dimension row describes one member (one product, one customer, one day) with many attributes you group, filter and label by: `roast_level`, `origin`, `tier`, `city`. Good dimensions are wide and denormalised on purpose, because you want one join, not a chain.

Some dimension patterns you will meet:

- **Date dimension.** A real table with one row per calendar day (and sometimes per time of day) with year, month, day name, week, quarter, `is_weekend`, holiday flags. Generating it from the calendar (not from your data) means days with no sales still exist, and every report shares one definition of "week" and "fiscal quarter". It is the one dimension nearly every fact table has.
- **Degenerate dimension.** An identifier with no attributes of its own, kept as a plain column in the fact table: `order_id` is the classic. It lets you group lines back into orders without a pointless one-column dimension table.
- **Role-playing dimension.** One dimension used several times by a fact: `order_date`, `ship_date` and `delivery_date` all point to `dim_date`. Create views or aliases, not copies.
- **Junk dimension.** Many tiny low-cardinality flags (payment method, gift wrap yes/no, status) combined into one small table instead of cluttering the fact.
- **Conformed dimension.** A dimension shared by several fact tables with the same meaning: the same `dim_customer` for orders and for support tickets. Conformed dimensions are what let you compare processes ("orders per customer versus tickets per customer"). A grid of business processes (rows) against shared dimensions (columns) is the **bus matrix**, the planning document of a warehouse.
- **Hierarchies** (product > category, city > province > country) live as columns inside one wide dimension.

Three layouts for the same data:

| | Star schema | Snowflake | One Big Table (OBT) |
|---|---|---|---|
| Shape | Fact + denormalised dimensions | Dimensions normalised into sub-tables | Everything pre-joined into one wide table |
| Joins per query | Few | More | None |
| Storage / update cost | Small repetition in dimensions | Least duplication | Heavy duplication, expensive to change |
| Clarity of meaning | High (grain, keys) | Medium | Low: what does a row mean? |
| Typical use | The shared warehouse model | Rare today | A convenience layer for a BI tool, built **from** the star |

Modern columnar engines compress repeated values so well that wide tables are cheap to *store*, which is why people declared the star schema dead. The claim confuses storage with design. The trouble with an OBT as the *only* model is not size; it is that it hides the grain, makes updates (a customer changing city) touch billions of rows, and invites each team to build its own variant. Treat the star as the shared, tested model and derive an OBT from it if a tool wants one.

:::ask A wide pre-joined "one big table" is the only model, and a customer changes city. What is the problem?
@options
* every row of that customer changes and the grain hides
nothing: storage is cheap, so it is fine
the table becomes a proper star schema
@why
The trouble with a one big table as the **only** model is not size: it hides the grain, makes updates expensive, and invites every team to define things differently. Build it **from** the star as a convenience layer, not instead of it.
:::

In a warehouse, each dimension row usually gets a warehouse-assigned integer id called a **surrogate key** (e.g. `product_sk`), while keeping the source system's id (the **natural key**, e.g. `product_id`) as a regular column, Lesson 4 explains why in detail.

:::drill sql A product dimension with a surrogate key
Build a tiny product dimension: `product_sk` (a surrogate key: 1, 2, 3... in the order of `product_id`), `product_id` (the natural key, kept as an ordinary column) and `name`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/row_number/ ## Create the surrogate key with ROW_NUMBER() OVER (ORDER BY product_id).
@hint
Select from `products` using `ROW_NUMBER() OVER (ORDER BY product_id)` aliased as `product_sk`, followed by `product_id` and `name`.
@solution
SELECT ROW_NUMBER() OVER (ORDER BY product_id) AS product_sk, product_id, name FROM products;
:::

> 💡 **Practice Pause 1 (Gap-free Calendar Date Dimension):**
> Practice generating a calendar date dimension table:
> 1. Open `labs/mod-1-4/answers.sql` in your text editor (or open the SQL Sandbox in your browser).
> 2. Solve challenge `d-4`: Generate 7 contiguous calendar days starting `2026-01-01` using `WITH RECURSIVE`. Compute integer `date_key` (YYYYMMDD), `full_date`, `day_name`, and `is_weekend` flag (1 for Saturday and Sunday).
> 3. Test in the terminal:
> `python3 labs/mod-1-4/check.py`
> When challenge d-4 shows PASS, you understand analytical calendar generation! Proceed to Lessons 4 & 5 on keys and Slowly Changing Dimensions (SCD).

## @lesson Keys: surrogate keys and the unknown member
**Natural keys** come from the source (`customer_id`, `product_id`). **Surrogate keys** are meaningless integers the warehouse assigns (`customer_sk`). Fact tables should join to dimensions on surrogate keys. Reasons:

- **They isolate you from the source.** Two source systems may use the same id for different customers; ids can be reused, renumbered, or change format after a migration.
- **They make history possible.** When a customer gets a new version (Type 2, below), one natural key has several rows; only a surrogate key can identify *which* version a fact belongs to.
- **They are small and fast** (an integer) to join on and store.

Keep the natural key in the dimension as an ordinary column too, so you can trace a row back to its source.

**Every fact row must point at a real dimension row.** Real data does not cooperate: an order arrives for a customer who is not in the customer extract yet (a *late-arriving* dimension), a product is deleted at the source, a value is missing. A NULL foreign key is poison: in an inner join the fact row silently vanishes and totals go down. The standard fix is the **unknown member**: a special dimension row with a reserved key (here `customer_sk = -1`, `city = 'Unknown'`) that facts point to when the real row cannot be found. Totals stay correct, the unknowns are visible (and countable, so you can alert on them), and when the real dimension row arrives later you can repair the facts.

In the lab's data, 32 order lines belong to customers who do not exist in the customer table. With an unknown member they appear as the "Unknown" tier with revenue of Rp 5,965,000; without it, that revenue would silently disappear from every report grouped by tier.

:::ask An order arrives for a customer who is not in the customer extract yet. The fact table is joined to the dimension with an INNER JOIN. What happens to that order?
@options
it is kept and shown under Unknown
* it drops silently; totals fall
the join stops with a clear error
@why
A fact row whose key matches no dimension row disappears in an inner join, with no error. The standard fix is an **unknown member** (for example key -1, "Unknown") that every orphan fact points at, so its revenue stays visible and countable.
:::

:::drill sql Keep the orphans
Show every order's `order_id` and the customer's `name`, but show `'Unknown'` when the customer does not exist in `customers`. Every order must stay in the result (the checker inserts an extra orphan order to verify `'Unknown'`). Use a `LEFT JOIN` and `COALESCE`.
@data kopiku
@names
@starter
-- write your query below this line

@check
/left\s+join/ ## Use LEFT JOIN so orders without a customer stay.
/coalesce/ ## Show 'Unknown' with COALESCE(c.name, 'Unknown').
@hint
Start from `orders`, `LEFT JOIN customers` on `customer_id`, and wrap the customer name column in `COALESCE(..., 'Unknown')` aliased as `name`.
@solution
SELECT o.order_id, COALESCE(c.name, 'Unknown') AS name FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id;
:::

> 🛠 **Try it (10 min, Python).** With the generated KopiKu files (run `python3 labs/shared/shopgen.py --out data` first if `data/` does not exist yet), find the orders whose `customer_id` does not exist in `data/customers.csv`, and how many order lines belong to them. Then decide: if the fact table required a real customer key, what would happen to those lines, and how would an "Unknown" member save them?
>
> **You should see:** `16` orders and `32` order lines (the number this lesson quotes). Write the one sentence you would put in the model's documentation about them.

## @part History, trust and other approaches

## @lesson Slowly changing dimensions: remembering what used to be true
Customers move, products are renamed, tiers are re-evaluated. A dimension's attributes change **slowly** over time, and you must decide what a report about the *past* should say. That decision is the **slowly changing dimension (SCD) type**, chosen per attribute:

| Type | What happens on change | History kept? | Use for |
|---|---|---|---|
| **0** | Never changes; ignore later updates | The original | Birth date, signup date |
| **1** | Overwrite the old value | None | Corrections of mistakes (a typo in a name) |
| **2** | Add a **new row** (a new version); keep the old one | Full | Anything where past reports must not change: city, tier, region, sales owner |
| **3** | Add a column for the previous value (`previous_city`) | One step back | When you only need before/after for one attribute |
| **4 / 6** | Mini-dimension for rapidly changing attributes / a hybrid of 1, 2 and 3 | Varies | Advanced cases |

Why does it matter? Using the lab's data: customers change tier over time. Revenue by tier, **using the tier each customer had at the time of purchase**, gives Gold Rp 97,650,000. Revenue using each customer's **current** tier (what a Type 1 overwrite would report) gives Gold Rp **104,485,000**, 7% higher. 444 order lines belong to a customer who has since changed. The second number is not wrong in a vacuum, but it silently *rewrote history*: a report that finance published last quarter would show different figures today.

**Type 2 mechanics.** Each version is a row with a validity range:

| customer_sk | customer_id | city | tier | valid_from | valid_to | is_current |
|---|---|---|---|---|---|---|
| 1 | 1 | Jakarta | Silver | 2026-01-01 | 2026-01-10 | 0 |
| 2 | 1 | Jakarta | Gold | 2026-01-10 | 2026-01-20 | 0 |
| 3 | 1 | Bandung | Gold | 2026-01-20 | 9999-12-31 | 1 |

`valid_from` is inclusive, `valid_to` exclusive and equal to the next version's `valid_from`, so ranges tile the timeline with no gaps and no overlaps. The far-future date for the open version avoids NULL logic in range checks. You can build the whole dimension from a change feed with one window function (`LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts)`), which is exactly challenge d-1 in the sandbox (note that `warehouse.sql` uses ISO-8601 timestamps with a `T`, so its far-future sentinel is `'9999-12-31T00:00:00'`).

**The as-of join.** To attach the right version to a fact, join on the natural key **and** the time range:

```sql
JOIN dim_customer c
  ON c.customer_id = o.customer_id
 AND o.order_ts >= c.valid_from
 AND o.order_ts <  c.valid_to
```

[[diagram:scd]]

If you forget the range and join on `customer_id` alone, every order matches *every* version of its customer: in the lab data 7,123 order lines become **8,552** rows, a silent 20% inflation. This is the Type 2 version of the fan-out trap. Tests for the model should assert that the fact row count is unchanged after building it.

**Loading a Type 2 dimension incrementally** (when you do not have a clean change feed, only today's snapshot): compare each incoming row with the current version on the *tracked* attributes; if different, close the current row (`valid_to = now`, `is_current = 0`) and insert a new current row. Use `IS DISTINCT FROM` rather than `<>` so a change to or from NULL is detected, and make the step idempotent (running twice must not create a second identical version). Two real-world complications: **late-arriving changes** (an update that happened Tuesday arrives on Thursday must be inserted *between* existing versions, re-cutting the ranges) and **out-of-order events** (always order by the source's event time, not by arrival time).

### See it: the as-of join, and what happens without the time range

Customer 1 has three versions in the dimension and three orders. Watch the join:

:::sqlsteps The as-of join
@data scd_demo
@stage 1. The three orders of customer 1
SELECT order_id, customer_id, order_ts FROM orders_small WHERE customer_id = 1 ORDER BY order_ts
@say
Three facts, three moments in time.
@stage 2. The three versions of customer 1 in the dimension
SELECT customer_sk, city, tier, valid_from, valid_to FROM dim_customer WHERE customer_id = 1 ORDER BY valid_from
@say
Silver until 10 January, Gold until 20 January, then Gold in Bandung. Each version has a validity range.
@stage 3. WRONG: join on customer_id alone
SELECT o.order_id, o.order_ts, d.tier, d.valid_from FROM orders_small o JOIN dim_customer d ON d.customer_id = o.customer_id WHERE o.customer_id = 1 ORDER BY o.order_id, d.valid_from
@say
3 orders x 3 versions = **9 rows**. Every order matches every version: a silent inflation (the Type 2 fan-out trap).
@stage 4. RIGHT: join on the key AND the time range
SELECT o.order_id, o.order_ts, d.tier, d.valid_from FROM orders_small o JOIN dim_customer d ON d.customer_id = o.customer_id AND o.order_ts >= d.valid_from AND o.order_ts < d.valid_to WHERE o.customer_id = 1 ORDER BY o.order_id
@say
Back to **3 rows**: each order meets exactly the version that was true when it happened. `valid_from` is inclusive and `valid_to` exclusive, so the ranges tile the timeline with no gap and no overlap.
:::

:::ask Orders are joined to the dimension on `customer_id` only, with no time range. Customer 1 has 3 orders and 3 versions. How many rows come out for that customer?
@options
3
6
* 9
@why
Without the time condition, every order matches every version of its customer: 3 x 3 = 9. A test that asserts "the fact row count is unchanged after the join" catches this immediately.
:::

:::drill sql Only the current version
Show `customer_id`, `city` and `tier` of the **current** version of each customer (the open-ended row), ordered by `customer_id`.
@data scd_demo
@ordered
@names
@starter
-- write your query below this line

@check
/is_current|9999/ ## Use the is_current flag (or the open valid_to of 9999-12-31).
@hint
`WHERE is_current = 1`
@solution
SELECT customer_id, city, tier FROM dim_customer WHERE is_current = 1 ORDER BY customer_id;
:::

:::drill sql Count the fan-out
Show how many **extra** rows the wrong join (on `customer_id` only) creates compared with the number of orders: one number, `extra_rows` (rows of the wrong join minus the number of rows in `orders_small`).
@data scd_demo
@names
@starter
-- write your query below this line

@check
/join/ ## Count the rows of orders_small JOIN dim_customer ON customer_id.
@hint
Subtract two scalar `COUNT(*)` subqueries: one counting the join of `orders_small` and `dim_customer` on `customer_id` alone, minus one counting `orders_small`, aliased as `extra_rows`.
@solution
SELECT (SELECT COUNT(*) FROM orders_small o JOIN dim_customer d ON d.customer_id = o.customer_id) - (SELECT COUNT(*) FROM orders_small) AS extra_rows;
:::

:::drill sql What was true on 15 January?
Show the `tier` that customer `1` had on `'2026-01-15 00:00:00'`, using the half-open range (`>= valid_from AND < valid_to`).
@data scd_demo
@names
@starter
-- write your query below this line

@check
/valid_to/ ## Use the end of the range: < valid_to.
/valid_from/ ## Use the start of the range: >= valid_from.
@hint
Select `tier` from `dim_customer` where `customer_id = 1` and the timestamp `'2026-01-15 00:00:00'` is `>= valid_from` and `< valid_to`.
@solution
SELECT tier FROM dim_customer WHERE customer_id = 1 AND '2026-01-15 00:00:00' >= valid_from AND '2026-01-15 00:00:00' < valid_to;
:::

> 💡 **Practice Pause 2 (SCD Type 2 & As-of Joins):**
> Master customer history tracking and point-in-time joins:
> 1. In `labs/mod-1-4/answers.sql` (or SQL Sandbox), solve 3 SCD challenges:
>    - `d-1`: Build an SCD Type 2 dimension from `customer_changes` using `LEAD(effective_ts)` for `valid_to` and `is_current`.
>    - `d-2`: Connect orders to the customer's tier at the time of purchase (as-of join: `order_ts >= valid_from AND order_ts < valid_to`).
>    - `d-3`: Aggregate revenue per customer tier at purchase time and verify no fan-out duplication occurred.
> 2. Test in the terminal:
> `python3 labs/mod-1-4/check.py`
> When all 4 challenges `d-1` through `d-4` show PASS (4/4 correct), your SCD foundation is solid! Proceed to Lesson 6 on testing and star schema assembly.

## @lesson Making models trustworthy: tests, tools and where modeling lives
A model is code and deserves tests. A minimum set, all of which the lab enforces:

- **Grain test**: the natural key of the fact (`order_id, line_no`) is unique and the row count equals the source's.
- **Referential integrity**: no fact foreign key is NULL, and every one exists in its dimension (this is where the unknown member earns its keep).
- **Reconciliation**: `SUM(line_total_idr)` in the fact equals the same sum in the source. If the model and the source disagree, one of them is wrong, and you should find out in a test, not in a board meeting.
- **Dimension tests**: surrogate keys unique, Type 2 ranges contiguous with exactly one current row per entity, no overlapping ranges.
- **A business-logic check from an independent calculation**: the lab computes revenue by tier at purchase in plain Python and compares it with the SQL result; two different methods agreeing is strong evidence.

**Where this lives in a modern stack.** In an ELT setup (Module 2.3), raw data lands in the warehouse, **staging** models clean and rename it (like the lab's `stg_` tables), and **marts** build the dimensional models on top: `dim_*` and `fct_*` tables. dbt's tests (`unique`, `not_null`, `relationships`) check keys and integrity, and its `snapshot` feature builds Type 2 dimensions for you. The thinking is the same whatever the tool.

Other methodologies exist and are worth knowing by name: **Inmon** (a normalised enterprise warehouse feeding marts), **Data Vault** (hubs, links and satellites, built for auditability and many sources) and **semantic layers** (a shared definition of metrics on top of the tables). Kimball's star schema remains the most common model for the layer analysts actually query.

Common mistakes to avoid: mixing grains; putting descriptive text in the fact table instead of a dimension; NULL foreign keys; using the natural key in the fact so history is impossible; summing a non-additive measure; making a dimension per flag instead of one junk dimension; and designing before asking what questions the business needs answered. Start from the questions, write the grain, and let the rest follow.

> 💡 **Practice Pause 3 (Build the KopiKu Star Schema in warehouse.sql):**
> Time to build the full production star schema warehouse!
> 1. Generate the KopiKu data if not done already (`python3 labs/shared/shopgen.py --out data`), then prepare the staging tables in your terminal:
> `python3 labs/mod-1-4/stage.py data warehouse.db`
> 2. Open `labs/mod-1-4/warehouse.sql` in your text editor.
> 3. Write DDL & DML for the 4 tables: `dim_date` (gap-free), `dim_product` (surrogate key), `dim_customer` (SCD Type 2 with unknown member `customer_sk = -1`), and `fact_order_items` (order line grain with as-of join).
> 4. Test the complete star schema integrity in the terminal:
> `python3 labs/mod-1-4/test_lab.py -v`
> 5. Because `test_lab.py` runs in `:memory:`, write the real `dim_*` and `fact_order_items` tables into `warehouse.db` on disk (needed for querying or Metabase in Lesson 8):
> `python3 -c "import sqlite3; sqlite3.connect('warehouse.db').executescript(open('labs/mod-1-4/warehouse.sql').read())"` (or `sqlite3 warehouse.db < labs/mod-1-4/warehouse.sql`)
> When all 13 unit tests show PASSED (OK), your KopiKu star schema meets enterprise standards!

:::ask A grain test on a fact table whose grain is 'one row per order line' checks what?
@options
* natural key is unique and row counts match
that every column contains at least one NULL
that dimensions have more rows than the fact
@why
Mixing grains is the most common modelling bug. If the natural key is not unique or the counts differ from the source, rows were duplicated or lost, and every sum is wrong.
:::

## @lesson Other ways to model: Inmon, Data Vault and one big table
> **In short:** The star schema is not the only design. **Inmon** keeps a normalised company-wide warehouse and builds star schemas from it. **Data Vault** splits data into hubs, links and satellites so that many changing sources can be loaded in parallel and every past value is kept. **One big table** joins everything in advance for speed. Each solves a different problem, and large companies often combine them.

Chapter 8 of *Fundamentals of Data Engineering* compares these approaches. In the TalentHub job database, 59% of the 1,130 data engineering postings mention data modeling, and 36 of them (3%) name Data Vault, mostly at large companies and consultancies (NTT DATA, Accenture, B. Braun, Traveloka, Indosat), often in Snowflake or Databricks roles.

| Approach | Shape | Good at | Costs you |
|---|---|---|---|
| **Inmon** | A normalised (3NF, Third Normal Form, where each non-key attribute depends only on the table's key) warehouse for the whole company, with star-schema marts built from it for each department | One version of each fact, little duplication | Many joins; changes need coordination across the company |
| **Kimball** (this module) | Fact tables at a declared grain, surrounded by dimensions | Easy, fast questions for analysts and BI tools | Merging many changing sources into shared dimensions takes work up front |
| **Data Vault** | Hubs (business keys), links (relationships) and satellites (attributes over time), loaded insert-only | Absorbs new sources and changing sources; keeps the full history for audits | Too many joins for analysts, so a star schema is usually built on top |
| **One big table** | One wide table per grain, everything joined in advance | No joins at query time; fast column scans | Hides mixed grains; one changed attribute can mean rewriting huge partitions |

### Inside a Data Vault
Kimball uses surrogate keys 1, 2, 3 handed out in order. With fifteen sources loading at the same time, handing out numbers in order becomes a bottleneck, and the same customer gets a different number in each system. Data Vault instead derives each key from the business key itself with a hash, so every loader computes the same key on its own. The Data Vault 2.0 standard commonly uses MD5; this module uses SHA-256, which works the same way. In Python's standard library, `hashlib.sha256(s.encode("utf-8")).hexdigest()` turns a string `s` into UTF-8 bytes and returns its 64-character hexadecimal SHA-256 hash.

Before hashing, normalise every input by trimming surrounding whitespace and upper-casing it, and join multi-part keys with `|`:

```text
hk_customer = SHA-256("C-101")          # hub key: normalised customer_id
hk_link     = SHA-256("C-101|O-5001")   # link key: customer and order, joined with |
hash_diff   = SHA-256("BANDUNG|GOLD")   # satellite: a fingerprint of the tracked attributes
```

- **Hub** (`hub_customer`): only the business key, its hash key, when it was first seen (`load_ts`) and where from (`record_source`). No descriptions.
- **Link** (`link_customer_order`): a relationship between hubs. Links are many-to-many by design, so a business rule that changes from one-to-many to many-to-many does not break the tables.
- **Satellite** (`sat_customer`): the attributes that change over time, such as city and tier, with a `hash_diff` fingerprint. A satellite is insert-only: a new row is added only when the fingerprint differs from that customer's *latest* row. Nothing is overwritten, so the full history stays.

> 🛠 **Try it (20 min, in your own terminal).** In a file `~/practice/datavault.py`, write `build_data_vault(events, record_source="kopiku_oms")`. Each event is a dict with `customer_id`, `order_id`, `city`, `tier` and `load_ts`, and the events may arrive in any order. Return a dict with four lists of dicts, using these keys:
> `hub_customer`: `hk_customer, customer_id, load_ts, record_source` · `hub_order`: `hk_order, order_id, load_ts, record_source`
> `link_customer_order`: `hk_link, hk_customer, hk_order, load_ts, record_source` · `sat_customer`: `hk_customer, city, tier, hash_diff, load_ts, record_source`
> Hash using the recipe above: business keys trimmed and upper-cased (store the trimmed, upper-cased `customer_id` and `order_id` values in `hub_customer` and `hub_order` as well); the link key is `CUSTOMER|ORDER`; `hash_diff` is `CITY|TIER`, both trimmed and upper-cased. Think about what "first seen" means when events arrive out of order, and what a customer who moves to Bandung and later back to Jakarta should leave in the satellite.
> Check it: `python3 labs/tryit/check.py 1.4-1 ~/practice` (stuck? add `--hint 1`, then 2 and 3)

:::drill python The same key, the same hash
A Data Vault hub is keyed by a hash of the **business key**. The key must hash to the same value however it was typed. Write `dv_hash(text)`: remove spaces at both ends, make the text upper case, then return the SHA-256 hash as a 64-character hexadecimal string.
@starter
import hashlib
# write your function below this line

@check
defines("dv_hash") ## Define dv_hash(text).
dv_hash("c-001") == dv_hash("  C-001 ") ## Case and surrounding spaces do not change the hash.
dv_hash("c-001") != dv_hash("c-002") ## A different key gives a different hash.
len(dv_hash("c-001")) == 64 ## SHA-256 in hex is 64 characters.
dv_hash("c-001") == hashlib.sha256(b"C-001").hexdigest() ## It is the SHA-256 of the cleaned text "C-001".
@hint
Clean `text` by stripping surrounding spaces and converting to upper case, encode it to UTF-8 bytes, and return the SHA-256 hex digest with `hashlib`.
@solution
import hashlib
def dv_hash(text):
    return hashlib.sha256(text.strip().upper().encode("utf-8")).hexdigest()
:::

:::ask What does a Data Vault hub table hold?
@options
all the descriptive attributes of the customer
* just the business key, a hash, a time, a source
a many-to-many relationship between two tables
@why
A hub is kept deliberately thin: the business key, a hash key, when it was first seen and where it came from. Descriptions live in satellites and relationships in links.
:::

## @part Using the model: dashboards

## @lesson From star schema to dashboard: serving the model to BI tools
A star schema is built to be read, and most of its readers use a BI (business intelligence) tool. Of the 1,130 data engineering postings measured in TalentHub (2026-07-23 to 2026-11-20), **36.8%** mention BI tools or dashboards. By name: Power BI **17.6%**, Tableau **9.4%**, Looker **4.2%**, Excel **3.0%**, Metabase **1.0%** and Superset **0.9%**. In many teams the analysts build the charts, but a junior data engineer is often asked to build the first dashboard too, and is always the person called when its numbers look wrong.

**What every BI tool does,** whatever its name:

| Step | What happens | Who usually owns it |
|---|---|---|
| Connect | The tool reads a database, a warehouse or files | Data engineer |
| Model | Tables, relationships (which key joins which) and **measures** (named calculations such as revenue) | Data engineer or analytics engineer |
| Ask | A question becomes a chart or a table | Analyst |
| Dashboard | Several charts on one page, with filters | Analyst |
| Share and refresh | Who may see it, and how fresh the data is | Both |

The tools differ in their screens, not in these steps. Learn the steps once on any tool and the next one takes days, not months.

**Three rules that keep dashboard numbers right.** They come straight from this module, and they are what you will be asked about when a number looks wrong:
1. **Aggregate at the right grain.** The fact table holds one row per order *line*. "Average order value" is total revenue divided by the number of *orders*; averaging the line totals gives the average *line*, a different and smaller number.
2. **Use the history the model keeps.** Revenue by customer tier must use the tier *at the time of purchase* (the SCD Type 2 key in the fact table, lesson 5), not each customer's current tier.
3. **Reconcile.** Every number on a dashboard should equal a SQL query you can run yourself. If they differ, one of them is wrong, and you need to know which before anyone else does.

Two more habits: show when the data was last refreshed, and never compare an unfinished day, week or month with a finished one.

**Practise on your own model with Metabase.** Power BI and Tableau are what job posts name most, but Power BI Desktop needs Windows (Microsoft lists Windows 10 or Windows Server 2016 as the minimum). Metabase is free, open source and runs anywhere Docker runs, and it reads the SQLite file your lab builds. First make sure `warehouse.db` actually contains the `dim_*` and `fact_order_items` tables on disk (`test_lab.py` runs in `:memory:`, so it does not write them to `warehouse.db`):

```bash
python3 labs/mod-1-4/stage.py data warehouse.db
python3 -c "import sqlite3; sqlite3.connect('warehouse.db').executescript(open('labs/mod-1-4/warehouse.sql').read())"
# or, if the sqlite3 CLI is installed: sqlite3 warehouse.db < labs/mod-1-4/warehouse.sql
```

Then start Metabase from the folder that holds your `warehouse.db` (port 3001, because the course site uses 3000):

```bash
docker run -d --name metabase -p 3001:3000 -v "$PWD":/data metabase/metabase:v0.65.6.3
```

Open `http://localhost:3001`, create the admin account, then use **Add your data** (or Admin settings, Databases), choose **SQLite** and enter the path `/data/warehouse.db`. In the **+ New** menu, **SQL query** writes a question in SQL, **Question** builds one by clicking, and **Dashboard** collects saved questions on one page. Measured on Metabase v0.65.6.3: the image is 831 MB, it was ready about 37 seconds after starting, it read `warehouse.db` with normal file permissions, and every query below returned exactly the numbers SQLite returns. Everything you build lives inside the container, so `docker rm -f metabase` deletes it; `docker rmi metabase/metabase:v0.65.6.3` frees the disk space afterwards.

> 🛠 **Try it (30 min, Docker and your Lab 1.4 warehouse).** Build a dashboard called *KopiKu sales* with four saved questions: revenue per day (`dim_date.full_date`), revenue by customer tier at the time of purchase, the top 5 products by revenue, and average order value. Then reproduce the two classic mistakes on purpose: average order value computed as `AVG(line_total_idr)`, and revenue by tier using each customer's *current* tier (join `dim_customer` a second time on `customer_id` with `is_current = 1`).
>
> **You should see** (with the course's default generated data and a warehouse that passes the lab tests): total revenue `1208770000` over `30` days, the best day `2026-01-25` with `45265000`; by tier at purchase `Bronze 840400000`, `Silver 264755000`, `Gold 97650000`, `Unknown 5965000`; the top product `Java Preanger medium 250g` with `215220000`; and an average order value of about `337457`. The two mistakes give `169700` (the average *line*, half the real value) and Gold `104485000` instead of `97650000`, because some customers became Gold after they bought. Both wrong numbers look perfectly reasonable on a chart, which is exactly why rule 3 exists.

:::advanced The same model in Power BI (not run by the course: it needs Windows)
In Power BI Desktop the steps have different names. **Get data** loads the tables (for example the four tables exported to CSV, one `SELECT *` each). **Model view** is where you draw the relationships, from each dimension's key to the matching key in the fact table (one to many). **Measures** are written in DAX, for example `Revenue = SUM(fact_order_items[line_total_idr])` and `Avg order value = DIVIDE([Revenue], DISTINCTCOUNT(fact_order_items[order_id]))`; `DIVIDE` returns blank instead of an error when the divisor is zero. Microsoft's own modelling guidance is the star schema from this module: it recommends that each model table is either a dimension table or a fact table and says to "avoid mixing the two types together for a single table". The grain, history and reconciliation rules above apply unchanged.
:::

:::drill python Average order value at the right grain
The fact table has one row per order **line**: each line is `(order_id, amount)`. "Average order value" is the total revenue divided by the number of **orders**, not lines. Write `avg_order_value(lines)`; for an empty list return `0`.
@starter
# write your function below this line

@check
defines("avg_order_value") ## Define avg_order_value(lines).
avg_order_value([("o1", 10), ("o1", 20), ("o2", 30)]) == 30 ## 60 in total over 2 orders (not 3 lines): 30.
avg_order_value([("o1", 50)]) == 50 ## One order, one line.
avg_order_value([("a", 10), ("b", 10), ("c", 10), ("c", 10)]) == 40 / 3 ## 40 over 3 orders.
avg_order_value([]) == 0 ## Nothing to average.
@hint
Return `0` if `lines` is empty; otherwise divide the sum of all line amounts by the number of unique `order_id` values (for example using a `set`).
@solution
def avg_order_value(lines):
    if not lines:
        return 0
    total = sum(amount for _, amount in lines)
    orders = len({order_id for order_id, _ in lines})
    return total / orders
:::

:::ask A dashboard shows 'average order value' computed as the average of `line_total_idr` on the order-line fact table. What is wrong?
@options
nothing: lines and orders are the same thing
it should have used the dimension table instead
* it averages lines, not orders: too small
@why
The fact has one row per order line. Average order value is revenue divided by the number of orders; averaging line totals gives the average line, which is lower whenever orders have several lines.
:::

## @lab Lab: build the KopiKu star schema
Build a data warehouse for KopiKu in SQL: a date dimension, a product dimension (Type 1), a customer dimension (Type 2, with an unknown member), and a fact table at the order-line grain whose customer key is the version valid when the order was placed. 13 tests check grain, integrity, reconciliation and a revenue-by-tier calculation done independently in Python. You also get four sandbox challenges on SCD logic in your browser.

> **Already completed Practice Pauses 1–3?** You have already built and tested both the warm-up challenges and `warehouse.sql`, jump straight to **@verify** below.

### @steps
1. Generate the data (if you have not) and look at what the staging helper gives you:

```bash
python3 labs/shared/shopgen.py --out data
python3 labs/mod-1-4/stage.py data warehouse.db
python3 -m sqlite3 warehouse.db "select name from sqlite_master where type = 'table'"   # Python 3.12+; or skip: the tests do this for you
```

   `stage.py` cleans the CSVs into five `stg_` tables. Read its docstring: it lists every column.
2. **Warm up in the browser.** Open the SQL Sandbox and solve challenges d-1 (build an SCD Type 2 dimension from a change feed with LEAD), d-2 (as-of join) and d-3 (revenue by tier at purchase) on the small SCD dataset, and d-4 (a date dimension from a recursive CTE). They are the same ideas at tiny scale.
3. Open `labs/mod-1-4/warehouse.sql`. The header comment is the specification: for each of the four tables it lists the grain and columns. Write the SQL, one table at a time, starting with `dim_date` and `dim_product`.
4. Build `dim_customer`. Make a baseline version from `stg_customers` (starting at signup) and a version for each row of `stg_customer_changes`, then compute `valid_to` with LEAD. Add the unknown member row. Store a missing city as `'Unknown'`.
5. Build `fact_order_items` last. Join each order line to its order and to the customer version valid at `order_ts`, using the range join. Use `COALESCE(..., -1)` for orphan customers so no key is NULL.
6. Run the tests (`test_lab.py` uses Python's built-in `unittest` library, so `python3 ...` works with zero extra installs) and read each failure message; they say which rule was broken:

```bash
python3 labs/mod-1-4/test_lab.py -v
```

7. Populate `warehouse.db` on disk. Because `test_lab.py` runs in `:memory:`, run your `warehouse.sql` script against `warehouse.db` to write the real `dim_*` and `fact_order_items` tables (needed for interactive querying or Metabase in Lesson 8):

```bash
python3 -c "import sqlite3; sqlite3.connect('warehouse.db').executescript(open('labs/mod-1-4/warehouse.sql').read())"
# or, if the sqlite3 CLI is installed: sqlite3 warehouse.db < labs/mod-1-4/warehouse.sql
```

8. Explore your model with real questions: revenue by tier and month, revenue by roast level, weekend versus weekday sales. Then deliberately break it (remove the range condition in the fact join) and watch the grain and reconciliation tests fail.

### @files
- labs/mod-1-4/warehouse.sql :: Your working file: build the four tables :: starter
- labs/mod-1-4/stage.py :: Loads the cleaned KopiKu data into staging tables (provided) :: data
- labs/mod-1-4/test_lab.py :: The 13 tests :: test
- labs/mod-1-4/answers.sql :: Sandbox challenges in file form (SCD warm-up) :: starter
- labs/mod-1-4/datasets/scd_demo.sql :: Small SCD Type 2 dataset used by the sandbox and check.py :: data
- labs/mod-1-4/check.py :: Checker for the warm-up challenges :: test
- labs/mod-1-4/reference/warehouse.sql :: One possible solution (try first!) :: reference
- labs/mod-1-4/reference/answers.sql :: Reference answers for the four warm-up challenges :: reference

### @deliverables
- All 13 tests in `test_lab.py` pass
- All four sandbox challenges pass
- You can state the grain of each of your tables in one sentence, and explain what happens to the fact row count if the range condition is left out of the join

### @verify
```bash
python3 labs/mod-1-4/test_lab.py -v
python3 labs/mod-1-4/check.py
python3 scripts/prove.py mod-1-4    # requires pytest (pip install pytest)
```

Compare with the known-good solutions: `LAB_DIR=reference python3 labs/mod-1-4/test_lab.py` and `python3 labs/mod-1-4/check.py reference`.

## @chaos The Gold-tier revenue that changed after the quarter closed
### @scenario
Finance publishes the quarterly report on the 5th: Gold-tier customers generated Rp 97.7 million. A month later the board asks for the same quarter again and the dashboard shows Rp 104.5 million. Nobody changed the report's query. The data team is accused of "changing the numbers".

What did change: the nightly customer load runs `UPDATE dim_customer SET tier = s.tier FROM staging s WHERE ...` (a Type 1 overwrite), and during the month a loyalty review moved some customers up and down.

### @cause
The dimension overwrites a customer's tier in place, and the report joins facts to the dimension on the customer key, so every historical order is re-labelled with the customer's **current** tier. A customer who was Silver when she bought, and was promoted to Gold last week, moves her entire purchase history into the Gold total. The report is internally consistent at any single moment but its past keeps moving.

This is not a bug in SQL; it is a modeling decision (Type 1) applied to an attribute that needed Type 2. Nobody decided on purpose, because nobody asked "should this number be able to change after we publish it?"

### @fix
1. Make `tier` (and `city`) **Type 2**: keep a version row with `valid_from` and `valid_to` for every change, and point each fact at the version valid at the time of the event.
2. Load incrementally with a close-and-insert step using `IS DISTINCT FROM`, run in one transaction so it is safe to re-run.
3. Rebuild the history from the change feed or from audit logs where possible, so earlier quarters are restated once, deliberately and documented.
4. Add a test that freezes a published figure (revenue for a closed period) and fails when it changes, and document, per attribute, which SCD type was chosen and why.

### @pattern
Decide for every dimension attribute whether the past may change. If the answer is "no", it is a Type 2 attribute, and facts must point at the version that was true at the time.

## @quiz
### What does the "grain" of a fact table mean?
- [ ] The number of rows that the fact table is expected to contain after a full year of loading
- [x] A statement of exactly what one row represents, such as one row per order line
- [ ] The smallest data type that is able to store the numeric measures of the fact table
- [ ] The list of all dimension tables that are allowed to join with the fact table

> The grain is a sentence defining a row. It determines which dimensions and measures belong on the table and is the basis of tests such as uniqueness of the row's natural key.

### An order has three lines. A shipping fee of 20,000 is stored once on the order and is copied onto each line of an order-line fact table. What happens when you sum it?
- [ ] The total is right, because every line carries the same fee that belongs to the order
- [ ] The database raises an error, because measures from two grains cannot be added together in one query
- [x] The fee is counted three times, since the measure lives at the order grain, not the line grain
- [ ] Only the first line of each order is counted, because duplicates are removed by SUM

> Measures only sum correctly at their own grain. Either keep the fee in an order-grain table, or allocate it across the lines explicitly.

### A customer moves from Jakarta to Bandung. Reports about last year must still show Jakarta. Which SCD type fits?
- [ ] Type 1, which overwrites the city and keeps the report for last year unchanged
- [ ] Type 0, which stores the new city next to the old one in the same row
- [x] Type 2, which adds a new version row and keeps the old row with its validity range
- [ ] Type 3, which stores every previous city that the customer ever had in a single extra column

> Type 2 preserves full history: the old row (valid until the move) stays Jakarta and facts from that time keep pointing at it. Type 1 overwrites history, and Type 3 keeps only one previous value.

### You join a fact table to a Type 2 customer dimension on `customer_id` only. What goes wrong?
- [ ] Nothing, since the surrogate key is created automatically and picks the right version
- [ ] The query returns only the current version of each customer and ignores all of the older ones
- [x] Each fact row matches every version of its customer, so rows and totals are multiplied
- [ ] The join fails with an error because the dimension holds several rows for one key

> Without the validity range, one order matches all versions of the customer, so rows multiply. In the lab data, 7,123 order lines became 8,552.

### Why do fact tables join to dimensions with surrogate keys instead of natural keys?
- [ ] Natural keys cannot be indexed, but surrogate keys can be indexed by every modern database system
- [ ] Surrogate keys are required by the SQL standard whenever a table has a foreign key
- [x] They separate the warehouse from source changes and let one entity have several versions
- [ ] They encrypt the source identifier so that analysts cannot see customer information

> Surrogate keys protect from reused or reformatted source ids and are the only way to identify which version of a Type 2 row a fact belongs to. They are also small and fast.

### An order arrives for a customer that is not yet in the customer dimension. What is the best practice?
- [ ] Drop the order from the fact table until the customer appears, then load it again
- [ ] Store NULL in the customer key so the row keeps its place in the fact table
- [x] Point it at an "unknown" member row, and fix the key when the real customer arrives
- [ ] Create a new dimension row that copies all attributes from the previous customer in the load

> The unknown member keeps every fact row joinable, so totals stay correct and the gap is visible and countable. NULL keys disappear in inner joins, and dropping rows loses revenue.

### Which statement about star schemas versus one big table (OBT) is most accurate?
- [ ] A star schema is obsolete because columnar storage makes joins impossible to optimise in any engine
- [ ] An OBT is always better, since it removes the need for any keys or any documentation
- [x] A star is a shared, testable model with a clear grain, and an OBT is best derived from it
- [ ] Snowflake schemas are required whenever a dimension contains more than ten columns

> Cheap storage changes the cost of an OBT, not the need for a clear grain and a single definition of each entity. Teams that use an OBT as the only model tend to lose both.

### Which pair of tests best protects a new fact table against silent errors?
- [ ] A test that the table is not empty and a test that it loads in under one minute
- [x] A uniqueness test on the declared grain and a reconciliation of totals with the source
- [ ] A test that every column has a description and a test that the names use lower case
- [ ] A test that the table has an index and a test that all measures are positive numbers in every row

> Grain uniqueness catches duplicated or multiplied rows; reconciliation catches lost or invented revenue. Together they detect most join and loading errors.

### In a Data Vault satellite, when is a new row added for a customer?
- [ ] Every time an event arrives for that customer, so the satellite ends up with one row per load
- [ ] Only when the business key changes, because attributes are kept in the hub
- [ ] Once a day, as a snapshot of every customer, whether something changed or not
- [x] When the hash_diff of the new attributes differs from that customer's latest satellite row

> A satellite is insert-only and stores changes: compare the new fingerprint with the latest row, not with every row ever seen, so a customer who moves back to an earlier city still gets a new row.

### Why does Data Vault derive its keys by hashing the business key instead of handing out surrogate keys 1, 2, 3?
- [x] Every loader computes the same key for the same customer on its own, so many sources can load in parallel
- [ ] Hashes are shorter than integers, so the tables take noticeably less space on disk
- [ ] A hash hides the customer id, which makes the vault safe to share outside the company
- [ ] Sequential numbers are not allowed as primary keys in most of the cloud data warehouses that are in use today

> Handing out numbers in order needs one central counter, which becomes a bottleneck with many sources and gives the same customer different numbers. A hash of the normalised business key is the same everywhere.

### A dashboard shows "average order value" as `AVG(line_total_idr)` over the order-line fact table. What is wrong with it?
- [ ] Nothing, because each line belongs to exactly one order, so the average comes out the same
- [x] It averages lines, not orders: an order with two lines counts twice, so the result is too small
- [ ] It is only wrong when some orders were cancelled, because AVG silently skips every cancelled row
- [ ] AVG cannot be used on money stored in rupiah, so the database rounds the answer away

> Average order value is total revenue divided by the number of distinct orders. On the KopiKu warehouse, AVG over the lines gives 169,700 against 337,457 per order (lesson 8).

## @resources
- [Kimball Group: dimensional modeling techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [dbt docs: snapshots (Type 2 dimensions)](https://docs.getdbt.com/docs/build/snapshots)
- [SQLite: window functions (LEAD)](https://www.sqlite.org/windowfunctions.html)
