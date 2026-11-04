# Data specification

Two systems export once a day. Both exports for a date cover **00:00:00 to 23:59:59 UTC** of that date. Which rows a system puts in which day's export is decided by that system, not by you. Timestamps are what the source system recorded.

Currency is always EUR. There is no multi-currency data.

## `data/provider-YYYY-MM-DD.jsonl` — payment provider

One JSON object per line.

| field | type | notes |
|---|---|---|
| `transaction_id` | string or `null` | Shared with the ledger when present. `null` means the provider did not attach one. |
| `amount_cents` | integer | Whole euro cents. `1999` is €19.99. |
| `currency` | string | Always `"EUR"`. |
| `captured_at` | string | ISO 8601, always UTC, always suffixed `Z`. Second precision. |
| `merchant` | string | The provider's merchant descriptor. Upper case, abbreviated, may carry a terminal number. |
| `status` | string | Always `"captured"` in this dataset. |

Example line:

```json
{"transaction_id": "pt_310c5ccfea70", "amount_cents": 3948, "currency": "EUR", "captured_at": "2026-03-01T00:00:26Z", "merchant": "BOL.COM", "status": "captured"}
```

Lines are ordered by `captured_at`.

## `data/ledger-YYYY-MM-DD.csv` — internal ledger

Comma separated, header row, UTF-8, no quoting needed for the values that occur.

| column | notes |
|---|---|
| `entry_id` | Ledger row identifier. Always present, unique within the ledger. `LG-` followed by digits. |
| `transaction_id` | Same identifier space as the provider. Empty string when the ledger has none. |
| `booked_at` | `YYYY-MM-DD HH:MM:SS`, **local time, Europe/Amsterdam, no offset in the string**. In early March 2026 that is UTC+1 throughout; there is no clock change inside this dataset. |
| `amount` | Euros as a decimal string with exactly two decimals and a dot separator. `19.99`. |
| `merchant` | The ledger's legal-entity name for the merchant. Differs from the provider's descriptor for the same merchant. |
| `cost_centre` | `CC-` followed by digits. Not present on the provider side. |

Example rows:

```csv
entry_id,transaction_id,booked_at,amount,merchant,cost_centre
LG-4184853,pt_721a55a9124f,2026-03-01 15:47:33,34.33,KLM N.V.,CC-4200
LG-4184871,,2026-03-01 11:02:09,249.00,Amazon EU S.a.r.l.,CC-4100
```

Rows are ordered by `entry_id`, which is not chronological.

## Normalisation rules

Whatever language you use, normalise both sides to the same shape before comparing:

| normalised field | provider | ledger |
|---|---|---|
| `id` | `transaction_id`, or none | `transaction_id`, or none when empty |
| `ref` | `transaction_id`, or `file:line` when there is none | `entry_id` |
| `amount_cents` | `amount_cents` as is | `amount` × 100, exact integer arithmetic, never float |
| `timestamp` | parse `captured_at` as UTC | parse `booked_at` as Europe/Amsterdam, convert to UTC |
| `merchant` | as is | as is |

The ledger books a transaction a short time after the provider captures it. Merchant strings never match textually across systems; the same merchant appears as `AMZN MKTPLACE EU` on one side and `Amazon EU S.a.r.l.` on the other.

`docs/normalize_golden.json` holds worked examples. Each starter's single test checks its `normalize()` against that file, so all languages produce identical values.
