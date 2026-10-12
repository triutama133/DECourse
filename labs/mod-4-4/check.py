#!/usr/bin/env python3
"""Checks your work in Capstone 4.4 (a daily Apache Airflow pipeline for job postings), one step at a time.

    python3 labs/mod-4-4/check.py ~/airflow-lab --step 1          # your profile.json
    python3 labs/mod-4-4/check.py ~/airflow-lab --step 2          # the DAG file: structure and settings
    python3 labs/mod-4-4/check.py ~/airflow-lab --step 3          # one day through the whole DAG
    python3 labs/mod-4-4/check.py ~/airflow-lab --step 4          # reruns, other days, out-of-order backfill
    python3 labs/mod-4-4/check.py ~/airflow-lab --step 5          # a late file, a broken delivery
    python3 labs/mod-4-4/check.py ~/airflow-lab --step all        # everything (this is what the proof code runs)
    python3 labs/mod-4-4/check.py ~/airflow-lab --step 3 --hint 1 # a hint (levels 1, 2, 3: the higher, the closer to the answer)

~/airflow-lab is YOUR workspace folder: it holds jobs_pipeline.py (your DAG) and profile.json. The checker never edits them. It copies your DAG
file(s) into a private folder, creates its own Airflow home there, runs your DAG with `dag.test()` on deliveries it prepares (some broken on
purpose) and compares the results with answers it computes independently. Needs Airflow (see requirements.txt) and DuckDB.
"""
import argparse
import datetime
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
INBOX_SRC = HERE / "data" / "inbox"
DAG_ID = "jobs_pipeline"
TASKS = ["extract", "validate", "transform", "load", "publish_mart"]
REQUIRED = ["source", "source_job_id", "title", "company"]
ALIASES = {"postgres": "postgresql", "powerbi": "power bi", "power-bi": "power bi", "py": "python", "gcp": "google cloud", "amazon s3": "s3"}
GOOD_DAYS = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"]
BAD_DAY, LATE_DAY, LAST_DAY = "2026-03-05", "2026-03-06", "2026-03-07"
RUN_TIMEOUT = 420

HINTS = {
    1: ["Read the seven files with Python (json, collections). A line is one JSON object; count first, then look at the odd ones by eye.",
        "Each key is one pass over all lines: split them into invalid JSON, valid JSON with an empty or missing required field, valid JSON with an unparsable posted_at. The 'worst day' is the delivery with the highest share of unusable lines.",
        "json.loads raises ValueError on a broken line. Required fields are source, source_job_id, title and company: they must be non-empty strings after strip(). posted_at must be an ISO date: datetime.date.fromisoformat. Collections.Counter finds the busiest source."],
    2: ["Airflow 3 imports the decorators from airflow.sdk. A DAG file is an ordinary Python file that Airflow imports again and again, so keep the top level light and free of side effects.",
        "Look at the options of the @dag decorator: dag_id, schedule, start_date (fixed, timezone-aware, in the past), catchup, max_active_runs and default_args. Retries and retry_delay can sit in default_args.",
        "Five @task functions called in a chain, extract(), validate(path), transform(...), load(...), publish_mart(...), give you the task ids and the order for free: the function names become the task ids. Return small values (a path, a count), never the data itself."],
    3: ["Use the logical date of the run, not today's date. Tasks can receive it by naming a parameter ds (a 'YYYY-MM-DD' text) in the function signature.",
        "Decide what each task owns: extract finds the day's file, validate splits valid and rejected lines, transform normalises and de-duplicates, load writes the warehouse, publish_mart rebuilds the mart. Staging files named after the date can pass data between tasks.",
        "For load, write the day's rows inside one DuckDB transaction: delete the rows of this ds first, then insert, then commit. For salaries: numbers with 'jt' are millions with a decimal comma; otherwise dots or commas are thousand separators."],
    4: ["Everything a task writes must be a function of its date. Think about what happens when the same date runs twice, or when 4 March runs before 3 March.",
        "Replace, never append: delete the rows of the date you are loading and insert them again in the same transaction. Rebuild the mart from the tables each time instead of adding to it.",
        "publish_mart can be CREATE OR REPLACE TABLE ... AS SELECT over job_skills. The share is a percentage of the rows in jobs, rounded to one decimal."],
    5: ["Two things go wrong in real life: a file arrives late, and a file arrives broken. The first must heal itself with a retry; the second must stop the run without touching good data.",
        "A missing file should raise an exception (do not return an empty result). Airflow retries the task after retry_delay. For a broken delivery, count the rejected share before you write anything and raise if it is above 50%.",
        "A task that raises ends the run as failed and its downstream tasks do not run, so the warehouse and the mart keep yesterday's content. Write the quarantine file only after the gate passed."],
}

# ---------------------------------------------------------------------------------------------------------------- reporting
passed = failed = 0


def check(name, ok, hint=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"PASS  {name}")
    else:
        failed += 1
        print(f"FAIL  {name}" + (f"\n      hint: {hint}" if hint else ""))
    return ok


# ---------------------------------------------------------------------------------------------------------------- truth, computed from the raw files
def collapse(text):
    return re.sub(r"\s+", " ", str(text)).strip().lower()


def salary(text):
    if not text or not isinstance(text, str):
        return None, None
    t = text.lower()
    nums = re.findall(r"\d[\d.,]*", t)
    if not nums:
        return None, None
    vals = [float(n.replace(",", ".")) * 1_000_000 for n in nums] if "jt" in t else [float(re.sub(r"[.,]", "", n)) for n in nums]
    return int(round(min(vals))), int(round(max(vals)))


def classify(raw):
    """-> (reason or None, record or None)"""
    try:
        rec = json.loads(raw)
        if not isinstance(rec, dict):
            raise ValueError
    except ValueError:
        return "invalid_json", None
    if any(not isinstance(rec.get(k), str) or not rec[k].strip() for k in REQUIRED):
        return "missing_field", rec
    try:
        datetime.date.fromisoformat(str(rec.get("posted_at")))
    except ValueError:
        return "bad_date", rec
    return None, rec


def day_truth(path):
    rejected, jobs = Counter(), {}
    total = 0
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        total += 1
        reason, rec = classify(raw)
        if reason:
            rejected[reason] += 1
            continue
        key = f"{collapse(rec['company'])}|{collapse(rec['title'])}|{collapse(rec.get('location') or '')}"
        if key not in jobs:
            lo, hi = salary(rec.get("salary_text"))
            skills = sorted({re.sub(r"\s+", " ", str(s)).strip().lower() for s in (rec.get("skills") or []) if str(s).strip()})
            skills = sorted({ALIASES.get(s, s) for s in skills})
            jobs[key] = {"title": collapse(rec["title"]), "company": collapse(rec["company"]), "location": collapse(rec.get("location") or ""),
                         "lo": lo, "hi": hi, "skills": skills, "sources": set()}
        jobs[key]["sources"].add(rec["source"])
    return {"total": total, "rejected": dict(rejected), "jobs": jobs}


_cache = {}


def truth(ds):
    if ds not in _cache:
        _cache[ds] = day_truth(INBOX_SRC / f"jobs_{ds}.jsonl")
    return _cache[ds]


def profile_truth():
    files = sorted(INBOX_SRC.glob("jobs_*.jsonl"))
    lines = invalid = missing = bad_date = with_salary = 0
    sources = Counter()
    share = {}
    for f in files:
        n = bad = 0
        for raw in f.read_text(encoding="utf-8").splitlines():
            if not raw.strip():
                continue
            n += 1
            lines += 1
            reason, rec = classify(raw)
            if reason == "invalid_json":
                invalid += 1
            elif reason == "missing_field":
                missing += 1
            elif reason == "bad_date":
                bad_date += 1
            if reason:
                bad += 1
            if rec is not None:
                sources[rec.get("source")] += 1
                if isinstance(rec.get("salary_text"), str) and rec["salary_text"].strip():
                    with_salary += 1
        share[f.stem.replace("jobs_", "")] = bad / n
    return {"files": len(files), "lines_total": lines, "invalid_json_lines": invalid, "lines_missing_required": missing, "lines_bad_date": bad_date,
            "distinct_sources": len([s for s in sources if s]), "busiest_source": sources.most_common(1)[0][0], "lines_with_salary": with_salary,
            "worst_day": max(share, key=share.get)}


# ---------------------------------------------------------------------------------------------------------------- running Airflow
RUNNER = r'''
import datetime, json, sys, time, warnings
warnings.filterwarnings("ignore")
from airflow.models.dagbag import DagBag
UTC = datetime.timezone.utc
_t0 = time.time()
bag = DagBag(dag_folder=sys.argv[2], include_examples=False)
_parse = time.time() - _t0
mode = sys.argv[1]
if mode == "inspect":
    out = {"import_errors": {k: v[-600:] for k, v in bag.import_errors.items()}, "dag": None, "parse_seconds": _parse}
    dag = bag.get_dag("jobs_pipeline") if "jobs_pipeline" in bag.dags else None
    if dag is not None:
        tl = dag.timetable
        out["dag"] = {
            "schedule": str(getattr(tl, "summary", tl)), "catchup": bool(dag.catchup), "max_active_runs": dag.max_active_runs,
            "start_date": dag.start_date.isoformat() if dag.start_date else None,
            "tasks": {t.task_id: {"retries": t.retries, "retry_delay": t.retry_delay.total_seconds() if t.retry_delay else 0,
                                  "upstream": sorted(t.upstream_task_ids)} for t in dag.tasks},
        }
    print("INSPECT " + json.dumps(out))
else:
    dag = bag.get_dag("jobs_pipeline")
    for day in sys.argv[3:]:
        dt = datetime.datetime.fromisoformat(day).replace(tzinfo=UTC)
        try:
            run = dag.test(logical_date=dt)
            print("RESULT " + json.dumps({"day": day, "state": str(run.state) if run else None}), flush=True)
        except Exception as e:
            print("RESULT " + json.dumps({"day": day, "state": "exception", "error": type(e).__name__ + ": " + str(e)[:200]}), flush=True)
'''


class Lab:
    def __init__(self, ws):
        self.ws = ws
        self.root = ws / ".check"
        self.dags = self.root / "dags"
        self.home = self.root / "airflow"
        self.inbox = self.root / "inbox"
        self.held = self.root / "held"
        self.warehouse = self.root / "warehouse" / "jobs.duckdb"
        self.quarantine = self.root / "quarantine"
        self.env = {**os.environ, "AIRFLOW_HOME": str(self.home), "AIRFLOW__CORE__LOAD_EXAMPLES": "False", "AIRFLOW__CORE__DAGS_FOLDER": str(self.dags),
                    "AIRFLOW__LOGGING__LOGGING_LEVEL": "ERROR", "AIRFLOW__DAG_PROCESSOR__DAG_FILE_PROCESSOR_TIMEOUT": "60",
                    "JOBS_INBOX": str(self.inbox), "JOBS_WAREHOUSE": str(self.warehouse), "JOBS_QUARANTINE": str(self.quarantine),
                    "PYTHONWARNINGS": "ignore", "NO_COLOR": "1"}
        self.ready = False

    def prepare(self):
        if self.root.exists():
            shutil.rmtree(self.root)
        for d in (self.dags, self.home, self.inbox, self.held, self.warehouse.parent):
            d.mkdir(parents=True, exist_ok=True)
        for f in self.ws.glob("*.py"):
            shutil.copy(f, self.dags / f.name)
        for f in INBOX_SRC.glob("jobs_*.jsonl"):
            shutil.copy(f, self.inbox / f.name)
        (self.root / "runner.py").write_text(RUNNER, encoding="utf-8")
        p = subprocess.run([sys.executable, "-m", "airflow", "db", "migrate"], env=self.env, capture_output=True, text=True, timeout=300)
        self.ready = p.returncode == 0
        return p

    def run(self, mode, *days, timeout=RUN_TIMEOUT):
        t0 = time.time()
        try:
            p = subprocess.run([sys.executable, str(self.root / "runner.py"), mode, str(self.dags), *days], env=self.env, cwd=str(self.root),
                               capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return {"code": 124, "out": "", "err": f"timed out after {timeout} s", "secs": timeout, "results": [], "inspect": None}
        tag = lambda t: [json.loads(l[len(t) + 1:]) for l in p.stdout.splitlines() if l.startswith(t + " ")]
        return {"code": p.returncode, "out": p.stdout, "err": p.stderr, "secs": time.time() - t0, "results": tag("RESULT"),
                "inspect": (tag("INSPECT") or [None])[0]}

    def task_states(self, day):
        """{task_id: (state, try_number)} of the (last) run with this logical date, read from the private Airflow metadata database."""
        try:
            con = sqlite3.connect(str(self.home / "airflow.db"))
            rows = con.execute("""SELECT ti.task_id, ti.state, ti.try_number FROM task_instance ti JOIN dag_run dr ON dr.run_id = ti.run_id AND dr.dag_id = ti.dag_id
                                  WHERE dr.dag_id = ? AND date(dr.logical_date) = ?""", (DAG_ID, day)).fetchall()
            con.close()
            return {t: (s, n) for t, s, n in rows}
        except Exception:
            return {}


def warehouse_rows(lab, ds=None):
    import duckdb
    if not lab.warehouse.is_file():
        return None
    con = duckdb.connect(str(lab.warehouse), read_only=True)
    try:
        where = f" WHERE ds = DATE '{ds}'" if ds else ""
        cols = "" if ds else "CAST(ds AS VARCHAR), "
        order = "job_key" if ds else "ds, job_key"
        jobs = con.execute(f"SELECT {cols}job_key, title, company, location, salary_min_idr, salary_max_idr, n_sources FROM jobs{where} ORDER BY {order}").fetchall()
        skills = con.execute(f"SELECT {cols}job_key, skill FROM job_skills{where} ORDER BY {order}, skill").fetchall()
        return jobs, skills
    except Exception:
        return None
    finally:
        con.close()


def expected_rows(ds):
    t = truth(ds)
    jobs = sorted((k, j["title"], j["company"], j["location"], j["lo"], j["hi"], len(j["sources"])) for k, j in t["jobs"].items())
    skills = sorted((k, s) for k, j in t["jobs"].items() for s in j["skills"])
    return jobs, skills


def mart_rows(lab):
    import duckdb
    if not lab.warehouse.is_file():
        return None
    con = duckdb.connect(str(lab.warehouse), read_only=True)
    try:
        return con.execute("SELECT skill, job_postings, share_pct FROM mart_skill_demand ORDER BY skill").fetchall()
    except Exception:
        return None
    finally:
        con.close()


def expected_mart(days):
    c, n = Counter(), 0
    for ds in days:
        for j in truth(ds)["jobs"].values():
            n += 1
            for s in j["skills"]:
                c[s] += 1
    return sorted((s, v, round(100.0 * v / n, 1)) for s, v in c.items())


def mart_ok(got, want):
    if got is None or len(got) != len(want):
        return False
    return all(g[0] == w[0] and g[1] == w[1] and abs(float(g[2]) - w[2]) <= 0.11 for g, w in zip(got, want))


def fingerprint(lab):
    rows = warehouse_rows(lab)
    return (rows, mart_rows(lab)) if rows else None


def quarantine_counts(lab, ds):
    f = lab.quarantine / f"rejected_{ds}.jsonl"
    if not f.is_file():
        return None
    return dict(Counter(json.loads(l)["reason"] for l in f.read_text(encoding="utf-8").splitlines() if l.strip()))


def short(text, n=500):
    t = " | ".join(l.strip() for l in (text or "").strip().splitlines() if l.strip())
    return t[-n:]


# ---------------------------------------------------------------------------------------------------------------- steps
def step1(ws):
    print("\n== Step 1: profile the seven deliveries (profile.json)")
    f = ws / "profile.json"
    if not check("profile.json exists in your workspace", f.is_file(), f"create {f} with the nine keys from the lab steps"):
        return
    try:
        got = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        check("profile.json is valid JSON", False, str(e))
        return
    for key, want in profile_truth().items():   # the expected values are deliberately not printed
        ok = key in got and got[key] == want and not isinstance(got[key], bool)
        check(f"profile.json: {key}", ok, "missing" if key not in got else "your value does not match the data; re-check how you count (see the key's definition in the lab steps)")


def prepare(lab, ctx):
    if "prepared" in ctx:
        return ctx["prepared"]
    if not any(lab.ws.glob("*.py")):
        check("your workspace contains jobs_pipeline.py", False, f"create {lab.ws / 'jobs_pipeline.py'} (start from labs/mod-4-4/starter/jobs_pipeline.py)")
        ctx["prepared"] = False
        return False
    import importlib.util
    if importlib.util.find_spec("airflow") is None:
        check("Apache Airflow is installed in this Python", False, "activate your virtual environment and follow the install line in labs/mod-4-4/requirements.txt")
        ctx["prepared"] = False
        return False
    p = lab.prepare()
    ok = check("a private Airflow home was created for the checks", lab.ready, short(p.stderr or p.stdout))
    ctx["prepared"] = ok
    return ok


def step2(ws, lab, ctx):
    print("\n== Step 2: the DAG file (structure and settings)")
    if not prepare(lab, ctx):
        return
    if "inspect" not in ctx:
        ctx["inspect"] = lab.run("inspect")
    r = ctx["inspect"]
    info = r["inspect"]
    if not check("Airflow can import your DAG file without errors", bool(info) and not info["import_errors"],
                 short(json.dumps(info["import_errors"]) if info else r["err"] or r["out"])):
        return
    d = info["dag"]
    if not check(f"a DAG with dag_id '{DAG_ID}' exists", d is not None, f"found no DAG called {DAG_ID}"):
        return
    check("it runs once a day (schedule '@daily' or an equivalent)", d["schedule"] in ("@daily", "0 0 * * *", "1 day, 0:00:00", "1 day"), f"your schedule is shown as {d['schedule']!r}")
    check("catchup is off", d["catchup"] is False, "a new DAG should not create a run for every past day by itself")
    check("max_active_runs is 1", d["max_active_runs"] == 1, "two runs of the same pipeline writing at the same time are asking for trouble")
    start = d["start_date"] and datetime.datetime.fromisoformat(d["start_date"])
    check("start_date is fixed, timezone-aware and no later than 2026-03-01", bool(start) and start.tzinfo is not None and start <= datetime.datetime(2026, 3, 1, tzinfo=datetime.timezone.utc),
          f"start_date is {d['start_date']}; never use now(): the date must not change every time the file is parsed")
    tasks = d["tasks"]
    check("the five tasks exist: extract, validate, transform, load, publish_mart", all(t in tasks for t in TASKS), f"your tasks: {sorted(tasks)}")
    chain = all(t in tasks and tasks[t]["upstream"] == ([TASKS[i - 1]] if i else []) for i, t in enumerate(TASKS))
    check("they run in a chain: extract, validate, transform, load, publish_mart", chain, "each task depends on exactly the one before it: " + ", ".join(f"{t} <- {tasks.get(t, {}).get('upstream')}" for t in TASKS))
    check("every task retries at least twice", all(tasks[t]["retries"] >= 2 for t in TASKS if t in tasks), "set retries in default_args")
    check("retry_delay is set and at most 5 seconds (in production it would be minutes; here the checker has to wait for it)",
          all(0 < tasks[t]["retry_delay"] <= 5 for t in TASKS if t in tasks), f"retry_delay values: {[tasks[t]['retry_delay'] for t in TASKS if t in tasks]}")
    check("importing the DAG file is quick (under 5 seconds): the top level is light", info["parse_seconds"] < 5, f"parsing took {info['parse_seconds']:.1f} s: no connections, file reads or network calls at the top of a DAG file")


def run_days(lab, ctx, name, days, **kw):
    r = lab.run("run", *days, **kw)
    ctx[name] = r
    return r


def step3(ws, lab, ctx):
    print("\n== Step 3: one day through the whole DAG")
    if not prepare(lab, ctx):
        return
    ds = "2026-03-02"
    r = run_days(lab, ctx, "one", [ds])
    states = r["results"][0]["state"] if r["results"] else None
    if not check(f"the DAG run for {ds} ends in state success ({r['secs']:.0f} s)", states == "success",
                 f"state: {states}. {r['results'][0].get('error', '') if r['results'] else ''} {short(r['err'] or r['out'], 400)}"):
        return
    ti = lab.task_states(ds)
    check("all five tasks succeeded", all(ti.get(t, (None,))[0] == "success" for t in TASKS), f"task states: {ti}")
    got, want = warehouse_rows(lab, ds), expected_rows(ds)
    if not check("the warehouse file has the tables jobs and job_skills", got is not None, "create jobs(ds, job_key, ...) and job_skills(ds, job_key, skill) in $JOBS_WAREHOUSE"):
        return
    check(f"jobs: exactly the {len(want[0])} expected rows (one per job after removing rejects and duplicates across sites)", got[0] == want[0],
          f"you have {len(got[0])} rows; the expected set differs in {len(set(got[0]) ^ set(want[0]))} rows (title/company/location keys, salary or n_sources)")
    check("job_skills: the expected normalised skills, one row per job and skill", got[1] == want[1],
          f"you have {len(got[1])} rows, expected {len(want[1])}. Lower-case, trim, apply the alias table, and do not repeat a skill within a job")
    q = quarantine_counts(lab, ds)
    check("the rejected lines of the day are in quarantine/rejected_<ds>.jsonl with the right reasons", q == (truth(ds)["rejected"] or {}) or (q in ({}, None) and not truth(ds)["rejected"]),
          f"yours: {q}; expected {truth(ds)['rejected']}")
    m = mart_rows(lab)
    check("mart_skill_demand has the right skills, counts and shares", mart_ok(m, expected_mart([ds])), "rebuild it from job_skills; share_pct = 100 * postings / rows in jobs, 1 decimal")


def step4(ws, lab, ctx):
    print("\n== Step 4: reruns, other days, out-of-order backfill")
    if not prepare(lab, ctx):
        return
    order = ["2026-03-02", "2026-03-01", "2026-03-04", "2026-03-03", "2026-03-02", "2026-03-04"]
    r = run_days(lab, ctx, "many", order)
    states = [x["state"] for x in r["results"]]
    if not check(f"six runs (a rerun of 2 March and 4 March included, started out of order) all succeed ({r['secs']:.0f} s)", states == ["success"] * 6, f"states: {states}"):
        return
    ok_days = True
    for ds in GOOD_DAYS:
        got, want = warehouse_rows(lab, ds), expected_rows(ds)
        ok_days &= got is not None and got[0] == want[0] and got[1] == want[1]
    check("each of the four days holds exactly its expected rows: no duplicates, no gaps, nothing from another day", ok_days, "a rerun must REPLACE the rows of its date (delete, then insert)")
    all_rows = warehouse_rows(lab)
    want_n = sum(len(truth(d)["jobs"]) for d in GOOD_DAYS)
    check("the total number of rows equals the sum over the four days", all_rows is not None and len(all_rows[0]) == want_n, f"{len(all_rows[0]) if all_rows else None} rows, expected {want_n}")
    check("mart_skill_demand covers all four days", mart_ok(mart_rows(lab), expected_mart(GOOD_DAYS)), "rebuild the whole mart from job_skills after every load")
    before = fingerprint(lab)
    run_days(lab, ctx, "again", ["2026-03-03"])
    check("running 3 March once more changes nothing (idempotent)", fingerprint(lab) == before, "same date, same input: the warehouse must be exactly the same afterwards")


class LateFile(threading.Thread):
    """Releases a held delivery as soon as the first attempt of the extract task has failed (state up_for_retry), so the first attempt really finds no file."""

    def __init__(self, lab, name):
        super().__init__(daemon=True)
        self.lab, self.name, self.released = lab, name, False
        self.stop_flag = False

    def run(self):
        deadline = time.time() + RUN_TIMEOUT
        db = self.lab.home / "airflow.db"
        while not self.stop_flag and time.time() < deadline:
            try:
                con = sqlite3.connect(str(db), timeout=0.3)
                rows = con.execute("""SELECT ti.state FROM task_instance ti JOIN dag_run dr ON dr.run_id = ti.run_id AND dr.dag_id = ti.dag_id
                                      WHERE dr.dag_id = ? AND date(dr.logical_date) = ? AND ti.task_id = 'extract'""", (DAG_ID, LATE_DAY)).fetchall()
                con.close()
                if any(r[0] == "up_for_retry" for r in rows):
                    shutil.move(str(self.lab.held / self.name), str(self.lab.inbox / self.name))
                    self.released = True
                    return
            except Exception:
                pass
            time.sleep(0.05)


def step5(ws, lab, ctx):
    print("\n== Step 5: a late file and a broken delivery")
    if not prepare(lab, ctx):
        return
    name = f"jobs_{LATE_DAY}.jsonl"
    shutil.move(str(lab.inbox / name), str(lab.held / name))
    watcher = LateFile(lab, name)
    watcher.start()
    r = run_days(lab, ctx, "late", [LATE_DAY])
    watcher.stop_flag = True
    watcher.join(timeout=2)
    state = r["results"][0]["state"] if r["results"] else None
    check(f"a delivery that arrives a few seconds late is picked up by a retry ({r['secs']:.0f} s)", state == "success" and watcher.released,
          f"state {state}, file released: {watcher.released}. A missing file must make the task FAIL (raise), so that Airflow retries it")
    ti = lab.task_states(LATE_DAY)
    check("... the extract task needed more than one attempt", ti.get("extract", (None, 0))[1] >= 2, f"extract attempts: {ti.get('extract')}")
    if state == "success":
        got, want = warehouse_rows(lab, LATE_DAY), expected_rows(LATE_DAY)
        check("... and the data of that day is complete and correct", got is not None and got[0] == want[0] and got[1] == want[1], "")

    before = fingerprint(lab)
    r = run_days(lab, ctx, "bad", [BAD_DAY])
    state = r["results"][0]["state"] if r["results"] else None
    check(f"the broken delivery of 5 March (about 60% unusable lines) ends the run as failed ({r['secs']:.0f} s)", state == "failed", f"state: {state}. Refuse a delivery whose rejected share is above 50%")
    ti = lab.task_states(BAD_DAY)
    check("... it fails in validate, and transform, load and publish_mart do not run", ti.get("validate", (None,))[0] == "failed" and all(ti.get(t, (None,))[0] not in ("success", "running") for t in ("transform", "load", "publish_mart")),
          f"task states: {ti}")
    after = fingerprint(lab)
    check("... and the good data of the other days and the mart are exactly as before", after == before, "a refused delivery must not change anything")
    got = warehouse_rows(lab, BAD_DAY)
    check("... nothing of 5 March reached the warehouse", got is not None and not got[0] and not got[1], "")

    r = run_days(lab, ctx, "last", [LAST_DAY])
    state = r["results"][0]["state"] if r["results"] else None
    check("after the failure, the next day (7 March) runs normally", state == "success", f"state: {state}")
    if state == "success":
        days = GOOD_DAYS + [LATE_DAY, LAST_DAY]
        check("... and the mart now covers 1 to 4 and 6 to 7 March (the refused day is absent)", mart_ok(mart_rows(lab), expected_mart(days)), "")


STEPS = {1: step1, 2: step2, 3: step3, 4: step4, 5: step5}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workspace")
    ap.add_argument("--step", default="all", help="1, 2, 3, 4, 5 or all")
    ap.add_argument("--hint", type=int, choices=[1, 2, 3], help="print a hint of this level for the chosen step instead of checking")
    ap.add_argument("--keep", action="store_true", help="keep the .check folder (Airflow home, logs, warehouse) to look at it")
    a = ap.parse_args()
    steps = sorted(STEPS) if a.step == "all" else [int(a.step)] if a.step.isdigit() and int(a.step) in STEPS else None
    if steps is None:
        print("--step must be 1, 2, 3, 4, 5 or all")
        return 2
    if a.hint:
        for s in steps:
            print(f"Hint {a.hint} for step {s}: {HINTS[s][a.hint - 1]}\n")
        return 0
    ws = Path(a.workspace).expanduser().resolve()
    if not ws.is_dir():
        print(f"Workspace {ws} does not exist. Create the folder and put jobs_pipeline.py (and profile.json) in it.")
        return 1
    if not list(INBOX_SRC.glob("jobs_*.jsonl")):
        print("The data is missing. Run:  python3 labs/mod-4-4/fetch_data.py")
        return 1
    try:
        import duckdb  # noqa: F401
    except ImportError:
        print("duckdb is not installed in this Python. Activate your virtual environment and run:  pip install duckdb")
        return 1
    lab, ctx, t0 = Lab(ws), {}, time.time()
    try:
        for s in steps:
            STEPS[s](ws) if s == 1 else STEPS[s](ws, lab, ctx)
    finally:
        if not a.keep:
            shutil.rmtree(lab.root, ignore_errors=True)
    print(f"\n{passed} passed, {failed} failed ({time.time() - t0:.0f} s)")
    if failed:
        print("Not yet. Fix the first FAIL, run this step again, and use --hint 1 (then 2, 3) if you are stuck.")
        return 1
    print("ALL CHECKS PASSED" + ("" if a.step == "all" else f" for step {a.step}"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
