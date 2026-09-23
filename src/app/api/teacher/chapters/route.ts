import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTeacherId } from '@/lib/session/auth-teacher'

// Chapters filtered to a specific student's grade/board, so a teacher
// can't accidentally assign a Class 9 chapter to a Class 10 student.
// studentProfileId is required and re-validated against this teacher's
// own roster server-side — never trust a client-supplied grade/board
// directly, since that would let a teacher (or a forged request) pull
// chapters for a student they don't actually teach.
export async function GET(request: NextRequest) {
  const teacherId = await getCurrentTeacherId()
  const studentProfileId = request.nextUrl.searchParams.get('studentProfileId')

  if (!studentProfileId) {
    return NextResponse.json({ error: 'studentProfileId query param is required' }, { status: 400 })
  }

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
  })

  if (!student || student.teacherId !== teacherId) {
    return NextResponse.json({ error: 'Student not found in your roster' }, { status: 404 })
  }

  const chapters = await prisma.chapter.findMany({
    where: {
      isActive: true,
      subject: { grade: student.grade, board: student.board },
    },
    include: { subject: true },
    orderBy: { sequenceNumber: 'asc' },
  })

  const existingAssignments = await prisma.chapterAssignment.findMany({
    where: { studentId: studentProfileId },
    include: { assigner: { select: { fullName: true } } },
  })

  const assignmentByChapter = new Map(existingAssignments.map((a) => [a.chapterId, a]))

  return NextResponse.json({
    chapters: chapters.map((c) => {
      const assignment = assignmentByChapter.get(c.id)
      return {
        chapterId: c.id,
        name: c.name,
        subjectName: c.subject.name,
        sequenceNumber: c.sequenceNumber,
        assigned: !!assignment,
        assignedByName: assignment?.assigner.fullName ?? null,
        assignedAt: assignment?.assignedAt ?? null,
      }
    }),
  })
}