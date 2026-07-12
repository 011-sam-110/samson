import { describe, it, expect } from 'vitest'
import { isoDate, daySpend, heatLevel, billOccurrences, monthMatrix } from './calendar.js'

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

describe('billOccurrences', () => {
  const monthly = { label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-02-18' }
  it('projects a monthly bill across a month boundary', () => {
    expect(billOccurrences(monthly, '2026-01-01', '2026-03-31')).toEqual(['2026-01-18', '2026-02-18', '2026-03-18'])
  })
  it('places a monthly bill whose nextDue is after the window but recurs into it', () => {
    expect(billOccurrences(monthly, '2026-01-01', '2026-01-31')).toEqual(['2026-01-18'])
  })
  it('lands a weekly bill on the right days', () => {
    const weekly = { freq: 'weekly', nextDue: '2026-01-05' }
    expect(billOccurrences(weekly, '2026-01-01', '2026-01-20')).toEqual(['2026-01-05', '2026-01-12', '2026-01-19'])
  })
  it('returns a one-off only if it falls in the window', () => {
    const one = { freq: 'oneoff', nextDue: '2026-01-10' }
    expect(billOccurrences(one, '2026-01-01', '2026-01-31')).toEqual(['2026-01-10'])
    expect(billOccurrences(one, '2026-02-01', '2026-02-28')).toEqual([])
  })
})

describe('monthMatrix', () => {
  it('is 6 rows of 7, Monday-first, with correct inMonth flags', () => {
    const weeks = monthMatrix('2026-01-15') // Jan 2026: 1st = Thursday
    expect(weeks.length).toBe(6)
    expect(weeks[0].length).toBe(7)
    expect(weeks[0][0].date).toBe('2025-12-29') // Monday before Jan 1
    expect(weeks[0][0].inMonth).toBe(false)
    expect(weeks[0][3]).toEqual({ date: '2026-01-01', inMonth: true })
  })
})
