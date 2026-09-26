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

const ROLE_HOME: Record<'student' | 'teacher' | 'parent', string> = {
  student: '/student-dashboard',
  teacher: '/teacher-dashboard',
  parent: '/dashboard',
}

// Every route below requires a logged-in session at all. Role-specific
// routes are also checked against the session's role, so a student who
// wanders onto /teacher-dashboard (or a forged/stale bookmark) gets
// redirected straight to their own home instead of hitting a page that
// silently 500s or shows a raw "not authorized" string — every page
// used to handle this differently (or not at all); now it's one rule.
const ROLE_ROUTE_PREFIXES: Array<{ prefix: string; role: 'student' | 'teacher' | 'parent' }> = [
  { prefix: '/student-dashboard', role: 'student' },
  { prefix: '/problems', role: 'student' },
  { prefix: '/teacher-dashboard', role: 'teacher' },
  { prefix: '/dashboard', role: 'parent' },
  { prefix: '/invite-student', role: 'parent' },
]

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role
  const { pathname } = req.nextUrl

  const isProtectedRoute =
    pathname === '/' ||
    pathname.startsWith('/problems') ||
    pathname.startsWith('/student-dashboard') ||
    pathname.startsWith('/teacher-dashboard') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/invite-student')

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && role) {
    const match = ROLE_ROUTE_PREFIXES.find((r) => pathname.startsWith(r.prefix))
    if (match && match.role !== role) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
    }
  }
})

export const config = {
  matcher: [
    '/',
    '/problems/:path*',
    '/student-dashboard/:path*',
    '/teacher-dashboard/:path*',
    '/dashboard/:path*',
    '/invite-student/:path*',
  ],
}
