#!/usr/bin/env python3
"""Authoring aid: where does the correct option rank by length? (1 = shortest, 4 = longest)
Ideal: ranks 2 and 3 most of the time. Usage: quizlen.py curriculum/mod-1-3/en.md"""
import re, sys
s = open(sys.argv[1], encoding="utf-8").read().split("## @quiz")[1].split("## @resources")[0]
extremes = n = 0
for blk in re.split(r"\n(?=### )", s):
    if not blk.startswith("###"):
        continue
    opts = re.findall(r"^- \[( |x)\] (.+)$", blk, flags=re.M)
    lens = [len(o[1]) for o in opts]
    ci = [i for i, o in enumerate(opts) if o[0] == "x"][0]
    rank = sorted(lens).index(lens[ci]) + 1 + (sorted(lens).count(lens[ci]) - 1)  # ties count as the higher rank
    n += 1
    extremes += rank in (1, 4)
    print(f"rank {rank} {lens} {'<-- extreme' if rank in (1, 4) else ''} {blk.splitlines()[0][4:50]}")
print(f"extreme: {extremes}/{n}")
