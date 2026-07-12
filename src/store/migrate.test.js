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

  it('does not throw on non-object input', () => {
    expect(migrate(null)).toBe(null)
    expect(migrate(undefined)).toBe(undefined)
  })
})
