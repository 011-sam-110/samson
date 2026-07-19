import { describe, it, expect } from 'vitest'
import { handleSignup, handleLogin, handleLogout, handleMe, handleUsage } from './auth-handlers.js'
import { hashPassword, signSession, sessionCookie, parseCookies, verifySession, SESSION_COOKIE } from './auth.js'

const SECRET = 'unit-test-session-secret-abcdefghij'

// Programmable fake of a pg/neon Pool — routes by the leading SQL, records calls.
function fakeDb(routes = {}) {
  const calls = []
  return {
    calls,
    query: async (text, params) => {
      const norm = String(text).replace(/\s+/g, ' ').trim()
      calls.push({ norm, params })
      for (const [prefix, fn] of Object.entries(routes)) {
        if (norm.startsWith(prefix)) return fn(params)
      }
      return { rows: [] }
    },
  }
}

// Pull the session token out of a Set-Cookie string.
const tokenFromCookies = (cookies) => parseCookies(cookies[0])[SESSION_COOKIE]

describe('signup', () => {
  it('creates a user and returns a valid session cookie (201)', async () => {
    const db = fakeDb({ 'INSERT INTO users': () => ({ rows: [] }) })
    const res = await handleSignup(
      { body: { email: ' New@Uni.AC.uk ', password: 'longenough1', username: 'Jo' } },
      { db, sessionSecret: SECRET, secure: false },
    )
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('new@uni.ac.uk')
    expect(res.body.user.username).toBe('Jo')
    const token = tokenFromCookies(res.cookies)
    expect(verifySession(token, SECRET).sub).toBe(res.body.user.id)
    // password is stored hashed, never in the clear
    const insert = db.calls.find((c) => c.norm.startsWith('INSERT INTO users'))
    expect(insert.params).not.toContain('longenough1')
    expect(insert.params.some((p) => typeof p === 'string' && p.startsWith('scrypt$'))).toBe(true)
  })

  it('rejects a duplicate email with 409', async () => {
    const db = fakeDb({ 'INSERT INTO users': () => { throw Object.assign(new Error('dup'), { code: '23505' }) } })
    const res = await handleSignup(
      { body: { email: 'taken@uni.ac.uk', password: 'longenough1' } },
      { db, sessionSecret: SECRET },
    )
    expect(res.status).toBe(409)
  })

  it('rejects invalid input with 400 and never touches the DB', async () => {
    const db = fakeDb({})
    const res = await handleSignup({ body: { email: 'nope', password: 'x' } }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(400)
    expect(db.calls).toHaveLength(0)
  })
})

describe('login', () => {
  async function dbWithUser() {
    const password_hash = await hashPassword('longenough1')
    return fakeDb({
      'SELECT id, email, username, password_hash FROM users':
        () => ({ rows: [{ id: 'u-1', email: 'sam@uni.ac.uk', username: 'sam', password_hash }] }),
      'UPDATE users SET last_login': () => ({ rows: [] }),
    })
  }

  it('logs in with the right password (200 + cookie)', async () => {
    const db = await dbWithUser()
    const res = await handleLogin({ body: { email: 'Sam@uni.ac.uk', password: 'longenough1' } }, { db, sessionSecret: SECRET, secure: false })
    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe('u-1')
    expect(verifySession(tokenFromCookies(res.cookies), SECRET).sub).toBe('u-1')
  })

  it('rejects a wrong password with a generic 401', async () => {
    const db = await dbWithUser()
    const res = await handleLogin({ body: { email: 'sam@uni.ac.uk', password: 'wrongpass99' } }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/wrong email or password/i)
  })

  it('rejects an unknown email with the same generic 401', async () => {
    const db = fakeDb({ 'SELECT id, email, username, password_hash FROM users': () => ({ rows: [] }) })
    const res = await handleLogin({ body: { email: 'ghost@uni.ac.uk', password: 'longenough1' } }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/wrong email or password/i)
  })
})

describe('logout', () => {
  it('returns a cleared session cookie', () => {
    const res = handleLogout({ secure: false })
    expect(res.status).toBe(200)
    expect(res.cookies[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
    expect(res.cookies[0]).toMatch(/Max-Age=0/)
  })
})

describe('me', () => {
  it('returns the signed-in user from the session cookie', async () => {
    const db = fakeDb({ 'SELECT id, email, username FROM users': () => ({ rows: [{ id: 'u-9', email: 'a@b.com', username: 'a' }] }) })
    const token = signSession({ sub: 'u-9' }, SECRET)
    const res = await handleMe({ headers: { cookie: sessionCookie(token, { secure: false }) } }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe('u-9')
  })

  it('401s with no cookie', async () => {
    const db = fakeDb({})
    const res = await handleMe({ headers: {} }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(401)
  })

  it('401s when the token is valid but the user no longer exists', async () => {
    const db = fakeDb({ 'SELECT id, email, username FROM users': () => ({ rows: [] }) })
    const token = signSession({ sub: 'ghost' }, SECRET)
    const res = await handleMe({ headers: { cookie: `${SESSION_COOKIE}=${token}` } }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(401)
  })
})

describe('usage tracking', () => {
  it('records an event for a signed-in user (202)', async () => {
    const db = fakeDb({ 'INSERT INTO usage_events': () => ({ rows: [] }) })
    const token = signSession({ sub: 'u-3' }, SECRET)
    const res = await handleUsage(
      { headers: { cookie: `${SESSION_COOKIE}=${token}` }, body: { event: 'view_insights', meta: { tab: 'spend' } } },
      { db, sessionSecret: SECRET },
    )
    expect(res.status).toBe(202)
    const insert = db.calls.find((c) => c.norm.startsWith('INSERT INTO usage_events'))
    expect(insert.params[0]).toBe('u-3') // user_id from the token, not the body
    expect(insert.params[1]).toBe('view_insights')
  })

  it('401s an anonymous usage ping', async () => {
    const db = fakeDb({})
    const res = await handleUsage({ headers: {}, body: { event: 'x' } }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(401)
  })

  it('400s a ping with no event name', async () => {
    const db = fakeDb({})
    const token = signSession({ sub: 'u-3' }, SECRET)
    const res = await handleUsage({ headers: { cookie: `${SESSION_COOKIE}=${token}` }, body: {} }, { db, sessionSecret: SECRET })
    expect(res.status).toBe(400)
  })
})
