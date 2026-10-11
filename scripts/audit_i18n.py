#!/usr/bin/env python3
"""Compare facts between curriculum/<module>/en.md and id.md: numbers, `code` spans, URLs and code blocks per section.

A translation may change words but must not change facts. Usage:
    python3 scripts/audit_i18n.py [mod-1-4 ...]
"""
import re
import sys
from collections import Counter
from pathlib import Path

CUR = Path(__file__).resolve().parents[1] / "curriculum"


def sections(text):
    """Split into {name: body} by '## @name' / '### @name' markers, plus numbered quiz questions."""
    out, cur, name, fence = {}, [], "_head", False
    qn = 0
    for line in text.split("\n"):
        if line.startswith("```"):
            fence = not fence
        m = None if fence else re.match(r"^(#{2,3}) @(\w+)\s*(.*)$", line)
        if m:
            out[name] = "\n".join(cur)
            name = (m.group(2) + (" " + str(len([k for k in out if k.startswith(m.group(2))]) + 1) if m.group(2) == "lesson" else ""))
            cur = []
        elif not fence and name == "quiz" and line.startswith("### "):
            qn += 1
            out[name] = "\n".join(cur)
            name, cur = f"quiz Q{qn}", [line]
            continue
        else:
            cur.append(line)
    out[name] = "\n".join(cur)
    return out


def strip_comments(block):
    """Code comments are translated; compare code only."""
    lines = []
    for l in block.split("\n"):
        l = re.sub(r"\s+(#|--|//)\s.*$", "", l)
        if re.match(r"^\s*(#|--|//)", l):
            continue
        lines.append(l.rstrip())
    return "\n".join(lines).strip()


def facts(body):
    nofence = re.sub(r"```.*?```", "", body, flags=re.S)
    fenced = re.findall(r"```.*?```", body, flags=re.S)
    plain = re.sub(r"(?<=\d)[.,](?=\d)", "", re.sub(r"`[^`]*`", "", nofence))  # 5,000 (en) and 5.000 (id) are the same number
    return {
        "numbers": Counter(re.findall(r"(?<![\w])\d+", plain)),
        "code": Counter(re.findall(r"`([^`]+)`", nofence)),
        "urls": Counter(re.findall(r"https?://[^\s)>\]]+", body)),
        "fences": Counter(strip_comments(f) for f in fenced),
    }


def main(mods):
    problems = 0
    for d in sorted(CUR.glob("mod-*")):
        if mods and d.name not in mods:
            continue
        en, idf = d / "en.md", d / "id.md"
        if not idf.exists():
            continue
        se, si = sections(en.read_text(encoding="utf-8")), sections(idf.read_text(encoding="utf-8"))
        for name in se:
            if name == "_head" or name not in si:
                if name not in si and name != "_head":
                    print(f"{d.name} [{name}] missing in id"); problems += 1
                continue
            fe, fi = facts(se[name]), facts(si[name])
            for kind in ("numbers", "code", "urls", "fences"):
                only_en, only_id = fe[kind] - fi[kind], fi[kind] - fe[kind]
                if kind == "numbers" and not (only_en or only_id):
                    continue
                if only_en or only_id:
                    problems += 1
                    short = lambda c: ", ".join(f"{k[:60]!r}x{v}" if v > 1 else repr(k[:60]) for k, v in list(c.items())[:8])
                    print(f"{d.name} [{name}] {kind}: only EN: {short(only_en) or '-'} | only ID: {short(only_id) or '-'}")
    print(f"\n{problems} differences")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
