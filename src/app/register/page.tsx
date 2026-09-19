'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

type Role = 'student' | 'parent' | 'teacher'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [grade, setGrade] = useState('10')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          grade: role === 'student' ? Number(grade) : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Auto sign-in right after successful signup, so the person isn't
      // dropped back at a login form immediately after registering.
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      setLoading(false)

      if (signInResult?.error) {
        // Account was created but auto-login failed for some reason —
        // send them to the login page rather than leave them stuck.
        router.push('/login')
        return
      }

      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    padding: '2rem 1rem',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 400,
    padding: '2rem',
    color: '#111',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    marginBottom: '1rem',
    color: '#111',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: '1rem',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.25rem',
    fontSize: '0.85rem',
    color: '#444',
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Create an account
      </h1>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Full name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          style={inputStyle}
        />

        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />

        <label style={labelStyle}>I am a...</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={inputStyle}
        >
          <option value="student">Student</option>
          <option value="parent">Parent</option>
          <option value="teacher">Teacher</option>
        </select>

        {/* Grade only matters for students — StudentProfile requires it.
            Parent/teacher accounts have no equivalent field yet, matching
            those roles' current stub-destination status. */}
        {role === 'student' && (
          <>
            <label style={labelStyle}>Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={inputStyle}
            >
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </>
        )}

        {error && (
          <p style={{ color: 'crimson', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.6rem',
            color: '#fff',
            background: '#2563eb',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'default' : 'pointer',
            fontSize: '1rem',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
        Already have an account?{' '}
        <a href="/login" style={{ color: '#2563eb' }}>
          Log in
        </a>
      </p>
      </div>
    </main>
  )
}