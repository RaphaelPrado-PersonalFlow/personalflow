"use client";

import { FormEvent, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

type Student = {
  id: number;
  name: string;
  phone: string;
  goal: string;
  frequency: number;
  status: "Ativo" | "Pausado" | "Inativo";
  lastSession: string;
  nextSession: string;
  initials: string;
};

const initialStudents: Student[] = [
  { id: 1, name: "João Mendes", phone: "(21) 99911-2200", goal: "Hipertrofia", frequency: 92, status: "Ativo", lastSession: "Ontem", nextSession: "Hoje, 14:00", initials: "JM" },
  { id: 2, name: "Mariana Costa", phone: "(21) 99832-4411", goal: "Emagrecimento", frequency: 88, status: "Ativo", lastSession: "20/07", nextSession: "Amanhã, 08:30", initials: "MC" },
  { id: 3, name: "Carlos Lima", phone: "(21) 99745-8830", goal: "Condicionamento", frequency: 76, status: "Ativo", lastSession: "18/07", nextSession: "Sexta, 10:00", initials: "CL" },
  { id: 4, name: "Ana Souza", phone: "(21) 99654-1192", goal: "Força", frequency: 95, status: "Ativo", lastSession: "Hoje", nextSession: "Quinta, 14:00", initials: "AS" },
  { id: 5, name: "Paulo Rocha", phone: "(21) 99512-7001", goal: "Qualidade de vida", frequency: 64, status: "Pausado", lastSession: "10/07", nextSession: "Não agendado", initials: "PR" },
  { id: 6, name: "Beatriz Alves", phone: "(21) 99420-3366", goal: "Hipertrofia", frequency: 84, status: "Ativo", lastSession: "21/07", nextSession: "Hoje, 18:00", initials: "BA" },
];

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function StudentsPage() {
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<number[]>([]);

  function toggleStudent(studentId: number) {
    setExpandedStudents((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase("pt-BR");
    return students.filter((student) =>
      (status === "Todos" || student.status === status) &&
      (student.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery) || student.goal.toLocaleLowerCase("pt-BR").includes(normalizedQuery)),
    );
  }, [query, status, students]);

  const activeStudents = students.filter((student) => student.status === "Ativo");
  const averageFrequency = Math.round(activeStudents.reduce((total, student) => total + student.frequency, 0) / activeStudents.length);

  function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const goal = String(data.get("goal") || "").trim();
    if (!name || !phone || !goal) return;
    setStudents((current) => [{ id: Date.now(), name, phone, goal, status: "Ativo", frequency: 100, lastSession: "Ainda não treinou", nextSession: "Não agendado", initials: getInitials(name) }, ...current]);
    event.currentTarget.reset();
    setModalOpen(false);
  }

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader title="Alunos" description="Gerencie sua carteira e acompanhe a rotina de cada aluno." action={<Button onClick={() => setModalOpen(true)}>＋ Novo aluno</Button>} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Alunos ativos" value={activeStudents.length} detail={`${students.length} alunos cadastrados`} tone="blue" />
          <StatCard title="Frequência média" value={`${averageFrequency}%`} detail="Últimos 30 dias" tone="green" />
          <StatCard title="Sem treinar há 7+ dias" value={2} detail="Precisam de atenção" tone="amber" />
          <StatCard title="Reavaliações pendentes" value={3} detail="Para os próximos 15 dias" tone="violet" />
        </section>

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative block w-full md:max-w-md"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou objetivo" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 text-sm outline-none focus:border-blue-500" /></label>
            <div className="flex gap-2 overflow-x-auto">{["Todos", "Ativo", "Pausado", "Inativo"].map((item) => <button key={item} onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${status === item ? "bg-blue-600 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{item}</button>)}</div>
          </div>
        </Card>

        <section className="space-y-3">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="p-0 transition hover:border-blue-500/40">
              <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-500 sm:size-12">{student.initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><h2 className="truncate font-semibold">{student.name}</h2><span className="hidden sm:inline-flex"><Badge tone={student.status === "Ativo" ? "success" : student.status === "Pausado" ? "warning" : "neutral"}>{student.status}</Badge></span></div>
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">{student.goal}</p>
                </div>
                <div className="hidden text-right md:block"><p className="text-xs text-[var(--muted)]">Próximo atendimento</p><p className="mt-1 text-sm font-medium">{student.nextSession}</p></div>
                <button onClick={() => toggleStudent(student.id)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--muted)] transition hover:text-[var(--foreground)]" aria-label={expandedStudents.includes(student.id) ? `Recolher detalhes de ${student.name}` : `Expandir detalhes de ${student.name}`} aria-expanded={expandedStudents.includes(student.id)}>
                  <span className={`transition-transform ${expandedStudents.includes(student.id) ? "rotate-180" : ""}`}>⌄</span>
                </button>
              </div>

              {expandedStudents.includes(student.id) && (
                <div className="border-t border-[var(--border)] px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Último treino</p><p className="mt-1 text-sm font-medium">{student.lastSession}</p></div>
                    <div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Próximo treino</p><p className="mt-1 text-sm font-medium">{student.nextSession}</p></div>
                    <div className="rounded-xl bg-[var(--surface-raised)] p-3"><div className="flex items-center justify-between"><p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Frequência</p><p className="text-sm font-semibold">{student.frequency}%</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-blue-500" style={{ width: `${student.frequency}%` }} /></div></div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setSelectedStudent(student)}>Ver perfil</Button><Button>Abrir treino</Button></div>
                </div>
              )}
            </Card>
          ))}
        </section>

        {filteredStudents.length === 0 && <Card className="grid min-h-56 place-items-center text-center"><div><p className="text-lg font-semibold">Nenhum aluno encontrado</p><p className="mt-2 text-sm text-[var(--muted)]">Tente alterar a pesquisa ou os filtros.</p></div></Card>}
      </div>

      {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="new-student-title"><form onSubmit={addStudent} className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 id="new-student-title" className="text-xl font-semibold">Novo aluno</h2><p className="mt-1 text-sm text-[var(--muted)]">Cadastre as informações essenciais.</p></div><button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="mt-6 space-y-4"><label className="block text-sm font-medium">Nome completo<input name="name" required placeholder="Nome do aluno" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label><label className="block text-sm font-medium">Telefone<input name="phone" required placeholder="(21) 99999-9999" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label><label className="block text-sm font-medium">Objetivo principal<select name="goal" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500"><option>Hipertrofia</option><option>Emagrecimento</option><option>Força</option><option>Condicionamento</option><option>Qualidade de vida</option></select></label></div><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit">Cadastrar aluno</Button></div></form></div>}

      {selectedStudent && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70" role="dialog" aria-modal="true" aria-labelledby="student-profile-title"><button className="flex-1" onClick={() => setSelectedStudent(null)} aria-label="Fechar perfil" /><aside className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 id="student-profile-title" className="text-xl font-semibold">Perfil do aluno</h2><button onClick={() => setSelectedStudent(null)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="mt-8 text-center"><div className="mx-auto grid size-20 place-items-center rounded-full bg-blue-500/10 text-xl font-semibold text-blue-500">{selectedStudent.initials}</div><h3 className="mt-4 text-xl font-semibold">{selectedStudent.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{selectedStudent.goal}</p><div className="mt-3"><Badge tone="success">{selectedStudent.status}</Badge></div></div><div className="mt-8 space-y-3"><Card><p className="text-xs text-[var(--muted)]">Telefone</p><p className="mt-1 font-medium">{selectedStudent.phone}</p></Card><Card><p className="text-xs text-[var(--muted)]">Frequência nos últimos 30 dias</p><p className="mt-1 text-2xl font-semibold">{selectedStudent.frequency}%</p></Card><Card><p className="text-xs text-[var(--muted)]">Próximo atendimento</p><p className="mt-1 font-medium">{selectedStudent.nextSession}</p></Card></div><div className="mt-6 grid grid-cols-2 gap-3"><Button variant="secondary">Editar dados</Button><Button>Abrir treino</Button></div></aside></div>}
    </MainLayout>
  );
}
