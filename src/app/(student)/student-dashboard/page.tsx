'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

type SessionSummary = {
  id: string
  startedAt: string
  endedAt: string | null
  endReason: string | null
  problemsAttempted: number
}

type ChapterRow = {
  chapterId: string
  name: string
  subjectName: string
  sequenceNumber: number
  currentLevel: number
  problemsAttempted: number
  problemsClean: number
  hasStarted: boolean
  recentSessions: SessionSummary[]
}

type ProblemRow = {
  id: string
  index: number
  title: string
  problemType: string
  difficultyTier: number
  subtopic: string | null
  hasGuidedSolve: boolean
  isCompleted: boolean
  isAttempted: boolean
  isNext: boolean
  isLocked: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000

function endReasonLabel(reason: string | null, endedAt: string | null, startedAt?: string): { label: string; variant: 'success' | 'warning' | 'secondary' | 'outline' } {
  if (!endedAt) {
    if (startedAt && Date.now() - new Date(startedAt).getTime() > SESSION_TIMEOUT_MS) {
      return { label: 'Abandoned', variant: 'secondary' }
    }
    return { label: 'In progress', variant: 'warning' }
  }
  switch (reason) {
    case 'completed': return { label: 'Completed', variant: 'success' }
    case 'consecutive_failures': return { label: 'Needs a break', variant: 'outline' }
    case 'timeout': return { label: 'Time limit', variant: 'outline' }
    case 'student_exit': return { label: 'Ended by you', variant: 'secondary' }
    case 'abandonment_predicted': return { label: 'Early exit', variant: 'outline' }
    default: return { label: 'Ended', variant: 'secondary' }
  }
}

function adaptiveReasonLabel(reason: string | null): string {
  if (!reason) return ''
  if (reason === 'no_prior_data') return 'First problem'
  if (reason === 'unattempted_problem_available') return 'New problem'
  if (reason === 'insufficient_data_fallback') return 'Recommended'
  if (reason.startsWith('weak_problem_type:')) return 'Needs practice'
  if (reason.startsWith('weak_annotation_type:')) return 'Needs practice'
  return 'Recommended'
}

function ProblemList({ chapterId }: { chapterId: string }) {
  const [data, setData] = useState<{ problems: ProblemRow[]; nextReason: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/student/chapters/${chapterId}/problems`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [chapterId])

  if (loading) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const { problems, nextReason } = data

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {problems.map((p) => {
        const reasonLabel = p.isNext ? adaptiveReasonLabel(nextReason) : null

        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              p.isLocked
                ? 'bg-muted/20 opacity-40'
                : p.isNext
                  ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-800'
                  : p.isCompleted
                    ? 'bg-green-50 dark:bg-green-950/20'
                    : p.isAttempted
                      ? 'bg-blue-50/50 dark:bg-blue-950/10'
                      : 'bg-muted/30'
            }`}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {p.isLocked ? (
                <LockIcon />
              ) : p.isCompleted ? (
                <CheckIcon />
              ) : p.isNext ? (
                <ArrowIcon />
              ) : (
                <DotIcon />
              )}
            </div>

            {/* Problem info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`truncate font-medium ${p.isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {p.index}. {p.title}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                {p.subtopic && (
                  <span className="text-xs text-muted-foreground">{p.subtopic}</span>
                )}
                {p.hasGuidedSolve && (
                  <Badge variant="secondary" className="text-[0.6rem] py-0 px-1.5">Guided</Badge>
                )}
                {'★'.repeat(p.difficultyTier) && (
                  <span className="text-xs text-muted-foreground">{'★'.repeat(p.difficultyTier)}</span>
                )}
              </div>
            </div>

            {/* Right badges */}
            <div className="shrink-0 flex items-center gap-1.5">
              {p.isNext && reasonLabel && (
                <Badge variant="outline" className="text-[0.6rem] border-amber-300 text-amber-700 dark:text-amber-400 py-0 px-1.5">
                  {reasonLabel}
                </Badge>
              )}
              {p.isCompleted && (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Done</span>
              )}
              {!p.isCompleted && !p.isNext && p.isAttempted && (
                <span className="text-xs text-muted-foreground">Tried</span>
              )}
              {p.isLocked && (
                <span className="text-xs text-muted-foreground/60">Locked</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StudentDashboardPage() {
  const { data: session } = useSession()
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startingChapterId, setStartingChapterId] = useState<string | null>(null)
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const loadChapters = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/student/chapters')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load your chapters')
        return res.json()
      })
      .then((json: { chapters: ChapterRow[] }) => {
        setChapters(json.chapters)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your chapters'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadChapters()
  }, [loadChapters])

  function handleStart(chapterId: string) {
    setStartingChapterId(chapterId)
    const form = formRef.current
    if (!form) return
    const input = form.elements.namedItem('chapterId') as HTMLInputElement
    input.value = chapterId
    form.submit()
  }

  function toggleExpand(chapterId: string) {
    setExpandedChapter(prev => prev === chapterId ? null : chapterId)
  }

  const grouped = useMemo(() => {
    if (!chapters) return []
    const bySubject = new Map<string, ChapterRow[]>()
    for (const c of chapters) {
      const list = bySubject.get(c.subjectName) ?? []
      list.push(c)
      bySubject.set(c.subjectName, list)
    }
    return [...bySubject.entries()]
  }, [chapters])

  const firstName = session?.user?.name?.split(' ')[0]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {firstName ? `Welcome back, ${firstName}` : 'Your chapters'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off, or start something new.
        </p>
      </div>

      <form ref={formRef} action="/api/sessions/start-and-redirect" method="POST" className="hidden">
        <input type="hidden" name="chapterId" />
      </form>

      {loading && <DashboardSkeleton />}

      {!loading && error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={loadChapters}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && chapters && chapters.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <BookIcon />
            </div>
            <p className="font-medium text-foreground">No chapters assigned yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ask your teacher to assign a chapter and it will show up here.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && chapters && chapters.length > 0 && (
        <div className="flex flex-col gap-8">
          {grouped.map(([subjectName, rows]) => (
            <section key={subjectName}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {subjectName}
              </h2>
              <div className="flex flex-col gap-3">
                {rows.map((c) => {
                  const percent = Math.round(c.currentLevel * 100)
                  const isExpanded = expandedChapter === c.chapterId

                  return (
                    <Card key={c.chapterId} className="gap-0 py-0">
                      <CardContent className="flex flex-col gap-4 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <button
                            onClick={() => toggleExpand(c.chapterId)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-foreground">{c.name}</p>
                              <ChevronIcon expanded={isExpanded} />
                            </div>
                            {c.hasStarted ? (
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {c.problemsClean} clean of {c.problemsAttempted} attempted
                              </p>
                            ) : (
                              <p className="mt-0.5 text-sm text-muted-foreground">Not started yet</p>
                            )}
                          </button>
                          <Button
                            onClick={() => handleStart(c.chapterId)}
                            disabled={startingChapterId === c.chapterId}
                            size="sm"
                            className="shrink-0"
                          >
                            {startingChapterId === c.chapterId
                              ? 'Starting…'
                              : c.hasStarted
                                ? 'Continue'
                                : 'Start'}
                          </Button>
                        </div>

                        {c.hasStarted && (
                          <div>
                            <Progress value={percent} className="h-1.5" />
                            <p className="mt-1.5 text-xs text-muted-foreground">{percent}% mastery</p>
                          </div>
                        )}

                        {isExpanded && (
                          <ProblemList chapterId={c.chapterId} />
                        )}

                        {c.recentSessions.length > 0 && (
                          <>
                            <Separator />
                            <div className="flex flex-col gap-1.5">
                              {c.recentSessions.map((s) => {
                                const status = endReasonLabel(s.endReason, s.endedAt, s.startedAt)
                                return (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between text-xs text-muted-foreground"
                                  >
                                    <span>{formatDate(s.startedAt)}</span>
                                    <span>{s.problemsAttempted} attempted</span>
                                    <Badge variant={status.variant} className="text-[0.65rem]">
                                      {status.label}
                                    </Badge>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="py-0">
          <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function DotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-muted-foreground/50">
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
