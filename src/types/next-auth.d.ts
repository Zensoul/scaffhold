import { DefaultSession } from 'next-auth'

// Extends NextAuth's built-in Session type so TypeScript knows about
// the extra fields our session callback attaches (role, studentProfileId).
// Without this, accessing session.user.role would be a type error even
// though it works correctly at runtime.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: 'student' | 'parent' | 'teacher'
      studentProfileId?: string | null
      jti?: string
    } & DefaultSession['user']
  }
}