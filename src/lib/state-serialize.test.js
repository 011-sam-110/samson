// src/lib/state-serialize.test.js
import { describe, it, expect } from 'vitest'
import { rowsToState, stateToRows, validateState } from './state-serialize.js'

const sample = {
  version: 4, balance: 512.4, lastReconciled: '2026-07-11', surviveUntil: '2026-09-01',
  incomeSources: [{ id: 'i1', label: 'Bar', kind: 'monthly', amount: 780, nextDate: '2026-07-25' }],
  bills: [{ id: 'b1', label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-07-30' }],
  goals: [{ id: 'g1', label: 'Trip', target: 600, openingBalance: 180, deadline: '2026-10-01' }],
  contributions: [{ id: 'c1', goalId: 'g1', amount: 25, date: '2026-07-09' }],
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
  it('coerces a Postgres DATE (JS Date at local midnight) back to a YYYY-MM-DD string', () => {
    const rows = stateToRows(sample, 'u1')
    rows.transactions[0].date = new Date(2026, 6, 10) // local midnight, as node-postgres parses a DATE
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
      version: 4, balance: 0, lastReconciled: '2026-07-01', surviveUntil: null,
      incomeSources: [], bills: [], goals: [], contributions: [], events: [], termSpans: [], transactions: [],
    }
    const state = rowsToState(stateToRows(empty, 'u1'))
    expect(state.incomeSources).toEqual([])
    expect(state.bills).toEqual([])
    expect(state.goals).toEqual([])
    expect(state.contributions).toEqual([])
    expect(state.events).toEqual([])
    expect(state.termSpans).toEqual([])
    expect(state.transactions).toEqual([])
  })

  // The goals table keeps its `saved` COLUMN — renaming it would need DDL against a
  // live Neon table for no gain. The mapping layer is where it becomes what it now
  // means: an opening balance (money put aside before Pocko).
  it('maps the goals.saved column to openingBalance in both directions', () => {
    const rows = stateToRows(sample, 'u1')
    expect(rows.goals[0].saved).toBe(180)
    expect(rowsToState(rows).goals[0].openingBalance).toBe(180)
  })

  it('round-trips dated goal contributions', () => {
    const rows = stateToRows(sample, 'u1')
    expect(rows.goal_contributions[0]).toMatchObject({ user_id: 'u1', id: 'c1', goal_id: 'g1', amount: 25, date: '2026-07-09' })
    expect(rowsToState(rows).contributions).toEqual(sample.contributions)
  })

  it('coerces a contribution NUMERIC string and DATE back to Number and YYYY-MM-DD', () => {
    const rows = stateToRows(sample, 'u1')
    rows.goal_contributions[0].amount = '25.00'
    rows.goal_contributions[0].date = new Date(2026, 6, 9)
    const c = rowsToState(rows).contributions[0]
    expect(c.amount).toBe(25)
    expect(c.date).toBe('2026-07-09')
  })

  it('validateState rejects a malformed contribution date', () => {
    expect(() => validateState({ ...sample, contributions: [{ id: 'c1', goalId: 'g1', amount: 5, date: '2026-02-30' }] })).toThrow()
  })

  it('validateState rejects a contributions array over the row cap', () => {
    const tooMany = Array.from({ length: 5001 }, (_, i) => ({ id: `c${i}`, goalId: 'g1', amount: 1, date: '2026-01-01' }))
    expect(() => validateState({ ...sample, contributions: tooMany })).toThrow()
  })

  // Pre-v4 clients PUT a state with no contributions key at all; that must still save.
  it('validateState accepts a state with no contributions key', () => {
    const { contributions, ...noLedger } = sample
    expect(validateState(noLedger)).toBe(noLedger)
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

  it('validateState rejects a malformed date field', () => {
    expect(() => validateState({ ...sample, transactions: [{ ...sample.transactions[0], date: '2026-13-45' }] })).toThrow()
  })

  it('validateState rejects an over-long label', () => {
    expect(() => validateState({ ...sample, bills: [{ ...sample.bills[0], label: 'x'.repeat(501) }] })).toThrow()
  })

  it('validateState accepts a well-formed state (dates + labels ok)', () => {
    expect(validateState(sample)).toBe(sample)
  })
})
