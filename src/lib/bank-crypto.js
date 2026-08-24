// src/lib/bank-crypto.js
// Encrypt/decrypt a bank-provider token (access + refresh) for storage in
// bank_connections.access_token_enc / refresh_token_enc. AES-256-GCM with a
// random 12-byte IV per call, built ONLY on Node's built-in `crypto` — same
// no-third-party-deps rule src/lib/auth.js follows for password hashing. The
// output is self-describing (`gcm$iv$tag$ciphertext`, all base64url) so the
// key/params can be rotated later without an unreadable migration.
//
// STATUS: not wired to anything live. There is no real bank connection to
// encrypt a token for yet — see docs/open-banking-spec.md. This module exists
// so the "tokens are encrypted at rest" line in that spec is provable code,
// not just a paragraph, and so the eventual api/bank/callback.js has
// something ready to call rather than a TODO with no shape.
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32
const HEX64 = /^[0-9a-f]{64}$/i

// BANK_TOKEN_ENC_KEY is generated once (see .env.example) and passed in by the
// caller — this module never reads process.env itself, so it stays testable
// with a throwaway key and reusable from anywhere (server-only; never import
// this from client code, same rule as src/lib/server.js).
function keyFromEnv(envValue) {
  if (!envValue || typeof envValue !== 'string') throw new Error('BANK_TOKEN_ENC_KEY is not set')
  let key
  try {
    key = Buffer.from(envValue, HEX64.test(envValue) ? 'hex' : 'base64url')
  } catch {
    throw new Error('BANK_TOKEN_ENC_KEY is not valid base64url or hex')
  }
  if (key.length !== KEY_BYTES) throw new Error(`BANK_TOKEN_ENC_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`)
  return key
}

export function encryptToken(plaintext, envValue) {
  if (typeof plaintext !== 'string' || !plaintext) throw new Error('plaintext required')
  const key = keyFromEnv(envValue)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `gcm$${iv.toString('base64url')}$${tag.toString('base64url')}$${ciphertext.toString('base64url')}`
}

export function decryptToken(stored, envValue) {
  const key = keyFromEnv(envValue)
  const parts = String(stored || '').split('$')
  if (parts.length !== 4 || parts[0] !== 'gcm') throw new Error('invalid encrypted token')
  const [, ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  if (iv.length !== IV_BYTES || !tag.length || !data.length) throw new Error('invalid encrypted token')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  // A wrong key or tampered ciphertext/tag makes GCM's tag check fail here —
  // decipher.final() throws rather than silently returning garbage.
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()])
  return plaintext.toString('utf8')
}

// Generates a fresh key in the same format .env.example asks for — a small
// convenience for local setup, never called by anything server-side.
export function generateKey() {
  return randomBytes(KEY_BYTES).toString('base64url')
}
