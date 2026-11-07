-- Migration 004: app_records (Project-scoped JSONB document storage)
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Lightweight, strictly project-isolated document table for personal apps.
-- Not a replacement for dedicated relational schemas when complex joins/transactions are needed.
create table public.app_records (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete restrict,

  -- Collection name: 1..64 chars, must start with lowercase letter/number, followed by [a-z0-9_-].
  collection  text not null check (
    char_length(collection) between 1 and 64
    and collection ~ '^[a-z0-9][a-z0-9_-]*$'
  ),

  -- Optional unique key within (project_id, collection): 1..128 safe identifier characters.
  record_key  text check (
    record_key is null
    or (
      char_length(record_key) between 1 and 128
      and record_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]*$'
    )
  ),

  -- Document payload: must be a JSON object ({ ... }) and at most 64 KB (65,536 UTF-8 bytes).
  data        jsonb not null default '{}'::jsonb check (
    jsonb_typeof(data) = 'object'
    and octet_length(data::text) <= 65536
  ),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Deterministic pagination index: sorts by (created_at, id) within (project_id, collection).
create index app_records_project_collection_created_id_idx
  on public.app_records (project_id, collection, created_at desc, id desc);

-- Enforces unique record_key per (project_id, collection) while allowing different projects
-- (or different collections) to use the same key name independently.
create unique index app_records_project_collection_key_uidx
  on public.app_records (project_id, collection, record_key)
  where record_key is not null;

-- Supports fast top-level JSONB equality filtering (data @> '{"field": "value"}').
create index app_records_data_gin_idx
  on public.app_records using gin (data jsonb_path_ops);

-- Row Level Security ON with NO policies:
-- the public publishable/anon key cannot read or modify anything.
-- Only the NEXUS Worker (using the server-side secret key + explicit project_id scoping) has access.
alter table public.app_records enable row level security;

