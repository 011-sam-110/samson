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

create index if not exists idx_transactions_user  on transactions(user_id);
create index if not exists idx_bills_user          on bills(user_id);
create index if not exists idx_income_sources_user on income_sources(user_id);
create index if not exists idx_goals_user          on goals(user_id);
create index if not exists idx_events_user         on events(user_id);
create index if not exists idx_term_spans_user     on term_spans(user_id);

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
  foreach t in array array['profiles','transactions','bills','income_sources','goals','events','term_spans'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    -- drop-then-create so re-applying this whole file is safe (idempotent).
    execute format('drop policy if exists %1$s_isolation on %1$I', t);
    execute format($p$create policy %1$s_isolation on %1$I
      using (user_id = current_setting('app.user_id', true))
      with check (user_id = current_setting('app.user_id', true))$p$, t);
  end loop;
end $$;
