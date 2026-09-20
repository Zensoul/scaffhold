import type { NextAuthConfig } from 'next-auth'

// EDGE-SAFE CONFIG ONLY. This file must never import Prisma, bcrypt,
// Node's `crypto` module, or anything else that doesn't run in the Edge
// Runtime — middleware.ts uses this directly, and middleware runs on
// Edge by default in Next.js.
//
// This is the standard Auth.js split pattern for exactly this problem:
// providers/callbacks that need real Node APIs (database calls, jti
// generation) live in auth-config.ts (the "full" config, Node runtime
// only); this file has just enough shape for middleware to check
// "is there a session" without touching the database at all.
export const authConfigEdge: NextAuthConfig = {
  providers: [], // providers are added in the full config, not here
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // Edge-safe check: does a token exist at all. Does NOT check the
    // revocation denylist (that requires Prisma, which cannot run here)
    // — revocation is enforced in the FULL config's jwt callback, which
    // runs on real API/page requests, not in middleware. This means a
    // revoked session can still pass THIS check in middleware, but will
    // be caught and invalidated on the very next actual page/API
    // request that goes through the Node runtime. A brief window, not
    // a security hole: middleware alone was never sufficient to fully
    // gate access in this app anyway (every protected page/route
    // already re-checks auth() itself on the Node runtime).
    authorized({ auth }) {
      return !!auth?.user
    },
  },
}