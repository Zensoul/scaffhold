import { Resend } from 'resend'
import { prisma } from '@/lib/db/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

// Resend's free tier requires no domain verification when sending from
// this address — real for testing tonight. Once you verify your own
// domain in Resend, switch this to something like
// notifications@yourdomain.com for a more trustworthy sender identity.
const FROM_ADDRESS = 'Scaffhold <onboarding@resend.dev>'

export async function sendFlaggedContentNotification(params: {
  flaggedContentId: string
  studentId: string
}): Promise<{ sent: boolean; error?: string }> {
  const { flaggedContentId, studentId } = params

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      parent: true,
    },
  })

  if (!studentProfile) {
    return { sent: false, error: 'Student profile not found' }
  }

  if (!studentProfile.parent?.email) {
    console.error(
      `[NOTIFICATION FAILED] No parent email on file for student ${studentId} — flagged content ${flaggedContentId} could not be delivered to anyone.`
    )
    return { sent: false, error: 'No parent email on file' }
  }

  const studentName = studentProfile.user.fullName

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: studentProfile.parent.email,
      subject: `A note about ${studentName}'s Scaffhold session`,
      html: `
        <p>Hi,</p>
        <p>
          While using Scaffhold, ${studentName} wrote something during a practice
          session that our system flagged as potentially concerning. We haven't
          shown ${studentName} a "wrong answer" for it — instead, they were
          shown a supportive message and a crisis helpline number
          (Tele-MANAS, 14416).
        </p>
        <p>
          We wanted you to know so you can check in with ${studentName}
          directly, in whatever way feels right for your family. This is not
          an automated judgment about what's going on — just us making sure
          a real person in ${studentName}'s life is aware.
        </p>
        <p>
          If you have any questions, you're welcome to reach out to us.
        </p>
        <p>— The Scaffhold team</p>
      `,
    })

    await prisma.flaggedContent.update({
      where: { id: flaggedContentId },
      data: { notifiedParentAt: new Date() },
    })

    return { sent: true }
  } catch (err) {
    console.error('Failed to send flagged-content notification email:', err)
    return { sent: false, error: 'Email delivery failed' }
  }
}