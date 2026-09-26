'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * The single most direct fix for "no proper back button": every page
 * that isn't a top-level dashboard should render this. `href`, when
 * given, always wins over router.back() -- browser back history is
 * unreliable after a server redirect (e.g. the start-and-redirect POST
 * flow), so any page reached via a redirect chain should pass an
 * explicit href to its real logical parent instead of trusting history.
 */
export function BackButton({ href, label = 'Back' }: { href?: string; label?: string }) {
  const router = useRouter()

  if (href) {
    return (
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href={href}>
          <ChevronLeftIcon />
          {label}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground"
      onClick={() => router.back()}
    >
      <ChevronLeftIcon />
      {label}
    </Button>
  )
}

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
