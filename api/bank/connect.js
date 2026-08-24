// api/bank/connect.js — start a bank-connection flow. STUB: always 501.
// No Open Banking provider is configured. See src/lib/bank-handlers.js and
// docs/open-banking-spec.md before adding a real provider client here.
import { handleBankConnect } from '../../src/lib/bank-handlers.js'
import { sessionSecret } from '../../src/lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { status, body } = handleBankConnect({ headers: req.headers }, { sessionSecret: sessionSecret() })
  return res.status(status).json(body)
}
