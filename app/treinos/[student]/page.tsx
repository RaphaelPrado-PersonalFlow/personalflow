"use client";

import { type FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { archiveTrainingProtocol, deleteTrainingProtocol, getTrainingProtocolDeletionEligibility, listTrainingProtocols, listTrainingStudents, reorderTrainingProtocols, restoreTrainingProtocol, type TrainingProtocolDeletionReason, updateTrainingProtocolDetails } from "@/services/training";
import type { Protocol, TrainingStudent } from "@/types/training";

type Props = { params: Promise<{ student: string }> };

function deletionConfirmationName(protocol: Protocol) {
  return protocol.name?.trim() || protocol.objective;
}

export default function StudentProtocolsPage({ params }: Props) {
  const router = useRouter();
  const { student: studentId } = use(params);
  const [student, setStudent] = useState<TrainingStudent | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [archivedProtocols, setArchivedProtocols] = useState<Protocol[]>([]);
  const [view, setView] = useState<"operational" | "archived">("operational");
  const [expandedProtocols, setExpandedProtocols] = useState<string[]>([]);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [protocolToArchive, setProtocolToArchive] = useState<Protocol | null>(null);
  const [protocolToDelete, setProtocolToDelete] = useState<Protocol | null>(null);
  const [blockedDeletion, setBlockedDeletion] = useState<{ protocol: Protocol; reasons: TrainingProtocolDeletionReason[] } | null>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [checkingDeletionId, setCheckingDeletionId] = useState<string | null>(null);
  const [deletingProtocol, setDeletingProtocol] = useState(false);
  const [actionError, setActionError] = useState("");
  const [changingArchiveState, setChangingArchiveState] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [protocolToEdit, setProtocolToEdit] = useState<Protocol | null>(null);
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedStudentId, setLoadedStudentId] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTrainingStudents(), listTrainingProtocols("operational"), listTrainingProtocols("archived")])
      .then(([students, operationalRows, archivedRows]) => {
        if (cancelled) return;
        setStudent(students.find((item) => item.id === studentId) ?? null);
        setProtocols(operationalRows.filter((item) => item.studentId === studentId));
        setArchivedProtocols(archivedRows.filter((item) => item.studentId === studentId));
        setLoadedStudentId(studentId);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  async function confirmProtocolArchive() {
    if (!protocolToArchive) return;
    setChangingArchiveState(true);
    setActionError("");
    try {
      const archived = await archiveTrainingProtocol(protocolToArchive.id);
      setProtocols((current) => current.filter((protocol) => protocol.id !== archived.id));
      setArchivedProtocols((current) => [...current, archived].sort((a, b) => a.displayOrder - b.displayOrder));
      setExpandedProtocols((current) => current.filter((id) => id !== archived.id));
      setProtocolToArchive(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível arquivar o protocolo.");
    } finally {
      setChangingArchiveState(false);
    }
  }

  async function restoreProtocol(protocol: Protocol) {
    setChangingArchiveState(true);
    setActionMenuId(null);
    setActionError("");
    try {
      const restored = await restoreTrainingProtocol(protocol.id);
      setArchivedProtocols((current) => current.filter((item) => item.id !== restored.id));
      setProtocols((current) => [...current, restored].sort((a, b) => a.displayOrder - b.displayOrder));
      setExpandedProtocols((current) => current.filter((id) => id !== restored.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível restaurar o protocolo.");
    } finally {
      setChangingArchiveState(false);
    }
  }

  async function requestProtocolDeletion(protocol: Protocol) {
    setActionMenuId(null);
    setActionError("");
    setCheckingDeletionId(protocol.id);
    try {
      const eligibility = await getTrainingProtocolDeletionEligibility(protocol.id);
      if (!eligibility.allowed) {
        setBlockedDeletion({ protocol, reasons: eligibility.reasons });
        return;
      }
      setDeletionConfirmation("");
      setProtocolToDelete(protocol);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível verificar se o protocolo pode ser excluído.");
    } finally {
      setCheckingDeletionId(null);
    }
  }

  async function confirmPermanentDeletion() {
    if (!protocolToDelete || deletionConfirmation !== deletionConfirmationName(protocolToDelete)) return;
    setDeletingProtocol(true);
    setActionError("");
    try {
      await deleteTrainingProtocol(protocolToDelete.id);
      setProtocols((current) => current.filter((protocol) => protocol.id !== protocolToDelete.id));
      setArchivedProtocols((current) => current.filter((protocol) => protocol.id !== protocolToDelete.id));
      setExpandedProtocols((current) => current.filter((id) => id !== protocolToDelete.id));
      setProtocolToDelete(null);
      setDeletionConfirmation("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir permanentemente o protocolo.");
    } finally {
      setDeletingProtocol(false);
    }
  }

  async function moveProtocol(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= protocols.length || reordering) return;
    const reordered = [...protocols];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setReordering(true);
    setActionError("");
    try {
      await reorderTrainingProtocols(reordered.map((protocol) => protocol.id));
      setProtocols(reordered.map((protocol, position) => ({ ...protocol, displayOrder: position + 1 })));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível alterar a ordem dos protocolos.");
    } finally {
      setReordering(false);
    }
  }

  async function saveProtocolDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!protocolToEdit) return;
    const data = new FormData(event.currentTarget);
    const next = {
      ...protocolToEdit,
      name: String(data.get("name") ?? ""), objective: String(data.get("objective") ?? ""),
      frequency: Math.max(1, Number(data.get("frequency") ?? 1)), start: String(data.get("start") ?? ""), end: String(data.get("end") ?? ""),
    };
    setSavingProtocol(true); setActionError("");
    try {
      const saved = await updateTrainingProtocolDetails(next);
      const updateSaved = (current: Protocol[]) => current.map((protocol) => protocol.id === saved.id ? saved : protocol);
      setProtocols(updateSaved);
      setArchivedProtocols(updateSaved);
      setProtocolToEdit(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível salvar o protocolo.");
    } finally { setSavingProtocol(false); }
  }

  if (loading || loadedStudentId !== studentId) return <MainLayout><Card>Carregando protocolos...</Card></MainLayout>;
  if (!student) return <MainLayout><Card className="p-8 text-center"><h1 className="text-xl font-semibold">Aluno não encontrado</h1><Button className="mt-5" onClick={() => router.push("/treinos")}>Voltar para treinos</Button></Card></MainLayout>;

  const displayedProtocols = view === "operational" ? protocols : archivedProtocols;

  return <MainLayout><div className="space-y-6">
    <PageHeader
      title={student.fullName}
      description={student.goal || "Protocolos e prescrições"}
      action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => router.push("/treinos")}>← Todos os alunos</Button><Button onClick={() => router.push(`/treinos?aluno=${student.id}&novoProtocolo=${student.id}`)}>＋ Adicionar protocolo</Button></div>}
    />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Protocolos do aluno</p><h2 className="mt-1 text-xl font-semibold">{view === "operational" ? `${protocols.length} ${protocols.length === 1 ? "protocolo operacional" : "protocolos operacionais"}` : `${archivedProtocols.length} ${archivedProtocols.length === 1 ? "protocolo arquivado" : "protocolos arquivados"}`}</h2></div><div className="flex gap-2"><Button variant={view === "operational" ? "primary" : "secondary"} onClick={() => { setView("operational"); setActionMenuId(null); }}>Operacionais</Button><Button variant={view === "archived" ? "primary" : "secondary"} onClick={() => { setView("archived"); setActionMenuId(null); }}>Arquivados ({archivedProtocols.length})</Button></div></div>
    <section className="space-y-3">
      {displayedProtocols.map((protocol, protocolIndex) => {
        const expanded = expandedProtocols.includes(protocol.id);
        return <Card key={protocol.id} className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <button type="button" onClick={() => setExpandedProtocols((current) => current.includes(protocol.id) ? current.filter((id) => id !== protocol.id) : [...current, protocol.id])} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{protocol.name ?? protocol.objective}</h3><Badge tone={protocol.status === "Ativo" ? "success" : "neutral"}>{protocol.status}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">Objetivo: {protocol.objective}</p><p className="mt-1 text-sm text-[var(--muted)]">Término: {protocol.end}</p></div>
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
            </button>
            <div className="flex shrink-0 gap-2">{view === "operational" && <><button type="button" disabled={protocolIndex === 0 || reordering} onClick={() => moveProtocol(protocolIndex, -1)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Mover ${protocol.name ?? protocol.objective} para cima`} title="Mover para cima">↑</button><button type="button" disabled={protocolIndex === protocols.length - 1 || reordering} onClick={() => moveProtocol(protocolIndex, 1)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Mover ${protocol.name ?? protocol.objective} para baixo`} title="Mover para baixo">↓</button></>}<Button onClick={() => router.push(`/treinos/${student.id}/protocolo/${protocol.id}`)}>Abrir protocolo</Button><div className="relative"><button type="button" disabled={checkingDeletionId !== null || deletingProtocol} onClick={() => setActionMenuId((current) => current === protocol.id ? null : protocol.id)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-lg disabled:opacity-50" aria-label={`Ações de ${protocol.name ?? protocol.objective}`} aria-expanded={actionMenuId === protocol.id}>⋯</button>{actionMenuId === protocol.id && <div className="absolute right-0 top-12 z-20 min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"><button type="button" onClick={() => { setProtocolToEdit(protocol); setActionMenuId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)]">Editar</button>{view === "operational" ? <button type="button" onClick={() => { setActionError(""); setProtocolToArchive(protocol); setActionMenuId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)]">Arquivar</button> : <button type="button" disabled={changingArchiveState} onClick={() => restoreProtocol(protocol)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)] disabled:opacity-50">Restaurar protocolo</button>}<button type="button" onClick={() => requestProtocolDeletion(protocol)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10">Excluir permanentemente</button></div>}</div></div>
          </div>
          {expanded && <div className="border-t border-[var(--border)] bg-[var(--surface-raised)]/40 p-4 sm:p-5">
            <div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-[var(--muted)]">Início</span><strong className="mt-1 block">{protocol.start}</strong></div><div><span className="text-[var(--muted)]">Frequência</span><strong className="mt-1 block">{protocol.frequency}× por semana</strong></div><div><span className="text-[var(--muted)]">Períodos</span><strong className="mt-1 block">{protocol.periods.length}</strong></div></div>
          </div>}
        </Card>;
      })}
    </section>
    {actionError && !protocolToArchive && <Card className="border-red-500/30 bg-red-500/10 text-sm text-red-500">{actionError}</Card>}
    {!displayedProtocols.length && <Card className="p-8 text-center text-sm text-[var(--muted)]">{view === "operational" ? "Este aluno não possui protocolos operacionais." : "Este aluno não possui protocolos arquivados."}</Card>}
    {protocolToArchive && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="archive-protocol-title" onClick={() => !changingArchiveState && setProtocolToArchive(null)}>
      <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}><p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Arquivar protocolo</p><h2 id="archive-protocol-title" className="mt-2 text-xl font-semibold">Arquivar {protocolToArchive.name ?? protocolToArchive.objective}?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">O protocolo será removido das listas operacionais. Períodos, treinos e histórico serão preservados.</p>{actionError && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{actionError}</p>}<div className="mt-6 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={changingArchiveState} onClick={() => setProtocolToArchive(null)}>Cancelar</Button><Button disabled={changingArchiveState} onClick={confirmProtocolArchive}>{changingArchiveState ? "Arquivando…" : "Arquivar protocolo"}</Button></div></Card>
    </div>}
    {blockedDeletion && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="blocked-deletion-title" onClick={() => setBlockedDeletion(null)}><Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}><p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Exclusão bloqueada</p><h2 id="blocked-deletion-title" className="mt-2 text-xl font-semibold">Este protocolo não pode ser excluído permanentemente</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Ele possui histórico ou versões protegidas. Você pode mantê-lo arquivado.</p>{blockedDeletion.reasons.length > 0 && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">{blockedDeletion.reasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}</ul>}<div className="mt-6 flex justify-end"><Button onClick={() => setBlockedDeletion(null)}>Entendi</Button></div></Card></div>}
    {protocolToDelete && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="permanent-deletion-title" onClick={() => !deletingProtocol && setProtocolToDelete(null)}><Card className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}><p className="text-xs font-semibold uppercase tracking-wider text-red-500">Exclusão permanente</p><h2 id="permanent-deletion-title" className="mt-2 text-xl font-semibold">Excluir {deletionConfirmationName(protocolToDelete)}?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Esta ação removerá permanentemente este protocolo e toda a prescrição ainda não utilizada, incluindo períodos, treinos em rascunho, exercícios e séries. Esta ação não pode ser desfeita.</p><label className="mt-5 block text-sm font-medium">Digite <strong>{deletionConfirmationName(protocolToDelete)}</strong> para confirmar<input autoFocus autoComplete="off" disabled={deletingProtocol} value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label>{actionError && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{actionError}</p>}<div className="mt-6 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={deletingProtocol} onClick={() => { setProtocolToDelete(null); setDeletionConfirmation(""); }}>Cancelar</Button><button type="button" disabled={deletingProtocol || deletionConfirmation !== deletionConfirmationName(protocolToDelete)} onClick={confirmPermanentDeletion} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50">{deletingProtocol ? "Excluindo..." : "Excluir permanentemente"}</button></div></Card></div>}
    {protocolToEdit && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-protocol-title" onClick={() => !savingProtocol && setProtocolToEdit(null)}><Card className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}><form onSubmit={saveProtocolDetails}><h2 id="edit-protocol-title" className="text-xl font-semibold">Editar protocolo</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Nome<input name="name" defaultValue={protocolToEdit.name ?? ""} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-sm">Objetivo<input name="objective" required defaultValue={protocolToEdit.objective} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-sm">Frequência semanal<input name="frequency" type="number" min="1" max="7" required defaultValue={protocolToEdit.frequency} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-sm">Início<input name="start" required defaultValue={protocolToEdit.start} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-sm sm:col-span-2">Término<input name="end" required defaultValue={protocolToEdit.end} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3" /></label></div><div className="mt-6 grid grid-cols-2 gap-2"><Button type="button" variant="secondary" disabled={savingProtocol} onClick={() => setProtocolToEdit(null)}>Cancelar</Button><Button type="submit" disabled={savingProtocol}>{savingProtocol ? "Salvando…" : "Salvar protocolo"}</Button></div></form></Card></div>}
  </div></MainLayout>;
}
