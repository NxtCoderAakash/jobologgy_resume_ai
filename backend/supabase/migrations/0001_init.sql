-- Jobologgy — AI Resume Optimizer — initial schema, RLS, and storage buckets.
-- Run this in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_description text not null,
  original_text text,
  ats_before int,
  ats_after int,
  analysis jsonb not null,
  original_file_path text,
  cv_pdf_path text,
  report_pdf_path text,
  created_at timestamptz not null default now()
);

create index if not exists resume_jobs_user_id_created_at_idx
  on public.resume_jobs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.resume_jobs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- resume_jobs: users can only see/insert/delete their own rows.
-- (Inserts are performed by the backend with the service-role key, which bypasses RLS,
--  but these policies keep direct client access safe.)
drop policy if exists "resume_jobs_select_own" on public.resume_jobs;
create policy "resume_jobs_select_own" on public.resume_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "resume_jobs_insert_own" on public.resume_jobs;
create policy "resume_jobs_insert_own" on public.resume_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "resume_jobs_delete_own" on public.resume_jobs;
create policy "resume_jobs_delete_own" on public.resume_jobs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('generated', 'generated', false)
on conflict (id) do nothing;

-- Storage RLS: a user may access only objects under a top-level folder equal to their uid.
-- Paths are written by the backend as `<user_id>/<job_id>/<file>`.
drop policy if exists "uploads_own_folder" on storage.objects;
create policy "uploads_own_folder" on storage.objects
  for all
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "generated_own_folder" on storage.objects;
create policy "generated_own_folder" on storage.objects
  for all
  using (bucket_id = 'generated' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'generated' and (storage.foldername(name))[1] = auth.uid()::text);
