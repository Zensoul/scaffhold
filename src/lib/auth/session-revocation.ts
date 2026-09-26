import { prisma } from '@/lib/db/prisma'

// Short-lived in-memory cache for "not revoked" checks.
// A JWT that has NOT been revoked is the vast majority case — students
// and teachers make dozens of API calls per session, and each one used
// to hit the DB. With this cache, only the first call per JTI per
// 5-minute window actually queries the database.
//
// Revoked JTIs are intentionally NOT cached — when a session is
// revoked we want the user locked out on their very next request, not
// after a cache TTL. Since revocations are extremely rare (explicit
// teacher/admin action), the uncached path is fine for that case.

const NOT_REVOKED_CACHE = new Map<string, number>() // jti → expiry timestamp
const NOT_REVOKED_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Periodically prune stale entries so the Map doesn't grow forever.
// Each Node.js API worker has its own Map — this is per-process, not
// shared across workers. That's fine: the cache is a performance
// optimisation only; correctness comes from the DB.
let lastPruneAt = 0
function pruneCache() {
  const now = Date.now()
  if (now - lastPruneAt < 60_000) return // prune at most once per minute
  lastPruneAt = now
  for (const [jti, expiry] of NOT_REVOKED_CACHE) {
    if (expiry < now) NOT_REVOKED_CACHE.delete(jti)
  }
}

export async function isSessionRevoked(jti: string): Promise<boolean> {
  const now = Date.now()

  // If we recently confirmed this JTI is NOT revoked, skip the DB call.
  const cachedExpiry = NOT_REVOKED_CACHE.get(jti)
  if (cachedExpiry !== undefined && cachedExpiry > now) {
    return false
  }

  const revoked = await prisma.revokedSession.findUnique({
    where: { jti },
    select: { jti: true }, // only need existence, not full row
  })

  if (revoked !== null) {
    // It IS revoked — evict from cache (shouldn't be there, but be safe)
    // and return true so the jwt callback returns null.
    NOT_REVOKED_CACHE.delete(jti)
    return true
  }

  // Not revoked — cache this so subsequent calls skip the DB.
  NOT_REVOKED_CACHE.set(jti, now + NOT_REVOKED_TTL_MS)
  pruneCache()
  return false
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

  // Remove from the "not revoked" cache immediately so future requests
  // on this worker get the correct result before the TTL would have expired.
  NOT_REVOKED_CACHE.delete(jti)

  await prisma.revokedSession.upsert({
    where: { jti },
    update: {}, // already revoked — no-op, idempotent
    create: { jti, userId, reason },
  })
}
