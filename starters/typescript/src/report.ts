import type { Finding } from "./match.js";
import type { RunResult } from "./reconcile.js";
import type { Transaction } from "./models.js";

type Kind = Finding["kind"];

//Order and wording of the groups finance sees
const GROUPS: { title: string; kinds: Kind[] }[] = [
    { title: "Paid at the provider, not in the ledger", kinds: ["missing_in_ledger"] },
    { title: "In the ledger, no payment at the provider", kinds: ["missing_in_provider"] },
    { title: "Amount differs between provider and ledger", kinds: ["amount_mismatch"] },
    { title: "Please check by hand", kinds: ["duplicate_id", "ambiguous_match"] },
];

export function formatReport(date: string, providerRows: number, ledgerRows: number, result: RunResult): string {
    const { newFindings, resolved, stillOpen } = result;
    const out = [
        `Reconciliation for ${date}`,
        `Read ${providerRows} provider payments and ${ledgerRows} ledger bookings.`,
        "Times are Amsterdam time.",
        "",
        newFindings.length || resolved.length 
        ? `${newFindings.length} new to look at, ${resolved.length} solved since the last run.`
        : "Nothing changed since the last run.",
    ];

    out.push(...section("NEW", newFindings));
    out.push(...section("SOLVED SINCE THE LAST RUN", resolved));
    out.push("", `STILL OPEN FROM EARLIER RUNS (${stillOpen.length})`);

    for (const group of GROUPS) {
        const count = stillOpen.filter((f) => group.kinds.includes(f.kind)).length;
        if (count) out.push(`   ${String(count).padStart(3)}    ${group.title.toLowerCase()}`);
    }

    return out.join("\n");
}

//A titled block with the findings split into two groups above. Empty when there is nothing to show
function section(title: string, findings: Finding[]): string[] {
    if (findings.length === 0) return [];
    
    const out = ["", `${title} (${findings.length})`];
    
    for (const group of GROUPS) {
      const items = sortByTime(findings.filter((f) => group.kinds.includes(f.kind)));
      
      if (items.length === 0) continue;
      //Pad merchants to the longest in the group, so the columns line up
      const width = Math.max(...items.map((f) => mainRow(f).merchant.length));
      out.push("", `  ${group.title} (${items.length})`);
      
      for (const f of items) {
        const t = mainRow(f);
        out.push(`    ${time(t.timestamp)}  ${euros(t.amountCents).padStart(9)}  ${t.merchant.padEnd(width)}  ${detail(f)}`);
      }
    }
    return out;
}

//Whats specific to each kind of finding after the time, amount and merchant columns
function detail(f: Finding): string {
    switch (f.kind) {
      case "missing_in_ledger":
        return f.provider.id ? `payment ${f.provider.id}` : `${f.provider.ref}, no transaction id`;
      case "missing_in_provider":
        return `booking ${f.ledger.ref}${f.ledger.id ? ` for payment ${f.ledger.id}` : ", no transaction id"}`;
      case "amount_mismatch": {
        const diff = f.ledger.amountCents - f.provider.amountCents;
        const direction = diff > 0 ? "more" : "less";
        return `payment ${f.provider.id}: ledger has ${euros(f.ledger.amountCents)}, ${euros(Math.abs(diff))} ${direction}`;
      }
      case "duplicate_id": {
        const atProvider = f.rows.filter((r) => r.source === "provider").length;
        const inLedger = f.rows.length - atProvider;
        const question = "Charged twice, or a duplicate line?";
        return `payment ${f.id} is in the provider export ${atProvider}x and in the ledger ${inLedger}x. ${question}`;
      }
      case "ambiguous_match":
        return `no transaction id, could be any of these bookings: ${f.candidates
          .map((c) => `${c.ref} (${time(c.timestamp)})`)
          .join(", ")}`;
    }
  }

  function mainRow(f: Finding): Transaction {
    if (f.kind === "missing_in_provider") return f.ledger;
    if (f.kind === "duplicate_id") return f.rows[0];
    
    return f.provider;
  }
   
  function sortByTime(findings: Finding[]): Finding[] {
    return [...findings].sort((a, b) => mainRow(a).timestamp.getTime() - mainRow(b).timestamp.getTime());
  }
   
  const AMSTERDAM = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function time(d: Date): string {
    return AMSTERDAM.format(d);
  }
   
  function euros(cents: number): string {
    return `€${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
  }