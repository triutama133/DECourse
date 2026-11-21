# Post-mortem: Gold-tier revenue for a closed quarter changed after publication

Date of incident: 2026-02-09 · Author: data team · Status: final

## Summary
The board saw Rp 104.5 million of Gold-tier revenue for Q4, while Finance had published Rp 97.7 million on 5 January. No query changed: the customer dimension overwrote tiers in place, so old orders took the customers' new tiers. The report is corrected and the dimension now keeps history.

## Impact
One published quarterly figure was wrong by Rp 6.8 million (7%) for 35 days, in 3 dashboards that read `dim_customer`. 210 customers changed tier in that period; no other measure was affected.

## Timeline
- 05 Jan 09:00 Finance publishes Q4: Gold revenue Rp 97.7 million.
- 14 Jan 02:10 Nightly load starts overwriting tiers after a loyalty review.
- 09 Feb 10:30 A board member asks why Q4 Gold revenue is now Rp 104.5 million.
- 09 Feb 11:15 Data team finds the Type 1 overwrite and adds a banner to the 3 dashboards.
- 11 Feb 16:00 Type 2 dimension deployed and history rebuilt from the change feed; Q4 back to Rp 97.7 million.

## Root cause
The dimension design allowed a past fact to change: `tier` was a Type 1 attribute although published figures depend on it. Nobody had decided whether this number may change after publication, so the default (overwrite) was used.

## Detection
A board member noticed by comparing two documents. A test that freezes revenue for closed periods would have failed on 14 Jan at 02:10, 26 days earlier.

## Action items
- Add a test that fails when revenue for a closed period changes (owner: @data-team, due 2026-02-20)
- Record for every dimension attribute whether the past may change, and why (owner: @data-lead, due 2026-03-01)
- Add "last restated" and a link to this note on the 3 dashboards (owner: @bi-analyst, due 2026-02-15)
