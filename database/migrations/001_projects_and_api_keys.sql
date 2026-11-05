-- Migration 001: projects and api_keys
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- One row per personal app (YATA, LEDGED, ...).
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  -- URL-friendly name, e.g. "yata" or "begin-again". Lowercase letters, numbers, single dashes.
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now()
);

-- API keys used by apps to call NEXUS. Only the SHA-256 hash of each key is stored.
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  -- "restrict" stops a project from being deleted while it still has keys.
  project_id   uuid not null references public.projects (id) on delete restrict,
  name         text not null check (char_length(name) between 1 and 100),
  key_prefix   text not null,          -- first few characters, for recognising a key
  key_hash     text not null unique,   -- unique also creates the lookup index
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz             -- null = active
);

create index api_keys_project_id_idx on public.api_keys (project_id);

-- Row Level Security ON with NO policies:
-- the public "anon"/"publishable" key can read or write nothing.
-- Only the NEXUS Worker, using the secret key, can access these tables.
alter table public.projects enable row level security;
alter table public.api_keys enable row level security;

