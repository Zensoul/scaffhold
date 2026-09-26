'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { BackButton } from '@/components/shell/back-button'
import { ProblemDiagram } from '@/components/problem-diagram'
import { cn } from '@/lib/utils'

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
  label?: string | null
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
        givens: string[]
      }
      visibleAnnotations: VisibleAnnotation[]
      hiddenAnnotation: HiddenAnnotation
      fadeProgress: { totalHidden: number; answeredSoFar: number; currentLevel: number }
    }
  | {
      sessionEnded: false
      problemComplete: true
      problem: { id: string; rawText: string; concreteRestatement: string; givens: string[]; problemType: string }
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

// For 'unknown' annotations, never show the stored hintText — it may contain
// the full solution. Show a safe generic nudge instead.
const FIRST_MISS_NUDGE: Record<string, string> = {
  unknown: 'Think about which formula applies here, then substitute the given values.',
  given: 'Look at the problem statement again — the value is stated directly.',
  implied_given: "This value isn't written in the problem, but you can work it out from what is given.",
  concept_anchor: 'Recall the rule or formula this piece refers to.',
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  // Track how many annotations answered so diagram stage can advance
  const [diagramStage, setDiagramStage] = useState(0)

  const loadProblem = useCallback(() => {
    if (!sessionId) {
      setError('Missing sessionId in URL (?sessionId=...)')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
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
        setDiagramStage(0)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load problem'))
      .finally(() => setLoading(false))
  }, [id, sessionId])

  useEffect(() => {
    loadProblem()
  }, [loadProblem])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data || data.sessionEnded || data.problemComplete || !sessionId || isSubmitting) return

    setIsSubmitting(true)
    const timeOnStepMs = Date.now() - startTime

    try {
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
        const errJson = await res.json().catch(() => ({}))
        setError(errJson.error ?? 'Something went wrong — please try again.')
        return
      }

      const json = await res.json()
      setResult(json)

      if (json.correct) {
        // Advance diagram stage on correct answer
        setDiagramStage((s) => Math.min(s + 1, 3))
      }

      if (json.isFirstMiss) {
        setAnswer('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleComparisonSelect(selectedOptionId: string) {
    if (!result?.comparisonQuestion || !sessionId || isNavigating) return

    setIsNavigating(true)
    try {
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
    } finally {
      setIsNavigating(false)
    }
  }

  async function handleContinueToNextProblem(chapterId: string) {
    if (!sessionId || isNavigating) return

    setIsNavigating(true)
    try {
      const res = await fetch(`/api/problems/next?chapterId=${chapterId}&sessionId=${sessionId}`)
      const json = await res.json()

      if (!res.ok || !json.nextUrl) {
        loadProblem()
        return
      }

      if (json.isRepeat) {
        router.push('/student-dashboard')
        return
      }

      router.push(json.nextUrl)
    } finally {
      setIsNavigating(false)
    }
  }

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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
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
            <Button size="sm" variant="outline" onClick={loadProblem}>
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
        <div className="mt-4">
          <Badge variant="success" className="mb-4">
            Nicely done — you filled in every missing piece
          </Badge>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Diagram left */}
            <div className="lg:sticky lg:top-6 lg:w-[380px] lg:shrink-0">
              <ProblemDiagram
                problemType={data.problem.problemType ?? ''}
                givens={data.problem.givens ?? []}
                stage={2}
              />
            </div>

            {/* Content right */}
            <div className="min-w-0 flex-1">
              <section className="mb-4">
                <h1 className="mb-2 text-base font-semibold text-foreground">Problem</h1>
                <p className="text-sm text-foreground">{data.problem.rawText}</p>
              </section>

              <div className="flex flex-col gap-2.5 mb-6">
                {[...data.annotations]
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map((a) => (
                    <Card key={a.id} className="py-0">
                      <CardContent className="px-4 py-3">
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {TYPE_LABEL[a.annotationType]}
                        </p>
                        <p className="text-sm text-foreground">{a.annotationText}</p>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              <Button
                onClick={() => handleContinueToNextProblem(data.chapterId)}
                disabled={isNavigating}
                size="lg"
              >
                {isNavigating ? 'Loading…' : 'Continue'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && !data.sessionEnded && !data.problemComplete && (
        <Mode2ActiveView
          data={data}
          answer={answer}
          setAnswer={setAnswer}
          result={result}
          comparisonAnswered={comparisonAnswered}
          isSubmitting={isSubmitting}
          isNavigating={isNavigating}
          diagramStage={diagramStage}
          onSubmit={handleSubmit}
          onComparisonSelect={handleComparisonSelect}
          onNext={loadProblem}
        />
      )}
    </div>
  )
}

function Mode2ActiveView({
  data,
  answer,
  setAnswer,
  result,
  comparisonAnswered,
  isSubmitting,
  isNavigating,
  diagramStage,
  onSubmit,
  onComparisonSelect,
  onNext,
}: {
  data: Extract<Mode2Response, { problemComplete: false; sessionEnded: false }>
  answer: string
  setAnswer: (v: string) => void
  result: SubmitResult | null
  comparisonAnswered: { selectedId: string; isCorrect: boolean } | null
  isSubmitting: boolean
  isNavigating: boolean
  diagramStage: number
  onSubmit: (e: React.FormEvent) => void
  onComparisonSelect: (id: string) => void
  onNext: () => void
}) {
  const sortedVisible = [...data.visibleAnnotations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
  const percent = Math.round(
    ((data.fadeProgress.answeredSoFar + 1) / Math.max(data.fadeProgress.totalHidden, 1)) * 100
  )

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Badge variant="outline" className="text-[0.7rem] font-normal">
          {data.problem.problemType} · difficulty {data.problem.difficultyTier}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Piece {data.fadeProgress.answeredSoFar + 1} of {data.fadeProgress.totalHidden}
        </span>
      </div>
      <Progress value={percent} className="mb-6 h-1.5" />

      {/* Two-column layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* Diagram left (sticky) */}
        <div className="lg:sticky lg:top-6 lg:w-[380px] lg:shrink-0">
          <ProblemDiagram
            problemType={data.problem.problemType}
            givens={data.problem.givens ?? []}
            stage={diagramStage}
          />
        </div>

        {/* Right: problem + fill-in */}
        <div className="min-w-0 flex-1">
          <section className="mb-4">
            <h1 className="mb-1.5 text-base font-semibold text-foreground">Problem</h1>
            <p className="text-sm text-foreground">{data.problem.rawText}</p>
          </section>
          <section className="mb-5">
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In plain words</h2>
            <p className="text-sm text-muted-foreground">{data.problem.concreteRestatement}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fill in the missing piece
            </h2>

            <div className="flex flex-col gap-2.5">
              {sortedVisible
                .filter((a) => a.sequenceOrder < data.hiddenAnnotation.sequenceOrder)
                .map((a) => (
                  <Card key={a.id} className="py-0">
                    <CardContent className="px-4 py-3">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        {TYPE_LABEL[a.annotationType]}
                      </p>
                      <p className="text-sm text-foreground">{a.annotationText}</p>
                    </CardContent>
                  </Card>
                ))}

              <Card className="border-dashed py-0">
                <CardContent className="px-4 py-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {data.hiddenAnnotation.label ?? TYPE_LABEL[data.hiddenAnnotation.annotationType]}
                  </p>

                  {(!result || result.isFirstMiss) && (
                    <form onSubmit={onSubmit} className="flex flex-col gap-2">
                      {result?.isFirstMiss && (
                        <p className="text-sm font-medium text-warning">
                          Not quite — look again and try once more in your own words.
                        </p>
                      )}
                      <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Type your answer…"
                        aria-label="Your answer"
                        autoFocus
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {result?.isFirstMiss && (
                        <p className="text-sm text-muted-foreground">
                          {data.hiddenAnnotation.annotationType === 'unknown'
                            ? FIRST_MISS_NUDGE['unknown']
                            : data.hiddenAnnotation.hintText || FIRST_MISS_NUDGE[data.hiddenAnnotation.annotationType]}
                          {data.hiddenAnnotation.annotationType !== 'unknown' && data.hiddenAnnotation.hintWasRephrased && (
                            <span className="italic"> (here&apos;s another way to think about it)</span>
                          )}
                        </p>
                      )}
                      <Button type="submit" disabled={isSubmitting} className="w-fit">
                        {isSubmitting ? 'Submitting…' : 'Submit'}
                      </Button>
                    </form>
                  )}

                  {result && result.correct && (
                    <div className="flex flex-col items-start gap-3">
                      <p className="font-semibold text-success">That&apos;s right.</p>
                      <Button size="sm" variant="secondary" onClick={onNext}>
                        Next
                      </Button>
                    </div>
                  )}

                  {result && !result.correct && result.comparisonQuestion && (
                    <div className="flex flex-col gap-3">
                      <p className="font-semibold text-warning">
                        Not quite. Let&apos;s look at this a different way.
                      </p>
                      <p className="text-foreground">{result.comparisonQuestion.question}</p>

                      {!comparisonAnswered && (
                        <div className="flex flex-col gap-2">
                          {result.comparisonQuestion.options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => onComparisonSelect(opt.id)}
                              disabled={isNavigating}
                              className={cn(
                                'rounded-md border border-input bg-background px-3 py-2.5 text-left text-sm text-foreground outline-none transition-colors',
                                'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                                'disabled:cursor-not-allowed disabled:opacity-60'
                              )}
                            >
                              {opt.text}
                            </button>
                          ))}
                        </div>
                      )}

                      {comparisonAnswered && (
                        <div className="flex flex-col items-start gap-2">
                          <p
                            className={cn(
                              'font-semibold',
                              comparisonAnswered.isCorrect ? 'text-success' : 'text-warning'
                            )}
                          >
                            {comparisonAnswered.isCorrect
                              ? "Yes, that's the difference."
                              : "Not quite that one — here's the correct piece:"}
                          </p>
                          <p className="text-foreground">
                            <strong>{result.correctAnswer}</strong>
                          </p>
                          <Button size="sm" variant="secondary" onClick={onNext}>
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {result && !result.correct && !result.isFirstMiss && !result.comparisonQuestion && (
                    <div className="flex flex-col items-start gap-2">
                      <p className="font-semibold text-warning">Not quite — here&apos;s the correct piece:</p>
                      <p className="text-foreground">
                        <strong>{result.correctAnswer}</strong>
                      </p>
                      <Button size="sm" variant="secondary" onClick={onNext}>
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {sortedVisible
                .filter((a) => a.sequenceOrder > data.hiddenAnnotation.sequenceOrder)
                .map((a) => (
                  <Card key={a.id} className="py-0">
                    <CardContent className="px-4 py-3">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        {TYPE_LABEL[a.annotationType]}
                      </p>
                      <p className="text-sm text-foreground">{a.annotationText}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
