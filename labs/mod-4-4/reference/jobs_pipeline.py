"""Capstone 4.4 reference solution (try on your own first!): a daily Airflow pipeline for job postings.

Environment: JOBS_INBOX (folder with jobs_YYYY-MM-DD.jsonl), JOBS_WAREHOUSE (DuckDB file), JOBS_QUARANTINE (folder for rejected lines).
"""
import datetime
import json
import os
import re
from pathlib import Path

import duckdb
from airflow.sdk import dag, task

UTC = datetime.timezone.utc
REQUIRED = ["source", "source_job_id", "title", "company"]
ALIASES = {"postgres": "postgresql", "powerbi": "power bi", "power-bi": "power bi", "py": "python", "gcp": "google cloud", "amazon s3": "s3"}
MAX_REJECT_SHARE = 0.5


def inbox():
    return Path(os.environ["JOBS_INBOX"])


def warehouse():
    return Path(os.environ["JOBS_WAREHOUSE"])


def quarantine():
    return Path(os.environ["JOBS_QUARANTINE"])


def staging(ds):
    p = warehouse().parent / "staging" / ds
    p.mkdir(parents=True, exist_ok=True)
    return p


def collapse(text):
    return re.sub(r"\s+", " ", str(text)).strip().lower()


def parse_salary(text):
    """'Rp 8.000.000 - 12.000.000/Bulan', 'IDR 7,000,000 - 9,000,000 per month', 'Rp 5-10jt', 'Rp 6,5-8,5jt' -> (min, max) in IDR per month."""
    if not text or not isinstance(text, str):
        return None, None
    t = text.lower()
    nums = re.findall(r"\d[\d.,]*", t)
    if not nums:
        return None, None
    if "jt" in t:
        values = [float(n.replace(",", ".")) * 1_000_000 for n in nums]
    else:
        values = [float(re.sub(r"[.,]", "", n)) for n in nums]
    return int(round(min(values))), int(round(max(values)))


def norm_skill(skill):
    s = re.sub(r"\s+", " ", str(skill)).strip().lower()
    return ALIASES.get(s, s)


@dag(dag_id="jobs_pipeline", schedule="@daily", start_date=datetime.datetime(2026, 3, 1, tzinfo=UTC), catchup=False, max_active_runs=1,
     default_args={"retries": 2, "retry_delay": datetime.timedelta(seconds=2)}, tags=["jobs", "capstone"])
def jobs_pipeline():
    @task
    def extract(ds=None):
        path = inbox() / f"jobs_{ds}.jsonl"
        if not path.is_file():
            raise FileNotFoundError(f"delivery for {ds} has not arrived: {path}")
        return str(path)

    @task
    def validate(path, ds=None):
        valid, rejected = [], []
        for raw in Path(path).read_text(encoding="utf-8").splitlines():
            if not raw.strip():
                continue
            try:
                rec = json.loads(raw)
                if not isinstance(rec, dict):
                    raise ValueError
            except ValueError:
                rejected.append({"reason": "invalid_json", "line": raw})
                continue
            if any(not isinstance(rec.get(k), str) or not rec[k].strip() for k in REQUIRED):
                rejected.append({"reason": "missing_field", "line": raw})
                continue
            try:
                datetime.date.fromisoformat(str(rec.get("posted_at")))
            except ValueError:
                rejected.append({"reason": "bad_date", "line": raw})
                continue
            valid.append(rec)
        total = len(valid) + len(rejected)
        if total == 0 or len(rejected) / total > MAX_REJECT_SHARE:
            raise ValueError(f"{ds}: {len(rejected)} of {total} lines rejected: the delivery is refused")
        # quarantine only after the gate has passed, so that a refused delivery leaves nothing behind
        qdir = quarantine()
        qdir.mkdir(parents=True, exist_ok=True)
        (qdir / f"rejected_{ds}.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rejected), encoding="utf-8")
        out = staging(ds) / "valid.json"
        out.write_text(json.dumps(valid), encoding="utf-8")
        return str(out)

    @task
    def transform(valid_path, ds=None):
        jobs = {}
        for rec in json.loads(Path(valid_path).read_text(encoding="utf-8")):
            key = f"{collapse(rec['company'])}|{collapse(rec['title'])}|{collapse(rec.get('location') or '')}"
            if key not in jobs:
                lo, hi = parse_salary(rec.get("salary_text"))
                skills = sorted({norm_skill(s) for s in (rec.get("skills") or []) if str(s).strip()})
                jobs[key] = {"job_key": key, "title": collapse(rec["title"]), "company": collapse(rec["company"]),
                             "location": collapse(rec.get("location") or ""), "salary_min_idr": lo, "salary_max_idr": hi,
                             "skills": skills, "sources": set()}
            jobs[key]["sources"].add(rec["source"])
        rows = []
        for j in jobs.values():
            j["n_sources"] = len(j.pop("sources"))
            rows.append(j)
        out = staging(ds) / "clean.json"
        out.write_text(json.dumps(rows), encoding="utf-8")
        return str(out)

    @task
    def load(clean_path, ds=None):
        rows = json.loads(Path(clean_path).read_text(encoding="utf-8"))
        con = duckdb.connect(str(warehouse()))
        con.execute("""CREATE TABLE IF NOT EXISTS jobs (ds DATE, job_key VARCHAR, title VARCHAR, company VARCHAR, location VARCHAR,
                       salary_min_idr BIGINT, salary_max_idr BIGINT, n_sources INTEGER, PRIMARY KEY (ds, job_key))""")
        con.execute("CREATE TABLE IF NOT EXISTS job_skills (ds DATE, job_key VARCHAR, skill VARCHAR)")
        con.execute("BEGIN")
        try:
            con.execute("DELETE FROM jobs WHERE ds = ?", [ds])
            con.execute("DELETE FROM job_skills WHERE ds = ?", [ds])
            con.executemany("INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                            [(ds, r["job_key"], r["title"], r["company"], r["location"], r["salary_min_idr"], r["salary_max_idr"], r["n_sources"]) for r in rows])
            con.executemany("INSERT INTO job_skills VALUES (?, ?, ?)", [(ds, r["job_key"], s) for r in rows for s in r["skills"]])
            con.execute("COMMIT")
        except Exception:
            con.execute("ROLLBACK")
            raise
        finally:
            con.close()
        return len(rows)

    @task
    def publish_mart(loaded):
        con = duckdb.connect(str(warehouse()))
        con.execute("""CREATE OR REPLACE TABLE mart_skill_demand AS
                       SELECT skill, count(*) AS job_postings, round(100.0 * count(*) / (SELECT count(*) FROM jobs), 1) AS share_pct
                       FROM job_skills GROUP BY skill ORDER BY job_postings DESC, skill""")
        con.close()

    publish_mart(load(transform(validate(extract()))))


jobs_pipeline()
