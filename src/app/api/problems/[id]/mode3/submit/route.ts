import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { InteractionType, ScaffoldingReason } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { gradeOpenTextAnswer } from '@/lib/ai/grade-open-text'
import { moderateStudentText, recordNotificationOwed } from '@/lib/safety/content-moderation'
import { assertOwnsSession, SessionOwnershipError } from '@/lib/session/assert-owns-session'
import { checkRateLimit } from '@/lib/rate-limit'


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

  // Rate limit: caps AI grading calls per student to control cost/abuse.
  const rateLimit = checkRateLimit(`grade:${studentId}`, 30, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }

  // IDOR guard: same class of bug as mode2/submit -- see that file's
  // comment. Caught in tonight's security audit.
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

  const problem = await prisma.problem.findUnique({ where: { id: problemId } })
  if (!problem) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  const moderation = await moderateStudentText({
    studentId,
    sessionId,
    problemId,
    text: studentResponse,
  })

  if (moderation.flagged) {
    await recordNotificationOwed(moderation.flaggedContentId)

    return NextResponse.json({
      correct: false,
      feedback:
        "Thanks for sharing that. This seems like something worth talking through with a " +
        "parent, teacher, or someone you trust — not something to work out here. " +
        "If you ever need to talk to someone right away, you can reach Tele-MANAS at " +
        "14416 or 1-800-891-4416 (India), free and available 24/7 in 20 languages.",
      moderationFlagged: true,
    })
  }

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
        annotationId: null,
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