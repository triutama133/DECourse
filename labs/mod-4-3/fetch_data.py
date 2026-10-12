#!/usr/bin/env python3
"""Generate / verify the seed stream dataset of Capstone 4.3 in labs/mod-4-3/data/.

    python3 labs/mod-4-3/fetch_data.py

Data: 1,000 realistic fleet telemetry events containing out-of-order network jitter,
simulating IoT / cellular stream delivery in dense urban areas.
Verified with SHA-256 so every student and CI suite works against identical bytes.
Standard library only.
"""
import hashlib
import json
import random
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
TARGET = DATA / "events_seed.jsonl"
EXPECTED_SHA256 = "e7132eb63092c5146c25fc2d83f858895070c63282f94075f137908088ec3cfb"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def generate_seed():
    rng = random.Random(42)
    t0 = 1704067200
    events = []
    current_time = t0

    for i in range(1000):
        jitter = rng.randint(-45, 120)
        event_time = max(t0, current_time + jitter)
        current_time = max(current_time, event_time - 30)

        vehicle_id = f"taxi_{rng.randint(1, 50):02d}"
        zone_id = rng.choice([161, 237, 236, 142, 162, 138, 186, 230, 48, 68])
        fare = round(rng.uniform(5.0, 65.0), 2)
        dist = round(rng.uniform(0.5, 12.0), 2)
        passengers = rng.choice([1, 1, 1, 2, 2, 3, 4])

        events.append({
            "event_id": f"evt_{i+1:04d}",
            "vehicle_id": vehicle_id,
            "event_time": event_time,
            "zone_id": zone_id,
            "fare_amount": fare,
            "trip_distance": dist,
            "passenger_count": passengers
        })

    DATA.mkdir(parents=True, exist_ok=True)
    with open(TARGET, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    if TARGET.is_file() and sha256(TARGET) == EXPECTED_SHA256:
        print(f"ok       events_seed.jsonl (already present, hash matches)")
        return 0

    print("generating events_seed.jsonl ...", flush=True)
    generate_seed()
    if sha256(TARGET) != EXPECTED_SHA256:
        print("FAILED   hash mismatch after generation!", file=sys.stderr)
        return 1

    print("ok       events_seed.jsonl")
    return 0


if __name__ == "__main__":
    sys.exit(main())

