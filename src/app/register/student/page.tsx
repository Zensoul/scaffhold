'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CenteredPage, sharedStyles } from '@/components/shared/page-layout'

function StudentRegisterForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [invite, setInvite] = useState<{ childFullName: string; childGrade: number } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError('This registration link is missing a token.')
      setLoading(false)
      return
    }

    fetch(`/api/invites/validate?token=${token}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setLoadError(data.error ?? 'This invite link is not valid.')
          return
        }
        setInvite(data)
      })
      .catch(() => setLoadError('Something went wrong loading this invite.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/signup-via-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      const signInResult = await signIn('credentials', { email, password, redirect: false })

      setSubmitting(false)

      if (signInResult?.error) {
        router.push('/login')
        return
      }

      router.push('/')
    } catch {
      setSubmitError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <CenteredPage>Loading...</CenteredPage>

  if (loadError) {
    return (
      <CenteredPage>
        <p style={{ color: 'crimson' }}>{loadError}</p>
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
          Ask your parent to send you a new invite link.
        </p>
      </CenteredPage>
    )
  }

  if (!invite) return null

  return (
    <CenteredPage maxWidth={400}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
        Welcome, {invite.childFullName}
      </h1>
      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>
        Your parent has already given consent for you to use Scaffhold. Just set up your
        sign-in details below.
      </p>

      <form onSubmit={handleSubmit}>
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

        {submitError && (
          <p style={{ color: 'crimson', fontSize: '0.85rem', marginBottom: '1rem' }}>{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            ...sharedStyles.primaryButton,
            width: '100%',
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Creating account...' : 'Create my account'}
        </button>
      </form>
    </CenteredPage>
  )
}

// The actual page export — wraps the form (which uses useSearchParams)
// in a Suspense boundary. Required for Next.js static prerendering to
// succeed; without this, the production build fails outright (as it
// did tonight) even though dev mode never surfaces the problem.
export default function StudentRegisterPage() {
  return (
    <Suspense fallback={<CenteredPage>Loading...</CenteredPage>}>
      <StudentRegisterForm />
    </Suspense>
  )
}