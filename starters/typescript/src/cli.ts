/** recon run --date YYYY-MM-DD */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDay } from "./readers.js";
import { matchById, type Finding } from "./match.js";
import type { Transaction } from "./models.js"
import { isoSeconds } from "./normalize.js";

const DEFAULT_DATA_DIR = resolve(fileURLToPath(import.meta.url), "../../../../data");

function run(date: string, dataDir: string): number {
  const { provider, ledger } = loadDay(dataDir, date);
  console.log(`${date}: ${provider.length} provider records, ${ledger.length} ledger rows`);

  const findings = matchById(provider, ledger);
  for (const f of findings) console.log(describe(f));

  const noId = provider.filter((t) => t.id === null).length + ledger.filter((t) => t.id === null).length;
  console.log(`${findings.length} findings. ${noId} rows without a transaction id not checked yet`);

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
      return `DUPLICATE ID ${f.id} ${f.rows.length} rows: ${f.rows.map((r) => `${r.source} ${euros(r.amountCents)} ${isoSeconds(r.timestamp)}`).join("; ")}`;
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
    console.error("usage: recon run --date YYYY-MM-DD [--data-dir <path>]");
    return 2;
  }
  let date: string | undefined;
  let dataDir = DEFAULT_DATA_DIR;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--date") date = rest[++i];
    else if (rest[i] === "--data-dir") dataDir = resolve(rest[++i]);
  }
  if (!date) {
    console.error("--date is required");
    return 2;
  }
  return run(date, dataDir);
}

process.exit(main(process.argv.slice(2)));
