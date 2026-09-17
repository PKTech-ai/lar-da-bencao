import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AppError, AuthorizationError } from "@/lib/errors";
import { flagForDepartment, requireFlag } from "@/lib/feature-flags";
import { assertPermission, hasPermission } from "@/lib/permissions";
import { classify, enrollmentStatus, isEducationDepartment, type EducationDepartment } from "@/lib/education";
import { todayInSaoPaulo } from "@/lib/workers";

export const educationDepartment = z.custom<EducationDepartment>(isEducationDepartment, "Departamento inválido.");

export async function requireEducation(actor: Actor, department: string, action: "read" | "create" | "update" | "delete") {
  if (!isEducationDepartment(department)) throw new AppError("Departamento não encontrado.", 404, "NOT_FOUND");
  await requireFlag(flagForDepartment(department));
  await assertPermission(actor, "department", action, department);
  return department;
}

export async function canEditEducation(actor: Actor, department: EducationDepartment) {
  return hasPermission(actor, "department", "update", department);
}

/**
 * Turmas visíveis: o perfil Evangelizador enxerga só as turmas/grupos em que está vinculado
 * (vínculo pela ficha de trabalhador com o mesmo e-mail da conta). Demais perfis: todas (`null`).
 */
export async function allowedGroups(actor: Actor, department: EducationDepartment): Promise<string[] | null> {
  if (actor.role !== "evangelizador") return null;
  const result = await query<{ class_group: string }>(
    `select distinct g.class_group from app.education_group_evangelizers g
       join app.workers w on w.id = g.worker_id and w.status = 'active'
      where g.department_key = $1 and lower(w.email) = lower($2)`,
    [department, actor.email]
  );
  return result.rows.map((row) => row.class_group);
}

export function assertGroupAllowed(groups: string[] | null, group: string) {
  if (groups && !groups.includes(group)) throw new AuthorizationError("Esta turma não está vinculada ao seu perfil de evangelizador.");
}

export type EvangelizandoRow = {
  id: string; department_key: EducationDepartment; full_name: string; birth_date: string | null; filled_date: string;
  class_group: string | null; valid_through_year: number; manual_inactive: boolean; version: number;
  [key: string]: unknown;
};

const dateText = (column: string) => `to_char(${column}, 'YYYY-MM-DD') as ${column.split(".").pop()}`;

export const EVANGELIZANDO_COLUMNS = `e.id, e.department_key, e.full_name, ${dateText("e.birth_date")}, ${dateText("e.filled_date")}, e.class_group,
  e.age_reference, e.guardian_name, e.guardian_relation, e.guardian_phone, e.whatsapp, e.address, e.point_reference,
  e.father_name, e.father_contact, e.mother_name, e.mother_contact, e.religion, e.marital_status,
  e.valid_through_year, e.manual_inactive, ${dateText("e.inactive_at")}, e.inactive_reason, e.rancho_requested, e.notes,
  e.photo_attachment_id, e.version, e.updated_at`;

/** Situação e turma efetivas no ano (a turma é recalculada pela idade em 30/06 enquanto a matrícula vigora). */
export function withEffectiveStatus<T extends EvangelizandoRow>(row: T, year = Number(todayInSaoPaulo().slice(0, 4))) {
  const status = enrollmentStatus(row, year);
  const current = status.active ? classify(row.birth_date, row.department_key, year) : null;
  return {
    ...row,
    active: status.active,
    status_reason: status.reason,
    current_group: current?.valid ? current.group : row.class_group,
    current_age: current?.age ?? row.age_reference ?? null
  };
}

/** Evangelizandos com matrícula vigente em algum momento do ano (para chamada, cronograma e aniversariantes). */
export async function activeForYear(department: EducationDepartment, year: number) {
  const result = await query<EvangelizandoRow>(
    `select ${EVANGELIZANDO_COLUMNS} from app.evangelizandos e
      where e.department_key = $1 and not e.manual_inactive
        and e.valid_through_year >= $2 and extract(year from e.filled_date) <= $2
      order by e.full_name`,
    [department, year]
  );
  return result.rows.map((row) => {
    const c = classify(row.birth_date, department, year);
    return { ...row, current_group: c.valid ? c.group : row.class_group ?? "" };
  });
}

/** Lançamentos de turma (chamada/cronograma): coordenação em todo o departamento; evangelizador só nas suas turmas. */
export async function requireClassWrite(actor: Actor, department: string) {
  if (!isEducationDepartment(department)) throw new AppError("Departamento não encontrado.", 404, "NOT_FOUND");
  await requireFlag(flagForDepartment(department));
  if (!(await hasPermission(actor, "education_class", "update", department)) && !(await hasPermission(actor, "department", "update", department))) {
    throw new AuthorizationError();
  }
  return { department, groups: await allowedGroups(actor, department) };
}

export async function canWriteClasses(actor: Actor, department: EducationDepartment) {
  return (await hasPermission(actor, "education_class", "update", department)) || (await hasPermission(actor, "department", "update", department));
}
