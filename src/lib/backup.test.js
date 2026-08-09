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

  it('throws when required Pocko keys are missing', () => {
    expect(() => parseBackup(JSON.stringify({ balance: 1 }))).toThrow(/Pocko backup/)
  })

  it('rejects arrays and primitives', () => {
    expect(() => parseBackup('[]')).toThrow(/Pocko backup/)
    expect(() => parseBackup('42')).toThrow(/Pocko backup/)
  })

  // Regression: validation used to be a presence check (`k in obj`), so a file
  // could name every key and still hold the wrong types. It sailed through here
  // and died later on `.map` of a non-array — inside a render, past the import
  // handler's catch, taking the app down with a blank screen. An imported file is
  // untrusted; reject it here, where the error can still be a sentence.
  it('rejects a file that names the keys but holds the wrong shapes', () => {
    expect(() => parseBackup(JSON.stringify({ ...good, transactions: {} }))).toThrow(/Pocko backup/)
    expect(() => parseBackup(JSON.stringify({ ...good, goals: 'none' }))).toThrow(/Pocko backup/)
    expect(() => parseBackup(JSON.stringify({ ...good, bills: null }))).toThrow(/Pocko backup/)
  })

  it('rejects a balance that is not a real number', () => {
    expect(() => parseBackup(JSON.stringify({ ...good, balance: '100' }))).toThrow(/Pocko backup/)
    expect(() => parseBackup(JSON.stringify({ ...good, balance: null }))).toThrow(/Pocko backup/)
  })

  // termSpans (M5) is an optional collection: present exports must be an array,
  // but older backups predate the key and must still import (migration fills it).
  it('round-trips termSpans through serialize → parse', () => {
    const span = { id: 'a', kind: 'exams', label: 'Exams', start: '2026-01-12', end: '2026-01-23' }
    const out = parseBackup(serializeState({ ...good, termSpans: [span] }))
    expect(out.termSpans).toEqual([span])
  })

  it('accepts a backup with no termSpans key (older export)', () => {
    expect(() => parseBackup(serializeState(good))).not.toThrow()
  })

  it('rejects a backup whose termSpans is present but not an array', () => {
    expect(() => parseBackup(JSON.stringify({ ...good, termSpans: {} }))).toThrow(/Pocko backup/)
  })

  it('builds a dated filename', () => {
    expect(backupFilename(new Date(2026, 6, 12))).toBe('pocko-backup-2026-07-12.json')
  })
})
