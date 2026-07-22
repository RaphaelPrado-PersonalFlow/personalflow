import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

const atendimentos = [
  { time: "08:00", name: "João Mendes", type: "Treino A", status: "Concluído" },
  { time: "09:30", name: "Mariana Costa", type: "Avaliação", status: "Em andamento" },
  { time: "11:00", name: "Carlos Lima", type: "Treino B", status: "Agendado" },
  { time: "14:00", name: "Ana Souza", type: "Treino C", status: "Agendado" },
];

export default function Home() {
  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader title="Olá, Raphael 👋" description="Aqui está o resumo da sua rotina hoje." action={<Button>＋ Novo atendimento</Button>} />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Atendimentos hoje" value={7} detail="2 já concluídos" tone="blue" />
          <StatCard title="Alunos ativos" value={52} detail="+3 neste mês" tone="green" />
          <StatCard title="Avaliações pendentes" value={3} detail="1 agendada para hoje" tone="violet" />
          <StatCard title="Treinos pendentes" value={5} detail="Protocolos para revisar" tone="amber" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5"><div><h2 className="font-semibold">Agenda de hoje</h2><p className="mt-1 text-sm text-[var(--muted)]">Próximos atendimentos</p></div><Button variant="ghost">Ver agenda →</Button></div>
            <div className="divide-y divide-[var(--border)]">
              {atendimentos.map((item) => <div key={item.time} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-5 py-4"><span className="text-sm font-semibold text-blue-500">{item.time}</span><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-[var(--muted)]">{item.type}</p></div><Badge tone={item.status === "Concluído" ? "success" : item.status === "Em andamento" ? "warning" : "neutral"}>{item.status}</Badge></div>)}
            </div>
          </Card>
          <div className="space-y-6">
            <Card><div className="flex items-center justify-between"><div><p className="text-sm text-[var(--muted)]">Treinos concluídos</p><p className="mt-2 text-3xl font-semibold">68%</p></div><div className="grid size-16 place-items-center rounded-full border-4 border-blue-500 text-xs font-bold">15/22</div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className="h-full w-[68%] rounded-full bg-blue-500" /></div></Card>
            <Card><h2 className="font-semibold">Ações rápidas</h2><div className="mt-4 grid grid-cols-2 gap-3"><Button variant="secondary">＋ Aluno</Button><Button variant="secondary">＋ Treino</Button><Button variant="secondary">◫ Agenda</Button><Button variant="secondary">◇ Avaliação</Button></div></Card>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
