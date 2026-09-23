'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ContentPage } from '@/components/shared/page-layout'

type Annotation = {
  id: string
  annotationType: 'unknown' | 'given' | 'implied_given' | 'concept_anchor'
  annotationText: string
  hintText: string
  sequenceOrder: number
}

type Mode1Response = {
  problem: {
    id: string
    rawText: string
    concreteRestatement: string
    problemType: string
    difficultyTier: number
  }
  annotations: Annotation[]
  chapterId: string
}

const TYPE_LABEL: Record<string, string> = {
  given: 'Given',
  implied_given: 'Implied (not stated directly)',
  unknown: 'What we need to find',
  concept_anchor: 'Concept',
}

export default function Mode1Page() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('sessionId')

  const [data, setData] = useState<Mode1Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProblem = useCallback(() => {
    if (!sessionId) {
      setError('Missing sessionId in URL (?sessionId=...)')
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/problems/${id}/mode1?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load problem')
        return res.json()
      })
      .then((json: Mode1Response) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, sessionId])

  useEffect(() => {
    loadProblem()
  }, [loadProblem])

  function handleContinueToMode2() {
    if (!sessionId) return
    router.push(`/problems/${id}/mode2?sessionId=${sessionId}`)
  }

  if (loading) return <ContentPage maxWidth={640}>Loading...</ContentPage>
  if (error) return <ContentPage maxWidth={640}><span style={{ color: 'crimson' }}>{error}</span></ContentPage>
  if (!data) return null

  const sorted = [...data.annotations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)

  return (
    <ContentPage maxWidth={640}>
      <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem' }}>
        Let's work through this one together
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
          Problem
        </h1>
        <p style={{ color: '#111' }}>{data.problem.rawText}</p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
          In plain words
        </h2>
        <p style={{ color: '#111' }}>{data.problem.concreteRestatement}</p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111' }}>
          Here's how to break it down
        </h2>

        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sorted.map((a) => (
            <li
              key={a.id}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', background: '#fff' }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', marginBottom: '0.25rem' }}>
                {TYPE_LABEL[a.annotationType]}
              </p>
              <p style={{ color: '#111' }}>{a.annotationText}</p>
            </li>
          ))}
        </ol>
      </section>

      <button
        onClick={handleContinueToMode2}
        style={{
          padding: '0.6rem 1.25rem',
          color: '#fff',
          background: '#2563eb',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Now let's try one together
      </button>
    </ContentPage>
  )
}