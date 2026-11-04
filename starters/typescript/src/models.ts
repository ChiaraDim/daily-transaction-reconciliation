/** One row from either export, normalised to a common shape. See docs/DATA_SPEC.md. */
export interface Transaction {
  source: "provider" | "ledger";
  /** transaction id shared by both systems; null when the row has none */
  id: string | null;
  /** always present: ledger entry_id, provider transaction id, or "file:line" */
  ref: string;
  /** whole euro cents, exact */
  amountCents: number;
  /** UTC instant */
  timestamp: Date;
  /** raw string from the source; the two systems never agree textually */
  merchant: string;
}
