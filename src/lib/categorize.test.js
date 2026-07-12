import { describe, it, expect } from 'vitest'
import { guessCategory } from './categorize.js'
import { normalizeDate } from './extract.js'

describe('guessCategory', () => {
  it('maps known merchants to sensible categories', () => {
    expect(guessCategory('TESCO STORES 2914')).toBe('groceries')
    expect(guessCategory('NETFLIX.COM')).toBe('subscriptions')
    expect(guessCategory('PRET A MANGER')).toBe('coffee')
    expect(guessCategory('TFL TRAVEL CHARGE')).toBe('transport')
    expect(guessCategory('DELIVEROO')).toBe('eating_out')
  })

  it('falls back to other for the unknown', () => {
    expect(guessCategory('SOME RANDOM SHOP')).toBe('other')
    expect(guessCategory('')).toBe('other')
  })
})

describe('normalizeDate', () => {
  const asOf = new Date(2026, 6, 15) // 15 Jul 2026

  it('passes ISO through', () => {
    expect(normalizeDate('2026-03-04', asOf)).toBe('2026-03-04')
  })

  it('parses "11 Jul" against the current year', () => {
    expect(normalizeDate('11 Jul', asOf)).toBe('2026-07-11')
  })

  it('rolls a future-looking day back to last year', () => {
    // 20 Dec has no year and is after 15 Jul 2026 -> last year
    expect(normalizeDate('20 Dec', asOf)).toBe('2025-12-20')
  })

  it('parses UK DD/MM/YYYY', () => {
    expect(normalizeDate('04/03/2026', asOf)).toBe('2026-03-04')
  })
})
