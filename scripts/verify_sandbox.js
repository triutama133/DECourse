#!/usr/bin/env node
/* Runs EVERY SQL Sandbox challenge solution on the same SQLite engine the browser uses (sql.js) and checks that
 *   - the dataset loads, the solution runs without error and returns at least one row,
 *   - ids are unique and every challenge has a module, bilingual title/task/hint, and a solution,
 *   - a deliberately wrong query is NOT accepted (the checker compares real results).
 * Usage: node scripts/verify_sandbox.js [--show id1,id2]     (--show prints the result rows of those challenges)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const initSqlJs = require(path.join(root, "app/vendor/sqljs/sql-wasm.js"));
const sandbox = { window: {}, performance, initSqlJs: () => initSqlJs({ locateFile: (f) => path.join(root, "app/vendor/sqljs", f) }) };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "app/js/playground.js"), "utf8"), sandbox);
const P = sandbox.window.SQL_PLAYGROUND;
const show = (process.argv.includes("--show") ? process.argv[process.argv.indexOf("--show") + 1] : "").split(",").filter(Boolean);
const modules = new Set(fs.readdirSync(path.join(root, "curriculum")).filter((d) => d.startsWith("mod-")).concat(["extra"]));

(async () => {
  let failed = 0;
  const fail = (m) => { failed++; console.log("FAIL " + m); };
  const seen = new Set();
  for (const ch of P.challenges) {
    if (seen.has(ch.id)) fail(`${ch.id}: duplicate id`);
    seen.add(ch.id);
    if (!modules.has(ch.module)) fail(`${ch.id}: unknown module ${ch.module}`);
    if (!P.datasets[ch.dataset]) { fail(`${ch.id}: unknown dataset ${ch.dataset}`); continue; }
    for (const f of ["title", "task", "hint"]) if (!ch[f] || !ch[f].en || !ch[f].id) fail(`${ch.id}: ${f} needs en and id`);
    await P.loadDataset(ch.dataset);
    const r = P.run(ch.solution);
    if (!r.ok) { fail(`${ch.id}: solution error: ${r.error}`); continue; }
    if (r.empty || !r.rows.length) { fail(`${ch.id}: solution returns no rows`); continue; }
    await P.loadDataset(ch.dataset);
    if (!P.check(ch, ch.solution).ok) fail(`${ch.id}: the solution does not pass its own check`);
    await P.loadDataset(ch.dataset);
    const wrong = P.check(ch, "SELECT 1 AS a, 2 AS b, 3 AS c, 4 AS d, 5 AS e, 6 AS f, 7 AS g");
    if (wrong.ok) fail(`${ch.id}: a wrong query was accepted`);
    if (show.includes(ch.id)) console.log(ch.id, JSON.stringify(r.columns), JSON.stringify(r.rows.slice(0, 12)));
  }
  console.log(`${P.challenges.length} challenges checked, ${failed} problem(s)`);
  process.exit(failed ? 1 : 0);
})();
