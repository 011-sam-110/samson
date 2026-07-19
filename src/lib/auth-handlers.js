// src/lib/auth-handlers.js
// Pure request→response logic for the auth endpoints, DB injected so it unit-tests
// with no database or network (same seam as state-api.js). Each handler returns
// { status, body, cookies? }; the thin api/auth/* wrappers set the Set-Cookie header.
import {
  validateSignup, validateLogin, hashPassword, verifyPassword,
  signSession, sessionCookie, clearedSessionCookie, newUserId, userIdFromRequest,
} from './auth.js'

// A precomputed hash to verify against when the email is unknown, so a login for a
// non-existent account burns the same scrypt time as a real one (no user enumeration
// via response timing). Lazy + cached; the input is irrelevant.
let DUMMY_HASH = null
async function dummyHash() {
  if (!DUMMY_HASH) DUMMY_HASH = await hashPassword('timing-equalizer-placeholder')
  return DUMMY_HASH
}

export async function handleSignup(req, deps) {
  const { db, sessionSecret, secure = true } = deps
  let fields
  try {
    fields = validateSignup(req.body || {})
  } catch (e) {
    return { status: 400, body: { error: e.message } }
  }
  const { email, username, password } = fields
  const id = newUserId()
  const password_hash = await hashPassword(password)
  try {
    await db.query(
      'INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)',
      [id, email, username, password_hash],
    )
  } catch (e) {
    if (e && e.code === '23505') return { status: 409, body: { error: 'An account with that email already exists' } }
    return { status: 500, body: { error: 'Could not create account' } }
  }
  const token = signSession({ sub: id }, sessionSecret)
  return { status: 201, body: { user: { id, email, username } }, cookies: [sessionCookie(token, { secure })] }
}

export async function handleLogin(req, deps) {
  const { db, sessionSecret, secure = true } = deps
  let fields
  try {
    fields = validateLogin(req.body || {})
  } catch (e) {
    return { status: 400, body: { error: e.message } }
  }
  const { email, password } = fields
  const r = await db.query('SELECT id, email, username, password_hash FROM users WHERE email = $1', [email])
  const user = r.rows[0]
  let ok = false
  if (user) ok = await verifyPassword(password, user.password_hash)
  else await verifyPassword(password, await dummyHash()) // constant-time no-op
  if (!ok) return { status: 401, body: { error: 'Wrong email or password' } }
  await db.query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]).catch(() => {})
  const token = signSession({ sub: user.id }, sessionSecret)
  return {
    status: 200,
    body: { user: { id: user.id, email: user.email, username: user.username } },
    cookies: [sessionCookie(token, { secure })],
  }
}

export function handleLogout(deps = {}) {
  return { status: 200, body: { ok: true }, cookies: [clearedSessionCookie({ secure: deps.secure ?? true })] }
}

export async function handleMe(req, deps) {
  const { db, sessionSecret } = deps
  const userId = userIdFromRequest(req, sessionSecret)
  if (!userId) return { status: 401, body: { error: 'Not signed in' } }
  const r = await db.query('SELECT id, email, username FROM users WHERE id = $1', [userId])
  const user = r.rows[0]
  if (!user) return { status: 401, body: { error: 'Not signed in' } }
  return { status: 200, body: { user } }
}

// Usage tracking: one row per user action so we can see what the trial students
// actually use. Failures here must NEVER surface to the user (fire-and-forget).
export async function handleUsage(req, deps) {
  const { db, sessionSecret } = deps
  const userId = userIdFromRequest(req, sessionSecret)
  if (!userId) return { status: 401, body: { error: 'Not signed in' } }
  const body = req.body || {}
  const event = typeof body.event === 'string' ? body.event.trim().slice(0, 100) : ''
  if (!event) return { status: 400, body: { error: 'event required' } }
  const meta = body.meta && typeof body.meta === 'object' ? JSON.stringify(body.meta).slice(0, 2000) : null
  try {
    await db.query('INSERT INTO usage_events (user_id, event, meta) VALUES ($1, $2, $3::jsonb)', [userId, event, meta])
  } catch {
    /* swallow — analytics is best-effort */
  }
  return { status: 202, body: { ok: true } }
}
