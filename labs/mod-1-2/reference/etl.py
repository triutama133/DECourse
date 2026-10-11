"""Reference solution for Lab 1.2: a streaming, validated, idempotent orders ETL."""
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
    """One order, validated. Raises ValidationError for rows that cannot be trusted."""
    model_config = ConfigDict(str_strip_whitespace=True)

    order_id: int = Field(gt=0)
    customer_id: int = Field(gt=0)
    order_ts: datetime
    status: Literal["paid", "shipped", "delivered", "cancelled", "refunded"]
    payment_method: Literal["card", "bank_transfer", "ewallet", "cod"]
    total_idr: int = Field(gt=0)

    @field_validator("status", mode="before")
    @classmethod
    def _normalise_status(cls, v):
        return v.strip().lower() if isinstance(v, str) else v

    @field_validator("total_idr", mode="before")
    @classmethod
    def _parse_total(cls, v):
        if isinstance(v, str):
            text = v.strip()
            if text.lower().startswith("rp"):
                text = text[2:].strip().replace(".", "")  # "Rp 1.250.000" -> "1250000"
            return text
        return v

    @field_validator("order_ts", mode="before")
    @classmethod
    def _parse_ts(cls, v):
        if isinstance(v, str):
            text = v.strip()
            try:
                return datetime.strptime(text, "%d/%m/%Y %H:%M")
            except ValueError:
                return text  # let pydantic try ISO 8601
        return v


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
    """Yield one dict per CSV row, lazily. Never builds a list of all rows."""
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def validate(row: dict) -> OrderRow:
    return OrderRow.model_validate(row)


def _first_error(exc: ValidationError) -> str:
    err = exc.errors()[0]
    return f"{'.'.join(str(p) for p in err['loc'])}: {err['type']}"


def run(input_path, output_path, quarantine_path) -> Stats:
    """Stream input -> valid ndjson + quarantine ndjson. Atomic: failed runs leave old outputs untouched."""
    stats = Stats()
    seen = set()
    out_tmp, q_tmp = f"{output_path}.tmp", f"{quarantine_path}.tmp"
    try:
        with open(out_tmp, "w", encoding="utf-8") as out, open(q_tmp, "w", encoding="utf-8") as quarantine:
            for line_no, row in enumerate(read_orders(input_path), start=1):
                stats.read += 1
                try:
                    order = validate(row)
                except ValidationError as exc:
                    reason = _first_error(exc)
                    stats.invalid += 1
                    stats.reasons[reason] += 1
                    quarantine.write(json.dumps({"row": line_no, "reason": reason, "raw": row}, sort_keys=True) + "\n")
                    continue
                if order.order_id in seen:
                    stats.duplicates += 1
                    stats.reasons["duplicate"] += 1
                    quarantine.write(json.dumps({"row": line_no, "reason": "duplicate", "raw": row}, sort_keys=True) + "\n")
                    continue
                seen.add(order.order_id)
                stats.valid += 1
                out.write(json.dumps(order.model_dump(mode="json"), sort_keys=True) + "\n")
        os.replace(out_tmp, output_path)
        os.replace(q_tmp, quarantine_path)
    except BaseException:
        for tmp in (out_tmp, q_tmp):
            if os.path.exists(tmp):
                os.remove(tmp)
        raise
    logger.info("read=%d valid=%d duplicates=%d invalid=%d", stats.read, stats.valid, stats.duplicates, stats.invalid)
    return stats


def main(argv=None) -> int:
    """Exit code: 0 ok, 1 too many rejected rows, 2 could not run (bad input)."""
    parser = argparse.ArgumentParser(description="Validate KopiKu orders")
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("quarantine")
    parser.add_argument("--max-reject-rate", type=float, default=0.05)
    args = parser.parse_args(argv)
    try:
        stats = run(args.input, args.output, args.quarantine)
    except OSError as exc:
        logger.error("cannot process input: %s", exc)
        return 2
    if stats.reject_rate > args.max_reject_rate:
        logger.error("reject rate %.2f%% is above the limit of %.2f%%", stats.reject_rate * 100, args.max_reject_rate * 100)
        return 1
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(main())
