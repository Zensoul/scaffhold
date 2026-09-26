-- AlterTable
ALTER TABLE "problem_drafts" ADD COLUMN     "subtopicId" TEXT;

-- AddForeignKey
ALTER TABLE "problem_drafts" ADD CONSTRAINT "problem_drafts_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "subtopics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
