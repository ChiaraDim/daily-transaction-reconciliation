import { test } from "node:test";
import assert from "node:assert/strict";
import type { Finding } from "../src/match.js";
import type { Transaction } from "../src/models.js";
import { formatReport } from "../src/report.js";
import type { RunResult } from "../src/reconcile.js";

function tx(partial: Partial<Transaction> & Pick<Transaction, "source" | "id" | "amountCents">): Transaction {
  return {
    ref: partial.ref ?? partial.id ?? "no-id",
    timestamp: partial.timestamp ?? new Date("2026-03-01T12:00:00Z"),
    merchant: partial.merchant ?? "merchant",
    ...partial,
  };
}

function result(partial: Partial<RunResult> = {}): RunResult {
  return {
    newFindings: [],
    resolved: [],
    stillOpen: [],
    state: { rows: [], open: [] },
    ...partial,
  };
}

test("an unchanged run names the date, the rows read, and that nothing changed", () => {
  const report = formatReport("2026-03-01", 2, 3, result());

  assert.equal(report, [
    "Reconciliation for 2026-03-01",
    "Read 2 provider payments and 3 ledger boookings.",
    "Times are Amsterdam time.",
    "",
    "Nothing changed since last run.",
    "",
    "STILL OPEN FROM EARLIER RUNS (0)",
  ].join("\n"));
});

test("still-open findings are counted by group and not listed again", () => {
  const missing = (id: string): Finding => ({
    kind: "missing_in_ledger",
    provider: tx({ source: "provider", id, amountCents: 100 }),
  });
  const duplicate: Finding = {
    kind: "duplicate_id",
    id: "dup",
    rows: [tx({ source: "provider", id: "dup", amountCents: 100, ref: "p1" })],
  };

  const report = formatReport("2026-03-02", 4, 5, result({
    stillOpen: [
      missing("a"),
      missing("b"),
      { kind: "missing_in_provider", ledger: tx({ source: "ledger", id: "c", amountCents: 100, ref: "L1" }) },
      {
        kind: "amount_mismatch",
        provider: tx({ source: "provider", id: "d", amountCents: 100 }),
        ledger: tx({ source: "ledger", id: "d", amountCents: 200, ref: "L2" }),
      },
      {
        kind: "ambiguous_match",
        provider: tx({ source: "provider", id: null, amountCents: 100, ref: "file:1" }),
        candidates: [tx({ source: "ledger", id: null, amountCents: 100, ref: "L3" })],
      },
      duplicate,
    ],
  }));

  assert.equal(report, [
    "Reconciliation for 2026-03-02",
    "Read 4 provider payments and 5 ledger boookings.",
    "Times are Amsterdam time.",
    "",
    "Nothing changed since last run.",
    "",
    "STILL OPEN FROM EARLIER RUNS (6)",
    "     2    paid at the provider, not in the ledger",
    "     1    in the ledger, no payment at the provider",
    "     1    amount differs between provider and ledger",
    "     1    please check by hand",
  ].join("\n"));
});

test("new and solved findings are printed in group order, earliest first", () => {
  const early = tx({
    source: "provider",
    id: null,
    amountCents: 50,
    ref: "file:1",
    merchant: "A",
    timestamp: new Date("2026-03-01T08:00:00Z"),
  });
  const later = tx({
    source: "provider",
    id: "pay-1",
    amountCents: 100,
    merchant: "Cafe Nero",
    timestamp: new Date("2026-03-01T12:00:00Z"),
  });
  const bus = tx({
    source: "ledger",
    id: null,
    amountCents: 300,
    ref: "L0",
    merchant: "Bus",
    timestamp: new Date("2026-03-01T07:00:00Z"),
  });
  const bakery = tx({
    source: "ledger",
    id: "pay-2",
    amountCents: 250,
    ref: "L2",
    merchant: "Bakery",
    timestamp: new Date("2026-03-01T13:00:00Z"),
  });
  const tram = tx({
    source: "provider",
    id: "pay-3",
    amountCents: 1000,
    merchant: "Tram",
    timestamp: new Date("2026-03-01T15:00:00Z"),
  });
  const tramLedger = tx({
    source: "ledger",
    id: "pay-3",
    amountCents: 800,
    ref: "L3",
    timestamp: new Date("2026-03-01T15:00:08Z"),
  });
  const kiosk = tx({
    source: "provider",
    id: null,
    amountCents: 75,
    ref: "file:9",
    merchant: "Kiosk",
    timestamp: new Date("2026-03-01T10:00:00Z"),
  });
  const laterBooking = tx({
    source: "ledger",
    id: null,
    amountCents: 75,
    ref: "L8",
    timestamp: new Date("2026-03-01T10:02:00Z"),
  });
  const earlierBooking = tx({
    source: "ledger",
    id: null,
    amountCents: 75,
    ref: "L9",
    timestamp: new Date("2026-03-01T10:01:00Z"),
  });
  const solved = tx({
    source: "provider",
    id: "pay-9",
    amountCents: 400,
    merchant: "Done",
    timestamp: new Date("2026-03-01T09:00:00Z"),
  });

  const report = formatReport("2026-03-01", 8, 9, result({
    newFindings: [
      { kind: "ambiguous_match", provider: kiosk, candidates: [laterBooking, earlierBooking] },
      { kind: "amount_mismatch", provider: tram, ledger: tramLedger },
      { kind: "missing_in_provider", ledger: bakery },
      { kind: "missing_in_provider", ledger: bus },
      { kind: "missing_in_ledger", provider: later },
      { kind: "missing_in_ledger", provider: early },
    ],
    resolved: [{ kind: "missing_in_ledger", provider: solved }],
  }));

  assert.equal(report, [
    "Reconciliation for 2026-03-01",
    "Read 8 provider payments and 9 ledger boookings.",
    "Times are Amsterdam time.",
    "",
    "6 new to look at, 1 solved since the last run.",
    "",
    "NEW (6)",
    "",
    "  Paid at the provider, not in the ledger (2)",
    "    1 Mar, 09:00      €0.50  A          file:1, no transaction id",
    "    1 Mar, 13:00      €1.00  Cafe Nero  payment pay-1",
    "",
    "  In the ledger, no payment at the provider (2)",
    "    1 Mar, 08:00      €3.00  Bus     booking L0, no transaction id",
    "    1 Mar, 14:00      €2.50  Bakery  booking L2 for payment pay-2",
    "",
    "  Amount differs between provider and ledger (1)",
    "    1 Mar, 16:00     €10.00  Tram  payment pay-3: ledger has €8.00, ",
    "            €2.00 less",
    "",
    "  Please check by hand (1)",
    "    1 Mar, 11:00      €0.75  Kiosk  no transaction id, could be any of these bookings: L8 (1 Mar, 11:02), L9 (1 Mar, 11:01)",
    "",
    "SOLVED SINCE THE LAST RUN (1)",
    "",
    "  Paid at the provider, not in the ledger (1)",
    "    1 Mar, 10:00      €4.00  Done  payment pay-9",
    "",
    "STILL OPEN FROM EARLIER RUNS (0)",
  ].join("\n"));
});

test("a ledger amount above the provider amount is described as more", () => {
  const provider = tx({
    source: "provider",
    id: "m",
    amountCents: 100,
    merchant: "More",
    timestamp: new Date("2026-03-01T12:00:00Z"),
  });
  const ledger = tx({ source: "ledger", id: "m", amountCents: 150, ref: "L1" });

  const report = formatReport("2026-03-01", 1, 1, result({
    newFindings: [{ kind: "amount_mismatch", provider, ledger }],
  }));

  assert.equal(report, [
    "Reconciliation for 2026-03-01",
    "Read 1 provider payments and 1 ledger boookings.",
    "Times are Amsterdam time.",
    "",
    "1 new to look at, 0 solved since the last run.",
    "",
    "NEW (1)",
    "",
    "  Amount differs between provider and ledger (1)",
    "    1 Mar, 13:00      €1.00  More  payment m: ledger has €1.50, ",
    "            €0.50 more",
    "",
    "STILL OPEN FROM EARLIER RUNS (0)",
  ].join("\n"));
});

test("a duplicate id is counted but not printed", () => {
  const row = tx({ source: "provider", id: "dup", amountCents: 100, ref: "p1" });
  const report = formatReport("2026-03-01", 2, 0, result({
    newFindings: [{ kind: "duplicate_id", id: "dup", rows: [row, { ...row, ref: "p2" }] }],
  }));

  assert.equal(report, [
    "Reconciliation for 2026-03-01",
    "Read 2 provider payments and 0 ledger boookings.",
    "Times are Amsterdam time.",
    "",
    "1 new to look at, 0 solved since the last run.",
    "",
    "NEW (1)",
    "",
    "STILL OPEN FROM EARLIER RUNS (0)",
  ].join("\n"));
});

test("summer times are shown in Amsterdam daylight time", () => {
  const provider = tx({
    source: "provider",
    id: "s",
    amountCents: 100,
    merchant: "Summer",
    timestamp: new Date("2026-07-01T12:00:00Z"),
  });

  const report = formatReport("2026-07-01", 1, 0, result({
    newFindings: [{ kind: "missing_in_ledger", provider }],
  }));

  assert.equal(report, [
    "Reconciliation for 2026-07-01",
    "Read 1 provider payments and 0 ledger boookings.",
    "Times are Amsterdam time.",
    "",
    "1 new to look at, 0 solved since the last run.",
    "",
    "NEW (1)",
    "",
    "  Paid at the provider, not in the ledger (1)",
    "    1 Jul, 14:00      €1.00  Summer  payment s",
    "",
    "STILL OPEN FROM EARLIER RUNS (0)",
  ].join("\n"));
});
