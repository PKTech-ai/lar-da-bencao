import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

/** Organograma: Diretoria do biênio vigente e coordenação de cada departamento. */
export async function GET() {
  try {
    await requireActor();
    const [board, departments] = await Promise.all([
      query(
        `select u.full_name, r.label as role_label, u.role_key, b.label as biennium,
                to_char(b.starts_on,'YYYY-MM-DD') as starts_on, to_char(b.ends_on,'YYYY-MM-DD') as ends_on
           from app.users u join app.roles r on r.key = u.role_key
           left join app.bienniums b on b.id = u.biennium_id
          where u.status = 'active'
            and u.role_key in ('presidente','vice_presidente','secretario','tesoureiro','conselheiro_fiscal')
          order by case u.role_key when 'presidente' then 1 when 'vice_presidente' then 2 when 'secretario' then 3
                                   when 'tesoureiro' then 4 else 5 end, u.full_name`
      ),
      query(
        `select d.key, d.label,
                coalesce(json_agg(json_build_object('name', u.full_name, 'role', r.label) order by u.full_name)
                         filter (where u.id is not null), '[]') as people
           from app.departments d
           left join app.user_departments ud on ud.department_key = d.key
           left join app.users u on u.id = ud.user_id and u.status = 'active' and u.role_key in ('coordenador','subcoordenador')
           left join app.roles r on r.key = u.role_key
          where d.active group by d.key, d.label order by d.label`
      )
    ]);
    return Response.json({ board: board.rows, departments: departments.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
