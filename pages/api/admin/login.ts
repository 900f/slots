import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/session'
import { timingSafeCompare, sanitize, getClientIp, addSecurityHeaders } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req)
  const { ok } = rateLimit(`admin_login:${ip}`, 10, 60_000)
  if (!ok) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' })
  }

  const body = req.body
  const username = sanitize(String(body?.username ?? ''), 64)
  const password = String(body?.password ?? '').slice(0, 128)

  const expectedUser = process.env.ADMIN_USERNAME ?? ''
  const expectedPass = process.env.ADMIN_PASSWORD ?? ''

  // Timing-safe comparison for both fields
  const userOk = timingSafeCompare(username, expectedUser)
  const passOk = timingSafeCompare(password, expectedPass)

  if (!userOk || !passOk) {
    // Artificial delay to slow brute force
    await new Promise(r => setTimeout(r, 600))
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const session = await getSession(req, res)
  session.username = username
  session.isAdmin  = true
  await session.save()

  return res.status(200).json({ ok: true })
}
