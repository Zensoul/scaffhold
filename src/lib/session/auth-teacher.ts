import { auth } from '@/lib/auth/auth-config'

// Mirrors auth-stub.ts's getCurrentStudentId, for the teacher side.
// Unlike students, a teacher's identity IS their User.id directly â€”
// there's no separate profile table to resolve, since Teacher isn't
// a distinct model the way StudentProfile is.
export async function getCurrentTeacherId(): Promise<string> {
  const session = await auth()

  if (!session?.user) {
    throw new Error('Not authenticated â€” no active session')
  }

  if (session.user.role !== 'teacher') {
    throw new Error(
      `This action requires a teacher account, but the logged-in user has role "${session.user.role}"`
    )
  }

  if (!session.user.id) {
    throw new Error('Teacher session is missing a user id â€” data integrity issue')
  }

  return session.user.id
}