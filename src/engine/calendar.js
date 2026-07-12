// Leeway spending-calendar engine — pure functions over the ledger + term spans.
// No React, no storage. Reuses finance.js date helpers so day maths stays
// consistent with the dashboard's run-rate (discretionary = non-fixed spend).
import { toDate, addDays, addMonths, daysBetween } from './finance.js'
import { typeOf } from '../lib/categories.js'

const amt = (t) => Number(t.amount) || 0
const isDiscretionary = (t) => t.type === 'expense' && typeOf(t.category) !== 'fixed'

// A Date → local 'YYYY-MM-DD' (matches how events/bills store dates; no UTC drift).
export function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// A single day's discretionary spend. Fixed bills (rent) are excluded so one
// £480 day can't black out the heatmap and bury the everyday signal.
export function daySpend(transactions, dayISO) {
  return (transactions || [])
    .filter(isDiscretionary)
    .filter((t) => t.date === dayISO)
    .reduce((s, t) => s + amt(t), 0)
}

// Bucket a day's spend into 0–4 against the visible month's own max. 0 = no
// spend; the scale is relative, so any month reads well. Guards divide-by-zero.
export function heatLevel(spend, scaleMax) {
  if (!(spend > 0) || !(scaleMax > 0)) return 0
  return Math.min(4, Math.ceil((spend / scaleMax) * 4))
}

// Every ISO date a recurring bill lands on within [fromISO, toISO] (inclusive).
// Walks back to the window from nextDue so a bill due *after* the window but
// recurring into it is still placed, then forward collecting hits.
export function billOccurrences(bill, fromISO, toISO) {
  const from = toDate(fromISO)
  const to = toDate(toISO)
  const base = bill && bill.nextDue
  if (!base) return []
  const baseDate = toDate(base)
  const freq = bill.freq
  if (freq === 'oneoff' || (freq !== 'weekly' && freq !== 'monthly')) {
    return baseDate >= from && baseDate <= to ? [isoDate(baseDate)] : []
  }
  // Compute each occurrence as an offset from the ORIGINAL due date, so a
  // month-end day (the 31st) is re-clamped fresh each month (Jan 31 → Feb 28 →
  // Mar 31), not permanently dragged back to the 28th once it crosses February.
  const at = freq === 'weekly' ? (k) => addDays(baseDate, 7 * k) : (k) => addMonths(baseDate, k)
  let k = 0
  let guard = 0
  while (at(k) >= from && guard++ < 6000) k--
  while (at(k) < from && guard++ < 6000) k++
  const out = []
  guard = 0
  while (guard++ < 6000) {
    const d = at(k)
    if (d > to) break
    out.push(isoDate(d))
    k++
  }
  return out
}

// A month's calendar as 6 weeks × 7 days, Monday-first (UK). Leading/trailing
// days belong to the adjacent months (inMonth: false).
export function monthMatrix(anchor) {
  const a = toDate(anchor)
  const first = new Date(a.getFullYear(), a.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7 // Sun=0..Sat=6 → Mon=0..Sun=6
  const gridStart = addDays(first, -mondayOffset)
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(gridStart, w * 7 + i)
      days.push({ date: isoDate(date), inMonth: date.getMonth() === a.getMonth() })
    }
    weeks.push(days)
  }
  return weeks
}

// Term spans whose inclusive [start, end] range covers a given day.
export function termSpansOn(termSpans, dayISO) {
  const d = toDate(dayISO)
  return (termSpans || []).filter((s) => d >= toDate(s.start) && d <= toDate(s.end))
}

const SPECIAL = new Set(['freshers', 'exams'])

// The single most relevant plan-ahead nudge: an active Freshers/exams span wins,
// else the nearest one starting within 14 days. Deterministic — no AI. Returns
// null when there's nothing worth nudging about.
export function termNudge(state, asOf = new Date()) {
  const spans = (state && state.termSpans) || []
  const today = toDate(asOf)
  const surviveUntil = state && state.surviveUntil
  let active = null
  let upcoming = null
  let termEnding = null
  for (const s of spans) {
    const start = toDate(s.start)
    const end = toDate(s.end)
    const isActive = today >= start && today <= end
    if (SPECIAL.has(s.kind)) {
      if (isActive) {
        if (!active) active = s
      } else if (start > today) {
        const days = daysBetween(today, start)
        if (days <= 14 && (!upcoming || days < daysBetween(today, upcoming.start))) upcoming = s
      }
    } else if (s.kind === 'term' && isActive) {
      // A teaching term only nudges as it runs out — that's when money gets tight.
      const toEnd = daysBetween(today, end)
      if (toEnd >= 0 && toEnd <= 14 && (!termEnding || toEnd < daysBetween(today, toDate(termEnding.end)))) termEnding = s
    }
  }
  // Freshers/exams (active, then nearest upcoming) win; a term only speaks as it ends.
  const pick = active || upcoming
  if (pick) {
    const phase = active ? 'active' : 'upcoming'
    const daysUntil = phase === 'active' ? 0 : daysBetween(today, pick.start)
    return { kind: pick.kind, label: pick.label, phase, daysUntil, message: messageFor(pick, phase, daysUntil) }
  }
  if (termEnding) {
    const toEnd = daysBetween(today, toDate(termEnding.end))
    const tail = surviveUntil ? ' Check "Make it last" on Today to pace what\'s left.' : ''
    return {
      kind: 'term',
      label: termEnding.label,
      phase: 'ending',
      daysUntil: toEnd,
      message: `${termEnding.label} is nearly up — your money's stretching thin.${tail}`,
    }
  }
  return null
}

function whenPhrase(daysUntil) {
  if (daysUntil <= 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}

function messageFor(span, phase, daysUntil) {
  if (span.kind === 'freshers') {
    return phase === 'active'
      ? 'Freshers is on — the priciest week of term. Set a cap for the big nights so the rest of the month survives.'
      : `Freshers starts ${whenPhrase(daysUntil)} — set a cap for the big nights so the rest of the month survives.`
  }
  // exams
  return phase === 'active'
    ? 'Exams are on — a quiet, cheap stretch. Spend under your usual pace and bank the difference.'
    : `Exams start ${whenPhrase(daysUntil)} — a quiet, cheap stretch ahead. Plan to bank the difference.`
}

// The month, fully enriched for rendering: each cell carries its spend + heat
// level, the bills/events landing on it, and any term spans covering it.
export function buildMonth(state, anchor, asOf = new Date()) {
  const weeks = monthMatrix(anchor)
  const flat = weeks.flat()
  const gridStart = flat[0].date
  const gridEnd = flat[flat.length - 1].date
  const txns = (state && state.transactions) || []
  const todayISO = isoDate(toDate(asOf))

  // Index bills/events by day across the whole visible grid (not just the month).
  const billsByDay = new Map()
  for (const b of (state && state.bills) || []) {
    for (const day of billOccurrences(b, gridStart, gridEnd)) {
      if (!billsByDay.has(day)) billsByDay.set(day, [])
      billsByDay.get(day).push({ label: b.label, amount: Number(b.amount) || 0 })
    }
  }
  const eventsByDay = new Map()
  for (const e of (state && state.events) || []) {
    if (!eventsByDay.has(e.date)) eventsByDay.set(e.date, [])
    eventsByDay.get(e.date).push({ label: e.label, amount: Number(e.amount) || 0 })
  }

  // Heat scale is the visible month's own max discretionary day.
  const anchorMonth = toDate(anchor).getMonth()
  let scaleMax = 0
  for (const c of flat) {
    if (toDate(c.date).getMonth() !== anchorMonth) continue
    const s = daySpend(txns, c.date)
    if (s > scaleMax) scaleMax = s
  }

  const enriched = weeks.map((week) =>
    week.map((cell) => {
      const spend = daySpend(txns, cell.date)
      return {
        ...cell,
        isToday: cell.date === todayISO,
        isFuture: toDate(cell.date) > toDate(todayISO),
        spend,
        // Only the anchor month is heat-scaled; trailing/leading days belong to
        // their own month and are shown (heated) when you page to it.
        heatLevel: cell.inMonth ? heatLevel(spend, scaleMax) : 0,
        bills: billsByDay.get(cell.date) || [],
        events: eventsByDay.get(cell.date) || [],
        terms: termSpansOn(state && state.termSpans, cell.date).map((s) => ({ kind: s.kind, label: s.label })),
      }
    }),
  )

  const monthLabel = toDate(anchor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return { monthLabel, weeks: enriched }
}
