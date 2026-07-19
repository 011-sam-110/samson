// Leeway analytics engine - pure functions over the transaction ledger.
// No React, no storage. Reuses the date helpers + category typing so the
// numbers stay consistent with the dashboard's run-rate (non-fixed spend).

import { toDate, daysBetween, addDays } from './finance.js'
import { typeOf, categoryLabel } from '../lib/categories.js'

const WEEKEND = new Set([0, 6]) // Sun = 0, Sat = 6

const amt = (t) => Number(t.amount) || 0
const isExpense = (t) => t.type === 'expense'
const isNonFixed = (t) => isExpense(t) && typeOf(t.category) !== 'fixed'

function inRange(dateStr, from, to) {
  const d = toDate(dateStr)
  return d >= toDate(from) && d <= toDate(to)
}

function isoOf(d) {
  const x = toDate(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const da = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

// ── period windows ─────────────────────────────────────────────────────────
export function periodRange(key, asOf = new Date()) {
  const a = toDate(asOf)
  if (key === 'last30') return { from: addDays(a, -29), to: a }
  // default: the calendar month containing asOf
  const from = new Date(a.getFullYear(), a.getMonth(), 1)
  const to = new Date(a.getFullYear(), a.getMonth() + 1, 0)
  return { from, to }
}

// ── totals & category breakdown ─────────────────────────────────────────────
export function totalSpend(transactions, from, to) {
  return (transactions || [])
    .filter(isExpense)
    .filter((t) => inRange(t.date, from, to))
    .reduce((s, t) => s + amt(t), 0)
}

export function spendByCategory(transactions, from, to) {
  const expenses = (transactions || []).filter(isExpense).filter((t) => inRange(t.date, from, to))
  const total = expenses.reduce((s, t) => s + amt(t), 0)
  const byKey = new Map()
  for (const t of expenses) {
    const cur = byKey.get(t.category) || {
      key: t.category,
      label: categoryLabel(t.category),
      type: typeOf(t.category),
      total: 0,
      count: 0,
    }
    cur.total += amt(t)
    cur.count += 1
    byKey.set(t.category, cur)
  }
  return [...byKey.values()]
    .map((c) => ({ ...c, pct: total > 0 ? c.total / total : 0 }))
    .sort((a, b) => b.total - a.total)
}

// ── weekend effect ──────────────────────────────────────────────────────────
// Divide only by the days actually lived through. The default period is the
// calendar month, whose `to` is the 31st - a date that is still in the future
// for all but one day of the month. Counting those unlived days as denominator
// crushed the £/day rates: on the 3rd, a real £10/weekday and £40/weekend day
// were reported as £0.87 and £5.00, because the spend was spread across 23
// weekdays and 8 weekend days the student had not reached yet.
export function weekendSplit(transactions, from, to, asOf = new Date()) {
  // Both the spend and the day-count are measured over the SAME lived span, so
  // the rate stays a rate. Clamping only the denominator would be worse than the
  // bug: it would divide a whole month's spend by the days lived so far.
  const end = toDate(to) < toDate(asOf) ? toDate(to) : toDate(asOf)

  let weekdayTotal = 0
  let weekendTotal = 0
  for (const t of (transactions || []).filter(isNonFixed)) {
    if (!inRange(t.date, from, end)) continue
    if (WEEKEND.has(toDate(t.date).getDay())) weekendTotal += amt(t)
    else weekdayTotal += amt(t)
  }
  let weekdayCount = 0
  let weekendCount = 0
  const span = daysBetween(from, end) // inclusive day count = span + 1; < 0 if the period hasn't started
  for (let i = 0; i <= span; i++) {
    if (WEEKEND.has(addDays(from, i).getDay())) weekendCount++
    else weekdayCount++
  }
  return {
    weekdayTotal,
    weekendTotal,
    weekdayCount,
    weekendCount,
    weekdayPerDay: weekdayCount > 0 ? weekdayTotal / weekdayCount : 0,
    weekendPerDay: weekendCount > 0 ? weekendTotal / weekendCount : 0,
  }
}

// ── time series (for the Insights charts) ───────────────────────────────────
// Per-day expense total across [from, to] inclusive. Every day is present (0 when
// nothing was spent) so a line/area chart draws a continuous, honest baseline.
export function dailySpendSeries(transactions, from, to) {
  const start = toDate(from)
  const span = daysBetween(from, to) // inclusive day count = span + 1; < 0 → empty
  const totals = new Map()
  for (const t of (transactions || []).filter(isExpense)) {
    if (!inRange(t.date, from, to)) continue
    const k = isoOf(t.date)
    totals.set(k, (totals.get(k) || 0) + amt(t))
  }
  const out = []
  for (let i = 0; i <= span; i++) {
    const k = isoOf(addDays(start, i))
    out.push({ date: k, total: totals.get(k) || 0 })
  }
  return out
}

// Trailing weekly non-fixed spend, oldest → newest. The last bucket ends on asOf
// and covers the seven days up to and including it; matches weeklyTrend's window.
export function weeklySeries(transactions, asOf = new Date(), weeks = 6) {
  const a = toDate(asOf)
  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(a, -7 * i)
    const start = addDays(end, -6)
    out.push({ start: isoOf(start), end: isoOf(end), total: nonFixedBetween(transactions, start, end) })
  }
  return out
}

// ── trend & movers (non-fixed spend, rolling weeks off asOf) ────────────────
function nonFixedBetween(transactions, from, to) {
  return (transactions || [])
    .filter(isNonFixed)
    .filter((t) => inRange(t.date, from, to))
    .reduce((s, t) => s + amt(t), 0)
}

function catTotals(transactions, from, to) {
  const m = new Map()
  for (const t of (transactions || []).filter(isNonFixed)) {
    if (!inRange(t.date, from, to)) continue
    m.set(t.category, (m.get(t.category) || 0) + amt(t))
  }
  return m
}

export function weeklyTrend(transactions, asOf = new Date()) {
  const a = toDate(asOf)
  const thisWeek = nonFixedBetween(transactions, addDays(a, -6), a)
  const lastWeek = nonFixedBetween(transactions, addDays(a, -13), addDays(a, -7))
  const fourWeekAvg = nonFixedBetween(transactions, addDays(a, -27), a) / 4
  const vsAvgPct = fourWeekAvg > 0 ? (thisWeek - fourWeekAvg) / fourWeekAvg : null
  return { thisWeek, lastWeek, fourWeekAvg, vsAvgPct }
}

export function biggestMover(transactions, asOf = new Date()) {
  const a = toDate(asOf)
  const thisWk = catTotals(transactions, addDays(a, -6), a)
  const prevWk = catTotals(transactions, addDays(a, -13), addDays(a, -7))
  let best = null
  for (const [key, total] of thisWk) {
    const prev = prevWk.get(key) || 0
    const delta = total - prev
    if (delta > 0 && (!best || delta > best.delta)) {
      best = { key, label: categoryLabel(key), thisWeek: total, prevWeek: prev, delta }
    }
  }
  return best
}

// ── leaks: frequent non-fixed categories ("small stuff adds up") ────────────
export function recurringSpends(transactions, from, to, { minCount = 3 } = {}) {
  const m = new Map()
  for (const t of (transactions || []).filter(isNonFixed)) {
    if (!inRange(t.date, from, to)) continue
    const cur = m.get(t.category) || {
      key: t.category,
      label: categoryLabel(t.category),
      type: typeOf(t.category),
      count: 0,
      total: 0,
    }
    cur.count += 1
    cur.total += amt(t)
    m.set(t.category, cur)
  }
  return [...m.values()]
    .filter((c) => c.count >= minCount)
    .map((c) => ({ ...c, avgEach: c.total / c.count }))
    .sort((a, b) => b.total - a.total)
}

// ── projection & goal framing ───────────────────────────────────────────────
export function projectedMonthEnd(transactions, asOf = new Date()) {
  const a = toDate(asOf)
  const from = new Date(a.getFullYear(), a.getMonth(), 1)
  const daysInMonth = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate()
  const daysElapsed = a.getDate()
  const soFar = nonFixedBetween(transactions, from, a)
  const projected = daysElapsed > 0 ? (soFar / daysElapsed) * daysInMonth : 0
  return { soFar, projected, daysElapsed, daysInMonth }
}

export function costToGoal(spend, goalWeeklyRequired) {
  const w = Number(goalWeeklyRequired) || 0
  if (w <= 0) return 0
  return (Number(spend) || 0) / w
}
