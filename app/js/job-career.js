/* Job simulator, career mode. Replaces the one-page simulator with scenes that follow a real job:
   job board -> posting -> application -> interview -> offer -> first-day meeting -> your desk (inbox, board,
   team, career) -> each mission as brief -> design meeting -> ticket -> review with your manager.
   Story text: job-career-data.js. Missions (brief, design question, spec, JOB1 check): job-sim-data.js.
   Loaded after app.js; it adds its methods to DataForgeApp before the app starts. */
(function () {
  "use strict";
  if (typeof DataForgeApp === "undefined") return;

  const LEVELS = ["easy", "normal", "hard", "expert"];
  const STEPS = ["brief", "meeting", "ticket", "review"];

  const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: progress lasts this visit */ } };

  Object.assign(DataForgeApp.prototype, {
    // ---------- state ----------
    jcAll() {
      if (!this._jc) this._jc = read("df_job_career", {}) || {};
      return this._jc;
    },
    jcState(storyId) {
      const all = this.jcAll();
      if (!all[storyId]) all[storyId] = { stage: "board", answers: [], tasks: {}, read: {}, wrong: {} };
      return all[storyId];
    },
    jcSave() { write("df_job_career", this.jcAll()); },
    jcRoute() {
      const parts = (location.hash || "").replace(/^#\/?/, "").split("/");
      const data = window.JOB_SIM_DATA;
      const story = data && data.stories.find((s) => s.id === parts[1]);
      const level = story && LEVELS.includes(parts[2]) ? parts[2] : null;
      return { story, level };
    },
    jcCo(storyId) { return window.JOB_CAREER_DATA.COMPANIES[storyId]; },
    jcPerson(co, key) { return co.people[key] || { name: key, role: { id: "", en: "" }, color: "#52525b" }; },
    jcDone(story) { return story.levels.map((lv) => Boolean(this.jobSimProofs[lv.missionId])); },
    jcUnlocked(story, i) { return i === 0 || Boolean(this.jobSimProofs[story.levels[i - 1].missionId]); },
    jcTrust(story) {
      const st = this.jcState(story.id);
      const co = this.jcCo(story.id);
      let v = 50;
      (st.answers || []).forEach((a, qi) => { const q = co.interview.questions[qi]; if (q && q.options[a] && q.options[a].good) v += 5; });
      story.levels.forEach((lv) => {
        const g = this.jobSimGates[lv.missionId];
        if (g && g.passed) v += Math.max(0, 6 - 3 * ((st.wrong || {})[lv.missionId] || 0));
        if (this.jobSimProofs[lv.missionId]) v += 10;
      });
      return Math.max(0, Math.min(100, v));
    },
    jcTrustLabel(v) {
      if (v >= 90) return this.l("Sangat dipercaya", "Indispensable");
      if (v >= 70) return this.l("Dipercaya", "Trusted");
      if (v >= 45) return this.l("Mulai beradaptasi", "Settling in");
      return this.l("Perlu perhatian", "Needs attention");
    },
    jcTitle(story) {
      const done = this.jcDone(story).filter(Boolean).length;
      return this.t(window.JOB_CAREER_DATA.COMMON.titles[done]);
    },
    jcPlayerName() {
      const p = (this.resumeData && this.resumeData.personal) || {};
      return this.resumeEdited && p.fullName ? p.fullName : this.l("Kandidat", "Candidate");
    },

    // ---------- navigation ----------
    setJobStory(storyId) { this.go("job-sim", storyId); },
    setJobLevel(lvl) { this.go("job-sim", this.jcRoute().story ? this.jcRoute().story.id : this.activeJobStoryId, lvl); },
    jcOpenMission(storyId, lvl) { this.go("job-sim", storyId, lvl); },
    jcBoard() { this.go("job-sim"); },
    jcSetStage(storyId, stage) {
      const st = this.jcState(storyId);
      st.stage = stage;
      if (stage === "desk" && !st.hiredOn) st.hiredOn = new Date().toISOString().slice(0, 10);
      this.jcSave();
      this._jcLastScene = null;
      this.renderView();
      window.scrollTo(0, 0);
    },
    jcSetTab(tab) { this.jcTab = tab; this.renderView(); },
    jcOpenMsg(id) {
      const { story } = this.jcRoute();
      if (!story) return;
      this.jcMsg = id;
      const st = this.jcState(story.id);
      st.read[id] = true;
      this.jcSave();
      this.renderView();
    },
    jcToggleTask(storyId, taskId) {
      const st = this.jcState(storyId);
      st.tasks[taskId] = !st.tasks[taskId];
      this.jcSave();
      this.renderView();
    },
    jcStep(missionId, step) {
      this.jcSteps = this.jcSteps || {};
      this.jcSteps[missionId] = step;
      this.renderView();
      window.scrollTo(0, 0);
    },

    // ---------- the hiring flow ----------
    jcApply(storyId) {
      const sel = document.getElementById("jc-motivation");
      const st = this.jcState(storyId);
      st.motivation = sel ? sel.value : "";
      st.stage = "applied";
      this.jcSave();
      this.renderView();
      this.playTone("ok");
    },
    jcAnswer(storyId, qi, oi) {
      const st = this.jcState(storyId);
      if (st.answers[qi] !== undefined) return;
      st.answers[qi] = oi;
      this.jcSave();
      const q = this.jcCo(storyId).interview.questions[qi];
      this.playTone(q.options[oi].good ? "ok" : "err");
      this.renderView();
      const last = document.querySelectorAll(".jc-transcript .jc-bubble");
      const el = last[last.length - 1];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
      // animate only what this answer added: your answer, the reaction, and the next question with its options
      const added = Array.from(last).slice(-3).concat(Array.from(document.querySelectorAll(".jc-options, .jc-transcript > .btn")));
      if (el && window.Motion) window.Motion.animate(added, { opacity: [0, 1], y: [6, 0] }, { duration: 0.25, delay: window.Motion.stagger(0.18) });
    },
    jcSign(storyId) {
      const st = this.jcState(storyId);
      st.stage = "signed";
      st.signedOn = new Date().toISOString().slice(0, 10);
      this.jcSave();
      this.renderView();
      this.playTone("win");
      const path = document.getElementById("jc-signature");
      if (path && window.anime) window.anime({ targets: path, strokeDashoffset: [window.anime.setDashoffset, 0], duration: 1100, easing: "easeInOutQuad" });
      const stamp = document.querySelector(".jc-stamp");
      if (stamp && window.Motion) window.Motion.animate(stamp, { opacity: [0, 1], scale: [1.6, 1] }, { duration: 0.35, delay: 1.0 });
    },
    jcNextLine(storyId) {
      const st = this.jcState(storyId);
      st.day1Line = (st.day1Line || 0) + 1;
      this.jcSave();
      this.renderView();
    },

    // ---------- missions (same checks as before: jobSimGates and JOB1 tokens) ----------
    answerJobSimGate(missionId, optIdx) {
      const story = window.JOB_SIM_DATA.stories.find((s) => s.levels.some((lv) => lv.missionId === missionId));
      const mission = story && story.levels.find((lv) => lv.missionId === missionId);
      if (!mission || !mission.padmGate) return;
      const opt = mission.padmGate.options[optIdx];
      if (!opt) return;
      const prev = this.jobSimGates[missionId];
      if (prev && prev.passed) return;   // the meeting already agreed on an approach
      this.jobSimGates[missionId] = { selected: optIdx, passed: Boolean(opt.correct) };
      writeStore("df_job_sim_gates", this.jobSimGates);
      if (!opt.correct) {
        const st = this.jcState(story.id);
        st.wrong[missionId] = (st.wrong[missionId] || 0) + 1;
        this.jcSave();
      }
      this.playTone(opt.correct ? "ok" : "err");
      this.renderView();
    },
    submitJobSimProof(missionId) {
      const inp = document.getElementById("jobsim-proof-input-" + missionId);
      const msg = document.getElementById("jobsim-proof-msg-" + missionId);
      if (!inp || !msg) return;
      const raw = inp.value.trim();
      const res = window.ProofCheck && window.ProofCheck.verifyJobSim ? window.ProofCheck.verifyJobSim(missionId, raw) : { ok: false, reason: "format" };
      if (!res.ok) {
        this.playTone("err");
        const why = res.reason === "mission"
          ? this.l(`Token ini untuk misi ${res.mission}, bukan ${missionId}.`, `This token is for mission ${res.mission}, not ${missionId}.`)
          : this.l("Token JOB1 tidak valid. Jalankan perintah `verify` di terminal dan tempel seluruh baris JOB1 yang dicetak.", "Invalid JOB1 token. Run the `verify` command in your terminal and paste the whole JOB1 line it prints.");
        msg.innerHTML = `<div class="feedback err">✗ ${this.inline(why)}</div>`;
        return;
      }
      this.jobSimProofs[missionId] = { token: raw, ...res.info };
      writeStore("df_job_sim_proofs", this.jobSimProofs);
      this.jcSteps = this.jcSteps || {};
      this.jcSteps[missionId] = "review";
      this.playTone("win");
      this.renderChrome();
      this.renderView();
      window.scrollTo(0, 0);
    },

    // ---------- small pieces ----------
    jcAvatar(p, size) {
      const initials = p.name.replace(/^dr\.\s*/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("");
      return `<span class="jc-avatar ${size || ""}" style="--av:${p.color}" aria-hidden="true">${this.esc(initials)}</span>`;
    },
    jcLogo(co, size) {
      return `<span class="jc-logo ${size || ""}" style="--lg-bg:${co.logo.bg};--lg-fg:${co.logo.fg}" aria-hidden="true">${this.esc(co.logo.text)}</span>`;
    },
    jcMeter(v) {
      const tone = v >= 70 ? "good" : v >= 45 ? "mid" : "low";
      return `<div class="jc-meter ${tone}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"><span style="width:${v}%"></span></div>`;
    },
    jcTopBar(story, co, extra) {
      const trust = this.jcTrust(story);
      return `
        <div class="jc-topbar">
          <button class="jc-back" onclick="app.jcBoard()" aria-label="${this.l("Kembali ke papan lowongan", "Back to the job board")}">←</button>
          ${this.jcLogo(co, "sm")}
          <div class="jc-topbar-co">
            <strong>${this.esc(co.name)}</strong>
            <span>${this.esc(this.jcTitle(story))}</span>
          </div>
          ${extra || ""}
          <div class="jc-topbar-trust" title="${this.l("Kepercayaan atasan: naik saat Anda memilih pendekatan yang tepat dan menyelesaikan misi", "Your manager's trust: rises when you choose the right approach and ship missions")}">
            <span>${this.l("Kepercayaan atasan", "Manager's trust")} · <strong>${trust}</strong> · ${this.esc(this.jcTrustLabel(trust))}</span>
            ${this.jcMeter(trust)}
          </div>
        </div>`;
    },

    // ---------- view ----------
    renderJobSimView() {
      const data = window.JOB_SIM_DATA;
      if (!data || !window.JOB_CAREER_DATA) return `<div class="card"><p>Job simulator data not loaded.</p></div>`;
      const { story, level } = this.jcRoute();
      let html;
      if (!story) html = this.jcRenderBoard(data);
      else {
        const st = this.jcState(story.id);
        if (level) html = this.jcRenderMission(story, level);
        else if (st.stage === "board" || st.stage === "posting") html = this.jcRenderPosting(story);
        else if (st.stage === "apply") html = this.jcRenderApply(story);
        else if (st.stage === "applied" || st.stage === "interview") html = this.jcRenderInterview(story);
        else if (st.stage === "offer" || st.stage === "signed") html = this.jcRenderOffer(story);
        else if (st.stage === "day1") html = this.jcRenderDay1(story);
        else html = this.jcRenderDesk(story);
      }
      setTimeout(() => this.jcAnimateScene(), 0);
      return `<div class="jc">${html}</div>`;
    },
    jcAnimateScene() {
      const root = document.querySelector(".jc");
      if (!root || !window.Motion) return;
      const key = location.hash + "|" + (root.querySelector("[data-scene]") || {}).dataset?.scene;
      if (key === this._jcLastScene) return;
      this._jcLastScene = key;
      window.Motion.animate(root.querySelectorAll(".jc-enter"), { opacity: [0, 1], y: [10, 0] }, { duration: 0.32, delay: window.Motion.stagger(0.06) });
    },

    // 1. Job board
    jcRenderBoard(data) {
      const C = window.JOB_CAREER_DATA.COMPANIES;
      const status = (s) => {
        const st = this.jcAll()[s.id];
        if (!st || st.stage === "board") return `<span class="jc-status">${this.l("Belum melamar", "Not applied")}</span>`;
        if (["desk"].includes(st.stage)) {
          const done = this.jcDone(s).filter(Boolean).length;
          return `<span class="jc-status hired">✓ ${this.l("Bekerja di sini", "Working here")} · ${this.esc(this.jcTitle(s))} · ${done}/4</span>`;
        }
        return `<span class="jc-status applied">${this.l("Proses melamar", "Application in progress")}</span>`;
      };
      return `
        <div data-scene="board" class="stack">
          <div class="jc-board-head jc-enter">
            <div>
              <span class="label">${this.l("Simulator kerja", "Job simulator")}</span>
              <h1>${this.l("Lowongan untuk Junior Data Engineer", "Openings for Junior Data Engineers")}</h1>
              <p class="muted">${this.l(
                "Pilih perusahaan, lamar, dan jalani pekerjaannya: hari pertama, tiket dari stakeholder, rapat desain, kode yang Anda tulis dan uji di komputer sendiri, lalu evaluasi dari atasan. Perusahaan dan orangnya fiktif; masalahnya nyata.",
                "Pick a company, apply, and do the job: your first day, tickets from stakeholders, design meetings, code you write and test on your own computer, then your manager's review. The companies and people are fictional; the problems are real.")}</p>
            </div>
            <div class="jc-search" aria-hidden="true"><span>🔍</span> data engineer · Indonesia</div>
          </div>
          <div class="jc-postings">
            ${data.stories.map((s) => {
              const co = C[s.id];
              return `
                <button class="jc-posting-row jc-enter" onclick="app.setJobStory('${s.id}')">
                  ${this.jcLogo(co)}
                  <div class="jc-posting-main">
                    <div class="jc-posting-role">${this.esc(co.posting.role)}</div>
                    <div class="jc-posting-co">${this.esc(co.name)} · ${this.esc(co.city)}</div>
                    <div class="jc-posting-tags">
                      <span>${this.esc(this.t(co.industry))}</span>
                      <span>${this.esc(this.t(co.posting.type))}</span>
                      <span>${this.esc(this.t(co.posting.salary))}</span>
                    </div>
                  </div>
                  <div class="jc-posting-side">
                    ${status(s)}
                    <span class="small muted">${this.esc(this.t(co.posting.posted))}</span>
                  </div>
                </button>`;
            }).join("")}
          </div>
          <p class="small muted jc-enter">${this.l(
            "Misi pertama setiap perusahaan butuh Python yang nyaman (Modul 1.2) dan mengerjakannya di terminal. Kalau Anda masih di Level 0, Anda tetap bisa melamar dan mengikuti hari pertama; misinya akan menunggu.",
            "Each company's first mission needs comfortable Python (Module 1.2) and is done in your terminal. If you are still in Level 0, you can apply and do your first day; the missions will wait.")}</p>
        </div>`;
    },

    // 2. Posting
    jcRenderPosting(story) {
      const co = this.jcCo(story.id);
      const p = co.posting;
      const done = new Set(this.completedModules || []);
      const met = p.reqs.filter((r) => done.has(r.mod)).length;
      const modLabel = (id) => id.replace("mod-", "").replace("-", ".");
      return `
        <div data-scene="posting" class="stack">
          <button class="btn btn-quiet btn-sm jc-enter" style="align-self:flex-start" onclick="app.jcBoard()">← ${this.l("Semua lowongan", "All openings")}</button>
          <article class="jc-posting jc-enter">
            <div class="jc-posting-banner" style="--lg-bg:${co.logo.bg}"></div>
            <div class="jc-posting-body">
              <div class="jc-posting-title">
                ${this.jcLogo(co, "lg")}
                <div>
                  <h1>${this.esc(p.role)}</h1>
                  <div class="muted">${this.esc(co.name)} · ${this.esc(co.city)} · ${this.esc(this.t(p.posted))}</div>
                </div>
              </div>
              <div class="jc-posting-tags big">
                <span>💼 ${this.esc(this.t(p.type))}</span>
                <span>💰 ${this.esc(this.t(p.salary))}</span>
                <span>🏢 ${this.esc(this.t(co.industry))}</span>
              </div>
              <div class="jc-posting-cols">
                <div class="stack-sm">
                  <h3>${this.l("Tentang kami", "About us")}</h3>
                  <p>${this.inline(this.t(p.about))}</p>
                  <h3>${this.l("Yang akan Anda kerjakan", "What you will do")}</h3>
                  <ul>${p.doList.map((d) => `<li>${this.inline(this.t(d))}</li>`).join("")}</ul>
                  <h3>${this.l("Yang kami tawarkan", "What we offer")}</h3>
                  <ul>${p.perks.map((d) => `<li>${this.inline(this.t(d))}</li>`).join("")}</ul>
                </div>
                <aside class="jc-reqs">
                  <h3>${this.l("Yang kami cari", "What we look for")}</h3>
                  <ul class="jc-req-list">
                    ${p.reqs.map((r) => `<li class="${done.has(r.mod) ? "met" : ""}"><span class="jc-req-mark">${done.has(r.mod) ? "✓" : "○"}</span><span>${this.inline(this.t(r.text))} <a href="#/curriculum/${r.mod}" class="jc-mod">${this.l("Modul", "Module")} ${modLabel(r.mod)}</a></span></li>`).join("")}
                  </ul>
                  <p class="small muted">${this.l(
                    `Anda memenuhi ${met} dari ${p.reqs.length} berdasarkan modul yang sudah Anda selesaikan. Junior dipekerjakan karena potensi: tidak ada yang memenuhi semuanya.`,
                    `You meet ${met} of ${p.reqs.length}, based on the modules you have completed. Juniors are hired on potential: nobody meets all of them.`)}</p>
                  <button class="btn btn-primary jc-cta" onclick="app.jcSetStage('${story.id}','apply')">${this.l("Lamar sekarang", "Apply now")}</button>
                </aside>
              </div>
            </div>
          </article>
        </div>`;
    },

    // 3. Application
    jcRenderApply(story) {
      const co = this.jcCo(story.id);
      const p = (this.resumeData && this.resumeData.personal) || {};
      const name = this.jcPlayerName();
      return `
        <div data-scene="apply" class="stack">
          <button class="btn btn-quiet btn-sm jc-enter" style="align-self:flex-start" onclick="app.jcSetStage('${story.id}','posting')">← ${this.l("Kembali ke lowongan", "Back to the posting")}</button>
          <div class="jc-form jc-enter">
            <div class="row" style="gap:12px">${this.jcLogo(co)}<div><h2>${this.l("Lamar", "Apply")}: ${this.esc(co.posting.role)}</h2><div class="muted small">${this.esc(co.name)}</div></div></div>
            <label class="jc-field"><span>${this.l("Nama", "Name")}</span><input type="text" value="${this.esc(name)}" readonly /></label>
            <label class="jc-field"><span>Email</span><input type="text" value="${this.esc(this.resumeEdited && p.email ? p.email : "you@example.com")}" readonly /></label>
            <div class="jc-field"><span>CV</span>
              <div class="jc-attach">📄 ${this.l("CV dari ATS Resume", "CV from ATS Resume")} <a href="#/cv-builder">${this.l("ubah", "edit")}</a></div>
            </div>
            <label class="jc-field"><span>${this.l("Mengapa posisi ini?", "Why this role?")}</span>
              <select id="jc-motivation">
                <option>${this.l("Saya ingin membangun pipeline yang dipakai orang setiap hari", "I want to build pipelines people use every day")}</option>
                <option>${this.l("Masalah datanya menarik bagi saya", "Your data problems interest me")}</option>
                <option>${this.l("Saya ingin belajar dari tim yang berpengalaman", "I want to learn from an experienced team")}</option>
              </select>
            </label>
            <p class="small muted">${this.l("Ini simulasi: tidak ada yang dikirim ke mana pun.", "This is a simulation: nothing is sent anywhere.")}</p>
            <button class="btn btn-primary jc-cta" onclick="app.jcApply('${story.id}')">${this.l("Kirim lamaran", "Submit application")}</button>
          </div>
        </div>`;
    },

    // 4. Interview (video call)
    jcRenderInterview(story) {
      const co = this.jcCo(story.id);
      const st = this.jcState(story.id);
      const iv = co.interview;
      const who = this.jcPerson(co, iv.who);
      if (st.stage === "applied") {
        // the application status, then the call
        return `
          <div data-scene="applied" class="stack">
            <div class="jc-form jc-enter">
              <h2>${this.l("Status lamaran", "Application status")}</h2>
              <ol class="jc-timeline">
                <li class="done jc-enter"><strong>${this.l("Lamaran terkirim", "Application sent")}</strong><span>${this.l("Baru saja", "Just now")}</span></li>
                <li class="done jc-enter"><strong>${this.l("Dilihat oleh rekruter", "Viewed by the recruiter")}</strong><span>${this.l("2 hari kemudian", "2 days later")}</span></li>
                <li class="done jc-enter"><strong>${this.l("Undangan wawancara", "Interview invitation")}</strong><span>${this.esc(who.name)} · ${this.l("video call, 20 menit", "video call, 20 minutes")}</span></li>
              </ol>
              <button class="btn btn-primary jc-cta jc-enter" onclick="app.jcSetStage('${story.id}','interview')">📹 ${this.l("Masuk ke video call", "Join the video call")}</button>
            </div>
          </div>`;
      }
      const has = (k) => st.answers[k] !== undefined && st.answers[k] !== null;
      const answered = iv.questions.filter((_, k) => has(k)).length;
      const allDone = answered >= iv.questions.length;
      const nextQ = iv.questions.findIndex((_, k) => !has(k));
      const good = iv.questions.filter((q, k) => has(k) && q.options[st.answers[k]].good).length;
      // the whole conversation so far: each question, your answer and the interviewer's reaction
      const past = iv.questions.map((q, k) => !has(k) ? "" : `
        <div class="jc-bubble them"><strong>${this.l("Pertanyaan", "Question")} ${k + 1}.</strong> ${this.inline(this.t(q.q))}</div>
        <div class="jc-bubble me">${this.inline(this.t(q.options[st.answers[k]].text))}</div>
        <div class="jc-bubble them ${q.options[st.answers[k]].good ? "good" : "meh"}">${this.inline(this.t(q.options[st.answers[k]].reply))}</div>`).join("");
      const q = nextQ >= 0 ? iv.questions[nextQ] : null;
      return `
        <div data-scene="interview" class="stack">
          <div class="jc-call jc-enter">
            <div class="jc-call-bar"><span class="jc-live">● ${this.l("Wawancara", "Interview")}</span><span>${this.esc(co.name)} · ${this.esc(co.posting.role)}</span><span class="muted">${Math.min(answered + 1, iv.questions.length)}/${iv.questions.length}</span></div>
            <div class="jc-call-stage">
              <div class="jc-call-tile main">${this.jcAvatar(who, "xl")}<div class="jc-call-name">${this.esc(who.name)} · ${this.esc(this.t(who.role))}</div></div>
              <div class="jc-call-tile self"><span class="jc-avatar lg" style="--av:#52525b">${this.l("Anda", "You")}</span></div>
            </div>
            <div class="jc-transcript">
              <div class="jc-bubble them">${this.inline(this.t(iv.intro))}</div>
              ${past}
              ${allDone ? `
                <div class="jc-bubble them">${this.l(
                  `Terima kasih, itu sangat membantu. Anda menjawab ${good} dari ${iv.questions.length} dengan cara yang kami cari. Tim HR akan menghubungi Anda segera.`,
                  `Thank you, that was helpful. You answered ${good} of ${iv.questions.length} the way we look for. HR will be in touch shortly.`)}</div>
                <button class="btn btn-primary jc-cta" onclick="app.jcSetStage('${story.id}','offer')">📧 ${this.l("Dua hari kemudian: buka email", "Two days later: open your email")}</button>` : `
                <div class="jc-bubble them jc-new"><strong>${this.l("Pertanyaan", "Question")} ${nextQ + 1}.</strong> ${this.inline(this.t(q.q))}</div>
                <div class="jc-options">
                  ${q.options.map((o, oi) => `<button class="jc-option" onclick="app.jcAnswer('${story.id}', ${nextQ}, ${oi})">${this.inline(this.t(o.text))}</button>`).join("")}
                </div>`}
            </div>
          </div>
        </div>`;
    },

    // 5. Offer letter
    jcRenderOffer(story) {
      const co = this.jcCo(story.id);
      const st = this.jcState(story.id);
      const mgr = this.jcPerson(co, co.manager);
      const signed = st.stage === "signed";
      const today = new Date().toLocaleDateString(this.lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
      return `
        <div data-scene="offer" class="stack">
          <div class="jc-mail-head jc-enter">📧 <strong>${this.l("Surat penawaran kerja", "Job offer")}</strong> · ${this.esc(co.name)} HR</div>
          <div class="jc-letter jc-enter">
            <div class="jc-letterhead">${this.jcLogo(co)}<div><strong>${this.esc(co.name)}</strong><div class="small muted">${this.esc(co.city)}</div></div><span class="small muted" style="margin-left:auto">${this.esc(today)}</span></div>
            <p>${this.l("Kepada", "Dear")} ${this.esc(this.jcPlayerName())},</p>
            <p>${this.l(`Dengan senang hati kami menawarkan posisi berikut di ${this.esc(co.name)}:`, `We are pleased to offer you the following position at ${this.esc(co.name)}:`)}</p>
            <table class="jc-terms">
              <tr><th>${this.l("Posisi", "Position")}</th><td>${this.esc(co.posting.role)}</td></tr>
              <tr><th>${this.l("Atasan", "Reports to")}</th><td>${this.esc(mgr.name)}</td></tr>
              <tr><th>${this.l("Gaji", "Salary")}</th><td>${this.esc(this.t(co.offer.salary))}</td></tr>
              <tr><th>${this.l("Mulai", "Start")}</th><td>${this.esc(this.t(co.offer.start))}</td></tr>
              <tr><th>${this.l("Masa percobaan", "Probation")}</th><td>${this.l("3 bulan", "3 months")}</td></tr>
            </table>
            <p>${this.l("Kami menantikan kerja sama dengan Anda.", "We look forward to working with you.")}</p>
            <div class="jc-sign-row">
              <div class="jc-sign-box">
                <svg viewBox="0 0 220 60" class="jc-sig" aria-hidden="true">${signed ? `<path id="jc-signature" d="M8 42 C 22 8, 34 8, 30 40 S 52 52, 60 30 S 78 12, 84 38 S 104 50, 112 28 C 118 16, 126 20, 124 36 S 150 46, 160 30 S 186 22, 210 34" />` : ""}</svg>
                <div class="jc-sign-label">${this.esc(this.jcPlayerName())}</div>
              </div>
              ${signed ? `<div class="jc-stamp">${this.l("DITERIMA", "HIRED")}</div>` : ""}
            </div>
          </div>
          ${signed
            ? `<button class="btn btn-primary jc-cta jc-enter" onclick="app.jcSetStage('${story.id}','day1')">${this.l("Senin pagi: hari pertama Anda →", "Monday morning: your first day →")}</button>`
            : `<button class="btn btn-primary jc-cta jc-enter" onclick="app.jcSign('${story.id}')">✍️ ${this.l("Tanda tangani dan terima", "Sign and accept")}</button>`}
        </div>`;
    },

    // 6. First day: the meeting where the team explains the problem, expectations, targets and first steps
    jcRenderDay1(story) {
      const co = this.jcCo(story.id);
      const st = this.jcState(story.id);
      const lines = co.day1.lines;
      const n = Math.min(st.day1Line || 0, lines.length);
      const finished = n >= lines.length;
      const line = lines[Math.min(n, lines.length - 1)];
      const speaker = this.jcPerson(co, line.who);
      const attendees = Array.from(new Set(lines.map((x) => x.who)));
      return `
        <div data-scene="day1-${finished ? "end" : n}" class="stack">
          <div class="jc-scene-title jc-enter"><span class="label">${this.l("Hari pertama · 09.00", "Day one · 09:00")}</span><h2>${this.esc(this.t(co.day1.room))}</h2></div>
          <div class="jc-meeting jc-enter">
            <div class="jc-table">
              ${attendees.map((k) => {
                const p = this.jcPerson(co, k);
                return `<div class="jc-seat ${!finished && k === line.who ? "speaking" : ""}">${this.jcAvatar(p, "lg")}<div class="jc-seat-name">${this.esc(p.name.replace(/^dr\.\s*/i, "").split(" ")[0])}</div><div class="jc-seat-role">${this.esc(this.t(p.role).replace(/ \(.*\)$/, ""))}</div></div>`;
              }).join("")}
              <div class="jc-seat you">${`<span class="jc-avatar lg" style="--av:#52525b">${this.l("Anda", "You")}</span>`}<div class="jc-seat-name">${this.l("Anda", "You")}</div><div class="jc-seat-role">${this.esc(co.posting.role.split(",")[0])}</div></div>
            </div>
            ${finished ? "" : `
            <div class="jc-dialogue" aria-live="polite">
              <div class="jc-dialogue-who">${this.jcAvatar(speaker)}<div><strong>${this.esc(speaker.name)}</strong><div class="small muted">${this.esc(this.t(speaker.role))}</div></div></div>
              <p class="jc-dialogue-text">${this.inline(this.t(line.text))}</p>
              <div class="row between">
                <span class="jc-dots">${lines.map((_, i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>
                <button class="btn btn-primary btn-sm" onclick="app.jcNextLine('${story.id}')">${n === lines.length - 1 ? this.l("Selesai rapat", "End of meeting") : this.l("Lanjut ▶", "Next ▶")}</button>
              </div>
            </div>`}
          </div>
          ${finished ? `
          <div class="jc-whiteboard jc-enter">
            <h3>🎯 ${this.l("Target Anda tahun ini", "Your targets this year")}</h3>
            <ol class="jc-targets">${co.day1.targets.map((t, i) => `<li class="jc-enter"><span class="jc-target-n">${i + 1}</span><span>${this.esc(this.t(t))}</span><span class="jc-when">${this.esc(this.t(window.JOB_CAREER_DATA.COMMON.levelWhen[i]))}</span></li>`).join("")}</ol>
            <h3>${this.l("Minggu ini, cukup tiga hal", "This week, just three things")}</h3>
            <ul>${window.JOB_CAREER_DATA.COMMON.firstTasks.map((t) => `<li>${this.esc(this.t(t.title))}</li>`).join("")}</ul>
            <div class="row" style="gap:8px">
              <button class="btn btn-primary jc-cta" onclick="app.jcSetStage('${story.id}','desk')">${this.l("Ke meja Anda →", "Go to your desk →")}</button>
              <button class="btn btn-quiet btn-sm" onclick="app.jcReplayDay1('${story.id}')">↺ ${this.l("Ulangi rapat", "Replay the meeting")}</button>
            </div>
          </div>` : ""}
        </div>`;
    },
    jcReplayDay1(storyId) { const st = this.jcState(storyId); st.day1Line = 0; this.jcSave(); this._jcLastScene = null; this.renderView(); },

    // 7. The desk: inbox, board, team, career
    jcMessages(story) {
      const co = this.jcCo(story.id);
      const mgr = this.jcPerson(co, co.manager);
      const done = this.jcDone(story);
      const msgs = [];
      msgs.push({ id: "welcome", from: { name: `${co.name} HR`, color: "#52525b", role: { id: "HR", en: "HR" } }, subject: this.l("Selamat bergabung", "Welcome aboard"), kind: "hr" });
      msgs.push({ id: "week1", from: mgr, subject: this.l("Minggu pertama Anda", "Your first week"), kind: "week1" });
      story.levels.forEach((lv, i) => {
        const p = this.jcPerson(co, co.levels[i].from);
        if (this.jcUnlocked(story, i)) msgs.push({ id: "m" + i, from: p, subject: this.t(lv.title).replace(/^(Misi|Mission) \d\.\d: /, ""), kind: "mission", i, lv });
        if (done[i]) msgs.push({ id: "t" + i, from: p, subject: this.l("Terima kasih", "Thank you"), kind: "thanks", i });
      });
      if (done.every(Boolean)) msgs.push({ id: "review", from: mgr, subject: this.l("Evaluasi tahunan Anda", "Your annual review"), kind: "review" });
      return msgs.reverse();
    },
    jcRenderDesk(story) {
      const co = this.jcCo(story.id);
      const tab = this.jcTab || "inbox";
      const st = this.jcState(story.id);
      const msgs = this.jcMessages(story);
      const unread = msgs.filter((m) => !st.read[m.id]).length;
      const tabs = [
        ["inbox", `📥 ${this.l("Kotak masuk", "Inbox")}${unread ? ` <span class="jc-badge">${unread}</span>` : ""}`],
        ["board", `🗂 ${this.l("Papan kerja", "Work board")}`],
        ["team", `👥 ${this.l("Tim", "Team")}`],
        ["career", `📈 ${this.l("Karier", "Career")}`]
      ];
      let body = "";
      if (tab === "inbox") body = this.jcRenderInbox(story, co, msgs);
      else if (tab === "board") body = this.jcRenderWorkBoard(story, co);
      else if (tab === "team") body = this.jcRenderTeam(story, co);
      else body = this.jcRenderCareer(story, co);
      return `
        <div data-scene="desk-${tab}" class="stack">
          ${this.jcTopBar(story, co, (() => { const d = this.jcDone(story); const k = d.indexOf(false); return `<span class="jc-when-chip">${k < 0 ? this.l("Tahun 2", "Year 2") : this.esc(this.t(window.JOB_CAREER_DATA.COMMON.levelWhen[k]))}</span>`; })())}
          <nav class="jc-tabs jc-enter" role="tablist">${tabs.map(([k, label]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? "active" : ""}" onclick="app.jcSetTab('${k}')">${label}</button>`).join("")}</nav>
          ${body}
        </div>`;
    },
    jcRenderInbox(story, co, msgs) {
      const st = this.jcState(story.id);
      const sel = msgs.find((m) => m.id === this.jcMsg) || msgs[0];
      if (sel && !st.read[sel.id]) { st.read[sel.id] = true; this.jcSave(); }
      const nextLocked = story.levels.findIndex((_, i) => !this.jcUnlocked(story, i));
      return `
        <div class="jc-inbox jc-enter">
          <ul class="jc-msg-list">
            ${msgs.map((m) => `
              <li><button class="jc-msg-item ${m === sel ? "active" : ""} ${st.read[m.id] ? "" : "unread"}" onclick="app.jcOpenMsg('${m.id}')">
                ${this.jcAvatar(m.from)}
                <span class="jc-msg-meta"><strong>${this.esc(m.from.name)}</strong><span>${this.esc(m.subject)}</span></span>
                ${m.kind === "mission" ? (this.jobSimProofs[m.lv.missionId] ? `<span class="jc-pill done">✓</span>` : `<span class="jc-pill">${this.l("Tiket", "Ticket")}</span>`) : ""}
              </button></li>`).join("")}
            ${nextLocked > 0 ? `<li class="jc-msg-later">${this.l(`Pesan berikutnya datang setelah misi ${nextLocked} selesai.`, `The next message arrives after mission ${nextLocked} is done.`)}</li>` : ""}
          </ul>
          <div class="jc-msg-view">${sel ? this.jcRenderMessage(story, co, sel) : ""}</div>
        </div>`;
    },
    jcRenderMessage(story, co, m) {
      const C = window.JOB_CAREER_DATA.COMMON;
      const st = this.jcState(story.id);
      const mgr = this.jcPerson(co, co.manager);
      const head = `<div class="jc-msg-head">${this.jcAvatar(m.from, "lg")}<div><strong>${this.esc(m.from.name)}</strong><div class="small muted">${this.esc(this.t(m.from.role))}</div></div></div><h3>${this.esc(m.subject)}</h3>`;
      if (m.kind === "hr") return `${head}
        <p>${this.l(`Selamat datang di ${this.esc(co.name)}! Laptop Anda sudah siap di meja. Atasan Anda adalah ${this.esc(mgr.name)}.`, `Welcome to ${this.esc(co.name)}! Your laptop is ready on your desk. Your manager is ${this.esc(mgr.name)}.`)}</p>
        <p>${this.l("Masa percobaan Anda tiga bulan. Setelah itu, kenaikan jabatan mengikuti hasil kerja, bukan lama bekerja.", "Your probation is three months. After that, promotions follow results, not time served.")}</p>`;
      if (m.kind === "week1") {
        const auto = { ticket: Boolean(this.jobSimGates[story.levels[0].missionId]) };
        return `${head}
          <p>${this.l("Ini daftar minggu ini. Centang kalau sudah.", "Here's this week's list. Tick them off as you go.")}</p>
          <ul class="jc-checklist">
            ${C.firstTasks.map((t) => {
              const on = Boolean(st.tasks[t.id] || auto[t.id]);
              return `<li><label><input type="checkbox" ${on ? "checked" : ""} ${auto[t.id] ? "disabled" : ""} onchange="app.jcToggleTask('${story.id}','${t.id}')" /> <strong>${this.esc(this.t(t.title))}</strong></label><div class="small muted">${this.inline(this.t(t.detail))}</div></li>`;
            }).join("")}
          </ul>`;
      }
      if (m.kind === "mission") {
        const lv = m.lv;
        const ch = (lv.incidentTicket.from.match(/\((#[^)]+)\)/) || [])[1] || "#data";
        const proof = this.jobSimProofs[lv.missionId];
        return `${head}
          <div class="small muted">${this.esc(ch)} · ${this.esc(this.t(C.levelWhen[m.i]))}</div>
          <p>${this.inline(this.t(lv.incidentTicket.brief))}</p>
          <p class="small"><strong>${this.l("Selesai artinya", "Done means")}:</strong> ${this.inline(this.t(lv.incidentTicket.sla))}</p>
          <button class="btn btn-primary jc-cta" onclick="app.jcOpenMission('${story.id}','${lv.level}')">${proof ? this.l("Lihat pekerjaan ini", "Open this work") : this.l("Ambil tiket ini →", "Take this ticket →")}</button>`;
      }
      if (m.kind === "thanks") return `${head}<p>${this.inline(this.t(co.levels[m.i].after))}</p>`;
      if (m.kind === "review") {
        const trust = this.jcTrust(story);
        return `${head}
          <p>${this.l("Setahun yang lalu Anda masuk sebagai junior dalam masa percobaan. Ini ringkasannya:", "A year ago you joined as a junior on probation. Here's the summary:")}</p>
          <ul>${co.day1.targets.map((t) => `<li>✓ ${this.esc(this.t(t))}</li>`).join("")}</ul>
          <p>${this.l(`Kepercayaan tim: ${trust}/100. Jabatan Anda sekarang: ${this.esc(this.jcTitle(story))}.`, `Team trust: ${trust}/100. Your title now: ${this.esc(this.jcTitle(story))}.`)}</p>
          <p class="small muted">${this.l("Simulasi ini latihan, bukan pengalaman kerja. Di CV, tulis sebagai proyek dan jelaskan apa yang benar-benar Anda bangun.", "This simulation is practice, not work experience. On a CV, list it as a project and describe what you actually built.")}</p>`;
      }
      return head;
    },
    jcRenderWorkBoard(story, co) {
      const cols = [["todo", this.l("Akan dikerjakan", "To do")], ["doing", this.l("Sedang dikerjakan", "In progress")], ["done", this.l("Selesai", "Done")]];
      const where = (lv, i) => {
        if (this.jobSimProofs[lv.missionId]) return "done";
        if (this.jcUnlocked(story, i) && this.jobSimGates[lv.missionId] && this.jobSimGates[lv.missionId].passed) return "doing";
        return "todo";
      };
      const key = co.logo.text.toUpperCase();
      return `
        <div class="jc-kanban jc-enter">
          ${cols.map(([c, label]) => `
            <div class="jc-col"><div class="jc-col-head">${label}</div>
              ${story.levels.map((lv, i) => where(lv, i) !== c ? "" : `
                <button class="jc-card ${this.jcUnlocked(story, i) ? "" : "locked"}" onclick="app.jcOpenMission('${story.id}','${lv.level}')">
                  <div class="row between"><span class="jc-key">${key}-${101 + i}</span>${this.jcAvatar(this.jcPerson(co, co.levels[i].from), "sm")}</div>
                  <div class="jc-card-title">${this.esc(this.t(lv.title).replace(/^(Misi|Mission) \d\.\d: /, ""))}</div>
                  <div class="jc-card-foot"><span>${this.esc(this.t(window.JOB_CAREER_DATA.COMMON.levelWhen[i]))}</span><span>${this.jcUnlocked(story, i) ? "" : "🔒"}</span></div>
                </button>`).join("")}
            </div>`).join("")}
        </div>`;
    },
    jcRenderTeam(story, co) {
      const st = this.jcState(story.id);
      return `
        <div class="stack-sm jc-enter">
          <div class="jc-team">
            ${Object.keys(co.people).map((k) => { const p = co.people[k]; return `<div class="jc-person">${this.jcAvatar(p, "lg")}<div><strong>${this.esc(p.name)}</strong><div class="small muted">${this.esc(this.t(p.role))}</div></div></div>`; }).join("")}
          </div>
          <details class="tryit-reveal" ${st.tasks.listen ? "" : "open"}>
            <summary>📝 ${this.l("Catatan rapat hari pertama", "Notes from the first-day meeting")}</summary>
            <ul class="jc-notes">${co.day1.lines.map((x) => `<li><strong>${this.esc(this.jcPerson(co, x.who).name)}:</strong> ${this.inline(this.t(x.text))}</li>`).join("")}</ul>
          </details>
        </div>`;
    },
    jcRenderCareer(story, co) {
      const C = window.JOB_CAREER_DATA.COMMON;
      const done = this.jcDone(story);
      const n = done.filter(Boolean).length;
      return `
        <div class="stack-sm jc-enter">
          <ol class="jc-ladder">
            ${C.titles.map((t, i) => `<li class="${i < n ? "past" : i === n ? "now" : ""}"><span class="jc-rung"></span><strong>${this.esc(this.t(t))}</strong>${i > 0 ? `<span class="small muted">${this.l("setelah misi", "after mission")} ${i}</span>` : `<span class="small muted">${this.l("saat diterima", "when hired")}</span>`}</li>`).join("")}
          </ol>
          <div class="card stack-sm">
            <h3>${this.l("Poin CV dari pekerjaan ini", "CV points from this job")}</h3>
            <p class="small muted">${this.l("Terbuka per misi yang terverifikasi. Masuk ke ATS Resume sebagai proyek simulasi, bukan pengalaman kerja.", "They open per verified mission. They go into ATS Resume as a simulation project, not work experience.")}</p>
            ${story.starResumeBullets.map((b, i) => `<div class="well row between" style="gap:10px;align-items:center"><span class="small" style="flex:1">${done[i] ? "✅" : "🔒"} ${this.inline(b)}</span>${done[i] ? `<button class="btn btn-sm btn-quiet" onclick="app.pushJobSimBulletToCv('${story.id}', ${i})">➕ ${this.l("Ke CV", "Add to CV")}</button>` : ""}</div>`).join("")}
          </div>
        </div>`;
    },

    // 8. One mission: brief -> design meeting -> ticket -> review
    jcRenderMission(story, level) {
      const co = this.jcCo(story.id);
      const i = LEVELS.indexOf(level);
      const lv = story.levels[i];
      const C = window.JOB_CAREER_DATA.COMMON;
      const gate = this.jobSimGates[lv.missionId];
      const proof = this.jobSimProofs[lv.missionId];
      const derived = proof ? "review" : gate && gate.passed ? "ticket" : "brief";
      let step = (this.jcSteps && this.jcSteps[lv.missionId]) || derived;
      if (step === "review" && !proof) step = derived;
      if (step === "ticket" && !(gate && gate.passed)) step = "meeting";
      const reached = (s) => s === "brief" || s === "meeting" || (s === "ticket" && Boolean(gate && gate.passed)) || (s === "review" && Boolean(proof));
      const locked = !this.jcUnlocked(story, i);
      const stepper = `
        <ol class="jc-stepper jc-enter">
          ${STEPS.map((s, k) => {
            const labels = { brief: this.l("Permintaan", "The ask"), meeting: this.l("Rapat desain", "Design meeting"), ticket: this.l("Tiket & kode", "Ticket & code"), review: this.l("Evaluasi", "Review") };
            const can = reached(s);
            return `<li class="${s === step ? "now" : can ? "past" : ""}"><button ${can ? "" : "disabled"} onclick="app.jcStep('${lv.missionId}','${s}')"><span>${k + 1}</span>${labels[s]}</button></li>`;
          }).join("")}
        </ol>`;
      let body;
      if (step === "brief") body = this.jcMissionBrief(story, co, lv, i);
      else if (step === "meeting") body = this.jcMissionMeeting(story, co, lv, i);
      else if (step === "ticket") body = this.jcMissionTicket(story, co, lv, i);
      else body = this.jcMissionReview(story, co, lv, i);
      return `
        <div data-scene="mission-${lv.missionId}-${step}" class="stack">
          ${this.jcTopBar(story, co, `<span class="jc-when-chip">${this.esc(this.t(C.levelWhen[i]))}</span>`)}
          <button class="btn btn-quiet btn-sm jc-enter" style="align-self:flex-start" onclick="app.jcSetTab('inbox');app.go('job-sim','${story.id}')">← ${this.l("Ke meja Anda", "Back to your desk")}</button>
          ${locked ? `<div class="callout jc-enter"><p>${this.l("Pratinjau: pesan ini belum datang di cerita. Anda boleh membaca dan mengerjakannya sekarang; ia akan muncul di kotak masuk setelah misi sebelumnya selesai.", "Preview: this message hasn't arrived in the story yet. You may read and do it now; it shows up in your inbox once the previous mission is done.")}</p></div>` : ""}
          ${stepper}
          ${body}
        </div>`;
    },
    jcMissionBrief(story, co, lv, i) {
      const from = this.jcPerson(co, co.levels[i].from);
      const mgr = this.jcPerson(co, co.manager);
      const ch = (lv.incidentTicket.from.match(/\((#[^)]+)\)/) || [])[1] || "#data";
      return `
        <div class="jc-chat jc-enter">
          <div class="jc-chat-head"><strong>${this.esc(ch)}</strong><span class="small muted">${this.l("3 anggota", "3 members")}</span></div>
          <div class="jc-chat-body">
            <div class="jc-chat-msg jc-enter">${this.jcAvatar(from)}<div><div class="jc-chat-who"><strong>${this.esc(from.name)}</strong> <span>${this.esc(this.t(from.role))} · 09:02</span></div><p>${this.inline(this.t(lv.incidentTicket.brief))}</p></div></div>
            <div class="jc-chat-msg jc-enter">${this.jcAvatar(from)}<div><div class="jc-chat-who"><strong>${this.esc(from.name)}</strong> <span>09:03</span></div><p><strong>${this.l("Yang kami butuhkan", "What we need")}:</strong> ${this.inline(this.t(lv.incidentTicket.sla))}</p></div></div>
            <div class="jc-chat-msg jc-enter">${this.jcAvatar(mgr)}<div><div class="jc-chat-who"><strong>${this.esc(mgr.name)}</strong> <span>09:05</span></div><p>${this.l(`@${this.jcPlayerName()} bisa ambil ini? Sebelum menulis kode, kita rapat jam 14.00 untuk memilih pendekatan.`, `@${this.jcPlayerName()} can you take this one? Before any code, let's meet at 14:00 to choose an approach.`)}</p></div></div>
            <div class="jc-typing jc-enter" aria-hidden="true"><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="row jc-enter" style="gap:8px">
          <button class="btn btn-primary jc-cta" onclick="app.jcStep('${lv.missionId}','meeting')">👍 ${this.l("Saya ambil. Ke rapat desain →", "I'll take it. To the design meeting →")}</button>
          <span class="small muted">${this.esc(lv.lifecycle)} · ${lv.undercurrents.map((u) => this.esc(u)).join(", ")}</span>
        </div>`;
    },
    jcMissionMeeting(story, co, lv, i) {
      const g = this.jobSimGates[lv.missionId];
      const mgr = this.jcPerson(co, co.manager);
      const reviewer = this.jcPerson(co, co.levels[i].from);
      const sel = g ? lv.padmGate.options[g.selected] : null;
      const colors = ["#fef08a", "#bfdbfe", "#fbcfe8"];
      return `
        <div class="jc-whiteboard jc-enter">
          <div class="jc-wb-head"><span class="label">${this.l("Rapat desain · 14.00", "Design meeting · 14:00")}</span>
            <span class="jc-wb-people">${this.jcAvatar(mgr, "sm")}${this.jcAvatar(reviewer, "sm")}<span class="jc-avatar sm" style="--av:#52525b">${this.l("A", "Y")}</span></span></div>
          <h3>${this.inline(this.t(lv.padmGate.question))}</h3>
          <div class="jc-stickies">
            ${lv.padmGate.options.map((o, k) => {
              const chosen = g && g.selected === k;
              return `<button class="jc-sticky ${chosen ? (o.correct ? "right" : "wrong") : ""}" style="--st:${colors[k % 3]}" ${g && g.passed ? "disabled" : ""} onclick="app.answerJobSimGate('${lv.missionId}', ${k})">${this.inline(this.t(o.text))}</button>`;
            }).join("")}
          </div>
          ${sel ? `
            <div class="jc-chat-msg reaction">${this.jcAvatar(sel.correct ? mgr : reviewer)}<div><div class="jc-chat-who"><strong>${this.esc((sel.correct ? mgr : reviewer).name)}</strong></div><p>${this.inline(this.t(sel.feedback))}</p></div></div>
            ${sel.correct
              ? `<button class="btn btn-primary jc-cta" onclick="app.jcStep('${lv.missionId}','ticket')">${this.l("Sepakat. Buat tiketnya →", "Agreed. Write the ticket →")}</button>`
              : `<p class="small muted">${this.l("Pilih pendekatan lain. Setiap pilihan yang salah sedikit menurunkan kepercayaan atasan.", "Pick another approach. Each wrong pick costs a little of your manager's trust.")}</p>`}` : `<p class="small muted">${this.l("Pilih satu pendekatan untuk diusulkan.", "Pick one approach to propose.")}</p>`}
        </div>`;
    },
    jcMissionTicket(story, co, lv, i) {
      const workDir = `~/job-sim/${lv.missionId}`;
      const proof = this.jobSimProofs[lv.missionId];
      const key = `${co.logo.text.toUpperCase()}-${101 + i}`;
      return `
        <div class="jc-ticket jc-enter">
          <div class="jc-ticket-head">
            <span class="jc-key">${key}</span>
            <span class="jc-pill ${proof ? "done" : "doing"}">${proof ? this.l("Selesai", "Done") : this.l("Sedang dikerjakan", "In progress")}</span>
            <span class="small muted">${this.l("Ditugaskan ke", "Assignee")}: ${this.esc(this.jcPlayerName())}</span>
          </div>
          <h2>${this.esc(this.t(lv.title).replace(/^(Misi|Mission) \d\.\d: /, ""))}</h2>
          <div class="jc-ticket-grid">
            <div class="stack-sm">
              <h3>${this.l("Kriteria penerimaan", "Acceptance criteria")}</h3>
              <ul class="jc-ac">${(lv.spec.rules[this.lang] || lv.spec.rules.en).map((r) => `<li>${this.inline(r)}</li>`).join("")}</ul>
            </div>
            <aside class="stack-sm jc-ticket-side">
              <div><span class="label">${this.l("File", "File")}</span><div><code>${this.esc(lv.spec.file)}</code></div></div>
              <div><span class="label">${this.l("Fungsi", "Function")}</span><div><code class="jc-wrap">${this.esc(lv.spec.functionSig)}</code></div></div>
              <div><span class="label">${this.l("Tahap", "Lifecycle")}</span><div class="small">${this.esc(lv.lifecycle)}</div></div>
            </aside>
          </div>
          <details class="tryit-reveal">
            <summary>📄 ${this.l("File awal yang ditulis init (aturan di atas, fungsi masih kosong)", "The starter file init writes (the rules above, an empty function)")}</summary>
            <div class="code-wrap" style="margin-top:8px"><pre data-lang="python"><code>${this.esc(lv.spec.starterCode)}</code></pre></div>
          </details>
          <h3>${this.l("Kerjakan di komputer Anda", "Do it on your computer")}</h3>
          <p class="small muted">${this.l("Dari folder kursus: buat file awalnya, tulis fungsinya di editor, lalu verifikasi. Pemeriksa juga memakai data tersembunyi dan menolak salinan solusi referensi.", "From the course folder: create the starter, write the function in your editor, then verify. The checker also uses hidden data and refuses a copy of the reference solution.")}</p>
          <div class="code-wrap"><button class="copy-btn" onclick="app.copyCode(this)">${this.l("Salin", "Copy")}</button><pre><code>${this.esc(`python3 scripts/job_sim.py init ${lv.missionId} ${workDir}\n# ${this.l("tulis fungsinya di", "write the function in")} ${workDir}/${lv.spec.file}\npython3 scripts/job_sim.py verify ${lv.missionId} ${workDir}`)}</code></pre></div>
          <div class="row">
            <input type="text" id="jobsim-proof-input-${lv.missionId}" autocomplete="off" spellcheck="false" placeholder="JOB1:${lv.missionId}:…" value="${proof ? this.esc(proof.token) : ""}" class="jc-token" onkeydown="if(event.key==='Enter'){app.submitJobSimProof('${lv.missionId}')}" />
            <button class="btn btn-sm btn-primary" onclick="app.submitJobSimProof('${lv.missionId}')">${this.l("Kirim untuk review", "Submit for review")}</button>
          </div>
          <div id="jobsim-proof-msg-${lv.missionId}"></div>
        </div>`;
    },
    jcMissionReview(story, co, lv, i) {
      const proof = this.jobSimProofs[lv.missionId];
      const C = window.JOB_CAREER_DATA.COMMON;
      const mgr = this.jcPerson(co, co.manager);
      const from = this.jcPerson(co, co.levels[i].from);
      const next = i < 3 ? story.levels[i + 1] : null;
      return `
        <div class="jc-ship jc-enter">🚀 <strong>${this.l("Sudah di produksi", "Shipped to production")}</strong> · ${this.l(`${proof.passed} pemeriksaan lulus, Python ${this.esc(proof.py)}`, `${proof.passed} checks passed, Python ${this.esc(proof.py)}`)}</div>
        <div class="jc-chat jc-enter"><div class="jc-chat-body">
          <div class="jc-chat-msg">${this.jcAvatar(from)}<div><div class="jc-chat-who"><strong>${this.esc(from.name)}</strong> <span>${this.esc(this.t(from.role))}</span></div><p>${this.inline(this.t(co.levels[i].after))}</p></div></div>
        </div></div>
        <div class="jc-oneonone jc-enter">
          <div class="jc-dialogue-who">${this.jcAvatar(mgr, "lg")}<div><span class="label">${this.l("1:1 dengan atasan", "1:1 with your manager")}</span><strong>${this.esc(mgr.name)}</strong></div></div>
          <p class="jc-dialogue-text">${this.inline(this.t(co.levels[i].oneOnOne))}</p>
          <div class="jc-promo"><span class="muted">${this.esc(this.t(C.titles[i]))}</span><span>→</span><strong>${this.esc(this.t(C.titles[i + 1]))}</strong></div>
        </div>
        <div class="card stack-sm jc-enter">
          <h3>${this.l("Untuk CV Anda", "For your CV")}</h3>
          <div class="well row between" style="gap:10px;align-items:center"><span class="small" style="flex:1">${this.inline(story.starResumeBullets[i])}</span><button class="btn btn-sm btn-quiet" onclick="app.pushJobSimBulletToCv('${story.id}', ${i})">➕ ${this.l("Ke CV", "Add to CV")}</button></div>
          <details class="tryit-reveal"><summary>👁️ ${this.l("Bandingkan dengan solusi referensi", "Compare with the reference solution")}</summary><div class="code-wrap" style="margin-top:8px"><pre data-lang="python"><code>${this.esc(lv.spec.referenceCode)}</code></pre></div></details>
        </div>
        <div class="row jc-enter" style="gap:8px">
          ${next ? `<button class="btn btn-primary jc-cta" onclick="app.jcSetTab('inbox');app.jcMsg='m${i + 1}';app.go('job-sim','${story.id}')">📥 ${this.l(`${this.t(C.levelWhen[i + 1])}: pesan baru di kotak masuk →`, `${this.t(C.levelWhen[i + 1])}: a new message in your inbox →`)}</button>`
                 : `<button class="btn btn-primary jc-cta" onclick="app.jcSetTab('inbox');app.jcMsg='review';app.go('job-sim','${story.id}')">🏆 ${this.l("Buka evaluasi tahunan →", "Open your annual review →")}</button>`}
        </div>`;
    }
  });
})();
