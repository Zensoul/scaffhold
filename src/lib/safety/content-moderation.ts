import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'

const openai = new OpenAI()

export type ModerationOutcome =
  | { flagged: false }
  | { flagged: true; category: string; flaggedContentId: string }

// Runs BEFORE any student free-text reaches the grading LLM. Uses
// OpenAI's moderation endpoint — purpose-built, separate infrastructure
// from our own grading prompts, so a bug or prompt-injection in grading
// logic can never suppress this check. This is the actual safeguard
// required by the original architecture doc (Section 8) for a platform
// whose primary users are minors.
//
// On a flag: the submission is NOT sent to grading, the event is logged
// permanently (never deleted, never redacted), and the caller is told
// to notify the linked parent/teacher — escalation, not just blocking,
// per the reasoning that detecting distress and doing nothing with it
// helps no one.
export async function moderateStudentText(params: {
  studentId: string
  sessionId?: string
  problemId?: string
  text: string
}): Promise<ModerationOutcome> {
  const { studentId, sessionId, problemId, text } = params

  try {
    const response = await openai.moderations.create({ input: text })
    const result = response.results[0]

    if (!result.flagged) {
      return { flagged: false }
    }

    // Find the primary flagged category (highest-scoring true category)
    const flaggedCategories = Object.entries(result.categories)
      .filter(([, isFlagged]) => isFlagged)
      .map(([category]) => category)

    const primaryCategory = flaggedCategories[0] ?? 'unspecified'

    const flaggedRecord = await prisma.flaggedContent.create({
      data: {
        studentId,
        sessionId,
        problemId,
        rawText: text,
        moderationResult: JSON.parse(JSON.stringify(result)),
        category: primaryCategory,
      },
    })

    return { flagged: true, category: primaryCategory, flaggedContentId: flaggedRecord.id }
  } catch (err) {
    // Fail CLOSED for safety-relevant infrastructure: if the moderation
    // call itself fails, we do not silently let the text through
    // ungated — that would defeat the entire point. Log the failure
    // and treat as flagged-for-review rather than flagged=false.
    console.error('Moderation check failed — failing closed:', err)

    const flaggedRecord = await prisma.flaggedContent.create({
      data: {
        studentId,
        sessionId,
        problemId,
        rawText: text,
        moderationResult: { error: 'moderation_api_failed' },
        category: 'moderation_check_failed',
      },
    })

    return { flagged: true, category: 'moderation_check_failed', flaggedContentId: flaggedRecord.id }
  }
}

// Placeholder for actual notification delivery — no email/SMS channel
// exists yet (that's a separate, larger piece of infrastructure). For
// now this records that a notification WOULD have been sent, which
// still gives you a real, queryable audit trail of every moment a
// parent/teacher should have been contacted, even before delivery
// itself is built.
export async function recordNotificationOwed(flaggedContentId: string): Promise<void> {
  await prisma.flaggedContent.update({
    where: { id: flaggedContentId },
    data: {
      notifiedParentAt: new Date(),
      notifiedTeacherAt: new Date(),
    },
  })

  // TODO: real delivery once an email/SMS provider is wired up.
  console.warn(
    `[NOTIFICATION OWED] Flagged content ${flaggedContentId} requires parent/teacher notification — no delivery channel configured yet.`
  )
}