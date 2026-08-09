// Spending pace — pure functions, no React, no storage.
//
// The client's definition, which this file implements term for term:
//
//   "How quickly am I spending the money I can actually afford to spend, compared
//    with how quickly I should be spending it to safely reach the end of the period?"
//
//   Available discretionary money = money available + expected income
//                                 − essential/upcoming commitments − planned savings
//   Target daily spending pace    = available discretionary money ÷ days remaining
//   Actual daily spending pace    = discretionary spending so far ÷ days elapsed
//   Spending Pace Ratio           = actual ÷ target
//
// Two things worth knowing before reading further.
//
// 1. TODAY COUNTS TWICE, on purpose. It is elapsed (its spending has happened) and it
//    is remaining (you can still spend the rest of it). So daysElapsed + daysRemaining
//    is one more than the period length. Each number is individually right, which is
//    what matters when someone checks them against a spreadsheet.
//
// 2. COMMITMENTS ARE ONLY THOSE DUE INSIDE THE PERIOD. An earlier version also held
//    back a pro-rata slice of bills landing just after it, so "£24/day!" never became
//    "...oh, rent landed" the day after payday. That is a good instinct and a bad fit
//    for this brief: the client asked that his spreadsheet and Pocko agree, and nobody
//    computing this by hand reserves part of next month's rent. The bills landing just
//    outside are reported instead, as `justAfterPeriod`, for the page to warn about.
//    The safety comes from the warning, not from quietly altering his arithmetic.

import { toDate, daysBetween, addDays, addMonths, nextOccurrenceOnOrAfter, occurrencesInWindow } from './dates.js'
import { requiredDailySaving } from './saving.js'
import { typeOf } from '../lib/categories.js'

// Retunable in one place — the client explicitly wants these settled after testing
// rather than argued about beforehand. The grace band above 1.00 is his: he did not
// want someone told they were in danger for being 5% over.
export const SPENDING_BANDS = { comfortable: 0.85, onPace: 1.05, over: 1.25 }

// Fewer than this many of the last 7 days carrying a logged spend means we do not
// know enough to give a verdict. Green is never shown on absent data.
export const MIN_LOGGED_DAYS = 3

// How far past the period's end we look for a big bill worth warning about.
const LOOKAHEAD_DAYS = 14

const DEFAULT_PERIOD_DAYS = 14

export function iso(d) {
  const x = toDate(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const stepBack = (date, kind) => (kind === 'monthly' ? addMonths(date, -1) : addDays(date, -7))

/**
 * The period is payday to payday: the stretch of time the money in your account has
 * to cover. Without a payday configured there is no natural period, so we use the
 * calendar month — which is what someone means by "this month" anyway, and unlike a
 * rolling window it gives "spent so far" something real to be measured against.
 */
export function resolvePeriod(state, asOf = new Date(), opts = {}) {
  const today = toDate(asOf)
  let start
  let end

  if (opts.period) {
    start = toDate(opts.period.start)
    end = toDate(opts.period.end)
  } else {
    const upcoming = (state.incomeSources || [])
      .filter((i) => i.kind && i.kind !== 'oneoff' && i.nextDate)
      .map((i) => ({
        kind: i.kind,
        date: nextOccurrenceOnOrAfter(i.nextDate, i.kind === 'monthly' ? 'monthly' : 'weekly', addDays(today, 1)),
      }))
      .sort((a, b) => a.date - b.date)

    if (upcoming.length) {
      end = upcoming[0].date
      start = stepBack(end, upcoming[0].kind)
      // A payday landing today opens a fresh period rather than backdating one.
      if (start > today) start = today
    } else {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    }
  }

  const totalDays = Math.max(daysBetween(start, end), 1)
  const daysElapsed = Math.min(Math.max(daysBetween(start, today) + 1, 1), totalDays)
  const daysRemaining = Math.min(Math.max(daysBetween(today, end), 1), totalDays)

  return { start: iso(start), end: iso(end), startDate: start, endDate: end, totalDays, daysElapsed, daysRemaining }
}

/**
 * Step 1 of the client's brief. "£500 in someone's bank account does not mean they
 * have £500 available to spend if £400 of it is needed for rent and bills."
 */
export function availableDiscretionary(state, asOf = new Date(), opts = {}) {
  const period = opts.period0 || resolvePeriod(state, asOf, opts)
  const today = toDate(asOf)
  const end = period.endDate

  const balance = Number(state.balance) || 0

  // Recurring income defines the end of the period, so anything landing inside it is
  // a one-off: a shift paid early, a birthday transfer, a refund.
  const expectedIncome = (state.incomeSources || [])
    .filter((i) => i.kind === 'oneoff' && i.date)
    .filter((i) => toDate(i.date) > today && toDate(i.date) <= end)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0)

  const billRows = (state.bills || []).flatMap((b) =>
    occurrencesInWindow(b.nextDue, b.freq, today, end).map((d) => ({
      label: b.label, amount: Number(b.amount) || 0, date: iso(d),
    })),
  )
  const commitments = billRows.reduce((s, b) => s + b.amount, 0)

  const plannedSpendRows = (state.events || [])
    .filter((e) => toDate(e.date) > today && toDate(e.date) <= end)
    .map((e) => ({ label: e.label, amount: Number(e.amount) || 0, date: e.date }))
  const plannedSpends = plannedSpendRows.reduce((s, e) => s + e.amount, 0)

  // What you intend to put aside over the rest of the period, at each goal's own
  // required rate. Money earmarked for a goal is not money you can spend tonight.
  const plannedSaving = (state.goals || []).reduce(
    (s, g) => s + requiredDailySaving(g, state.contributions, today) * period.daysRemaining,
    0,
  )

  // Bills that land just outside the period. Not withheld — reported, so the page can
  // say "rent is due 3 days after payday" rather than the number quietly shrinking.
  const lookaheadEnd = addDays(end, LOOKAHEAD_DAYS)
  const justAfterPeriod = (state.bills || []).flatMap((b) =>
    occurrencesInWindow(b.nextDue, b.freq, end, lookaheadEnd).map((d) => ({
      label: b.label, amount: Number(b.amount) || 0, date: iso(d),
    })),
  )

  const available = balance + expectedIncome - commitments - plannedSpends - plannedSaving

  return {
    balance,
    expectedIncome,
    commitments,
    commitmentRows: billRows,
    plannedSpends,
    plannedSpendRows,
    plannedSaving,
    available,
    justAfterPeriod,
    period,
  }
}

// Bands are inclusive at their upper edge, and the ratio is rounded first: a student
// spending exactly 5% over computes as 1.0500000000000003 in binary floating point,
// and being tipped into a warning by the last bit of a double is not a judgement
// anyone should have to argue with.
export function spendingBand(ratio) {
  if (ratio == null) return 'unknown'
  const r = Math.round(ratio * 1e6) / 1e6
  if (r < SPENDING_BANDS.comfortable) return 'comfortable'
  if (r <= SPENDING_BANDS.onPace) return 'on-pace'
  if (r < SPENDING_BANDS.over) return 'over'
  return 'attention'
}

// Discretionary = everything that is not a fixed cost. Rent and bills are commitments,
// already subtracted in step 1; counting them again as spending would double-punish.
function discretionarySpend(transactions, from, to) {
  return (transactions || [])
    .filter((t) => t.type === 'expense' && typeOf(t.category) !== 'fixed')
    .filter((t) => {
      const d = toDate(t.date)
      return d >= toDate(from) && d <= toDate(to)
    })
}

export function spendingPace(state, asOf = new Date(), opts = {}) {
  const period = resolvePeriod(state, asOf, opts)
  const parts = availableDiscretionary(state, asOf, { ...opts, period0: period })
  const today = toDate(asOf)

  const spendRows = discretionarySpend(state.transactions, period.startDate, today)
  const spentSoFar = spendRows.reduce((s, t) => s + (Number(t.amount) || 0), 0)

  const actualDaily = spentSoFar / period.daysElapsed
  const targetDaily = parts.available / period.daysRemaining
  const ratio = parts.available > 0 ? actualDaily / targetDaily : null

  // How many of the last 7 days carry any logged spend at all.
  const recent = discretionarySpend(state.transactions, addDays(today, -6), today)
  const loggedDays = new Set(recent.map((t) => iso(t.date))).size

  // Strictly negative. Exactly £0 available is a brand-new empty account, not a
  // student in trouble, and telling them they are short before they have entered
  // anything is the app shouting at a blank page.
  const overcommitted = parts.available < 0
  const insufficient = loggedDays < MIN_LOGGED_DAYS

  let band
  if (overcommitted) band = 'overcommitted'
  else if (insufficient) band = 'unknown'
  else band = spendingBand(ratio)

  // What is left of today's share. Today's allowance is measured from the balance as
  // it stood this morning — the current balance already has today's spending out of
  // it, so dividing that by the days left would hand the same money out twice.
  const spentToday = discretionarySpend(state.transactions, today, today)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const allowanceToday = (parts.available + spentToday) / period.daysRemaining
  const leftToday = Math.max(allowanceToday - spentToday, 0)

  return {
    ...parts,
    ...period,
    spentSoFar,
    spentToday,
    targetDaily,
    actualDaily,
    ratio,
    band,
    dataQuality: insufficient ? 'insufficient' : 'ok',
    loggedDays,
    overcommitted,
    shortfall: overcommitted ? -parts.available : 0,
    allowanceToday,
    leftToday,
    leftThisWeek: Math.max(parts.available, 0) * (Math.min(7, period.daysRemaining) / period.daysRemaining),
  }
}

// Whole pounds read better in a sentence — "about £42" is what someone checking
// their phone outside a pub can act on. But daily figures are often small, and
// rounding £7.85 and £7.79 to "£8 against the £8 they ask for" next to a ratio of
// 1.01 makes the app look like it cannot count. Under a tenner, keep the pence.
const money = (n) => {
  const v = Math.abs(n)
  return v < 10 && v % 1 !== 0 ? `£${v.toFixed(2)}` : `£${Math.round(v)}`
}

export function spendingRoom(state, asOf = new Date(), opts = {}) {
  const pace = spendingPace(state, asOf, opts)
  const available = Math.max(pace.available, 0)
  const weekDays = Math.min(7, pace.daysRemaining)
  return {
    perDay: available / pace.daysRemaining,
    today: pace.leftToday,
    thisWeek: (available / pace.daysRemaining) * weekDays,
    weekDays,
    daysRemaining: pace.daysRemaining,
  }
}

// What a spend does to the daily figure, as a fraction of the pace that survives it.
// The days cancel, so this is simply 1 − amount ÷ available — which is also why the
// tiers are relative to each person's own capacity rather than to fixed amounts.
export const SPEND_TIERS = { easy: 0.95, fine: 0.85, tight: 0.7, big: 0.5 }

/**
 * The client's complaint about the old version: at £714 of runway it returned the
 * identical headline for £50 and for £200, so it "said go for it to everything".
 * The fix is specificity, not manufactured caution — with that much runway £100
 * genuinely isn't tight, and saying otherwise would be the app lying to make a point.
 */
export function canISpend(state, amount, asOf = new Date(), opts = {}) {
  const pace = spendingPace(state, asOf, opts)
  const spend = Number(amount) || 0
  const after = pace.available - spend
  const newTargetDaily = after / pace.daysRemaining
  const fraction = pace.available > 0 ? after / pace.available : 0
  const days = pace.daysRemaining

  if (after < 0) {
    return {
      tier: 'no', affordable: false, spend, fraction, newTargetDaily,
      short: -after,
      headline: 'Better not.',
      detail: `That would leave you about ${money(after)} short before your money comes in.`,
      before: pace,
    }
  }

  let tier
  if (fraction >= SPEND_TIERS.easy) tier = 'easy'
  else if (fraction >= SPEND_TIERS.fine) tier = 'fine'
  else if (fraction >= SPEND_TIERS.tight) tier = 'tight'
  else if (fraction >= SPEND_TIERS.big) tier = 'big'
  else tier = 'stretch'

  const left = `${money(newTargetDaily)} a day for the next ${days} ${days === 1 ? 'day' : 'days'}`
  const copy = {
    easy: { headline: 'Yes — no problem.', detail: `You'd still have ${left}.` },
    fine: { headline: 'Yes, that works.', detail: `You'd have ${left}.` },
    tight: { headline: 'Yes, but it tightens things.', detail: `You'd be down to ${left}.` },
    big: { headline: "That's a big one.", detail: `It would leave you ${left}.` },
    stretch: { headline: 'You can, but it takes most of what you have.', detail: `You'd be left with ${left}.` },
  }[tier]

  return { tier, affordable: true, spend, fraction, newTargetDaily, short: 0, ...copy, before: pace }
}

/**
 * Underspend, kept deliberately separate from saving.
 *
 * The client: "if someone spends £20 less than expected, Pocko can say 'You spent £20
 * less than your usual pace this week.' But it shouldn't automatically say 'You saved
 * £20' unless that money has actually been allocated to savings."
 *
 * So this returns a sentence about SPENDING. Nothing here touches a savings balance,
 * a goal, or the saving pace — and the wording is asserted in the tests so it cannot
 * quietly drift into claiming credit for money that is still sitting in the current
 * account waiting to be spent on something else.
 */
export function underspendInsight(state, asOf = new Date(), opts = {}) {
  const pace = spendingPace(state, asOf, opts)
  const days = Math.min(7, pace.daysElapsed)
  if (days <= 0 || pace.available <= 0) return null

  const from = addDays(toDate(asOf), -(days - 1))
  const spent = discretionarySpend(state.transactions, from, asOf)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const expected = pace.targetDaily * days
  const amount = expected - spent
  if (amount <= 0) return null

  return {
    amount,
    days,
    spent,
    expected,
    text: `You spent ${money(amount)} less than your pace allowed over the last ${days} days.`,
  }
}

// Where the needle sits on the arc, 0 (left) to 1 (right).
//
// The maths and the visual are kept separate, per the brief: the formula decides the
// position, the gauge only communicates it. This is piecewise-linear so each band
// boundary lands on a fixed point of the arc, which lets the coloured segments be
// drawn once and stay honest for every user.
const GAUGE_STOPS = [
  [0, 0],
  [SPENDING_BANDS.comfortable, 0.35],
  [SPENDING_BANDS.onPace, 0.6],
  [SPENDING_BANDS.over, 0.8],
  [2, 1],
]

export function gaugePosition(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return null
  if (ratio <= 0) return 0
  for (let i = 1; i < GAUGE_STOPS.length; i++) {
    const [r0, p0] = GAUGE_STOPS[i - 1]
    const [r1, p1] = GAUGE_STOPS[i]
    if (ratio <= r1) return p0 + ((ratio - r0) / (r1 - r0)) * (p1 - p0)
  }
  return 1
}

export const GAUGE_BAND_STOPS = GAUGE_STOPS
