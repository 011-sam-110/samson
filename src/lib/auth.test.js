import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearedSessionCookie,
  validateSignup,
  validateLogin,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
} from './auth.js'

describe('password hashing (scrypt + per-password salt)', () => {
  it('produces a self-describing, salted hash string', async () => {
    const h = await hashPassword('correct horse battery staple')
    expect(typeof h).toBe('string')
    // scrypt$N$r$p$salt$hash
    expect(h.split('$')).toHaveLength(6)
    expect(h.startsWith('scrypt$')).toBe(true)
  })

  it('salts: the same password hashes to different strings each time', async () => {
    const a = await hashPassword('hunter2hunter2')
    const b = await hashPassword('hunter2hunter2')
    expect(a).not.toBe(b)
  })

  it('verifies the correct password', async () => {
    const h = await hashPassword('s3cret-passphrase')
    expect(await verifyPassword('s3cret-passphrase', h)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const h = await hashPassword('s3cret-passphrase')
    expect(await verifyPassword('s3cret-passphras3', h)).toBe(false)
  })

  it('rejects a tampered/garbage stored hash without throwing', async () => {
    expect(await verifyPassword('whatever', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('whatever', 'scrypt$16384$8$1$AAAA$BBBB')).toBe(false)
  })
})

describe('session tokens (HS256 JWT)', () => {
  const secret = 'test-secret-key-32-bytes-minimum-abcdef'

  it('round-trips a payload', () => {
    const token = signSession({ sub: 'user-123' }, secret)
    const claims = verifySession(token, secret)
    expect(claims.sub).toBe('user-123')
    expect(typeof claims.iat).toBe('number')
    expect(typeof claims.exp).toBe('number')
  })

  it('has three dot-separated base64url parts', () => {
    const token = signSession({ sub: 'u' }, secret)
    expect(token.split('.')).toHaveLength(3)
  })

  it('rejects a token signed with a different secret', () => {
    const token = signSession({ sub: 'u' }, secret)
    expect(() => verifySession(token, 'a-different-secret-value-000000000')).toThrow()
  })

  it('rejects a tampered payload', () => {
    const token = signSession({ sub: 'u' }, secret)
    const [h, , s] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', iat: 1, exp: 9999999999 })).toString('base64url')
    expect(() => verifySession(`${h}.${forged}.${s}`, secret)).toThrow()
  })

  it('rejects an expired token', () => {
    const now = 1_700_000_000_000 // fixed ms epoch
    const token = signSession({ sub: 'u' }, secret, { expiresInSec: 60, now })
    // 61s later
    expect(() => verifySession(token, secret, { now: now + 61_000 })).toThrow(/expired/i)
  })

  it('accepts a still-valid token near expiry', () => {
    const now = 1_700_000_000_000
    const token = signSession({ sub: 'u' }, secret, { expiresInSec: 60, now })
    expect(verifySession(token, secret, { now: now + 59_000 }).sub).toBe('u')
  })

  it('rejects malformed tokens without throwing unexpected errors', () => {
    expect(() => verifySession('', secret)).toThrow()
    expect(() => verifySession('a.b', secret)).toThrow()
    expect(() => verifySession('a.b.c.d', secret)).toThrow()
  })
})

describe('cookies', () => {
  it('parses a Cookie header', () => {
    const c = parseCookies('session=abc.def.ghi; theme=dark')
    expect(c.session).toBe('abc.def.ghi')
    expect(c.theme).toBe('dark')
  })

  it('returns {} for missing/empty header', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
  })

  it('builds a hardened Set-Cookie for the session', () => {
    const c = sessionCookie('tok123')
    expect(c).toMatch(new RegExp(`^${SESSION_COOKIE}=tok123`))
    expect(c).toMatch(/HttpOnly/)
    expect(c).toMatch(/SameSite=Lax/)
    expect(c).toMatch(/Path=\//)
    expect(c).toMatch(new RegExp(`Max-Age=${SESSION_TTL_SEC}`))
  })

  it('marks the cookie Secure in production', () => {
    expect(sessionCookie('t', { secure: true })).toMatch(/Secure/)
    expect(sessionCookie('t', { secure: false })).not.toMatch(/Secure/)
  })

  it('clears the session cookie with Max-Age=0', () => {
    const c = clearedSessionCookie()
    expect(c).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
    expect(c).toMatch(/Max-Age=0/)
  })
})

describe('input validation', () => {
  it('accepts and normalizes a good signup', () => {
    const v = validateSignup({ email: '  Sam@Example.COM ', password: 'longenough1', username: '  Sam ' })
    expect(v.email).toBe('sam@example.com')
    expect(v.username).toBe('Sam')
    expect(v.password).toBe('longenough1')
  })

  it('rejects a malformed email', () => {
    expect(() => validateSignup({ email: 'not-an-email', password: 'longenough1' })).toThrow(/email/i)
  })

  it('rejects a short password', () => {
    expect(() => validateSignup({ email: 'a@b.com', password: 'short' })).toThrow(/password/i)
  })

  it('rejects missing fields', () => {
    expect(() => validateSignup({ email: 'a@b.com' })).toThrow()
    expect(() => validateSignup({ password: 'longenough1' })).toThrow()
  })

  it('defaults username to the email local-part when omitted', () => {
    const v = validateSignup({ email: 'jordan@uni.ac.uk', password: 'longenough1' })
    expect(v.username).toBe('jordan')
  })

  it('validateLogin normalizes email and requires a password', () => {
    const v = validateLogin({ email: ' A@B.com ', password: 'x' })
    expect(v.email).toBe('a@b.com')
    expect(() => validateLogin({ email: 'a@b.com' })).toThrow()
  })
})
