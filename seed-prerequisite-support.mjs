/**
 * Add short prerequisite refreshers to the four steps in the circle-with-inscribed-square guided problem.
 * Safe to rerun: updates only the new prerequisite-support columns on matched steps.
 * Run after the add_step_prerequisite_support migration has been applied.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const problemId = '19df56d0-c2c1-4a0a-80ed-e11ad8086e7c'

const lessons = [
  {
    sequenceOrder: 1,
    expectedLabel: 'Square inscribed in circle',
    prerequisiteSkill: 'Radius and diameter',
    prerequisiteExplanation: 'A radius goes from the centre to the circle. A diameter goes across the whole circle through the centre, so it is two radii long.',
    prerequisiteExample: 'If a circle has radius 4 cm, its diameter is 4 + 4 = 8 cm.',
    prerequisiteCheckPrompt: 'A circle has radius 3 cm. What is its diameter in cm?',
    prerequisiteCheckAnswer: '6',
    prerequisiteCheckTolerance: 0,
  },
  {
    sequenceOrder: 2,
    expectedLabel: 'Area of the circle',
    prerequisiteSkill: 'Squaring a number before multiplying',
    prerequisiteExplanation: 'In πr², r² means radius × radius. Work that out first, then multiply by π.',
    prerequisiteExample: 'If r = 2 cm and π = 3.14: r² = 2 × 2 = 4, then circle area = 3.14 × 4 = 12.56 cm².',
    prerequisiteCheckPrompt: 'If r = 3 cm and π = 3.14, what is the circle area in cm²?',
    prerequisiteCheckAnswer: '28.26',
    prerequisiteCheckTolerance: 0.01,
  },
  {
    sequenceOrder: 3,
    expectedLabel: 'Side of the inscribed square',
    prerequisiteSkill: 'Finding square area from its diagonal',
    prerequisiteExplanation: 'A square’s diagonal splits it into two equal right triangles. The area of the square is diagonal² ÷ 2.',
    prerequisiteExample: 'For diagonal 6 cm: area = 6² ÷ 2 = 36 ÷ 2 = 18 cm².',
    prerequisiteCheckPrompt: 'A square has diagonal 4 cm. What is its area in cm²?',
    prerequisiteCheckAnswer: '8',
    prerequisiteCheckTolerance: 0,
  },
  {
    sequenceOrder: 4,
    expectedLabel: 'Uncovered area of the circle',
    prerequisiteSkill: 'Finding the area left around an inside shape',
    prerequisiteExplanation: 'When one shape is inside another, the uncovered part is the larger area minus the inside area.',
    prerequisiteExample: 'If the circle area is 40 cm² and the inside square area is 25 cm², uncovered area = 40 − 25 = 15 cm².',
    prerequisiteCheckPrompt: 'A circle’s area is 50 cm² and the inside square’s area is 32 cm². What area is uncovered in cm²?',
    prerequisiteCheckAnswer: '18',
    prerequisiteCheckTolerance: 0,
  },
]

async function main() {
  const guidedProblem = await prisma.guidedSolveProblem.findUnique({
    where: { problemId },
    include: { steps: true },
  })
  if (!guidedProblem) throw new Error(`Guided problem ${problemId} was not found.`)

  for (const lesson of lessons) {
    const step = guidedProblem.steps.find((candidate) => candidate.sequenceOrder === lesson.sequenceOrder)
    if (!step || step.stepLabel !== lesson.expectedLabel) {
      throw new Error(`Expected step ${lesson.sequenceOrder} (${lesson.expectedLabel}) was not found; no step was updated.`)
    }
  }

  for (const lesson of lessons) {
    const step = guidedProblem.steps.find((candidate) => candidate.sequenceOrder === lesson.sequenceOrder)!
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
