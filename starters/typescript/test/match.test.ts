import { test } from "node:test";
import assert from "node:assert/strict";
import type { Transaction } from "../src/models.js";
import { MATCH_WINDOW_SECONDS, matchById, matchWithoutId, type Finding } from "../src/match.js";

function tx(partial: Partial<Transaction> & Pick<Transaction, "source" | "id" | "amountCents">): Transaction {
  return {
    ref: partial.ref ?? partial.id ?? "no-id",
    timestamp: partial.timestamp ?? new Date("2026-03-01T00:00:00Z"),
    merchant: partial.merchant ?? "merchant",
    ...partial,
  };
}

test("matching ids with the same amount produce no findings", () => {
  const provider = [tx({ source: "provider", id: "a", amountCents: 100 })];
  const ledger = [tx({ source: "ledger", id: "a", amountCents: 100, merchant: "other" })];

  assert.deepEqual(matchById(provider, ledger), []);
});

test("a provider row with no ledger row is missing in the ledger", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });

  assert.deepEqual(matchById([provider], []), [
    { kind: "missing_in_ledger", provider },
  ] satisfies Finding[]);
});

test("a ledger row with no provider row is missing in the provider", () => {
  const ledger = tx({ source: "ledger", id: "a", amountCents: 100 });

  assert.deepEqual(matchById([], [ledger]), [
    { kind: "missing_in_provider", ledger },
  ] satisfies Finding[]);
});

test("the same id with different amounts is an amount mismatch", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const ledger = tx({ source: "ledger", id: "a", amountCents: 250 });

  assert.deepEqual(matchById([provider], [ledger]), [
    { kind: "amount_mismatch", provider, ledger },
  ] satisfies Finding[]);
});

test("an id that appears more than once on one side is a duplicate", () => {
  const first = tx({ source: "provider", id: "a", amountCents: 100, ref: "p1" });
  const second = tx({ source: "provider", id: "a", amountCents: 100, ref: "p2" });
  const ledger = tx({ source: "ledger", id: "a", amountCents: 100 });

  assert.deepEqual(matchById([first, second], [ledger]), [
    { kind: "duplicate_id", id: "a", rows: [first, second, ledger] },
  ] satisfies Finding[]);
});

test("duplicates on the ledger are reported even when the provider has one row", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const first = tx({ source: "ledger", id: "a", amountCents: 100, ref: "l1" });
  const second = tx({ source: "ledger", id: "a", amountCents: 400, ref: "l2" });

  assert.deepEqual(matchById([provider], [first, second]), [
    { kind: "duplicate_id", id: "a", rows: [provider, first, second] },
  ] satisfies Finding[]);
});

test("a duplicated id with no counterpart is still a duplicate, not a missing row", () => {
  const first = tx({ source: "provider", id: "a", amountCents: 100, ref: "p1" });
  const second = tx({ source: "provider", id: "a", amountCents: 200, ref: "p2" });

  assert.deepEqual(matchById([first, second], []), [
    { kind: "duplicate_id", id: "a", rows: [first, second] },
  ] satisfies Finding[]);
});

test("matchById ignores rows with a null id", () => {
  const unnamed = tx({ source: "provider", id: null, amountCents: 100, ref: "file:1" });
  const alsoUnnamed = tx({ source: "ledger", id: null, amountCents: 100, ref: "L-1" });

  assert.deepEqual(matchById([unnamed], [alsoUnnamed]), []);
});

test("each id is classified on its own", () => {
  const matched = tx({ source: "provider", id: "ok", amountCents: 10 });
  const providerOnly = tx({ source: "provider", id: "only-p", amountCents: 20 });
  const ledgerOnly = tx({ source: "ledger", id: "only-l", amountCents: 30 });
  const providerMismatch = tx({ source: "provider", id: "diff", amountCents: 40 });
  const ledgerMismatch = tx({ source: "ledger", id: "diff", amountCents: 41 });

  const findings = matchById(
    [matched, providerOnly, providerMismatch],
    [
      tx({ source: "ledger", id: "ok", amountCents: 10 }),
      ledgerOnly,
      ledgerMismatch,
    ],
  );

  assert.deepEqual(findings, [
    { kind: "missing_in_ledger", provider: providerOnly },
    { kind: "amount_mismatch", provider: providerMismatch, ledger: ledgerMismatch },
    { kind: "missing_in_provider", ledger: ledgerOnly },
  ] satisfies Finding[]);
});

test("empty inputs produce no findings", () => {
  assert.deepEqual(matchById([], []), []);
  assert.deepEqual(matchWithoutId([], []), []);
});

const bookedAt = new Date("2026-03-01T12:00:00Z");

function secondsLater(seconds: number): Date {
  return new Date(bookedAt.getTime() + seconds * 1000);
}

test("a null-id pair with the same amount inside the window matches", () => {
  const provider = tx({
    source: "provider",
    id: null,
    amountCents: 100,
    timestamp: bookedAt,
    merchant: "card",
  });
  const ledger = tx({
    source: "ledger",
    id: null,
    amountCents: 100,
    timestamp: secondsLater(MATCH_WINDOW_SECONDS),
    merchant: "ledger text",
  });

  assert.deepEqual(matchWithoutId([provider], [ledger]), []);
});

test("a ledger row booked before the provider is not a match", () => {
  const provider = tx({ source: "provider", id: null, amountCents: 100, timestamp: bookedAt });
  const ledger = tx({
    source: "ledger",
    id: null,
    amountCents: 100,
    timestamp: secondsLater(-1),
  });

  assert.deepEqual(matchWithoutId([provider], [ledger]), [
    { kind: "missing_in_ledger", provider },
    { kind: "missing_in_provider", ledger },
  ] satisfies Finding[]);
});

test("the same amount just outside the window is missing on both sides", () => {
  const provider = tx({ source: "provider", id: null, amountCents: 100, timestamp: bookedAt });
  const ledger = tx({
    source: "ledger",
    id: null,
    amountCents: 100,
    timestamp: secondsLater(MATCH_WINDOW_SECONDS + 1),
  });

  assert.deepEqual(matchWithoutId([provider], [ledger]), [
    { kind: "missing_in_ledger", provider },
    { kind: "missing_in_provider", ledger },
  ] satisfies Finding[]);
});

test("a different amount is not a match", () => {
  const provider = tx({ source: "provider", id: null, amountCents: 100, timestamp: bookedAt });
  const ledger = tx({ source: "ledger", id: null, amountCents: 101, timestamp: secondsLater(10) });

  assert.deepEqual(matchWithoutId([provider], [ledger]), [
    { kind: "missing_in_ledger", provider },
    { kind: "missing_in_provider", ledger },
  ] satisfies Finding[]);
});

test("several ledger rows for one provider are an ambiguous match", () => {
  const provider = tx({ source: "provider", id: null, amountCents: 100, timestamp: bookedAt, ref: "p" });
  const first = tx({ source: "ledger", id: null, amountCents: 100, timestamp: secondsLater(8), ref: "l1" });
  const second = tx({ source: "ledger", id: null, amountCents: 100, timestamp: secondsLater(160), ref: "l2" });

  assert.deepEqual(matchWithoutId([provider], [first, second]), [
    { kind: "ambiguous_match", provider, candidates: [first, second] },
  ] satisfies Finding[]);
});

test("two providers that share one ledger row are both ambiguous", () => {
  const first = tx({ source: "provider", id: null, amountCents: 100, timestamp: bookedAt, ref: "p1" });
  const second = tx({
    source: "provider",
    id: null,
    amountCents: 100,
    timestamp: secondsLater(20),
    ref: "p2",
  });
  const ledger = tx({ source: "ledger", id: null, amountCents: 100, timestamp: secondsLater(30), ref: "l" });

  assert.deepEqual(matchWithoutId([first, second], [ledger]), [
    { kind: "ambiguous_match", provider: first, candidates: [ledger] },
    { kind: "ambiguous_match", provider: second, candidates: [ledger] },
  ] satisfies Finding[]);
});

test("a unique pair stays quiet while other null-id rows are reported", () => {
  const matchedProvider = tx({ source: "provider", id: null, amountCents: 100, timestamp: bookedAt, ref: "p-ok" });
  const unmatchedProvider = tx({
    source: "provider",
    id: null,
    amountCents: 200,
    timestamp: bookedAt,
    ref: "p-miss",
  });
  const matchedLedger = tx({
    source: "ledger",
    id: null,
    amountCents: 100,
    timestamp: secondsLater(8),
    ref: "l-ok",
  });
  const unmatchedLedger = tx({
    source: "ledger",
    id: null,
    amountCents: 300,
    timestamp: secondsLater(8),
    ref: "l-miss",
  });

  assert.deepEqual(matchWithoutId(
    [matchedProvider, unmatchedProvider],
    [matchedLedger, unmatchedLedger],
  ), [
    { kind: "missing_in_ledger", provider: unmatchedProvider },
    { kind: "missing_in_provider", ledger: unmatchedLedger },
  ] satisfies Finding[]);
});

test("matchWithoutId ignores rows that already have an id", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100, timestamp: bookedAt });
  const ledger = tx({ source: "ledger", id: "b", amountCents: 100, timestamp: secondsLater(10) });

  assert.deepEqual(matchWithoutId([provider], [ledger]), []);
});
