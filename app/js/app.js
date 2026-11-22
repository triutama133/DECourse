// DataForge application controller.
// Hash routing (#/curriculum/mod-1-3/lab), bilingual ID/EN, progress stored in localStorage.

const REPO_URL = "https://github.com/triutama133/DECourse";
const VIEWS = ["start", "roadmap", "curriculum", "job-sim", "interview", "portfolio", "cv-builder", "playground", "readiness", "remote-playbook"];
const MODULE_TABS = ["concepts", "lab", "chaos", "quiz"];
// modules with a local chaos drill in scripts/chaos_drill.py (its self-test checks this list)
const CHAOS_DRILL_MODULES = ["mod-0-0", "mod-0-2", "mod-0-3", "mod-1-2", "mod-1-4", "mod-1-5", "mod-3-3", "mod-3-5"];
const INTERVIEW_TABS = ["system-design", "sql-arena", "incidents", "silent-bugs", "pr-review", "active-recall", "stakeholder-defense"];

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return raw; }   // plain text written by earlier versions (language, theme, code drafts)
  } catch (e) {
    return fallback;
  }
}
// Saving any of these means the learner studied today, so they move the 🔥 streak (opening the site does not).
const STUDY_KEYS = new Set(["df_lessons_done", "df_tryit_done", "df_quiz_scores", "df_bl_runs", "df_sql_attempts", "df_solved_challenges", "df_chaos_done", "df_proofs", "df_explain", "df_chaos_proofs", "df_portfolio_proofs", "df_job_sim_proofs", "df_job_sim_gates", "df_pr_proofs", "df_bug_drills", "df_active_recall", "df_interview_drafts", "df_stakeholder_defense", "df_interview_sim"]);
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* storage unavailable (private mode): keep working in memory */ }
  if (STUDY_KEYS.has(key) && window.app && !window.app._importing) window.app.recordStudy();
}
function mod_next_exists(app, modId, idx) {
  const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === modId);
  return Boolean(mod && idx + 1 < mod.lessons.length);
}
function localDay(d = new Date()) {   // the learner's own calendar day, not the UTC one
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayGap(from, to) { return Math.round((new Date(to + "T00:00:00Z") - new Date(from + "T00:00:00Z")) / 86400000); }

class DataForgeApp {
  constructor() {
    this.currentView = "start";
    this.activeLevelId = "zero";
    this.activeModuleId = "mod-0-0";
    this.activeModuleTab = "concepts";
    this.activeLessonIdx = null;
    this.sideOpen = {};   // sidebar: which modules show their lesson list (the current module does unless closed)   // null = the module overview with its lesson map; a number = one lesson on screen
    this.activeInterviewTab = "system-design";
    this.activeSystemDesignId = "sd-1";
    this.activeSqlId = "sql-1";
    this.activeDrillId = "drill-1";
    this.activeBugId = "bug-not-in-null";
    this.activePortfolioId = "proj-1";
    this.activeJobStoryId = "kopiku";
    this.activeJobLevel = "easy";
    this.jobSimProofs = readStore("df_job_sim_proofs", {}) || {};
    this.jobSimGates = readStore("df_job_sim_gates", {}) || {};
    this.activePrId = "pr-1";
    this.prProofs = readStore("df_pr_proofs", {}) || {};

    this.completedModules = readStore("df_completed_modules", []);
    this.quizScores = readStore("df_quiz_scores", {});
    this.solvedChallenges = readStore("df_solved_challenges", []);
    this.resumeEdited = readStore("df_resume_edited", false);
    this.resumeData = readStore("df_resume_data", null) || JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    this.lessonsDone = readStore("df_lessons_done", {}) || {};
    this.stepMode = readStore("df_step_mode", null);      // "steps" | "page" | null (null: steps for the beginner levels)
    this.stepPos = readStore("df_step_pos", {}) || {};    // "mod:lesson" -> the step the learner stopped at
    this.stepCache = {};
    try { this.labReturn = JSON.parse(sessionStorage.getItem("df_lab_return") || "null"); } catch (e) { this.labReturn = null; }   // {modId, from}: the lesson the learner left for its lab step (kept over a page reload)
    this.tryitDone = readStore("df_tryit_done", {}) || {};
    this.tryitPaste = readStore("df_tryit_paste", {}) || {};   // what the learner pasted from their own terminal, per Try it
    this._tryitExpect = {};
    this.drillsDone = readStore("df_drills", {}) || {};       // "mod:lesson:n" -> {passed: iso} or {revealed: iso}
    this.drillCode = readStore("df_drill_code", {}) || {};    // the learner's code per drill
    this._drills = {};
    this.chaosDone = readStore("df_chaos_done", {}) || {};
    this.moduleNotes = readStore("df_module_notes", {}) || {};
    this.sqlAttempts = readStore("df_sql_attempts", {}) || {};
    this.interviewDrafts = readStore("df_interview_drafts", {}) || {};
    this.bugState = readStore("df_bug_drills", {}) || {};
    this.recallState = readStore("df_active_recall", {}) || {};
    this.chaosProofs = readStore("df_chaos_proofs", {}) || {};
    this.portfolioProofs = readStore("df_portfolio_proofs", {}) || {};
    this.defenseState = readStore("df_stakeholder_defense", {}) || {};
    this.savedTips = readStore("df_saved_tips", []) || [];
    this.activeCareerPath = readStore("df_career_path", "all") || "all";
    this.quizMode = readStore("df_quiz_mode", "uxcel") || "uxcel";
    this.focusMode = Boolean(readStore("df_focus_mode", false));
    this.animState = {};
    this._animTimers = {};
    this.uxcelQuizState = {};
    this.duelState = { open: false, round: 0, score: 0, answers: [], startedAt: 0, finished: false };
    this.soundEnabled = readStore("df_sound", true) !== false;
    this.a11yLarge = Boolean(readStore("df_a11y_large", false));
    if (document.documentElement && document.documentElement.setAttribute) {
      document.documentElement.setAttribute("data-a11y", this.a11yLarge ? "large" : "normal");
    }
    this.touchStreak();
    this.activeDefenseId = "def-stage1-kafka";
    this.selectedJdId = "jd-analytics-warehouse";
    this.customJdText = "";
    this.activeRecallIdx = 0;
    this.recallRevealed = false;
    this.recallDraft = "";
    this.simState = {
      fanoutDupes: 3,
      fanoutStrategy: "naive",
      partTb: 10,
      partDays: 365,
      partQueryDays: 7,
      partWrapped: true,
      wmToleranceMin: 15,
      wmLatePct: 12,
      idemRetries: 3,
      idemStrategy: "append"
    };
    this.lessonFilter = "all";
    const savedLang = readStore("df_lang", "id");
    this.lang = savedLang === "en" ? "en" : "id";
    const savedTheme = readStore("df_theme", null);     // no saved choice yet: follow the operating system
    const systemDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    this.theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : (systemDark ? "dark" : "light");
    if (document.documentElement && document.documentElement.setAttribute) {
      document.documentElement.setAttribute("data-theme", this.theme);
    }

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
    // protect `code` spans first so that **bold**, *italic* and [links] may wrap or contain them
    const codes = [];
    const protectedText = String(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    return this.esc(protectedText)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![\w*])/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\u0000(\d+)\u0000/g, (m, n) => `<code>${this.esc(codes[Number(n)])}</code>`);
  }

  renderQuoteBody(lines) {
    const out = [];
    const isBullet = (l) => /^\s*[-*] /.test(l);
    const isOrdered = (l) => /^\s*\d+\. /.test(l);
    const isStandaloneCmd = (l) => /^`((?:pytest|python3?|curl|git|docker|dbt|terraform)\s+[^`]+)`\s*$/.test(l.trim());
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; continue; }
      let m;
      if ((m = line.trim().match(/^```\s*([\w+-]*)\s*$/))) {
        // a fenced code block inside a callout (``` ... ```), indentation kept: Python needs it
        const lang = m[1];
        const code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
        i++;
        out.push(`<div class="code-wrap" style="margin:6px 0"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre${lang ? ` data-lang="${this.esc(lang)}"` : ""}><code>${this.esc(code.join("\n"))}</code></pre></div>`);
      } else if ((m = line.trim().match(/^`((?:pytest|python3?|curl|git|docker|dbt|terraform)\s+[^`]+)`$/))) {
        out.push(`<div class="code-wrap" style="margin:6px 0"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(m[1])}</code></pre></div>`);
        i++;
      } else if (isBullet(line) || isOrdered(line)) {
        const ordered = isOrdered(line);
        const start = ordered ? parseInt(line.match(/^\s*(\d+)\./)[1], 10) : 1;
        const items = [];
        while (i < lines.length && (ordered ? isOrdered(lines[i]) : isBullet(lines[i]))) {
          const item = [lines[i].replace(/^\s*(?:[-*]|\d+\.) /, "")];
          i++;
          while (i < lines.length && lines[i].trim() !== "" && !isBullet(lines[i]) && !isOrdered(lines[i]) && !isStandaloneCmd(lines[i]) && !/^(?:\*\*(?:You should see|Check it|Yang harus Anda lihat|Seharusnya Anda melihat|Periksa):|\*(?:Compare when you are done|Bandingkan))/i.test(lines[i].trim())) {
            item.push(lines[i++].trim());
          }
          items.push(item.join(" "));
        }
        const tag = ordered ? "ol" : "ul";
        out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ""}>${items.map((it) => `<li>${this.inline(it)}</li>`).join("")}</${tag}>`);
      } else {
        const p = [];
        while (i < lines.length && lines[i].trim() !== "" && !isBullet(lines[i]) && !isOrdered(lines[i]) && !isStandaloneCmd(lines[i]) && !/^\s*```/.test(lines[i])) {
          p.push(lines[i++]);
        }
        out.push(`<p>${p.map((x) => this.inline(x)).join("<br>")}</p>`);
      }
    }
    return out.join("");
  }

  renderQuoteBlock(q, ctx, qIdx) {
    const first = (q[0] || "").trim();
    // GitHub-style alert ("> [!IMPORTANT]"): drop the marker line and colour the callout by its type
    const alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i.exec(first);
    if (alert) {
      const kind = /^(WARNING|CAUTION)$/i.test(alert[1]) ? "danger" : /^TIP$/i.test(alert[1]) ? "success" : "";
      return `<div class="callout ${kind}">${this.renderQuoteBody(q.slice(1))}</div>`;
    }
    // 1. Key Mental Model / In short
    if (/^\*\*(In short|Intinya|Ringkasan|TL;DR):?\*\*/i.test(first)) {
      const cleaned = q.slice();
      cleaned[0] = cleaned[0].replace(/^\*\*(In short|Intinya|Ringkasan|TL;DR):?\*\*\s*/i, "");
      return `
        <div class="callout-tldr">
          <div class="callout-head">🎯 ${this.l("Intisari & Model Mental", "In Short · Key Mental Model")}</div>
          ${this.renderQuoteBody(cleaned)}
        </div>`;
    }
    // 2. Interactive Hands-on Try It
    if (/^(🛠|\*\*(Try it|Coba sendiri))/i.test(first)) {
      const tryitKey = ctx && ctx.modId !== undefined ? `${ctx.modId}:${ctx.lessonIdx || 0}:${qIdx}` : "";
      const savedVal = tryitKey ? this.tryitDone[tryitKey] : null;
      const isDone = Boolean(savedVal);
      const mainLines = [];
      const revealLines = [];
      const checkLines = [];
      let mode = "main";
      for (const ln of q) {
        const t = ln.trim();
        if (/^(\*\*(You should see|Yang harus Anda lihat|Seharusnya Anda melihat)|\*(Compare when you are done|Bandingkan))/i.test(t)) {
          mode = "reveal";
        } else if (/^\*\*(Check it|Periksa):?\*\*/i.test(t)) {
          mode = "check";
        }
        if (mode === "reveal") revealLines.push(ln);
        else if (mode === "check") checkLines.push(ln);
        else mainLines.push(ln);
      }
      let checkCmdHtml = "";
      let checkIdent = null;
      if (checkLines.length) {
        const joinedCheck = checkLines.join(" ");
        const cmdMatch = joinedCheck.match(/`((?:python3?\s+labs\/tryit\/check\.py|pytest)\s+[^`]+)`/);
        if (cmdMatch) {
          checkCmdHtml = `<div class="code-wrap" style="margin-top:6px"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin perintah cek", "Copy check cmd")}</button><pre><code>${this.esc(cmdMatch[1])}</code></pre></div>`;
          const idMatch = cmdMatch[1].match(/labs\/tryit\/check\.py\s+([0-9]+\.[0-9]+-[0-9]+)/);
          if (idMatch) checkIdent = idMatch[1];
        }
      }
      const verifiedToken = (savedVal && typeof savedVal === "object" && savedVal.token) ? savedVal.token : "";
      const headerControl = checkIdent
        ? `<span class="chip ${verifiedToken ? "chip-blue" : ""}">${verifiedToken ? `✓ ${this.l("Terbukti di Sistem", "Verified on System")} (${savedVal.passed} checks)` : `🔒 ${this.l("Wajib Cek Lokal (TRY1)", "Requires Local Check (TRY1)")}`}</span>`
        : (tryitKey ? `<button class="btn btn-sm ${isDone ? "btn-done" : "btn-quiet"}" onclick="app.toggleTryIt('${tryitKey}')">${isDone ? "✓ " + this.l("Sudah Dicoba", "Tried & Checked") : "○ " + this.l("Tandai Sudah Dicoba", "Mark as Tried")}</button>` : "");

      const whereHtml = this.tryItWhere(mainLines, ctx);
      const expected = !checkIdent && tryitKey ? this.tryitExpected(revealLines) : [];
      if (expected.length) this._tryitExpect[tryitKey] = expected;
      const pasteHtml = expected.length ? this.tryitPasteBox(tryitKey) : "";
      const padKind = /^(repl|python)$/.test(this._whereKind || "");   // set by tryItWhere just above
      const tryPad = padKind && ctx && ctx.modId && ctx.lessonIdx != null
        ? this.padHtml(`${ctx.modId}:${ctx.lessonIdx}`, `# ${this.l("Ketik baris dari latihan di sini. Variabel tetap ada antar-eksekusi (seperti di prompt >>>).", "Type the lines from the exercise here. Variables stay between runs (like at the >>> prompt).")}\n`, this.l("▶ Atau coba di browser (tanpa instalasi)", "▶ Or try it in the browser (nothing to install)"))
        : "";
      return `
        <div class="callout-tryit ${isDone ? "is-done" : ""}">
          <div class="callout-head">
            <span class="callout-badge">🛠 ${this.l("Latihan Praktik Langsung (Try It)", "Hands-On Practice (Try It)")}</span>
            ${headerControl}
          </div>
          <div class="stack-sm">
            ${this.renderQuoteBody(mainLines)}
            ${whereHtml}
            ${tryPad}
            ${pasteHtml}
            ${revealLines.length ? `
              <details class="tryit-reveal">
                <summary>👁️ ${this.l("Buka Hasil yang Diharapkan & Kunci Pemeriksaan Mandiri", "Reveal Expected Output & Self-Check Answer")}</summary>
                <div class="stack-sm">${this.renderQuoteBody(revealLines)}</div>
              </details>` : ""}
            ${checkLines.length ? `
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(5,118,66,0.15)" class="stack-sm">
                ${this.renderQuoteBody(checkLines)}
                ${checkCmdHtml}
                ${checkIdent && tryitKey ? `
                  <div class="row" style="margin-top:6px">
                    <input type="text" id="tryit-input-${tryitKey}" autocomplete="off" spellcheck="false" placeholder="TRY1:${checkIdent}:…" value="${this.esc(verifiedToken)}" style="flex:1;min-width:220px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px" onkeydown="if(event.key==='Enter'){app.submitTryItProof('${tryitKey}','${checkIdent}')}" />
                    <button class="btn btn-sm btn-primary" onclick="app.submitTryItProof('${tryitKey}','${checkIdent}')">${this.l("Verifikasi Kode TRY1", "Verify TRY1 Code")}</button>
                  </div>
                  <div id="tryit-msg-${tryitKey}" class="small"></div>` : ""}
              </div>` : ""}
          </div>
        </div>`;
    }
    // 3. Practice Pause / Lab Checkpoint Bridge
    if (/^(💡|\*\*(Practice Pause|Jeda Praktik))/i.test(first)) {
      const modId = ctx && ctx.modId;
      return `
        <div class="callout-pause">
          <div class="callout-head">
            <span class="callout-badge">💡 ${this.l("Jeda Praktik Terarah (Jembatan ke Lab)", "Guided Lab Checkpoint (Practice Pause)")}</span>
            ${modId ? `<button class="btn btn-sm btn-quiet" onclick="app.lessonToLab('${modId}', ${ctx && ctx.lessonIdx != null ? ctx.lessonIdx : -1}${/\b(?:Part|Bagian) ([AB])\b/i.test(first) ? `, '${first.match(/\b(?:Part|Bagian) ([AB])\b/i)[1].toLowerCase()}'` : ""})">${window.BROWSER_LABS && window.BROWSER_LABS[modId] ? this.l("Buka pratinjau di tab Lab", "Open the preview on the Lab tab") : this.l("Buka Tab Lab", "Open Lab Tab")} →</button>` : ""}
          </div>
          <div class="stack-sm">${this.renderQuoteBody(q)}</div>
        </div>`;
    }
    // 4. Standard callout (Warning, Tip, or Note)
    const kind = /^\*\*(Warning|Peringatan|Pitfall|Jebakan)/i.test(first) ? "danger" : /^\*\*(Tip|Saran)/i.test(first) ? "success" : "";
    return `<div class="callout ${kind}">${this.renderQuoteBody(q)}</div>`;
  }

  // "How a lab works" on every Lab tab: what tests and checkers are, how to read a failure, and the loop.
  // A beginner said the Module 0.0 lab was unclear; most labs assumed the learner already knew this.
  labHowItWorks(mod) {
    const mm = mod.id.match(/mod-(\d)-(\d)/);
    const level0 = mm && mm[1] === "0";
    const kind = /^mod-4-/.test(mod.id) ? "capstone" : ["mod-0-3", "mod-1-3", "mod-1-4"].includes(mod.id) ? "sql" : mod.id === "mod-0-1" ? "workspace" : mod.id === "mod-2-3" ? "dbt" : "pytest";
    const alsoPytest = ["mod-1-3", "mod-1-4"].includes(mod.id);
    const C = (t) => `<code>${this.esc(t)}</code>`;
    const how = {
      pytest: this.l(
        `Lab ini memberi Anda file dengan fungsi yang isinya kosong (${C("raise NotImplementedError")}), dan file ${C("test_*.py")} berisi <strong>tes</strong>: program kecil yang memanggil fungsi Anda dengan contoh dan memeriksa jawabannya. ${C("pytest")} menjalankan semuanya dan mencetak ${C("PASSED")} atau ${C("FAILED")} per tes, lalu ringkasan seperti ${C("3 failed, 5 passed")}. Anda selesai ketika semuanya lulus.`,
        `This lab gives you a file whose functions are empty (${C("raise NotImplementedError")}), and a ${C("test_*.py")} file of <strong>tests</strong>: small programs that call your function with an example and check the answer. ${C("pytest")} runs them all and prints ${C("PASSED")} or ${C("FAILED")} per test, then a summary such as ${C("3 failed, 5 passed")}. You are done when all of them pass.`),
      sql: this.l(
        `Lab ini adalah daftar pertanyaan. Anda menulis satu query di bawah setiap penanda di ${C("answers.sql")} (atau mengerjakannya di SQL Sandbox). Pemeriksa menjalankan query Anda dan membandingkan hasilnya dengan hasil yang benar: ${C("PASS")} jika sama, ${C("TODO")} jika belum ditulis, ${C("FAIL")} dengan alasannya (error SQL, jumlah kolom atau baris yang berbeda, atau nilai yang berbeda), lalu ${C("3/10 answers correct")}.`,
        `This lab is a list of questions. You write one query under each marker in ${C("answers.sql")} (or solve it in the SQL Sandbox). The checker runs your query and compares its result with the correct one: ${C("PASS")} when they match, ${C("TODO")} when not written yet, ${C("FAIL")} with the reason (an SQL error, a different number of columns or rows, or different values), then ${C("3/10 answers correct")}.`),
      dbt: this.l(
        `Lab ini memberi Anda proyek dbt dengan model SQL yang belum diisi: setiap file model hanya berisi ${C("select 1 as todo")} dan komentar yang menjadi spesifikasinya. Anda menulis query-nya. ${C("test_lab.py")} menjalankan ${C("dbt build")}, lalu memeriksa tabel hasilnya; ${C("pytest")} mencetak ${C("PASSED")} atau ${C("FAILED")} per tes.`,
        `This lab gives you a dbt project whose SQL models are not filled in: each model file only says ${C("select 1 as todo")}, plus a comment that is its specification. You write the queries. ${C("test_lab.py")} runs ${C("dbt build")} and then checks the tables it made; ${C("pytest")} prints ${C("PASSED")} or ${C("FAILED")} per test.`),
      workspace: this.l(
        `Lab ini membangun folder kerja, bukan menulis fungsi. Pemeriksa ${C("check.py")} melihat folder Anda dan mencetak satu baris per syarat (venv, Git, ${C(".gitignore")}, skrip), masing-masing lulus atau gagal dengan petunjuk.`,
        `This lab builds a workspace folder rather than functions. The ${C("check.py")} checker looks at your folder and prints one line per requirement (venv, Git, ${C(".gitignore")}, script), each passed or failed with a hint.`),
      capstone: this.l(
        `Capstone ini dibangun per langkah. ${C("check.py <folder> --step N")} memeriksa langkah N dan mencetak ${C("PASS")}/${C("FAIL")} per pemeriksaan, plus ringkasan. ${C("--hint 1")} sampai ${C("--hint 3")} memberi petunjuk bertingkat; coba sendiri minimal 30 menit sebelum memintanya.`,
        `This capstone is built step by step. ${C("check.py <folder> --step N")} checks step N and prints ${C("PASS")}/${C("FAIL")} per check, plus a summary. ${C("--hint 1")} to ${C("--hint 3")} give hints of increasing detail; try for at least 30 minutes before you ask.`)
    }[kind];
    const partA = mod.id === "mod-0-0" ? `<p>${this.l(
      `Lab ini punya dua bagian. <strong>Bagian A</strong> (Pelajaran 1–4) tidak memakai fungsi: Anda mengganti setiap ${C("None")} di ${C("practice.py")} dengan kode biasa, dan tesnya menjalankan file Anda lalu memeriksa nilai variabelnya. <strong>Bagian B</strong> (mulai Pelajaran 5) adalah fungsi di ${C("basics.py")}.`,
      `This lab has two parts. <strong>Part A</strong> (Lessons 1–4) uses no functions: you replace each ${C("None")} in ${C("practice.py")} with plain code, and the tests run your file and check the values of its variables. <strong>Part B</strong> (from Lesson 5) is the functions in ${C("basics.py")}.`)}</p>` : "";
    const extra = partA + (alsoPytest ? `<p>${this.l(`Modul ini juga punya bagian Python dengan tes ${C("pytest")}; langkah lab di bawah menyebutkan keduanya.`, `This module also has a Python part checked with ${C("pytest")}; the lab steps below cover both.`)}</p>` : "");
    const read = kind === "pytest" || kind === "dbt" ? this.l(
      `<strong>Membaca tes yang gagal.</strong> Lihat baris yang diawali ${C("E")}. ${C("assert 'Rp 1,250,000' == 'Rp 1.250.000'")} berarti: fungsi Anda mengembalikan nilai kiri, tes mengharapkan nilai kanan. Perbedaannya memberi tahu apa yang harus diubah. ${C("NotImplementedError")} berarti fungsinya belum Anda tulis. Jalankan satu kelompok saja agar pesannya pendek: ${C("pytest <file tes> -k NamaKelompok -v")}.`,
      `<strong>Reading a failed test.</strong> Look at the lines that start with ${C("E")}. ${C("assert 'Rp 1,250,000' == 'Rp 1.250.000'")} means: your function returned the left value, the test expected the right one. The difference tells you what to change. ${C("NotImplementedError")} means you have not written that function yet. Run one group only to keep the output short: ${C("pytest <test file> -k GroupName -v")}.`) : this.l(
      `<strong>Membaca kegagalan.</strong> Baca pesan pertama yang gagal saja, perbaiki satu hal, jalankan lagi. Pesannya menyebutkan apa yang diharapkan.`,
      `<strong>Reading a failure.</strong> Read only the first failing message, fix one thing, run again. The message says what was expected.`);
    return `<details class="callout neutral lab-how" ${level0 ? "open" : ""}>
        <summary><strong>🧭 ${this.l("Cara kerja lab (baca sekali)", "How a lab works (read once)")}</strong></summary>
        <div class="stack-sm small" style="margin-top:6px">
          <p>${how}</p>
          ${extra}
          <p>${read}</p>
          <p><strong>${this.l("Putarannya", "The loop")}:</strong> ${this.l(
            "baca deskripsinya, tulis percobaan, jalankan pemeriksaan, baca pesan pertama yang gagal, ubah satu hal, ulangi. Memutar berkali-kali untuk satu bagian itu normal: begitulah programmer bekerja, bukan tanda Anda tidak bisa.",
            "read the description, write an attempt, run the check, read the first failing message, change one thing, repeat. Going round many times for one part is normal: it is how programmers work, not a sign that you cannot do it.")}</p>
          <p class="muted">${this.l("Kerjakan sendiri. Solusi referensi terbuka setelah kode bukti Anda diterima; membandingkan setelahnya adalah cara belajar yang bagus.", "Do it yourself. The reference solution opens after your proof code is accepted; comparing afterwards is a good way to learn.")}</p>
        </div>
      </details>`;
  }

  // "Where do I do this?" under every Try it, chosen from its label: "(10 min, Python)", "(SQL Sandbox)",
  // "(terminal)", "(paper)"... Beginners could not tell whether to type the code at the terminal, at >>> or in a file.
  tryItWhere(lines, ctx) {
    this._whereKind = "";
    const text = lines.join(" ");
    const head = (lines[0] || "").match(/\(([^)]*)\)/);
    const label = (head ? head[1] : "").replace(/^\s*\d+(-\d+)?\s*(min|minutes|menit)\b,?\s*/i, "").toLowerCase();
    const modId = (ctx && ctx.modId) || "";
    const mm = modId.match(/mod-(\d)-(\d)/);
    const afterVenv = mm ? Number(mm[1]) * 10 + Number(mm[2]) >= 1 : true;   // the course venv exists from Module 0.1 on
    const pkgs = Array.from(new Set((text.match(/pip install ([^`]+)`/g) || []).map((x) => x.replace(/^pip install /, "").replace(/`$/, "").trim())));
    const named = text.match(/`(~?[\w./-]+\.py)`/g) || [];
    const writes = /\b(write|tulis|save|simpan|buat)\b[^.]{0,40}`[\w./-]+\.py`/i.test(text) || /file `[\w./-]+\.py`/i.test(label);
    let kind;
    if (/sandbox/.test(label)) kind = "sandbox";
    else if (/>>>/.test(label)) kind = "repl";
    else if (/(paper|kertas)/.test(label) && !/(python|terminal)/.test(label)) kind = "paper";
    else if (/terminal|docker|sqlcmd|dbt|\bbq\b/.test(label)) kind = "terminal";   // the label wins over a file the Try it also writes
    else if (/python|pyspark|\.py/.test(label) || writes) kind = "python";
    else if (label || /`[^`]+`/.test(text)) kind = "terminal";
    else return "";
    this._whereKind = kind;
    const C = (t) => `<code>${this.esc(t)}</code>`;
    const go = `${C("cd ~/projects/DECourse")}${afterVenv ? ` ${this.l("lalu", "then")} ${C("source venv/bin/activate")} (${this.l("prompt diawali", "the prompt starts with")} ${C("(venv)")})` : ""}`;
    let body;
    if (kind === "sandbox") {
      body = `<p>${this.l("Di browser ini, tanpa instalasi: buka <strong>SQL Sandbox</strong> di menu atas, pilih dataset yang disebut, ketik query di kotak editor, lalu tekan Run.", "In this browser, nothing to install: open the <strong>SQL Sandbox</strong> in the top menu, pick the dataset it names, type the query in the editor box and press Run.")}</p>
        <button class="btn btn-sm" onclick="app.go('playground')">${this.l("Buka SQL Sandbox", "Open the SQL Sandbox")} →</button>`;
    } else if (kind === "repl") {
      body = `<ol>
          <li>${this.l(`Buka terminal dan ketik ${C("python3")}, lalu Enter. Prompt berubah menjadi ${C(">>>")}.`, `Open the terminal and type ${C("python3")}, then Enter. The prompt changes to ${C(">>>")}.`)}</li>
          <li>${this.l(`Ketik setiap baris di ${C(">>>")} dan tekan Enter. Di sini Anda tidak perlu ${C("print")}: ketik nama atau ekspresinya saja dan Python menampilkan nilainya.`, `Type each line at ${C(">>>")} and press Enter. Here you do not need ${C("print")}: type a name or an expression and Python shows its value.`)}</li>
          <li>${this.l(`Melihat ${C("...")} alih-alih ${C(">>>")}? Python sedang menunggu akhir sebuah blok (biasanya karena Anda menempel beberapa baris sekaligus). Tekan Enter sekali lagi pada baris ${C("...")} yang kosong untuk menjalankannya. Jangan tekan ${C("Ctrl+C")} di sana: itu membatalkan baris-baris tadi, dan variabelnya tidak pernah dibuat (lalu muncul ${C("NameError")}).`, `See ${C("...")} instead of ${C(">>>")}? Python is waiting for the end of a block (usually because you pasted several lines at once). Press Enter once more on the empty ${C("...")} line to run it. Do not press ${C("Ctrl+C")} there: that cancels those lines, so the variables are never created (and you get ${C("NameError")} later).`)}</li>
          <li>${this.l(`Selesai? Keluar dengan ${C("exit()")} atau ${C("Ctrl+D")}; prompt kembali menjadi ${C("$")}. Bukan ${C("Ctrl+Z")}: itu hanya menjeda Python di latar belakang (${C("[1]+ Stopped python3")}); ketik ${C("fg")} untuk kembali, lalu ${C("exit()")}.`, `Done? Leave with ${C("exit()")} or ${C("Ctrl+D")}; the prompt goes back to ${C("$")}. Not ${C("Ctrl+Z")}: that only pauses Python in the background (${C("[1]+ Stopped python3")}); type ${C("fg")} to get it back, then ${C("exit()")}.`)}</li>
        </ol>`;
    } else if (kind === "paper") {
      body = `<p>${this.l("Tidak perlu komputer: pakai kertas dan pena, atau file teks biasa. Lalu buka hasil yang diharapkan di bawah untuk membandingkan.", "No computer needed: use pen and paper, or a plain text file. Then open the expected result below to compare.")}</p>`;
    } else if (kind === "python") {
      const file = (named.find((f) => !/^labs\//.test(f.replace(/`/g, ""))) || "").replace(/`/g, "") || `${modId.replace("mod-", "") || "try"}-l${((ctx && ctx.lessonIdx) || 0) + 1}.py`;
      const path = file.includes("/") ? file : `~/practice/${file}`;
      body = `<ol>
          <li>${this.l("Terminal: masuk ke folder kursus", "Terminal: go to the course folder")}: ${go}.</li>
          <li>${this.l(`Editor (VS Code): buat file ${C(path)} (sekali saja: ${C("mkdir -p ~/practice")}), tulis kodenya, simpan. Folder latihan ini di luar folder kursus, jadi memperbarui kursus tidak pernah menyentuh pekerjaan Anda, dan perintah ${C("check.py")} mencarinya di sana.`, `Editor (VS Code): make the file ${C(path)} (once: ${C("mkdir -p ~/practice")}), write the code, save. This practice folder sits outside the course folder, so updating the course never touches your work, and the ${C("check.py")} commands look for your files there.`)}</li>
          <li>${this.l(`Jalankan di terminal: ${C("python3 " + path)}. Path seperti ${C("data/orders.csv")} berjalan karena terminal Anda berada di folder kursus.`, `Run it in the terminal: ${C("python3 " + path)}. Paths such as ${C("data/orders.csv")} work because your terminal is in the course folder.`)}</li>
          ${pkgs.length ? `<li>${this.l(`Paket: pasang sekali dengan venv aktif: ${C("python -m pip install " + pkgs.join(" "))}. Tanpa ${C("(venv)")}, pip berhenti dengan ${C("externally-managed-environment")}.`, `Packages: install once with the venv active: ${C("python -m pip install " + pkgs.join(" "))}. Without ${C("(venv)")}, pip stops with ${C("externally-managed-environment")}.`)}</li>` : ""}
        </ol>
        <p class="small muted">${this.l(`Untuk mencoba satu baris saja, ketik ${C("python3")} lalu baris itu di prompt ${C(">>>")}. Perintah seperti ${C("pip")} atau ${C("pytest")} selalu di prompt ${C("$")}, bukan ${C(">>>")}.`, `To try a single line, type ${C("python3")} and then that line at the ${C(">>>")} prompt. Commands such as ${C("pip")} or ${C("pytest")} always go at the ${C("$")} prompt, never at ${C(">>>")}.`)}</p>`;
    } else {
      body = `<ul>
          <li>${this.l(`Ketik perintahnya di prompt ${C("$")} terminal, dari folder kursus: ${go}, kecuali Try it ini menyuruh ${C("cd")} ke tempat lain.`, `Type the commands at the terminal's ${C("$")} prompt, from the course folder: ${go}, unless this Try it says to ${C("cd")} somewhere else.`)}</li>
          ${/second terminal|terminal kedua/i.test(text) ? `<li>${this.l(`"Terminal kedua" = tab terminal baru (${C("Ctrl+Shift+T")} di terminal Linux, atau tombol + di panel terminal VS Code). Di tab baru, ${C("cd")} dan aktifkan venv lagi.`, `"A second terminal" = a new terminal tab (${C("Ctrl+Shift+T")} in the Linux terminal, or the + button in VS Code's terminal panel). In the new tab, ${C("cd")} and activate the venv again.`)}</li>` : ""}
          ${/docker/i.test(label + text) ? `<li>${this.l(`Butuh Docker yang sedang berjalan: ${C("docker ps")} harus tampil tanpa error.`, `Needs Docker running: ${C("docker ps")} must print without an error.`)}</li>` : ""}
          <li>${this.l(`${C("export")} hanya berlaku di jendela terminal itu; di terminal baru, jalankan lagi. Program yang membuka prompt sendiri: ${C("python3")} → ${C(">>>")} (keluar ${C("exit()")}), ${C("sqlite3")} → ${C("sqlite>")} (keluar ${C(".quit")}), ${C("psql")} → ${C("=#")} (keluar ${C("\\q")}).`, `${C("export")} only lasts in that terminal window; in a new terminal, run it again. Programs that open their own prompt: ${C("python3")} → ${C(">>>")} (leave with ${C("exit()")}), ${C("sqlite3")} → ${C("sqlite>")} (leave with ${C(".quit")}), ${C("psql")} → ${C("=#")} (leave with ${C("\\q")}).`)}</li>
          ${named.filter((f) => !/labs\//.test(f)).length ? `<li>${this.l(`File yang diminta (${named.filter((f) => !/labs\//.test(f)).slice(0, 2).map((f) => C(f.replace(/`/g, ""))).join(", ")}): buat dengan editor di folder ${C("~/practice/")}; file ${C(".py")} dijalankan dari folder kursus dengan ${C("python3 ~/practice/namafile.py")}.`, `Files it asks you to write (${named.filter((f) => !/labs\//.test(f)).slice(0, 2).map((f) => C(f.replace(/`/g, ""))).join(", ")}): make them with your editor in the ${C("~/practice/")} folder; a ${C(".py")} file runs from the course folder with ${C("python3 ~/practice/filename.py")}.`)}</li>` : ""}
          ${/\.db\b|sqlite/i.test(label + text) ? `<li>${this.l(`SQL pada file ${C(".db")}: ${C("python3 -m sqlite3 warehouse.db")} membuka prompt ${C("sqlite>")} tanpa instalasi apa pun (Python 3.12 atau lebih baru); akhiri setiap query dengan ${C(";")}.`, `SQL on a ${C(".db")} file: ${C("python3 -m sqlite3 warehouse.db")} opens a ${C("sqlite>")} prompt with nothing to install (Python 3.12 or newer); end each query with ${C(";")}.`)}</li>` : ""}
          ${pkgs.length ? `<li>${this.l(`Paket: ${C("python -m pip install " + pkgs.join(" "))} dengan venv aktif.`, `Packages: ${C("python -m pip install " + pkgs.join(" "))} with the venv active.`)}</li>` : ""}
        </ul>`;
    }
    const kindLabel = { repl: this.l("Python di >>>", "Python at >>>"), sandbox: "SQL Sandbox", paper: this.l("kertas", "paper"), python: this.l("file Python + terminal", "Python file + terminal"), terminal: "terminal" }[kind];
    return `<details class="tryit-where"><summary>📍 ${this.l("Di mana saya mengerjakan ini?", "Where do I do this?")} <span class="muted">· ${kindLabel}</span></summary><div class="small">${body}<p class="muted">${this.l("Belum paham bedanya terminal, >>> dan file? Lihat", "Unsure about the terminal, >>> and files? See")} <a href="#/start">${this.l("Mulai di sini, langkah 4", "Start here, step 4")}</a>.</p></div></details>`;
  }

  md(val, ctx) {
    const src = this.t(val);
    if (!src) return "";
    const lines = String(src).replace(/\r\n/g, "\n").split("\n");
    const out = [];
    const isBullet = (l) => /^\s*[-*] /.test(l);
    const isOrdered = (l) => /^\s*\d+\. /.test(l);
    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    let i = 0;
    let tryitIdx = (ctx && ctx.tryitStart) || 0;
    let drillIdx = (ctx && ctx.drillStart) || 0;   // step mode renders a lesson in pieces: the Try-it keys must stay the same as on one page
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; continue; }
      let m;
      if (/^:::(trace|sqlsteps)\s+/.test(line)) {
        // ":::trace Title" with @code: an animation, the program run line by line (see drill-parse.js)
        const blk = [line];
        i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) blk.push(lines[i++]);
        i++;
        out.push(this.renderTrace(blk.join("\n"), ctx));
      } else if (/^:::(drill|ask)\b/.test(line)) {
        // ":::drill python Title" ... ":::": a small exercise with checks (see drill-parse.js)
        const blk = [line];
        i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) blk.push(lines[i++]);
        i++;
        out.push(this.renderDrill(blk.join("\n"), ctx, drillIdx++));
      } else if ((m = line.match(/^:::advanced\s+(.+)$/))) {
        // ":::advanced Title" ... ":::" folds material for later, so a beginner sees the core of the lesson first
        out.push(`<details class="advanced-fold"><summary><span class="advanced-tag">${this.l("Lanjutan (opsional)", "Advanced (optional)")}</span> ${this.inline(m[1])}</summary><div class="advanced-body">`);
        i++;
      } else if (/^:::\s*$/.test(line)) {
        out.push("</div></details>"); i++;
      } else if ((m = line.match(/^```\s*(\S*)\s*$/))) {
        const body = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(`<div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)" aria-label="${this.l("Salin kode", "Copy code")}">${this.l("Salin", "Copy")}</button><pre${m[1] ? ` data-lang="${this.esc(m[1])}"` : ""}><code>${this.esc(body.join("\n"))}</code></pre></div>`);
        if (ctx && ctx.modId && ctx.lessonIdx != null && /^python$/i.test(m[1]) && this.padRunnable(body.join("\n"))) out.push(this.padHtml(`${ctx.modId}:${ctx.lessonIdx}`, body.join("\n"), this.l("▶ Jalankan di browser (tanpa instalasi)", "▶ Run it in the browser (nothing to install)")));
      } else if ((m = line.match(/^\[\[diagram:([a-z0-9-]+)\]\]\s*$/))) {
        const fn = window.DIAGRAMS && window.DIAGRAMS[m[1]];
        const num = (n) => n.toLocaleString(this.lang === "id" ? "id-ID" : "en-US");
        if (fn) out.push(fn((idText, enText) => this.l(idText, enText), num).replace("</figure>", `<figcaption class="dg-swipe">${this.l("Geser ke samping untuk melihat seluruh diagram", "Swipe sideways to see the whole diagram")} →</figcaption></figure>`));
        i++;
      } else if ((m = line.match(/^(#{3,4}) (.+)$/))) {
        out.push(`<h4 class="md-h">${this.inline(m[2])}</h4>`); i++;
      } else if (/^---+\s*$/.test(line)) {
        out.push("<hr>"); i++;
      } else if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const cells = (l) => l.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
        const cell = (c) => this.inline(c).replace(/&lt;br\s*\/?&gt;/g, "<br>"); // a written <br> is the only way to break a line inside a Markdown table cell
        out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${cell(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="white-space:normal">${cell(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      } else if (/^> ?/.test(line)) {
        const q = [];
        while (i < lines.length && /^> ?/.test(lines[i])) q.push(lines[i++].replace(/^> ?/, ""));
        const isTryIt = /^(🛠|\*\*(Try it|Coba sendiri))/i.test((q[0] || "").trim());
        out.push(this.renderQuoteBlock(q, ctx, isTryIt ? tryitIdx++ : 0));
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
        while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^:::/.test(lines[i]) && !/^#{3,4} /.test(lines[i]) && !isBullet(lines[i]) && !isOrdered(lines[i]) && !/^> ?/.test(lines[i]) && !isTableRow(lines[i])) p.push(lines[i++]);
        if (!p.length) { p.push(lines[i++]); }
        out.push(`<p>${p.map((x) => this.inline(x)).join("<br>")}</p>`);
      }
    }
    return `<div class="md">${out.join("")}</div>`;
  }

  // ---------- routing ----------
  readHash(focusMain) {
    this.stopAllAnims();
    const parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const view = VIEWS.includes(parts[0]) ? parts[0] : (readStore("df_visited", false) ? "roadmap" : "start");
    writeStore("df_visited", true);
    this.closeMenu();
    this.currentView = view;
    if (view === "curriculum") {
      const lvl = CURRICULUM_DATA.find((L) => L.modules.some((m) => m.id === parts[1]));
      if (lvl) { this.activeLevelId = lvl.levelId; this.activeModuleId = parts[1]; }
      this.activeModuleTab = MODULE_TABS.includes(parts[2]) ? parts[2] : "concepts";
      const n = parseInt(parts[3], 10);
      this.activeLessonIdx = this.activeModuleTab === "concepts" && n >= 1 ? n - 1 : null;
    }
    if (view === "interview") {
      if (parts[1] === "loop") this.activeInterviewMode = "loop";
      else if (INTERVIEW_TABS.includes(parts[1])) { this.activeInterviewMode = "arena"; this.activeInterviewTab = parts[1]; }
    }
    if (view === "job-sim") {
      if (parts[1] && window.JOB_SIM_DATA && window.JOB_SIM_DATA.stories.some((s) => s.id === parts[1])) this.activeJobStoryId = parts[1];
      if (parts[2] && ["easy", "normal", "hard", "expert"].includes(parts[2])) this.activeJobLevel = parts[2];
    }
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
  // A Practice Pause sends a beginner to the browser preview, so land on it, not on the top of the Lab tab.
  // The lab checkpoint of a lesson (its Practice Pause), or null when the lesson has none.
  pauseOf(mod, i) {
    const m = this.lessonBody(mod.lessons[i]).match(/^>\s*(?:💡|\*\*(?:Practice Pause|Jeda Praktik))[^\n]*/im);
    if (!m) return null;
    const part = m[0].match(/\b(?:Part|Bagian) ([AB])\b/i);
    return { part: part ? part[1].toLowerCase() : "" };
  }
  // From a lesson to its lab step; the lab page then offers "Continue to the next lesson".
  lessonToLab(modId, i, part, finish) {
    if (i != null && i >= 0) {
      this.setLabReturn({ modId, from: i });
      if (finish) {
        if (this.stepPos[`${modId}:${i}`] != null) { delete this.stepPos[`${modId}:${i}`]; writeStore("df_step_pos", this.stepPos); }
        if (!this.isLessonDone(modId, i)) this.toggleLessonDone(modId, i, false);
      }
    }
    if (window.BROWSER_LABS && window.BROWSER_LABS[modId]) this.openLabPreview(modId, part || "");
    else this.go("curriculum", modId, "lab");
  }
  setLabReturn(v) {
    this.labReturn = v;
    try { if (v) sessionStorage.setItem("df_lab_return", JSON.stringify(v)); else sessionStorage.removeItem("df_lab_return"); } catch (e) { /* storage blocked: the banner just does not survive a reload */ }
  }
  labContinue(modId) {
    const r = this.labReturn;
    this.setLabReturn(null);
    if (r && r.modId === modId) this.openLesson(modId, r.from + 1);
  }
  labBack(modId) {
    const r = this.labReturn;
    this.setLabReturn(null);
    if (r && r.modId === modId) this.openLesson(modId, r.from);
  }
  // ---------- the lab step inside the lesson (Module 0.0): the piece of the lab file this lesson is about ----------
  lessonLabFor(modId, i) {
    if (!window.LessonLab || !window.BROWSER_LABS) return null;
    const chk = (this.lessonChecks(modId) || [])[i];
    if (!chk) return null;
    const lab = chk.part === "a" ? modId + "a" : modId;
    if (!window.BROWSER_LABS[lab]) return null;
    const plan = { "mod-0-0": [{ step: 1 }, { step: 2 }, { step: 3 }, { step: 4 }, { funcs: ["format_rupiah", "count_by_status", "unique_customer_ids", "average_total", "total_revenue", "batches", "top_customers"] }, { funcs: ["safe_int", "add_to_batch", "split_valid"] }, { funcs: ["read_orders"] }] }[modId];
    const p = plan && plan[i];
    return p ? Object.assign({ lab, groups: chk.groups }, p) : null;
  }
  lessonLabDraft(lab) {
    const bl = window.BROWSER_LABS[lab.lab];
    const saved = readStore("df_bl_" + lab.lab, null);
    return typeof saved === "string" ? saved : bl.starter;
  }
  lessonLabPiece(lab, draft) {
    return lab.step ? window.LessonLab.getStep(draft, lab.step) : window.LessonLab.getFuncs(draft, lab.funcs);
  }
  lessonLabHtml(modId, i) {
    const lab = this.lessonLabFor(modId, i);
    if (!lab) return "";
    const piece = this.lessonLabPiece(lab, this.lessonLabDraft(lab));
    const key = `${modId}:${i}`;
    const out = (this._llOut && this._llOut[key]) || "";
    const body = piece === null
      ? `<p class="small">${this.l("File lab Anda berubah dan bagian ini tidak ditemukan. Buka lab lengkap di tab Lab dan pakai Reset.", "Your lab file changed and this piece cannot be found. Open the full lab on the Lab tab and use Reset.")}</p>`
      : `${lab.step ? `<details class="ll-inputs"><summary>${this.l("Data yang diberikan (hanya baca)", "The data you are given (read only)")}</summary><pre>${this.esc(window.LessonLab.inputs(this.lessonLabDraft(lab)))}</pre></details>` : ""}
        <label class="small" for="ll-code-${i}">${lab.step
          ? this.l(`Ganti setiap <code>None</code> dengan kode Anda (Langkah ${lab.step} di <code>practice.py</code>):`, `Replace each <code>None</code> with your code (Step ${lab.step} of <code>practice.py</code>):`)
          : this.l("Tulis isi fungsi-fungsi ini (hapus baris <code>raise NotImplementedError</code>). Jangan ubah baris <code>def</code>:", "Write the bodies of these functions (delete the <code>raise NotImplementedError</code> line). Do not change the <code>def</code> lines:")}</label>
        <textarea id="ll-code-${i}" class="pad-code" rows="${Math.min(26, Math.max(8, piece.split("\n").length + 1))}" spellcheck="false" onkeydown="app.blKey(event, '${lab.lab}');if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();app.runLessonLab('${modId}', ${i})}">${this.esc(piece)}</textarea>
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-primary" id="ll-run-${i}" onclick="app.runLessonLab('${modId}', ${i})">${this.l("Jalankan tes langkah ini", "Run this step's tests")}</button><button class="btn btn-sm btn-quiet" onclick="app.resetLessonLab('${modId}', ${i})">${this.l("Reset langkah ini", "Reset this step")}</button><span class="small muted">Ctrl+Enter</span></div>
        <div id="ll-out-${i}" class="ll-out" role="status" aria-live="polite">${out}</div>`;
    return `<div class="lesson-lab">
      <div class="ll-head"><strong>🧪 ${this.l("Lab untuk materi ini", "The lab for this lesson")}</strong> <span class="chip">${this.l("Pratinjau browser; terminal tetap cara utama", "Browser preview; your terminal is still the main way")}</span></div>
      <p class="small muted">${this.l("Ini potongan kecil dari file lab modul ini. Yang Anda tulis di sini tersimpan di file yang sama dengan tab Lab, dan tes-tes berikut hanya memeriksa potongan ini.", "This is one small piece of the module's lab file. What you write here is saved in the same file as the Lab tab, and these tests check only this piece.")}</p>
      ${body}</div>`;
  }
  resetLessonLab(modId, i) {
    const lab = this.lessonLabFor(modId, i);
    if (!lab) return;
    const bl = window.BROWSER_LABS[lab.lab];
    const starter = this.lessonLabPiece(lab, bl.starter);
    const ta = document.getElementById(`ll-code-${i}`);
    if (ta && starter !== null) { ta.value = starter; this.lessonLabMerge(modId, i, false); }
  }
  // Put the edited piece back into the whole lab file (saved for the Lab tab too). Returns the whole file, or null with a message shown.
  lessonLabMerge(modId, i, show) {
    const lab = this.lessonLabFor(modId, i), ta = document.getElementById(`ll-code-${i}`), box = document.getElementById(`ll-out-${i}`);
    if (!lab || !ta) return null;
    const draft = this.lessonLabDraft(lab);
    const merged = lab.step ? window.LessonLab.setStep(draft, lab.step, ta.value) : window.LessonLab.setFuncs(draft, lab.funcs, ta.value);
    if (merged.error) {
      if (show && box) box.innerHTML = `<div class="feedback bad">${merged.error === "defs"
        ? this.l(`Setiap fungsi harus tetap punya baris <code>def</code>-nya, tepat satu kali: ${lab.funcs.map((n) => `<code>${n}</code>`).join(", ")}.`, `Every function must keep its own <code>def</code> line, exactly once: ${lab.funcs.map((n) => `<code>${n}</code>`).join(", ")}.`)
        : this.l("Bagian ini tidak ditemukan di file lab Anda. Buka tab Lab dan pakai Reset.", "This piece cannot be found in your lab file. Open the Lab tab and use Reset.")}</div>`;
      return null;
    }
    writeStore("df_bl_" + lab.lab, merged.draft);
    return merged.draft;
  }
  runLessonLab(modId, i) {
    const lab = this.lessonLabFor(modId, i), box = document.getElementById(`ll-out-${i}`), btn = document.getElementById(`ll-run-${i}`);
    if (!lab || !box) return;
    const key = `${modId}:${i}`;
    this._llOut = this._llOut || {};
    const say = (html) => { box.innerHTML = html; this._llOut[key] = html; };
    if (this._padBusy || this._blBusy) { say(`<div class="feedback info">${this.l("Python masih sibuk. Tunggu sebentar lalu coba lagi.", "Python is busy. Wait a moment and try again.")}</div>`); return; }
    if (!window.Worker || location.protocol === "file:") { say(`<div class="feedback bad">${this.l("Browser ini tidak bisa menjalankan Python di halaman yang dibuka dari file. Jalankan situs dengan python3 server.py, atau pakai terminal Anda.", "This browser cannot run Python on a page opened from a file. Run the site with python3 server.py, or use your terminal.")}</div>`); return; }
    const draft = this.lessonLabMerge(modId, i, true);
    if (draft === null) { this._llOut[key] = box.innerHTML; return; }
    const bl = window.BROWSER_LABS[lab.lab];
    if (!this._blWorker) {
      try { this._blWorker = new Worker("js/pyodide-worker.js", { type: "module" }); }
      catch (e) { say(`<div class="feedback bad">${this.l("Tidak bisa memulai Python di browser ini. Pakai terminal Anda.", "Could not start Python in this browser. Use your terminal.")}</div>`); return; }
    }
    const w = this._blWorker;
    const id = (this._padId = (this._padId || 0) + 1);
    this._padBusy = true;
    if (btn) btn.disabled = true;
    let timer;
    const finish = () => { this._padBusy = false; clearTimeout(timer); w.removeEventListener("message", onMsg); const b = document.getElementById(`ll-run-${i}`); if (b) b.disabled = false; };
    const stop = (msg) => { if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; } finish(); say(`<div class="feedback bad">${msg}</div>`); };
    const loading = { "loading-python": this.l("Memuat Python (sekitar 12 MB, hanya sekali)…", "Loading Python (about 12 MB, only once)…"), "loading-pytest": this.l("Memuat pytest…", "Loading pytest…"), running: this.l("Menjalankan tes…", "Running the tests…") };
    const onMsg = (ev) => {
      const m = ev.data;
      if (m.type === "status") {
        if (loading[m.text]) box.innerHTML = `<div class="feedback info">${loading[m.text]}</div>`;
        if (m.text === "running") { clearTimeout(timer); timer = setTimeout(() => stop(this.l("Tes berjalan lebih dari 60 detik, jadi dihentikan. Kode Anda mungkin berulang tanpa henti.", "The tests ran for more than 60 seconds, so they were stopped. Your code may loop forever.")), 60000); }
      } else if (m.type === "result" && m.id === id) {
        finish();
        this.lessonLabResult(modId, i, lab, bl, String(m.output).replace(/\/lab\//g, ""), say);
      } else if (m.type === "error" && m.id === id) {
        stop(this.l("Python gagal dimulai:", "Python failed to start:") + " " + this.esc(m.message));
      }
    };
    w.addEventListener("message", onMsg);
    timer = setTimeout(() => stop(this.l("Memuat Python terlalu lama. Periksa koneksi lalu coba lagi.", "Loading Python took too long. Check your connection and try again.")), 240000);
    box.innerHTML = `<div class="feedback info">${loading["loading-python"]}</div>`;
    const expr = lab.groups.join(" or ");
    w.postMessage({ type: "run", id, files: Object.assign({}, bl.files, { [bl.editable]: draft }), args: [...bl.tests, "-k", expr, "-rA"] });
  }
  lessonLabResult(modId, i, lab, bl, raw, say) {
    const groups = this.blGroups(bl, raw).filter((g) => lab.groups.includes(g.name));
    const seen = readStore("df_bl_groups", {}) || {};
    seen[lab.lab] = [...new Set([...(seen[lab.lab] || []), ...groups.filter((g) => g.pass === g.total).map((g) => g.name)])];
    writeStore("df_bl_groups", seen);
    const chips = groups.map((g) => `<li class="${g.pass === g.total ? "ok" : "bad"}"><span aria-hidden="true">${g.pass === g.total ? "✓" : "✗"}</span> <code>${g.name}</code> <span class="muted">${g.pass}/${g.total}</span></li>`).join("");
    const allGood = groups.length === lab.groups.length && groups.every((g) => g.pass === g.total);
    if (allGood) {
      say(`<div class="feedback ok">✓ ${this.l("Semua tes untuk materi ini lulus. Anda boleh lanjut.", "All the tests for this lesson pass. You can continue.")}</div><ul class="bl-groups">${chips}</ul>`);
      const y = window.scrollY;
      this.renderView();
      window.scrollTo(0, y);
      return;
    }
    const firstBad = groups.find((g) => g.pass < g.total);
    let detail = firstBad ? this.blGroupOutput(raw, firstBad.name) : "";
    if (!detail && /ERROR collecting|SyntaxError|IndentationError/.test(raw)) detail = raw.split("\n").filter((l) => /^E {2,}/.test(l)).join("\n");
    if (!detail) detail = raw.length > 3000 ? "…\n" + raw.slice(-3000) : raw;
    const head = groups.length
      ? this.l(`${groups.filter((g) => g.pass === g.total).length} dari ${lab.groups.length} kelompok tes lulus. Baca pesan dari baris paling bawah: baris berawalan <code>E</code> atau pesan pendek menyebut apa yang salah.`, `${groups.filter((g) => g.pass === g.total).length} of ${lab.groups.length} test groups pass. Read the message from the bottom line; it says what went wrong.`)
      : this.l("Tes belum berjalan. Biasanya ada kesalahan penulisan (syntax). Baca pesan di bawah.", "The tests did not run. Usually there is a typing slip (syntax). Read the message below.");
    say(`<div class="feedback info">${head}</div>${chips ? `<ul class="bl-groups">${chips}</ul>` : ""}<pre class="pad-out pad-err">${this.esc(detail.trimEnd())}</pre>`);
  }

  // Which test groups prove each lesson's lab checkpoint (only where the browser lab can check it).
  lessonChecks(modId) {
    return {
      "mod-0-0": [
        { part: "a", groups: ["TestStep1Types"] },
        { part: "a", groups: ["TestStep2Collections"] },
        { part: "a", groups: ["TestStep3Decisions"] },
        { part: "a", groups: ["TestStep4Loops"] },
        { part: "b", groups: ["TestFormatRupiah", "TestCountByStatus", "TestUniqueCustomerIds", "TestAverageTotal", "TestTotalRevenue", "TestBatches", "TestTopCustomers"] },
        { part: "b", groups: ["TestSafeInt", "TestAddToBatch", "TestSplitValid"] },
        { part: "b", groups: ["TestReadOrders"] },
      ],
    }[modId] || null;
  }
  labCheckOf(modId, i) {
    const c = (this.lessonChecks(modId) || [])[i];
    if (!c) return null;
    const have = new Set(((readStore("df_bl_groups", {}) || {})[c.part === "a" ? modId + "a" : modId]) || []);
    const missing = c.groups.filter((g) => !have.has(g));
    return { part: c.part, total: c.groups.length, missing, done: missing.length === 0 };
  }
  refreshLabBanner() {
    const r = this.labReturn, el = document.querySelector(".lab-return");
    if (!r || !el) return;
    const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === r.modId);
    if (mod) el.outerHTML = this.labReturnBanner(mod);
  }
  labReturnBanner(mod) {
    const r = this.labReturn;
    if (!r || r.modId !== mod.id || !mod.lessons[r.from]) return "";
    const more = r.from + 1 < mod.lessons.length;
    const chk = this.labCheckOf(mod.id, r.from);
    const partName = chk ? (chk.part === "a" ? this.l("Bagian A", "Part A") : this.l("Bagian B", "Part B")) : "";
    const say = chk
      ? (chk.done
        ? this.l(`✓ Pengecekan untuk materi ini lulus (${partName}). Anda boleh lanjut.`, `✓ The checks for this lesson pass (${partName}). You can continue.`)
        : this.l(`Kerjakan langkahnya di ${partName} di bawah, tekan Run tests sampai lulus. Belum lulus: ${chk.missing.length} dari ${chk.total} kelompok tes.`, `Do its step in ${partName} below and press Run tests until it passes. Not passing yet: ${chk.missing.length} of ${chk.total} test groups.`))
      : this.l("Kerjakan langkah lab-nya di bawah, lalu kembali ke materi.", "Do its lab step below, then go back to the lessons.");
    const unlocked = !chk || chk.done;
    return `<div class="callout success lab-return" role="status"><p><strong>${this.l(`Anda datang dari Materi ${r.from + 1}.`, `You came here from Lesson ${r.from + 1}.`)}</strong> ${say}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-quiet" onclick="app.labBack('${mod.id}')">← ${this.l("Kembali ke Materi", "Back to Lesson")} ${r.from + 1}</button>${more ? (unlocked
        ? `<button class="btn btn-sm btn-primary" onclick="app.labContinue('${mod.id}')">${chk ? this.l("Lulus, lanjut ke Materi", "Passed, continue to Lesson") : this.l("Lanjut ke Materi", "Continue to Lesson")} ${r.from + 2} →</button>`
        : `<button class="btn btn-sm btn-primary" disabled title="${this.l("Terbuka setelah tesnya lulus", "Unlocks when the tests pass")}">🔒 ${this.l("Lanjut ke Materi", "Continue to Lesson")} ${r.from + 2}</button><button class="btn btn-sm btn-quiet" onclick="app.labContinue('${mod.id}')">${this.l("Lewati dulu", "Skip for now")}</button>`) : ""}</div></div>`;
  }

  openLabPreview(modId, part) {
    if (part) this._blPartChoice = Object.assign({}, this._blPartChoice, { [modId]: part });
    this.go("curriculum", modId, "lab");
    let tries = 0;
    const land = () => {
      const el = document.getElementById("browser-lab");
      if (el) el.scrollIntoView({ block: "start" });
      else if (tries++ < 20) setTimeout(land, 50);
    };
    setTimeout(land, 50);
  }

  // ---------- chrome (header/nav/footer) ----------
  renderChrome() {
    const labels = {
      "start": this.l("Mulai di sini", "Start here"),
      "roadmap": this.tr("navRoadmap"), "curriculum": this.tr("navCurriculum"),
      "job-sim": this.l("Simulator Kerja", "Job Simulator"),
      "interview": this.tr("navInterview"),
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
    const themeIcon = document.getElementById("theme-btn-icon");
    if (themeIcon) themeIcon.textContent = "🌙";
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) themeBtn.setAttribute("title", this.theme === "dark" ? this.l("Mode Terang", "Light Mode") : this.l("Mode Gelap (IDE)", "Dark IDE Mode"));
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const isLarge = document.documentElement.getAttribute("data-a11y") === "large";
    setText("settings-btn-label", this.l("Tampilan", "Display"));
    const sBtn = document.getElementById("settings-btn");
    if (sBtn) sBtn.setAttribute("title", this.l("Tampilan: mode gelap, teks besar, suara kuis", "Display: dark mode, larger text, quiz sounds"));
    setText("theme-btn-label", this.l("Mode gelap", "Dark mode"));
    setText("a11y-btn-label", this.l("Teks lebih besar", "Larger text"));
    setText("sound-btn-label", this.l("Suara kuis", "Quiz sounds"));
    setText("theme-btn-state", this.theme === "dark" ? this.l("Aktif", "On") : this.l("Mati", "Off"));
    setText("a11y-btn-state", isLarge ? this.l("Aktif", "On") : this.l("Mati", "Off"));
    setText("sound-btn-state", this.soundEnabled ? this.l("Aktif", "On") : this.l("Mati", "Off"));
    [["theme-btn", this.theme === "dark"], ["a11y-btn", isLarge], ["sound-btn", this.soundEnabled]].forEach(([id, on]) => { const el = document.getElementById(id); if (el) el.setAttribute("aria-checked", String(Boolean(on))); });
    const soundIcon = document.getElementById("sound-btn-icon");
    if (soundIcon) soundIcon.textContent = this.soundEnabled ? "🔊" : "🔇";
    const soundBtn = document.getElementById("sound-btn");
    if (soundBtn) soundBtn.setAttribute("title", this.soundEnabled ? this.l("Efek Suara Kuis: Aktif", "Quiz Sound Effects: On") : this.l("Efek Suara Kuis: Nonaktif", "Quiz Sound Effects: Muted"));
    const a11yBtn = document.getElementById("a11y-btn");
    if (a11yBtn) {
      a11yBtn.style.background = this.a11yLarge ? "var(--accent-soft)" : "";
      a11yBtn.style.color = this.a11yLarge ? "var(--accent)" : "";
    }
    document.getElementById("footer-tagline").textContent = this.l("DataForge: belajar data engineering dengan praktik langsung", "DataForge: learn data engineering by doing");
    this.renderHeaderStats();
    this.renderMobileBottomNav();
  }

  // The streak counts days on which the learner studied (see STUDY_KEYS). It shows 0 until the first study
  // action, and drops to 0 once a whole day has passed without one.
  touchStreak() {
    const st = readStore("df_streak", null);
    const ok = st && typeof st.lastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(st.lastDate);
    this.streakDays = ok && dayGap(st.lastDate, localDay()) <= 1 ? Math.max(0, Number(st.days) || 0) : 0;
  }
  recordStudy() {
    const today = localDay();
    const st = readStore("df_streak", null);
    const ok = st && typeof st.lastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(st.lastDate);
    if (ok && st.lastDate === today && (Number(st.days) || 0) > 0) return;
    const days = ok && dayGap(st.lastDate, today) === 1 ? (Number(st.days) || 0) + 1 : 1;
    writeStore("df_streak", { days, lastDate: today });
    this.streakDays = days;
    this.renderHeaderStats();
  }

  playTone(kind) {
    if (!this.soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this._audioCtx || (this._audioCtx = new Ctx());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (kind === "ok") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (kind === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.09);
        osc.frequency.setValueAtTime(783.99, now + 0.18);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(185, now + 0.09);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      }
    } catch (e) { /* audio unavailable in headless or restricted context */ }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    writeStore("df_sound", this.soundEnabled);
    if (this.soundEnabled) this.playTone("ok");
    this.renderChrome();
  }

  toggleA11yFont() {
    this.a11yLarge = !this.a11yLarge;
    writeStore("df_a11y_large", this.a11yLarge);
    if (document.documentElement && document.documentElement.setAttribute) {
      document.documentElement.setAttribute("data-a11y", this.a11yLarge ? "large" : "normal");
    }
    this.renderChrome();
  }

  computeGamificationStats() {
    const allMods = CURRICULUM_DATA.flatMap((l) => l.modules);
    const readLessons = allMods.reduce((s, m) => s + ((this.lessonsDone[m.id] || []).length), 0);
    const tryItCount = Object.keys(this.tryitDone || {}).length;
    const proofCount = allMods.filter((m) => this.proofFor(m.id)).length;
    const chaosCount = Object.keys(this.chaosProofs || {}).length;
    const portCount = Object.keys(this.portfolioProofs || {}).length;
    // warm-up tasks (<story>-w1..w3) are small Level 0 exercises: they count, but far less than a real mission
    const jobSimCount = Object.keys(this.jobSimProofs || {}).filter((k) => !/-w\d$/.test(k)).length;
    const warmupCount = Object.keys(this.jobSimProofs || {}).filter((k) => /-w\d$/.test(k)).length;
    const sqlCount = (this.solvedChallenges || []).length;
    const bugCount = Object.values(this.bugState || {}).filter((x) => x && x.solved).length;
    const defCount = Object.values(this.defenseState || {}).filter((x) => x && x.solved).length;
    const quizPassedCount = Object.keys(this.quizScores || {}).filter((id) => {
      const m = allMods.find((x) => x.id === id);
      return m && this.quizScores[id].best >= Math.ceil(m.quiz.length * 0.8);
    }).length;

    const xp = (readLessons * 15) + (tryItCount * 35) + (proofCount * 150) + (chaosCount * 120) + (portCount * 300) + (jobSimCount * 200) + (warmupCount * 60) + (sqlCount * 30) + (bugCount * 50) + (defCount * 50) + (quizPassedCount * 80);

    let leagueName = this.l("Rookie DE", "Rookie DE");
    let leagueIcon = "🛡️";
    if (xp >= 3500) { leagueName = this.l("Staff Architect", "Staff Architect"); leagueIcon = "👑"; }
    else if (xp >= 1800) { leagueName = this.l("Senior Builder", "Senior Builder"); leagueIcon = "💎"; }
    else if (xp >= 600) { leagueName = this.l("Pipeline Crafter", "Pipeline Crafter"); leagueIcon = "⚔️"; }

    const badges = [
      { id: "first-proof", icon: "🧪", name: this.l("Bukti pertama", "First proof"), desc: this.l("Verifikasi bukti lab lokal DF1 atau TRY1 pertama Anda", "Verify your first local DF1 or TRY1 lab proof"), unlocked: (proofCount + tryItCount) >= 1 },
      { id: "sql-gladiator", icon: "⚡", name: this.l("Lima tantangan SQL", "Five SQL challenges"), desc: this.l("Selesaikan ≥ 5 tantangan SQL dengan tes mutasi hostil", "Solve ≥ 5 SQL challenges with hostile data tests"), unlocked: sqlCount >= 5 },
      { id: "chaos-defender", icon: "🛠️", name: this.l("Insiden diperbaiki", "Incident fixed"), desc: this.l("Selesaikan drill debugging CHAOS1 atau Silent Bug Clinic", "Complete a CHAOS1 terminal drill or Silent Bug case"), unlocked: (chaosCount + bugCount) >= 1 },
      { id: "fode-architect", icon: "📐", name: this.l("Arsitek Siklus Hidup Data", "Lifecycle Architect"), desc: this.l("Selesaikan simulasi Pertahanan Stakeholder atau Modul 0.2", "Complete a Stakeholder Defense drill or Module 0.2"), unlocked: defCount >= 1 || this.completedModules.includes("mod-0-2") },
      { id: "ship-it", icon: "🏆", name: this.l("Portofolio terkirim", "Portfolio shipped"), desc: this.l("Verifikasi repositori Git lokal dengan token PORT1", "Verify a local Git repository with a PORT1 token"), unlocked: portCount >= 1 }
    ];

    const quests = [
      { label: this.l("Baca & Tandai 3 Materi Konsep", "Read & Check Off 3 Concept Lessons"), cur: Math.min(3, readLessons), max: 3, xp: "+45 XP", link: "#/curriculum" },
      { label: this.l("Verifikasi 1 Latihan Lokal (TRY1 / DF1 / CHAOS1)", "Verify 1 Local Terminal Proof (TRY1 / DF1 / CHAOS1)"), cur: Math.min(1, proofCount + tryItCount + chaosCount), max: 1, xp: "+150 XP", link: "#/curriculum/mod-0-2/lab" },
      { label: this.l("Lulus 1 Tantangan SQL atau Silent Bug", "Solve 1 Hostile SQL or Silent Bug Drill"), cur: Math.min(1, sqlCount + bugCount), max: 1, xp: "+50 XP", link: "#/playground" }
    ];

    return { xp, streakDays: this.streakDays || 0, leagueName, leagueIcon, badges, quests, readLessons, tryItCount, proofCount, chaosCount, portCount, sqlCount };
  }

  renderRingProgress(pct, size = 44, strokeColor = "var(--accent)") {
    const r = (size - 8) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
    return `
      <div class="ring-progress" style="width:${size}px;height:${size}px" aria-hidden="true">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}"></circle>
          <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${strokeColor}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
        </svg>
        <span class="ring-label">${pct}%</span>
      </div>`;
  }

  renderMobileBottomNav() {
    const el = document.getElementById("mobile-bottom-nav");
    if (!el) return;
    const items = [
      { view: "roadmap", icon: "🏠", label: this.l("Beranda", "Roadmap") },
      { view: "curriculum", icon: "📚", label: this.l("Materi", "Learn") },
      { view: "playground", icon: "🧪", label: "SQL Lab" },
      { view: "interview", icon: "🎯", label: "Arena" },
      { view: "readiness", icon: "📊", label: this.l("Progres", "Stats") }
    ];
    el.innerHTML = items.map((it) => `
      <button class="${this.currentView === it.view ? "active" : ""}" onclick="app.go('${it.view}')">
        <span class="nav-ico">${it.icon}</span>
        <span>${this.esc(it.label)}</span>
      </button>`).join("");
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    writeStore("df_theme", this.theme);
    if (document.documentElement && document.documentElement.setAttribute) {
      document.documentElement.setAttribute("data-theme", this.theme);
    }
    this.renderChrome();
  }

  renderHeaderStats() {
    const total = CURRICULUM_DATA.reduce((n, lvl) => n + lvl.modules.length, 0);
    const done = this.completedModules.length;
    const pct = Math.round((done / total) * 100);
    const g = this.computeGamificationStats();
    const gamiEl = document.getElementById("header-gamification");
    if (gamiEl) {
      gamiEl.innerHTML = `
        <button class="progress-pill" onclick="app.go('readiness')" title="${this.l("Progres Anda: streak, XP, dan modul selesai. Klik untuk kesiapan kerja.", "Your progress: streak, XP and modules done. Click for job readiness.")}">
          <span>🔥 ${g.streakDays}</span><span>⚡ ${g.xp.toLocaleString()} XP</span><span>${done}/${total}</span>
          <span class="progress-pill-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
          <span class="sr-only">${this.l(`${done} dari ${total} modul selesai`, `${done} of ${total} modules completed`)}</span>
        </button>`;
    }
  }

  toggleSettings(force) {
    const menu = document.getElementById("settings-menu");
    const btn = document.getElementById("settings-btn");
    if (!menu || !btn) return;
    const open = typeof force === "boolean" ? force : menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open && !this._settingsBound) {
      this._settingsBound = true;
      document.addEventListener("click", (e) => { if (!e.target.closest(".settings")) this.toggleSettings(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.toggleSettings(false); });
    }
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
      "job-sim": () => this.renderJobSimView(),
      "interview": () => this.renderInterviewView(),
      "portfolio": () => this.renderPortfolioView(),
      "cv-builder": () => this.renderCvBuilderView(),
      "playground": () => this.renderPlaygroundView(),
      "readiness": () => this.renderReadinessView(),
      "remote-playbook": () => this.renderRemotePlaybookView()
    };
    container.innerHTML = views[this.currentView]();
    // entrance motion only when the learner arrives somewhere new: renderView also runs on every quiz answer,
    // checkbox and toggle, and replaying the entrance there makes the whole page flicker
    const mountKey = location.hash + "|" + this.currentView;
    if (mountKey !== this._lastMountKey) {
      this._lastMountKey = mountKey;
      this.choreographViewMount(container);
    }
    if (this.currentView === "playground") this.afterPlaygroundRender();
    if (this.currentView === "curriculum") {
      // keep the open lesson visible inside the sticky sidebar, without moving the page itself
      const aside = container.querySelector(".split > aside");
      const here = aside && (aside.querySelector(".side-lesson.here") || aside.querySelector(".mod-nav-card.active"));
      if (aside && here && aside.scrollHeight > aside.clientHeight) {
        const top = here.offsetTop - aside.offsetTop;
        if (top < aside.scrollTop || top > aside.scrollTop + aside.clientHeight - 40) aside.scrollTop = Math.max(0, top - aside.clientHeight / 3);
      }
    }
  }

  // ================= IN-BROWSER PYTHON LABS (Pyodide, in a Web Worker) =================
  // A lab can have two parts: Module 0.0 has Part A (plain code, browser lab "mod-0-0a") and Part B (functions, "mod-0-0").
  // Everything below the card (drafts, runs, the reference unlock) is keyed by the browser-lab id, so the parts stay separate.
  blHasParts(realModId) { return Boolean(window.BROWSER_LABS && window.BROWSER_LABS[realModId + "a"]); }
  blPart(realModId) {
    if (!this.blHasParts(realModId)) return "b";
    const chosen = this._blPartChoice && this._blPartChoice[realModId];
    if (chosen) return chosen;
    return this.isLessonDone(realModId, 4) ? "b" : "a";   // Part B uses def, which Lesson 5 teaches
  }
  setBlPart(realModId, part) {
    this._blPartChoice = Object.assign({}, this._blPartChoice, { [realModId]: part });
    this.renderView();
  }
  browserLabCard(realModId) {
    const hasParts = this.blHasParts(realModId);
    const part = this.blPart(realModId);
    const modId = hasParts && part === "a" ? realModId + "a" : realModId;   // the browser-lab id used below
    const bl = window.BROWSER_LABS && window.BROWSER_LABS[modId];
    if (!bl) return "";
    const draft = readStore("df_bl_" + modId, null);
    const code = typeof draft === "string" ? draft : bl.starter;
    const passed = (readStore("df_browser_labs", {}) || {})[modId];
    const last = (this._blOut && this._blOut[modId]) || {};
    const needLesson5Intro = hasParts && part === "b" && !this.isLessonDone(realModId, 4) && draft === null;
    const editorBlock = `
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
        <div id="bl-ref">${this.blReferenceHtml(modId)}</div>`;
    const switchHtml = hasParts ? `
        <div class="bl-parts" role="tablist" aria-label="${this.l("Bagian lab", "Lab part")}">
          <button role="tab" aria-selected="${part === "a"}" class="${part === "a" ? "active" : ""}" onclick="app.setBlPart('${realModId}','a')">${this.l("Bagian A: kode biasa (Pelajaran 1–4)", "Part A: plain code (Lessons 1–4)")}</button>
          <button role="tab" aria-selected="${part === "b"}" class="${part === "b" ? "active" : ""}" onclick="app.setBlPart('${realModId}','b')">${this.l("Bagian B: fungsi (mulai Pelajaran 5)", "Part B: functions (from Lesson 5)")}</button>
        </div>` : "";
    return `
      <div class="card browser-lab stack-sm" id="browser-lab">
        <div class="row between">
          <h3>${this.l("Pratinjau di browser (tidak dihitung)", "Browser preview (does not count)")}</h3>
          ${passed ? `<span class="state-done" id="bl-passed">✓ ${this.l("Pratinjau lulus", "Preview passed")}</span>` : `<span id="bl-passed"></span>`}
        </div>
        ${switchHtml}
        ${needLesson5Intro ? `
          <div class="callout">
            <p class="small"><strong>🪜 ${this.l("Bagian B memakai fungsi (<code>def</code>), yang diajarkan Pelajaran 5.", "Part B uses functions (<code>def</code>), which Lesson 5 teaches.")}</strong> ${this.l("Kerjakan Bagian A dulu (Pelajaran 1–4): kode biasa, tanpa fungsi.", "Do Part A first (Lessons 1–4): plain code, no functions.")}</p>
            <button class="btn btn-sm btn-primary" onclick="app.setBlPart('${realModId}','a')">${this.l("Ke Bagian A", "Go to Part A")}</button>
          </div>
          <details class="fold-callout"><summary class="label">${this.l("Lihat Bagian B sekarang (berisi fungsi def)", "Look at Part B now (contains def functions)")}</summary><div class="stack-sm" style="margin-top:8px">${editorBlock}</div></details>`
        : editorBlock}
      </div>`;
  }
  // The reference opens on progress, not on clicks: once at least half of the test groups have passed in one
  // run. Pressing Run three times with broken code no longer reveals all eleven answers.
  blReferenceHtml(modId) {
    const bl = window.BROWSER_LABS[modId];
    const best = ((readStore("df_bl_best", {}) || {})[modId]) || null;
    const groupCount = (bl.tests || []).reduce((n, t) => n + (String(bl.files[t] || "").match(/^class Test\w+/gm) || []).length, 0);
    const need = Math.ceil(groupCount / 2);
    const have = best && Number.isFinite(best.groups) ? best.groups : 0;
    if (have < need) {
      return `<p class="small muted">🔒 ${this.l(`Solusi referensi terbuka setelah minimal ${need} dari ${groupCount} grup tes bertanda ✓ dalam satu run (terbaik Anda sejauh ini: ${have}). Sampai saat itu, pesan error adalah petunjuk Anda: membaca dan memperbaikinya adalah inti latihan ini.`, `The reference solution unlocks once at least ${need} of the ${groupCount} test groups show ✓ in one run (your best so far: ${have}). Until then the error messages are your hints: reading and fixing them is the point of this exercise.`)}</p>`;
    }
    return `<details class="file"><summary>${this.l("Lihat solusi referensi", "Show the reference solution")} <span class="muted small">${this.l("(bandingkan setelah Anda mencoba sendiri; jangan menyalin)", "(compare after you have tried yourself; do not copy it)")}</span></summary>
      <pre><code>${this.esc(bl.reference)}</code></pre></details>`;
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
    const runs = readStore("df_bl_runs", {}) || {};
    runs[modId] = (runs[modId] || 0) + 1;
    writeStore("df_bl_runs", runs);
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
      if (this._padBusy) return;   // a lesson's Python pad is using the worker: its messages are not ours
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
          if (mark) { mark.className = "state-done"; mark.textContent = "✓ " + this.l("Pratinjau lulus", "Preview passed"); }
          summary = `<div class="feedback ok">✓ ${this.l(`Semua ${passed} tes lulus di pratinjau. Langkah yang sesungguhnya: kerjakan lab ini di terminal Anda sendiri (venv, pytest, editor Anda), tulis kodenya lagi tanpa menyalin, lalu jalankan python3 scripts/prove.py. Hanya itu yang dihitung.`, `All ${passed} tests pass in the preview. The real step: do this lab in your own terminal (venv, pytest, your own editor), write the code again without copying, then run python3 scripts/prove.py. Only that counts.`)}</div>`;
        } else if (passed > 0) {
          summary = `<div class="feedback info">${this.l(`${passed} dari ${passed + failed + errors} tes lulus. Grup bertanda ✓ sudah selesai; kerjakan langkah atau fungsi berikutnya, lalu jalankan lagi. Pesan di bawah menjelaskan yang masih gagal (baca dari baris paling bawah).`, `${passed} of ${passed + failed + errors} tests pass. Groups marked ✓ are done; write the next function, then run again. The messages below explain what still fails (read them from the bottom up).`)}</div>`;
        } else {
          summary = `<div class="feedback bad">${this.l(`${passed} lulus, ${failed} gagal, ${errors} error. Baca pesan di bawah dari baris paling bawah ke atas, perbaiki satu langkah atau fungsi, lalu jalankan lagi.`, `${passed} passed, ${failed} failed, ${errors} errors. Read the messages below from the bottom up, fix one step or function, then run again.`)}</div>`;
        }
        const raw = String(m.output).replace(/\/lab\//g, "");
        const groups = this.blGroups(bl, raw);
        this.blLockGroups(modId, groups);
        const first = groups.find((g) => g.pass < g.total && !g.locked);
        if (groups.some((g) => g.locked)) summary = this.blLockedSummary(modId, groups);
        this._blRun = this._blRun || {};
        this._blRun[modId] = { raw, groups, head: summary };
        const passedGroups = groups.filter((g) => g.pass === g.total).length;
        const bestAll = readStore("df_bl_best", {}) || {};
        if (!bestAll[modId] || passedGroups > (bestAll[modId].groups || 0)) {
          bestAll[modId] = { groups: passedGroups };
          writeStore("df_bl_best", bestAll);
        }
        const seen = readStore("df_bl_groups", {}) || {};   // test groups that have passed at least once, per lab part
        seen[modId] = [...new Set([...(seen[modId] || []), ...groups.filter((g) => g.pass === g.total).map((g) => g.name)])];
        writeStore("df_bl_groups", seen);
        this.refreshLabBanner();
        const refBox = document.getElementById("bl-ref");
        if (refBox) refBox.innerHTML = this.blReferenceHtml(modId);
        this.blShowGroup(modId, first ? first.name : null);
      } else if (m.type === "error" && m.id === id) {
        if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; }
        finish();
        this.blStatus(modId, "", `<div class="feedback bad">${this.l("Python gagal dimulai:", "Python failed to start:")} ${this.esc(m.message)}</div>`, "");
      }
    };
    w.onerror = (e) => kill(this.l("Python gagal dimuat. Muat ulang halaman dan coba lagi.", "Python failed to load. Reload the page and try again.") + " " + this.esc(e.message || ""));
    const files = Object.assign({}, bl.files, { [bl.editable]: area.value });
    // -rA lists every test as PASSED/FAILED at the end, so the result can show one line per test group.
    w.postMessage({ type: "run", id, files, args: [...bl.tests, "-rA"] });
  }
  // A lab with one step per lesson (Lab 0.0, Part A): a step whose lesson the learner has not reached yet is locked,
  // so its failing checks do not show up before the lesson that teaches them.
  blStepLessons(modId) {
    return { "mod-0-0a": { TestStep1Types: 1, TestStep2Collections: 2, TestStep3Decisions: 3, TestStep4Loops: 4 } }[modId] || null;
  }
  blLockGroups(modId, groups) {
    const map = this.blStepLessons(modId);
    if (!map) return;
    const base = modId.replace(/[a-z]$/, "");
    for (const g of groups) {
      const n = map[g.name];
      if (!n) continue;
      g.lesson = n;
      // reached = its lesson is read, or the learner came to the lab from that lesson (the Practice Pause button) or a later one
      const came = this.labReturn && this.labReturn.modId === base && this.labReturn.from >= n - 1;
      g.locked = g.pass < g.total && n > 1 && !this.isLessonDone(base, n - 1) && !came;
    }
  }
  blLockedSummary(modId, groups) {
    const base = modId.replace(/[a-z]$/, "");
    const open = groups.filter((g) => !g.locked);
    const pass = open.reduce((n, g) => n + g.pass, 0), total = open.reduce((n, g) => n + g.total, 0);
    const next = groups.filter((g) => g.locked).map((g) => g.lesson).sort((a, b) => a - b)[0];
    const allDone = open.every((g) => g.pass === g.total);
    const nextLesson = next - 1;   // the lesson to read first (0-based index of the lesson before the step's lesson)
    const btn = `<button class="btn btn-sm btn-primary" onclick="app.openLesson('${base}', ${Math.max(0, nextLesson)})">${this.l(`Buka Materi ${next}`, `Open Lesson ${next}`)} →</button>`;
    return allDone
      ? `<div class="feedback ok">✓ ${this.l(`Langkah yang sudah Anda capai lulus (${pass} dari ${total} tes). Langkah berikutnya datang setelah Materi ${next}: baca materinya dulu, lalu kembali ke sini. Tanda 🔒 di bawah bukan masalah.`, `The steps you have reached all pass (${pass} of ${total} tests). The next step comes after Lesson ${next}: read that lesson first, then come back here. The 🔒 marks below are not a problem.`)} ${btn}</div>`
      : `<div class="feedback info">${this.l(`${pass} dari ${total} tes lulus pada langkah yang sudah Anda capai. Perbaiki yang ✗ di bawah; langkah 🔒 menunggu materinya.`, `${pass} of ${total} tests pass in the steps you have reached. Fix the ✗ below; the 🔒 steps wait for their lesson.`)}</div>`;
  }
  // Per test class (TestFormatRupiah 4/4), in the order the test file defines them, read from pytest -rA.
  blGroups(bl, output) {
    const order = [];
    for (const t of bl.tests) {
      for (const m of String(bl.files[t] || "").matchAll(/^class (Test\w+)/gm)) order.push(m[1]);
    }
    const stat = {};
    for (const m of output.matchAll(/^(PASSED|FAILED|ERROR) [^\s:]+::(Test\w+)::/gm)) {
      const s = (stat[m[2]] = stat[m[2]] || { pass: 0, total: 0 });
      s.total += 1;
      if (m[1] === "PASSED") s.pass += 1;
    }
    return order.filter((n) => stat[n]).map((name) => ({ name, ...stat[name] }));
  }
  // pytest prints one "____ TestX.test_y ____" block per failing test; keep only the blocks of one group,
  // so the messages for the function the learner is working on are never cut off by the other ten.
  blGroupOutput(raw, group) {
    const lines = raw.split("\n");
    const blocks = [];
    let cur = null;
    for (const line of lines) {
      const h = line.match(/^_{3,} (.+?) _{3,}$/);
      if (h) { cur = { name: h[1], lines: [line] }; blocks.push(cur); continue; }
      if (/^={3,}/.test(line)) { cur = null; continue; }
      if (cur) cur.lines.push(line);
    }
    const mine = blocks.filter((b) => new RegExp(`(^|\\s)${group}\\.`).test(b.name));
    return mine.map((b) => b.lines.join("\n").trimEnd()).join("\n\n");
  }
  blShowGroup(modId, group) {
    const run = this._blRun && this._blRun[modId];
    if (!run) return;
    const chips = run.groups.length ? `<ul class="bl-groups" aria-label="${this.l("Hasil per grup tes", "Results per test group")}">${run.groups.map((g) => {
      const ok = g.pass === g.total;
      if (g.locked) return `<li class="locked"><span aria-hidden="true">🔒</span> <code>${g.name}</code> <span class="muted">${this.l(`setelah Materi ${g.lesson}`, `after Lesson ${g.lesson}`)}</span></li>`;
      const inner = `<span aria-hidden="true">${ok ? "✓" : "✗"}</span> <code>${g.name}</code> <span class="muted">${g.pass}/${g.total}</span><span class="sr-only">${ok ? this.l(" lulus", " passing") : this.l(" belum lulus", " not passing yet")}</span>`;
      return ok ? `<li class="ok">${inner}</li>`
        : `<li class="bad"><button type="button" class="bl-group-btn${g.name === group ? " selected" : ""}" aria-pressed="${g.name === group}" onclick="app.blShowGroup('${modId}', '${g.name}')">${inner}</button></li>`;
    }).join("")}</ul>` : "";
    let out = group ? this.blGroupOutput(run.raw, group) : "";
    let note = "";
    if (out) {
      note = `<p class="small muted">${this.l(`Pesan di bawah hanya untuk <code>${group}</code>. Klik grup ✗ lain untuk melihat pesannya. Baca setiap pesan dari baris paling bawah: baris yang diawali <code>E</code> menyebut apa yang salah.`, `The messages below are for <code>${group}</code> only. Click another ✗ group to see its messages. Read each message from the bottom line: the lines starting with <code>E</code> say what went wrong.`)}</p>`;
    } else if (/ERROR collecting/.test(run.raw) && /^E {2,}/m.test(run.raw)) {
      // The file could not even be loaded (usually a syntax error), so no test ran. pytest's own frames
      // (site-packages, <frozen importlib>) mean nothing to a beginner: keep only its "E" lines.
      out = run.raw.split("\n").filter((l) => /^E {2,}/.test(l)).join("\n");
      note = `<p class="small muted">${this.l("Python tidak bisa membaca file Anda, jadi belum ada tes yang berjalan. Pesan di bawah menyebut nomor baris dan menandai tempatnya dengan <code>^</code>. Kotak kode tidak punya nomor baris: cari baris yang dikutip, dan periksa juga baris tepat di atasnya, karena tanda kurung atau kutip yang belum ditutup sering baru ketahuan di baris berikutnya.", "Python could not read your file, so no test ran yet. The message below names a line number and marks the spot with <code>^</code>. The code box has no line numbers: find the quoted line, and check the line just above it too, because an unclosed bracket or quote is often only noticed on the next line.")}</p>`;
    } else if (!group && run.groups.some((g) => g.locked)) {
      out = "";   // everything reached passes and the rest is locked: there is nothing to read
    } else {
      // no per-test blocks and no "E" lines: show the end of the full output
      out = run.raw.length > 8000 ? "…\n" + run.raw.slice(-8000).slice(run.raw.slice(-8000).indexOf("\n") + 1) : run.raw;
    }
    this.blStatus(modId, "", run.head + chips + note, out);
  }

  // ================= LAB PROOF (scripts/prove.py prints a code; the app checks it) =================
  proofFor(modId) {
    const rec = (readStore("df_proofs", {}) || {})[modId];
    return rec && this.verifyProof(modId, rec.code).ok ? rec : null;
  }
  verifyProof(modId, raw) {
    return ProofCheck.verify(window.PROOF && window.PROOF[modId], modId, raw);
  }
  proofMessage(res) {
    const m = {
      format: this.l("Format kode tidak dikenali. Salin seluruh baris yang diawali DF1: persis seperti dicetak.", "The code format is not recognised. Copy the whole line starting with DF1: exactly as printed."),
      checksum: this.l("Kode rusak (salah ketik atau terpotong). Salin ulang seluruh baris.", "The code is damaged (typo or cut off). Copy the whole line again."),
      module: this.l(`Kode ini untuk modul lain (${res.mod || "?"}).`, `This code is for another module (${res.mod || "?"}).`),
      stale: this.l("Tes di komputer Anda berbeda dari tes kursus saat ini. Perbarui file kursus (git pull atau unduh ulang), kembalikan file tes yang Anda ubah, lalu jalankan lagi.", "The tests on your computer differ from the course's current tests. Update the course files (git pull or download again), restore any test file you edited, then run again."),
      copied: this.l("Pekerjaan Anda identik dengan solusi referensi. Tulis sendiri solusinya dengan kata-kata Anda, tanpa menyalin, lalu jalankan lagi.", "Your work is identical to the reference solution. Write the solution yourself, in your own words, without copying, then run again."),
      starter: this.l("File kerja Anda masih sama dengan titik awal. Kerjakan labnya dulu.", "Your work files are still the starter. Do the lab first."),
      passed: this.l("Kode ini tidak mencatat tes yang lulus.", "This code records no passing tests."),
      venv: this.l("Lab 0.2 harus dijalankan di dalam virtual environment (venv) milik Anda sendiri; Modul 0.1 menunjukkan caranya. Aktifkan venv lalu jalankan perintahnya lagi.", "Lab 0.2 must be run inside your own virtual environment (venv); Module 0.1 shows how. Activate the venv and run the command again."),
      none: this.l("Modul ini tidak memiliki bukti lab.", "This module has no lab proof.")
    };
    return m[res.reason] || m.format;
  }
  proofCard(modId) {
    const P = window.PROOF && window.PROOF[modId];
    if (!P) return "";
    const rec = this.proofFor(modId);
    const envNote = P.needsEnv && P.needsEnv.length ? `<li>${this.l(`Bagian yang memakai layanan membutuhkan variabel lingkungan ${P.needsEnv.join(", ")} (lihat langkah lab).`, `The part that uses a service needs the environment variable ${P.needsEnv.join(", ")} (see the lab steps).`)}</li>` : "";
    const info = rec ? this.verifyProof(modId, rec.code).info : null;
    return `
      <div class="card stack-sm" id="proof-card">
        <div class="row between">
          <h3>${this.l("Bukti: Anda mengerjakannya sendiri", "Proof: you did it yourself")}</h3>
          <span id="proof-state" class="${rec ? "state-done" : "muted small"}">${rec ? "✓ " + this.l("Terverifikasi", "Verified") : this.l("Belum ada bukti", "No proof yet")}</span>
        </div>
        <p class="small muted">${this.l("Hal terpenting di kursus ini adalah Anda mengerjakannya sendiri di komputer Anda. Setelah semua tes lulus di terminal Anda, jalankan perintah ini; ia menjalankan tes yang sama dan mencetak kode bukti pendek:", "The most important thing in this course is that you do the work yourself on your own computer. Once all the tests pass in your terminal, run this command; it runs the same tests and prints a short proof code:")}</p>
        <div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(P.command)}</code></pre></div>
        <ul class="small muted" style="margin-left:18px">
          <li>${this.l("Kode hanya tercetak jika semua tes lulus dan tidak ada yang dilewati.", "A code is printed only if every test passes and none is skipped.")}</li>
          ${P.requireVenv ? `<li>${this.l("Untuk lab ini, jalankan di dalam venv Anda (Modul 0.1).", "For this lab, run it inside your venv (Module 0.1).")}</li>` : ""}
          ${P.arg ? `<li>${this.l(`Ganti ${P.argExample || "~/kopiku"} dengan folder workspace yang Anda buat di lab ini.`, `Replace ${P.argExample || "~/kopiku"} with the workspace folder you made in this lab.`)}</li>` : ""}
          ${envNote}
          <li>${this.l("Ini pemeriksaan kejujuran, bukan keamanan: siapa pun bisa membaca skripnya. Gunanya agar Anda menyatakan \"saya mengerjakannya\" dengan bukti, demi kebaikan Anda sendiri.", "This is an honesty check, not security: anyone can read the script. It exists so you can state \"I did it\" with evidence, for your own benefit.")}</li>
        </ul>
        ${this.explainBoxHtml(modId)}
        <label class="label" for="proof-input">${this.l("Tempel kode bukti", "Paste your proof code")}</label>
        <div class="row">
          <input type="text" id="proof-input" autocomplete="off" spellcheck="false" placeholder="DF1:${modId}:…" value="${rec ? this.esc(rec.code) : ""}" style="flex:1;min-width:240px;font-family:ui-monospace,Menlo,Consolas,monospace" onkeydown="if(event.key==='Enter'){app.submitProof('${modId}')}" />
          <button class="btn btn-primary" onclick="app.submitProof('${modId}')">${this.l("Periksa kode", "Check code")}</button>
        </div>
        <div id="proof-result" aria-live="polite">${info ? this.proofOkHtml(info) : ""}</div>
      </div>`;
  }
  // Before the proof is accepted, the learner explains one piece of their own work in their own words.
  // Nobody grades it; being unable to write it is the signal that the work was copied or not understood yet.
  explainWords(text) { return String(text || "").split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length; }
  explainBoxHtml(modId) {
    const text = ((readStore("df_explain", {}) || {})[modId]) || "";
    const n = this.explainWords(text);
    return `
        <label class="label" for="explain-input">${this.l("Jelaskan dengan kata-kata Anda sendiri", "Explain it in your own words")}</label>
        <p class="small muted" id="explain-help">${this.l(`Pilih satu fungsi atau langkah yang paling sulit di lab ini. Tulis apa yang dilakukannya, satu kasus tepi yang ditanganinya, dan mengapa Anda menulisnya seperti itu. Minimal ${this.EXPLAIN_MIN} kata. Tidak ada yang menilai tulisan ini: jika Anda tidak bisa menjelaskannya, Anda belum menguasainya, dan itulah gunanya.`, `Pick the function or step of this lab that was hardest. Write what it does, one edge case it handles, and why you wrote it that way. At least ${this.EXPLAIN_MIN} words. Nobody grades this: if you cannot explain it, you have not mastered it yet, and that is the point.`)}</p>
        <textarea id="explain-input" class="notes-textarea" rows="4" aria-describedby="explain-help explain-count" oninput="app.saveExplain('${modId}', this.value)">${this.esc(text)}</textarea>
        <p class="small muted" id="explain-count">${n}/${this.EXPLAIN_MIN} ${this.l("kata", "words")}</p>`;
  }
  saveExplain(modId, value) {
    const c = document.getElementById("explain-count");
    if (c) c.textContent = `${this.explainWords(value)}/${this.EXPLAIN_MIN} ${this.l("kata", "words")}`;
    clearTimeout(this._explainSave);
    this._explainSave = setTimeout(() => { const all = readStore("df_explain", {}) || {}; all[modId] = value; writeStore("df_explain", all); }, 400);
  }
  get EXPLAIN_MIN() { return 30; }
  proofOkHtml(info) {
    const venv = { v: "venv", c: "conda env", n: this.l("tanpa venv", "no venv") }[info.venv] || info.venv;
    return `<div class="feedback ok">✓ ${this.l(`Bukti diterima: ${info.passed} tes/pemeriksaan lulus di komputer Anda (Python ${info.py}, ${info.os}, ${venv}).`, `Proof accepted: ${info.passed} tests/checks passed on your computer (Python ${info.py}, ${info.os}, ${venv}).`)}</div>`;
  }
  submitProof(modId) {
    const input = document.getElementById("proof-input");
    const out = document.getElementById("proof-result");
    if (!input || !out) return;
    const ex = document.getElementById("explain-input");
    const words = this.explainWords(ex ? ex.value : "");
    if (ex && words < this.EXPLAIN_MIN) {
      out.innerHTML = `<div class="feedback bad">${this.esc(this.l(`Tulis dulu penjelasan Anda di atas: minimal ${this.EXPLAIN_MIN} kata (sekarang ${words}).`, `First write your explanation above: at least ${this.EXPLAIN_MIN} words (now ${words}).`))}</div>`;
      ex.focus();
      return;
    }
    if (ex) { const all = readStore("df_explain", {}) || {}; all[modId] = ex.value; writeStore("df_explain", all); }
    const res = this.verifyProof(modId, input.value);
    if (!res.ok) {
      out.innerHTML = `<div class="feedback bad">${this.esc(this.proofMessage(res))}</div>`;
      return;
    }
    const all = readStore("df_proofs", {}) || {};
    all[modId] = { code: input.value.trim().replace(/\s+/g, ""), at: new Date().toISOString() };
    writeStore("df_proofs", all);
    out.innerHTML = this.proofOkHtml(res.info);
    const st = document.getElementById("proof-state");
    if (st) { st.className = "state-done"; st.textContent = "✓ " + this.l("Terverifikasi", "Verified"); }
    // a passed quiz was waiting for the proof: complete the module now
    const q = this.quizScores[modId];
    const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === modId);
    if (q && mod && q.best >= Math.ceil(mod.quiz.length * 0.8) && !this.completedModules.includes(modId)) {
      this.completedModules.push(modId);
      writeStore("df_completed_modules", this.completedModules);
      this.renderHeaderStats();
      out.innerHTML += `<div class="feedback ok">${this.l("Kuis sudah lulus, jadi modul ini sekarang ditandai selesai.", "The quiz was already passed, so this module is now marked complete.")}</div>`;
    }
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
    else if (!typing && overlay && overlay.hidden && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft") && this.stepKeyTarget()) {
      const t = this.stepKeyTarget();
      this.stepGo(t.modId, t.i, t.k + (e.key === "ArrowRight" ? 1 : -1));
    }
    else if (!typing && overlay && overlay.hidden && this.currentView === "curriculum" && this.activeModuleTab === "quiz" && this.quizMode === "uxcel") {
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        this.selectUxcelOption(this.activeModuleId, Number(e.key) - 1);
      } else if (e.key === "Enter") {
        const st = this.uxcelQuizState[this.activeModuleId];
        if (st && st.checked && !st.finished) {
          e.preventDefault();
          this.nextUxcelQuestion(this.activeModuleId);
        }
      }
    }
  }
  stripMd(text) {
    return String(text || "").replace(/\[\[diagram:[a-z0-9-]+\]\]/g, " ").replace(/^:::(?:advanced)?/gm, " ").replace(/```[a-z]*\n?/g, " ").replace(/[*`#|>_]/g, " ").replace(/\s+/g, " ").trim();
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
    if (e.kind === "lesson") this.openLesson(e.mod, e.i);
    else this.go("curriculum", e.mod, e.kind === "chaos" ? "chaos" : "concepts");
  }

  exportProgress() {
    const keys = ["df_completed_modules", "df_quiz_scores", "df_solved_challenges", "df_resume_edited", "df_resume_data", "df_lang", "df_theme", "df_browser_labs", "df_bl_runs", "df_bl_best", "df_bl_groups", "df_drills", "df_drill_code", "df_proofs", "df_explain", "df_lessons_done", "df_tryit_done", "df_chaos_done", "df_module_notes", "df_sql_attempts", "df_interview_drafts", "df_bug_drills", "df_active_recall", "df_chaos_proofs", "df_portfolio_proofs", "df_stakeholder_defense", "df_saved_tips", "df_streak", "df_career_path", "df_job_sim_proofs", "df_job_sim_gates", "df_pr_proofs", "df_job_career", "df_interview_sim"];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^df_bl_mod-\d-\d[a-z]?$/.test(k)) keys.push(k); } } catch (e) { /* storage unavailable */ }
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
      this._importing = true;   // restoring old progress is not studying today
      try {
        const d = JSON.parse(reader.result);
        if (!d || d.format !== "dataforge-progress") throw new Error("format");
        const ids = new Set(CURRICULUM_DATA.flatMap((l) => l.modules.map((m) => m.id)));
        if (Array.isArray(d.df_completed_modules)) this.completedModules = d.df_completed_modules.filter((x) => ids.has(x));
        if (d.df_quiz_scores && typeof d.df_quiz_scores === "object" && !Array.isArray(d.df_quiz_scores)) this.quizScores = d.df_quiz_scores;
        if (Array.isArray(d.df_solved_challenges)) this.solvedChallenges = d.df_solved_challenges.filter((x) => typeof x === "string");
        if (typeof d.df_resume_edited === "boolean") this.resumeEdited = d.df_resume_edited;
        if (d.df_resume_data && typeof d.df_resume_data === "object") this.resumeData = d.df_resume_data;
        if (d.df_lessons_done && typeof d.df_lessons_done === "object") this.lessonsDone = d.df_lessons_done;
        if (d.df_tryit_done && typeof d.df_tryit_done === "object") this.tryitDone = d.df_tryit_done;
        if (d.df_chaos_done && typeof d.df_chaos_done === "object") this.chaosDone = d.df_chaos_done;
        if (d.df_module_notes && typeof d.df_module_notes === "object") this.moduleNotes = d.df_module_notes;
        if (d.df_sql_attempts && typeof d.df_sql_attempts === "object") this.sqlAttempts = d.df_sql_attempts;
        if (d.df_interview_drafts && typeof d.df_interview_drafts === "object") this.interviewDrafts = d.df_interview_drafts;
        if (d.df_bug_drills && typeof d.df_bug_drills === "object") this.bugState = d.df_bug_drills;
        if (d.df_active_recall && typeof d.df_active_recall === "object") this.recallState = d.df_active_recall;
        writeStore("df_completed_modules", this.completedModules);
        writeStore("df_quiz_scores", this.quizScores);
        writeStore("df_solved_challenges", this.solvedChallenges);
        writeStore("df_resume_edited", this.resumeEdited);
        writeStore("df_resume_data", this.resumeData);
        writeStore("df_lessons_done", this.lessonsDone);
        writeStore("df_tryit_done", this.tryitDone);
        writeStore("df_chaos_done", this.chaosDone);
        writeStore("df_module_notes", this.moduleNotes);
        writeStore("df_sql_attempts", this.sqlAttempts);
        writeStore("df_interview_drafts", this.interviewDrafts);
        writeStore("df_bug_drills", this.bugState);
        writeStore("df_active_recall", this.recallState);
        if (d.df_browser_labs && typeof d.df_browser_labs === "object" && !Array.isArray(d.df_browser_labs)) writeStore("df_browser_labs", d.df_browser_labs);
        if (d.df_bl_runs && typeof d.df_bl_runs === "object" && !Array.isArray(d.df_bl_runs)) writeStore("df_bl_runs", d.df_bl_runs);
        if (d.df_bl_best && typeof d.df_bl_best === "object" && !Array.isArray(d.df_bl_best)) writeStore("df_bl_best", d.df_bl_best);
        if (d.df_bl_groups && typeof d.df_bl_groups === "object" && !Array.isArray(d.df_bl_groups)) writeStore("df_bl_groups", d.df_bl_groups);
        if (d.df_drills && typeof d.df_drills === "object" && !Array.isArray(d.df_drills)) writeStore("df_drills", d.df_drills);
        if (d.df_drill_code && typeof d.df_drill_code === "object" && !Array.isArray(d.df_drill_code)) writeStore("df_drill_code", d.df_drill_code);
        const objOf = (v) => v && typeof v === "object" && !Array.isArray(v);
        if (objOf(d.df_job_sim_proofs)) { this.jobSimProofs = d.df_job_sim_proofs; writeStore("df_job_sim_proofs", this.jobSimProofs); }
        if (objOf(d.df_job_sim_gates)) { this.jobSimGates = d.df_job_sim_gates; writeStore("df_job_sim_gates", this.jobSimGates); }
        if (objOf(d.df_pr_proofs)) { this.prProofs = d.df_pr_proofs; writeStore("df_pr_proofs", this.prProofs); }
        if (objOf(d.df_job_career)) { this._jc = d.df_job_career; writeStore("df_job_career", this._jc); }
        if (objOf(d.df_interview_sim)) { this._is = d.df_interview_sim; writeStore("df_interview_sim", this._is); }
        if (d.df_explain && typeof d.df_explain === "object" && !Array.isArray(d.df_explain)) {
          const kept = {};
          for (const [id, t] of Object.entries(d.df_explain)) if (typeof t === "string" && t.length < 20000) kept[id] = t;
          writeStore("df_explain", kept);
        }
        if (d.df_proofs && typeof d.df_proofs === "object" && !Array.isArray(d.df_proofs)) {
          const kept = {};
          for (const [id, rec] of Object.entries(d.df_proofs)) if (rec && typeof rec.code === "string" && this.verifyProof(id, rec.code).ok) kept[id] = { code: rec.code, at: String(rec.at || "") };
          writeStore("df_proofs", kept);
        }
        for (const k of Object.keys(d)) if (/^df_bl_mod-\d-\d[a-z]?$/.test(k) && typeof d[k] === "string" && d[k].length < 200000) writeStore(k, d[k]);
        if (d.df_streak && typeof d.df_streak.lastDate === "string" && Number.isFinite(Number(d.df_streak.days))) writeStore("df_streak", { days: Number(d.df_streak.days), lastDate: d.df_streak.lastDate });
        this.touchStreak();
        this.renderChrome(); this.renderView();
        alert(this.l("Progres berhasil diimpor.", "Progress imported."));
      } catch (e) {
        alert(this.l("File tidak valid: pilih file hasil Ekspor progres dari DataForge.", "Invalid file: choose a file created by DataForge's Export progress."));
      } finally {
        this._importing = false;
      }
    };
    reader.readAsText(file);
  }

  // ---------- Active learning helpers ----------
  isLessonDone(modId, idx) {
    const arr = this.lessonsDone[modId];
    return Array.isArray(arr) && arr.includes(idx);
  }
  toggleLessonDone(modId, idx, jumpNext) {
    const arr = Array.isArray(this.lessonsDone[modId]) ? [...this.lessonsDone[modId]] : [];
    const pos = arr.indexOf(idx);
    if (pos >= 0) arr.splice(pos, 1);
    else arr.push(idx);
    this.lessonsDone[modId] = arr;
    writeStore("df_lessons_done", this.lessonsDone);
    this.renderView();
    if (pos < 0) {
      const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === modId);
      const total = mod ? mod.lessons.length : 0;
      const nextIdx = mod ? mod.lessons.findIndex((_, i) => !arr.includes(i)) : -1;
      if (total && arr.length >= total) {
        this.showToast(`✓ ${this.l(`Semua ${total} materi selesai dibaca. Langkah berikutnya ada di peta materi.`, `All ${total} lessons read. Your next step is on the lesson map.`)}`);
        return;
      }
      this.showToast(`✓ ${this.l(`Materi ${idx + 1} selesai · ${arr.length} dari ${total}`, `Lesson ${idx + 1} done · ${arr.length} of ${total}`)}${nextIdx >= 0 ? ` · ${this.l("berikutnya", "next")}: ${this.esc(this.t(mod.lessons[nextIdx].title))}` : ""}`);
    }
    if (jumpNext && pos < 0 && mod_next_exists(this, modId, idx)) this.openLesson(modId, idx + 1);
  }
  showToast(html) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.innerHTML = html;
    el.hidden = false;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.classList.remove("show"); setTimeout(() => { el.hidden = true; }, 250); }, 4000);
  }
  setLessonFilter(filter) {
    this.lessonFilter = filter;
    this.renderView();
  }
  // The lesson to study next: the first unread lesson that is not optional; optional ones only when the rest are read.
  nextLessonIdx(mod) {
    const core = mod.lessons.findIndex((ls, i) => !ls.optional && !this.isLessonDone(mod.id, i));
    return core >= 0 ? core : mod.lessons.findIndex((_, i) => !this.isLessonDone(mod.id, i));
  }
  optionalBadge(ls) {
    return ls && ls.optional ? `<span class="micro-badge opt" title="${this.l("Boleh dilewati pada putaran pertama; kembali sebelum mencari kerja. Lab berikutnya tidak membutuhkannya.", "You may skip this on the first pass and come back before job hunting. Later labs do not need it.")}">${this.l("Opsional", "Optional")}</span>` : "";
  }
  jumpNextUnreadLesson(modId) {
    const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === modId);
    if (!mod) return;
    const nextIdx = this.nextLessonIdx(mod);
    if (nextIdx >= 0) this.openLesson(modId, nextIdx);
  }
  // ---------- drills: a small exercise with checks, inside a lesson ----------
  drillState(key) { return this.drillsDone[key] || null; }
  drillDone(key) { const d = this.drillsDone[key]; return Boolean(d && (d.passed || d.revealed)); }
  renderDrill(text, ctx, idx) {
    const d = window.DrillParse && window.DrillParse.parse(text);
    if (!d) return "";
    const key = ctx && ctx.modId != null ? `${ctx.modId}:${ctx.lessonIdx || 0}:${idx}` : `loose:${idx}`;
    this._drills[key] = d;
    this.warmPython();
    const st = this.drillState(key);
    if (d.kind === "ask") return this.renderAsk(d, key, st);
    if (d.lang === "sql") return this.renderSqlDrill(d, key, st);
    const code = typeof this.drillCode[key] === "string" ? this.drillCode[key] : d.starter;
    const rows = Math.min(16, Math.max(4, code.split("\n").length + 1));
    const badge = st && st.passed ? `<span class="chip chip-blue">✓ ${this.l("Benar", "Correct")}</span>` : st && st.revealed ? `<span class="chip">${this.l("Jawaban dilihat", "Solution seen")}</span>` : "";
    return `<div class="drill ${st && st.passed ? "is-done" : ""}" data-key="${this.esc(key)}">
      <div class="drill-head"><span class="drill-tag">🎯 ${this.l("Latihan", "Drill")}</span> <strong>${this.inline(d.title)}</strong> ${badge}</div>
      <div class="drill-task stack-sm">${this.md(d.task)}</div>
      ${d.files && Object.keys(d.files).length ? `<details class="sql-tables"><summary>${this.l("Berkas contoh (ada di sebelah kode Anda)", "Sample files (next to your code)")}</summary>${Object.entries(d.files).map(([n, t]) => `<div><strong>${this.esc(n)}</strong><pre class="pad-out">${this.esc(t.trimEnd())}</pre></div>`).join("")}</details>` : ""}
      <textarea class="pad-code drill-code" rows="${rows}" spellcheck="false" aria-label="${this.l("Kode Anda", "Your code")}" oninput="app.drillSave(this)" onkeydown="app.blKey(event, 'drill');if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();app.drillRun(this)}">${this.esc(code)}</textarea>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" onclick="app.drillRun(this)">${this.l("Jalankan & periksa", "Run & check")}</button>
        ${d.hint ? `<button class="btn btn-sm btn-quiet" onclick="app.drillHint(this)">💡 ${this.l("Petunjuk", "Hint")}</button>` : ""}
        ${d.solution ? `<button class="btn btn-sm btn-quiet" onclick="app.drillSolution(this)">${this.l("Lihat jawaban", "Show the solution")}</button>` : ""}
        <button class="btn btn-sm btn-quiet" onclick="app.drillReset(this)">${this.l("Ulangi dari awal", "Start over")}</button>
        <span class="small muted">Ctrl+Enter</span>
      </div>
      <div class="drill-extra stack-sm" aria-live="polite"></div>
      <div class="drill-out stack-sm" role="status" aria-live="polite">${st && st.passed ? `<div class="feedback ok">✓ ${this.l("Benar! Semua pemeriksaan lulus.", "Correct! Every check passes.")}</div>${this.drillLocalBox(d)}` : ""}</div>
    </div>`;
  }
  // Load Python in the background as soon as a lesson with drills or animations is on screen, so the first Run answers quickly.
  warmPython() {
    if (this._warmed || !window.Worker || location.protocol === "file:") return;
    this._warmed = true;
    try {
      if (!this._blWorker) this._blWorker = new Worker("js/pyodide-worker.js", { type: "module" });
      this._blWorker.postMessage({ type: "warm" });
    } catch (e) { this._warmed = false; }
  }
  // ---------- "watch it run": the program line by line, with the variables (like Python Tutor) ----------
  traceKey(d, ctx) {
    let h = 5381;
    for (const ch of d.code) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
    return `${ctx && ctx.modId != null ? ctx.modId + ":" + (ctx.lessonIdx || 0) : "loose"}:t${(h >>> 0).toString(36)}`;
  }
  renderTrace(text, ctx) {
    const d = window.DrillParse && window.DrillParse.parse(text);
    if (d && d.kind === "sqlsteps") return this.renderSqlSteps(d, ctx);
    if (!d || d.kind !== "trace") return "";
    const key = this.traceKey(d, ctx);
    this._traceDefs = this._traceDefs || {};
    this._traceDefs[key] = d;
    this.warmPython();
    return `<div class="trace" data-key="${this.esc(key)}">${this.traceInner(key)}</div>`;
  }
  traceInner(key) {
    const d = this._traceDefs[key], st = (this._traces || {})[key];
    const head = `<div class="trace-head"><span class="drill-tag">🎬 ${this.l("Lihat cara kerjanya", "Watch it run")}</span> <strong>${this.inline(d.title)}</strong></div>${d.task ? `<div class="stack-sm">${this.md(d.task)}</div>` : ""}`;
    const lineOf = (n, cur) => `<li class="${n === cur ? "current" : ""}"><span class="trace-arrow" aria-hidden="true">${n === cur ? "▶" : ""}</span><code>${this.esc(d.code.split("\n")[n - 1] || " ")}</code></li>`;
    const codeList = (cur) => `<ol class="trace-code">${d.code.split("\n").map((_, k) => lineOf(k + 1, cur)).join("")}</ol>`;
    if (!st) return `${head}${codeList(0)}<div class="row"><button class="btn btn-primary" onclick="app.traceLoad(this)">▶ ${this.l("Jalankan langkah demi langkah", "Run it step by step")}</button></div>`;
    if (st.loading) return `${head}${codeList(0)}<div class="feedback info">${this.l("Memuat Python (sekitar 12 MB, hanya sekali)…", "Loading Python (about 12 MB, only once)…")}</div>`;
    if (st.failed) return `${head}${codeList(0)}<div class="feedback bad">${this.esc(st.failed)}</div><div class="row"><button class="btn btn-sm" onclick="app.traceLoad(this)">${this.l("Coba lagi", "Try again")}</button></div>`;
    const steps = st.steps, i = st.at, step = steps[i], prev = steps[i - 1];
    const changed = new Set();
    if (prev) {
      const old = {};
      prev.frames.forEach((f) => f.vars.forEach((v) => { old[f.name + "|" + v[0]] = v[1] + "|" + v[2]; }));
      step.frames.forEach((f) => f.vars.forEach((v) => { if (old[f.name + "|" + v[0]] !== v[1] + "|" + v[2]) changed.add(f.name + "|" + v[0]); }));
    }
    const frames = step.frames.map((f) => `<div class="trace-frame"><div class="trace-frame-name">${this.esc(f.name)}</div>${f.vars.length ? `<table>${f.vars.map((v) => `<tr class="${changed.has(f.name + "|" + v[0]) ? "changed" : ""}"><th>${this.esc(v[0])}</th><td>${v[2] ? `<span class="trace-tag">${this.esc(v[2])}</span> ` : ""}${this.esc(v[1])}</td></tr>`).join("")}</table>` : `<div class="small muted">${this.l("(belum ada variabel)", "(no variables yet)")}</div>`}</div>`).join("");
    let note = d.notes[String(step.line)] || "";
    if (step.event === "return") note = this.l(`Fungsi selesai dan mengembalikan ${step.ret}.`, `The function ends and hands back ${step.ret}.`);
    if (step.event === "end") note = this.l("Program selesai. Ini nilai akhir semua variabel.", "The program has finished. These are the final values of every variable.");
    const label = step.event === "end" ? this.l("Selesai", "Finished") : `${this.l("Langkah", "Step")} ${i + 1} / ${steps.length}`;
    return `${head}
      <div class="trace-grid">${step.line ? codeList(step.line) : codeList(0)}<div class="trace-state" aria-live="polite">${frames}</div></div>
      ${note ? `<div class="trace-note">${this.inline(note)}</div>` : `<div class="trace-note muted">${step.event === "line" ? this.l("Baris yang diberi tanda ▶ akan dijalankan berikutnya.", "The line marked ▶ is the next one to run.") : ""}</div>`}
      ${step.out && step.out.trim() ? `<div><div class="small muted">${this.l("Yang tercetak sejauh ini:", "Printed so far:")}</div><pre class="pad-out">${this.esc(step.out.trimEnd())}</pre></div>` : ""}
      ${st.error ? `<div class="feedback info small">${this.l("Program ini berhenti dengan error:", "This program stops with an error:")} <code>${this.esc(st.error)}</code></div>` : ""}
      <div class="row trace-ctl" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-sm btn-quiet" onclick="app.traceGo(this, 0)" ${i === 0 ? "disabled" : ""}>⏮</button>
        <button class="btn btn-sm" onclick="app.traceGo(this, ${i - 1})" ${i === 0 ? "disabled" : ""}>← ${this.l("Mundur", "Back")}</button>
        <span class="small">${label}</span>
        <button class="btn btn-sm btn-primary" onclick="app.traceGo(this, ${i + 1})" ${i >= steps.length - 1 ? "disabled" : ""}>${this.l("Maju", "Next")} →</button>
        <button class="btn btn-sm btn-quiet" onclick="app.tracePlay(this)">${st.playing ? "⏸ " + this.l("Jeda", "Pause") : "▶ " + this.l("Putar", "Play")}</button>
      </div>`;
  }
  traceBox(el) { return el.closest(".trace"); }
  traceRedraw(box) { box.innerHTML = this.traceInner(box.dataset.key); }
  traceGo(el, n) {
    const box = this.traceBox(el), st = this._traces[box.dataset.key];
    if (!st || !st.steps) return;
    st.at = Math.min(Math.max(0, n), st.steps.length - 1);
    this.traceRedraw(box);
  }
  tracePlay(el) {
    const box = this.traceBox(el), key = box.dataset.key, st = this._traces[key];
    if (!st || !st.steps) return;
    if (st.playing) { st.playing = false; clearInterval(st.timer); this.traceRedraw(box); return; }
    if (st.at >= st.steps.length - 1) st.at = 0;
    st.playing = true;
    st.timer = setInterval(() => {
      const live = document.querySelector(`.trace[data-key="${key}"]`);
      if (!live || st.at >= st.steps.length - 1) { st.playing = false; clearInterval(st.timer); if (live) this.traceRedraw(live); return; }
      st.at += 1;
      this.traceRedraw(live);
    }, 1100);
    this.traceRedraw(box);
  }
  traceLoad(el) {
    const box = this.traceBox(el), key = box.dataset.key, d = this._traceDefs[key];
    this._traces = this._traces || {};
    if (!window.Worker || location.protocol === "file:") { this._traces[key] = { failed: this.l("Browser ini tidak bisa menjalankan Python di halaman yang dibuka dari file. Jalankan situs dengan python3 server.py.", "This browser cannot run Python on a page opened from a file. Run the site with python3 server.py.") }; this.traceRedraw(box); return; }
    if (this._padBusy || this._blBusy) { this._traces[key] = { failed: this.l("Python masih sibuk. Coba lagi sebentar.", "Python is busy. Try again in a moment.") }; this.traceRedraw(box); return; }
    if (!this._blWorker) { try { this._blWorker = new Worker("js/pyodide-worker.js", { type: "module" }); } catch (e) { this._traces[key] = { failed: this.l("Tidak bisa memulai Python di browser ini.", "Could not start Python in this browser.") }; this.traceRedraw(box); return; } }
    const w = this._blWorker, id = (this._padId = (this._padId || 0) + 1);
    this._padBusy = true;
    this._traces[key] = { loading: true };
    this.traceRedraw(box);
    let timer;
    const done = () => { this._padBusy = false; clearTimeout(timer); w.removeEventListener("message", onMsg); };
    const onMsg = (ev) => {
      const m = ev.data;
      if (m.type === "traceresult" && m.id === id) {
        done();
        const r = JSON.parse(m.json);
        this._traces[key] = { steps: r.steps, error: r.error, at: 0 };
        const live = document.querySelector(`.trace[data-key="${key}"]`);
        if (live) this.traceRedraw(live);
      } else if (m.type === "error" && m.id === id) {
        done();
        this._traces[key] = { failed: m.message };
        const live = document.querySelector(`.trace[data-key="${key}"]`);
        if (live) this.traceRedraw(live);
      }
    };
    w.addEventListener("message", onMsg);
    timer = setTimeout(() => { if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; } done(); this._traces[key] = { failed: this.l("Memuat Python terlalu lama. Periksa koneksi lalu coba lagi.", "Loading Python took too long. Check your connection and try again.") }; const live = document.querySelector(`.trace[data-key="${key}"]`); if (live) this.traceRedraw(live); }, 240000);
    w.postMessage({ type: "trace", id, code: d.code, files: d.files || {} });
  }

  // ---------- SQL drills (sql.js): the learner's RESULT is compared with the model answer's result ----------
  sqlCtx(dataKey) {
    const P = window.SQL_PLAYGROUND, ds = P && P.datasets[dataKey];
    return ds ? { setup: ds.setup, mutation: (P.adversarialMutations || {})[dataKey] || "" } : null;
  }
  sqlTable(columns, rows, opts) {
    opts = opts || {};
    const cell = (v) => (v === null ? `<span class="sql-null">NULL</span>` : this.esc(String(v)));
    const more = rows.length > 12 ? `<div class="small muted">${this.l(`Menampilkan 12 dari ${rows.length} baris.`, `Showing 12 of ${rows.length} rows.`)}</div>` : "";
    return `<div class="table-wrap"><table class="sql-result"><thead><tr>${columns.map((c) => `<th>${this.esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 12).map((r, i) => `<tr class="${(opts.cls && opts.cls[i]) || ""}">${r.map((v) => `<td>${cell(v)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${columns.length}" class="muted">${this.l("(tidak ada baris)", "(no rows)")}</td></tr>`}</tbody></table></div>${more}`;
  }
  renderSqlDrill(d, key, st) {
    this.warmSql();
    const code = typeof this.drillCode[key] === "string" ? this.drillCode[key] : d.starter;
    const rows = Math.min(14, Math.max(4, code.split("\n").length + 1));
    const badge = st && st.passed ? `<span class="chip chip-blue">✓ ${this.l("Benar", "Correct")}</span>` : st && st.revealed ? `<span class="chip">${this.l("Jawaban dilihat", "Solution seen")}</span>` : "";
    return `<div class="drill drill-sql ${st && st.passed ? "is-done" : ""}" data-key="${this.esc(key)}">
      <div class="drill-head"><span class="drill-tag">🗃️ ${this.l("Latihan SQL", "SQL drill")}</span> <strong>${this.inline(d.title)}</strong> ${badge}</div>
      <div class="drill-task stack-sm">${this.md(d.task)}</div>
      <details class="sql-tables" data-data="${this.esc(d.data)}" ontoggle="app.sqlTablesOpen(this)"><summary>${this.l("Lihat tabel-tabelnya", "See the tables")}</summary><div class="sql-tables-body small muted">${this.l("Memuat…", "Loading…")}</div></details>
      <textarea class="pad-code drill-code" rows="${rows}" spellcheck="false" aria-label="${this.l("Query SQL Anda", "Your SQL query")}" oninput="app.drillSave(this)" onkeydown="app.blKey(event, 'drill');if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();app.drillRun(this)}">${this.esc(code)}</textarea>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" onclick="app.drillRun(this)">${this.l("Jalankan & periksa", "Run & check")}</button>
        ${d.hint ? `<button class="btn btn-sm btn-quiet" onclick="app.drillHint(this)">💡 ${this.l("Petunjuk", "Hint")}</button>` : ""}
        ${d.solution ? `<button class="btn btn-sm btn-quiet" onclick="app.drillSolution(this)">${this.l("Lihat jawaban", "Show the solution")}</button>` : ""}
        <button class="btn btn-sm btn-quiet" onclick="app.drillReset(this)">${this.l("Ulangi dari awal", "Start over")}</button>
        <span class="small muted">Ctrl+Enter</span>
      </div>
      <div class="drill-extra stack-sm" aria-live="polite"></div>
      <div class="drill-out stack-sm" role="status" aria-live="polite">${st && st.passed ? `<div class="feedback ok">✓ ${this.l("Benar! Hasil query Anda sama dengan yang diharapkan.", "Correct! Your query gives the expected result.")}</div>${this.drillLocalBox(d)}` : ""}</div>
    </div>`;
  }
  warmSql() { if (window.SQL_PLAYGROUND && !this._sqlWarm) { this._sqlWarm = true; window.SQL_PLAYGROUND.init(); } }
  sqlTablesOpen(det) {
    if (det.dataset.loaded || !det.open) return;
    det.dataset.loaded = "1";
    const body = det.querySelector(".sql-tables-body");
    window.SQL_PLAYGROUND.init().then((SQL) => {
      const ctx = this.sqlCtx(det.dataset.data);
      if (!ctx) { body.textContent = "?"; return; }
      const db = window.SqlDrill.fresh(SQL, ctx.setup, "");
      const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      const out = (names.length ? names[0].values : []).map(([name]) => {
        const r = window.SqlDrill.exec(db, `SELECT * FROM ${name} LIMIT 5`);
        const n = db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
        return `<div><strong>${this.esc(name)}</strong> <span class="muted">(${r.columns.join(", ")}) · ${n} ${this.l("baris", "rows")}</span>${this.sqlTable(r.columns, r.rows)}</div>`;
      }).join("");
      db.close();
      body.className = "sql-tables-body stack-sm";
      body.innerHTML = out;
    });
  }
  sqlFriendlyError(msg) {
    let tip = "";
    if (/no such column/i.test(msg)) tip = this.l(" Periksa ejaan kolom dengan membuka 'Lihat tabel-tabelnya'.", " Check the column's spelling: open 'See the tables'.");
    else if (/no such table/i.test(msg)) tip = this.l(" Periksa ejaan nama tabel di 'Lihat tabel-tabelnya'.", " Check the table's spelling: open 'See the tables'.");
    else if (/syntax error/i.test(msg)) tip = this.l(" SQLite berhenti membaca di titik yang disebut. Periksa koma, tanda kutip, kurung, dan ejaan kata kunci tepat sebelum titik itu.", " SQLite stopped reading at the point named. Check commas, quotes, brackets and keyword spelling just before it.");
    else if (/ambiguous column/i.test(msg)) tip = this.l(" Kolom itu ada di dua tabel: tulis dengan alias tabel, misalnya o.customer_id.", " That column exists in two tables: write it with the table alias, for example o.customer_id.");
    return `<div class="feedback bad">${this.l("SQL Anda berhenti dengan error:", "Your SQL stopped with an error:")} <code>${this.esc(msg)}</code>${tip}</div>`;
  }
  sqlDrillRun(box, key, d) {
    const ta = box.querySelector(".drill-code"), out = box.querySelector(".drill-out");
    this.drillCode[key] = ta.value;
    writeStore("df_drill_code", this.drillCode);
    const P = window.SQL_PLAYGROUND, ctx = this.sqlCtx(d.data);
    if (!P || !window.SqlDrill || !ctx) { out.innerHTML = `<div class="feedback bad">${this.l("Mesin SQL tidak tersedia.", "The SQL engine is not available.")}</div>`; return; }
    if (!ta.value.trim()) { out.innerHTML = `<div class="feedback info">${this.l("Tulis query Anda dulu.", "Write your query first.")}</div>`; return; }
    out.innerHTML = `<div class="feedback info">${this.l("Memeriksa…", "Checking…")}</div>`;
    P.init().then((SQL) => {
      const g = window.SqlDrill.grade(SQL, ctx, d, ta.value);
      const table = g.result ? `<div><div class="small muted">${this.l("Hasil query Anda:", "Your query's result:")}</div>${this.sqlTable(g.result.columns, g.result.rows)}</div>` : "";
      if (g.kind === "error") { out.innerHTML = this.sqlFriendlyError(g.error); return; }
      if (g.ok) {
        const first = !(this.drillsDone[key] && this.drillsDone[key].passed);
        this.drillsDone[key] = { passed: new Date().toISOString() };
        writeStore("df_drills", this.drillsDone);
        out.innerHTML = `<div class="feedback ok">✓ ${this.l("Benar! Hasil query Anda sama dengan yang diharapkan.", "Correct! Your query gives the expected result.")}</div>${table}${this.drillLocalBox(d)}`;
        if (first) this.drillRefreshNav();
        return;
      }
      const msg = {
        need: () => this.inline(g.msg),
        empty: () => this.l("Query Anda berjalan tetapi tidak menghasilkan tabel. Sudah menulis SELECT?", "Your SQL ran but did not make a result table. Did you write a SELECT?"),
        columns: () => this.l(`Hasil Anda punya ${g.got} kolom, yang diharapkan ${g.expected}. Baca lagi kolom apa yang diminta soal.`, `Your result has ${g.got} columns, but ${g.expected} are expected. Re-read which columns the task asks for.`),
        names: () => this.l(`Nama kolom harus: ${g.expected.join(", ")}. Punya Anda: ${g.got.join(", ")}. Ganti nama dengan AS.`, `The column names should be: ${g.expected.join(", ")}. Yours: ${g.got.join(", ")}. Rename with AS.`),
        rows: () => this.l(`Hasil Anda punya ${g.got} baris, yang diharapkan ${g.expected}. Periksa WHERE, JOIN, atau GROUP BY Anda.`, `Your result has ${g.got} rows, but ${g.expected} are expected. Check your WHERE, JOIN or GROUP BY.`),
        values: () => this.l("Jumlah barisnya cocok, tetapi isinya belum. Bandingkan dengan pertanyaannya: apa yang dihitung atau disaring?", "The number of rows matches, but the values do not. Compare with the question: what is being counted or filtered?"),
        order: () => this.l("Baris-barisnya benar tetapi urutannya salah. Periksa ORDER BY (dan ASC / DESC).", "The rows are right but in the wrong order. Check ORDER BY (and ASC / DESC)."),
        "other-data": () => this.l("Query Anda benar untuk data ini, tetapi gagal untuk data yang sedikit berbeda (pelanggan tambahan, nilai NULL, status lain). Kemungkinan Anda menuliskan nilai secara tetap atau melewatkan kasus NULL.", "Your query is right for this data, but not for slightly different data (extra customers, NULL values, other statuses). It probably hard-codes something or misses a NULL case."),
        "broken-drill": () => this.l("Latihan ini bermasalah. Mohon laporkan.", "This drill has a problem. Please report it."),
      }[g.kind];
      out.innerHTML = `<div class="feedback info">${msg ? msg() : this.l("Belum tepat.", "Not quite yet.")}</div>${table}`;
    });
  }

  // ---------- "watch it run" for SQL: the same question, one clause at a time ----------
  renderSqlSteps(d, ctx) {
    let h = 5381;
    for (const ch of d.title + d.stages.map((x) => x.sql).join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
    const key = `${ctx && ctx.modId != null ? ctx.modId + ":" + (ctx.lessonIdx || 0) : "loose"}:q${(h >>> 0).toString(36)}`;
    this._traceDefs = this._traceDefs || {};
    this._traceDefs[key] = d;
    this.warmSql();
    return `<div class="trace sqlsteps" data-key="${this.esc(key)}">${this.sqlStepsInner(key)}</div>`;
  }
  sqlStepsInner(key) {
    const d = this._traceDefs[key], st = (this._sqlSteps || {})[key];
    const head = `<div class="trace-head"><span class="drill-tag">🎬 ${this.l("Lihat cara kerjanya", "Watch it run")}</span> <strong>${this.inline(d.title)}</strong></div>${d.task ? `<div class="stack-sm">${this.md(d.task)}</div>` : ""}`;
    if (!st) return `${head}<div class="row"><button class="btn btn-primary" onclick="app.sqlStepsLoad(this)">▶ ${this.l("Tampilkan langkah demi langkah", "Show it step by step")}</button></div>`;
    if (st.failed) return `${head}<div class="feedback bad">${this.esc(st.failed)}</div>`;
    const i = st.at, g = st.stages[i], prev = st.stages[i - 1];
    let rowsHtml = "";
    if (g.error) rowsHtml = `<div class="feedback bad">${this.esc(g.error)}</div>`;
    else {
      const key2 = (r) => JSON.stringify(r);
      let cls = [], rows = g.rows;
      if (prev && prev.rows && !prev.error && g.columns.join() === prev.columns.join() && g.rows.length < prev.rows.length) {
        const keep = new Set(g.rows.map(key2));
        rows = prev.rows;                                   // a filter: show what was there, with the dropped rows struck through
        cls = prev.rows.map((r) => (keep.has(key2(r)) ? "" : "dropped"));
      } else if (prev && prev.rows) {
        const had = new Set(prev.rows.map(key2));
        cls = g.rows.map((r) => (had.has(key2(r)) ? "" : "fresh"));
      }
      rowsHtml = this.sqlTable(g.columns, rows, { cls });
    }
    return `${head}
      <div class="sqlsteps-label"><strong>${this.l("Langkah", "Step")} ${i + 1} / ${st.stages.length}:</strong> ${this.inline(g.label)}</div>
      <pre class="pad-out sqlsteps-sql">${this.esc(g.sql)}</pre>
      ${rowsHtml}
      ${g.say ? `<div class="trace-note">${this.inline(g.say)}</div>` : ""}
      <div class="row trace-ctl" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-sm" onclick="app.sqlStepsGo(this, ${i - 1})" ${i === 0 ? "disabled" : ""}>← ${this.l("Mundur", "Back")}</button>
        <span class="small">${this.l("Langkah", "Step")} ${i + 1} / ${st.stages.length}</span>
        <button class="btn btn-sm btn-primary" onclick="app.sqlStepsGo(this, ${i + 1})" ${i >= st.stages.length - 1 ? "disabled" : ""}>${this.l("Maju", "Next")} →</button>
      </div>`;
  }
  sqlStepsLoad(el) {
    const box = el.closest(".trace"), key = box.dataset.key, d = this._traceDefs[key];
    this._sqlSteps = this._sqlSteps || {};
    const ctx = this.sqlCtx(d.data);
    if (!ctx) { this._sqlSteps[key] = { failed: "dataset?" }; box.innerHTML = this.sqlStepsInner(key); return; }
    window.SQL_PLAYGROUND.init().then((SQL) => {
      this._sqlSteps[key] = { stages: window.SqlDrill.stages(SQL, ctx.setup, d.stages), at: 0 };
      box.innerHTML = this.sqlStepsInner(key);
    });
  }
  sqlStepsGo(el, n) {
    const box = el.closest(".trace"), st = this._sqlSteps[box.dataset.key];
    if (!st || !st.stages) return;
    st.at = Math.min(Math.max(0, n), st.stages.length - 1);
    box.innerHTML = this.sqlStepsInner(box.dataset.key);
  }

  // "What will this print?": pick an answer; the explanation follows
  renderAsk(d, key, st) {
    const done = st && (st.passed || st.revealed);
    const name = "ask-" + key.replace(/[^\w]/g, "_");
    const why = `<div class="callout success"><strong>${this.l("Mengapa", "Why")}</strong><div>${this.md(d.why)}</div></div>`;
    return `<div class="drill drill-ask ${st && st.passed ? "is-done" : ""}" data-key="${this.esc(key)}">
      <div class="drill-head"><span class="drill-tag">❓ ${this.l("Tebak dulu", "Predict first")}</span> <strong>${this.inline(d.title)}</strong> ${st && st.passed ? `<span class="chip chip-blue">✓ ${this.l("Benar", "Correct")}</span>` : ""}</div>
      <div class="drill-task stack-sm">${this.md(d.task)}</div>
      <div class="ask-options" role="radiogroup" aria-label="${this.l("Pilihan jawaban", "Answers")}">${d.options.map((o, n) => `<label class="ask-option"><input type="radio" name="${name}" value="${n}" ${done && o.correct ? "checked" : ""}> <span>${this.inline(o.text)}</span></label>`).join("")}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-primary" onclick="app.askCheck(this)">${this.l("Periksa jawaban", "Check my answer")}</button></div>
      <div class="drill-out stack-sm" role="status" aria-live="polite">${done ? `<div class="feedback ok">✓ ${this.l("Jawaban yang benar sudah dipilih.", "The right answer is marked.")}</div>${why}` : ""}</div>
    </div>`;
  }
  askCheck(btn) {
    const box = this.drillBox(btn), key = box.dataset.key, d = this._drills[key], out = box.querySelector(".drill-out");
    const pick = box.querySelector("input[type=radio]:checked");
    if (!pick) { out.innerHTML = `<div class="feedback info">${this.l("Pilih satu jawaban dulu.", "Pick an answer first.")}</div>`; return; }
    const why = `<div class="callout success"><strong>${this.l("Mengapa", "Why")}</strong><div>${this.md(d.why)}</div></div>`;
    this._askTries = this._askTries || {};
    if (d.options[Number(pick.value)].correct) {
      const first = !(this.drillsDone[key] && this.drillsDone[key].passed);
      this.drillsDone[key] = { passed: new Date().toISOString() };
      writeStore("df_drills", this.drillsDone);
      out.innerHTML = `<div class="feedback ok">✓ ${this.l("Benar!", "Correct!")}</div>${why}`;
      if (first) this.drillRefreshNav();
      return;
    }
    const tries = (this._askTries[key] = (this._askTries[key] || 0) + 1);
    if (tries >= 2) {   // after two wrong answers, show the explanation and let the learner go on
      out.innerHTML = `<div class="feedback info">${this.l("Belum tepat. Ini penjelasannya; baca, lalu pilih jawaban yang benar.", "Not this one. Here is the explanation: read it, then choose the right answer.")}</div>${why}`;
      if (!this.drillDone(key)) { this.drillsDone[key] = { revealed: new Date().toISOString() }; writeStore("df_drills", this.drillsDone); this.drillRefreshNav(); }
      return;
    }
    out.innerHTML = `<div class="feedback info">${this.l("Belum tepat. Baca kodenya baris demi baris, seperti Python, lalu coba jawaban lain.", "Not this one. Read the code line by line, the way Python does, then try another answer.")}</div>`;
  }
  // The first law of the course: the learner does it on their OWN computer. A drill that passed points there, with the exact steps.
  drillLocalBox(d) {
    const C = (t) => `<code>${this.esc(t)}</code>`;
    const files = d.files && Object.keys(d.files).length ? this.l(` Buat juga file contoh di sebelahnya: ${Object.keys(d.files).map(C).join(", ")} (isinya ada di "Berkas contoh" di atas).`, ` Also create the sample file next to it: ${Object.keys(d.files).map(C).join(", ")} (its content is under "Sample files" above).`) : "";
    const body = d.lang === "sql"
      ? this.l(`Dari folder kursus: ${C("python3 -m sqlite3 kopiku.db < labs/mod-0-3/datasets/kopiku.sql")} (sekali saja), lalu ${C("python3 -m sqlite3 kopiku.db")}. Tempel query Anda di prompt ${C("sqlite>")}, akhiri dengan ${C(";")} dan Enter. Samakah hasilnya dengan tabel di atas? Keluar dengan ${C(".quit")}.`, `From the course folder: ${C("python3 -m sqlite3 kopiku.db < labs/mod-0-3/datasets/kopiku.sql")} (once), then ${C("python3 -m sqlite3 kopiku.db")}. Paste your query at the ${C("sqlite>")} prompt, end it with ${C(";")} and press Enter. Is the result the same as the table above? Leave with ${C(".quit")}.`)
      : this.l(`Buka terminal Anda, ketik ${C("python3")} dan Enter, lalu ketik atau tempel kode Anda di prompt ${C(">>>")} (atau simpan sebagai ${C("~/practice/drill.py")} dan jalankan ${C("python3 ~/practice/drill.py")}; tambahkan ${C("print(...)")} untuk melihat nilainya).${files} Berperilaku samakah dengan di sini?`, `Open your terminal, type ${C("python3")} and press Enter, then type or paste your code at the ${C(">>>")} prompt (or save it as ${C("~/practice/drill.py")} and run ${C("python3 ~/practice/drill.py")}; add ${C("print(...)")} to see a value).${files} Does it behave the same as here?`);
    return `<div class="callout drill-local"><strong>🖥️ ${this.l("Sekarang kerjakan di komputer Anda sendiri", "Now do it on your own computer")}</strong><p>${body}</p><p class="small muted">${this.l("Inilah bagian yang membuat ilmunya menempel. Pratinjau di browser hanya pemanasan.", "This is the part that makes it stick. The browser is only the warm-up.")}</p><button class="btn btn-sm" onclick="app.drillCopy(this)">${this.l("Salin jawaban saya", "Copy my answer")}</button></div>`;
  }
  drillCopy(btn) {
    const ta = this.drillBox(btn).querySelector(".drill-code");
    this.copyText(ta ? ta.value : "", btn);
  }
  drillBox(el) { return el.closest(".drill"); }
  drillSave(ta) {
    const key = this.drillBox(ta).dataset.key;
    this.drillCode[key] = ta.value;
    clearTimeout(this._drillSave);
    this._drillSave = setTimeout(() => writeStore("df_drill_code", this.drillCode), 400);
  }
  drillHint(btn) {
    const box = this.drillBox(btn), d = this._drills[box.dataset.key];
    box.querySelector(".drill-extra").innerHTML = `<div class="callout success"><strong>💡 ${this.l("Petunjuk", "Hint")}</strong><div>${this.md(d.hint)}</div></div>`;
  }
  drillSolution(btn) {
    const box = this.drillBox(btn), key = box.dataset.key, d = this._drills[key];
    box.querySelector(".drill-extra").innerHTML = `<div class="callout"><strong>${this.l("Satu jawaban yang benar", "One correct answer")}</strong><pre class="pad-out" style="margin-top:6px">${this.esc(d.solution)}</pre><p class="small muted">${this.l("Bandingkan dengan kode Anda, lalu ketik ulang sendiri dengan kata-kata Anda: itu yang membuat Anda ingat.", "Compare it with your code, then type it again yourself in your own words: that is what makes it stick.")}</p></div>`;
    if (!this.drillDone(key)) {
      this.drillsDone[key] = { revealed: new Date().toISOString() };
      writeStore("df_drills", this.drillsDone);
      this.drillRefreshNav();
    }
  }
  drillReset(btn) {
    const box = this.drillBox(btn), key = box.dataset.key, d = this._drills[key];
    box.querySelector(".drill-code").value = d.starter;
    this.drillCode[key] = d.starter;
    writeStore("df_drill_code", this.drillCode);
    box.querySelector(".drill-out").innerHTML = "";
  }
  // The step's Next button depends on the drill: re-render, and keep the page where it is.
  drillRefreshNav() {
    const y = window.scrollY;
    this.renderView();
    window.scrollTo(0, y);
  }
  drillRun(el) {
    const box = this.drillBox(el), key = box.dataset.key, d = this._drills[key];
    if (d.lang === "sql") return this.sqlDrillRun(box, key, d);
    const ta = box.querySelector(".drill-code"), out = box.querySelector(".drill-out");
    const say = (html) => { out.innerHTML = html; };
    this.drillCode[key] = ta.value;
    writeStore("df_drill_code", this.drillCode);
    if (this._padBusy || this._blBusy) { say(`<div class="feedback info">${this.l("Python masih sibuk. Tunggu sebentar lalu coba lagi.", "Python is busy. Wait a moment and try again.")}</div>`); return; }
    if (!window.Worker || location.protocol === "file:") { say(`<div class="feedback bad">${this.l("Browser ini tidak bisa menjalankan Python di halaman yang dibuka dari file. Jalankan situs dengan python3 server.py, atau pakai terminal Anda.", "This browser cannot run Python on a page opened from a file. Run the site with python3 server.py, or use your terminal.")}</div>`); return; }
    if (!this._blWorker) {
      try { this._blWorker = new Worker("js/pyodide-worker.js", { type: "module" }); }
      catch (e) { say(`<div class="feedback bad">${this.l("Tidak bisa memulai Python di browser ini. Pakai terminal Anda.", "Could not start Python in this browser. Use your terminal.")}</div>`); return; }
    }
    const w = this._blWorker;
    const id = (this._padId = (this._padId || 0) + 1);
    this._padBusy = true;
    const buttons = box.querySelectorAll("button");
    buttons.forEach((b) => { b.disabled = true; });
    let timer;
    const finish = () => { this._padBusy = false; clearTimeout(timer); w.removeEventListener("message", onMsg); buttons.forEach((b) => { b.disabled = false; }); };
    const stop = (msg) => { if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; } finish(); say(`<div class="feedback bad">${msg}</div>`); };
    const loading = { "loading-python": this.l("Memuat Python (sekitar 12 MB, hanya sekali)…", "Loading Python (about 12 MB, only once)…"), "loading-pytest": this.l("Hampir siap…", "Almost ready…"), running: this.l("Memeriksa…", "Checking…") };
    const onMsg = (ev) => {
      const m = ev.data;
      if (m.type === "status") {
        if (loading[m.text]) say(`<div class="feedback info">${loading[m.text]}</div>`);
        if (m.text === "running") { clearTimeout(timer); timer = setTimeout(() => stop(this.l("Kode berjalan lebih dari 15 detik, jadi dihentikan (mungkin berulang tanpa henti).", "The code ran for more than 15 seconds, so it was stopped (it may loop forever).")), 15000); }
      } else if (m.type === "drillresult" && m.id === id) {
        finish();
        this.drillResult(box, key, d, JSON.parse(m.json));
      } else if (m.type === "error" && m.id === id) {
        stop(this.l("Python gagal dimulai:", "Python failed to start:") + " " + this.esc(m.message));
      }
    };
    w.addEventListener("message", onMsg);
    timer = setTimeout(() => stop(this.l("Memuat Python terlalu lama. Periksa koneksi lalu coba lagi.", "Loading Python took too long. Check your connection and try again.")), 240000);
    say(`<div class="feedback info">${loading["loading-python"]}</div>`);
    w.postMessage({ type: "drill", id, code: ta.value, checks: d.checks.map((c) => [c.expr, c.msg]), files: d.files || {} });
  }
  drillResult(box, key, d, r) {
    const out = box.querySelector(".drill-out");
    const printed = r.output && r.output.trim() ? `<div><div class="small muted">${this.l("Yang dicetak kode Anda:", "What your code printed:")}</div><pre class="pad-out">${this.esc(r.output.trimEnd())}</pre></div>` : "";
    if (r.error) {
      out.innerHTML = `<div class="feedback bad">${this.l("Kode Anda berhenti karena error. Baca baris paling bawah: itu yang salah.", "Your code stopped with an error. Read the last line: it says what went wrong.")}</div><pre class="pad-out pad-err">${this.esc(r.error)}</pre>${printed}`;
      return;
    }
    const failed = r.results.filter((x) => !x.ok);
    if (!failed.length) {
      const first = !(this.drillsDone[key] && this.drillsDone[key].passed);
      this.drillsDone[key] = { passed: new Date().toISOString() };
      writeStore("df_drills", this.drillsDone);
      out.innerHTML = `<div class="feedback ok">✓ ${this.l("Benar! Semua pemeriksaan lulus.", "Correct! Every check passes.")}</div>${printed}${this.drillLocalBox(d)}`;
      if (first) this.drillRefreshNav();
      return;
    }
    const n = r.results.length;
    out.innerHTML = `<div class="feedback info"><strong>${this.l(`${n - failed.length} dari ${n} pemeriksaan lulus.`, `${n - failed.length} of ${n} checks pass.`)}</strong> ${this.inline(failed[0].msg || this.l("Belum tepat.", "Not quite yet."))}</div>${printed}`;
  }

  // ---------- the Python pad: run a snippet in the browser, next to the terminal route ----------
  padRunnable(code) {
    if (/^\s*>>>/m.test(code) || /\binput\s*\(|\bopen\s*\(|sys\.argv|os\.environ|getenv|argparse|__file__|\.\.\.|…|<[a-z_ -]+>/.test(code)) return false;
    const ok = new Set(["csv", "json", "math", "re", "datetime", "collections", "itertools", "functools", "statistics", "random", "string", "textwrap", "decimal", "fractions", "typing", "dataclasses", "enum", "pathlib", "io", "time", "hashlib", "uuid", "copy", "operator", "heapq", "bisect", "abc", "contextlib", "sys", "os", "logging", "__future__"]);
    for (const m of code.matchAll(/^\s*(?:from|import)\s+([A-Za-z_][\w]*)/gm)) if (!ok.has(m[1])) return false;
    return code.trim().length > 0;
  }
  padHtml(session, code, label) {
    return `<div class="pad-box" data-session="${this.esc(session)}">
      <div class="pad-launch"><button class="btn btn-sm btn-quiet" onclick="app.padOpen(this)">${label}</button></div>
      <div class="pad" hidden>
        <p class="small pad-note">${this.l("Ini Python di browser Anda; terminal Anda tetap cara utama. Ubah kodenya sesuka Anda lalu tekan Jalankan (Ctrl+Enter). Variabel tetap ada antar-eksekusi di materi ini.", "This is Python in your browser; your own terminal is still the main way. Change the code as you like and press Run (Ctrl+Enter). Variables stay between runs in this lesson.")}</p>
        <textarea class="pad-code" rows="${Math.min(14, Math.max(4, code.split("\n").length + 1))}" spellcheck="false" aria-label="${this.l("Kode Python", "Python code")}" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();app.padRun(this)}">${this.esc(code)}</textarea>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" onclick="app.padRun(this)">${this.l("Jalankan", "Run")}</button><button class="btn btn-sm btn-quiet" onclick="app.padReset(this)" title="${this.l("Hapus semua variabel di materi ini", "Forget every variable in this lesson")}">${this.l("Mulai ulang sesi", "Reset session")}</button></div>
        <pre class="pad-out" aria-live="polite" hidden></pre>
      </div></div>`;
  }
  padOpen(btn) {
    const pad = btn.closest(".pad-box").querySelector(".pad");
    pad.hidden = !pad.hidden;
    if (!pad.hidden) pad.querySelector("textarea").focus();
  }
  padShow(box, text, kind) {
    const out = box.querySelector(".pad-out");
    out.hidden = false;
    out.className = "pad-out" + (kind ? " " + kind : "");
    out.textContent = text;
  }
  padRun(el) {
    const box = el.closest(".pad-box");
    this.padExec(box.dataset.session, box.querySelector("textarea").value, false, box);
  }
  padReset(el) {
    const box = el.closest(".pad-box");
    this.padExec(box.dataset.session, "", true, box, this.l("Sesi dimulai ulang: semua variabel dihapus.", "Session reset: every variable is forgotten."));
  }
  padExec(session, code, reset, box, doneText) {
    if (this._padBusy || this._blBusy) { this.padShow(box, this.l("Python masih sibuk. Tunggu sebentar lalu coba lagi.", "Python is busy. Wait a moment and try again."), "pad-info"); return; }
    if (!window.Worker || location.protocol === "file:") { this.padShow(box, this.l("Browser ini tidak bisa menjalankan Python di halaman yang dibuka dari file. Jalankan situs dengan python3 server.py, atau pakai terminal Anda.", "This browser cannot run Python on a page opened from a file. Run the site with python3 server.py, or use your terminal."), "pad-err"); return; }
    if (!this._blWorker) {
      try { this._blWorker = new Worker("js/pyodide-worker.js", { type: "module" }); }
      catch (e) { this.padShow(box, this.l("Tidak bisa memulai Python di browser ini. Pakai terminal Anda.", "Could not start Python in this browser. Use your terminal."), "pad-err"); return; }
    }
    const w = this._blWorker;
    const id = (this._padId = (this._padId || 0) + 1);
    this._padBusy = true;
    const buttons = box.querySelectorAll("button");
    buttons.forEach((b) => { b.disabled = true; });
    let timer;
    const finish = () => { this._padBusy = false; clearTimeout(timer); w.removeEventListener("message", onMsg); buttons.forEach((b) => { b.disabled = false; }); };
    const stop = (msg) => { if (this._blWorker) { this._blWorker.terminate(); this._blWorker = null; } finish(); this.padShow(box, msg, "pad-err"); };
    const onMsg = (ev) => {
      const m = ev.data;
      if (m.type === "status") {
        const txt = { "loading-python": this.l("Memuat Python (sekitar 12 MB, hanya sekali)…", "Loading Python (about 12 MB, only once)…"), "loading-pytest": this.l("Hampir siap…", "Almost ready…"), running: "" }[m.text];
        if (txt) this.padShow(box, txt, "pad-info");
        if (m.text === "running") { clearTimeout(timer); timer = setTimeout(() => stop(this.l("Kode berjalan lebih dari 15 detik, jadi dihentikan (mungkin berulang tanpa henti). Sesi dimulai ulang.", "The code ran for more than 15 seconds, so it was stopped (it may loop forever). The session was reset.")), 15000); }
      } else if (m.type === "padresult" && m.id === id) {
        finish();
        const text = String(m.output).replace(/\s+$/, "");
        this.padShow(box, text || doneText || (m.ok ? this.l("(selesai, tidak ada yang dicetak)", "(done, nothing was printed)") : ""), m.ok ? "" : "pad-err");
      } else if (m.type === "error" && m.id === id) {
        stop(this.l("Python gagal dimulai:", "Python failed to start:") + " " + m.message);
      }
    };
    w.addEventListener("message", onMsg);
    timer = setTimeout(() => stop(this.l("Memuat Python terlalu lama. Periksa koneksi lalu coba lagi.", "Loading Python took too long. Check your connection and try again.")), 240000);
    this.padShow(box, this.l("Memuat Python…", "Loading Python…"), "pad-info");
    w.postMessage({ type: "exec", id, session, code, reset: Boolean(reset) });
  }

  // The pieces of output a Try it promises ("You should see: `True`, `240000`..."), so what the learner pastes from their
  // own terminal can be checked. Only pieces that look like program output: a quoted text, a number, a list, True/False/None, an error name.
  tryitExpected(revealLines) {
    const text = revealLines.join(" ").replace(/^\s*>?\s*\*\*[^*]+\*\*:?/, "");
    const out = [];
    for (const m of text.matchAll(/`([^`\n]{1,80})`/g)) {
      const t = m[1].trim();
      if (/^(['"\[{(\-]|\d|True\b|False\b|None\b)/.test(t) || /(Error|Exception)\b/.test(t)) {
        if (!/^\w+\(/.test(t) && !out.includes(t)) out.push(t);
      }
    }
    return out.slice(0, 8);
  }
  tryitPasteBox(key) {
    const saved = this.tryitPaste[key] || "";
    return `<div class="tryit-paste">
      <label for="tryit-paste-${key}"><strong>${this.l("Sudah dijalankan di terminal Anda? Tempel hasilnya di sini:", "Ran it in your own terminal? Paste what it printed here:")}</strong></label>
      <textarea id="tryit-paste-${key}" rows="4" spellcheck="false" placeholder="${this.l("Salin hasil dari terminal lalu tempel di sini", "Copy the output from your terminal and paste it here")}">${this.esc(saved)}</textarea>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-sm btn-primary" onclick="app.checkTryItPaste('${key}')">${this.l("Periksa hasil saya", "Check my output")}</button><span id="tryit-paste-msg-${key}" class="small" role="status">${saved ? this.tryitPasteResult(key, saved) : ""}</span></div>
    </div>`;
  }
  tryitPasteResult(key, text) {
    const expected = this._tryitExpect[key] || [];
    const norm = (t) => String(t).replace(/[‘’“”]/g, "'").replace(/"/g, "'").replace(/\s+/g, " ").trim();
    const hay = norm(text);
    if (!hay) return "";
    const found = expected.filter((e) => hay.includes(norm(e)));
    const missing = expected.filter((e) => !hay.includes(norm(e)));
    const code = (e) => `<code>${this.esc(e)}</code>`;
    if (!missing.length) return `<span class="ok-text">✓ ${this.l("Cocok! Hasil Anda memuat semua yang diharapkan:", "It matches! Your output has everything expected:")} ${found.map(code).join(" ")}</span>`;
    if (found.length) return `${this.l("Sebagian cocok.", "Partly there.")} ✓ ${found.map(code).join(" ")} · ✗ ${this.l("belum terlihat:", "not seen yet:")} ${missing.map(code).join(" ")}. ${this.l("Beberapa latihan punya dua versi hasil; jika Anda hanya menjalankan satu, tidak apa-apa. Jika tidak, periksa baris yang Anda ketik.", "Some exercises show two versions of the output; if you ran only one, that is fine. If not, check the line you typed.")}`;
    return `${this.l("Belum ada yang cocok.", "Nothing matches yet.")} ${this.l("Periksa baris yang Anda ketik (huruf besar/kecil, tanda kutip), lalu jalankan lagi dan tempel hasilnya. Buka 'Hasil yang Diharapkan' jika perlu.", "Check the line you typed (capital letters, quotes), run it again and paste the new output. Open 'Reveal Expected Output' if you need it.")}`;
  }
  checkTryItPaste(key) {
    const box = document.getElementById(`tryit-paste-${key}`), msg = document.getElementById(`tryit-paste-msg-${key}`);
    if (!box || !msg) return;
    this.tryitPaste[key] = box.value;
    writeStore("df_tryit_paste", this.tryitPaste);
    const expected = this._tryitExpect[key] || [];
    const norm = (t) => String(t).replace(/[‘’“”]/g, "'").replace(/"/g, "'").replace(/\s+/g, " ").trim();
    const matched = expected.filter((e) => norm(box.value).includes(norm(e))).length;
    msg.innerHTML = box.value.trim() ? this.tryitPasteResult(key, box.value) : this.l("Tempel dulu hasil dari terminal Anda.", "Paste the output from your terminal first.");
    if (matched === expected.length && matched > 0 && !this.tryitDone[key]) {   // everything expected is there: count the Try it as done
      this.tryitDone[key] = new Date().toISOString();
      writeStore("df_tryit_done", this.tryitDone);
      const head = msg.closest(".callout-tryit");
      if (head) head.classList.add("is-done");
      const btn = head && head.querySelector(".callout-head .btn");
      if (btn) { btn.className = "btn btn-sm btn-done"; btn.textContent = "✓ " + this.l("Sudah Dicoba", "Tried & Checked"); }
    }
  }
  toggleTryIt(key) {
    if (!key) return;
    if (this.tryitDone[key]) delete this.tryitDone[key];
    else this.tryitDone[key] = new Date().toISOString();
    writeStore("df_tryit_done", this.tryitDone);
    this.renderView();
  }
  submitTryItProof(tryitKey, expectedIdent) {
    const input = document.getElementById(`tryit-input-${tryitKey}`);
    const msg = document.getElementById(`tryit-msg-${tryitKey}`);
    if (!input || !msg) return;
    const res = ProofCheck.verifyTryIt(expectedIdent, input.value);
    if (!res.ok) {
      const errMap = {
        format: this.l(`Format kode salah. Jalankan python3 labs/tryit/check.py ${expectedIdent} di terminal komputer Anda lalu salin kode TRY1:${expectedIdent}:…`, `Invalid format. Run python3 labs/tryit/check.py ${expectedIdent} in your terminal and copy the TRY1:${expectedIdent}:… code.`),
        checksum: this.l("Kode rusak atau salah ketik. Salin ulang dari terminal Anda.", "Checksum mismatch (typo or cut off). Copy the whole code again."),
        ident: this.l(`Kode ini untuk latihan lain (${res.ident}), bukan ${expectedIdent}.`, `This code is for exercise ${res.ident}, not ${expectedIdent}.`)
      };
      msg.innerHTML = `<div class="feedback bad">${this.esc(errMap[res.reason] || errMap.format)}</div>`;
      return;
    }
    this.tryitDone[tryitKey] = {
      token: input.value.trim().replace(/\s+/g, ""),
      passed: res.info.passed,
      py: res.info.py,
      os: res.info.os,
      at: new Date().toISOString()
    };
    writeStore("df_tryit_done", this.tryitDone);
    this.renderView();
  }
  saveModuleNote(modId, val) {
    clearTimeout(this._noteTimer);
    this._noteTimer = setTimeout(() => {
      if (val && val.trim()) this.moduleNotes[modId] = val;
      else delete this.moduleNotes[modId];
      writeStore("df_module_notes", this.moduleNotes);
    }, 300);
  }
  saveChaosNote(modId, val) {
    const cur = this.chaosDone[modId] || {};
    this.chaosDone[modId] = { ...cur, notes: val };
    writeStore("df_chaos_done", this.chaosDone);
  }
  unlockChaosAnalysis(modId) {
    const ta = document.getElementById(`chaos-note-${modId}`);
    if (ta) this.saveChaosNote(modId, ta.value);
    const notes = ((this.chaosDone[modId] || {}).notes || "").trim();
    if (notes.length < 50) {
      alert(this.l("Tulis hipotesis diagnosis & mitigasi Anda minimal 50 karakter terlebih dahulu sebelum membuka kunci jawaban!", "Write your diagnostic and mitigation hypothesis (at least 50 characters) first before unlocking the root cause!"));
      return;
    }
    this.renderView();
  }
  toggleChaosDone(modId) {
    const cur = this.chaosDone[modId] || {};
    if (!cur.done && ((cur.notes || "").trim().length < 50)) {
      alert(this.l("Tulis hipotesis triage Anda minimal 50 karakter di Langkah 1 terlebih dahulu!", "Write your triage hypothesis (at least 50 characters) in Step 1 first!"));
      return;
    }
    this.chaosDone[modId] = { ...cur, done: !cur.done, at: new Date().toISOString() };
    writeStore("df_chaos_done", this.chaosDone);
    this.renderView();
  }
  saveInterviewDraft(key, val, rerender) {
    this.interviewDrafts[key] = val;
    writeStore("df_interview_drafts", this.interviewDrafts);
    if (rerender) this.renderView();
  }
  lessonBody(ls) {
    let text = String(this.t(ls.body) || "");
    if (this.lang === "id" && ls.body && typeof ls.body === "object" && ls.body.en) {
      const enLines = String(ls.body.en).replace(/\r\n/g, "\n").split("\n");
      const hasTldrId = /^>\s*\*\*(?:In short|Intinya|Ringkasan|TL;DR):?\*\*/im.test(text);
      const hasTryItId = /^>\s*(?:🛠|\*\*(?:Try it|Coba sendiri))/im.test(text);
      const prependBlocks = [];
      const appendBlocks = [];
      let i = 0;
      while (i < enLines.length) {
        if (/^> ?/.test(enLines[i])) {
          const blk = [];
          while (i < enLines.length && /^> ?/.test(enLines[i])) blk.push(enLines[i++]);
          const first = blk[0].replace(/^> ?/, "").trim();
          if (!hasTldrId && /^\*\*(In short|Intinya|Ringkasan|TL;DR):?\*\*/i.test(first)) {
            prependBlocks.push(blk.join("\n"));
          } else if (!hasTryItId && /^(🛠|\*\*(Try it|Coba sendiri))/i.test(first)) {
            appendBlocks.push(blk.join("\n"));
          }
        } else {
          i++;
        }
      }
      if (prependBlocks.length) text = prependBlocks.join("\n\n") + "\n\n" + text;
      if (appendBlocks.length) text = text + "\n\n" + appendBlocks.join("\n\n");
    }
    return text;
  }
  lessonMinutes(ls) {
    const w = (this.lessonBody(ls).match(/\S+/g) || []).length;
    return Math.max(1, Math.round(w / 190));
  }
  moduleTryItStats(mod) {
    let total = 0;
    let done = 0;
    (mod.lessons || []).forEach((ls, li) => {
      const lines = this.lessonBody(ls).replace(/\r\n/g, "\n").split("\n");
      let i = 0, tryitIdx = 0;
      while (i < lines.length) {
        if (/^> ?/.test(lines[i])) {
          const first = lines[i].replace(/^> ?/, "").trim();
          while (i < lines.length && /^> ?/.test(lines[i])) i++;
          if (/^(🛠|\*\*(Try it|Coba sendiri))/i.test(first)) {
            total++;
            if (this.tryitDone[`${mod.id}:${li}:${tryitIdx}`]) done++;
            tryitIdx++;
          }
        } else {
          i++;
        }
      }
    });
    return { total, done };
  }
  findBestLessonForQuestion(mod, q) {
    if (!mod.lessons || !mod.lessons.length) return 0;
    const text = `${this.t(q.question)} ${this.t(q.explanation)} ${this.t(q.options[q.correct])}`.toLowerCase();
    const tokens = text.split(/[^a-z0-9_]+/).filter((w) => w.length >= 4);
    let bestIdx = 0, bestScore = -1;
    mod.lessons.forEach((ls, idx) => {
      const hayTitle = String(this.t(ls.title)).toLowerCase();
      const hayBody = String(this.t(ls.body)).toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hayTitle.includes(tok)) score += 5;
        if (hayBody.includes(tok)) score += 1;
      }
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    });
    return bestIdx;
  }

  // ---------- Interactive Mental-Model Simulators & Step-by-Step Lesson Animations ----------
  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    writeStore("df_focus_mode", this.focusMode);
    this.renderView();
  }

  stopAllAnims() {
    if (!this._animTimers) return;
    for (const k of Object.keys(this._animTimers)) {
      clearInterval(this._animTimers[k]);
      delete this._animTimers[k];
      if (this.animState && this.animState[k]) this.animState[k].playing = false;
    }
  }

  getAnimsForLesson(modId, lessonIdx) {
    const list = (window.LESSON_ANIMATIONS && Array.isArray(window.LESSON_ANIMATIONS)) ? window.LESSON_ANIMATIONS : [];
    return list.filter((a) => (a.placements || []).some((p) => p.modId === modId && p.lessonIdx === lessonIdx));
  }

  ensureAnimState(anim) {
    if (!this.animState[anim.id]) {
      this.animState[anim.id] = {
        step: 0,
        mode: (anim.modes && anim.modes[0] && anim.modes[0].id) || "default",
        playing: false
      };
    }
    return this.animState[anim.id];
  }

  renderLessonAnimationInner(anim) {
    const st = this.ensureAnimState(anim);
    const total = anim.frames.length;
    const frame = anim.frames[st.step] || anim.frames[0];
    const svgHtml = anim.renderSvg(st.step, st.mode, (idTxt, enTxt) => this.l(idTxt, enTxt));
    return `
      <div class="anim-head">
        <div class="anim-title">🎬 ${this.esc(this.t(anim.title))}</div>
        <div class="segmented">
          ${(anim.modes || []).map((m) => `
            <button class="${st.mode === m.id ? "active" : ""}" onclick="app.setAnimMode('${anim.id}','${m.id}')">${this.esc(this.t(m.label))}</button>`).join("")}
        </div>
      </div>
      ${svgHtml}
      <div class="anim-narrative" aria-live="polite">
        <strong>${this.esc(this.t(frame.title))} (${st.step + 1}/${total})</strong>
        <span>${this.esc(this.t(frame.desc))}</span>
      </div>
      <div class="anim-controls">
        <div class="row" style="gap:6px">
          <button class="btn btn-sm ${st.playing ? "btn-done" : "btn-primary"}" onclick="app.togglePlayAnim('${anim.id}')">
            ${st.playing ? "⏸ " + this.l("Jeda", "Pause") : "▶ " + this.l("Putar Otomatis", "Play Steps")}
          </button>
          <button class="btn btn-sm btn-quiet" onclick="app.stepAnim('${anim.id}', -1)" title="${this.l("Langkah sebelumnya", "Previous step")}">⏮ ${this.l("Mundur", "Prev")}</button>
          <button class="btn btn-sm btn-quiet" onclick="app.stepAnim('${anim.id}', 1)" title="${this.l("Langkah berikutnya", "Next step")}">${this.l("Maju", "Next")} ⏭</button>
        </div>
        <div class="anim-step-dots" role="tablist" aria-label="${this.l("Pilih langkah animasi", "Select animation step")}">
          ${anim.frames.map((f, idx) => `
            <button role="tab" aria-selected="${st.step === idx}" class="anim-step-dot ${st.step === idx ? "active" : ""}" onclick="app.jumpAnimStep('${anim.id}', ${idx})" title="${this.esc(this.t(f.title))}">${idx + 1}</button>`).join("")}
        </div>
      </div>`;
  }

  renderLessonAnimation(anim) {
    return `<div class="lesson-anim-card" id="anim-box-${anim.id}">${this.renderLessonAnimationInner(anim)}</div>`;
  }

  updateAnimDom(animId) {
    const list = (window.LESSON_ANIMATIONS && Array.isArray(window.LESSON_ANIMATIONS)) ? window.LESSON_ANIMATIONS : [];
    const anim = list.find((a) => a.id === animId);
    if (!anim) return;
    const box = document.getElementById(`anim-box-${animId}`);
    if (box) {
      box.innerHTML = this.renderLessonAnimationInner(anim);
      this.choreographLessonAnim(box);
    } else {
      this.renderView();
    }
  }

  // window.anime and window.Motion come from vendor/motion-anime.js, a small in-house helper with
  // anime.js-style and Motion-style APIs (not the libraries themselves)
  choreographLessonAnim(box) {
    if (!box) return;
    if (window.anime && typeof window.anime.timeline === "function") {
      const tl = window.anime.timeline({ easing: "easeOutExpo" });
      tl.add({
        targets: "svg rect",
        scope: box,
        opacity: [0.35, 1],
        scale: [0.97, 1],
        delay: window.anime.stagger(28),
        duration: 340
      }).add({
        targets: "svg line, svg path",
        scope: box,
        strokeDashoffset: [window.anime.setDashoffset, 0],
        opacity: [0.4, 1],
        delay: window.anime.stagger(35),
        duration: 420
      }, "-=220").add({
        targets: "svg .anim-pulse, svg circle",
        scope: box,
        scale: [0.85, 1],
        opacity: [0.3, 1],
        duration: 360,
        easing: "spring(1, 80, 12, 0)"
      }, "-=260");
    }
    if (window.Motion && typeof window.Motion.animate === "function") {
      window.Motion.animate(".anim-narrative", { opacity: [0.45, 1], y: [4, 0] }, { scope: box, type: "spring", stiffness: 300, damping: 26 });
      window.Motion.animate(".anim-step-dot.active", { scale: [0.86, 1] }, { scope: box, type: "spring", stiffness: 360, damping: 18 });
    }
  }

  choreographViewMount(container) {
    if (!container) return;
    // 1. Motion.dev (https://motion.dev/) — Spring & staggered entrance across all views, cards, nodes & quiz options
    if (window.Motion && typeof window.Motion.animate === "function") {
      window.Motion.animate(
        ".stack > .card, .duo-section-card, .lesson-card, .uxcel-quiz-shell, .recall-card, .sim-card, .lesson-anim-card",
        { opacity: [0.55, 1], y: [8, 0] },
        { scope: container, duration: 0.26, delay: window.Motion.stagger(0.028) }
      );
      window.Motion.animate(
        ".grid > .item, .duo-node-btn, .career-path-card, .pipeline-step, .uxcel-option-btn, .stat-strip > div",
        { opacity: [0.6, 1], y: [5, 0] },
        { scope: container, duration: 0.22, delay: window.Motion.stagger(0.018) }
      );
    }
    // 2. Anime.js (https://animejs.com/) — SVG diagrams, progress rings and market bars
    if (window.anime && typeof window.anime.timeline === "function") {
      if (container.querySelectorAll) {
        const allDiagrams = container.querySelectorAll(".lesson-anim-card, .diagram");
        if (allDiagrams && allDiagrams.forEach) {
          allDiagrams.forEach((box) => this.choreographLessonAnim(box));
        }
      }
      window.anime({
        targets: ".ring-fg",
        scope: container,
        opacity: [0.35, 1],
        duration: 520,
        easing: "easeOutExpo"
      });
      window.anime({
        targets: ".market-bar > div, .progress > div, .uxcel-progress-fill",
        scope: container,
        opacity: [0.4, 1],
        delay: window.anime.stagger(22),
        duration: 460,
        easing: "easeOutExpo"
      });
    }
  }

  stepAnim(animId, delta) {
    const list = (window.LESSON_ANIMATIONS && Array.isArray(window.LESSON_ANIMATIONS)) ? window.LESSON_ANIMATIONS : [];
    const anim = list.find((a) => a.id === animId);
    if (!anim) return;
    const st = this.ensureAnimState(anim);
    st.step = (st.step + delta + anim.frames.length) % anim.frames.length;
    this.updateAnimDom(animId);
  }

  jumpAnimStep(animId, idx) {
    const list = (window.LESSON_ANIMATIONS && Array.isArray(window.LESSON_ANIMATIONS)) ? window.LESSON_ANIMATIONS : [];
    const anim = list.find((a) => a.id === animId);
    if (!anim) return;
    const st = this.ensureAnimState(anim);
    st.step = Math.max(0, Math.min(anim.frames.length - 1, idx));
    this.updateAnimDom(animId);
  }

  setAnimMode(animId, modeId) {
    const list = (window.LESSON_ANIMATIONS && Array.isArray(window.LESSON_ANIMATIONS)) ? window.LESSON_ANIMATIONS : [];
    const anim = list.find((a) => a.id === animId);
    if (!anim) return;
    const st = this.ensureAnimState(anim);
    st.mode = modeId;
    this.updateAnimDom(animId);
  }

  togglePlayAnim(animId) {
    const list = (window.LESSON_ANIMATIONS && Array.isArray(window.LESSON_ANIMATIONS)) ? window.LESSON_ANIMATIONS : [];
    const anim = list.find((a) => a.id === animId);
    if (!anim) return;
    const st = this.ensureAnimState(anim);
    if (st.playing) {
      st.playing = false;
      clearInterval(this._animTimers[animId]);
      delete this._animTimers[animId];
      this.updateAnimDom(animId);
      return;
    }
    st.playing = true;
    this.updateAnimDom(animId);
    this._animTimers[animId] = setInterval(() => {
      const box = document.getElementById(`anim-box-${animId}`);
      if (!box) {
        clearInterval(this._animTimers[animId]);
        delete this._animTimers[animId];
        st.playing = false;
        return;
      }
      st.step = (st.step + 1) % anim.frames.length;
      this.updateAnimDom(animId);
    }, 2400);
  }

  updateSim(key, val) {
    this.simState[key] = val;
    this.renderView();
  }

  renderModuleSimulator(modId) {
    if (!window.PRACTICE_LABS || !window.PRACTICE_LABS.SIMULATORS) return "";
    const sim = window.PRACTICE_LABS.SIMULATORS.find((s) => s.modules.includes(modId));
    if (!sim) return "";
    const st = this.simState;

    if (sim.id === "sim-join-fanout") {
      const dupes = Number(st.fanoutDupes || 3);
      const strat = st.fanoutStrategy || "naive";
      const trueRevenue = 300;
      const reportedRevenue = strat === "naive" ? trueRevenue * dupes : trueRevenue;
      const rowCount = strat === "naive" ? 3 * dupes : 3;
      const isCorrupted = reportedRevenue !== trueRevenue;
      return `
        <div class="sim-card stack-sm">
          <div class="row between">
            <div>
              <span class="chip chip-blue">⚡ ${this.l("Simulator Model Mental Interaktif", "Interactive Mental-Model Simulator")}</span>
              <h3 style="margin-top:4px">${sim.icon} ${this.esc(this.t(sim.title))}</h3>
              <p class="small muted">${this.esc(this.t(sim.subtitle))}</p>
            </div>
          </div>
          <div class="sim-controls">
            <div class="sim-control">
              <label><span>${this.l("Baris Duplikat per Customer di Tabel Dimensi", "Duplicate Rows per Customer in Dimension")}</span><strong>${dupes}x</strong></label>
              <input type="range" min="1" max="6" value="${dupes}" oninput="app.updateSim('fanoutDupes', Number(this.value))" />
              <span class="small muted">${this.l("Mis. pelanggan pindah alamat / SCD2 tanpa filter aktif", "E.g., customer address history / unfiltered SCD2")}</span>
            </div>
            <div class="sim-control">
              <label><span>${this.l("Strategi SQL JOIN", "SQL JOIN Strategy")}</span></label>
              <div class="segmented" style="margin-top:4px">
                <button class="${strat === "naive" ? "active" : ""}" onclick="app.updateSim('fanoutStrategy','naive')">Naive JOIN</button>
                <button class="${strat === "cte" ? "active" : ""}" onclick="app.updateSim('fanoutStrategy','cte')">Pre-Aggregate CTE</button>
                <button class="${strat === "rownum" ? "active" : ""}" onclick="app.updateSim('fanoutStrategy','rownum')">ROW_NUMBER() = 1</button>
              </div>
            </div>
          </div>
          <div class="sim-metrics">
            <div class="sim-metric">
              <div class="small muted">${this.l("Pendapatan Asli (Fakta)", "True Fact Revenue")}</div>
              <div class="val">$${trueRevenue}</div>
              <div class="small muted">3 orders ($100 + $150 + $50)</div>
            </div>
            <div class="sim-metric ${isCorrupted ? "danger" : "ok"}">
              <div class="small muted">${this.l("Hasil SUM(amount) Query Anda", "Your Query SUM(amount)")}</div>
              <div class="val">$${reportedRevenue} ${isCorrupted ? `(+${Math.round(((reportedRevenue - trueRevenue) / trueRevenue) * 100)}%)` : "✓"}</div>
              <div class="small muted">${rowCount} ${this.l("baris hasil JOIN · 0 pesan error SQL", "joined rows · 0 SQL errors")}</div>
            </div>
            <div class="sim-metric ${isCorrupted ? "danger" : "ok"}">
              <div class="small muted">${this.l("Status Integritas Data", "Data Integrity Verdict")}</div>
              <div class="val">${isCorrupted ? "🚨 Silent Corruption" : "✅ Grain Preserved"}</div>
              <div class="small muted">${isCorrupted ? this.l("Setiap order digandakan oleh baris dimensi!", "Every order multiplied by dimension rows!") : this.l("1 baris per customer_id sebelum JOIN", "1 row per customer_id before JOIN")}</div>
            </div>
          </div>
        </div>`;
    }

    if (sim.id === "sim-partition-pruning") {
      const tb = Number(st.partTb || 10);
      const qDays = Number(st.partQueryDays || 7);
      const wrapped = Boolean(st.partWrapped);
      const totalDays = 365;
      const scannedTb = wrapped ? tb : Number(((tb * qDays) / totalDays).toFixed(2));
      const costPerRun = Number((scannedTb * 5).toFixed(2)); // $5 per TB
      const monthlyCost = Math.round(costPerRun * 24 * 30); // hourly dashboard query
      return `
        <div class="sim-card stack-sm">
          <div class="row between">
            <div>
              <span class="chip chip-blue">⚡ ${this.l("Simulator Model Mental Interaktif", "Interactive Mental-Model Simulator")}</span>
              <h3 style="margin-top:4px">${sim.icon} ${this.esc(this.t(sim.title))}</h3>
              <p class="small muted">${this.esc(this.t(sim.subtitle))}</p>
            </div>
          </div>
          <div class="sim-controls">
            <div class="sim-control">
              <label><span>${this.l("Ukuran Tabel (365 Partisi Harian)", "Table Size (365 Daily Partitions)")}</span><strong>${tb} TB</strong></label>
              <input type="range" min="2" max="50" step="2" value="${tb}" oninput="app.updateSim('partTb', Number(this.value))" />
            </div>
            <div class="sim-control">
              <label><span>${this.l("Rentang Hari yang Dicari", "Queried Window (Days)")}</span><strong>${qDays} ${this.l("hari", "days")}</strong></label>
              <input type="range" min="1" max="30" value="${qDays}" oninput="app.updateSim('partQueryDays', Number(this.value))" />
            </div>
            <div class="sim-control">
              <label><span>${this.l("Bentuk Klausa WHERE", "WHERE Clause Predicate")}</span></label>
              <div class="segmented" style="margin-top:4px">
                <button class="${wrapped ? "active" : ""}" onclick="app.updateSim('partWrapped', true)">WHERE DATE(ts) >= ...</button>
                <button class="${!wrapped ? "active" : ""}" onclick="app.updateSim('partWrapped', false)">WHERE ts >= TIMESTAMP ...</button>
              </div>
            </div>
          </div>
          <div class="sim-metrics">
            <div class="sim-metric ${wrapped ? "danger" : "ok"}">
              <div class="small muted">${this.l("Partisi Parquet Dipindai", "Partitions Scanned")}</div>
              <div class="val">${wrapped ? `365 / 365 (Full Scan)` : `${qDays} / 365 (Pruned ✓)`}</div>
              <div class="small muted">${scannedTb} TB ${this.l("dibaca dari penyimpanan objek", "read from object storage")}</div>
            </div>
            <div class="sim-metric ${wrapped ? "danger" : "ok"}">
              <div class="small muted">${this.l("Biaya per Eksekusi ($5/TB)", "Cost per Query ($5/TB)")}</div>
              <div class="val">$${costPerRun}</div>
              <div class="small muted">${this.l("BigQuery / Athena on-demand", "BigQuery / Athena on-demand")}</div>
            </div>
            <div class="sim-metric ${wrapped ? "danger" : "ok"}">
              <div class="small muted">${this.l("Tagihan Bulanan (Dashboard Tiap Jam)", "Monthly Bill (Hourly Dashboard)")}</div>
              <div class="val">$${monthlyCost.toLocaleString()}/mo</div>
              <div class="small muted">${wrapped ? this.l("Fungsi pada kolom partisi mematikan pruning!", "Function on partition column kills pruning!") : this.l("Sargable predicate: hemat >95% biaya!", "Sargable predicate: >95% cost saved!")}</div>
            </div>
          </div>
        </div>`;
    }

    if (sim.id === "sim-watermark") {
      const tol = Number(st.wmToleranceMin || 15);
      const latePct = Number(st.wmLatePct || 12);
      const droppedPct = Math.max(0, Number((latePct * Math.exp(-tol / 20)).toFixed(1)));
      const stateGb = Number((1.5 + tol * 0.45).toFixed(1));
      const isOom = stateGb > 32;
      const isDropping = droppedPct > 2.0;
      return `
        <div class="sim-card stack-sm">
          <div class="row between">
            <div>
              <span class="chip chip-blue">⚡ ${this.l("Simulator Model Mental Interaktif", "Interactive Mental-Model Simulator")}</span>
              <h3 style="margin-top:4px">${sim.icon} ${this.esc(this.t(sim.title))}</h3>
              <p class="small muted">${this.esc(this.t(sim.subtitle))}</p>
            </div>
          </div>
          <div class="sim-controls">
            <div class="sim-control">
              <label><span>${this.l("Toleransi Watermark", "Watermark Delay Tolerance")}</span><strong>${tol} ${this.l("menit", "min")}</strong></label>
              <input type="range" min="0" max="120" step="5" value="${tol}" oninput="app.updateSim('wmToleranceMin', Number(this.value))" />
            </div>
            <div class="sim-control">
              <label><span>${this.l("Lonjakan Event Terlambat (Mobile Offline)", "Late-Arriving Events (% of stream)")}</span><strong>${latePct}%</strong></label>
              <input type="range" min="1" max="30" value="${latePct}" oninput="app.updateSim('wmLatePct', Number(this.value))" />
            </div>
          </div>
          <div class="sim-metrics">
            <div class="sim-metric ${isDropping ? "danger" : "ok"}">
              <div class="small muted">${this.l("Event Terlambat Dibuang Diam-Diam", "Silently Dropped Late Events")}</div>
              <div class="val">${droppedPct}%</div>
              <div class="small muted">${isDropping ? this.l("Event datang setelah watermark lewat!", "Arrived after watermark passed!") : this.l("Mayoritas event terlambat tertampung", "Most late events captured")}</div>
            </div>
            <div class="sim-metric ${isOom ? "danger" : "ok"}">
              <div class="small muted">${this.l("Memori State RocksDB (RAM/Disk)", "RocksDB Window State Size")}</div>
              <div class="val">${stateGb} GB ${isOom ? "💥 OOM!" : "✓"}</div>
              <div class="small muted">${this.l("Batas node worker: 32 GB", "Worker node limit: 32 GB")}</div>
            </div>
            <div class="sim-metric">
              <div class="small muted">${this.l("Latensi Emisi Window", "Window Emission Latency")}</div>
              <div class="val">+${tol} ${this.l("mnt", "min")}</div>
              <div class="small muted">${this.l("Trade-off: Kelengkapan vs. Latensi vs. RAM", "Trade-off: Completeness vs. Latency vs. RAM")}</div>
            </div>
          </div>
        </div>`;
    }

    if (sim.id === "sim-data-maturity") {
      const stage = Number(st.matStage || 1);
      const arch = st.matArch || "typeA";
      const engs = Number(st.matEngs || 2);
      const isOverEngineered = stage === 1 && arch === "typeB";
      const isUnderEngineered = stage === 3 && arch === "typeA" && engs >= 6;
      const monthlyTco = arch === "typeA" ? (stage === 1 ? 250 : stage === 2 ? 1200 : 4500) : (stage === 1 ? 14500 : stage === 2 ? 18000 : 24000);
      const timeToValueWeeks = arch === "typeA" ? (stage === 1 ? 2 : 4) : Math.max(4, Math.round(28 / Math.max(1, engs)));
      const maintenancePct = arch === "typeA" ? 15 : Math.min(95, Math.round(130 / Math.max(1, engs)));
      const verdictBad = isOverEngineered || isUnderEngineered || maintenancePct >= 75;
      return `
        <div class="sim-card stack-sm">
          <div class="row between">
            <div>
              <span class="chip chip-blue">⚡ ${this.l("Simulator Model Mental Interaktif", "Interactive Mental-Model Simulator")}</span>
              <h3 style="margin-top:4px">${sim.icon} ${this.esc(this.t(sim.title))}</h3>
              <p class="small muted">${this.esc(this.t(sim.subtitle))}</p>
            </div>
          </div>
          <div class="sim-controls">
            <div class="sim-control">
              <label><span>${this.l("Tahap Kematangan Data Perusahaan (Reis & Housley)", "Company Data Maturity Stage (Reis & Housley)")}</span></label>
              <div class="segmented" style="margin-top:4px">
                <button class="${stage === 1 ? "active" : ""}" onclick="app.updateSim('matStage', 1)">${this.l("Tahap 1: Merintis", "Stage 1: Starting")}</button>
                <button class="${stage === 2 ? "active" : ""}" onclick="app.updateSim('matStage', 2)">${this.l("Tahap 2: Berkembang", "Stage 2: Scaling")}</button>
                <button class="${stage === 3 ? "active" : ""}" onclick="app.updateSim('matStage', 3)">${this.l("Tahap 3: Memimpin", "Stage 3: Leading")}</button>
              </div>
            </div>
            <div class="sim-control">
              <label><span>${this.l("Pilihan Arsitektur Platform", "Platform Architecture Choice")}</span></label>
              <div class="segmented" style="margin-top:4px">
                <button class="${arch === "typeA" ? "active" : ""}" onclick="app.updateSim('matArch', 'typeA')">${this.l("Tipe A (ELT terkelola + DuckDB/warehouse)", "Type A (Managed ELT + DuckDB/Warehouse)")}</button>
                <button class="${arch === "typeB" ? "active" : ""}" onclick="app.updateSim('matArch', 'typeB')">${this.l("Tipe B (K8s + Kafka + Spark buatan sendiri)", "Type B (Custom K8s + Kafka + Spark)")}</button>
              </div>
            </div>
            <div class="sim-control">
              <label><span>${this.l("Jumlah Data Engineer di Tim", "Data Engineers on Team")}</span><strong>${engs} ${this.l("orang", "engineers")}</strong></label>
              <input type="range" min="1" max="10" value="${engs}" oninput="app.updateSim('matEngs', Number(this.value))" />
            </div>
          </div>
          <p class="small muted">${this.l("Angka biaya dan waktu di sini adalah model pengajaran kasar, bukan harga atau hasil ukur. Pakai untuk melihat arah trade-off-nya.", "The cost and time figures here are a rough teaching model, not measured prices. Use them to see which way the trade-off goes.")}</p>
          <div class="sim-metrics">
            <div class="sim-metric ${monthlyTco > 10000 && stage === 1 ? "danger" : "ok"}">
              <div class="small muted">${this.l("Estimasi Tagihan Cloud Bulanan (TCO)", "Monthly Cloud Infrastructure Bill (TCO)")}</div>
              <div class="val">$${monthlyTco.toLocaleString()}/mo</div>
              <div class="small muted">${arch === "typeA" ? this.l("Bayar sesuai pemakaian, hampir nol server menganggur", "Pay-per-use, near-zero idle cluster waste") : this.l("Klaster K8s, broker Kafka & node Spark menyala 24/7", "24/7 multi-AZ K8s, Kafka brokers & Spark nodes")}</div>
            </div>
            <div class="sim-metric ${timeToValueWeeks > 8 ? "danger" : "ok"}">
              <div class="small muted">${this.l("Biaya Peluang / Waktu Rilis Dashboard Pertama (TOCO)", "Opportunity Cost / Time to First Business Value (TOCO)")}</div>
              <div class="val">${timeToValueWeeks} ${this.l("minggu", "weeks")} · ${maintenancePct}% Ops</div>
              <div class="small muted">${this.l(`${maintenancePct}% waktu tim habis untuk merawat infrastruktur`, `${maintenancePct}% of team capacity spent on infra maintenance`)}</div>
            </div>
            <div class="sim-metric ${verdictBad ? "danger" : "ok"}">
              <div class="small muted">${this.l("Keputusan Arsitektur", "Architectural Verdict")}</div>
              <div class="val">${isOverEngineered ? this.l("Terlalu besar untuk tahap ini", "Too big for this stage") : isUnderEngineered ? this.l("Mungkin terlalu kecil: cek streaming atau lakehouse", "Maybe too small: consider streaming or a lakehouse") : maintenancePct >= 75 ? this.l("Tim habis untuk merawat sistem", "Team swamped by upkeep") : this.l("Pas ukurannya", "Right-sized")}</div>
              <div class="small muted">${isOverEngineered ? this.l("Klaster custom di tahap 1 menghabiskan waktu tim sebelum ada angka yang berguna.", "A custom cluster at stage 1 spends the team's time before any useful number appears.") : this.l("Desain sesuai dengan tahap kematangan dan ukuran tim.", "The design fits the maturity stage and the team size.")}</div>
            </div>
          </div>
        </div>`;
    }

    if (sim.id === "sim-pii-gdpr") {
      const hashMode = st.piiHashMode || "salted";
      const storageFmt = st.piiStorageFmt || "iceberg_mor";
      const gdprRequests = Number(st.piiGdprReq || 250);
      const rainbowSafe = hashMode === "salted";
      const filesRewritten = storageFmt === "raw_parquet" ? gdprRequests * 40 : Math.ceil(gdprRequests / 25);
      const eraseCost = storageFmt === "raw_parquet" ? gdprRequests * 12 : Math.max(5, Math.round(gdprRequests * 0.15));
      return `
        <div class="sim-card stack-sm">
          <div class="row between">
            <div>
              <span class="chip chip-blue">⚡ ${this.l("Simulator Model Mental Interaktif", "Interactive Mental-Model Simulator")}</span>
              <h3 style="margin-top:4px">${sim.icon} ${this.esc(this.t(sim.title))}</h3>
              <p class="small muted">${this.esc(this.t(sim.subtitle))}</p>
            </div>
          </div>
          <div class="sim-controls">
            <div class="sim-control">
              <label><span>${this.l("Metode Pseudonimisasi PII (Email / No. HP)", "PII Pseudonymization Method (Email / Phone)")}</span></label>
              <div class="segmented" style="margin-top:4px">
                <button class="${hashMode === "plain" ? "active" : ""}" onclick="app.updateSim('piiHashMode', 'plain')">Plaintext</button>
                <button class="${hashMode === "unsalted" ? "active" : ""}" onclick="app.updateSim('piiHashMode', 'unsalted')">Unsalted SHA-256</button>
                <button class="${hashMode === "salted" ? "active" : ""}" onclick="app.updateSim('piiHashMode', 'salted')">Salted HMAC-SHA256</button>
              </div>
            </div>
            <div class="sim-control">
              <label><span>${this.l("Strategi Penghapusan GDPR di Lakehouse", "Lakehouse GDPR Erasure Strategy")}</span></label>
              <div class="segmented" style="margin-top:4px">
                <button class="${storageFmt === "raw_parquet" ? "active" : ""}" onclick="app.updateSim('piiStorageFmt', 'raw_parquet')">Rewrite Raw Parquet Files</button>
                <button class="${storageFmt === "iceberg_mor" ? "active" : ""}" onclick="app.updateSim('piiStorageFmt', 'iceberg_mor')">Iceberg Merge-on-Read + Weekly Compaction</button>
              </div>
            </div>
            <div class="sim-control">
              <label><span>${this.l("Permintaan Hapus Akun GDPR / Bulan", "GDPR Erasure Requests / Month")}</span><strong>${gdprRequests} ${this.l("permintaan", "requests")}</strong></label>
              <input type="range" min="10" max="1000" step="10" value="${gdprRequests}" oninput="app.updateSim('piiGdprReq', Number(this.value))" />
            </div>
          </div>
          <p class="small muted">${this.l("Angka biaya dan waktu di sini adalah model pengajaran kasar, bukan harga atau hasil ukur. Pakai untuk melihat arah trade-off-nya.", "The cost and time figures here are a rough teaching model, not measured prices. Use them to see which way the trade-off goes.")}</p>
          <div class="sim-metrics">
            <div class="sim-metric ${rainbowSafe ? "ok" : "danger"}">
              <div class="small muted">${this.l("Ketahanan Terhadap Serangan Rainbow Table", "Rainbow-Table Attack Resistance")}</div>
              <div class="val">${hashMode === "plain" ? this.l("Tidak ada: terbaca langsung", "None: readable as is") : hashMode === "unsalted" ? this.l("Terbalik dalam ~2 menit", "Reversed in about 2 minutes") : this.l("Aman selama kuncinya rahasia", "Safe while the key stays secret")}</div>
              <div class="small muted">${rainbowSafe ? this.l("Token deterministik untuk JOIN tanpa membuka PII asli", "Deterministic join token without exposing raw PII") : this.l("Semua 100 juta nomor 0812 di-hash dalam ~2 menit dengan Python di satu core (diukur).", "All 100 million 0812 numbers hash in about 2 minutes in Python on one core (measured).")}</div>
            </div>
            <div class="sim-metric ${storageFmt === "raw_parquet" ? "danger" : "ok"}">
              <div class="small muted">${this.l("File Parquet Ditulis Ulang / Bulan", "Parquet Files Rewritten / Month")}</div>
              <div class="val">${filesRewritten.toLocaleString()} ${this.l("file", "files")}</div>
              <div class="small muted">${storageFmt === "raw_parquet" ? this.l("Setiap permintaan hapus menulis ulang file yang berisi orang itu.", "Each deletion rewrites every file that holds the person.") : this.l("File delete kecil, dipadatkan sesuai jadwal.", "Small delete files, compacted on a schedule.")}</div>
            </div>
            <div class="sim-metric ${eraseCost > 500 ? "danger" : "ok"}">
              <div class="small muted">${this.l("Biaya Komputasi Penghapusan GDPR", "Monthly GDPR Erasure Compute Cost")}</div>
              <div class="val">$${eraseCost.toLocaleString()}/mo</div>
              <div class="small muted">${storageFmt === "raw_parquet" ? this.l("Data yang ditulis jauh lebih banyak dari yang dihapus.", "Far more data written than deleted.") : this.l("Jauh lebih sedikit tulisan dengan merge-on-read.", "Far fewer writes with merge-on-read.")}</div>
            </div>
          </div>
        </div>`;
    }

    // sim-idempotency
    const retries = Number(st.idemRetries || 3);
    const strat = st.idemStrategy || "append";
    const batchRows = 1000;
    const finalRows = strat === "append" ? batchRows * retries : batchRows;
    const isCorrupted = finalRows !== batchRows;
    return `
      <div class="sim-card stack-sm">
        <div class="row between">
          <div>
            <span class="chip chip-blue">⚡ ${this.l("Simulator Model Mental Interaktif", "Interactive Mental-Model Simulator")}</span>
            <h3 style="margin-top:4px">${sim.icon} ${this.esc(this.t(sim.title))}</h3>
            <p class="small muted">${this.esc(this.t(sim.subtitle))}</p>
          </div>
        </div>
        <div class="sim-controls">
          <div class="sim-control">
            <label><span>${this.l("Jumlah Eksekusi Task (1x Jalan + Retry)", "Task Executions (Initial + Retries)")}</span><strong>${retries}x</strong></label>
            <input type="range" min="1" max="5" value="${retries}" oninput="app.updateSim('idemRetries', Number(this.value))" />
          </div>
          <div class="sim-control">
            <label><span>${this.l("Pola Penulisan ke Target", "Target Write Pattern")}</span></label>
            <div class="segmented" style="margin-top:4px">
              <button class="${strat === "append" ? "active" : ""}" onclick="app.updateSim('idemStrategy','append')">INSERT INTO (Append)</button>
              <button class="${strat === "del_ins" ? "active" : ""}" onclick="app.updateSim('idemStrategy','del_ins')">DELETE Partition + INSERT</button>
              <button class="${strat === "merge" ? "active" : ""}" onclick="app.updateSim('idemStrategy','merge')">MERGE / ON CONFLICT</button>
            </div>
          </div>
        </div>
        <div class="sim-metrics">
          <div class="sim-metric">
            <div class="small muted">${this.l("Baris Unik di Sumber (2026-10-19)", "Source Partition Rows")}</div>
            <div class="val">1,000</div>
          </div>
          <div class="sim-metric ${isCorrupted ? "danger" : "ok"}">
            <div class="small muted">${this.l("Baris di Tabel Target Setelah Retry", "Target Rows After Retries")}</div>
            <div class="val">${finalRows.toLocaleString()} ${isCorrupted ? `(${retries}x Duplikat!)` : "✓ Idempoten"}</div>
          </div>
          <div class="sim-metric ${isCorrupted ? "danger" : "ok"}">
            <div class="small muted">${this.l("Hasil Hukum Idempotensi", "Idempotency Verdict")}</div>
            <div class="val">${isCorrupted ? "❌ f(f(x)) ≠ f(x)" : "✅ f(f(x)) = f(x)"}</div>
            <div class="small muted">${isCorrupted ? this.l("Retry menyebabkan duplikasi data produksi!", "Retries duplicated production rows!") : this.l("Aman dijalankan ulang kapan saja", "Safe to re-run N times")}</div>
          </div>
        </div>
      </div>`;
  }

  // ---------- Silent Bug Clinic & Active Recall Helpers (Ideas #6 & #2) ----------
  setActiveBug(id) {
    this.activeBugId = id;
    this.renderView();
  }
  selectBugLine(bugId, lineIdx) {
    const cur = this.bugState[bugId] || {};
    this.bugState[bugId] = { ...cur, selectedLine: lineIdx };
    writeStore("df_bug_drills", this.bugState);
    this.renderView();
  }
  submitBugDiagnosis(bugId, optId) {
    const drills = (window.PRACTICE_LABS && window.PRACTICE_LABS.SILENT_BUG_DRILLS) || [];
    const drill = drills.find((d) => d.id === bugId);
    if (!drill) return;
    const cur = this.bugState[bugId] || {};
    if (cur.selectedLine === undefined || cur.selectedLine === null) {
      alert(this.l("Langkah 1: Klik baris kode yang mengandung bug diam-diam terlebih dahulu!", "Step 1: Click the exact line of code containing the silent bug first!"));
      return;
    }
    const lineOk = cur.selectedLine === drill.buggyLineIndex;
    const opt = drill.options.find((o) => o.id === optId);
    const optOk = Boolean(opt && opt.correct);
    this.bugState[bugId] = {
      ...cur,
      selectedOpt: optId,
      attempted: true,
      solved: Boolean(lineOk && optOk),
      at: new Date().toISOString()
    };
    writeStore("df_bug_drills", this.bugState);
    this.renderView();
  }

  getRecallDeck() {
    const deck = [];
    CURRICULUM_DATA.forEach((lvl) => {
      lvl.modules.forEach((mod) => {
        const modLabel = `${mod.number} ${this.t(mod.title)}`;
        // 1. Module Production Reality & Chaos Defensive Pattern
        if (mod.whyTutorialsLie && mod.chaosLab && mod.chaosLab.defensivePattern) {
          deck.push({
            id: `recall:${mod.id}:reality`,
            modId: mod.id,
            modLabel,
            prompt: this.l(`Mengapa tutorial biasa gagal pada topik "${this.t(mod.title)}" dan apa pola defensif produksinya?`, `Why do standard tutorials fail on "${this.t(mod.title)}" and what is the production defensive pattern?`),
            answer: `**${this.l("Realita Produksi", "Production Reality")}:** ${this.t(mod.whyTutorialsLie)} — **${this.l("Pola Defensif", "Defensive Pattern")}:** ${String(this.t(mod.chaosLab.defensivePattern)).replace(/\n+/g, " ")}`
          });
        }
        // 2. Lesson In-Short callouts
        (mod.lessons || []).forEach((ls, li) => {
          const body = this.lessonBody(ls);
          const m = body.match(/^>\s*\*\*(?:In short|Intinya|Ringkasan|TL;DR):?\*\*\s*(.+)$/im);
          if (m && m[1]) {
            deck.push({
              id: `recall:${mod.id}:ls:${li}`,
              modId: mod.id,
              modLabel,
              prompt: this.t(ls.title),
              answer: m[1].trim()
            });
          }
        });
        // 3. First 2 high-signal conceptual questions per module
        (mod.quiz || []).slice(0, 2).forEach((q, qi) => {
          deck.push({
            id: `recall:${mod.id}:q:${qi}`,
            modId: mod.id,
            modLabel,
            prompt: this.t(q.question),
            answer: `**${this.t(q.options[q.correct])}** — ${this.t(q.explanation)}`
          });
        });
      });
    });
    return deck;
  }
  stepRecallCard(delta) {
    const deck = this.getRecallDeck();
    if (!deck.length) return;
    this.activeRecallIdx = (this.activeRecallIdx + delta + deck.length) % deck.length;
    this.recallRevealed = false;
    this.recallDraft = "";
    this.renderView();
  }
  revealRecallAnswer() {
    const ta = document.getElementById("recall-draft-input");
    if (ta) this.recallDraft = ta.value;
    if ((this.recallDraft || "").trim().length < 20) {
      alert(this.l("Tulis ingatan Anda minimal 20 karakter terlebih dahulu sebelum membalik kartu! Active recall hanya bekerja jika otak Anda berusaha mengingat.", "Write at least 20 characters of your own recall first before flipping the card! Active recall only works when your brain retrieves the concept."));
      return;
    }
    this.recallRevealed = true;
    this.renderView();
  }
  submitChaosProof(modId) {
    const input = document.getElementById(`chaos-proof-input-${modId}`);
    const msg = document.getElementById(`chaos-proof-msg-${modId}`);
    if (!input || !msg) return;
    const res = ProofCheck.verifyChaos(modId, input.value);
    if (!res.ok) {
      const errMap = {
        format: this.l(`Format salah. Jalankan python3 scripts/chaos_drill.py verify ${modId} ~/df-chaos/${modId} lalu tempel kode CHAOS1:${modId}:…`, `Invalid format. Run python3 scripts/chaos_drill.py verify ${modId} ~/df-chaos/${modId} and paste the CHAOS1:${modId}:… code.`),
        checksum: this.l("Kode rusak atau salah ketik. Salin ulang seluruh kode CHAOS1.", "Checksum mismatch. Copy the full CHAOS1 code again."),
        module: this.l(`Kode ini untuk modul ${res.mod}, bukan ${modId}.`, `This token is for module ${res.mod}, not ${modId}.`)
      };
      msg.innerHTML = `<div class="feedback bad">${this.esc(errMap[res.reason] || errMap.format)}</div>`;
      return;
    }
    this.chaosProofs[modId] = {
      token: input.value.trim().replace(/\s+/g, ""),
      passed: res.info.passed,
      py: res.info.py,
      os: res.info.os,
      at: new Date().toISOString()
    };
    writeStore("df_chaos_proofs", this.chaosProofs);
    const cur = this.chaosDone[modId] || {};
    this.chaosDone[modId] = { ...cur, done: true, at: new Date().toISOString() };
    writeStore("df_chaos_done", this.chaosDone);
    this.renderView();
  }

  submitPortfolioProof(projId) {
    const input = document.getElementById(`port-proof-input-${projId}`);
    const msg = document.getElementById(`port-proof-msg-${projId}`);
    if (!input || !msg) return;
    const res = ProofCheck.verifyPortfolio(projId, input.value);
    if (!res.ok) {
      const errMap = {
        format: this.l(`Format salah. Jalankan python3 scripts/verify_portfolio.py ${projId} <path-git-repo> lalu tempel kode PORT1:${projId}:…`, `Invalid format. Run python3 scripts/verify_portfolio.py ${projId} <path-to-git-repo> and paste the PORT1:${projId}:… token.`),
        checksum: this.l("Kode rusak atau salah ketik. Salin ulang seluruh kode PORT1.", "Checksum mismatch. Copy the full PORT1 token again."),
        project: this.l(`Kode ini untuk proyek ${res.proj}, bukan ${projId}.`, `This token is for project ${res.proj}, not ${projId}.`)
      };
      msg.innerHTML = `<div class="feedback bad">${this.esc(errMap[res.reason] || errMap.format)}</div>`;
      return;
    }
    this.portfolioProofs[projId] = {
      token: input.value.trim().replace(/\s+/g, ""),
      passed: res.info.passed,
      commits: res.info.commits,
      py: res.info.py,
      os: res.info.os,
      at: new Date().toISOString()
    };
    writeStore("df_portfolio_proofs", this.portfolioProofs);
    this.renderView();
  }

  setActiveDefense(id) {
    this.activeDefenseId = id;
    this.renderView();
  }
  saveDefenseDraft(id, val) {
    const cur = this.defenseState[id] || {};
    this.defenseState[id] = { ...cur, draft: val };
    writeStore("df_stakeholder_defense", this.defenseState);
  }
  submitDefenseChoice(id, optId) {
    const drills = (window.PRACTICE_LABS && window.PRACTICE_LABS.STAKEHOLDER_DEFENSE_DRILLS) || [];
    const d = drills.find((x) => x.id === id);
    if (!d) return;
    const cur = this.defenseState[id] || {};
    if ((cur.draft || "").trim().length < 40) {
      alert(this.l("Langkah 1: Tulis argumen negosiasi teknis Anda minimal 40 karakter terlebih dahulu sebelum memilih tindakan!", "Step 1: Write at least 40 characters of your own engineering trade-off defense before selecting an action!"));
      return;
    }
    const opt = d.options.find((o) => o.id === optId);
    const ok = Boolean(opt && opt.correct);
    this.defenseState[id] = { ...cur, selectedOpt: optId, attempted: true, solved: ok, at: new Date().toISOString() };
    writeStore("df_stakeholder_defense", this.defenseState);
    this.renderView();
  }
  selectBenchmarkJd(id) {
    this.selectedJdId = id;
    this.customJdText = "";
    this.renderView();
  }
  updateCustomJd(val) {
    this.customJdText = val;
    this.renderView();
  }

  rateRecallCard(cardId, rating) {
    this.recallState[cardId] = { rating, at: new Date().toISOString() };
    writeStore("df_active_recall", this.recallState);
    this.stepRecallCard(1);
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
          <div class="callout"><p>${this.l("Tanpa instalasi apa pun, di browser ini Anda sudah bisa membaca semua materi dan memakai SQL Sandbox. Menyiapkan Python, venv, terminal, dan Git di komputer Anda sendiri adalah bagian penting dari belajar data engineering, dan itu dilatih di Modul 0.1. Lab Python dikerjakan di komputer Anda sendiri; hanya Lab 0.0 dan 0.2 punya pratinjau di browser, dan pratinjau itu tidak dihitung.", "With nothing installed, you can already read every lesson and use the SQL Sandbox in this browser. Setting up Python, a venv, a terminal and Git on your own computer is a core part of learning data engineering, and Module 0.1 trains it. The Python labs are done on your own computer; only Labs 0.0 and 0.2 have a browser preview, and the preview does not count.")}</p></div>
        </div>

        <div class="card stack-sm" style="border-left:4px solid var(--blue)" id="learning-contract">
          <h2>${this.l("Aturan main: kerjakan sendiri", "The rule: do it yourself")}</h2>
          <p>${this.l("Kursus ini hanya berhasil jika <strong>Anda sendiri yang menulis kodenya</strong>. Menyalin solusi referensi, atau meminta AI atau orang lain menulis lab untuk Anda, membuat Anda merasa paham padahal tidak, dan itu langsung terlihat di wawancara teknis dan di minggu pertama bekerja.", "This course only works if <strong>you write the code yourself</strong>. Copying the reference solution, or asking an AI or another person to write the lab for you, makes you feel you understand when you do not, and it shows immediately in a technical interview and in your first week at work.")}</p>
          <ul style="margin-left:18px">
            <li>${this.l("<strong>Boleh:</strong> bertanya ke AI, forum, atau teman untuk <em>menjelaskan</em> sebuah konsep atau pesan error, setelah Anda mencoba sendiri minimal 30 menit.", "<strong>Allowed:</strong> asking an AI, a forum or a friend to <em>explain</em> a concept or an error message, after you have tried yourself for at least 30 minutes.")}</li>
            <li>${this.l("<strong>Jangan:</strong> meminta mereka menulis solusi lab, atau membuka folder <code>reference/</code> sebelum Anda berusaha sungguh-sungguh.", "<strong>Do not:</strong> ask them to write the lab solution, or open the <code>reference/</code> folder before you have really tried.")}</li>
            <li>${this.l("Kode bukti hanya menunjukkan bahwa tes lulus di komputer Anda; ia <strong>tidak bisa membuktikan siapa yang menulis kodenya</strong>. Kursus ini tidak memberi sertifikat. Yang Anda bawa pulang adalah kemampuan Anda, dan yang dirugikan jika curang adalah Anda sendiri.", "The proof code only shows that the tests pass on your computer; it <strong>cannot prove who wrote the code</strong>. This course gives no certificate. What you take away is your own ability, and the person who loses when you cheat is you.")}</li>
            <li>${this.l("Merasa macet itu normal dan itulah proses belajarnya. Jika macet lebih dari 30 menit: baca ulang pelajaran, kecilkan masalahnya, lalu bertanyalah.", "Feeling stuck is normal and it is how learning happens. If you are stuck for more than 30 minutes: re-read the lesson, shrink the problem, then ask.")}</li>
          </ul>
        </div>

        ${step(1, this.l("Pilih tempat Anda bekerja", "Choose where you work"), `
          <div class="grid cols-2">
            <div class="well stack-sm">
              <strong>${this.l("A. Di komputer Anda sendiri (disarankan)", "A. On your own computer (recommended)")}</strong>
              <p class="small muted">${this.l("Ini yang Anda pakai di pekerjaan nyata, dan menyiapkannya sendiri adalah latihan yang berharga. Jika macet, lihat \"Kalau macet\" di bawah dan Modul 0.1.", "This is what you will use in a real job, and setting it up yourself is valuable practice. If you get stuck, see \"If you get stuck\" below and Module 0.1.")}</p>
              <ul class="small" style="margin-left:18px">
                <li>${this.l("Linux, macOS, atau Windows 10/11 dengan WSL2 (Modul 0.1 menjelaskan WSL2)", "Linux, macOS, or Windows 10/11 with WSL2 (Module 0.1 explains WSL2)")}</li>
                <li>${this.l("Python 3.10 atau lebih baru", "Python 3.10 or newer")}</li>
                <li>${this.l("RAM 8 GB cukup untuk Level 0 sampai 2; 16 GB disarankan untuk Spark dan Kafka", "8 GB RAM is enough for Levels 0 to 2; 16 GB is recommended for Spark and Kafka")}</li>
                <li>${this.l("Sekitar 10 GB ruang disk bebas", "About 10 GB of free disk space")}</li>
              </ul>
            </div>

            <div class="well stack-sm">
              <strong>${this.l("B. Di cloud, hanya jika A tidak memungkinkan", "B. In the cloud, only if A is not possible")}</strong>
              <p class="small muted">${this.l("Misalnya komputer pinjaman atau tablet. GitHub Codespaces membuka editor lengkap di browser dengan semuanya sudah terpasang; Anda tetap bekerja di terminal sungguhan. Perlu akun GitHub gratis; ada kuota jam gratis per bulan. Anda tidak melatih penyiapan sendiri di sini, jadi usahakan A bila bisa.", "For example a borrowed computer or a tablet. GitHub Codespaces opens a full editor in your browser with everything installed; you still work in a real terminal. It needs a free GitHub account and has a free monthly hours quota. You do not practise the setup yourself here, so prefer A when you can.")}</p>
              <a class="btn" href="https://codespaces.new/${repo.replace("https://github.com/", "")}" target="_blank" rel="noopener">${this.l("Buka di Codespaces", "Open in Codespaces")}</a>
              <p class="small muted">${this.l("Setelah terbuka, terminal ada di bagian bawah editor dan file kursus sudah ada: lompat ke langkah 4.", "Once it opens, the terminal is at the bottom of the editor and the course files are already there: skip to step 4.")}</p>
            </div>
          </div>
          <details class="callout neutral fold-callout" id="windows-setup">
            <summary class="label">${this.l("Pakai Windows? Siapkan WSL2 sekarang (sekitar 20 menit, sekali saja)", "On Windows? Set up WSL2 now (about 20 minutes, once)")}</summary>
            <p class="small">${this.l("WSL2 menjalankan Linux (Ubuntu) di dalam Windows. Semua perintah di kursus ini ditulis untuk terminal Linux, jadi kerjakan semuanya di jendela Ubuntu ini.", "WSL2 runs Linux (Ubuntu) inside Windows. Every command in this course is written for a Linux terminal, so do all of it in this Ubuntu window.")}</p>
            <ol class="small" style="margin-left:18px">
              <li>${this.l("Klik Start, ketik <strong>PowerShell</strong>, klik kanan hasilnya, lalu pilih <strong>Run as administrator</strong>.", "Click Start, type <strong>PowerShell</strong>, right-click the result and choose <strong>Run as administrator</strong>.")}</li>
              <li>${this.l("Ketik <code>wsl --install</code> lalu Enter. Tunggu sampai selesai, lalu restart komputer.", "Type <code>wsl --install</code> and press Enter. Wait until it finishes, then restart the computer.")}</li>
              <li>${this.l("Setelah restart, buka <strong>Ubuntu</strong> dari menu Start. Pertama kali, ia meminta nama pengguna dan password Linux yang baru. Saat Anda mengetik password, layar tidak menampilkan apa pun: itu normal. Ketik saja, lalu Enter.", "After the restart, open <strong>Ubuntu</strong> from the Start menu. The first time, it asks for a new Linux user name and password. While you type the password nothing appears on screen: that is normal. Just type it and press Enter.")}</li>
              <li>${this.l("Di jendela Ubuntu, pasang alat yang dipakai kursus ini (ia meminta password tadi):", "In the Ubuntu window, install the tools this course uses (it asks for that password):")}</li>
            </ol>
            ${cmd("sudo apt update && sudo apt install -y python3-venv python3-pip git")}
            <p class="small">${this.l("Lalu lanjutkan langkah 2 di jendela Ubuntu yang sama, di folder Linux Anda sendiri (<code>cd ~</code>), bukan di drive C:. Untuk melihat folder itu di Windows Explorer, ketik <code>explorer.exe .</code> (dengan titik).", "Then continue with step 2 in the same Ubuntu window, in your own Linux folder (<code>cd ~</code>), not on drive C:. To see that folder in Windows Explorer, type <code>explorer.exe .</code> (with the dot).")}</p>
            <p class="small muted">${this.l("Linux Ubuntu atau Debian (bukan Windows)? Jalankan baris <code>sudo apt</code> di atas juga: tanpa <code>python3-venv</code>, perintah <code>python3 -m venv</code> di Modul 0.1 gagal. Error saat <code>wsl --install</code>? Biasanya virtualisasi mati di BIOS; cari pesan error-nya, atau pakai pilihan B.", "Ubuntu or Debian Linux (not Windows)? Run the <code>sudo apt</code> line above too: without <code>python3-venv</code>, the <code>python3 -m venv</code> command in Module 0.1 fails. An error during <code>wsl --install</code>? Usually virtualisation is switched off in the BIOS; search for the error message, or use option B.")}</p>
          </details>
          <details class="callout neutral fold-callout" id="linux-setup">
            <summary class="label">${this.l("Pakai Linux (Ubuntu, Mint, Debian)? Siapkan alatnya (sekitar 5 menit, sekali saja)", "On Linux (Ubuntu, Mint, Debian)? Set up the tools (about 5 minutes, once)")}</summary>
            <ol class="small" style="margin-left:18px">
              <li>${this.l("Buka <strong>Terminal</strong>: tekan <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>, atau buka menu aplikasi dan ketik Terminal.", "Open <strong>Terminal</strong>: press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>, or open the applications menu and type Terminal.")}</li>
              <li>${this.l("Tempel baris ini (di terminal, menempel memakai <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>), lalu Enter. Ia meminta password login Anda; saat diketik, layar tidak menampilkan apa pun, itu normal.", "Paste this line (in a terminal, paste is <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>) and press Enter. It asks for your login password; nothing appears while you type it, that is normal.")}</li>
            </ol>
            ${cmd("sudo apt update && sudo apt install -y python3-venv python3-pip git")}
            <p class="small">${this.l("Periksa dengan <code>python3 --version</code> (harus 3.10 atau lebih baru) dan <code>git --version</code>. Fedora memakai <code>sudo dnf install python3-pip git</code>.", "Check with <code>python3 --version</code> (3.10 or newer) and <code>git --version</code>. Fedora uses <code>sudo dnf install python3-pip git</code>.")}</p>
          </details>
          <details class="callout neutral fold-callout" id="mac-setup">
            <summary class="label">${this.l("Pakai macOS? Siapkan Python (sekitar 15 menit, sekali saja)", "On macOS? Set up Python (about 15 minutes, once)")}</summary>
            <ol class="small" style="margin-left:18px">
              <li>${this.l("Buka <strong>Terminal</strong>: tekan Cmd+Spasi, ketik Terminal, lalu Enter.", "Open <strong>Terminal</strong>: press Cmd+Space, type Terminal and press Enter.")}</li>
              <li>${this.l("Ketik <code>python3 --version</code>. Di Mac yang belum pernah dipakai untuk coding, muncul jendela yang menawarkan memasang <em>command line developer tools</em>: klik <strong>Install</strong> dan tunggu sampai selesai. Itu normal, bukan error, dan alat ini sekaligus memasang <code>git</code>.", "Type <code>python3 --version</code>. On a Mac that has never been used for coding, a window offers to install the <em>command line developer tools</em>: click <strong>Install</strong> and wait until it finishes. That is normal, not an error, and it also installs <code>git</code>.")}</li>
              <li>${this.l("Jalankan <code>python3 --version</code> lagi. Python bawaan alat itu sering versi 3.9, terlalu lama untuk kursus ini. Jika di bawah 3.10, pasang Python terbaru dengan installer macOS dari python.org, tutup Terminal, buka yang baru, lalu periksa lagi.", "Run <code>python3 --version</code> again. The Python that comes with those tools is often version 3.9, too old for this course. If it is below 3.10, install the latest Python with the macOS installer from python.org, close Terminal, open a new one and check again.")}</li>
              <li>${this.l("Lanjutkan ke langkah 2. Di macOS, <code>python3 -m venv</code> (Modul 0.1) bekerja tanpa paket tambahan.", "Continue with step 2. On macOS, <code>python3 -m venv</code> (Module 0.1) works without extra packages.")}</li>
            </ol>
          </details>
        `)}

        ${step(2, this.l("Buka terminal dan pilih folder kerja", "Open a terminal and choose a work folder"), `
          <p>${this.l("<strong>Terminal</strong> adalah jendela tempat Anda mengetik perintah untuk komputer. Bukanya seperti di langkah 1 (Linux: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>; macOS: aplikasi Terminal; Windows: jendela Ubuntu). Isinya kira-kira seperti ini:", "The <strong>terminal</strong> is the window where you type commands for the computer. Open it as in step 1 (Linux: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>; macOS: the Terminal app; Windows: the Ubuntu window). It looks roughly like this:")}</p>
          <pre class="start-screen"><code>nama@laptop:~$ <span class="start-cursor">▌</span></code></pre>
          <p>${this.l("Bagian sampai <code>$</code> disebut <strong>prompt</strong>: komputer menunggu perintah. <code>~</code> artinya Anda sedang di folder rumah (home) Anda. Ketik perintah <em>setelah</em> <code>$</code>, tekan Enter, dan hasilnya muncul di bawahnya. Di kursus ini, jangan ikut mengetik <code>$</code>-nya.", "Everything up to <code>$</code> is the <strong>prompt</strong>: the computer is waiting for a command. <code>~</code> means you are in your home folder. Type a command <em>after</em> the <code>$</code>, press Enter, and the result appears below it. Never type the <code>$</code> itself.")}</p>
          <ul class="small" style="margin-left:18px">
            <li>${this.l("<strong>Menempel:</strong> di terminal Linux <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (bukan <kbd>Ctrl</kbd>+<kbd>V</kbd>), di macOS <kbd>Cmd</kbd>+<kbd>V</kbd>, di jendela Ubuntu Windows klik kanan.", "<strong>Pasting:</strong> in a Linux terminal <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (not <kbd>Ctrl</kbd>+<kbd>V</kbd>), on macOS <kbd>Cmd</kbd>+<kbd>V</kbd>, in the Windows Ubuntu window right-click.")}</li>
            <li>${this.l("<kbd>Ctrl</kbd>+<kbd>C</kbd> di terminal <strong>tidak menyalin</strong>: ia menghentikan program yang sedang berjalan. Berguna kalau sesuatu macet.", "<kbd>Ctrl</kbd>+<kbd>C</kbd> in a terminal <strong>does not copy</strong>: it stops the program that is running. Handy when something hangs.")}</li>
          </ul>
          <p>${this.l("Sekarang buat satu folder untuk semua proyek Anda dan masuk ke sana. Jalankan baris demi baris:", "Now make one folder for all your projects and go into it. Run these one line at a time:")}</p>
          ${cmd("cd ~\nmkdir -p projects\ncd projects\npwd")}
          <p class="small">${this.l("<code>cd</code> = pindah folder, <code>mkdir</code> = buat folder, <code>pwd</code> = tampilkan saya sedang di mana. <strong>Seharusnya Anda melihat</strong> baris seperti <code>/home/nama/projects</code> (di macOS <code>/Users/nama/projects</code>), dan prompt berubah menjadi <code>~/projects$</code>.", "<code>cd</code> = change folder, <code>mkdir</code> = make a folder, <code>pwd</code> = show where I am. <strong>You should see</strong> a line like <code>/home/name/projects</code> (on macOS <code>/Users/name/projects</code>), and the prompt changes to <code>~/projects$</code>.")}</p>`)}

        ${step(3, this.l("Ambil file kursus", "Get the course files"), `
          <p>${this.l("Di terminal yang sama, masih di folder <code>~/projects</code>, jalankan:", "In the same terminal, still in the <code>~/projects</code> folder, run:")}</p>
          ${cmd(`git clone ${repo}.git\ncd DECourse\nls`)}
          <p class="small">${this.l("<code>git clone</code> mengunduh seluruh kursus ke folder baru bernama <code>DECourse</code> di dalam folder tempat Anda berada. <strong>Seharusnya Anda melihat</strong> <code>Cloning into 'DECourse'...</code>, lalu <code>ls</code> menampilkan antara lain <code>README.md</code>, <code>app</code>, <code>curriculum</code>, <code>labs</code>, dan <code>scripts</code>. Prompt Anda sekarang berakhir dengan <code>~/projects/DECourse$</code>.", "<code>git clone</code> downloads the whole course into a new folder called <code>DECourse</code> inside the folder you are in. <strong>You should see</strong> <code>Cloning into 'DECourse'...</code>, then <code>ls</code> lists, among others, <code>README.md</code>, <code>app</code>, <code>curriculum</code>, <code>labs</code> and <code>scripts</code>. Your prompt now ends with <code>~/projects/DECourse$</code>.")}</p>
          <p class="small">${this.l("<strong>Clone hanya sekali.</strong> Setiap kali membuka terminal baru nanti, masuk dulu ke folder kursus dengan <code>cd ~/projects/DECourse</code>. Semua perintah di kursus ini (<code>python3 ...</code>, <code>pytest ...</code>) dijalankan dari folder ini, yang disebut <em>akar repositori</em>.", "<strong>Clone only once.</strong> Every time you open a new terminal later, first go to the course folder with <code>cd ~/projects/DECourse</code>. Every command in this course (<code>python3 ...</code>, <code>pytest ...</code>) is run from this folder, called the <em>repository root</em>.")}</p>
          <p class="small muted">${this.l("<code>git: command not found</code>? Kembali ke langkah 1 untuk sistem Anda. Tanpa Git: <a href=\"" + repo + "/archive/refs/heads/main.zip\" target=\"_blank\" rel=\"noopener\">unduh ZIP</a>, ekstrak ke folder <code>projects</code>, lalu <code>cd</code> ke folder hasil ekstrak.", "<code>git: command not found</code>? Go back to step 1 for your system. Without Git: <a href=\"" + repo + "/archive/refs/heads/main.zip\" target=\"_blank\" rel=\"noopener\">download the ZIP</a>, extract it into the <code>projects</code> folder, then <code>cd</code> into the extracted folder.")}</p>`)}

        ${step(4, this.l("Tiga tempat Anda mengetik, dan cara membedakannya", "Three places you type, and how to tell them apart"), `
          <p>${this.l("Pemula paling sering bingung di sini: perintah terminal, kode Python, dan file Python diketik di tempat yang berbeda. Lihat <strong>prompt</strong>-nya untuk tahu Anda sedang di mana.", "This is where beginners get confused most: terminal commands, Python code and Python files are typed in different places. Look at the <strong>prompt</strong> to know where you are.")}</p>
          <div class="grid cols-3 start-places">
            <div class="well stack-sm">
              <strong>1. ${this.l("Terminal", "The terminal")} <code>$</code></strong>
              <p class="small">${this.l("Untuk <strong>perintah ke komputer</strong>: <code>cd</code>, <code>ls</code>, <code>git clone</code>, <code>python3 file.py</code>, <code>pytest</code>. Bukan kode Python.", "For <strong>commands to the computer</strong>: <code>cd</code>, <code>ls</code>, <code>git clone</code>, <code>python3 file.py</code>, <code>pytest</code>. Not Python code.")}</p>
              <pre class="start-screen"><code>~/projects/DECourse$ ls</code></pre>
            </div>
            <div class="well stack-sm">
              <strong>2. ${this.l("Python interaktif", "Interactive Python")} <code>&gt;&gt;&gt;</code></strong>
              <p class="small">${this.l("Untuk <strong>mencoba satu-dua baris Python</strong>, seperti contoh di materi. Ketik <code>python3</code> di terminal; prompt berubah menjadi <code>&gt;&gt;&gt;</code>. Keluar dengan <code>exit()</code> atau <kbd>Ctrl</kbd>+<kbd>D</kbd> (bukan <kbd>Ctrl</kbd>+<kbd>Z</kbd>, yang hanya menjeda Python). Prompt <code>...</code> berarti Python menunggu akhir blok: tekan Enter sekali lagi.", "To <strong>try a line or two of Python</strong>, like the examples in the lessons. Type <code>python3</code> in the terminal; the prompt becomes <code>&gt;&gt;&gt;</code>. Leave with <code>exit()</code> or <kbd>Ctrl</kbd>+<kbd>D</kbd> (not <kbd>Ctrl</kbd>+<kbd>Z</kbd>, which only pauses Python). A <code>...</code> prompt means Python is waiting for the end of a block: press Enter once more.")}</p>
              <pre class="start-screen"><code>&gt;&gt;&gt; total = 150000
&gt;&gt;&gt; print(total + 1000)
151000</code></pre>
            </div>
            <div class="well stack-sm">
              <strong>3. ${this.l("File .py di editor", "A .py file in an editor")}</strong>
              <p class="small">${this.l("Untuk <strong>program yang disimpan</strong>, termasuk semua lab. Tulis di editor, simpan (<kbd>Ctrl</kbd>+<kbd>S</kbd>), lalu jalankan dari terminal dengan <code>python3 namafile.py</code>.", "For <strong>programs you keep</strong>, including every lab. Write it in an editor, save (<kbd>Ctrl</kbd>+<kbd>S</kbd>), then run it from the terminal with <code>python3 filename.py</code>.")}</p>
              <pre class="start-screen"><code>~/projects/DECourse$ python3 hello.py
Hello from KopiKu</code></pre>
            </div>
          </div>
          <p class="small"><strong>${this.l("Tanda Anda salah tempat", "Signs you are in the wrong place")}:</strong></p>
          <ul class="small" style="margin-left:18px">
            <li>${this.l("Mengetik kode Python di <code>$</code>, misalnya <code>print(\"hi\")</code>, memberi <code>bash: syntax error near unexpected token</code>. Ketik <code>python3</code> dulu, atau taruh kodenya di file.", "Typing Python at the <code>$</code>, for example <code>print(\"hi\")</code>, gives <code>bash: syntax error near unexpected token</code>. Type <code>python3</code> first, or put the code in a file.")}</li>
            <li>${this.l("Mengetik perintah terminal di <code>&gt;&gt;&gt;</code>, misalnya <code>cd labs</code>, memberi <code>SyntaxError: invalid syntax</code>. Keluar dulu dengan <code>exit()</code>.", "Typing a terminal command at <code>&gt;&gt;&gt;</code>, for example <code>cd labs</code>, gives <code>SyntaxError: invalid syntax</code>. Leave first with <code>exit()</code>.")}</li>
            <li>${this.l("<code>python3 hello.py</code> memberi <code>can't open file ... No such file or directory</code>: terminal Anda tidak berada di folder file itu. Cek dengan <code>pwd</code> dan <code>ls</code>, lalu <code>cd</code> ke folder yang benar.", "<code>python3 hello.py</code> gives <code>can't open file ... No such file or directory</code>: your terminal is not in that file's folder. Check with <code>pwd</code> and <code>ls</code>, then <code>cd</code> to the right folder.")}</li>
          </ul>
          <p><strong>${this.l("Editor: VS Code (gratis, disarankan)", "Editor: VS Code (free, recommended)")}.</strong> ${this.l("Pasang dari <a href=\"https://code.visualstudio.com\" target=\"_blank\" rel=\"noopener\">code.visualstudio.com</a>. Lalu <strong>File → Open Folder</strong> dan pilih <code>projects/DECourse</code>. Daftar file kursus muncul di kiri. Buka <strong>Terminal → New Terminal</strong>: terminal muncul di bawah editor dan sudah berada di folder kursus. Jadi editor (tempat 3) dan terminal (tempat 1 dan 2) ada di satu jendela. Editor teks lain juga boleh.", "Install it from <a href=\"https://code.visualstudio.com\" target=\"_blank\" rel=\"noopener\">code.visualstudio.com</a>. Then <strong>File → Open Folder</strong> and choose <code>projects/DECourse</code>. The course files appear on the left. Open <strong>Terminal → New Terminal</strong>: a terminal appears under the editor, already in the course folder. So the editor (place 3) and the terminal (places 1 and 2) are in one window. Any other text editor works too.")}</p>
          <div class="callout"><p class="small"><strong>🛠 ${this.l("Latihan 5 menit", "5-minute practice")}:</strong> ${this.l("(a) Di terminal, ketik <code>python3</code>, lalu di <code>&gt;&gt;&gt;</code> ketik <code>1 + 2</code> dan Enter; seharusnya muncul <code>3</code>. Keluar dengan <code>exit()</code>. (b) Di VS Code buat file baru <code>hello.py</code> di folder <code>DECourse</code> berisi dua baris <code>name = \"KopiKu\"</code> dan <code>print(\"Hello from\", name)</code>, lalu simpan. (c) Di terminal, di folder <code>DECourse</code>, jalankan <code>python3 hello.py</code>; seharusnya muncul <code>Hello from KopiKu</code>. Sekarang Anda tahu ketiga tempatnya.", "(a) In the terminal, type <code>python3</code>, then at <code>&gt;&gt;&gt;</code> type <code>1 + 2</code> and Enter; you should see <code>3</code>. Leave with <code>exit()</code>. (b) In VS Code make a new file <code>hello.py</code> in the <code>DECourse</code> folder with the two lines <code>name = \"KopiKu\"</code> and <code>print(\"Hello from\", name)</code>, and save it. (c) In the terminal, in the <code>DECourse</code> folder, run <code>python3 hello.py</code>; you should see <code>Hello from KopiKu</code>. Now you know all three places.")}</p></div>`)}

        ${step(5, this.l("Cek bahwa semuanya berjalan", "Check that everything works"), `
          <p class="small">${this.l("Di terminal, di folder <code>DECourse</code> (prompt berakhir dengan <code>DECourse$</code>):", "In the terminal, in the <code>DECourse</code> folder (the prompt ends with <code>DECourse$</code>):")}</p>
          ${cmd(`python3 --version\npython3 labs/shared/shopgen.py --out data\nls data\npython3 scripts/doctor.py`)}
          <p>${this.l("Baris pertama harus menampilkan Python 3.10 atau lebih baru. Baris kedua membuat data toko kopi fiktif KopiKu, dan <code>ls data</code> harus menampilkan file seperti <code>orders.csv</code> dan <code>manifest.json</code>. Jika ya, komputer Anda siap: lab Python bisa berjalan di sini. Baris terakhir menjalankan <strong>doctor</strong> kursus: baris bertanda <code>ok</code> beres, baris <code>FIX</code> datang dengan perintah perbaikannya, dan <code>note</code> hanya informasi. Sebelum Modul 0.1, catatan tentang venv itu wajar.", "The first line should show Python 3.10 or newer. The second creates the fictional KopiKu coffee-shop data, and <code>ls data</code> should list files such as <code>orders.csv</code> and <code>manifest.json</code>. If so, your computer is ready: the Python labs can run here. The last line runs the course <strong>doctor</strong>: lines marked <code>ok</code> are fine, a <code>FIX</code> line comes with the command that fixes it, and a <code>note</code> is information. Before Module 0.1 a note about the venv is expected.")}</p>
          <p class="small muted">${this.l("Pesan <code>command not found</code>? Di Linux/macOS coba <code>python</code> sebagai ganti <code>python3</code>. Di Windows pastikan Anda berada di terminal Ubuntu (WSL2), bukan PowerShell. <code>can't open file 'labs/shared/shopgen.py'</code>? Anda belum di folder <code>DECourse</code>: jalankan <code>cd ~/projects/DECourse</code>.", "<code>command not found</code>? On Linux/macOS try <code>python</code> instead of <code>python3</code>. On Windows make sure you are in the Ubuntu (WSL2) terminal, not PowerShell. <code>can't open file 'labs/shared/shopgen.py'</code>? You are not in the <code>DECourse</code> folder yet: run <code>cd ~/projects/DECourse</code>.")}</p>`)}

        ${step(6, this.l("Opsional: jalankan situs ini di komputer Anda", "Optional: run this site on your computer"), `
          ${cmd("python3 server.py")}
          <p class="small muted">${this.l("Lalu buka http://localhost:3000. Progres Anda disimpan di browser; gunakan Ekspor progres di bawah halaman untuk membuat cadangan.", "Then open http://localhost:3000. Your progress is stored in the browser; use Export progress in the page footer to make a backup.")}</p>`)}

        ${step(7, this.l("Mulai belajar", "Start learning"), `
          <p>${this.l("Setiap modul memiliki empat bagian, dikerjakan berurutan: <strong>Materi</strong> (baca), <strong>Lab</strong> (tulis kode sampai tes hijau), <strong>Chaos</strong> (pelajari kegagalan produksi nyata), dan <strong>Kuis</strong> (lulus dengan 80%).", "Every module has four parts, done in order: <strong>Lessons</strong> (read), <strong>Lab</strong> (write code until the tests pass), <strong>Chaos</strong> (study a real production failure), and <strong>Quiz</strong> (pass at 80%).")}</p>
          <ul style="margin-left:18px">
            <li>${this.l("Ritme yang disarankan: 5 sampai 8 jam per minggu. Seluruh kursus sekitar 70 minggu; Level 0 saja sekitar 6 sampai 8 minggu.", "Suggested pace: 5 to 8 hours per week. The whole course is about 70 weeks; Level 0 alone is about 6 to 8 weeks.")}</li>
            <li>${this.l("Jangan melompat. Lab adalah inti pembelajaran; membaca saja tidak membuat Anda mampu.", "Do not skip ahead. The lab is the core; reading alone will not make you able.")}</li>
            <li>${this.l("<strong>Setiap sesi belajar dimulai sama:</strong> buka terminal (atau VS Code dengan folder <code>DECourse</code>), lalu <code>cd ~/projects/DECourse</code>. Mulai Modul 0.1 Anda punya venv kursus di folder itu; aktifkan dengan <code>source venv/bin/activate</code> sampai prompt diawali <code>(venv)</code>. Setiap Try it punya tautan <em>📍 Di mana saya mengerjakan ini?</em>, dan tab Lab menyebutkan tempat menjalankan langkahnya.", "<strong>Every study session starts the same way:</strong> open the terminal (or VS Code on the <code>DECourse</code> folder), then <code>cd ~/projects/DECourse</code>. From Module 0.1 on you have a course venv in that folder; activate it with <code>source venv/bin/activate</code> until the prompt starts with <code>(venv)</code>. Every Try it has a <em>📍 Where do I do this?</em> link, and each Lab tab says where to run its steps.")}</li>
            <li>${this.l("Materi bertanda <strong>Opsional</strong> boleh dilewati pada putaran pertama: isinya persiapan kerja, wawancara, atau alat vendor tertentu, dan tidak ada lab yang membutuhkannya. Tombol Lanjutkan otomatis melewatinya; kembalilah sebelum mencari kerja.", "Lessons marked <strong>Optional</strong> can be skipped on your first pass: they cover job preparation, interviews or one vendor's tools, and no lab needs them. The Continue button skips them for you; come back to them before you look for a job.")}</li>
            <li>${this.l("Apa yang dibutuhkan kapan: Level 0 hanya butuh Python dan terminal. Docker opsional di Modul 1.1 dan 2.2, dan diperlukan di 3.2, 3.4, dan 3.5 (serta lab 1.3 jika Python Anda 3.14). Java 17 diperlukan mulai Modul 3.1 untuk Spark, Terraform di 3.4. Baris Prasyarat di setiap modul menyebutkannya persis.", "What you need when: Level 0 needs only Python and a terminal. Docker is optional in Modules 1.1 and 2.2, and needed in 3.2, 3.4 and 3.5 (and for lab 1.3 if your Python is 3.14). Java 17 is needed from Module 3.1 for Spark, Terraform in 3.4. Each module's Prerequisites line says exactly what it needs.")}</li>
            <li>${this.l("Setiap lab diakhiri dengan kode bukti: perintah <code>python3 scripts/prove.py &lt;modul&gt;</code> menjalankan tes di komputer Anda dan mencetak kode yang Anda tempel di halaman lab, bersama penjelasan singkat (minimal 30 kata) dengan kata-kata Anda sendiri tentang bagian tersulit. Modul baru ditandai selesai otomatis setelah kuis lulus dan bukti diterima.", "Every lab ends with a proof code: the command <code>python3 scripts/prove.py &lt;module&gt;</code> runs the tests on your computer and prints a code that you paste on the lab page, together with a short explanation (at least 30 words) in your own words of the hardest part. A module is marked complete automatically once the quiz is passed and the proof is accepted.")}</li>
            <li>${this.l("Tekan Ctrl+K (atau /) kapan saja untuk mencari istilah di seluruh materi.", "Press Ctrl+K (or /) at any time to search every lesson for a term.")}</li>
          </ul>
          <div class="row"><button class="btn btn-primary" onclick="app.go('curriculum','mod-0-0')">${this.l("Mulai Modul 0.0 (Python dari nol)", "Start Module 0.0 (Python from zero)")}</button><button class="btn" onclick="app.go('playground')">${this.l("Coba SQL Sandbox dulu", "Try the SQL Sandbox first")}</button></div>`)}

        <div class="card stack-sm">
          <h2>${this.l("Kalau macet", "If you get stuck")}</h2>
          <ul style="margin-left:18px">
            <li>${this.l("Masalah penyiapan (folder salah, venv tidak aktif, paket atau alat hilang)? Jalankan <code>python3 scripts/doctor.py mod-X-Y</code> dari folder kursus, dengan modul yang sedang Anda kerjakan. Ia memberi tahu persis apa yang harus dijalankan.", "Setup trouble (wrong folder, venv not active, a missing package or tool)? Run <code>python3 scripts/doctor.py mod-X-Y</code> from the course folder, with the module you are on. It tells you exactly what to run.")}</li>
            <li>${this.l("Baca pesan error <strong>dari baris paling bawah</strong>. Jawabannya biasanya di sana (Modul 0.1 melatih ini).", "Read the error message <strong>from the bottom line</strong>. The answer is usually there (Module 0.1 trains this).")}</li>
            <li>${this.l("Coba sendiri minimal 30 menit sebelum melihat folder <code>reference/</code>. Setelah melihat, tutup dan tulis ulang dengan kata-kata Anda sendiri.", "Try for at least 30 minutes before looking at the <code>reference/</code> folder. After looking, close it and write it again in your own words.")}</li>
            <li>${this.l("Asisten AI boleh dipakai untuk penjelasan: tempel pesan error-nya dan tanyakan <em>mengapa</em>, jangan tempel file lab dan meminta solusinya. Kode bukti hanya menolak salinan persis solusi referensi, jadi kejujuran ada di tangan Anda, dan yang Anda tulis sendirilah yang akan Anda ingat saat wawancara.", "An AI assistant is fine for explanations: paste the error and ask <em>why</em>; do not paste the lab file and ask for the solution. The proof code only rejects an exact copy of the reference, so honesty is up to you, and only what you wrote yourself will stay with you in an interview.")}</li>
            <li>${this.l("Jalankan satu tes saja agar pesan error lebih pendek: <code>pytest labs/mod-0-0 -k safe_int -x</code>.", "Run one test only to get a shorter error: <code>pytest labs/mod-0-0 -k safe_int -x</code>.")}</li>
            <li>${this.l("Masih macet? Buka isu di", "Still stuck? Open an issue at")} <a href="${repo}/issues" target="_blank" rel="noopener">${repo.replace("https://", "")}/issues</a> ${this.l("dan sertakan perintah yang Anda jalankan serta pesan error lengkap.", "and include the command you ran and the full error message.")}</li>
          </ul>
          <p class="small muted">${this.l("Tentang kejujuran kursus: semua lab sudah dijalankan terhadap alat aslinya (Spark, Kafka, dbt, Terraform, dan lain-lain) dan solusi referensinya lulus tes. Namun kursus ini belum diuji oleh banyak pemula; jika ada bagian yang membingungkan, tolong laporkan.", "About honesty: every lab has been run against the real tools (Spark, Kafka, dbt, Terraform and others) and its reference solution passes the tests. But the course has not yet been tested with many beginners; if something is confusing, please report it.")}</p>
        </div>
      </div>`;
  }

  setCareerPath(pathId) {
    this.activeCareerPath = pathId;
    writeStore("df_career_path", pathId);
    this.renderView();
  }

  getCareerPaths() {
    return [
      {
        id: "all",
        icon: "🌐",
        title: this.l("Full-Stack Data Engineer (Semua 27 Modul)", "Full-Stack Data Engineer (All 27 Modules)"),
        desc: this.l("Jalur lengkap dari Python/SQL dasar hingga Lakehouse, Spark, Kafka, FinOps, AI RAG & 4 Capstone.", "Complete mastery from zero Python/SQL to Lakehouse, Spark, Kafka, FinOps, AI RAG & 4 Capstones."),
        modules: CURRICULUM_DATA.flatMap((l) => l.modules.map((m) => m.id))
      },
      {
        id: "analytics",
        icon: "📊",
        title: this.l("Analytics & Warehouse Data Engineer", "Analytics & Warehouse Data Engineer"),
        desc: this.l("Fokus pada SQL tingkat lanjut, Kimball/Data Vault, DuckDB, dbt Core, Semantic Layer & Governance.", "Focus on advanced SQL, Kimball/Data Vault, DuckDB, dbt Core, Semantic Layer & Data Governance."),
        modules: ["mod-0-0", "mod-0-2", "mod-0-3", "mod-1-3", "mod-1-4", "mod-2-1", "mod-2-3", "mod-2-5", "mod-2-6", "mod-4-1"]
      },
      {
        id: "streaming",
        icon: "⚡",
        title: this.l("Streaming & Distributed Platform Engineer", "Streaming & Distributed Platform Engineer"),
        desc: this.l("Fokus pada Production Python, API Ingestion, Spark, Kafka KRaft, Debezium CDC & Flink Watermarks.", "Focus on Production Python, API Ingestion, Spark, Kafka KRaft, Debezium CDC & Flink Watermarks."),
        modules: ["mod-0-2", "mod-0-1", "mod-1-1", "mod-1-2", "mod-1-6", "mod-3-0", "mod-3-1", "mod-3-2", "mod-3-3", "mod-4-2", "mod-4-3"]
      },
      {
        id: "ai_lakehouse",
        icon: "🧠",
        title: this.l("Lakehouse, Cloud FinOps & AI Data Engineer", "Lakehouse, Cloud FinOps & AI Data Engineer"),
        desc: this.l("Fokus pada Apache Iceberg, Dagster, DMBOK Privacy/GDPR, Terraform FinOps & pgvector RAG.", "Focus on Apache Iceberg, Dagster, DMBOK Privacy/GDPR, Terraform FinOps & pgvector RAG."),
        modules: ["mod-0-2", "mod-1-7", "mod-2-2", "mod-2-4", "mod-2-5", "mod-3-4", "mod-3-5", "mod-4-4"]
      }
    ];
  }

  toggleSaveTip(tipId, modId, title, text) {
    const idx = (this.savedTips || []).findIndex((t) => t.id === tipId);
    if (idx >= 0) {
      this.savedTips.splice(idx, 1);
    } else {
      this.savedTips.unshift({ id: tipId, modId, title, text, at: new Date().toISOString() });
    }
    writeStore("df_saved_tips", this.savedTips);
    this.renderView();
  }

  // ================= ROADMAP =================
  renderRoadmapView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const allMods = CURRICULUM_DATA.flatMap((l) => l.modules);
    const totalMods = allMods.length;
    const totalLessons = allMods.reduce((s, m) => s + (m.lessons ? m.lessons.length : 0), 0);
    const readLessonsCount = allMods.reduce((s, m) => s + ((this.lessonsDone[m.id] || []).length), 0);
    const tryItCount = Object.keys(this.tryitDone || {}).length;
    const proofCount = allMods.filter((m) => this.proofFor(m.id)).length;
    const sqlSolved = (this.solvedChallenges || []).length;
    const g = this.computeGamificationStats();

    // Career paths & Busuu-style Weak / Medium / Strong skill mastery breakdown
    const careerPaths = this.getCareerPaths();
    const activePathObj = careerPaths.find((p) => p.id === this.activeCareerPath) || careerPaths[0];
    const activePathSet = new Set(activePathObj.modules);

    let strongMods = 0, mediumMods = 0, weakMods = 0;
    const weakModList = [];
    allMods.forEach((m) => {
      const isDone = this.completedModules.includes(m.id);
      const q = this.quizScores[m.id];
      const need = Math.ceil((m.quiz || []).length * 0.8);
      const lRead = (this.lessonsDone[m.id] || []).length;
      if (isDone || (q && q.best >= need && this.proofFor(m.id))) {
        strongMods++;
      } else if ((q && q.best > 0 && q.best < need) || (lRead > 0 && !isDone)) {
        if (q && q.best < need) {
          weakMods++;
          weakModList.push(m);
        } else {
          mediumMods++;
        }
      } else {
        weakMods++;
        if (weakModList.length < 4 && activePathSet.has(m.id)) weakModList.push(m);
      }
    });

    // Determine next recommended module & action (prioritizing active career path)
    const nextMod = allMods.find((m) => activePathSet.has(m.id) && !this.completedModules.includes(m.id))
      || allMods.find((m) => !this.completedModules.includes(m.id))
      || allMods[allMods.length - 1];
    const nextModRead = (this.lessonsDone[nextMod.id] || []).length;
    const nextModTotalLs = (nextMod.lessons || []).length;
    const nextModProof = this.proofFor(nextMod.id);
    const nextModChaos = this.chaosDone[nextMod.id] && this.chaosDone[nextMod.id].done;
    let nextTab = "concepts";
    let nextActionLabel = this.l(`Baca Materi (${nextModRead}/${nextModTotalLs} selesai)`, `Read Lessons (${nextModRead}/${nextModTotalLs} done)`);
    if (nextModRead >= nextModTotalLs && !nextModProof && window.PROOF && window.PROOF[nextMod.id]) {
      nextTab = "lab";
      nextActionLabel = this.l("Kerjakan Lab & Verifikasi Bukti", "Build Lab & Verify Proof");
    } else if (nextModRead >= nextModTotalLs && !nextModChaos) {
      nextTab = "chaos";
      nextActionLabel = this.l("Analisis Skenario Insiden Chaos", "Analyze Chaos Incident");
    } else if (nextModRead >= nextModTotalLs) {
      nextTab = "quiz";
      nextActionLabel = this.l("Selesaikan Kuis Verifikasi (≥80%)", "Pass Verification Quiz (≥80%)");
    }

    const pillars = [1, 2, 3, 4].map((n) => `
      <div class="well">
        <h3>${t["pillar" + n + "Title"]}</h3>
        <p class="muted" style="margin-top:6px">${t["pillar" + n + "Desc"]}</p>
      </div>`).join("");

    // Duolingo-style Color-Graded Section Cards with circular progress rings & unit nodes
    const levels = CURRICULUM_DATA.map((lvl, lvlIdx) => {
      const pathModsInLevel = lvl.modules.filter((m) => activePathSet.has(m.id));
      const modsToShow = pathModsInLevel.length ? pathModsInLevel : lvl.modules;
      const doneCount = modsToShow.filter((m) => this.completedModules.includes(m.id)).length;
      const pct = Math.round((doneCount / modsToShow.length) * 100);
      return `
        <div class="duo-section-card">
          <div class="duo-section-banner tone-${lvlIdx % 5}">
            <div class="row between">
              <span class="chip">${this.esc(this.t(lvl.badge))}</span>
              ${this.renderRingProgress(pct, 42, "#ffffff")}
            </div>
            <h3 style="margin-top:8px">${this.esc(this.t(lvl.levelTitle))}</h3>
            <p class="muted small" style="margin-top:4px">${this.esc(this.t(lvl.levelSubtitle))}</p>
          </div>
          <div class="duo-section-body">
            <div class="duo-unit-nodes">
              ${modsToShow.map((m) => {
                const isDone = this.completedModules.includes(m.id);
                const isCurrent = m.id === nextMod.id;
                const lRead = (this.lessonsDone[m.id] || []).length;
                const lTot = (m.lessons || []).length;
                const hasPrf = Boolean(this.proofFor(m.id));
                const statusHtml = isDone
                  ? `<span class="state-done">✓ ${this.l("Tuntas", "Done")}</span>`
                  : (lRead > 0 || hasPrf)
                    ? `<span class="micro-badge info">${lRead}/${lTot} 📖${hasPrf ? " · 🧪" : ""}</span>`
                    : `<span class="muted small">~${this.readingMinutes(m)}m</span>`;
                return `
                  <button class="duo-node-btn ${isDone ? "is-done" : isCurrent ? "is-current" : ""}" onclick="app.go('curriculum','${m.id}')">
                    <span class="duo-node-circle">${isDone ? "✓" : m.number}</span>
                    <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${isCurrent ? "700" : "500"}">${this.esc(this.t(m.title))}</span>
                    ${statusHtml}
                  </button>`;
              }).join("")}
            </div>
            <button class="btn btn-sm" style="margin-top:6px;width:100%;justify-content:center" onclick="app.selectLevel('${lvl.levelId}')">${t.exploreModules} →</button>
          </div>
        </div>`;
    }).join("");

    const started = readLessonsCount > 0 || this.completedModules.length > 0 || tryItCount > 0 || proofCount > 0 || sqlSolved > 0;
    const nextPct = nextModTotalLs ? Math.round((nextModRead / nextModTotalLs) * 100) : 0;
    const badgesEarned = g.badges.filter((b) => b.unlocked).length;
    const sqlTotal = (window.SQL_PLAYGROUND && SQL_PLAYGROUND.challenges.length) || 59;
    const bugsSolved = Object.values(this.bugState || {}).filter((x) => x && x.solved).length;
    const bugsTotal = (window.PRACTICE_LABS && window.PRACTICE_LABS.SILENT_BUG_DRILLS.length) || 5;
    const reviewList = weakModList.filter((m) => this.quizScores[m.id]).slice(0, 3);

    return `
      <div class="stack">
        ${started ? "" : `
        <div class="card stack-sm">
          <span class="label">${t.roadmapBadge}</span>
          <h1>${t.roadmapHeroTitle}</h1>
          <p class="muted" style="max-width:720px;font-size:15px">${t.roadmapHeroDesc}</p>
          <div class="row" style="padding-top:8px">
            <button class="btn btn-primary" onclick="app.go('start')">${this.l("Mulai di sini: siapkan komputer", "Start here: set up your computer")}</button>
            <button class="btn btn-quiet" onclick="app.go('curriculum')">${t.ctaStartCurriculum}</button>
          </div>
        </div>`}

        <section class="card today-card" aria-labelledby="today-title">
          <div class="today-main stack-sm">
            <span class="label">${started ? this.l("Lanjutkan", "Continue") : this.l("Modul pertama Anda", "Your first module")} · ${this.esc(activePathObj.title)}</span>
            <h2 id="today-title">${nextMod.number} ${this.esc(this.t(nextMod.title))}</h2>
            <p class="muted small">${this.esc(this.t(nextMod.summary))}</p>
            <div class="today-progress">
              <div class="progress"><div style="width:${nextPct}%"></div></div>
              <span class="small muted">${this.l(`${nextModRead} dari ${nextModTotalLs} materi`, `${nextModRead} of ${nextModTotalLs} lessons`)}</span>
            </div>
            <div class="row">
              <button class="btn ${started ? "btn-primary" : ""}" onclick="app.go('curriculum','${nextMod.id}','${nextTab}')">${nextActionLabel} →</button>
            </div>
          </div>
          <div class="today-side stack-sm">
            <div class="row between">
              <span class="label">${this.l("Hari ini", "Today")}</span>
              <span class="gami-pill streak" title="${this.l("Hari berturut-turut Anda belajar", "Days in a row you have studied")}">🔥 ${g.streakDays} ${this.l("hari", g.streakDays === 1 ? "day" : "days")}</span>
            </div>
            <ul class="quest-list">
              ${g.quests.map((q) => {
                const qDone = q.cur >= q.max;
                return `<li><a href="${q.link}" class="${qDone ? "done" : ""}"><span class="quest-check" aria-hidden="true">${qDone ? "✓" : ""}</span><span class="quest-text">${this.esc(q.label)}</span><span class="small muted">${q.cur}/${q.max}</span></a></li>`;
              }).join("")}
            </ul>
            <div class="small muted">⚡ ${g.xp.toLocaleString()} XP · ${this.esc(g.leagueName)} · ${this.l(`${badgesEarned} dari ${g.badges.length} lencana`, `${badgesEarned} of ${g.badges.length} badges`)}</div>
          </div>
        </section>

        <div class="stat-strip" role="list">
          <div role="listitem"><span class="num">${this.completedModules.length}</span><span class="muted small"> / ${totalMods} ${this.l("modul", "modules")}</span></div>
          <div role="listitem"><span class="num">${readLessonsCount}</span><span class="muted small"> / ${totalLessons} ${this.l("materi", "lessons")}</span></div>
          <div role="listitem"><span class="num">${proofCount + tryItCount}</span><span class="muted small"> ${this.l("bukti lab & Try-it", "lab proofs & Try-its")}</span></div>
          <div role="listitem"><span class="num">${sqlSolved}</span><span class="muted small"> / ${sqlTotal} ${this.l("tantangan SQL", "SQL challenges")}</span></div>
        </div>

        <section class="stack-sm" aria-labelledby="levels-title">
          <div class="row between">
            <h2 id="levels-title">${t.matrixTitle}</h2>
            ${this.activeCareerPath !== "all" ? `<button class="btn btn-sm btn-quiet" onclick="app.setCareerPath('all')">${this.l("Tampilkan semua modul", "Show all modules")}</button>` : ""}
          </div>
          <div class="path-picker" role="group" aria-label="${this.l("Jalur karier", "Career path")}">
            ${careerPaths.map((cp) => {
              const cpDone = cp.modules.filter((id) => this.completedModules.includes(id)).length;
              const isSelected = cp.id === this.activeCareerPath;
              return `<button class="${isSelected ? "active" : ""}" aria-pressed="${isSelected}" onclick="app.setCareerPath('${cp.id}')" title="${this.esc(cp.desc)}"><span aria-hidden="true">${cp.icon}</span> ${this.esc(cp.title)} <span class="muted small">${cpDone}/${cp.modules.length}</span></button>`;
            }).join("")}
          </div>
          <div class="grid cols-3">${levels}</div>
        </section>

        <section class="stack-sm" aria-labelledby="practice-title">
          <h2 id="practice-title">${this.l("Latihan di luar modul", "Practice beyond the modules")}</h2>
          <div class="grid cols-3">
            <button class="card practice-card" onclick="app.go('interview','silent-bugs')">
              <span class="label">${this.l("Klinik bug diam-diam", "Silent bug clinic")} · ${bugsSolved}/${bugsTotal}</span>
              <strong>${this.l("Temukan bug yang tidak memunculkan error", "Find bugs that raise no error")}</strong>
              <span class="muted small">${this.l("Bug paling berbahaya selesai dengan kode 0 lalu diam-diam menggandakan revenue atau membuang baris.", "The worst bugs exit with code 0, then quietly double revenue or drop rows.")}</span>
            </button>
            <button class="card practice-card" onclick="app.go('interview','active-recall')">
              <span class="label">${this.l("Mengingat aktif", "Active recall")} · ${Object.keys(this.recallState || {}).length} ${this.l("diulas", "reviewed")}</span>
              <strong>${this.l("Ingat dulu, baru lihat jawabannya", "Recall first, then look")}</strong>
              <span class="muted small">${this.l("Kartu model mental inti setiap modul, untuk ingatan jangka panjang.", "The key mental model of every module, for long-term memory.")}</span>
            </button>
            <button class="card practice-card" onclick="app.go('curriculum','mod-0-2','concepts')">
              <span class="label">${this.l("Simulator", "Simulators")}</span>
              <strong>${this.l("Geser angkanya, lihat sistemnya berubah", "Move a number, watch the system change")}</strong>
              <span class="muted small">${this.l("Kematangan data, join fan-out, partition pruning, watermark, retry, PII. Ada di dalam modul terkait.", "Data maturity, join fan-out, partition pruning, watermarks, retries, PII. Inside the related modules.")}</span>
            </button>
          </div>
          ${reviewList.length ? `
          <div class="well row">
            <span class="small muted">${this.l("Ulangi kuis yang belum lulus:", "Retake the quizzes you have not passed yet:")}</span>
            ${reviewList.map((wm) => `<button class="btn btn-sm btn-quiet" onclick="app.go('curriculum','${wm.id}','quiz')">${wm.number} ${this.esc(this.t(wm.title))}</button>`).join("")}
          </div>` : ""}
          ${(this.savedTips || []).length ? `
          <details class="well">
            <summary class="small" style="cursor:pointer;font-weight:600">${this.l(`Tips kuis yang Anda simpan (${this.savedTips.length})`, `Quiz tips you saved (${this.savedTips.length})`)}</summary>
            <div class="stack-sm" style="margin-top:8px">
              ${this.savedTips.map((tip) => `
                <div class="row between" style="padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius)">
                  <div style="flex:1">
                    <a href="#/curriculum/${this.esc(tip.modId)}/concepts" class="small" style="font-weight:700">${this.esc(tip.title)}</a>
                    <div class="small muted" style="margin-top:2px">${this.inline(tip.text)}</div>
                  </div>
                  <button class="btn btn-sm btn-quiet" aria-label="${this.l("Hapus tips", "Remove tip")}" onclick="app.toggleSaveTip('${this.esc(tip.id)}')">✕</button>
                </div>`).join("")}
            </div>
          </details>` : ""}
        </section>

        <details class="card fold">
          <summary><span>${this.l("Lencana", "Badges")}</span><span class="muted small">${this.l(`${badgesEarned} dari ${g.badges.length} diraih`, `${badgesEarned} of ${g.badges.length} earned`)}</span></summary>
          <div class="grid cols-2" style="margin-top:12px">
            ${g.badges.map((b) => `
              <div class="badge-row ${b.unlocked ? "earned" : ""}">
                <span class="badge-icon" aria-hidden="true">${b.icon}</span>
                <div><div style="font-weight:600">${this.esc(b.name)}</div><div class="small muted">${this.esc(b.desc)}</div></div>
                <span class="small ${b.unlocked ? "" : "muted"}">${b.unlocked ? "✓ " + this.l("Diraih", "Earned") : this.l("Belum", "Not yet")}</span>
              </div>`).join("")}
          </div>
        </details>

        <details class="card fold">
          <summary><span>${this.l("Cara kursus ini bekerja", "How this course works")}</span></summary>
          <div class="grid cols-4" style="margin-top:12px">${pillars}</div>
        </details>
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

    const activeLevels = CURRICULUM_DATA.filter((lvl) => lvl.modules.length);
    const allMods = CURRICULUM_DATA.flatMap((l) => l.modules);
    const modGlobalIdx = allMods.findIndex((m) => m.id === mod.id);
    const prevMod = modGlobalIdx > 0 ? allMods[modGlobalIdx - 1] : null;
    const nextMod = modGlobalIdx >= 0 && modGlobalIdx < allMods.length - 1 ? allMods[modGlobalIdx + 1] : null;

    // 4-step pipeline stats for current module
    const readCount = (this.lessonsDone[mod.id] || []).length;
    const totalLessons = (mod.lessons || []).length;
    const tryItStats = this.moduleTryItStats(mod);
    const hasProof = Boolean(this.proofFor(mod.id));
    const blDone = readStore("df_browser_labs", {}) || {};
    const blPassed = Boolean(blDone[mod.id]) && (!(window.BROWSER_LABS && window.BROWSER_LABS[mod.id + "a"]) || Boolean(blDone[mod.id + "a"]));
    const isChaosDone = Boolean(this.chaosDone[mod.id] && this.chaosDone[mod.id].done);
    const quizScore = this.quizScores[mod.id];
    const quizNeed = Math.ceil((mod.quiz || []).length * 0.8);
    const isQuizPassed = Boolean(quizScore && quizScore.best >= quizNeed);
    const inLesson = this.activeModuleTab === "concepts" && this.activeLessonIdx != null && this.activeLessonIdx < (mod.lessons || []).length;
    const noteText = this.moduleNotes[mod.id] || "";

    return `
      <div class="split ${this.focusMode ? "is-focus-mode" : ""}">
        <aside class="stack-sm">
          <div class="level-nav-grid" role="tablist" aria-label="${this.l("Pilih Level", "Select Level")}">
            ${activeLevels.map((lvl, idx) => {
              const isLastOdd = idx === activeLevels.length - 1 && activeLevels.length % 2 !== 0;
              const isActive = lvl.levelId === level.levelId;
              return `
                <button role="tab" aria-selected="${isActive}" class="level-nav-btn ${isLastOdd ? "level-nav-wide" : ""} ${isActive ? "active" : ""}" onclick="app.go('curriculum','${lvl.modules[0].id}')" title="${this.esc(this.t(lvl.levelTitle))}">
                  <span class="level-tag">L${idx}</span>
                  <span class="level-label">${this.esc(this.t(lvl.badge))}</span>
                </button>`;
            }).join("")}
          </div>
          <div class="muted small" style="padding:4px 2px">${this.esc(this.t(level.levelTitle))}</div>
          ${level.modules.map((m) => {
            const mDone = this.completedModules.includes(m.id);
            const mRead = (this.lessonsDone[m.id] || []).length;
            const mTot = (m.lessons || []).length;
            const mPrf = Boolean(this.proofFor(m.id));
            const mQz = this.quizScores[m.id];
            const mNote = Boolean(this.moduleNotes[m.id]);
            const isCur = m.id === mod.id;
            const open = this.sideOpen[m.id] !== undefined ? this.sideOpen[m.id] : isCur;
            const parts = this.moduleParts(m);
            const lessonList = open && mTot ? `<div class="side-lessons" id="side-lessons-${m.id}">${(m.lessons || []).map((ls, i) => {
              const pt = parts.find((x) => x.start === i);
              const read = this.isLessonDone(m.id, i);
              const here = isCur && this.activeModuleTab === "concepts" && this.activeLessonIdx === i;
              return `${pt ? `<div class="side-part">${this.l("Bagian", "Part")} ${pt.k + 1} · ${this.esc(this.t(pt.title))}</div>` : ""}<button class="side-lesson ${read ? "read" : ""} ${here ? "here" : ""}" onclick="app.openLesson('${m.id}', ${i})" ${here ? 'aria-current="page"' : ""}><span class="side-mark" aria-hidden="true">${read ? "✓" : ""}</span><span class="side-num">${i + 1}.</span><span class="side-title">${this.esc(this.t(ls.title))}${ls.optional ? ` <span class="side-opt">${this.l("opsional", "optional")}</span>` : ""}</span><span class="sr-only">${read ? this.l(" (selesai)", " (done)") : ""}</span></button>`;
            }).join("")}</div>` : "";
            return `
              <div class="mod-nav ${open ? "open" : ""}">
                <button class="item mod-nav-card ${m.id === mod.id ? "active" : ""}" onclick="app.go('curriculum','${m.id}')">
                <div class="module-row">
                  <div>
                    <div class="item-title"><span class="module-num">${m.number}</span>${this.esc(this.t(m.title))}</div>
                    <div class="item-meta">${this.esc(this.t(m.duration))} · ~${this.readingMinutes(m)}m</div>
                    <div class="micro-badges">
                      <span class="micro-badge ${mRead === mTot && mTot > 0 ? "ok" : ""}" title="${this.l("Materi dibaca", "Lessons read")}">📖 ${mRead}/${mTot}</span>
                      ${mPrf ? `<span class="micro-badge ok" title="${this.l("Bukti lab terverifikasi", "Lab proof verified")}">🧪 ${this.l("Bukti", "Proof")}</span>` : ""}
                      ${mQz ? `<span class="micro-badge ${mQz.best >= Math.ceil(m.quiz.length * 0.8) ? "ok" : "info"}" title="${this.l("Skor kuis terbaik", "Best quiz score")}">🎯 ${mQz.best}/${mQz.total}</span>` : ""}
                      ${mNote ? `<span class="micro-badge info" title="${this.l("Ada catatan pribadi", "Has study notes")}">📝</span>` : ""}
                    </div>
                  </div>
                  ${mDone ? `<span class="state-done">✓ ${this.l("Selesai", "Done")}</span>` : ""}
                </div>
              </button>
                ${mTot ? `<button class="side-toggle" onclick="app.toggleSideLessons('${m.id}', ${open})" aria-expanded="${open}" aria-controls="side-lessons-${m.id}" title="${open ? this.l("Sembunyikan daftar materi", "Hide the lessons") : this.l("Tampilkan daftar materi", "Show the lessons")}">${open ? "▾" : "▸"} <span>${open ? this.l("Sembunyikan materi", "Hide lessons") : this.l(`${mTot} materi`, `${mTot} lessons`)}</span></button>` : ""}
                ${lessonList}
              </div>`;
          }).join("")}
        </aside>

        <section class="stack">
          <div class="card stack-sm">
            <!-- Mobile/Tablet Compact Module Switcher (hidden on desktop) -->
            <details class="mobile-mod-picker no-print">
              <summary>
                <span>📚 ${this.esc(this.t(level.badge))} · <strong>${mod.number} ${this.esc(this.t(mod.title))}</strong></span>
                <span class="small muted">${this.l("Ganti modul", "Switch module")}</span>
              </summary>
              <div class="stack-sm" style="margin-top:10px">
                <div class="row" style="gap:4px;flex-wrap:wrap">
                  ${activeLevels.map((lvl, idx) => `
                    <button class="btn btn-sm ${lvl.levelId === level.levelId ? "btn-primary" : "btn-quiet"}" onclick="app.go('curriculum','${lvl.modules[0].id}')">L${idx}: ${this.esc(this.t(lvl.badge))}</button>`).join("")}
                </div>
                <div class="stack-sm" style="max-height:240px;overflow-y:auto;padding-top:4px">
                  ${level.modules.map((m) => `
                    <button class="btn btn-sm ${m.id === mod.id ? "btn-primary" : "btn-quiet"}" style="justify-content:space-between;width:100%" onclick="app.go('curriculum','${m.id}')">
                      <span>${m.number} ${this.esc(this.t(m.title))}</span>
                      <span>${this.completedModules.includes(m.id) ? "✓" : `${(this.lessonsDone[m.id] || []).length}/${(m.lessons || []).length}`}</span>
                    </button>`).join("")}
                </div>
              </div>
            </details>

            <div class="row between">
              <span class="muted small">${this.esc(this.t(level.badge))} · ${this.esc(this.t(mod.duration))} · ~${this.readingMinutes(mod)} ${this.l("menit baca", "min read")}</span>
              <div class="row">
                <button class="btn btn-sm ${this.focusMode ? "btn-done" : "btn-quiet"}" onclick="app.toggleFocusMode()" title="${this.l("Sembunyikan daftar modul di kiri agar fokus membaca", "Hide the left module sidebar for distraction-free reading")}">
                  🎯 ${this.focusMode ? this.l("Keluar Mode Fokus", "Exit Focus Mode") : this.l("Mode Fokus", "Focus Mode")}
                </button>
                ${hasProof ? `<span class="state-done" title="${this.l("Bukti lab terverifikasi", "Lab proof verified")}">✓ ${this.l("Bukti lab", "Lab proof")}</span>` : ""}
                <button class="btn btn-sm ${done ? "btn-done" : "btn-quiet"}" onclick="app.toggleModuleCompletion('${mod.id}')">${done ? t.btnMarkedComplete : t.btnMarkComplete}</button>
              </div>
            </div>
            <h1>${mod.number} ${this.esc(this.t(mod.title))}</h1>
            ${inLesson ? "" : `<p class="muted">${this.esc(this.t(mod.summary))}</p>`}
            ${mod.idPending && this.lang === "id" ? `<div class="callout"><p>Modul ini belum diterjemahkan ke bahasa Indonesia, jadi ditampilkan dalam bahasa Inggris.</p></div>` : ""}
            ${inLesson ? "" : `<details class="callout neutral fold-callout" ${readCount === 0 && !this.focusMode ? "open" : ""}>
              <summary class="label">${t.whyTutorialsLieHeader}</summary>
              <p>${this.esc(this.t(mod.whyTutorialsLie))}</p>
            </details>`}

            <!-- 4-Step Module Mastery Pipeline -->
            <div class="mastery-pipeline" role="tablist" aria-label="${this.l("Bagian modul", "Module sections")}">
              <button role="tab" id="tab-concepts" aria-selected="${this.activeModuleTab === "concepts"}" aria-controls="tabpanel" class="pipeline-step ${this.activeModuleTab === "concepts" ? "active" : ""} ${readCount === totalLessons && totalLessons > 0 ? "done" : ""}" onclick="app.go('curriculum','${mod.id}','concepts')">
                <div class="step-top">
                  <span>1. ${this.l("Materi & Praktik", "Lessons & Try-It")}</span>
                  <span class="step-status">${readCount === totalLessons && totalLessons > 0 ? "✓" : `${readCount}/${totalLessons}`}</span>
                </div>
                <div class="step-sub">${this.l(`${readCount} dari ${totalLessons} materi dibaca`, `${readCount} of ${totalLessons} lessons read`)}${tryItStats.total ? ` · ${tryItStats.done}/${tryItStats.total} 🛠` : ""}</div>
              </button>
              <button role="tab" id="tab-lab" aria-selected="${this.activeModuleTab === "lab"}" aria-controls="tabpanel" class="pipeline-step ${this.activeModuleTab === "lab" ? "active" : ""} ${hasProof ? "done" : ""}" onclick="app.go('curriculum','${mod.id}','lab')">
                <div class="step-top">
                  <span>2. ${this.l("Lab & Bukti", "Build Lab & Prove")}</span>
                  <span class="step-status">${hasProof ? "✓" : blPassed ? "⚡" : "○"}</span>
                </div>
                <div class="step-sub">${hasProof ? this.l("Bukti lokal terverifikasi", "Local proof verified") : blPassed ? this.l("Pratinjau lulus · perlu bukti", "Preview passed · need proof") : this.l("Tulis kode & jalankan pytest", "Write code & run pytest")}</div>
              </button>
              <button role="tab" id="tab-chaos" aria-selected="${this.activeModuleTab === "chaos"}" aria-controls="tabpanel" class="pipeline-step ${this.activeModuleTab === "chaos" ? "active" : ""} ${isChaosDone ? "done" : ""}" onclick="app.go('curriculum','${mod.id}','chaos')">
                <div class="step-top">
                  <span>3. ${this.l("Insiden Chaos", "Chaos Incident")}</span>
                  <span class="step-status">${isChaosDone ? "✓" : "○"}</span>
                </div>
                <div class="step-sub">${isChaosDone ? this.l("Akar masalah dianalisis", "Root cause analyzed") : this.l("Bedah kegagalan produksi", "Debug production failure")}</div>
              </button>
              <button role="tab" id="tab-quiz" aria-selected="${this.activeModuleTab === "quiz"}" aria-controls="tabpanel" class="pipeline-step ${this.activeModuleTab === "quiz" ? "active" : ""} ${isQuizPassed ? "done" : ""}" onclick="app.go('curriculum','${mod.id}','quiz')">
                <div class="step-top">
                  <span>4. ${this.l("Kuis Verifikasi", "Verification Quiz")}</span>
                  <span class="step-status">${isQuizPassed ? "✓" : quizScore ? `${quizScore.best}/${quizScore.total}` : "○"}</span>
                </div>
                <div class="step-sub">${quizScore ? this.l(`Skor terbaik: ${quizScore.best}/${quizScore.total} (butuh ${quizNeed})`, `Best: ${quizScore.best}/${quizScore.total} (need ${quizNeed})`) : this.l(`Jawab ≥${quizNeed}/${mod.quiz.length} benar`, `Pass with ≥${quizNeed}/${mod.quiz.length}`)}</div>
              </button>
            </div>

            ${this.activeModuleTab === "concepts" && !inLesson && readCount === 0 && !isQuizPassed && (mod.quiz || []).length ? `
            <div class="callout neutral skip-hint">
              <p><strong>${this.l("Sudah menguasai topik ini?", "Already know this topic?")}</strong> ${this.l(`Kerjakan kuisnya dulu sebagai tes penempatan. Jika Anda lulus (≥${quizNeed}/${mod.quiz.length}), boleh melewati bacaan dan langsung ke Lab; lab dan kode buktinya tetap wajib, karena itulah yang membuktikan Anda bisa. Jika belum lulus, penjelasan di setiap jawaban menunjukkan pelajaran mana yang perlu dibaca.`, `Take the quiz first as a placement test. If you pass (≥${quizNeed}/${mod.quiz.length}), you may skip the reading and go straight to the Lab; the lab and its proof code are still required, because they are what shows you can do it. If you do not pass, the explanation under each answer points to the lesson to read.`)}</p>
              <button class="btn btn-sm" onclick="app.go('curriculum','${mod.id}','quiz')">${this.l("Kerjakan kuis dulu", "Take the quiz first")} →</button>
            </div>` : ""}

            <!-- Personal Study Notes Drawer -->
            <details class="notes-drawer" ${noteText ? "" : ""}>
              <summary>
                <span>📝 ${this.l("Catatan saya", "My notes")} <span class="muted small" style="font-weight:400">${this.l("· tersimpan otomatis di browser ini", "· saved automatically in this browser")}</span></span>
                <span class="muted small">${noteText ? `✓ ${this.l("Ada catatan", "Saved")}` : this.l("Klik untuk menulis catatan", "Click to add notes")}</span>
              </summary>
              <textarea class="notes-textarea" placeholder="${this.l("Tulis model mental, perintah terminal penting, atau pertanyaan Anda untuk modul ini… (ikut terekspor saat Anda klik Ekspor Progres)", "Write down your mental models, key commands, or questions for this module… (included when you Export Progress)")}" oninput="app.saveModuleNote('${mod.id}', this.value)">${this.esc(noteText)}</textarea>
            </details>

            <div class="stack" id="tabpanel" role="tabpanel" aria-labelledby="tab-${this.activeModuleTab}" style="padding-top:8px">${this.renderModuleTabContent(mod, t)}</div>

            <!-- Module-to-Module Footer Navigation -->
            <div class="row between" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
              ${prevMod ? `<button class="btn btn-sm btn-quiet" onclick="app.go('curriculum','${prevMod.id}')">← ${prevMod.number} ${this.esc(this.t(prevMod.title))}</button>` : "<span></span>"}
              ${nextMod ? `<button class="btn btn-sm btn-quiet" onclick="app.go('curriculum','${nextMod.id}')">${nextMod.number} ${this.esc(this.t(nextMod.title))} →</button>` : ""}
            </div>
          </div>
        </section>
      </div>`;
  }

  readingMinutes(mod) {
    const w = mod.lessons.reduce((n, l) => n + (String(this.t(l.body)).match(/\S+/g) || []).length, 0);
    return Math.max(1, Math.round(w / 200));
  }

  toggleSideLessons(modId, isOpen) {
    this.sideOpen[modId] = !isOpen;
    this.renderView();
  }
  // Parts group a module's lessons for display ("## @part" in the lesson files); lesson numbers stay the same.
  moduleParts(mod) {
    const parts = mod.parts || [];
    return parts.map((pt, k) => ({ k, title: pt.title, start: pt.start, end: (k + 1 < parts.length ? parts[k + 1].start : mod.lessons.length) - 1 }));
  }
  partOf(mod, i) { return this.moduleParts(mod).find((pt) => i >= pt.start && i <= pt.end) || null; }
  // One lesson per screen: the address carries the lesson number, so Back, links and search results work.
  // ---------- step mode: one small idea per screen ----------
  levelIdOfModule(modId) {
    const lvl = CURRICULUM_DATA.find((l) => l.modules.some((m) => m.id === modId));
    return lvl ? lvl.levelId : "";
  }
  usesSteps(modId) {
    if (!window.LessonSteps) return false;
    if (this.stepMode === "steps") return true;
    if (this.stepMode === "page") return false;
    return ["zero", "beginner"].includes(this.levelIdOfModule(modId));   // a beginner starts with steps; anyone can switch, and the choice is remembered
  }
  lessonSteps(mod, i, ls) {
    const key = `${mod.id}:${i}:${this.lang}`;
    if (!this.stepCache[key]) this.stepCache[key] = window.LessonSteps.split(this.lessonBody(ls));
    return this.stepCache[key];
  }
  stepIndex(modId, i, n) {
    const k = Number(this.stepPos[`${modId}:${i}`]) || 0;
    return Math.min(Math.max(0, k), n - 1);
  }
  stepKeyTarget() {
    const c = this._stepCtx;
    if (!c || this.currentView !== "curriculum" || this.activeModuleTab !== "concepts") return null;
    if (c.modId !== this.activeModuleId || c.i !== this.activeLessonIdx) return null;
    return c;
  }
  stepGo(modId, i, k) {
    const c = this._stepCtx;
    const n = c && c.modId === modId && c.i === i ? c.n : 0;
    if (!n) return;
    const next = Math.min(Math.max(0, k), n - 1);
    if (next === c.k) return;
    this.stepPos[`${modId}:${i}`] = next;
    writeStore("df_step_pos", this.stepPos);
    this.renderView();
    this.stepAnchor(i);
  }
  // Every step starts at the same place on screen (the top of the lesson card), whatever its height, so the page does not jump
  // when a short step follows a long one, and Back/Next stay where the thumb or the mouse already is.
  stepAnchor(i) {
    const put = () => { const card = document.getElementById(`lesson-${i}`) || document.querySelector(".lesson-card"); if (card) card.scrollIntoView({ block: "start", behavior: "instant" }); };
    put();
    requestAnimationFrame(put);   // once more after layout settles (fonts, folded sections)
  }
  setStepMode(mode) {
    this.stepMode = mode;
    writeStore("df_step_mode", mode);
    this.renderView();
    this.stepAnchor(this.activeLessonIdx);
  }

  openLesson(modId, i) { this.go("curriculum", modId, "concepts", String(i + 1)); }
  openModuleOverview(modId) { this.go("curriculum", modId, "concepts"); }
  scrollToLesson(i) { this.openLesson(this.activeModuleId, i); }
  // Mark a lesson done (never un-mark it) and move on: to the next lesson, or to the given tab after the last one.
  finishLesson(modId, i, nextTab) {
    if (this.stepPos[`${modId}:${i}`] != null) { delete this.stepPos[`${modId}:${i}`]; writeStore("df_step_pos", this.stepPos); }
    if (!this.isLessonDone(modId, i)) this.toggleLessonDone(modId, i, false);
    if (nextTab) this.go("curriculum", modId, nextTab);
    else this.openLesson(modId, i + 1);
  }

  renderModuleTabContent(mod, t) {
    const nav = (back, next) => `
      <div class="row between">
        ${back ? `<button class="btn btn-quiet" onclick="app.go('curriculum','${mod.id}','${back[0]}')">← ${back[1]}</button>` : "<span></span>"}
        ${next ? `<button class="btn btn-primary" onclick="app.go('curriculum','${mod.id}','${next[0]}')">${next[1]} →</button>` : ""}
      </div>`;
    const plainTab = (k) => this.tr(k).replace(/^\d\.\s*/, "");

    if (this.activeModuleTab === "concepts") {
      const readCount = (this.lessonsDone[mod.id] || []).length;
      const totalLessons = mod.lessons.length;
      const pctRead = totalLessons ? Math.round((readCount / totalLessons) * 100) : 0;
      const hasUnread = readCount < totalLessons;
      // the prerequisites text may end with a quoted note ("> [!IMPORTANT] ..."): keep the sentence inline, show the note as a callout
      const prereqRaw = mod.prerequisites ? this.t(mod.prerequisites) : "";
      const noteAt = prereqRaw.search(/^>/m);
      const prereqText = (noteAt < 0 ? prereqRaw : prereqRaw.slice(0, noteAt)).trim();
      const prereqNote = noteAt < 0 ? "" : prereqRaw.slice(noteAt).trim();

      const lessonIdx = this.activeLessonIdx != null && this.activeLessonIdx < totalLessons ? this.activeLessonIdx : null;
      const nextUnread = this.nextLessonIdx(mod);

      // ---------- one lesson on screen ----------
      if (lessonIdx != null) {
        const i = lessonIdx, ls = mod.lessons[i];
        const isRead = this.isLessonDone(mod.id, i);
        const isLast = i === totalLessons - 1;
        const lessonAnims = this.getAnimsForLesson(mod.id, i);
        const part = this.partOf(mod, i);
        const dots = mod.lessons.map((l2, k) => `${k > 0 && this.moduleParts(mod).some((pt) => pt.start === k) ? '<span class="lesson-dot-gap" aria-hidden="true"></span>' : ""}<button class="lesson-dot ${k === i ? "current" : ""} ${this.isLessonDone(mod.id, k) ? "read" : ""}" onclick="app.openLesson('${mod.id}', ${k})" aria-label="${this.l("Materi", "Lesson")} ${k + 1}: ${this.esc(this.t(l2.title))}${this.isLessonDone(mod.id, k) ? this.l(" (selesai)", " (done)") : ""}" ${k === i ? 'aria-current="step"' : ""}>${k + 1}</button>`).join("");
        const nextLabel = isLast
          ? this.l("Selesai, lanjut ke Lab", "Done, continue to the Lab")
          : isRead ? `${this.l("Materi", "Lesson")} ${i + 2}` : this.l(`Selesai, lanjut ke materi ${i + 2}`, `Done, next: lesson ${i + 2}`);
        const nextAction = isLast ? `app.finishLesson('${mod.id}', ${i}, 'lab')` : `app.finishLesson('${mod.id}', ${i})`;
        // step mode: the lesson body is shown one small step at a time (a lesson with one step stays a page)
        const allSteps = this.usesSteps(mod.id) ? this.lessonSteps(mod, i, ls) : null;
        const hasLab = Boolean(this.lessonLabFor(mod.id, i));
        // the lesson's lab step is the last step: it is where the learner writes the code and runs its tests
        const steps = allSteps && allSteps.length > 1 ? (hasLab ? [...allSteps, { kind: "lab", text: "", tryitStart: 0 }] : allSteps) : null;
        const stepK = steps ? this.stepIndex(mod.id, i, steps.length) : 0;
        this._stepCtx = steps ? { modId: mod.id, i, k: stepK, n: steps.length } : null;
        const stepLast = steps ? stepK === steps.length - 1 : true;
        // a lesson with a lab checkpoint sends the learner to the lab first; skipping to the next lesson stays possible
        const pause = !isLast ? this.pauseOf(mod, i) : null;
        const inlineLab = !isLast ? this.lessonLabFor(mod.id, i) : null;
        const labState = inlineLab ? this.labCheckOf(mod.id, i) : null;
        const endButtons = inlineLab
          ? (labState && labState.done
            ? `<button class="btn btn-primary" onclick="${nextAction}">✓ ${this.l(`Lab lulus, lanjut ke materi ${i + 2}`, `Lab step passed, next: lesson ${i + 2}`)} →</button>`
            : `<button class="btn btn-quiet" onclick="${nextAction}">${this.l("Lewati lab, ke materi", "Skip the lab, next lesson")} ${i + 2}</button>
               <button class="btn btn-primary" disabled title="${this.l("Terbuka setelah tes lab langkah ini lulus", "Unlocks when this lab step's tests pass")}">🔒 ${this.l("Lulus lab di atas untuk lanjut", "Pass the lab step above to continue")}</button>`)
          : pause
          ? `<button class="btn btn-quiet" onclick="${nextAction}">${this.l("Lewati lab, ke materi", "Skip the lab, next lesson")} ${i + 2}</button>
             <button class="btn btn-primary" onclick="app.lessonToLab('${mod.id}', ${i}${pause.part ? `, '${pause.part}'` : ", ''"}, true)">🧪 ${this.l("Latihan di lab dulu", "Practise in the lab now")} →</button>`
          : `<button class="btn btn-primary" onclick="${nextAction}">${isRead && !isLast ? "" : "✓ "}${nextLabel} →</button>`;
        const stepBody = steps ? (() => {
          const st = steps[stepK], n = steps.length;
          const turn = st.kind === "turn" || st.kind === "lab" || st.kind === "drill";
          const drillLocked = st.kind === "drill" && !this.drillDone(`${mod.id}:${i}:${st.drillStart}`);
          const dotsHtml = n <= 16 ? `<span class="step-dots">${steps.map((sx, j) => `<button class="step-dot ${j === stepK ? "current" : ""} ${j < stepK ? "past" : ""} ${sx.kind === "turn" || sx.kind === "lab" || sx.kind === "drill" ? "turn" : ""}" onclick="app.stepGo('${mod.id}', ${i}, ${j})" aria-label="${this.l("Langkah", "Step")} ${j + 1}${sx.kind === "turn" || sx.kind === "lab" || sx.kind === "drill" ? this.l(" (giliranmu)", " (your turn)") : ""}" ${j === stepK ? 'aria-current="step"' : ""}></button>`).join("")}</span>` : "";
          const back = stepK > 0
            ? `<button class="btn btn-quiet" onclick="app.stepGo('${mod.id}', ${i}, ${stepK - 1})">← ${this.l("Kembali", "Back")}</button>`
            : i > 0 ? `<button class="btn btn-quiet" onclick="app.openLesson('${mod.id}', ${i - 1})">← ${this.l("Materi", "Lesson")} ${i}</button>` : `<button class="btn btn-quiet" onclick="app.openModuleOverview('${mod.id}')">☰ ${this.l("Peta materi", "Lesson map")}</button>`;
          const forward = stepLast
            ? endButtons
            : drillLocked
              ? `<button class="btn btn-quiet" onclick="app.stepGo('${mod.id}', ${i}, ${stepK + 1})">${this.l("Lewati latihan", "Skip the drill")}</button><button class="btn btn-primary" disabled title="${this.l("Terbuka setelah semua pemeriksaan lulus, atau setelah Anda melihat jawabannya", "Unlocks when every check passes, or after you look at the solution")}">🔒 ${this.l("Selesaikan latihan untuk lanjut", "Pass the drill to continue")}</button>`
              : `<button class="btn btn-primary" onclick="app.stepGo('${mod.id}', ${i}, ${stepK + 1})">${turn ? this.l("Sudah, lanjut", "Done, next") : this.l("Lanjut", "Next")} →</button>`;
          return `
          <div class="step-progress" role="group" aria-label="${this.l("Langkah dalam materi ini", "Steps in this lesson")}">
            <span class="step-count">${this.l("Langkah", "Step")} <strong>${stepK + 1}</strong> ${this.l("dari", "of")} ${n}</span>
            ${dotsHtml}
            <span class="step-bar" aria-hidden="true"><span style="width:${Math.round(((stepK + 1) / n) * 100)}%"></span></span>
          </div>
          <div class="step-card ${turn ? "step-turn" : ""}" key="step-${i}-${stepK}">
            ${turn ? `<div class="step-turn-tag">${st.kind === "lab" ? "🧪 " + this.l("Lab: tulis kodenya, jalankan tesnya", "Lab: write the code, run its tests") : "✋ " + this.l("Giliranmu: berhenti dan coba", "Your turn: stop and try it")}</div>` : ""}
            ${st.kind === "lab" ? this.lessonLabHtml(mod.id, i) : this.md(st.text, { modId: mod.id, lessonIdx: i, tryitStart: st.tryitStart, drillStart: st.drillStart })}
          </div>
          <div class="step-nav">${back}${forward}</div>`;
        })() : "";
        const modeToggle = steps
          ? `<button class="btn btn-sm btn-quiet" onclick="app.setStepMode('page')" title="${this.l("Tampilkan seluruh materi dalam satu halaman", "Show the whole lesson on one page")}">📖 ${this.l("Baca satu halaman", "Read as one page")}</button>`
          : allSteps === null && window.LessonSteps && this.lessonSteps(mod, i, ls).length > 1
            ? `<button class="btn btn-sm btn-quiet" onclick="app.setStepMode('steps')" title="${this.l("Satu ide kecil per layar", "One small idea per screen")}">🪜 ${this.l("Langkah demi langkah", "Step by step")}</button>`
            : "";
        return `
        <nav class="lesson-bar" aria-label="${this.l("Navigasi materi", "Lesson navigation")}">
          <button class="btn btn-sm btn-quiet" onclick="app.openModuleOverview('${mod.id}')">☰ ${this.l("Peta materi", "Lesson map")}</button>
          <span class="lesson-bar-pos">${part ? `<span class="lesson-bar-part">${this.l("Bagian", "Part")} ${part.k + 1}: ${this.esc(this.t(part.title))}</span>` : ""}${this.l("Materi", "Lesson")} <strong>${i + 1}</strong> ${this.l("dari", "of")} ${totalLessons} · ~${this.lessonMinutes(ls)} ${this.l("menit", "min")} ${this.optionalBadge(ls)}</span>
          <div class="lesson-dots">${dots}</div>
        </nav>
        <section class="lesson lesson-card ${isRead ? "lesson-done" : ""}" id="lesson-${i}">
          <div class="lesson-head">
            <h2 class="row" style="flex-wrap:nowrap;align-items:flex-start;margin:0">
              <span class="number-dot" style="margin-top:2px">${i + 1}</span>
              <span>${this.esc(this.t(ls.title))}</span>
            </h2>
            <div class="row" style="flex-shrink:0">
              ${modeToggle}
              <button class="btn btn-sm ${isRead ? "btn-done" : "btn-quiet"}" onclick="app.toggleLessonDone('${mod.id}', ${i}, false)">
                ${isRead ? "✓ " + this.l("Dipahami", "Understood") : "○ " + this.l("Tandai Paham", "Mark Read")}
              </button>
            </div>
          </div>
          ${ls.optional ? `<div class="callout optional-note"><strong>${this.l("Opsional pada putaran pertama.", "Optional on the first pass.")}</strong> ${this.l("Materi ini berguna untuk persiapan kerja dan wawancara, tetapi lab dan modul berikutnya tidak membutuhkannya. Jika Anda baru mulai, boleh lewati sekarang dan kembali sebelum mencari kerja.", "This lesson helps with job preparation and interviews, but the labs and later modules do not need it. If you are just starting, you may skip it now and come back before you look for a job.")}</div>` : ""}
          ${!steps || stepK === 0 ? lessonAnims.map((anim) => this.renderLessonAnimation(anim)).join("") : ""}
          ${steps ? stepBody : this.md(this.lessonBody(ls), { modId: mod.id, lessonIdx: i }) + (hasLab ? this.lessonLabHtml(mod.id, i) : "")}
        </section>
        ${steps ? "" : `<div class="lesson-pager">
          ${i > 0 ? `<button class="btn btn-quiet" onclick="app.openLesson('${mod.id}', ${i - 1})">← <span class="pager-label">${this.l("Materi", "Lesson")} ${i}</span></button>` : `<button class="btn btn-quiet" onclick="app.openModuleOverview('${mod.id}')">☰ ${this.l("Peta materi", "Lesson map")}</button>`}
          ${endButtons}
        </div>`}`;
      }

      // ---------- module overview: what you will learn, and the lesson map ----------
      return `
        ${totalLessons > 0 && readCount >= totalLessons ? (() => {
          const tri = this.moduleTryItStats(mod);
          const proven = Boolean(this.proofFor(mod.id));
          const qs = this.quizScores[mod.id];
          const qNeed = Math.ceil((mod.quiz || []).length * 0.8);
          const quizOk = Boolean(qs && qs.best >= qNeed);
          const chaosOk = Boolean(this.chaosDone[mod.id] && this.chaosDone[mod.id].done);
          const next = !proven && mod.lab ? ["lab", this.l("Kerjakan lab-nya", "Build the lab")]
            : !chaosOk && mod.chaosLab ? ["chaos", this.l("Bedah insidennya", "Work through the incident")]
            : !quizOk && (mod.quiz || []).length ? ["quiz", this.l("Ikuti kuisnya", "Take the quiz")] : null;
          return `
        <div class="complete-card" id="module-complete" role="status">
          <div class="complete-check" aria-hidden="true">✓</div>
          <h2>${this.l("Semua materi selesai dibaca", "Lessons complete")}</h2>
          <p class="muted small">${this.l("Membaca baru separuh jalan. Kunci pemahamannya ada di lab, insiden, dan kuis.", "Reading is half the work. The lab, the incident and the quiz are where it sticks.")}</p>
          <div class="complete-stats">
            <div><strong>${readCount}/${totalLessons}</strong><span>${this.l("materi", "lessons")}</span></div>
            <div><strong>${tri.total ? `${tri.done}/${tri.total}` : "–"}</strong><span>${this.l("Try-it terverifikasi", "Try-its verified")}</span></div>
            <div><strong>~${this.readingMinutes(mod)}m</strong><span>${this.l("waktu baca", "reading time")}</span></div>
          </div>
          ${tri.total && tri.done < tri.total ? `<p class="small muted">${this.l(`${tri.total - tri.done} Try-it belum diverifikasi. Mengerjakannya membuat materi ini benar-benar melekat.`, `${tri.total - tri.done} Try-it(s) not verified yet. Doing them is what makes these lessons stick.`)}</p>` : ""}
          <div class="row" style="justify-content:center">
            ${next ? `<button class="btn btn-primary" onclick="app.go('curriculum','${mod.id}','${next[0]}')">${next[1]} →</button>` : `<span class="state-done">✓ ${this.l("Lab, insiden, dan kuis sudah selesai", "Lab, incident and quiz are done")}</span>`}
          </div>
        </div>`;
        })() : ""}

        <div class="well stack-sm" id="module-toc">
          <div class="row between">
            <div>
              <div class="label">${this.l("Peta Materi & Progres Baca", "Lesson Map & Reading Progress")} (${readCount}/${totalLessons})</div>
              <p class="small muted">${this.l("Satu materi per layar, masing-masing beberapa menit. Klik materi untuk membukanya.", "One lesson per screen, a few minutes each. Click a lesson to open it.")}</p>
            </div>
            ${totalLessons ? `<button class="btn btn-primary" onclick="app.openLesson('${mod.id}', ${nextUnread >= 0 ? nextUnread : 0})">${readCount === 0 ? this.l("Mulai materi 1", "Start lesson 1") : nextUnread >= 0 ? this.l(`Lanjutkan: materi ${nextUnread + 1}`, `Continue: lesson ${nextUnread + 1}`) : this.l("Tinjau dari materi 1", "Review from lesson 1")} →</button>` : ""}
          </div>
          <div class="progress" style="height:6px"><div style="width:${pctRead}%;background:${pctRead === 100 ? "var(--green)" : "var(--blue)"}"></div></div>
          <div class="toc-grid">
            ${mod.lessons.map((ls, i) => {
              const isRead = this.isLessonDone(mod.id, i);
              const bodyTxt = this.lessonBody(ls);
              const pt = this.moduleParts(mod).find((x) => x.start === i);
              const ptHead = pt ? (() => {
                const n = pt.end - pt.start + 1;
                const doneN = mod.lessons.slice(pt.start, pt.end + 1).filter((_, j) => this.isLessonDone(mod.id, pt.start + j)).length;
                const mins = mod.lessons.slice(pt.start, pt.end + 1).reduce((a, l3) => a + this.lessonMinutes(l3), 0);
                const range = n > 1 ? `${this.l("materi", "lessons")} ${pt.start + 1}–${pt.end + 1}` : `${this.l("materi", "lesson")} ${pt.start + 1}`;
                return `<div class="toc-part ${doneN === n ? "is-done" : ""}"><span class="toc-part-title">${this.l("Bagian", "Part")} ${pt.k + 1} · ${this.esc(this.t(pt.title))}</span><span class="toc-part-meta">${range} · ~${mins} ${this.l("menit", "min")} · ${doneN}/${n} ${this.l("selesai", "done")}</span></div>`;
              })() : "";
              const hasTryIt = /^>\s*(?:🛠|\*\*(?:Try it|Coba sendiri))/m.test(bodyTxt);
              const hasPause = /^>\s*(?:💡|\*\*(?:Practice Pause|Jeda Praktik))/m.test(bodyTxt);
              const hasAnim = this.getAnimsForLesson(mod.id, i).length > 0;
              return `${ptHead}
                <div class="toc-item ${isRead ? "is-read" : ""} ${i === nextUnread ? "is-next" : ""}">
                  <button class="toc-check ${isRead ? "checked" : ""}" onclick="app.toggleLessonDone('${mod.id}', ${i}, false)" title="${isRead ? this.l("Batal tandai selesai", "Mark unread") : this.l("Tandai sudah dipahami", "Mark as understood")}" aria-label="${this.l("Tandai selesai", "Toggle lesson completion")}">✓</button>
                  <button class="toc-link" onclick="app.openLesson('${mod.id}', ${i})"><strong>${i + 1}.</strong> ${this.esc(this.t(ls.title))}</button>
                  <div class="toc-meta">
                    ${hasAnim ? `<span class="micro-badge info" title="${this.l("Dilengkapi animasi konsep interaktif", "Includes interactive step-by-step concept animation")}">🎬 ${this.l("Animasi", "Anim")}</span>` : ""}
                    ${hasTryIt ? `<span class="micro-badge ok" title="${this.l("Memiliki latihan praktik Try It", "Includes hands-on Try It exercise")}">🛠 Try It</span>` : ""}
                    ${hasPause ? `<span class="micro-badge info" title="${this.l("Memiliki Jeda Praktik Lab", "Includes Lab Practice Pause")}">💡 Lab</span>` : ""}
                    ${this.optionalBadge(ls)}
                    <span>~${this.lessonMinutes(ls)}m</span>
                  </div>
                </div>`;
            }).join("")}
          </div>
        </div>
        <div class="context-drawer-grid">
          <details class="callout fold-callout" ${readCount === 0 && !this.focusMode ? "open" : ""}>
            <summary class="label">${this.l("Setelah modul ini Anda bisa", "After this module you can")}</summary>
            <ul style="margin-left:18px">${mod.outcomes.map((o) => `<li>${this.inline(this.t(o))}</li>`).join("")}</ul>
            ${prereqText ? `<p class="small muted" style="margin-top:8px"><strong>${this.l("Prasyarat", "Prerequisites")}:</strong> ${this.inline(prereqText)}</p>` : ""}
            <p class="small muted" style="margin-top:6px">${this.l("Waktu baca", "Reading time")}: ~${this.readingMinutes(mod)} ${this.l("menit", "min")}</p>
            ${prereqNote ? `<div style="margin-top:10px">${this.md(prereqNote)}</div>` : ""}
          </details>

          <details class="callout neutral fold-callout" ${readCount === 0 && mod.id === "mod-0-2" && !this.focusMode ? "open" : ""}>
            <summary class="label">📐 ${this.l("Posisi di siklus hidup data engineering", "Position in the data engineering lifecycle")}</summary>
            ${this.renderLifecycleDiagram(mod.id)}
          </details>
        </div>
        ${this.renderModuleSimulator(mod.id)}

        ${mod.resources && mod.resources.length ? `<div class="well"><div class="label">${this.l("Bacaan lanjutan (dokumentasi resmi)", "Further reading (official docs)")}</div><ul style="margin-left:18px">${mod.resources.map((r) => `<li><a href="${this.esc(r.url)}" target="_blank" rel="noopener">${this.esc(this.t(r.label))}</a></li>`).join("")}</ul></div>` : ""}
        ${nav(null, ["lab", plainTab("tabLab")])}`;
    }
    if (this.activeModuleTab === "lab") {
      const lab = mod.lab;
      const hasSandbox = window.SQL_PLAYGROUND && SQL_PLAYGROUND.challenges.some((c) => c.module === mod.id);
      const hasProofSpec = Boolean(window.PROOF && window.PROOF[mod.id]);
      const labProven = Boolean(this.proofFor(mod.id)) || !hasProofSpec;
      const kindLabel = { starter: this.l("Titik awal", "Starter"), reference: this.l("Solusi referensi", "Reference solution"), test: this.l("Tes", "Tests"), data: this.l("Data", "Data"), config: this.l("Konfigurasi", "Config") };
      return `
        ${this.labReturnBanner(mod)}
        <div>
          <h2>${this.esc(this.t(lab.title))}</h2>
          ${this.md(lab.description, { modId: mod.id })}
        </div>
        ${hasSandbox ? `<div class="callout success"><p>${this.l("Sebagian lab ini bisa dikerjakan langsung di browser dengan pengecekan otomatis:", "Part of this lab can be done in your browser with automatic checking:")} <a href="#/playground">${this.l("buka SQL Sandbox", "open the SQL Sandbox")} →</a></p></div>` : ""}
        <div class="callout"><p><strong>⚖️ ${this.l("Aturan main: kerjakan sendiri, di komputer Anda.", "The rule: do it yourself, on your own computer.")}</strong> ${this.l("Tulis kodenya di komputer Anda dan jalankan tesnya di terminal. Solusi referensi di halaman ini tetap terkunci sampai Anda menempel kode bukti DF1 yang dicetak terminal Anda.", "Write the code on your own computer and run the tests in your terminal. The reference solution on this page stays locked until you paste the DF1 proof code your terminal prints.")}</p></div>
        ${this.browserLabCard(mod.id)}
        ${this.labHowItWorks(mod)}
        <h3>${this.l("Langkah kerja", "Steps")}</h3>
        ${(() => {
          // where every lab command is typed; from Module 0.1 on, with the course venv active
          const mm = mod.id.match(/mod-(\d)-(\d)/);
          const venv = mm && Number(mm[1]) * 10 + Number(mm[2]) >= 1;
          return `<div class="callout neutral"><p class="small"><strong>📍 ${this.l("Di mana menjalankan langkah-langkah ini", "Where to run these steps")}:</strong> ${this.l(
            `di terminal, dari folder kursus${venv ? " dengan venv aktif" : ""}, kecuali sebuah langkah menyuruh <code>cd</code> ke tempat lain. File kode dibuka dan diedit di editor (VS Code), lalu dijalankan dari terminal.`,
            `in the terminal, from the course folder${venv ? " with the venv active" : ""}, unless a step says to <code>cd</code> somewhere else. Code files are opened and edited in your editor (VS Code), then run from the terminal.`)}</p>
            <pre class="start-screen"><code>cd ~/projects/DECourse${venv ? "\nsource venv/bin/activate      # " + this.l("prompt diawali (venv)", "the prompt starts with (venv)") : ""}</code></pre>
            <p class="small muted">${this.l("Terminal baru = ulangi dua baris itu (dan setiap <code>export</code> dari langkah lab). Bingung terminal, <code>&gt;&gt;&gt;</code> dan file?", "A new terminal = repeat those lines (and any <code>export</code> from the lab steps). Confused by the terminal, <code>&gt;&gt;&gt;</code> and files?")} <a href="#/start">${this.l("Mulai di sini, langkah 4", "Start here, step 4")}</a>.</p>
            <p class="small">${this.l(`<strong>Ada yang tidak jalan dan Anda tidak tahu kenapa?</strong> Jalankan <code>python3 scripts/doctor.py ${mod.id}</code>. Ia memeriksa folder, venv, paket, alat, dan variabel lingkungan yang dibutuhkan modul ini, lalu mencetak perintah perbaikannya. Ia tidak mengubah apa pun.`, `<strong>Something does not work and you do not know why?</strong> Run <code>python3 scripts/doctor.py ${mod.id}</code>. It checks the folder, venv, packages, tools and environment variables this module needs, and prints the command that fixes each problem. It changes nothing.`)}</p></div>`;
        })()}
        ${this.md(lab.steps, { modId: mod.id })}
        ${lab.files.length ? `<h3>${this.l("File lab", "Lab files")}</h3>
          <p class="muted small">${this.l("File starter dan test dapat langsung Anda pelajari. File solusi referensi baru terbuka setelah Anda memverifikasi bukti lab lokal di bawah.", "Starter and test files are open for inspection. Reference solution files unlock only after you verify your local lab proof below.")}</p>
          ${lab.files.map((f) => {
            if (f.kind === "reference" && !labProven) {
              return `
                <div class="file locked-solution-card">
                  <div class="row between">
                    <div><code>${this.esc(f.path)}</code> <span class="chip">🔒 ${kindLabel[f.kind]} (${this.l("Terkunci", "Locked")})</span> <span class="muted small">${this.esc(this.t(f.label))}</span></div>
                  </div>
                  <p class="small muted" style="margin-top:8px">
                    ${this.l(
                      "Solusi referensi dikunci agar Anda tidak terjebak tutorial hell. Kerjakan file starter di komputer Anda sendiri, jalankan perintah verifikasi di bawah, dan tempel kode bukti DF1 untuk membuka solusi pembanding.",
                      "The reference solution is locked so you never fall into tutorial hell. Complete the starter file on your own machine, run the verification command below, and paste your DF1 proof code to unlock the reference comparison."
                    )}
                  </p>
                  <details style="margin-top:8px">
                    <summary class="small" style="cursor:pointer;font-weight:600;color:var(--accent)">🧭 ${this.l("Buntu? Buka Panduan Debugging Lokal (Tanpa Bocoran Kode)", "Stuck? Open Local Debugging Guide (No Code Spoilers)")}</summary>
                    <ol class="small muted" style="margin:6px 0 0 18px">
                      <li>${this.l("Buka file", "Open the")} <code>test</code> ${this.l("di atas dan baca setiap baris", "file above and read each")} <code>assert</code> — ${this.l("tes memberi tahu kontrak input/output secara eksak.", "the test suite states the exact input/output contract.")}</li>
                      <li>${this.l("Jalankan skrip dengan sampel data kecil di terminal Anda dan cetak tipe datanya", "Run your script on a 2-row sample in your terminal and print intermediate values")} (<code>print(type(x), repr(x))</code>).</li>
                      <li>${this.l("Periksa kondisi batas: nilai", "Check hostile edge cases:")} <code>None</code>/<code>NULL</code>, ${this.l("string kosong, spasi berlebih, duplikat, dan pembagian dengan nol.", "empty strings, whitespace, duplicate keys, and division by zero.")}</li>
                    </ol>
                  </details>
                </div>`;
            }
            return `
            <details class="file" ${f.kind === "starter" || f.kind === "test" ? "open" : ""}>
              <summary><code>${this.esc(f.path)}</code> <span class="chip ${f.kind === "reference" ? "chip-green" : "chip-blue"}">${f.kind === "reference" ? "🔓 " : ""}${kindLabel[f.kind]}</span> <span class="muted small">${this.esc(this.t(f.label))}</span></summary>
              ${f.kind === "reference" ? `<p class="small muted" style="margin:8px 0 0">${this.l("Bukti lab lokal terverifikasi! Bandingkan pendekatan Anda dengan solusi referensi di bawah ini.", "Local lab proof verified! Compare your implementation with the reference solution below.")}</p>` : ""}
              <pre><code>${this.esc(f.code)}</code></pre>
            </details>`;
          }).join("")}` : ""}
        ${lab.verify && this.t(lab.verify) ? `<h3>${this.l("Cara memeriksa hasil", "How to check your work")}</h3>${this.md(lab.verify, { modId: mod.id })}` : ""}
        ${this.proofCard(mod.id)}
        <div class="callout">
          <div class="label">${this.l("Selesai bila", "Done when")}</div>
          <ul style="margin-left:18px">${lab.deliverables.map((d) => `<li>${this.inline(this.t(d))}</li>`).join("")}</ul>
        </div>
        ${nav(["concepts", plainTab("tabConcepts")], ["chaos", plainTab("tabChaos")])}`;
    }
    if (this.activeModuleTab === "chaos") {
      const c = mod.chaosLab;
      const cState = this.chaosDone[mod.id] || {};
      const noteLen = (cState.notes || "").trim().length;
      const chaosProof = this.chaosProofs[mod.id];
      const canRevealChaos = Boolean(cState.done || noteLen >= 50 || chaosProof);
      const cmdInit = `python3 scripts/chaos_drill.py init ${mod.id} ~/df-chaos/${mod.id}`;
      const cmdVerify = `python3 scripts/chaos_drill.py verify ${mod.id} ~/df-chaos/${mod.id}`;
      return `
        <div class="row between">
          <div>
            <h2>${this.esc(this.t(c.title))}</h2>
            <p class="muted">${CHAOS_DRILL_MODULES.includes(mod.id)
              ? this.l("Kegagalan ini benar-benar terjadi di produksi. Baca skenarionya, lalu tulis hipotesis Anda (min. 50 karakter) atau perbaiki versi kecilnya di terminal Anda untuk membuka akar masalahnya.", "This kind of failure really happens in production. Read the scenario, then write your hypothesis (at least 50 characters) or fix a small version of it in your terminal to unlock the root cause.")
              : this.l("Kegagalan ini benar-benar terjadi di produksi. Baca skenarionya dan tulis hipotesis Anda (min. 50 karakter) untuk membuka akar masalahnya.", "This kind of failure really happens in production. Read the scenario and write your hypothesis (at least 50 characters) to unlock the root cause.")}</p>
          </div>
          <div class="row">
            ${chaosProof ? `<span class="state-done">✓ ${this.l("CHAOS1 Terbukti", "CHAOS1 Verified")}</span>` : ""}
            <button class="btn btn-sm ${cState.done ? "btn-done" : "btn-quiet"}" onclick="app.toggleChaosDone('${mod.id}')">
              ${cState.done ? "✓ " + this.l("Insiden Dianalisis", "Incident Analyzed") : "○ " + this.l("Tandai Sudah Dianalisis", "Mark Analyzed")}
            </button>
          </div>
        </div>
        <div class="callout danger"><div class="label">${this.l("Skenario kerusakan di produksi", "The production breakage")}</div>${this.md(c.scenario, { modId: mod.id })}</div>

        ${CHAOS_DRILL_MODULES.includes(mod.id) ? `
        <!-- Local chaos drill (CHAOS1), only for modules that have one -->
        <div class="card stack-sm" style="border-left:4px solid var(--red)">
          <div class="row between">
            <div>
              <span class="label">${this.l("Latihan di terminal Anda", "Drill in your own terminal")}</span>
              <h3 style="margin-top:4px">${this.l("Perbaiki di komputer Anda sendiri", "Fix it on your own computer")}</h3>
            </div>
            ${chaosProof ? `<span class="state-done">✓ CHAOS1 (${chaosProof.py} · ${chaosProof.os})</span>` : `<span class="muted small">${this.l("Belum diverifikasi", "Not verified yet")}</span>`}
          </div>
          <p class="small muted">${this.l("Perintah pertama menyalin versi kecil yang rusak dari insiden ini ke folder Anda. Perbaiki di editor Anda, lalu perintah kedua mengujinya, termasuk dengan data tersembunyi, dan mencetak kode CHAOS1.", "The first command copies a small broken version of this incident into a folder of yours. Fix it in your editor; the second command tests it, including on hidden data, and prints a CHAOS1 code.")}</p>
          <div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(cmdInit + "\n" + cmdVerify)}</code></pre></div>
          <div class="row">
            <input type="text" id="chaos-proof-input-${mod.id}" autocomplete="off" spellcheck="false" placeholder="CHAOS1:${mod.id}:…" value="${chaosProof ? this.esc(chaosProof.token) : ""}" style="flex:1;min-width:220px;font-family:ui-monospace,Menlo,Consolas,monospace" onkeydown="if(event.key==='Enter'){app.submitChaosProof('${mod.id}')}" />
            <button class="btn btn-sm btn-primary" onclick="app.submitChaosProof('${mod.id}')">${this.l("Verifikasi CHAOS1", "Verify CHAOS1")}</button>
          </div>
          <div id="chaos-proof-msg-${mod.id}">${chaosProof ? `<div class="feedback ok">✓ ${this.l(`Drill Chaos lokal terverifikasi (${chaosProof.passed} invariant lulus di Python ${chaosProof.py}, ${chaosProof.os}).`, `Local Chaos drill verified (${chaosProof.passed} invariants passed on Python ${chaosProof.py}, ${chaosProof.os}).`)}</div>` : ""}</div>
        </div>` : ""}

        <!-- Step 1: Learner Hypothesis Scratchpad -->
        <div class="well stack-sm">
          <div class="row between">
            <div class="label">🔍 ${this.l("Langkah 1: Hipotesis Triage Anda (Wajib Sebelum Membuka Kunci Jawaban)", "Step 1: Your Incident Triage Hypothesis (Required Before Unlocking Answer)")}</div>
            <span class="chip ${canRevealChaos ? "chip-green" : ""}">${noteLen}/50 ${this.l("karakter", "chars")}</span>
          </div>
          <p class="small muted">${this.l("Latih insting on-call engineer Anda dengan menjawab singkat 3 pertanyaan ini:", "Train your on-call engineering instinct by briefly answering these 3 questions:")}</p>
          <ol class="small muted" style="margin-left:18px">
            <li>${this.l("Apa penyebab teknis di balik gejala di atas (mengapa sistem tidak langsung gagal dengan jelas)?", "What is the underlying root cause behind the symptoms above?")}</li>
            <li>${this.l("Langkah mitigasi apa yang pertama kali Anda jalankan untuk menghentikan dampak produksi?", "What immediate mitigation step would you run to stop the bleeding?")}</li>
            <li>${this.l("Guardrail / pola defensif apa yang mencegah insiden ini terulang kembali?", "What defensive guardrail prevents this incident from ever happening again?")}</li>
          </ol>
          <textarea class="notes-textarea" placeholder="${this.l("Tulis hipotesis diagnosis dan langkah perbaikan Anda di sini (minimal 50 karakter untuk membuka Langkah 2)…", "Write your diagnostic hypothesis and remediation steps here (at least 50 characters to unlock Step 2)…")}" oninput="app.saveChaosNote('${mod.id}', this.value)">${this.esc(cState.notes || "")}</textarea>
          <div class="row between">
            <span class="small muted">${canRevealChaos ? "🔓 " + this.l("Analisis akar masalah sudah terbuka di bawah.", "Root cause analysis is unlocked below.") : "🔒 " + this.l(`Tulis ${Math.max(0, 50 - noteLen)} karakter lagi lalu klik tombol di kanan.`, `Write ${Math.max(0, 50 - noteLen)} more characters, then click the button on the right.`)}</span>
            <button class="btn btn-sm ${canRevealChaos ? "btn-done" : "btn-primary"}" onclick="app.unlockChaosAnalysis('${mod.id}')">
              ${canRevealChaos ? "✓ " + this.l("Analisis Terbuka", "Analysis Unlocked") : "🔓 " + this.l("Buka Analisis Akar Masalah", "Unlock Root Cause Analysis")}
            </button>
          </div>
        </div>

        ${canRevealChaos ? `
          <details class="file" open><summary><strong>🔓 ${this.l("Langkah 2: Akar Masalah, Perbaikan & Pola Defensif", "Step 2: Root Cause, Fix & Defensive Pattern")}</strong></summary>
            <div class="stack-sm" style="margin-top:12px">
              <div class="well"><div class="label">${this.l("Akar masalah", "Root cause")}</div>${this.md(c.breakageReason, { modId: mod.id })}</div>
              <div class="well"><div class="label">${this.l("Cara memperbaiki", "How to fix it")}</div>${this.md(c.fixGuide, { modId: mod.id })}</div>
              <div class="callout success"><div class="label">${this.l("Pola defensif", "Defensive pattern")}</div>${this.md(c.defensivePattern, { modId: mod.id })}</div>
              <div class="well stack-sm">
                <div class="label">✍️ ${this.l("Latihan menulis: post-mortem insiden ini", "Writing practice: the post-mortem for this incident")}</div>
                <p class="small">${this.l(`Tulis post-mortem tanpa menyalahkan untuk insiden ini dengan template <code>labs/shared/writing/postmortem_template_id.md</code>, satu halaman, dengan angka dari skenario di atas. Lalu periksa strukturnya. Modul 2.5, pelajaran 9, menjelaskan apa yang membuatnya baik; pemeriksa ini tidak bisa menilai penalarannya, jadi minta orang lain membacanya.`, `Write a blameless post-mortem for this incident with the template <code>labs/shared/writing/postmortem_template.md</code>: one page, using the numbers from the scenario above. Then check its structure. Module 2.5, lesson 9, explains what makes a good one; the checker cannot judge the reasoning, so ask someone to read it.`)}</p>
                <div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>python3 scripts/check_writing.py postmortem POSTMORTEM.md</code></pre></div>
              </div>
              <div class="row" style="justify-content:flex-end;margin-top:6px">
                <button class="btn btn-sm ${cState.done ? "btn-done" : "btn-primary"}" onclick="app.toggleChaosDone('${mod.id}')">
                  ${cState.done ? "✓ " + this.l("Sudah Ditandai Paham", "Marked as Analyzed") : "✓ " + this.l("Saya Paham Pola Defensif Ini", "I Understand This Defensive Pattern")}
                </button>
              </div>
            </div>
          </details>` : `
          <div class="file locked-solution-card">
            <strong>🔒 ${this.l("Langkah 2 Terkunci: Tulis Hipotesis Anda Terlebih Dahulu", "Step 2 Locked: Write Your Triage Hypothesis First")}</strong>
            <p class="small muted" style="margin-top:4px">${this.l("Di dunia kerja nyata, tidak ada kunci jawaban saat pager berbunyi jam 2 pagi. Tulis diagnosis Anda minimal 50 karakter di atas lalu klik 'Buka Analisis Akar Masalah'.", "In real life, there is no answer key when the pager fires at 2 AM. Write at least 50 characters of your own diagnosis above, then click 'Unlock Root Cause Analysis'.")}</p>
          </div>`}
        ${nav(["lab", plainTab("tabLab")], ["quiz", plainTab("tabQuiz")])}`;
    }
    // quiz (Idea #2: Uxcel & Busuu Step-by-Step Interactive Quiz + Classic Toggle)
    const order = this.quizOrderFor(mod);
    const last = this.quizScores[mod.id];
    const need = Math.ceil(mod.quiz.length * 0.8);
    if (this.quizMode === "uxcel") {
      return this.renderUxcelQuiz(mod, order, last, need, plainTab);
    }
    return `
      <div class="row between">
        <div>
          <h2>${this.l("Cek pemahaman", "Check your understanding")}</h2>
          <p class="muted" style="margin-top:4px">${this.l(`Jawab minimal ${need} dari ${mod.quiz.length} dengan benar untuk menyelesaikan modul. Urutan pilihan diacak setiap kali halaman dimuat.`, `Answer at least ${need} of ${mod.quiz.length} correctly to complete the module. Answer order is shuffled on each page load.`)}
            ${last ? ` · ${this.l("Skor terbaik", "Best score")}: ${last.best}/${last.total}` : ""}</p>
        </div>
        <button class="btn btn-sm btn-primary" onclick="app.setQuizMode('uxcel')">⚡ ${this.l("Satu soal per layar", "One question at a time")}</button>
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

  renderLifecycleDiagram(modId) {
    const stageMap = {
      "gen": { num: "1", icon: "🌱", name: this.l("1. Generasi Sumber", "1. Source Generation"), sub: "OLTP, APIs, IoT, Logs", mods: ["mod-0-0", "mod-0-2", "mod-0-1", "mod-1-5", "mod-1-6"] },
      "store": { num: "2", icon: "🗄️", name: this.l("2. Penyimpanan", "2. Storage Layer"), sub: "Parquet, Iceberg, S3, RDBMS", mods: ["mod-0-3", "mod-1-7", "mod-2-1", "mod-2-2", "mod-3-4"] },
      "ingest": { num: "3", icon: "📥", name: this.l("3. Ingesti & Aliran", "3. Ingestion & Stream"), sub: "Batch, CDC, Kafka, Flink", mods: ["mod-1-1", "mod-1-2", "mod-3-2", "mod-3-3", "mod-4-2", "mod-4-3"] },
      "transform": { num: "4", icon: "⚙️", name: this.l("4. Transformasi & Model", "4. Transformation"), sub: "SQL, Kimball, DV2.0, dbt, Spark", mods: ["mod-1-3", "mod-1-4", "mod-2-3", "mod-2-4", "mod-3-0", "mod-3-1", "mod-4-1"] },
      "serve": { num: "5", icon: "🚀", name: this.l("5. Serving & AI RAG", "5. Serving & AI RAG"), sub: "BI, Reverse ETL, pgvector", mods: ["mod-2-5", "mod-2-6", "mod-3-5", "mod-4-4"] }
    };
    const undercurrents = [
      { icon: "🔐", name: this.l("Keamanan & PII", "Security & PII") },
      { icon: "🏛️", name: this.l("Manajemen Data (DMBOK)", "Data Management") },
      { icon: "📈", name: "DataOps & Observability" },
      { icon: "📐", name: this.l("Arsitektur Data", "Data Architecture") },
      { icon: "🎼", name: this.l("Orkestrasi (Dagster)", "Orchestration") },
      { icon: "💻", name: "Software Engineering" }
    ];
    return `
      <div class="lifecycle-diagram">
        <div class="row between">
          <div>
            <span class="label">${this.l("Siklus hidup data engineering (Reis & Housley)", "The data engineering lifecycle (Reis & Housley)")}</span>
            <span class="small muted" style="margin-left:6px">${this.l("Tahap yang dinyalakan adalah posisi modul ini di arsitektur produksi:", "Highlighted stage shows where this module sits in production architecture:")}</span>
          </div>
        </div>
        <div class="lifecycle-stages">
          ${Object.values(stageMap).map((st) => {
            const isActive = st.mods.includes(modId);
            return `
              <div class="lifecycle-node ${isActive ? "active" : ""}" onclick="app.go('curriculum','${st.mods[0]}','concepts')" title="${this.l("Klik untuk menjelajahi tahap ini", "Click to explore this stage")}">
                <div style="font-size:18px">${st.icon}</div>
                <div class="stage-name">${this.esc(st.name)}</div>
                <div class="stage-sub">${this.esc(st.sub)}</div>
                ${isActive ? `<span class="micro-badge ok" style="margin-top:4px;display:inline-block">● ${this.l("Modul Aktif", "Active Module")}</span>` : ""}
              </div>`;
          }).join("")}
        </div>
        <div class="lifecycle-undercurrents">
          <span class="small muted" style="font-weight:700;margin-right:4px">🌊 ${this.l("6 Arus Bawah (Undercurrents):", "6 Undercurrents:")}</span>
          ${undercurrents.map((u) => `<span class="undercurrent-pill">${u.icon} ${this.esc(u.name)}</span>`).join("")}
        </div>
      </div>`;
  }

  setQuizMode(mode) {
    this.quizMode = mode;
    writeStore("df_quiz_mode", mode);
    this.renderView();
  }

  ensureUxcelState(mod) {
    if (!this.uxcelQuizState[mod.id]) {
      this.uxcelQuizState[mod.id] = {
        stepIdx: 0,
        picked: null,
        checked: false,
        answers: {},
        startedAt: Date.now(),
        elapsedSec: 0,
        finished: false
      };
    }
    return this.uxcelQuizState[mod.id];
  }

  selectUxcelOption(modId, optPos) {
    const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === modId);
    if (!mod) return;
    const st = this.ensureUxcelState(mod);
    if (st.checked || st.finished) return;
    const order = this.quizOrderFor(mod)[st.stepIdx] || [];
    if (optPos < 0 || optPos >= order.length) return;
    const actualOi = order[optPos];
    st.picked = actualOi;
    st.checked = true;
    const q = mod.quiz[st.stepIdx];
    const isOk = actualOi === q.correct;
    st.answers[st.stepIdx] = { picked: actualOi, ok: isOk };
    this.playTone(isOk ? "ok" : "bad");
    this.renderView();
  }

  nextUxcelQuestion(modId) {
    const mod = CURRICULUM_DATA.flatMap((l) => l.modules).find((m) => m.id === modId);
    if (!mod) return;
    const st = this.ensureUxcelState(mod);
    if (!st.checked) return;
    if (st.stepIdx + 1 < mod.quiz.length) {
      st.stepIdx++;
      st.picked = null;
      st.checked = false;
    } else {
      st.finished = true;
      st.elapsedSec = Math.max(5, Math.round((Date.now() - st.startedAt) / 1000));
      const correct = Object.values(st.answers).filter((a) => a && a.ok).length;
      const prev = this.quizScores[modId];
      this.quizScores[modId] = { best: Math.max(correct, prev ? prev.best : 0), total: mod.quiz.length };
      writeStore("df_quiz_scores", this.quizScores);
      const need = Math.ceil(mod.quiz.length * 0.8);
      const passed = correct >= need;
      const needsProof = Boolean(window.PROOF && window.PROOF[modId]) && !this.proofFor(modId);
      if (passed && !needsProof && !this.completedModules.includes(modId)) {
        this.completedModules.push(modId);
        writeStore("df_completed_modules", this.completedModules);
        this.renderHeaderStats();
      }
      this.playTone(passed ? "win" : "bad");
    }
    this.renderView();
  }

  restartUxcelQuiz(modId) {
    delete this.uxcelQuizState[modId];
    delete this.quizOrder[modId];
    this.renderView();
  }

  renderUxcelQuiz(mod, order, last, need, plainTab) {
    const st = this.ensureUxcelState(mod);
    const total = mod.quiz.length;

    if (st.finished) {
      const correct = Object.values(st.answers).filter((a) => a && a.ok).length;
      const pct = Math.round((correct / total) * 100);
      const passed = correct >= need;
      const needsProof = Boolean(window.PROOF && window.PROOF[mod.id]) && !this.proofFor(mod.id);
      const mins = Math.floor((st.elapsedSec || 12) / 60);
      const secs = (st.elapsedSec || 12) % 60;
      const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
      const xpEarned = passed ? 80 + (correct * 10) : correct * 10;

      return `
        <div class="uxcel-celebration">
          <span class="chip ${passed ? "chip-green" : ""}">${passed ? "🎉 " + this.l("ASESMEN LULUS", "ASSESSMENT PASSED") : "🔁 " + this.l("PERLU ULASAN ULANG", "NEEDS REVIEW")}</span>
          <h2 style="font-size:24px;margin-top:10px">${passed ? this.l("Luar Biasa! Konsep Modul Ini Terkuasai", "Awesome Work! Module Concepts Mastered") : this.l("Hampir Sampai! Tinjau Kembali Konsep yang Terlewat", "Almost There! Review the Missed Concepts")}</h2>
          <p class="muted" style="max-width:540px;margin:6px auto 0">
            ${passed
              ? (needsProof
                  ? this.l("Kuis lulus (≥80%)! Untuk menuntaskan modul ini, kerjakan lab di komputer Anda dan tempel kode bukti DF1 di tab Lab.", "Quiz passed (≥80%)! To complete this module, do the lab on your own computer and paste its DF1 proof code in the Lab tab.")
                  : this.l("Kuis dan bukti lab lokal telah terverifikasi. Modul ini sekarang ditandai selesai!", "Both quiz and local lab proof are verified. This module is now marked complete!"))
              : this.l(`Anda menjawab benar ${correct}/${total} (butuh minimal ${need} atau 80%). Pelajari kembali kartu penjelasan lalu coba lagi.`, `You scored ${correct}/${total} (need at least ${need} or 80%). Review the lesson explanations and try again.`)}
          </p>
          <div class="uxcel-stat-row">
            <div class="uxcel-stat-box">
              <div class="val" style="color:var(--amber)">+${xpEarned} XP</div>
              <div class="small muted">${this.l("XP Diraih", "XP Earned")}</div>
            </div>
            <div class="uxcel-stat-box">
              <div class="val" style="color:${passed ? "var(--green)" : "var(--red)"}">${pct}%</div>
              <div class="small muted">${correct}/${total} ${this.l("Benar", "Accuracy")}</div>
            </div>
            <div class="uxcel-stat-box">
              <div class="val">⏱️ ${timeStr}</div>
              <div class="small muted">${this.l("Waktu Selesai", "Time Taken")}</div>
            </div>
          </div>
          <div class="row" style="justify-content:center;margin-top:20px;gap:10px">
            <button class="btn" onclick="app.restartUxcelQuiz('${mod.id}')">🔄 ${this.l("Ulangi Kuis Interaktif", "Retake Interactive Quiz")}</button>
            ${needsProof ? `<button class="btn btn-primary" onclick="app.go('curriculum','${mod.id}','lab')">🧪 ${this.l("Buka Tab Lab & Tempel Bukti DF1", "Open Lab Tab & Paste DF1 Proof")} →</button>` : `<button class="btn btn-primary" onclick="app.go('roadmap')">🧭 ${this.l("Lanjut ke Modul Berikutnya", "Continue Roadmap")} →</button>`}
          </div>
        </div>`;
    }

    const qi = st.stepIdx;
    const q = mod.quiz[qi];
    const qOrder = order[qi] || q.options.map((_, i) => i);
    const progressPct = Math.round(((qi + (st.checked ? 1 : 0)) / total) * 100);
    const correctCountSoFar = Object.values(st.answers).filter((a) => a && a.ok).length;
    const tipId = `tip:${mod.id}:${qi}`;
    const isTipSaved = (this.savedTips || []).some((t) => t.id === tipId);
    const lessonIdx = this.findBestLessonForQuestion(mod, q);
    const lessonTitle = mod.lessons[lessonIdx] ? this.t(mod.lessons[lessonIdx].title) : "";

    return `
      <div class="uxcel-quiz-shell">
        <div class="uxcel-top-bar">
          <span class="chip chip-blue">${this.l("Soal", "Question")} ${qi + 1} / ${total}</span>
          <div class="uxcel-progress-track"><div class="uxcel-progress-fill" style="width:${progressPct}%"></div></div>
          <span class="chip chip-green">✓ ${correctCountSoFar} ${this.l("Benar", "Correct")}</span>
          <button class="btn btn-sm btn-quiet" onclick="app.setQuizMode('classic')" title="${this.l("Tampilkan semua soal sekaligus", "Switch to classic all-at-once view")}">📋 ${this.l("Tampilan Klasik", "Classic View")}</button>
        </div>

        <div class="uxcel-question-body">
          <div>
            <span class="small muted">${this.l("Tips Keyboard: Tekan [1] - [4] untuk memilih jawaban, lalu [Enter] untuk lanjut.", "Keyboard Tip: Press [1] - [4] to pick an option, then [Enter] for next question.")}</span>
            <h3 style="font-size:18px;margin-top:6px;line-height:1.45">${this.inline(this.t(q.question))}</h3>
          </div>

          <div class="stack-sm">
            ${qOrder.map((oi, pos) => {
              let stateCls = "";
              if (st.checked) {
                if (oi === q.correct) stateCls = "is-correct";
                else if (oi === st.picked) stateCls = "is-wrong";
              } else if (oi === st.picked) {
                stateCls = "is-selected";
              }
              return `
                <button class="uxcel-option-btn ${stateCls}" onclick="app.selectUxcelOption('${mod.id}', ${pos})" ${st.checked ? "disabled" : ""}>
                  <span class="uxcel-key-badge">${st.checked ? (oi === q.correct ? "✓" : oi === st.picked ? "✕" : pos + 1) : pos + 1}</span>
                  <span style="flex:1">${this.inline(this.t(q.options[oi]))}</span>
                </button>`;
            }).join("")}
          </div>

          ${st.checked ? `
            <div class="callout ${st.picked === q.correct ? "success" : "danger"}" style="margin-top:6px" role="status" aria-live="polite">
              <div class="row between">
                <strong style="font-size:15px">${st.picked === q.correct ? "🎸 " + this.l("Tepat Sekali! (Rock on!)", "Rock on! Spot-on engineering answer.") : "💡 " + this.l("Belum Tepat — Mari Pelajari Prinsipnya:", "Not Quite — Here Is the Core Engineering Principle:")}</strong>
                <div class="row">
                  <button class="btn btn-sm ${isTipSaved ? "btn-done" : "btn-quiet"}" onclick="app.toggleSaveTip('${tipId}', '${mod.id}', ${JSON.stringify(mod.number + " Q" + (qi + 1) + ": " + this.stripMd(this.t(q.question)).slice(0, 70)).replace(/"/g, "&quot;")}, ${JSON.stringify(this.stripMd(this.t(q.explanation))).replace(/"/g, "&quot;")})">
                    ${isTipSaved ? "🔖 " + this.l("Tersimpan di Bookmark", "Saved to Bookmarks") : "🔖 " + this.l("Simpan tips", "Save tip")}
                  </button>
                  ${mod.lessons[lessonIdx] ? `<button class="btn btn-sm btn-quiet" onclick="app.reviewLessonFromQuiz('${mod.id}', ${lessonIdx})">📖 ${this.l("Buka Materi #" + (lessonIdx + 1), "Review Lesson #" + (lessonIdx + 1))}</button>` : ""}
                </div>
              </div>
              <p style="margin-top:8px;line-height:1.55">${this.inline(this.t(q.explanation))}</p>
            </div>
            <div class="row between" style="margin-top:6px">
              <span class="small muted">${lessonTitle ? `📖 ${this.l("Referensi:", "Reference:")} ${this.esc(lessonTitle)}` : ""}</span>
              <button class="btn btn-primary" onclick="app.nextUxcelQuestion('${mod.id}')">
                ${qi + 1 < total ? this.l("Soal Berikutnya (Enter) →", "Next Question (Enter) →") : "🏆 " + this.l("Lihat Hasil Asesmen →", "Finish & See Assessment Results →")}
              </button>
            </div>` : `
            <div class="row between" style="margin-top:6px">
              <button class="btn btn-quiet btn-sm" onclick="app.go('curriculum','${mod.id}','chaos')">← ${plainTab("tabChaos")}</button>
              <span class="small muted">${last ? `${this.l("Skor terbaik sebelumnya", "Previous best")}: ${last.best}/${last.total}` : this.l("Pilih salah satu jawaban di atas", "Click an option above to check immediately")}</span>
            </div>`}
        </div>
      </div>`;
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
    if (!this.completedModules.includes(modId)) {
      const needsProof = Boolean(window.PROOF && window.PROOF[modId]) && !this.proofFor(modId);
      if (needsProof) {
        alert(this.l(
          "Modul baru bisa ditandai selesai setelah ada kode bukti DF1 dari lab yang Anda jalankan di komputer sendiri. Jalankan lab-nya, lalu tempel kodenya di tab Lab.",
          "A module can be marked complete only with a DF1 proof code from the lab you ran on your own computer. Run the lab, then paste the code in the Lab tab."
        ));
        this.go("curriculum", modId, "lab");
        setTimeout(() => document.getElementById("proof-card")?.scrollIntoView({ behavior: "smooth" }), 80);
        return;
      }
      const level = CURRICULUM_DATA.find((l) => l.modules.some((m) => m.id === modId));
      const mod = level ? level.modules.find((m) => m.id === modId) : null;
      const need = mod ? Math.ceil(mod.quiz.length * 0.8) : 1;
      const qBest = this.quizScores[modId]?.best || 0;
      if (qBest < need) {
        alert(this.l(
          `Selesaikan Kuis dengan skor minimal ${need}/${mod ? mod.quiz.length : need} (80%) terlebih dahulu untuk membuktikan pemahaman konsep Anda.`,
          `Pass the Quiz with at least ${need}/${mod ? mod.quiz.length : need} (80%) first to verify your conceptual mastery.`
        ));
        this.go("curriculum", modId, "quiz");
        return;
      }
    }
    this.completedModules = this.completedModules.includes(modId)
      ? this.completedModules.filter((id) => id !== modId)
      : [...this.completedModules, modId];
    writeStore("df_completed_modules", this.completedModules);
    this.renderHeaderStats();
    this.renderView();
  }

  reviewLessonFromQuiz(modId, lessonIdx) {
    this.openLesson(modId, lessonIdx);
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
      const lessonIdx = this.findBestLessonForQuestion(mod, q);
      const lessonTitle = mod.lessons[lessonIdx] ? this.esc(this.t(mod.lessons[lessonIdx].title)) : "";
      const reviewBtn = mod.lessons[lessonIdx]
        ? `<div style="margin-top:6px"><button class="btn btn-sm btn-quiet" onclick="app.reviewLessonFromQuiz('${modId}', ${lessonIdx})">📖 ${this.l(`Pelajari di Materi #${lessonIdx + 1}: ${lessonTitle}`, `Review in Lesson #${lessonIdx + 1}: ${lessonTitle}`)}</button></div>`
        : "";
      box.className = "feedback " + (ok ? "ok" : "bad");
      box.innerHTML = ok
        ? `<strong>${this.l("Benar.", "Correct.")}</strong> ${this.inline(this.t(q.explanation))}${reviewBtn}`
        : `<strong>${picked ? this.l("Belum tepat.", "Not quite.") : this.l("Belum dijawab.", "Not answered.")}</strong> ${this.l("Jawaban yang benar", "Correct answer")}: ${this.inline(this.t(q.options[q.correct]))}<br>${this.inline(this.t(q.explanation))}${reviewBtn}`;
    });
    const prev = this.quizScores[modId];
    this.quizScores[modId] = { best: Math.max(correct, prev ? prev.best : 0), total: mod.quiz.length };
    writeStore("df_quiz_scores", this.quizScores);

    const need = Math.ceil(mod.quiz.length * 0.8);
    const all = correct >= need;
    const needsProof = Boolean(window.PROOF && window.PROOF[modId]) && !this.proofFor(modId);
    if (all && !needsProof && !this.completedModules.includes(modId)) {
      this.completedModules.push(modId);
      writeStore("df_completed_modules", this.completedModules);
      this.renderHeaderStats();
    }
    const summary = document.getElementById("quiz-summary");
    if (summary) summary.innerHTML = `<div class="callout ${all ? "success" : ""}"><strong>${correct}/${mod.quiz.length}</strong> ${all ? (needsProof ? this.l("Kuis lulus. Modul ini baru ditandai selesai setelah Anda memasukkan bukti lab (tab Lab, bagian Bukti): kerjakan lab di komputer Anda sendiri.", "Quiz passed. This module is marked complete only after you enter the lab proof (Lab tab, Proof section): do the lab on your own computer.") : this.l("Modul ditandai selesai.", "Module marked complete.")) : this.l(`Anda butuh minimal ${need}. Baca ulang materinya, lalu coba lagi.`, `You need at least ${need}. Re-read the lessons and try again.`)}</div>`;
  }

  // ================= INTERVIEW & PRACTICE ARENA =================
  getDuelQuestions() {
    return [
      {
        q: this.l("CEO perusahaan Stage 1 (3 tabel Postgres, <50 ribu baris/hari) meminta klaster Kafka + Spark Streaming di Kubernetes. Apa tindakan terbaik?", "A Stage-1 startup CEO (3 Postgres tables, <50K rows/day) demands a custom Kafka + Spark Streaming cluster on Kubernetes. What is the right architectural response?"),
        options: [
          this.l("Segera bangun klaster K8s + Kafka agar siap skala 10 tahun ke depan", "Immediately deploy K8s + Kafka so it scales for the next 10 years"),
          this.l("Usulkan arsitektur Type A (Managed ELT + DuckDB/Warehouse per 15 menit) untuk menghindari jebakan TOCO & operasional", "Propose a Type-A architecture (15-min managed batch ELT + DuckDB/Warehouse) to avoid the TOCO maintenance trap"),
          this.l("Gunakan NoSQL MongoDB tanpa skema", "Switch everything to schema-less MongoDB")
        ],
        correct: 1
      },
      {
        q: this.l("Tabel fakta orders (1 baris per order) di-JOIN langsung ke tabel dimensi customer SCD2 yang belum difilter is_current = true. Apa yang terjadi?", "An orders fact table (1 row per order) is joined directly to an SCD2 customer dimension without filtering is_current = true. What happens?"),
        options: [
          this.l("SQL gagal dengan pesan error DuplicateKeyException", "SQL fails with a DuplicateKeyException error"),
          this.l("Silent Join Fan-Out: query sukses (exit 0) tetapi SUM(revenue) menggelembung berlipat ganda!", "Silent Join Fan-Out: query exits 0 with no error, but SUM(revenue) silently inflates!"),
          this.l("Optimizer SQL otomatis menghapus baris histori SCD2", "The SQL optimizer automatically deduplicates SCD2 history rows")
        ],
        correct: 1
      },
      {
        q: this.l("Bagaimana cara mem-pseudonimisasi nomor HP/email PII di Lakehouse agar aman dari serangan Rainbow Table sekaligus tetap bisa di-JOIN?", "How should you pseudonymize PII phone numbers/emails in a Lakehouse to prevent rainbow-table reversal while preserving deterministic JOINs?"),
        options: [
          this.l("SHA-256 biasa tanpa salt (SHA256(email))", "Unsalted SHA-256 (SHA256(email))"),
          this.l("HMAC-SHA256 dengan secret salt yang disimpan di KMS/Vault", "HMAC-SHA256 using a secret salt stored in KMS/Vault"),
          this.l("Encoding Base64 pada kolom email", "Base64 encoding on the email column")
        ],
        correct: 1
      },
      {
        q: this.l("Mengapa klausa WHERE DATE(event_ts) = '2026-10-19' berbahaya pada tabel Parquet/BigQuery yang dipartisi berdasarkan event_ts?", "Why is WHERE DATE(event_ts) = '2026-10-19' dangerous on a 10 TB Parquet/BigQuery table partitioned by event_ts?"),
        options: [
          this.l("Membungkus kolom partisi dengan fungsi mematikan partition pruning dan memicu Full Table Scan!", "Wrapping the partition column in a function disables partition pruning and triggers a Full Table Scan!"),
          this.l("Fungsi DATE() mengubah zona waktu menjadi UTC+7", "The DATE() function shifts timestamps to UTC+7"),
          this.l("Tidak berbahaya karena mesin SQL selalu mengevaluasi invers fungsi", "It is harmless because SQL engines always invert functions automatically")
        ],
        correct: 0
      },
      {
        q: this.l("Saat memigrasikan pipeline monolitik warisan (brownfield) ke dbt/Iceberg, pola arsitektur apa yang paling aman?", "When migrating a brownfield legacy monolithic stored-procedure pipeline to dbt/Iceberg, what is the safest migration pattern?"),
        options: [
          this.l("Big-Bang Cutover: matikan sistem lama hari Jumat malam dan nyalakan sistem baru", "Big-Bang Cutover: turn off the legacy system Friday night and switch over"),
          this.l("Strangler Fig Pattern: jalankan shadow/dual-run per domain dan verifikasi rekonsiliasi baris & metrik sebelum cutover", "Strangler Fig Pattern: shadow/dual-run one domain at a time with automated row & metric reconciliation before cutover"),
          this.l("Salin semua stored procedure 5.000 baris apa adanya ke dalam satu model dbt", "Copy-paste the entire 5,000-line stored procedure verbatim into a single dbt model")
        ],
        correct: 1
      }
    ];
  }

  startDuel() {
    this.duelState = { open: true, round: 0, score: 0, answers: [], startedAt: Date.now(), finished: false };
    this.renderView();
  }

  answerDuel(optIdx) {
    const qs = this.getDuelQuestions();
    const st = this.duelState;
    if (!st.open || st.finished) return;
    const q = qs[st.round];
    const ok = optIdx === q.correct;
    if (ok) st.score++;
    st.answers.push({ round: st.round, picked: optIdx, ok });
    this.playTone(ok ? "ok" : "bad");
    if (st.round + 1 < qs.length) {
      st.round++;
    } else {
      st.finished = true;
      st.elapsedSec = Math.max(4, Math.round((Date.now() - st.startedAt) / 1000));
      if (st.score >= 4) this.playTone("win");
    }
    this.renderView();
  }

  copyScorecard(btn) {
    const g = this.computeGamificationStats();
    const text = [
      `⚡ DataForge Verified Engineering Scorecard`,
      `• Rank: ${g.leagueIcon} ${g.leagueName} (${g.xp.toLocaleString()} XP · 🔥 ${g.streakDays}d Streak)`,
      `• Modules Completed: ${this.completedModules.length}/27`,
      `• Local proofs: ${g.proofCount} DF1 Labs · ${g.tryItCount} TRY1 Checks · ${g.chaosCount} CHAOS1 Drills · ${g.portCount} PORT1 Git Repos`,
      `• Hostile SQL Sandbox Solved: ${g.sqlCount}/59`
    ].join("\n");
    this.copyText(text, btn);
  }

  renderDuelBanner() {
    const st = this.duelState || {};
    const qs = this.getDuelQuestions();
    const g = this.computeGamificationStats();

    if (!st.open) {
      return `
        <div class="card row between" style="border-left:4px solid var(--purple);background:var(--card-subtle)">
          <div>
            <span class="label">${this.l("Tantangan bersama teman", "Challenge with friends")}</span>
            <h3 style="margin-top:4px">${this.l("Duel cepat: 5 soal keputusan arsitektur", "Quick duel: 5 architecture decisions")}</h3>
            <p class="small muted">${this.l("Jawab 5 soal pilihan keputusan arsitektur secepat mungkin (target: 4 benar), atau salin kartu skor bukti lokal Anda untuk grup belajar.", "Answer 5 architecture decision questions as fast as you can (target: 4 right), or copy your local proof scorecard for your study group.")}</p>
          </div>
          <div class="row">
            <button class="btn btn-sm btn-quiet" onclick="app.copyScorecard(this)">📋 ${this.l("Salin Kartu Skor Bukti Lokal", "Copy Verified Proof Scorecard")}</button>
            <button class="btn btn-sm btn-primary" onclick="app.startDuel()">⚔️ ${this.l("Mulai Duel 1v1 (5 Soal)", "Start 1v1 Duel (5 Rounds)")}</button>
          </div>
        </div>`;
    }

    if (st.finished) {
      const benchmarkScore = 4;
      const won = st.score >= benchmarkScore;
      return `
        <div class="card stack-sm" style="border:2px solid ${won ? "var(--green)" : "var(--amber)"}">
          <div class="row between">
            <div>
              <span class="chip ${won ? "chip-green" : "chip-blue"}">${won ? "🏆 VICTORY · ANDA MENANG DUEL!" : "⚔️ CLOSE MATCH · DUEL SELESAI"}</span>
              <h3 style="margin-top:4px">${this.l(`Skor Anda: ${st.score}/5 (${st.elapsedSec}d) vs. Senior DE Benchmark: 4/5 (58d)`, `Your Score: ${st.score}/5 (${st.elapsedSec}s) vs. Senior DE Benchmark: 4/5 (58s)`)}</h3>
            </div>
            <div class="row">
              <button class="btn btn-sm btn-quiet" onclick="app.copyScorecard(this)">📋 ${this.l("Bagikan Skor", "Share Scorecard")}</button>
              <button class="btn btn-sm btn-primary" onclick="app.startDuel()">🔄 ${this.l("Main Lagi", "Rematch")}</button>
              <button class="btn btn-sm btn-quiet" onclick="app.duelState.open=false;app.renderView()">✕</button>
            </div>
          </div>
        </div>`;
    }

    const curQ = qs[st.round];
    return `
      <div class="card stack-sm" style="border:2px solid var(--purple)">
        <div class="row between">
          <span class="chip chip-blue">⚔️ ${this.l("Babak", "Round")} ${st.round + 1} / ${qs.length} · ${this.l("Skor Anda", "Your Score")}: ${st.score}</span>
          <span class="small muted">${this.l("Target: 4 dari 5", "Target: 4 of 5")}</span>
          <button class="btn btn-sm btn-quiet" onclick="app.duelState.open=false;app.renderView()">✕</button>
        </div>
        <h3 style="font-size:16px">${this.esc(curQ.q)}</h3>
        <div class="stack-sm">
          ${curQ.options.map((opt, idx) => `
            <button class="uxcel-option-btn" onclick="app.answerDuel(${idx})">
              <span class="uxcel-key-badge">${idx + 1}</span>
              <span>${this.esc(opt)}</span>
            </button>`).join("")}
        </div>
      </div>`;
  }

  renderInterviewView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const tabs = {
      "system-design": t.tabSystemDesign,
      "sql-arena": t.tabSqlArena,
      "incidents": t.tabIncidents,
      "silent-bugs": this.l("Bug diam-diam", "Silent bugs"),
      "pr-review": this.l("Review PR Git", "Git PR Review"),
      "active-recall": this.l("Mengingat aktif", "Active recall"),
      "stakeholder-defense": this.l("Stakeholder", "Stakeholders")
    };
    Object.keys(tabs).forEach((k) => { tabs[k] = String(tabs[k]).replace(/^\d\.\s*/, ""); });
    const duelOpen = Boolean((this.duelState || {}).open);
    return `
      <div class="stack">
        <div class="card row between">
          <div><h1>${t.interviewTitle}</h1><p class="sub">${t.interviewSubtitle}</p></div>
          <div class="segmented" role="tablist" aria-label="${this.l("Jenis latihan", "Practice type")}">
            ${INTERVIEW_TABS.map((k) => `<button role="tab" aria-selected="${this.activeInterviewTab === k}" class="${this.activeInterviewTab === k ? "active" : ""}" onclick="app.go('interview','${k}')">${tabs[k]}</button>`).join("")}
          </div>
        </div>
        ${duelOpen ? this.renderDuelBanner() : ""}
        ${this.renderInterviewTabContent(t)}
        ${duelOpen ? "" : this.renderDuelBanner()}
      </div>`;
  }

  renderInterviewTabContent(t) {
    const list = (title, items, activeId, handler, body) => `
      <aside class="stack-sm">
        <div class="label" style="padding:0 2px">${title} (${items.length})</div>
        ${items.map((it) => `
          <button class="item ${it.id === activeId ? "active" : ""}" onclick="app.${handler}('${it.id}')">${body(it)}</button>`).join("")}
      </aside>`;

    if (this.activeInterviewTab === "pr-review") {
      return this.renderPrReviewClinic();
    }

    if (this.activeInterviewTab === "silent-bugs") {
      const drills = (window.PRACTICE_LABS && window.PRACTICE_LABS.SILENT_BUG_DRILLS) || [];
      const d = drills.find((x) => x.id === this.activeBugId) || drills[0];
      const st = this.bugState[d.id] || {};
      const selLine = st.selectedLine;
      const lineOk = selLine === d.buggyLineIndex;
      return `
        <div class="split">
          ${list(this.l("Kasus Bug Diam-Diam", "Silent Bug Cases"), drills, d.id, "setActiveBug", (x) => {
            const solved = Boolean((this.bugState[x.id] || {}).solved);
            return `
              <div class="item-title">${solved ? `<span style="color:var(--green);font-weight:700;margin-right:4px">✓</span>` : "🐛 "}${this.esc(this.t(x.title))}</div>
              <div class="item-meta">${this.esc(x.category)} · ${this.esc(x.difficulty)}</div>`;
          })}
          <section class="stack">
            <div class="card stack-sm">
              <div class="row between">
                <span class="chip">${this.esc(d.category)}</span>
                <a class="small" href="#/curriculum/${d.relatedModule}">📖 ${this.l("Modul Terkait", "Related Module")}: ${d.relatedModule} →</a>
              </div>
              <h2>${this.esc(this.t(d.title))}</h2>
              <div class="callout danger">
                <div class="label">🚨 ${this.l("Gejala di Produksi (Exit Code 0 — Tanpa Pesan Error!)", "Production Symptom (Exit Code 0 — Zero Error Messages!)")}</div>
                <p>${this.esc(this.t(d.symptom))}</p>
              </div>
            </div>

            <div class="card stack-sm">
              <div class="row between">
                <h3>🔍 ${this.l("Langkah 1: Klik Baris Kode yang Menyebabkan Bug Diam-Diam", "Step 1: Click the Exact Line Causing the Silent Bug")}</h3>
                <span class="chip ${selLine !== undefined ? (st.attempted ? (lineOk ? "chip-green" : "") : "chip-blue") : ""}">
                  ${selLine !== undefined ? this.l(`Baris #${selLine + 1} dipilih`, `Line #${selLine + 1} selected`) : this.l("Belum memilih baris", "No line selected")}
                </span>
              </div>
              <p class="small muted">${this.l("Kode di bawah ini berjalan tanpa syntax error. Klik baris yang menjadi sumber korupsi data:", "The code below runs without any syntax error. Click the line responsible for silent data corruption:")}</p>
              <div class="bug-code-box">
                ${d.codeLines.map((lineText, idx) => {
                  let cls = "";
                  if (st.attempted && selLine === idx) cls = idx === d.buggyLineIndex ? "correct-line" : "wrong-line";
                  else if (selLine === idx) cls = "selected";
                  return `<button class="bug-line ${cls}" onclick="app.selectBugLine('${d.id}', ${idx})"><span class="bug-line-num">${idx + 1}</span><code>${this.esc(lineText)}</code></button>`;
                }).join("")}
              </div>
            </div>

            <div class="card stack-sm">
              <h3>🛠 ${this.l("Langkah 2: Pilih Perbaikan Produksi yang Tepat", "Step 2: Select the Production-Safe Fix")}</h3>
              <div class="stack-sm">
                ${d.options.map((opt) => `
                  <button class="choice" style="width:100%;text-align:left;${st.selectedOpt === opt.id ? "border-color:var(--blue);font-weight:600" : ""}" onclick="app.submitBugDiagnosis('${d.id}', '${opt.id}')">
                    <span>${st.selectedOpt === opt.id ? "●" : "○"}</span>
                    <span>${this.inline(this.t(opt.text))}</span>
                  </button>`).join("")}
              </div>
              ${st.attempted ? `
                <div class="feedback ${st.solved ? "ok" : "bad"}">
                  <strong>${st.solved ? "✓ " + this.l("Diagnosis Tepat! Bug Diam-Diam Berhasil Diperbaiki.", "Spot On! Silent Bug Diagnosed & Fixed.") : "⚠️ " + this.l(lineOk ? "Baris yang Anda pilih sudah benar, tetapi pilihan perbaikan belum tepat." : `Baris yang Anda pilih (#${selLine + 1}) belum tepat. Perhatikan baris yang berinteraksi dengan NULL/kunci/state!`, lineOk ? "You clicked the right buggy line, but picked the wrong fix." : `Line #${selLine + 1} is not the root cause. Look closely at where NULLs, join keys, or mutable state interact!`)}</strong>
                  ${st.solved ? `<div style="margin-top:8px">${this.inline(this.t(d.explanation))}</div>` : ""}
                </div>` : ""}
            </div>
          </section>
        </div>`;
    }

    if (this.activeInterviewTab === "stakeholder-defense") {
      const drills = (window.PRACTICE_LABS && window.PRACTICE_LABS.STAKEHOLDER_DEFENSE_DRILLS) || [];
      const d = drills.find((x) => x.id === this.activeDefenseId) || drills[0];
      const st = this.defenseState[d.id] || {};
      const draftLen = (st.draft || "").trim().length;
      const canSubmit = draftLen >= 40;
      return `
        <div class="split">
          ${list(this.l("Simulasi Stakeholder", "Stakeholder Scenarios"), drills, d.id, "setActiveDefense", (x) => {
            const solved = Boolean((this.defenseState[x.id] || {}).solved);
            return `
              <div class="item-title">${solved ? `<span style="color:var(--green);font-weight:700;margin-right:4px">✓</span>` : "🗣️ "}${this.esc(this.t(x.title))}</div>
              <div class="item-meta">${this.esc(x.role)} · ${this.esc(x.chapter)}</div>`;
          })}
          <section class="stack">
            <div class="card stack-sm">
              <div class="row between">
                <span class="chip chip-blue">${this.esc(d.role)}</span>
                <span class="muted small">📖 ${this.esc(d.chapter)}</span>
              </div>
              <h2>${this.esc(this.t(d.title))}</h2>
              <div class="callout danger">
                <div class="label">💬 ${this.l("Tuntutan Stakeholder di Rapat", "Stakeholder Demand in the Meeting")}</div>
                <p style="font-size:14.5px;font-style:italic">${this.esc(this.t(d.stakeholderQuote))}</p>
              </div>
            </div>

            <div class="card stack-sm">
              <div class="row between">
                <h3>✍️ ${this.l("Langkah 1: Tulis Argumen & Negosiasi Teknis Anda (Min. 40 Karakter)", "Step 1: Draft Your Engineering Response & Trade-Off Defense (Min. 40 Chars)")}</h3>
                <span class="chip ${canSubmit ? "chip-green" : ""}">${draftLen}/40 ${this.l("karakter", "chars")}</span>
              </div>
              <p class="small muted">${this.l("Bab 1 Fundamentals of Data Engineering: keberhasilan tim data jarang ditentukan teknologi, tetapi oleh komunikasi dengan stakeholder. 64% lowongan data engineering di database TalentHub menyebut komunikasi atau stakeholder.", "Chapter 1 of Fundamentals of Data Engineering: data teams rarely succeed or fail on technology; they do on communication with stakeholders. 64% of the data engineering postings in the TalentHub database mention communication or stakeholders.")}</p>
              <textarea class="notes-textarea" placeholder="${this.l("Tulis bagaimana Anda menjawab stakeholder ini (sebutkan SLA/keputusan bisnis, TCO vs TOCO, Data Contract, atau Strangler Fig)…", "Write how you respond to this stakeholder (cite business decision SLA, TCO vs TOCO, Data Contract, or Strangler Fig)…")}" oninput="app.saveDefenseDraft('${d.id}', this.value)">${this.esc(st.draft || "")}</textarea>
            </div>

            <div class="card stack-sm">
              <h3>🎯 ${this.l("Langkah 2: Pilih Keputusan Arsitektur & Komunikasi Terbaik", "Step 2: Select the Best Architectural & Diplomatic Action")}</h3>
              <div class="stack-sm">
                ${d.options.map((opt) => `
                  <button class="choice" style="width:100%;text-align:left;${st.selectedOpt === opt.id ? "border-color:var(--blue);font-weight:600" : ""}" onclick="app.submitDefenseChoice('${d.id}', '${opt.id}')">
                    <span>${st.selectedOpt === opt.id ? "●" : "○"}</span>
                    <span>${this.inline(this.t(opt.text))}</span>
                  </button>`).join("")}
              </div>
              ${st.attempted ? `
                <div class="feedback ${st.solved ? "ok" : "bad"}">
                  <strong>${st.solved ? "✓ " + this.l("Negosiasi & Arsitektur Tepat!", "Spot-On Engineering & Stakeholder Defense!") : "⚠️ " + this.l("Pilihan tersebut berisiko tinggi bagi tim data dan bisnis. Coba evaluasi kembali dari sudut pandang TCO/TOCO dan Data Contract.", "That choice puts the data team and business at high risk. Re-evaluate through the lens of TCO/TOCO, SLAs, and Data Contracts.")}</strong>
                  ${st.solved ? `<div style="margin-top:8px">${this.md(this.t(d.rubric))}</div>` : ""}
                </div>` : ""}
            </div>
          </section>
        </div>`;
    }

    if (this.activeInterviewTab === "active-recall") {
      const deck = this.getRecallDeck();
      const idx = Math.min(this.activeRecallIdx, Math.max(0, deck.length - 1));
      const card = deck[idx];
      const reviewedCount = Object.keys(this.recallState || {}).length;
      const masteredCount = Object.values(this.recallState || {}).filter((x) => x && x.rating === "mastered").length;
      if (!card) return `<div class="card"><p>${this.l("Tidak ada kartu.", "No cards found.")}</p></div>`;
      const cardStatus = (this.recallState[card.id] || {}).rating;
      return `
        <div class="stack">
          <div class="grid cols-3">
            <div class="stat"><div class="small muted">${this.l("Total Model Mental Inti", "Total Core Mental Models")}</div><div class="num">${deck.length}</div></div>
            <div class="stat"><div class="small muted">${this.l("Kartu Diulas", "Cards Reviewed")}</div><div class="num">${reviewedCount} / ${deck.length}</div></div>
            <div class="stat"><div class="small muted">${this.l("Dikuasai (Mastered)", "Mastered")}</div><div class="num" style="color:var(--green)">${masteredCount} ⚡</div></div>
          </div>

          <div class="recall-card stack-sm">
            <div class="row between">
              <span class="chip chip-blue">🧠 ${this.l("Kartu", "Card")} ${idx + 1} / ${deck.length} · ${this.esc(card.modLabel)}</span>
              ${cardStatus ? `<span class="chip ${cardStatus === "mastered" ? "chip-green" : ""}">${this.esc(cardStatus.toUpperCase())}</span>` : ""}
            </div>
            <h2>${this.l("Apa model mental & prinsip rekayasa utama untuk:", "What is the core mental model & engineering rule for:")} <br><span style="color:var(--blue)">"${this.esc(card.prompt)}"</span>?</h2>
            <p class="small muted">${this.l("Tuliskan intisari konsep ini dengan kata-kata Anda sendiri (min. 20 karakter) sebelum membalik kartu:", "Write the core concept in your own words (min. 20 chars) before flipping the card:")}</p>
            <textarea id="recall-draft-input" class="notes-textarea" placeholder="${this.l("Menurut ingatan saya, prinsip utamanya adalah…", "From memory, the key engineering principle is…")}" oninput="app.recallDraft = this.value">${this.esc(this.recallDraft || "")}</textarea>
            <div class="row between">
              <div class="row">
                <button class="btn btn-sm btn-quiet" onclick="app.stepRecallCard(-1)">← ${this.l("Sebelumnya", "Prev")}</button>
                <button class="btn btn-sm btn-quiet" onclick="app.stepRecallCard(1)">${this.l("Lewati / Berikutnya", "Skip / Next")} →</button>
              </div>
              <button class="btn btn-sm btn-primary" onclick="app.revealRecallAnswer()">🔓 ${this.l("Balik Kartu & Bandingkan", "Flip Card & Compare")}</button>
            </div>

            ${this.recallRevealed ? `
              <div class="callout-tldr" style="margin-top:12px">
                <div class="callout-head">🎯 ${this.l("Model Mental Kanonik", "Canonical Key Mental Model")}</div>
                <p>${this.inline(card.answer)}</p>
                <div class="row between" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
                  <span class="small muted">${this.l("Seberapa kuat ingatan Anda tadi?", "How strong was your recall?")}</span>
                  <div class="row">
                    <button class="btn btn-sm btn-quiet" onclick="app.rateRecallCard('${card.id}','again')">🔁 ${this.l("Ulangi Nanti", "Review Again")}</button>
                    <button class="btn btn-sm" onclick="app.rateRecallCard('${card.id}','good')">👍 ${this.l("Cukup Paham", "Good")}</button>
                    <button class="btn btn-sm btn-done" onclick="app.rateRecallCard('${card.id}','mastered')">⚡ ${this.l("Sangat Paham", "Mastered")}</button>
                  </div>
                </div>
              </div>` : ""}
          </div>
        </div>`;
    }

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
            ${s.stages.map((stage, i) => {
              const draftKey = `sd:${s.id}:${i}`;
              const draft = this.interviewDrafts[draftKey] || "";
              const unlocked = draft.trim().length >= 50;
              return `
              <div class="card stack-sm">
                <div class="row between">
                  <h3 class="row" style="flex-wrap:nowrap"><span class="number-dot">${i + 1}</span>${this.esc(this.t(stage.stageName))}</h3>
                  <span class="chip ${unlocked ? "chip-green" : ""}">${draft.trim().length}/50 ${this.l("karakter", "chars")}</span>
                </div>
                <p class="muted"><em>${this.esc(this.t(stage.prompt))}</em></p>
                <textarea class="notes-textarea" placeholder="${this.l("Tulis rancangan arsitektur, kapasitas, dan trade-off Anda sendiri di sini (min. 50 karakter untuk membuka jawaban referensi)…", "Write your own architecture design, capacity math, and trade-offs here (min. 50 chars to unlock the sample answer)…")}" oninput="app.saveInterviewDraft('${draftKey}', this.value, false)">${this.esc(draft)}</textarea>
                <div class="row between">
                  <span class="small muted">${unlocked ? "🔓 " + this.l("Jawaban pembanding terbuka.", "Reference answer unlocked.") : "🔒 " + this.l("Tulis argumen arsitektur Anda dulu sebelum membuka jawaban contoh.", "Defend your architecture first before unlocking the sample answer.")}</span>
                  <button class="btn btn-sm ${unlocked ? "btn-done" : "btn-primary"}" onclick="app.renderView()">${unlocked ? "✓ " + this.l("Terbuka", "Unlocked") : "🔓 " + this.l("Buka Jawaban Contoh", "Unlock Sample Answer")}</button>
                </div>
                ${unlocked ? `<div id="stage-content-${i}" class="well"><div class="label">${this.l("Jawaban Referensi", "Reference Answer")}</div>${this.md(this.t(stage.sampleAnswer))}</div>` : ""}
              </div>`;
            }).join("")}
          </section>
        </div>`;
    }

    if (this.activeInterviewTab === "sql-arena") {
      const all = INTERVIEW_DATA.sqlArenaProblems;
      const p = all.find((x) => x.id === this.activeSqlId) || all[0];
      const draftKey = `sql:${p.id}`;
      const passKey = `sql_pass:${p.id}`;
      const draft = this.interviewDrafts[draftKey] || "";
      const passedLive = Boolean(this.interviewDrafts[passKey]);
      const unlocked = passedLive || (draft.trim().length >= 30 && /\bselect\b/i.test(draft));
      const runState = (this.sqlArenaResult && this.sqlArenaResult[p.id]) || null;
      return `
        <div class="split">
          ${list(this.l("Soal SQL", "SQL problems"), all, p.id, "setActiveSql", (x) => `
            <div class="row between"><div class="item-title">${this.esc(this.t(x.title))}</div>${this.interviewDrafts[`sql_pass:${x.id}`] ? `<span class="state-done">✓</span>` : ""}</div>
            <div class="item-meta">${x.difficulty} · ${this.esc(x.category)}</div>`)}
          <section class="stack">
            <div class="card stack-sm">
              <div class="row between"><span class="chip">${this.esc(p.company)}</span><span class="muted small">${this.esc(p.category)}</span></div>
              <h2>${this.esc(this.t(p.title))}</h2>
              <div class="well">${this.md(p.problemStatement)}</div>
              <div class="row between">
                <div class="label">Schema · SQLite 3.39 WASM</div>
                ${p.sandboxSetup ? `<button class="btn btn-sm btn-quiet" onclick="app.previewArenaInput('${p.id}')">👀 ${this.l("Lihat Data Sampel", "Preview Sample Rows")}</button>` : ""}
              </div>
              <pre><code>${this.esc(p.schema)}</code></pre>
            </div>
            <div class="card stack-sm">
              <div class="row between">
                <h3>⚡ ${this.l("Tulis & Uji Query Langsung di SQLite WASM", "Write & Execute Your SQL Live in SQLite WASM")}</h3>
                ${passedLive ? `<span class="chip chip-green">✓ ${this.l("Terverifikasi Live", "Verified Live")}</span>` : `<span class="muted small">${this.esc(p.complexity)}</span>`}
              </div>
              ${p.sqliteHint ? `<p class="muted small">💡 ${this.inline(this.t(p.sqliteHint))}</p>` : ""}
              <textarea id="arena-sql-editor" class="sql" rows="7" spellcheck="false" placeholder="WITH ... SELECT ..." oninput="app.saveInterviewDraft('${draftKey}', this.value, false)" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();app.runArenaSql('${p.id}', false)}">${this.esc(draft)}</textarea>
              <div class="row between" style="flex-wrap:wrap;gap:8px">
                <div class="row" style="flex-wrap:wrap;gap:8px">
                  <button class="btn btn-sm btn-primary" onclick="app.runArenaSql('${p.id}', false)">▶ ${this.l("Jalankan Query", "Run Query")}</button>
                  <button class="btn btn-sm" onclick="app.runArenaSql('${p.id}', true)">✓ ${this.l("Uji & Nilai (+ Data Hostil)", "Grade (+ Hostile Data)")}</button>
                </div>
                <button class="btn btn-sm ${unlocked ? "btn-done" : "btn-quiet"}" onclick="app.renderView()">${unlocked ? "✓ " + this.l("Solusi Terbuka", "Solution Unlocked") : "🔓 " + this.l("Buka Solusi (min. 30 kar SELECT)", "Unlock Solution (30+ char SELECT)")}</button>
              </div>
              <div id="arena-sql-output">${runState ? runState.html : `<p class="small muted">${this.l("Tekan Ctrl/Cmd+Enter atau klik Jalankan Query untuk mengeksekusi SQL Anda pada tabel sampel di browser.", "Press Ctrl/Cmd+Enter or click Run Query to execute your SQL against live sample tables in the browser.")}</p>`}</div>
              ${unlocked ? `
                <details ${passedLive ? "open" : ""}>
                  <summary class="small" style="cursor:pointer;font-weight:600">📖 ${this.l("Solusi Referensi Warehouse & Poin Penilaian", "Reference Warehouse Solution & Grading Points")}</summary>
                  <pre style="margin-top:8px"><code>${this.esc(this.t(p.solutionSql))}</code></pre>
                  ${p.sqliteSolutionSql ? `<details style="margin-top:6px"><summary class="small muted" style="cursor:pointer">${this.l("Lihat varian SQLite 3.39 yang dieksekusi grader", "View SQLite 3.39 grader query")}</summary><pre style="margin-top:6px"><code>${this.esc(p.sqliteSolutionSql)}</code></pre></details>` : ""}
                  <div class="callout" style="margin-top:8px"><div class="label">${this.l("Poin penilaian", "What interviewers look for")}</div>${this.md(p.explanation)}</div>
                </details>` : ""}
            </div>
          </section>
        </div>`;
    }

    const all = INTERVIEW_DATA.incidentPostMortemDrills;
    const d = all.find((x) => x.id === this.activeDrillId) || all[0];
    const draftKey = `drill:${d.id}`;
    const draft = this.interviewDrafts[draftKey] || "";
    const unlocked = draft.trim().length >= 50;
    return `
      <div class="split">
        ${list(this.l("Kasus insiden", "Incident drills"), all, d.id, "setActiveDrill", (x) => `<div class="item-title">${this.esc(this.t(x.title))}</div>`)}
        <section class="stack">
          <div class="card stack-sm">
            <h2>${this.esc(this.t(d.title))}</h2>
            <div class="callout danger"><div class="label">${this.l("Skenario", "Scenario")}</div>${this.md(d.scenario)}</div>
          </div>
          <div class="card stack-sm">
            <div class="row between">
              <h3>🚨 ${this.l("Rencana Triage Anda (Menit 0–60)", "Your On-Call Triage Plan (Minutes 0–60)")}</h3>
              <span class="chip ${unlocked ? "chip-green" : ""}">${draft.trim().length}/50 ${this.l("karakter", "chars")}</span>
            </div>
            <p class="small muted">${this.l("Sebelum melihat protokol 60 menit, tuliskan apa yang Anda periksa di 5 menit pertama, cara menghentikan dampak buruk, dan cara melakukan backfill dengan aman.", "Before viewing the 60-minute rubric, write what you check in the first 5 minutes, how you stop the bleeding, and how you safely backfill.")}</p>
            <textarea class="notes-textarea" placeholder="${this.l("Menit 0-15: ... Menit 15-30: ... Backfill & Post-mortem: ...", "Min 0-15: ... Min 15-30: ... Backfill & Post-mortem: ...")}" oninput="app.saveInterviewDraft('${draftKey}', this.value, false)">${this.esc(draft)}</textarea>
            <div class="row between">
              <span class="small muted">${unlocked ? "🔓 " + this.l("Protokol triage terbuka di bawah.", "Triage rubric unlocked below.") : "🔒 " + this.l("Tulis respons insiden Anda (min. 50 karakter) untuk membuka protokol referensi.", "Write your incident response (min. 50 chars) to unlock the reference rubric.")}</span>
              <button class="btn btn-sm ${unlocked ? "btn-done" : "btn-primary"}" onclick="app.renderView()">${unlocked ? "✓ " + this.l("Protokol Terbuka", "Rubric Unlocked") : "🔓 " + this.l("Buka Protokol Triage 60 Menit", "Unlock 60-Minute Triage Rubric")}</button>
            </div>
          </div>
          ${unlocked ? `
            <h3>${this.l("Protokol triage 60 menit", "60-minute triage rubric")}</h3>
            ${d.rubric.map((r, i) => `
              <div class="card tight stack-sm">
                <h3 class="row" style="flex-wrap:nowrap"><span class="number-dot">${i + 1}</span>${this.esc(this.t(r.phase))}</h3>
                ${this.md(r.action)}
              </div>`).join("")}` : ""}
        </section>
      </div>`;
  }

  setActiveSystemDesign(id) { this.activeSystemDesignId = id; this.renderView(); }
  setActiveSql(id) { this.activeSqlId = id; this.renderView(); }
  setActiveDrill(id) { this.activeDrillId = id; this.renderView(); }
  toggleStage(i) { const el = document.getElementById(`stage-content-${i}`); if (el) el.classList.toggle("hidden"); }

  _arenaTableHtml(columns, rows, limit) {
    const cap = limit && rows.length > limit;
    const shown = cap ? rows.slice(0, limit) : rows;
    return `
      <div class="table-wrap"><table>
        <thead><tr>${columns.map((c) => `<th>${this.esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${shown.map((row) => `<tr>${row.map((v) => v === null ? `<td class="null">NULL</td>` : `<td>${this.esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      ${cap ? `<p class="small muted">${this.l(`Menampilkan ${limit} dari ${rows.length} baris.`, `Showing ${limit} of ${rows.length} rows.`)}</p>` : ""}`;
  }

  async _execArenaSql(setupSql, querySql) {
    await SQL_PLAYGROUND.init();
    const db = new SQL_PLAYGROUND.SQL.Database();
    const t0 = performance.now();
    try {
      db.exec(setupSql);
      const res = db.exec(querySql);
      const ms = performance.now() - t0;
      if (!res.length) return { ok: true, columns: [], rows: [], ms, empty: true };
      const last = res[res.length - 1];
      return { ok: true, columns: last.columns, rows: last.values, ms, empty: false };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      db.close();
    }
  }

  _arenaCompare(mine, ref) {
    if (!mine.ok) return { ok: false, reason: "error", detail: mine.error };
    if (mine.empty) return { ok: false, reason: "empty" };
    if (mine.columns.length !== ref.columns.length) return { ok: false, reason: "columns", expected: ref.columns.length, got: mine.columns.length };
    const norm = (rows) => rows.map((r) => JSON.stringify(r.map((v) => typeof v === "number" ? Math.round(v * 100) / 100 : v))).sort();
    const a = norm(mine.rows), b = norm(ref.rows);
    if (a.length !== b.length) return { ok: false, reason: "rows", expected: b.length, got: a.length };
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { ok: false, reason: "values" };
    return { ok: true };
  }

  async previewArenaInput(id) {
    const p = (INTERVIEW_DATA.sqlArenaProblems || []).find((x) => x.id === id);
    if (!p || !p.sandboxSetup) return;
    const out = document.getElementById("arena-sql-output");
    if (out) out.innerHTML = `<p class="small muted">${this.l("Memuat tabel sampel SQLite...", "Loading sample SQLite tables...")}</p>`;
    try {
      await SQL_PLAYGROUND.init();
      const db = new SQL_PLAYGROUND.SQL.Database();
      db.exec(p.sandboxSetup);
      const tbls = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      const html = (tbls[0] ? tbls[0].values : []).map(([name]) => {
        const q = db.exec(`SELECT * FROM "${name.replace(/"/g, '""')}" LIMIT 12`);
        if (!q.length) return "";
        return `<div class="stack-sm" style="margin-top:8px"><div class="label">${this.esc(name)}</div>${this._arenaTableHtml(q[0].columns, q[0].values, 12)}</div>`;
      }).join("");
      db.close();
      this.sqlArenaResult = this.sqlArenaResult || {};
      this.sqlArenaResult[id] = { html: html || `<p class="small muted">${this.l("Tabel kosong.", "Empty table.")}</p>` };
      if (out) out.innerHTML = this.sqlArenaResult[id].html;
    } catch (err) {
      if (out) out.innerHTML = `<div class="callout danger"><code>${this.esc(err.message || err)}</code></div>`;
    }
  }

  async runArenaSql(id, grade) {
    const p = (INTERVIEW_DATA.sqlArenaProblems || []).find((x) => x.id === id);
    if (!p || !p.sandboxSetup) return;
    const ed = document.getElementById("arena-sql-editor");
    const sql = ed ? ed.value : (this.interviewDrafts[`sql:${id}`] || "");
    this.saveInterviewDraft(`sql:${id}`, sql, false);
    const out = document.getElementById("arena-sql-output");
    if (out) out.innerHTML = `<p class="small muted">${this.l("Menjalankan query di SQLite WASM...", "Executing query in SQLite WASM...")}</p>`;

    let html = "";
    try {
      const mine = await this._execArenaSql(p.sandboxSetup, sql);
      if (!mine.ok) {
        this.playTone("err");
        html = `<div class="callout danger"><div class="label">SQLite Error</div><code>${this.esc(mine.error)}</code></div>`;
      } else {
        let banner = `<div class="small muted" style="margin-bottom:6px">${mine.rows.length} ${this.l("baris", "rows")} · ${mine.ms.toFixed(1)} ms</div>`;
        if (grade && p.sqliteSolutionSql) {
          const ref = await this._execArenaSql(p.sandboxSetup, p.sqliteSolutionSql);
          let check = this._arenaCompare(mine, ref);
          if (check.ok && p.sandboxAdversarial) {
            const setupAdv = p.sandboxSetup + "\n" + p.sandboxAdversarial;
            const advMine = await this._execArenaSql(setupAdv, sql);
            const advRef = await this._execArenaSql(setupAdv, p.sqliteSolutionSql);
            const advCheck = this._arenaCompare(advMine, advRef);
            if (!advCheck.ok) check = { ok: false, reason: "adversarial" };
          }
          if (check.ok) {
            this.interviewDrafts[`sql_pass:${id}`] = true;
            writeStore("df_interview_drafts", this.interviewDrafts);
            this.playTone("win");
            banner = `<div class="feedback ok" style="margin-bottom:8px">✓ ${this.l(`Lulus tes utama & tes data hostil (${mine.rows.length} baris · ${mine.ms.toFixed(1)} ms)! Solusi referensi terbuka di bawah.`, `Passed main & hostile edge-case tests (${mine.rows.length} rows · ${mine.ms.toFixed(1)} ms)! Reference solution unlocked below.`)}</div>`;
          } else {
            this.playTone("err");
            const msg = {
              empty: this.l("Query tidak mengembalikan baris. Pastikan ada SELECT.", "Query returned no rows. Make sure it runs a SELECT."),
              columns: this.l(`Jumlah kolom berbeda: harapan ${check.expected}, hasil ${check.got}.`, `Column count mismatch: expected ${check.expected}, got ${check.got}.`),
              rows: this.l(`Jumlah baris berbeda: harapan ${check.expected}, hasil ${check.got}.`, `Row count mismatch: expected ${check.expected}, got ${check.got}.`),
              values: this.l("Nilai baris tidak sama dengan referensi. Periksa filter tanggal/join/deduplikasi Anda.", "Row values do not match the reference output. Check your date window, join type, or dedup logic."),
              adversarial: this.l("Lolos data awal, tetapi gagal pada data hostil (kasus batas 30 hari, duplikat, atau order tanpa klik iklan).", "Passed initial sample, but failed hostile edge-case data (boundary dates, duplicates, or orphan orders).")
            }[check.reason] || this.l("Belum cocok dengan output referensi.", "Output does not match reference.");
            banner = `<div class="feedback err" style="margin-bottom:8px">✕ ${msg}</div>`;
          }
        } else {
          this.playTone("ok");
        }
        html = banner + (mine.empty ? "" : this._arenaTableHtml(mine.columns, mine.rows, 25));
      }
      this.sqlArenaResult = this.sqlArenaResult || {};
      this.sqlArenaResult[id] = { html };
      if (grade && this.interviewDrafts[`sql_pass:${id}`]) {
        this.renderView();
      } else if (out) {
        out.innerHTML = html;
      }
    } catch (err) {
      if (out) out.innerHTML = `<div class="callout danger"><code>${this.esc(err.message || err)}</code></div>`;
    }
  }

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
          ${proj.architecture.map((a) => `<div class="well">${this.inline(this.t(a))}</div>`).join("")}
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

        <!-- Portfolio repository check (PORT1), scripts/verify_portfolio.py -->
        ${(() => {
          const pProof = this.portfolioProofs[proj.id];
          const cmdVerify = `python3 scripts/verify_portfolio.py ${proj.id} ~/my-${proj.id}-repo`;
          return `
            <div class="card stack-sm" style="border-left:4px solid var(--green)">
              <div class="row between">
                <div>
                  <span class="label">${this.l("Periksa repositori Anda", "Check your own repository")}</span>
                  <h3 style="margin-top:4px">${this.l("Bangun proyek ini sendiri, lalu periksa repositorinya", "Build this project yourself, then check the repository")}</h3>
                </div>
                ${pProof ? `<span class="state-done">✓ PORT1 (${pProof.commits} commits · ${pProof.py})</span>` : `<span class="muted small">${this.l("Belum diverifikasi", "Not verified yet")}</span>`}
              </div>
              <p class="small muted">${this.l("Cetak biru di atas hanyalah referensi; yang dinilai perekrut adalah repositori yang Anda bangun sendiri. Pemeriksa lokal ini mengecek: minimal 3 commit, tidak ada rahasia yang ter-commit, README dengan catatan keputusan (ADR), workflow CI yang menjalankan tes, minimal 3 tes lulus yang menguji kode Anda sendiri, kode yang memakai tool proyek ini, dan untuk proyek 1 sebuah dashboard di atas lapisan gold. Ia tidak bisa menilai kualitas; minta orang lain mereview juga.", "The blueprint above is only a reference; recruiters look at the repository you build yourself. This local check looks for: at least 3 commits, no committed secrets, a README with a decision record (ADR), a CI workflow that runs the tests, at least 3 passing tests that test your own code, code that uses this project's tools, and for project 1 a dashboard on the gold layer. It cannot judge quality, so ask someone to review it too.")}</p>
              <div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(cmdVerify)}</code></pre></div>
              <div class="row">
                <input type="text" id="port-proof-input-${proj.id}" autocomplete="off" spellcheck="false" placeholder="PORT1:${proj.id}:…" value="${pProof ? this.esc(pProof.token) : ""}" style="flex:1;min-width:220px;font-family:ui-monospace,Menlo,Consolas,monospace" onkeydown="if(event.key==='Enter'){app.submitPortfolioProof('${proj.id}')}" />
                <button class="btn btn-sm btn-primary" onclick="app.submitPortfolioProof('${proj.id}')">${this.l("Verifikasi PORT1", "Verify PORT1")}</button>
              </div>
              <div id="port-proof-msg-${proj.id}">${pProof ? `<div class="feedback ok row between"><span>✓ ${this.l(`Repositori portofolio lokal terverifikasi (${pProof.passed} audit lulus, ${pProof.commits} commit Git, Python ${pProof.py} di ${pProof.os}).`, `Local portfolio repository verified (${pProof.passed} audits passed, ${pProof.commits} Git commits, Python ${pProof.py} on ${pProof.os}).`)}</span><button class="btn btn-sm" onclick="app.pushPortfolioToCv('${proj.id}')">➕ ${this.l("Kirim Proyek ke CV", "Add Project to CV")}</button></div>` : ""}</div>
            </div>`;
        })()}
      </div>`;
  }
  setActivePortfolio(id) { this.activePortfolioId = id; this.renderView(); }
  pushPortfolioToCv(projId) {
    const proj = (PORTFOLIO_DATA.projects || []).find((p) => p.id === projId);
    if (!proj) return;
    this.resumeData = this.resumeData || JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    this.resumeData.projects = Array.isArray(this.resumeData.projects) ? this.resumeData.projects : [];
    const name = this.t(proj.title);
    if (this.resumeData.projects.some((p) => p && p.name === name)) {
      this.showToast(this.esc(this.l("Proyek ini sudah ada di CV Anda.", "This project is already on your CV.")));
      return;
    }
    this.resumeData.projects.unshift({ name, tech: this.t(proj.badge), description: this.t(proj.summary) });
    this.resumeEdited = true;
    writeStore("df_resume_edited", true);
    writeStore("df_resume_data", this.resumeData);
    this.playTone("ok");
    this.showToast(this.esc(this.l(
      "Ditambahkan ke ATS Resume. Tulis ulang deskripsinya dengan kata-kata Anda sendiri dan angka dari repositori Anda.",
      "Added to ATS Resume. Rewrite the description in your own words, with the numbers from your own repository.")));
  }

  // ================= BROWNFIELD GIT PR CODE REVIEW CLINIC (PR1:) =================
  setActivePrCase(id) { this.activePrId = id; this.renderView(); }
  submitPrProof(prId) {
    const inp = document.getElementById("pr-proof-input-" + prId);
    const msg = document.getElementById("pr-proof-msg-" + prId);
    if (!inp || !msg) return;
    const raw = inp.value.trim();
    const res = window.ProofCheck && window.ProofCheck.verifyPrReview
      ? window.ProofCheck.verifyPrReview(prId, raw)
      : { ok: false, reason: "format" };
    if (!res.ok) {
      this.playTone("err");
      const why = res.reason === "pr"
        ? this.l(`Token ini untuk ${res.prId}, bukan ${prId}.`, `This token is for ${res.prId}, not ${prId}.`)
        : this.l("Token PR1 tidak valid. Salin seluruh baris yang dicetak `verify`.", "Invalid PR1 token. Copy the whole line that `verify` printed.");
      msg.innerHTML = `<div class="feedback err">✗ ${this.inline(why)}</div>`;
      return;
    }
    this.prProofs[prId] = { token: raw, ...res.info };
    writeStore("df_pr_proofs", this.prProofs);
    this.playTone("win");
    this.renderChrome();
    this.renderView();
  }
  renderPrReviewClinic() {
    // The bugs are not listed here on purpose: finding them is the exercise. The ticket in TICKET.md says
    // what the code must do; scripts/pr_review.py holds the checks.
    const cases = [
      {
        id: "pr-1", badge: "dbt · incremental", after: "2.3", author: "junior-de",
        title: { id: "PR #104: menggabungkan pesanan baru ke order mart", en: "PR #104: merge incoming orders into the order mart" },
        about: { id: "Merge inkremental dengan jendela lookback, upsert berdasarkan `updated_at`, dan net revenue.", en: "An incremental merge with a lookback window, upserts by `updated_at`, and net revenue." }
      },
      {
        id: "pr-2", badge: "Airflow · Dagster", after: "2.4", author: "data-intern",
        title: { id: "PR #219: loader harian berpartisi dengan karantina", en: "PR #219: daily partitioned loader with quarantine" },
        about: { id: "Loader yang dijalankan orkestrator per `logical_date`, harus aman dijalankan ulang, dan tidak boleh menelan baris rusak.", en: "A loader the orchestrator runs per `logical_date`; it must be safe to re-run and must not swallow bad rows." }
      },
      {
        id: "pr-3", badge: "SQL · Spark skew", after: "3.1", author: "analytics-dev",
        title: { id: "PR #308: filter blacklist dan salting hot key", en: "PR #308: blacklist filter and hot-key salting" },
        about: { id: "Filter blacklist yang diporting dari SQL, dan salting untuk join yang skew pada `merchant_id`.", en: "A blacklist filter ported from SQL, and salting for a join that is skewed on `merchant_id`." }
      },
      {
        id: "pr-4", badge: "ML features · PII", after: "3.5", author: "ml-intern",
        title: { id: "PR #412: fitur point-in-time dan token email untuk model fraud", en: "PR #412: point-in-time features and email tokens for fraud training" },
        about: { id: "Baris training untuk model fraud: skor risiko pada waktu transaksi, dan email yang diganti token.", en: "Training rows for a fraud model: the risk score as of the transaction, and the email replaced by a token." }
      }
    ];
    const cur = cases.find((c) => c.id === this.activePrId) || cases[0];
    const prProof = this.prProofs[cur.id];
    const repoDir = `~/pr-review/${cur.id}`;
    const cmdAll = [
      `python3 scripts/pr_review.py init ${cur.id} ${repoDir}`,
      `git -C ${repoDir} show HEAD          # ${this.l("tiket dan diff PR", "the ticket and the PR's diff")}`,
      `python3 ${repoDir}/test_pr.py        # ${this.l("jalankan tes", "run the tests")}`,
      `# ${this.l("perbaiki pr_pipeline.py di editor Anda sampai tes lulus, lalu:", "fix pr_pipeline.py in your editor until the tests pass, then:")}`,
      `git -C ${repoDir} commit -am "fix: ..."`,
      `python3 scripts/pr_review.py verify ${cur.id} ${repoDir}`
    ].join("\n");
    const openedBy = (c) => this.l(`Dibuka oleh <code>${this.esc(c.author)}</code>`, `Opened by <code>${this.esc(c.author)}</code>`);

    return `
      <div class="split">
        <aside class="stack-sm">
          <div class="label" style="padding:0 2px">${this.l("Antrean pull request tim", "Team pull request queue")} (${cases.length})</div>
          ${cases.map((c) => `
            <button class="item ${c.id === cur.id ? "active" : ""}" onclick="app.setActivePrCase('${c.id}')">
              <div class="row between">
                <span class="chip">${this.esc(c.badge)}</span>
                ${this.prProofs[c.id] ? `<span class="state-done">✓ PR1</span>` : `<span class="muted small">${this.l("setelah", "after")} ${c.after}</span>`}
              </div>
              <div class="item-title" style="margin-top:6px">${this.esc(this.t(c.title))}</div>
              <div class="item-meta">${openedBy(c)}</div>
            </button>`).join("")}
        </aside>
        <section class="stack">
          <div class="card stack-sm">
            <div class="row between">
              <span class="chip">${this.esc(cur.badge)}</span>
              ${prProof ? `<span class="state-done">✓ PR1</span>` : `<span class="chip">${this.l(`Paling cocok setelah Modul ${cur.after}`, `Best after Module ${cur.after}`)}</span>`}
            </div>
            <h2>${this.esc(this.t(cur.title))}</h2>
            <p class="small muted">${openedBy(cur)} · ${this.inline(this.t(cur.about))}</p>
            <p>${this.l(
              "Di tim data, sebagian besar pekerjaan minggu pertama adalah membaca kode orang lain. PR ini punya tiket yang menjelaskan apa yang harus dilakukan kodenya, dan kode yang belum sepenuhnya melakukannya. Bandingkan tiket dengan kode baris demi baris, temukan di mana keduanya berbeda, perbaiki, dan commit.",
              "On a data team, much of the first weeks is reading other people's code. This PR has a ticket saying what the code must do, and code that does not quite do it. Compare the ticket with the code line by line, find where they differ, fix it, and commit."
            )}</p>
            <p class="small muted">${this.inline(this.l(
              "Tes memakai data dari tiket dan satu dataset kedua yang tidak Anda lihat sebelumnya, jadi jawaban yang di-hardcode tidak lulus. Butuh Git dan Python saja; `pytest` opsional.",
              "The tests use the ticket's data and a second dataset you do not see in advance, so hard-coded answers do not pass. You need only Git and Python; `pytest` is optional."
            ))}</p>
          </div>

          <div class="card stack-sm" style="border-left:3px solid var(--green)">
            <div class="row between">
              <h3>${this.l("Review, perbaiki, commit, verifikasi", "Review, fix, commit, verify")}</h3>
              ${prProof ? `<span class="state-done">✓ PR1</span>` : ""}
            </div>
            <p class="small muted">${this.inline(this.l("Jalankan dari folder kursus.", "Run from the course folder."))}</p>
            <div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(cmdAll)}</code></pre></div>
            <div class="row">
              <input type="text" id="pr-proof-input-${cur.id}" autocomplete="off" spellcheck="false" placeholder="PR1:${cur.id}:…" value="${prProof ? this.esc(prProof.token) : ""}" style="flex:1;min-width:220px;font-family:ui-monospace,Menlo,Consolas,monospace" onkeydown="if(event.key==='Enter'){app.submitPrProof('${cur.id}')}" />
              <button class="btn btn-sm btn-primary" onclick="app.submitPrProof('${cur.id}')">${this.l("Verifikasi PR1", "Verify PR1")}</button>
            </div>
            <div id="pr-proof-msg-${cur.id}">
              ${prProof ? `<div class="feedback ok">✓ ${this.l(`Diperbaiki dan di-commit: ${prProof.passed} pemeriksaan lulus, ${prProof.commits} commit, Python ${this.esc(prProof.py)}.`, `Fixed and committed: ${prProof.passed} checks passed, ${prProof.commits} commits, Python ${this.esc(prProof.py)}.`)}</div>` : ""}
            </div>
          </div>
        </section>
      </div>`;
  }

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
        <div class="card stack-sm no-print" style="background:var(--card-subtle);border-left:4px solid var(--blue)">
          <div class="row between">
            <h3>${this.l("Panduan Formula Dampak Google (Rumus XYZ)", "Google XYZ Impact Formula Guide")}</h3>
          </div>
          <p class="well" style="font-size:13px;line-height:1.6">
            <strong>${this.l("Rumus", "Formula")}:</strong> <em>${this.l('"Mencapai [X], diukur dengan [Y], dengan melakukan [Z]"', '"Accomplished [X], as measured by [Y], by doing [Z]"')}</em><br>
            <span style="color:var(--red)">✗ ${this.l("Pasif", "Passive")}:</span> <em>${this.l('"Bertanggung jawab membuat pipeline ETL dengan Python dan SQL."', '"Responsible for building ETL pipelines with Python and SQL."')}</em><br>
            <span style="color:var(--green)">✓ ${this.l("Dampak terukur", "Measured impact")}:</span> <em>"Built a Python and Apache Iceberg ingestion pipeline processing 45M events a day with 99.98% uptime."</em>
            <br><span class="small muted">${this.l("Tulis CV dalam bahasa Inggris untuk lowongan internasional; angkanya harus benar dan bisa Anda jelaskan di wawancara.", "Write the CV in English for international roles; every number must be true and something you can explain in an interview.")}</span>
          </p>
        </div>

        <div class="card stack-sm no-print" id="ats-panel">${this.renderAtsPanel()}</div>

        <div class="split-cv">
          <div class="stack no-print">
            <!-- Navigasi Cepat Editor -->
            <div class="card tight row between" style="background:var(--card-subtle);gap:6px">
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
              ${field(this.l("Bahasa pemrograman", "Languages"), "skills.languages", r.skills.languages)}
              ${field(this.l("Penyimpanan & format", "Storage & formats"), "skills.storageTableFormats", r.skills.storageTableFormats)}
              ${field(this.l("Pemrosesan & streaming", "Processing & streaming"), "skills.processingStreaming", r.skills.processingStreaming)}
              ${field(this.l("Orkestrasi & DevOps", "Orchestration & DevOps"), "skills.orchestrationOps", r.skills.orchestrationOps)}
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
                    <div class="well stack-sm" style="padding:10px 12px;background:var(--card)">
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
            ${challenge ? (() => {
              const attempts = this.sqlAttempts[challenge.id] || 0;
              const isSolved = this.solvedChallenges.includes(challenge.id);
              const canShowSolution = isSolved || attempts >= 5;
              return `
              <div class="card stack-sm">
                <div class="row between">
                  <h3>${this.esc(this.t(challenge.title))}</h3>
                  <div class="row">
                    <span class="chip" id="pg-attempts">${this.l("Percobaan", "Attempts")}: ${attempts}</span>
                    <span class="chip">${this.esc(this.t(challenge.level))}</span>
                  </div>
                </div>
                <p>${this.esc(this.t(challenge.task))}</p>
                <div class="row">
                  <button class="btn btn-sm btn-quiet" onclick="app.toggleHint()">${this.l("Petunjuk", "Hint")}</button>
                  <button class="btn btn-sm btn-quiet" id="pg-sol-btn" onclick="app.toggleSolution()" ${canShowSolution ? "" : `title="${this.l("Coba periksa minimal 5 query terlebih dahulu", "Try checking at least 5 queries first")}"`}>
                    ${canShowSolution ? "🔓 " + this.l("Lihat solusi", "Show solution") : `🔒 ${this.l("Solusi", "Solution")} (${attempts}/5 ${this.l("percobaan", "tries")})`}
                  </button>
                </div>
                ${sb.hintOpen ? `<div class="callout neutral"><p>${this.esc(this.t(challenge.hint))}</p></div>` : ""}
                ${sb.solutionOpen && canShowSolution ? `<pre><code>${this.esc(challenge.solution)}</code></pre>` : ""}
              </div>`;
            })() : ""}
            <div class="card stack-sm">
              <textarea id="pg-sql-editor" class="sql" rows="9" spellcheck="false" placeholder="SELECT ..."></textarea>
              <div class="row between">
                <div class="row">
                  <button class="btn btn-primary" onclick="app.runSql()">${t.btnExecuteSql}</button>
                  <button class="btn btn-quiet" onclick="app.explainSql()">⚡ ${this.l("Explain Query Plan & Cek Index", "Explain Query Plan & Index Check")}</button>
                  ${challenge ? `<button class="btn" onclick="app.checkChallenge()">${this.l("Periksa jawaban (+ Tes Data Hostil)", "Check my answer (+ Hostile Data Test)")}</button>` : ""}
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
  toggleSolution() {
    const cid = this.sandbox.challengeId;
    const attempts = cid ? (this.sqlAttempts[cid] || 0) : 0;
    const isSolved = cid && this.solvedChallenges.includes(cid);
    if (!isSolved && attempts < 5) {
      alert(this.l(
        `Kerjakan sendiri dulu: solusi baru terbuka setelah minimal 5 percobaan query (saat ini: ${attempts}/5). Pakai tombol Petunjuk dan coba tulis query Anda sendiri.`,
        `Do it yourself first: the reference solution unlocks after at least 5 query attempts (currently: ${attempts}/5). Use the Hint button and try writing the query yourself.`
      ));
      return;
    }
    this.sandbox.solutionOpen = !this.sandbox.solutionOpen;
    this.rerenderKeepingEditor();
  }
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
    } else if (res.visible === false || res.empty) {
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

  explainSql() {
    if (this.sandbox.status !== "ready") return;
    const editor = document.getElementById("pg-sql-editor");
    const box = document.getElementById("pg-verdict");
    const res = SQL_PLAYGROUND.explain(editor.value);
    if (!res.ok) {
      box.innerHTML = `<div class="feedback bad"><strong>EXPLAIN Error:</strong> <code>${this.esc(res.error)}</code></div>`;
      return;
    }
    const hasScan = res.steps.some((s) => s.isScan);
    const hasIndex = res.steps.some((s) => s.isIndex);
    box.innerHTML = `
      <div class="well stack-sm" style="margin-top:8px;border-left:4px solid ${hasIndex && !hasScan ? "var(--green)" : "var(--blue)"}">
        <div class="row between">
          <strong>⚡ ${this.l("Rencana Eksekusi Query (SQLite EXPLAIN QUERY PLAN)", "Live Execution Plan (SQLite EXPLAIN QUERY PLAN)")}</strong>
          <span class="chip ${hasIndex && !hasScan ? "chip-green" : ""}">${hasIndex ? "🚀 Index Search Active" : hasScan ? "🐢 Full Table Scan" : "Plan Ready"}</span>
        </div>
        <div class="stack-sm">
          ${res.steps.map((st, idx) => `
            <div class="row between" style="padding:6px 10px;background:var(--card);border:1px solid var(--border);border-radius:6px">
              <code><strong>#${idx + 1}</strong> ${this.esc(st.detail)}</code>
              <span class="chip ${st.isIndex ? "chip-green" : st.isScan ? "" : "chip-blue"}">
                ${st.isIndex ? "✅ Index Seek (O(log N))" : st.isScan ? "⚠️ Full Table Scan (O(N))" : st.isTempBtree ? "🔄 Temp B-Tree Sort/Group" : "Step"}
              </span>
            </div>`).join("")}
        </div>
        <p class="small muted">💡 ${this.l(
          "Tips Lab Performa: Anda bisa menjalankan `CREATE INDEX idx_test ON orders(customer_id);` diikuti query `SELECT ...` di kotak editor di atas, lalu klik tombol Explain ini lagi untuk melihat perubahan dari `SCAN` menjadi `SEARCH USING INDEX`!",
          "Performance Lab Tip: You can write `CREATE INDEX idx_test ON orders(customer_id);` followed by your `SELECT ...` query in the editor above, then click Explain again to watch `SCAN` turn into `SEARCH USING INDEX`!"
        )}</p>
      </div>`;
  }

  checkChallenge() {
    if (this.sandbox.status !== "ready") return;
    const challenge = SQL_PLAYGROUND.challenges.find((c) => c.id === this.sandbox.challengeId);
    const editor = document.getElementById("pg-sql-editor");
    const sqlText = (editor.value || "").trim();
    if (challenge && sqlText.length >= 10) {
      this.sqlAttempts[challenge.id] = (this.sqlAttempts[challenge.id] || 0) + 1;
      writeStore("df_sql_attempts", this.sqlAttempts);
      // The card was drawn before this check: update the counter and the solution lock in place.
      const n = this.sqlAttempts[challenge.id];
      const chip = document.getElementById("pg-attempts");
      if (chip) chip.textContent = `${this.l("Percobaan", "Attempts")}: ${n}`;
      const sol = document.getElementById("pg-sol-btn");
      if (sol && !this.solvedChallenges.includes(challenge.id)) {
        if (n >= 5) { sol.textContent = "🔓 " + this.l("Lihat solusi", "Show solution"); sol.removeAttribute("title"); }
        else sol.textContent = `🔒 ${this.l("Solusi", "Solution")} (${n}/5 ${this.l("percobaan", "tries")})`;
      }
    }
    this.runSql();
    const r = SQL_PLAYGROUND.check(challenge, editor.value);
    const box = document.getElementById("pg-verdict");
    let msg;
    if (r.ok) {
      msg = this.l(
        "✓ Benar! Query Anda lolos pada data sampel DAN bertahan terhadap mutasi data hostil (NULL tambahan, refund/cancel, dan baris baru).",
        "✓ Correct! Your query passed the sample dataset AND survived hostile data mutations (extra NULLs, refunds/cancellations, and new edge-case rows)."
      );
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
    else if (r.reason === "adversarial") msg = this.l(
      "⚠️ Gagal pada Tes Data Hostil! Query Anda cocok pada data sampel awal, tetapi gagal saat diuji dengan data produksi yang kotor (baris baru, nilai NULL, status refunded/cancelled, atau tie-breaker). Jangan hardcode ID/angka — pastikan filter WHERE, COALESCE/NULL, dan JOIN Anda benar-benar umum!",
      "⚠️ Failed Hostile Data Test! Your query matched the initial sample rows, but broke when tested against mutated production data (new rows, NULLs, refunded/cancelled statuses, or boundary ties). Do not hardcode IDs or constants — make sure your WHERE filters, NULL handling, and JOINs generalize to any data condition!"
    );
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
    const totalQuizQuestions = quizModIds.reduce((sum, id) => sum + (this.quizScores[id].total || 8), 0);
    const avgQuizPct = totalQuizQuestions ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100) : 0;

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
        mods: ["mod-0-0", "mod-0-1", "mod-1-1", "mod-1-2", "mod-1-5", "mod-1-6", "mod-4-2"],
        topics: this.l("Linux Shell piping, Docker container limits (code 137), Pydantic v2 validation, Python Generators (flat RAM), Idempotensi, Pytest TDD, pandas, ingestion API (retry, pagination, checkpoint, DLQ, capstone seismik)", "Linux Shell pipes, Docker resource limits (code 137), Pydantic v2, Python Generators (flat RAM), Idempotency, Pytest TDD, pandas, API ingestion (retries, pagination, checkpoints, DLQ, seismic capstone)")
      },
      {
        id: "lakehouse",
        name: this.l("3. Sistem Penyimpanan: Lakehouse, Warehouse & NoSQL", "3. Storage Systems: Lakehouse, Warehouses & NoSQL"),
        mods: ["mod-1-7", "mod-2-1", "mod-2-2", "mod-2-6"],
        topics: this.l("Parquet columnar layout, Predicate pushdown, DuckDB & Polars, Apache Iceberg metadata tree, Delta Lake ACID logs, S3, NoSQL (key-value, dokumen, wide-column, graph), Snowflake/BigQuery/Redshift", "Parquet layout, Predicate pushdown, DuckDB & Polars, Apache Iceberg metadata tree, Delta Lake ACID logs, S3 storage, NoSQL (key-value, document, wide-column, graph), Snowflake/BigQuery/Redshift")
      },
      {
        id: "transformation",
        name: this.l("4. Transformasi Data, Orkestrasi & Kualitas", "4. Data Transformation, Orchestration & Quality"),
        mods: ["mod-2-3", "mod-2-4", "mod-2-5", "mod-4-1", "mod-4-4"],
        topics: this.l("dbt Core Staging/Marts, Jinja macros, Dagster asset-based DAGs, Airflow, Data Contracts formal, Total Variation Distance drift, Dead-letter quarantine, capstone pipeline nyata (NYC taxi)", "dbt Core Staging/Marts, Jinja macros, Dagster assets, Airflow, Data Contracts, Drift detection, Dead-letter quarantine, real capstone pipeline (NYC taxi)")
      },
      {
        id: "streaming",
        name: this.l("5. Sistem Terdistribusi & Real-Time Streaming", "5. Distributed Scale & Real-Time Streaming"),
        mods: ["mod-3-0", "mod-3-1", "mod-3-2", "mod-3-3", "mod-4-3"],
        topics: this.l("Dari Hadoop ke Spark (HDFS, MapReduce), Spark shuffle & memory tuning, Skew salting, Apache Kafka KRaft (leader, ISR, Schema Registry), Debezium CDC Postgres WAL replication slot, Watermarks & sliding windows, capstone engine streaming armada (DLQ & offset checkpoint)", "From Hadoop to Spark (HDFS, MapReduce), Spark shuffle & memory tuning, Skew salting, Kafka KRaft (leaders, ISR, Schema Registry), Debezium CDC Postgres WAL, Watermarks & sliding windows, fleet streaming engine capstone (DLQ & offset checkpoint)")
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
    if (completedCount === 0) nextSteps.push({ text: this.l("Mulai dari awal: baca halaman Mulai di sini, lalu kerjakan Modul 0.0 (Python dari nol).", "Start at the beginning: read the Start here page, then do Module 0.0 (Python from zero)."), link: "#/start" });
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
              <span class="label" style="margin-bottom:6px;display:inline-block">${this.l("Kesiapan kerja", "Job readiness")}</span>
              <h1>${this.l("Dashboard Kesiapan Kerja & Evaluasi Skill", "Job Readiness & Skill Assessment Dashboard")}</h1>
              <p class="muted" style="margin-top:4px">${this.l("Laporan komprehensif tingkat kesiapan kerja Data Engineer, penguasaan 6 pilar kompetensi, dan rencana aksi menuju standar industri global.", "Comprehensive Data Engineering job readiness report, 6-pillar competency mastery, and action plan toward global engineering standards.")}</p>
            </div>
            <div class="row no-print">
              <button class="btn btn-quiet" onclick="window.print()">🖨️ ${this.l("Cetak / Simpan PDF", "Print / Save PDF")}</button>
              <button class="btn btn-primary" onclick="app.go('roadmap')">${this.l("Buka Roadmap", "Open Roadmap")}</button>
            </div>
          </div>
        </div>

        <!-- Score and the next steps, side by side -->
        <div class="grid cols-2">
          <!-- Readiness Score Card -->
          <div class="card stack-sm" style="display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div class="label">${this.l("Skor Kesiapan Kerja Keseluruhan", "Overall Job Readiness Score")}</div>
              <div class="row" style="align-items:baseline;gap:12px;margin:12px 0 6px">
                <span style="font-size:46px;font-weight:800;color:var(--blue);line-height:1">${readinessScore}%</span>
                <span class="chip" style="font-size:12px;padding:4px 10px;background:${tierBadgeBg};color:var(--on-accent);font-weight:600">${tierBadge}</span>
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

        <!-- Idea #7: Afterglow / 10am Studio Analytics — My Assignments & Local Lab Proofs Status Table -->
        <div class="card stack-sm">
          <div class="row between">
            <div>
              <span class="label">${this.l("Status per modul", "Status per module")}</span>
              <h2 style="margin-top:4px">${this.l("Status Penyelesaian Lab, Kuis & Insiden Chaos per Modul", "Module-by-Module Lab Proof, Chaos Drill & Assessment Status")}</h2>
            </div>
            <button class="btn btn-sm btn-quiet" onclick="app.copyScorecard(this)">📋 ${this.l("Salin Kartu Skor Bukti Lokal", "Copy Verified Scorecard")}</button>
          </div>
          <div class="table-wrap" style="max-height:420px;overflow-y:auto">
            <table>
              <thead>
                <tr>
                  <th>${this.l("Modul", "Module")}</th>
                  <th>${this.l("Materi", "Lessons")}</th>
                  <th>${this.l("Bukti Lab (DF1)", "Lab Proof (DF1)")}</th>
                  <th>${this.l("Drill Chaos", "Chaos Drill")}</th>
                  <th>${this.l("Kuis (≥80%)", "Quiz (≥80%)")}</th>
                  <th>${this.l("Status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                ${CURRICULUM_DATA.flatMap((l) => l.modules).map((m) => {
                  const isDone = this.completedModules.includes(m.id);
                  const lRead = (this.lessonsDone[m.id] || []).length;
                  const lTot = (m.lessons || []).length;
                  const hasPrf = Boolean(this.proofFor(m.id));
                  const hasChaos = Boolean((this.chaosDone[m.id] && this.chaosDone[m.id].done) || this.chaosProofs[m.id]);
                  const q = this.quizScores[m.id];
                  const qNeed = Math.ceil((m.quiz || []).length * 0.8);
                  const qOk = Boolean(q && q.best >= qNeed);
                  const statusLabel = isDone
                    ? `<span class="state-done">✓ ${this.l("Selesai", "Completed")}</span>`
                    : (lRead > 0 || hasPrf || hasChaos || q)
                      ? `<span class="chip chip-blue">${this.l("Sedang Dikerjakan", "In Progress")}</span>`
                      : `<span class="muted small">${this.l("Berikutnya", "Upcoming")}</span>`;
                  return `
                    <tr>
                      <td><a href="#/curriculum/${m.id}"><strong>${m.number}</strong> ${this.esc(this.t(m.title))}</a></td>
                      <td>${lRead}/${lTot}</td>
                      <td>${hasPrf ? `<span class="state-done">✓ DF1</span>` : `<a href="#/curriculum/${m.id}/lab" class="small muted">${this.l("Kerjakan →", "Build →")}</a>`}</td>
                      <td>${hasChaos ? `<span class="state-done">✓ ${this.chaosProofs[m.id] ? "CHAOS1" : "Done"}</span>` : `<a href="#/curriculum/${m.id}/chaos" class="small muted">Chaos →</a>`}</td>
                      <td>${q ? `${q.best}/${q.total} ${qOk ? "✓" : ""}` : `<a href="#/curriculum/${m.id}/quiz" class="small muted">Quiz →</a>`}</td>
                      <td>${statusLabel}</td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
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

        <div class="grid cols-2">
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

          <!-- Checklist -->
          <div class="card stack-sm">
            <h3>${this.l("Daftar Periksa Kualifikasi Kerja (Hiring Checklist)", "Hiring Qualification Checklist")}</h3>
            <p class="muted small">${this.l("Item kualifikasi yang otomatis tercentang saat Anda menyelesaikan modul & lab terkait:", "Qualification items automatically checked as you complete relevant modules & labs:")}</p>
            <div class="stack-sm" style="margin-top:12px">
              ${checklist.map((item) => `
                <div class="row" style="align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
                  <span style="font-size:16px;line-height:1;color:${item.done ? "var(--green)" : "var(--text-muted)"};font-weight:bold">${item.done ? "✓" : "○"}</span>
                  <span style="font-size:13px;color:${item.done ? "var(--text)" : "var(--text-muted)"};${item.done ? "font-weight:500" : ""}">${this.esc(item.label)}</span>
                </div>`).join("")}
            </div>
          </div>
        </div>

        <!-- Job description matcher and measured job market -->
        ${window.PRACTICE_LABS && window.PRACTICE_LABS.TALENTHUB_BENCHMARK_JDS ? (() => {
                    const jds = window.PRACTICE_LABS.TALENTHUB_BENCHMARK_JDS || [];
          const activeJd = jds.find((j) => j.id === this.selectedJdId) || jds[0];
          const textToAnalyze = (this.customJdText && this.customJdText.trim().length > 20)
            ? this.customJdText.toLowerCase()
            : (activeJd ? activeJd.rawText.toLowerCase() : "");

          // Collect all skills across benchmark JDs and match against textToAnalyze
          const allSkillSpecs = [];
          const seenNames = new Set();
          jds.forEach((j) => (j.requiredSkills || []).forEach((sk) => {
            if (!seenNames.has(sk.name)) {
              seenNames.add(sk.name);
              allSkillSpecs.push(sk);
            }
          }));
          const mentions = (kw) => new RegExp("(^|[^a-z0-9])" + kw.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "i").test(textToAnalyze);
          const matchedSkills = allSkillSpecs.filter((sk) => sk.keywords.some(mentions));
          const evaluatedSkills = (matchedSkills.length ? matchedSkills : (activeJd ? activeJd.requiredSkills : [])).map((sk) => {
            const provenMods = sk.modules.filter((mId) => this.completedModules.includes(mId) || Boolean(this.proofFor(mId)));
            return { ...sk, provenCount: provenMods.length, totalMods: sk.modules.length, isProven: provenMods.length > 0 };
          });
          const provenSkillsCount = evaluatedSkills.filter((s) => s.isProven).length;
          const jdMatchPct = evaluatedSkills.length ? Math.round((provenSkillsCount / evaluatedSkills.length) * 100) : 0;
          const verifiedPortCount = Object.keys(this.portfolioProofs || {}).length;
          const verifiedChaosCount = Object.keys(this.chaosProofs || {}).length;

          return `
            <div class="card stack-sm" style="border-left:4px solid var(--green)">
              <div class="row between">
                <div>
                  <span class="label">${this.l("Pencocok lowongan", "Job description matcher")}</span>
                  <h2>${this.l("Lowongan mana yang sudah bisa Anda buktikan?", "Which job description can you already back up?")}</h2>
                  <p class="muted small">${this.l("Tempel lowongan yang ingin Anda lamar, atau pilih salah satu dari 4 contoh lowongan (ditulis untuk latihan dari keahlian yang sering diminta, bukan lowongan asli). Keahlian yang disebut lowongan dicocokkan dengan modul yang sudah Anda buktikan.", "Paste a job description you want to apply for, or pick one of 4 example descriptions (written for practice from commonly requested skills, not real postings). The skills it mentions are matched against the modules you have proven.")}</p>
                </div>
                <div class="row">
                  <span class="chip chip-blue">🛠️ ${verifiedChaosCount} CHAOS1</span>
                  <span class="chip chip-green">🏆 ${verifiedPortCount} PORT1</span>
                </div>
              </div>

              <div class="row" style="gap:6px;flex-wrap:wrap">
                ${jds.map((j) => `
                  <button class="btn btn-sm ${this.selectedJdId === j.id && !this.customJdText ? "btn-primary" : "btn-quiet"}" onclick="app.selectBenchmarkJd('${j.id}')">
                    ${this.esc(j.title.split("—")[1] ? j.title.split("—")[1].trim() : j.title)}
                  </button>`).join("")}
              </div>

              <div class="well stack-sm">
                <div class="row between">
                  <strong>${this.customJdText ? this.l("Lowongan yang Anda tempel", "The job description you pasted") : this.esc(activeJd ? activeJd.title : "")}</strong>
                  <span class="chip ${jdMatchPct >= 80 ? "chip-green" : "chip-blue"}">${this.l("Terbukti", "Backed up")}: ${jdMatchPct}% (${provenSkillsCount}/${evaluatedSkills.length})</span>
                </div>
                <p class="small muted">${this.esc(activeJd && !this.customJdText ? activeJd.rawText : "")}</p>
                <textarea class="notes-textarea" rows="2" placeholder="${this.l("Tempel teks lowongan di sini (dari LinkedIn, Glints, Jobstreet…)", "Paste a job description here (from LinkedIn, Glints, Jobstreet…)")}" oninput="app.updateCustomJd(this.value)">${this.esc(this.customJdText || "")}</textarea>
              </div>

              <div class="grid cols-2">
                ${evaluatedSkills.map((sk) => `
                  <div class="stat stack-sm" style="border-left:3px solid ${sk.isProven ? "var(--green)" : "var(--border-strong)"}">
                    <div class="row between">
                      <strong style="font-size:13px">${this.esc(sk.name)}</strong>
                      <span class="chip ${sk.isProven ? "chip-green" : ""}">${sk.isProven ? "✓ " + this.l("Terbukti", "Proven") : this.l("Belum", "Not yet")}</span>
                    </div>
                    <div class="row between" style="margin-top:6px">
                      <div class="row" style="gap:4px">
                        ${sk.modules.map((mId) => `<a href="#/curriculum/${mId}/lab" class="micro-badge ${this.completedModules.includes(mId) || this.proofFor(mId) ? "ok" : "info"}">${mId.replace("mod-", "Mod ")}</a>`).join("")}
                      </div>
                      <span class="small muted">${sk.provenCount}/${sk.totalMods} ${this.l("modul", "modules")}</span>
                    </div>
                  </div>`).join("")}
              </div>
            </div>

            ${window.MARKET_DATA ? (() => {
              const md = window.MARKET_DATA;
              const fmt = (n) => n.toLocaleString(this.lang === "id" ? "id-ID" : "en-US");
              const pct = (v) => this.lang === "id" ? String(v).replace(".", ",") : String(v);
              return `
            <div class="card stack-sm market-card">
              <div>
                <span class="label">${this.l("Pasar kerja, diukur", "Job market, measured")}</span>
                <h2>${this.l("Apa yang disebut lowongan Data Engineer", "What data engineering job postings mention")}</h2>
                <p class="muted small">${this.l(
                  `${fmt(md.postings)} lowongan berjudul data engineering di database lowongan TalentHub (dari ${fmt(md.all_postings)} lowongan), diunggah ${md.first} sampai ${md.last}. Sebuah lowongan dihitung bila teksnya <em>menyebut</em> keahlian itu; menyebut belum tentu mewajibkan, dan satu lowongan bisa menyebut banyak keahlian.`,
                  `${fmt(md.postings)} postings with a data engineering title in the TalentHub job database (out of ${fmt(md.all_postings)} postings), posted ${md.first} to ${md.last}. A posting counts when its text <em>mentions</em> the skill; a mention is not always a requirement, and one posting can mention many skills.`)}</p>
              </div>
              <div class="market-bars">
                ${md.skills.map((sk) => `
                  <div class="market-row">
                    <div class="market-name">${this.esc(this.lang === "id" ? sk.id_label : sk.en)}</div>
                    <div class="market-bar" role="img" aria-label="${pct(sk.pct)}%"><div style="width:${sk.pct}%"></div></div>
                    <div class="market-pct">${pct(sk.pct)}%</div>
                    <div class="market-mods">${sk.modules.length ? sk.modules.map((mId) => `<a href="#/curriculum/${mId}" class="micro-badge ${this.completedModules.includes(mId) ? "ok" : "info"}" title="${this.l("Modul", "Module")} ${mId.replace("mod-", "").replace("-", ".")}">${mId.replace("mod-", "").replace("-", ".")}</a>`).join("") : `<span class="small muted">${this.l("tidak diajarkan", "not taught")}</span>`}</div>
                  </div>`).join("")}
              </div>
              <p class="small muted">${this.l("Diukur", "Measured")} ${md.measured} ${this.l("dengan", "with")} <code>scripts/job_market_stats.py</code>${this.l(", yang juga mencantumkan pola kata kunci tiap keahlian.", ", which also lists the keyword pattern for each skill.")}</p>
            </div>`;
            })() : ""}
            </div>`;
        })() : ""}
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

  // ================= 4-STORY REAL-LIFE DATA ENGINEER JOB SIMULATOR (FOOTBALL MANAGER EDITION) =================
  // The job simulator (story flow, missions, gates and JOB1 tokens) lives in js/job-career.js.

  // A simulator mission is practice, not a job. The bullet goes in as a project clearly labelled as a simulation,
  // never under Experience, where it would read as work done for an employer.
  pushJobSimBulletToCv(storyId, bulletIdx) {
    const stories = (window.JOB_SIM_DATA && window.JOB_SIM_DATA.stories) || [];
    const story = stories.find((s) => s.id === storyId);
    if (!story || !story.starResumeBullets[bulletIdx]) return;
    const bullet = story.starResumeBullets[bulletIdx];
    this.resumeData = this.resumeData || JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    this.resumeData.projects = Array.isArray(this.resumeData.projects) ? this.resumeData.projects : [];
    const name = `${this.t(story.title)} (${this.l("simulasi kerja DataForge", "DataForge job simulation")})`;
    let proj = this.resumeData.projects.find((p) => p && p.name === name);
    if (!proj) {
      proj = { name, tech: "Python", description: "" };
      this.resumeData.projects.unshift(proj);
    }
    if (String(proj.description || "").includes(bullet)) {
      this.showToast(this.esc(this.l("Poin ini sudah ada di CV Anda.", "This bullet is already on your CV.")));
      return;
    }
    proj.description = [proj.description, bullet].filter(Boolean).join(" ");
    this.resumeEdited = true;
    writeStore("df_resume_edited", true);
    writeStore("df_resume_data", this.resumeData);
    this.playTone("ok");
    this.showToast(this.esc(this.l(
      "Ditambahkan sebagai proyek simulasi di ATS Resume. Sesuaikan angkanya dengan yang benar-benar Anda kerjakan dan bisa Anda jelaskan.",
      "Added as a simulation project in ATS Resume. Change the numbers to what you actually built and can explain.")));
  }
}

window.addEventListener("DOMContentLoaded", () => { window.app = new DataForgeApp(); });
