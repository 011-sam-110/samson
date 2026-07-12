# Leeway M3 — AI Features (statement import + tips) Design

Status: Design — building key-independent core; AI paths await a working Groq key.
Depends on: M1 (categories), M2 (analytics facts). Introduces Leeway's first backend.

## What it delivers

1. **Bank-screenshot import** (Sam's headline request): upload a screenshot of bank transactions →
   a vision LLM extracts `[{date, merchant, amount}]` → **user reviews/edits the list** → import as
   transactions (auto-categorised). Never blind-trusted into the balance.
2. **Cut-back tips**: M2 engine facts → LLM writes short, student-toned advice. LLM writes words,
   never does arithmetic.
3. **Recurring detection** (deterministic, no AI): from the ledger, spot repeating merchants at a
   regular cadence → offer to add them as recurring bills/subscriptions ("knows what you spend on
   consistently").

## Architecture

First backend: Vercel serverless functions under `/api`. Locally, a **Vite dev middleware** mounts
the same handlers into `npm run dev` (no Vercel CLI / login needed). Same handler files deploy to
Vercel unchanged.

- `api/_llm.js` — **rotating provider pool** over OpenAI-compatible providers. Built from whichever
  keys are present in env (Sam's own keys). Fails over on 429/5xx to the next provider. This is the
  "put my collection of api keys in" mechanism. Key-independent, unit-tested with a mocked fetch.
- `api/extract.js` — POST an image (data URL) → `_llm` with a vision model + extraction prompt →
  returns `{ transactions: [{date, merchant, amount}] }`. Robust JSON parsing.
- `api/tips.js` — POST computed facts → `_llm` text model → `{ tip }`.
- `src/engine/recurring.js` — pure `detectRecurring(transactions, opts)`; unit-tested.
- UI: an **Import** flow (upload → review/edit table → confirm) reachable from Transactions; a
  **Tips** card on Insights; recurring suggestions surfaced after import.

### Provider pool (`api/_llm.js`)

Ordered by preference; only providers with a key present are used:

| Provider | Base URL | Text model | Vision model | Key env |
|---|---|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `meta-llama/llama-4-scout-17b-16e-instruct` | `GROQ_API_KEY` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | `GEMINI_API_KEY` |
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | (a current `:free` VL model) | `OPENROUTER_API_KEY` |

All OpenAI-compatible → one client, per-provider `{base, key, model}`. `callLLM` tries each in
order, skipping 429/5xx, returning the first success.

### Config / security

- Keys live in `.env.local` (gitignored via `*.local`) locally, and Vercel env vars in prod. Never
  in the client bundle (no `VITE_` prefix) — they're only read server-side in `/api`.
- `.env.example` documents the accepted keys (no secrets, committed).
- `vercel.json` rewrite must exclude `/api`: `"/((?!api/).*)"` → `/` so functions aren't swallowed
  by the SPA fallback.
- **Privacy:** the import UI states plainly that the screenshot is sent to the configured LLM
  provider; opt-in per use.

## Build order

1. **`api/_llm.js` + tests** — provider pool + failover (key-independent). ← building now
2. **`src/engine/recurring.js` + tests** — deterministic recurring detection. ← building now
3. `api/extract.js`, `api/tips.js` + Vite dev middleware + vercel.json fix — needs a key to verify.
4. Import review UI + Tips card + recurring suggestions — needs a key to verify end-to-end.

Steps 3-4 wait for Sam's Groq key so the AI path is verified, not assumed.

## Out of scope

- Open-banking (real automation, far future). Editing extraction models per-bank. M5 calendar.

## Success criteria

- `callLLM` fails over correctly (mocked): 429 on provider 1 → success on provider 2; throws only
  when all fail; `buildPool` includes only providers with a key.
- `detectRecurring` finds regular-cadence repeats and ignores one-offs/irregular (unit-tested).
- With a real key: upload a sample statement screenshot → sensible extracted rows → review → import.
- No key in the client bundle; existing 60 tests stay green.
