import { matchById, matchWithoutId, type Finding } from "./match.js";
import type { Transaction } from "./models.js";
import { findingKey, rowKey, type State } from "./state.js";


export interface RunResult {
    newFindings: Finding[];
    resolved: Finding[];
    stillOpen: Finding[];
    state: State;
}

export function reconcile(state: State, provider: Transaction[], ledger: Transaction[]): RunResult {
    //Rows already in state are skipped so the re-exports and re-runs don't add anything
    const rows = new Map(state.rows.map((t) => [rowKey(t), t]));

    for (const t of [...provider, ...ledger]) {
        if (!rows.has(rowKey(t))) rows.set(rowKey(t), t);
    }

    const all = [...rows.values()];

    //Matching runs over all rows, not just todays.
    const allProviders = all.filter((t) => t.source === "provider");
    const allLedgers = all.filter((t) => t.source === "ledger");
    const findings = [...matchById(allProviders,allLedgers), ...matchWithoutId(allProviders, allLedgers)];

    const before = new Set(state.open.map(findingKey));
    const now = new Set(findings.map(findingKey));

    return {
        newFindings: findings.filter((f) => !before.has(findingKey(f))),
        resolved: state.open.filter((f) => !now.has(findingKey(f))),
        stillOpen: findings.filter((f) => before.has(findingKey(f))),
        state: { rows: all, open: findings},
    };

}