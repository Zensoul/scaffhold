'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function DataControls({
  studentProfileId,
  childName,
}: {
  studentProfileId: string
  childName: string
}) {
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      `This will permanently delete ${childName}'s account and all their learning data. ` +
        `This cannot be undone. Are you sure?`
    )
    if (!confirmed) return

    setDeleting(true)
    const res = await fetch(`/api/parent/students/${studentProfileId}/data`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setDeleted(true)
    } else {
      alert('Something went wrong. Please try again or contact support.')
      setDeleting(false)
    }
  }

  if (deleted) {
    return <p className="text-sm text-muted-foreground">Account deleted.</p>
  }

  return (
    <div className="mt-2 flex items-center gap-4">
      <a
        href={`/api/parent/students/${studentProfileId}/data`}
        className="text-sm font-medium text-primary hover:underline"
      >
        Download my child&apos;s data
      </a>
      <Button
        variant="link"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
        className="h-auto p-0 text-sm text-destructive hover:no-underline hover:underline"
      >
        {deleting ? 'Deleting…' : 'Delete account and all data'}
      </Button>
    </div>
  )
}
