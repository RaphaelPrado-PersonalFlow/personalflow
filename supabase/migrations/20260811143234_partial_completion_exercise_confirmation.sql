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
    -- Confirming an exercise confirms its untouched sets without requiring a set-by-set checklist.
    update public.training_session_sets ss set
      status = 'assumed_completed',
      reps_source = case when ss.planned_reps_min is not null and ss.planned_reps_max = ss.planned_reps_min then 'planned_exact'
        when ss.planned_reps_min is not null or ss.planned_reps_max is not null then 'planned_range' else 'unresolved' end,
      load_source = case when ss.planned_load is not null then 'planned' else 'unresolved' end
    from public.training_session_exercises se
    where ss.session_exercise_id = se.id and se.session_id = p_session_id
      and se.status = 'completed' and ss.status = 'pending' and not ss.is_removed;

    update public.training_session_sets ss set status = 'skipped'
    from public.training_session_exercises se
    where ss.session_exercise_id = se.id and se.session_id = p_session_id and ss.status = 'pending';

    update public.training_session_exercises se set status = case
      when exists (select 1 from public.training_session_sets ss where ss.session_exercise_id = se.id
        and ss.status in ('completed','assumed_completed','partial')) then 'partial' else 'skipped' end
    where se.session_id = p_session_id and se.status = 'pending';
  end if;

  update public.training_sessions set
    status = case when p_mode = 'partial' then 'partial' else 'completed' end,
    completion_mode = p_mode, completed_at = finished_at,
    duration_seconds = greatest(0, extract(epoch from (finished_at - session_started))::integer)
  where id = p_session_id and professional_id = owner_id;
end; $$;

revoke all on function public.complete_training_session(uuid, text) from public;
grant execute on function public.complete_training_session(uuid, text) to authenticated;
