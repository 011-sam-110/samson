# Leeway M2 — Analytics ("Insights") Screen Design

Status: Approved (verbal, 2026-07-12) — building M2
Depends on: M1 (rich categories) — done, on main.

## Context

The insight half of Leeway — the founding idea and the client's headline ask: a screen that
graphically shows spending and surfaces what to cut. M1 gave every spend a real category; M2
turns that into charts + deterministic insights. All maths is pure and unit-tested; **no backend**
(the charts work offline). This also builds the "what do I spend on consistently" detection that
the M3 statement-import feature will feed.

## Updated roadmap (reflecting the new statement-import idea)

| # | Milestone | Delivers | Status |
|---|-----------|----------|--------|
| 1 | Data foundation | Categories + migration + export/import | ✅ done (main) |
| 2 | **Analytics ("Insights")** | Deterministic charts + insights (this doc) | 🔨 building |
| 3 | **AI features (Gemini backend)** | **(a) Bank-screenshot import** (Gemini vision → review → import) + **(b) cut-back tips**. Shared serverless endpoint; key server-side. | next |
| 4 | Loan-survival mode | Loan drop lasting to a date → safe daily rate for the term | later |
| 5 | Spending calendar | Freshers/exam-aware calendar, plan-ahead reserving | later |

M3 reframed from "AI tips" to "AI features": statement-import first (higher value — kills manual
logging), then tips. Both use one Gemini serverless function. Caveats locked in: **review before
import** (never blind-trust OCR into the safe-to-spend number) and **privacy** (screenshots leave
the device to Google's API).

## M2 architecture

- New pure module `src/engine/analytics.js` — all computations, reusing date helpers from
  `finance.js` and `typeOf`/`categoryLabel` from `lib/categories.js`. Unit-tested in
  `src/engine/analytics.test.js`.
- New screen `src/components/Insights.jsx` — composes the engine output into cards.
- Small presentational chart primitives in `src/components/charts.jsx` (hand-built CSS/SVG bars —
  no chart library, matching the existing Gauge aesthetic). Chart colours follow the dataviz skill.
- Nav entry "Insights" added to `src/components/Nav.jsx`; view wired in `src/App.jsx`.

"Non-fixed spend" throughout = expenses whose derived `typeOf` is `variable` or `discretionary`
(same basis as the dashboard run-rate). Fixed bills are excluded from pace/trend/leaks because they
don't flex week to week.

## Engine API (`src/engine/analytics.js`)

- `periodRange(key, asOf) => { from: Date, to: Date }` — `key` is `'month'` (calendar month of
  asOf) or `'last30'` (asOf-29 … asOf), inclusive.
- `totalSpend(transactions, from, to) => number` — sum of all expense amounts in `[from, to]`.
- `spendByCategory(transactions, from, to) => Array<{ key, label, type, total, count, pct }>` —
  expenses grouped by category, sorted by `total` desc; `pct` = share of total expense.
- `weekendSplit(transactions, from, to) => { weekdayPerDay, weekendPerDay, weekdayTotal,
  weekendTotal, weekdayCount, weekendCount }` — non-fixed spend; per-day divides by the count of
  that day-type in the window (Sat/Sun = weekend).
- `weeklyTrend(transactions, asOf) => { thisWeek, lastWeek, fourWeekAvg, vsAvgPct }` — non-fixed;
  thisWeek = last 7 days, lastWeek = the 7 before, fourWeekAvg = 28-day total ÷ 4. `vsAvgPct` is
  `(thisWeek - fourWeekAvg) / fourWeekAvg` (null if avg is 0).
- `biggestMover(transactions, asOf) => { key, label, thisWeek, prevWeek, delta } | null` — the
  non-fixed category with the largest week-over-week increase.
- `recurringSpends(transactions, from, to, { minCount = 3 } = {}) => Array<{ key, label, type,
  count, total, avgEach }>` — non-fixed categories appearing ≥ minCount times, sorted by total desc
  (the "small stuff adds up" leaks).
- `projectedMonthEnd(transactions, asOf) => { soFar, projected, daysElapsed, daysInMonth }` —
  non-fixed; `projected = soFar / daysElapsed × daysInMonth`.
- `costToGoal(spend, goalWeeklyRequired) => number` — weeks-equivalent = `spend /
  goalWeeklyRequired` (0 when weeklyRequired ≤ 0).

## Screen (`Insights.jsx`) — mobile-first card stack

1. **Header + period toggle** (This month / Last 30 days) with total spent.
2. **Where it goes** — ranked category bars (`spendByCategory`), £ + %.
3. **Trend** — `weeklyTrend`: this week vs 4-week average, up/down + delta; `biggestMover` line.
4. **Weekend effect** — `weekendSplit`: £/day weekday vs weekend.
5. **Leaks** — `recurringSpends`: "Coffee & snacks ×5 · £X", discretionary emphasised.
6. **Cost to a goal** — top discretionary category spend via `costToGoal` against the top goal:
   "£X on [category] this month = N weeks of your [goal] saving."

Empty/thin-data states: every card degrades gracefully (e.g. "Log a few more spends to see your
trend"). New users with < a week of data must not see NaN/Infinity.

## Out of scope for M2

- Any AI/Gemini (that's M3). Screenshot import (M3). Editing categories of past txns.
- The IA cleanup ("What can I spend?" vs "Can I spend?") — deferred to a later polish pass.

## Success criteria

- `analytics.js` is pure and fully unit-tested, including divide-by-zero / empty-data guards.
- Insights screen renders from the demo seed with real bars and numbers, zero console errors.
- No regression: existing 41 tests stay green; dashboard unchanged.
