import OpenAI from 'openai'
import { prisma } from '@/lib/db/prisma'
import { sendFlaggedContentNotification } from '@/lib/notifications/email-notifications'

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

// Sends a real email notification to the linked parent when content is
// flagged. Replaces the earlier placeholder that only recorded a
// timestamp — this genuinely delivers something to a real person now.
export async function recordNotificationOwed(flaggedContentId: string): Promise<void> {
  const flagged = await prisma.flaggedContent.findUnique({
    where: { id: flaggedContentId },
  })

  if (!flagged) {
    console.error(`Cannot send notification — FlaggedContent ${flaggedContentId} not found`)
    return
  }

  const result = await sendFlaggedContentNotification({
    flaggedContentId,
    studentId: flagged.studentId,
  })

  if (!result.sent) {
    // Do not silently swallow a failed safety notification — this is
    // exactly the failure mode the whole feature exists to prevent.
    console.error(
      `[NOTIFICATION FAILED] Flagged content ${flaggedContentId}: ${result.error}. ` +
      `A human should manually check this student's flagged content.`
    )
  }

  // TODO: teacher notification is a separate, not-yet-built path —
  // requires knowing which teacher is assigned to this student, which
  // the current StudentProfile.teacherId field supports but no
  // notification logic has been built for yet.
}