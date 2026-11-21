#!/usr/bin/env python3
"""Check the STRUCTURE of a design doc or a post-mortem (Module 2.5, lesson 9).

    python3 scripts/check_writing.py design     DESIGN.md
    python3 scripts/check_writing.py postmortem POSTMORTEM.md
    python3 scripts/check_writing.py self-test

It checks what a reviewer notices in the first minute: the sections are there, the doc fits on about one page,
it uses numbers instead of adjectives, a design names the alternatives it rejected, a post-mortem has a timeline
and action items with an owner and a date, and nobody is blamed. It cannot judge whether your reasoning is good:
ask someone to read it. Headings may be in English or Indonesian.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1] / "labs" / "shared" / "writing"

SECTIONS = {
    "design": [
        ("Context", r"context|problem|background|konteks|masalah|latar belakang"),
        ("Goals and non-goals", r"goals?|tujuan"),
        ("Decision", r"decision|proposal|design|keputusan|usulan|rancangan"),
        ("Alternatives considered", r"alternatives?|alternatif|options considered|pilihan"),
        ("Risks", r"risks?|risiko|trade-?offs?"),
        ("Open questions", r"open questions?|pertanyaan terbuka"),
    ],
    "postmortem": [
        ("Summary", r"summary|ringkasan"),
        ("Impact", r"impact|dampak"),
        ("Timeline", r"timeline|kronologi|linimasa"),
        ("Root cause", r"root cause|akar masalah|penyebab"),
        ("Detection", r"detection|deteksi"),
        ("Action items", r"action items?|actions|tindak lanjut|tindakan"),
    ],
}
WORDS = {"design": (250, 1000), "postmortem": (150, 900)}
BLAME = r"\b(fault|blame[ds]?|careless|stupid|lazy|incompetent|should have known|human error|kesalahan manusia|ceroboh|lalai|salah dia|salahnya)\b"


def sections(text):
    """Map of heading -> body, for '#'-style headings."""
    out, cur = {}, None
    for line in text.splitlines():
        m = re.match(r"^#{1,4}\s+(.+?)\s*$", line)
        if m:
            cur = m.group(1).strip()
            out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return {k: "\n".join(v).strip() for k, v in out.items()}


def find(secs, rx):
    for title, body in secs.items():
        if re.search(rx, title, flags=re.I):
            return title, body
    return None, None


def check(kind, text, quiet=False):
    results = []
    def ok(cond, what, hint=""):
        results.append(bool(cond))
        if not quiet:
            print(("PASS  " if cond else "FAIL  ") + what + ("" if cond or not hint else f"\n      hint: {hint}"))

    secs = sections(text)
    for name, rx in SECTIONS[kind]:
        title, body = find(secs, rx)
        ok(title is not None and len(body.split()) >= 3, f"section '{name}' with some text under it",
           f"add a heading such as '## {name}' and write at least a sentence under it")
    words = len(re.findall(r"\w+", text))
    lo, hi = WORDS[kind]
    ok(lo <= words <= hi, f"about one page: {lo} to {hi} words ({words} now)",
       "cut background nobody will act on" if words > hi else "say what the reader needs to decide or to do")
    numbers = re.findall(r"\b\d[\d.,:%]*\b", text)
    ok(len(numbers) >= 3, f"numbers instead of adjectives ({len(numbers)} found, at least 3)",
       "replace 'slow', 'big', 'many' with measured values: rows, minutes, rupiah, percent")
    if kind == "design":
        _, alt = find(secs, SECTIONS["design"][3][1])
        items = re.findall(r"^\s*(?:[-*]|\d+\.)\s+\S", alt or "", flags=re.M)
        ok(len(items) >= 2, f"at least 2 alternatives you rejected, as list items ({len(items)} found)",
           "for each rejected option, one line: what it is and why you did not choose it")
    else:
        _, tl = find(secs, SECTIONS["postmortem"][2][1])
        stamps = re.findall(r"\b\d{1,2}[:.]\d{2}\b", tl or "")
        ok(len(stamps) >= 3, f"a timeline with times (HH:MM) on at least 3 entries ({len(stamps)} found)",
           "when did it start, when was it detected, when was it fixed, when was the data repaired")
        _, imp = find(secs, SECTIONS["postmortem"][1][1])
        ok(bool(re.search(r"\d", imp or "")), "the impact is measured (a number in 'Impact')",
           "how many rows, reports, users, rupiah or hours were affected")
        _, act = find(secs, SECTIONS["postmortem"][5][1])
        lines = [l for l in (act or "").splitlines() if re.match(r"^\s*(?:[-*]|\d+\.)\s+", l)]
        good = [l for l in lines if re.search(r"(owner|pemilik|@\w+)", l, re.I) and re.search(r"\b\d{4}-\d{2}-\d{2}\b", l)]
        ok(len(lines) >= 2 and len(good) == len(lines), f"at least 2 action items, each with an owner and a date YYYY-MM-DD ({len(good)} of {len(lines)} complete)",
           "write each action as '- Add a row-count check on silver.orders (owner: @rina, due 2026-12-01)'")
        blame = sorted(set(m.group(0).lower() for m in re.finditer(BLAME, text, flags=re.I)))
        ok(not blame, "blameless: no blame words" + (f" (found: {', '.join(blame)})" if blame else ""),
           "describe what the system allowed and what will stop it next time, not who made the mistake")
    return all(results)


def self_test():
    cases = [("design", "design_template_example.md", True), ("postmortem", "postmortem_example.md", True),
             ("postmortem", "postmortem_draft.md", False), ("postmortem", "postmortem_draft_id.md", False)]
    bad = 0
    for kind, name, want in cases:
        got = check(kind, (HERE / name).read_text(encoding="utf-8"), quiet=True)
        print(f"{name:32} {'passes' if got else 'fails '}{'' if got == want else '  <-- WRONG'}")
        bad += got != want
    print("\nAll good." if not bad else f"\n{bad} problem(s).")
    return 1 if bad else 0


def main(argv):
    if len(argv) == 2 and argv[1] == "self-test":
        return self_test()
    if len(argv) != 3 or argv[1] not in SECTIONS:
        print(__doc__)
        return 2
    path = Path(argv[2])
    if not path.is_file():
        print(f"FAIL  {path} does not exist")
        return 1
    passed = check(argv[1], path.read_text(encoding="utf-8"))
    print("\nStructure looks right. Now ask someone to read it: this script cannot judge the reasoning." if passed
          else "\nNot yet: fix the failed checks and run this again.")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
