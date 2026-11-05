import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Finding } from "./match.js";
import type { Transaction } from "./models.js"
import { isoSeconds } from "./normalize.js";

export interface State {
    rows: Transaction[];
    open: Finding[];
}

export function loadState(path: string): State {
    if (!existsSync(path)) return { rows: [], open: []};

    //Timestamps are stored as ISO strings so should turn them back into dates
    return JSON.parse(readFileSync(path, "utf-8"), (key, value) => (key === "timestamp" ? new Date(value): value));
}

export function saveState(path: string, state: State): void {
    mkdirSync(dirname(path), { recursive: true});
    
    //Write to a temp file and rename it so that a crash halfway never leaves a broken state file behind.
    const tmp = `${path}.tmp`;
    
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, path);
}

//The same row again gets the same key
export function rowKey(t: Transaction): string {
    if (t.source === "ledger") return `ledger|${t.ref}`;

    return `provider|${t.id ?? ""}|${t.amountCents}|${isoSeconds(t.timestamp)}|${t.merchant}`;
}

//Identifies a finding across runs to tell new ones from the ones that were already reported
export function findingKey(f: Finding): string {
    switch (f.kind) {
        case "missing_in_ledger": 
        case "ambiguous_match": 
            return `${f.kind}|${rowKey(f.provider)}`;
        case "missing_in_provider":
            return `${f.kind}|${rowKey(f.ledger)}`;
        case "amount_mismatch":
            return `${f.kind}|${f.provider.id}`;
        case "duplicate_id":
            return `${f.kind}|${f.id}`;
    }
}