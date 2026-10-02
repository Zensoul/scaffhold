import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth-config'
import { fetchStudentChapters } from '@/lib/data/student-chapters'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function StudentDashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/student-dashboard')
  }

  if (session.user.role !== 'student' || !session.user.studentProfileId) {
    redirect('/login?callbackUrl=/student-dashboard')
  }

  const chapters = await fetchStudentChapters(session.user.studentProfileId)
  const firstName = session.user.name?.split(' ')[0]

  return <DashboardClient chapters={chapters} firstName={firstName} />
}
