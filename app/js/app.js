// DataForge application controller.
// Hash routing (#/curriculum/mod-1-3/lab), bilingual ID/EN, progress stored in localStorage.

const REPO_URL = "https://github.com/triutama133/DECourse";
const VIEWS = ["start", "roadmap", "curriculum", "interview", "portfolio", "cv-builder", "playground", "readiness", "remote-playbook"];
const MODULE_TABS = ["concepts", "lab", "chaos", "quiz"];
const INTERVIEW_TABS = ["system-design", "sql-arena", "incidents"];

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function writeStore(key, value) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch (e) { /* storage unavailable (private mode): keep working in memory */ }
}

class DataForgeApp {
  constructor() {
    this.currentView = "start";
    this.activeLevelId = "zero";
    this.activeModuleId = "mod-0-1";
    this.activeModuleTab = "concepts";
    this.activeInterviewTab = "system-design";
    this.activeSystemDesignId = "sd-1";
    this.activeSqlId = "sql-1";
    this.activeDrillId = "drill-1";
    this.activePortfolioId = "proj-1";

    this.completedModules = readStore("df_completed_modules", []);
    this.quizScores = readStore("df_quiz_scores", {});
    this.solvedChallenges = readStore("df_solved_challenges", []);
    this.resumeEdited = readStore("df_resume_edited", false);
    this.resumeData = readStore("df_resume_data", null) || JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    const savedLang = readStore("df_lang", "id");
    this.lang = savedLang === "en" ? "en" : "id";

    this.quizOrder = {};      // moduleId -> shuffled option order (per page load)
    this.sandbox = { datasetKey: "ecommerce", challengeId: null, status: "loading", message: null, result: null, hintOpen: false, solutionOpen: false };

    this.renderChrome();
    window.addEventListener("hashchange", () => this.readHash(true));
    document.addEventListener("keydown", (e) => this.globalKey(e));
    this.readHash();
  }

  // ---------- helpers ----------
  t(val) {
    if (!val) return "";
    if (typeof val === "object") return val[this.lang] || val.id || val.en || "";
    return val;
  }
  tr(key) {
    const dict = (window.TRANSLATIONS && (window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id)) || {};
    return dict[key] || key;
  }
  l(id, en) { return this.lang === "id" ? id : en; }

  esc(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  // Escape first, then allow only **bold** and `code`.
  rich(str) {
    return this.esc(this.t(str)).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  escapeHtml(s) { return this.esc(s); }

  // Small Markdown renderer: paragraphs, lists, tables, fenced code, callouts, inline code/bold/italic/links.
  // Everything is escaped before any tag is produced.
  inline(s) {
    return String(s).split(/(`[^`]+`)/).map((part) => {
      if (part.length > 1 && part[0] === "`" && part[part.length - 1] === "`") return `<code>${this.esc(part.slice(1, -1))}</code>`;
      return this.esc(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![\w*])/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }).join("");
  }
  md(val) {
    const src = this.t(val);
    if (!src) return "";
    const lines = String(src).replace(/\r\n/g, "\n").split("\n");
    const out = [];
    const isBullet = (l) => /^\s*[-*] /.test(l);
    const isOrdered = (l) => /^\s*\d+\. /.test(l);
    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; continue; }
      let m;
      if ((m = line.match(/^```\s*(\S*)\s*$/))) {
        const body = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(`<div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)" aria-label="${this.l("Salin kode", "Copy code")}">${this.l("Salin", "Copy")}</button><pre${m[1] ? ` data-lang="${this.esc(m[1])}"` : ""}><code>${this.esc(body.join("\n"))}</code></pre></div>`);
      } else if ((m = line.match(/^(#{3,4}) (.+)$/))) {
        out.push(`<h4 class="md-h">${this.inline(m[2])}</h4>`); i++;
      } else if (/^---+\s*$/.test(line)) {
        out.push("<hr>"); i++;
      } else if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
        out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${this.inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="white-space:normal">${this.inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      } else if (/^> ?/.test(line)) {
        const q = [];
        while (i < lines.length && /^> ?/.test(lines[i])) q.push(lines[i++].replace(/^> ?/, ""));
        const first = q[0] || "";
        const kind = /^\*\*(Warning|Peringatan|Pitfall|Jebakan)/i.test(first) ? "danger" : /^\*\*(Tip|Saran)/i.test(first) ? "success" : "";
        out.push(`<div class="callout ${kind}">${q.join("\n").split(/\n{2,}/).map((p) => `<p>${this.inline(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`);
      } else if (isBullet(line) || isOrdered(line)) {
        const ordered = isOrdered(line);
        const start = ordered ? parseInt(line.match(/^\s*(\d+)\./)[1], 10) : 1;
        const items = [];
        while (i < lines.length && (ordered ? isOrdered(lines[i]) : isBullet(lines[i]))) {
          const item = [lines[i].replace(/^\s*(?:[-*]|\d+\.) /, "")];
          i++;
          while (i < lines.length && lines[i].trim() !== "" && /^\s{2,}\S/.test(lines[i]) && !isBullet(lines[i]) && !isOrdered(lines[i])) item.push(lines[i++].trim());
          items.push(item.join(" "));
        }
        const tag = ordered ? "ol" : "ul";
        out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ""}>${items.map((it) => `<li>${this.inline(it)}</li>`).join("")}</${tag}>`);
      } else {
        const p = [];
        while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^#{3,4} /.test(lines[i]) && !isBullet(lines[i]) && !isOrdered(lines[i]) && !/^> ?/.test(lines[i]) && !isTableRow(lines[i])) p.push(lines[i++]);
        if (!p.length) { p.push(lines[i++]); }
        out.push(`<p>${p.map((x) => this.inline(x)).join("<br>")}</p>`);
      }
    }
    return `<div class="md">${out.join("")}</div>`;
  }

  // ---------- routing ----------
  readHash(focusMain) {
    const parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const view = VIEWS.includes(parts[0]) ? parts[0] : (readStore("df_visited", false) ? "roadmap" : "start");
    writeStore("df_visited", true);
    this.closeMenu();
    this.currentView = view;
    if (view === "curriculum") {
      const lvl = CURRICULUM_DATA.find((L) => L.modules.some((m) => m.id === parts[1]));
      if (lvl) { this.activeLevelId = lvl.levelId; this.activeModuleId = parts[1]; }
      this.activeModuleTab = MODULE_TABS.includes(parts[2]) ? parts[2] : "concepts";
    }
    if (view === "interview" && INTERVIEW_TABS.includes(parts[1])) this.activeInterviewTab = parts[1];
    this.renderChrome();
    this.renderView();
    window.scrollTo(0, 0);
    if (focusMain) document.getElementById("main-content").focus({ preventScroll: true });
  }
  go(view, ...rest) {
    const hash = "#/" + [view, ...rest].join("/");
    if (location.hash === hash) this.readHash(); else location.hash = hash;
  }
  switchView(view) { this.go(view); }

  // ---------- chrome (header/nav/footer) ----------
  renderChrome() {
    const labels = {
      "start": this.l("Mulai di sini", "Start here"),
      "roadmap": this.tr("navRoadmap"), "curriculum": this.tr("navCurriculum"), "interview": this.tr("navInterview"),
      "portfolio": this.tr("navPortfolio"), "cv-builder": this.tr("navCvBuilder"), "playground": this.tr("navPlayground"),
      "readiness": this.tr("navReadiness"), "remote-playbook": this.tr("navRemote")
    };
    document.getElementById("nav").innerHTML = VIEWS.map((v) =>
      `<button class="${v === this.currentView ? "active" : ""}"${v === this.currentView ? ' aria-current="page"' : ""} onclick="app.go('${v}')">${this.esc(labels[v])}</button>`).join("");
    document.getElementById("search-btn-label").textContent = this.l("Cari", "Search");
    document.getElementById("search-btn").setAttribute("aria-label", this.l("Cari di seluruh kursus (Ctrl+K)", "Search the course (Ctrl+K)"));
    document.getElementById("menu-toggle").setAttribute("aria-label", this.l("Menu", "Menu"));
    document.getElementById("footer-note").textContent = this.l("Progres tersimpan hanya di browser ini.", "Progress is stored only in this browser.");
    document.getElementById("footer-export").textContent = this.l("Ekspor progres", "Export progress");
    document.getElementById("footer-import").textContent = this.l("Impor progres", "Import progress");
    document.documentElement.lang = this.lang;
    document.getElementById("lang-btn-id").className = this.lang === "id" ? "active" : "";
    document.getElementById("lang-btn-en").className = this.lang === "en" ? "active" : "";
    document.getElementById("footer-tagline").textContent = this.l("DataForge: belajar data engineering dengan praktik langsung", "DataForge: learn data engineering by doing");
    this.renderHeaderStats();
  }

  renderHeaderStats() {
    const total = CURRICULUM_DATA.reduce((n, lvl) => n + lvl.modules.length, 0);
    const done = this.completedModules.length;
    const pct = Math.round((done / total) * 100);
    document.getElementById("header-stats").innerHTML = `
      <div style="cursor:pointer" onclick="app.go('readiness')" title="${this.l('Buka Dashboard Kesiapan Kerja & Evaluasi Skill', 'Open Job Readiness & Skill Dashboard')}">
        <span>${done} ${this.tr("modulesOf")} ${total} ${this.tr("modulesCompleted")}</span>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${this.l("Progres modul", "Module progress")}"><div style="width:${pct}%"></div></div>
      </div>`;
  }

  toggleMenu() {
    const nav = document.getElementById("nav");
    const open = nav.classList.toggle("open");
    document.getElementById("menu-toggle").setAttribute("aria-expanded", String(open));
  }
  closeMenu() {
    const nav = document.getElementById("nav");
    if (nav) nav.classList.remove("open");
    const t = document.getElementById("menu-toggle");
    if (t) t.setAttribute("aria-expanded", "false");
  }

  setLanguage(lang) {
    this.lang = lang;
    writeStore("df_lang", lang);
    this.renderChrome();
    this.renderView();
  }

  renderView() {
    const container = document.getElementById("main-content");
    const views = {
      "start": () => this.renderStartView(),
      "roadmap": () => this.renderRoadmapView(),
      "curriculum": () => this.renderCurriculumView(),
      "interview": () => this.renderInterviewView(),
      "portfolio": () => this.renderPortfolioView(),
      "cv-builder": () => this.renderCvBuilderView(),
      "playground": () => this.renderPlaygroundView(),
      "readiness": () => this.renderReadinessView(),
      "remote-playbook": () => this.renderRemotePlaybookView()
    };
    container.innerHTML = views[this.currentView]();
    if (this.currentView === "playground") this.afterPlaygroundRender();
  }

  // ================= IN-BROWSER PYTHON LABS (Pyodide, in a Web Worker) =================
  browserLabCard(modId) {
    const bl = window.BROWSER_LABS && window.BROWSER_LABS[modId];
    if (!bl) return "";
    const draft = readStore("df_bl_" + modId, null);
    const code = typeof draft === "string" ? draft : bl.starter;
    const passed = (readStore("df_browser_labs", {}) || {})[modId];
    const last = (this._blOut && this._blOut[modId]) || {};
    return `
      <div class="card browser-lab stack-sm" id="browser-lab">
        <div class="row between">
          <h3>${this.l("Kerjakan di browser (tanpa instalasi)", "Do it in your browser (no setup)")}</h3>
          ${passed ? `<span class="state-done" id="bl-passed">✓ ${this.l("Tes lulus di browser", "Passed in the browser")}</span>` : `<span id="bl-passed"></span>`}
        </div>
        <p class="small muted">${this.esc(this.t(bl.note))}</p>
        <label class="label" for="bl-code"><code>${this.esc(bl.editable)}</code></label>
        <textarea id="bl-code" class="bl-code" rows="18" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="bl-hint"
          oninput="app.saveBlDraft('${modId}', this.value)" onkeydown="app.blKey(event, '${modId}')">${this.esc(code)}</textarea>
        <p class="small muted" id="bl-hint">${this.l("Tab menambah indentasi; tekan Esc lalu Tab untuk keluar dari kotak ini. Ctrl+Enter menjalankan tes. Pekerjaan Anda tersimpan otomatis di browser ini.", "Tab indents; press Esc then Tab to leave this box. Ctrl+Enter runs the tests. Your work is saved automatically in this browser.")}</p>
        <div class="row">
          <button class="btn btn-primary" id="bl-run" onclick="app.runBrowserLab('${modId}')">${this.l("Jalankan tes", "Run tests")}</button>
          <button class="btn btn-quiet" onclick="app.resetBrowserLab('${modId}')">${this.l("Kembalikan ke kode awal", "Reset to starter code")}</button>
          <span class="small muted" id="bl-status" role="status" aria-live="polite">${last.status || ""}</span>
        </div>
        <div id="bl-summary" aria-live="polite">${last.summary || ""}</div>
        <pre class="bl-out" id="bl-out"${last.out ? "" : " hidden"}>${this.esc(last.out || "")}</pre>
        <details class="file"><summary>${this.l("Lihat solusi referensi", "Show the reference solution")} <span class="muted small">${this.l("(coba sendiri dulu)", "(try it yourself first)")}</span></summary>
          <pre><code>${this.esc(bl.reference)}</code></pre></details>
      </div>`;
  }
  saveBlDraft(modId, value) {
    clearTimeout(this._blSave);
    this._blSave = setTimeout(() => writeStore("df_bl_" + modId, value), 400);
  }
  blKey(e, modId) {
    if (e.key === "Escape") { this._blEsc = true; return; }
    if (e.key === "Tab" && !e.shiftKey && !this._blEsc) {
      e.preventDefault();
      const t = e.target, a = t.selectionStart, b = t.selectionEnd;
      t.value = t.value.slice(0, a) + "    " + t.value.slice(b);
      t.selectionStart = t.selectionEnd = a + 4;
      this.saveBlDraft(modId, t.value);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.runBrowserLab(modId); }
    if (e.key !== "Escape") this._blEsc = false;
  }
  resetBrowserLab(modId) {
    const bl = window.BROWSER_LABS[modId];
    if (!window.confirm(this.l("Kembalikan ke kode awal? Perubahan Anda di kotak ini akan hilang.", "Reset to the starter code? Your changes in this box will be lost."))) return;
    writeStore("df_bl_" + modId, bl.starter);
    document.getElementById("bl-code").value = bl.starter;
  }
  blStatus(modId, status, summary, out) {
    this._blOut = this._blOut || {};
    this._blOut[modId] = { status, summary, out };
    const set = (id, html, text) => { const el = document.getElementById(id); if (el) { if (text) el.textContent = html; else el.innerHTML = html; } };
    set("bl-status", status, true);
    set("bl-summary", summary || "");
    const pre = document.getElementById("bl-out");
    if (pre) { pre.textContent = out || ""; pre.hidden = !out; }
  }
  runBrowserLab(modId) {
    const bl = window.BROWSER_LABS[modId];
    const area = document.getElementById("bl-code");
    if (!bl || !area) return;
    if (this._blBusy) return;
    if (!window.Worker || location.protocol === "file:") {
      this.blStatus(modId, "", `<div class="feedback bad">${this.l("Browser ini tidak bisa menjalankan Python di halaman yang dibuka dari file. Jalankan situs dengan python3 server.py lalu buka http://localhost:3000.", "This browser cannot run Python on a page opened from a file. Run the site with python3 server.py and open http://localhost:3000.")}</div>`, "");
      return;
    }
    writeStore("df_bl_" + modId, area.value);
    const btn = document.getElementById("bl-run");
    this._blBusy = true;
    if (btn) btn.disabled = true;
    const id = (this._blId = (this._blId || 0) + 1);
    const finish = () => { this._blBusy = false; clearTimeout(this._blTimer); const b = document.getElementById("bl-run"); if (b) b.disabled = false; };
    const kill = (msg) => {
      if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; }
      finish();
      this.blStatus(modId, "", `<div class="feedback bad">${msg}</div>`, "");
    };
    if (!this._blWorker) {
      try { this._blWorker = new Worker("js/pyodide-worker.js", { type: "module" }); }
      catch (e) { kill(this.l("Tidak bisa memulai Python di browser ini.", "Could not start Python in this browser.")); return; }
    }
    const w = this._blWorker;
    const loadingTxt = { "loading-python": this.l("Memuat Python (sekitar 12 MB, hanya sekali)…", "Loading Python (about 12 MB, only once)…"), "loading-pytest": this.l("Memuat pytest…", "Loading pytest…"), "running": this.l("Menjalankan tes…", "Running tests…") };
    this.blStatus(modId, loadingTxt["loading-python"], "", "");
    this._blTimer = setTimeout(() => kill(this.l("Memuat Python terlalu lama. Periksa koneksi lalu coba lagi.", "Loading Python took too long. Check your connection and try again.")), 240000);
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "status") {
        this.blStatus(modId, loadingTxt[m.text] || "", "", "");
        if (m.text === "running") { clearTimeout(this._blTimer); this._blTimer = setTimeout(() => kill(this.l("Tes berjalan lebih dari 60 detik, jadi dihentikan. Kode Anda mungkin berulang tanpa henti (infinite loop). Periksa perulangan <code>while</code>, lalu jalankan lagi.", "The tests ran for over 60 seconds, so they were stopped. Your code may loop forever (an infinite loop). Check your <code>while</code> loops, then run again.")), 60000); }
      } else if (m.type === "result" && m.id === id) {
        finish();
        const lines = String(m.output).trim().split("\n").filter(Boolean);
        const last = lines[lines.length - 1] || "";
        const num = (re) => { const x = last.match(re); return x ? parseInt(x[1], 10) : 0; };
        const passed = num(/(\d+) passed/), failed = num(/(\d+) failed/), errors = num(/(\d+) errors?/);
        let summary;
        if (m.code === 0 && passed > 0) {
          const done = readStore("df_browser_labs", {}) || {};
          done[modId] = new Date().toISOString();
          writeStore("df_browser_labs", done);
          const mark = document.getElementById("bl-passed");
          if (mark) { mark.className = "state-done"; mark.textContent = "✓ " + this.l("Tes lulus di browser", "Passed in the browser"); }
          summary = `<div class="feedback ok">✓ ${this.l(`Semua ${passed} tes lulus. Lanjutkan ke tab Chaos dan Kuis.`, `All ${passed} tests pass. Continue with the Chaos and Quiz tabs.`)}</div>`;
        } else {
          summary = `<div class="feedback bad">${this.l(`${passed} lulus, ${failed} gagal, ${errors} error. Baca pesan di bawah dari baris paling bawah ke atas, perbaiki satu fungsi, lalu jalankan lagi.`, `${passed} passed, ${failed} failed, ${errors} errors. Read the messages below from the bottom up, fix one function, then run again.`)}</div>`;
        }
        const out = String(m.output).replace(/\/lab\//g, "");
        this.blStatus(modId, "", summary, out.length > 8000 ? "…\n" + out.slice(-8000) : out);
      } else if (m.type === "error" && m.id === id) {
        if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; }
        finish();
        this.blStatus(modId, "", `<div class="feedback bad">${this.l("Python gagal dimulai:", "Python failed to start:")} ${this.esc(m.message)}</div>`, "");
      }
    };
    w.onerror = (e) => kill(this.l("Python gagal dimuat. Muat ulang halaman dan coba lagi.", "Python failed to load. Reload the page and try again.") + " " + this.esc(e.message || ""));
    const files = Object.assign({}, bl.files, { [bl.editable]: area.value });
    w.postMessage({ type: "run", id, files, args: bl.tests });
  }

  // ================= TOOLS: copy, search, export/import =================
  copyText(text, btn) {
    const done = () => { if (btn) { const old = btn.textContent; btn.textContent = this.l("Tersalin", "Copied"); setTimeout(() => { btn.textContent = old; }, 1200); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta); done();
    }
  }
  copyCode(btn) {
    const code = btn.parentElement.querySelector("code");
    this.copyText(code ? code.textContent : "", btn);
  }

  globalKey(e) {
    const overlay = document.getElementById("search-overlay");
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); this.openSearch(); }
    else if (e.key === "/" && !typing && overlay.hidden) { e.preventDefault(); this.openSearch(); }
    else if (e.key === "Escape" && !overlay.hidden) this.closeSearch();
  }
  stripMd(text) {
    return String(text || "").replace(/```[a-z]*\n?/g, " ").replace(/[*`#|>_]/g, " ").replace(/\s+/g, " ").trim();
  }
  searchIndex() {
    this._searchIdx = this._searchIdx || {};
    if (this._searchIdx[this.lang]) return this._searchIdx[this.lang];
    const idx = [];
    for (const lvl of CURRICULUM_DATA) for (const m of lvl.modules) {
      const mt = `${m.number} ${this.t(m.title)}`;
      idx.push({ mod: m.id, kind: "module", i: 0, title: mt, modTitle: mt, text: this.stripMd(`${this.t(m.summary)} ${(m.outcomes || []).map((o) => this.t(o)).join(" ")}`) });
      (m.lessons || []).forEach((l, i) => idx.push({ mod: m.id, kind: "lesson", i, title: this.t(l.title), modTitle: mt, text: this.stripMd(this.t(l.body)) }));
      if (m.chaosLab) idx.push({ mod: m.id, kind: "chaos", i: 0, title: this.t(m.chaosLab.title), modTitle: mt,
        text: this.stripMd([m.chaosLab.scenario, m.chaosLab.breakageReason, m.chaosLab.fixGuide, m.chaosLab.defensivePattern].map((x) => this.t(x)).join(" ")) });
    }
    idx.forEach((e) => { e.hayTitle = (e.title + " " + e.modTitle).toLowerCase(); e.hay = e.text.toLowerCase(); });
    this._searchIdx[this.lang] = idx;
    return idx;
  }
  openSearch() {
    const o = document.getElementById("search-overlay");
    const input = document.getElementById("search-input");
    this._searchReturn = document.activeElement;
    o.hidden = false;
    input.value = "";
    input.placeholder = this.l('Cari di semua modul, mis. "watermark", "idempoten", "grain"', 'Search all modules, e.g. "watermark", "idempotent", "grain"');
    document.getElementById("search-foot").textContent = this.l("Enter: buka · ↑ ↓: pilih · Esc: tutup", "Enter: open · ↑ ↓: move · Esc: close");
    this.runSearch("");
    input.focus();
  }
  closeSearch() {
    document.getElementById("search-overlay").hidden = true;
    if (this._searchReturn && this._searchReturn.focus) this._searchReturn.focus();
  }
  runSearch(q) {
    const box = document.getElementById("search-results");
    const tokens = String(q).toLowerCase().split(/\s+/).filter((x) => x.length > 1);
    this._searchSel = 0;
    if (!tokens.length) { box.innerHTML = `<p class="muted small" style="padding:12px 16px">${this.l("Ketik minimal 2 huruf. Pencarian mencakup judul dan isi materi, serta skenario chaos.", "Type at least 2 letters. Search covers titles, lesson text and chaos scenarios.")}</p>`; this._hits = []; return; }
    const hits = [];
    for (const e of this.searchIndex()) {
      if (!tokens.every((t) => e.hayTitle.includes(t) || e.hay.includes(t))) continue;
      let score = 0;
      for (const t of tokens) {
        if (e.title.toLowerCase().includes(t)) score += 10;
        if (e.modTitle.toLowerCase().includes(t)) score += 3;
        score += Math.min(5, e.hay.split(t).length - 1);
      }
      if (e.kind === "module") score += 1;
      hits.push({ e, score });
    }
    hits.sort((a, b) => b.score - a.score);
    this._hits = hits.slice(0, 12).map((h) => h.e);
    const mark = (txt) => {
      let out = this.esc(txt);
      for (const t of tokens) out = out.replace(new RegExp(this.esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
      return out;
    };
    const kindLabel = { module: this.l("Modul", "Module"), lesson: this.l("Materi", "Lesson"), chaos: "Chaos" };
    box.innerHTML = this._hits.length ? this._hits.map((e, n) => {
      const pos = Math.max(0, e.hay.indexOf(tokens[0]));
      const snippet = e.text.slice(Math.max(0, pos - 50), pos + 130);
      return `<button class="search-hit${n === 0 ? " sel" : ""}" role="option" data-n="${n}" onclick="app.openHit(${n})">
        <div class="t">${mark(e.title)}</div><div class="m">${kindLabel[e.kind]} · ${this.esc(e.modTitle)}</div>
        ${e.kind === "module" ? "" : `<div class="s">…${mark(snippet)}…</div>`}</button>`;
    }).join("") : `<p class="muted small" style="padding:12px 16px">${this.l("Tidak ada hasil. Coba kata lain atau ejaan bahasa Inggris.", "No results. Try another word.")}</p>`;
  }
  searchKey(e) {
    const n = (this._hits || []).length;
    if (!n) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      this._searchSel = (this._searchSel + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      document.querySelectorAll(".search-hit").forEach((el, i) => el.classList.toggle("sel", i === this._searchSel));
      const el = document.querySelectorAll(".search-hit")[this._searchSel];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); this.openHit(this._searchSel); }
  }
  openHit(n) {
    const e = (this._hits || [])[n];
    if (!e) return;
    this.closeSearch();
    this.go("curriculum", e.mod, e.kind === "chaos" ? "chaos" : "concepts");
    if (e.kind === "lesson") setTimeout(() => this.scrollToLesson(e.i), 60);
  }

  exportProgress() {
    const keys = ["df_completed_modules", "df_quiz_scores", "df_solved_challenges", "df_resume_edited", "df_resume_data", "df_lang", "df_browser_labs"];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^df_bl_mod-\d-\d$/.test(k)) keys.push(k); } } catch (e) { /* storage unavailable */ }
    const data = { format: "dataforge-progress", version: 1, exportedAt: new Date().toISOString() };
    keys.forEach((k) => { const v = readStore(k, undefined); if (v !== undefined) data[k] = v; });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dataforge-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  importProgress(input) {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || d.format !== "dataforge-progress") throw new Error("format");
        const ids = new Set(CURRICULUM_DATA.flatMap((l) => l.modules.map((m) => m.id)));
        if (Array.isArray(d.df_completed_modules)) this.completedModules = d.df_completed_modules.filter((x) => ids.has(x));
        if (d.df_quiz_scores && typeof d.df_quiz_scores === "object" && !Array.isArray(d.df_quiz_scores)) this.quizScores = d.df_quiz_scores;
        if (Array.isArray(d.df_solved_challenges)) this.solvedChallenges = d.df_solved_challenges.filter((x) => typeof x === "string");
        if (typeof d.df_resume_edited === "boolean") this.resumeEdited = d.df_resume_edited;
        if (d.df_resume_data && typeof d.df_resume_data === "object") this.resumeData = d.df_resume_data;
        writeStore("df_completed_modules", this.completedModules);
        writeStore("df_quiz_scores", this.quizScores);
        writeStore("df_solved_challenges", this.solvedChallenges);
        writeStore("df_resume_edited", this.resumeEdited);
        writeStore("df_resume_data", this.resumeData);
        if (d.df_browser_labs && typeof d.df_browser_labs === "object" && !Array.isArray(d.df_browser_labs)) writeStore("df_browser_labs", d.df_browser_labs);
        for (const k of Object.keys(d)) if (/^df_bl_mod-\d-\d$/.test(k) && typeof d[k] === "string" && d[k].length < 200000) writeStore(k, d[k]);
        this.renderChrome(); this.renderView();
        alert(this.l("Progres berhasil diimpor.", "Progress imported."));
      } catch (e) {
        alert(this.l("File tidak valid: pilih file hasil Ekspor progres dari DataForge.", "Invalid file: choose a file created by DataForge's Export progress."));
      }
    };
    reader.readAsText(file);
  }

  // ================= START HERE =================
  renderStartView() {
    const cmd = (text) => `<div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(text)}</code></pre></div>`;
    const step = (n, title, body) => `<div class="card start-step"><div class="num" aria-hidden="true">${n}</div><div class="stack-sm"><h2>${title}</h2>${body}</div></div>`;
    const repo = REPO_URL;
    return `
      <div class="stack">
        <div class="card stack-sm">
          <span class="chip chip-blue">${this.l("Sekali saja, 30 sampai 60 menit", "Once only, 30 to 60 minutes")}</span>
          <h1>${this.l("Mulai di sini: dari nol sampai lab pertama yang berjalan", "Start here: from zero to your first running lab")}</h1>
          <p class="muted" style="max-width:760px;font-size:15px">${this.l(
            "Kursus ini dipelajari dengan menjalankan kode, bukan hanya membaca. Halaman ini membawa Anda ke titik di mana lab pertama berjalan di komputer Anda. Anda tidak perlu pengalaman sebelumnya. Kalau ada langkah yang macet, itu bukan salah Anda: lihat bagian \"Kalau macet\" di bawah.",
            "You learn this course by running code, not only by reading. This page takes you to the point where the first lab runs on your computer. You do not need any experience. If a step gets stuck, it is not your fault: see \"If you get stuck\" below.")}</p>
          <div class="callout"><p>${this.l("Tanpa instalasi apa pun, di browser ini Anda sudah bisa membaca semua materi, memakai SQL Sandbox, dan mengerjakan lab Python Modul 0.1 (serta bagian Python-murni di Modul 3.2, 3.3, dan 3.4) dengan tes asli. Instalasi diperlukan untuk lab lain dan untuk belajar memakai terminal.", "With nothing installed, you can already read every lesson, use the SQL Sandbox, and do the Module 0.1 Python lab (plus the plain-Python parts of Modules 3.2, 3.3 and 3.4) with the real tests, all in this browser. Setup is needed for the other labs and to learn the terminal.")}</p></div>
        </div>

        ${step(1, this.l("Pilih tempat Anda bekerja", "Choose where you work"), `
          <div class="grid cols-2">
            <div class="well stack-sm">
              <strong>${this.l("A. Di cloud, tanpa instal (paling mudah)", "A. In the cloud, nothing to install (easiest)")}</strong>
              <p class="small muted">${this.l("GitHub Codespaces membuka editor kode lengkap di browser dengan Python dan semua alat sudah terpasang. Perlu akun GitHub gratis; ada kuota jam gratis per bulan.", "GitHub Codespaces opens a full code editor in your browser with Python and the tools already installed. It needs a free GitHub account and has a free monthly hours quota.")}</p>
              <a class="btn btn-primary" href="https://codespaces.new/${repo.replace("https://github.com/", "")}" target="_blank" rel="noopener">${this.l("Buka di Codespaces", "Open in Codespaces")}</a>
              <p class="small muted">${this.l("Setelah terbuka, lompat ke langkah 3.", "Once it opens, skip to step 3.")}</p>
            </div>
            <div class="well stack-sm">
              <strong>${this.l("B. Di komputer Anda sendiri", "B. On your own computer")}</strong>
              <ul class="small" style="margin-left:18px">
                <li>${this.l("Linux, macOS, atau Windows 10/11 dengan WSL2 (Modul 0.2 menjelaskan WSL2)", "Linux, macOS, or Windows 10/11 with WSL2 (Module 0.2 explains WSL2)")}</li>
                <li>${this.l("Python 3.10 atau lebih baru", "Python 3.10 or newer")}</li>
                <li>${this.l("RAM 8 GB cukup untuk Level 0 sampai 2; 16 GB disarankan untuk Spark dan Kafka", "8 GB RAM is enough for Levels 0 to 2; 16 GB is recommended for Spark and Kafka")}</li>
                <li>${this.l("Sekitar 10 GB ruang disk bebas", "About 10 GB of free disk space")}</li>
              </ul>
            </div>
          </div>`)}

        ${step(2, this.l("Ambil file kursus (hanya untuk pilihan B)", "Get the course files (option B only)"), `
          <p>${this.l("File lab ada di folder <code>labs/</code> pada repositori kursus. Cara tercepat:", "The lab files live in the <code>labs/</code> folder of the course repository. Fastest way:")}</p>
          <p><strong>${this.l("Dengan Git", "With Git")}</strong> (${this.l("jika sudah terpasang; Modul 0.2 mengajarkannya", "if installed; Module 0.2 teaches it")}):</p>
          ${cmd(`git clone ${repo}.git\ncd DECourse`)}
          <p><strong>${this.l("Tanpa Git", "Without Git")}</strong>: <a href="${repo}/archive/refs/heads/main.zip" target="_blank" rel="noopener">${this.l("unduh ZIP", "download the ZIP")}</a>, ${this.l("ekstrak, lalu buka terminal di folder hasil ekstrak.", "extract it, then open a terminal in the extracted folder.")}</p>
          <p class="small muted">${this.l("Semua perintah di kursus ini dijalankan dari folder ini (disebut \"akar repositori\").", "Every command in this course is run from this folder (called the \"repository root\").")}</p>`)}

        ${step(3, this.l("Cek bahwa semuanya berjalan", "Check that everything works"), `
          ${cmd(`python3 --version\npython3 labs/shared/shopgen.py --out data\nls data`)}
          <p>${this.l("Baris pertama harus menampilkan Python 3.10 atau lebih baru. Baris kedua membuat data toko kopi fiktif KopiKu, dan <code>ls data</code> harus menampilkan file seperti <code>orders.csv</code> dan <code>manifest.json</code>. Jika ya, komputer Anda siap untuk Modul 0.1.", "The first line should show Python 3.10 or newer. The second creates the fictional KopiKu coffee-shop data, and <code>ls data</code> should list files such as <code>orders.csv</code> and <code>manifest.json</code>. If so, your computer is ready for Module 0.1.")}</p>
          <p class="small muted">${this.l("Pesan <code>command not found</code>? Di Linux/macOS coba <code>python</code> sebagai ganti <code>python3</code>. Di Windows pastikan Anda berada di terminal Ubuntu (WSL2), bukan PowerShell.", "<code>command not found</code>? On Linux/macOS try <code>python</code> instead of <code>python3</code>. On Windows make sure you are in the Ubuntu (WSL2) terminal, not PowerShell.")}</p>`)}

        ${step(4, this.l("Opsional: jalankan situs ini di komputer Anda", "Optional: run this site on your computer"), `
          ${cmd("python3 server.py")}
          <p class="small muted">${this.l("Lalu buka http://localhost:3000. Progres Anda disimpan di browser; gunakan Ekspor progres di bawah halaman untuk membuat cadangan.", "Then open http://localhost:3000. Your progress is stored in the browser; use Export progress in the page footer to make a backup.")}</p>`)}

        ${step(5, this.l("Mulai belajar", "Start learning"), `
          <p>${this.l("Setiap modul memiliki empat bagian, dikerjakan berurutan: <strong>Materi</strong> (baca), <strong>Lab</strong> (tulis kode sampai tes hijau), <strong>Chaos</strong> (pelajari kegagalan produksi nyata), dan <strong>Kuis</strong> (lulus dengan 80%).", "Every module has four parts, done in order: <strong>Lessons</strong> (read), <strong>Lab</strong> (write code until the tests pass), <strong>Chaos</strong> (study a real production failure), and <strong>Quiz</strong> (pass at 80%).")}</p>
          <ul style="margin-left:18px">
            <li>${this.l("Ritme yang disarankan: 5 sampai 8 jam per minggu. Seluruh kursus sekitar 45 minggu; Level 0 saja sekitar 4 sampai 5 minggu.", "Suggested pace: 5 to 8 hours per week. The whole course is about 45 weeks; Level 0 alone is about 4 to 5 weeks.")}</li>
            <li>${this.l("Jangan melompat. Lab adalah inti pembelajaran; membaca saja tidak membuat Anda mampu.", "Do not skip ahead. The lab is the core; reading alone will not make you able.")}</li>
            <li>${this.l("Tekan Ctrl+K (atau /) kapan saja untuk mencari istilah di seluruh materi.", "Press Ctrl+K (or /) at any time to search every lesson for a term.")}</li>
          </ul>
          <div class="row"><button class="btn btn-primary" onclick="app.go('curriculum','mod-0-1')">${this.l("Mulai Modul 0.1", "Start Module 0.1")}</button><button class="btn" onclick="app.go('playground')">${this.l("Coba SQL Sandbox dulu", "Try the SQL Sandbox first")}</button></div>`)}

        <div class="card stack-sm">
          <h2>${this.l("Kalau macet", "If you get stuck")}</h2>
          <ul style="margin-left:18px">
            <li>${this.l("Baca pesan error <strong>dari baris paling bawah</strong>. Jawabannya biasanya di sana (Modul 0.2 melatih ini).", "Read the error message <strong>from the bottom line</strong>. The answer is usually there (Module 0.2 trains this).")}</li>
            <li>${this.l("Coba sendiri minimal 30 menit sebelum melihat folder <code>reference/</code>. Setelah melihat, tutup dan tulis ulang dengan kata-kata Anda sendiri.", "Try for at least 30 minutes before looking at the <code>reference/</code> folder. After looking, close it and write it again in your own words.")}</li>
            <li>${this.l("Jalankan satu tes saja agar pesan error lebih pendek: <code>pytest labs/mod-0-1 -k parse_total -x</code>.", "Run one test only to get a shorter error: <code>pytest labs/mod-0-1 -k parse_total -x</code>.")}</li>
            <li>${this.l("Masih macet? Buka isu di", "Still stuck? Open an issue at")} <a href="${repo}/issues" target="_blank" rel="noopener">${repo.replace("https://", "")}/issues</a> ${this.l("dan sertakan perintah yang Anda jalankan serta pesan error lengkap.", "and include the command you ran and the full error message.")}</li>
          </ul>
          <p class="small muted">${this.l("Tentang kejujuran kursus: semua lab sudah dijalankan terhadap alat aslinya (Spark, Kafka, dbt, Terraform, dan lain-lain) dan solusi referensinya lulus tes. Namun kursus ini belum diuji oleh banyak pemula; jika ada bagian yang membingungkan, tolong laporkan.", "About honesty: every lab has been run against the real tools (Spark, Kafka, dbt, Terraform and others) and its reference solution passes the tests. But the course has not yet been tested with many beginners; if something is confusing, please report it.")}</p>
        </div>
      </div>`;
  }

  // ================= ROADMAP =================
  renderRoadmapView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const pillars = [1, 2, 3, 4].map((n) => `
      <div class="card">
        <h3>${t["pillar" + n + "Title"]}</h3>
        <p class="muted" style="margin-top:6px">${t["pillar" + n + "Desc"]}</p>
      </div>`).join("");
    const levels = CURRICULUM_DATA.map((lvl) => {
      const doneCount = lvl.modules.filter((m) => this.completedModules.includes(m.id)).length;
      const pct = Math.round((doneCount / lvl.modules.length) * 100);
      return `
        <div class="card stack-sm" style="display:flex;flex-direction:column">
          <div class="row between"><span class="chip">${this.esc(this.t(lvl.badge))}</span><span class="muted small">${doneCount}/${lvl.modules.length}</span></div>
          <h3>${this.esc(this.t(lvl.levelTitle))}</h3>
          <p class="muted small">${this.esc(this.t(lvl.levelSubtitle))}</p>
          <ul style="list-style:none;flex:1" class="stack-sm">
            ${lvl.modules.map((m) => `
              <li class="row between small" style="flex-wrap:nowrap">
                <a href="#/curriculum/${m.id}">${m.number} ${this.esc(this.t(m.title))}</a>
                ${this.completedModules.includes(m.id) ? `<span class="state-done">${this.l("Selesai", "Done")}</span>` : ""}
              </li>`).join("")}
          </ul>
          <div class="progress" style="margin-top:8px"><div style="width:${pct}%"></div></div>
          <button class="btn btn-sm" onclick="app.selectLevel('${lvl.levelId}')">${t.exploreModules}</button>
        </div>`;
    }).join("");
    return `
      <div class="stack">
        <div class="card stack-sm">
          <span class="chip chip-blue">${t.roadmapBadge}</span>
          <h1>${t.roadmapHeroTitle}</h1>
          <p class="muted" style="max-width:720px;font-size:15px">${t.roadmapHeroDesc}</p>
          <div class="row" style="padding-top:8px">
            <button class="btn btn-primary" onclick="app.go('start')">${this.l("Mulai di sini: siapkan komputer", "Start here: set up your computer")}</button>
            <button class="btn" onclick="app.go('curriculum')">${t.ctaStartCurriculum}</button>
            <button class="btn" onclick="app.go('interview')">${t.ctaInterviewSim}</button>
            <button class="btn" onclick="app.go('cv-builder')">${t.ctaBuildCv}</button>
          </div>
        </div>
        <div class="grid cols-4">${pillars}</div>
        <h2>${t.matrixTitle}</h2>
        <div class="grid cols-4">${levels}</div>
      </div>`;
  }

  selectLevel(levelId) {
    const lvl = CURRICULUM_DATA.find((l) => l.levelId === levelId);
    if (!lvl || !lvl.modules.length) return;
    this.go("curriculum", lvl.modules[0].id);
  }

  // ================= CURRICULUM =================
  renderCurriculumView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const level = CURRICULUM_DATA.find((l) => l.levelId === this.activeLevelId && l.modules.length) || CURRICULUM_DATA.find((l) => l.modules.length);
    const mod = level.modules.find((m) => m.id === this.activeModuleId) || level.modules[0];
    const done = this.completedModules.includes(mod.id);
    const tabLabels = { concepts: t.tabConcepts, lab: t.tabLab, chaos: t.tabChaos, quiz: t.tabQuiz };

    return `
      <div class="split">
        <aside class="stack-sm">
          <div class="segmented" style="display:flex">
            ${CURRICULUM_DATA.filter((lvl) => lvl.modules.length).map((lvl) => `
              <button style="flex:1" aria-pressed="${lvl.levelId === level.levelId}" class="${lvl.levelId === level.levelId ? "active" : ""}" onclick="app.go('curriculum','${lvl.modules[0].id}')">${this.esc(this.t(lvl.badge))}</button>`).join("")}
          </div>
          <div class="muted small" style="padding:4px 2px">${this.esc(this.t(level.levelTitle))}</div>
          ${level.modules.map((m) => `
            <button class="item ${m.id === mod.id ? "active" : ""}" onclick="app.go('curriculum','${m.id}')">
              <div class="module-row">
                <div>
                  <div class="item-title"><span class="module-num">${m.number}</span>${this.esc(this.t(m.title))}</div>
                  <div class="item-meta">${this.esc(this.t(m.duration))}</div>
                </div>
                ${this.completedModules.includes(m.id) ? `<span class="state-done">${this.l("Selesai", "Done")}</span>` : ""}
              </div>
            </button>`).join("")}
        </aside>

        <section class="stack">
          <div class="card stack-sm">
            <div class="row between">
              <span class="muted small">${this.esc(this.t(level.badge))} · ${this.esc(this.t(mod.duration))} · ~${this.readingMinutes(mod)} ${this.l("menit baca", "min read")}</span>
              <button class="btn btn-sm ${done ? "btn-done" : "btn-quiet"}" onclick="app.toggleModuleCompletion('${mod.id}')">${done ? t.btnMarkedComplete : t.btnMarkComplete}</button>
            </div>
            <h1>${mod.number} ${this.esc(this.t(mod.title))}</h1>
            <p class="muted">${this.esc(this.t(mod.summary))}</p>
            ${mod.idPending && this.lang === "id" ? `<div class="callout"><p>Modul ini belum diterjemahkan ke bahasa Indonesia, jadi ditampilkan dalam bahasa Inggris.</p></div>` : ""}
            <div class="callout neutral">
              <div class="label">${t.whyTutorialsLieHeader}</div>
              <p>${this.esc(this.t(mod.whyTutorialsLie))}</p>
            </div>
            <div class="tabs" role="tablist" aria-label="${this.l("Bagian modul", "Module sections")}">
              ${MODULE_TABS.map((k) => `<button role="tab" id="tab-${k}" aria-selected="${this.activeModuleTab === k}" aria-controls="tabpanel" class="${this.activeModuleTab === k ? "active" : ""}" onclick="app.go('curriculum','${mod.id}','${k}')">${tabLabels[k]}</button>`).join("")}
            </div>
            <div class="stack" id="tabpanel" role="tabpanel" aria-labelledby="tab-${this.activeModuleTab}" style="padding-top:8px">${this.renderModuleTabContent(mod, t)}</div>
          </div>
        </section>
      </div>`;
  }

  readingMinutes(mod) {
    const w = mod.lessons.reduce((n, l) => n + (String(this.t(l.body)).match(/\S+/g) || []).length, 0);
    return Math.max(1, Math.round(w / 200));
  }

  scrollToLesson(i) {
    const el = document.getElementById(`lesson-${i}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  renderModuleTabContent(mod, t) {
    const nav = (back, next) => `
      <div class="row between">
        ${back ? `<button class="btn btn-quiet" onclick="app.go('curriculum','${mod.id}','${back[0]}')">← ${back[1]}</button>` : "<span></span>"}
        ${next ? `<button class="btn btn-primary" onclick="app.go('curriculum','${mod.id}','${next[0]}')">${next[1]} →</button>` : ""}
      </div>`;
    const plainTab = (k) => this.tr(k).replace(/^\d\.\s*/, "");

    if (this.activeModuleTab === "concepts") {
      return `
        <div class="callout">
          <div class="label">${this.l("Setelah modul ini Anda bisa", "After this module you can")}</div>
          <ul style="margin-left:18px">${mod.outcomes.map((o) => `<li>${this.esc(this.t(o))}</li>`).join("")}</ul>
          ${mod.prerequisites && this.t(mod.prerequisites) ? `<p class="small muted" style="margin-top:8px"><strong>${this.l("Prasyarat", "Prerequisites")}:</strong> ${this.inline(this.t(mod.prerequisites))}</p>` : ""}
          <p class="small muted" style="margin-top:6px">${this.l("Waktu baca", "Reading time")}: ~${this.readingMinutes(mod)} ${this.l("menit", "min")}</p>
        </div>
        <div class="well">
          <div class="label">${this.l("Isi materi", "In this module")}</div>
          <ol class="toc">${mod.lessons.map((ls, i) => `<li><a href="javascript:void(0)" onclick="app.scrollToLesson(${i})">${this.esc(this.t(ls.title))}</a></li>`).join("")}</ol>
        </div>
        ${mod.lessons.map((ls, i) => `
          <section class="lesson" id="lesson-${i}">
            <h2 class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="number-dot" style="margin-top:2px">${i + 1}</span><span>${this.esc(this.t(ls.title))}</span></h2>
            ${this.md(ls.body)}
          </section>`).join("")}
        ${mod.resources && mod.resources.length ? `<div class="well"><div class="label">${this.l("Bacaan lanjutan (dokumentasi resmi)", "Further reading (official docs)")}</div><ul style="margin-left:18px">${mod.resources.map((r) => `<li><a href="${this.esc(r.url)}" target="_blank" rel="noopener">${this.esc(this.t(r.label))}</a></li>`).join("")}</ul></div>` : ""}
        ${nav(null, ["lab", plainTab("tabLab")])}`;
    }
    if (this.activeModuleTab === "lab") {
      const lab = mod.lab;
      const hasSandbox = window.SQL_PLAYGROUND && SQL_PLAYGROUND.challenges.some((c) => c.module === mod.id);
      const kindLabel = { starter: this.l("Titik awal", "Starter"), reference: this.l("Solusi referensi", "Reference solution"), test: this.l("Tes", "Tests"), data: this.l("Data", "Data"), config: this.l("Konfigurasi", "Config") };
      return `
        <div>
          <h2>${this.esc(this.t(lab.title))}</h2>
          ${this.md(lab.description)}
        </div>
        ${hasSandbox ? `<div class="callout success"><p>${this.l("Sebagian lab ini bisa dikerjakan langsung di browser dengan pengecekan otomatis:", "Part of this lab can be done in your browser with automatic checking:")} <a href="#/playground">${this.l("buka SQL Sandbox", "open the SQL Sandbox")} →</a></p></div>` : ""}
        ${this.browserLabCard(mod.id)}
        <h3>${this.l("Langkah kerja", "Steps")}</h3>
        ${this.md(lab.steps)}
        ${lab.files.length ? `<h3>${this.l("File lab", "Lab files")}</h3>
          <p class="muted small">${this.l("Semua file ada di folder repositori yang tertera. Yang di bawah ini persis file yang diuji.", "All files live in the repository folder shown. What you see below is exactly the code that was tested.")}</p>
          ${lab.files.map((f) => `
            <details class="file" ${f.kind === "starter" || f.kind === "test" ? "open" : ""}>
              <summary><code>${this.esc(f.path)}</code> <span class="chip ${f.kind === "reference" ? "" : "chip-blue"}">${kindLabel[f.kind]}</span> <span class="muted small">${this.esc(this.t(f.label))}</span></summary>
              ${f.kind === "reference" ? `<p class="small muted" style="margin:8px 0 0">${this.l("Coba kerjakan sendiri dulu. Buka ini untuk membandingkan.", "Try it yourself first. Open this to compare.")}</p>` : ""}
              <pre><code>${this.esc(f.code)}</code></pre>
            </details>`).join("")}` : ""}
        ${lab.verify && this.t(lab.verify) ? `<h3>${this.l("Cara memeriksa hasil", "How to check your work")}</h3>${this.md(lab.verify)}` : ""}
        <div class="callout">
          <div class="label">${this.l("Selesai bila", "Done when")}</div>
          <ul style="margin-left:18px">${lab.deliverables.map((d) => `<li>${this.esc(this.t(d))}</li>`).join("")}</ul>
        </div>
        ${nav(["concepts", plainTab("tabConcepts")], ["chaos", plainTab("tabChaos")])}`;
    }
    if (this.activeModuleTab === "chaos") {
      const c = mod.chaosLab;
      return `
        <h2>${this.esc(this.t(c.title))}</h2>
        <p class="muted">${this.l("Ini kegagalan yang benar-benar terjadi di produksi. Baca skenarionya, coba tebak penyebabnya sebelum membuka jawaban.", "This is a failure that really happens in production. Read the scenario and guess the cause before opening the answer.")}</p>
        <div class="callout danger"><div class="label">${this.l("Skenario kerusakan di produksi", "The production breakage")}</div>${this.md(c.scenario)}</div>
        <details class="file"><summary><strong>${this.l("Tampilkan akar masalah dan perbaikannya", "Show root cause and fix")}</strong></summary>
          <div class="stack-sm" style="margin-top:12px">
            <div class="well"><div class="label">${this.l("Akar masalah", "Root cause")}</div>${this.md(c.breakageReason)}</div>
            <div class="well"><div class="label">${this.l("Cara memperbaiki", "How to fix it")}</div>${this.md(c.fixGuide)}</div>
            <div class="callout success"><div class="label">${this.l("Pola defensif", "Defensive pattern")}</div>${this.md(c.defensivePattern)}</div>
          </div>
        </details>
        ${nav(["lab", plainTab("tabLab")], ["quiz", plainTab("tabQuiz")])}`;
    }
    // quiz
    const order = this.quizOrderFor(mod);
    const last = this.quizScores[mod.id];
    const need = Math.ceil(mod.quiz.length * 0.8);
    return `
      <div>
        <h2>${this.l("Cek pemahaman", "Check your understanding")}</h2>
        <p class="muted" style="margin-top:4px">${this.l(`Jawab minimal ${need} dari ${mod.quiz.length} dengan benar untuk menyelesaikan modul. Urutan pilihan diacak setiap kali halaman dimuat.`, `Answer at least ${need} of ${mod.quiz.length} correctly to complete the module. Answer order is shuffled on each page load.`)}
          ${last ? ` · ${this.l("Skor terbaik", "Best score")}: ${last.best}/${last.total}` : ""}</p>
      </div>
      ${mod.quiz.map((q, qi) => `
        <div class="well stack-sm">
          <div><strong>${qi + 1}.</strong> ${this.inline(this.t(q.question))}</div>
          ${order[qi].map((oi) => `
            <label class="choice"><input type="radio" name="quiz_${mod.id}_${qi}" value="${oi}"><span>${this.inline(this.t(q.options[oi]))}</span></label>`).join("")}
          <div id="quiz-feedback-${qi}" class="hidden feedback"></div>
        </div>`).join("")}
      <div class="row between">
        <button class="btn btn-quiet" onclick="app.go('curriculum','${mod.id}','chaos')">← ${plainTab("tabChaos")}</button>
        <button class="btn btn-primary" onclick="app.submitQuiz('${mod.id}')">${t.btnCheckAnswers}</button>
      </div>
      <div id="quiz-summary"></div>`;
  }

  quizOrderFor(mod) {
    if (!this.quizOrder[mod.id]) {
      this.quizOrder[mod.id] = mod.quiz.map((q) => {
        const idx = q.options.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        return idx;
      });
    }
    return this.quizOrder[mod.id];
  }

  toggleModuleCompletion(modId) {
    this.completedModules = this.completedModules.includes(modId)
      ? this.completedModules.filter((id) => id !== modId)
      : [...this.completedModules, modId];
    writeStore("df_completed_modules", this.completedModules);
    this.renderHeaderStats();
    this.renderView();
  }

  submitQuiz(modId) {
    const level = CURRICULUM_DATA.find((l) => l.modules.some((m) => m.id === modId));
    const mod = level.modules.find((m) => m.id === modId);
    let correct = 0;
    mod.quiz.forEach((q, qi) => {
      const picked = document.querySelector(`input[name="quiz_${modId}_${qi}"]:checked`);
      const box = document.getElementById(`quiz-feedback-${qi}`);
      if (!box) return;
      box.classList.remove("hidden");
      const ok = picked && parseInt(picked.value, 10) === q.correct;
      if (ok) correct++;
      box.className = "feedback " + (ok ? "ok" : "bad");
      box.innerHTML = ok
        ? `<strong>${this.l("Benar.", "Correct.")}</strong> ${this.inline(this.t(q.explanation))}`
        : `<strong>${picked ? this.l("Belum tepat.", "Not quite.") : this.l("Belum dijawab.", "Not answered.")}</strong> ${this.l("Jawaban yang benar", "Correct answer")}: ${this.inline(this.t(q.options[q.correct]))}<br>${this.inline(this.t(q.explanation))}`;
    });
    const prev = this.quizScores[modId];
    this.quizScores[modId] = { best: Math.max(correct, prev ? prev.best : 0), total: mod.quiz.length };
    writeStore("df_quiz_scores", this.quizScores);

    const need = Math.ceil(mod.quiz.length * 0.8);
    const all = correct >= need;
    if (all && !this.completedModules.includes(modId)) {
      this.completedModules.push(modId);
      writeStore("df_completed_modules", this.completedModules);
      this.renderHeaderStats();
    }
    const summary = document.getElementById("quiz-summary");
    if (summary) summary.innerHTML = `<div class="callout ${all ? "success" : ""}"><strong>${correct}/${mod.quiz.length}</strong> ${all ? this.l("Modul ditandai selesai.", "Module marked complete.") : this.l(`Anda butuh minimal ${need}. Baca ulang materinya, lalu coba lagi.`, `You need at least ${need}. Re-read the lessons and try again.`)}</div>`;
  }

  // ================= INTERVIEW =================
  renderInterviewView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const tabs = { "system-design": t.tabSystemDesign, "sql-arena": t.tabSqlArena, "incidents": t.tabIncidents };
    return `
      <div class="stack">
        <div class="card row between">
          <div><h1>${t.interviewTitle}</h1><p class="sub">${t.interviewSubtitle}</p></div>
          <div class="segmented">
            ${INTERVIEW_TABS.map((k) => `<button class="${this.activeInterviewTab === k ? "active" : ""}" onclick="app.go('interview','${k}')">${tabs[k]}</button>`).join("")}
          </div>
        </div>
        ${this.renderInterviewTabContent(t)}
      </div>`;
  }

  renderInterviewTabContent(t) {
    const list = (title, items, activeId, handler, body) => `
      <aside class="stack-sm">
        <div class="label" style="padding:0 2px">${title} (${items.length})</div>
        ${items.map((it) => `
          <button class="item ${it.id === activeId ? "active" : ""}" onclick="app.${handler}('${it.id}')">${body(it)}</button>`).join("")}
      </aside>`;

    if (this.activeInterviewTab === "system-design") {
      const all = INTERVIEW_DATA.systemDesignScenarios;
      const s = all.find((x) => x.id === this.activeSystemDesignId) || all[0];
      return `
        <div class="split">
          ${list(this.l("Skenario", "Scenarios"), all, s.id, "setActiveSystemDesign", (x) => `
            <div class="item-title">${this.esc(this.t(x.title))}</div>
            <div class="item-meta">${x.difficulty} · ${x.tags.slice(0, 3).map((g) => this.esc(g)).join(", ")}</div>`)}
          <section class="stack">
            <div class="card stack-sm">
              <span class="chip">${s.difficulty}</span>
              <h2>${this.esc(this.t(s.title))}</h2>
              <p class="well">${this.esc(this.t(s.scenarioDescription))}</p>
            </div>
            ${s.stages.map((stage, i) => `
              <div class="card stack-sm">
                <div class="row between">
                  <h3 class="row" style="flex-wrap:nowrap"><span class="number-dot">${i + 1}</span>${this.esc(this.t(stage.stageName))}</h3>
                  <button class="btn btn-sm btn-quiet" onclick="app.toggleStage(${i})">${this.l("Tampilkan / sembunyikan jawaban", "Show / hide sample answer")}</button>
                </div>
                <p class="muted"><em>${this.esc(this.t(stage.prompt))}</em></p>
                <div id="stage-content-${i}" class="well">${this.md(this.t(stage.sampleAnswer))}</div>
              </div>`).join("")}
          </section>
        </div>`;
    }

    if (this.activeInterviewTab === "sql-arena") {
      const all = INTERVIEW_DATA.sqlArenaProblems;
      const p = all.find((x) => x.id === this.activeSqlId) || all[0];
      return `
        <div class="split">
          ${list(this.l("Soal SQL", "SQL problems"), all, p.id, "setActiveSql", (x) => `
            <div class="item-title">${this.esc(this.t(x.title))}</div>
            <div class="item-meta">${x.difficulty} · ${this.esc(x.category)}</div>`)}
          <section class="stack">
            <div class="card stack-sm">
              <div class="row between"><span class="chip">${this.esc(p.company)}</span><span class="muted small">${this.esc(p.category)}</span></div>
              <h2>${this.esc(this.t(p.title))}</h2>
              <div class="well">${this.md(p.problemStatement)}</div>
              <div class="label">Schema</div>
              <pre><code>${this.esc(p.schema)}</code></pre>
            </div>
            <div class="card stack-sm">
              <div class="row between"><h3>${this.l("Solusi referensi", "Reference solution")}</h3><span class="muted small">${this.esc(p.complexity)}</span></div>
              <p class="muted small">${this.l("Coba tulis sendiri dulu sebelum membaca. Solusi memakai sintaks PostgreSQL.", "Try writing it yourself before reading. The solution uses PostgreSQL syntax.")}</p>
              <pre><code>${this.esc(this.t(p.solutionSql))}</code></pre>
              <div class="callout"><div class="label">${this.l("Poin penilaian", "What interviewers look for")}</div>${this.md(p.explanation)}</div>
            </div>
          </section>
        </div>`;
    }

    const all = INTERVIEW_DATA.incidentPostMortemDrills;
    const d = all.find((x) => x.id === this.activeDrillId) || all[0];
    return `
      <div class="split">
        ${list(this.l("Kasus insiden", "Incident drills"), all, d.id, "setActiveDrill", (x) => `<div class="item-title">${this.esc(this.t(x.title))}</div>`)}
        <section class="stack">
          <div class="card stack-sm">
            <h2>${this.esc(this.t(d.title))}</h2>
            <div class="callout danger"><div class="label">${this.l("Skenario", "Scenario")}</div>${this.md(d.scenario)}</div>
          </div>
          <h3>${this.l("Protokol triage 60 menit", "60-minute triage rubric")}</h3>
          ${d.rubric.map((r, i) => `
            <div class="card tight stack-sm">
              <h3 class="row" style="flex-wrap:nowrap"><span class="number-dot">${i + 1}</span>${this.esc(this.t(r.phase))}</h3>
              ${this.md(r.action)}
            </div>`).join("")}
        </section>
      </div>`;
  }

  setActiveSystemDesign(id) { this.activeSystemDesignId = id; this.renderView(); }
  setActiveSql(id) { this.activeSqlId = id; this.renderView(); }
  setActiveDrill(id) { this.activeDrillId = id; this.renderView(); }
  toggleStage(i) { const el = document.getElementById(`stage-content-${i}`); if (el) el.classList.toggle("hidden"); }

  // ================= PORTFOLIO =================
  renderPortfolioView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const proj = PORTFOLIO_DATA.projects.find((p) => p.id === this.activePortfolioId) || PORTFOLIO_DATA.projects[0];
    return `
      <div class="stack">
        <div class="card"><h1>${t.portfolioTitle}</h1><p class="sub">${t.portfolioSubtitle}</p></div>
        <div class="grid cols-3">
          ${PORTFOLIO_DATA.projects.map((p) => `
            <button class="item ${p.id === proj.id ? "active" : ""}" onclick="app.setActivePortfolio('${p.id}')">
              <span class="chip">${this.esc(this.t(p.badge))}</span>
              <div class="item-title" style="margin-top:6px">${this.esc(this.t(p.title))}</div>
              <div class="item-meta">${this.esc(this.t(p.summary))}</div>
            </button>`).join("")}
        </div>
        <div class="card stack-sm">
          <h2>${this.esc(this.t(proj.title))}</h2>
          <p>${this.esc(this.t(proj.summary))}</p>
          <div class="callout success"><div class="label">${t.whyHiringManagersLoveTitle}</div><p>${this.esc(this.t(proj.whyHiringManagersLoveIt))}</p></div>
        </div>
        <div class="card stack-sm">
          <h3>${t.architectureStackTitle}</h3>
          ${proj.architecture.map((a) => `<div class="well">${this.esc(this.t(a))}</div>`).join("")}
        </div>
        <div class="card stack-sm">
          <div class="row between"><h3>${t.adrTitle}</h3><span class="chip">Status: ${this.esc(proj.adr.status)}</span></div>
          <div class="well stack-sm">
            <strong>${this.esc(this.t(proj.adr.title))}</strong>
            <p><span class="label">Context</span><br>${this.esc(this.t(proj.adr.context))}</p>
            <p><span class="label">Decision</span><br>${this.esc(this.t(proj.adr.decision))}</p>
            <p><span class="label">Consequences</span><br>${this.esc(this.t(proj.adr.consequences))}</p>
          </div>
        </div>
        <div class="card stack-sm"><h3>${t.repoLayoutTitle}</h3><pre><code>${this.esc(proj.repoStructure)}</code></pre></div>
        <div class="card stack-sm">
          <h3>${t.interviewDefenseTitle}</h3>
          ${proj.interviewDefense.map((qa) => `<div class="well">${this.md(qa)}</div>`).join("")}
        </div>
      </div>`;
  }
  setActivePortfolio(id) { this.activePortfolioId = id; this.renderView(); }

  // ================= RESUME =================
  renderCvBuilderView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const r = this.resumeData || {};
    r.personal = r.personal || {};
    r.skills = r.skills || {};
    r.experience = Array.isArray(r.experience) ? r.experience : [];
    r.projects = Array.isArray(r.projects) ? r.projects : [];

    const s = this.calculateAtsScore();
    const field = (label, path, value) => `
      <div><label class="field">${label}</label><input type="text" value="${this.esc(value || "")}" oninput="app.updateCvField('${path}', this.value)"></div>`;

    const exp0 = r.experience[0] || { company: "", role: "", period: "", location: "", highlights: [] };
    const exp1 = r.experience[1] || { company: "", role: "", period: "", location: "", highlights: [] };
    const proj0 = r.projects[0] || { name: "", tech: "", description: "" };
    const proj1 = r.projects[1] || { name: "", tech: "", description: "" };

    return `
      <div class="stack">
        <div class="card row between no-print">
          <div><h1>${t.cvTitle}</h1><p class="sub">${t.cvSubtitle}</p></div>
          <div class="row">
            <button class="btn btn-quiet" onclick="app.resetBlankCv()">${t.btnStartBlank || (this.lang === "id" ? "Mulai CV Baru" : "Start Fresh CV")}</button>
            <button class="btn btn-quiet" onclick="app.loadSampleCv()">${t.btnLoadTemplate}</button>
            <button class="btn btn-primary" onclick="window.print()">${t.btnPrintPdf}</button>
          </div>
        </div>

        <!-- Banner status -->
        <div class="no-print">
          ${!this.resumeEdited ? `
            <div class="callout neutral">
              <div class="label">${this.l("Mode Template Sampel (Belum Diedit)", "Sample Template Mode (Unedited)")}</div>
              <p>${this.l(
                "Anda sedang melihat data contoh senior (Alex Pratama). Checklist kesiapan kerja <strong>hanya akan dicentang jika Anda mengedit CV Anda sendiri</strong> (atau klik <em>Mulai CV Baru</em>) dan mencapai skor ATS ≥ 70.",
                "You are viewing sample senior data (Alex Pratama). The Job Readiness checklist item <strong>will only check off when you customize your own CV</strong> (or click <em>Start Fresh CV</em>) and achieve an ATS score ≥ 70."
              )}</p>
            </div>
          ` : `
            <div class="callout success">
              <div class="label">${this.l("Resume Pribadi Aktif", "Personal Resume Active")}</div>
              <p>${this.l(
                `Resume kustom Anda sedang aktif. Skor ATS saat ini: <strong>${s.totalScore}/100</strong>. ${s.totalScore >= 70 ? "🎉 Syarat kesiapan kerja telah terpenuhi!" : "⚠️ Tambahkan lebih banyak metrik angka (%, $, GB, ms) dan kata kunci teknologi modern untuk mencapai skor minimal 70."}`,
                `Your custom resume is active. Current ATS score: <strong>${s.totalScore}/100</strong>. ${s.totalScore >= 70 ? "🎉 Job readiness requirement met!" : "⚠️ Add more measurable metrics (%, $, GB, ms) and modern tech keywords to reach score 70+."}`
              )}</p>
            </div>
          `}
        </div>

        <!-- Formula Callout -->
        <div class="card stack-sm no-print" style="background:#fcfdfd;border-left:4px solid var(--blue)">
          <div class="row between">
            <h3>${this.l("Panduan Formula Dampak Google (Rumus XYZ)", "Google XYZ Impact Formula Guide")}</h3>
            <span class="chip chip-blue">Standar Global</span>
          </div>
          <p class="well" style="font-size:13px;line-height:1.5">
            <strong>Formula:</strong> <em>"Berhasil mencapai [X], terukur dengan [Y], dengan melakukan [Z]"</em><br>
            <span style="color:#b32d2e">❌ Pasif:</span> <em>"Bertanggung jawab membuat pipeline ETL dengan Python dan SQL."</em><br>
            <span style="color:#0f6b38">✓ Dampak Terukur:</span> <em>"Architected Lakehouse ingestion pipeline using Python & Apache Iceberg, processing 45M daily events with 99.98% uptime."</em>
          </p>
        </div>

        <div class="card stack-sm no-print" id="ats-panel">${this.renderAtsPanel()}</div>

        <div class="split-cv">
          <div class="stack no-print">
            <!-- Navigasi Cepat Editor -->
            <div class="card tight row between" style="background:#f7f9fa;gap:6px">
              <span class="label" style="margin-right:4px">${this.l("Bagian Editor:", "Editor Sections:")}</span>
              <div class="row" style="gap:4px">
                <button class="btn btn-sm btn-quiet" onclick="document.getElementById('sec-bio')?.scrollIntoView({behavior:'smooth'})">${this.l("1. Kontak", "1. Contact")}</button>
                <button class="btn btn-sm btn-quiet" onclick="document.getElementById('sec-skills')?.scrollIntoView({behavior:'smooth'})">${this.l("2. Skills", "2. Skills")}</button>
                <button class="btn btn-sm btn-quiet" onclick="document.getElementById('sec-exp')?.scrollIntoView({behavior:'smooth'})">${this.l("3. Pengalaman", "3. Experience")}</button>
                <button class="btn btn-sm btn-quiet" onclick="document.getElementById('sec-proj')?.scrollIntoView({behavior:'smooth'})">${this.l("4. Proyek", "4. Projects")}</button>
                <button class="btn btn-sm btn-quiet" onclick="document.getElementById('sec-bullets')?.scrollIntoView({behavior:'smooth'})">${this.l("5. Pustaka", "5. Bullets")}</button>
              </div>
            </div>

            <!-- 1. Identitas & Kontak -->
            <div class="card stack-sm" id="sec-bio">
              <div class="row between">
                <h3>${this.l("1. Kontak & Bio", "1. Contact & Bio")}</h3>
                <span class="muted small">${this.l("Data diri", "Personal info")}</span>
              </div>
              <div class="grid cols-2">
                ${field(this.l("Nama Lengkap", "Full Name"), "personal.fullName", r.personal.fullName)}
                ${field(this.l("Jabatan Target", "Target Title"), "personal.title", r.personal.title)}
              </div>
              <div class="grid cols-2">
                ${field("Email", "personal.email", r.personal.email)}
                ${field(this.l("Lokasi (Domisili)", "Location"), "personal.location", r.personal.location)}
              </div>
              <div class="grid cols-2">
                ${field("LinkedIn", "personal.linkedin", r.personal.linkedin)}
                ${field("GitHub", "personal.github", r.personal.github)}
              </div>
              <div>
                <label class="field">${this.l("Ringkasan Profesional (Summary)", "Professional Summary")}</label>
                <textarea rows="3" placeholder="${this.l("Tulis 2-3 kalimat fokus spesialisasi, volume data, dan teknologi utama...", "Write 2-3 sentences highlighting specialization, scale, and primary tech...")}" oninput="app.updateCvField('summary', this.value)">${this.esc(r.summary || "")}</textarea>
              </div>
            </div>

            <!-- 2. Keahlian Teknis (Skills) -->
            <div class="card stack-sm" id="sec-skills">
              <div class="row between">
                <h3>${this.l("2. Keahlian Teknis (Skills)", "2. Technical Skills")}</h3>
                <span class="muted small">${this.l("Kata kunci ATS", "ATS keywords")}</span>
              </div>
              ${field("Languages (Bahasa)", "skills.languages", r.skills.languages)}
              ${field("Storage & Formats (Format & Penyimpanan)", "skills.storageTableFormats", r.skills.storageTableFormats)}
              ${field("Processing & Streaming (Komputasi & Aliran Data)", "skills.processingStreaming", r.skills.processingStreaming)}
              ${field("Orchestration & DevOps (Orkestrasi & CI/CD)", "skills.orchestrationOps", r.skills.orchestrationOps)}
            </div>

            <!-- 3. Pengalaman Kerja 1 -->
            <div class="card stack-sm" id="sec-exp">
              <div class="row between">
                <h3>${this.l("3. Pengalaman Kerja 1", "3. Work Experience 1")}</h3>
                <span class="muted small">${this.l("Perusahaan terkini", "Latest role")}</span>
              </div>
              <div class="grid cols-2">
                ${field(this.l("Perusahaan", "Company"), "experience.0.company", exp0.company)}
                ${field(this.l("Peran / Role", "Role"), "experience.0.role", exp0.role)}
              </div>
              <div class="grid cols-2">
                ${field(this.l("Periode", "Period"), "experience.0.period", exp0.period)}
                ${field(this.l("Lokasi", "Location"), "experience.0.location", exp0.location)}
              </div>
              <div>
                <div class="row between" style="margin-bottom:4px">
                  <label class="field" style="margin:0">${this.l("Bullet Points Pengalaman 1 (1 baris per poin)", "Experience 1 Bullets (1 line per bullet)")}</label>
                  <span class="muted small">${this.l("Gunakan rumus XYZ + angka", "Use XYZ formula + numbers")}</span>
                </div>
                <textarea rows="5" id="exp-highlights-0" placeholder="${this.l("Tulis 1 bullet per baris. Contoh:\nArchitected Lakehouse ingestion using Apache Iceberg, processing 20M daily events with 99.9% SLA.", "1 bullet per line. Example:\nArchitected Lakehouse ingestion using Apache Iceberg, processing 20M daily events with 99.9% SLA.")}" oninput="app.updateCvHighlights(0, this.value)">${this.esc((exp0.highlights || []).join("\n"))}</textarea>
              </div>
            </div>

            <!-- 4. Pengalaman Kerja 2 -->
            <div class="card stack-sm">
              <div class="row between">
                <h3>${this.l("4. Pengalaman Kerja 2 (Opsional)", "4. Work Experience 2 (Optional)")}</h3>
                <span class="muted small">${this.l("Peran sebelumnya", "Previous role")}</span>
              </div>
              <div class="grid cols-2">
                ${field(this.l("Perusahaan", "Company"), "experience.1.company", exp1.company)}
                ${field(this.l("Peran / Role", "Role"), "experience.1.role", exp1.role)}
              </div>
              <div class="grid cols-2">
                ${field(this.l("Periode", "Period"), "experience.1.period", exp1.period)}
                ${field(this.l("Lokasi", "Location"), "experience.1.location", exp1.location)}
              </div>
              <div>
                <label class="field">${this.l("Bullet Points Pengalaman 2 (1 baris per poin)", "Experience 2 Bullets (1 line per bullet)")}</label>
                <textarea rows="4" id="exp-highlights-1" placeholder="${this.l("Tulis 1 bullet per baris...", "1 bullet per line...")}" oninput="app.updateCvHighlights(1, this.value)">${this.esc((exp1.highlights || []).join("\n"))}</textarea>
              </div>
            </div>

            <!-- 5. Proyek Portofolio -->
            <div class="card stack-sm" id="sec-proj">
              <div class="row between">
                <h3>${this.l("5. Proyek Portofolio", "5. Portfolio Projects")}</h3>
                <span class="muted small">${this.l("Capstone", "Capstone")}</span>
              </div>
              <div class="grid cols-2">
                ${field(this.l("Nama Proyek 1", "Project 1 Name"), "projects.0.name", proj0.name)}
                ${field("Tech Stack 1", "projects.0.tech", proj0.tech)}
              </div>
              <div>
                <label class="field">${this.l("Deskripsi Proyek 1", "Project 1 Description")}</label>
                <textarea rows="2" oninput="app.updateCvField('projects.0.description', this.value)">${this.esc(proj0.description || "")}</textarea>
              </div>
              <div class="grid cols-2" style="margin-top:10px">
                ${field(this.l("Nama Proyek 2", "Project 2 Name"), "projects.1.name", proj1.name)}
                ${field("Tech Stack 2", "projects.1.tech", proj1.tech)}
              </div>
              <div>
                <label class="field">${this.l("Deskripsi Proyek 2", "Project 2 Description")}</label>
                <textarea rows="2" oninput="app.updateCvField('projects.1.description', this.value)">${this.esc(proj1.description || "")}</textarea>
              </div>
            </div>

            <!-- 6. Perpustakaan Bullet (Formula XYZ) -->
            <div class="card stack-sm" id="sec-bullets">
              <div class="row between">
                <h3>${this.l("Perpustakaan Bullet Siap Pakai (Rumus XYZ)", "Ready-to-Use Bullet Library (XYZ Formula)")}</h3>
                <span class="chip chip-blue">${CV_DATA.bulletLibrary.reduce((acc, c) => acc + c.bullets.length, 0)} ${this.l("Contoh", "Examples")}</span>
              </div>
              <p class="muted small">${this.l("Klik <strong>+ Sisipkan ke Pengalaman 1</strong> untuk langsung menambahkan ke CV Anda, atau klik <strong>Salin</strong>. Sesuaikan angka sesuai portofolio Anda.", "Click <strong>+ Insert to Experience 1</strong> to immediately add to your CV, or click <strong>Copy</strong>. Adjust numbers to match your actual work.")}</p>
              ${CV_DATA.bulletLibrary.map((cat, ci) => `
                <div class="stack-sm" style="margin-top:10px">
                  <div class="label" style="color:var(--text);font-weight:600">${this.esc(cat.category)}</div>
                  ${cat.bullets.map((b, bi) => `
                    <div class="well stack-sm" style="padding:10px 12px;background:#fff">
                      <div style="font-size:12.5px;line-height:1.45">${this.esc(b)}</div>
                      <div class="row" style="margin-top:4px">
                        <button class="btn btn-sm btn-primary" onclick="app.insertBullet(${ci}, ${bi}, 0)">${this.l("+ Sisipkan ke Pengalaman 1", "+ Insert to Exp 1")}</button>
                        <button class="btn btn-sm btn-quiet" onclick="app.copyBullet(${ci}, ${bi}, this)">${this.l("📋 Salin", "📋 Copy")}</button>
                      </div>
                    </div>`).join("")}
                </div>`).join("")}
            </div>
          </div>

          <div id="cv-preview">${this.renderCvPreview()}</div>
        </div>
      </div>`;
  }

  renderAtsPanel() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const s = this.calculateAtsScore();
    const stat = (label, v) => `<div class="stat"><div class="muted small">${label}</div><div class="num">${v}<span class="muted small">/25</span></div></div>`;
    return `
      <div class="row between"><div><h2>${t.atsScoreTitle} · ${s.totalScore}/100</h2><p class="sub">${t.atsScoreSubtitle}</p></div>
        <div class="progress" style="width:160px"><div style="width:${s.totalScore}%"></div></div></div>
      <div class="grid cols-4">${stat(t.metricDensity, s.breakdown.metrics)}${stat(t.techSignals, s.breakdown.tech)}${stat(t.roleDiff, s.breakdown.differentiation)}${stat(t.actionVerbs, s.breakdown.actionVerbs)}</div>
      ${s.recommendations.length ? `<div class="callout"><div class="label">${t.suggestionsTitle}</div><ul style="margin-left:18px">${s.recommendations.map((x) => `<li>${this.esc(x)}</li>`).join("")}</ul></div>` : ""}
      <p class="muted small">${this.l("Skor ini adalah audit heuristik otomatis (mengevaluasi angka terukur, kata kunci modern, pemisahan peran, dan kata kerja aksi).", "This score is an automated heuristic audit (evaluating measurable numbers, modern tech, role differentiation, and action verbs).")}</p>`;
  }

  renderCvPreview() {
    const r = this.resumeData || {};
    const personal = r.personal || {};
    const skills = r.skills || {};
    const experience = (Array.isArray(r.experience) ? r.experience : []).filter((e) => e && (e.company || e.role || (e.highlights && e.highlights.length)));
    const projects = (Array.isArray(r.projects) ? r.projects : []).filter((p) => p && (p.name || p.description));
    const contacts = [personal.email, personal.location, personal.linkedin, personal.github].filter(Boolean);

    return `
      <div class="paper" id="cv-preview-card">
        <h1>${this.esc(personal.fullName || (this.lang === "id" ? "Nama Lengkap" : "Your Full Name"))}</h1>
        <div class="center" style="color:#0a66c2;font-weight:600;margin-top:2px">${this.esc(personal.title || "Data Engineer")}</div>
        <div class="center" style="color:#555;margin-top:4px">${contacts.map((c) => this.esc(c)).join(" · ")}</div>

        ${r.summary ? `<h3>Summary</h3><p>${this.esc(r.summary)}</p>` : ""}

        <h3>Technical Proficiencies</h3>
        ${skills.languages ? `<div><strong>Languages:</strong> ${this.esc(skills.languages)}</div>` : ""}
        ${skills.storageTableFormats ? `<div><strong>Storage & Formats:</strong> ${this.esc(skills.storageTableFormats)}</div>` : ""}
        ${skills.processingStreaming ? `<div><strong>Processing & Streaming:</strong> ${this.esc(skills.processingStreaming)}</div>` : ""}
        ${skills.orchestrationOps ? `<div><strong>Orchestration & Ops:</strong> ${this.esc(skills.orchestrationOps)}</div>` : ""}

        ${experience.length ? `
          <h3>Experience</h3>
          ${experience.map((e) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between">
                <strong>${this.esc(e.company || "")}${e.role ? ` — ${this.esc(e.role)}` : ""}</strong>
                <span style="color:#555">${this.esc(e.period || "")}</span>
              </div>
              ${e.location ? `<div style="color:#777;font-size:11px;margin-bottom:3px">${this.esc(e.location)}</div>` : ""}
              ${Array.isArray(e.highlights) && e.highlights.length ? `
                <ul>${e.highlights.map((h) => `<li>${this.esc(h)}</li>`).join("")}</ul>
              ` : ""}
            </div>`).join("")}
        ` : ""}

        ${projects.length ? `
          <h3>Projects</h3>
          ${projects.map((p) => `
            <div style="margin-bottom:8px">
              <strong>${this.esc(p.name || "")}</strong> ${p.tech ? `<span style="color:#555">(${this.esc(p.tech)})</span>` : ""}
              <div>${this.esc(p.description || "")}</div>
            </div>`).join("")}
        ` : ""}
      </div>`;
  }

  setDeep(obj, path, val) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      const nextIsNum = !isNaN(Number(parts[i + 1]));
      if (cur[p] === undefined || cur[p] === null) {
        cur[p] = nextIsNum ? [] : {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
  }

  // Update data and refresh only the preview and score: re-rendering the editor would drop input focus.
  updateCvField(path, val) {
    this.setDeep(this.resumeData, path, val);
    this.resumeEdited = true;
    writeStore("df_resume_edited", true);
    writeStore("df_resume_data", this.resumeData);
    const preview = document.getElementById("cv-preview");
    const ats = document.getElementById("ats-panel");
    if (preview) preview.innerHTML = this.renderCvPreview();
    if (ats) ats.innerHTML = this.renderAtsPanel();
  }

  updateCvHighlights(expIndex, val) {
    if (!this.resumeData.experience) this.resumeData.experience = [];
    if (!this.resumeData.experience[expIndex]) {
      this.resumeData.experience[expIndex] = { company: "", role: "Data Engineer", period: "", location: "", highlights: [] };
    }
    this.resumeData.experience[expIndex].highlights = val.split("\n").map((s) => s.trim()).filter(Boolean);
    this.resumeEdited = true;
    writeStore("df_resume_edited", true);
    writeStore("df_resume_data", this.resumeData);
    const preview = document.getElementById("cv-preview");
    const ats = document.getElementById("ats-panel");
    if (preview) preview.innerHTML = this.renderCvPreview();
    if (ats) ats.innerHTML = this.renderAtsPanel();
  }

  insertBullet(ci, bi, expIndex = 0) {
    const text = CV_DATA.bulletLibrary[ci].bullets[bi];
    if (!this.resumeData.experience) this.resumeData.experience = [];
    if (!this.resumeData.experience[expIndex]) {
      this.resumeData.experience[expIndex] = { company: "Data Platform Inc", role: "Data Engineer", period: "2024 - Sekarang", location: "Remote", highlights: [] };
    }
    if (!Array.isArray(this.resumeData.experience[expIndex].highlights)) {
      this.resumeData.experience[expIndex].highlights = [];
    }
    this.resumeData.experience[expIndex].highlights.push(text);
    this.resumeEdited = true;
    writeStore("df_resume_edited", true);
    writeStore("df_resume_data", this.resumeData);
    this.renderView();
  }

  copyBullet(ci, bi, btnEl) {
    const text = CV_DATA.bulletLibrary[ci].bullets[bi];
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (btnEl) {
          const orig = btnEl.innerHTML;
          btnEl.innerHTML = this.l("✓ Tersalin!", "✓ Copied!");
          setTimeout(() => { if (btnEl) btnEl.innerHTML = orig; }, 1500);
        }
      });
    }
  }

  loadSampleCv() {
    this.resumeData = JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    this.resumeEdited = false;
    writeStore("df_resume_edited", false);
    writeStore("df_resume_data", this.resumeData);
    this.renderView();
  }

  resetBlankCv() {
    if (!confirm(this.l("Mulai CV baru dari lembar kosong? Format template lama akan digantikan.", "Start a fresh blank CV? Current resume fields will be reset."))) return;
    this.resumeData = {
      personal: {
        fullName: "",
        title: "Data Engineer",
        email: "",
        phone: "",
        location: "Indonesia (Open to Remote)",
        linkedin: "",
        github: ""
      },
      summary: "",
      skills: {
        languages: "Python, SQL, Bash",
        storageTableFormats: "Apache Iceberg, DuckDB, Parquet",
        processingStreaming: "PySpark, Apache Kafka, DuckDB",
        orchestrationOps: "Dagster, dbt Core, Docker, GitHub Actions"
      },
      experience: [
        {
          company: "",
          role: "Data Engineer",
          period: "2024 - Sekarang",
          location: "Remote / On-site",
          highlights: []
        }
      ],
      projects: [
        {
          name: "Lakehouse Batch & Streaming Platform",
          tech: "MinIO, Iceberg, DuckDB, dbt Core, Dagster",
          description: "Arsitektur data lakehouse lokal berstandar industri dengan pengujian otomatis."
        }
      ]
    };
    this.resumeEdited = true;
    writeStore("df_resume_edited", true);
    writeStore("df_resume_data", this.resumeData);
    this.renderView();
  }

  calculateAtsScore() {
    const score = { totalScore: 0, breakdown: { metrics: 0, tech: 0, differentiation: 25, actionVerbs: 0 }, recommendations: [] };
    const text = JSON.stringify(this.resumeData).toLowerCase();

    // Check if CV is essentially empty
    const personal = this.resumeData.personal || {};
    const hasName = Boolean(personal.fullName && personal.fullName.trim().length > 0);
    const hasSummary = Boolean(this.resumeData.summary && this.resumeData.summary.trim().length > 0);
    const hasExperience = Boolean(this.resumeData.experience && this.resumeData.experience.length && (this.resumeData.experience[0].company || (this.resumeData.experience[0].highlights && this.resumeData.experience[0].highlights.length)));

    if (!hasName && !hasSummary && !hasExperience) {
      score.breakdown.differentiation = 0;
      score.recommendations.push(this.l("Isi nama lengkap, ringkasan profil, dan pengalaman kerja Anda.", "Fill in your full name, summary profile, and work experience."));
      return score;
    }

    const metricMatches = (text.match(/(\d+%|\$\d+|\d+gb|\d+tb|\d+ms|\d+m\b|\d+k\b)/g) || []).length;
    score.breakdown.metrics = Math.min(25, metricMatches * 3);
    if (score.breakdown.metrics < 20) score.recommendations.push(this.l("Tambahkan metrik terukur (persen %, penghematan $, volume GB/TB, latensi ms).", "Add measurable metrics (% percentage, $ savings, GB/TB volume, ms latency)."));

    const techKeywords = ["iceberg", "duckdb", "dbt", "dagster", "redpanda", "kafka", "pydantic", "flink", "terraform", "spark", "postgres", "parquet"];
    score.breakdown.tech = Math.min(25, techKeywords.filter((k) => text.includes(k)).length * 3);
    if (score.breakdown.tech < 20) score.recommendations.push(this.l("Sertakan kata kunci stack modern (Iceberg, DuckDB, dbt, Dagster, Kafka/Redpanda, Spark).", "Include modern stack keywords (Iceberg, DuckDB, dbt, Dagster, Kafka/Redpanda, Spark)."));

    const verbs = ["architected", "engineered", "optimized", "refactored", "deployed", "scaled", "designed", "implemented", "built"];
    score.breakdown.actionVerbs = Math.min(25, verbs.filter((v) => text.includes(v)).length * 4);
    if (score.breakdown.actionVerbs < 20) score.recommendations.push(this.l("Gunakan kata kerja aksi aktif (Architected, Engineered, Optimized, Refactored, Scaled).", "Use active verbs (Architected, Engineered, Optimized, Refactored, Scaled)."));

    if (text.includes("dashboard") && !text.includes("idempotency") && !text.includes("cdc")) {
      score.breakdown.differentiation = 12;
      score.recommendations.push(this.l("Kurangi istilah dashboard/reporting; tonjolkan sistem pipeline data, idempotensi, atau CDC.", "Lean less on dashboard/reporting wording; highlight pipelines, idempotency, or CDC."));
    }
    score.totalScore = score.breakdown.metrics + score.breakdown.tech + score.breakdown.differentiation + score.breakdown.actionVerbs;
    return score;
  }

  // ================= SQL SANDBOX =================
  renderPlaygroundView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const sb = this.sandbox;
    const P = SQL_PLAYGROUND;
    const ds = P.datasets[sb.datasetKey];
    const challenge = P.challenges.find((c) => c.id === sb.challengeId);
    const forDataset = P.challenges.filter((c) => c.dataset === sb.datasetKey);
    return `
      <div class="stack">
        <div class="card row between">
          <div><h1>${t.playgroundTitle}</h1><p class="sub">${t.playgroundSubtitle}</p></div>
          <div class="row"><label class="label" for="pg-dataset-select">${t.datasetLabel}</label>
            <select id="pg-dataset-select" onchange="app.changeDataset(this.value)">
              ${Object.keys(P.datasets).map((k) => `<option value="${k}" ${k === sb.datasetKey ? "selected" : ""}>${this.esc(this.t(P.datasets[k].name))}</option>`).join("")}
            </select></div>
        </div>
        <div class="split">
          <aside class="stack-sm">
            <div class="card stack-sm">
              <h3>${this.l("Tabel", "Tables")}</h3>
              <p class="muted small">${this.esc(this.t(ds.description))}</p>
              <div id="pg-tables" class="schema-list"></div>
            </div>
            <div class="label" style="padding:0 2px">${this.l("Tantangan", "Challenges")}</div>
            ${forDataset.map((c) => {
              const solved = this.solvedChallenges.includes(c.id);
              return `
              <button class="item ${c.id === sb.challengeId ? "active" : ""}" onclick="app.selectChallenge('${c.id}')">
                <div class="item-title">${solved ? `<span style="color:var(--green);font-weight:bold;margin-right:5px">✓</span>` : ""}${this.esc(this.t(c.title))}</div>
                <div class="item-meta">${this.esc(this.t(c.level))}</div>
              </button>`;
            }).join("")}
            <button class="btn btn-quiet btn-sm" onclick="app.selectChallenge(null)">${this.l("Mode bebas (tanpa tantangan)", "Free mode (no challenge)")}</button>
          </aside>
          <section class="stack">
            ${challenge ? `
              <div class="card stack-sm">
                <div class="row between"><h3>${this.esc(this.t(challenge.title))}</h3><span class="chip">${this.esc(this.t(challenge.level))}</span></div>
                <p>${this.esc(this.t(challenge.task))}</p>
                <div class="row">
                  <button class="btn btn-sm btn-quiet" onclick="app.toggleHint()">${this.l("Petunjuk", "Hint")}</button>
                  <button class="btn btn-sm btn-quiet" onclick="app.toggleSolution()">${this.l("Lihat solusi", "Show solution")}</button>
                </div>
                ${sb.hintOpen ? `<div class="callout neutral"><p>${this.esc(this.t(challenge.hint))}</p></div>` : ""}
                ${sb.solutionOpen ? `<pre><code>${this.esc(challenge.solution)}</code></pre>` : ""}
              </div>` : ""}
            <div class="card stack-sm">
              <textarea id="pg-sql-editor" class="sql" rows="9" spellcheck="false" placeholder="SELECT ..."></textarea>
              <div class="row between">
                <div class="row">
                  <button class="btn btn-primary" onclick="app.runSql()">${t.btnExecuteSql}</button>
                  ${challenge ? `<button class="btn" onclick="app.checkChallenge()">${this.l("Periksa jawaban", "Check my answer")}</button>` : ""}
                  <button class="btn btn-quiet" onclick="app.resetDataset()">${this.l("Reset data", "Reset dataset")}</button>
                </div>
                <span id="pg-result-stats" class="muted small">${sb.status === "loading" ? this.l("Memuat mesin SQL...", "Loading SQL engine...") : ""}</span>
              </div>
              <div id="pg-verdict"></div>
            </div>
            <div class="card stack-sm"><h3>${this.l("Hasil", "Result")}</h3><div id="pg-results-container"><p class="muted">${t.runQueryPrompt}</p></div></div>
          </section>
        </div>
      </div>`;
  }

  async afterPlaygroundRender() {
    const sb = this.sandbox;
    const editor = document.getElementById("pg-sql-editor");
    editor.value = sb.draft || "";
    editor.addEventListener("input", () => { sb.draft = editor.value; });
    editor.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); this.runSql(); } });
    try {
      if (SQL_PLAYGROUND.datasetKey !== sb.datasetKey) await SQL_PLAYGROUND.loadDataset(sb.datasetKey);
      sb.status = "ready";
    } catch (err) {
      sb.status = "error";
      document.getElementById("pg-results-container").innerHTML = `<div class="callout danger">${this.l("Mesin SQL gagal dimuat. Jalankan lewat server (npm start atau python3 server.py), jangan buka file langsung.", "The SQL engine failed to load. Run via the server (npm start or python3 server.py); do not open the file directly.")}<br><code>${this.esc(err.message || err)}</code></div>`;
      return;
    }
    if (this.currentView !== "playground") return;
    const stats = document.getElementById("pg-result-stats");
    if (stats) stats.textContent = this.tr("readyToExecute");
    const tables = document.getElementById("pg-tables");
    if (tables) tables.innerHTML = SQL_PLAYGROUND.tables().map((tb) => `<div style="margin-top:6px"><b>${this.esc(tb.name)}</b>(${tb.cols.map((c) => this.esc(c)).join(", ")})</div>`).join("");
  }

  async changeDataset(key) {
    this.sandbox = { ...this.sandbox, datasetKey: key, challengeId: null, hintOpen: false, solutionOpen: false, draft: "" };
    this.renderView();
  }
  async selectChallenge(id) {
    const sb = this.sandbox;
    sb.challengeId = id;
    sb.hintOpen = false; sb.solutionOpen = false; sb.draft = "";
    if (id) sb.datasetKey = SQL_PLAYGROUND.challenges.find((c) => c.id === id).dataset;
    this.renderView();
  }
  toggleHint() { this.sandbox.hintOpen = !this.sandbox.hintOpen; this.rerenderKeepingEditor(); }
  toggleSolution() { this.sandbox.solutionOpen = !this.sandbox.solutionOpen; this.rerenderKeepingEditor(); }
  rerenderKeepingEditor() {
    const ed = document.getElementById("pg-sql-editor");
    if (ed) this.sandbox.draft = ed.value;
    this.renderView();
  }
  async resetDataset() {
    await SQL_PLAYGROUND.loadDataset(this.sandbox.datasetKey);
    document.getElementById("pg-results-container").innerHTML = `<p class="muted">${this.l("Data dikembalikan ke kondisi awal.", "Data restored to its original state.")}</p>`;
    document.getElementById("pg-verdict").innerHTML = "";
  }

  runSql() {
    if (this.sandbox.status !== "ready") return;
    const editor = document.getElementById("pg-sql-editor");
    const container = document.getElementById("pg-results-container");
    const stats = document.getElementById("pg-result-stats");
    document.getElementById("pg-verdict").innerHTML = "";
    const res = SQL_PLAYGROUND.run(editor.value);
    if (!res.ok) {
      stats.textContent = "Error";
      container.innerHTML = `<div class="callout danger"><div class="label">SQL error</div><code>${this.esc(res.error)}</code></div>`;
    } else if (res.empty) {
      stats.textContent = `${res.ms.toFixed(1)} ms`;
      container.innerHTML = `<p class="muted">${this.l("Perintah berhasil dijalankan (tidak ada baris yang dikembalikan).", "Statement ran successfully (no rows returned).")}</p>`;
    } else {
      stats.textContent = `${res.rows.length} ${this.l("baris", "rows")} · ${res.ms.toFixed(1)} ms`;
      container.innerHTML = `<div class="table-wrap"><table>
        <thead><tr>${res.columns.map((c) => `<th>${this.esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${res.rows.map((row) => `<tr>${row.map((v) => v === null ? `<td class="null">NULL</td>` : `<td>${this.esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
    }
  }

  checkChallenge() {
    if (this.sandbox.status !== "ready") return;
    const challenge = SQL_PLAYGROUND.challenges.find((c) => c.id === this.sandbox.challengeId);
    const editor = document.getElementById("pg-sql-editor");
    this.runSql();
    const r = SQL_PLAYGROUND.check(challenge, editor.value);
    const box = document.getElementById("pg-verdict");
    let msg;
    if (r.ok) {
      msg = this.l("Benar: hasil query Anda sama dengan hasil referensi.", "Correct: your result matches the reference result.");
      if (challenge && !this.solvedChallenges.includes(challenge.id)) {
        this.solvedChallenges.push(challenge.id);
        writeStore("df_solved_challenges", this.solvedChallenges);
        this.renderChrome();
      }
    }
    else if (r.reason === "error") msg = this.l("Query punya error; perbaiki dulu.", "Your query has an error; fix it first.");
    else if (r.reason === "empty") msg = this.l("Query tidak menghasilkan baris. Tulis SELECT.", "Your query returned no rows. Write a SELECT.");
    else if (r.reason === "columns") msg = this.l(`Jumlah kolom salah: diharapkan ${r.expected}, Anda ${r.got}.`, `Wrong number of columns: expected ${r.expected}, you returned ${r.got}.`);
    else if (r.reason === "rows") msg = this.l(`Jumlah baris salah: diharapkan ${r.expected}, Anda ${r.got}.`, `Wrong number of rows: expected ${r.expected}, you returned ${r.got}.`);
    else msg = this.l("Jumlah baris dan kolom sudah sesuai, tetapi nilainya berbeda. Periksa filter dan agregasi.", "Rows and columns match in count, but the values differ. Check your filters and aggregation.");
    box.innerHTML = `<div class="feedback ${r.ok ? "ok" : "bad"}">${msg}</div>`;
  }

  // ================= JOB READINESS DASHBOARD =================
  renderReadinessView() {
    const totalModules = CURRICULUM_DATA.reduce((n, lvl) => n + lvl.modules.length, 0);
    const completedCount = this.completedModules.length;
    const solvedSqlCount = this.solvedChallenges.length;
    const totalSqlCount = (window.SQL_PLAYGROUND && SQL_PLAYGROUND.challenges) ? SQL_PLAYGROUND.challenges.length : 36;
    
    // Quiz stats
    const quizModIds = Object.keys(this.quizScores);
    const totalQuizCorrect = quizModIds.reduce((sum, id) => sum + (this.quizScores[id].best || 0), 0);
    const avgQuizPct = quizModIds.length ? Math.round((totalQuizCorrect / (quizModIds.length * 8)) * 100) : 0;

    // Resume score
    const atsResult = this.calculateAtsScore();
    const resumeScoreTotal = atsResult.totalScore || 0;
    const isResumeDone = Boolean(this.resumeEdited && resumeScoreTotal >= 70);

    // Readiness Score (0 to 100)
    // 60% Curriculum Modules, 25% SQL Sandbox, 15% Career Assets (Resume + Portfolio)
    const modWeight = (completedCount / totalModules) * 60;
    const sqlWeight = (Math.min(solvedSqlCount, 25) / 25) * 25;
    const careerWeight = (isResumeDone ? 7.5 : 0) + (completedCount >= 8 ? 7.5 : 0);
    const readinessScore = Math.min(100, Math.round(modWeight + sqlWeight + careerWeight));

    // Learning stage (a progress indicator, not a hiring promise)
    let tierTitle, tierDesc, tierComp, tierBadge, tierBadgeBg;
    tierComp = this.l("Skor ini mengukur kemajuan belajar Anda di kursus ini, bukan kesiapan kerja yang dijamin. Gaji dan syarat jabatan sangat berbeda antar kota dan perusahaan; cek lowongan dan survei gaji terbaru. Yang paling meyakinkan perekrut adalah proyek portofolio buatan Anda sendiri yang berjalan.", "This score measures your learning progress in this course, not guaranteed job readiness. Pay and job requirements differ a lot between cities and companies; check current job posts and salary surveys. What convinces recruiters most is a portfolio project of your own that runs.");
    if (readinessScore < 25) {
      tierTitle = this.l("Tahap 1: Membangun fondasi", "Stage 1: Building foundations");
      tierDesc = this.l("Sedang membangun fondasi Linux, Git, SQL relasional, dan Python produksi. Fokus selesaikan Level 0 dan Level 1 terlebih dahulu.", "Building core foundations: Linux, Git, relational SQL, and production Python. Complete Level 0 and Level 1 first.");
      tierBadge = this.l("Fondasi", "Foundations");
      tierBadgeBg = "var(--blue)";
    } else if (readinessScore < 55) {
      tierTitle = this.l("Tahap 2: Kemampuan tingkat junior", "Stage 2: Junior-level skills");
      tierDesc = this.l("Anda sudah mempelajari SQL analitik tingkat lanjut, pemodelan dimensional, dan Python produksi. Itu sejalan dengan persyaratan umum lowongan junior; langkah berikutnya adalah membangun proyek portofolio Anda sendiri.", "You have covered advanced analytical SQL, dimensional modeling, and production Python. That lines up with typical junior job requirements; the next step is building your own portfolio project.");
      tierBadge = this.l("Junior", "Junior");
      tierBadgeBg = "var(--blue)";
    } else if (readinessScore < 80) {
      tierTitle = this.l("Tahap 3: Kemampuan tingkat menengah", "Stage 3: Mid-level skills");
      tierDesc = this.l("Anda sudah mempelajari arsitektur lakehouse (Iceberg dan Delta Lake), dbt, orkestrasi, dan data quality contracts. Pengalaman produksi nyata tetap harus datang dari proyek atau pekerjaan.", "You have covered lakehouse architecture (Iceberg and Delta Lake), dbt, orchestration, and data quality contracts. Real production experience still has to come from projects or work.");
      tierBadge = this.l("Menengah", "Mid-level");
      tierBadgeBg = "var(--blue)";
    } else {
      tierTitle = this.l("Tahap 4: Seluruh kurikulum dipelajari", "Stage 4: Whole curriculum covered");
      tierDesc = this.l("Anda sudah mempelajari streaming terdistribusi (Spark, Kafka, CDC), FinOps, dan data engineering untuk AI. Gunakan Interview Sim dan portofolio untuk mengubah pengetahuan ini menjadi bukti.", "You have covered distributed streaming (Spark, Kafka, CDC), FinOps, and AI data engineering. Use the Interview Sim and a portfolio to turn this knowledge into evidence.");
      tierBadge = this.l("Lengkap", "Complete");
      tierBadgeBg = "var(--green)";
    }

    // 6 Competency Domains
    const domains = [
      {
        id: "sql",
        name: this.l("1. Kefasihan SQL & Analitik Data", "1. SQL & Analytical Querying"),
        mods: ["mod-0-3", "mod-1-3", "mod-1-4"],
        topics: this.l("Relasional, Indexing B-Tree, EXPLAIN ANALYZE, Window Functions, CTE Rekursif, Star Schema, SCD Type 2", "Relational schemas, B-Tree indexes, EXPLAIN ANALYZE, Window functions, Recursive CTEs, Star Schema, SCD Type 2"),
        sqlBonus: true
      },
      {
        id: "python",
        name: this.l("2. Software Craftsmanship & Production Python", "2. Software Craftsmanship & Production Python"),
        mods: ["mod-0-2", "mod-1-1", "mod-1-2"],
        topics: this.l("Linux Shell piping, Docker container limits (code 137), Pydantic v2 validation, Python Generators (flat RAM), Idempotensi, Pytest TDD", "Linux Shell pipes, Docker resource limits (code 137), Pydantic v2, Python Generators (flat RAM), Idempotency, Pytest TDD")
      },
      {
        id: "lakehouse",
        name: this.l("3. Arsitektur Lakehouse & Format Kolumnar", "3. Lakehouse Architecture & Columnar Storage"),
        mods: ["mod-2-1", "mod-2-2"],
        topics: this.l("Parquet columnar layout, Predicate pushdown, DuckDB & Polars, Apache Iceberg metadata tree, Delta Lake ACID logs, MinIO/SeaweedFS S3", "Parquet layout, Predicate pushdown, DuckDB & Polars, Apache Iceberg metadata tree, Delta Lake ACID logs, S3 storage")
      },
      {
        id: "transformation",
        name: this.l("4. Transformasi Data, Orkestrasi & Kualitas", "4. Data Transformation, Orchestration & Quality"),
        mods: ["mod-2-3", "mod-2-4", "mod-2-5"],
        topics: this.l("dbt Core Staging/Marts, Jinja macros, Dagster asset-based DAGs, Airflow, Data Contracts formal, Total Variation Distance drift, Dead-letter quarantine", "dbt Core Staging/Marts, Jinja macros, Dagster assets, Airflow, Data Contracts, Drift detection, Dead-letter quarantine")
      },
      {
        id: "streaming",
        name: this.l("5. Sistem Terdistribusi & Real-Time Streaming", "5. Distributed Scale & Real-Time Streaming"),
        mods: ["mod-3-1", "mod-3-2", "mod-3-3"],
        topics: this.l("Apache Spark shuffle & memory tuning, Skew salting, Apache Kafka KRaft partitions, Debezium CDC Postgres WAL replication slot, Watermarks & sliding windows", "Apache Spark shuffle & memory tuning, Skew salting, Kafka KRaft partitions, Debezium CDC Postgres WAL, Watermarks & sliding windows")
      },
      {
        id: "ops_ai",
        name: this.l("6. Infrastruktur Cloud, FinOps & AI Vector Data", "6. Cloud Infrastructure, FinOps & AI Vector Data"),
        mods: ["mod-3-4", "mod-3-5"],
        topics: this.l("Terraform IaC multi-env, FinOps warehouse budget limits & query runaway kill, pgvector cosine search, HNSW indexing tuning, RAG offline sync pipelines", "Terraform IaC multi-env, FinOps warehouse budget limits & query runaway kill, pgvector cosine search, HNSW tuning, RAG offline sync pipelines")
      }
    ];

    const domainScores = domains.map((d) => {
      const doneInDomain = d.mods.filter((m) => this.completedModules.includes(m)).length;
      let pct = (doneInDomain / d.mods.length) * 100;
      if (d.sqlBonus) {
        const bonus = Math.min(100, (solvedSqlCount / 20) * 100);
        pct = Math.round((pct * 0.7) + (bonus * 0.3));
      } else {
        pct = Math.round(pct);
      }
      return { ...d, pct, doneCount: doneInDomain, totalCount: d.mods.length };
    });

    // Checklist
    const checklist = [
      {
        label: this.l("Kefasihan SQL Analitik (Window functions, EXPLAIN query tuning)", "Advanced SQL Fluency (Window functions, EXPLAIN query tuning)"),
        done: this.completedModules.includes("mod-1-3") || solvedSqlCount >= 10
      },
      {
        label: this.l("Menulis pipeline Python idempoten dengan Automated Pytest", "Write idempotent Python pipelines with Automated Pytest"),
        done: this.completedModules.includes("mod-1-2")
      },
      {
        label: this.l("Pemodelan data dimensional (Kimball Star Schema & SCD Tipe 2)", "Dimensional data modeling (Kimball Star Schema & SCD Type 2)"),
        done: this.completedModules.includes("mod-1-4")
      },
      {
        label: this.l("Arsitektur Open Lakehouse (Iceberg / Delta Lake & dbt modeling)", "Open Lakehouse architecture (Iceberg / Delta Lake & dbt)"),
        done: this.completedModules.includes("mod-2-2") && this.completedModules.includes("mod-2-3")
      },
      {
        label: this.l("Memahami mitigasi insiden produksi nyata (Chaos Scenarios)", "Production incident mitigation experience (Chaos Scenarios)"),
        done: completedCount >= 5
      },
      {
        label: this.l("Memiliki rancangan proyek portofolio dengan dokumen ADR", "Portfolio capstone blueprint with Architectural Decision Record (ADR)"),
        done: completedCount >= 8
      },
      {
        label: this.l("Menyiapkan resume ATS-friendly berstandar internasional (kustomisasi & skor ≥ 70)", "International-ready ATS resume with quantitative impact metrics (customized & score ≥ 70)"),
        done: isResumeDone
      },
      {
        label: this.l("Memahami strategi kontrak remote internasional (W-8BEN, tarif USD)", "International remote contract strategy (W-8BEN, USD day rates)"),
        done: completedCount >= 12
      }
    ];

    // Next steps
    const nextSteps = [];
    if (completedCount === 0) nextSteps.push({ text: this.l("Mulai dari awal: siapkan komputer di halaman Mulai di sini, lalu kerjakan Modul 0.1.", "Start at the beginning: set up your computer on the Start here page, then do Module 0.1."), link: "#/start" });
    const resumeStep = !isResumeDone ? ({ text: this.l("Kustomisasi resume ATS Anda di Resume Builder (target skor ≥ 70) dengan formula dampak XYZ.", "Customize your ATS resume in Resume Builder (target score ≥ 70) using the XYZ impact formula."), link: "#/cv-builder" }) : null;
    if (!this.completedModules.includes("mod-0-3")) nextSteps.push({ text: this.l("Selesaikan Modul 0.3 untuk mengunci fondasi database relasional dan SQL.", "Complete Module 0.3 to solidify relational databases and SQL foundations."), link: "#/curriculum/mod-0-3/concepts" });
    if (!this.completedModules.includes("mod-1-2")) nextSteps.push({ text: this.l("Pelajari Modul 1.2 untuk menguasai Production Python, Pydantic, dan generator.", "Study Module 1.2 to master Production Python, Pydantic, and generators."), link: "#/curriculum/mod-1-2/concepts" });
    if (solvedSqlCount < 10) nextSteps.push({ text: this.l(`Selesaikan minimal 10 tantangan di SQL Sandbox (saat ini ${solvedSqlCount}/${totalSqlCount}).`, `Solve at least 10 challenges in the SQL Sandbox (currently ${solvedSqlCount}/${totalSqlCount}).`), link: "#/playground" });
    if (!this.completedModules.includes("mod-1-4")) nextSteps.push({ text: this.l("Kuasai pemodelan data dimensional dan SCD Tipe 2 di Modul 1.4.", "Master dimensional modeling and SCD Type 2 in Module 1.4."), link: "#/curriculum/mod-1-4/concepts" });
    if (!this.completedModules.includes("mod-2-3")) nextSteps.push({ text: this.l("Bangun data marts modern dengan dbt Core di Modul 2.3.", "Build modern data marts with dbt Core in Module 2.3."), link: "#/curriculum/mod-2-3/concepts" });
    if (nextSteps.length < 3 && !this.completedModules.includes("mod-3-2")) nextSteps.push({ text: this.l("Kuasai streaming real-time dengan Kafka dan CDC di Modul 3.2.", "Master real-time streaming with Kafka and CDC in Module 3.2."), link: "#/curriculum/mod-3-2/concepts" });
    if (nextSteps.length < 3) nextSteps.push({ text: this.l("Latih simulasi interview teknis dan system design di Interview Sim.", "Practice technical interview and system design drills in Interview Sim."), link: "#/interview" });
    if (resumeStep && nextSteps.length < 3) nextSteps.push(resumeStep);

    return `
      <div class="stack">
        <!-- Hero Header -->
        <div class="card stack-sm">
          <div class="row between">
            <div>
              <span class="chip chip-blue" style="margin-bottom:8px;display:inline-block">${this.l("Evaluasi Kesiapan Karir", "Career Readiness Evaluation")}</span>
              <h1>${this.l("Dashboard Kesiapan Kerja & Evaluasi Skill", "Job Readiness & Skill Assessment Dashboard")}</h1>
              <p class="muted" style="margin-top:4px">${this.l("Laporan komprehensif tingkat kesiapan kerja Data Engineer, penguasaan 6 pilar kompetensi, dan rencana aksi menuju standar industri global.", "Comprehensive Data Engineering job readiness report, 6-pillar competency mastery, and action plan toward global engineering standards.")}</p>
            </div>
            <div class="row no-print">
              <button class="btn btn-quiet" onclick="window.print()">🖨️ ${this.l("Cetak / Simpan PDF", "Print / Save PDF")}</button>
              <button class="btn btn-primary" onclick="app.go('roadmap')">${this.l("Buka Roadmap", "Open Roadmap")}</button>
            </div>
          </div>
        </div>

        <!-- Score Overview Grid -->
        <div class="grid cols-2">
          <!-- Readiness Score Card -->
          <div class="card stack-sm" style="display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div class="label">${this.l("Skor Kesiapan Kerja Keseluruhan", "Overall Job Readiness Score")}</div>
              <div class="row" style="align-items:baseline;gap:12px;margin:12px 0 6px">
                <span style="font-size:46px;font-weight:800;color:var(--blue);line-height:1">${readinessScore}%</span>
                <span class="chip" style="font-size:12px;padding:4px 10px;background:${tierBadgeBg};color:#fff;font-weight:600">${tierBadge}</span>
              </div>
              <div class="progress" style="height:10px;margin-bottom:12px">
                <div style="width:${readinessScore}%;background:var(--blue)"></div>
              </div>
              <h3 style="margin-bottom:6px">${tierTitle}</h3>
              <p class="small muted">${tierDesc}</p>
            </div>
            <div class="callout success" style="margin-top:16px">
              <strong>${this.l("Catatan jujur:", "An honest note:")}</strong><br>
              <span style="font-size:13px">${tierComp}</span>
            </div>
          </div>

          <!-- 4 Progress Stats Card -->
          <div class="card stack-sm">
            <div class="label">${this.l("Indikator Progres Belajar", "Learning Progress Indicators")}</div>
            <div class="grid cols-2" style="margin-top:8px">
              <div class="stat">
                <div class="muted small">${this.l("Kurikulum Diselesaikan", "Curriculum Done")}</div>
                <div class="num" style="margin-top:4px">${completedCount} <span style="font-size:13px;color:var(--text-muted);font-weight:normal">/ ${totalModules}</span></div>
                <div class="progress" style="height:4px;margin-top:6px"><div style="width:${Math.round((completedCount/totalModules)*100)}%"></div></div>
              </div>
              <div class="stat">
                <div class="muted small">${this.l("Tantangan SQL Tuntas", "SQL Challenges")}</div>
                <div class="num" style="margin-top:4px">${solvedSqlCount} <span style="font-size:13px;color:var(--text-muted);font-weight:normal">/ ${totalSqlCount}</span></div>
                <div class="progress" style="height:4px;margin-top:6px"><div style="width:${Math.round((solvedSqlCount/totalSqlCount)*100)}%"></div></div>
              </div>
              <div class="stat">
                <div class="muted small">${this.l("Akurasi Rata-rata Kuis", "Average Quiz Accuracy")}</div>
                <div class="num" style="margin-top:4px">${avgQuizPct}% <span style="font-size:13px;color:var(--text-muted);font-weight:normal">(${quizModIds.length} kuis)</span></div>
                <div class="progress" style="height:4px;margin-top:6px"><div style="width:${avgQuizPct}%"></div></div>
              </div>
              <div class="stat">
                <div class="muted small">${this.l("Skor ATS Resume", "ATS Resume Score")}</div>
                <div class="num" style="margin-top:4px">${this.resumeEdited ? resumeScoreTotal : "—"} <span style="font-size:13px;color:var(--text-muted);font-weight:normal">${this.resumeEdited ? "/ 100" : this.l("(belum diisi)", "(not filled in)")}</span></div>
                <div class="progress" style="height:4px;margin-top:6px"><div style="width:${this.resumeEdited ? resumeScoreTotal : 0}%"></div></div>
              </div>
            </div>
            <div class="well stack-sm" style="margin-top:12px;font-size:12px">
              <p class="muted">💡 ${this.l("Skor kesiapan dihitung transparan: 60% penguasaan modul kurikulum (kuis ≥ 80%), 25% tantangan SQL Sandbox, dan 15% kesiapan resume ATS & portofolio.", "Readiness score formula: 60% curriculum module mastery (quiz ≥ 80%), 25% SQL Sandbox challenges, and 15% ATS resume & portfolio readiness.")}</p>
            </div>
          </div>
        </div>

        <!-- 6 Pillars Competency Matrix -->
        <div class="card stack-sm">
          <div class="row between">
            <div>
              <h2>${this.l("Matriks 6 Domain Kompetensi Rekayasa Data", "6 Data Engineering Competency Domains")}</h2>
              <p class="muted small">${this.l("Evaluasi mendalam per pilar keterampilan teknis yang dicari oleh Hiring Manager & Lead Data Engineer.", "In-depth evaluation per technical skill pillar sought by Hiring Managers and Lead Data Engineers.")}</p>
            </div>
            <span class="chip ${completedCount >= 14 ? "chip-blue" : ""}">${completedCount >= 14 ? this.l("Tingkat Mahir", "Advanced Mastery") : this.l("Sedang Berjalan", "In Progress")}</span>
          </div>

          <div class="grid cols-3" style="margin-top:14px">
            ${domainScores.map((d) => `
              <div class="stat stack-sm" style="display:flex;flex-direction:column;justify-content:space-between">
                <div>
                  <div class="row between">
                    <strong style="font-size:13px">${this.esc(d.name)}</strong>
                    <span style="font-weight:700;color:${d.pct >= 80 ? "var(--green)" : d.pct >= 40 ? "var(--blue)" : "var(--text-muted)"}">${d.pct}%</span>
                  </div>
                  <div class="progress" style="height:6px;margin:8px 0 10px">
                    <div style="width:${d.pct}%;background:${d.pct >= 80 ? "var(--green)" : "var(--blue)"}"></div>
                  </div>
                  <div class="small muted" style="line-height:1.45">${this.esc(d.topics)}</div>
                </div>
                <div class="row between" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted)">
                  <span>${d.doneCount}/${d.totalCount} ${this.l("modul tuntas", "modules done")}</span>
                  <span>${d.pct >= 100 ? "✓ " + this.l("Kuasai", "Mastered") : d.pct > 0 ? this.l("Diproses", "Progressing") : this.l("Belum Mulai", "Not started")}</span>
                </div>
              </div>`).join("")}
          </div>
        </div>

        <!-- Hiring Checklist & Action Plan -->
        <div class="grid cols-2">
          <!-- Checklist -->
          <div class="card stack-sm">
            <h3>${this.l("Daftar Periksa Kualifikasi Kerja (Hiring Checklist)", "Hiring Qualification Checklist")}</h3>
            <p class="muted small">${this.l("Item kualifikasi yang otomatis tercentang saat Anda menyelesaikan modul & lab terkait:", "Qualification items automatically checked as you complete relevant modules & labs:")}</p>
            <div class="stack-sm" style="margin-top:12px">
              ${checklist.map((item) => `
                <div class="row" style="align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
                  <span style="font-size:16px;line-height:1;color:${item.done ? "var(--green)" : "var(--border-strong)"};font-weight:bold">${item.done ? "✓" : "○"}</span>
                  <span style="font-size:13px;color:${item.done ? "var(--text)" : "var(--text-muted)"};${item.done ? "font-weight:500" : ""}">${this.esc(item.label)}</span>
                </div>`).join("")}
            </div>
          </div>

          <!-- Recommended Next Steps -->
          <div class="card stack-sm">
            <h3>${this.l("Rencana Aksi & Prioritas Belajar Berikutnya", "Next Recommended Action Plan")}</h3>
            <p class="muted small">${this.l("Langkah-langkah paling bernilai tinggi untuk memaksimalkan kesiapan karir Anda saat ini:", "High-impact next steps to maximize your job readiness right now:")}</p>
            <div class="stack-sm" style="margin-top:12px">
              ${nextSteps.slice(0, 3).map((ns, idx) => `
                <div class="well stack-sm" style="padding:10px 14px">
                  <div class="row between">
                    <span class="label" style="margin:0">${this.l("Prioritas", "Priority")} #${idx + 1}</span>
                    <a href="${ns.link}" class="small" style="font-weight:600">${this.l("Buka Modul", "Open Step")} →</a>
                  </div>
                  <p style="font-size:13px;margin-top:4px">${this.esc(ns.text)}</p>
                </div>`).join("")}
            </div>
            <div class="callout neutral" style="margin-top:14px">
              <strong>${this.l("Saran Karir Mentor:", "Mentor Career Tip:")}</strong><br>
              <span class="small">${this.l("Jangan menunggu skor 100% untuk mulai menyiapkan portofolio. Saat skor kesiapan Anda mencapai 50%, mulailah membuat akun GitHub publik dan menyusun resume menggunakan ATS Resume Builder kami.", "Do not wait for 100% to start building your portfolio. Once your readiness hits 50%, start an active public GitHub profile and craft your resume with our ATS Resume Builder.")}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ================= REMOTE PLAYBOOK =================
  renderRemotePlaybookView() {
    const pb = window.REMOTE_PLAYBOOK;
    const ov = pb.overview[this.lang] || pb.overview.en;
    const section = (i, body) => `<div class="card stack-sm"><h2>${this.esc(this.t(pb.sections[i].title))}</h2><p class="muted">${this.esc(this.t(pb.sections[i].description))}</p>${body}</div>`;
    return `
      <div class="stack">
        <div class="card stack-sm">
          <h1>${this.esc(ov.title)}</h1>
          <p class="muted" style="font-size:15px">${this.esc(ov.subtitle)}</p>
          <div class="callout"><strong>${this.l("Mengapa ini penting?", "Why does this matter?")}</strong><br>${this.esc(ov.whyImportant)}</div>
        </div>
        ${section(0, pb.sections[0].templates.map((tp) => `
          <div class="well stack-sm"><div class="label">${this.esc(this.t(tp.stage))}</div><pre><code>${this.esc(tp.pattern)}</code></pre><p class="small muted">${this.esc(this.t(tp.whyItWorks))}</p></div>`).join(""))}
        ${section(1, `<pre><code>${this.esc(pb.sections[1].sampleRfc)}</code></pre>`)}
        ${section(2, `<div class="grid cols-2">${pb.sections[2].slackTemplates.map((st) => `<div class="well stack-sm"><div class="label">${this.esc(this.t(st.phase))}</div><pre><code>${this.esc(st.text)}</code></pre></div>`).join("")}</div>`)}
        ${section(3, pb.sections[3].starExamples.map((s) => `<div class="well stack-sm"><div class="label">${this.esc(this.t(s.question))}</div>${this.md(s.answer)}</div>`).join(""))}
        ${section(4, `<div class="grid cols-2">${pb.sections[4].tips.map((tip) => `<div class="well stack-sm"><div class="label">${this.esc(this.t(tip.topic))}</div><p>${this.esc(this.t(tip.detail))}</p></div>`).join("")}</div>`)}
      </div>`;
  }
}

window.addEventListener("DOMContentLoaded", () => { window.app = new DataForgeApp(); });
