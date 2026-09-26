import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'
import { getCurrentTeacherId } from '@/lib/session/auth-teacher'

// Only this teacher's own students — multi-tenancy correctness. A
// teacher must never see or act on another teacher's roster.
export async function GET() {
  const teacherId = await getCurrentTeacherId()

  const students = await prisma.studentProfile.findMany({
    where: { teacherId, isActive: true },
    include: {
      user: { select: { fullName: true } },
      scaffoldingLevels: {
        select: { currentLevel: true, problemsAttempted: true, problemsClean: true },
      },
      chapterAssignments: { select: { chapterId: true } },
    },
    orderBy: { user: { fullName: 'asc' } },
  })

  return NextResponse.json({
    students: students.map((s) => {
      const levels = s.scaffoldingLevels
      const chaptersStarted = levels.filter((l) => l.problemsAttempted > 0).length
      const avgLevel =
        levels.length > 0
          ? levels.reduce((sum, l) => sum + Number(l.currentLevel), 0) / levels.length
          : 0
      const problemsAttempted = levels.reduce((sum, l) => sum + l.problemsAttempted, 0)
      const problemsClean = levels.reduce((sum, l) => sum + l.problemsClean, 0)

      return {
        studentProfileId: s.id,
        fullName: s.user.fullName,
        grade: s.grade,
        board: s.board,
        chaptersAssigned: s.chapterAssignments.length,
        chaptersStarted,
        avgMasteryPct: Math.round(avgLevel * 100),
        problemsAttempted,
        problemsClean,
      }
    }),
  })
}
