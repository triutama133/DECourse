#!/usr/bin/env python3
"""Generate (and verify) the seven daily deliveries of Capstone 4.4 in labs/mod-4-4/data/inbox/.

    python3 labs/mod-4-4/fetch_data.py

The data is SYNTHETIC: a generator with a fixed random seed imitates job postings collected from several job sites (the same job on several
sites, salary written in many ways, skills spelled in many ways, and broken lines). Nothing here is scraped from a real site. A SHA-256 of all
files is checked so that every learner and the automated tests work on identical bytes. Standard library only.
"""
import hashlib
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data" / "inbox"
EXPECTED_SHA256 = "9077a47d1e44a3a1fe5764dda6c421c3f934919064f8e643298c0005e65f5f5d"
FIRST_DAY = date(2026, 3, 1)
DAYS = 7
BAD_DAY = date(2026, 3, 5)   # most of this delivery is broken: the pipeline must refuse it

SOURCES = ["glints", "jobstreet", "kalibrr", "linkedin"]
TITLES = ["Data Engineer", "Data Analyst", "Backend Engineer", "Frontend Developer", "Sales Executive", "Marketing Manager", "Accountant",
          "HR Specialist", "Graphic Designer", "Project Manager", "Business Analyst", "DevOps Engineer", "Customer Support", "Product Manager",
          "Data Scientist", "QA Engineer", "Content Writer", "Operations Staff"]
COMPANIES = ["PT Maju Jaya", "Nusantara Digital", "Kopi Kita", "Garuda Data", "Bumi Teknologi", "Sinar Mas Retail", "Cakra Finansial", "Lintas Logistik",
             "Mitra Cloud", "Samudra Media", "Rajawali Energi", "Citra Health", "Delta Commerce", "Pelita Edukasi", "Teras Analytics", "Arunika Studio"]
LOCATIONS = ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Medan", "Remote"]
SKILLS = ["SQL", "Python", "Excel", "Power BI", "Tableau", "Airflow", "Spark", "Kafka", "AWS", "Google Cloud", "Docker", "Git", "PostgreSQL", "dbt",
          "Linux", "Java", "JavaScript", "Communication", "Leadership", "Accounting"]
SKILL_VARIANTS = {"Power BI": ["Power BI", "powerbi", "Power-BI", "POWER BI"], "PostgreSQL": ["PostgreSQL", "postgres", "Postgres", "POSTGRESQL"],
                  "Python": ["Python", "python", "py", "PYTHON"], "Google Cloud": ["Google Cloud", "GCP", "gcp", "google cloud"],
                  "SQL": ["SQL", "sql", "Sql"], "AWS": ["AWS", "aws", "Amazon S3"]}


def salary_text(rng, low, high):
    kind = rng.choice(["A", "B", "C", "D", "E", "none", "none", "words"])
    if kind == "A":
        return f"Rp {low:,}".replace(",", ".") + " - " + f"{high:,}".replace(",", ".") + "/Bulan"
    if kind == "B":
        return f"IDR {low:,} - {high:,} per month"
    if kind == "C":
        return f"Rp {low // 1_000_000}-{high // 1_000_000}jt"
    if kind == "D":
        return f"Rp {low / 1_000_000:.1f}".replace(".", ",") + f"-{high / 1_000_000:.1f}".replace(".", ",") + "jt"
    if kind == "E":
        return f"Rp {low:,}".replace(",", ".") + "/Bulan"
    if kind == "words":
        return rng.choice(["Negotiable", "Kompetitif", ""])
    return None


def generate():
    rng = random.Random(20260301)
    out = {}
    pool = []   # jobs that may be reposted on later days
    counter = 0
    for d in range(DAYS):
        day = FIRST_DAY + timedelta(days=d)
        jobs = []
        for _ in range(rng.randint(90, 110)):
            if pool and rng.random() < 0.18:
                jobs.append(dict(rng.choice(pool)))
            else:
                low = rng.choice([5, 6, 7, 8, 9, 10, 12, 15]) * 1_000_000
                high = low + rng.choice([1, 2, 3, 4]) * 1_000_000
                jobs.append({"title": rng.choice(TITLES), "company": rng.choice(COMPANIES), "location": rng.choice(LOCATIONS),
                             "salary": salary_text(rng, low, high), "skills": rng.sample(SKILLS, rng.randint(2, 6))})
        pool.extend(jobs[:20])
        lines = []
        for job in jobs:
            for source in rng.sample(SOURCES, rng.choice([1, 1, 1, 2, 2, 3])):
                counter += 1
                sk = [rng.choice(SKILL_VARIANTS.get(s, [s, s.lower(), " " + s + " "])) for s in job["skills"]]
                rec = {"source": source, "source_job_id": f"{source[:2]}-{counter}",
                       "title": rng.choice([job["title"], job["title"].lower(), "  " + job["title"] + " ", job["title"].replace(" ", "  ")]),
                       "company": rng.choice([job["company"], job["company"].upper(), job["company"].lower()]),
                       "location": job["location"], "salary_text": job["salary"], "posted_at": day.isoformat(), "skills": sk}
                lines.append(json.dumps(rec, ensure_ascii=False))
                if rng.random() < 0.04:            # the exporter retried: the very same line twice
                    lines.append(lines[-1])
        broken = 0.6 if day == BAD_DAY else 0.05
        final = []
        for line in lines:
            r = rng.random()
            if r < broken * 0.5:
                final.append(line[: len(line) // 2])                                     # truncated JSON
            elif r < broken * 0.8:
                rec = json.loads(line)
                rec[rng.choice(["title", "company", "source_job_id"])] = rng.choice(["", None])   # a required field is empty
                final.append(json.dumps(rec, ensure_ascii=False))
            elif r < broken:
                rec = json.loads(line)
                rec["posted_at"] = rng.choice(["31/02/2026", "yesterday", "2026-13-40"])
                final.append(json.dumps(rec, ensure_ascii=False))
            else:
                final.append(line)
        out[day] = final
    return out


def digest(files):
    h = hashlib.sha256()
    for name in sorted(files):
        h.update(name.encode())
        h.update(files[name].encode("utf-8"))
    return h.hexdigest()


def main():
    data = {f"jobs_{day.isoformat()}.jsonl": "\n".join(lines) + "\n" for day, lines in generate().items()}
    if EXPECTED_SHA256 == "TO_BE_FILLED":
        print("digest:", digest(data))
        return 0
    DATA.mkdir(parents=True, exist_ok=True)
    current = {p.name: p.read_text(encoding="utf-8") for p in DATA.glob("jobs_*.jsonl")}
    if current == data:
        print(f"ok       {len(data)} delivery files in {DATA} (already present, content matches)")
        return 0
    if digest(data) != EXPECTED_SHA256:
        print("FAILED   the generator output does not match the expected hash (different Python version?). Ask in the course issues.")
        return 1
    for name, text in data.items():
        (DATA / name).write_text(text, encoding="utf-8")
    print(f"ok       wrote {len(data)} delivery files into {DATA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
