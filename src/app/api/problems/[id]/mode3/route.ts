import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { checkSessionGuard } from '@/lib/session/session-guard'
import { generateSessionEndStatement } from '@/lib/ai/session-end-statement'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'


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

  const problem = await prisma.problem.findUnique({ where: { id } })
  if (!problem || !problem.isActive) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  const guard = await checkSessionGuard(sessionId, studentId, problem.chapterId)

  if (guard.shouldEnd) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } })

    if (session && !session.endedAt) {
      const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
        where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
      })

      const statement = await generateSessionEndStatement({
        studentId,
        sessionId,
        reason: guard.reason,
        problemsAttempted: session.problemsAttempted,
        problemsClean: scaffoldingLevel?.problemsClean ?? 0,
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          endReason: guard.reason,
          scaffoldingLevelEnd: scaffoldingLevel?.currentLevel,
          sessionEndStatement: statement,
          aiModelUsed: 'gpt-4o-mini',
        },
      })

      return NextResponse.json({
        sessionEnded: true,
        reason: guard.reason,
        statement,
        chapterId: problem.chapterId,
      })
    }

    return NextResponse.json({
      sessionEnded: true,
      reason: session?.endReason ?? guard.reason,
      statement: session?.sessionEndStatement ?? null,
      chapterId: problem.chapterId,
    })
  }

  // Which of the two Mode 3 prompts is next, for THIS problem, THIS
  // session — restate_unknown first, then list_givens. Checked via
  // whether a correct interaction of that promptType already exists
  // for this problem in this session (not globally — Mode 3 asks fresh
  // each time a problem is attempted this way, unlike Mode 2's
  // cross-session per-annotation history).
  const priorCorrect = await prisma.sessionInteraction.findMany({
    where: {
      sessionId,
      problemId: problem.id,
      isCorrect: true,
      mode3PromptType: { not: null },
    },
    select: { mode3PromptType: true },
  })

  const completedTypes = new Set(priorCorrect.map((i) => i.mode3PromptType))

  if (completedTypes.has('restate_unknown') && completedTypes.has('list_givens')) {
    return NextResponse.json({
      sessionEnded: false,
      problemComplete: true,
      problem: { id: problem.id, rawText: problem.rawText },
    })
  }

  const nextPromptType: 'restate_unknown' | 'list_givens' = completedTypes.has('restate_unknown')
    ? 'list_givens'
    : 'restate_unknown'

  const promptText =
    nextPromptType === 'restate_unknown'
      ? 'In your own words, what is this problem asking you to find?'
      : 'In your own words, what information does the problem give you to work with?'

  return NextResponse.json({
    sessionEnded: false,
    problemComplete: false,
    problem: {
      id: problem.id,
      // Raw text ONLY — no restatement, no annotations, no hints.
      // Mode 3 measures unaided understanding; showing anything else
      // would make the measurement meaningless.
      rawText: problem.rawText,
    },
    promptType: nextPromptType,
    promptText,
  })
}