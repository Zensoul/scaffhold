import { prisma } from '@/lib/db/prisma'


// Single source of truth for the DPDP consent gate. Called from every
// entry point into the actual learning product (session start, Mode 2
// fetch, Mode 3 fetch) rather than duplicated per-route — one place to
// get this right, one place to audit.
export async function requireConsent(studentId: string): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { dpdpConsentGiven: true },
  })

  if (!profile) {
    throw new ConsentError('Student profile not found')
  }

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