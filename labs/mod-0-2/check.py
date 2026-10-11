#!/usr/bin/env python3
"""Checks the workspace you build in Lab 0.2.

    python3 labs/mod-0-2/check.py ~/kopiku

Prints PASS/FAIL for each requirement and exits non-zero if any failed. Standard library only.
"""
import csv
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

results = []


def check(name, ok, hint=""):
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else f"\n      hint: {hint}"))


def git(root, *args):
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)


def main(root):
    root = Path(root).expanduser()
    check("project folder exists", root.is_dir(), f"create {root}")
    if not root.is_dir():
        return False

    # --- virtual environment ---
    venv = root / "venv"
    check("virtual environment exists in ./venv", (venv / "pyvenv.cfg").exists(),
          "python3 -m venv venv   (run it inside the project folder)")

    # --- git repository ---
    is_repo = git(root, "rev-parse", "--is-inside-work-tree").stdout.strip() == "true"
    check("folder is a git repository", is_repo, "git init")
    if not is_repo:
        return False

    # --- .gitignore ---
    gi = (root / ".gitignore")
    text = gi.read_text() if gi.exists() else ""
    lines = {l.strip().rstrip("/") for l in text.splitlines() if l.strip() and not l.startswith("#")}
    for needed in ("venv", ".env", "data"):
        check(f".gitignore lists {needed}", needed in lines, f"add a line '{needed}/' (or '{needed}') to .gitignore")

    tracked = set(git(root, "ls-files").stdout.split())
    bad = [t for t in tracked if t.startswith(("venv/", "data/")) or t == ".env"]
    check("venv/, data/ and .env are not tracked by git", not bad, f"tracked by mistake: {bad[:3]} -> git rm -r --cached <path>")

    # --- history ---
    msgs = [m for m in git(root, "log", "--format=%s").stdout.splitlines() if m.strip()]
    check("at least 3 commits", len(msgs) >= 3, "commit in small steps: setup, script, requirements")
    check("commit messages are not all identical", len(set(msgs)) == len(msgs) and len(msgs) > 0, "describe each change differently")
    check("commit messages are descriptive (>= 10 characters)", bool(msgs) and all(len(m) >= 10 for m in msgs), "e.g. 'Add script that counts orders by status'")

    # --- no secrets in history ---
    patch = git(root, "log", "-p", "--all").stdout
    leaked = re.search(r"(AKIA[0-9A-Z]{12,}|secret[_-]?key\s*=\s*\S+|password\s*=\s*\S+|api[_-]?key\s*=\s*\S+)", patch, re.I)
    check("no secrets in git history", not leaked, "a secret was committed. Rotate it, then remove it from history")

    # --- requirements ---
    check("requirements.txt exists and is committed", "requirements.txt" in tracked, "python -m pip freeze > requirements.txt; git add requirements.txt")

    # --- the script ---
    script = root / "summarize.py"
    check("summarize.py exists and is committed", script.exists() and "summarize.py" in tracked, "copy the starter and implement it")
    orders = root / "data" / "orders.csv"
    check("data/orders.csv exists (run shopgen.py)", orders.exists(), "python3 shopgen.py --out data")
    if script.exists() and orders.exists():
        expected = Counter()
        seen = set()
        with open(orders, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["order_id"] in seen:
                    continue
                seen.add(row["order_id"])
                expected[row["status"].strip().lower()] += 1
        run = subprocess.run([sys.executable, str(script), str(orders)], capture_output=True, text=True, cwd=root)
        got = Counter()
        for line in run.stdout.splitlines():
            m = re.match(r"^\s*([a-z_]+)\s+(\d+)\s*$", line)
            if m:
                got[m.group(1)] = int(m.group(2))
        check("summarize.py runs without error", run.returncode == 0, (run.stderr.strip().splitlines() or ["see the error above"])[-1])
        check("summarize.py counts each order once, per lower-case status", got == expected,
              f"expected {dict(expected)}, got {dict(got)}")
    return all(results)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ok = main(sys.argv[1])
    print("\nAll checks passed." if ok else "\nSome checks failed. Fix them and run again.")
    sys.exit(0 if ok else 1)
