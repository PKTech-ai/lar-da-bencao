import type { PoolClient } from "pg";
import { levelFromMarks, type ModuleMark } from "@/lib/department-modules";

type Db = Pick<PoolClient, "query">;

/**
 * Grava o acesso de uma pessoa num departamento: as marcas por módulo e o resumo em app.user_departments, que o
 * restante do sistema lê (sempre refeito junto com as marcas). Sem marcas, a pessoa fica sem acesso ali.
 * Usado por Usuários › Acesso e pelo Organograma de Vinculação; rode dentro da transação de quem chama.
 */
export async function writeDepartmentMarks(client: Db, userId: string, department: string, marks: readonly ModuleMark[], actorId: string) {
  await client.query("delete from app.user_module_access where user_id = $1 and department_key = $2", [userId, department]);
  for (const mark of marks) {
    await client.query(
      `insert into app.user_module_access (user_id, department_key, module_key, can_edit, updated_by) values ($1, $2, $3, $4, $5)`,
      [userId, department, mark.module, mark.edit, actorId]
    );
  }
  // keeps_coordination só mantém o nome nas listas: quem já era da coordenação e ainda altera algo ali.
  const level = levelFromMarks(department, marks);
  if (level) {
    await client.query(
      `insert into app.user_departments as ud (user_id, department_key, access_level, updated_at, updated_by) values ($1, $2, $3, now(), $4)
       on conflict (user_id, department_key) do update set
         keeps_coordination = excluded.access_level = 'consulta' and $5::boolean and (ud.access_level = 'coordenacao' or ud.keeps_coordination),
         access_level = excluded.access_level, updated_at = now(), updated_by = excluded.updated_by`,
      [userId, department, level, actorId, marks.some((mark) => mark.edit)]
    );
  } else {
    await client.query("delete from app.user_departments where user_id = $1 and department_key = $2", [userId, department]);
  }
}
