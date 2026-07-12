// Money + date formatting for a UK student audience.

const GBP = (dp) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })

// £1,234.50 - the ledger default.
export function gbp(n, dp = 2) {
  return GBP(dp).format(Number(n) || 0)
}

// £24 - clean whole-pound figure for the hero readout.
export function gbpWhole(n) {
  return GBP(0).format(Math.round(Number(n) || 0))
}

// £12.40/day style.
export function perDay(n) {
  return `${gbp(n)}/day`
}

export function pct(n) {
  return `${Math.round((Number(n) || 0) * 100)}%`
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const DATE_FMT_FULL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function asDate(x) {
  if (x instanceof Date) return x
  const [y, m, d] = String(x).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shortDate(x) {
  return DATE_FMT.format(asDate(x))
}

export function fullDate(x) {
  return DATE_FMT_FULL.format(asDate(x))
}

// "in 12 days", "tomorrow", "today", "3 days ago"
export function relativeDays(n) {
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n > 1) return `in ${n} days`
  return `${-n} days ago`
}
