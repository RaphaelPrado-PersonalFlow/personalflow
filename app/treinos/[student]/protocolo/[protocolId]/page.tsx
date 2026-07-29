"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import VolumeMetricToggle from "@/components/training/VolumeMetricToggle";
import { formatVolumeValue, volumeByMuscle, type VolumeMetric } from "@/lib/training-volume";
import { initialProtocols } from "../../../page";

type Props = {
  params: Promise<{ student: string; protocolId: string }>;
};

export default function OpenProtocolPage({ params }: Props) {
  const router = useRouter();
  const { student, protocolId } = use(params);
  const studentName = decodeURIComponent(student);
  const protocol = initialProtocols.find((item) => item.student === studentName && item.id === Number(protocolId));
  const [expandedWorkouts, setExpandedWorkouts] = useState<number[]>([]);
  const [activePeriod, setActivePeriod] = useState("current");
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>("series");

  const macroVolume = useMemo(
    () => protocol ? volumeByMuscle(protocol.workouts, volumeMetric) : [],
    [protocol, volumeMetric],
  );

  if (!protocol) {
    return (
      <MainLayout>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Protocolo não encontrado</h1>
          <Button className="mt-5" onClick={() => router.push(`/treinos/${encodeURIComponent(studentName)}`)}>Voltar aos protocolos</Button>
        </Card>
      </MainLayout>
    );
  }

  const editUrl = `/treinos?editarProtocolo=${protocol.id}&editarTreino=${protocol.workouts[0]?.id}`;
  const periods = [
    { id: "current", name: protocol.name ?? "Período atual", start: protocol.start, end: protocol.end },
  ];
  const maximumMacroVolume = Math.max(...macroVolume.map((item) => item.value), 1);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={protocol.name ?? protocol.objective}
          description={`${protocol.student} · ${protocol.objective} · ${protocol.frequency}× por semana`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push(`/treinos/${encodeURIComponent(studentName)}`)}>← Protocolos</Button>
              <Button onClick={() => router.push(editUrl)}>Editar treino</Button>
            </div>
          }
        />

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Periodizações</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Selecione um período para visualizar seus treinos.</p>
            </div>
            <Button variant="secondary" onClick={() => router.push(`${editUrl}&periodizar=1`)}>＋ Periodizar</Button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {periods.map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setActivePeriod(period.id)}
                className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm ${activePeriod === period.id ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-[var(--border)] bg-[var(--surface-raised)]"}`}
              >
                <strong className="block">{period.name}</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">{period.start} · {period.end}</span>
              </button>
            ))}
          </div>
        </Card>

        <section className="space-y-4">
          {protocol.workouts.map((workout, workoutIndex) => {
            const expanded = expandedWorkouts.includes(workout.id);
            const workoutVolume = volumeByMuscle([workout], volumeMetric);
            const maximumVolume = Math.max(...workoutVolume.map((item) => item.value), 1);
            const target = workout.targetExecutions ?? Math.max(1, Math.round((protocol.frequency * 8) / protocol.workouts.length));
            const completed = workout.completedExecutions ?? workoutIndex + 2;
            const progress = Math.min((completed / target) * 100, 100);

            return (
              <Card key={workout.id} className="overflow-hidden p-0">
                <button type="button" onClick={() => setExpandedWorkouts((current) => current.includes(workout.id) ? current.filter((id) => id !== workout.id) : [...current, workout.id])} className="flex w-full items-center gap-3 p-4 text-left sm:p-5" aria-expanded={expanded}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{workout.name}</h2><Badge tone="neutral">{workout.duration} min</Badge></div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{workout.focus} · {workout.exercises.length} exercícios</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--muted)]">Progresso no protocolo</span><strong>{completed} de {target} sessões</strong></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${progress}%` }} /></div>
                  </div>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
                </button>

                {expanded && (
                  <div className="border-t border-[var(--border)] p-4 sm:p-5">
                    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
                      <div>
                        <h3 className="text-sm font-semibold">Exercícios prescritos</h3>
                        <div className="mt-3 space-y-2">
                          {workout.exercises.map((exercise, index) => (
                            <div key={exercise.id} className="flex items-center gap-3 rounded-xl bg-[var(--background)] p-3">
                              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">{index + 1}</span>
                              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{exercise.name}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{exercise.prescription} · {exercise.load}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">Volume do treino</h3><p className="mt-1 text-xs text-[var(--muted)]">{volumeMetric === "series" ? "Séries equivalentes por grupo muscular" : "Volume de trabalho estimado por grupo muscular"}</p></div><div className="flex items-center gap-2"><VolumeMetricToggle metric={volumeMetric} onChange={setVolumeMetric} /><Badge tone="info">{formatVolumeValue(workoutVolume.reduce((sum, item) => sum + item.value, 0), volumeMetric)}</Badge></div></div>
                        <div className="mt-4 space-y-3">
                          {workoutVolume.map((item) => (
                            <div key={item.muscle}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span>{item.muscle}</span><strong>{formatVolumeValue(item.value, volumeMetric)}</strong></div><div className="h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${item.value / maximumVolume * 100}%` }} /></div></div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button onClick={() => router.push(`/treinos?protocolo=${protocol.id}&treinoId=${workout.id}`)}>Iniciar sessão</Button>
                      <Button variant="secondary" onClick={() => router.push(`/treinos?editarProtocolo=${protocol.id}&editarTreino=${workout.id}`)}>Editar treino</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </section>

        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Visão macro</p><h2 className="mt-1 text-lg font-semibold">Volume total do protocolo</h2><p className="mt-1 text-sm text-[var(--muted)]">{volumeMetric === "series" ? "Soma das séries equivalentes de todos os treinos" : "Soma estimada de séries × repetições × carga"}</p></div>
            <div className="flex items-center gap-2"><VolumeMetricToggle metric={volumeMetric} onChange={setVolumeMetric} /><Badge tone="info">{formatVolumeValue(macroVolume.reduce((sum, item) => sum + item.value, 0), volumeMetric)}</Badge></div>
          </div>
          <div className="mt-5 grid gap-x-8 gap-y-4 lg:grid-cols-2">
            {macroVolume.map((item) => (
              <div key={item.muscle}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium">{item.muscle}</span><strong>{formatVolumeValue(item.value, volumeMetric)}</strong></div><div className="h-3.5 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400" style={{ width: `${item.value / maximumMacroVolume * 100}%` }} /></div></div>
            ))}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
