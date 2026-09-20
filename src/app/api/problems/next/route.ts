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

  return NextResponse.json({
    nextUrl: `/problems/${result.problemId}/start?sessionId=${sessionId}`,
    reason: result.reason,
  })
}