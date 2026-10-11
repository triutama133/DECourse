"""Reference solution for Lab 3.3 part B: a Structured Streaming job."""
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
    """Process every file that is not yet checkpointed (one file per micro-batch) and return the emitted windows as
    [(key, start_epoch, end_epoch, count, total), ...] in emission order."""
    schema = StructType([StructField("account", StringType()), StructField("event_time", TimestampType()), StructField("amount", LongType())])
    counts = (
        spark.readStream.schema(schema).option("maxFilesPerTrigger", 1).json(str(input_dir))
        .withWatermark("event_time", f"{delay_s} seconds")
        .groupBy(F.window("event_time", f"{size_s} seconds"), "account")
        .agg(F.count("*").alias("n"), F.sum("amount").alias("total"))
    )
    emitted = []

    def collect(batch_df, batch_id):
        rows = batch_df.select("account", F.unix_timestamp("window.start").alias("s"), F.unix_timestamp("window.end").alias("e"), "n", "total").collect()
        emitted.extend((r["account"], int(r["s"]), int(r["e"]), r["n"], r["total"]) for r in sorted(rows, key=lambda r: (r["s"], r["account"])))

    query = (counts.writeStream.outputMode("append").foreachBatch(collect)
             .option("checkpointLocation", str(checkpoint_dir)).trigger(availableNow=True).start())
    query.awaitTermination()
    return emitted
