import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth-config'
import { prisma } from '@/lib/db/prisma'
import { ContentPage } from '@/components/shared/page-layout'
import { DataControls } from '@/components/parent/data-controls'

export default async function ParentDashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'parent') {
    return (
      <ContentPage maxWidth={480}>
        <p style={{ color: '#111', textAlign: 'center' }}>
          This page is only available to parent accounts.
        </p>
      </ContentPage>
    )
  }

  const children = await prisma.studentProfile.findMany({
    where: { parentId: session.user.id },
    include: {
      user: true,
      scaffoldingLevels: {
        include: {
          chapter: { include: { subject: true } },
        },
      },
    },
  })

  return (
    <ContentPage maxWidth={640}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Your children
      </h1>

      {children.length === 0 && (
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          You haven't added a child yet.
        </p>
      )}

      {children.map((child) => (
        <div
          key={child.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111' }}>
            {child.user.fullName}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem' }}>
            Grade {child.grade} · Consent {child.dpdpConsentGiven ? 'confirmed' : 'not yet given'}
          </p>

          {child.scaffoldingLevels.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: '#999' }}>
              No chapters started yet.
            </p>
          )}

          {child.scaffoldingLevels.map((sl) => (
            <div
              key={sl.id}
              style={{
                borderTop: '1px solid #eee',
                paddingTop: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              <p style={{ fontSize: '0.75rem', color: '#666' }}>
                {sl.chapter.subject.name} — {sl.chapter.name}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#111' }}>
                {sl.problemsClean} of {sl.problemsAttempted} problems answered correctly
              </p>
            </div>
          ))}

          <DataControls studentProfileId={child.id} childName={child.user.fullName} />
        </div>
      ))}

      <a
        href="/invite-student"
        style={{
          display: 'inline-block',
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          color: '#fff',
          background: '#2563eb',
          borderRadius: 4,
          textDecoration: 'none',
          fontSize: '0.95rem',
        }}
      >
        Add another child
      </a>
    </ContentPage>
  )
}