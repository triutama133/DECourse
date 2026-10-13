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
Modules 0.3 and 1.3 (joins, the fan-out trap, window functions such as LEAD, recursive CTEs). The lab uses plain SQL on SQLite plus a short Python helper; nothing to install.

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

> 💡 **Practice Pause 1 (Gap-free Calendar Date Dimension):**
> Practice generating a calendar date dimension table:
> 1. Open `labs/mod-1-4/answers.sql` in your text editor (or open the SQL Sandbox in your browser).
> 2. Solve challenge `d-4`: Generate 7 contiguous calendar days starting `2026-01-01` using `WITH RECURSIVE`. Compute integer `date_key` (YYYYMMDD), `full_date`, `day_name`, and `is_weekend` flag (1 for Saturday and Sunday).
> 3. Test in the terminal:
> `python3 labs/mod-1-4/check.py`
> When challenge d-4 shows PASS, you understand analytical calendar generation! Proceed to Lessons 4 & 5 on keys and SCD dimensions.

## @lesson Keys: surrogate keys and the unknown member
**Natural keys** come from the source (`customer_id`, `product_id`). **Surrogate keys** are meaningless integers the warehouse assigns (`customer_sk`). Fact tables should join to dimensions on surrogate keys. Reasons:

- **They isolate you from the source.** Two source systems may use the same id for different customers; ids can be reused, renumbered, or change format after a migration.
- **They make history possible.** When a customer gets a new version (Type 2, below), one natural key has several rows; only a surrogate key can identify *which* version a fact belongs to.
- **They are small and fast** (an integer) to join on and store.

Keep the natural key in the dimension as an ordinary column too, so you can trace a row back to its source.

**Every fact row must point at a real dimension row.** Real data does not cooperate: an order arrives for a customer who is not in the customer extract yet (a *late-arriving* dimension), a product is deleted at the source, a value is missing. A NULL foreign key is poison: in an inner join the fact row silently vanishes and totals go down. The standard fix is the **unknown member**: a special dimension row with a reserved key (here `customer_sk = -1`, `city = 'Unknown'`) that facts point to when the real row cannot be found. Totals stay correct, the unknowns are visible (and countable, so you can alert on them), and when the real dimension row arrives later you can repair the facts.

In the lab's data, 32 order lines belong to customers who do not exist in the customer table. With an unknown member they appear as the "Unknown" tier with revenue of Rp 5,965,000; without it, that revenue would silently disappear from every report grouped by tier.

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

`valid_from` is inclusive, `valid_to` exclusive and equal to the next version's `valid_from`, so ranges tile the timeline with no gaps and no overlaps. The far-future date for the open version avoids NULL logic in range checks. You can build the whole dimension from a change feed with one window function (`LEAD(effective_ts, 1, '9999-12-31') OVER (PARTITION BY customer_id ORDER BY effective_ts)`), which is exactly challenge d-1 in the sandbox.

**The as-of join.** To attach the right version to a fact, join on the natural key **and** the time range:

```sql
JOIN dim_customer c
  ON c.customer_id = o.customer_id
 AND o.order_ts >= c.valid_from
 AND o.order_ts <  c.valid_to
```

If you forget the range and join on `customer_id` alone, every order matches *every* version of its customer: in the lab data 7,123 order lines become **8,552** rows, a silent 20% inflation. This is the Type 2 version of the fan-out trap. Tests for the model should assert that the fact row count is unchanged after building it.

**Loading a Type 2 dimension incrementally** (when you do not have a clean change feed, only today's snapshot): compare each incoming row with the current version on the *tracked* attributes; if different, close the current row (`valid_to = now`, `is_current = 0`) and insert a new current row. Use `IS DISTINCT FROM` rather than `<>` so a change to or from NULL is detected, and make the step idempotent (running twice must not create a second identical version). Two real-world complications: **late-arriving changes** (an update that happened Tuesday arrives on Thursday must be inserted *between* existing versions, re-cutting the ranges) and **out-of-order events** (always order by the source's event time, not by arrival time).

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
> 1. Prepare the staging tables first in your terminal:
> `python3 labs/mod-1-4/stage.py data warehouse.db`
> 2. Open `labs/mod-1-4/warehouse.sql` in your text editor (remember: do not execute directly in bash without arguments!).
> 3. Write DDL & DML for the 4 tables: `dim_date` (gap-free), `dim_product` (surrogate key), `dim_customer` (SCD Type 2 with unknown member `customer_sk = -1`), and `fact_order_items` (order line grain with as-of join).
> 4. Test the complete star schema integrity in the terminal:
> `python3 labs/mod-1-4/test_lab.py -v`
> When all 13 unit tests show PASSED (OK), your KopiKu star schema meets enterprise standards!

## @lab Lab: build the KopiKu star schema
Build a data warehouse for KopiKu in SQL: a date dimension, a product dimension (Type 1), a customer dimension (Type 2, with an unknown member), and a fact table at the order-line grain whose customer key is the version valid when the order was placed. 13 tests check grain, integrity, reconciliation and a revenue-by-tier calculation done independently in Python. You also get four sandbox challenges on SCD logic in your browser.

### @steps
1. Generate the data (if you have not) and look at what the staging helper gives you:

```bash
python3 labs/shared/shopgen.py --out data
python3 labs/mod-1-4/stage.py data warehouse.db
sqlite3 warehouse.db ".tables"        # needs the sqlite3 tool; or skip: the tests do this for you
```

   `stage.py` cleans the CSVs into five `stg_` tables. Read its docstring: it lists every column.
2. **Warm up in the browser.** Open the SQL Sandbox and solve challenges d-1 (build an SCD Type 2 dimension from a change feed with LEAD), d-2 (as-of join) and d-3 (revenue by tier at purchase) on the small SCD dataset, and d-4 (a date dimension from a recursive CTE). They are the same ideas at tiny scale.
3. Open `labs/mod-1-4/warehouse.sql`. The header comment is the specification: for each of the four tables it lists the grain and columns. Write the SQL, one table at a time, starting with `dim_date` and `dim_product`.
4. Build `dim_customer`. Make a baseline version from `stg_customers` (starting at signup) and a version for each row of `stg_customer_changes`, then compute `valid_to` with LEAD. Add the unknown member row. Store a missing city as `'Unknown'`.
5. Build `fact_order_items` last. Join each order line to its order and to the customer version valid at `order_ts`, using the range join. Use `COALESCE(..., -1)` for orphan customers so no key is NULL.
6. Run the tests and read each failure message; they say which rule was broken:

```bash
python3 labs/mod-1-4/test_lab.py -v
```

7. Explore your model with real questions: revenue by tier and month, revenue by roast level, weekend versus weekday sales. Then deliberately break it (remove the range condition in the fact join) and watch the grain and reconciliation tests fail.

### @files
- labs/mod-1-4/warehouse.sql :: Your working file: build the four tables :: starter
- labs/mod-1-4/stage.py :: Loads the cleaned KopiKu data into staging tables (provided) :: data
- labs/mod-1-4/test_lab.py :: The 13 tests :: test
- labs/mod-1-4/answers.sql :: Sandbox challenges in file form (SCD warm-up) :: starter
- labs/mod-1-4/check.py :: Checker for the warm-up challenges :: test
- labs/mod-1-4/reference/warehouse.sql :: One possible solution (try first!) :: reference

### @deliverables
- All 13 tests in `test_lab.py` pass
- All four sandbox challenges pass
- You can state the grain of each of your tables in one sentence, and explain what happens to the fact row count if the range condition is left out of the join

### @verify
```bash
python3 labs/mod-1-4/test_lab.py -v
python3 labs/mod-1-4/check.py
```

Compare with the known-good solution: `LAB_DIR=reference python3 labs/mod-1-4/test_lab.py`.

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

## @resources
- [Kimball Group: dimensional modeling techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [dbt docs: snapshots (Type 2 dimensions)](https://docs.getdbt.com/docs/build/snapshots)
- [SQLite: window functions (LEAD)](https://www.sqlite.org/windowfunctions.html)
