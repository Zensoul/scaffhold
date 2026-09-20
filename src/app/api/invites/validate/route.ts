import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'


export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const invite = await prisma.studentInvite.findUnique({
    where: { inviteToken: token },
  })

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  return NextResponse.json({
    childFullName: invite.childFullName,
    childGrade: invite.childGrade,
  })
}