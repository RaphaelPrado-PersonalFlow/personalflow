"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import StatCard from "@/components/ui/StatCard";
import { listUpcomingAppointments, type AppointmentRecord } from "@/services/appointments";
import { getTrainingProtocol, listTrainingProtocols, resolveAppointmentTrainingContext, type AppointmentTrainingContext } from "@/services/training";
import { listWorkoutExecutionSummaries, type WorkoutExecutionSummary } from "@/services/training-sessions";
import type { Protocol, Workout } from "@/types/training";

type DashboardFilter = "appointments" | "active" | "assessments" | "expired";

const dashboardLists: Record<Exclude<DashboardFilter, "appointments">, { title: string; students: { name: string; detail: string }[] }> = {
  active: { title: "Alunos ativos", students: [{ name: "João Mendes", detail: "Hipertrofia" }, { name: "Mariana Costa", detail: "Emagrecimento" }, { name: "Carlos Lima", detail: "Condicionamento" }, { name: "Ana Souza", detail: "Força" }] },
  assessments: { title: "Avaliações pendentes", students: [{ name: "Mariana Costa", detail: "Vence hoje" }, { name: "Paulo Rocha", detail: "Vencida há 5 dias" }, { name: "Beatriz Alves", detail: "Vence em 3 dias" }] },
  expired: { title: "Treinos vencidos", students: [{ name: "João Mendes", detail: "Meta de sessões concluída" }, { name: "Paulo Rocha", detail: "Protocolo vencido por data" }, { name: "Beatriz Alves", detail: "Protocolo vence hoje" }] },
};

type DashboardAppointment = AppointmentRecord & { trainingContext: AppointmentTrainingContext | null };

const appointmentType = { training: "Treino", assessment: "Avaliação", reassessment: "Reavaliação" } as const;
const appointmentStatus = { scheduled: "Agendado", waiting: "Aguardando", in_progress: "Em andamento" } as const;

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const firstName = profile?.fullName.split(" ")[0] || "Personal";
  const [activeFilter, setActiveFilter] = useState<DashboardFilter | null>(null);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [sessionStudent, setSessionStudent] = useState<Protocol | null>(null);
  const [sessionAppointmentId, setSessionAppointmentId] = useState<string | null>(null);
  const [trainingProtocols, setTrainingProtocols] = useState<Protocol[]>([]);
  const [workoutExecutions, setWorkoutExecutions] = useState<Record<string, WorkoutExecutionSummary>>({});
  const [upcomingAppointments, setUpcomingAppointments] = useState<DashboardAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState("");

  useEffect(() => {
    Promise.all([listTrainingProtocols(), listWorkoutExecutionSummaries()])
      .then(([protocols, executions]) => {
        setTrainingProtocols(protocols);
        setWorkoutExecutions(executions);
      })
      .catch(() => {
        setTrainingProtocols([]);
        setWorkoutExecutions({});
      });
  }, []);

  useEffect(() => {
    listUpcomingAppointments(new Date().toISOString())
      .then(async (appointmentRows) => {
        const resolved = await Promise.all(appointmentRows.map(async (appointment): Promise<DashboardAppointment> => {
          if (appointment.type !== "training") return { ...appointment, trainingContext: null };
          try {
            const trainingContext = await resolveAppointmentTrainingContext({ appointmentId: appointment.id, studentId: appointment.student_id, startsAt: appointment.starts_at });
            return { ...appointment, trainingContext };
          } catch {
            return { ...appointment, trainingContext: { kind: "unavailable", reason: "Não foi possível determinar o treino deste atendimento." } };
          }
        }));
        setUpcomingAppointments(resolved);
      })
      .catch((error: unknown) => {
        setUpcomingAppointments([]);
        setAppointmentsError(error instanceof Error ? error.message : "Não foi possível carregar os próximos atendimentos.");
      })
      .finally(() => setAppointmentsLoading(false));
  }, []);

  const openWorkoutPicker = () => {
    setSessionStudent(null);
    setSessionAppointmentId(null);
    setSessionPickerOpen(true);
  };

  const closeWorkoutPicker = () => {
    setSessionPickerOpen(false);
    setSessionStudent(null);
    setSessionAppointmentId(null);
  };

  const startWorkout = (protocol: Protocol, workout: Workout) => {
    const appointment = sessionAppointmentId ? `&atendimento=${sessionAppointmentId}` : "";
    router.push(`/treinos?aluno=${protocol.studentId}&protocolo=${protocol.id}&periodo=${workout.periodId}&treinoId=${workout.id}${appointment}`);
  };

  const openAppointmentSession = async (appointment: DashboardAppointment) => {
    const context = appointment.trainingContext;
    if (!context || context.kind === "unavailable") return;
    if (context.kind === "resume") {
      router.push(`/treinos?sessao=${context.sessionId}`);
      return;
    }
    if (context.kind === "selection_required") {
      try {
        const protocol = await getTrainingProtocol(context.protocolId);
        if (protocol.studentId !== context.studentId) throw new Error("O protocolo não corresponde ao aluno do atendimento.");
        const period = protocol.periods.find((item) => item.id === context.periodId);
        const allowedIds = new Set(context.workoutIds);
        const workouts = period?.workouts.filter((workout) => allowedIds.has(workout.id)) ?? [];
        if (workouts.length !== context.workoutIds.length) throw new Error("Os treinos válidos deste atendimento não estão mais disponíveis.");
        setSessionAppointmentId(appointment.id);
        setSessionStudent({ ...protocol, activePeriodId: context.periodId, workouts });
        setSessionPickerOpen(true);
      } catch (error) {
        setAppointmentsError(error instanceof Error ? error.message : "Não foi possível carregar os treinos deste atendimento.");
      }
      return;
    }
    router.push(`/treinos?aluno=${context.studentId}&protocolo=${context.protocolId}&periodo=${context.periodId}&treinoId=${context.workoutId}&atendimento=${appointment.id}`);
  };

  const nextTrainingAppointment = upcomingAppointments.find((appointment) =>
    appointment.type === "training" && appointment.trainingContext && appointment.trainingContext.kind !== "unavailable",
  );

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader
          title={`Olá, ${firstName} 👋`}
          description="Aqui está o resumo da sua rotina hoje."
        />

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5"><div><h2 className="font-semibold">Agenda</h2><p className="mt-1 text-sm text-[var(--muted)]">Próximos atendimentos</p></div><Button variant="ghost" onClick={() => router.push("/agenda")}>Ver agenda →</Button></div>
          <div className="divide-y divide-[var(--border)]">
            {appointmentsLoading && <p className="px-5 py-8 text-sm text-[var(--muted)]">Carregando agenda...</p>}
            {!appointmentsLoading && appointmentsError && <p className="px-5 py-8 text-sm text-red-500">{appointmentsError}</p>}
            {!appointmentsLoading && !appointmentsError && upcomingAppointments.length === 0 && <p className="px-5 py-8 text-sm text-[var(--muted)]">Nenhum próximo atendimento agendado.</p>}
            {upcomingAppointments.map((item) => {
              const context = item.trainingContext;
              const canOpenTraining = item.type === "training" && context && context.kind !== "unavailable";
              const contextReason = context && (context.kind === "unavailable" || context.kind === "selection_required") ? context.reason : null;
              return <div key={item.id} className="grid grid-cols-[58px_1fr] items-center gap-3 px-4 py-4 sm:grid-cols-[64px_1fr_auto_auto] sm:px-5"><span className="text-sm font-semibold text-blue-500">{new Date(item.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{item.students?.full_name ?? "Aluno não identificado"}</p><p className="text-xs text-[var(--muted)]">{appointmentType[item.type]}{contextReason ? ` · ${contextReason}` : ""}</p></div><span className="hidden sm:inline-flex"><Badge tone={item.status === "in_progress" ? "warning" : "neutral"}>{appointmentStatus[item.status as keyof typeof appointmentStatus]}</Badge></span>{canOpenTraining && <Button className="col-span-2 w-full sm:col-span-1 sm:w-auto" onClick={() => void openAppointmentSession(item)}>{context.kind === "resume" ? "Retomar sessão" : "Iniciar sessão"}</Button>}</div>;
            })}
          </div>
          <div className="border-t border-[var(--border)] p-4 sm:p-5">
            <Button className="w-full sm:w-auto" onClick={() => nextTrainingAppointment ? void openAppointmentSession(nextTrainingAppointment) : openWorkoutPicker()}>＋ Iniciar uma sessão</Button>
          </div>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button className="text-left" onClick={() => setActiveFilter("appointments")}><StatCard title="Próximos atendimentos" value={upcomingAppointments.length} detail="Dados da Agenda" tone="blue" /></button>
          <button className="text-left" onClick={() => setActiveFilter("active")}><StatCard title="Alunos ativos" value={52} detail="+3 neste mês" tone="green" /></button>
          <button className="text-left" onClick={() => setActiveFilter("assessments")}><StatCard title="Avaliações pendentes" value={3} detail="1 agendada para hoje" tone="violet" /></button>
          <button className="text-left" onClick={() => setActiveFilter("expired")}><StatCard title="Treinos vencidos" value={3} detail="Protocolos para atualizar" tone="amber" /></button>
        </section>

        {activeFilter && (() => {
          const list = activeFilter === "appointments" ? { title: "Próximos atendimentos", students: upcomingAppointments.map((item) => ({ name: item.students?.full_name ?? "Aluno não identificado", detail: `${new Date(item.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${appointmentType[item.type]}` })) } : dashboardLists[activeFilter];
          return <Card><div className="flex items-center justify-between"><div><h2 className="font-semibold">{list.title}</h2><p className="mt-1 text-sm text-[var(--muted)]">Lista correspondente ao indicador selecionado</p></div><button onClick={() => setActiveFilter(null)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]">×</button></div><div className="mt-4 divide-y divide-[var(--border)]">{list.students.map((student) => <div key={`${student.name}:${student.detail}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{student.name}</p><p className="text-xs text-[var(--muted)]">{student.detail}</p></div>{activeFilter === "expired" ? <Button onClick={() => router.push("/treinos")}>Atualizar treino</Button> : <Button variant="secondary" onClick={() => router.push(activeFilter === "appointments" ? "/agenda" : "/alunos")}>{activeFilter === "appointments" ? "Ver agenda" : "Ver aluno"}</Button>}</div>)}</div></Card>;
        })()}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card><div className="flex items-center justify-between"><div><p className="text-sm text-[var(--muted)]">Treinos concluídos</p><p className="mt-2 text-3xl font-semibold">68%</p></div><div className="grid size-16 place-items-center rounded-full border-4 border-blue-500 text-xs font-bold">15/22</div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full w-[68%] rounded-full bg-blue-500" /></div></Card>
          <Card><h2 className="font-semibold">Ações rápidas</h2><div className="mt-4 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => router.push("/alunos?novo=1")}>＋ Aluno</Button><Button variant="secondary" onClick={() => router.push("/treinos")}>＋ Treino</Button><Button variant="secondary" onClick={() => router.push("/agenda")}>◫ Agenda</Button><Button variant="secondary" onClick={() => router.push("/avaliacoes?nova=1")}>◇ Avaliação</Button></div></Card>
        </section>
      </div>

      {sessionPickerOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="session-picker-title">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Iniciar sessão</p>
                <h2 id="session-picker-title" className="mt-1 text-xl font-semibold">{sessionStudent ? `Qual treino de ${sessionStudent.student}?` : "Qual aluno vai treinar?"}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{sessionStudent ? "Confira o histórico e selecione o treino que será realizado." : "Selecione um aluno para visualizar seus treinos disponíveis."}</p>
              </div>
              <button type="button" onClick={closeWorkoutPicker} className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button>
            </div>

            {!sessionStudent ? (
              <div className="space-y-3 p-5">
                {trainingProtocols.filter((protocol) => protocol.workouts.length > 0).map((protocol) => (
                  <button key={protocol.id} type="button" onClick={() => setSessionStudent(protocol)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] p-4 text-left transition hover:border-blue-500/50 hover:bg-blue-500/5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-500">{protocol.student.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span>
                    <div className="min-w-0 flex-1"><p className="font-semibold">{protocol.student}</p><p className="mt-1 text-sm text-[var(--muted)]">{protocol.objective} · {protocol.workouts.length} treinos</p></div>
                    <span className="text-blue-500">→</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-5">
                {!sessionAppointmentId && <button type="button" onClick={() => setSessionStudent(null)} className="mb-4 text-sm font-semibold text-blue-500">← Escolher outro aluno</button>}
                <div className="space-y-3">
                  {sessionStudent.workouts.map((workout) => {
                    const target = workout.targetExecutions ?? Math.max(1, Math.round((sessionStudent.frequency * 8) / sessionStudent.workouts.length));
                    const execution = workoutExecutions[workout.lineageId];
                    const completed = execution?.count ?? 0;
                    const progress = Math.min((completed / target) * 100, 100);
                    const lastExecution = execution?.lastCompletedAt
                      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(execution.lastCompletedAt))
                      : "Ainda não realizado";
                    return (
                      <button key={workout.id} type="button" onClick={() => startWorkout(sessionStudent, workout)} className="w-full rounded-2xl border border-[var(--border)] p-4 text-left transition hover:border-blue-500/60 hover:bg-blue-500/5">
                        <div className="flex items-start justify-between gap-3">
                          <div><h3 className="font-semibold">{workout.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{workout.focus}</p></div>
                          <span className="shrink-0 text-sm font-semibold text-blue-500">Iniciar →</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-[var(--surface-raised)] p-3"><span className="text-xs text-[var(--muted)]">Última execução</span><strong className="mt-1 block">{lastExecution}</strong></div>
                          <div className="rounded-xl bg-[var(--surface-raised)] p-3"><span className="text-xs text-[var(--muted)]">Sessões realizadas</span><strong className="mt-1 block">{completed} de {target}</strong></div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${progress}%` }} /></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </MainLayout>
  );
}
