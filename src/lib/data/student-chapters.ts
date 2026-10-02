import { prisma } from '@/lib/db/prisma'

export type SessionSummary = {
  id: string
  startedAt: string
  endedAt: string | null
  endReason: string | null
  problemsAttempted: number
}

export type ChapterRow = {
  chapterId: string
  name: string
  subjectName: string
  sequenceNumber: number
  currentLevel: number
  problemsAttempted: number
  problemsClean: number
  hasStarted: boolean
  recentSessions: SessionSummary[]
}

export async function fetchStudentChapters(studentId: string): Promise<ChapterRow[]> {
  const t0 = Date.now()

  const assignments = await prisma.chapterAssignment.findMany({
    where: { studentId },
    include: {
      chapter: { include: { subject: true } },
    },
    orderBy: { chapter: { sequenceNumber: 'asc' } },
  })
  console.log(`[fetchStudentChapters] assignments query: ${Date.now() - t0}ms (${assignments.length} rows)`)

  const chapterIds = assignments.map((a) => a.chapterId)

  const tParallel = Date.now()
  const [levels, recentSessions] = await Promise.all([
    prisma.scaffoldingLevel.findMany({
      where: { studentId, chapterId: { in: chapterIds } },
    }),
    prisma.session.findMany({
      where: { studentId, chapterId: { in: chapterIds } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
  ])
  console.log(`[fetchStudentChapters] levels+sessions parallel: ${Date.now() - tParallel}ms`)
  console.log(`[fetchStudentChapters] total: ${Date.now() - t0}ms`)

  const levelByChapter = new Map(levels.map((l) => [l.chapterId, l]))
  const sessionsByChapter = new Map<string, typeof recentSessions>()
  for (const s of recentSessions) {
    const list = sessionsByChapter.get(s.chapterId) ?? []
    if (list.length < 3) list.push(s)
    sessionsByChapter.set(s.chapterId, list)
  }

  return assignments.map((a) => {
    const level = levelByChapter.get(a.chapterId)
    const sessions = sessionsByChapter.get(a.chapterId) ?? []

    return {
      chapterId: a.chapterId,
      name: a.chapter.name,
      subjectName: a.chapter.subject.name,
      sequenceNumber: a.chapter.sequenceNumber,
      currentLevel: level ? Number(level.currentLevel) : 0,
      problemsAttempted: level?.problemsAttempted ?? 0,
      problemsClean: level?.problemsClean ?? 0,
      hasStarted: !!level && level.problemsAttempted > 0,
      recentSessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        endReason: s.endReason,
        problemsAttempted: s.problemsAttempted,
      })),
    }
  })
}
