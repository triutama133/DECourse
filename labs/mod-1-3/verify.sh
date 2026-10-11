#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
python3 "$HERE/check.py" reference >/dev/null || { python3 "$HERE/check.py" reference; exit 1; }
if python3 "$HERE/check.py" >/dev/null 2>&1; then echo "starter answers.sql unexpectedly passed"; exit 1; fi
echo "mod-1-3 verified: reference passes all answers; the empty starter fails"
