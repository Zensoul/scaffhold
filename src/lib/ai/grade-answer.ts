import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'
import { AiCallType } from '@prisma/client'

const openai = new OpenAI()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'grade-answer-v1'

function exactMatch(studentResponse: string, correctText: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase()
  return normalize(studentResponse) === normalize(correctText)
}

// Structured-output grading: the model returns ONLY a fixed JSON shape,
// enforced via response_format, never freeform prose to parse. This
// mirrors the architecture principle that a schema violation should be
// rejected/retried, never silently coerced.
//
// Deliberately conservative: a "low" confidence verdict is treated as
// NOT correct regardless of what isCorrect says, falling back to exact
// match instead. Grading is the highest-risk LLM use in this product —
// a false "correct" or false "incorrect" lands directly on a student who
// has no way to independently verify it. When in doubt, this function
// doubts, rather than being generous.
export async function gradeAnswer(params: {
  studentId: string
  sessionId: string
  problemId: string
  annotationId: string
  studentResponse: string
  correctText: string
}): Promise<{ isCorrect: boolean; usedLLM: boolean }> {
  const { studentId, sessionId, problemId, annotationId, studentResponse, correctText } = params

  if (exactMatch(studentResponse, correctText)) {
    return { isCorrect: true, usedLLM: false }
  }

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true
  let result: { isCorrect: boolean; confidence: 'high' | 'low' } | null = null

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 60,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You grade whether a 10th-grade student\'s short answer means the same thing as the correct answer, ' +
            'for a math/physics problem-decoding exercise. Judge MEANING, not exact wording — ' +
            'e.g. "the train\'s distance" and "Total distance = 360 km" do NOT mean the same thing (one names the ' +
            'wrong quantity), but "distance is 360km" and "Total distance = 360 km" DO mean the same thing. ' +
            'Be strict: only mark correct if the core quantity/relationship/concept genuinely matches. ' +
            'Respond ONLY with JSON: {"isCorrect": boolean, "confidence": "high" | "low"}. ' +
            'Use "low" confidence whenever the answer is ambiguous, partially right, or you are unsure — ' +
            'do not guess generously.',
        },
        {
          role: 'user',
          content:
            `Correct answer: "${correctText}"\n` +
            `Student's answer: "${studentResponse}"\n\n` +
            `Do these mean the same thing?`,
        },
      ],
    })

    responseText = response.choices[0]?.message?.content?.trim() || null
    inputTokens = response.usage?.prompt_tokens
    outputTokens = response.usage?.completion_tokens

    if (responseText) {
      try {
        const parsed = JSON.parse(responseText)
        if (
          typeof parsed.isCorrect === 'boolean' &&
          (parsed.confidence === 'high' || parsed.confidence === 'low')
        ) {
          result = parsed
        }
      } catch {
        wasUsed = false
      }
    } else {
      wasUsed = false
    }
  } catch (err) {
    console.error('gradeAnswer LLM call failed, falling back to exact match:', err)
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
      wasUsed: wasUsed && result !== null,
    },
  })

  if (!result || result.confidence === 'low') {
    return { isCorrect: exactMatch(studentResponse, correctText), usedLLM: false }
  }

  return { isCorrect: result.isCorrect, usedLLM: true }
}