#!/usr/bin/env bash
# Course CI: the reference workspace must pass check.py, and an empty folder must fail it.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
bash "$HERE/reference/make_workspace.sh" "$TMP/ok" >/dev/null
python3 "$HERE/check.py" "$TMP/ok" >/dev/null || { echo "reference workspace FAILED check.py"; python3 "$HERE/check.py" "$TMP/ok"; exit 1; }
mkdir "$TMP/empty"
if python3 "$HERE/check.py" "$TMP/empty" >/dev/null 2>&1; then echo "empty folder unexpectedly PASSED check.py"; exit 1; fi
# a workspace that leaks a secret must fail
cp -r "$TMP/ok" "$TMP/leak"; cd "$TMP/leak"; echo "API_KEY=abc123" > .env; git add -f .env; git commit -q -m "Oops add config file"
if python3 "$HERE/check.py" "$TMP/leak" >/dev/null 2>&1; then echo "leaky workspace unexpectedly PASSED"; exit 1; fi
echo "mod-0-2 verified: reference passes; empty and leaky workspaces fail"
