import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

const SECRET = process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-prod'

// CSRF token: HMAC of session ID + hour window, valid for 2 hours
export function generateCsrfToken(sessionId: string): string {
  const window = Math.floor(Date.now() / 3_600_000)
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${sessionId}:${window}`)
    .digest('hex')
}

export function verifyCsrfToken(sessionId: string, token: string): boolean {
  if (!token || token.length !== 64) return false
  const window = Math.floor(Date.now() / 3_600_000)
  for (const w of [window, window - 1]) {
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${sessionId}:${w}`)
      .digest('hex')
    try {
      if (crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))) {
        return true
      }
    } catch {
      // invalid hex — ignore
    }
  }
  return false
}

// Strip dangerous chars from user input
export function sanitize(s: unknown, maxLen = 128): string {
  if (typeof s !== 'string') return ''
  return s.replace(/[<>"';&`]/g, '').trim().slice(0, maxLen)
}

// Validate date string is YYYY-MM-DD and is a valid Sat–Thu
const VALID_DAYS = new Set(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'])
export function validateBookingDate(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Invalid date format.'
  const d = new Date(dateStr + 'T12:00:00Z')
  if (isNaN(d.getTime())) return 'Invalid date.'
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  if (!VALID_DAYS.has(dayName)) return 'Bookings only available Saturday–Thursday.'
  return null
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    if (ba.length !== bb.length) {
      crypto.timingSafeEqual(ba, ba) // dummy op to keep timing consistent
      return false
    }
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return ip.trim()
  }
  return req.socket?.remoteAddress || '127.0.0.1'
}

export function addSecurityHeaders(res: NextApiResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cache-Control', 'no-store')
}
