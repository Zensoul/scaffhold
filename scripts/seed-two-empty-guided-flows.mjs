/**
 * Add guided steps to the two active circle-segment problems that currently
 * have no steps. Safe to rerun: it never deletes, updates, or replaces steps.
 *
 * Dry run: node scripts/seed-two-empty-guided-flows.mjs
 * Apply:   node scripts/seed-two-empty-guided-flows.mjs --apply
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

const flows = [
  {
    id: '7cd60fcf-634b-47e1-b793-ff78ec7ab9e3',
    rawTextMustContain: ['15 cm', '90°', 'minor segment'],
    expectedFinalAnswer: '64.125',
    steps: [
      {
        sequenceOrder: 1,
        stepType: 'concept',
        stepLabel: 'Step 1 — Understand the minor segment',
        prompt: 'The chord divides the circle into a minor segment and a major segment. Which description matches the minor segment?',
        inputType: 'mcq',
        correctAnswer: 'The smaller region bounded by the chord and its arc',
        tolerance: null,
        hintText: 'Start with the word “minor.” Think about what it tells you when a circle is divided into two segments.',
        hintText2: 'A chord makes two regions: one smaller and one larger. Relate “minor” and “major” to those sizes.',
        hintText3: 'Compare the two regions made by the chord and choose the one with less area.',
        errorFeedback: 'Check what “minor” means in the pair minor segment and major segment. Look at the two regions made by the chord.',
        formulaCard: null,
        unit: null,
        svgStage: 0,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'The smaller region bounded by the chord and its arc', isCorrect: true, orderIndex: 0 },
          { optionText: 'The larger region bounded by the chord and its arc', isCorrect: false, orderIndex: 1 },
          { optionText: 'The triangular region between two radii and the chord', isCorrect: false, orderIndex: 2 },
          { optionText: 'The entire circle', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 2,
        stepType: 'concept',
        stepLabel: 'Step 2 — Plan the area calculation',
        prompt: 'The minor segment lies inside a sector, with a triangle between the two radii and the chord. Which relationship can find the segment area?',
        inputType: 'mcq',
        correctAnswer: 'Area of minor segment = area of sector − area of triangle',
        tolerance: null,
        hintText: 'Picture the sector as a larger slice that contains the triangle and the segment.',
        hintText2: 'The chord cuts a triangle out of the sector. The segment is the part of the sector left outside that triangle.',
        hintText3: 'Check that your relationship leaves the curved region between the chord and arc, rather than the triangle or the whole sector.',
        errorFeedback: 'Use the diagram: the sector contains both the triangle and the segment. Choose a relationship that leaves only the segment.',
        formulaCard: null,
        unit: null,
        svgStage: 1,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'Area of minor segment = area of sector − area of triangle', isCorrect: true, orderIndex: 0 },
          { optionText: 'Area of minor segment = area of triangle − area of sector', isCorrect: false, orderIndex: 1 },
          { optionText: 'Area of minor segment = area of sector + area of triangle', isCorrect: false, orderIndex: 2 },
          { optionText: 'Area of minor segment = area of full circle − area of triangle', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 3,
        stepType: 'substitution',
        stepLabel: 'Step 3 — Set up the sector area',
        prompt: 'For the sector, use θ = 90°, r = 15 cm, and π = 3.14. Which expression substitutes these values into the sector-area formula?',
        inputType: 'mcq',
        correctAnswer: '(90/360) × 3.14 × 15²',
        tolerance: null,
        hintText: 'The sector is a fraction of the full circle. Identify what fraction the central angle is of a full turn.',
        hintText2: 'Match the angle to the fraction and the radius to the squared-radius part of the area expression.',
        hintText3: 'Check that the angle is divided by 360 and that the radius is squared before evaluating.',
        errorFeedback: 'Check that the angle determines the fraction of the full circle and that area uses the square of the radius.',
        formulaCard: null,
        unit: null,
        svgStage: 2,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: '(90/360) × 3.14 × 15²', isCorrect: true, orderIndex: 0 },
          { optionText: '(90/180) × 3.14 × 15²', isCorrect: false, orderIndex: 1 },
          { optionText: '(90/360) × 3.14 × 15', isCorrect: false, orderIndex: 2 },
          { optionText: '(360/90) × 3.14 × 15²', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 4,
        stepType: 'computation',
        stepLabel: 'Step 4 — Calculate the sector area',
        prompt: 'Evaluate (90/360) × 3.14 × 15². Give the sector area in cm².',
        inputType: 'numeric',
        correctAnswer: '176.625',
        tolerance: 0.02,
        hintText: 'Simplify the angle fraction first, then square the radius.',
        hintText2: 'After simplifying the fraction and the square, multiply the remaining factors in order.',
        hintText3: 'Keep the intermediate value unrounded until the end, and check that the result is an area in cm².',
        errorFeedback: 'Check the angle fraction and the radius square separately before multiplying them by π.',
        formulaCard: 'Sector area = (θ/360) × π × r²',
        unit: 'cm²',
        svgStage: 3,
        workedExampleText: 'Example with r = 6 cm and θ = 90°:\nSector area = (90/360) × 3.14 × 6².\nSimplify the fraction and square first, then multiply to find the example area.',
        workedExampleSvgStage: 3,
        options: [],
      },
      {
        sequenceOrder: 5,
        stepType: 'concept',
        stepLabel: 'Step 5 — Choose a triangle-area method',
        prompt: 'The triangle is formed by two radii and the chord. Which method finds its area when two sides and their included angle are known?',
        inputType: 'mcq',
        correctAnswer: 'Area = ½ab sin(C)',
        tolerance: null,
        hintText: 'The two known sides are both radii, and the central angle is between them.',
        hintText2: 'Use a triangle-area relationship that includes two side lengths and the angle between those sides.',
        hintText3: 'The chord is not the triangle height. Choose a method that uses the included angle directly.',
        errorFeedback: 'The triangle has two known sides with a known included angle. Look for a method suited to that information.',
        formulaCard: null,
        unit: null,
        svgStage: 4,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'Area = ½ab sin(C)', isCorrect: true, orderIndex: 0 },
          { optionText: 'Area = base × height', isCorrect: false, orderIndex: 1 },
          { optionText: 'Area = πr²', isCorrect: false, orderIndex: 2 },
          { optionText: 'Area = ½(a + b)C', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 6,
        stepType: 'substitution',
        stepLabel: 'Step 6 — Substitute into the triangle formula',
        prompt: 'Both triangle sides are radii of 15 cm and the included angle is 90°. Which expression is ready to evaluate?',
        inputType: 'mcq',
        correctAnswer: '½ × 15 × 15 × sin(90°)',
        tolerance: null,
        hintText: 'The two side lengths are equal because each is a radius.',
        hintText2: 'Use each radius once, multiply by one half, then include the sine of the included angle.',
        hintText3: 'Check that the angle is the central angle between the two radii and that both sides are 15 cm.',
        errorFeedback: 'Check that both radii are used as the triangle sides and that the sine uses the included central angle.',
        formulaCard: 'Triangle area = ½ab sin(C)',
        unit: null,
        svgStage: 5,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: '½ × 15 × 15 × sin(90°)', isCorrect: true, orderIndex: 0 },
          { optionText: '½ × 15 × sin(90°)', isCorrect: false, orderIndex: 1 },
          { optionText: '½ × 15 × 15 × cos(90°)', isCorrect: false, orderIndex: 2 },
          { optionText: '½ × 15 × 15 × 90', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 7,
        stepType: 'computation',
        stepLabel: 'Step 7 — Calculate the triangle area',
        prompt: 'Evaluate ½ × 15 × 15 × sin(90°). Give the triangle area in cm².',
        inputType: 'numeric',
        correctAnswer: '112.5',
        tolerance: 0.02,
        hintText: 'Use the known value of sin(90°), then multiply the two radii.',
        hintText2: 'Take half of the product of the two side lengths after evaluating the sine factor.',
        hintText3: 'Check that your answer is smaller than the sector area and is measured in cm².',
        errorFeedback: 'Evaluate the sine factor first, then multiply the two side lengths and take half.',
        formulaCard: 'Triangle area = ½ab sin(C)',
        unit: 'cm²',
        svgStage: 6,
        workedExampleText: 'Example: for a right triangle with perpendicular sides 3 cm and 4 cm, area = ½ × 3 × 4. Use half the product of the perpendicular sides.',
        workedExampleSvgStage: 6,
        options: [],
      },
      {
        sequenceOrder: 8,
        stepType: 'computation',
        stepLabel: 'Step 8 — Find the minor segment area',
        prompt: 'Use the sector area and triangle area you found to calculate the minor segment area in cm².',
        inputType: 'numeric',
        correctAnswer: '64.125',
        tolerance: 0.02,
        hintText: 'Use the relationship from the diagram: the minor segment is the part of the sector outside the triangle.',
        hintText2: 'Take the triangle area away from the sector area. Keep the intermediate values unrounded.',
        hintText3: 'After subtracting, check that the segment area is positive and smaller than the sector area.',
        errorFeedback: 'Use the two areas from the previous steps, keep their units the same, and check the subtraction order.',
        formulaCard: 'Minor segment area = sector area − triangle area',
        unit: 'cm²',
        svgStage: 7,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [],
      },
    ],
  },
  {
    id: '5be52204-009b-480e-8962-341ca487b019',
    rawTextMustContain: ['10 cm', '120°', 'major segment'],
    expectedFinalAnswer: '252.58',
    steps: [
      {
        sequenceOrder: 1,
        stepType: 'concept',
        stepLabel: 'Step 1 — Identify the major segment',
        prompt: 'A chord divides the circle into two segments. Which region is the major segment?',
        inputType: 'mcq',
        correctAnswer: 'The larger region between the chord and the major arc',
        tolerance: null,
        hintText: 'The words “minor” and “major” describe the relative sizes of the two regions.',
        hintText2: 'The chord creates one region on each side of it. Compare their areas.',
        hintText3: 'Use the larger of the two regions bounded by the chord and an arc.',
        errorFeedback: 'Look at both regions made by the chord and distinguish the larger segment from the smaller one.',
        formulaCard: null,
        unit: null,
        svgStage: 0,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'The larger region between the chord and the major arc', isCorrect: true, orderIndex: 0 },
          { optionText: 'The smaller region between the chord and the minor arc', isCorrect: false, orderIndex: 1 },
          { optionText: 'The triangle formed by the chord and two radii', isCorrect: false, orderIndex: 2 },
          { optionText: 'The sector bounded by the two radii and minor arc', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 2,
        stepType: 'concept',
        stepLabel: 'Step 2 — Plan the major segment calculation',
        prompt: 'The minor and major segments together make the full circle. Which relationship can find the major segment area?',
        inputType: 'mcq',
        correctAnswer: 'Area of major segment = area of circle − area of minor segment',
        tolerance: null,
        hintText: 'Think of the two segments as pieces that fit together to make the whole circle.',
        hintText2: 'The smaller segment and the larger segment account for the entire circle area.',
        hintText3: 'Use the whole area and the smaller segment to determine what area remains for the larger segment.',
        errorFeedback: 'Check that your relationship combines the two segments to make exactly one full circle.',
        formulaCard: null,
        unit: null,
        svgStage: 1,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'Area of major segment = area of circle − area of minor segment', isCorrect: true, orderIndex: 0 },
          { optionText: 'Area of major segment = area of minor segment − area of circle', isCorrect: false, orderIndex: 1 },
          { optionText: 'Area of major segment = area of circle + area of minor segment', isCorrect: false, orderIndex: 2 },
          { optionText: 'Area of major segment = area of sector − area of triangle', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 3,
        stepType: 'computation',
        stepLabel: 'Step 3 — Find the full circle area',
        prompt: 'Calculate the area of the full circle using r = 10 cm and π = 3.14. Give your answer in cm².',
        inputType: 'numeric',
        correctAnswer: '314',
        tolerance: 0.02,
        hintText: 'Use the full-circle area formula and remember that the radius is squared.',
        hintText2: 'Square the radius before multiplying by the given value of π.',
        hintText3: 'Check that the result is a little more than three hundred square centimetres and that the unit is cm².',
        errorFeedback: 'Check that you squared the radius, used π = 3.14, and reported square units.',
        formulaCard: 'Full circle area = πr²',
        unit: 'cm²',
        svgStage: 2,
        workedExampleText: 'Example with r = 4 cm and π = 3.14:\nArea = πr² = 3.14 × 4².\nSquare the radius first, then multiply by π.',
        workedExampleSvgStage: 2,
        options: [],
      },
      {
        sequenceOrder: 4,
        stepType: 'concept',
        stepLabel: 'Step 4 — Set up the minor sector area',
        prompt: 'To find the smaller segment, first find the sector with central angle 120°. Which formula gives that sector area?',
        inputType: 'mcq',
        correctAnswer: 'Sector area = (θ/360) × πr²',
        tolerance: null,
        hintText: 'A sector is only part of the full circle, and its angle tells you how large a part.',
        hintText2: 'Relate the central angle to a complete turn, then use the full-circle area.',
        hintText3: 'Choose a method that takes the same fraction of the circle area as the angle is of a full turn.',
        errorFeedback: 'A sector area uses a fraction of the full circle; the central angle determines that fraction.',
        formulaCard: null,
        unit: null,
        svgStage: 3,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'Sector area = (θ/360) × πr²', isCorrect: true, orderIndex: 0 },
          { optionText: 'Sector area = (θ/360) × 2πr', isCorrect: false, orderIndex: 1 },
          { optionText: 'Sector area = πr²', isCorrect: false, orderIndex: 2 },
          { optionText: 'Sector area = (360/θ) × πr²', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 5,
        stepType: 'computation',
        stepLabel: 'Step 5 — Calculate the minor sector area',
        prompt: 'Evaluate (120/360) × 3.14 × 10² to find the minor sector area in cm². Keep enough precision for the next steps.',
        inputType: 'numeric',
        correctAnswer: '104.6667',
        tolerance: 0.02,
        hintText: 'Simplify the angle fraction, then square the radius.',
        hintText2: 'Multiply the full-circle area by the fraction represented by the central angle.',
        hintText3: 'Keep the unrounded value until the segment areas have been combined.',
        errorFeedback: 'Check the fraction of the full circle and avoid rounding the sector area too early.',
        formulaCard: 'Sector area = (θ/360) × πr²',
        unit: 'cm²',
        svgStage: 4,
        workedExampleText: 'Example with r = 6 cm and θ = 120°:\nSector area = (120/360) × 3.14 × 6².\nSimplify the fraction and square first, then evaluate.',
        workedExampleSvgStage: 4,
        options: [],
      },
      {
        sequenceOrder: 6,
        stepType: 'concept',
        stepLabel: 'Step 6 — Choose a triangle-area method',
        prompt: 'The minor sector contains a triangle formed by two radii and the chord. Which area method uses two sides and the angle between them?',
        inputType: 'mcq',
        correctAnswer: 'Triangle area = ½ab sin(C)',
        tolerance: null,
        hintText: 'The two known sides are radii, and the angle between them is the central angle.',
        hintText2: 'Look for a triangle-area method that uses two side lengths and their included angle.',
        hintText3: 'The chord is not the perpendicular height. Use the included angle to account for the triangle’s height.',
        errorFeedback: 'The diagram gives two sides and their included angle, so choose a method that uses those quantities.',
        formulaCard: null,
        unit: null,
        svgStage: 5,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [
          { optionText: 'Triangle area = ½ab sin(C)', isCorrect: true, orderIndex: 0 },
          { optionText: 'Triangle area = πr²', isCorrect: false, orderIndex: 1 },
          { optionText: 'Triangle area = a + b + C', isCorrect: false, orderIndex: 2 },
          { optionText: 'Triangle area = (θ/360) × πr²', isCorrect: false, orderIndex: 3 },
        ],
      },
      {
        sequenceOrder: 7,
        stepType: 'computation',
        stepLabel: 'Step 7 — Calculate the triangle area',
        prompt: 'Use ½ × 10 × 10 × sin(120°), with √3 = 1.73, to find the triangle area in cm².',
        inputType: 'numeric',
        correctAnswer: '43.25',
        tolerance: 0.02,
        hintText: 'Use sin(120°) = sin(60°), then express the sine value using the given √3.',
        hintText2: 'Evaluate the sine factor before multiplying by half the product of the two radii.',
        hintText3: 'Substitute the given approximation for √3, keep the included angle in degrees, and check for cm².',
        errorFeedback: 'Use the given approximation for √3 and remember the one-half factor in the triangle-area method.',
        formulaCard: 'Triangle area = ½ab sin(C)',
        unit: 'cm²',
        svgStage: 6,
        workedExampleText: 'Example: a triangle has sides 5 cm and 8 cm with included angle 30°. Use area = ½ab sin(C), substitute the values, and evaluate the sine factor.',
        workedExampleSvgStage: 6,
        options: [],
      },
      {
        sequenceOrder: 8,
        stepType: 'computation',
        stepLabel: 'Step 8 — Find the minor segment area',
        prompt: 'Use the sector and triangle areas to find the minor segment area in cm². Keep intermediate values unrounded.',
        inputType: 'numeric',
        correctAnswer: '61.4167',
        tolerance: 0.03,
        hintText: 'Use the diagram to identify which part of the sector is the triangle and which is the minor segment.',
        hintText2: 'Combine the sector and triangle areas using the relationship for the smaller segment.',
        hintText3: 'Check that the minor segment is positive and smaller than both the sector and the whole circle.',
        errorFeedback: 'Use the sector and triangle values from the preceding steps and check the relationship before calculating.',
        formulaCard: 'Minor segment area = minor sector area − triangle area',
        unit: 'cm²',
        svgStage: 7,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [],
      },
      {
        sequenceOrder: 9,
        stepType: 'computation',
        stepLabel: 'Step 9 — Find the major segment area',
        prompt: 'Use the full-circle area and the minor-segment area to find the major-segment area in cm². Round your final answer to two decimal places.',
        inputType: 'numeric',
        correctAnswer: '252.58',
        tolerance: 0.05,
        hintText: 'The two segment areas together make the full-circle area.',
        hintText2: 'Use the total circle area and the smaller segment area to determine the remaining region.',
        hintText3: 'Check that the major segment is larger than half of the full circle, and round only at the end.',
        errorFeedback: 'Check that your result and the minor segment together account for the full circle, and round to two decimal places.',
        formulaCard: 'Major segment area = full circle area − minor segment area',
        unit: 'cm²',
        svgStage: 7,
        workedExampleText: null,
        workedExampleSvgStage: null,
        options: [],
      },
    ],
  },
]

function validateContent(flow) {
  if (!flow.steps.length || flow.steps.at(-1).correctAnswer !== flow.expectedFinalAnswer) {
    throw new Error(`Final answer guard failed for ${flow.id}`)
  }
  for (const step of flow.steps) {
    if (!step.hintText?.trim() || !step.hintText2?.trim() || !step.hintText3?.trim()) {
      throw new Error(`Step ${step.sequenceOrder} is missing one of its three hints`)
    }
    if (step.inputType === 'mcq' && step.options.filter((option) => option.isCorrect).length !== 1) {
      throw new Error(`Step ${step.sequenceOrder} must have exactly one correct option`)
    }
    if (step.inputType === 'numeric' && step.options.length !== 0) {
      throw new Error(`Numeric step ${step.sequenceOrder} must not include MCQ options`)
    }
  }

  const near = (actual, expected) => Math.abs(actual - expected) < 0.01
  if (flow.id === '7cd60fcf-634b-47e1-b793-ff78ec7ab9e3') {
    const sector = (90 / 360) * 3.14 * 15 ** 2
    const triangle = 0.5 * 15 ** 2
    if (!near(sector, 176.625) || !near(triangle, 112.5) || !near(sector - triangle, 64.125)) {
      throw new Error('Minor-segment answer chain validation failed')
    }
  }
  if (flow.id === '5be52204-009b-480e-8962-341ca487b019') {
    const circle = 3.14 * 10 ** 2
    const sector = (120 / 360) * circle
    const triangle = 0.5 * 10 ** 2 * (1.73 / 2)
    const minorSegment = sector - triangle
    const majorSegment = Number((circle - minorSegment).toFixed(2))
    if (!near(circle, 314) || !near(sector, 104.6667) || !near(triangle, 43.25) ||
        !near(minorSegment, 61.4167) || majorSegment !== 252.58) {
      throw new Error('Major-segment answer chain validation failed')
    }
  }
}

async function main() {
  const targets = []
  for (const flow of flows) {
    validateContent(flow)
    const problem = await prisma.problem.findUnique({
      where: { id: flow.id },
      select: {
        id: true,
        isActive: true,
        rawText: true,
        guidedSolve: {
          select: {
            id: true,
            steps: { select: { id: true, sequenceOrder: true, stepLabel: true, correctAnswer: true }, orderBy: { sequenceOrder: 'asc' } },
          },
        },
      },
    })
    if (!problem?.isActive) throw new Error(`Expected active problem not found: ${flow.id}`)
    for (const expected of flow.rawTextMustContain) {
      if (!problem.rawText.toLowerCase().includes(expected.toLowerCase())) {
        throw new Error(`Problem text did not match the expected ${expected}: ${flow.id}`)
      }
    }
    const existingCount = problem.guidedSolve?.steps.length ?? 0
    let alreadySeeded = false
    if (existingCount > 0) {
      const currentSignature = problem.guidedSolve.steps.map(({ sequenceOrder, stepLabel, correctAnswer }) =>
        `${sequenceOrder}|${stepLabel}|${correctAnswer}`,
      )
      const expectedSignature = flow.steps.map(({ sequenceOrder, stepLabel, correctAnswer }) =>
        `${sequenceOrder}|${stepLabel}|${correctAnswer}`,
      )
      alreadySeeded = currentSignature.length === expectedSignature.length &&
        currentSignature.every((entry, index) => entry === expectedSignature[index])
      if (!alreadySeeded) {
        throw new Error(`Found ${existingCount} non-matching step(s) for ${flow.id}; refusing to overwrite or append.`)
      }
    }
    targets.push({ flow, problem, existingGuidedId: problem.guidedSolve?.id ?? null, alreadySeeded })
  }

  console.log(`${apply ? 'Applying' : 'Dry run:'} ${targets.length} guided flows`)
  for (const { flow, problem, alreadySeeded } of targets) {
    console.log(`\n${problem.id}: ${problem.rawText}`)
    console.log(`  ${alreadySeeded ? 'Already seeded; no changes' : `${flow.steps.length} steps to add; final answer ${flow.expectedFinalAnswer}`}`)
  }
  if (!apply) {
    const pending = targets.filter(({ alreadySeeded }) => !alreadySeeded).length
    console.log(`\nNo database changes made. ${pending} flow(s) need insertion; re-run with --apply to add only those.`)
    return
  }

  for (const { flow, existingGuidedId, alreadySeeded } of targets) {
    if (alreadySeeded) continue
    await prisma.$transaction(async (tx) => {
      const latest = await tx.guidedSolveProblem.findUnique({
        where: { problemId: flow.id },
        select: { id: true, steps: { select: { id: true } } },
      })
      if (latest?.steps.length) throw new Error(`Concurrent content exists for ${flow.id}; refusing to write`)

      const guidedId = latest?.id ?? existingGuidedId ?? (await tx.guidedSolveProblem.create({
        data: { problemId: flow.id },
        select: { id: true },
      })).id

      for (const step of flow.steps) {
        const { options, ...stepData } = step
        await tx.solveStep.create({
          data: {
            ...stepData,
            guidedSolveProblemId: guidedId,
            options: options.length ? { create: options } : undefined,
          },
        })
      }
    })
    console.log(`Inserted ${flow.steps.length} steps for ${flow.id}`)
  }
  console.log('\nBoth guided flows were added. No existing records were deleted or updated.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})
