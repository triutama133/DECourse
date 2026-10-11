"""Shared checker for the SQL labs. Standard library only (uses Python's built-in SQLite).

Each lab folder has: answers.sql (yours), reference/answers.sql, datasets/<name>.sql.
Answers are found by marker lines:   -- <id> [<dataset>] <title>
Results are compared as unordered sets of rows (numbers rounded to 2 decimals), like the app's SQL Sandbox.
"""
import re
import sqlite3
from pathlib import Path


def split_answers(text):
    """Return {id: (dataset, sql)} from a file with marker lines."""
    parts = re.split(r"^-- ([a-z]+-\d+) \[(\w+)\].*$", text, flags=re.M)
    out = {}
    for i in range(1, len(parts), 3):
        key, dataset, body = parts[i], parts[i + 1], parts[i + 2]
        sql = "\n".join(l for l in body.splitlines() if not l.strip().startswith("--")).strip()
        out[key] = (dataset, sql)
    return out


def rows(con, sql):
    cur = con.execute(sql)
    out = [tuple(round(v, 2) if isinstance(v, float) else v for v in r) for r in cur.fetchall()]
    return len(cur.description), sorted(out, key=repr)


def main(lab_dir, which=""):
    lab_dir = Path(lab_dir)
    base = lab_dir / "reference" if which == "reference" else lab_dir
    mine = split_answers((base / "answers.sql").read_text())
    ref = split_answers((lab_dir / "reference" / "answers.sql").read_text())
    ok = 0
    for key in ref:
        dataset, ref_sql = ref[key]
        sql = mine.get(key, (dataset, ""))[1]
        if not sql:
            print(f"TODO  {key}: no query written yet")
            continue
        con = sqlite3.connect(":memory:")
        con.executescript((lab_dir / "datasets" / f"{dataset}.sql").read_text())
        try:
            got = rows(con, sql)
        except sqlite3.Error as e:
            print(f"FAIL  {key}: SQL error: {e}")
            continue
        want = rows(con, ref_sql)
        if got == want:
            ok += 1
            print(f"PASS  {key}")
        elif got[0] != want[0]:
            print(f"FAIL  {key}: expected {want[0]} columns, got {got[0]}")
        elif len(got[1]) != len(want[1]):
            print(f"FAIL  {key}: expected {len(want[1])} rows, got {len(got[1])}")
        else:
            print(f"FAIL  {key}: same shape, different values")
    print(f"\n{ok}/{len(ref)} answers correct")
    return ok == len(ref)
