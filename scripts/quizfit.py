#!/usr/bin/env python3
"""Authoring aid: make the correct quiz option NOT the longest or shortest (a learner could guess by length).

  quizfit.py need mod-1-2 en              list questions whose correct option is the longest/shortest, with all options
  quizfit.py set  mod-1-2 en fixes.json   apply fixes

fixes.json maps question number to either a list of candidate texts for the correct option, or
{"opts": {"2": "new text of option 2"}, "correct": [candidates]}. A candidate may contain [a|b] choices and [|x] optional parts;
the first candidate whose length is strictly between the shortest and the second-longest other option is used.
"""
import itertools
import json
import re
import sys
from pathlib import Path

CUR = Path(__file__).resolve().parents[1] / "curriculum"


def split(mod, lang):
    path = CUR / mod / f"{lang}.md"
    head, rest = path.read_text(encoding="utf-8").split("## @quiz")
    body, tail = rest.split("## @resources")
    return path, head, re.split(r"\n(?=### )", body), tail


def options(blk):
    return re.findall(r"^- \[( |x)\] (.+)$", blk, flags=re.M)


def expand(t):
    parts = re.split(r"(\[[^\]]*\])", t)
    choices = [(p[1:-1].split("|") if p.startswith("[") and p.endswith("]") else [p]) for p in parts]
    for combo in itertools.product(*choices):
        yield "".join(combo)


def need(mod, lang):
    _, _, parts, _ = split(mod, lang)
    n = 0
    for blk in (b for b in parts if b.startswith("###")):
        n += 1
        ops = options(blk)
        lens = [len(o[1]) for o in ops]
        ci = [i for i, o in enumerate(ops) if o[0] == "x"][0]
        others = sorted(l for i, l in enumerate(lens) if i != ci)
        if not (others[0] < lens[ci] < others[2]):
            print(f"{mod} {lang} Q{n}: correct={lens[ci]} needs {others[0] + 1}..{others[2] - 1}   others={others}")
            for i, (m, t) in enumerate(ops, 1):
                print(f"   {i}{'*' if m == 'x' else ' '} {len(t):3} {t}")


def apply(mod, lang, fixes):
    path, head, parts, tail = split(mod, lang)
    n = 0
    for k, blk in enumerate(parts):
        if not blk.startswith("###"):
            continue
        n += 1
        if str(n) not in fixes:
            continue
        fx = fixes[str(n)]
        cands, edits = (fx, {}) if isinstance(fx, list) else (fx.get("correct", []), fx.get("opts", {}))
        lines = blk.split("\n")
        idx = [i for i, l in enumerate(lines) if re.match(r"^- \[[ x]\] ", l)]
        for num, text in edits.items():
            i = idx[int(num) - 1]
            lines[i] = lines[i][:6] + text
        ops = [(lines[i][3], lines[i][6:]) for i in idx]
        ci = [j for j, o in enumerate(ops) if o[0] == "x"][0]
        others = sorted(len(o[1]) for j, o in enumerate(ops) if j != ci)
        pool = [x for c in cands for x in expand(c)]
        fit = [c for c in pool if others[0] < len(c) < others[2]]
        if cands and not fit:
            print(f"Q{n}: no candidate fits {others[0] + 1}..{others[2] - 1}; candidate lengths {sorted(set(len(c) for c in pool))[:10]}")
        if fit:
            lines[idx[ci]] = "- [x] " + fit[0]
        parts[k] = "\n".join(lines)
    path.write_text(head + "## @quiz" + "\n".join(parts) + "## @resources" + tail, encoding="utf-8")


if __name__ == "__main__":
    cmd, mod, lang = sys.argv[1:4]
    if cmd == "need":
        need(mod, lang)
    else:
        apply(mod, lang, json.load(open(sys.argv[4], encoding="utf-8")))
