import { describe, it, expect } from 'vitest'
import {
  perDayFromIncome,
  perDayFromBill,
  dailyGoalReserve,
  goalProgress,
  computeDashboard,
  canISpend,
  survivalPlan,
  DAYS_PER_MONTH,
} from './finance.js'

// Deterministic reference date for every test.
const ASOF = '2026-01-01'

describe('per-day normalisers', () => {
  it('hourly income → £/day (rate × hours ÷ 7)', () => {
    // £10/hr × 20hr/wk = £200/wk → £28.57/day
    expect(perDayFromIncome({ kind: 'hourly', rate: 10, hoursPerWeek: 20 })).toBeCloseTo(200 / 7, 4)
  })

  it('weekly income → £/day', () => {
    expect(perDayFromIncome({ kind: 'weekly', amount: 140 })).toBeCloseTo(20, 4)
  })

  it('monthly income → £/day (÷ average month length)', () => {
    expect(perDayFromIncome({ kind: 'monthly', amount: 300 })).toBeCloseTo(300 / DAYS_PER_MONTH, 4)
  })

  it('one-off income contributes nothing to the sustainable daily rate', () => {
    expect(perDayFromIncome({ kind: 'oneoff', amount: 1000, date: '2026-01-05' })).toBe(0)
  })

  it('bills normalise to £/day by frequency', () => {
    expect(perDayFromBill({ amount: 70, freq: 'weekly' })).toBeCloseTo(10, 4)
    expect(perDayFromBill({ amount: 300, freq: 'monthly' })).toBeCloseTo(300 / DAYS_PER_MONTH, 4)
  })
})

describe('goal reserve', () => {
  const goal = { target: 600, saved: 0, deadline: '2026-03-12' } // 70 days after ASOF

  it('derives the weekly-required set-aside', () => {
    // £600 over 10 weeks = £60/week
    expect(goalProgress(goal, ASOF).weeklyRequired).toBeCloseTo(60, 2)
  })

  it('daily reserve is weekly-required ÷ 7', () => {
    expect(dailyGoalReserve(goal, ASOF)).toBeCloseTo(600 / 70, 4)
  })

  it('a fully-saved goal reserves nothing', () => {
    expect(dailyGoalReserve({ target: 600, saved: 600, deadline: '2026-03-12' }, ASOF)).toBe(0)
  })
})

describe('computeDashboard - reproduces the PRD worked example', () => {
  // Balance £420; next £320 wage lands in 12 days; phone £15 + subs £12 due in-window;
  // one £600 goal over 10 weeks. Expect ~£24/day safe-to-spend.
  const state = {
    balance: 420,
    incomeSources: [{ id: 'wage', kind: 'monthly', amount: 320, nextDate: '2026-01-13' }],
    bills: [
      { id: 'phone', label: 'Phone', amount: 15, freq: 'monthly', nextDue: '2026-01-05' },
      { id: 'subs', label: 'Subscriptions', amount: 12, freq: 'monthly', nextDue: '2026-01-08' },
    ],
    goals: [{ id: 'trip', label: 'Summer trip', target: 600, saved: 0, deadline: '2026-03-12' }],
    events: [],
    transactions: [],
  }

  const dash = computeDashboard(state, ASOF)

  it('window runs to the next paycheck (12 days)', () => {
    expect(dash.windowDays).toBe(12)
    expect(dash.daysToPay).toBe(12)
  })

  it('reserves the in-window bills in full (£27)', () => {
    expect(dash.billsReserve).toBeCloseTo(27, 2)
  })

  it('reserves ~£103 toward the goal for this window', () => {
    expect(dash.goalsReserve).toBeCloseTo((600 / 70) * 12, 1)
  })

  it('discretionary pool ≈ £290', () => {
    expect(dash.pool).toBeCloseTo(290, 0)
  })

  it('safe-to-spend ≈ £24/day', () => {
    expect(dash.safePerDay).toBeCloseTo(24, 0)
  })
})

describe('the rent fix - bills due AFTER the window still bite', () => {
  const base = {
    balance: 420,
    incomeSources: [{ id: 'wage', kind: 'monthly', amount: 320, nextDate: '2026-01-13' }],
    bills: [{ id: 'phone', label: 'Phone', amount: 15, freq: 'monthly', nextDue: '2026-01-05' }],
    goals: [],
    events: [],
    transactions: [],
  }

  it('rent due just after payday is reserved pro-rata, not ignored', () => {
    const withoutRent = computeDashboard(base, ASOF)
    const withRent = computeDashboard(
      {
        ...base,
        bills: [...base.bills, { id: 'rent', label: 'Rent', amount: 500, freq: 'monthly', nextDue: '2026-01-20' }],
      },
      ASOF,
    )
    // Rent lands 7 days AFTER the window closes, yet safe-to-spend must drop.
    expect(withRent.safePerDay).toBeLessThan(withoutRent.safePerDay - 5)
    // Pro-rata slice ≈ (£500 / 30.44) × 12 days ≈ £197.
    expect(withRent.billsReserve - withoutRent.billsReserve).toBeCloseTo((500 / DAYS_PER_MONTH) * 12, 0)
  })

  it('a bill due INSIDE the window is reserved in full', () => {
    const withRent = computeDashboard(
      {
        ...base,
        bills: [...base.bills, { id: 'rent', label: 'Rent', amount: 500, freq: 'monthly', nextDue: '2026-01-10' }],
      },
      ASOF,
    )
    // phone £15 + rent £500 both due in-window.
    expect(withRent.billsReserve).toBeCloseTo(515, 2)
  })
})

describe('sustainable target rate + run rate', () => {
  it('target daily rate = income/day - bills/day - goals/day', () => {
    const state = {
      balance: 500,
      incomeSources: [{ id: 'w', kind: 'monthly', amount: 900, nextDate: '2026-02-01' }],
      bills: [{ id: 'rent', amount: 450, freq: 'monthly', nextDue: '2026-01-28' }],
      goals: [{ id: 'g', target: 300, saved: 0, deadline: '2026-04-01' }],
      events: [],
      transactions: [],
    }
    const dash = computeDashboard(state, ASOF)
    const expected = 900 / DAYS_PER_MONTH - 450 / DAYS_PER_MONTH - dailyGoalReserve(state.goals[0], ASOF)
    expect(dash.targetDaily).toBeCloseTo(expected, 4)
  })

  it('current daily rate averages recent discretionary/variable spend', () => {
    const state = {
      balance: 300,
      incomeSources: [{ id: 'w', kind: 'monthly', amount: 800, nextDate: '2026-02-01' }],
      bills: [],
      goals: [],
      events: [],
      transactions: [
        { id: 't1', type: 'expense', category: 'discretionary', amount: 70, date: '2025-12-29' },
        { id: 't2', type: 'expense', category: 'variable', amount: 70, date: '2025-12-30' },
        { id: 't3', type: 'expense', category: 'fixed', amount: 500, date: '2025-12-30' }, // fixed excluded
        { id: 't4', type: 'income', category: 'variable', amount: 999, date: '2025-12-30' }, // income excluded
      ],
    }
    const dash = computeDashboard(state, ASOF, { lookbackDays: 14 })
    expect(dash.currentDaily).toBeCloseTo(140 / 14, 4) // only the £70 + £70 discretionary/variable
  })

  it('run rate counts new student categories by their derived type', () => {
    const state = {
      balance: 300,
      incomeSources: [{ id: 'w', kind: 'monthly', amount: 800, nextDate: '2026-02-01' }],
      bills: [],
      goals: [],
      events: [],
      transactions: [
        { id: 't1', type: 'expense', category: 'going_out', amount: 40, date: '2025-12-29' }, // discretionary → counts
        { id: 't2', type: 'expense', category: 'groceries', amount: 30, date: '2025-12-30' }, // variable → counts
        { id: 't3', type: 'expense', category: 'rent', amount: 500, date: '2025-12-30' }, // fixed → excluded
      ],
    }
    const dash = computeDashboard(state, ASOF, { lookbackDays: 14 })
    expect(dash.currentDaily).toBeCloseTo(70 / 14, 4)
  })

  it('flags being over-committed when commitments exceed income', () => {
    const state = {
      balance: 100,
      incomeSources: [{ id: 'w', kind: 'monthly', amount: 200, nextDate: '2026-02-01' }],
      bills: [{ id: 'rent', amount: 500, freq: 'monthly', nextDue: '2026-01-28' }],
      goals: [],
      events: [],
      transactions: [],
    }
    expect(computeDashboard(state, ASOF).overCommitted).toBe(true)
  })
})

describe('overspent state', () => {
  it('never shows a raw negative rate - flags overspent + a recovery number', () => {
    const state = {
      balance: 50,
      incomeSources: [{ id: 'w', kind: 'monthly', amount: 300, nextDate: '2026-01-13' }],
      bills: [{ id: 'rent', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-01-10' }],
      goals: [],
      events: [],
      transactions: [],
    }
    const dash = computeDashboard(state, ASOF)
    expect(dash.overspent).toBe(true)
    expect(dash.overAmount).toBeGreaterThan(0)
    expect(dash.recoveryPerDay).toBeGreaterThan(0)
  })
})

describe('events reallocate the pool', () => {
  it('a flagged night out lowers safe-to-spend', () => {
    const base = {
      balance: 420,
      incomeSources: [{ id: 'wage', kind: 'monthly', amount: 320, nextDate: '2026-01-13' }],
      bills: [],
      goals: [],
      events: [],
      transactions: [],
    }
    const before = computeDashboard(base, ASOF).safePerDay
    const after = computeDashboard({ ...base, events: [{ id: 'e', label: 'Night out', amount: 60, date: '2026-01-05' }] }, ASOF).safePerDay
    expect(before - after).toBeCloseTo(60 / 12, 1)
  })
})

describe('survivalPlan - make a lump last to a date', () => {
  const base = {
    balance: 300,
    surviveUntil: '2026-01-31', // 30 days after ASOF (2026-01-01, a Thursday)
    incomeSources: [],
    bills: [],
    goals: [],
    events: [],
    transactions: [],
  }

  it('is inactive when no survive-until date is set (or it is past)', () => {
    expect(survivalPlan({ ...base, surviveUntil: null }, ASOF).active).toBe(false)
    expect(survivalPlan({ ...base, surviveUntil: '2025-12-01' }, ASOF).active).toBe(false)
  })

  it('spreads the pool flatly across the days left', () => {
    const p = survivalPlan(base, ASOF)
    expect(p.active).toBe(true)
    expect(p.daysLeft).toBe(30)
    expect(p.pool).toBeCloseTo(300, 4)
    expect(p.flatDaily).toBeCloseTo(10, 4)
  })

  it('counts weekday vs weekend days in the window', () => {
    const p = survivalPlan(base, ASOF)
    expect(p.weekdayCount).toBe(21)
    expect(p.weekendCount).toBe(9)
  })

  it('weekend weighting gives weekends 1.5x a weekday and still sums to the pool', () => {
    const p = survivalPlan(base, ASOF)
    expect(p.weekendRate).toBeCloseTo(1.5 * p.weekdayRate, 6)
    expect(p.weekdayRate * p.weekdayCount + p.weekendRate * p.weekendCount).toBeCloseTo(p.pool, 4)
  })

  it('reserves bills due within the long window', () => {
    const p = survivalPlan(
      { ...base, balance: 400, bills: [{ id: 'rent', amount: 200, freq: 'monthly', nextDue: '2026-01-20' }] },
      ASOF,
    )
    expect(p.pool).toBeCloseTo(200, 4)
  })

  it('flags a shortfall when commitments outstrip the pool', () => {
    const p = survivalPlan(
      { ...base, balance: 100, bills: [{ id: 'rent', amount: 400, freq: 'monthly', nextDue: '2026-01-20' }] },
      ASOF,
    )
    expect(p.status).toBe('short')
    expect(p.shortfall).toBeGreaterThan(0)
  })
})

describe('canISpend verdicts', () => {
  const state = {
    balance: 420,
    incomeSources: [{ id: 'wage', kind: 'monthly', amount: 320, nextDate: '2026-01-13' }],
    bills: [
      { id: 'phone', amount: 15, freq: 'monthly', nextDue: '2026-01-05' },
      { id: 'subs', amount: 12, freq: 'monthly', nextDue: '2026-01-08' },
    ],
    goals: [{ id: 'trip', target: 600, saved: 0, deadline: '2026-03-12' }],
    events: [],
    transactions: [],
  }

  it('says yes to a comfortable spend', () => {
    expect(canISpend(state, 50, ASOF).verdict).toBe('yes')
  })

  it('says no when it exceeds the pool', () => {
    const r = canISpend(state, 400, ASOF)
    expect(r.verdict).toBe('no')
    expect(r.over).toBeGreaterThan(0)
  })

  it('warns tight when affordable but it guts the daily rate', () => {
    expect(canISpend(state, 285, ASOF).verdict).toBe('tight')
  })
})
