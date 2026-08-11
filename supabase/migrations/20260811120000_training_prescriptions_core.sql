alter table public.students
  add constraint students_id_professional_id_key unique (id, professional_id);

alter table public.custom_exercises
  add constraint custom_exercises_id_professional_id_key unique (id, professional_id);

create table public.training_protocols (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null,
  name text not null,
  objective text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'completed', 'cancelled', 'archived')),
  start_date date,
  end_date date,
  planned_weekly_frequency smallint not null default 1
    check (planned_weekly_frequency between 1 and 14),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_protocols_valid_dates check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint training_protocols_student_owner_fk
    foreign key (student_id, professional_id)
    references public.students(id, professional_id) on delete cascade,
  unique (id, professional_id)
);

create table public.training_periods (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  protocol_id uuid not null,
  name text not null,
  sequence smallint not null check (sequence > 0),
  start_date date,
  end_date date,
  objective text,
  planned_weekly_frequency smallint check (planned_weekly_frequency between 1 and 14),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_periods_valid_dates check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint training_periods_protocol_owner_fk
    foreign key (protocol_id, professional_id)
    references public.training_protocols(id, professional_id) on delete cascade,
  unique (protocol_id, sequence),
  unique (id, professional_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  period_id uuid not null,
  lineage_id uuid not null default gen_random_uuid(),
  version integer not null default 1 check (version > 0),
  supersedes_workout_id uuid references public.workouts(id) on delete restrict,
  is_current boolean not null default true,
  published_at timestamptz,
  name text not null,
  focus text not null default '',
  sequence smallint not null check (sequence > 0),
  estimated_duration_minutes smallint check (estimated_duration_minutes between 1 and 1440),
  target_executions integer check (target_executions > 0),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_period_owner_fk
    foreign key (period_id, professional_id)
    references public.training_periods(id, professional_id) on delete cascade,
  unique (lineage_id, version, professional_id),
  unique (id, professional_id),
  unique (id, period_id, professional_id)
);

create unique index workouts_one_current_version_idx
  on public.workouts(lineage_id, professional_id) where is_current;
create unique index workouts_current_period_sequence_idx
  on public.workouts(period_id, sequence) where is_current;

create table public.period_workout_slots (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  period_id uuid not null,
  workout_id uuid not null,
  weekday smallint check (weekday between 0 and 6),
  sequence_in_week smallint not null check (sequence_in_week > 0),
  occurrences_per_week smallint not null default 1 check (occurrences_per_week between 1 and 14),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint period_workout_slots_period_owner_fk
    foreign key (period_id, professional_id)
    references public.training_periods(id, professional_id) on delete cascade,
  constraint period_workout_slots_workout_period_owner_fk
    foreign key (workout_id, period_id, professional_id)
    references public.workouts(id, period_id, professional_id) on delete cascade,
  unique (period_id, sequence_in_week),
  unique (id, professional_id)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null,
  exercise_source text not null check (exercise_source in ('system', 'custom')),
  system_exercise_id bigint,
  custom_exercise_id bigint,
  exercise_name_snapshot text not null,
  exercise_metadata_snapshot jsonb not null default '{}'::jsonb,
  position smallint not null check (position > 0),
  instructions text,
  rest_between_sets_seconds integer check (rest_between_sets_seconds >= 0),
  tempo text,
  rir_target_min numeric(4,1),
  rir_target_max numeric(4,1),
  rpe_target numeric(4,1),
  load_notes text,
  group_key uuid,
  group_position smallint check (group_position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_exercises_workout_owner_fk
    foreign key (workout_id, professional_id)
    references public.workouts(id, professional_id) on delete cascade,
  constraint workout_exercises_custom_owner_fk
    foreign key (custom_exercise_id, professional_id)
    references public.custom_exercises(id, professional_id) on delete restrict,
  constraint workout_exercises_exactly_one_source check (
    (exercise_source = 'system' and system_exercise_id is not null and system_exercise_id > 0 and custom_exercise_id is null)
    or
    (exercise_source = 'custom' and custom_exercise_id is not null and system_exercise_id is null)
  ),
  constraint workout_exercises_valid_rir check (
    rir_target_min is null or rir_target_max is null or rir_target_max >= rir_target_min
  ),
  unique (workout_id, position),
  unique (id, professional_id)
);

create table public.prescribed_sets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  workout_exercise_id uuid not null,
  set_number smallint not null check (set_number > 0),
  set_type text not null default 'working'
    check (set_type in ('warmup', 'working', 'backoff', 'failure', 'technique')),
  method text not null default 'conventional'
    check (method in ('conventional', 'drop_set', 'rest_pause', 'cluster', 'pyramid', 'myo_reps', 'bi_set')),
  reps_min numeric(7,2) check (reps_min >= 0),
  reps_max numeric(7,2) check (reps_max >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  distance_meters numeric(10,2) check (distance_meters >= 0),
  target_load numeric(10,2) check (target_load >= 0),
  load_unit text not null default 'kg' check (load_unit in ('kg', 'lb', 'percent_1rm', 'bodyweight')),
  load_percentage numeric(6,2) check (load_percentage between 0 and 1000),
  rir_target numeric(4,1),
  rpe_target numeric(4,1),
  rest_after_seconds integer check (rest_after_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescribed_sets_exercise_owner_fk
    foreign key (workout_exercise_id, professional_id)
    references public.workout_exercises(id, professional_id) on delete cascade,
  constraint prescribed_sets_valid_reps check (
    reps_min is null or reps_max is null or reps_max >= reps_min
  ),
  constraint prescribed_sets_has_target check (
    reps_min is not null or reps_max is not null or duration_seconds is not null or distance_meters is not null
  ),
  unique (workout_exercise_id, set_number),
  unique (id, professional_id)
);

create index training_protocols_owner_student_status_idx
  on public.training_protocols(professional_id, student_id, status);
create index training_periods_protocol_sequence_idx on public.training_periods(protocol_id, sequence);
create index workouts_period_current_sequence_idx on public.workouts(period_id, is_current, sequence);
create index period_workout_slots_period_sequence_idx on public.period_workout_slots(period_id, sequence_in_week);
create index workout_exercises_workout_position_idx on public.workout_exercises(workout_id, position);
create index prescribed_sets_exercise_number_idx on public.prescribed_sets(workout_exercise_id, set_number);

create trigger training_protocols_set_updated_at before update on public.training_protocols
  for each row execute function public.set_updated_at();
create trigger training_periods_set_updated_at before update on public.training_periods
  for each row execute function public.set_updated_at();
create trigger workouts_set_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();
create trigger period_workout_slots_set_updated_at before update on public.period_workout_slots
  for each row execute function public.set_updated_at();
create trigger workout_exercises_set_updated_at before update on public.workout_exercises
  for each row execute function public.set_updated_at();
create trigger prescribed_sets_set_updated_at before update on public.prescribed_sets
  for each row execute function public.set_updated_at();

alter table public.training_protocols enable row level security;
alter table public.training_periods enable row level security;
alter table public.workouts enable row level security;
alter table public.period_workout_slots enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.prescribed_sets enable row level security;

create policy training_protocols_owner_all on public.training_protocols
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

create policy training_periods_owner_all on public.training_periods
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

create policy workouts_owner_all on public.workouts
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

create policy period_workout_slots_owner_all on public.period_workout_slots
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

create policy workout_exercises_owner_all on public.workout_exercises
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

create policy prescribed_sets_owner_all on public.prescribed_sets
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

grant select, insert, update, delete on public.training_protocols to authenticated;
grant select, insert, update, delete on public.training_periods to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.period_workout_slots to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.prescribed_sets to authenticated;

create or replace function public.save_training_prescription(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  protocol_id uuid := (payload ->> 'id')::uuid;
  period_data jsonb;
  workout_data jsonb;
  exercise_data jsonb;
  set_data jsonb;
  period_id uuid;
  workout_id uuid;
  exercise_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.students
    where id = (payload ->> 'student_id')::uuid
      and professional_id = owner_id
  ) then
    raise exception 'Student does not belong to the authenticated professional' using errcode = '42501';
  end if;

  insert into public.training_protocols (
    id, professional_id, student_id, name, objective, status, start_date, end_date,
    planned_weekly_frequency, notes
  ) values (
    protocol_id, owner_id, (payload ->> 'student_id')::uuid, payload ->> 'name',
    coalesce(payload ->> 'objective', ''), coalesce(payload ->> 'status', 'draft'),
    (payload ->> 'start_date')::date, (payload ->> 'end_date')::date,
    coalesce((payload ->> 'planned_weekly_frequency')::smallint, 1), payload ->> 'notes'
  )
  on conflict (id) do update set
    student_id = excluded.student_id,
    name = excluded.name,
    objective = excluded.objective,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    planned_weekly_frequency = excluded.planned_weekly_frequency,
    notes = excluded.notes
  where training_protocols.professional_id = owner_id;

  if not found then
    raise exception 'Protocol does not belong to the authenticated professional' using errcode = '42501';
  end if;

  update public.training_periods as tp
  set sequence = sequence + 1000
  where tp.protocol_id = save_training_prescription.protocol_id
    and tp.professional_id = owner_id;

  for period_data in select value from jsonb_array_elements(coalesce(payload -> 'periods', '[]'::jsonb))
  loop
    period_id := (period_data ->> 'id')::uuid;
    insert into public.training_periods (
      id, professional_id, protocol_id, name, sequence, start_date, end_date,
      objective, planned_weekly_frequency, status, notes
    ) values (
      period_id, owner_id, protocol_id, period_data ->> 'name',
      (period_data ->> 'sequence')::smallint, (period_data ->> 'start_date')::date,
      (period_data ->> 'end_date')::date, period_data ->> 'objective',
      (period_data ->> 'planned_weekly_frequency')::smallint,
      coalesce(period_data ->> 'status', 'draft'), period_data ->> 'notes'
    )
    on conflict (id) do update set
      name = excluded.name,
      sequence = excluded.sequence,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      objective = excluded.objective,
      planned_weekly_frequency = excluded.planned_weekly_frequency,
      status = excluded.status,
      notes = excluded.notes
    where training_periods.professional_id = owner_id
      and training_periods.protocol_id = save_training_prescription.protocol_id;

    if not found then
      raise exception 'Period does not belong to the protocol owner' using errcode = '42501';
    end if;

    update public.workouts as w set sequence = sequence + 1000
    where w.period_id = save_training_prescription.period_id
      and w.professional_id = owner_id and w.is_current;

    delete from public.period_workout_slots as pws
    where pws.period_id = save_training_prescription.period_id and pws.professional_id = owner_id;

    for workout_data in select value from jsonb_array_elements(coalesce(period_data -> 'workouts', '[]'::jsonb))
    loop
      workout_id := (workout_data ->> 'id')::uuid;
      insert into public.workouts (
        id, professional_id, period_id, lineage_id, version, supersedes_workout_id,
        is_current, published_at, name, focus, sequence, estimated_duration_minutes,
        target_executions, notes, status
      ) values (
        workout_id, owner_id, period_id, (workout_data ->> 'lineage_id')::uuid,
        coalesce((workout_data ->> 'version')::integer, 1),
        (workout_data ->> 'supersedes_workout_id')::uuid,
        coalesce((workout_data ->> 'is_current')::boolean, true),
        (workout_data ->> 'published_at')::timestamptz,
        workout_data ->> 'name', coalesce(workout_data ->> 'focus', ''),
        (workout_data ->> 'sequence')::smallint,
        (workout_data ->> 'estimated_duration_minutes')::smallint,
        (workout_data ->> 'target_executions')::integer,
        workout_data ->> 'notes', coalesce(workout_data ->> 'status', 'draft')
      )
      on conflict (id) do update set
        name = excluded.name,
        focus = excluded.focus,
        sequence = excluded.sequence,
        estimated_duration_minutes = excluded.estimated_duration_minutes,
        target_executions = excluded.target_executions,
        notes = excluded.notes,
        status = excluded.status,
        published_at = excluded.published_at
      where workouts.professional_id = owner_id
        and workouts.period_id = period_id;

      if not found then
        raise exception 'Workout does not belong to the period owner' using errcode = '42501';
      end if;

      insert into public.period_workout_slots (
        id, professional_id, period_id, workout_id, weekday, sequence_in_week,
        occurrences_per_week, label
      ) values (
        coalesce((workout_data #>> '{slot,id}')::uuid, gen_random_uuid()), owner_id,
        period_id, workout_id, (workout_data #>> '{slot,weekday}')::smallint,
        coalesce((workout_data #>> '{slot,sequence_in_week}')::smallint, (workout_data ->> 'sequence')::smallint),
        coalesce((workout_data #>> '{slot,occurrences_per_week}')::smallint, 1),
        workout_data #>> '{slot,label}'
      );

      delete from public.workout_exercises as we
      where we.workout_id = save_training_prescription.workout_id and we.professional_id = owner_id;

      for exercise_data in select value from jsonb_array_elements(coalesce(workout_data -> 'exercises', '[]'::jsonb))
      loop
        exercise_id := (exercise_data ->> 'id')::uuid;
        insert into public.workout_exercises (
          id, professional_id, workout_id, exercise_source, system_exercise_id,
          custom_exercise_id, exercise_name_snapshot, exercise_metadata_snapshot,
          position, instructions, rest_between_sets_seconds, tempo, rir_target_min,
          rir_target_max, rpe_target, load_notes, group_key, group_position
        ) values (
          exercise_id, owner_id, workout_id, exercise_data ->> 'exercise_source',
          (exercise_data ->> 'system_exercise_id')::bigint,
          (exercise_data ->> 'custom_exercise_id')::bigint,
          exercise_data ->> 'exercise_name_snapshot',
          coalesce(exercise_data -> 'exercise_metadata_snapshot', '{}'::jsonb),
          (exercise_data ->> 'position')::smallint, exercise_data ->> 'instructions',
          (exercise_data ->> 'rest_between_sets_seconds')::integer,
          exercise_data ->> 'tempo', (exercise_data ->> 'rir_target_min')::numeric,
          (exercise_data ->> 'rir_target_max')::numeric,
          (exercise_data ->> 'rpe_target')::numeric, exercise_data ->> 'load_notes',
          (exercise_data ->> 'group_key')::uuid, (exercise_data ->> 'group_position')::smallint
        );

        for set_data in select value from jsonb_array_elements(coalesce(exercise_data -> 'sets', '[]'::jsonb))
        loop
          insert into public.prescribed_sets (
            id, professional_id, workout_exercise_id, set_number, set_type, method,
            reps_min, reps_max, duration_seconds, distance_meters, target_load,
            load_unit, load_percentage, rir_target, rpe_target, rest_after_seconds, notes
          ) values (
            coalesce((set_data ->> 'id')::uuid, gen_random_uuid()), owner_id, exercise_id,
            (set_data ->> 'set_number')::smallint, coalesce(set_data ->> 'set_type', 'working'),
            coalesce(set_data ->> 'method', 'conventional'),
            (set_data ->> 'reps_min')::numeric, (set_data ->> 'reps_max')::numeric,
            (set_data ->> 'duration_seconds')::integer, (set_data ->> 'distance_meters')::numeric,
            (set_data ->> 'target_load')::numeric, coalesce(set_data ->> 'load_unit', 'kg'),
            (set_data ->> 'load_percentage')::numeric, (set_data ->> 'rir_target')::numeric,
            (set_data ->> 'rpe_target')::numeric, (set_data ->> 'rest_after_seconds')::integer,
            set_data ->> 'notes'
          );
        end loop;
      end loop;
    end loop;

    delete from public.workouts as w
    where w.period_id = save_training_prescription.period_id
      and w.professional_id = owner_id
      and w.id not in (
        select (value ->> 'id')::uuid
        from jsonb_array_elements(coalesce(period_data -> 'workouts', '[]'::jsonb))
      );
  end loop;

  delete from public.training_periods as tp
  where tp.protocol_id = save_training_prescription.protocol_id
    and tp.professional_id = owner_id
    and tp.id not in (
      select (value ->> 'id')::uuid
      from jsonb_array_elements(coalesce(payload -> 'periods', '[]'::jsonb))
    );

  return protocol_id;
end;
$$;

revoke all on function public.save_training_prescription(jsonb) from public;
grant execute on function public.save_training_prescription(jsonb) to authenticated;
