import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { InteractionType, ScaffoldingReason, Prisma } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { assertOwnsSession, SessionOwnershipError } from '@/lib/session/assert-owns-session'
import { checkRateLimit } from '@/lib/rate-limit'


const LEVEL_DELTA_COMPARISON_CORRECT = 0.02

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params
  const body = await request.json()
  const { interactionId, selectedOptionId, sessionId } = body as {
    interactionId: string
    selectedOptionId: string
    sessionId: string
  }

  if (!interactionId || !selectedOptionId || !sessionId) {
    return NextResponse.json(
      { error: 'interactionId, selectedOptionId, and sessionId are required' },
      { status: 400 }
    )
  }

  const studentId = await getCurrentStudentId()

  // Rate limit: this route itself doesn't call an LLM, but keeps write volume bounded.
  const rateLimit = checkRateLimit(`comparison-answer:${studentId}`, 30, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }

  // IDOR guard: previously originalInteraction was fetched by
  // interactionId alone with no ownership check -- any authenticated
  // student could supply another student's interactionId, read their
  // comparisonData.correctOptionId, and record an answer against their
  // scaffolding level. Caught in tonight's security audit. Two checks:
  // the session in the request body must belong to this student, and
  // the interaction being answered must both belong to this student AND
  // match that same session (defense in depth against a student mixing
  // their own valid sessionId with someone else's interactionId).
  try {
    await assertOwnsSession(sessionId, studentId)
  } catch (err) {
    if (err instanceof SessionOwnershipError) {
      return NextResponse.json({ error: 'Session is not active — start a new one' }, { status: 409 })
    }
    throw err
  }

  const originalInteraction = await prisma.sessionInteraction.findUnique({
    where: { id: interactionId },
  })

  if (
    !originalInteraction ||
    !originalInteraction.comparisonData ||
    originalInteraction.studentId !== studentId ||
    originalInteraction.sessionId !== sessionId
  ) {
    return NextResponse.json(
      { error: 'No comparison question found for this interaction' },
      { status: 404 }
    )
  }

  const comparisonData = originalInteraction.comparisonData as {
    correctOptionId: string
  }

  const isCorrect = selectedOptionId === comparisonData.correctOptionId

  const problem = await prisma.problem.findUnique({ where: { id: problemId } })
  if (!problem) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

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
  const delta = isCorrect ? LEVEL_DELTA_COMPARISON_CORRECT : 0
  const levelAfter = Math.max(0, Math.min(1, Number(levelBefore) + delta))

  // Use Prisma.PrismaPromise<unknown>[] so the array can hold mixed
  // operation types (create + update + create) without TypeScript trying
  // to force one shared return shape onto every element.
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.sessionInteraction.create({
      data: {
        sessionId,
        studentId,
        problemId,
        interactionType: InteractionType.comparison_answered,
        annotationId: originalInteraction.annotationId,
        studentResponse: selectedOptionId,
        isCorrect,
        scaffoldingLevelAt: levelAfter,
      },
    }),
  ]

  if (isCorrect) {
    writes.push(
      prisma.scaffoldingLevel.update({
        where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
        data: { currentLevel: levelAfter },
      })
    )
    writes.push(
      prisma.scaffoldingHistory.create({
        data: {
          studentId,
          chapterId: problem.chapterId,
          sessionId,
          levelBefore,
          levelAfter,
          delta,
          reason: ScaffoldingReason.correct_answer,
        },
      })
    )
  }

  await prisma.$transaction(writes)

  return NextResponse.json({
    isCorrect,
    levelBefore,
    levelAfter: isCorrect ? levelAfter : levelBefore,
  })
}