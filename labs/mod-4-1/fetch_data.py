#!/usr/bin/env python3
"""Download the two input files of Capstone 4.1 into labs/mod-4-1/data/ and check that they are exactly the files the checker expects.

    python3 labs/mod-4-1/fetch_data.py

Data: NYC Taxi and Limousine Commission (TLC) Yellow Taxi trip records for January 2024 (about 50 MB, 2,964,624 trips) and the TLC taxi zone
lookup table. Source page: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page  (public data published by the City of New York).
The files are checked against a SHA-256 hash, so everybody works on identical data. Standard library only.
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

BASE = "https://d37ci6vzurychx.cloudfront.net"
DATA = Path(__file__).resolve().parent / "data"
FILES = {
    "yellow_tripdata_2024-01.parquet": (f"{BASE}/trip-data/yellow_tripdata_2024-01.parquet",
                                        "c4d59da7bbc8abaeeeb1727947ee93d9891a71acb42854bd80db1571b2030510"),
    "taxi_zone_lookup.csv": (f"{BASE}/misc/taxi_zone_lookup.csv",
                             "1a99e105092230f8620f301edcca7f80d3080642ff404d28ed957d3fa222c8ed"),
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
            print(f"ok       {name} (already downloaded, hash matches)")
            continue
        print(f"download {name} ...", flush=True)
        tmp = target.with_suffix(target.suffix + ".part")
        try:
            urllib.request.urlretrieve(url, tmp)
        except Exception as e:  # network problems, proxies ...
            print(f"FAILED   {name}: {e}\n         Download it yourself from {url} and save it as {target}")
            ok = False
            continue
        if sha256(tmp) != digest:
            tmp.unlink()
            print(f"FAILED   {name}: the downloaded file does not match the expected hash (the publisher changed it?). Ask in the course issues.")
            ok = False
            continue
        tmp.replace(target)
        print(f"ok       {name}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
