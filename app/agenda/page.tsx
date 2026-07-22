"use client";

import { FormEvent, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

type Appointment = {
  id: number;
  time: string;
  duration: number;
  student: string;
  type: "Treino" | "Avaliação" | "Reavaliação";
  status: "Agendado" | "Em atendimento" | "Concluído";
  weekdays?: number[];
  recurrenceWeeks?: number;
};

const initialAppointments: Appointment[] = [
  { id: 1, time: "07:00", duration: 60, student: "João Mendes", type: "Treino", status: "Concluído" },
  { id: 2, time: "08:30", duration: 60, student: "Mariana Costa", type: "Treino", status: "Concluído" },
  { id: 3, time: "10:00", duration: 50, student: "Carlos Lima", type: "Avaliação", status: "Em atendimento" },
  { id: 4, time: "14:00", duration: 60, student: "Ana Souza", type: "Treino", status: "Agendado" },
  { id: 5, time: "16:30", duration: 60, student: "Paulo Rocha", type: "Reavaliação", status: "Agendado" },
  { id: 6, time: "18:00", duration: 60, student: "Beatriz Alves", type: "Treino", status: "Agendado" },
];

const weekDays = [
  { day: "SEG", date: 20, total: 6, index: 1 },
  { day: "TER", date: 21, total: 6, index: 2 },
  { day: "QUA", date: 22, total: 7, index: 3 },
  { day: "QUI", date: 23, total: 5, index: 4 },
  { day: "SEX", date: 24, total: 8, index: 5 },
  { day: "SÁB", date: 25, total: 3, index: 6 },
];

const recurrenceDays = [
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

export default function AgendaPage() {
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(22);
  const [filter, setFilter] = useState("Todos");
  const [appointments, setAppointments] = useState(initialAppointments);
  const [modalOpen, setModalOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]);

  const selectedWeekday = weekDays.find((day) => day.date === selectedDate)?.index ?? 3;

  const visibleAppointments = useMemo(
    () => appointments.filter((item) =>
      (filter === "Todos" || item.type === filter) &&
      (!item.weekdays || item.weekdays.includes(selectedWeekday)),
    ),
    [appointments, filter, selectedWeekday],
  );

  function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const student = String(data.get("student") || "").trim();
    const time = String(data.get("time") || "");
    const type = String(data.get("type")) as Appointment["type"];
    const recurrenceWeeks = Number(data.get("recurrenceWeeks") || 12);
    if (!student || !time || (recurring && selectedWeekdays.length === 0)) return;
    const newAppointment: Appointment = {
      id: Date.now(),
      student,
      time,
      type,
      duration: 60,
      status: "Agendado",
      weekdays: recurring ? selectedWeekdays : undefined,
      recurrenceWeeks: recurring ? recurrenceWeeks : undefined,
    };
    setAppointments((current) => [
      ...current,
      newAppointment,
    ].sort((a, b) => a.time.localeCompare(b.time)));
    setModalOpen(false);
    setRecurring(false);
    setSelectedWeekdays([1, 3, 5]);
    event.currentTarget.reset();
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Agenda"
          description="Organize atendimentos e acompanhe sua rotina diária."
          action={<Button onClick={() => setModalOpen(true)}>＋ Novo atendimento</Button>}
        />

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="secondary" aria-label="Semana anterior">←</Button>
              <Button variant="secondary">Hoje</Button>
              <Button variant="secondary" aria-label="Próxima semana">→</Button>
              <p className="ml-2 hidden font-semibold sm:block">20–25 de julho de 2026</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-xl bg-[var(--surface-raised)] p-1">
                <button onClick={() => setView("day")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${view === "day" ? "bg-blue-600 text-white" : "text-[var(--muted)]"}`}>Dia</button>
                <button onClick={() => setView("week")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${view === "week" ? "bg-blue-600 text-white" : "text-[var(--muted)]"}`}>Semana</button>
              </div>
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none">
                <option>Todos</option><option>Treino</option><option>Avaliação</option><option>Reavaliação</option>
              </select>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {weekDays.map((item) => (
            <button key={item.date} onClick={() => setSelectedDate(item.date)} className={`rounded-2xl border p-3 text-center transition ${selectedDate === item.date ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]"}`}>
              <span className={`block text-[11px] font-semibold ${selectedDate === item.date ? "text-blue-100" : "text-[var(--muted)]"}`}>{item.day}</span>
              <span className="my-1 block text-xl font-semibold">{item.date}</span>
              <span className={`text-[11px] ${selectedDate === item.date ? "text-blue-100" : "text-[var(--muted)]"}`}>{item.total} atend.</span>
            </button>
          ))}
        </div>

        {view === "day" ? (
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div><h2 className="font-semibold">Quarta-feira, {selectedDate} de julho</h2><p className="mt-1 text-sm text-[var(--muted)]">{visibleAppointments.length} atendimentos exibidos</p></div>
              <Badge tone="info">Próximo: 14:00</Badge>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {visibleAppointments.map((item) => (
                <div key={item.id} className="grid grid-cols-[58px_1fr] gap-3 px-4 py-4 sm:grid-cols-[74px_1fr_auto] sm:items-center sm:px-5">
                  <div><p className="font-semibold text-blue-500">{item.time}</p><p className="text-[11px] text-[var(--muted)]">{item.duration} min</p></div>
                  <div><p className="font-medium">{item.student}</p><p className="text-sm text-[var(--muted)]">{item.type}{item.weekdays ? ` · Recorrente ${item.weekdays.length}x/semana` : ""}</p></div>
                  <div className="col-start-2 flex items-center gap-2 sm:col-auto"><Badge tone={item.status === "Concluído" ? "success" : item.status === "Em atendimento" ? "warning" : "neutral"}>{item.status}</Badge><button className="rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-[var(--surface-raised)]" aria-label={`Opções de ${item.student}`}>•••</button></div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <div className="grid min-w-[680px] grid-cols-6 gap-3">
              {weekDays.map((day) => <div key={day.date} className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-xs font-semibold text-[var(--muted)]">{day.day} {day.date}</p>{appointments.filter((item) => !item.weekdays || item.weekdays.includes(day.index)).slice(0, Math.min(appointments.length, day.total - 2)).map((item) => <div key={`${day.date}-${item.id}`} className="mt-3 rounded-lg border-l-2 border-blue-500 bg-[var(--surface)] p-2"><p className="text-xs font-semibold">{item.time}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{item.student}</p>{item.weekdays && <p className="mt-1 text-[10px] text-blue-500">↻ Semanal</p>}</div>)}</div>)}
            </div>
          </Card>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="new-appointment-title">
          <form onSubmit={addAppointment} className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 id="new-appointment-title" className="text-xl font-semibold">Novo atendimento</h2><p className="mt-1 text-sm text-[var(--muted)]">Adicione um compromisso à agenda.</p></div><button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button></div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium">Aluno<input name="student" required placeholder="Nome do aluno" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Horário<input name="time" required type="time" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label><label className="block text-sm font-medium">Tipo<select name="type" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500"><option>Treino</option><option>Avaliação</option><option>Reavaliação</option></select></label></div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                  <span><span className="block text-sm font-medium">Repetir semanalmente</span><span className="mt-1 block text-xs text-[var(--muted)]">Cria o horário nas próximas semanas.</span></span>
                  <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} className="size-5 accent-blue-600" />
                </label>
                {recurring && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <p className="text-sm font-medium">Dias do atendimento</p>
                    <div className="mt-3 grid grid-cols-6 gap-2">
                      {recurrenceDays.map((day) => {
                        const selected = selectedWeekdays.includes(day.value);
                        return <button key={day.value} type="button" onClick={() => setSelectedWeekdays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value].sort())} className={`rounded-lg py-2 text-xs font-semibold transition ${selected ? "bg-blue-600 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{day.label}</button>;
                      })}
                    </div>
                    <label className="mt-4 block text-sm font-medium">Repetir por<select name="recurrenceWeeks" defaultValue="12" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 outline-none focus:border-blue-500"><option value="4">4 semanas</option><option value="8">8 semanas</option><option value="12">12 semanas</option><option value="24">24 semanas</option><option value="52">1 ano</option></select></label>
                    {selectedWeekdays.length === 0 && <p className="mt-2 text-xs text-red-500">Selecione pelo menos um dia.</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar atendimento</Button></div>
          </form>
        </div>
      )}
    </MainLayout>
  );
}
