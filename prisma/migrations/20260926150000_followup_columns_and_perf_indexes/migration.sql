-- This migration records columns that already exist in the database
-- (added outside of Prisma migration history) and adds performance indexes.

-- Columns already present in the DB — using ADD COLUMN IF NOT EXISTS
-- so this is safe to run even if somehow they already exist.
ALTER TABLE "solve_steps"
  ADD COLUMN IF NOT EXISTS "followUpPrompt"     TEXT,
  ADD COLUMN IF NOT EXISTS "followUpAnswer"     TEXT,
  ADD COLUMN IF NOT EXISTS "followUpInputType"  TEXT,
  ADD COLUMN IF NOT EXISTS "followUpTolerance"  DOUBLE PRECISION;

-- Performance indexes
CREATE INDEX IF NOT EXISTS "sessions_studentId_startedAt_idx"
  ON "sessions" ("studentId", "startedAt");

CREATE INDEX IF NOT EXISTS "problems_chapterId_idx"
  ON "problems" ("chapterId");

CREATE INDEX IF NOT EXISTS "session_interactions_studentId_problemId_idx"
  ON "session_interactions" ("studentId", "problemId");
