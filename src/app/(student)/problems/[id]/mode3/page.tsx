'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/shell/back-button'
import { cn } from '@/lib/utils'

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
  // Same double-submit guard as Mode 2's handleSubmit -- see that
  // file's comment for the reasoning.
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadPrompt = useCallback(() => {
    if (!sessionId) {
      setError('Missing sessionId in URL (?sessionId=...)')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load problem'))
      .finally(() => setLoading(false))
  }, [id, sessionId])

  useEffect(() => {
    loadPrompt()
  }, [loadPrompt])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data || data.sessionEnded || data.problemComplete || !sessionId || isSubmitting) return

    setIsSubmitting(true)
    const timeOnStepMs = Date.now() - startTime

    try {
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
    } finally {
      setIsSubmitting(false)
    }
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <BackButton href="/student-dashboard" label="Your chapters" />

      {loading && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {!loading && error && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={loadPrompt}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && data.sessionEnded && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-base text-foreground">
              {data.statement ?? 'That session is complete. Come back tomorrow.'}
            </p>
            <Button onClick={() => handleStartNewSession(data.chapterId)} disabled={startingNewSession}>
              {startingNewSession
                ? 'Starting…'
                : data.reason === 'consecutive_failures'
                  ? 'Take a breath and try again'
                  : 'Start a new session'}
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && !data.sessionEnded && data.problemComplete && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Badge variant="success">Nice work</Badge>
            <p className="text-base font-semibold text-foreground">
              You worked through this one on your own.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && !data.sessionEnded && !data.problemComplete && (
        <div className="mt-4">
          <Badge variant="outline" className="mb-4 text-[0.7rem] font-normal">
            Working independently
          </Badge>

          <section className="mb-6">
            <h1 className="mb-2 text-lg font-semibold text-foreground">Problem</h1>
            <p className="text-foreground">{data.problem.rawText}</p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">{data.promptText}</h2>

            {!result && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer in your own words…"
                  aria-label="Your answer, in your own words"
                  rows={4}
                  autoFocus
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" disabled={isSubmitting} className="w-fit">
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </Button>
              </form>
            )}

            {result && (
              <div className="flex flex-col items-start gap-3">
                <p className={cn('font-semibold', result.correct ? 'text-success' : 'text-warning')}>
                  {result.feedback}
                </p>
                <Button size="sm" variant="secondary" onClick={loadPrompt}>
                  Next
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
