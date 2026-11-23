// The plain-words error help: static cases (both languages, with and without pytest's "E   " prefix) and REAL tracebacks
// produced by the vendored Pyodide, so the patterns match what a learner actually sees.
//   node scripts/test_error_hints.js
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const Hints = require("../app/js/error-hints.js");
let bad = 0;
const fail = (m) => { bad++; console.log("FAIL " + m); };
const has = (r, ...subs) => r && subs.every((s) => r.tips.join(" | ").includes(s));

// 1. static cases: [error text, substrings that must appear in the English tips]
const cases = [
  ["NameError: name 'totl' is not defined", "`totl`", "capitals"],
  ["E   NameError: name 'totl' is not defined", "`totl`"],
  ["KeyError: 'status'", "`'status'`", "d.get"],
  ["E   KeyError: 'total_idr'", "`'total_idr'`"],
  ["ZeroDivisionError: division by zero", "divided by zero"],
  ["IndexError: list index out of range", "start at 0"],
  ["IndexError: pop from empty list", "empty list"],
  ["TypeError: can only concatenate str (not \"int\") to str", "text and a int", "str(...)"],
  ["TypeError: unsupported operand type(s) for +: 'int' and 'str'", "int and a str"],
  ["TypeError: '>' not supported between instances of 'str' and 'int'", "str with a int"],
  ["TypeError: 'NoneType' object is not subscriptable", "None", "return"],
  ["TypeError: add() takes 2 positional arguments but 3 were given", "add()", "2 argument"],
  ["TypeError: add() missing 1 required positional argument: 'b'", "add()", "1 value"],
  ["TypeError: 'int' object is not callable", "int", "Rename"],
  ["TypeError: 'int' object is not iterable", "range(n)"],
  ["TypeError: unhashable type: 'list'", "tuple"],
  ["TypeError: something else entirely", "type(...)"],
  ["ValueError: invalid literal for int() with base 10: 'Rp 5.000'", "int()", "Rp 5.000", ".strip()"],
  ["ValueError: not enough values to unpack (expected 2, got 1)", "more names"],
  ["ValueError: too many values to unpack (expected 2)", "fewer names"],
  ["ValueError: time data '31/02/2026' does not match format '%Y-%m-%d'", "31/02/2026"],
  ["AttributeError: 'NoneType' object has no attribute 'strip'", ".strip", "None"],
  ["AttributeError: 'int' object has no attribute 'strip'", "int", "type(x)"],
  ["AttributeError: module 'math' has no attribute 'sqroot'", "sqroot"],
  ["AttributeError: partially initialized module 'csv' has no attribute 'reader' (most likely due to a circular import)", "same name"],
  ["FileNotFoundError: [Errno 2] No such file or directory: 'orders.csv'", "orders.csv", "pwd"],
  ["ModuleNotFoundError: No module named 'pandas'", "pandas", "pip install pandas"],
  ["ImportError: cannot import name 'foo' from 'bar'", "foo"],
  ["RecursionError: maximum recursion depth exceeded", "base case"],
  ["AssertionError: assert 3 == 4", "compared two values"],
  ["IndentationError: expected an indented block after 'if' statement on line 2", "colon"],
  ["IndentationError: unexpected indent", "more than the line above"],
  ["IndentationError: unindent does not match any outer indentation level", "matches none"],
  ["SyntaxError: '(' was never closed", "`(`"],
  ["SyntaxError: unterminated string literal (detected at line 1)", "closing quote"],
  ["SyntaxError: expected ':'", "colon is missing"],
  ["SyntaxError: invalid syntax. Perhaps you forgot a comma?", "comma"],
  ["SyntaxError: invalid syntax", "colon", "bracket"],
  ["UnboundLocalError: cannot access local variable 'total' where it is not associated with a value", "`total`", "parameter"],
];
for (const [text, ...subs] of cases) {
  const en = Hints.explain(text, "en"), id = Hints.explain(text, "id");
  if (!en) { fail("no hint (en): " + text); continue; }
  if (!has(en, ...subs)) fail(`missing ${JSON.stringify(subs)} in "${text}" -> ${en.tips.join(" | ")}`);
  if (!id || !id.tips.length || id.tips.join("").includes("undefined")) fail("bad Indonesian hint: " + text);
  if (en.tips.length < 2 || en.tips.length > 3) fail(`${text}: ${en.tips.length} tips (want 2 or 3)`);
  if (en.tips.join("").includes("undefined") || en.tips.join("").includes("[object")) fail("undefined in tips: " + text);
}
// full tracebacks: the hint comes from the last error line, and unknown errors give nothing
const tb = "Traceback (most recent call last):\n  File \"<drill>\", line 3, in <module>\nTypeError: can only concatenate str (not \"int\") to str";
if (!has(Hints.explain(tb, "en"), "str(...)")) fail("full traceback");
if (Hints.explain("KeyboardInterrupt", "en") !== null) fail("unknown error must give null");
if (Hints.explain("", "en") !== null || Hints.explain(undefined, "id") !== null) fail("empty input must give null");

// 2. real tracebacks from the real Python engine: every one of these must be recognised
const snippets = {
  "NameError": "print(totl)", "KeyError": "d = {'a': 1}\nd['b']", "ZeroDivisionError": "1 / 0", "IndexError": "[1, 2][5]",
  "TypeError concat": "'a' + 1", "TypeError operand": "1 + 'a'", "TypeError compare": "'a' > 1", "TypeError None": "x = None\nx[0]",
  "TypeError args": "def f(a): return a\nf(1, 2)", "TypeError missing": "def f(a, b): return a\nf(1)", "TypeError callable": "x = 5\nx()",
  "ValueError int": "int('Rp 5')", "ValueError unpack": "a, b = [1]", "ValueError date": "import datetime\ndatetime.datetime.strptime('31/02', '%Y-%m-%d')",
  "AttributeError None": "x = None\nx.strip()", "AttributeError int": "x = 5\nx.strip()", "FileNotFoundError": "open('nope.csv')",
  "ModuleNotFoundError": "import nopkg", "RecursionError": "def f(n): return f(n + 1)\nf(0)", "UnboundLocalError": "def f():\n    print(t)\n    t = 1\nf()",
  "SyntaxError colon": "if True\n    pass", "SyntaxError bracket": "print('a'", "SyntaxError quote": "print('a)", "IndentationError block": "if True:\npass", "IndentationError unexpected": "x = 1\n    y = 2",
};
(async () => {
  const V = path.join(ROOT, "app", "vendor", "pyodide");
  const { loadPyodide } = require(path.join(V, "pyodide.js"));
  const py = await loadPyodide({ indexURL: V });
  py.runPython(fs.readFileSync(path.join(ROOT, "app/js/browser-lab-runner.py"), "utf8"));
  const run = py.globals.get("check_drill");
  for (const [name, code] of Object.entries(snippets)) {
    const r = JSON.parse(String(run(code, py.toPy([["True", "x"]]), py.toPy({}))));
    if (!r.error) { fail(`${name}: the snippet did not fail`); continue; }
    const en = Hints.explain(r.error, "en");
    if (!en) fail(`${name}: real error not recognised: ${JSON.stringify(r.error.split("\n").slice(-2).join(" / "))}`);
  }
  console.log(`${cases.length} static cases and ${Object.keys(snippets).length} real tracebacks checked, ${bad} problems`);
  process.exit(bad ? 1 : 0);
})();
