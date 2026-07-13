// api/state.js
// Serverless: cloud state GET/PUT. Thin wrapper — all logic + tests live in
// src/lib/state-api.js (injectable), the same split as api/extract.js -> src/lib/llm.js.
import { Pool } from '@neondatabase/serverless'
import { verifyToken } from '@clerk/backend'
import { handleState } from '../src/lib/state-api.js'

export default async function handler(req, res) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { status, body } = await handleState(
      { method: req.method, headers: req.headers, body: req.body },
      {
        db: pool,
        verifyToken,
        secretKey: process.env.CLERK_SECRET_KEY,
        authorizedParties: (process.env.APP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
      },
    )
    return res.status(status).json(body)
  } finally {
    await pool.end()
  }
}
