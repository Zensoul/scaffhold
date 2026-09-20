'use client'

import { useState } from 'react'
import { ContentPage, sharedStyles } from '@/components/shared/page-layout'
import { renderConsentText } from '@/lib/legal/dpdp-consent'

export default function InviteStudentPage() {
  const [childFullName, setChildFullName] = useState('')
  const [childGrade, setChildGrade] = useState('10')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ inviteUrl: string; expiresAt: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/parent/invite-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childFullName,
        childGrade: Number(childGrade),
        consentAccepted,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }

    setResult({ inviteUrl: data.inviteUrl, expiresAt: data.expiresAt })
  }

  if (result) {
    return (
      <ContentPage maxWidth={560}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#111' }}>
          Invite created
        </h1>
        <p style={{ color: '#111', marginBottom: '0.75rem' }}>
          Share this link with your child so they can create their account:
        </p>
        <div
          style={{
            padding: '0.75rem',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 4,
            wordBreak: 'break-all',
            fontSize: '0.9rem',
            color: '#111',
            marginBottom: '0.75rem',
          }}
        >
          {result.inviteUrl}
        </div>
        <p style={{ fontSize: '0.85rem', color: '#666' }}>
          This link expires on {new Date(result.expiresAt).toLocaleDateString()}.
        </p>
      </ContentPage>
    )
  }

  return (
    <ContentPage maxWidth={560}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111' }}>
        Add your child
      </h1>

      <form onSubmit={handleSubmit}>
        <label style={sharedStyles.label}>Child's full name</label>
        <input
          type="text"
          value={childFullName}
          onChange={(e) => setChildFullName(e.target.value)}
          required
          style={sharedStyles.input}
        />

        <label style={sharedStyles.label}>Grade</label>
        <select
          value={childGrade}
          onChange={(e) => setChildGrade(e.target.value)}
          style={sharedStyles.input}
        >
          <option value="9">9</option>
          <option value="10">10</option>
        </select>

        {childFullName && (
          <div
            style={{
              padding: '1rem',
              background: '#fafafa',
              border: '1px solid #ddd',
              borderRadius: 4,
              marginBottom: '1rem',
              maxHeight: 220,
              overflowY: 'auto',
              fontSize: '0.85rem',
              color: '#333',
              whiteSpace: 'pre-wrap',
            }}
          >
            {renderConsentText(childFullName)}
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#111' }}>
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            required
            style={{ marginTop: '0.2rem' }}
          />
          <span>I have read and agree to the consent terms above, on behalf of my child.</span>
        </label>

        {error && (
          <p style={{ color: 'crimson', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !consentAccepted}
          style={{
            ...sharedStyles.primaryButton,
            opacity: loading || !consentAccepted ? 0.6 : 1,
            cursor: loading || !consentAccepted ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Creating invite...' : 'Create invite'}
        </button>
      </form>
    </ContentPage>
  )
}