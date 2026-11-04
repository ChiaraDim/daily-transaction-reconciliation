using System.Text.Json;
using Recon;
using Xunit;

public class NormalizeTests
{
    private static readonly JsonDocument Golden =
        JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "normalize_golden.json")));

    private static readonly JsonSerializerOptions Snake = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    private static string AsGolden(Transaction tx) => JsonSerializer.Serialize(new
    {
        source = tx.Source,
        id = tx.Id,
        @ref = tx.Ref,
        amount_cents = tx.AmountCents,
        timestamp_utc = tx.Timestamp.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"),
        merchant = tx.Merchant,
    });

    private static string Canonical(JsonElement e) => JsonSerializer.Serialize(new
    {
        source = e.GetProperty("source").GetString(),
        id = e.GetProperty("id").ValueKind == JsonValueKind.Null ? null : e.GetProperty("id").GetString(),
        @ref = e.GetProperty("ref").GetString(),
        amount_cents = e.GetProperty("amount_cents").GetInt64(),
        timestamp_utc = e.GetProperty("timestamp_utc").GetString(),
        merchant = e.GetProperty("merchant").GetString(),
    });

    [Fact]
    public void ProviderRecordsNormaliseToGoldenValues()
    {
        foreach (var c in Golden.RootElement.GetProperty("provider").EnumerateArray())
        {
            var raw = c.GetProperty("raw").Deserialize<RawProvider>(Snake)!;
            var actual = Normalize.Provider(raw, c.GetProperty("ref").GetString()!);
            Assert.Equal(Canonical(c.GetProperty("normalized")), AsGolden(actual));
        }
    }

    [Fact]
    public void LedgerRowsNormaliseToGoldenValues()
    {
        foreach (var c in Golden.RootElement.GetProperty("ledger").EnumerateArray())
        {
            var raw = c.GetProperty("raw").Deserialize<RawLedger>(Snake)!;
            var actual = Normalize.Ledger(raw);
            Assert.Equal(Canonical(c.GetProperty("normalized")), AsGolden(actual));
        }
    }
}
