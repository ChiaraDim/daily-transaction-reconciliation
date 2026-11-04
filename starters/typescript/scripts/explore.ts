import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDay } from "../src/readers.js";
import type { Transaction } from "../src/models.js";
import { isoSeconds } from "../src/normalize.js";

const DATA_DIR = resolve(fileURLToPath(import.meta.url), "../../../../data");
const DATES = ["2026-03-01", "2026-03-02"];
const WINDOW_SECONDS = 600; //wide on purpose to see where the real delays fall

type Pair = { id: string; prov: Transaction; led: Transaction };

function groupById(txs: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  
  for (const t of txs) {
    if (t.id === null) continue;
    const list = map.get(t.id) ?? [];
    list.push(t);
    map.set(t.id, list);
  }
  return map;
}

// Output helpers
function euros(cents: number): string {
    const abs = Math.abs(cents);
    return `${cents < 0 ? "-" : ""}€${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function list(ids: string[]): string{
    return ids.length ? ids.join(", ") : "none";
}

function idsOf(txs: Transaction[]): Set<string> {
    return new Set(txs.flatMap((t) => (t.id ? [t.id] : [])));
}

function recordCounts(provider: Transaction[], ledger: Transaction[]) {
  console.log(`Records: ${provider.length} provider, ${ledger.length} ledger`);
}

// IDs — missing, duplicated, one-sided. Returns the pairs matched by ID
function idChecks(provider: Transaction[], ledger: Transaction[]): Pair[] {
  const p = groupById(provider);
  const l = groupById(ledger);
  const noIdP = provider.filter((t) => t.id === null).length;
  const noIdL = ledger.filter((t) => t.id === null).length;
  
  console.log(`Without id: ${noIdP} provider, ${noIdL} ledger`);

  for (const [side, map] of [["provider", p], ["ledger", l]] as const) {
    for (const [id, list] of map) {
        if (list.length > 1) console.log(`  Duplicate id on ${side}: ${id} → ${list.map((t) => 
            `${euros(t.amountCents)} ${isoSeconds(t.timestamp)}`).join(", ")}`);
    }
  }

  const onlyP = [...p.keys()].filter((id) => !l.has(id));
  const onlyL = [...l.keys()].filter((id) => !p.has(id));
  
  console.log(`Ids only in provider (${onlyP.length}): ${list(onlyP)}`);
  console.log(`Ids only in ledger (${onlyL.length}): ${list(onlyL)}`);

  const pairs: Pair[] = [];
  for (const [id, provList] of p) {
    const ledList = l.get(id);
    // Takes the first record of each; duplicates were reported above
    if (ledList) pairs.push({ id, prov: provList[0], led: ledList[0] });
  }
  return pairs;
}

// Amount differences between ID-matched pairs
function amountDiffs(pairs: Pair[]) {
  const diffs = pairs.filter((x) => x.prov.amountCents !== x.led.amountCents);
  console.log(`Amount differences: ${diffs.length}`);
  
  for (const { id, prov, led } of diffs) {
    const d = led.amountCents - prov.amountCents;
    console.log(`  ${id}: provider ${euros(prov.amountCents)}, ledger ${euros(led.amountCents)} (${d > 0 ? "+" : ""}${euros(d)})`);
  }
}

// How long after the provider does the ledger record a transaction?
function ledgerDelay(pairs: Pair[]) {
  const delays = pairs.map((x) => (x.led.timestamp.getTime() - x.prov.timestamp.getTime()) / 1000);
  const negative = delays.filter((d) => d < 0).length;
  
  console.log(`Ledger delay (s): min ${Math.min(...delays)}, max ${Math.max(...delays)}, ledger earlier: ${negative}`);
}

// Records whose UTC date differs from the files date
function datedOutsideDay(date: string, provider: Transaction[], ledger: Transaction[]) {
  const outside = [...provider, ...ledger].filter((t) => t.timestamp.toISOString().slice(0, 10) !== date);
  
  console.log(`Records dated outside ${date} (UTC): ${outside.length}`);
  
  for (const t of outside) console.log(`  ${t.source} ${t.ref} ${isoSeconds(t.timestamp)}`);
}

// For each record without an ID, how many candidates on the other side?
function noIdCandidates(provider: Transaction[], ledger: Transaction[]) {
    for (const [side, mine, theirs] of [["provider", provider, ledger], ["ledger", ledger, provider]] as const) {
        const counts = { none: 0, one: 0, several: 0 };
        const delays: number[] = [];
        const details: string[] = [];
        
        for (const t of mine.filter((x) => x.id === null)) {
            const candidates = theirs.filter((o) => {
                if (o.id !== null || o.amountCents !== t.amountCents) return false;
                // delay = ledger time − provider time; must be between 0 and the window
                const delayMs = side === "provider"
                    ? o.timestamp.getTime() - t.timestamp.getTime()
                    : t.timestamp.getTime() - o.timestamp.getTime();
                return delayMs >= 0 && delayMs <= WINDOW_SECONDS * 1000;
            });
            if (candidates.length === 0) {
                counts.none++;
                details.push(`  No candidate: ${t.ref}  ${euros(t.amountCents)}  ${isoSeconds(t.timestamp)}  ${t.merchant}`)
            } else if (candidates.length === 1) {
                counts.one++;
                const [p, l] = side === "provider" ? [t, candidates[0]] : [candidates[0], t];
                delays.push((l.timestamp.getTime() - p.timestamp.getTime()) / 1000);                
            } else {
                counts.several++;
                details.push(`  Ambiguous: ${t.ref}  ${euros(t.amountCents)}  ${t.merchant} → ${list(candidates.map((o) => o.ref))}`);
            }
        }
        console.log(`${side} rows without id (window ${WINDOW_SECONDS}s): ${counts.one} with one candidate, 
            ${counts.none} with none, ${counts.several} with several`);
        console.log(`  delay of the unique matches (s): min ${Math.min(...delays)}, max ${Math.max(...delays)}`);

        for (const line of details) console.log(line);
    }
}

// Which provider merchant name goes with which ledger name (both days together)
function merchants(pairs: Pair[]) {
  const names = new Map<string, Set<string>>();

  for (const { prov, led } of pairs) {
    if (!names.has(prov.merchant)) names.set(prov.merchant, new Set());
    names.get(prov.merchant)!.add(led.merchant);
  }

  const width = Math.max(...[...names.keys()].map((n) => n.length));
  for (const [p, ls] of names) console.log(`  ${p.padEnd(width)} → ${[...ls].join(" | ")}`);

  const ambiguous = [...names.values()].filter((ls) => ls.size > 1).length;
  console.log(`${names.size} provider names, ${ambiguous} map to more than one ledger name`);
}

// Run every check for each day
const idsPerDay = new Map<string, {provider: Set<string>; ledger: Set<string>}>();
const allPairs: Pair[] = [];

for (const date of DATES) {
  const { provider, ledger } = loadDay(DATA_DIR, date);
  console.log(`\n=== ${date} ===`);
  
  recordCounts(provider, ledger);
  const pairs = idChecks(provider, ledger);
  amountDiffs(pairs);
  ledgerDelay(pairs);
  datedOutsideDay(date, provider, ledger);
  noIdCandidates(provider, ledger);

  allPairs.push(...pairs);
  idsPerDay.set(date, {provider: idsOf(provider), ledger: idsOf(ledger)});
}

// Across days, the same row exported twice vs the other side arriving a day late
const [day1, day2] = DATES.map((d) => idsPerDay.get(d)!);
const inBoth = (a: Set<string>, b: Set<string>) => [...a].filter((id) => b.has(id));

console.log("\n=== Across Days ===");
console.log(`Re-exported, provider: ${list(inBoth(day1.provider, day2.provider))}`);
console.log(`Re-exported, ledger: ${list(inBoth(day1.ledger, day2.ledger))}`);

const lateLedger = [...day1.provider].filter((id) => !day1.ledger.has(id) && day2.ledger.has(id));
const lateProvider = [...day1.ledger].filter((id) => !day1.provider.has(id) && day2.provider.has(id));

console.log(`Day-1 provider-only, ledger arrived on day 2: ${list(lateLedger)}`);
console.log(`Day-1 ledger-only, provider arrived on day 2: ${list(lateProvider)}`);

console.log("\n=== Merchant Names (provider → ledger) ===");
merchants(allPairs);
