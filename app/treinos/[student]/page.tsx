"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { listTrainingProtocols, listTrainingStudents } from "@/services/training";
import type { Protocol, TrainingStudent } from "@/types/training";

type Props = { params: Promise<{ student: string }> };

export default function StudentProtocolsPage({ params }: Props) {
  const router = useRouter();
  const { student: studentId } = use(params);
  const [student, setStudent] = useState<TrainingStudent | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [expandedProtocols, setExpandedProtocols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTrainingStudents(), listTrainingProtocols()]).then(([students, rows]) => {
      setStudent(students.find((item) => item.id === studentId) ?? null);
      setProtocols(rows.filter((item) => item.studentId === studentId));
    }).finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <MainLayout><Card>Carregando protocolos...</Card></MainLayout>;
  if (!student) return <MainLayout><Card className="p-8 text-center"><h1 className="text-xl font-semibold">Aluno não encontrado</h1><Button className="mt-5" onClick={() => router.push("/treinos")}>Voltar para treinos</Button></Card></MainLayout>;

  return <MainLayout><div className="space-y-6">
    <PageHeader title={student.fullName} description={student.goal || "Protocolos e prescrições"} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => router.push("/treinos")}>← Todos os alunos</Button><Button onClick={() => router.push(`/treinos?novoProtocolo=${student.id}`)}>＋ Adicionar protocolo</Button></div>} />
    <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Protocolos do aluno</p><h2 className="mt-1 text-xl font-semibold">{protocols.length} {protocols.length === 1 ? "protocolo cadastrado" : "protocolos cadastrados"}</h2></div>
    <section className="space-y-3">{protocols.map((protocol) => { const expanded = expandedProtocols.includes(protocol.id); return <Card key={protocol.id} className="overflow-hidden p-0"><div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"><button type="button" onClick={() => setExpandedProtocols((current) => current.includes(protocol.id) ? current.filter((id) => id !== protocol.id) : [...current, protocol.id])} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{protocol.name ?? protocol.objective}</h3><Badge tone={protocol.status === "Ativo" ? "success" : "neutral"}>{protocol.status}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">Objetivo: {protocol.objective}</p><p className="mt-1 text-sm text-[var(--muted)]">Término: {protocol.end}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span></button><Button onClick={() => router.push(`/treinos/${student.id}/protocolo/${protocol.id}`)}>Abrir protocolo</Button></div>{expanded && <div className="border-t border-[var(--border)] bg-[var(--surface-raised)]/40 p-4 sm:p-5"><div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-[var(--muted)]">Início</span><strong className="mt-1 block">{protocol.start}</strong></div><div><span className="text-[var(--muted)]">Frequência</span><strong className="mt-1 block">{protocol.frequency}× por semana</strong></div><div><span className="text-[var(--muted)]">Períodos</span><strong className="mt-1 block">{protocol.periods.length}</strong></div></div><div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => protocol.workouts[0] && router.push(`/treinos?editarProtocolo=${protocol.id}&editarTreino=${protocol.workouts[0].id}`)}>Editar protocolo</Button></div></div>}</Card>; })}</section>
    {!protocols.length && <Card className="p-8 text-center text-sm text-[var(--muted)]">Este aluno ainda não possui protocolos.</Card>}
  </div></MainLayout>;
}
