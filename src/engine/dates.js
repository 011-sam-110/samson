// Calendar arithmetic, split out of finance.js so the saving engine can use it
// without finance.js and saving.js importing each other in a circle.
//
// Everything speaks local midnight. A 'YYYY-MM-DD' parsed as UTC lands on the
// previous day for anyone west of Greenwich, which silently shifts every window
// boundary in the app by one.

export const DAYS_PER_MONTH = 30.4375 // average Gregorian month
export const DAYS_PER_WEEK = 7

const DAY_MS = 86400000

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

export function addMonths(date, n) {
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

// Recurring/one-off due dates strictly after asOf, up to and including windowEnd.
// Including the end date is the conservative reading: rent landing on payday is still
// rent that this period's money has to cover.
export function occurrencesInWindow(baseDate, freq, asOf, windowEnd) {
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

