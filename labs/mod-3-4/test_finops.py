"""Tests for Lab 3.4 part B (FinOps).   pytest labs/mod-3-4/test_finops.py -v"""
import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402
import querylog  # noqa: E402

lab = labtools.load(__file__, "finops.py")
LOG = querylog.generate()


def q(qid, tag, seconds, user="u"):
    return {"query_id": qid, "user": user, "tag": tag, "start": dt.datetime(2026, 1, 1), "seconds": seconds, "bytes_scanned": 0}


class TestQueryCost:
    def test_one_hour_on_a_one_credit_warehouse(self):
        assert lab.query_cost(3600) == pytest.approx(3.0)

    def test_scales_with_size_price_and_time(self):
        assert lab.query_cost(1800, credits_per_hour=8, price_per_credit=2.5) == pytest.approx(10.0)
        assert lab.query_cost(0) == 0


class TestBilledSeconds:
    def test_no_queries_cost_nothing(self):
        assert lab.billed_seconds([], 300) == 0

    def test_a_single_query_pays_for_the_idle_tail(self):
        assert lab.billed_seconds([(0, 10)], 300) == 310

    def test_the_minimum_applies_to_every_run(self):
        assert lab.billed_seconds([(0, 5)], 0) == 60
        assert lab.billed_seconds([(0, 5), (10_000, 5)], 0) == 120

    def test_a_query_inside_the_suspend_window_shares_the_run(self):
        # wakes at 0, query 1 ends at 10, query 2 starts at 110 (< 10 + 300) and ends at 130; suspends at 430
        assert lab.billed_seconds([(0, 10), (110, 20)], 300) == 430

    def test_a_long_gap_starts_a_new_run(self):
        assert lab.billed_seconds([(0, 10), (1000, 20)], 300) == 310 + 320

    def test_overlapping_queries_are_not_double_counted(self):
        assert lab.billed_seconds([(0, 100), (10, 20), (50, 30)], 60) == 160

    def test_input_order_does_not_matter(self):
        assert lab.billed_seconds([(1000, 20), (0, 10)], 300) == 630

    def test_a_shorter_auto_suspend_bills_less_on_a_bursty_workload(self):
        runs = [(q_["start"].timestamp(), q_["seconds"]) for q_ in LOG if q_["tag"] != "data-eng"]
        assert lab.billed_seconds(runs, 60) < lab.billed_seconds(runs, 600) < lab.billed_seconds(runs, 3600)

    def test_never_bills_less_than_the_work_itself(self):
        runs = [(0, 100), (500, 100), (5000, 50)]
        assert lab.billed_seconds(runs, 0) >= 250


class TestCostByTag:
    def test_groups_and_orders_by_cost(self):
        log = [q("a", "marketing", 3600), q("b", "finance", 7200), q("c", "marketing", 1800)]
        assert lab.cost_by_tag(log) == {"finance": 6.0, "marketing": 4.5}
        assert list(lab.cost_by_tag(log)) == ["finance", "marketing"]

    def test_the_total_matches_the_log(self):
        by_tag = lab.cost_by_tag(LOG)
        assert sum(by_tag.values()) == pytest.approx(lab.query_cost(sum(x["seconds"] for x in LOG)), abs=0.05)
        assert set(by_tag) == {"marketing", "finance", "data-eng"}

    def test_the_runaway_dominates_marketing(self):
        by_tag = lab.cost_by_tag(LOG)
        assert next(iter(by_tag)) == "marketing"
        assert by_tag["marketing"] > 33  # 11 hours at $3 alone


class TestFindRunaway:
    def test_median_not_mean(self):
        # mean is 208, so a mean-based rule (1000 > 10 * 208?) would miss it; the median is 10
        log = [q(f"n{i}", "x", 10) for i in range(4)] + [q("big", "x", 1000)]
        assert lab.find_runaway(log) == ["big"]

    def test_each_tag_is_judged_against_its_own_normal(self):
        # 900 s is normal for the nightly job but huge for dashboards
        log = [q("n1", "data-eng", 900), q("n2", "data-eng", 950), q("n3", "data-eng", 1000),
               q("d1", "marketing", 10), q("d2", "marketing", 12), q("d3", "marketing", 11), q("d4", "marketing", 900)]
        assert lab.find_runaway(log) == ["d4"]

    def test_the_factor_is_configurable(self):
        log = [q("a", "x", 10), q("b", "x", 10), q("c", "x", 35)]
        assert lab.find_runaway(log, factor=10) == []
        assert lab.find_runaway(log, factor=3) == ["c"]

    def test_worst_first(self):
        log = [q("a", "x", 1), q("b", "x", 1), q("c", "x", 1), q("big", "x", 500), q("bigger", "x", 900)]
        assert lab.find_runaway(log) == ["bigger", "big"]

    def test_finds_exactly_the_weekend_query_in_the_log(self):
        assert lab.find_runaway(LOG) == ["q-runaway"]


class TestForecast:
    def test_flat_spend_projects_linearly(self):
        f = lab.forecast_month([100.0] * 10, 30, budget=2500)
        assert f == {"spent": 1000.0, "forecast": 3000.0, "over_budget": True, "breach_day": 26}

    def test_uses_the_last_seven_days_so_a_recent_spike_counts(self):
        costs = [10.0] * 10 + [100.0] * 7
        f = lab.forecast_month(costs, 30, budget=10_000)
        assert f["spent"] == 800.0
        assert f["forecast"] == 800.0 + 100.0 * 13

    def test_under_budget_has_no_breach_day(self):
        f = lab.forecast_month([10.0] * 5, 30, budget=1000)
        assert f["over_budget"] is False and f["breach_day"] is None and f["forecast"] == 300.0

    def test_an_already_blown_budget_reports_the_actual_day(self):
        f = lab.forecast_month([50.0, 50.0, 500.0, 10.0], 30, budget=400)
        assert f["breach_day"] == 3

    def test_fewer_than_seven_days_uses_what_exists(self):
        f = lab.forecast_month([10.0, 30.0], 4, budget=1000)
        assert f["forecast"] == 40.0 + 20.0 * 2


class TestStorageCost:
    OBJECTS = [(1000, 10), (1000, 100), (1000, 400)]

    def test_nothing_archived_pays_the_standard_rate(self):
        assert lab.storage_cost(self.OBJECTS, archive_after_days=10_000) == pytest.approx(3000 * 0.023)

    def test_old_objects_move_to_the_cheaper_tier(self):
        assert lab.storage_cost(self.OBJECTS, archive_after_days=90) == pytest.approx(1000 * 0.023 + 2000 * 0.004)

    def test_the_boundary_is_inclusive(self):
        assert lab.storage_cost([(100, 90)], 90) == pytest.approx(100 * 0.004)
        assert lab.storage_cost([(100, 89)], 90) == pytest.approx(100 * 0.023)

    def test_reading_data_back_costs_extra(self):
        base = lab.storage_cost(self.OBJECTS, 90)
        assert lab.storage_cost(self.OBJECTS, 90, retrieved_gb=500) == pytest.approx(base + 15.0)

    def test_archiving_hot_data_can_cost_more_than_it_saves(self):
        hot = [(1000, 100)]
        assert lab.storage_cost(hot, 90, retrieved_gb=1000) > lab.storage_cost(hot, 10_000)
