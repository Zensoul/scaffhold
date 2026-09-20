import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth-config'
import { DPDP_CONSENT_VERSION } from '@/lib/legal/dpdp-consent'


const INVITE_EXPIRY_HOURS = 72

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'parent') {
    return NextResponse.json(
      { error: 'Only a logged-in parent can create a student invite' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { childFullName, childGrade, consentAccepted } = body as {
    childFullName: string
    childGrade: number
    consentAccepted: boolean
  }

  if (!childFullName || !childGrade) {
    return NextResponse.json(
      { error: 'childFullName and childGrade are required' },
      { status: 400 }
    )
  }

  if (!consentAccepted) {
    return NextResponse.json(
      { error: 'Consent must be explicitly accepted to create an invite' },
      { status: 400 }
    )
  }

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS)

  // Consent is captured HERE, at invite creation — not deferred to some
  // later step — because this is the moment the parent (the actual
  // consent-giver under DPDP) explicitly agrees, tied to a specific
  // named child, with a timestamp and the exact consent-text version.
  const invite = await prisma.studentInvite.create({
    data: {
      parentId: session.user.id,
      childFullName,
      childGrade,
      consentGiven: true,
      consentGivenAt: new Date(),
      consentTextVersion: DPDP_CONSENT_VERSION,
      expiresAt,
    },
  })

  return NextResponse.json({
    inviteId: invite.id,
    inviteToken: invite.inviteToken,
    expiresAt: invite.expiresAt,
    // The actual link the parent shares with their child.
    inviteUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/register/student?token=${invite.inviteToken}`,
  })
}