"""Capstone 4.4: your daily Airflow pipeline for job postings. Copy this file into your workspace folder (for example ~/airflow-lab) and build it there.

The checker imports this file with Airflow 3 and runs it with dag.test(). Everything it must do is in the lesson "The contract" and in the five steps
of the lab. This file only reminds you of the environment variables. The rest is yours.

Environment (the checker sets them; set them yourself when you try things):
    JOBS_INBOX        folder with one delivery per day: jobs_YYYY-MM-DD.jsonl
    JOBS_WAREHOUSE    path of the DuckDB file to write
    JOBS_QUARANTINE   folder for the rejected lines
Read them when a task RUNS (inside the task functions), not when the file is imported.
"""
import datetime  # noqa: F401
import os  # noqa: F401

from airflow.sdk import dag, task  # noqa: F401


# TODO step 2: a @dag called "jobs_pipeline" with the settings of the contract, and five @task functions in a chain:
#              extract, validate, transform, load, publish_mart
# TODO step 3: make each task do its part for ONE day (the "ds" of the run), and write the warehouse tables
# TODO step 4: make every task a function of its date, so that reruns and out-of-order runs are safe
# TODO step 5: a missing file must make extract fail (so it is retried); a delivery with more than 50% unusable lines must fail validate
