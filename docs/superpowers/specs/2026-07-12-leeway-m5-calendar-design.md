# Leeway M5 — Spending Calendar (Freshers/exam-aware, plan-ahead) Design

Status: Approved — ready for implementation plan.
Depends on: M1 (data foundation), M2 (analytics helpers). Independent of M3 (AI). Builds on the
teammate's palette/theme now on `main`.

## Context

M5 is the last milestone on the roadmap. It turns the existing **"Planned"** tab from a flat list
of upcoming events into a **month calendar** that does three jobs at once:

1. **Looks back** — a heatmap of what was actually spent each day, so the month's rhythm is visible
   at a glance (quiet weeks vs blow-out weekends).
2. **Looks ahead** — upcoming bills and planned events sit on future days, so nothing lands by
   surprise.
3. **Is student-aware** — the user marks their own **Freshers week, exam period(s), and term
   start/end**; the calendar highlights those spans and gives a plain-English, plan-ahead nudge
   ("Freshers starts Monday — cap the big nights so the rest of the month survives"; "Exams next
   week — a quiet, cheap stretch, bank the difference").

Everything is **offline and deterministic**. No AI, no external term-date dataset. Numbers are
computed in a pure engine; nudge wording is templated from those numbers — the same honesty rule as
the rest of Leeway.

## Placement decision (revised after PR #2)

The teammate's **PR #2 (merged)** folded the old "Planned" tab into Goals (`Events.jsx` →
`PlannedSpends.jsx`, now a section inside Goals) and cut the nav to **four** tabs: Today ·
Transactions · Insights · Goals. That removes the tab this milestone was originally going to upgrade.

So the calendar now lives as a **"Spending calendar" section on the Insights screen**
(`src/components/Insights.jsx`) — the analytics home, and the natural place for a spend heatmap (it's
literally "show my spending graphically", the client's core ask). `App.jsx`/`Nav.jsx` need **no
edits** (the Insights tab already exists). Planned-event **add/remove stays in Goals**
(PlannedSpends); the calendar renders events as **read-only markers**, so nothing is duplicated.

## Data model — state v3

Add one collection:

```
termSpans: [
  { id, kind: 'freshers' | 'exams' | 'term', label: string, start: ISO, end: ISO }
]
```

- `kind` drives the tint, the icon, and which nudge template fires. `start`/`end` are inclusive
  `YYYY-MM-DD` strings (same format as `events[].date`).
- `label` is user text (e.g. "Freshers", "Semester 1 exams", "Autumn term").
- Kept intentionally small (three kinds). `break`/holiday spans are an easy future add, out of scope
  here.

**Migration.** Bump `CURRENT_VERSION` 2 → 3 in `src/store/migrate.js`; add a `toV3(s)` step that
returns `{ ...s, version: 3, termSpans: s.termSpans ?? [] }`. Ordered, non-destructive, matching the
existing `toV2` pattern.

**Backup.** `src/lib/backup.js` serializes the whole state, so `termSpans` already round-trips on
export. `termSpans` is a **new** key, so it must NOT join the required `ARRAY_KEYS` (older v2 backups
lack it and must still import). Instead add a small `OPTIONAL_ARRAY_KEYS = ['termSpans']` check in
`parseBackup`: if the key is **present** it must be an array (else reject with `NOT_A_BACKUP`,
guarding the same crash class the file's comment describes); if **absent**, accept — `migrate`'s
`toV3` then fills it with `[]`.

**Store.** Add actions mirroring the events pattern:
- `addTermSpan({ kind, label, start, end })` → pushes `{ id: uid(), ... }` onto `termSpans`.
- `removeTermSpan(id)`.
- `clearAll()` and `defaultState()` seed `termSpans` (see Seed).

## Pure engine — new `src/engine/calendar.js`

No React, no storage. Reuses `finance.js` date helpers (`toDate`, `daysBetween`, `addDays`) and
`categories.typeOf`. All functions unit-tested.

- **`daySpend(transactions, dayISO)`** → number. Sum of **discretionary (non-fixed) expenses** on
  that day (`type === 'expense' && typeOf(category) !== 'fixed'`). Fixed bills are deliberately
  excluded from the heat scale — a £480 rent day would black out the grid and bury the £6-coffee
  signal. Bills appear as markers instead (below).

- **`heatLevel(spend, scaleMax)`** → integer 0–4. `0` when `spend <= 0`. Otherwise
  `Math.min(4, Math.ceil((spend / scaleMax) * 4))` with `scaleMax` guarded to ≥ a small epsilon so a
  zero/again-zero month never divides by zero. `scaleMax` is the visible month's own max `daySpend`
  (a relative scale, so any month reads well).

- **`billOccurrences(bill, from, to)`** → array of ISO dates. Projects a recurring bill's `nextDue`
  across `[from, to]` by its `freq`: `monthly` steps by calendar month, `weekly` by 7 days. Also
  walks *backwards* from `nextDue` so a bill due after the window but recurring into it is placed
  correctly. `oneoff`/unknown freq → just `nextDue` if it falls in range.

- **`monthMatrix(anchor)`** → array of 6 weeks × 7 days, each cell `{ date: ISO, inMonth: bool }`.
  **Monday-start** (UK). Leading/trailing days belong to the adjacent months (`inMonth: false`).

- **`buildMonth(state, anchor, asOf)`** → `{ anchorMonthLabel, weeks }`, where each cell is enriched:
  `{ date, inMonth, isToday, isFuture, spend, heatLevel, bills: [{label, amount}], events:
  [{label, amount}], terms: [{kind, label}] }`. `scaleMax` for `heatLevel` is computed once over the
  in-month cells. `bills` come from `billOccurrences` over all `state.bills`; `events` from
  `state.events` on that date; `terms` from `termSpansOn`.

- **`termSpansOn(termSpans, dayISO)`** → the spans whose `[start, end]` **inclusive** range covers
  the day (edge dates included).

- **`termNudge(state, asOf)`** → `{ kind, label, daysUntil, phase, message } | null`. Deterministic
  selection of the single most relevant span:
  - Prefer an **active** span (today within it), else the **nearest upcoming** span starting within
    the next 14 days.
  - `phase` ∈ `'active' | 'upcoming'`.
  - Message templates by `kind`:
    - `freshers` → splurge-cap framing ("… cap the big nights so the rest of the month survives").
    - `exams` → quiet-mode framing ("… a quiet, cheap stretch — bank the difference").
    - `term` upcoming end (today within a `term` span whose `end` is ≤ 14 days away) → term-end
      framing ("Term's nearly up — your money's stretching thin"), and if `state.surviveUntil` is
      set, reference the survive plan.
  - Returns `null` when no span is active or upcoming within the horizon.

- **`freshersCap(state, asOf, span)`** → number | null *(nice-to-have, may be folded into the
  nudge)*. A simple computed suggestion: discretionary pool available over the span ÷ span days,
  reusing the run-rate idea. If it complicates the plan, ship the nudge without an exact figure.

## UI — a "Spending calendar" section in `src/components/Insights.jsx`

Added as a new section using the screen's existing `section-title` + `card card-pad` pattern,
rendered **independently of the analytics `enoughData` gate** so it always shows (you can set term
dates and see upcoming bills/events even with little logged spend). The section's contents may be
extracted into a small `src/components/Calendar.jsx` (implementer's call, following the
small-focused-file principle) that Insights imports:

- **Nudge card** at top of the section, rendered from `termNudge` (hidden when `null`).
- **Month grid**: header with ‹ prev / today / next › controls and the month label; a 7-column
  Monday-start grid. Each cell shows the day number and is shaded by `heatLevel`. Markers: a muted
  **ring** = a bill due, a coral **pip** = a planned event. Term spans render as a **coloured
  top-edge on the covered cells** (+ an optional labelled band above the week) — a *separate encoding
  channel* from the heat fill, so tint and heat never fight.
- **Day detail**: tapping a cell opens a `Sheet` listing that day's transactions, bills due, events,
  and any term label. Reuses the existing `Sheet` from `ui.jsx`.
- **Term-dates editor**: an "Add term dates" button → `TermSpanForm` (kind picker + label +
  start/end) in a `Sheet`; a list of existing spans with remove buttons.
- **Events are read-only** here (pips + day-detail). Adding/removing planned events stays in Goals
  (PlannedSpends, from PR #2) — the calendar does not duplicate that flow.

## Palette / dataviz compliance

Follows the `dataviz` skill and the teammate's tokens:

- **Heat scale = single hue `--violet`**, 4 discrete steps light→dark via `color-mix` against
  `--surface` (level 0 = surface; 1–4 increasing violet mix). Sequential magnitude = one hue, never
  a rainbow, and **never** the reserved status colours (`--go`/`--tight`/`--over`) for magnitude.
- **Term tints** use non-status accents on *edges/bands* only: Freshers `--pink`, exams cool
  `--aqua-soft`, term a subtle neutral. Because they sit on a different channel (edge/band) from the
  heat fill, the two never collide.
- **Markers** ≥ 8px; bill ring in `--muted`, event pip in `--coral`.
- **Text** wears ink tokens (`--ink`/`--muted`), never the series colour.
- **Colour-free reading** exists: the day-detail sheet and the planned-events list state every value
  in text; a small heat **legend** labels the ramp.
- **Dark mode** inherits the flipped tokens automatically; verified in the drive-test, not assumed.

## Testing

**Unit (pure, Vitest) — `src/engine/calendar.test.js`:**
- `daySpend` excludes fixed-category expenses and income; sums same-day discretionary spend.
- `heatLevel`: 0 spend → 0; max → 4; a mid value buckets correctly; zero `scaleMax` doesn't divide
  by zero.
- `billOccurrences`: a `monthly` bill projects across a month boundary; a `weekly` bill lands on the
  right days; a bill whose `nextDue` is after the window but recurs into it appears.
- `monthMatrix`: 6×7, Monday-start, correct `inMonth` flags on leading/trailing days.
- `termSpansOn`: inclusive edges (start and end dates both count); non-overlapping day → `[]`.
- `termNudge`: active freshers → cap message; upcoming exams within 14 days → quiet message; nothing
  active/near → `null`; active beats upcoming.

**Migration — `src/store/migrate.test.js`:** a v2 state migrates to v3 with `termSpans: []`; an
existing v2 with no `termSpans` is safe.

**Backup — `src/lib/backup.test.js`:** a state with `termSpans` round-trips; a backup missing
`termSpans` still imports (treated as `[]`); a backup with a non-array `termSpans` is rejected.

**Regression:** all 92 existing tests stay green.

**Drive-to-verify (Playwright, per the workflow):** open Insights → scroll to the Spending calendar →
the demo month shows a heatmap of seeded spend and the Freshers nudge card; add a term span → the
week tints and the nudge updates; the demo planned event shows its pip on the day and in day-detail;
page prev/next months; toggle dark mode and confirm the heat ramp + tints stay legible.

## Seed (demo data)

Add a believable `termSpans` to `defaultState()` so the feature is alive on first open — e.g. a
"Freshers" span a few days out and an "Exams" span later in the term, dated relative to today via the
existing `iso(offsetDays)` helper. Keeps the "app is alive the moment it opens" property.

## Out of scope (YAGNI)

- University term-date presets (deferred — needs a maintained dataset).
- AI-written nudges (deterministic templates only; could feed `/api/tips` later).
- Hard per-day budget enforcement (nudges are guidance + one optional simple cap figure).
- Week/agenda/year views (month grid only).
- Cross-year automatic term repetition.

## Success criteria

- `calendar.js` is pure and fully unit-tested; all existing tests stay green.
- The Insights "Spending calendar" section renders a month heatmap of real seeded spend, with
  bill/event markers and user-set term spans, and pages between months.
- Setting a Freshers or exam span produces the correct highlighted band and a matching plan-ahead
  nudge.
- State migrates v2 → v3 and backups round-trip `termSpans`, all verified by tests.
- The whole feature works offline; dark mode is legible; the nav stays at four tabs (unchanged from
  PR #2).
