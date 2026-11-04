using System.Text.Json;

namespace Recon;

/// <summary>Read the two export formats and return normalised Transactions.</summary>
public static class Readers
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public static List<Transaction> ReadProvider(string path)
    {
        var file = Path.GetFileName(path);
        var result = new List<Transaction>();
        var lineNo = 0;
        foreach (var line in File.ReadLines(path))
        {
            lineNo++;
            if (string.IsNullOrWhiteSpace(line)) continue;
            var raw = JsonSerializer.Deserialize<RawProvider>(line, JsonOpts)
                      ?? throw new InvalidDataException($"{file}:{lineNo}: not a provider record");
            result.Add(Normalize.Provider(raw, $"{file}:{lineNo}"));
        }
        return result;
    }

    public static List<Transaction> ReadLedger(string path)
    {
        var lines = File.ReadLines(path).Where(l => l.Length > 0).ToList();
        var cols = lines[0].Split(',');
        var result = new List<Transaction>();
        foreach (var line in lines.Skip(1))
        {
            var cells = SplitCsvLine(line);
            string Cell(string name) { var i = Array.IndexOf(cols, name); return i >= 0 && i < cells.Count ? cells[i] : ""; }
            var raw = new RawLedger(Cell("entry_id"), Cell("transaction_id"), Cell("booked_at"), Cell("amount"), Cell("merchant"), Cell("cost_centre"));
            result.Add(Normalize.Ledger(raw));
        }
        return result;
    }

    /// <summary>Both exports for one date. Throws if either file is missing.</summary>
    public static (List<Transaction> Provider, List<Transaction> Ledger) LoadDay(string dataDir, string date) =>
        (ReadProvider(Path.Combine(dataDir, $"provider-{date}.jsonl")),
         ReadLedger(Path.Combine(dataDir, $"ledger-{date}.csv")));

    /// <summary>Minimal RFC 4180 line splitter: quoted cells and doubled quotes, no embedded newlines.</summary>
    private static List<string> SplitCsvLine(string line)
    {
        var cells = new List<string>();
        var cur = new System.Text.StringBuilder();
        var quoted = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (quoted)
            {
                if (ch == '"' && i + 1 < line.Length && line[i + 1] == '"') { cur.Append('"'); i++; }
                else if (ch == '"') quoted = false;
                else cur.Append(ch);
            }
            else if (ch == '"') quoted = true;
            else if (ch == ',') { cells.Add(cur.ToString()); cur.Clear(); }
            else cur.Append(ch);
        }
        cells.Add(cur.ToString());
        return cells;
    }
}
