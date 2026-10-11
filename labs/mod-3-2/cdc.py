"""Lab 3.2 part C: change data capture, consumer side.   Tests: pytest labs/mod-3-2/test_cdc.py -v

pgoutput.py (provided) decodes PostgreSQL's replication stream into 'changes'. You turn them into Debezium-style EVENTS
and apply them to a replica so that the replica ends up identical to the source table, however the events are replayed.
Read pgoutput.py's docstring first.
"""


def to_events(changes, pk):
    """changes: the list returned by pgoutput.read_changes. pk: {"public.orders": ["order_id"]} (the real primary key
    columns; the stream cannot tell you with REPLICA IDENTITY FULL). Return one event dict per change:
        {"op":   "c" (insert) | "u" (update) | "d" (delete),
         "table": the change's table,
         "key":   {pk column: value} taken from the NEW row, or from the OLD row for a delete,
         "before": the full old row when PostgreSQL sent one (change["old_is_full"] is True), otherwise None,
         "after":  the new row (None for a delete),
         "old_key": for an update that CHANGED the primary key: {pk column: OLD value}; otherwise None,
         "pos": (lsn, seq) from the change}
    Careful: with the default replica identity an update has no old row unless the key changed, and a delete's old row has
    only the key columns (the other values are None): that is NOT a 'before' image, so before must be None."""
    raise NotImplementedError("TODO: to_events")


def new_state():
    """Provided. rows: (table, key tuple) -> row dict;  pos: (table, key tuple) -> position of the last event applied."""
    return {"rows": {}, "pos": {}}


def apply_events(state, events):
    """Apply events to the state IDEMPOTENTLY and ORDER-INDEPENDENTLY per key:
      - use k = (event["table"], tuple(event["key"].values()))
      - skip an event whose pos is <= the pos already applied for k  (a duplicate, or an older event arriving late)
      - an update with old_key means the primary key changed: remove the row stored under the OLD key (and remember the
        event's pos for that old key so a replayed old event cannot bring it back), then store the new row
      - 'c' and 'u' store a copy of event["after"] under k; 'd' removes the row but KEEPS state["pos"][k]
        (otherwise replaying an old insert would resurrect a deleted row)
    Return the state."""
    raise NotImplementedError("TODO: apply_events")


def materialize(state, table):
    """The rows of one table as a list of dicts, sorted by key tuple."""
    raise NotImplementedError("TODO: materialize")
