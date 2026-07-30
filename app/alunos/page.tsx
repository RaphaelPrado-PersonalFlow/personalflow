"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import {
  createStudent,
  deleteStudent,
  listStudents,
  StudentRecord,
  updateStudentNotes,
} from "@/services/students";

type StudentFilter = "all" | "active" | "frequency" | "inactive7" | "reevaluation";
type Student = {
  id: string; name: string; phone: string; email: string; cpf: string; goal: string; frequency: number;
  status: "Ativo" | "Pausado" | "Inativo"; lastSession: string; daysWithoutTraining: number;
  nextSession: string; initials: string; reevaluationPending: boolean; observations: string;
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function fromRecord(student: StudentRecord): Student {
  return {
    id: student.id,
    name: student.full_name,
    phone: student.phone ?? "",
    email: student.email ?? "",
    cpf: student.cpf ?? "",
    goal: student.goal ?? "Não informado",
    frequency: 0,
    status: student.status === "active" ? "Ativo" : student.status === "paused" ? "Pausado" : "Inativo",
    lastSession: "Ainda não treinou",
    daysWithoutTraining: 0,
    nextSession: "Não agendado",
    initials: getInitials(student.full_name),
    reevaluationPending: false,
    observations: student.notes ?? "",
  };
}

function whatsappUrl(phone: string) {
  return `https://wa.me/55${phone.replace(/\D/g, "")}`;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  const [frequencyOrder, setFrequencyOrder] = useState("highest");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("novo") === "1") setModalOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    listStudents()
      .then((records) => {
        if (active) setStudents(records.map(fromRecord));
      })
      .catch(() => {
        if (active) setFeedback("Não foi possível carregar os alunos. Tente novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeStudents = students.filter((student) => student.status === "Ativo");
  const inactiveSeven = students.filter((student) => student.daysWithoutTraining >= 7);
  const reevaluationPending = students.filter((student) => student.reevaluationPending);
  const averageFrequency = Math.round(activeStudents.reduce((total, student) => total + student.frequency, 0) / Math.max(activeStudents.length, 1));

  const filteredStudents = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    let result = students.filter((student) =>
      (status === "Todos" || student.status === status) &&
      (student.name.toLocaleLowerCase("pt-BR").includes(normalized) || student.goal.toLocaleLowerCase("pt-BR").includes(normalized)),
    );
    if (studentFilter === "active") result = result.filter((student) => student.status === "Ativo");
    if (studentFilter === "inactive7") result = result.filter((student) => student.daysWithoutTraining >= 7);
    if (studentFilter === "reevaluation") result = result.filter((student) => student.reevaluationPending);
    if (studentFilter === "frequency") result = [...result].sort((a, b) => frequencyOrder === "highest" ? b.frequency - a.frequency : frequencyOrder === "lowest" ? a.frequency - b.frequency : a.name.localeCompare(b.name, "pt-BR"));
    return result;
  }, [frequencyOrder, query, status, studentFilter, students]);

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const email = String(data.get("email") || "").trim();
    const cpf = String(data.get("cpf") || "").trim();
    const goal = String(data.get("goal") || "").trim();
    if (!name || !phone || !email || !cpf || !goal) return;
    setSaving(true);
    setFeedback("");
    try {
      const created = await createStudent({ full_name: name, phone, email, cpf, goal });
      setStudents((current) => [fromRecord(created), ...current]);
      event.currentTarget.reset();
      setModalOpen(false);
      setFeedback("Aluno cadastrado com segurança.");
    } catch {
      setFeedback("Não foi possível cadastrar o aluno. Confira os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSelectedStudent() {
    if (!selectedStudent || deleting) return;
    const confirmed = window.confirm(
      `Excluir ${selectedStudent.name}? Esta ação remove o cadastro do aluno e não pode ser desfeita.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setFeedback("");
    try {
      await deleteStudent(selectedStudent.id);
      setStudents((current) => current.filter((student) => student.id !== selectedStudent.id));
      setSelectedStudent(null);
      setFeedback("Aluno excluído.");
    } catch {
      setFeedback("Não foi possível excluir o aluno. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  function chooseFilter(filter: StudentFilter) {
    setStudentFilter(filter);
    setStatus("Todos");
    document.getElementById("student-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader title="Alunos" description="Gerencie sua carteira e acompanhe a rotina de cada aluno." action={<Button onClick={() => setModalOpen(true)}>＋ Novo aluno</Button>} />
        {feedback && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-600">{feedback}</div>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button className="text-left" onClick={() => chooseFilter("active")}><StatCard title="Alunos ativos" value={activeStudents.length} detail={`${students.length} alunos cadastrados`} tone="blue" /></button>
          <button className="text-left" onClick={() => chooseFilter("frequency")}><StatCard title="Frequência média" value={`${averageFrequency}%`} detail="Clique para ordenar" tone="green" /></button>
          <button className="text-left" onClick={() => chooseFilter("inactive7")}><StatCard title="Sem treinar há 7+ dias" value={inactiveSeven.length} detail="Precisam de atenção" tone="amber" /></button>
          <button className="text-left" onClick={() => chooseFilter("reevaluation")}><StatCard title="Reavaliações pendentes" value={reevaluationPending.length} detail="Pendentes ou vencidas" tone="violet" /></button>
        </section>

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative block w-full md:max-w-md"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou objetivo" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 text-sm outline-none focus:border-blue-500" /></label>
            <div className="flex flex-1 gap-2 overflow-x-auto">{["Todos", "Ativo", "Pausado", "Inativo"].map((item) => <button key={item} onClick={() => { setStatus(item); setStudentFilter("all"); }} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${status === item && studentFilter === "all" ? "bg-blue-600 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{item}</button>)}</div>
            {studentFilter === "frequency" && <select aria-label="Ordenar frequência" value={frequencyOrder} onChange={(event) => setFrequencyOrder(event.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option value="highest">Maior frequência</option><option value="lowest">Menor frequência</option><option value="alphabetical">Ordem alfabética</option></select>}
          </div>
        </Card>

        <section id="student-list" className="scroll-mt-24 space-y-3">
          {studentFilter !== "all" && <div className="flex items-center justify-between"><p className="text-sm font-semibold">{studentFilter === "active" ? "Alunos ativos" : studentFilter === "frequency" ? "Frequência dos alunos" : studentFilter === "inactive7" ? "Sem treinar há 7 dias ou mais" : "Reavaliações pendentes ou vencidas"}</p><button onClick={() => setStudentFilter("all")} className="text-sm font-semibold text-blue-500">Limpar filtro</button></div>}
          {loading && <Card className="grid min-h-56 place-items-center text-center"><p className="text-sm text-[var(--muted)]">Carregando alunos...</p></Card>}
          {!loading && filteredStudents.map((student) => <Card key={student.id} className="p-0 transition hover:border-blue-500/40"><div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5"><div className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-500">{student.initials}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-semibold">{student.name}</h2><span className="hidden sm:inline-flex"><Badge tone={student.status === "Ativo" ? "success" : student.status === "Pausado" ? "warning" : "neutral"}>{student.status}</Badge></span></div><p className="mt-1 truncate text-sm text-[var(--muted)]">{student.goal} · {student.frequency}% de frequência</p></div><a href={whatsappUrl(student.phone)} target="_blank" rel="noreferrer" aria-label={`Enviar mensagem para ${student.name}`} className="inline-flex shrink-0 rounded-xl border border-emerald-500/30 px-2 py-2 text-xs font-semibold text-emerald-600 sm:px-3"><span className="sm:hidden">WhatsApp</span><span className="hidden sm:inline">Enviar mensagem</span></a><button onClick={() => setExpandedStudents((current) => current.includes(student.id) ? current.filter((id) => id !== student.id) : [...current, student.id])} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" aria-expanded={expandedStudents.includes(student.id)}>⌄</button></div>{expandedStudents.includes(student.id) && <div className="border-t border-[var(--border)] p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[11px] uppercase text-[var(--muted)]">Último treino</p><p className="mt-1 text-sm font-medium">{student.lastSession}</p></div><div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[11px] uppercase text-[var(--muted)]">Próximo treino</p><p className="mt-1 text-sm font-medium">{student.nextSession}</p></div><div className="rounded-xl bg-[var(--surface-raised)] p-3"><div className="flex justify-between"><p className="text-[11px] uppercase text-[var(--muted)]">Frequência</p><p className="text-sm font-semibold">{student.frequency}%</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-blue-500" style={{ width: `${student.frequency}%` }} /></div></div></div><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><a href={whatsappUrl(student.phone)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/30 px-4 text-sm font-semibold text-emerald-600">Enviar mensagem</a><Button variant="secondary" onClick={() => setSelectedStudent(student)}>Ver perfil</Button><Button onClick={() => window.location.href = `/treinos/${encodeURIComponent(student.name)}`}>Abrir treino</Button></div></div>}</Card>)}
          {!loading && filteredStudents.length === 0 && <Card className="grid min-h-56 place-items-center text-center"><div><p className="text-lg font-semibold">Nenhum aluno encontrado</p><p className="mt-2 text-sm text-[var(--muted)]">{students.length === 0 ? "Cadastre o primeiro aluno para começar." : "Tente alterar a pesquisa ou os filtros."}</p></div></Card>}
        </section>
      </div>

      {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true"><form onSubmit={addStudent} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Novo aluno</h2><p className="mt-1 text-sm text-[var(--muted)]">Dados essenciais para cadastro e futuro acesso do aluno.</p></div><button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium sm:col-span-2">Nome completo<input name="name" required placeholder="Nome do aluno" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="block text-sm font-medium">Telefone<input name="phone" required placeholder="(21) 99999-9999" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="block text-sm font-medium">CPF<input name="cpf" required placeholder="000.000.000-00" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="block text-sm font-medium sm:col-span-2">E-mail<input name="email" required type="email" placeholder="aluno@email.com" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="block text-sm font-medium sm:col-span-2">Objetivo principal<select name="goal" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Hipertrofia</option><option>Emagrecimento</option><option>Força</option><option>Condicionamento</option><option>Qualidade de vida</option></select></label></div><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Cadastrar aluno"}</Button></div></form></div>}

      {selectedStudent && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70"><button className="flex-1" onClick={() => setSelectedStudent(null)} aria-label="Fechar perfil" /><aside className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-6"><div className="flex justify-between"><h2 className="text-xl font-semibold">Perfil do aluno</h2><button onClick={() => setSelectedStudent(null)}>×</button></div><div className="mt-8 text-center"><div className="mx-auto grid size-20 place-items-center rounded-full bg-blue-500/10 text-xl font-semibold text-blue-500">{selectedStudent.initials}</div><h3 className="mt-4 text-xl font-semibold">{selectedStudent.name}</h3><p className="text-sm text-[var(--muted)]">{selectedStudent.goal}</p></div><div className="mt-6 grid grid-cols-2 gap-2"><a href={`/treinos/${encodeURIComponent(selectedStudent.name)}`} className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Treinos</a><a href={`/avaliacoes?aluno=${encodeURIComponent(selectedStudent.name)}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 text-sm font-semibold">Avaliação física</a></div><div className="mt-8 space-y-3"><Card><p className="text-xs text-[var(--muted)]">Telefone</p><p className="mt-1 font-medium">{selectedStudent.phone}</p></Card><Card><p className="text-xs text-[var(--muted)]">E-mail</p><p className="mt-1 font-medium">{selectedStudent.email}</p></Card><Card><p className="text-xs text-[var(--muted)]">CPF</p><p className="mt-1 font-medium">{selectedStudent.cpf}</p></Card><Card><label className="text-xs font-medium text-[var(--muted)]" htmlFor="student-observations">Observações do aluno</label><textarea id="student-observations" value={selectedStudent.observations} onChange={(event) => { const observations = event.target.value; setSelectedStudent((student) => student ? { ...student, observations } : null); setStudents((current) => current.map((student) => student.id === selectedStudent.id ? { ...student, observations } : student)); }} onBlur={(event) => updateStudentNotes(selectedStudent.id, event.target.value).catch(() => setFeedback("Não foi possível salvar as observações."))} placeholder="Registre informações importantes para os próximos atendimentos." rows={5} className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm outline-none focus:border-blue-500" /></Card></div><div className="mt-8 border-t border-[var(--border)] pt-6"><Button variant="secondary" className="w-full border-red-500/30 text-red-600 hover:bg-red-500/10" disabled={deleting} onClick={removeSelectedStudent}>{deleting ? "Excluindo..." : "Excluir aluno"}</Button><p className="mt-2 text-center text-xs text-[var(--muted)]">Esta ação remove o cadastro do aluno definitivamente.</p></div></aside></div>}
    </MainLayout>
  );
}
