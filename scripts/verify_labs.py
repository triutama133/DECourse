#!/usr/bin/env python3
"""Course CI: prove that every lab is solvable and that no starter is already solved.

For each lab:
  1. the REFERENCE solution must pass all its tests          (LAB_DIR=reference)
  2. the STARTER (what the learner receives) must fail some
  3. ...and fail for the right reason: "not done yet" (an assertion, NotImplementedError, a TODO), never
     "the starter itself is broken" (a SyntaxError, an import that cannot work, a dbt compile error).
     Before this check, the Lab 2.3 starter did not compile for three months: its tests failed, so step 2
     was satisfied, and every learner's first `dbt run` failed for a reason that was not theirs.

Usage:
    python3 scripts/verify_labs.py                  # everything installed on this machine
    python3 scripts/verify_labs.py mod-2-3 mod-3-5  # only some modules
    python3 scripts/verify_labs.py --list
    python3 scripts/verify_labs.py --self-test       # the broken-starter rules, without running any lab

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
    "mod-0-0": ("pytest", ["labs/mod-0-0/test_practice.py", "labs/mod-0-0/test_lab.py"]),
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
    "mod-4-4": ("capstone", ["labs/mod-4-4/check.py"]),
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


# Errors that mean the starter cannot run at all. The reference has already passed in the same Python with the
# same packages, so none of these can be a missing package: they come from the starter files themselves.
BROKEN = re.compile(r"\b(SyntaxError|IndentationError|TabError|ModuleNotFoundError|ImportError|cannot import name"
                    r"|Compilation Error|Parsing Error|TemplateSyntaxError|jinja2\.exceptions)\b")


def proof_config():
    import json
    try:
        return json.loads((LABS / "proof.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def starter_static(module):
    """Every file the learner is handed must at least parse: Python compiles, and no dbt SQL file hides a Jinja tag
    inside a -- comment (dbt renders Jinja before SQL, so the comment does not protect it)."""
    files = set()
    for rel in proof_config().get(module, {}).get("work", []):
        if "{arg0}" not in rel:
            files.add(ROOT / rel)
    files.update(p for p in (LABS / module).glob("starter/**/*") if p.is_file())
    problems = []
    for path in sorted(files):
        if not path.exists():
            continue
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8", errors="replace")
        if path.suffix == ".py":
            try:
                compile(text, str(rel), "exec")
            except SyntaxError as e:
                problems.append(f"{rel}:{e.lineno}: {e.msg}")
        elif path.suffix == ".sql" and "dbt" in str(rel):
            for i, line in enumerate(text.splitlines(), 1):
                comment = line.split("--", 1)[1] if "--" in line else ""
                if re.search(r"\{%|\{#", comment):
                    problems.append(f"{rel}:{i}: Jinja tag inside a -- comment (dbt still renders it)")
    return problems


def broken_in_junit(xml_path):
    """Starter tests that fail because the starter cannot run, read from pytest's JUnit XML report.
    Only the message and pytest's 'E ' lines are read, not the echoed test source, which may mention these words."""
    import xml.etree.ElementTree as ET
    try:
        root = ET.parse(xml_path).getroot()
    except (OSError, ET.ParseError):
        return []
    bad = []
    for tc in root.iter("testcase"):
        for el in (tc.find("failure"), tc.find("error")):
            if el is None:
                continue
            lines = (el.get("message") or "").splitlines() + [l[1:].strip() for l in (el.text or "").splitlines() if l.startswith("E ")]
            lines = [re.sub(r"\x1b\[[0-9;]*m|#x1B\[[0-9;]*m", "", l) for l in lines]   # dbt colours its log
            hit = next((l for l in lines if BROKEN.search(l)), None)
            if hit:
                bad.append(f"{tc.get('name') or tc.get('classname')}: {hit.strip()[:160]}")
    return bad


def broken_in_output(out):
    """For checkers that print instead of using pytest: a traceback with one of the BROKEN errors."""
    if "Traceback" not in out:
        return []
    return [l.strip()[:160] for l in out.splitlines() if BROKEN.search(l)][:3]


def check_pytest(target):
    """Return (ok, message)."""
    py = [sys.executable, "-m", "pytest", target, "-q", "-x", "--no-header", "-p", "no:cacheprovider"]
    code, out, secs_ref = run(py, {"LAB_DIR": "reference"})
    ref = counts(out)
    if code != 0 and code != 5:
        return False, f"REFERENCE FAILS ({ref or out.strip()[-300:]})"
    if ref.get("passed", 0) == 0:
        return True, f"all skipped ({ref}); nothing verified here"
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        xml = Path(tmp) / "starter.xml"
        py = [sys.executable, "-m", "pytest", target, "-q", "--no-header", "-p", "no:cacheprovider", f"--junitxml={xml}"]
        code, out, secs_st = run(py)
        broken = broken_in_junit(xml)
    st = counts(out)
    if code == 0:
        return False, f"STARTER ALREADY PASSES ({st})"
    if broken:
        return False, f"STARTER IS BROKEN, not just unfinished ({len(broken)} test(s)): " + " | ".join(broken[:3])
    bad = st.get("failed", 0) + st.get("error", 0) + st.get("errors", 0)
    return True, f"reference {ref.get('passed', 0)} passed{', ' + str(ref['skipped']) + ' skipped' if ref.get('skipped') else ''} in {secs_ref:.0f}s; starter fails {bad}, passes {st.get('passed', 0)}"


def check_shell(script):
    code, out, secs = run(["bash", script])
    msg = (out.strip().splitlines() or [""])[-1] + f" ({secs:.0f}s)"
    checker = ROOT / Path(script).parent / "check.py"
    if code == 0 and checker.exists() and "mod-0-2" not in script:
        _, st_out, _ = run([sys.executable, str(checker)])
        broken = broken_in_output(st_out)
        if broken:
            return False, "STARTER IS BROKEN: the checker crashes on the starter: " + " | ".join(broken)
    return code == 0, msg


def check_capstone(module):
    """Capstone labs: the reference workspace must pass every checker step and the starter workspace must fail."""
    import importlib.util
    import json
    import shutil
    import tempfile
    lab = LABS / module
    if module == "mod-4-4" and importlib.util.find_spec("airflow") is None:
        return True, "skipped: Apache Airflow is not installed in this Python (see labs/mod-4-4/requirements.txt); nothing verified here"
    code, out, _ = run([sys.executable, str(lab / "fetch_data.py")])
    if code != 0:
        return True, "skipped: the input data could not be downloaded (offline?); nothing verified here"
    spec = importlib.util.spec_from_file_location("capstone_check", lab / "check.py")
    chk = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(chk)
    with tempfile.TemporaryDirectory() as tmp:
        ref, st = Path(tmp) / "reference", Path(tmp) / "starter"
        main_py = sorted(p.name for p in (lab / "reference").glob("*.py"))[0]
        for ws, src in ((ref, lab / "reference" / main_py), (st, lab / "starter" / main_py)):
            ws.mkdir()
            shutil.copy(src, ws / main_py)
        profile = chk.profile_truth() if hasattr(chk, "profile_truth") else chk.truth()["profile"]
        (ref / "profile.json").write_text(json.dumps(profile))
        (st / "profile.json").write_text("{}")
        code, out, secs = run([sys.executable, str(lab / "check.py"), str(ref), "--step", "all"])
        last = [l for l in out.strip().splitlines() if "passed" in l][-1:] or [out.strip()[-200:]]
        if code != 0:
            return False, f"REFERENCE FAILS the checker ({last[0]})"
        code2, out2, _ = run([sys.executable, str(lab / "check.py"), str(st), "--step", "all"])
        if code2 == 0:
            return False, "STARTER ALREADY PASSES the checker"
        broken = broken_in_output(out2)
        if broken:
            return False, "STARTER IS BROKEN: " + " | ".join(broken)
        fails = sum(1 for l in out2.splitlines() if l.startswith("FAIL"))
        return True, f"reference: {last[0].strip()} in {secs:.0f}s; starter fails {fails} checks"


def self_test():
    """The broken-starter rules on made-up inputs, without running any lab."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        xml = Path(tmp) / "r.xml"
        xml.write_text("""<testsuites><testsuite>
<testcase classname="t" name="test_todo"><failure message="NotImplementedError: TODO">E   NotImplementedError: TODO</failure></testcase>
<testcase classname="t" name="test_assert"><failure message="AssertionError: assert 0 == 3">source mentions SyntaxError here
E   AssertionError: assert 0 == 3</failure></testcase>
<testcase classname="t" name="test_build"><failure message="AssertionError: dbt build failed&#10;#x1B[0m09:11:08  Running with dbt=1.12.7&#10;Compilation Error in model fct_daily_revenue">x</failure></testcase>
<testcase classname="labs.mod-0-1.test_lab" name=""><error message="collection failure">E   ModuleNotFoundError: No module named 'helpers'</error></testcase>
</testsuite></testsuites>""")
        bad = broken_in_junit(xml)
        assert len(bad) == 2, bad
        assert "Compilation Error in model fct_daily_revenue" in bad[0] and "#x1B" not in bad[0], bad[0]
        assert "ModuleNotFoundError" in bad[1], bad[1]
    assert broken_in_output("TODO  k-1: no query written yet\n0/10 answers correct") == []
    assert broken_in_output("Traceback (most recent call last):\n  File x\nSyntaxError: invalid syntax")
    # the static rule on a dbt model: {{ ref() }} in a comment is fine, {% %} is not
    lines = ["-- built from {{ ref('stg_orders') }}", "-- careful with the {% if is_incremental() %} block"]
    hits = [i for i, l in enumerate(lines, 1) if re.search(r"\{%|\{#", l.split("--", 1)[1])]
    assert hits == [2], hits
    assert all(starter_static(m) == [] for m in PLAN), [m for m in PLAN if starter_static(m)]
    print("SELF_TEST_VERIFY_LABS_OK")
    return 0


def main(argv):
    if "--self-test" in argv:
        return self_test()
    wanted = [a for a in argv if not a.startswith("-")]
    if "--list" in argv:
        for m, (_, t) in PLAN.items():
            print(m, *t)
        return 0
    failed = 0
    for module, (kind, targets) in PLAN.items():
        if wanted and module not in wanted:
            continue
        static = starter_static(module)
        if static:
            failed += 1
            print(f"FAIL {module}  {'starter files':<24} STARTER DOES NOT PARSE: " + " | ".join(static[:3]), flush=True)
        for t in targets:
            ok, msg = check_capstone(module) if kind == "capstone" else check_shell(t) if t.endswith(".sh") else check_pytest(t)
            failed += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {module}  {Path(t).name:<24} {msg}", flush=True)
    print("\n" + ("all labs verified" if not failed else f"{failed} lab check(s) FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
