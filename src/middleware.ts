import { auth } from '@/lib/auth/auth-config'
import { NextResponse } from 'next/server'

// Protects everything under /problems and the home page itself.
// /login, /register, and all /api/auth/* routes are deliberately left
// out of this matcher — those must stay reachable by definition.
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