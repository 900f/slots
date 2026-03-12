import { getIronSession, IronSession, SessionOptions } from 'iron-session'
import { NextApiRequest, NextApiResponse } from 'next'

export type SessionData = {
  username?: string
  isAdmin?: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'booking_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 hours
  },
}

export async function getSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, res, sessionOptions)
}

export function requireAdmin(session: SessionData): boolean {
  return session.isAdmin === true && !!session.username
}
