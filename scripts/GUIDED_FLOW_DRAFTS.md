# Guided-flow coverage

Active maths problems without a guided flow can be drafted offline with GPT-4o. The authoring script includes a prerequisite refresher and numeric check on each new step so these problems also get the student support used by covered flows.

## Draft in a small batch first

```powershell
node scripts/draft-guided-flows.mjs --generate --limit=1
```

Draft all problems currently missing a guided flow:

```powershell
node scripts/draft-guided-flows.mjs --generate
```

Drafts are written to `scripts/data/guided-flow-drafts/`; the generation script never changes the database. Failed problems are listed under `errors` and can be retried separately. Check each solution, answer, option set, worked example, prerequisite explanation, and quick-check arithmetic against the original problem. Only after a person has reviewed the maths, change a flow's top-level `reviewStatus` from `needs_review` to `approved`.

## Validate and apply

```powershell
node scripts/apply-reviewed-guided-flows.mjs scripts/data/guided-flow-drafts/<draft-file>.json
node scripts/apply-reviewed-guided-flows.mjs scripts/data/guided-flow-drafts/<draft-file>.json --apply
```

The apply script verifies the problem is still active, is still a maths problem, has no guided flow, and has not changed since drafting. It validates structure and answers' numeric format; it cannot verify mathematical correctness, so human review is required before approval.
