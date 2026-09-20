'use client'

import { useState } from 'react'

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
    return <p style={{ fontSize: '0.85rem', color: '#666' }}>Account deleted.</p>
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
      <a
        href={`/api/parent/students/${studentProfileId}/data`}
        style={{ fontSize: '0.8rem', color: '#2563eb' }}
      >
        Download my child's data
      </a>
      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{
          fontSize: '0.8rem',
          color: '#b91c1c',
          background: 'none',
          border: 'none',
          cursor: deleting ? 'default' : 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        {deleting ? 'Deleting...' : 'Delete account and all data'}
      </button>
    </div>
  )
}