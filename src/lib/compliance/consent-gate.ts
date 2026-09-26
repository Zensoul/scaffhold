import { prisma } from '@/lib/db/prisma'

// Short-lived cache for consent checks. Students don't revoke DPDP
// consent mid-session — this is a safe cache. 10-minute TTL means a
// newly granted consent shows up within 10 minutes without anyone having
// to clear a cache manually.
const CONSENT_CACHE = new Map<string, { granted: boolean; expiry: number }>()
const CONSENT_TTL_MS = 10 * 60 * 1000

// Single source of truth for the DPDP consent gate. Called from every
// entry point into the actual learning product (session start, Mode 2
// fetch, Mode 3 fetch) rather than duplicated per-route — one place to
// get this right, one place to audit.
export async function requireConsent(studentId: string): Promise<void> {
  const now = Date.now()
  const cached = CONSENT_CACHE.get(studentId)

  if (cached && cached.expiry > now) {
    if (!cached.granted) throw new ConsentError('Consent not given (cached)')
    return // fast path — no DB hit
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { dpdpConsentGiven: true },
  })

  if (!profile) {
    CONSENT_CACHE.delete(studentId)
    throw new ConsentError('Student profile not found')
  }

  // Cache both outcomes — a denied consent shouldn't recheck every click,
  // and a granted one definitely shouldn't.
  CONSENT_CACHE.set(studentId, { granted: profile.dpdpConsentGiven, expiry: now + CONSENT_TTL_MS })

  if (!profile.dpdpConsentGiven) {
    throw new ConsentError(
      'This account does not have parental consent on file yet. Ask your parent to complete registration through the invite link.'
    )
  }
}

export class ConsentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConsentError'
  }
}
