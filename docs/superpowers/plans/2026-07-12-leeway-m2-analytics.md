# Leeway M2 — Analytics ("Insights") Implementation Plan

> **For agentic workers:** execute task-by-task with TDD. The design contract is the spec
> (`docs/superpowers/specs/2026-07-12-leeway-m2-analytics-design.md`); the test file is the
> executable spec. Steps use `- [ ]` tracking.

**Goal:** An "Insights" screen showing deterministic spending analytics + cut-back signals, all computed in a pure, unit-tested engine module with no backend.

**Architecture:** `src/engine/analytics.js` (pure) computes every number; `src/components/charts.jsx` holds hand-built CSS/SVG chart primitives; `src/components/Insights.jsx` composes them; Nav + App wire the new view.

**Tech Stack:** React 18 (JSX), Vite, Vitest (`node`). No new dependencies.

## Global Constraints

- Plain JS/JSX; tests under `src/**/*.test.{js,jsx}`; run `npm test`.
- Reuse date helpers (`toDate`, `daysBetween`, `addDays`) exported from `src/engine/finance.js` and `typeOf`/`categoryLabel` from `src/lib/categories.js`. Do not duplicate them.
- "Non-fixed spend" = expense with `typeOf(category)` in {`variable`,`discretionary`}.
- All functions guard empty data / divide-by-zero (return 0 or null, never NaN/Infinity).
- Charts hand-built, no chart library; colours per the dataviz skill.
- Existing 41 tests stay green. One commit per task, Co-Authored-By trailer.

---

### Task 1: Analytics engine — period, total, by-category

**Files:** Create `src/engine/analytics.js`, `src/engine/analytics.test.js`.

**Produces:** `periodRange(key, asOf)`, `totalSpend(txns, from, to)`, `spendByCategory(txns, from, to)` (signatures per spec §Engine API).

- [ ] Write `analytics.test.js` covering: `periodRange('month', asOf)` returns 1st→last of that month; `periodRange('last30')` spans 30 inclusive days; `totalSpend` sums only expenses in-window; `spendByCategory` groups, sorts desc, computes `pct` and `count`, ignores income and out-of-window txns.
- [ ] Run `npx vitest run src/engine/analytics.test.js` → fails (module missing).
- [ ] Implement the three functions in `analytics.js`.
- [ ] Run → pass. Then `npm test` → all green.
- [ ] Commit: `feat: add analytics period/total/by-category engine`.

### Task 2: Analytics engine — weekend split, weekly trend, biggest mover

**Files:** Modify `analytics.js` + `analytics.test.js`.

**Produces:** `weekendSplit(txns, from, to)`, `weeklyTrend(txns, asOf)`, `biggestMover(txns, asOf)`.

- [ ] Add tests: weekend/weekday per-day divides by the right day-count (build a fixed window with known Sat/Sun); `weeklyTrend` computes thisWeek/lastWeek/fourWeekAvg and `vsAvgPct` (and `null` avg when no history); `biggestMover` picks the category with the largest week-over-week rise, `null` when flat/empty.
- [ ] Run new tests → fail → implement → pass → `npm test` green.
- [ ] Commit: `feat: add weekend-split, weekly-trend, biggest-mover analytics`.

### Task 3: Analytics engine — recurring/leaks, projection, cost-to-goal

**Files:** Modify `analytics.js` + `analytics.test.js`.

**Produces:** `recurringSpends(txns, from, to, opts)`, `projectedMonthEnd(txns, asOf)`, `costToGoal(spend, goalWeeklyRequired)`.

- [ ] Add tests: `recurringSpends` keeps only non-fixed categories with `count >= minCount`, sorted by total, with `avgEach`; `projectedMonthEnd` extrapolates soFar/daysElapsed × daysInMonth; `costToGoal` returns spend/weeklyRequired and `0` when weeklyRequired ≤ 0.
- [ ] Run → fail → implement → pass → `npm test` green.
- [ ] Commit: `feat: add leaks, month-end projection, cost-to-goal analytics`.

### Task 4: Chart primitives

**Files:** Create `src/components/charts.jsx`; modify `src/index.css`.

**Produces:** `<BarRow label total pct tone />` (horizontal proportional bar) and `<SplitBar a b aLabel bLabel />` (two-value comparison), presentational only.

- [ ] **Invoke the dataviz skill** before writing chart code; pick tones from its palette that fit Leeway's indigo/calm theme and read in the existing light UI.
- [ ] Implement the primitives + minimal CSS (`.bar-row`, `.bar-track`, `.bar-fill`, tone classes). Reuse existing `--brand`, `--go`, `--tight` vars where possible.
- [ ] Verify `npm run build` succeeds. Commit: `feat: add hand-built chart primitives for insights`.

### Task 5: Insights screen + navigation

**Files:** Create `src/components/Insights.jsx`; modify `src/components/Nav.jsx` (add item), `src/App.jsx` (wire `insights` view), `src/index.css` (card layout).

**Produces:** the "Insights" screen composing Task 1-4 output into the 6 cards (spec §Screen), with graceful empty states.

- [ ] Build `Insights.jsx` with the period toggle + 6 cards; every card guards thin data.
- [ ] Add `{ key: 'insights', label: 'Insights', short: 'Insights', Icon: <something> }` to Nav `ITEMS` (reuse an existing icon or add one to `icons.jsx`); render `<Insights />` for `view === 'insights'` in `App.jsx`.
- [ ] `npm test` green; `npm run build` clean. Commit: `feat: add Insights analytics screen`.

### Task 6: Verify end-to-end

- [ ] `npm run dev`; drive the app: open Insights from the demo seed → bars render with real £/%, trend/weekend/leaks/cost-to-goal populated, **zero console errors**. Toggle This month/Last 30 days. Check an empty state by clearing data.
- [ ] Screenshot for the record.

## Self-Review

- Spec engine API §: Tasks 1-3 cover every function. ✔
- Screen §: Task 5 covers all 6 cards + empty states. ✔
- Charts hand-built, dataviz applied: Task 4. ✔
- No-regression + purity + guards: constraints + Task 1-3 tests. ✔
