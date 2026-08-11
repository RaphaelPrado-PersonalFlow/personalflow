export type TrainingSessionStatus = "in_progress" | "completed" | "partial" | "cancelled" | "abandoned";
export type TrainingSessionItemStatus = "pending" | "completed" | "assumed_completed" | "partial" | "skipped";
export type TrainingSessionCompletionMode = "assume_unmodified_as_planned" | "partial";

export type TrainingSessionSet = {
  id: string;
  prescribedSetId: string | null;
  setNumber: number;
  status: TrainingSessionItemStatus;
  isAdded: boolean;
  isRemoved: boolean;
  method: string;
  actualMethod: string | null;
  plannedRepsMin: number | null;
  plannedRepsMax: number | null;
  plannedLoad: number | null;
  plannedLoadUnit: string | null;
  plannedRir: number | null;
  plannedRpe: number | null;
  actualReps: number | null;
  actualLoad: number | null;
  actualLoadUnit: string | null;
  actualRir: number | null;
  actualRpe: number | null;
  notes: string | null;
  changed: boolean;
};

export type TrainingSessionExercise = {
  id: string;
  prescribedExerciseId: string | null;
  position: number;
  status: TrainingSessionItemStatus;
  executionSource: "prescribed" | "substituted" | "added";
  name: string;
  exerciseSource: "system" | "custom";
  systemExerciseId?: number;
  customExerciseId?: number;
  metadata: Record<string, unknown>;
  muscleParticipation: Array<{ muscle: string; factor: number; role: string }>;
  substitutionReason: string | null;
  notes: string | null;
  changed: boolean;
  sets: TrainingSessionSet[];
};

export type TrainingSession = {
  id: string;
  professionalId: string;
  responsibleProfessionalId: string;
  studentId: string;
  protocolId: string;
  periodId: string;
  workoutId: string;
  appointmentId: string | null;
  status: TrainingSessionStatus;
  completionMode: TrainingSessionCompletionMode | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  notes: string | null;
  snapshot: {
    protocol: { id: string; name: string; objective: string };
    period: { id: string; name: string; sequence: number };
    workout: { id: string; lineage_id: string; version: number; name: string; focus: string };
  };
  exercises: TrainingSessionExercise[];
};
