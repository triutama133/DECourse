// Step mode invariants, over every lesson in both languages:  node scripts/test_steps.js [--stats]
//   1. nothing is lost or changed: the steps joined give the lesson text back (blank lines aside)
//   2. every Try it / Practice Pause box is alone in a "turn" step, and the Try-it counter (tryitStart) is exact
//   3. a step never cuts a code fence or an :::advanced fold in half
//   4. a reading step is not huge (only when it is one big code block, table or fold may it pass the budget)
//   5. no step is empty, and there are not too many steps per lesson
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const LessonSteps = require("../app/js/lesson-steps.js");

const root = path.join(__dirname, "..");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "app/js/curriculum-data.js"), "utf8"), sandbox);
const levels = sandbox.window.CURRICULUM_DATA;

const norm = (t) => String(t).replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).filter((l) => l !== "").join("\n");
let lessons = 0, steps = 0, bad = 0;
const perLesson = [];
const fail = (where, msg) => { bad++; if (bad <= 25) console.log("FAIL", where, msg); };

for (const level of levels) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
  for (const lang of ["en", "id"]) {
    const text = ls.body && (ls.body[lang] || "");
    if (!text) continue;
    const where = `${mod.id} L${li + 1} ${lang}`;
    lessons++;
    const out = LessonSteps.split(text);
    steps += out.length;
    perLesson.push({ where, n: out.length, words: out.map((s) => s.words) });
    if (out.length === 0) { fail(where, "no steps"); continue; }
    if (norm(out.map((s) => s.text).join("\n\n")) !== norm(text)) fail(where, "steps joined differ from the lesson");
    let tryits = 0, drills = 0;
    out.forEach((s, k) => {
      const w = `${where} step ${k + 1}`;
      if (!s.text.trim()) fail(w, "empty");
      if ((s.text.match(/^```/gm) || []).length % 2) fail(w, "odd number of ``` lines (a fence is cut)");
      const open = (s.text.match(/^:::(advanced\s|drill\s|ask\b)/gm) || []).length, close = (s.text.match(/^:::\s*$/gm) || []).length;
      if (open !== close) fail(w, `fold not balanced (${open} open, ${close} close)`);
      if (s.tryitStart !== tryits) fail(w, `tryitStart ${s.tryitStart}, expected ${tryits}`);
      const boxes = (s.text.match(/^> ?(🛠|💡|\*\*(Try it|Coba sendiri|Practice Pause|Jeda Latihan))/gm) || []).length;
      const tries = (s.text.match(/^> ?(🛠|\*\*(Try it|Coba sendiri))/gm) || []).length;
      if (s.kind === "turn" && boxes !== 1) fail(w, `a turn step must hold exactly one box, has ${boxes}`);
      if (s.kind === "read" && boxes) fail(w, "a reading step holds a Try it / Practice Pause box");
      tryits += tries;
      const nd = (s.text.match(/^:::(drill\s|ask\b)/gm) || []).length;
      if (s.drillStart !== drills) fail(w, `drillStart ${s.drillStart}, expected ${drills}`);
      if (s.kind === "drill" && nd !== 1) fail(w, `a drill step must hold exactly one drill, has ${nd}`);
      if (s.kind !== "drill" && nd) fail(w, "a step that is not a drill step holds a drill");
      drills += nd;
      // a table is never cut (its header row must stay with it), so one big table may carry a step past the budget
      const biggestTable = Math.max(0, ...LessonSteps.toBlocks(s.text).filter((x) => x.type === "table").map((x) => x.words));
      if (s.kind === "read" && s.words - biggestTable > LessonSteps.MAX_WORDS * 1.6) fail(w, `reading step of ${s.words} words (${biggestTable} of them a table)`);
    });
    const total = (text.match(/^> ?(🛠|\*\*(Try it|Coba sendiri))/gm) || []).length;
    if (tryits !== total) fail(where, `Try-it boxes: lesson has ${total}, steps have ${tryits}`);
    if (out.length > 30) fail(where, `${out.length} steps is a lot`);
  }
});

console.log(`${lessons} lessons, ${steps} steps (${(steps / lessons).toFixed(1)} per lesson), ${bad} problems`);
if (process.argv.includes("--stats")) {
  const all = perLesson.flatMap((p) => p.words).sort((a, b) => a - b);
  const q = (f) => all[Math.floor(all.length * f)];
  console.log(`words per step: min ${all[0]}, median ${q(0.5)}, p90 ${q(0.9)}, max ${all[all.length - 1]}`);
  perLesson.sort((a, b) => b.n - a.n).slice(0, 5).forEach((p) => console.log("  most steps:", p.where, p.n));
  perLesson.sort((a, b) => Math.max(...b.words) - Math.max(...a.words)).slice(0, 5).forEach((p) => console.log("  biggest step:", p.where, Math.max(...p.words)));
}
process.exit(bad ? 1 : 0);
