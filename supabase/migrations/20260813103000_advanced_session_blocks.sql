-- Persist prescribed advanced-method blocks and the execution captured for each block.

alter table public.training_session_sets
  add column planned_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(planned_blocks) = 'array'),
  add column actual_blocks jsonb check (actual_blocks is null or jsonb_typeof(actual_blocks) = 'array');

create or replace function public.set_training_session_planned_blocks()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source_notes text; parsed jsonb;
begin
  source_notes := new.baseline_snapshot ->> 'notes';
  begin parsed := source_notes::jsonb; exception when others then parsed := '{}'::jsonb; end;
  new.planned_blocks := coalesce(parsed -> 'personalflow_advanced_blocks', '[]'::jsonb);
  if jsonb_typeof(new.planned_blocks) <> 'array' then new.planned_blocks := '[]'::jsonb; end if;
  return new;
end; $$;

create trigger training_session_sets_copy_planned_blocks
before insert on public.training_session_sets
for each row execute function public.set_training_session_planned_blocks();

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
    actual_method = case when p_changes ? 'actual_method' then p_changes ->> 'actual_method' else actual_method end,
    actual_reps = case when p_changes ? 'actual_reps' then (p_changes ->> 'actual_reps')::numeric else actual_reps end,
    actual_load = case when p_changes ? 'actual_load' then (p_changes ->> 'actual_load')::numeric else actual_load end,
    actual_load_unit = case when p_changes ? 'actual_load_unit' then p_changes ->> 'actual_load_unit' else actual_load_unit end,
    actual_rir = case when p_changes ? 'actual_rir' then (p_changes ->> 'actual_rir')::numeric else actual_rir end,
    actual_rpe = case when p_changes ? 'actual_rpe' then (p_changes ->> 'actual_rpe')::numeric else actual_rpe end,
    actual_blocks = case when p_changes ? 'actual_blocks' then p_changes -> 'actual_blocks' else actual_blocks end,
    actual_duration_seconds = case when p_changes ? 'actual_duration_seconds' then (p_changes ->> 'actual_duration_seconds')::integer else actual_duration_seconds end,
    actual_distance_meters = case when p_changes ? 'actual_distance_meters' then (p_changes ->> 'actual_distance_meters')::numeric else actual_distance_meters end,
    notes = case when p_changes ? 'notes' then p_changes ->> 'notes' else notes end,
    reps_source = case when p_changes ? 'actual_reps' then case when p_changes ->> 'actual_reps' is null then 'unresolved' else 'actual' end else reps_source end,
    load_source = case when p_changes ? 'actual_load' then case when p_changes ->> 'actual_load' is null then 'unresolved' else 'actual' end else load_source end,
    changed = true
  where id = p_set_id and professional_id = owner_id;
end; $$;

revoke all on function public.set_training_session_planned_blocks() from public;
revoke all on function public.update_training_session_set(uuid, jsonb) from public;
grant execute on function public.update_training_session_set(uuid, jsonb) to authenticated;
