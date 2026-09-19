// Shared layout primitives used across every page (Mode 1/2/3, login,
// register, home). Centralizing these here means a future styling
// change (spacing, colors, adding real dark-mode support properly) is
// one edit, not a hunt through every page file — exactly the
// duplication problem today's ad hoc inline-style pattern created.

import { CSSProperties } from 'react'

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
    background: '#f5f5f5',
    padding: '2rem 1rem',
  }

  const cardStyle: CSSProperties = {
    width: '100%',
    maxWidth,
    padding: '2rem',
    color: '#111',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
export function ContentPage({
  children,
  maxWidth = 640,
}: {
  children: React.ReactNode
  maxWidth?: number
}) {
  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: '#f5f5f5',
    padding: '2rem 1rem',
  }

  const cardStyle: CSSProperties = {
    maxWidth,
    margin: '0 auto',
    color: '#111',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '2rem',
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>{children}</div>
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
    color: '#111',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: '1rem',
  } as CSSProperties,

  label: {
    display: 'block',
    marginBottom: '0.25rem',
    fontSize: '0.85rem',
    color: '#444',
  } as CSSProperties,

  primaryButton: {
    padding: '0.6rem 1rem',
    color: '#fff',
    background: '#2563eb',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '1rem',
  } as CSSProperties,

  secondaryButton: {
    padding: '0.4rem 0.8rem',
    color: '#111',
    background: '#eee',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
  } as CSSProperties,
}