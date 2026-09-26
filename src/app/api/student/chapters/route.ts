import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentStudentId } from '@/lib/session/auth-stub'

export async function GET() {
  const studentId = await getCurrentStudentId()

  const assignments = await prisma.chapterAssignment.findMany({
    where: { studentId },
    include: {
      chapter: { include: { subject: true } },
    },
    orderBy: { chapter: { sequenceNumber: 'asc' } },
  })

  const chapterIds = assignments.map((a) => a.chapterId)

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

  const levelByChapter = new Map(levels.map((l) => [l.chapterId, l]))
  const sessionsByChapter = new Map<string, typeof recentSessions>()
  for (const s of recentSessions) {
    const list = sessionsByChapter.get(s.chapterId) ?? []
    if (list.length < 3) list.push(s)
    sessionsByChapter.set(s.chapterId, list)
  }

  const chapters = assignments.map((a) => {
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
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        endReason: s.endReason,
        problemsAttempted: s.problemsAttempted,
      })),
    }
  })

  return NextResponse.json({ chapters })
}