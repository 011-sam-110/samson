import { describe, it, expect } from 'vitest'
import { SCENARIOS, SAVING_SCENARIOS } from './worked-examples.js'
import { spendingPace, canISpend, gaugePosition } from './pace.js'
import { savingPace, savingStreak } from './saving.js'

// The client's acceptance test, executed. Every expected value in worked-examples.js
// was calculated by hand; this asserts the engine agrees with all of them.

describe('worked examples — spending', () => {
  for (const s of SCENARIOS) {
    describe(s.title, () => {
      const result = spendingPace(s.state, s.asOf, s.period ? { period: s.period } : {})

      for (const [key, expected] of Object.entries(s.expect)) {
        if (key === 'gauge') continue
        it(`${key} = ${expected}`, () => {
          if (expected === null) expect(result[key]).toBeNull()
          else if (typeof expected === 'number') expect(result[key]).toBeCloseTo(expected, 9)
          else expect(result[key]).toBe(expected)
        })
      }

      if (s.expect.gauge !== undefined) {
        it(`gauge sits at ${s.expect.gauge}`, () => {
          expect(gaugePosition(result.ratio)).toBeCloseTo(s.expect.gauge, 9)
        })
      }
    })
  }

  // Called out separately because it is the client's "can I actually spend this?"
  // question, and the answer has to change with the size of the ask.
  it('answers the £40 question on the mid-month student with the working shown', () => {
    const s = SCENARIOS.find((x) => x.id === 'student-midmonth')
    const r = canISpend(s.state, 40, s.asOf)
    expect(r.fraction).toBeCloseTo(0.875, 9)
    expect(r.newTargetDaily).toBeCloseTo(20, 9)
    expect(r.tier).toBe('fine')
  })
})

describe('worked examples — saving', () => {
  for (const s of SAVING_SCENARIOS) {
    describe(s.title, () => {
      const result = savingPace(s.goal, s.contributions, s.asOf)
      const streak = savingStreak(s.goal, s.contributions, s.asOf)

      for (const [key, expected] of Object.entries(s.expect)) {
        it(`${key} = ${expected}`, () => {
          const actual = key === 'bestStreak' ? streak.best : key === 'currentStreak' ? streak.current : result[key]
          if (expected === null) expect(actual).toBeNull()
          else if (typeof expected === 'number') expect(actual).toBeCloseTo(expected, 9)
          else expect(actual).toBe(expected)
        })
      }
    })
  }
})
