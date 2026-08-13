-- Operational load recovery and auditable promotion of executed changes.

alter table public.training_session_sets
  add column operational_load numeric(10,2) check (operational_load is null or operational_load >= 0),
  add column operational_load_unit text check (operational_load_unit is null or operational_load_unit in ('kg', 'lb', 'percent_1rm', 'bodyweight')),
  add column operational_load_source text not null default 'planned'
    check (operational_load_source in ('last_execution', 'planned', 'empty'));

create table public.training_session_prescription_promotions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete restrict,
  session_id uuid not null,
  source_workout_id uuid not null,
  promoted_workout_id uuid not null,
  selected_changes jsonb not null,
  created_at timestamptz not null default now(),
  constraint training_session_prescription_promotions_session_owner_fk
    foreign key (session_id, professional_id) references public.training_sessions(id, professional_id) on delete restrict,
  constraint training_session_prescription_promotions_source_owner_fk
    foreign key (source_workout_id, professional_id) references public.workouts(id, professional_id) on delete restrict,
  constraint training_session_prescription_promotions_target_owner_fk
    foreign key (promoted_workout_id, professional_id) references public.workouts(id, professional_id) on delete restrict,
  unique (session_id),
  unique (id, professional_id)
);

create index training_session_promotions_owner_idx
  on public.training_session_prescription_promotions(professional_id, created_at desc);

alter table public.training_session_prescription_promotions enable row level security;
create policy training_session_promotions_owner_all on public.training_session_prescription_promotions for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);
grant select on public.training_session_prescription_promotions to authenticated;

create or replace function public.start_training_session(
  p_workout_id uuid,
  p_idempotency_key uuid,
  p_responsible_professional_id uuid default null,
  p_appointment_id uuid default null,
  p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid()); target_workout public.workouts%rowtype;
  target_period public.training_periods%rowtype; target_protocol public.training_protocols%rowtype;
  existing_session_id uuid; new_session_id uuid := gen_random_uuid(); source_exercise record; source_set record;
  new_session_exercise_id uuid; full_snapshot jsonb; recovered_load numeric; recovered_unit text;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key is required' using errcode = '22023'; end if;
  select id into existing_session_id from public.training_sessions where professional_id=owner_id and idempotency_key=p_idempotency_key;
  if existing_session_id is not null then return existing_session_id; end if;
  select * into target_workout from public.workouts where id=p_workout_id and professional_id=owner_id and is_current for share;
  if not found then raise exception 'Current workout not found' using errcode='P0002'; end if;
  select * into target_period from public.training_periods where id=target_workout.period_id and professional_id=owner_id;
  select * into target_protocol from public.training_protocols where id=target_period.protocol_id and professional_id=owner_id;
  if coalesce(p_responsible_professional_id,owner_id) <> owner_id then raise exception 'Responsible professional is not available to this owner' using errcode='42501'; end if;
  if p_appointment_id is not null and not exists (select 1 from public.appointments a where a.id=p_appointment_id and a.professional_id=owner_id and a.student_id=target_protocol.student_id and a.type='training') then raise exception 'Appointment does not match this training session' using errcode='23514'; end if;
  select jsonb_build_object('snapshot_version',1,'protocol',jsonb_build_object('id',target_protocol.id,'name',target_protocol.name,'objective',target_protocol.objective),'period',jsonb_build_object('id',target_period.id,'name',target_period.name,'sequence',target_period.sequence),'workout',jsonb_build_object('id',target_workout.id,'lineage_id',target_workout.lineage_id,'version',target_workout.version,'name',target_workout.name,'focus',target_workout.focus),'exercises',coalesce(jsonb_agg(exercise_json order by exercise_position),'[]'::jsonb)) into full_snapshot from (select we.position exercise_position,jsonb_build_object('id',we.id,'position',we.position,'exercise_source',we.exercise_source,'system_exercise_id',we.system_exercise_id,'custom_exercise_id',we.custom_exercise_id,'name',we.exercise_name_snapshot,'metadata',we.exercise_metadata_snapshot,'sets',coalesce((select jsonb_agg(to_jsonb(ps)-'professional_id'-'created_at'-'updated_at' order by ps.set_number) from public.prescribed_sets ps where ps.workout_exercise_id=we.id),'[]'::jsonb)) exercise_json from public.workout_exercises we where we.workout_id=target_workout.id) q;
  begin
    insert into public.training_sessions (id,professional_id,responsible_professional_id,student_id,protocol_id,period_id,workout_id,appointment_id,idempotency_key,notes,prescription_snapshot) values (new_session_id,owner_id,coalesce(p_responsible_professional_id,owner_id),target_protocol.student_id,target_protocol.id,target_period.id,target_workout.id,p_appointment_id,p_idempotency_key,p_notes,full_snapshot);
  exception when unique_violation then
    select id into existing_session_id from public.training_sessions where professional_id=owner_id and idempotency_key=p_idempotency_key;
    if existing_session_id is null and p_appointment_id is not null then select id into existing_session_id from public.training_sessions where appointment_id=p_appointment_id and status in ('in_progress','completed','partial'); end if;
    if existing_session_id is not null then return existing_session_id; end if; raise;
  end;
  for source_exercise in select we.* from public.workout_exercises we where we.workout_id=target_workout.id order by we.position loop
    new_session_exercise_id:=gen_random_uuid();
    insert into public.training_session_exercises (id,professional_id,session_id,prescribed_workout_exercise_id,position,baseline_snapshot,muscle_participation_snapshot) values (new_session_exercise_id,owner_id,new_session_id,source_exercise.id,source_exercise.position,to_jsonb(source_exercise)-'professional_id'-'created_at'-'updated_at',coalesce(source_exercise.exercise_metadata_snapshot->'muscles','[]'::jsonb));
    for source_set in select ps.* from public.prescribed_sets ps where ps.workout_exercise_id=source_exercise.id order by ps.set_number loop
      select coalesce(ss.actual_load,ss.planned_load), coalesce(ss.actual_load_unit,ss.planned_load_unit) into recovered_load,recovered_unit
      from public.training_session_sets ss join public.training_session_exercises se on se.id=ss.session_exercise_id join public.training_sessions prior on prior.id=se.session_id
      where prior.professional_id=owner_id and prior.student_id=target_protocol.student_id and prior.status in ('completed','partial')
        and se.execution_source='prescribed' and se.prescribed_workout_exercise_id is not null
        and se.baseline_snapshot->>'exercise_source'=source_exercise.exercise_source
        and coalesce((se.baseline_snapshot->>'system_exercise_id')::bigint,-1)=coalesce(source_exercise.system_exercise_id,-1)
        and coalesce((se.baseline_snapshot->>'custom_exercise_id')::bigint,-1)=coalesce(source_exercise.custom_exercise_id,-1)
        and ss.set_number=source_set.set_number and not ss.is_removed and ss.status <> 'skipped'
      order by prior.completed_at desc nulls last, prior.started_at desc limit 1;
      insert into public.training_session_sets (professional_id,session_exercise_id,prescribed_set_id,set_number,planned_set_type,planned_method,planned_reps_min,planned_reps_max,planned_duration_seconds,planned_distance_meters,planned_load,planned_load_unit,planned_load_percentage,planned_rir,planned_rpe,planned_rest_after_seconds,planned_notes,reps_source,load_source,operational_load,operational_load_unit,operational_load_source,baseline_snapshot) values (owner_id,new_session_exercise_id,source_set.id,source_set.set_number,source_set.set_type,source_set.method,source_set.reps_min,source_set.reps_max,source_set.duration_seconds,source_set.distance_meters,source_set.target_load,source_set.load_unit,source_set.load_percentage,source_set.rir_target,source_set.rpe_target,source_set.rest_after_seconds,source_set.notes,'unresolved','unresolved',coalesce(recovered_load,source_set.target_load),coalesce(recovered_unit,source_set.load_unit),case when recovered_load is not null then 'last_execution' when source_set.target_load is not null then 'planned' else 'empty' end,to_jsonb(source_set)-'professional_id'-'created_at'-'updated_at');
    end loop;
  end loop;
  return new_session_id;
end; $$;

create or replace function public.promote_training_session_changes(p_session_id uuid, p_selection jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); source_session public.training_sessions%rowtype; source_workout public.workouts%rowtype; next_version integer; new_workout_id uuid:=gen_random_uuid(); we record; ps record; se record; ss record; new_exercise_id uuid; apply_exercise boolean; apply_series boolean;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into source_session from public.training_sessions where id=p_session_id and professional_id=owner_id and status in ('completed','partial') for update;
  if not found then raise exception 'Completed session not found' using errcode='P0002'; end if;
  if exists(select 1 from public.training_session_prescription_promotions where session_id=p_session_id) then raise exception 'This session was already promoted' using errcode='23505'; end if;
  if jsonb_typeof(p_selection) <> 'array' or jsonb_array_length(p_selection)=0 then raise exception 'At least one change must be selected' using errcode='22023'; end if;
  select * into source_workout from public.workouts where id=source_session.workout_id and professional_id=owner_id for update;
  if not source_workout.is_current then raise exception 'The executed workout is no longer current; review the newer prescription before promoting' using errcode='55000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||source_workout.lineage_id::text,0));
  select coalesce(max(version),0)+1 into next_version from public.workouts where professional_id=owner_id and lineage_id=source_workout.lineage_id;
  update public.workouts set is_current=false where id=source_workout.id;
  insert into public.workouts (id,professional_id,period_id,lineage_id,version,supersedes_workout_id,is_current,published_at,name,focus,sequence,estimated_duration_minutes,target_executions,notes,status) select new_workout_id,professional_id,period_id,lineage_id,next_version,id,true,now(),name,focus,sequence,estimated_duration_minutes,target_executions,notes,'active' from public.workouts where id=source_workout.id;
  insert into public.period_workout_slots (id,professional_id,period_id,workout_id,weekday,sequence_in_week,occurrences_per_week,label) select gen_random_uuid(),professional_id,period_id,new_workout_id,weekday,sequence_in_week,occurrences_per_week,label from public.period_workout_slots where workout_id=source_workout.id;
  for we in select * from public.workout_exercises where workout_id=source_workout.id order by position loop
    select * into se from public.training_session_exercises where session_id=p_session_id and prescribed_workout_exercise_id=we.id;
    apply_exercise:= exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and coalesce((x->'changes'->>'exercise')::boolean,false));
    new_exercise_id:=gen_random_uuid();
    insert into public.workout_exercises (id,professional_id,workout_id,exercise_source,system_exercise_id,custom_exercise_id,exercise_name_snapshot,exercise_metadata_snapshot,position,instructions,rest_between_sets_seconds,tempo,rir_target_min,rir_target_max,rpe_target,load_notes,group_key,group_position)
    values (new_exercise_id,owner_id,new_workout_id,case when apply_exercise then se.executed_exercise_source else we.exercise_source end,case when apply_exercise and se.executed_exercise_source='system' then se.executed_system_exercise_id else we.system_exercise_id end,case when apply_exercise and se.executed_exercise_source='custom' then se.executed_custom_exercise_id else we.custom_exercise_id end,case when apply_exercise then se.executed_name_snapshot else we.exercise_name_snapshot end,case when apply_exercise then coalesce(se.executed_metadata_snapshot,we.exercise_metadata_snapshot) else we.exercise_metadata_snapshot end,we.position,we.instructions,we.rest_between_sets_seconds,we.tempo,we.rir_target_min,we.rir_target_max,we.rpe_target,we.load_notes,we.group_key,we.group_position);
    for ps in select * from public.prescribed_sets where workout_exercise_id=we.id order by set_number loop
      select * into ss from public.training_session_sets where session_exercise_id=se.id and prescribed_set_id=ps.id;
      apply_series:=exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and coalesce((x->'changes'->>'series')::boolean,false));
      if not (apply_series and ss.is_removed) then
        insert into public.prescribed_sets (id,professional_id,workout_exercise_id,set_number,set_type,method,reps_min,reps_max,duration_seconds,distance_meters,target_load,load_unit,load_percentage,rir_target,rpe_target,rest_after_seconds,notes) values (gen_random_uuid(),owner_id,new_exercise_id,ps.set_number,ps.set_type,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and x->>'session_set_id'=ss.id::text and coalesce((x->'changes'->>'method')::boolean,false)) then ss.actual_method else ps.method end,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and x->>'session_set_id'=ss.id::text and coalesce((x->'changes'->>'reps')::boolean,false)) then ss.actual_reps else ps.reps_min end,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and x->>'session_set_id'=ss.id::text and coalesce((x->'changes'->>'reps')::boolean,false)) then ss.actual_reps else ps.reps_max end,ps.duration_seconds,ps.distance_meters,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and x->>'session_set_id'=ss.id::text and coalesce((x->'changes'->>'load')::boolean,false)) then ss.actual_load else ps.target_load end,case when exists(select 1 from jsonb_array_elements(p_selection) x where x->>'session_exercise_id'=se.id::text and x->>'session_set_id'=ss.id::text and coalesce((x->'changes'->>'load')::boolean,false)) then coalesce(ss.actual_load_unit,ps.load_unit) else ps.load_unit end,ps.load_percentage,ps.rir_target,ps.rpe_target,ps.rest_after_seconds,ps.notes);
      end if;
    end loop;
    if apply_series then for ss in select * from public.training_session_sets where session_exercise_id=se.id and is_added and not is_removed order by set_number loop insert into public.prescribed_sets (id,professional_id,workout_exercise_id,set_number,set_type,method,reps_min,reps_max,duration_seconds,distance_meters,target_load,load_unit,load_percentage,rir_target,rpe_target,rest_after_seconds,notes) values (gen_random_uuid(),owner_id,new_exercise_id,ss.set_number,coalesce(ss.planned_set_type,'working'),coalesce(ss.actual_method,ss.planned_method,'conventional'),coalesce(ss.actual_reps,ss.planned_reps_min),coalesce(ss.actual_reps,ss.planned_reps_max),ss.planned_duration_seconds,ss.planned_distance_meters,coalesce(ss.actual_load,ss.operational_load,ss.planned_load),coalesce(ss.actual_load_unit,ss.operational_load_unit,ss.planned_load_unit),ss.planned_load_percentage,coalesce(ss.actual_rir,ss.planned_rir),coalesce(ss.actual_rpe,ss.planned_rpe),ss.planned_rest_after_seconds,ss.planned_notes); end loop; end if;
  end loop;
  insert into public.training_session_prescription_promotions (professional_id,session_id,source_workout_id,promoted_workout_id,selected_changes) values (owner_id,p_session_id,source_workout.id,new_workout_id,p_selection);
  return new_workout_id;
end; $$;

revoke all on function public.start_training_session(uuid,uuid,uuid,uuid,text) from public;
revoke all on function public.promote_training_session_changes(uuid,jsonb) from public;
grant execute on function public.start_training_session(uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.promote_training_session_changes(uuid,jsonb) to authenticated;
