"""Tests for Lab 2.2.   pip install -r labs/mod-2-2/requirements.txt && pytest labs/mod-2-2 -v"""
import datetime as dt
import sys
from pathlib import Path

import pyarrow as pa
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "lakehouse.py")


def rows(ids, day, status="paid", new_names=False):
    out = []
    for i in ids:
        r = {"order_id": i, "customer_id": i % 5, "order_ts": dt.datetime(2026, 1, day, 10, i % 60), "total_idr": 1000 * i}
        r["order_status" if new_names else "status"] = status
        if new_names:
            r["channel"] = "web"
        out.append(r)
    return out


@pytest.fixture()
def table(tmp_path):
    t = lab.create_orders_table(lab.make_catalog(tmp_path))
    lab.append_batch(t, rows([1, 2, 3], 1))
    lab.append_batch(t, rows([4, 5], 2))
    lab.append_batch(t, rows([6, 7], 2, status="cancelled"))
    return t


# ---------------- Iceberg ----------------
class TestIceberg:
    def test_table_definition(self, tmp_path):
        t = lab.create_orders_table(lab.make_catalog(tmp_path))
        fields = {f.field_id: (f.name, f.required) for f in t.schema().fields}
        assert fields == {1: ("order_id", True), 2: ("customer_id", False), 3: ("order_ts", False), 4: ("status", False), 5: ("total_idr", False)}
        part = t.spec().fields
        assert len(part) == 1 and part[0].name == "order_day" and "day" in str(part[0].transform).lower()
        assert part[0].source_id == 3

    def test_each_append_is_one_snapshot(self, table):
        assert lab.snapshot_ops(table) == ["append", "append", "append"]
        assert table.scan().to_arrow().num_rows == 7

    def test_data_is_partitioned_by_day_on_disk(self, table):
        days = {p.parent.name for p in Path(table.location().replace("file://", "")).joinpath("data").rglob("*.parquet")}
        assert days == {"order_day=2026-01-01", "order_day=2026-01-02"}

    def test_time_travel_sees_the_past(self, table):
        assert [lab.count_as_of(table, i) for i in range(3)] == [3, 5, 7]

    def test_delete_creates_a_snapshot_and_history_survives(self, table):
        lab.delete_status(table, "cancelled")
        assert lab.snapshot_ops(table)[-1] == "delete"
        assert table.scan().to_arrow().num_rows == 5
        assert lab.count_as_of(table, 2) == 7, "the snapshot before the delete must still show the deleted rows"

    def test_schema_evolution_rewrites_no_data(self, table):
        before = sorted(f.file.file_path for f in table.scan().plan_files())
        lab.evolve(table)
        after = sorted(f.file.file_path for f in table.scan().plan_files())
        assert before == after, "adding and renaming columns must be a metadata-only change"
        names = {f.field_id: f.name for f in table.schema().fields}
        assert names[4] == "order_status" and names[6] == "channel" and names[1] == "order_id"
        out = table.scan().to_arrow()
        assert out.num_rows == 7 and "order_status" in out.column_names
        assert set(out.column("channel").to_pylist()) == {None}, "old rows read as NULL in the new column"
        assert lab.count_as_of(table, 0) == 3

    def test_new_schema_accepts_new_rows(self, table):
        lab.evolve(table)
        lab.append_batch(table, rows([8], 3, new_names=True))
        assert table.scan().to_arrow().num_rows == 8

    def test_layout_matches_the_disk(self, table):
        info = lab.layout(table)
        root = Path(table.location().replace("file://", ""))
        assert info["metadata_json"] == len(list((root / "metadata").glob("*.metadata.json")))
        assert info["data_files"] == len(list((root / "data").rglob("*.parquet"))) == 3
        assert info["manifest_lists"] == len(table.snapshots()), "one manifest list per snapshot"
        assert info["manifests"] >= 3
        assert info["metadata_json"] == len(table.snapshots()) + 1, "one metadata file for creation plus one per commit"

    def test_a_writer_with_a_stale_view_still_commits(self, tmp_path):
        catalog = lab.make_catalog(tmp_path)
        t = lab.create_orders_table(catalog)
        a, b = catalog.load_table("shop.orders"), catalog.load_table("shop.orders")
        lab.append_batch(a, rows([1], 1))
        lab.append_batch(b, rows([2], 1))  # b was loaded before a committed: optimistic concurrency must resolve it
        assert catalog.load_table("shop.orders").scan().to_arrow().num_rows == 2


# ---------------- Delta ----------------
def batch(ids, day):
    return pa.table({"order_id": pa.array(ids, pa.int64()), "status": pa.array(["paid"] * len(ids)),
                     "order_day": pa.array([f"2026-01-0{day}"] * len(ids))})


class TestDelta:
    @pytest.fixture()
    def path(self, tmp_path):
        p = str(tmp_path / "delta_orders")
        assert lab.delta_write_versions(p, [batch([1, 2, 3], 1), batch([4, 5], 2), batch([6], 3)]) == 2
        return p

    def test_versions_and_time_travel(self, path):
        assert [lab.delta_rows_at(path, v) for v in (0, 1, 2)] == [3, 5, 6]

    def test_first_commit_defines_the_table_and_later_ones_only_add(self, path):
        assert lab.delta_log_actions(path, 0) == ["commitInfo", "protocol", "metaData", "add"]
        assert lab.delta_log_actions(path, 1) == ["commitInfo", "add"]

    def test_delete_rewrites_a_file_and_old_versions_stay_readable(self, path):
        v = lab.delta_delete(path, "order_id = 4")
        assert v == 3
        assert lab.delta_rows_at(path, 3) == 5 and lab.delta_rows_at(path, 2) == 6
        actions = lab.delta_log_actions(path, 3)
        assert "remove" in actions and "add" in actions, "a delete removes the old file and adds a rewritten one"
