"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type AdvancedMethod = "Convencional" | "Drop-set" | "Rest-pause" | "Cluster set" | "Pirâmide" | "Myo-reps" | "Bi-set";
type Series = { method: AdvancedMethod; reps: string; load: string; blocks?: number[] };
type Exercise = { id: number; name: string; prescription: string; load: string; changed?: boolean; seriesConfigurations?: Series[] };
type Props = {
  student: string; workoutName: string; focus: string; exercises: Exercise[]; completedIds: number[];
  swappingExerciseId: number | null; compatibleNames: (exercise: Exercise) => string[];
  onClose: () => void; onToggleComplete: (id: number) => void;
  onAdjustLoad: (id: number, delta: -2.5 | 2.5, seriesIndex?: number) => void;
  onAdjustRepetitions: (id: number, delta: -1 | 1, seriesIndex: number) => void;
  onChangeSeries: (id: number, direction: -1 | 1) => void; onToggleSwap: (id: number) => void;
  onUpdateExercise: (id: number, field: "name" | "load", value: string) => void; onFinish: () => void;
};

function configurations(exercise: Exercise): Series[] {
  return exercise.seriesConfigurations?.length ? exercise.seriesConfigurations : [{ method: "Convencional", reps: exercise.prescription.split("×")[1]?.trim() || "8–12", load: exercise.load }];
}

function label(series: Series, index: number) {
  const method = series.method === "Convencional" ? "" : `${series.method} `;
  return `S${index + 1}: ${method}${series.blocks?.join("+") || series.reps}`;
}

export default function SessionPanel(props: Props) {
  const [expanded, setExpanded] = useState<number[]>([]);
  const toggle = (id: number) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

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

            {isExpanded && <div className="mt-3 border-t border-[var(--border)] pt-3"><div className="space-y-2">{series.map((item, seriesIndex) => <div key={seriesIndex} className="rounded-xl bg-[var(--surface)] p-3"><div className="flex justify-between gap-2"><strong className="text-xs">{label(item, seriesIndex)}</strong><span className="text-[10px] text-[var(--muted)]">Ajustes desta série</span></div><div className="mt-2 grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1.5"><button type="button" onClick={() => props.onAdjustRepetitions(exercise.id, -1, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">−</button><span className="text-center text-xs"><strong className="block">{item.reps}</strong><span className="text-[9px] text-[var(--muted)]">repetições</span></span><button type="button" onClick={() => props.onAdjustRepetitions(exercise.id, 1, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">＋</button></div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1.5"><button type="button" onClick={() => props.onAdjustLoad(exercise.id, -2.5, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">−</button><span className="text-center text-xs"><strong className="block">{item.load}</strong><span className="text-[9px] text-[var(--muted)]">carga</span></span><button type="button" onClick={() => props.onAdjustLoad(exercise.id, 2.5, seriesIndex)} className="grid size-7 place-items-center rounded-md bg-[var(--surface-raised)] font-bold">＋</button></div>
            </div></div>)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => props.onChangeSeries(exercise.id, -1)} disabled={series.length === 1} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-30">− Série</button><span className="text-xs font-semibold text-[var(--muted)]">{series.length} {series.length === 1 ? "série" : "séries"}</span><button type="button" onClick={() => props.onChangeSeries(exercise.id, 1)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">＋ Série</button><button type="button" onClick={() => props.onToggleSwap(exercise.id)} className="ml-auto rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-500">Trocar exercício</button></div>
              {props.swappingExerciseId === exercise.id && <div className="mt-3 grid gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 sm:grid-cols-2"><label className="text-xs text-[var(--muted)]">Exercício compatível<select value={exercise.name} onChange={(event) => props.onUpdateExercise(exercise.id, "name", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">{props.compatibleNames(exercise).map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-xs text-[var(--muted)]">Carga executada<input value={exercise.load} onChange={(event) => props.onUpdateExercise(exercise.id, "load", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /></label></div>}
            </div>}
          </article>;
        })}
      </div>

      <footer className="border-t border-[var(--border)] p-4 sm:p-5"><div className="mb-3 flex justify-between text-sm"><span className="text-[var(--muted)]">Progresso da sessão</span><strong>{props.completedIds.length}/{props.exercises.length}</strong></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${props.exercises.length ? props.completedIds.length / props.exercises.length * 100 : 0}%` }} /></div><Button className="w-full" onClick={props.onFinish}>Finalizar sessão</Button></footer>
    </aside>
  </div>;
}
