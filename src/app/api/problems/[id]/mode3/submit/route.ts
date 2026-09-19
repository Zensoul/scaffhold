import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, InteractionType, ScaffoldingReason } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { gradeOpenTextAnswer } from '@/lib/ai/grade-open-text'

const prisma = new PrismaClient()

// Larger deltas than Mode 2 — succeeding here, unaided, is the actual
// 90-day goal, so it should move the needle more than a scaffolded
// fill-in-the-blank success. A miss here is also more informative (it
// means the fade hasn't actually transferred to independent ability
// yet), so it costs a bit more too — this is a placeholder pairing,
// same category as every other delta constant, pending real data.
const LEVEL_DELTA_CORRECT = 0.08
const LEVEL_DELTA_INCORRECT = -0.03

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params
  const body = await request.json()
  const { promptType, studentResponse, sessionId, timeOnStepMs } = body as {
    promptType: 'restate_unknown' | 'list_givens'
    studentResponse: string
    sessionId: string
    timeOnStepMs?: number
  }

  if (!promptType || typeof studentResponse !== 'string' || !sessionId) {
    return NextResponse.json(
      { error: 'promptType, studentResponse, and sessionId are required' },
      { status: 400 }
    )
  }

  const studentId = await getCurrentStudentId()

  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session || session.endedAt) {
    return NextResponse.json({ error: 'Session is not active — start a new one' }, { status: 409 })
  }

  const problem = await prisma.problem.findUnique({ where: { id: problemId } })
  if (!problem) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  // Reference content for grading: unknownAnnotation for restate_unknown,
  // a joined summary of givens (from the derived-cache JSON field) for
  // list_givens — using the same cache field Mode 1 reads for display.
  const referenceContent =
    promptType === 'restate_unknown'
      ? problem.unknownAnnotation
      : JSON.stringify(problem.givens)

  const { isCorrect: correct, feedback } = await gradeOpenTextAnswer({
    studentId,
    sessionId,
    problemId,
    promptType,
    studentResponse,
    referenceContent,
  })

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
  })

  if (!scaffoldingLevel) {
    return NextResponse.json(
      { error: 'No scaffolding level record for this student/chapter' },
      { status: 422 }
    )
  }

  const levelBefore = scaffoldingLevel.currentLevel
  const delta = correct ? LEVEL_DELTA_CORRECT : LEVEL_DELTA_INCORRECT
  const levelAfter = Math.max(0, Math.min(1, Number(levelBefore) + delta))

  const [interaction] = await prisma.$transaction([
    prisma.sessionInteraction.create({
      data: {
        sessionId,
        studentId,
        problemId,
        interactionType: correct
          ? InteractionType.annotation_correct
          : InteractionType.annotation_incorrect,
        annotationId: null, // Mode 3 has no specific annotation being answered
        mode3PromptType: promptType,
        studentResponse,
        isCorrect: correct,
        scaffoldingLevelAt: levelAfter,
        timeOnStepMs,
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
    feedback,
    levelBefore,
    levelAfter,
    interactionId: interaction.id,
  })
}