import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'
import { AiCallType } from '@prisma/client'

const openai = new OpenAI()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'grade-answer-v2'

function exactMatch(studentResponse: string, correctText: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase()
  return normalize(studentResponse) === normalize(correctText)
}

// When correctText is a paragraph-style worked solution (e.g. contains
// "Step 1:", multiple "=" signs, or is very long), the student's short
// numeric answer should be compared against only the FINAL numeric result,
// not the whole worked explanation. This extracts that final value so the
// grader doesn't penalise a correct numeric answer for not matching prose.
function extractFinalAnswer(text: string): string {
  const looksLikeParagraph =
    /step\s*\d/i.test(text) ||
    (text.match(/=/g) || []).length >= 3 ||
    text.length > 120

  if (!looksLikeParagraph) return text

  // Prefer the last numeric+unit token (e.g. "231 cm²", "220/7 cm")
  const numericPattern = /[\d/]+\.?\d*\s*(?:cm²|cm|m²|m|km|°|rad|sq\s*\w+)/gi
  const matches = text.match(numericPattern)
  if (matches && matches.length > 0) return matches[matches.length - 1].trim()

  // Fall back to last sentence
  const sentences = text.split(/[.;]/).map((s) => s.trim()).filter(Boolean)
  return sentences[sentences.length - 1] || text
}

// Structured-output grading: the model returns ONLY a fixed JSON shape,
// enforced via response_format, never freeform prose to parse.
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

  // Also try exact match against just the final answer when correctText
  // is a long worked solution — avoids needless LLM calls for correct
  // short answers like "231 cm²" when correctText is a full paragraph.
  const finalAnswer = extractFinalAnswer(correctText)
  if (finalAnswer !== correctText && exactMatch(studentResponse, finalAnswer)) {
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
            'for a math/physics problem-decoding exercise. Judge MEANING, not exact wording. Rules:\n' +
            '1. Numeric values within 0.1 of each other AND the same unit are correct ' +
            '   (e.g. "31.42 cm" vs "31.43 cm" → correct; "31.42 cm²" vs "31.43 cm" → WRONG — different units).\n' +
            '2. cm and cm² are DIFFERENT units — never treat them as the same.\n' +
            '3. A fraction and its decimal equivalent are the same (e.g. "220/7 cm" and "31.43 cm" → correct).\n' +
            '4. Only mark correct if the core quantity genuinely matches. ' +
            'Be strict on units. ' +
            'Respond ONLY with JSON: {"isCorrect": boolean, "confidence": "high" | "low"}. ' +
            'Use "low" confidence whenever the answer is ambiguous, partially right, or you are unsure.',
        },
        {
          role: 'user',
          content:
            `Correct answer: "${finalAnswer}"\n` +
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
