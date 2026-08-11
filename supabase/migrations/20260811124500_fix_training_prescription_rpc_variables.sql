create or replace function public.save_training_prescription(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  v_protocol_id uuid := (payload ->> 'id')::uuid;
  period_data jsonb;
  workout_data jsonb;
  exercise_data jsonb;
  set_data jsonb;
  v_period_id uuid;
  v_workout_id uuid;
  v_exercise_id uuid;
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
    v_protocol_id, owner_id, (payload ->> 'student_id')::uuid, payload ->> 'name',
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
  where tp.protocol_id = v_protocol_id
    and tp.professional_id = owner_id;

  for period_data in select value from jsonb_array_elements(coalesce(payload -> 'periods', '[]'::jsonb))
  loop
    v_period_id := (period_data ->> 'id')::uuid;
    insert into public.training_periods (
      id, professional_id, protocol_id, name, sequence, start_date, end_date,
      objective, planned_weekly_frequency, status, notes
    ) values (
      v_period_id, owner_id, v_protocol_id, period_data ->> 'name',
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
      and training_periods.protocol_id = v_protocol_id;

    if not found then
      raise exception 'Period does not belong to the protocol owner' using errcode = '42501';
    end if;

    update public.workouts as w set sequence = sequence + 1000
    where w.period_id = v_period_id
      and w.professional_id = owner_id and w.is_current;

    delete from public.period_workout_slots as pws
    where pws.period_id = v_period_id and pws.professional_id = owner_id;

    for workout_data in select value from jsonb_array_elements(coalesce(period_data -> 'workouts', '[]'::jsonb))
    loop
      v_workout_id := (workout_data ->> 'id')::uuid;
      insert into public.workouts (
        id, professional_id, period_id, lineage_id, version, supersedes_workout_id,
        is_current, published_at, name, focus, sequence, estimated_duration_minutes,
        target_executions, notes, status
      ) values (
        v_workout_id, owner_id, v_period_id, (workout_data ->> 'lineage_id')::uuid,
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
        and workouts.period_id = v_period_id;

      if not found then
        raise exception 'Workout does not belong to the period owner' using errcode = '42501';
      end if;

      insert into public.period_workout_slots (
        id, professional_id, period_id, workout_id, weekday, sequence_in_week,
        occurrences_per_week, label
      ) values (
        coalesce((workout_data #>> '{slot,id}')::uuid, gen_random_uuid()), owner_id,
        v_period_id, v_workout_id, (workout_data #>> '{slot,weekday}')::smallint,
        coalesce((workout_data #>> '{slot,sequence_in_week}')::smallint, (workout_data ->> 'sequence')::smallint),
        coalesce((workout_data #>> '{slot,occurrences_per_week}')::smallint, 1),
        workout_data #>> '{slot,label}'
      );

      delete from public.workout_exercises as we
      where we.workout_id = v_workout_id and we.professional_id = owner_id;

      for exercise_data in select value from jsonb_array_elements(coalesce(workout_data -> 'exercises', '[]'::jsonb))
      loop
        v_exercise_id := (exercise_data ->> 'id')::uuid;
        insert into public.workout_exercises (
          id, professional_id, workout_id, exercise_source, system_exercise_id,
          custom_exercise_id, exercise_name_snapshot, exercise_metadata_snapshot,
          position, instructions, rest_between_sets_seconds, tempo, rir_target_min,
          rir_target_max, rpe_target, load_notes, group_key, group_position
        ) values (
          v_exercise_id, owner_id, v_workout_id, exercise_data ->> 'exercise_source',
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
            coalesce((set_data ->> 'id')::uuid, gen_random_uuid()), owner_id, v_exercise_id,
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
    where w.period_id = v_period_id
      and w.professional_id = owner_id
      and w.id not in (
        select (value ->> 'id')::uuid
        from jsonb_array_elements(coalesce(period_data -> 'workouts', '[]'::jsonb))
      );
  end loop;

  delete from public.training_periods as tp
  where tp.protocol_id = v_protocol_id
    and tp.professional_id = owner_id
    and tp.id not in (
      select (value ->> 'id')::uuid
      from jsonb_array_elements(coalesce(payload -> 'periods', '[]'::jsonb))
    );

  return v_protocol_id;
end;
$$;

revoke all on function public.save_training_prescription(jsonb) from public;
grant execute on function public.save_training_prescription(jsonb) to authenticated;
