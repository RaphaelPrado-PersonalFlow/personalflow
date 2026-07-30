create table if not exists public.custom_exercises (
  id bigint primary key,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  aliases text not null default '',
  equipment text not null default '',
  movement text not null default '',
  type text not null default '',
  laterality text not null default '',
  level text not null default '',
  instructions text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_exercise_muscles (
  id bigint generated always as identity primary key,
  exercise_id bigint not null references public.custom_exercises(id) on delete cascade,
  muscle text not null,
  factor numeric not null default 1 check (factor >= 0),
  role text not null check (role in ('Principal', 'Secundário')),
  unique (exercise_id, muscle)
);

create index if not exists custom_exercises_professional_id_idx
  on public.custom_exercises(professional_id);
create index if not exists custom_exercise_muscles_exercise_id_idx
  on public.custom_exercise_muscles(exercise_id);

drop trigger if exists set_custom_exercises_updated_at on public.custom_exercises;
create trigger set_custom_exercises_updated_at
before update on public.custom_exercises
for each row execute function public.set_updated_at();

alter table public.custom_exercises enable row level security;
alter table public.custom_exercise_muscles enable row level security;

create policy "Professionals can view their custom exercises"
on public.custom_exercises for select to authenticated
using ((select auth.uid()) = professional_id);
create policy "Professionals can create their custom exercises"
on public.custom_exercises for insert to authenticated
with check ((select auth.uid()) = professional_id);
create policy "Professionals can update their custom exercises"
on public.custom_exercises for update to authenticated
using ((select auth.uid()) = professional_id)
with check ((select auth.uid()) = professional_id);
create policy "Professionals can delete their custom exercises"
on public.custom_exercises for delete to authenticated
using ((select auth.uid()) = professional_id);

create policy "Professionals can view muscles from their exercises"
on public.custom_exercise_muscles for select to authenticated
using (exists (
  select 1 from public.custom_exercises exercise
  where exercise.id = exercise_id
    and exercise.professional_id = (select auth.uid())
));
create policy "Professionals can create muscles for their exercises"
on public.custom_exercise_muscles for insert to authenticated
with check (exists (
  select 1 from public.custom_exercises exercise
  where exercise.id = exercise_id
    and exercise.professional_id = (select auth.uid())
));
create policy "Professionals can update muscles from their exercises"
on public.custom_exercise_muscles for update to authenticated
using (exists (
  select 1 from public.custom_exercises exercise
  where exercise.id = exercise_id
    and exercise.professional_id = (select auth.uid())
))
with check (exists (
  select 1 from public.custom_exercises exercise
  where exercise.id = exercise_id
    and exercise.professional_id = (select auth.uid())
));
create policy "Professionals can delete muscles from their exercises"
on public.custom_exercise_muscles for delete to authenticated
using (exists (
  select 1 from public.custom_exercises exercise
  where exercise.id = exercise_id
    and exercise.professional_id = (select auth.uid())
));

grant select, insert, update, delete on public.custom_exercises to authenticated;
grant select, insert, update, delete on public.custom_exercise_muscles to authenticated;
grant usage, select on sequence public.custom_exercise_muscles_id_seq to authenticated;
