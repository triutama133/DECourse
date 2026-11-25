// Zero-dependency static file server for the DataForge web app.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.wasm': 'application/wasm',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.zip': 'application/zip',
  '.whl': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ---- Optional offline AI tutor: the page cannot start programs, so these three endpoints start and stop `ollama serve`.
// Only this app's own child process is ever stopped. Only same-machine pages may call them.
const OLLAMA_BIN = process.env.OLLAMA_BIN || 'ollama';
const OLLAMA_HOST = (process.env.OLLAMA_HOST || '127.0.0.1:11434').replace(/^https?:\/\//, '');
let tutorChild = null;

function sameMachine(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  const okHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  const origin = req.headers.origin;
  if (!origin) return okHost;
  try { return okHost && new URL(origin).host === req.headers.host; } catch { return false; }
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function ollamaUp() {
  return new Promise((resolve) => {
    const [h, p] = OLLAMA_HOST.split(':');
    const r = http.get({ host: h, port: p || 11434, path: '/api/version', timeout: 1500 }, (x) => { x.resume(); resolve(x.statusCode === 200); });
    r.on('error', () => resolve(false));
    r.on('timeout', () => { r.destroy(); resolve(false); });
  });
}
async function tutorStart(res, igpu) {
  if (await ollamaUp()) return sendJson(res, 200, { ok: true, running: true, managed: Boolean(tutorChild), started: false });
  const probe = spawnSync(OLLAMA_BIN, ['--version'], { timeout: 5000 });
  if (probe.error) return sendJson(res, 200, { ok: false, error: 'not-installed' });
  const origins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`].join(',');
  const env = { ...process.env, OLLAMA_HOST, OLLAMA_ORIGINS: [process.env.OLLAMA_ORIGINS, origins].filter(Boolean).join(',') };
  if (igpu) env.OLLAMA_IGPU_ENABLE = '1';
  tutorChild = spawn(OLLAMA_BIN, ['serve'], { env, stdio: 'ignore' });
  tutorChild.on('exit', () => { tutorChild = null; });
  tutorChild.on('error', () => { tutorChild = null; });
  for (let i = 0; i < 40; i++) {
    if (await ollamaUp()) return sendJson(res, 200, { ok: true, running: true, managed: true, started: true });
    if (!tutorChild) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return sendJson(res, 200, { ok: false, error: 'did-not-start' });
}
function tutorStop(res) {
  const had = Boolean(tutorChild);
  if (tutorChild) { try { tutorChild.kill('SIGTERM'); } catch { /* already gone */ } tutorChild = null; }
  sendJson(res, 200, { ok: true, stopped: had });
}
process.on('exit', () => { if (tutorChild) { try { tutorChild.kill('SIGTERM'); } catch { /* ignore */ } } });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0].startsWith('/api/tutor/')) {
    const action = req.url.split('?')[0].slice('/api/tutor/'.length);
    if (!sameMachine(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
    if (action === 'status' && req.method === 'GET') return ollamaUp().then((up) => sendJson(res, 200, { ok: true, running: up, managed: Boolean(tutorChild) }));
    if (action === 'start' && req.method === 'POST') return tutorStart(res, /igpu=1/.test(req.url));
    if (action === 'stop' && req.method === 'POST') return tutorStop(res);
    return sendJson(res, 404, { ok: false, error: 'unknown' });
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad request');
  }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Resolve against PUBLIC_DIR and refuse anything that escapes it (e.g. /../server.py)
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' || err.code === 'EISDIR' ? 404 : 500, { 'Content-Type': 'text/plain' });
      return res.end(err.code === 'ENOENT' || err.code === 'EISDIR' ? 'Not found' : `Server error: ${err.code}`);
    }
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`DataForge is running at http://localhost:${PORT}`);
});
