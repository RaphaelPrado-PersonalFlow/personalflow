"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type AdvancedMethod = "Convencional" | "Drop-set" | "Rest-pause" | "Cluster set" | "Pirâmide" | "Myo-reps" | "Bi-set";
type ItemStatus = "pending" | "completed" | "assumed_completed" | "partial" | "skipped";
type MiniBlock = { reps: number; load: string; rir: number | null; status: "pending" | "completed" | "skipped" };
type Series = { id?: string; method: AdvancedMethod; reps: string; load: string; blocks?: number[]; blockLoads?: string[]; actualBlocks?: MiniBlock[]; executionStatus?: ItemStatus; actualRir?: number | null; isRemoved?: boolean };
type Exercise = { id: string; name: string; prescription: string; load: string; rest?: string; executionStatus?: ItemStatus; notes?: string | null; changed?: boolean; seriesConfigurations?: Series[] };
type Props = {
  student: string; workoutName: string; focus: string; exercises: Exercise[]; completedIds: string[]; sessionNotes?: string | null;
  persistenceError?: string; isSaving?: boolean; isCompleting?: boolean; swappingExerciseId: string | null;
  compatibleNames: (exercise: Exercise) => string[]; onClose: () => void; onToggleComplete: (id: string) => Promise<boolean>;
  onAdjustLoad: (id: string, delta: -2.5 | 2.5, seriesIndex?: number) => void;
  onAdjustRepetitions: (id: string, delta: -1 | 1, seriesIndex: number) => void;
  onUpdateSeriesStatus: (id: string, seriesIndex: number, status: ItemStatus) => Promise<boolean>;
  onUpdateExerciseStatus: (id: string, status: ItemStatus) => Promise<boolean>;
  onUpdateSeriesEffort: (id: string, seriesIndex: number, value: string) => void;
  onUpdateSeriesMethod: (id: string, seriesIndex: number, method: AdvancedMethod) => void;
  onUpdateSeriesBlock: (id: string, seriesIndex: number, blockIndex: number, update: Partial<MiniBlock>) => void;
  onChangeSeriesBlockCount: (id: string, seriesIndex: number, direction: -1 | 1) => void;
  onUpdateExerciseNotes: (id: string, notes: string) => void; onUpdateSessionNotes: (notes: string) => void;
  onChangeSeries: (id: string, direction: -1 | 1) => void; onToggleSwap: (id: string) => void;
  onUpdateExercise: (id: string, field: "name" | "load", value: string) => void; onFinish: () => void;
};

const methods: AdvancedMethod[] = ["Convencional", "Drop-set", "Rest-pause", "Cluster set", "Pirâmide", "Myo-reps", "Bi-set"];
const configurations = (exercise: Exercise): Series[] => exercise.seriesConfigurations?.length ? exercise.seriesConfigurations : [{ method: "Convencional", reps: exercise.prescription.split("×")[1]?.trim() || "10", load: exercise.load }];
const formatLoad = (value: string, delta: number) => {
  const current = Number(value.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  const next = Math.max(0, current + delta);
  return `${Number.isInteger(next) ? next : next.toFixed(1).replace(".", ",")} kg`;
};
const blocksFor = (set: Series) => set.actualBlocks ?? set.blocks?.map((reps, index) => ({ reps, load: set.blockLoads?.[index] ?? set.load, rir: set.actualRir ?? null, status: "pending" as const })) ?? [];

function Counter({ value, onDecrease, onIncrease, compact = false }: { value: string | number; onDecrease: () => void; onIncrease: () => void; compact?: boolean }) {
  return <div className={`grid min-w-0 items-center ${compact ? "grid-cols-[38px_minmax(34px,1fr)_38px] gap-0.5" : "grid-cols-[44px_minmax(42px,1fr)_44px] gap-1"}`}>
    <button type="button" onClick={onDecrease} className={`grid shrink-0 place-items-center rounded-lg bg-[var(--surface-raised)] text-lg active:scale-95 ${compact ? "size-[38px]" : "size-11"}`}>−</button>
    <span className="min-w-0 truncate text-center text-sm font-medium">{value}</span>
    <button type="button" onClick={onIncrease} className={`grid shrink-0 place-items-center rounded-lg bg-[var(--surface-raised)] text-lg active:scale-95 ${compact ? "size-[38px]" : "size-11"}`}>+</button>
  </div>;
}

export default function SessionPanel(props: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const collapse = (id: string) => setExpanded((current) => current.filter((item) => item !== id));
  const requestComplete = async (exercise: Exercise) => {
    const pending = configurations(exercise).filter((set) => !set.isRemoved && !["completed", "assumed_completed", "skipped"].includes(set.executionStatus ?? "pending"));
    if (pending.length) {
      setConfirming(exercise.id);
      return;
    }
    const finishing = !props.completedIds.includes(exercise.id);
    if (await props.onToggleComplete(exercise.id) && finishing) collapse(exercise.id);
  };
  const confirmCompletion = async (exercise: Exercise, status: "completed" | "partial", completePending = false) => {
    const series = configurations(exercise).filter((set) => !set.isRemoved);
    if (completePending) {
      const savedSets = await Promise.all(series.map((_, setIndex) => props.onUpdateSeriesStatus(exercise.id, setIndex, "completed")));
      if (savedSets.some((saved) => !saved)) return;
    }
    if (await props.onUpdateExerciseStatus(exercise.id, status)) {
      setConfirming(null);
      collapse(exercise.id);
    }
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80" role="dialog" aria-modal="true" aria-labelledby="session-title">
    <button type="button" className="hidden flex-1 sm:block" onClick={props.onClose} aria-label="Fechar sessão" />
    <aside className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <header className="flex items-start justify-between border-b border-[var(--border)] p-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Sessão em andamento</p><h2 id="session-title" className="mt-1 text-xl font-semibold">{props.student} · {props.workoutName}</h2><p className="mt-1 text-sm text-[var(--muted)]">{props.focus}</p></div><button type="button" onClick={props.onClose} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {props.exercises.map((exercise, index) => {
          const done = props.completedIds.includes(exercise.id);
          const isPartial = exercise.executionStatus === "partial";
          const isFinished = done || isPartial;
          const completionLabel = isPartial ? "Parcial" : done ? "Concluído" : "Concluir";
          const completionTone = isFinished ? "bg-emerald-500 text-white" : "border border-emerald-500/35 text-emerald-600";
          const series = configurations(exercise).filter((set) => !set.isRemoved);
          const isExpanded = expanded.includes(exercise.id);
          return <article key={exercise.id} className={`overflow-hidden rounded-xl border ${isFinished ? "border-emerald-500/45 bg-emerald-500/10" : "border-[var(--border)] bg-[var(--background)]"}`}>
            <div className="flex items-center gap-2 p-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${isFinished ? "bg-emerald-500 text-white" : "bg-[var(--surface-raised)]"}`}>{isFinished ? "✓" : index + 1}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{exercise.name}</strong><span className="block truncate text-xs text-[var(--muted)]">{[exercise.prescription, exercise.load, exercise.rest].filter(Boolean).join(" · ")}</span></div><button type="button" onClick={() => requestComplete(exercise)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${completionTone}`}>{completionLabel}</button><button type="button" onClick={() => toggle(exercise.id)} className="grid size-8 place-items-center rounded-lg border border-[var(--border)]" aria-label={isExpanded ? "Recolher exercício" : "Expandir exercício"}>{isExpanded ? "⌃" : "⌄"}</button></div>
            {isExpanded && <div className="border-t border-[var(--border)] p-2">{series.map((set, setIndex) => {
              const blocks = blocksFor(set);
              return <div key={set.id ?? setIndex} className="border-b border-[var(--border)] py-2 last:border-0">
                <div className={`grid items-center gap-2 text-xs ${blocks.length ? "grid-cols-[28px_minmax(0,1fr)_40px]" : "grid-cols-[28px_minmax(86px,0.9fr)_minmax(0,1.6fr)_40px] sm:grid-cols-[30px_minmax(120px,1fr)_1fr_40px]"}`}><strong>S{setIndex + 1}</strong><select value={set.method} onChange={(event) => props.onUpdateSeriesMethod(exercise.id, setIndex, event.target.value as AdvancedMethod)} className="h-10 min-w-0 truncate rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs">{methods.map((method) => <option key={method}>{method}</option>)}</select>{!blocks.length && <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2"><Counter value={set.reps} onDecrease={() => props.onAdjustRepetitions(exercise.id, -1, setIndex)} onIncrease={() => props.onAdjustRepetitions(exercise.id, 1, setIndex)} /><Counter value={set.load} onDecrease={() => props.onAdjustLoad(exercise.id, -2.5, setIndex)} onIncrease={() => props.onAdjustLoad(exercise.id, 2.5, setIndex)} /></div>}<button type="button" onClick={() => props.onUpdateSeriesStatus(exercise.id, setIndex, set.executionStatus === "completed" ? "pending" : "completed")} className={`grid size-10 place-items-center rounded-lg text-base font-semibold ${set.executionStatus === "completed" ? "bg-emerald-500 text-white" : "bg-emerald-500/15 text-emerald-700"}`}>✓</button></div>
                {blocks.length > 0 && <div className="ml-7 mt-1 space-y-1 border-l-2 border-violet-400/40 pl-2"><div className="flex justify-end gap-1"><button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-[10px]" onClick={() => props.onChangeSeriesBlockCount(exercise.id, setIndex, -1)} disabled={blocks.length <= 2}>− Bloco</button><button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-[10px]" onClick={() => props.onChangeSeriesBlockCount(exercise.id, setIndex, 1)}>+ Bloco</button></div>{blocks.map((block, blockIndex) => <div key={blockIndex} className="grid grid-cols-[48px_minmax(0,1fr)_32px_40px] items-center gap-1.5 rounded bg-violet-500/5 px-2 py-1.5 text-xs sm:grid-cols-[58px_minmax(0,1fr)_32px_40px] sm:gap-2"><span className="truncate text-violet-700">B{blockIndex + 1}</span><div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2"><Counter compact value={block.reps} onDecrease={() => props.onUpdateSeriesBlock(exercise.id, setIndex, blockIndex, { reps: Math.max(1, block.reps - 1) })} onIncrease={() => props.onUpdateSeriesBlock(exercise.id, setIndex, blockIndex, { reps: block.reps + 1 })} /><Counter compact value={block.load} onDecrease={() => props.onUpdateSeriesBlock(exercise.id, setIndex, blockIndex, { load: formatLoad(block.load, -2.5) })} onIncrease={() => props.onUpdateSeriesBlock(exercise.id, setIndex, blockIndex, { load: formatLoad(block.load, 2.5) })} /></div><button type="button" onClick={() => props.onUpdateSeriesBlock(exercise.id, setIndex, blockIndex, { status: block.status === "skipped" ? "pending" : "skipped" })} className={`grid size-8 place-items-center rounded text-xs ${block.status === "skipped" ? "bg-amber-500/25 text-amber-800" : "text-[var(--muted)]"}`} aria-label={`Pular bloco ${blockIndex + 1}`}>↷</button><button type="button" onClick={() => props.onUpdateSeriesBlock(exercise.id, setIndex, blockIndex, { status: block.status === "completed" ? "pending" : "completed" })} className={`grid size-10 place-items-center rounded-lg text-base ${block.status === "completed" ? "bg-emerald-500 text-white" : "bg-emerald-500/15 text-emerald-700"}`}>✓</button></div>)}</div>}
                <span className="ml-7 mt-1 block text-[10px] text-[var(--muted)]">{exercise.rest ?? "Descanso prescrito"}</span>
              </div>;
            })}<div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => props.onChangeSeries(exercise.id, -1)} disabled={series.length === 1} className="rounded border border-[var(--border)] px-2 py-1 text-xs">− Série</button><button type="button" onClick={() => props.onChangeSeries(exercise.id, 1)} className="rounded border border-[var(--border)] px-2 py-1 text-xs">+ Série</button><button type="button" onClick={() => props.onToggleSwap(exercise.id)} className="ml-auto rounded border border-blue-500/30 px-2 py-1 text-xs text-blue-600">Trocar exercício</button><button type="button" onClick={() => requestComplete(exercise)} className={`rounded px-2 py-1 text-xs font-semibold ${completionTone}`}>{completionLabel}</button></div>{props.swappingExerciseId === exercise.id && <div className="mt-2 grid gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 sm:grid-cols-2"><label className="text-xs">Exercício<select value={exercise.name} onChange={(event) => props.onUpdateExercise(exercise.id, "name", event.target.value)} className="mt-1 h-10 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-base">{props.compatibleNames(exercise).map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-xs">Carga<input value={exercise.load} onChange={(event) => props.onUpdateExercise(exercise.id, "load", event.target.value)} className="mt-1 h-10 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-base" /></label></div>}</div>}
            {confirming === exercise.id && <div className="border-t border-amber-500/25 bg-amber-500/10 p-3 text-sm"><p>Existem séries ainda não confirmadas. Como deseja concluir?</p><div className="mt-2 flex flex-wrap gap-2"><Button onClick={() => confirmCompletion(exercise, "completed", true)}>Concluir todas</Button><Button variant="secondary" onClick={() => confirmCompletion(exercise, "partial")}>Manter confirmadas</Button><Button variant="ghost" onClick={() => setConfirming(null)}>Cancelar</Button></div></div>}
          </article>;
        })}
      </div>
      <footer className="border-t border-[var(--border)] p-4"><label className="mb-3 block text-xs text-[var(--muted)]">Observações da sessão<textarea value={props.sessionNotes ?? ""} onChange={(event) => props.onUpdateSessionNotes(event.target.value)} className="mt-1 min-h-14 w-full rounded border border-[var(--border)] bg-[var(--background)] p-2 text-base" /></label>{props.persistenceError && <p role="alert" className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600">{props.persistenceError}</p>}<Button className="w-full" disabled={props.isSaving || props.isCompleting} onClick={props.onFinish}>{props.isCompleting ? "Finalizando…" : "Finalizar sessão"}</Button></footer>
    </aside>
  </div>;
}
