"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type AdvancedMethod = "Convencional" | "Drop-set" | "Rest-pause" | "Cluster set" | "Pirâmide" | "Myo-reps" | "Bi-set";
type ItemStatus = "pending" | "completed" | "assumed_completed" | "partial" | "skipped";
type Series = { id?: string; method: AdvancedMethod; reps: string; load: string; blocks?: number[]; executionStatus?: ItemStatus; actualRir?: number | null; actualRpe?: number | null; notes?: string | null; isRemoved?: boolean };
type Exercise = { id: string; name: string; prescription: string; load: string; executionStatus?: ItemStatus; notes?: string | null; changed?: boolean; seriesConfigurations?: Series[] };
type Props = {
  student: string; workoutName: string; focus: string; exercises: Exercise[]; completedIds: string[];
  sessionNotes?: string | null;
  persistenceError?: string; isSaving?: boolean; isCompleting?: boolean;
  swappingExerciseId: string | null; compatibleNames: (exercise: Exercise) => string[];
  onClose: () => void; onToggleComplete: (id: string) => void;
  onAdjustLoad: (id: string, delta: -2.5 | 2.5, seriesIndex?: number) => void;
  onAdjustRepetitions: (id: string, delta: -1 | 1, seriesIndex: number) => void;
  onUpdateSeriesStatus: (id: string, seriesIndex: number, status: ItemStatus) => void;
  onUpdateExerciseStatus: (id: string, status: ItemStatus) => void;
  onUpdateSeriesEffort: (id: string, seriesIndex: number, value: string) => void;
  onUpdateSeriesMethod: (id: string, seriesIndex: number, method: AdvancedMethod) => void;
  onUpdateExerciseNotes: (id: string, notes: string) => void;
  onUpdateSessionNotes: (notes: string) => void;
  onChangeSeries: (id: string, direction: -1 | 1) => void; onToggleSwap: (id: string) => void;
  onUpdateExercise: (id: string, field: "name" | "load", value: string) => void; onFinish: () => void;
};

function configurations(exercise: Exercise): Series[] {
  return exercise.seriesConfigurations?.length ? exercise.seriesConfigurations : [{ method: "Convencional", reps: exercise.prescription.split("×")[1]?.trim() || "8–12", load: exercise.load }];
}

function label(series: Series, index: number) {
  const method = series.method === "Convencional" ? "" : `${series.method} `;
  return `S${index + 1}: ${method}${series.blocks?.join("+") || series.reps}`;
}

export default function SessionPanel(props: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80" role="dialog" aria-modal="true" aria-labelledby="session-title">
    <button type="button" className="hidden flex-1 sm:block" onClick={props.onClose} aria-label="Fechar sessão" />
    <aside className="flex h-full w-full max-w-xl flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <header className="flex items-start justify-between border-b border-[var(--border)] p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Sessão em andamento</p><h2 id="session-title" className="mt-1 text-xl font-semibold">{props.student} · {props.workoutName}</h2><p className="mt-1 text-sm text-[var(--muted)]">{props.focus}</p></div><button type="button" onClick={props.onClose} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {props.exercises.map((exercise, index) => {
          const done = props.completedIds.includes(exercise.id);
          const series = configurations(exercise);
          const isExpanded = expanded.includes(exercise.id);
          return <article key={exercise.id} className={`rounded-2xl border p-4 ${done ? "border-emerald-500/40 bg-emerald-500/10" : exercise.changed ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--border)] bg-[var(--background)]"}`}>
            <div className="flex items-start gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-emerald-500 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{done ? "✓" : index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <strong className="min-w-0 flex-1 break-words leading-5">{exercise.name}</strong>
                  {exercise.changed && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Alterado</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-[var(--muted)]">{exercise.prescription} · {exercise.load}</span>
                  <button type="button" onClick={() => toggle(exercise.id)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)]" aria-label={`${isExpanded ? "Recolher" : "Expandir"} séries de ${exercise.name}`} aria-expanded={isExpanded}><span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span></button>
                  <button type="button" onClick={() => props.onToggleComplete(exercise.id)} className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${done ? "text-emerald-600" : "text-blue-500"}`}>{done ? "Concluído" : "Concluir"}</button>
                </div>
              </div>
            </div>

            {isExpanded && <div className="mt-3 border-t border-[var(--border)] pt-3"><div className="space-y-2">{series.filter((item) => !item.isRemoved).map((item, seriesIndex) => <div key={item.id ?? seriesIndex} className="rounded-xl bg-[var(--surface)] p-3"><div className="flex justify-between gap-2"><strong className="text-xs">{label(item, seriesIndex)}</strong><span className="text-[10px] text-[var(--muted)]">{item.executionStatus === "skipped" ? "Pulada" : item.executionStatus === "partial" ? "Parcial" : item.executionStatus === "completed" ? "Concluída" : "Ajustes desta série"}</span></div><div className="mt-2 grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1.5"><button type="button" onClick={() => props.onAdjustRepetitions(exercise.id, -1, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">−</button><span className="text-center text-xs"><strong className="block">{item.reps}</strong><span className="text-[9px] text-[var(--muted)]">repetições</span></span><button type="button" onClick={() => props.onAdjustRepetitions(exercise.id, 1, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">＋</button></div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1.5"><button type="button" onClick={() => props.onAdjustLoad(exercise.id, -2.5, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">−</button><span className="text-center text-xs"><strong className="block">{item.load}</strong><span className="text-[9px] text-[var(--muted)]">carga</span></span><button type="button" onClick={() => props.onAdjustLoad(exercise.id, 2.5, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">＋</button></div>
            </div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-[var(--muted)]">Método<select value={item.method} onChange={(event) => props.onUpdateSeriesMethod(exercise.id, seriesIndex, event.target.value as AdvancedMethod)} className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs">{["Convencional", "Drop-set", "Rest-pause", "Cluster set", "Pirâmide", "Myo-reps", "Bi-set"].map((method) => <option key={method}>{method}</option>)}</select></label><label className="text-[10px] text-[var(--muted)]">RIR<input inputMode="decimal" defaultValue={item.actualRir ?? ""} onBlur={(event) => props.onUpdateSeriesEffort(exercise.id, seriesIndex, event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs" /></label></div><div className="mt-2 flex gap-1"><button type="button" onClick={() => props.onUpdateSeriesStatus(exercise.id, seriesIndex, "completed")} className="rounded-md border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-600">Concluída</button><button type="button" onClick={() => props.onUpdateSeriesStatus(exercise.id, seriesIndex, "partial")} className="rounded-md border border-amber-500/30 px-2 py-1 text-[10px] font-semibold text-amber-600">Parcial</button><button type="button" onClick={() => props.onUpdateSeriesStatus(exercise.id, seriesIndex, "skipped")} className="rounded-md border border-slate-500/30 px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">Pular</button></div></div>)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => props.onChangeSeries(exercise.id, -1)} disabled={series.length === 1} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-30">− Série</button><span className="text-xs font-semibold text-[var(--muted)]">{series.length} {series.length === 1 ? "série" : "séries"}</span><button type="button" onClick={() => props.onChangeSeries(exercise.id, 1)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">＋ Série</button><button type="button" onClick={() => props.onToggleSwap(exercise.id)} className="ml-auto rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-500">Trocar exercício</button></div>
              <div className="mt-2 flex gap-1"><button type="button" onClick={() => props.onUpdateExerciseStatus(exercise.id, "completed")} className="rounded-md border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-600">Exercício concluído</button><button type="button" onClick={() => props.onUpdateExerciseStatus(exercise.id, "partial")} className="rounded-md border border-amber-500/30 px-2 py-1 text-[10px] font-semibold text-amber-600">Parcial</button><button type="button" onClick={() => props.onUpdateExerciseStatus(exercise.id, "skipped")} className="rounded-md border border-slate-500/30 px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">Pular</button></div>
              {props.swappingExerciseId === exercise.id && <div className="mt-3 grid gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 sm:grid-cols-2"><label className="text-xs text-[var(--muted)]">Exercício compatível<select value={exercise.name} onChange={(event) => props.onUpdateExercise(exercise.id, "name", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">{props.compatibleNames(exercise).map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Carga executada<input value={exercise.load} onChange={(event) => props.onUpdateExercise(exercise.id, "load", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /></label></div>}
              <label className="mt-3 block text-xs text-[var(--muted)]">Observação do exercício<textarea defaultValue={exercise.notes ?? ""} onBlur={(event) => props.onUpdateExerciseNotes(exercise.id, event.target.value)} className="mt-1.5 min-h-16 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm" /></label>
            </div>}
          </article>;
        })}
      </div>

      <footer className="border-t border-[var(--border)] p-4 sm:p-5"><label className="mb-3 block text-xs text-[var(--muted)]">Observações da sessão<textarea defaultValue={props.sessionNotes ?? ""} onBlur={(event) => props.onUpdateSessionNotes(event.target.value)} className="mt-1.5 min-h-14 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-sm" /></label>{props.persistenceError && <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-600">{props.persistenceError}</p>}<div className="mb-3 flex justify-between text-sm"><span className="text-[var(--muted)]">{props.isSaving ? "Salvando alterações…" : "Progresso da sessão"}</span><strong>{props.completedIds.length}/{props.exercises.length}</strong></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${props.exercises.length ? props.completedIds.length / props.exercises.length * 100 : 0}%` }} /></div><Button className="w-full" disabled={props.isSaving || props.isCompleting} onClick={props.onFinish}>{props.isCompleting ? "Finalizando…" : "Finalizar sessão"}</Button></footer>
    </aside>
  </div>;
}
