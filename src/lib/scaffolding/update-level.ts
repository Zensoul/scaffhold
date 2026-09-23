/**
 * lib/scaffolding/update-level.ts
 *
 * Single entry point for mutating a student's scaffolding level.
 * Every code path that records a graded interaction (annotation
 * fill-in correct/incorrect, comparison question answered, session
 * end) must call this instead of writing to ScaffoldingLevel or
 * ScaffoldingLevelByType directly. Enforcing this in one function is
 * what keeps the stored composite from drifting out of sync with the
 * sub-scores it's supposed to represent.
 *
 * Keep COMPOSITE_WEIGHTS in sync with scripts/backfill-by-type.ts.
 */

import { PrismaClient, FadeAnnotationType, ScaffoldingReason } from '@prisma/client'

const COMPOSITE_WEIGHTS: Record<FadeAnnotationType, number> = {
  unknown: 0.5,
  implied_given: 0.3,
  given: 0.2,
}

const CORRECT_STEP = 0.05
const INCORRECT_STEP = 0.08

type UpdateScaffoldingLevelArgs = {
  studentId: string
  chapterId: string
  sessionId: string
  annotationType: FadeAnnotationType
  wasCorrect: boolean
}

export async function updateScaffoldingLevel(
  prisma: PrismaClient,
  args: UpdateScaffoldingLevelArgs
) {
  const { studentId, chapterId, sessionId, annotationType, wasCorrect } = args

  return prisma.$transaction(async (tx) => {
    // Ensure parent row exists (first interaction for this student+chapter)
    const scaffoldingLevel = await tx.scaffoldingLevel.upsert({
      where: { studentId_chapterId: { studentId, chapterId } },
      create: { studentId, chapterId },
      update: {},
    })

    // Ensure the specific sub-type row exists, then read its current state
    const existingByType = await tx.scaffoldingLevelByType.upsert({
      where: {
        scaffoldingLevelId_annotationType: {
          scaffoldingLevelId: scaffoldingLevel.id,
          annotationType,
        },
      },
      create: { scaffoldingLevelId: scaffoldingLevel.id, annotationType },
      update: {},
    })

    const levelBefore = Number(existingByType.level)
    const step = wasCorrect ? CORRECT_STEP : -INCORRECT_STEP
    const levelAfter = Math.max(0, Math.min(1, levelBefore + step))

    const consecutiveClean = wasCorrect ? existingByType.consecutiveClean + 1 : 0
    const consecutiveFailures = wasCorrect ? 0 : existingByType.consecutiveFailures + 1

    const updatedByType = await tx.scaffoldingLevelByType.update({
      where: { id: existingByType.id },
      data: {
        level: levelAfter.toFixed(3),
        problemsAttempted: { increment: 1 },
        problemsClean: wasCorrect ? { increment: 1 } : undefined,
        consecutiveClean,
        consecutiveFailures,
        lastUpdatedAt: new Date(),
      },
    })

    // Recompute the stored composite from ALL sub-type rows (not just
    // the one that changed) -- guarantees the composite is always a
    // true function of current sub-scores, never a stale accumulation.
    const allByType = await tx.scaffoldingLevelByType.findMany({
      where: { scaffoldingLevelId: scaffoldingLevel.id },
    })

    let composite = 0
    for (const row of allByType) {
      composite += Number(row.level) * COMPOSITE_WEIGHTS[row.annotationType]
    }

    const compositeBefore = Number(scaffoldingLevel.currentLevel)

    await tx.scaffoldingLevel.update({
      where: { id: scaffoldingLevel.id },
      data: {
        currentLevel: composite.toFixed(3),
        problemsAttempted: { increment: 1 },
        problemsClean: wasCorrect ? { increment: 1 } : undefined,
        consecutiveClean: wasCorrect ? { increment: 1 } : { set: 0 },
        consecutiveFailures: wasCorrect ? { set: 0 } : { increment: 1 },
        lastUpdatedAt: new Date(),
      },
    })

    // Audit trail on the composite, matching existing ScaffoldingHistory shape
    await tx.scaffoldingHistory.create({
      data: {
        studentId,
        chapterId,
        sessionId,
        levelBefore: compositeBefore.toFixed(3),
        levelAfter: composite.toFixed(3),
        delta: (composite - compositeBefore).toFixed(3),
        reason: wasCorrect
          ? ScaffoldingReason.correct_answer
          : ScaffoldingReason.incorrect_answer,
      },
    })

    return { byType: updatedByType, composite }
  })
}