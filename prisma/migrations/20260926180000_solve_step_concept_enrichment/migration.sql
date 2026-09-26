-- Add conceptVideoUrl and socraticPrompt to solve_steps
-- conceptVideoUrl: short animation/video explaining WHY this concept applies (Option B)
-- socraticPrompt: think-first question shown before the MCQ attempt (Option C)

ALTER TABLE "solve_steps"
  ADD COLUMN IF NOT EXISTS "conceptVideoUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "socraticPrompt"   TEXT;
