import { PrismaClient, EndReason } from '@prisma/client'

const prisma = new PrismaClient()

export const SESSION_MAX_DURATION_MS = 15 * 60 * 1000 // 15 minutes
export const CONSECUTIVE_FAILURE_LIMIT = 2

export type SessionGuardResult =
  | { shouldEnd: false }
  | { shouldEnd: true; reason: EndReason }

// Server-side check — the ONLY authority on whether a session should end.
// A client-side countdown may exist for UX, but it is decorative; this
// function is what actually decides, using the database's own startedAt
// timestamp and the ScaffoldingLevel's consecutiveFailures counter, both
// of which the client cannot manipulate by resetting a local timer.
//
// Call this at the START of every Mode 1/2/3 fetch, before serving a new
// problem. If shouldEnd is true, the caller should end the session
// (see endSession) instead of serving another problem.
export async function checkSessionGuard(
  sessionId: string,
  studentId: string,
  chapterId: string
): Promise<SessionGuardResult> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } })

  if (!session) {
    // Session doesn't exist — treat as already ended; caller should
    // require a fresh /session/start call.
    return { shouldEnd: true, reason: EndReason.timeout }
  }

  if (session.endedAt) {
    // Already ended by a prior check or request — idempotent no-op.
    return { shouldEnd: true, reason: session.endReason ?? EndReason.timeout }
  }

  const elapsedMs = Date.now() - session.startedAt.getTime()
  if (elapsedMs >= SESSION_MAX_DURATION_MS) {
    return { shouldEnd: true, reason: EndReason.timeout }
  }

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId } },
  })

  if (scaffoldingLevel && scaffoldingLevel.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
    return { shouldEnd: true, reason: EndReason.consecutive_failures }
  }

  return { shouldEnd: false }
}