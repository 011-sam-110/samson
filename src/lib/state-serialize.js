// src/lib/state-serialize.js
// Pure mapping between the client `state` object and normalized Postgres rows.
// Isolated here (not in api/state.js) so it is unit-tested with zero DB/network,
// and so ALL numeric/date coercion lives in exactly one place.
import { CURRENT_VERSION } from '../store/migrate.js'

const MAX_ROWS = 5000
const MAX_STR = 500
// Bounded (month 01-12, day 01-31) not just digit-shaped: '2026-13-45' must fail here
// rather than reach the DB, where a ::date cast on an invalid month/day would 500.
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
// The shape check alone still lets '2026-02-30' and '2027-02-29' through, and those
// 500 on the ::date cast rather than 400ing here. Round-tripping through Date and
// comparing back is the cheapest way to demand a day that actually exists.
const isRealDate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
const okDate = (v) => v == null || (typeof v === 'string' && YMD.test(v) && isRealDate(v))

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

// Postgres DATE comes back as a JS Date (or already a string); the whole app
// speaks 'YYYY-MM-DD'. Normalize either form to that, null-safe.
const ymd = (v) => {
  if (v == null) return null
  if (v instanceof Date) {
    // node-postgres parses a DATE column to a JS Date at LOCAL midnight, so read it back
    // with local getters — correct on Vercel's UTC runtime AND on a non-UTC dev box.
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
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
    // The `saved` COLUMN now carries the opening balance — money put aside before
    // Pocko. Dated money lives in goal_contributions. The column keeps its old name
    // so no DDL runs against the live table; this mapping is the only place that
    // has to know, which is why it is spelled out here rather than inferred.
    goals: withUser(state.goals, (g) => ({
      id: g.id, label: g.label, target: num(g.target), saved: num(g.openingBalance), deadline: g.deadline,
    })),
    goal_contributions: withUser(state.contributions, (c) => ({
      id: c.id, goal_id: c.goalId, amount: num(c.amount), date: c.date,
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
      id: g.id, label: g.label, target: num(g.target), openingBalance: num(g.saved), deadline: ymd(g.deadline),
    })),
    contributions: (rows.goal_contributions || []).map((c) => ({
      id: c.id, goalId: c.goal_id, amount: num(c.amount), date: ymd(c.date),
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

// Per-collection date fields (client shape). Values reach a Postgres ::date cast, so a
// malformed one must 400 here, not 500 at the DB.
const DATE_FIELDS = {
  incomeSources: ['nextDate'], bills: ['nextDue'], goals: ['deadline'],
  events: ['date'], termSpans: ['start', 'end'], transactions: ['date'],
  contributions: ['date'],
}

// Server-side guard for an untrusted PUT body — mirrors src/lib/backup.js:parseBackup
// (finite balance, required arrays) plus row caps, date-format, and string-length checks
// for the network boundary.
export function validateState(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Invalid state: not an object')
  if (typeof obj.balance !== 'number' || !Number.isFinite(obj.balance)) throw new Error('Invalid state: balance')
  if (!okDate(obj.lastReconciled)) throw new Error('Invalid state: lastReconciled must be YYYY-MM-DD')
  if (!okDate(obj.surviveUntil)) throw new Error('Invalid state: surviveUntil must be YYYY-MM-DD')
  for (const k of ['incomeSources', 'bills', 'goals', 'events', 'transactions']) {
    if (!Array.isArray(obj[k])) throw new Error(`Invalid state: ${k} must be an array`)
    if (obj[k].length > MAX_ROWS) throw new Error(`Invalid state: ${k} exceeds ${MAX_ROWS} rows`)
  }
  // Optional collections: a pre-v4 client PUTs a body with no contributions key at
  // all, and that must still save rather than 400 the user out of cloud sync.
  for (const k of ['termSpans', 'contributions']) {
    if (!(k in obj)) continue
    if (!Array.isArray(obj[k])) throw new Error(`Invalid state: ${k} must be an array`)
    if (obj[k].length > MAX_ROWS) throw new Error(`Invalid state: ${k} exceeds ${MAX_ROWS} rows`)
  }
  for (const [k, dateFields] of Object.entries(DATE_FIELDS)) {
    for (const row of obj[k] || []) {
      if (typeof row?.label === 'string' && row.label.length > MAX_STR) throw new Error(`Invalid state: ${k} label too long`)
      for (const f of dateFields) if (!okDate(row[f])) throw new Error(`Invalid state: ${k}.${f} must be YYYY-MM-DD`)
    }
  }
  return obj
}
