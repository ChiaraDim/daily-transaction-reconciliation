/** recon run --date YYYY-MM-DD */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDay } from "./readers.js";
import { matchById, matchWithoutId, type Finding } from "./match.js";
import type { Transaction } from "./models.js"
import { isoSeconds } from "./normalize.js";
import { reconcile } from "./reconcile.js";
import { loadState, saveState } from "./state.js";

const DEFAULT_DATA_DIR = resolve(fileURLToPath(import.meta.url), "../../../../data");
const DEFAULT_STATE_FILE = resolve(fileURLToPath(import.meta.url), "../../../../state/recon-state.json");

function run(date: string, dataDir: string, stateFile: string): number {
  const { provider, ledger } = loadDay(dataDir, date);
  console.log(`${date}: ${provider.length} provider records, ${ledger.length} ledger rows`);

  const result = reconcile(loadState(stateFile), provider, ledger);
  saveState(stateFile, result.state);

  console.log(`\nNEW (${result.newFindings.length})`);
  for (const f of result.newFindings) console.log(describe(f));

  console.log(`\nRESOLVED SINCE LAST RUN (${result.resolved.length})`);
  for (const f of result.resolved) console.log(describe(f));

  console.log(`\nSTILL OPEN FROM EARLIER RUNS: ${result.stillOpen.length}`);

  return 0;
}

function describe(f: Finding): string {
  switch (f.kind) {
    case "missing_in_ledger":
      return `MISSING IN LEDGER ${row(f.provider)}`;
    case  "missing_in_provider": 
      return `MISSING IN PROVIDER ${row(f.ledger)}`;
    case "amount_mismatch":
      return `AMOUNT MISMATCH ${f.provider.id}  provider ${euros(f.provider.amountCents)}, 
      ledger ${euros(f.ledger.amountCents)} (${f.ledger.ref})`;
    case "duplicate_id":
      return `DUPLICATE ID ${f.id} ${f.rows.length} rows: ${f.rows.map((r) => 
        `${r.source} ${euros(r.amountCents)} ${isoSeconds(r.timestamp)}`).join("; ")}`;
    case "ambiguous_match":
      return `NEEDS REVIEW  ${row(f.provider)}  could be: ${f.candidates.map((c) => 
        `${c.ref} ${isoSeconds(c.timestamp)}`).join(", ")}`;
  }
}

function row(t: Transaction): string {
  return `${t.ref} ${euros(t.amountCents)} ${isoSeconds(t.timestamp)} ${t.merchant}`;
}

function euros(cents: number): string {
  return `€${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command !== "run") {
    console.error("usage: recon run --date YYYY-MM-DD [--data-dir <path>] [--state <file>]");
    return 2;
  }
  let date: string | undefined;
  let dataDir = DEFAULT_DATA_DIR;
  let stateFile = DEFAULT_STATE_FILE;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--date") date = rest[++i];
    else if (rest[i] === "--data-dir") dataDir = resolve(rest[++i]);
    else if (rest[i] === "--state") stateFile = resolve(rest[++i]);
  }
  if (!date) {
    console.error("--date is required");
    return 2;
  }
  return run(date, dataDir, stateFile);
}

process.exit(main(process.argv.slice(2)));
