import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfigEdge } from '@/lib/auth/auth-config-edge'

// Uses the EDGE-SAFE config only — never the full auth-config.ts, which
// imports Prisma and cannot run in the Edge Runtime that middleware
// executes in by default. This is the standard Auth.js split pattern:
// middleware gets a lightweight "is there a session" check; the actual
// revocation-denylist check happens in the full config's jwt callback,
// which runs on the Node runtime for every real page/API request.
const { auth } = NextAuth(authConfigEdge)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isProtectedRoute = pathname === '/' || pathname.startsWith('/problems')

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ['/', '/problems/:path*'],
}