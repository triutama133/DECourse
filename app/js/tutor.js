/* Offline course tutor (optional). A switch in the header turns it on and off.
 *
 * On: the app server starts `ollama serve` on this computer (only if it is not running yet).
 * Ask: the question is searched in the course itself (every lesson and the glossary, in the language you are using),
 *      the best passages go to a small local model, and the answer is shown with links to the lessons it used.
 * Off: the model is unloaded from memory and the Ollama process this app started is stopped.
 * Nothing leaves your computer. scripts/test_tutor_js.js tests the search and the server part. */
(function () {
  "use strict";

  // ------------------------------------------------------------------ search (works in the browser and in node)
  const STOP = new Set(("the a an of to in is it and or for on that this with as be by are you your not no if then when which what at from so can do does into its how why " +
    "i me my we our they them there here was were will would should could about also just more most some any each than too very " +
    "yang dan atau untuk pada itu ini dengan adalah ke dari tidak ada apa bagaimana mengapa kenapa saya aku kita kami anda di akan bisa dapat " +
    "sebuah suatu oleh juga lebih sangat seperti agar karena jika maka lalu sudah belum").split(" "));

  function tokens(text) {
    const out = [];
    for (let w of String(text).toLowerCase().match(/[a-z0-9_]+/g) || []) {
      if (w.length < 2 || STOP.has(w)) continue;
      if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
      out.push(w.slice(0, 7)); // tolerate endings and spellings: idempotent / idempoten / idempotensi
    }
    return out;
  }

  // Keep the teaching, drop the machine parts of a lesson (starters, checks, solutions, animations).
  function cleanBody(body) {
    const out = [];
    let skip = false, inDrill = false;
    for (const line of String(body).split("\n")) {
      const s = line.trim();
      if (s.startsWith(":::drill")) { inDrill = true; skip = false; out.push("Practice: " + s.slice(8).trim().split(" ").slice(1).join(" ")); continue; }
      if (s.startsWith(":::trace") || s.startsWith(":::sqlsteps") || s.startsWith(":::talk") || s.startsWith(":::advanced")) { skip = true; continue; }
      if (s.startsWith(":::ask")) { inDrill = false; skip = false; out.push("Question: " + s.slice(6).trim()); continue; }
      if (s === ":::") { inDrill = false; skip = false; continue; }
      if (skip) continue;
      if (inDrill) {
        if (/^@(starter|check|hint|solution)/.test(s)) skip = true; else out.push(line);
        continue;
      }
      if (s === "@options") continue;
      if (s === "@why") { out.push("Answer explained:"); continue; }
      out.push(line);
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function splitBig(text, limit) {
    const parts = [];
    let cur = "";
    for (const p of text.split("\n\n")) {
      if (cur && cur.length + p.length > limit) { parts.push(cur.trim()); cur = ""; }
      cur += p + "\n\n";
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  function buildChunks(curriculum, glossary, lang) {
    const chunks = [];
    for (const level of curriculum || []) for (const m of level.modules) {
      const modTitle = (m.title && (m.title[lang] || m.title.en)) || m.id;
      (m.lessons || []).forEach((lesson, i) => {
        const lessonTitle = (lesson.title[lang] || lesson.title.en || "").replace(/\{optional\}/, "").trim();
        const body = cleanBody(lesson.body[lang] || lesson.body.en || "");
        let section = "", buf = [];
        const flush = () => {
          const text = buf.join("\n").trim();
          buf = [];
          if (text.length < 80) return;
          for (const part of splitBig(text, 1300)) {
            chunks.push({ mod: m.id, modTitle, lesson: i + 1, lessonTitle, heading: section ? lessonTitle + ": " + section : lessonTitle, text: part, kind: "lesson" });
          }
        };
        for (const line of body.split("\n")) {
          if (line.startsWith("### ")) { flush(); section = line.slice(4).trim(); } else buf.push(line);
        }
        flush();
      });
    }
    const titles = {};
    chunks.forEach((c) => { titles[c.mod] = c.modTitle; });
    for (const g of glossary || []) {
      const term = g.term[lang] || g.term.en;
      chunks.push({ mod: g.mod, modTitle: titles[g.mod] || g.mod, lesson: g.lesson, lessonTitle: "", heading: "Glossary: " + term, text: term + ": " + (g.def[lang] || g.def.en), kind: "glossary" });
    }
    return chunks;
  }

  // BM25 over lesson sections and glossary entries: fast, no model needed.
  function buildIndex(chunks) {
    const k1 = 1.4, b = 0.75, df = new Map(), tf = [], len = [];
    for (const c of chunks) {
      let toks = tokens(c.heading).concat(tokens(c.heading), tokens(c.heading), tokens(c.text)); // the heading counts triple
      if (c.kind === "glossary") toks = tokens(c.heading).concat(tokens(c.heading), tokens(c.heading), tokens(c.heading), toks);
      const cnt = new Map();
      for (const t of toks) cnt.set(t, (cnt.get(t) || 0) + 1);
      tf.push(cnt); len.push(toks.length);
      for (const t of cnt.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
    const avg = len.reduce((a, x) => a + x, 0) / Math.max(1, len.length);
    return {
      chunks,
      // focus = {mod, lesson}: the lesson being read gets a small boost, so "what does this mean" stays on topic
      search(query, k, focus) {
        const q = [...new Set(tokens(query))], n = chunks.length, scored = [];
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (const t of q) {
            const f = tf[i].get(t);
            if (!f) continue;
            const d = df.get(t);
            s += Math.log(1 + (n - d + 0.5) / (d + 0.5)) * f * (k1 + 1) / (f + k1 * (1 - b + b * len[i] / avg));
          }
          if (s > 0) {
            if (focus && chunks[i].mod === focus.mod && chunks[i].lesson === focus.lesson) s *= 1.25;
            scored.push([s, i]);
          }
        }
        scored.sort((x, y) => y[0] - x[0]);
        const picked = [], seen = new Set();
        for (const [s, i] of scored) {
          const c = chunks[i], key = c.mod + "|" + c.lesson + "|" + c.kind;
          if (seen.has(key)) continue; // one passage per lesson keeps the answer varied
          seen.add(key);
          picked.push([s, c]);
          if (picked.length === (k || 3)) break;
        }
        return picked;
      },
    };
  }

  function relevant(passages) {
    return passages.length ? passages.filter((p) => p[0] >= 0.72 * passages[0][0]) : passages; // drop weak matches
  }

  function systemPrompt(lang) {
    return "You are the DataForge Tutor, a patient teacher for a complete beginner who wants to become a professional data engineer. " +
      "Explain in short, plain words, like talking to a friend. Use a tiny everyday example when it helps. " +
      "Answer ONLY from the COURSE EXCERPTS given below. Do not invent facts, commands or numbers. " +
      "If the excerpts do not contain the answer, say so in one sentence and suggest which topic to look for; do not guess. " +
      "Keep the answer under 150 words. Do not list sources: the program shows them. " +
      (lang === "id" ? "Reply in Indonesian." : "Reply in English.");
  }

  function buildMessages(question, passages, lang, history) {
    const ctx = passages.map(([, c]) => "[" + c.modTitle + ", lesson " + c.lesson + ": " + c.heading + "]\n" + c.text.slice(0, 800)).join("\n\n");
    return [{ role: "system", content: systemPrompt(lang) }].concat((history || []).slice(-2),
      [{ role: "user", content: "COURSE EXCERPTS:\n" + ctx + "\n\nQUESTION: " + question }]);
  }

  const core = { tokens, cleanBody, buildChunks, buildIndex, relevant, buildMessages, systemPrompt };
  if (typeof window !== "undefined") window.TutorCore = core;
  if (typeof document === "undefined") return; // node: tests only need the core

  // ------------------------------------------------------------------ the switch, the panel and the model connection
  const MODEL_DEFAULT = "qwen2.5:3b";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the switch just will not be remembered */ } },
  };
  const lang = () => (document.documentElement.lang === "id" ? "id" : "en");
  const L = (id, en) => (lang() === "id" ? id : en);
  const host = () => String(store.get("df_tutor_host", "http://127.0.0.1:11434")).replace(/\/$/, "");
  const model = () => store.get("df_tutor_model", MODEL_DEFAULT);

  const S = { on: store.get("df_tutor_on", false), phase: "off", detail: "", open: false, busy: false, pull: 0, history: [], indexes: {}, abort: null, managed: false };

  function index() {
    const l = lang();
    if (!S.indexes[l]) S.indexes[l] = buildIndex(buildChunks(window.CURRICULUM_DATA, window.GLOSSARY, l));
    return S.indexes[l];
  }
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = (s) => esc(s).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");

  async function getJson(url, opt, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 4000);
    try { const r = await fetch(url, Object.assign({ signal: ctl.signal }, opt || {})); return await r.json(); } finally { clearTimeout(timer); }
  }

  async function modelState() { // "down" | "no-model" | "ready"
    try {
      const d = await getJson(host() + "/api/tags", null, 2500);
      const want = model();
      const have = (d.models || []).map((m) => m.name);
      return have.some((n) => n === want || (!want.includes(":") && n.split(":")[0] === want)) ? "ready" : "no-model";
    } catch (e) { return "down"; }
  }

  function setPhase(phase, detail) { S.phase = phase; S.detail = detail || ""; render(); }

  async function ensure() {
    setPhase("checking");
    let st = await modelState();
    if (st === "down") {
      setPhase("starting");
      let r = null;
      try { r = await getJson("/api/tutor/start" + (store.get("df_tutor_igpu", false) ? "?igpu=1" : ""), { method: "POST" }, 25000); } catch (e) { r = null; }
      if (!r) return setPhase("manual"); // static hosting or no app server: the learner starts Ollama in a terminal
      if (!r.ok) return setPhase(r.error === "not-installed" ? "no-install" : "error", r.error);
      S.managed = Boolean(r.managed);
      st = await modelState();
    }
    if (!S.on) return; // switched off while we were waiting
    if (st === "ready") return setPhase("ready");
    if (st === "no-model") return setPhase("no-model");
    return setPhase("error", "start");
  }

  async function pullModel() {
    S.pull = 0;
    setPhase("pulling");
    try {
      const r = await fetch(host() + "/api/pull", { method: "POST", body: JSON.stringify({ model: model(), stream: true }) });
      const rd = r.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const d = JSON.parse(line);
          if (d.error) throw new Error(d.error);
          if (d.total) { S.pull = Math.round((100 * d.completed) / d.total); const bar = $("tutor-bar"); if (bar) { bar.value = S.pull; $("tutor-pct").textContent = S.pull + "%"; } }
        }
      }
      await ensure();
    } catch (e) { setPhase("error", "pull"); }
  }

  async function turnOn() {
    S.on = true; store.set("df_tutor_on", true);
    S.open = true; render();
    await ensure();
    const i = $("tutor-input"); if (i && S.phase === "ready") i.focus();
  }

  async function turnOff() {
    const wasReady = S.phase === "ready";
    S.on = false; store.set("df_tutor_on", false);
    if (S.abort) S.abort.abort();
    S.open = false; S.history = [];
    setPhase("off");
    if (wasReady) { try { await fetch(host() + "/api/chat", { method: "POST", body: JSON.stringify({ model: model(), keep_alive: 0 }) }); } catch (e) { /* server not running: nothing to unload */ } }
    let note = "";
    try {
      const r = await getJson("/api/tutor/stop", { method: "POST" }, 5000);
      if (!r.stopped && (await modelState()) !== "down") note = L("Ollama dijalankan oleh Anda sendiri, jadi tetap menyala. Model sudah dilepas dari memori.", "You started Ollama yourself, so it keeps running. The model was released from memory.");
    } catch (e) { /* no app server: nothing to stop */ }
    toast(note || L("Tutor mati. Memori dibebaskan.", "Tutor is off. Memory is free."));
  }

  function toast(msg) {
    const t = $("toast"); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 5000);
  }

  function focusLesson() {
    const m = (location.hash || "").match(/^#\/curriculum\/(mod-\d-\d)\/concepts\/(\d+)/);
    return m ? { mod: m[1], lesson: +m[2] } : null;
  }
  const modNo = (id) => id.slice(4).replace("-", ".");

  async function ask(q) {
    q = q.trim();
    if (!q || S.busy || S.phase !== "ready") return;
    S.busy = true;
    addMsg("user", fmt(q));
    const bubble = addMsg("bot", "<span class='muted'>" + esc(L("Membaca materi kursus…", "Reading the course…")) + "</span>");
    const l = lang();
    const passages = relevant(index().search(q, 2, focusLesson()));
    if (!passages.length) {
      bubble.innerHTML = esc(L("Saya tidak menemukannya di kursus ini. Coba kata lain, atau buka Glosarium.", "I could not find that in the course. Try other words, or open the Glossary."));
      S.busy = false; render(); return;
    }
    S.abort = new AbortController();
    let text = "";
    try {
      const r = await fetch(host() + "/api/chat", {
        method: "POST", signal: S.abort.signal,
        body: JSON.stringify({ model: model(), messages: buildMessages(q, passages, l, S.history), stream: true, keep_alive: "30m", options: { temperature: 0.2, num_ctx: 4096, num_predict: 400 } }),
      });
      const rd = r.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const d = JSON.parse(line);
          if (d.error) throw new Error(d.error);
          if (d.message && d.message.content) { text += d.message.content; bubble.innerHTML = fmt(text); scroll(); }
        }
      }
      S.history.push({ role: "user", content: "QUESTION: " + q }, { role: "assistant", content: text });
    } catch (e) {
      if (e.name === "AbortError") bubble.innerHTML = fmt(text) + " <em class='muted'>(" + esc(L("dihentikan", "stopped")) + ")</em>";
      else bubble.innerHTML = esc(L("Model tidak bisa menjawab. Coba matikan lalu nyalakan lagi tutor.", "The model could not answer. Try turning the tutor off and on again."));
    }
    // sources: the lessons that were used, so the learner can read the real text
    const seen = new Set(), src = document.createElement("div");
    src.className = "tutor-src";
    src.appendChild(document.createTextNode(L("Baca lebih lanjut: ", "Read more: ")));
    for (const [, c] of passages) {
      const key = c.mod + "/" + c.lesson;
      if (c.kind === "glossary" || seen.has(key)) continue;
      seen.add(key);
      const a = document.createElement("a");
      a.href = "#/curriculum/" + c.mod + "/concepts/" + c.lesson;
      a.textContent = L("Modul ", "Module ") + modNo(c.mod) + ", " + L("pelajaran ", "lesson ") + c.lesson + ": " + (c.lessonTitle || c.heading);
      src.appendChild(a);
    }
    if (seen.size) bubble.parentNode.appendChild(src);
    S.abort = null; S.busy = false; render(); scroll();
  }

  function addMsg(who, html) {
    const box = $("tutor-log");
    const row = document.createElement("div"); row.className = "tutor-msg " + who;
    const b = document.createElement("div"); b.className = "tutor-bubble"; b.innerHTML = html;
    row.appendChild(b); box.appendChild(row); scroll();
    return b;
  }
  const scroll = () => { const b = $("tutor-log"); if (b) b.scrollTop = b.scrollHeight; };

  // ---- drawing
  function ensurePanel() {
    if ($("tutor-panel")) return;
    const p = document.createElement("aside");
    p.id = "tutor-panel"; p.className = "tutor-panel no-print"; p.hidden = true;
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Course tutor");
    p.innerHTML =
      '<div class="tutor-head"><strong id="tutor-title"></strong><span class="tutor-status" id="tutor-status"></span>' +
      '<button class="btn tutor-offbtn" id="tutor-off"></button><button class="tutor-x" id="tutor-close" aria-label="Close">×</button></div>' +
      '<div class="tutor-setup" id="tutor-setup"></div>' +
      '<div class="tutor-log" id="tutor-log" aria-live="polite"></div>' +
      '<div class="tutor-ctx muted small" id="tutor-ctx"></div>' +
      '<form class="tutor-form" id="tutor-form"><input id="tutor-input" autocomplete="off" /><button class="btn btn-primary" id="tutor-send" type="submit"></button></form>' +
      '<div class="tutor-foot"><span class="muted small" id="tutor-note"></span>' +
      '<label class="muted small tutor-igpu"><input type="checkbox" id="tutor-igpu"> <span id="tutor-igpu-l"></span></label></div>';
    document.body.appendChild(p);
    $("tutor-close").onclick = () => { S.open = false; render(); };
    $("tutor-off").onclick = turnOff;
    $("tutor-igpu").checked = Boolean(store.get("df_tutor_igpu", false));
    $("tutor-igpu").onchange = (e) => store.set("df_tutor_igpu", e.target.checked);
    $("tutor-form").onsubmit = (e) => {
      e.preventDefault();
      if (S.busy && S.abort) { S.abort.abort(); return; }
      const i = $("tutor-input"), q = i.value; i.value = ""; ask(q);
    };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open && $("search-overlay").hidden) { S.open = false; render(); } });
  }

  function setup() {
    const cmd = (c) => "<code class='tutor-cmd'>" + esc(c) + "</code>";
    const m = model();
    switch (S.phase) {
      case "checking": case "starting":
        return "<p>" + esc(S.phase === "checking" ? L("Memeriksa tutor…", "Checking the tutor…") : L("Menyalakan tutor di komputer Anda… (beberapa detik)", "Starting the tutor on your computer… (a few seconds)")) + "</p>";
      case "no-install":
        return "<p><strong>" + esc(L("Langkah 1 dari 2: pasang Ollama (sekali per komputer).", "Step 1 of 2: install Ollama (once per computer).")) + "</strong> " +
          esc(L("Ollama adalah program gratis yang menjalankan model AI di komputer Anda sendiri.", "Ollama is a free program that runs AI models on your own computer.")) + "</p>" +
          "<ul class='tutor-steps'><li><strong>Windows / macOS:</strong> " + esc(L("unduh pemasangnya dari ", "download the installer from ")) + "<code>ollama.com/download</code></li>" +
          "<li><strong>Linux:</strong> " + cmd("curl -fsSL https://ollama.com/install.sh | sh") + "</li></ul>" +
          "<p class='muted small'>" + esc(L("Lalu tutup dan buka lagi terminal tempat Anda menjalankan kursus, jalankan ulang kursus, dan klik Tutor lagi. Cek: ", "Then close and reopen the terminal you run the course from, start the course again and click Tutor again. Check: ")) + "<code>ollama --version</code></p>" +
          "<button class='btn' id='tutor-retry'>" + esc(L("Sudah terpasang, coba lagi", "Installed, try again")) + "</button>";
      case "manual":
        return "<p><strong>" + esc(L("Jalankan Ollama sendiri.", "Start Ollama yourself.")) + "</strong> " + esc(L("Halaman ini tidak dapat menjalankannya (kursus dibuka tanpa server aplikasinya). Di terminal lain:", "This page cannot start it (the course was opened without its app server). In another terminal:")) + "</p>" + cmd("ollama serve") +
          "<p class='muted small'>" + esc(L("Disarankan memulai kursus dengan ", "It is best to start the course with ")) + "<code>npm start</code> " + esc(L("agar tombol ini bisa menyalakannya sendiri.", "so this button can start it for you.")) + "</p>" +
          "<button class='btn' id='tutor-retry'>" + esc(L("Coba lagi", "Try again")) + "</button>";
      case "no-model":
        return "<p><strong>" + esc(L("Satu langkah lagi: unduh modelnya (sekali saja).", "One more step: download the model (one time only).")) + "</strong> " +
          esc(L("Ukurannya sekitar 2 GB dan butuh internet. Setelah itu semuanya offline.", "It is about 2 GB and needs internet. After that everything is offline.")) + "</p>" +
          "<button class='btn btn-primary' id='tutor-pull'>" + esc(L("Unduh model ", "Download model ")) + esc(m) + "</button>" +
          "<p class='muted small'>" + esc(L("Atau di terminal: ", "Or in a terminal: ")) + "<code>ollama pull " + esc(m) + "</code></p>";
      case "pulling":
        return "<p>" + esc(L("Mengunduh model… jangan tutup halaman ini.", "Downloading the model… keep this page open.")) + "</p><progress id='tutor-bar' max='100' value='" + S.pull + "'></progress> <span id='tutor-pct'>" + S.pull + "%</span>";
      case "error":
        return "<p><strong>" + esc(L("Tutor tidak bisa menyala.", "The tutor could not start.")) + "</strong> " + esc(L("Coba di terminal: ", "Try in a terminal: ")) + "<code>ollama serve</code></p>" +
          "<button class='btn' id='tutor-retry'>" + esc(L("Coba lagi", "Try again")) + "</button>";
      default: return "";
    }
  }

  function render() {
    const btn = $("tutor-btn");
    const state = !S.on ? "off" : S.phase === "ready" ? "ready" : (S.phase === "checking" || S.phase === "starting" || S.phase === "pulling") ? "wait" : "problem";
    if (btn) {
      btn.dataset.state = state;
      btn.setAttribute("aria-pressed", String(S.on));
      btn.title = S.on ? L("Tutor AI: nyala (klik untuk membuka)", "AI tutor: on (click to open)") : L("Tutor AI: mati (klik untuk menyalakan)", "AI tutor: off (click to turn on)");
      const lab = $("tutor-btn-label"); if (lab) lab.textContent = L("Tutor", "Tutor");
    }
    const p = $("tutor-panel");
    if (!p) return;
    p.hidden = !(S.open && S.on);
    p.dataset.phase = S.phase;
    $("tutor-title").textContent = L("Tutor kursus", "Course tutor");
    $("tutor-status").textContent = { ready: L("● nyala, offline", "● on, offline"), wait: "…", problem: L("● perlu perhatian", "● needs attention"), off: "" }[state];
    $("tutor-status").dataset.state = state;
    const su = $("tutor-setup"), html = setup();
    if (su.dataset.k !== S.phase + S.detail + lang() || S.phase === "pulling") { su.innerHTML = html; su.dataset.k = S.phase + S.detail + lang(); }
    su.hidden = !html;
    const retry = $("tutor-retry"); if (retry) retry.onclick = ensure;
    const pull = $("tutor-pull"); if (pull) pull.onclick = pullModel;
    const ready = S.phase === "ready";
    $("tutor-log").hidden = !ready; $("tutor-form").hidden = !ready;
    $("tutor-input").placeholder = L("Tanya apa saja tentang materi kursus…", "Ask anything about the course…");
    $("tutor-input").disabled = false;
    $("tutor-send").textContent = S.busy ? L("Berhenti", "Stop") : L("Kirim", "Ask");
    const f = focusLesson();
    $("tutor-ctx").textContent = ready && f ? L("Sedang membaca: Modul ", "Reading now: Module ") + modNo(f.mod) + L(", pelajaran ", ", lesson ") + f.lesson : "";
    $("tutor-note").textContent = L("Jawaban dari materi kursus. Model kecil bisa salah: percayai pelajarannya.", "Answers come from the course. A small model can be wrong: trust the lesson.");
    $("tutor-off").textContent = L("Matikan tutor", "Turn tutor off");
    $("tutor-igpu-l").textContent = L("Pakai chip grafis (bisa lebih cepat; berlaku saat tutor dinyalakan berikutnya)", "Use the graphics chip (can be faster; applies the next time you turn the tutor on)");
    if (ready && !$("tutor-log").children.length) addMsg("bot", esc(L("Halo! Tanyakan apa saja tentang materi. Contoh: “apa itu backfill?”", "Hi! Ask me anything about the lessons. For example: “what is a backfill?”")));
  }

  window.tutor = {
    onHeaderClick() {
      ensurePanel();
      if (!S.on) return turnOn();
      S.open = !S.open; render();
      if (S.open && S.phase !== "ready" && !["checking", "starting", "pulling"].includes(S.phase)) ensure();
    },
    // "Ask the teacher" in a lesson: open the tutor (turning it on and walking through the setup when needed) and ask this question.
    // When the model is not ready yet, the question waits in the input box so one press of Send asks it.
    async askAbout(q) {
      ensurePanel();
      if (!S.on) await turnOn();
      else { S.open = true; render(); if (S.phase !== "ready" && !["checking", "starting", "pulling"].includes(S.phase)) await ensure(); }
      if (S.phase === "ready") return ask(q);
      const i = $("tutor-input"); if (i) i.value = q;
    },
    turnOn, turnOff, core,
    _state: S,
  };

  function boot() {
    ensurePanel();
    render();
    if (S.on) ensure(); // left on last time: bring it back quietly
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    window.addEventListener("hashchange", render);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
