/** Apply only explicitly reviewed guided-flow drafts. */
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const filePath = process.argv[2]
const apply = process.argv.includes('--apply')

function numericScalar(value) {
  const text = String(value ?? '').trim().replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2')
  const fraction = text.match(/^([+-]?\d+)\s*\/\s*(\d+)(?:\s*(?:cm(?:\^?2|²)?|m(?:\^?2|²)?|km(?:\^?2|²)?|degrees?|deg|°|meters?|metres?))?\.?$/i)
  if (fraction && Number(fraction[2])) return Number(fraction[1]) / Number(fraction[2])
  const decimal = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*(?:cm(?:\^?2|²)?|m(?:\^?2|²)?|km(?:\^?2|²)?|degrees?|deg|°|meters?|metres?))?\.?$/i)
  return decimal ? Number(decimal[1]) : null
}

async function main() {
  if (!filePath || filePath.startsWith('--')) throw new Error('Pass a guided-flow review JSON file first.')
  const document = JSON.parse(await readFile(filePath, 'utf8'))
  if (document?.formatVersion !== 1 || !Array.isArray(document.drafts)) throw new Error('Unsupported guided-flow draft file format.')
  const approved = document.drafts.filter((draft) => draft.reviewStatus === 'approved')
  if (!approved.length) { console.log('No flows are marked approved. No database changes made.'); return }

  const seen = new Set()
  const creates = []
  for (const draft of approved) {
    if (typeof draft.problemId !== 'string' || seen.has(draft.problemId)) throw new Error('Missing or duplicate problemId.')
    seen.add(draft.problemId)
    if (!Array.isArray(draft.steps) || draft.steps.length < 2 || draft.steps.length > 8) throw new Error(`Invalid step count for ${draft.problemId}.`)
    const problem = await prisma.problem.findUnique({
      where: { id: draft.problemId },
      select: { id: true, rawText: true, isActive: true, chapter: { select: { name: true, subject: { select: { name: true } } } }, guidedSolve: { select: { id: true } } },
    })
    if (!problem || !problem.isActive || problem.chapter.subject.name !== 'math') throw new Error(`Problem ${draft.problemId} is missing, inactive, or not maths.`)
    if (problem.guidedSolve) throw new Error(`Problem ${draft.problemId} already has a guided flow.`)
    if (problem.rawText !== draft.problemText || problem.chapter.name !== draft.chapter) throw new Error(`Problem ${draft.problemId} changed since the draft was generated.`)
    if (typeof draft.finalAnswer !== 'string' || !draft.finalAnswer.trim()) throw new Error(`Flow ${draft.problemId} is missing its separately stated final answer.`)

    const steps = draft.steps.map((step, index) => {
      if (step.sequenceOrder !== index + 1 || !['concept', 'substitution', 'computation'].includes(step.stepType) || !['mcq', 'numeric'].includes(step.inputType)) throw new Error(`Invalid step definition for ${draft.problemId}, step ${index + 1}.`)
      for (const key of ['stepLabel', 'prompt', 'correctAnswer', 'hintText', 'errorFeedback', 'prerequisiteSkill', 'prerequisiteExplanation', 'prerequisiteExample', 'prerequisiteCheckPrompt', 'prerequisiteCheckAnswer']) {
        if (typeof step[key] !== 'string' || !step[key].trim()) throw new Error(`Missing ${key} for ${draft.problemId}, step ${index + 1}.`)
      }
      const checkAnswer = numericScalar(step.prerequisiteCheckAnswer)
      const checkTolerance = Number(step.prerequisiteCheckTolerance)
      if (checkAnswer === null || !Number.isFinite(checkTolerance) || checkTolerance < 0 || checkTolerance > 1) throw new Error(`Invalid prerequisite check for ${draft.problemId}, step ${index + 1}.`)
      if (step.inputType === 'numeric' && !Number.isFinite(Number(step.correctAnswer))) throw new Error(`Invalid numeric answer for ${draft.problemId}, step ${index + 1}.`)
      if (step.inputType === 'mcq') {
        if (!Array.isArray(step.options) || step.options.length !== 4 || new Set(step.options.map((o) => o.optionText)).size !== 4 || step.options.filter((o) => o.isCorrect).length !== 1 || !step.options.some((o) => o.isCorrect && o.optionText === step.correctAnswer)) throw new Error(`Invalid MCQ options for ${draft.problemId}, step ${index + 1}.`)
      } else if (step.options?.length) throw new Error(`Numeric step has options for ${draft.problemId}, step ${index + 1}.`)
      return {
        sequenceOrder: index + 1,
        stepType: step.stepType,
        stepLabel: step.stepLabel,
        prompt: step.prompt,
        inputType: step.inputType,
        correctAnswer: step.correctAnswer,
        tolerance: step.inputType === 'numeric' ? Number(step.tolerance ?? 0) : null,
        hintText: step.hintText,
        hintText2: step.hintText2,
        hintText3: step.hintText3,
        errorFeedback: step.errorFeedback,
        formulaCard: step.formulaCard,
        svgStage: 0,
        workedExampleText: step.workedExampleText,
        workedExampleSvgStage: null,
        selfExplainPrompt: step.selfExplainPrompt,
        selfExplainAnswer: step.selfExplainAnswer,
        followUpPrompt: step.followUpPrompt,
        followUpAnswer: step.followUpAnswer,
        followUpInputType: step.followUpAnswer ? 'numeric' : null,
        followUpTolerance: step.followUpAnswer ? Number(step.followUpTolerance ?? 0) : null,
        prerequisiteSkill: step.prerequisiteSkill,
        prerequisiteExplanation: step.prerequisiteExplanation,
        prerequisiteExample: step.prerequisiteExample,
        prerequisiteCheckPrompt: step.prerequisiteCheckPrompt,
        prerequisiteCheckAnswer: String(checkAnswer),
        prerequisiteCheckTolerance: checkTolerance,
        conceptVideoUrl: null,
        socraticPrompt: step.socraticPrompt,
        options: step.inputType === 'mcq' ? { create: step.options.map((o, orderIndex) => ({ optionText: o.optionText, isCorrect: o.isCorrect, orderIndex })) } : undefined,
      }
    })
    const last = steps.at(-1)
    const statedScalar = numericScalar(draft.finalAnswer)
    if ((last.inputType === 'numeric' && statedScalar !== null && Math.abs(Number(last.correctAnswer) - statedScalar) > Math.max(0.001, Number(last.tolerance ?? 0))) ||
        (last.inputType === 'mcq' && last.correctAnswer !== draft.finalAnswer.trim())) {
      throw new Error(`Final step answer does not match the reviewed final answer for ${draft.problemId}.`)
    }
    creates.push({ problemId: draft.problemId, steps: { create: steps } })
  }

  if (!apply) { console.log(`Validated ${creates.length} approved guided flows. No database changes made; pass --apply to save.`); return }
  await prisma.$transaction(creates.map((data) => prisma.guidedSolveProblem.create({ data })))
  console.log(`Applied ${creates.length} reviewed guided flows.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
