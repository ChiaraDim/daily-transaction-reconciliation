"""Read the two export formats and yield normalised Transactions."""
from __future__ import annotations

import csv
import json
from collections.abc import Iterator
from pathlib import Path

from .models import Transaction
from .normalize import normalize_ledger, normalize_provider


def read_provider(path: Path) -> Iterator[Transaction]:
    with open(path, encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            if line.strip():
                yield normalize_provider(json.loads(line), fallback_ref=f"{path.name}:{line_no}")


def read_ledger(path: Path) -> Iterator[Transaction]:
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            yield normalize_ledger(row)


def load_day(data_dir: Path, date: str) -> tuple[list[Transaction], list[Transaction]]:
    """Both exports for one date, as lists. Raises FileNotFoundError if either is absent."""
    provider = list(read_provider(data_dir / f"provider-{date}.jsonl"))
    ledger = list(read_ledger(data_dir / f"ledger-{date}.csv"))
    return provider, ledger
