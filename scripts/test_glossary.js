// The glossary must point at real lessons that really use the term.
//   node scripts/test_glossary.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/js/curriculum-data.js"), "utf8"), sb);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/js/glossary-data.js"), "utf8"), sb);
const mods = {};
for (const lv of sb.window.CURRICULUM_DATA) for (const m of lv.modules) mods[m.id] = m;
let bad = 0;
const fail = (msg) => { bad++; console.log("FAIL " + msg); };
const seen = new Set();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const e of sb.window.GLOSSARY) {
  if (seen.has(e.id)) fail(`${e.id}: duplicate id`);
  seen.add(e.id);
  for (const lang of ["en", "id"]) {
    if (!e.term[lang] || !e.def[lang]) fail(`${e.id}: missing ${lang} text`);
    else if (e.def[lang].length > 260) fail(`${e.id}: ${lang} meaning is too long (${e.def[lang].length})`);
  }
  const m = mods[e.mod];
  const lesson = m && m.lessons[e.lesson - 1];
  if (!lesson) { fail(`${e.id}: no lesson ${e.mod} L${e.lesson}`); continue; }
  for (const lang of ["en", "id"]) {
    const text = String(lesson.body[lang] || "").toLowerCase();
    const ok = e.alias.some((a) => new RegExp("(^|[^a-z0-9])" + escRe(a) + "s?([^a-z0-9]|$)").test(text) || (lang === "id" && text.includes(a)) );
    if (!ok) fail(`${e.id} (${lang}): "${e.term.en}" not found in ${e.mod} L${e.lesson} "${lesson.title.en}"`);
  }
}
console.log(`${sb.window.GLOSSARY.length} terms checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
