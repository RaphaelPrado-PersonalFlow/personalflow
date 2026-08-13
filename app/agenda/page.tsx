"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import type { AppointmentDeletionScope } from "@/services/appointments";
import {
  AppointmentRecord,
  AppointmentStatus,
  AppointmentType,
  createAppointments,
  deleteAppointment,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/services/appointments";
import { listStudents, StudentRecord } from "@/services/students";

const recurrenceDays = [
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

const typeLabels: Record<AppointmentType, string> = {
  training: "Treino",
  assessment: "Avaliação",
  reassessment: "Reavaliação",
};

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  waiting: "Aguardando",
  in_progress: "Em atendimento",
  completed: "Concluído",
  no_show: "Falta",
  cancelled: "Cancelado",
  rescheduled: "Reagendado",
};

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function durationMinutes(item: AppointmentRecord) {
  return Math.round(
    (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000,
  );
}

function statusTone(status: AppointmentStatus) {
  if (status === "completed") return "success" as const;
  if (status === "in_progress" || status === "waiting") return "warning" as const;
  if (status === "cancelled" || status === "no_show") return "danger" as const;
  return "neutral" as const;
}

export default function AgendaPage() {
  const [view, setView] = useState<"day" | "week">("day");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [filter, setFilter] = useState<"all" | AppointmentType>("all");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AppointmentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const weekDays = useMemo(
    () =>
      recurrenceDays.map((item, index) => {
        const date = addDays(weekStart, index);
        return { ...item, date, key: formatDateKey(date) };
      }),
    [weekStart],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback("");
    try {
      const end = addDays(weekStart, 7);
      const [appointmentData, studentData] = await Promise.all([
        listAppointments(weekStart.toISOString(), end.toISOString()),
        listStudents(),
      ]);
      setAppointments(appointmentData);
      setStudents(studentData.filter((student) => student.status === "active"));
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a agenda.",
      );
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const visibleAppointments = useMemo(
    () =>
      appointments.filter((item) => {
        const sameDate = formatDateKey(new Date(item.starts_at)) === selectedDate;
        return sameDate && (filter === "all" || item.type === filter);
      }),
    [appointments, filter, selectedDate],
  );

  function changeWeek(offset: number) {
    const next = addDays(weekStart, offset * 7);
    setWeekStart(next);
    setSelectedDate(formatDateKey(next));
  }

  function goToday() {
    const today = new Date();
    setWeekStart(startOfWeek(today));
    setSelectedDate(formatDateKey(today));
  }

  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const studentId = String(data.get("studentId") || "");
    const time = String(data.get("time") || "");
    const duration = Number(data.get("duration") || 60);
    const type = String(data.get("type")) as AppointmentType;
    const recurrenceWeeks = Number(data.get("recurrenceWeeks") || 12);
    if (!studentId || !time || (recurring && selectedWeekdays.length === 0)) return;

    const baseDate = new Date(`${selectedDate}T12:00:00`);
    const recurrenceGroupId = recurring ? crypto.randomUUID() : undefined;
    const dates: Date[] = [];

    if (recurring) {
      for (let week = 0; week < recurrenceWeeks; week += 1) {
        for (const weekday of selectedWeekdays) {
          const date = addDays(startOfWeek(baseDate), week * 7 + weekday - 1);
          if (date >= baseDate || formatDateKey(date) === selectedDate) dates.push(date);
        }
      }
    } else {
      dates.push(baseDate);
    }

    setSaving(true);
    setFeedback("");
    try {
      await createAppointments(
        dates.map((date) => {
          const startsAt = combineDateAndTime(date, time);
          const endsAt = new Date(startsAt.getTime() + duration * 60000);
          return {
            student_id: studentId,
            type,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            recurrence_group_id: recurrenceGroupId,
          };
        }),
      );
      setModalOpen(false);
      setRecurring(false);
      setSelectedWeekdays([1, 3, 5]);
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelItem(id: string) {
    try {
      await updateAppointmentStatus(id, "cancelled");
      await loadData();
    } catch {
      setFeedback("Não foi possível cancelar o atendimento.");
    }
    setActionMenuId(null);
  }

  async function rescheduleItem(item: AppointmentRecord) {
    const currentTime = new Date(item.starts_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const newTime = window.prompt(`Novo horário para ${item.students?.full_name ?? "o aluno"}:`, currentTime);
    if (!newTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) return;
    const startsAt = combineDateAndTime(new Date(item.starts_at), newTime);
    const endsAt = new Date(startsAt.getTime() + durationMinutes(item) * 60000);
    try {
      await rescheduleAppointment(item.id, startsAt.toISOString(), endsAt.toISOString());
      await loadData();
    } catch {
      setFeedback("Não foi possível reagendar o atendimento.");
    }
    setActionMenuId(null);
  }

  function requestDeletion(item: AppointmentRecord) {
    setActionMenuId(null);
    if (item.recurrence_group_id) {
      setDeleteTarget(item);
      return;
    }
    if (window.confirm(`Excluir o atendimento de ${item.students?.full_name ?? "este aluno"}?`)) {
      void deleteItem(item, "single");
    }
  }

  async function deleteItem(item: AppointmentRecord, scope: AppointmentDeletionScope) {
    setDeleting(true);
    setFeedback("");
    try {
      await deleteAppointment(item.id, scope);
      setAppointments((current) => current.filter((appointment) => {
        if (scope === "single") return appointment.id !== item.id;
        if (scope === "series") return appointment.recurrence_group_id !== item.recurrence_group_id;
        return appointment.recurrence_group_id !== item.recurrence_group_id
          || new Date(appointment.starts_at).getTime() < new Date(item.starts_at).getTime();
      }));
      setDeleteTarget(null);
      await loadData();
    } catch {
      setFeedback("Não foi possível excluir o atendimento.");
    } finally {
      setDeleting(false);
    }
  }

  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
  const monthRange = `${weekDays[0].date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${weekDays[5].date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Agenda"
          description="Organize atendimentos e acompanhe sua rotina diária."
          action={<Button onClick={() => setModalOpen(true)}>＋ Novo atendimento</Button>}
        />

        {feedback && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            {feedback}
          </div>
        )}

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => changeWeek(-1)} aria-label="Semana anterior">←</Button>
              <Button variant="secondary" onClick={goToday}>Hoje</Button>
              <Button variant="secondary" onClick={() => changeWeek(1)} aria-label="Próxima semana">→</Button>
              <p className="ml-2 hidden font-semibold sm:block">{monthRange}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-xl bg-[var(--surface-raised)] p-1">
                <button onClick={() => setView("day")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${view === "day" ? "bg-blue-600 text-white" : "text-[var(--muted)]"}`}>Dia</button>
                <button onClick={() => setView("week")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${view === "week" ? "bg-blue-600 text-white" : "text-[var(--muted)]"}`}>Semana</button>
              </div>
              <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none">
                <option value="all">Todos</option>
                <option value="training">Treino</option>
                <option value="assessment">Avaliação</option>
                <option value="reassessment">Reavaliação</option>
              </select>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {weekDays.map((item) => {
            const total = appointments.filter((appointment) => formatDateKey(new Date(appointment.starts_at)) === item.key).length;
            return (
              <button key={item.key} onClick={() => setSelectedDate(item.key)} className={`rounded-2xl border p-3 text-center transition ${selectedDate === item.key ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]"}`}>
                <span className={`block text-[11px] font-semibold ${selectedDate === item.key ? "text-blue-100" : "text-[var(--muted)]"}`}>{item.label.toUpperCase()}</span>
                <span className="my-1 block text-xl font-semibold">{item.date.getDate()}</span>
                <span className={`text-[11px] ${selectedDate === item.key ? "text-blue-100" : "text-[var(--muted)]"}`}>{total} atend.</span>
              </button>
            );
          })}
        </div>

        {view === "day" ? (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="font-semibold capitalize">{selectedDateObject.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{visibleAppointments.length} atendimentos exibidos</p>
            </div>
            {loading ? (
              <p className="px-5 py-8 text-sm text-[var(--muted)]">Carregando agenda...</p>
            ) : visibleAppointments.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[var(--muted)]">Nenhum atendimento neste dia.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {visibleAppointments.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[58px_1fr] gap-3 px-4 py-4 sm:grid-cols-[74px_1fr_auto] sm:items-center sm:px-5">
                    <div>
                      <p className="font-semibold text-blue-500">{new Date(item.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="text-[11px] text-[var(--muted)]">{durationMinutes(item)} min</p>
                    </div>
                    <div>
                      <p className="font-medium">{item.students?.full_name ?? "Aluno"}</p>
                      <p className="text-sm text-[var(--muted)]">{typeLabels[item.type]}{item.recurrence_group_id ? " · Recorrente" : ""}</p>
                    </div>
                    <div className="relative col-start-2 flex items-center gap-2 sm:col-auto">
                      <Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge>
                      <button type="button" onClick={() => setActionMenuId((current) => current === item.id ? null : item.id)} className="rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-[var(--surface-raised)]" aria-label={`Opções de ${item.students?.full_name ?? "aluno"}`}>•••</button>
                      {actionMenuId === item.id && (
                        <div
                          className={`absolute right-0 z-30 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl ${
                            index >= visibleAppointments.length - 2 ? "bottom-9" : "top-9"
                          }`}
                        >
                          <button type="button" onClick={() => void cancelItem(item.id)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)]">Cancelar</button>
                          <button type="button" onClick={() => void rescheduleItem(item)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)]">Reagendar</button>
                          <button type="button" onClick={() => requestDeletion(item)} className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10">Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <div className="grid min-w-[680px] grid-cols-6 gap-3">
              {weekDays.map((day) => (
                <div key={day.key} className="rounded-xl bg-[var(--surface-raised)] p-3">
                  <p className="text-xs font-semibold text-[var(--muted)]">{day.label.toUpperCase()} {day.date.getDate()}</p>
                  {appointments.filter((item) => formatDateKey(new Date(item.starts_at)) === day.key).map((item) => (
                    <button key={item.id} onClick={() => { setSelectedDate(day.key); setView("day"); }} className="mt-3 block w-full rounded-lg border-l-2 border-blue-500 bg-[var(--surface)] p-2 text-left">
                      <p className="text-xs font-semibold">{new Date(item.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.students?.full_name}</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true">
          <form onSubmit={addAppointment} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-semibold">Novo atendimento</h2><p className="mt-1 text-sm text-[var(--muted)]">Agende para {selectedDateObject.toLocaleDateString("pt-BR")}.</p></div>
              <button type="button" onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-raised)]" aria-label="Fechar">×</button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium">Aluno
                <select name="studentId" required defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500">
                  <option value="" disabled>Selecione o aluno</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Horário<input name="time" required type="time" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-blue-500" /></label>
                <label className="block text-sm font-medium">Duração<select name="duration" defaultValue="60" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option><option value="90">90 min</option></select></label>
              </div>
              <label className="block text-sm font-medium">Tipo<select name="type" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><option value="training">Treino</option><option value="assessment">Avaliação</option><option value="reassessment">Reavaliação</option></select></label>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                  <span><span className="block text-sm font-medium">Repetir semanalmente</span><span className="mt-1 block text-xs text-[var(--muted)]">Cria todas as ocorrências no calendário.</span></span>
                  <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} className="size-5 accent-blue-600" />
                </label>
                {recurring && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <p className="text-sm font-medium">Dias do atendimento</p>
                    <div className="mt-3 grid grid-cols-6 gap-2">
                      {recurrenceDays.map((day) => {
                        const selected = selectedWeekdays.includes(day.value);
                        return <button key={day.value} type="button" onClick={() => setSelectedWeekdays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value].sort())} className={`rounded-lg py-2 text-xs font-semibold ${selected ? "bg-blue-600 text-white" : "bg-[var(--surface-raised)] text-[var(--muted)]"}`}>{day.label}</button>;
                      })}
                    </div>
                    <label className="mt-4 block text-sm font-medium">Repetir por<select name="recurrenceWeeks" defaultValue="12" className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"><option value="4">4 semanas</option><option value="8">8 semanas</option><option value="12">12 semanas</option><option value="24">24 semanas</option><option value="52">1 ano</option></select></label>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar atendimento"}</Button></div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-recurring-title" onClick={() => !deleting && setDeleteTarget(null)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <h2 id="delete-recurring-title" className="text-xl font-semibold">Excluir agendamento recorrente</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Escolha quais ocorrências de {deleteTarget.students?.full_name ?? "este aluno"} devem sair da agenda.</p>
            <div className="mt-6 grid gap-2">
              <button type="button" disabled={deleting} onClick={() => void deleteItem(deleteTarget, "single")} className="rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--surface-raised)] disabled:opacity-60">Somente este</button>
              <button type="button" disabled={deleting} onClick={() => void deleteItem(deleteTarget, "future")} className="rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--surface-raised)] disabled:opacity-60">Este e os próximos</button>
              <button type="button" disabled={deleting} onClick={() => void deleteItem(deleteTarget, "series")} className="rounded-xl border border-red-500/30 px-4 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-60">Toda a série</button>
              <Button type="button" variant="ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            </div>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}
