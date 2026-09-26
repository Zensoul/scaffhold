'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/shell/back-button'
import { renderConsentText } from '@/lib/legal/dpdp-consent'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function InviteStudentPage() {
  const [childFullName, setChildFullName] = useState('')
  const [childGrade, setChildGrade] = useState('10')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ inviteUrl: string; expiresAt: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail silently (permissions, insecure context) —
      // the link is still selectable/visible in the box below, so this
      // isn't a dead end even if copy doesn't work.
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <BackButton href="/dashboard" label="Your children" />

      {result ? (
        <Card className="mt-4">
          <CardContent className="py-6">
            <h1 className="mb-1 text-lg font-semibold text-foreground">Invite created</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Share this link with your child so they can create their account.
            </p>
            <div className="mb-2 flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-2.5">
              <span className="flex-1 truncate text-sm text-foreground">{result.inviteUrl}</span>
              <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="mb-5 text-xs text-muted-foreground">
              This link expires on {new Date(result.expiresAt).toLocaleDateString()}.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setResult(null)
                setChildFullName('')
                setConsentAccepted(false)
              }}
            >
              Add another child
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardContent className="py-6">
            <h1 className="mb-1 text-lg font-semibold text-foreground">Add your child</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              We&apos;ll generate an invite link for them to set up their own account.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Child&apos;s full name</label>
                <input
                  type="text"
                  value={childFullName}
                  onChange={(e) => setChildFullName(e.target.value)}
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Grade</label>
                <select value={childGrade} onChange={(e) => setChildGrade(e.target.value)} className={inputClass}>
                  <option value="9">9</option>
                  <option value="10">10</option>
                </select>
              </div>

              {childFullName && (
                <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border bg-secondary/40 p-4 text-sm text-muted-foreground">
                  {renderConsentText(childFullName)}
                </div>
              )}

              <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  required
                  className="mt-0.5 size-4 rounded border-input"
                />
                <span>I have read and agree to the consent terms above, on behalf of my child.</span>
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={loading || !consentAccepted}>
                {loading ? 'Creating invite…' : 'Create invite'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
