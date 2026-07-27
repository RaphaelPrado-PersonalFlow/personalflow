export type MuscleContribution = {
  muscle: string;
  factor: number;
  role: "Principal" | "Secundário";
};

export type LibraryExercise = {
  id: number;
  name: string;
  aliases: string;
  equipment: string;
  movement: string;
  type: string;
  laterality: string;
  level: string;
  origin: "Sistema" | "Personalizado";
  muscles: MuscleContribution[];
  instructions: string;
  active: boolean;
};

export const muscleGroups = [
  "Peitoral",
  "Costas",
  "Quadríceps",
  "Glúteos",
  "Isquiotibiais",
  "Panturrilhas",
  "Deltoide anterior",
  "Deltoide lateral",
  "Deltoide posterior",
  "Tríceps",
  "Bíceps",
  "Abdômen",
];

export const equipments = ["Barra", "Halteres", "Cabo", "Máquina", "Peso corporal", "Elástico", "Outro"];

export const movements = [
  "Empurrar horizontal",
  "Empurrar vertical",
  "Puxar horizontal",
  "Puxar vertical",
  "Agachar",
  "Dominância de quadril",
  "Flexão de joelho",
  "Extensão de joelho",
  "Isolado",
  "Estabilização",
];

export const exerciseLibrary: LibraryExercise[] = [
  {
    id: 1,
    name: "Supino reto com barra",
    aliases: "Supino plano",
    equipment: "Barra",
    movement: "Empurrar horizontal",
    type: "Composto",
    laterality: "Bilateral",
    level: "Intermediário",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Peitoral", factor: 1, role: "Principal" },
      { muscle: "Tríceps", factor: 0.5, role: "Secundário" },
      { muscle: "Deltoide anterior", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Manter escápulas estabilizadas, pés apoiados e controlar a descida da barra.",
  },
  {
    id: 2,
    name: "Supino inclinado com halteres",
    aliases: "Supino 30 graus",
    equipment: "Halteres",
    movement: "Empurrar horizontal",
    type: "Composto",
    laterality: "Bilateral",
    level: "Intermediário",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Peitoral", factor: 1, role: "Principal" },
      { muscle: "Deltoide anterior", factor: 0.5, role: "Secundário" },
      { muscle: "Tríceps", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Ajustar o banco entre 20 e 35 graus e manter os punhos alinhados.",
  },
  {
    id: 3,
    name: "Crucifixo no cabo",
    aliases: "Crossover",
    equipment: "Cabo",
    movement: "Empurrar horizontal",
    type: "Isolado",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [{ muscle: "Peitoral", factor: 1, role: "Principal" }],
    instructions: "Manter leve flexão dos cotovelos e controlar toda a amplitude.",
  },
  {
    id: 4,
    name: "Tríceps na polia",
    aliases: "Tríceps pulley",
    equipment: "Cabo",
    movement: "Isolado",
    type: "Isolado",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [{ muscle: "Tríceps", factor: 1, role: "Principal" }],
    instructions: "Manter os cotovelos estáveis junto ao tronco.",
  },
  {
    id: 5,
    name: "Puxada alta",
    aliases: "Pulley frente, puxada alta pronada",
    equipment: "Cabo",
    movement: "Puxar vertical",
    type: "Composto",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Costas", factor: 1, role: "Principal" },
      { muscle: "Bíceps", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Conduzir a barra à região superior do tórax sem projetar a cabeça à frente.",
  },
  {
    id: 6,
    name: "Remada baixa",
    aliases: "Remada sentada, remada baixa no cabo",
    equipment: "Cabo",
    movement: "Puxar horizontal",
    type: "Composto",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Costas", factor: 1, role: "Principal" },
      { muscle: "Bíceps", factor: 0.5, role: "Secundário" },
      { muscle: "Deltoide posterior", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Iniciar o movimento pelas escápulas e evitar compensação excessiva do tronco.",
  },
  {
    id: 7,
    name: "Rosca direta",
    aliases: "Rosca com barra",
    equipment: "Barra",
    movement: "Isolado",
    type: "Isolado",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [{ muscle: "Bíceps", factor: 1, role: "Principal" }],
    instructions: "Evitar balanço do tronco e manter os cotovelos estáveis.",
  },
  {
    id: 8,
    name: "Agachamento livre",
    aliases: "Agachamento com barra",
    equipment: "Barra",
    movement: "Agachar",
    type: "Composto",
    laterality: "Bilateral",
    level: "Avançado",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Quadríceps", factor: 1, role: "Principal" },
      { muscle: "Glúteos", factor: 0.5, role: "Secundário" },
      { muscle: "Isquiotibiais", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Manter o centro de pressão estável, joelhos acompanhando os pés e coluna organizada.",
  },
  {
    id: 9,
    name: "Leg press",
    aliases: "Leg press 45 graus",
    equipment: "Máquina",
    movement: "Agachar",
    type: "Composto",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Quadríceps", factor: 1, role: "Principal" },
      { muscle: "Glúteos", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Manter a pelve apoiada e controlar a flexão dos joelhos.",
  },
  {
    id: 10,
    name: "Mesa flexora",
    aliases: "Flexora deitada",
    equipment: "Máquina",
    movement: "Flexão de joelho",
    type: "Isolado",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [{ muscle: "Isquiotibiais", factor: 1, role: "Principal" }],
    instructions: "Alinhar o joelho ao eixo da máquina e evitar elevar o quadril.",
  },
  {
    id: 11,
    name: "Agachamento goblet",
    aliases: "Agachamento com halter",
    equipment: "Halteres",
    movement: "Agachar",
    type: "Composto",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Quadríceps", factor: 1, role: "Principal" },
      { muscle: "Glúteos", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Manter o halter próximo ao tórax e os pés firmemente apoiados.",
  },
  {
    id: 12,
    name: "Remada articulada",
    aliases: "Remada máquina",
    equipment: "Máquina",
    movement: "Puxar horizontal",
    type: "Composto",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Costas", factor: 1, role: "Principal" },
      { muscle: "Bíceps", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Manter o tórax apoiado e conduzir o movimento pelas escápulas.",
  },
  {
    id: 13,
    name: "Supino na máquina",
    aliases: "Chest press",
    equipment: "Máquina",
    movement: "Empurrar horizontal",
    type: "Composto",
    laterality: "Bilateral",
    level: "Iniciante",
    origin: "Sistema",
    active: true,
    muscles: [
      { muscle: "Peitoral", factor: 1, role: "Principal" },
      { muscle: "Tríceps", factor: 0.5, role: "Secundário" },
    ],
    instructions: "Ajustar o banco para alinhar as mãos à região média do tórax.",
  },
];

export const prescriptionExerciseCatalog = exerciseLibrary
  .filter((exercise) => exercise.active)
  .map(({ name, aliases, muscles }) => ({ name, aliases, muscles }));
