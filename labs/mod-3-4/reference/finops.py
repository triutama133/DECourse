"""Lab 3.4 part B: FinOps functions. Pure Python; tests in test_finops.py.   pytest labs/mod-3-4/test_finops.py -v

A query is a dict with: query_id, user, tag (the team that pays), start (datetime), seconds, bytes_scanned.
"""
import statistics
from collections import defaultdict


def query_cost(seconds, credits_per_hour=1.0, price_per_credit=3.0):
    return seconds / 3600 * credits_per_hour * price_per_credit


def billed_seconds(queries, auto_suspend_s, minimum_s=60):
    if not queries:
        return 0
    billed = 0
    ordered = sorted(queries)
    run_start = ordered[0][0]
    run_end = run_start + ordered[0][1]
    for start, duration in ordered[1:]:
        if start <= run_end + auto_suspend_s:  # still awake: the query joins this run
            run_end = max(run_end, start + duration)
        else:
            billed += max(minimum_s, run_end - run_start + auto_suspend_s)
            run_start, run_end = start, start + duration
    return billed + max(minimum_s, run_end - run_start + auto_suspend_s)


def cost_by_tag(log, credits_per_hour=1.0, price_per_credit=3.0):
    totals = defaultdict(float)
    for q in log:
        totals[q["tag"]] += query_cost(q["seconds"], credits_per_hour, price_per_credit)
    return dict(sorted(((t, round(c, 2)) for t, c in totals.items()), key=lambda kv: -kv[1]))


def find_runaway(log, factor=10):
    by_tag = defaultdict(list)
    for q in log:
        by_tag[q["tag"]].append(q["seconds"])
    median = {tag: statistics.median(v) for tag, v in by_tag.items()}
    flagged = [q for q in log if q["seconds"] > factor * median[q["tag"]]]
    return [q["query_id"] for q in sorted(flagged, key=lambda q: -q["seconds"])]


def forecast_month(daily_costs, days_in_month, budget):
    days = len(daily_costs)
    spent = sum(daily_costs)
    recent = daily_costs[-7:]
    daily = sum(recent) / len(recent)
    forecast = spent + daily * (days_in_month - days)
    breach = None
    cumulative = 0.0
    for day in range(1, days_in_month + 1):
        cumulative += daily_costs[day - 1] if day <= days else daily
        if cumulative > budget:
            breach = day
            break
    return {"spent": round(spent, 2), "forecast": round(forecast, 2), "over_budget": forecast > budget, "breach_day": breach}


def storage_cost(objects, archive_after_days, std_price=0.023, archive_price=0.004, retrieved_gb=0, retrieval_price=0.03):
    total = sum(size * (archive_price if age >= archive_after_days else std_price) for size, age in objects)
    return round(total + retrieved_gb * retrieval_price, 4)
