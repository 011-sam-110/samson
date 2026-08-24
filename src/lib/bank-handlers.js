// src/lib/bank-handlers.js
// Pure request handlers for the bank-connection endpoints, same seam as
// src/lib/auth-handlers.js / src/lib/state-api.js (deps injected, so this
// unit-tests with no network/DB/provider). Every branch below returns 501
// today because there is NO Open Banking provider configured on this
// deployment — see docs/open-banking-spec.md. Nothing here calls out to a
// real bank, stores a token, or invents a credential.
import { userIdFromRequest } from './auth.js'

const NOT_CONFIGURED = {
  status: 501,
  body: {
    error: 'Bank connections are not set up yet.',
    detail: 'No Open Banking provider is configured on this deployment. See docs/open-banking-spec.md.',
  },
}

function requireUser(req, sessionSecret) {
  const userId = userIdFromRequest(req, sessionSecret)
  if (!userId) return { status: 401, body: { error: 'Not signed in' } }
  return null
}

// POST /api/bank/connect — would start a provider consent flow: create a
// requisition / link token with the chosen aggregator and return a redirect
// URL for the user's bank-consent screen.
// TODO: needs a real <PROVIDER>_CLIENT_ID / <PROVIDER>_CLIENT_SECRET once Sam
// signs up with the provider chosen in docs/open-banking-spec.md, then:
//   1. call the provider's "create requisition / link token" endpoint
//   2. insert a `pending` bank_connections row (schema.sql)
//   3. return { redirectUrl } for the client to navigate to
export function handleBankConnect(req, deps) {
  const authError = requireUser(req, deps.sessionSecret)
  if (authError) return authError
  return NOT_CONFIGURED
}

// GET /api/bank/callback — would receive the provider's redirect after
// consent, exchange the auth code for tokens, encrypt them
// (src/lib/bank-crypto.js) and mark the bank_connections row `active`.
// TODO: same prerequisite as handleBankConnect.
export function handleBankCallback(req, deps) {
  const authError = requireUser(req, deps.sessionSecret)
  if (authError) return authError
  return NOT_CONFIGURED
}

// POST /api/bank/disconnect — would revoke the provider token (their API, not
// just our DB) and delete the bank_connections + bank_accounts rows.
// TODO: same prerequisite as handleBankConnect.
export function handleBankDisconnect(req, deps) {
  const authError = requireUser(req, deps.sessionSecret)
  if (authError) return authError
  return NOT_CONFIGURED
}
