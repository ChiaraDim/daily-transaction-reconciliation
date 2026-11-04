import type { Transaction } from "../src/models.js";

export type Finding =
    | { kind: "missing_in_ledger"; provider: Transaction }
    | { kind: "missing_in_provider"; ledger: Transaction }
    | { kind: "amount_mismatch"; provider: Transaction; ledger: Transaction }
    //Same id more than once on a side, can't tell which row is the real one so a person has to check
    | { kind: "duplicate_id"; id: string; rows: Transaction[] }
    //Row without id that has more than one possible partner or shares its partner with another row
    | { kind: "ambiguous_match"; provider: Transaction; candidates: Transaction[] };


//With rows without an id, the ledger books between 8-160s after the provider in the data. 
// 3 mintues covers that with some margin
export const MATCH_WINDOW_SECONDS = 180;
    
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

export function matchWithoutId(provider: Transaction[], ledger: Transaction[]): Finding[] {
    const providerRows = provider.filter((t) => t.id === null);
    const ledgerRows = ledger.filter((t) => t.id === null);

    //Which ledger rows could belong to each provider row and the other way around
    const candidates = new Map<Transaction, Transaction[]>();
    const claimedBy = new Map<Transaction, Transaction[]>();

    for (const p of providerRows) {
        const found = ledgerRows.filter((l) => isCandidate(p,l));
        candidates.set(p, found);
        for (const l of found) claimedBy.set(l, [...(claimedBy.get(l) ?? []), p]);
    }

    const findings: Finding[] = [];
    for (const p of providerRows) {
        const found = candidates.get(p)!;
        if (found.length === 0) {
            findings.push({ kind: "missing_in_ledger", provider: p});
        } else if (found.length > 1 || claimedBy.get(found[0])!.length > 1) {
            findings.push({ kind: "ambiguous_match", provider: p, candidates: found});
        }
    }

    //A ledger row that some provider row could belong to is either matched or part of a review above
    for (const l of ledgerRows) {
        if (!claimedBy.has(l)) findings.push({ kind: "missing_in_provider", ledger: l});
    }

    return findings;
}

function isCandidate(p: Transaction, l: Transaction): boolean {
    const delaySeconds = (l.timestamp.getTime() - p.timestamp.getTime()) / 1000;
    
    return p.amountCents === l.amountCents && 
        delaySeconds >= 0 && 
        delaySeconds <= MATCH_WINDOW_SECONDS;
}
