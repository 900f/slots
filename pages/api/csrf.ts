import type { NextApiRequest, NextApiResponse } from 'next'
import { getClientIp, addSecurityHeaders } from '@/lib/security'
import crypto from 'crypto'

const SECRET = process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-prod-min-32-chars!!'

export function generateToken(seed: string): string {
  const window = Math.floor(Date.now() / 3_600_000)
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${seed}:${window}`)
    .digest('hex')
}

export function verifyToken(seed: string, token: string): boolean {
  if (!token || token.length !== 64) return false
  const window = Math.floor(Date.now() / 3_600_000)
  for (const w of [window, window - 1]) {
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${seed}:${w}`)
      .digest('hex')
    try {
      if (crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))) {
        return true
      }
    } catch {
      // invalid hex
    }
  }
  return false
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const ip = getClientIp(req)
  const token = generateToken(ip)
  return res.status(200).json({ token })
}
