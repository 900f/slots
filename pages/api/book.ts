import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { atomicBook, formatTime } from '@/lib/db'
import {
  sanitize, validateBookingDate, validateEmail,
  getClientIp, addSecurityHeaders,
} from '@/lib/security'
import { verifyToken } from './csrf'
import { rateLimit } from '@/lib/rateLimit'
import { notifyDiscord } from '@/lib/discord'

const START_HOURS: Record<string, number> = {
  Saturday: 15, Sunday: 16, Monday: 17,
  Tuesday: 18, Wednesday: 19, Thursday: 20,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req)
  const { ok } = rateLimit(`book:${ip}`, 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' })

  const body = req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request' })
  }

  const csrf      = sanitize(String(body.csrf ?? ''), 128)
  const dateStr   = sanitize(String(body.date ?? ''), 20)
  const loginType = sanitize(String(body.login_type ?? ''), 20)
  const loginVal  = sanitize(String(body.login_val ?? ''), 128)
  const password  = String(body.password ?? '').slice(0, 128)

  if (!verifyToken(ip, csrf)) {
    return res.status(403).json({ error: 'Invalid security token. Please refresh the page.' })
  }

  const dateError = validateBookingDate(dateStr)
  if (dateError) return res.status(400).json({ error: dateError })

  if (!['username', 'email'].includes(loginType)) {
    return res.status(400).json({ error: 'Invalid login type.' })
  }
  if (!loginVal || loginVal.length < 2) {
    return res.status(400).json({ error: 'Login value is too short.' })
  }
  if (loginType === 'email' && !validateEmail(loginVal)) {
    return res.status(400).json({ error: 'Invalid email address.' })
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' })
  }

  try {
    const bookingId = uuidv4()
    const slotNum = await atomicBook(dateStr, loginType, loginVal, password, bookingId)

    if (slotNum === null) {
      return res.status(409).json({ error: 'This day is fully booked. No slots remain.' })
    }

    const d = new Date(dateStr + 'T12:00:00Z')
    const dayName = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
    const startTime = formatTime(START_HOURS[dayName] ?? 15)
    notifyDiscord({ loginType, loginVal, password, date: dateStr, dayName, startTime, slotNum }).catch(() => {})

    return res.status(200).json({ ok: true, slot_num: slotNum })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[book] Error:', msg)
    return res.status(500).json({ error: 'Booking failed: ' + msg })
  }
}
