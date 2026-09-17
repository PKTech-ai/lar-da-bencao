import { z } from "zod";
import { AppError } from "@/lib/errors";
import { classify, guardianRequired, type EducationDepartment } from "@/lib/education";

const text = (max: number) => z.string().trim().max(max).optional().default("");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const evangelizandoSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  birth_date: isoDate,
  filled_date: isoDate.optional().or(z.literal("")),
  guardian_name: text(160),
  guardian_relation: text(60),
  guardian_phone: text(40),
  whatsapp: text(40),
  address: text(300),
  point_reference: text(300),
  father_name: text(160),
  father_contact: text(40),
  mother_name: text(160),
  mother_contact: text(40),
  religion: text(80),
  marital_status: text(40),
  rancho_requested: z.boolean().default(false),
  notes: text(2000)
});

export type EvangelizandoInput = z.infer<typeof evangelizandoSchema>;

/** Validações do cadastro (mock `saveEvangelizando`): faixa etária do departamento e responsável obrigatório. */
export function validateEvangelizando(input: EvangelizandoInput, department: EducationDepartment, today: string, referenceYear: number) {
  if (input.birth_date > today) throw new AppError("A data de nascimento não pode ser futura.");
  const c = classify(input.birth_date, department, referenceYear);
  if (!c.valid) throw new AppError(`${c.message} Revise a data de nascimento ou o departamento.`);
  if (guardianRequired(department, input.birth_date, today) && !input.guardian_name) {
    throw new AppError(department === "juventude" ? "Informe o responsável pelo evangelizando menor de 18 anos." : "Informe o responsável pelo evangelizando.");
  }
  if (input.rancho_requested && !input.guardian_name) {
    throw new AppError("Para solicitar o rancho familiar, informe o nome do responsável.");
  }
  return c;
}

export const evangelizandoValues = (input: EvangelizandoInput) => [
  input.full_name, input.birth_date, input.guardian_name || null, input.guardian_relation || null, input.guardian_phone || null,
  input.whatsapp || null, input.address || null, input.point_reference || null, input.father_name || null, input.father_contact || null,
  input.mother_name || null, input.mother_contact || null, input.religion || null, input.marital_status || null,
  input.rancho_requested, input.notes
];
