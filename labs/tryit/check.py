#!/usr/bin/env python3
"""Checks one of your "Try it" exercises, so that you know you really got it.

    python3 labs/tryit/check.py list                  # which exercises can be checked
    python3 labs/tryit/check.py 1.6-3                 # check exercise 3 of Module 1.6, using the files in the current folder
    python3 labs/tryit/check.py 1.6-3 ~/practice      # ... using the files in ~/practice
    python3 labs/tryit/check.py 1.6-3 --hint 1        # a hint (levels 1, 2, 3: the higher, the closer to the answer)

The exercise id is printed under each Try it ("Check it: ..."). The checker looks only at RESULTS: it runs your script in a private
folder (your folder is never changed), feeds it inputs of its own, some of them different from the lesson's, and compares what comes
out. It is not part of any proof code and nothing is recorded: it exists so that "I think it works" becomes "I know it works".
Standard library only (Python 3.8+); some exercises start a practice server on 127.0.0.1:8765, so stop your own copy first.
"""
import argparse
import hashlib
import importlib
import os
import platform
import shutil
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
if __name__ == "__main__":
    sys.modules["check"] = sys.modules["__main__"]     # the checks_*.py files do `from check import ...` and must share one registry

CHECKS = {}          # id -> Check


class Check:
    def __init__(self, ident, title, files, hints, fn):
        self.ident, self.title, self.files, self.hints, self.fn = ident, title, files, hints, fn


def exercise(ident, title, files, hints):
    """Register a checking function. `files` are the names of the files you must have written; `hints` has three levels."""
    def deco(fn):
        CHECKS[ident] = Check(ident, title, files, hints, fn)
        return fn
    return deco


class Ctx:
    """What a checking function works with: your folder, a private work folder, and PASS/FAIL reporting."""

    def __init__(self, user_dir, work):
        self.user_dir, self.work = Path(user_dir), Path(work)
        self.passed = self.failed = 0

    def ok(self, text):
        self.passed += 1
        print(f"PASS  {text}")

    def fail(self, text, hint=None):
        self.failed += 1
        print(f"FAIL  {text}")
        if hint:
            print(f"      hint: {hint}")

    def check(self, condition, text, hint=None):
        if condition:
            self.ok(text)
        else:
            self.fail(text, hint)
        return bool(condition)

    def info(self, text):
        print(f"      {text}")

    def need_files(self, names):
        """Copy your files into the private folder. False (with a FAIL line) when one is missing."""
        good = True
        for name in names:
            src = self.user_dir / name
            if src.is_file():
                shutil.copy(src, self.work / name)
                self.ok(f"{name} exists")
            else:
                self.fail(f"{name} exists in {self.user_dir}", f"save your file as {name} in that folder, or give the folder as the second argument")
                good = False
        return good


def tail(text, n=3):
    lines = [l for l in (text or "").strip().split("\n") if l.strip()]
    return " | ".join(lines[-n:]) if lines else "(no output)"


def load_checks():
    for path in sorted(HERE.glob("checks_*.py")):
        importlib.import_module(path.stem)


def sort_key(ident):
    mod, n = ident.split("-")
    return ([int(x) for x in mod.split(".")], int(n))


def cmd_list():
    load_checks()
    print("Exercises you can check (the id is printed under each Try it):\n")
    for ident in sorted(CHECKS, key=sort_key):
        c = CHECKS[ident]
        print(f"  {ident:8} {c.title}  ({', '.join(c.files)})")
    print("\nRun:  python3 labs/tryit/check.py <id> [folder]")
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description="Check a Try it exercise.")
    ap.add_argument("ident", help="exercise id such as 1.6-3, or 'list'")
    ap.add_argument("folder", nargs="?", default=".", help="the folder with your files (default: the current folder)")
    ap.add_argument("--hint", type=int, choices=(1, 2, 3), help="show a hint of level 1, 2 or 3 instead of checking")
    args = ap.parse_args(argv)
    if args.ident == "list":
        return cmd_list()
    load_checks()
    c = CHECKS.get(args.ident)
    if not c:
        print(f"No checker for '{args.ident}'. Some exercises are done on paper or in the SQL Sandbox and compare themselves with the lesson.\n"
              "Run  python3 labs/tryit/check.py list  to see the ones that can be checked.")
        return 2
    print(f"== Try it {c.ident}: {c.title}")
    if args.hint:
        print(f"Hint {args.hint}: {c.hints[args.hint - 1]}")
        return 0
    user_dir = Path(os.path.expanduser(args.folder)).resolve()
    if not user_dir.is_dir():
        print(f"FAIL  the folder {user_dir} does not exist")
        return 1
    work = tempfile.mkdtemp(prefix="tryit-")
    ctx = Ctx(user_dir, work)
    t0 = time.time()
    try:
        c.fn(ctx)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(f"\n{ctx.passed} passed, {ctx.failed} failed ({time.time() - t0:.0f} s)")
    if ctx.failed:
        print("Not yet. Fix the first FAIL, run the check again, and use --hint 1 (then 2, 3) if you are stuck.")
        return 1
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    osname = platform.system().lower() or "unknown"
    fields = ["TRY1", c.ident, str(ctx.passed), py, osname]
    chk = hashlib.sha256(("|".join(fields)).encode("utf-8")).hexdigest()[:6]
    token = ":".join(fields + [chk])
    print("Done: this exercise works against hidden and hostile inputs.")
    print(f"Verification code (paste into the Try-It box in the web app):  {token}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

