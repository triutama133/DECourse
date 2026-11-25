#!/usr/bin/env node
// Tests the in-app tutor without a real model:
//  1. the search (app/js/tutor.js) finds the right lessons in English and Indonesian, and keeps solutions out of the text;
//  2. the app server's start / stop / status endpoints, against a fake `ollama` program: they start it once, stop only the
//     process the app started, and refuse pages that are not on this computer.
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const bad = [];
const fail = (m) => bad.push(m);

// ---------------------------------------------------------------- 1. search
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["curriculum-data.js", "glossary-data.js", "tutor.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "app/js", f), "utf8"), ctx, { filename: f });
const core = ctx.window.TutorCore;
if (!core) fail("tutor.js did not expose TutorCore");

const idx = {};
for (const l of ["en", "id"]) idx[l] = core.buildIndex(core.buildChunks(ctx.window.CURRICULUM_DATA, ctx.window.GLOSSARY, l));
const nEn = idx.en.chunks.length, nId = idx.id.chunks.length;
if (nEn < 1000 || Math.abs(nEn - nId) > nEn * 0.15) fail(`chunk counts look wrong: en ${nEn}, id ${nId}`);
if (idx.en.chunks.some((c) => /@solution|@starter|@check/.test(c.text))) fail("solutions or starters leaked into the searchable text");

// the same questions as scripts/tutor.py --self-test
const cases = [
  ["en", "what is idempotent and why does a backfill need it", "mod-2-4"],
  ["en", "how do I use a window function like LAG", "mod-1-3"],
  ["en", "what is a primary key", "mod-0-3"],
  ["en", "what is a virtual environment in python", "mod-0-1"],
  ["en", "kafka partitions and consumer groups", "mod-3-2"],
  ["en", "how do I watch my pipeline with logs, metrics and alerts", "mod-2-4"],
  ["en", "star schema fact table and dimension table", "mod-1-4"],
  ["en", "what is a data contract", "mod-2-5"],
  ["id", "apa itu primary key", "mod-0-3"],
  ["id", "bagaimana cara kerja backfill dan idempotent", "mod-2-4"],
  ["id", "apa itu virtual environment", "mod-0-1"],
  ["id", "fungsi window LAG di SQL", "mod-1-3"],
];
for (const [l, q, want] of cases) {
  const got = idx[l].search(q, 3).map(([, c]) => c.mod);
  if (!got.includes(want)) fail(`search [${l}] "${q}": wanted ${want} in the top 3, got ${got}`);
}
// reading a lesson nudges the answer toward it
const near = idx.en.search("what does this term mean", 3, { mod: "mod-2-4", lesson: 3 });
if (near.length && near[0][1].mod !== "mod-2-4" && idx.en.search("idempotent", 1, { mod: "mod-2-4", lesson: 3 })[0][1].mod !== "mod-2-4") fail("lesson focus does not help");
if (core.relevant([]).length !== 0) fail("relevant([]) should be empty");
const weak = core.relevant([[10, { n: 1 }], [9, { n: 2 }], [3, { n: 3 }]]);
if (weak.length !== 2) fail("weak matches are not dropped");
const msgs = core.buildMessages("what is a primary key", idx.en.search("primary key", 3), "en", []);
if (!/ONLY from the COURSE EXCERPTS/.test(msgs[0].content) || !/primary key/i.test(msgs[msgs.length - 1].content)) fail("prompt is missing the rules or the excerpts");
if (!/Indonesian/.test(core.systemPrompt("id"))) fail("Indonesian reply instruction is missing");
// the page itself
const html = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
if (!html.includes('id="tutor-btn"') || !html.includes("js/tutor.js")) fail("index.html does not load the tutor button and script");

// ---------------------------------------------------------------- 2. server endpoints with a fake ollama
const freePort = () => new Promise((res) => { const s = http.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const call = (port, method, url, headers = {}) => new Promise((res, rej) => {
  const r = http.request({ host: "127.0.0.1", port, path: url, method, headers }, (x) => { let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => { try { res({ code: x.statusCode, body: JSON.parse(b) }); } catch { res({ code: x.statusCode, body: b }); } }); });
  r.on("error", rej); r.end();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serverTests() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "df-tutor-"));
  const fake = path.join(dir, "fake-ollama");
  fs.writeFileSync(fake, `#!/usr/bin/env node
const http = require("http");
if (process.argv[2] === "--version") { console.log("ollama version 0.0.0-fake"); process.exit(0); }
if (process.argv[2] === "serve") {
  const [h, p] = process.env.OLLAMA_HOST.split(":");
  http.createServer((q, r) => { r.setHeader("Content-Type", "application/json"); r.end(q.url.startsWith("/api/version") ? '{"version":"fake"}' : '{"models":[]}'); }).listen(+p, h);
}
`, { mode: 0o755 });
  const appPort = await freePort(), fakePort = await freePort();
  const srv = spawn(process.execPath, [path.join(ROOT, "app/server.js")], {
    env: { ...process.env, PORT: String(appPort), OLLAMA_BIN: fake, OLLAMA_HOST: `127.0.0.1:${fakePort}` }, stdio: "ignore",
  });
  try {
    for (let i = 0; i < 40; i++) { try { await call(appPort, "GET", "/api/tutor/status"); break; } catch { await sleep(100); } }
    let r = await call(appPort, "GET", "/api/tutor/status");
    if (r.body.running !== false || r.body.managed !== false) fail("status before start should be not running: " + JSON.stringify(r.body));
    r = await call(appPort, "POST", "/api/tutor/start");
    if (!(r.body.ok && r.body.started && r.body.managed)) fail("start did not start the fake ollama: " + JSON.stringify(r.body));
    r = await call(appPort, "POST", "/api/tutor/start");
    if (!(r.body.ok && r.body.started === false && r.body.managed)) fail("a second start should find it already running: " + JSON.stringify(r.body));
    r = await call(appPort, "GET", "/api/tutor/status");
    if (!(r.body.running && r.body.managed)) fail("status after start: " + JSON.stringify(r.body));
    // pages that are not on this computer must be refused
    r = await call(appPort, "POST", "/api/tutor/stop", { Host: "evil.example.com" });
    if (r.code !== 403) fail("a request with a foreign Host was not refused");
    r = await call(appPort, "POST", "/api/tutor/stop", { Origin: "http://evil.example.com" });
    if (r.code !== 403) fail("a request from a foreign Origin was not refused");
    r = await call(appPort, "POST", "/api/tutor/stop", { Origin: `http://127.0.0.1:${appPort}` });
    if (!(r.body.ok && r.body.stopped)) fail("stop did not stop the process the app started: " + JSON.stringify(r.body));
    await sleep(400);
    r = await call(appPort, "GET", "/api/tutor/status");
    if (r.body.running) fail("ollama is still running after stop");
    r = await call(appPort, "POST", "/api/tutor/stop");
    if (r.body.stopped !== false) fail("stop with nothing to stop should say so");
    r = await call(appPort, "GET", "/api/tutor/nope");
    if (r.code !== 404) fail("unknown tutor route should be 404");
    r = await call(appPort, "GET", "/index.html");
    if (r.code !== 200) fail("normal pages stopped working");
    // closing the course must not leave the model server behind
    await call(appPort, "POST", "/api/tutor/start");
    srv.kill("SIGINT");
    await sleep(900);
    try { await call(fakePort, "GET", "/api/version"); fail("ollama kept running after the course server stopped"); } catch { /* connection refused: good */ }
  } finally { srv.kill("SIGKILL"); }

  // not installed: the page must get a clear answer, not a hang
  const p2 = await freePort(), f2 = await freePort();
  const srv2 = spawn(process.execPath, [path.join(ROOT, "app/server.js")], { env: { ...process.env, PORT: String(p2), OLLAMA_BIN: path.join(dir, "does-not-exist"), OLLAMA_HOST: `127.0.0.1:${f2}` }, stdio: "ignore" });
  try {
    for (let i = 0; i < 40; i++) { try { await call(p2, "GET", "/api/tutor/status"); break; } catch { await sleep(100); } }
    const r = await call(p2, "POST", "/api/tutor/start");
    if (!(r.body.ok === false && r.body.error === "not-installed")) fail("a missing ollama should answer not-installed: " + JSON.stringify(r.body));
  } finally { srv2.kill("SIGKILL"); }
  fs.rmSync(dir, { recursive: true, force: true });
}

serverTests().then(() => {
  bad.forEach((b) => console.log("FAIL", b));
  if (!bad.length) console.log(`tutor tests passed: ${nEn} English + ${nId} Indonesian passages, ${cases.length} searches, start/stop/refuse/not-installed`);
  process.exit(bad.length ? 1 : 0);
}).catch((e) => { console.log("FAIL", e.stack || e); process.exit(1); });
