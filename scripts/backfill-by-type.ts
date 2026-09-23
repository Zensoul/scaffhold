/**
 * Backfill scaffolding_levels_by_type from real interaction history.
 *
 * Run AFTER the additive migration (migration.sql) has been applied
 * and the flat cross-join backfill has run. This script overwrites
 * those flat placeholder rows with values reconstructed from actual
 * SessionInteraction history, so existing students' sub-scores
 * reflect what they've genuinely demonstrated per annotation type,
 * not a copy of the old blended composite.
 *
 * Idempotent: safe to re-run. Recomputes from scratch each time
 * rather than incrementally adjusting, so a partial/interrupted run
 * never leaves inconsistent state.
 *
 * Usage: npx tsx scripts/backfill-by-type.ts
 */

import { PrismaClient, FadeAnnotationType } from '@prisma/client'

const prisma = new PrismaClient()

// Same weighting used by the live updateScaffoldingLevel() function --
// keep these two in sync (see lib/scaffolding/update-level.ts).
const COMPOSITE_WEIGHTS: Record<FadeAnnotationType, number> = {
  unknown: 0.5,
  implied_given: 0.3,
  given: 0.2,
}

// Simple recency-weighted level estimate from a chronological sequence
// of correct/incorrect flags: each interaction nudges the level by a
// fixed step, correct up, incorrect down harder (asymmetric, matching
// the "protect against false progress" principle) -- clamped to [0, 1].
const CORRECT_STEP = 0.05
const INCORRECT_STEP = 0.08

function computeLevelFromHistory(isCorrectSequence: boolean[]): number {
  let level = 0
  for (const correct of isCorrectSequence) {
    level += correct ? CORRECT_STEP : -INCORRECT_STEP
    level = Math.max(0, Math.min(1, level))
  }
  return level
}

async function main() {
  const scaffoldingLevels = await prisma.scaffoldingLevel.findMany({
    select: { id: true, studentId: true, chapterId: true },
  })

  console.warn(`Backfilling ${scaffoldingLevels.length} scaffolding_levels rows...`)

  for (const sl of scaffoldingLevels) {
    // Pull every graded interaction for this student+chapter, in order,
    // joined to the annotation's type. Only annotation_correct /
    // annotation_incorrect interactionTypes carry a real isCorrect signal.
    const interactions = await prisma.sessionInteraction.findMany({
      where: {
        studentId: sl.studentId,
        problem: { chapterId: sl.chapterId },
        interactionType: { in: ['annotation_correct', 'annotation_incorrect'] },
        isCorrect: { not: null },
        annotation: { annotationType: { in: ['unknown', 'given', 'implied_given'] } },
      },
      include: { annotation: true },
      orderBy: { createdAt: 'asc' },
    })

    const byType: Record<FadeAnnotationType, boolean[]> = {
      unknown: [],
      given: [],
      implied_given: [],
    }

    for (const interaction of interactions) {
      const type = interaction.annotation?.annotationType as FadeAnnotationType | undefined
      if (type && type in byType && interaction.isCorrect !== null) {
        byType[type].push(interaction.isCorrect)
      }
    }

    await prisma.$transaction(async (tx) => {
      let composite = 0

      for (const type of ['unknown', 'given', 'implied_given'] as FadeAnnotationType[]) {
        const sequence = byType[type]
        const level = computeLevelFromHistory(sequence)
        const attempted = sequence.length
        const clean = sequence.filter(Boolean).length

        // consecutiveClean / consecutiveFailures from the tail of the sequence
        let consecutiveClean = 0
        let consecutiveFailures = 0
        for (let i = sequence.length - 1; i >= 0; i--) {
          if (sequence[i]) {
            if (consecutiveFailures > 0) break
            consecutiveClean++
          } else {
            if (consecutiveClean > 0) break
            consecutiveFailures++
          }
        }

        await tx.scaffoldingLevelByType.upsert({
          where: { scaffoldingLevelId_annotationType: { scaffoldingLevelId: sl.id, annotationType: type } },
          create: {
            scaffoldingLevelId: sl.id,
            annotationType: type,
            level,
            problemsAttempted: attempted,
            problemsClean: clean,
            consecutiveClean,
            consecutiveFailures,
          },
          update: {
            level,
            problemsAttempted: attempted,
            problemsClean: clean,
            consecutiveClean,
            consecutiveFailures,
            lastUpdatedAt: new Date(),
          },
        })

        composite += level * COMPOSITE_WEIGHTS[type]
      }

      await tx.scaffoldingLevel.update({
        where: { id: sl.id },
        data: { currentLevel: composite.toFixed(3) },
      })
    })
  }

  console.warn('Backfill complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())