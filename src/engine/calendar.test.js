import { describe, it, expect } from 'vitest'
import { isoDate, daySpend, heatLevel } from './calendar.js'

const tx = (over) => ({ type: 'expense', category: 'going_out', amount: 10, date: '2026-01-10', ...over })

describe('isoDate', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('daySpend', () => {
  it('sums discretionary expenses on the given day only', () => {
    const txns = [tx({ amount: 6 }), tx({ amount: 4 }), tx({ amount: 99, date: '2026-01-11' })]
    expect(daySpend(txns, '2026-01-10')).toBe(10)
  })
  it('excludes fixed-category expenses (rent/bills)', () => {
    const txns = [tx({ amount: 6 }), tx({ amount: 480, category: 'rent' })]
    expect(daySpend(txns, '2026-01-10')).toBe(6)
  })
  it('excludes income and returns 0 for an empty/absent day', () => {
    expect(daySpend([tx({ type: 'income', category: 'other', amount: 50 })], '2026-01-10')).toBe(0)
    expect(daySpend([], '2026-01-10')).toBe(0)
  })
})

describe('heatLevel', () => {
  it('is 0 for no spend', () => expect(heatLevel(0, 40)).toBe(0))
  it('is 4 at the scale max', () => expect(heatLevel(40, 40)).toBe(4))
  it('buckets a mid value', () => expect(heatLevel(10, 40)).toBe(1))
  it('never divides by zero when scaleMax is 0', () => expect(heatLevel(0, 0)).toBe(0))
})
