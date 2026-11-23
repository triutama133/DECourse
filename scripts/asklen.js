// How balanced are the predict questions (:::ask blocks)? Like quizlen.py, for the in-lesson questions.
//   node scripts/asklen.js            prints the position of the right answer and how often it is the unique longest / shortest
//   node scripts/asklen.js --list     also lists the questions whose right answer is the unique longest (to fix by hand)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const DrillParse = require("../app/js/drill-parse.js");
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/js/curriculum-data.js"), "utf8"), sb);
for (const lang of ["en", "id"]) {
  let n = 0, longest = 0, shortest = 0;
  const pos = {}, worst = [];
  for (const level of sb.window.CURRICULUM_DATA) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
    for (const block of ((ls.body && ls.body[lang]) || "").match(/^:::ask\b[\s\S]*?^:::\s*$/gm) || []) {
      const d = DrillParse.parse(block);
      const i = d.options.findIndex((o) => o.correct);
      const len = d.options.map((o) => o.text.length);
      n++; pos[i] = (pos[i] || 0) + 1;
      if (len[i] === Math.max(...len) && len.filter((x) => x === len[i]).length === 1) { longest++; worst.push(`${mod.id} L${li + 1}: ${d.title.slice(0, 70)}`); }
      if (len[i] === Math.min(...len) && len.filter((x) => x === len[i]).length === 1) shortest++;
    }
  });
  console.log(`${lang}: ${n} questions, right answer at position ${JSON.stringify(pos)}, unique longest ${longest} (${Math.round((100 * longest) / n)}%), unique shortest ${shortest}`);
  if (process.argv.includes("--list") && lang === "en") worst.forEach((w) => console.log("   longest:", w));
}
