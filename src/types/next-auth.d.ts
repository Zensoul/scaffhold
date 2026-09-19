import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: 'student' | 'parent' | 'teacher'
      studentProfileId?: string | null
    } & DefaultSession['user']
  }
}