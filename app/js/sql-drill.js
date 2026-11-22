/* SQL drills: run the learner's query on a small dataset, run the model answer, and compare the RESULTS (not the text).
 *
 * Pure logic over a sql.js engine, so the browser (window.SqlDrill) and Node (scripts/verify_sql_drills.js) grade the same way.
 *   grade(SQL, ctx, drill, learnerSql)   ctx = {setup, mutation}: the dataset's SQL, and extra rows for the "other data" pass
 *   stages(SQL, setup, stages)           the result of every stage of a ":::sqlsteps" animation
 * The grade says what is wrong in a code (error / need / empty / columns / names / rows / values / order / other-data), with the facts;
 * the app turns that into a sentence in the learner's language.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SqlDrill = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const LIMIT = 200;   // rows kept per result

  /** Run SQL text on `db`; returns {ok, error} or {ok, columns, rows, has} for the LAST statement that makes a table (even with 0 rows). */
  function exec(db, sql) {
    let last = null;
    try {
      for (const st of db.iterateStatements(sql)) {
        const columns = st.getColumnNames();
        if (columns.length) {
          const rows = [];
          while (st.step()) { rows.push(st.get()); if (rows.length >= LIMIT) break; }
          last = { columns, rows };
        } else st.step();
      }
    } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
    return last ? { ok: true, has: true, columns: last.columns, rows: last.rows } : { ok: true, has: false, columns: [], rows: [] };
  }

  function fresh(SQL, setup, mutation) {
    const db = new SQL.Database();
    db.exec(setup);
    if (mutation) db.exec(mutation);
    return db;
  }

  const norm = (rows) => rows.map((r) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)))).sort();
  const same = (a, b, ordered) => {
    if (a.rows.length !== b.rows.length) return "rows";
    const x = ordered ? a.rows.map((r) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)))) : norm(a.rows);
    const y = ordered ? b.rows.map((r) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)))) : norm(b.rows);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return "values";
    return "";
  };

  function runOn(SQL, ctx, sql, verify, mutation) {
    const db = fresh(SQL, ctx.setup, mutation);
    try {
      const r = exec(db, sql);
      if (!r.ok) return r;
      if (verify) return exec(db, verify);
      return r;
    } finally { db.close(); }
  }

  function regexOf(text) {
    const m = String(text).match(/^\/(.*)\/([gimsuy]*)$/s);
    try { return m ? new RegExp(m[1], m[2] || "i") : new RegExp(text, "i"); } catch (e) { return null; }
  }

  function grade(SQL, ctx, drill, learnerSql) {
    const verify = drill.verify || "";
    const mine = runOn(SQL, ctx, learnerSql, verify, "");
    if (!mine.ok) return { ok: false, kind: "error", error: mine.error };
    for (const c of drill.checks || []) {   // @check lines: /regex/ ## message  (the query must contain this)
      const re = regexOf(c.expr);
      if (re && !re.test(learnerSql)) return { ok: false, kind: "need", msg: c.msg, result: mine.has ? { columns: mine.columns, rows: mine.rows } : null };
    }
    if (!mine.has) return { ok: false, kind: "empty" };
    const ref = runOn(SQL, ctx, drill.solution, verify, "");
    if (!ref.ok || !ref.has) return { ok: false, kind: "broken-drill", error: ref.error || "the model answer returns no table" };
    const result = { columns: mine.columns, rows: mine.rows };
    if (mine.columns.length !== ref.columns.length) return { ok: false, kind: "columns", expected: ref.columns.length, got: mine.columns.length, result };
    if (drill.names && mine.columns.map((c) => c.toLowerCase()).join(",") !== ref.columns.map((c) => c.toLowerCase()).join(",")) return { ok: false, kind: "names", expected: ref.columns, got: mine.columns, result };
    const diff = same(mine, ref, drill.ordered);
    if (diff === "rows") return { ok: false, kind: "rows", expected: ref.rows.length, got: mine.rows.length, result };
    if (diff === "values") {
      if (drill.ordered && same(mine, ref, false) === "") return { ok: false, kind: "order", result };
      return { ok: false, kind: "values", result };
    }
    if (ctx.mutation) {   // the same question on data with extra rows and NULLs: a query that only "knows" today's numbers fails here
      const m2 = runOn(SQL, ctx, learnerSql, verify, ctx.mutation);
      const r2 = runOn(SQL, ctx, drill.solution, verify, ctx.mutation);
      if (r2.ok && r2.has) {
        if (!m2.ok || !m2.has || m2.columns.length !== r2.columns.length || same(m2, r2, drill.ordered)) return { ok: false, kind: "other-data", result };
      }
    }
    return { ok: true, result };
  }

  function stages(SQL, setup, list) {
    const db = fresh(SQL, setup, "");
    try {
      return list.map((s) => {
        const r = exec(db, s.sql);
        return r.ok ? { label: s.label, sql: s.sql, say: s.say, columns: r.columns, rows: r.rows, has: r.has } : { label: s.label, sql: s.sql, say: s.say, error: r.error };
      });
    } finally { db.close(); }
  }

  return { exec, fresh, grade, stages, regexOf };
});
