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
export function weekendSplit(transactions, from, to) {
  let weekdayTotal = 0
  let weekendTotal = 0
  for (const t of (transactions || []).filter(isNonFixed)) {
    if (!inRange(t.date, from, to)) continue
    if (WEEKEND.has(toDate(t.date).getDay())) weekendTotal += amt(t)
    else weekdayTotal += amt(t)
  }
  let weekdayCount = 0
  let weekendCount = 0
  const span = daysBetween(from, to) // inclusive day count = span + 1
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
