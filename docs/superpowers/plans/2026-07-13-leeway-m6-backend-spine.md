# Leeway M6 — Backend Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the server side of optional cloud sync — a Clerk-authenticated `GET/PUT /api/state` backed by normalized Neon Postgres — with **zero client-visible change** (guests unaffected).

**Architecture:** A thin Vercel serverless function (`api/state.js`) delegates to injectable core logic (`src/lib/state-api.js`) that verifies the Clerk JWT, validates + `migrate()`s the body, and reads/atomically-replaces the user's rows through a Neon `Pool` transaction. All numeric/date mapping lives in one pure, unit-tested module (`src/lib/state-serialize.js`). Same split as the existing `api/extract.js` → `src/lib/llm.js` (server logic in `src/lib/`, injectable for offline tests).

**Tech Stack:** Plain JavaScript (ESM), Vite, Vitest (node env, colocated `*.test.js`), Vercel serverless functions, Neon Postgres via `@neondatabase/serverless` (`Pool`), Clerk via `@clerk/backend` (`verifyToken`).

**Design spec:** `docs/superpowers/specs/2026-07-12-leeway-cloud-sync-design.md`.

## Global Constraints

- **Plain JavaScript, no TypeScript.** ESM modules only. Match the house style in `src/lib/*.js`.
- **Node `22.x`** — pin `engines.node` in `package.json` (repo has none today).
- **Tests:** Vitest, `environment: 'node'`, colocated `*.test.js` next to the module (`vite.config.js` `include: ['src/**/*.test.{js,jsx}']`). Style: `import { describe, it, expect } from 'vitest'`; regression tests carry an explanatory comment above the `it(...)`.
- **`user_id` comes ONLY from the verified Clerk token (`sub`), never from the request body or query.**
- **Never `VITE_`-prefix** `DATABASE_URL` or `CLERK_SECRET_KEY` (a `VITE_` var ships in the client bundle).
- **Zero client-visible change in M6** — do not touch `src/store/`, `src/components/`, `src/engine/`, `src/App.jsx`, or `src/main.jsx`. Guests keep using `localStorage` exactly as today.
- **Server logic is injectable** (DB + token verifier passed in) so it is unit-tested with no network/DB, mirroring `src/lib/llm.js`'s `fetchImpl` seam.
- **IDs reuse the client's `uid()`**; every child table has a **composite `PRIMARY KEY (user_id, id)`**.
- **Reuse existing validation discipline** from `src/lib/backup.js:parseBackup()` (finite-number `balance`, required arrays).
- Commit after every task.

---

## File Structure

- `schema.sql` (**new**, repo root) — the 7 tables, composite PKs, FK cascade, per-user indexes, RLS policies. Applied once to Neon.
- `src/lib/state-serialize.js` (**new**) — pure `rowsToState()` / `stateToRows()` / `validateState()`. The single numeric/date coercion point.
- `src/lib/state-serialize.test.js` (**new**) — round-trip + coercion + validation tests.
- `src/lib/state-api.js` (**new**) — `handleState(req, deps)` core: auth, validate, `migrate()`, GET assemble, PUT atomic replace with 409 recency guard. DB + verifier injected.
- `src/lib/state-api.test.js` (**new**) — auth/GET/PUT/409/400 behavior via a fake pool.
- `api/state.js` (**new**) — thin wrapper wiring real `Pool` + `verifyToken` to `handleState`.
- `vite.config.js` (**modify**, line 7) — extend the dev `KEYS` allow-list.
- `package.json` (**modify**) — add `@neondatabase/serverless`, `@clerk/backend`; pin `engines.node`.
- `.env.example` (**modify**) — document the new server env vars.
- `scripts/smoke-state.mjs` (**new**) — live GET→PUT→GET integration check (Task 6 DoD gate).

---

### Task 1: Dependencies, Node pin, and dev env wiring

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js:7`
- Modify: `.env.example`

**Interfaces:**
- Produces: `process.env.DATABASE_URL`, `process.env.CLERK_SECRET_KEY`, `process.env.APP_ORIGINS` available to `/api` handlers under `npm run dev`; `@neondatabase/serverless` and `@clerk/backend` importable.

- [ ] **Step 1: Install the two server dependencies**

Run: `npm install @neondatabase/serverless @clerk/backend`
Expected: both added to `package.json` `dependencies`; `package-lock.json` updated; exit 0.

- [ ] **Step 2: Pin the Node runtime in `package.json`**

Add a top-level `engines` field (place it after `"version"`):

```json
  "engines": {
    "node": "22.x"
  },
```

- [ ] **Step 3: Extend the dev API env allow-list in `vite.config.js`**

Change line 7 from:

```js
  const KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY']
```

to:

```js
  const KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'DATABASE_URL', 'CLERK_SECRET_KEY', 'APP_ORIGINS']
```

- [ ] **Step 4: Document the new server env vars in `.env.example`**

Append:

```bash
# --- Cloud sync (M6, server-only — NEVER prefix these with VITE_) ---
# Neon pooled connection string (Vercel Marketplace → Neon injects this)
DATABASE_URL=
# Clerk backend secret (Vercel Marketplace → Clerk injects this)
CLERK_SECRET_KEY=
# Comma-separated allowed origins for Clerk token azp check (prod + preview URLs)
APP_ORIGINS=
```

- [ ] **Step 5: Verify nothing regressed**

Run: `npm test`
Expected: PASS — all existing suites green (M6 adds no changes to tested modules yet).
Run: `npm run dev` then stop it.
Expected: dev server boots with no error about the new `KEYS`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js .env.example
git commit -m "chore(m6): add Neon + Clerk backend deps, pin Node, wire dev env vars"
```

---

### Task 2: Database schema (`schema.sql`)

**Files:**
- Create: `schema.sql` (repo root)

**Interfaces:**
- Produces: tables `profiles`, `transactions`, `bills`, `income_sources`, `goals`, `events`, `term_spans` with the exact column names `src/lib/state-serialize.js` maps to (Task 3). Composite `(user_id, id)` PKs on child tables; `profiles.user_id` PK; RLS keyed on `current_setting('app.user_id', true)`.

> No unit test — SQL correctness is verified by applying it against a Neon branch in Task 6. Keep the column names **exactly** as below; Task 3 depends on them verbatim.

- [ ] **Step 1: Write `schema.sql`**

```sql
-- Leeway M6 cloud-sync schema. Apply once against Neon (SQL editor, or psql on
-- DATABASE_URL_UNPOOLED). One profiles row per user (the scalars) + one table
-- per client collection. Keyed by the Clerk user_id (text). Row-Level Security
-- is the structural backstop under the handler's app-level WHERE user_id filters.

create table if not exists profiles (
  user_id         text primary key,
  balance         numeric     not null default 0,
  last_reconciled date,
  survive_until   date,
  schema_version  integer     not null default 3,
  updated_at      timestamptz not null default now()
);

create table if not exists transactions (
  user_id  text not null references profiles(user_id) on delete cascade,
  id       text not null,
  type     text,
  label    text,
  amount   numeric not null default 0,
  category text,
  date     date,
  primary key (user_id, id)
);

create table if not exists bills (
  user_id  text not null references profiles(user_id) on delete cascade,
  id       text not null,
  label    text,
  amount   numeric not null default 0,
  freq     text,
  next_due date,
  primary key (user_id, id)
);

create table if not exists income_sources (
  user_id   text not null references profiles(user_id) on delete cascade,
  id        text not null,
  label     text,
  kind      text,
  amount    numeric not null default 0,
  next_date date,
  primary key (user_id, id)
);

create table if not exists goals (
  user_id  text not null references profiles(user_id) on delete cascade,
  id       text not null,
  label    text,
  target   numeric not null default 0,
  saved    numeric not null default 0,
  deadline date,
  primary key (user_id, id)
);

create table if not exists events (
  user_id text not null references profiles(user_id) on delete cascade,
  id      text not null,
  label   text,
  amount  numeric not null default 0,
  date    date,
  primary key (user_id, id)
);

create table if not exists term_spans (
  user_id text not null references profiles(user_id) on delete cascade,
  id      text not null,
  kind    text,
  label   text,
  start   date,
  "end"   date,
  primary key (user_id, id)
);

create index if not exists idx_transactions_user  on transactions(user_id);
create index if not exists idx_bills_user          on bills(user_id);
create index if not exists idx_income_sources_user on income_sources(user_id);
create index if not exists idx_goals_user          on goals(user_id);
create index if not exists idx_events_user         on events(user_id);
create index if not exists idx_term_spans_user     on term_spans(user_id);

-- RLS: a row is visible/writable only when app.user_id equals its user_id. The
-- handler runs `SET LOCAL app.user_id = <verified sub>` at the top of each
-- transaction. `force` subjects the table owner too. `current_setting(..., true)`
-- returns NULL when unset, so an un-scoped connection sees zero rows (safe default).
do $$
declare t text;
begin
  foreach t in array array['profiles','transactions','bills','income_sources','goals','events','term_spans'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$create policy %1$s_isolation on %1$I
      using (user_id = current_setting('app.user_id', true))
      with check (user_id = current_setting('app.user_id', true))$p$, t);
  end loop;
end $$;
```

- [ ] **Step 2: Commit**

```bash
git add schema.sql
git commit -m "feat(m6): normalized cloud-sync schema with composite PKs and RLS"
```

---

### Task 3: State ↔ rows serializer (`src/lib/state-serialize.js`)

**Files:**
- Create: `src/lib/state-serialize.js`
- Test: `src/lib/state-serialize.test.js`

**Interfaces:**
- Consumes: `CURRENT_VERSION` from `src/store/migrate.js`.
- Produces:
  - `stateToRows(state, userId)` → `{ profile, transactions, bills, income_sources, goals, events, term_spans }` where `profile = { user_id, balance, last_reconciled, survive_until, schema_version }` and each collection is an array of row objects that include `user_id`. Column names match `schema.sql` verbatim.
  - `rowsToState(rows)` → the client state object `{ version, balance, lastReconciled, surviveUntil, incomeSources, bills, goals, events, termSpans, transactions }`, with NUMERIC→`Number` and DATE→`'YYYY-MM-DD'` coercion and `[]` for empty collections.
  - `validateState(obj)` → returns `obj` or throws `Error` (finite `balance`, required arrays, row caps).

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/state-serialize.test.js
import { describe, it, expect } from 'vitest'
import { rowsToState, stateToRows, validateState } from './state-serialize.js'

const sample = {
  version: 3, balance: 512.4, lastReconciled: '2026-07-11', surviveUntil: '2026-09-01',
  incomeSources: [{ id: 'i1', label: 'Bar', kind: 'monthly', amount: 780, nextDate: '2026-07-25' }],
  bills: [{ id: 'b1', label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-07-30' }],
  goals: [{ id: 'g1', label: 'Trip', target: 600, saved: 180, deadline: '2026-10-01' }],
  events: [{ id: 'e1', label: 'Bday', amount: 55, date: '2026-07-18' }],
  termSpans: [{ id: 's1', kind: 'freshers', label: 'Freshers', start: '2026-09-16', end: '2026-09-22' }],
  transactions: [{ id: 't1', type: 'expense', label: 'Tesco', amount: 23.4, category: 'groceries', date: '2026-07-10' }],
}

describe('state-serialize', () => {
  it('round-trips a full state through rows and back unchanged', () => {
    expect(rowsToState(stateToRows(sample, 'u1'))).toEqual(sample)
  })

  // pg returns NUMERIC as a string ("512.40"); the engine needs real Numbers.
  it('coerces Postgres NUMERIC strings back to Number', () => {
    const rows = stateToRows(sample, 'u1')
    rows.profile.balance = '512.40'
    rows.transactions[0].amount = '23.40'
    const state = rowsToState(rows)
    expect(state.balance).toBe(512.4)
    expect(state.transactions[0].amount).toBe(23.4)
  })

  // pg returns DATE as a JS Date; the app speaks 'YYYY-MM-DD' strings everywhere.
  it('coerces a Postgres DATE (JS Date) back to a YYYY-MM-DD string', () => {
    const rows = stateToRows(sample, 'u1')
    rows.transactions[0].date = new Date('2026-07-10T00:00:00Z')
    expect(rowsToState(rows).transactions[0].date).toBe('2026-07-10')
  })

  // clearAll() omits surviveUntil entirely; treat missing as null both ways.
  it('treats a missing/undefined surviveUntil as null', () => {
    const cleared = { ...sample, surviveUntil: undefined }
    const rows = stateToRows(cleared, 'u1')
    expect(rows.profile.survive_until).toBeNull()
    expect(rowsToState(rows).surviveUntil).toBeNull()
  })

  // The app's `|| []` guards mean a missing collection is tolerated at runtime —
  // but hydration must always emit [], never undefined, or a fetch bug reads as
  // "data vanished" instead of an error.
  it('emits empty arrays (never undefined) for empty collections', () => {
    const empty = {
      version: 3, balance: 0, lastReconciled: '2026-07-01', surviveUntil: null,
      incomeSources: [], bills: [], goals: [], events: [], termSpans: [], transactions: [],
    }
    const state = rowsToState(stateToRows(empty, 'u1'))
    expect(state.bills).toEqual([])
    expect(state.transactions).toEqual([])
  })

  it('validateState rejects a non-finite balance', () => {
    expect(() => validateState({ ...sample, balance: NaN })).toThrow()
  })

  it('validateState rejects a non-array collection', () => {
    expect(() => validateState({ ...sample, bills: {} })).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/state-serialize.test.js`
Expected: FAIL — `Failed to resolve import "./state-serialize.js"` / functions not defined.

- [ ] **Step 3: Write the implementation**

```js
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
  if ('termSpans' in obj && !Array.isArray(obj.termSpans)) throw new Error('Invalid state: termSpans must be an array')
  return obj
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/state-serialize.test.js`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state-serialize.js src/lib/state-serialize.test.js
git commit -m "feat(m6): pure state<->rows serializer with numeric/date coercion + validation"
```

---

### Task 4: Request core with injected DB + verifier (`src/lib/state-api.js`)

**Files:**
- Create: `src/lib/state-api.js`
- Test: `src/lib/state-api.test.js`

**Interfaces:**
- Consumes: `migrate` from `src/store/migrate.js`; `rowsToState`, `stateToRows`, `validateState` from `./state-serialize.js` (Task 3).
- Produces: `handleState(req, deps) → Promise<{ status, body }>` where
  - `req = { method, headers, body }` (`body` for PUT is `{ state, baseUpdatedAt }`),
  - `deps = { db, verifyToken, secretKey, authorizedParties }` (`db` is a node-postgres-compatible pool with `.connect()` → client `.query()/.release()`),
  - GET returns `{ status: 200, body: null }` for an empty account, else `{ status: 200, body: { state, updatedAt } }`; PUT returns `{ status: 200, body: { updatedAt } }`, `409` on a stale write, `400` on an invalid body; missing/invalid token → `401`; other methods → `405`.

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/state-api.test.js
import { describe, it, expect } from 'vitest'
import { handleState } from './state-api.js'

// Programmable fake of a node-postgres Pool/Client — no DB, no network.
// `responder(text, params, calls)` returns { rows } per query; default { rows: [] }.
function fakePool(responder) {
  const calls = []
  const client = {
    query: async (text, params) => {
      const norm = String(text).replace(/\s+/g, ' ').trim()
      calls.push({ text: norm, params })
      return responder(norm, params, calls) || { rows: [] }
    },
    release: () => { calls.push({ text: 'RELEASE', params: null }) },
  }
  return { pool: { connect: async () => client, end: async () => {} }, calls }
}

const okState = () => ({
  version: 3, balance: 100, lastReconciled: '2026-07-01', surviveUntil: null,
  incomeSources: [], bills: [], goals: [], events: [], termSpans: [], transactions: [],
})
const deps = (pool, over = {}) => ({
  db: pool, verifyToken: async () => ({ sub: 'u1' }), secretKey: 'sk', authorizedParties: [], ...over,
})

describe('handleState', () => {
  it('rejects a request with no bearer token (401)', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState({ method: 'GET', headers: {}, body: null }, deps(pool))
    expect(res.status).toBe(401)
  })

  it('rejects an invalid token (401)', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState(
      { method: 'GET', headers: { authorization: 'Bearer bad' }, body: null },
      deps(pool, { verifyToken: async () => { throw new Error('bad token') } }),
    )
    expect(res.status).toBe(401)
  })

  it('GET returns null body for an account with no profile row', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState({ method: 'GET', headers: { authorization: 'Bearer ok' }, body: null }, deps(pool))
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('GET assembles rows into a coerced state object with updatedAt', async () => {
    const { pool } = fakePool((text) => {
      if (text.includes('FROM profiles')) {
        return { rows: [{ user_id: 'u1', balance: '512.40', last_reconciled: '2026-07-01', survive_until: null, schema_version: 3, updated_at: '2026-07-10T00:00:00Z' }] }
      }
      if (text.includes('FROM transactions')) {
        return { rows: [{ id: 't1', user_id: 'u1', type: 'expense', label: 'Tesco', amount: '23.40', category: 'groceries', date: '2026-07-01' }] }
      }
      return { rows: [] }
    })
    const res = await handleState({ method: 'GET', headers: { authorization: 'Bearer ok' }, body: null }, deps(pool))
    expect(res.status).toBe(200)
    expect(res.body.state.balance).toBe(512.4)
    expect(res.body.state.transactions[0].amount).toBe(23.4)
    expect(res.body.updatedAt).toBe('2026-07-10T00:00:00Z')
  })

  it('PUT replaces state and COMMITs, returning the new updatedAt', async () => {
    const { pool, calls } = fakePool((text) => {
      if (text.startsWith('SELECT updated_at FROM profiles')) return { rows: [] } // new account
      if (text.startsWith('INSERT INTO profiles')) return { rows: [{ updated_at: '2026-07-13T00:00:00Z' }] }
      return { rows: [] }
    })
    const res = await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: okState(), baseUpdatedAt: null } },
      deps(pool),
    )
    expect(res.status).toBe(200)
    expect(res.body.updatedAt).toBe('2026-07-13T00:00:00Z')
    const texts = calls.map((c) => c.text)
    expect(texts).toContain('COMMIT')
    expect(texts).not.toContain('ROLLBACK')
  })

  // The recency guard: a write whose baseUpdatedAt no longer matches the stored
  // row is a stale device/tab — reject rather than silently clobber a newer edit.
  it('PUT rejects a stale write with 409 and ROLLBACK', async () => {
    const { pool, calls } = fakePool((text) => {
      if (text.startsWith('SELECT updated_at FROM profiles')) return { rows: [{ updated_at: '2026-07-13T10:00:00Z' }] }
      return { rows: [] }
    })
    const res = await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: okState(), baseUpdatedAt: '2026-07-13T09:00:00Z' } },
      deps(pool),
    )
    expect(res.status).toBe(409)
    expect(calls.map((c) => c.text)).toContain('ROLLBACK')
  })

  it('PUT rejects an invalid state body with 400', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: { balance: 'nope' }, baseUpdatedAt: null } },
      deps(pool),
    )
    expect(res.status).toBe(400)
  })

  // user_id must come from the verified token, never the body.
  it('scopes every query to the token user_id, ignoring a user_id in the body', async () => {
    const { pool, calls } = fakePool((text) => {
      if (text.startsWith('SELECT updated_at FROM profiles')) return { rows: [] }
      if (text.startsWith('INSERT INTO profiles')) return { rows: [{ updated_at: 'x' }] }
      return { rows: [] }
    })
    await handleState(
      { method: 'PUT', headers: { authorization: 'Bearer ok' }, body: { state: okState(), baseUpdatedAt: null, user_id: 'attacker' } },
      deps(pool, { verifyToken: async () => ({ sub: 'real-user' }) }),
    )
    const paramsUsed = calls.flatMap((c) => c.params || [])
    expect(paramsUsed).toContain('real-user')
    expect(paramsUsed).not.toContain('attacker')
  })

  it('rejects an unsupported method (405)', async () => {
    const { pool } = fakePool(() => ({ rows: [] }))
    const res = await handleState({ method: 'DELETE', headers: { authorization: 'Bearer ok' }, body: null }, deps(pool))
    expect(res.status).toBe(405)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/state-api.test.js`
Expected: FAIL — `Failed to resolve import "./state-api.js"`.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/state-api.js
// Core GET/PUT logic for /api/state, with the DB pool and token verifier INJECTED
// (same seam as src/lib/llm.js's fetchImpl) so it is unit-tested offline.
// user_id ALWAYS comes from the verified token, never the request body.
import { migrate } from '../store/migrate.js'
import { rowsToState, stateToRows, validateState } from './state-serialize.js'

const NUMERIC = new Set(['amount', 'target', 'saved'])
const DATE = new Set(['date', 'next_due', 'next_date', 'deadline', 'start', 'end'])
const castFor = (col) => (col === 'user_id' ? 'text' : NUMERIC.has(col) ? 'numeric' : DATE.has(col) ? 'date' : 'text')

const CHILD = {
  transactions: ['id', 'type', 'label', 'amount', 'category', 'date'],
  bills: ['id', 'label', 'amount', 'freq', 'next_due'],
  income_sources: ['id', 'label', 'kind', 'amount', 'next_date'],
  goals: ['id', 'label', 'target', 'saved', 'deadline'],
  events: ['id', 'label', 'amount', 'date'],
  term_spans: ['id', 'kind', 'label', 'start', 'end'],
}

function bearer(headers) {
  const h = (headers && (headers.authorization || headers.Authorization)) || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

export async function handleState(req, deps) {
  const token = bearer(req.headers)
  if (!token) return { status: 401, body: { error: 'Missing token' } }
  let userId
  try {
    const claims = await deps.verifyToken(token, { secretKey: deps.secretKey, authorizedParties: deps.authorizedParties })
    userId = claims && claims.sub
  } catch {
    return { status: 401, body: { error: 'Invalid token' } }
  }
  if (!userId) return { status: 401, body: { error: 'Invalid token' } }

  if (req.method === 'GET') return getState(userId, deps.db)
  if (req.method === 'PUT') return putState(userId, req.body, deps.db)
  return { status: 405, body: { error: 'GET or PUT only' } }
}

async function getState(userId, db) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId])
    const q = (sql) => client.query(sql, [userId])
    const profile = await q('SELECT * FROM profiles WHERE user_id = $1')
    if (!profile.rows.length) {
      await client.query('COMMIT')
      return { status: 200, body: null }
    }
    const transactions = await q('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC')
    const bills = await q('SELECT * FROM bills WHERE user_id = $1')
    const income_sources = await q('SELECT * FROM income_sources WHERE user_id = $1')
    const goals = await q('SELECT * FROM goals WHERE user_id = $1')
    const events = await q('SELECT * FROM events WHERE user_id = $1')
    const term_spans = await q('SELECT * FROM term_spans WHERE user_id = $1')
    await client.query('COMMIT')
    const state = migrate(rowsToState({
      profile: profile.rows[0],
      transactions: transactions.rows, bills: bills.rows, income_sources: income_sources.rows,
      goals: goals.rows, events: events.rows, term_spans: term_spans.rows,
    }))
    return { status: 200, body: { state, updatedAt: profile.rows[0].updated_at } }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    return { status: 500, body: { error: String((e && e.message) || e) } }
  } finally {
    client.release()
  }
}

async function putState(userId, body, db) {
  let state
  try {
    state = validateState(migrate((body && body.state) || {}))
  } catch (e) {
    return { status: 400, body: { error: String((e && e.message) || e) } }
  }
  const baseUpdatedAt = body && body.baseUpdatedAt != null ? String(body.baseUpdatedAt) : null
  const rows = stateToRows(state, userId)

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId])

    const cur = await client.query('SELECT updated_at FROM profiles WHERE user_id = $1', [userId])
    if (cur.rows.length && baseUpdatedAt !== null && String(cur.rows[0].updated_at) !== baseUpdatedAt) {
      await client.query('ROLLBACK')
      return { status: 409, body: { error: 'stale', currentUpdatedAt: cur.rows[0].updated_at } }
    }

    const upserted = await client.query(
      `INSERT INTO profiles (user_id, balance, last_reconciled, survive_until, schema_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET
         balance = EXCLUDED.balance, last_reconciled = EXCLUDED.last_reconciled,
         survive_until = EXCLUDED.survive_until, schema_version = EXCLUDED.schema_version, updated_at = now()
       RETURNING updated_at`,
      [userId, rows.profile.balance, rows.profile.last_reconciled, rows.profile.survive_until, rows.profile.schema_version],
    )

    for (const table of Object.keys(CHILD)) {
      await replaceCollection(client, table, CHILD[table], rows[table], userId)
    }

    await client.query('COMMIT')
    return { status: 200, body: { updatedAt: upserted.rows[0].updated_at } }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    return { status: 500, body: { error: String((e && e.message) || e) } }
  } finally {
    client.release()
  }
}

// Delete the user's rows for one table, then bulk-insert via unnest() — one
// parameterized statement regardless of row count (N=0 short-circuits). Table
// and column names come from the fixed CHILD map, never client input.
async function replaceCollection(client, table, cols, rows, userId) {
  await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId])
  if (!rows.length) return
  const allCols = ['user_id', ...cols]
  const arrays = allCols.map((c) => rows.map((r) => (c === 'user_id' ? userId : r[c] ?? null)))
  const casts = allCols.map((c, i) => `$${i + 1}::${castFor(c)}[]`)
  await client.query(
    `INSERT INTO ${table} (${allCols.join(', ')}) SELECT * FROM unnest(${casts.join(', ')})`,
    arrays,
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/state-api.test.js`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state-api.js src/lib/state-api.test.js
git commit -m "feat(m6): /api/state core logic (auth, validate, migrate, atomic replace, 409 recency)"
```

---

### Task 5: Serverless wrapper (`api/state.js`)

**Files:**
- Create: `api/state.js`

**Interfaces:**
- Consumes: `handleState` from `src/lib/state-api.js` (Task 4); `Pool` from `@neondatabase/serverless`; `verifyToken` from `@clerk/backend`; env `DATABASE_URL`, `CLERK_SECRET_KEY`, `APP_ORIGINS`.
- Produces: a Vercel function serving `GET/PUT /api/state`, same `handler(req, res)` shape as `api/extract.js`.

> No new unit test — the logic is already covered in Task 4; this wrapper is exercised live in Task 6.

- [ ] **Step 1: Write the wrapper**

```js
// api/state.js
// Serverless: cloud state GET/PUT. Thin wrapper — all logic + tests live in
// src/lib/state-api.js (injectable), the same split as api/extract.js -> src/lib/llm.js.
import { Pool } from '@neondatabase/serverless'
import { verifyToken } from '@clerk/backend'
import { handleState } from '../src/lib/state-api.js'

export default async function handler(req, res) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { status, body } = await handleState(
      { method: req.method, headers: req.headers, body: req.body },
      {
        db: pool,
        verifyToken,
        secretKey: process.env.CLERK_SECRET_KEY,
        authorizedParties: (process.env.APP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
      },
    )
    return res.status(status).json(body)
  } finally {
    await pool.end()
  }
}
```

- [ ] **Step 2: Verify it loads under the dev server**

Run: `npm run dev`, then in another shell: `curl -i -X GET http://localhost:5173/api/state`
Expected: HTTP `401` with `{"error":"Missing token"}` (no token supplied — proves the route resolves, imports load, and auth rejects). Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add api/state.js
git commit -m "feat(m6): /api/state serverless wrapper wiring Neon Pool + Clerk verifyToken"
```

---

### Task 6: Provision Neon + Clerk and prove the spine end-to-end (DoD gate)

> **Requires Sam's Vercel/Neon/Clerk accounts** — this is the manual Definition-of-Done gate. Agents cannot click through the Marketplace; do the code (Tasks 1–5) first, then Sam (or a session with `vercel` CLI auth) runs this. **M6 is not done until Step 6 passes.**

**Files:**
- Create: `scripts/smoke-state.mjs`

- [ ] **Step 1: Provision (Vercel Marketplace)**
  1. `vercel link` the repo to the existing project.
  2. Marketplace → install **Neon** → connect to project (Dev/Preview/Prod; enable preview branching). Injects `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED`.
  3. Integrations → install **Clerk** → connect. Injects `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
  4. Add `APP_ORIGINS` (prod + preview origins, comma-separated) to the project env.
  5. `vercel env pull .env.local --yes`; confirm `DATABASE_URL`, `CLERK_SECRET_KEY`, `APP_ORIGINS` via `vercel env ls` (names only — never echo values).

- [ ] **Step 2: Apply the schema**

Run: `psql "$DATABASE_URL_UNPOOLED" -f schema.sql` (or paste `schema.sql` into the Neon SQL editor).
Expected: all 7 tables, indexes, and policies created with no error.

- [ ] **Step 3: Write the smoke script**

```js
// scripts/smoke-state.mjs — run:  BASE=http://localhost:5173 TOKEN=<clerk test jwt> node scripts/smoke-state.mjs
const BASE = process.env.BASE || 'http://localhost:5173'
const TOKEN = process.env.TOKEN
if (!TOKEN) { console.error('Set TOKEN to a Clerk test-mode session JWT'); process.exit(1) }
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) })

const empty = await j(await fetch(`${BASE}/api/state`, { headers: H }))
console.log('GET (fresh):', empty.status, empty.body)

const state = {
  version: 3, balance: 200.5, lastReconciled: '2026-07-13', surviveUntil: null,
  incomeSources: [], bills: [{ id: 'b1', label: 'Rent', amount: 480, freq: 'monthly', nextDue: '2026-07-30' }],
  goals: [], events: [], termSpans: [],
  transactions: [{ id: 't1', type: 'expense', label: 'Tesco', amount: 23.4, category: 'groceries', date: '2026-07-12' }],
}
const put = await j(await fetch(`${BASE}/api/state`, { method: 'PUT', headers: H, body: JSON.stringify({ state, baseUpdatedAt: null }) }))
console.log('PUT:', put.status, put.body)

const back = await j(await fetch(`${BASE}/api/state`, { headers: H }))
console.log('GET (after):', back.status)
const ok = back.body?.state?.balance === 200.5 && back.body?.state?.bills?.[0]?.amount === 480 && back.body?.state?.transactions?.[0]?.amount === 23.4
console.log(ok ? 'SMOKE PASS ✅ (numeric coercion + round-trip verified)' : 'SMOKE FAIL ❌')
process.exit(ok ? 0 : 1)
```

- [ ] **Step 4: Run the smoke against local dev**

Run: `npm run dev`, then `BASE=http://localhost:5173 TOKEN=<clerk test jwt> node scripts/smoke-state.mjs`
Expected: `GET (fresh): 200 null` → `PUT: 200 { updatedAt }` → `SMOKE PASS ✅`.

- [ ] **Step 5: Verify cross-user isolation (RLS + WHERE)**

With a **second** user's token, `GET /api/state` must return `null` (not the first user's data), and a `PUT` must not touch the first user's rows. If RLS misbehaves over the pooled connection (PgBouncer + `SET LOCAL`), the app-level `WHERE user_id` already isolates users — keep RLS in `schema.sql` as the deploy-time backstop and note the pooled-`SET LOCAL` result for M7.

- [ ] **Step 6: Prove it on a preview deployment**

Run: `vercel` (preview deploy), then run the smoke script with `BASE=<preview-url>`.
Expected: `SMOKE PASS ✅` against the deployed function — **M6 Definition of Done met.**

- [ ] **Step 7: Commit**

```bash
git add scripts/smoke-state.mjs
git commit -m "test(m6): live GET->PUT->GET smoke script for the cloud-sync spine"
```

---

## Self-Review (completed)

- **Spec coverage:** schema (Task 2) ✓; `api/state.js` GET/PUT + auth + `authorizedParties` + `migrate()` server-side + `sql`-transaction atomicity + 409 recency + `unnest` bulk-insert (Task 4) ✓; RLS + composite PK (Task 2) ✓; strict validation reusing `parseBackup` discipline (Task 3) ✓; DI test seam like `llm.js` (Task 4) ✓; dev env wiring + Node pin + deps (Task 1) ✓; live GET→PUT→GET DoD (Task 6) ✓; zero client change (constraint, no client files touched) ✓. Secret hygiene (rotate Groq, CI secret-scan) and rate limiting are tracked in the spec as separate hardening items, intentionally **not** in M6's critical path.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** column names in `schema.sql` (Task 2), `stateToRows`/`rowsToState` (Task 3), and the `CHILD` map + SQL (Task 4) all use the same snake_case names (`next_due`, `next_date`, `survive_until`, `term_spans`, `"end"`). `handleState(req, deps)` signature matches between Task 4's definition and Task 5's call.

## Known verify-at-integration points (not blockers)
- RLS via `SET LOCAL app.user_id` over the **pooled** Neon connection (PgBouncer transaction mode) — verified in Task 6 Step 5; app-level `WHERE user_id` + composite PK isolate users regardless.
- Confirm the installed `@clerk/backend` `verifyToken` and `@neondatabase/serverless` `Pool` signatures match the code at install time (both context7-verified during design).
