/**
 * Draft prerequisite refreshers for guided maths steps with the LLM.
 * This is an offline authoring tool: it writes a review JSON file only.
 * It never updates student-facing database content.
 *
 * Usage:
 *   node scripts/draft-prerequisite-support.mjs --generate
 *   node scripts/draft-prerequisite-support.mjs --generate --limit=3
 *   node scripts/draft-prerequisite-support.mjs --generate --problem-id=<uuid>
 */
import 'dotenv/config'
import OpenAI from 'openai'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const MODEL = 'gpt-4o'
const prisma = new PrismaClient()

function getOption(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function validateLessons(output, steps) {
  if (!Array.isArray(output?.lessons)) throw new Error('Response must contain a lessons array.')
  const expected = new Map(steps.map((step) => [step.sequenceOrder, step]))
  const seen = new Set()
  const lessons = output.lessons.map((lesson) => {
    const step = expected.get(lesson?.sequenceOrder)
    if (!step || seen.has(step.sequenceOrder)) throw new Error('Response has a missing, unexpected, or duplicate step order.')
    seen.add(step.sequenceOrder)
    if (lesson.stepLabel !== step.stepLabel) throw new Error(`Step label mismatch at step ${step.sequenceOrder}.`)

    const fields = [
      'prerequisiteSkill',
      'prerequisiteExplanation',
      'prerequisiteExample',
      'prerequisiteCheckPrompt',
      'prerequisiteCheckAnswer',
    ]
    for (const field of fields) {
      if (typeof lesson[field] !== 'string' || !lesson[field].trim()) {
        throw new Error(`Missing ${field} for step ${step.sequenceOrder}.`)
      }
      if (lesson[field].length > 1200) throw new Error(`${field} is too long for step ${step.sequenceOrder}.`)
    }

    if (typeof lesson.prerequisiteCheckAnswer !== 'string' && typeof lesson.prerequisiteCheckAnswer !== 'number') {
      throw new Error(`The quick-check answer for step ${step.sequenceOrder} must be numeric.`)
    }
    const answerText = String(lesson.prerequisiteCheckAnswer).trim()
    const fraction = answerText.match(/^([+-]?\d+)\s*\/\s*(\d+)$/)
    const numericAnswer = answerText.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s*(?:cm(?:\^?2|²)?|m(?:\^?2|²)?|km(?:\^?2|²)?|degrees?|deg|°))?\.?$/i)
    if (!fraction && !numericAnswer) throw new Error(`The quick-check answer for step ${step.sequenceOrder} must be numeric.`)
    const normalizedAnswer = fraction
      ? String(Number(fraction[1]) / Number(fraction[2]))
      : numericAnswer[1]
    const answer = Number(normalizedAnswer)
    const tolerance = Number(lesson.prerequisiteCheckTolerance)
    if (!Number.isFinite(answer)) throw new Error(`The quick-check answer for step ${step.sequenceOrder} must be numeric.`)
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) {
      throw new Error(`The quick-check tolerance for step ${step.sequenceOrder} must be between 0 and 1.`)
    }

    return {
      stepId: step.id,
      sequenceOrder: step.sequenceOrder,
      stepLabel: step.stepLabel,
      reviewStatus: 'needs_review',
      prerequisiteSkill: lesson.prerequisiteSkill.trim(),
      prerequisiteExplanation: lesson.prerequisiteExplanation.trim(),
      prerequisiteExample: lesson.prerequisiteExample.trim(),
      prerequisiteCheckPrompt: lesson.prerequisiteCheckPrompt.trim(),
      prerequisiteCheckAnswer: normalizedAnswer,
      prerequisiteCheckTolerance: tolerance,
    }
  })
  if (seen.size !== steps.length) throw new Error('Response did not draft a lesson for every requested step.')
  return lessons
}

async function draftForProblem(problem) {
  const openai = new OpenAI()
  const steps = problem.guidedSolve.steps.filter((step) => !step.prerequisiteSkill)
  const startedAt = Date.now()
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: Math.min(5000, 900 + steps.length * 650),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You draft short prerequisite refreshers for Indian school students who struggle with maths.',
          'These are drafts for a teacher to review. Never claim the student has mastered a skill.',
          'For each requested guided step, identify only the smallest prerequisite skill that might block progress.',
          'Keep the refresher directly connected to this exact step. Reuse its mathematical idea or formula with easier numbers; do not switch to unrelated examples such as x + y unless the step itself is about that skill.',
          'Write a plain-language explanation, one easier fully worked example, and one numeric quick-check question with its numeric answer.',
          'The example must show the arithmetic through to its final result, not stop at a formula substitution.',
          'The quick check must test the prerequisite, use different and easier numbers than the main problem, and ask for a final numeric result only.',
          'Do not ask the student to choose or write a formula/expression when the interface expects a number.',
          'This numeric-only rule also applies when the guided step asks for a word or triangle type: check a related numeric fact instead, such as an angle sum, fraction, length, or area.',
          'Calculate the exact answer to each quick check and make prerequisiteCheckAnswer match it; do not include units or prose in that field.',
          'Show correct units where relevant. Keep language supportive, short, and concrete. Avoid extra theory.',
          'Do not solve the main problem in the refresher. Do not introduce facts or formulas not needed for this step.',
          'If the step is conceptual, choose a closely related numeric prerequisite check. Check every arithmetic result carefully.',
          'Return exactly one lesson for every requested step, preserving sequenceOrder and stepLabel exactly.',
          'The quick-check answer must be only a numeric value as a string, with no units or explanation.',
          'Return JSON: {"lessons":[{"sequenceOrder":number,"stepLabel":string,"prerequisiteSkill":string,"prerequisiteExplanation":string,"prerequisiteExample":string,"prerequisiteCheckPrompt":string,"prerequisiteCheckAnswer":string,"prerequisiteCheckTolerance":number}]}.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          problem: problem.rawText,
          chapter: problem.chapter.name,
          steps: steps.map((step) => ({
            id: step.id,
            sequenceOrder: step.sequenceOrder,
            stepLabel: step.stepLabel,
            prompt: step.prompt,
            inputType: step.inputType,
            correctAnswer: step.correctAnswer,
            tolerance: step.tolerance,
            hint: step.hintText,
            proceduralHint: step.hintText2,
            workedExample: step.workedExampleText,
          })),
        }),
      },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) throw new Error('The model returned an empty response.')
  const parsed = JSON.parse(text)
  const lessons = validateLessons(parsed, steps)
  return {
    problemId: problem.id,
    chapter: problem.chapter.name,
    problemText: problem.rawText,
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    latencyMs: Date.now() - startedAt,
    lessons,
  }
}

async function main() {
  if (!process.argv.includes('--generate')) {
    console.log('No LLM calls made. Add --generate to create offline drafts; the script never writes them to the live database.')
    return
  }

  const problemId = getOption('problem-id')
  const limitValue = getOption('limit')
  const limit = limitValue ? Number(limitValue) : Number.POSITIVE_INFINITY
  if (limitValue && (!Number.isInteger(limit) || limit < 1)) throw new Error('--limit must be a positive integer.')

  const problems = await prisma.problem.findMany({
    where: {
      isActive: true,
      chapter: { subject: { name: 'math' } },
      guidedSolve: { isNot: null },
      ...(problemId ? { id: problemId } : {}),
    },
    select: {
      id: true,
      rawText: true,
      chapter: { select: { name: true } },
      guidedSolve: {
        select: {
          steps: {
            orderBy: { sequenceOrder: 'asc' },
            select: {
              id: true,
              sequenceOrder: true,
              stepLabel: true,
              prompt: true,
              inputType: true,
              correctAnswer: true,
              tolerance: true,
              hintText: true,
              hintText2: true,
              workedExampleText: true,
              prerequisiteSkill: true,
            },
          },
        },
      },
    },
    orderBy: [{ chapter: { name: 'asc' } }, { id: 'asc' }],
  })

  const candidates = problems
    .filter((problem) => problem.guidedSolve?.steps.some((step) => !step.prerequisiteSkill))
    .slice(0, limit)
  if (candidates.length === 0) {
    console.log('No active guided maths steps are missing prerequisite support for the selected scope.')
    return
  }

  const activeMathProblemCount = await prisma.problem.count({
    where: { isActive: true, chapter: { subject: { name: 'math' } } },
  })
  const activeMathProblemsWithoutGuidedFlow = await prisma.problem.count({
    where: { isActive: true, chapter: { subject: { name: 'math' } }, guidedSolve: null },
  })
  const result = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    studentFlowChanged: false,
    reviewRequired: true,
    targetProblemCount: candidates.length,
    activeMathProblemCount,
    activeMathProblemsWithoutGuidedFlow,
    drafts: [],
    errors: [],
  }

  for (const problem of candidates) {
    try {
      const draft = await draftForProblem(problem)
      result.drafts.push(draft)
      console.log(`Drafted ${draft.lessons.length} steps for ${draft.problemId} (${draft.chapter}).`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.errors.push({ problemId: problem.id, problemText: problem.rawText, error: message })
      console.error(`Could not draft ${problem.id}: ${message}`)
    }
  }

  const outputDirectory = join(process.cwd(), 'scripts', 'data', 'prerequisite-drafts')
  await mkdir(outputDirectory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = join(outputDirectory, `prerequisite-drafts-${stamp}.json`)
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`Saved review-only drafts to ${outputPath}`)
  console.log(`Drafts: ${result.drafts.length}; failed batches: ${result.errors.length}. No live prerequisite content was changed.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
