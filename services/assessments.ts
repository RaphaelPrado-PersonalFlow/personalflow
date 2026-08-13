import { createClient } from "@/lib/supabase/client";

export type AssessmentRecord = {
  id: string;
  student_id: string;
  assessment_date: string;
  assessment_type: "initial" | "reassessment";
  biological_sex: string | null;
  age: number | null;
  protocol: string | null;
  weight_kg: number;
  height_m: number;
  body_fat_percentage: number;
  lean_mass_kg: number;
  waist_cm: number;
  notes: string | null;
  circumferences: Record<string, number>;
  skinfolds: Record<string, number>;
  students: { full_name: string } | null;
};

export type CreateAssessmentInput = Omit<
  AssessmentRecord,
  "id" | "students"
>;

export async function listAssessments() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*, students(full_name)")
    .order("assessment_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AssessmentRecord[];
}

export async function createAssessment(input: CreateAssessmentInput) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Sessão não encontrada.");

  const { data, error } = await supabase
    .from("assessments")
    .insert({ ...input, professional_id: authData.user.id })
    .select("*, students(full_name)")
    .single();

  if (error) throw error;
  return data as AssessmentRecord;
}

export async function updateAssessment(id: string, input: CreateAssessmentInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assessments")
    .update(input)
    .eq("id", id)
    .select("*, students(full_name)")
    .single();

  if (error) throw error;
  return data as AssessmentRecord;
}
