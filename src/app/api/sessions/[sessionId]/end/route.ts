import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { EndReason } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { generateSessionEndStatement } from '@/lib/ai/session-end-statement'
import { assertOwnsSession, SessionOwnershipError } from '@/lib/session/assert-owns-session'


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const body = await request.json().catch(() => ({}))
  const { reason } = body as { reason?: EndReason }

  const studentId = await getCurrentStudentId()

  // IDOR guard: without this, any authenticated student could pass
  // another student's sessionId and force-end their session, triggering
  // an AI-generated closing statement and overwriting their
  // scaffoldingLevelEnd/endReason -- a real data-integrity issue caught
  // in tonight's security audit.
  let session
  try {
    session = await assertOwnsSession(sessionId, studentId)
  } catch (err) {
    if (err instanceof SessionOwnershipError) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    throw err
  }

  if (session.endedAt) {
    // Idempotent — already ended, just return what's there.
    return NextResponse.json({ session, alreadyEnded: true })
  }

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId: session.chapterId } },
  })

  const endReason = reason ?? EndReason.student_exit

  const statement = await generateSessionEndStatement({
    studentId,
    sessionId: session.id,
    reason: endReason,
    problemsAttempted: session.problemsAttempted,
    problemsClean: scaffoldingLevel?.problemsClean ?? 0,
  })

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      endedAt: new Date(),
      endReason,
      scaffoldingLevelEnd: scaffoldingLevel?.currentLevel,
      sessionEndStatement: statement,
      aiModelUsed: 'gpt-4o-mini',
    },
  })

  return NextResponse.json({ session: updated, alreadyEnded: false })
}