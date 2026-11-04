namespace Recon;

/// <summary>One row from either export, normalised to a common shape. See docs/DATA_SPEC.md.</summary>
/// <param name="Source">"provider" or "ledger".</param>
/// <param name="Id">Transaction id shared by both systems; null when the row has none.</param>
/// <param name="Ref">Always present: ledger entry_id, provider transaction id, or "file:line".</param>
/// <param name="AmountCents">Whole euro cents, exact.</param>
/// <param name="Timestamp">UTC instant.</param>
/// <param name="Merchant">Raw string from the source; the two systems never agree textually.</param>
public sealed record Transaction(
    string Source,
    string? Id,
    string Ref,
    long AmountCents,
    DateTimeOffset Timestamp,
    string Merchant);

public sealed record RawProvider(
    string? TransactionId,
    long AmountCents,
    string Currency,
    string CapturedAt,
    string Merchant,
    string Status);

public sealed record RawLedger(
    string EntryId,
    string TransactionId,
    string BookedAt,
    string Amount,
    string Merchant,
    string CostCentre);
