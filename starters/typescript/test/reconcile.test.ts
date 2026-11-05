import { test } from "node:test";
import assert from "node:assert/strict";
import type { Finding } from "../src/match.js";
import type { Transaction } from "../src/models.js";
import { reconcile } from "../src/reconcile.js";
import type { State } from "../src/state.js";

function tx(partial: Partial<Transaction> & Pick<Transaction, "source" | "id" | "amountCents">): Transaction {
  return {
    ref: partial.ref ?? partial.id ?? "no-id",
    timestamp: partial.timestamp ?? new Date("2026-03-01T00:00:00Z"),
    merchant: partial.merchant ?? "merchant",
    ...partial,
  };
}

function freshState(): State {
  return { rows: [], open: [] };
}

const bookedAt = new Date("2026-03-01T12:00:00Z");

function secondsLater(seconds: number): Date {
  return new Date(bookedAt.getTime() + seconds * 1000);
}

test("a matched pair is stored and reports nothing", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const ledger = tx({ source: "ledger", id: "a", amountCents: 100, ref: "L1" });

  const result = reconcile(freshState(), [provider], [ledger]);

  assert.deepEqual(result.newFindings, []);
  assert.deepEqual(result.resolved, []);
  assert.deepEqual(result.stillOpen, []);
  assert.deepEqual(result.state, { rows: [provider, ledger], open: [] });
});

test("a row only on one side is a new open finding", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });

  const result = reconcile(freshState(), [provider], []);

  assert.deepEqual(result.newFindings, [
    { kind: "missing_in_ledger", provider },
  ] satisfies Finding[]);
  assert.deepEqual(result.resolved, []);
  assert.deepEqual(result.stillOpen, []);
  assert.deepEqual(result.state.open, result.newFindings);
  assert.deepEqual(result.state.rows, [provider]);
});

test("running the same rows again adds nothing and keeps the finding open", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const first = reconcile(freshState(), [provider], []);

  const second = reconcile(first.state, [provider], []);

  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.resolved, []);
  assert.deepEqual(second.stillOpen, first.state.open);
  assert.deepEqual(second.state.rows, [provider]);
  assert.deepEqual(second.state.open, first.state.open);
});

test("a ledger row that arrives later resolves the stored provider finding", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const first = reconcile(freshState(), [provider], []);
  const ledger = tx({ source: "ledger", id: "a", amountCents: 100, ref: "L1" });

  const second = reconcile(first.state, [], [ledger]);

  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.resolved, first.state.open);
  assert.deepEqual(second.stillOpen, []);
  assert.deepEqual(second.state.rows, [provider, ledger]);
  assert.deepEqual(second.state.open, []);
});

test("an open finding stays open while a different one resolves", () => {
  const stays = tx({ source: "provider", id: "stay", amountCents: 10, ref: "stay" });
  const goes = tx({ source: "provider", id: "goes", amountCents: 20, ref: "goes" });
  const first = reconcile(freshState(), [stays, goes], []);
  const ledger = tx({ source: "ledger", id: "goes", amountCents: 20, ref: "L-goes" });

  const second = reconcile(first.state, [], [ledger]);

  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.resolved, [first.state.open[1]]);
  assert.deepEqual(second.stillOpen, [first.state.open[0]]);
  assert.deepEqual(second.state.open, second.stillOpen);
});

test("a repeated ledger ref keeps the row already stored", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const original = tx({ source: "ledger", id: "a", amountCents: 100, ref: "L1" });
  const first = reconcile(freshState(), [provider], [original]);
  const revised = tx({ source: "ledger", id: "a", amountCents: 999, ref: "L1", merchant: "changed" });

  const second = reconcile(first.state, [], [revised]);

  assert.deepEqual(second.state.rows, [provider, original]);
  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.resolved, []);
  assert.deepEqual(second.stillOpen, []);
});

test("a repeated provider row keeps the row already stored", () => {
  const original = tx({ source: "provider", id: "a", amountCents: 100, ref: "p1" });
  const first = reconcile(freshState(), [original], []);
  const revised = tx({ source: "provider", id: "a", amountCents: 100, ref: "p2", merchant: "merchant" });

  const second = reconcile(first.state, [revised], []);

  assert.deepEqual(second.state.rows, [original]);
  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.stillOpen, first.state.open);
});

test("a second provider amount for the same id becomes a duplicate and resolves the missing row", () => {
  const firstRow = tx({ source: "provider", id: "a", amountCents: 100, ref: "p1" });
  const first = reconcile(freshState(), [firstRow], []);
  const secondRow = tx({ source: "provider", id: "a", amountCents: 200, ref: "p2" });

  const second = reconcile(first.state, [secondRow], []);

  assert.deepEqual(second.resolved, first.state.open);
  assert.deepEqual(second.newFindings, [
    { kind: "duplicate_id", id: "a", rows: [firstRow, secondRow] },
  ] satisfies Finding[]);
  assert.deepEqual(second.stillOpen, []);
  assert.deepEqual(second.state.rows, [firstRow, secondRow]);
  assert.deepEqual(second.state.open, second.newFindings);
});

test("an amount mismatch stays open when the same rows are seen again", () => {
  const provider = tx({ source: "provider", id: "a", amountCents: 100 });
  const ledger = tx({ source: "ledger", id: "a", amountCents: 250, ref: "L1" });
  const first = reconcile(freshState(), [provider], [ledger]);

  const second = reconcile(first.state, [provider], [ledger]);

  assert.deepEqual(first.newFindings, [
    { kind: "amount_mismatch", provider, ledger },
  ] satisfies Finding[]);
  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.resolved, []);
  assert.deepEqual(second.stillOpen, first.state.open);
  assert.equal(second.state.rows.length, 2);
});

test("a null-id pair split across runs resolves once both rows are stored", () => {
  const provider = tx({
    source: "provider",
    id: null,
    amountCents: 100,
    ref: "file:1",
    timestamp: bookedAt,
  });
  const first = reconcile(freshState(), [provider], []);
  const ledger = tx({
    source: "ledger",
    id: null,
    amountCents: 100,
    ref: "L1",
    timestamp: secondsLater(30),
  });

  const second = reconcile(first.state, [], [ledger]);

  assert.deepEqual(first.newFindings, [
    { kind: "missing_in_ledger", provider },
  ] satisfies Finding[]);
  assert.deepEqual(second.resolved, first.state.open);
  assert.deepEqual(second.newFindings, []);
  assert.deepEqual(second.state.rows, [provider, ledger]);
  assert.deepEqual(second.state.open, []);
});

test("id findings are listed before null-id findings", () => {
  const withId = tx({ source: "provider", id: "a", amountCents: 10, ref: "a" });
  const withoutId = tx({
    source: "provider",
    id: null,
    amountCents: 20,
    ref: "file:2",
    timestamp: bookedAt,
  });

  const result = reconcile(freshState(), [withId, withoutId], []);

  assert.deepEqual(result.newFindings, [
    { kind: "missing_in_ledger", provider: withId },
    { kind: "missing_in_ledger", provider: withoutId },
  ] satisfies Finding[]);
});

test("reconcile does not change the state it was given", () => {
  const state = freshState();
  const provider = [tx({ source: "provider", id: "a", amountCents: 100 })];

  reconcile(state, provider, []);

  assert.deepEqual(state, { rows: [], open: [] });
  assert.equal(provider.length, 1);
});

test("empty inputs leave an empty state empty", () => {
  assert.deepEqual(reconcile(freshState(), [], []), {
    newFindings: [],
    resolved: [],
    stillOpen: [],
    state: { rows: [], open: [] },
  });
});
