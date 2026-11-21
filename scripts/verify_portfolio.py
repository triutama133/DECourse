#!/usr/bin/env python3
"""Checks that a portfolio repository on your computer looks like real, tested work, and prints a PORT1 code.

    python3 scripts/verify_portfolio.py proj-1 ~/my-lakehouse
    python3 scripts/verify_portfolio.py self-test

What it checks (it cannot judge quality; a reviewer still should):
1. a Git history of at least 3 commits, made over more than one day or by more than one push of work;
2. no secrets in tracked files (.env files, private keys, cloud keys, hard-coded passwords) and a .gitignore;
3. a README with a decision record: at least one heading such as "Decision", "Trade-off" or "ADR" with real text under it;
4. a CI workflow (GitHub Actions or GitLab CI) that runs the tests; a Dockerfile alone is not CI;
5. at least 3 passing tests that import your own code and assert something about its result (assert 1 == 1 does not count);
6. code or configuration that belongs to the project you name (proj-1, proj-2 or proj-3), not only its README;
7. for proj-1, a dashboard on the gold layer (a BI tool in the code or configuration, or a dashboard file or folder).
Standard library only (Python 3.8+); runs `git` and `python -m pytest` (or unittest) inside the repository.
"""
import argparse
import ast
import hashlib
import os
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path

VERSION = "PORT1"

# what each portfolio project must contain in its code or configuration (at least two of these)
PROJECTS = {
    "proj-1": ("the lakehouse", {"Iceberg": r"iceberg", "DuckDB": r"duckdb", "dbt": r"dbt_project|\bdbt\b", "Dagster": r"dagster", "MinIO or S3": r"minio|s3://"}),
    "proj-2": ("the CDC and streaming platform", {"Debezium": r"debezium", "Kafka or Redpanda": r"kafka|redpanda", "PostgreSQL WAL": r"wal_level|pgoutput|replication slot|logical replication", "Iceberg": r"iceberg"}),
    "proj-3": ("the FinOps and observability engine", {"query history or cost": r"query_history|bytes_scanned|cost|finops", "data contract": r"contract", "schema drift": r"schema[_ ]?drift|schema change", "partition scan": r"partition"}),
}
SECRET_PATTERNS = [
    (r"AKIA[0-9A-Z]{16}", "an AWS access key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "a private key"),
    (r"(?i)(password|passwd|secret|api_key|token)\s*[:=]\s*['\"][^'\"\s]{6,}['\"]", "a hard-coded password or key"),
    (r"eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}", "a JWT token"),
]
CODE_SUFFIXES = {".py", ".sql", ".yml", ".yaml", ".toml", ".json", ".cfg", ".ini", ".conf", ".sh", ".tf", ".properties"}


def run_cmd(cmd, cwd, timeout=600):
    try:
        p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)


def local_modules(root, tracked):
    """Names a test could import from this repository: top-level .py files and packages."""
    names = set()
    for f in tracked:
        parts = Path(f).parts
        if not f.endswith(".py") or any(p.startswith("test") for p in parts):
            continue
        names.add(parts[0][:-3] if len(parts) == 1 else parts[0])
        if parts[0] == "src" and len(parts) > 1:
            names.add(parts[1][:-3] if parts[1].endswith(".py") else parts[1])
    return names


def is_constant(node):
    return isinstance(node, ast.Constant) or (isinstance(node, (ast.List, ast.Tuple, ast.Set)) and all(is_constant(e) for e in node.elts))


def meaningful_tests(root, tracked, mods):
    """Test functions in files that import local code, with at least one assert that is not about constants only."""
    count, files_importing = 0, 0
    for f in tracked:
        name = Path(f).name
        if not (f.endswith(".py") and (name.startswith("test_") or name.endswith("_test.py"))):
            continue
        try:
            tree = ast.parse((root / f).read_text(encoding="utf-8", errors="ignore"))
        except SyntaxError:
            continue
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported |= {a.name.split(".")[0] for a in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        if not imported & mods:
            continue
        files_importing += 1
        for fn in ast.walk(tree):
            if not (isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and fn.name.startswith("test")):
                continue
            real = False
            for node in ast.walk(fn):
                if isinstance(node, ast.Assert) and not (is_constant(node.test) or (isinstance(node.test, ast.Compare) and is_constant(node.test.left) and all(is_constant(c) for c in node.test.comparators))):
                    real = True
                elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr.startswith("assert") and node.args and not all(is_constant(a) for a in node.args):
                    real = True
                elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "raises":
                    real = True
            count += real
    return count, files_importing


def verify_repo(proj_id, repo_dir):
    if proj_id not in PROJECTS:
        print(f"FAIL  unknown project '{proj_id}'. Use one of: {', '.join(PROJECTS)}")
        return 1
    root = Path(os.path.expanduser(repo_dir)).resolve()
    if not root.is_dir():
        print(f"FAIL  the folder {root} does not exist")
        return 1
    passed = failed = 0

    def check(cond, text, hint=""):
        nonlocal passed, failed
        if cond:
            passed += 1
            print(f"PASS  {text}")
        else:
            failed += 1
            print(f"FAIL  {text}" + (f"\n      hint: {hint}" if hint else ""))

    code, out = run_cmd(["git", "rev-list", "--count", "HEAD"], root)
    commits = int(out.strip()) if code == 0 and out.strip().isdigit() else 0
    code_d, dates = run_cmd(["git", "log", "--format=%ad", "--date=short"], root)
    days = len(set(dates.split())) if code_d == 0 else 0
    check(commits >= 3, f"Git history with at least 3 commits ({commits} found, on {days} day(s))", "commit as you build, one meaningful step at a time")

    code, tracked_out = run_cmd(["git", "ls-files"], root)
    tracked = [l.strip() for l in tracked_out.splitlines() if l.strip()] if code == 0 else []
    leaks = [f"{f} (a .env file)" for f in tracked if Path(f).name == ".env" or Path(f).name.startswith(".env.") and not f.endswith(".example")]
    for f in tracked:
        p = root / f
        if p.suffix in CODE_SUFFIXES | {".md", ".txt", ".env", ""} and p.is_file() and p.stat().st_size < 2_000_000:
            text = p.read_text(encoding="utf-8", errors="ignore")
            for rx, what in SECRET_PATTERNS:
                if re.search(rx, text):
                    leaks.append(f"{f} ({what})")
                    break
    check((root / ".gitignore").is_file() and not leaks, "no secrets in tracked files, and a .gitignore",
          ("found: " + "; ".join(leaks[:5]) + ". Remove them, rotate the leaked values, and read them from the environment instead") if leaks else "add a .gitignore that lists .env and your virtual environment")

    readme = root / "README.md"
    txt = readme.read_text(encoding="utf-8", errors="ignore") if readme.is_file() else ""
    sections = re.split(r"(?m)^#{1,4} ", txt)
    decision = [s for s in sections if re.match(r"(?i)[^\n]*(decision|trade-?off|\badr\b|keputusan)", s) and len(re.sub(r"\s+", " ", s.split("\n", 1)[-1]).strip()) >= 150]
    check(bool(decision), "README has a decision record: a 'Decision', 'Trade-off' or 'ADR' heading with at least a paragraph under it",
          "write down one real choice you made (what you chose, what you rejected, and why) under its own heading")

    workflows = [f for f in tracked if re.match(r"\.github/workflows/[^/]+\.ya?ml$", f) or f == ".gitlab-ci.yml"]
    runs_tests = any(re.search(r"pytest|unittest|make test|tox", (root / f).read_text(encoding="utf-8", errors="ignore")) for f in workflows)
    check(runs_tests, "a CI workflow (GitHub Actions or GitLab CI) that runs the tests", "add .github/workflows/ci.yml with a step that runs pytest; a Dockerfile alone is not CI")

    mods = local_modules(root, tracked)
    n_real, n_files = meaningful_tests(root, tracked, mods)
    code_pt, out_pt = run_cmd([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "--color=no"], root)
    m = {k: int(n) for n, k in re.findall(r"(\d+) (passed|failed|errors?)", out_pt)}
    n_pass, n_fail = m.get("passed", 0), m.get("failed", 0) + m.get("error", 0) + m.get("errors", 0)
    if "No module named pytest" in out_pt:
        code_pt, out_ut = run_cmd([sys.executable, "-m", "unittest", "discover"], root)
        ran = re.search(r"Ran (\d+) tests?", out_ut)
        n_pass, n_fail = (int(ran.group(1)) if ran and code_pt == 0 else 0), (0 if code_pt == 0 else 1)
    check(code_pt == 0 and n_fail == 0 and n_pass >= 3 and n_real >= 3,
          f"at least 3 passing tests that check your own code ({n_pass} passed, {n_fail} failed; {n_real} test(s) import your code and assert on a result)",
          "test files must import your modules and assert on what they return; assert True or assertEqual(1, 1) does not count")

    what, parts = PROJECTS[proj_id]
    code_text = "\n".join((root / f).read_text(encoding="utf-8", errors="ignore").lower()
                          for f in tracked if Path(f).suffix in CODE_SUFFIXES and (root / f).is_file() and (root / f).stat().st_size < 2_000_000)
    found = [name for name, rx in parts.items() if re.search(rx, code_text)]
    check(len(found) >= 2, f"code or configuration for {what} (found: {', '.join(found) or 'nothing'}; at least 2 of {', '.join(parts)})",
          "the README is not enough: the code and configuration must use the project's tools")

    if proj_id == "proj-1":
        # A lakehouse nobody can look at is half a project: ask for the serving layer (Module 1.4, lesson 8).
        bi = r"metabase|superset|evidence\.dev|streamlit|lightdash|power ?bi|tableau|looker"
        by_name = [f for f in tracked if "dashboard" in f.lower()]
        by_tool = re.search(bi, code_text)
        check(bool(by_name or by_tool), "a dashboard on the gold layer (a BI tool in the code or configuration, or a file or folder named 'dashboard')",
              "serve the gold tables in Metabase or another BI tool, and commit its setup or the dashboard's SQL in a dashboards/ folder")

    if failed:
        print(f"\nNot yet: {failed} check(s) failed. Fix them in {root} and run this again.")
        return 1
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    osname = platform.system().lower() or "unknown"
    fields = [VERSION, proj_id, str(passed), str(commits), py, osname]
    chk = hashlib.sha256(("|".join(fields)).encode("utf-8")).hexdigest()[:6]
    print(f"\nThe repository passes the automatic checks. A person should still review it.")
    print(f"Portfolio code (paste it into the Portfolio page of the web app):  {':'.join(fields + [chk])}")
    return 0


def self_test():
    """A real-looking repository must pass; the shortcuts this script exists to stop must each fail."""
    def make(tmp, files, commits=3):
        run_cmd(["git", "init", "-q"], tmp)
        run_cmd(["git", "config", "user.email", "learner@example.invalid"], tmp)
        run_cmd(["git", "config", "user.name", "Learner"], tmp)
        items = list(files.items())
        step = max(1, len(items) // commits)
        for i in range(commits):
            chunk = items[i * step:(i + 1) * step] if i < commits - 1 else items[i * step:]
            for name, body in chunk:
                (tmp / name).parent.mkdir(parents=True, exist_ok=True)
                (tmp / name).write_text(body, encoding="utf-8")
            if not chunk:
                (tmp / f"notes{i}.md").write_text(f"step {i}\n", encoding="utf-8")
            run_cmd(["git", "add", "-A"], tmp)
            run_cmd(["git", "commit", "-q", "-m", f"step {i}"], tmp)

    good = {
        ".gitignore": ".env\n.venv/\n__pycache__/\n",
        "README.md": "# Lakehouse\n\n## Decision: Iceberg over plain Parquet\n" + "We chose Iceberg tables over a folder of Parquet files because deletes and schema changes must not rewrite the whole table, and we accepted the extra catalog to run. " * 2 + "\n",
        "pipeline.py": "import duckdb\n\ndef net(rows):\n    return sum(r['gross'] - r['tax'] for r in rows if r['status'] != 'refunded')\n\nTABLE = 'iceberg_scan'\n",
        "dbt_project.yml": "name: lakehouse\n",
        "test_pipeline.py": "from pipeline import net\n\ndef test_net():\n    assert net([{'gross': 10, 'tax': 1, 'status': 'paid'}]) == 9\n\ndef test_refund():\n    assert net([{'gross': 10, 'tax': 1, 'status': 'refunded'}]) == 0\n\ndef test_empty():\n    assert net([]) == 0\n",
        ".github/workflows/ci.yml": "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pip install pytest duckdb && pytest\n",
        "dashboards/revenue_by_tier.sql": "-- Metabase question: revenue by tier at purchase\nSELECT tier, SUM(line_total_idr) FROM gold.fct_sales GROUP BY tier;\n",
    }
    shortcuts = {
        "trivial tests": {"test_pipeline.py": "def test_a():\n    assert 1 == 1\n\ndef test_b():\n    assert True\n\ndef test_c():\n    assert [1] == [1]\n"},
        "a Dockerfile instead of CI": {".github/workflows/ci.yml": None, "Dockerfile": "FROM python:3.12-slim\n"},
        "a README of keywords": {"README.md": "# Lakehouse\narchitecture decision grain idempotency trade-off pipeline " * 5 + "\n"},
        "a tracked .env": {".env": "DB_PASSWORD=hunter2hunter2\n", ".gitignore": ".venv/\n"},
        "a hard-coded key": {"settings.py": "API_KEY = 'sk_live_abcdef123456'\n"},
        "the wrong project": {"pipeline.py": "def net(rows):\n    return sum(r['gross'] - r['tax'] for r in rows if r['status'] != 'refunded')\n", "dbt_project.yml": None},
        "two commits": "commits",
        "no dashboard": {"dashboards/revenue_by_tier.sql": None},
    }
    if run_cmd([sys.executable, "-c", "import pytest"], ".")[0] != 0:
        print("self-test needs pytest: pip install pytest")
        return 1
    bad = 0
    for name, change in [("a real-looking repository", None)] + list(shortcuts.items()):
        tmp = Path(tempfile.mkdtemp(prefix="port-test-"))
        try:
            files = dict(good)
            commits = 3
            if change == "commits":
                commits = 2
            elif change:
                for f, body in change.items():
                    if body is None:
                        files.pop(f, None)
                    else:
                        files[f] = body
            make(tmp, files, commits)
            with open(os.devnull, "w") as devnull:
                stdout, sys.stdout = sys.stdout, devnull
                try:
                    rc = verify_repo("proj-1", tmp)
                finally:
                    sys.stdout = stdout
            want_pass = change is None
            ok = (rc == 0) == want_pass
            print(f"{name:28} {'passes' if rc == 0 else 'fails'}{'' if ok else '  <-- WRONG'}")
            bad += not ok
        finally:
            import shutil
            shutil.rmtree(tmp, ignore_errors=True)
    print("\nAll good." if not bad else f"\n{bad} problem(s).")
    return 1 if bad else 0


def main(argv):
    ap = argparse.ArgumentParser(description="Check a portfolio repository on your computer.")
    ap.add_argument("proj_id", help="proj-1, proj-2 or proj-3, or 'self-test'")
    ap.add_argument("repo_dir", nargs="?", default=".", help="path to your Git repository")
    args = ap.parse_args(argv)
    if args.proj_id == "self-test":
        return self_test()
    return verify_repo(args.proj_id, args.repo_dir)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
