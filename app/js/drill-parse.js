/* A drill is a small exercise inside a lesson: a task, a code box with a starting point, and checks that say what is wrong.
 *
 *   :::drill python Count the orders
 *   Task text in Markdown ("Use len() to ...").
 *   @starter
 *   orders = ["a", "b"]
 *   how_many = None
 *   @check
 *   how_many == 2 ## `how_many` should be 2: len(orders) counts the items.
 *   calls("len") ## Use the len() function.
 *   @hint
 *   len(my_list) gives how many items my_list has.
 *   @solution
 *   how_many = len(orders)
 *   :::
 *
 *   Sample files for a drill: a line "@file orders.csv" and the file's text under it (before @check, any marker ends it).
 *
 *   :::trace Follow the value
 *   @code
 *   x = 5
 *   y = x + 1
 *   @notes
 *   2 | y is worked out now, with x = 5
 *   :::
 *
 *   :::ask What will this print?
 *   Question text (may hold a code fence).
 *   @options
 *   x + 1
 *   * 44
 *   @why
 *   Explanation, shown after the answer.
 *   :::
 *
 * In a check: the learner's variables and functions by name; `out` (what the code printed); `code` (the source); calls("len"),
 * uses("x"), defines("f"), has_node("If") and count_nodes("Assert") (syntax elements by their ast name); printed_by(fn, *args) (what fn prints);
 * raises_error(ValueError, fn, *args); rerun_with("name", value) (the namespace after running the learner's code again with the first
 * assignment to `name` replaced: does it work for other data?); read_file("name") (a file the code wrote).
 *
 * A check is a Python expression, ` ## `, and the message shown when the expression is not true. Pure functions: they run in the
 * browser (window.DrillParse) and in Node (scripts/verify_drills.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DrillParse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MARKERS = ["@starter", "@check", "@hint", "@solution", "@options", "@why", "@code", "@notes"];
  const FILE = /^@file\s+(\S+)$/;

  /** `text` is the whole block, from the ":::drill ..." line to the closing ":::" line (the closing line may be missing). */
  function parse(text) {
    const lines = String(text).replace(/\r\n/g, "\n").split("\n");
    const trace = (lines[0] || "").match(/^:::trace\s+(.+?)\s*$/);
    if (trace) {   // "watch it run": the code, and optional notes for some lines ("3 | text")
      const code = [], notes = {}, files = {};
      let cur = "task", fname = "", fl = [];
      const task = [];
      for (let i = 1; i < lines.length; i++) {
        const l = lines[i];
        if (/^:::\s*$/.test(l)) break;
        const fm = l.match(FILE);
        if (fm) { if (fname) files[fname] = fl.join("\n").replace(/\s+$/, "") + "\n"; fname = fm[1]; fl = []; cur = "file"; continue; }
        if (l === "@code" || l === "@notes") { if (fname) { files[fname] = fl.join("\n").replace(/\s+$/, "") + "\n"; fname = ""; } cur = l; continue; }
        if (cur === "@code") code.push(l);
        else if (cur === "file") fl.push(l);
        else if (cur === "@notes") { const nm = l.match(/^(\d+)\s*\|\s*(.+)$/); if (nm) notes[nm[1]] = nm[2].trim(); }
        else task.push(l);
      }
      if (fname) files[fname] = fl.join("\n").replace(/\s+$/, "") + "\n";
      return { kind: "trace", title: trace[1], task: task.join("\n").trim(), code: code.join("\n").replace(/^\n+|\s+$/g, ""), notes, files };
    }
    const ask = (lines[0] || "").match(/^:::ask\s+(.+?)\s*$/);
    const head = ask ? null : (lines[0] || "").match(/^:::drill\s+(python|sql)\s+(.+?)\s*$/);
    if (!ask && !head) return null;
    const sec = { task: [], "@starter": [], "@check": [], "@hint": [], "@solution": [], "@options": [], "@why": [] };
    let cur = "task", fname = "";
    const files = {}, fileLines = {};
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^:::\s*$/.test(l)) break;
      const fm = l.match(FILE);
      if (fm) { fname = fm[1]; fileLines[fname] = []; cur = "file"; continue; }
      if (MARKERS.includes(l.trim()) && l === l.trim()) { cur = l.trim(); continue; }
      if (cur === "file") fileLines[fname].push(l); else sec[cur].push(l);
    }
    for (const k of Object.keys(fileLines)) files[k] = fileLines[k].join("\n").replace(/\s+$/, "") + "\n";
    const trim = (arr) => arr.join("\n").replace(/^\n+|\s+$/g, "");
    const checks = sec["@check"].map((l) => l.trim()).filter(Boolean).map((l) => {
      const at = l.indexOf(" ## ");
      return at < 0 ? { expr: l, msg: "" } : { expr: l.slice(0, at).trim(), msg: l.slice(at + 4).trim() };
    });
    if (ask) {   // a "what will this print?" question: options (the right one starts with "* "), and an explanation shown after the answer
      const options = sec["@options"].map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith("* ") ? { text: l.slice(2).trim(), correct: true } : { text: l, correct: false }));
      return { kind: "ask", title: ask[1], task: trim(sec.task), options, why: trim(sec["@why"]) };
    }
    return { kind: "drill", lang: head[1], title: head[2], task: trim(sec.task), starter: trim(sec["@starter"]), checks, hint: trim(sec["@hint"]), solution: trim(sec["@solution"]), files };
  }

  return { parse };
});
