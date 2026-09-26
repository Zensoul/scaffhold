-- Add 3-level hint system, formula card, and self-explain prompt to solve_steps

ALTER TABLE "solve_steps"
  ADD COLUMN "hintText2"           TEXT,
  ADD COLUMN "hintText3"           TEXT,
  ADD COLUMN "formulaCard"         TEXT,
  ADD COLUMN "selfExplainPrompt"   TEXT,
  ADD COLUMN "selfExplainAnswer"   TEXT;
