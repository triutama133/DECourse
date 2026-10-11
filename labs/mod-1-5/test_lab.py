"""Tests for Lab 1.5.   pip install -r labs/mod-1-5/requirements.txt && pytest labs/mod-1-5/test_lab.py -v

Each group of tests builds its own input (from the known-correct rows of orders_data.py), so a mistake in one function does not make
the others fail. Some tests forbid row-by-row loops (apply, iterrows, itertuples): vectorise instead.
"""
import io
import sys
from pathlib import Path

import pytest

pd = pytest.importorskip("pandas")
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402
from orders_data import make_customers, make_orders  # noqa: E402

lab = labtools.load(__file__, "orders_lab.py")
CSV_TEXT, TRUTH = make_orders()


def truth_frame():
    df = pd.DataFrame(TRUTH)
    df["order_date"] = pd.to_datetime(df["order_date"])
    df["quantity"] = df["quantity"].astype("int64")
    return df


def customers_frame():
    return pd.DataFrame(make_customers())


@pytest.fixture
def no_row_loops(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("Do not loop over rows (apply / iterrows / itertuples): use column arithmetic and built-in methods")
    for owner, name in [(pd.DataFrame, "apply"), (pd.Series, "apply"), (pd.DataFrame, "iterrows"), (pd.DataFrame, "itertuples")]:
        monkeypatch.setattr(owner, name, boom)


# ---------------------------------------------------------------- lesson 2: load and inspect
class TestLoad:
    def test_reads_every_line_from_text_or_path(self, tmp_path):
        df = lab.load_orders(io.StringIO(CSV_TEXT))
        assert len(df) == 2080
        p = tmp_path / "orders.csv"
        p.write_text(CSV_TEXT, encoding="utf-8")
        assert len(lab.load_orders(p)) == 2080

    def test_ids_stay_text_with_their_leading_zeros(self):
        df = lab.load_orders(io.StringIO(CSV_TEXT))
        assert df["customer_id"].iloc[0] == df["customer_id"].iloc[0].strip()
        assert all(len(str(v)) == 5 for v in df["customer_id"])
        assert str(df["customer_id"].iloc[0]).isdigit() and df["customer_id"].astype(str).str.startswith("00").sum() > 100

    def test_dates_are_real_dates_and_bad_ones_are_missing(self):
        df = lab.load_orders(io.StringIO(CSV_TEXT))
        assert pd.api.types.is_datetime64_any_dtype(df["order_date"])
        assert int(df["order_date"].isna().sum()) == 25

    def test_quantity_is_a_nullable_integer_and_a_dash_is_a_missing_price(self):
        df = lab.load_orders(io.StringIO(CSV_TEXT))
        assert str(df["quantity"].dtype) == "Int64"
        assert int(df["quantity"].isna().sum()) == 37
        assert df["unit_price_idr"].dtype == "float64"
        assert int(df["unit_price_idr"].isna().sum()) == 30


class TestQualityReport:
    def test_report_on_the_raw_file(self):
        rep = lab.data_quality_report(lab.load_orders(io.StringIO(CSV_TEXT)))
        assert rep["rows"] == 2080
        assert rep["duplicate_order_ids"] == 80
        assert rep["nulls"]["order_date"] == 25 and rep["nulls"]["quantity"] == 37 and rep["nulls"]["unit_price_idr"] == 30
        assert rep["nulls"]["order_id"] == 0
        assert set(rep["nulls"]) == {"order_id", "customer_id", "order_date", "country", "product", "quantity", "unit_price_idr", "status"}

    def test_report_values_are_plain_python_numbers(self):
        rep = lab.data_quality_report(pd.DataFrame({"order_id": ["a", "a", "b"], "x": [1, None, 3]}))
        assert rep == {"rows": 3, "nulls": {"order_id": 0, "x": 1}, "duplicate_order_ids": 1}
        assert type(rep["rows"]) is int and type(rep["nulls"]["x"]) is int


# ---------------------------------------------------------------- lesson 3: clean and compute
class TestClean:
    @pytest.fixture
    def raw(self):
        return lab.load_orders(io.StringIO(CSV_TEXT))

    def test_keeps_exactly_the_good_rows(self, raw, no_row_loops):
        out = lab.clean_orders(raw)
        assert len(out) == len(TRUTH) == 1911
        assert set(out["order_id"]) == {r["order_id"] for r in TRUTH}
        assert out["order_id"].is_unique

    def test_text_columns_are_normalised(self, raw):
        out = lab.clean_orders(raw)
        assert set(out["country"]) == {"ID", "SG", "MY", "TH"}
        assert set(out["product"]) == {"espresso", "latte", "cold brew", "beans 1kg", "filter"}
        assert set(out["status"]) == {"paid", "refunded", "cancelled"}

    def test_no_missing_values_and_quantity_is_a_plain_int(self, raw):
        out = lab.clean_orders(raw)
        assert int(out[["order_date", "quantity", "unit_price_idr"]].isna().sum().sum()) == 0
        assert str(out["quantity"].dtype) == "int64"

    def test_values_match_the_truth(self, raw):
        out = lab.clean_orders(raw).sort_values("order_id").reset_index(drop=True)
        expected = truth_frame().sort_values("order_id").reset_index(drop=True)
        assert (out["quantity"] * out["unit_price_idr"]).sum() == (expected["quantity"] * expected["unit_price_idr"]).sum()
        assert list(out["customer_id"]) == list(expected["customer_id"])
        assert list(out["order_date"]) == list(expected["order_date"])

    def test_index_is_reset_and_input_is_not_changed(self, raw):
        before = raw.copy()
        out = lab.clean_orders(raw)
        assert list(out.index) == list(range(len(out)))
        pd.testing.assert_frame_equal(raw, before)

    def test_first_copy_of_a_duplicate_wins(self):
        df = pd.DataFrame({"order_id": ["a", "a", "b"], "order_date": pd.to_datetime(["2026-01-01"] * 3), "country": [" id", "ID", "sg"],
                           "product": ["Latte", "latte", "latte"], "status": ["Paid", "paid", "paid"],
                           "quantity": pd.array([1, 2, 3], dtype="Int64"), "unit_price_idr": [10.0, 20.0, 30.0], "customer_id": ["1"] * 3})
        out = lab.clean_orders(df)
        assert list(out["order_id"]) == ["a", "b"] and list(out["quantity"]) == [1, 3]
        assert list(out["country"]) == ["ID", "SG"] and list(out["status"]) == ["paid", "paid"]


class TestPaidAndRevenue:
    def test_paid_only(self):
        df = truth_frame()
        out = lab.paid_only(df)
        assert set(out["status"]) == {"paid"}
        assert len(out) == sum(1 for r in TRUTH if r["status"] == "paid")
        assert list(out.index) == list(range(len(out)))

    def test_add_revenue_is_vectorised_and_leaves_the_input_alone(self, no_row_loops):
        df = truth_frame()
        before = df.copy()
        out = lab.add_revenue(df)
        assert "revenue_idr" not in df.columns
        pd.testing.assert_frame_equal(df, before)
        assert list(out["revenue_idr"]) == [r["quantity"] * r["unit_price_idr"] for r in TRUTH]


# ---------------------------------------------------------------- lesson 4: group, pivot, window
def revenue_frame():
    return lab.add_revenue(lab.paid_only(truth_frame()))


class TestAggregate:
    def test_revenue_by_country(self, no_row_loops):
        out = lab.revenue_by_country(revenue_frame())
        assert list(out.columns) == ["country", "orders", "revenue_idr", "avg_order_idr"]
        paid = [r for r in TRUTH if r["status"] == "paid"]
        want = {}
        for r in paid:
            c = want.setdefault(r["country"], [0, 0.0])
            c[0] += 1
            c[1] += r["quantity"] * r["unit_price_idr"]
        got = {c: (o, rev, avg) for c, o, rev, avg in zip(out["country"], out["orders"], out["revenue_idr"], out["avg_order_idr"])}
        assert set(got) == set(want)
        for c, (orders, revenue) in want.items():
            assert got[c][0] == orders
            assert got[c][1] == pytest.approx(revenue)
            assert got[c][2] == pytest.approx(revenue / orders)

    def test_sorted_by_revenue_highest_first_with_a_fresh_index(self):
        out = lab.revenue_by_country(revenue_frame())
        assert list(out["revenue_idr"]) == sorted(out["revenue_idr"], reverse=True)
        assert list(out.index) == list(range(len(out)))

    def test_orders_counts_distinct_order_ids(self):
        df = pd.DataFrame({"order_id": ["a", "a", "b"], "country": ["ID"] * 3, "revenue_idr": [1.0, 2.0, 3.0]})
        assert int(lab.revenue_by_country(df)["orders"].iloc[0]) == 2


class TestPivot:
    def test_monthly_revenue_by_country(self):
        out = lab.monthly_revenue(revenue_frame())
        assert list(out.index) == ["2026-01", "2026-02", "2026-03"]
        assert out.index.name == "month" and out.columns.name is None
        assert set(out.columns) == {"ID", "SG", "MY", "TH"}
        want = {}
        for r in TRUTH:
            if r["status"] == "paid":
                key = (r["order_date"].strftime("%Y-%m"), r["country"])
                want[key] = want.get(key, 0.0) + r["quantity"] * r["unit_price_idr"]
        for (month, country), value in want.items():
            assert out.loc[month, country] == pytest.approx(value)

    def test_a_month_with_no_sales_is_zero_not_missing(self):
        df = pd.DataFrame({"order_date": pd.to_datetime(["2026-01-05", "2026-02-05"]), "country": ["ID", "SG"], "revenue_idr": [10.0, 20.0]})
        out = lab.monthly_revenue(df)
        assert out.loc["2026-01", "SG"] == 0 and out.loc["2026-02", "ID"] == 0
        assert int(out.isna().sum().sum()) == 0


class TestTopN:
    def df(self):
        rows = [("ID", "latte", 50.0), ("ID", "latte", 50.0), ("ID", "filter", 70.0), ("ID", "beans", 70.0), ("ID", "espresso", 5.0),
                ("SG", "latte", 1.0)]
        return pd.DataFrame(rows, columns=["country", "product", "revenue_idr"])

    def test_top_two_per_country_with_ties_broken_by_product_name(self):
        out = lab.top_products_per_country(self.df(), n=2)
        assert list(out.columns) == ["country", "product", "revenue_idr", "rank"]
        got = out.set_index(["country", "product"])
        assert got.loc[("ID", "latte"), "revenue_idr"] == 100.0 and got.loc[("ID", "latte"), "rank"] == 1
        assert got.loc[("ID", "beans"), "rank"] == 2          # beans and filter tie at 70: A to Z wins
        assert ("ID", "filter") not in got.index and ("ID", "espresso") not in got.index

    def test_sorted_by_country_then_rank_and_n_is_respected(self):
        out = lab.top_products_per_country(self.df(), n=3)
        assert list(out["country"]) == ["ID", "ID", "ID", "SG"]
        assert list(out["rank"]) == [1, 2, 3, 1]
        assert list(out["product"][:3]) == ["latte", "beans", "filter"]
        assert list(out.index) == list(range(len(out)))


class TestWindow:
    def df(self):
        return pd.DataFrame({
            "order_id": ["o3", "o1", "o2", "o4"], "customer_id": ["B", "A", "A", "A"],
            "order_date": pd.to_datetime(["2026-01-09", "2026-01-01", "2026-01-04", "2026-01-10"]),
            "revenue_idr": [5.0, 10.0, 20.0, 30.0]})

    def test_order_number_running_total_and_gap_per_customer(self, no_row_loops):
        out = lab.add_customer_history(self.df())
        assert list(out["order_id"]) == ["o1", "o2", "o4", "o3"]          # sorted by customer, date, order id
        assert list(out["order_number"]) == [1, 2, 3, 1]
        assert list(out["customer_revenue_to_date"]) == [10.0, 30.0, 60.0, 5.0]
        gaps = list(out["days_since_previous"])
        assert pd.isna(gaps[0]) and gaps[1] == 3 and gaps[2] == 6 and pd.isna(gaps[3])

    def test_input_unchanged_and_index_fresh(self):
        df = self.df()
        before = df.copy()
        out = lab.add_customer_history(df)
        pd.testing.assert_frame_equal(df, before)
        assert list(out.index) == [0, 1, 2, 3]


# ---------------------------------------------------------------- lesson 5: joins
class TestJoin:
    def test_left_join_keeps_every_order_exactly_once(self):
        orders = truth_frame()
        out = lab.join_customers(orders, customers_frame())
        assert len(out) == len(orders)
        assert list(out["order_id"]) == list(orders["order_id"])
        assert {"name", "tier", "signup_date"} <= set(out.columns)

    def test_orders_with_no_customer_get_tier_unknown(self):
        orders = truth_frame()
        out = lab.join_customers(orders, customers_frame())
        known = set(customers_frame()["customer_id"])
        expected = sum(1 for r in TRUTH if r["customer_id"] not in known)
        assert int((out["tier"] == "unknown").sum()) == expected > 0
        assert out.loc[out["tier"] == "unknown", "name"].isna().all()

    def test_duplicate_customers_are_refused_not_silently_multiplied(self):
        dup = pd.concat([customers_frame(), customers_frame().iloc[:1]], ignore_index=True)
        with pytest.raises(pd.errors.MergeError):
            lab.join_customers(truth_frame(), dup)

    def test_orphan_customer_ids(self):
        out = lab.orphan_customer_ids(truth_frame(), customers_frame())
        assert out == [f"{i:05d}" for i in range(201, 221)]
        assert isinstance(out, list)

    def test_no_orphans_gives_an_empty_list(self):
        assert lab.orphan_customer_ids(truth_frame().iloc[:0], customers_frame()) == []


# ---------------------------------------------------------------- lesson 6: memory, chunks, files
class TestMemory:
    def test_smaller_but_the_same_numbers(self):
        df = lab.clean_orders(lab.load_orders(io.StringIO(CSV_TEXT)))
        before = df.copy()
        small = lab.shrink_memory(df)
        pd.testing.assert_frame_equal(df, before)                       # input untouched
        assert small.memory_usage(deep=True).sum() < 0.6 * df.memory_usage(deep=True).sum()
        for col in df.columns:
            assert list(small[col].astype(object)) == list(df[col].astype(object)), col

    def test_few_distinct_values_become_category_and_ids_do_not(self):
        small = lab.shrink_memory(lab.clean_orders(lab.load_orders(io.StringIO(CSV_TEXT))))
        assert isinstance(small["country"].dtype, pd.CategoricalDtype)
        assert isinstance(small["product"].dtype, pd.CategoricalDtype)
        assert not isinstance(small["order_id"].dtype, pd.CategoricalDtype)
        assert small["quantity"].dtype.itemsize < 8


class TestChunks:
    @pytest.fixture
    def csv_path(self, tmp_path):
        p = tmp_path / "clean.csv"
        truth_frame().to_csv(p, index=False)
        return p

    def test_same_answer_as_reading_everything(self, csv_path):
        df = pd.read_csv(csv_path)
        want = (df["quantity"] * df["unit_price_idr"]).groupby(df["country"]).sum().sort_index()
        got = lab.chunked_revenue_by_country(csv_path, chunksize=300)
        assert list(got.index) == list(want.index)
        for k in want.index:
            assert float(got[k]) == pytest.approx(float(want[k]))

    def test_never_holds_more_than_one_chunk(self, csv_path, monkeypatch):
        seen = []
        original = pd.read_csv

        def spy(*a, **kw):
            result = original(*a, **kw)
            if kw.get("chunksize"):
                def gen():
                    for chunk in result:
                        seen.append(len(chunk))
                        yield chunk
                return gen()
            seen.append(len(result))
            return result

        monkeypatch.setattr(pd, "read_csv", spy)
        lab.chunked_revenue_by_country(csv_path, chunksize=250)
        assert len(seen) >= 7 and max(seen) <= 250 and sum(seen) == len(TRUTH)

    def test_chunk_size_does_not_change_the_answer(self, csv_path):
        a = lab.chunked_revenue_by_country(csv_path, chunksize=97)
        b = lab.chunked_revenue_by_country(csv_path, chunksize=5000)
        assert [float(x) for x in a] == pytest.approx([float(x) for x in b])


class TestParquet:
    def test_round_trip_keeps_types_and_is_smaller_than_csv(self, tmp_path):
        pytest.importorskip("pyarrow")
        df = truth_frame()
        out = tmp_path / "orders.parquet"
        lab.write_parquet(df, out)
        back = pd.read_parquet(out)
        pd.testing.assert_frame_equal(back.reset_index(drop=True), df, check_dtype=False)
        assert pd.api.types.is_datetime64_any_dtype(back["order_date"])
        csv = tmp_path / "orders.csv"
        df.to_csv(csv, index=False)
        assert out.stat().st_size < csv.stat().st_size

    def test_reads_only_the_requested_columns(self, tmp_path):
        pytest.importorskip("pyarrow")
        out = tmp_path / "orders.parquet"
        lab.write_parquet(truth_frame(), out)
        got = lab.read_parquet_columns(out, ["order_id", "quantity"])
        assert list(got.columns) == ["order_id", "quantity"] and len(got) == len(TRUTH)
