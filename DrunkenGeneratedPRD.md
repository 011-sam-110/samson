This was generated through claude, and was provided with a drunken conversation about the app. You should see transcript.txt for a transcript of a walk through video

Student Finance Tracker — Project Description & PRD

Working title: TBD (referred to as "the app" throughout)
Document type: Product Requirements Document + Project Description
Status: Draft v0.2 — revised after fresh-eyes review
Owner: TBD


Scope note: The founding conversation describes a budgeting / cash-flow tool — it tracks income and spending and tells a student what they can safely spend over a period. It is not (yet) an investment product. Investment features are captured under Future Considerations.




What changed in v0.2: Added a sharp value wedge, a concrete definition of the core "safe-to-spend" calculation (with a worked example), spec-level feature definitions, competitive positioning, an explicit MVP cut, a business model, and a validation plan tied to the adoption risk.




1. The Core Wedge — Why This Is Genuinely Helpful

One sentence: It turns a student's irregular, messy finances into a single trustworthy number — "you can spend £X between now and your next paycheck without breaking your goals" — and it re-computes that number the moment life changes.

Existing apps (Monzo, Emma, Snoop, Plum, YNAB) are rear-view mirrors: they show transactions, categories, and charts, then leave the student to do the mental math. Students won't do that math — and even if they do, it's static and breaks the first time an unplanned night out happens.

This app is a windscreen: it answers the only question a student actually asks at the point of spending — "can I afford this right now?" — and keeps the answer honest as circumstances change (a night out, an exam week, an extra shift). The help is the removal of cognitive work at the moment of decision.

If the product does exactly one thing well, it is: produce a safe-to-spend number the student trusts and that survives real student life.


2. Project Description

Elevator pitch

A finance app for university students that doesn't just track spending — it tells you exactly how much you can safely spend today, this week, and this month, factoring in irregular part-time income, upcoming bills, savings goals, and the realities of student life like exam periods and nights out. It gives you the answer instead of making you do the budgeting.

The problem

Students are bad at managing money and existing apps don't help, because they show data instead of decisions, treat every week the same, and require ongoing effort that students won't spend. The result: impulsive spending, miscalculation, and one bad night that derails a whole month.

The solution

Use the student's real income and spending to compute a personalised, self-updating "safe-to-spend" figure, plus plain-language guidance on what to do with what's left. Low effort in, a clear answer out.

Target user

UK university undergraduates with irregular or part-time income who want to save (or at least stop overspending) but won't maintain a manual budget. (Exact segment to be locked in the grill-me session.)


3. How the "Safe-to-Spend" Number Works (the core mechanic — new)

This is the heart of the product and must be defined precisely.

Definition: Safe-to-spend is the discretionary money a student can spend over a defined window without missing a committed bill or falling behind on an active goal.

Inputs


Current balance (manual entry for MVP; open-banking sync later).
Projected income in the window — recurring wage (e.g. £/hr × hrs/week), plus scheduled one-offs (student-loan drops, allowance).
Next income date — defines the default window ("until next paycheck").
Committed outgoings in the window — recurring fixed costs (rent, phone, subscriptions).
Goal set-aside — for each active goal: (target − saved) ÷ weeks remaining, pro-rated to the window.


Calculation (window = now → next income date):

discretionary_pool = current_balance
                   + income_arriving_within_window
                   − committed_bills_due_in_window
                   − goal_set_aside_for_window

safe_to_spend_per_day  = discretionary_pool ÷ days_left_in_window
safe_to_spend_this_week = safe_to_spend_per_day × 7

Worked example


Balance: £420; next wage of £320 lands in 12 days.
Bills due before then: phone £15 + subscriptions £12 = £27.
Goal: save £600 for a summer trip in 10 weeks → £60/week → ~£103 set aside for this 12-day window.
discretionary_pool = 420 − 27 − 103 = £290 over 12 days → ~£24/day safe-to-spend.


Event adjustment (the differentiator in action): the student flags a £60 night out on day 5. The app reallocates: 290 − 60 = £230 across the remaining 11 days → ~£21/day for the rest of the window. The night out happens and the month still balances — no derailment.

Open design questions (for grill-me): single number vs. range? per-day vs. per-week as the primary display? how conservative should the goal set-aside be? rules-based advice vs. AI-generated?


4. Goals & Objectives

GoalDescriptionPrevent the "one bad night ruins the month" spiralThe core behavioural outcome.Make budgeting effortlessReplace manual budgeting with a single trusted number.Enable realistic goalsHit a savings target while still living student life.Forward visibilityClear view of balance, next paycheck, and safe-to-spend.Adapt to student rhythmsAdjust for exams, peak times, and planned nights out.


5. Target Audience & Personas

"The Impulsive Spender" — spends on feel, regrets it next day, won't budget. Wants to be told what's safe.
"The Goal-Setter" — saving for something specific, willing to plan, wants to stay realistic without killing their social life.

Common thread: part-time/irregular income, low financial discipline, values simplicity over control.


6. Features & Requirements (now spec-level)

Priorities: P0 = MVP, P1 = important, P2 = later.

6.1 Income setup (P0)


Add recurring income: amount + frequency, or hourly rate × hours/week.
Add one-off income: amount + date (loan drops, allowance).
Store next income date; auto-roll recurring entries.


6.2 Committed outgoings (P0)


Add recurring fixed costs (rent, phone, subscriptions) with amount + due date/frequency.


6.3 Goals (P0)


Create a goal: target amount + deadline.
Auto-derive required weekly set-aside; show progress.


6.4 Safe-to-spend engine (P0) — core


Compute discretionary pool and per-day / per-week safe-to-spend per §3.
Recompute on any change to balance, income, bills, goals, or events.


6.5 Home screen / the number (P0)


Lead with "Safe to spend today: £X", plus "left this week", "left this month", and "next paycheck in N days".


6.6 Spending capture (P0)


MVP: fast manual entry (amount + optional category).
P1: open-banking sync to remove manual entry — critical, since the core thesis is that users are lazy.


6.7 Event adjustments (P1) — differentiator


Flag an upcoming event (e.g. night out) with an estimated spend; the engine reallocates the pool across remaining days so the window still balances.


6.8 Exam / quiet mode (P1)


Mark exam periods or low-spend windows; app nudges lower spend and banks the slack toward goals.


6.9 Advice & nudges (P1)


Plain-language guidance ("You can comfortably do £X this weekend and still hit your goal").
Pre-emptive warnings before predictable overspend (e.g. Friday nights, post-exam).
Decision needed: rules-based v1 vs. AI-generated.



7. MVP — Smallest Version That Delivers the Number (new)

Ship only what's needed to produce a trusted safe-to-spend figure:


Manual balance entry (6.1–6.2 inputs).
One savings goal (6.3).
Safe-to-spend engine (6.4) + home screen (6.5).
Manual spend entry (6.6).


Explicitly deferred from MVP: open-banking, event adjustments, exam mode, advice engine. These are the growth surface, not the proof of value.


8. Competitive Landscape (new)

ProductWhat it does wellGap this app exploitsMonzo / StarlingGreat banking UX, pots, budgetsShows spend vs. budget; doesn't give a forward "safe today" number that adapts to student lifeEmma / SnoopAggregation, subscription tracking, insightsInsight-heavy, effort-heavy; rear-view, not decision-firstPlum / ChipAutomated savingSaves in the background; doesn't answer "can I afford this now?"YNABRigorous zero-based budgetingHigh effort and paid — the opposite of the lazy-student thesis

Wedge: decision-first + student-context-aware + near-zero effort. No incumbent occupies all three for students.


9. Business Model (new — students have no money, so this matters)

Candidate paths (to be validated):


Freemium: core number free; premium for open-banking sync, multiple goals, advanced advice.
Affiliate/partnerships: student bank accounts, ISAs, discount partners (with strict, transparent, opt-in framing to preserve trust).
B2B2C: universities/student unions offering it as a wellbeing/financial-literacy tool.


Constraint: monetisation must not compromise the trust in the safe-to-spend number.


10. Success Metrics


Activation: % who add income + first spend on day 1.
Core value: safe-to-spend checks per user per week.
Behaviour change: reduction in overspend events over time.
Goal completion: % who reach a set goal.
Retention: WAU; month-1 retention.



11. Validation Plan (new — confronts the adoption risk)

In the founding conversation, when asked "Would you use it?", one participant said no. Treat that as the primary risk to kill or confirm first.


Problem interviews (10–15 students): do they overspend, and do they trust a number more than a budget?
Concept test: show the home-screen number + one night-out reallocation; measure "would you use this weekly?"
Fake-door / prototype: clickable safe-to-spend flow; measure activation intent before building the engine.
Kill criteria: define upfront what result would make you stop.



12. Risks & Open Questions


Adoption: will the target user actually rely on it? (See §11.)
Data-entry friction: if users won't input spend, the engine starves → pushes open-banking earlier.
Trust in the number: users must believe and act on it; over-conservative numbers feel punishing, over-generous ones break the promise.
Irregular income modelling: variable hours, gig income, lumpy costs (rent, tuition).
Behaviour vs. tooling: does showing the number actually change impulsive behaviour?
Naming & positioning: product needs a name.



13. Out of Scope (MVP)

Investing/micro-investing; credit building or lending; shared/multi-user budgets; deep integrations beyond read-only balance/transactions.


14. Future Considerations


Investing layer: round-up micro-investing of leftover safe-to-spend money; goal-linked pots (path toward "student investment").
Open-banking automation.
Smart notifications before predictable overspend.
Opt-in peer benchmarking.
Student-specific integrations: loan disbursement dates, term calendars.



v0.2 — revised after fresh-eyes review. Items marked "decision needed" / "for grill-me" to be resolved in the interrogation session and folded into v0.