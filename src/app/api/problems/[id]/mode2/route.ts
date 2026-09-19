import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { rephraseHint } from '@/lib/ai/rephrase-hint'
import { checkSessionGuard } from '@/lib/session/session-guard'
import { generateSessionEndStatement } from '@/lib/ai/session-end-statement'
import { getFadeStepForStudent } from '@/lib/scaffolding/fade-logic'

const prisma = new PrismaClient()

const FADEABLE_TYPES = ['given', 'implied_given', 'unknown'] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param is required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { annotations: { orderBy: { sequenceOrder: 'asc' } } },
  })

  if (!problem || !problem.isActive) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  const guard = await checkSessionGuard(sessionId, studentId, problem.chapterId)

  if (guard.shouldEnd) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } })

    if (session && !session.endedAt) {
      const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
        where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
      })

      const statement = await generateSessionEndStatement({
        studentId,
        sessionId,
        reason: guard.reason,
        problemsAttempted: session.problemsAttempted,
        problemsClean: scaffoldingLevel?.problemsClean ?? 0,
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          endReason: guard.reason,
          scaffoldingLevelEnd: scaffoldingLevel?.currentLevel,
          sessionEndStatement: statement,
          aiModelUsed: 'gpt-4o-mini',
        },
      })

      return NextResponse.json({ sessionEnded: true, reason: guard.reason, statement })
    }

    return NextResponse.json({
      sessionEnded: true,
      reason: session?.endReason ?? guard.reason,
      statement: session?.sessionEndStatement ?? null,
    })
  }

  const fadeable = problem.annotations.filter((a) =>
    FADEABLE_TYPES.includes(a.annotationType as (typeof FADEABLE_TYPES)[number])
  )

  if (fadeable.length === 0) {
    return NextResponse.json({ error: 'Problem has no fadeable annotations' }, { status: 422 })
  }

  // Progressive fade: how many pieces to hide is decided by currentLevel;
  // which pieces (today: fixed easiest-first order — see fade-logic.ts
  // for why personalized selection isn't safe to build yet).
  const { hidden: hiddenSet, hideCount, currentLevel } = await getFadeStepForStudent(
    studentId,
    problem.chapterId,
    fadeable
  )

  // Of this attempt's hidden set, find the first one NOT yet answered
  // correctly in this session. The student answers one piece at a time,
  // in sequence — same interaction shape regardless of hideCount.
  const answeredCorrectlyIds = new Set(
    (
      await prisma.sessionInteraction.findMany({
        where: {
          sessionId,
          problemId: problem.id,
          isCorrect: true,
          annotationId: { in: hiddenSet.map((a) => a.id) },
        },
        select: { annotationId: true },
      })
    ).map((i) => i.annotationId)
  )

  const nextToAnswer = hiddenSet.find((a) => !answeredCorrectlyIds.has(a.id))

  if (!nextToAnswer) {
    // All hidden pieces for this attempt are answered — problem complete.
    await prisma.session.update({
      where: { id: sessionId },
      data: { problemsPresented: { increment: 1 } },
    })

    return NextResponse.json({
      sessionEnded: false,
      problemComplete: true,
      problem: {
        id: problem.id,
        rawText: problem.rawText,
        concreteRestatement: problem.concreteRestatement,
      },
      annotations: problem.annotations, // full reveal
    })
  }

  const visible = problem.annotations.filter(
    (a) => !hiddenSet.some((h) => h.id === a.id) || answeredCorrectlyIds.has(a.id)
  )

  const priorMisses = await prisma.sessionInteraction.count({
    where: { studentId, annotationId: nextToAnswer.id, isCorrect: false },
  })

  let hintText = nextToAnswer.hintText
  let hintWasRephrased = false

  if (priorMisses >= 1) {
    const lastMiss = await prisma.sessionInteraction.findFirst({
      where: { studentId, annotationId: nextToAnswer.id, isCorrect: false },
      orderBy: { createdAt: 'desc' },
    })

    hintText = await rephraseHint({
      studentId,
      sessionId,
      problemId: problem.id,
      originalHint: nextToAnswer.hintText,
      annotationText: nextToAnswer.annotationText,
      studentWrongAnswer: lastMiss?.studentResponse ?? '',
      attemptNumber: priorMisses + 1,
    })
    hintWasRephrased = true
  }

  return NextResponse.json({
    sessionEnded: false,
    problemComplete: false,
    problem: {
      id: problem.id,
      rawText: problem.rawText,
      concreteRestatement: problem.concreteRestatement,
      problemType: problem.problemType,
      difficultyTier: problem.difficultyTier,
    },
    visibleAnnotations: visible,
    hiddenAnnotation: {
      id: nextToAnswer.id,
      annotationType: nextToAnswer.annotationType,
      sequenceOrder: nextToAnswer.sequenceOrder,
      hintText,
      hintWasRephrased,
    },
    // Informational — lets the UI show "piece 2 of 3" style progress if desired.
    fadeProgress: {
      totalHidden: hiddenSet.length,
      answeredSoFar: answeredCorrectlyIds.size,
      currentLevel,
    },
  })
}