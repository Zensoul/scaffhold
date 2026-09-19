import { PrismaClient, ProblemAnnotation } from '@prisma/client'

const prisma = new PrismaClient()

// --- Step 1: how many pieces to hide, decided by currentLevel ---
//
// currentLevel is the single source of truth for "how is this student
// doing" across the whole product (ScaffoldingHistory, the eventual
// parent summary, etc.) — thresholds read that one number rather than
// introducing a second competing signal like consecutiveClean, which
// would just duplicate what currentLevel already reflects.
//
// Thresholds are a placeholder until real pilot data suggests better
// cutoffs — same category of constant as the +0.05/-0.02 level deltas,
// flagged for recalibration once usage data exists.
const FADE_THRESHOLDS = [
  { maxLevel: 0.3, hideCount: 1 },
  { maxLevel: 0.6, hideCount: 2 },
  { maxLevel: 1.01, hideCount: 3 }, // 1.01 so level === 1.0 is still caught
]

export function getHideCountForLevel(currentLevel: number): number {
  for (const { maxLevel, hideCount } of FADE_THRESHOLDS) {
    if (currentLevel < maxLevel) return hideCount
  }
  return FADE_THRESHOLDS[FADE_THRESHOLDS.length - 1].hideCount
}

// --- Step 2: which specific pieces to hide, given a count ---
//
// PLUGGABLE BY DESIGN. Today this returns fixed sequenceOrder (easiest
// first) because there isn't enough per-student data yet to personalize
// safely — a miss-rate-weighted selector built on a handful of data
// points would be noise wearing a personalization costume, not a real
// improvement. When real pilot data justifies it, swap this function's
// internals (e.g. to weight by per-annotationType miss rate from
// pattern-analysis.ts) — nothing calling this function needs to change.
export function selectAnnotationsToHide(
  fadeableAnnotations: ProblemAnnotation[],
  hideCount: number
): ProblemAnnotation[] {
  const sorted = [...fadeableAnnotations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
  return sorted.slice(0, Math.min(hideCount, sorted.length))
}

// --- Convenience wrapper used by the API route ---
export async function getFadeStepForStudent(
  studentId: string,
  chapterId: string,
  fadeableAnnotations: ProblemAnnotation[]
): Promise<{ hidden: ProblemAnnotation[]; hideCount: number; currentLevel: number }> {
  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId } },
  })

  const currentLevel = scaffoldingLevel ? Number(scaffoldingLevel.currentLevel) : 0

  const hideCount = getHideCountForLevel(currentLevel)
  const hidden = selectAnnotationsToHide(fadeableAnnotations, hideCount)

  return { hidden, hideCount, currentLevel }
}