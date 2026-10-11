#!/usr/bin/env bash
# Installs the Python dependencies of every lab so the whole course works in a Codespace.
# Spark, Kafka and Docker-based parts have their own notes in the lab instructions.
set -u
python -m pip install --upgrade pip
for req in labs/*/requirements.txt labs/*/*/requirements.txt; do
  [ -f "$req" ] || continue
  echo "== $req"
  python -m pip install -r "$req" || echo "WARNING: could not install $req (install it later when you reach that module)"
done
python3 labs/shared/shopgen.py --out data >/dev/null 2>&1 && echo "KopiKu sample data created in ./data"
echo "Ready. Start with Module 0.1. To run the site: python3 server.py"
