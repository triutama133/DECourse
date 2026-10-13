---
title: Data Quality, Observability and Data Contracts
duration: 2 weeks
summary: Learn to define data quality, put checks in the right layers, agree data contracts with producers, monitor freshness, volume, schema and distribution, and respond to incidents, by building a working quality gate.
why: In tutorials, a pipeline is finished when data lands in a table. In production your credibility depends on trust: did the data arrive on time, is it complete, and are the numbers right? Problems that raise no error are the expensive ones.
---

## @outcomes
- Define data quality in terms of testable dimensions and relate each to a check
- Place checks in the right layer (source contract, ingestion gate, transformation tests, monitoring) and explain what each layer can and cannot catch
- Write a data contract with schema, constraints, ownership and SLAs, and enforce it with a validation gate and quarantine
- Detect freshness, volume, schema and distribution problems with robust statistics, and avoid alert fatigue
- Run a data incident: detect, triage, communicate, fix, and learn, with clear ownership and service levels

## @prereq
Modules 0.1 (the five ways data goes wrong), 1.2 (validation and quarantine) and 2.3 (dbt tests). `pip install -r labs/mod-2-5/requirements.txt` installs PyYAML and pytest.

## @lesson What "quality" means: dimensions you can test
"Bad data" is too vague to act on. Data quality is **fitness for a specific use**, and it breaks down into dimensions, each of which turns into a check you can run. Using KopiKu's orders:

| Dimension | The question | Example check on orders |
|---|---|---|
| **Completeness** | Is the data that should be there present? | No NULL `order_id`; yesterday has about as many orders as usual |
| **Validity** | Does each value follow the allowed format and range? | `status` is one of five values; `total_idr` is a positive integer; `order_ts` is a real ISO timestamp |
| **Uniqueness** | Is each real-world thing recorded once? | `order_id` appears once |
| **Consistency** | Do related data agree? | The fact table's revenue equals the source's; an order's customer exists |
| **Accuracy** | Does the data reflect reality? | Revenue matches the payment provider's report (needs an outside source of truth) |
| **Timeliness (freshness)** | Is it recent enough for the use? | The newest order is under 24 hours old |
| **Integrity** | Do references hold? | Every `customer_id` exists in the customer table |

Why it matters is practical. Analysts stop trusting a dashboard after one wrong number and then re-derive everything in spreadsheets, which defeats the platform. Machine-learning models trained on duplicated or shifted data degrade silently. Decisions (pricing, stock, spend) follow the numbers. And fixing a quality problem **late costs far more than preventing it early**: an error caught at ingestion is a rejected row; an error found by a customer is an incident, a restatement of reports and a loss of trust.

Where do problems come from? Mostly **upstream and from change**, not from your code: a source team changes a field, a deploy introduces a bug, a partner is late, a definition ("what counts as an active customer?") differs between teams. A data engineer cannot prevent all of that, but can make the problems **visible, early and owned**.

## @lesson Defence in layers
No single check catches everything, so quality is built as layers, each catching what the previous cannot. The principle is **shift left**: catch problems as close to the source as possible.

| Layer | What it does | Catches | Tools |
|---|---|---|---|
| **1. Source agreement** (contract) | Producer and consumer agree the shape and meaning in writing; the producer tests against it before releasing | Breaking changes *before* they ship | Data contracts, schema registries, CI on the producer side |
| **2. Ingestion gate** | Validate incoming data against the contract; quarantine bad rows; fail the load when too much is bad | Bad values, type changes, missing fields | Python validation (Module 1.2), Pydantic, Great Expectations, Soda |
| **3. Transformation tests** | Assert expectations about each model: uniqueness, integrity, business rules | Join fan-out, logic bugs, broken relationships | dbt tests (Module 2.3), reconciliation checks |
| **4. Monitoring** | Watch the data after the fact for anomalies in freshness, volume, schema and distribution | Silent problems nobody wrote a test for | Anomaly detection, observability tools |
| **5. Human process** | Ownership, alerts that reach someone, runbooks, post-incident review | Everything that slipped through | On-call, incident process, SLAs |

Two facts to keep in mind. First, **tests catch the problems you thought of; monitoring catches the ones you did not.** A schema test cannot warn you that one third of the orders vanished because of a checkout bug; a volume monitor can. Second, **a check is only useful if it is wired to action**: a failing test that nobody sees is decoration. Decide for each check whether it should *block* (stop the pipeline so bad data does not spread), *warn* (alert and continue) or only *record*.

The lab builds layers 1 to 4 in miniature, in one gate.

## @lesson Data contracts: write the agreement down
A **data contract** is an explicit, versioned agreement between a data **producer** (the checkout team) and its **consumers** (the data team). Without one, the producer changes a column and finds out from an angry email a week later. With one, the change is discussed before it ships.

A contract contains:

- **Schema**: field names, types, whether each is required, and constraints (minimum values, allowed values, formats, uniqueness).
- **Semantics**: what each field *means* (is `total_idr` before or after discount? is `order_ts` UTC or local?). Many outages come from agreed schemas and unagreed meanings.
- **Service levels (SLAs)**: freshness ("delivered within 24 hours of the order"), completeness, availability.
- **Ownership**: who owns the data and who to call.
- **Versioning and change rules**: how changes are announced and which are allowed.

The lab's contract, a YAML file the validation code reads:

```yaml
name: orders
version: 1.0.0
owner: checkout-team
fields:
  - name: order_id
    type: integer
    required: true
    unique: true
    minimum: 1
  - name: status
    type: string
    required: true
    allowed: [paid, shipped, delivered, cancelled, refunded]
  - name: total_idr
    type: integer
    required: true
    minimum: 1
sla:
  freshness_hours: 24
  max_reject_rate: 0.10
```

Because it is machine-readable, the same file can drive **both sides**: the producer's CI checks that a new release still satisfies it, and the consumer's ingestion gate validates every delivery against it. (Open standards exist for this: the *Open Data Contract Standard* and the *datacontract* specification define common formats and tools. The lab uses a minimal version so that you can see every moving part.)

**Breaking versus non-breaking changes.** Adding an optional field is usually safe. Removing or renaming a field, changing a type, narrowing allowed values or changing a meaning is **breaking** and needs a new major version, a notice period and a migration. The rule of thumb for versions: patch for fixes, minor for compatible additions, major for breaking changes. Agree who may approve a breaking change before anyone needs to.

Contracts are not about blame; they make **expectations testable**. They work only when producers see them as part of their own definition of done, which is a people problem as much as a technical one.

> 💡 **Practice Pause 1 (Defining the YAML Data Contract):**
> 1. In your text editor (VS Code / Cursor), open `labs/mod-2-5/contracts/orders.yaml` (do not run `.yaml` files directly in bash).
> 2. Complete the contract specification: specify `name: orders`, `version: 1.0.0`, `owner: checkout-team`, declare all 6 fields (`order_id`, `customer_id`, `order_ts`, `status`, `payment_method`, `total_idr`) with constraints, and configure the SLA block (`freshness_hours: 24`, `max_reject_rate: 0.10`).
> 3. Verify the contract definition in terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestContractFile -v`
> 4. **Success Indicator:** Both `TestContractFile` tests report `PASSED`, verifying schema and SLA completeness.

## @lesson The ingestion gate: strict at the door, quarantine what fails
At the boundary, validate **strictly** against the contract and send failing rows to a **quarantine** with reasons (the pattern from Module 1.2). Strictness here is deliberate: the contract says `total_idr` is an integer, so `"Rp 1.250.000"` is a violation to report to the producer, not something to guess at. Cleaning and normalising for known messiness belongs in the staging layer (Module 2.3), where you do it explicitly and knowingly.

Run on the KopiKu orders file (3,634 rows), the lab's gate produces:

| Result | Rows |
|---|---|
| Valid | 3,394 |
| Quarantined | 240 (6.6%) |
| of which: status not an allowed value (`PAID`, `Shipped`...) | 112 |
| of which: timestamp not ISO (`31/01/2026 14:03`) | 41 |
| of which: total not an integer (`Rp 1.250.000`) | 37 |
| of which: duplicate `order_id` | 33 |
| of which: total below the minimum (negative) | 17 |

Notice what you now have: **a specific, countable list of problems to send back to the producer**, by type, instead of a vague feeling that "the data is dirty". Each row carries its own reasons, so a person can decide whether to repair, re-request or discard.

Design decisions of a gate:

- **Report all errors of a row**, not only the first, so the producer can fix everything in one round.
- **A rejected row must not "use up" its key.** If a row with `order_id` 5 fails because of a bad status, a later *valid* row with the same id must not be called a duplicate. (The lab tests this subtle case.)
- **A threshold turns volume of errors into a decision.** A few percent of messy rows is normal and goes to quarantine; when the **reject rate** exceeds the contract's limit (here 10%), the feed itself is broken and the *whole load fails* rather than pushing a mostly empty table downstream.
- **Order matters, and stopping early is fine.** If the schema has drifted (a column renamed), row-level checks are meaningless: fail immediately with a clear reason.
- **Keep the evidence**: write the quarantine file and a report (counts by reason) for each run so trends are visible.

> 💡 **Practice Pause 2 (Building the Ingestion Gate & Quarantine):**
> 1. Open `labs/mod-2-5/quality.py` in your text editor.
> 2. Implement `load_contract(path)` and `validate_rows(rows, contract)`: enforce field constraints strictly (missing, wrong type, minimum, allowed, duplicate) and route invalid rows to `quarantined` with detailed error messages.
> 3. Test row validation in terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestValidateRows -v`
> 4. **Success Indicator:** All 13 tests in `TestValidateRows` report `PASSED`, confirming 3,394 valid rows and 240 quarantined rows on the real shop dataset.

## @lesson Monitoring: freshness, volume, schema, distribution
Row-level checks see one row at a time. **Dataset-level monitoring** looks at the *shape of the whole delivery* and catches problems that make every row individually valid. The common pillars of **data observability**:

1. **Freshness**: how old is the newest data? `check_freshness(latest, now, 24h)`. Catches a stalled upstream or a job that quietly did not run.
2. **Volume**: how many rows arrived compared with normal? Catches a producer bug that drops a segment of data, a partial file, or a runaway duplicator.
3. **Schema**: did the columns or types change? Catches drift before it breaks queries.
4. **Distribution**: did the *content* shift? The share of each status, the null rate of a column, the range of a number. Catches subtle breakage such as a fallback value flooding a column.
5. **Lineage**: which upstream tables and jobs feed this one, and what depends on it? Not a check but what makes the other four actionable (below).

**Volume checks need robust statistics.** The textbook approach flags a value more than 3 standard deviations from the mean. The weakness: the mean and standard deviation are themselves distorted by past outliers, so one bad day in the history widens the band until real problems pass. The robust alternative uses the **median** and the **MAD** (median absolute deviation), which ignore outliers:

```text
spread = max(1.4826 * MAD, 5% of median, 1)     # 1.4826 makes MAD comparable to a standard deviation
band   = median ± 3 * spread
```

On the lab data, the 14 days before the last one had a median of 113.5 orders. The band came out as **96.5 to 130.5**; the latest day had 115 (fine). When 40% of that day's orders were removed in a test, the count fell to about 69 and was flagged. Another test shows the point of robustness: with a history of `[120] * 13 + [1200]` (one wild day), a mean-and-standard-deviation rule would accept 400 as normal; the median-and-MAD rule still rejects it. The floors (`5% of median`, `1`) stop the band from collapsing to zero width when history is perfectly constant.

Practical tuning:

- **Seasonality.** Orders on Saturdays differ from Tuesdays. Compare with the same weekday of past weeks, or with a model that includes day-of-week, or you will page people every weekend.
- **Distribution shift** can be measured simply with the **total variation distance** between two category distributions: half the sum of absolute differences in shares. It runs from 0 (identical) to 1 (completely different). For example, `{paid: 80, cancelled: 20}` against `{paid: 60, cancelled: 40}` gives 0.2: a quarter of the orders changed status mix, worth a look.
- **Alert fatigue is the enemy.** Too many noisy alerts train people to ignore them, and then the real one is missed. Start with few, high-value checks; set severity (`block`, `warn`); require a human-actionable message ("volume on 2026-01-30 was 69, expected 96 to 130"); and review thresholds after every false alarm.

> 💡 **Practice Pause 3 (Dataset Monitoring & Robust Statistics):**
> 1. Open `labs/mod-2-5/quality.py` in your text editor.
> 2. Implement the four monitoring functions: `check_schema(header, contract)`, `check_freshness(latest, now, max_age_hours)`, `volume_anomaly(history, today, k=3.0)` using Median and MAD with safety floors, and `distribution_shift(before, after)` using Total Variation Distance.
> 3. Run the statistical monitoring tests in terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestSmallChecks -v`
> 4. **Success Indicator:** All 6 tests in `TestSmallChecks` report `PASSED`, proving detection resilience against outliers and drift.

## @lesson Lineage, tools and service levels
**Lineage** records how data flows: this dashboard reads this mart, built from these staging models, from these raw tables, loaded by this job. It answers two operational questions. *Impact analysis*: "this source is broken, which reports are affected?" *Root cause*: "this number is wrong, where did it come from?" Orchestrators and dbt produce lineage (Modules 2.3 and 2.4), and **OpenLineage** is an open standard for emitting it: each job run sends an event describing the run, the job, and its input and output datasets.

```json
{ "eventType": "COMPLETE", "eventTime": "2026-01-31T02:10:00Z",
  "run":  { "runId": "3c1f..." },
  "job":  { "namespace": "kopiku", "name": "build_fct_order_items" },
  "inputs":  [ { "namespace": "warehouse", "name": "stg_orders" } ],
  "outputs": [ { "namespace": "warehouse", "name": "fct_order_items" } ] }
```

(Simplified; real events carry more facets, such as schema and row counts.) A **data catalog** adds ownership, descriptions and search on top.

**Tools.** You rarely build all this by hand. *Great Expectations* and *Soda* define expectations (checks) as code or YAML and run them in a pipeline; *dbt tests* cover the transformation layer; *pandera* validates DataFrames; *Elementary* and commercial *observability platforms* add anomaly detection and lineage. The concepts are identical to what you build in the lab. A sensible path: dbt tests plus a handful of ingestion checks first, anomaly monitoring on your most important tables next, and a platform when manual upkeep stops scaling.

**Service levels for data.** Borrowing from reliability engineering: an **SLI** is a measurement (hours since the newest order), an **SLO** is the target ("under 24 hours for 99% of days"), and an **SLA** is an agreement with consequences. They make quality negotiable and measurable instead of aspirational. Track **data downtime** (time the data was wrong or missing) and how long it took to detect and to fix. Define **ownership** for every important dataset: a named team that gets the alert.

## @lesson When it breaks: incident response
Quality problems will reach production. What distinguishes a mature team is the response.

1. **Detect.** Automated checks alert before consumers notice. Measure how often users find problems *before* you do: that is your detection gap.
2. **Triage.** How bad? Who is affected (use lineage)? Is it still happening? Stop the bleeding first: pause the downstream refresh or add a banner on affected dashboards rather than letting wrong numbers spread.
3. **Communicate.** Tell consumers early and plainly: what is wrong, which reports, what to do meanwhile, when the next update is. Trust survives a bug that was announced; it does not survive one that was discovered.
4. **Fix and repair.** Fix the cause, then **repair the data**: reprocess the affected partitions (this is where idempotent pipelines pay off, Module 2.4) and verify with reconciliation.
5. **Learn.** A short **blameless post-mortem**: timeline, impact, root cause, what detected it, what would have detected it sooner, and concrete actions with owners (a new check, a contract clause, an alert threshold). Focus on the system, not the person.

A few habits make this easier: keep a **runbook** per critical dataset (how to check health, how to re-run, who to ask); keep **quarantine and reports** for every run so you can see when a problem began; and add a **regression check** for every incident, so the same problem is caught automatically next time.

> 💡 **Practice Pause 4 (Quality Gate Orchestration & Incident Prevention):**
> 1. Open `labs/mod-2-5/quality.py` in your text editor.
> 2. Implement `run_gate(orders_csv, contract_yaml, out_dir, now=None)`: execute hierarchical checks (schema, row validation, freshness, volume), write `orders_valid.ndjson` and `quarantine.ndjson`, and return an evaluation dictionary with status `pass`, `warn`, or `fail`.
> 3. Test gate orchestration in terminal:
>    `pytest labs/mod-2-5/test_lab.py -k TestRunGate -v`
> 4. **Success Indicator:** All 5 tests in `TestRunGate` report `PASSED`, confirming fail-fast behavior on schema drift and reject rate breaches.

## @lab Lab: build a data quality gate
Write the data contract for the orders feed and implement the gate that enforces it: row validation with quarantine, schema-drift detection, freshness, a robust volume monitor, and a distribution-shift measure. 26 tests check each piece and run the whole gate against deliberately broken versions of the data.

### @steps
1. Install and generate the data, then read the tests to see the expected behaviour:

```bash
python -m pip install -r labs/mod-2-5/requirements.txt
python3 labs/shared/shopgen.py --out data
pytest labs/mod-2-5 -v          # everything fails at first
```

2. **Write the contract.** Open `labs/mod-2-5/contracts/orders.yaml`. Its header lists the six fields and their rules; fill in `fields:` and the `sla:` block. A wrong or missing rule will show up as a failing test, so use them as feedback.
3. In `labs/mod-2-5/quality.py` implement `load_contract` and `validate_rows`. Be strict (the producer promised these types). Return all errors of each row with the exact messages in the docstring, keep input order, and remember that a rejected row must not mark its key as seen.
4. Implement the small checks: `check_schema`, `check_freshness`, `volume_anomaly` (median and MAD, with the floors), and `distribution_shift` (total variation distance).
5. Implement `run_gate`, which runs the checks in order (schema, contract, freshness, volume), writes `orders_valid.ndjson` and `quarantine.ndjson`, and returns a report with a status of `pass`, `warn` or `fail`. Stop at the first failure.
6. Run the tests. Then **use your gate on the real data** and read the report; look at the first lines of the quarantine file and the count of reasons.

> 💡 **Practice Pause 5 (Full Suite Verification & Quarantine Inspection):**
> 1. In your terminal, run the complete automated test suite:
>    `pytest labs/mod-2-5 -v`
> 2. Observe the execution output: all 26 test cases are evaluated in about 1 second.
> 3. **Success Indicator:** All 26 tests in `test_lab.py` report `PASSED` (100% pass rate).

7. Break the feed yourself and watch the gate respond: rename a column, delete 40% of the last day, change 25% of totals to `Rp ...` text, advance `now` by three days. For each, ask whether the status and the message tell an on-call engineer what to do.
8. Stretch goals: add a null-rate check per column; compare the last day with the same weekday of earlier weeks; write the same contract in the Open Data Contract Standard format; add a `--now` command-line argument and an exit code (0 pass, 1 warn, 2 fail) so the gate can run in a scheduler.

### @files
- labs/mod-2-5/contracts/orders.yaml :: Your contract: fill in the fields and SLA :: starter
- labs/mod-2-5/quality.py :: Your working file: the gate functions to implement :: starter
- labs/mod-2-5/test_lab.py :: The 26 tests :: test
- labs/mod-2-5/requirements.txt :: pyyaml and pytest :: config
- labs/mod-2-5/reference/contracts/orders.yaml :: Reference contract (try first!) :: reference
- labs/mod-2-5/reference/quality.py :: Reference gate :: reference

### @deliverables
- All 26 tests pass
- Your gate on the real file reports 3,394 valid and 240 quarantined rows with the five reasons listed in the lesson
- You can explain why the volume check uses the median and MAD, and what each of the four broken-feed experiments tells the on-call engineer

### @verify
```bash
pytest labs/mod-2-5 -v
```

Known-good run: `LAB_DIR=reference pytest labs/mod-2-5 -v`.

## @chaos The checkout bug that every test passed
### @scenario
A change to the checkout flow has a bug: international orders fail at the payment step and are never created. Domestic orders work. Every order that *does* arrive is perfect: correct types, valid statuses, unique ids, positive totals. The nightly load reports success, every dbt test is green, and the contract validation rejects nothing.

Four days later the finance team notices that revenue is down by about a third and asks whether demand has collapsed. Marketing had already cut a campaign's budget because "conversion is falling".

### @cause
Everything that arrived was valid; what was wrong was what *did not* arrive. Row-level checks and schema tests judge rows that exist; they cannot see an absence. No monitor compared today's volume with the normal level, so a one-third drop sat unnoticed for four days while decisions were made on it. The load's "success" meant the code ran, not that the data was complete.

### @fix
1. Add a **volume monitor** on the orders feed (median and MAD against the same weekday of recent weeks) that **warns** within hours. In the lab, a 40% drop on the last day is flagged against a normal band of 96 to 130 orders.
2. Add a **distribution check** on the segments (domestic versus international share) so the *missing* segment shows up as a shift.
3. Fix the checkout bug, then **recover the missing orders** from the payment attempts and reprocess the affected days.
4. Restate the affected reports, tell the stakeholders (including marketing) what happened, and set an alert threshold on conversion and order volume.
5. Write a short blameless post-mortem with an action: every business-critical feed gets volume and freshness monitors before it is called production-ready.

### @pattern
Tests judge what arrived; monitors judge what should have arrived. A pipeline needs both.

## @quiz
### Which data quality dimension does the check "yesterday's order count is within the normal range" mainly test?
- [ ] Uniqueness, because order identifiers need to be different for every order in the feed
- [ ] Validity, because each field has to follow the allowed formats and value ranges
- [x] Completeness, because missing records are visible only by comparing with normal volume
- [ ] Integrity, because each order must refer to a customer that exists in the customer table

> A volume check detects absent data, which row-level validity or uniqueness tests cannot see. It is a completeness (and monitoring) check.

### What is the main benefit of a data contract between a producer and a consumer team?
- [ ] It makes warehouse queries run faster, since both teams then use exactly the same naming
- [ ] It removes the need for any testing, because the contract itself guarantees that the data is clean
- [x] It makes expectations explicit and testable, so breaking changes are discussed before a release
- [ ] It transfers the responsibility for all quality problems from the producer team to the consumer team

> A contract documents schema, meaning, SLAs and ownership in a machine-readable form, so both sides can test against it and plan changes. It does not remove the need for checks.

### A row has `status = "PAID"` and the contract allows only lower-case `paid`. What should the strict ingestion gate do?
- [ ] Silently convert it to lower case so the row can continue into the warehouse unhindered
- [x] Quarantine the row with its reason, and let staging normalise known cases in a deliberate step
- [ ] Drop the row without keeping any record, because the status is only a cosmetic difference in case
- [ ] Stop the whole load immediately, since a single invalid value is enough to make the feed unusable

> At the boundary, a violation is reported with a reason and kept in quarantine. Cleaning for known messiness happens explicitly in staging. Failing the whole load is for a high reject rate, not one row.

### Why is the median-and-MAD rule better than mean-and-standard-deviation for volume checks?
- [ ] It is cheaper to compute, which matters a lot when the history contains only a handful of values
- [ ] It always produces a narrower band, so that every small change in the volume is detected quickly
- [x] A few past outliers do not stretch the band, so that real anomalies are still detected later on
- [ ] It can be used on categorical data too, while the mean and deviation work only on numeric data

> Mean and standard deviation are pulled by outliers, which widens the band and hides future anomalies. Median and MAD are resistant to them.

### The nightly load reports success and all tests pass, but a third of the orders never reached the table. Which check would most likely have caught this?
- [ ] A uniqueness test on the order identifier of the fact table in the warehouse layer
- [ ] An accepted-values test on the status column of the staging orders model
- [x] A volume anomaly monitor comparing today's row count with the normal level
- [ ] A not-null test on the customer identifier column of the orders feed at ingestion

> The data that arrived was valid. Only a comparison of volume with expectation reveals records that never arrived.

### What does a total variation distance of 0.2 between two status distributions mean?
- [ ] Twenty percent of the rows in the later delivery were rejected by the contract validation step
- [ ] The later delivery has twenty percent more rows than the earlier delivery had in total volume
- [x] About a fifth of the distribution would have to move between categories to make the two match
- [ ] The distributions are close enough to be treated as the same, so no manual review is needed

> Total variation distance is half the sum of absolute differences in shares: the fraction of the distribution that differs. 0 means identical and 1 means completely different.

### After a data incident is fixed, what should come last?
- [ ] Delete the quarantine files and the logs so that the next run starts from a completely clean state
- [ ] Restore the previous version of the dashboard and close the ticket once everybody has been notified
- [x] Hold a blameless post-mortem with concrete actions and owners, such as a new check or contract clause
- [ ] Remove the alert that fired, because it would otherwise keep notifying the team about the very same issue

> Learning closes the loop: identify what detected the problem, what would have detected it sooner, and add a check, alert or contract rule so it is caught automatically next time.

### A gate rejects 35% of a delivery's rows, while the contract allows at most 10%. What is the right response?
- [ ] Load the 65% of rows that are valid, and send the 35% to quarantine without raising any alert
- [x] Fail the whole load and alert, because the feed itself is most likely broken at its source
- [ ] Raise the limit in the contract to 40% so that this delivery passes and the pipeline continues
- [ ] Repair the rejected rows by guessing the intended values, then load them all

> A few percent of messy rows is routine and goes to quarantine. A reject rate far above the agreed limit signals a systemic problem, so the load fails loudly instead of publishing a mostly missing table.

## @resources
- [Great Expectations documentation](https://docs.greatexpectations.io/)
- [Soda documentation](https://docs.soda.io/)
- [OpenLineage](https://openlineage.io/)
- [Open Data Contract Standard](https://github.com/bitol-io/open-data-contract-standard)
- [dbt: data tests](https://docs.getdbt.com/docs/build/data-tests)
