-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'parent', 'teacher');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'HI', 'TA', 'TE', 'KN', 'ML');

-- CreateEnum
CREATE TYPE "Board" AS ENUM ('CBSE', 'ICSE');

-- CreateEnum
CREATE TYPE "SubjectName" AS ENUM ('math', 'physics');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('unknown', 'given', 'implied_given', 'concept_anchor');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('completed', 'consecutive_failures', 'student_exit', 'timeout', 'abandonment_predicted');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('annotation_presented', 'annotation_selected', 'annotation_correct', 'annotation_incorrect', 'comparison_presented', 'comparison_answered', 'hint_requested', 'hint_shown', 'problem_completed', 'problem_abandoned');

-- CreateEnum
CREATE TYPE "ScaffoldingReason" AS ENUM ('correct_answer', 'incorrect_answer', 'session_end_positive', 'session_end_negative', 'teacher_override');

-- CreateEnum
CREATE TYPE "AiCallType" AS ENUM ('comparison_question', 'session_end_statement', 'parent_summary', 'annotation_draft');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('whatsapp', 'sms', 'email', 'push');

-- CreateEnum
CREATE TYPE "ObservationTag" AS ENUM ('concept_gap', 'language_barrier', 'engagement_issue', 'ready_to_advance', 'needs_intervention');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'EN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "board" "Board" NOT NULL DEFAULT 'CBSE',
    "schoolName" TEXT,
    "teacherId" TEXT,
    "parentId" TEXT,
    "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dpdpConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "dpdpConsentAt" TIMESTAMP(3),
    "dpdpConsentVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" "SubjectName" NOT NULL,
    "grade" INTEGER NOT NULL,
    "board" "Board" NOT NULL DEFAULT 'CBSE',

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'NCERT',
    "sourceReference" TEXT,
    "rawText" TEXT NOT NULL,
    "unknownAnnotation" TEXT NOT NULL,
    "concreteRestatement" TEXT NOT NULL,
    "givens" JSONB NOT NULL,
    "impliedGivens" JSONB NOT NULL DEFAULT '[]',
    "conceptAnchor" TEXT NOT NULL,
    "problemType" TEXT NOT NULL,
    "difficultyTier" INTEGER NOT NULL,
    "requiresSketch" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contentReviewedBy" TEXT,
    "contentReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_annotations" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "annotationType" "AnnotationType" NOT NULL,
    "annotationText" TEXT NOT NULL,
    "hintText" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scaffolding_levels" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "currentLevel" DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    "problemsAttempted" INTEGER NOT NULL DEFAULT 0,
    "problemsClean" INTEGER NOT NULL DEFAULT 0,
    "consecutiveClean" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scaffolding_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "EndReason",
    "problemsPresented" INTEGER NOT NULL DEFAULT 0,
    "problemsAttempted" INTEGER NOT NULL DEFAULT 0,
    "scaffoldingLevelStart" DECIMAL(4,3) NOT NULL,
    "scaffoldingLevelEnd" DECIMAL(4,3),
    "sessionEndStatement" TEXT,
    "aiModelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_interactions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "interactionType" "InteractionType" NOT NULL,
    "annotationId" TEXT,
    "studentResponse" TEXT,
    "isCorrect" BOOLEAN,
    "scaffoldingLevelAt" DECIMAL(4,3) NOT NULL,
    "timeOnStepMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scaffolding_history" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "levelBefore" DECIMAL(4,3) NOT NULL,
    "levelAfter" DECIMAL(4,3) NOT NULL,
    "delta" DECIMAL(4,3) NOT NULL,
    "reason" "ScaffoldingReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scaffolding_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_calls" (
    "id" TEXT NOT NULL,
    "callType" "AiCallType" NOT NULL,
    "studentId" TEXT,
    "sessionId" TEXT,
    "problemId" TEXT,
    "modelUsed" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "responseText" TEXT,
    "wasUsed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_summaries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "problemsPresented" INTEGER NOT NULL DEFAULT 0,
    "problemsIndependentlyIdentified" INTEGER NOT NULL DEFAULT 0,
    "scaffoldingLevelStart" DECIMAL(4,3),
    "scaffoldingLevelEnd" DECIMAL(4,3),
    "summaryText" TEXT NOT NULL,
    "aiCallId" TEXT,
    "deliveredVia" "DeliveryChannel",
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_observations" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "observation" TEXT NOT NULL,
    "tag" "ObservationTag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneE164_key" ON "users"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_grade_board_key" ON "subjects"("name", "grade", "board");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_subjectId_sequenceNumber_key" ON "chapters"("subjectId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "problem_annotations_problemId_annotationType_sequenceOrder_key" ON "problem_annotations"("problemId", "annotationType", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "scaffolding_levels_studentId_chapterId_key" ON "scaffolding_levels"("studentId", "chapterId");

-- CreateIndex
CREATE INDEX "session_interactions_sessionId_createdAt_idx" ON "session_interactions"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "session_interactions_studentId_createdAt_idx" ON "session_interactions"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "scaffolding_history_studentId_chapterId_createdAt_idx" ON "scaffolding_history"("studentId", "chapterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "parent_summaries_studentId_weekStartDate_key" ON "parent_summaries"("studentId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_contentReviewedBy_fkey" FOREIGN KEY ("contentReviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_annotations" ADD CONSTRAINT "problem_annotations_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaffolding_levels" ADD CONSTRAINT "scaffolding_levels_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaffolding_levels" ADD CONSTRAINT "scaffolding_levels_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_interactions" ADD CONSTRAINT "session_interactions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_interactions" ADD CONSTRAINT "session_interactions_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_interactions" ADD CONSTRAINT "session_interactions_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "problem_annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaffolding_history" ADD CONSTRAINT "scaffolding_history_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaffolding_history" ADD CONSTRAINT "scaffolding_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_summaries" ADD CONSTRAINT "parent_summaries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_summaries" ADD CONSTRAINT "parent_summaries_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_observations" ADD CONSTRAINT "teacher_observations_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_observations" ADD CONSTRAINT "teacher_observations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_observations" ADD CONSTRAINT "teacher_observations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
