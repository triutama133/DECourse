# Post-mortem: revenue numbers wrong

## Summary
The Gold revenue on the dashboard went up a lot and the board was not happy. It is fixed now.

## Impact
Quite a few dashboards showed a much bigger number than before for a while.

## Timeline
- Early January: report published.
- Mid January: the nightly load ran.
- Later: the board noticed.

## Root cause
Human error. The engineer who wrote the customer load was careless and used UPDATE instead of keeping history. It was his fault.

## Detection
The board found it.

## Action items
- Be more careful with SQL in future
- Review the load
