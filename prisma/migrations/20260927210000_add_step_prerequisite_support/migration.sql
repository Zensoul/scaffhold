ALTER TABLE "solve_steps"
  ADD COLUMN IF NOT EXISTS "prerequisiteSkill" TEXT,
  ADD COLUMN IF NOT EXISTS "prerequisiteExplanation" TEXT,
  ADD COLUMN IF NOT EXISTS "prerequisiteExample" TEXT,
  ADD COLUMN IF NOT EXISTS "prerequisiteCheckPrompt" TEXT,
  ADD COLUMN IF NOT EXISTS "prerequisiteCheckAnswer" TEXT,
  ADD COLUMN IF NOT EXISTS "prerequisiteCheckTolerance" DOUBLE PRECISION;
