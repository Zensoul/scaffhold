/**
 * Validate and optionally apply teacher-reviewed prerequisite drafts.
 * Drafts are never applied unless the lesson is marked "approved" and
 * this script is run with --apply.
 *
 * Usage:
 *   node scripts/apply-reviewed-prerequisite-support.mjs <draft.json>
 *   node scripts/apply-reviewed-prerequisite-support.mjs <draft.json> --apply
 */
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const filePath = process.argv[2]
const apply = process.argv.includes('--apply')

async function main() {
  if (!filePath || filePath.startsWith('--')) {
    throw new Error('Pass a reviewed draft JSON path first.')
  }
  const document = JSON.parse(await readFile(filePath, 'utf8'))
  if (document?.formatVersion !== 1 || !Array.isArray(document.drafts)) {
    throw new Error('Unsupported prerequisite draft file format.')
  }

  const approved = document.drafts.flatMap((draft) =>
    (draft.lessons ?? [])
      .filter((lesson) => lesson.reviewStatus === 'approved')
      .map((lesson) => ({ draft, lesson })),
  )
  if (approved.length === 0) {
    console.log('No lessons are marked approved. No database changes made.')
    return
  }

  const seen = new Set()
  const updates = []
  for (const { draft, lesson } of approved) {
    if (typeof lesson.stepId !== 'string' || seen.has(lesson.stepId)) {
      throw new Error('An approved lesson has a missing or duplicate stepId.')
    }
    seen.add(lesson.stepId)
    const step = await prisma.solveStep.findUnique({
      where: { id: lesson.stepId },
      include: {
        guidedSolveProblem: {
          include: {
            problem: {
              select: { id: true, isActive: true, chapter: { select: { subject: { select: { name: true } } } } },
            },
          },
        },
      },
    })
    if (!step || step.guidedSolveProblem.problemId !== draft.problemId) {
      throw new Error(`Approved step ${lesson.stepId} no longer belongs to draft problem ${draft.problemId}.`)
    }
    if (!step.guidedSolveProblem.problem.isActive || step.guidedSolveProblem.problem.chapter.subject.name !== 'math') {
      throw new Error(`Problem ${draft.problemId} is inactive or is not a maths problem.`)
    }
    if (step.sequenceOrder !== lesson.sequenceOrder || step.stepLabel !== lesson.stepLabel) {
      throw new Error(`Step ${lesson.stepId} changed since its draft was generated.`)
    }
    if (step.prerequisiteSkill) {
      throw new Error(`Step ${lesson.stepId} already has prerequisite support; refusing to overwrite it.`)
    }

    const requiredFields = [
      'prerequisiteSkill',
      'prerequisiteExplanation',
      'prerequisiteExample',
      'prerequisiteCheckPrompt',
      'prerequisiteCheckAnswer',
    ]
    for (const field of requiredFields) {
      if (typeof lesson[field] !== 'string' || !lesson[field].trim()) {
        throw new Error(`Approved step ${lesson.stepId} is missing ${field}.`)
      }
    }
    const checkAnswer = Number(lesson.prerequisiteCheckAnswer)
    const tolerance = Number(lesson.prerequisiteCheckTolerance)
    if (!Number.isFinite(checkAnswer) || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) {
      throw new Error(`Approved step ${lesson.stepId} has an invalid numeric quick check.`)
    }

    updates.push({
      id: step.id,
      data: {
        prerequisiteSkill: lesson.prerequisiteSkill.trim(),
        prerequisiteExplanation: lesson.prerequisiteExplanation.trim(),
        prerequisiteExample: lesson.prerequisiteExample.trim(),
        prerequisiteCheckPrompt: lesson.prerequisiteCheckPrompt.trim(),
        prerequisiteCheckAnswer: lesson.prerequisiteCheckAnswer.trim(),
        prerequisiteCheckTolerance: tolerance,
      },
    })
  }

  if (!apply) {
    console.log(`Validated ${updates.length} approved lessons. No database changes made; pass --apply to save them.`)
    return
  }

  await prisma.$transaction(updates.map(({ id, data }) => prisma.solveStep.update({ where: { id }, data })))
  console.log(`Applied ${updates.length} reviewed prerequisite lessons.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
