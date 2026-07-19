// src/lib/auth-client.js
// Browser-side calls to the auth endpoints. Cookies are HttpOnly and same-origin,
// so we never touch the token in JS — we just include credentials.
const jsonOf = (res) => res.json().catch(() => ({}))

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  })
  const data = await jsonOf(res)
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data
}

export const signup = (fields) => post('/api/auth/signup', fields)
export const login = (fields) => post('/api/auth/login', fields)
export const logout = () => post('/api/auth/logout', {})

export async function me() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!res.ok) return null
    const data = await res.json()
    return data.user || null
  } catch {
    return null
  }
}
