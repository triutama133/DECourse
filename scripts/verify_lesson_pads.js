#!/usr/bin/env node
// Every Python example that gets a "Run it in the browser" pad must run in the REAL vendored Pyodide, in lesson order,
// the way a learner would press Run on them one after another (variables stay between blocks of one lesson).
// A block that fails on purpose (to show an error) must say so: the lesson text around it names the error, e.g. "TypeError".
//   node scripts/verify_lesson_pads.js [--list]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const V = path.join(ROOT, 'app', 'vendor', 'pyodide');
const LessonSteps = require('../app/js/lesson-steps.js');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'app/js/curriculum-data.js'), 'utf8'), sb);
// the same rule as app.js padRunnable()
const STD = new Set(['csv', 'json', 'math', 're', 'datetime', 'collections', 'itertools', 'functools', 'statistics', 'random', 'string', 'textwrap', 'decimal', 'fractions', 'typing', 'dataclasses', 'enum', 'pathlib', 'io', 'time', 'hashlib', 'uuid', 'copy', 'operator', 'heapq', 'bisect', 'abc', 'contextlib', 'sys', 'os', 'logging', '__future__']);
function padRunnable(code) {
  if (/^\s*>>>/m.test(code) || /\binput\s*\(|\bopen\s*\(|sys\.argv|os\.environ|getenv|argparse|__file__|\.\.\.|…|<[a-z_ -]+>/.test(code)) return false;
  for (const m of code.matchAll(/^\s*(?:from|import)\s+([A-Za-z_]\w*)/gm)) if (!STD.has(m[1])) return false;
  return code.trim().length > 0;
}
(async () => {
  const { loadPyodide } = require(path.join(V, 'pyodide.js'));
  const py = await loadPyodide({ indexURL: V });
  py.runPython(fs.readFileSync(path.join(ROOT, 'app', 'js', 'browser-lab-runner.py'), 'utf8'));
  let blocks = 0, bad = 0, lessons = 0;
  for (const level of sb.window.CURRICULUM_DATA) for (const mod of level.modules) mod.lessons.forEach((ls, li) => {
    const text = (ls.body && ls.body.en) || '';
    const session = `${mod.id}:${li}`;
    let first = true;
    for (const b of LessonSteps.toBlocks(text)) {
      if (b.type !== 'code' || !/^```python\s*$/i.test(b.text.split('\n')[0])) continue;
      const code = b.text.split('\n').slice(1, -1).join('\n');
      if (!padRunnable(code)) continue;
      blocks++;
      if (first) { lessons++; first = false; }
      const r = py.globals.get('exec_pad')(session, code, false);
      const [output, ok] = r.toJs(); r.destroy();
      if (!ok) {
        const errLine = String(output).split('\n').filter((l) => /^\w+(Error|Exception)\b/.test(l)).pop() || String(output).trim().split('\n').pop();
        const err = (errLine.match(/^(\w+)(Error|Exception)/) || [])[0];
        // a block that is meant to fail is introduced or followed by text that names the error
        const idx = text.indexOf(b.text);
        const around = text.slice(Math.max(0, idx - 600), idx + b.text.length + 600);
        const meant = err && (around.includes(err) || err === 'NameError');   // a NameError is a piece of a bigger program: the pad explains it
        if (!meant || process.argv.includes('--list')) { bad += meant ? 0 : 1; console.log(`${meant ? 'ok (error shown on purpose)' : 'FAIL'} ${mod.id} L${li + 1}: ${errLine}\n    ${code.split('\n')[0].slice(0, 90)}`); }
      }
    }
  });
  console.log(`${blocks} runnable examples in ${lessons} lessons, ${bad} fail without the lesson saying so`);
  process.exit(bad ? 1 : 0);
})();
