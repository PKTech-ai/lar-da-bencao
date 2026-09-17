import type { PoolClient } from "pg";
import type { Actor } from "@/lib/auth";
import { isValidAttendanceCell } from "@/lib/doutrina-attendance";
import { insertSlots } from "@/lib/doutrina-data";
import { FREE_THEME, parseSlotKey } from "@/lib/doutrina-scale";
import { groupNames, isClassSunday } from "@/lib/education";
import type { ImportPlan } from "@/lib/legacy/v215";

export type EntityReport = { created: number; skipped: number };

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

/**
 * Aplica o plano dentro da transação recebida. Idempotente: registros já presentes em
 * `legacy_id_map` (de qualquer importação ativa) são contados como “já importados”.
 */
export async function applyPlan(client: PoolClient, importId: string, plan: ImportPlan, actor: Actor) {
  const report: Record<string, EntityReport> = {};
  const warnings: string[] = [];
  const tally = (entity: string, created: boolean) => {
    report[entity] ??= { created: 0, skipped: 0 };
    report[entity][created ? "created" : "skipped"] += 1;
  };
  const lookup = async (entity: string, legacyKey: string) =>
    (await client.query<{ target_ref: string }>("select target_ref from app.legacy_id_map where entity=$1 and legacy_key=$2", [entity, legacyKey])).rows[0]?.target_ref;
  const remember = (entity: string, legacyKey: string, target: string) =>
    client.query("insert into app.legacy_id_map (import_id, entity, legacy_key, target_ref) values ($1,$2,$3,$4)", [importId, entity, legacyKey, target]);
  const folderRef = async (legacyKey: string) => (await lookup("study_folder", legacyKey)) ?? (await lookup("study_folder_existing", legacyKey));
  const validDepartments = new Set((await client.query<{ key: string }>("select key from app.departments")).rows.map((r) => r.key));

  for (const w of plan.workers) {
    if (await lookup("worker", w.legacy_id)) { tally("worker", false); continue; }
    const departments = w.departments.filter((d) => validDepartments.has(d));
    const inserted = await client.query<{ id: string }>(
      `insert into app.workers (full_name, phone, birth_date, naturality, marital_status, profession, address, filled_date, volunteer_service,
          accepts_volunteer_law, image_authorization, functions, available_days, origin_department, status, requested_at, approved_at,
          notes, created_by, updated_by)
       values ($1,nullif($2,''),nullif($3,'')::date,nullif($4,''),nullif($5,''),nullif($6,''),nullif($7,''),nullif($8,'')::date,$9,$10,$11,$12,$13,$14,$15,
          coalesce(nullif($16,'')::timestamptz, now()),nullif($17,'')::date,'Importado da versão 215.',$18,$18)
       returning id`,
      [w.full_name, w.phone, validDate(w.birth_date) ? w.birth_date : "", w.naturality, w.marital_status, w.profession, w.address,
        validDate(w.filled_date) ? w.filled_date : "", w.volunteer_service, w.accepts_volunteer_law, w.image_authorization, w.functions,
        w.available_days, validDepartments.has(w.origin_department) ? w.origin_department : departments[0], w.status,
        Number.isNaN(Date.parse(w.requested_at)) ? "" : w.requested_at, validDate(w.approved_at) ? w.approved_at : "", actor.id]
    );
    const id = inserted.rows[0].id;
    for (const d of departments) await client.query("insert into app.worker_departments (worker_id, department_key) values ($1,$2)", [id, d]);
    for (const d of w.decisions) {
      if (!validDate(d.meeting_date)) continue;
      await client.query(
        `insert into app.worker_approval_decisions (worker_id, decision, authority, meeting_date, minute_ref, reason, departments, functions, decided_by)
         values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9)`,
        [id, d.decision, d.recorded_by ? `Diretoria (v215 — registro de ${d.recorded_by})` : "Diretoria (v215)", d.meeting_date, d.minute_ref, d.reason, departments, w.functions, actor.id]
      );
    }
    await remember("worker", w.legacy_id, id);
    tally("worker", true);
  }

  for (const s of plan.speakers) {
    if (await lookup("speaker", s.legacy_id)) { tally("speaker", false); continue; }
    const inserted = await client.query<{ id: string }>(
      `insert into app.speakers (full_name, house, city, themes, phone, active, notes, created_by, updated_by)
       values ($1,nullif($2,''),nullif($3,''),$4,nullif($5,''),$6,'Importado da versão 215.',$7,$7) returning id`,
      [s.full_name, s.house, s.city, s.themes, s.phone, s.active, actor.id]
    );
    await remember("speaker", s.legacy_id, inserted.rows[0].id);
    tally("speaker", true);
  }

  // Pastas em ordem topológica (mães antes das filhas); pastas padrão são reaproveitadas pelo nome.
  const pending = [...plan.folders];
  for (let guard = 0; pending.length && guard < 50; guard += 1) {
    for (const f of [...pending]) {
      const parent = f.parent_legacy_id ? await folderRef(f.parent_legacy_id) : null;
      if (f.parent_legacy_id && !parent && pending.some((p) => p.legacy_id === f.parent_legacy_id)) continue;
      pending.splice(pending.indexOf(f), 1);
      if (await folderRef(f.legacy_id)) { tally("study_folder", false); continue; }
      const existing = await client.query<{ id: string }>(
        `select id from app.study_folders where department_key=$1 and lower(title)=lower($2)
            and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
        [f.department_key, f.title, parent ?? null]
      );
      if (existing.rows[0]) {
        // Pasta já existente: só mapeia (entidade própria, fora da reversão).
        if (!(await lookup("study_folder_existing", f.legacy_id))) await remember("study_folder_existing", f.legacy_id, existing.rows[0].id);
        tally("study_folder", false);
        continue;
      }
      const inserted = await client.query<{ id: string }>(
        "insert into app.study_folders (department_key, parent_id, title) values ($1,$2,$3) returning id",
        [f.department_key, parent ?? null, f.title]
      );
      await remember("study_folder", f.legacy_id, inserted.rows[0].id);
      tally("study_folder", true);
    }
  }
  if (pending.length) warnings.push(`${pending.length} pasta(s) com hierarquia circular foram ignoradas.`);

  for (const s of plan.studies) {
    if (await lookup("study", s.legacy_id)) { tally("study", false); continue; }
    const folder = s.folder_legacy_id ? await folderRef(s.folder_legacy_id) : null;
    const inserted = await client.query<{ id: string }>(
      `insert into app.studies (department_key, folder_id, study_type, code, title, reference, description, created_by, updated_by)
       values ($1,$2,$3,nullif($4,''),$5,nullif($6,''),'Importado da versão 215.',$7,$7) returning id`,
      [s.department_key, folder ?? null, s.study_type, s.code, s.title, s.reference, actor.id]
    );
    await remember("study", s.legacy_id, inserted.rows[0].id);
    tally("study", true);
  }

  const students = new Map<string, string>();
  const createdStudents = new Map<string, string>();
  for (const e of plan.evangelizandos) {
    const known = await lookup("evangelizando", e.legacy_id);
    if (known) { students.set(e.legacy_id, known); tally("evangelizando", false); continue; }
    if (!validDate(e.birth_date) || !validDate(e.filled_date)) { warnings.push(`Evangelizando ${e.full_name}: datas inválidas, ignorado.`); continue; }
    const inserted = await client.query<{ id: string }>(
      `insert into app.evangelizandos (department_key, full_name, birth_date, filled_date, class_group, guardian_name, guardian_relation,
          guardian_phone, whatsapp, address, point_reference, father_name, father_contact, mother_name, mother_contact, religion,
          marital_status, valid_through_year, year_enrolled, manual_inactive, status, rancho_requested, notes, created_by, updated_by)
       values ($1,$2,$3::date,$4::date,nullif($5,''),nullif($6,''),nullif($7,''),nullif($8,''),nullif($9,''),nullif($10,''),nullif($11,''),
          nullif($12,''),nullif($13,''),nullif($14,''),nullif($15,''),nullif($16,''),nullif($17,''),$18,$19,$20,
          case when $20 then 'inactive' else 'active' end,$21,$22,$23,$23)
       returning id`,
      [e.department_key, e.full_name, e.birth_date, e.filled_date, e.class_group, e.guardian_name, e.guardian_relation, e.guardian_phone,
        e.whatsapp, e.address, e.point_reference, e.father_name, e.father_contact, e.mother_name, e.mother_contact, e.religion,
        e.marital_status, e.valid_through_year, Number(e.filled_date.slice(0, 4)), e.manual_inactive, e.rancho_requested,
        e.notes || "Importado da versão 215.", actor.id]
    );
    const id = inserted.rows[0].id;
    for (const r of e.renewals) {
      await client.query(
        "insert into app.evangelizando_renewals (evangelizando_id, year, class_group, renewed_by) values ($1,$2,$3,$4) on conflict do nothing",
        [id, r.year, r.class_group || e.class_group || "—", actor.id]
      );
    }
    students.set(e.legacy_id, id);
    createdStudents.set(e.legacy_id, id);
    await remember("evangelizando", e.legacy_id, id);
    tally("evangelizando", true);
  }
  const studentId = async (legacyId: string) => students.get(legacyId) ?? (await lookup("evangelizando", legacyId));

  for (const g of plan.group_evangelizers) {
    const worker = await lookup("worker", g.worker_legacy_id);
    if (!worker || !groupNames(g.department_key).includes(g.class_group)) { tally("group_evangelizer", false); continue; }
    const inserted = await client.query(
      `insert into app.education_group_evangelizers (department_key, class_group, position, worker_id, updated_by)
       select $1,$2,$3,$4,$5 where exists (select 1 from app.worker_departments where worker_id=$4 and department_key=$1)
       on conflict do nothing`,
      [g.department_key, g.class_group, g.position, worker, actor.id]
    );
    if (inserted.rowCount) await remember("group_evangelizer", `${g.department_key}|${g.class_group}|${g.position}`, `${g.department_key}|${g.class_group}|${g.position}`);
    tally("group_evangelizer", Boolean(inserted.rowCount));
  }

  for (const a of plan.attendance) {
    const id = await studentId(a.evangelizando_legacy_id);
    if (!id || !validDate(a.date) || !isClassSunday(a.date)) { tally("evangelizando_attendance", false); continue; }
    const inserted = await client.query(
      "insert into app.evangelizando_attendance (evangelizando_id, class_date, mark, updated_by) values ($1,$2::date,$3,$4) on conflict do nothing",
      [id, a.date, a.mark, actor.id]
    );
    if (inserted.rowCount) await remember("evangelizando_attendance", `${a.evangelizando_legacy_id}|${a.date}`, `${id}|${a.date}`);
    tally("evangelizando_attendance", Boolean(inserted.rowCount));
  }

  for (const r of plan.schedule) {
    if (!validDate(r.date) || !isClassSunday(r.date) || !groupNames(r.department_key).includes(r.class_group)) { tally("education_schedule", false); continue; }
    const inserted = await client.query(
      `insert into app.education_schedule (department_key, class_date, class_group, theme, responsible, updated_by)
       values ($1,$2::date,$3,$4,$5,$6) on conflict do nothing`,
      [r.department_key, r.date, r.class_group, r.theme, r.responsible, actor.id]
    );
    const ref = `${r.department_key}|${r.date}|${r.class_group}`;
    if (inserted.rowCount) await remember("education_schedule", ref, ref);
    tally("education_schedule", Boolean(inserted.rowCount));
  }

  for (const c of plan.doctrine_attendance) {
    if (!validDate(c.date) || !isValidAttendanceCell(c.date.slice(0, 7), c.date, c.row_id)) { tally("doctrine_attendance", false); continue; }
    const inserted = await client.query<{ id: string }>(
      `insert into app.attendance_counts (department_key, sheet_date, row_id, value, updated_by)
       values ('doutrina',$1::date,$2,$3,$4) on conflict do nothing returning id`,
      [c.date, c.row_id, c.value, actor.id]
    );
    if (inserted.rows[0]) await remember("doctrine_attendance", `${c.date}|${c.row_id}`, inserted.rows[0].id);
    tally("doctrine_attendance", Boolean(inserted.rowCount));
  }

  let unmapped = 0;
  for (const s of plan.scales) {
    const [year, month] = s.month.split("-").map(Number);
    const created = await client.query<{ id: string }>(
      `insert into app.scale_months (department_key, year, month, status, reviewed, generated_at, created_by, updated_by)
       values ('doutrina',$1,$2,$3,$4,now(),$5,$5) on conflict (department_key, year, month) do nothing returning id`,
      [year, month, s.status, s.reviewed, actor.id]
    );
    if (!created.rows[0]) { tally("scale_month", false); continue; }
    const slots: [string, string][] = [];
    const edited: [string, string][] = [];
    for (const [slot, value, wasEdited] of s.slots) {
      if (!parseSlotKey(slot)) { unmapped += 1; continue; }
      let mapped = "";
      if (value === FREE_THEME) mapped = value;
      else if (value.startsWith("w:")) mapped = (await lookup("worker", value.slice(2))) ? `w:${await lookup("worker", value.slice(2))}` : "";
      else if (value.startsWith("s:")) mapped = (await lookup("speaker", value.slice(2))) ? `s:${await lookup("speaker", value.slice(2))}` : "";
      else if (value.startsWith("t:")) mapped = (await lookup("study", `doutrina:${value.slice(2)}`)) ? `t:${await lookup("study", `doutrina:${value.slice(2)}`)}` : "";
      if (value && !mapped) unmapped += 1;
      (wasEdited ? edited : slots).push([slot, mapped]);
    }
    await insertSlots(client, created.rows[0].id, s.month, slots);
    await insertSlots(client, created.rows[0].id, s.month, edited, { edited: true });
    await remember("scale_month", s.month, created.rows[0].id);
    tally("scale_month", true);
  }
  if (unmapped) warnings.push(`${unmapped} posição(ões) de escala ficaram vazias (trabalhador, palestrante ou estudo não encontrado).`);

  if (plan.doctrine_phone) {
    await client.query(
      "insert into app.department_contacts (department_key, phone, updated_by) values ('doutrina',$1,$2) on conflict do nothing",
      [plan.doctrine_phone, actor.id]
    );
  }

  /** `students`: somente evangelizandos criados agora (para envio das fotos). */
  return { report, warnings, students: Object.fromEntries(createdStudents) };
}
