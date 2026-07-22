export type BiologicalSex = "Masculino" | "Feminino";
export type BodyFatProtocol = "Jackson-Pollock 3 dobras" | "Jackson-Pollock 7 dobras" | "Circunferências US Navy";

export type BodyCompositionInput = {
  sex: BiologicalSex;
  age: number;
  heightCm: number;
  protocol: BodyFatProtocol;
  circumferences: Record<string, number>;
  skinfolds: Record<string, number>;
};

export const circumferenceFields = [
  ["neck", "Pescoço"], ["shoulder", "Ombro"], ["chest", "Tórax"],
  ["rightRelaxedArm", "Braço direito relaxado"], ["rightContractedArm", "Braço direito contraído"],
  ["leftRelaxedArm", "Braço esquerdo relaxado"], ["leftContractedArm", "Braço esquerdo contraído"],
  ["forearm", "Antebraço"], ["waist", "Cintura"], ["abdomen", "Abdômen"],
  ["hip", "Quadril"], ["rightMidThigh", "Coxa média direita"], ["leftMidThigh", "Coxa média esquerda"],
  ["rightCalf", "Panturrilha direita"], ["leftCalf", "Panturrilha esquerda"],
] as const;

export const skinfoldFields = [
  ["biceps", "Bíceps"], ["triceps", "Tríceps"], ["subscapular", "Subescapular"],
  ["chest", "Peitoral"], ["abdomen", "Abdominal"], ["midaxillary", "Axilar média"],
  ["suprailiac", "Supra-ilíaca"], ["thigh", "Coxa média"], ["calf", "Panturrilha"],
] as const;

function siri(bodyDensity: number) {
  return 495 / bodyDensity - 450;
}

export function requiredMeasurements(
  protocol: BodyFatProtocol,
  sex: BiologicalSex,
): { circumferences: string[]; skinfolds: string[] } {
  if (protocol === "Circunferências US Navy") {
    return sex === "Masculino"
      ? { circumferences: ["neck", "abdomen"], skinfolds: [] }
      : { circumferences: ["neck", "waist", "hip"], skinfolds: [] };
  }
  if (protocol === "Jackson-Pollock 3 dobras") {
    return sex === "Masculino"
      ? { circumferences: [], skinfolds: ["chest", "abdomen", "thigh"] }
      : { circumferences: [], skinfolds: ["triceps", "suprailiac", "thigh"] };
  }
  return { circumferences: [], skinfolds: ["chest", "midaxillary", "triceps", "subscapular", "abdomen", "suprailiac", "thigh"] };
}

export function calculateBodyFat(input: BodyCompositionInput): number | null {
  const required = requiredMeasurements(input.protocol, input.sex);
  if (!input.age || !input.heightCm || required.circumferences.some((key) => !input.circumferences[key]) || required.skinfolds.some((key) => !input.skinfolds[key])) return null;

  if (input.protocol === "Circunferências US Navy") {
    const heightIn = input.heightCm / 2.54;
    const neckIn = input.circumferences.neck / 2.54;
    if (input.sex === "Masculino") {
      const abdomenIn = input.circumferences.abdomen / 2.54;
      if (abdomenIn <= neckIn) return null;
      return 86.01 * Math.log10(abdomenIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
    }
    const waistIn = input.circumferences.waist / 2.54;
    const hipIn = input.circumferences.hip / 2.54;
    if (waistIn + hipIn <= neckIn) return null;
    return 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
  }

  const sum = required.skinfolds.reduce((total, key) => total + input.skinfolds[key], 0);
  let density: number;
  if (input.protocol === "Jackson-Pollock 3 dobras") {
    density = input.sex === "Masculino"
      ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * input.age
      : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * input.age;
  } else {
    density = input.sex === "Masculino"
      ? 1.112 - 0.00043499 * sum + 0.00000055 * sum ** 2 - 0.00028826 * input.age
      : 1.097 - 0.00046971 * sum + 0.00000056 * sum ** 2 - 0.00012828 * input.age;
  }
  const result = siri(density);
  return Number.isFinite(result) ? Math.max(2, Math.min(65, result)) : null;
}
