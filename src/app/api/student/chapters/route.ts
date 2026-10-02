import { NextResponse } from 'next/server'
import { getCurrentStudentId } from '@/lib/session/auth-stub'
import { fetchStudentChapters } from '@/lib/data/student-chapters'

export const dynamic = 'force-dynamic'

export async function GET() {
  const studentId = await getCurrentStudentId()
  const chapters = await fetchStudentChapters(studentId)
  return NextResponse.json({ chapters })
}
