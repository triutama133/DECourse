// Main Application Controller for DataForge Learning Platform
// Clean, understated, high-readability design. Fully bilingual (ID & EN).

class DataForgeApp {
  constructor() {
    this.currentView = "roadmap";
    this.activeLevelId = "zero";
    this.activeModuleId = "mod-0-1";
    this.activeModuleTab = "concepts"; // 'concepts' | 'lab' | 'chaos' | 'quiz'
    this.activeInterviewTab = "system-design"; // 'system-design' | 'sql-arena' | 'incidents'
    this.activeSystemDesignId = "sd-1";
    this.activeSqlId = "sql-1";
    this.activeDrillId = "drill-1";
    this.activePortfolioId = "proj-1";
    
    // User state in LocalStorage
    this.completedModules = JSON.parse(localStorage.getItem("df_completed_modules") || "[]");
    this.quizScores = JSON.parse(localStorage.getItem("df_quiz_scores") || "{}");
    this.resumeData = JSON.parse(localStorage.getItem("df_resume_data") || "null") || CV_DATA.sampleResume;
    this.lang = localStorage.getItem("df_lang") || "id";

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateLangButtons();
    this.updateNavLabels();
    this.renderHeaderStats();
    this.renderView();
  }

  setLanguage(lang) {
    this.lang = lang;
    localStorage.setItem("df_lang", lang);
    this.updateLangButtons();
    this.updateNavLabels();
    this.renderHeaderStats();
    this.renderView();
  }

  updateLangButtons() {
    const btnId = document.getElementById("lang-btn-id");
    const btnEn = document.getElementById("lang-btn-en");
    if (btnId && btnEn) {
      if (this.lang === "id") {
        btnId.className = "px-2.5 py-1 rounded transition-colors bg-blue-600 text-white font-semibold text-xs";
        btnEn.className = "px-2.5 py-1 rounded transition-colors text-slate-400 hover:text-slate-200 font-medium text-xs";
      } else {
        btnId.className = "px-2.5 py-1 rounded transition-colors text-slate-400 hover:text-slate-200 font-medium text-xs";
        btnEn.className = "px-2.5 py-1 rounded transition-colors bg-blue-600 text-white font-semibold text-xs";
      }
    }
  }

  updateNavLabels() {
    const t = window.TRANSLATIONS ? (window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id) : null;
    if (!t) return;
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.innerText = txt;
    };
    setTxt("brand-subtitle", t.brandSubtitle);
    setTxt("nav-btn-roadmap", t.navRoadmap);
    setTxt("nav-btn-curriculum", t.navCurriculum);
    setTxt("nav-btn-interview", t.navInterview);
    setTxt("nav-btn-portfolio", t.navPortfolio);
    setTxt("nav-btn-cv-builder", t.navCvBuilder);
    setTxt("nav-btn-playground", t.navPlayground);
    setTxt("nav-btn-remote", t.navRemote);

    setTxt("mob-nav-roadmap", t.navRoadmap);
    setTxt("mob-nav-curriculum", t.navCurriculum);
    setTxt("mob-nav-interview", t.navInterview);
    setTxt("mob-nav-portfolio", t.navPortfolio);
    setTxt("mob-nav-cv-builder", t.navCvBuilder);
    setTxt("mob-nav-playground", t.navPlayground);
    setTxt("mob-nav-remote", t.navRemote);

    setTxt("footer-tagline", this.lang === 'id' ? 'Dirancang untuk Penguasaan Rekayasa Data Nyata' : 'Architected for True Engineering Mastery');
    setTxt("footer-link-curriculum", t.navCurriculum);
    setTxt("footer-link-interview", t.navInterview);
    setTxt("footer-link-portfolio", t.navPortfolio);
    setTxt("footer-link-remote", t.navRemote);
  }

  t(val) {
    if (!val) return "";
    if (typeof val === "object") {
      return val[this.lang] || val.id || val.en || "";
    }
    return val;
  }

  tr(key) {
    const dict = window.TRANSLATIONS ? (window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id) : {};
    return dict[key] || key;
  }

  bindEvents() {
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const view = el.getAttribute("data-nav");
        this.switchView(view);
      });
    });
  }

  switchView(view) {
    this.currentView = view;
    document.querySelectorAll("[data-nav]").forEach(el => {
      if (el.getAttribute("data-nav") === view) {
        el.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30 text-xs";
      } else {
        el.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition-colors text-xs font-normal";
      }
    });

    this.renderView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderHeaderStats() {
    const totalModules = CURRICULUM_DATA.reduce((acc, lvl) => acc + lvl.modules.length, 0);
    const completedCount = this.completedModules.length;
    const progressPercent = Math.round((completedCount / totalModules) * 100);

    const labelProgress = this.tr("masteryProgress");
    const labelModules = `${completedCount} ${this.tr("modulesOf")} ${totalModules} ${this.tr("modulesCompleted")} (${progressPercent}%)`;

    const statsEl = document.getElementById("header-stats");
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="hidden sm:flex flex-col text-right">
            <span class="text-[11px] text-slate-400">${labelProgress}</span>
            <span class="text-xs font-semibold text-slate-200">${labelModules}</span>
          </div>
          <div class="w-20 sm:w-28 bg-[#1a2334] rounded-full h-2 overflow-hidden border border-slate-800">
            <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      `;
    }
  }

  renderView() {
    const container = document.getElementById("main-content");
    if (!container) return;

    switch (this.currentView) {
      case "roadmap":
        container.innerHTML = this.renderRoadmapView();
        break;
      case "curriculum":
        container.innerHTML = this.renderCurriculumView();
        break;
      case "interview":
        container.innerHTML = this.renderInterviewView();
        break;
      case "portfolio":
        container.innerHTML = this.renderPortfolioView();
        break;
      case "cv-builder":
        container.innerHTML = this.renderCvBuilderView();
        break;
      case "playground":
        container.innerHTML = this.renderPlaygroundView();
        break;
      case "remote-playbook":
        container.innerHTML = this.renderRemotePlaybookView();
        break;
    }
  }

  // ================= ROADMAP VIEW =================
  renderRoadmapView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    return `
      <div class="animate-fade space-y-8 max-w-6xl mx-auto">
        <!-- Hero Banner (Clean, calm, elegant) -->
        <div class="p-8 sm:p-10 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <div class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400">
            ${t.roadmapBadge}
          </div>
          <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            ${t.roadmapHeroTitle}
          </h1>
          <p class="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl">
            ${t.roadmapHeroDesc}
          </p>
          <div class="pt-2 flex flex-wrap gap-3">
            <button onclick="app.switchView('curriculum')" class="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm transition-colors">
              ${t.ctaStartCurriculum}
            </button>
            <button onclick="app.switchView('interview')" class="px-5 py-2.5 rounded-lg bg-[#161d2e] hover:bg-[#1f283e] text-slate-200 font-medium text-xs sm:text-sm border border-slate-700/80 transition-colors">
              ${t.ctaInterviewSim}
            </button>
            <button onclick="app.switchView('cv-builder')" class="px-5 py-2.5 rounded-lg bg-[#161d2e] hover:bg-[#1f283e] text-slate-200 font-medium text-xs sm:text-sm border border-slate-700/80 transition-colors">
              ${t.ctaBuildCv}
            </button>
          </div>
        </div>

        <!-- 4 Pillars Section (Clean, consistent cards) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-5 rounded-xl bg-[#0f1523] border border-slate-800 space-y-2">
            <div class="text-[11px] font-mono font-semibold text-blue-400">01 / FOUNDATIONS</div>
            <h3 class="font-semibold text-slate-100 text-sm">${t.pillar1Title}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">${t.pillar1Desc}</p>
          </div>
          <div class="p-5 rounded-xl bg-[#0f1523] border border-slate-800 space-y-2">
            <div class="text-[11px] font-mono font-semibold text-amber-400">02 / CHAOS LABS</div>
            <h3 class="font-semibold text-slate-100 text-sm">${t.pillar2Title}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">${t.pillar2Desc}</p>
          </div>
          <div class="p-5 rounded-xl bg-[#0f1523] border border-slate-800 space-y-2">
            <div class="text-[11px] font-mono font-semibold text-emerald-400">03 / PRODUCTION RIGOR</div>
            <h3 class="font-semibold text-slate-100 text-sm">${t.pillar3Title}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">${t.pillar3Desc}</p>
          </div>
          <div class="p-5 rounded-xl bg-[#0f1523] border border-slate-800 space-y-2">
            <div class="text-[11px] font-mono font-semibold text-purple-400">04 / PROOF OF WORK</div>
            <h3 class="font-semibold text-slate-100 text-sm">${t.pillar4Title}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">${t.pillar4Desc}</p>
          </div>
        </div>

        <!-- Milestones Grid -->
        <div class="space-y-4">
          <h2 class="text-base font-bold text-slate-100">${t.matrixTitle}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${CURRICULUM_DATA.map((lvl) => {
              const completedInLevel = lvl.modules.filter(m => this.completedModules.includes(m.id)).length;
              const pct = Math.round((completedInLevel / lvl.modules.length) * 100);
              const lvlTitle = this.t(lvl.levelTitle);
              const lvlSubtitle = this.t(lvl.levelSubtitle);
              const lvlBadge = this.t(lvl.badge);
              return `
                <div class="flex flex-col justify-between p-5 rounded-xl bg-[#0f1523] border border-slate-800 hover:border-slate-700 transition-all">
                  <div class="space-y-2.5">
                    <div class="flex items-center justify-between text-xs">
                      <span class="badge badge-neutral">${lvlBadge}</span>
                      <span class="text-slate-400 font-mono text-[11px]">${completedInLevel}/${lvl.modules.length}</span>
                    </div>
                    <h3 class="text-sm font-semibold text-white">${lvlTitle}</h3>
                    <p class="text-xs text-slate-400 line-clamp-2">${lvlSubtitle}</p>
                    <div class="space-y-1 pt-2">
                      ${lvl.modules.map(m => `
                        <div class="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#090d16] border border-slate-800/80">
                          <span class="text-slate-300 font-medium truncate">${m.number} ${this.t(m.title)}</span>
                          ${this.completedModules.includes(m.id) ? '<span class="text-emerald-400 text-xs">Done</span>' : '<span class="text-slate-600 text-xs">Pending</span>'}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                  <div class="pt-5 space-y-2">
                    <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
                    </div>
                    <button onclick="app.selectLevel('${lvl.levelId}')" class="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors text-center block">
                      ${t.exploreModules} ➔
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  selectLevel(levelId) {
    this.activeLevelId = levelId;
    const lvl = CURRICULUM_DATA.find(l => l.levelId === levelId);
    if (lvl && lvl.modules.length > 0) {
      this.activeModuleId = lvl.modules[0].id;
    }
    this.switchView("curriculum");
  }

  // ================= CURRICULUM VIEW =================
  renderCurriculumView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const activeLevel = CURRICULUM_DATA.find(l => l.levelId === this.activeLevelId) || CURRICULUM_DATA[0];
    const activeModule = activeLevel.modules.find(m => m.id === this.activeModuleId) || activeLevel.modules[0];
    const isCompleted = this.completedModules.includes(activeModule.id);

    return `
      <div class="animate-fade grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
        <!-- Sidebar Navigation -->
        <div class="lg:col-span-4 space-y-4">
          <!-- Level Selector Tabs -->
          <div class="flex rounded-xl bg-[#0f1523] border border-slate-800 p-1">
            ${CURRICULUM_DATA.map(lvl => `
              <button 
                onclick="app.setActiveLevel('${lvl.levelId}')" 
                class="flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${this.activeLevelId === lvl.levelId ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}"
              >
                ${this.t(lvl.badge)}
              </button>
            `).join('')}
          </div>

          <!-- Module List -->
          <div class="rounded-xl bg-[#0f1523] border border-slate-800 overflow-hidden divide-y divide-slate-800">
            <div class="p-3 bg-[#090d16] border-b border-slate-800 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-300 uppercase tracking-wider">${this.t(activeLevel.levelTitle).split(':')[0]}</span>
              <span class="text-xs text-slate-500 font-mono">${activeLevel.modules.length} Modules</span>
            </div>
            <div class="p-2 space-y-1">
              ${activeLevel.modules.map(mod => {
                const done = this.completedModules.includes(mod.id);
                const isSelected = mod.id === this.activeModuleId;
                return `
                  <button 
                    onclick="app.setActiveModule('${mod.id}')"
                    class="w-full text-left p-3 rounded-lg text-xs font-medium transition-colors flex items-start justify-between gap-2 ${isSelected ? 'bg-blue-600/15 border border-blue-500/40 text-blue-300' : 'text-slate-300 hover:bg-[#161d2e]'}"
                  >
                    <div class="space-y-0.5">
                      <div class="font-medium text-slate-100 flex items-center gap-1.5">
                        <span class="font-mono text-slate-400">${mod.number}</span>
                        <span class="line-clamp-1">${this.t(mod.title)}</span>
                      </div>
                      <div class="text-[11px] text-slate-400 line-clamp-1">${this.t(mod.summary)}</div>
                    </div>
                    ${done ? '<span class="text-emerald-400 text-xs">Done</span>' : '<span class="text-slate-600 text-xs">○</span>'}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Module Detail Content Area -->
        <div class="lg:col-span-8 space-y-6">
          <!-- Module Header Card -->
          <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="badge badge-neutral">${this.t(activeLevel.badge)}</span>
                <span class="text-xs text-slate-400 font-mono">${this.t(activeModule.duration)}</span>
              </div>
              <button 
                onclick="app.toggleModuleCompletion('${activeModule.id}')"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${isCompleted ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400' : 'bg-[#161d2e] hover:bg-[#1f283e] text-slate-300 border border-slate-700'}"
              >
                ${isCompleted ? t.btnMarkedComplete : t.btnMarkComplete}
              </button>
            </div>
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-white">${activeModule.number} ${this.t(activeModule.title)}</h2>
              <p class="text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed">${this.t(activeModule.summary)}</p>
            </div>

            <!-- Why Tutorials Lie Alert Box -->
            <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-1">
              <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                ${t.whyTutorialsLieHeader}
              </div>
              <p class="text-xs text-amber-200/90 leading-relaxed">${this.t(activeModule.whyTutorialsLie)}</p>
            </div>

            <!-- Content Tabs -->
            <div class="flex border-b border-slate-800 pt-2 gap-2 text-xs font-medium">
              <button onclick="app.setModuleTab('concepts')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'concepts' ? 'border-b-2 border-blue-500 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}">
                ${t.tabConcepts} (${activeModule.concepts.length})
              </button>
              <button onclick="app.setModuleTab('lab')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'lab' ? 'border-b-2 border-emerald-500 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}">
                ${t.tabLab}
              </button>
              <button onclick="app.setModuleTab('chaos')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'chaos' ? 'border-b-2 border-amber-500 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}">
                ${t.tabChaos}
              </button>
              <button onclick="app.setModuleTab('quiz')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'quiz' ? 'border-b-2 border-purple-500 text-purple-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}">
                ${t.tabQuiz}
              </button>
            </div>
          </div>

          <!-- Tab Content Display -->
          <div class="rounded-2xl bg-[#0f1523] border border-slate-800 p-6 space-y-6">
            ${this.renderModuleTabContent(activeModule, t)}
          </div>
        </div>
      </div>
    `;
  }

  renderModuleTabContent(mod, t) {
    switch (this.activeModuleTab) {
      case "concepts":
        return `
          <div class="space-y-6">
            <h3 class="text-base font-semibold text-slate-100">${this.lang === 'id' ? 'Konsep Fundamental & Mekanisme Kerja' : 'Theoretical Foundations & Mechanics'}</h3>
            <div class="space-y-4">
              ${mod.concepts.map((c, idx) => `
                <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                  <div class="text-xs font-semibold text-blue-400 flex items-center gap-2">
                    <span class="w-5 h-5 rounded bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-mono">${idx + 1}</span>
                    ${this.t(c.title)}
                  </div>
                  <p class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">${this.t(c.content)}</p>
                </div>
              `).join('')}
            </div>
            <div class="pt-2 flex justify-end">
              <button onclick="app.setModuleTab('lab')" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors">
                ${t.btnProceedLab}
              </button>
            </div>
          </div>
        `;
      case "lab":
        return `
          <div class="space-y-5">
            <div>
              <span class="badge badge-emerald">${t.tabLab}</span>
              <h3 class="text-lg font-bold text-white mt-1">${this.t(mod.lab.title)}</h3>
              <p class="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">${this.t(mod.lab.description)}</p>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span>${this.lang === 'id' ? 'Kode Implementasi Produksi' : 'Production Reference Implementation'}</span>
                <span class="font-mono text-xs text-blue-400">${this.lang === 'id' ? 'Jalankan di lingkungan lokal' : 'Run in local environment'}</span>
              </div>
              <pre><code>${this.escapeHtml(mod.lab.codeSnippet)}</code></pre>
            </div>

            <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
              <h4 class="text-xs font-semibold uppercase text-slate-300">${this.lang === 'id' ? 'Deliverable & Kriteria Keberhasilan' : 'Lab Deliverables & Verification Checklist'}</h4>
              <ul class="space-y-1.5 text-xs text-slate-300">
                ${mod.lab.deliverables.map(d => `<li class="flex items-center gap-2"><span class="text-emerald-400">✔</span> ${this.t(d)}</li>`).join('')}
              </ul>
            </div>

            <div class="pt-2 flex justify-between">
              <button onclick="app.setModuleTab('concepts')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
                ${t.btnBackConcepts}
              </button>
              <button onclick="app.setModuleTab('chaos')" class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-medium text-white transition-colors">
                ${t.btnTestChaos}
              </button>
            </div>
          </div>
        `;
      case "chaos":
        return `
          <div class="space-y-5">
            <div>
              <span class="badge badge-amber">${t.tabChaos}</span>
              <h3 class="text-lg font-bold text-white mt-1">${this.t(mod.chaosLab.title)}</h3>
            </div>

            <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-1">
              <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider">${this.lang === 'id' ? 'Skenario Kerusakan di Produksi' : 'The Production Breakage Scenario'}</div>
              <p class="text-xs sm:text-sm text-amber-200/90 leading-relaxed">${this.t(mod.chaosLab.scenario)}</p>
            </div>

            <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-1">
              <div class="text-xs font-semibold text-rose-400 uppercase tracking-wider">${this.lang === 'id' ? 'Akar Masalah (Kenapa Bisa Rusak)' : 'Root Cause Analysis'}</div>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${this.t(mod.chaosLab.breakageReason)}</p>
            </div>

            <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-1">
              <div class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">${this.lang === 'id' ? 'Panduan Perbaikan Teknis' : 'Engineering Fix & Mitigation Protocol'}</div>
              <div class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">${this.t(mod.chaosLab.fixGuide)}</div>
            </div>

            <div class="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 space-y-1">
              <div class="text-xs font-semibold text-blue-400 uppercase tracking-wider">${this.lang === 'id' ? 'Pola Rekayasa Defensif' : 'Defensive Engineering Pattern'}</div>
              <p class="text-xs sm:text-sm text-blue-200">${this.t(mod.chaosLab.defensivePattern)}</p>
            </div>

            <div class="pt-2 flex justify-between">
              <button onclick="app.setModuleTab('lab')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
                ← Lab
              </button>
              <button onclick="app.setModuleTab('quiz')" class="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white transition-colors">
                ${t.btnTakeQuiz}
              </button>
            </div>
          </div>
        `;
      case "quiz":
        return `
          <div class="space-y-6">
            <div>
              <span class="badge badge-neutral">${t.tabQuiz}</span>
              <h3 class="text-lg font-bold text-white mt-1">${this.lang === 'id' ? 'Evaluasi Pemahaman Prinsip' : 'Verification Assessment'}</h3>
              <p class="text-xs text-slate-400 mt-1">${this.lang === 'id' ? 'Jawab pertanyaan logika ini untuk menguji pemahaman Anda sebelum lanjut.' : 'Answer these first-principles questions to verify mastery before advancing.'}</p>
            </div>

            <div class="space-y-5" id="quiz-container">
              ${mod.quiz.map((q, qIdx) => `
                <div class="p-5 rounded-xl bg-[#090d16] border border-slate-800 space-y-3">
                  <div class="text-xs sm:text-sm font-medium text-slate-200">
                    <span class="text-blue-400 font-mono">Q${qIdx + 1}:</span> ${this.t(q.question)}
                  </div>
                  <div class="space-y-2 pt-1">
                    ${q.options.map((opt, oIdx) => `
                      <label class="flex items-start gap-3 p-3 rounded-lg bg-[#0e1422] border border-slate-800 hover:border-slate-700 cursor-pointer text-xs text-slate-300 transition-colors">
                        <input type="radio" name="quiz_${mod.id}_${qIdx}" value="${oIdx}" class="mt-0.5 text-blue-600 focus:ring-0">
                        <span>${this.t(opt)}</span>
                      </label>
                    `).join('')}
                  </div>
                  <div id="quiz-feedback-${qIdx}" class="hidden p-3 rounded-lg text-xs leading-relaxed"></div>
                </div>
              `).join('')}
            </div>

            <div class="pt-2 flex justify-between items-center">
              <button onclick="app.setModuleTab('chaos')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
                ← Chaos Lab
              </button>
              <button onclick="app.submitQuiz('${mod.id}')" class="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors">
                ${t.btnCheckAnswers}
              </button>
            </div>
          </div>
        `;
    }
  }

  setActiveLevel(lvlId) {
    this.activeLevelId = lvlId;
    const lvl = CURRICULUM_DATA.find(l => l.levelId === lvlId);
    if (lvl && lvl.modules.length > 0) {
      this.activeModuleId = lvl.modules[0].id;
    }
    this.renderView();
  }

  setActiveModule(modId) {
    this.activeModuleId = modId;
    this.renderView();
  }

  setModuleTab(tab) {
    this.activeModuleTab = tab;
    this.renderView();
  }

  toggleModuleCompletion(modId) {
    if (this.completedModules.includes(modId)) {
      this.completedModules = this.completedModules.filter(id => id !== modId);
    } else {
      this.completedModules.push(modId);
    }
    localStorage.setItem("df_completed_modules", JSON.stringify(this.completedModules));
    this.renderHeaderStats();
    this.renderView();
  }

  submitQuiz(modId) {
    const activeLevel = CURRICULUM_DATA.find(l => l.levelId === this.activeLevelId);
    const mod = activeLevel.modules.find(m => m.id === modId);
    if (!mod) return;

    let totalCorrect = 0;
    mod.quiz.forEach((q, qIdx) => {
      const selected = document.querySelector(`input[name="quiz_${modId}_${qIdx}"]:checked`);
      const feedbackEl = document.getElementById(`quiz-feedback-${qIdx}`);
      if (!feedbackEl) return;

      feedbackEl.classList.remove("hidden");
      const explanationText = this.t(q.explanation);
      const correctOptionText = this.t(q.options[q.correct]);

      if (selected && parseInt(selected.value) === q.correct) {
        totalCorrect++;
        feedbackEl.className = "p-3 rounded-lg text-xs leading-relaxed bg-emerald-950/30 border border-emerald-800/40 text-emerald-300";
        feedbackEl.innerHTML = `<strong>${this.lang === 'id' ? 'Benar!' : 'Correct!'}</strong> ${explanationText}`;
      } else {
        feedbackEl.className = "p-3 rounded-lg text-xs leading-relaxed bg-rose-950/30 border border-rose-800/40 text-rose-300";
        feedbackEl.innerHTML = `<strong>${this.lang === 'id' ? 'Kurang tepat.' : 'Incorrect.'}</strong> ${this.lang === 'id' ? 'Jawaban yang tepat' : 'Correct answer'}: <em>"${correctOptionText}"</em>. <br/>${explanationText}`;
      }
    });

    if (totalCorrect === mod.quiz.length) {
      if (!this.completedModules.includes(modId)) {
        this.completedModules.push(modId);
        localStorage.setItem("df_completed_modules", JSON.stringify(this.completedModules));
        this.renderHeaderStats();
      }
    }
  }

  // ================= INTERVIEW SIMULATOR VIEW =================
  renderInterviewView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="badge badge-neutral">${this.lang === 'id' ? 'Simulasi Karir' : 'Career Engine'}</span>
            <h1 class="text-xl sm:text-2xl font-bold text-white">${t.interviewTitle}</h1>
            <p class="text-xs sm:text-sm text-slate-300">${t.interviewSubtitle}</p>
          </div>
          <div class="flex rounded-xl bg-[#090d16] border border-slate-800 p-1 text-xs font-medium">
            <button onclick="app.setInterviewTab('system-design')" class="px-3.5 py-1.5 rounded-lg transition-colors ${this.activeInterviewTab === 'system-design' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}">
              ${t.tabSystemDesign}
            </button>
            <button onclick="app.setInterviewTab('sql-arena')" class="px-3.5 py-1.5 rounded-lg transition-colors ${this.activeInterviewTab === 'sql-arena' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}">
              ${t.tabSqlArena}
            </button>
            <button onclick="app.setInterviewTab('incidents')" class="px-3.5 py-1.5 rounded-lg transition-colors ${this.activeInterviewTab === 'incidents' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}">
              ${t.tabIncidents}
            </button>
          </div>
        </div>

        ${this.renderInterviewTabContent(t)}
      </div>
    `;
  }

  renderInterviewTabContent(t) {
    if (this.activeInterviewTab === "system-design") {
      const scenario = INTERVIEW_DATA.systemDesignScenarios.find(s => s.id === this.activeSystemDesignId) || INTERVIEW_DATA.systemDesignScenarios[0];
      return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-4 space-y-2">
            <div class="text-xs font-semibold uppercase text-slate-400 px-1 mb-2">${this.lang === 'id' ? 'Daftar Skenario' : 'Scenarios List'} (${INTERVIEW_DATA.systemDesignScenarios.length})</div>
            ${INTERVIEW_DATA.systemDesignScenarios.map(s => `
              <button 
                onclick="app.setActiveSystemDesign('${s.id}')"
                class="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-colors space-y-1.5 ${s.id === this.activeSystemDesignId ? 'bg-blue-600/15 border-blue-500/50 text-blue-300' : 'bg-[#0f1523] border-slate-800 text-slate-300 hover:bg-[#161d2e]'}"
              >
                <div class="flex items-center justify-between">
                  <span class="badge ${s.difficulty === 'Hard' ? 'badge-rose' : 'badge-amber'}">${s.difficulty}</span>
                </div>
                <div class="font-semibold text-slate-100">${this.t(s.title)}</div>
                <div class="flex flex-wrap gap-1 pt-1">
                  ${s.tags.slice(0, 3).map(tag => `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">${tag}</span>`).join('')}
                </div>
              </button>
            `).join('')}
          </div>

          <div class="lg:col-span-8 space-y-6">
            <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
              <span class="badge badge-neutral">${scenario.difficulty} System Design</span>
              <h2 class="text-xl font-bold text-white">${this.t(scenario.title)}</h2>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#090d16] p-4 rounded-xl border border-slate-800">
                ${this.t(scenario.scenarioDescription)}
              </p>
            </div>

            <div class="space-y-4">
              ${scenario.stages.map((stage, sIdx) => `
                <div class="rounded-xl bg-[#0f1523] border border-slate-800 overflow-hidden">
                  <div class="p-4 bg-[#090d16] flex items-center justify-between cursor-pointer" onclick="app.toggleStage('${sIdx}')">
                    <div class="font-medium text-slate-200 text-sm flex items-center gap-2">
                      <span class="w-5 h-5 rounded bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-mono">${sIdx + 1}</span>
                      ${this.t(stage.stageName)}
                    </div>
                    <button class="text-xs text-blue-400 hover:text-blue-300 font-medium">${this.lang === 'id' ? 'Buka Solusi & Rubrik' : 'Toggle Blueprint'}</button>
                  </div>
                  <div class="p-5 space-y-3" id="stage-content-${sIdx}">
                    <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${t.interviewerPrompt}</div>
                    <p class="text-xs text-slate-300 italic">${this.t(stage.prompt)}</p>
                    <div class="text-xs font-semibold text-emerald-400 uppercase tracking-wider pt-2">${t.candidateSolution}</div>
                    <div class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-[#070a10] p-4 rounded-xl border border-slate-800 font-mono">${this.t(stage.sampleAnswer)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeInterviewTab === "sql-arena") {
      const problem = INTERVIEW_DATA.sqlArenaProblems.find(p => p.id === this.activeSqlId) || INTERVIEW_DATA.sqlArenaProblems[0];
      return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-4 space-y-2">
            <div class="text-xs font-semibold uppercase text-slate-400 px-1 mb-2">FAANG SQL Arena (${INTERVIEW_DATA.sqlArenaProblems.length})</div>
            ${INTERVIEW_DATA.sqlArenaProblems.map(p => `
              <button 
                onclick="app.setActiveSql('${p.id}')"
                class="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-colors space-y-1.5 ${p.id === this.activeSqlId ? 'bg-blue-600/15 border-blue-500/50 text-blue-300' : 'bg-[#0f1523] border-slate-800 text-slate-300 hover:bg-[#161d2e]'}"
              >
                <div class="flex items-center justify-between">
                  <span class="badge ${p.difficulty === 'Hard' ? 'badge-rose' : 'badge-amber'}">${p.difficulty}</span>
                  <span class="text-[11px] text-slate-400 font-mono">${p.company}</span>
                </div>
                <div class="font-semibold text-slate-100">${this.t(p.title)}</div>
                <div class="text-[11px] text-slate-400">${p.category}</div>
              </button>
            `).join('')}
          </div>

          <div class="lg:col-span-8 space-y-6">
            <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
              <div class="flex items-center justify-between text-xs">
                <span class="badge badge-neutral">${problem.company}</span>
                <span class="text-slate-400 font-mono">${problem.category}</span>
              </div>
              <h2 class="text-xl font-bold text-white">${this.t(problem.title)}</h2>
              <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                ${this.t(problem.problemStatement)}
              </div>
            </div>

            <div class="p-4 rounded-xl bg-[#0f1523] border border-slate-800 space-y-2">
              <div class="text-xs font-semibold uppercase text-slate-400">Database Schema DDL</div>
              <pre><code>${problem.schema}</code></pre>
            </div>

            <div class="p-5 rounded-xl bg-[#0f1523] border border-slate-800 space-y-3">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold uppercase text-emerald-400">${this.lang === 'id' ? 'Solusi SQL Standar Senior' : 'Senior SQL Solution'}</span>
                <span class="text-slate-400 font-mono">${problem.complexity}</span>
              </div>
              <pre><code>${this.escapeHtml(problem.solutionSql)}</code></pre>
              <div class="p-3.5 rounded-lg bg-[#090d16] border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <strong class="text-blue-400">${this.lang === 'id' ? 'Kunci Evaluasi' : 'Evaluation Key'}:</strong> ${this.t(problem.explanation)}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeInterviewTab === "incidents") {
      const drill = INTERVIEW_DATA.incidentPostMortemDrills.find(d => d.id === this.activeDrillId) || INTERVIEW_DATA.incidentPostMortemDrills[0];
      return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-4 space-y-2">
            <div class="text-xs font-semibold uppercase text-slate-400 px-1 mb-2">${this.lang === 'id' ? 'Daftar Kasus Insiden' : 'Crisis Drills'}</div>
            ${INTERVIEW_DATA.incidentPostMortemDrills.map(d => `
              <button 
                onclick="app.setActiveDrill('${d.id}')"
                class="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-colors space-y-1.5 ${d.id === this.activeDrillId ? 'bg-blue-600/15 border-blue-500/50 text-blue-300' : 'bg-[#0f1523] border-slate-800 text-slate-300 hover:bg-[#161d2e]'}"
              >
                <span class="badge badge-rose">Incident Drill</span>
                <div class="font-semibold text-slate-100">${this.t(d.title)}</div>
              </button>
            `).join('')}
          </div>

          <div class="lg:col-span-8 space-y-6">
            <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
              <span class="badge badge-rose">Incident Simulation</span>
              <h2 class="text-xl font-bold text-white">${this.t(drill.title)}</h2>
              <div class="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs sm:text-sm text-rose-200 leading-relaxed">
                ${this.t(drill.scenario)}
              </div>
            </div>

            <div class="space-y-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">${this.lang === 'id' ? 'Protokol Triage 60 Menit' : '60-Minute Triage Rubric'}</h3>
              ${drill.rubric.map((r, rIdx) => `
                <div class="p-4 rounded-xl bg-[#0f1523] border border-slate-800 space-y-1.5">
                  <div class="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <span class="w-5 h-5 rounded bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-mono">${rIdx + 1}</span>
                    ${this.t(r.phase)}
                  </div>
                  <p class="text-xs sm:text-sm text-slate-300 leading-relaxed pl-7">${this.t(r.action)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  setInterviewTab(tab) {
    this.activeInterviewTab = tab;
    this.renderView();
  }

  setActiveSystemDesign(id) {
    this.activeSystemDesignId = id;
    this.renderView();
  }

  setActiveSql(id) {
    this.activeSqlId = id;
    this.renderView();
  }

  setActiveDrill(id) {
    this.activeDrillId = id;
    this.renderView();
  }

  toggleStage(sIdx) {
    const el = document.getElementById(`stage-content-${sIdx}`);
    if (el) el.classList.toggle("hidden");
  }

  // ================= PORTFOLIO BLUEPRINT VIEW =================
  renderPortfolioView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const proj = PORTFOLIO_DATA.projects.find(p => p.id === this.activePortfolioId) || PORTFOLIO_DATA.projects[0];
    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-1">
          <span class="badge badge-neutral">${this.lang === 'id' ? 'Portofolio Produksi' : 'Proof-of-Work'}</span>
          <h1 class="text-xl sm:text-2xl font-bold text-white">${t.portfolioTitle}</h1>
          <p class="text-xs sm:text-sm text-slate-300">${t.portfolioSubtitle}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${PORTFOLIO_DATA.projects.map(p => `
            <div 
              onclick="app.setActivePortfolio('${p.id}')"
              class="cursor-pointer p-4 rounded-xl border transition-colors space-y-2 ${p.id === this.activePortfolioId ? 'bg-blue-600/10 border-blue-500' : 'bg-[#0f1523] border-slate-800 hover:border-slate-700'}"
            >
              <span class="badge badge-neutral">${this.t(p.badge)}</span>
              <h3 class="font-semibold text-slate-100 text-sm">${this.t(p.title)}</h3>
              <p class="text-xs text-slate-400 line-clamp-2">${this.t(p.summary)}</p>
            </div>
          `).join('')}
        </div>

        <div class="space-y-6">
          <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
            <span class="badge badge-neutral">${this.t(proj.badge)}</span>
            <h2 class="text-xl font-bold text-white">${this.t(proj.title)}</h2>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${this.t(proj.summary)}</p>

            <div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-1 mt-3">
              <div class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">${t.whyHiringManagersLoveTitle}</div>
              <p class="text-xs text-emerald-200/90 leading-relaxed">${this.t(proj.whyHiringManagersLoveIt)}</p>
            </div>
          </div>

          <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
            <h3 class="text-sm font-semibold uppercase text-white">${t.architectureStackTitle}</h3>
            <div class="space-y-2">
              ${proj.architecture.map(a => `
                <div class="p-3.5 rounded-lg bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  ${this.t(a)}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
            <div class="flex items-center justify-between text-xs">
              <h3 class="font-semibold uppercase text-white">${t.adrTitle}</h3>
              <span class="badge badge-emerald">Status: ${proj.adr.status}</span>
            </div>
            <div class="p-4 rounded-xl bg-[#070a10] border border-slate-800 space-y-2.5 font-mono text-xs">
              <div class="text-sm font-bold text-blue-400">${this.t(proj.adr.title)}</div>
              <div><strong class="text-slate-400">Context:</strong> <span class="text-slate-300">${this.t(proj.adr.context)}</span></div>
              <div><strong class="text-slate-400">Decision:</strong> <span class="text-slate-300">${this.t(proj.adr.decision)}</span></div>
              <div><strong class="text-slate-400">Consequences:</strong> <span class="text-slate-300">${this.t(proj.adr.consequences)}</span></div>
            </div>
          </div>

          <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-2">
            <h3 class="text-sm font-semibold uppercase text-white">${t.repoLayoutTitle}</h3>
            <pre><code>${proj.repoStructure}</code></pre>
          </div>

          <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3">
            <h3 class="text-sm font-semibold uppercase text-white">${t.interviewDefenseTitle}</h3>
            <div class="space-y-3">
              ${proj.interviewDefense.map(qa => `
                <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  ${this.t(qa)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setActivePortfolio(id) {
    this.activePortfolioId = id;
    this.renderView();
  }

  // ================= ATS CV BUILDER VIEW =================
  renderCvBuilderView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    const resume = this.resumeData;
    const atsScore = this.calculateAtsScore();

    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="badge badge-neutral">${this.lang === 'id' ? 'Resume Internasional' : 'Global Resume'}</span>
            <h1 class="text-xl sm:text-2xl font-bold text-white">${t.cvTitle}</h1>
            <p class="text-xs sm:text-sm text-slate-300">${t.cvSubtitle}</p>
          </div>
          <div class="flex items-center gap-3 no-print">
            <button onclick="app.loadSampleCv()" class="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors">
              ${t.btnLoadTemplate}
            </button>
            <button onclick="window.print()" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors">
              ${t.btnPrintPdf}
            </button>
          </div>
        </div>

        <!-- ATS Score Real-Time Audit Card -->
        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4 no-print">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-0.5">
              <h2 class="text-base font-bold text-white flex items-center gap-2">
                <span>${t.atsScoreTitle}</span>
                <span class="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">${atsScore.totalScore}/100</span>
              </h2>
              <p class="text-xs text-slate-400">${t.atsScoreSubtitle}</p>
            </div>
            <div class="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div class="bg-blue-500 h-2 rounded-full" style="width: ${atsScore.totalScore}%"></div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div class="p-3 rounded-lg bg-[#090d16] border border-slate-800">
              <div class="text-slate-400">${t.metricDensity}</div>
              <div class="font-bold text-slate-200 mt-1 font-mono">${atsScore.breakdown.metrics}/25</div>
            </div>
            <div class="p-3 rounded-lg bg-[#090d16] border border-slate-800">
              <div class="text-slate-400">${t.techSignals}</div>
              <div class="font-bold text-slate-200 mt-1 font-mono">${atsScore.breakdown.tech}/25</div>
            </div>
            <div class="p-3 rounded-lg bg-[#090d16] border border-slate-800">
              <div class="text-slate-400">${t.roleDiff}</div>
              <div class="font-bold text-slate-200 mt-1 font-mono">${atsScore.breakdown.differentiation}/25</div>
            </div>
            <div class="p-3 rounded-lg bg-[#090d16] border border-slate-800">
              <div class="text-slate-400">${t.actionVerbs}</div>
              <div class="font-bold text-slate-200 mt-1 font-mono">${atsScore.breakdown.actionVerbs}/25</div>
            </div>
          </div>

          ${atsScore.recommendations.length > 0 ? `
            <div class="p-3.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 space-y-1">
              <div class="font-semibold uppercase tracking-wider text-[11px] text-amber-400">${t.suggestionsTitle}</div>
              <ul class="list-disc list-inside space-y-0.5">
                ${atsScore.recommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-5 space-y-4 no-print">
            <div class="p-5 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4 text-xs">
              <h3 class="font-bold text-slate-200 text-sm">${this.lang === 'id' ? 'Detail Informasi Resume' : 'Resume Editor'}</h3>
              <div class="space-y-3">
                <div>
                  <label class="block text-slate-400 mb-1">Full Name</label>
                  <input type="text" value="${resume.personal.fullName}" oninput="app.updateCvField('personal.fullName', this.value)" class="w-full bg-[#090d16] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Title</label>
                  <input type="text" value="${resume.personal.title}" oninput="app.updateCvField('personal.title', this.value)" class="w-full bg-[#090d16] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-slate-400 mb-1">Email</label>
                    <input type="text" value="${resume.personal.email}" oninput="app.updateCvField('personal.email', this.value)" class="w-full bg-[#090d16] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Location</label>
                    <input type="text" value="${resume.personal.location}" oninput="app.updateCvField('personal.location', this.value)" class="w-full bg-[#090d16] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                  </div>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Summary</label>
                  <textarea rows="3" oninput="app.updateCvField('summary', this.value)" class="w-full bg-[#090d16] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">${resume.summary}</textarea>
                </div>
              </div>
            </div>

            <!-- Bullet Formula Assistant -->
            <div class="p-5 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-3 text-xs">
              <h3 class="font-bold text-slate-200 text-sm">XYZ Bullet Formulas</h3>
              <p class="text-slate-400">${this.lang === 'id' ? 'Klik untuk menyalin peluru resume berstandar internasional:' : 'Click to copy production bullets:'}</p>
              <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                ${CV_DATA.bulletLibrary.map(cat => `
                  <div class="space-y-1">
                    <div class="text-[11px] font-semibold text-blue-400 uppercase">${cat.category}</div>
                    ${cat.bullets.map(b => `
                      <div onclick="navigator.clipboard.writeText('${b.replace(/'/g, "\\'")}'); alert('Copied to clipboard!');" class="p-2 rounded bg-[#090d16] border border-slate-800 hover:border-slate-700 cursor-pointer text-[11px] text-slate-300 transition-colors">
                        ${b}
                      </div>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Live Resume Preview (Right) -->
          <div class="lg:col-span-7">
            <div id="cv-preview-card" class="p-8 rounded-2xl bg-white text-slate-900 shadow-xl space-y-5 min-h-[800px] border border-slate-200 font-sans">
              <div class="border-b border-slate-300 pb-3 space-y-1 text-center">
                <h1 class="text-xl font-bold tracking-tight text-slate-900 uppercase">${resume.personal.fullName}</h1>
                <div class="text-xs font-semibold text-blue-700">${resume.personal.title}</div>
                <div class="text-[11px] text-slate-600 flex flex-wrap justify-center gap-2 pt-0.5">
                  <span>${resume.personal.email}</span>
                  <span>•</span>
                  <span>${resume.personal.location}</span>
                  <span>•</span>
                  <span>${resume.personal.linkedin}</span>
                </div>
              </div>

              <div class="space-y-1">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Summary</h3>
                <p class="text-[11px] text-slate-700 leading-relaxed">${resume.summary}</p>
              </div>

              <div class="space-y-1">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Technical Proficiencies</h3>
                <div class="text-[11px] space-y-0.5 text-slate-700">
                  <div><strong>Engines:</strong> ${resume.skills.languages}</div>
                  <div><strong>Storage:</strong> ${resume.skills.storageTableFormats}</div>
                  <div><strong>Streaming:</strong> ${resume.skills.processingStreaming}</div>
                  <div><strong>Orchestration:</strong> ${resume.skills.orchestrationOps}</div>
                </div>
              </div>

              <div class="space-y-2.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Experience</h3>
                ${resume.experience.map(exp => `
                  <div class="space-y-0.5">
                    <div class="flex items-center justify-between text-[11px] font-bold text-slate-900">
                      <span>${exp.company} — ${exp.role}</span>
                      <span class="text-slate-500 font-normal">${exp.period}</span>
                    </div>
                    <ul class="list-disc list-outside ml-4 space-y-0.5 text-[11px] text-slate-700">
                      ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>

              <div class="space-y-1.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Projects</h3>
                ${resume.projects.map(p => `
                  <div class="text-[11px]">
                    <div class="font-bold text-slate-900">${p.name} <span class="font-normal text-slate-500">(${p.tech})</span></div>
                    <p class="text-slate-700">${p.description}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  updateCvField(path, val) {
    if (path.startsWith("personal.")) {
      const field = path.split(".")[1];
      this.resumeData.personal[field] = val;
    } else {
      this.resumeData[path] = val;
    }
    localStorage.setItem("df_resume_data", JSON.stringify(this.resumeData));
    this.renderView();
  }

  loadSampleCv() {
    this.resumeData = JSON.parse(JSON.stringify(CV_DATA.sampleResume));
    localStorage.setItem("df_resume_data", JSON.stringify(this.resumeData));
    this.renderView();
  }

  calculateAtsScore() {
    let score = {
      totalScore: 0,
      breakdown: { metrics: 15, tech: 20, differentiation: 20, actionVerbs: 20 },
      recommendations: []
    };

    const textToScan = JSON.stringify(this.resumeData).toLowerCase();
    const metricMatches = (textToScan.match(/(\d+%|\$\d+|\d+gb|\d+tb|\d+ms|\d+m|\d+k)/g) || []).length;
    score.breakdown.metrics = Math.min(25, metricMatches * 3);
    if (score.breakdown.metrics < 20) {
      score.recommendations.push(this.lang === 'id' ? "Tambahkan metrik angka terukur (omset $, volume GB/TB, latensi ms)." : "Add more quantifiable metrics (throughput, latency, cost savings).");
    }

    const techKeywords = ["iceberg", "duckdb", "dbt", "dagster", "redpanda", "kafka", "pydantic", "flink", "terraform"];
    const foundKeywords = techKeywords.filter(k => textToScan.includes(k));
    score.breakdown.tech = Math.min(25, foundKeywords.length * 3);

    const verbs = ["architected", "engineered", "optimized", "refactored", "deployed", "scaled"];
    const foundVerbs = verbs.filter(v => textToScan.includes(v));
    score.breakdown.actionVerbs = Math.min(25, foundVerbs.length * 4);

    if (textToScan.includes("dashboard") && !textToScan.includes("idempotency") && !textToScan.includes("cdc")) {
      score.breakdown.differentiation = 12;
      score.recommendations.push(this.lang === 'id' ? "Kurangi istilah dashboard/reporting. Tunjukkan pipeline terdistribusi & reliabilitas." : "Focus more on distributed pipelines, latency, CDC, and reliability over BI reporting.");
    } else {
      score.breakdown.differentiation = 25;
    }

    score.totalScore = score.breakdown.metrics + score.breakdown.tech + score.breakdown.differentiation + score.breakdown.actionVerbs;
    return score;
  }

  // ================= PLAYGROUND VIEW =================
  renderPlaygroundView() {
    const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="badge badge-neutral">In-Browser Sandbox</span>
            <h1 class="text-xl sm:text-2xl font-bold text-white">${t.playgroundTitle}</h1>
            <p class="text-xs sm:text-sm text-slate-300">${t.playgroundSubtitle}</p>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs text-slate-400 font-medium">${t.datasetLabel}</label>
            <select id="pg-dataset-select" onchange="app.changePlaygroundDataset(this.value)" class="bg-[#090d16] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none">
              <option value="ecommerce">E-Commerce Schema (Customers & Orders)</option>
              <option value="user_activity">User Activity (Gaps & Islands)</option>
            </select>
          </div>
        </div>

        <div class="rounded-2xl bg-[#0f1523] border border-slate-800 p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-xs">
              <span class="font-medium text-slate-300">${t.presetQueriesLabel}</span>
              <button onclick="app.loadPresetSql(1)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">Customer LTV Join</button>
              <button onclick="app.loadPresetSql(2)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">Gaps & Islands Streaks</button>
              <button onclick="app.loadPresetSql(3)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">Raw Fact Table</button>
            </div>
            <button onclick="app.executePlaygroundQuery()" class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">
              ${t.btnExecuteSql}
            </button>
          </div>

          <textarea id="pg-sql-editor" rows="6" class="w-full bg-[#070a10] border border-slate-800 rounded-xl p-4 font-mono text-xs text-blue-300 focus:border-blue-500 outline-none leading-relaxed">SELECT 
    c.customer_id,
    c.name,
    c.tier,
    COUNT(o.order_id) AS total_orders,
    SUM(o.amount) AS total_spent_usd
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY 1, 2, 3
ORDER BY total_spent_usd DESC;</textarea>
        </div>

        <div class="rounded-2xl bg-[#0f1523] border border-slate-800 p-5 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-slate-200">Execution Output</span>
            <span id="pg-result-stats" class="text-slate-400 font-mono">${t.readyToExecute}</span>
          </div>
          <div id="pg-results-container" class="overflow-x-auto min-h-[140px] rounded-xl bg-[#070a10] border border-slate-800 p-2">
            <div class="p-8 text-center text-xs text-slate-500">${t.runQueryPrompt}</div>
          </div>
        </div>
      </div>
    `;
  }

  changePlaygroundDataset(val) {
    if (val === "user_activity") {
      this.loadPresetSql(2);
    } else {
      this.loadPresetSql(1);
    }
  }

  loadPresetSql(id) {
    const editor = document.getElementById("pg-sql-editor");
    if (!editor) return;

    if (id === 1) {
      editor.value = `SELECT 
    c.customer_id,
    c.name,
    c.tier,
    COUNT(o.order_id) AS total_orders,
    SUM(o.amount) AS total_spent_usd
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY 1, 2, 3
ORDER BY total_spent_usd DESC;`;
      const sel = document.getElementById("pg-dataset-select");
      if (sel) sel.value = "ecommerce";
    } else if (id === 2) {
      editor.value = `WITH streak_ranked AS (
    SELECT 
        user_id,
        login_date,
        login_date - DENSE_RANK() OVER (PARTITION BY user_id ORDER BY login_date) AS streak_group
    FROM logins
)
SELECT 
    user_id,
    COUNT(*) AS longest_active_streak
FROM streak_ranked
GROUP BY user_id, streak_group
ORDER BY longest_active_streak DESC;`;
      const sel = document.getElementById("pg-dataset-select");
      if (sel) sel.value = "user_activity";
    } else if (id === 3) {
      editor.value = `SELECT * FROM orders WHERE status = 'COMPLETED' LIMIT 10;`;
    }
    this.executePlaygroundQuery();
  }

  executePlaygroundQuery() {
    const editor = document.getElementById("pg-sql-editor");
    const container = document.getElementById("pg-results-container");
    const stats = document.getElementById("pg-result-stats");
    const sel = document.getElementById("pg-dataset-select");
    if (!editor || !container) return;

    const datasetKey = sel ? sel.value : "ecommerce";
    const res = SQL_PLAYGROUND.executeQuery(editor.value, datasetKey);

    if (res.success && res.rows.length > 0) {
      const keys = Object.keys(res.rows[0]);
      if (stats) stats.innerText = `${res.rows.length} rows returned in 2.1ms`;
      container.innerHTML = `
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 font-mono">
              ${keys.map(k => `<th class="p-2.5 font-semibold">${k}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-mono text-slate-300">
            ${res.rows.map(row => `
              <tr class="hover:bg-slate-900/50">
                ${keys.map(k => `<td class="p-2.5">${row[k] !== undefined ? row[k] : 'null'}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (res.success) {
      if (stats) stats.innerText = `0 rows returned`;
      container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">0 rows returned.</div>`;
    } else {
      if (stats) stats.innerText = `Error`;
      container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg">Error: ${res.error}</div>`;
    }
  }

  // ================= REMOTE PLAYBOOK VIEW =================
  renderRemotePlaybookView() {
    const pb = window.REMOTE_PLAYBOOK;
    if (!pb) return `<div class="p-8 text-center text-slate-400">Remote Playbook data loading...</div>`;
    const ov = pb.overview[this.lang] || pb.overview.en;
    return `
      <div class="animate-fade space-y-8 max-w-6xl mx-auto">
        <div class="p-8 sm:p-10 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <div class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400">
            Global Remote Career & Communication
          </div>
          <h1 class="text-2xl sm:text-3xl font-bold text-white">${ov.title}</h1>
          <p class="text-slate-300 text-sm leading-relaxed">${ov.subtitle}</p>
          <div class="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs sm:text-sm text-blue-200/90 leading-relaxed">
            <strong>${this.lang === 'id' ? 'Mengapa Ini Jauh Lebih Penting daripada TOEFL/IELTS?' : 'Why is this more crucial than TOEFL/IELTS?'}</strong><br/>
            ${ov.whyImportant}
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <h2 class="text-lg font-bold text-white">${this.t(pb.sections[0].title)}</h2>
          <p class="text-xs text-slate-400">${this.t(pb.sections[0].description)}</p>
          <div class="space-y-3">
            ${pb.sections[0].templates.map(t => `
              <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                <div class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">${t.stage}</div>
                <div class="p-3 rounded-lg bg-[#0e1422] border border-slate-800 font-mono text-xs text-blue-300 leading-relaxed select-all">
                  "${t.pattern}"
                </div>
                <div class="text-xs text-slate-400"><strong>${this.lang === 'id' ? 'Kenapa Pola Ini Disukai Interviewer:' : 'Why Interviewers Love This:'}</strong> ${t.whyItWorks}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <h2 class="text-lg font-bold text-white">${this.t(pb.sections[1].title)}</h2>
          <p class="text-xs text-slate-400">${this.t(pb.sections[1].description)}</p>
          <div class="space-y-2">
            <div class="text-xs font-semibold text-slate-400 uppercase">Production RFC Example (Markdown)</div>
            <pre><code>${this.escapeHtml(pb.sections[1].sampleRfc)}</code></pre>
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <h2 class="text-lg font-bold text-white">${this.t(pb.sections[2].title)}</h2>
          <p class="text-xs text-slate-400">${this.t(pb.sections[2].description)}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${pb.sections[2].slackTemplates.map(st => `
              <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                <div class="text-xs font-semibold text-rose-400 uppercase tracking-wider">${st.phase}</div>
                <pre class="text-xs font-mono text-slate-200 whitespace-pre-line bg-[#0e1422] p-3 rounded border border-slate-800">${this.escapeHtml(st.text)}</pre>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <h2 class="text-lg font-bold text-white">${this.t(pb.sections[3].title)}</h2>
          <p class="text-xs text-slate-400">${this.t(pb.sections[3].description)}</p>
          <div class="space-y-3">
            ${pb.sections[3].starExamples.map(star => `
              <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                <div class="text-xs font-semibold text-purple-400 uppercase">Question: "${star.question}"</div>
                <div class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line p-3 rounded-lg bg-[#0e1422] border border-slate-800">${star.answer}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#0f1523] border border-slate-800 space-y-4">
          <h2 class="text-lg font-bold text-white">${this.t(pb.sections[4].title)}</h2>
          <p class="text-xs text-slate-400">${this.t(pb.sections[4].description)}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${pb.sections[4].tips.map(tip => `
              <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                <div class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">${tip.topic}</div>
                <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${tip.detail}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Bootstrap application on DOM load
window.addEventListener("DOMContentLoaded", () => {
  window.app = new DataForgeApp();
});
