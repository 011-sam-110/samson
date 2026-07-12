// Leeway spending-calendar engine — pure functions over the ledger + term spans.
// No React, no storage. Reuses finance.js date helpers so day maths stays
// consistent with the dashboard's run-rate (discretionary = non-fixed spend).
import { toDate, addDays, addMonths } from './finance.js'
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
  const freq = bill.freq
  if (freq === 'oneoff' || (freq !== 'weekly' && freq !== 'monthly')) {
    const d = toDate(base)
    return d >= from && d <= to ? [isoDate(d)] : []
  }
  const fwd = freq === 'weekly' ? (x) => addDays(x, 7) : (x) => addMonths(x, 1)
  const back = freq === 'weekly' ? (x) => addDays(x, -7) : (x) => addMonths(x, -1)
  let d = toDate(base)
  let guard = 0
  while (d > from && guard++ < 1200) d = back(d)
  while (d < from && guard++ < 1200) d = fwd(d)
  const out = []
  guard = 0
  while (d <= to && guard++ < 1200) {
    out.push(isoDate(d))
    d = fwd(d)
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
