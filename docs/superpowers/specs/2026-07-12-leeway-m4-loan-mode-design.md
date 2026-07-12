# Leeway M4 — Loan-Survival Mode ("Make it last") Design

Status: Design — building the engine; UI placement pending Sam's pick.
Depends on: M1 (done). Independent of M3.

## Context

The #1 student money event: a maintenance loan (£3-4k) lands ~3×/year and must last a whole
term until the next drop. Leeway's core window is "now → next paycheck," which doesn't fit a lump
that must stretch for months. Loan-survival mode reframes the safe-to-spend maths over a long,
user-set horizon, with optional weekend weighting so the rate feels livable (spend a bit more at
weekends, less midweek — same total).

## Engine (pure, unit-tested) — `src/engine/finance.js` addition

Add `survivalPlan(state, asOf)` reusing the existing reserve logic, but with the window running
`now → state.surviveUntil` (an ISO date the money must last until) instead of next payday.

- If `state.surviveUntil` is unset/past → returns `{ active: false }`.
- Window: `daysLeft = daysBetween(asOf, surviveUntil)` (min 1).
- Pool: `balance + income arriving in window − bills reserved in window − goals reserved for window`
  (same reserve maths as `computeDashboard`, over the long window). Events also reserved.
- `flatDaily = pool / daysLeft`.
- **Weekend weighting** (factor `w`, default 1.5): solve so weekends get `w×` a weekday, same total.
  `weekdayCount`/`weekendCount` = day-types between now and surviveUntil.
  `weekdayRate = pool / (weekdayCount + w × weekendCount)`; `weekendRate = w × weekdayRate`.
- `status`: `'short'` if pool < 0 (with `shortfall`), else `'ok'`.
- Returns `{ active, daysLeft, surviveUntil, pool, flatDaily, weekdayRate, weekendRate,
  weekdayCount, weekendCount, status, shortfall }`.

State: add optional `surviveUntil` (ISO date | null) + a store action `setSurviveUntil(date)`.
Migration: not needed (absent field defaults to null; engine guards it).

## UI — placement is Sam's call (see question)

Two candidate homes for the "Make it last" view (same engine either way):
- **A. Today-screen mode** — when `surviveUntil` is set, the Today screen gains a "Make it last"
  card under the gauge (£/day for the whole stretch + weekday/weekend split). No new nav item.
- **B. Dedicated screen** — a 7th nav entry "Make it last" with its own setup + readout.

Recommendation: **A** (no nav bloat; it's the same safe-to-spend idea over a longer horizon).

Setup flow (either way): "Got a lump that needs to last? Enter the date it needs to see you to."
→ sets `surviveUntil`. A weekend-weighting toggle (flat vs weighted).

## Out of scope for M4

- A full "loan" entity with drip schedule (the survive-until date + current balance is enough).
- Term-calendar awareness (that's M5). AI (M3).

## Success criteria

- `survivalPlan` is pure + unit-tested: flat rate, weekend-weighted split sums back to pool,
  short state, inactive when unset. Existing tests stay green.
- The chosen UI renders a believable £/day-for-the-term from a set survive-until date.
