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
import { listTrainingProtocols } from "@/services/training";
import type { Protocol, Workout } from "@/types/training";

type DashboardFilter = "appointments" | "active" | "assessments" | "expired";

const appointments = [
  { time: "08:00", name: "João Mendes", type: "Treino A", status: "Concluído" },
  { time: "09:30", name: "Mariana Costa", type: "Avaliação", status: "Em andamento" },
  { time: "11:00", name: "Carlos Lima", type: "Treino B", status: "Agendado" },
  { time: "14:00", name: "Ana Souza", type: "Treino C", status: "Agendado" },
];

const dashboardLists: Record<DashboardFilter, { title: string; students: { name: string; detail: string }[] }> = {
  appointments: { title: "Atendimentos de hoje", students: appointments.map((item) => ({ name: item.name, detail: `${item.time} · ${item.type}` })) },
  active: { title: "Alunos ativos", students: [{ name: "João Mendes", detail: "Hipertrofia" }, { name: "Mariana Costa", detail: "Emagrecimento" }, { name: "Carlos Lima", detail: "Condicionamento" }, { name: "Ana Souza", detail: "Força" }] },
  assessments: { title: "Avaliações pendentes", students: [{ name: "Mariana Costa", detail: "Vence hoje" }, { name: "Paulo Rocha", detail: "Vencida há 5 dias" }, { name: "Beatriz Alves", detail: "Vence em 3 dias" }] },
  expired: { title: "Treinos vencidos", students: [{ name: "João Mendes", detail: "Meta de sessões concluída" }, { name: "Paulo Rocha", detail: "Protocolo vencido por data" }, { name: "Beatriz Alves", detail: "Protocolo vence hoje" }] },
};

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const firstName = profile?.fullName.split(" ")[0] || "Personal";
  const [activeFilter, setActiveFilter] = useState<DashboardFilter | null>(null);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [sessionStudent, setSessionStudent] = useState<Protocol | null>(null);
  const [trainingProtocols, setTrainingProtocols] = useState<Protocol[]>([]);

  useEffect(() => {
    listTrainingProtocols().then(setTrainingProtocols).catch(() => setTrainingProtocols([]));
  }, []);

  const openWorkoutPicker = (studentName?: string) => {
    setSessionStudent(studentName ? trainingProtocols.find((protocol) => protocol.student === studentName) ?? null : null);
    setSessionPickerOpen(true);
  };

  const closeWorkoutPicker = () => {
    setSessionPickerOpen(false);
    setSessionStudent(null);
  };

  const startWorkout = (protocol: Protocol, workout: Workout) => {
    router.push(`/treinos?aluno=${protocol.studentId}&protocolo=${protocol.id}&treinoId=${workout.id}`);
  };

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader
          title={`Olá, ${firstName} 👋`}
          description="Aqui está o resumo da sua rotina hoje."
        />

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5"><div><h2 className="font-semibold">Agenda de hoje</h2><p className="mt-1 text-sm text-[var(--muted)]">Próximos atendimentos</p></div><Button variant="ghost" onClick={() => router.push("/agenda")}>Ver agenda →</Button></div>
          <div className="divide-y divide-[var(--border)]">
            {appointments.map((item) => <div key={item.time} className="grid grid-cols-[58px_1fr] items-center gap-3 px-4 py-4 sm:grid-cols-[64px_1fr_auto_auto] sm:px-5"><span className="text-sm font-semibold text-blue-500">{item.time}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-[var(--muted)]">{item.type}</p></div><span className="hidden sm:inline-flex"><Badge tone={item.status === "Concluído" ? "success" : item.status === "Em andamento" ? "warning" : "neutral"}>{item.status}</Badge></span>{item.type.startsWith("Treino") && item.status !== "Concluído" && <Button className="col-span-2 w-full sm:col-span-1 sm:w-auto" onClick={() => openWorkoutPicker(item.name)}>Iniciar treino</Button>}</div>)}
          </div>
          <div className="border-t border-[var(--border)] p-4 sm:p-5">
            <Button className="w-full sm:w-auto" onClick={() => openWorkoutPicker()}>＋ Iniciar uma sessão</Button>
          </div>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button className="text-left" onClick={() => setActiveFilter("appointments")}><StatCard title="Atendimentos hoje" value={7} detail="2 já concluídos" tone="blue" /></button>
          <button className="text-left" onClick={() => setActiveFilter("active")}><StatCard title="Alunos ativos" value={52} detail="+3 neste mês" tone="green" /></button>
          <button className="text-left" onClick={() => setActiveFilter("assessments")}><StatCard title="Avaliações pendentes" value={3} detail="1 agendada para hoje" tone="violet" /></button>
          <button className="text-left" onClick={() => setActiveFilter("expired")}><StatCard title="Treinos vencidos" value={3} detail="Protocolos para atualizar" tone="amber" /></button>
        </section>

        {activeFilter && <Card><div className="flex items-center justify-between"><div><h2 className="font-semibold">{dashboardLists[activeFilter].title}</h2><p className="mt-1 text-sm text-[var(--muted)]">Lista correspondente ao indicador selecionado</p></div><button onClick={() => setActiveFilter(null)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]">×</button></div><div className="mt-4 divide-y divide-[var(--border)]">{dashboardLists[activeFilter].students.map((student) => <div key={student.name} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{student.name}</p><p className="text-xs text-[var(--muted)]">{student.detail}</p></div>{activeFilter === "expired" ? <Button onClick={() => router.push("/treinos")}>Atualizar treino</Button> : <Button variant="secondary" onClick={() => router.push("/alunos")}>Ver aluno</Button>}</div>)}</div></Card>}

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
                <button type="button" onClick={() => setSessionStudent(null)} className="mb-4 text-sm font-semibold text-blue-500">← Escolher outro aluno</button>
                <div className="space-y-3">
                  {sessionStudent.workouts.map((workout, index) => {
                    const target = workout.targetExecutions ?? Math.max(1, Math.round((sessionStudent.frequency * 8) / sessionStudent.workouts.length));
                    const completed = workout.completedExecutions ?? index + 2;
                    const progress = Math.min((completed / target) * 100, 100);
                    const lastDates = ["22/07/2026", "19/07/2026", "16/07/2026"];
                    return (
                      <button key={workout.id} type="button" onClick={() => startWorkout(sessionStudent, workout)} className="w-full rounded-2xl border border-[var(--border)] p-4 text-left transition hover:border-blue-500/60 hover:bg-blue-500/5">
                        <div className="flex items-start justify-between gap-3">
                          <div><h3 className="font-semibold">{workout.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{workout.focus}</p></div>
                          <span className="shrink-0 text-sm font-semibold text-blue-500">Iniciar →</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-[var(--surface-raised)] p-3"><span className="text-xs text-[var(--muted)]">Última execução</span><strong className="mt-1 block">{lastDates[index] ?? "Ainda não realizado"}</strong></div>
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
