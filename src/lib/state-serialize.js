// src/lib/state-serialize.js
// Pure mapping between the client `state` object and normalized Postgres rows.
// Isolated here (not in api/state.js) so it is unit-tested with zero DB/network,
// and so ALL numeric/date coercion lives in exactly one place.
import { CURRENT_VERSION } from '../store/migrate.js'

const MAX_ROWS = 5000

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

// Postgres DATE comes back as a JS Date (or already a string); the whole app
// speaks 'YYYY-MM-DD'. Normalize either form to that, null-safe.
const ymd = (v) => {
  if (v == null) return null
  if (v instanceof Date) {
    const y = v.getUTCFullYear()
    const m = String(v.getUTCMonth() + 1).padStart(2, '0')
    const d = String(v.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).slice(0, 10)
}

export function stateToRows(state, userId) {
  const withUser = (arr, map) => (arr || []).map((x) => ({ user_id: userId, ...map(x) }))
  return {
    profile: {
      user_id: userId,
      balance: num(state.balance),
      last_reconciled: state.lastReconciled ?? null,
      survive_until: state.surviveUntil ?? null,
      schema_version: state.version ?? CURRENT_VERSION,
    },
    transactions: withUser(state.transactions, (t) => ({
      id: t.id, type: t.type, label: t.label, amount: num(t.amount), category: t.category, date: t.date,
    })),
    bills: withUser(state.bills, (b) => ({
      id: b.id, label: b.label, amount: num(b.amount), freq: b.freq, next_due: b.nextDue,
    })),
    income_sources: withUser(state.incomeSources, (i) => ({
      id: i.id, label: i.label, kind: i.kind, amount: num(i.amount), next_date: i.nextDate,
    })),
    goals: withUser(state.goals, (g) => ({
      id: g.id, label: g.label, target: num(g.target), saved: num(g.saved), deadline: g.deadline,
    })),
    events: withUser(state.events, (e) => ({
      id: e.id, label: e.label, amount: num(e.amount), date: e.date,
    })),
    term_spans: withUser(state.termSpans, (s) => ({
      id: s.id, kind: s.kind, label: s.label, start: s.start, end: s.end,
    })),
  }
}

export function rowsToState(rows) {
  const p = rows.profile || {}
  return {
    version: p.schema_version ?? CURRENT_VERSION,
    balance: num(p.balance),
    lastReconciled: ymd(p.last_reconciled),
    surviveUntil: ymd(p.survive_until),
    incomeSources: (rows.income_sources || []).map((i) => ({
      id: i.id, label: i.label, kind: i.kind, amount: num(i.amount), nextDate: ymd(i.next_date),
    })),
    bills: (rows.bills || []).map((b) => ({
      id: b.id, label: b.label, amount: num(b.amount), freq: b.freq, nextDue: ymd(b.next_due),
    })),
    goals: (rows.goals || []).map((g) => ({
      id: g.id, label: g.label, target: num(g.target), saved: num(g.saved), deadline: ymd(g.deadline),
    })),
    events: (rows.events || []).map((e) => ({
      id: e.id, label: e.label, amount: num(e.amount), date: ymd(e.date),
    })),
    termSpans: (rows.term_spans || []).map((s) => ({
      id: s.id, kind: s.kind, label: s.label, start: ymd(s.start), end: ymd(s.end),
    })),
    transactions: (rows.transactions || []).map((t) => ({
      id: t.id, type: t.type, label: t.label, amount: num(t.amount), category: t.category, date: ymd(t.date),
    })),
  }
}

// Server-side guard for an untrusted PUT body — mirrors src/lib/backup.js:parseBackup
// (finite balance, required arrays) plus row caps for the network boundary.
export function validateState(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Invalid state: not an object')
  if (typeof obj.balance !== 'number' || !Number.isFinite(obj.balance)) throw new Error('Invalid state: balance')
  for (const k of ['incomeSources', 'bills', 'goals', 'events', 'transactions']) {
    if (!Array.isArray(obj[k])) throw new Error(`Invalid state: ${k} must be an array`)
    if (obj[k].length > MAX_ROWS) throw new Error(`Invalid state: ${k} exceeds ${MAX_ROWS} rows`)
  }
  if ('termSpans' in obj) {
    if (!Array.isArray(obj.termSpans)) throw new Error('Invalid state: termSpans must be an array')
    if (obj.termSpans.length > MAX_ROWS) throw new Error(`Invalid state: termSpans exceeds ${MAX_ROWS} rows`)
  }
  return obj
}
