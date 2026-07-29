type VolumeExercise = {
  prescription: string;
  load: string;
  sets?: number;
  reps?: string;
  seriesConfigurations?: { reps: string; load: string }[];
};

type VolumeWorkout = {
  exercises: VolumeExercise[];
  volume: { muscle: string; sets: number }[];
};

export type VolumeMetric = "series" | "work";

function numericValue(value: string) {
  return Number(value.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
}

function averageRepetitions(value: string) {
  const repetitions = value.match(/\d+(?:[.,]\d+)?/g)?.map((item) => Number(item.replace(",", "."))) ?? [];
  if (repetitions.length === 0) return 0;
  return repetitions.reduce((sum, item) => sum + item, 0) / repetitions.length;
}

export function exerciseWorkload(exercise: VolumeExercise) {
  if (exercise.seriesConfigurations?.length) {
    return exercise.seriesConfigurations.reduce((total, series) => total + averageRepetitions(series.reps) * numericValue(series.load), 0);
  }
  const sets = exercise.sets ?? Number(exercise.prescription.match(/\d+/)?.[0] ?? 0);
  const repetitions = averageRepetitions(exercise.reps ?? exercise.prescription.split("×")[1] ?? "");
  return sets * repetitions * numericValue(exercise.load);
}

export function workoutWorkload(workout: VolumeWorkout) {
  return workout.exercises.reduce((total, exercise) => total + exerciseWorkload(exercise), 0);
}

export function distributedWorkload(series: number, totalSeries: number, totalWorkload: number) {
  return totalSeries > 0 ? totalWorkload * (series / totalSeries) : 0;
}

export function volumeByMuscle(workouts: VolumeWorkout[], metric: VolumeMetric) {
  const totals = new Map<string, number>();

  workouts.forEach((workout) => {
    const totalSeries = workout.volume.reduce((sum, item) => sum + item.sets, 0);
    const totalWorkload = workoutWorkload(workout);
    workout.volume.forEach((item) => {
      const value = metric === "series"
        ? item.sets
        : distributedWorkload(item.sets, totalSeries, totalWorkload);
      totals.set(item.muscle, (totals.get(item.muscle) ?? 0) + value);
    });
  });

  return Array.from(totals, ([muscle, value]) => ({ muscle, value }))
    .sort((a, b) => b.value - a.value);
}

export function formatVolumeValue(value: number, metric: VolumeMetric) {
  if (metric === "series") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} séries`;
  return `${Math.round(value).toLocaleString("pt-BR")} kg`;
}
