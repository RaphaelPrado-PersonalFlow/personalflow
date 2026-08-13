"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import VolumeMetricToggle from "@/components/training/VolumeMetricToggle";
import { formatVolumeValue, volumeByMuscle, type VolumeMetric } from "@/lib/training-volume";
import { getTrainingProtocol, systemExerciseReferences } from "@/services/training";
import { exerciseRepository } from "@/services/exercise-repository";
import { listInProgressWorkoutSessions } from "@/services/training-sessions";
import type { ExerciseCatalogReference, Protocol } from "@/types/training";

type Props = { params: Promise<{ student: string; protocolId: string }> };

export default function OpenProtocolPage({ params }: Props) {
  const router = useRouter();
  const { student: studentId, protocolId } = use(params);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<string[]>([]);
  const [activePeriod, setActivePeriod] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadedContext, setLoadedContext] = useState("");
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>("series");
  const [inProgressSessions, setInProgressSessions] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all([getTrainingProtocol(protocolId), exerciseRepository.listCustom()]).then(([row, customExercises]) => {
    if (cancelled) return;
    if (row.studentId !== studentId) {
      setLoadError("Este protocolo não pertence ao aluno informado na URL.");
      setLoadedContext(`${studentId}:${protocolId}`);
      return;
    }
    const fullCatalog: ExerciseCatalogReference[] = [...customExercises.map((exercise) => ({ id: exercise.id, source: "custom" as const, name: exercise.name, aliases: exercise.aliases, muscles: exercise.muscles })), ...systemExerciseReferences()];
    const periods = row.periods.map((period) => ({ ...period, workouts: period.workouts.map((workout) => ({ ...workout, volume: workout.exercises.reduce<{ muscle: string; sets: number }[]>((totals, exercise) => {
      const reference = fullCatalog.find((item) => item.name === exercise.name);
      reference?.muscles.forEach((muscle) => { const current = totals.find((item) => item.muscle === muscle.muscle); const sets = (exercise.sets ?? 0) * muscle.factor; if (current) current.sets += sets; else totals.push({ muscle: muscle.muscle, sets }); }); return totals;
    }, []) })) }));
    const current = periods.find((item) => item.id === row.activePeriodId) ?? periods[0];
    setProtocol({ ...row, periods, workouts: current?.workouts ?? [] }); setActivePeriod(current?.id ?? "");
    void listInProgressWorkoutSessions(periods.flatMap((period) => period.workouts.map((workout) => workout.id)))
      .then((sessions) => { if (!cancelled) setInProgressSessions(sessions); })
      .catch(() => { if (!cancelled) setInProgressSessions({}); });
    setLoadError("");
    setLoadedContext(`${studentId}:${protocolId}`);
  }).catch(() => { if (!cancelled) { setLoadError("Não foi possível carregar este protocolo."); setLoadedContext(`${studentId}:${protocolId}`); } });
    return () => { cancelled = true; };
  }, [protocolId, studentId]);

  const selectedPeriod = protocol?.periods.find((item) => item.id === activePeriod);
  const workouts = useMemo(() => selectedPeriod?.workouts ?? [], [selectedPeriod]);
  const macroVolume = useMemo(() => volumeByMuscle(workouts, volumeMetric), [volumeMetric, workouts]);
  const editorUrl = (workoutId?: string) => `/treinos?aluno=${studentId}&editarProtocolo=${protocolId}&periodo=${activePeriod}${workoutId ? `&editarTreino=${workoutId}` : ""}`;
  const sessionUrl = (workoutId: string) => inProgressSessions[workoutId]
    ? `/treinos?sessao=${inProgressSessions[workoutId]}`
    : `/treinos?aluno=${studentId}&protocolo=${protocolId}&periodo=${activePeriod}&treinoId=${workoutId}`;
  if (loadedContext !== `${studentId}:${protocolId}`) return <MainLayout><Card>Carregando protocolo...</Card></MainLayout>;
  if (loadError) return <MainLayout><Card className="p-8 text-center"><p className="font-semibold">Contexto de treino inválido</p><p className="mt-2 text-sm text-red-500">{loadError}</p><Button className="mt-5" onClick={() => router.push(`/treinos/${studentId}`)}>Voltar aos protocolos</Button></Card></MainLayout>;
  if (!protocol) return <MainLayout><Card>Carregando protocolo...</Card></MainLayout>;

  return <MainLayout><div className="space-y-6">
    <PageHeader title={protocol.name ?? protocol.objective} description={`${protocol.student} · ${protocol.objective} · ${protocol.frequency}× por semana`} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => router.push(`/treinos/${studentId}`)}>← Protocolos</Button><Button onClick={() => router.push(`/treinos/${studentId}`)}>Editar protocolo</Button></div>} />
    <Card className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Periodizações</p><p className="mt-1 text-sm text-[var(--muted)]">Selecione um período para visualizar e editar seus treinos.</p></div><Button variant="secondary" onClick={() => router.push(editorUrl(workouts[0]?.id))}>Editar período</Button></div><div className="mt-4 flex gap-2 overflow-x-auto">{protocol.periods.map((period) => <button key={period.id} type="button" onClick={() => setActivePeriod(period.id)} className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm ${activePeriod === period.id ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-[var(--border)]"}`}><strong className="block">{period.name}</strong><span className="text-xs text-[var(--muted)]">{period.start} · {period.end}</span></button>)}</div></Card>
    <section className="space-y-4">{workouts.map((workout) => { const expanded = expandedWorkouts.includes(workout.id); const resuming = Boolean(inProgressSessions[workout.id]); return <Card key={workout.id} className="overflow-hidden p-0"><button type="button" onClick={() => setExpandedWorkouts((current) => current.includes(workout.id) ? current.filter((id) => id !== workout.id) : [...current, workout.id])} className="flex w-full items-center gap-3 p-4 text-left"><div className="min-w-0 flex-1"><div className="flex gap-2"><h2 className="font-semibold">{workout.name}</h2><Badge tone="neutral">{workout.duration} min</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">{workout.focus} · {workout.exercises.length} exercícios</p></div><span className={expanded ? "rotate-180" : ""}>⌄</span></button>{expanded && <div className="border-t border-[var(--border)] p-4"><div className="space-y-2">{workout.exercises.map((exercise, index) => <div key={exercise.id} className="flex gap-3 rounded-xl bg-[var(--background)] p-3"><span>{index + 1}</span><div><p className="text-sm font-medium">{exercise.name}</p><p className="text-xs text-[var(--muted)]">{[exercise.prescription, exercise.load, exercise.rest].filter(Boolean).join(" · ")}</p></div></div>)}</div><div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => router.push(editorUrl(workout.id))}>Abrir treino no editor</Button><Button onClick={() => router.push(sessionUrl(workout.id))}>{resuming ? "Retomar sessão" : "Iniciar sessão"}</Button></div></div>}</Card>; })}</section>
    {workouts.length === 0 && <Card className="p-8 text-center"><p className="font-semibold">Nenhum treino neste período</p><p className="mt-1 text-sm text-[var(--muted)]">Crie o primeiro treino e abra o editor de prescrição.</p><Button className="mt-4" onClick={() => router.push(editorUrl())}>＋ Criar treino</Button></Card>}
    {macroVolume.length > 0 && <Card><div className="flex justify-between"><h2 className="font-semibold">Volume do período</h2><VolumeMetricToggle metric={volumeMetric} onChange={setVolumeMetric} /></div><div className="mt-4 space-y-2">{macroVolume.map((item) => <div key={item.muscle} className="flex justify-between text-sm"><span>{item.muscle}</span><strong>{formatVolumeValue(item.value, volumeMetric)}</strong></div>)}</div></Card>}
  </div></MainLayout>;
}
