#!/usr/bin/env node
// Vercel build: copy the web app (app/) into dist/ and write the cloud-sync settings.
// dist/ holds ONLY static files. The local helper server (app/server.js) is left out on purpose: it starts the
// offline AI tutor and only makes sense on your own computer. No install step, no dependencies, nothing to compile:
// the lesson data (app/js/curriculum-data.js) is already built and committed (npm run check proves it is up to date).
const fs = require("fs");
const path = require("path");
const { buildConfig, configSource } = require("./write-cloud-config.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "app");
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, "dist");
const SKIP = new Set(["server.js", "cloud-config.local.js"]);

function main(env = process.env) {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(SRC, DIST, { recursive: true, filter: (p) => !SKIP.has(path.basename(p)) });

  const must = ["index.html", "js/app.js", "js/curriculum-data.js", "js/cloud-sync.js", "css/style.css", "vendor/pyodide/pyodide.asm.wasm", "vendor/sqljs/sql-wasm.js"];
  const missing = must.filter((f) => !fs.existsSync(path.join(DIST, f)));
  if (missing.length) { console.error("ERROR: missing from the web app: " + missing.join(", ")); process.exit(1); }

  const r = buildConfig(env);
  if (!r.ok) { console.error("ERROR: " + r.message); process.exit(1); }
  fs.writeFileSync(path.join(DIST, "js", "cloud-config.js"), configSource(r.config));

  let files = 0; let bytes = 0;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { files += 1; bytes += fs.statSync(p).size; } } })(DIST);
  console.log(`dist/ ready: ${files} files, ${(bytes / 1048576).toFixed(1)} MB. ${r.message}.`);
}

if (require.main === module) main();
module.exports = { main };
