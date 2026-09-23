-- CreateEnum
CREATE TYPE "FadeAnnotationType" AS ENUM ('unknown', 'given', 'implied_given');

-- CreateTable
CREATE TABLE "scaffolding_levels_by_type" (
    "id" TEXT NOT NULL,
    "scaffoldingLevelId" TEXT NOT NULL,
    "annotationType" "FadeAnnotationType" NOT NULL,
    "level" DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    "problemsAttempted" INTEGER NOT NULL DEFAULT 0,
    "problemsClean" INTEGER NOT NULL DEFAULT 0,
    "consecutiveClean" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scaffolding_levels_by_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scaffolding_levels_by_type_scaffoldingLevelId_annotationTyp_key" ON "scaffolding_levels_by_type"("scaffoldingLevelId", "annotationType");

-- AddForeignKey
ALTER TABLE "scaffolding_levels_by_type" ADD CONSTRAINT "scaffolding_levels_by_type_scaffoldingLevelId_fkey" FOREIGN KEY ("scaffoldingLevelId") REFERENCES "scaffolding_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
