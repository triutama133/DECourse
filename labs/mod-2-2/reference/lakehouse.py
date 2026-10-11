"""Reference solution for Lab 2.2."""
import json
from pathlib import Path

import pyarrow as pa
from deltalake import DeltaTable, write_deltalake
from pyiceberg.catalog.sql import SqlCatalog
from pyiceberg.expressions import EqualTo
from pyiceberg.partitioning import PartitionField, PartitionSpec
from pyiceberg.schema import Schema
from pyiceberg.transforms import DayTransform
from pyiceberg.types import LongType, NestedField, StringType, TimestampType


def make_catalog(workdir):
    """A local Iceberg catalog: a SQLite file for the catalog, plain folders for the warehouse. (Provided.)"""
    workdir = Path(workdir)
    (workdir / "warehouse").mkdir(parents=True, exist_ok=True)
    return SqlCatalog("local", uri=f"sqlite:///{workdir}/catalog.db", warehouse=f"file://{workdir}/warehouse")


# ---------------- Apache Iceberg ----------------
def create_orders_table(catalog):
    catalog.create_namespace_if_not_exists("shop")
    schema = Schema(
        NestedField(1, "order_id", LongType(), required=True),
        NestedField(2, "customer_id", LongType()),
        NestedField(3, "order_ts", TimestampType()),
        NestedField(4, "status", StringType()),
        NestedField(5, "total_idr", LongType()),
    )
    # Hidden partitioning: partition by the DAY of order_ts, without a separate day column in the data.
    spec = PartitionSpec(PartitionField(source_id=3, field_id=1000, transform=DayTransform(), name="order_day"))
    return catalog.create_table("shop.orders", schema=schema, partition_spec=spec)


def append_batch(table, rows):
    table.append(pa.Table.from_pylist(rows, schema=table.schema().as_arrow()))


def snapshot_ops(table):
    return [s.summary.operation.value for s in table.snapshots()]


def count_as_of(table, snapshot_index):
    snap = table.snapshots()[snapshot_index]
    return table.scan(snapshot_id=snap.snapshot_id).to_arrow().num_rows


def delete_status(table, status):
    table.delete(EqualTo("status", status))


def evolve(table):
    with table.update_schema() as update:
        update.add_column("channel", StringType())
        update.rename_column("status", "order_status")


def layout(table):
    root = Path(table.location().replace("file://", ""))
    meta = root / "metadata"
    avro = [p.name for p in meta.glob("*.avro")]
    return {
        "metadata_json": len(list(meta.glob("*.metadata.json"))),
        "manifest_lists": sum(1 for n in avro if n.startswith("snap-")),
        "manifests": sum(1 for n in avro if not n.startswith("snap-")),
        "data_files": len(list((root / "data").rglob("*.parquet"))),
    }


# ---------------- Delta Lake ----------------
def delta_write_versions(path, batches):
    """First batch creates the table (version 0); every further batch is appended as a new version. Returns the last version."""
    write_deltalake(path, batches[0], mode="overwrite")
    for b in batches[1:]:
        write_deltalake(path, b, mode="append")
    return DeltaTable(path).version()


def delta_rows_at(path, version):
    return DeltaTable(path, version=version).to_pyarrow_table().num_rows


def delta_delete(path, predicate):
    DeltaTable(path).delete(predicate)
    return DeltaTable(path).version()


def delta_log_actions(path, version):
    log = Path(path) / "_delta_log" / f"{version:020d}.json"
    return [next(iter(json.loads(line))) for line in log.read_text().splitlines() if line.strip()]
