// Saving pace — pure functions, no React, no storage.
//
// The client's rule, and the reason this file is separate from the spending maths:
//
//   "I don't want the saving pace to pretend that money has been saved when it
//    hasn't actually been saved."
//
// So there are two different quantities here and they are never allowed to merge:
//
//   savedTotal    — what the goal bar shows. Opening balance + every dated transfer.
//   contributed   — what the PACE measures. Dated transfers only.
//
// An opening balance is money the student had put aside before Pocko existed. It is
// real progress toward the goal, so it counts in the first. It was never saved
// during a window we observed, so it counts for nothing in the second. Underspend
// never appears in either: see `underspendInsight` in pace.js for why that is a
// separate sentence rather than a number added to savings.

import { toDate, daysBetween, addDays } from './dates.js'

// Thresholds live here, in one object, because the client asked to retune them after
// testing rather than argue about them before it.
export const SAVING_BANDS = { behind: 0.6, slightlyBehind: 0.95, ahead: 1.15 }

// A day counts toward the streak when that day's saving pace ratio reached this.
export const STREAK_MIN_RATIO = 1

const MAX_STREAK_SCAN_DAYS = 400

export function contributionsFor(goalId, contributions = []) {
  return (contributions || []).filter((c) => c.goalId === goalId)
}

const sum = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

// Everything in the pot: what was already there, plus what has been transferred in.
export function savedTotal(goal, contributions = []) {
  const opening = Number(goal.openingBalance) || 0
  return opening + sum(contributionsFor(goal.id, contributions))
}

// What this goal still needs per day to land on time. Reported honestly: a goal whose
// deadline has passed demands nothing, because you cannot save into yesterday. (An
// earlier version clamped daysLeft to a floor of 1, which turned a lapsed £420 goal
// into a £420/day reserve and a safe-to-spend of minus several hundred pounds a day.)
export function requiredDailySaving(goal, contributions = [], asOf = new Date()) {
  const remaining = Math.max((Number(goal.target) || 0) - savedTotal(goal, contributions), 0)
  const daysLeft = daysBetween(asOf, goal.deadline)
  return remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0
}

// When did we start watching this goal? Its explicit start date if it has one (every
// goal created from now on does), else the first transfer, else today — which gives a
// one-day window and an honest "nothing observed yet".
function startedOn(goal, goalContribs, asOf) {
  if (goal.startedOn) return toDate(goal.startedOn)
  if (!goalContribs.length) return toDate(asOf)
  return goalContribs.reduce((min, c) => (toDate(c.date) < min ? toDate(c.date) : min), toDate(goalContribs[0].date))
}

export function savingBand(ratio) {
  if (ratio == null) return 'unknown'
  const r = Math.round(ratio * 1e6) / 1e6
  if (r >= SAVING_BANDS.ahead) return 'ahead'
  if (r >= SAVING_BANDS.slightlyBehind) return 'on-pace'
  if (r >= SAVING_BANDS.behind) return 'slightly-behind'
  return 'behind'
}

/**
 * The client's formula, term for term:
 *   Required daily saving = amount remaining ÷ days remaining until the target date
 *   Actual saving pace    = amount actually saved ÷ days elapsed
 *   Saving Pace Ratio     = actual ÷ required
 */
export function savingPace(goal, contributions = [], asOf = new Date()) {
  const goalContribs = contributionsFor(goal.id, contributions)
  const target = Number(goal.target) || 0
  const saved = savedTotal(goal, contributions)
  const remaining = Math.max(target - saved, 0)
  const daysRemaining = daysBetween(asOf, goal.deadline)

  const start = startedOn(goal, goalContribs, asOf)
  const daysElapsed = Math.max(daysBetween(start, asOf) + 1, 1)

  // Dated transfers only, and only those that have actually happened by `asOf`.
  // The opening balance is deliberately absent from this line — that is the whole
  // distinction the client asked for.
  const banked = goalContribs.filter((c) => toDate(c.date) <= toDate(asOf))
  const contributed = sum(banked)
  const actualDaily = contributed / daysElapsed
  const requiredDaily = requiredDailySaving(goal, contributions, asOf)

  const done = remaining <= 0
  const missed = !done && daysRemaining <= 0
  // Nothing logged means nothing observed. Reporting "0% of required pace" to someone
  // who has never used the transfer button is a verdict on the app, not on them.
  const insufficient = !done && banked.length === 0

  const ratio = !done && requiredDaily > 0 ? actualDaily / requiredDaily : null

  let band = savingBand(ratio)
  if (done) band = 'done'
  else if (missed) band = 'missed'
  else if (insufficient) band = 'unknown'

  return {
    goalId: goal.id,
    label: goal.label,
    deadline: goal.deadline,
    target,
    savedTotal: saved,
    openingBalance: Number(goal.openingBalance) || 0,
    contributed,
    remaining,
    daysRemaining,
    daysElapsed,
    requiredDaily,
    actualDaily,
    ratio,
    band,
    done,
    missed,
    dataQuality: insufficient ? 'insufficient' : 'ok',
    pct: target > 0 ? Math.min(saved / target, 1) : 0,
    // Days beats percent as plain English early on: £10 against a £6.67/day target on
    // day one reads as 150%, which swings wildly and tells nobody very much.
    daysAhead: requiredDaily > 0 ? (contributed - requiredDaily * daysElapsed) / requiredDaily : 0,
  }
}

// One rate across every live goal, for the Analytics hero: everything that needs to go
// aside per day, against everything that actually is.
export function overallSavingPace(goals = [], contributions = [], asOf = new Date()) {
  const paces = goals.map((g) => savingPace(g, contributions, asOf)).filter((p) => !p.done && !p.missed)
  const requiredDaily = paces.reduce((s, p) => s + p.requiredDaily, 0)
  const actualDaily = paces.reduce((s, p) => s + p.actualDaily, 0)
  const anyLogged = paces.some((p) => p.dataQuality === 'ok')
  const ratio = requiredDaily > 0 && anyLogged ? actualDaily / requiredDaily : null
  return {
    goals: paces,
    requiredDaily,
    actualDaily,
    ratio,
    band: anyLogged ? savingBand(ratio) : 'unknown',
    dataQuality: anyLogged ? 'ok' : 'insufficient',
  }
}

/**
 * The streak, in the client's words: "7 days saving at or above your target pace."
 *
 * A day counts when the saving pace ratio, as it stood on that day, reached
 * STREAK_MIN_RATIO. Deliberately not "did you move any money today" — the client's
 * objection was that transferring £1 to keep a streak alive rewards the wrong thing,
 * and against a required pace £1 simply does not clear the bar. What is rewarded is
 * staying at or ahead of the rate the goal actually needs.
 */
export function savingStreak(goal, contributions = [], asOf = new Date()) {
  const goalContribs = contributionsFor(goal.id, contributions)
  if (!goalContribs.length) return { current: 0, best: 0, days: [] }

  const start = startedOn(goal, goalContribs, asOf)
  const span = Math.min(daysBetween(start, asOf), MAX_STREAK_SCAN_DAYS)
  if (span < 0) return { current: 0, best: 0, days: [] }

  const days = []
  for (let i = 0; i <= span; i++) {
    const day = addDays(start, i)
    const p = savingPace(goal, contributions, day)
    days.push({ date: day, hit: p.done || (p.ratio != null && Math.round(p.ratio * 1e6) / 1e6 >= STREAK_MIN_RATIO) })
  }

  let best = 0
  let run = 0
  for (const d of days) {
    run = d.hit ? run + 1 : 0
    if (run > best) best = run
  }

  let current = 0
  for (let i = days.length - 1; i >= 0 && days[i].hit; i--) current++

  return { current, best, days }
}
