// api/usage.js — record one usage event for the signed-in user (best-effort).
import { handleUsage } from '../src/lib/auth-handlers.js'
import { makePool, sessionSecret } from '../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const db = makePool()
  try {
    const { status, body } = await handleUsage(
      { headers: req.headers, body: req.body },
      { db, sessionSecret: sessionSecret() },
    )
    return res.status(status).json(body)
  } finally {
    await db.end()
  }
}
