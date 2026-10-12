#!/usr/bin/env node
// Builds app/js/curriculum-data.js from curriculum/<module>/{en,id}.md and the lab files they reference.
//
//   node scripts/build-curriculum.js          validate and write app/js/curriculum-data.js
//   node scripts/build-curriculum.js --check  validate only
//
// Authoring format: see curriculum/README.md. Errors fail the build; warnings are advice.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CUR = path.join(ROOT, 'curriculum');
const OUT = path.join(ROOT, 'app', 'js', 'curriculum-data.js');
const OUT_LABS = path.join(ROOT, 'app', 'js', 'browser-labs-data.js');
const OUT_PROOF = path.join(ROOT, 'app', 'js', 'proof-data.js');
const crypto = require('crypto');
const LANGS = ['id', 'en'];
const FILE_KINDS = ['starter', 'reference', 'test', 'data', 'config'];

const errors = [];
const warnings = [];
const err = (m, msg) => errors.push(`${m}: ${msg}`);
const warn = (m, msg) => warnings.push(`${m}: ${msg}`);

// ---------- markdown-ish section parsing ----------
function splitSections(lines, level) {
  // Split on headings "## @name rest" (level 2) or "### @name rest" (level 3), ignoring code fences.
  const marker = '#'.repeat(level) + ' @';
  const re = new RegExp('^' + '#'.repeat(level) + ' @(\\w+)\\s*(.*)$');
  const sections = [];
  let cur = { name: '_head', arg: '', lines: [] };
  let fence = false;
  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence && line.startsWith(marker) ? line.match(re) : null;
    if (m) { sections.push(cur); cur = { name: m[1], arg: m[2].trim(), lines: [] }; }
    else cur.lines.push(line);
  }
  sections.push(cur);
  return sections;
}
const trimBlank = (lines) => {
  let a = 0, b = lines.length;
  while (a < b && lines[a].trim() === '') a++;
  while (b > a && lines[b - 1].trim() === '') b--;
  return lines.slice(a, b);
};
const text = (lines) => trimBlank(lines).join('\n');
const bullets = (lines) => trimBlank(lines).filter((l) => /^- /.test(l)).map((l) => l.replace(/^- /, '').trim());

function parseFrontMatter(lines, m, lang) {
  if (lines[0] !== '---') { err(m, `${lang}.md must start with --- front matter`); return { fm: {}, rest: lines }; }
  const end = lines.indexOf('---', 1);
  const fm = {};
  for (const l of lines.slice(1, end)) {
    const i = l.indexOf(':');
    if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return { fm, rest: lines.slice(end + 1) };
}

function parseQuiz(lines, m, lang) {
  const items = [];
  let q = null;
  let fence = false;
  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence;
    let mm;
    if (!fence && (mm = line.match(/^### (.+)$/))) { q = { question: mm[1].trim(), options: [], correct: -1, expl: [] }; items.push(q); }
    else if (q && (mm = line.match(/^- \[( |x)\] (.+)$/))) {
      q.options.push(mm[2].trim());
      if (mm[1] === 'x') { if (q.correct !== -1) err(m, `${lang} quiz "${q.question.slice(0, 40)}": more than one [x]`); q.correct = q.options.length - 1; }
    } else if (q && /^> ?/.test(line)) q.expl.push(line.replace(/^> ?/, ''));
  }
  for (const it of items) {
    if (it.options.length !== 4) err(m, `${lang} quiz "${it.question.slice(0, 40)}": needs exactly 4 options (has ${it.options.length})`);
    if (it.correct === -1) err(m, `${lang} quiz "${it.question.slice(0, 40)}": no [x] option`);
    if (!it.expl.length) err(m, `${lang} quiz "${it.question.slice(0, 40)}": missing > explanation`);
  }
  return items;
}

function parseFiles(lines, m, lang) {
  return trimBlank(lines).filter((l) => /^- /.test(l)).map((l) => {
    const [p, label, kind] = l.replace(/^- /, '').split('::').map((s) => s.trim());
    if (!FILE_KINDS.includes(kind)) err(m, `${lang} @files: kind "${kind}" must be one of ${FILE_KINDS.join(', ')}`);
    return { path: p, label, kind };
  });
}

function parseModule(dir, lang) {
  const m = dir;
  const file = path.join(CUR, dir, `${lang}.md`);
  if (!fs.existsSync(file)) { err(m, `missing ${lang}.md`); return null; }
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const { fm, rest } = parseFrontMatter(lines, m, lang);
  for (const k of ['title', 'duration', 'summary', 'why']) if (!fm[k]) err(m, `${lang}.md front matter missing "${k}"`);
  const secs = splitSections(rest, 2);
  const out = { fm, lessons: [], outcomes: [], prereq: '', lab: null, chaos: null, quiz: [], resources: [] };
  for (const s of secs) {
    if (s.name === '_head') continue;
    if (s.name === 'outcomes') out.outcomes = bullets(s.lines);
    else if (s.name === 'prereq') out.prereq = text(s.lines);
    else if (s.name === 'lesson') out.lessons.push({ title: s.arg, body: text(s.lines) });
    else if (s.name === 'lab') {
      const subs = splitSections(s.lines, 3);
      const lab = { title: s.arg, description: '', steps: '', files: [], deliverables: [], verify: '' };
      for (const sub of subs) {
        if (sub.name === '_head') lab.description = text(sub.lines);
        else if (sub.name === 'steps') lab.steps = text(sub.lines);
        else if (sub.name === 'files') lab.files = parseFiles(sub.lines, m, lang);
        else if (sub.name === 'deliverables') lab.deliverables = bullets(sub.lines);
        else if (sub.name === 'verify') lab.verify = text(sub.lines);
        else err(m, `${lang} unknown lab subsection @${sub.name}`);
      }
      out.lab = lab;
    } else if (s.name === 'chaos') {
      const subs = splitSections(s.lines, 3);
      const c = { title: s.arg };
      const map = { scenario: 'scenario', cause: 'breakageReason', fix: 'fixGuide', pattern: 'defensivePattern' };
      for (const sub of subs) {
        if (sub.name === '_head') continue;
        if (!map[sub.name]) { err(m, `${lang} unknown chaos subsection @${sub.name}`); continue; }
        c[map[sub.name]] = text(sub.lines);
      }
      out.chaos = c;
    } else if (s.name === 'quiz') out.quiz = parseQuiz(s.lines, m, lang);
    else if (s.name === 'resources') {
      out.resources = trimBlank(s.lines).filter((l) => /^- /.test(l)).map((l) => {
        const mm = l.match(/^- \[(.+?)\]\((https?:\/\/[^)\s]+)\)/);
        if (!mm) { err(m, `${lang} bad resource line: ${l}`); return { label: l, url: '' }; }
        return { label: mm[1], url: mm[2] };
      });
    } else err(m, `${lang}.md unknown section @${s.name}`);
  }
  for (const [k, v] of [['@lab', out.lab], ['@chaos', out.chaos]]) if (!v) err(m, `${lang}.md missing ${k}`);
  if (!out.lessons.length) err(m, `${lang}.md has no @lesson sections`);
  return out;
}

const words = (s) => (String(s).match(/[\p{L}\p{N}_']+/gu) || []).length;
const fences = (s) => (String(s).match(/^```/gm) || []).length;

function pair(m, label, a, b, same) {
  if (a.length !== b.length) { err(m, `${label}: ${a.length} in id vs ${b.length} in en`); return false; }
  if (same) a.forEach((x, i) => { if (!same(x, b[i])) err(m, `${label}[${i}] differs between languages`); });
  return true;
}

function buildModule(dir) {
  const m = dir;
  const num = dir.replace('mod-', '').replace('-', '.');
  const P = {};
  P.en = parseModule(dir, 'en');
  if (!P.en) return null;
  // Indonesian is written after English is stable: until id.md exists the module falls back to English text.
  const idPending = !fs.existsSync(path.join(CUR, dir, 'id.md'));
  if (idPending) P.id = P.en;
  else { P.id = parseModule(dir, 'id'); if (!P.id) return null; }
  const bi = (get) => ({ id: get(P.id), en: get(P.en) });

  // ---- parity checks ----
  pair(m, 'outcomes', P.id.outcomes, P.en.outcomes);
  pair(m, 'lessons', P.id.lessons, P.en.lessons);
  P.en.lessons.forEach((l, i) => { const o = P.id.lessons[i]; if (o && fences(l.body) !== fences(o.body)) err(m, `lesson ${i + 1} "${l.title}": code fence count differs between languages`); });
  pair(m, 'lab files', P.id.lab.files, P.en.lab.files, (a, b) => a.path === b.path && a.kind === b.kind);
  pair(m, 'lab deliverables', P.id.lab.deliverables, P.en.lab.deliverables);
  pair(m, 'quiz', P.id.quiz, P.en.quiz, (a, b) => a.correct === b.correct);
  pair(m, 'resources', P.id.resources, P.en.resources, (a, b) => a.url === b.url);
  if (fences(P.id.lab.steps) !== fences(P.en.lab.steps)) err(m, 'lab steps: code fence count differs between languages');
  if (fences(P.id.lab.verify) !== fences(P.en.lab.verify)) err(m, 'lab verify: code fence count differs between languages');
  for (const l of LANGS) for (const [i, ls] of P[l].lessons.entries()) if (fences(ls.body) % 2) err(m, `${l} lesson ${i + 1}: unbalanced code fence`);

  // ---- quality checks (warnings) ----
  const wEn = P.en.lessons.reduce((n, l) => n + words(l.body), 0);
  const wId = P.id.lessons.reduce((n, l) => n + words(l.body), 0);
  if (wEn < 1500) warn(m, `only ${wEn} words of lesson text (target 1500+)`);
  if (!idPending && (wId < wEn * 0.75 || wId > wEn * 1.6)) warn(m, `id/en lesson length mismatch (${wId} vs ${wEn} words)`);
  if (P.en.lessons.length < 5) warn(m, `only ${P.en.lessons.length} lessons (target 5+)`);
  if (P.en.quiz.length < 8) warn(m, `only ${P.en.quiz.length} quiz questions (target 8+)`);
  const longest = P.en.quiz.filter((q) => q.options[q.correct].length === Math.max(...q.options.map((o) => o.length))).length;
  if (P.en.quiz.length && longest / P.en.quiz.length > 0.5) warn(m, `correct answer is the longest option in ${longest}/${P.en.quiz.length} questions`);
  const shortest = P.en.quiz.filter((q) => q.options[q.correct].length === Math.min(...q.options.map((o) => o.length))).length;
  if (P.en.quiz.length && shortest / P.en.quiz.length > 0.5) warn(m, `correct answer is the shortest option in ${shortest}/${P.en.quiz.length} questions`);
  if (!P.en.lab.deliverables.length) warn(m, 'lab has no deliverables');
  if (!idPending) for (const f of ['title', 'summary']) if (P.id.fm[f] === P.en.fm[f]) warn(m, `front matter "${f}" identical in id and en`);

  // ---- assemble ----
  const files = P.en.lab.files.map((f, i) => {
    const abs = path.join(ROOT, f.path);
    if (!fs.existsSync(abs)) { err(m, `lab file not found: ${f.path}`); return null; }
    return { path: f.path, name: path.basename(f.path), kind: f.kind, label: { id: P.id.lab.files[i].label, en: f.label }, code: fs.readFileSync(abs, 'utf8').replace(/\n+$/, '') };
  }).filter(Boolean);

  return {
    id: dir, number: num,
    title: bi((p) => p.fm.title), duration: bi((p) => p.fm.duration), summary: bi((p) => p.fm.summary), whyTutorialsLie: bi((p) => p.fm.why),
    outcomes: P.en.outcomes.map((_, i) => ({ id: P.id.outcomes[i], en: P.en.outcomes[i] })),
    prerequisites: P.en.prereq || P.id.prereq ? { id: P.id.prereq, en: P.en.prereq } : null,
    lessons: P.en.lessons.map((l, i) => ({ title: { id: P.id.lessons[i].title, en: l.title }, body: { id: P.id.lessons[i].body, en: l.body } })),
    lab: {
      title: bi((p) => p.lab.title), description: bi((p) => p.lab.description), steps: bi((p) => p.lab.steps), verify: bi((p) => p.lab.verify),
      files, deliverables: P.en.lab.deliverables.map((_, i) => ({ id: P.id.lab.deliverables[i], en: P.en.lab.deliverables[i] }))
    },
    chaosLab: {
      title: bi((p) => p.chaos.title), scenario: bi((p) => p.chaos.scenario), breakageReason: bi((p) => p.chaos.breakageReason),
      fixGuide: bi((p) => p.chaos.fixGuide), defensivePattern: bi((p) => p.chaos.defensivePattern)
    },
    quiz: P.en.quiz.map((q, i) => ({
      question: { id: P.id.quiz[i].question, en: q.question },
      options: q.options.map((o, j) => ({ id: P.id.quiz[i].options[j], en: o })),
      correct: q.correct,
      explanation: { id: P.id.quiz[i].expl.join(' '), en: q.expl.join(' ') }
    })),
    resources: P.en.resources.map((r, i) => ({ label: { id: P.id.resources[i].label, en: r.label }, url: r.url })),
    idPending,
    _stats: { wordsEn: wEn, wordsId: idPending ? 'pending' : wId, quiz: P.en.quiz.length }
  };
}

// ---------- main ----------
const levels = JSON.parse(fs.readFileSync(path.join(CUR, 'levels.json'), 'utf8'));
const dirs = new Set(fs.readdirSync(CUR).filter((d) => /^mod-\d-\d$/.test(d)));
const built = {};
for (const d of [...dirs].sort()) { const mod = buildModule(d); if (mod) built[d] = mod; }

const missing = [];
const data = levels.map((L) => ({
  levelId: L.levelId, levelTitle: L.levelTitle, levelSubtitle: L.levelSubtitle, badge: L.badge, badgeColor: L.badgeColor,
  modules: L.modules.map((id) => { if (!built[id]) { missing.push(id); return null; } const { _stats, ...mod } = built[id]; return mod; }).filter(Boolean)
}));

console.log('module     words(en)  words(id)  quiz');
for (const id of Object.keys(built)) { const s = built[id]._stats; console.log(`${id}  ${String(s.wordsEn).padStart(9)}  ${String(s.wordsId).padStart(9)}  ${String(s.quiz).padStart(4)}`); }
// ---------- labs that run in the browser (Pyodide); see curriculum/browser-labs.json ----------
const browserLabs = {};
const blCfg = JSON.parse(fs.readFileSync(path.join(CUR, 'browser-labs.json'), 'utf8'));
const readLab = (rel, where) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { errors.push(`browser-labs.json ${where}: file not found: ${rel}`); return ''; }
  return fs.readFileSync(abs, 'utf8');
};
for (const [id, c] of Object.entries(blCfg)) {
  if (!built[id]) { errors.push(`browser-labs.json: unknown module ${id}`); continue; }
  for (const k of ['note', 'editable', 'reference', 'tests', 'extra']) if (!c[k]) errors.push(`browser-labs.json ${id}: missing "${k}"`);
  if (!c.note || !c.note.id || !c.note.en) errors.push(`browser-labs.json ${id}: note needs id and en`);
  const files = {};
  for (const f of [...(c.tests || []), ...(c.extra || [])]) files[f] = readLab(f, id);
  browserLabs[id] = { note: c.note, editable: c.editable, starter: readLab(c.editable, id), reference: readLab(c.reference, id), tests: c.tests, files };
}
// ---------- lab proof codes (scripts/prove.py); labs/proof.json ----------
// Same hashing rules as scripts/prove.py: normalise (LF, no trailing spaces, trim), join with "\n--FILE--\n", sha256, first 8 hex.
const normText = (t) => t.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
const hashTexts = (a) => crypto.createHash('sha256').update(a.map(normText).join('\n--FILE--\n'), 'utf8').digest('hex').slice(0, 8);
const proof = {};
const proofCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'labs', 'proof.json'), 'utf8'));
const readProof = (rel, id) => { const abs = path.join(ROOT, rel); if (!fs.existsSync(abs)) { errors.push(`labs/proof.json ${id}: file not found: ${rel}`); return ''; } return fs.readFileSync(abs, 'utf8'); };
const sharedDir = path.join(ROOT, 'labs', 'shared');
const sharedTexts = fs.readdirSync(sharedDir).filter((f) => f.endsWith('.py')).sort().map((f) => fs.readFileSync(path.join(sharedDir, f), 'utf8'));
for (const [id, c] of Object.entries(proofCfg)) {
  if (!built[id]) { errors.push(`labs/proof.json: unknown module ${id}`); continue; }
  const starterPaths = c.starter || c.work;
  const starterKind = (data.flatMap((l) => l.modules).find((m) => m.id === id).lab.files || []).filter((f) => f.kind === 'starter').map((f) => f.path);
  if (!c.starter) { const a = [...c.work].sort().join(), b = [...starterKind].sort().join(); if (a !== b) errors.push(`labs/proof.json ${id}: "work" files differ from the lab's starter files\n    proof: ${a}\n    lab:   ${b}`); }
  if (c.reference.length !== starterPaths.length) errors.push(`labs/proof.json ${id}: "reference" must have one entry per work/starter file (null if none)`);
  const tests = hashTexts([...c.tests.map((t) => readProof(t, id)), ...sharedTexts]);
  const starter = hashTexts(starterPaths.map((p) => readProof(p, id)));
  const reference = hashTexts(c.reference.map((r, i) => readProof(r || starterPaths[i], id)));
  const needsEnv = c.run.map((s) => s.needs_env).filter(Boolean);
  proof[id] = { arg: c.arg || null, requireVenv: Boolean(c.require_venv), needsEnv, command: `python3 scripts/prove.py ${id}` + (c.arg ? ' ' + (c.arg_example || '~/kopiku') : ''), argExample: c.arg ? (c.arg_example || '~/kopiku') : null, tests, starter, reference };
}
for (const id of Object.keys(built)) if (!proof[id]) errors.push(`labs/proof.json: module ${id} has no proof entry`);
if (missing.length) console.log(`\nnot written yet: ${missing.join(', ')}`);
if (warnings.length) console.log('\nWARNINGS\n  ' + warnings.join('\n  '));
if (errors.length) { console.error('\nERRORS\n  ' + errors.join('\n  ')); process.exit(1); }

if (!process.argv.includes('--check')) {
  const header = '// GENERATED by scripts/build-curriculum.js from curriculum/*. Do not edit by hand.\n\n';
  fs.writeFileSync(OUT, header + 'window.CURRICULUM_DATA = ' + JSON.stringify(data, null, 1) + ';\n');
  fs.writeFileSync(OUT_PROOF, '// GENERATED by scripts/build-curriculum.js from labs/proof.json and labs/*. Do not edit by hand.\n\nwindow.PROOF = ' + JSON.stringify(proof, null, 1) + ';\n');
  fs.writeFileSync(OUT_LABS, '// GENERATED by scripts/build-curriculum.js from curriculum/browser-labs.json and labs/*. Do not edit by hand.\n\nwindow.BROWSER_LABS = ' + JSON.stringify(browserLabs, null, 1) + ';\n');
  console.log(`\nwrote ${path.relative(ROOT, OUT_LABS)} (${(fs.statSync(OUT_LABS).size / 1024).toFixed(0)} KB, ${Object.keys(browserLabs).length} browser labs)`);
  console.log(`\nwrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${Object.keys(built).length} modules)`);
}
