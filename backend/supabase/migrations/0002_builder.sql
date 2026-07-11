-- Jobologgy — Résumé Studio (builder) — drafts table + RLS.
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).

create table if not exists public.resume_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled résumé',
  cv jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resume_drafts_user_id_updated_at_idx
  on public.resume_drafts (user_id, updated_at desc);

alter table public.resume_drafts enable row level security;

drop policy if exists "resume_drafts_select_own" on public.resume_drafts;
create policy "resume_drafts_select_own" on public.resume_drafts
  for select using (auth.uid() = user_id);

drop policy if exists "resume_drafts_insert_own" on public.resume_drafts;
create policy "resume_drafts_insert_own" on public.resume_drafts
  for insert with check (auth.uid() = user_id);

drop policy if exists "resume_drafts_update_own" on public.resume_drafts;
create policy "resume_drafts_update_own" on public.resume_drafts
  for update using (auth.uid() = user_id);

drop policy if exists "resume_drafts_delete_own" on public.resume_drafts;
create policy "resume_drafts_delete_own" on public.resume_drafts
  for delete using (auth.uid() = user_id);
