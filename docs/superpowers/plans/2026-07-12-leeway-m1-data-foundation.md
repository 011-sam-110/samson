# Leeway M1 — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Leeway a rich student category model (with engine-type derivation), a safe schema migration, and export/import — without changing any of the engine's proven numbers.

**Architecture:** A single source-of-truth module (`src/lib/categories.js`) defines student categories and derives the `fixed|variable|discretionary` type the engine already relies on, so the engine changes one filter line and stays green. A pure `migrate()` runner upgrades old localStorage v1 data to v2 on load. A pure backup module serialises/validates state; the Nav footer wires download/upload. UI forms swap the 3-way type toggle for a real category picker.

**Tech Stack:** React 18 (JS, not TS), Vite 5, Vitest 2 (`node` env), localStorage. No new dependencies.

## Global Constraints

- Language: plain JavaScript/JSX — no TypeScript.
- Tests live under `src/` matching `src/**/*.test.{js,jsx}`; run with `npm test` (`vitest run`). Single file: `npx vitest run <path>`.
- Test environment is `node` — no `document`/`window` in unit tests. DOM-touching helpers stay untested (thin wrappers only).
- The engine (`src/engine/finance.js`) stays pure (no React, no storage). Importing a pure constants module is allowed.
- All 23 existing engine tests MUST stay green after every task.
- Category keys are stable lowercase slugs (e.g. `eating_out`). Never rename a shipped key.
- Copy keeps Leeway's student voice (casual, plain-English).
- Frequent commits: one per task, message ends with the Co-Authored-By trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Category source of truth

**Files:**
- Create: `src/lib/categories.js`
- Test: `src/lib/categories.test.js`

**Interfaces:**
- Produces:
  - `CATEGORIES: Array<{ key: string, label: string, type: 'fixed'|'variable'|'discretionary' }>`
  - `typeOf(category: string) => 'fixed'|'variable'|'discretionary'` — legacy passthrough for `'fixed'|'variable'|'discretionary'`, else the category's type, else `'discretionary'`
  - `categoryLabel(category: string) => string`
  - `LEGACY_TYPE_TO_CATEGORY: Record<'fixed'|'variable'|'discretionary', string>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/categories.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { CATEGORIES, typeOf, categoryLabel, LEGACY_TYPE_TO_CATEGORY } from './categories.js'

describe('categories', () => {
  it('every category has a key, label and valid type', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0)
    for (const c of CATEGORIES) {
      expect(c.key).toMatch(/^[a-z_]+$/)
      expect(typeof c.label).toBe('string')
      expect(['fixed', 'variable', 'discretionary']).toContain(c.type)
    }
  })

  it('typeOf maps a student category to its engine type', () => {
    expect(typeOf('rent')).toBe('fixed')
    expect(typeOf('groceries')).toBe('variable')
    expect(typeOf('going_out')).toBe('discretionary')
  })

  it('typeOf passes legacy type values straight through', () => {
    expect(typeOf('fixed')).toBe('fixed')
    expect(typeOf('variable')).toBe('variable')
    expect(typeOf('discretionary')).toBe('discretionary')
  })

  it('typeOf defaults unknown categories to discretionary (still counts in run-rate)', () => {
    expect(typeOf('made_up')).toBe('discretionary')
    expect(typeOf(undefined)).toBe('discretionary')
  })

  it('categoryLabel returns the friendly label, with a sane fallback', () => {
    expect(categoryLabel('eating_out')).toBe('Eating out')
    expect(categoryLabel('variable')).toBe('Variable')
    expect(categoryLabel('nonsense')).toBe('Spend')
  })

  it('legacy tags map to a real category for migration', () => {
    expect(LEGACY_TYPE_TO_CATEGORY.fixed).toBe('bills')
    expect(LEGACY_TYPE_TO_CATEGORY.variable).toBe('groceries')
    expect(LEGACY_TYPE_TO_CATEGORY.discretionary).toBe('other')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/categories.test.js`
Expected: FAIL — cannot resolve `./categories.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/categories.js`:

```js
// Single source of truth for spending categories.
// Each student-facing category derives the fixed|variable|discretionary "type"
// the finance engine's run-rate already depends on, so the engine stays untouched.

export const CATEGORIES = [
  { key: 'groceries', label: 'Groceries', type: 'variable' },
  { key: 'eating_out', label: 'Eating out', type: 'discretionary' },
  { key: 'going_out', label: 'Going out', type: 'discretionary' },
  { key: 'transport', label: 'Transport', type: 'variable' },
  { key: 'coffee', label: 'Coffee & snacks', type: 'discretionary' },
  { key: 'shopping', label: 'Shopping', type: 'discretionary' },
  { key: 'subscriptions', label: 'Subscriptions', type: 'fixed' },
  { key: 'bills', label: 'Bills', type: 'fixed' },
  { key: 'rent', label: 'Rent', type: 'fixed' },
  { key: 'health', label: 'Health', type: 'variable' },
  { key: 'course', label: 'Course & books', type: 'variable' },
  { key: 'other', label: 'Other', type: 'discretionary' },
]

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))
const LEGACY_TYPES = new Set(['fixed', 'variable', 'discretionary'])
const LEGACY_LABELS = { fixed: 'Fixed', variable: 'Variable', discretionary: 'Fun' }

// v1 stored the spending type in the `category` field; map it to a real category on migrate.
export const LEGACY_TYPE_TO_CATEGORY = { fixed: 'bills', variable: 'groceries', discretionary: 'other' }

export function typeOf(category) {
  if (LEGACY_TYPES.has(category)) return category
  return BY_KEY[category]?.type ?? 'discretionary'
}

export function categoryLabel(category) {
  if (BY_KEY[category]) return BY_KEY[category].label
  return LEGACY_LABELS[category] ?? 'Spend'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/categories.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.js src/lib/categories.test.js
git commit -m "$(printf 'feat: add student category source of truth with engine-type derivation\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Engine run-rate reads the derived type

**Files:**
- Modify: `src/engine/finance.js` (add import; change the run-rate filter ~line 182-183)
- Test: `src/engine/finance.test.js` (add one regression test)

**Interfaces:**
- Consumes: `typeOf` from `src/lib/categories.js`.
- Produces: no signature change — `computeDashboard().currentDaily` unchanged for equivalent data.

- [ ] **Step 1: Write the failing test**

In `src/engine/finance.test.js`, add inside the `describe('sustainable target rate + run rate', ...)` block (after the existing `current daily rate averages...` test):

```js
  it('run rate counts new student categories by their derived type', () => {
    const state = {
      balance: 300,
      incomeSources: [{ id: 'w', kind: 'monthly', amount: 800, nextDate: '2026-02-01' }],
      bills: [],
      goals: [],
      events: [],
      transactions: [
        { id: 't1', type: 'expense', category: 'going_out', amount: 40, date: '2025-12-29' }, // discretionary → counts
        { id: 't2', type: 'expense', category: 'groceries', amount: 30, date: '2025-12-30' }, // variable → counts
        { id: 't3', type: 'expense', category: 'rent', amount: 500, date: '2025-12-30' }, // fixed → excluded
      ],
    }
    const dash = computeDashboard(state, ASOF, { lookbackDays: 14 })
    expect(dash.currentDaily).toBeCloseTo(70 / 14, 4)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/finance.test.js`
Expected: FAIL — `currentDaily` is `570/14` because `category === 'rent'` isn't matched by the old `=== 'variable' || === 'discretionary'` filter, so rent is wrongly excluded... actually the OLD filter excludes ALL new keys (they aren't 'variable'/'discretionary'), so `currentDaily` is `0`. Test fails (0 ≠ 5).

- [ ] **Step 3: Write minimal implementation**

In `src/engine/finance.js`, add at the top with the other declarations (after the header comment, before `export const DAYS_PER_MONTH`):

```js
import { typeOf } from '../lib/categories.js'
```

Then change the run-rate filter. Find (around line 182-183):

```js
  const recentSpend = transactions
    .filter((t) => t.type === 'expense' && (t.category === 'variable' || t.category === 'discretionary'))
```

Replace the `.filter` line with:

```js
    .filter((t) => t.type === 'expense' && typeOf(t.category) !== 'fixed')
```

- [ ] **Step 4: Run the full engine suite**

Run: `npm test`
Expected: PASS — all existing tests plus the new one (the legacy `'variable'`/`'discretionary'`/`'fixed'` values in older tests still resolve correctly via `typeOf`'s passthrough).

- [ ] **Step 5: Commit**

```bash
git add src/engine/finance.js src/engine/finance.test.js
git commit -m "$(printf 'refactor: run-rate filters by derived category type\n\nEngine now resolves spend type via typeOf(), so real student categories\ncount correctly while legacy type values still pass through.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Schema migration (v1 → v2)

**Files:**
- Create: `src/store/migrate.js`
- Test: `src/store/migrate.test.js`

**Interfaces:**
- Consumes: `LEGACY_TYPE_TO_CATEGORY` from `src/lib/categories.js`.
- Produces:
  - `CURRENT_VERSION: number` (= 2)
  - `migrate(state: object) => object` — pure; upgrades any older state to `CURRENT_VERSION`; idempotent; returns non-objects untouched.

- [ ] **Step 1: Write the failing test**

Create `src/store/migrate.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { migrate, CURRENT_VERSION } from './migrate.js'

const v1 = {
  version: 1,
  balance: 100,
  transactions: [
    { id: 'a', type: 'expense', category: 'variable', amount: 10, date: '2026-01-01' },
    { id: 'b', type: 'expense', category: 'discretionary', amount: 5, date: '2026-01-01' },
    { id: 'c', type: 'expense', category: 'fixed', amount: 20, date: '2026-01-01' },
    { id: 'd', type: 'income', category: 'variable', amount: 50, date: '2026-01-01' },
  ],
  incomeSources: [],
  bills: [],
  goals: [],
  events: [],
}

describe('migrate', () => {
  it('upgrades v1 to the current version', () => {
    expect(migrate(v1).version).toBe(CURRENT_VERSION)
  })

  it('maps legacy expense tags to real categories', () => {
    const out = migrate(v1)
    expect(out.transactions.find((t) => t.id === 'a').category).toBe('groceries')
    expect(out.transactions.find((t) => t.id === 'b').category).toBe('other')
    expect(out.transactions.find((t) => t.id === 'c').category).toBe('bills')
  })

  it('leaves income transactions alone', () => {
    const out = migrate(v1)
    expect(out.transactions.find((t) => t.id === 'd').category).toBe('variable')
  })

  it('is idempotent (running twice equals running once)', () => {
    expect(migrate(migrate(v1))).toEqual(migrate(v1))
  })

  it('passes a current-version state through unchanged', () => {
    const v2 = { ...v1, version: CURRENT_VERSION, transactions: [] }
    expect(migrate(v2)).toEqual(v2)
  })

  it('does not throw on non-object input', () => {
    expect(migrate(null)).toBe(null)
    expect(migrate(undefined)).toBe(undefined)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/migrate.test.js`
Expected: FAIL — cannot resolve `./migrate.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/store/migrate.js`:

```js
import { LEGACY_TYPE_TO_CATEGORY } from '../lib/categories.js'

export const CURRENT_VERSION = 2

// Pure, ordered state migrations. Each step upgrades exactly one version so old
// localStorage data is never wiped on a schema change.
export function migrate(state) {
  if (!state || typeof state !== 'object') return state
  let s = state
  if ((s.version ?? 1) < 2) s = toV2(s)
  return s
}

// v1 stored the spending type ('fixed'|'variable'|'discretionary') in each
// expense's `category`. v2 uses real student categories; map the old tags over.
function toV2(s) {
  const transactions = (s.transactions ?? []).map((t) =>
    t.type === 'expense' && LEGACY_TYPE_TO_CATEGORY[t.category]
      ? { ...t, category: LEGACY_TYPE_TO_CATEGORY[t.category] }
      : t,
  )
  return { ...s, version: 2, transactions }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/migrate.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/migrate.js src/store/migrate.test.js
git commit -m "$(printf 'feat: add v1 to v2 schema migration for categories\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Wire migration into the store and upgrade the seed

**Files:**
- Modify: `src/store/store.js` (import + use `migrate` in `load()`; add `importData` action)
- Modify: `src/store/seed.js` (bump to version 2; use real category keys)

**Interfaces:**
- Consumes: `migrate` from `./migrate.js`.
- Produces: `actions.importData(obj)` — replaces state with `migrate(obj)` (used by Task 6).

- [ ] **Step 1: Update the store to migrate on load**

In `src/store/store.js`, add the import near the top (after the existing imports):

```js
import { migrate } from './migrate.js'
```

Change `load()` so the parsed value is migrated:

```js
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    /* corrupt or unavailable - fall through to seed */
  }
  return defaultState()
}
```

Add an `importData` action. Inside the returned actions object (next to `resetDemo`), add:

```js
      importData: (obj) => setState(() => migrate(obj)),
```

- [ ] **Step 2: Upgrade the seed to v2 with real categories**

In `src/store/seed.js`, change `version: 1,` to `version: 2,` and set each transaction's `category` to a real key. Replace the `transactions: [ ... ]` array with:

```js
    transactions: [
      { id: uid(), type: 'expense', label: 'Tesco Metro', amount: 23.4, category: 'groceries', date: iso(-1) },
      { id: uid(), type: 'expense', label: 'Pret', amount: 6.8, category: 'coffee', date: iso(-1) },
      { id: uid(), type: 'expense', label: 'Night bus', amount: 5, category: 'transport', date: iso(-2) },
      { id: uid(), type: 'expense', label: 'Spoons round', amount: 18.5, category: 'going_out', date: iso(-3) },
      { id: uid(), type: 'income', label: 'Sold textbook', amount: 25, category: 'other', date: iso(-4) },
      { id: uid(), type: 'expense', label: 'Big shop', amount: 31.2, category: 'groceries', date: iso(-4) },
      { id: uid(), type: 'expense', label: 'Cinema', amount: 12, category: 'going_out', date: iso(-5) },
      { id: uid(), type: 'expense', label: 'Coffee', amount: 3.6, category: 'coffee', date: iso(-6) },
      { id: uid(), type: 'expense', label: 'Deliveroo', amount: 21.4, category: 'eating_out', date: iso(-7) },
      { id: uid(), type: 'expense', label: 'Bus topup', amount: 10, category: 'transport', date: iso(-9) },
      { id: uid(), type: 'expense', label: 'Tesco', amount: 27.8, category: 'groceries', date: iso(-10) },
    ],
```

- [ ] **Step 3: Verify tests still pass and the app builds**

Run: `npm test`
Expected: PASS — all engine + categories + migrate tests green.

Run: `npm run build`
Expected: builds to `dist/` with no errors.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, open the app. Because existing localStorage is v1, it should upgrade silently (no wipe, no console error). Transactions list still renders. Then use "Reset demo data" to load the new v2 seed and confirm categories look right.

- [ ] **Step 5: Commit**

```bash
git add src/store/store.js src/store/seed.js
git commit -m "$(printf 'feat: migrate localStorage on load and seed real categories\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Backup serialize / parse

**Files:**
- Create: `src/lib/backup.js`
- Test: `src/lib/backup.test.js`

**Interfaces:**
- Produces:
  - `serializeState(state: object) => string` (pretty JSON)
  - `parseBackup(text: string) => object` — throws `Error` with a friendly message on invalid JSON or a non-Leeway shape
  - `backupFilename(date?: Date) => string` — `leeway-backup-YYYY-MM-DD.json`
  - `downloadJSON(filename: string, text: string) => void` — DOM side-effect (untested)

- [ ] **Step 1: Write the failing test**

Create `src/lib/backup.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { serializeState, parseBackup, backupFilename } from './backup.js'

const good = {
  version: 2,
  balance: 100,
  incomeSources: [],
  bills: [],
  goals: [],
  events: [],
  transactions: [],
}

describe('backup', () => {
  it('serialize → parse round-trips a state', () => {
    expect(parseBackup(serializeState(good))).toEqual(good)
  })

  it('throws a friendly error on invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow(/valid JSON/)
  })

  it('throws when required Leeway keys are missing', () => {
    expect(() => parseBackup(JSON.stringify({ balance: 1 }))).toThrow(/Leeway backup/)
  })

  it('rejects arrays and primitives', () => {
    expect(() => parseBackup('[]')).toThrow(/Leeway backup/)
    expect(() => parseBackup('42')).toThrow(/Leeway backup/)
  })

  it('builds a dated filename', () => {
    expect(backupFilename(new Date(2026, 6, 12))).toBe('leeway-backup-2026-07-12.json')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/backup.test.js`
Expected: FAIL — cannot resolve `./backup.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/backup.js`:

```js
// Portable JSON backup of the whole app state. Pure helpers are unit-tested;
// downloadJSON is a thin DOM wrapper (browser only).

const REQUIRED_KEYS = ['balance', 'incomeSources', 'bills', 'goals', 'events', 'transactions']

export function serializeState(state) {
  return JSON.stringify(state, null, 2)
}

export function parseBackup(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error("That doesn't look like a Leeway backup.")
  }
  for (const k of REQUIRED_KEYS) {
    if (!(k in obj)) throw new Error("That doesn't look like a Leeway backup.")
  }
  return obj
}

export function backupFilename(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `leeway-backup-${y}-${m}-${d}.json`
}

export function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/backup.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup.js src/lib/backup.test.js
git commit -m "$(printf 'feat: add JSON backup serialize/parse helpers\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: Export / Import in the app (Nav footer)

**Files:**
- Modify: `src/components/Nav.jsx`

**Interfaces:**
- Consumes: `state` + `actions.importData` from the store; `serializeState`, `parseBackup`, `backupFilename`, `downloadJSON` from `src/lib/backup.js`.
- Produces: no exports — user-facing Export/Import controls.

- [ ] **Step 1: Add the controls and handlers**

In `src/components/Nav.jsx`:

Add imports at the top:

```js
import { useRef } from 'react'
import { serializeState, parseBackup, backupFilename, downloadJSON } from '../lib/backup.js'
```

Change the store hook line inside `Nav` from `const { actions } = useStore()` to:

```js
  const { state, actions } = useStore()
  const fileRef = useRef(null)

  const onExport = () => downloadJSON(backupFilename(), serializeState(state))

  const onImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = parseBackup(String(reader.result))
        if (confirm('Import this backup? It replaces everything currently in Leeway.')) {
          actions.importData(obj)
        }
      } catch (err) {
        alert(err.message)
      }
    }
    reader.readAsText(file)
  }
```

Replace the `<div className="sidebar-foot">…</div>` block with:

```jsx
        <div className="sidebar-foot">
          <button className="linkish" onClick={onExport}>
            Export data
          </button>
          <button className="linkish" onClick={() => fileRef.current?.click()}>
            Import data
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
          <button className="linkish" onClick={() => confirm('Reset back to the demo data?') && actions.resetDemo()}>
            Reset demo data
          </button>
        </div>
```

- [ ] **Step 2: Verify build + manual round-trip**

Run: `npm run build`
Expected: builds with no errors.

Run: `npm run dev`. Click **Export data** → a `leeway-backup-YYYY-MM-DD.json` downloads. Add a spend, then **Import data** and pick the file → confirm dialog → state reverts to the exported snapshot. Import a random non-JSON file → friendly alert, state unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.jsx
git commit -m "$(printf 'feat: export/import Leeway data from the nav footer\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: Surface categories in the UI

**Files:**
- Modify: `src/components/forms.jsx` (ExpenseForm: category chip picker)
- Modify: `src/components/CanISpend.jsx` (log with a real category key)
- Modify: `src/components/Transactions.jsx` (avatar colour via derived type; label via `categoryLabel`)
- Modify: `src/index.css` (one `.chip-grid` rule)

**Interfaces:**
- Consumes: `CATEGORIES`, `typeOf`, `categoryLabel` from `src/lib/categories.js`.
- Produces: no exports — logged expenses now carry a real category key.

- [ ] **Step 1: ExpenseForm — swap the 3-way toggle for a category picker**

In `src/components/forms.jsx`:

Add the import at the top (after the existing imports):

```js
import { CATEGORIES } from '../lib/categories.js'
```

In `ExpenseForm`, change the initial category state from `useState('variable')` to:

```js
  const [category, setCategory] = useState('groceries')
```

Replace the entire `<Field label="Type"> … </Field>` block with:

```jsx
      <Field label="Category">
        <div className="chip-grid">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`btn btn-sm ${category === c.key ? 'btn-primary' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>
```

- [ ] **Step 2: CanISpend — log a real category key**

In `src/components/CanISpend.jsx`, in `logIt`, change the `category: 'discretionary'` argument to `category: 'other'`:

```js
    actions.addExpense({ label: `Spend of ${gbp(spend)}`, amount: spend, category: 'other', freq: 'oneoff' })
```

- [ ] **Step 3: Transactions — colour by derived type, label by category**

In `src/components/Transactions.jsx`:

Add the import (after the existing `../lib/format.js` import):

```js
import { typeOf, categoryLabel } from '../lib/categories.js'
```

Delete the `const CAT_LABEL = …` line near the top.

In the ledger `.map`, change the `Avatar` `cls` for the row from:

```jsx
            <Avatar label={t.label} cls={t.type === 'income' ? 'cat-income' : `cat-${t.category}`} />
```

to:

```jsx
            <Avatar label={t.label} cls={t.type === 'income' ? 'cat-income' : `cat-${typeOf(t.category)}`} />
```

And change the subtitle from:

```jsx
                {shortDate(t.date)} · {t.type === 'income' ? 'Income' : CAT_LABEL[t.category] || 'Spend'}
```

to:

```jsx
                {shortDate(t.date)} · {t.type === 'income' ? 'Income' : categoryLabel(t.category)}
```

- [ ] **Step 4: Add the chip-grid CSS**

In `src/index.css`, append after the `.cat-income { … }` block (around line 540):

```css
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

- [ ] **Step 5: Verify build + manual check**

Run: `npm test` (should still be all green — no logic changed).
Run: `npm run build` (no errors).
Run: `npm run dev`. Open **Log a spend**: the category picker shows all 12 chips, selecting one highlights it. Log e.g. a "Deliveroo" under **Eating out** → it appears in Transactions with an amber (discretionary) avatar and the label "Eating out".

- [ ] **Step 6: Commit**

```bash
git add src/components/forms.jsx src/components/CanISpend.jsx src/components/Transactions.jsx src/index.css
git commit -m "$(printf 'feat: pick and display real student categories on expenses\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Category model → Task 1 (module) + Task 7 (UI). ✔
- Category → engine type derivation, engine untouched behaviourally → Task 2. ✔
- Schema migration v1→v2, unit-tested, idempotent → Task 3, wired in Task 4. ✔
- Seed updated to v2 with real keys → Task 4. ✔
- Export/Import → Task 5 (logic) + Task 6 (UI). ✔
- Tests for mapping + migration + import validation → Tasks 1, 2, 3, 5. ✔
- Out of scope (charts, cloud sync, editing a logged txn's category) → not present. ✔

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✔

**Type consistency:** `typeOf`, `categoryLabel`, `CATEGORIES`, `LEGACY_TYPE_TO_CATEGORY`, `migrate`, `CURRENT_VERSION`, `serializeState`, `parseBackup`, `backupFilename`, `downloadJSON`, `importData` are used with identical names/shapes across the tasks that define and consume them. ✔

**Success criteria check:** Engine numbers unchanged for equivalent data (Task 2 regression + full suite), clean v1 upgrade (Task 4 smoke), export/import round-trip (Task 6), all tests green. ✔
