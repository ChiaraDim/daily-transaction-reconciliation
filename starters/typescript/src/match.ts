import type { Transaction } from "../src/models.js";

export type Finding =
    | { kind: "missing_in_ledger"; provider: Transaction }
    | { kind: "missing_in_provider"; ledger: Transaction }
    | { kind: "amount_mismatch"; provider: Transaction; ledger: Transaction }
    //Same id more than once on a side, can't tell which row is the real one so a person has to check
    | { kind: "duplicate_id"; id: string; rows: Transaction[] };


export function matchById(provider: Transaction[], ledger: Transaction[]): Finding[] {
    const providerById = groupById(provider);
    const ledgerById = groupById(ledger);
    const ids = new Set([...providerById.keys(), ...ledgerById.keys()]);

    const findings: Finding[] = [];
    for (const id of ids) {
        const p = providerById.get(id) ?? [];
        const l = ledgerById.get(id) ?? [];

        if (p.length > 1 || l.length > 1) {
            findings.push({ kind: "duplicate_id", id, rows: [...p, ...l]});
        } else if (l.length === 0) {
            findings.push({ kind: "missing_in_ledger", provider: p[0]});
        } else if (p.length === 0) {
            findings.push({ kind: "missing_in_provider", ledger: l[0]});
        } else if (p[0].amountCents !== l[0].amountCents) {
            findings.push({ kind: "amount_mismatch", provider: p[0], ledger: l[0]});
        }
    }

    return findings;
}

function groupById(txs: Transaction[]): Map<string, Transaction[]> {
    const byId = new Map<string, Transaction[]>();

    for (const tx of txs) {
        if (tx.id === null) continue;
        const rows = byId.get(tx.id) ?? [];
        rows.push(tx);
        byId.set(tx.id, rows);
    }

    return byId;
}
