// The per-lesson lab pieces: cutting a piece out of the lab file and putting it back must lose nothing.
//   node scripts/test_lesson_lab.js
const fs = require("fs");
const path = require("path");
const L = require("../app/js/lesson-lab.js");
const root = path.join(__dirname, "..", "labs", "mod-0-0");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL", m); } };

const start = read("practice.py"), ref = read("reference/practice.py");
let draft = start;
for (let n = 1; n <= 4; n++) {
  const piece = getStepOrFail(start, n);
  ok(!/^#\s*-{20}/m.test(piece), `step ${n} piece holds no header`);
  ok(L.setStep(start, n, piece).draft === start, `step ${n}: cut and put back gives the same file`);
  draft = L.setStep(draft, n, L.getStep(ref, n)).draft;
}
ok([1, 2, 3, 4].every((n) => L.getStep(draft, n) === L.getStep(ref, n)), "the four reference steps, put into the starter, read back the same");
ok(draft.split("\n").slice(0, 16).join("\n") === start.split("\n").slice(0, 16).join("\n"), "the part of the file outside the steps (docstring, INPUTS) is untouched");
ok(L.inputs(start).includes("amount = 1250000") && !L.inputs(start).includes("None"), "inputs block");

const names = [["format_rupiah", "count_by_status", "unique_customer_ids", "average_total", "total_revenue", "batches", "top_customers"], ["safe_int", "add_to_batch", "split_valid"], ["read_orders"]];
const bstart = read("basics.py"), bref = read("reference/basics.py");
let bd = bstart;
for (const group of names) {
  const piece = L.getFuncs(bstart, group);
  ok(piece && group.every((n) => piece.includes(`def ${n}(`)), `funcs ${group[0]}: piece has its defs`);
  ok(L.setFuncs(bstart, group, piece).draft === bstart, `funcs ${group[0]}: cut and put back gives the same file`);
  bd = L.setFuncs(bd, group, L.getFuncs(bref, group)).draft;
}
ok(names.every((g) => L.getFuncs(bd, g) === L.getFuncs(bref, g)), "the reference functions, put into the starter, read back the same");
ok(bd.startsWith(bstart.split("def format_rupiah")[0]), "the part of the file before the functions (docstring, imports) is untouched");
ok(L.setFuncs(bstart, names[2], "x = 1").error === "defs", "a piece without its def is refused");
ok(L.setFuncs(bstart, names[1], L.getFuncs(bstart, names[1]).replace("def safe_int(", "def safe_integer(")).error === "defs", "a renamed def is refused");

function getStepOrFail(d, n) { const p = L.getStep(d, n); ok(p !== null, `step ${n} found`); return p || ""; }
console.log(bad ? `${bad} problems` : "lesson lab pieces: all ok");
process.exit(bad ? 1 : 0);
