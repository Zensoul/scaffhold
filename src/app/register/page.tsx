'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CenteredPage, sharedStyles } from '@/components/shared/page-layout'

type Role = 'student' | 'parent' | 'teacher'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      setLoading(false)

      if (signInResult?.error) {
        router.push('/login')
        return
      }

      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <CenteredPage maxWidth={400}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Create an account
      </h1>

      <form onSubmit={handleSubmit}>
        <label style={sharedStyles.label}>Full name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          style={sharedStyles.input}
        />

        <label style={sharedStyles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={sharedStyles.input}
        />

        <label style={sharedStyles.label}>Password</label>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ ...sharedStyles.input, marginBottom: 0, paddingRight: '2.5rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#666',
              fontSize: '1.1rem',
              lineHeight: 1,
            }}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <label style={sharedStyles.label}>I am a...</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={sharedStyles.input}
        >
          <option value="student">Student</option>
          <option value="parent">Parent</option>
          <option value="teacher">Teacher</option>
        </select>

        {role === 'student' && (
          <>
            <label style={sharedStyles.label}>Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={sharedStyles.input}
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
            ...sharedStyles.primaryButton,
            width: '100%',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'default' : 'pointer',
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
    </CenteredPage>
  )
}