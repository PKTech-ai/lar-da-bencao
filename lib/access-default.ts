/** Nível de acesso de uma página: completo, consulta ou nenhum. */
export type AccessLevel = "full" | "read" | "none";

/**
 * O que o perfil recebe numa página quando não há exceção. `byPerson`: página de departamento, em que cada pessoa
 * ainda recebe o próprio acesso (Usuários > Acesso), que vale por cima do perfil.
 */
export type DefaultAccess = { level: AccessLevel; text: string; byPerson: boolean };

/**
 * Espelha a parte do perfil em `app.page_level_links` (supabase/migrations/202611072100_acesso_por_pessoa.sql), sem a
 * exceção: Documentos e Organograma são consulta para todos; fora isso vale a concessão do perfil.
 */
export function defaultAccess(page: string, base: string | null, departmentPages: readonly string[]): DefaultAccess {
  const byPerson = departmentPages.includes(page);
  if (page === "documentos" || page === "organograma") return { level: "read", text: "Consulta", byPerson };
  if (base === "full") return { level: "full", text: "Completo", byPerson };
  if (base === "read") return { level: "read", text: "Consulta", byPerson };
  return { level: "none", text: "Sem acesso", byPerson };
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
