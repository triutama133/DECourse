#!/usr/bin/env node
// Every Python drill in the lessons, in both languages, runs in the REAL vendored Pyodide, through the same check_drill the app uses:
//   the @solution must pass every check, and the @starter must NOT pass (a learner cannot pass by doing nothing).
//   node scripts/verify_drills.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const V = path.join(ROOT, 'app', 'vendor', 'pyodide');
const DrillParse = require('../app/js/drill-parse.js');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'app/js/curriculum-data.js'), 'utf8'), sb);

(async () => {
  const { loadPyodide } = require(path.join(V, 'pyodide.js'));
  const py = await loadPyodide({ indexURL: V });
  py.runPython(fs.readFileSync(path.join(ROOT, 'app', 'js', 'browser-lab-runner.py'), 'utf8'));
  const run = (code, checks, files) => {
    const r = py.globals.get('check_drill')(code, py.toPy(checks.map((c) => [c.expr, c.msg])), py.toPy(files || {}));
    const out = JSON.parse(String(r));
    return out;
  };
  let n = 0, bad = 0, traces = 0;
  const fail = (w, msg) => { bad++; console.log('FAIL', w, msg); };
  for (const level of sb.window.CURRICULUM_DATA) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
    for (const lang of ['en', 'id']) {
      const text = (ls.body && ls.body[lang]) || '';
      (text.match(/^:::drill\b[\s\S]*?^:::\s*$/gm) || []).forEach((block, k) => {
        const d = DrillParse.parse(block);
        const w = `${mod.id} L${li + 1} drill ${k + 1} (${lang}) "${d && d.title}"`;
        if (!d || d.lang !== 'python') return;
        n++;
        const sol = run(d.solution, d.checks, d.files);
        if (sol.error) fail(w, 'the solution stops with an error: ' + sol.error.split('\n').pop());
        else sol.results.forEach((r, i) => { if (!r.ok) fail(w, `the solution fails check ${i + 1}: ${d.checks[i].expr}`); });
        const st = run(d.starter, d.checks, d.files);
        if (!st.error && st.results.every((r) => r.ok)) fail(w, 'the starter already passes every check');
        if (/^\s*[^#\s].*\bNone\b/m.test(d.starter) === false && false) fail(w, '');
      });
    }
  });
  // "watch it run" animations: the code must run, and must not stop with an error unless the title says it should
  for (const level of sb.window.CURRICULUM_DATA) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
    for (const lang of ['en', 'id']) {
      ((ls.body && ls.body[lang]) || '').match(/^:::trace\b[\s\S]*?^:::\s*$/gm)?.forEach((block, k) => {
        const d = DrillParse.parse(block);
        const w = `${mod.id} L${li + 1} trace ${k + 1} (${lang}) "${d && d.title}"`;
        traces++;
        const r = JSON.parse(String(py.globals.get('trace_code')(d.code, py.toPy(d.files || {}))));
        if (r.error && !/error/i.test(d.title)) fail(w, 'the program stops with an error: ' + r.error);
        if (r.steps.length < 3) fail(w, 'fewer than 3 steps');
        Object.keys(d.notes).forEach((line) => { if (!r.steps.some((s) => String(s.line) === line)) fail(w, `a note is written for line ${line}, which never runs`); });
      });
    }
  });
  console.log(`${n} drills and ${traces} animations checked, ${bad} problems`);
  process.exit(bad ? 1 : 0);
})();
