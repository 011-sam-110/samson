// api/auth/login.js — verify credentials, return a session cookie.
import { handleLogin } from '../../src/lib/auth-handlers.js'
import { makePool, sessionSecret, cookieSecure, sendCookies } from '../../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const db = makePool()
  try {
    const { status, body, cookies } = await handleLogin(
      { body: req.body },
      { db, sessionSecret: sessionSecret(), secure: cookieSecure() },
    )
    sendCookies(res, cookies)
    return res.status(status).json(body)
  } finally {
    await db.end()
  }
}
