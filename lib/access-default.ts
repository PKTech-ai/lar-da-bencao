/** Nível de acesso de uma página: completo, consulta ou nenhum. */
export type AccessLevel = "full" | "read" | "none";

/** O que o perfil recebe numa página quando não há exceção. `level` nulo: depende do vínculo com o departamento. */
export type DefaultAccess = { level: AccessLevel | null; text: string };

const DEPARTMENT_FULL = ["coordenador", "subcoordenador"];
const DEPARTMENT_READ = ["trabalhador", "evangelizador"];

/**
 * Espelha `app.page_level_for` (supabase/migrations/202609172000_acesso_bienio_ficha.sql) sem a exceção:
 * Documentos e Organograma são consulta para todos; concessão "full" vale sempre; nas páginas ligadas a um
 * departamento, coordenação ganha completo e trabalhador/evangelizador ganham consulta pelo vínculo.
 */
export function defaultAccess(role: string, page: string, base: string | null, departmentPages: readonly string[]): DefaultAccess {
  if (page === "documentos" || page === "organograma") return { level: "read", text: "Consulta" };
  if (base === "full") return { level: "full", text: "Completo" };
  const byDepartment = departmentPages.includes(page);
  if (byDepartment && DEPARTMENT_FULL.includes(role)) {
    return { level: null, text: base === "read" ? "Consulta; completo para quem é do departamento" : "Completo só para quem é do departamento" };
  }
  if (byDepartment && DEPARTMENT_READ.includes(role) && base !== "read") {
    return { level: null, text: "Consulta só para quem é do departamento" };
  }
  if (base === "read") return { level: "read", text: "Consulta" };
  return { level: "none", text: "Sem acesso" };
}

/**
 * O que gravar quando alguém escolhe um nível: nada se já é o atual; "default" (apaga a exceção) quando o
 * escolhido é o próprio padrão do perfil; senão, o nível como exceção.
 */
export function levelToSave(chosen: AccessLevel, exception: AccessLevel | null, fallback: DefaultAccess): AccessLevel | "default" | null {
  if ((exception ?? fallback.level) === chosen) return null;
  if (fallback.level === chosen) return "default";
  return chosen;
}
