"""Deterministic warehouse query log for the FinOps lab (module 3.4). Standard library only.

Three teams share one warehouse for 30 days. One analyst's query runs for 11 hours on a Saturday night: the runaway.
"""
import datetime as dt
import random

TEAMS = {"marketing": ["dewi", "agus"], "finance": ["sari"], "data-eng": ["airflow"]}


def generate(seed=7, days=30, first_day=dt.date(2026, 1, 1)):
    """Return a list of dicts sorted by start: query_id, user, tag, start (datetime), seconds, bytes_scanned."""
    rng = random.Random(seed)
    log = []
    n = 0

    def add(user, tag, start, seconds, gb):
        nonlocal n
        n += 1
        log.append({"query_id": f"q-{n:05d}", "user": user, "tag": tag, "start": start,
                    "seconds": round(seconds, 1), "bytes_scanned": int(gb * 1e9)})

    for d in range(days):
        day = dt.datetime.combine(first_day + dt.timedelta(days=d), dt.time())
        weekend = day.weekday() >= 5
        for _ in range(8 if weekend else rng.randint(70, 110)):
            tag = rng.choice(["marketing", "marketing", "finance"])
            user = rng.choice(TEAMS[tag])
            start = day + dt.timedelta(hours=8, seconds=rng.randint(0, 10 * 3600))
            add(user, tag, start, rng.uniform(2, 40), rng.uniform(0.1, 5))
        add("airflow", "data-eng", day + dt.timedelta(hours=2), rng.uniform(900, 1500), rng.uniform(150, 250))
    # the runaway: a cross join started on Friday night, running 11 hours over the weekend
    add("dewi", "marketing", dt.datetime(2026, 1, 16, 22, 30), 11 * 3600, 40_000)
    log.sort(key=lambda q: q["start"])
    for q in log:
        if q["seconds"] == 11 * 3600:
            q["query_id"] = "q-runaway"
    return log
