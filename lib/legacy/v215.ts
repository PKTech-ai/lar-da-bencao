import { z } from "zod";
import { DOCTRINE_FUNCTIONS } from "@/lib/worker-constants";
import { listEntries, readEntry, sha256Hex } from "@/lib/legacy/zip";

/** Pacote gerado por `CompleteBackup.pack` do mock v215. */
export const LEGACY_KEY = "lar_bencao_demo_integrado_2026_v121_parecer_cf_estatuto_regimento";
export const MAX_PACKAGE_BYTES = 300 * 1024 * 1024;

const manifestSchema = z.object({
  format: z.literal("lar-bencao-completo"),
  formatVersion: z.literal(1),
  appVersion: z.number().int(),
  key: z.literal(LEGACY_KEY),
  createdAt: z.string(),
  createdBy: z.string().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  binary: z.array(z.object({ path: z.string().regex(/^anexos\/\d{6}\.bin$/), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().nonnegative() })),
  counts: z.object({ records: z.number(), files: z.number(), bytes: z.number() })
});
export type LegacyManifest = z.infer<typeof manifestSchema>;

type Json = Record<string, unknown>;

/** Lê e confere o pacote: manifesto, hash do dados.json e hash de cada anexo. */
export async function readPackage(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PACKAGE_BYTES) throw new Error("O pacote ultrapassa 300 MB.");
  const entries = listEntries(bytes);
  const manifestEntry = entries.get("manifesto.json");
  const dataEntry = entries.get("dados.json");
  if (!manifestEntry || !dataEntry) throw new Error("Este arquivo não é um backup completo do Lar da Bênção (v215).");
  const decoder = new TextDecoder();
  const parsed = manifestSchema.safeParse(JSON.parse(decoder.decode(await readEntry(bytes, manifestEntry))));
  if (!parsed.success) throw new Error("Manifesto incompatível: o arquivo não é um backup completo v215.");
  const manifest = parsed.data;
  const dataText = decoder.decode(await readEntry(bytes, dataEntry));
  if ((await sha256Hex(dataText)) !== manifest.sha256) throw new Error("O arquivo de dados está incompleto ou foi alterado.");
  for (const file of manifest.binary) {
    const entry = entries.get(file.path);
    if (!entry) throw new Error(`Anexo ausente no pacote: ${file.path}`);
    const content = await readEntry(bytes, entry);
    if (content.byteLength !== file.size || (await sha256Hex(content)) !== file.sha256) throw new Error(`Anexo alterado ou incompleto: ${file.path}`);
  }
  const payload = JSON.parse(dataText) as { database?: Json };
  const database = payload.database;
  if (!database || !Array.isArray(database.workers)) throw new Error("O backup não contém os cadastros essenciais.");
  return { manifest, database };
}

const DEPARTMENTS: Record<string, string> = {
  "Doutrina": "doutrina", "Infância": "infancia", "Juventude": "juventude", "Assistência e Promoção Social": "assistencia_social",
  "Tesouraria": "tesouraria", "Conselho Fiscal": "conselho_fiscal", "Patrimônio": "patrimonio", "Eventos": "eventos",
  "Divulgação": "divulgacao", "Jurídico": "juridico", "Secretaria": "secretaria", "Diretoria": "diretoria"
};
const SCALE_STATUS: Record<string, "generated" | "in_review" | "pending_issues" | "checked" | "approved" | "published"> = {
  "Publicada": "published", "Aprovada": "approved", "Conferida — sem conflitos": "checked",
  "Conferência com pendências": "pending_issues", "Em conferência pela Doutrina": "in_review", "Gerada automaticamente": "generated"
};
const STUDY_TYPES = new Set(["ESE", "ESDE", "MEP", "OBRA", "PALESTRA"]);
/** Primeiros nomes da semente fictícia do mock: pacotes com eles são de demonstração. */
const DEMO_NAMES = new Set(["André Almeida", "Beatriz Barbosa", "Carlos Cardoso", "Daniela Dias", "Eduardo Esteves", "Fernanda Ferreira", "Gabriel Gomes", "Helena Holanda", "Igor Jardim", "Juliana Lima"]);
const DEMO_SPEAKERS = new Set(["Carlos Menezes", "Ana Ribeiro", "Paulo Noronha", "Luciana Prado"]);

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const iso = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "");
const key = (value: unknown) => String(value ?? "").slice(0, 120);
const arr = (value: unknown) => (Array.isArray(value) ? value : []) as Json[];
const obj = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Json;

export function isDemoPackage(database: Json) {
  const workers = arr(database.workers).map((w) => str(w.name, 160));
  const speakers = arr(database.speakers).map((s) => str(s.name, 160));
  const demoWorkers = workers.filter((n) => DEMO_NAMES.has(n)).length;
  return demoWorkers >= 5 || speakers.filter((n) => DEMO_SPEAKERS.has(n)).length >= 3;
}

/** Mesma detecção sobre o plano já montado (o servidor não confia no navegador). */
export function isDemoPlan(plan: { workers: { full_name: string }[]; speakers: { full_name: string }[] }) {
  return plan.workers.filter((w) => DEMO_NAMES.has(w.full_name)).length >= 5
    || plan.speakers.filter((s) => DEMO_SPEAKERS.has(s.full_name)).length >= 3;
}

export const planSchema = z.object({
  workers: z.array(z.object({
    legacy_id: z.string(), full_name: z.string().min(2).max(160), phone: z.string(), birth_date: z.string(), naturality: z.string(),
    marital_status: z.string(), profession: z.string(), address: z.string(), filled_date: z.string(), volunteer_service: z.string(),
    accepts_volunteer_law: z.boolean(), image_authorization: z.boolean(), functions: z.array(z.enum(DOCTRINE_FUNCTIONS)),
    available_days: z.array(z.number().int().min(0).max(6)), departments: z.array(z.string()).min(1), origin_department: z.string(),
    status: z.enum(["pending", "active", "inactive", "rejected"]), requested_at: z.string(), approved_at: z.string(),
    decisions: z.array(z.object({
      decision: z.enum(["approved", "rejected"]), meeting_date: z.string(), minute_ref: z.string(), reason: z.string(), recorded_by: z.string()
    }))
  })),
  speakers: z.array(z.object({ legacy_id: z.string(), full_name: z.string().min(2).max(160), house: z.string(), city: z.string(), themes: z.array(z.string()), phone: z.string(), active: z.boolean() })),
  folders: z.array(z.object({ legacy_id: z.string(), department_key: z.enum(["doutrina", "infancia", "juventude"]), title: z.string().min(1).max(160), parent_legacy_id: z.string().nullable(), system: z.boolean() })),
  studies: z.array(z.object({
    legacy_id: z.string(), department_key: z.enum(["doutrina", "infancia", "juventude"]), folder_legacy_id: z.string().nullable(),
    study_type: z.string().nullable(), code: z.string(), title: z.string().min(1).max(200), reference: z.string()
  })),
  evangelizandos: z.array(z.object({
    legacy_id: z.string(), department_key: z.enum(["infancia", "juventude"]), full_name: z.string().min(2).max(160), birth_date: z.string(),
    filled_date: z.string(), class_group: z.string(), guardian_name: z.string(), guardian_relation: z.string(), guardian_phone: z.string(),
    whatsapp: z.string(), address: z.string(), point_reference: z.string(), father_name: z.string(), father_contact: z.string(),
    mother_name: z.string(), mother_contact: z.string(), religion: z.string(), marital_status: z.string(), valid_through_year: z.number().int(),
    manual_inactive: z.boolean(), rancho_requested: z.boolean(), notes: z.string(),
    renewals: z.array(z.object({ year: z.number().int(), class_group: z.string() }))
  })),
  group_evangelizers: z.array(z.object({ department_key: z.enum(["infancia", "juventude"]), class_group: z.string(), position: z.union([z.literal(0), z.literal(1)]), worker_legacy_id: z.string() })),
  attendance: z.array(z.object({ evangelizando_legacy_id: z.string(), date: z.string(), mark: z.enum(["P", "F"]) })),
  schedule: z.array(z.object({ department_key: z.enum(["infancia", "juventude"]), date: z.string(), class_group: z.string(), theme: z.string(), responsible: z.string() })),
  doctrine_attendance: z.array(z.object({ date: z.string(), row_id: z.string(), value: z.number().int().min(0) })),
  scales: z.array(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), status: z.enum(["generated", "in_review", "pending_issues", "checked", "approved", "published"]), reviewed: z.boolean(), slots: z.array(z.tuple([z.string(), z.string(), z.boolean()])) })),
  doctrine_phone: z.string()
});
export type ImportPlan = z.infer<typeof planSchema>;

export type PhotoToImport = { legacy_id: string; department_key: "infancia" | "juventude"; name: string; data_url: string };

/** Converte o `db` do mock no plano de importação da onda 1 + avisos e relatório de origem. */
export function buildPlan(database: Json) {
  const warnings: string[] = [];
  const dept = (label: unknown) => DEPARTMENTS[String(label)] ?? "";
  const functions = new Set<string>(DOCTRINE_FUNCTIONS);

  const workers: ImportPlan["workers"] = [];
  for (const w of arr(database.workers)) {
    const name = str(w.name, 160);
    const departments = [...new Set(arr(w.departments).map(dept).filter(Boolean))];
    if (name.length < 2 || !departments.length) { warnings.push(`Trabalhador ${key(w.id)} ignorado: sem nome ou departamento válido.`); continue; }
    const approval = String(w.approvalStatus ?? "Pendente");
    const status = approval === "Aprovado" ? (w.active ? "active" : "inactive") : approval === "Rejeitado" ? "rejected" : "pending";
    const history = arr(w.approvalHistory).length ? arr(w.approvalHistory) : w.approvalDecision ? [obj(w.approvalDecision)] : [];
    const decisions = history.map((d) => ({
      decision: d.status === "Aprovado" ? "approved" as const : "rejected" as const,
      meeting_date: iso(d.meetingDate) || iso(d.at) || iso(w.approvedAt) || iso(w.requestedAt),
      minute_ref: str(d.minuteRef, 200),
      reason: str(d.reason, 1900) || (d.status === "Aprovado" ? "" : "Reprovação registrada na versão 215."),
      recorded_by: str(d.by, 120)
    })).filter((d) => d.meeting_date);
    if (status === "active" && !decisions.some((d) => d.decision === "approved")) {
      decisions.push({ decision: "approved", meeting_date: iso(w.approvedAt) || iso(w.requestedAt) || iso(w.filledDate) || "2026-01-01", minute_ref: "", reason: "Aprovação anterior ao fluxo de decisões (v215).", recorded_by: "" });
    }
    workers.push({
      legacy_id: key(w.id), full_name: name, phone: str(w.phone, 40), birth_date: iso(w.birth), naturality: str(w.naturality, 120),
      marital_status: str(w.maritalStatus, 40), profession: str(w.profession, 120), address: str(w.address, 300), filled_date: iso(w.filledDate),
      volunteer_service: str(w.volunteerService, 2000), accepts_volunteer_law: Boolean(w.acceptsVolunteerLaw), image_authorization: Boolean(w.imageAuthorization),
      functions: departments.includes("doutrina") ? [...new Set(arr(w.functions).map(String).filter((f) => functions.has(f)))] as ImportPlan["workers"][number]["functions"] : [],
      available_days: [...new Set(arr(w.days).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))],
      departments, origin_department: dept(w.originDept) || departments[0], status,
      requested_at: typeof w.requestedAt === "string" ? w.requestedAt : "", approved_at: iso(w.approvedAt), decisions
    });
  }
  const workerIds = new Set(workers.map((w) => w.legacy_id));

  const speakers = arr(database.speakers).filter((s) => str(s.name, 160).length >= 2).map((s) => ({
    legacy_id: key(s.id), full_name: str(s.name, 160), house: str(s.house, 160), city: str(s.city, 120),
    themes: arr(s.themes).map((t) => str(t, 80)).filter(Boolean), phone: str(s.phone, 40), active: s.active !== false
  }));

  const folders: ImportPlan["folders"] = [];
  const studies: ImportPlan["studies"] = [];
  const library = [["doutrina", "studyFolders", "studies"], ["infancia", "infanciaStudyFolders", "infanciaStudies"], ["juventude", "juventudeStudyFolders", "juventudeStudies"]] as const;
  for (const [department, folderKey, studyKey] of library) {
    for (const f of arr(database[folderKey])) {
      if (!str(f.name, 160)) continue;
      folders.push({ legacy_id: `${department}:${key(f.id)}`, department_key: department, title: str(f.name, 160), parent_legacy_id: f.parentId ? `${department}:${key(f.parentId)}` : null, system: Boolean(f.system) });
    }
    for (const s of arr(database[studyKey])) {
      const title = str(s.title, 200);
      if (!title) continue;
      const type = String(s.type ?? "").toUpperCase();
      studies.push({
        legacy_id: `${department}:${key(s.id)}`, department_key: department, folder_legacy_id: s.folderId ? `${department}:${key(s.folderId)}` : null,
        study_type: STUDY_TYPES.has(type) ? type : department === "doutrina" ? "OUTRO" : null, code: str(s.code, 40), title, reference: str(s.ref, 300)
      });
      if (s.file || s.assetKey) warnings.push(`Estudo “${title}”: o arquivo (${str(s.file, 80) || str(s.assetKey, 40)}) não vem no backup; anexe-o pela Biblioteca.`);
    }
  }

  const photos: PhotoToImport[] = [];
  const evangelizandos: ImportPlan["evangelizandos"] = [];
  for (const e of arr(database.evangelizandos)) {
    const department = dept(e.dept);
    const name = str(e.name, 160);
    if ((department !== "infancia" && department !== "juventude") || name.length < 2 || !iso(e.birth)) {
      warnings.push(`Evangelizando ${key(e.id)} ignorado: departamento, nome ou nascimento inválido.`);
      continue;
    }
    const filled = iso(e.filledDate) || iso(e.birth);
    evangelizandos.push({
      legacy_id: key(e.id), department_key: department, full_name: name, birth_date: iso(e.birth), filled_date: filled,
      class_group: str(e.group, 60), guardian_name: str(e.guardian, 160), guardian_relation: str(e.guardianRelation, 60), guardian_phone: str(e.phone, 40),
      whatsapp: str(e.whatsapp, 40), address: str(e.address, 300), point_reference: str(e.pointReference, 300), father_name: str(e.father, 160),
      father_contact: str(e.fatherContact, 40), mother_name: str(e.mother, 160), mother_contact: str(e.motherContact, 40), religion: str(e.religion, 80),
      marital_status: str(e.maritalStatus, 40), valid_through_year: Number(e.validThroughYear) || Number(filled.slice(0, 4)),
      manual_inactive: Boolean(e.manualInactive), rancho_requested: Boolean(e.ranchoRequested), notes: str(e.notes, 2000),
      renewals: arr(e.renewalHistory).map((r) => ({ year: Number(r.year), class_group: str(r.group, 60) })).filter((r) => r.year >= 2000 && r.year <= 2100)
    });
    if (typeof e.photo === "string" && /^data:image\/(jpeg|png);base64,/.test(e.photo)) {
      photos.push({ legacy_id: key(e.id), department_key: department, name, data_url: e.photo });
    }
  }
  const studentIds = new Set(evangelizandos.map((e) => e.legacy_id));

  const group_evangelizers: ImportPlan["group_evangelizers"] = [];
  for (const [department, field] of [["infancia", "infanciaClassEvangelizers"], ["juventude", "juventudeGroupEvangelizers"]] as const) {
    for (const [group, ids] of Object.entries(obj(database[field]))) {
      const unique = [...new Set(arr(ids).map(key))].filter((id) => workerIds.has(id)).slice(0, 2);
      unique.forEach((id, position) => group_evangelizers.push({ department_key: department, class_group: group, position: position as 0 | 1, worker_legacy_id: id }));
    }
  }

  const attendance: ImportPlan["attendance"] = [];
  for (const [ym, perStudent] of Object.entries(obj(database.evangelizandoAttendance))) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    for (const [studentId, days] of Object.entries(obj(perStudent))) {
      if (!studentIds.has(studentId)) continue;
      for (const [day, mark] of Object.entries(obj(days))) {
        if (mark !== "P" && mark !== "F") continue;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : /^\d{1,2}$/.test(day) ? `${ym}-${day.padStart(2, "0")}` : "";
        if (date) attendance.push({ evangelizando_legacy_id: studentId, date, mark });
      }
    }
  }

  const schedule = Object.values(obj(database.evangelizandoCronograma)).map(obj)
    .filter((r) => (dept(r.dept) === "infancia" || dept(r.dept) === "juventude") && iso(r.date) && (str(r.theme, 300) || str(r.responsible, 300)))
    .map((r) => ({ department_key: dept(r.dept) as "infancia" | "juventude", date: iso(r.date), class_group: str(r.group, 60), theme: str(r.theme, 300), responsible: str(r.responsible, 300) }));

  const doctrine_attendance: ImportPlan["doctrine_attendance"] = [];
  for (const [ym, cells] of Object.entries(obj(database.doctrineAttendance))) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    for (const [cell, raw] of Object.entries(obj(cells))) {
      const [, day, rowId] = cell.split("|");
      const value = Number(raw);
      if (!rowId || rowId === "__total__" || raw === "" || !Number.isInteger(value) || value < 0) continue;
      doctrine_attendance.push({ date: `${ym}-${String(day).padStart(2, "0")}`, row_id: rowId, value });
    }
  }

  const scales: ImportPlan["scales"] = [];
  for (const [ym, raw] of Object.entries(obj(database.scales))) {
    const scale = obj(raw);
    if (!/^\d{4}-\d{2}$/.test(ym) || scale.deletedAt) continue;
    const edited = obj(scale.e);
    scales.push({
      month: ym, status: SCALE_STATUS[String(scale.status)] ?? "in_review", reviewed: Boolean(scale.reviewed),
      slots: Object.entries(obj(scale.a)).map(([slot, value]) => [slot, String(value ?? ""), Boolean(edited[slot])] as [string, string, boolean])
    });
  }

  const plan: ImportPlan = {
    workers, speakers, folders, studies, evangelizandos, group_evangelizers, attendance, schedule, doctrine_attendance, scales,
    doctrine_phone: str(obj(database.doctrineContact).phone, 40)
  };
  const origin = {
    workers: arr(database.workers).length, speakers: arr(database.speakers).length,
    folders: library.reduce((n, [, f]) => n + arr(database[f]).length, 0), studies: library.reduce((n, [, , s]) => n + arr(database[s]).length, 0),
    evangelizandos: arr(database.evangelizandos).length, photos: photos.length, scales: Object.keys(obj(database.scales)).length,
    users_not_imported: arr(obj(database.accessControl).users).length
  };
  return { plan, photos, warnings, origin };
}
