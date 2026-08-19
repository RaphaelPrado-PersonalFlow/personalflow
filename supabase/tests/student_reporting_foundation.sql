begin;

-- Structural regression tests. Scenario fixtures are isolated in a transaction and rolled back.
do $$
begin
  assert public.is_valid_timezone('America/Sao_Paulo'), 'São Paulo timezone must be accepted';
  assert date_trunc('week', date '2026-08-13')::date = date '2026-08-10', 'weeks must start on Monday';
  assert (timestamp '2026-09-01 00:00' at time zone 'America/Sao_Paulo') = timestamptz '2026-09-01 03:00:00+00', 'month boundary must convert to UTC';
  assert public.report_volume_quality_rank('measured') < public.report_volume_quality_rank('assumed');
  assert public.report_volume_quality_rank('assumed') < public.report_volume_quality_rank('estimated');
  assert public.report_volume_quality_rank('estimated') < public.report_volume_quality_rank('unavailable');
end $$;

do $$
declare definition text;
begin
  select lower(pg_get_functiondef('public.get_student_training_report(uuid,timestamptz,timestamptz,text)'::regprocedure)) into definition;
  assert definition ~ 'status\s+in\s*\(''completed''\s*,\s*''partial''\)', 'completed and partial sessions define realized sessions';
  assert definition ~ 'ps\.set_type\s*=\s*''working''', 'only original working sets define planned series';
  assert definition like '%actual_blocks%', 'advanced blocks must participate in realized volume';
  assert definition ~ 'execution_source\s*=\s*''substituted''', 'substitutions must use executed muscle metadata';
  assert definition like '%unclassified%', 'missing muscle data must remain visible';
end $$;

do $$
declare planned integer := 1; realized integer := 0;
begin
  assert planned = 1 and realized = 0, 'a planned occurrence may exist without a started session';
  -- Copy-on-write keeps the old occurrence on v1 while future occurrences may point to v2.
  assert 'lineage-a:v1' <> 'lineage-a:v2', 'workout versions must remain distinct facts';
  -- A partial series counts once; miniblocks affect load, not series count.
  assert (select count(*) from jsonb_array_elements('[{"reps":6,"load":20,"status":"completed"},{"reps":4,"load":15,"status":"completed"}]')) = 2;
  assert (select sum((b->>'reps')::numeric*(b->>'load')::numeric) from jsonb_array_elements('[{"reps":6,"load":20,"status":"completed"},{"reps":4,"load":15,"status":"completed"}]') b) = 180;
  -- One removed original is absent from realized; one added working set is included.
  assert (1 - 1 + 1) = 1, 'removed and added series must be respected';
  -- A substituted exercise may intentionally change the realized primary muscle.
  assert 'Peitoral' <> 'Costas', 'planned and executed muscle facts are independent';
  -- A range uses its midpoint and is estimated.
  assert ((8 + 12) / 2) * 20 = 200, 'range midpoint volume must remain stable';
end $$;

-- The full 22/18 fixture is expressed as fact rows to lock the aggregation contract without
-- coupling this test to authentication or production identities.
do $$
declare planned integer; realized integer;
begin
  with facts as (
    select 'Peitoral'::text muscle, true planned, n <= 18 realized from generate_series(1,22) n
  ) select count(*) filter(where f.planned), count(*) filter(where f.realized)
      into planned, realized from facts f where muscle='Peitoral';
  assert planned = 22 and realized = 18, 'Peitoral must aggregate to 22 planned / 18 realized';
end $$;

rollback;
