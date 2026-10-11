#!/usr/bin/env python3
"""Run a lab's checks on YOUR computer and print a short proof code for the DataForge app.

    python3 scripts/prove.py mod-0-1
    python3 scripts/prove.py mod-0-2 ~/kopiku        (Lab 0.2 needs the path of your workspace)

It runs the same tests as the lab. Only when every test passes (none skipped) does it print a code like

    DF1:mod-0-1:8:v:3.12:linux:3f9a1c2e:b04d77a1:5c1e9b

Paste the code into the lab page of the app. The app checks that the tests are the course's real tests, that your work is
not the reference solution, and (for Lab 0.1) that you ran it inside a virtual environment.

This is an HONESTY check, not security: anyone can read this script. It exists so that "I did the lab myself" is
something you state with evidence, for your own benefit. Standard library only (Python 3.8+).
"""
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "labs" / "proof.json"
VERSION = "DF1"


def norm(text):
    """Same rules as scripts/build-curriculum.js: LF line ends, no trailing spaces, no leading/trailing blank lines."""
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n")).strip()


def hash_texts(texts):
    return hashlib.sha256("\n--FILE--\n".join(norm(t) for t in texts).encode("utf-8")).hexdigest()[:8]


def read(path):
    return Path(path).read_text(encoding="utf-8")


def resolve(spec, args):
    """Replace {arg0} in a path from proof.json; relative paths are inside the course folder."""
    if "{arg0}" in spec:
        if not args:
            raise SystemExit("This lab needs the path of your workspace, for example:  python3 scripts/prove.py mod-0-2 ~/kopiku")
        spec = spec.replace("{arg0}", os.path.expanduser(args[0]))
    p = Path(spec)
    return p if p.is_absolute() else ROOT / p


def tests_hash(cfg):
    shared = sorted((ROOT / "labs" / "shared").glob("*.py"))
    return hash_texts([read(ROOT / t) for t in cfg["tests"]] + [read(p) for p in shared])


def static_hashes(cfg, root=ROOT):
    """Hashes of the course's own files (used by the app to recognise stale tests, untouched starters and copied solutions)."""
    starter_paths = cfg.get("starter") or cfg["work"]
    starter = hash_texts([read(root / p) for p in starter_paths])
    ref_texts = []
    for i, r in enumerate(cfg["reference"]):
        ref_texts.append(read(root / (r if r else starter_paths[i])))
    return {"tests": tests_hash(cfg), "starter": starter, "reference": hash_texts(ref_texts)}


def run(cmd, label):
    print(f"\n$ {label}")
    p = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, env=os.environ.copy())
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def tail(text, n=40):
    lines = text.rstrip().split("\n")
    return "\n".join(lines[-n:])


def main(argv):
    if argv and argv[0] == "--hashes":  # for the course's own consistency tests
        cfgs = json.loads(CONFIG.read_text(encoding="utf-8"))
        print(json.dumps({m: static_hashes(c) for m, c in cfgs.items()}, indent=1))
        return 0
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    mod, args = argv[0], argv[1:]
    cfgs = json.loads(CONFIG.read_text(encoding="utf-8"))
    if mod not in cfgs:
        print(f"Unknown module '{mod}'. Known: {', '.join(cfgs)}")
        return 2
    cfg = cfgs[mod]
    if os.environ.get("LAB_DIR"):
        print("LAB_DIR is set, which makes the tests run against the REFERENCE solution. Run `unset LAB_DIR` and try again.")
        return 2

    passed = 0
    for step in cfg["run"]:
        env_name = step.get("needs_env")
        if env_name and not os.environ.get(env_name):
            print(f"This part needs a running service: set {env_name} first (see the lab steps), then run this command again.")
            return 1
        if step["kind"] == "pytest":
            try:
                import pytest  # noqa: F401
            except ImportError:
                print("pytest is not installed in this Python. Activate your virtual environment and run:  pip install pytest")
                return 1
            cmd = [sys.executable, "-m", "pytest", *step["targets"], "-q", "-p", "no:cacheprovider", "--no-header", "--color=no", "-rs"]
            code, out = run(cmd, "pytest " + " ".join(step["targets"]))
            m = {k: int(n) for n, k in re.findall(r"(\d+) (passed|failed|skipped|errors?)", out.strip().split("\n")[-1])}
            n_pass, n_skip = m.get("passed", 0), m.get("skipped", 0)
            if code != 0 or n_pass == 0:
                print(tail(out))
                print("\nNot yet: some tests fail. Fix your code and run this command again. (No proof code is printed until every test passes.)")
                return 1
            if n_skip:
                print(tail(out))
                print(f"\n{n_skip} test(s) were SKIPPED (usually a missing tool such as Java or Terraform, or a service that is not running). "
                      "A proof needs every test to run: install what the skip message asks for and run again.")
                return 1
            passed += n_pass
            print(f"  {n_pass} passed")
        else:
            script = step["script"]
            sargs = [resolve(a, args).as_posix() if "{arg0}" in a else a for a in step.get("args", [])]
            code, out = run([sys.executable, str(ROOT / script), *sargs], f"python3 {script} {' '.join(sargs)}".strip())
            n_pass = len(re.findall(r"^PASS", out, flags=re.M))
            if code != 0 or n_pass == 0 or re.search(r"^FAIL", out, flags=re.M):
                print(tail(out))
                print("\nNot yet: the checker reports problems. Fix them and run this command again.")
                return 1
            passed += n_pass
            print(f"  {n_pass} checks passed")

    try:
        work = hash_texts([read(resolve(p, args)) for p in cfg["work"]])
    except FileNotFoundError as e:
        print(f"Cannot find your work file: {e.filename}")
        return 1
    in_venv = sys.prefix != getattr(sys, "base_prefix", sys.prefix)
    venv = "v" if in_venv else ("c" if os.environ.get("CONDA_PREFIX") else "n")
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    osname = platform.system().lower() or "unknown"
    fields = [VERSION, mod, str(passed), venv, py, osname, tests_hash(cfg), work]
    chk = hashlib.sha256(("|".join(fields)).encode("utf-8")).hexdigest()[:6]
    code_str = ":".join(fields + [chk])
    print("\n" + "=" * 72)
    print("All checks passed on your computer.\n")
    print("Your proof code (paste it into the lab page of the DataForge app):\n")
    print("    " + code_str + "\n")
    if venv == "n":
        print("Note: you are not inside a virtual environment. Lab 0.1 requires one (Module 0.2 shows how).")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
