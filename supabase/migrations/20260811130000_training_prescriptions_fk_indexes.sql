create index training_protocols_student_owner_idx
  on public.training_protocols(student_id, professional_id);
create index training_periods_protocol_owner_idx
  on public.training_periods(protocol_id, professional_id);
create index training_periods_owner_idx
  on public.training_periods(professional_id);
create index workouts_period_owner_idx
  on public.workouts(period_id, professional_id);
create index workouts_owner_idx
  on public.workouts(professional_id);
create index workouts_supersedes_idx
  on public.workouts(supersedes_workout_id)
  where supersedes_workout_id is not null;
create index period_workout_slots_period_owner_idx
  on public.period_workout_slots(period_id, professional_id);
create index period_workout_slots_workout_period_owner_idx
  on public.period_workout_slots(workout_id, period_id, professional_id);
create index period_workout_slots_owner_idx
  on public.period_workout_slots(professional_id);
create index workout_exercises_workout_owner_idx
  on public.workout_exercises(workout_id, professional_id);
create index workout_exercises_custom_owner_idx
  on public.workout_exercises(custom_exercise_id, professional_id)
  where custom_exercise_id is not null;
create index workout_exercises_owner_idx
  on public.workout_exercises(professional_id);
create index prescribed_sets_exercise_owner_idx
  on public.prescribed_sets(workout_exercise_id, professional_id);
create index prescribed_sets_owner_idx
  on public.prescribed_sets(professional_id);
