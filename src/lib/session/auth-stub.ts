import { auth } from '@/lib/auth/auth-config'

// Real implementation, replacing the DEV_STUBBED_STUDENT_ID stub.
// Every route that calls getCurrentStudentId() is unchanged — this is
// exactly the swap-in the original stub was designed for.
export async function getCurrentStudentId(): Promise<string> {
  const session = await auth()

  if (!session?.user) {
    throw new Error('Not authenticated — no active session')
  }

  if (session.user.role !== 'student') {
    throw new Error(
      `This action requires a student account, but the logged-in user has role "${session.user.role}"`
    )
  }

  if (!session.user.studentProfileId) {
    // A user with role=student but no StudentProfile would be a broken
    // account — shouldn't happen given the signup transaction, but this
    // is a real safety check rather than trusting the shape blindly.
    throw new Error('Student account is missing a StudentProfile — data integrity issue')
  }

  return session.user.studentProfileId
}