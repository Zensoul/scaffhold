import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth-config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Parent/teacher have no real destination yet — honest stub rather
  // than pretending a dashboard exists for them.
  if (session.user.role !== 'student') {
    return (
      <main style={{ maxWidth: 480, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#111', fontSize: '1.05rem' }}>
          {session.user.role === 'parent' ? 'Parent' : 'Teacher'} dashboards aren't available yet —
          check back soon.
        </p>
      </main>
    )
  }

  const studentProfileId = session.user.studentProfileId
  if (!studentProfileId) {
    // Shouldn't happen given the signup transaction, but a real check
    // rather than assuming the shape is always correct.
    redirect('/login')
  }

  const scaffoldingLevels = await prisma.scaffoldingLevel.findMany({
    where: { studentId: studentProfileId },
    include: { chapter: { include: { subject: true } } },
  })

  const pageStyle: React.CSSProperties = {
    maxWidth: 560,
    margin: '0 auto',
    padding: '2rem 1rem',
    color: '#111',
    background: '#fff',
    minHeight: '100vh',
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Welcome back, {session.user.name}
      </h1>

      {scaffoldingLevels.length === 0 && (
        <p style={{ color: '#666' }}>
          You don't have any chapters assigned yet — check back once your teacher sets one up.
        </p>
      )}

      {scaffoldingLevels.map((sl) => (
        <div
          key={sl.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
            {sl.chapter.subject.name}
          </p>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
            {sl.chapter.name}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
            {sl.problemsClean} of {sl.problemsAttempted} problems answered correctly so far
          </p>

          <form action={`/api/sessions/start-and-redirect`} method="POST">
            <input type="hidden" name="chapterId" value={sl.chapterId} />
            <button
              type="submit"
              style={{
                padding: '0.5rem 1rem',
                color: '#fff',
                background: '#2563eb',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              Continue
            </button>
          </form>
        </div>
      ))}
    </main>
  )
}