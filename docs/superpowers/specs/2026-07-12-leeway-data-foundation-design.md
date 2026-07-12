# Leeway — Student Tailoring: Roadmap + Milestone 1 Design

Status: Approved (verbal, 2026-07-12) — building M1
Owner: Sam (011-sam-110), sole user + builder

## Context

Leeway is a client-side React SPA that turns a UK student's messy finances into a single
trusted "safe-to-spend" number (see `README.md`, `DrunkenGeneratedPRD.md`, `transcript.txt`).
The engine (`src/engine/finance.js`) is strong and unit-tested. The gap: the app shipped the
*trusted-number* half of the vision and none of the *insight* half — the analytics/tips screen
that was the founding idea and is the client's headline ask.

Goal of this effort: tailor Leeway to students well, and build the insight half — without
breaking the engine's trustworthiness.

## Roadmap (5 milestones, dependency-ordered)

| # | Milestone | Delivers | Depends on |
|---|-----------|----------|------------|
| 1 | **Data foundation** | Rich student categories + schema migration + export/import | — |
| 2 | **Analytics screen (deterministic)** | Spend-by-category, week-vs-average, biggest mover, leak detection, weekday/weekend split, projected month-end, cost-to-goal | M1 |
| 3 | **AI cut-back tips (Gemini)** | Vercel serverless fn: engine computes numbers, Gemini writes tips; key server-side | M2 |
| 4 | **Loan-survival mode** | Model a loan drop lasting to a date → safe daily rate for the whole term, weekends weighted | M1 |
| 5 | **Spending calendar** | Upgrade "Planned" into a calendar: per-day expected spend, Freshers/exam pre-loads, plan-ahead reserving | M4 |

Small UX fixes (snooze-a-goal, "What can I spend?" vs "Can I spend?" IA redundancy, empty
desktop layouts) fold into whichever milestone touches that screen — not a separate pass.

Each milestone gets its own spec → plan → TDD implementation → review cycle. This document
covers M1 in detail; later milestones are specced just-in-time.

### Architecture note for later milestones

Deterministic charts (M2) need **no backend** — they compute in the engine and render offline.
AI tips (M3) require a secret API key, which cannot live in the browser, so M3 introduces
Leeway's first backend: a single Vercel serverless function under `/api/`. The key lives in
`.env.local` (already gitignored via `*.local`) locally and as a Vercel env var in production.
The LLM never does arithmetic — the engine computes every figure and hands the model a compact
JSON summary to phrase. Provider-agnostic wrapper so the Gemini credential can be swapped/verified.

---

## Milestone 1 — Data Foundation (this milestone)

### Purpose

Give Leeway a data model rich enough to analyse, and make a real user's data portable and safe.
Unblocks M2's analytics (charts on `Fixed/Variable/Fun` tags produce no insight) and removes the
"clear browser → everything gone" risk.

### 1. Category model

Replace the hand-picked `fixed | variable | discretionary` expense tag with a student-facing
**category**, and *derive* the engine's spending `type` from it via a lookup table. The engine's
run-rate logic keeps working because it will read the derived type, not the raw tag.

**Categories (student-facing):**
Groceries · Eating out · Going out · Transport · Coffee & snacks · Shopping · Subscriptions ·
Bills · Rent · Health · Course/Books · Other

**Category → engine type map (`CATEGORY_TYPE`):**

- `fixed`: Rent, Bills, Subscriptions
- `variable`: Groceries, Transport, Health, Course/Books
- `discretionary`: Eating out, Going out, Coffee & snacks, Shopping, Other

Canonical category keys are stable slugs (e.g. `eating_out`, `going_out`, `coffee`) with a
display label + emoji/colour for the UI. A single source of truth module
(`src/lib/categories.js`) exports the list, the type map, and a `typeOf(category)` helper.

Engine change: `computeDashboard`'s run-rate filter switches from
`t.category === 'variable' || t.category === 'discretionary'` to `typeOf(t.category)` being
variable/discretionary. Bills/income keep their existing shape (untouched).

### 2. Schema migration

- Bump `state.version` (1 → 2).
- Add a `migrate(state)` runner in `src/store/store.js` invoked in `load()`. Version 1 → 2 maps
  each existing transaction's old tag to a new category:
  - `fixed` → `bills`
  - `variable` → `groceries`
  - `discretionary` → `other`
  (Best-effort; the user can re-tag. The point is no data loss and no crash on old localStorage.)
- Migration is pure and unit-tested. Unknown/newer versions pass through untouched.
- Seed data (`src/store/seed.js`) updated to use the new category keys directly (version 2).

### 3. Export / Import

- **Export:** a button that serialises the full `state` to a downloaded JSON file
  (`leeway-backup-YYYY-MM-DD.json`), including `version`.
- **Import:** a file picker that reads a JSON file, runs it through `migrate()`, validates it has
  the expected top-level keys, and replaces state (with a confirm step, since it overwrites).
- Lives in a small **Settings/Data** surface reachable from the nav footer (near "Reset demo
  data"). No backend; pure client download/upload.
- Malformed import → friendly error, state unchanged.

### 4. Tests (TDD, extend `src/engine/finance.test.js` + new `categories`/`store` tests)

- `typeOf()` returns correct type for every category key.
- Run-rate still counts variable+discretionary spend after the category switch (regression).
- `migrate()` v1→v2 maps old tags correctly and is idempotent on v2 input.
- Import validation rejects malformed objects without throwing.

### Out of scope for M1

- Any charts/analytics UI (that's M2).
- Cloud sync / accounts (revisit ~M3 when a backend exists; export/import covers safety for now).
- Editing the category of an already-logged transaction (nice-to-have; can add if cheap).

### Success criteria

- Every expense carries a real student category; the engine's numbers are unchanged for
  equivalent data (verified by the regression test).
- Opening the app with existing v1 localStorage data upgrades cleanly, no wipe, no crash.
- User can export their data and re-import it to restore state.
- All existing engine tests still pass; new tests green.
