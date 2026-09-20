-- CreateTable
CREATE TABLE "student_invites" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childFullName" TEXT NOT NULL,
    "childGrade" INTEGER NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentGivenAt" TIMESTAMP(3),
    "consentTextVersion" TEXT,
    "usedAt" TIMESTAMP(3),
    "studentProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_invites_inviteToken_key" ON "student_invites"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "student_invites_studentProfileId_key" ON "student_invites"("studentProfileId");

-- AddForeignKey
ALTER TABLE "student_invites" ADD CONSTRAINT "student_invites_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invites" ADD CONSTRAINT "student_invites_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
