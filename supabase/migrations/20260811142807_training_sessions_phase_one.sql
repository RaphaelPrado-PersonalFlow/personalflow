-- Phase 1: immutable workout history and persisted training sessions.

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete restrict,
  responsible_professional_id uuid not null references public.profiles(id) on delete restrict,
  student_id uuid not null,
  protocol_id uuid not null,
  period_id uuid not null,
  workout_id uuid not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  idempotency_key uuid not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'partial', 'cancelled', 'abandoned')),
  completion_mode text check (completion_mode in ('assume_unmodified_as_planned', 'partial')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  notes text,
  prescription_snapshot jsonb not null,
  snapshot_version smallint not null default 1 check (snapshot_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_sessions_student_owner_fk foreign key (student_id, professional_id)
    references public.students(id, professional_id) on delete restrict,
  constraint training_sessions_protocol_owner_fk foreign key (protocol_id, professional_id)
    references public.training_protocols(id, professional_id) on delete restrict,
  constraint training_sessions_period_owner_fk foreign key (period_id, professional_id)
    references public.training_periods(id, professional_id) on delete restrict,
  constraint training_sessions_workout_owner_fk foreign key (workout_id, professional_id)
    references public.workouts(id, professional_id) on delete restrict,
  constraint training_sessions_valid_completion check (
    (status = 'in_progress' and completed_at is null and completion_mode is null)
    or (status in ('completed', 'partial') and completed_at is not null and completion_mode is not null)
    or (status in ('cancelled', 'abandoned') and completed_at is not null)
  ),
  unique (professional_id, idempotency_key),
  unique (id, professional_id)
);

create unique index training_sessions_one_effective_appointment_idx
  on public.training_sessions(appointment_id)
  where appointment_id is not null and status in ('in_progress', 'completed', 'partial');
create index training_sessions_owner_student_started_idx
  on public.training_sessions(professional_id, student_id, started_at desc);
create index training_sessions_workout_idx on public.training_sessions(workout_id);
create index training_sessions_owner_status_idx on public.training_sessions(professional_id, status);

create table public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete restrict,
  session_id uuid not null,
  prescribed_workout_exercise_id uuid,
  position smallint not null check (position > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'assumed_completed', 'partial', 'skipped')),
  execution_source text not null default 'prescribed'
    check (execution_source in ('prescribed', 'substituted', 'added')),
  baseline_snapshot jsonb not null,
  muscle_participation_snapshot jsonb not null default '[]'::jsonb,
  executed_exercise_source text check (executed_exercise_source in ('system', 'custom')),
  executed_system_exercise_id bigint,
  executed_custom_exercise_id bigint,
  executed_name_snapshot text,
  executed_metadata_snapshot jsonb,
  substitution_reason text,
  notes text,
  changed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_session_exercises_session_owner_fk foreign key (session_id, professional_id)
    references public.training_sessions(id, professional_id) on delete cascade,
  constraint training_session_exercises_prescribed_owner_fk
    foreign key (prescribed_workout_exercise_id, professional_id)
    references public.workout_exercises(id, professional_id) on delete restrict,
  constraint training_session_exercises_executed_source_check check (
    (execution_source = 'prescribed' and executed_exercise_source is null
      and executed_system_exercise_id is null and executed_custom_exercise_id is null)
    or (execution_source in ('substituted', 'added') and executed_name_snapshot is not null
      and ((executed_exercise_source = 'system' and executed_system_exercise_id is not null and executed_custom_exercise_id is null)
        or (executed_exercise_source = 'custom' and executed_custom_exercise_id is not null and executed_system_exercise_id is null)))
  ),
  unique (session_id, position),
  unique (id, professional_id)
);

create index training_session_exercises_session_idx on public.training_session_exercises(session_id, position);
create index training_session_exercises_prescribed_idx
  on public.training_session_exercises(prescribed_workout_exercise_id)
  where prescribed_workout_exercise_id is not null;

create table public.training_session_sets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete restrict,
  session_exercise_id uuid not null,
  prescribed_set_id uuid,
  set_number smallint not null check (set_number > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'assumed_completed', 'partial', 'skipped')),
  is_added boolean not null default false,
  is_removed boolean not null default false,
  planned_set_type text,
  planned_method text,
  planned_reps_min numeric(7,2),
  planned_reps_max numeric(7,2),
  planned_duration_seconds integer,
  planned_distance_meters numeric(10,2),
  planned_load numeric(10,2),
  planned_load_unit text,
  planned_load_percentage numeric(6,2),
  planned_rir numeric(4,1),
  planned_rpe numeric(4,1),
  planned_rest_after_seconds integer,
  planned_notes text,
  actual_reps numeric(7,2) check (actual_reps is null or actual_reps >= 0),
  actual_duration_seconds integer check (actual_duration_seconds is null or actual_duration_seconds >= 0),
  actual_distance_meters numeric(10,2) check (actual_distance_meters is null or actual_distance_meters >= 0),
  actual_load numeric(10,2) check (actual_load is null or actual_load >= 0),
  actual_load_unit text check (actual_load_unit is null or actual_load_unit in ('kg', 'lb', 'percent_1rm', 'bodyweight')),
  actual_rir numeric(4,1),
  actual_rpe numeric(4,1),
  reps_source text not null default 'unresolved'
    check (reps_source in ('unresolved', 'actual', 'planned_exact', 'planned_range')),
  load_source text not null default 'unresolved'
    check (load_source in ('unresolved', 'actual', 'planned')),
  notes text,
  changed boolean not null default false,
  baseline_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_session_sets_exercise_owner_fk foreign key (session_exercise_id, professional_id)
    references public.training_session_exercises(id, professional_id) on delete cascade,
  constraint training_session_sets_prescribed_owner_fk foreign key (prescribed_set_id, professional_id)
    references public.prescribed_sets(id, professional_id) on delete restrict,
  unique (session_exercise_id, set_number),
  unique (id, professional_id)
);

create index training_session_sets_exercise_idx on public.training_session_sets(session_exercise_id, set_number);
create index training_session_sets_prescribed_idx on public.training_session_sets(prescribed_set_id)
  where prescribed_set_id is not null;

create trigger training_sessions_set_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();
create trigger training_session_exercises_set_updated_at before update on public.training_session_exercises
  for each row execute function public.set_updated_at();
create trigger training_session_sets_set_updated_at before update on public.training_session_sets
  for each row execute function public.set_updated_at();

alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
alter table public.training_session_sets enable row level security;

create policy training_sessions_owner_all on public.training_sessions for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);
create policy training_session_exercises_owner_all on public.training_session_exercises for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);
create policy training_session_sets_owner_all on public.training_session_sets for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

grant select, insert, update, delete on public.training_sessions to authenticated;
grant select, insert, update, delete on public.training_session_exercises to authenticated;
grant select, insert, update, delete on public.training_session_sets to authenticated;

create or replace function public.start_training_session(
  p_workout_id uuid,
  p_idempotency_key uuid,
  p_responsible_professional_id uuid default null,
  p_appointment_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_workout public.workouts%rowtype;
  target_period public.training_periods%rowtype;
  target_protocol public.training_protocols%rowtype;
  existing_session_id uuid;
  new_session_id uuid := gen_random_uuid();
  source_exercise record;
  source_set record;
  new_session_exercise_id uuid;
  full_snapshot jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key is required' using errcode = '22023'; end if;

  select ts.id into existing_session_id
  from public.training_sessions ts
  where ts.professional_id = owner_id and ts.idempotency_key = p_idempotency_key;
  if existing_session_id is not null then return existing_session_id; end if;

  select * into target_workout from public.workouts
  where id = p_workout_id and professional_id = owner_id and is_current
  for share;
  if not found then raise exception 'Current workout not found' using errcode = 'P0002'; end if;
  select * into target_period from public.training_periods
  where id = target_workout.period_id and professional_id = owner_id;
  select * into target_protocol from public.training_protocols
  where id = target_period.protocol_id and professional_id = owner_id;

  if coalesce(p_responsible_professional_id, owner_id) <> owner_id then
    raise exception 'Responsible professional is not available to this owner' using errcode = '42501';
  end if;
  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a where a.id = p_appointment_id
      and a.professional_id = owner_id and a.student_id = target_protocol.student_id and a.type = 'training'
  ) then raise exception 'Appointment does not match this training session' using errcode = '23514'; end if;

  select jsonb_build_object(
    'snapshot_version', 1,
    'protocol', jsonb_build_object('id', target_protocol.id, 'name', target_protocol.name, 'objective', target_protocol.objective),
    'period', jsonb_build_object('id', target_period.id, 'name', target_period.name, 'sequence', target_period.sequence),
    'workout', jsonb_build_object('id', target_workout.id, 'lineage_id', target_workout.lineage_id,
      'version', target_workout.version, 'name', target_workout.name, 'focus', target_workout.focus,
      'estimated_duration_minutes', target_workout.estimated_duration_minutes, 'published_at', target_workout.published_at),
    'exercises', coalesce(jsonb_agg(exercise_json order by exercise_position), '[]'::jsonb)
  ) into full_snapshot
  from (
    select we.position exercise_position, jsonb_build_object(
      'id', we.id, 'position', we.position, 'exercise_source', we.exercise_source,
      'system_exercise_id', we.system_exercise_id, 'custom_exercise_id', we.custom_exercise_id,
      'name', we.exercise_name_snapshot, 'metadata', we.exercise_metadata_snapshot,
      'instructions', we.instructions, 'rest_between_sets_seconds', we.rest_between_sets_seconds,
      'tempo', we.tempo, 'rir_target_min', we.rir_target_min, 'rir_target_max', we.rir_target_max,
      'rpe_target', we.rpe_target, 'load_notes', we.load_notes,
      'sets', coalesce((select jsonb_agg(to_jsonb(ps) - 'professional_id' - 'created_at' - 'updated_at' order by ps.set_number)
        from public.prescribed_sets ps where ps.workout_exercise_id = we.id), '[]'::jsonb)
    ) exercise_json
    from public.workout_exercises we where we.workout_id = target_workout.id
  ) snapshot_rows;

  begin
    insert into public.training_sessions (
      id, professional_id, responsible_professional_id, student_id, protocol_id, period_id, workout_id,
      appointment_id, idempotency_key, notes, prescription_snapshot
    ) values (
      new_session_id, owner_id, coalesce(p_responsible_professional_id, owner_id), target_protocol.student_id,
      target_protocol.id, target_period.id, target_workout.id, p_appointment_id, p_idempotency_key, p_notes, full_snapshot
    );
  exception when unique_violation then
    select ts.id into existing_session_id from public.training_sessions ts
    where ts.professional_id = owner_id and ts.idempotency_key = p_idempotency_key;
    if existing_session_id is null and p_appointment_id is not null then
      select ts.id into existing_session_id from public.training_sessions ts
      where ts.appointment_id = p_appointment_id and ts.status in ('in_progress', 'completed', 'partial');
    end if;
    if existing_session_id is not null then return existing_session_id; end if;
    raise;
  end;

  for source_exercise in
    select we.* from public.workout_exercises we where we.workout_id = target_workout.id order by we.position
  loop
    new_session_exercise_id := gen_random_uuid();
    insert into public.training_session_exercises (
      id, professional_id, session_id, prescribed_workout_exercise_id, position,
      baseline_snapshot, muscle_participation_snapshot
    ) values (
      new_session_exercise_id, owner_id, new_session_id, source_exercise.id, source_exercise.position,
      to_jsonb(source_exercise) - 'professional_id' - 'created_at' - 'updated_at',
      coalesce(source_exercise.exercise_metadata_snapshot -> 'muscles', '[]'::jsonb)
    );

    for source_set in
      select ps.* from public.prescribed_sets ps
      where ps.workout_exercise_id = source_exercise.id order by ps.set_number
    loop
      insert into public.training_session_sets (
        professional_id, session_exercise_id, prescribed_set_id, set_number,
        planned_set_type, planned_method, planned_reps_min, planned_reps_max,
        planned_duration_seconds, planned_distance_meters, planned_load, planned_load_unit,
        planned_load_percentage, planned_rir, planned_rpe, planned_rest_after_seconds,
        planned_notes, reps_source, load_source, baseline_snapshot
      ) values (
        owner_id, new_session_exercise_id, source_set.id, source_set.set_number,
        source_set.set_type, source_set.method, source_set.reps_min, source_set.reps_max,
        source_set.duration_seconds, source_set.distance_meters, source_set.target_load, source_set.load_unit,
        source_set.load_percentage, source_set.rir_target, source_set.rpe_target, source_set.rest_after_seconds,
        source_set.notes, 'unresolved', 'unresolved',
        to_jsonb(source_set) - 'professional_id' - 'created_at' - 'updated_at'
      );
    end loop;
  end loop;

  return new_session_id;
end;
$$;

create or replace function public.update_training_session_exercise(p_exercise_id uuid, p_changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); current_session_id uuid;
begin
  select e.session_id into current_session_id from public.training_session_exercises e
  join public.training_sessions s on s.id = e.session_id
  where e.id = p_exercise_id and e.professional_id = owner_id and s.status = 'in_progress' for update of e;
  if current_session_id is null then raise exception 'Editable session exercise not found' using errcode = 'P0002'; end if;
  update public.training_session_exercises set
    status = coalesce(p_changes ->> 'status', status),
    execution_source = coalesce(p_changes ->> 'execution_source', execution_source),
    executed_exercise_source = case when p_changes ? 'executed_exercise_source' then p_changes ->> 'executed_exercise_source' else executed_exercise_source end,
    executed_system_exercise_id = case when p_changes ? 'executed_system_exercise_id' then (p_changes ->> 'executed_system_exercise_id')::bigint else executed_system_exercise_id end,
    executed_custom_exercise_id = case when p_changes ? 'executed_custom_exercise_id' then (p_changes ->> 'executed_custom_exercise_id')::bigint else executed_custom_exercise_id end,
    executed_name_snapshot = case when p_changes ? 'executed_name_snapshot' then p_changes ->> 'executed_name_snapshot' else executed_name_snapshot end,
    executed_metadata_snapshot = case when p_changes ? 'executed_metadata_snapshot' then p_changes -> 'executed_metadata_snapshot' else executed_metadata_snapshot end,
    muscle_participation_snapshot = case when p_changes ? 'muscle_participation_snapshot' then p_changes -> 'muscle_participation_snapshot' else muscle_participation_snapshot end,
    substitution_reason = case when p_changes ? 'substitution_reason' then p_changes ->> 'substitution_reason' else substitution_reason end,
    notes = case when p_changes ? 'notes' then p_changes ->> 'notes' else notes end,
    changed = true
  where id = p_exercise_id and professional_id = owner_id;
end; $$;

create or replace function public.update_training_session_set(p_set_id uuid, p_changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); found_id uuid;
begin
  select ss.id into found_id from public.training_session_sets ss
  join public.training_session_exercises se on se.id = ss.session_exercise_id
  join public.training_sessions s on s.id = se.session_id
  where ss.id = p_set_id and ss.professional_id = owner_id and s.status = 'in_progress' for update of ss;
  if found_id is null then raise exception 'Editable session set not found' using errcode = 'P0002'; end if;
  update public.training_session_sets set
    status = coalesce(p_changes ->> 'status', status),
    actual_reps = case when p_changes ? 'actual_reps' then (p_changes ->> 'actual_reps')::numeric else actual_reps end,
    actual_load = case when p_changes ? 'actual_load' then (p_changes ->> 'actual_load')::numeric else actual_load end,
    actual_load_unit = case when p_changes ? 'actual_load_unit' then p_changes ->> 'actual_load_unit' else actual_load_unit end,
    actual_rir = case when p_changes ? 'actual_rir' then (p_changes ->> 'actual_rir')::numeric else actual_rir end,
    actual_rpe = case when p_changes ? 'actual_rpe' then (p_changes ->> 'actual_rpe')::numeric else actual_rpe end,
    actual_duration_seconds = case when p_changes ? 'actual_duration_seconds' then (p_changes ->> 'actual_duration_seconds')::integer else actual_duration_seconds end,
    actual_distance_meters = case when p_changes ? 'actual_distance_meters' then (p_changes ->> 'actual_distance_meters')::numeric else actual_distance_meters end,
    notes = case when p_changes ? 'notes' then p_changes ->> 'notes' else notes end,
    reps_source = case when p_changes ? 'actual_reps' then case when p_changes ->> 'actual_reps' is null then 'unresolved' else 'actual' end else reps_source end,
    load_source = case when p_changes ? 'actual_load' then case when p_changes ->> 'actual_load' is null then 'unresolved' else 'actual' end else load_source end,
    changed = true
  where id = p_set_id and professional_id = owner_id;
end; $$;

create or replace function public.add_training_session_set(p_session_exercise_id uuid, p_idempotency_key uuid, p_values jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); new_id uuid := p_idempotency_key; next_number smallint;
begin
  if new_id is null then raise exception 'Idempotency key is required' using errcode = '22023'; end if;
  if exists (select 1 from public.training_session_sets where id = new_id and professional_id = owner_id) then return new_id; end if;
  if not exists (select 1 from public.training_session_exercises se join public.training_sessions s on s.id = se.session_id
    where se.id = p_session_exercise_id and se.professional_id = owner_id and s.status = 'in_progress') then
    raise exception 'Editable session exercise not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_exercise_id::text, 0));
  select (coalesce(max(set_number), 0) + 1)::smallint into next_number
  from public.training_session_sets where session_exercise_id = p_session_exercise_id;
  insert into public.training_session_sets (
    id, professional_id, session_exercise_id, set_number, status, is_added,
    planned_set_type, planned_method, planned_reps_min, planned_reps_max, planned_load,
    planned_load_unit, actual_reps, actual_load, actual_load_unit, actual_rir, actual_rpe,
    reps_source, load_source, changed, baseline_snapshot
  ) values (
    new_id, owner_id, p_session_exercise_id, next_number, 'pending', true,
    coalesce(p_values ->> 'planned_set_type', 'working'), coalesce(p_values ->> 'planned_method', 'conventional'),
    (p_values ->> 'planned_reps_min')::numeric, (p_values ->> 'planned_reps_max')::numeric,
    (p_values ->> 'planned_load')::numeric, coalesce(p_values ->> 'planned_load_unit', 'kg'),
    (p_values ->> 'actual_reps')::numeric, (p_values ->> 'actual_load')::numeric,
    coalesce(p_values ->> 'actual_load_unit', p_values ->> 'planned_load_unit', 'kg'),
    (p_values ->> 'actual_rir')::numeric, (p_values ->> 'actual_rpe')::numeric,
    case when p_values ->> 'actual_reps' is null then 'unresolved' else 'actual' end,
    case when p_values ->> 'actual_load' is null then 'unresolved' else 'actual' end,
    true, coalesce(p_values, '{}'::jsonb)
  );
  return new_id;
end; $$;

create or replace function public.remove_training_session_set(p_set_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); found_id uuid;
begin
  select ss.id into found_id from public.training_session_sets ss
  join public.training_session_exercises se on se.id = ss.session_exercise_id
  join public.training_sessions s on s.id = se.session_id
  where ss.id = p_set_id and ss.professional_id = owner_id and s.status = 'in_progress' for update of ss;
  if found_id is null then raise exception 'Editable session set not found' using errcode = 'P0002'; end if;
  update public.training_session_sets set is_removed = true, status = 'skipped', changed = true where id = p_set_id;
end; $$;

create or replace function public.update_training_session_details(p_session_id uuid, p_notes text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.training_sessions set notes = p_notes
  where id = p_session_id and professional_id = (select auth.uid()) and status = 'in_progress';
  if not found then raise exception 'Editable session not found' using errcode = 'P0002'; end if;
end; $$;

create or replace function public.complete_training_session(p_session_id uuid, p_mode text)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); finished_at timestamptz := now(); session_started timestamptz;
begin
  if p_mode not in ('assume_unmodified_as_planned', 'partial') then raise exception 'Invalid completion mode' using errcode = '22023'; end if;
  select started_at into session_started from public.training_sessions
  where id = p_session_id and professional_id = owner_id and status = 'in_progress' for update;
  if session_started is null then raise exception 'Editable session not found' using errcode = 'P0002'; end if;

  if p_mode = 'assume_unmodified_as_planned' then
    update public.training_session_sets ss set
      status = 'assumed_completed',
      reps_source = case when ss.planned_reps_min is not null and ss.planned_reps_max = ss.planned_reps_min then 'planned_exact'
        when ss.planned_reps_min is not null or ss.planned_reps_max is not null then 'planned_range' else 'unresolved' end,
      load_source = case when ss.planned_load is not null then 'planned' else 'unresolved' end
    from public.training_session_exercises se
    where ss.session_exercise_id = se.id and se.session_id = p_session_id
      and ss.status = 'pending' and not ss.is_removed and se.status <> 'skipped';
    update public.training_session_exercises set status = 'assumed_completed'
      where session_id = p_session_id and status = 'pending';
  else
    update public.training_session_sets ss set status = 'skipped'
    from public.training_session_exercises se
    where ss.session_exercise_id = se.id and se.session_id = p_session_id and ss.status = 'pending';
    update public.training_session_exercises se set status = case
      when exists (select 1 from public.training_session_sets ss where ss.session_exercise_id = se.id and ss.status in ('completed','partial'))
        then 'partial' else 'skipped' end
    where se.session_id = p_session_id and se.status = 'pending';
  end if;

  update public.training_sessions set
    status = case when p_mode = 'partial' then 'partial' else 'completed' end,
    completion_mode = p_mode, completed_at = finished_at,
    duration_seconds = greatest(0, extract(epoch from (finished_at - session_started))::integer)
  where id = p_session_id and professional_id = owner_id;
end; $$;

create or replace function public.cancel_training_session(p_session_id uuid, p_as_abandoned boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.training_sessions set status = case when p_as_abandoned then 'abandoned' else 'cancelled' end,
    completed_at = now(), duration_seconds = greatest(0, extract(epoch from (now() - started_at))::integer)
  where id = p_session_id and professional_id = (select auth.uid()) and status = 'in_progress';
  if not found then raise exception 'Editable session not found' using errcode = 'P0002'; end if;
end; $$;

create or replace function public.get_training_session(p_session_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'session', to_jsonb(s),
    'exercises', coalesce((select jsonb_agg(
      to_jsonb(se) || jsonb_build_object('sets', coalesce((select jsonb_agg(to_jsonb(ss) order by ss.set_number)
        from public.training_session_sets ss where ss.session_exercise_id = se.id), '[]'::jsonb))
      order by se.position) from public.training_session_exercises se where se.session_id = s.id), '[]'::jsonb)
  ) from public.training_sessions s
  where s.id = p_session_id and s.professional_id = (select auth.uid());
$$;

revoke all on function public.start_training_session(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.update_training_session_exercise(uuid, jsonb) from public;
revoke all on function public.update_training_session_set(uuid, jsonb) from public;
revoke all on function public.add_training_session_set(uuid, uuid, jsonb) from public;
revoke all on function public.remove_training_session_set(uuid) from public;
revoke all on function public.update_training_session_details(uuid, text) from public;
revoke all on function public.complete_training_session(uuid, text) from public;
revoke all on function public.cancel_training_session(uuid, boolean) from public;
revoke all on function public.get_training_session(uuid) from public;
grant execute on function public.start_training_session(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.update_training_session_exercise(uuid, jsonb) to authenticated;
grant execute on function public.update_training_session_set(uuid, jsonb) to authenticated;
grant execute on function public.add_training_session_set(uuid, uuid, jsonb) to authenticated;
grant execute on function public.remove_training_session_set(uuid) to authenticated;
grant execute on function public.update_training_session_details(uuid, text) to authenticated;
grant execute on function public.complete_training_session(uuid, text) to authenticated;
grant execute on function public.cancel_training_session(uuid, boolean) to authenticated;
grant execute on function public.get_training_session(uuid) to authenticated;
