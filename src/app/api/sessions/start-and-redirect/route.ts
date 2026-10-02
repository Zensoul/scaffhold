import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'
import { selectNextProblem } from '@/lib/scaffolding/adaptive-sequencing'

const MODE_3_THRESHOLD = 0.8

function ms(start: number) {
  return `${Date.now() - start}ms`
}

export async function POST(request: NextRequest) {
  const t0 = Date.now()
  const formData = await request.formData()
  const chapterId = formData.get('chapterId') as string

  if (!chapterId) {
    return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
  }

  const tAuth = Date.now()
  const studentId = await getCurrentStudentId()
  console.log(`[start-redirect] auth: ${ms(tAuth)}`)

  try {
    await requireConsent(studentId)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.redirect(new URL('/consent-required', request.url))
    }
    throw err
  }

  const tDb = Date.now()
  const [existing, scaffoldingLevel, allProblems, interactions] = await Promise.all([
    prisma.session.findFirst({
      where: { studentId, chapterId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.scaffoldingLevel.upsert({
      where: { studentId_chapterId: { studentId, chapterId } },
      create: { studentId, chapterId },
      update: {},
    }),
    prisma.problem.findMany({
      where: { chapterId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        problemType: true,
        isActive: true,
        guidedSolve: { select: { id: true } },
      },
    }),
    prisma.sessionInteraction.findMany({
      where: { studentId, problem: { chapterId } },
      select: {
        problemId: true,
        isCorrect: true,
        problem: { select: { chapterId: true, problemType: true } },
        annotation: { select: { annotationType: true } },
      },
    }),
  ])
  console.log(`[start-redirect] parallel DB queries: ${ms(tDb)}`)

  let session = existing

  if (!session) {
    const tCreate = Date.now()
    session = await prisma.session.create({
      data: {
        studentId,
        chapterId,
        startedAt: new Date(),
        scaffoldingLevelStart: scaffoldingLevel.currentLevel,
      },
    })
    console.log(`[start-redirect] session.create: ${ms(tCreate)}`)
  }

  const nextProblem = await selectNextProblem(
    { studentId, chapterId },
    {
      problems: allProblems.map((p) => ({
        id: p.id,
        problemType: p.problemType,
        isActive: true,
      })),
      interactions,
    },
  )

  if (!nextProblem) {
    return NextResponse.json({ error: 'No active problems in this chapter' }, { status: 422 })
  }

  const problemId = nextProblem.problemId
  const problem = allProblems.find((p) => p.id === problemId)

  let destination: string
  if (problem?.guidedSolve) {
    destination = `/problems/${problemId}/guided?sessionId=${session.id}`
  } else {
    const isBrandNew = scaffoldingLevel.problemsAttempted === 0
    if (isBrandNew) {
      destination = `/problems/${problemId}/mode1?sessionId=${session.id}`
    } else {
      const currentLevel = Number(scaffoldingLevel.currentLevel)
      const targetMode = currentLevel > MODE_3_THRESHOLD ? 'mode3' : 'mode2'
      destination = `/problems/${problemId}/${targetMode}?sessionId=${session.id}`
    }
  }

  console.log(`[start-redirect] total: ${ms(t0)} → ${destination}`)
  return NextResponse.redirect(new URL(destination, request.url))
}
