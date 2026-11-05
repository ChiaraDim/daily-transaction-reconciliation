# Data Exploration

The numbers below come from `npm run explore` in `starters/typescript` (`scripts/explore.ts`).

## Shape

|                               | provider | ledger |
|-------------------------------|---------:|-------:|
| 03-01 rows                    | 1986     | 1986   |
| 03-01 without transaction id  | 19       | 18     |
| 03-02 rows                    | 1973     | 1965   |
| 03-02 without transaction id  | 6        | 6      |

- Currency and status: DATA_SPEC says they are always EUR and `captured`, so I don't look at them.
- When both sides have the same id, the ledger books 0 to 90 seconds after the provider captures, never before.

## Findings

### 1. Rows land in another day's file

DATA_SPEC states that each export covers one UTC day, but each system decides which rows go in which file. Both spill over:

- The 03-02 provider file has 10 rows captured on 03-01.
- The 03-02 ledger file has 2 rows booked on 03-01, one of them at 10:56 UTC.
- The 03-01 ledger file has 3 rows booked just after midnight UTC on 03-02.

The possible conclusion is that "missing" on day 1 often just means "late". Of the 9 IDs only in the 03-01 ledger, 5 show up in the 03-02 provider file. Of the 7 only in the 03-01 provider file, 1 shows up in the 03-02 ledger. That leaves 4 and 6 still unmatched after day 2.

So a day can't be reconciled on its own. Unmatched rows have to be kept and checked again in later runs.

### 2. The same provider row in two files

`pt_27c4d852592b`, `pt_684c737828f6` and `pt_724ca1763f2a` are in both provider files. Their ledger rows are only in the 03-01 ledger. Checking day 2 on its own would report them as missing from the ledger, which is wrong.

So the transaction IDs have to be deduplicated across runs, not just within one file.

Also, 5 provider rows and 1 ledger row are at exactly 23:59:59Z. Are those real times, or is something clamping to the cut-off?

### 3. Duplicate id within one file

`pt_9f6ceae92af2` is in the 03-01 provider file twice, both €24.18 and 4 seconds apart. The ledger has it once. This could be a double charge or a duplicated export line, and I can't truly tell which from the data.

So I would flag it for review and not pick one of the two.

### 4. Amount differences

8 in total (5 on 03-01, 3 on 03-02). Shown as provider / ledger, they fall into patterns:

- Ledger exactly €0.35 higher: 78.08 / 78.43, 29.27 / 29.62, 23.85 / 24.20
- Ledger 10x higher, decimal point shifted: 19.57 / 195.70, 10.01 / 100.10
- Two digits swapped: 19.42 / 19.24, 34.57 / 34.75
- Rounded to the euro: 34.23 / 34.00

So I would report both amounts and the difference, compare exactly in cents, and not try to guess the cause.

### 5. Rows without a transaction id

Searching for a ledger row with the exact same amount, booked up to 10 minutes after the capture:

- 03-01: 16 of the 19 provider rows have exactly one candidate, with delays of 8 to 155 seconds.
- 03-02: 6 of 6, with delays of 10 to 160 seconds.
- No match is further away than 160 seconds. That's longer than the 90 seconds seen for rows with an id, so a 90-second window would miss some.
- ALBERT HEIJN €21.00 and ZIGGO €150.34 (03-01) have no ledger candidate.
- AMZN MKTPLACE EU €249.00 (03-01) has two ledger candidates, LG-4184873 and LG-4186763. Looking from the ledger side, each of those has exactly one candidate: the same provider row. So "one candidate each" doesn't mean the match is one to one.
- Provider rows without an id get `file:line` as their reference. If one were re-exported the next day, that reference would change, so these rows can't be deduplicated across runs by reference.

Merchant names never match as text, but each of the 24 provider names maps to exactly one ledger name. That could be an extra check later; the first version doesn't use it.

So I would match on amount plus a time window and flag anything that isn't strictly one to one.

## Decisions so far (could change later on)

- Match on transaction id first; only rows without an id go through amount and time matching.
- The window for rows without an id is 3 minutes: the largest delay seen is 160 seconds, plus some margin.
- A row missing on one side is reported but stays open, so a later run can resolve it.
- More than one candidate or a duplicate id means flag for review instead of choosing.
- Amounts are compared exactly in cents, with no tolerance.

## Questions for finance

1. How late can a row legitimately arrive? After how many days does "missing" really mean missing?
2. When amounts differ, which is the source of truth: the provider or the ledger?
3. What is the €0.35? A fee that should be booked separately?
4. Is the duplicated `pt_9f6ceae92af2` a double charge to the customer?
5. Are the 23:59:59 timestamps real capture times?
6. Should the report follow the UTC day (like the exports) or the Amsterdam day?
7. Can the same amount at the same merchant twice within minutes be legitimate (the €249 Amazon case)?
8. Why do some rows have no transaction id at all? Can that be fixed at the source?