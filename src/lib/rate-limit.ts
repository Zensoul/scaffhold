// Lightweight in-memory rate limiter for AI-call routes.
//
// NOT a distributed limiter -- state lives in this Node process's
// memory, so it resets on redeploy and does not coordinate across
// multiple server instances if this app is ever horizontally scaled.
// That's an acceptable tradeoff for a single-instance deployment: the
// goal here is to catch runaway cost from a bug or abusive client
// (e.g. a bypassed double-click guard, or someone scripting requests
// directly against the API), not to enforce precise fairness across a
// fleet. If this app scales to multiple instances, replace this with a
// real distributed limiter (Upstash Redis + @upstash/ratelimit is the
// standard Next.js pairing) -- the call sites below only need their
// import changed, not their call shape.
//
// Sliding-window-ish: tracks timestamps per key, drops ones older than
// the window, and rejects once the count exceeds the limit.

const buckets = new Map<string, number[]>()

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number }

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0]
    return { allowed: false, retryAfterMs: windowMs - (now - oldestInWindow) }
  }

  timestamps.push(now)
  buckets.set(key, timestamps)
  return { allowed: true }
}

// Periodic cleanup so `buckets` doesn't grow unboundedly with entries
// for students who stopped hitting the API. Runs on module load in the
// server process; harmless if it runs more than once across hot
// reloads in dev.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of buckets) {
    const fresh = timestamps.filter((t) => now - t < CLEANUP_INTERVAL_MS)
    if (fresh.length === 0) {
      buckets.delete(key)
    } else {
      buckets.set(key, fresh)
    }
  }
}, CLEANUP_INTERVAL_MS).unref?.()
