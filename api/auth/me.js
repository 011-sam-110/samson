// api/auth/me.js — who am I? (session cookie -> user, or 401).
import { handleMe } from '../../src/lib/auth-handlers.js'
import { makePool, sessionSecret } from '../../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const db = makePool()
  try {
    const { status, body } = await handleMe({ headers: req.headers }, { db, sessionSecret: sessionSecret() })
    return res.status(status).json(body)
  } finally {
    await db.end()
  }
}
