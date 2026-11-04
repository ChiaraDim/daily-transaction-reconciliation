# Take-home: Daily transaction reconciliation

**Time box: 3 hours.** We mean it — an unfinished tool with clear reasoning beats a complete one without.

## How to deliver

**A GitHub or Azure DevOps repo link. Not a zip.**

We look at how the work happened, not just the final state. Commit as you go rather than squashing everything into one push at the end. Beyond that, use the repo however you'd use it on a real project — branches, PRs, issues, whatever reflects how you actually work.

## The situation

Every morning, finance receives two exports covering the previous day:

- `data/provider-YYYY-MM-DD.jsonl` — from our payment provider
- `data/ledger-YYYY-MM-DD.csv` — from our internal ledger

They should agree. They don't. Someone currently checks this by hand in a spreadsheet and it takes most of a morning.

## What to build

A tool that is run once per day and reports what doesn't match.

```
recon run --date 2026-03-01
recon run --date 2026-03-02
```

1. **Report discrepancies** — transactions present on one side but not the other, and transactions on both sides with differing amounts.
2. **Report only what changed.** The day-2 run shows new discrepancies and ones that have since resolved — not a re-list of everything from day 1. This means keeping state between runs.
3. **Re-running a date must be safe.** Run `--date 2026-03-02` twice: the second run produces no new findings and no duplicated state.

State can be a JSON file, SQLite, whatever you prefer. We don't care which.

## Things you should know

Most transactions have an ID on both sides. Some don't, and have to be matched on other fields. Where a match is uncertain, **flagging a record for a human to review is a good output, not a failure.** A confidently wrong reconciliation is worse than an admitted uncertainty.

More generally: the data contains ambiguities this brief does not resolve. Finding them and deciding what to do is the exercise. If you'd want to ask a real stakeholder something, write the question down rather than stalling on it.

The report is read by finance, not by engineers. That's a design constraint, not a formatting detail.

## What we're not testing

The core needs none of this: no auth, no database server, no deployment, no web UI, no packaging, no Docker or cloud config, no CLI framework. Printed output is fine. If a future ticket leads you to build one of them, that's your call. Adding them for their own sake earns nothing and costs you time.

## Language

**Use whichever language you're most productive in.** We ship thin starters for Python, TypeScript and C#, but Rust, Go, Java, Kotlin or anything else is just as welcome. We assess your reasoning and your report, not your language choice.

If you pick a language without a starter, `docs/DATA_SPEC.md` gives you everything you need: both file formats field by field, the exact rules for turning amounts and timestamps into comparable values, and worked examples in `docs/normalize_golden.json`. Reading the files is plumbing, not the exercise, so don't spend more than a few minutes on it. Only ask: could someone on our team run it with the setup instructions you provide?

## Documentation

Document your thinking. **Format is entirely your call** — README, ADRs, issues, PR descriptions, commit messages, a single markdown file. We're interested in the choice you make as much as the content.

What we want to be able to reconstruct: what ambiguities you hit, what you decided, what you'd want to confirm with someone before this went live, and what you'd do with another day.

## Future tickets

These were filed by Sanne, who runs finance operations and will be the person using your tool. They're reproduced exactly as she wrote them. **Only pick one up once the core works.** Building none of them is a perfectly good outcome.

If you do take one, interpreting it is most of the work. Write down what you think Sanne actually needs, what you'd have asked her before starting, and why you picked that one.

> **FIN-112**
> Hi, is there a way I can just open this myself in the morning? Right now I have to ask someone on your side to run it and send me the result. Doesn't need to be fancy.

> **FIN-118**
> On Mondays I'm looking at Friday, Saturday and Sunday and it gets confusing which day something belongs to. Can it be less confusing?

> **FIN-121**
> My manager asked me "so does the total for yesterday match or not" and I realised I couldn't answer that from the report. Can it just tell me?

> **FIN-124**
> When something is flagged for me to look at, I look at it, and then... it's still there the next day. I've already dealt with it. Can it remember that?

> **FIN-127**
> Is this getting better or worse? I feel like there are more mismatches than last month but I have no way to tell.

There is no hidden right answer here and no bonus for covering more than one. A small, well-judged interpretation of one ticket beats a large one, and a finished core with no ticket beats both.

## On AI

Use whatever tools you'd use on a normal working day. We assume you will. Mention where it helped and where you overrode it. We'll ask you to explain any part of what you submit, so don't ship code you haven't read.

## What happens next

A one-hour conversation with a senior engineer and someone from the business side. We'll have been through your repo beforehand and most of our questions will come from it. Nothing to prepare.

---

## Getting started

Everything you need is in this repo. `docs/DATA_SPEC.md` describes both files and the exact normalisation rules; `docs/normalize_golden.json` has worked examples.

Three thin starters do the file reading and normalisation for you and stop exactly where the exercise begins. Each one loads both files for a date, prints the row counts, and leaves you an empty loop. Use one, or ignore them.

### Python (3.11+, no dependencies)

```bash
cd starters/python
python -m unittest            # the one test
python -m recon run --date 2026-03-01
```

### TypeScript (Node 20+)

```bash
cd starters/typescript
npm install
npm test
npm start -- run --date 2026-03-01
```

### C# (.NET 8+)

```bash
cd starters/csharp
dotnet test
dotnet run --project Recon -- run --date 2026-03-01
```

Each starter accepts `--data-dir <path>` if you move the data. State, matching, change detection and the report are yours to design; the starters contain none of that on purpose.

### Any other language

Read `docs/DATA_SPEC.md`, check your parsing against `docs/normalize_golden.json`, and include the commands to run your tool in your own README. That's all we need.
