# Leeway — Cloud Accounts & Sync (design spec)

**Date:** 2026-07-12
**Status:** DESIGN APPROVED (decisions locked) — implementation plan not yet written; no code written.
**Milestones this spec covers:** M6 (backend spine) → M7 (client accounts + sync).
**How this was hardened:** a 7-agent fan-out workflow (3 API-research via context7, 1 codebase-mapper, 3 adversarial reviewers: security / sync-correctness / architecture-ops). 6/7 landed; the **sync-correctness reviewer failed twice on infra** (mid-response disconnect, then a 600s stall), so its target ★ angles below rest on first-principles analysis plus the security + architecture-ops reviews (which covered much of the same ground), **pending independent verification next session.**

---

## Context

Leeway's five product milestones (M1–M5) are all built and shipped. The app is a React 18 + Vite SPA in **plain JavaScript** (no TypeScript), unit-tested with Vitest, hosted on Vercel with two stateless serverless functions in `/api` (`extract.js`, `tips.js` — LLM proxies). **All user data lives in browser `localStorage`** (`src/store/store.js`, key `leeway:v1`) with client-side schema migrations (`src/store/migrate.js`, `CURRENT_VERSION = 3`) and manual JSON export/import (`src/lib/backup.js`). There is **no database, no accounts, no auth** today.

The client ("Pocko") wants a demo they can send to testers and measure retention on. That needs data to survive a browser clear and follow a user across devices — i.e. optional cloud accounts + sync — **without** disturbing the offline, no-signup app or its privacy pitch ("your money never leaves this device"). This spec adds that as an *upgrade layer*.

---

## Decisions locked (do not relitigate)

1. **Guest-first / optional accounts.** Anonymous users keep working fully offline via `localStorage`, exactly as today. Signing in is an upgrade that turns on cloud save + multi-device. Guests are unaffected. *(Preserves the client's on-device promise and keeps the tester demo zero-friction.)*
2. **Auth: Clerk.** Client via `@clerk/clerk-react`; server token verification via `@clerk/backend` inside the Vercel function. **Clerk owns the credential store — we never store passwords, only the opaque Clerk `user_id`.**
3. **Database: Neon Postgres** via the Vercel Marketplace, accessed with `@neondatabase/serverless`, **raw parameterized SQL** (no ORM — confirmed by two reviewers: plain-JS repo, tiny query surface).
4. **Normalized-at-rest + "sync the whole state" write model.** Normalized tables, but the client syncs the *entire* state atomically. *(User re-confirmed normalized over a JSONB single-row alternative, for future per-row analytics on the Pocko roadmap — accepting the extra mitigations below.)*
5. **The finance engine stays client-side and UNCHANGED.** The server only persists and serves rows; the client hydrates them back into the same in-memory `state` object the engine already consumes.

---

## Architecture

```
GUEST (default, unchanged)            SIGNED IN (upgrade)
  in-memory `state`                     in-memory `state`  ← same object, same engine
  └ save() → localStorage               ├ save() → localStorage (offline cache)
                                        └ save() → debounced PUT /api/state → Neon
  on load: localStorage                 on sign-in: GET /api/state → hydrate `state`
```

- Hosting stays on Vercel. New function `api/state.js` follows the existing `export default async function handler(req, res)` pattern.
- `vercel.json` needs **no change** — its rewrite `/((?!api/).*)` already excludes `/api/*`, so `api/state.js` is served automatically like the other two functions.

---

## Data model (`schema.sql`, new file)

Keyed by Clerk `user_id`. IDs reuse the client's `uid()` (`src/lib/id.js`) so client and server share keys.

- `profiles(user_id PK, balance, last_reconciled, survive_until, schema_version, updated_at)`
- `transactions(user_id, id, type, label, amount, category, date)`
- `bills(user_id, id, label, amount, freq, next_due)`
- `income_sources(user_id, id, label, kind, amount, next_date)`
- `goals(user_id, id, label, target, saved, deadline)`
- `events(user_id, id, label, amount, date)`
- `term_spans(user_id, id, kind, label, start, "end")`  — `end` is quoted (reserved-ish)

**Hardening baked in:**
- **Composite `PRIMARY KEY (user_id, id)`** on every child table (security finding) — prevents cross-user id-collision griefing; a global bare `id` PK would let one account's crafted row DoS another's sync.
- **FKs `on delete cascade`** to `profiles(user_id)`; **index each child on `user_id`**.
- **Postgres Row-Level Security** on every table (`USING (user_id = current_setting('app.user_id')::text)`), with the handler setting `app.user_id` from the verified JWT per request. Structural defense-in-depth so one forgotten `WHERE user_id` clause can't leak across users. *(Highest-leverage security fix.)*

---

## API — `api/state.js` (one endpoint, two verbs)

Both verbs **verify the Clerk session JWT** and scope every query to the token's `user_id`.

- **`GET /api/state`** → assemble the user's rows into **exactly** the client state shape `{ version, balance, lastReconciled, surviveUntil, incomeSources[], bills[], goals[], events[], termSpans[], transactions[] }`. Return `null` if the account has no `profiles` row yet. Run the read through the read-consistent snapshot (`sql.transaction([...], { readOnly: true })`) so the 7 SELECTs are one snapshot, and **run `migrate()` defensively** on the assembled object before returning.
- **`PUT /api/state`** → body is the full state. In **one atomic `sql.transaction([...])`**: upsert the `profiles` row and, per child table, `DELETE WHERE user_id = $1` + bulk insert via **`unnest($1::type[], …)`** (injection-safe, handles N=0 cleanly — no hand-built `VALUES` grid). Respond 204.

**Hardening baked in:**
- **Auth:** use `verifyToken(bearerString, { secretKey: CLERK_SECRET_KEY, authorizedParties: [<prod origin + preview pattern>] })` — the lower-level string API, **not** the cookie-aware `authenticateRequest()` (which needs a Fetch `Request` and would open a CSRF path on the destructive PUT). `sub` claim = `user_id`, taken **only** from the token, never the body. No `Access-Control-Allow-Origin` header.
- **Run `migrate.js` server-side on PUT before persisting** (and defensively on GET). It's a pure, DOM-free function. Store `profiles.schema_version` as the *post-migration* version (always `CURRENT_VERSION` at rest). Without this, the first schema bump or a stale open tab silently corrupts stored data.
- **Optimistic-concurrency guard:** client sends the `updated_at` it last read; server rejects a stale write with **409** (inside the transaction), forcing a re-GET before retry. Turns "overwrite in arrival order" into "safe last-write-wins in *recency* order" — closes the multi-device/multi-tab lost-update hole.
- **Strict server-side validation + size caps** on the PUT body before any SQL — mirror `backup.js:parseBackup()` (finite-number `balance`, required arrays), plus per-collection row caps, string-length caps, type/ISO-date checks. Build INSERT column lists from a **fixed server-side mapping**, never from client `Object.keys(row)`. Reject with 400 on deviation.
- **Driver / atomicity:** use the HTTP `neon()` client's **`sql.transaction([...])`** helper — it *is* a real server-side `BEGIN…COMMIT` in one round trip, and is serverless-friendly (no connection management, better cold start than `Pool`). Do **not** `await` the individual tagged queries (that executes them outside the transaction). Test the rollback path (force a failure on the last insert row; assert the DELETE rolled back).
- **Testability:** factor the GET/PUT core to take an **injected `sql` executor and an injected `verify(token)`** (the pattern `src/lib/llm.js` already uses with `fetchImpl`), so auth-reject branches, the empty-account-null case, generated-statement shape, and server-side `migrate()` are all unit-tested offline. A separate `test:integration` tier (gated on a real `DATABASE_URL_TEST`) runs true GET→PUT→GET round trips against an ephemeral Neon branch — **not** part of the fast `npm test`.

---

## Client changes (contained; engine + actions untouched)

- **`src/main.jsx`** — wrap `<App />` in `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>`. Must sit **above** `StoreProvider` (which will call Clerk hooks). Only place `ClerkProvider` goes.
- **`src/lib/state-serialize.js`** (new, pure, unit-tested) — `rowsToState()` / `stateToRows()`. **Coerce the round-trip gotchas:** Postgres `NUMERIC` returns as a JS **string** and `DATE` as a JS **Date**; coerce back to `Number` (`balance`, and each row's `amount` / `target` / `saved`) and to `'YYYY-MM-DD'` strings (all date fields: `lastReconciled`, `surviveUntil`, `nextDate`, `nextDue`, `deadline`, `date`, `start`, `end`). Always emit `[]` for empty collections (never `undefined` — the app's `|| []` guards would otherwise mask a fetch failure as "data vanished"). Round-trip identity test + explicit numeric-string case + null/missing `surviveUntil` case (note `clearAll()` omits `surviveUntil` entirely — treat as `null`).
- **`src/store/store.js`** — `StoreProvider` becomes auth-aware (Clerk `useAuth`/`useUser`):
  - **Separate hydration from user-mutation.** The existing `useEffect(() => save(state), [state])` (line ~40) fires on *every* state change **including hydration**. Add an **`isHydrating` ref/flag**: the debounced-PUT path checks it and skips the sync that a GET-then-`setState` would otherwise echo back. Arm sync **only after** hydration *and* any guest→account import prompt have resolved (prevents an unconsented PUT).
  - On sign-in: GET `/api/state`; if the account has data, `setState(migrate(fetched))`; if empty and local state is real (non-seed), run the import prompt.
  - Signed-in `save()` additionally fires a **debounced** authenticated PUT (send `getToken()` fresh per call as `Authorization: Bearer`). On sign-out: revert to `localStorage`.
  - `importData` / `resetDemo` / `clearAll` still go through `setState`, so the debounced PUT fires naturally after them.
- **`src/components/AccountMenu.jsx`** — the header comment "Leeway has no sign-in" (lines 7–11) is now false; rewrite it. Add **Sign in / Sign up** (`SignInButton`/`SignUpButton mode="modal"`) when signed out and **Sign out** (`UserButton` or `signOut()`) when signed in, as siblings of the existing Export/Import/Reset rows gated by `SignedIn`/`SignedOut`. The `menu-sub` "Saved on this device only" (line 96) becomes conditional ("Synced to your account" when signed in). Reuse the existing `confirm()`-style flow (mirrors `onImportFile`) for the guest→account import consent.
- **`vite.config.js`** — extend the dev `KEYS` allow-list (line 7) with `DATABASE_URL` and `CLERK_SECRET_KEY` so `api/state.js` works under `npm run dev`. No middleware change needed.
- **`package.json`** — add `@clerk/backend` + `@neondatabase/serverless` (M6), `@clerk/clerk-react` (M7); **pin `engines.node` to `22.x`** (repo has none today; don't trust a possibly-stale dashboard default). **Pin the Clerk package version explicitly** — Clerk's "Core 3" renames `@clerk/clerk-react`→`@clerk/react`; Core 2 (`@clerk/clerk-react ^5`) is LTS to Jan 2027, fine to use, but a bare `@latest` could jump the rename mid-build.

---

## Sync state machine & correctness rules

*(Confirmed by the security + architecture-ops reviews; the dedicated sync-correctness reviewer failed twice on infra, so the starred ★ items are first-principles rules to **independently stress-test before M7**.)*

- **Echo-on-hydrate:** guarded by the `isHydrating` flag above.
- **Recency:** the 409 optimistic-concurrency guard; pair with an `AbortController` so at most one PUT is in flight per user.
- **★ New-empty vs intentionally-cleared account:** GET returning `null` must mean "brand-new account" — but `clearAll()` produces a legitimately empty state the user *chose*. Rule to finalize: once an account exists (has a `profiles` row), it is never treated as "new" again; a cleared account persists an empty-but-present state (so a second device doesn't resurrect data from a stale local cache, and a deliberate clear isn't re-seeded from local/seed data). Distinguish "real local data" from the seed demo before offering import.
- **★ Flush-on-unload / logout:** flush the pending debounced PUT on `visibilitychange`/`pagehide`, and await a final sync before Clerk `signOut()`, so the last change isn't dropped inside the debounce window.
- **★ Multi-tab (same account):** the 409 recency guard is the likely-sufficient minimum for a demo; `BroadcastChannel`/storage-events optional.
- **★ Offline → online:** `localStorage` remains the working cache; a queued PUT on reconnect is subject to the same 409 recency check.
- **Destructive-overwrite safety:** snapshot the prior state (a `state_history` row) before a replace, or rely on Neon PITR; extend the explicit confirm-before-overwrite UX to the existing-account conflict case, not just empty-account import.

---

## Security posture (answers the "safe credential storage" requirement)

- **We never store passwords.** Clerk salts + hashes on its infra (plus reset / verification / MFA / breach checks); we persist only the opaque `user_id`. Strictly safer than rolling our own hashing.
- **No client-side hashing** — TLS protects transit; hashing on the client just makes the hash the password.
- **Per-user isolation:** RLS (structural) under per-query `WHERE user_id` (application). Financial data encrypted at rest by Neon; TLS in transit.
- **Header-only auth + `authorizedParties`**, no CORS header (blocks token-audience confusion and CSRF-forged PUTs). Composite PK. Strict PUT validation + size caps + rate limiting (rate limiting deferrable for the demo).
- **Secret hygiene:** the live-looking Groq key in `.env.local` was **verified NOT in git history** (`git log --all -p`) — but the repo is **public on GitHub**, so rotate it on principle and add **CI secret-scanning** (gitleaks/trufflehog) before `CLERK_SECRET_KEY` / `DATABASE_URL` join that file. `DATABASE_URL` and `CLERK_SECRET_KEY` stay server-only — **never** `VITE_`-prefixed (a `VITE_` secret ships in the client bundle).

---

## Provisioning checklist (from the Vercel-research agent)

1. `vercel link` the repo to the existing project.
2. Marketplace → install **Neon** → connect to project for Dev/Preview/Prod (enable preview branching). Injects `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct).
3. Integrations → install **Clerk** → connect. Injects `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. **Manually add `VITE_CLERK_PUBLISHABLE_KEY`** (mirror value) to Dev/Preview/Prod — the Marketplace injects the Next-flavored name, which a Vite bundle can't see. Re-add after any `vercel env pull` (it overwrites `.env.local`).
5. `vercel env pull .env.local --yes`; confirm the three vars via `vercel env ls` (names only).
6. Add `engines.node: "22.x"`; commit.
7. `npm install @neondatabase/serverless @clerk/backend` (add `@clerk/clerk-react` at M7).
8. Apply `schema.sql` once against Neon (SQL editor / psql on `DATABASE_URL_UNPOOLED`).

---

## Milestone decomposition (per Sam's per-milestone loop)

- **M6 — Backend spine.** Provision Neon + Clerk, `schema.sql` (tables + composite PKs + RLS + indexes), Clerk server verification, `state-serialize.js` (unit-tested), `api/state.js` (GET+PUT, auth-guarded, validated, `migrate()`-on-write, `sql.transaction()` atomic, 409 recency). **Zero client-visible change** — guests unaffected. **Tightened Definition of Done:** one scripted **live** integration proof — GET(empty) → PUT → GET(matches) over real HTTP against a Neon branch with a Clerk test-mode JWT — *before* M7, so a backend bug can't hide behind M7's UI work. Branch → verify → merge + push.
- **M7 — Client accounts & sync.** `ClerkProvider`, sign-in UI in `AccountMenu`, auth-aware store (hydrate + `isHydrating` guard + debounced sync + flush-on-unload + sign-out fallback), guest→account import, basic offline retry. Verify by **driving the app** (sign up, enter data, reload, second browser/incognito for multi-device). If scope pressure appears, M7 splits cleanly along hydrate / ongoing-sync / import seams without touching M6. Branch → verify → merge + push.

---

## Out of scope (YAGNI for the demo)

Conflict-resolution / CRDT (last-write-wins + 409 recency suffices), R2 / blob storage (no blobs), Cloudflare (staying on Vercel), Open Banking, any server-side finance computation (engine stays client-side), a public REST API. Statement screenshots remain unstored (privacy).

---

## Outstanding before implementation

1. **Independently stress-test the ★ sync rules** — the dedicated sync-correctness review failed twice on infra, so re-run it (or hand-verify) before M7, especially the exact new-vs-cleared-account rule.
2. **Write the implementation plan** (writing-plans) → then fan out **xhigh-Sonnet** builders for M6 → M7.
3. Confirm the Clerk package choice (`@clerk/clerk-react` Core 2 vs `@clerk/react` Core 3) at install.
