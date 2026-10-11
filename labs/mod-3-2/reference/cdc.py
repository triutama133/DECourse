"""Reference solution for Lab 3.2 part C: a CDC consumer."""


def to_events(changes, pk):
    """Turn decoded WAL changes into Debezium-style events.
    pk: {"public.orders": ["order_id"]}. Event: {"op": "c"|"u"|"d", "table", "key": {...}, "before": dict|None,
    "after": dict|None, "old_key": dict|None (only when the primary key itself changed), "pos": (lsn, seq)}."""
    events = []
    for ch in changes:
        cols = pk[ch["table"]]
        op = {"insert": "c", "update": "u", "delete": "d"}[ch["type"]]
        after = ch["new"]
        old = ch["old"]
        before = old if (old is not None and ch["old_is_full"]) else None
        base = after if after is not None else old
        key = {c: base[c] for c in cols}
        old_key = None
        if op == "u" and old is not None:
            candidate = {c: old[c] for c in cols}
            if candidate != key:
                old_key = candidate
        events.append({"op": op, "table": ch["table"], "key": key, "before": before, "after": after,
                       "old_key": old_key, "pos": (ch["lsn"], ch["seq"])})
    return events


def new_state():
    """rows: (table, key tuple) -> row;  pos: (table, key tuple) -> position of the last event applied for that key."""
    return {"rows": {}, "pos": {}}


def apply_events(state, events):
    """Apply events idempotently: replaying the same events, or delivering them out of order, gives the same state."""
    for ev in events:
        k = (ev["table"], tuple(ev["key"].values()))
        if ev["pos"] <= state["pos"].get(k, (-1, -1)):
            continue                                   # already applied, or superseded by a later event for this key
        if ev["old_key"] is not None:                  # the primary key changed: the old row disappears
            old = (ev["table"], tuple(ev["old_key"].values()))
            if ev["pos"] > state["pos"].get(old, (-1, -1)):
                state["rows"].pop(old, None)
                state["pos"][old] = ev["pos"]
        if ev["op"] == "d":
            state["rows"].pop(k, None)                 # keep state["pos"][k]: a replayed older insert must not resurrect it
        else:
            state["rows"][k] = dict(ev["after"])
        state["pos"][k] = ev["pos"]
    return state


def materialize(state, table):
    """The rows of one table, sorted by key."""
    return [row for (t, key), row in sorted(((k, r) for k, r in state["rows"].items() if k[0] == table), key=lambda kr: kr[0][1])]
