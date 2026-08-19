import { createClient } from "@/lib/supabase/client";

export type AppointmentType = "training" | "assessment" | "reassessment";
export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export type AppointmentRecord = {
  id: string;
  professional_id: string;
  student_id: string;
  type: AppointmentType;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  recurrence_group_id: string | null;
  rescheduled_from_id: string | null;
  notes: string | null;
  deleted_at: string | null;
  students: { full_name: string } | null;
};

export type AppointmentDeletionScope = "single" | "future" | "series";

const appointmentFields =
  "id, professional_id, student_id, type, starts_at, ends_at, status, recurrence_group_id, rescheduled_from_id, notes, deleted_at, students(full_name)";

async function currentUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw error ?? new Error("Sessão expirada. Entre novamente.");
  return user.id;
}

export async function listAppointments(start: string, end: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentFields)
    .is("deleted_at", null)
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at");

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRecord[];
}

export async function listUpcomingAppointments(from: string, limit = 5) {
  const supabase = createClient();
  const professionalId = await currentUserId();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentFields)
    .eq("professional_id", professionalId)
    .is("deleted_at", null)
    .gte("ends_at", from)
    .in("status", ["scheduled", "waiting", "in_progress"])
    .order("starts_at")
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRecord[];
}

export async function createAppointments(
  appointments: Array<{
    student_id: string;
    type: AppointmentType;
    starts_at: string;
    ends_at: string;
    recurrence_group_id?: string;
  }>,
) {
  const supabase = createClient();
  const professionalId = await currentUserId();
  const { data, error } = await supabase
    .from("appointments")
    .insert(
      appointments.map((appointment) => ({
        ...appointment,
        professional_id: professionalId,
        status: "scheduled",
      })),
    )
    .select(appointmentFields);

  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRecord[];
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const supabase = createClient();
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function rescheduleAppointment(id: string, startsAt: string, endsAt: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ starts_at: startsAt, ends_at: endsAt, status: "scheduled" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAppointment(id: string, scope: AppointmentDeletionScope = "single") {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_appointment_occurrences", {
    p_appointment_id: id,
    p_scope: scope,
  });
  if (error) throw error;
}
