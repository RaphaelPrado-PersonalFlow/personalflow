import { createClient } from "@/lib/supabase/client";
import { exerciseLibrary } from "@/lib/exercise-library";
import type {
  AdvancedMethod,
  ExerciseCatalogReference,
  PrescribedExercise,
  Protocol,
  ProtocolStatus,
  SeriesConfiguration,
  TrainingPeriod,
  TrainingStudent,
  Workout,
} from "@/types/training";

type SetRow = {
  id: string; set_number: number; method: string; reps_min: number | null; reps_max: number | null;
  target_load: number | null; load_unit: string; rest_after_seconds: number | null; notes: string | null;
};
type ExerciseRow = {
  id: string; exercise_source: "system" | "custom"; system_exercise_id: number | null;
  custom_exercise_id: number | null; exercise_name_snapshot: string; position: number;
  rest_between_sets_seconds: number | null; prescribed_sets: SetRow[];
};
type WorkoutRow = {
  id: string; period_id: string; lineage_id: string; version: number; is_current: boolean;
  published_at: string | null; name: string; focus: string; sequence: number;
  estimated_duration_minutes: number | null; target_executions: number | null;
  workout_exercises: ExerciseRow[];
};
type PeriodRow = {
  id: string; name: string; sequence: number; start_date: string | null; end_date: string | null;
  status: string; workouts: WorkoutRow[];
};
type ProtocolRow = {
  id: string; student_id: string; display_order: number; name: string; objective: string; status: string;
  start_date: string | null; end_date: string | null; planned_weekly_frequency: number; archived_at: string | null;
  students: { full_name: string } | { full_name: string }[] | null; training_periods: PeriodRow[];
};

const methodToDb: Record<AdvancedMethod, string> = {
  Convencional: "conventional", "Drop-set": "drop_set", "Rest-pause": "rest_pause",
  "Cluster set": "cluster", Pirâmide: "pyramid", "Myo-reps": "myo_reps", "Bi-set": "bi_set",
};
const methodFromDb = Object.fromEntries(Object.entries(methodToDb).map(([key, value]) => [value, key])) as Record<string, AdvancedMethod>;
const statusToDb: Record<ProtocolStatus, string> = {
  Ativo: "active", Programado: "scheduled", Rascunho: "draft", Concluído: "completed", Arquivado: "archived",
};
const statusFromDb: Record<string, ProtocolStatus> = {
  active: "Ativo", scheduled: "Programado", draft: "Rascunho", completed: "Concluído", archived: "Arquivado",
  cancelled: "Arquivado",
};

function dateToDisplay(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function displayToDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function protocolStatusFromDates(start: string, end: string): ProtocolStatus {
  const parse = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? Number(`${match[3]}${match[2]}${match[1]}`) : null;
  };
  const startKey = parse(start);
  const endKey = parse(end);
  if (startKey == null || endKey == null || endKey < startKey) return "Rascunho";
  const today = new Date();
  const todayKey = today.getFullYear() * 10_000 + (today.getMonth() + 1) * 100 + today.getDate();
  if (startKey > todayKey) return "Programado";
  if (endKey < todayKey) return "Concluído";
  return "Ativo";
}

function repetitions(set: SetRow) {
  if (set.reps_min == null && set.reps_max == null) return "";
  if (set.reps_max == null || set.reps_min === set.reps_max) return String(set.reps_min ?? set.reps_max);
  return `${set.reps_min}–${set.reps_max}`;
}

function loadLabel(value: number | null, unit: string) {
  if (value == null) return "0 kg";
  return `${Number(value).toLocaleString("pt-BR")} ${unit === "kg" ? "kg" : unit}`;
}

function storedBlocks(notes: string | null): { reps: number[]; loads: string[] } | undefined {
  if (!notes) return undefined;
  try {
    const value = JSON.parse(notes) as { personalflow_advanced_blocks?: unknown; personalflow_advanced_block_loads?: unknown };
    const blocks = value.personalflow_advanced_blocks;
    if (!Array.isArray(blocks) || !blocks.every((item) => typeof item === "number")) return undefined;
    const loads = Array.isArray(value.personalflow_advanced_block_loads)
      ? value.personalflow_advanced_block_loads.map((item) => loadLabel(Number(item), "kg"))
      : [];
    return { reps: blocks, loads };
  } catch { return undefined; }
}

function mapExercise(row: ExerciseRow): PrescribedExercise {
  const sets = [...(row.prescribed_sets ?? [])].sort((a, b) => a.set_number - b.set_number);
  const configurations: SeriesConfiguration[] = sets.map((set) => ({
    id: set.id, method: methodFromDb[set.method] ?? "Convencional", reps: repetitions(set),
    load: loadLabel(set.target_load, set.load_unit), blocks: storedBlocks(set.notes)?.reps, blockLoads: storedBlocks(set.notes)?.loads,
  }));
  const first = configurations[0];
  return {
    id: row.id, name: row.exercise_name_snapshot, exerciseSource: row.exercise_source,
    systemExerciseId: row.system_exercise_id ?? undefined, customExerciseId: row.custom_exercise_id ?? undefined,
    sets: configurations.length, reps: first?.reps ?? "", load: first?.load ?? "0 kg",
    rest: secondsToRest(row.rest_between_sets_seconds), seriesConfigurations: configurations,
    prescription: configurations.length ? `${configurations.length} × ${first?.reps ?? ""}` : "0 × 0",
  };
}

function mapWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id, periodId: row.period_id, lineageId: row.lineage_id, version: row.version,
    isCurrent: row.is_current, publishedAt: row.published_at, name: row.name, focus: row.focus,
    duration: row.estimated_duration_minutes ?? 0, targetExecutions: row.target_executions ?? undefined,
    exercises: [...(row.workout_exercises ?? [])].sort((a, b) => a.position - b.position).map(mapExercise), volume: [],
  };
}

function mapPeriod(row: PeriodRow): TrainingPeriod {
  return {
    id: row.id, name: row.name, sequence: row.sequence, start: dateToDisplay(row.start_date), end: dateToDisplay(row.end_date),
    status: statusFromDb[row.status] === "Ativo" ? "Ativo" : statusFromDb[row.status] === "Programado" ? "Programado" : statusFromDb[row.status] === "Concluído" ? "Concluído" : "Rascunho",
    workouts: [...(row.workouts ?? [])].filter((item) => item.is_current).sort((a, b) => a.sequence - b.sequence).map(mapWorkout),
  };
}

function mapProtocol(row: ProtocolRow): Protocol {
  const periods = [...(row.training_periods ?? [])].sort((a, b) => a.sequence - b.sequence).map(mapPeriod);
  const active = periods.find((period) => period.status === "Ativo") ?? periods[0];
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  return {
    id: row.id, displayOrder: row.display_order, studentId: row.student_id, student: student?.full_name ?? "Aluno",
    name: row.name, objective: row.objective, frequency: row.planned_weekly_frequency,
    status: row.status === "archived" || row.archived_at ? "Arquivado" : protocolStatusFromDates(dateToDisplay(row.start_date), dateToDisplay(row.end_date)),
    archivedAt: row.archived_at, start: dateToDisplay(row.start_date), end: dateToDisplay(row.end_date),
    periods, activePeriodId: active?.id ?? "", workouts: active?.workouts ?? [],
  };
}

const protocolSelect = `
  id, student_id, display_order, name, objective, status, start_date, end_date, planned_weekly_frequency, archived_at,
  students!inner(full_name),
  training_periods(id, name, sequence, start_date, end_date, status,
    workouts(id, period_id, lineage_id, version, is_current, published_at, name, focus, sequence,
      estimated_duration_minutes, target_executions,
      workout_exercises(id, exercise_source, system_exercise_id, custom_exercise_id,
        exercise_name_snapshot, position, rest_between_sets_seconds,
        prescribed_sets(id, set_number, method, reps_min, reps_max, target_load, load_unit, rest_after_seconds, notes))))`;

export async function listTrainingStudents(): Promise<TrainingStudent[]> {
  const { data, error } = await createClient().from("students").select("id, full_name, goal, status").order("full_name");
  if (error) throw error;
  return (data ?? []).map((row: { id: string; full_name: string; goal: string | null; status: TrainingStudent["status"] }) => ({ id: row.id, fullName: row.full_name, goal: row.goal ?? "", status: row.status }));
}

export type TrainingProtocolList = "operational" | "archived" | "all";

export async function listTrainingProtocols(list: TrainingProtocolList = "operational"): Promise<Protocol[]> {
  let query = createClient().from("training_protocols").select(protocolSelect);
  if (list === "operational") query = query.neq("status", "archived").is("archived_at", null);
  if (list === "archived") query = query.or("status.eq.archived,archived_at.not.is.null");
  const { data, error } = await query.order("display_order").order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as ProtocolRow[]).map(mapProtocol);
}

async function authenticatedProfessionalId() {
  const { data, error } = await createClient().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("É necessário estar autenticado para alterar um protocolo.");
  return data.user.id;
}

async function updateProtocolArchiveState(id: string, values: { status: string; archived_at: string | null }) {
  const client = createClient();
  const professionalId = await authenticatedProfessionalId();
  const { data, error } = await client.from("training_protocols").update(values)
    .eq("id", id).eq("professional_id", professionalId).select(protocolSelect).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível alterar o protocolo. Verifique se ele ainda existe e pertence ao seu usuário.");
  return mapProtocol(data as unknown as ProtocolRow);
}

export async function archiveTrainingProtocol(id: string) {
  return updateProtocolArchiveState(id, { status: "archived", archived_at: new Date().toISOString() });
}

export async function restoreTrainingProtocol(id: string) {
  const client = createClient();
  const professionalId = await authenticatedProfessionalId();
  const { data, error } = await client.from("training_protocols").select("start_date, end_date")
    .eq("id", id).eq("professional_id", professionalId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível restaurar o protocolo. Verifique se ele ainda existe e pertence ao seu usuário.");
  const status = statusToDb[protocolStatusFromDates(dateToDisplay(data.start_date), dateToDisplay(data.end_date))];
  return updateProtocolArchiveState(id, { status, archived_at: null });
}

export type AppointmentTrainingContext =
  | { kind: "ready"; studentId: string; protocolId: string; periodId: string; workoutId: string; sessionId: null }
  | { kind: "resume"; studentId: string; protocolId: string; periodId: string; workoutId: string; sessionId: string }
  | { kind: "selection_required"; studentId: string; protocolId: string; periodId: string; workoutIds: string[]; reason: string }
  | { kind: "unavailable"; reason: string };

type DatedRow = { id: string; start_date: string | null; end_date: string | null; status: string };

function zonedDateParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { date, weekday };
}

function appliesOn(row: DatedRow, date: string) {
  return (!row.start_date || row.start_date <= date) && (!row.end_date || row.end_date >= date);
}

/** Resolves an appointment without guessing across students, protocols, periods, or workouts. */
export async function resolveAppointmentTrainingContext(input: {
  appointmentId: string; studentId: string; startsAt: string;
}): Promise<AppointmentTrainingContext> {
  const client = createClient();
  const { data: sessions, error: sessionError } = await client.from("training_sessions")
    .select("id, student_id, protocol_id, period_id, workout_id")
    .eq("appointment_id", input.appointmentId).eq("status", "in_progress").limit(2);
  if (sessionError) throw sessionError;
  if ((sessions ?? []).length === 1) {
    const session = sessions![0];
    if (session.student_id !== input.studentId) return { kind: "unavailable", reason: "A sessão vinculada não corresponde ao aluno do atendimento." };
    return { kind: "resume", studentId: session.student_id, protocolId: session.protocol_id, periodId: session.period_id, workoutId: session.workout_id, sessionId: session.id };
  }
  if ((sessions ?? []).length > 1) return { kind: "unavailable", reason: "Há mais de uma sessão em andamento vinculada a este atendimento." };

  const { date, weekday } = zonedDateParts(input.startsAt);
  const { data: protocolRows, error: protocolError } = await client.from("training_protocols")
    .select("id, start_date, end_date, status").eq("student_id", input.studentId).in("status", ["active", "scheduled"]);
  if (protocolError) throw protocolError;
  const protocols = ((protocolRows ?? []) as DatedRow[]).filter((row) => appliesOn(row, date));
  if (protocols.length !== 1) return { kind: "unavailable", reason: protocols.length ? "Há mais de um protocolo vigente para este aluno." : "O aluno não possui protocolo vigente na data do atendimento." };

  const { data: periodRows, error: periodError } = await client.from("training_periods")
    .select("id, start_date, end_date, status").eq("protocol_id", protocols[0].id).in("status", ["active", "scheduled"]);
  if (periodError) throw periodError;
  const periods = ((periodRows ?? []) as DatedRow[]).filter((row) => appliesOn(row, date));
  if (periods.length !== 1) return { kind: "unavailable", reason: periods.length ? "Há mais de um período vigente na data do atendimento." : "Não há período vigente na data do atendimento." };

  const { data: workoutRows, error: workoutError } = await client.from("workouts")
    .select("id, period_workout_slots(weekday, sequence_in_week)")
    .eq("period_id", periods[0].id).eq("is_current", true).order("sequence");
  if (workoutError) throw workoutError;
  const workouts = (workoutRows ?? []) as unknown as Array<{ id: string; period_workout_slots: Array<{ weekday: number | null; sequence_in_week: number }> }>;
  if (!workouts.length) return { kind: "unavailable", reason: "O período vigente não possui treino atual." };
  const weekdayMatches = workouts.filter((workout) => workout.period_workout_slots.some((slot) => slot.weekday === weekday));
  const selected = weekdayMatches.length === 1 ? weekdayMatches[0] : workouts.length === 1 ? workouts[0] : null;
  if (!selected) return {
    kind: "selection_required", studentId: input.studentId, protocolId: protocols[0].id, periodId: periods[0].id,
    workoutIds: (weekdayMatches.length > 1 ? weekdayMatches : workouts).map((workout) => workout.id),
    reason: weekdayMatches.length > 1 ? "Mais de um treino está associado a este dia da semana." : "O período possui vários treinos, mas nenhum slot identifica com segurança o treino deste atendimento.",
  };
  return { kind: "ready", studentId: input.studentId, protocolId: protocols[0].id, periodId: periods[0].id, workoutId: selected.id, sessionId: null };
}

export async function getTrainingProtocol(id: string) {
  const { data, error } = await createClient().from("training_protocols").select(protocolSelect).eq("id", id).single();
  if (error) throw error;
  return mapProtocol(data as unknown as ProtocolRow);
}

async function deleteOwnedTrainingRecord(table: "training_protocols" | "training_periods", id: string, label: string) {
  const { data, error } = await createClient().from(table).delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") {
      throw new Error(`N\u00e3o foi poss\u00edvel excluir ${label} porque ele possui um v\u00ednculo hist\u00f3rico. Arquive-o para preservar esse hist\u00f3rico.`);
    }
    throw error;
  }
  if (data?.length !== 1) {
    throw new Error(`N\u00e3o foi poss\u00edvel excluir ${label}. Verifique se ele ainda existe e pertence ao seu usu\u00e1rio.`);
  }
}

export async function deleteTrainingProtocol(id: string) {
  return deleteOwnedTrainingRecord("training_protocols", id, "o protocolo");
}

export async function deleteTrainingPeriod(id: string) {
  return deleteOwnedTrainingRecord("training_periods", id, "o per\u00edodo");
}

export async function reorderTrainingProtocols(orderedIds: string[]) {
  const { error } = await createClient().rpc("reorder_training_protocols", { ordered_ids: orderedIds });
  if (error) throw error;
}

export async function createTrainingProtocol(input: {
  studentId: string; name: string; objective: string; frequency: number; start: string; end: string;
}) {
  const protocolId = crypto.randomUUID();
  const periodId = crypto.randomUUID();
  const protocol: Protocol = {
    id: protocolId, displayOrder: 1, studentId: input.studentId, student: "", name: input.name,
    objective: input.objective, frequency: input.frequency, status: "Rascunho", archivedAt: null,
    start: input.start, end: input.end, activePeriodId: periodId, workouts: [],
    periods: [{ id: periodId, name: input.name || "Período 1", sequence: 1, start: input.start, end: input.end, status: "Rascunho", workouts: [] }],
  };
  return saveProtocol(protocol, systemExerciseReferences());
}

export async function saveProtocol(protocol: Protocol, catalog: ExerciseCatalogReference[]) {
  const client = createClient();
  const payload = prescriptionPayload(protocol, catalog);
  const { error } = await client.rpc("save_training_prescription", { payload });
  if (error) throw error;
  return getTrainingProtocol(protocol.id);
}

/** Updates only the protocol header; prescribed periods and workouts are deliberately untouched. */
export async function updateTrainingProtocolDetails(input: Pick<Protocol, "id" | "name" | "objective" | "frequency" | "start" | "end">) {
  const client = createClient();
  const professionalId = await authenticatedProfessionalId();
  const { data: current, error: currentError } = await client.from("training_protocols").select("status, archived_at")
    .eq("id", input.id).eq("professional_id", professionalId).maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("Não foi possível alterar o protocolo. Verifique se ele ainda existe e pertence ao seu usuário.");
  const archived = current.status === "archived" || current.archived_at != null;
  const { data, error } = await client.from("training_protocols").update({
    name: input.name ?? input.objective,
    objective: input.objective,
    planned_weekly_frequency: input.frequency,
    start_date: displayToDate(input.start),
    end_date: displayToDate(input.end),
    status: archived ? "archived" : statusToDb[protocolStatusFromDates(input.start, input.end)],
    archived_at: archived ? current.archived_at ?? new Date().toISOString() : null,
  }).eq("id", input.id).eq("professional_id", professionalId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível alterar o protocolo. Verifique se ele ainda existe e pertence ao seu usuário.");
  return getTrainingProtocol(input.id);
}

function prescriptionPayload(protocol: Protocol, catalog: ExerciseCatalogReference[]) {
  const automaticStatus = protocol.status === "Arquivado" ? "Arquivado" : protocolStatusFromDates(protocol.start, protocol.end);
  return {
    id: protocol.id, student_id: protocol.studentId, name: protocol.name ?? protocol.objective,
    objective: protocol.objective, status: statusToDb[automaticStatus], start_date: displayToDate(protocol.start),
    end_date: displayToDate(protocol.end), planned_weekly_frequency: protocol.frequency,
    periods: protocol.periods.map((period) => ({
      id: period.id, name: period.name, sequence: period.sequence, start_date: displayToDate(period.start),
      end_date: displayToDate(period.end), planned_weekly_frequency: protocol.frequency,
      status: statusToDb[period.status as ProtocolStatus] ?? "draft",
      workouts: period.workouts.map((workout, workoutIndex) => ({
        id: workout.id, lineage_id: workout.lineageId, version: workout.version,
        is_current: workout.isCurrent, published_at: workout.publishedAt ?? null,
        name: workout.name, focus: workout.focus, sequence: workoutIndex + 1,
        estimated_duration_minutes: workout.duration || null, target_executions: workout.targetExecutions ?? null,
        status: workout.publishedAt ? "active" : "draft",
        slot: { sequence_in_week: workoutIndex + 1, occurrences_per_week: 1 },
        exercises: workout.exercises.map((exercise, exerciseIndex) => exercisePayload(exercise, exerciseIndex, catalog)),
      })),
    })),
  };
}

function exercisePayload(exercise: PrescribedExercise, index: number, catalog: ExerciseCatalogReference[]) {
  const reference = catalog.find((item) => item.name === exercise.name);
  if (!reference) throw new Error(`Exercício não encontrado no catálogo: ${exercise.name}`);
  const configurations = exercise.seriesConfigurations?.length ? exercise.seriesConfigurations : defaultSeries(exercise);
  return {
    id: exercise.id, exercise_source: reference.source,
    system_exercise_id: reference.source === "system" ? reference.id : null,
    custom_exercise_id: reference.source === "custom" ? reference.id : null,
    exercise_name_snapshot: exercise.name, exercise_metadata_snapshot: { muscles: reference.muscles },
    position: index + 1, rest_between_sets_seconds: restToSeconds(exercise.rest),
    sets: configurations.map((set, setIndex) => {
      const [min, max] = parseReps(set.reps);
      return {
        id: set.id ?? crypto.randomUUID(), set_number: setIndex + 1, set_type: "working",
        method: methodToDb[set.method], reps_min: min, reps_max: max,
        target_load: numericValue(set.load), load_unit: "kg", rest_after_seconds: restToSeconds(exercise.rest),
        notes: set.blocks?.length ? JSON.stringify({
          personalflow_advanced_blocks: set.blocks,
          personalflow_advanced_block_loads: set.blocks.map((_, blockIndex) => numericValue(set.blockLoads?.[blockIndex] ?? set.load)),
        }) : null,
      };
    }),
  };
}

function defaultSeries(exercise: PrescribedExercise): SeriesConfiguration[] {
  const count = exercise.sets ?? Number(exercise.prescription.match(/\d+/)?.[0] ?? 0);
  const reps = exercise.reps ?? exercise.prescription.split("×")[1]?.trim() ?? "10";
  return Array.from({ length: count }, () => ({ method: "Convencional", reps, load: exercise.load }));
}

function parseReps(value: string): [number, number | null] {
  const values = value.match(/\d+(?:[.,]\d+)?/g)?.map((item) => Number(item.replace(",", "."))) ?? [0];
  return [values[0], values[1] ?? values[0]];
}

function numericValue(value: string) {
  return Number(value.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
}

function restToSeconds(value = "60''") {
  const minutes = value.match(/^(\d+)'(?:(\d+)''?)?$/);
  return minutes ? Number(minutes[1]) * 60 + Number(minutes[2] ?? 0) : Number(value.match(/\d+/)?.[0] ?? 60);
}

function secondsToRest(value: number | null) {
  const seconds = value ?? 60;
  if (seconds < 60) return `${seconds}''`;
  const remainder = seconds % 60;
  return `${Math.floor(seconds / 60)}'${remainder ? `${String(remainder).padStart(2, "0")}''` : "00''"}`;
}

export function systemExerciseReferences(): ExerciseCatalogReference[] {
  return exerciseLibrary.map((exercise) => ({ id: exercise.id, source: "system", name: exercise.name, aliases: exercise.aliases, muscles: exercise.muscles }));
}
