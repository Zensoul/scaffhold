import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'
import { AiCallType } from '@prisma/client'

const openai = new OpenAI()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'comparison-question-v1'

export type ComparisonQuestion = {
  question: string
  options: { id: string; text: string }[]
  correctOptionId: string
  generatedByLLM: boolean
}

// Generates the "what's different between these two?" comparison moment
// shown after a genuinely wrong answer (grading already confirmed via
// gradeAnswer — this function trusts that call, not re-judging it).
//
// SAFETY NOTE: unlike hint-rephrasing (which cannot introduce a wrong
// fact) or grading (which has a known ground truth to check against),
// here the LLM invents both the question AND which option is "correct" —
// there's no independent ground truth for the comparison framing itself.
// To bound that risk: after generating, we verify the model's own
// marked-correct option text is a close match to the real annotation
// text. If that check fails, we DISCARD the LLM's question entirely and
// fall back to a simple deterministic multiple-choice built directly
// from the known-correct annotation text and the student's own wrong
// answer — no invented framing, just the two real texts as options.
export async function generateComparisonQuestion(params: {
  studentId: string
  sessionId: string
  problemId: string
  correctText: string
  studentWrongAnswer: string
}): Promise<ComparisonQuestion> {
  const { studentId, sessionId, problemId, correctText, studentWrongAnswer } = params

  const fallback = buildDeterministicFallback(correctText, studentWrongAnswer)

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true
  let parsed: {
    question: string
    options: { id: string; text: string }[]
    correctOptionId: string
  } | null = null

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 220,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write a short "what is different between these two?" multiple-choice question for a struggling ' +
            '10th-grade math/physics student who just got a piece of a problem wrong. Do not reveal the correct ' +
            'answer directly in the question text — the question should prompt them to notice the difference ' +
            'themselves. Provide exactly 3 options: one that correctly names the real difference, and two ' +
            'plausible-but-wrong distractors. Keep the question and each option to one short sentence. ' +
            'Respond ONLY with JSON in this exact shape: ' +
            '{"question": string, "options": [{"id": "a", "text": string}, {"id": "b", "text": string}, ' +
            '{"id": "c", "text": string}], "correctOptionId": "a" | "b" | "c"}.',
        },
        {
          role: 'user',
          content:
            `The correct piece was: "${correctText}"\n` +
            `The student answered: "${studentWrongAnswer}"\n\n` +
            `Write the comparison question and options.`,
        },
      ],
    })

    responseText = response.choices[0]?.message?.content?.trim() || null
    inputTokens = response.usage?.prompt_tokens
    outputTokens = response.usage?.completion_tokens

    if (responseText) {
      const candidate = JSON.parse(responseText)
      if (
        typeof candidate.question === 'string' &&
        Array.isArray(candidate.options) &&
        candidate.options.length === 3 &&
        candidate.options.every(
          (o: unknown) =>
            typeof o === 'object' &&
            o !== null &&
            typeof (o as { id?: unknown }).id === 'string' &&
            typeof (o as { text?: unknown }).text === 'string'
        ) &&
        typeof candidate.correctOptionId === 'string'
      ) {
        parsed = candidate
      }
    }
  } catch (err) {
    console.error('generateComparisonQuestion LLM call failed:', err)
    wasUsed = false
  }

  let result: ComparisonQuestion

  if (parsed) {
    const markedCorrect = parsed.options.find((o) => o.id === parsed!.correctOptionId)
    const isPlausible =
      markedCorrect && isCloseEnough(markedCorrect.text, correctText)

    if (markedCorrect && isPlausible) {
      result = { ...parsed, generatedByLLM: true }
    } else {
      // Sanity check failed — the LLM's marked-correct option doesn't
      // actually match the real answer closely enough to trust. Discard
      // the whole generated question rather than risk showing a
      // confidently wrong "correct" option.
      console.warn('comparison question failed sanity check, using fallback')
      result = fallback
      wasUsed = false
    }
  } else {
    result = fallback
    wasUsed = false
  }

  const latencyMs = Date.now() - startedAt

  await prisma.aiCall.create({
    data: {
      callType: AiCallType.comparison_question,
      studentId,
      sessionId,
      problemId,
      modelUsed: MODEL,
      promptVersion: PROMPT_VERSION,
      inputTokens,
      outputTokens,
      latencyMs,
      responseText,
      wasUsed,
    },
  })

  return result
}

// Very loose closeness check — not semantic, just enough to catch a
// wildly mismatched correctOptionId (e.g. the model marked a distractor
// as correct). Real semantic verification would need another LLM call,
// which defeats the point of a cheap sanity check; this catches the
// grossest failure mode (completely unrelated text) cheaply.
function isCloseEnough(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const wordsA = new Set(normalize(a).split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(normalize(b).split(/\s+/).filter((w) => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.3
}

// Deterministic fallback: no invented framing, just the two real texts
// as options, plus one neutral distractor. Always safe because both
// substantive options are real, known-correct data (the annotation text
// and the student's own words) — nothing here is an LLM guess.
function buildDeterministicFallback(
  correctText: string,
  studentWrongAnswer: string
): ComparisonQuestion {
  return {
    question: 'Which of these correctly describes this piece of the problem?',
    options: [
      { id: 'a', text: correctText },
      { id: 'b', text: studentWrongAnswer },
      { id: 'c', text: 'Neither of these is related to the problem' },
    ],
    correctOptionId: 'a',
    generatedByLLM: false,
  }
}