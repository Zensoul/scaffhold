import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'
import { selectNextProblem } from '@/lib/scaffolding/adaptive-sequencing'


export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const chapterId = formData.get('chapterId') as string

  if (!chapterId) {
    return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  try {
    await requireConsent(studentId)
  } catch (err) {
    if (err instanceof ConsentError) {
      // A form POST redirecting to JSON would show the user a raw error
      // blob — redirect to a real page instead, since this is reachable
      // directly from a plain HTML button click, not a JS-driven fetch.
      return NextResponse.redirect(new URL('/consent-required', request.url))
    }
    throw err
  }

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

  const nextProblem = await selectNextProblem({ studentId, chapterId })

  if (!nextProblem) {
    return NextResponse.json({ error: 'No active problems in this chapter' }, { status: 422 })
  }

  const redirectUrl = new URL(
    `/problems/${nextProblem.problemId}/start?sessionId=${session.id}`,
    request.url
  )

  return NextResponse.redirect(redirectUrl)
}