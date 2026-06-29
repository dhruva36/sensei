-- Sensei — trip expense splitter schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once per project.
--
-- Security model: there is no end-user auth. All access goes through Next.js
-- server code using the SERVICE ROLE key, which bypasses RLS. We keep RLS
-- enabled with NO public policies so the anon/public key cannot read anything
-- directly. The per-trip `join_code` is the capability that gates access.

create extension if not exists "pgcrypto";

create table if not exists trips (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  currency    text not null default 'USD',
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- one member name per trip (case-insensitive)
create unique index if not exists members_trip_name_unique
  on members (trip_id, lower(name));

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  description text not null,
  amount      numeric(12, 2) not null check (amount > 0),
  paid_by     uuid not null references members (id) on delete cascade,
  split_type  text not null check (split_type in ('equal', 'amount', 'share')),
  created_at  timestamptz not null default now()
);

create table if not exists transaction_splits (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references transactions (id) on delete cascade,
  member_id       uuid not null references members (id) on delete cascade,
  -- meaning depends on the parent transaction's split_type:
  --   equal  -> ignored (every listed member shares equally)
  --   amount -> the exact money this member owes
  --   share  -> this member's relative weight / percentage
  weight          numeric not null default 1
);

-- Recorded payments: one member actually paid another to settle up. These are
-- folded into the net balances so settled debt stops showing as outstanding.
create table if not exists settlements (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  from_member uuid not null references members (id) on delete cascade,
  to_member   uuid not null references members (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_trip_idx on transactions (trip_id);
create index if not exists members_trip_idx on members (trip_id);
create index if not exists splits_txn_idx on transaction_splits (transaction_id);
create index if not exists settlements_trip_idx on settlements (trip_id);

-- Lock everything down to the service role only.
alter table trips enable row level security;
alter table members enable row level security;
alter table transactions enable row level security;
alter table transaction_splits enable row level security;
alter table settlements enable row level security;
-- (No policies created on purpose: anon/public key gets zero access.)
