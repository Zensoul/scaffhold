import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTeacherId } from '@/lib/session/auth-teacher'

// Shared ownership check: a teacher may only assign/unassign chapters
// for students on their own roster. Re-verified server-side on every
// call, never trusted from the client.
async function assertOwnsStudent(teacherId: string, studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
  })

  if (!student || student.teacherId !== teacherId) {
    throw new Error('NOT_YOUR_STUDENT')
  }
}

export async function POST(request: NextRequest) {
  const teacherId = await getCurrentTeacherId()
  const body = await request.json()
  const { studentProfileId, chapterId } = body as { studentProfileId: string; chapterId: string }

  if (!studentProfileId || !chapterId) {
    return NextResponse.json(
      { error: 'studentProfileId and chapterId are required' },
      { status: 400 }
    )
  }

  try {
    await assertOwnsStudent(teacherId, studentProfileId)
  } catch {
    return NextResponse.json({ error: 'Student not found in your roster' }, { status: 404 })
  }

  const assignment = await prisma.chapterAssignment.upsert({
    where: { studentId_chapterId: { studentId: studentProfileId, chapterId } },
    update: {},
    create: { studentId: studentProfileId, chapterId, assignedBy: teacherId },
  })

  return NextResponse.json({ assignment })
}

export async function DELETE(request: NextRequest) {
  const teacherId = await getCurrentTeacherId()
  const studentProfileId = request.nextUrl.searchParams.get('studentProfileId')
  const chapterId = request.nextUrl.searchParams.get('chapterId')

  if (!studentProfileId || !chapterId) {
    return NextResponse.json(
      { error: 'studentProfileId and chapterId query params are required' },
      { status: 400 }
    )
  }

  try {
    await assertOwnsStudent(teacherId, studentProfileId)
  } catch {
    return NextResponse.json({ error: 'Student not found in your roster' }, { status: 404 })
  }

  await prisma.chapterAssignment.deleteMany({
    where: { studentId: studentProfileId, chapterId },
  })

  return NextResponse.json({ success: true })
}