"""Runs pytest inside Pyodide for the 'Run in your browser' labs. Loaded by pyodide-worker.js and scripts/verify_browser_labs.js."""
import contextlib
import importlib
import io
import os
import shutil
import sys

ROOT = "/lab"


def reset():
    os.chdir("/")
    shutil.rmtree(ROOT, ignore_errors=True)
    os.makedirs(ROOT, exist_ok=True)


def run_lab(args):
    os.chdir(ROOT)
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)
    # a second run must see the learner's NEW code, not modules cached from the previous run
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None)
        if isinstance(f, str) and f.startswith(ROOT + "/"):
            del sys.modules[name]
    importlib.invalidate_caches()
    import pytest

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        code = pytest.main(list(args))
    return buf.getvalue(), int(code)
