import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** Chave-mestra: módulos de negócio (`module_*`) só respondem com ela ligada. */
export const MASTER_FLAG = "business_modules";

const departmentFlags: Record<string, string> = {
  doutrina: "module_doutrina",
  infancia: "module_infancia",
  juventude: "module_juventude"
};

export function isModuleFlag(key: string) {
  return key.startsWith("module_");
}

/** Flag do módulo dono do departamento; departamento sem módulo liberado → 404. */
export function flagForDepartment(department: string) {
  const flag = departmentFlags[department];
  if (!flag) throw new AppError("Este módulo ainda não está liberado.", 404, "MODULE_DISABLED");
  return flag;
}

export function effectiveFlag(key: string, flags: Map<string, boolean>) {
  return flags.get(key) === true && (!isModuleFlag(key) || flags.get(MASTER_FLAG) === true);
}

export async function isFlagEnabled(key: string): Promise<boolean> {
  const keys = isModuleFlag(key) ? [key, MASTER_FLAG] : [key];
  const result = await query<{ key: string; enabled: boolean }>("select key, enabled from app.feature_flags where key = any($1::text[])", [keys]);
  return effectiveFlag(key, new Map(result.rows.map((row) => [row.key, row.enabled])));
}

export async function requireFlag(key: string) {
  if (!(await isFlagEnabled(key))) {
    throw new AppError("Este módulo ainda não está liberado.", 404, "MODULE_DISABLED");
  }
}

/** Mapa de flags já considerando a chave-mestra. */
export async function listEnabledFlags(): Promise<Map<string, boolean>> {
  const result = await query<{ key: string; enabled: boolean }>("select key, enabled from app.feature_flags");
  const raw = new Map(result.rows.map((row) => [row.key, row.enabled]));
  return new Map([...raw.keys()].map((key) => [key, effectiveFlag(key, raw)]));
}
