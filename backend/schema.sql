-- JC Command Center - Phase 1 schema.
-- events and dashboard_layouts are NOT here: they land in P2 and P3 with the
-- code that uses them. account_id is here from day one because adding it later
-- means migrating every table (SaaS is on the roadmap).

create extension if not exists pgcrypto;

create table if not exists accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  email          text not null unique,
  password_hash  text not null,
  name           text,
  role           text not null default 'client' check (role in ('admin','client')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists users_account_idx on users(account_id);

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  status        text not null default 'Todo'
                check (status in ('Todo','In Progress','Done','Cancelled')),
  priority      text check (priority in ('SOS','High','Medium','Low')),
  owner         text,
  client        text,
  category      text,
  project       text,
  deadline      timestamptz,
  start_date    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_user_status_idx   on tasks(user_id, status);
create index if not exists tasks_user_deadline_idx on tasks(user_id, deadline);

-- Phase 2 -------------------------------------------------------------------

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  title       text not null,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  location    text,
  attendees   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_end_after_start check (end_at > start_at)
);
create index if not exists events_user_start_idx on events(user_id, start_at);
