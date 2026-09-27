/**
 * Add prerequisite refreshers to the minor-segment guided problem.
 * Safe to rerun: updates only prerequisite-support columns on matched steps.
 * Run after the add_step_prerequisite_support migration has been applied.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const problemId = 'd93d4fa0-3374-4f8e-a3da-b3539a7891ff'
const expectedProblemText = 'A chord of a circle of radius 12 cm subtends a central angle of 60°. Find the area of the corresponding minor segment. (Use π = 3.14 and √3 = 1.73.)'

const lessons = [
  {
    sequenceOrder: 2,
    expectedLabel: 'Set up sector area',
    prerequisiteSkill: 'Finding what fraction of a circle an angle represents',
    prerequisiteExplanation: 'A full circle is 360°. The sector is the same fraction of the full circle as its angle is of 360°. Divide the angle by 360 before multiplying by the circle area.',
    prerequisiteExample: 'A 90° sector is 90 ÷ 360 = 1/4 of a circle, so its area is one quarter of πr².',
    prerequisiteCheckPrompt: 'What decimal fraction of a full circle is a 90° sector?',
    prerequisiteCheckAnswer: '0.25',
    prerequisiteCheckTolerance: 0.001,
  },
  {
    sequenceOrder: 3,
    expectedLabel: 'Calculate sector area',
    prerequisiteSkill: 'Squaring the radius and multiplying in order',
    prerequisiteExplanation: 'In πr², square the radius first: r² means r × r. Then multiply by π and by the angle fraction.',
    prerequisiteExample: 'For r = 2 cm and a 90° sector: 2² = 4, then (1/4) × 3.14 × 4 = 3.14 cm².',
    prerequisiteCheckPrompt: 'Find the area of a 60° sector with radius 3 cm. Use π = 3.14. Give your answer in cm².',
    prerequisiteCheckAnswer: '4.71',
    prerequisiteCheckTolerance: 0.01,
  },
  {
    sequenceOrder: 4,
    expectedLabel: 'Triangle type at 60°',
    prerequisiteSkill: 'Using equal sides and angles in an isosceles triangle',
    prerequisiteExplanation: 'The two radii are equal, so the triangle is isosceles and its two base angles are equal. If the angle between the radii is 60°, the other two angles share 180° − 60° = 120°, so each is 60°. All three sides are then equal.',
    prerequisiteExample: 'If an isosceles triangle has a top angle of 80°, its two equal base angles are (180° − 80°) ÷ 2 = 50° each.',
    prerequisiteCheckPrompt: 'An isosceles triangle has a top angle of 80°. What is each equal base angle in degrees?',
    prerequisiteCheckAnswer: '50',
    prerequisiteCheckTolerance: 0,
  },
  {
    sequenceOrder: 5,
    expectedLabel: 'Set up triangle area',
    prerequisiteSkill: 'Using the area formula for an equilateral triangle',
    prerequisiteExplanation: 'For an equilateral triangle with side a, area = (√3 ÷ 4) × a². Here the triangle is equilateral, so its side is the radius.',
    prerequisiteExample: 'If a = 2 cm and √3 = 1.73: area = (1.73 ÷ 4) × 2² = 1.73 cm².',
    prerequisiteCheckPrompt: 'An equilateral triangle has side 4 cm. Use √3 = 1.73. What is its area in cm²?',
    prerequisiteCheckAnswer: '6.92',
    prerequisiteCheckTolerance: 0.01,
  },
  {
    sequenceOrder: 6,
    expectedLabel: 'Calculate triangle area',
    prerequisiteSkill: 'Breaking a decimal multiplication into easier steps',
    prerequisiteExplanation: 'Divide by 4 first, then multiply by 1.73. This keeps the arithmetic manageable: (1.73 ÷ 4) × 144 = 1.73 × 36.',
    prerequisiteExample: 'For side 4 cm: (1.73 ÷ 4) × 16 = 1.73 × 4 = 6.92 cm².',
    prerequisiteCheckPrompt: 'Work out (1.73 ÷ 4) × 16.',
    prerequisiteCheckAnswer: '6.92',
    prerequisiteCheckTolerance: 0.01,
  },
  {
    sequenceOrder: 7,
    expectedLabel: 'Find minor segment area',
    prerequisiteSkill: 'Subtracting one area from another',
    prerequisiteExplanation: 'The minor segment is the part of the sector left after removing the triangle. Subtract the triangle area from the sector area, keeping the same square units.',
    prerequisiteExample: 'If a sector is 20 cm² and its triangle is 12 cm², the segment is 20 − 12 = 8 cm².',
    prerequisiteCheckPrompt: 'A sector has area 50 cm² and its triangle has area 32 cm². What is the segment area in cm²?',
    prerequisiteCheckAnswer: '18',
    prerequisiteCheckTolerance: 0,
  },
]

async function main() {
  const guidedProblem = await prisma.guidedSolveProblem.findUnique({
    where: { problemId },
    include: { problem: { select: { rawText: true, isActive: true } }, steps: true },
  })
  if (!guidedProblem) throw new Error(`Guided problem ${problemId} was not found.`)
  if (!guidedProblem.problem.isActive || guidedProblem.problem.rawText !== expectedProblemText) {
    throw new Error('The active problem text did not match the expected minor-segment problem; no steps were updated.')
  }

  for (const lesson of lessons) {
    const step = guidedProblem.steps.find((candidate) => candidate.sequenceOrder === lesson.sequenceOrder)
    if (!step || step.stepLabel !== lesson.expectedLabel) {
      throw new Error(`Expected step ${lesson.sequenceOrder} (${lesson.expectedLabel}) was not found; no step was updated.`)
    }
  }

  for (const lesson of lessons) {
    const step = guidedProblem.steps.find((candidate) => candidate.sequenceOrder === lesson.sequenceOrder)
    if (!step) throw new Error(`Expected step ${lesson.sequenceOrder} was not found.`)
    await prisma.solveStep.update({
      where: { id: step.id },
      data: {
        prerequisiteSkill: lesson.prerequisiteSkill,
        prerequisiteExplanation: lesson.prerequisiteExplanation,
        prerequisiteExample: lesson.prerequisiteExample,
        prerequisiteCheckPrompt: lesson.prerequisiteCheckPrompt,
        prerequisiteCheckAnswer: lesson.prerequisiteCheckAnswer,
        prerequisiteCheckTolerance: lesson.prerequisiteCheckTolerance,
      },
    })
  }
  console.log(`Attached ${lessons.length} prerequisite refreshers to ${guidedProblem.problemId}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
