import { PrismaClient } from '@prisma/client'

// Standard Next.js + Prisma singleton pattern. Without this, every route
// file's own `const prisma = new PrismaClient()` creates a SEPARATE
// client — and in Next.js dev mode especially (hot module reloading),
// this multiplies fast, each holding its own connections against
// Supabase's pooler. On a Nano-tier project with only 15 backend
// connections available, this is very likely the actual cause of the
// severe, unpredictable slowness observed tonight — not an LLM call,
// not a code bug in any single route, but connection pool exhaustion
// from having far too many independent PrismaClient instances.
//
// The fix: one client, reused everywhere, stored on the global object
// in development so hot-reloads don't spawn a fresh one on every file
// change.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}