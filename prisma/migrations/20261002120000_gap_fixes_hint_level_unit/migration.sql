-- Migration: add hintLevel to guided_solve_problems, unit to solve_steps
-- Gap 2 fix: Renkl scaffold fading — hintLevel controls max hints per problem
-- Gap 3 infra: unit field for correct display unit on numeric inputs

ALTER TABLE "guided_solve_problems" ADD COLUMN "hintLevel" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "solve_steps" ADD COLUMN "unit" TEXT;
