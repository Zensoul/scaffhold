import { prisma } from '@/lib/db/prisma'
import { redirect, notFound } from 'next/navigation'
import { getCurrentStudentId } from '@/lib/session/auth-stub'

const MODE_3_THRESHOLD = 0.8

// Central routing decision for "what should this student see next":
// - Problem has a GuidedSolveProblem record → always use Guided Solve.
// - No scaffolding history yet on this chapter → Mode 1 (worked example).
//   A student's very first problem in a chapter shouldn't be a blind
//   fade or an independent attempt; show them how it's done first.
// - Otherwise, existing logic: Mode 3 once currentLevel clears the
//   threshold, Mode 2 below it.
//
// This is also the target of the session-recovery flow (see mode2/mode3
// pages): after two consecutive misses, the recovery button sends the
// student back here rather than directly reloading the same mode, so
// the guided-walkthrough decision lives in one place, not duplicated
// across every mode page.
export default async function ProblemRouterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sessionId?: string; showExample?: string }>
}) {
  const { id } = await params
  const { sessionId, showExample } = await searchParams

  if (!sessionId) {
    notFound()
  }

  const studentId = await getCurrentStudentId()

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { guidedSolve: { select: { id: true } } },
  })
  if (!problem) {
    notFound()
  }

  // If this problem has a guided-solve sequence, always use it
  if (problem.guidedSolve) {
    redirect(`/problems/${id}/guided?sessionId=${sessionId}`)
  }

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
  })

  // Explicit request for the worked example — from session recovery
  // after consecutive misses, or later, a student-initiated "show me
  // an example" affordance.
  if (showExample === 'true') {
    redirect(`/problems/${id}/mode1?sessionId=${sessionId}`)
  }

  const isBrandNewChapter = !scaffoldingLevel || scaffoldingLevel.problemsAttempted === 0

  if (isBrandNewChapter) {
    redirect(`/problems/${id}/mode1?sessionId=${sessionId}`)
  }

  const currentLevel = scaffoldingLevel ? Number(scaffoldingLevel.currentLevel) : 0
  const targetMode = currentLevel > MODE_3_THRESHOLD ? 'mode3' : 'mode2'

  redirect(`/problems/${id}/${targetMode}?sessionId=${sessionId}`)
}
