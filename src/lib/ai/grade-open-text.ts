import OpenAI from 'openai'
import { PrismaClient, AiCallType } from '@prisma/client'

const openai = new OpenAI()
const prisma = new PrismaClient()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'grade-open-text-v1'

// Grades a genuinely open-ended free-text answer against the problem's
// known-correct content — used ONLY in Mode 3, where the student has no
// pre-authored annotation to match against (that's the whole point:
// this measures independent understanding, not fill-in-the-blank recall).
//
// Same conservative posture as gradeAnswer: structured output enforced,
// low confidence treated as "needs review" rather than guessed generously.
// Unlike gradeAnswer, there is no cheap exact-match short-circuit here —
// open text essentially never matches verbatim, so every Mode 3 answer
// goes through the LLM. This is intentional: Mode 3 is lower-volume
// (only reached at high scaffolding levels, once per problem per prompt)
// so the added LLM cost per interaction is acceptable here in a way it
// wouldn't be if applied to every Mode 2 submission.
export async function gradeOpenTextAnswer(params: {
  studentId: string
  sessionId: string
  problemId: string
  promptType: 'restate_unknown' | 'list_givens'
  studentResponse: string
  referenceContent: string // unknownAnnotation text, or a joined summary of givens
}): Promise<{ isCorrect: boolean; feedback: string }> {
  const { studentId, sessionId, problemId, promptType, studentResponse, referenceContent } = params

  const promptDescription =
    promptType === 'restate_unknown'
      ? 'what the problem is asking them to find (the unknown)'
      : 'what information the problem gives them to work with (the givens)'

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true
  let parsed: { isCorrect: boolean; confidence: 'high' | 'low'; feedback: string } | null = null

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 150,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You grade a 10th-grade student's own words describing ${promptDescription}, for a math/physics ` +
            'problem, WITHOUT the student having seen any hints or pre-written annotations for this attempt. ' +
            'Judge whether they correctly identified the substance — exact wording, completeness of phrasing, ' +
            'and minor omissions of secondary detail do not matter; getting the core idea right does. ' +
            'For "list_givens", they should have captured the MAIN given values/facts — missing one minor implied ' +
            'detail is fine, missing a central given is not. ' +
            'Respond ONLY with JSON: {"isCorrect": boolean, "confidence": "high" | "low", "feedback": string}. ' +
            'feedback is one short, warm, specific sentence — if correct, briefly affirm what they got right; ' +
            'if incorrect, name what is missing or off WITHOUT giving away the full correct answer outright. ' +
            'Use "low" confidence when the answer is genuinely ambiguous or partially right — do not guess generously.',
        },
        {
          role: 'user',
          content:
            `The reference content (what the correct answer should capture): "${referenceContent}"\n` +
            `The student wrote: "${studentResponse}"\n\n` +
            `Grade this.`,
        },
      ],
    })

    responseText = response.choices[0]?.message?.content?.trim() || null
    inputTokens = response.usage?.prompt_tokens
    outputTokens = response.usage?.completion_tokens

    if (responseText) {
      const candidate = JSON.parse(responseText)
      if (
        typeof candidate.isCorrect === 'boolean' &&
        (candidate.confidence === 'high' || candidate.confidence === 'low') &&
        typeof candidate.feedback === 'string'
      ) {
        parsed = candidate
      }
    }
  } catch (err) {
    console.error('gradeOpenTextAnswer LLM call failed:', err)
    wasUsed = false
  }

  const latencyMs = Date.now() - startedAt

  await prisma.aiCall.create({
    data: {
      callType: AiCallType.answer_grading,
      studentId,
      sessionId,
      problemId,
      modelUsed: MODEL,
      promptVersion: PROMPT_VERSION,
      inputTokens,
      outputTokens,
      latencyMs,
      responseText,
      wasUsed: wasUsed && parsed !== null,
    },
  })

  // Conservative fallback: no usable result, or low confidence — treat
  // as incorrect rather than falsely validate an ambiguous open answer.
  // Unlike Mode 2 (which can fall back to exact-match), there is no safe
  // deterministic fallback for open text, so "unclear" defaults to "not
  // yet correct" here, with a generic encouraging note rather than a
  // false pass.
  if (!parsed || parsed.confidence === 'low') {
    return {
      isCorrect: false,
      feedback:
        parsed?.feedback ??
        'Have another look — try to say clearly what the problem is asking or giving you.',
    }
  }

  return { isCorrect: parsed.isCorrect, feedback: parsed.feedback }
}