"""Tests for Lab 1.1.   python labs/mod-1-1/test_lab.py -v

Part A runs report.sh on generated data and compares it with an independent Python count.
Part B checks the Dockerfile against good practices (static checks: Docker itself is not needed).
"""
import json
import re
import subprocess
import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

LAB = labtools.lab_dir(__file__)
DATA, MANIFEST = labtools.shop_data()


def expected_report(path):
    lines_total = malformed = 0
    ids, users, types = set(), set(), {}
    for line in Path(path).read_text().splitlines():
        lines_total += 1
        try:
            ev = json.loads(line)
            assert isinstance(ev, dict)
        except (ValueError, AssertionError):
            malformed += 1
            continue
        ids.add(ev["event_id"])
        types[ev["event_id"]] = ev["event_type"]
        if ev.get("user_id") is not None:
            users.add(ev["user_id"])
    out = [f"lines_total={lines_total}", f"malformed_lines={malformed}",
           f"valid_events={lines_total - malformed}", f"unique_event_ids={len(ids)}", f"distinct_users={len(users)}"]
    for t, n in sorted(Counter(types.values()).items()):
        out.append(f"type.{t}={n}")
    return out


class TestReportScript(unittest.TestCase):
    def run_report(self, path):
        return subprocess.run(["bash", str(LAB / "report.sh"), str(path)], capture_output=True, text=True)

    def test_report_matches_ground_truth(self):
        res = self.run_report(DATA / "events.ndjson")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(res.stdout.strip().splitlines(), expected_report(DATA / "events.ndjson"))

    def test_fails_loudly_without_argument(self):
        res = subprocess.run(["bash", str(LAB / "report.sh")], capture_output=True, text=True)
        self.assertNotEqual(res.returncode, 0)

    def test_fails_on_missing_file(self):
        res = self.run_report(DATA / "does-not-exist.ndjson")
        self.assertNotEqual(res.returncode, 0)

    def test_script_declares_strict_mode_and_cleans_up(self):
        text = (LAB / "report.sh").read_text()
        self.assertRegex(text, r"set -[a-z]*e[a-z]*u[a-z]*o pipefail|set -euo pipefail", "use `set -euo pipefail`")
        if "mktemp" in text:
            self.assertIn("trap", text, "temporary files must be removed with trap")

    def test_handles_a_tiny_hand_made_file(self):
        tiny = DATA / "tiny.ndjson"
        tiny.write_text('{"event_id":"a","user_id":1,"event_type":"x"}\n'
                        '{"event_id":"a","user_id":1,"event_type":"x"}\n'
                        'not json\n'
                        '{"event_id":"b","user_id":null,"event_type":"y"}\n')
        res = self.run_report(tiny)
        self.assertEqual(res.stdout.strip().splitlines(), expected_report(tiny))


class TestDockerfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.df = (LAB / "Dockerfile").read_text()
        cls.lines = [l.strip() for l in cls.df.splitlines() if l.strip() and not l.strip().startswith("#")]
        ignore = LAB / ".dockerignore"
        cls.ignore = {l.strip().rstrip("/") for l in ignore.read_text().splitlines() if l.strip() and not l.startswith("#")} if ignore.exists() else set()

    def first(self, pattern):
        for i, l in enumerate(self.lines):
            if re.match(pattern, l, re.I):
                return i
        return None

    def test_base_image_is_pinned_and_small(self):
        m = re.match(r"FROM\s+(\S+)", self.lines[0], re.I)
        self.assertTrue(m, "first instruction must be FROM")
        image = m.group(1)
        self.assertIn(":", image, "pin a tag, e.g. python:3.12-slim")
        self.assertNotIn(":latest", image, "never use :latest, builds must be reproducible")
        self.assertRegex(image, r"slim|alpine", "prefer a slim base image")

    def test_has_workdir(self):
        self.assertIsNotNone(self.first(r"WORKDIR\s"))

    def test_dependencies_are_installed_before_code_is_copied(self):
        req = self.first(r"COPY\s.*requirements\.txt")
        install = self.first(r"RUN\s.*pip install")
        code = next((i for i, l in enumerate(self.lines) if re.match(r"COPY\s", l, re.I) and "requirements" not in l), None)
        self.assertIsNotNone(req, "COPY requirements.txt on its own first")
        self.assertIsNotNone(install)
        self.assertIsNotNone(code, "then COPY your code")
        self.assertTrue(req < install < code, "order: COPY requirements.txt, RUN pip install, then COPY the code (layer cache)")

    def test_pip_does_not_keep_a_cache(self):
        self.assertTrue("--no-cache-dir" in self.df or "PIP_NO_CACHE_DIR" in self.df)

    def test_does_not_run_as_root(self):
        users = [l for l in self.lines if re.match(r"USER\s", l, re.I)]
        self.assertTrue(users, "add a USER instruction")
        self.assertNotIn(users[-1].split()[1], ("root", "0"))

    def test_command_uses_exec_form(self):
        cmds = [l for l in self.lines if re.match(r"(CMD|ENTRYPOINT)\s", l, re.I)]
        self.assertTrue(cmds)
        for l in cmds:
            self.assertRegex(l, r"^(CMD|ENTRYPOINT)\s+\[", "use the JSON (exec) form so signals reach your program")

    def test_dockerignore_keeps_junk_and_secrets_out(self):
        for needed in ("venv", "data", ".git", ".env"):
            self.assertIn(needed, self.ignore, f".dockerignore should list {needed}")

    def test_no_secrets_baked_in(self):
        self.assertNotRegex(self.df, r"(?i)(password|secret|api[_-]?key)\s*=")


if __name__ == "__main__":
    unittest.main()
