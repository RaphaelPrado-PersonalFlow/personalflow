"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

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
  const [activeFilter, setActiveFilter] = useState<DashboardFilter | null>(null);

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader
          title="Olá, Raphael 👋"
          description="Aqui está o resumo da sua rotina hoje."
        />

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5"><div><h2 className="font-semibold">Agenda de hoje</h2><p className="mt-1 text-sm text-[var(--muted)]">Próximos atendimentos</p></div><Button variant="ghost" onClick={() => router.push("/agenda")}>Ver agenda →</Button></div>
          <div className="divide-y divide-[var(--border)]">
            {appointments.map((item) => <div key={item.time} className="grid grid-cols-[58px_1fr] items-center gap-3 px-4 py-4 sm:grid-cols-[64px_1fr_auto_auto] sm:px-5"><span className="text-sm font-semibold text-blue-500">{item.time}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-[var(--muted)]">{item.type}</p></div><span className="hidden sm:inline-flex"><Badge tone={item.status === "Concluído" ? "success" : item.status === "Em andamento" ? "warning" : "neutral"}>{item.status}</Badge></span>{item.type.startsWith("Treino") && item.status !== "Concluído" && <Button className="col-span-2 w-full sm:col-span-1 sm:w-auto" onClick={() => { window.location.href = `/treinos/${encodeURIComponent(item.name)}`; }}>Iniciar treino</Button>}</div>)}
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
    </MainLayout>
  );
}
