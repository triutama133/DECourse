#!/usr/bin/env python3
"""End-to-end test of the lab proof codes: scripts/prove.py (Python) -> app/js/proof.js (what the browser runs).

    python3 scripts/test_proof.py        (needs Node 18+ and network access once, to pip-install pytest into a temp venv)

Runs real labs in a temporary copy of the repository, inside a real virtual environment, and checks that the app accepts honest
work and rejects: a copied reference solution, an untouched starter, edited tests, a damaged code, the wrong module,
and a missing venv for Lab 0.1.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
failures = 0


def check(cond, msg):
    global failures
    print(("PASS " if cond else "FAIL ") + msg)
    failures += not cond


def sh(cmd, cwd=None, env=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=env)
    return p.returncode, p.stdout + p.stderr


def app_check(mod, code):
    _, out = sh(["node", str(ROOT / "scripts" / "proof_check.js"), mod, code])
    return json.loads(out.strip().splitlines()[-1])


def code_of(out):
    for line in out.splitlines():
        if line.strip().startswith("DF1:"):
            return line.strip()
    return None


def resign(code, index, value):
    """Change one field and recompute the checksum (simulates an honest run in another situation)."""
    f = code.split(":")[:8]
    f[index] = value
    return ":".join(f + [hashlib.sha256("|".join(f).encode()).hexdigest()[:6]])


tmp = Path(tempfile.mkdtemp(prefix="proof_test_"))
try:
    work = tmp / "repo"
    (work / "scripts").mkdir(parents=True)
    shutil.copytree(ROOT / "labs", work / "labs", ignore=shutil.ignore_patterns("__pycache__", ".terraform", "*.tfstate*"))
    shutil.copy(ROOT / "scripts" / "prove.py", work / "scripts" / "prove.py")
    print("creating a virtual environment with pytest ...")
    sh([sys.executable, "-m", "venv", str(tmp / "venv")])
    py = str(tmp / "venv" / ("Scripts" if os.name == "nt" else "bin") / "python")
    rc, out = sh([py, "-m", "pip", "install", "-q", "pytest"])
    check(rc == 0, "pytest installed in the temporary venv")
    env = {k: v for k, v in os.environ.items() if k not in ("LAB_DIR", "VIRTUAL_ENV")}
    prove = lambda *a, e=env: sh([py, str(work / "scripts" / "prove.py"), *a], cwd=str(work), env=e)  # noqa: E731
    lab = work / "labs" / "mod-0-1"
    ref = (lab / "reference" / "pipeline.py").read_text(encoding="utf-8")

    rc, out = prove("mod-0-1")
    check(rc == 1 and code_of(out) is None, "Lab 0.1 starter: tests fail, no code is printed")
    rc, out = prove("mod-0-1", e={**env, "LAB_DIR": "reference"})
    check(rc == 2 and code_of(out) is None, "LAB_DIR (reference mode) is refused")

    (lab / "pipeline.py").write_text(ref, encoding="utf-8")
    rc, out = prove("mod-0-1")
    code = code_of(out)
    check(rc == 0 and code, "copied reference solution: tests pass and a code is printed")
    r = app_check("mod-0-1", code)
    check(not r["ok"] and r["reason"] == "copied", f"app rejects the copied reference solution ({r})")

    (lab / "pipeline.py").write_text(ref + "\n# my own notes\n", encoding="utf-8")
    rc, out = prove("mod-0-1")
    code = code_of(out)
    r = app_check("mod-0-1", code)
    check(rc == 0 and r["ok"] and r["info"]["venv"] == "v" and r["info"]["passed"] == 8, f"app accepts honest work run in a venv ({r})")
    check(not app_check("mod-0-1", code[:-1] + ("0" if code[-1] != "0" else "1"))["ok"], "app rejects a damaged code (checksum)")
    check(app_check("mod-0-1", code.replace("mod-0-1", "mod-1-2"))["reason"] in ("checksum", "module"), "app rejects a code edited to another module")
    check(app_check("mod-1-2", code)["reason"] == "module", "app rejects a code pasted into another module's page")
    check(app_check("mod-0-1", resign(code, 3, "n"))["reason"] == "venv", "Lab 0.1 rejects a run outside a venv")
    check(app_check("mod-0-1", resign(code, 3, "c"))["ok"], "a conda environment is accepted")

    (lab / "test_lab.py").write_text((lab / "test_lab.py").read_text(encoding="utf-8") + "\n# weakened\n", encoding="utf-8")
    rc, out = prove("mod-0-1")
    r = app_check("mod-0-1", code_of(out))
    check(not r["ok"] and r["reason"] == "stale", f"app rejects a code from edited tests ({r})")

    # a check-style lab (SQL answers)
    sql = work / "labs" / "mod-0-3"
    refsql = (sql / "reference" / "answers.sql").read_text(encoding="utf-8")
    (sql / "answers.sql").write_text(refsql, encoding="utf-8")
    rc, out = prove("mod-0-3")
    check(rc == 0 and app_check("mod-0-3", code_of(out))["reason"] == "copied", "SQL lab: copied answers are rejected")
    (sql / "answers.sql").write_text(refsql + "\n-- own notes\n", encoding="utf-8")
    rc, out = prove("mod-0-3")
    check(rc == 0 and app_check("mod-0-3", code_of(out))["ok"], "SQL lab: honest answers are accepted")
    rc, out = prove("mod-0-2")
    check(rc != 0 and "workspace" in out, "Lab 0.2 asks for the workspace path")
    if shutil.which("bash") and shutil.which("git"):
        ws = tmp / "ws"
        sh(["bash", str(work / "labs" / "mod-0-2" / "reference" / "make_workspace.sh"), str(ws)])
        rc, out = prove("mod-0-2", str(ws))
        check(rc == 0 and app_check("mod-0-2", code_of(out))["reason"] == "copied", "Lab 0.2: the reference workspace is recognised as copied")
        (ws / "summarize.py").write_text((ws / "summarize.py").read_text(encoding="utf-8") + "\n# mine\n", encoding="utf-8")
        sh(["git", "-C", str(ws), "add", "-A"])
        sh(["git", "-C", str(ws), "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "my notes on the summarize script"])
        rc, out = prove("mod-0-2", str(ws))
        check(rc == 0 and app_check("mod-0-2", code_of(out))["ok"], "Lab 0.2: an own workspace is accepted")
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n" + ("all proof tests passed" if not failures else f"{failures} proof test(s) FAILED"))
sys.exit(1 if failures else 0)
