-- Preflight and transactional deletion for disposable training protocols.

create index if not exists training_session_promotions_source_owner_idx
  on public.training_session_prescription_promotions(source_workout_id, professional_id);

create index if not exists training_session_promotions_promoted_owner_idx
  on public.training_session_prescription_promotions(promoted_workout_id, professional_id);

create or replace function public.get_training_protocol_deletion_eligibility(p_protocol_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  reasons jsonb := '[]'::jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.training_protocols tp
    where tp.id = p_protocol_id and tp.professional_id = owner_id
  ) then
    raise exception 'Training protocol not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.training_sessions ts
    where ts.professional_id = owner_id
      and (
        ts.protocol_id = p_protocol_id
        or ts.period_id in (
          select tp.id from public.training_periods tp
          where tp.protocol_id = p_protocol_id and tp.professional_id = owner_id
        )
        or ts.workout_id in (
          select w.id
          from public.workouts w
          join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
          where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
        )
      )
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'training_sessions',
      'message', 'O protocolo possui sessões registradas.'
    ));
  end if;

  if exists (
    select 1
    from public.training_session_exercises tse
    join public.workout_exercises we
      on we.id = tse.prescribed_workout_exercise_id and we.professional_id = tse.professional_id
    join public.workouts w on w.id = we.workout_id and w.professional_id = we.professional_id
    join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
    where tp.protocol_id = p_protocol_id and tse.professional_id = owner_id
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'executed_exercises',
      'message', 'O protocolo possui exercícios vinculados a sessões.'
    ));
  end if;

  if exists (
    select 1
    from public.training_session_sets tss
    join public.prescribed_sets ps on ps.id = tss.prescribed_set_id and ps.professional_id = tss.professional_id
    join public.workout_exercises we on we.id = ps.workout_exercise_id and we.professional_id = ps.professional_id
    join public.workouts w on w.id = we.workout_id and w.professional_id = we.professional_id
    join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
    where tp.protocol_id = p_protocol_id and tss.professional_id = owner_id
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'executed_sets',
      'message', 'O protocolo possui séries vinculadas a sessões.'
    ));
  end if;

  if exists (
    select 1
    from public.workouts w
    join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
    where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
      and w.published_at is not null
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'published_workouts',
      'message', 'O protocolo possui treino publicado.'
    ));
  end if;

  if exists (
    select 1
    from public.workouts w
    join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
    where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
      and w.status <> 'draft'
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'protected_workouts',
      'message', 'O protocolo possui treino histórico ou protegido.'
    ));
  end if;

  if exists (
    select 1
    from public.training_session_prescription_promotions promotion
    where promotion.professional_id = owner_id
      and (
        promotion.source_workout_id in (
          select w.id
          from public.workouts w
          join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
          where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
        )
        or promotion.promoted_workout_id in (
          select w.id
          from public.workouts w
          join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
          where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
        )
      )
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'prescription_promotions',
      'message', 'O protocolo participa de uma promoção de prescrição.'
    ));
  end if;

  if exists (
    select 1
    from public.workouts w
    join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
    where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
      and w.supersedes_workout_id is not null
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'workout_version_history',
      'message', 'O protocolo possui versões encadeadas de treino.'
    ));
  end if;

  if exists (
    select 1
    from public.workouts external_workout
    join public.workouts target_workout on target_workout.id = external_workout.supersedes_workout_id
    join public.training_periods target_period
      on target_period.id = target_workout.period_id and target_period.professional_id = target_workout.professional_id
    where target_period.protocol_id = p_protocol_id
      and target_workout.professional_id = owner_id
      and not exists (
        select 1
        from public.training_periods external_period
        where external_period.id = external_workout.period_id
          and external_period.professional_id = owner_id
          and external_period.protocol_id = p_protocol_id
      )
  ) then
    reasons := reasons || jsonb_build_array(jsonb_build_object(
      'code', 'external_workout_version',
      'message', 'Outro treino depende da linhagem deste protocolo.'
    ));
  end if;

  return jsonb_build_object('allowed', jsonb_array_length(reasons) = 0, 'reasons', reasons);
end;
$$;

create or replace function public.delete_training_protocol_permanently(p_protocol_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  eligibility jsonb;
  deleted_count integer;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform tp.id
  from public.training_protocols tp
  where tp.id = p_protocol_id and tp.professional_id = owner_id
  for update;

  if not found then
    raise exception 'Training protocol not found' using errcode = 'P0002';
  end if;

  perform tp.id
  from public.training_periods tp
  where tp.protocol_id = p_protocol_id and tp.professional_id = owner_id
  order by tp.id
  for update;

  perform w.id
  from public.workouts w
  join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
  where tp.protocol_id = p_protocol_id and w.professional_id = owner_id
  order by w.id
  for update of w;

  perform we.id
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id and w.professional_id = we.professional_id
  join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
  where tp.protocol_id = p_protocol_id and we.professional_id = owner_id
  order by we.id
  for update of we;

  perform ps.id
  from public.prescribed_sets ps
  join public.workout_exercises we on we.id = ps.workout_exercise_id and we.professional_id = ps.professional_id
  join public.workouts w on w.id = we.workout_id and w.professional_id = we.professional_id
  join public.training_periods tp on tp.id = w.period_id and tp.professional_id = w.professional_id
  where tp.protocol_id = p_protocol_id and ps.professional_id = owner_id
  order by ps.id
  for update of ps;

  eligibility := public.get_training_protocol_deletion_eligibility(p_protocol_id);
  if not coalesce((eligibility ->> 'allowed')::boolean, false) then
    raise exception 'Training protocol cannot be deleted permanently'
      using errcode = 'P0001', detail = eligibility::text;
  end if;

  delete from public.training_protocols tp
  where tp.id = p_protocol_id and tp.professional_id = owner_id;
  get diagnostics deleted_count = row_count;

  if deleted_count <> 1 then
    raise exception 'Training protocol was not deleted' using errcode = 'P0001';
  end if;

  return p_protocol_id;
end;
$$;

revoke all on function public.get_training_protocol_deletion_eligibility(uuid) from public;
revoke all on function public.get_training_protocol_deletion_eligibility(uuid) from anon;
grant execute on function public.get_training_protocol_deletion_eligibility(uuid) to authenticated;

revoke all on function public.delete_training_protocol_permanently(uuid) from public;
revoke all on function public.delete_training_protocol_permanently(uuid) from anon;
grant execute on function public.delete_training_protocol_permanently(uuid) to authenticated;
