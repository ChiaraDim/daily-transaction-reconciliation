"""recon run --date YYYY-MM-DD"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .readers import load_day

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[3] / "data"


def run(date: str, data_dir: Path) -> int:
    provider, ledger = load_day(data_dir, date)
    print(f"{date}: {len(provider)} provider records, {len(ledger)} ledger rows")

    for tx in provider:
        # This is where the exercise starts.
        pass

    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="recon")
    sub = parser.add_subparsers(dest="command", required=True)
    p_run = sub.add_parser("run", help="reconcile one day")
    p_run.add_argument("--date", required=True, help="YYYY-MM-DD")
    p_run.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    args = parser.parse_args(argv)
    if args.command == "run":
        return run(args.date, args.data_dir)
    return 2


if __name__ == "__main__":
    sys.exit(main())
