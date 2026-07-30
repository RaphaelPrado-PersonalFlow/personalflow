"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import {
  equipments,
  exerciseLibrary,
  LibraryExercise as Exercise,
  movements,
  muscleGroups,
} from "@/lib/exercise-library";
import { exerciseRepository } from "@/services/exercise-repository";

function contributionLabel(factor: number) { return factor === 1 ? "1 série" : `${factor.toLocaleString("pt-BR")} série`; }

export default function ExercisesPage() {
  const [exercises, setExercises] = useState(exerciseLibrary);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("Todos");
  const [equipment, setEquipment] = useState("Todos");
  const [visibility, setVisibility] = useState("Ativos");
  const [expanded, setExpanded] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    exerciseRepository.listCustom().then((customExercises) => {
      setExercises([...customExercises, ...exerciseLibrary]);
    });
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR");
    return exercises.filter((exercise) =>
      (visibility === "Todos" || (visibility === "Ativos" ? exercise.active : !exercise.active)) &&
      (muscle === "Todos" || exercise.muscles.some((item) => item.muscle === muscle)) &&
      (equipment === "Todos" || exercise.equipment === equipment) &&
      (`${exercise.name} ${exercise.aliases}`.toLocaleLowerCase("pt-BR").includes(normalized)));
  }, [equipment, exercises, muscle, query, visibility]);

  function openCreateModal() {
    setEditingExercise(null);
    setModalOpen(true);
  }

  function openEditModal(exercise: Exercise) {
    setEditingExercise(exercise);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingExercise(null);
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const primary = String(data.get("primary"));
    const secondary = String(data.get("secondary"));
    if (!name || !primary) return;
    const exercise: Exercise = { id: editingExercise?.id ?? Date.now(), name, aliases: String(data.get("aliases") || ""), equipment: String(data.get("equipment")), movement: String(data.get("movement")), type: String(data.get("type")), laterality: String(data.get("laterality")), level: String(data.get("level")), origin: "Personalizado", active: editingExercise?.active ?? true, instructions: String(data.get("instructions") || ""), muscles: [{ muscle: primary, factor: 1, role: "Principal" }, ...(secondary && secondary !== "Nenhum" ? [{ muscle: secondary, factor: .5, role: "Secundário" as const }] : [])] };
    await exerciseRepository.saveCustom(exercise);
    setExercises((current) => editingExercise
      ? current.map((item) => item.id === exercise.id ? exercise : item)
      : [exercise, ...current]);
    setExpanded((current) => current.includes(exercise.id) ? current : [exercise.id, ...current]);
    closeModal();
    event.currentTarget.reset();
  }

  async function duplicateExercise(exercise: Exercise) {
    const copy = { ...exercise, id: Math.max(...exercises.map((item) => item.id), 0) + 1, name: `${exercise.name} (cópia)`, origin: "Personalizado" as const, muscles: exercise.muscles.map((item) => ({ ...item })) };
    await exerciseRepository.saveCustom(copy);
    setExercises((current) => [copy, ...current]);
    setExpanded((current) => [copy.id, ...current]);
  }

  async function toggleArchived(exercise: Exercise) {
    if (exercise.origin !== "Personalizado") return;
    if (exercise.active) await exerciseRepository.archiveCustom(exercise.id);
    else await exerciseRepository.restoreCustom(exercise.id);
    setExercises((current) => current.map((item) => item.id === exercise.id ? { ...item, active: !item.active } : item));
  }

  return <MainLayout><div className="space-y-7">
    <PageHeader title="Exercícios" description="Pesquise, classifique e organize a biblioteca usada nas prescrições." action={<Button onClick={openCreateModal}>＋ Novo exercício</Button>} />

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Exercícios ativos" value={exercises.filter((item) => item.active).length} detail="Disponíveis para prescrição" tone="blue" /><StatCard title="Grupos musculares" value={muscleGroups.length} detail="Classificação atual" tone="green" /><StatCard title="Personalizados" value={exercises.filter((item) => item.origin === "Personalizado").length} detail="Criados por você" tone="violet" /><StatCard title="Sem classificação" value={0} detail="Biblioteca consistente" tone="amber" /></section>

    <Card className="p-4"><div className="grid gap-3 lg:grid-cols-[1fr_220px_200px_160px]"><label className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar exercício ou nome alternativo" className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 text-sm outline-none focus:border-blue-500" /></label><select value={muscle} onChange={(event) => setMuscle(event.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option>Todos</option>{muscleGroups.map((item) => <option key={item}>{item}</option>)}</select><select value={equipment} onChange={(event) => setEquipment(event.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option>Todos</option>{equipments.map((item) => <option key={item}>{item}</option>)}</select><select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"><option>Ativos</option><option>Arquivados</option><option>Todos</option></select></div></Card>

    <section className="space-y-3">{filtered.map((exercise) => { const isExpanded = expanded.includes(exercise.id); const primary = exercise.muscles.find((item) => item.role === "Principal"); return <Card key={exercise.id} className="overflow-hidden p-0"><div className="flex items-center gap-3 p-4 sm:p-5"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-lg text-blue-500">＋</div><button type="button" onClick={() => setExpanded((current) => current.includes(exercise.id) ? current.filter((id) => id !== exercise.id) : [...current, exercise.id])} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{exercise.name}</h2><Badge tone={exercise.origin === "Sistema" ? "neutral" : "info"}>{exercise.origin}</Badge>{!exercise.active && <Badge tone="warning">Arquivado</Badge>}</div><p className="mt-1 text-sm text-[var(--muted)]">{primary?.muscle} · {exercise.equipment} · {exercise.movement}</p></button><button type="button" onClick={() => setExpanded((current) => current.includes(exercise.id) ? current.filter((id) => id !== exercise.id) : [...current, exercise.id])} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${exercise.name}`}><span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span></button></div>{isExpanded && <div className="grid gap-5 border-t border-[var(--border)] p-4 sm:p-5 lg:grid-cols-2"><div><h3 className="text-sm font-semibold">Participação muscular e volume</h3><div className="mt-3 space-y-2">{exercise.muscles.map((item) => <div key={item.muscle} className="flex items-center justify-between rounded-xl bg-[var(--background)] p-3"><div><p className="text-sm font-medium">{item.muscle}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{item.role}</p></div><Badge tone={item.role === "Principal" ? "success" : "info"}>{contributionLabel(item.factor)}</Badge></div>)}</div><p className="mt-3 text-xs text-[var(--muted)]">Valor gerado por cada série válida realizada.</p></div><div><h3 className="text-sm font-semibold">Detalhes técnicos</h3><dl className="mt-3 grid grid-cols-2 gap-2 text-sm">{[["Tipo", exercise.type], ["Lateralidade", exercise.laterality], ["Nível", exercise.level], ["Equipamento", exercise.equipment]].map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--background)] p-3"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><div className="mt-3 rounded-xl bg-[var(--background)] p-3"><p className="text-xs text-[var(--muted)]">Orientação</p><p className="mt-1 text-sm leading-6">{exercise.instructions || "Nenhuma orientação cadastrada."}</p></div></div><div className="flex flex-col gap-2 sm:flex-row lg:col-span-2 lg:justify-end">{exercise.origin === "Personalizado" && <Button variant="secondary" onClick={() => openEditModal(exercise)}>Editar exercício</Button>}{exercise.origin === "Personalizado" && <Button variant="ghost" onClick={() => toggleArchived(exercise)}>{exercise.active ? "Arquivar" : "Restaurar"}</Button>}<Button variant="secondary" onClick={() => duplicateExercise(exercise)}>Duplicar exercício</Button>{exercise.active && <Button>Usar na prescrição</Button>}</div></div>}</Card>; })}</section>
    {filtered.length === 0 && <Card className="grid min-h-56 place-items-center text-center"><div><p className="text-lg font-semibold">Nenhum exercício encontrado</p><p className="mt-2 text-sm text-[var(--muted)]">Altere a pesquisa ou os filtros selecionados.</p></div></Card>}
  </div>

  {modalOpen && (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="exercise-form-title">
      <form key={editingExercise?.id ?? "new"} onSubmit={saveExercise} className="mx-auto my-4 w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="exercise-form-title" className="text-xl font-semibold">{editingExercise ? "Editar exercício" : "Novo exercício"}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{editingExercise ? "Atualize os dados do exercício personalizado." : "Cadastre a classificação necessária para prescrição e volume."}</p>
          </div>
          <button type="button" onClick={closeModal} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">Nome oficial<input name="name" required defaultValue={editingExercise?.name ?? ""} placeholder="Ex.: Supino reto com halteres" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label>
          <label className="text-sm font-medium sm:col-span-2">Nomes alternativos<input name="aliases" defaultValue={editingExercise?.aliases ?? ""} placeholder="Separe por vírgulas" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label>
          <label className="text-sm font-medium">Músculo principal<select name="primary" defaultValue={editingExercise?.muscles.find((item) => item.role === "Principal")?.muscle ?? muscleGroups[0]} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{muscleGroups.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-medium">Músculo secundário<select name="secondary" defaultValue={editingExercise?.muscles.find((item) => item.role === "Secundário")?.muscle ?? "Nenhum"} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Nenhum</option>{muscleGroups.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-medium">Equipamento<select name="equipment" defaultValue={editingExercise?.equipment ?? equipments[0]} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{equipments.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-medium">Padrão de movimento<select name="movement" defaultValue={editingExercise?.movement ?? movements[0]} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">{movements.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-medium">Tipo<select name="type" defaultValue={editingExercise?.type ?? "Composto"} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Composto</option><option>Isolado</option><option>Isométrico</option><option>Mobilidade</option><option>Aeróbio</option></select></label>
          <label className="text-sm font-medium">Lateralidade<select name="laterality" defaultValue={editingExercise?.laterality ?? "Bilateral"} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Bilateral</option><option>Unilateral</option><option>Alternado</option><option>Não aplicável</option></select></label>
          <label className="text-sm font-medium">Nível<select name="level" defaultValue={editingExercise?.level ?? "Iniciante"} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></label>
          <label className="text-sm font-medium sm:col-span-2">Orientações<textarea name="instructions" rows={3} defaultValue={editingExercise?.instructions ?? ""} placeholder="Pontos importantes para execução e segurança" className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 outline-none focus:border-blue-500" /></label>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
          <Button type="submit">{editingExercise ? "Salvar alterações" : "Cadastrar exercício"}</Button>
        </div>
      </form>
    </div>
  )}
  </MainLayout>;
}
