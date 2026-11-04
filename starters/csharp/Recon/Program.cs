// recon run --date YYYY-MM-DD [--data-dir <path>]
using Recon;

static string DefaultDataDir() =>
    Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "data"));

static int Run(string date, string dataDir)
{
    var (provider, ledger) = Readers.LoadDay(dataDir, date);
    Console.WriteLine($"{date}: {provider.Count} provider records, {ledger.Count} ledger rows");

    foreach (var tx in provider)
    {
        // This is where the exercise starts.
    }

    return 0;
}

if (args.Length == 0 || args[0] != "run")
{
    Console.Error.WriteLine("usage: recon run --date YYYY-MM-DD [--data-dir <path>]");
    return 2;
}
string? date = null;
var dataDir = DefaultDataDir();
for (var i = 1; i < args.Length; i++)
{
    if (args[i] == "--date" && i + 1 < args.Length) date = args[++i];
    else if (args[i] == "--data-dir" && i + 1 < args.Length) dataDir = Path.GetFullPath(args[++i]);
}
if (date is null)
{
    Console.Error.WriteLine("--date is required");
    return 2;
}
return Run(date, dataDir);
