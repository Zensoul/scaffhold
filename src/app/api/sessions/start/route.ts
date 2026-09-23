import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { chapterId, forceNew } = body as { chapterId: string; forceNew?: boolean }

  if (!chapterId) {
    return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  try {
    await requireConsent(studentId)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  const existing = await prisma.session.findFirst({
    where: {
      studentId,
      chapterId,
      endedAt: null,
    },
    orderBy: { startedAt: 'desc' },
  })

  // Normal resume path: an open session exists and the caller didn't ask
  // to force a new one — keep existing behavior exactly as before.
  if (existing && !forceNew) {
    return NextResponse.json({ session: existing, resumed: true })
  }

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: {
      studentId_chapterId: { studentId, chapterId },
    },
  })

  if (!scaffoldingLevel) {
    return NextResponse.json(
      { error: 'No scaffolding level record for this student/chapter — seed one first' },
      { status: 422 }
    )
  }

  // forceNew explicitly means "the student chose to start over after a
  // session ended" (timeout, or the guard already closed it out). Close
  // any lingering open session first, and reset the consecutive-failure
  // streak so the fresh session doesn't immediately re-trip the guard —
  // that streak lives on ScaffoldingLevel, not Session, so a new Session
  // row alone never clears it.
  if (forceNew) {
    if (existing) {
      await prisma.session.update({
        where: { id: existing.id },
        data: { endedAt: new Date(), endReason: existing.endReason ?? 'student_exit' },
      })
    }

    await prisma.scaffoldingLevel.update({
      where: { studentId_chapterId: { studentId, chapterId } },
      data: { consecutiveFailures: 0 },
    })
  }

  const session = await prisma.session.create({
    data: {
      studentId,
      chapterId,
      startedAt: new Date(),
      scaffoldingLevelStart: scaffoldingLevel.currentLevel,
    },
  })

  return NextResponse.json({ session, resumed: false })
}