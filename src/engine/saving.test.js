import { describe, it, expect } from 'vitest'
import {
  savedTotal,
  requiredDailySaving,
  savingPace,
  savingStreak,
  overallSavingPace,
  SAVING_BANDS,
} from './saving.js'

// As in pace.test.js, every expected number is worked out by hand in the comment
// above it. The client asked that a spreadsheet and Pocko agree; these are the
// spreadsheet.

const AS_OF = '2026-08-10'

// The client's own example: "A student wants £300 for a holiday in 30 days. They have
// already saved £100." Started Aug 1 (10 days elapsed including today), deadline
// Sep 9 (30 days away), £100 in over four dated transfers.
const holiday = { id: 'g1', label: 'Holiday', target: 300, openingBalance: 0, startedOn: '2026-08-01', deadline: '2026-09-09' }
const holidayContribs = [
  { id: 'c1', goalId: 'g1', amount: 25, date: '2026-08-01' },
  { id: 'c2', goalId: 'g1', amount: 25, date: '2026-08-04' },
  { id: 'c3', goalId: 'g1', amount: 25, date: '2026-08-07' },
  { id: 'c4', goalId: 'g1', amount: 25, date: '2026-08-10' },
]

describe('savingPace — the client worked example', () => {
  const p = savingPace(holiday, holidayContribs, AS_OF)

  // "£200 remaining ÷ 30 = £6.67/day required"
  it('requires the amount still to go divided by the days left', () => {
    expect(p.remaining).toBe(200)
    expect(p.daysRemaining).toBe(30)
    expect(p.requiredDaily).toBeCloseTo(6.6667, 4)
  })

  // "If they've actually been saving £10/day" — £100 over the 10 days elapsed.
  it('measures actual saving as money in, divided by days elapsed', () => {
    expect(p.contributed).toBe(100)
    expect(p.daysElapsed).toBe(10)
    expect(p.actualDaily).toBe(10)
  })

  // "£10 ÷ £6.67 = 1.50 — they're saving at 150% of the required pace"
  it('reads 1.50', () => {
    expect(p.ratio).toBeCloseTo(1.5, 6)
    expect(p.band).toBe('ahead')
  })
})

describe('savingPace — actual saving vs potential saving', () => {
  // The distinction the client called out: "it shouldn't falsely increase the user's
  // actual savings balance" unless the money has really been allocated.
  it('counts an opening balance toward progress but not toward pace', () => {
    const goal = { ...holiday, openingBalance: 180, startedOn: '2026-08-01' }
    const p = savingPace(goal, [], AS_OF)
    expect(p.savedTotal).toBe(180)
    expect(p.contributed).toBe(0)
  })

  // The regression the redesign spec demanded: a pre-v4 goal carrying saved:180 must
  // still show £180 of progress after migration and add nothing to the pace.
  it('shows a migrated goal at full progress with no pace credit', () => {
    const goal = { id: 'g9', label: 'Old goal', target: 300, openingBalance: 180, deadline: '2026-09-09' }
    expect(savedTotal(goal, [])).toBe(180)
    expect(savingPace(goal, [], AS_OF).contributed).toBe(0)
  })

  it('adds an opening balance and real transfers together for the goal bar only', () => {
    const goal = { ...holiday, openingBalance: 100 }
    const p = savingPace(goal, holidayContribs, AS_OF)
    expect(p.savedTotal).toBe(200) // 100 opening + 100 transferred
    expect(p.contributed).toBe(100) // pace sees the transfers alone
    expect(p.remaining).toBe(100) // 300 − 200
  })

  // Never a red 0.00 for someone who has simply not used the transfer button yet.
  it('reports insufficient data rather than a verdict when nothing has been logged', () => {
    const p = savingPace({ ...holiday, openingBalance: 180 }, [], AS_OF)
    expect(p.dataQuality).toBe('insufficient')
    expect(p.band).toBe('unknown')
  })
})

describe('savingPace — goals at their edges', () => {
  it('reports a finished goal as done rather than as a pace', () => {
    const p = savingPace({ ...holiday, openingBalance: 300 }, [], AS_OF)
    expect(p.done).toBe(true)
    expect(p.band).toBe('done')
    expect(p.remaining).toBe(0)
  })

  it('reports a passed deadline as missed, and demands nothing per day', () => {
    const goal = { ...holiday, deadline: '2026-08-01' }
    const p = savingPace(goal, holidayContribs, AS_OF)
    expect(p.missed).toBe(true)
    expect(p.requiredDaily).toBe(0)
    expect(requiredDailySaving(goal, holidayContribs, AS_OF)).toBe(0)
  })

  it('ignores transfers dated after the day being measured', () => {
    const future = [...holidayContribs, { id: 'c5', goalId: 'g1', amount: 500, date: '2026-08-20' }]
    expect(savingPace(holiday, future, AS_OF).contributed).toBe(100)
  })

  it('ignores transfers belonging to another goal', () => {
    const other = [...holidayContribs, { id: 'c6', goalId: 'g2', amount: 500, date: '2026-08-05' }]
    expect(savingPace(holiday, other, AS_OF).contributed).toBe(100)
  })

  it('exposes its thresholds so they can be retuned in one place', () => {
    expect(SAVING_BANDS).toEqual({ behind: 0.6, slightlyBehind: 0.95, ahead: 1.15 })
  })
})

describe('savingStreak', () => {
  // £10 into the goal every day from Aug 1 to Aug 10. The required pace starts at
  // £290/39 = £7.44/day and only falls as money goes in, so £10/day clears it every
  // single day: a 10-day streak.
  const daily = Array.from({ length: 10 }, (_, i) => ({
    id: `d${i}`, goalId: 'g1', amount: 10, date: `2026-08-${String(i + 1).padStart(2, '0')}`,
  }))

  it('counts every day the saving pace was at or above target', () => {
    const s = savingStreak(holiday, daily, AS_OF)
    expect(s.current).toBe(10)
    expect(s.best).toBe(10)
  })

  // The point of measuring the streak against the PACE rather than "did you move any
  // money today": this student saved £10/day for five days then stopped. The pace
  // carries them for one more day and then honestly runs out.
  //   Aug 6: £50 ÷ 6 days = £8.33/day vs £250 ÷ 34 = £7.35 required → 1.13, still on
  //   Aug 7: £50 ÷ 7 days = £7.14/day vs £250 ÷ 33 = £7.58 required → 0.94, broken
  it('breaks when the average falls behind, not on the first day without a transfer', () => {
    const s = savingStreak(holiday, daily.slice(0, 5), AS_OF)
    expect(s.best).toBe(6)
    expect(s.current).toBe(0)
  })

  it('cannot be gamed by a £1 transfer, because £1 does not reach the required pace', () => {
    const token = [{ id: 'p1', goalId: 'g1', amount: 1, date: '2026-08-10' }]
    const s = savingStreak({ ...holiday, startedOn: '2026-08-10' }, token, AS_OF)
    expect(s.current).toBe(0)
  })

  it('has no streak before any money has actually moved', () => {
    expect(savingStreak(holiday, [], AS_OF)).toMatchObject({ current: 0, best: 0 })
  })
})

describe('overallSavingPace', () => {
  // Two live goals.
  //   Holiday: £200 still to go ÷ 30 days = £6.6667/day required, getting £10/day.
  //   Laptop:  £300 target with £30 already in, so £270 ÷ 60 days = £4.50/day
  //            required, getting £30 ÷ 10 days elapsed = £3/day.
  // Required together £11.1667/day, actual together £13/day → 13 ÷ 11.1667 = 1.1642.
  const laptop = { id: 'g2', label: 'Laptop', target: 300, openingBalance: 0, startedOn: '2026-08-01', deadline: '2026-10-09' }
  const contribs = [...holidayContribs, { id: 'l1', goalId: 'g2', amount: 30, date: '2026-08-05' }]

  it('adds the required and actual rates across every live goal', () => {
    const o = overallSavingPace([holiday, laptop], contribs, AS_OF)
    expect(o.requiredDaily).toBeCloseTo(11.1667, 4)
    expect(o.actualDaily).toBeCloseTo(13, 6)
    expect(o.ratio).toBeCloseTo(1.1642, 4)
  })

  it('leaves finished goals out of the rate', () => {
    const o = overallSavingPace([holiday, { ...laptop, openingBalance: 300 }], contribs, AS_OF)
    expect(o.requiredDaily).toBeCloseTo(6.6667, 4)
  })

  it('reports insufficient data when no goal has a logged transfer', () => {
    const o = overallSavingPace([{ ...holiday, openingBalance: 50 }], [], AS_OF)
    expect(o.dataQuality).toBe('insufficient')
    expect(o.band).toBe('unknown')
    expect(o.ratio).toBeNull()
  })

  it('is a no-op with no goals at all', () => {
    expect(overallSavingPace([], [], AS_OF)).toMatchObject({ requiredDaily: 0, ratio: null })
  })
})
