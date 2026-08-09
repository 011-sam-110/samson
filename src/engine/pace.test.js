import { describe, it, expect } from 'vitest'
import {
  resolvePeriod,
  availableDiscretionary,
  spendingPace,
  gaugePosition,
  SPENDING_BANDS,
  canISpend,
  spendingRoom,
  underspendInsight,
} from './pace.js'

// Every number in this file is hand-calculated and written out in the comment above
// the assertion. That is the client's own acceptance test: "if I give the same
// hypothetical financial situation to a calculator/spreadsheet and to Pocko, they
// should produce the same result."

const base = {
  version: 4,
  balance: 0,
  incomeSources: [],
  bills: [],
  goals: [],
  contributions: [],
  events: [],
  transactions: [],
}

// A 14-day period fixed explicitly, so a test states its own arithmetic rather than
// inheriting it from whatever the income cadence happens to resolve to.
const PERIOD = { start: '2026-08-01', end: '2026-08-15' }

describe('resolvePeriod', () => {
  it('runs from the previous payday to the next one', () => {
    const state = { ...base, incomeSources: [{ id: 'i1', kind: 'monthly', amount: 800, nextDate: '2026-08-25' }] }
    const p = resolvePeriod(state, '2026-08-07')
    expect(p.start).toBe('2026-07-25')
    expect(p.end).toBe('2026-08-25')
  })

  // Jul 25 → Aug 25 is 31 days. Aug 7 is the 14th day of it; 18 days are left.
  it('counts today as both elapsed and remaining', () => {
    const state = { ...base, incomeSources: [{ id: 'i1', kind: 'monthly', amount: 800, nextDate: '2026-08-25' }] }
    const p = resolvePeriod(state, '2026-08-07')
    expect(p.totalDays).toBe(31)
    expect(p.daysElapsed).toBe(14)
    expect(p.daysRemaining).toBe(18)
  })

  it('rolls a stale payday forward instead of reporting a period in the past', () => {
    const state = { ...base, incomeSources: [{ id: 'i1', kind: 'monthly', amount: 800, nextDate: '2026-01-25' }] }
    const p = resolvePeriod(state, '2026-08-07')
    expect(p.end).toBe('2026-08-25')
    expect(p.start).toBe('2026-07-25')
  })

  it('takes the earliest payday when several incomes are configured', () => {
    const state = {
      ...base,
      incomeSources: [
        { id: 'i1', kind: 'monthly', amount: 800, nextDate: '2026-08-25' },
        { id: 'i2', kind: 'weekly', amount: 90, nextDate: '2026-08-10' },
      ],
    }
    expect(resolvePeriod(state, '2026-08-07').end).toBe('2026-08-10')
  })

  // Without a payday there is no natural period, and a rolling window would make
  // "spent so far" meaningless. The calendar month is what a person means by
  // "this month" when they have no single payday.
  it('falls back to the calendar month when no recurring income exists', () => {
    const p = resolvePeriod(base, '2026-08-07')
    expect(p.start).toBe('2026-08-01')
    expect(p.end).toBe('2026-09-01')
    expect(p.totalDays).toBe(31)
  })

  it('accepts an explicit period override', () => {
    const p = resolvePeriod(base, '2026-08-01', { period: PERIOD })
    expect(p.totalDays).toBe(14)
    expect(p.daysRemaining).toBe(14)
    expect(p.daysElapsed).toBe(1)
  })
})

describe('availableDiscretionary', () => {
  // £700 balance − £400 of bills due before payday − £20 set aside for a goal = £280.
  it('is balance plus expected income minus commitments minus planned saving', () => {
    const state = {
      ...base,
      balance: 700,
      bills: [
        { id: 'b1', label: 'Rent', amount: 300, freq: 'monthly', nextDue: '2026-08-10' },
        { id: 'b2', label: 'Bills', amount: 100, freq: 'monthly', nextDue: '2026-08-05' },
      ],
      goals: [{ id: 'g1', target: 300, openingBalance: 20, deadline: '2026-08-15' }],
    }
    const a = availableDiscretionary(state, '2026-08-01', { period: PERIOD })
    // goal: £280 still to go over 14 days = £20/day, × 14 remaining = £280 reserved.
    // Deliberately sized so the test reads as 700 − 400 − 280 = 20.
    expect(a.commitments).toBe(400)
    expect(a.plannedSaving).toBe(280)
    expect(a.available).toBe(20)
  })

  it('counts one-off income arriving before the period ends', () => {
    const state = {
      ...base,
      balance: 200,
      incomeSources: [{ id: 'i1', kind: 'oneoff', amount: 150, date: '2026-08-06' }],
    }
    const a = availableDiscretionary(state, '2026-08-01', { period: PERIOD })
    expect(a.expectedIncome).toBe(150)
    expect(a.available).toBe(350)
  })

  it('ignores one-off income arriving after the period ends', () => {
    const state = {
      ...base,
      balance: 200,
      incomeSources: [{ id: 'i1', kind: 'oneoff', amount: 150, date: '2026-09-06' }],
    }
    expect(availableDiscretionary(state, '2026-08-01', { period: PERIOD }).available).toBe(200)
  })

  it('counts planned one-off spends the user has entered as commitments', () => {
    const state = { ...base, balance: 500, events: [{ id: 'e1', label: 'Birthday', amount: 55, date: '2026-08-09' }] }
    const a = availableDiscretionary(state, '2026-08-01', { period: PERIOD })
    expect(a.plannedSpends).toBe(55)
    expect(a.available).toBe(445)
  })

  // The client's point, in his words: "£500 in someone's bank account does not mean
  // they have £500 available to spend if £400 of it is needed for rent and bills."
  it('does not treat a bill landing after the period as spendable-but-reserved', () => {
    const state = {
      ...base,
      balance: 500,
      bills: [{ id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-20' }],
    }
    const a = availableDiscretionary(state, '2026-08-01', { period: PERIOD })
    expect(a.commitments).toBe(0)
    expect(a.available).toBe(500)
    // ...but it is reported, so the page can warn about it rather than the maths
    // silently withholding money the client's own spreadsheet would not withhold.
    expect(a.justAfterPeriod).toEqual([{ label: 'Rent', amount: 400, date: '2026-08-20' }])
  })
})

describe('spendingPace — the client worked example', () => {
  // "£280 of genuinely discretionary money available over 14 days: £280 ÷ 14 = £20/day"
  const state = { ...base, balance: 280 }

  it('targets available money divided by the days left in the period', () => {
    const p = spendingPace(state, '2026-08-01', { period: PERIOD })
    expect(p.available).toBe(280)
    expect(p.daysRemaining).toBe(14)
    expect(p.targetDaily).toBe(20)
  })

  // "If they've been spending £15/day: £15 ÷ £20 = 0.75"
  it('reads 0.75 when spending £15/day against a £20/day target', () => {
    const s = { ...state, transactions: [{ id: 't1', type: 'expense', category: 'going_out', amount: 15, date: '2026-08-01' }] }
    const p = spendingPace(s, '2026-08-01', { period: PERIOD })
    expect(p.daysElapsed).toBe(1)
    expect(p.actualDaily).toBe(15)
    expect(p.ratio).toBe(0.75)
  })

  // "If they're spending £25/day: £25 ÷ £20 = 1.25"
  it('reads 1.25 when spending £25/day against a £20/day target', () => {
    const s = { ...state, transactions: [{ id: 't1', type: 'expense', category: 'going_out', amount: 25, date: '2026-08-01' }] }
    expect(spendingPace(s, '2026-08-01', { period: PERIOD }).ratio).toBe(1.25)
  })
})

describe('spendingPace — mid-period', () => {
  // Period Aug 1 → Aug 15. On Aug 7: 7 days elapsed, 8 days remaining.
  // £200 available ÷ 8 = £25/day target. £140 spent ÷ 7 = £20/day actual. 20/25 = 0.8.
  const state = {
    ...base,
    balance: 200,
    transactions: [
      { id: 't1', type: 'expense', category: 'groceries', amount: 100, date: '2026-08-03' },
      { id: 't2', type: 'expense', category: 'going_out', amount: 40, date: '2026-08-07' },
    ],
  }

  it('divides remaining money by remaining days, and spending so far by days elapsed', () => {
    const p = spendingPace(state, '2026-08-07', { period: PERIOD })
    expect(p.daysElapsed).toBe(7)
    expect(p.daysRemaining).toBe(8)
    expect(p.targetDaily).toBe(25)
    expect(p.spentSoFar).toBe(140)
    expect(p.actualDaily).toBe(20)
    expect(p.ratio).toBe(0.8)
  })

  it('ignores spending from before the period started', () => {
    const s = { ...state, transactions: [...state.transactions, { id: 't3', type: 'expense', category: 'going_out', amount: 90, date: '2026-07-30' }] }
    expect(spendingPace(s, '2026-08-07', { period: PERIOD }).spentSoFar).toBe(140)
  })

  it('ignores fixed costs — rent is a commitment, not discretionary spending', () => {
    const s = { ...state, transactions: [...state.transactions, { id: 't3', type: 'expense', category: 'rent', amount: 300, date: '2026-08-02' }] }
    expect(spendingPace(s, '2026-08-07', { period: PERIOD }).spentSoFar).toBe(140)
  })

  it('ignores income', () => {
    const s = { ...state, transactions: [...state.transactions, { id: 't3', type: 'income', category: 'variable', amount: 300, date: '2026-08-02' }] }
    expect(spendingPace(s, '2026-08-07', { period: PERIOD }).spentSoFar).toBe(140)
  })
})

describe('spendingPace — bands', () => {
  // On Aug 7: 7 days elapsed, 8 remaining. £160 available ÷ 8 = £20/day target.
  // Spending £140 × ratio over those 7 days gives an actual of exactly £20 × ratio,
  // spread across three days so the no-data gate is satisfied.
  const at = (ratio) => {
    const each = (140 * ratio) / 3
    const state = {
      ...base,
      balance: 160,
      transactions: ['2026-08-03', '2026-08-05', '2026-08-07'].map((date, i) => ({
        id: `t${i}`, type: 'expense', category: 'going_out', amount: each, date,
      })),
    }
    return spendingPace(state, '2026-08-07', { period: PERIOD }).band
  }

  it('is comfortable well below pace', () => expect(at(0.5)).toBe('comfortable'))
  it('is on-pace just below the line', () => expect(at(0.95)).toBe('on-pace'))

  // The client: "I'd rather we agree on sensible thresholds after testing than
  // arbitrarily tell users they're in 'danger' because they're 5% over pace."
  it('stays on-pace at 5% over rather than warning', () => expect(at(1.05)).toBe('on-pace'))
  it('warns once past the grace band', () => expect(at(1.1)).toBe('over'))
  it('only escalates to red at materially over pace', () => expect(at(1.3)).toBe('attention'))

  it('exposes its thresholds so they can be retuned in one place', () => {
    expect(SPENDING_BANDS).toEqual({ comfortable: 0.85, onPace: 1.05, over: 1.25 })
  })
})

describe('spendingPace — states the maths cannot express as a ratio', () => {
  it('reports no ratio and a distinct state when commitments exceed the money available', () => {
    const state = { ...base, balance: 100, bills: [{ id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-10' }] }
    const p = spendingPace(state, '2026-08-01', { period: PERIOD })
    expect(p.available).toBe(-300)
    expect(p.ratio).toBeNull()
    expect(p.band).toBe('overcommitted')
    expect(p.shortfall).toBe(300)
  })

  // A dial fed nothing used to sit far-left and green, which reads as "you're doing
  // great" when it means "I know nothing about you". This is the one place the app
  // could actively cost a student money.
  it('never returns a green band when almost nothing has been logged', () => {
    const p = spendingPace({ ...base, balance: 280 }, '2026-08-07', { period: PERIOD })
    expect(p.band).toBe('unknown')
    expect(p.dataQuality).toBe('insufficient')
  })

  it('starts reporting a band once enough days carry a logged spend', () => {
    const state = {
      ...base,
      balance: 280,
      transactions: [
        { id: 't1', type: 'expense', category: 'groceries', amount: 10, date: '2026-08-03' },
        { id: 't2', type: 'expense', category: 'going_out', amount: 10, date: '2026-08-05' },
        { id: 't3', type: 'expense', category: 'coffee', amount: 10, date: '2026-08-07' },
      ],
    }
    const p = spendingPace(state, '2026-08-07', { period: PERIOD })
    expect(p.dataQuality).toBe('ok')
    expect(p.band).not.toBe('unknown')
  })
})

describe('gaugePosition', () => {
  it('puts an exactly-on-pace ratio of 1.0 inside the green arc', () => {
    expect(gaugePosition(1)).toBeGreaterThan(0.35)
    expect(gaugePosition(1)).toBeLessThan(0.6)
  })

  it('pins the band boundaries to fixed points on the arc', () => {
    expect(gaugePosition(0)).toBe(0)
    expect(gaugePosition(0.85)).toBeCloseTo(0.35, 5)
    expect(gaugePosition(1.05)).toBeCloseTo(0.6, 5)
    expect(gaugePosition(1.25)).toBeCloseTo(0.8, 5)
  })

  it('rises monotonically and never leaves the arc', () => {
    let prev = -1
    for (let r = 0; r <= 4; r += 0.05) {
      const pos = gaugePosition(r)
      expect(pos).toBeGreaterThanOrEqual(prev)
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(1)
      prev = pos
    }
  })

  it('has no needle to place when there is no ratio', () => {
    expect(gaugePosition(null)).toBeNull()
  })
})

describe('canISpend', () => {
  // £280 available over 14 days = £20/day. Because the days cancel, the tier is just
  // what fraction of the pace survives the spend: 1 − amount ÷ available.
  const state = { ...base, balance: 280 }
  const ask = (amount) => canISpend(state, amount, '2026-08-01', { period: PERIOD })

  it('waves through a spend that barely moves the number', () => {
    const r = ask(5) // 1 − 5/280 = 0.982
    expect(r.affordable).toBe(true)
    expect(r.tier).toBe('easy')
  })

  it('confirms a spend that leaves the pace comfortable', () => {
    const r = ask(20) // 1 − 20/280 = 0.929
    expect(r.tier).toBe('fine')
    expect(r.newTargetDaily).toBeCloseTo(18.5714, 4) // 260 ÷ 14
  })

  it('says a mid-sized spend tightens things, with the new figure', () => {
    expect(ask(70).tier).toBe('tight') // 1 − 70/280 = 0.75
  })

  it('calls a big spend big', () => {
    expect(ask(140).tier).toBe('big') // 1 − 140/280 = 0.50
  })

  it('refuses a spend that outruns the money, and says by how much', () => {
    const r = ask(300)
    expect(r.affordable).toBe(false)
    expect(r.tier).toBe('no')
    expect(r.short).toBe(20)
  })

  // The client's complaint, reproduced: at £714 of runway the old code returned the
  // identical headline for £50 and £200. Different sizes must now read differently.
  it('gives four different answers to four different amounts', () => {
    const tiers = [5, 20, 70, 140].map((a) => ask(a).tier)
    expect(new Set(tiers).size).toBe(4)
  })

  it('answers in plain English with a real figure in it', () => {
    const r = ask(20)
    expect(r.headline).toMatch(/^Yes/)
    expect(r.detail).toMatch(/£/)
  })
})

describe('spendingRoom', () => {
  // £280 over 14 days: this week is 7 of those days, so £140.
  it('states the room in a week, which is how people actually think about it', () => {
    const room = spendingRoom({ ...base, balance: 280 }, '2026-08-01', { period: PERIOD })
    expect(room.thisWeek).toBe(140)
    expect(room.perDay).toBe(20)
  })

  it('never promises more than the period has left', () => {
    const room = spendingRoom({ ...base, balance: 60 }, '2026-08-12', { period: PERIOD })
    expect(room.thisWeek).toBe(60) // only 3 days left, so the week is the rest of it
  })

  it('is zero, not negative, when the money is already spoken for', () => {
    const state = { ...base, balance: 100, bills: [{ id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-10' }] }
    expect(spendingRoom(state, '2026-08-01', { period: PERIOD }).thisWeek).toBe(0)
  })
})

describe('underspendInsight', () => {
  // Target £20/day. Over the 7 days elapsed the student spent £70, not £140.
  // That is £70 of underspend — and the client is explicit that it is NOT saving.
  const state = {
    ...base,
    balance: 200,
    transactions: ['2026-08-02', '2026-08-04', '2026-08-06'].map((date, i) => ({
      id: `t${i}`, type: 'expense', category: 'going_out', amount: 70 / 3, date,
    })),
  }

  it('reports how much less was spent than the pace allowed', () => {
    const u = underspendInsight(state, '2026-08-07', { period: PERIOD })
    expect(u.amount).toBeCloseTo(105, 6) // £25/day target × 7 days − £70 spent
    expect(u.days).toBe(7)
  })

  it('says spent-less, never saved — the money has not been allocated anywhere', () => {
    const u = underspendInsight(state, '2026-08-07', { period: PERIOD })
    expect(u.text).toMatch(/less than/i)
    expect(u.text).not.toMatch(/saved/i)
  })

  it('reports nothing when spending is at or above the pace', () => {
    const over = { ...state, transactions: state.transactions.map((t) => ({ ...t, amount: 100 })) }
    expect(underspendInsight(over, '2026-08-07', { period: PERIOD })).toBeNull()
  })
})
