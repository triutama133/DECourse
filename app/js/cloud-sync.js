/* DataForge cloud sync: save the learner's progress in their own Supabase account, so it follows them to any device.
 *
 * Off by default. It turns on only when js/cloud-config.js (or the optional, git-ignored js/cloud-config.local.js)
 * sets window.DF_CLOUD = { url, anonKey }. Without that, the app works exactly as before and no button is shown.
 *
 * How it works (no library, only fetch):
 *   - Sign in with Supabase Auth over REST (email + password, or an email link).
 *   - One row per learner in table `learning_progress` (see supabase/schema.sql). Row Level Security lets a learner
 *     read and write only their own row. The browser holds only the public "anon" key, never a secret key.
 *   - The row holds a snapshot of the app's own localStorage keys (df_*), each with the time it last changed.
 *   - Saving = read the online row, MERGE it with this device, write back (compare-and-swap on updated_at).
 *     Merge rule: lists are joined, objects are merged key by key, a plain value takes the newer change.
 *     So two devices that each learned something different end up with both.
 *   - Device settings (theme, language, sound, ...) and text pasted from a terminal are never uploaded.
 *
 * The same file runs in Node for scripts/test_cloud_sync.js (the part without a DOM).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CloudSyncLib = api; api.boot(root); }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TABLE = "learning_progress";
  const SESSION_KEY = "df__cloud_session";
  const TIMES_KEY = "df__cloud_times";
  const MAX_BYTES = 2 * 1024 * 1024;
  // Device settings and private scratch text stay on the device.
  const NOT_SYNCED = /^df__|^df_(theme|lang|sound|a11y_large|focus_mode|visited|tryit_paste|lab_return)$|^df_tutor_/;

  function isSyncable(key) { return typeof key === "string" && key.startsWith("df_") && !NOT_SYNCED.test(key); }

  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  // The same data can be written with its keys in a different order; that is not a difference.
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (isObj(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v);
  }
  function sameJson(a, b) { return canon(a) === canon(b); }
  function sameRaw(a, b) {   // two stored strings: equal text, or equal JSON data
    if (a === b) return true;
    try { return sameJson(JSON.parse(a), JSON.parse(b)); } catch (e) { return false; }
  }

  // ---- merge (pure) --------------------------------------------------------------------------------------------
  function mergeValue(a, b, preferA) {
    if (Array.isArray(a) && Array.isArray(b)) {
      const seen = new Set(a.map((x) => JSON.stringify(x)));
      return a.concat(b.filter((x) => !seen.has(JSON.stringify(x))));
    }
    if (isObj(a) && isObj(b)) {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(k in a)) out[k] = b[k];
        else if (!(k in b)) out[k] = a[k];
        else out[k] = mergeValue(a[k], b[k], preferA);
      }
      return out;
    }
    if (sameJson(a, b)) return a;
    return preferA ? a : b;
  }

  // snapshot = { key: { v: "<raw localStorage string>", t: <ms time of the last change> } }
  function mergeSnapshots(local, remote) {
    const out = {};
    for (const key of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
      const L = local && local[key];
      const R = remote && remote[key];
      if (!L) { out[key] = R; continue; }
      if (!R) { out[key] = L; continue; }
      const t = Math.max(L.t || 0, R.t || 0);
      if (L.v === R.v) { out[key] = { v: L.v, t }; continue; }
      let pa; let pb; let ok = true;
      try { pa = JSON.parse(L.v); pb = JSON.parse(R.v); } catch (e) { ok = false; }
      const localNewer = (L.t || 0) > (R.t || 0);   // a tie goes to the online copy
      if (ok) {
        const merged = mergeValue(pa, pb, localNewer);
        const cm = canon(merged);
        // when the result is just one of the two stored texts (only the key order differed), keep that text unchanged
        out[key] = { v: cm === canon(pb) ? R.v : cm === canon(pa) ? L.v : JSON.stringify(merged), t };
      } else out[key] = localNewer ? { v: L.v, t } : { v: R.v, t };
    }
    return out;
  }

  function stable(snap) {
    const o = {};
    Object.keys(snap || {}).sort().forEach((k) => {
      let v = snap[k].v;
      try { v = canon(JSON.parse(v)); } catch (e) { /* plain text */ }
      o[k] = { v, t: snap[k].t };
    });
    return JSON.stringify(o);
  }

  // ---- core (no DOM) -------------------------------------------------------------------------------------------
  class CloudCore {
    constructor(opts) {
      this.url = String(opts.url || "").replace(/\/+$/, "");
      this.anonKey = opts.anonKey || "";
      this.storage = opts.storage;
      this.fetch = opts.fetch;
      this.now = opts.now || (() => Date.now());
      this.debounceMs = opts.debounceMs == null ? 2500 : opts.debounceMs;
      this.onStatus = opts.onStatus || (() => {});
      this.status = "idle";
      this.lastSaved = null;
      this._timer = null;
      this._busy = null;
      this._again = false;
    }

    get enabled() { return Boolean(this.url && this.anonKey); }
    get session() {
      try { return JSON.parse(this.storage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
    }
    get signedIn() { const s = this.session; return Boolean(s && s.access_token && s.user); }
    get email() { const s = this.session; return s && s.user ? s.user.email : null; }

    _setStatus(s, detail) { this.status = s; this.onStatus(s, detail || ""); }
    _saveSession(s) { this.storage.setItem(SESSION_KEY, JSON.stringify(s)); }
    _clearSession() { try { this.storage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }

    // ---- auth ----
    async _json(path, { method = "GET", body, token, headers } = {}) {
      const h = Object.assign({ apikey: this.anonKey, "Content-Type": "application/json" }, headers || {});
      h.Authorization = "Bearer " + (token || this.anonKey);
      let res;
      try { res = await this.fetch(this.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
      catch (e) { const err = new Error("offline"); err.offline = true; throw err; }
      let data = null;
      const text = await res.text();
      if (text) { try { data = JSON.parse(text); } catch (e) { data = { message: text.slice(0, 200) }; } }
      if (!res.ok) {
        const err = new Error((data && (data.error_description || data.msg || data.message || data.error)) || ("HTTP " + res.status));
        err.status = res.status; err.code = data && (data.code || data.error_code); err.data = data;
        throw err;
      }
      return data;
    }

    _adopt(data) {
      if (!data || !data.access_token) return false;
      const expires = data.expires_at || Math.floor(this.now() / 1000) + (data.expires_in || 3600);
      this._saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: expires, user: data.user ? { id: data.user.id, email: data.user.email } : (this.session && this.session.user) });
      return true;
    }

    async signUp(email, password) {
      const d = await this._json("/auth/v1/signup", { method: "POST", body: { email, password } });
      if (this._adopt(d)) return { signedIn: true };
      return { signedIn: false, confirmEmail: true };   // the project asks for an email confirmation first
    }
    async signIn(email, password) {
      const d = await this._json("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
      this._adopt(d);
      return { signedIn: this.signedIn };
    }
    async magicLink(email, redirectTo) {
      const q = redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : "";
      await this._json("/auth/v1/otp" + q, { method: "POST", body: { email, create_user: true } });
    }
    async recover(email, redirectTo) {
      const q = redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : "";
      await this._json("/auth/v1/recover" + q, { method: "POST", body: { email } });
    }
    async updatePassword(password) {
      await this._authed("/auth/v1/user", { method: "PUT", body: { password } });
    }
    async signOut() {
      const s = this.session;
      if (s && s.access_token) { try { await this._json("/auth/v1/logout", { method: "POST", token: s.access_token }); } catch (e) { /* the local sign-out below is what matters */ } }
      this._clearSession();
      this._setStatus("signed-out");
    }
    // A sign-in link comes back as  #access_token=...&refresh_token=...&type=magiclink|signup|recovery
    adoptFromHash(hash) {
      const m = /^#(access_token=.*)$/.exec(hash || "");
      if (!m) return null;
      const p = new URLSearchParams(m[1]);
      const access = p.get("access_token");
      if (!access) return null;
      let user = null;
      try { const claims = JSON.parse(atob(access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); user = { id: claims.sub, email: claims.email }; } catch (e) { /* the first sync fetches the user */ }
      this._saveSession({ access_token: access, refresh_token: p.get("refresh_token"), expires_at: Number(p.get("expires_at")) || Math.floor(this.now() / 1000) + (Number(p.get("expires_in")) || 3600), user });
      return { type: p.get("type") || "magiclink", needsUser: !user };
    }

    async _refresh() {
      const s = this.session;
      if (!s || !s.refresh_token) throw Object.assign(new Error("signed-out"), { status: 401 });
      const d = await this._json("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } });
      this._adopt(d);
    }
    async _authed(path, opts = {}, retried = false) {
      let s = this.session;
      if (!s) throw Object.assign(new Error("signed-out"), { status: 401 });
      if (s.expires_at && s.expires_at - 60 < Math.floor(this.now() / 1000)) { await this._refresh(); s = this.session; }
      try { return await this._json(path, Object.assign({}, opts, { token: s.access_token })); }
      catch (e) {
        if (e.status === 401 && !retried) { await this._refresh(); return this._authed(path, opts, true); }
        throw e;
      }
    }
    async _ensureUser() {
      const s = this.session;
      if (s && s.user && s.user.id) return s.user;
      const u = await this._authed("/auth/v1/user");
      this._saveSession(Object.assign({}, s, { user: { id: u.id, email: u.email } }));
      return { id: u.id, email: u.email };
    }

    // ---- local snapshot ----
    _times() { try { return JSON.parse(this.storage.getItem(TIMES_KEY) || "{}") || {}; } catch (e) { return {}; } }
    _saveTimes(t) { try { this.storage.setItem(TIMES_KEY, JSON.stringify(t)); } catch (e) { /* storage full or blocked */ } }
    _keys() {
      const keys = [];
      for (let i = 0; i < this.storage.length; i++) { const k = this.storage.key(i); if (isSyncable(k)) keys.push(k); }
      return keys;
    }
    snapshot() {
      const times = this._times();
      const snap = {};
      for (const k of this._keys()) snap[k] = { v: this.storage.getItem(k), t: times[k] || 1 };
      return snap;
    }
    // writeStore() calls this for every save
    touch(key) {
      if (!this.enabled || !isSyncable(key)) return;
      const t = this._times(); t[key] = this.now(); this._saveTimes(t);
      if (!this.signedIn) return;
      this._setStatus("pending");
      clearTimeout(this._timer);
      this._timer = setTimeout(() => { this.sync().catch(() => {}); }, this.debounceMs);
    }
    _applyLocal(merged) {
      const times = this._times();
      const changed = [];
      for (const [k, e] of Object.entries(merged)) {
        if (!isSyncable(k)) continue;
        const have = this.storage.getItem(k);
        if (have === null || !sameRaw(have, e.v)) { this.storage.setItem(k, e.v); changed.push(k); }
        times[k] = e.t;
      }
      this._saveTimes(times);
      return changed;
    }

    // ---- sync: read the online row, merge, write back only if something is new there ----
    async _row(uid) {
      const rows = await this._authed(`/rest/v1/${TABLE}?select=data,updated_at&user_id=eq.${encodeURIComponent(uid)}`);
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
    sync() {
      if (this._busy) { this._again = true; return this._busy; }
      this._busy = (async () => {
        try {
          const total = { changed: [], pushed: false };
          do {
            this._again = false;
            const r = await this._syncOnce();   // a save that arrived meanwhile runs once more; the answer covers all rounds
            r.changed.forEach((k) => { if (!total.changed.includes(k)) total.changed.push(k); });
            total.pushed = total.pushed || r.pushed;
          } while (this._again);
          return total;
        } finally { this._busy = null; }
      })();
      return this._busy;
    }
    async _syncOnce() {
      if (!this.enabled || !this.signedIn) return { changed: [], pushed: false };
      this._setStatus("syncing");
      try {
        const user = await this._ensureUser();
        for (let attempt = 0; attempt < 5; attempt++) {
          const row = await this._row(user.id);
          const remote = row && isObj(row.data) ? row.data : {};
          const merged = mergeSnapshots(this.snapshot(), remote);
          let pushed = false;
          if (stable(merged) !== stable(remote)) {
            if (JSON.stringify(merged).length > MAX_BYTES) throw Object.assign(new Error("too-large"), { tooLarge: true });
            if (row) {
              const done = await this._authed(`/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(user.id)}&updated_at=eq.${encodeURIComponent(row.updated_at)}`, { method: "PATCH", body: { data: merged }, headers: { Prefer: "return=representation" } });
              if (!Array.isArray(done) || !done.length) continue;   // someone saved in between: read again and merge again
            } else {
              try { await this._authed(`/rest/v1/${TABLE}`, { method: "POST", body: { user_id: user.id, data: merged }, headers: { Prefer: "return=minimal" } }); }
              catch (e) { if (e.status === 409) continue; throw e; }
            }
            pushed = true;
          }
          const changed = this._applyLocal(merged);
          this.lastSaved = this.now();
          this._setStatus("saved");
          return { changed, pushed };
        }
        throw new Error("busy");
      } catch (e) {
        this._setStatus(e.offline ? "offline" : "error", e.message);
        throw e;
      }
    }

    async deleteOnlineCopy() {
      const user = await this._ensureUser();
      await this._authed(`/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    }
  }

  // ---- browser part -------------------------------------------------------------------------------------------
  function boot(win) {
    const cfg = win.DF_CLOUD;
    const noop = { enabled: false, touch() {} };
    if (!cfg || !cfg.url || !cfg.anonKey || !win.document) { win.cloud = noop; return; }
    const doc = win.document;
    const en = () => (doc.documentElement.lang || "id") === "en";
    const T = (id, e) => (en() ? e : id);

    const core = new CloudCore({ url: cfg.url, anonKey: cfg.anonKey, storage: win.localStorage, fetch: win.fetch.bind(win), onStatus: () => paintButton() });
    win.cloud = { enabled: true, core, touch: (k) => core.touch(k), open: () => openDialog() };

    // Coming back from an email link: take the session out of the address, then leave the app's own #/route behind.
    let recovery = false;
    try {
      const got = core.adoptFromHash(win.location.hash);
      if (got) {
        recovery = got.type === "recovery";
        win.history.replaceState(null, "", win.location.pathname + win.location.search + "#/roadmap");
      }
    } catch (e) { /* storage blocked: the learner can still sign in with a password */ }

    let btn; let dlg; let msgEl;

    function when(ms) { return ms ? new Date(ms).toLocaleTimeString(en() ? "en-GB" : "id-ID", { hour: "2-digit", minute: "2-digit" }) : ""; }
    function label() {
      if (!core.signedIn) return { icon: "👤", text: T("Masuk", "Sign in"), state: "off" };
      const map = {
        syncing: [T("Menyimpan…", "Saving…"), "busy"], pending: [T("Menyimpan…", "Saving…"), "busy"],
        offline: [T("Offline", "Offline"), "warn"], error: [T("Gagal simpan", "Not saved"), "warn"],
      };
      const m = map[core.status];
      return { icon: "☁", text: m ? m[0] : T("Tersimpan", "Saved"), state: m ? m[1] : "ok" };
    }
    function paintButton() {
      if (!btn) return;
      const l = label();
      btn.dataset.state = l.state;
      btn.querySelector(".cloud-icon").textContent = l.icon;
      btn.querySelector(".icon-btn-label").textContent = l.text;
      btn.title = core.signedIn ? T("Akun: ", "Account: ") + core.email : T("Masuk untuk menyimpan progres secara online", "Sign in to save your progress online");
      if (dlg && !dlg.hidden) renderDialog();
    }
    function toast(text) {
      const el = doc.getElementById("toast");
      if (!el) return;
      el.textContent = text; el.hidden = false; el.classList.add("show");
      clearTimeout(toast._t); toast._t = setTimeout(() => { el.classList.remove("show"); setTimeout(() => { el.hidden = true; }, 250); }, 5000);
    }

    // After the first sign-in the page re-reads storage once, so the lesson map shows the restored progress.
    function reloadOnce(afterReload) {
      let last = 0;
      try { last = Number(win.sessionStorage.getItem("df__cloud_reload") || 0); } catch (e) { /* ignore */ }
      if (Date.now() - last < 30000) return false;
      try {
        win.sessionStorage.setItem("df__cloud_reload", String(Date.now()));
        if (afterReload) win.sessionStorage.setItem("df__cloud_msg", afterReload);   // shown once the page is back
      } catch (e) { return false; }
      win.location.reload();
      return true;
    }
    async function syncNow(announce, afterReload) {
      try {
        const r = await core.sync();
        if (r.changed.length) {
          if (!reloadOnce(afterReload)) toast(T("Progres dari akun Anda masuk. Muat ulang halaman untuk melihatnya.", "Progress from your account arrived. Reload the page to see it."));
        } else if (announce) toast(T("Progres tersimpan online ✓", "Progress saved online ✓"));
      } catch (e) { if (announce) toast(friendly(e)); }
    }
    function friendly(e) {
      if (e && e.offline) return T("Tidak ada koneksi. Progres tetap aman di perangkat ini dan akan disimpan nanti.", "No connection. Your progress is safe on this device and will be saved later.");
      if (e && e.tooLarge) return T("Data progres terlalu besar untuk disimpan online.", "The progress data is too large to save online.");
      if (e && e.status === 400 && /invalid login/i.test(e.message)) return T("Email atau kata sandi salah.", "Wrong email or password.");
      if (e && /email not confirmed/i.test(e.message)) return T("Email belum dikonfirmasi. Buka tautan di email Anda.", "Email not confirmed yet. Open the link in your email.");
      if (e && e.status === 429) return T("Terlalu banyak percobaan. Tunggu sebentar.", "Too many tries. Please wait a moment.");
      if (e && /already registered|already been registered/i.test(e.message)) return T("Email ini sudah terdaftar. Silakan masuk.", "This email is already registered. Please sign in.");
      if (e && e.status === 404) return T("Tabel online belum dibuat. Jalankan supabase/schema.sql di proyek Supabase Anda.", "The online table does not exist yet. Run supabase/schema.sql in your Supabase project.");
      return (e && e.message) || "Error";
    }

    // ---- dialog ----
    function el(tag, attrs, ...kids) {
      const n = doc.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (k === "class") n.className = v; else if (k === "text") n.textContent = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
      }
      kids.flat().forEach((c) => n.append(c));
      return n;
    }
    let mode = "signin";   // signin | signup | newpass
    let note = ""; let noteBad = false; let working = false;
    let draftEmail = "";   // the dialog is redrawn after every message; the typed email must survive that
    function setNote(t, bad) { note = t; noteBad = Boolean(bad); renderDialog(); }
    function value(id) { const i = doc.getElementById(id); return i ? i.value.trim() : ""; }

    async function run(fn) {
      if (working) return;
      working = true; setNote(T("Sebentar…", "One moment…"), false);
      try { await fn(); } catch (e) { working = false; setNote(friendly(e), true); return; }
      working = false;
    }
    function submit(ev) {
      ev.preventDefault();
      const email = value("cloud-email"); const pw = doc.getElementById("cloud-pass") ? doc.getElementById("cloud-pass").value : "";
      if (mode === "newpass") {
        if (pw.length < 8) return setNote(T("Kata sandi minimal 8 karakter.", "The password needs at least 8 characters."), true);
        return run(async () => { await core.updatePassword(pw); mode = "signin"; setNote(T("Kata sandi diganti ✓", "Password changed ✓"), false); syncNow(false, T("Kata sandi diganti ✓", "Password changed ✓")); });
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) return setNote(T("Isi alamat email yang benar.", "Enter a valid email address."), true);
      if (pw.length < 8) return setNote(T("Kata sandi minimal 8 karakter.", "The password needs at least 8 characters."), true);
      return run(async () => {
        const r = mode === "signup" ? await core.signUp(email, pw) : await core.signIn(email, pw);
        if (!r.signedIn) { setNote(T("Cek email Anda dan buka tautan konfirmasi, lalu masuk.", "Check your email and open the confirmation link, then sign in."), false); mode = "signin"; return; }
        setNote("", false); paintButton(); await syncNow(true);
      });
    }
    function sendLink(kind) {
      const email = value("cloud-email");
      if (!/^\S+@\S+\.\S+$/.test(email)) return setNote(T("Isi alamat email lebih dulu.", "Enter your email first."), true);
      const back = win.location.origin + win.location.pathname;
      return run(async () => {
        if (kind === "recover") await core.recover(email, back); else await core.magicLink(email, back);
        setNote(T("Tautan sudah dikirim. Buka email Anda di perangkat ini.", "The link is on its way. Open your email on this device."), false);
      });
    }
    function renderDialog() {
      if (!dlg) return;
      const body = dlg.querySelector(".cloud-body");
      body.replaceChildren();
      const close = el("button", { class: "icon-btn cloud-close", type: "button", "aria-label": T("Tutup", "Close"), text: "✕", onclick: closeDialog });
      body.append(close, el("h2", { id: "cloud-title", text: mode === "newpass" ? T("Kata sandi baru", "New password") : core.signedIn ? T("Akun Anda", "Your account") : T("Simpan progres online", "Save your progress online") }));

      if (core.signedIn && mode !== "newpass") {
        const st = core.status;
        const line = st === "offline" ? T("Offline. Akan disimpan saat tersambung.", "Offline. It will be saved when you are connected.")
          : st === "error" ? T("Belum tersimpan. Coba lagi.", "Not saved yet. Try again.")
            : core.lastSaved ? T("Terakhir tersimpan pukul ", "Last saved at ") + when(core.lastSaved) : T("Siap menyimpan.", "Ready to save.");
        body.append(
          el("p", {}, T("Masuk sebagai ", "Signed in as "), el("strong", { text: core.email || "" })),
          el("p", { class: "muted small", text: line }),
          el("p", { class: "muted small", text: T("Yang disimpan: progres materi, latihan, kuis, catatan, dan draf Anda. Teks yang Anda tempel dari terminal tidak diunggah.", "Saved: your lesson progress, drills, quizzes, notes and drafts. Text you paste from your terminal is not uploaded.") }),
          el("div", { class: "cloud-actions" },
            el("button", { class: "btn btn-primary", type: "button", text: T("Simpan sekarang", "Save now"), onclick: () => syncNow(true) }),
            el("button", { class: "btn btn-quiet", type: "button", text: T("Keluar", "Sign out"), onclick: async () => { await core.signOut(); paintButton(); renderDialog(); toast(T("Anda sudah keluar. Progres tetap ada di perangkat ini.", "Signed out. Your progress stays on this device.")); } })),
          el("details", { class: "cloud-more" }, el("summary", { text: T("Hapus salinan online", "Delete the online copy") }),
            el("p", { class: "muted small", text: T("Menghapus progres yang tersimpan di akun. Progres di perangkat ini tidak berubah.", "Deletes the progress stored in your account. Progress on this device is not touched.") }),
            el("button", { class: "btn btn-quiet", type: "button", text: T("Hapus salinan online", "Delete online copy"), onclick: () => run(async () => { await core.deleteOnlineCopy(); setNote(T("Salinan online dihapus.", "Online copy deleted."), false); }) })));
      } else {
        body.append(el("p", { class: "muted small", text: mode === "newpass" ? T("Pilih kata sandi baru untuk akun Anda.", "Choose a new password for your account.") : T("Progres Anda selalu tersimpan di perangkat ini. Dengan akun, progres juga tersimpan online dan bisa dilanjutkan di perangkat lain.", "Your progress is always saved on this device. With an account it is also saved online, so you can continue on another device.") }));
        const form = el("form", { class: "cloud-form", onsubmit: submit, novalidate: "" });
        if (mode !== "newpass") {
          form.append(el("div", { class: "cloud-tabs", role: "tablist" },
            el("button", { type: "button", role: "tab", "aria-selected": String(mode === "signin"), class: mode === "signin" ? "active" : "", text: T("Masuk", "Sign in"), onclick: () => { mode = "signin"; note = ""; renderDialog(); } }),
            el("button", { type: "button", role: "tab", "aria-selected": String(mode === "signup"), class: mode === "signup" ? "active" : "", text: T("Buat akun", "Create account"), onclick: () => { mode = "signup"; note = ""; renderDialog(); } })));
          form.append(el("label", { for: "cloud-email", text: "Email" }), el("input", { id: "cloud-email", type: "email", autocomplete: "email", inputmode: "email", required: "", value: draftEmail, oninput: (e) => { draftEmail = e.target.value; } }));
        }
        form.append(el("label", { for: "cloud-pass", text: mode === "newpass" ? T("Kata sandi baru", "New password") : T("Kata sandi (min. 8 karakter)", "Password (min. 8 characters)") }),
          el("input", { id: "cloud-pass", type: "password", autocomplete: mode === "signin" ? "current-password" : "new-password", minlength: "8", required: "" }),
          el("button", { class: "btn btn-primary", type: "submit", text: mode === "signup" ? T("Buat akun", "Create account") : mode === "newpass" ? T("Simpan kata sandi", "Save password") : T("Masuk", "Sign in") }));
        body.append(form);
        if (mode !== "newpass") {
          body.append(el("div", { class: "cloud-alt" },
            el("button", { class: "link-btn", type: "button", text: T("Kirim tautan masuk ke email", "Email me a sign-in link"), onclick: () => sendLink("magic") }),
            el("button", { class: "link-btn", type: "button", text: T("Lupa kata sandi", "Forgot password"), onclick: () => sendLink("recover") })));
        }
      }
      if (note) body.append(el("p", { class: "cloud-note" + (noteBad ? " bad" : ""), role: "status", text: note }));
      const first = body.querySelector("input");
      if (first && !body.contains(doc.activeElement)) first.focus();
    }
    function openDialog() {
      if (!dlg) {
        dlg = el("div", { class: "cloud-overlay", hidden: "", onclick: (e) => { if (e.target === dlg) closeDialog(); } },
          el("div", { class: "cloud-box", role: "dialog", "aria-modal": "true", "aria-labelledby": "cloud-title" }, el("div", { class: "cloud-body" })));
        doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && dlg && !dlg.hidden) closeDialog(); });
        doc.body.append(dlg);
      }
      dlg.hidden = false; renderDialog();
    }
    function closeDialog() { if (dlg) dlg.hidden = true; if (btn) btn.focus(); }

    function mount() {
      const tools = doc.querySelector(".header-tools");
      if (!tools || doc.getElementById("cloud-btn")) return;
      btn = el("button", { class: "icon-btn", id: "cloud-btn", type: "button", "aria-haspopup": "dialog", onclick: openDialog },
        el("span", { class: "cloud-icon", "aria-hidden": "true" }), el("span", { class: "cloud-dot", "aria-hidden": "true" }), el("span", { class: "icon-btn-label" }));
      tools.insertBefore(btn, tools.querySelector(".settings") || null);
      paintButton();
      new win.MutationObserver(paintButton).observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] });
      try { const m = win.sessionStorage.getItem("df__cloud_msg"); if (m) { win.sessionStorage.removeItem("df__cloud_msg"); toast(m); } } catch (e) { /* ignore */ }
      if (recovery) { mode = "newpass"; openDialog(); }
      if (core.signedIn && !recovery) syncNow(false);   // after a reset link: set the new password first, a sync may reload the page
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", mount); else mount();

    // Coming back to the tab: pick up what another device saved.
    let lastCheck = Date.now();
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible" && core.signedIn && mode !== "newpass" && Date.now() - lastCheck > 60000) { lastCheck = Date.now(); syncNow(false); }
    });
    win.addEventListener("pagehide", () => { if (core.status === "pending") core.sync().catch(() => {}); });
  }

  return { mergeValue, mergeSnapshots, isSyncable, CloudCore, boot, stable, canon };
});
