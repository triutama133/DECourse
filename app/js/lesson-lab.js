/* Per-lesson lab steps: cut one step (Part A) or a few functions (Part B) out of a lab file, and put the edited text back.
 *
 * The lab file stays ONE file (practice.py, basics.py): the terminal route and the Lab tab use it as it is. A lesson shows
 * only its own piece of it, and writes the piece back into the same file. Pure functions, no DOM: they run in the browser
 * (window.LessonLab) and in Node (scripts/test_lesson_lab.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LessonLab = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const HEADER = /^# -{20,} (Step (\d+)\b|Your results)/;
  const trimEnd = (t) => String(t).replace(/\s+$/, "");

  // ---- Part A: the lines under "# ---- Step N ..." up to the next header ----
  function stepRange(draft, n) {
    const lines = String(draft).split("\n");
    const start = lines.findIndex((l) => { const m = l.match(HEADER); return m && m[2] === String(n); });
    if (start < 0) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) if (HEADER.test(lines[i])) { end = i; break; }
    return { lines, start: start + 1, end };
  }
  function getStep(draft, n) {
    const r = stepRange(draft, n);
    return r ? trimEnd(r.lines.slice(r.start, r.end).join("\n")).replace(/^\n+/, "") : null;
  }
  function setStep(draft, n, text) {
    const r = stepRange(draft, n);
    if (!r) return { error: "step" };
    const last = r.end >= r.lines.length;
    const piece = [...trimEnd(text).split("\n"), ...(last ? [""] : ["", ""])];
    return { draft: [...r.lines.slice(0, r.start), ...piece, ...r.lines.slice(r.end)].join("\n") };
  }
  function inputs(draft) {
    const m = String(draft).match(/# ===== INPUTS[^\n]*\n([\s\S]*?)# ===== END OF INPUTS/);
    return m ? trimEnd(m[1]) : "";
  }

  // ---- Part B: top-level functions ----
  function funcBlocks(draft) {
    const lines = String(draft).split("\n");
    const heads = [];
    lines.forEach((l, i) => { const m = l.match(/^def (\w+)\s*\(/); if (m) heads.push({ name: m[1], line: i }); });
    return heads.map((h, k) => {
      let end = k + 1 < heads.length ? heads[k + 1].line : lines.length;
      while (end > h.line + 1 && lines[end - 1].trim() === "") end--;   // the blank lines between functions belong to no function
      return { name: h.name, start: h.line, end };
    });
  }
  function getFuncs(draft, names) {
    const lines = String(draft).split("\n");
    const blocks = funcBlocks(draft);
    const parts = [];
    for (const b of blocks) if (names.includes(b.name)) parts.push(lines.slice(b.start, b.end).join("\n"));
    return parts.length === names.length ? parts.join("\n\n\n") : null;
  }
  function setFuncs(draft, names, text) {
    const edited = funcBlocks(text);
    const got = edited.map((b) => b.name);
    if (got.length !== names.length || names.some((n) => !got.includes(n)) || new Set(got).size !== got.length) return { error: "defs", expected: names, got };
    const textLines = String(text).split("\n");
    const byName = {};
    edited.forEach((b) => { byName[b.name] = trimEnd(textLines.slice(b.start, b.end).join("\n")); });
    const lines = String(draft).split("\n");
    const blocks = funcBlocks(draft).filter((b) => names.includes(b.name)).sort((a, b) => b.start - a.start);   // from the bottom up, so line numbers stay valid
    if (blocks.length !== names.length) return { error: "draft" };
    for (const b of blocks) lines.splice(b.start, b.end - b.start, ...byName[b.name].split("\n"));
    return { draft: lines.join("\n") };
  }

  return { getStep, setStep, inputs, funcBlocks, getFuncs, setFuncs };
});
