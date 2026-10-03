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
      problem: {
        select: {
          isActive: true,
          rawText: true,
          concreteRestatement: true,
          problemType: true,
          givens: true,
          impliedGivens: true,
          unknownAnnotation: true,
        },
      },
    },
  })

  if (!guidedProblem || !guidedProblem.problem.isActive) {
    return NextResponse.json({ error: 'Guided problem not found' }, { status: 404 })
  }

  const rawTextLC = guidedProblem.problem.rawText.toLowerCase()
  const storedProblemType = guidedProblem.problem.problemType.toLowerCase()
  const number = (pattern: RegExp) => {
    const match = rawTextLC.match(pattern)
    return match ? Number(match[1]) : undefined
  }
  const radiusFromText = number(/radius[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const diameter = number(/diameter[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const theta = number(/angle[^0-9]*([0-9]+)/) ?? 90
  const side = number(/side(?: length)?[^0-9]*([0-9]+(?:\.[0-9]+)?)/)

  type GuidedDiagramType =
    | 'sector' | 'arc' | 'segment' | 'combination' | 'circle-in-square'
    | 'circles-in-square' | 'grazing-quarter' | 'semicircle' | 'semicircles-in-square'
    | 'mirror' | 'lens' | 'refraction' | 'cylinder-hemispheres' | 'hemisphere-cone'
    | 'cube-hemisphere' | 'cylinder-base-hemisphere' | 'frustum' | 'frustum-cylinder'
    | 'sphere-cylinder' | 'well-embankment' | 'none'
  let problemType: GuidedDiagramType = 'none'

  // Check the composite and optical cases first so generic words such as
  // “circle”, “square”, and “lens” cannot select an unrelated picture.
  if (rawTextLC.includes('cylinder') && rawTextLC.includes('hemispher') && /end|capsule|gulab jamun/.test(rawTextLC)) {
    problemType = 'cylinder-hemispheres'
  } else if (rawTextLC.includes('frustum') && rawTextLC.includes('cylinder')) {
    problemType = 'frustum-cylinder'
  } else if (rawTextLC.includes('frustum')) {
    problemType = 'frustum'
  } else if (rawTextLC.includes('well') && rawTextLC.includes('embankment')) {
    problemType = 'well-embankment'
  } else if (rawTextLC.includes('sphere') && rawTextLC.includes('recast') && rawTextLC.includes('cylinder')) {
    problemType = 'sphere-cylinder'
  } else if (rawTextLC.includes('cube') && rawTextLC.includes('hemisphere')) {
    problemType = 'cube-hemisphere'
  } else if (rawTextLC.includes('cone') && rawTextLC.includes('hemisphere')) {
    problemType = 'hemisphere-cone'
  } else if (rawTextLC.includes('cylinder') && rawTextLC.includes('hemispherical base')) {
    problemType = 'cylinder-base-hemisphere'
  } else if (rawTextLC.includes('four circles') && rawTextLC.includes('square')) {
    problemType = 'circles-in-square'
  } else if (rawTextLC.includes('horse') && rawTextLC.includes('rope') && rawTextLC.includes('square field')) {
    problemType = 'grazing-quarter'
  } else if (rawTextLC.includes('semicircles') && rawTextLC.includes('square')) {
    problemType = 'semicircles-in-square'
  } else if (rawTextLC.includes('semicircle') || rawTextLC.includes('brooch')) {
    problemType = 'semicircle'
  } else if (rawTextLC.includes('square inscribed') && rawTextLC.includes('circle')) {
    problemType = 'combination'
  } else if (rawTextLC.includes('circle') && rawTextLC.includes('square') && /circle[^.]*inscribed (?:inside|in)/.test(rawTextLC)) {
    problemType = 'circle-in-square'
  } else if (
    rawTextLC.includes('ray of light') || rawTextLC.includes('refractive') ||
    rawTextLC.includes('refraction') || rawTextLC.includes('critical angle') ||
    rawTextLC.includes('speed of light')
  ) {
    problemType = 'refraction'
  } else if (storedProblemType.includes('mirror') || rawTextLC.includes('mirror')) {
    problemType = 'mirror'
  } else if (rawTextLC.includes('lens')) {
    problemType = 'lens'
  } else if (rawTextLC.includes('arc') && rawTextLC.includes('length')) {
    problemType = 'arc'
  } else if (rawTextLC.includes('sector')) {
    problemType = 'sector'
  } else if (rawTextLC.includes('segment') || rawTextLC.includes('chord')) {
    problemType = 'segment'
  }

  const parsedRadius = radiusFromText ?? (diameter !== undefined ? diameter / 2 :
    problemType === 'grazing-quarter' ? number(/rope[^0-9]*([0-9]+(?:\.[0-9]+)?)/) ?? 15 :
    problemType === 'circle-in-square' && side ? side / 2 : 15)
  const lengthValues = [...rawTextLC.matchAll(/(?:length|height)[^0-9]*([0-9]+(?:\.[0-9]+)?)/g)].map((m) => Number(m[1]))
  const capsuleLength = number(/length[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const radiiMatch = rawTextLC.match(/radii[^0-9]*([0-9]+(?:\.[0-9]+)?)[^0-9]+([0-9]+(?:\.[0-9]+)?)/)
  const focalLength = number(/focal length[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const objectDistance = number(/object(?: distance| is placed| is)?[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const imageDistance = number(/image(?: distance| is formed| formed| at)?[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const coneHeight = number(/height of the cone[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const totalHeight = number(/total height[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const incidence = number(/angle of incidence[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const refraction = number(/angle of refraction[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const hemisphereDiameter = number(/hemisphere[^.]*diameter[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
  const radiusValues = [...rawTextLC.matchAll(/radius[^0-9]*([0-9]+(?:\.[0-9]+)?)/g)].map((m) => Number(m[1]))
  let diagramHeight: number | undefined
  if (problemType === 'cylinder-hemispheres' && capsuleLength !== undefined) diagramHeight = capsuleLength - 2 * parsedRadius
  if (problemType === 'hemisphere-cone') diagramHeight = coneHeight ?? (rawTextLC.includes('equal to its radius') ? parsedRadius : totalHeight ? totalHeight - parsedRadius : undefined)
  if (problemType === 'cube-hemisphere') diagramHeight = side
  if (problemType === 'frustum' || problemType === 'frustum-cylinder') diagramHeight = lengthValues[0]
  if (problemType === 'well-embankment') diagramHeight = number(/([0-9]+(?:\.[0-9]+)?) m deep/)

  const diagramConfig = {
    r: parsedRadius,
    r2: radiiMatch ? Number(radiiMatch[2]) : undefined,
    side,
    h: diagramHeight,
    f: focalLength,
    u: objectDistance,
    v: imageDistance,
    isConvex: rawTextLC.includes('convex'),
    angleOfIncidence: incidence,
    angleOfRefraction: refraction,
    criticalAngle: rawTextLC.includes('critical angle'),
    theta,
    isMajorSegment: rawTextLC.includes('major'),
    problemType,
    // Retain both radii so frustum sketches can match the stated top/bottom ratio.
    topRadius: radiiMatch ? Number(radiiMatch[1]) : radiusValues[0],
    bottomRadius: radiiMatch ? Number(radiiMatch[2]) : radiusValues[1],
    hemisphereRadius: hemisphereDiameter ? hemisphereDiameter / 2 : undefined,
    cylinderRadius: radiusValues[1],
  }

  const problemInfo = {
    rawText: guidedProblem.problem.rawText,
    concreteRestatement: guidedProblem.problem.concreteRestatement,
    givens: guidedProblem.problem.givens,
    impliedGivens: guidedProblem.problem.impliedGivens,
    unknownAnnotation: guidedProblem.problem.unknownAnnotation,
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
      totalSteps,
      answeredSoFar,
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
    include: {
      guidedSolveProblem: { select: { problemId: true } },
      options: true,
    },
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
    // Use the option's canonical correctness flag. Some imported/seeded MCQs
    // store a letter such as "B" in correctAnswer, while the client submits
    // the selected option text and may display options in a shuffled order.
    const selectedOption = step.options.find(
      (option) => option.optionText.trim().toLowerCase() === answer.trim().toLowerCase()
    )
    isCorrect = selectedOption
      ? selectedOption.isCorrect
      : answer.trim().toLowerCase() === step.correctAnswer.trim().toLowerCase()
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
