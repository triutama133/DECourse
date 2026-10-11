#!/usr/bin/env bash
# Builds the finished Lab 0.2 workspace, the way a careful learner would. Usage: make_workspace.sh <dir>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SHARED="$HERE/../../shared"
DIR="$1"
mkdir -p "$DIR" && cd "$DIR"

git init -q
git config user.name "Lab Learner"; git config user.email "learner@example.com"
python3 -m venv venv
printf 'venv/\n.env\ndata/\n__pycache__/\n' > .gitignore
git add .gitignore
git commit -q -m "Start project with a .gitignore"

cp "$SHARED/shopgen.py" .
python3 shopgen.py --out data > /dev/null
cp "$HERE/summarize.py" .
git add shopgen.py summarize.py
git commit -q -m "Add script that counts orders by status"

./venv/bin/python -m pip freeze > requirements.txt
git add requirements.txt
git commit -q -m "Record dependencies in requirements.txt"
