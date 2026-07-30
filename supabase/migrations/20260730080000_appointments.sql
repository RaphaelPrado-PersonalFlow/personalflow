create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  type text not null check (type in ('training', 'assessment', 'reassessment')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'waiting', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  recurrence_group_id uuid,
  rescheduled_from_id uuid references public.appointments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_time check (ends_at > starts_at)
);

create index if not exists appointments_professional_starts_at_idx
  on public.appointments (professional_id, starts_at);

create index if not exists appointments_student_starts_at_idx
  on public.appointments (student_id, starts_at);

alter table public.appointments enable row level security;

create policy "Professionals can read own appointments"
  on public.appointments for select
  to authenticated
  using (professional_id = auth.uid());

create policy "Professionals can create own appointments"
  on public.appointments for insert
  to authenticated
  with check (professional_id = auth.uid());

create policy "Professionals can update own appointments"
  on public.appointments for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "Professionals can delete own appointments"
  on public.appointments for delete
  to authenticated
  using (professional_id = auth.uid());

create policy "Students can read their own appointments"
  on public.appointments for select
  to authenticated
  using (
    exists (
      select 1
      from public.students
      where students.id = appointments.student_id
        and students.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.appointments to authenticated;
