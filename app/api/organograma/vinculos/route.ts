import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { writeDepartmentMarks } from "@/lib/department-access";
import { marksFromLevel } from "@/lib/department-modules";
import { AppError, errorResponse } from "@/lib/errors";
import { departmentsToRevoke, isBoardSeat, ORG_DEPARTMENTS, ORG_SEATS, seatDepartments, seatLabel, type OrgSeat } from "@/lib/org-links";
import { assertPermission, hasPermission } from "@/lib/permissions";

/**
 * Organograma de Vinculação. Todos os usuários ativos veem quem ocupa cada cargo; só o Administrador vincula e
 * desvincula. Vincular dá acesso total no setor do cargo (lib/org-links.ts → seatDepartments); desvincular tira o
 * acesso que aquele vínculo deu, menos onde outro vínculo da mesma pessoa ainda dá. O perfil da pessoa não muda.
 */

const headers = { "Cache-Control": "private, no-store" };

type LinkRow = { id: string; seat: OrgSeat; department_key: string | null; user_id: string; granted: string[]; name: string; active: boolean };

const LINKS_SQL = `select l.id, l.seat, l.department_key, l.user_id, l.granted, coalesce(w.full_name, u.full_name) as name, u.status = 'active' as active
    from app.org_links l join app.users u on u.id = l.user_id left join app.workers w on w.id = u.worker_id`;

export async function GET() {
  try {
    const actor = await requireActor();
    const canEdit = await hasPermission(actor, "users", "admin");
    const [links, departments, users] = await Promise.all([
      query<LinkRow>(`${LINKS_SQL} order by l.created_at`),
      query<{ key: string; label: string }>("select key, label from app.departments where active order by label"),
      canEdit
        ? query<{ id: string; name: string }>(
          `select u.id, coalesce(w.full_name, u.full_name) as name from app.users u left join app.workers w on w.id = u.worker_id
            where u.status = 'active' order by 2`
        )
        : null
    ]);
    return Response.json({ links: links.rows, departments: departments.rows, users: users?.rows ?? [], canEdit }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

const postSchema = z.object({
  seat: z.enum(ORG_SEATS as [OrgSeat, ...OrgSeat[]]),
  department_key: z.enum(ORG_DEPARTMENTS).nullish(),
  user_id: z.string().uuid("Escolha a pessoa.")
});

/** Vincula a pessoa ao cargo e já libera o acesso total no setor dele. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const input = postSchema.parse(await request.json());
    const department = input.seat === "coordenacao" ? input.department_key ?? null : null;
    if (input.seat === "coordenacao" && !department) throw new AppError("Escolha o departamento.");

    const result = await transaction(async (client) => {
      // Trava a pessoa: uma alteração em Usuários › Acesso ao mesmo tempo espera esta terminar.
      const person = await client.query<{ name: string; status: string }>(
        `select coalesce(w.full_name, u.full_name) as name, u.status from app.users u left join app.workers w on w.id = u.worker_id
          where u.id = $1 for update of u`,
        [input.user_id]
      );
      if (!person.rows[0]) throw new AppError("Pessoa não encontrada.", 404, "USER_NOT_FOUND");
      if (person.rows[0].status !== "active") throw new AppError("Essa conta não está ativa. Ative em Ajustes › Usuários antes de vincular.", 409, "USER_INACTIVE");
      const name = person.rows[0].name;

      const labels = await client.query<{ key: string; label: string }>("select key, label from app.departments where active");
      const label = (key: string) => labels.rows.find((d) => d.key === key)?.label ?? key;
      if (department && !labels.rows.some((d) => d.key === department)) throw new AppError("Departamento inexistente.", 400, "DEPARTMENT_NOT_FOUND");
      const where = seatLabel(input.seat, department ? label(department) : undefined);

      const taken = await client.query<{ user_id: string; name: string }>(
        `${LINKS_SQL} where l.seat = $1 and coalesce(l.department_key, '') = coalesce($2, '')`,
        [input.seat, department]
      );
      if (taken.rows.some((r) => r.user_id === input.user_id)) throw new AppError(`${name} já está vinculado(a) em ${where}.`, 409, "ALREADY_LINKED");
      if (isBoardSeat(input.seat) && taken.rows[0]) {
        throw new AppError(`${where} já está com ${taken.rows[0].name}. Tire essa pessoa antes de vincular outra.`, 409, "SEAT_TAKEN");
      }

      const granted = seatDepartments(input.seat, department, labels.rows.map((d) => d.key));
      const saved = await client.query<{ id: string }>(
        "insert into app.org_links (seat, department_key, user_id, granted, created_by) values ($1, $2, $3, $4, $5) returning id",
        [input.seat, department, input.user_id, granted, actor.id]
      );
      for (const key of granted) await writeDepartmentMarks(client, input.user_id, key, marksFromLevel(key, "coordenacao"), actor.id);

      await appendAudit(actor, {
        category: "Segurança", action: "Vinculação no organograma", module: "Controle de Acesso", section: "Organograma de Vinculação",
        entityType: "user", entityId: input.user_id, result: "success",
        details: `${name} · ${where} · acesso total em: ${granted.map(label).join(", ") || "nada"}`.slice(0, 1800),
        after: { seat: input.seat, department_key: department, granted }
      }, client);
      return { id: saved.rows[0].id, granted };
    });
    return Response.json(result, { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Tira a pessoa do cargo e o acesso que esse vínculo deu (onde nenhum outro vínculo dela ainda dá). */
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const id = z.string().uuid("Vínculo inválido.").parse(new URL(request.url).searchParams.get("id"));

    const result = await transaction(async (client) => {
      const found = await client.query<LinkRow>(`${LINKS_SQL} where l.id = $1`, [id]);
      const link = found.rows[0];
      if (!link) throw new AppError("Esse vínculo já foi retirado. Recarregue a página.", 404, "NOT_FOUND");
      await client.query("select 1 from app.users where id = $1 for update", [link.user_id]);
      const others = await client.query<{ granted: string[] }>("select granted from app.org_links where user_id = $1 and id <> $2", [link.user_id, id]);
      const revoke = departmentsToRevoke(link.granted, others.rows);

      await client.query("delete from app.org_links where id = $1", [id]);
      for (const key of revoke) await writeDepartmentMarks(client, link.user_id, key, [], actor.id);

      const labels = await client.query<{ key: string; label: string }>("select key, label from app.departments");
      const label = (key: string) => labels.rows.find((d) => d.key === key)?.label ?? key;
      await appendAudit(actor, {
        category: "Segurança", action: "Desvinculação no organograma", module: "Controle de Acesso", section: "Organograma de Vinculação",
        entityType: "user", entityId: link.user_id, result: "success",
        details: `${link.name} · ${seatLabel(link.seat, link.department_key ? label(link.department_key) : undefined)} · acesso retirado em: ${revoke.map(label).join(", ") || "nada"}`.slice(0, 1800),
        before: { seat: link.seat, department_key: link.department_key, granted: link.granted }, after: { revoked: revoke }
      }, client);
      return { revoked: revoke };
    });
    return Response.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
