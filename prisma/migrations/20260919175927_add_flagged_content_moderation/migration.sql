-- CreateTable
CREATE TABLE "flagged_content" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "problemId" TEXT,
    "rawText" TEXT NOT NULL,
    "moderationResult" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "notifiedParentAt" TIMESTAMP(3),
    "notifiedTeacherAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flagged_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flagged_content_studentId_createdAt_idx" ON "flagged_content"("studentId", "createdAt");
