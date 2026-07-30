import type { LibraryExercise } from "@/lib/exercise-library";
import { createClient } from "@/lib/supabase/client";

export interface ExerciseRepository {
  listCustom(): Promise<LibraryExercise[]>;
  saveCustom(exercise: LibraryExercise): Promise<void>;
  archiveCustom(id: number): Promise<void>;
  restoreCustom(id: number): Promise<void>;
}

const LEGACY_STORAGE_KEY = "personalflow:custom-exercises";
const STORAGE_KEY_PREFIX = `${LEGACY_STORAGE_KEY}:`;

function storageKeyForUser(userId: string | null) {
  return userId ? `${STORAGE_KEY_PREFIX}${userId}` : LEGACY_STORAGE_KEY;
}

function readStoredExercises(storageKey: string): LibraryExercise[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as LibraryExercise[]) : [];
  } catch {
    return [];
  }
}

function writeStoredExercises(
  storageKey: string,
  exercises: LibraryExercise[],
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(exercises));
}

class LocalExerciseRepository implements ExerciseRepository {
  constructor(private readonly storageKey: string) {}

  async listCustom() {
    return readStoredExercises(this.storageKey);
  }

  async saveCustom(exercise: LibraryExercise) {
    const current = readStoredExercises(this.storageKey);
    const next = current.some((item) => item.id === exercise.id)
      ? current.map((item) => (item.id === exercise.id ? exercise : item))
      : [exercise, ...current];
    writeStoredExercises(this.storageKey, next);
  }

  async archiveCustom(id: number) {
    writeStoredExercises(
      this.storageKey,
      readStoredExercises(this.storageKey).map((item) =>
        item.id === id ? { ...item, active: false } : item,
      ),
    );
  }

  async restoreCustom(id: number) {
    writeStoredExercises(
      this.storageKey,
      readStoredExercises(this.storageKey).map((item) =>
        item.id === id ? { ...item, active: true } : item,
      ),
    );
  }
}

type ExerciseRow = {
  id: number;
  name: string;
  aliases: string;
  equipment: string;
  movement: string;
  type: string;
  laterality: string;
  level: string;
  instructions: string;
  active: boolean;
  custom_exercise_muscles: Array<{
    muscle: string;
    factor: number;
    role: "Principal" | "Secundário";
  }>;
};

class SupabaseExerciseRepository implements ExerciseRepository {
  private localFor(userId: string | null) {
    return new LocalExerciseRepository(storageKeyForUser(userId));
  }

  private claimLegacyExercises(userId: string) {
    const scopedKey = storageKeyForUser(userId);
    const scoped = readStoredExercises(scopedKey);
    if (scoped.length > 0) return scoped;

    const legacy = readStoredExercises(LEGACY_STORAGE_KEY);
    if (legacy.length > 0) {
      writeStoredExercises(scopedKey, legacy);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return legacy;
  }

  private get client() {
    return createClient();
  }

  private async authenticatedUserId() {
    const { data, error } = await this.client.auth.getUser();
    return error ? null : (data.user?.id ?? null);
  }

  private async saveRemote(
    exercise: LibraryExercise,
    professionalId: string,
  ) {
    const { error: exerciseError } = await this.client
      .from("custom_exercises")
      .upsert({
        id: exercise.id,
        professional_id: professionalId,
        name: exercise.name,
        aliases: exercise.aliases,
        equipment: exercise.equipment,
        movement: exercise.movement,
        type: exercise.type,
        laterality: exercise.laterality,
        level: exercise.level,
        instructions: exercise.instructions,
        active: exercise.active,
      });

    if (exerciseError) throw exerciseError;

    const { error: deleteError } = await this.client
      .from("custom_exercise_muscles")
      .delete()
      .eq("exercise_id", exercise.id);
    if (deleteError) throw deleteError;

    if (exercise.muscles.length > 0) {
      const { error: musclesError } = await this.client
        .from("custom_exercise_muscles")
        .insert(
          exercise.muscles.map((muscle) => ({
            exercise_id: exercise.id,
            muscle: muscle.muscle,
            factor: muscle.factor,
            role: muscle.role,
          })),
        );
      if (musclesError) throw musclesError;
    }
  }

  async listCustom() {
    const professionalId = await this.authenticatedUserId();
    if (!professionalId) return this.localFor(null).listCustom();

    const localExercises = this.claimLegacyExercises(professionalId);

    const { data, error } = await this.client
      .from("custom_exercises")
      .select(`
        id,
        name,
        aliases,
        equipment,
        movement,
        type,
        laterality,
        level,
        instructions,
        active,
        custom_exercise_muscles (muscle, factor, role)
      `)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Não foi possível carregar exercícios do Supabase.", error);
      return localExercises;
    }

    const rows = (data ?? []) as unknown as ExerciseRow[];
    if (rows.length === 0 && localExercises.length > 0) {
      try {
        await Promise.all(
          localExercises.map((exercise) =>
            this.saveRemote(exercise, professionalId),
          ),
        );
      } catch (migrationError) {
        console.warn(
          "Os exercícios locais ainda não puderam ser migrados.",
          migrationError,
        );
      }
      return localExercises;
    }

    const exercises: LibraryExercise[] = rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      aliases: row.aliases,
      equipment: row.equipment,
      movement: row.movement,
      type: row.type,
      laterality: row.laterality,
      level: row.level,
      origin: "Personalizado",
      muscles: row.custom_exercise_muscles.map((muscle) => ({
        muscle: muscle.muscle,
        factor: Number(muscle.factor),
        role: muscle.role,
      })),
      instructions: row.instructions,
      active: row.active,
    }));

    writeStoredExercises(storageKeyForUser(professionalId), exercises);
    return exercises;
  }

  async saveCustom(exercise: LibraryExercise) {
    const professionalId = await this.authenticatedUserId();
    await this.localFor(professionalId).saveCustom(exercise);
    if (!professionalId) return;

    try {
      await this.saveRemote(exercise, professionalId);
    } catch (error) {
      console.warn(
        "O exercício foi salvo neste dispositivo, mas ainda não sincronizou.",
        error,
      );
    }
  }

  async archiveCustom(id: number) {
    const professionalId = await this.authenticatedUserId();
    await this.localFor(professionalId).archiveCustom(id);
    if (!professionalId) return;

    const { error } = await this.client
      .from("custom_exercises")
      .update({ active: false })
      .eq("id", id)
      .eq("professional_id", professionalId);
    if (error) console.warn("O arquivamento ainda não sincronizou.", error);
  }

  async restoreCustom(id: number) {
    const professionalId = await this.authenticatedUserId();
    await this.localFor(professionalId).restoreCustom(id);
    if (!professionalId) return;

    const { error } = await this.client
      .from("custom_exercises")
      .update({ active: true })
      .eq("id", id)
      .eq("professional_id", professionalId);
    if (error) console.warn("A restauração ainda não sincronizou.", error);
  }
}

export const exerciseRepository: ExerciseRepository =
  new SupabaseExerciseRepository();
