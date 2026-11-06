-- Migration 003: media_assets
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Stores metadata for files and images uploaded to Cloudflare R2.
-- The actual file bytes live in R2 under storage_key.
create table public.media_assets (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete restrict,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_key       text not null unique,
  mime_type         text not null,
  size_bytes        bigint not null check (size_bytes > 0),
  visibility        text not null default 'private' check (visibility in ('public', 'private')),
  created_at        timestamptz not null default now()
);

create index media_assets_project_created_idx on public.media_assets (project_id, created_at desc);

-- Row Level Security ON with NO policies:
-- only the NEXUS Worker (using the secret key) can access this table.
alter table public.media_assets enable row level security;

