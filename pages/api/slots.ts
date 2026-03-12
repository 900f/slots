import type { NextApiRequest, NextApiResponse } from 'next'
import { getWeekSummary } from '@/lib/db'
import { addSecurityHeaders, getClientIp } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req)
  const { ok } = rateLimit(`slots:${ip}`, 60, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const { saturday } = req.query
  if (!saturday || typeof saturday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saturday)) {
    return res.status(400).json({ error: 'Invalid date' })
  }

  try {
    const data = await getWeekSummary(saturday)
    return res.status(200).json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slots] Error:', msg)
    return res.status(500).json({ error: msg })
  }
}
