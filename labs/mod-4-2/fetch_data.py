#!/usr/bin/env python3
"""Download the seed dataset of Capstone 4.2 into labs/mod-4-2/data/ and check that it matches the expected SHA-256 hash.

    python3 labs/mod-4-2/fetch_data.py

Data: Real seismic event data from the USGS (United States Geological Survey) Earthquake Hazards Program API
(January 1-8, 2024, min magnitude 2.5, public domain).
The file is verified with SHA-256 so every learner and automated test suite works against identical bytes.
Standard library only.
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
FILES = {
    "earthquakes_seed.json": (
        "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2024-01-08&minmagnitude=2.5",
        "4ff012b3809f5b1eeb8a8d3dee444926fbda2ed924d099c36d643f2d895297a7",
    )
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    ok = True
    for name, (url, digest) in FILES.items():
        target = DATA / name
        if target.exists() and sha256(target) == digest:
            print(f"ok       {name} (already present, hash matches)")
            continue
        print(f"download {name} ...", flush=True)
        tmp = target.with_suffix(target.suffix + ".part")
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "DataForge-DE-Course/1.0 (Educational Capstone)"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp, open(tmp, "wb") as out:
                out.write(resp.read())
        except Exception as e:
            print(f"FAILED   {name}: {e}\n         Download it yourself from {url} and save it as {target}")
            ok = False
            continue
        if sha256(tmp) != digest:
            tmp.unlink()
            print(f"FAILED   {name}: hash mismatch. Expected {digest}")
            ok = False
            continue
        tmp.replace(target)
        print(f"ok       {name}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

