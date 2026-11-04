/** Read the two export formats and return normalised Transactions. */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Transaction } from "./models.js";
import { normalizeLedger, normalizeProvider, type RawLedger, type RawProvider } from "./normalize.js";

export function readProvider(path: string): Transaction[] {
  const file = basename(path);
  const out: Transaction[] = [];
  readFileSync(path, "utf-8").split("\n").forEach((line, i) => {
    if (line.trim()) out.push(normalizeProvider(JSON.parse(line) as RawProvider, `${file}:${i + 1}`));
  });
  return out;
}

export function readLedger(path: string): Transaction[] {
  const [header, ...lines] = readFileSync(path, "utf-8").split(/\r?\n/).filter((l) => l.length > 0);
  const cols = header.split(",");
  return lines.map((line) => {
    const cells = splitCsvLine(line);
    const raw = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""])) as unknown as RawLedger;
    return normalizeLedger(raw);
  });
}

/** Both exports for one date. Throws if either file is missing. */
export function loadDay(dataDir: string, date: string): { provider: Transaction[]; ledger: Transaction[] } {
  return {
    provider: readProvider(join(dataDir, `provider-${date}.jsonl`)),
    ledger: readLedger(join(dataDir, `ledger-${date}.csv`)),
  };
}

/** Minimal RFC 4180 line splitter: handles quoted cells and doubled quotes, no embedded newlines. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}
