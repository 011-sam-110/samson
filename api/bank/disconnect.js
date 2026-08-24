// api/bank/disconnect.js — revoke a bank connection. STUB: always 501.
// No Open Banking provider is configured. See src/lib/bank-handlers.js and
// docs/open-banking-spec.md before adding a real provider client here.
import { handleBankDisconnect } from '../../src/lib/bank-handlers.js'
import { sessionSecret } from '../../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { status, body } = handleBankDisconnect({ headers: req.headers }, { sessionSecret: sessionSecret() })
  return res.status(status).json(body)
}
