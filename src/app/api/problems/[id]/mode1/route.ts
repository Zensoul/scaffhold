import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'

// Mode 1: the full worked example. Every annotation is shown, in order,
// fully filled in — no fading, no hints withheld. This is the "show me
// how this works" entry point: for a brand-new chapter, and for the
// session-recovery flow after two consecutive misses, where the right
// move is a guided walkthrough before another independent attempt,
// not being dropped straight back into the same blind retry.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param is required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  try {
    await requireConsent(studentId)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { annotations: { orderBy: { sequenceOrder: 'asc' } }, diagram: { include: { stages: { orderBy: { stageIndex: 'asc' } } } } },
  })

  if (!problem || !problem.isActive) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  // The 'unknown' annotation is the final answer text -- Mode 1 is a
  // worked example that should teach the reasoning (givens, implied
  // givens, the concept), not hand the student the answer to
  // memorize/screenshot before they ever attempt it themselves in
  // Mode 2. Every other annotation type is sent in full; the unknown
  // annotation is sent with its text stripped, same shape as Mode 2's
  // hiddenAnnotation, so the student sees that a piece is there and
  // what kind it is, but has to actually solve it in Mode 2.
  const annotations = problem.annotations.map((a) =>
    a.annotationType === 'unknown' ? { ...a, annotationText: null } : a
  )

  return NextResponse.json({
    problem: {
      id: problem.id,
      rawText: problem.rawText,
      concreteRestatement: problem.concreteRestatement,
      problemType: problem.problemType,
      difficultyTier: problem.difficultyTier,
      givens: problem.givens,
    },
    annotations,
    chapterId: problem.chapterId,
    diagramUrl: problem.diagram?.status === 'approved' ? problem.diagram.videoUrl : null,
    diagramStages: problem.diagram?.status === 'approved' && problem.diagram.stages.length > 0
      ? problem.diagram.stages.map(s => ({ stageIndex: s.stageIndex, videoUrl: s.videoUrl, label: s.label }))
      : null,
  })
}
