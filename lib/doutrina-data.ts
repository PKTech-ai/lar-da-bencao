import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission, hasPermission } from "@/lib/permissions";
import {
  findConflicts, parseSlotKey, roleOf, slotDate, validateSlotValue,
  type ScaleSpeaker, type ScaleStatus, type ScaleStudy, type ScaleWorker
} from "@/lib/doutrina-scale";

type Db = Pick<PoolClient, "query">;
const pool: Db = { query: ((text: string, values?: unknown[]) => query(text, values)) as Db["query"] };

export async function requireDoutrina(actor: Actor, action: "read" | "update") {
  await requireFlag("module_doutrina");
  await assertPermission(actor, "department", action, "doutrina");
}

export async function canEditDoutrina(actor: Actor) {
  return hasPermission(actor, "department", "update", "doutrina");
}

export async function loadScaleOptions(db: Db = pool) {
  // Sequencial: um cliente de transação não aceita consultas simultâneas.
  const workers = await db.query<ScaleWorker>(
    `select w.id, w.full_name as name, w.functions, coalesce(w.available_days, '{}')::int[] as days
       from app.workers w join app.worker_departments wd on wd.worker_id = w.id and wd.department_key = 'doutrina'
      where w.status = 'active' order by w.full_name`
  );
  const speakers = await db.query<ScaleSpeaker>("select id, full_name as name from app.speakers where active order by full_name");
  const studies = await db.query<ScaleStudy>(
    `select id, study_type as type, coalesce(code, '') as code, title from app.studies
      where department_key = 'doutrina' and active and study_type is not null order by study_type, code, title`
  );
  return { workers: workers.rows, speakers: speakers.rows, studies: studies.rows };
}

export type ScaleMonthRow = { id: string; status: ScaleStatus; reviewed: boolean; version: number; generated_at: string | null; deleted_at: string | null; published_at: string | null };

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

/** Conflitos do mock + posições que deixaram de ser válidas (ex.: trabalhador afastado depois da geração). */
export function reviewScale(assignments: ReadonlyMap<string, string>, options: Awaited<ReturnType<typeof loadScaleOptions>>) {
  const conflicts = findConflicts(assignments);
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
