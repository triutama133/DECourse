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
 *   :::ask What will this print?
 *   Question text (may hold a code fence).
 *   @options
 *   x + 1
 *   * 44
 *   @why
 *   Explanation, shown after the answer.
 *   :::
 *
 * A check is a Python expression, ` ## `, and the message shown when the expression is not true. Pure functions: they run in the
 * browser (window.DrillParse) and in Node (scripts/verify_drills.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DrillParse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MARKERS = ["@starter", "@check", "@hint", "@solution", "@options", "@why"];

  /** `text` is the whole block, from the ":::drill ..." line to the closing ":::" line (the closing line may be missing). */
  function parse(text) {
    const lines = String(text).replace(/\r\n/g, "\n").split("\n");
    const ask = (lines[0] || "").match(/^:::ask\s+(.+?)\s*$/);
    const head = ask ? null : (lines[0] || "").match(/^:::drill\s+(python|sql)\s+(.+?)\s*$/);
    if (!ask && !head) return null;
    const sec = { task: [], "@starter": [], "@check": [], "@hint": [], "@solution": [], "@options": [], "@why": [] };
    let cur = "task";
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^:::\s*$/.test(l)) break;
      if (MARKERS.includes(l.trim()) && l === l.trim()) { cur = l.trim(); continue; }
      sec[cur].push(l);
    }
    const trim = (arr) => arr.join("\n").replace(/^\n+|\s+$/g, "");
    const checks = sec["@check"].map((l) => l.trim()).filter(Boolean).map((l) => {
      const at = l.indexOf(" ## ");
      return at < 0 ? { expr: l, msg: "" } : { expr: l.slice(0, at).trim(), msg: l.slice(at + 4).trim() };
    });
    if (ask) {   // a "what will this print?" question: options (the right one starts with "* "), and an explanation shown after the answer
      const options = sec["@options"].map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith("* ") ? { text: l.slice(2).trim(), correct: true } : { text: l, correct: false }));
      return { kind: "ask", title: ask[1], task: trim(sec.task), options, why: trim(sec["@why"]) };
    }
    return { kind: "drill", lang: head[1], title: head[2], task: trim(sec.task), starter: trim(sec["@starter"]), checks, hint: trim(sec["@hint"]), solution: trim(sec["@solution"]) };
  }

  return { parse };
});
