-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'needs_revision');

-- CreateTable
CREATE TABLE "problem_drafts" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "unknownAnnotation" TEXT,
    "concreteRestatement" TEXT,
    "givensDraft" JSONB,
    "impliedGivensDraft" JSONB,
    "conceptAnchor" TEXT,
    "problemType" TEXT,
    "difficultyTier" INTEGER,
    "annotationsDraft" JSONB,
    "generatedByLLM" BOOLEAN NOT NULL DEFAULT true,
    "status" "DraftStatus" NOT NULL DEFAULT 'pending_review',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "publishedProblemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "problem_drafts_publishedProblemId_key" ON "problem_drafts"("publishedProblemId");

-- AddForeignKey
ALTER TABLE "problem_drafts" ADD CONSTRAINT "problem_drafts_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_drafts" ADD CONSTRAINT "problem_drafts_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_drafts" ADD CONSTRAINT "problem_drafts_publishedProblemId_fkey" FOREIGN KEY ("publishedProblemId") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
