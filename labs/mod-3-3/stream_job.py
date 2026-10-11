"""Lab 3.3 part B: a real Structured Streaming job.   pytest labs/mod-3-3/test_stream.py -v   (needs Java 17+)

The job reads JSON files that arrive in a folder (a stand-in for a Kafka topic), counts and sums events per account in
5-minute event-time windows with a 2-minute watermark, and emits each window once, when the watermark closes it.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from pyspark.sql import functions as F
from pyspark.sql.types import LongType, StringType, StructField, StructType, TimestampType

BASE_MTIME = 1_700_000_000


def write_batch_file(input_dir, index, events):
    """Write one micro-batch as a JSON-lines file. events: [(key, epoch_seconds, value)]. (Provided.)
    Spark's file source reads files in MODIFICATION-TIME order, so each file gets an explicit, increasing mtime."""
    path = Path(input_dir) / f"batch-{index:03d}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps({"account": k, "event_time": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "amount": v})
             for k, ts, v in events]
    path.write_text("\n".join(lines) + "\n")
    os.utime(path, (BASE_MTIME + index * 10, BASE_MTIME + index * 10))


def run_available_now(spark, input_dir, checkpoint_dir, size_s, delay_s):
    """Process every file that is not yet checkpointed and return the emitted windows as
    [(key, start_epoch, end_epoch, count, total), ...] in emission order.

    Build it like this:
      * spark.readStream with an explicit schema (account string, event_time timestamp, amount long),
        option maxFilesPerTrigger = 1 (one file = one micro-batch), .json(input_dir)
      * .withWatermark("event_time", f"{delay_s} seconds")
      * .groupBy(F.window("event_time", f"{size_s} seconds"), "account").agg(count, sum of amount)
      * writeStream in outputMode "append" (a window is emitted once, when the watermark passes its end),
        foreachBatch(collect) where collect gathers the rows of each micro-batch into a Python list
        (use F.unix_timestamp("window.start") / ("window.end") to get epoch seconds), sorted by (start, account) inside a batch,
      * option checkpointLocation = checkpoint_dir, trigger(availableNow=True), start(), awaitTermination()
    The session time zone must be UTC (the test sets it). Return the collected list."""
    raise NotImplementedError("TODO: run_available_now")
