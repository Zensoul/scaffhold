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
  hintText: string           // available on request before the first attempt
  hintWasRephrased: boolean
  errorFeedback: string | null // only sent after a wrong attempt
  workedExample: {
    text: string
    svgStage: number
  } | null                    // available on request when a safe example is present
  attemptCount: number        // how many times this student has tried this step
  totalSteps: number
  answeredSoFar: number       // how many steps the student has completed correctly
  hintText2: string
  hintText3: string
  formulaCard: string | null
  unit: string | null
  conceptVideoUrl: string | null
  socraticPrompt: string | null
}

type HintSafetyStep = {
  sequenceOrder?: number
  prompt?: string
  inputType: 'mcq' | 'numeric'
  correctAnswer: string
  tolerance: number | null
  stepType: 'concept' | 'substitution' | 'computation'
  options: { optionText: string; isCorrect: boolean }[]
  hintText?: string | null
  hintText2?: string | null
  hintText3?: string | null
}

function compactText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function revealsCorrectAnswer(text: string | null | undefined, step: HintSafetyStep): boolean {
  if (!text?.trim()) return false

  if (step.inputType === 'mcq') {
    const correctOption = step.options.find((option) => option.isCorrect)?.optionText
    const answer = correctOption ?? step.correctAnswer
    const compactAnswer = compactText(answer)
    return compactAnswer.length >= 2 && compactText(text).includes(compactAnswer)
  }

  const expected = Number(step.correctAnswer.trim().replace(/,/g, ''))
  if (!Number.isFinite(expected)) {
    const compactAnswer = compactText(step.correctAnswer)
    return compactAnswer.length >= 3 && compactText(text).includes(compactAnswer)
  }

  const values = text.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const tolerance = Math.max(step.tolerance ?? 0.01, 0.0001)
  return values.some((value) => Math.abs(value - expected) <= tolerance)
}

function revealsLaterAnswer(
  text: string | null | undefined,
  currentStep: HintSafetyStep & { sequenceOrder?: number },
  allSteps: HintSafetyStep[] = [],
  problemText = '',
): boolean {
  if (!text?.trim()) return false

  const normalizedText = compactText(text)
  const knownProblemValues = problemText.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const numericTokens = text.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number) ?? []

  return allSteps.some((candidate) => {
    if (
      currentStep.sequenceOrder == null ||
      candidate.sequenceOrder == null ||
      candidate.sequenceOrder <= currentStep.sequenceOrder
    ) return false

    if (candidate.inputType === 'mcq') {
      const answer = candidate.options.find((option) => option.isCorrect)?.optionText
      const normalizedAnswer = answer ? compactText(answer) : ''
      return normalizedAnswer.length >= 6 && normalizedText.includes(normalizedAnswer)
    }

    const expected = Number(candidate.correctAnswer.trim().replace(/,/g, ''))
    if (!Number.isFinite(expected)) {
      const normalizedAnswer = compactText(candidate.correctAnswer)
      return normalizedAnswer.length >= 4 && normalizedText.includes(normalizedAnswer)
    }

    // A number already stated in the original question is a given, not a spoiler.
    const tolerance = Math.max(candidate.tolerance ?? 0.01, 0.0001)
    if (knownProblemValues.some((value) => Math.abs(value - expected) <= tolerance)) {
      return false
    }

    return numericTokens.some((value) => Math.abs(value - expected) <= tolerance)
  })
}

function revealsAnyStepAnswer(
  text: string | null | undefined,
  step: HintSafetyStep & { sequenceOrder?: number },
  steps: HintSafetyStep[],
  problemText: string,
): boolean {
  return revealsCorrectAnswer(text, step) || revealsLaterAnswer(text, step, steps, problemText)
}

function fallbackHint(step: HintSafetyStep, level: 1 | 2 | 3, problemText: string): string {
  const context = `${problemText} ${step.prompt ?? ''}`.toLowerCase()
  const has = (pattern: RegExp) => pattern.test(context)

  if (step.stepType === 'concept') {
    if (level === 1) return 'First name exactly what the question asks you to find. Is it a length, an area, a volume, or a relationship?'
    if (has(/segment|sector|arc/)) {
      return level === 2
        ? 'For a circular part, decide whether the question asks about the curved boundary or the region inside it. Those use different measurements.'
        : 'Check each choice against the requested quantity: boundary length and enclosed area are different, even when they use the same circle.'
    }
    if (has(/exposed|outer surface|total surface|fixed on|mounted on|joined|stuck to/)) {
      return level === 2
        ? 'For a joined solid, separate the parts and consider which faces are on the outside and which are hidden at the join.'
        : 'Check that the method counts every outside face once and leaves out any shared face inside the solid.'
    }
    if (has(/not covered|uncovered|remaining|left after|between the/)) {
      return level === 2
        ? 'Sketch the whole region and the part that is removed or covered. Keep those two areas distinct.'
        : 'Check that your choice finds the requested leftover region and uses the full region and removed region in the right relationship.'
    }
    return level === 2
      ? 'Identify the shape or relationship described, then think about what information a method for the requested quantity needs.'
      : 'Compare each method with the goal and the units. Rule out choices that calculate a different quantity or use the wrong kind of measurement.'
  }

  if (step.stepType === 'substitution') {
    if (level === 1) return 'Match each letter or named quantity in the setup with the corresponding value given in the question.'
    if (level === 2) {
      return has(/diameter/)
        ? 'Check whether the formula needs a radius or a diameter. Convert the given measurement only if the symbol requires it.'
        : 'Keep each value attached to its symbol, including its sign and unit, as you place it into the setup.'
    }
    return 'Before evaluating, compare the substituted expression with the original setup: check signs, powers, brackets, and which quantity each value represents.'
  }

  if (level === 1) return 'Read the expression from the inside out. Identify the first power, bracket, or fraction to simplify.'
  if (level === 2) return 'Work one operation at a time. Simplify exact fractions and powers before combining terms, and avoid rounding early.'
  return 'Estimate the size of the result before accepting it. Then check the sign, decimal place, and requested unit against the original question.'
}

function getSafeHints(
  step: HintSafetyStep & { sequenceOrder?: number },
  steps: HintSafetyStep[],
  problemText: string,
): [string, string, string] {
  const stored = [
    (step as HintSafetyStep & { hintText?: string | null }).hintText,
    (step as HintSafetyStep & { hintText2?: string | null }).hintText2,
    (step as HintSafetyStep & { hintText3?: string | null }).hintText3,
  ]

  return [1, 2, 3].map((level) => {
    const text = stored[level - 1]?.trim()
    return text && !revealsAnyStepAnswer(text, step, steps, problemText)
      ? text
      : fallbackHint(step, level as 1 | 2 | 3, problemText)
  }) as [string, string, string]
}

function getSafeFormulaCard(
  step: HintSafetyStep & { id: string; sequenceOrder: number; formulaCard: string | null },
  steps: (HintSafetyStep & { id: string; sequenceOrder: number; formulaCard: string | null })[],
  completedStepIds: Set<string>,
  problemText: string,
): string | null {
  // A formula-choice prompt must not display its own correct answer as a reference.
  if (step.stepType === 'concept') return null

  if (step.formulaCard && !revealsAnyStepAnswer(step.formulaCard, step, steps, problemText)) {
    return step.formulaCard
  }

  const earlierSteps = steps
    .filter((candidate) => candidate.sequenceOrder < step.sequenceOrder && completedStepIds.has(candidate.id))
    .sort((a, b) => b.sequenceOrder - a.sequenceOrder)

  for (const earlier of earlierSteps) {
    if (earlier.stepType === 'concept') {
      const chosenFormula = earlier.options.find((option) => option.isCorrect)?.optionText
      if (chosenFormula && !revealsAnyStepAnswer(chosenFormula, step, steps, problemText)) return chosenFormula
    }
    if (earlier.formulaCard && !revealsAnyStepAnswer(earlier.formulaCard, step, steps, problemText)) {
      return earlier.formulaCard
    }
  }

  return null
}

function inferUnit(step: { unit: string | null; prompt: string }, problemText: string): string | null {
  if (step.unit?.trim()) return step.unit.trim()

  const text = `${step.prompt} ${problemText}`
  const rate = text.match(/\b(?:km\/h|m\/s|cm\/s)\b/i)?.[0]
  if (rate) return rate.toLowerCase()

  const match = text.match(/\b(km|cm|mm|m|in|ft)\s*(²|³|\^2|\^3)?/i)
  if (!match) return null

  const base = match[1].toLowerCase()
  const explicitPower = match[2]?.replace('^', '')
  if (explicitPower) return `${base}${explicitPower}`

  const target = step.prompt.toLowerCase()
  if (/\b(volume|capacity)\b/.test(target)) return `${base}³`
  if (/\b(area|surface area|segment area|sector area)\b/.test(target)) return `${base}²`
  return base
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

  const [guidedProblem, attemptGroups] = await Promise.all([
    prisma.guidedSolveProblem.findUnique({
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
    }),
    // Read both correct and incorrect counts in one small aggregate query.
    // This replaces separate findMany + count round trips on every step load.
    prisma.solveAttempt.groupBy({
      by: ['stepId', 'isCorrect', 'sessionId'],
      where: {
        studentId,
        step: { guidedSolveProblem: { problemId: id } },
      },
      _count: { _all: true },
    }),
  ])

  if (!guidedProblem || !guidedProblem.problem.isActive) {
    return NextResponse.json({ error: 'Guided problem not found' }, { status: 404 })
  }

  const rawTextLC = guidedProblem.problem.rawText.toLowerCase()
  const storedProblemType = guidedProblem.problem.problemType.toLowerCase()
  const number = (pattern: RegExp) => {
    const match = rawTextLC.match(pattern)
    return match ? Number(match[1]) : undefined
  }
  // Handle both singular "radius" and plural "radii" (for example,
  // "both their radii being equal to 1 cm").
  const radiusFromText = number(/radi(?:us|i)[^0-9]*([0-9]+(?:\.[0-9]+)?)/)
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

  // An empty flow is a content gap, not a completed problem. Do not silently
  // mark it complete; surface a recoverable response so the page can explain it.
  if (totalSteps === 0) {
    return NextResponse.json(
      { error: 'Guided steps are not available for this problem yet.' },
      { status: 409 },
    )
  }

  // Find which steps the student has already answered correctly in this session
  const attemptCounts = new Map<string, { correct: number; wrong: number }>()
  for (const group of attemptGroups) {
    const counts = attemptCounts.get(group.stepId) ?? { correct: 0, wrong: 0 }
    if (group.isCorrect && group.sessionId === sessionId) counts.correct += group._count._all
    else if (!group.isCorrect) counts.wrong += group._count._all
    attemptCounts.set(group.stepId, counts)
  }
  const correctStepIds = new Set(
    [...attemptCounts].filter(([, counts]) => counts.correct > 0).map(([stepId]) => stepId)
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
  const attemptCount = attemptCounts.get(nextStep.id)?.wrong ?? 0

  const isFinalNumericStep =
    nextStep.inputType === 'numeric' &&
    nextStep.sequenceOrder === totalSteps
  const hints = getSafeHints(nextStep, guidedProblem.steps, guidedProblem.problem.rawText)
  const formulaCard = getSafeFormulaCard(
    nextStep,
    guidedProblem.steps,
    correctStepIds,
    guidedProblem.problem.rawText,
  )
  const unit = inferUnit(nextStep, guidedProblem.problem.rawText)
  const safeExample = nextStep.workedExampleText && !revealsAnyStepAnswer(
    nextStep.workedExampleText,
    nextStep,
    guidedProblem.steps,
    guidedProblem.problem.rawText,
  )
    ? nextStep.workedExampleText
    : null
  const showWorkedExample = !isFinalNumericStep && safeExample !== null

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
      hintText: hints[0],
      hintText2: hints[1],
      hintText3: hints[2],
      formulaCard,
      unit,
      conceptVideoUrl: nextStep.conceptVideoUrl,
      socraticPrompt: revealsAnyStepAnswer(
        nextStep.socraticPrompt,
        nextStep,
        guidedProblem.steps,
        guidedProblem.problem.rawText,
      ) ? null : nextStep.socraticPrompt,
      hintWasRephrased: false,
      errorFeedback: null,   // only included in POST response after a wrong answer
      workedExample:
        showWorkedExample
          ? {
              text: safeExample!,
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

  // These reads don't depend on each other; run them together to avoid
  // stacking database network round trips before recording the answer.
  const [step, alreadyCorrect, priorWrong] = await Promise.all([
    prisma.solveStep.findUnique({
      where: { id: stepId },
      include: {
        guidedSolveProblem: {
          select: {
            problemId: true,
            problem: { select: { rawText: true } },
            _count: { select: { steps: true } },
            steps: {
              orderBy: { sequenceOrder: 'asc' },
              include: { options: true },
            },
          },
        },
        options: true,
      },
    }),
    prisma.solveAttempt.findFirst({
      where: { studentId, stepId, sessionId, isCorrect: true },
      select: { id: true },
    }),
    prisma.solveAttempt.count({
      where: { studentId, stepId, isCorrect: false },
    }),
  ])

  if (!step || step.guidedSolveProblem.problemId !== id) {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 })
  }

  // Guard: don't re-accept a step that's already been answered correctly
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

  // Only the final guided step can complete the problem. Avoid three
  // completion-check queries after every earlier correct answer.
  if (isCorrect) {
    if (step.sequenceOrder === step.guidedSolveProblem._count.steps) {
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
    }
    return NextResponse.json({ isCorrect: true })
  }

  // Wrong answer — build feedback
  const newWrongCount = priorWrong + 1
  const isFinalNumericStep =
    step.inputType === 'numeric' &&
    step.sequenceOrder === step.guidedSolveProblem._count.steps
  const allSteps = step.guidedSolveProblem.steps
  const problemText = step.guidedSolveProblem.problem.rawText
  const hints = getSafeHints(step, allSteps, problemText)
  const safeExample = step.workedExampleText && !revealsAnyStepAnswer(
    step.workedExampleText,
    step,
    allSteps,
    problemText,
  )
    ? step.workedExampleText
    : null
  const showWorkedExample = !isFinalNumericStep && safeExample !== null

  return NextResponse.json({
    isCorrect: false,
    errorFeedback: isFinalNumericStep
      ? 'The earlier steps are complete. Check the arithmetic in this final expression one operation at a time.'
      : revealsAnyStepAnswer(step.errorFeedback, step, allSteps, problemText)
        ? 'Re-read the prompt and check each part of your method before trying again.'
        : step.errorFeedback,
    hintText: hints[0],
    hintText2: hints[1],
    hintText3: hints[2],
    workedExample:
      showWorkedExample
        ? {
            text: safeExample!,
            svgStage: step.workedExampleSvgStage ?? step.svgStage,
          }
        : null,
    attemptCount: newWrongCount,
  })
}
