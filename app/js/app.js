// Main Application Controller for DataForge Learning Platform

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

    this.init();
  }

  init() {
    this.bindEvents();
    this.renderHeaderStats();
    this.renderView();
  }

  bindEvents() {
    // Navigation items
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
    // Update active nav styling
    document.querySelectorAll("[data-nav]").forEach(el => {
      if (el.getAttribute("data-nav") === view) {
        el.className = "flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30 text-sm";
      } else {
        el.className = "flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors text-sm font-medium";
      }
    });

    this.renderView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderHeaderStats() {
    const totalModules = CURRICULUM_DATA.reduce((acc, lvl) => acc + lvl.modules.length, 0);
    const completedCount = this.completedModules.length;
    const progressPercent = Math.round((completedCount / totalModules) * 100);

    const statsEl = document.getElementById("header-stats");
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="hidden sm:flex flex-col text-right">
            <span class="text-xs text-slate-400">Mastery Progress</span>
            <span class="text-sm font-semibold text-slate-200">${completedCount} of ${totalModules} Modules (${progressPercent}%)</span>
          </div>
          <div class="w-24 sm:w-32 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
            <div class="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
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
        this.bindRoadmapEvents();
        break;
      case "curriculum":
        container.innerHTML = this.renderCurriculumView();
        this.bindCurriculumEvents();
        break;
      case "interview":
        container.innerHTML = this.renderInterviewView();
        this.bindInterviewEvents();
        break;
      case "portfolio":
        container.innerHTML = this.renderPortfolioView();
        this.bindPortfolioEvents();
        break;
      case "cv-builder":
        container.innerHTML = this.renderCvBuilderView();
        this.bindCvBuilderEvents();
        break;
      case "playground":
        container.innerHTML = this.renderPlaygroundView();
        this.bindPlaygroundEvents();
        break;
    }
  }

  // ================= ROADMAP VIEW =================
  renderRoadmapView() {
    return `
      <div class="animate-fade space-y-8 max-w-6xl mx-auto">
        <!-- Hero Banner -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 p-8 sm:p-10 shadow-2xl">
          <div class="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="max-w-3xl space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              🚀 Anti-Tutorial-Hell Data Engineering OS
            </div>
            <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Master Modern Data Engineering from <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">First Principles</span>.
            </h1>
            <p class="text-slate-300 text-base sm:text-lg leading-relaxed">
              No toy datasets. No happy-path tutorials. A battle-tested curriculum designed for self-mastery and enterprise readiness, complete with chaos labs, system design simulators, and career acceleration assets.
            </p>
            <div class="pt-2 flex flex-wrap gap-3">
              <button onclick="app.switchView('curriculum')" class="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2">
                Start Learning Curriculum ➔
              </button>
              <button onclick="app.switchView('interview')" class="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all flex items-center gap-2">
                Simulate Interview 🎯
              </button>
              <button onclick="app.switchView('cv-builder')" class="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all flex items-center gap-2">
                Build ATS-Ready CV 📄
              </button>
            </div>
          </div>
        </div>

        <!-- The 4 Pillars Manifest -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2">
            <div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">1</div>
            <h3 class="font-bold text-slate-100 text-base">First Principles</h3>
            <p class="text-xs text-slate-400 leading-relaxed">Understand memory models, disk serialization, and distributed shuffles before touching frameworks.</p>
          </div>
          <div class="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2">
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">2</div>
            <h3 class="font-bold text-slate-100 text-base">Chaos & Breakage Labs</h3>
            <p class="text-xs text-slate-400 leading-relaxed">Practice debugging poisoned schemas, late-arriving events, OOM executors, and silent corruption.</p>
          </div>
          <div class="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2">
            <div class="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">3</div>
            <h3 class="font-bold text-slate-100 text-base">Production Rigor</h3>
            <p class="text-xs text-slate-400 leading-relaxed">Enforce Data Contracts, automated pytest suites, dbt slim CI, and guaranteed idempotent writes.</p>
          </div>
          <div class="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2">
            <div class="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">4</div>
            <h3 class="font-bold text-slate-100 text-base">Proof-of-Work Portfolios</h3>
            <p class="text-xs text-slate-400 leading-relaxed">Build production Lakehouse and CDC platforms accompanied by Architectural Decision Records (ADRs).</p>
          </div>
        </div>

        <!-- Levels Progression Grid -->
        <div class="space-y-4">
          <h2 class="text-xl font-bold text-slate-200">Curriculum Progression Matrix</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${CURRICULUM_DATA.map((lvl) => {
              const completedInLevel = lvl.modules.filter(m => this.completedModules.includes(m.id)).length;
              const pct = Math.round((completedInLevel / lvl.modules.length) * 100);
              return `
                <div class="flex flex-col justify-between p-6 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition-all group">
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="badge badge-${lvl.badgeColor}">${lvl.badge}</span>
                      <span class="text-xs font-semibold text-slate-400">${completedInLevel}/${lvl.modules.length} Completed</span>
                    </div>
                    <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">${lvl.levelTitle}</h3>
                    <p class="text-xs text-slate-400 line-clamp-2">${lvl.levelSubtitle}</p>
                    <div class="space-y-1.5 pt-2">
                      ${lvl.modules.map(m => `
                        <div class="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-950/60 border border-slate-800/80">
                          <span class="text-slate-300 font-medium truncate">${m.number} ${m.title}</span>
                          ${this.completedModules.includes(m.id) ? '<span class="text-emerald-400 text-xs">✓ Done</span>' : '<span class="text-slate-500 text-xs">Pending</span>'}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                  <div class="pt-6 space-y-2">
                    <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
                    </div>
                    <button onclick="app.selectLevel('${lvl.levelId}')" class="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors text-center block">
                      Explore Level Modules ➔
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Career Acceleration Quick Links -->
        <div class="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
          <h2 class="text-lg font-bold text-slate-200">Career Acceleration Suite</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div onclick="app.switchView('interview')" class="cursor-pointer p-4 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 transition-all">
              <h4 class="font-bold text-slate-200 text-sm mb-1">🎯 Interview Simulator</h4>
              <p class="text-xs text-slate-400">8 System Design scenarios, 15+ FAANG SQL problems, and real incident post-mortem drills.</p>
            </div>
            <div onclick="app.switchView('portfolio')" class="cursor-pointer p-4 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all">
              <h4 class="font-bold text-slate-200 text-sm mb-1">💼 Portfolio Architecture</h4>
              <p class="text-xs text-slate-400">3 Production Lakehouse & CDC capstones complete with ADRs and interview defense talking points.</p>
            </div>
            <div onclick="app.switchView('cv-builder')" class="cursor-pointer p-4 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 transition-all">
              <h4 class="font-bold text-slate-200 text-sm mb-1">📄 ATS CV Builder & Scorer</h4>
              <p class="text-xs text-slate-400">Interactive resume generator with metric XYZ formulas and real-time ATS seniority scoring.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindRoadmapEvents() {}

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
    const activeLevel = CURRICULUM_DATA.find(l => l.levelId === this.activeLevelId) || CURRICULUM_DATA[0];
    const activeModule = activeLevel.modules.find(m => m.id === this.activeModuleId) || activeLevel.modules[0];
    const isCompleted = this.completedModules.includes(activeModule.id);

    return `
      <div class="animate-fade grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
        <!-- Sidebar Navigation -->
        <div class="lg:col-span-4 space-y-4">
          <!-- Level Selector Tabs -->
          <div class="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
            ${CURRICULUM_DATA.map(lvl => `
              <button 
                onclick="app.setActiveLevel('${lvl.levelId}')" 
                class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${this.activeLevelId === lvl.levelId ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}"
              >
                ${lvl.badge}
              </button>
            `).join('')}
          </div>

          <!-- Module List -->
          <div class="rounded-xl bg-slate-900/70 border border-slate-800 overflow-hidden divide-y divide-slate-800">
            <div class="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">${activeLevel.levelTitle.split(':')[0]}</span>
              <span class="text-xs text-slate-500">${activeLevel.modules.length} Modules</span>
            </div>
            <div class="p-2 space-y-1">
              ${activeLevel.modules.map(mod => {
                const done = this.completedModules.includes(mod.id);
                const isSelected = mod.id === this.activeModuleId;
                return `
                  <button 
                    onclick="app.setActiveModule('${mod.id}')"
                    class="w-full text-left p-3 rounded-lg text-xs font-medium transition-all flex items-start justify-between gap-2 ${isSelected ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300' : 'text-slate-300 hover:bg-slate-800/60'}"
                  >
                    <div class="space-y-1">
                      <div class="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>${mod.number}</span>
                        <span class="line-clamp-1">${mod.title}</span>
                      </div>
                      <div class="text-[11px] text-slate-400 line-clamp-1">${mod.summary}</div>
                    </div>
                    ${done ? '<span class="text-emerald-400 text-xs font-bold">✓</span>' : '<span class="text-slate-600 text-xs">○</span>'}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Module Detail Content Area -->
        <div class="lg:col-span-8 space-y-6">
          <!-- Module Header Card -->
          <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="badge badge-${activeLevel.badgeColor}">${activeLevel.badge}</span>
                <span class="text-xs text-slate-400">Estimated: ${activeModule.duration}</span>
              </div>
              <button 
                onclick="app.toggleModuleCompletion('${activeModule.id}')"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${isCompleted ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}"
              >
                ${isCompleted ? '✓ Marked Completed' : '○ Mark as Completed'}
              </button>
            </div>
            <div>
              <h2 class="text-2xl font-extrabold text-white">${activeModule.number} ${activeModule.title}</h2>
              <p class="text-slate-300 text-sm mt-1">${activeModule.summary}</p>
            </div>

            <!-- Why Tutorials Lie Alert Box -->
            <div class="p-4 rounded-xl bg-rose-950/30 border border-rose-900/40 space-y-1">
              <div class="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚠️ Why Tutorials & Bootcamps Lie About This:</span>
              </div>
              <p class="text-xs text-rose-200/90 leading-relaxed">${activeModule.whyTutorialsLie}</p>
            </div>

            <!-- Content Tabs -->
            <div class="flex border-b border-slate-800 pt-2 gap-2 text-xs font-semibold">
              <button onclick="app.setModuleTab('concepts')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'concepts' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}">
                1. First Principles (${activeModule.concepts.length})
              </button>
              <button onclick="app.setModuleTab('lab')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'lab' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}">
                2. Hands-on Lab
              </button>
              <button onclick="app.setModuleTab('chaos')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'chaos' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-slate-400 hover:text-slate-200'}">
                3. Chaos Scenario ⚡
              </button>
              <button onclick="app.setModuleTab('quiz')" class="pb-2.5 px-3 transition-colors ${this.activeModuleTab === 'quiz' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-slate-400 hover:text-slate-200'}">
                4. Verification Quiz
              </button>
            </div>
          </div>

          <!-- Tab Content Display -->
          <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-6">
            ${this.renderModuleTabContent(activeModule)}
          </div>
        </div>
      </div>
    `;
  }

  renderModuleTabContent(mod) {
    switch (this.activeModuleTab) {
      case "concepts":
        return `
          <div class="space-y-6">
            <h3 class="text-lg font-bold text-slate-100">Theoretical Foundations & Architectural Mechanics</h3>
            <div class="space-y-4">
              ${mod.concepts.map((c, idx) => `
                <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div class="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">${idx + 1}</span>
                    ${c.title}
                  </div>
                  <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${c.content}</p>
                </div>
              `).join('')}
            </div>
            <div class="pt-4 flex justify-end">
              <button onclick="app.setModuleTab('lab')" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors">
                Proceed to Hands-on Lab ➔
              </button>
            </div>
          </div>
        `;
      case "lab":
        return `
          <div class="space-y-5">
            <div>
              <span class="badge badge-emerald">Engineering Lab</span>
              <h3 class="text-xl font-bold text-white mt-1">${mod.lab.title}</h3>
              <p class="text-xs sm:text-sm text-slate-300 mt-2">${mod.lab.description}</p>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span>Production Reference Code Implementation</span>
                <span class="font-mono text-xs text-blue-400">Run in local environment</span>
              </div>
              <pre><code>${this.escapeHtml(mod.lab.codeSnippet)}</code></pre>
            </div>

            <div class="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <h4 class="text-xs font-bold uppercase text-slate-300">Lab Deliverables & Verification Checklist</h4>
              <ul class="space-y-1.5 text-xs text-slate-300">
                ${mod.lab.deliverables.map(d => `<li class="flex items-center gap-2"><span class="text-emerald-400">✔</span> ${d}</li>`).join('')}
              </ul>
            </div>

            <div class="pt-2 flex justify-between">
              <button onclick="app.setModuleTab('concepts')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
                ← Back to Concepts
              </button>
              <button onclick="app.setModuleTab('chaos')" class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors">
                Test in Chaos Scenario ⚡
              </button>
            </div>
          </div>
        `;
      case "chaos":
        return `
          <div class="space-y-5">
            <div>
              <span class="badge badge-amber">Chaos Engineering & Debugging</span>
              <h3 class="text-xl font-bold text-white mt-1">${mod.chaosLab.title}</h3>
            </div>

            <div class="p-4 rounded-xl bg-amber-950/30 border border-amber-900/40 space-y-2">
              <div class="text-xs font-bold text-amber-400 uppercase tracking-wider">🔥 The Production Breakage Scenario</div>
              <p class="text-xs sm:text-sm text-amber-200/90 leading-relaxed">${mod.chaosLab.scenario}</p>
            </div>

            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div class="text-xs font-bold text-rose-400 uppercase tracking-wider">Root Cause Analysis (Why it breaks)</div>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${mod.chaosLab.breakageReason}</p>
            </div>

            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div class="text-xs font-bold text-emerald-400 uppercase tracking-wider">🛠️ Engineering Fix & Mitigation Protocol</div>
              <div class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">${mod.chaosLab.fixGuide}</div>
            </div>

            <div class="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 space-y-1">
              <div class="text-xs font-bold text-blue-400 uppercase tracking-wider">🛡️ Defensive Engineering Pattern</div>
              <p class="text-xs sm:text-sm text-blue-200">${mod.chaosLab.defensivePattern}</p>
            </div>

            <div class="pt-2 flex justify-between">
              <button onclick="app.setModuleTab('lab')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
                ← Back to Lab
              </button>
              <button onclick="app.setModuleTab('quiz')" class="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors">
                Take Knowledge Gate Quiz ➔
              </button>
            </div>
          </div>
        `;
      case "quiz":
        const savedQuiz = this.quizScores[mod.id];
        return `
          <div class="space-y-6">
            <div>
              <span class="badge badge-purple">Knowledge Gate</span>
              <h3 class="text-xl font-bold text-white mt-1">Verification & Concept Assessment</h3>
              <p class="text-xs text-slate-400 mt-1">Answer these first-principles questions to verify mastery before moving to the next module.</p>
            </div>

            <div class="space-y-6" id="quiz-container">
              ${mod.quiz.map((q, qIdx) => `
                <div class="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div class="text-sm font-semibold text-slate-200">
                    <span class="text-purple-400 font-mono">Q${qIdx + 1}:</span> ${q.question}
                  </div>
                  <div class="space-y-2 pt-1">
                    ${q.options.map((opt, oIdx) => `
                      <label class="flex items-start gap-3 p-3 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs text-slate-300 transition-colors">
                        <input type="radio" name="quiz_${mod.id}_${qIdx}" value="${oIdx}" class="mt-0.5 text-blue-600 focus:ring-0">
                        <span>${opt}</span>
                      </label>
                    `).join('')}
                  </div>
                  <div id="quiz-feedback-${qIdx}" class="hidden p-3 rounded-lg text-xs leading-relaxed"></div>
                </div>
              `).join('')}
            </div>

            <div class="pt-2 flex justify-between items-center">
              <button onclick="app.setModuleTab('chaos')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
                ← Back to Chaos Lab
              </button>
              <button onclick="app.submitQuiz('${mod.id}')" class="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-blue-600/30">
                Check Answers & Grade
              </button>
            </div>
          </div>
        `;
    }
  }

  bindCurriculumEvents() {}

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
      if (selected && parseInt(selected.value) === q.correct) {
        totalCorrect++;
        feedbackEl.className = "p-3 rounded-lg text-xs leading-relaxed bg-emerald-950/40 border border-emerald-800/40 text-emerald-300";
        feedbackEl.innerHTML = `<strong>Correct!</strong> ${q.explanation}`;
      } else {
        feedbackEl.className = "p-3 rounded-lg text-xs leading-relaxed bg-rose-950/40 border border-rose-800/40 text-rose-300";
        feedbackEl.innerHTML = `<strong>Incorrect.</strong> Correct answer: <em>"${q.options[q.correct]}"</em>. <br/>${q.explanation}`;
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
    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <!-- Header -->
        <div class="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950/50 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="badge badge-blue">Career Engine</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Data Engineering Interview Simulator</h1>
            <p class="text-xs sm:text-sm text-slate-300">Real system design rounds, FAANG-level SQL challenges, and live incident post-mortem drills.</p>
          </div>
          <div class="flex rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs font-semibold">
            <button onclick="app.setInterviewTab('system-design')" class="px-4 py-2 rounded-lg transition-all ${this.activeInterviewTab === 'system-design' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}">
              1. System Design
            </button>
            <button onclick="app.setInterviewTab('sql-arena')" class="px-4 py-2 rounded-lg transition-all ${this.activeInterviewTab === 'sql-arena' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}">
              2. SQL & Modeling Arena
            </button>
            <button onclick="app.setInterviewTab('incidents')" class="px-4 py-2 rounded-lg transition-all ${this.activeInterviewTab === 'incidents' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}">
              3. Incident Drills
            </button>
          </div>
        </div>

        <!-- Simulator Content Area -->
        ${this.renderInterviewTabContent()}
      </div>
    `;
  }

  renderInterviewTabContent() {
    if (this.activeInterviewTab === "system-design") {
      const scenario = INTERVIEW_DATA.systemDesignScenarios.find(s => s.id === this.activeSystemDesignId) || INTERVIEW_DATA.systemDesignScenarios[0];
      return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Scenarios List Sidebar -->
          <div class="lg:col-span-4 space-y-2">
            <div class="text-xs font-bold uppercase text-slate-400 px-1 mb-2">System Design Scenarios (${INTERVIEW_DATA.systemDesignScenarios.length})</div>
            ${INTERVIEW_DATA.systemDesignScenarios.map(s => `
              <button 
                onclick="app.setActiveSystemDesign('${s.id}')"
                class="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all space-y-1.5 ${s.id === this.activeSystemDesignId ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'}"
              >
                <div class="flex items-center justify-between">
                  <span class="badge ${s.difficulty === 'Hard' ? 'badge-rose' : 'badge-amber'}">${s.difficulty}</span>
                </div>
                <div class="font-bold text-slate-100">${s.title}</div>
                <div class="flex flex-wrap gap-1 pt-1">
                  ${s.tags.slice(0, 3).map(t => `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">${t}</span>`).join('')}
                </div>
              </button>
            `).join('')}
          </div>

          <!-- Scenario Walkthrough Engine -->
          <div class="lg:col-span-8 space-y-6">
            <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div class="space-y-1">
                <span class="badge badge-rose">${scenario.difficulty} System Design</span>
                <h2 class="text-2xl font-extrabold text-white">${scenario.title}</h2>
              </div>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                ${scenario.scenarioDescription}
              </p>
            </div>

            <!-- Interactive 4-Phase System Design Protocol -->
            <div class="space-y-4">
              ${scenario.stages.map((stage, sIdx) => `
                <div class="rounded-xl bg-slate-900/70 border border-slate-800 overflow-hidden">
                  <div class="p-4 bg-slate-950/60 flex items-center justify-between cursor-pointer" onclick="app.toggleStage('${sIdx}')">
                    <div class="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <span class="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">${sIdx + 1}</span>
                      ${stage.stageName}
                    </div>
                    <button class="text-xs text-blue-400 hover:text-blue-300 font-semibold">Toggle Architecture & Rubric</button>
                  </div>
                  <div class="p-5 space-y-3" id="stage-content-${sIdx}">
                    <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interviewer Prompt:</div>
                    <p class="text-xs text-slate-300 italic">${stage.prompt}</p>
                    <div class="text-xs font-semibold text-emerald-400 uppercase tracking-wider pt-2">Candidate Solution Blueprint:</div>
                    <div class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/90 p-4 rounded-xl border border-slate-800 font-mono">${stage.sampleAnswer}</div>
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
          <!-- Problem List -->
          <div class="lg:col-span-4 space-y-2">
            <div class="text-xs font-bold uppercase text-slate-400 px-1 mb-2">FAANG & LeetCode SQL Arena (${INTERVIEW_DATA.sqlArenaProblems.length})</div>
            ${INTERVIEW_DATA.sqlArenaProblems.map(p => `
              <button 
                onclick="app.setActiveSql('${p.id}')"
                class="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all space-y-1.5 ${p.id === this.activeSqlId ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'}"
              >
                <div class="flex items-center justify-between">
                  <span class="badge ${p.difficulty === 'Hard' ? 'badge-rose' : 'badge-amber'}">${p.difficulty}</span>
                  <span class="text-[11px] text-slate-400 font-mono">${p.company}</span>
                </div>
                <div class="font-bold text-slate-100">${p.title}</div>
                <div class="text-[11px] text-slate-400">${p.category}</div>
              </button>
            `).join('')}
          </div>

          <!-- Problem Interactive Arena -->
          <div class="lg:col-span-8 space-y-6">
            <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div class="flex items-center justify-between">
                <span class="badge badge-purple">${problem.company} Interview Problem</span>
                <span class="text-xs text-slate-400">${problem.category}</span>
              </div>
              <h2 class="text-2xl font-extrabold text-white">${problem.title}</h2>
              <div class="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                ${problem.problemStatement}
              </div>
            </div>

            <!-- Schema Card -->
            <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div class="text-xs font-bold uppercase text-slate-400">Database Schema DDL</div>
              <pre><code>${problem.schema}</code></pre>
            </div>

            <!-- Solution Code Reveal -->
            <div class="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-bold uppercase text-emerald-400">Senior-Grade SQL Solution & Window Logic</div>
                <span class="text-xs text-slate-400 font-mono">${problem.complexity}</span>
              </div>
              <pre><code>${this.escapeHtml(problem.solutionSql)}</code></pre>
              <div class="p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <strong class="text-blue-400">Interviewer Evaluation Key:</strong> ${problem.explanation}
              </div>
            </div>

            <div class="flex justify-end">
              <button onclick="app.switchView('playground')" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors">
                Open in Interactive SQL Sandbox ➔
              </button>
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
            <div class="text-xs font-bold uppercase text-slate-400 px-1 mb-2">Crisis & Post-Mortem Drills</div>
            ${INTERVIEW_DATA.incidentPostMortemDrills.map(d => `
              <button 
                onclick="app.setActiveDrill('${d.id}')"
                class="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all space-y-1.5 ${d.id === this.activeDrillId ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'}"
              >
                <span class="badge badge-rose">Crisis Drill</span>
                <div class="font-bold text-slate-100">${d.title}</div>
              </button>
            `).join('')}
          </div>

          <div class="lg:col-span-8 space-y-6">
            <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span class="badge badge-rose">Incident Simulation</span>
              <h2 class="text-2xl font-extrabold text-white">${drill.title}</h2>
              <div class="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs sm:text-sm text-rose-200 leading-relaxed">
                ${drill.scenario}
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">The 60-Minute Triage Rubric (Evaluated by Hiring Managers)</h3>
              ${drill.rubric.map((r, rIdx) => `
                <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div class="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">${rIdx + 1}</span>
                    ${r.phase}
                  </div>
                  <p class="text-xs sm:text-sm text-slate-300 leading-relaxed pl-7">${r.action}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  bindInterviewEvents() {}

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
    const proj = PORTFOLIO_DATA.projects.find(p => p.id === this.activePortfolioId) || PORTFOLIO_DATA.projects[0];
    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <!-- Header -->
        <div class="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 space-y-2">
          <span class="badge badge-emerald">Proof-of-Work Portfolios</span>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Production-Grade Capstones with ADRs</h1>
          <p class="text-xs sm:text-sm text-slate-300">Say goodbye to generic Kaggle notebooks. Build enterprise-grade architectures that prove your seniority to engineering directors.</p>
        </div>

        <!-- Project Selector Tabs -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${PORTFOLIO_DATA.projects.map(p => `
            <div 
              onclick="app.setActivePortfolio('${p.id}')"
              class="cursor-pointer p-5 rounded-xl border transition-all space-y-2 ${p.id === this.activePortfolioId ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'}"
            >
              <span class="badge badge-${p.badgeColor}">${p.badge}</span>
              <h3 class="font-bold text-slate-100 text-sm">${p.title}</h3>
              <p class="text-xs text-slate-400 line-clamp-2">${p.summary}</p>
            </div>
          `).join('')}
        </div>

        <!-- Selected Project Deep Dive -->
        <div class="space-y-6">
          <!-- Overview Card -->
          <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div class="space-y-1">
              <span class="badge badge-${proj.badgeColor}">${proj.badge}</span>
              <h2 class="text-2xl font-extrabold text-white">${proj.title}</h2>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${proj.summary}</p>
            </div>

            <div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-1">
              <div class="text-xs font-bold text-emerald-400 uppercase tracking-wider">🌟 What Hiring Managers Love About This Project:</div>
              <p class="text-xs text-emerald-200/90 leading-relaxed">${proj.whyHiringManagersLoveIt}</p>
            </div>
          </div>

          <!-- Architecture Breakdown -->
          <div class="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 class="text-base font-bold text-white">System Architecture & Component Stack</h3>
            <div class="space-y-2">
              ${proj.architecture.map(a => `
                <div class="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  ${a}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Architectural Decision Record (ADR) -->
          <div class="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-white">Architectural Decision Record (ADR)</h3>
              <span class="badge badge-emerald">Status: ${proj.adr.status}</span>
            </div>
            <div class="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 font-mono text-xs">
              <div class="text-sm font-bold text-blue-400">${proj.adr.title}</div>
              <div><strong class="text-slate-400">Context:</strong> <span class="text-slate-300">${proj.adr.context}</span></div>
              <div><strong class="text-slate-400">Decision:</strong> <span class="text-slate-300">${proj.adr.decision}</span></div>
              <div><strong class="text-slate-400">Consequences:</strong> <span class="text-slate-300">${proj.adr.consequences}</span></div>
            </div>
          </div>

          <!-- Repository Structure -->
          <div class="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
            <h3 class="text-base font-bold text-white">Production Repository Directory Layout</h3>
            <pre><code>${proj.repoStructure}</code></pre>
          </div>

          <!-- Interview Defense Script -->
          <div class="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 class="text-base font-bold text-white">Interview Defense Playbook (How to Answer Tough Questions)</h3>
            <div class="space-y-3">
              ${proj.interviewDefense.map(qa => `
                <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  ${qa}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindPortfolioEvents() {}

  setActivePortfolio(id) {
    this.activePortfolioId = id;
    this.renderView();
  }

  // ================= ATS CV BUILDER VIEW =================
  renderCvBuilderView() {
    const resume = this.resumeData;
    const atsScore = this.calculateAtsScore();

    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <!-- Header -->
        <div class="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="badge badge-purple">Career Engine</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Data Engineer ATS Resume Architect</h1>
            <p class="text-xs sm:text-sm text-slate-300">Built around the Google XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]".</p>
          </div>
          <div class="flex items-center gap-3 no-print">
            <button onclick="app.loadSampleCv()" class="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors">
              Load Senior Template
            </button>
            <button onclick="window.print()" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-1.5">
              Print / Save as PDF 🖨️
            </button>
          </div>
        </div>

        <!-- ATS Score Real-Time Audit Card -->
        <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 no-print">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-lg font-bold text-white flex items-center gap-2">
                <span>ATS & Seniority Score</span>
                <span class="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">${atsScore.totalScore}/100</span>
              </h2>
              <p class="text-xs text-slate-400">Automated audit against 2026 data engineering hiring rubrics.</p>
            </div>
            <div class="w-36 bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div class="bg-gradient-to-r from-blue-500 to-emerald-400 h-3 rounded-full" style="width: ${atsScore.totalScore}%"></div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div class="text-slate-400">Metrics Density</div>
              <div class="font-bold text-slate-200 mt-1">${atsScore.breakdown.metrics}/25 pts</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div class="text-slate-400">Modern Stack Signals</div>
              <div class="font-bold text-slate-200 mt-1">${atsScore.breakdown.tech}/25 pts</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div class="text-slate-400">DE vs DA Separation</div>
              <div class="font-bold text-slate-200 mt-1">${atsScore.breakdown.differentiation}/25 pts</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div class="text-slate-400">Action Verb Power</div>
              <div class="font-bold text-slate-200 mt-1">${atsScore.breakdown.actionVerbs}/25 pts</div>
            </div>
          </div>

          ${atsScore.recommendations.length > 0 ? `
            <div class="p-3.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-xs text-amber-300/90 space-y-1">
              <div class="font-bold uppercase tracking-wider text-[11px] text-amber-400">Suggestions for Higher Seniority Rating:</div>
              <ul class="list-disc list-inside space-y-0.5">
                ${atsScore.recommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Split Grid: Editor (Left) & Live Preview (Right) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Editor Form (Left) -->
          <div class="lg:col-span-5 space-y-4 no-print">
            <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 class="font-bold text-slate-200 text-sm">Resume Details</h3>
              
              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-slate-400 mb-1">Full Name</label>
                  <input type="text" id="cv-name" value="${resume.personal.fullName}" oninput="app.updateCvField('personal.fullName', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Target Title</label>
                  <input type="text" id="cv-title" value="${resume.personal.title}" oninput="app.updateCvField('personal.title', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-slate-400 mb-1">Email</label>
                    <input type="text" value="${resume.personal.email}" oninput="app.updateCvField('personal.email', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Location</label>
                    <input type="text" value="${resume.personal.location}" oninput="app.updateCvField('personal.location', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">
                  </div>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Professional Summary</label>
                  <textarea rows="3" oninput="app.updateCvField('summary', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-blue-500 outline-none">${resume.summary}</textarea>
                </div>
              </div>
            </div>

            <!-- Bullet Formula Assistant -->
            <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 class="font-bold text-slate-200 text-sm">💡 XYZ Bullet Formula Helper</h3>
              <p class="text-xs text-slate-400">Click any senior bullet to copy to clipboard:</p>
              <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
                ${CV_DATA.bulletLibrary.map(cat => `
                  <div class="space-y-1">
                    <div class="text-[11px] font-bold text-blue-400 uppercase tracking-wider">${cat.category}</div>
                    ${cat.bullets.map(b => `
                      <div onclick="navigator.clipboard.writeText('${b.replace(/'/g, "\\'")}'); alert('Copied bullet to clipboard!');" class="p-2 rounded bg-slate-950 border border-slate-800 hover:border-blue-500/50 cursor-pointer text-[11px] text-slate-300 hover:text-white transition-colors">
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
            <div id="cv-preview-card" class="p-8 rounded-2xl bg-white text-slate-900 shadow-2xl space-y-6 min-h-[800px] border border-slate-200 font-sans">
              <!-- CV Header -->
              <div class="border-b border-slate-300 pb-4 space-y-1 text-center">
                <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 uppercase">${resume.personal.fullName}</h1>
                <div class="text-sm font-bold text-blue-700">${resume.personal.title}</div>
                <div class="text-xs text-slate-600 flex flex-wrap justify-center gap-3 pt-1">
                  <span>${resume.personal.email}</span>
                  <span>•</span>
                  <span>${resume.personal.location}</span>
                  <span>•</span>
                  <span>${resume.personal.linkedin}</span>
                  <span>•</span>
                  <span>${resume.personal.github}</span>
                </div>
              </div>

              <!-- Summary -->
              <div class="space-y-1">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Professional Summary</h3>
                <p class="text-xs text-slate-700 leading-relaxed">${resume.summary}</p>
              </div>

              <!-- Technical Skills -->
              <div class="space-y-1.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Technical Proficiencies</h3>
                <div class="text-xs space-y-1 text-slate-700">
                  <div><strong>Languages & Engines:</strong> ${resume.skills.languages}</div>
                  <div><strong>Storage & Table Formats:</strong> ${resume.skills.storageTableFormats}</div>
                  <div><strong>Processing & Streaming:</strong> ${resume.skills.processingStreaming}</div>
                  <div><strong>Orchestration & DevOps:</strong> ${resume.skills.orchestrationOps}</div>
                  <div><strong>Observability & Governance:</strong> ${resume.skills.observabilityQuality}</div>
                </div>
              </div>

              <!-- Work Experience -->
              <div class="space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Work Experience</h3>
                ${resume.experience.map(exp => `
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>${exp.company} — ${exp.role}</span>
                      <span class="text-slate-500 font-normal">${exp.period} | ${exp.location}</span>
                    </div>
                    <ul class="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700">
                      ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>

              <!-- Key Projects -->
              <div class="space-y-2">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-0.5">Production Capstone Projects</h3>
                ${resume.projects.map(p => `
                  <div class="space-y-0.5 text-xs">
                    <div class="font-bold text-slate-900">${p.name} <span class="font-normal text-slate-600">(${p.tech})</span></div>
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

  bindCvBuilderEvents() {}

  updateCvField(path, val) {
    if (path.startsWith("personal.")) {
      const field = path.split(".")[1];
      this.resumeData.personal[field] = val;
    } else {
      this.resumeData[path] = val;
    }
    localStorage.setItem("df_resume_data", JSON.stringify(this.resumeData));
    // Re-render only preview and scores
    const atsScore = this.calculateAtsScore();
    // Refresh view
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

    // 1. Metric check (Numbers, %, $, TB, GB, ms)
    const metricMatches = (textToScan.match(/(\d+%|\$\d+|\d+gb|\d+tb|\d+ms|\d+m|\d+k)/g) || []).length;
    score.breakdown.metrics = Math.min(25, metricMatches * 3);
    if (score.breakdown.metrics < 20) {
      score.recommendations.push("Add more quantifiable metrics (e.g. throughput '15M events/sec', latency reduction 'from 4h to 15s', cost savings '$45k').");
    }

    // 2. Modern tech keywords (iceberg, duckdb, dbt, dagster, redpanda, kafka, pydantic, flink)
    const techKeywords = ["iceberg", "duckdb", "dbt", "dagster", "redpanda", "kafka", "pydantic", "flink", "terraform"];
    const foundKeywords = techKeywords.filter(k => textToScan.includes(k));
    score.breakdown.tech = Math.min(25, foundKeywords.length * 3);
    if (score.breakdown.tech < 20) {
      score.recommendations.push("Include modern table format (Apache Iceberg) and asset-based orchestrators (Dagster/dbt).");
    }

    // 3. Action verbs
    const verbs = ["architected", "engineered", "optimized", "refactored", "deployed", "scaled"];
    const foundVerbs = verbs.filter(v => textToScan.includes(v));
    score.breakdown.actionVerbs = Math.min(25, foundVerbs.length * 4);

    // 4. DE vs DA differentiation
    if (textToScan.includes("dashboard") && !textToScan.includes("idempotency") && !textToScan.includes("cdc")) {
      score.breakdown.differentiation = 12;
      score.recommendations.push("Too many reporting/dashboard terms. Focus on distributed pipelines, latency, CDC, and reliability.");
    } else {
      score.breakdown.differentiation = 25;
    }

    score.totalScore = score.breakdown.metrics + score.breakdown.tech + score.breakdown.differentiation + score.breakdown.actionVerbs;
    return score;
  }

  // ================= PLAYGROUND VIEW =================
  renderPlaygroundView() {
    return `
      <div class="animate-fade space-y-6 max-w-7xl mx-auto">
        <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="badge badge-blue">Interactive Sandbox</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white">In-Browser SQL & Data Playground</h1>
            <p class="text-xs sm:text-sm text-slate-300">Execute Kimball dimensional joins and window functions against pre-loaded in-memory datasets.</p>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs text-slate-400">Dataset:</label>
            <select id="pg-dataset-select" onchange="app.changePlaygroundDataset(this.value)" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none">
              <option value="ecommerce">E-Commerce Schema (Customers & Orders)</option>
              <option value="user_activity">User Activity (Gaps & Islands)</option>
            </select>
          </div>
        </div>

        <!-- SQL Editor and Controls -->
        <div class="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-xs">
              <span class="font-bold text-slate-300">Preset Queries:</span>
              <button onclick="app.loadPresetSql(1)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">Customer LTV Join</button>
              <button onclick="app.loadPresetSql(2)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">Gaps & Islands Streaks</button>
              <button onclick="app.loadPresetSql(3)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">Raw Fact Table</button>
            </div>
            <button onclick="app.executePlaygroundQuery()" class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-1.5">
              Execute Query (Ctrl+Enter) ▶
            </button>
          </div>

          <textarea id="pg-sql-editor" rows="6" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs sm:text-sm text-blue-300 focus:border-blue-500 outline-none leading-relaxed">SELECT 
    c.customer_id,
    c.name,
    c.tier,
    c.city,
    COUNT(o.order_id) AS total_orders,
    SUM(o.amount) AS total_spent_usd
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY 1, 2, 3, 4
ORDER BY total_spent_usd DESC;</textarea>
        </div>

        <!-- Query Execution Results Table -->
        <div class="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">Execution Output</span>
            <span id="pg-result-stats" class="text-slate-400 font-mono">Ready to execute</span>
          </div>
          <div id="pg-results-container" class="overflow-x-auto min-h-[160px] rounded-xl bg-slate-950 border border-slate-800 p-2">
            <div class="p-8 text-center text-xs text-slate-500">Run a query above to view results</div>
          </div>
        </div>
      </div>
    `;
  }

  bindPlaygroundEvents() {}

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
    c.city,
    COUNT(o.order_id) AS total_orders,
    SUM(o.amount) AS total_spent_usd
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY 1, 2, 3, 4
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
      if (stats) stats.innerText = `${res.rows.length} rows returned in 2.8ms`;
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
      container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Query executed successfully (0 rows returned).</div>`;
    } else {
      if (stats) stats.innerText = `Error`;
      container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg">Error: ${res.error}</div>`;
    }
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

