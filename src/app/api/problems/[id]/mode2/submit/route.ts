import { NextRequest, NextResponse } from 'next/server'
import { InteractionType, ScaffoldingReason } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { gradeAnswer } from '@/lib/ai/grade-answer'
import { generateComparisonQuestion } from '@/lib/ai/comparison-question'

const LEVEL_DELTA_CORRECT = 0.05
const LEVEL_DELTA_INCORRECT = -0.02

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

  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session || session.endedAt) {
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
    where: { studentId, annotationId: annotation.id, isCorrect: false },
  })

  const { isCorrect: correct, usedLLM } = await gradeAnswer({
    studentId,
    sessionId,
    problemId,
    annotationId: annotation.id,
    studentResponse,
    correctText: annotation.annotationText,
  })

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
  })

  if (!scaffoldingLevel) {
    return NextResponse.json(
      { error: 'No scaffolding level record for this student/chapter — seed one first' },
      { status: 422 }
    )
  }

  const levelBefore = scaffoldingLevel.currentLevel
  const delta = correct ? LEVEL_DELTA_CORRECT : LEVEL_DELTA_INCORRECT
  const levelAfter = Math.max(0, Math.min(1, Number(levelBefore) + delta))

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
    prisma.scaffoldingLevel.update({
      where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
      data: {
        currentLevel: levelAfter,
        problemsAttempted: { increment: 1 },
        problemsClean: correct ? { increment: 1 } : undefined,
        consecutiveClean: correct ? { increment: 1 } : 0,
        consecutiveFailures: correct ? 0 : { increment: 1 },
      },
    }),
    prisma.scaffoldingHistory.create({
      data: {
        studentId,
        chapterId: problem.chapterId,
        sessionId,
        levelBefore,
        levelAfter,
        delta,
        reason: correct
          ? ScaffoldingReason.correct_answer
          : ScaffoldingReason.incorrect_answer,
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