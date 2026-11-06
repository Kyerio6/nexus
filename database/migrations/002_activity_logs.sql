-- Migration 002: activity_logs
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Records important administrative and security events across NEXUS.
create table public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  actor_type text not null check (actor_type in ('admin', 'api_key', 'system')),
  actor_id   text,
  action     text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index activity_logs_project_id_idx on public.activity_logs (project_id);

-- Row Level Security ON with NO policies:
-- only the NEXUS Worker (using the secret key) can read or write logs.
alter table public.activity_logs enable row level security;

