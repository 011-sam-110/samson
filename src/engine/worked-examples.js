// Worked examples — the client's acceptance test, in one place.
//
//   "Before implementation, I'd like the formulas above to be treated as the source
//    of truth and tested against a handful of manually calculated examples. If I give
//    the same hypothetical financial situation to a calculator/spreadsheet and to
//    Pocko, they should produce the same result."
//
// Each scenario below states its inputs, the arithmetic worked out by hand, and the
// expected answer. `worked-examples.test.js` asserts the engine reproduces every one
// of them; `scripts/worked-examples.mjs` prints the same table so the numbers can be
// checked against a spreadsheet without reading any code.
//
// If a formula ever changes, these fail loudly — which is the point. They are the
// contract, not a snapshot of whatever the code currently happens to do.

export const SCENARIOS = [
  {
    id: 'client-spending',
    title: "The client's own spending example",
    story:
      '£280 of genuinely discretionary money, 14 days to go, spending £15 a day.',
    asOf: '2026-08-01',
    period: { start: '2026-08-01', end: '2026-08-15' },
    state: {
      balance: 280,
      incomeSources: [], bills: [], goals: [], contributions: [], events: [],
      transactions: [{ id: 't1', type: 'expense', category: 'going_out', amount: 15, date: '2026-08-01' }],
    },
    workings: [
      ['Available discretionary money', '£280 balance, nothing committed', 280],
      ['Days remaining', 'Aug 1 → Aug 15, today still spendable', 14],
      ['Target daily spending pace', '£280 ÷ 14', 20],
      ['Days elapsed', 'today is day 1', 1],
      ['Actual daily spending pace', '£15 ÷ 1', 15],
      ['Spending Pace Ratio', '£15 ÷ £20', 0.75],
    ],
    expect: { available: 280, daysRemaining: 14, targetDaily: 20, daysElapsed: 1, actualDaily: 15, ratio: 0.75 },
  },

  {
    id: 'client-spending-over',
    title: "The client's example, spending faster",
    story: 'The same £280 over 14 days, but spending £25 a day.',
    asOf: '2026-08-01',
    period: { start: '2026-08-01', end: '2026-08-15' },
    state: {
      balance: 280,
      incomeSources: [], bills: [], goals: [], contributions: [], events: [],
      transactions: [{ id: 't1', type: 'expense', category: 'going_out', amount: 25, date: '2026-08-01' }],
    },
    workings: [
      ['Target daily spending pace', '£280 ÷ 14', 20],
      ['Actual daily spending pace', '£25 ÷ 1', 25],
      ['Spending Pace Ratio', '£25 ÷ £20', 1.25],
      ['Gauge', '1.25 is the top of the amber band', 0.8],
    ],
    expect: { targetDaily: 20, actualDaily: 25, ratio: 1.25, gauge: 0.8 },
  },

  {
    id: 'student-midmonth',
    title: 'A student halfway through the month',
    story:
      '£800 in the account, paid on the 29th. Rent £400, phone £20 and subscriptions £10 all '
      + 'due before then, plus a £50 birthday already planned. £360 of discretionary spending so far.',
    asOf: '2026-08-15',
    state: {
      balance: 800,
      incomeSources: [{ id: 'i1', label: 'Wages', kind: 'monthly', amount: 900, nextDate: '2026-08-29' }],
      bills: [
        { id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-28' },
        { id: 'b2', label: 'Phone', amount: 20, freq: 'monthly', nextDue: '2026-08-20' },
        { id: 'b3', label: 'Subscriptions', amount: 10, freq: 'monthly', nextDue: '2026-08-22' },
      ],
      goals: [], contributions: [],
      events: [{ id: 'e1', label: 'Birthday', amount: 50, date: '2026-08-18' }],
      transactions: [
        { id: 't1', type: 'expense', category: 'groceries', amount: 150, date: '2026-08-03' },
        { id: 't2', type: 'expense', category: 'going_out', amount: 80, date: '2026-08-10' },
        { id: 't3', type: 'expense', category: 'eating_out', amount: 70, date: '2026-08-12' },
        { id: 't4', type: 'expense', category: 'shopping', amount: 60, date: '2026-08-15' },
      ],
    },
    workings: [
      ['Period', 'payday to payday: Jul 29 → Aug 29', 31],
      ['Days elapsed', 'Jul 29 → Aug 15, today included', 18],
      ['Days remaining', 'Aug 15 → Aug 29', 14],
      ['Commitments', 'rent £400 + phone £20 + subs £10', 430],
      ['Planned spends', 'birthday on the 18th', 50],
      ['Available discretionary money', '£800 − £430 − £50', 320],
      ['Target daily spending pace', '£320 ÷ 14', 22.857142857142858],
      ['Actual daily spending pace', '£360 ÷ 18', 20],
      ['Spending Pace Ratio', '£20 ÷ £22.857 = 280 ÷ 320', 0.875],
      ['Spending room this week', '£320 × 7 ÷ 14', 160],
      ['Can I spend £40?', '(£320 − £40) ÷ £320 = 0.875 → yes, that works', 0.875],
    ],
    expect: {
      totalDays: 31, daysElapsed: 18, daysRemaining: 14,
      commitments: 430, plannedSpends: 50, available: 320,
      targetDaily: 22.857142857142858, spentSoFar: 360, actualDaily: 20,
      ratio: 0.875, band: 'on-pace', leftThisWeek: 160,
    },
  },

  {
    id: 'overcommitted',
    title: 'Committed beyond the balance',
    story: '£100 in the account with £400 of rent still to come out before payday.',
    asOf: '2026-08-01',
    period: { start: '2026-08-01', end: '2026-08-15' },
    state: {
      balance: 100,
      incomeSources: [], goals: [], contributions: [], events: [], transactions: [],
      bills: [{ id: 'b1', label: 'Rent', amount: 400, freq: 'monthly', nextDue: '2026-08-10' }],
    },
    workings: [
      ['Available discretionary money', '£100 − £400', -300],
      ['Spending Pace Ratio', 'no ratio exists — there is no safe pace to be a fraction of', null],
      ['Shortfall', 'the gap to cover before payday', 300],
    ],
    expect: { available: -300, ratio: null, band: 'overcommitted', shortfall: 300 },
  },

  {
    id: 'nothing-logged',
    title: 'Nothing logged yet',
    story: '£280 available and not a single transaction recorded.',
    asOf: '2026-08-07',
    period: { start: '2026-08-01', end: '2026-08-15' },
    state: {
      balance: 280,
      incomeSources: [], bills: [], goals: [], contributions: [], events: [], transactions: [],
    },
    workings: [
      ['Spending Pace Ratio', '£0 ÷ £35 — arithmetically zero', 0],
      ['Verdict shown', 'none: fewer than 3 of the last 7 days carry a spend', 'unknown'],
    ],
    // The one place the app could actively cost a student money: a dial fed nothing
    // sits far-left and green, which reads as "you're doing great" when it means
    // "I know nothing about you".
    expect: { ratio: 0, band: 'unknown', dataQuality: 'insufficient' },
  },
]

export const SAVING_SCENARIOS = [
  {
    id: 'client-saving',
    title: "The client's own saving example",
    story:
      'A student wants £300 for a holiday in 30 days. £100 has gone in over the 10 days so far, '
      + 'in four transfers of £25.',
    asOf: '2026-08-10',
    goal: { id: 'g1', label: 'Holiday', target: 300, openingBalance: 0, startedOn: '2026-08-01', deadline: '2026-09-09' },
    contributions: [
      { id: 'c1', goalId: 'g1', amount: 25, date: '2026-08-01' },
      { id: 'c2', goalId: 'g1', amount: 25, date: '2026-08-04' },
      { id: 'c3', goalId: 'g1', amount: 25, date: '2026-08-07' },
      { id: 'c4', goalId: 'g1', amount: 25, date: '2026-08-10' },
    ],
    workings: [
      ['Amount remaining', '£300 − £100', 200],
      ['Days remaining', 'Aug 10 → Sep 9', 30],
      ['Required daily saving', '£200 ÷ 30', 6.666666666666667],
      ['Amount actually saved', 'four £25 transfers', 100],
      ['Days elapsed', 'Aug 1 → Aug 10, today included', 10],
      ['Actual saving pace', '£100 ÷ 10', 10],
      ['Saving Pace Ratio', '£10 ÷ £6.67', 1.5],
    ],
    expect: { remaining: 200, daysRemaining: 30, requiredDaily: 6.666666666666667, contributed: 100, daysElapsed: 10, actualDaily: 10, ratio: 1.5, band: 'ahead' },
  },

  {
    id: 'opening-balance',
    title: 'Money put aside before Pocko',
    story:
      '£180 was already saved toward a £300 goal before the app existed, and nothing has been '
      + 'transferred since.',
    asOf: '2026-08-10',
    goal: { id: 'g1', label: 'Holiday', target: 300, openingBalance: 180, startedOn: '2026-08-01', deadline: '2026-09-09' },
    contributions: [],
    workings: [
      ['Progress shown on the goal bar', 'the £180 is real money and still counts', 180],
      ['Amount counted toward saving pace', 'none of it was saved in a window we watched', 0],
      ['Saving Pace Ratio', 'no transfers logged, so no verdict', null],
    ],
    // The client's distinction: actual money saved vs money that merely wasn't spent.
    expect: { savedTotal: 180, contributed: 0, band: 'unknown', dataQuality: 'insufficient' },
  },

  {
    id: 'streak',
    title: 'A streak that measures pace, not button presses',
    story:
      '£10 a day into the same £300 goal for five days, then nothing. The required pace is about '
      + '£7.44/day at the start.',
    asOf: '2026-08-10',
    goal: { id: 'g1', label: 'Holiday', target: 300, openingBalance: 0, startedOn: '2026-08-01', deadline: '2026-09-09' },
    contributions: Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`, goalId: 'g1', amount: 10, date: `2026-08-0${i + 1}`,
    })),
    workings: [
      ['Aug 6', '£50 ÷ 6 days = £8.33 vs £250 ÷ 34 = £7.35 required → 1.13, still on pace', true],
      ['Aug 7', '£50 ÷ 7 days = £7.14 vs £250 ÷ 33 = £7.58 required → 0.94, pace lost', false],
      ['Best streak', 'Aug 1 to Aug 6', 6],
      ['Current streak', 'four days behind pace', 0],
    ],
    expect: { bestStreak: 6, currentStreak: 0 },
  },
]
