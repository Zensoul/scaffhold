'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Shared route-group error boundary content. Next.js requires a
// separate error.tsx per route group/segment (App Router convention --
// a single shared one at the root doesn't catch group-level errors),
// but they can all render this same branded fallback rather than
// duplicating markup three times. Reports to Sentry (already wired in
// via sentry.server.config.ts / global-error.tsx) so a crash here is
// still tracked, not just shown to the user and lost.
export function ErrorFallback({
  error,
  reset,
  homeHref,
}: {
  error: Error & { digest?: string }
  reset: () => void
  homeHref: string
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-base font-medium text-foreground">Something went wrong</p>
          <p className="text-sm text-muted-foreground">
            This has been reported automatically. You can try again, or head back and pick up
            where you left off.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={reset}>
              Try again
            </Button>
            <Button size="sm" asChild>
              <a href={homeHref}>Back home</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
