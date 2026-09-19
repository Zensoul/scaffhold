import OpenAI from 'openai'
import { PrismaClient, AiCallType, EndReason } from '@prisma/client'

const openai = new OpenAI()
const prisma = new PrismaClient()

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'session-end-v1'

// Generates the closing statement a student sees when a session ends —
// whether by hitting the 15-minute cap or the consecutive-failure limit.
// Inputs are purely numerical/factual (counts, reason) — no student
// free-text is sent to the model, keeping this a low-risk, low-PII call.
//
// This statement must be specific and true, never generic praise and
// never "keep trying" pressure — see the product design rationale: a
// session ending on compounding failure needs an honest, calm close,
// not encouragement that rings hollow.
export async function generateSessionEndStatement(params: {
  studentId: string
  sessionId: string
  reason: EndReason
  problemsAttempted: number
  problemsClean: number
}): Promise<string> {
  const { studentId, sessionId, reason, problemsAttempted, problemsClean } = params

  const fallback =
    problemsClean > 0
      ? `You correctly identified ${problemsClean} out of ${problemsAttempted} today. That's what we're building on. Come back tomorrow.`
      : `That was a tough session. Come back tomorrow and we'll try again.`

  const startedAt = Date.now()
  let responseText: string | null = null
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let wasUsed = true

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content:
            'You write a short closing message for a struggling 10th-grade math/physics student ending a study session. ' +
            'Rules: state a specific, true fact about what they did this session (do not exaggerate or add unearned praise). ' +
            'Never say "keep trying" or "you can do it" or similar generic encouragement. ' +
            'If the session ended because of repeated wrong answers, do not mention that reason directly or dwell on failure — ' +
            'just state the true positive count (even if it is zero attempts correct) calmly, and invite them back tomorrow. ' +
            'One or two short sentences. No exclamation marks. Warm but plain, not cheerful.',
        },
        {
          role: 'user',
          content:
            `Session ended. Reason: ${reason}. ` +
            `Problems attempted: ${problemsAttempted}. Problems answered correctly: ${problemsClean}.\n\n` +
            `Write the closing message.`,
        },
      ],
    })

    responseText = response.choices[0]?.message?.content?.trim() || null
    inputTokens = response.usage?.prompt_tokens
    outputTokens = response.usage?.completion_tokens

    if (!responseText) wasUsed = false
  } catch (err) {
    console.error('generateSessionEndStatement failed, using fallback:', err)
    wasUsed = false
  }

  const latencyMs = Date.now() - startedAt

  await prisma.aiCall.create({
    data: {
      callType: AiCallType.session_end_statement,
      studentId,
      sessionId,
      modelUsed: MODEL,
      promptVersion: PROMPT_VERSION,
      inputTokens,
      outputTokens,
      latencyMs,
      responseText,
      wasUsed,
    },
  })

  return responseText || fallback
}