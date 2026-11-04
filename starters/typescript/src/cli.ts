/** recon run --date YYYY-MM-DD */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDay } from "./readers.js";

const DEFAULT_DATA_DIR = resolve(fileURLToPath(import.meta.url), "../../../../data");

function run(date: string, dataDir: string): number {
  const { provider, ledger } = loadDay(dataDir, date);
  console.log(`${date}: ${provider.length} provider records, ${ledger.length} ledger rows`);

  for (const tx of provider) {
    // This is where the exercise starts.
  }

  return 0;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command !== "run") {
    console.error("usage: recon run --date YYYY-MM-DD [--data-dir <path>]");
    return 2;
  }
  let date: string | undefined;
  let dataDir = DEFAULT_DATA_DIR;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--date") date = rest[++i];
    else if (rest[i] === "--data-dir") dataDir = resolve(rest[++i]);
  }
  if (!date) {
    console.error("--date is required");
    return 2;
  }
  return run(date, dataDir);
}

process.exit(main(process.argv.slice(2)));
