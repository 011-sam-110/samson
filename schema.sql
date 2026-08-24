-- Leeway cloud schema. Apply once against Neon (SQL editor, or psql on
-- DATABASE_URL_UNPOOLED). `users` is the identity root (self-managed auth —
-- scrypt-salted password_hash, never a plaintext password). One profiles row per
-- user (the scalars) + one table per client collection, keyed by users.id (text).
-- Row-Level Security is the structural backstop under the handler's app-level
-- WHERE user_id filters. NOTE: `users` and `usage_events` are deliberately NOT under
-- RLS — the server reads/writes them directly (login by email, analytics) outside
-- the per-request app.user_id transaction, so RLS would (correctly) return zero rows.

create table if not exists users (
  id            text primary key,
  email         text        not null unique,
  username      text        not null,
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  last_login    timestamptz
);

create table if not exists profiles (
  user_id         text primary key references users(id) on delete cascade,
  balance         numeric     not null default 0,
  last_reconciled date,
  survive_until   date,
  schema_version  integer     not null default 3,
  updated_at      timestamptz not null default now()
);

create table if not exists transactions (
  user_id  text not null references profiles(user_id) on delete cascade,
  id       text not null,
  type     text,
  label    text,
  amount   numeric not null default 0,
  category text,
  date     date,
  primary key (user_id, id)
);

create table if not exists bills (
  user_id  text not null references profiles(user_id) on delete cascade,
  id       text not null,
  label    text,
  amount   numeric not null default 0,
  freq     text,
  next_due date,
  primary key (user_id, id)
);

create table if not exists income_sources (
  user_id   text not null references profiles(user_id) on delete cascade,
  id        text not null,
  label     text,
  kind      text,
  amount    numeric not null default 0,
  next_date date,
  primary key (user_id, id)
);

create table if not exists goals (
  user_id  text not null references profiles(user_id) on delete cascade,
  id       text not null,
  label    text,
  target   numeric not null default 0,
  saved    numeric not null default 0,
  deadline date,
  primary key (user_id, id)
);

create table if not exists events (
  user_id text not null references profiles(user_id) on delete cascade,
  id      text not null,
  label   text,
  amount  numeric not null default 0,
  date    date,
  primary key (user_id, id)
);

create table if not exists term_spans (
  user_id text not null references profiles(user_id) on delete cascade,
  id      text not null,
  kind    text,
  label   text,
  start   date,
  "end"   date,
  primary key (user_id, id)
);

-- v4: the dated goal contribution ledger. Saving pace needs to know WHEN money went
-- in, which a single running total on goals could never answer. goals.saved keeps its
-- name but now means the OPENING BALANCE — what was put aside before Pocko — and is
-- deliberately excluded from the pace (see src/engine/saving.js).
create table if not exists goal_contributions (
  user_id text not null references profiles(user_id) on delete cascade,
  id      text not null,
  goal_id text,
  amount  numeric not null default 0,
  date    date,
  primary key (user_id, id)
);

create index if not exists idx_transactions_user  on transactions(user_id);
create index if not exists idx_bills_user          on bills(user_id);
create index if not exists idx_income_sources_user on income_sources(user_id);
create index if not exists idx_goals_user          on goals(user_id);
create index if not exists idx_events_user         on events(user_id);
create index if not exists idx_term_spans_user     on term_spans(user_id);
create index if not exists idx_goal_contribs_user  on goal_contributions(user_id);

-- ============================================================================
-- v5 — Open Banking / bank feed. NEW TABLES, NOT YET APPLIED to any real
-- database (Neon or otherwise). Added 2026-08-24 alongside
-- docs/open-banking-spec.md as part of that spec, not a shipped feature.
-- Do NOT run scripts/apply-schema.mjs against production until Sam has: (1)
-- read that spec and picked a provider, (2) actually signed up with it himself
-- (an AI agent cannot do this — see the spec), and (3) generated a real
-- BANK_TOKEN_ENC_KEY (.env.example). Same composite-PK + RLS pattern as every
-- child table above, so it folds into the existing `foreach t in array [...]`
-- RLS loop below rather than inventing a new one.
-- ============================================================================
create table if not exists bank_connections (
  user_id             text not null references profiles(user_id) on delete cascade,
  id                  text not null,
  provider            text not null,   -- e.g. 'truelayer' | 'gocardless' | 'enablebanking' — Sam's choice, see spec
  institution_id      text,            -- provider's id for the bank (e.g. Monzo)
  institution_name    text,
  status              text not null default 'pending', -- pending | active | expired | revoked | error
  -- Tokens are ENCRYPTED AT REST (AES-256-GCM, see src/lib/bank-crypto.js) —
  -- never plaintext, never sent to the client, never part of the
  -- state-serialize.js payload that already reaches the browser.
  access_token_enc    text,
  refresh_token_enc   text,
  token_expires_at    timestamptz,
  consent_expires_at  timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists bank_accounts (
  user_id              text not null references profiles(user_id) on delete cascade,
  id                   text not null,
  connection_id        text not null,   -- bank_connections.id (same user_id — enforced app-side)
  provider_account_id  text not null,   -- provider's id for this specific account
  display_name         text,
  currency             text,
  last_balance         numeric,
  last_balance_at      timestamptz,
  created_at           timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_bank_connections_user on bank_connections(user_id);
create index if not exists idx_bank_accounts_user     on bank_accounts(user_id);
create index if not exists idx_bank_accounts_conn     on bank_accounts(user_id, connection_id);

-- Let a transaction record which bank connection it came from (client feedback,
-- 2026-08-07: "we will also need to put in that table which account it was
-- from"), and carry the provider's own transaction id so a re-sync can
-- de-duplicate instead of re-importing the same row. NULL for every
-- transaction today — manual entries and screenshot imports never set these;
-- only a future bank-synced row would. Not yet wired into
-- src/lib/state-serialize.js or api/state.js's CHILD map (see spec).
alter table transactions add column if not exists bank_connection_id text;
alter table transactions add column if not exists bank_transaction_id text;
create unique index if not exists uq_transactions_bank_txn
  on transactions(user_id, bank_transaction_id) where bank_transaction_id is not null;

-- Usage analytics: one row per user action, so we can see what the trial students
-- actually use most. Server-written only (verified user_id), so no RLS (see header).
create table if not exists usage_events (
  id         bigint generated always as identity primary key,
  user_id    text        not null references users(id) on delete cascade,
  event      text        not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_events_user  on usage_events(user_id);
create index if not exists idx_usage_events_event on usage_events(event);
create index if not exists idx_usage_events_time  on usage_events(created_at);

-- RLS: a row is visible/writable only when app.user_id equals its user_id. The
-- handler runs `SET LOCAL app.user_id = <verified sub>` at the top of each
-- transaction. `force` subjects the table owner too. `current_setting(..., true)`
-- returns NULL when unset, so an un-scoped connection sees zero rows (safe default).
do $$
declare t text;
begin
  foreach t in array array['profiles','transactions','bills','income_sources','goals','goal_contributions','events','term_spans','bank_connections','bank_accounts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    -- drop-then-create so re-applying this whole file is safe (idempotent).
    execute format('drop policy if exists %1$s_isolation on %1$I', t);
    execute format($p$create policy %1$s_isolation on %1$I
      using (user_id = current_setting('app.user_id', true))
      with check (user_id = current_setting('app.user_id', true))$p$, t);
  end loop;
end $$;
