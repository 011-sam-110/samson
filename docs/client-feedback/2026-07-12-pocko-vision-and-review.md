# Client feedback — 2026-07-12

> **Status: SAVED FOR LATER, not yet actioned.** Captured on 2026-07-12 at the client's request.
> Two parts: (1) a formal Product Vision & Feature Spec (v1.0), and (2) an informal review of the current build.

> **Naming note:** the client's vision doc names the product **"Pocko"**. This repo is internally
> **"leeway"** (source, specs, screenshots). Treat this as an open question — is Pocko a rebrand of
> leeway, or a separate/parallel name? Do not rename anything until confirmed with the client.

---

## Part 1 — Pocko: Product Vision & Feature Specification (v1.0)

### Mission Statement
Pocko exists to remove financial uncertainty from student life. Students should not have to mentally
calculate whether they can afford a night out, takeaway, train ticket or purchase. Pocko focuses on
helping students make better decisions **before** they spend, not simply recording what has already happened.

### Core Problem
Most students know they should budget, but budgeting is tedious, difficult to maintain and often
abandoned. Traditional banking apps show balances. Students want confidence. The real question is:
*"Can I afford this without regretting it later?"*

### Non-Negotiable Principles
- Reduce financial anxiety.
- Simplicity beats complexity.
- Decision support rather than bookkeeping.
- Behaviour change over raw data.
- Student-first design.

### Must Have Features (Version 1)
- Clear dashboard showing financial health.
- Fast transaction logging.
- 'Can I Spend?' affordability engine.
- Spending analytics and category breakdowns.
- Calendar for expected spending events.
- Forecasting and upcoming-spend predictions.
- Recurring income and expenses.
- Savings goals with editable priorities.
- Friendly, reassuring language.

### Should Have Features (Version 1.x)
- Saving Run Rate system.
- Weekend spending forecasts.
- Upcoming expense alerts.
- Helpful notifications.
- Personal spending insights.
- Financial health score.

### Could Have Features (Version 2)
- Pocko the Penguin mascot.
- Achievement milestones.
- Positive reinforcement systems.
- Anonymous student comparisons.
- Spending personality profiles.

### Later Down the Line
- Open Banking integration.
- AI financial coach.
- University partnerships.
- Employer partnerships (e.g. Stint).
- Student discount integration.
- Subscription tracking.
- Financial education content.

### Design Philosophy
Pocko should feel calm, modern, clean and professional. Rounded corners, smooth interactions, clear
spacing and minimal clutter. The interface should reduce stress and provide clarity.

### Success Metric
Pocko succeeds when students instinctively think: *"I'll check Pocko first"* before making a purchase.

### Guiding Principle
Every feature should answer one question: **Does this make it easier for a student to make a confident
financial decision?** If not, it should wait.

---

## Part 2 — Informal review of the current build (verbatim)

> ok wow i just clicked again and saw the improvements! i mean i like that its not plain black and
> white but maybe dial down a bit on the neon, it kind of looks like a website for a lazar tag birthday 😂.
> the insights section is good! maybe try make the font size slightly bigger for the headings of the
> important information which just needs to stand out a bit more yk. i haven't tried imputing any
> transactions yet so i don't know how that responds but if you can test its durability given more and
> more transactions, just check if its maths is right so that its not giving false information in the tip
> section or the spending pace. also change the word "pace" for "rate", seems more financially accurate
> and makes more sense on a day to day thing. good work tho so far. don't worry too much on the UX and
> how nice it looks because if it doesn't work as a demo then theres no point in it. as long as we have a
> usable and intuitive and accessible demo we can send people for testing, ill be chuffed! also remember
> that with all the features, they can be cool and useful and good but if the average business or film or
> lesbian poetry student can't understand them then it ceases to be useful. imagine you are dealing with
> idiots who know nothing on the maths behind it and the way it works so make it easy for them to easily
> get what it is a "spending rate" is or rent is or savings etc.. don't forget to dumb it down for them 😂

---

## Distilled action items (for later — DO NOT action yet)

### Visual / tone
- [ ] **Dial down the neon** — colours are too much ("laser tag birthday"). Keep it non-monochrome but calmer/more professional (aligns with vision's "calm, modern, clean" philosophy).
- [ ] **Bigger heading font** for the important/standout info (Insights headings called out specifically).

### Correctness (high priority — "false information" risk)
- [ ] **Stress-test the maths** with increasing numbers of transactions — verify tips and spending pace/rate stay correct and don't give false information.
- [ ] Confirm no rounding/aggregation errors as transaction volume grows.

### Copy / wording
- [ ] **Rename "pace" → "rate"** throughout (e.g. "spending pace" → "spending rate"). More financially accurate / day-to-day sensible.
- [ ] **Plain-language everything** — explain what "spending rate", "rent", "savings" etc. mean for a total novice. Assume the user knows nothing about the underlying maths. Add short, friendly explanations/tooltips.

### Guiding priorities from the client
- Working demo > polish. It must **function** as a usable, intuitive, accessible demo to send to testers.
- Accessibility matters (explicitly named).
- Every feature must be understandable by a non-financial, non-technical student or it's not useful.
