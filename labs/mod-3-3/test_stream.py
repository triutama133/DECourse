"""Tests for Lab 3.3 part B (Structured Streaming).   pytest labs/mod-3-3/test_stream.py -v   (needs Java 17+)"""
import os
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

if not (shutil.which("java") or os.environ.get("JAVA_HOME")):
    pytest.skip("Java 17+ is required for Spark (java -version)", allow_module_level=True)

from pyspark.sql import SparkSession  # noqa: E402

job = labtools.load(__file__, "stream_job.py")
windows = labtools.load(__file__, "windows.py")

T0 = 1767607200
MIN = 60
SIZE, DELAY = 300, 120


def at(m):
    return T0 + m * MIN


FIRST = [
    [("a", at(1), 10), ("a", at(2), 20), ("b", at(3), 5)],
    [("a", at(6), 30), ("b", at(7), 7), ("a", at(4), 99)],
    [("a", at(11), 1), ("a", at(3), 1000), ("b", at(6), 50)],
]
SECOND = [[("a", at(16), 2)], [("a", at(30), 3)]]


@pytest.fixture(scope="module")
def spark():
    s = (SparkSession.builder.master("local[2]").appName("lab33").config("spark.ui.enabled", "false")
         .config("spark.sql.shuffle.partitions", "2").config("spark.sql.session.timeZone", "UTC").getOrCreate())
    s.sparkContext.setLogLevel("ERROR")
    yield s
    s.stop()


def model(batches_runs):
    """What the pure-Python model emits for runs of batches (each run ends with an empty batch, as Spark does)."""
    agg, out = windows.WindowedAggregator(SIZE, delay=DELAY), []
    for run in batches_runs:
        got = []
        for b in run:
            got += agg.add_batch(b)
        got += agg.advance()
        out.append(sorted(got))
    return out, agg


def spark_run(spark, tmp_path, new_files, start_index, checkpoint="ck"):
    inp = tmp_path / "in"
    for i, events in enumerate(new_files, start=start_index):
        job.write_batch_file(inp, i, events)
    return sorted(job.run_available_now(spark, inp, tmp_path / checkpoint, SIZE, DELAY))


def test_spark_emits_exactly_what_the_model_predicts(spark, tmp_path):
    expected, _ = model([FIRST, SECOND])
    assert spark_run(spark, tmp_path, FIRST, 0) == expected[0]
    assert spark_run(spark, tmp_path, SECOND, 3) == expected[1]


def test_the_late_event_inside_an_open_window_was_counted(spark, tmp_path):
    out = spark_run(spark, tmp_path, FIRST, 0)
    assert ("a", T0, at(5), 4, 1129) in out, "the 10:03 event (1000) arrives after the watermark passed it but its window was still open"


def test_restarting_from_the_same_checkpoint_does_not_repeat_anything(spark, tmp_path):
    spark_run(spark, tmp_path, FIRST, 0)
    assert spark_run(spark, tmp_path, [], 3) == []


def test_without_a_checkpoint_everything_is_processed_again(spark, tmp_path):
    first = spark_run(spark, tmp_path, FIRST, 0)
    again = sorted(job.run_available_now(spark, tmp_path / "in", tmp_path / "other-checkpoint", SIZE, DELAY))
    assert again == first, "state and progress live in the checkpoint: a new checkpoint starts from scratch"


def test_a_truly_late_event_is_dropped_by_spark_and_by_the_model(spark, tmp_path):
    runs = [FIRST, SECOND, [[("a", at(2), 5000)]]]
    expected, agg = model(runs)
    spark_run(spark, tmp_path, FIRST, 0)
    spark_run(spark, tmp_path, SECOND, 3)
    assert spark_run(spark, tmp_path, runs[2], 5) == expected[2] == [], "the 10:02 window was emitted long ago: nothing changes"
    assert agg.dropped == 1
