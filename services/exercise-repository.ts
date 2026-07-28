import type { LibraryExercise } from "@/lib/exercise-library";

export interface ExerciseRepository {
  listCustom(): Promise<LibraryExercise[]>;
  saveCustom(exercise: LibraryExercise): Promise<void>;
  archiveCustom(id: number): Promise<void>;
  restoreCustom(id: number): Promise<void>;
}

const STORAGE_KEY = "personalflow:custom-exercises";

function readStoredExercises() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as LibraryExercise[] : [];
  } catch {
    return [];
  }
}

function writeStoredExercises(exercises: LibraryExercise[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
}

class LocalExerciseRepository implements ExerciseRepository {
  async listCustom() {
    return readStoredExercises();
  }

  async saveCustom(exercise: LibraryExercise) {
    const current = readStoredExercises();
    const next = current.some((item) => item.id === exercise.id)
      ? current.map((item) => item.id === exercise.id ? exercise : item)
      : [exercise, ...current];
    writeStoredExercises(next);
  }

  async archiveCustom(id: number) {
    writeStoredExercises(readStoredExercises().map((item) => item.id === id ? { ...item, active: false } : item));
  }

  async restoreCustom(id: number) {
    writeStoredExercises(readStoredExercises().map((item) => item.id === id ? { ...item, active: true } : item));
  }
}

// Ao conectar o Supabase, somente esta implementação será substituída.
// A interface e a tela permanecerão iguais.
export const exerciseRepository: ExerciseRepository = new LocalExerciseRepository();
