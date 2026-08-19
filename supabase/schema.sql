-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- One row per person who can log in. Extends Supabase's built-in auth.users.
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  branch text,
  dashboard_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Runs as the table owner (bypasses RLS) so it can be safely called
-- from inside RLS policies below without causing infinite recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Every signed-in person can read their own row; admins can read everyone's.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles for select
using (auth.uid() = id or public.is_admin());

-- Only admins can create, edit, or delete profile rows directly.
-- (In practice the app does this through the service-role API routes,
-- these policies are defense in depth for direct table access.)
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
on public.profiles for insert
with check (public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
on public.profiles for update
using (public.is_admin());

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete"
on public.profiles for delete
using (public.is_admin());
