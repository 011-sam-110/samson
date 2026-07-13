// src/lib/state-serialize.test.js
import { describe, it, expect } from 'vitest'
import { rowsToState, stateToRows, validateState } from './state-serialize.js'

const sample = {
  version: 3, balance: 512.4, lastReconciled: '2026-07-11', surviveUntil: '2026-09-01',
  incomeSources: [{ id: 'i1', label: 'Bar', kind: 'monthly', amount: 780, nextDate: '2026-07-25' }],
  bills: [{ id: 'b1', label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-07-30' }],
  goals: [{ id: 'g1', label: 'Trip', target: 600, saved: 180, deadline: '2026-10-01' }],
  events: [{ id: 'e1', label: 'Bday', amount: 55, date: '2026-07-18' }],
  termSpans: [{ id: 's1', kind: 'freshers', label: 'Freshers', start: '2026-09-16', end: '2026-09-22' }],
  transactions: [{ id: 't1', type: 'expense', label: 'Tesco', amount: 23.4, category: 'groceries', date: '2026-07-10' }],
}

describe('state-serialize', () => {
  it('round-trips a full state through rows and back unchanged', () => {
    expect(rowsToState(stateToRows(sample, 'u1'))).toEqual(sample)
  })

  // pg returns NUMERIC as a string ("512.40"); the engine needs real Numbers.
  it('coerces Postgres NUMERIC strings back to Number', () => {
    const rows = stateToRows(sample, 'u1')
    rows.profile.balance = '512.40'
    rows.transactions[0].amount = '23.40'
    const state = rowsToState(rows)
    expect(state.balance).toBe(512.4)
    expect(state.transactions[0].amount).toBe(23.4)
  })

  // pg returns DATE as a JS Date; the app speaks 'YYYY-MM-DD' strings everywhere.
  it('coerces a Postgres DATE (JS Date) back to a YYYY-MM-DD string', () => {
    const rows = stateToRows(sample, 'u1')
    rows.transactions[0].date = new Date('2026-07-10T00:00:00Z')
    expect(rowsToState(rows).transactions[0].date).toBe('2026-07-10')
  })

  // clearAll() omits surviveUntil entirely; treat missing as null both ways.
  it('treats a missing/undefined surviveUntil as null', () => {
    const cleared = { ...sample, surviveUntil: undefined }
    const rows = stateToRows(cleared, 'u1')
    expect(rows.profile.survive_until).toBeNull()
    expect(rowsToState(rows).surviveUntil).toBeNull()
  })

  // The app's `|| []` guards tolerate a missing collection at runtime — but
  // hydration must always emit [], never undefined, or a fetch bug reads as
  // "data vanished" instead of an error.
  it('emits empty arrays (never undefined) for empty collections', () => {
    const empty = {
      version: 3, balance: 0, lastReconciled: '2026-07-01', surviveUntil: null,
      incomeSources: [], bills: [], goals: [], events: [], termSpans: [], transactions: [],
    }
    const state = rowsToState(stateToRows(empty, 'u1'))
    expect(state.incomeSources).toEqual([])
    expect(state.bills).toEqual([])
    expect(state.goals).toEqual([])
    expect(state.events).toEqual([])
    expect(state.termSpans).toEqual([])
    expect(state.transactions).toEqual([])
  })

  it('validateState rejects a non-finite balance', () => {
    expect(() => validateState({ ...sample, balance: NaN })).toThrow()
  })

  it('validateState rejects a non-array collection', () => {
    expect(() => validateState({ ...sample, bills: {} })).toThrow()
  })

  it('validateState rejects a termSpans array over the row cap', () => {
    const tooMany = Array.from({ length: 5001 }, (_, i) => ({ id: `s${i}`, kind: 'term', label: 'x', start: '2026-01-01', end: '2026-01-02' }))
    expect(() => validateState({ ...sample, termSpans: tooMany })).toThrow()
  })
})
