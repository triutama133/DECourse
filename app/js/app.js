// DataForge application controller.
// Hash routing (#/curriculum/mod-1-3/lab), bilingual ID/EN, progress stored in localStorage.

const VIEWS = ["roadmap", "curriculum", "interview", "portfolio", "cv-builder", "playground", "readiness", "remote-playbook"];
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
    this.currentView = "roadmap";
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
    this.resumeData = readStore("df_resume_data", null) || JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    const savedLang = readStore("df_lang", "id");
    this.lang = savedLang === "en" ? "en" : "id";

    this.quizOrder = {};      // moduleId -> shuffled option order (per page load)
    this.sandbox = { datasetKey: "ecommerce", challengeId: null, status: "loading", message: null, result: null, hintOpen: false, solutionOpen: false };

    this.renderChrome();
    window.addEventListener("hashchange", () => this.readHash());
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
        out.push(`<pre${m[1] ? ` data-lang="${this.esc(m[1])}"` : ""}><code>${this.esc(body.join("\n"))}</code></pre>`);
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
  readHash() {
    const parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const view = VIEWS.includes(parts[0]) ? parts[0] : "roadmap";
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
  }
  go(view, ...rest) {
    const hash = "#/" + [view, ...rest].join("/");
    if (location.hash === hash) this.readHash(); else location.hash = hash;
  }
  switchView(view) { this.go(view); }

  // ---------- chrome (header/nav/footer) ----------
  renderChrome() {
    const labels = {
      "roadmap": this.tr("navRoadmap"), "curriculum": this.tr("navCurriculum"), "interview": this.tr("navInterview"),
      "portfolio": this.tr("navPortfolio"), "cv-builder": this.tr("navCvBuilder"), "playground": this.tr("navPlayground"),
      "readiness": this.tr("navReadiness"), "remote-playbook": this.tr("navRemote")
    };
    document.getElementById("nav").innerHTML = VIEWS.map((v) =>
      `<button class="${v === this.currentView ? "active" : ""}" onclick="app.go('${v}')">${this.esc(labels[v])}</button>`).join("");
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
        <div class="progress"><div style="width:${pct}%"></div></div>
      </div>`;
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
            <button class="btn btn-primary" onclick="app.go('curriculum')">${t.ctaStartCurriculum}</button>
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
              <button style="flex:1" class="${lvl.levelId === level.levelId ? "active" : ""}" onclick="app.go('curriculum','${lvl.modules[0].id}')">${this.esc(this.t(lvl.badge))}</button>`).join("")}
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
            <div class="tabs">
              ${MODULE_TABS.map((k) => `<button class="${this.activeModuleTab === k ? "active" : ""}" onclick="app.go('curriculum','${mod.id}','${k}')">${tabLabels[k]}</button>`).join("")}
            </div>
            <div class="stack" style="padding-top:8px">${this.renderModuleTabContent(mod, t)}</div>
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
    const r = this.resumeData;
    const field = (label, path, value) => `
      <div><label class="field">${label}</label><input type="text" value="${this.esc(value)}" oninput="app.updateCvField('${path}', this.value)"></div>`;
    return `
      <div class="stack">
        <div class="card row between no-print">
          <div><h1>${t.cvTitle}</h1><p class="sub">${t.cvSubtitle}</p></div>
          <div class="row">
            <button class="btn" onclick="app.loadSampleCv()">${t.btnLoadTemplate}</button>
            <button class="btn btn-primary" onclick="window.print()">${t.btnPrintPdf}</button>
          </div>
        </div>
        <div class="card stack-sm no-print" id="ats-panel">${this.renderAtsPanel()}</div>
        <div class="split-cv">
          <div class="stack no-print">
            <div class="card stack-sm">
              <h3>${this.l("Editor resume", "Resume editor")}</h3>
              ${field("Full name", "personal.fullName", r.personal.fullName)}
              ${field("Title", "personal.title", r.personal.title)}
              <div class="grid cols-2">${field("Email", "personal.email", r.personal.email)}${field("Location", "personal.location", r.personal.location)}</div>
              <div><label class="field">Summary</label><textarea rows="4" oninput="app.updateCvField('summary', this.value)">${this.esc(r.summary)}</textarea></div>
            </div>
            <div class="card stack-sm">
              <h3>${this.l("Contoh bullet (rumus XYZ)", "Example bullets (XYZ formula)")}</h3>
              <p class="muted small">${this.l("Klik untuk menyalin. Ganti angka dengan hasil Anda sendiri; jangan mengklaim hal yang tidak Anda kerjakan.", "Click to copy. Replace the numbers with your own results; never claim work you did not do.")}</p>
              ${CV_DATA.bulletLibrary.map((cat, ci) => `
                <div class="stack-sm">
                  <div class="label">${this.esc(cat.category)}</div>
                  ${cat.bullets.map((b, bi) => `<button class="item small" onclick="app.copyBullet(${ci},${bi})">${this.esc(b)}</button>`).join("")}
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
      <p class="muted small">${this.l("Skor ini hanya heuristik sederhana (hitung angka dan kata kunci), bukan penilaian ATS sungguhan.", "This score is a simple heuristic (it counts numbers and keywords), not a real ATS verdict.")}</p>`;
  }

  renderCvPreview() {
    const r = this.resumeData;
    return `
      <div class="paper" id="cv-preview-card">
        <h1>${this.esc(r.personal.fullName)}</h1>
        <div class="center" style="color:#0a66c2;font-weight:600">${this.esc(r.personal.title)}</div>
        <div class="center" style="color:#555">${this.esc(r.personal.email)} · ${this.esc(r.personal.location)} · ${this.esc(r.personal.linkedin)}</div>
        <h3>Summary</h3><p>${this.esc(r.summary)}</p>
        <h3>Technical Proficiencies</h3>
        <div><strong>Languages:</strong> ${this.esc(r.skills.languages)}</div>
        <div><strong>Storage:</strong> ${this.esc(r.skills.storageTableFormats)}</div>
        <div><strong>Processing:</strong> ${this.esc(r.skills.processingStreaming)}</div>
        <div><strong>Orchestration:</strong> ${this.esc(r.skills.orchestrationOps)}</div>
        <h3>Experience</h3>
        ${r.experience.map((e) => `
          <div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><strong>${this.esc(e.company)} — ${this.esc(e.role)}</strong><span style="color:#555">${this.esc(e.period)}</span></div>
          <ul>${e.highlights.map((h) => `<li>${this.esc(h)}</li>`).join("")}</ul></div>`).join("")}
        <h3>Projects</h3>
        ${r.projects.map((p) => `<div style="margin-bottom:6px"><strong>${this.esc(p.name)}</strong> <span style="color:#555">(${this.esc(p.tech)})</span><div>${this.esc(p.description)}</div></div>`).join("")}
      </div>`;
  }

  // Update data and refresh only the preview and score: re-rendering the editor would drop input focus.
  updateCvField(path, val) {
    if (path.startsWith("personal.")) this.resumeData.personal[path.split(".")[1]] = val;
    else this.resumeData[path] = val;
    writeStore("df_resume_data", this.resumeData);
    const preview = document.getElementById("cv-preview");
    const ats = document.getElementById("ats-panel");
    if (preview) preview.innerHTML = this.renderCvPreview();
    if (ats) ats.innerHTML = this.renderAtsPanel();
  }

  loadSampleCv() {
    this.resumeData = JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    writeStore("df_resume_data", this.resumeData);
    this.renderView();
  }

  copyBullet(ci, bi) {
    const text = CV_DATA.bulletLibrary[ci].bullets[bi];
    const done = () => { /* silent: the button text does not change */ };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
  }

  calculateAtsScore() {
    const score = { totalScore: 0, breakdown: { metrics: 0, tech: 0, differentiation: 25, actionVerbs: 0 }, recommendations: [] };
    const text = JSON.stringify(this.resumeData).toLowerCase();
    const metricMatches = (text.match(/(\d+%|\$\d+|\d+gb|\d+tb|\d+ms|\d+m\b|\d+k\b)/g) || []).length;
    score.breakdown.metrics = Math.min(25, metricMatches * 3);
    if (score.breakdown.metrics < 20) score.recommendations.push(this.l("Tambahkan metrik terukur (omset, volume GB/TB, latensi ms).", "Add measurable metrics (cost, GB/TB volume, latency)."));
    const techKeywords = ["iceberg", "duckdb", "dbt", "dagster", "redpanda", "kafka", "pydantic", "flink", "terraform"];
    score.breakdown.tech = Math.min(25, techKeywords.filter((k) => text.includes(k)).length * 3);
    const verbs = ["architected", "engineered", "optimized", "refactored", "deployed", "scaled"];
    score.breakdown.actionVerbs = Math.min(25, verbs.filter((v) => text.includes(v)).length * 4);
    if (text.includes("dashboard") && !text.includes("idempotency") && !text.includes("cdc")) {
      score.breakdown.differentiation = 12;
      score.recommendations.push(this.l("Kurangi istilah dashboard/reporting; tunjukkan pipeline dan reliabilitas.", "Lean less on dashboard/reporting wording; show pipelines and reliability."));
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

    // Readiness Score (0 to 100)
    // 60% Curriculum Modules, 25% SQL Sandbox, 15% Career Assets (Resume + Portfolio)
    const modWeight = (completedCount / totalModules) * 60;
    const sqlWeight = (Math.min(solvedSqlCount, 25) / 25) * 25;
    const careerWeight = (resumeScoreTotal >= 70 ? 7.5 : 0) + (completedCount >= 8 ? 7.5 : 0);
    const readinessScore = Math.min(100, Math.round(modWeight + sqlWeight + careerWeight));

    // Career Tier & Compensation
    let tierTitle, tierDesc, tierComp, tierBadge, tierBadgeBg;
    if (readinessScore < 25) {
      tierTitle = this.l("Fase 1: Penjelajah Fondasi (Foundations in Progress)", "Phase 1: Foundations in Progress");
      tierDesc = this.l("Sedang membangun fondasi Linux, Git, SQL relasional, dan Python produksi. Fokus selesaikan Level 0 dan Level 1 terlebih dahulu.", "Building core foundations: Linux, Git, relational SQL, and production Python. Complete Level 0 and Level 1 first.");
      tierComp = this.l("Target: Magang / Belajar Mandiri Terarah", "Target: Apprenticeship / Focused Self-study");
      tierBadge = this.l("Fondasi", "Foundations");
      tierBadgeBg = "var(--blue)";
    } else if (readinessScore < 55) {
      tierTitle = this.l("Fase 2: Siap Kerja Junior (Junior Data / Analytics Engineer Ready)", "Phase 2: Junior Data / Analytics Engineer Ready");
      tierDesc = this.l("Fasih SQL analitik tingkat lanjut, pemodelan data dimensional (Star Schema), dan Python streaming idempoten. Anda siap melamar posisi Junior Data Engineer atau Analytics Engineer.", "Fluent in advanced analytical SQL, Kimball Star Schema modeling, and idempotent Python streaming. Ready for Junior Data / Analytics Engineer roles.");
      tierComp = this.l("IDR 8jt – 18jt / bln (Lokal)  ·  $1.500 – $2.800 / bln (Remote Entry-Level)", "IDR 8M–18M / mo (Local) · $1,500–$2,800 / mo (Remote Entry)");
      tierBadge = this.l("Siap Junior", "Junior Ready");
      tierBadgeBg = "var(--green)";
    } else if (readinessScore < 80) {
      tierTitle = this.l("Fase 3: Siap Kerja Mid-Level (Mid-Level Lakehouse Engineer Ready)", "Phase 3: Mid-Level Lakehouse Engineer Ready");
      tierDesc = this.l("Menguasai arsitektur open lakehouse (Iceberg & Delta Lake), transformasi data dbt tingkat lanjut, Dagster orkestrasi, dan penegakan data quality contracts.", "Proficient in open lakehouse architecture (Iceberg & Delta Lake), dbt transformation marts, Dagster orchestration, and data quality contracts.");
      tierComp = this.l("IDR 20jt – 38jt / bln (Lokal)  ·  $3.500 – $5.500 / bln (Remote Global)", "IDR 20M–38M / mo (Local) · $3,500–$5,500 / mo (Remote Global)");
      tierBadge = this.l("Siap Mid-Level", "Mid-Level Ready");
      tierBadgeBg = "var(--green)";
    } else {
      tierTitle = this.l("Fase 4: Siap Kerja Global Remote & Senior (Global Remote Senior DE Ready)", "Phase 4: Global Remote Senior DE Ready");
      tierDesc = this.l("Menguasai sistem streaming terdistribusi (Spark Internals, Kafka CDC), FinOps efisiensi biaya cloud, serta AI Vector Data Engineering. Siap bersaing di bursa kerja internasional (USD).", "Mastered distributed streaming (Spark internals, Kafka CDC), cloud FinOps cost governance, and AI Vector Engineering. Ready for global US/EU remote roles (USD).");
      tierComp = this.l("$5.000 – $9.000+ / bln (USD Remote Global B2B Contract)", "$5,000 – $9,000+ / mo (USD Global Remote B2B Contract)");
      tierBadge = this.l("Siap Global Remote", "Global Remote Ready");
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
        label: this.l("Menyiapkan resume ATS-friendly berstandar internasional", "International-ready ATS resume with quantitative impact metrics"),
        done: resumeScoreTotal >= 70
      },
      {
        label: this.l("Memahami strategi kontrak remote internasional (W-8BEN, tarif USD)", "International remote contract strategy (W-8BEN, USD day rates)"),
        done: completedCount >= 12
      }
    ];

    // Next steps
    const nextSteps = [];
    if (!this.completedModules.includes("mod-0-3")) nextSteps.push({ text: this.l("Selesaikan Modul 0.3 untuk mengunci fondasi database relasional dan SQL.", "Complete Module 0.3 to solidify relational databases and SQL foundations."), link: "#/curriculum/mod-0-3/concepts" });
    if (!this.completedModules.includes("mod-1-2")) nextSteps.push({ text: this.l("Pelajari Modul 1.2 untuk menguasai Production Python, Pydantic, dan generator.", "Study Module 1.2 to master Production Python, Pydantic, and generators."), link: "#/curriculum/mod-1-2/concepts" });
    if (solvedSqlCount < 10) nextSteps.push({ text: this.l(`Selesaikan minimal 10 tantangan di SQL Sandbox (saat ini ${solvedSqlCount}/${totalSqlCount}).`, `Solve at least 10 challenges in the SQL Sandbox (currently ${solvedSqlCount}/${totalSqlCount}).`), link: "#/playground" });
    if (!this.completedModules.includes("mod-1-4")) nextSteps.push({ text: this.l("Kuasai pemodelan data dimensional dan SCD Tipe 2 di Modul 1.4.", "Master dimensional modeling and SCD Type 2 in Module 1.4."), link: "#/curriculum/mod-1-4/concepts" });
    if (!this.completedModules.includes("mod-2-3")) nextSteps.push({ text: this.l("Bangun data marts modern dengan dbt Core di Modul 2.3.", "Build modern data marts with dbt Core in Module 2.3."), link: "#/curriculum/mod-2-3/concepts" });
    if (nextSteps.length < 3 && !this.completedModules.includes("mod-3-2")) nextSteps.push({ text: this.l("Kuasai streaming real-time dengan Kafka dan CDC di Modul 3.2.", "Master real-time streaming with Kafka and CDC in Module 3.2."), link: "#/curriculum/mod-3-2/concepts" });
    if (nextSteps.length < 3) nextSteps.push({ text: this.l("Latih simulasi interview teknis dan system design di Interview Sim.", "Practice technical interview and system design drills in Interview Sim."), link: "#/interview" });

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
              <strong>${this.l("Target Kompensasi Pasar:", "Market Compensation Target:")}</strong><br>
              <span style="font-size:13px;font-weight:600">${tierComp}</span>
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
                <div class="num" style="margin-top:4px">${resumeScoreTotal} <span style="font-size:13px;color:var(--text-muted);font-weight:normal">/ 100</span></div>
                <div class="progress" style="height:4px;margin-top:6px"><div style="width:${resumeScoreTotal}%"></div></div>
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
