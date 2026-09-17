import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { listEnabledFlags } from "@/lib/feature-flags";
import { hasPermission } from "@/lib/permissions";

type Item = { date: string; label: string; module: string; href: string };

/** Agenda transversal: o que está marcado nos próximos 45 dias, dentro do escopo de leitura. */
export async function GET() {
  try {
    const actor = await requireActor();
    const flags = await listEnabledFlags();
    const items: Item[] = [];
    const add = async (flag: string, allowed: Promise<boolean>, sql: string, build: (row: Record<string, string>) => Item) => {
      if (!flags.get(flag) || !(await allowed)) return;
      const result = await query<Record<string, string>>(sql).catch(() => ({ rows: [] }));
      for (const row of result.rows) items.push(build(row));
    };

    await add("module_patrimonio", hasPermission(actor, "department", "read", "patrimonio"),
      `select to_char(clean_date,'YYYY-MM-DD') as date, count(*)::text as people
         from app.cleaning_roster where status = 'scheduled' and clean_date between current_date and current_date + 45
         group by 1 order by 1`,
      (row) => ({ date: row.date, label: `Limpeza da Casa · ${row.people} pessoa(s)`, module: "Patrimônio", href: "/sistema/patrimonio/limpeza" }));

    await add("module_eventos", hasPermission(actor, "department", "read", "eventos"),
      `select to_char(event_date,'YYYY-MM-DD') as date, name
         from app.events where archived_at is null and status in ('A definir','Planejado','Em preparação')
           and event_date between current_date and current_date + 45 order by event_date`,
      (row) => ({ date: row.date, label: row.name, module: "Eventos", href: "/sistema/eventos" }));

    await add("module_secretaria", hasPermission(actor, "secretaria", "read"),
      `select to_char(meeting_date,'YYYY-MM-DD') as date, title
         from app.meetings where archived_at is null and meeting_date between current_date and current_date + 45 order by meeting_date`,
      (row) => ({ date: row.date, label: row.title, module: "Secretaria", href: "/sistema/secretaria" }));

    await add("module_assistencia", hasPermission(actor, "department", "read", "assistencia_social"),
      `select to_char(planned_date,'YYYY-MM-DD') as date, responsible
         from app.social_hygiene_kits where archived_at is null and status = 'Programada'
           and planned_date between current_date and current_date + 45 order by planned_date`,
      (row) => ({ date: row.date, label: `Kits de higiene · ${row.responsible}`, module: "Assistência", href: "/sistema/assistencia/kits" }));

    items.sort((a, b) => a.date.localeCompare(b.date));
    return Response.json({ items: items.slice(0, 50) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
