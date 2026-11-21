# Design: keep customer tier history in dim_customer (SCD Type 2)

Author: data team · Date: 2026-02-10 · Status: approved

## Context
The Q4 report published on 5 January showed Rp 97.7 million of Gold-tier revenue. On 9 February the same report showed Rp 104.5 million for the same quarter, because the nightly load overwrites `tier` in place (Type 1) and 210 tier changes arrived in between. Finance has to restate a closed quarter, and the board now asks whether any of our numbers can be trusted.

## Goals and non-goals
- Goal: revenue for a closed period never changes after it is published; a test fails if it does.
- Goal: every fact row points at the customer version that was valid when the order was placed.
- Non-goal: changing how tiers are assigned; that belongs to the loyalty team.

## Decision
Make `tier` and `city` Type 2 attributes. `dim_customer` gets `valid_from`, `valid_to` and `is_current`; the nightly load closes the old version and inserts a new one when either attribute changes, in one transaction, so a re-run changes nothing. The fact table keeps `customer_sk`, looked up with a range join on the order time. We rebuild history once from the 210 rows in the change feed and publish a restatement note for Q4.

## Alternatives considered
- Keep Type 1 and snapshot the report each quarter: cheap, but every other report still drifts, and nobody can answer "what was this customer's tier in March?"
- Store the tier on the fact row at load time: simple to query, but a tier correction can then never be applied to past orders, and the dimension and the fact can disagree.

## Risks
The range join can double-count if two versions overlap; a uniqueness test on (customer_id, valid_from) and a reconciliation test (fact total equals source total) will catch it. The table grows by about 210 rows a month, which is negligible. To undo, keep the Type 1 table for one release and switch the view back.

## Open questions
- Does Finance want Q4 restated to Rp 97.7 million in the system, or only explained in a note?
- Which other attributes should keep history: `payment_method` on orders?
