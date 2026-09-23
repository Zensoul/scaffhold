'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ContentPage } from '@/components/shared/page-layout'

type VisibleAnnotation = {
  id: string
  annotationType: 'unknown' | 'given' | 'implied_given' | 'concept_anchor'
  annotationText: string
  hintText: string
  sequenceOrder: number
}

type HiddenAnnotation = {
  id: string
  annotationType: 'unknown' | 'given' | 'implied_given' | 'concept_anchor'
  sequenceOrder: number
  hintText: string
  hintWasRephrased: boolean
}

type FullAnnotation = {
  id: string
  annotationType: 'unknown' | 'given' | 'implied_given' | 'concept_anchor'
  annotationText: string
  hintText: string
  sequenceOrder: number
}

type ComparisonQuestion = {
  interactionId: string
  question: string
  options: { id: string; text: string }[]
}

type SubmitResult = {
  correct: boolean
  correctAnswer?: string
  isFirstMiss?: boolean
  comparisonQuestion: ComparisonQuestion | null
}

type Mode2Response =
  | {
      sessionEnded: false
      problemComplete: false
      problem: {
        id: string
        rawText: string
        concreteRestatement: string
        problemType: string
        difficultyTier: number
      }
      visibleAnnotations: VisibleAnnotation[]
      hiddenAnnotation: HiddenAnnotation
      fadeProgress: { totalHidden: number; answeredSoFar: number; currentLevel: number }
    }
  | {
      sessionEnded: false
      problemComplete: true
      problem: { id: string; rawText: string; concreteRestatement: string }
      chapterId: string
      annotations: FullAnnotation[]
    }
  | {
      sessionEnded: true
      reason: string
      statement: string | null
      chapterId: string
    }

const TYPE_LABEL: Record<string, string> = {
  given: 'Given',
  implied_given: 'Implied (not stated directly)',
  unknown: 'What we need to find',
  concept_anchor: 'Concept',
}

export default function Mode2Page() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('sessionId')

  const [data, setData] = useState<Mode2Response | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [comparisonAnswered, setComparisonAnswered] = useState<
    { selectedId: string; isCorrect: boolean } | null
  >(null)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startingNewSession, setStartingNewSession] = useState(false)

  const loadProblem = useCallback(() => {
    if (!sessionId) {
      setError('Missing sessionId in URL (?sessionId=...)')
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/problems/${id}/mode2?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load problem')
        return res.json()
      })
      .then((json: Mode2Response) => {
        setData(json)
        setResult(null)
        setComparisonAnswered(null)
        setAnswer('')
        setStartTime(Date.now())
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, sessionId])

  useEffect(() => {
    loadProblem()
  }, [loadProblem])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data || data.sessionEnded || data.problemComplete || !sessionId) return

    const timeOnStepMs = Date.now() - startTime

    const res = await fetch(`/api/problems/${id}/mode2/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        annotationId: data.hiddenAnnotation.id,
        studentResponse: answer,
        sessionId,
        timeOnStepMs,
      }),
    })

    if (!res.ok) {
      // Most commonly: the session expired between page load and submit
      // (a real timing gap, not a bug) — reload rather than render
      // garbage from an error response shape the UI doesn't expect.
      loadProblem()
      return
    }

    const json = await res.json()
    setResult(json)

    // On a first miss, clear the input so the retry feels like a fresh
    // attempt — the "not quite, try again" message renders above the
    // now-empty input, per the isFirstMiss branch in the form below.
    if (json.isFirstMiss) {
      setAnswer('')
    }
  }

  async function handleComparisonSelect(selectedOptionId: string) {
    if (!result?.comparisonQuestion || !sessionId) return

    const res = await fetch(`/api/problems/${id}/mode2/comparison-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: result.comparisonQuestion.interactionId,
        selectedOptionId,
        sessionId,
      }),
    })

    const json = await res.json()
    setComparisonAnswered({ selectedId: selectedOptionId, isCorrect: json.isCorrect })
  }

  async function handleContinueToNextProblem(chapterId: string) {
    if (!sessionId) return

    const res = await fetch(`/api/problems/next?chapterId=${chapterId}&sessionId=${sessionId}`)
    const json = await res.json()

    if (json.nextUrl) {
      router.push(json.nextUrl)
    } else {
      // Honest fallback: if sequencing somehow fails, don't strand the
      // student on a dead screen — just refresh the current problem.
      loadProblem()
    }
  }

  // Lets the student (or a tester) recover from a session that has
  // ended — timeout, natural completion, or the consecutive-failure
  // circuit-breaker — without any manual database editing. Calls
  // /api/sessions/start with forceNew: true, which closes out the
  // stale session and resets the consecutiveFailures streak on
  // ScaffoldingLevel (that counter otherwise persists across sessions
  // and would immediately re-trip the guard on the very next check).
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
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '1.5rem',
            textAlign: 'center',
            marginTop: '3rem',
          }}
        >
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
    const sorted = [...data.annotations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    return (
      <ContentPage maxWidth={640}>
        <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: '1rem' }}>
          Nicely done — you filled in every missing piece.
        </p>

        <section style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
            Problem
          </h1>
          <p style={{ color: '#111' }}>{data.problem.rawText}</p>
        </section>

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

        <button
          onClick={() => handleContinueToNextProblem(data.chapterId)}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            color: '#fff',
            background: '#2563eb',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Continue
        </button>
      </ContentPage>
    )
  }

  const sortedVisible = [...data.visibleAnnotations].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder
  )

  return (
    <ContentPage maxWidth={640}>
      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
        {data.problem.problemType} · difficulty {data.problem.difficultyTier}
      </p>
      <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem' }}>
        Piece {data.fadeProgress.answeredSoFar + 1} of {data.fadeProgress.totalHidden}
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

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111' }}>
          Fill in the missing piece
        </h2>

        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedVisible
            .filter((a) => a.sequenceOrder < data.hiddenAnnotation.sequenceOrder)
            .map((a) => (
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

          <li
            style={{
              border: '2px dashed #999',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              background: '#fafafa',
            }}
          >
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', marginBottom: '0.25rem' }}>
              {TYPE_LABEL[data.hiddenAnnotation.annotationType]}
            </p>

            {(!result || result.isFirstMiss) && (
              <form onSubmit={handleSubmit}>
                {result?.isFirstMiss && (
                  <p style={{ color: '#b45309', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Not quite — look again and try once more in your own words.
                  </p>
                )}
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '1rem',
                    color: '#111',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                  }}
                  autoFocus
                />
                <p style={{ fontSize: '0.85rem', color: '#444', marginBottom: '0.5rem' }}>
                  {data.hiddenAnnotation.hintText}
                  {data.hiddenAnnotation.hintWasRephrased && (
                    <span style={{ fontStyle: 'italic', color: '#777' }}>
                      {' '}
                      (here's another way to think about it)
                    </span>
                  )}
                </p>
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

            {result && result.correct && (
              <div>
                <p style={{ color: '#16a34a', fontWeight: 600 }}>That's right.</p>
                <button
                  onClick={loadProblem}
                  style={{
                    marginTop: '0.75rem',
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

            {result && !result.correct && result.comparisonQuestion && (
              <div>
                <p style={{ color: '#b45309', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Not quite. Let's look at this a different way.
                </p>
                <p style={{ color: '#111', marginBottom: '0.75rem' }}>
                  {result.comparisonQuestion.question}
                </p>

                {!comparisonAnswered && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {result.comparisonQuestion.options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleComparisonSelect(opt.id)}
                        style={{
                          textAlign: 'left',
                          padding: '0.6rem 0.8rem',
                          color: '#111',
                          background: '#fff',
                          border: '1px solid #ccc',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                        }}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}

                {comparisonAnswered && (
                  <div>
                    <p
                      style={{
                        color: comparisonAnswered.isCorrect ? '#16a34a' : '#b45309',
                        fontWeight: 600,
                        marginBottom: '0.5rem',
                      }}
                    >
                      {comparisonAnswered.isCorrect
                        ? 'Yes, that\'s the difference.'
                        : 'Not quite that one — here\'s the correct piece:'}
                    </p>
                    <p style={{ color: '#111' }}>
                      <strong>{result.correctAnswer}</strong>
                    </p>
                    <button
                      onClick={loadProblem}
                      style={{
                        marginTop: '0.75rem',
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
              </div>
            )}

            {result && !result.correct && !result.comparisonQuestion && (
              <div>
                <p style={{ color: '#b45309', fontWeight: 600 }}>
                  Not quite — here's the correct piece:
                </p>
                <p style={{ color: '#111' }}>
                  <strong>{result.correctAnswer}</strong>
                </p>
                <button
                  onClick={loadProblem}
                  style={{
                    marginTop: '0.75rem',
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
          </li>

          {sortedVisible
            .filter((a) => a.sequenceOrder > data.hiddenAnnotation.sequenceOrder)
            .map((a) => (
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
    </ContentPage>
  )
}