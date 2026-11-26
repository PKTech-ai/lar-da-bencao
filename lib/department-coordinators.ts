import { query } from "@/lib/db";

/**
 * Quem conta como coordenação do departamento nas listas de nomes (`ud` = app.user_departments). Vale para quem tem
 * tudo marcado e para quem já era da coordenação e teve item desmarcado, mas ainda altera algo ali. Não dá acesso a nada.
 */
export const COORDINATION_SQL = "(ud.access_level = 'coordenacao' or ud.keeps_coordination)";

/**
 * Nomes da coordenação do departamento (página da Doutrina, folha impressa da escala): quem foi vinculado na
 * Coordenação em Organograma › Organograma de Vinculação. Enquanto ninguém foi vinculado ali, vale a regra antiga:
 * perfil Coordenador com nível Coordenação no departamento.
 */
export async function departmentCoordinators(department: string) {
  const linked = await query<{ name: string }>(
    `select coalesce(w.full_name, u.full_name) as name from app.org_links l
       join app.users u on u.id = l.user_id left join app.workers w on w.id = u.worker_id
      where l.seat = 'coordenacao' and l.department_key = $1 and u.status = 'active' order by l.created_at`,
    [department]
  );
  if (linked.rows.length) return linked.rows.map((r) => r.name);
  const result = await query<{ full_name: string }>(
    `select u.full_name from app.users u
       join app.user_departments ud on ud.user_id = u.id and ud.department_key = $1 and ${COORDINATION_SQL}
      where u.status = 'active' and u.role_key = 'coordenador' order by u.full_name`,
    [department]
  );
  return result.rows.map((r) => r.full_name);
}
