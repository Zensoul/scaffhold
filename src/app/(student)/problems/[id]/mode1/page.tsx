'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/shell/back-button'
import { ChevronRight, CheckCircle2, Lightbulb } from 'lucide-react'
import { ProblemDiagram } from '@/components/problem-diagram'

type Annotation = {
  id: string
  annotationType: 'unknown' | 'given' | 'implied_given' | 'concept_anchor'
  annotationText: string | null
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
    givens: string[]
  }
  annotations: Annotation[]
  chapterId: string
}

const TYPE_LABEL: Record<string, string> = {
  given: 'Given',
  implied_given: 'Implied (not stated directly)',
  unknown: 'What we need to find',
  concept_anchor: 'Key Concept',
}

// Self-explanation prompts — one per annotation type.
// Purpose: force a single deliberate cognitive act before the next reveal.
// Questions should test WHETHER the student understands the ROLE of the piece,
// not just recognise a keyword from the annotation text.
const SELF_EXPLANATION: Record<
  string,
  { question: string; options: string[]; correctIndex: number; confirmation: string }
> = {
  given: {
    question: 'What role does this value play in solving the problem?',
    options: [
      'It is one of the inputs we substitute into the formula',
      'It is the final answer the problem is asking for',
      'It is a general rule that applies to all circles',
    ],
    correctIndex: 0,
    confirmation: 'Right — given values are the raw inputs. Every calculation step depends on these.',
  },
  implied_given: {
    question: 'Why must we recognise this, even though the problem does not state it?',
    options: [
      'Because the examiner expects us to memorise it',
      'Because it is a geometric property that must be known to use the formula correctly',
      'Because it changes the formula we need to use',
    ],
    correctIndex: 1,
    confirmation: 'Correct — implied information comes from geometry rules you already know, not the problem text.',
  },
  concept_anchor: {
    question: 'How does this formula connect what we know to what we need to find?',
    options: [
      'It turns the given radius and angle directly into the area we need',
      'It gives us a diagram to sketch',
      'It converts degrees to radians first',
    ],
    correctIndex: 0,
    confirmation: 'Exactly — the formula is the bridge. Plug in the givens, and the unknown falls out.',
  },
  unknown: {
    question: 'Why is this value the "unknown" rather than a given?',
    options: [
      'Because it is not in the problem at all',
      'Because it is what we calculate — not something the problem provides',
      'Because it changes depending on which formula we choose',
    ],
    correctIndex: 1,
    confirmation: 'Yes — the unknown is the goal. All the earlier pieces exist to let us compute this.',
  },
}

type SelfExplainState = {
  annotationIndex: number
  selectedOption: number | null
  confirmed: boolean
}

export default function Mode1Page() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('sessionId')

  const [data, setData] = useState<Mode1Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // How many annotations have been revealed (0 = none yet)
  const [revealedUpTo, setRevealedUpTo] = useState(0)

  // Self-explanation state for the currently active annotation
  const [selfExplain, setSelfExplain] = useState<SelfExplainState | null>(null)

  // Which diagram stage to show
  const [diagramStage, setDiagramStage] = useState(0)

  const loadProblem = useCallback(() => {
    if (!sessionId) {
      setError('Missing sessionId in URL (?sessionId=...)')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
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

  function handleRevealNext() {
    if (!data) return
    const sorted = [...data.annotations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    const nextIndex = revealedUpTo

    if (nextIndex >= sorted.length) {
      handleContinueToMode2()
      return
    }

    const annotation = sorted[nextIndex]
    // Advance SVG diagram stage: 0=circle+radius, 1=sector shaded, 2=formula
    const newStage = Math.min(nextIndex, 2)
    setDiagramStage(newStage)
    setRevealedUpTo(nextIndex + 1)

    if (annotation.annotationType !== 'unknown') {
      setSelfExplain({ annotationIndex: nextIndex, selectedOption: null, confirmed: false })
    } else {
      setSelfExplain(null)
    }
  }

  function handleSelfExplainSelect(optionIndex: number) {
    if (!selfExplain || selfExplain.confirmed) return
    setSelfExplain({ ...selfExplain, selectedOption: optionIndex, confirmed: true })
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <BackButton href="/student-dashboard" label="Your chapters" />
        {loading && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </div>
        )}
        {!loading && error && (
          <Card className="mt-4 border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col items-start gap-3 py-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={loadProblem}>Try again</Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const sorted = [...data.annotations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
  const totalAnnotations = sorted.length
  const allRevealed = revealedUpTo >= totalAnnotations
  const hasDiagram = true

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <BackButton href="/student-dashboard" label="Your chapters" />

      <div className="mt-4">
        <Badge variant="secondary" className="mb-4">
          Worked example · Let&apos;s do this one together
        </Badge>

        {/* ── Two-column layout: diagram left, annotations right ── */}
        <div className={hasDiagram ? 'flex flex-col gap-6 lg:flex-row lg:items-start' : ''}>

          {/* ── LEFT: Diagram (sticky on large screens) ── */}
          {hasDiagram && (
            <div className="lg:sticky lg:top-6 lg:w-[380px] lg:shrink-0">
              <ProblemDiagram
                problemType={data.problem.problemType}
                givens={data.problem.givens ?? []}
                stage={diagramStage}
              />
            </div>
          )}

          {/* ── RIGHT: Problem + annotations ── */}
          <div className="min-w-0 flex-1">
            {/* Problem statement */}
            <section className="mb-4">
              <h1 className="mb-1.5 text-base font-semibold text-foreground">Problem</h1>
              <p className="text-foreground text-sm leading-relaxed">{data.problem.rawText}</p>
            </section>

            {/* Plain words */}
            <section className="mb-5">
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In plain words</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {data.problem.concreteRestatement}
              </p>
            </section>

            {/* Annotation reveal */}
            <section className="mb-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Here&apos;s how to break it down
              </h2>

              {revealedUpTo === 0 && (
                <p className="mb-4 text-sm text-muted-foreground">
                  We&apos;ll go through this one piece at a time.
                </p>
              )}

              <div className="flex flex-col gap-2.5">
                {sorted.slice(0, revealedUpTo).map((a, i) => {
                  const isConceptAnchor = a.annotationType === 'concept_anchor'
                  const isJustRevealed = i === revealedUpTo - 1
                  const selfExplainConfig = SELF_EXPLANATION[a.annotationType]

                  return (
                    <div key={a.id}>
                      <Card
                        className={[
                          'py-0 transition-all',
                          isConceptAnchor
                            ? 'border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20'
                            : a.annotationType === 'unknown'
                              ? 'border-dashed border-blue-300/60'
                              : '',
                        ].join(' ')}
                      >
                        <CardContent className="px-4 py-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[0.65rem] font-semibold text-secondary-foreground">
                              {i + 1}
                            </span>
                            <Badge
                              variant={isConceptAnchor ? 'default' : 'outline'}
                              className={[
                                'text-[0.65rem] font-normal',
                                isConceptAnchor ? 'bg-amber-500 text-white hover:bg-amber-500' : '',
                              ].join(' ')}
                            >
                              {isConceptAnchor && <Lightbulb className="mr-1 h-3 w-3" />}
                              {TYPE_LABEL[a.annotationType]}
                            </Badge>
                          </div>

                          {a.annotationText !== null ? (
                            <p className={['pl-7 text-sm', isConceptAnchor ? 'font-medium text-foreground' : 'text-foreground'].join(' ')}>
                              {a.annotationText}
                            </p>
                          ) : (
                            <p className="pl-7 text-sm italic text-muted-foreground">
                              You&apos;ll work this piece out yourself, next.
                            </p>
                          )}

                          {isConceptAnchor && a.hintText && (
                            <div className="mt-2 pl-7">
                              <p className="text-xs text-amber-700 dark:text-amber-400">{a.hintText}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {isJustRevealed &&
                        selfExplain?.annotationIndex === i &&
                        selfExplainConfig && (
                          <SelfExplainPrompt
                            config={selfExplainConfig}
                            state={selfExplain}
                            onSelect={handleSelfExplainSelect}
                          />
                        )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Primary action button */}
            {!allRevealed ? (
              <Button
                onClick={handleRevealNext}
                size="lg"
                disabled={
                  selfExplain !== null &&
                  selfExplain.annotationIndex === revealedUpTo - 1 &&
                  !selfExplain.confirmed
                }
                className="w-full sm:w-auto"
              >
                {revealedUpTo === 0
                  ? 'Show me the first piece'
                  : `Show me piece ${revealedUpTo + 1} of ${totalAnnotations}`}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>You&apos;ve seen every piece of this problem. Now try it yourself.</span>
                </div>
                <Button onClick={handleContinueToMode2} size="lg" className="w-full sm:w-auto">
                  Now let&apos;s try one together
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// ── SelfExplainPrompt ────────────────────────────────────────────────────────

type SelfExplainConfig = {
  question: string
  options: string[]
  correctIndex: number
  confirmation: string
}

function SelfExplainPrompt({
  config,
  state,
  onSelect,
}: {
  config: SelfExplainConfig
  state: SelfExplainState
  onSelect: (index: number) => void
}) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <p className="mb-2.5 text-sm font-medium text-foreground">{config.question}</p>
      <div className="flex flex-col gap-1.5">
        {config.options.map((opt, i) => {
          const isSelected = state.selectedOption === i
          const isCorrect = i === config.correctIndex
          let cls = 'flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors border'

          if (!state.confirmed) {
            cls += ' border-border hover:bg-muted text-foreground'
          } else if (isSelected && isCorrect) {
            cls += ' border-green-400 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
          } else if (isSelected && !isCorrect) {
            cls += ' border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
          } else if (!isSelected && isCorrect && state.confirmed) {
            cls += ' border-green-300 bg-green-50/50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
          } else {
            cls += ' border-border text-muted-foreground'
          }

          return (
            <button
              key={i}
              className={cls}
              onClick={() => onSelect(i)}
              disabled={state.confirmed}
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[0.6rem]">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      {state.confirmed && (
        <div className="mt-3 flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
          <p className="text-muted-foreground">{config.confirmation}</p>
        </div>
      )}
    </div>
  )
}
