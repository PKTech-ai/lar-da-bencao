import { z } from "zod";
import { DOCTRINE_FUNCTIONS, WEEKDAYS } from "@/lib/worker-constants";

/**
 * Regras do cadastro online de trabalhadores (formulário público → fila de revisão).
 * Sem dependência de banco: o mesmo código vale no servidor e na tela de revisão.
 */

export const PUBLIC_WORKER_FORM_FLAG = "public_worker_form";
/** Versão do aviso de privacidade exibido no formulário; gravada em cada envio. */
export const PRIVACY_NOTICE_VERSION = "2026-10-02";
export const SUBMISSION_LIMIT = { max: 5, windowMinutes: 60 } as const;
/** Envios já tratados (aplicados ou descartados) são expurgados depois deste prazo. */
export const SUBMISSION_RETENTION_DAYS = 90;

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const phoneDigits = (value: string) => value.replace(/\D/g, "");

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function isPastDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= todayInSaoPaulo();
}

/**
 * Campos que o trabalhador informa. Contribuição, observações internas e status não fazem parte:
 * chaves desconhecidas são descartadas pelo zod e nunca chegam à fila.
 */
export const submissionPayloadSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).refine((value) => phoneDigits(value).length >= 10, "Informe o telefone com DDD."),
  email: z.string().trim().max(320).email().optional().or(z.literal("")).default(""),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isPastDate, "Informe uma data de nascimento válida."),
  naturality: optionalText(120),
  marital_status: optionalText(40),
  profession: optionalText(120),
  address: optionalText(300),
  volunteer_service: optionalText(2000),
  departments: z.array(z.string().regex(/^[a-z_]+$/)).min(1, "Selecione pelo menos um departamento.").max(12),
  functions: z.array(z.enum(DOCTRINE_FUNCTIONS)).max(DOCTRINE_FUNCTIONS.length).default([]),
  available_days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  accepts_volunteer_law: z.literal(true),
  image_authorization: z.boolean().default(false)
});

export const publicSubmissionSchema = submissionPayloadSchema.extend({ privacy_acknowledged: z.literal(true) });

export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;

/** Mesma normalização da ficha interna: funções só valem para quem marcou Doutrina. */
export function normalizeSubmission(input: SubmissionPayload): SubmissionPayload {
  const departments = [...new Set(input.departments)].sort();
  return {
    full_name: input.full_name,
    phone: input.phone,
    email: input.email,
    birth_date: input.birth_date,
    naturality: input.naturality,
    marital_status: input.marital_status,
    profession: input.profession,
    address: input.address,
    volunteer_service: input.volunteer_service,
    departments,
    functions: departments.includes("doutrina") ? [...new Set(input.functions)].sort() : [],
    available_days: [...new Set(input.available_days)].sort(),
    accepts_volunteer_law: true,
    image_authorization: input.image_authorization
  };
}

/** Robôs preenchem todos os campos; o campo-isca fica escondido de quem usa o formulário. */
export function isHoneypotFilled(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>).website;
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

export function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Compara os 8 últimos dígitos: ignora DDI, DDD e o nono dígito. */
function samePhone(a: string | null, b: string | null) {
  const left = phoneDigits(a ?? "").slice(-8);
  const right = phoneDigits(b ?? "").slice(-8);
  return left.length === 8 && left === right;
}

export type WorkerSummary = { id: string; full_name: string; birth_date: string | null; phone: string | null; status: string };
export type MatchSuggestion = { worker_id: string; reasons: string[] };

/** Fichas parecidas com o envio: mesmo nome (sem acento) ou mesmo nascimento + telefone. */
export function suggestMatches(payload: Pick<SubmissionPayload, "full_name" | "birth_date" | "phone">, workers: readonly WorkerSummary[]): MatchSuggestion[] {
  const name = normalizeName(payload.full_name);
  return workers
    .map((worker) => {
      const reasons: string[] = [];
      if (normalizeName(worker.full_name) === name) reasons.push("mesmo nome");
      if (worker.birth_date?.slice(0, 10) === payload.birth_date && samePhone(worker.phone, payload.phone)) reasons.push("mesmo nascimento e telefone");
      return { worker_id: worker.id, reasons };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length);
}

/** Ficha existente, no formato devolvido por GET /api/workers/[id]. */
export type ExistingFicha = {
  full_name: string; email: string | null; phone: string | null; birth_date: string | Date | null;
  naturality: string | null; marital_status: string | null; profession: string | null; address: string | null;
  filled_date: string | Date | null; volunteer_service: string; accepts_volunteer_law: boolean; image_authorization: boolean;
  functions: string[]; available_days: number[]; departments: string[]; notes: string;
  contribution_cents?: string | number | null; contribution_due_day?: number | null;
};

const dateOnly = (value: string | Date | null | undefined) => {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
};

/**
 * Monta a ficha (entrada do `fichaSchema`) a partir do envio.
 * Com ficha existente: o que o trabalhador informou prevalece; campo opcional deixado em branco
 * não apaga o que já estava cadastrado; contribuição, observações e data de preenchimento ficam como estão.
 */
export function fichaFromSubmission(payload: SubmissionPayload, existing?: ExistingFicha) {
  const keep = (submitted: string, current: string | null | undefined) => submitted || current || "";
  return {
    full_name: payload.full_name,
    phone: payload.phone,
    email: keep(payload.email, existing?.email),
    birth_date: payload.birth_date,
    naturality: keep(payload.naturality, existing?.naturality),
    marital_status: keep(payload.marital_status, existing?.marital_status),
    profession: keep(payload.profession, existing?.profession),
    address: keep(payload.address, existing?.address),
    filled_date: dateOnly(existing?.filled_date),
    volunteer_service: keep(payload.volunteer_service, existing?.volunteer_service),
    accepts_volunteer_law: true,
    image_authorization: payload.image_authorization,
    functions: [...payload.functions],
    available_days: payload.available_days.length || !existing ? [...payload.available_days] : [...existing.available_days],
    departments: [...payload.departments],
    notes: existing?.notes ?? "",
    contribution_cents: Number(existing?.contribution_cents ?? 0),
    contribution_due_day: existing?.contribution_due_day ?? null
  };
}

export type FichaDiff = { field: string; label: string; before: string; after: string };

const yesNo = (value: boolean) => (value ? "Sim" : "Não");
const list = (values: readonly string[]) => [...values].sort().join(", ") || "—";
const brDate = (value: string) => (value ? value.split("-").reverse().join("/") : "—");

/** Diferença campo a campo entre a ficha atual e o que será gravado ao aplicar o envio. */
export function submissionDiff(
  existing: ExistingFicha,
  payload: SubmissionPayload,
  departmentLabel: (key: string) => string = (key) => key
): FichaDiff[] {
  const next = fichaFromSubmission(payload, existing);
  const days = (values: readonly number[]) => [...values].sort().map((day) => WEEKDAYS[day]).join(", ") || "—";
  const rows: FichaDiff[] = [
    { field: "full_name", label: "Nome completo", before: existing.full_name, after: next.full_name },
    { field: "phone", label: "Telefone", before: existing.phone || "—", after: next.phone || "—" },
    { field: "email", label: "E-mail", before: existing.email || "—", after: next.email || "—" },
    { field: "birth_date", label: "Data de nascimento", before: brDate(dateOnly(existing.birth_date)), after: brDate(next.birth_date) },
    { field: "naturality", label: "Naturalidade", before: existing.naturality || "—", after: next.naturality || "—" },
    { field: "marital_status", label: "Estado civil", before: existing.marital_status || "—", after: next.marital_status || "—" },
    { field: "profession", label: "Profissão", before: existing.profession || "—", after: next.profession || "—" },
    { field: "address", label: "Endereço", before: existing.address || "—", after: next.address || "—" },
    { field: "departments", label: "Departamentos", before: list(existing.departments.map(departmentLabel)), after: list(next.departments.map(departmentLabel)) },
    { field: "functions", label: "Funções na Doutrina", before: list(existing.functions), after: list(next.functions) },
    { field: "available_days", label: "Dias disponíveis", before: days(existing.available_days), after: days(next.available_days) },
    { field: "volunteer_service", label: "Serviço voluntário", before: existing.volunteer_service || "—", after: next.volunteer_service || "—" },
    { field: "accepts_volunteer_law", label: "Termo de voluntariado", before: yesNo(existing.accepts_volunteer_law), after: yesNo(next.accepts_volunteer_law) },
    { field: "image_authorization", label: "Autorização de imagem", before: yesNo(existing.image_authorization), after: yesNo(next.image_authorization) }
  ];
  return rows.filter((row) => row.before !== row.after);
}

export const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), origin_department: z.string().regex(/^[a-z_]+$/).optional() }),
  z.object({ action: z.literal("apply"), worker_id: z.string().uuid(), version: z.number().int().positive() }),
  z.object({ action: z.literal("discard"), note: z.string().trim().min(3, "Informe o motivo do descarte.").max(500) })
]);
