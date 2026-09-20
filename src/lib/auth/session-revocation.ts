import { prisma } from '@/lib/db/prisma'

// Checks whether a given JWT (by its jti claim) has been explicitly
// revoked. Called on every authenticated request via the jwt callback —
// this is what makes an otherwise-stateless JWT session actually
// revocable before its natural expiry.
export async function isSessionRevoked(jti: string): Promise<boolean> {
  const revoked = await prisma.revokedSession.findUnique({
    where: { jti },
  })
  return revoked !== null
}

// Revokes a specific session by its jti. Once revoked, the next request
// carrying this token will be rejected by the jwt callback, regardless
// of how much time is left before the token's natural expiry.
export async function revokeSession(params: {
  jti: string
  userId: string
  reason?: string
}): Promise<void> {
  const { jti, userId, reason } = params

  await prisma.revokedSession.upsert({
    where: { jti },
    update: {}, // already revoked — no-op, idempotent
    create: { jti, userId, reason },
  })
}