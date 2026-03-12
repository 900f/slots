import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, requireAdmin } from '@/lib/session'
import { cancelBooking } from '@/lib/db'
import { sanitize, addSecurityHeaders, getClientIp } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getSession(req, res)
  if (!requireAdmin(session)) return res.status(401).json({ error: 'Unauthorized' })

  const ip = getClientIp(req)
  const { ok } = rateLimit(`admin_cancel:${ip}`, 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const body = req.body
  const date     = sanitize(String(body?.date ?? ''), 20)
  const slotNum  = parseInt(String(body?.slot_num ?? ''), 10)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' })
  }
  if (![1, 2, 3, 4].includes(slotNum)) {
    return res.status(400).json({ error: 'Invalid slot number' })
  }

  const deleted = await cancelBooking(date, slotNum)
  if (!deleted) return res.status(404).json({ error: 'Booking not found' })

  return res.status(200).json({ ok: true })
}
