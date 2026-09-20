import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { isSessionRevoked } from '@/lib/auth/session-revocation'
import { authConfigEdge } from '@/lib/auth/auth-config-edge'

// This file is the FULL config — Node runtime only (API routes, server
// components, route handlers). It must never be imported by
// middleware.ts directly; middleware uses authConfigEdge instead. This
// file extends that Edge-safe base with everything that needs real
// Node APIs: Prisma (database), bcrypt (password hashing), and the
// actual provider/callback logic.
//
// Uses the global Web Crypto API (crypto.randomUUID(), available as a
// global in both Node and Edge runtimes) instead of importing Node's
// `crypto` module — that import was what originally broke the Edge
// build, even before Prisma calls were added.

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfigEdge,

  adapter: PrismaAdapter(prisma) as any,

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
    ...authConfigEdge.callbacks,

    async jwt({ token, user }) {
      if (user) {
        token.jti = crypto.randomUUID()

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { studentProfile: true },
        })
        token.role = dbUser?.role
        token.studentProfileId = dbUser?.studentProfile?.id ?? null
        return token
      }

      if (token.jti && (await isSessionRevoked(token.jti as string))) {
        return null
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
        session.user.role = token.role as 'student' | 'parent' | 'teacher' | undefined
        session.user.studentProfileId = token.studentProfileId as string | null
        session.user.jti = token.jti as string
      }
      return session
    },
  },
})