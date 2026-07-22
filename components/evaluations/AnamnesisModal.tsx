"use client";

import { FormEvent, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type Tab = "parq" | "general" | "files";

type Props = {
  student: string;
  onClose: () => void;
  onSave: () => void;
};

const parqQuestions = [
  "Algum médico já informou que você possui uma condição cardíaca ou pressão arterial elevada?",
  "Você sente dor ou desconforto no peito durante atividades físicas ou nas atividades do dia a dia?",
  "Nos últimos 12 meses, teve tontura, perda de equilíbrio ou perda de consciência?",
  "Possui alguma condição crônica ou problema de saúde que possa interferir na prática de exercícios?",
  "Utiliza medicamentos prescritos que possam alterar sua resposta ao exercício?",
  "Possui problema ósseo, articular, muscular ou de tecido mole que possa piorar com atividade física?",
  "Algum profissional de saúde recomendou que você pratique exercícios somente com supervisão especializada?",
];

const generalQuestions = [
  ["mainGoal", "Qual é seu objetivo principal?", "Ex.: ganhar massa muscular, reduzir gordura, melhorar a saúde"],
  ["motivation", "O que levou você a procurar ajuda de um personal trainer?", "Conte o que motivou essa decisão"],
  ["experience", "Qual é sua experiência anterior com treinamento físico?", "Modalidades, tempo de prática e períodos sem treinar"],
  ["favoriteExercises", "Quais exercícios ou modalidades você mais gosta?", "Ex.: musculação, corrida, bicicleta, exercícios livres"],
  ["difficultExercises", "Quais exercícios você não gosta, evita ou sente dificuldade para executar?", "Informe o exercício e o motivo"],
  ["pain", "Sente dor ou desconforto atualmente?", "Região, intensidade, duração e situações em que aparece"],
  ["injuries", "Já teve lesões, cirurgias ou limitações importantes?", "Informe quando ocorreu e se ainda existe alguma restrição"],
  ["healthConditions", "Possui diagnóstico, condição de saúde ou recomendação médica relevante?", "Inclua restrições fornecidas por profissionais de saúde"],
  ["medications", "Utiliza medicamentos ou suplementos regularmente?", "Nome e finalidade, quando souber"],
  ["routine", "Como é sua rotina de trabalho e nível de atividade durante o dia?", "Trabalho sentado, em pé, esforço físico, turnos e deslocamentos"],
  ["availability", "Quais dias, horários e duração você tem disponíveis para treinar?", "Ex.: segunda, quarta e sexta, 60 minutos"],
  ["sleep", "Como avalia seu sono e quantas horas costuma dormir?", "Horário, duração, despertares e qualidade percebida"],
  ["stress", "Como avalia seu nível atual de estresse?", "Baixo, moderado ou alto e principais fatores"],
  ["barriers", "O que costuma dificultar sua regularidade nos treinos?", "Tempo, trabalho, dores, motivação, deslocamento ou outros fatores"],
  ["expectations", "O que você espera do acompanhamento e como prefere receber orientações?", "Metas, tipo de suporte, comunicação e feedback"],
] as const;

export default function AnamnesisModal({ student, onClose, onSave }: Props) {
  const [tab, setTab] = useState<Tab>("parq");
  const [files, setFiles] = useState<File[]>([]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  function selectFiles(selected: FileList | null) {
    if (!selected) return;
    setFiles((current) => [...current, ...Array.from(selected)].slice(0, 12));
  }

  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="anamnesis-title">
    <form onSubmit={submit} className="mx-auto my-3 flex min-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:min-h-0">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><h2 id="anamnesis-title" className="text-xl font-semibold">Anamnese</h2><Badge tone="info">{student}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">Triagem, histórico geral e documentos do aluno.</p></div><button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></header>

      <nav className="grid grid-cols-3 gap-1 border-b border-[var(--border)] p-2 sm:gap-2 sm:p-4" aria-label="Seções da anamnese">{[["parq", "1. PAR-Q"], ["general", "2. Geral"], ["files", "3. Documentos"]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key as Tab)} className={`rounded-xl px-2 py-3 text-xs font-semibold transition sm:text-sm ${tab === key ? "bg-blue-600 text-white" : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"}`}>{label}</button>)}</nav>

      <div className="flex-1 p-4 sm:p-6">
        <section className={tab === "parq" ? "block" : "hidden"} aria-hidden={tab !== "parq"}>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4"><h3 className="font-semibold text-blue-500">Triagem de prontidão para atividade física</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Responda com sinceridade. Uma resposta positiva não significa proibição automática, mas indica que o caso precisa de análise profissional e pode exigir avaliação ou liberação de um profissional de saúde.</p></div>
          <div className="mt-5 space-y-3">{parqQuestions.map((question, index) => <fieldset key={question} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"><legend className="sr-only">Questão {index + 1}</legend><p className="text-sm font-medium leading-6"><span className="mr-2 text-blue-500">{index + 1}.</span>{question}</p><div className="mt-3 flex gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm"><input type="radio" name={`parq-${index}`} value="Não" /> Não</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm"><input type="radio" name={`parq-${index}`} value="Sim" /> Sim</label></div></fieldset>)}</div>
          <label className="mt-4 block text-sm font-medium">Observações da triagem<textarea name="parqNotes" rows={3} placeholder="Detalhes das respostas positivas, orientação recebida ou encaminhamento necessário" className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 outline-none focus:border-blue-500" /></label>
        </section>

        <section className={tab === "general" ? "block" : "hidden"} aria-hidden={tab !== "general"}>
          <div><h3 className="font-semibold">Anamnese geral</h3><p className="mt-1 text-sm text-[var(--muted)]">Informações para individualizar a prescrição e melhorar a adesão ao treinamento.</p></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">{generalQuestions.map(([name, question, placeholder], index) => <label key={name} className={`block text-sm font-medium ${index < 2 ? "lg:col-span-2" : ""}`}>{question}<textarea name={name} rows={index < 2 ? 3 : 2} placeholder={placeholder} className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 outline-none focus:border-blue-500" /></label>)}</div>
        </section>

        <section className={tab === "files" ? "block" : "hidden"} aria-hidden={tab !== "files"}>
          <div><h3 className="font-semibold">Documentos e arquivos</h3><p className="mt-1 text-sm text-[var(--muted)]">Exames, laudos, receitas, liberações e orientações de outros profissionais.</p></div>
          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] p-8 text-center transition hover:border-blue-500"><span className="grid size-12 place-items-center rounded-2xl bg-blue-500/10 text-2xl text-blue-500">＋</span><span className="mt-3 font-semibold">Selecionar documentos</span><span className="mt-1 text-xs text-[var(--muted)]">PDF, imagens ou documentos · até 12 arquivos</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="sr-only" onChange={(event) => selectFiles(event.target.files)} /></label>
          {files.length > 0 && <div className="mt-5 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-500">▤</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{(file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB</p></div><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid size-8 place-items-center rounded-lg text-red-500 hover:bg-red-500/10" aria-label={`Remover ${file.name}`}>×</button></div>)}</div>}
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-[var(--muted)]"><strong className="text-amber-500">Privacidade:</strong> estes documentos contêm dados sensíveis e deverão ter acesso restrito ao profissional responsável. Nesta versão visual, os arquivos permanecem somente na tela atual.</div>
        </section>
      </div>

      <footer className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"><p className="text-xs text-[var(--muted)]">A anamnese poderá receber novas versões sem apagar o histórico anterior.</p><div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar anamnese</Button></div></footer>
    </form>
  </div>;
}
