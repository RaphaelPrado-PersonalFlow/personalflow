"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { deleteTrainingProtocol, listTrainingProtocols, listTrainingStudents, reorderTrainingProtocols } from "@/services/training";
import type { Protocol, TrainingStudent } from "@/types/training";

type Props = { params: Promise<{ student: string }> };

export default function StudentProtocolsPage({ params }: Props) {
  const router = useRouter();
  const { student: studentId } = use(params);
  const [student, setStudent] = useState<TrainingStudent | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [expandedProtocols, setExpandedProtocols] = useState<string[]>([]);
  const [protocolToDelete, setProtocolToDelete] = useState<Protocol | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTrainingStudents(), listTrainingProtocols()])
      .then(([students, rows]) => {
        setStudent(students.find((item) => item.id === studentId) ?? null);
        setProtocols(rows.filter((item) => item.studentId === studentId));
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  async function confirmProtocolDeletion() {
    if (!protocolToDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteTrainingProtocol(protocolToDelete.id);
      setProtocols((current) => current.filter((protocol) => protocol.id !== protocolToDelete.id));
      setExpandedProtocols((current) => current.filter((id) => id !== protocolToDelete.id));
      setProtocolToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir o protocolo.");
    } finally {
      setDeleting(false);
    }
  }

  async function moveProtocol(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= protocols.length || reordering) return;
    const reordered = [...protocols];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setReordering(true);
    setDeleteError("");
    try {
      await reorderTrainingProtocols(reordered.map((protocol) => protocol.id));
      setProtocols(reordered.map((protocol, position) => ({ ...protocol, displayOrder: position + 1 })));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível alterar a ordem dos protocolos.");
    } finally {
      setReordering(false);
    }
  }

  if (loading) return <MainLayout><Card>Carregando protocolos...</Card></MainLayout>;
  if (!student) return <MainLayout><Card className="p-8 text-center"><h1 className="text-xl font-semibold">Aluno não encontrado</h1><Button className="mt-5" onClick={() => router.push("/treinos")}>Voltar para treinos</Button></Card></MainLayout>;

  return <MainLayout><div className="space-y-6">
    <PageHeader
      title={student.fullName}
      description={student.goal || "Protocolos e prescrições"}
      action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => router.push("/treinos")}>← Todos os alunos</Button><Button onClick={() => router.push(`/treinos?novoProtocolo=${student.id}`)}>＋ Adicionar protocolo</Button></div>}
    />
    <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Protocolos do aluno</p><h2 className="mt-1 text-xl font-semibold">{protocols.length} {protocols.length === 1 ? "protocolo cadastrado" : "protocolos cadastrados"}</h2></div>
    <section className="space-y-3">
      {protocols.map((protocol, protocolIndex) => {
        const expanded = expandedProtocols.includes(protocol.id);
        const period = protocol.periods.find((item) => item.id === protocol.activePeriodId) ?? protocol.periods[0];
        const workout = period?.workouts[0];
        const editorUrl = `/treinos?editarProtocolo=${protocol.id}${period ? `&periodo=${period.id}` : ""}${workout ? `&editarTreino=${workout.id}` : ""}`;
        return <Card key={protocol.id} className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <button type="button" onClick={() => setExpandedProtocols((current) => current.includes(protocol.id) ? current.filter((id) => id !== protocol.id) : [...current, protocol.id])} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{protocol.name ?? protocol.objective}</h3><Badge tone={protocol.status === "Ativo" ? "success" : "neutral"}>{protocol.status}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">Objetivo: {protocol.objective}</p><p className="mt-1 text-sm text-[var(--muted)]">Término: {protocol.end}</p></div>
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
            </button>
            <div className="flex shrink-0 gap-2"><button type="button" disabled={protocolIndex === 0 || reordering} onClick={() => moveProtocol(protocolIndex, -1)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Mover ${protocol.name ?? protocol.objective} para cima`} title="Mover para cima">↑</button><button type="button" disabled={protocolIndex === protocols.length - 1 || reordering} onClick={() => moveProtocol(protocolIndex, 1)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Mover ${protocol.name ?? protocol.objective} para baixo`} title="Mover para baixo">↓</button><Button onClick={() => router.push(`/treinos/${student.id}/protocolo/${protocol.id}`)}>Abrir protocolo</Button></div>
          </div>
          {expanded && <div className="border-t border-[var(--border)] bg-[var(--surface-raised)]/40 p-4 sm:p-5">
            <div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-[var(--muted)]">Início</span><strong className="mt-1 block">{protocol.start}</strong></div><div><span className="text-[var(--muted)]">Frequência</span><strong className="mt-1 block">{protocol.frequency}× por semana</strong></div><div><span className="text-[var(--muted)]">Períodos</span><strong className="mt-1 block">{protocol.periods.length}</strong></div></div>
            <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setDeleteError(""); setProtocolToDelete(protocol); }} className="h-10 rounded-xl border border-red-500/30 px-4 text-sm font-semibold text-red-500 hover:bg-red-500/10">Excluir protocolo</button><Button variant="secondary" onClick={() => router.push(editorUrl)}>Editar protocolo</Button></div>
          </div>}
        </Card>;
      })}
    </section>
    {deleteError && !protocolToDelete && <Card className="border-red-500/30 bg-red-500/10 text-sm text-red-500">{deleteError}</Card>}
    {!protocols.length && <Card className="p-8 text-center text-sm text-[var(--muted)]">Este aluno ainda não possui protocolos.</Card>}
    {protocolToDelete && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-protocol-title" onClick={() => !deleting && setProtocolToDelete(null)}>
      <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}><p className="text-xs font-semibold uppercase tracking-wider text-red-500">Excluir protocolo</p><h2 id="delete-protocol-title" className="mt-2 text-xl font-semibold">Excluir {protocolToDelete.name ?? protocolToDelete.objective}?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Esta ação removerá permanentemente os períodos, treinos, exercícios prescritos e séries vinculados ao protocolo.</p>{deleteError && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{deleteError}</p>}<div className="mt-6 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={deleting} onClick={() => setProtocolToDelete(null)}>Cancelar</Button><button type="button" disabled={deleting} onClick={confirmProtocolDeletion} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-wait disabled:opacity-60">{deleting ? "Excluindo..." : "Excluir protocolo"}</button></div></Card>
    </div>}
  </div></MainLayout>;
}
