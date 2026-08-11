export type AdvancedMethod =
  | "Convencional"
  | "Drop-set"
  | "Rest-pause"
  | "Cluster set"
  | "Pirâmide"
  | "Myo-reps"
  | "Bi-set";

export type ProtocolStatus = "Ativo" | "Programado" | "Rascunho" | "Concluído" | "Arquivado";

export type SeriesConfiguration = {
  id?: string;
  method: AdvancedMethod;
  reps: string;
  load: string;
  blocks?: number[];
  executionStatus?: "pending" | "completed" | "assumed_completed" | "partial" | "skipped";
  actualRir?: number | null;
  actualRpe?: number | null;
  notes?: string | null;
  isRemoved?: boolean;
};

export type PrescribedExercise = {
  id: string;
  name: string;
  prescription: string;
  load: string;
  exerciseSource?: "system" | "custom";
  systemExerciseId?: number;
  customExerciseId?: number;
  sets?: number;
  reps?: string;
  rest?: string;
  method?: AdvancedMethod;
  methodRounds?: number;
  methodValue?: string;
  seriesReps?: number[];
  methodSeries?: number[];
  seriesConfigurations?: SeriesConfiguration[];
};

export type MuscleVolume = { muscle: string; sets: number };

export type Workout = {
  id: string;
  periodId: string;
  lineageId: string;
  version: number;
  isCurrent: boolean;
  publishedAt?: string | null;
  name: string;
  focus: string;
  duration: number;
  exercises: PrescribedExercise[];
  volume: MuscleVolume[];
  targetExecutions?: number;
  completedExecutions?: number;
};

export type TrainingPeriod = {
  id: string;
  name: string;
  sequence: number;
  start: string;
  end: string;
  status: "Ativo" | "Programado" | "Rascunho" | "Concluído";
  workouts: Workout[];
};

export type Protocol = {
  id: string;
  displayOrder: number;
  studentId: string;
  student: string;
  name?: string;
  objective: string;
  frequency: number;
  status: ProtocolStatus;
  start: string;
  end: string;
  periods: TrainingPeriod[];
  activePeriodId: string;
  workouts: Workout[];
};

export type TrainingStudent = {
  id: string;
  fullName: string;
  goal: string;
  status: "active" | "paused" | "inactive" | "archived";
};

export type ExerciseCatalogReference = {
  id: number;
  source: "system" | "custom";
  name: string;
  aliases: string;
  muscles: { muscle: string; factor: number; role: "Principal" | "Secundário" }[];
};
