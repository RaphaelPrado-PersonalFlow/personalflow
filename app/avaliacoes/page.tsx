"use client";

import { FormEvent, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EvolutionChart, { ChartAssessment, ChartMetric } from "@/components/evaluations/EvolutionChart";
import {
  BodyFatProtocol,
  BiologicalSex,
  calculateBodyFat,
  circumferenceFields,
  requiredMeasurements,
  skinfoldFields,
} from "@/lib/body-composition";

type Assessment = {
  id: number;
  student: string;
  date: string;
  type: "Inicial" | "Reavaliação";
  weight: number;
  height: number;
  bodyFat: number;
  waist: number;
  leanMass: number;
  notes?: string;
  sex?: BiologicalSex;
  age?: number;
  protocol?: BodyFatProtocol;
  circumferences?: Record<string, number>;
  skinfolds?: Record<string, number>;
  photos?: string[];
};

const students = ["João Mendes", "Mariana Costa", "Carlos Lima", "Ana Souza", "Paulo Rocha", "Beatriz Alves"];

const initialAssessments: Assessment[] = [
  { id: 1, student: "João Mendes", date: "18/07/2026", type: "Reavaliação", weight: 81.2, height: 1.78, bodyFat: 15.8, waist: 84, leanMass: 68.4, circumferences: { neck: 38, waist: 84, abdomen: 87, hip: 99, rightContractedArm: 37, leftContractedArm: 36.5, rightMidThigh: 58, leftMidThigh: 57.5, rightCalf: 39, leftCalf: 38.5 }, skinfolds: { triceps: 11, chest: 9, abdomen: 18, suprailiac: 12, thigh: 15 } },
  { id: 2, student: "João Mendes", date: "15/04/2026", type: "Inicial", weight: 84.6, height: 1.78, bodyFat: 18.9, waist: 89, leanMass: 68.6, circumferences: { neck: 39, waist: 89, abdomen: 93, hip: 102, rightContractedArm: 36, leftContractedArm: 35.5, rightMidThigh: 60, leftMidThigh: 59.5, rightCalf: 40, leftCalf: 39.5 }, skinfolds: { triceps: 14, chest: 12, abdomen: 24, suprailiac: 16, thigh: 19 } },
  { id: 3, student: "Mariana Costa", date: "12/07/2026", type: "Reavaliação", weight: 65.8, height: 1.64, bodyFat: 25.2, waist: 73, leanMass: 49.2 },
  { id: 4, student: "Mariana Costa", date: "10/04/2026", type: "Inicial", weight: 69.1, height: 1.64, bodyFat: 28.4, waist: 78, leanMass: 49.5 },
  { id: 5, student: "Ana Souza", date: "02/07/2026", type: "Inicial", weight: 58.4, height: 1.62, bodyFat: 21.7, waist: 68, leanMass: 45.7 },
  { id: 6, student: "Carlos Lima", date: "25/06/2026", type: "Inicial", weight: 92.3, height: 1.82, bodyFat: 23.1, waist: 98, leanMass: 71 },
];

function formatNumber(value: number, suffix = "") {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}`;
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [selectedStudent, setSelectedStudent] = useState("João Mendes");
  const [modalOpen, setModalOpen] = useState(false);
  const [details, setDetails] = useState<Assessment | null>(null);
  const [sex, setSex] = useState<BiologicalSex>("Masculino");
  const [protocol, setProtocol] = useState<BodyFatProtocol>("Jackson-Pollock 3 dobras");
  const [calculatedBodyFat, setCalculatedBodyFat] = useState<number | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<number[]>([1, 2]);
  const [circumferenceMetric, setCircumferenceMetric] = useState("sum");
  const [skinfoldMetric, setSkinfoldMetric] = useState("sum");

  const studentAssessments = useMemo(
    () => assessments.filter((assessment) => assessment.student === selectedStudent),
    [assessments, selectedStudent],
  );
  const latest = studentAssessments[0];
  const previous = studentAssessments[1];

  function addAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const student = String(data.get("student"));
    const weight = Number(data.get("weight"));
    const heightCm = Number(data.get("height"));
    const age = Number(data.get("age"));
    const notes = String(data.get("notes") || "").trim();
    const circumferences = Object.fromEntries(circumferenceFields.map(([key]) => [key, Number(data.get(`circumference-${key}`)) || 0]));
    const skinfolds = Object.fromEntries(skinfoldFields.map(([key]) => [key, Number(data.get(`skinfold-${key}`)) || 0]));
    const waist = circumferences.waist || circumferences.abdomen || 0;
    const bodyFat = calculateBodyFat({ sex, age, heightCm, protocol, circumferences, skinfolds });
    if (!student || !weight || !heightCm || !age || bodyFat === null) return;
    const height = heightCm / 100;
    const newAssessment: Assessment = {
      id: Date.now(), student, date: new Date().toLocaleDateString("pt-BR"),
      type: assessments.some((item) => item.student === student) ? "Reavaliação" : "Inicial",
      weight, height, bodyFat: Number(bodyFat.toFixed(1)), waist,
      leanMass: Number((weight * (1 - bodyFat / 100)).toFixed(1)), notes,
      sex, age, protocol, circumferences, skinfolds, photos: photoPreviews,
    };
    setAssessments((current) => [newAssessment, ...current]);
    setSelectedStudent(student);
    setSelectedAssessmentIds([newAssessment.id, ...assessments.filter((item) => item.student === student).map((item) => item.id)]);
    setModalOpen(false);
    setCalculatedBodyFat(null);
    setPhotoPreviews([]);
    event.currentTarget.reset();
  }

  function updateCalculation(form: HTMLFormElement) {
    const data = new FormData(form);
    const age = Number(data.get("age"));
    const heightCm = Number(data.get("height"));
    const circumferences = Object.fromEntries(circumferenceFields.map(([key]) => [key, Number(data.get(`circumference-${key}`)) || 0]));
    const skinfolds = Object.fromEntries(skinfoldFields.map(([key]) => [key, Number(data.get(`skinfold-${key}`)) || 0]));
    setCalculatedBodyFat(calculateBodyFat({ sex, age, heightCm, protocol, circumferences, skinfolds }));
  }

  function handlePhotos(files: FileList | null) {
    if (!files) return;
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviews(Array.from(files).slice(0, 4).map((file) => URL.createObjectURL(file)));
  }

  const weightChange = latest && previous ? latest.weight - previous.weight : 0;
  const fatChange = latest && previous ? latest.bodyFat - previous.bodyFat : 0;
  const waistChange = latest && previous ? latest.waist - previous.waist : 0;
  const leanMassChange = latest && previous ? latest.leanMass - previous.leanMass : 0;

  const massMetrics = useMemo<ChartMetric[]>(() => [
    { key: "weight", label: "Peso total", unit: "kg", color: "#3b82f6", getValue: (assessment) => assessment.weight },
    { key: "fatMass", label: "Peso de gordura", unit: "kg", color: "#f97316", getValue: (assessment) => Number((assessment.weight * assessment.bodyFat / 100).toFixed(1)) },
    { key: "leanMass", label: "Peso de massa magra", unit: "kg", color: "#10b981", getValue: (assessment) => assessment.leanMass },
  ], []);

  const bodyFatMetrics = useMemo<ChartMetric[]>(() => [
    { key: "bodyFat", label: "Percentual de gordura", unit: "%", color: "#8b5cf6", getValue: (assessment) => assessment.bodyFat },
  ], []);

  const circumferenceOptions = useMemo(() => [["sum", "Somatório das circunferências"], ...circumferenceFields] as [string, string][], []);
  const skinfoldOptions = useMemo(() => [["sum", "Somatório das dobras cutâneas"], ...skinfoldFields] as [string, string][], []);

  const circumferenceChartMetric = useMemo<ChartMetric[]>(() => {
    const label = circumferenceOptions.find(([key]) => key === circumferenceMetric)?.[1] ?? "Circunferência";
    return [{
      key: `circumference-${circumferenceMetric}`,
      label,
      unit: "cm",
      color: "#06b6d4",
      getValue: (assessment: ChartAssessment) => circumferenceMetric === "sum"
        ? Object.values(assessment.circumferences ?? {}).reduce((total, value) => total + (value > 0 ? value : 0), 0) || undefined
        : assessment.circumferences?.[circumferenceMetric],
    }];
  }, [circumferenceMetric, circumferenceOptions]);

  const skinfoldChartMetric = useMemo<ChartMetric[]>(() => {
    const label = skinfoldOptions.find(([key]) => key === skinfoldMetric)?.[1] ?? "Dobra cutânea";
    return [{
      key: `skinfold-${skinfoldMetric}`,
      label,
      unit: "mm",
      color: "#ec4899",
      getValue: (assessment: ChartAssessment) => skinfoldMetric === "sum"
        ? Object.values(assessment.skinfolds ?? {}).reduce((total, value) => total + (value > 0 ? value : 0), 0) || undefined
        : assessment.skinfolds?.[skinfoldMetric],
    }];
  }, [skinfoldMetric, skinfoldOptions]);

  const comparedAssessments = studentAssessments.filter((assessment) => selectedAssessmentIds.includes(assessment.id));

  function toggleAssessment(id: number) {
    setSelectedAssessmentIds((current) => current.includes(id)
      ? current.length === 1 ? current : current.filter((item) => item !== id)
      : [...current, id]);
  }

  function changeSelectedStudent(student: string) {
    setSelectedStudent(student);
    setSelectedAssessmentIds(assessments.filter((assessment) => assessment.student === student).map((assessment) => assessment.id));
  }

  return (
    <MainLayout>
      <div className="space-y-7">
        <PageHeader title="Avaliações" description="Registre medidas e acompanhe a evolução corporal dos alunos." action={<Button onClick={() => setModalOpen(true)}>＋ Nova avaliação</Button>} />

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Aluno selecionado</p><select value={selectedStudent} onChange={(event) => changeSelectedStudent(event.target.value)} className="mt-2 h-11 min-w-64 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-blue-500">{students.map((student) => <option key={student}>{student}</option>)}</select></div>
            <div className="flex items-center gap-2"><Badge tone={latest ? "success" : "warning"}>{latest ? `${studentAssessments.length} avaliações` : "Sem avaliação"}</Badge>{latest && <span className="text-sm text-[var(--muted)]">Última em {latest.date}</span>}</div>
          </div>
        </Card>

        {latest ? <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Peso atual" value={formatNumber(latest.weight, " kg")} detail={previous ? `${weightChange > 0 ? "+" : ""}${formatNumber(weightChange, " kg")} desde a anterior` : "Primeira avaliação"} tone="blue" />
            <StatCard title="Gordura corporal" value={formatNumber(latest.bodyFat, "%")} detail={previous ? `${fatChange > 0 ? "+" : ""}${formatNumber(fatChange, " p.p.")} desde a anterior` : "Primeira avaliação"} tone="violet" />
            <StatCard title="Cintura" value={formatNumber(latest.waist, " cm")} detail={previous ? `${waistChange > 0 ? "+" : ""}${formatNumber(waistChange, " cm")} desde a anterior` : "Primeira avaliação"} tone="green" />
            <StatCard title="Massa magra" value={formatNumber(latest.leanMass, " kg")} detail={previous ? `${leanMassChange > 0 ? "+" : ""}${formatNumber(leanMassChange, " kg")} desde a anterior` : "Primeira avaliação"} tone="amber" />
          </section>

          <section className="space-y-6">
            <Card>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-semibold">Avaliações para comparar</h2><p className="mt-1 text-sm text-[var(--muted)]">Marque uma ou mais avaliações. Todos os gráficos usarão o mesmo período.</p></div>
                  <Badge tone="info">{selectedStudent}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {studentAssessments.map((assessment) => {
                    const selected = selectedAssessmentIds.includes(assessment.id);
                    return <button key={assessment.id} type="button" onClick={() => toggleAssessment(assessment.id)} aria-pressed={selected} className={`rounded-xl border px-4 py-3 text-left transition ${selected ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:border-blue-500/60"}`}><span className="block text-sm font-semibold">{assessment.date}</span><span className="mt-0.5 block text-xs">{assessment.type}</span></button>;
                  })}
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <div><h2 className="font-semibold">Composição corporal em peso</h2><p className="mt-1 text-sm text-[var(--muted)]">Peso total, peso de gordura e peso de massa magra</p></div>
                <div className="mt-6"><EvolutionChart assessments={comparedAssessments} metrics={massMetrics} /></div>
              </Card>

              <Card>
                <div><h2 className="font-semibold">Percentual de gordura</h2><p className="mt-1 text-sm text-[var(--muted)]">Evolução do percentual de gordura corporal</p></div>
                <div className="mt-6"><EvolutionChart assessments={comparedAssessments} metrics={bodyFatMetrics} /></div>
              </Card>

              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><h2 className="font-semibold">Circunferências</h2><p className="mt-1 text-sm text-[var(--muted)]">Escolha uma medida ou o somatório</p></div>
                  <label className="text-xs font-medium text-[var(--muted)]">Medida<select value={circumferenceMetric} onChange={(event) => setCircumferenceMetric(event.target.value)} className="mt-1.5 h-10 w-full min-w-64 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-blue-500">{circumferenceOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                </div>
                <div className="mt-6"><EvolutionChart assessments={comparedAssessments} metrics={circumferenceChartMetric} /></div>
              </Card>

              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><h2 className="font-semibold">Dobras cutâneas</h2><p className="mt-1 text-sm text-[var(--muted)]">Escolha uma dobra ou o somatório</p></div>
                  <label className="text-xs font-medium text-[var(--muted)]">Medida<select value={skinfoldMetric} onChange={(event) => setSkinfoldMetric(event.target.value)} className="mt-1.5 h-10 w-full min-w-64 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-blue-500">{skinfoldOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                </div>
                <div className="mt-6"><EvolutionChart assessments={comparedAssessments} metrics={skinfoldChartMetric} /></div>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-[var(--border)] p-5"><h2 className="font-semibold">Histórico</h2><p className="mt-1 text-sm text-[var(--muted)]">Avaliações mais recentes</p></div>
              <div className="divide-y divide-[var(--border)]">{studentAssessments.map((assessment) => <button key={assessment.id} onClick={() => setDetails(assessment)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[var(--surface-raised)]"><div><div className="flex items-center gap-2"><p className="font-medium">{assessment.date}</p><Badge tone={assessment.type === "Inicial" ? "neutral" : "info"}>{assessment.type}</Badge></div><p className="mt-1 text-sm text-[var(--muted)]">{formatNumber(assessment.weight, " kg")} · {formatNumber(assessment.bodyFat, "% gordura")}</p></div><span className="text-[var(--muted)]">›</span></button>)}</div>
            </Card>
          </section>
        </> : <Card className="grid min-h-72 place-items-center text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-500/10 text-2xl text-blue-500">◇</div><h2 className="mt-4 text-lg font-semibold">Nenhuma avaliação registrada</h2><p className="mt-2 text-sm text-[var(--muted)]">Cadastre a avaliação inicial deste aluno.</p><Button onClick={() => setModalOpen(true)} className="mt-5">Criar avaliação</Button></div></Card>}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="new-assessment-title">
          <form onSubmit={addAssessment} onInput={(event) => updateCalculation(event.currentTarget)} className="mx-auto my-3 w-full max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
              <div><h2 id="new-assessment-title" className="text-xl font-semibold">Avaliação física completa</h2><p className="mt-1 text-sm text-[var(--muted)]">Preencha os dados disponíveis e selecione o protocolo adequado.</p></div>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              <details open className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <summary className="cursor-pointer font-semibold">1. Perfil e dados básicos</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block text-sm font-medium sm:col-span-2 lg:col-span-1">Aluno<select name="student" defaultValue={selectedStudent} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500">{students.map((student) => <option key={student}>{student}</option>)}</select></label>
                  <label className="block text-sm font-medium">Sexo biológico<select name="sex" value={sex} onChange={(event) => { setSex(event.target.value as BiologicalSex); setCalculatedBodyFat(null); }} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500"><option>Masculino</option><option>Feminino</option></select></label>
                  <label className="block text-sm font-medium">Idade<input name="age" required type="number" min="16" max="100" placeholder="35" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500" /></label>
                  <label className="block text-sm font-medium">Peso (kg)<input name="weight" required type="number" step="0.1" min="20" placeholder="80,0" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500" /></label>
                  <label className="block text-sm font-medium">Estatura (cm)<input name="height" required type="number" step="0.1" min="100" placeholder="175" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500" /></label>
                  <label className="block text-sm font-medium sm:col-span-2 lg:col-span-1">Protocolo<select name="protocol" value={protocol} onChange={(event) => { setProtocol(event.target.value as BodyFatProtocol); setCalculatedBodyFat(null); }} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500"><option>Jackson-Pollock 3 dobras</option><option>Jackson-Pollock 7 dobras</option><option>Circunferências US Navy</option></select></label>
                </div>
                <div className="mt-4 rounded-xl bg-blue-500/10 p-3 text-sm text-blue-500">
                  {protocol === "Circunferências US Navy" ? "Boa alternativa quando as dobras cutâneas não são viáveis." : "A idade e os pontos de dobra exigidos variam conforme o sexo selecionado."}
                </div>
              </details>

              <details open className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <summary className="cursor-pointer font-semibold">2. Circunferências corporais <span className="ml-2 text-xs font-normal text-[var(--muted)]">cm</span></summary>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {circumferenceFields.map(([key, label]) => {
                    const required = requiredMeasurements(protocol, sex).circumferences.includes(key);
                    return <label key={key} className="block text-xs font-medium">{label}{required && <span className="ml-1 text-blue-500">• obrigatório</span>}<input name={`circumference-${key}`} required={required} type="number" step="0.1" min="1" placeholder="0,0" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-blue-500" /></label>;
                  })}
                </div>
              </details>

              <details open={protocol !== "Circunferências US Navy"} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <summary className="cursor-pointer font-semibold">3. Dobras cutâneas <span className="ml-2 text-xs font-normal text-[var(--muted)]">mm</span></summary>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {skinfoldFields.map(([key, label]) => {
                    const required = requiredMeasurements(protocol, sex).skinfolds.includes(key);
                    return <label key={key} className="block text-xs font-medium">{label}{required && <span className="ml-1 text-blue-500">• obrigatório</span>}<input name={`skinfold-${key}`} required={required} disabled={protocol === "Circunferências US Navy"} type="number" step="0.1" min="1" placeholder="0,0" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40" /></label>;
                  })}
                </div>
              </details>

              <details className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <summary className="cursor-pointer font-semibold">4. Fotos de evolução e postura</summary>
                <div className="mt-4"><label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center transition hover:border-blue-500"><span className="text-2xl">＋</span><span className="mt-2 text-sm font-semibold">Selecionar fotos</span><span className="mt-1 text-xs text-[var(--muted)]">Frente, costas e laterais — até 4 imagens</span><input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => handlePhotos(event.target.files)} /></label>{photoPreviews.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{photoPreviews.map((url, index) => <div key={url} className="aspect-[3/4] rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} aria-label={`Prévia da foto ${index + 1}`} />)}</div>}</div>
              </details>

              <label className="block text-sm font-medium">Observações<textarea name="notes" rows={3} placeholder="Postura, assimetrias, limitações ou informações relevantes" className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 outline-none focus:border-blue-500" /></label>

              <div className={`rounded-2xl border p-4 ${calculatedBodyFat === null ? "border-[var(--border)] bg-[var(--background)]" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Resultado automático</p>
                {calculatedBodyFat === null ? <p className="mt-2 text-sm">Preencha idade, estatura e as medidas marcadas como obrigatórias.</p> : <div className="mt-2 flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold text-emerald-500">{formatNumber(calculatedBodyFat, "%")}</p><p className="mt-1 text-xs text-[var(--muted)]">Estimativa pelo protocolo {protocol}</p></div><Badge tone="success">Calculado</Badge></div>}
                <p className="mt-3 text-xs text-[var(--muted)]">O resultado é uma estimativa antropométrica e deve ser interpretado pelo profissional considerando população, técnica de medida e limitações do protocolo.</p>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:justify-end sm:p-6"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={calculatedBodyFat === null}>Salvar avaliação</Button></div>
          </form>
        </div>
      )}

      {details && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="assessment-details-title"><Card className="w-full max-w-md"><div className="flex items-center justify-between"><div><h2 id="assessment-details-title" className="text-xl font-semibold">Detalhes da avaliação</h2><p className="mt-1 text-sm text-[var(--muted)]">{details.student} · {details.date}</p></div><button onClick={() => setDetails(null)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div><div className="mt-6 grid grid-cols-2 gap-3">{[["Peso", formatNumber(details.weight, " kg")], ["Estatura", formatNumber(details.height, " m")], ["Gordura", formatNumber(details.bodyFat, "%")], ["Cintura", formatNumber(details.waist, " cm")], ["Massa livre", formatNumber(details.leanMass, " kg")], ["IMC", formatNumber(details.weight / (details.height * details.height))]].map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>{details.notes && <div className="mt-4 rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-xs text-[var(--muted)]">Observações</p><p className="mt-1 text-sm">{details.notes}</p></div>}<Button onClick={() => setDetails(null)} className="mt-6 w-full">Fechar</Button></Card></div>}
    </MainLayout>
  );
}
