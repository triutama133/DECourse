#!/usr/bin/env python3
"""Checks answers.sql against the reference results.   python3 labs/mod-1-4/check.py   (or: ... reference)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import sqlcheck  # noqa: E402

if __name__ == "__main__":
    sys.exit(0 if sqlcheck.main(Path(__file__).resolve().parent, sys.argv[1] if len(sys.argv) > 1 else "") else 1)
