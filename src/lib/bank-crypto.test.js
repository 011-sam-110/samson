import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken, generateKey } from './bank-crypto.js'

describe('bank token encryption (AES-256-GCM)', () => {
  const key = generateKey()

  it('round-trips a token', () => {
    const enc = encryptToken('a-fake-access-token-value', key)
    expect(decryptToken(enc, key)).toBe('a-fake-access-token-value')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptToken('same plaintext', key)
    const b = encryptToken('same plaintext', key)
    expect(a).not.toBe(b)
  })

  it('is self-describing: gcm$iv$tag$ciphertext, all base64url', () => {
    const enc = encryptToken('token', key)
    const parts = enc.split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('gcm')
  })

  it('accepts a hex key too, not just base64url', () => {
    const hexKey = '0'.repeat(64) // 32 bytes of zero, valid hex
    const enc = encryptToken('token', hexKey)
    expect(decryptToken(enc, hexKey)).toBe('token')
  })

  it('rejects a missing key', () => {
    expect(() => encryptToken('token', '')).toThrow(/BANK_TOKEN_ENC_KEY/)
    expect(() => decryptToken('gcm$a$b$c', undefined)).toThrow(/BANK_TOKEN_ENC_KEY/)
  })

  it('rejects a key of the wrong length', () => {
    expect(() => encryptToken('token', Buffer.from('too short').toString('base64url'))).toThrow(/32 bytes/)
  })

  it('fails closed on the wrong key (auth tag mismatch), never returns garbage', () => {
    const enc = encryptToken('secret', key)
    const wrongKey = generateKey()
    expect(() => decryptToken(enc, wrongKey)).toThrow()
  })

  it('fails closed on a tampered ciphertext', () => {
    const enc = encryptToken('secret', key)
    const parts = enc.split('$')
    // Flip the last character of the ciphertext segment.
    const tampered = parts[3].slice(0, -1) + (parts[3].slice(-1) === 'A' ? 'B' : 'A')
    const bad = [parts[0], parts[1], parts[2], tampered].join('$')
    expect(() => decryptToken(bad, key)).toThrow()
  })

  it('rejects a malformed stored string', () => {
    expect(() => decryptToken('not-the-right-shape', key)).toThrow(/invalid encrypted token/)
    expect(() => decryptToken('aes$a$b$c', key)).toThrow(/invalid encrypted token/)
  })
})
