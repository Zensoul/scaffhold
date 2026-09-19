import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { chapterId } = body as { chapterId: string }

  if (!chapterId) {
    return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  // Idempotent: if an active session (no endedAt) already exists for this
  // student+chapter, return it rather than creating a duplicate. This
  // covers refreshes, double-clicks, and multiple tabs cleanly.
  const existing = await prisma.session.findFirst({
    where: {
      studentId,
      chapterId,
      endedAt: null,
    },
    orderBy: { startedAt: 'desc' },
  })

  if (existing) {
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