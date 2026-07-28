"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import SessionPanel from "@/components/training/SessionPanel";
import { prescriptionExerciseCatalog as systemExerciseCatalog } from "@/lib/exercise-library";
import { exerciseRepository } from "@/services/exercise-repository";

type AdvancedMethod = "Convencional" | "Drop-set" | "Rest-pause" | "Cluster set" | "Pirâmide" | "Myo-reps" | "Bi-set";
type SeriesConfiguration = { method: AdvancedMethod; reps: string; load: string; blocks?: number[] };
type Exercise = { id: number; name: string; prescription: string; load: string; sets?: number; reps?: string; rest?: string; method?: AdvancedMethod; methodRounds?: number; methodValue?: string; seriesReps?: number[]; methodSeries?: number[]; seriesConfigurations?: SeriesConfiguration[] };
type SessionExercise = Exercise & { originalExerciseId: number; changed?: boolean };
type MuscleVolume = { muscle: string; sets: number };
type WeeklyVolumeImpact = { muscle: string; before: number; after: number; difference: number };
export type Workout = { id: number; name: string; focus: string; duration: number; exercises: Exercise[]; volume: MuscleVolume[]; targetExecutions?: number; completedExecutions?: number };
export type Protocol = {
  id: number;
  name?: string;
  student: string;
  objective: string;
  frequency: number;
  status: "Ativo" | "Programado" | "Rascunho";
  start: string;
  end: string;
  workouts: Workout[];
};

export const initialProtocols: Protocol[] = [
  { id: 1, student: "João Mendes", objective: "Hipertrofia", frequency: 4, status: "Ativo", start: "01/07/2026", end: "31/08/2026", workouts: [
    { id: 11, name: "Treino A", focus: "Peitoral e tríceps", duration: 55, volume: [{ muscle: "Peitoral", sets: 10 }, { muscle: "Tríceps", sets: 5 }, { muscle: "Deltoide anterior", sets: 3 }], exercises: [
      { id: 111, name: "Supino reto com barra", prescription: "4 × 8–10", load: "60 kg" },
      { id: 112, name: "Supino inclinado com halteres", prescription: "3 × 10–12", load: "24 kg" },
      { id: 113, name: "Crucifixo no cabo", prescription: "3 × 12–15", load: "18 kg" },
      { id: 114, name: "Tríceps na polia", prescription: "3 × 10–12", load: "35 kg" },
    ] },
    { id: 12, name: "Treino B", focus: "Costas e bíceps", duration: 60, volume: [{ muscle: "Costas", sets: 12 }, { muscle: "Bíceps", sets: 5 }, { muscle: "Deltoide posterior", sets: 3 }], exercises: [
      { id: 121, name: "Puxada alta", prescription: "4 × 8–10", load: "55 kg" },
      { id: 122, name: "Remada baixa", prescription: "4 × 10–12", load: "50 kg" },
      { id: 123, name: "Rosca direta", prescription: "3 × 10–12", load: "24 kg" },
    ] },
    { id: 13, name: "Treino C", focus: "Membros inferiores", duration: 65, volume: [{ muscle: "Quadríceps", sets: 8 }, { muscle: "Glúteos", sets: 6 }, { muscle: "Isquiotibiais", sets: 3 }, { muscle: "Panturrilhas", sets: 4 }], exercises: [
      { id: 131, name: "Agachamento livre", prescription: "4 × 8–10", load: "80 kg" },
      { id: 132, name: "Leg press", prescription: "4 × 10–12", load: "180 kg" },
      { id: 133, name: "Mesa flexora", prescription: "3 × 12", load: "45 kg" },
    ] },
  ] },
  { id: 2, student: "Mariana Costa", objective: "Emagrecimento", frequency: 3, status: "Ativo", start: "15/06/2026", end: "15/08/2026", workouts: [
    { id: 21, name: "Treino A", focus: "Corpo inteiro", duration: 50, volume: [{ muscle: "Quadríceps", sets: 3 }, { muscle: "Costas", sets: 3 }, { muscle: "Peitoral", sets: 3 }, { muscle: "Glúteos", sets: 1.5 }, { muscle: "Tríceps", sets: 1.5 }], exercises: [
      { id: 211, name: "Agachamento goblet", prescription: "3 × 12", load: "18 kg" },
      { id: 212, name: "Remada articulada", prescription: "3 × 12", load: "30 kg" },
      { id: 213, name: "Supino na máquina", prescription: "3 × 12", load: "25 kg" },
    ] },
  ] },
  { id: 3, student: "Carlos Lima", objective: "Condicionamento", frequency: 3, status: "Programado", start: "01/08/2026", end: "30/09/2026", workouts: [] },
  { id: 4, student: "Ana Souza", objective: "Força", frequency: 4, status: "Rascunho", start: "—", end: "—", workouts: [] },
];

const students = ["João Mendes", "Mariana Costa", "Carlos Lima", "Ana Souza", "Paulo Rocha", "Beatriz Alves"];

function matchesExerciseSearch(exercise: { name: string; aliases: string }, query: string) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  return `${exercise.name} ${exercise.aliases}`.toLocaleLowerCase("pt-BR").includes(normalized);
}

function seriesFromPrescription(prescription: string) {
  return Number(prescription.match(/\d+/)?.[0] ?? 0);
}

function repetitionsFromPrescription(prescription: string) {
  return prescription.split("×")[1]?.trim() || "10–12";
}

function baseRepetitions(exercise: Exercise) {
  return Number((exercise.reps ?? repetitionsFromPrescription(exercise.prescription)).match(/\d+/)?.[0] ?? 10);
}

function repetitionsBySeries(exercise: Exercise, sets = exercise.sets ?? seriesFromPrescription(exercise.prescription)) {
  const existing = exercise.seriesReps ?? [];
  const fallback = baseRepetitions(exercise);
  return Array.from({ length: sets }, (_, index) => existing[index] ?? fallback);
}

function defaultBlocks(method: AdvancedMethod) {
  if (method === "Drop-set") return [4, 4, 4, 4];
  if (method === "Cluster set") return [4, 4, 4];
  if (method === "Rest-pause" || method === "Myo-reps") return [10, 4, 4];
  if (method === "Pirâmide") return [12, 10, 8, 6];
  return undefined;
}

function seriesConfigurations(exercise: Exercise, sets = exercise.sets ?? seriesFromPrescription(exercise.prescription)) {
  const repetitions = repetitionsBySeries(exercise, sets);
  return Array.from({ length: sets }, (_, index): SeriesConfiguration => {
    const current = exercise.seriesConfigurations?.[index];
    if (current) return { ...current, blocks: current.blocks ? [...current.blocks] : undefined };
    const legacyMethod = exercise.method === "Pirâmide" || exercise.methodSeries?.includes(index)
      ? exercise.method ?? "Convencional"
      : "Convencional";
    return { method: legacyMethod, reps: String(repetitions[index]), load: exercise.load, blocks: defaultBlocks(legacyMethod) };
  });
}

function formatSeriesPrescription(configurations: SeriesConfiguration[]) {
  const groups: { signature: string; count: number; configuration: SeriesConfiguration }[] = [];
  configurations.forEach((configuration) => {
    const detail = configuration.blocks?.join("+") || configuration.reps;
    const signature = `${configuration.method}|${detail}|${configuration.load}`;
    const previous = groups.at(-1);
    if (previous?.signature === signature) previous.count += 1;
    else groups.push({ signature, count: 1, configuration });
  });
  return groups.map(({ count, configuration }) => {
    if (configuration.method === "Convencional") return `${count} × ${configuration.reps}`;
    if (configuration.method === "Pirâmide") return `${count} × Pirâmide ${configuration.reps} rep · ${configuration.load}`;
    const detail = configuration.blocks?.join("+") || configuration.reps;
    return `${count} × ${configuration.method} ${detail}`;
  }).join(" + ");
}

function exerciseMethodSummary(exercise: Exercise) {
  const methods = [...new Set(seriesConfigurations(exercise).map((item) => item.method).filter((method) => method !== "Convencional"))];
  return methods.length ? methods.join(" + ") : "Convencional";
}

function adjustedLoad(load: string, delta: number) {
  const current = Number(load.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  const next = Math.max(0, current + delta);
  return `${Number.isInteger(next) ? next : next.toFixed(1).replace(".", ",")} kg`;
}

function methodConfiguration(_method: AdvancedMethod): { rounds: string; value: string; placeholder: string } | undefined {
  void _method;
  return undefined;
}

function calculateWorkoutVolume(exercises: Exercise[], catalog = systemExerciseCatalog) {
  const totals = exercises.reduce<Record<string, number>>((result, exercise) => {
    const catalogExercise = catalog.find((item) => item.name === exercise.name);
    const series = exercise.sets ?? seriesFromPrescription(exercise.prescription);
    catalogExercise?.muscles.forEach((item) => { result[item.muscle] = (result[item.muscle] ?? 0) + series * item.factor; });
    return result;
  }, {});
  return Object.entries(totals).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

function calculateProtocolVolume(workouts: Workout[]) {
  const totals = workouts.flatMap((workout) => workout.volume).reduce<Record<string, number>>((result, item) => {
    result[item.muscle] = (result[item.muscle] ?? 0) + item.sets;
    return result;
  }, {});
  return Object.entries(totals).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

function weeklyWorkoutOccurrences(protocol: Protocol, workoutIndex: number) {
  if (protocol.workouts.length === 0) return 0;
  const base = Math.floor(protocol.frequency / protocol.workouts.length);
  return base + (workoutIndex < protocol.frequency % protocol.workouts.length ? 1 : 0);
}

function calculateWeeklyVolumeImpact(protocol: Protocol, changedWorkoutId: number, executedExercises: Exercise[], catalog = systemExerciseCatalog): WeeklyVolumeImpact[] {
  const before = new Map<string, number>();
  const after = new Map<string, number>();

  protocol.workouts.forEach((workout, index) => {
    const occurrences = weeklyWorkoutOccurrences(protocol, index);
    const originalVolume = calculateWorkoutVolume(workout.exercises, catalog);
    const resultingVolume = calculateWorkoutVolume(workout.id === changedWorkoutId ? executedExercises : workout.exercises, catalog);

    originalVolume.forEach(({ muscle, sets }) => before.set(muscle, (before.get(muscle) ?? 0) + sets * occurrences));
    resultingVolume.forEach(({ muscle, sets }) => after.set(muscle, (after.get(muscle) ?? 0) + sets * occurrences));
  });

  return [...new Set([...before.keys(), ...after.keys()])]
    .map((muscle) => {
      const previous = before.get(muscle) ?? 0;
      const next = after.get(muscle) ?? 0;
      return { muscle, before: previous, after: next, difference: next - previous };
    })
    .filter(({ difference }) => Math.abs(difference) >= 0.01)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}

function formatWeeklySets(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function restInSeconds(rest = "60''") {
  const minuteFormat = rest.match(/^(\d+)'(?:(\d+)''?)?$/);
  if (minuteFormat) return Number(minuteFormat[1]) * 60 + Number(minuteFormat[2] ?? 0);
  return Number(rest.match(/^(\d+)''$/)?.[1] ?? 60);
}

function averageRepetitions(configuration: SeriesConfiguration) {
  if (configuration.blocks?.length) return configuration.blocks.reduce((total, value) => total + value, 0);
  const values = configuration.reps.match(/\d+/g)?.map(Number) ?? [10];
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function estimatedWorkoutDuration(exercises: Exercise[]) {
  if (!exercises.length) return 0;
  const executionAndRest = exercises.reduce((total, exercise) => {
    const configurations = seriesConfigurations(exercise);
    const execution = configurations.reduce((seconds, configuration) => seconds + Math.min(60, averageRepetitions(configuration) * 2.5), 0);
    const rests = Math.max(0, configurations.length - 1) * restInSeconds(exercise.rest);
    return total + execution + rests;
  }, 0);
  const setupAndTransitions = exercises.length * 75;
  return Math.max(1, Math.ceil((executionAndRest + setupAndTransitions) / 60));
}

function protocolDurationInWeeks(protocol: Protocol) {
  const parseDate = (value: string) => {
    const [day, month, year] = value.split("/").map(Number);
    return day && month && year ? new Date(year, month - 1, day) : null;
  };
  const start = parseDate(protocol.start);
  const end = parseDate(protocol.end);
  if (!start || !end || end < start) return 1;
  const durationInDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.ceil(durationInDays / 7));
}

function suggestedWorkoutExecutions(protocol: Protocol, workoutIndex: number) {
  if (protocol.workouts.length === 0) return 0;
  const totalExecutions = protocolDurationInWeeks(protocol) * protocol.frequency;
  const base = Math.floor(totalExecutions / protocol.workouts.length);
  return base + (workoutIndex < totalExecutions % protocol.workouts.length ? 1 : 0);
}

export default function WorkoutsPage() {
  const searchParams = useSearchParams();
  const requestedProtocolId = Number(searchParams.get("protocolo"));
  const requestedWorkoutId = Number(searchParams.get("treinoId"));
  const initiallyRequestedProtocol = initialProtocols.find((item) => item.id === requestedProtocolId);
  const initiallyRequestedWorkout = initiallyRequestedProtocol?.workouts.find((item) => item.id === requestedWorkoutId);
  const [exerciseCatalog, setExerciseCatalog] = useState(systemExerciseCatalog);
  const [protocols, setProtocols] = useState(initialProtocols);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [expandedWorkouts, setExpandedWorkouts] = useState<number[]>([]);
  const [expandedMacroVolumes, setExpandedMacroVolumes] = useState<number[]>([]);
  const [newProtocolOpen, setNewProtocolOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ protocol: Protocol; workout: Workout } | null>(
    initiallyRequestedProtocol && initiallyRequestedWorkout
      ? { protocol: initiallyRequestedProtocol, workout: initiallyRequestedWorkout }
      : null,
  );
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>(() =>
    initiallyRequestedWorkout?.exercises.map((exercise) => {
      const configurations = seriesConfigurations(exercise);
      return { ...exercise, originalExerciseId: exercise.id, sets: configurations.length, seriesConfigurations: configurations, prescription: formatSeriesPrescription(configurations) };
    }) ?? [],
  );
  const [swappingExerciseId, setSwappingExerciseId] = useState<number | null>(null);
  const [finishChoiceOpen, setFinishChoiceOpen] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState<{ protocolId: number; workout: Workout } | null>(null);
  const [workoutToRemove, setWorkoutToRemove] = useState<{ protocolId: number; workout: Workout } | null>(null);
  const [prescriptionEditor, setPrescriptionEditor] = useState<{ protocolId: number; workoutId: number } | null>(null);
  const [draftExercises, setDraftExercises] = useState<Exercise[]>([]);
  const [workoutDrafts, setWorkoutDrafts] = useState<Record<number, Exercise[]>>({});
  const [exerciseToAdd, setExerciseToAdd] = useState("");
  const [exerciseSearchWorkout, setExerciseSearchWorkout] = useState<number | null>(null);
  const [exerciseSuggestionsOpen, setExerciseSuggestionsOpen] = useState(false);
  const [expandedEditorExercise, setExpandedEditorExercise] = useState<number | null>(null);
  const [editingWorkoutDetails, setEditingWorkoutDetails] = useState<number | null>(null);
  const [workoutToDeleteInEditor, setWorkoutToDeleteInEditor] = useState<number | null>(null);
  const [volumeView, setVolumeView] = useState<{ scope: "protocol" | "workout"; workoutId?: number } | null>(null);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [incompleteFinishOpen, setIncompleteFinishOpen] = useState(false);
  const [periodizationOpen, setPeriodizationOpen] = useState(false);
  const [periodizationCount, setPeriodizationCount] = useState(1);
  const [periodizationWeeks, setPeriodizationWeeks] = useState(1);

  useEffect(() => {
    exerciseRepository.listCustom().then((customExercises) => {
      const customCatalog = customExercises
        .filter((exercise) => exercise.active)
        .map(({ name, aliases, muscles }) => ({ name, aliases, muscles }));
      setExerciseCatalog([...customCatalog, ...systemExerciseCatalog]);
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const student = searchParams.get("iniciar");
      const workoutName = searchParams.get("treino");
      const protocolId = Number(searchParams.get("protocolo"));
      const workoutId = Number(searchParams.get("treinoId"));
      const protocol = protocolId
        ? initialProtocols.find((item) => item.id === protocolId)
        : initialProtocols.find((item) => item.student === student);
      const workout = workoutId
        ? protocol?.workouts.find((item) => item.id === workoutId)
        : protocol?.workouts.find((item) => !workoutName || item.name === workoutName) ?? protocol?.workouts[0];
      if (!protocol || !workout) return;
      const exercises = workout.exercises.map((exercise) => {
        const configurations = seriesConfigurations(exercise);
        return { ...exercise, originalExerciseId: exercise.id, sets: configurations.length, seriesConfigurations: configurations, prescription: formatSeriesPrescription(configurations) };
      });
      setCompletedExercises([]);
      setSessionExercises(exercises);
      setActiveSession({ protocol, workout });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const protocolId = Number(searchParams.get("editarProtocolo"));
      const workoutId = Number(searchParams.get("editarTreino"));
      if (!protocolId || !workoutId) return;
      const protocol = initialProtocols.find((item) => item.id === protocolId);
      const workout = protocol?.workouts.find((item) => item.id === workoutId);
      if (!protocol || !workout) return;
      setPrescriptionEditor({ protocolId, workoutId });
      setWorkoutDrafts(Object.fromEntries(protocol.workouts.map((item) => [item.id, item.exercises.map((exercise) => ({ ...exercise }))])));
      setDraftExercises(workout.exercises.map((exercise) => ({ ...exercise })));
      if (searchParams.get("periodizar") === "1") setPeriodizationOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const filteredProtocols = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    return protocols.filter((protocol) =>
      (status === "Todos" || protocol.status === status) &&
      (protocol.student.toLocaleLowerCase("pt-BR").includes(normalized) || protocol.objective.toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [protocols, query, status]);

  const weeklyVolumeImpact = useMemo(() => {
    if (!activeSession) return [];
    return calculateWeeklyVolumeImpact(activeSession.protocol, activeSession.workout.id, sessionExercises, exerciseCatalog);
  }, [activeSession, exerciseCatalog, sessionExercises]);

  function toggleWorkout(id: number) {
    setExpandedWorkouts((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleMacroVolume(id: number) {
    setExpandedMacroVolumes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function addProtocol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const student = String(data.get("student"));
    const objective = String(data.get("objective"));
    const frequency = Number(data.get("frequency"));
    const start = String(data.get("start")).split("-").reverse().join("/");
    const end = String(data.get("end")).split("-").reverse().join("/");
    const protocol: Protocol = { id: Date.now(), student, objective, frequency, status: "Rascunho", start, end, workouts: [] };
    setProtocols((current) => [protocol, ...current]);
    setNewProtocolOpen(false);
    event.currentTarget.reset();
  }

  function startSession(protocol: Protocol, workout: Workout) {
    setCompletedExercises([]);
    setSessionExercises(workout.exercises.map((exercise) => {
      const configurations = seriesConfigurations(exercise);
      return { ...exercise, originalExerciseId: exercise.id, sets: configurations.length, seriesConfigurations: configurations, prescription: formatSeriesPrescription(configurations) };
    }));
    setSwappingExerciseId(null);
    setFinishChoiceOpen(false);
    setIncompleteFinishOpen(false);
    setActiveSession({ protocol, workout });
  }

  function toggleExercise(id: number) {
    setCompletedExercises((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function changeSessionSeries(id: number, direction: -1 | 1) {
    setSessionExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise);
      if (direction === -1 && configurations.length === 1) return exercise;
      const nextConfigurations = direction === 1
        ? [...configurations, { method: "Convencional" as const, reps: "8–12", load: configurations.at(-1)?.load ?? exercise.load }]
        : configurations.slice(0, -1);
      return { ...exercise, changed: true, sets: nextConfigurations.length, seriesConfigurations: nextConfigurations, prescription: formatSeriesPrescription(nextConfigurations) };
    }));
  }

  function updateSessionExercise(id: number, field: "name" | "load", value: string) {
    setSessionExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const next = { ...exercise, [field]: value, changed: true };
      if (field !== "load") return next;
      const configurations = seriesConfigurations(exercise).map((configuration) => ({ ...configuration, load: value }));
      return { ...next, seriesConfigurations: configurations };
    }));
  }

  function adjustSessionLoad(id: number, delta: -2.5 | 2.5, seriesIndex?: number) {
    setSessionExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise).map((configuration, index) => {
        if (seriesIndex !== undefined && index !== seriesIndex) return configuration;
        return { ...configuration, load: adjustedLoad(configuration.load, delta) };
      });
      const load = configurations[0]?.load ?? adjustedLoad(exercise.load, delta);
      return { ...exercise, changed: true, load, seriesConfigurations: configurations };
    }));
  }

  function adjustSessionRepetitions(id: number, delta: -1 | 1, seriesIndex: number) {
    setSessionExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise).map((configuration, index) => {
        if (index !== seriesIndex) return configuration;
        const reps = configuration.reps.replace(/\d+/g, (value) => String(Math.max(1, Number(value) + delta)));
        return { ...configuration, reps };
      });
      return { ...exercise, changed: true, sets: configurations.length, reps: configurations.map((item) => item.reps).join("/"), seriesConfigurations: configurations, prescription: formatSeriesPrescription(configurations) };
    }));
  }

  function compatibleExerciseNames(exercise: Exercise) {
    const original = exerciseCatalog.find((item) => item.name === exercise.name);
    const primaryMuscles = original?.muscles.filter((item) => item.factor === 1).map((item) => item.muscle) ?? [];
    return exerciseCatalog.filter((item) => item.name === exercise.name || item.muscles.some((muscle) => muscle.factor === 1 && primaryMuscles.includes(muscle.muscle))).map((item) => item.name);
  }

  function copyWorkout(workout: Workout, name = `${workout.name} (cópia)`): Workout {
    const workoutId = Date.now() + Math.floor(Math.random() * 1000);
    return {
      ...workout,
      id: workoutId,
      name,
      exercises: workout.exercises.map((exercise, index) => ({ ...exercise, id: workoutId * 100 + index })),
      volume: workout.volume.map((item) => ({ ...item })),
    };
  }

  function duplicateProtocol(protocol: Protocol) {
    const protocolId = Date.now();
    const copy: Protocol = {
      ...protocol,
      id: protocolId,
      status: "Rascunho",
      workouts: protocol.workouts.map((workout) => copyWorkout(workout, workout.name)),
    };
    setProtocols((current) => [copy, ...current]);
  }

  function updateProtocolDetails(protocolId: number, field: "name" | "start" | "end", value: string) {
    setProtocols((current) => current.map((item) => item.id === protocolId ? { ...item, [field]: value } : item));
  }

  function createPeriodization(protocol: Protocol) {
    const copies = Array.from({ length: periodizationCount }, (_, index) => {
      const protocolId = Date.now() + index;
      return {
        ...protocol,
        id: protocolId,
        name: `${protocol.name ?? protocol.objective} · Período ${index + 2}`,
        status: "Programado" as const,
        start: `Após período ${index + 1}`,
        end: `${periodizationWeeks} ${periodizationWeeks === 1 ? "semana" : "semanas"}`,
        workouts: protocol.workouts.map((workout) => copyWorkout(workout, workout.name)),
      };
    });
    setProtocols((current) => [...current, ...copies]);
    setPeriodizationOpen(false);
  }

  function duplicateWorkout(protocolId: number, workout: Workout) {
    const copy = copyWorkout(workout);
    setProtocols((current) => current.map((protocol) => protocol.id === protocolId
      ? { ...protocol, workouts: [...protocol.workouts, copy] }
      : protocol));
    setExpandedWorkouts((current) => [...current, copy.id]);
  }

  function removeWorkout() {
    if (!workoutToRemove) return;
    setProtocols((current) => current.map((protocol) => protocol.id === workoutToRemove.protocolId
      ? { ...protocol, workouts: protocol.workouts.filter((workout) => workout.id !== workoutToRemove.workout.id) }
      : protocol));
    setExpandedWorkouts((current) => current.filter((id) => id !== workoutToRemove.workout.id));
    setWorkoutToRemove(null);
  }

  function editWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workoutToEdit) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const focus = String(data.get("focus") || "").trim();
    const duration = estimatedWorkoutDuration(workoutToEdit.workout.exercises);
    if (!name || !focus) return;
    setProtocols((current) => current.map((protocol) => protocol.id === workoutToEdit.protocolId
      ? { ...protocol, workouts: protocol.workouts.map((workout) => workout.id === workoutToEdit.workout.id ? { ...workout, name, focus, duration } : workout) }
      : protocol));
    setWorkoutToEdit(null);
  }

  function openPrescriptionEditor(protocolId: number, workout: Workout) {
    const protocol = protocols.find((item) => item.id === protocolId);
    setPrescriptionEditor({ protocolId, workoutId: workout.id });
    setDraftExercises(workout.exercises.map((exercise) => ({ ...exercise })));
    setWorkoutDrafts(Object.fromEntries((protocol?.workouts ?? []).map((item) => [item.id, item.exercises.map((exercise) => ({ ...exercise }))])));
    setExpandedEditorExercise(null);
    setEditingWorkoutDetails(null);
    setVolumeView(null);
  }

  function selectEditorWorkout(protocolId: number, workoutId: number) {
    if (prescriptionEditor) {
      setWorkoutDrafts((current) => ({ ...current, [prescriptionEditor.workoutId]: draftExercises }));
    }
    const workout = protocols.find((protocol) => protocol.id === protocolId)?.workouts.find((item) => item.id === workoutId);
    if (!workout) return;
    setPrescriptionEditor({ protocolId, workoutId });
    setDraftExercises((workoutDrafts[workoutId] ?? workout.exercises).map((exercise) => ({ ...exercise })));
    setExpandedEditorExercise(null);
  }

  function updateWorkoutDetails(protocolId: number, workoutId: number, field: "name" | "focus" | "targetExecutions", value: string | number) {
    setProtocols((current) => current.map((protocol) => protocol.id === protocolId
      ? { ...protocol, workouts: protocol.workouts.map((workout) => workout.id === workoutId ? { ...workout, [field]: value } : workout) }
      : protocol));
  }

  function addWorkoutFromEditor(protocol: Protocol) {
    if (!prescriptionEditor) return;
    const id = Math.max(...protocols.flatMap((item) => item.workouts.map((workout) => workout.id)), 0) + 1;
    const workout: Workout = { id, name: `Treino ${String.fromCharCode(65 + protocol.workouts.length)}`, focus: "Definir foco", duration: 0, exercises: [], volume: [] };
    setWorkoutDrafts((current) => ({ ...current, [prescriptionEditor.workoutId]: draftExercises, [id]: [] }));
    setProtocols((current) => current.map((item) => item.id === protocol.id ? { ...item, workouts: [...item.workouts, workout] } : item));
    setPrescriptionEditor({ protocolId: protocol.id, workoutId: id });
    setDraftExercises([]);
    setExpandedEditorExercise(null);
    setEditingWorkoutDetails(id);
  }

  function duplicateWorkoutInEditor(protocol: Protocol, workout: Workout) {
    if (!prescriptionEditor) return;
    const sourceExercises = prescriptionEditor.workoutId === workout.id ? draftExercises : (workoutDrafts[workout.id] ?? workout.exercises);
    const copy = copyWorkout({ ...workout, exercises: sourceExercises, duration: estimatedWorkoutDuration(sourceExercises) });
    setWorkoutDrafts((current) => ({ ...current, [prescriptionEditor.workoutId]: draftExercises, [copy.id]: copy.exercises }));
    setProtocols((current) => current.map((item) => item.id === protocol.id ? { ...item, workouts: [...item.workouts, copy] } : item));
    setPrescriptionEditor({ protocolId: protocol.id, workoutId: copy.id });
    setDraftExercises(copy.exercises);
    setExpandedEditorExercise(null);
  }

  function finishSession() {
    if (!activeSession) return;
    if (completedExercises.length < sessionExercises.length) {
      setIncompleteFinishOpen(true);
      return;
    }
    continueFinishingSession();
  }

  function continueFinishingSession() {
    if (!activeSession) return;
    if (sessionExercises.some((exercise) => exercise.changed)) {
      setFinishChoiceOpen(true);
      return;
    }
    completeSession(false);
  }

  function finishAndCompleteAll() {
    setCompletedExercises(sessionExercises.map((exercise) => exercise.id));
    setIncompleteFinishOpen(false);
    continueFinishingSession();
  }

  function finishPartially() {
    setIncompleteFinishOpen(false);
    continueFinishingSession();
  }

  function completeSession(updatePrescription: boolean) {
    if (!activeSession) return;
    const executedExercises: Exercise[] = sessionExercises.map(({ originalExerciseId: _originalExerciseId, changed: _changed, ...exercise }) => {
      void _originalExerciseId;
      void _changed;
      return exercise;
    });
    setProtocols((current) => current.map((protocol) => protocol.id === activeSession.protocol.id
      ? { ...protocol, workouts: protocol.workouts.map((workout) => workout.id === activeSession.workout.id ? { ...workout, exercises: updatePrescription ? executedExercises : workout.exercises, volume: updatePrescription ? calculateWorkoutVolume(executedExercises, exerciseCatalog) : workout.volume, completedExecutions: (workout.completedExecutions ?? 0) + 1 } : workout) }
      : protocol));
    setFinishChoiceOpen(false);
    setSessionExercises([]);
    setActiveSession(null);
  }

  function deleteWorkoutFromEditor(protocol: Protocol, workoutId: number) {
    const remaining = protocol.workouts.filter((workout) => workout.id !== workoutId);
    if (remaining.length === 0) return;
    setProtocols((current) => current.map((item) => item.id === protocol.id ? { ...item, workouts: item.workouts.filter((workout) => workout.id !== workoutId) } : item));
    setWorkoutDrafts((current) => {
      const next = { ...current };
      delete next[workoutId];
      return next;
    });
    if (prescriptionEditor?.workoutId === workoutId) {
      const nextWorkout = remaining[0];
      setPrescriptionEditor({ protocolId: protocol.id, workoutId: nextWorkout.id });
      setDraftExercises((workoutDrafts[nextWorkout.id] ?? nextWorkout.exercises).map((exercise) => ({ ...exercise })));
    }
    setExpandedEditorExercise(null);
    setEditingWorkoutDetails(null);
    setWorkoutToDeleteInEditor(null);
  }

  function updateDraftExercise(id: number, field: "load" | "rest" | "methodValue", value: string) {
    setDraftExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, [field]: value } : exercise));
  }

  function updateDraftExercisePrescription(id: number, field: "sets" | "reps", value: string) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const sets = field === "sets" ? Number(value) : exercise.sets ?? seriesFromPrescription(exercise.prescription);
      const reps = field === "reps" ? value : exercise.reps ?? repetitionsFromPrescription(exercise.prescription);
      const configurations = seriesConfigurations(exercise, sets).map((configuration) => field === "reps" && configuration.method === "Convencional" ? { ...configuration, reps } : configuration);
      return { ...exercise, sets, reps, seriesConfigurations: configurations, seriesReps: configurations.map((item) => Number(item.reps.match(/\d+/)?.[0] ?? 0)), prescription: formatSeriesPrescription(configurations) };
    }));
  }

  function updateSeriesConfiguration(id: number, seriesIndex: number, field: "method" | "reps" | "load", value: string) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const sets = exercise.sets ?? seriesFromPrescription(exercise.prescription);
      const configurations = seriesConfigurations(exercise, sets).map((configuration, index) => {
        if (index !== seriesIndex) return configuration;
        if (field === "method") {
          const method = value as AdvancedMethod;
          return { ...configuration, method, blocks: defaultBlocks(method) };
        }
        return { ...configuration, [field]: value };
      });
      const advanced = configurations.map((item, index) => item.method !== "Convencional" ? index : -1).filter((index) => index >= 0);
      const firstAdvancedMethod = configurations.find((item) => item.method !== "Convencional")?.method ?? "Convencional";
      return { ...exercise, seriesConfigurations: configurations, method: firstAdvancedMethod, methodSeries: advanced, seriesReps: configurations.map((item) => Number(item.reps.match(/\d+/)?.[0] ?? 0)), prescription: formatSeriesPrescription(configurations) };
    }));
  }

  function updateSeriesBlock(id: number, seriesIndex: number, blockIndex: number, value: number) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise).map((configuration, index) => {
        if (index !== seriesIndex) return configuration;
        const blocks = [...(configuration.blocks ?? defaultBlocks(configuration.method) ?? [4, 4])];
        blocks[blockIndex] = value;
        return { ...configuration, blocks };
      });
      return { ...exercise, seriesConfigurations: configurations, prescription: formatSeriesPrescription(configurations) };
    }));
  }

  function changeSeriesBlockCount(id: number, seriesIndex: number, direction: -1 | 1) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise).map((configuration, index) => {
        if (index !== seriesIndex) return configuration;
        const blocks = [...(configuration.blocks ?? defaultBlocks(configuration.method) ?? [4, 4])];
        if (direction === 1 && blocks.length < 6) blocks.push(blocks.at(-1) ?? 4);
        if (direction === -1 && blocks.length > 2) blocks.pop();
        return { ...configuration, blocks };
      });
      return { ...exercise, seriesConfigurations: configurations, prescription: formatSeriesPrescription(configurations) };
    }));
  }

  function addSeriesToExercise(id: number) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise);
      const newConfiguration: SeriesConfiguration = { method: "Convencional", reps: "8–12", load: configurations.at(-1)?.load ?? exercise.load };
      const nextConfigurations = [...configurations, newConfiguration];
      return { ...exercise, sets: nextConfigurations.length, seriesConfigurations: nextConfigurations, seriesReps: nextConfigurations.map((item) => Number(item.reps.match(/\d+/)?.[0] ?? 0)), prescription: formatSeriesPrescription(nextConfigurations) };
    }));
  }

  function removeSeriesFromExercise(id: number, seriesIndex: number) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const configurations = seriesConfigurations(exercise);
      if (configurations.length === 1) return exercise;
      const nextConfigurations = configurations.filter((_, index) => index !== seriesIndex);
      const advanced = nextConfigurations.map((item, index) => item.method !== "Convencional" ? index : -1).filter((index) => index >= 0);
      return { ...exercise, sets: nextConfigurations.length, seriesConfigurations: nextConfigurations, methodSeries: advanced, method: nextConfigurations.find((item) => item.method !== "Convencional")?.method ?? "Convencional", seriesReps: nextConfigurations.map((item) => Number(item.reps.match(/\d+/)?.[0] ?? 0)), prescription: formatSeriesPrescription(nextConfigurations) };
    }));
  }

  function updateDraftMethod(id: number, method: AdvancedMethod) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const sets = exercise.sets ?? seriesFromPrescription(exercise.prescription);
      const seriesReps = repetitionsBySeries(exercise, sets);
      return { ...exercise, method, seriesReps, methodSeries: method === "Convencional" ? [] : method === "Pirâmide" ? seriesReps.map((_, index) => index) : [sets - 1] };
    }));
  }

  function updateSeriesRepetitions(id: number, seriesIndex: number, repetitions: number) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      const sets = exercise.sets ?? seriesFromPrescription(exercise.prescription);
      const seriesReps = repetitionsBySeries(exercise, sets).map((value, index) => index === seriesIndex ? repetitions : value);
      return { ...exercise, seriesReps, reps: seriesReps.join("/"), prescription: `${sets} × ${seriesReps.join("/")}` };
    }));
  }

  function toggleMethodSeries(id: number, seriesIndex: number) {
    setDraftExercises((current) => current.map((exercise) => {
      if (exercise.id !== id || exercise.method === "Pirâmide") return exercise;
      const selected = exercise.methodSeries ?? [];
      if (selected.includes(seriesIndex)) return { ...exercise, methodSeries: selected.length === 1 ? selected : selected.filter((index) => index !== seriesIndex) };
      const fatigueMethods: AdvancedMethod[] = ["Drop-set", "Rest-pause", "Myo-reps"];
      if (fatigueMethods.includes(exercise.method ?? "Convencional") && selected.length >= 2) return exercise;
      return { ...exercise, methodSeries: [...selected, seriesIndex].sort((a, b) => a - b) };
    }));
  }

  function updateDraftExerciseRounds(id: number, value: number) {
    setDraftExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, methodRounds: value } : exercise));
  }

  function addDraftExercise() {
    if (!exerciseCatalog.some((exercise) => exercise.name === exerciseToAdd)) return;
    const id = Math.max(...draftExercises.map((exercise) => exercise.id), 0) + 1;
    setDraftExercises((current) => [...current, { id, name: exerciseToAdd, prescription: "1 × 8–12", sets: 1, reps: "8–12", load: "0 kg", rest: "60''", method: "Convencional", seriesReps: [8], methodSeries: [], seriesConfigurations: [{ method: "Convencional", reps: "8–12", load: "0 kg" }] }]);
    setExerciseToAdd("");
    setExerciseSuggestionsOpen(false);
  }

  function addExerciseToEditorWorkout(workoutId: number, exercises: Exercise[], selectedExercise = exerciseToAdd) {
    if (!exerciseCatalog.some((exercise) => exercise.name === selectedExercise)) return;
    const id = Math.max(...Object.values(workoutDrafts).flat().map((exercise) => exercise.id), ...draftExercises.map((exercise) => exercise.id), 0) + 1;
    const exercise: Exercise = { id, name: selectedExercise, prescription: "1 × 8–12", sets: 1, reps: "8–12", load: "0 kg", rest: "60''", method: "Convencional", seriesReps: [8], methodSeries: [], seriesConfigurations: [{ method: "Convencional", reps: "8–12", load: "0 kg" }] };
    if (prescriptionEditor?.workoutId === workoutId) {
      setDraftExercises((current) => [...current, exercise]);
    } else {
      setWorkoutDrafts((current) => ({ ...current, [workoutId]: [...exercises, exercise] }));
    }
    setExerciseToAdd("");
    setExerciseSuggestionsOpen(false);
  }

  function moveDraftExercise(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= draftExercises.length) return;
    setDraftExercises((current) => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  }

  function savePrescription() {
    if (!prescriptionEditor) return;
    const allDrafts = { ...workoutDrafts, [prescriptionEditor.workoutId]: draftExercises };
    setProtocols((current) => current.map((protocol) => protocol.id === prescriptionEditor.protocolId
      ? { ...protocol, workouts: protocol.workouts.map((workout) => {
        const exercises = allDrafts[workout.id] ?? workout.exercises;
        return { ...workout, exercises, duration: estimatedWorkoutDuration(exercises), volume: calculateWorkoutVolume(exercises, exerciseCatalog) };
      }) }
      : protocol));
    setPrescriptionEditor(null);
  }

  function addWorkoutToProtocol(protocol: Protocol) {
    const id = Math.max(...protocols.flatMap((item) => item.workouts.map((workout) => workout.id)), 0) + 1;
    const workout: Workout = { id, name: `Treino ${String.fromCharCode(65 + protocol.workouts.length)}`, focus: "Definir foco", duration: 0, exercises: [], volume: [] };
    setProtocols((current) => current.map((item) => item.id === protocol.id ? { ...item, workouts: [...item.workouts, workout] } : item));
    setExpandedWorkouts((current) => [...current, id]);
    setPrescriptionEditor({ protocolId: protocol.id, workoutId: id });
    setDraftExercises([]);
  }

  const activeCount = protocols.filter((protocol) => protocol.status === "Ativo").length;
  const workoutCount = protocols.reduce((total, protocol) => total + protocol.workouts.length, 0);

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader title="Treinos" description="Crie protocolos, prescreva treinos e acompanhe cada sessão." action={<Button onClick={() => setNewProtocolOpen(true)}>＋ Novo protocolo</Button>} />

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative block w-full md:max-w-md"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno ou objetivo" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 text-sm outline-none focus:border-blue-500" /></label>
            <div className="flex gap-2 overflow-x-auto">{["Todos", "Ativo", "Programado", "Rascunho"].map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${status === item ? "bg-blue-600 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{item}</button>)}</div>
          </div>
        </Card>

        <section className="space-y-4">
          {filteredProtocols.map((protocol) => {
            const isExpanded = false;
            const protocolVolume = Object.entries(
              protocol.workouts.flatMap((workout) => workout.volume).reduce<Record<string, number>>((totals, item) => {
                totals[item.muscle] = (totals[item.muscle] ?? 0) + item.sets;
                return totals;
              }, {}),
            ).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
            const maximumProtocolVolume = Math.max(...protocolVolume.map((item) => item.sets), 1);
            const totalProtocolVolume = protocolVolume.reduce((total, item) => total + item.sets, 0);
            return <Card key={protocol.id} className="overflow-hidden p-0">
              <div className="flex items-center gap-3 p-4 sm:p-5">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-500/10 font-bold text-blue-500">{protocol.student.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
                <Link href={`/treinos/${encodeURIComponent(protocol.student)}`} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-blue-500 hover:text-blue-400">{protocol.student}</h2><Badge tone={protocol.status === "Ativo" ? "success" : protocol.status === "Programado" ? "info" : "neutral"}>{protocol.status}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">{protocol.objective} · {protocol.frequency}× por semana · {protocol.start} a {protocol.end}</p><span className="mt-2 inline-block text-xs font-semibold text-blue-500">Ver treinos do aluno →</span></Link>
                <div className="hidden text-right sm:block"><p className="text-2xl font-semibold">{protocol.workouts.length}</p><p className="text-xs text-[var(--muted)]">treinos</p></div>
              </div>

              {isExpanded && <div className="border-t border-[var(--border)] p-4 sm:p-5">
                {protocol.workouts.length ? <div className="space-y-3">{protocol.workouts.map((workout, workoutIndex) => {
                  const workoutExpanded = expandedWorkouts.includes(workout.id);
                  const maximumVolume = Math.max(...workout.volume.map((item) => item.sets), 1);
                  const targetExecutions = workout.targetExecutions ?? suggestedWorkoutExecutions(protocol, workoutIndex);
                  const completedExecutions = workout.completedExecutions ?? 0;
                  const executionProgress = targetExecutions > 0 ? Math.min(completedExecutions / targetExecutions * 100, 100) : 0;
                  return <div key={workout.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center gap-3 p-4">
                      <button type="button" onClick={() => toggleWorkout(workout.id)} className="min-w-0 flex-1 text-left" aria-expanded={workoutExpanded}>
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{workout.name}</h3><Badge tone="neutral">{workout.duration} min</Badge></div>
                        <p className="mt-1 text-sm text-[var(--muted)]">{workout.focus} · {workout.exercises.length} exercícios</p>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--muted)]">Progresso no protocolo</span><strong>{completedExecutions} de {targetExecutions} sessões</strong></div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all" style={{ width: `${executionProgress}%` }} /></div>
                      </button>
                      <button type="button" onClick={() => startSession(protocol, workout)} className="hidden whitespace-nowrap text-sm font-semibold text-blue-500 hover:text-blue-400 sm:block">Iniciar sessão →</button>
                      <button type="button" onClick={() => toggleWorkout(workout.id)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" aria-label={`${workoutExpanded ? "Recolher" : "Expandir"} ${workout.name}`}><span className={`transition-transform ${workoutExpanded ? "rotate-180" : ""}`}>⌄</span></button>
                    </div>

                    {workoutExpanded && <div className="grid gap-5 border-t border-[var(--border)] p-4 lg:grid-cols-[1fr_1.2fr]">
                      <div><h4 className="text-sm font-semibold">Exercícios prescritos</h4><div className="mt-3 space-y-2">{workout.exercises.map((exercise, index) => <div key={exercise.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{exercise.name}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{exercise.prescription} · {exercise.load}</p></div></div>)}</div></div>
                      <div><div className="flex items-end justify-between gap-3"><div><h4 className="text-sm font-semibold">Volume por grupo muscular</h4><p className="mt-1 text-xs text-[var(--muted)]">Séries equivalentes neste treino</p></div><Badge tone="info">{workout.volume.reduce((total, item) => total + item.sets, 0).toLocaleString("pt-BR")} séries</Badge></div><div className="mt-4 space-y-3">{workout.volume.map((item) => <div key={item.muscle}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-medium">{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")} séries</strong></div><div className="h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${item.sets / maximumVolume * 100}%` }} /></div></div>)}</div><p className="mt-4 text-xs text-[var(--muted)]">O cálculo considera séries diretas e a participação ponderada dos músculos secundários.</p></div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2 lg:justify-end"><Button onClick={() => startSession(protocol, workout)}>Iniciar sessão</Button><Button variant="secondary" onClick={() => openPrescriptionEditor(protocol.id, workout)}>Editar treino</Button><Button variant="secondary" onClick={() => duplicateWorkout(protocol.id, workout)}>Duplicar treino</Button><Button variant="secondary" className="border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => setWorkoutToRemove({ protocolId: protocol.id, workout })}>Excluir treino</Button></div>
                    </div>}
                  </div>;
                })}</div> : <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center"><p className="font-semibold">Nenhum treino criado</p><p className="mt-1 text-sm text-[var(--muted)]">Adicione o primeiro treino deste protocolo.</p></div>}
                {protocolVolume.length > 0 && <div className="mt-5 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5"><button type="button" onClick={() => toggleMacroVolume(protocol.id)} className="flex w-full items-center gap-3 p-4 text-left sm:p-5" aria-expanded={expandedMacroVolumes.includes(protocol.id)}><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Visão macro</p><h3 className="mt-1 font-semibold">Volume total do protocolo</h3><p className="mt-1 text-sm text-[var(--muted)]">{totalProtocolVolume.toLocaleString("pt-BR")} séries equivalentes em {protocolVolume.length} grupos musculares</p></div><span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-blue-500/20 bg-[var(--background)] text-blue-500 transition-transform ${expandedMacroVolumes.includes(protocol.id) ? "rotate-180" : ""}`}>⌄</span></button>{expandedMacroVolumes.includes(protocol.id) && <div className="border-t border-blue-500/15 p-4 sm:p-5"><div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">{protocolVolume.map((item) => <div key={item.muscle}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")} séries</strong></div><div className="h-3.5 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400" style={{ width: `${item.sets / maximumProtocolVolume * 100}%` }} /></div></div>)}</div><p className="mt-5 border-t border-blue-500/15 pt-4 text-xs text-[var(--muted)]">A visão macro considera todos os treinos uma vez. A projeção semanal será calculada posteriormente conforme a frequência planejada de cada treino.</p></div>}</div>}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => duplicateProtocol(protocol)}>Duplicar protocolo</Button><Button onClick={() => protocol.workouts.length ? openPrescriptionEditor(protocol.id, protocol.workouts[0]) : addWorkoutToProtocol(protocol)}>{protocol.workouts.length ? "Editar prescrição" : "＋ Adicionar treino"}</Button></div>
              </div>}
            </Card>;
          })}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Protocolos ativos" value={activeCount} detail={`${protocols.length} protocolos cadastrados`} tone="blue" />
          <StatCard title="Treinos prescritos" value={workoutCount} detail="Nos protocolos atuais" tone="green" />
          <StatCard title="Sessões hoje" value={7} detail="2 já concluídas" tone="violet" />
          <StatCard title="Fichas para revisar" value={2} detail="Nos próximos 7 dias" tone="amber" />
        </section>
      </div>

      {newProtocolOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="new-protocol-title"><form onSubmit={addProtocol} className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="new-protocol-title" className="text-xl font-semibold">Novo protocolo</h2><p className="mt-1 text-sm text-[var(--muted)]">Defina o planejamento inicial do aluno.</p></div><button type="button" onClick={() => setNewProtocolOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Aluno<select name="student" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{students.map((student) => <option key={student}>{student}</option>)}</select></label><label className="text-sm font-medium sm:col-span-2">Objetivo principal<select name="objective" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Hipertrofia</option><option>Emagrecimento</option><option>Força</option><option>Condicionamento</option><option>Qualidade de vida</option></select></label><label className="text-sm font-medium">Frequência semanal<select name="frequency" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{[1, 2, 3, 4, 5, 6, 7].map((number) => <option key={number} value={number}>{number}× por semana</option>)}</select></label><span /><label className="text-sm font-medium">Data de início<input required name="start" type="date" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-sm font-medium">Previsão de término<input required name="end" type="date" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label></div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setNewProtocolOpen(false)}>Cancelar</Button><Button type="submit">Criar protocolo</Button></div></form></div>}

      {prescriptionEditor && (() => {
        const protocol = protocols.find((item) => item.id === prescriptionEditor.protocolId);
        const activeWorkout = protocol?.workouts.find((item) => item.id === prescriptionEditor.workoutId);
        if (!protocol || !activeWorkout) return null;
        const editorWorkouts = protocol.workouts.map((item) => {
          const exercises = item.id === activeWorkout.id ? draftExercises : workoutDrafts[item.id] ?? item.exercises;
          return { ...item, exercises, volume: calculateWorkoutVolume(exercises, exerciseCatalog) };
        });
        const protocolVolume = calculateProtocolVolume(editorWorkouts);
        const protocolTotal = protocolVolume.reduce((total, item) => total + item.sets, 0);
        const protocolMaximum = Math.max(...protocolVolume.map((item) => item.sets), 1);

        return <div className="fixed inset-0 z-[65] bg-slate-950/90 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="prescription-board-title">
          <div onClick={() => volumeView && setVolumeView(null)} className="relative mx-auto flex h-[100dvh] w-full max-w-[1600px] flex-col overflow-y-auto bg-[var(--surface)] shadow-2xl sm:h-[calc(100dvh-2.5rem)] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[var(--border)]">
            <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] sm:static sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Editor de prescrição</p><h2 id="prescription-board-title" className="mt-1 text-xl font-semibold">{protocol.student}</h2><p className="mt-1 text-sm text-[var(--muted)]">{protocol.name ?? protocol.objective} · {protocol.frequency}× por semana</p></div>
              <div className="flex flex-wrap items-stretch justify-end gap-2"><Button variant="secondary" onClick={() => setPeriodizationOpen(true)}>Periodizar</Button><button type="button" onClick={(event) => { event.stopPropagation(); setVolumeView({ scope: "protocol" }); }} className="min-w-0 flex-1 rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-left text-xs text-white shadow-lg shadow-blue-600/20 sm:flex-none"><strong className="block text-sm">{protocolTotal.toLocaleString("pt-BR")} séries · {protocolVolume.length} grupos</strong><span>Revisar volume semanal</span></button><button type="button" onClick={() => setPrescriptionEditor(null)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div>
            </header>
            <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 sm:px-6">{protocols.filter((item) => item.student === protocol.student).map((item, index) => <button key={item.id} type="button" onClick={() => item.workouts[0] && openPrescriptionEditor(item.id, item.workouts[0])} className={`shrink-0 rounded-xl border px-4 py-2 text-left text-xs ${item.id === protocol.id ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-[var(--border)] bg-[var(--surface)]"}`}><strong className="block">{item.name ?? `Protocolo ${index + 1}`}</strong><span className="mt-0.5 block text-[10px] text-[var(--muted)]">{item.start} · {item.end}</span></button>)}</div>
            <div className="grid gap-3 border-b border-[var(--border)] px-4 py-3 sm:grid-cols-3 sm:px-6"><label className="text-xs text-[var(--muted)]">Nome do protocolo<input value={protocol.name ?? protocol.objective} onChange={(event) => updateProtocolDetails(protocol.id, "name", event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" /></label><label className="text-xs text-[var(--muted)]">Início<input value={protocol.start} onChange={(event) => updateProtocolDetails(protocol.id, "start", event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" /></label><label className="text-xs text-[var(--muted)]">Término ou duração<input value={protocol.end} onChange={(event) => updateProtocolDetails(protocol.id, "end", event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" /></label></div>

            <section className="min-h-0 flex-none overflow-visible p-4 sm:flex-1 sm:overflow-y-auto sm:p-6"><div className="mb-4"><h3 className="font-semibold">Visão da semana</h3><p className="text-sm text-[var(--muted)]">Clique em um exercício para abrir ou recolher seus campos de prescrição.</p></div>
              <div className="overflow-x-auto pb-2"><div className="grid auto-cols-[310px] grid-flow-col items-start gap-4 xl:auto-cols-[minmax(300px,1fr)]">
                {editorWorkouts.map((item, workoutIndex) => {
                  const active = item.id === activeWorkout.id;
                  const total = item.volume.reduce((sum, volume) => sum + volume.sets, 0);
                  const maximum = Math.max(...item.volume.map((volume) => volume.sets), 1);
                  const targetExecutions = item.targetExecutions ?? suggestedWorkoutExecutions(protocol, workoutIndex);
                  return <article key={item.id} className={`rounded-2xl border p-3 ${active ? "border-blue-500 bg-blue-500/5" : "border-[var(--border)] bg-[var(--background)]"}`}>
                        <div className="flex items-start gap-2"><button type="button" onClick={() => selectEditorWorkout(protocol.id, item.id)} className="min-w-0 flex-1 text-left"><strong className="block truncate">{item.name}</strong><span className="block truncate text-xs text-[var(--muted)]">{item.focus}</span></button><div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={active ? "info" : "neutral"}>{estimatedWorkoutDuration(active ? draftExercises : (workoutDrafts[item.id] ?? item.exercises))} min</Badge><span className="text-[10px] font-medium text-[var(--muted)]">Meta: {targetExecutions}×</span></div><button type="button" onClick={() => duplicateWorkoutInEditor(protocol, item)} className="grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-blue-500" aria-label={`Duplicar ${item.name}`}>⧉</button><button type="button" onClick={() => { selectEditorWorkout(protocol.id, item.id); setEditingWorkoutDetails(editingWorkoutDetails === item.id ? null : item.id); }} className="grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-blue-500" aria-label={`Editar nome, foco e meta de ${item.name}`}>✎</button><button type="button" onClick={() => setWorkoutToDeleteInEditor(item.id)} disabled={editorWorkouts.length === 1} className="grid size-7 shrink-0 place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-500 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Excluir ${item.name}`}>×</button></div>
                    {active && editingWorkoutDetails === item.id && <div className="mt-3 grid gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><label className="text-[11px] text-[var(--muted)]">Nome do treino<input value={item.name} onChange={(event) => updateWorkoutDetails(protocol.id, item.id, "name", event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]" /></label><label className="text-[11px] text-[var(--muted)]">Foco ou descrição<input value={item.focus} onChange={(event) => updateWorkoutDetails(protocol.id, item.id, "focus", event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]" /></label><label className="text-[11px] text-[var(--muted)]">Meta de execuções no protocolo<input type="number" min="1" max="999" value={targetExecutions} onChange={(event) => updateWorkoutDetails(protocol.id, item.id, "targetExecutions", Math.max(1, Number(event.target.value)))} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]" /><span className="mt-1 block text-[10px] leading-4">Sugestão automática baseada em {protocolDurationInWeeks(protocol)} semanas e frequência de {protocol.frequency}× por semana.</span></label><button type="button" onClick={() => setEditingWorkoutDetails(null)} className="justify-self-end rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Concluir</button></div>}
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"><span>▥ {total.toLocaleString("pt-BR")} séries</span><span className="text-blue-500">{item.volume.length} grupos</span></div>
                    <div className="mt-3 space-y-2">{item.exercises.map((exercise, index) => {
                      const open = active && expandedEditorExercise === exercise.id;
                      const sets = exercise.sets ?? seriesFromPrescription(exercise.prescription);
                      const configurations = seriesConfigurations(exercise, sets);
                      const methodSummary = exerciseMethodSummary(exercise);
                      return <div key={exercise.id} className={`overflow-hidden rounded-xl border ${open ? "border-blue-500 bg-blue-500/10" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                        <button type="button" onClick={() => { if (!active) selectEditorWorkout(protocol.id, item.id); setExpandedEditorExercise(open ? null : exercise.id); }} className="flex w-full items-center gap-3 p-3 text-left"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{exercise.name}</strong><span className="text-xs text-[var(--muted)]">{exercise.prescription} · {methodSummary}</span></span><span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span></button>
                        {open && <div className="border-t border-blue-500/20 p-3"><div><p className="text-[11px] font-semibold text-blue-500">Configuração individual das séries</p><p className="mt-0.5 text-[10px] leading-4 text-[var(--muted)]">{sets} {sets === 1 ? "série prescrita" : "séries prescritas"} · configure cada uma separadamente.</p></div><label className="mt-3 block text-[11px] text-[var(--muted)]">Descanso entre séries<select value={exercise.rest ?? "60''"} onChange={(event) => updateDraftExercise(exercise.id, "rest", event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm">{["30''","45''","60''","1'30''","2'00''","2'30''","3'00''"].map((value) => <option key={value}>{value}</option>)}</select></label>
                          <div className="mt-3 space-y-2">{configurations.map((configuration, seriesIndex) => <div key={seriesIndex} className={`rounded-xl border p-2.5 ${configuration.method === "Convencional" ? "border-[var(--border)] bg-[var(--surface)]" : "border-violet-500/30 bg-violet-500/10"}`}><div className="flex items-center gap-2"><strong className="shrink-0 text-xs">Série {seriesIndex + 1}</strong><select aria-label={`Método da série ${seriesIndex + 1}`} value={configuration.method} onChange={(event) => updateSeriesConfiguration(exercise.id, seriesIndex, "method", event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs">{["Convencional","Drop-set","Rest-pause","Cluster set","Pirâmide","Myo-reps","Bi-set"].map((value) => <option key={value}>{value}</option>)}</select><button type="button" aria-label={`Remover série ${seriesIndex + 1}`} onClick={() => removeSeriesFromExercise(exercise.id, seriesIndex)} disabled={configurations.length === 1} className="grid size-8 shrink-0 place-items-center rounded-lg border border-red-500/30 text-sm text-red-500 disabled:cursor-not-allowed disabled:opacity-30">×</button></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-[var(--muted)]">Repetições<input aria-label={`Repetições da série ${seriesIndex + 1}`} value={configuration.reps} onChange={(event) => updateSeriesConfiguration(exercise.id, seriesIndex, "reps", event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs" /></label><label className="text-[10px] text-[var(--muted)]">Carga<input aria-label={`Carga da série ${seriesIndex + 1}`} value={configuration.load} onChange={(event) => updateSeriesConfiguration(exercise.id, seriesIndex, "load", event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs" /></label></div>{configuration.blocks && <div className="mt-2 rounded-lg border border-violet-500/20 bg-[var(--background)] p-2"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-violet-500">Blocos de repetições</span><div className="flex gap-1"><button type="button" onClick={() => changeSeriesBlockCount(exercise.id, seriesIndex, -1)} className="grid size-6 place-items-center rounded border border-[var(--border)] text-xs">−</button><button type="button" onClick={() => changeSeriesBlockCount(exercise.id, seriesIndex, 1)} className="grid size-6 place-items-center rounded border border-[var(--border)] text-xs">＋</button></div></div><div className="mt-2 flex items-center gap-1 overflow-x-auto">{configuration.blocks.map((block, blockIndex) => <div key={blockIndex} className="flex items-center gap-1">{blockIndex > 0 && <span className="font-semibold text-violet-500">＋</span>}<select aria-label={`Bloco ${blockIndex + 1} da série ${seriesIndex + 1}`} value={block} onChange={(event) => updateSeriesBlock(exercise.id, seriesIndex, blockIndex, Number(event.target.value))} className="h-8 w-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1 text-center text-xs">{Array.from({length:20},(_,value)=>value+1).map((value)=><option key={value}>{value}</option>)}</select></div>)}</div></div>}</div>)}</div>
                          <button type="button" onClick={() => addSeriesToExercise(exercise.id)} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">＋ Adicionar série abaixo</button><div className="mt-3 flex justify-end gap-1"><button type="button" onClick={() => moveDraftExercise(index,-1)} disabled={index===0} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-30">↑</button><button type="button" onClick={() => moveDraftExercise(index,1)} disabled={index===draftExercises.length-1} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-30">↓</button><button type="button" onClick={() => setDraftExercises((current)=>current.filter((entry)=>entry.id!==exercise.id))} className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-500/10">Excluir</button></div>
                        </div>}
                      </div>;
                    })}</div>
                    <div className="relative mt-3"><input value={exerciseSearchWorkout === item.id ? exerciseToAdd : ""} onFocus={() => { setExerciseSearchWorkout(item.id); setExerciseSuggestionsOpen(true); }} onChange={(event) => { setExerciseSearchWorkout(item.id); setExerciseSuggestionsOpen(true); setExerciseToAdd(event.target.value); }} placeholder="Pesquisar e adicionar exercício" autoComplete="off" className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs outline-none focus:border-blue-500" />{exerciseSearchWorkout === item.id && exerciseSuggestionsOpen && exerciseToAdd.trim() && <div className="absolute left-0 right-0 top-10 z-30 max-h-52 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-2xl">{exerciseCatalog.filter((exercise) => matchesExerciseSearch(exercise, exerciseToAdd)).map((exercise) => <button key={exercise.name} type="button" onClick={() => addExerciseToEditorWorkout(item.id, item.exercises, exercise.name)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] hover:bg-blue-500/10 hover:text-blue-500"><span className="block font-medium">{exercise.name}</span>{exercise.aliases && <span className="mt-0.5 block text-[10px] text-[var(--muted)]">{exercise.aliases}</span>}</button>)}{exerciseCatalog.every((exercise) => !matchesExerciseSearch(exercise, exerciseToAdd)) && <p className="px-3 py-2 text-xs text-[var(--muted)]">Nenhum exercício encontrado</p>}</div>}</div>
                    <div className="mt-4 border-t border-[var(--border)] pt-3"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold">Volume do treino</p><p className="text-[11px] text-[var(--muted)]">Distribuição por grupo muscular</p></div><Badge tone="info">{total.toLocaleString("pt-BR")} séries</Badge></div><div className="space-y-2.5">{item.volume.map((volume)=><div key={volume.muscle}><div className="mb-1 flex justify-between text-xs"><span>{volume.muscle}</span><strong>{volume.sets.toLocaleString("pt-BR")}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{width:`${volume.sets/maximum*100}%`}}/></div></div>)}</div></div>
                  </article>;
                })}
                <button type="button" onClick={() => addWorkoutFromEditor(protocol)} className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-500/40 bg-blue-500/5 p-6 text-center text-blue-500 transition hover:border-blue-500 hover:bg-blue-500/10"><span className="grid size-11 place-items-center rounded-full bg-blue-500/10 text-2xl">＋</span><strong className="mt-3">Criar mais um treino</strong><span className="mt-1 text-xs text-[var(--muted)]">Adicione outra divisão à semana</span></button>
              </div></div>
            </section>

            {workoutToDeleteInEditor !== null && (() => { const target = editorWorkouts.find((item) => item.id === workoutToDeleteInEditor); if (!target) return null; return <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/70 p-4" onClick={() => setWorkoutToDeleteInEditor(null)}><div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-2xl" onClick={(event) => event.stopPropagation()}><p className="text-xs font-semibold uppercase tracking-wider text-red-500">Excluir treino</p><h3 className="mt-2 text-lg font-semibold">Excluir {target.name}?</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Os exercícios e o volume deste treino serão removidos da prescrição semanal.</p><div className="mt-5 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setWorkoutToDeleteInEditor(null)}>Cancelar</Button><button type="button" onClick={() => deleteWorkoutFromEditor(protocol, target.id)} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500">Excluir treino</button></div></div></div>; })()}
            {volumeView?.scope === "protocol" && <div className="absolute right-4 top-24 z-30 w-[min(420px,calc(100%-2rem))] rounded-2xl border border-blue-500/30 bg-[var(--surface)] p-4 shadow-2xl sm:right-6" onClick={(event)=>event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Revisão geral</p><h3 className="mt-1 font-semibold">Volume semanal do protocolo</h3></div><button type="button" onClick={()=>setVolumeView(null)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface-raised)]">×</button></div><div className="mt-2"><Badge tone="info">{protocolTotal.toLocaleString("pt-BR")} séries · {protocolVolume.length} grupos</Badge></div><div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">{protocolVolume.map((item)=><div key={item.muscle}><div className="mb-1 flex justify-between text-sm"><span>{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")}</strong></div><div className="h-3 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{width:`${item.sets/protocolMaximum*100}%`}}/></div></div>)}</div><p className="border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--muted)]">Use esta visão para revisar a distribuição geral enquanto prescreve a semana.</p></div>}
            <footer className="z-20 grid shrink-0 grid-cols-2 gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] sm:flex sm:justify-end sm:px-6"><Button variant="secondary" className="border-slate-400/40 bg-[var(--surface-raised)] text-[var(--foreground)]" onClick={()=>setPrescriptionEditor(null)}>Cancelar</Button><Button className="bg-blue-600 text-white" onClick={savePrescription}>Salvar prescrição semanal</Button></footer>
          </div>
        </div>;
      })()}

      {periodizationOpen && prescriptionEditor && (() => { const protocol = protocols.find((item) => item.id === prescriptionEditor.protocolId); if (!protocol) return null; return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-labelledby="periodization-title"><Card className="w-full max-w-md"><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Periodização</p><h2 id="periodization-title" className="mt-2 text-xl font-semibold">Duplicar este protocolo</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Crie períodos consecutivos que poderão ser nomeados e editados separadamente nas abas da prescrição.</p><div className="mt-6 space-y-4"><div><span className="text-sm font-medium">Quantos protocolos deseja criar?</span><div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)] p-2"><button type="button" onClick={() => setPeriodizationCount((value) => Math.max(1, value - 1))} className="grid size-10 place-items-center rounded-lg bg-[var(--surface-raised)] text-lg">−</button><strong>{periodizationCount}</strong><button type="button" onClick={() => setPeriodizationCount((value) => Math.min(12, value + 1))} className="grid size-10 place-items-center rounded-lg bg-[var(--surface-raised)] text-lg">＋</button></div></div><label className="block text-sm font-medium">Duração de cada protocolo<select value={periodizationWeeks} onChange={(event) => setPeriodizationWeeks(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{[1,2,3,4,5,6,8,12].map((weeks) => <option key={weeks} value={weeks}>{weeks} {weeks === 1 ? "semana" : "semanas"}</option>)}</select></label></div><div className="mt-6 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setPeriodizationOpen(false)}>Cancelar</Button><Button onClick={() => createPeriodization(protocol)}>Criar períodos</Button></div></Card></div>; })()}

      {Boolean(0) && prescriptionEditor && (() => {
        const protocol = protocols.find((item) => item.id === prescriptionEditor.protocolId);
        const activeWorkout = protocol?.workouts.find((item) => item.id === prescriptionEditor.workoutId);
        if (!protocol || !activeWorkout) return null;
        const editorWorkouts = protocol.workouts.map((item) => {
          const exercises = item.id === activeWorkout.id ? draftExercises : workoutDrafts[item.id] ?? item.exercises;
          return { ...item, exercises, volume: calculateWorkoutVolume(exercises, exerciseCatalog) };
        });
        const protocolVolume = calculateProtocolVolume(editorWorkouts);
        const selectedWorkout = volumeView?.scope === "workout" ? editorWorkouts.find((item) => item.id === volumeView.workoutId) : undefined;
        const selectedVolume = volumeView?.scope === "protocol" ? protocolVolume : selectedWorkout?.volume ?? [];
        const selectedTotal = selectedVolume.reduce((total, item) => total + item.sets, 0);
        const maximumVolume = Math.max(...selectedVolume.map((item) => item.sets), 1);

        return <div className="fixed inset-0 z-[65] overflow-y-auto bg-slate-950/90 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="weekly-prescription-title">
          <div className="mx-auto my-2 w-full max-w-[1500px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:px-6">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Editor semanal de prescrição</p><h2 id="weekly-prescription-title" className="mt-1 text-xl font-semibold">{protocol.student}</h2><p className="mt-1 text-sm text-[var(--muted)]">{protocol.objective} · {protocol.frequency}× por semana</p></div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => setVolumeView({ scope: "protocol" })} className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-left text-xs text-blue-500"><strong className="block text-sm">{protocolVolume.reduce((total, item) => total + item.sets, 0).toLocaleString("pt-BR")} séries · {protocolVolume.length} grupos</strong><span>Volume do protocolo</span></button><button type="button" onClick={() => setPrescriptionEditor(null)} className="grid size-10 place-items-center rounded-xl hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div>
            </header>

            <section className="border-b border-[var(--border)] p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Visão da semana</h3><p className="text-sm text-[var(--muted)]">Selecione um exercício para editar. Os volumes abrem ao tocar nos indicadores.</p></div></div>
              <div className="overflow-x-auto pb-2"><div className="grid auto-cols-[280px] grid-flow-col gap-3 lg:auto-cols-[minmax(260px,1fr)]">
                {editorWorkouts.map((item) => <article key={item.id} className={`rounded-2xl border p-3 ${item.id === activeWorkout.id ? "border-blue-500 bg-blue-500/5" : "border-[var(--border)] bg-[var(--background)]"}`}>
                  <div className="flex items-start justify-between gap-2"><button type="button" onClick={() => selectEditorWorkout(protocol.id, item.id)} className="min-w-0 text-left"><strong className="block truncate">{item.name}</strong><span className="text-xs text-[var(--muted)]">{item.focus}</span></button><Badge tone={item.id === activeWorkout.id ? "info" : "neutral"}>{item.duration} min</Badge></div>
                  <button type="button" onClick={() => setVolumeView({ scope: "workout", workoutId: item.id })} className="mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"><span>▥ {item.volume.reduce((total, volume) => total + volume.sets, 0).toLocaleString("pt-BR")} séries</span><span className="text-blue-500">{item.volume.length} grupos ›</span></button>
                  <div className="mt-3 space-y-2">{item.exercises.map((exercise, index) => <button key={exercise.id} type="button" onClick={() => { selectEditorWorkout(protocol.id, item.id); setExpandedEditorExercise(exercise.id); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${item.id === activeWorkout.id && expandedEditorExercise === exercise.id ? "border-blue-500 bg-blue-500/10" : "border-[var(--border)] bg-[var(--surface)]"}`}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{exercise.name}</strong><span className="text-xs text-[var(--muted)]">{exercise.prescription} · {exercise.load}</span></span><span className="text-[var(--muted)]">›</span></button>)}</div>
                  {item.exercises.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted)]">Treino sem exercícios</p>}
                </article>)}
              </div></div>
            </section>

            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,.7fr)]">
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Editando</p><h3 className="text-lg font-semibold">{activeWorkout.name} · {activeWorkout.focus}</h3></div><div className="flex flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row"><label className="min-w-0 flex-1 text-xs font-medium text-[var(--muted)]">Adicionar exercício<input list="weekly-exercise-options" value={exerciseToAdd} onChange={(event) => setExerciseToAdd(event.target.value)} placeholder="Comece a digitar" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-blue-500" /><datalist id="weekly-exercise-options">{exerciseCatalog.map((exercise) => <option key={exercise.name} value={exercise.name} />)}</datalist></label><Button onClick={addDraftExercise}>＋ Adicionar</Button></div></div>
                <div className="mt-4 space-y-2">{draftExercises.map((exercise, index) => {
                  const isOpen = expandedEditorExercise === exercise.id;
                  const method = exercise.method ?? "Convencional";
                  const sets = exercise.sets ?? seriesFromPrescription(exercise.prescription);
                  const seriesReps = repetitionsBySeries(exercise, sets);
                  const selectedMethodSeries = exercise.methodSeries ?? [];
                  return <article key={exercise.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center gap-2 p-3"><button type="button" onClick={() => setExpandedEditorExercise(isOpen ? null : exercise.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate">{exercise.name}</strong><span className="text-xs text-[var(--muted)]">{exercise.prescription} · {exercise.load} · {method}</span></span><span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span></button><button type="button" onClick={() => moveDraftExercise(index, -1)} disabled={index === 0} className="grid size-8 place-items-center rounded-lg border border-[var(--border)] disabled:opacity-30">↑</button><button type="button" onClick={() => moveDraftExercise(index, 1)} disabled={index === draftExercises.length - 1} className="grid size-8 place-items-center rounded-lg border border-[var(--border)] disabled:opacity-30">↓</button><button type="button" onClick={() => setDraftExercises((current) => current.filter((item) => item.id !== exercise.id))} className="grid size-8 place-items-center rounded-lg text-red-500 hover:bg-red-500/10">×</button></div>
                    {isOpen && <div className="border-t border-[var(--border)] p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><label className="text-xs text-[var(--muted)]">Séries<select value={sets} onChange={(event) => updateDraftExercisePrescription(exercise.id, "sets", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">{[1,2,3,4,5,6].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label><label className="text-xs text-[var(--muted)]">Repetições<input value={exercise.reps ?? repetitionsFromPrescription(exercise.prescription)} onChange={(event) => updateDraftExercisePrescription(exercise.id, "reps", event.target.value)} disabled={method !== "Convencional"} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm disabled:opacity-50" /></label><label className="text-xs text-[var(--muted)]">Carga<input value={exercise.load} onChange={(event) => updateDraftExercise(exercise.id, "load", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /></label><label className="text-xs text-[var(--muted)]">Descanso<select value={exercise.rest ?? "60''"} onChange={(event) => updateDraftExercise(exercise.id, "rest", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">{["30''","45''","60''","1'30''","2'00''","2'30''","3'00''"].map((value) => <option key={value}>{value}</option>)}</select></label></div><label className="mt-3 block text-xs text-[var(--muted)]">Método<select value={method} onChange={(event) => updateDraftMethod(exercise.id, event.target.value as AdvancedMethod)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">{["Convencional","Drop-set","Rest-pause","Cluster set","Pirâmide","Myo-reps","Bi-set"].map((value) => <option key={value}>{value}</option>)}</select></label>
                      {method !== "Convencional" && <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-blue-500">Configuração por série</p><p className="mt-1 text-xs text-[var(--muted)]">{method === "Pirâmide" ? "Defina as repetições de cada etapa." : "Toque na série para aplicar ou remover o método."}</p></div><Badge tone="info">{method}</Badge></div><div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">{seriesReps.map((repetitions, seriesIndex) => { const applied = method === "Pirâmide" || selectedMethodSeries.includes(seriesIndex); return <div key={seriesIndex} className="flex shrink-0 items-center gap-2">{seriesIndex > 0 && <span className="text-[var(--muted)]">—</span>}<div className={`w-24 rounded-xl border p-2 text-center ${applied ? "border-blue-500 bg-blue-500/10" : "border-[var(--border)] bg-[var(--surface)]"}`}><button type="button" onClick={() => toggleMethodSeries(exercise.id, seriesIndex)} disabled={method === "Pirâmide"} className="w-full text-[11px] font-semibold"><span className="block">Série {seriesIndex + 1}</span><span className={`block ${applied ? "text-blue-500" : "text-[var(--muted)]"}`}>{applied ? method : "Normal"}</span></button><select value={repetitions} onChange={(event) => updateSeriesRepetitions(exercise.id, seriesIndex, Number(event.target.value))} className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm font-semibold">{Array.from({ length: 20 }, (_, value) => value + 1).map((value) => <option key={value}>{value}</option>)}</select></div></div>; })}</div>{["Drop-set","Rest-pause","Myo-reps"].includes(method) && <p className="mt-3 text-xs text-[var(--muted)]">Aplicado inicialmente à última série; selecione no máximo duas.</p>}</div>}
                    </div>}
                  </article>;
                })}{draftExercises.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">Adicione o primeiro exercício deste treino.</div>}</div>
              </section>

              <aside className="h-fit rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 lg:sticky lg:top-24"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Volume selecionado</p><h3 className="mt-1 font-semibold">{volumeView?.scope === "protocol" ? "Protocolo completo" : selectedWorkout?.name ?? activeWorkout.name}</h3></div>{volumeView && <button type="button" onClick={() => setVolumeView(null)} className="grid size-8 place-items-center rounded-lg hover:bg-blue-500/10">×</button>}</div>{volumeView ? <><div className="mt-3"><Badge tone="info">{selectedTotal.toLocaleString("pt-BR")} séries · {selectedVolume.length} grupos</Badge></div><div className="mt-5 space-y-4">{selectedVolume.map((item) => <div key={item.muscle}><div className="mb-1.5 flex justify-between text-sm"><span>{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")}</strong></div><div className="h-3 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${item.sets / maximumVolume * 100}%` }} /></div></div>)}</div></> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Clique no indicador de um treino ou no volume do protocolo para abrir o gráfico.</p>}</aside>
            </div>
            <footer className="z-20 flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:sticky sm:bottom-0 sm:flex-row sm:justify-end sm:px-6"><Button variant="ghost" onClick={() => setPrescriptionEditor(null)}>Cancelar</Button><Button onClick={savePrescription}>Salvar prescrição semanal</Button></footer>
          </div>
        </div>;
      })()}

      {Boolean(0) && prescriptionEditor && (() => {
        const protocol = protocols.find((item) => item.id === prescriptionEditor.protocolId);
        const workout = protocol?.workouts.find((item) => item.id === prescriptionEditor.workoutId);
        if (!protocol || !workout) return null;
        const previewVolume = calculateWorkoutVolume(draftExercises, exerciseCatalog);
        return <div className="fixed inset-0 z-[65] overflow-y-auto bg-slate-950/90 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="prescription-editor-title"><div className="mx-auto my-2 w-full max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Editor de prescrição</p><h2 id="prescription-editor-title" className="mt-1 text-xl font-semibold">{protocol.student}</h2><p className="mt-1 text-sm text-[var(--muted)]">{protocol.objective} · {protocol.frequency}× por semana</p></div><button type="button" onClick={() => setPrescriptionEditor(null)} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></header>
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.5fr_1fr]">
            <section><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="text-sm font-medium">Treino<select value={workout.id} onChange={(event) => selectEditorWorkout(protocol.id, Number(event.target.value))} className="mt-2 h-11 w-full min-w-52 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{protocol.workouts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.focus}</option>)}</select></label><div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end"><label className="min-w-0 flex-1 text-sm font-medium">Buscar exercício<input list="prescription-exercise-options" value={exerciseToAdd} onChange={(event) => setExerciseToAdd(event.target.value)} placeholder="Comece a digitar o nome" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-blue-500" /><datalist id="prescription-exercise-options">{exerciseCatalog.map((exercise) => <option key={exercise.name} value={exercise.name} />)}</datalist></label><Button className="sm:mb-0" onClick={addDraftExercise}>＋ Adicionar</Button></div></div>
              <div className="mt-5 space-y-3">{draftExercises.map((exercise, index) => { const method = exercise.method ?? "Convencional"; const configuration = methodConfiguration(method); const sets = exercise.sets ?? seriesFromPrescription(exercise.prescription); const seriesReps = repetitionsBySeries(exercise, sets); const selectedMethodSeries = exercise.methodSeries ?? []; return <div key={exercise.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"><div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span><h3 className="min-w-0 flex-1 truncate font-semibold">{exercise.name}</h3><button type="button" onClick={() => moveDraftExercise(index, -1)} disabled={index === 0} className="grid size-8 place-items-center rounded-lg border border-[var(--border)] disabled:opacity-30" aria-label={`Mover ${exercise.name} para cima`}>↑</button><button type="button" onClick={() => moveDraftExercise(index, 1)} disabled={index === draftExercises.length - 1} className="grid size-8 place-items-center rounded-lg border border-[var(--border)] disabled:opacity-30" aria-label={`Mover ${exercise.name} para baixo`}>↓</button><button type="button" onClick={() => setDraftExercises((current) => current.filter((item) => item.id !== exercise.id))} className="grid size-8 place-items-center rounded-lg text-red-500 hover:bg-red-500/10" aria-label={`Remover ${exercise.name}`}>×</button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><label className="text-xs font-medium text-[var(--muted)]">Séries<select value={sets} onChange={(event) => updateDraftExercisePrescription(exercise.id, "sets", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">{[1, 2, 3, 4, 5, 6].map((series) => <option key={series} value={series}>{series}×</option>)}</select></label><label className="text-xs font-medium text-[var(--muted)]">Repetições<input value={exercise.reps ?? repetitionsFromPrescription(exercise.prescription)} onChange={(event) => updateDraftExercisePrescription(exercise.id, "reps", event.target.value)} placeholder="Ex.: 10–12" disabled={method !== "Convencional"} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] disabled:opacity-50" /></label><label className="text-xs font-medium text-[var(--muted)]">Carga<input value={exercise.load} onChange={(event) => updateDraftExercise(exercise.id, "load", event.target.value)} placeholder="Ex.: 30 kg" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]" /></label><label className="text-xs font-medium text-[var(--muted)]">Descanso<select value={exercise.rest ?? "60''"} onChange={(event) => updateDraftExercise(exercise.id, "rest", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">{["30''", "45''", "60''", "1'30''", "2'00''", "2'30''", "3'00''"].map((rest) => <option key={rest}>{rest}</option>)}</select></label></div><label className="mt-3 block text-xs font-medium text-[var(--muted)]">Método<select value={method} onChange={(event) => updateDraftMethod(exercise.id, event.target.value as AdvancedMethod)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"><option>Convencional</option><option>Drop-set</option><option>Rest-pause</option><option>Cluster set</option><option>Pirâmide</option><option>Myo-reps</option><option>Bi-set</option></select></label>{method !== "Convencional" && <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-blue-500">Configuração por série</p><p className="mt-1 text-xs text-[var(--muted)]">{method === "Pirâmide" ? "Defina as repetições de cada etapa." : "Toque na série para aplicar ou remover o método."}</p></div><Badge tone="info">{method}</Badge></div><div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">{seriesReps.map((repetitions, seriesIndex) => { const methodApplied = method === "Pirâmide" || selectedMethodSeries.includes(seriesIndex); return <div key={seriesIndex} className="flex shrink-0 items-center gap-2">{seriesIndex > 0 && <span className="text-[var(--muted)]">—</span>}<div className={`w-24 rounded-xl border p-2 text-center transition ${methodApplied ? "border-blue-500 bg-blue-500/10" : "border-[var(--border)] bg-[var(--surface)]"}`}><button type="button" onClick={() => toggleMethodSeries(exercise.id, seriesIndex)} disabled={method === "Pirâmide"} className="w-full text-[11px] font-semibold"><span className="block">Série {seriesIndex + 1}</span><span className={`mt-0.5 block ${methodApplied ? "text-blue-500" : "text-[var(--muted)]"}`}>{methodApplied ? method : "Normal"}</span></button><select value={repetitions} onChange={(event) => updateSeriesRepetitions(exercise.id, seriesIndex, Number(event.target.value))} className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm font-semibold">{Array.from({ length: 20 }, (_, repetitionIndex) => repetitionIndex + 1).map((value) => <option key={value}>{value}</option>)}</select><span className="mt-1 block text-[10px] text-[var(--muted)]">repetições</span></div></div>; })}</div>{["Drop-set", "Rest-pause", "Myo-reps"].includes(method) && <p className="mt-3 text-xs text-[var(--muted)]">Por padrão, o método é aplicado à última série. É possível selecionar no máximo duas séries.</p>}</div>}{configuration && <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><label className="text-xs font-medium text-[var(--muted)]">{configuration.rounds}<select value={exercise.methodRounds ?? 1} onChange={(event) => updateDraftExerciseRounds(exercise.id, Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">{[1, 2, 3, 4, 5, 6].map((round) => <option key={round}>{round}</option>)}</select></label><label className="text-xs font-medium text-[var(--muted)]">{configuration.value}<input value={exercise.methodValue ?? ""} onChange={(event) => updateDraftExercise(exercise.id, "methodValue", event.target.value)} placeholder={configuration.placeholder} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]" /></label></div>}</div>; })}{draftExercises.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center"><p className="font-semibold">Treino vazio</p><p className="mt-1 text-sm text-[var(--muted)]">Escolha um exercício da biblioteca para começar.</p></div>}</div>
            </section>
            <aside className="h-fit rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 lg:sticky lg:top-28"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Prévia automática</p><h3 className="mt-1 font-semibold">Volume do treino</h3></div><Badge tone="info">{previewVolume.reduce((total, item) => total + item.sets, 0).toLocaleString("pt-BR")} séries</Badge></div><div className="mt-5 space-y-4">{previewVolume.map((item) => { const maximum = Math.max(...previewVolume.map((volume) => volume.sets), 1); return <div key={item.muscle}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span>{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")}</strong></div><div className="h-3 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${item.sets / maximum * 100}%` }} /></div></div>; })}{previewVolume.length === 0 && <p className="text-sm text-[var(--muted)]">Adicione exercícios classificados para visualizar o volume.</p>}</div><p className="mt-5 border-t border-blue-500/15 pt-4 text-xs leading-5 text-[var(--muted)]">O gráfico é atualizado enquanto você altera séries ou exercícios. Os valores consideram músculos principais e secundários ponderados.</p></aside>
          </div><footer className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:justify-end sm:p-6"><Button variant="ghost" onClick={() => setPrescriptionEditor(null)}>Cancelar</Button><Button onClick={savePrescription}>Salvar prescrição</Button></footer></div></div>;
      })()}

      {workoutToEdit && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-workout-title"><form onSubmit={editWorkout} className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="edit-workout-title" className="text-xl font-semibold">Editar treino</h2><p className="mt-1 text-sm text-[var(--muted)]">Atualize as informações gerais deste treino.</p></div><button type="button" onClick={() => setWorkoutToEdit(null)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="mt-6 space-y-4"><label className="block text-sm font-medium">Nome do treino<input name="name" required defaultValue={workoutToEdit.workout.name} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label><label className="block text-sm font-medium">Foco do treino<input name="focus" required defaultValue={workoutToEdit.workout.focus} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label><div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><p className="text-xs font-semibold text-blue-500">Duração calculada automaticamente</p><p className="mt-1 text-sm">{estimatedWorkoutDuration(workoutToEdit.workout.exercises)} minutos estimados</p><p className="mt-1 text-xs text-[var(--muted)]">Considera repetições, descanso entre séries e 75 segundos para ajustes entre exercícios.</p></div></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={() => setWorkoutToEdit(null)}>Cancelar</Button><Button type="submit">Salvar alterações</Button></div></form></div>}

      {workoutToRemove && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="remove-workout-title"><Card className="w-full max-w-md"><div className="grid size-12 place-items-center rounded-2xl bg-red-500/10 text-xl text-red-500">×</div><h2 id="remove-workout-title" className="mt-4 text-xl font-semibold">Remover {workoutToRemove.workout.name}?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">O treino será retirado deste protocolo. Sessões já realizadas e seus históricos não serão apagados.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setWorkoutToRemove(null)}>Cancelar</Button><Button className="bg-red-600 hover:bg-red-500" onClick={removeWorkout}>Remover treino</Button></div></Card></div>}

      {activeSession && <SessionPanel student={activeSession.protocol.student} workoutName={activeSession.workout.name} focus={activeSession.workout.focus} exercises={sessionExercises} completedIds={completedExercises} swappingExerciseId={swappingExerciseId} compatibleNames={compatibleExerciseNames} onClose={() => setActiveSession(null)} onToggleComplete={toggleExercise} onAdjustLoad={adjustSessionLoad} onAdjustRepetitions={adjustSessionRepetitions} onChangeSeries={changeSessionSeries} onToggleSwap={(id) => setSwappingExerciseId((current) => current === id ? null : id)} onUpdateExercise={updateSessionExercise} onFinish={finishSession} />}

      {incompleteFinishOpen && activeSession && <div className="fixed inset-0 z-[72] grid place-items-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-labelledby="incomplete-finish-title"><Card className="w-full max-w-md"><div className="grid size-12 place-items-center rounded-2xl bg-blue-500/10 text-xl text-blue-500">✓</div><h2 id="incomplete-finish-title" className="mt-4 text-xl font-semibold">Finalizar a sessão?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Ainda existem {sessionExercises.length - completedExercises.length} exercícios não concluídos. Você deseja marcá-los como concluídos antes de finalizar?</p><div className="mt-6 space-y-2"><Button className="w-full" onClick={finishAndCompleteAll}>Concluir todos e finalizar</Button><Button variant="secondary" className="w-full" onClick={finishPartially}>Finalizar parcialmente</Button><Button variant="ghost" className="w-full" onClick={() => setIncompleteFinishOpen(false)}>Voltar à sessão</Button></div></Card></div>}

      {finishChoiceOpen && activeSession && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="finish-choice-title"><Card className="max-h-[90vh] w-full max-w-md overflow-y-auto"><div className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-xl text-amber-600">↻</div><h2 id="finish-choice-title" className="mt-4 text-xl font-semibold">Como deseja salvar as alterações?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Você alterou séries, carga ou exercício durante esta sessão. Escolha se essas mudanças valerão apenas hoje ou também para as próximas sessões.</p>{weeklyVolumeImpact.length > 0 && <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4"><p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Impacto no volume semanal estimado</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Considerando a frequência atual de {activeSession.protocol.frequency} treinos por semana.</p><div className="mt-3 space-y-2">{weeklyVolumeImpact.map((impact) => <div key={impact.muscle} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] px-3 py-2"><div><p className="text-sm font-medium">{impact.muscle}</p><p className="text-xs text-[var(--muted)]">{formatWeeklySets(impact.before)} → {formatWeeklySets(impact.after)} séries/semana</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${impact.difference < 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"}`}>{impact.difference > 0 ? "+" : ""}{formatWeeklySets(impact.difference)}</span></div>)}</div></div>}<div className="mt-6 space-y-2"><Button className="w-full" onClick={() => completeSession(false)}>Somente nesta sessão</Button><Button variant="secondary" className="w-full" onClick={() => completeSession(true)}>Atualizar próximos treinos</Button><Button variant="ghost" className="w-full" onClick={() => setFinishChoiceOpen(false)}>Voltar à sessão</Button></div></Card></div>}
    </MainLayout>
  );
}
