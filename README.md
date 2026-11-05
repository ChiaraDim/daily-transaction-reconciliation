# Daily transaction reconciliation

A command-line tool that compares the payment provider's export with the internal ledger for one day, and reports to finance what doesn't match: what's new since the last run, what got solved, and how much is still open.

The original assignment is in [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

## Running it

Needs Node 20 or later. Everything runs from the TypeScript starter folder:

```bash
cd starters/typescript
npm install

npm start -- run --date 2026-03-01
npm start -- run --date 2026-03-02
```

`npm start -- run --date …` is this project's version of `recon run --date …` from the brief.

- **State** is kept in `state/recon-state.json` at the repo root, so each run only reports what changed. Use `--state <file>` to put it somewhere else. To start over, delete it: `rm -rf state` from the repo root, or `rm -rf ../../state` from `starters/typescript`.
- **Data** is read from `data/` by default; use `--data-dir <path>` to point elsewhere.
- Running the same date twice is safe: the second run says "Nothing changed since the last run."

Other commands:

```bash
npm test            # unit tests
npm run typecheck
npm run explore     # the data exploration behind docs/data-exploration.md
```

## What the report looks like

Shortened output of the 2026-03-02 run, after 2026-03-01:

```
Reconciliation for 2026-03-02
Read 1973 provider payments and 1965 ledger bookings. Times are Amsterdam time.

10 new to look at, 6 solved since the last run.

NEW (10)

  Paid at the provider, not in the ledger (4)
    2 Mar, 03:16     €43.93  ETOS 0917        payment pt_a395d9c4cf75
    ...
  Amount differs between provider and ledger (3)
    2 Mar, 12:38     €23.85  DE BIJENKORF  payment pt_1e03a7f3035d: ledger has €24.20, €0.35 more
    ...

SOLVED SINCE THE LAST RUN (6)
  ...

STILL OPEN FROM EARLIER RUNS (19)
      8  paid at the provider, not in the ledger
      4  in the ledger, no payment at the provider
      5  amount differs between provider and ledger
      2  please check by hand
```

The report is written for finance, not engineers. It uses plain words (payments and bookings), shows euros and Amsterdam time, and is grouped by what to do. The cases the tool won't guess go under "Please check by hand". Items still open from earlier runs are counted, not listed again.

## How it works

1. **Read and normalise** both files (from the starter: `readers.ts`, `normalize.ts`).
2. **Match by transaction id** (`match.ts`): missing on either side, amount differs, or the same id more than once.
3. **Match rows without an id** (`match.ts`): same amount, ledger booked 0–3 minutes after the provider, and only if the pair is strictly one-to-one. Anything else goes to review.
4. **Compare with the previous run** (`reconcile.ts`, `state.ts`): every row seen so far is kept, all of them are matched again, and the findings are compared with the previous run's. That's what lets late rows solve older findings.
5. **Print the report** (`report.ts`).

## What I found in the data, and what I decided

I explored the data before writing any matching code. The details and numbers are in [docs/DATA_EXPLORATION.md](docs/DATA_EXPLORATION.md). In short:

| What I found | What I decided |
|---|---|
| Rows often arrive in the next day's file (5 of 9 ledger-only rows on day 1 got their provider row on day 2) | Keep state and match over all rows seen so far, so late rows solve the earlier finding |
| The provider re-exports some rows in two files | Recognise rows already seen and skip them, so they're never reported twice |
| The same id twice in one provider file, 4 seconds apart | Flag for review; don't pick one of the two |
| Amount differences in patterns (€0.35 extra, decimal shifts, swapped digits) | Report both amounts and the difference, compared exactly in cents; don't guess the cause |
| Rows without an id: most match on amount within 8–160s, one has two candidates | Match on amount plus a 3-minute window, only one-to-one; the rest goes to review |
| Exports cover a UTC day, finance thinks in Amsterdam time | Show Amsterdam time in the report and say so in the header |

## Questions I'd want answered before this goes live

- How long can a row arrive late before it counts as really missing? Today a one-sided row is reported straight away and stays open until its partner arrives.
- When amounts differ, which side is right: the provider or the ledger? And is the €0.35 a fee?
- Is `pt_9f6ceae92af2`, in the provider export twice, a double charge?
- Can one €249 Amazon payment really have two ledger bookings, or is that a double booking?
- Should the report follow the UTC day of the exports or the Amsterdam day? (This is close to Sanne's ticket FIN-118.)
- Why do some rows have no transaction id, and can that be fixed at the source?
- Are the 23:59:59 timestamps real capture times?

## Limitations, and what I'd do with another day

- **Nothing marks a missing row as final.** Once the grace period is known, the report should show how long each item has been open.
- **The state file keeps every row** (about 1.2 MB after two days) and each run re-matches all of them. With real volumes I'd keep only rows in open findings, plus recently matched ones so re-exports are still recognised.
- **Amount differences can't be detected for rows without an id,** since amount is what matches them. A mistyped amount shows up as one missing row on each side.
- **Provider rows without an id are recognised by their content** (amount, time, merchant). Two genuinely different payments identical to the second would be treated as one.
- **Provider rows without an id can only be referenced by file and line** in the report.
- The merchant names map one-to-one between the systems. That could be an extra check when matching rows without an id; I didn't need it for this data.

## How I worked

One branch and pull request per step, merged in this order:

1. Add data exploration script and findings
2. Match provider and ledger rows by transaction id
3. Match rows without a transaction id on amount and time
4. Keep state between runs and report only what changed
5. Add a report written for finance

Each PR description says what changed, the decisions behind it, and what it deliberately left out.

Time spent: about _2.5_ hours.

## Use of AI

I used Claude, during the whole exercise, mostly to write and check things with.

**What I used it for:**

- Writing commit messages, PR descriptions and documentation (this README and `docs/DATA_EXPLORATION.md`)
- Writing the tests
- Thinking through edge cases in the data: late rows, re-exports, duplicate ids, rows without an id
- Drafting functions in the matching, state and report code
- Reviewing my code and the tool's output