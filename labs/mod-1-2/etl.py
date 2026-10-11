"""Lab 1.2: a streaming, validated, idempotent orders ETL.   Tests: pytest labs/mod-1-2 -v

    python labs/mod-1-2/etl.py data/orders.csv clean.ndjson quarantine.ndjson

Fill in every TODO. Read the tests in test_lab.py first: they describe exactly what is expected.
"""
import argparse
import csv
import json
import logging
import os
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterator, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

logger = logging.getLogger("kopiku_etl")


class OrderRow(BaseModel):
    """One order, validated. Must raise ValidationError for rows that cannot be trusted.

    TODO: add the constraints and the validators:
      - order_id, customer_id, total_idr must be integers > 0
      - status: one of paid/shipped/delivered/cancelled/refunded, accepted in any case and with spaces
      - payment_method: one of card/bank_transfer/ewallet/cod
      - total_idr may arrive as "Rp 1.250.000" and must become 1250000
      - order_ts may arrive as ISO "2026-01-31T14:03:00" or as "31/01/2026 14:03"
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    order_id: int
    customer_id: int
    order_ts: datetime
    status: str
    payment_method: str
    total_idr: int


@dataclass
class Stats:
    read: int = 0
    valid: int = 0
    duplicates: int = 0
    invalid: int = 0
    reasons: Counter = field(default_factory=Counter)

    @property
    def rejected(self):
        return self.duplicates + self.invalid

    @property
    def reject_rate(self):
        return self.rejected / self.read if self.read else 0.0


def read_orders(path) -> Iterator[dict]:
    """Yield one dict per CSV row, LAZILY (it must be a generator; never build a list of all rows)."""
    raise NotImplementedError("TODO: read_orders")


def validate(row: dict) -> OrderRow:
    """Return the validated OrderRow or raise pydantic.ValidationError."""
    raise NotImplementedError("TODO: validate")


def run(input_path, output_path, quarantine_path) -> Stats:
    """Stream input -> output (valid orders, one JSON object per line, keys sorted, order_ts as ISO text)
    and quarantine (one JSON object per rejected row: {"row": <1-based row number>, "reason": <text>, "raw": <the row>}).

    Rules:
      - memory must stay flat no matter how big the input is
      - an order_id that was already accepted is a duplicate: reject it with reason "duplicate"
      - invalid rows are rejected with a reason built from the first validation error
      - write to <path>.tmp files and os.replace() them at the end, so a failed run never leaves
        half-written outputs and never destroys the previous good output
      - running twice on the same input must give byte-identical outputs
      - log one INFO line with the counts, e.g. "read=3634 valid=3560 duplicates=35 invalid=39"
    """
    raise NotImplementedError("TODO: run")


def main(argv=None) -> int:
    """CLI. Arguments: input output quarantine [--max-reject-rate 0.05].
    Return 0 on success, 1 if the reject rate is above the limit, 2 if the input cannot be read."""
    raise NotImplementedError("TODO: main")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(main())
