'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password.')
      return
    }

    router.push('/') // redirect to home/dashboard once that exists
  }

  const pageStyle: React.CSSProperties = {
    maxWidth: 400,
    margin: '4rem auto',
    padding: '2rem',
    color: '#111',
    background: '#fff',
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Log in
      </h1>

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#444' }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            color: '#111',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '1rem',
          }}
        />

        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#444' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            color: '#111',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '1rem',
          }}
        />

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
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </main>
  )
}