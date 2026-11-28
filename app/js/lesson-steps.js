/* Step mode: cut one lesson (Markdown) into small steps, so a beginner reads one idea per screen.
 *
 * A pure function, no DOM: it runs in the browser (window.LessonSteps) and in Node (scripts/test_steps.js),
 * and the test checks over every lesson, in both languages, that nothing is lost, split or duplicated.
 *
 * The rules, in short:
 *   - a heading (### or ####) starts a new step;
 *   - every Try it / Practice Pause box, and every drill (a small exercise with checks), is a step of its own ("Your turn");
 *   - a code block, a table, a list or a callout stays with the text before it (never alone on a screen);
 *   - a long section is cut between paragraphs, so a step stays around 180 words;
 *   - a heading with nothing under it, and a very short step, join the next step.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LessonSteps = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_WORDS = 180;   // cut a section before a paragraph that would push a step past this
  const MIN_WORDS = 40;    // do not cut before the step has at least this much
  const LIST_CHUNK = 110;  // a list is cut between items once it has this many words
  const TINY_WORDS = 25;   // a step shorter than this joins its neighbour

  const TRY_IT = /^(🛠|\*\*(Try it|Coba sendiri))/i;
  const PAUSE = /^(💡|\*\*(Practice Pause|Jeda Latihan))/i;

  const isBullet = (l) => /^\s*[-*] /.test(l);
  const isOrdered = (l) => /^\s*\d+\. /.test(l);
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isQuote = (l) => /^> ?/.test(l);
  const isHeading = (l) => /^#{3,4} /.test(l);
  const isFence = (l) => /^```/.test(l);
  const isAdvancedStart = (l) => /^:::advanced\s+/.test(l);
  const isFoldEnd = (l) => /^:::\s*$/.test(l);
  const isDrillStart = (l) => /^:::(drill|ask|talk)\b/.test(l);
  const isTraceStart = (l) => /^:::(trace|sqlsteps)\s+/.test(l);
  const isDiagram = (l) => /^\[\[diagram:[a-z0-9-]+\]\]\s*$/.test(l);
  const isRule = (l) => /^---+\s*$/.test(l);

  const countWords = (text) => (String(text).replace(/```[\s\S]*?```/g, " ").match(/\S+/g) || []).length;

  /** The lesson text as a list of blocks: {type, text, words}. Joined with a blank line they give the text back. */
  function toBlocks(source) {
    const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;
    const push = (type, from, to, extra) => {
      const text = lines.slice(from, to).join("\n");
      blocks.push(Object.assign({ type, text, words: type === "advanced" ? 0 : countWords(text) }, extra || {}));
    };
    // a long list is cut between its items, so no step is only a wall of bullets
    const pushList = (from, to) => {
      let start = from, words = 0;
      for (let k = from; k < to; k++) {
        const startsItem = isBullet(lines[k]) || isOrdered(lines[k]);
        if (startsItem && k > start && words >= LIST_CHUNK) { push("list", start, k); start = k; words = 0; }
        words += countWords(lines[k]);
      }
      push("list", start, to);
    };
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; continue; }
      const from = i;
      if (isTraceStart(line)) {                          // an animation ("watch it run"): stays with the text before it
        i++;
        while (i < lines.length && !isFoldEnd(lines[i])) i++;
        i++;
        push("trace", from, i, { words: 0 });
      } else if (isDrillStart(line)) {                   // a drill: everything up to its closing ::: is one block
        i++;
        while (i < lines.length && !isFoldEnd(lines[i])) i++;
        i++;
        push("drill", from, i);
      } else if (isAdvancedStart(line)) {                // a fold: everything up to its closing ::: is one block
        let depth = 1;
        i++;
        while (i < lines.length && depth > 0) {
          if (isFence(lines[i])) { i++; while (i < lines.length && !/^```\s*$/.test(lines[i])) i++; }   // a fence inside the fold
          else if (isAdvancedStart(lines[i])) depth++;
          else if (isFoldEnd(lines[i])) depth--;
          i++;
        }
        push("advanced", from, i);
      } else if (isFence(line)) {
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
        i++;
        push("code", from, i);
      } else if (isHeading(line)) {
        i++;
        push("heading", from, i);
      } else if (isDiagram(line)) {
        i++;
        push("diagram", from, i);
      } else if (isRule(line)) {
        i++;
        push("rule", from, i);
      } else if (isQuote(line)) {
        while (i < lines.length && isQuote(lines[i])) i++;
        const first = lines[from].replace(/^> ?/, "").trim();
        const turn = TRY_IT.test(first) ? "tryit" : PAUSE.test(first) ? "pause" : "";
        push("quote", from, i, { turn });
      } else if (isTableRow(line)) {
        while (i < lines.length && isTableRow(lines[i])) i++;
        push("table", from, i);
      } else if (isBullet(line) || isOrdered(line)) {
        const ordered = isOrdered(line);
        while (i < lines.length && (ordered ? isOrdered(lines[i]) : isBullet(lines[i]))) {
          i++;
          while (i < lines.length && lines[i].trim() !== "" && /^\s{2,}\S/.test(lines[i]) && !isBullet(lines[i]) && !isOrdered(lines[i])) i++;
        }
        pushList(from, i);
      } else {
        i++;                                              // a paragraph: runs until a blank line or the start of another kind of block
        while (i < lines.length) {
          const l = lines[i];
          if (l.trim() === "" || isHeading(l) || isFence(l) || isQuote(l) || isAdvancedStart(l) || isDrillStart(l) || isTraceStart(l) || isFoldEnd(l) || isDiagram(l) || isRule(l)) break;
          if (isTableRow(l) || isBullet(l) || isOrdered(l)) break;
          i++;
        }
        push("paragraph", from, i);
      }
    }
    return blocks;
  }

  /** The steps of a lesson: [{kind: "read" | "turn", text, words, title, tryitStart}], in reading order. */
  function split(source) {
    const blocks = toBlocks(source);
    const raw = [];                // {kind, blocks}
    let cur = null;
    const flush = () => { if (cur && cur.blocks.length) raw.push(cur); cur = null; };
    const open = () => { if (!cur) cur = { kind: "read", blocks: [], words: 0 }; return cur; };
    const introduces = (b) => b.type === "paragraph" && /[:：]\s*$/.test(b.text);   // "Here is the table:" belongs with what it introduces
    blocks.forEach((b, n) => {
      if (b.type === "heading") {
        // a heading starts a step; if the current step holds only headings (nothing under them yet), the heading joins it
        if (cur && cur.blocks.some((x) => x.type !== "heading")) flush();
        open().blocks.push(b);
      } else if (b.type === "drill") {                  // a drill is a step of its own: the learner stops and does it
        const onlyHeading = cur && cur.blocks.every((x) => x.type === "heading");
        if (!onlyHeading) flush();
        open().blocks.push(b);
        cur.kind = "drill";
        flush();
      } else if (b.type === "quote" && b.turn) {
        const onlyHeading = cur && cur.blocks.every((x) => x.type === "heading");   // "### Practice" + its box: one step
        if (!onlyHeading) flush();
        open().blocks.push(b);
        cur.kind = "turn";
        flush();
      } else {
        const next = blocks[n + 1];
        const prev = blocks[n - 1];
        // the budget this block must fit in: an introduction counts together with the block it introduces
        const group = b.words + (introduces(b) && next && next.type !== "heading" && !next.turn ? next.words : 0);
        const glued = prev && introduces(prev);                      // do not cut right after an introduction
        const step = open();
        const used = step.blocks.reduce((m, x) => m + x.words, 0);
        const cuttable = b.type !== "advanced" && b.type !== "rule" && b.type !== "trace";
        if (cuttable && !glued && used >= MIN_WORDS && used + group > MAX_WORDS) { flush(); open(); }
        cur.blocks.push(b);
      }
    });
    flush();

    // very short reading steps join their neighbour (the next one, or the one before when it is the last)
    const words = (s) => s.blocks.reduce((n, x) => n + x.words, 0);
    for (let k = 0; k < raw.length; k++) {
      const s = raw[k];
      if (s.kind !== "read" || words(s) >= TINY_WORDS || raw.length === 1) continue;
      const next = raw[k + 1], prev = raw[k - 1];
      if (next && next.kind === "read") { next.blocks = s.blocks.concat(next.blocks); raw.splice(k, 1); k--; }
      else if (prev && prev.kind === "read") { prev.blocks = prev.blocks.concat(s.blocks); raw.splice(k, 1); k--; }
    }

    let tryits = 0, drills = 0;
    return raw.map((s) => {
      const text = s.blocks.map((x) => x.text).join("\n\n");
      const head = s.blocks.find((x) => x.type === "heading");
      const step = {
        kind: s.kind,
        text,
        words: words(s),
        title: head ? head.text.replace(/^#{3,4} /, "").replace(/[`*]/g, "") : "",
        tryitStart: tryits,
        drillStart: drills,
      };
      drills += s.blocks.filter((x) => x.type === "drill").length;
      tryits += s.blocks.filter((x) => x.type === "quote" && x.turn === "tryit").length;
      return step;
    });
  }

  return { split, toBlocks, countWords, MAX_WORDS };
});
