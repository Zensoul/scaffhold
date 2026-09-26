-- CreateEnum
CREATE TYPE "DiagramStatus" AS ENUM ('pending_render', 'pending_review', 'approved', 'rejected', 'render_failed');

-- CreateTable
CREATE TABLE "problem_diagrams" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "sceneCode" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "videoUrl" TEXT,
    "status" "DiagramStatus" NOT NULL DEFAULT 'pending_render',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "renderErrorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_diagrams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "problem_diagrams_problemId_key" ON "problem_diagrams"("problemId");

-- AddForeignKey
ALTER TABLE "problem_diagrams" ADD CONSTRAINT "problem_diagrams_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_diagrams" ADD CONSTRAINT "problem_diagrams_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
