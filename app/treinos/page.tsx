"use client";

import { FormEvent, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

type Exercise = { id: number; name: string; prescription: string; load: string };
type MuscleVolume = { muscle: string; sets: number };
type Workout = { id: number; name: string; focus: string; duration: number; exercises: Exercise[]; volume: MuscleVolume[] };
type Protocol = {
  id: number;
  student: string;
  objective: string;
  frequency: number;
  status: "Ativo" | "Programado" | "Rascunho";
  start: string;
  end: string;
  workouts: Workout[];
};

const initialProtocols: Protocol[] = [
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

export default function WorkoutsPage() {
  const [protocols, setProtocols] = useState(initialProtocols);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [expanded, setExpanded] = useState<number[]>([1]);
  const [expandedWorkouts, setExpandedWorkouts] = useState<number[]>([]);
  const [newProtocolOpen, setNewProtocolOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ protocol: Protocol; workout: Workout } | null>(null);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);

  const filteredProtocols = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    return protocols.filter((protocol) =>
      (status === "Todos" || protocol.status === status) &&
      (protocol.student.toLocaleLowerCase("pt-BR").includes(normalized) || protocol.objective.toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [protocols, query, status]);

  function toggleProtocol(id: number) {
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleWorkout(id: number) {
    setExpandedWorkouts((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
    setExpanded((current) => [protocol.id, ...current]);
    setNewProtocolOpen(false);
    event.currentTarget.reset();
  }

  function startSession(protocol: Protocol, workout: Workout) {
    setCompletedExercises([]);
    setActiveSession({ protocol, workout });
  }

  function toggleExercise(id: number) {
    setCompletedExercises((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const activeCount = protocols.filter((protocol) => protocol.status === "Ativo").length;
  const workoutCount = protocols.reduce((total, protocol) => total + protocol.workouts.length, 0);

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader title="Treinos" description="Crie protocolos, prescreva treinos e acompanhe cada sessão." action={<Button onClick={() => setNewProtocolOpen(true)}>＋ Novo protocolo</Button>} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Protocolos ativos" value={activeCount} detail={`${protocols.length} protocolos cadastrados`} tone="blue" />
          <StatCard title="Treinos prescritos" value={workoutCount} detail="Nos protocolos atuais" tone="green" />
          <StatCard title="Sessões hoje" value={7} detail="2 já concluídas" tone="violet" />
          <StatCard title="Fichas para revisar" value={2} detail="Nos próximos 7 dias" tone="amber" />
        </section>

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative block w-full md:max-w-md"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno ou objetivo" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 text-sm outline-none focus:border-blue-500" /></label>
            <div className="flex gap-2 overflow-x-auto">{["Todos", "Ativo", "Programado", "Rascunho"].map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${status === item ? "bg-blue-600 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{item}</button>)}</div>
          </div>
        </Card>

        <section className="space-y-4">
          {filteredProtocols.map((protocol) => {
            const isExpanded = expanded.includes(protocol.id);
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
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{protocol.student}</h2><Badge tone={protocol.status === "Ativo" ? "success" : protocol.status === "Programado" ? "info" : "neutral"}>{protocol.status}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">{protocol.objective} · {protocol.frequency}× por semana · {protocol.start} a {protocol.end}</p></div>
                <div className="hidden text-right sm:block"><p className="text-2xl font-semibold">{protocol.workouts.length}</p><p className="text-xs text-[var(--muted)]">treinos</p></div>
                <button type="button" onClick={() => toggleProtocol(protocol.id)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Recolher" : "Expandir"} protocolo de ${protocol.student}`}><span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span></button>
              </div>

              {isExpanded && <div className="border-t border-[var(--border)] p-4 sm:p-5">
                {protocol.workouts.length ? <div className="space-y-3">{protocol.workouts.map((workout) => {
                  const workoutExpanded = expandedWorkouts.includes(workout.id);
                  const maximumVolume = Math.max(...workout.volume.map((item) => item.sets), 1);
                  return <div key={workout.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center gap-3 p-4">
                      <button type="button" onClick={() => toggleWorkout(workout.id)} className="min-w-0 flex-1 text-left" aria-expanded={workoutExpanded}>
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{workout.name}</h3><Badge tone="neutral">{workout.duration} min</Badge></div>
                        <p className="mt-1 text-sm text-[var(--muted)]">{workout.focus} · {workout.exercises.length} exercícios</p>
                      </button>
                      <button type="button" onClick={() => startSession(protocol, workout)} className="hidden whitespace-nowrap text-sm font-semibold text-blue-500 hover:text-blue-400 sm:block">Iniciar sessão →</button>
                      <button type="button" onClick={() => toggleWorkout(workout.id)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" aria-label={`${workoutExpanded ? "Recolher" : "Expandir"} ${workout.name}`}><span className={`transition-transform ${workoutExpanded ? "rotate-180" : ""}`}>⌄</span></button>
                    </div>

                    {workoutExpanded && <div className="grid gap-5 border-t border-[var(--border)] p-4 lg:grid-cols-[1fr_1.2fr]">
                      <div><h4 className="text-sm font-semibold">Exercícios prescritos</h4><div className="mt-3 space-y-2">{workout.exercises.map((exercise, index) => <div key={exercise.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{exercise.name}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{exercise.prescription} · {exercise.load}</p></div></div>)}</div></div>
                      <div><div className="flex items-end justify-between gap-3"><div><h4 className="text-sm font-semibold">Volume por grupo muscular</h4><p className="mt-1 text-xs text-[var(--muted)]">Séries equivalentes neste treino</p></div><Badge tone="info">{workout.volume.reduce((total, item) => total + item.sets, 0).toLocaleString("pt-BR")} séries</Badge></div><div className="mt-4 space-y-3">{workout.volume.map((item) => <div key={item.muscle}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-medium">{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")} séries</strong></div><div className="h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${item.sets / maximumVolume * 100}%` }} /></div></div>)}</div><p className="mt-4 text-xs text-[var(--muted)]">O cálculo considera séries diretas e a participação ponderada dos músculos secundários.</p></div>
                      <Button className="w-full lg:col-span-2 sm:hidden" onClick={() => startSession(protocol, workout)}>Iniciar sessão</Button>
                    </div>}
                  </div>;
                })}</div> : <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center"><p className="font-semibold">Nenhum treino criado</p><p className="mt-1 text-sm text-[var(--muted)]">Adicione o primeiro treino deste protocolo.</p></div>}
                {protocolVolume.length > 0 && <div className="mt-5 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Visão macro</p><h3 className="mt-1 font-semibold">Volume total do protocolo</h3><p className="mt-1 text-sm text-[var(--muted)]">Soma dos grupos musculares presentes em todos os treinos</p></div><div className="rounded-xl border border-blue-500/20 bg-[var(--background)] px-4 py-2 text-right"><p className="text-2xl font-semibold text-blue-500">{totalProtocolVolume.toLocaleString("pt-BR")}</p><p className="text-xs text-[var(--muted)]">séries equivalentes</p></div></div>
                  <div className="mt-5 grid gap-x-8 gap-y-4 lg:grid-cols-2">{protocolVolume.map((item) => <div key={item.muscle}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")} séries</strong></div><div className="h-3.5 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400" style={{ width: `${item.sets / maximumProtocolVolume * 100}%` }} /></div></div>)}</div>
                  <p className="mt-5 border-t border-blue-500/15 pt-4 text-xs text-[var(--muted)]">A visão macro considera todos os treinos uma vez. A projeção semanal será calculada posteriormente conforme a frequência planejada de cada treino.</p>
                </div>}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="secondary">Duplicar protocolo</Button><Button>{protocol.workouts.length ? "Editar prescrição" : "＋ Adicionar treino"}</Button></div>
              </div>}
            </Card>;
          })}
        </section>
      </div>

      {newProtocolOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="new-protocol-title"><form onSubmit={addProtocol} className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="new-protocol-title" className="text-xl font-semibold">Novo protocolo</h2><p className="mt-1 text-sm text-[var(--muted)]">Defina o planejamento inicial do aluno.</p></div><button type="button" onClick={() => setNewProtocolOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Aluno<select name="student" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{students.map((student) => <option key={student}>{student}</option>)}</select></label><label className="text-sm font-medium sm:col-span-2">Objetivo principal<select name="objective" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Hipertrofia</option><option>Emagrecimento</option><option>Força</option><option>Condicionamento</option><option>Qualidade de vida</option></select></label><label className="text-sm font-medium">Frequência semanal<select name="frequency" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{[1, 2, 3, 4, 5, 6, 7].map((number) => <option key={number} value={number}>{number}× por semana</option>)}</select></label><span /><label className="text-sm font-medium">Data de início<input required name="start" type="date" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-sm font-medium">Previsão de término<input required name="end" type="date" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label></div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setNewProtocolOpen(false)}>Cancelar</Button><Button type="submit">Criar protocolo</Button></div></form></div>}

      {activeSession && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80" role="dialog" aria-modal="true" aria-labelledby="session-title"><button type="button" className="hidden flex-1 sm:block" onClick={() => setActiveSession(null)} aria-label="Fechar sessão" /><aside className="flex h-full w-full max-w-xl flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"><div className="flex items-start justify-between border-b border-[var(--border)] p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Sessão em andamento</p><h2 id="session-title" className="mt-1 text-xl font-semibold">{activeSession.protocol.student} · {activeSession.workout.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{activeSession.workout.focus}</p></div><button type="button" onClick={() => setActiveSession(null)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">{activeSession.workout.exercises.map((exercise, index) => { const done = completedExercises.includes(exercise.id); return <button key={exercise.id} type="button" onClick={() => toggleExercise(exercise.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${done ? "border-emerald-500/40 bg-emerald-500/10" : "border-[var(--border)] bg-[var(--background)] hover:border-blue-500/50"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-emerald-500 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{done ? "✓" : index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate">{exercise.name}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{exercise.prescription} · {exercise.load}</span></span><span className="text-xs font-semibold text-[var(--muted)]">{done ? "Concluído" : "Concluir"}</span></button>; })}</div><div className="border-t border-[var(--border)] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Progresso da sessão</span><strong>{completedExercises.length}/{activeSession.workout.exercises.length}</strong></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completedExercises.length / activeSession.workout.exercises.length * 100}%` }} /></div><Button className="w-full" disabled={completedExercises.length === 0} onClick={() => setActiveSession(null)}>Finalizar sessão</Button></div></aside></div>}
    </MainLayout>
  );
}
