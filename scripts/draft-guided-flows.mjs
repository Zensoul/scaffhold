/** Offline GPT-4o authoring for active maths problems that lack guided flows. */
import 'dotenv/config'
import OpenAI from 'openai'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MODEL = 'gpt-4o'
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)

function numericScalar(value) {
  const text = String(value ?? '').trim().replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2')
  const fraction = text.match(/^([+-]?\d+)\s*\/\s*(\d+)(?:\s*(?:cm(?:\^?2|²)?|m(?:\^?2|²)?|km(?:\^?2|²)?|degrees?|deg|°|meters?|metres?|cm|m))?\.?$/i)
  if (fraction && Number(fraction[2])) return Number(fraction[1]) / Number(fraction[2])
  const decimal = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*(?:cm(?:\^?2|²)?|m(?:\^?2|²)?|km(?:\^?2|²)?|degrees?|deg|°|meters?|metres?))?\.?$/i)
  return decimal ? Number(decimal[1]) : null
}

function validateFlow(flow, problem) {
  if (!Array.isArray(flow?.steps) || flow.steps.length < 2 || flow.steps.length > 8) throw new Error('Flow must contain 2–8 steps.')
  if (typeof flow.finalAnswer !== 'string' || !flow.finalAnswer.trim()) throw new Error('Flow must state the exact final answer for review.')
  const steps = flow.steps.map((step, index) => {
    if (step.sequenceOrder !== index + 1) throw new Error('Step orders must be consecutive from 1.')
    if (!['concept', 'substitution', 'computation'].includes(step.stepType)) throw new Error(`Invalid stepType at step ${index + 1}.`)
    if (!['mcq', 'numeric'].includes(step.inputType)) throw new Error(`Invalid inputType at step ${index + 1}.`)
    for (const key of ['stepLabel', 'prompt', 'correctAnswer', 'hintText', 'errorFeedback']) {
      if (typeof step[key] !== 'string' || !step[key].trim()) throw new Error(`Missing ${key} at step ${index + 1}.`)
    }
    const isMcq = step.inputType === 'mcq'
    if (isMcq) {
      if (!Array.isArray(step.options) || step.options.length !== 4) throw new Error(`Step ${index + 1} must have four options.`)
      if (step.options.filter((x) => x.optionText === step.correctAnswer).length !== 1) throw new Error(`Correct option mismatch at step ${index + 1}.`)
    } else if (!Number.isFinite(Number(step.correctAnswer))) throw new Error(`Numeric answer required at step ${index + 1}.`)
    for (const key of ['prerequisiteSkill', 'prerequisiteExplanation', 'prerequisiteExample', 'prerequisiteCheckPrompt', 'prerequisiteCheckAnswer']) {
      if (typeof step[key] !== 'string' || !step[key].trim()) throw new Error(`Missing ${key} at step ${index + 1}.`)
    }
    const parsedQuickAnswer = numericScalar(step.prerequisiteCheckAnswer)
    if (parsedQuickAnswer === null) throw new Error(`Prerequisite quick-check answer must be a single numeric value at step ${index + 1}.`)
    const tolerance = Number(step.tolerance ?? 0)
    const checkTolerance = Number(step.prerequisiteCheckTolerance ?? 0)
    if (tolerance < 0 || checkTolerance < 0 || checkTolerance > 1) throw new Error(`Invalid tolerance at step ${index + 1}.`)
    return {
      sequenceOrder: index + 1,
      stepType: step.stepType,
      stepLabel: step.stepLabel.trim(),
      prompt: step.prompt.trim(),
      inputType: step.inputType,
      correctAnswer: step.correctAnswer.trim(),
      tolerance,
      hintText: step.hintText.trim(),
      hintText2: step.hintText2?.trim() || null,
      hintText3: step.hintText3?.trim() || null,
      errorFeedback: step.errorFeedback.trim(),
      formulaCard: step.formulaCard?.trim() || null,
      svgStage: 0,
      workedExampleText: step.workedExampleText?.trim() || null,
      workedExampleSvgStage: null,
      selfExplainPrompt: step.selfExplainPrompt?.trim() || null,
      selfExplainAnswer: step.selfExplainAnswer?.trim() || null,
      // New flows omit optional follow-ups: an unverified extra answer must not mislead students.
      followUpPrompt: null,
      followUpAnswer: null,
      followUpInputType: null,
      followUpTolerance: null,
      prerequisiteSkill: step.prerequisiteSkill.trim(),
      prerequisiteExplanation: step.prerequisiteExplanation.trim(),
      prerequisiteExample: step.prerequisiteExample.trim(),
      prerequisiteCheckPrompt: step.prerequisiteCheckPrompt.trim(),
      prerequisiteCheckAnswer: String(parsedQuickAnswer),
      prerequisiteCheckTolerance: checkTolerance,
      conceptVideoUrl: null,
      socraticPrompt: step.socraticPrompt?.trim() || null,
      options: isMcq ? step.options.map((o, orderIndex) => ({ optionText: o.optionText.trim(), isCorrect: o.optionText === step.correctAnswer, orderIndex })) : [],
    }
  })
  const finalStep = steps.at(-1)
  const statedScalar = numericScalar(flow.finalAnswer)
  if (finalStep.inputType === 'numeric' && statedScalar !== null && Math.abs(Number(finalStep.correctAnswer) - statedScalar) > Math.max(0.001, Number(finalStep.tolerance ?? 0))) {
    throw new Error(`Final step answer ${finalStep.correctAnswer} does not match the model's stated final answer ${flow.finalAnswer}.`)
  }
  if (finalStep.inputType === 'mcq' && finalStep.correctAnswer !== flow.finalAnswer.trim()) {
    throw new Error(`Final MCQ answer does not match the model's stated final answer.`)
  }
  return { problemId: problem.id, chapter: problem.chapter.name, problemText: problem.rawText, finalAnswer: flow.finalAnswer.trim(), reviewStatus: 'needs_review', steps }
}

async function draft(problem) {
  const client = new OpenAI()
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 5500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: [
        'Create a clear, gentle, step-by-step guided solution for an Indian school maths student who may be below average.',
        'Use 3–6 small steps that lead to the exact answer. Each step must move the solution forward; do not repeat a formula-choice question and then jump directly to the final arithmetic. Show how the given values are identified and substituted. Do not skip reasoning or introduce unsupported facts. Distinguish the requested quantity carefully; do not turn a requested nth term into a total sum.',
        'Every step must include a specific prerequisite refresher: skill, plain explanation, easier worked example, numeric check prompt, exact numeric answer, and tolerance. The quick check must ask for a decimal numeric result (write 0.5, not 1/2), and prerequisiteCheckAnswer must be that decimal only, without units, words, or expressions.',
        'Use MCQ for concept/formula choice or substitution, with exactly four distinct options and one correct option; use numeric for calculation.',
        'For numeric steps, correctAnswer must be a plain numeric value. For every step, include useful hints and errorFeedback. The last hint and errorFeedback on a calculation step should show enough working to correct the likely mistake. Keep each prompt focused on one action. Ensure stepLabel describes the exact action asked by prompt.',
        'Check every calculation in the main solution, examples, quick checks, distractors, and final answer. Make units explicit when relevant. Do not invent missing diagram facts. Before returning, independently recompute the main answer and every numeric quick check.',
        'For proof or classification tasks, create meaningful MCQs for reasoning and only use numeric checks for prerequisite support. Do not add follow-up questions. Keep the final step answer identical to finalAnswer.',
        'Return JSON only: {"finalAnswer":"exact requested result","steps":[{"sequenceOrder":1,"stepType":"concept|substitution|computation","stepLabel":"...","prompt":"...","inputType":"mcq|numeric","correctAnswer":"...","tolerance":0,"options":[{"optionText":"..."}],"hintText":"...","hintText2":"...","hintText3":"...","errorFeedback":"...","formulaCard":"...","workedExampleText":"...","selfExplainPrompt":"...","selfExplainAnswer":"...","prerequisiteSkill":"...","prerequisiteExplanation":"...","prerequisiteExample":"...","prerequisiteCheckPrompt":"...","prerequisiteCheckAnswer":"...","prerequisiteCheckTolerance":0,"socraticPrompt":"..."}]}.',
      ].join('\n') },
      { role: 'user', content: JSON.stringify({ problem: problem.rawText, chapter: problem.chapter.name, subtopic: problem.subtopic?.name ?? null, givenInformation: problem.givens, impliedInformation: problem.impliedGivens, unknown: problem.unknownAnnotation, conceptAnchor: problem.conceptAnchor, problemType: problem.problemType, difficulty: problem.difficultyTier }) },
    ],
  })
  const text = response.choices[0]?.message?.content
  if (!text) throw new Error('Empty model response.')
  try {
    return validateFlow(JSON.parse(text), problem)
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} Model response excerpt: ${text.slice(0, 1200)}`)
  }
}

async function main() {
  if (!process.argv.includes('--generate')) throw new Error('Add --generate to create offline drafts; no database writes are performed.')
  const problemId = option('problem-id')
  const limit = option('limit') ? Number(option('limit')) : Infinity
  const problems = await prisma.problem.findMany({
    where: { isActive: true, chapter: { subject: { name: 'math' } }, guidedSolve: null, ...(problemId ? { id: problemId } : {}) },
    select: { id: true, rawText: true, givens: true, impliedGivens: true, unknownAnnotation: true, conceptAnchor: true, problemType: true, difficultyTier: true, chapter: { select: { name: true } }, subtopic: { select: { name: true } } },
    orderBy: [{ chapter: { name: 'asc' } }, { id: 'asc' }],
  })
  const batch = problems.slice(0, limit)
  const result = { formatVersion: 1, generatedAt: new Date().toISOString(), model: MODEL, reviewRequired: true, drafts: [], errors: [] }
  for (const problem of batch) {
    try { result.drafts.push(await draft(problem)); console.log(`Drafted ${problem.id} (${problem.chapter.name}).`) }
    catch (error) { result.errors.push({ problemId: problem.id, error: error instanceof Error ? error.message : String(error) }); console.error(`Failed ${problem.id}: ${error instanceof Error ? error.message : error}`) }
  }
  const out = join(process.cwd(), 'scripts', 'data', 'guided-flow-drafts')
  await mkdir(out, { recursive: true })
  const file = join(out, `guided-flow-drafts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(file, JSON.stringify(result, null, 2) + '\n')
  console.log(`Saved review-only drafts to ${file}. ${result.drafts.length} drafted, ${result.errors.length} failed.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
