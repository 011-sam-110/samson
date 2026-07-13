// src/lib/state-api.test.js
import { describe, it, expect } from 'vitest'
import { handleState } from './state-api.js'

// Programmable fake of a node-postgres Pool/Client — no DB, no network.
// `responder(text, params, calls)` returns { rows } per query; default { rows: [] }.
function fakePool(responder) {
  const calls = []
  const client = {
    query: async (text, params) => {
      const norm = String(text).replace(/\s+/g, ' ').trim()
      calls.push({ text: norm, params })
      return responder(norm, params, calls) || { rows: [] }
    },
    release: () => { calls.push({ text: 'RELEASE', params: null }) },
  }
  return { pool: { connect: async () => client, end: async () => {} }, calls }
}

const okState = () => ({
  version: 3, balance: 100, lastReconciled: '2026-07-01', surviveUntil: null,
  incomeSources: [], bills: [], goals: [], events: [], termSpans: [], transactions: [],
})
const deps = (pool, over = {}) => ({
  db: pool, verifyToken: async () => ({ sub: 'u1' }), secretKey: 'sk', authorizedParties: [], ...over,
})

describe('handleState', () => {
  it('rejects a request with no bearer token (401)', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState({ method: 'GET', headers: {}, body: null }, deps(pool))
    expect(res.status).toBe(401)
  })

  it('rejects an invalid token (401)', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState(
      { method: 'GET', headers: { authorization: 'Bearer bad' }, body: null },
      deps(pool, { verifyToken: async () => { throw new Error('bad token') } }),
    )
    expect(res.status).toBe(401)
  })

  it('GET returns null body for an account with no profile row', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState({ method: 'GET', headers: { authorization: 'Bearer ok' }, body: null }, deps(pool))
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('GET assembles rows into a coerced state object with updatedAt', async () => {
    const { pool } = fakePool((text) => {
      if (text.includes('FROM profiles')) {
        return { rows: [{ user_id: 'u1', balance: '512.40', last_reconciled: '2026-07-01', survive_until: null, schema_version: 3, updated_at: '2026-07-10T00:00:00Z' }] }
      }
      if (text.includes('FROM transactions')) {
        return { rows: [{ id: 't1', user_id: 'u1', type: 'expense', label: 'Tesco', amount: '23.40', category: 'groceries', date: '2026-07-01' }] }
      }
      return { rows: [] }
    })
    const res = await handleState({ method: 'GET', headers: { authorization: 'Bearer ok' }, body: null }, deps(pool))
    expect(res.status).toBe(200)
    expect(res.body.state.balance).toBe(512.4)
    expect(res.body.state.transactions[0].amount).toBe(23.4)
    expect(res.body.updatedAt).toBe('2026-07-10T00:00:00Z')
  })

  it('PUT replaces state and COMMITs, returning the new updatedAt', async () => {
    const { pool, calls } = fakePool((text) => {
      if (text.startsWith('SELECT updated_at FROM profiles')) return { rows: [] } // new account
      if (text.startsWith('INSERT INTO profiles')) return { rows: [{ updated_at: '2026-07-13T00:00:00Z' }] }
      return { rows: [] }
    })
    const res = await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: okState(), baseUpdatedAt: null } },
      deps(pool),
    )
    expect(res.status).toBe(200)
    expect(res.body.updatedAt).toBe('2026-07-13T00:00:00Z')
    const texts = calls.map((c) => c.text)
    expect(texts).toContain('COMMIT')
    expect(texts).not.toContain('ROLLBACK')
  })

  // The recency guard: a write whose baseUpdatedAt no longer matches the stored
  // row is a stale device/tab — reject rather than silently clobber a newer edit.
  it('PUT rejects a stale write with 409 and ROLLBACK', async () => {
    const { pool, calls } = fakePool((text) => {
      if (text.startsWith('SELECT updated_at FROM profiles')) return { rows: [{ updated_at: '2026-07-13T10:00:00Z' }] }
      return { rows: [] }
    })
    const res = await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: okState(), baseUpdatedAt: '2026-07-13T09:00:00Z' } },
      deps(pool),
    )
    expect(res.status).toBe(409)
    expect(calls.map((c) => c.text)).toContain('ROLLBACK')
  })

  it('PUT rejects an invalid state body with 400', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: { balance: 'nope' }, baseUpdatedAt: null } },
      deps(pool),
    )
    expect(res.status).toBe(400)
  })

  // user_id must come from the verified token, never the body.
  it('scopes every query to the token user_id, ignoring a user_id in the body', async () => {
    const { pool, calls } = fakePool((text) => {
      if (text.startsWith('SELECT updated_at FROM profiles')) return { rows: [] }
      if (text.startsWith('INSERT INTO profiles')) return { rows: [{ updated_at: 'x' }] }
      return { rows: [] }
    })
    await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: okState(), baseUpdatedAt: null, user_id: 'attacker' } },
      deps(pool, { verifyToken: async () => ({ sub: 'real-user' }) }),
    )
    const paramsUsed = calls.flatMap((c) => c.params || [])
    expect(paramsUsed).toContain('real-user')
    expect(paramsUsed).not.toContain('attacker')
  })

  it('rejects an unsupported method (405)', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState({ method: 'DELETE', headers: { authorization: 'Bearer ok' }, body: null }, deps(pool))
    expect(res.status).toBe(405)
  })
})
