-- Promote only selected execution miniblocks into the newly-versioned prescription.
-- The source session and its immutable workout version are never updated.

create or replace function public.apply_promoted_session_blocks()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  selected jsonb;
  source_set record;
  source_exercise record;
  target_exercise_id uuid;
  prescribed_blocks jsonb;
  prescribed_loads jsonb;
begin
  for selected in select value from jsonb_array_elements(new.selected_changes) loop
    if not coalesce((selected -> 'changes' ->> 'blocks')::boolean, false) then continue; end if;
    if selected ->> 'session_set_id' is null then continue; end if;

    select ss.*, se.prescribed_workout_exercise_id
      into source_set
      from public.training_session_sets ss
      join public.training_session_exercises se on se.id = ss.session_exercise_id
     where ss.id = (selected ->> 'session_set_id')::uuid
       and se.session_id = new.session_id;
    if not found then raise exception 'Selected session block was not found' using errcode = 'P0002'; end if;

    select ps.set_number, we.position
      into source_exercise
      from public.prescribed_sets ps
      join public.workout_exercises we on we.id = ps.workout_exercise_id
     where ps.id = source_set.prescribed_set_id;
    if not found then continue; end if;

    select we.id into target_exercise_id
      from public.workout_exercises we
     where we.workout_id = new.promoted_workout_id and we.position = source_exercise.position;
    if target_exercise_id is null then raise exception 'Promoted workout exercise was not found' using errcode = 'P0002'; end if;

    if source_set.actual_blocks is null or jsonb_array_length(source_set.actual_blocks) = 0 then
      update public.prescribed_sets
         set notes = null
       where workout_exercise_id = target_exercise_id and set_number = source_exercise.set_number;
    else
      select jsonb_agg(value -> 'reps' order by ordinality), jsonb_agg(value -> 'load' order by ordinality)
        into prescribed_blocks, prescribed_loads
        from jsonb_array_elements(source_set.actual_blocks) with ordinality;
      update public.prescribed_sets
         set notes = jsonb_build_object(
           'personalflow_advanced_blocks', prescribed_blocks,
           'personalflow_advanced_block_loads', prescribed_loads
         )::text
       where workout_exercise_id = target_exercise_id and set_number = source_exercise.set_number;
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists training_session_promotions_apply_blocks on public.training_session_prescription_promotions;
create trigger training_session_promotions_apply_blocks
after insert on public.training_session_prescription_promotions
for each row execute function public.apply_promoted_session_blocks();

revoke all on function public.apply_promoted_session_blocks() from public;
