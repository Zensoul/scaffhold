import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { rephraseHint } from '@/lib/ai/rephrase-hint'
import { checkSessionGuard } from '@/lib/session/session-guard'
import { generateSessionEndStatement } from '@/lib/ai/session-end-statement'
import { getFadeStepForStudent } from '@/lib/scaffolding/fade-logic'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'
import { checkRateLimit } from '@/lib/rate-limit'

// Only 'unknown' annotations are ever hidden/graded. A 'given' is
// handed to the student, not something to derive -- fading it out and
// asking for the exact restated prose back turns a fact into a
// phrasing-guessing game, and 'given'/'implied_given' text is now
// always shown alongside 'concept_anchor' instead.
const FADEABLE_TYPES = ['unknown'] as const

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

  // Rate limit: this route calls rephraseHint (an LLM call) on retries
  // after a miss, so bound how often one student can hit it.
  const rateLimit = checkRateLimit(`mode2-get:${studentId}`, 60, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }

  const consentPromise = requireConsent(studentId)
  const problemPromise = prisma.problem.findUnique({
    where: { id },
    include: { annotations: { orderBy: { sequenceOrder: 'asc' } }, diagram: { include: { stages: { orderBy: { stageIndex: 'asc' } } } } },
  })

  let problem: Awaited<typeof problemPromise>
  try {
    ;[, problem] = await Promise.all([consentPromise, problemPromise])
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

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

      return NextResponse.json({
        sessionEnded: true,
        reason: guard.reason,
        statement,
        chapterId: problem.chapterId,
      })
    }

    return NextResponse.json({
      sessionEnded: true,
      reason: session?.endReason ?? guard.reason,
      statement: session?.sessionEndStatement ?? null,
      chapterId: problem.chapterId,
    })
  }

  const fadeable = problem.annotations.filter((a) =>
    FADEABLE_TYPES.includes(a.annotationType as (typeof FADEABLE_TYPES)[number])
  )

  if (fadeable.length === 0) {
    return NextResponse.json({ error: 'Problem has no fadeable annotations' }, { status: 422 })
  }

  const { hidden: hiddenSet, hideCount, currentLevel } = await getFadeStepForStudent(
    studentId,
    problem.chapterId,
    fadeable
  )

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
        givens: problem.givens,
        problemType: problem.problemType,
      },
      chapterId: problem.chapterId,
      annotations: problem.annotations,
      diagramUrl: problem.diagram?.status === 'approved' ? problem.diagram.videoUrl : null,
      diagramStages: problem.diagram?.status === 'approved' && problem.diagram.stages.length > 0
        ? problem.diagram.stages.map(s => ({ stageIndex: s.stageIndex, videoUrl: s.videoUrl, label: s.label }))
        : null,
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
      givens: problem.givens,
    },
    visibleAnnotations: visible,
    hiddenAnnotation: {
      id: nextToAnswer.id,
      annotationType: nextToAnswer.annotationType,
      sequenceOrder: nextToAnswer.sequenceOrder,
      hintText,
      hintWasRephrased,
      label: nextToAnswer.label ?? null,
    },
    fadeProgress: {
      totalHidden: hiddenSet.length,
      answeredSoFar: answeredCorrectlyIds.size,
      currentLevel,
    },
    diagramUrl: problem.diagram?.status === 'approved' ? problem.diagram.videoUrl : null,
    diagramStages: problem.diagram?.status === 'approved' && problem.diagram.stages.length > 0
      ? problem.diagram.stages.map(s => ({ stageIndex: s.stageIndex, videoUrl: s.videoUrl, label: s.label }))
      : null,
  })
}
