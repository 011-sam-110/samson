# Pocko

**One trusted number that tells a UK student what they can safely spend today.**

Live: **https://samson-three.vercel.app**

Existing budgeting apps are rear-view mirrors - they show transactions and charts, then leave you
to do the mental maths. Pocko is a windscreen: it answers the only question a student actually asks
at the till - *"can I afford this right now?"* - and keeps that answer honest as life happens (a
night out, an extra shift, rent looming).

---

## The idea in one screen

The **Overview** screen leads with your **total balance**, then a **spend speedometer** (the founder's
own "£/day like mph" metaphor):

- **Total balance** - what's actually in your account, first thing you see.
- **Safe to spend today £X** - of your current cash, Pocko holds back what bills, goals and planned
  events will need before your next income, then spreads the rest over the days until that income lands.
- **The gauge** - your *current* daily spend measured against your *sustainable* daily rate.
  Green = under, amber = a touch over, red = spending fast.
- **Why this number** - a full breakdown of what's reserved, so the figure is trusted, not magic.

Anything jargon-y carries an **ⓘ button explaining it in plain English**; the heavier analysis lives
in Insights, so the main screen stays calm for people who just want the number.

## How the number is calculated

Everything is a **daily rate**. The engine (`src/engine/finance.js`) is pure and unit-tested.

```
target daily rate = income/day - bills/day - goals/day        # what's sustainable, forever
safe-to-spend      = (balance + income landing before payday
                      - bills reserved - goals reserved - planned events) ÷ days until payday
```

Two decisions worth calling out, because they're where naive budget apps break:

1. **The rent fix.** A recurring bill due *after* your next payday still reserves its fair pro-rata
   slice *now*. Without this, the app says "£24/day, you're fine!" - then rent lands the day after
   payday and wipes the account. Bills due *inside* the window are reserved in full.
2. **No silent drift.** The whole thesis is that students are too lazy to log every coffee - so the
   entered balance drifts from reality. The **Reconcile** button lets you paste your real bank
   balance in one tap, keeping the number honest. (Open-banking would automate this; it's deferred.)

The overspent and over-committed states are explicit ("you're £X short - trim to £Y/day to recover"),
never a scary negative number.

## Screens

| Screen | Does |
|---|---|
| **Overview** | Total balance, the gauge, safe-to-spend, run-rate, next paycheck, and the reserve breakdown |
| **Transactions** | Recurring income & bills + a ledger of logged one-offs; fast add flow |
| **Calendar** | Spending calendar with term/Freshers/exam overlays and a plan-ahead nudge |
| **Insights** | A report on your money: spend-over-time and weekly-trend charts, category ranking, weekend effect, leaks, "Ways to save", the lump-sum planner, and an AI cut-back tip |
| **Goals** | Targets with auto weekly-required set-aside and progress |
| **Can I spend?** | Type an amount and get an instant yes / tight / no verdict with the impact |

Transactions also has **Import from a screenshot**: upload a bank statement image and the AI extracts
the rows for you to review and import.

## Accounts

Pocko has its **own** credential auth - no third-party identity provider.

- **Passwords** are hashed with **scrypt** (memory-hard) using a **random per-password salt**, and
  verified in constant time. The stored value is self-describing (`scrypt$N$r$p$salt$hash`) so the
  work factor can be raised later without invalidating existing users.
- **Sessions** are HS256-signed tokens delivered in an **HttpOnly, Secure, SameSite=Lax** cookie, so
  the browser never exposes them to JavaScript. Signed with `SESSION_SECRET`.
- Built only on Node's built-in `crypto` - no native modules, so it deploys clean on serverless.
- **No email/password reset yet** (deliberate for now - there is no mail provider wired up).
- **Guest mode**: you can use the whole app without an account (localStorage only). Signing up
  afterwards pushes what you built into your new account.

Your data syncs to Postgres per user, guarded by the verified session and Row-Level Security. A
recency check (`baseUpdatedAt`) stops a stale tab from clobbering a newer save.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also serves /api from api/ via a Vite middleware)
npm test         # 187 unit tests (Vitest)
npm run build    # production build to dist/
```

`npm run dev` reads `.env.local`. With no `DATABASE_URL` the app still runs fine in guest mode.

## Deploy (Vercel)

Vercel auto-detects Vite: build `npm run build`, output `dist/`. `vercel.json` keeps the SPA rewrite
but excludes `/api` so the serverless functions stay reachable. `main` auto-deploys to production.

### Environment variables

| Var | Required | Powers |
|---|---|---|
| `DATABASE_URL` | for accounts | Postgres (Neon) connection string |
| `SESSION_SECRET` | for accounts | Signs session cookies. Rotating it signs everyone out |
| `GROQ_API_KEY` | optional | Screenshot import (vision) + AI tips |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | optional | Fallbacks; the backend fails over on rate limits |

See `.env.example`. Everything is read server-side only - never prefix with `VITE_`.

### First-time database setup

Apply the schema once against your database, then verify:

```bash
node scripts/apply-schema.mjs      # applies schema.sql, checks tables + RLS (idempotent)
```

## Tests

```bash
npm test                           # 187 unit tests, no DB or network needed
node scripts/db-integration.mjs    # end-to-end against a real Postgres (see script header)
```

The integration harness drives the *same* handlers the serverless functions use - signup, login,
save/load, the stale-write conflict guard, usage tracking and cross-user isolation - against a real
database, so the SQL is exercised rather than mocked.

## Structure

```
api/                        # Vercel serverless functions (thin wrappers)
  auth/{signup,login,logout,me}.js
  state.js  usage.js  extract.js  tips.js
src/
  engine/finance.js         # pure safe-to-spend engine (+ analytics, calendar, recurring)
  lib/auth.js               # scrypt hashing, session tokens, cookies (pure, unit-tested)
  lib/auth-handlers.js      # signup/login/me/usage logic, DB injected
  lib/state-api.js          # cloud state GET/PUT, DB + auth injected
  store/{store,seed}.js     # localStorage-backed state + demo data
  components/               # Overview, Transactions, Calendar, Insights, Goals, AuthScreen, …
schema.sql                  # users, per-user state tables, usage_events, RLS
```

The pure-logic / thin-wrapper split is deliberate: every handler is unit-tested with no DB or
network, and the `api/*` files just adapt the request shape.

## Deferred

Open-banking sync · password reset via email · pre-loaded term/Freshers calendar · exam "quiet mode" ·
AI advice engine · investing layer. See the PRD for the full roadmap.
