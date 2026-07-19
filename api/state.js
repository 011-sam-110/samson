// api/state.js
// Serverless: cloud state GET/PUT. Thin wrapper — all logic + tests live in
// src/lib/state-api.js (injectable). Auth is our own session cookie (src/lib/auth.js),
// verified via userIdFromRequest; user_id is taken from the token, never the body.
import { handleState } from '../src/lib/state-api.js'
import { userIdFromRequest } from '../src/lib/auth.js'
import { makePool, sessionSecret } from '../src/lib/server.js'

export default async function handler(req, res) {
  const db = makePool()
  try {
    const { status, body } = await handleState(
      { method: req.method, headers: req.headers, body: req.body },
      { db, authenticate: (r) => userIdFromRequest(r, sessionSecret()) },
    )
    return res.status(status).json(body)
  } finally {
    await db.end()
  }
}
