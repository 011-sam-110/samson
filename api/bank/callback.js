// api/bank/callback.js — receive the provider's OAuth redirect. STUB: always 501.
// No Open Banking provider is configured. See src/lib/bank-handlers.js and
// docs/open-banking-spec.md before adding a real provider client here.
import { handleBankCallback } from '../../src/lib/bank-handlers.js'
import { sessionSecret } from '../../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const { status, body } = handleBankCallback({ headers: req.headers }, { sessionSecret: sessionSecret() })
  return res.status(status).json(body)
}
