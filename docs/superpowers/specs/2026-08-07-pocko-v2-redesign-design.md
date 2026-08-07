# Pocko v2 — redesign design spec

**Date:** 2026-08-07
**Status:** Approved in outline by Sam. Six items still open with the client (§8).

## Provenance

Everything here traces to client material captured 2026-08-07:

| Source | What it gave us |
|---|---|
| 5 hand-drawn page sketches (Overview, Transactions, Calendar, Analytics, Goals) | Layout, what to cut, per-page annotations |
| Written list (his ChatGPT summary) | The 10-point redesign brief |
| Voice note 1 (1m52s) | Colour scheme incoming, September deadline, confirm before building |
| Voice note 2 (2m24s) | Can-I-Spend and slider complaints, calendar sync not needed for beta |
| Formula memo | Saving-pace and spending-pace maths |
| Colour video (1m32s) | Palette direction (soft teal / off-white / charcoal / grass green / orange-red) |

His closing instruction sets the tone for this document: *"I'd hate for you to spend time
and effort making something just for me to say — that's not what I meant."* Nothing gets
built until the maths and the palette are signed off.

## Decisions already taken

- **Rebrand to Pocko** across app strings, docs and the GitHub repo. Custom domain later, so
  the Vercel git integration isn't touched mid-rebuild.
- **Open banking**: build the data seam now (account source, merchant→category), ship
  manual-entry-first. It's the heaviest piece and explicitly not vital at this stage.
- **Saving pace** uses the client's model — real transfers into goals — not the
  underspend-becomes-savings model originally proposed. See §2.2 for why he's right.
- **Calendar sync**: Google later (simple, not beta-blocking), Apple much later.
- **Planned spends stay** as a feature; they move off Saving Goals to Calendar.

## 1. Product principles

From his brief, in his own framing:

1. **Anything important is big, bold, and where the eye lands first** — the top.
2. **Every page opens with a plain-English summary** so nobody has to scroll to feel safe.
3. **No jargon, no filler.** Unneeded text devalues the text that matters.
4. **Colour carries meaning**, not decoration. Green = good, red = costly.
5. **Saving is a goal, not the absence of spending.**

## 2. The maths

Sam's stated top priority: *"the maths for the spending and saving paces are 100% accurate."*
All of this lives in `src/engine/` as pure functions with unit tests. No React, no network.

### 2.1 Spending pace

The client's formula, plus two terms:

```
spendable   = balance
            + one-off income arriving before next income date
            − bills due before next income (pro-rata for bills landing just after — the rent fix)
            − goal reserve across the window
            − planned spends logged in the window

windowDays  = days until next income   (fallback: 14)

spendingPace = spendable / windowDays              → "£X/day until payday"

recentDaily  = non-fixed expenses logged in the last 7 days / 7

paceRatio    = recentDaily / spendingPace          → 1.0 means exactly on pace
```

**The two extra terms** beyond his memo are the incoming one-off income and the planned
spends. Both make the number more correct, and planned spends are the feature he just asked
us to keep. Flagged for sign-off rather than slipped in (§8.1).

**Lookback changes from 14 days to 7**, per his memo. Faster to react, jumpier.

Worked through his own example — balance £680, rent £300, phone £20, Netflix £10, 14 days
to the next loan:

```
spendable    = 680 − 330 = £350
spendingPace = 350 / 14  = £25/day
spent £19/day → ratio 0.76 → comfortably under
spent £32/day → ratio 1.28 → over
```

**Bands** (mirroring his saving bands exactly):

| Ratio | State |
|---|---|
| < 0.85 | 🟢 Comfortably under |
| 0.85 – 1.00 | 🟢 On pace |
| 1.00 – 1.25 | 🟠 Over pace |
| > 1.25 | 🔴 Needs attention |

**This replaces the current ratio, which is the bug behind "the slider does nothing."**
Today the dial computes `currentDaily / targetDaily`, where `targetDaily` is a long-run
sustainable rate (income/day − bills/day − goals/day), not the safe-to-spend rate. Two
consequences: the needle answers a different question than the number printed beside it,
and `targetDaily` goes null whenever no income source is configured, freezing the needle
outright. `paceRatio` above has neither hole.

### 2.2 Saving pace

The client rejected the underspend model, correctly:

> *"Not spending money isn't the same as saving it. You planned to spend £30, you only spent
> £10, the app says you saved £20. But you didn't — tomorrow you could spend that £20 on
> clothes. The reward becomes fake."*

Saving pace therefore counts **only real transfers into goals**.

```
monthlySavingTarget = Σ dailyGoalReserve(goal) × daysInCurrentMonth
                      (reuses the existing tested per-goal daily reserve in finance.js;
                       derived by default, manual override available)

requiredPerDay      = monthlySavingTarget / daysInCurrentMonth

windowDays          = min(days elapsed this month, 7)
savedInWindow       = Σ goal contributions in the last `windowDays` days
requiredInWindow    = requiredPerDay × windowDays

savingPace          = savedInWindow / requiredInWindow      → 1.0 means exactly on target
```

**Bands** (his labels; thresholds proposed, open for sign-off):

| Pace | State |
|---|---|
| ≥ 1.15 | 🟢 Saving faster |
| 0.95 – 1.15 | 🟢 On pace |
| 0.60 – 0.95 | 🟠 Slightly behind |
| < 0.60 | 🔴 Needs attention |

**Why a rolling 7-day window rather than his literal cumulative reading.** His memo defines
the streak as "days you've remained on or above your target pace", measured from a running
cumulative total. Run that against a student who hits the target *exactly* — £180/month,
saved as £45 at the end of each week — and it marks them off-pace on **22 of 30 days**, with
a best streak of 3. The rolling window scores the same student on-pace 24 of 30 days with a
streak of 24.

The difference isn't cosmetic. The literal reading punishes anyone who saves in weekly or
monthly chunks, which is how students actually behave, and it rewards front-loading over
consistency — the opposite of his intent. The rolling window still can't be gamed by not
spending, and it matches his own description of the pace as an *average* that "falls
slightly" rather than a daily pass/fail.

**Streak:** a day counts if `savedInWindow ≥ requiredInWindow` on that day. The streak is
the run of consecutive counting days ending today.

**Plain-English companion.** Alongside the bar, one sentence in days rather than percent:

```
daysAhead = (cumulativeSaved − cumulativeRequired) / requiredPerDay
```

→ *"You're 2 days ahead of your saving target."* Percentages swing wildly early in the month
(£10 on day 1 of a £6/day target reads 833%); days ahead/behind stays legible and is the
plainer English he keeps asking for.

### 2.2a Prerequisite: goal contributions must become a dated ledger

**Saving pace cannot be computed against the current data model.** `contributeToGoal`
(`store.js:80`) increments a single running total, and `schema.sql:59` stores `goals.saved`
as one numeric column. Nothing records *when* money went in — so "saved in the last 7 days"
has no answer, and neither the pace nor the streak can exist.

This is a hard prerequisite for §2.2 and lands first in phase 1.

- New per-user collection `contributions`: `{ id, goalId, amount, date }`.
- New table `goal_contributions (user_id, id, goal_id, amount, date)`, RLS on, following the
  same pattern as the other per-user state tables.
- `goals.saved` is **retained and reinterpreted as an opening balance** — what the student
  had already put aside before using Pocko, which is exactly what the "Already saved" field
  in `GoalForm` collects. Displayed progress becomes `openingBalance + Σ contributions`.
- Migration in `src/store/migrate.js`: existing `saved` values become opening balances. No
  data is lost and no user sees their progress change.

Opening balances deliberately do **not** count toward saving pace — they weren't saved
during any measured window. Only dated contributions do.

### 2.3 Can I Spend — staged answers

His complaint, reproduced exactly in the current code (`finance.js:253`): the verdict is
`yes` unless the pool goes negative or the leftover drops below a £5/day floor. At his own
£51/day with 14 days to payday the capacity is £714, so £50 and £200 both clear the floor
and return the identical headline.

Replace the binary with tiers on what the spend does to the daily figure:

```
newPace = (spendable − amount) / windowDays
tier    = newPace / spendingPace
```

| tier | Answer |
|---|---|
| ≥ 0.95 | "No problem." |
| 0.85 – 0.95 | "That works — you'd still have £X/day." |
| 0.70 – 0.85 | "Doable, but it tightens things: £X/day for the next N days." |
| 0.50 – 0.70 | "That's a big one. It leaves you £X/day." |
| < 0.50, or spendable − amount < 0 | "Better not — you'd be £X short before payday." |

Against his £51/day example: £5 → 0.99, £50 → 0.93, £100 → 0.86, £200 → 0.72.

**One honest note for him.** His four examples don't split into four tiers at a fixed
capacity — with £714 of runway, £100 genuinely *isn't* tight, and telling him it is would be
the app lying to make a point. What was actually wrong is that every answer used identical
wording and gave no figure. The tiers are relative to each person's capacity; the fix is
specificity, not manufactured caution.

The headline number, per his memo:

```
tonight = max(spendingPace − alreadySpentToday, 0)
```

→ *"You could comfortably spend around £28 tonight."*

### 2.4 The no-data state

Both paces are only as good as what gets logged, and until open banking lands, nothing is
imported automatically. A dial fed zero transactions currently reports "far left, green" —
which is what the client saw. It reads as *"you're doing great"* when it means *"I know
nothing about you."*

Rule: when fewer than 3 of the last 7 days carry any logged transaction, the dial enters a
neutral **"Not enough logged yet"** state — no colour verdict, no reassurance — and the page
summary says so and points at logging or importing. Green is never shown on absent data.

This is the one place where the app could actively cost a student money, so it is specified
here rather than left to UI judgement.

## 3. Colour system

Direction from the colour video, in his words: soft teal primary; off-white background
("not plain absolute white, that's a little in your face... not sandy either — think a
blurry beach, somewhere in the middle"); charcoal text; "an actual actual green, grass
green" for good things; orange-red for warnings; **no gradients**.

The video is a phone recording of a laptop screen, so its pixel values are worthless as
hex — glare and white balance corrupt them. The values below are built from his *named*
intent and verified for contrast, not sampled from the footage. They need his sign-off.

| Role | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | `#F6F3ED` | Page — warm off-white | — |
| `--surface` | `#FFFDFA` | Cards | — |
| `--ink` | `#22282B` | Charcoal body text | 14.7:1 on card |
| `--ink-2` | `#4A5459` | Secondary text | 7.7:1 |
| `--muted` | `#606C74` | Captions | 5.3:1 card / 4.9:1 page |
| `--teal-600` | `#2F7D74` | Primary fill, white text | 4.9:1 with white |
| `--teal-700` | `#1F5C56` | Teal as text | 7.6:1 |
| `--good` | `#3FA34D` | Grass green — graphic marks | 3.2:1 |
| `--good-text` | `#2E7D3A` | Grass green as text | 5.0:1 |
| `--warn` | `#CE7514` | Amber — graphic marks | 3.4:1 |
| `--warn-text` | `#9A5B12` | Amber as text | 5.3:1 |
| `--bad` | `#E4572E` | Orange-red — graphic marks | 3.6:1 |
| `--bad-text` | `#C0391B` | Orange-red as text | 5.4:1 |

Every pair clears WCAG AA (4.5:1 text, 3:1 non-text marks), verified by calculation.

**Semantic roles over raw hues.** Components reference `--focus`, `--good`, `--bad`,
`--calm`, `--recede` — never `--teal-600` directly. Two payoffs: his "make the eye land on
the right thing" brief becomes something the code can enforce, and a later palette change is
one file rather than an audit of 1,878 lines of CSS.

The existing blue tokens survive as aliases through the transition, as the neon-era class
names already do.

## 4. Page contract

A shared `<Page>` component fixes the order on every screen, so hierarchy can't drift:

1. **Summary** — the largest type on the page, plain English, no jargon
2. **The one hero element** — exactly one per page
3. **Supporting detail**
4. **Tips and advanced tools** — bottom, always

**Summaries are deterministic**, generated by pure functions in the engine
(`overviewSummary(state, asOf) → { headline, lines[] }`) and rendered by one `<PageSummary>`.
Not LLM-generated: summaries are the first thing a user reads, so they must be instant,
offline, free, and above all **unit-testable**. The client's stated fear is the app giving
false information; a generated sentence that invents a figure is exactly that failure.

**Type scale** raises the floor to 15px — there is no "small print" left to skim past —
and widens the ratio so page tops are genuinely large.

## 5. Page by page

### Overview
- Summary: spending pace, what's coming (rent, income), what's left this week, and whether
  tonight is affordable.
- Hero: the pace dial (fixed per §2.1, with the no-data state), then **Can I Spend? as a
  full-width slab inline on the page** — not a sheet.
- Three tiles: average daily spend · left this week/month · total balance (with next payday
  as a sub-line, not a headline).
- Short plain-English commentary at the bottom for people who want it spelled out.
- **Removed:** "Safe daily rate" tile, standalone "Next payday" tile, "Log a spend" button.

### Transactions
- Summary: spending pace vs last week and last month.
- Tabs: `Recents` / `Recurring`. Filter row: `Expense` / `Income` / `All`. Default: All +
  Recents.
- Rows carry green/red amounts, an auto-assigned category, and an account badge (hidden
  until open banking supplies it).
- **The loan/grant "Make a lump last" planner moves here**, near the top.
- Manual add and screenshot import stay — cash still has to be logged by hand.
- Bottom: most common transactions.

### Calendar
- Summary: the month so far plus the next few weeks of events.
- **Colour-filled day cells, not dots or symbols.** Grass green = good (birthday, party);
  orange-red = costly (rent, exams).
- Shows how an event bends that day's spending pace, with the formula explained.
- **Planned spends move here** from Saving Goals.
- Google Calendar sync: phase 4. Apple: much later.

### Analytics *(renamed from Insights)*
- Summary in bold: this month vs last, percentage moves, savings figures.
- Hero: **the savings indicator — saving pace bar + streak — at the top.**
- Spending over time; categories, made substantially bolder; weekend vs weekday.
- Ways to save at the bottom.

### Saving goals *(renamed from Goals)*
- Summary: how this week's saving fed each goal, and how much closer it is.
- Goal bars, largely unchanged but bolder.
- Small saving tips at the bottom.
- **Planned spends removed** (moved to Calendar).

## 6. Phases

Ordered by Sam's priorities — maths first, not the design system.

| Phase | Contents |
|---|---|
| **1. Engine** | Dated contribution ledger + migration (§2.2a — blocks saving pace). Then spending pace, saving pace + streak, staged Can I Spend, no-data state, summary generators. Pure functions, fully unit-tested. |
| **2. Foundations** | Semantic tokens + his palette, type scale, `<Page>` / `<PageSummary>`, Pocko rename (app + docs + repo). |
| **3. Pages** | The five rebuilds. Independent files; parallelisable. |
| **4. Integrations** | Google Calendar sync, open-banking adapter behind the seam from phase 1. |

Target: usable before students return, ~mid-to-late September.

## 7. Testing

- Every formula in §2 gets unit tests, including the client's own worked examples (£680/14
  days → £25/day; £900/£180/30 days → £6/day) as fixtures, so his numbers are regression-locked.
- The no-data state gets explicit tests: zero transactions, and 1–2 days of 7 populated,
  must never return a green verdict.
- The existing 187 Vitest tests must stay green; `scripts/db-integration.mjs` re-runs after
  any schema change.
- Existing engine tests covering `pacePct` will need updating, since §2.1 changes the ratio's
  definition. That's intended, and the diff should be reviewed rather than auto-fixed.
- The §2.2a migration gets its own test: a pre-migration goal with `saved: 180` must still
  display £180 of progress afterwards, and must contribute nothing to saving pace.

## 8. Open with the client

1. **Spending-pace terms** — sign-off on the two additions beyond his memo (§2.1).
2. **Saving target source** — derive from goal deadlines, let him type it, or derive with
   override? (§2.2 defaults to derive-with-override.)
3. **Rolling streak** — confirm the 7-day window over his literal cumulative reading, given
   the 22-of-30-days finding.
4. **7-day lookback** — confirmed as his call; it reacts faster but swings harder than 14.
5. **The no-data state** (§2.4) — confirm the app should say "not enough logged yet" rather
   than show green.
6. **Band thresholds and Can-I-Spend copy** — proposed above; does he want to write the
   wording himself, given how much of this is about tone?
7. **Palette hex sign-off** (§3).

## 9. Where we left off — 2026-08-07

**State:** spec complete, nothing implemented. Sam is getting the §8 questions answered by the
client. No branch has been cut; `main` carries only the docs commit.

**Client review page** (his palette, his worked numbers, the five layouts, the seven questions):
<https://claude.ai/code/artifact/79d157e1-6bc6-4510-ae20-969120f58983>

### Resume here

Start with the **dated contribution ledger (§2.2a)**. It's the only piece of phase 1 that no
answer can change — saving pace is uncomputable without it — so it's safe to build while the
questions are out. Order: new `contributions` collection → `goal_contributions` table + RLS →
`migrate.js` turning existing `goals.saved` into an opening balance → tests (a pre-migration
goal with `saved: 180` must still show £180 and contribute nothing to pace).

Also safe to start, none of it depends on an answer: the Pocko rename, the type scale, and the
`<Page>` / `<PageSummary>` primitives.

**Do not start** the pace formulas, the bands, or the Can-I-Spend tiers. Questions 1–6 all move
that arithmetic, and Sam's stated top priority is that it's right rather than early.

### Gotchas worth carrying forward

- This repo is **nested inside the home repo**. Commit from inside `Samson/`, never the parent.
- **Stage explicit paths.** Untracked secrets live in these trees; `git add -A` has already
  leaked a live key in another project.
- The docs commit (`1e58ab5`) is **committed but not pushed** — deliberate, waiting on Sam.
- Changing §2.1 breaks the existing `pacePct` tests by design. Review that diff; don't let it be
  auto-fixed into agreement.
- The colour video is a **phone photo of a screen**. Never sample hex from it.
- Transcripts of both voice notes and the colour video are in the client-feedback doc — the
  source audio lives in `~/Downloads` and won't survive a cleanup.
