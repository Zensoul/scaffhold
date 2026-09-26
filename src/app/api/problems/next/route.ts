import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { selectNextProblem } from '@/lib/scaffolding/adaptive-sequencing'


export async function GET(request: NextRequest) {
  const chapterId = request.nextUrl.searchParams.get('chapterId')
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!chapterId || !sessionId) {
    return NextResponse.json({ error: 'chapterId and sessionId are required' }, { status: 400 })
  }

  const studentId = await getCurrentStudentId()

  const result = await selectNextProblem({ studentId, chapterId })

  if (!result) {
    return NextResponse.json({ error: 'No problems available in this chapter' }, { status: 422 })
  }

  // A student has genuinely new content only when the reason is
  // 'unattempted_problem_available' or 'no_prior_data' -- every other
  // reason means selectNextProblem is intentionally repeating a
  // problem the student already finished (for practice on a weak
  // area), because nothing new is left in this chapter yet. The
  // frontend uses isRepeat to route back to the dashboard honestly
  // instead of looping the student back into a problem they just
  // completed under a 'Continue' button that implies fresh content.
  const isRepeat = !['unattempted_problem_available', 'no_prior_data'].includes(result.reason)

  return NextResponse.json({
    nextUrl: `/problems/${result.problemId}/start?sessionId=${sessionId}`,
    reason: result.reason,
    isRepeat,
  })
}