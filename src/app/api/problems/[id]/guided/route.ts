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
  options: StepOption[]
  // Formula card — always visible on the left panel regardless of attempt count
  formulaCard: string | null
  // 3-level progressive hints
  hintText: string | null       // contextual  — after ≥1 wrong
  hintText2: string | null      // procedural  — after ≥2 wrong
  hintText3: string | null      // bottom-out  — after ≥3 wrong
  hintWasRephrased: boolean
  errorFeedback: string | null  // only sent after a wrong attempt
  // Worked example — fading: concept steps send it immediately (before attempt);
  // other steps unlock after ≥3 wrong
  workedExample: {
    text: string
    svgStage: number
  } | null
  // Self-explain MCQ — shown after worked example is revealed
  selfExplain: {
    prompt: string
    answer: string
  } | null
  // Adaptive error type — helps frontend show targeted nudge
  errorType: 'formula' | 'substitution' | 'arithmetic' | null
  attemptCount: number
  totalSteps: number
  answeredSoFar: number
}

// ─── Adaptive error classification ───────────────────────────────────────────
// Classifies a wrong numeric answer into a likely error type so the frontend
// can surface a more targeted nudge without changing the hint text itself.

function classifyNumericError(
  studentAnswer: string,
  correctAnswer: string,
  stepType: string,
): 'formula' | 'substitution' | 'arithmetic' {
  const correct = parseFloat(correctAnswer)
  const student = parseFloat(studentAnswer)
  if (isNaN(student)) return 'formula'
  const ratio = student / correct
  // If ratio is close to 2, 0.5, 4, 0.25 — likely forgot to square r
  if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 2) < 0.1) return 'substitution'
  // If ratio is close to 1 (within 20%) — arithmetic slip
  if (Math.abs(ratio - 1) < 0.2) return 'arithmetic'
  // Large deviation — likely wrong formula or wrong operation
  return stepType === 'computation' ? 'arithmetic' : 'formula'
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
  let problemType: 'sector' | 'arc' | 'segment' | 'combination' | 'mirror' | 'lens' = 'segment'
  if (rawTextLC.includes('mirror') || (rawTextLC.includes('focal length') && !rawTextLC.includes('lens'))) {
    // Spherical mirror problems: mirror formula, magnification, focal length from R
    problemType = 'mirror'
  } else if (rawTextLC.includes('lens') || rawTextLC.includes('refract') || rawTextLC.includes('snell')) {
    // Refraction / lens problems: lens formula, snell's law, power of lens
    problemType = 'lens'
  } else if (rawTextLC.includes('arc') && rawTextLC.includes('length')) {
    problemType = 'arc'
  } else if (rawTextLC.includes('brooch') || (rawTextLC.includes('semicircle') && rawTextLC.includes('perimeter'))) {
    // Semicircle perimeter / brooch = arc length problem (arc + diameter)
    problemType = 'arc'
  } else if (rawTextLC.includes('area of a sector') || rawTextLC.includes('area of the sector') || rawTextLC.includes('horse')) {
    problemType = 'sector'
  } else if (
    rawTextLC.includes('square') ||
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

  // ── 3-level progressive hints ──────────────────────────────────────────────
  const hintText  = attemptCount >= 1 ? nextStep.hintText  : null
  const hintText2 = attemptCount >= 2 ? (nextStep.hintText2 ?? null) : null
  const hintText3 = attemptCount >= 3 ? (nextStep.hintText3 ?? null) : null

  // ── Worked example always available on demand — UI controls visibility
  const isConcept = nextStep.stepType === 'concept'
  const showWorkedExample = nextStep.workedExampleText != null

  // ── Self-explain only shown once worked example is visible ─────────────────
  const showSelfExplain = showWorkedExample && nextStep.selfExplainPrompt != null

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
      formulaCard: nextStep.formulaCard ?? null,
      hintText,
      hintText2,
      hintText3,
      hintWasRephrased: false,
      errorFeedback: null,
      workedExample:
        showWorkedExample
          ? {
              text: nextStep.workedExampleText!,
              svgStage: nextStep.workedExampleSvgStage ?? nextStep.svgStage,
            }
          : null,
      selfExplain:
        showSelfExplain
          ? {
              prompt: nextStep.selfExplainPrompt!,
              answer: nextStep.selfExplainAnswer!,
              followUp: nextStep.followUpPrompt
                ? {
                    prompt: nextStep.followUpPrompt,
                    answer: nextStep.followUpAnswer!,
                    inputType: nextStep.followUpInputType ?? 'numeric',
                    tolerance: nextStep.followUpTolerance ?? 0,
                  }
                : null,
            }
          : null,
      errorType: null,
      attemptCount,
    } satisfies GuidedStepResponse,
  })
}

// ─── POST /api/problems/[id]/guided ──────────────────────────────────────────
// Body: { sessionId, stepId, answer }

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

  // ── Wrong answer — build progressive feedback ──────────────────────────────
  const newWrongCount = priorWrong + 1

  // 3-level hints
  const hintText  = newWrongCount >= 1 ? step.hintText : null
  const hintText2 = newWrongCount >= 2 ? (step.hintText2 ?? null) : null
  const hintText3 = newWrongCount >= 3 ? (step.hintText3 ?? null) : null

  // Worked example after ≥3 wrong (concept steps already show it from GET)
  const showWorkedExample = newWrongCount >= 3 && step.workedExampleText != null
  const showSelfExplain = showWorkedExample && step.selfExplainPrompt != null

  // Adaptive error type classification for numeric steps
  const errorType =
    step.inputType === 'numeric'
      ? classifyNumericError(answer, step.correctAnswer, step.stepType)
      : null

  return NextResponse.json({
    isCorrect: false,
    errorFeedback: step.errorFeedback,
    errorType,
    hintText,
    hintText2,
    hintText3,
    workedExample:
      showWorkedExample
        ? {
            text: step.workedExampleText!,
            svgStage: step.workedExampleSvgStage ?? step.svgStage,
          }
        : null,
    selfExplain:
      showSelfExplain
        ? {
            prompt: step.selfExplainPrompt!,
            answer: step.selfExplainAnswer!,
          }
        : null,
    attemptCount: newWrongCount,
  })
}
