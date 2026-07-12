import { describe, it, expect } from 'vitest'
import { detectRecurring } from './recurring.js'

const tx = (label, amount, date, category = 'other') => ({ type: 'expense', label, amount, date, category })

describe('detectRecurring', () => {
  it('flags a monthly-repeating merchant', () => {
    const txns = [tx('Netflix', 10.99, '2026-01-03'), tx('Netflix', 10.99, '2026-02-03'), tx('Netflix', 10.99, '2026-03-03')]
    const r = detectRecurring(txns)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ label: 'Netflix', cadence: 'monthly', count: 3 })
    expect(r[0].avgAmount).toBeCloseTo(10.99, 2)
  })

  it('flags a weekly-repeating merchant', () => {
    const txns = [tx('Gym', 6, '2026-01-01'), tx('Gym', 6, '2026-01-08'), tx('Gym', 6, '2026-01-15')]
    expect(detectRecurring(txns)[0]).toMatchObject({ label: 'Gym', cadence: 'weekly' })
  })

  it('ignores irregular repeats', () => {
    const txns = [tx('Corner shop', 5, '2026-01-01'), tx('Corner shop', 5, '2026-01-02'), tx('Corner shop', 5, '2026-01-20')]
    expect(detectRecurring(txns)).toEqual([])
  })

  it('ignores merchants below the minimum count', () => {
    const txns = [tx('Netflix', 10.99, '2026-01-03'), tx('Netflix', 10.99, '2026-02-03')]
    expect(detectRecurring(txns)).toEqual([])
  })

  it('matches merchants case-insensitively and skips income', () => {
    const txns = [
      tx('SPOTIFY', 11.99, '2026-01-05'),
      tx('spotify', 11.99, '2026-02-05'),
      tx('Spotify', 11.99, '2026-03-05'),
      { type: 'income', label: 'Spotify', amount: 999, date: '2026-01-05' },
    ]
    const r = detectRecurring(txns)
    expect(r).toHaveLength(1)
    expect(r[0].count).toBe(3)
  })
})
