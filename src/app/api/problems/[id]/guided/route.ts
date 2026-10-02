import { prisma } from '@/lib/db/prisma'
import { InteractionType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { requireConsent, ConsentError } from '@/lib/compliance/consent-gate'
import { checkRateLimit } from '@/lib/rate-limit'

// ─── Types returned to the client ────────────────────────────────────────────

type StepOption = {
  id: string
  optionText: string
  orderIndex: number
}

type GuidedStepResponse = {
  stepId: string
  sequenceOrder: number
  stepType: 'concept' | 'substitution' | 'computation'
  stepLabel: string
  prompt: string
  inputType: 'mcq' | 'numeric'
  svgStage: number
  options: StepOption[]       // empty array for numeric steps
  hintText: string | null     // only sent after ≥1 wrong attempt on this step
  hintWasRephrased: boolean
  errorFeedback: string | null // only sent after a wrong attempt
  workedExample: {
    text: string
    svgStage: number
  } | null                    // only sent after ≥3 wrong attempts
  attemptCount: number        // how many times this student has tried this step
  totalSteps: number
  answeredSoFar: number       // how many steps the student has completed correctly
}

// ─── GET /api/problems/[id]/guided?sessionId= ────────────────────────────────

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

  const rateLimit = checkRateLimit(`guided-get:${studentId}`, 120, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }

  try {
    await requireConsent(studentId)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  const guidedProblem = await prisma.guidedSolveProblem.findUnique({
    where: { problemId: id },
    include: {
      steps: {
        orderBy: { sequenceOrder: 'asc' },
        include: { options: { orderBy: { orderIndex: 'asc' } } },
      },
      problem: { select: { isActive: true, rawText: true, concreteRestatement: true, givens: true } },
    },
  })

  if (!guidedProblem || !guidedProblem.problem.isActive) {
    return NextResponse.json({ error: 'Guided problem not found' }, { status: 404 })
  }

  // Parse radius and angle from rawText for diagram rendering
  const rawTextLC = guidedProblem.problem.rawText.toLowerCase()
  const rMatch = rawTextLC.match(/radius[^0-9]*([0-9]+(?:\.5)?)/)
  const thetaMatch = rawTextLC.match(/angle[^0-9]*([0-9]+)/)

  // Determine problem type for diagram selection
  let problemType: 'sector' | 'arc' | 'segment' | 'combination' = 'segment'
  if (rawTextLC.includes('arc') && rawTextLC.includes('length')) {
    problemType = 'arc'
  } else if (rawTextLC.includes('area of a sector') || rawTextLC.includes('area of the sector')) {
    problemType = 'sector'
  } else if (
    rawTextLC.includes('square') ||
    rawTextLC.includes('horse') ||
    rawTextLC.includes('brooch') ||
    rawTextLC.includes('semicircle') ||
    rawTextLC.includes('inscribed')
  ) {
    problemType = 'combination'
  } else if (rawTextLC.includes('segment') || rawTextLC.includes('chord')) {
    problemType = 'segment'
  }

  const diagramConfig = {
    r: rMatch ? Number(rMatch[1]) : 15,
    theta: thetaMatch ? Number(thetaMatch[1]) : 90,
    isMajorSegment: rawTextLC.includes('major'),
    problemType,
  }

  const problemInfo = {
    rawText: guidedProblem.problem.rawText,
    concreteRestatement: guidedProblem.problem.concreteRestatement,
    diagramConfig,
  }

  const totalSteps = guidedProblem.steps.length

  // Find which steps the student has already answered correctly in this session
  const correctStepIds = new Set(
    (
      await prisma.solveAttempt.findMany({
        where: {
          sessionId,
          studentId,
          isCorrect: true,
          stepId: { in: guidedProblem.steps.map((s) => s.id) },
        },
        select: { stepId: true },
      })
    ).map((a) => a.stepId)
  )

  const answeredSoFar = correctStepIds.size

  // If all steps are done, return completed state
  if (answeredSoFar >= totalSteps) {
    // Ensure a sessionInteraction record exists so selectNextProblem skips this problem
    const existing = await prisma.sessionInteraction.findFirst({
      where: { studentId, sessionId, problemId: id, interactionType: InteractionType.problem_completed },
    })
    if (!existing) {
      await prisma.sessionInteraction.create({
        data: {
          sessionId,
          studentId,
          problemId: id,
          interactionType: InteractionType.problem_completed,
          isCorrect: true,
          scaffoldingLevelAt: 0.5,
        },
      })
    }
    return NextResponse.json({
      problemComplete: true,
      totalSteps,
      answeredSoFar,
      problem: problemInfo,
    })
  }

  // Find the next incomplete step
  const nextStep = guidedProblem.steps.find((s) => !correctStepIds.has(s.id))!

  // Count prior wrong attempts on this step
  const attemptCount = await prisma.solveAttempt.count({
    where: { studentId, stepId: nextStep.id, isCorrect: false },
  })

  const showHint = attemptCount >= 1
  const showWorkedExample =
    attemptCount >= 3 && nextStep.workedExampleText != null

  return NextResponse.json({
    problemComplete: false,
    totalSteps,
    answeredSoFar,
    problem: problemInfo,
    step: {
      stepId: nextStep.id,
      sequenceOrder: nextStep.sequenceOrder,
      stepType: nextStep.stepType,
      stepLabel: nextStep.stepLabel,
      prompt: nextStep.prompt,
      inputType: nextStep.inputType,
      svgStage: nextStep.svgStage,
      options: nextStep.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        orderIndex: o.orderIndex,
      })),
      hintText: showHint ? nextStep.hintText : null,
      hintWasRephrased: false,
      errorFeedback: null,   // only included in POST response after a wrong answer
      workedExample:
        showWorkedExample
          ? {
              text: nextStep.workedExampleText!,
              svgStage: nextStep.workedExampleSvgStage ?? nextStep.svgStage,
            }
          : null,
      attemptCount,
    } satisfies GuidedStepResponse,
  })
}

// ─── POST /api/problems/[id]/guided ──────────────────────────────────────────
// Body: { sessionId, stepId, answer }
//   answer is either an MCQ option text (string) or a numeric string

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const studentId = await getCurrentStudentId()

  const rateLimit = checkRateLimit(`guided-post:${studentId}`, 120, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }

  try {
    await requireConsent(studentId)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  let body: { sessionId: string; stepId: string; answer: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sessionId, stepId, answer } = body
  if (!sessionId || !stepId || answer === undefined || answer === '') {
    return NextResponse.json({ error: 'sessionId, stepId and answer are required' }, { status: 400 })
  }

  const step = await prisma.solveStep.findUnique({
    where: { id: stepId },
    include: { guidedSolveProblem: { select: { problemId: true } } },
  })

  if (!step || step.guidedSolveProblem.problemId !== id) {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 })
  }

  // Guard: don't re-accept a step that's already been answered correctly
  const alreadyCorrect = await prisma.solveAttempt.findFirst({
    where: { studentId, stepId, sessionId, isCorrect: true },
  })
  if (alreadyCorrect) {
    return NextResponse.json({ error: 'Step already answered correctly' }, { status: 409 })
  }

  // Grade the answer
  let isCorrect: boolean
  if (step.inputType === 'numeric') {
    const studentNum = parseFloat(answer.trim())
    const correctNum = parseFloat(step.correctAnswer)
    const tol = step.tolerance ?? 0.01
    isCorrect = !isNaN(studentNum) && Math.abs(studentNum - correctNum) <= tol
  } else {
    // MCQ — case-insensitive exact match on text
    isCorrect = answer.trim().toLowerCase() === step.correctAnswer.trim().toLowerCase()
  }

  // Count prior wrong attempts (before recording this one)
  const priorWrong = await prisma.solveAttempt.count({
    where: { studentId, stepId, isCorrect: false },
  })

  const attemptNumber = priorWrong + 1

  // Record the attempt
  await prisma.solveAttempt.create({
    data: {
      stepId,
      studentId,
      sessionId,
      studentAnswer: answer,
      isCorrect,
      attemptNumber,
    },
  })

  if (isCorrect) {
    // Check if all steps are now complete — if so, record a sessionInteraction
    // so selectNextProblem knows this problem has been attempted.
    const guidedProblem = await prisma.guidedSolveProblem.findUnique({
      where: { problemId: id },
      include: { steps: { select: { id: true } } },
    })
    if (guidedProblem) {
      const allStepIds = guidedProblem.steps.map((s) => s.id)
      const correctCount = await prisma.solveAttempt.count({
        where: { studentId, sessionId, isCorrect: true, stepId: { in: allStepIds } },
      })
      if (correctCount >= allStepIds.length) {
        // All steps done — mark this problem as completed in sessionInteraction
        const existing = await prisma.sessionInteraction.findFirst({
          where: { studentId, sessionId, problemId: id, interactionType: InteractionType.problem_completed },
        })
        if (!existing) {
          await prisma.sessionInteraction.create({
            data: {
              sessionId,
              studentId,
              problemId: id,
              interactionType: InteractionType.problem_completed,
              isCorrect: true,
              scaffoldingLevelAt: 0.5,
            },
          })
        }
      }
    }
    return NextResponse.json({ isCorrect: true })
  }

  // Wrong answer — build feedback
  const newWrongCount = priorWrong + 1
  const showHint = newWrongCount >= 1
  const showWorkedExample = newWrongCount >= 3 && step.workedExampleText != null

  return NextResponse.json({
    isCorrect: false,
    errorFeedback: step.errorFeedback,
    hintText: showHint ? step.hintText : null,
    workedExample:
      showWorkedExample
        ? {
            text: step.workedExampleText!,
            svgStage: step.workedExampleSvgStage ?? step.svgStage,
          }
        : null,
    attemptCount: newWrongCount,
  })
}
