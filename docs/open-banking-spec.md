# Pocko — Open Banking / Monzo bank feed (implementation spec)

**Date:** 2026-08-24
**Status:** RESEARCH + SPEC done overnight, unsupervised, from a written brief. NOT reviewed by Sam. A small amount of scaffold code is committed alongside this doc (see "What's actually built tonight" at the bottom) — no real provider is connected, no account was created, no credential was invented.
**Branch:** `feat/open-banking-monzo-spec` (off `main`, not pushed, not merged).

---

## For Sam, first thing

I researched how to connect a UK bank account (Monzo specifically) to Pocko, read the existing import/auth/schema code so the design fits what's already there, and wrote this spec. **My recommendation: TrueLayer as the aggregator**, with GoCardless Bank Account Data ruled out (see below — it quietly stopped taking new signups) and Enable Banking as the fallback if TrueLayer's business onboarding is heavier than you want right now. This is a recommendation, not a decision I've made for you — read "Research" below and pick.

The one thing that matters most: **none of this works until you personally create an account with whichever provider you choose.** That's identity/KYB verification tied to you or Pocko as a business — I can't do it, an agent can't do it, and the code in this branch deliberately stops short of pretending to. I only got through research + this spec + a small amount of provider-agnostic scaffold (schema, a transaction-mapping helper, crypto helpers, stubbed API routes that 501, a disabled "Connect your bank" button). **No OAuth flow, no real API calls, no live feature.**

**What you need to do to unblock the next step:**
1. Read "Research" below and pick a provider — TrueLayer, Plaid, or Enable Banking (not GoCardless Bank Account Data — see why).
2. Sign up with that provider yourself (their dashboard, your email/identity). Expect a sales conversation or a KYB form for TrueLayer/Plaid; Enable Banking has a lighter self-serve tier if you want to keep testing on just your own Monzo account first.
3. Get sandbox credentials at minimum; production credentials once you're ready to test on a real linked account.
4. Set the provider's client ID/secret as env vars (names already in `.env.example`, values left blank) in `.env.local` and on Vercel — never commit the real values.
5. Generate a `BANK_TOKEN_ENC_KEY` (command's in `.env.example`) and set that too.
6. Read "The regulatory point" below before this goes anywhere near a second real user's bank account — it's not just an integration detail, it changes what "ready to ship" means.
7. Once 1–5 are done, hand this spec + branch to a coding session to build the real `api/bank/connect.js` / `callback.js` / `disconnect.js` and wire the UI button up — that's a milestone-sized piece of work on its own, not something to rush.

---

## Context

Pocko's current transaction data comes from two places: manual entry (`actions.addExpense`/`addIncome` in `src/store/store.js`) and a screenshot-of-statement import (`src/components/ImportSheet.jsx` → `/api/extract` → a vision LLM → `guessCategory` → user review → `actions.importTransactions`). The 2026-08-07 client-feedback brief (`docs/client-feedback/2026-08-07-redesign-brief.md`) already assumes a bank feed is coming — it drops "log spending" and "safe daily rate" *"assuming we can get open banking integrated"*, and notes *"once we get open banking, transactions will come from multiple banks which means we will also need to put in that table which account it was from... we need to use some AI or something to recognise certain merchants as certain categories of spending."* That AI-categorisation piece already exists (`guessCategory`) — this spec is about the wire, not the categorisation.

This document covers connecting a bank account (Monzo, and other UK banks) so transactions arrive automatically instead of via screenshot.

---

## Research: connecting a UK bank account

### Option 1 — Monzo's own Developer API (developers.monzo.com)

This is Monzo's public, free, self-serve API — but it is **not a path to a multi-user product**. Straight from their docs: *"The Monzo Developer API is not suitable for building public applications. You may only connect to your own account or those of a small set of users you explicitly allow."* OAuth2 access requires the account owner to approve the connection inside the Monzo app (Strong Customer Authentication via push notification), and no token gets any permissions until they do. There is no documented "certification" process to lift the whitelist to arbitrary users — the docs simply don't offer one; the API is scoped for personal tools and hackathon projects, full stop.

Separately, Monzo runs **docs.monzo.com/open-banking/** — a completely different surface, reserved for **licensed Third-Party Providers (TPPs)**: registered AISPs, PISPs, and card-based payment instrument issuers. Access requires Dynamic Client Registration (Open Banking spec v3.2) and a QWAC certificate proving FCA authorisation. This is the plumbing an aggregator (TrueLayer, Plaid, etc.) uses on the back end — it is not something Pocko would integrate with directly unless Sam personally becomes an FCA-authorised AISP, which is its own multi-month regulatory project (see "The regulatory point").

**Verdict:** fine for Sam to demo Pocko against his own Monzo account (or a handful of friends' accounts he explicitly whitelists in the Monzo developer console), useless as the mechanism for real users.

### Option 2 — An Open Banking aggregator

An aggregator is a company that already holds (or operates under) FCA AISP authorisation and re-sells API access to banks including Monzo, so Pocko never talks to Monzo's regulated Open Banking API directly.

| Provider | Free/self-serve sandbox? | Getting to production | UK coverage incl. Monzo | Notes |
|---|---|---|---|---|
| **GoCardless Bank Account Data** (formerly Nordigen) | Sandbox yes, but — | **New signups have been closed since July 2025.** GoCardless is repositioning it as enterprise-only. | Was broad, incl. Monzo | The brief assumed this had "a genuinely free tier" — that was true historically but **is stale as of this research**; it is not an option for a *new* integration right now. Existing accounts (pre-July-2025) keep working. |
| **TrueLayer** | Yes — instant self-serve signup at console.truelayer.com, no request limit in sandbox | Production requires a sales conversation (business verification) | 99%+ of UK accounts, incl. Monzo | Also sells identity/account-verification and income-check products on top of the same connectivity, if useful later. Usage-based production pricing, negotiated. |
| **Plaid** | No self-serve tier at all — enterprise procurement from the first conversation | Same — sales-led from the start | Covers Monzo, Barclays, HSBC, Lloyds, NatWest and ~2,000 European institutions | Free for the *end user*; the business pays. Heavier process than TrueLayer for a project Pocko's current size. |
| **Enable Banking** | Yes — self-serve signup, sandbox auto-activates | Two paths: full KYB + contract for unrestricted production, **or "restricted production"** — link only your own accounts, no KYB | Claims ~99% of UK banks | The newest entrant, positioned as GoCardless BAD's replacement. Its "restricted mode" is functionally similar to Monzo's own whitelist model (your accounts, or accounts you explicitly add) — a genuinely useful middle step for continued development without a business relationship yet. |

### The regulatory point (read this before shipping to a second real user)

Accessing someone else's bank account data in the UK is **PSD2/FCA-regulated**, full stop — this isn't a "before we write code" caveat, it's a "before this touches a second real student's real bank account" caveat, and it stays true regardless of which provider's SDK ends up in `package.json`.

There are two structurally different ways to be compliant:

1. **Register directly with the FCA as a RAISP** (Registered Account Information Service Provider). Pocko would carry its own compliance obligations, report to the FCA, and handle complaints under PSD2 directly. This process can take **up to a year** and is a real regulatory undertaking, not a form.
2. **Operate as an "agent" under an already-authorised AISP** — i.e. use an aggregator like TrueLayer, Plaid, or Enable Banking as more than just an API: they hold the AISP authorisation, and Pocko (or Sam personally, or a Pocko company entity) becomes their agent, working under *their* compliance umbrella. This is the fast path — weeks not months — and is what nearly every small fintech does. Sam still has to go through **that provider's own business/KYB onboarding**, agree to their terms as an agent, and stay within whatever compliance conditions they set (e.g. what Pocko is allowed to say to users about consent, how long data can be retained, what happens on a complaint).

**What this means concretely:** picking "TrueLayer" or "Plaid" as a technology choice does not, by itself, make Pocko compliant — it makes Pocko *able to become* compliant by completing that provider's agent-onboarding process, which is a business step, not a coding step. Sam should treat "get accepted as an AIS agent by [provider]" as its own checklist item, separate from and prior to "build the feature," if this is ever going to touch a real second user's real Monzo account. Testing against his *own* linked account (via Monzo's personal Developer API, or a provider's restricted/sandbox mode) doesn't require any of this — it's only real-user data that trips PSD2.

### Recommendation (Sam's call, not mine)

For where Pocko is today — a handful of trial students, still validating the pace maths, no bank feed live anywhere yet — I'd suggest:

- **Now, to keep building and demoing:** Enable Banking's restricted mode (Sam's own account only, no KYB) or Monzo's personal Developer API whitelist. Either lets the team see and iterate on the "Connect your bank" flow and the transaction-mapping end-to-end without any regulatory step.
- **When ready for real trial students:** TrueLayer, as the AIS agent onboarding, sandbox quality, and UK coverage are the most mature of the three real options, and its sales-gated production step is the same shape of work Plaid would require anyway. GoCardless Bank Account Data is off the table for a new integration. Plaid is a reasonable alternative if TrueLayer's business terms don't work out, but has no self-serve step at all — expect a slower start.
- **Only at real scale** (if the aggregator's cut or terms become a problem) would direct FCA RAISP registration be worth the year-long process.

---

## Data model

New tables (added to `schema.sql`, **not applied to any database** — see the header comment in that file):

- **`bank_connections`** (`user_id, id` composite PK, same pattern as every other child table) — `provider`, `institution_id`/`institution_name` (e.g. Monzo), `status` (`pending`/`active`/`expired`/`revoked`/`error`), `access_token_enc`/`refresh_token_enc` (never plaintext — see below), `token_expires_at`, `consent_expires_at`, `last_synced_at`.
- **`bank_accounts`** (`user_id, id` composite PK) — one row per linked account under a connection (some banks expose current + savings as separate accounts), `provider_account_id`, `display_name`, `currency`, `last_balance`/`last_balance_at`.
- Two new nullable columns on the existing **`transactions`** table: `bank_connection_id`, `bank_transaction_id`, plus a partial unique index `(user_id, bank_transaction_id) WHERE bank_transaction_id IS NOT NULL` so re-syncing an overlapping window can't double-import the same transaction. Every existing transaction (manual + screenshot import) leaves these `NULL` — nothing about today's data model changes.

Both new tables get the same **Row-Level Security** treatment as every other table (folded into the existing `foreach t in array [...]` loop in `schema.sql` rather than a second copy-pasted policy block).

**Token storage — the one hard requirement:** `access_token_enc`/`refresh_token_enc` are AES-256-GCM ciphertext, never plaintext, encrypted/decrypted only in `src/lib/bank-crypto.js` (server-only, Node's built-in `crypto`, no new dependency — same rule `src/lib/auth.js` follows for password hashing). The key (`BANK_TOKEN_ENC_KEY`) lives only as a Vercel/`.env.local` environment variable, never in the database, never in git. Tokens are **never** included in `src/lib/state-serialize.js`'s `rowsToState`/`stateToRows` — that file is the exact payload that reaches the browser on `GET /api/state`, so keeping bank tables out of it entirely is the whole ballgame for "never in client-side state." The client only ever sees connection *status* (connected / not, institution name, last synced) via a dedicated endpoint — never the tables' raw rows.

---

## Consent / connect UI flow

1. **Entry point:** "Connect your bank" in the account menu (`src/components/AccountMenu.jsx`) — **added tonight, but disabled** with a "Soon" badge (see below). When real, it opens the same kind of `<Sheet>` `ImportSheet.jsx` uses for screenshot import, not a full page.
2. **Start:** client calls `POST /api/bank/connect` (auth required, same session-cookie pattern as `/api/state`). Server calls the provider's "create a requisition / link token" endpoint, stores a `pending` `bank_connections` row, returns a `redirectUrl`.
3. **Consent:** client navigates the user to `redirectUrl` — the provider's own hosted bank-selection + consent UI (Sam never builds a bank login screen; that would be exactly the kind of thing that gets an app rejected/banned for phishing).
4. **Callback:** provider redirects back to `GET /api/bank/callback?...`. Server exchanges the code for tokens, encrypts them, marks the `bank_connections` row `active`, fetches + stores the linked `bank_accounts`, kicks off a first sync (below).
5. **Disconnect:** `POST /api/bank/disconnect` revokes the token **at the provider** (not just deletes the local row — an unrevoked token left live at the bank is a real security gap) and removes the `bank_connections`/`bank_accounts` rows. Transactions already imported stay (they're the user's real financial history) but their `bank_connection_id` now points at a deleted connection — the transaction list should show them as "from a bank you've disconnected," not silently break.

## How a bank transaction becomes a Pocko row

This is the part most likely to go wrong if built carelessly, so it's the one piece I built and unit-tested tonight (`src/lib/bank-transactions.js`) even though there's no real provider to feed it yet.

`ImportSheet.jsx`'s screenshot pipeline already has the target shape: after `/api/extract`, each row becomes `{ merchant, amount, date, category, include }`, where `category` is `'other'` for income and `guessCategory(merchant)` for anything else, and the whole array gets handed to `actions.importTransactions(rows)` (`src/store/store.js`), which assigns each row a fresh id and the final `{ id, type, label, amount, category, date }` shape that the finance engine (`src/engine/pace.js`, `calendar.js`, etc.) already consumes.

A bank-synced transaction should produce **exactly that same intermediate shape**, so it can go through the same `importTransactions` action — no parallel transaction model, no second categoriser. `mapBankTransaction()` in `src/lib/bank-transactions.js` does this: given a **normalized** `{ id, merchant, amount, date }` (amount negative = money out, matching `extract.js`'s convention), it returns `{ merchant, amount, date: normalizeDate(date), category, include: true }` using the identical `amount >= 0 ? 'other' : guessCategory(merchant)` rule `ImportSheet.jsx` uses.

"Normalized" is doing real work in that sentence: TrueLayer, GoCardless, Plaid and Enable Banking all name their transaction fields differently (TrueLayer: `transaction_id`/`description`; GoCardless BAD: `transactionId`/`remittanceInformationUnstructured`; Plaid: `transaction_id`/`merchant_name`). None of that per-provider translation exists yet — there's nothing to translate from without a real provider connected — but whichever gets built, its only job is to produce the small normalized shape above and hand it to `mapBankTransaction`, which is already written and tested.

**Open design question for whoever builds this for real:** should a first sync auto-import silently, or show the same review-and-untick screen `ImportSheet.jsx` already has? Given `guessCategory` is best-effort (keyword rules, not perfect), and the client brief's own worry about categorisation accuracy, I'd lean toward reusing the review screen for at least the first sync per connection — but that's a product call, not one I've made here.

---

## Sync strategy

- **First connect:** pull a bounded history window (providers typically support 90 days without extra consent scopes; Monzo/UK banks may offer more under PSD2's "wide" consent — confirm per-provider once one is chosen) and run it through the mapping + review flow above.
- **Ongoing:** most aggregators support **webhooks** for new-transaction pushes (TrueLayer and Enable Banking both do); GoCardless BAD historically required polling. Webhook-if-available, polling fallback is the pragmatic default — but this is exactly the kind of detail that's provider-specific and shouldn't be locked in before Sam picks one.
- **De-duplication:** the `uq_transactions_bank_txn` unique index (see Data model) is the actual enforcement point — a re-sync that re-fetches an overlapping window and re-maps the same provider transaction id simply fails the unique insert rather than double-counting it in the user's spending pace.
- **Token refresh:** access tokens expire; `token_expires_at` on `bank_connections` is there so a background job (or lazy check-on-sync) can refresh before a call fails, using the encrypted `refresh_token_enc`.
- **Consent expiry:** UK Open Banking consent typically expires (often ~90 days) regardless of token lifetime, and the user has to re-approve. `consent_expires_at` exists for the same reason — the connect UI should re-prompt before, not silently stop syncing and leave the user confused why last week's Deliveroo order never showed up.

---

## What's actually built tonight (and what isn't)

Committed on this branch, all provider-agnostic and unit-tested, **zero live behaviour change** (the app builds, all 356 existing + new tests pass):

- `schema.sql` — `bank_connections` + `bank_accounts` tables, RLS, and two new nullable columns on `transactions`. **Not applied to any database.**
- `src/lib/bank-crypto.js` (+ tests) — AES-256-GCM encrypt/decrypt for tokens at rest. Works today with a throwaway test key; nothing calls it in production.
- `src/lib/bank-transactions.js` (+ tests) — the normalized-transaction → Pocko-row mapping described above. This is real, working, tested logic — it's just not fed by anything yet.
- `src/lib/bank-handlers.js` + `api/bank/connect.js` / `callback.js` / `disconnect.js` (+ tests) — auth-gated, always return `501 { error: "Bank connections are not set up yet." }`. No provider client ID/secret is read or expected. Each has a `TODO: needs a real <PROVIDER>_CLIENT_ID once Sam signs up` comment pointing back here.
- `src/components/AccountMenu.jsx` — a **disabled** "Connect your bank" button with a "Soon" badge. Clicking it does nothing (it's a disabled `<button>`, no handler). Not a dead link, not a fake flow — visibly not-yet.
- `.env.example` — placeholder env var **names** for TrueLayer/GoCardless/Enable Banking and `BANK_TOKEN_ENC_KEY`, all commented out, all empty. No values, real or fake.

**Not built:** the actual OAuth/consent redirect, any real provider API call, the per-provider raw-payload adapter, webhook/polling sync, token refresh, the review-screen UI for a first sync, and — the load-bearing one — an actual account with any provider. This is a spec and a skeleton, not a feature.
