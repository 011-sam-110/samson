// Deterministic recurring-spend detection: find merchants that repeat at a regular
// weekly/monthly cadence - candidates to add as recurring bills/subscriptions.
// No AI. This is the "knows what you spend on consistently" half of statement import.

import { toDate, daysBetween } from './finance.js'

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function cadenceFor(medGap) {
  if (medGap >= 5 && medGap <= 9) return 'weekly'
  if (medGap >= 26 && medGap <= 35) return 'monthly'
  return null
}

export function detectRecurring(transactions, { minCount = 3 } = {}) {
  const groups = new Map()
  for (const t of transactions || []) {
    if (t.type !== 'expense') continue
    const key = String(t.label || '').trim().toLowerCase()
    if (!key) continue
    const g = groups.get(key) || { label: t.label, category: t.category, dates: [], amounts: [] }
    g.dates.push(t.date)
    g.amounts.push(Number(t.amount) || 0)
    groups.set(key, g)
  }

  const out = []
  for (const g of groups.values()) {
    if (g.dates.length < minCount) continue
    const sorted = g.dates.map(toDate).sort((a, b) => a - b)
    const gaps = []
    for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1], sorted[i]))
    const cadence = cadenceFor(median(gaps))
    if (!cadence) continue
    const avgAmount = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length
    out.push({ label: g.label, category: g.category, count: g.dates.length, avgAmount, cadence })
  }
  return out.sort((a, b) => b.count - a.count)
}
