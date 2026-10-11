"""Lab 3.4 part B: FinOps functions. Pure Python; tests in test_finops.py.   pytest labs/mod-3-4/test_finops.py -v

A query is a dict with: query_id, user, tag (the team that pays), start (datetime), seconds, bytes_scanned.
"""
import datetime as dt
import statistics


def query_cost(seconds, credits_per_hour=1.0, price_per_credit=3.0):
    """Cost of keeping a warehouse busy for `seconds`: seconds/3600 * credits_per_hour * price_per_credit."""
    raise NotImplementedError


def billed_seconds(queries, auto_suspend_s, minimum_s=60):
    """Seconds a single warehouse is billed for, given (start_s, duration_s) pairs (start in seconds on any clock).

    The warehouse wakes for a query and stays up until the last running query ends PLUS auto_suspend_s.
    A query that starts before the warehouse suspends joins the same run (overlapping queries share it).
    Every run (wake to suspend) is billed at least minimum_s. No queries -> 0.
    """
    raise NotImplementedError


def cost_by_tag(log, credits_per_hour=1.0, price_per_credit=3.0):
    """Sum query_cost over the log per tag; round each to 2 decimals; return a dict ordered from most to least expensive."""
    raise NotImplementedError


def find_runaway(log, factor=10):
    """query_ids whose seconds exceed `factor` times the MEDIAN seconds of their own tag, sorted by seconds descending."""
    raise NotImplementedError


def forecast_month(daily_costs, days_in_month, budget):
    """Forecast month-end spend from the days so far (day 1 is daily_costs[0]).

    forecast = spent so far + (mean of the last 7 days, or all days if fewer) * remaining days
    Return {"spent", "forecast", "over_budget" (forecast > budget), "breach_day"}, money rounded to 2 decimals.
    breach_day = first day number (1-based) on which the cumulative spend, extended by the same daily mean, exceeds the budget; None if it never does.
    """
    raise NotImplementedError


def storage_cost(objects, archive_after_days, std_price=0.023, archive_price=0.004, retrieved_gb=0, retrieval_price=0.03):
    """Monthly storage cost. `objects` are (size_gb, age_days). Objects at least archive_after_days old cost archive_price per GB, the rest std_price.

    Add retrieved_gb * retrieval_price for data read back from the archive tier. Round to 4 decimals.
    """
    raise NotImplementedError
