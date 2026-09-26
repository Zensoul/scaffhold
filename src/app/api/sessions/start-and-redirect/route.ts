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
    // A brand-new student (or, as we found via testing, a reset one)
    // has no ScaffoldingLevel row yet -- this used to 422 here, which
    // meant EVERY real student would hit an error on their very first
    // "Start" click, since nobody has a ScaffoldingLevel before their
    // first session. Upsert instead, matching the same pattern
    // updateScaffoldingLevel already uses: a first-time student starts
    // at the schema's own defaults (currentLevel 0), created lazily
    // right here rather than requiring some other code path to have
    // seeded it first.
    const scaffoldingLevel = await prisma.scaffoldingLevel.upsert({
      where: { studentId_chapterId: { studentId, chapterId } },
      create: { studentId, chapterId },
      update: {},
    })

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