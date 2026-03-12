import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, requireAdmin } from '@/lib/session'
import { getWeekSummary } from '@/lib/db'
import { addSecurityHeaders, getClientIp } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getSession(req, res)
  if (!requireAdmin(session)) return res.status(401).json({ error: 'Unauthorized' })

  const ip = getClientIp(req)
  const { ok } = rateLimit(`admin_week:${ip}`, 60, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const { saturday } = req.query
  if (!saturday || typeof saturday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saturday)) {
    return res.status(400).json({ error: 'Invalid date' })
  }

  try {
    const data = await getWeekSummary(saturday)
    return res.status(200).json({ ok: true, data, username: session.username })
  } catch (e) {
    console.error('[admin/week]', e)
    return res.status(500).json({ error: 'Failed to load data' })
  }
}
