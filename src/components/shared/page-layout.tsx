// Shared layout primitives used across every page (Mode 1/2/3, login,
// register, home). Centralizing these here means a future styling
// change (spacing, colors, adding real dark-mode support properly) is
// one edit, not a hunt through every page file — exactly the
// duplication problem today's ad hoc inline-style pattern created.
//
// Colors here use the same CSS custom properties as the Tailwind/shadcn
// design system (globals.css), not hardcoded hex, so this legacy
// component set and the newer Card/Button/Badge components stay
// visually consistent rather than drifting into two different themes.

import { CSSProperties } from 'react'
import { BackButton } from '@/components/shell/back-button'

// Full-viewport centered wrapper — for auth pages (login/register) and
// any single-card, narrow-content page.
export function CenteredPage({
  children,
  maxWidth = 400,
}: {
  children: React.ReactNode
  maxWidth?: number
}) {
  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--background)',
    padding: '2rem 1rem',
  }

  const cardStyle: CSSProperties = {
    width: '100%',
    maxWidth,
    padding: '2rem',
    color: 'var(--card-foreground)',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>{children}</div>
    </main>
  )
}

// Full-viewport, top-aligned wrapper — for content pages (Mode 1/2/3,
// home) that are typically longer than one screen and shouldn't be
// vertically centered like a login card.
//
// `backHref`, when given, renders a BackButton above the content card
// with that destination — every Mode 2/3 page passes the student's
// dashboard so there is always a visible way out of a problem, not
// just the browser's own back button (which is unreliable here since
// these pages are often reached through a server redirect chain).
export function ContentPage({
  children,
  maxWidth = 640,
  backHref,
  backLabel = 'Back',
}: {
  children: React.ReactNode
  maxWidth?: number
  backHref?: string
  backLabel?: string
}) {
  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: 'var(--background)',
    padding: '1.5rem 1rem 2rem',
  }

  const wrapperStyle: CSSProperties = {
    maxWidth,
    margin: '0 auto',
  }

  const cardStyle: CSSProperties = {
    color: 'var(--card-foreground)',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: '2rem',
  }

  return (
    <main style={pageStyle}>
      <div style={wrapperStyle}>
        {backHref && (
          <div style={{ marginBottom: '0.5rem' }}>
            <BackButton href={backHref} label={backLabel} />
          </div>
        )}
        <div style={cardStyle}>{children}</div>
      </div>
    </main>
  )
}

// Shared input/label/button styles, so form fields look identical
// across login, register, and any future form page.
export const sharedStyles = {
  input: {
    width: '100%',
    padding: '0.5rem',
    marginBottom: '1rem',
    color: 'var(--foreground)',
    background: 'var(--background)',
    border: '1px solid var(--input)',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
  } as CSSProperties,

  label: {
    display: 'block',
    marginBottom: '0.25rem',
    fontSize: '0.85rem',
    color: 'var(--muted-foreground)',
  } as CSSProperties,

  primaryButton: {
    padding: '0.6rem 1rem',
    color: 'var(--primary-foreground)',
    background: 'var(--primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '1rem',
  } as CSSProperties,

  secondaryButton: {
    padding: '0.4rem 0.8rem',
    color: 'var(--secondary-foreground)',
    background: 'var(--secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  } as CSSProperties,
}
