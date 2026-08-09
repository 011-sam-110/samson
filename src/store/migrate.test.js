import { describe, it, expect } from 'vitest'
import { migrate, CURRENT_VERSION } from './migrate.js'

const v1 = {
  version: 1,
  balance: 100,
  transactions: [
    { id: 'a', type: 'expense', category: 'variable', amount: 10, date: '2026-01-01' },
    { id: 'b', type: 'expense', category: 'discretionary', amount: 5, date: '2026-01-01' },
    { id: 'c', type: 'expense', category: 'fixed', amount: 20, date: '2026-01-01' },
    { id: 'd', type: 'income', category: 'variable', amount: 50, date: '2026-01-01' },
  ],
  incomeSources: [],
  bills: [],
  goals: [],
  events: [],
}

describe('migrate', () => {
  it('upgrades v1 to the current version', () => {
    expect(migrate(v1).version).toBe(CURRENT_VERSION)
  })

  it('maps legacy expense tags to real categories', () => {
    const out = migrate(v1)
    expect(out.transactions.find((t) => t.id === 'a').category).toBe('groceries')
    expect(out.transactions.find((t) => t.id === 'b').category).toBe('other')
    expect(out.transactions.find((t) => t.id === 'c').category).toBe('bills')
  })

  it('leaves income transactions alone', () => {
    const out = migrate(v1)
    expect(out.transactions.find((t) => t.id === 'd').category).toBe('variable')
  })

  it('is idempotent (running twice equals running once)', () => {
    expect(migrate(migrate(v1))).toEqual(migrate(v1))
  })

  it('passes a current-version state through unchanged', () => {
    const v2 = { ...v1, version: CURRENT_VERSION, transactions: [] }
    expect(migrate(v2)).toEqual(v2)
  })

  it('v2 → v3 adds an empty termSpans array', () => {
    const v2 = { version: 2, balance: 0, transactions: [], bills: [], goals: [], events: [], incomeSources: [] }
    const out = migrate(v2)
    expect(out.termSpans).toEqual([])
  })

  it('keeps an existing termSpans array through migration', () => {
    const span = { id: 'a', kind: 'freshers', label: 'Freshers', start: '2026-09-21', end: '2026-09-27' }
    const out = migrate({ version: 3, termSpans: [span], transactions: [] })
    expect(out.termSpans).toEqual([span])
  })

  it('does not throw on non-object input', () => {
    expect(migrate(null)).toBe(null)
    expect(migrate(undefined)).toBe(undefined)
  })

  // v4 — the dated contribution ledger. Saving pace cannot exist without it: the old
  // model kept one running `saved` total per goal, so "saved in the last N days" had
  // no answer. Money already put aside before Pocko is real progress but was never
  // saved during a window we measured, so it becomes an opening balance and is kept
  // out of the pace entirely.
  describe('v3 → v4 (dated contribution ledger)', () => {
    const v3 = {
      version: 3,
      balance: 0,
      transactions: [],
      bills: [],
      events: [],
      incomeSources: [],
      termSpans: [],
      goals: [{ id: 'g1', label: 'Holiday', target: 300, saved: 180, deadline: '2026-09-01' }],
    }

    it('adds an empty contributions collection', () => {
      expect(migrate(v3).contributions).toEqual([])
    })

    it('turns an existing saved total into an opening balance', () => {
      const [goal] = migrate(v3).goals
      expect(goal.openingBalance).toBe(180)
    })

    it('drops the old saved field so nothing double-counts it', () => {
      const [goal] = migrate(v3).goals
      expect(goal.saved).toBeUndefined()
    })

    it('leaves every other goal field untouched', () => {
      const [goal] = migrate(v3).goals
      expect(goal).toMatchObject({ id: 'g1', label: 'Holiday', target: 300, deadline: '2026-09-01' })
    })

    it('defaults a goal with no saved total to a zero opening balance', () => {
      const out = migrate({ ...v3, goals: [{ id: 'g2', label: 'Laptop', target: 500, deadline: '2026-12-01' }] })
      expect(out.goals[0].openingBalance).toBe(0)
    })

    it('keeps contributions that already exist', () => {
      const c = { id: 'c1', goalId: 'g1', amount: 20, date: '2026-08-01' }
      const out = migrate({ ...v3, version: 4, contributions: [c] })
      expect(out.contributions).toEqual([c])
    })
  })
})
