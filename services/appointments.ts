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
  students: { full_name: string } | null;
};

const appointmentFields =
  "id, professional_id, student_id, type, starts_at, ends_at, status, recurrence_group_id, rescheduled_from_id, notes, students(full_name)";

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
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at");

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

export async function deleteAppointment(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}
