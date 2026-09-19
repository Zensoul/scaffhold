import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'

const prisma = new PrismaClient()

// Same logic as /api/sessions/start, but responds with a redirect
// instead of JSON — for use directly from an HTML <form> POST (no
// client-side JS needed on the home page for this simple action).
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const chapterId = formData.get('chapterId') as string

  if (!chapterId) {
    return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  const existing = await prisma.session.findFirst({
    where: { studentId, chapterId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })

  let session = existing

  if (!session) {
    const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
      where: { studentId_chapterId: { studentId, chapterId } },
    })

    if (!scaffoldingLevel) {
      return NextResponse.json(
        { error: 'No scaffolding level record for this student/chapter' },
        { status: 422 }
      )
    }

    session = await prisma.session.create({
      data: {
        studentId,
        chapterId,
        startedAt: new Date(),
        scaffoldingLevelStart: scaffoldingLevel.currentLevel,
      },
    })
  }

  // Pick the first active problem in this chapter — a real "which
  // problem next" decision (adaptive sequencing) doesn't exist yet;
  // this is an honest placeholder, not a hidden feature.
  const firstProblem = await prisma.problem.findFirst({
    where: { chapterId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!firstProblem) {
    return NextResponse.json({ error: 'No active problems in this chapter' }, { status: 422 })
  }

  const redirectUrl = new URL(
    `/problems/${firstProblem.id}/start?sessionId=${session.id}`,
    request.url
  )

  return NextResponse.redirect(redirectUrl)
}