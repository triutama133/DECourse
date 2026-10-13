"""Checks for the Try it exercises of Module 1.6 (ingestion). Used by check.py; not meant to be run directly."""
import ast
import importlib.util
import json
import os
import re
import signal
import sqlite3
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from http.server import ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from check import ROOT, exercise, tail

FAKEAPI = ROOT / "labs" / "mod-1-6" / "fakeapi.py"
TOKEN_HEADER = "Bearer learner-token"


# ------------------------------------------------------------------------------------------------------------ practice API
class PracticeAPI:
    """The course's fake API (labs/mod-1-6/fakeapi.py) served from this process, with a log of every request it receives."""

    def __init__(self):
        spec = importlib.util.spec_from_file_location("tryit_fakeapi", FAKEAPI)
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)
        self.log = []                    # (time, path with query, Authorization header)
        self.limit_seconds = 2
        outer = self

        class Handler(self.mod.Handler):
            def log_message(self, fmt, *args):
                pass

            def do_GET(self):
                outer.log.append((time.time(), self.path, self.headers.get("Authorization")))
                if urlparse(self.path).path == "/limited" and outer.limit_seconds != 2 and self.headers.get("Authorization") == TOKEN_HEADER:
                    return self.limited(outer.limit_seconds)
                super().do_GET()

            def limited(self, secs):     # the same logic as fakeapi.py, with a penalty of `secs` seconds
                st, now = outer.mod.STATE, time.time()
                if now < st["limited_until"]:
                    return self.send_json(429, {"error": "too many requests"}, {"Retry-After": str(int(st["limited_until"] - now) + 1)})
                if st["armed"]:
                    st["armed"], st["limited_until"] = False, now + secs
                    return self.send_json(429, {"error": "too many requests"}, {"Retry-After": str(secs)})
                st["armed"] = True
                return self.send_json(200, {"ok": True, "message": "you waited long enough"})

        self.server = ThreadingHTTPServer(("127.0.0.1", self.mod.PORT), Handler)

    def reset(self):
        self.mod.reset()
        self.limit_seconds = 2
        self.log.clear()

    def requests(self, prefix):
        return [e for e in self.log if urlparse(e[1]).path.startswith(prefix)]


@contextmanager
def practice_api(ctx):
    """Yield the practice API, or None (after a FAIL) when port 8765 is already taken, for example by your own copy."""
    try:
        api = PracticeAPI()
    except OSError:
        ctx.fail("port 8765 is free for the checker", "stop your own practice API (Ctrl+C in its terminal) and run the check again; the checker starts its own copy")
        yield None
        return
    threading.Thread(target=api.server.serve_forever, daemon=True).start()
    try:
        yield api
    finally:
        api.server.shutdown()
        api.server.server_close()


def run_script(ctx, name, timeout=30):
    """Run one of your scripts in the private folder. Returns (exit code or None on timeout, stdout, stderr)."""
    try:
        p = subprocess.run([sys.executable, name], cwd=str(ctx.work), capture_output=True, text=True, timeout=timeout,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"})
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return None, "", f"did not finish within {timeout} seconds"


def ints(text):
    return re.findall(r"\d+", text)


def has_subsequence(items, wanted):
    it = iter(items)
    return all(any(x == w for x in it) for w in wanted)


def query(entry):
    return {k: v[0] for k, v in parse_qs(urlparse(entry[1]).query).items()}


# ------------------------------------------------------------------------------------------------------------ 1.6-2
@exercise("1.6-2", "call the practice API with urllib", ["try_http.py"], [
    "Start the practice API in its own terminal first, and read the status line the server sends back for the call without a token.",
    "With urllib, a response to a failed request is raised as an exception: look at urllib.error.HTTPError and the attribute that holds the status code.",
    "urllib.request.Request takes a headers dictionary; the header is called Authorization and its value is the word Bearer, a space, and the token."])
def ex_1_6_2(ctx):
    if not ctx.need_files(["try_http.py"]):
        return
    tree = ast.parse((ctx.work / "try_http.py").read_text(encoding="utf-8"))
    names = {a.name.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
    names |= {n.module.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and n.module}
    third = sorted(names & {"requests", "httpx", "urllib3", "aiohttp"})
    ctx.check(not third, "uses only the standard library (urllib)", f"you import {', '.join(third)}; the exercise asks for urllib only")
    with practice_api(ctx) as api:
        if api is None:
            return
        api.reset()
        code, out, err = run_script(ctx, "try_http.py", 20)
        ctx.check(code == 0, "the script ends without an error", tail(err))
        lines = out.splitlines()
        i200 = next((i for i, l in enumerate(lines) if re.search(r"\b200\b", l) and "[1, 2, 3]" in l), None)
        i401 = next((i for i, l in enumerate(lines) if re.search(r"\b401\b", l)), None)
        ctx.check(i200 is not None, "prints the status 200 together with the ids [1, 2, 3]", f"your output: {tail(out)}")
        ctx.check(i401 is not None, "prints 401 for the call without the header", f"your output: {tail(out)}")
        ctx.check(i200 is not None and i401 is not None and i200 < i401, "the successful call comes first, the failing one after it")
        orders = api.requests("/orders")
        ctx.check(any(e[2] == TOKEN_HEADER and query(e).get("limit") == "3" for e in orders), "sent a request with limit=3 and the Authorization header")
        ctx.check(any(not e[2] for e in orders), "also sent a request without the Authorization header")


# ------------------------------------------------------------------------------------------------------------ 1.6-3
@exercise("1.6-3", "cursor pages and rate limits", ["cursor_all.py", "limited.py"], [
    "Cursor pagination: you never compute the next position yourself, the server gives it to you. What does the last page return instead of a cursor?",
    "A loop that runs `while cursor is not None` and puts the cursor into the next URL. The new orders arrive while you are in the middle of it; the cursor does not care.",
    "On a 429 read the Retry-After header from the error (HTTPError has .headers), sleep that many seconds, then call again. Do not guess the number: the checker changes it."])
def ex_1_6_3(ctx):
    if not ctx.need_files(["cursor_all.py", "limited.py"]):
        return
    with practice_api(ctx) as api:
        if api is None:
            return
        api.reset()
        code, out, err = run_script(ctx, "cursor_all.py", 30)
        ctx.check(code == 0, "cursor_all.py ends without an error", tail(err))
        ctx.check(ints(out).count("28") >= 2, "prints 28 collected ids and 28 distinct ids", f"your output: {tail(out)}")
        orders, arrive = api.requests("/orders"), api.requests("/arrive")
        ctx.check(len(arrive) == 1, "called /arrive exactly once", f"it was called {len(arrive)} times")
        cursors = [query(e).get("cursor") for e in orders]
        ctx.check(cursors == [None, "10", "20"], "followed next_cursor from page to page (no cursor, then 10, then 20)", f"cursors you sent: {cursors}")
        ctx.check(all(query(e).get("limit") == "10" for e in orders), "asked for limit=10 pages")
        if arrive and len(orders) > 1:
            ctx.check(orders[0][0] < arrive[0][0] < orders[1][0], "made the orders arrive right after the first page")
        ctx.check(all(e[2] == TOKEN_HEADER for e in orders + arrive), "sent the Authorization header every time")

        for secs in (2, 3):
            api.reset()
            api.limit_seconds = secs
            code, out, err = run_script(ctx, "limited.py", 30)
            label = f"limited.py, when the server asks for {secs} seconds"
            ctx.check(code == 0, f"{label}: ends without an error", tail(err))
            ctx.check(re.search(rf"429\D+{secs}(\.0)?\b", out) is not None, f"{label}: prints 429 and {secs}", f"your output: {tail(out)}")
            ctx.check(re.search(r"\b200\b", out.split("429")[-1]) is not None, f"{label}: prints 200 after the retry")
            calls = api.requests("/limited")
            if ctx.check(len(calls) == 2, f"{label}: made exactly 2 calls", f"it made {len(calls)} calls; wait instead of calling again"):
                gap = calls[1][0] - calls[0][0]
                ctx.check(secs - 0.15 <= gap <= secs + 3, f"{label}: waited as long as Retry-After says", f"you waited {gap:.1f} s")


# ------------------------------------------------------------------------------------------------------------ 1.6-4
def read_jsonl(path):
    rows, bad = [], 0
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    bad += 1
    return rows, bad


def finish(ctx, name, label):
    code, out, err = run_script(ctx, name, 40)
    ctx.check(code == 0, f"{label}: ends without an error", tail(err))


@exercise("1.6-4", "a loader that resumes from a checkpoint", ["load.py"], [
    "Order matters: write the page, only then save the checkpoint. Which of the two can you afford to repeat after a crash?",
    "The checkpoint file must never be half-written: write a temporary file in the same folder and use os.replace. At start-up, read the file if it exists and begin at its cursor.",
    "Even in the right order, the page in flight can be written twice after a crash (data written, checkpoint not yet saved). Keep a set of the ids already in out.jsonl and skip those."])
def ex_1_6_4(ctx):
    if not ctx.need_files(["load.py"]):
        return
    out_p, ck_p = ctx.work / "out.jsonl", ctx.work / "checkpoint.json"
    with practice_api(ctx) as api:
        if api is None:
            return
        api.reset()
        p = subprocess.Popen([sys.executable, "load.py"], cwd=str(ctx.work), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        deadline = time.time() + 20
        while time.time() < deadline and p.poll() is None and len(read_jsonl(out_p)[0]) < 10:
            time.sleep(0.05)
        if p.poll() is not None and len(read_jsonl(out_p)[0]) < 10:
            _, err = p.communicate()
            ctx.fail("load.py wrote two pages (10 orders) into out.jsonl before it ended", tail(err) if err.strip() else "it ended early; page size is limit=5 and it should pause after each page")
            return
        time.sleep(0.4)                                    # the script is now inside its sleep after a page
        if sys.platform == "win32":
            p.terminate()
        else:
            p.send_signal(signal.SIGINT)                   # the same as pressing Ctrl+C
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()
        p.communicate()
        rows, bad = read_jsonl(out_p)
        ctx.check(bad == 0, "every line of out.jsonl is complete JSON after the interruption")
        ids = {r.get("id") for r in rows}
        cursor = None
        if ctx.check(ck_p.exists(), "checkpoint.json exists after two pages", "save the checkpoint after each page"):
            try:
                data = json.loads(ck_p.read_text(encoding="utf-8"))
                ctx.ok("checkpoint.json is valid JSON even though the script was interrupted")
                cursor = data.get("cursor") if isinstance(data, dict) else None
            except ValueError:
                ctx.fail("checkpoint.json is valid JSON even though the script was interrupted", "write a temporary file first and swap it in with os.replace")
            if cursor is not None and str(cursor).isdigit():
                ctx.check(int(cursor) <= len(ids), "the checkpoint never gets ahead of the data it describes",
                          f"the checkpoint says {cursor} but out.jsonl holds only {len(ids)} distinct orders: a crash would lose a page; save the checkpoint AFTER writing")
                ctx.check(int(cursor) > 0, "the checkpoint records the progress of the pages already written")
            else:
                ctx.fail('checkpoint.json has a "cursor" with the position reached', f'it contains: {cursor!r}')
        # second run: must resume where the checkpoint says
        mark = len(api.log)
        finish(ctx, "load.py", "second run (resume)")
        resumed = [query(e) for e in api.log[mark:] if urlparse(e[1]).path == "/orders"]
        if cursor is not None and resumed:
            ctx.check(str(resumed[0].get("cursor")) == str(cursor), "the second run starts at the saved cursor instead of at the beginning",
                      f"it asked for cursor={resumed[0].get('cursor')}, the checkpoint said {cursor}")
        ctx.check(any(q.get("limit") == "5" for q in resumed), "reads pages of 5 (limit=5)")
        rows, bad = read_jsonl(out_p)
        got = [r.get("id") for r in rows]
        ctx.check(sorted(set(got)) == list(range(1, 26)), "all 25 orders are in out.jsonl after the second run", f"distinct ids: {len(set(got))}")
        ctx.check(len(got) == len(set(got)), "no order appears twice", f"{len(got)} lines but {len(set(got))} distinct ids: skip ids you already have")
        # third run: nothing left to do, nothing may change
        finish(ctx, "load.py", "third run (everything already loaded)")
        got2 = [r.get("id") for r in read_jsonl(out_p)[0]]
        ctx.check(got2 == got, "running it again changes nothing (the job is safe to repeat)", f"{len(got2)} lines now, {len(got)} before")


# ------------------------------------------------------------------------------------------------------------ 1.6-5
ORDER1 = {"id": 1, "status": "paid", "customer": {"id": 7, "name": "Budi", "address": {"city": "Jakarta", "zip": "10110"}},
          "items": [{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}], "total_idr": 1000}

HARNESS = r'''
import copy, json, sys
sys.path.insert(0, ".")
import flat
order1 = json.load(open("order1.json"))
res = {}
def attempt(name, fn):
    try:
        res[name] = ["ok", fn()]
    except BaseException as e:
        res[name] = ["err", type(e).__name__ + ": " + str(e)]
before = copy.deepcopy(order1)
attempt("order1", lambda: flat.flatten(order1))
res["mutated"] = order1 != before
attempt("deep", lambda: flat.flatten({"a": {"b": {"c": 1}}, "d": [1, 2], "e": None, "f": "x"}))
f1 = flat.flatten(copy.deepcopy(before)) if res["order1"][0] == "ok" else {}
f2 = dict(f1); f2["total_idr"] = "Rp 1.000"
attempt("tc_lesson", lambda: flat.type_changes(f1, f2))
attempt("tc_same", lambda: flat.type_changes({"a": 1}, {"a": 1}))
attempt("tc_two", lambda: sorted(flat.type_changes({"a": 1, "b": "x"}, {"a": "1", "b": 2.5})))
attempt("tc_extra", lambda: flat.type_changes({"a": 1}, {"a": 1, "b": 2}))
attempt("tc_missing", lambda: flat.type_changes({"a": 1, "b": 2}, {"a": 1}))
attempt("tc_value", lambda: flat.type_changes({"a": 1, "b": "x"}, {"a": 2, "b": "y"}))
attempt("tc_float", lambda: flat.type_changes({"a": 1}, {"a": 1.0}))
print(json.dumps(res))
'''


@exercise("1.6-5", "flatten a nested record and spot schema drift", ["flat.py"], [
    "Recursion is the natural tool: a function that, for each key, either stores the value or calls itself on the inner dictionary with a longer prefix.",
    "Dictionaries recurse, lists do not: keep a list as JSON text with json.dumps. Do not change the record you were given; build a new dict.",
    "type_changes compares type(value).__name__ for the keys that exist in BOTH records and returns one 'name: old -> new' text for each key whose type name differs."])
def ex_1_6_5(ctx):
    if not ctx.need_files(["flat.py"]):
        return
    (ctx.work / "order1.json").write_text(json.dumps(ORDER1), encoding="utf-8")
    (ctx.work / "_harness.py").write_text(HARNESS, encoding="utf-8")
    try:
        p = subprocess.run([sys.executable, "_harness.py"], cwd=str(ctx.work), capture_output=True, text=True, timeout=20)
        res = json.loads(p.stdout.strip().splitlines()[-1])
    except (subprocess.TimeoutExpired, ValueError, IndexError):
        ctx.fail("flat.py can be imported and flatten() can be called", tail(p.stderr) if "p" in locals() else "it took too long")
        return

    def get(name):
        status, value = res[name]
        return value if status == "ok" else None

    def err(name):
        return res[name][1] if res[name][0] == "err" else ""

    flat = get("order1") or {}
    ctx.check(get("order1") is not None, "flatten(order1) runs without an error", err("order1"))
    ctx.check(flat.get("customer_address_city") == "Jakarta", 'flat["customer_address_city"] == "Jakarta"', "nested objects become columns named by their path, joined with _")
    ctx.check(flat.get("customer_id") == 7, 'flat["customer_id"] == 7')
    ctx.check(flat.get("items") == '[{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}]', 'flat["items"] is the list kept as JSON text', f"you have: {flat.get('items')!r}")
    ctx.check("customer" not in flat, '"customer" is not a column any more')
    ctx.check(not res["mutated"], "flatten() leaves the record you gave it unchanged")
    ctx.check(get("deep") == {"a_b_c": 1, "d": "[1, 2]", "e": None, "f": "x"}, "works for other records too (deeper nesting, None, plain values)", f"for a nested record you returned: {get('deep')}")
    ctx.check(get("tc_lesson") == ["total_idr: int -> str"], 'type_changes(flat, changed) returns ["total_idr: int -> str"]', err("tc_lesson") or f"you returned: {get('tc_lesson')}")
    ctx.check(get("tc_same") == [], "type_changes returns an empty list when nothing changed", err("tc_same") or f"you returned: {get('tc_same')}")
    ctx.check(get("tc_two") == ["a: int -> str", "b: str -> float"], "reports every changed field when there are several", err("tc_two") or f"you returned: {get('tc_two')}")
    ctx.check(get("tc_extra") == [] and get("tc_missing") == [], "a field that exists in only one record is not a type change",
              err("tc_extra") or err("tc_missing") or f"you returned: {get('tc_extra')} and {get('tc_missing')}")
    ctx.check(get("tc_value") == [], "a different value of the same type is not a type change", err("tc_value") or f"you returned: {get('tc_value')}")
    ctx.check(get("tc_float") == ["a: int -> float"], "1 and 1.0 are equal but not the same type", err("tc_float") or f"you returned: {get('tc_float')}")


# ------------------------------------------------------------------------------------------------------------ 1.6-6
@exercise("1.6-6", "count a delivery and load it twice without duplicates", ["load_orders.py"], [
    "Count first, load second: rows read, distinct order_id, then the rows in the table. The three numbers must make sense together.",
    "A PRIMARY KEY on order_id plus INSERT OR REPLACE means a repeated order overwrites itself instead of adding a row.",
    "Run the whole load a second time inside the same script, and print the row count again with SELECT count(*): it must not change."])
def ex_1_6_6(ctx):
    if not ctx.need_files(["load_orders.py"]):
        return
    gen = subprocess.run([sys.executable, str(ROOT / "labs" / "shared" / "shopgen.py"), "--out", str(ctx.work / "data")], capture_output=True, text=True)
    if gen.returncode:
        ctx.fail("the checker could generate the KopiKu files", tail(gen.stderr))
        return
    manifest = json.loads((ctx.work / "data" / "manifest.json").read_text(encoding="utf-8"))
    rows, distinct = str(manifest["orders_rows"]), str(manifest["orders_distinct"])
    code, out, err = run_script(ctx, "load_orders.py", 60)
    ctx.check(code == 0, "the script ends without an error", tail(err))
    ctx.check(has_subsequence(ints(out), [rows, distinct]), f"counts the rows read ({rows}) and the distinct order_id values ({distinct})", f"your output: {tail(out)}")
    ctx.check(has_subsequence(ints(out), [rows, distinct, distinct, distinct]), f"prints the table's row count after the first load and again after the second ({distinct} both times)",
              f"your output: {tail(out)}")
    dbs = []
    for f in ctx.work.iterdir():
        try:
            if f.is_file() and f.read_bytes()[:16] == b"SQLite format 3\x00":
                dbs.append(f)
        except OSError:
            pass
    if not dbs:
        ctx.info("no SQLite file was left in the folder (an in-memory database is fine); the table could not be inspected")
        return
    con = sqlite3.connect(str(dbs[0]))
    try:
        tables = [r[0] for r in con.execute("select name from sqlite_master where type = 'table'")]
        found = None
        for t in tables:
            cols = con.execute(f'pragma table_info("{t}")').fetchall()
            if any(c[1] == "order_id" and c[5] for c in cols):
                found = t
        ctx.check(found is not None, "the table has order_id as its primary key", f"tables: {tables}; create the table with order_id ... PRIMARY KEY")
        if found:
            n = con.execute(f'select count(*) from "{found}"').fetchone()[0]
            ctx.check(str(n) == distinct, f"the table holds {distinct} rows, one per order", f"it holds {n}")
    finally:
        con.close()
