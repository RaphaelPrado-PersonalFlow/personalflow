-- Activate immutable workout versions while preserving in-place editing for unused drafts.

create or replace function public.workout_matches_payload(p_workout_id uuid, p_payload jsonb)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); exercise_data jsonb; set_data jsonb; exercise_id uuid;
begin
  if not exists (
    select 1 from public.workouts w where w.id = p_workout_id and w.professional_id = owner_id
      and w.name = p_payload ->> 'name'
      and w.focus = coalesce(p_payload ->> 'focus', '')
      and w.sequence = (p_payload ->> 'sequence')::smallint
      and w.estimated_duration_minutes is not distinct from (p_payload ->> 'estimated_duration_minutes')::smallint
      and w.target_executions is not distinct from (p_payload ->> 'target_executions')::integer
      and w.notes is not distinct from p_payload ->> 'notes'
      and (select count(*) from public.workout_exercises we where we.workout_id = w.id)
        = jsonb_array_length(coalesce(p_payload -> 'exercises', '[]'::jsonb))
  ) then return false; end if;

  for exercise_data in select value from jsonb_array_elements(coalesce(p_payload -> 'exercises', '[]'::jsonb)) loop
    exercise_id := (exercise_data ->> 'id')::uuid;
    if not exists (
      select 1 from public.workout_exercises we where we.id = exercise_id and we.workout_id = p_workout_id
        and we.exercise_source = exercise_data ->> 'exercise_source'
        and we.system_exercise_id is not distinct from (exercise_data ->> 'system_exercise_id')::bigint
        and we.custom_exercise_id is not distinct from (exercise_data ->> 'custom_exercise_id')::bigint
        and we.exercise_name_snapshot = exercise_data ->> 'exercise_name_snapshot'
        and we.exercise_metadata_snapshot = coalesce(exercise_data -> 'exercise_metadata_snapshot', '{}'::jsonb)
        and we.position = (exercise_data ->> 'position')::smallint
        and we.instructions is not distinct from exercise_data ->> 'instructions'
        and we.rest_between_sets_seconds is not distinct from (exercise_data ->> 'rest_between_sets_seconds')::integer
        and we.tempo is not distinct from exercise_data ->> 'tempo'
        and we.rir_target_min is not distinct from (exercise_data ->> 'rir_target_min')::numeric
        and we.rir_target_max is not distinct from (exercise_data ->> 'rir_target_max')::numeric
        and we.rpe_target is not distinct from (exercise_data ->> 'rpe_target')::numeric
        and we.load_notes is not distinct from exercise_data ->> 'load_notes'
        and (select count(*) from public.prescribed_sets ps where ps.workout_exercise_id = we.id)
          = jsonb_array_length(coalesce(exercise_data -> 'sets', '[]'::jsonb))
    ) then return false; end if;
    for set_data in select value from jsonb_array_elements(coalesce(exercise_data -> 'sets', '[]'::jsonb)) loop
      if not exists (
        select 1 from public.prescribed_sets ps
        where ps.id = (set_data ->> 'id')::uuid and ps.workout_exercise_id = exercise_id
          and ps.set_number = (set_data ->> 'set_number')::smallint
          and ps.set_type = coalesce(set_data ->> 'set_type', 'working')
          and ps.method = coalesce(set_data ->> 'method', 'conventional')
          and ps.reps_min is not distinct from (set_data ->> 'reps_min')::numeric
          and ps.reps_max is not distinct from (set_data ->> 'reps_max')::numeric
          and ps.duration_seconds is not distinct from (set_data ->> 'duration_seconds')::integer
          and ps.distance_meters is not distinct from (set_data ->> 'distance_meters')::numeric
          and ps.target_load is not distinct from (set_data ->> 'target_load')::numeric
          and ps.load_unit = coalesce(set_data ->> 'load_unit', 'kg')
          and ps.load_percentage is not distinct from (set_data ->> 'load_percentage')::numeric
          and ps.rir_target is not distinct from (set_data ->> 'rir_target')::numeric
          and ps.rpe_target is not distinct from (set_data ->> 'rpe_target')::numeric
          and ps.rest_after_seconds is not distinct from (set_data ->> 'rest_after_seconds')::integer
          and ps.notes is not distinct from set_data ->> 'notes'
      ) then return false; end if;
    end loop;
  end loop;
  return true;
end; $$;

create or replace function public.protect_historical_workout()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare protected boolean;
begin
  protected := old.published_at is not null or old.status <> 'draft'
    or exists (select 1 from public.training_sessions s where s.workout_id = old.id);
  if tg_op = 'DELETE' and protected then
    raise exception 'Historical or published workout cannot be deleted; archive it instead' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and protected and (
    new.period_id is distinct from old.period_id or new.lineage_id is distinct from old.lineage_id
    or new.version is distinct from old.version or new.supersedes_workout_id is distinct from old.supersedes_workout_id
    or new.name is distinct from old.name or new.focus is distinct from old.focus
    or new.sequence is distinct from old.sequence or new.estimated_duration_minutes is distinct from old.estimated_duration_minutes
    or new.target_executions is distinct from old.target_executions or new.notes is distinct from old.notes
  ) then raise exception 'Historical or published workout is immutable; create a new version' using errcode = '55000'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

create trigger workouts_protect_history before update or delete on public.workouts
for each row execute function public.protect_historical_workout();

create or replace function public.protect_historical_workout_child()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_workout_id uuid; protected boolean;
begin
  if tg_table_name = 'workout_exercises' then target_workout_id := old.workout_id;
  else select we.workout_id into target_workout_id from public.workout_exercises we where we.id = old.workout_exercise_id; end if;
  select w.published_at is not null or w.status <> 'draft'
    or exists (select 1 from public.training_sessions s where s.workout_id = w.id)
  into protected from public.workouts w where w.id = target_workout_id;
  if protected then raise exception 'Historical or published workout contents are immutable' using errcode = '55000'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

create trigger workout_exercises_protect_history before update or delete on public.workout_exercises
for each row execute function public.protect_historical_workout_child();
create trigger prescribed_sets_protect_history before update or delete on public.prescribed_sets
for each row execute function public.protect_historical_workout_child();

create or replace function public.protect_historical_training_parent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'training_protocols' and exists (
    select 1 from public.training_sessions s where s.protocol_id = old.id
  ) then raise exception 'Protocol has training history and cannot be deleted; archive it instead' using errcode = '23503'; end if;
  if tg_table_name = 'training_periods' and exists (
    select 1 from public.training_sessions s where s.period_id = old.id
  ) then raise exception 'Period has training history and cannot be deleted' using errcode = '23503'; end if;
  return old;
end; $$;

create trigger training_protocols_protect_history before delete on public.training_protocols
for each row execute function public.protect_historical_training_parent();
create trigger training_periods_protect_history before delete on public.training_periods
for each row execute function public.protect_historical_training_parent();

create or replace function public.save_training_prescription(payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid()); v_protocol_id uuid := (payload ->> 'id')::uuid;
  period_data jsonb; workout_data jsonb; exercise_data jsonb; set_data jsonb;
  v_period_id uuid; requested_workout_id uuid; target_workout_id uuid; target_exercise_id uuid;
  existing_workout public.workouts%rowtype; protected boolean; next_version integer;
  kept_workout_ids uuid[]; kept_period_ids uuid[]; period_kept_workout_ids uuid[];
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.training_protocols (
    id, professional_id, student_id, name, objective, status, start_date, end_date, planned_weekly_frequency, notes
  ) values (
    v_protocol_id, owner_id, (payload ->> 'student_id')::uuid, payload ->> 'name', coalesce(payload ->> 'objective',''),
    coalesce(payload ->> 'status','draft'), (payload ->> 'start_date')::date, (payload ->> 'end_date')::date,
    coalesce((payload ->> 'planned_weekly_frequency')::smallint,1), payload ->> 'notes'
  ) on conflict (id) do update set name=excluded.name, objective=excluded.objective, status=excluded.status,
    start_date=excluded.start_date, end_date=excluded.end_date,
    planned_weekly_frequency=excluded.planned_weekly_frequency, notes=excluded.notes
  where training_protocols.professional_id = owner_id;
  if not found then raise exception 'Protocol does not belong to owner' using errcode = '42501'; end if;

  for period_data in select value from jsonb_array_elements(coalesce(payload -> 'periods','[]'::jsonb)) loop
    v_period_id := (period_data ->> 'id')::uuid; kept_period_ids := array_append(kept_period_ids, v_period_id);
    insert into public.training_periods (id,professional_id,protocol_id,name,sequence,start_date,end_date,objective,planned_weekly_frequency,status,notes)
    values (v_period_id,owner_id,v_protocol_id,period_data->>'name',(period_data->>'sequence')::smallint,
      (period_data->>'start_date')::date,(period_data->>'end_date')::date,period_data->>'objective',
      (period_data->>'planned_weekly_frequency')::smallint,coalesce(period_data->>'status','draft'),period_data->>'notes')
    on conflict (id) do update set name=excluded.name,sequence=excluded.sequence,start_date=excluded.start_date,
      end_date=excluded.end_date,objective=excluded.objective,planned_weekly_frequency=excluded.planned_weekly_frequency,
      status=excluded.status,notes=excluded.notes
    where training_periods.professional_id=owner_id and training_periods.protocol_id=v_protocol_id;
    if not found then raise exception 'Period does not belong to owner' using errcode = '42501'; end if;

    perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || v_period_id::text, 0));
    delete from public.period_workout_slots where period_id=v_period_id and professional_id=owner_id;
    period_kept_workout_ids := null;

    for workout_data in select value from jsonb_array_elements(coalesce(period_data -> 'workouts','[]'::jsonb)) loop
      requested_workout_id := (workout_data ->> 'id')::uuid; target_workout_id := requested_workout_id;
      select * into existing_workout from public.workouts where id=requested_workout_id and professional_id=owner_id for update;
      if found then
        protected := existing_workout.published_at is not null or existing_workout.status <> 'draft'
          or exists(select 1 from public.training_sessions s where s.workout_id=existing_workout.id);
        if protected and not public.workout_matches_payload(existing_workout.id, workout_data) then
          perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || existing_workout.lineage_id::text, 0));
          select coalesce(max(version),0)+1 into next_version from public.workouts
            where lineage_id=existing_workout.lineage_id and professional_id=owner_id;
          update public.workouts set is_current=false where id=existing_workout.id;
          target_workout_id := gen_random_uuid();
          insert into public.workouts (id,professional_id,period_id,lineage_id,version,supersedes_workout_id,is_current,
            published_at,name,focus,sequence,estimated_duration_minutes,target_executions,notes,status)
          values (target_workout_id,owner_id,v_period_id,existing_workout.lineage_id,next_version,existing_workout.id,true,
            now(),workout_data->>'name',coalesce(workout_data->>'focus',''),(workout_data->>'sequence')::smallint,
            (workout_data->>'estimated_duration_minutes')::smallint,(workout_data->>'target_executions')::integer,
            workout_data->>'notes','active');
        elsif not protected then
          delete from public.workout_exercises where workout_id=requested_workout_id and professional_id=owner_id;
          update public.workouts set name=workout_data->>'name',focus=coalesce(workout_data->>'focus',''),
            sequence=(workout_data->>'sequence')::smallint,estimated_duration_minutes=(workout_data->>'estimated_duration_minutes')::smallint,
            target_executions=(workout_data->>'target_executions')::integer,notes=workout_data->>'notes',
            published_at=(workout_data->>'published_at')::timestamptz,status=coalesce(workout_data->>'status','draft')
          where id=requested_workout_id;
        end if;
      else
        insert into public.workouts (id,professional_id,period_id,lineage_id,version,supersedes_workout_id,is_current,
          published_at,name,focus,sequence,estimated_duration_minutes,target_executions,notes,status)
        values (target_workout_id,owner_id,v_period_id,coalesce((workout_data->>'lineage_id')::uuid,gen_random_uuid()),
          coalesce((workout_data->>'version')::integer,1),(workout_data->>'supersedes_workout_id')::uuid,true,
          (workout_data->>'published_at')::timestamptz,workout_data->>'name',coalesce(workout_data->>'focus',''),
          (workout_data->>'sequence')::smallint,(workout_data->>'estimated_duration_minutes')::smallint,
          (workout_data->>'target_executions')::integer,workout_data->>'notes',coalesce(workout_data->>'status','draft'));
      end if;

      period_kept_workout_ids := array_append(period_kept_workout_ids,target_workout_id);
      kept_workout_ids := array_append(kept_workout_ids,target_workout_id);
      insert into public.period_workout_slots (id,professional_id,period_id,workout_id,weekday,sequence_in_week,occurrences_per_week,label)
      values (gen_random_uuid(),owner_id,v_period_id,target_workout_id,(workout_data#>>'{slot,weekday}')::smallint,
        coalesce((workout_data#>>'{slot,sequence_in_week}')::smallint,(workout_data->>'sequence')::smallint),
        coalesce((workout_data#>>'{slot,occurrences_per_week}')::smallint,1),workout_data#>>'{slot,label}');

      if target_workout_id <> requested_workout_id or not exists(select 1 from public.workout_exercises where workout_id=target_workout_id) then
        for exercise_data in select value from jsonb_array_elements(coalesce(workout_data -> 'exercises','[]'::jsonb)) loop
          target_exercise_id := case when target_workout_id=requested_workout_id then (exercise_data->>'id')::uuid else gen_random_uuid() end;
          insert into public.workout_exercises (id,professional_id,workout_id,exercise_source,system_exercise_id,custom_exercise_id,
            exercise_name_snapshot,exercise_metadata_snapshot,position,instructions,rest_between_sets_seconds,tempo,
            rir_target_min,rir_target_max,rpe_target,load_notes,group_key,group_position)
          values (target_exercise_id,owner_id,target_workout_id,exercise_data->>'exercise_source',
            (exercise_data->>'system_exercise_id')::bigint,(exercise_data->>'custom_exercise_id')::bigint,
            exercise_data->>'exercise_name_snapshot',coalesce(exercise_data->'exercise_metadata_snapshot','{}'::jsonb),
            (exercise_data->>'position')::smallint,exercise_data->>'instructions',(exercise_data->>'rest_between_sets_seconds')::integer,
            exercise_data->>'tempo',(exercise_data->>'rir_target_min')::numeric,(exercise_data->>'rir_target_max')::numeric,
            (exercise_data->>'rpe_target')::numeric,exercise_data->>'load_notes',(exercise_data->>'group_key')::uuid,
            (exercise_data->>'group_position')::smallint);
          for set_data in select value from jsonb_array_elements(coalesce(exercise_data -> 'sets','[]'::jsonb)) loop
            insert into public.prescribed_sets (id,professional_id,workout_exercise_id,set_number,set_type,method,reps_min,reps_max,
              duration_seconds,distance_meters,target_load,load_unit,load_percentage,rir_target,rpe_target,rest_after_seconds,notes)
            values (case when target_workout_id=requested_workout_id then coalesce((set_data->>'id')::uuid,gen_random_uuid()) else gen_random_uuid() end,
              owner_id,target_exercise_id,(set_data->>'set_number')::smallint,coalesce(set_data->>'set_type','working'),
              coalesce(set_data->>'method','conventional'),(set_data->>'reps_min')::numeric,(set_data->>'reps_max')::numeric,
              (set_data->>'duration_seconds')::integer,(set_data->>'distance_meters')::numeric,(set_data->>'target_load')::numeric,
              coalesce(set_data->>'load_unit','kg'),(set_data->>'load_percentage')::numeric,(set_data->>'rir_target')::numeric,
              (set_data->>'rpe_target')::numeric,(set_data->>'rest_after_seconds')::integer,set_data->>'notes');
          end loop;
        end loop;
      end if;
    end loop;

    -- Delete only unused drafts omitted from the current prescription. Historical versions remain archived.
    delete from public.workouts w where w.period_id=v_period_id and w.professional_id=owner_id and w.is_current
      and not (w.id = any(coalesce(period_kept_workout_ids,'{}'::uuid[])))
      and w.status='draft' and w.published_at is null
      and not exists(select 1 from public.training_sessions s where s.workout_id=w.id);
  end loop;

  delete from public.training_periods tp where tp.protocol_id=v_protocol_id and tp.professional_id=owner_id
    and not (tp.id = any(coalesce(kept_period_ids,'{}'::uuid[])))
    and not exists(select 1 from public.training_sessions s where s.period_id=tp.id)
    and not exists(select 1 from public.workouts w where w.period_id=tp.id and (w.published_at is not null or w.status<>'draft'));
  return v_protocol_id;
end; $$;

revoke all on function public.workout_matches_payload(uuid,jsonb) from public;
revoke all on function public.protect_historical_workout() from public;
revoke all on function public.protect_historical_workout_child() from public;
revoke all on function public.protect_historical_training_parent() from public;
revoke all on function public.save_training_prescription(jsonb) from public;
grant execute on function public.workout_matches_payload(uuid,jsonb) to authenticated;
grant execute on function public.save_training_prescription(jsonb) to authenticated;
