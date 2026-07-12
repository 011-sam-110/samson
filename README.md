# Leeway

**One trusted number that tells a UK student what they can safely spend today.**

Existing budgeting apps are rear-view mirrors - they show transactions and charts, then leave you
to do the mental maths. Leeway is a windscreen: it answers the only question a student actually asks
at the till - *"can I afford this right now?"* - and keeps that answer honest as life happens (a
night out, an extra shift, rent looming).

Built from a founding walkthrough + PRD (see `transcript.txt` / `DrunkenGeneratedPRD.md`). A
client-side React SPA with local persistence and a light/dark theme. The core is fully offline (no
accounts, your money data stays in the browser); an **optional** serverless AI layer powers
screenshot import and cut-back tips (those send the image / a spending summary to an LLM provider).

---

## The idea in one screen

The home screen is a **spend speedometer** (the founder's own "£/day like mph" metaphor):

- **Safe to spend today £X** - the headline. Of your current cash, Leeway holds back what bills,
  goals and planned events will need before your next income, then spreads the rest over the days
  until that income lands.
- **The gauge** - your *current* daily spend (the marker) measured against your *sustainable* daily
  rate (the safe line). Green = under, amber = a touch over, red = speeding.
- **Why this number** - a full breakdown of what's reserved, so the figure is trusted, not magic.

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
| **Today** | The gauge, safe-to-spend, run-rate, next paycheck, and the reserve breakdown |
| **Transactions** | Recurring income & bills + a ledger of logged one-offs; fast add flow |
| **Goals** | Targets with auto weekly-required set-aside and progress |
| **Insights** | Analytics: spend-by-category, week-vs-usual trend, weekend effect, leaks, cost-to-goal, and an AI cut-back tip |
| **Can I spend?** | Type an amount and get an instant yes / tight / no verdict with the impact |
| **Planned** | Flag upcoming spends (nights out, trips) so they're reserved ahead of time |
| **Make it last** | (on Today) Stretch a loan/grant across a whole term - a safe £/day with a weekday/weekend split |

Transactions also has **Import from a screenshot**: upload a bank statement image and the AI extracts
the rows for you to review and import.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests (Vitest)
npm run build    # production build to dist/
```

## Deploy (Vercel)

Vercel auto-detects Vite: build `npm run build`, output `dist/`. `vercel.json` keeps the SPA rewrite
but excludes `/api` so the serverless functions stay reachable.

### Environment variables

The AI endpoints (`/api/extract`, `/api/tips`) need at least one LLM key, set in the Vercel dashboard
(**Settings → Environment Variables**). `.env.local` only works locally. The rest of the app runs
fine with no keys - you just don't get AI import/tips.

| Var | Powers | Get one (free) |
|---|---|---|
| `GROQ_API_KEY` | screenshot import (vision) + tips | console.groq.com (no card) |
| `GEMINI_API_KEY` | optional fallback | aistudio.google.com |
| `OPENROUTER_API_KEY` | optional fallback | openrouter.ai |

The backend builds a pool from whichever keys are present (in that order) and fails over on rate
limits. See `.env.example`.

### Collaboration note (Hobby tier)

Vercel Hobby only deploys commits **authored by the account owner**. If a teammate's commit is the
tip of `main`, the deploy is blocked (*"commit author does not have contributing access"*). Keep it
free by having the owner **merge the PRs** (the merge commit is then the owner's), or upgrade to Pro /
move to Cloudflare Pages for true multi-author deploys.

## Structure

```
src/
  engine/finance.js        # pure safe-to-spend engine (+ finance.test.js, 23 tests)
  store/{store,seed}.js     # localStorage-backed state + demo data
  lib/{format,id}.js        # £ / date formatting
  components/               # Dashboard, Transactions, Goals, CanISpend, Events, Gauge, Nav, forms
```

## Deferred (the growth surface, not the proof of value)

Open-banking sync · analytics charts page · pre-loaded term/Freshers calendar · exam "quiet mode" ·
AI advice engine · investing layer. See the PRD for the full roadmap.
