import { notFound } from 'next/navigation'

type Annotation = {
  id: string
  annotationType: 'unknown' | 'given' | 'implied_given' | 'concept_anchor'
  annotationText: string
  hintText: string
  sequenceOrder: number
}

type Problem = {
  id: string
  rawText: string
  unknownAnnotation: string
  concreteRestatement: string
  problemType: string
  difficultyTier: number
  annotations: Annotation[]
}

const TYPE_LABEL: Record<Annotation['annotationType'], string> = {
  given: 'Given',
  implied_given: 'Implied (not stated directly)',
  unknown: 'What we need to find',
  concept_anchor: 'Concept',
}

async function getProblem(id: string): Promise<Problem | null> {
  // Server component — fetch directly from the route handler.
  // Adjust the base URL for your actual dev/prod host as needed.
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/problems/${id}`, {
    cache: 'no-store',
  })

  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch problem')

  const data = await res.json()
  return data.problem
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const problem = await getProblem(id)

  if (!problem) notFound()

  // Mode 1: fully worked example — everything shown, nothing hidden.
  // Displayed low sequenceOrder -> high, i.e. explicit givens first,
  // implied givens next, the unknown after that, concept anchor last.
  const sorted = [...problem.annotations].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder
  )

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>
        {problem.problemType} · difficulty {problem.difficultyTier}
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Problem
        </h1>
        <p>{problem.rawText}</p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          In plain words
        </h2>
        <p>{problem.concreteRestatement}</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          Decoded, piece by piece
        </h2>
        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sorted.map((a) => (
            <li
              key={a.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: '0.75rem 1rem',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.6, marginBottom: '0.25rem' }}>
                {TYPE_LABEL[a.annotationType]}
              </p>
              <p style={{ marginBottom: '0.25rem' }}>{a.annotationText}</p>
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{a.hintText}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}