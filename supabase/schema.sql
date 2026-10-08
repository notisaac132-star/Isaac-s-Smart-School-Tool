-- Database setup for Smart School Tool accounts.
-- Paste this into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('teacher', 'tutor')),
  name text not null check (char_length(name) between 1 and 200),
  subject text not null default '' check (char_length(subject) <= 200),
  email text not null check (char_length(email) between 3 and 320),
  created_at timestamptz not null default now()
);

create index if not exists contacts_user_id_idx on public.contacts (user_id);

-- Row Level Security: every account can only see and change its own contacts.
alter table public.contacts enable row level security;

drop policy if exists "Read own contacts" on public.contacts;
create policy "Read own contacts" on public.contacts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own contacts" on public.contacts;
create policy "Add own contacts" on public.contacts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Edit own contacts" on public.contacts;
create policy "Edit own contacts" on public.contacts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own contacts" on public.contacts;
create policy "Delete own contacts" on public.contacts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Weekly study reports (added later; safe to run again)
-- ---------------------------------------------------------------------------

-- Which contacts get the weekly study report (on for teachers by default).
alter table public.contacts add column if not exists reports boolean not null default true;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  minutes integer not null check (minutes between 1 and 1440),
  studied_on date not null default current_date,
  notes text not null default '' check (char_length(notes) <= 2000),
  -- Set by the weekly report job once the session has been emailed to the teachers.
  reported_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists study_sessions_user_id_idx on public.study_sessions (user_id);
create index if not exists study_sessions_unreported_idx on public.study_sessions (user_id) where reported_at is null;

alter table public.study_sessions enable row level security;

drop policy if exists "Read own study sessions" on public.study_sessions;
create policy "Read own study sessions" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own study sessions" on public.study_sessions;
create policy "Add own study sessions" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id and reported_at is null);

drop policy if exists "Delete own unreported study sessions" on public.study_sessions;
create policy "Delete own unreported study sessions" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id and reported_at is null);

-- Students can change whether a contact gets reports (and fix typos) on their own contacts.
-- (The "Edit own contacts" policy above already allows this.)
