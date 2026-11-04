"""Turn raw records into Transaction values. Amount and timezone rules from docs/DATA_SPEC.md."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from .models import Transaction

LEDGER_TZ = ZoneInfo("Europe/Amsterdam")


def normalize_provider(raw: dict, fallback_ref: str) -> Transaction:
    tid = raw.get("transaction_id") or None
    ts = datetime.strptime(raw["captured_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return Transaction(
        source="provider",
        id=tid,
        ref=tid or fallback_ref,
        amount_cents=int(raw["amount_cents"]),
        timestamp=ts,
        merchant=raw["merchant"],
    )


def normalize_ledger(raw: dict) -> Transaction:
    tid = raw.get("transaction_id") or None
    local = datetime.strptime(raw["booked_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=LEDGER_TZ)
    cents = int(Decimal(raw["amount"]) * 100)  # exact; never go through float
    return Transaction(
        source="ledger",
        id=tid,
        ref=raw["entry_id"],
        amount_cents=cents,
        timestamp=local.astimezone(timezone.utc),
        merchant=raw["merchant"],
    )
