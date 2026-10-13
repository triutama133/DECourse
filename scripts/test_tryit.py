#!/usr/bin/env python3
"""Tests the "Try it" checkers (labs/tryit): every reference solution must PASS, and every deliberately wrong version (a mutant) must FAIL.

    python3 scripts/test_tryit.py            # all exercises
    python3 scripts/test_tryit.py 1.6-4      # one exercise

A checker that accepts a wrong answer is worse than no checker, so each mutant here is a realistic mistake a learner could make.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "labs" / "tryit" / "check.py"
REF = ROOT / "labs" / "tryit" / "reference"

# id -> (reference folder, [(mutant name, file, old text, new text), ...]); the new text may contain nothing (a deletion)
MUTANTS = {
    "1.6-2": ("1.6", [
        ("no Authorization header", "try_http.py", 'headers={"Authorization": "Bearer learner-token"}', "headers={}"),
        ("never tries without the header", "try_http.py", "try:\n    urllib.request.urlopen(URL)\nexcept urllib.error.HTTPError as e:\n    print(e.code)\n", ""),
        ("wrong page size", "try_http.py", "limit=3", "limit=2"),
        ("uses requests", "try_http.py", "import json\n", "import json\nimport requests\n"),
        ("does not print the ids", "try_http.py", "print(resp.status, [o[\"id\"] for o in body[\"data\"]])", "print(resp.status)"),
    ]),
    "1.6-3": ("1.6", [
        ("no /arrive", "cursor_all.py", '        get("/arrive?n=3")\n', "        pass\n"),
        ("/arrive before the first page", "cursor_all.py", "ids, cursor, first = [], None, True\n", 'ids, cursor, first = [], None, False\nget("/arrive?n=3")\n'),
        ("stops after the first page", "cursor_all.py", "    if cursor is None:\n        break", "    break"),
        ("wrong page size", "cursor_all.py", "limit=10", "limit=5"),
        ("always waits 2 seconds", "limited.py", 'wait = float(e.headers["Retry-After"])', "wait = 2.0"),
        ("does not wait", "limited.py", "time.sleep(wait)\n", ""),
        ("no retry", "limited.py", "    with urllib.request.urlopen(req) as r:\n        print(r.status)\n", ""),
    ]),
    "1.6-4": ("1.6", [
        ("checkpoint saved before the data", "load.py",
         '    cursor = page["next_cursor"]\n    save_checkpoint(cursor)\n    time.sleep(1)\n',
         '    cursor = page["next_cursor"]\n    save_checkpoint(cursor)\n    time.sleep(1)\n'),   # placeholder, replaced below
        ("never saves the checkpoint", "load.py", "    save_checkpoint(cursor)\n", ""),
        ("ignores the checkpoint at start-up", "load.py", 'cursor = json.load(open("checkpoint.json"))["cursor"] if os.path.exists("checkpoint.json") else None', "cursor = None"),
        ("duplicates when it restarts", "load.py", '            if o["id"] not in seen:\n                out.write', '            if True:\n                out.write'),
        ("wrong page size", "load.py", "limit=5", "limit=10"),
        ("checkpoint is not a cursor", "load.py", 'json.dump({"cursor": cursor}, f)', 'json.dump({"page": 1}, f)'),
    ]),
    "1.6-5": ("1.6", [
        ("separator is a dot", "flat.py", 'out.update(flatten(value, name + "_"))', 'out.update(flatten(value, name + "."))'),
        ("list is not turned into text", "flat.py", "out[name] = json.dumps(value)", "out[name] = value"),
        ("changes the record it was given", "flat.py", "    out = {}\n", "    out = {}\n    record['touched'] = True\n"),
        ("only one level deep", "flat.py", 'out.update(flatten(value, name + "_"))', 'out.update({f"{name}_{k}": v for k, v in value.items()})'),
        ("reports fields that are in only one record", "flat.py", "for k in old if k in new and", "for k in old if"),
        ("compares values instead of types", "flat.py", "type(old[k]) is not type(new[k])", "old[k] != new[k]"),
    ]),
    "1.6-6": ("1.6", [
        ("no primary key", "load_orders.py", "order_id INTEGER PRIMARY KEY", "order_id INTEGER"),
        ("plain INSERT", "load_orders.py", "INSERT OR REPLACE", "INSERT"),
        ("loads only once", "load_orders.py", "load()\nload()\n", "load()\n"),
        ("counts the file lines twice", "load_orders.py", "print(len(rows), len({r[\"order_id\"] for r in rows}))", "print(len(rows), len(rows))"),
    ]),
}

# the one mutant that needs a reordering rather than a substitution
CHECKPOINT_FIRST = '''
seen = set()
if os.path.exists("out.jsonl"):
    seen = {json.loads(l)["id"] for l in open("out.jsonl") if l.strip()}
cursor = json.load(open("checkpoint.json"))["cursor"] if os.path.exists("checkpoint.json") else None
while True:
    page = get("/orders?limit=5" + (f"&cursor={cursor}" if cursor else ""))
    cursor = page["next_cursor"]
    save_checkpoint(cursor)
    time.sleep(1)
    with open("out.jsonl", "a") as out:
        for o in page["data"]:
            if o["id"] not in seen:
                out.write(json.dumps(o) + "\\n")
                seen.add(o["id"])
    if cursor is None:
        break
'''


def run_check(ident, folder):
    p = subprocess.run([sys.executable, str(CHECK), ident, str(folder)], capture_output=True, text=True, timeout=300)
    return p.returncode, p.stdout


def main(argv):
    wanted = argv or sorted(MUTANTS)
    bad = 0
    for ident in wanted:
        refdir, mutants = MUTANTS[ident]
        code, out = run_check(ident, REF / refdir)
        print(f"{ident}  reference  {'PASS' if code == 0 else 'FAIL  <-- should pass'}")
        if code != 0:
            bad += 1
            print(out)
        for name, fname, old, new in mutants:
            tmp = Path(tempfile.mkdtemp(prefix="tryit-mut-"))
            try:
                for f in (REF / refdir).glob("*.py"):
                    shutil.copy(f, tmp / f.name)
                text = (tmp / fname).read_text()
                if name == "checkpoint saved before the data":
                    head = text.split("seen = set()")[0]
                    mutated = head.rstrip("\n") + "\n\n" + CHECKPOINT_FIRST.lstrip("\n")
                else:
                    assert old in text, f"{ident}: '{old[:40]}' not found in {fname}"
                    mutated = text.replace(old, new, 1)
                (tmp / fname).write_text(mutated)
                code, out = run_check(ident, tmp)
                caught = code != 0
                print(f"{ident}  mutant: {name:48} {'caught' if caught else 'NOT CAUGHT  <-- the checker accepted a wrong answer'}")
                if not caught:
                    bad += 1
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
    print("\nAll good." if not bad else f"\n{bad} problem(s).")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
