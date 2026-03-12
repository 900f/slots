// Simple in-memory rate limiter
// For production scale, swap the store for Vercel KV (upstash/redis)
// This works well for typical Vercel serverless usage patterns

const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1 }
  }

  if (entry.count >= max) {
    return { ok: false, remaining: 0 }
  }

  entry.count++
  return { ok: true, remaining: max - entry.count }
}

// Clean up old entries periodically (prevents memory growth)
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of store) {
    if (now > val.resetAt) store.delete(key)
  }
}, 60_000)
