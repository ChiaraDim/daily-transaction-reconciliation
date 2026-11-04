import json
import unittest
from pathlib import Path

from recon.normalize import normalize_ledger, normalize_provider

GOLDEN = Path(__file__).resolve().parents[3] / "docs" / "normalize_golden.json"


def as_dict(tx):
    return {
        "source": tx.source,
        "id": tx.id,
        "ref": tx.ref,
        "amount_cents": tx.amount_cents,
        "timestamp_utc": tx.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "merchant": tx.merchant,
    }


class NormalizeGolden(unittest.TestCase):
    def setUp(self):
        self.golden = json.loads(GOLDEN.read_text(encoding="utf-8"))

    def test_provider(self):
        for case in self.golden["provider"]:
            with self.subTest(ref=case["ref"]):
                self.assertEqual(as_dict(normalize_provider(case["raw"], case["ref"])), case["normalized"])

    def test_ledger(self):
        for case in self.golden["ledger"]:
            with self.subTest(entry=case["raw"]["entry_id"]):
                self.assertEqual(as_dict(normalize_ledger(case["raw"])), case["normalized"])


if __name__ == "__main__":
    unittest.main()
