-- CreateTable
CREATE TABLE "revoked_sessions" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "revoked_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revoked_sessions_jti_key" ON "revoked_sessions"("jti");

-- CreateIndex
CREATE INDEX "revoked_sessions_jti_idx" ON "revoked_sessions"("jti");
