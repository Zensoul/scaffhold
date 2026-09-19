import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,

  // JWT strategy, not database. This is a deliberate correction: NextAuth
  // v5's Credentials provider does not create database session rows —
  // this is a documented, unresolved limitation in the library itself
  // (see nextauthjs/next-auth issues #12848, #12858, #9636), not a bug
  // in our adapter override. The Prisma adapter is still used for
  // account linking (Google OAuth) and user storage; only the SESSION
  // itself is now a signed JWT in an httpOnly cookie rather than a
  // database row.
  //
  // Trade-off accepted: we lose instant server-side session revocation
  // (a JWT is valid until it expires, even if we "delete" a session
  // server-side) — this matters for the DPDP-consciousness the original
  // architecture doc called for, and is a real gap to revisit later
  // (e.g. a token-blocklist) rather than something quietly solved here.
  session: {
    strategy: 'jwt',
  },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
        }
      },
    }),
  ],

  callbacks: {
    // With JWT strategy, role/studentProfileId must be attached in the
    // jwt callback (which runs on sign-in and token refresh), then
    // copied onto the session in the session callback — this two-step
    // is required because the session callback with JWT strategy
    // receives the TOKEN, not a fresh DB lookup by user id the way
    // database strategy provided.
    async jwt({ token, user }) {
      if (user) {
        // Runs only at sign-in, when `user` is populated.
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { studentProfile: true },
        })
        token.role = dbUser?.role
        token.studentProfileId = dbUser?.studentProfile?.id ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
        session.user.role = token.role as 'student' | 'parent' | 'teacher' | undefined
        session.user.studentProfileId = token.studentProfileId as string | null
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },
})