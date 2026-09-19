import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, EndReason } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { generateSessionEndStatement } from '@/lib/ai/session-end-statement'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const body = await request.json().catch(() => ({}))
  const { reason } = body as { reason?: EndReason }

  const studentId = await getCurrentStudentId()

  const session = await prisma.session.findUnique({ where: { id: sessionId } })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
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