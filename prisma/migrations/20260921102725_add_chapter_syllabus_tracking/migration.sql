-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "deletedSubtopics" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "syllabusYear" TEXT;
