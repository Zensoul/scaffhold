import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'


export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, email, password } = body as {
    token: string
    email: string
    password: string
  }

  if (!token || !email || !password) {
    return NextResponse.json(
      { error: 'token, email, and password are required' },
      { status: 400 }
    )
  }

  const invite = await prisma.studentInvite.findUnique({ where: { inviteToken: token } })

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }
  if (!invite.consentGiven) {
    // Should never happen given invite creation requires consent, but a
    // real safety check rather than assuming the invariant always holds.
    return NextResponse.json(
      { error: 'This invite is missing required parental consent' },
      { status: 422 }
    )
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // Everything below happens together: creating the account, creating
  // the profile WITH the consent fields already set (copied from the
  // invite, not re-asked of the student, since the student is a minor
  // and cannot re-consent on their own behalf), linking the invite to
  // the parent relationship, and marking the invite consumed. A partial
  // failure here would leave a student account with no valid consent
  // record or, worse, a reusable invite token.
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: invite.childFullName,
        email,
        passwordHash,
        role: Role.student,
      },
    })

    const studentProfile = await tx.studentProfile.create({
      data: {
        userId: user.id,
        grade: invite.childGrade,
        parentId: invite.parentId,
        dpdpConsentGiven: invite.consentGiven,
        dpdpConsentAt: invite.consentGivenAt,
        dpdpConsentVersion: invite.consentTextVersion,
      },
    })

    await tx.studentInvite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        studentProfileId: studentProfile.id,
      },
    })

    return { user, studentProfile }
  })

  return NextResponse.json({
    userId: result.user.id,
    studentProfileId: result.studentProfile.id,
  })
}