// Leeway spending-calendar engine — pure functions over the ledger + term spans.
// No React, no storage. Reuses finance.js date helpers so day maths stays
// consistent with the dashboard's run-rate (discretionary = non-fixed spend).
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
