"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { initialProtocols } from "../page";

type Props = {
  params: Promise<{ student: string }>;
};

export default function StudentWorkoutsPage({ params }: Props) {
  const router = useRouter();
  const { student } = use(params);
  const studentName = decodeURIComponent(student);
  const protocol = initialProtocols.find((item) => item.student === studentName);
  const [expandedWorkouts, setExpandedWorkouts] = useState<number[]>([]);
  const [protocolsOpen, setProtocolsOpen] = useState(true);

  const macroVolume = useMemo(() => {
    if (!protocol) return [];
    const totals = protocol.workouts
      .flatMap((workout) => workout.volume)
      .reduce<Record<string, number>>((result, item) => {
        result[item.muscle] = (result[item.muscle] ?? 0) + item.sets;
        return result;
      }, {});
    return Object.entries(totals)
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
  }, [protocol]);

  if (!protocol) {
    return (
      <MainLayout>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Aluno não encontrado</h1>
          <Button className="mt-5" onClick={() => router.push("/treinos")}>Voltar para treinos</Button>
        </Card>
      </MainLayout>
    );
  }

  const maximumMacroVolume = Math.max(...macroVolume.map((item) => item.sets), 1);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={protocol.student}
          description={`${protocol.objective} · ${protocol.frequency}× por semana · ${protocol.start} a ${protocol.end}`}
          action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => router.push("/treinos")}>← Todos os alunos</Button><Button onClick={() => { window.location.href = `/treinos?novoProtocolo=${encodeURIComponent(protocol.student)}`; }}>＋ Adicionar protocolo</Button></div>}
        />

        <Card className="overflow-hidden p-0">
          <button type="button" onClick={() => setProtocolsOpen((current) => !current)} className="flex w-full items-center gap-3 p-4 text-left sm:p-5" aria-expanded={protocolsOpen}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Protocolos do aluno</p>
              <h2 className="mt-1 font-semibold">1 protocolo cadastrado</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Abra para editar, excluir ou revisar suas periodizações.</p>
            </div>
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] transition-transform ${protocolsOpen ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {protocolsOpen && (
            <div className="border-t border-[var(--border)] p-4 sm:p-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{protocol.name ?? protocol.objective}</h3>
                    <Badge tone="success">{protocol.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{protocol.start} a {protocol.end} · {protocol.workouts.length} treinos</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="secondary" onClick={() => { window.location.href = `/treinos?editarProtocolo=${protocol.id}&editarTreino=${protocol.workouts[0]?.id}`; }}>Editar protocolo</Button>
                  <button type="button" onClick={() => { if (window.confirm(`Excluir o protocolo ${protocol.name ?? protocol.objective}?`)) router.push("/treinos"); }} className="h-10 rounded-xl border border-red-500/30 px-4 text-sm font-semibold text-red-500 hover:bg-red-500/10">Excluir protocolo</button>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Periodizações deste protocolo</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Cada período pode receber nome e duração próprios na prescrição.</p>
                  </div>
                  <Button variant="secondary" onClick={() => { window.location.href = `/treinos?editarProtocolo=${protocol.id}&editarTreino=${protocol.workouts[0]?.id}&periodizar=1`; }}>＋ Periodizar</Button>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <button type="button" onClick={() => { window.location.href = `/treinos?editarProtocolo=${protocol.id}&editarTreino=${protocol.workouts[0]?.id}`; }} className="shrink-0 rounded-xl border border-blue-500 bg-blue-500/10 px-4 py-3 text-left text-sm text-blue-500"><strong className="block">{protocol.name ?? "Período atual"}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{protocol.start} · {protocol.end}</span></button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-center">
          <Button onClick={() => { window.location.href = `/treinos?editarProtocolo=${protocol.id}&editarTreino=${protocol.workouts[0]?.id}`; }}>Editar protocolo</Button>
        </div>

        <section className="space-y-4">
          {protocol.workouts.map((workout, workoutIndex) => {
            const expanded = expandedWorkouts.includes(workout.id);
            const maximumVolume = Math.max(...workout.volume.map((item) => item.sets), 1);
            const target = workout.targetExecutions ?? Math.max(1, Math.round((protocol.frequency * 8) / protocol.workouts.length));
            const completed = workout.completedExecutions ?? workoutIndex + 2;
            const progress = Math.min((completed / target) * 100, 100);

            return (
              <Card key={workout.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setExpandedWorkouts((current) => current.includes(workout.id) ? current.filter((id) => id !== workout.id) : [...current, workout.id])}
                  className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
                  aria-expanded={expanded}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{workout.name}</h2>
                      <Badge tone="neutral">{workout.duration} min</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{workout.focus} · {workout.exercises.length} exercícios</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-[var(--muted)]">Progresso no protocolo</span>
                      <strong>{completed} de {target} sessões</strong>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${progress}%` }} />
                    </div>
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
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{exercise.name}</p>
                                <p className="mt-0.5 text-xs text-[var(--muted)]">{exercise.prescription} · {exercise.load}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold">Volume do treino</h3>
                            <p className="mt-1 text-xs text-[var(--muted)]">Séries equivalentes por grupo muscular</p>
                          </div>
                          <Badge tone="info">{workout.volume.reduce((sum, item) => sum + item.sets, 0).toLocaleString("pt-BR")} séries</Badge>
                        </div>
                        <div className="mt-4 space-y-3">
                          {workout.volume.map((item) => (
                            <div key={item.muscle}>
                              <div className="mb-1.5 flex justify-between gap-3 text-xs"><span>{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")}</strong></div>
                              <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${item.sets / maximumVolume * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button onClick={() => { window.location.href = `/treinos?protocolo=${protocol.id}&treinoId=${workout.id}`; }}>Iniciar sessão</Button>
                      <Button variant="secondary" onClick={() => { window.location.href = `/treinos?editarProtocolo=${protocol.id}&editarTreino=${workout.id}`; }}>Editar treino</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </section>

        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Visão macro</p>
              <h2 className="mt-1 text-lg font-semibold">Volume total do protocolo</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Soma de todos os treinos por grupo muscular</p>
            </div>
            <Badge tone="info">{macroVolume.reduce((sum, item) => sum + item.sets, 0).toLocaleString("pt-BR")} séries equivalentes</Badge>
          </div>
          <div className="mt-5 grid gap-x-8 gap-y-4 lg:grid-cols-2">
            {macroVolume.map((item) => (
              <div key={item.muscle}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium">{item.muscle}</span><strong>{item.sets.toLocaleString("pt-BR")} séries</strong></div>
                <div className="h-3.5 overflow-hidden rounded-full bg-[var(--background)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400" style={{ width: `${item.sets / maximumMacroVolume * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
