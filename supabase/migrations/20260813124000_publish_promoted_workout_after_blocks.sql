-- A promoted workout remains a draft until the promotion audit trigger has applied
-- selected miniblocks. It is published before the transaction commits.

create or replace function public.promote_training_session_changes(p_session_id uuid, p_selection jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid()); source_session public.training_sessions%rowtype;
  source_workout public.workouts%rowtype; next_version integer; new_workout_id uuid := gen_random_uuid();
  we record; ps record; se record; ss record; new_exercise_id uuid; apply_exercise boolean; apply_series boolean;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into source_session from public.training_sessions where id = p_session_id and professional_id = owner_id and status in ('completed','partial') for update;
  if not found then raise exception 'Completed session not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.training_session_prescription_promotions where session_id = p_session_id) then raise exception 'This session was already promoted' using errcode = '23505'; end if;
  if jsonb_typeof(p_selection) <> 'array' or jsonb_array_length(p_selection) = 0 then raise exception 'At least one change must be selected' using errcode = '22023'; end if;
  select * into source_workout from public.workouts where id = source_session.workout_id and professional_id = owner_id for update;
  if not source_workout.is_current then raise exception 'The executed workout is no longer current; review the newer prescription before promoting' using errcode = '55000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || source_workout.lineage_id::text, 0));
  select coalesce(max(version), 0) + 1 into next_version from public.workouts where professional_id = owner_id and lineage_id = source_workout.lineage_id;
  update public.workouts set is_current = false where id = source_workout.id;
  insert into public.workouts (id,professional_id,period_id,lineage_id,version,supersedes_workout_id,is_current,published_at,name,focus,sequence,estimated_duration_minutes,target_executions,notes,status)
    select new_workout_id,professional_id,period_id,lineage_id,next_version,id,true,null,name,focus,sequence,estimated_duration_minutes,target_executions,notes,'draft' from public.workouts where id = source_workout.id;
  update public.period_workout_slots set workout_id = new_workout_id where workout_id = source_workout.id and professional_id = owner_id;
  for we in select * from public.workout_exercises where workout_id = source_workout.id order by position loop
    select * into se from public.training_session_exercises where session_id = p_session_id and prescribed_workout_exercise_id = we.id;
    apply_exercise := exists (select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and coalesce((x->'changes'->>'exercise')::boolean,false));
    new_exercise_id := gen_random_uuid();
    insert into public.workout_exercises (id,professional_id,workout_id,exercise_source,system_exercise_id,custom_exercise_id,exercise_name_snapshot,exercise_metadata_snapshot,position,instructions,rest_between_sets_seconds,tempo,rir_target_min,rir_target_max,rpe_target,load_notes,group_key,group_position)
      values (new_exercise_id,owner_id,new_workout_id,case when apply_exercise then se.executed_exercise_source else we.exercise_source end,case when apply_exercise and se.executed_exercise_source = 'system' then se.executed_system_exercise_id else we.system_exercise_id end,case when apply_exercise and se.executed_exercise_source = 'custom' then se.executed_custom_exercise_id else we.custom_exercise_id end,case when apply_exercise then se.executed_name_snapshot else we.exercise_name_snapshot end,case when apply_exercise then coalesce(se.executed_metadata_snapshot,we.exercise_metadata_snapshot) else we.exercise_metadata_snapshot end,we.position,we.instructions,we.rest_between_sets_seconds,we.tempo,we.rir_target_min,we.rir_target_max,we.rpe_target,we.load_notes,we.group_key,we.group_position);
    for ps in select * from public.prescribed_sets where workout_exercise_id = we.id order by set_number loop
      select * into ss from public.training_session_sets where session_exercise_id = se.id and prescribed_set_id = ps.id;
      apply_series := exists (select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and coalesce((x->'changes'->>'series')::boolean,false));
      if not (apply_series and ss.is_removed) then
        insert into public.prescribed_sets (id,professional_id,workout_exercise_id,set_number,set_type,method,reps_min,reps_max,duration_seconds,distance_meters,target_load,load_unit,load_percentage,rir_target,rpe_target,rest_after_seconds,notes)
        values (gen_random_uuid(),owner_id,new_exercise_id,ps.set_number,ps.set_type,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and x->>'session_set_id' = ss.id::text and coalesce((x->'changes'->>'method')::boolean,false)) then ss.actual_method else ps.method end,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and x->>'session_set_id' = ss.id::text and coalesce((x->'changes'->>'reps')::boolean,false)) then ss.actual_reps else ps.reps_min end,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and x->>'session_set_id' = ss.id::text and coalesce((x->'changes'->>'reps')::boolean,false)) then ss.actual_reps else ps.reps_max end,ps.duration_seconds,ps.distance_meters,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and x->>'session_set_id' = ss.id::text and coalesce((x->'changes'->>'load')::boolean,false)) then ss.actual_load else ps.target_load end,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id' = se.id::text and x->>'session_set_id' = ss.id::text and coalesce((x->'changes'->>'load')::boolean,false)) then coalesce(ss.actual_load_unit,ps.load_unit) else ps.load_unit end,ps.load_percentage,ps.rir_target,ps.rpe_target,ps.rest_after_seconds,ps.notes);
      end if;
    end loop;
    if apply_series then
      for ss in select * from public.training_session_sets where session_exercise_id = se.id and is_added and not is_removed order by set_number loop
        insert into public.prescribed_sets (id,professional_id,workout_exercise_id,set_number,set_type,method,reps_min,reps_max,duration_seconds,distance_meters,target_load,load_unit,load_percentage,rir_target,rpe_target,rest_after_seconds,notes)
        values (gen_random_uuid(),owner_id,new_exercise_id,ss.set_number,coalesce(ss.planned_set_type,'working'),coalesce(ss.actual_method,ss.planned_method,'conventional'),coalesce(ss.actual_reps,ss.planned_reps_min),coalesce(ss.actual_reps,ss.planned_reps_max),ss.planned_duration_seconds,ss.planned_distance_meters,coalesce(ss.actual_load,ss.operational_load,ss.planned_load),coalesce(ss.actual_load_unit,ss.operational_load_unit,ss.planned_load_unit),ss.planned_load_percentage,coalesce(ss.actual_rir,ss.planned_rir),coalesce(ss.actual_rpe,ss.planned_rpe),ss.planned_rest_after_seconds,ss.planned_notes);
      end loop;
    end if;
  end loop;
  insert into public.training_session_prescription_promotions (professional_id,session_id,source_workout_id,promoted_workout_id,selected_changes) values (owner_id,p_session_id,source_workout.id,new_workout_id,p_selection);
  update public.workouts set published_at = now(), status = 'active' where id = new_workout_id;
  return new_workout_id;
end; $$;

revoke all on function public.promote_training_session_changes(uuid, jsonb) from public;
grant execute on function public.promote_training_session_changes(uuid, jsonb) to authenticated;
