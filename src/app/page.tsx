import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth-config'
import { prisma } from '@/lib/db/prisma'
import { ContentPage } from '@/components/shared/page-layout'

type ChapterProgress = 'not_started' | 'in_progress' | 'going_well' | 'revisit_together'

const PROGRESS_LABEL: Record<ChapterProgress, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  going_well: 'Going well',
  revisit_together: "Let's revisit this together",
}

const PROGRESS_COLOR: Record<ChapterProgress, string> = {
  not_started: '#ccc',
  in_progress: '#f59e0b',
  going_well: '#16a34a',
  revisit_together: '#b45309',
}

function toProgressState(
  scaffoldingLevel: { problemsAttempted: number; consecutiveFailures: number; currentLevel: unknown } | null
): ChapterProgress {
  if (!scaffoldingLevel || scaffoldingLevel.problemsAttempted === 0) {
    return 'not_started'
  }
  if (scaffoldingLevel.consecutiveFailures >= 2) {
    return 'revisit_together'
  }
  const level = Number(scaffoldingLevel.currentLevel)
  if (level > 0.6) {
    return 'going_well'
  }
  return 'in_progress'
}

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'student') {
    if (session.user.role === 'parent') {
      redirect('/dashboard')
    }
    if (session.user.role === 'teacher') {
      redirect('/teacher-dashboard')
    }
    return (
      <ContentPage maxWidth={480}>
        <p style={{ color: '#111', fontSize: '1.05rem', textAlign: 'center' }}>
          This account type isn't supported yet — check back soon.
        </p>
      </ContentPage>
    )
  }

  const studentProfileId = session.user.studentProfileId
  if (!studentProfileId) {
    redirect('/login')
  }

  // Assigned chapters drive the list now, not ScaffoldingLevel rows —
  // a chapter the teacher assigned but the student hasn't started yet
  // still needs to show up, and ScaffoldingLevel doesn't exist until a
  // session begins.
  const assignments = await prisma.chapterAssignment.findMany({
    where: { studentId: studentProfileId },
    include: { chapter: { include: { subject: true } } },
    orderBy: { chapter: { sequenceNumber: 'asc' } },
  })

  const scaffoldingLevels = await prisma.scaffoldingLevel.findMany({
    where: { studentId: studentProfileId, chapterId: { in: assignments.map((a) => a.chapterId) } },
  })
  const levelByChapter = new Map(scaffoldingLevels.map((sl) => [sl.chapterId, sl]))

  return (
    <ContentPage maxWidth={560}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Welcome back, {session.user.name}
      </h1>

      {assignments.length === 0 && (
        <p style={{ color: '#666' }}>
          You don't have any chapters assigned yet — check back once your teacher sets one up.
        </p>
      )}

      {assignments.map((a) => {
        const progress = toProgressState(levelByChapter.get(a.chapterId) ?? null)
        return (
          <div
            key={a.chapterId}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
              {a.chapter.subject.name}
            </p>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
              {a.chapter.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: PROGRESS_COLOR[progress],
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#666' }}>{PROGRESS_LABEL[progress]}</span>
            </div>

            <form action="/api/sessions/start-and-redirect" method="POST">
              <input type="hidden" name="chapterId" value={a.chapterId} />
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
                {progress === 'not_started' ? 'Start' : 'Continue'}
              </button>
            </form>
          </div>
        )
      })}
    </ContentPage>
  )
}