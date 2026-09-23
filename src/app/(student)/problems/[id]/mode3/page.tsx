'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ContentPage } from '@/components/shared/page-layout'

type Mode3Response =
  | {
      sessionEnded: false
      problemComplete: false
      problem: { id: string; rawText: string }
      promptType: 'restate_unknown' | 'list_givens'
      promptText: string
    }
  | {
      sessionEnded: false
      problemComplete: true
      problem: { id: string; rawText: string }
    }
  | {
      sessionEnded: true
      reason: string
      statement: string | null
      chapterId: string
    }

export default function Mode3Page() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('sessionId')

  const [data, setData] = useState<Mode3Response | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startingNewSession, setStartingNewSession] = useState(false)

  const loadPrompt = useCallback(() => {
    if (!sessionId) {
      setError('Missing sessionId in URL (?sessionId=...)')
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/problems/${id}/mode3?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load problem')
        return res.json()
      })
      .then((json: Mode3Response) => {
        setData(json)
        setResult(null)
        setAnswer('')
        setStartTime(Date.now())
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, sessionId])

  useEffect(() => {
    loadPrompt()
  }, [loadPrompt])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data || data.sessionEnded || data.problemComplete || !sessionId) return

    const timeOnStepMs = Date.now() - startTime

    const res = await fetch(`/api/problems/${id}/mode3/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptType: data.promptType,
        studentResponse: answer,
        sessionId,
        timeOnStepMs,
      }),
    })

    const json = await res.json()
    setResult(json)
  }

  // Same recovery path as Mode 2: lets the student (or a tester) get past
  // a session-ended screen without manual database editing. forceNew
  // closes the stale session and resets ScaffoldingLevel.consecutiveFailures
  // for this chapter, which otherwise persists and would immediately
  // re-trip the guard on the very next problem fetch.
  async function handleStartNewSession(chapterId: string) {
    setStartingNewSession(true)
    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, forceNew: true }),
      })

      if (!res.ok) {
        setError('Could not start a new session — please try again.')
        return
      }

      const json = await res.json()
      router.push(`/problems/${id}/start?sessionId=${json.session.id}&showExample=true`)
    } finally {
      setStartingNewSession(false)
    }
  }

  if (loading) return <ContentPage maxWidth={640}>Loading...</ContentPage>
  if (error) return <ContentPage maxWidth={640}><span style={{ color: 'crimson' }}>{error}</span></ContentPage>
  if (!data) return null

  if (data.sessionEnded) {
    return (
      <ContentPage maxWidth={640}>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1.5rem', textAlign: 'center', marginTop: '3rem' }}>
          <p style={{ fontSize: '1.05rem', color: '#111', marginBottom: '1rem' }}>
            {data.statement ?? 'That session is complete. Come back tomorrow.'}
          </p>

          <button
            onClick={() => handleStartNewSession(data.chapterId)}
            disabled={startingNewSession}
            style={{
              padding: '0.5rem 1.25rem',
              color: '#fff',
              background: '#2563eb',
              border: 'none',
              borderRadius: 4,
              cursor: startingNewSession ? 'default' : 'pointer',
              fontSize: '1rem',
              opacity: startingNewSession ? 0.7 : 1,
            }}
          >
            {startingNewSession
              ? 'Starting...'
              : data.reason === 'consecutive_failures'
              ? 'Take a breath and try again'
              : 'Start a new session'}
          </button>
        </div>
      </ContentPage>
    )
  }

  if (data.problemComplete) {
    return (
      <ContentPage maxWidth={640}>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1.5rem', textAlign: 'center', marginTop: '3rem' }}>
          <p style={{ fontSize: '1.05rem', color: '#16a34a', fontWeight: 600 }}>
            You worked through this one on your own.
          </p>
        </div>
      </ContentPage>
    )
  }

  return (
    <ContentPage maxWidth={640}>
      <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem' }}>Working independently</p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
          Problem
        </h1>
        <p style={{ color: '#111' }}>{data.problem.rawText}</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111' }}>
          {data.promptText}
        </h2>

        {!result && (
          <form onSubmit={handleSubmit}>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer in your own words..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.6rem',
                marginBottom: '0.75rem',
                fontSize: '1rem',
                color: '#111',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 4,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              autoFocus
            />
            <button
              type="submit"
              style={{
                padding: '0.5rem 1rem',
                color: '#fff',
                background: '#2563eb',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Submit
            </button>
          </form>
        )}

        {result && (
          <div>
            <p
              style={{
                color: result.correct ? '#16a34a' : '#b45309',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              {result.feedback}
            </p>
            <button
              onClick={loadPrompt}
              style={{
                marginTop: '0.5rem',
                padding: '0.4rem 0.8rem',
                color: '#111',
                background: '#eee',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </ContentPage>
  )
}