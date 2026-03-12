import type { NextApiRequest, NextApiResponse } from 'next'
import { initDb } from '@/lib/db'
import { addSecurityHeaders } from '@/lib/security'

// Protected setup endpoint — only callable with ADMIN_PASSWORD as Bearer token
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)

  const auth = req.headers.authorization ?? ''
  const expected = `Bearer ${process.env.ADMIN_PASSWORD ?? ''}`
  if (auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await initDb()
    return res.status(200).json({ ok: true, message: 'Database initialized.' })
  } catch (e) {
    console.error('[init-db]', e)
    return res.status(500).json({ error: String(e) })
  }
}
