# Prerequisite lesson drafting

Prerequisite authoring runs offline and does not change the student guided-solving flow. The LLM output is a JSON draft; only lessons explicitly reviewed and marked `approved` can be written to the database.

When run with `--generate`, the script sends the selected problem text, step prompts, correct answers, hints, and worked examples to the configured OpenAI API. It saves the response as a local review file only; it does not modify the database or student flow.

## Generate drafts

Run one small batch first:

```powershell
node scripts/draft-prerequisite-support.mjs --generate --limit=1
```

Draft all active maths problems that already have guided steps:

```powershell
node scripts/draft-prerequisite-support.mjs --generate
```

The generator makes one LLM request per problem and writes JSON files to `scripts/data/prerequisite-drafts/`. It does not update the database. The file reports active maths problems without a guided flow; those need guided steps before step-specific prerequisite support can be attached.

Review each explanation, example, and numeric answer. Change only approved lessons' `reviewStatus` from `needs_review` to `approved`.

## Validate and apply reviewed lessons

Validate first; this makes no database changes:

```powershell
node scripts/apply-reviewed-prerequisite-support.mjs scripts/data/prerequisite-drafts/<draft-file>.json
```

After reviewing the validation output, apply approved lessons:

```powershell
node scripts/apply-reviewed-prerequisite-support.mjs scripts/data/prerequisite-drafts/<draft-file>.json --apply
```

The apply script checks that each step still belongs to the same active maths problem, matches the saved step label/order, and has no prerequisite content already. It validates the structure and numeric format, but a person must verify the actual mathematics before marking a lesson approved.
