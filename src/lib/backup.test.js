import { describe, it, expect } from 'vitest'
import { serializeState, parseBackup, backupFilename } from './backup.js'

const good = {
  version: 2,
  balance: 100,
  incomeSources: [],
  bills: [],
  goals: [],
  events: [],
  transactions: [],
}

describe('backup', () => {
  it('serialize → parse round-trips a state', () => {
    expect(parseBackup(serializeState(good))).toEqual(good)
  })

  it('throws a friendly error on invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow(/valid JSON/)
  })

  it('throws when required Leeway keys are missing', () => {
    expect(() => parseBackup(JSON.stringify({ balance: 1 }))).toThrow(/Leeway backup/)
  })

  it('rejects arrays and primitives', () => {
    expect(() => parseBackup('[]')).toThrow(/Leeway backup/)
    expect(() => parseBackup('42')).toThrow(/Leeway backup/)
  })

  it('builds a dated filename', () => {
    expect(backupFilename(new Date(2026, 6, 12))).toBe('leeway-backup-2026-07-12.json')
  })
})
