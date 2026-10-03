# Untracked scripts and content review

Audit date: 2026-10-03

This is a static review of the 160 non-ignored untracked files in the working tree. No script was executed and no database or storage service was changed. The application source and `package.json` scripts do not import or invoke these files. They have no effect on the running product unless someone explicitly runs them or wires them into the app/build.

## Reusable read-only checks

These are the best candidates to keep as documented maintenance tools. They read database records and print a report; use only with a development database and avoid sharing output that contains student or teacher information.

- `check-all-problems.mjs` — inspect problem records.
- `scripts/check-diagrams.ts` — inspect approved diagrams and stages.
- `scripts/check-givens.ts` — inspect problem givens.
- `scripts/check-problem-subtopics.ts` — check problem/subtopic mapping.
- `scripts/check-draft-status.ts` — inspect draft workflow status.
- `scripts/check-grading-log.ts` — inspect grading records.
- `scripts/find-empty-subtopics.ts` — find subtopics without problems.
- `scripts/list-diagrams.ts` — list diagram records.
- `scripts/status-report.ts` — summarize selected content status.

The checks still need database credentials. Keep them out of production workflows; prefer read-only DB credentials when available. The other root-level `check-*` files are mostly one-off investigations and should not be kept as a maintained tool set without a clear owner and purpose.

## Keep as development tooling, with safeguards

- `manim-templates/*.py` are source templates for diagram generation.
- `scripts/generate-diagram-scene.ts` generates local scene files and invokes a rendering command. It writes files and must be treated as a build tool, not a read-only check.
- `scripts/render-diagrams.ts` can upload rendered videos to Supabase and update diagram records. Run only after reviewing the selected diagram records and target storage bucket.
- Seed, annotation, hint, and diagram repair scripts can be useful for specific content changes. Review their target IDs and database writes before each use; do not execute them against production by default.

## Do not run against production

- `delete-all-phases.mjs` deletes all guided-solve flows and associated solve attempts.
- `delete-and-reseed-all.mjs`, `delete-arc-segment-guided.mjs`, `delete-phase2-only.mjs`, `delete-sector-guided.mjs`, and `fix-p17.mjs` delete guided content; several also delete solve attempts.
- `scripts/delete-tangent-chapter.ts` deletes a chapter plus its problems, drafts, sessions, and related progress records.
- `scripts/reset-sai-polynomials.ts` deletes one student's Polynomials sessions and progress. It is only appropriate for disposable test data after confirming the student identity and database.
- `scripts/approve-diagrams.ts` changes all pending-review diagrams to approved, bypassing individual review.
- `scripts/apply-review-decisions.ts`, `scripts/review-approve-drafts.ts`, and promotion scripts can change draft status or create live problems.
- `run-guided-migration.mjs` runs a Prisma schema migration. `patch-diagram.mjs` edits application source files directly.

These are not needed at application runtime. Retain only when there is a reproducible development need; otherwise keep them out of shared commits.

## Generated lesson data review

All 24 untracked JSON files parse. The generated guided-flow and prerequisite outputs explicitly require human review. Across the guided-flow output files there are 24 draft records (including repeated problem IDs) and 15 generation errors. The prerequisite files contain 15 draft records for 13 distinct problems and 6 generation errors. Do not load these files directly into student-facing content.

Examples of verified answer/content defects in the guided drafts:

- Grouped-data median is marked 24.33; using the displayed frequencies gives 28.
- Grouped-data mode is marked 34.375; the displayed values give about 30.91.
- For `x + 1/x = 65/8`, the draft answer is 4; the solutions are 8 and 1/8.
- In the `sin A = 3/5` flow, one step marks `cos² A = 0.84`; it should be 0.64, although the later final answer 0.8 is right.
- The discriminant problem asks for the nature of the roots, but the draft flow stops after finding the discriminant and never asks the student to interpret it.
- The same arithmetic-progression problem appears three times, and the same polynomial problem appears more than once.

A prerequisite check for a semicircle of diameter 4 mm says the perimeter is 9.28 mm; using π = 3.14, it is 10.28 mm. Another sector practice answer is 9.8175 where the stated values give 9.8125. Several lessons also use generic checks that do not directly target the skill needed in the associated problem. The prerequisite batch needs a full human accuracy and relevance pass before promotion.

## Recommendation

Keep a small, documented set of read-only diagnostics and the reusable diagram templates. Treat repair, seeding, rendering, approval, reset, and deletion files as one-off operational tools until each has a clear purpose, safe target scoping, and an explicit development-database guard. Keep the generated lesson drafts out of the product until their calculations, step prompts, hints, and prerequisite relevance are corrected and independently reviewed.

## Disposition of the rest of the inventory

- The generated JSON output directories listed above are now ignored by Git but remain on disk. This follows the existing `GUIDED_FLOW_DRAFTS.md` and `PREREQUISITE_DRAFTS.md` review gates.
- The remaining 13 data JSON files contain 97 problem-candidate entries plus two proof-retest records and local review decisions; `scripts/tsconfig.json` is a separate tooling config. The data files are still untracked and unapproved; keep them out of student content until their wording, answers, and intended use are checked.
- The 53 root-level `.mjs` files and one root-level `.ts` file are ad-hoc checks, fixes, database seed/reset scripts, or source patchers. The 72 untracked TypeScript files and two `.mjs` files under `scripts/` are a mixture of diagnostics, data repair, generation, review, and database operations. They are not called by the app. Keep them local until a specific reusable script is selected; do not use `git add .` to collect them wholesale.
- The eight Python templates are development assets for diagram production. Keep them out of the live app bundle; track them only with the specific reviewed rendering workflow that needs them.

The audit document is staged for review. The generated draft-output ignore rule is staged with `.gitignore`. The other local tools and candidate datasets remain present and untracked; no files were deleted or executed.
