-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('concept', 'substitution', 'computation');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('mcq', 'numeric');

-- CreateTable
CREATE TABLE "guided_solve_problems" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guided_solve_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solve_steps" (
    "id" TEXT NOT NULL,
    "guidedSolveProblemId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "stepType" "StepType" NOT NULL,
    "stepLabel" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "inputType" "InputType" NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "tolerance" DOUBLE PRECISION,
    "hintText" TEXT NOT NULL,
    "errorFeedback" TEXT NOT NULL,
    "svgStage" INTEGER NOT NULL,
    "workedExampleText" TEXT,
    "workedExampleSvgStage" INTEGER,

    CONSTRAINT "solve_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solve_step_options" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "solve_step_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solve_attempts" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solve_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guided_solve_problems_problemId_key" ON "guided_solve_problems"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "solve_steps_guidedSolveProblemId_sequenceOrder_key" ON "solve_steps"("guidedSolveProblemId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "solve_attempts_studentId_stepId_createdAt_idx" ON "solve_attempts"("studentId", "stepId", "createdAt");

-- AddForeignKey
ALTER TABLE "guided_solve_problems" ADD CONSTRAINT "guided_solve_problems_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solve_steps" ADD CONSTRAINT "solve_steps_guidedSolveProblemId_fkey" FOREIGN KEY ("guidedSolveProblemId") REFERENCES "guided_solve_problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solve_step_options" ADD CONSTRAINT "solve_step_options_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "solve_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solve_attempts" ADD CONSTRAINT "solve_attempts_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "solve_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
