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

  // Regression: validation used to be a presence check (`k in obj`), so a file
  // could name every key and still hold the wrong types. It sailed through here
  // and died later on `.map` of a non-array — inside a render, past the import
  // handler's catch, taking the app down with a blank screen. An imported file is
  // untrusted; reject it here, where the error can still be a sentence.
  it('rejects a file that names the keys but holds the wrong shapes', () => {
    expect(() => parseBackup(JSON.stringify({ ...good, transactions: {} }))).toThrow(/Leeway backup/)
    expect(() => parseBackup(JSON.stringify({ ...good, goals: 'none' }))).toThrow(/Leeway backup/)
    expect(() => parseBackup(JSON.stringify({ ...good, bills: null }))).toThrow(/Leeway backup/)
  })

  it('rejects a balance that is not a real number', () => {
    expect(() => parseBackup(JSON.stringify({ ...good, balance: '100' }))).toThrow(/Leeway backup/)
    expect(() => parseBackup(JSON.stringify({ ...good, balance: null }))).toThrow(/Leeway backup/)
  })

  it('builds a dated filename', () => {
    expect(backupFilename(new Date(2026, 6, 12))).toBe('leeway-backup-2026-07-12.json')
  })
})
