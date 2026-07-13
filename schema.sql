-- Leeway M6 cloud-sync schema. Apply once against Neon (SQL editor, or psql on
-- DATABASE_URL_UNPOOLED). One profiles row per user (the scalars) + one table
-- per client collection. Keyed by the Clerk user_id (text). Row-Level Security
-- is the structural backstop under the handler's app-level WHERE user_id filters.

create table if not exists profiles (
  user_id         text primary key,
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
    execute format($p$create policy %1$s_isolation on %1$I
      using (user_id = current_setting('app.user_id', true))
      with check (user_id = current_setting('app.user_id', true))$p$, t);
  end loop;
end $$;
