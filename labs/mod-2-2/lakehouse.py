"""Lab 2.2: open table formats.   Tests: pytest labs/mod-2-2 -v

Part A uses Apache Iceberg (PyIceberg, a local SQLite catalog and plain folders as the warehouse).
Part B uses Delta Lake (delta-rs). Implement every TODO. Read test_lab.py first.
"""
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


# ---------------- Part A: Apache Iceberg ----------------
def create_orders_table(catalog):
    """Create namespace 'shop' (if missing) and table 'shop.orders' with this schema (field ids matter):
         1 order_id long REQUIRED | 2 customer_id long | 3 order_ts timestamp | 4 status string | 5 total_idr long
    Partition it by the DAY of order_ts (hidden partitioning, PartitionField name 'order_day'). Return the table."""
    raise NotImplementedError("TODO: create_orders_table")


def append_batch(table, rows):
    """rows: list of dicts using the table's CURRENT column names. Append them as ONE new snapshot.
    Hint: pa.Table.from_pylist(rows, schema=table.schema().as_arrow())"""
    raise NotImplementedError("TODO: append_batch")


def snapshot_ops(table):
    """Names of the operations that created each snapshot, oldest first, e.g. ['append', 'append', 'delete']."""
    raise NotImplementedError("TODO: snapshot_ops")


def count_as_of(table, snapshot_index):
    """Number of rows the table had as of the snapshot at this position (0 = the first snapshot): time travel."""
    raise NotImplementedError("TODO: count_as_of")


def delete_status(table, status):
    """Delete every row whose status equals the given value (a row-level delete, one new snapshot)."""
    raise NotImplementedError("TODO: delete_status")


def evolve(table):
    """Schema evolution in ONE commit: add an optional string column 'channel' and rename 'status' to 'order_status'.
    No data file may be rewritten."""
    raise NotImplementedError("TODO: evolve")


def layout(table):
    """Look at the table's folder ON DISK (table.location()) and count its parts. Return a dict:
       metadata_json  = files named *.metadata.json   (one per table version)
       manifest_lists = *.avro files whose name starts with 'snap-'
       manifests      = the other *.avro files in metadata/
       data_files     = *.parquet files anywhere under data/"""
    raise NotImplementedError("TODO: layout")


# ---------------- Part B: Delta Lake ----------------
def delta_write_versions(path, batches):
    """batches: a list of pyarrow Tables. The first creates the Delta table (version 0); each further one is APPENDED
    as a new version. Return the final version number."""
    raise NotImplementedError("TODO: delta_write_versions")


def delta_rows_at(path, version):
    """Row count as of the given version (time travel)."""
    raise NotImplementedError("TODO: delta_rows_at")


def delta_delete(path, predicate):
    """Delete rows matching an SQL predicate string such as "order_id = 4". Return the new version number."""
    raise NotImplementedError("TODO: delta_delete")


def delta_log_actions(path, version):
    """Open <path>/_delta_log/<version as 20 digits>.json and return the action type of each line, in order,
    e.g. ['commitInfo', 'add'] (each line is a JSON object with ONE key: the action name)."""
    raise NotImplementedError("TODO: delta_log_actions")
