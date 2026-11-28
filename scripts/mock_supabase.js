#!/usr/bin/env node
// A tiny fake of the parts of Supabase that app/js/cloud-sync.js uses, so the sync can be tested (and tried out)
// without an account:  node scripts/mock_supabase.js [port]
//   Auth:  POST /auth/v1/signup, /auth/v1/token?grant_type=password|refresh_token, /auth/v1/otp, /auth/v1/recover,
//          /auth/v1/logout   GET|PUT /auth/v1/user
//   Data:  /rest/v1/learning_progress  GET, POST, PATCH, DELETE with the filters user_id=eq.X and updated_at=eq.T
// It behaves like the real thing where it matters: the anon key is required, a learner only ever sees their own row
// (what Row Level Security does), updated_at changes on every update, a second insert is a 409.
const http = require("http");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function start(port = 0, opts = {}) {
  const state = {
    anonKey: opts.anonKey || "test-anon-key",
    users: new Map(),        // email -> { id, email, password, confirmed }
    tokens: new Map(),       // access_token -> { id, email, exp }
    refresh: new Map(),      // refresh_token -> user email
    rows: new Map(),         // user_id -> { data, updated_at }
    confirmEmail: Boolean(opts.confirmEmail),
    tableExists: opts.tableExists !== false,
    ttl: opts.ttl || 3600,   // seconds an access token lives
    sent: [],                // emails "sent" (magic links, recovery)
    log: [],
    clock: 0,
  };
  let n = 0;
  const tick = () => { state.clock += 1; return new Date(Date.UTC(2026, 10, 28, 10, 0, 0) + state.clock * 1000).toISOString().replace("Z", "000+00:00"); };

  function issue(user) {
    n += 1;
    const exp = Math.floor(Date.now() / 1000) + state.ttl;
    const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", exp })}.sig${n}`;
    const refresh = `refresh-${n}`;
    state.tokens.set(access, { id: user.id, email: user.email, exp });
    state.refresh.set(refresh, user.email);
    return { access_token: access, token_type: "bearer", expires_in: state.ttl, expires_at: exp, refresh_token: refresh, user: { id: user.id, email: user.email } };
  }
  function authed(req) {
    const t = state.tokens.get((req.headers.authorization || "").replace(/^Bearer /, ""));
    return t && t.exp > Math.floor(Date.now() / 1000) ? t : null;
  }
  const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(res, 400, { message: "bad json" }); }
      state.log.push(`${req.method} ${url.pathname}${url.search}`);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "apikey, authorization, content-type, prefer, x-client-info");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
      if (req.headers.apikey !== state.anonKey) return send(res, 401, { message: "Invalid API key" });
      const p = url.pathname;

      if (p === "/auth/v1/signup" && req.method === "POST") {
        if (!body.email || !body.password) return send(res, 422, { msg: "email and password required" });
        if (state.users.has(body.email)) return send(res, 422, { code: "user_already_exists", msg: "User already registered" });
        const user = { id: `00000000-0000-4000-8000-${String(state.users.size + 1).padStart(12, "0")}`, email: body.email, password: body.password, confirmed: !state.confirmEmail };
        state.users.set(body.email, user);
        return state.confirmEmail ? send(res, 200, { id: user.id, email: user.email }) : send(res, 200, issue(user));
      }
      if (p === "/auth/v1/token" && req.method === "POST") {
        const grant = url.searchParams.get("grant_type");
        if (grant === "password") {
          const u = state.users.get(body.email);
          if (!u || u.password !== body.password) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
          if (!u.confirmed) return send(res, 400, { error: "invalid_grant", error_description: "Email not confirmed" });
          return send(res, 200, issue(u));
        }
        if (grant === "refresh_token") {
          const email = state.refresh.get(body.refresh_token);
          if (!email) return send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
          state.refresh.delete(body.refresh_token);
          return send(res, 200, issue(state.users.get(email)));
        }
      }
      if ((p === "/auth/v1/otp" || p === "/auth/v1/recover") && req.method === "POST") {
        state.sent.push({ kind: p.split("/").pop(), email: body.email, redirect_to: url.searchParams.get("redirect_to") });
        return send(res, 200, {});
      }
      if (p === "/auth/v1/logout" && req.method === "POST") {
        const t = authed(req);
        if (!t) return send(res, 401, { message: "not signed in" });
        state.tokens.delete((req.headers.authorization || "").replace(/^Bearer /, ""));
        return send(res, 204);
      }
      if (p === "/auth/v1/user") {
        const t = authed(req);
        if (!t) return send(res, 401, { msg: "invalid JWT" });
        if (req.method === "PUT") { const u = state.users.get(t.email); if (body.password) u.password = body.password; }
        return send(res, 200, { id: t.id, email: t.email });
      }

      if (p === "/rest/v1/learning_progress") {
        if (!state.tableExists) return send(res, 404, { code: "42P01", message: 'relation "public.learning_progress" does not exist' });
        const t = authed(req);
        if (!t) return send(res, 401, { code: "PGRST301", message: "JWT expired or missing" });
        const eq = (name) => { const v = url.searchParams.get(name); return v && v.startsWith("eq.") ? v.slice(3) : null; };
        const want = eq("user_id");
        const mine = state.rows.has(t.id) && (!want || want === t.id) ? [[t.id, state.rows.get(t.id)]] : [];   // Row Level Security: only your own row exists for you
        if (req.method === "GET") return send(res, 200, mine.map(([, r]) => ({ data: r.data, updated_at: r.updated_at })));
        if (req.method === "POST") {
          if (body.user_id !== t.id) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });
          if (state.rows.has(t.id)) return send(res, 409, { code: "23505", message: "duplicate key value violates unique constraint" });
          state.rows.set(t.id, { data: body.data, updated_at: tick() });
          return send(res, 201);
        }
        if (req.method === "PATCH") {
          const at = eq("updated_at");
          const hit = mine.filter(([, r]) => !at || r.updated_at === at);
          hit.forEach(([id, r]) => { state.rows.set(id, { data: body.data, updated_at: tick() }); });
          const out = hit.map(([id]) => ({ data: state.rows.get(id).data, updated_at: state.rows.get(id).updated_at }));
          return send(res, 200, /representation/.test(req.headers.prefer || "") ? out : undefined);
        }
        if (req.method === "DELETE") { mine.forEach(([id]) => state.rows.delete(id)); return send(res, 204); }
      }
      return send(res, 404, { message: "not found: " + req.method + " " + p });
    });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, state, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}

module.exports = { start };

if (require.main === module) {
  start(Number(process.argv[2]) || 54321).then((m) => {
    console.log(`Fake Supabase on ${m.url}  (anon key: ${m.state.anonKey})`);
    console.log(`Try it:  node scripts/write-cloud-config.js --local --url ${m.url} --key ${m.state.anonKey}`);
  });
}
