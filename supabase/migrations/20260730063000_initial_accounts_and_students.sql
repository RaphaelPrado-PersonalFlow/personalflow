create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'professional'
    check (role in ('professional', 'student')),
  full_name text not null default '',
  professional_name text,
  cref text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  preferred_name text,
  birth_date date,
  sex text check (sex in ('male', 'female', 'other', 'not_informed')),
  email text,
  cpf text,
  phone text,
  goal text,
  profession text,
  restrictions text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'inactive', 'archived')),
  started_on date,
  emergency_contact_name text,
  emergency_contact_phone text,
  planned_weekly_frequency smallint
    check (planned_weekly_frequency between 1 and 14),
  default_session_minutes smallint
    check (default_session_minutes between 10 and 360),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists students_professional_cpf_key
  on public.students (professional_id, cpf)
  where cpf is not null and cpf <> '';

create index if not exists students_professional_id_idx
  on public.students (professional_id);

create index if not exists students_user_id_idx
  on public.students (user_id);

alter table public.profiles enable row level security;
alter table public.students enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'professional'),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "students_select_owner_or_self" on public.students;
create policy "students_select_owner_or_self"
on public.students
for select
to authenticated
using (
  (select auth.uid()) = professional_id
  or (select auth.uid()) = user_id
);

drop policy if exists "students_insert_owner" on public.students;
create policy "students_insert_owner"
on public.students
for insert
to authenticated
with check ((select auth.uid()) = professional_id);

drop policy if exists "students_update_owner" on public.students;
create policy "students_update_owner"
on public.students
for update
to authenticated
using ((select auth.uid()) = professional_id)
with check ((select auth.uid()) = professional_id);

drop policy if exists "students_delete_owner" on public.students;
create policy "students_delete_owner"
on public.students
for delete
to authenticated
using ((select auth.uid()) = professional_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.students to authenticated;
