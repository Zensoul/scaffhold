import { prisma } from '@/lib/db/prisma'

const MIN_SAMPLES_TO_TRUST = 2

// Types for pre-fetched data that callers can pass in to avoid duplicate
// DB queries. Both fields are optional — if omitted, the function fetches
// them itself (backwards-compatible for callers that don't have the data).
type ProblemStub = {
  id: string
  problemType: string
  isActive: boolean
}

type InteractionStub = {
  problemId: string
  isCorrect: boolean | null
  problem: { chapterId: string; problemType: string }
  annotation: { annotationType: string } | null
}

type Prefetched = {
  problems?: ProblemStub[]
  interactions?: InteractionStub[]
}

// Adaptive sequencing: decides which problem a student sees next, based
// on real evidence of where they struggle — not just "first in chapter."
//
// DELIBERATELY SIMPLE SCORING, not a weighted black-box formula. With
// only a handful of problems and interactions per student, a fancier
// combined score would mostly be fitting noise, not signal. Rules,
// applied in order:
//   1. Unattempted problems always win over repeats — fresh content is
//      more informative than any repeat, when it exists.
//   2. Compute miss-rate per problemType. If any type has enough samples
//      and a miss-rate distinctly higher than the others, repeat that type.
//   3. If problemType signal is inconclusive, fall back to annotationType
//      miss-rate as a tiebreaker.
//   4. If no signal is trustworthy, fall back to the first problem —
//      the honest floor when there isn't enough data yet.
export async function selectNextProblem(
  params: { studentId: string; chapterId: string },
  prefetched?: Prefetched,
): Promise<{ problemId: string; reason: string } | null> {
  const { studentId, chapterId } = params

  // Use pre-fetched problems if provided, otherwise query DB
  const allProblems =
    prefetched?.problems ??
    (await prisma.problem.findMany({
      where: { chapterId, isActive: true },
      orderBy: { createdAt: 'asc' },
    }))

  if (allProblems.length === 0) return null

  // Use pre-fetched interactions if provided, otherwise query DB.
  // Callers that already fetched interactions for this studentId+chapterId
  // should pass them in to avoid the extra round-trip.
  const interactions =
    prefetched?.interactions ??
    (await prisma.sessionInteraction.findMany({
      where: {
        studentId,
        problem: { chapterId },
      },
      include: { problem: true, annotation: true },
    }))

  const attemptedProblemIds = new Set(interactions.map((i) => i.problemId))
  const unattempted = allProblems.filter((p) => !attemptedProblemIds.has(p.id))

  if (interactions.length === 0) {
    return { problemId: allProblems[0].id, reason: 'no_prior_data' }
  }

  if (unattempted.length > 0) {
    return { problemId: unattempted[0].id, reason: 'unattempted_problem_available' }
  }

  const byProblemType = new Map<string, { attempts: number; misses: number }>()
  for (const i of interactions) {
    const type = i.problem.problemType
    const entry = byProblemType.get(type) ?? { attempts: 0, misses: 0 }
    entry.attempts += 1
    if (i.isCorrect === false) entry.misses += 1
    byProblemType.set(type, entry)
  }

  const problemTypeMissRates = [...byProblemType.entries()]
    .filter(([, v]) => v.attempts >= MIN_SAMPLES_TO_TRUST)
    .map(([type, v]) => ({ type, missRate: v.misses / v.attempts }))
    .sort((a, b) => b.missRate - a.missRate)

  if (problemTypeMissRates.length > 0 && problemTypeMissRates[0].missRate > 0) {
    const weakestType = problemTypeMissRates[0].type
    const isDistinct =
      problemTypeMissRates.length === 1 ||
      problemTypeMissRates[0].missRate > problemTypeMissRates[1].missRate

    if (isDistinct) {
      const candidate = allProblems.find((p) => p.problemType === weakestType)
      if (candidate) {
        return { problemId: candidate.id, reason: `weak_problem_type:${weakestType}` }
      }
    }
  }

  const byAnnotationType = new Map<string, { attempts: number; misses: number }>()
  for (const i of interactions) {
    const type = i.annotation?.annotationType
    if (!type) continue
    const entry = byAnnotationType.get(type) ?? { attempts: 0, misses: 0 }
    entry.attempts += 1
    if (i.isCorrect === false) entry.misses += 1
    byAnnotationType.set(type, entry)
  }

  const annotationMissRates = [...byAnnotationType.entries()]
    .filter(([, v]) => v.attempts >= MIN_SAMPLES_TO_TRUST)
    .map(([type, v]) => ({ type, missRate: v.misses / v.attempts }))
    .sort((a, b) => b.missRate - a.missRate)

  if (annotationMissRates.length > 0 && annotationMissRates[0].missRate > 0) {
    const weakestAnnotationType = annotationMissRates[0].type
    const problemsWithAnnotations = await prisma.problem.findMany({
      where: {
        chapterId,
        isActive: true,
        annotations: { some: { annotationType: weakestAnnotationType as any } },
      },
    })
    if (problemsWithAnnotations.length > 0) {
      return {
        problemId: problemsWithAnnotations[0].id,
        reason: `weak_annotation_type:${weakestAnnotationType}`,
      }
    }
  }

  return { problemId: allProblems[0].id, reason: 'insufficient_data_fallback' }
}
