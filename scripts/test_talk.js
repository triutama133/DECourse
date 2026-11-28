#!/usr/bin/env node
// The teacher conversations (":::talk" blocks): the parser reads them, bad ones are refused, and every conversation in the
// lessons is well formed and the same in both languages. (The click-through itself is checked in a real browser by hand.)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const DrillParse = require("../app/js/drill-parse.js");
const LessonSteps = require("../app/js/lesson-steps.js");
const bad = [];
const fail = (m) => bad.push(m);

// 1. the parser
const sample = [
  ":::talk Why quotes?",
  "@teacher First line.",
  "A second line of the same speech.",
  "@ask What is `\"2\" + \"3\"`?",
  "@choice 5 | Not quite.",
  "@choice * 23 | Yes: text glues together.",
  "@choice an error | No error here.",
  "@teacher Closing words.",
  ":::",
].join("\n");
const d = DrillParse.parse(sample);
if (!d || d.kind !== "talk" || d.title !== "Why quotes?") fail("a talk is not read as a talk");
else {
  if (d.script.map((x) => x.type).join() !== "say,ask,say") fail("script order is wrong: " + d.script.map((x) => x.type));
  if (!/second line/.test(d.script[0].text)) fail("a continuation line is lost");
  const q = d.script[1];
  if (q.choices.length !== 3 || q.choices.filter((c) => c.correct).length !== 1 || !q.choices[1].correct) fail("choices are read wrongly");
  if (q.choices[1].text !== "23" || q.choices[1].reply !== "Yes: text glues together.") fail("a choice and its reply are not split at ' | '");
}
// a talk is one step of its own, like a drill
const steps = LessonSteps.split("Some text first.\n\n" + sample + "\n\nSome text after.");
if (steps.filter((s) => s.kind === "drill").length !== 1 || steps.some((s) => s.kind === "drill" && !/^:::talk/m.test(s.text))) fail("a talk is not a step of its own");

// 2. every talk in the course
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/js/curriculum-data.js"), "utf8"), ctx);
let n = 0;
const sig = (t) => t.script.map((x) => x.type + (x.choices ? ":" + x.choices.map((c) => (c.correct ? 1 : 0)).join("") : "")).join("|");
for (const level of ctx.window.CURRICULUM_DATA) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
  const found = {};
  for (const lang of ["en", "id"]) {
    const text = (ls.body && ls.body[lang]) || "";
    found[lang] = (text.match(/^:::talk\b[\s\S]*?^:::\s*$/gm) || []).map((b) => DrillParse.parse(b));
  }
  if (found.en.length !== found.id.length) fail(`${mod.id} lesson ${li + 1}: ${found.en.length} talks in en, ${found.id.length} in id`);
  found.en.forEach((t, k) => {
    n++;
    const w = `${mod.id} lesson ${li + 1} talk ${k + 1} "${t.title}"`;
    const asks = t.script.filter((x) => x.type === "ask");
    if (!asks.length) fail(w + ": no question");
    for (const a of asks) if (a.choices.length < 2 || a.choices.filter((c) => c.correct).length !== 1 || a.choices.some((c) => !c.reply)) fail(w + ": a question needs 2+ answers, one right, each with a reply");
    if (t.script[0].type !== "say" || t.script[t.script.length - 1].type !== "say") fail(w + ": it must begin and end with the teacher speaking");
    if (found.id[k] && sig(t) !== sig(found.id[k])) fail(w + ": en and id differ in shape");
    for (const lang of ["en", "id"]) {
      const tt = found[lang][k];
      if (tt && /—/.test(JSON.stringify(tt.script))) fail(w + ` (${lang}): an em dash`);
    }
  });
});
bad.forEach((b) => console.log("FAIL", b));
if (!bad.length) console.log(`talks: the parser is right and ${n} teacher conversation(s) are well formed and the same in both languages`);
process.exit(bad.length ? 1 : 0);
