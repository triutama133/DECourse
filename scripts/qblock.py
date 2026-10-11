"""Helper used while authoring: replace the four option lines of one quiz question.

    from qblock import set_options
    set_options("curriculum/mod-1-3/en.md", "Three orders have the same total", ["wrong a", "!right", "wrong b", "wrong c"])
A leading "!" marks the correct option. The question is found by the start of its heading text.
"""
import re


def set_options(path, heading_start, options):
    text = open(path, encoding="utf-8").read()
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("### ") and line[4:].startswith(heading_start):
            j = i + 1
            start = j
            while j < len(lines) and re.match(r"^- \[[ x]\] ", lines[j]):
                j += 1
            assert j - start == 4, f"{path}: question '{heading_start}' has {j - start} options"
            new = [("- [x] " + o[1:]) if o.startswith("!") else ("- [ ] " + o) for o in options]
            assert sum(o.startswith("!") for o in options) == 1
            lines[start:j] = new
            open(path, "w", encoding="utf-8").write("\n".join(lines))
            return
    raise SystemExit(f"{path}: question starting '{heading_start}' not found")
