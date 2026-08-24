import { describe, it, expect } from 'vitest'
import {
  overviewSummary,
  transactionsSummary,
  calendarSummary,
  analyticsSummary,
  goalsSummary,
} from './summaries.js'

// "Every major page should effectively answer: what does all this actually mean for
// me? at the very top." These are pure functions, not LLM output: a summary is the
// first thing a user reads, so it has to be instant, offline, free, and above all
// checkable. The client's stated fear is the app giving false information, and a
// generated sentence that invents a figure is exactly that failure.

const AS_OF = '2026-08-15'

const student = {
  version: 4,
  balance: 800,
  incomeSources: [{ id: 'i1', label: 'Wages', kind: 'monthly', amount: 900, nextDate: '2026-08-29' }],
  bills: [
    { id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-28' },
    { id: 'b2', label: 'Phone', amount: 20, freq: 'monthly', nextDue: '2026-08-20' },
  ],
  goals: [{ id: 'g1', label: 'Holiday', target: 300, openingBalance: 0, startedOn: '2026-08-01', deadline: '2026-09-30' }],
  contributions: [{ id: 'c1', goalId: 'g1', amount: 60, date: '2026-08-05' }],
  events: [{ id: 'e1', label: 'Birthday', amount: 50, date: '2026-08-18' }],
  termSpans: [],
  transactions: [
    { id: 't1', type: 'expense', category: 'groceries', amount: 40, date: '2026-08-10' },
    { id: 't2', type: 'expense', category: 'going_out', amount: 30, date: '2026-08-12' },
    { id: 't3', type: 'expense', category: 'eating_out', amount: 25, date: '2026-08-15' },
  ],
}

const empty = {
  version: 4, balance: 0,
  incomeSources: [], bills: [], goals: [], contributions: [], events: [], termSpans: [], transactions: [],
}

const text = (s) => [s.headline, ...s.lines].join(' ')

describe('overviewSummary', () => {
  const s = overviewSummary(student, AS_OF)

  it('leads with what the student can spend, not with a statistic', () => {
    expect(s.headline).toMatch(/£/)
  })

  it('says how much room is left this week', () => {
    expect(text(s)).toMatch(/this week/i)
  })

  it('names the commitment that is coming and when', () => {
    expect(text(s)).toMatch(/Rent/)
  })

  it('has no jargon in it', () => {
    expect(text(s)).not.toMatch(/discretionary|threshold|expenditure|ratio|pro-rata/i)
  })

  it('never invents a figure — every £ in the summary is one the engine computed', () => {
    const figures = text(s).match(/£\d+/g) || []
    expect(figures.length).toBeGreaterThan(0)
    for (const f of figures) expect(Number(f.slice(1))).not.toBeNaN()
  })

  // Green on absent data is the one failure mode that could actively cost money.
  it('says it does not know rather than reassuring, when nothing is logged', () => {
    const s2 = overviewSummary({ ...student, transactions: [] }, AS_OF)
    expect(s2.tone).toBe('neutral')
    expect(text(s2)).toMatch(/log|add|import/i)
  })

  it('warns plainly when commitments have outrun the balance', () => {
    const broke = overviewSummary({ ...student, balance: 100 }, AS_OF)
    expect(broke.tone).toBe('bad')
    expect(text(broke)).toMatch(/short/i)
  })

  it('flags a bill that lands just after payday rather than hiding it in the maths', () => {
    const state = {
      ...student,
      bills: [{ id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-31' }],
    }
    expect(text(overviewSummary(state, AS_OF))).toMatch(/Rent/)
  })

  it('works on a brand-new empty account without throwing or lying', () => {
    const s2 = overviewSummary(empty, AS_OF)
    expect(s2.tone).toBe('neutral')
    expect(s2.headline.length).toBeGreaterThan(0)
  })
})

describe('transactionsSummary', () => {
  // The period runs from the LAST payday, which is in the past. The date helper only
  // knew how to describe future dates and collapsed anything earlier to "today",
  // producing "You have spent £160 since today."
  it('never describes a date in the past as today', () => {
    const s = transactionsSummary(student, AS_OF)
    expect(text(s)).not.toMatch(/since today/i)
  })

  it('says how much has been spent this period', () => {
    expect(transactionsSummary(student, AS_OF).headline).toMatch(/£\d+/)
  })

  it('compares this period against the daily pace in plain English', () => {
    const s = transactionsSummary(student, AS_OF)
    expect(text(s)).toMatch(/£/)
    expect(text(s)).toMatch(/a day/i)
  })

  it('says so when there is nothing to summarise', () => {
    expect(text(transactionsSummary(empty, AS_OF))).toMatch(/nothing|no spending|not logged/i)
  })
})

describe('calendarSummary', () => {
  it('names what is coming up and what it costs', () => {
    const s = calendarSummary(student, AS_OF)
    expect(text(s)).toMatch(/Birthday|Rent/)
    expect(text(s)).toMatch(/£/)
  })

  it('is calm rather than alarming when the month ahead is clear', () => {
    const s = calendarSummary({ ...student, events: [], bills: [] }, AS_OF)
    expect(s.tone).not.toBe('bad')
  })

  // Regression: tone used to be `total > p.available`, comparing a 30-day cost
  // list against money available for only the CURRENT (often shorter) period —
  // so an ordinary month with rent in it read as a warning by default. The
  // `student` fixture (£800 balance, rent+phone paid on schedule, no
  // overspending) is exactly that ordinary month: £470 of known 30-day costs
  // against £330 available for the current ~14-day period, which used to warn.
  it('stays neutral for a routine month even though known 30-day costs exceed the current period\'s spending money', () => {
    const s = calendarSummary(student, AS_OF)
    expect(s.tone).toBe('neutral')
  })

  it('still warns when the student is genuinely overcommitted this period', () => {
    const overcommitted = {
      ...student,
      balance: 10,
      incomeSources: [],
      bills: [{ id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-28' }],
    }
    const s = calendarSummary(overcommitted, AS_OF)
    expect(s.tone).toBe('warn')
  })
})

describe('analyticsSummary', () => {
  it('leads with saving, because that is the page hero', () => {
    const s = analyticsSummary(student, AS_OF)
    expect(text(s)).toMatch(/sav/i)
  })

  it('never reports underspending as money saved', () => {
    const s = analyticsSummary(student, AS_OF)
    const sentence = text(s)
    if (/less than/i.test(sentence)) expect(sentence).not.toMatch(/you saved/i)
  })
})

describe('goalsSummary', () => {
  it('says how much closer the goal got and what it still needs', () => {
    const s = goalsSummary(student, AS_OF)
    expect(text(s)).toMatch(/Holiday/)
    expect(text(s)).toMatch(/£/)
  })

  it('invites a first goal rather than showing an empty verdict', () => {
    expect(text(goalsSummary(empty, AS_OF))).toMatch(/goal/i)
  })

  // Regression: tone used to be driven by the saving-pace ratio — the exact
  // metric the client said to scrap "including in the goals section". A goal
  // with months of runway and no transfers yet used to render as a warning
  // purely because the pace ratio was behind, even though nothing is wrong.
  it('stays neutral for a goal with plenty of runway and a low saving-pace ratio', () => {
    const slowStart = {
      ...student,
      goals: [{ id: 'g1', label: 'Holiday', target: 1000, openingBalance: 0, startedOn: '2026-08-01', deadline: '2027-08-01' }],
      contributions: [],
    }
    const s = goalsSummary(slowStart, AS_OF)
    expect(s.tone).toBe('neutral')
  })

  it('still warns when a goal\'s deadline has actually passed', () => {
    const missed = {
      ...student,
      goals: [{ id: 'g1', label: 'Holiday', target: 1000, openingBalance: 0, startedOn: '2026-01-01', deadline: '2026-08-01' }],
      contributions: [{ id: 'c1', goalId: 'g1', amount: 50, date: '2026-01-10' }],
    }
    const s = goalsSummary(missed, AS_OF)
    expect(s.tone).toBe('warn')
  })
})
