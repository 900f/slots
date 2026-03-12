import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/session'
import { addSecurityHeaders } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  addSecurityHeaders(res)
  const session = await getSession(req, res)
  session.destroy()
  return res.status(200).json({ ok: true })
}
