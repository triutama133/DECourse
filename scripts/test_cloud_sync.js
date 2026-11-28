#!/usr/bin/env node
// Tests for app/js/cloud-sync.js (the no-DOM core) against scripts/mock_supabase.js, plus the config writer and the
// Vercel build:  node scripts/test_cloud_sync.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const lib = require("../app/js/cloud-sync.js");
const { start } = require("./mock_supabase.js");
const { buildConfig, configSource, readEnvFile } = require("./write-cloud-config.js");

const { mergeValue, mergeSnapshots, isSyncable, CloudCore } = lib;
let passed = 0;
async function t(name, fn) { try { await fn(); passed += 1; } catch (e) { console.error("FAIL " + name + "\n  " + (e && e.stack || e)); process.exitCode = 1; } }

class Store {   // a minimal localStorage
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const put = (core, key, value) => { core.storage.setItem(key, JSON.stringify(value)); core.touch(key); };
const get = (core, key) => JSON.parse(core.storage.getItem(key));

(async () => {
  // ---------- pure merge rules ----------
  await t("lists are joined, without repeats", () => {
    assert.deepStrictEqual(mergeValue(["a", "b"], ["b", "c"], true), ["a", "b", "c"]);
  });
  await t("objects merge key by key; the same key takes the newer side", () => {
    const a = { l1: { passed: "t1" }, l2: { passed: "t2" } };
    const b = { l2: { passed: "t9" }, l3: { passed: "t3" } };
    assert.deepStrictEqual(mergeValue(a, b, true), { l1: { passed: "t1" }, l2: { passed: "t2" }, l3: { passed: "t3" } });
    assert.deepStrictEqual(mergeValue(a, b, false).l2, { passed: "t9" });
  });
  await t("a plain value takes the newer change; a tie goes to the online copy", () => {
    const L = { x: { v: JSON.stringify("old"), t: 5 } };
    const R = { x: { v: JSON.stringify("new"), t: 9 } };
    assert.strictEqual(mergeSnapshots(L, R).x.v, JSON.stringify("new"));
    assert.strictEqual(mergeSnapshots(R, L).x.v, JSON.stringify("new"));
    assert.strictEqual(mergeSnapshots({ x: { v: '"a"', t: 3 } }, { x: { v: '"b"', t: 3 } }).x.v, '"b"');
  });
  await t("text that is not JSON (old drafts) is merged by time, not parsed", () => {
    const m = mergeSnapshots({ d: { v: "my draft", t: 8 } }, { d: { v: "other draft", t: 2 } });
    assert.strictEqual(m.d.v, "my draft");
  });
  await t("device settings and pasted terminal text are never synced", () => {
    for (const k of ["df_theme", "df_lang", "df_sound", "df_a11y_large", "df_focus_mode", "df_tryit_paste", "df_visited", "df_tutor_model", "df__cloud_session", "other"]) assert.strictEqual(isSyncable(k), false, k);
    for (const k of ["df_lessons_done", "df_drills", "df_quiz_scores", "df_bl_mod-0-0", "df_streak"]) assert.strictEqual(isSyncable(k), true, k);
  });

  // ---------- core against the fake Supabase ----------
  const mock = await start(0, { anonKey: "anon-123" });
  const make = (opts = {}) => new CloudCore(Object.assign({ url: mock.url, anonKey: "anon-123", storage: new Store(), fetch: (...a) => fetch(...a), debounceMs: 5 }, opts));

  await t("the wrong anon key is refused", async () => {
    const c = make({ anonKey: "wrong" });
    await assert.rejects(c.signIn("a@x.id", "password1"), /Invalid API key/);
  });
  await t("sign up, a wrong password, then sign in", async () => {
    const a = make();
    const r = await a.signUp("budi@x.id", "password1");
    assert.strictEqual(r.signedIn, true);
    assert.strictEqual(a.email, "budi@x.id");
    const b = make();
    await assert.rejects(b.signIn("budi@x.id", "nope-nope"), /Invalid login credentials/);
    assert.strictEqual((await b.signIn("budi@x.id", "password1")).signedIn, true);
    await assert.rejects(make().signUp("budi@x.id", "password1"), /already registered/);
  });

  await t("two devices that learned different things end up with both", async () => {
    const A = make(); const B = make();
    await A.signIn("budi@x.id", "password1"); await B.signIn("budi@x.id", "password1");
    put(A, "df_lessons_done", { "mod-0-0": [0, 1] });
    put(A, "df_drills", { "mod-0-0:0:1": { passed: "2026-11-01" } });
    put(A, "df_theme", "dark"); put(A, "df_tryit_paste", { x: "secret terminal text" });
    const ra = await A.sync();
    assert.strictEqual(ra.pushed, true);
    put(B, "df_lessons_done", { "mod-1-1": [0] });
    put(B, "df_quiz_scores", { "mod-0-0": 90 });
    const rb = await B.sync();
    assert.ok(rb.changed.includes("df_drills"));
    assert.deepStrictEqual(get(B, "df_lessons_done"), { "mod-0-0": [0, 1], "mod-1-1": [0] });
    await A.sync();
    assert.deepStrictEqual(get(A, "df_lessons_done"), get(B, "df_lessons_done"));
    assert.deepStrictEqual(get(A, "df_quiz_scores"), { "mod-0-0": 90 });
    const row = [...mock.state.rows.values()][0].data;
    assert.ok(!("df_theme" in row) && !("df_tryit_paste" in row), "device settings and pasted text stay local");
    assert.strictEqual(B.storage.getItem("df_theme"), null);
  });

  await t("a second sync with nothing new writes nothing", async () => {
    const A = make(); await A.signIn("budi@x.id", "password1");
    await A.sync();
    const before = mock.state.log.filter((l) => l.startsWith("PATCH") || l.startsWith("POST /rest")).length;
    const r = await A.sync();
    assert.strictEqual(r.pushed, false);
    assert.strictEqual(mock.state.log.filter((l) => l.startsWith("PATCH") || l.startsWith("POST /rest")).length, before);
  });

  await t("a save from another device between our read and our write is merged, not lost", async () => {
    const A = make(); const B = make();
    await A.signIn("budi@x.id", "password1"); await B.signIn("budi@x.id", "password1");
    put(A, "df_lessons_done", { "mod-2-1": [0] });
    let injected = false;
    A.fetch = async (url, o) => {
      const res = await fetch(url, o);
      if (!injected && String(url).includes("/rest/v1/learning_progress?select") ) {
        injected = true;
        put(B, "df_lessons_done", { "mod-2-2": [3] });
        await B.sync();   // device B saves right after A has read the row
      }
      return res;
    };
    await A.sync();
    await B.sync();
    const lessons = get(B, "df_lessons_done");
    assert.ok(lessons["mod-2-1"] && lessons["mod-2-2"], "both devices' lessons survive: " + JSON.stringify(lessons));
    assert.deepStrictEqual(get(A, "df_lessons_done"), lessons);
  });

  await t("an expired token is refreshed and the save goes through", async () => {
    const A = make(); await A.signIn("budi@x.id", "password1");
    const s = A.session; A.storage.setItem("df__cloud_session", JSON.stringify(Object.assign({}, s, { expires_at: 1 })));
    put(A, "df_streak", { days: 3, lastDate: "2026-11-28" });
    await A.sync();
    assert.ok(mock.state.log.some((l) => l.includes("grant_type=refresh_token")));
    assert.ok(A.session.expires_at > 1000);
  });
  await t("a rejected token (401) is refreshed once and retried", async () => {
    const A = make(); await A.signIn("budi@x.id", "password1");
    mock.state.tokens.delete(A.session.access_token);   // the server forgot it
    put(A, "df_streak", { days: 4, lastDate: "2026-11-29" });
    await A.sync();
    assert.strictEqual(A.status, "saved");
  });

  await t("offline keeps the work on the device and the next sync catches up", async () => {
    const A = make(); await A.signIn("budi@x.id", "password1");
    const good = A.fetch;
    A.fetch = async () => { throw new TypeError("Failed to fetch"); };
    put(A, "df_sql_done", { q1: { times: 1 } });
    await assert.rejects(A.sync(), /offline/);
    assert.strictEqual(A.status, "offline");
    assert.deepStrictEqual(get(A, "df_sql_done"), { q1: { times: 1 } });
    A.fetch = good;
    const r = await A.sync();
    assert.strictEqual(A.status, "saved");
    assert.strictEqual(r.pushed, true);
  });

  await t("touch() saves by itself after a short pause, once for many writes", async () => {
    const A = make({ debounceMs: 20 }); await A.signIn("budi@x.id", "password1");
    await A.sync();
    const before = mock.state.log.filter((l) => l.startsWith("PATCH")).length;
    put(A, "df_py_done", { p1: { times: 1 } }); put(A, "df_py_done", { p1: { times: 2 } }); put(A, "df_py_done", { p1: { times: 3 } });
    assert.strictEqual(A.status, "pending");
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(A.status, "saved");
    assert.strictEqual(mock.state.log.filter((l) => l.startsWith("PATCH")).length - before, 1);
  });

  await t("learners never see each other's rows", async () => {
    const A = make(); const E = make();
    await A.signIn("budi@x.id", "password1");
    await E.signUp("eka@x.id", "password2");
    const rows = await E._authed(`/rest/v1/learning_progress?select=data&user_id=eq.${A.session.user.id}`);
    assert.deepStrictEqual(rows, []);
    put(E, "df_lessons_done", { only: [1] }); await E.sync();
    await A.sync();
    assert.ok(!("only" in (get(A, "df_lessons_done") || {})));
  });

  await t("sign out clears the session; a magic link and a recovery link are asked for with a way back", async () => {
    const A = make(); await A.signIn("budi@x.id", "password1");
    await A.signOut();
    assert.strictEqual(A.signedIn, false);
    await A.magicLink("budi@x.id", "https://learn.example.app/");
    await A.recover("budi@x.id", "https://learn.example.app/");
    assert.deepStrictEqual(mock.state.sent.map((s) => [s.kind, s.redirect_to]), [["otp", "https://learn.example.app/"], ["recover", "https://learn.example.app/"]]);
  });

  await t("coming back from an email link takes the session out of the address", () => {
    const claims = Buffer.from(JSON.stringify({ sub: "u-1", email: "budi@x.id" })).toString("base64url");
    const A = make();
    const got = A.adoptFromHash(`#access_token=h.${claims}.s&refresh_token=r1&expires_in=3600&type=recovery`);
    assert.deepStrictEqual(got, { type: "recovery", needsUser: false });
    assert.strictEqual(A.email, "budi@x.id");
    assert.strictEqual(make().adoptFromHash("#/curriculum/mod-1-1"), null);
  });

  await t("deleting the online copy removes the row and leaves the device alone", async () => {
    const A = make(); await A.signIn("budi@x.id", "password1");
    put(A, "df_lessons_done", { keep: [1] }); await A.sync();
    await A.deleteOnlineCopy();
    assert.strictEqual(mock.state.rows.has(A.session.user.id), false);
    assert.deepStrictEqual(get(A, "df_lessons_done").keep, [1]);
  });

  await t("a missing table gives a clear error and loses nothing", async () => {
    const m2 = await start(0, { anonKey: "k", tableExists: false });
    const A = new CloudCore({ url: m2.url, anonKey: "k", storage: new Store(), fetch: (...a) => fetch(...a) });
    await A.signUp("a@x.id", "password1");
    put(A, "df_lessons_done", { x: [1] });
    await assert.rejects(A.sync(), /does not exist/);
    assert.strictEqual(A.status, "error");
    assert.deepStrictEqual(get(A, "df_lessons_done"), { x: [1] });
    await m2.close();
  });

  await t("email confirmation projects: sign-up asks the learner to confirm first", async () => {
    const m3 = await start(0, { anonKey: "k", confirmEmail: true });
    const A = new CloudCore({ url: m3.url, anonKey: "k", storage: new Store(), fetch: (...a) => fetch(...a) });
    const r = await A.signUp("new@x.id", "password1");
    assert.deepStrictEqual(r, { signedIn: false, confirmEmail: true });
    await assert.rejects(A.signIn("new@x.id", "password1"), /Email not confirmed/);
    await m3.close();
  });
  await mock.close();

  // ---------- config writer ----------
  await t("config: off by default, on with both values, refuses a secret key", () => {
    assert.strictEqual(buildConfig({}).config, null);
    assert.strictEqual(buildConfig({ SUPABASE_URL: "https://abc.supabase.co" }).ok, false);
    const anon = "h." + Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url") + ".s";
    const secret = "h." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + ".s";
    const ok = buildConfig({ SUPABASE_URL: "https://abc.supabase.co/", SUPABASE_ANON_KEY: anon });
    assert.deepStrictEqual(ok.config, { url: "https://abc.supabase.co", anonKey: anon });
    assert.strictEqual(buildConfig({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: secret }).ok, false);
    assert.strictEqual(buildConfig({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "sb_secret_abc" }).ok, false);
    assert.strictEqual(buildConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc" }).ok, true);
    assert.strictEqual(buildConfig({ SUPABASE_URL: "https://evil.example.com", SUPABASE_ANON_KEY: anon }).ok, false);
    assert.ok(/window\.DF_CLOUD = null;/.test(configSource(null)));
  });

  await t("config: a .env file with a prefix gives only the public URL and key, never the secret key or other lines", () => {
    const envText = "sudo=hunter2\ntalenthub_PUBLIC_SUPABASE_URL=\"https://abc.supabase.co\"\ntalenthub_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xyz\ntalenthub_SUPABASE_SERVICE_ROLE_KEY=sb_secret_nope\n";
    const picked = readEnvFile(envText, "talenthub_");
    assert.ok(picked.SUPABASE_URL && picked.SUPABASE_ANON_KEY);
    assert.ok(Object.keys(picked).every((k) => /SUPABASE_(URL|ANON_KEY|PUBLISHABLE_KEY)$/.test(k)), "only the public names: " + Object.keys(picked));
    assert.ok(!JSON.stringify(picked).includes("hunter2") && !JSON.stringify(picked).includes("nope"));
    assert.deepStrictEqual(buildConfig(picked).config, { url: "https://abc.supabase.co", anonKey: "sb_publishable_xyz" });
    assert.deepStrictEqual(readEnvFile(envText, "other_"), {});
  });

  // ---------- the Vercel build ----------
  await t("vercel build: static files only, no local server, settings written from the environment", () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "dist-"));
    const anon = "h." + Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url") + ".s";
    const out = execFileSync("node", [path.join(__dirname, "build-vercel.js")], { env: Object.assign({}, process.env, { DIST_DIR: dist, SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: anon }), encoding: "utf8" });
    assert.ok(/cloud sync is ON/.test(out), out);
    assert.ok(fs.existsSync(path.join(dist, "index.html")));
    assert.ok(!fs.existsSync(path.join(dist, "server.js")), "the local helper server must not be published");
    assert.ok(fs.readFileSync(path.join(dist, "js", "cloud-config.js"), "utf8").includes("abc.supabase.co"));
    const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    for (const m of html.matchAll(/(?:src|href)="((?:js|css|vendor)\/[^"?]+)/g)) assert.ok(fs.existsSync(path.join(dist, m[1])) || m[1].endsWith("cloud-config.local.js"), "index.html points at a missing file: " + m[1]);
    fs.rmSync(dist, { recursive: true, force: true });
  });
  await t("vercel.json is valid and points at the build", () => {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
    assert.strictEqual(v.outputDirectory, "dist");
    assert.strictEqual(v.buildCommand, "node scripts/build-vercel.js");
    assert.strictEqual(v.framework, null);
  });

  console.log(process.exitCode ? "cloud sync: FAILED" : `cloud sync: ${passed} checks passed`);
})();
