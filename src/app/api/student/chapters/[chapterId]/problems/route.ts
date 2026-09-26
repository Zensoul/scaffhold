import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { selectNextProblem } from '@/lib/scaffolding/adaptive-sequencing'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const { chapterId } = await params
  const studentId = await getCurrentStudentId()

  // Fetch problems and interactions in parallel — then pass BOTH into
  // selectNextProblem so it doesn't re-fetch the same rows a second time.
  const [allProblems, interactions] = await Promise.all([
    prisma.problem.findMany({
      where: { chapterId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        rawText: true,
        concreteRestatement: true,
        problemType: true,
        difficultyTier: true,
        subtopic: { select: { name: true } },
        guidedSolve: { select: { id: true } },
      },
    }),
    prisma.sessionInteraction.findMany({
      where: { studentId, problem: { chapterId } },
      select: {
        problemId: true,
        isCorrect: true,
        problem: { select: { chapterId: true, problemType: true } },
        annotation: { select: { annotationType: true } },
      },
    }),
  ])

  // Re-use the already-fetched data — no extra DB queries inside selectNextProblem
  const nextProblem = await selectNextProblem(
    { studentId, chapterId },
    {
      problems: allProblems.map((p) => ({
        id: p.id,
        problemType: p.problemType,
        isActive: true,
      })),
      interactions,
    },
  )

  const attemptedIds = new Set(interactions.map((i) => i.problemId))
  const completedIds = new Set(
    interactions.filter((i) => i.isCorrect === true).map((i) => i.problemId)
  )

  const problems = allProblems.map((p, idx) => {
    const isCompleted = completedIds.has(p.id)
    const isAttempted = attemptedIds.has(p.id)
    const isNext = nextProblem?.problemId === p.id
    const isLocked = !isCompleted && !isNext && !isAttempted

    return {
      id: p.id,
      index: idx + 1,
      title: p.concreteRestatement || p.rawText.slice(0, 80),
      problemType: p.problemType,
      difficultyTier: p.difficultyTier,
      subtopic: p.subtopic?.name ?? null,
      hasGuidedSolve: !!p.guidedSolve,
      isCompleted,
      isAttempted,
      isNext,
      isLocked,
    }
  })

  return NextResponse.json({
    problems,
    nextProblemId: nextProblem?.problemId ?? null,
    nextReason: nextProblem?.reason ?? null,
  })
}
