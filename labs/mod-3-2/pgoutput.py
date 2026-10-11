"""Lab 3.2 part C helper (provided): decode PostgreSQL's logical replication stream (the "pgoutput" plugin).

This is the same binary protocol that Debezium reads from the write-ahead log. Read it: it is short.

    changes = read_changes(conn, slot="kopiku_slot", publication="kopiku_pub")

returns a list of dicts, one per row change, in commit order:
    {"type": "insert" | "update" | "delete",
     "table": "public.orders",
     "key_cols": ["order_id"],          # columns that form the replica identity key
     "new": {col: text-or-None} | None, # the row AFTER the change (insert, update)
     "old": {col: text-or-None} | None, # the row BEFORE the change, when PostgreSQL sends it (see below)
     "old_is_full": bool,               # True: `old` has every column (REPLICA IDENTITY FULL); False: only key columns
     "lsn": int, "xid": int,            # log sequence number of the transaction's commit, transaction id
     "seq": int}                        # position of this change INSIDE its transaction (0, 1, 2, ...)

(lsn, seq) orders every change. Changes of one transaction share the same lsn, so lsn alone is not enough.
Caution: with REPLICA IDENTITY FULL, key_cols lists EVERY column. The real primary key is not in the stream: ask the catalog.

Values are the TEXT form of each column (PostgreSQL's wire format), or None for NULL. Calling read_changes CONSUMES
the changes from the slot: the next call returns only what happened since.
"""
import struct


def _cstr(buf, pos):
    end = buf.index(b"\x00", pos)
    return buf[pos:end].decode(), end + 1


def _tuple(buf, pos, cols):
    (n,) = struct.unpack_from("!h", buf, pos)
    pos += 2
    row = {}
    for i in range(n):
        kind = chr(buf[pos])
        pos += 1
        if kind == "n":
            row[cols[i]] = None
        elif kind == "u":                      # an unchanged TOASTed value is not sent
            row[cols[i]] = "<unchanged>"
        elif kind == "t":
            (length,) = struct.unpack_from("!i", buf, pos)
            pos += 4
            row[cols[i]] = buf[pos:pos + length].decode()
            pos += length
        else:
            raise ValueError(f"unsupported tuple column kind {kind!r}")
    return row, pos


def decode(messages):
    """messages: iterable of (lsn, xid, data_bytes) as returned by pg_logical_slot_get_binary_changes."""
    relations, out = {}, []
    commit_lsn, xid = 0, 0
    pending = []
    for lsn, msg_xid, data in messages:
        data = bytes(data)
        kind = chr(data[0])
        if kind == "B":
            pending, xid = [], msg_xid
        elif kind == "R":
            (rel_id,) = struct.unpack_from("!i", data, 1)
            ns, pos = _cstr(data, 5)
            name, pos = _cstr(data, pos)
            ident = chr(data[pos])
            (ncols,) = struct.unpack_from("!h", data, pos + 1)
            pos += 3
            cols, keys = [], []
            for _ in range(ncols):
                flags = data[pos]
                col, pos = _cstr(data, pos + 1)
                pos += 8                       # type oid + type modifier
                cols.append(col)
                if flags & 1:
                    keys.append(col)
            relations[rel_id] = {"table": f"{ns}.{name}", "cols": cols, "keys": keys, "identity": ident}
        elif kind in "IUD":
            (rel_id,) = struct.unpack_from("!i", data, 1)
            rel = relations[rel_id]
            pos = 5
            old = new = None
            old_full = False
            while pos < len(data):
                tag = chr(data[pos])
                pos += 1
                row, pos = _tuple(data, pos, rel["cols"])
                if tag in "KO":
                    old, old_full = row, tag == "O"
                elif tag == "N":
                    new = row
            change = {"type": {"I": "insert", "U": "update", "D": "delete"}[kind], "table": rel["table"],
                      "key_cols": rel["keys"], "new": new, "old": old, "old_is_full": old_full}
            pending.append(change)
        elif kind == "C":
            for i, ch in enumerate(pending):
                ch["lsn"], ch["xid"], ch["seq"] = lsn, xid, i
                out.append(ch)
            pending = []
    return out


def read_changes(conn, slot, publication):
    """Fetch (and consume) the decoded changes waiting in a logical replication slot that uses the pgoutput plugin."""
    rows = conn.execute(
        "SELECT lsn::text, xid::text::bigint, data FROM pg_logical_slot_get_binary_changes(%s, NULL, NULL, "
        "'proto_version', '1', 'publication_names', %s)", (slot, publication)).fetchall()

    def lsn_to_int(text):
        hi, lo = text.split("/")
        return (int(hi, 16) << 32) + int(lo, 16)

    return decode([(lsn_to_int(r[0]), r[1], r[2]) for r in rows])
