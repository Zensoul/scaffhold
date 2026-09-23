'use client'

import { useEffect, useState, useCallback } from 'react'
import { ContentPage } from '@/components/shared/page-layout'

type Student = {
  studentProfileId: string
  fullName: string
  grade: number
  board: string
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

export default function TeacherDashboardPage() {
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
      loadStudents()
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not add this student.')
    } finally {
      setClaiming(false)
    }
  }

  if (loadingStudents) return <ContentPage maxWidth={720}>Loading...</ContentPage>
  if (error) return <ContentPage maxWidth={720}><span style={{ color: 'crimson' }}>{error}</span></ContentPage>
  if (!students) return null

  return (
    <ContentPage maxWidth={720}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Your students
      </h1>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '2rem',
          background: '#fafafa',
        }}
      >
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111' }}>
          Add a student
        </h2>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="Student's email"
            required
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '0.95rem',
              color: '#111',
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
          <button
            type="submit"
            disabled={searching}
            style={{
              padding: '0.5rem 1rem',
              color: '#fff',
              background: '#2563eb',
              border: 'none',
              borderRadius: 4,
              cursor: searching ? 'default' : 'pointer',
              fontSize: '0.9rem',
              opacity: searching ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchError && (
          <p style={{ color: 'crimson', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{searchError}</p>
        )}

        {searchResult === null && (
          <p style={{ color: '#666', fontSize: '0.85rem' }}>
            No unassigned student found with that email. They may already have a teacher, or the
            email might not match a student account.
          </p>
        )}

        {searchResult && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 0.8rem',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 6,
            }}
          >
            <div>
              <p style={{ color: '#111', fontWeight: 600, fontSize: '0.9rem' }}>
                {searchResult.fullName}
              </p>
              <p style={{ color: '#666', fontSize: '0.8rem' }}>
                Grade {searchResult.grade} ({searchResult.board}) — {searchResult.email}
              </p>
            </div>
            <button
              onClick={handleClaim}
              disabled={claiming}
              style={{
                padding: '0.4rem 0.9rem',
                color: '#fff',
                background: '#16a34a',
                border: 'none',
                borderRadius: 4,
                cursor: claiming ? 'default' : 'pointer',
                fontSize: '0.85rem',
                opacity: claiming ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {claiming ? 'Adding...' : 'Add to my roster'}
            </button>
          </div>
        )}
      </section>

      {students.length === 0 ? (
        <p style={{ color: '#666' }}>
          No students on your roster yet — search for one above by email to get started.
        </p>
      ) : (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#444', marginBottom: '0.4rem' }}>
              Assign chapters to
            </label>
            <select
              value={selectedStudentId ?? ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              style={{
                padding: '0.5rem',
                fontSize: '1rem',
                color: '#111',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 4,
                minWidth: 260,
              }}
            >
              {students.map((s) => (
                <option key={s.studentProfileId} value={s.studentProfileId}>
                  {s.fullName} — Grade {s.grade} ({s.board})
                </option>
              ))}
            </select>
          </div>

          {loadingChapters && <p style={{ color: '#666' }}>Loading chapters...</p>}

          {!loadingChapters && chapters && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {chapters.map((c) => (
                <div
                  key={c.chapterId}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.15rem' }}>
                      {c.subjectName}
                    </p>
                    <p style={{ fontWeight: 600, color: '#111' }}>{c.name}</p>
                    {c.assigned && c.assignedByName && c.assignedAt && (
                      <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                        Assigned by {c.assignedByName} on{' '}
                        {new Date(c.assignedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggle(c)}
                    disabled={togglingChapterId === c.chapterId}
                    style={{
                      padding: '0.4rem 0.9rem',
                      color: c.assigned ? '#111' : '#fff',
                      background: c.assigned ? '#eee' : '#2563eb',
                      border: c.assigned ? '1px solid #ccc' : 'none',
                      borderRadius: 4,
                      cursor: togglingChapterId === c.chapterId ? 'default' : 'pointer',
                      fontSize: '0.9rem',
                      opacity: togglingChapterId === c.chapterId ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {togglingChapterId === c.chapterId ? '...' : c.assigned ? 'Unassign' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ContentPage>
  )
}