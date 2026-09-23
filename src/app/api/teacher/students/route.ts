import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'
import { getCurrentTeacherId } from '@/lib/session/auth-teacher'

// Only this teacher's own students â€” multi-tenancy correctness. A
// teacher must never see or act on another teacher's roster.
export async function GET() {
  const teacherId = await getCurrentTeacherId()

  const students = await prisma.studentProfile.findMany({
    where: { teacherId, isActive: true },
    include: { user: { select: { fullName: true } } },
    orderBy: { user: { fullName: 'asc' } },
  })

  return NextResponse.json({
    students: students.map((s) => ({
      studentProfileId: s.id,
      fullName: s.user.fullName,
      grade: s.grade,
      board: s.board,
    })),
  })
}