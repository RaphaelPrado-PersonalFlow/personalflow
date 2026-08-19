import { createClient } from "@/lib/supabase/client";

export type StudentRecord = {
  id: string;
  professional_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  goal: string | null;
  notes: string | null;
  status: "active" | "paused" | "inactive" | "archived";
};

const studentFields =
  "id, professional_id, full_name, phone, email, cpf, goal, notes, status";

export async function listStudents() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("students")
    .select(studentFields)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as StudentRecord[];
}

export async function createStudent(input: {
  full_name: string;
  phone: string;
  email: string;
  cpf: string | null;
  goal: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("Sessão expirada. Entre novamente.");
  }

  const { data, error } = await supabase
    .from("students")
    .insert({ ...input, professional_id: user.id, status: "active" })
    .select(studentFields)
    .single();

  if (error) throw error;
  return data as StudentRecord;
}

export async function updateStudent(input: {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  cpf: string | null;
  goal: string;
}) {
  const { id, ...changes } = input;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("students")
    .update(changes)
    .eq("id", id)
    .select(studentFields)
    .single();

  if (error) throw error;
  return data as StudentRecord;
}

export async function updateStudentNotes(id: string, notes: string) {
  const supabase = createClient();
  const { error } = await supabase.from("students").update({ notes }).eq("id", id);
  if (error) throw error;
}

export async function deleteStudent(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}
