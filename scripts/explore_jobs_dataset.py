#!/usr/bin/env python3
"""Explore and clean the exported Indonesian Jobs Dataset using DuckDB.

Usage:
    python3 scripts/explore_jobs_dataset.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARQUET_FILE = ROOT / "data" / "jobs" / "raw_jobs.parquet"


def main():
    if not PARQUET_FILE.is_file():
        print(f"Error: {PARQUET_FILE} not found.")
        print("Please run `python3 scripts/export_jobs_dataset.py` first to generate the dataset.")
        sys.exit(1)

    try:
        import duckdb
    except ImportError:
        print("Error: duckdb is not installed in this environment. Run: pip install duckdb")
        sys.exit(1)

    con = duckdb.connect()
    f = str(PARQUET_FILE).replace("\\", "/")

    print("=" * 70)
    print("INDONESIAN TECH & RECRUITMENT JOBS DATASET EXPLORATION")
    print("=" * 70)

    # 1. Total jobs and platform breakdown
    print("\n1. Distribusi Platform Rekrutmen:")
    con.sql(f"""
        SELECT 
            platform, 
            count(*) AS total_jobs,
            count(salary) AS with_salary,
            round(count(salary) * 100.0 / count(*), 1) AS pct_with_salary,
            count(CASE WHEN is_active THEN 1 END) AS active_jobs
        FROM '{f}'
        GROUP BY 1
        ORDER BY total_jobs DESC
    """).show()

    # 2. Top 10 Industri/Kategori
    print("\n2. Top 10 Kategori Pekerjaan Terbanyak:")
    con.sql(f"""
        SELECT 
            COALESCE(category, 'Uncategorized') AS category,
            count(*) AS total_jobs
        FROM '{f}'
        GROUP BY 1
        ORDER BY total_jobs DESC
        LIMIT 10
    """).show()

    # 3. Top 10 Perusahaan Paling Aktif Merekrut
    print("\n3. Top 10 Perusahaan Paling Aktif Membuka Lowongan:")
    con.sql(f"""
        SELECT 
            company,
            count(*) AS total_openings,
            count(DISTINCT job_title) AS distinct_titles
        FROM '{f}'
        WHERE company IS NOT NULL AND company != ''
        GROUP BY 1
        ORDER BY total_openings DESC
        LIMIT 10
    """).show()

    # 4. Contoh Regex Parsing Gaji Nyata
    print("\n4. Contoh Parsing Gaji (Menangani IDR / Rp / Range / Titik Ribuan):")
    sample_salaries = con.sql(f"""
        SELECT 
            job_title,
            company,
            salary
        FROM '{f}'
        WHERE salary IS NOT NULL AND salary != '' AND is_active = true
        LIMIT 5
    """).fetchall()

    def parse_idr_salary(text):
        if not text:
            return None, None
        s = text.replace(".", "").replace(",", "")
        nums = [int(n) for n in re.findall(r"\b\d{5,10}\b", s)]
        if len(nums) >= 2:
            return min(nums), max(nums)
        elif len(nums) == 1:
            return nums[0], nums[0]
        return None, None

    for title, comp, sal in sample_salaries:
        min_s, max_s = parse_idr_salary(sal)
        min_fmt = f"Rp {min_s:,.0f}".replace(",", ".") if min_s else "-"
        max_fmt = f"Rp {max_s:,.0f}".replace(",", ".") if max_s else "-"
        print(f" - {title} ({comp})")
        print(f"   Raw text:   \"{sal}\"")
        print(f"   Normalized: Min: {min_fmt} | Max: {max_fmt}\n")

    print("=" * 70)
    print("Dataset ini siap digunakan untuk latihan ETL, SCD, Data Cleaning, dan Airflow Mart!")
    print("=" * 70)


if __name__ == "__main__":
    main()
