// api/auth/logout.js — clear the session cookie.
import { handleLogout } from '../../src/lib/auth-handlers.js'
import { cookieSecure, sendCookies } from '../../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { status, body, cookies } = handleLogout({ secure: cookieSecure() })
  sendCookies(res, cookies)
  return res.status(status).json(body)
}
