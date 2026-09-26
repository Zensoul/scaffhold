import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth-config'

// Pure role router. This used to duplicate /student-dashboard's chapter
// list with its own, different progress-state logic (not_started /
// in_progress / going_well / revisit_together) -- two competing
// implementations of the same screen drifting apart over time. That
// logic is retired; /student-dashboard is the single real
// implementation, kept up to date and tested end-to-end. This page's
// only job now is "send you to your role's home."
export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  switch (session.user.role) {
    case 'student':
      redirect('/student-dashboard')
    case 'parent':
      redirect('/dashboard')
    case 'teacher':
      redirect('/teacher-dashboard')
    default:
      redirect('/login')
  }
}
