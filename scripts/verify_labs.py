#!/usr/bin/env python3
"""Course CI: prove that every lab is solvable and that no starter is already solved.

For each lab:
  1. the REFERENCE solution must pass all its tests          (LAB_DIR=reference)
  2. the STARTER (what the learner receives) must fail some

Usage:
    python3 scripts/verify_labs.py                  # everything installed on this machine
    python3 scripts/verify_labs.py mod-2-3 mod-3-5  # only some modules
    python3 scripts/verify_labs.py --list

Install each lab's requirements first (labs/<module>/requirements.txt). Tests that need a tool that is not installed
(Terraform, Java for Spark, a Kafka broker via KAFKA_BOOTSTRAP) are skipped by the tests themselves and reported as skipped.
"""
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABS = ROOT / "labs"

# module -> ("pytest", [targets]) or ("shell", [verify scripts])
PLAN = {
    "mod-0-0": ("pytest", ["labs/mod-0-0/test_lab.py"]),
    "mod-0-1": ("pytest", ["labs/mod-0-1/test_lab.py"]),
    "mod-0-2": ("shell", ["labs/mod-0-2/verify.sh"]),
    "mod-0-3": ("shell", ["labs/mod-0-3/verify.sh"]),
    "mod-1-1": ("pytest", ["labs/mod-1-1/test_lab.py"]),
    "mod-1-2": ("pytest", ["labs/mod-1-2/test_lab.py"]),
    "mod-1-3": ("both", ["labs/mod-1-3/verify.sh", "labs/mod-1-3/explain/test_lab.py"]),
    "mod-1-4": ("both", ["labs/mod-1-4/verify.sh", "labs/mod-1-4/test_lab.py"]),
    "mod-1-5": ("pytest", ["labs/mod-1-5/test_lab.py"]),
    "mod-1-6": ("pytest", ["labs/mod-1-6/test_lab.py"]),
    "mod-1-7": ("pytest", ["labs/mod-1-7/test_lab.py"]),
    "mod-2-1": ("pytest", ["labs/mod-2-1/test_lab.py"]),
    "mod-2-2": ("pytest", ["labs/mod-2-2/test_lab.py"]),
    "mod-2-3": ("pytest", ["labs/mod-2-3/test_lab.py"]),
    "mod-2-4": ("pytest", ["labs/mod-2-4/test_lab.py"]),
    "mod-2-5": ("pytest", ["labs/mod-2-5/test_lab.py"]),
    "mod-2-6": ("pytest", ["labs/mod-2-6/test_lab.py"]),
    "mod-3-0": ("pytest", ["labs/mod-3-0/test_lab.py"]),
    "mod-3-1": ("pytest", ["labs/mod-3-1/test_lab.py"]),
    "mod-3-2": ("pytest", ["labs/mod-3-2/test_minilog.py", "labs/mod-3-2/test_cdc.py", "labs/mod-3-2/test_real_kafka.py"]),
    "mod-3-3": ("pytest", ["labs/mod-3-3/test_windows.py", "labs/mod-3-3/test_stream.py"]),
    "mod-3-4": ("pytest", ["labs/mod-3-4/test_terraform.py", "labs/mod-3-4/test_finops.py"]),
    "mod-3-5": ("pytest", ["labs/mod-3-5/test_rag.py"]),
    "mod-4-1": ("capstone", ["labs/mod-4-1/check.py"]),
    "mod-4-2": ("capstone", ["labs/mod-4-2/check.py"]),
    "mod-4-3": ("capstone", ["labs/mod-4-3/check.py"]),
}


def run(cmd, env_extra=None, timeout=1500):
    env = {**os.environ, **(env_extra or {})}
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout + p.stderr, time.time() - t0
    except subprocess.TimeoutExpired:
        return 124, "timed out", time.time() - t0


def counts(out):
    last = out.strip().splitlines()[-1] if out.strip() else ""
    return {k: int(n) for n, k in re.findall(r"(\d+) (passed|failed|skipped|error|errors|deselected)", last)}


def check_pytest(target):
    """Return (ok, message)."""
    py = [sys.executable, "-m", "pytest", target, "-q", "-x", "--no-header", "-p", "no:cacheprovider"]
    code, out, secs_ref = run(py, {"LAB_DIR": "reference"})
    ref = counts(out)
    if code != 0 and code != 5:
        return False, f"REFERENCE FAILS ({ref or out.strip()[-300:]})"
    if ref.get("passed", 0) == 0:
        return True, f"all skipped ({ref}); nothing verified here"
    py = [sys.executable, "-m", "pytest", target, "-q", "--no-header", "-p", "no:cacheprovider"]
    code, out, secs_st = run(py)
    st = counts(out)
    if code == 0:
        return False, f"STARTER ALREADY PASSES ({st})"
    bad = st.get("failed", 0) + st.get("error", 0) + st.get("errors", 0)
    return True, f"reference {ref.get('passed', 0)} passed{', ' + str(ref['skipped']) + ' skipped' if ref.get('skipped') else ''} in {secs_ref:.0f}s; starter fails {bad}, passes {st.get('passed', 0)}"


def check_shell(script):
    code, out, secs = run(["bash", script])
    return code == 0, (out.strip().splitlines() or [""])[-1] + f" ({secs:.0f}s)"


def check_capstone(module):
    """Capstone labs: the reference workspace must pass every checker step and the starter workspace must fail."""
    import importlib.util
    import json
    import shutil
    import tempfile
    lab = LABS / module
    code, out, _ = run([sys.executable, str(lab / "fetch_data.py")])
    if code != 0:
        return True, "skipped: the input data could not be downloaded (offline?); nothing verified here"
    spec = importlib.util.spec_from_file_location("capstone_check", lab / "check.py")
    chk = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(chk)
    with tempfile.TemporaryDirectory() as tmp:
        ref, st = Path(tmp) / "reference", Path(tmp) / "starter"
        main_py = "stream_processor.py" if (lab / "reference" / "stream_processor.py").is_file() else "pipeline.py"
        for ws, src in ((ref, lab / "reference" / main_py), (st, lab / "starter" / main_py)):
            ws.mkdir()
            shutil.copy(src, ws / main_py)
        (ref / "profile.json").write_text(json.dumps(chk.truth()["profile"]))
        (st / "profile.json").write_text("{}")
        code, out, secs = run([sys.executable, str(lab / "check.py"), str(ref), "--step", "all"])
        last = [l for l in out.strip().splitlines() if "passed" in l][-1:] or [out.strip()[-200:]]
        if code != 0:
            return False, f"REFERENCE FAILS the checker ({last[0]})"
        code2, out2, _ = run([sys.executable, str(lab / "check.py"), str(st), "--step", "all"])
        if code2 == 0:
            return False, "STARTER ALREADY PASSES the checker"
        fails = sum(1 for l in out2.splitlines() if l.startswith("FAIL"))
        return True, f"reference: {last[0].strip()} in {secs:.0f}s; starter fails {fails} checks"


def main(argv):
    wanted = [a for a in argv if not a.startswith("-")]
    if "--list" in argv:
        for m, (_, t) in PLAN.items():
            print(m, *t)
        return 0
    failed = 0
    for module, (kind, targets) in PLAN.items():
        if wanted and module not in wanted:
            continue
        for t in targets:
            ok, msg = check_capstone(module) if kind == "capstone" else check_shell(t) if t.endswith(".sh") else check_pytest(t)
            failed += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {module}  {Path(t).name:<24} {msg}", flush=True)
    print("\n" + ("all labs verified" if not failed else f"{failed} lab check(s) FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
