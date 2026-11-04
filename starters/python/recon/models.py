from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Transaction:
    """One row from either export, normalised to a common shape. See docs/DATA_SPEC.md."""

    source: str          # "provider" or "ledger"
    id: str | None       # transaction id shared by both systems; None when the row has none
    ref: str             # always present: ledger entry_id, provider transaction id, or "file:line"
    amount_cents: int    # whole euro cents, exact
    timestamp: datetime  # timezone-aware, UTC
    merchant: str        # raw string from the source; the two systems never agree textually
