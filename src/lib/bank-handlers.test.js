import { describe, it, expect } from 'vitest'
import { handleBankConnect, handleBankCallback, handleBankDisconnect } from './bank-handlers.js'
import { signSession, sessionCookie } from './auth.js'

const SECRET = 'test-session-secret'

function signedInReq(userId = 'user_1') {
  const token = signSession({ sub: userId }, SECRET)
  return { headers: { cookie: sessionCookie(token, { secure: false }).split(';')[0] } }
}

const guestReq = { headers: {} }

describe('bank-handlers (all stubbed — no provider configured)', () => {
  for (const [name, handler] of [
    ['handleBankConnect', handleBankConnect],
    ['handleBankCallback', handleBankCallback],
    ['handleBankDisconnect', handleBankDisconnect],
  ]) {
    describe(name, () => {
      it('401s a signed-out request before touching anything else', async () => {
        const res = await handler(guestReq, { sessionSecret: SECRET })
        expect(res.status).toBe(401)
      })

      it('501s a signed-in request with an honest "not configured" message', async () => {
        const res = await handler(signedInReq(), { sessionSecret: SECRET })
        expect(res.status).toBe(501)
        expect(res.body.error).toMatch(/not set up/i)
        expect(res.body.detail).toMatch(/open-banking-spec\.md/)
      })
    })
  }
})
