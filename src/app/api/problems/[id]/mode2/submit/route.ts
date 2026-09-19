import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, InteractionType, ScaffoldingReason } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { gradeAnswer } from '@/lib/ai/grade-answer'
import { generateComparisonQuestion } from '@/lib/ai/comparison-question'

const prisma = new PrismaClient()

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

  // If wrong, generate the comparison question BEFORE writing the
  // interaction row, so we can store it alongside in one write.
  const comparisonQuestion = correct
    ? null
    : await generateComparisonQuestion({
        studentId,
        sessionId,
        problemId,
        correctText: annotation.annotationText,
        studentWrongAnswer: studentResponse,
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
    correctAnswer: correct ? undefined : annotation.annotationText,
    levelBefore,
    levelAfter,
    interactionId: interaction.id,
    gradedByLLM: usedLLM,
    // Present only when wrong — the UI shows this instead of a flat reveal.
    comparisonQuestion: comparisonQuestion
      ? {
          interactionId: interaction.id, // needed for the follow-up answer call
          question: comparisonQuestion.question,
          options: comparisonQuestion.options,
          // correctOptionId deliberately NOT sent to the client — it's
          // checked server-side on the follow-up call, same principle as
          // never sending annotationText for the hidden piece itself.
        }
      : null,
  })
}