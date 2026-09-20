import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth-config'
import { revokeSession } from '@/lib/auth/session-revocation'

export async function POST() {
  const session = await auth()

  if (!session?.user?.jti) {
    return NextResponse.json({ error: 'No active session to revoke' }, { status: 401 })
  }

  await revokeSession({
    jti: session.user.jti,
    userId: session.user.id,
    reason: 'user_initiated_logout',
  })

  return NextResponse.json({ revoked: true })
}