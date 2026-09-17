import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { AppError, AuthorizationError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { DOCTRINE_FUNCTIONS, type WorkerStatus } from "@/lib/worker-constants";

export { DOCTRINE_FUNCTIONS, workerStatusLabel, type WorkerStatus } from "@/lib/worker-constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const fichaSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalText(40),
  birth_date: isoDate.optional().or(z.literal("")),
  naturality: optionalText(120),
  marital_status: optionalText(40),
  profession: optionalText(120),
  address: optionalText(300),
  filled_date: isoDate.optional().or(z.literal("")),
  volunteer_service: optionalText(2000),
  accepts_volunteer_law: z.boolean().default(false),
  image_authorization: z.boolean().default(false),
  functions: z.array(z.enum(DOCTRINE_FUNCTIONS)).max(DOCTRINE_FUNCTIONS.length).default([]),
  available_days: z.array(z.number().int().min(0).max(6)).max(7).default([0, 1, 3, 4, 5, 6]),
  departments: z.array(z.string().regex(/^[a-z_]+$/)).min(1, "Selecione pelo menos um departamento.").max(12),
  notes: optionalText(2000)
});

export type Ficha = z.infer<typeof fichaSchema>;

export const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  meeting_date: isoDate,
  minute_ref: z.string().trim().max(200).default(""),
  reason: z.string().trim().max(2000).default(""),
  version: z.number().int().positive()
});

/** Funções só valem para quem atua na Doutrina (mesma regra do mock). */
export function normalizeFicha(input: Ficha): Ficha {
  return {
    ...input,
    departments: [...new Set(input.departments)].sort(),
    functions: input.departments.includes("doutrina") ? [...new Set(input.functions)].sort() : [],
    available_days: [...new Set(input.available_days)].sort()
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

/**
 * Estado após editar a ficha: mudar departamentos ou funções de ficha aprovada, ou salvar
 * ficha reprovada, devolve para análise da Diretoria.
 */
export function statusAfterEdit(
  current: WorkerStatus,
  before: { departments: readonly string[]; functions: readonly string[] },
  after: { departments: readonly string[]; functions: readonly string[] }
): { status: WorkerStatus; resubmitted: boolean } {
  const changed = !sameSet(before.departments, after.departments) || !sameSet(before.functions, after.functions);
  if (current === "rejected" || ((current === "active" || current === "inactive") && changed)) {
    return { status: "pending", resubmitted: true };
  }
  return { status: current, resubmitted: false };
}

export function validateDecision(input: z.infer<typeof decisionSchema>, today: string) {
  if (input.meeting_date > today || Number.isNaN(Date.parse(input.meeting_date))) {
    throw new AppError("Informe uma data de deliberação válida, até hoje.");
  }
  if (input.decision === "rejected" && !input.reason) {
    throw new AppError("Informe o motivo da reprovação.");
  }
}

export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export async function canDecideAdmissions(actor: Actor) {
  return hasPermission(actor, "presidencia", "approve");
}

/** Departamentos do ator em que ele tem a ação; `null` quando vale para todos. */
export async function departmentsWith(actor: Actor, action: "read" | "create" | "update"): Promise<string[] | null> {
  if (await hasPermission(actor, "department", action)) return null;
  if (await hasPermission(actor, "secretaria", action)) return null;
  if (action === "read" && (await hasPermission(actor, "presidencia", "read"))) return null;
  const allowed: string[] = [];
  for (const department of actor.departments) {
    if (await hasPermission(actor, "department", action, department)) allowed.push(department);
  }
  return allowed;
}

/** Garante que o ator pode mexer na ficha que toca estes departamentos. */
export async function assertWorkerScope(actor: Actor, action: "create" | "update", departments: readonly string[]) {
  const allowed = await departmentsWith(actor, action);
  if (allowed === null) return;
  if (!departments.some((department) => allowed.includes(department))) throw new AuthorizationError();
}

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }> };

/** Só trabalhador aprovado e ativo no departamento pode ser escalado (regra do mock). */
export async function assertSchedulableWorker(db: Queryable, workerId: string, department: string, fn?: string) {
  const result = await db.query(
    `select w.functions from app.workers w
       join app.worker_departments wd on wd.worker_id = w.id and wd.department_key = $2
      where w.id = $1 and w.status = 'active'`,
    [workerId, department]
  );
  const row = result.rows[0] as { functions: string[] } | undefined;
  if (!row) throw new AppError("Trabalhador sem aprovação da Diretoria ou fora deste departamento.", 409, "WORKER_NOT_APPROVED");
  if (fn && !row.functions.includes(fn)) throw new AppError(`Trabalhador sem a função ${fn} na ficha.`, 409, "WORKER_FUNCTION_MISSING");
}
