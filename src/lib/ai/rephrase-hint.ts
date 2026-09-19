import OpenAI from 'openai'
import { PrismaClient, AiCallType } from '@prisma/client'

const openai = new OpenAI() // reads OPENAI_API_KEY from env
const prisma = new PrismaClient()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'hint-rephrase-v1'

// Called only when a student has missed the SAME annotation more than
// once. This is a narrow, low-risk LLM use: it rewrites an already
// human-authored, factually-correct hint in different words — it does
// NOT grade the student, does NOT invent new content, and cannot
// introduce a wrong answer, because the underlying fact (hintText) is
// fixed. Scope is deliberately kept this tight — no open-ended tutor
// chat, no free-form explanation generation.
export async function rephraseHint(params: {
  studentId: string
  sessionId: string
  problemId: string
  originalHint: string
  annotationText: string
  studentWrongAnswer: string
  attemptNumber: number // 2, 3, ... — how many times they've missed this piece
}): Promise<string> {
  const {
    studentId,
    sessionId,
    problemId,
    originalHint,
    annotationText,
    studentWrongAnswer,
    attemptNumber,
  } = params

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            'You rewrite a hint for a struggling 10th-grade math/physics student who already saw this hint once and got it wrong again. ' +
            'Rules: keep the same underlying fact, do not reveal the answer directly, do not change the meaning, ' +
            'use simpler or more concrete wording than a typical restatement, one or two short sentences maximum, ' +
            'warm but plain tone, no exclamation marks, no "great job" filler.',
        },
        {
          role: 'user',
          content:
            `Original hint: "${originalHint}"\n` +
            `The correct piece (do not say this outright): "${annotationText}"\n` +
            `Student's incorrect attempt: "${studentWrongAnswer}"\n` +
            `This is attempt number ${attemptNumber} on this piece.\n\n` +
            `Rewrite the hint differently from the original so it might land better this time.`,
        },
      ],
    })

    responseText = response.choices[0]?.message?.content?.trim() || null
    inputTokens = response.usage?.prompt_tokens
    outputTokens = response.usage?.completion_tokens

    if (!responseText) wasUsed = false // fell back to original hint
  } catch (err) {
    console.error('rephraseHint failed, falling back to original hint:', err)
    wasUsed = false
  }

  const latencyMs = Date.now() - startedAt

  // Log regardless of success/failure — a failed call is still a call,
  // and the cost-governor/observability story needs both to be visible.
  await prisma.aiCall.create({
    data: {
      callType: AiCallType.hint_rephrase,
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

  return responseText || originalHint // fail safe: never block the student
}