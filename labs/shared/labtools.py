"""Helpers shared by the lab tests. Standard library only.

Lab convention: you edit the files in labs/<module>/. The solution lives in
labs/<module>/reference/. Run the tests against your work normally, or against the
reference with LAB_DIR=reference (this is how the course proves every lab is solvable).
"""
import importlib.util
import os
import sys
import tempfile
from pathlib import Path

SHARED = Path(__file__).resolve().parent
sys.path.insert(0, str(SHARED))
import shopgen  # noqa: E402

_cache = {}


def lab_dir(test_file):
    base = Path(test_file).resolve().parent
    sub = os.environ.get("LAB_DIR")
    return base / sub if sub else base


def load(test_file, filename):
    """Import <lab dir>/<filename> as a module."""
    path = lab_dir(test_file) / filename
    if not path.exists():
        raise FileNotFoundError(f"{path} not found")
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[path.stem] = mod
    spec.loader.exec_module(mod)
    return mod


def shop_data(seed=42, customers=1000, days=30):
    """Generate the KopiKu dataset once per process and return (directory, manifest)."""
    key = (seed, customers, days)
    if key not in _cache:
        d = Path(tempfile.mkdtemp(prefix="kopiku_"))
        manifest = shopgen.build(d, seed, customers, days, "2026-01-01")
        _cache[key] = (d, manifest)
    return _cache[key]
