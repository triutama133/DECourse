#!/usr/bin/env python3
"""Paragraph-by-paragraph fact check between en.md and id.md (they are translated 1:1).

For every aligned paragraph (outside code fences) compare the numbers. A difference means a changed or dropped measurement.
Usage: python3 scripts/audit_i18n_paragraphs.py [mod-3-2 ...]
"""
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import audit_i18n as a

CUR = Path(__file__).resolve().parents[1] / "curriculum"


def paras(body):
    body = re.sub(r"```.*?```", "", body, flags=re.S)
    return [l.strip() for l in body.split("\n") if l.strip() and not l.startswith("|---") and not l.startswith(">")] + \
           [l.strip() for l in body.split("\n") if l.startswith(">")]


def nums(line):
    plain = re.sub(r"(?<=\d)[.,](?=\d)", "", re.sub(r"https?://\S+", "", line))
    return Counter(re.findall(r"(?<![\w])\d+", plain))


def main(mods):
    bad = 0
    for d in sorted(CUR.glob("mod-*")):
        if mods and d.name not in mods:
            continue
        if not (d / "id.md").exists():
            continue
        se = a.sections((d / "en.md").read_text(encoding="utf-8"))
        si = a.sections((d / "id.md").read_text(encoding="utf-8"))
        for name in se:
            if name == "_head" or name not in si:
                continue
            pe, pi = paras(se[name]), paras(si[name])
            if len(pe) != len(pi):
                print(f"{d.name} [{name}] paragraph count differs: EN {len(pe)} vs ID {len(pi)}")
                bad += 1
                continue
            for x, y in zip(pe, pi):
                ne, ni = nums(x), nums(y)
                if ne != ni:
                    bad += 1
                    print(f"{d.name} [{name}] EN-only {sorted((ne - ni).elements())} ID-only {sorted((ni - ne).elements())}\n    EN: {x[:170]}\n    ID: {y[:170]}")
    print(f"\n{bad} paragraph(s) differ")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
