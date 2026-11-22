#!/usr/bin/env python3
"""Measure what data engineering job postings ask for, from the exported jobs dataset.

    python3 scripts/export_jobs_dataset.py --output data/jobs/fresh     # needs the TalentHub keys in .env
    python3 scripts/job_market_stats.py data/jobs/fresh/raw_jobs.parquet  # prints the table
    python3 scripts/job_market_stats.py data/jobs/fresh/raw_jobs.parquet --js app/js/market-data.js

Every number the course quotes about the job market comes from this script, so it can be re-run and checked.
A posting counts for a skill when its title, description, duties or requirements MENTION one of the patterns below
(case-insensitive, English and Indonesian). A mention is not a strict requirement, and one posting can count for many skills.
Needs DuckDB (pip install duckdb).
"""
import argparse
import json
import sys
from datetime import date

TITLE = r"data engineer|analytics engineer|\betl\b|data warehouse|data platform"

# id -> (English label, Indonesian label, regex, course modules that teach it)
SKILLS = [
    ("sql", "SQL", "SQL", r"\bsql\b", ["mod-0-3", "mod-1-3"]),
    ("python", "Python", "Python", r"\bpython\b", ["mod-0-0", "mod-1-2", "mod-1-5"]),
    ("cloud", "A cloud (AWS, GCP or Azure)", "Cloud (AWS, GCP atau Azure)", r"\baws\b|amazon web services|\bgcp\b|google cloud|azure", ["mod-2-6", "mod-3-4"]),
    ("comms", "Communication or stakeholders", "Komunikasi atau stakeholder", r"communicat|komunikasi|stakeholder|pemangku kepentingan", ["mod-0-2"]),
    ("bi", "BI tools or dashboards", "Tool BI atau dashboard", r"power bi|tableau|looker|metabase|superset|dashboard|\bbi\b", ["mod-2-6"]),
    ("ml", "ML or AI", "ML atau AI", r"machine learning|\bml\b|\bai\b|\bllm|\brag\b|vector|generative", ["mod-3-5"]),
    ("spark", "Spark", "Spark", r"\bspark\b|pyspark", ["mod-3-1"]),
    ("orch", "Airflow, Dagster or another orchestrator", "Airflow, Dagster atau orkestrator lain", r"airflow|dagster|prefect|orchestrat|orkestrasi", ["mod-2-4", "mod-4-4"]),
    ("quality", "Data quality", "Kualitas data", r"data quality|kualitas data|data integrity|integritas data", ["mod-2-5"]),
    ("modeling", "Data modeling", "Pemodelan data", r"data model|dimensional|star schema|kimball|data vault|pemodelan data", ["mod-1-4"]),
    ("warehouse", "Snowflake, BigQuery, Redshift or Databricks", "Snowflake, BigQuery, Redshift atau Databricks", r"snowflake|bigquery|redshift|databricks", ["mod-2-6"]),
    ("streaming", "Kafka or streaming", "Kafka atau streaming", r"kafka|flink|streaming|real[- ]time", ["mod-3-2", "mod-3-3"]),
    ("git", "Git", "Git", r"\bgit\b|github|gitlab|bitbucket", ["mod-0-1"]),
    ("security", "Security", "Keamanan", r"security|keamanan|secure", ["mod-3-4"]),
    ("docker", "Docker or Kubernetes", "Docker atau Kubernetes", r"docker|kubernetes|\bk8s\b|container", ["mod-1-1"]),
    ("monitor", "Monitoring or observability", "Monitoring atau observability", r"monitor|observab|alerting", ["mod-2-5"]),
    ("cicd", "CI/CD", "CI/CD", r"ci/cd|ci cd|continuous integration|continuous delivery|github actions|gitlab ci|jenkins", ["mod-2-3"]),
    ("dbt", "dbt", "dbt", r"\bdbt\b", ["mod-2-3"]),
    ("governance", "Data governance", "Tata kelola data", r"governance|tata kelola", ["mod-2-5"]),
    ("migration", "Migration or legacy systems", "Migrasi atau sistem lama", r"migrat|migrasi|legacy|moderniz|modernis", ["mod-2-6"]),
    ("lakehouse", "Lakehouse, Iceberg or Delta Lake", "Lakehouse, Iceberg atau Delta Lake", r"lakehouse|iceberg|delta lake|\bhudi\b", ["mod-2-2"]),
    ("java", "Java or Scala", "Java atau Scala", r"\bjava\b|\bscala\b", []),
    ("privacy", "Privacy or personal data (GDPR, PII, UU PDP)", "Privasi atau data pribadi (GDPR, PII, UU PDP)", r"privacy|privasi|gdpr|\bpii\b|\bpdp\b|personal data|data pribadi", ["mod-2-5"]),
    ("cost", "Cost or FinOps", "Biaya atau FinOps", r"cost[- ]optim|cost[- ]effective|cost efficien|finops|optimi[sz]e cost|biaya", ["mod-2-6", "mod-3-4"]),
    ("terraform", "Terraform or infrastructure as code", "Terraform atau infrastructure as code", r"terraform|infrastructure as code|\biac\b|cloudformation|pulumi", ["mod-3-4"]),
    ("lineage", "Lineage or data catalog", "Lineage atau katalog data", r"lineage|data catalog|katalog data|metadata management", ["mod-2-5"]),
    ("semantic", "Semantic or metrics layer", "Semantic layer atau metrics layer", r"semantic layer|metrics layer|metricflow|lookml", ["mod-2-6"]),
    ("mdm", "Master data management", "Master data management", r"master data|\bmdm\b", ["mod-2-5"]),
    ("vault", "Data Vault", "Data Vault", r"data vault", ["mod-1-4"]),
    ("reverse_etl", "Reverse ETL", "Reverse ETL", r"reverse[- ]etl|hightouch", ["mod-2-6"]),
]


def measure(parquet):
    import duckdb
    con = duckdb.connect()
    con.execute(f"""
        CREATE TABLE de AS
        SELECT platform,
               lower(coalesce(job_title, '') || ' ' || coalesce(description, '') || ' ' ||
                     coalesce(array_to_string(job_desk, ' '), '') || ' ' || coalesce(array_to_string(requirements, ' '), '')) AS t,
               created_at
        FROM read_parquet(?)
        WHERE regexp_matches(lower(job_title), '{TITLE}')""", [parquet])
    n = con.execute("SELECT count(*) FROM de").fetchone()[0]
    total = con.execute("SELECT count(*) FROM read_parquet(?)", [parquet]).fetchone()[0]
    first, last = con.execute("SELECT min(created_at)[:10], max(created_at)[:10] FROM de").fetchone()
    platforms = con.execute("""
        SELECT CASE WHEN platform LIKE 'LinkedIn%' THEN 'LinkedIn' ELSE platform END AS p, count(*)
        FROM de GROUP BY 1 ORDER BY 2 DESC, 1""").fetchall()
    skills = []
    for sid, en, idn, rx, mods in SKILLS:
        c = con.execute("SELECT count(*) FROM de WHERE regexp_matches(t, ?)", [rx]).fetchone()[0]
        skills.append({"id": sid, "en": en, "id_label": idn, "count": c, "pct": round(100 * c / n, 1), "modules": mods, "pattern": rx})
    skills.sort(key=lambda s: -s["count"])
    return {"measured": date.today().isoformat(), "postings": n, "all_postings": total, "first": first, "last": last,
            "title_pattern": TITLE, "platforms": platforms, "skills": skills}


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("parquet")
    ap.add_argument("--js", help="also write the numbers as a JavaScript file for the app")
    a = ap.parse_args(argv)
    try:
        r = measure(a.parquet)
    except ImportError:
        print("DuckDB is needed: pip install duckdb")
        return 1
    print(f"{r['postings']} data engineering postings (titles matching {TITLE!r}) out of {r['all_postings']}, posted {r['first']} to {r['last']}")
    print("platforms:", ", ".join(f"{p} {c}" for p, c in r["platforms"]))
    for s in r["skills"]:
        print(f"  {s['pct']:5.1f}%  {s['count']:5}  {s['en']}")
    if a.js:
        with open(a.js, "w", encoding="utf-8") as f:
            f.write("// GENERATED by scripts/job_market_stats.py from the exported jobs dataset. Do not edit by hand.\n")
            f.write("window.MARKET_DATA = " + json.dumps(r, ensure_ascii=False, indent=1) + ";\n")
        print("wrote", a.js)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
