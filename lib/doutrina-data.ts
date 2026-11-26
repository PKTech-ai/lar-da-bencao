import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertModule, hasModule } from "@/lib/permissions";
import {
  findConflicts, isWeeklyPsych, monthWeekRange, parseSlotKey, roleOf, slotDate, validateSlotValue,
  type PsychBooking, type RecessDay, type ScaleSpeaker, type ScaleStatus, type ScaleStudy, type ScaleWorker
} from "@/lib/doutrina-scale";

type Db = Pick<PoolClient, "query">;
const pool: Db = { query: ((text: string, values?: unknown[]) => query(text, values)) as Db["query"] };

export async function requireDoutrina(actor: Actor, action: "read" | "update", module: string) {
  await requireFlag("module_doutrina");
  await assertModule(actor, "doutrina", module, action);
}

export async function canEditDoutrina(actor: Actor, module: string) {
  return hasModule(actor, "doutrina", module, "update");
}

export async function loadScaleOptions(db: Db = pool) {
  // Sequencial: um cliente de transação não aceita consultas simultâneas.
  const workers = await db.query<ScaleWorker>(
    `select w.id, w.full_name as name, w.functions, coalesce(w.available_days, '{}')::int[] as days
       from app.workers w join app.worker_departments wd on wd.worker_id = w.id and wd.department_key = 'doutrina'
      where w.status = 'active' order by w.full_name`
  );
  const speakers = await db.query<ScaleSpeaker>("select id, full_name as name from app.speakers where active order by full_name");
  // `le`: estudo na pasta "LE" (O Livro dos Espíritos) da biblioteca ou numa subpasta — vai para o estudo de obra do sábado.
  // `mep`: estudo na pasta "MEP" (Mediunidade: estudo e prática) ou numa subpasta — vai para o roteiro do MEP da quinta.
  const studies = await db.query<ScaleStudy>(
    `with recursive le as (
       select id from app.study_folders
        where department_key = 'doutrina' and parent_id is null and (lower(title) = 'le' or lower(title) like '%livro dos esp%')
       union all
       select f.id from app.study_folders f join le on f.parent_id = le.id
     ), mep as (
       select id from app.study_folders
        where department_key = 'doutrina' and parent_id is null and (lower(title) = 'mep' or lower(title) like '%mediunidade: estudo%')
       union all
       select f.id from app.study_folders f join mep on f.parent_id = mep.id
     )
     select s.id, s.study_type as type, coalesce(s.code, '') as code, s.title, coalesce(s.reference, '') as reference,
            coalesce(s.folder_id in (select id from le), false) as le,
            coalesce(s.folder_id in (select id from mep), false) as mep
       from app.studies s
      where s.department_key = 'doutrina' and s.active and s.study_type is not null order by s.study_type, s.code, s.title`
  );
  return { workers: workers.rows, speakers: speakers.rows, studies: studies.rows };
}

export type FixedRow = { id: string; key: string; worker_id: string; worker_name: string; section_name: string; role_label: string; created_at: string; created_by_name: string };

/** Trabalhadores fixos da escala da Doutrina (`key` = `dia-da-semana|seção|linha|posição`). */
export async function loadFixed(db: Db = pool) {
  const result = await db.query<FixedRow>(
    `select f.id, f.dow || '|' || f.section_index || '|' || f.role_index || '|' || f.position as key, f.worker_id,
            w.full_name as worker_name, f.section_name, f.role_label, f.created_at, u.full_name as created_by_name
       from app.scale_fixed_assignments f
       join app.workers w on w.id = f.worker_id
       join app.users u on u.id = f.created_by
      where f.department_key = 'doutrina'
      order by f.dow, f.section_index, f.role_index, f.position`
  );
  return result.rows;
}

export type ScaleMonthRow ={ id: string; status: ScaleStatus; reviewed: boolean; version: number; generated_at: string | null; deleted_at: string | null; published_at: string | null };

export async function loadScale(ym: string, db: Db = pool, lock = false) {
  const [year, month] = ym.split("-").map(Number);
  const found = await db.query<ScaleMonthRow>(
    `select id, status, reviewed, version, generated_at, deleted_at, published_at from app.scale_months
      where department_key = 'doutrina' and year = $1 and month = $2 ${lock ? "for update" : ""}`,
    [year, month]
  );
  const row = found.rows[0] ?? null;
  const assignments = new Map<string, string>();
  const edited = new Set<string>();
  const extras = new Set<string>();
  if (row) {
    const slots = await db.query<{ slot_key: string; slot_value: string; edited: boolean; is_extra: boolean }>(
      "select slot_key, slot_value, edited, is_extra from app.scale_assignments where scale_month_id = $1 and slot_key is not null",
      [row.id]
    );
    for (const slot of slots.rows) {
      assignments.set(slot.slot_key, slot.slot_value);
      if (slot.edited) edited.add(slot.slot_key);
      if (slot.is_extra) extras.add(slot.slot_key);
    }
  }
  return { month: row, assignments, edited, extras };
}

/**
 * Uma escrita de escala por vez (todas as datas e meses), para a regra da semana valer entre meses vizinhos.
 * Chame no início da transação, antes de travar o mês. O banco usa a mesma trava na sua conferência final.
 */
export async function lockScales(db: Db) {
  await db.query("select pg_advisory_xact_lock(hashtext('escala:doutrina'))");
}

/** Psicofônicos de quarta e sexta dos outros meses nas semanas que viram o mês (RN-ESC-001). */
export async function loadPsychOutside(ym: string, db: Db = pool): Promise<PsychBooking[]> {
  const { from, to } = monthWeekRange(ym);
  const [year, month] = ym.split("-").map(Number);
  const rows = await db.query<{ date: string; worker_id: string; slot_key: string }>(
    `select to_char(a.work_date, 'YYYY-MM-DD') as date, a.worker_id, a.slot_key
       from app.scale_assignments a join app.scale_months m on m.id = a.scale_month_id
      where m.department_key = 'doutrina' and m.status <> 'deleted' and not (m.year = $3 and m.month = $4)
        and a.work_date between $1::date and $2::date and a.worker_id is not null and a.slot_key is not null`,
    [from, to, year, month]
  );
  return rows.rows.flatMap((r) => {
    const slot = parseSlotKey(r.slot_key);
    return slot && isWeeklyPsych(slot) ? [{ date: r.date, workerId: r.worker_id }] : [];
  });
}

/** Dias sem escala do mês: recesso ou evento da casa (ninguém é escalado). */
export async function loadRecess(ym: string, db: Db = pool): Promise<RecessDay[]> {
  const rows = await db.query<RecessDay>(
    `select to_char(recess_date, 'YYYY-MM-DD') as date, kind from app.scale_recess
      where department_key = 'doutrina' and to_char(recess_date, 'YYYY-MM') = $1 order by recess_date`,
    [ym]
  );
  return rows.rows.map((r) => ({ date: r.date, kind: r.kind }));
}

/** Conflitos (mesma data e psicofônico na quarta e na sexta da semana) + posições que deixaram de ser válidas (ex.: trabalhador afastado). */
export function reviewScale(assignments: ReadonlyMap<string, string>, options: Awaited<ReturnType<typeof loadScaleOptions>>,
  ym: string, outside: readonly PsychBooking[] = []) {
  const conflicts = findConflicts(assignments, ym, outside);
  const invalid: { key: string; message: string }[] = [];
  for (const [key, value] of assignments) {
    const slot = parseSlotKey(key);
    if (!slot || !value) continue;
    const message = validateSlotValue(slot, value, { ...options, assignments: new Map() });
    if (message) invalid.push({ key, message });
  }
  return { conflicts, invalid };
}

export function assertMonthVersion(month: ScaleMonthRow | null, version: number | undefined) {
  if (month && version !== undefined && month.version !== version) {
    throw new AppError("A escala foi alterada por outra sessão. Recarregue antes de continuar.", 409, "VERSION_CONFLICT");
  }
}

export async function insertSlots(db: Db, monthId: string, ym: string, slots: [string, string][], flags: { edited?: boolean; extra?: boolean } = {}) {
  if (!slots.length) return;
  const rows = slots.map(([key, value]) => {
    const slot = parseSlotKey(key)!;
    const role = roleOf(slot);
    const ref = value.slice(2);
    return {
      key, value, date: slotDate(ym, slot.day), label: `${role.section.n} → ${role.label}`,
      worker: value.startsWith("w:") ? ref : null, speaker: value.startsWith("s:") ? ref : null, study: value.startsWith("t:") ? ref : null
    };
  });
  await db.query(
    `insert into app.scale_assignments (scale_month_id, slot_key, slot_value, work_date, role_label, worker_id, speaker_id, study_id, edited, is_extra)
     select $1, r.key, r.value, r.date::date, r.label, r.worker::uuid, r.speaker::uuid, r.study::uuid, $3, $4
       from jsonb_to_recordset($2::jsonb) as r(key text, value text, date text, label text, worker text, speaker text, study text)
     on conflict (scale_month_id, slot_key) do update
       set slot_value = excluded.slot_value, worker_id = excluded.worker_id, speaker_id = excluded.speaker_id,
           study_id = excluded.study_id, edited = excluded.edited or app.scale_assignments.edited`,
    [monthId, JSON.stringify(rows), flags.edited ?? false, flags.extra ?? false]
  );
}

export const speakerSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  house: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  themes: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  phone: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});
