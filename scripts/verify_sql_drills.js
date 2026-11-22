#!/usr/bin/env node
// Every SQL drill in the lessons, in both languages, on the SAME SQLite engine the browser uses (sql.js), through the same grader:
//   the @solution must pass its own grade, the @starter must NOT pass, a deliberately wrong query must NOT pass,
//   and every ":::sqlsteps" stage must run. Usage: node scripts/verify_sql_drills.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const initSqlJs = require(path.join(root, "app/vendor/sqljs/sql-wasm.js"));
const DrillParse = require("../app/js/drill-parse.js");
const SqlDrill = require("../app/js/sql-drill.js");
const sandbox = { window: {}, performance, initSqlJs: () => initSqlJs({ locateFile: (f) => path.join(root, "app/vendor/sqljs", f) }) };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "app/js/playground.js"), "utf8"), sandbox);
const P = sandbox.window.SQL_PLAYGROUND;
const cur = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "app/js/curriculum-data.js"), "utf8"), cur);

(async () => {
  const SQL = await P.init();
  let n = 0, steps = 0, bad = 0;
  const fail = (w, msg) => { bad++; console.log("FAIL", w, msg); };
  for (const level of cur.window.CURRICULUM_DATA) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
    for (const lang of ["en", "id"]) {
      const text = (ls.body && ls.body[lang]) || "";
      (text.match(/^:::drill\s+sql\b[\s\S]*?^:::\s*$/gm) || []).forEach((block, k) => {
        const d = DrillParse.parse(block);
        const w = `${mod.id} L${li + 1} sql drill ${k + 1} (${lang}) "${d && d.title}"`;
        const ds = P.datasets[d.data];
        if (!ds) return fail(w, "unknown dataset " + d.data);
        const ctx = { setup: ds.setup, mutation: P.adversarialMutations[d.data] || "" };
        n++;
        const own = SqlDrill.grade(SQL, ctx, d, d.solution);
        if (!own.ok) fail(w, `the solution fails its own grade: ${own.kind} ${own.error || ""}`);
        const st = SqlDrill.grade(SQL, ctx, d, d.starter);
        if (st.ok) fail(w, "the starter already passes");
        const wrong = SqlDrill.grade(SQL, ctx, d, "SELECT 1 AS a, 2 AS b, 3 AS c, 4 AS d, 5 AS e, 6 AS f, 7 AS g");
        if (wrong.ok) fail(w, "a wrong query was accepted");
      });
      (text.match(/^:::sqlsteps\b[\s\S]*?^:::\s*$/gm) || []).forEach((block, k) => {
        const d = DrillParse.parse(block);
        const w = `${mod.id} L${li + 1} sqlsteps ${k + 1} (${lang}) "${d && d.title}"`;
        const ds = P.datasets[d.data];
        if (!ds) return fail(w, "unknown dataset " + d.data);
        steps++;
        SqlDrill.stages(SQL, ds.setup, d.stages).forEach((s, i) => { if (s.error) fail(w, `stage ${i + 1} fails: ${s.error}`); else if (!s.has) fail(w, `stage ${i + 1} makes no table`); });
      });
    }
  });
  console.log(`${n} SQL drills and ${steps} SQL animations checked, ${bad} problems`);
  process.exit(bad ? 1 : 0);
})();
