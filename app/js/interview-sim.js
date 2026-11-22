/* Story-driven Interview Loop Simulator (app/js/interview-sim.js).
   Upgrades DataForgeApp.prototype.renderInterviewView() with an interactive
   multi-round panel interview mode alongside the 7 Practice Arena drills. */
(function () {
  "use strict";
  if (typeof DataForgeApp === "undefined") return;

  const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    if (window.app && !window.app._importing) window.app.recordStudy();
  };

  Object.assign(DataForgeApp.prototype, {
    isAll() {
      if (!this._is) this._is = read("df_interview_sim", {}) || {};
      return this._is;
    },
    isSave() { write("df_interview_sim", this._is || {}); },
    isTrack(trackId) {
      return window.INTERVIEW_SIM_DATA && window.INTERVIEW_SIM_DATA.TRACKS.find((x) => x.id === trackId);
    },
    isState(trackId) {
      const all = this.isAll();
      if (!all[trackId]) {
        all[trackId] = { stage: "prep", pitchIdx: null, roundIdx: 0, answers: {}, notes: {}, bestScore: null };
      }
      return all[trackId];
    },
    isRoute() {
      const parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
      const isArenaTab = typeof INTERVIEW_TABS !== "undefined" && INTERVIEW_TABS.includes(parts[1]);
      if (parts[0] === "interview" && parts[1] === "loop" && this.isTrack(parts[2])) {
        return { mode: "loop", track: this.isTrack(parts[2]) };
      }
      if (parts[0] === "interview" && isArenaTab) {
        return { mode: "arena", track: null };
      }
      return { mode: this.activeInterviewMode || "loop", track: null };
    },
    isSetMode(mode) {
      this.activeInterviewMode = mode;
      if (mode === "arena") this.go("interview", this.activeInterviewTab || "system-design");
      else this.go("interview");
    },
    isOpenTrack(trackId) {
      this.activeInterviewMode = "loop";
      this._isLastScene = null;
      this.go("interview", "loop", trackId);
    },
    isBackLobby() {
      this.activeInterviewMode = "loop";
      this._isLastScene = null;
      this.go("interview");
    },
    isRestartTrack(trackId) {
      const all = this.isAll();
      const prevBest = all[trackId] ? all[trackId].bestScore : null;
      all[trackId] = { stage: "prep", pitchIdx: null, roundIdx: 0, answers: {}, notes: {}, bestScore: prevBest };
      this.isSave();
      this._isLastScene = null;
      this.playTone("ok");
      this.renderView();
      window.scrollTo(0, 0);
    },

    // ---------- interactive steps ----------
    isPickPitch(trackId, idx) {
      const track = this.isTrack(trackId);
      const st = this.isState(trackId);
      if (!track || st.pitchIdx !== null) return;
      st.pitchIdx = idx;
      this.isSave();
      const p = track.screening.pitches[idx];
      this.playTone(p && p.good ? "ok" : "err");
      this.renderView();
    },
    isStartCall(trackId) {
      const st = this.isState(trackId);
      st.stage = "call";
      st.roundIdx = 0;
      this.isSave();
      this._isLastScene = null;
      this.playTone("ok");
      this.renderView();
      window.scrollTo(0, 0);
    },
    isSaveThinkNote(trackId, key, val) {
      const st = this.isState(trackId);
      st.notes = st.notes || {};
      st.notes[key] = val;
      this.isSave();
    },
    isAnswerStep(trackId, roundIdx, stepKind, optIdx) {
      const track = this.isTrack(trackId);
      const st = this.isState(trackId);
      if (!track) return;
      const key = `${roundIdx}:${stepKind}`;
      if (st.answers[key] !== undefined) return;
      st.answers[key] = optIdx;
      const round = track.rounds[roundIdx];
      const opt = round && round[stepKind] && round[stepKind].options[optIdx];
      this.playTone(opt && opt.good ? "ok" : "err");
      this.isSave();
      this.renderView();
      const bubbles = document.querySelectorAll(".is-transcript .jc-bubble");
      const last = bubbles[bubbles.length - 1];
      if (last && last.scrollIntoView) last.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (last && window.Motion) {
        const added = Array.from(bubbles).slice(-3).concat(Array.from(document.querySelectorAll(".is-transcript .jc-options, .is-transcript > .btn")));
        window.Motion.animate(added, { opacity: [0, 1], y: [8, 0] }, { duration: 0.25, delay: window.Motion.stagger(0.14) });
      }
    },
    isNextRound(trackId) {
      const track = this.isTrack(trackId);
      const st = this.isState(trackId);
      if (!track) return;
      if (st.roundIdx + 1 < track.rounds.length) {
        st.roundIdx += 1;
        this.playTone("ok");
      } else {
        st.stage = "debrief";
        const sc = this.isComputeSignals(track, st);
        st.bestScore = Math.max(st.bestScore || 0, sc.total);
        this.playTone(sc.total >= 70 ? "win" : "ok");
      }
      this.isSave();
      this._isLastScene = null;
      this.renderView();
      window.scrollTo(0, 0);
    },

    // ---------- scoring ----------
    isComputeSignals(track, st) {
      const raw = { sql: 45, arch: 45, ops: 45, comm: 50 };
      if (st.pitchIdx !== null && track.screening.pitches[st.pitchIdx]) {
        const d = track.screening.pitches[st.pitchIdx].delta || {};
        Object.keys(raw).forEach((k) => { raw[k] += d[k] || 0; });
      }
      track.rounds.forEach((r, ri) => {
        ["initial", "followup"].forEach((sk) => {
          const oi = st.answers[`${ri}:${sk}`];
          if (oi !== undefined && r[sk] && r[sk].options[oi]) {
            const d = r[sk].options[oi].deltas || {};
            Object.keys(raw).forEach((k) => { raw[k] += d[k] || 0; });
          }
        });
      });
      const clamped = {};
      Object.keys(raw).forEach((k) => { clamped[k] = Math.max(15, Math.min(100, raw[k])); });
      const total = Math.round((clamped.sql + clamped.arch + clamped.ops + clamped.comm) / 4);
      const goods = track.rounds.reduce((acc, r, ri) => {
        return acc + ["initial", "followup"].filter((sk) => {
          const oi = st.answers[`${ri}:${sk}`];
          return oi !== undefined && r[sk].options[oi] && r[sk].options[oi].good;
        }).length;
      }, 0);
      return { signals: clamped, total, goods, maxProbes: track.rounds.length * 2 };
    },
    isCopyDebrief(btn, trackId) {
      const track = this.isTrack(trackId);
      const st = this.isState(trackId);
      if (!track) return;
      const sc = this.isComputeSignals(track, st);
      const verdict = sc.total >= 85 ? "Strong Hire" : sc.total >= 70 ? "Hire" : "Needs Calibration";
      const lines = [
        `# DataForge Interview Scorecard — ${track.company} (${track.role})`,
        `Score: ${sc.total}/100 · Verdict: ${verdict} · Probes passed: ${sc.goods}/${sc.maxProbes}`,
        `- SQL & Modeling: ${sc.signals.sql}/100`,
        `- System Design: ${sc.signals.arch}/100`,
        `- Ops & FinOps: ${sc.signals.ops}/100`,
        `- Communication: ${sc.signals.comm}/100`
      ];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lines.join("\n"));
      }
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "✓ " + this.l("Disalin!", "Copied!");
        setTimeout(() => { btn.textContent = orig; }, 1600);
      }
    },

    // ---------- main view override ----------
    renderInterviewView() {
      const t = window.TRANSLATIONS[this.lang] || window.TRANSLATIONS.id;
      const { mode, track } = this.isRoute();
      if (!window.INTERVIEW_SIM_DATA) return this.renderArenaFallback(t);

      const modeHeader = `
        <div class="is-mode-bar is-enter">
          <div>
            <h1>${this.esc(t.interviewTitle)}</h1>
            <p class="small muted">${mode === "loop"
              ? this.l("Simulasi panel wawancara 3 babak lengkap dengan papan arsitektur, probe lanjutan, dan keputusan komite.", "Full 3-round live panel simulation with interactive whiteboards, follow-up pushback, and hiring committee debrief.")
              : this.esc(t.interviewSubtitle)}</p>
          </div>
          <div class="segmented" role="tablist" aria-label="${this.l("Mode simulasi wawancara", "Interview simulator mode")}">
            <button role="tab" aria-selected="${mode === "loop"}" class="${mode === "loop" ? "active" : ""}" onclick="app.isSetMode('loop')">🎬 ${this.l("Simulasi Panel", "Panel Loop")}</button>
            <button role="tab" aria-selected="${mode === "arena"}" class="${mode === "arena" ? "active" : ""}" onclick="app.isSetMode('arena')">🛠️ ${this.l("Arena 7 Latihan", "7 Practice Drills")}</button>
          </div>
        </div>`;

      if (mode === "arena") {
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
          <div class="is-wrap">
            ${modeHeader}
            <div class="card row between">
              <div class="segmented" role="tablist" aria-label="${this.l("Jenis latihan", "Practice type")}">
                ${INTERVIEW_TABS.map((k) => `<button role="tab" aria-selected="${this.activeInterviewTab === k}" class="${this.activeInterviewTab === k ? "active" : ""}" onclick="app.go('interview','${k}')">${tabs[k]}</button>`).join("")}
              </div>
            </div>
            ${duelOpen ? this.renderDuelBanner() : ""}
            ${this.renderInterviewTabContent(t)}
            ${duelOpen ? "" : this.renderDuelBanner()}
          </div>`;
      }

      let body = "";
      if (!track) body = this.isRenderLobby();
      else {
        const st = this.isState(track.id);
        if (st.stage === "prep") body = this.isRenderPrep(track, st);
        else if (st.stage === "debrief") body = this.isRenderDebrief(track, st);
        else body = this.isRenderCall(track, st);
      }

      setTimeout(() => this.isAnimateScene(), 0);
      return `<div class="is-wrap">${modeHeader}${body}</div>`;
    },

    renderArenaFallback(t) {
      return `<div class="card"><p>${this.esc(t.interviewTitle)} loading...</p></div>`;
    },

    isAnimateScene() {
      const root = document.querySelector(".is-wrap");
      if (!root) return;
      const sceneEl = root.querySelector("[data-is-scene]");
      const key = location.hash + "|" + (sceneEl ? sceneEl.dataset.isScene : "");
      if (key === this._isLastScene) return;
      this._isLastScene = key;
      if (window.Motion) {
        window.Motion.animate(root.querySelectorAll(".is-enter"), { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, delay: window.Motion.stagger(0.05) });
      }
      const ring = root.querySelector(".is-ring-fg");
      if (ring && window.anime) {
        const pct = Number(ring.dataset.score || 0);
        const offset = 283 - (283 * pct) / 100;
        window.anime({ targets: ring, strokeDashoffset: [283, offset], duration: 1000, easing: "easeOutCubic" });
      }
      const stamp = root.querySelector(".is-verdict-stamp");
      if (stamp && window.Motion) {
        window.Motion.animate(stamp, { opacity: [0, 1], scale: [1.55, 1] }, { duration: 0.35, delay: 0.65 });
      }
    },

    // ---------- 1. Lobby ----------
    isRenderLobby() {
      const { TRACKS } = window.INTERVIEW_SIM_DATA;
      const doneMods = new Set(this.completedModules || []);
      return `
        <div data-is-scene="lobby" class="stack">
          <div class="jc-board-head is-enter">
            <div>
              <span class="label">${this.l("Simulasi Loop Wawancara", "Interview Loop Simulator")}</span>
              <h2>${this.l("Pilih target perusahaan dan masuk ke ruang panel", "Choose your target company & enter the interview loop")}</h2>
              <p class="muted small">${this.l(
                "Setiap wawancara terdiri dari screening pembuka, 3 babak teknis mendalam (SQL, Whiteboard Arsitektur, dan Insiden/Stakeholder) dengan pertanyaan lanjutan mendadak, lalu ditutup sidang komite rekrutmen.",
                "Each loop walks you through a recruiter pitch, 3 live technical rounds (SQL, Architecture Whiteboard, and Incident/Executive defense) with sharp follow-up pushback, ending in a hiring committee debrief."
              )}</p>
            </div>
          </div>
          <div class="is-tracks">
            ${TRACKS.map((tr) => {
              const st = this.isAll()[tr.id];
              const met = tr.relatedModules.filter((m) => doneMods.has(m)).length;
              let badge = `<span class="is-verdict-chip">${this.l("Belum dicoba", "Not attempted")}</span>`;
              if (st && st.bestScore !== null) {
                const ok = st.bestScore >= 70;
                badge = `<span class="is-verdict-chip ${ok ? "hire" : "retry"}">${ok ? "✓ " + this.l("Penawaran", "Offer") : "↻ " + this.l("Latihan", "Retry")} · ${st.bestScore}/100</span>`;
              } else if (st && st.stage === "call") {
                badge = `<span class="is-verdict-chip">${this.l(`Berjalan · Babak ${st.roundIdx + 1}/3`, `In progress · Round ${st.roundIdx + 1}/3`)}</span>`;
              }
              return `
                <article class="is-track is-enter">
                  <div class="is-track-banner" style="--lg-bg:${tr.logo.bg}"></div>
                  <div class="is-track-body">
                    <div class="is-track-head">
                      ${this.jcLogo ? this.jcLogo(tr) : `<span class="jc-logo" style="--lg-bg:${tr.logo.bg};--lg-fg:${tr.logo.fg}">${this.esc(tr.logo.text)}</span>`}
                      <div>
                        <strong>${this.esc(tr.company)}</strong>
                        <div class="small muted">${this.esc(tr.role)}</div>
                      </div>
                    </div>
                    <p class="small">${this.esc(this.t(tr.summary))}</p>
                    <div class="is-track-meta">
                      <span>🎯 ${this.esc(this.t(tr.level))}</span>
                      <span>💰 ${this.esc(this.t(tr.salary))}</span>
                      <span>⏱ ${this.esc(this.t(tr.duration))}</span>
                      <span>📘 ${met}/${tr.relatedModules.length} ${this.l("modul siap", "modules ready")}</span>
                    </div>
                    <div class="is-track-foot">
                      ${badge}
                      <button class="btn btn-sm btn-primary" onclick="app.isOpenTrack('${tr.id}')">${st && st.stage === "call" ? this.l("Lanjutkan →", "Resume →") : this.l("Mulai Loop →", "Start Loop →")}</button>
                    </div>
                  </div>
                </article>`;
            }).join("")}
          </div>
        </div>`;
    },

    // ---------- 2. Recruiter Screening & Pitch Prep ----------
    isRenderPrep(track, st) {
      const sc = track.screening;
      const who = track.people[sc.who];
      const chosen = st.pitchIdx !== null ? sc.pitches[st.pitchIdx] : null;
      return `
        <div data-is-scene="prep-${track.id}" class="stack">
          <div class="row between is-enter">
            <button class="btn btn-quiet btn-sm" onclick="app.isBackLobby()">← ${this.l("Semua perusahaan", "All companies")}</button>
            <span class="chip">${this.esc(track.company)} · ${this.esc(track.role)}</span>
          </div>
          <div class="jc-form is-enter" style="max-width:760px">
            <div class="row" style="gap:12px">
              ${this.jcAvatar(who, "lg")}
              <div>
                <h2>${this.l("Persiapan Panel & Elevator Pitch", "Panel Briefing & Elevator Pitch")}</h2>
                <div class="small muted">${this.esc(who.name)} · ${this.esc(this.t(who.role))}</div>
              </div>
            </div>
            <ol class="jc-timeline">
              ${sc.timeline.map((item) => `<li class="done"><strong>${this.esc(this.t(item.title))}</strong><span>${this.esc(this.t(item.when))}</span></li>`).join("")}
            </ol>
            <div class="jc-bubble them">${this.inline(this.t(sc.prompt))}</div>
            ${chosen ? `
              <div class="jc-bubble me">${this.inline(this.t(chosen.text))}</div>
              <div class="jc-bubble them ${chosen.good ? "good" : "meh"}">${this.inline(this.t(chosen.reply))}</div>
              <button class="btn btn-primary jc-cta" onclick="app.isStartCall('${track.id}')">📹 ${this.l("Masuk ke Ruang Wawancara Teknis →", "Join Technical Panel Room →")}</button>
            ` : `
              <div class="jc-options">
                ${sc.pitches.map((p, i) => `<button class="jc-option" onclick="app.isPickPitch('${track.id}', ${i})">${this.inline(this.t(p.text))}</button>`).join("")}
              </div>
            `}
          </div>
        </div>`;
    },

    // ---------- 3. Live Multi-Round Panel Call + Interactive Artifact ----------
    isRenderCall(track, st) {
      const round = track.rounds[st.roundIdx] || track.rounds[0];
      const speaker = track.people[round.who];
      const { COMPETENCIES } = window.INTERVIEW_SIM_DATA;
      const { signals } = this.isComputeSignals(track, st);
      const ans1 = st.answers[`${st.roundIdx}:initial`];
      const ans2 = st.answers[`${st.roundIdx}:followup`];
      const panelKeys = Object.keys(track.people);

      const renderBubbleOpt = (stepKind, optIdx) => {
        const opt = round[stepKind].options[optIdx];
        if (!opt) return "";
        return `
          <div class="jc-bubble me">${this.inline(this.t(opt.text))}</div>
          <div class="jc-bubble them ${opt.good ? "good" : "meh"}">${this.inline(this.t(opt.reply))}</div>`;
      };

      let transcriptBody = `<div class="jc-bubble them"><strong>${this.esc(speaker.name)}.</strong> ${this.inline(this.t(round.initial.q))}</div>`;
      if (ans1 !== undefined) {
        transcriptBody += renderBubbleOpt("initial", ans1);
        transcriptBody += `<div class="jc-bubble them jc-new"><strong>${this.l("Pertanyaan lanjutan", "Follow-up probe")}.</strong> ${this.inline(this.t(round.followup.q))}</div>`;
        if (ans2 !== undefined) {
          transcriptBody += renderBubbleOpt("followup", ans2);
        } else {
          transcriptBody += this.isRenderOptions(track.id, st, round.followup.options, st.roundIdx, "followup");
        }
      } else {
        transcriptBody += this.isRenderOptions(track.id, st, round.initial.options, st.roundIdx, "initial");
      }

      const nextBtn = ans2 !== undefined
        ? `<button class="btn btn-primary jc-cta" onclick="app.isNextRound('${track.id}')">${st.roundIdx + 1 < track.rounds.length
            ? `➡️ ${this.l(`Lanjut ke Babak ${st.roundIdx + 2}`, `Proceed to Round ${st.roundIdx + 2}`)}`
            : `⚖️ ${this.l("Tutup Panggilan: Lihat Hasil Sidang Komite →", "End Call: View Hiring Committee Verdict →")}`}</button>`
        : `<div class="jc-typing" aria-hidden="true"><i></i><i></i><i></i></div>`;

      return `
        <div data-is-scene="call-${track.id}-${st.roundIdx}-${ans1 !== undefined ? 1 : 0}-${ans2 !== undefined ? 1 : 0}" class="stack">
          <div class="is-hud is-enter">
            <div class="is-hud-top">
              <button class="jc-back" onclick="app.isBackLobby()" aria-label="${this.l("Kembali ke lobi", "Back to lobby")}">←</button>
              ${this.jcLogo(track, "sm")}
              <div>
                <strong>${this.esc(track.company)}</strong>
                <div class="small muted">${this.esc(this.t(round.badge))}</div>
              </div>
              <div class="is-round-pills">
                ${track.rounds.map((r, i) => `<span class="is-rpill ${i < st.roundIdx ? "done" : i === st.roundIdx ? "now" : ""}">${i + 1}. ${this.esc(this.t(r.badge).split("·")[1] || "")}</span>`).join("")}
              </div>
            </div>
            <div class="is-signals">
              ${COMPETENCIES.map((c) => `
                <div class="is-sig-item">
                  <div class="row between"><span>${this.esc(this.t(c.label))}</span><strong>${signals[c.id]}</strong></div>
                  <div class="is-sig-bar"><span style="width:${signals[c.id]}%;background:${c.color}"></span></div>
                </div>`).join("")}
            </div>
          </div>

          <div class="is-stage-grid">
            <div class="is-call is-enter">
              <div class="is-call-bar">
                <span class="jc-live">● ${this.l("Sesi Panel Live", "Live Panel")}</span>
                <span>${this.esc(track.role)}</span>
                <span class="muted">${this.l("Babak", "Round")} ${st.roundIdx + 1}/${track.rounds.length}</span>
              </div>
              <div class="is-call-video">
                ${panelKeys.map((pk) => {
                  const p = track.people[pk];
                  const active = pk === round.who;
                  return `
                    <div class="is-speaker-tile ${active ? "active" : ""}">
                      ${this.jcAvatar(p, active ? "lg" : "")}
                      <div class="small" style="font-weight:600">${this.esc(p.name.split(" ")[0])}</div>
                      ${active ? `<span class="is-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>` : `<span class="small muted" style="font-size:10.5px">${this.l("Menyimak", "Listening")}</span>`}
                    </div>`;
                }).join("")}
                <div class="is-self-pip">${this.esc(this.jcPlayerName())}</div>
              </div>
              <div class="is-transcript">
                ${transcriptBody}
                ${nextBtn}
              </div>
            </div>

            ${this.isRenderArtifact(round.artifact, ans1, ans2)}
          </div>
        </div>`;
    },

    isRenderOptions(trackId, st, options, roundIdx, stepKind) {
      const noteKey = `${roundIdx}:${stepKind}`;
      const noteVal = (st.notes && st.notes[noteKey]) || "";
      return `
        <details class="is-think-box">
          <summary>✍️ ${this.l("Opsional: catat poin pembelaan Anda dulu sebelum memilih", "Optional: jot down your talking points before answering")}</summary>
          <textarea placeholder="${this.l("Ketik kata kunci pembelaan (grain, idempotensi, watermarks, ACL)...", "Jot key concepts first (grain, idempotency, watermarks, ACLs)...")}" oninput="app.isSaveThinkNote('${trackId}', '${noteKey}', this.value)">${this.esc(noteVal)}</textarea>
        </details>
        <div class="jc-options">
          ${options.map((o, oi) => `<button class="jc-option" onclick="app.isAnswerStep('${trackId}', ${roundIdx}, '${stepKind}', ${oi})">${this.inline(this.t(o.text))}</button>`).join("")}
        </div>`;
    },

    isRenderArtifact(art, ans1, ans2) {
      if (!art) return "";
      if (art.kind === "sql") {
        return `
          <aside class="is-artifact is-enter">
            <div class="is-artifact-head">
              <span class="label">🧾 ${this.l("Artefak Babak", "Round Artifact")}</span>
              <span class="chip">SQL</span>
            </div>
            <h3>${this.esc(this.t(art.title))}</h3>
            <div class="small muted">${this.l("Skema Tabel", "Table Schema")}</div>
            <pre><code>${this.esc(art.schema)}</code></pre>
            <div class="small muted">${this.l("Query yang Diuji", "Query Under Review")}</div>
            <pre data-lang="sql"><code>${this.esc(art.snippet)}</code></pre>
          </aside>`;
      }
      if (art.kind === "pipeline") {
        const litCount = (ans1 !== undefined ? 2 : 0) + (ans2 !== undefined ? 2 : 0);
        return `
          <aside class="is-artifact is-enter">
            <div class="is-artifact-head">
              <span class="label">📐 ${this.l("Papan Arsitektur", "Architecture Whiteboard")}</span>
              <span class="chip chip-blue">${litCount}/${art.nodes.length} ${this.l("terkunci", "locked")}</span>
            </div>
            <h3>${this.esc(this.t(art.title))}</h3>
            <div class="is-pipe-board">
              <div class="is-pipe-nodes">
                ${art.nodes.map((n, idx) => `
                  ${idx > 0 ? `<div class="is-pipe-arrow">↓</div>` : ""}
                  <div class="is-pipe-node ${idx < litCount ? "lit" : ""}">
                    <div><strong>${this.esc(n.label)}</strong><div><small>${this.esc(this.t(n.role))}</small></div></div>
                    <span>${idx < litCount ? "✓" : "○"}</span>
                  </div>`).join("")}
              </div>
            </div>
          </aside>`;
      }
      return `
        <aside class="is-artifact is-enter">
          <div class="is-artifact-head">
            <span class="label">🚨 ${this.l("Konsol Telemetri", "Live Alert Console")}</span>
            <span class="is-sev-badge">${this.esc(art.sev)}</span>
          </div>
          <h3>${this.esc(this.t(art.title))}</h3>
          <div class="is-metric-list">
            ${art.metrics.map((m) => `<div class="is-metric-row"><span>${this.esc(this.t(m.label))}</span><strong>${this.esc(this.t(m.val))}</strong></div>`).join("")}
          </div>
        </aside>`;
    },

    // ---------- 4. Hiring Committee Debrief & Verdict ----------
    isRenderDebrief(track, st) {
      const { COMPETENCIES } = window.INTERVIEW_SIM_DATA;
      const sc = this.isComputeSignals(track, st);
      const passed = sc.total >= 70;
      const stampText = sc.total >= 85 ? this.l("STRONG HIRE · OFFER", "STRONG HIRE · OFFER") : passed ? this.l("HIRE · OFFER", "HIRE · OFFER") : this.l("BELUM LOLOS · ULANGI", "NO OFFER · PRACTICE");

      const panelVotes = track.rounds.map((r, ri) => {
        const person = track.people[r.who];
        const g1 = r.initial.options[st.answers[`${ri}:initial`]]?.good ? 1 : 0;
        const g2 = r.followup.options[st.answers[`${ri}:followup`]]?.good ? 1 : 0;
        const pts = g1 + g2;
        const voteLabel = pts === 2 ? "Strong Hire" : pts === 1 ? "Lean Hire" : "No Hire";
        const cls = pts === 2 ? "strong" : pts === 1 ? "hire" : "lean";
        const note = pts === 2
          ? this.l("Pembelaan teknis jernih di pertanyaan awal maupun lanjutan.", "Clear engineering depth across both initial prompt and pushback.")
          : pts === 1
            ? this.l("Cukup baik pada satu bagian, namun sempat goyah saat ditekan pada trade-off.", "Solid instinct on one probe, hesitated under scale/trade-off follow-up.")
            : this.l("Perlu memperkuat prinsip inti pada topik ini sebelum wawancara sungguhan.", "Needs deeper first-principles review on this pillar before the real loop.");
        return `
          <div class="is-vote-card is-enter">
            <div class="row" style="gap:8px">${this.jcAvatar(person)}<div><strong>${this.esc(person.name)}</strong><div class="small muted">${this.esc(this.t(r.badge))}</div></div></div>
            <span class="is-vote-pill ${cls}">${voteLabel} (${pts}/2)</span>
            <p class="small muted">${this.esc(note)}</p>
          </div>`;
      }).join("");

      const weakest = COMPETENCIES.slice().sort((a, b) => sc.signals[a.id] - sc.signals[b.id])[0];
      const modLinks = track.relatedModules.map((m) => `<a class="chip" href="#/curriculum/${m}">📖 ${this.l("Modul", "Module")} ${m.replace("mod-", "").replace("-", ".")}</a>`).join(" ");

      return `
        <div data-is-scene="debrief-${track.id}" class="stack">
          <div class="row between is-enter">
            <button class="btn btn-quiet btn-sm" onclick="app.isBackLobby()">← ${this.l("Kembali ke lobi", "Back to lobby")}</button>
            <button class="btn btn-quiet btn-sm" onclick="app.isRestartTrack('${track.id}')">↻ ${this.l("Ulangi Loop Wawancara", "Retake This Loop")}</button>
          </div>
          <div class="is-debrief-card is-paper is-enter">
            <div class="is-debrief-hero">
              <div class="is-ring-box">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle class="is-ring-bg" cx="50" cy="50" r="45"></circle>
                  <circle class="is-ring-fg" data-score="${sc.total}" stroke="${passed ? "#16a34a" : "#d97706"}" cx="50" cy="50" r="45"></circle>
                </svg>
                <div class="is-ring-score"><strong>${sc.total}</strong><span>/ 100</span></div>
              </div>
              <div class="stack-sm" style="flex:1;min-width:220px">
                <div class="row between" style="align-items:center">
                  <div>
                    <span class="label">${this.esc(track.company)} · ${this.l("Sidang Komite Rekrutmen", "Hiring Committee Debrief")}</span>
                    <h2>${this.esc(this.jcPlayerName())} — ${this.esc(this.t(track.offer.level))}</h2>
                  </div>
                  <div class="is-verdict-stamp ${passed ? "" : "retry"}">${stampText}</div>
                </div>
                <p class="small">${passed ? this.esc(this.t(track.offer.note)) : this.l("Skor di bawah 70/100. Fokus latih pilar terlemah Anda lalu coba ulang loop ini!", "Score is below 70/100. Sharpen your weakest pillar below and run this loop again!")}</p>
                ${passed ? `<div class="chip chip-green" style="width:max-content">💼 ${this.l("Paket Penawaran", "Offer Package")}: ${this.esc(this.t(track.offer.comp))}</div>` : ""}
              </div>
            </div>

            <div class="is-signals">
              ${COMPETENCIES.map((c) => `
                <div class="is-sig-item">
                  <div class="row between"><span>${this.esc(this.t(c.label))}</span><strong>${sc.signals[c.id]}%</strong></div>
                  <div class="is-sig-bar"><span style="width:${sc.signals[c.id]}%;background:${c.color}"></span></div>
                </div>`).join("")}
            </div>

            <div>
              <h3>${this.l("Suara Panelis", "Panelist Votes")} (${sc.goods}/${sc.maxProbes} ${this.l("probe tepat", "probes strong")})</h3>
              <div class="is-votes" style="margin-top:8px">${panelVotes}</div>
            </div>

            <div class="card stack-sm" style="background:var(--card);color:var(--text)">
              <strong>🎯 ${this.l(`Rekomendasi Belajar Terfokus (${this.t(weakest.label)}: ${sc.signals[weakest.id]}%)`, `Focused Study Prescription (${this.t(weakest.label)}: ${sc.signals[weakest.id]}%)`)}</strong>
              <div class="row" style="flex-wrap:wrap;gap:6px">${modLinks}</div>
            </div>

            <div class="row between" style="flex-wrap:wrap;gap:10px">
              <button class="btn btn-quiet btn-sm" onclick="app.isCopyDebrief(this, '${track.id}')">📋 ${this.l("Salin Kartu Skor", "Copy Scorecard")}</button>
              <div class="row" style="gap:8px">
                <button class="btn btn-quiet btn-sm" onclick="app.isSetMode('arena')">🛠️ ${this.l("Buka 7 Latihan Arena", "Open 7 Practice Drills")}</button>
                <button class="btn btn-primary btn-sm" onclick="app.isRestartTrack('${track.id}')">↻ ${this.l("Main Lagi / Coba Jalur Lain", "Play Again")}</button>
              </div>
            </div>
          </div>
        </div>`;
    }
  });
})();
