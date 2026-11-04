import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Transaction } from "../src/models.js";
import { isoSeconds, normalizeLedger, normalizeProvider } from "../src/normalize.js";

const GOLDEN = resolve(fileURLToPath(import.meta.url), "../../../../docs/normalize_golden.json");
const golden = JSON.parse(readFileSync(GOLDEN, "utf-8"));

function asGolden(tx: Transaction) {
  return {
    source: tx.source,
    id: tx.id,
    ref: tx.ref,
    amount_cents: tx.amountCents,
    timestamp_utc: isoSeconds(tx.timestamp),
    merchant: tx.merchant,
  };
}

test("provider records normalise to the golden values", () => {
  for (const c of golden.provider) {
    assert.deepEqual(asGolden(normalizeProvider(c.raw, c.ref)), c.normalized, c.ref);
  }
});

test("ledger rows normalise to the golden values", () => {
  for (const c of golden.ledger) {
    assert.deepEqual(asGolden(normalizeLedger(c.raw)), c.normalized, c.raw.entry_id);
  }
});
