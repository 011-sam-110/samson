import { describe, it, expect } from 'vitest'
import {
  periodRange,
  totalSpend,
  spendByCategory,
  weekendSplit,
  weeklyTrend,
  biggestMover,
  recurringSpends,
  projectedMonthEnd,
  costToGoal,
  dailySpendSeries,
  weeklySeries,
} from './analytics.js'

// Jan 2026: 1st = Thursday. So 3rd/4th = Sat/Sun, 10th/11th = Sat/Sun.
const ASOF = '2026-01-15'
const iso = (d) => d.toISOString().slice(0, 10)

describe('periodRange', () => {
  it("'month' spans the 1st to the last day of asOf's month", () => {
    const { from, to } = periodRange('month', ASOF)
    expect(iso(from)).toBe('2026-01-01')
    expect(iso(to)).toBe('2026-01-31')
  })

  it("'last30' spans 30 inclusive days ending on asOf", () => {
    const { from, to } = periodRange('last30', ASOF)
    expect(iso(from)).toBe('2025-12-17')
    expect(iso(to)).toBe('2026-01-15')
  })
})

describe('totalSpend / spendByCategory', () => {
  const txns = [
    { type: 'expense', category: 'eating_out', amount: 20, date: '2026-01-05' },
    { type: 'expense', category: 'eating_out', amount: 10, date: '2026-01-06' },
    { type: 'expense', category: 'groceries', amount: 25, date: '2026-01-07' },
    { type: 'income', category: 'other', amount: 100, date: '2026-01-08' }, // ignored
    { type: 'expense', category: 'going_out', amount: 40, date: '2026-02-01' }, // out of window
  ]

  it('totalSpend sums only in-window expenses', () => {
    expect(totalSpend(txns, '2026-01-01', '2026-01-31')).toBe(55)
  })

  it('spendByCategory groups, ranks and computes pct + count', () => {
    const rows = spendByCategory(txns, '2026-01-01', '2026-01-31')
    expect(rows.map((r) => r.key)).toEqual(['eating_out', 'groceries'])
    expect(rows[0]).toMatchObject({ total: 30, count: 2 })
    expect(rows[0].pct).toBeCloseTo(30 / 55, 4)
    expect(rows[1]).toMatchObject({ key: 'groceries', total: 25, count: 1 })
  })
})

describe('weekendSplit', () => {
  // window Mon 5th → Sun 11th: 5 weekdays, 2 weekend days.
  const txns = [
    { type: 'expense', category: 'going_out', amount: 50, date: '2026-01-10' }, // Sat
    { type: 'expense', category: 'groceries', amount: 14, date: '2026-01-06' }, // Tue
    { type: 'expense', category: 'rent', amount: 400, date: '2026-01-07' }, // fixed → ignored
  ]

  it('splits per-day by the count of each day-type in the window', () => {
    const s = weekendSplit(txns, '2026-01-05', '2026-01-11', ASOF)
    expect(s.weekdayCount).toBe(5)
    expect(s.weekendCount).toBe(2)
    expect(s.weekendTotal).toBe(50)
    expect(s.weekdayTotal).toBe(14)
    expect(s.weekendPerDay).toBeCloseTo(25, 4)
    expect(s.weekdayPerDay).toBeCloseTo(14 / 5, 4)
  })

  // Regression: the default period is the calendar month, whose `to` is the 31st —
  // a date still in the future for all but one day of the month. Dividing by days
  // the student hasn't reached yet crushed the £/day rate to a fraction of the truth.
  describe('mid-month, with most of the period still unlived', () => {
    // Jan 2026: 1=Thu, 2=Fri, 3=Sat, 4=Sun, 5=Mon.
    // As of Mon the 5th the lived span is the 1st–5th: 3 weekdays, 2 weekend days.
    const monthTxns = [
      { type: 'expense', category: 'coffee', amount: 9, date: '2026-01-02' }, // Fri
      { type: 'expense', category: 'groceries', amount: 12, date: '2026-01-05' }, // Mon
      { type: 'expense', category: 'going_out', amount: 40, date: '2026-01-03' }, // Sat
      { type: 'expense', category: 'eating_out', amount: 99, date: '2026-01-20' }, // not lived yet
    ]

    it('divides only by the days lived so far', () => {
      const s = weekendSplit(monthTxns, '2026-01-01', '2026-01-31', '2026-01-05')
      expect(s.weekdayCount).toBe(3) // was 22 — the whole month
      expect(s.weekendCount).toBe(2) // was 9
      expect(s.weekdayPerDay).toBeCloseTo(21 / 3, 4) // £7/day, not £21/22
      expect(s.weekendPerDay).toBeCloseTo(40 / 2, 4) // £20/day, not £40/9
    })

    it('ignores spend dated after today, so the rate stays a rate', () => {
      const s = weekendSplit(monthTxns, '2026-01-01', '2026-01-31', '2026-01-05')
      expect(s.weekdayTotal).toBe(21) // the £99 on the 20th is not in the lived span
    })
  })

  it('counts nothing when the period has not started yet', () => {
    const s = weekendSplit(txns, '2026-02-01', '2026-02-28', ASOF)
    expect(s.weekdayCount).toBe(0)
    expect(s.weekendCount).toBe(0)
    expect(s.weekdayPerDay).toBe(0)
  })
})

describe('weeklyTrend', () => {
  const txns = [
    { type: 'expense', category: 'eating_out', amount: 70, date: '2026-01-12' }, // this week
    { type: 'expense', category: 'eating_out', amount: 30, date: '2026-01-05' }, // last week
    { type: 'expense', category: 'groceries', amount: 20, date: '2026-01-01' }, // 4-wk window only
  ]

  it('computes this/last week and the 4-week average with a vs-avg delta', () => {
    const t = weeklyTrend(txns, ASOF)
    expect(t.thisWeek).toBe(70)
    expect(t.lastWeek).toBe(30)
    expect(t.fourWeekAvg).toBeCloseTo(120 / 4, 4)
    expect(t.vsAvgPct).toBeCloseTo((70 - 30) / 30, 4)
  })

  it('returns null vs-avg when there is no history', () => {
    expect(weeklyTrend([], ASOF).vsAvgPct).toBe(null)
  })
})

describe('biggestMover', () => {
  const txns = [
    { type: 'expense', category: 'eating_out', amount: 70, date: '2026-01-12' }, // this wk
    { type: 'expense', category: 'eating_out', amount: 30, date: '2026-01-05' }, // last wk
    { type: 'expense', category: 'groceries', amount: 10, date: '2026-01-10' }, // this wk only
  ]

  it('picks the category with the largest week-over-week rise', () => {
    const m = biggestMover(txns, ASOF)
    expect(m).toMatchObject({ key: 'eating_out', thisWeek: 70, prevWeek: 30, delta: 40 })
  })

  it('is null when nothing rose', () => {
    expect(biggestMover([], ASOF)).toBe(null)
  })
})

describe('recurringSpends', () => {
  const txns = [
    { type: 'expense', category: 'coffee', amount: 4, date: '2026-01-01' },
    { type: 'expense', category: 'coffee', amount: 4, date: '2026-01-02' },
    { type: 'expense', category: 'coffee', amount: 4, date: '2026-01-03' },
    { type: 'expense', category: 'eating_out', amount: 20, date: '2026-01-04' }, // count 1 < min
    { type: 'expense', category: 'rent', amount: 400, date: '2026-01-05' }, // fixed → excluded
  ]

  it('keeps only frequent non-fixed categories with an average', () => {
    const rows = recurringSpends(txns, '2026-01-01', '2026-01-31')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'coffee', count: 3, total: 12, avgEach: 4 })
  })
})

describe('projectedMonthEnd', () => {
  it('extrapolates spend-so-far across the whole month', () => {
    const txns = [
      { type: 'expense', category: 'groceries', amount: 90, date: '2026-01-05' },
      { type: 'expense', category: 'going_out', amount: 60, date: '2026-01-10' },
    ]
    const p = projectedMonthEnd(txns, ASOF)
    expect(p.soFar).toBe(150)
    expect(p.daysElapsed).toBe(15)
    expect(p.daysInMonth).toBe(31)
    expect(p.projected).toBeCloseTo((150 / 15) * 31, 4)
  })
})

describe('dailySpendSeries', () => {
  const txns = [
    { type: 'expense', category: 'coffee', amount: 4, date: '2026-01-01' },
    { type: 'expense', category: 'groceries', amount: 10, date: '2026-01-01' },
    { type: 'expense', category: 'going_out', amount: 20, date: '2026-01-03' },
    { type: 'income', category: 'other', amount: 99, date: '2026-01-03' }, // ignored
    { type: 'expense', category: 'eating_out', amount: 8, date: '2026-01-09' }, // out of window
  ]

  it('returns one point per inclusive day with expenses summed (0 when empty)', () => {
    const s = dailySpendSeries(txns, '2026-01-01', '2026-01-05')
    expect(s).toHaveLength(5)
    expect(s.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'])
    expect(s[0].total).toBe(14) // 4 + 10, income excluded
    expect(s[1].total).toBe(0)
    expect(s[2].total).toBe(20)
    expect(s[4].total).toBe(0)
  })

  it('is empty when the range is inverted', () => {
    expect(dailySpendSeries(txns, '2026-01-05', '2026-01-01')).toEqual([])
  })
})

describe('weeklySeries', () => {
  const txns = [
    { type: 'expense', category: 'eating_out', amount: 70, date: '2026-01-12' }, // this week
    { type: 'expense', category: 'eating_out', amount: 30, date: '2026-01-05' }, // last week
    { type: 'expense', category: 'rent', amount: 400, date: '2026-01-13' }, // fixed → excluded
  ]

  it('buckets trailing weeks oldest→newest, non-fixed only, last bucket ends on asOf', () => {
    const s = weeklySeries(txns, ASOF, 2)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ start: '2026-01-02', end: '2026-01-08', total: 30 })
    expect(s[1]).toMatchObject({ start: '2026-01-09', end: '2026-01-15', total: 70 }) // rent excluded
  })
})

describe('costToGoal', () => {
  it('expresses spend as weeks of a goal set-aside', () => {
    expect(costToGoal(88, 35)).toBeCloseTo(88 / 35, 4)
  })
  it('is 0 when the goal needs nothing', () => {
    expect(costToGoal(50, 0)).toBe(0)
  })
})
