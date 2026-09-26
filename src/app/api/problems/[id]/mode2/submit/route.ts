import { NextRequest, NextResponse } from 'next/server'
import { InteractionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { gradeAnswer } from '@/lib/ai/grade-answer'
import { generateComparisonQuestion } from '@/lib/ai/comparison-question'
import { updateScaffoldingLevel } from '@/lib/scaffolding/update-level'
import { assertOwnsSession, SessionOwnershipError } from '@/lib/session/assert-owns-session'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params
  const body = await request.json()
  const { annotationId, studentResponse, sessionId, timeOnStepMs } = body as {
    annotationId: string
    studentResponse: string
    sessionId: string
    timeOnStepMs?: number
  }

  if (!annotationId || typeof studentResponse !== 'string' || !sessionId) {
    return NextResponse.json(
      { error: 'annotationId, studentResponse, and sessionId are required' },
      { status: 400 }
    )
  }

  const studentId = await getCurrentStudentId()

  // Rate limit: caps AI grading calls per student to control cost/abuse.
  const rateLimit = checkRateLimit(`grade:${studentId}`, 30, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }

  // IDOR guard: previously this fetched by sessionId alone, so any
  // authenticated student could submit answers into another student's
  // active session -- mutating their problemsAttempted count and
  // scaffolding level. Caught in tonight's security audit.
  let session
  try {
    session = await assertOwnsSession(sessionId, studentId)
  } catch (err) {
    if (err instanceof SessionOwnershipError) {
      return NextResponse.json({ error: 'Session is not active — start a new one' }, { status: 409 })
    }
    throw err
  }
  if (session.endedAt) {
    return NextResponse.json({ error: 'Session is not active — start a new one' }, { status: 409 })
  }

  const annotation = await prisma.problemAnnotation.findUnique({ where: { id: annotationId } })
  if (!annotation || annotation.problemId !== problemId) {
    return NextResponse.json({ error: 'Annotation not found for this problem' }, { status: 404 })
  }

  const problem = await prisma.problem.findUnique({ where: { id: problemId } })
  if (!problem) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  // Count PRIOR misses on this exact annotation, BEFORE this submission
  // is recorded. Reused from the same signal Mode 2's GET route already
  // uses for hint rephrasing — here it decides whether a wrong answer
  // triggers the comparison question or a genuine "try again" state.
  //
  // Research basis (learned-helplessness / productive-struggle
  // literature): a self-generated correct answer carries a stronger
  // "I figured this out" signal than a correctly-recognized multiple-
  // choice option. Give one bounded, nudge-supported retry in the
  // student's own words first, and only escalate to the structured
  // comparison-question recovery after a SECOND miss on the same piece.
  const priorMissesBeforeThisAttempt = await prisma.sessionInteraction.count({
    where: { studentId, sessionId, annotationId: annotation.id, isCorrect: false },
  })

  const { isCorrect: correct, usedLLM } = await gradeAnswer({
    studentId,
    sessionId,
    problemId,
    annotationId: annotation.id,
    studentResponse,
    correctText: annotation.annotationText,
  })

  // Upsert scaffolding level: create with sensible defaults if it doesn't
  // exist yet (e.g. for chapters added after initial seed). This prevents
  // a hard 422 that silently loops the UI back to the same question.
  const scaffoldingLevel = await prisma.scaffoldingLevel.upsert({
    where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
    update: {},
    create: {
      studentId,
      chapterId: problem.chapterId,
      currentLevel: 0.1,
      problemsAttempted: 0,
      problemsClean: 0,
      consecutiveClean: 0,
      consecutiveFailures: 0,
    },
  })

  const levelBefore = scaffoldingLevel.currentLevel

  // Only generate the comparison question once the student has ALREADY
  // missed this piece before. A first-ever miss gets NO comparison
  // question — just the correctness result, so the UI shows a genuine
  // "try again in your own words" state instead.
  const isSecondOrLaterMiss = !correct && priorMissesBeforeThisAttempt >= 1

  const comparisonQuestion = isSecondOrLaterMiss
    ? await generateComparisonQuestion({
        studentId,
        sessionId,
        problemId,
        correctText: annotation.annotationText,
        studentWrongAnswer: studentResponse,
      })
    : null

  // Only 'unknown' annotations are ever hidden by Mode 2's GET route
  // now (FADEABLE_TYPES), so 'given', 'implied_given', and
  // 'concept_anchor' should never reach this route in practice -- the
  // guard keeps that invariant explicit rather than assumed.
  if (annotation.annotationType !== 'unknown') {
    return NextResponse.json(
      { error: 'Only unknown annotations are gradeable in Mode 2' },
      { status: 500 }
    )
  }

  // Updates the per-type sub-score (ScaffoldingLevelByType) for this
  // annotation's type, recomputes the weighted composite from ALL
  // sub-scores, mirrors problemsAttempted/problemsClean/consecutiveClean/
  // consecutiveFailures onto the parent ScaffoldingLevel row (so
  // session-guard.ts's consecutiveFailures check keeps working exactly
  // as before), and writes the ScaffoldingHistory audit row — all inside
  // one DB transaction. Replaces the old flat +0.05/-0.02 scalar update.
  const { composite: levelAfter } = await updateScaffoldingLevel(prisma, {
    studentId,
    chapterId: problem.chapterId,
    sessionId,
    annotationType: annotation.annotationType as 'unknown' | 'given' | 'implied_given',
    wasCorrect: correct,
  })

  const [interaction] = await prisma.$transaction([
    prisma.sessionInteraction.create({
      data: {
        sessionId,
        studentId,
        problemId,
        interactionType: correct
          ? InteractionType.annotation_correct
          : InteractionType.annotation_incorrect,
        annotationId: annotation.id,
        studentResponse,
        isCorrect: correct,
        scaffoldingLevelAt: levelAfter,
        timeOnStepMs,
        comparisonData: comparisonQuestion ? JSON.parse(JSON.stringify(comparisonQuestion)) : undefined,
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { problemsAttempted: { increment: 1 } },
    }),
  ])

  return NextResponse.json({
    correct,
    // Withhold the correct answer entirely on a first miss — the
    // student should be retrying in their own words, not seeing it.
    // Only revealed on a second-or-later miss (never needed when
    // correct, since there's nothing to reveal).
    correctAnswer: isSecondOrLaterMiss ? annotation.annotationText : undefined,
    isFirstMiss: !correct && !isSecondOrLaterMiss,
    levelBefore,
    levelAfter,
    interactionId: interaction.id,
    gradedByLLM: usedLLM,
    comparisonQuestion: comparisonQuestion
      ? {
          interactionId: interaction.id,
          question: comparisonQuestion.question,
          options: comparisonQuestion.options,
        }
      : null,
  })
}