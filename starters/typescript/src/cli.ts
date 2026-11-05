/** recon run --date YYYY-MM-DD */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDay } from "./readers.js";
import { reconcile } from "./reconcile.js";
import { loadState, saveState } from "./state.js";
import { formatReport } from "./report.js";

const DEFAULT_DATA_DIR = resolve(fileURLToPath(import.meta.url), "../../../../data");
const DEFAULT_STATE_FILE = resolve(fileURLToPath(import.meta.url), "../../../../state/recon-state.json");

function run(date: string, dataDir: string, stateFile: string): number {
  const { provider, ledger } = loadDay(dataDir, date);
  const result = reconcile(loadState(stateFile), provider, ledger);
  saveState(stateFile, result.state);

  console.log(formatReport(date, provider.length, ledger.length, result));

  return 0;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command !== "run") {
    console.error("usage: recon run --date YYYY-MM-DD [--data-dir <path>] [--state <file>]");
    return 2;
  }
  let date: string | undefined;
  let dataDir = DEFAULT_DATA_DIR;
  let stateFile = DEFAULT_STATE_FILE;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--date") date = rest[++i];
    else if (rest[i] === "--data-dir") dataDir = resolve(rest[++i]);
    else if (rest[i] === "--state") stateFile = resolve(rest[++i]);
  }
  if (!date) {
    console.error("--date is required");
    return 2;
  }
  return run(date, dataDir, stateFile);
}

process.exit(main(process.argv.slice(2)));
