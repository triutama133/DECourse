#!/usr/bin/env node
// Proves that every "Run in your browser" lab works in the REAL vendored Pyodide: the reference solution must pass and the
// starter must fail. Run:  node scripts/verify_browser_labs.js   (needs Node 18+, no npm install; takes about a minute)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const V = path.join(ROOT, 'app', 'vendor', 'pyodide');
global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'app', 'js', 'browser-labs-data.js'), 'utf8'));
const LABS = window.BROWSER_LABS;

(async () => {
  const { loadPyodide } = require(path.join(V, 'pyodide.js'));
  const py = await loadPyodide({ indexURL: V });
  const site = py.runPython("import sysconfig; sysconfig.get_paths()['purelib']");
  for (const w of fs.readdirSync(path.join(V, 'wheels'))) py.unpackArchive(new Uint8Array(fs.readFileSync(path.join(V, 'wheels', w))), 'zip', { extractDir: site });
  py.runPython(fs.readFileSync(path.join(ROOT, 'app', 'js', 'browser-lab-runner.py'), 'utf8'));
  const run = (files, args) => {
    py.runPython('reset()');
    for (const [p, t] of Object.entries(files)) { const full = '/lab/' + p; py.FS.mkdirTree(path.posix.dirname(full)); py.FS.writeFile(full, t); }
    const r = py.globals.get('run_lab')(py.toPy([...args, '-q', '--no-header', '-p', 'no:cacheprovider', '--color=no', '--tb=short']));
    const [output, code] = r.toJs(); r.destroy();
    return { output, code };
  };
  let failed = 0;
  for (const [id, lab] of Object.entries(LABS)) {
    const t0 = Date.now();
    const ref = run({ ...lab.files, [lab.editable]: lab.reference }, lab.tests);
    const st = run({ ...lab.files, [lab.editable]: lab.starter }, lab.tests);
    const last = (o) => o.trim().split('\n').filter(Boolean).pop();
    const okRef = ref.code === 0, okStarter = st.code !== 0;
    // a second run in the same interpreter must still see fresh code (module cache purge)
    const ref2 = run({ ...lab.files, [lab.editable]: lab.reference }, lab.tests);
    const okFresh = ref2.code === 0;
    if (!(okRef && okStarter && okFresh)) failed++;
    console.log(`${okRef && okStarter && okFresh ? 'ok  ' : 'FAIL'} ${id}  reference: ${last(ref.output)} | starter: ${last(st.output)} | rerun: ${last(ref2.output)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log(failed ? `\n${failed} browser lab(s) FAILED` : '\nall browser labs verified in Pyodide');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
