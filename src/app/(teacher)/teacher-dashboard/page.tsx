'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

type Student = {
  studentProfileId: string
  fullName: string
  grade: number
  board: string
  chaptersAssigned: number
  chaptersStarted: number
  avgMasteryPct: number
  problemsAttempted: number
  problemsClean: number
}

type ChapterRow = {
  chapterId: string
  name: string
  subjectName: string
  sequenceNumber: number
  assigned: boolean
  assignedByName: string | null
  assignedAt: string | null
}

type FoundStudent = {
  studentProfileId: string
  fullName: string
  email: string
  grade: number
  board: string
}

type PerStudent = {
  studentName: string
  attempts: number
  solved: boolean
  firstAttemptCorrect: boolean
}

type StepStat = {
  stepId: string
  stepLabel: string
  sequenceOrder: number
  problemId: string
  problemTitle: string
  uniqueStudents: number
  avgAttempts: number
  failRate: number
  perStudent: PerStudent[]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function masteryTone(pct: number): 'success' | 'warning' | 'secondary' {
  if (pct >= 70) return 'success'
  if (pct >= 35) return 'warning'
  return 'secondary'
}

function failTone(rate: number): string {
  if (rate >= 60) return 'text-red-600 bg-red-50 border-red-200'
  if (rate >= 30) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}

export default function TeacherDashboardPage() {
  const [tab, setTab] = useState<'roster' | 'analytics'>('roster')

  const [students, setStudents] = useState<Student[] | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingChapterId, setTogglingChapterId] = useState<string | null>(null)

  // Add-a-student state
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState<FoundStudent | null | undefined>(undefined)
  const [searching, setSearching] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [addStudentOpen, setAddStudentOpen] = useState(false)

  // Analytics state
  const [stepStats, setStepStats] = useState<StepStat[] | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)

  const loadStudents = useCallback(() => {
    setLoadingStudents(true)
    fetch('/api/teacher/students')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load your students')
        return res.json()
      })
      .then((json: { students: Student[] }) => {
        setStudents(json.students)
        setSelectedStudentId((current) => current ?? (json.students[0]?.studentProfileId ?? null))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingStudents(false))
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const loadChapters = useCallback((studentProfileId: string) => {
    setLoadingChapters(true)
    fetch(`/api/teacher/chapters?studentProfileId=${studentProfileId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load chapters')
        return res.json()
      })
      .then((json: { chapters: ChapterRow[] }) => setChapters(json.chapters))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingChapters(false))
  }, [])

  useEffect(() => {
    if (selectedStudentId) {
      loadChapters(selectedStudentId)
    }
  }, [selectedStudentId, loadChapters])

  const loadAnalytics = useCallback(() => {
    setLoadingStats(true)
    fetch('/api/teacher/guided-analytics')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load analytics')
        return res.json()
      })
      .then((json: { steps: StepStat[] }) => setStepStats(json.steps))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingStats(false))
  }, [])

  useEffect(() => {
    if (tab === 'analytics' && stepStats === null) {
      loadAnalytics()
    }
  }, [tab, stepStats, loadAnalytics])

  async function handleToggle(chapter: ChapterRow) {
    if (!selectedStudentId) return
    setTogglingChapterId(chapter.chapterId)

    try {
      if (chapter.assigned) {
        await fetch(
          `/api/teacher/assignments?studentProfileId=${selectedStudentId}&chapterId=${chapter.chapterId}`,
          { method: 'DELETE' }
        )
      } else {
        await fetch('/api/teacher/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentProfileId: selectedStudentId, chapterId: chapter.chapterId }),
        })
      }
      loadChapters(selectedStudentId)
      loadStudents()
    } finally {
      setTogglingChapterId(null)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setSearchResult(undefined)

    try {
      const res = await fetch(`/api/teacher/roster?email=${encodeURIComponent(searchEmail)}`)
      if (!res.ok) throw new Error('Search failed — please try again.')
      const json = await res.json()
      setSearchResult(json.student)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleClaim() {
    if (!searchResult) return
    setClaiming(true)
    setSearchError(null)

    try {
      const res = await fetch('/api/teacher/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentProfileId: searchResult.studentProfileId }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Could not add this student.')
      }

      setSearchResult(undefined)
      setSearchEmail('')
      setAddStudentOpen(false)
      loadStudents()
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not add this student.')
    } finally {
      setClaiming(false)
    }
  }

  const selectedStudent = students?.find((s) => s.studentProfileId === selectedStudentId) ?? null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Teacher Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your roster and track guided-solve progress.
          </p>
        </div>
        {tab === 'roster' && (
          <Button
            variant={addStudentOpen ? 'secondary' : 'default'}
            size="sm"
            onClick={() => setAddStudentOpen((v) => !v)}
          >
            {addStudentOpen ? 'Close' : '+ Add student'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(['roster', 'analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'roster' ? 'Students & Chapters' : 'Guided Solve Analytics'}
          </button>
        ))}
      </div>

      {error && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── ROSTER TAB ─── */}
      {tab === 'roster' && (
        <>
          {addStudentOpen && (
            <Card className="mb-6 bg-secondary/40">
              <CardContent className="flex flex-col gap-3 py-5">
                <p className="text-sm font-medium text-foreground">Add a student to your roster</p>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="Student's email"
                    aria-label="Student's email address"
                    required
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button type="submit" disabled={searching} size="sm">
                    {searching ? 'Searching…' : 'Search'}
                  </Button>
                </form>

                {searchError && <p className="text-sm text-destructive">{searchError}</p>}

                {searchResult === null && (
                  <p className="text-sm text-muted-foreground">
                    No unassigned student found with that email. They may already have a teacher, or
                    the email doesn&apos;t match a student account.
                  </p>
                )}

                {searchResult && (
                  <div className="flex items-center justify-between rounded-md border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{searchResult.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Grade {searchResult.grade} ({searchResult.board}) — {searchResult.email}
                      </p>
                    </div>
                    <Button onClick={handleClaim} disabled={claiming} size="sm" variant="secondary">
                      {claiming ? 'Adding…' : 'Add to my roster'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {loadingStudents && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}

          {!loadingStudents && students && students.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <p className="font-medium text-foreground">No students on your roster yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Use &quot;Add student&quot; above to search by email and get started.
                </p>
              </CardContent>
            </Card>
          )}

          {!loadingStudents && students && students.length > 0 && (
            <>
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {students.map((s) => {
                  const active = s.studentProfileId === selectedStudentId
                  return (
                    <button
                      key={s.studentProfileId}
                      onClick={() => setSelectedStudentId(s.studentProfileId)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-card hover:bg-accent/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className={active ? 'bg-primary/15 text-primary' : ''}>
                            {initials(s.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            Grade {s.grade} · {s.board}
                          </p>
                        </div>
                        <Badge variant={masteryTone(s.avgMasteryPct)} className="shrink-0 text-[0.65rem]">
                          {s.avgMasteryPct}% mastery
                        </Badge>
                      </div>

                      <div className="mt-3">
                        <Progress value={s.avgMasteryPct} className="h-1.5" />
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {s.chaptersStarted}/{s.chaptersAssigned} chapters started
                        </span>
                        <span>
                          {s.problemsClean}/{s.problemsAttempted} correct
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <Separator className="mb-6" />

              {selectedStudent && (
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-foreground">
                    {selectedStudent.fullName}&apos;s chapters
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Grade {selectedStudent.grade} · {selectedStudent.board}
                  </p>
                </div>
              )}

              {loadingChapters && (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              )}

              {!loadingChapters && chapters && (
                <div className="flex flex-col gap-2">
                  {chapters.map((c) => (
                    <Card key={c.chapterId} className="py-0">
                      <CardContent className="flex items-center justify-between gap-4 px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[0.65rem] font-normal text-muted-foreground">
                              {c.subjectName}
                            </Badge>
                          </div>
                          <p className="mt-1 font-medium text-foreground">{c.name}</p>
                          {c.assigned && c.assignedByName && c.assignedAt && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Assigned by {c.assignedByName} on{' '}
                              {new Date(c.assignedAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>

                        <Button
                          onClick={() => handleToggle(c)}
                          disabled={togglingChapterId === c.chapterId}
                          size="sm"
                          variant={c.assigned ? 'outline' : 'default'}
                          className="shrink-0"
                        >
                          {togglingChapterId === c.chapterId ? '…' : c.assigned ? 'Unassign' : 'Assign'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ─── ANALYTICS TAB ─── */}
      {tab === 'analytics' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Guided Solve — Step Analytics</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Steps sorted by fail rate (most trouble first). Click a row to see per-student breakdown.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loadingStats}>
              {loadingStats ? 'Loading…' : 'Refresh'}
            </Button>
          </div>

          {loadingStats && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}

          {!loadingStats && stepStats && stepStats.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <p className="font-medium text-foreground">No guided-solve attempts yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Data appears here as students work through guided solve problems.
                </p>
              </CardContent>
            </Card>
          )}

          {!loadingStats && stepStats && stepStats.length > 0 && (
            <div className="flex flex-col gap-2">
              {stepStats.map((s) => {
                const expanded = expandedStepId === s.stepId
                return (
                  <div key={s.stepId} className="rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => setExpandedStepId(expanded ? null : s.stepId)}
                      className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-accent/30 transition-colors"
                    >
                      {/* Fail rate badge */}
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${failTone(s.failRate)}`}
                      >
                        {s.failRate}% fail
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{s.stepLabel}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.problemTitle}</p>
                      </div>

                      <div className="shrink-0 flex gap-4 text-xs text-muted-foreground">
                        <span title="Average attempts per student">
                          avg {s.avgAttempts} att.
                        </span>
                        <span title="Number of students who reached this step">
                          {s.uniqueStudents} student{s.uniqueStudents !== 1 ? 's' : ''}
                        </span>
                        <span className="text-muted-foreground/50">{expanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-border bg-muted/30 px-4 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left pb-2 font-medium">Student</th>
                              <th className="text-center pb-2 font-medium">Attempts</th>
                              <th className="text-center pb-2 font-medium">1st correct?</th>
                              <th className="text-center pb-2 font-medium">Solved</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.perStudent.map((ps) => (
                              <tr key={ps.studentName} className="border-t border-border/50">
                                <td className="py-1.5 pr-4 font-medium text-foreground">{ps.studentName}</td>
                                <td className="py-1.5 text-center">{ps.attempts}</td>
                                <td className="py-1.5 text-center">
                                  {ps.firstAttemptCorrect ? (
                                    <span className="text-emerald-600">✓</span>
                                  ) : (
                                    <span className="text-muted-foreground">✗</span>
                                  )}
                                </td>
                                <td className="py-1.5 text-center">
                                  {ps.solved ? (
                                    <span className="text-emerald-600">✓</span>
                                  ) : (
                                    <span className="text-red-500">✗</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
