// src/lib/auth.js
// Self-managed credential auth for Leeway — password encryption + salting and
// signed session tokens, built ONLY on Node's built-in `crypto` (no native deps,
// so it deploys clean on Vercel serverless). No third-party auth provider.
//
// - Passwords: scrypt (memory-hard KDF) with a random per-password salt. The
//   stored string is self-describing (`scrypt$N$r$p$salt$hash`) so params can be
//   rotated without breaking existing users. Verification is constant-time.
// - Sessions: a compact HS256 JWT, HMAC-signed with SESSION_SECRET, delivered in
//   an HttpOnly + SameSite=Lax + Secure cookie so the browser never exposes it to JS.
import { randomBytes, scrypt as _scrypt, createHmac, timingSafeEqual, randomUUID } from 'node:crypto'

// --- scrypt params (128 * N * r ≈ 16 MB at these values, under Node's 32 MB default) ---
const N = 16384
const R = 8
const P = 1
const KEYLEN = 32
const SALT_BYTES = 16

const scrypt = (password, salt, keylen) =>
  new Promise((resolve, reject) =>
    _scrypt(password, salt, keylen, { N, r: R, p: P }, (err, dk) => (err ? reject(err) : resolve(dk))),
  )

export const SESSION_COOKIE = 'session'
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30 // 30 days

export function newUserId() {
  return randomUUID()
}

// --- password hashing -------------------------------------------------------
export async function hashPassword(password) {
  if (typeof password !== 'string' || !password) throw new Error('password required')
  const salt = randomBytes(SALT_BYTES)
  const hash = await scrypt(password, salt, KEYLEN)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export async function verifyPassword(password, stored) {
  try {
    if (typeof stored !== 'string') return false
    const parts = stored.split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const [, n, r, p, saltB64, hashB64] = parts
    const salt = Buffer.from(saltB64, 'base64url')
    const expected = Buffer.from(hashB64, 'base64url')
    if (!salt.length || !expected.length) return false
    const dk = await new Promise((resolve, reject) =>
      _scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) }, (err, out) =>
        err ? reject(err) : resolve(out),
      ),
    )
    return dk.length === expected.length && timingSafeEqual(dk, expected)
  } catch {
    return false
  }
}

// --- session tokens (HS256 JWT) ---------------------------------------------
const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

function hmac(input, secret) {
  return createHmac('sha256', secret).update(input).digest('base64url')
}

export function signSession(payload, secret, opts = {}) {
  if (!secret) throw new Error('session secret required')
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000)
  const body = { ...payload, iat: nowSec, exp: nowSec + (opts.expiresInSec ?? SESSION_TTL_SEC) }
  const head = b64u({ alg: 'HS256', typ: 'JWT' })
  const data = `${head}.${b64u(body)}`
  return `${data}.${hmac(data, secret)}`
}

export function verifySession(token, secret, opts = {}) {
  if (!secret) throw new Error('session secret required')
  if (typeof token !== 'string') throw new Error('invalid token')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid token')
  const [head, body, sig] = parts
  const expected = hmac(`${head}.${body}`, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad signature')
  let claims
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw new Error('invalid token')
  }
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000)
  if (typeof claims.exp === 'number' && nowSec >= claims.exp) throw new Error('token expired')
  return claims
}

// --- cookies ----------------------------------------------------------------
export function parseCookies(header) {
  const out = {}
  if (!header || typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    const k = part.slice(0, i).trim()
    if (k) out[k] = part.slice(i + 1).trim()
  }
  return out
}

function cookie(name, value, { maxAge, secure = true } = {}) {
  const bits = [`${name}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/']
  if (typeof maxAge === 'number') bits.push(`Max-Age=${maxAge}`)
  if (secure) bits.push('Secure')
  return bits.join('; ')
}

export function sessionCookie(token, opts = {}) {
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SEC, ...opts })
}

export function clearedSessionCookie(opts = {}) {
  return cookie(SESSION_COOKIE, '', { maxAge: 0, ...opts })
}

// Extract + verify the caller's user id from the request's session cookie.
// Returns the user id (string) or null — never throws. Shared by /api/state and
// /api/usage as the single authentication seam.
export function userIdFromRequest(req, secret) {
  try {
    const header = req?.headers?.cookie ?? req?.headers?.Cookie
    const token = parseCookies(header)[SESSION_COOKIE]
    if (!token) return null
    return verifySession(token, secret).sub || null
  } catch {
    return null
  }
}

// --- input validation -------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const MAX_PASSWORD = 200 // guards scrypt against a pathologically long input

export function normalizeEmail(email) {
  if (typeof email !== 'string') throw new Error('Email is required')
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) throw new Error('Enter a valid email address')
  return e
}

export function validateSignup({ email, password, username } = {}) {
  const e = normalizeEmail(email)
  if (typeof password !== 'string') throw new Error('Password is required')
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`)
  if (password.length > MAX_PASSWORD) throw new Error('Password is too long')
  let u = typeof username === 'string' ? username.trim() : ''
  if (!u) u = e.split('@')[0]
  return { email: e, username: u.slice(0, 60), password }
}

export function validateLogin({ email, password } = {}) {
  const e = normalizeEmail(email)
  if (typeof password !== 'string' || password.length === 0) throw new Error('Password is required')
  return { email: e, password }
}
