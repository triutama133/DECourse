#!/usr/bin/env node
// Automated CI check for:
//   1. Story-driven Job Career Mode (job-career-data.js + job-career.js)
//   2. Story-driven Panel Interview Loop (interview-sim-data.js + interview-sim.js)
//   3. Live SQLite WASM SQL Arena grading (interview-data.js + vendor/sqljs)
//   4. App helper invariants (import/export key coverage, Traceback Coach, spaced recall)
// Usage: node scripts/verify_simulators.js
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const initSqlJs = require(path.join(__dirname, "../app/vendor/sqljs/sql-wasm.js"));

const ROOT = path.resolve(__dirname, "..");

function makeSandbox() {
  const store = {};
  const ctx = {
    window: null,
    globalThis: null,
    console,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Date,
    Set,
    RegExp,
    Error,
    performance: { now: () => 1 },
    scrollTo: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i]
    },
    document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, body: {} },
    location: { hash: "#/interview", protocol: "http:" },
    navigator: { clipboard: { writeText: async () => {} } }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  return ctx;
}

function loadAppClass(ctx) {
  ctx.INTERVIEW_TABS = ["system-design", "sql-arena", "incidents", "silent-bugs", "pr-review", "active-recall", "stakeholder-defense"];
  ctx.TRANSLATIONS = {
    id: { interviewTitle: "Wawancara", interviewSubtitle: "Sub", tabSystemDesign: "SD", tabSqlArena: "SQL", tabIncidents: "Inc" },
    en: { interviewTitle: "Interview", interviewSubtitle: "Sub", tabSystemDesign: "SD", tabSqlArena: "SQL", tabIncidents: "Inc" }
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/job-sim-data.js"), "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/job-sim-warmup.js"), "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/job-career-data.js"), "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/interview-sim-data.js"), "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/interview-data.js"), "utf8"), ctx);

  ctx.DataForgeApp = function DataForgeApp() {
    this.lang = "en";
    this.completedModules = ["mod-0-0", "mod-0-1", "mod-0-3"];
    this.activeInterviewTab = "system-design";
    this.activeInterviewMode = "loop";
    this.jobSimProofs = {};
    this.jobSimGates = {};
  };
  ctx.DataForgeApp.prototype = {
    t: function (o) { return o && typeof o === "object" ? (o[this.lang] || o.id || o.en) : o; },
    l: function (id, en) { return this.lang === "id" ? id : en; },
    esc: (s) => String(s == null ? "" : s),
    inline: (s) => String(s == null ? "" : s),
    md: (s) => String(s == null ? "" : s),
    playTone: () => {},
    recordStudy: () => {},
    renderView: () => {},
    go: (...parts) => { ctx.location.hash = "#/" + parts.join("/"); },
    renderDuelBanner: () => "<duel/>",
    renderInterviewTabContent: function () { return "<arena:" + this.activeInterviewTab + "/>"; },
    renderJobSimWorkspace: () => "<missions/>"
  };

  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/job-career.js"), "utf8"), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/interview-sim.js"), "utf8"), ctx);
}

function testJobCareer(ctx, app) {
  const { COMPANIES } = ctx.JOB_CAREER_DATA;
  const ids = Object.keys(COMPANIES);
  assert(ids.length >= 4, "Expected at least 4 companies in JOB_CAREER_DATA.COMPANIES");

  for (const lang of ["en", "id"]) {
    app.lang = lang;
    ctx.location.hash = "#/job-sim";
    const board = app.renderJobSimView();
    assert(!board.includes("undefined") && !board.includes("NaN"), "Job board clean in " + lang);

    for (const cid of ids) {
      const co = COMPANIES[cid];
      assert(co.people[co.manager], "Valid manager for " + cid);
      app._jc = app._jc || {};
      delete app._jc[cid];
      app.go("job-sim", cid);
      const post = app.renderJobSimView();
      assert(post.includes(co.name) && !post.includes("undefined"), "Posting renders for " + cid);

      app.jcSetStage(cid, "apply");
      const applyHtml = app.renderJobSimView();
      assert(!applyHtml.includes("undefined"), "Apply stage renders for " + cid);

      app.jcApply(cid);
      app.jcSetStage(cid, "interview");
      const iv = app.renderJobSimView();
      assert(iv.length > 100 && !iv.includes("undefined"), "Interview scene renders for " + cid);

      for (let q = 0; q < co.interview.questions.length; q++) {
        app.jcAnswer(cid, q, 0);
      }
      app.jcSetStage(cid, "offer");
      const offerHtml = app.renderJobSimView();
      assert(!offerHtml.includes("NaN") && !offerHtml.includes("undefined"), "Offer renders for " + cid);

      app.jcSign(cid);
      app.jcSetStage(cid, "day1");
      const day1Html = app.renderJobSimView();
      assert(day1Html.length > 100 && !day1Html.includes("NaN") && !day1Html.includes("undefined"), "Day 1 renders for " + cid);

      app.jcNextLine(cid);
      app.jcSetStage(cid, "desk");
      const deskHtml = app.renderJobSimView();
      assert(deskHtml.length > 100 && !deskHtml.includes("undefined"), "Desk renders for " + cid);
    }
  }
  console.log(`Job Career Mode verified: ${ids.length} companies x 2 languages`);
}

function testInterviewSim(ctx, app) {
  const { COMPETENCIES, TRACKS } = ctx.INTERVIEW_SIM_DATA;
  assert(COMPETENCIES.length === 4 && TRACKS.length === 3, "Expected 4 competencies and 3 interview tracks");

  for (const lang of ["en", "id"]) {
    app.lang = lang;
    app.activeInterviewMode = "loop";
    ctx.location.hash = "#/interview";
    const lobby = app.renderInterviewView();
    assert(!lobby.includes("undefined") && !lobby.includes("NaN"), "Interview lobby clean in " + lang);

    for (const tr of TRACKS) {
      assert(tr.people[tr.screening.who], "Valid recruiter in " + tr.id);
      assert(tr.rounds.length === 3, "3 rounds in " + tr.id);

      app.isRestartTrack(tr.id);
      app.isOpenTrack(tr.id);
      const prep = app.renderInterviewView();
      assert(prep.includes(tr.company) && !prep.includes("undefined"), "Prep clean for " + tr.id);

      app.isPickPitch(tr.id, tr.screening.pitches.findIndex((p) => p.good));
      app.isStartCall(tr.id);
      tr.rounds.forEach((r, ri) => {
        assert(tr.people[r.who], "Valid speaker " + r.who);
        const callHtml = app.renderInterviewView();
        assert(callHtml.includes(tr.people[r.who].name) && !callHtml.includes("undefined"), "Call clean for " + r.id);
        app.isAnswerStep(tr.id, ri, "initial", r.initial.options.findIndex((o) => o.good));
        app.isAnswerStep(tr.id, ri, "followup", r.followup.options.findIndex((o) => o.good));
        app.isNextRound(tr.id);
      });

      const goodScore = app.isComputeSignals(tr, app.isState(tr.id)).total;
      assert(goodScore >= 75, `Optimal path for ${tr.id} scored ${goodScore}, expected >= 75`);
      const debriefHtml = app.renderInterviewView();
      assert(!debriefHtml.includes("NaN") && !debriefHtml.includes("undefined"), "Debrief clean for " + tr.id);

      app.isRestartTrack(tr.id);
      app.isPickPitch(tr.id, tr.screening.pitches.findIndex((p) => !p.good));
      app.isStartCall(tr.id);
      tr.rounds.forEach((r, ri) => {
        app.isAnswerStep(tr.id, ri, "initial", r.initial.options.findIndex((o) => !o.good));
        app.isAnswerStep(tr.id, ri, "followup", r.followup.options.findIndex((o) => !o.good));
        app.isNextRound(tr.id);
      });
      const badScore = app.isComputeSignals(tr, app.isState(tr.id)).total;
      assert(badScore < 70, `Weak path for ${tr.id} scored ${badScore}, expected < 70`);
    }

    app.isSetMode("arena");
    const arenaHtml = app.renderInterviewView();
    assert(arenaHtml.includes("<arena:system-design/>") && arenaHtml.includes("<duel/>"), "Arena fallback works in " + lang);
    app.isSetMode("loop");
  }
  console.log(`Interview Loop Simulator verified: ${TRACKS.length} tracks x 2 languages`);
}

async function testSqlArena(ctx) {
  const probs = ctx.INTERVIEW_DATA.sqlArenaProblems;
  assert(probs.length === 4, "Expected 4 sqlArenaProblems");
  const SQL = await initSqlJs({ locateFile: (f) => path.join(ROOT, "app/vendor/sqljs", f) });
  const norm = (rows) => rows.map((r) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)))).sort();

  for (const p of probs) {
    assert(p.sandboxSetup && p.sandboxAdversarial && p.sqliteSolutionSql, "Missing SQLite sandbox fields on " + p.id);
    const db1 = new SQL.Database();
    db1.exec(p.sandboxSetup);
    const mainRes = db1.exec(p.sqliteSolutionSql);
    db1.close();
    assert(mainRes.length === 1 && mainRes[0].values.length > 0, "Main SQLite run empty on " + p.id);

    const db2 = new SQL.Database();
    db2.exec(p.sandboxSetup + "\n" + p.sandboxAdversarial);
    const advRes = db2.exec(p.sqliteSolutionSql);
    db2.close();
    assert(advRes.length === 1 && advRes[0].values.length > 0, "Adversarial SQLite run empty on " + p.id);

    const dbBad = new SQL.Database();
    dbBad.exec(p.sandboxSetup);
    const badRes = dbBad.exec("SELECT 1;");
    dbBad.close();
    const sameCols = badRes[0].columns.length === mainRes[0].columns.length;
    const sameRows = sameCols && JSON.stringify(norm(badRes[0].values)) === JSON.stringify(norm(mainRes[0].values));
    assert(!sameRows, "Bad query incorrectly matched reference on " + p.id);
  }
  console.log(`Live SQL Arena verified in SQLite WASM: ${probs.length} problems x main + hostile checks`);
}

function testAppHelpers() {
  const appSrc = fs.readFileSync(path.join(ROOT, "app/js/app.js"), "utf8");
  const impStart = appSrc.indexOf("importProgress(");
  assert(impStart > -1, "importProgress missing in app.js");
  const impBlock = appSrc.slice(impStart, impStart + 4500);
  for (const key of ["df_py_done", "df_sql_done", "df_drills", "df_drill_code", "df_job_career", "df_interview_sim"]) {
    assert(appSrc.includes(`"${key}"`), `Missing persistence key ${key} in app.js`);
    assert(impBlock.includes(key), `importProgress missing sync for ${key}`);
  }
  assert(appSrc.includes("pyFriendlyError(") && appSrc.includes("sqlStartWarm("), "Missing Traceback Coach or SQL warmup in app.js");
  console.log("App helper & import/export sync verified");
}

(async () => {
  const ctx = makeSandbox();
  loadAppClass(ctx);
  const app = new ctx.DataForgeApp();
  ctx.window.app = app;

  testJobCareer(ctx, app);
  testInterviewSim(ctx, app);
  await testSqlArena(ctx);
  testAppHelpers();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
