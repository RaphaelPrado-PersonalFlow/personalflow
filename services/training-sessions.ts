import { createClient } from "@/lib/supabase/client";
import type {
  TrainingSession,
  TrainingSessionCompletionMode,
  TrainingSessionExercise,
  TrainingSessionItemStatus,
  TrainingSessionSet,
} from "@/types/training-session";

type JsonRecord = Record<string, unknown>;

const numberOrNull = (value: unknown) => value == null ? null : Number(value);

function mapSet(row: JsonRecord): TrainingSessionSet {
  return {
    id: String(row.id), prescribedSetId: row.prescribed_set_id ? String(row.prescribed_set_id) : null,
    setNumber: Number(row.set_number), status: row.status as TrainingSessionItemStatus,
    isAdded: Boolean(row.is_added), isRemoved: Boolean(row.is_removed), method: String(row.planned_method ?? "conventional"),
    plannedRepsMin: numberOrNull(row.planned_reps_min), plannedRepsMax: numberOrNull(row.planned_reps_max),
    plannedLoad: numberOrNull(row.planned_load), plannedLoadUnit: row.planned_load_unit ? String(row.planned_load_unit) : null,
    plannedRir: numberOrNull(row.planned_rir), plannedRpe: numberOrNull(row.planned_rpe),
    actualReps: numberOrNull(row.actual_reps), actualLoad: numberOrNull(row.actual_load),
    actualLoadUnit: row.actual_load_unit ? String(row.actual_load_unit) : null,
    actualRir: numberOrNull(row.actual_rir), actualRpe: numberOrNull(row.actual_rpe),
    notes: row.notes ? String(row.notes) : null, changed: Boolean(row.changed),
  };
}

function mapExercise(row: JsonRecord): TrainingSessionExercise {
  const baseline = (row.baseline_snapshot ?? {}) as JsonRecord;
  const executedMetadata = (row.executed_metadata_snapshot ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id), prescribedExerciseId: row.prescribed_workout_exercise_id ? String(row.prescribed_workout_exercise_id) : null,
    position: Number(row.position), status: row.status as TrainingSessionItemStatus,
    executionSource: row.execution_source as TrainingSessionExercise["executionSource"],
    name: String(row.executed_name_snapshot ?? baseline.exercise_name_snapshot ?? "Exercício"),
    exerciseSource: String(row.executed_exercise_source ?? baseline.exercise_source) as "system" | "custom",
    systemExerciseId: numberOrNull(row.executed_system_exercise_id ?? baseline.system_exercise_id) ?? undefined,
    customExerciseId: numberOrNull(row.executed_custom_exercise_id ?? baseline.custom_exercise_id) ?? undefined,
    metadata: Object.keys(executedMetadata).length ? executedMetadata : (baseline.exercise_metadata_snapshot as Record<string, unknown> ?? {}),
    muscleParticipation: (row.muscle_participation_snapshot ?? []) as TrainingSessionExercise["muscleParticipation"],
    substitutionReason: row.substitution_reason ? String(row.substitution_reason) : null,
    notes: row.notes ? String(row.notes) : null, changed: Boolean(row.changed),
    sets: ((row.sets ?? []) as JsonRecord[]).map(mapSet),
  };
}

export async function getTrainingSession(id: string): Promise<TrainingSession> {
  const { data, error } = await createClient().rpc("get_training_session", { p_session_id: id });
  if (error) throw error;
  if (!data) throw new Error("Sessão não encontrada.");
  const payload = data as unknown as { session: JsonRecord; exercises: JsonRecord[] };
  const row = payload.session;
  return {
    id: String(row.id), professionalId: String(row.professional_id), responsibleProfessionalId: String(row.responsible_professional_id),
    studentId: String(row.student_id), protocolId: String(row.protocol_id), periodId: String(row.period_id),
    workoutId: String(row.workout_id), appointmentId: row.appointment_id ? String(row.appointment_id) : null,
    status: row.status as TrainingSession["status"], completionMode: row.completion_mode as TrainingSessionCompletionMode | null,
    startedAt: String(row.started_at), completedAt: row.completed_at ? String(row.completed_at) : null,
    durationSeconds: numberOrNull(row.duration_seconds), notes: row.notes ? String(row.notes) : null,
    snapshot: row.prescription_snapshot as TrainingSession["snapshot"], exercises: payload.exercises.map(mapExercise),
  };
}

export async function startTrainingSession(input: {
  workoutId: string; idempotencyKey: string; appointmentId?: string | null; notes?: string | null;
}) {
  const { data, error } = await createClient().rpc("start_training_session", {
    p_workout_id: input.workoutId, p_idempotency_key: input.idempotencyKey,
    p_appointment_id: input.appointmentId ?? null, p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return getTrainingSession(data as string);
}

async function rpc(name: string, parameters: Record<string, unknown>) {
  const { error } = await createClient().rpc(name, parameters);
  if (error) throw error;
}

export function updateSessionExercise(id: string, changes: Record<string, unknown>) {
  return rpc("update_training_session_exercise", { p_exercise_id: id, p_changes: changes });
}
export function updateSessionSet(id: string, changes: Record<string, unknown>) {
  return rpc("update_training_session_set", { p_set_id: id, p_changes: changes });
}
export async function addSessionSet(exerciseId: string, idempotencyKey: string, values: Record<string, unknown>) {
  const { data, error } = await createClient().rpc("add_training_session_set", {
    p_session_exercise_id: exerciseId, p_idempotency_key: idempotencyKey, p_values: values,
  });
  if (error) throw error;
  return data as string;
}
export function removeSessionSet(id: string) { return rpc("remove_training_session_set", { p_set_id: id }); }
export function updateSessionNotes(id: string, notes: string) {
  return rpc("update_training_session_details", { p_session_id: id, p_notes: notes });
}
export function completeTrainingSession(id: string, mode: TrainingSessionCompletionMode) {
  return rpc("complete_training_session", { p_session_id: id, p_mode: mode });
}
export function cancelTrainingSession(id: string, abandoned = false) {
  return rpc("cancel_training_session", { p_session_id: id, p_as_abandoned: abandoned });
}
