-- Historical planned occurrences and the first stable student-report contract.

alter table public.profiles
  add column if not exists timezone text not null default 'America/Sao_Paulo';

create or replace function public.is_valid_timezone(p_timezone text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone);
$$;

alter table public.profiles
  add constraint profiles_timezone_valid check (public.is_valid_timezone(timezone));

create table public.planned_training_occurrences (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete restrict,
  student_id uuid not null,
  training_protocol_id uuid not null,
  training_period_id uuid not null,
  period_workout_slot_id uuid,
  workout_id uuid not null,
  workout_lineage_id uuid not null,
  occurrence_index smallint not null default 1 check (occurrence_index > 0),
  local_date date not null,
  local_week_start date not null,
  timezone text not null,
  competence_at timestamptz not null,
  source text not null default 'prescription_slot'
    check (source in ('prescription_slot', 'appointment', 'manual')),
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'partial', 'missed', 'cancelled', 'superseded')),
  appointment_id uuid references public.appointments(id) on delete set null,
  training_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint planned_occurrences_student_owner_fk
    foreign key (student_id, professional_id) references public.students(id, professional_id) on delete restrict,
  constraint planned_occurrences_protocol_owner_fk
    foreign key (training_protocol_id, professional_id) references public.training_protocols(id, professional_id) on delete restrict,
  constraint planned_occurrences_period_owner_fk
    foreign key (training_period_id, professional_id) references public.training_periods(id, professional_id) on delete restrict,
  constraint planned_occurrences_slot_owner_fk
    foreign key (period_workout_slot_id, professional_id) references public.period_workout_slots(id, professional_id)
    on delete set null (period_workout_slot_id),
  constraint planned_occurrences_workout_owner_fk
    foreign key (workout_id, professional_id) references public.workouts(id, professional_id) on delete restrict,
  constraint planned_occurrences_session_owner_fk
    foreign key (training_session_id, professional_id) references public.training_sessions(id, professional_id)
    on delete set null (training_session_id),
  constraint planned_occurrences_timezone_valid check (public.is_valid_timezone(timezone)),
  constraint planned_occurrences_week_start check (extract(isodow from local_week_start) = 1),
  constraint planned_occurrences_status_time check ((status = 'superseded') = (superseded_at is not null))
);

create unique index planned_occurrences_one_appointment_idx
  on public.planned_training_occurrences(appointment_id) where appointment_id is not null;
create unique index planned_occurrences_one_session_idx
  on public.planned_training_occurrences(training_session_id) where training_session_id is not null;
create unique index planned_occurrences_one_active_slot_date_idx
  on public.planned_training_occurrences(period_workout_slot_id, local_date, occurrence_index)
  where period_workout_slot_id is not null and status <> 'superseded';
create index planned_occurrences_student_date_idx
  on public.planned_training_occurrences(professional_id, student_id, local_date);
create index planned_occurrences_active_date_idx
  on public.planned_training_occurrences(professional_id, local_date)
  where status not in ('cancelled', 'superseded');

create trigger planned_training_occurrences_set_updated_at
before update on public.planned_training_occurrences
for each row execute function public.set_updated_at();

alter table public.planned_training_occurrences enable row level security;
create policy planned_training_occurrences_owner_all on public.planned_training_occurrences
  for all to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);
grant select, insert, update, delete on public.planned_training_occurrences to authenticated;

create or replace function public.protect_planned_occurrence_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.professional_id is distinct from old.professional_id
    or new.student_id is distinct from old.student_id
    or new.training_protocol_id is distinct from old.training_protocol_id
    or new.training_period_id is distinct from old.training_period_id
    or new.workout_id is distinct from old.workout_id
    or new.workout_lineage_id is distinct from old.workout_lineage_id
    or new.local_date is distinct from old.local_date
    or new.local_week_start is distinct from old.local_week_start
    or new.timezone is distinct from old.timezone
    or new.competence_at is distinct from old.competence_at
    or new.source is distinct from old.source
    or new.occurrence_index is distinct from old.occurrence_index then
    raise exception 'Historical planned occurrence identity is immutable' using errcode = '55000';
  end if;
  return new;
end; $$;

create trigger planned_occurrences_protect_identity
before update on public.planned_training_occurrences
for each row execute function public.protect_planned_occurrence_identity();

create or replace function public.materialize_planned_occurrences_for_slot(p_slot_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  target_slot public.period_workout_slots%rowtype;
  target_period public.training_periods%rowtype;
  target_protocol public.training_protocols%rowtype;
  target_workout public.workouts%rowtype;
  target_timezone text;
  range_start date;
  range_end date;
  week_start date;
  occurrence_date date;
  occurrence_number integer;
  inserted_count integer := 0;
begin
  select * into target_slot from public.period_workout_slots where id = p_slot_id;
  if not found then return 0; end if;
  select * into target_period from public.training_periods where id = target_slot.period_id;
  select * into target_protocol from public.training_protocols where id = target_period.protocol_id;
  select * into target_workout from public.workouts where id = target_slot.workout_id;
  select timezone into target_timezone from public.profiles where id = target_slot.professional_id;

  range_start := greatest((now() at time zone target_timezone)::date,
    coalesce(target_period.start_date, target_protocol.start_date, (now() at time zone target_timezone)::date));
  range_end := coalesce(target_period.end_date, target_protocol.end_date);
  if range_end is null or range_end < range_start or target_workout.published_at is null then return 0; end if;

  week_start := date_trunc('week', range_start::timestamp)::date;
  while week_start <= range_end loop
    for occurrence_number in 1..target_slot.occurrences_per_week loop
      occurrence_date := week_start + case
        when target_slot.weekday is null then target_slot.sequence_in_week - 1
        when target_slot.weekday = 0 then 6
        else target_slot.weekday - 1 end;
      if occurrence_date between range_start and range_end then
        insert into public.planned_training_occurrences (
          professional_id, student_id, training_protocol_id, training_period_id,
          period_workout_slot_id, workout_id, workout_lineage_id, occurrence_index,
          local_date, local_week_start, timezone, competence_at
        ) values (
          target_slot.professional_id, target_protocol.student_id, target_protocol.id, target_period.id,
          target_slot.id, target_workout.id, target_workout.lineage_id, occurrence_number,
          occurrence_date, week_start, target_timezone, occurrence_date::timestamp at time zone target_timezone
        ) on conflict (period_workout_slot_id, local_date, occurrence_index)
          where period_workout_slot_id is not null and status <> 'superseded' do nothing;
        if found then inserted_count := inserted_count + 1; end if;
      end if;
    end loop;
    week_start := week_start + 7;
  end loop;
  return inserted_count;
end; $$;

create or replace function public.sync_planned_occurrences_from_slot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.planned_training_occurrences
       set status = 'superseded', superseded_at = now()
     where period_workout_slot_id = old.id
       and local_date >= (now() at time zone timezone)::date
       and status = 'planned'
       and appointment_id is null and training_session_id is null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.materialize_planned_occurrences_for_slot(new.id); end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger period_workout_slots_sync_occurrences
after insert or update on public.period_workout_slots
for each row execute function public.sync_planned_occurrences_from_slot();

create trigger period_workout_slots_supersede_occurrences
before delete on public.period_workout_slots
for each row execute function public.sync_planned_occurrences_from_slot();

-- Establish the foundation prospectively for plans that already exist. No past date is generated.
do $$ declare slot record; begin
  for slot in select id from public.period_workout_slots loop
    perform public.materialize_planned_occurrences_for_slot(slot.id);
  end loop;
end $$;

create or replace function public.link_training_session_occurrence()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_id uuid;
begin
  select id into target_id from public.planned_training_occurrences
   where professional_id = new.professional_id and training_session_id = new.id
   limit 1 for update;
  if target_id is null and new.appointment_id is not null then
    select id into target_id from public.planned_training_occurrences
     where professional_id = new.professional_id and appointment_id = new.appointment_id
     order by competence_at limit 1 for update;
  end if;
  if target_id is null then
    select id into target_id from public.planned_training_occurrences
     where professional_id = new.professional_id and student_id = new.student_id
       and workout_lineage_id = (select lineage_id from public.workouts where id = new.workout_id)
       and local_date = (new.started_at at time zone timezone)::date
       and status = 'planned' and training_session_id is null
     order by occurrence_index limit 1 for update;
  end if;
  if target_id is not null then
    update public.planned_training_occurrences set training_session_id = new.id,
      status = case when new.status = 'completed' then 'completed' when new.status = 'partial' then 'partial' else status end
    where id = target_id;
  end if;
  return new;
end; $$;

create trigger training_sessions_link_occurrence
after insert or update of status on public.training_sessions
for each row execute function public.link_training_session_occurrence();

create or replace function public.report_volume_quality_rank(p_quality text)
returns integer language sql immutable security invoker set search_path = '' as $$
  select case p_quality when 'measured' then 1 when 'assumed' then 2 when 'estimated' then 3 else 4 end;
$$;

create or replace function public.get_student_training_report(
  p_student_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_timezone text default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); report_timezone text; from_date date; to_date date; result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_to <= p_from then raise exception 'Report end must be after start' using errcode = '22023'; end if;
  if not exists (select 1 from public.students where id = p_student_id and professional_id = owner_id) then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  select coalesce(p_timezone, timezone) into report_timezone from public.profiles where id = owner_id;
  if not public.is_valid_timezone(report_timezone) then raise exception 'Invalid timezone' using errcode = '22023'; end if;
  from_date := (p_from at time zone report_timezone)::date;
  to_date := (p_to at time zone report_timezone)::date;

  with planned_occurrences as (
    select o.* from public.planned_training_occurrences o
    where o.professional_id = owner_id and o.student_id = p_student_id
      and o.local_date >= from_date and o.local_date < to_date and o.status not in ('cancelled','superseded')
  ), planned_sets as (
    select o.id occurrence_id, o.local_date fact_date, we.exercise_metadata_snapshot,
      ps.id set_id, ps.reps_min, ps.reps_max, ps.target_load, ps.load_unit, ps.method, ps.notes
    from planned_occurrences o join public.workout_exercises we on we.workout_id = o.workout_id
    join public.prescribed_sets ps on ps.workout_exercise_id = we.id
    where ps.set_type = 'working'
  ), planned_facts as (
    select *, case
      when target_load is null or load_unit <> 'kg' then null
      when notes is not null and notes like '%personalflow_advanced_blocks%' then
        (select sum((b.value::text)::numeric * coalesce((l.value::text)::numeric, target_load))
           from jsonb_array_elements(coalesce((notes::jsonb)->'personalflow_advanced_blocks','[]')) with ordinality b
           left join jsonb_array_elements(coalesce((notes::jsonb)->'personalflow_advanced_block_loads','[]')) with ordinality l on l.ordinality=b.ordinality)
      when reps_min is not null and reps_max is not null then ((reps_min + reps_max) / 2) * target_load
      else coalesce(reps_min,reps_max) * target_load end volume,
      case when target_load is null or load_unit <> 'kg' or (reps_min is null and reps_max is null and coalesce(notes,'') not like '%personalflow_advanced_blocks%') then 'unavailable'
        when reps_min is distinct from reps_max then 'estimated'
        when coalesce(notes,'') like '%personalflow_advanced_blocks%' and coalesce((notes::jsonb)->'personalflow_advanced_block_loads','[]') = '[]'::jsonb then 'estimated'
        else 'assumed' end quality,
      (select e->>'muscle' from jsonb_array_elements(coalesce(exercise_metadata_snapshot->'muscles','[]')) e where e->>'role'='Principal' order by (e->>'factor')::numeric desc limit 1) muscle
    from planned_sets
  ), realized_sets as (
    select s.id session_id, (s.completed_at at time zone report_timezone)::date fact_date,
      ss.*, se.execution_source, se.baseline_snapshot, se.executed_metadata_snapshot, se.muscle_participation_snapshot
    from public.training_sessions s join public.training_session_exercises se on se.session_id=s.id
    join public.training_session_sets ss on ss.session_exercise_id=se.id
    where s.professional_id=owner_id and s.student_id=p_student_id and s.status in ('completed','partial')
      and s.completed_at >= p_from and s.completed_at < p_to and ss.status in ('completed','assumed_completed','partial') and not ss.is_removed
  ), realized_facts as (
    select *, case
      when actual_blocks is not null then (select sum((b->>'reps')::numeric * (b->>'load')::numeric) from jsonb_array_elements(actual_blocks)b where b->>'status'='completed' and b->>'load' is not null)
      when actual_reps is not null and actual_load is not null and actual_load_unit='kg' then actual_reps*actual_load
      when status='assumed_completed' and planned_load_unit='kg' and planned_load is not null then coalesce(actual_reps,(planned_reps_min+planned_reps_max)/2,planned_reps_min,planned_reps_max)*planned_load
      else null end volume,
      case when actual_blocks is not null or (actual_reps is not null and actual_load is not null and actual_load_unit='kg') then 'measured'
        when status='assumed_completed' and planned_load is not null and planned_load_unit='kg' and planned_reps_min=planned_reps_max then 'assumed'
        when status='assumed_completed' and planned_load is not null and planned_load_unit='kg' and (planned_reps_min is not null or planned_reps_max is not null) then 'estimated'
        else 'unavailable' end quality,
      (select e->>'muscle' from jsonb_array_elements(case when execution_source='substituted' then coalesce(executed_metadata_snapshot->'muscles','[]') else muscle_participation_snapshot end)e where e->>'role'='Principal' order by (e->>'factor')::numeric desc limit 1) muscle
    from realized_sets
  ), series_by_muscle as (
    select muscle, sum(planned)::int planned, sum(realized)::int realized from (
      select muscle, count(*) planned, 0 realized from planned_facts group by muscle
      union all select muscle, 0, count(*) from realized_facts group by muscle
    ) x group by muscle
  ), timeline as (
    select bucket, sum(planned_occurrences)::int planned_occurrences,
      sum(realized_sessions)::int realized_sessions, sum(planned_series)::int planned_series,
      sum(realized_series)::int realized_series, sum(planned_volume) planned_volume_load,
      sum(realized_volume) realized_volume_load from (
      select date_trunc('week',local_date::timestamp)::date bucket,count(*) planned_occurrences,0 realized_sessions,0 planned_series,0 realized_series,0::numeric planned_volume,0::numeric realized_volume from planned_occurrences group by 1
      union all select date_trunc('week',(completed_at at time zone report_timezone))::date,0,count(*),0,0,0,0 from public.training_sessions where professional_id=owner_id and student_id=p_student_id and status in ('completed','partial') and completed_at>=p_from and completed_at<p_to group by 1
      union all select date_trunc('week',fact_date::timestamp)::date,0,0,count(*),0,coalesce(sum(volume),0),0 from planned_facts group by 1
      union all select date_trunc('week',fact_date::timestamp)::date,0,0,0,count(*),0,coalesce(sum(volume),0) from realized_facts group by 1
    )x group by bucket order by bucket
  ), months as (
    select date_trunc('month',bucket::timestamp)::date bucket,
      sum(planned_occurrences)::int planned_occurrences, sum(realized_sessions)::int realized_sessions,
      sum(planned_series)::int planned_series, sum(realized_series)::int realized_series,
      sum(planned_volume_load) planned_volume_load, sum(realized_volume_load) realized_volume_load
    from timeline group by 1 order by 1
  )
  select jsonb_build_object(
    'contract_version',1,'student_id',p_student_id,'timezone',report_timezone,'from',p_from,'to',p_to,
    'planning_quality',case when exists(select 1 from planned_occurrences) then 'measured' else 'unavailable' end,
    'summary',jsonb_build_object(
      'planned_occurrences',(select count(*) from planned_occurrences),
      'realized_sessions',(select count(*) from public.training_sessions s where s.professional_id=owner_id and s.student_id=p_student_id and s.status in ('completed','partial') and s.completed_at>=p_from and s.completed_at<p_to),
      'planned_series',(select count(*) from planned_facts), 'realized_series',(select count(*) from realized_facts),
      'planned_volume_load',(select sum(volume) from planned_facts), 'realized_volume_load',(select sum(volume) from realized_facts),
      'planned_volume_quality',coalesce((select quality from planned_facts order by public.report_volume_quality_rank(quality) desc limit 1),'unavailable'),
      'realized_volume_quality',coalesce((select quality from realized_facts order by public.report_volume_quality_rank(quality) desc limit 1),'unavailable')
    ),
    'series_by_primary_muscle',coalesce((select jsonb_agg(jsonb_build_object('muscle',coalesce(muscle,'Unclassified'),'planned',planned,'realized',realized) order by coalesce(muscle,'Unclassified')) from series_by_muscle),'[]'::jsonb),
    'weekly',coalesce((select jsonb_agg(jsonb_build_object('week_start',bucket,'planned_occurrences',planned_occurrences,'realized_sessions',realized_sessions,'planned_series',planned_series,'realized_series',realized_series,'planned_volume_load',planned_volume_load,'realized_volume_load',realized_volume_load) order by bucket) from timeline),'[]'::jsonb),
    'monthly',coalesce((select jsonb_agg(jsonb_build_object('month_start',bucket,'planned_occurrences',planned_occurrences,'realized_sessions',realized_sessions,'planned_series',planned_series,'realized_series',realized_series,'planned_volume_load',planned_volume_load,'realized_volume_load',realized_volume_load) order by bucket) from months),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

revoke all on function public.is_valid_timezone(text) from public;
revoke all on function public.protect_planned_occurrence_identity() from public;
revoke all on function public.materialize_planned_occurrences_for_slot(uuid) from public;
revoke all on function public.sync_planned_occurrences_from_slot() from public;
revoke all on function public.link_training_session_occurrence() from public;
revoke all on function public.report_volume_quality_rank(text) from public;
revoke all on function public.get_student_training_report(uuid,timestamptz,timestamptz,text) from public;
grant execute on function public.is_valid_timezone(text) to authenticated;
grant execute on function public.materialize_planned_occurrences_for_slot(uuid) to authenticated;
grant execute on function public.report_volume_quality_rank(text) to authenticated;
grant execute on function public.get_student_training_report(uuid,timestamptz,timestamptz,text) to authenticated;
