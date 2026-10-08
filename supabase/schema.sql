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
