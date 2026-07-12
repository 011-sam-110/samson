# Leeway

**One trusted number that tells a UK student what they can safely spend today.**

Existing budgeting apps are rear-view mirrors - they show transactions and charts, then leave you
to do the mental maths. Leeway is a windscreen: it answers the only question a student actually asks
at the till - *"can I afford this right now?"* - and keeps that answer honest as life happens (a
night out, an extra shift, rent looming).

Built from a founding walkthrough + PRD (see `transcript.txt` / `DrunkenGeneratedPRD.md`). This is a
functional MVP: a client-side React SPA with local persistence - no backend, no accounts, no data
leaves the browser.

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
| **Can I spend?** | Type an amount → instant yes / tight / no verdict with the impact |
| **Planned** | Flag upcoming spends (nights out, trips) so they're reserved ahead of time |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests (Vitest)
npm run build    # production build → dist/
```

## Deploy (Vercel)

Zero-config static deploy - Vercel auto-detects Vite. `vercel.json` sets the SPA rewrite.
Build command `npm run build`, output `dist/`.

> Note: this folder currently sits inside a parent git repo. For a clean Vercel deploy, make it its
> own repo first (`git init` here → push to a fresh GitHub repo → import to Vercel), or point
> Vercel's *Root Directory* at this folder.

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
