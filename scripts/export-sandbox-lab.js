#!/usr/bin/env node
// Exports the SQL Sandbox challenges of one module into an offline lab folder, so the same exercises
// can be done with Python's built-in SQLite and checked by labs/shared/sqlcheck.py.
//
//   node scripts/export-sandbox-lab.js mod-1-3
//
// Writes labs/<module>/answers.sql (starter), reference/answers.sql, datasets/<name>.sql and check.py.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mod = process.argv[2];
if (!mod) { console.error('usage: export-sandbox-lab.js <module-id>'); process.exit(1); }
global.window = {}; global.performance = performance; global.initSqlJs = () => {};
eval(fs.readFileSync(path.join(root, 'app/js/playground.js'), 'utf8'));
const P = window.SQL_PLAYGROUND;
const chs = P.challenges.filter((c) => c.module === mod);
if (!chs.length) { console.error('no challenges for ' + mod); process.exit(1); }
const dir = path.join(root, 'labs', mod);
fs.mkdirSync(path.join(dir, 'reference'), { recursive: true });
fs.mkdirSync(path.join(dir, 'datasets'), { recursive: true });
const used = [...new Set(chs.map((c) => c.dataset))];
for (const ds of used) {
  const sql = P.datasets[ds].setup.split('\n').map((l) => l.replace(/^ {8}/, '')).join('\n').trim();
  fs.writeFileSync(path.join(dir, 'datasets', ds + '.sql'), `-- Dataset "${ds}" for the SQL labs and the in-app SQL Sandbox.\n${sql}\n`);
}
const marker = (c) => `-- ${c.id} [${c.dataset}] ${c.title.en}`;
fs.writeFileSync(path.join(dir, 'reference', 'answers.sql'), '-- Reference answers. Try the questions yourself first.\n\n' + chs.map((c) => `${marker(c)}\n${c.solution}\n`).join('\n'));
fs.writeFileSync(path.join(dir, 'answers.sql'),
  `-- Write one query under each marker. Keep the marker lines: the checker finds your answers by them.\n-- Check your work:  python3 labs/${mod}/check.py\n\n` +
  chs.map((c) => `${marker(c)}\n-- ${c.task.en}\n-- Hint: ${c.hint.en}\n\n`).join(''));
fs.writeFileSync(path.join(dir, 'check.py'), `#!/usr/bin/env python3
"""Checks answers.sql against the reference results.   python3 labs/${mod}/check.py   (or: ... reference)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import sqlcheck  # noqa: E402

if __name__ == "__main__":
    sys.exit(0 if sqlcheck.main(Path(__file__).resolve().parent, sys.argv[1] if len(sys.argv) > 1 else "") else 1)
`);
fs.writeFileSync(path.join(dir, 'verify.sh'), `#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
python3 "$HERE/check.py" reference >/dev/null || { python3 "$HERE/check.py" reference; exit 1; }
if python3 "$HERE/check.py" >/dev/null 2>&1; then echo "starter answers.sql unexpectedly passed"; exit 1; fi
echo "${mod} verified: reference passes all answers; the empty starter fails"
`, { mode: 0o755 });
console.log(`${mod}: exported ${chs.length} challenges, datasets: ${used.join(', ')}`);
