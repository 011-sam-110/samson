// src/lib/server.js
// Server-only helpers shared by the api/* serverless functions. Imported ONLY from
// api/** — never from a frontend component — so the Neon driver is never bundled
// into the client. (Vite tree-shakes what the browser entry never imports.)
import { Pool } from '@neondatabase/serverless'

export const makePool = () => new Pool({ connectionString: process.env.DATABASE_URL })

export const sessionSecret = () => process.env.SESSION_SECRET

// Mark cookies Secure everywhere except plain-HTTP local dev. Vercel sets VERCEL=1.
export const cookieSecure = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

export function sendCookies(res, cookies) {
  if (cookies && cookies.length) res.setHeader('Set-Cookie', cookies)
}
