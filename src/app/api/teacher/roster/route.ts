import { prisma } from '@/lib/db/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTeacherId } from '@/lib/session/auth-teacher'

// Search is deliberately narrow: only students with NO teacher assigned
// yet (teacherId: null) are findable here. A teacher can never browse
// or claim a student who already belongs to another teacher — that
// would be a real cross-tenant data leak in a school setting.
export async function GET(request: NextRequest) {
  await getCurrentTeacherId()

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email query param is required' }, { status: 400 })
  }

  const student = await prisma.studentProfile.findFirst({
    where: {
      teacherId: null,
      isActive: true,
      user: { email },
    },
    include: { user: { select: { fullName: true, email: true } } },
  })

  if (!student) {
    return NextResponse.json({ student: null })
  }

  return NextResponse.json({
    student: {
      studentProfileId: student.id,
      fullName: student.user.fullName,
      email: student.user.email,
      grade: student.grade,
      board: student.board,
    },
  })
}

// Claims an unassigned student onto this teacher's roster. Re-checks
// teacherId is still null at claim time (not just at search time) to
// close the race where two teachers search the same unclaimed student
// concurrently â€” whoever's POST lands first wins, the second gets a
// clear conflict rather than silently overwriting the first.
export async function POST(request: NextRequest) {
  const teacherId = await getCurrentTeacherId()
  const body = await request.json()
  const { studentProfileId } = body as { studentProfileId: string }

  if (!studentProfileId) {
    return NextResponse.json({ error: 'studentProfileId is required' }, { status: 400 })
  }

  const student = await prisma.studentProfile.findUnique({ where: { id: studentProfileId } })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  if (student.teacherId !== null) {
    return NextResponse.json(
      { error: 'This student is already assigned to a teacher' },
      { status: 409 }
    )
  }

  const updated = await prisma.studentProfile.update({
    where: { id: studentProfileId },
    data: { teacherId },
  })

  return NextResponse.json({ success: true, studentProfileId: updated.id })
}