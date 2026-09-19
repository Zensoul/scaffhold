import { redirect, notFound } from 'next/navigation'
import { PrismaClient } from '@prisma/client'
import { getCurrentStudentId } from '@/lib/session/auth-stub'

const prisma = new PrismaClient()

const MODE_3_THRESHOLD = 0.8

// Separate route from /problems/[id] (which is the existing, working
// Mode 1 page and must not be touched). Visit THIS route when you want
// the system to decide Mode 2 vs Mode 3 automatically based on
// currentLevel, rather than linking directly to a specific mode.
export default async function ProblemRouterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sessionId?: string }>
}) {
  const { id } = await params
  const { sessionId } = await searchParams

  if (!sessionId) {
    notFound()
  }

  const studentId = await getCurrentStudentId()

  const problem = await prisma.problem.findUnique({ where: { id } })
  if (!problem) {
    notFound()
  }

  const scaffoldingLevel = await prisma.scaffoldingLevel.findUnique({
    where: { studentId_chapterId: { studentId, chapterId: problem.chapterId } },
  })

  const currentLevel = scaffoldingLevel ? Number(scaffoldingLevel.currentLevel) : 0

  const targetMode = currentLevel > MODE_3_THRESHOLD ? 'mode3' : 'mode2'

  redirect(`/problems/${id}/${targetMode}?sessionId=${sessionId}`)
}