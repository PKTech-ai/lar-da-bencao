import { query } from "@/lib/db";

/**
 * Quem conta como coordenação do departamento nas listas de nomes (`ud` = app.user_departments). Vale para quem tem
 * tudo marcado e para quem já era da coordenação e teve item desmarcado, mas ainda altera algo ali. Não dá acesso a nada.
 */
export const COORDINATION_SQL = "(ud.access_level = 'coordenacao' or ud.keeps_coordination)";

export async function departmentCoordinators(department: string) {
  const result = await query<{ full_name: string }>(
    `select u.full_name from app.users u
       join app.user_departments ud on ud.user_id = u.id and ud.department_key = $1 and ${COORDINATION_SQL}
      where u.status = 'active' and u.role_key = 'coordenador' order by u.full_name`,
    [department]
  );
  return result.rows.map((r) => r.full_name);
}
