// Leeway finance engine - pure functions, no React, no storage.
// Everything is expressed as a DAILY RATE, matching the "£/day like mph" framing.
//
// The two ideas that make the number trustworthy:
//   1. Target daily rate  = income/day - bills/day - goals/day  (what's sustainable forever).
//   2. Safe-to-spend      = of your current cash, hold back what bills + goals + planned
//                           events will need before your next income, spread the rest across
//                           the days until that income lands.
//
// The rent fix: a recurring bill due AFTER the window still reserves its fair pro-rata
// slice now, so "£24/day!" never turns into "...oh, rent landed" the day after payday.

import { typeOf } from '../lib/categories.js'

export const DAYS_PER_MONTH = 30.4375 // average Gregorian month
export const DAYS_PER_WEEK = 7

const DAY_MS = 86400000

// ── date helpers ──────────────────────────────────────────────────────────────
export function toDate(x) {
  if (x instanceof Date) return new Date(x.getFullYear(), x.getMonth(), x.getDate())
  // 'YYYY-MM-DD' → local midnight (avoids UTC off-by-one)
  const [y, m, d] = String(x).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(from, to) {
  return Math.round((toDate(to) - toDate(from)) / DAY_MS)
}

export function addDays(date, n) {
  const d = toDate(date)
  d.setDate(d.getDate() + n)
  return d
}

function addMonths(date, n) {
  const d = toDate(date)
  const targetDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  // clamp to end-of-month (e.g. Jan 31 + 1mo → Feb 28)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDay))
  return d
}

function stepFor(freq) {
  return freq === 'monthly' ? (d) => addMonths(d, 1) : (d) => addDays(d, 7) // weekly/hourly cadence
}

// First occurrence of a recurring date on or after `asOf`.
export function nextOccurrenceOnOrAfter(baseDate, freq, asOf) {
  if (freq === 'oneoff') return toDate(baseDate)
  const step = stepFor(freq)
  let d = toDate(baseDate)
  let guard = 0
  while (d < toDate(asOf) && guard++ < 600) d = step(d)
  return d
}

// Recurring/one-off due dates strictly within (asOf, windowEnd].
function occurrencesInWindow(baseDate, freq, asOf, windowEnd) {
  const after = addDays(asOf, 1)
  if (freq === 'oneoff') {
    const d = toDate(baseDate)
    return d >= after && d <= toDate(windowEnd) ? [d] : []
  }
  const step = stepFor(freq)
  let d = nextOccurrenceOnOrAfter(baseDate, freq, after)
  const out = []
  let guard = 0
  while (d <= toDate(windowEnd) && guard++ < 600) {
    out.push(d)
    d = step(d)
  }
  return out
}

// ── per-day normalisers ───────────────────────────────────────────────────────
export function perDayFromIncome(source) {
  switch (source.kind) {
    case 'hourly':
      return (Number(source.rate) || 0) * (Number(source.hoursPerWeek) || 0) / DAYS_PER_WEEK
    case 'weekly':
      return (Number(source.amount) || 0) / DAYS_PER_WEEK
    case 'monthly':
      return (Number(source.amount) || 0) / DAYS_PER_MONTH
    default: // 'oneoff' - lumps of cash, not a sustainable rate
      return 0
  }
}

export function perDayFromBill(bill) {
  const amt = Number(bill.amount) || 0
  return bill.freq === 'weekly' ? amt / DAYS_PER_WEEK : amt / DAYS_PER_MONTH
}

// ── goals ─────────────────────────────────────────────────────────────────────
// A goal only holds money back while it still has days to save into.
//
// daysLeft is reported honestly - it can be 0 (due today) or negative (missed).
// It used to be clamped to a floor of 1, which quietly turned a lapsed goal into
// a demand for its whole remaining balance EVERY DAY: £420 still to go became a
// £420/day reserve, £5,880 held back over a fortnight, and a safe-to-spend of
// minus several hundred pounds a day. You cannot save into yesterday, so once
// the deadline is gone the goal reserves nothing until the user re-dates it.
// Goals surfaces it as "Deadline passed" rather than letting it rot silently.
export function goalProgress(goal, asOf = new Date()) {
  const target = Number(goal.target) || 0
  const saved = Number(goal.saved) || 0
  const remaining = Math.max(target - saved, 0)
  const daysLeft = daysBetween(asOf, goal.deadline)
  const perDay = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0
  const weeklyRequired = perDay * DAYS_PER_WEEK
  const pct = target > 0 ? Math.min(saved / target, 1) : 0
  return {
    remaining,
    daysLeft,
    weeksLeft: daysLeft / DAYS_PER_WEEK,
    perDay,
    weeklyRequired,
    pct,
    done: remaining === 0,
    dueToday: daysLeft === 0 && remaining > 0,
    overdue: daysLeft < 0 && remaining > 0,
  }
}

export function dailyGoalReserve(goal, asOf = new Date()) {
  return goalProgress(goal, asOf).perDay
}

// ── the dashboard ───────────────────────────────────────────────────────────
const DEFAULTS = { lookbackDays: 14, comfortFloorPerDay: 5, defaultWindowDays: 14 }

// What's spoken for in a window: one-off income arriving, bills reserved (full for
// due dates inside the window, else pro-rata - the rent fix), goals and events.
// Shared by the dashboard (next-payday window) and survivalPlan (a long horizon).
function windowReserves(state, asOf, windowEnd, windowDays, goalsPerDay) {
  const incomeSources = state.incomeSources || []
  const bills = state.bills || []
  const events = state.events || []

  const incomeInWindow = incomeSources
    .filter((i) => i.kind === 'oneoff' && i.date)
    .filter((i) => {
      const d = toDate(i.date)
      return d > toDate(asOf) && d <= toDate(windowEnd)
    })
    .reduce((s, i) => s + (Number(i.amount) || 0), 0)

  const billsReserve = bills.reduce((s, b) => {
    const occ = occurrencesInWindow(b.nextDue, b.freq, asOf, windowEnd).length
    return s + (occ >= 1 ? (Number(b.amount) || 0) * occ : perDayFromBill(b) * windowDays)
  }, 0)

  const goalsReserve = goalsPerDay * windowDays

  const eventsReserve = events
    .filter((e) => {
      const d = toDate(e.date)
      return d > toDate(asOf) && d <= toDate(windowEnd)
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return { incomeInWindow, billsReserve, goalsReserve, eventsReserve }
}

export function computeDashboard(state, asOf = new Date(), opts = {}) {
  const { lookbackDays, defaultWindowDays } = { ...DEFAULTS, ...opts }
  const incomeSources = state.incomeSources || []
  const bills = state.bills || []
  const goals = state.goals || []
  const events = state.events || []
  const transactions = state.transactions || []

  // Sustainable daily rates.
  const incomePerDay = incomeSources.reduce((s, i) => s + perDayFromIncome(i), 0)
  const billsPerDay = bills.reduce((s, b) => s + perDayFromBill(b), 0)
  const goalsPerDay = goals.reduce((s, g) => s + dailyGoalReserve(g, asOf), 0)
  const targetDaily = incomePerDay - billsPerDay - goalsPerDay
  const overCommitted = targetDaily <= 0

  // Window: now → next recurring income date (rolled forward if stale).
  const upcomingIncome = incomeSources
    .filter((i) => i.kind !== 'oneoff' && i.nextDate)
    .map((i) => nextOccurrenceOnOrAfter(i.nextDate, i.kind === 'monthly' ? 'monthly' : 'weekly', addDays(asOf, 1)))
    .sort((a, b) => a - b)
  const nextIncomeDate = upcomingIncome[0] || null
  const windowDays = nextIncomeDate ? Math.max(daysBetween(asOf, nextIncomeDate), 1) : defaultWindowDays
  const windowEnd = nextIncomeDate || addDays(asOf, defaultWindowDays)

  const { incomeInWindow, billsReserve, goalsReserve, eventsReserve } = windowReserves(
    state,
    asOf,
    windowEnd,
    windowDays,
    goalsPerDay,
  )

  const pool = (Number(state.balance) || 0) + incomeInWindow - billsReserve - goalsReserve - eventsReserve
  const safePerDay = pool / windowDays
  const overspent = pool < 0
  const overAmount = overspent ? -pool : 0
  const recoveryPerDay = overspent ? overAmount / windowDays : 0

  // Run rate: trailing discretionary + variable spend.
  const lookbackStart = addDays(asOf, -lookbackDays)
  const recentSpend = transactions
    .filter((t) => t.type === 'expense' && typeOf(t.category) !== 'fixed')
    .filter((t) => {
      const d = toDate(t.date)
      return d > toDate(lookbackStart) && d <= toDate(asOf)
    })
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const currentDaily = recentSpend / lookbackDays
  const pacePct = targetDaily > 0 ? currentDaily / targetDaily : null

  return {
    // headline
    safePerDay,
    safeToday: safePerDay,
    safeThisWeek: safePerDay * Math.min(DAYS_PER_WEEK, windowDays),
    pool,
    // window
    windowDays,
    daysToPay: windowDays,
    nextIncomeDate,
    // reserves (for transparency in the UI)
    billsReserve,
    goalsReserve,
    eventsReserve,
    incomeInWindow,
    reservedTotal: billsReserve + goalsReserve + eventsReserve,
    // rates
    incomePerDay,
    billsPerDay,
    goalsPerDay,
    targetDaily,
    currentDaily,
    pacePct,
    overCommitted,
    // trouble states
    overspent,
    overAmount,
    recoveryPerDay,
  }
}

// ── "Can I spend £X?" ─────────────────────────────────────────────────────────
export function canISpend(state, amount, asOf = new Date(), opts = {}) {
  const { comfortFloorPerDay } = { ...DEFAULTS, ...opts }
  const spend = Number(amount) || 0
  const dash = computeDashboard(state, asOf, opts)
  const newPool = dash.pool - spend
  const newSafePerDay = newPool / dash.windowDays

  let verdict
  if (newPool < 0) verdict = 'no'
  else if (newSafePerDay < comfortFloorPerDay) verdict = 'tight'
  else verdict = 'yes'

  return {
    verdict,
    spend,
    newPool,
    newSafePerDay,
    over: Math.max(spend - dash.pool, 0),
    windowDays: dash.windowDays,
    before: dash,
  }
}

// ── loan-survival mode ────────────────────────────────────────────────────────
// A lump (loan/grant already sitting in the balance) that must last until a far-off
// date. Same reserve maths as the dashboard, but the window runs now → surviveUntil.
// Weekend weighting lets the rate breathe: weekends get `weekendFactor`× a weekday,
// same total, so a livable "£X midweek, £Y at the weekend".
export function survivalPlan(state, asOf = new Date(), opts = {}) {
  const { weekendFactor = 1.5 } = opts
  const surviveUntil = state.surviveUntil ? toDate(state.surviveUntil) : null
  if (!surviveUntil || surviveUntil <= toDate(asOf)) return { active: false }

  const windowDays = Math.max(daysBetween(asOf, surviveUntil), 1)
  const goalsPerDay = (state.goals || []).reduce((s, g) => s + dailyGoalReserve(g, asOf), 0)
  const { incomeInWindow, billsReserve, goalsReserve, eventsReserve } = windowReserves(
    state,
    asOf,
    surviveUntil,
    windowDays,
    goalsPerDay,
  )
  const pool = (Number(state.balance) || 0) + incomeInWindow - billsReserve - goalsReserve - eventsReserve

  // Count the day-types across the days you'll actually spend over (tomorrow → surviveUntil).
  let weekdayCount = 0
  let weekendCount = 0
  for (let i = 1; i <= windowDays; i++) {
    const dow = addDays(asOf, i).getDay()
    if (dow === 0 || dow === 6) weekendCount++
    else weekdayCount++
  }

  const flatDaily = pool / windowDays
  const denom = weekdayCount + weekendFactor * weekendCount
  const weekdayRate = denom > 0 ? pool / denom : flatDaily
  const weekendRate = weekendFactor * weekdayRate

  return {
    active: true,
    surviveUntil,
    daysLeft: windowDays,
    pool,
    flatDaily,
    weekdayRate,
    weekendRate,
    weekdayCount,
    weekendCount,
    status: pool < 0 ? 'short' : 'ok',
    shortfall: pool < 0 ? -pool : 0,
  }
}
