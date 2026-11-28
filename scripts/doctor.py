#!/usr/bin/env python3
"""Check that your computer is ready for a module, and print the exact fix for anything that is not.

    python3 scripts/doctor.py              # the basics: Python, folder, Git, venv, course data
    python3 scripts/doctor.py mod-2-3      # the basics plus everything Module 2.3 needs

Run it from the course folder whenever something does not work and you do not know why. It changes nothing on
your computer: it only looks, and tells you which command to run. Fix the first problem it reports, then run it
again. Standard library only, so it works before anything is installed and without a venv.
"""
import importlib.metadata
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_RE = re.compile(r"^mod-[0-4]-\d$")

# What each module needs beyond its requirements.txt. Kept in step with the Prerequisites line of each module.
TOOLS = {
    "mod-1-1": {"jq": True, "docker": "the optional Step 7 of the lab (build and run the container)"},
    "mod-3-1": {"java": 17},
    "mod-3-3": {"java": 17},                      # Part B (Spark Structured Streaming)
    "mod-3-4": {"terraform": True},
    "mod-3-2": {"docker": "Part B (Kafka via docker compose) and, on Python 3.14, Part C (PostgreSQL)"},
    "mod-3-5": {"docker": "PostgreSQL with pgvector, on Python 3.14"},
    "mod-1-3": {"docker": "PostgreSQL for the EXPLAIN lab, on Python 3.14"},
}
NEEDS_POSTGRES = {"mod-1-3": "lab13", "mod-3-2": "lab32", "mod-3-5": "lab35"}   # pgserver has no Python 3.14 build
CAPSTONE_DIRS = {"mod-4-1": "~/taxi", "mod-4-2": "~/seismic", "mod-4-3": "~/fleet", "mod-4-4": "~/airflow-lab"}


class Report:
    def __init__(self, out=print):
        self.out, self.problems, self.warnings = out, 0, 0

    def ok(self, msg):
        self.out(f"  ok    {msg}")

    def bad(self, msg, *fix):
        self.problems += 1
        self.out(f"  FIX   {msg}")
        for line in fix:
            self.out(f"          {line}")

    def warn(self, msg, *fix):
        self.warnings += 1
        self.out(f"  note  {msg}")
        for line in fix:
            self.out(f"          {line}")


def sh(cmd, timeout=15):
    """Run a command; (exit code, output). 127 when the program does not exist."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr).strip()
    except FileNotFoundError:
        return 127, ""
    except subprocess.TimeoutExpired:
        return 124, "timed out"


def module_order(mod):
    m = re.match(r"mod-(\d)-(\d)", mod or "")
    return int(m.group(1)) * 10 + int(m.group(2)) if m else 99


def in_venv():
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)


def venv_health(venv_dir):
    """None if the venv works, else a sentence saying why not. A venv keeps working only while the Python that made it
    exists: after a Python upgrade (3.12 -> 3.14) its python silently becomes the new one and its packages vanish."""
    cfg = venv_dir / "pyvenv.cfg"
    py = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not cfg.exists() or not (py.exists() or py.is_symlink()):
        return "it is not a complete virtual environment (no pyvenv.cfg or no python)"
    made = re.search(r"^version\s*=\s*(\d+\.\d+)", cfg.read_text(encoding="utf-8", errors="replace"), re.M)
    code, out = sh([str(py), "-c", "import sys; print('%d.%d' % sys.version_info[:2])"])
    if code != 0:
        return f"its python does not start ({out.splitlines()[-1] if out else 'missing'})"
    if made and out.strip() != made.group(1):
        return f"it was made with Python {made.group(1)}, but its python now runs {out.strip()} (the old Python was removed or upgraded), so its packages are gone"
    code, _ = sh([str(py), "-m", "pip", "--version"])
    if code != 0:
        return "it has no pip"
    return None


def parse_requirements(path):
    """[(line, name, specifiers, applies)] from a requirements file: name, version rules, and whether its
    environment marker (only python_version is used in this course) applies to this Python."""
    rows = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or line.startswith("-"):
            continue
        req, _, marker = line.partition(";")
        m = re.match(r"\s*([A-Za-z0-9_.-]+)(\[[^\]]*\])?\s*(.*)$", req)
        if not m:
            continue
        rows.append((line, m.group(1), m.group(3).strip(), marker_applies(marker.strip())))
    return rows


def marker_applies(marker, version=None):
    if not marker:
        return True
    version = version or sys.version_info[:2]
    m = re.fullmatch(r'python_version\s*(<=|>=|==|!=|<|>)\s*["\'](\d+)\.(\d+)["\']', marker)
    if not m:
        return True                                   # unknown marker: assume it applies
    return compare(version, m.group(1), (int(m.group(2)), int(m.group(3))))


def compare(a, op, b):
    return {"<": a < b, "<=": a <= b, ">": a > b, ">=": a >= b, "==": a == b, "!=": a != b}[op]


def vtuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3]) or (0,)


def satisfies(installed, spec):
    """Enough of PEP 440 for this course's requirement files: comma-separated <, <=, >, >=, ==, != on numbers."""
    for part in filter(None, (p.strip() for p in spec.split(","))):
        m = re.match(r"(<=|>=|==|!=|<|>)\s*([\d.]+)", part)
        if not m:
            continue
        a, b = vtuple(installed), vtuple(m.group(2))
        n = max(len(a), len(b))
        if not compare(a + (0,) * (n - len(a)), m.group(1), b + (0,) * (n - len(b))):
            return False
    return True


def requirement_files(mod):
    lab = ROOT / "labs" / mod
    files = [lab / "requirements.txt"] if (lab / "requirements.txt").exists() else []
    files += [p for p in sorted(lab.glob("*/requirements.txt")) if p.parent.name not in ("app", "reference", "starter")]
    return files


# ---------------------------------------------------------------- the checks

def check_basics(r, mod, cwd):
    v = sys.version_info
    if v < (3, 10):
        r.bad(f"Python {v.major}.{v.minor} is too old; the course needs 3.10 or newer",
              "Start here, step 1, shows how to install a newer Python for your system.")
    else:
        r.ok(f"Python {v.major}.{v.minor}.{v.micro}")

    capstone_dir = CAPSTONE_DIRS.get(mod)
    if cwd.resolve() != ROOT:
        r.bad(f"this terminal is in {cwd}, not in the course folder",
              f"cd {short(ROOT)}",
              "Every command in the course (python3 labs/..., pytest labs/...) is run from there."
              + (f" Your capstone files live in {capstone_dir}, but you still run the setup and check.py from the course folder." if capstone_dir else ""))
    else:
        r.ok(f"you are in the course folder ({short(ROOT)})")

    code, out = sh(["git", "--version"])
    if code == 127:
        r.bad("git is not installed", "Start here, step 1, has the install line for your system.")
    else:
        r.ok(out.splitlines()[0])


def check_venv(r, mod):
    course_venvs = [d for d in (ROOT / "venv", ROOT / ".venv") if d.exists()]
    needs_venv = module_order(mod) >= 1 if mod else False   # the venv is made in Module 0.1 (the Workshop)
    for d in course_venvs:
        why = venv_health(d)
        if why:
            r.bad(f"the venv in {short(d)} is broken: {why}",
                  f"Make a new one (your code is not inside it): cd {short(ROOT)}",
                  f"rm -rf {d.name} && python3 -m venv venv && source venv/bin/activate",
                  "then install the packages for your module again (python -m pip install -r labs/<module>/requirements.txt).")
    if in_venv():
        here = Path(sys.prefix).resolve()
        capstone = CAPSTONE_DIRS.get(mod)
        if capstone and str(here).startswith(str(Path(os.path.expanduser(capstone)).resolve())):
            r.ok(f"the {capstone} venv is active, as the capstone setup asks")
        elif ROOT not in here.parents and here != ROOT:
            r.warn(f"the active venv is {short(here)}, not the course venv",
                   "That is fine for its own project (for example Lab 0.1's ~/kopiku). For the course labs: deactivate,",
                   f"then cd {short(ROOT)} && source venv/bin/activate")
        else:
            r.ok(f"venv active: {short(here)}")
        if sh([sys.executable, "-m", "pip", "--version"])[0] != 0:
            r.bad("the active venv has no pip", f"python3 -m ensurepip --upgrade, or recreate it (rm -rf {short(here)} and python3 -m venv again)")
    elif needs_venv or not mod:
        healthy = [d for d in course_venvs if not venv_health(d)]
        flag = r.bad if needs_venv and mod else r.warn   # without a module, a Level 0 learner may not need one yet
        if healthy:
            flag("no venv is active in this terminal",
                  f"source {healthy[0].name}/bin/activate      (the prompt then starts with ({healthy[0].name}))",
                  "Without it, pip refuses to install (externally-managed-environment) and the labs miss their packages.")
        elif not course_venvs:
            flag("the course has no venv yet" + ("" if mod else " (Module 0.0 can do without; from Module 0.1 on you need it)"),
                  f"cd {short(ROOT)} && python3 -m venv venv && source venv/bin/activate",
                  "Create it once (Lab 0.1, step 7). On Ubuntu or Debian you may first need: sudo apt install python3-venv")
    else:
        r.ok("no venv needed yet (Modules 0.0 and 0.2 can use the browser preview; Module 0.1 teaches the venv)")


def lab_uses_data(mod):
    """Whether a module's lab reads the generated course data (data/...); its Try-its may still use it."""
    try:
        text = (ROOT / "curriculum" / mod / "en.md").read_text(encoding="utf-8")
    except OSError:
        return True
    lab = text.split("## @lab", 1)[1] if "## @lab" in text else ""
    return bool(re.search(r"shopgen|data/orders\.csv|data/customers", lab))


def check_data(r, mod=None):
    if (ROOT / "data" / "orders.csv").exists():
        r.ok("course data generated (data/orders.csv)")
    elif mod and not lab_uses_data(mod):
        r.warn(f"the course data is not generated yet; the {mod} lab does not need it, some Try-its do",
               "python3 labs/shared/shopgen.py --out data")
    else:
        r.bad("the course data is not generated yet", "python3 labs/shared/shopgen.py --out data")


def check_packages(r, mod):
    files = requirement_files(mod)
    if not files:
        r.ok(f"{mod} needs no Python packages")
        return
    missing, wrong = [], []
    for f in files:
        for line, name, spec, applies in parse_requirements(f):
            if not applies:
                continue
            try:
                have = importlib.metadata.version(name)
            except importlib.metadata.PackageNotFoundError:
                missing.append((f, name))
                continue
            if spec and not satisfies(have, spec):
                wrong.append((f, f"{name} {have} (needs {spec})"))
    if missing or wrong:
        names = [n for _, n in missing] + [w for _, w in wrong]
        fix = [f"python -m pip install -r {f.relative_to(ROOT)}" for f in sorted({f for f, _ in missing + wrong})]
        if not in_venv():
            fix.insert(0, "first activate the venv (see above), then:")
        r.bad(f"{mod} is missing packages in this Python: {', '.join(names)}", *fix)
    else:
        r.ok(f"{mod}: every package in its requirements file is installed")


def check_tools(r, mod):
    need = TOOLS.get(mod, {})
    if need.get("jq"):
        code, out = sh(["jq", "--version"])
        if code == 127:
            r.bad("jq is not installed (Lessons 3 and 4 and the lab of Module 1.1 use it)",
                  "Debian, Ubuntu, WSL:  sudo apt install -y jq    macOS:  brew install jq")
        else:
            r.ok(f"{out.strip().splitlines()[0] if out.strip() else 'jq'} installed")
    if "java" in need:
        code, out = sh(["java", "-version"])
        m = re.search(r'version "(\d+)', out)
        if code == 127:
            r.bad("Java is not installed (Spark needs Java 17 or newer)", "Module 3.1, lab step 1, shows the install command for your system.")
        elif not m or int(m.group(1)) < need["java"]:
            r.bad(f"Java is too old ({out.splitlines()[0] if out else '?'}); Spark needs 17 or newer", "Module 3.1, lab step 1.")
        else:
            r.ok(f"Java {m.group(1)}")
    if need.get("terraform"):
        code, out = sh(["terraform", "version"])
        if code == 127:
            r.bad("Terraform is not installed", "Module 3.4 lists the install steps (a single binary from releases.hashicorp.com).")
        else:
            r.ok(out.splitlines()[0])
    if "docker" in need:
        code, out = sh(["docker", "info", "--format", "{{.ServerVersion}}"])
        if code == 127:
            r.warn(f"Docker is not installed; {mod} uses it for {need['docker']}", "Install Docker Engine (Linux) or Docker Desktop (macOS, Windows), then run this again.")
        elif code != 0 and "permission denied" in out.lower():
            r.bad("Docker is installed but this user may not use it",
                  "sudo usermod -aG docker $USER   then log out and back in (or restart)")
        elif code != 0:
            r.bad("Docker is installed but not running", "Linux: sudo systemctl start docker   macOS/Windows: open Docker Desktop")
        else:
            r.ok(f"Docker {out} is running")
    if mod in NEEDS_POSTGRES and sys.version_info >= (3, 14):
        db = NEEDS_POSTGRES[mod]
        if os.environ.get("DATABASE_URL"):
            check_database_url(r)
        else:
            r.bad("on Python 3.14 this lab needs PostgreSQL in Docker and DATABASE_URL (pgserver has no 3.14 build)",
                  "docker run -d --name kopiku-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg16 -c wal_level=logical",
                  f"docker exec kopiku-pg psql -U postgres -c \"CREATE DATABASE {db}\"",
                  f"export DATABASE_URL=postgresql://postgres:dev@localhost:5432/{db}      (again in every new terminal)")
    if mod == "mod-3-2" and not os.environ.get("KAFKA_BOOTSTRAP"):
        r.warn("KAFKA_BOOTSTRAP is not set, so Part B (real Kafka) will be skipped",
               "docker compose up -d redpanda   then   export KAFKA_BOOTSTRAP=localhost:9092")
    if mod == "mod-4-4" and sys.version_info >= (3, 14):
        r.bad("Airflow 3.1 does not install on Python 3.14",
              "Make the capstone venv with Python 3.12 using uv (Module 4.4 shows it): uv venv --python 3.12 ~/airflow-lab/venv")
    if mod == "mod-2-3":
        check_kopiku_db(r)


def check_database_url(r):
    url = os.environ["DATABASE_URL"]
    try:
        import psycopg
    except ImportError:
        r.ok("DATABASE_URL is set (install the lab packages to let doctor test the connection)")
        return
    try:
        psycopg.connect(url, connect_timeout=3).close()
        r.ok("DATABASE_URL is set and PostgreSQL answers")
    except Exception as e:
        first = str(e).strip().splitlines()[0][:140] if str(e).strip() else type(e).__name__
        r.bad(f"DATABASE_URL is set, but PostgreSQL does not answer: {first}",
              "After a restart the container is stopped:  docker start kopiku-pg",
              "Check it is running with  docker ps  (the database name in the URL must exist too).")


def check_kopiku_db(r):
    db = os.environ.get("KOPIKU_DB")
    if not db:
        r.bad("KOPIKU_DB is not set in this terminal, so dbt would quietly use an empty database",
              "export KOPIKU_DB=$PWD/kopiku.duckdb      (from the course folder, again in every new terminal)")
        return
    if not Path(db).exists():
        r.bad(f"KOPIKU_DB points to {db}, which does not exist yet", "python3 labs/mod-2-3/load_raw.py data $KOPIKU_DB")
        return
    try:
        import duckdb
        con = duckdb.connect(db, read_only=True)
        n = con.execute("select count(*) from information_schema.tables where table_schema = 'raw'").fetchone()[0]
        con.close()
    except ImportError:
        r.ok(f"KOPIKU_DB = {db} (install the lab packages to let doctor look inside)")
        return
    except Exception as e:  # locked by another process, or not a DuckDB file
        r.warn(f"could not open {db}: {str(e).splitlines()[0][:120]}")
        return
    if n:
        r.ok(f"KOPIKU_DB = {db}, with {n} raw tables")
    else:
        r.bad(f"{db} has no raw tables", "python3 labs/mod-2-3/load_raw.py data $KOPIKU_DB")


def short(p):
    p, home = str(p), os.path.expanduser("~")
    return "~" + p[len(home):] if p == home or p.startswith(home + os.sep) else p


def main(argv, cwd=None, out=print):
    mods = [a for a in argv if MODULE_RE.match(a)]
    unknown = [a for a in argv if not MODULE_RE.match(a)]
    if unknown:
        out(__doc__)
        return 2
    mod = mods[0] if mods else None
    if mod and not (ROOT / "labs" / mod).exists():
        out(f"There is no {mod}. Modules run from mod-0-0 to mod-4-4.")
        return 2
    r = Report(out)
    out(f"DataForge doctor{' for ' + mod if mod else ''}\n")
    check_basics(r, mod, Path(cwd or os.getcwd()))
    check_venv(r, mod)
    if mod not in CAPSTONE_DIRS:          # the capstones download their own data with fetch_data.py
        check_data(r, mod)
    if mod:
        check_packages(r, mod)
        check_tools(r, mod)
    out("")
    if r.problems:
        out(f"{r.problems} thing(s) to fix. Fix the first FIX line, then run this again.")
    else:
        out("Everything checked looks ready." + ("" if mod else " Add a module to check what it needs too, for example: python3 scripts/doctor.py mod-2-3"))
    return 1 if r.problems else 0


def self_test():
    """The checks that decide something, run on made-up inputs."""
    assert marker_applies('python_version < "3.14"', (3, 12)) and not marker_applies('python_version < "3.14"', (3, 14))
    assert satisfies("8.4.1", ">=8,<10") and not satisfies("10.0", ">=8,<10") and satisfies("1.11.1", ">=1.8")
    assert satisfies("0.20.1", ">=0.20") and not satisfies("2.0.1", ">=1.0,<2")
    with tempfile.TemporaryDirectory() as tmp:
        req = Path(tmp) / "requirements.txt"
        req.write_text('pytest>=8,<10\npsycopg[binary]>=3.1      # Part C\npgserver>=0.1.4; python_version < "3.14"   # note\n\n# x\n')
        rows = parse_requirements(req)
        assert [(n, s) for _, n, s, _ in rows] == [("pytest", ">=8,<10"), ("psycopg", ">=3.1"), ("pgserver", ">=0.1.4")], rows
        # a venv whose Python was replaced: pyvenv.cfg says 3.9, its python is this one
        bad = Path(tmp) / "oldvenv"
        (bad / "bin").mkdir(parents=True)
        (bad / "pyvenv.cfg").write_text("home = /usr/bin\nversion = 3.9.0\n")
        (bad / "bin" / "python").symlink_to(sys.executable)
        why = venv_health(bad)
        assert why and "made with Python 3.9" in why, why
        assert "not a complete" in venv_health(Path(tmp) / "nothing")
        # a real, fresh venv is healthy
        good = Path(tmp) / "goodvenv"
        if sh([sys.executable, "-m", "venv", str(good)], timeout=120)[0] == 0:
            assert venv_health(good) is None, venv_health(good)
        # outside the course folder: one FIX, and the exit code says so
        lines = []
        code = main([], cwd=tmp, out=lines.append)
        assert code == 1 and any("not in the course folder" in l for l in lines), lines
        # KOPIKU_DB missing for Module 2.3
        saved = os.environ.pop("KOPIKU_DB", None)
        r = Report(lambda s: None)
        check_kopiku_db(r)
        assert r.problems == 1
        os.environ["KOPIKU_DB"] = str(Path(tmp) / "missing.duckdb")
        r = Report(lambda s: None)
        check_kopiku_db(r)
        assert r.problems == 1
        os.environ.pop("KOPIKU_DB")
        if saved is not None:
            os.environ["KOPIKU_DB"] = saved
    # a missing jq is a problem with the install command; a present one is fine
    saved_path = os.environ.get("PATH", "")
    os.environ["PATH"] = "/nonexistent"
    try:
        r = Report(lambda s: None)
        check_tools(r, "mod-1-1")
        assert r.problems >= 1, "a missing jq must be reported for mod-1-1"
    finally:
        os.environ["PATH"] = saved_path
    assert main(["mod-9-9"], out=lambda s: None) == 2 and main(["--nope"], out=lambda s: None) == 2
    print("SELF_TEST_DOCTOR_OK")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(self_test())
    sys.exit(main(sys.argv[1:]))
