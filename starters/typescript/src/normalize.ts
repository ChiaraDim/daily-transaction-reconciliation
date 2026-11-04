/** Turn raw records into Transactions. Amount and timezone rules from docs/DATA_SPEC.md. */
import type { Transaction } from "./models.js";

export interface RawProvider {
  transaction_id: string | null;
  amount_cents: number;
  currency: string;
  captured_at: string;
  merchant: string;
  status: string;
}

export interface RawLedger {
  entry_id: string;
  transaction_id: string;
  booked_at: string;
  amount: string;
  merchant: string;
  cost_centre: string;
}

/** Europe/Amsterdam is UTC+1 for the whole of this dataset (early March 2026, before the clock change). */
const LEDGER_OFFSET_MINUTES = 60;

export function normalizeProvider(raw: RawProvider, fallbackRef: string): Transaction {
  const id = raw.transaction_id || null;
  return {
    source: "provider",
    id,
    ref: id ?? fallbackRef,
    amountCents: raw.amount_cents,
    timestamp: new Date(raw.captured_at), // trailing Z, parsed as UTC
    merchant: raw.merchant,
  };
}

export function normalizeLedger(raw: RawLedger): Transaction {
  const id = raw.transaction_id || null;
  return {
    source: "ledger",
    id,
    ref: raw.entry_id,
    amountCents: eurosToCents(raw.amount),
    timestamp: localAmsterdamToUtc(raw.booked_at),
    merchant: raw.merchant,
  };
}

/** "19.99" -> 1999 with string arithmetic; never go through a float. */
export function eurosToCents(amount: string): number {
  const m = /^(\d+)\.(\d{2})$/.exec(amount.trim());
  if (!m) throw new Error(`unexpected ledger amount: ${amount}`);
  return Number(m[1]) * 100 + Number(m[2]);
}

/** "2026-03-01 14:45:40" (Europe/Amsterdam, naive) -> UTC Date. */
export function localAmsterdamToUtc(booked: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(booked.trim());
  if (!m) throw new Error(`unexpected ledger timestamp: ${booked}`);
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  return new Date(asIfUtc - LEDGER_OFFSET_MINUTES * 60_000);
}

/** ISO 8601 with a Z suffix and second precision, the form used in docs/normalize_golden.json. */
export function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
