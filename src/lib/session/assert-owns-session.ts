import { prisma } from '@/lib/db/prisma'

export class SessionOwnershipError extends Error {
  constructor() {
    super('Session not found or does not belong to this student')
    this.name = 'SessionOwnershipError'
  }
}

// Shared IDOR guard for every route that accepts a bare sessionId from
// the client (request body or query param) and then reads or mutates
// that Session/its SessionInteractions. A security audit tonight found
// six routes fetching a Session by id alone with no check that it
// actually belongs to the authenticated caller -- meaning any logged-in
// student could pass another student's sessionId and end their session,
// submit answers into it, or read/answer their in-flight comparison
// question, corrupting that other student's progress data. Every one of
// those call sites now calls this first and lets SessionOwnershipError
// propagate as a 403/404-shaped response, mirroring the ownership check
// teacher/assignments/route.ts already does for studentId (assertOwnsStudent)
// and parent/students/[id]/data/route.ts does for parentId.
//
// Throws SessionOwnershipError if the session doesn't exist or belongs
// to a different student. Returns the session row on success so callers
// don't need a second query.
export async function assertOwnsSession(sessionId: string, studentId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } })

  if (!session || session.studentId !== studentId) {
    throw new SessionOwnershipError()
  }

  return session
}
