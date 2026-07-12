# Leeway M5 — Spending Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. The design contract is the spec (`docs/superpowers/specs/2026-07-12-leeway-m5-calendar-design.md`); the test file is the executable spec. Steps use `- [ ]` tracking.

**Goal:** Turn the "Planned" tab into a month calendar — a single-hue spend heatmap with bill/event markers and user-set term spans (Freshers/exams/term) that drive deterministic plan-ahead nudges — all offline.

**Architecture:** A new pure module `src/engine/calendar.js` computes every number (daily spend, heat levels, bill projection, the month grid, term overlays, the nudge). State gains a `termSpans[]` collection (v3 migration). `src/components/Events.jsx` is rewritten to render the calendar, reusing existing `ui.jsx`/`forms.jsx` primitives; the `events` view key and "Planned" nav label are unchanged so `App.jsx`/`Nav.jsx` need no edits.

**Tech Stack:** React 18 (JSX), Vite, Vitest (`node`). No new dependencies.

## Global Constraints

- Plain JS/JSX; test files under `src/**/*.test.{js,jsx}`; run with `npx vitest run <file>` and `npm test`.
- Reuse date helpers exported from `src/engine/finance.js` (`toDate`, `daysBetween`, `addDays`, `addMonths`, `nextOccurrenceOnOrAfter`) and `typeOf` from `src/lib/categories.js`. **Do not duplicate them.**
- "Discretionary spend" = a transaction with `type === 'expense'` and `typeOf(category) !== 'fixed'`.
- Every function guards empty data / divide-by-zero — return `0`, `[]`, or `null`, never `NaN`/`Infinity`.
- Dates are inclusive `YYYY-MM-DD` strings, parsed via `toDate` (local midnight, no UTC off-by-one). The week starts **Monday** (UK).
- Heatmap colour is a **single hue** (`--violet`), 4 steps light→dark. Never reuse the status colours `--go`/`--tight`/`--over` for magnitude. Term tints use non-status accents on edges/bands only.
- State schema is v3: `CURRENT_VERSION = 3`. All 92 existing tests stay green. One commit per task, ending with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: State v3 — migration, seed, store actions

**Files:**
- Modify: `src/store/migrate.js` (bump version, add `toV3`)
- Test: `src/store/migrate.test.js`
- Modify: `src/store/seed.js` (seed `termSpans`)
- Modify: `src/store/store.js` (add `addTermSpan`, `removeTermSpan`; include `termSpans` in `clearAll`)

**Interfaces:**
- Produces: state key `termSpans: Array<{ id, kind: 'freshers'|'exams'|'term', label, start, end }>`; `CURRENT_VERSION === 3`; store actions `addTermSpan({ kind, label, start, end })`, `removeTermSpan(id)`.

- [ ] **Step 1: Write the failing migration test.** Add to `src/store/migrate.test.js`:

```js
it('v2 → v3 adds an empty termSpans array', () => {
  const v2 = { version: 2, balance: 0, transactions: [], bills: [], goals: [], events: [], incomeSources: [] }
  const out = migrate(v2)
  expect(out.version).toBe(3)
  expect(out.termSpans).toEqual([])
})

it('keeps an existing termSpans array through migration', () => {
  const span = { id: 'a', kind: 'freshers', label: 'Freshers', start: '2026-09-21', end: '2026-09-27' }
  const out = migrate({ version: 3, termSpans: [span], transactions: [] })
  expect(out.termSpans).toEqual([span])
})
```

- [ ] **Step 2: Run it — fails** (`out.version` is 2, `termSpans` undefined). Run: `npx vitest run src/store/migrate.test.js`.
- [ ] **Step 3: Implement `toV3`.** In `src/store/migrate.js` set `export const CURRENT_VERSION = 3`, and:

```js
export function migrate(state) {
  if (!state || typeof state !== 'object') return state
  let s = state
  if ((s.version ?? 1) < 2) s = toV2(s)
  if ((s.version ?? 1) < 3) s = toV3(s)
  return s
}

// v3 introduces the term calendar. Old data simply gains an empty term list.
function toV3(s) {
  return { ...s, version: 3, termSpans: Array.isArray(s.termSpans) ? s.termSpans : [] }
}
```

- [ ] **Step 4: Run it — passes.** `npx vitest run src/store/migrate.test.js`.
- [ ] **Step 5: Seed demo term spans.** In `src/store/seed.js`, set `version: 3` and add (illustrative dates so the nudge + tints are alive on first open):

```js
    termSpans: [
      { id: uid(), kind: 'freshers', label: 'Freshers', start: iso(4), end: iso(10) },
      { id: uid(), kind: 'exams', label: 'Semester exams', start: iso(45), end: iso(56) },
    ],
```

- [ ] **Step 6: Add store actions.** In `src/store/store.js`, alongside `addEvent`/`removeEvent`:

```js
      addTermSpan: ({ kind, label, start, end }) =>
        push('termSpans', { kind, label: label.trim(), start, end }),
      removeTermSpan: (id) => remove('termSpans', id),
```

and add `termSpans: []` to the object literal in `clearAll` (and bump its `version` to 3).

- [ ] **Step 7: Full suite green.** `npm test`.
- [ ] **Step 8: Commit.** `git add -A && git commit` → `feat: state v3 with termSpans (migration, seed, store actions)`.

---

### Task 2: Backup round-trips termSpans

**Files:**
- Modify: `src/lib/backup.js` (validate `termSpans` when present)
- Test: `src/lib/backup.test.js`

**Interfaces:**
- Consumes: `serializeState`, `parseBackup` (unchanged signatures).
- Produces: `parseBackup` accepts a missing `termSpans`, rejects a present non-array `termSpans`.

- [ ] **Step 1: Write failing tests.** Add to `src/lib/backup.test.js` a minimal valid backup helper and:

```js
const base = () => ({
  balance: 0, incomeSources: [], bills: [], goals: [], events: [], transactions: [],
})

it('round-trips termSpans through serialize → parse', () => {
  const span = { id: 'a', kind: 'exams', label: 'Exams', start: '2026-01-12', end: '2026-01-23' }
  const out = parseBackup(serializeState({ ...base(), termSpans: [span] }))
  expect(out.termSpans).toEqual([span])
})

it('accepts a backup with no termSpans key (older export)', () => {
  expect(() => parseBackup(serializeState(base()))).not.toThrow()
})

it('rejects a backup whose termSpans is present but not an array', () => {
  expect(() => parseBackup(JSON.stringify({ ...base(), termSpans: {} }))).toThrow()
})
```

- [ ] **Step 2: Run — fails** (the non-array case does not throw yet). Run: `npx vitest run src/lib/backup.test.js`.
- [ ] **Step 3: Implement the optional-array guard.** In `src/lib/backup.js`, after the `ARRAY_KEYS` loop in `parseBackup`:

```js
const OPTIONAL_ARRAY_KEYS = ['termSpans']
// ...inside parseBackup, after the required-keys loop:
  for (const k of OPTIONAL_ARRAY_KEYS) {
    if (k in obj && !Array.isArray(obj[k])) throw new Error(NOT_A_BACKUP)
  }
```

(Do **not** add `termSpans` to `ARRAY_KEYS` — older backups lack it and must still import; migration fills it.)

- [ ] **Step 4: Run — passes.** `npx vitest run src/lib/backup.test.js`, then `npm test` green.
- [ ] **Step 5: Commit.** `feat: validate termSpans on backup import (optional array)`.

---

### Task 3: Calendar engine — isoDate, daySpend, heatLevel

**Files:**
- Create: `src/engine/calendar.js`, `src/engine/calendar.test.js`

**Interfaces:**
- Consumes: `toDate`, `addDays` from `finance.js`; `typeOf` from `categories.js`.
- Produces:
  - `isoDate(date: Date): string` — local `YYYY-MM-DD`.
  - `daySpend(transactions, dayISO): number` — sum of discretionary expenses on that day.
  - `heatLevel(spend: number, scaleMax: number): 0|1|2|3|4`.

- [ ] **Step 1: Write the failing tests.** `src/engine/calendar.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { isoDate, daySpend, heatLevel } from './calendar.js'

const tx = (over) => ({ type: 'expense', category: 'going_out', amount: 10, date: '2026-01-10', ...over })

describe('isoDate', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('daySpend', () => {
  it('sums discretionary expenses on the given day only', () => {
    const txns = [tx({ amount: 6 }), tx({ amount: 4 }), tx({ amount: 99, date: '2026-01-11' })]
    expect(daySpend(txns, '2026-01-10')).toBe(10)
  })
  it('excludes fixed-category expenses (rent/bills)', () => {
    const txns = [tx({ amount: 6 }), tx({ amount: 480, category: 'rent' })]
    expect(daySpend(txns, '2026-01-10')).toBe(6)
  })
  it('excludes income and returns 0 for an empty/absent day', () => {
    expect(daySpend([tx({ type: 'income', category: 'other', amount: 50 })], '2026-01-10')).toBe(0)
    expect(daySpend([], '2026-01-10')).toBe(0)
  })
})

describe('heatLevel', () => {
  it('is 0 for no spend', () => expect(heatLevel(0, 40)).toBe(0))
  it('is 4 at the scale max', () => expect(heatLevel(40, 40)).toBe(4))
  it('buckets a mid value', () => expect(heatLevel(10, 40)).toBe(1))
  it('never divides by zero when scaleMax is 0', () => expect(heatLevel(0, 0)).toBe(0))
})
```

> Note: `'rent'` must be a category whose `typeOf` is `'fixed'`. Confirm against `src/lib/categories.js`; if the fixed category key differs, use that key in the test and keep the assertion.

- [ ] **Step 2: Run — fails** (module missing). `npx vitest run src/engine/calendar.test.js`.
- [ ] **Step 3: Implement.** `src/engine/calendar.js` (header comment mirroring `analytics.js`):

```js
// Leeway spending-calendar engine — pure functions over the ledger + term spans.
// No React, no storage. Reuses finance.js date helpers so day maths stays consistent.
import { toDate, addDays, addMonths, nextOccurrenceOnOrAfter, daysBetween } from './finance.js'
import { typeOf } from '../lib/categories.js'

const amt = (t) => Number(t.amount) || 0
const isDiscretionary = (t) => t.type === 'expense' && typeOf(t.category) !== 'fixed'

export function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daySpend(transactions, dayISO) {
  return (transactions || [])
    .filter(isDiscretionary)
    .filter((t) => t.date === dayISO)
    .reduce((s, t) => s + amt(t), 0)
}

export function heatLevel(spend, scaleMax) {
  if (!(spend > 0) || !(scaleMax > 0)) return 0
  return Math.min(4, Math.ceil((spend / scaleMax) * 4))
}
```

- [ ] **Step 4: Run — passes**, then `npm test` green.
- [ ] **Step 5: Commit.** `feat: calendar engine — isoDate, daySpend, heatLevel`.

---

### Task 4: Calendar engine — billOccurrences + monthMatrix

**Files:**
- Modify: `src/engine/finance.js` (export the existing `addMonths` — add the `export` keyword only, no logic change)
- Modify: `src/engine/calendar.js`, `src/engine/calendar.test.js`

**Interfaces:**
- Produces:
  - `billOccurrences(bill, fromISO, toISO): string[]` — inclusive ISO dates the bill lands on in the window (handles `monthly`/`weekly`/`oneoff`).
  - `monthMatrix(anchor): Array<Array<{ date: string, inMonth: boolean }>>` — 6 weeks × 7 days, Monday-start.

- [ ] **Step 1: Export `addMonths`.** In `src/engine/finance.js` change `function addMonths(` to `export function addMonths(`. Run `npm test` — still green (pure addition).

- [ ] **Step 2: Write the failing tests.** Add to `calendar.test.js`:

```js
import { billOccurrences, monthMatrix } from './calendar.js'

describe('billOccurrences', () => {
  const monthly = { label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-02-18' }
  it('projects a monthly bill across a month boundary', () => {
    expect(billOccurrences(monthly, '2026-01-01', '2026-03-31'))
      .toEqual(['2026-01-18', '2026-02-18', '2026-03-18'])
  })
  it('places a monthly bill whose nextDue is after the window but recurs into it', () => {
    expect(billOccurrences(monthly, '2026-01-01', '2026-01-31')).toEqual(['2026-01-18'])
  })
  it('lands a weekly bill on the right days', () => {
    const weekly = { freq: 'weekly', nextDue: '2026-01-05' }
    expect(billOccurrences(weekly, '2026-01-01', '2026-01-20'))
      .toEqual(['2026-01-05', '2026-01-12', '2026-01-19'])
  })
  it('returns a one-off only if it falls in the window', () => {
    const one = { freq: 'oneoff', nextDue: '2026-01-10' }
    expect(billOccurrences(one, '2026-01-01', '2026-01-31')).toEqual(['2026-01-10'])
    expect(billOccurrences(one, '2026-02-01', '2026-02-28')).toEqual([])
  })
})

describe('monthMatrix', () => {
  it('is 6 rows of 7, Monday-first, with correct inMonth flags', () => {
    const weeks = monthMatrix('2026-01-15') // Jan 2026: 1st = Thursday
    expect(weeks.length).toBe(6)
    expect(weeks[0].length).toBe(7)
    expect(weeks[0][0].date).toBe('2025-12-29') // Monday before Jan 1
    expect(weeks[0][0].inMonth).toBe(false)
    expect(weeks[0][3]).toEqual({ date: '2026-01-01', inMonth: true })
  })
})
```

- [ ] **Step 3: Run — fails** (functions missing).
- [ ] **Step 4: Implement.** Append to `src/engine/calendar.js`:

```js
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
  // Walk back to at/just-before the window, then forward collecting hits.
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
```

- [ ] **Step 5: Run — passes**, then `npm test` green.
- [ ] **Step 6: Commit.** `feat: calendar engine — bill projection + Monday-start month grid`.

---

### Task 5: Calendar engine — termSpansOn, termNudge, buildMonth

**Files:**
- Modify: `src/engine/calendar.js`, `src/engine/calendar.test.js`

**Interfaces:**
- Produces:
  - `termSpansOn(termSpans, dayISO): Array<{ kind, label, start, end, id? }>` — spans covering the day (inclusive edges).
  - `termNudge(state, asOf): { kind, label, phase: 'active'|'upcoming', daysUntil, message } | null`.
  - `buildMonth(state, anchor, asOf): { monthLabel, weeks }` where each cell is `{ date, inMonth, isToday, isFuture, spend, heatLevel, bills:[{label,amount}], events:[{label,amount}], terms:[{kind,label}] }`.

- [ ] **Step 1: Write the failing tests.** Add to `calendar.test.js`:

```js
import { termSpansOn, termNudge, buildMonth } from './calendar.js'

const fresh = { id: 'f', kind: 'freshers', label: 'Freshers', start: '2026-01-10', end: '2026-01-16' }
const exams = { id: 'e', kind: 'exams', label: 'Exams', start: '2026-01-20', end: '2026-01-30' }

describe('termSpansOn', () => {
  it('includes a span on its inclusive edges', () => {
    expect(termSpansOn([fresh], '2026-01-10')).toHaveLength(1)
    expect(termSpansOn([fresh], '2026-01-16')).toHaveLength(1)
  })
  it('excludes a day outside every span', () => {
    expect(termSpansOn([fresh], '2026-01-17')).toEqual([])
  })
})

describe('termNudge', () => {
  it('fires a cap message when Freshers is active', () => {
    const n = termNudge({ termSpans: [fresh] }, '2026-01-12')
    expect(n.kind).toBe('freshers'); expect(n.phase).toBe('active')
    expect(n.message).toMatch(/cap/i)
  })
  it('fires a quiet-mode message for exams starting within 14 days', () => {
    const n = termNudge({ termSpans: [exams] }, '2026-01-14') // 6 days out
    expect(n.kind).toBe('exams'); expect(n.phase).toBe('upcoming')
    expect(n.message).toMatch(/bank the difference/i)
  })
  it('prefers an active span over an upcoming one', () => {
    const n = termNudge({ termSpans: [fresh, exams] }, '2026-01-12')
    expect(n.kind).toBe('freshers')
  })
  it('returns null when nothing is active or within 14 days', () => {
    expect(termNudge({ termSpans: [exams] }, '2026-01-01')).toBe(null) // 19 days out
    expect(termNudge({ termSpans: [] }, '2026-01-12')).toBe(null)
  })
})

describe('buildMonth', () => {
  const state = {
    transactions: [{ type: 'expense', category: 'going_out', amount: 20, date: '2026-01-12' }],
    bills: [{ label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-01-18' }],
    events: [{ label: 'Gig', amount: 30, date: '2026-01-24' }],
    termSpans: [fresh],
  }
  const { weeks } = buildMonth(state, '2026-01-15', '2026-01-15')
  const cellFor = (iso) => weeks.flat().find((c) => c.date === iso)
  it('marks discretionary spend and its heat level', () => {
    expect(cellFor('2026-01-12').spend).toBe(20)
    expect(cellFor('2026-01-12').heatLevel).toBe(4) // it is the month max
  })
  it('attaches bills, events and term spans to the right days', () => {
    expect(cellFor('2026-01-18').bills[0].label).toBe('Rent')
    expect(cellFor('2026-01-24').events[0].label).toBe('Gig')
    expect(cellFor('2026-01-12').terms[0].kind).toBe('freshers')
  })
  it('flags today and future cells', () => {
    expect(cellFor('2026-01-15').isToday).toBe(true)
    expect(cellFor('2026-01-24').isFuture).toBe(true)
  })
})
```

- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Implement.** Append to `src/engine/calendar.js`:

```js
export function termSpansOn(termSpans, dayISO) {
  const d = toDate(dayISO)
  return (termSpans || []).filter((s) => d >= toDate(s.start) && d <= toDate(s.end))
}

const SPECIAL = new Set(['freshers', 'exams'])

export function termNudge(state, asOf = new Date()) {
  const spans = (state && state.termSpans) || []
  const today = toDate(asOf)
  let active = null
  let upcoming = null
  for (const s of spans) {
    if (!SPECIAL.has(s.kind)) continue
    const start = toDate(s.start)
    const end = toDate(s.end)
    if (today >= start && today <= end) {
      if (!active) active = s
    } else if (start > today) {
      const days = daysBetween(today, start)
      if (days <= 14 && (!upcoming || days < daysBetween(today, upcoming.start))) upcoming = s
    }
  }
  const pick = active || upcoming
  if (!pick) return null
  const phase = active ? 'active' : 'upcoming'
  const daysUntil = phase === 'active' ? 0 : daysBetween(today, pick.start)
  return { kind: pick.kind, label: pick.label, phase, daysUntil, message: messageFor(pick, phase, daysUntil) }
}

function whenPhrase(daysUntil) {
  if (daysUntil <= 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}

function messageFor(span, phase, daysUntil) {
  if (span.kind === 'freshers') {
    return phase === 'active'
      ? "Freshers is on — the priciest week of term. Set a cap for the big nights so the rest of the month survives."
      : `Freshers starts ${whenPhrase(daysUntil)} — set a cap for the big nights so the rest of the month survives.`
  }
  // exams
  return phase === 'active'
    ? "Exams are on — a quiet, cheap stretch. Spend under your usual pace and bank the difference."
    : `Exams start ${whenPhrase(daysUntil)} — a quiet, cheap stretch ahead. Plan to bank the difference.`
}

export function buildMonth(state, anchor, asOf = new Date()) {
  const weeks = monthMatrix(anchor)
  const flat = weeks.flat()
  const gridStart = flat[0].date
  const gridEnd = flat[flat.length - 1].date
  const txns = (state && state.transactions) || []
  const todayISO = isoDate(toDate(asOf))

  // index bills/events by day across the visible grid
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

  // heat scale is the visible month's own max discretionary day
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
        heatLevel: heatLevel(spend, scaleMax),
        bills: billsByDay.get(cell.date) || [],
        events: eventsByDay.get(cell.date) || [],
        terms: termSpansOn(state && state.termSpans, cell.date).map((s) => ({ kind: s.kind, label: s.label })),
      }
    }),
  )

  const monthLabel = toDate(anchor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return { monthLabel, weeks: enriched }
}
```

- [ ] **Step 4: Run — passes**, then `npm test` green (all 92 + new).
- [ ] **Step 5: Commit.** `feat: calendar engine — term overlays, plan-ahead nudge, buildMonth`.

---

### Task 6: Term-dates form

**Files:**
- Modify: `src/components/forms.jsx` (add `TermSpanForm`)

**Interfaces:**
- Consumes: store action `addTermSpan` (Task 1); `Field`, `Segmented` from `ui.jsx`.
- Produces: `<TermSpanForm onDone />` — a form that adds a term span.

- [ ] **Step 1: Implement `TermSpanForm`** in `src/components/forms.jsx`, mirroring `EventForm`:

```jsx
export function TermSpanForm({ onDone }) {
  const { actions } = useStore()
  const [kind, setKind] = useState('freshers')
  const [label, setLabel] = useState('Freshers')
  const [start, setStart] = useState(isoOffset(0))
  const [end, setEnd] = useState(isoOffset(7))
  const ok = label.trim() && start && end && end >= start

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.addTermSpan({ kind, label: label.trim(), start, end })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <Field label="What is it?">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'freshers', label: 'Freshers' },
            { value: 'exams', label: 'Exams' },
            { value: 'term', label: 'Term' },
          ]}
        />
      </Field>
      <Field label="Name">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Freshers, Semester 1 exams" />
      </Field>
      <div className="field-row">
        <Field label="From"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>Add term dates</button>
    </form>
  )
}
```

- [ ] **Step 2: Verify build.** `npm run build` succeeds (no test — this is presentational; it's driven in Task 8).
- [ ] **Step 3: Commit.** `feat: add TermSpanForm for setting term dates`.

---

### Task 7: Calendar screen (rewrite the Planned tab)

**Files:**
- Modify: `src/components/Events.jsx` (rewrite as the calendar; keep `export default function Events()`)
- Modify: `src/index.css` (calendar grid + heat + marker + term-band styles)

**Interfaces:**
- Consumes: `buildMonth`, `termNudge` from `calendar.js`; `TermSpanForm`, `EventForm` from `forms.jsx`; `Sheet`, `Field` from `ui.jsx`; `addMonths` from `finance.js`; `gbp`, `fullDate`, `relativeDays` from `format.js`; `removeTermSpan`, `removeEvent` actions.

- [ ] **Step 1: Invoke the `dataviz` skill** before writing the heat CSS. Confirm: single-hue `--violet` sequential ramp (4 steps via `color-mix` against `--surface`), status colours untouched, term tints on edges/bands only, markers ≥ 8px, a legend present.

- [ ] **Step 2: Build the screen.** Rewrite `Events.jsx` to render, top to bottom:
  1. Page head ("Coming up" / "Planned").
  2. **Nudge card** — `const nudge = termNudge(state, new Date())`; render a card with the `nudge.message` when non-null (class keyed on `nudge.kind`), else nothing.
  3. **Month controls** — `‹` / month label / `›` and a "Today" reset, driven by an `anchor` state (`useState(() => new Date())`); prev/next use `addMonths(anchor, ±1)`.
  4. **Grid** — `const { weeks } = buildMonth(state, anchor, new Date())`; a Mon–Sun weekday header row, then 7-column cells. Each cell: a `heat-N` class from `cell.heatLevel`, the day number, a coral pip if `cell.events.length`, a muted ring if `cell.bills.length`, a `term-<kind>` top-edge class if `cell.terms.length`, `is-today`/`out-month` modifiers. Clicking a cell sets `selected` (the cell) → opens the day-detail `Sheet`.
  5. **Heat legend** — "less … more" with the four ramp swatches.
  6. **Day-detail `Sheet`** (when `selected`) — `fullDate(selected.date)`, its term labels, `bills` (label + `gbp`), `events` (label + `gbp`), and the day's discretionary spend.
  7. **Term-dates section** — an "Add term dates" button opening `TermSpanForm` in a `Sheet`; a list of `state.termSpans` with remove buttons.
  8. **Planned-events section** — keep the existing `EventForm` add-flow + the upcoming list (moved beneath the grid) unchanged.

- [ ] **Step 3: Add CSS to `src/index.css`.** Minimal, token-based. The heat ramp (single hue):

```css
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-cell { aspect-ratio: 1; border-radius: var(--r-sm); border: 1px solid var(--line-2);
  background: var(--surface); padding: 6px; position: relative; cursor: pointer; }
.cal-cell.out-month { opacity: 0.45; }
.cal-cell.is-today { outline: 2px solid var(--brand-ink); outline-offset: -2px; }
.cal-cell.heat-1 { background: color-mix(in srgb, var(--violet) 14%, var(--surface)); }
.cal-cell.heat-2 { background: color-mix(in srgb, var(--violet) 32%, var(--surface)); }
.cal-cell.heat-3 { background: color-mix(in srgb, var(--violet) 55%, var(--surface)); }
.cal-cell.heat-4 { background: color-mix(in srgb, var(--violet) 78%, var(--surface)); color: var(--on-violet); }
.cal-cell .pip { width: 8px; height: 8px; border-radius: 999px; background: var(--coral); position: absolute; right: 6px; bottom: 6px; }
.cal-cell .ring { width: 8px; height: 8px; border-radius: 999px; border: 2px solid var(--muted); position: absolute; left: 6px; bottom: 6px; }
.cal-cell.term-freshers { box-shadow: inset 0 3px 0 var(--pink); }
.cal-cell.term-exams { box-shadow: inset 0 3px 0 var(--aqua-edge); }
.cal-cell.term-term { box-shadow: inset 0 3px 0 var(--line); }
.cal-legend { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 12px; margin-top: 8px; }
.cal-legend i { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
```

(Adjust class names to match the JSX; keep the ramp single-hue and the term tints on `inset` edges so they never overwrite the heat fill.)

- [ ] **Step 4: Verify build + tests.** `npm run build` clean; `npm test` green.
- [ ] **Step 5: Commit.** `feat: calendar screen — heatmap, markers, term editor, nudge`.

---

### Task 8: Verify end-to-end (drive the app)

- [ ] **Step 1:** `npm run dev`; open the app, go to **Planned**.
- [ ] **Step 2:** Confirm on the demo seed: the month grid renders; the seeded discretionary spend shows as violet heat on the right days; the seeded **Freshers** span shows its top-edge tint and the **plan-ahead nudge card** appears with the cap message; **zero console errors**.
- [ ] **Step 3:** Page to next/prev months and back to Today; the rent bill marker (ring) shows on its due day; add a planned event → its coral pip appears on the day and in the day-detail sheet.
- [ ] **Step 4:** Add a term span via the editor (e.g. an Exams span a week out) → its band shows and the nudge updates; remove it → nudge/tint clear.
- [ ] **Step 5:** Toggle **dark mode**; confirm the heat ramp + term tints stay legible (contrast holds).
- [ ] **Step 6:** Screenshot the calendar (light + dark) for the record.

## Self-Review

- **Spec coverage:** Data model v3 + migration → Task 1; backup round-trip → Task 2; `daySpend`/`heatLevel` → Task 3; `billOccurrences`/`monthMatrix` → Task 4; `termSpansOn`/`termNudge`/`buildMonth` → Task 5; term editor → Task 6; calendar screen (grid, heat, markers, day-detail, nudge card, kept event flow) + palette/dataviz → Task 7; seed → Task 1; drive-to-verify → Task 8. ✔ (`freshersCap` was spec'd as optional/nice-to-have and is intentionally deferred — nudges ship without an exact cap figure.)
- **Placeholder scan:** every code step shows real code; no TBD/echo-placeholders. ✔
- **Type consistency:** `termSpans` shape, `buildMonth` cell fields, and `termNudge` return shape match the spec §Interfaces and are used identically across Tasks 5, 7. `addMonths` is exported in Task 4 before its use in Tasks 4/7. ✔
- **No-regression:** every task ends on `npm test` green; 92 existing tests untouched. ✔
