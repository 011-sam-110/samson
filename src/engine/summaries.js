// Page summaries — the plain-English answer to "what does all this actually mean
// for me?" that sits at the top of every page.
//
// The client's biggest single principle for the redesign: summary first, evidence
// second. The graphs can stay underneath for anyone who wants them, but nobody
// should have to read a chart to find out whether they are alright.
//
// These are PURE FUNCTIONS, not generated text. A summary is the first thing a user
// reads, so it must be instant, offline, free, and checkable. The client's stated
// fear is the app telling him something untrue; a sentence that invents a figure is
// precisely that failure. Every number below comes from the engine, and the tests
// assert the wording as well as the arithmetic.

import { spendingPace, underspendInsight, iso } from './pace.js'
import { overallSavingPace, savingPace, savingStreak } from './saving.js'
import { toDate, daysBetween, addDays } from './dates.js'

// Whole pounds read better in a sentence — "about £42" is what someone checking
// their phone outside a pub can act on. But daily figures are often small, and
// rounding £7.85 and £7.79 to "£8 against the £8 they ask for" next to a ratio of
// 1.01 makes the app look like it cannot count. Under a tenner, keep the pence.
const money = (n) => {
  const v = Math.abs(n)
  return v < 10 && v % 1 !== 0 ? `£${v.toFixed(2)}` : `£${Math.round(v)}`
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

const onThe = (date) => toDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

// "in 3 days" / "tomorrow" / "today" — dates read as distance, not as calendar entries.
//
// Past dates get named outright. This used to collapse everything with d <= 0 to
// "today", which is fine for a bill due now and wrong for the start of the period:
// it printed "You have spent £160 since today."
function when(date, asOf) {
  const d = daysBetween(asOf, date)
  if (d < 0) return onThe(date)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d <= 14) return `in ${plural(d, 'day', 'days')}`
  return onThe(date)
}

const BAND_TONE = {
  comfortable: 'good',
  'on-pace': 'good',
  over: 'warn',
  attention: 'bad',
  overcommitted: 'bad',
  unknown: 'neutral',
}

const PACE_PHRASE = {
  comfortable: 'You are spending comfortably below your pace.',
  'on-pace': 'You are right on pace.',
  over: 'You are spending a little faster than your pace.',
  attention: 'You are spending well ahead of your pace.',
}

/**
 * Overview. The client's hierarchy for this page is explicit: spending pace, then
 * "can I spend?", then what's coming, then everything else. The summary carries the
 * first three in a sentence each.
 */
export function overviewSummary(state, asOf = new Date()) {
  const p = spendingPace(state, asOf)
  const lines = []

  if (p.overcommitted) {
    return {
      tone: 'bad',
      headline: `You are about ${money(p.shortfall)} short before your money comes in.`,
      lines: [
        `Rent, bills and anything already planned come to more than what is in your account.`,
        `Cutting a planned spend, or moving a goal's deadline back, is the quickest way to close it.`,
      ],
    }
  }

  const headline = `You have about ${money(p.leftThisWeek)} of spending money this week.`

  if (p.dataQuality === 'insufficient') {
    lines.push('There is not enough logged yet to tell you how fast you are spending.')
    lines.push('Add a few days of spending, or import a statement, and this fills in.')
  } else {
    lines.push(PACE_PHRASE[p.band])
    lines.push(`That works out at about ${money(p.targetDaily)} a day for the next ${plural(p.daysRemaining, 'day', 'days')}.`)
  }

  // What is coming. The BIGGEST thing, not the nearest: "important upcoming
  // commitments" means the £400 of rent, not the £20 phone bill that happens to land
  // first. The page lists the rest underneath; the summary gets the one that matters.
  const upcoming = [...p.commitmentRows, ...p.plannedSpendRows]
    .sort((a, b) => b.amount - a.amount || toDate(a.date) - toDate(b.date))
  if (upcoming.length) {
    const next = upcoming[0]
    lines.push(`${next.label} of ${money(next.amount)} comes out ${when(next.date, asOf)}.`)
  }

  // Bills landing just outside the period are NOT withheld from the maths — the
  // client wanted his spreadsheet and Pocko to agree. So they get said out loud.
  if (p.justAfterPeriod.length) {
    const b = p.justAfterPeriod[0]
    lines.push(`${b.label} of ${money(b.amount)} lands just after that, on ${when(b.date, asOf)}.`)
  }

  const tone = p.dataQuality === 'insufficient' ? 'neutral' : BAND_TONE[p.band] || 'neutral'
  return { tone, headline, lines, pace: p }
}

export function transactionsSummary(state, asOf = new Date()) {
  const p = spendingPace(state, asOf)

  if (!p.spentSoFar) {
    return {
      tone: 'neutral',
      headline: 'Nothing logged this period yet.',
      lines: ['Add a spend, or import a statement, and your pace appears here.'],
    }
  }

  const lines = [
    `That is about ${money(p.actualDaily)} a day over ${plural(p.daysElapsed, 'day', 'days')}.`,
  ]
  if (p.dataQuality === 'ok') {
    lines.push(
      p.ratio > 1
        ? `Your pace allows about ${money(p.targetDaily)} a day, so you are running ahead of it.`
        : `Your pace allows about ${money(p.targetDaily)} a day, so you are inside it.`,
    )
  }

  return {
    tone: p.dataQuality === 'insufficient' ? 'neutral' : BAND_TONE[p.band] || 'neutral',
    headline: `You have spent ${money(p.spentSoFar)} since ${when(p.start, asOf)}.`,
    lines,
  }
}

export function calendarSummary(state, asOf = new Date()) {
  const p = spendingPace(state, asOf)
  const horizon = addDays(toDate(asOf), 30)

  const items = [
    ...(state.bills || []).map((b) => ({ label: b.label, amount: Number(b.amount) || 0, date: b.nextDue })),
    ...(state.events || []).map((e) => ({ label: e.label, amount: Number(e.amount) || 0, date: e.date })),
  ]
    .filter((x) => x.date && toDate(x.date) >= toDate(asOf) && toDate(x.date) <= horizon)
    .sort((a, b) => toDate(a.date) - toDate(b.date))

  if (!items.length) {
    return {
      tone: 'good',
      headline: 'Nothing booked in for the next month.',
      lines: [`You have about ${money(p.targetDaily)} a day to play with.`],
    }
  }

  const total = items.reduce((s, x) => s + x.amount, 0)
  const next = items[0]
  return {
    tone: total > Math.max(p.available, 0) ? 'warn' : 'neutral',
    headline: `${money(total)} of known costs over the next month.`,
    lines: [
      `Next up is ${next.label}, ${money(next.amount)}, ${when(next.date, asOf)}.`,
      `${plural(items.length, 'thing is', 'things are')} on the calendar between now and then.`,
    ],
  }
}

export function analyticsSummary(state, asOf = new Date()) {
  const goals = state.goals || []
  const saving = overallSavingPace(goals, state.contributions, asOf)
  const under = underspendInsight(state, asOf)
  const lines = []

  let headline
  let tone = 'neutral'

  if (!goals.length) {
    headline = 'No saving goals yet.'
    lines.push('Set one and Pocko can show you whether you are on track for it.')
  } else if (saving.dataQuality === 'insufficient') {
    headline = 'No money has been moved into a goal yet.'
    lines.push(`Your goals need about ${money(saving.requiredDaily)} a day between them.`)
    lines.push('Transfer something towards one and your saving pace starts here.')
  } else if (saving.ratio >= 1) {
    tone = 'good'
    headline = `You are saving at ${Math.round(saving.ratio * 100)}% of what your goals need.`
    lines.push(`That is ${money(saving.actualDaily)} a day against the ${money(saving.requiredDaily)} they ask for.`)
  } else {
    tone = saving.band === 'behind' ? 'bad' : 'warn'
    headline = `You are saving at ${Math.round(saving.ratio * 100)}% of what your goals need.`
    lines.push(`That is ${money(saving.actualDaily)} a day against the ${money(saving.requiredDaily)} they ask for.`)
  }

  // Underspending is a fact about SPENDING. The client was explicit that it must not
  // be dressed up as saving, because tomorrow that money can still go on clothes.
  if (under) lines.push(`${under.text} That money is still in your account, not saved.`)

  return { tone, headline, lines, saving }
}

export function goalsSummary(state, asOf = new Date()) {
  const goals = state.goals || []
  if (!goals.length) {
    return {
      tone: 'neutral',
      headline: 'You have not set a saving goal yet.',
      lines: ['A goal gives the app something to measure your saving against.'],
    }
  }

  const paces = goals.map((g) => savingPace(g, state.contributions, asOf))
  const live = paces.filter((p) => !p.done && !p.missed)
  const closest = [...live].sort((a, b) => a.daysRemaining - b.daysRemaining)[0] || paces[0]
  const streak = savingStreak(goals.find((g) => g.id === closest.goalId) || goals[0], state.contributions, asOf)

  const lines = []
  if (closest.done) {
    lines.push(`${closest.label} is fully funded.`)
  } else if (closest.dataQuality === 'insufficient') {
    lines.push(`Nothing has been transferred towards it yet, so there is no pace to report.`)
  } else {
    lines.push(`You have put in ${money(closest.contributed)} so far, about ${money(closest.actualDaily)} a day.`)
    if (streak.current >= 2) lines.push(`${plural(streak.current, 'day', 'days')} at or above the pace it needs.`)
  }

  const done = paces.filter((p) => p.done).length
  if (done) lines.push(`${plural(done, 'goal is', 'goals are')} already there.`)

  return {
    tone: closest.done ? 'good' : closest.dataQuality === 'insufficient' ? 'neutral' : closest.ratio >= 1 ? 'good' : 'warn',
    headline: closest.done
      ? `${closest.label} is done.`
      : `${closest.label} needs ${money(closest.remaining)} more by ${when(closest.deadline, asOf)}.`,
    lines,
    paces,
  }
}

export { iso }
