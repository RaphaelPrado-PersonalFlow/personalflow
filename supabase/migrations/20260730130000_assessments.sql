create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_date date not null default current_date,
  assessment_type text not null check (assessment_type in ('initial', 'reassessment')),
  biological_sex text,
  age integer,
  protocol text,
  weight_kg numeric(7,2) not null,
  height_m numeric(4,2) not null,
  body_fat_percentage numeric(5,2) not null,
  lean_mass_kg numeric(7,2) not null,
  waist_cm numeric(6,2) not null default 0,
  notes text,
  circumferences jsonb not null default '{}'::jsonb,
  skinfolds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessments_professional_id_idx on public.assessments(professional_id);
create index if not exists assessments_student_date_idx on public.assessments(student_id, assessment_date desc);

alter table public.assessments enable row level security;

drop policy if exists "Professionals can read own assessments" on public.assessments;
create policy "Professionals can read own assessments" on public.assessments
  for select to authenticated using ((select auth.uid()) = professional_id);
drop policy if exists "Professionals can create own assessments" on public.assessments;
create policy "Professionals can create own assessments" on public.assessments
  for insert to authenticated with check ((select auth.uid()) = professional_id);
drop policy if exists "Professionals can update own assessments" on public.assessments;
create policy "Professionals can update own assessments" on public.assessments
  for update to authenticated using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);
drop policy if exists "Professionals can delete own assessments" on public.assessments;
create policy "Professionals can delete own assessments" on public.assessments
  for delete to authenticated using ((select auth.uid()) = professional_id);

grant select, insert, update, delete on public.assessments to authenticated;

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
before update on public.assessments
for each row execute function public.set_updated_at();
