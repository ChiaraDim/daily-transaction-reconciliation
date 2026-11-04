using System.Globalization;

namespace Recon;

/// <summary>Turn raw records into Transactions. Amount and timezone rules from docs/DATA_SPEC.md.</summary>
public static class Normalize
{
    // Europe/Amsterdam is UTC+1 for the whole of this dataset (early March 2026, before the clock change).
    private static readonly TimeSpan LedgerOffset = TimeSpan.FromHours(1);

    public static Transaction Provider(RawProvider raw, string fallbackRef)
    {
        var id = string.IsNullOrEmpty(raw.TransactionId) ? null : raw.TransactionId;
        var ts = DateTimeOffset.ParseExact(raw.CapturedAt, "yyyy-MM-dd'T'HH:mm:ss'Z'",
            CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
        return new Transaction("provider", id, id ?? fallbackRef, raw.AmountCents, ts, raw.Merchant);
    }

    public static Transaction Ledger(RawLedger raw)
    {
        var id = string.IsNullOrEmpty(raw.TransactionId) ? null : raw.TransactionId;
        return new Transaction("ledger", id, raw.EntryId, EurosToCents(raw.Amount), LocalAmsterdamToUtc(raw.BookedAt), raw.Merchant);
    }

    /// <summary>"19.99" -> 1999 using decimal, never double.</summary>
    public static long EurosToCents(string amount)
    {
        var euros = decimal.Parse(amount.Trim(), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);
        return (long)(euros * 100m);
    }

    /// <summary>"2026-03-01 14:45:40" (Europe/Amsterdam, naive) -> UTC.</summary>
    public static DateTimeOffset LocalAmsterdamToUtc(string booked)
    {
        var local = DateTime.ParseExact(booked.Trim(), "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None);
        return new DateTimeOffset(local, LedgerOffset).ToUniversalTime();
    }
}
