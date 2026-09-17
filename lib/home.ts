import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { listEnabledFlags } from "@/lib/feature-flags";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";

export type HomeCard = { key: string; label: string; value: string; href?: string; hint?: string };

/** Dados institucionais usados na Visão Geral e nas impressões. */
export async function institution() {
  const result = await query<{ name: string; founded_on: string; motto: string; cnpj: string; address: string; phone: string; email: string; version: number }>(
    "select name, to_char(founded_on,'YYYY-MM-DD') as founded_on, motto, cnpj, address, phone, email, version from app.institution_settings where id"
  );
  return result.rows[0];
}

/** Idade da Casa e o próximo aniversário, no fuso de São Paulo. */
export function institutionalMemory(foundedOn: string, today: string) {
  const [year, month, day] = foundedOn.split("-").map(Number);
  const [thisYear] = today.split("-").map(Number);
  const anniversary = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const next = anniversary(today >= anniversary(thisYear) ? thisYear + 1 : thisYear);
  const age = Number(next.slice(0, 4)) - year - 1;
  const days = Math.round((Date.parse(`${next}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return { foundedOn, age, nextAnniversary: next, daysToAnniversary: days };
}

/** KPIs que a pessoa pode ver, módulo por módulo (nada fora do escopo de leitura). */
export async function homeCards(actor: Actor): Promise<HomeCard[]> {
  const flags = await listEnabledFlags();
  const cards: HomeCard[] = [];
  const add = async (flag: string, allowed: Promise<boolean>, build: () => Promise<HomeCard | null>) => {
    if (!flags.get(flag) || !(await allowed)) return;
    const card = await build().catch(() => null);
    if (card) cards.push(card);
  };
  const count = async (sql: string, values: unknown[] = []) => {
    const result = await query<{ count: string }>(sql, values);
    return result.rows[0]?.count ?? "0";
  };

  await add("module_workers", hasAnyDepartmentPermission(actor, "read"), async () => ({
    key: "workers", label: "Trabalhadores ativos", href: "/sistema/trabalhadores",
    value: await count("select count(*)::text as count from app.workers where status = 'active'")
  }));
  await add("module_workers", hasPermission(actor, "presidencia", "approve"), async () => ({
    key: "admissions", label: "Fichas aguardando a Diretoria", href: "/sistema/admissoes",
    value: await count("select count(*)::text as count from app.workers where status = 'pending'")
  }));
  for (const department of ["infancia", "juventude"]) {
    await add(`module_${department}`, hasPermission(actor, "department", "read", department), async () => ({
      key: `evangelizandos-${department}`, label: `Evangelizandos · ${department === "infancia" ? "Infância" : "Juventude"}`,
      href: `/sistema/${department}/evangelizandos`,
      value: await count("select count(*)::text as count from app.evangelizandos where status = 'active' and department_key = $1", [department])
    }));
  }
  await add("module_patrimonio", hasPermission(actor, "department", "read", "patrimonio"), async () => ({
    key: "assets", label: "Bens no patrimônio", href: "/sistema/patrimonio",
    value: await count("select count(*)::text as count from app.patrimony_assets where disposal_date is null and archived_at is null")
  }));
  await add("module_assistencia", hasPermission(actor, "department", "read", "assistencia_social"), async () => ({
    key: "families", label: "Famílias em acompanhamento", href: "/sistema/assistencia",
    value: await count("select count(*)::text as count from app.social_families where status = 'Em acompanhamento' and archived_at is null")
  }));
  await add("module_eventos", hasPermission(actor, "department", "read", "eventos"), async () => ({
    key: "events", label: "Eventos programados", href: "/sistema/eventos",
    value: await count("select count(*)::text as count from app.events where archived_at is null and status in ('A definir','Planejado','Em preparação')")
  }));
  await add("module_divulgacao", hasPermission(actor, "department", "read", "divulgacao"), async () => ({
    key: "loans", label: "Livros emprestados", href: "/sistema/divulgacao",
    value: await count(
      `select coalesce(sum(l.quantity - coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0)), 0)::text as count
         from app.book_loans l where l.archived_at is null`
    )
  }));
  await add("module_tesouraria", hasPermission(actor, "tesouraria", "read"), async () => {
    const result = await query<{ balance: string }>(
      `select coalesce(sum(case when a.nature = 'Receita' then e.amount_cents when a.nature = 'Despesa' then -e.amount_cents else 0 end), 0)::text as balance
         from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
        where e.archived_at is null and date_trunc('month', e.entry_date) = date_trunc('month', current_date)`
    );
    return {
      key: "treasury", label: "Resultado do mês", href: "/sistema/tesouraria",
      value: (Number(result.rows[0].balance) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    };
  });
  await add("module_secretaria", hasPermission(actor, "secretaria", "read"), async () => ({
    key: "meetings", label: "Atas em rascunho", href: "/sistema/secretaria",
    value: await count("select count(*)::text as count from app.meetings where archived_at is null and status = 'Rascunho'")
  }));
  return cards;
}

/** “Minha área”: o que a pessoa tem na própria ficha. */
export async function myArea(actor: Actor) {
  const linked = await query<{ worker_id: string | null }>("select worker_id from app.users where id = $1", [actor.id]);
  const workerId = linked.rows[0]?.worker_id;
  if (!workerId) return null;
  const flags = await listEnabledFlags();
  const [worker, cleaning, shifts, contributions] = await Promise.all([
    query<{ full_name: string; status: string; functions: string[]; departments: string[] }>(
      `select w.full_name, w.status, w.functions,
              coalesce(array_agg(d.department_key order by d.department_key) filter (where d.department_key is not null), '{}') as departments
         from app.workers w left join app.worker_departments d on d.worker_id = w.id
        where w.id = $1 group by w.id`,
      [workerId]
    ),
    flags.get("module_patrimonio")
      ? query(
        `select to_char(clean_date,'YYYY-MM-DD') as clean_date, status, fee_cents, payment_status
           from app.cleaning_roster where worker_id = $1 and status <> 'cancelled' and clean_date >= current_date - 30
          order by clean_date limit 12`,
        [workerId]
      )
      : Promise.resolve({ rows: [] }),
    flags.get("module_eventos")
      ? query(
        `select e.name, to_char(e.event_date,'YYYY-MM-DD') as event_date, s.place
           from app.event_shifts s join app.events e on e.id = s.event_id
          where s.worker_id = $1 and s.archived_at is null and (e.event_date is null or e.event_date >= current_date - 30)
          order by e.event_date nulls last limit 12`,
        [workerId]
      )
      : Promise.resolve({ rows: [] }),
    flags.get("module_tesouraria")
      ? query(
        `select reference_month, to_char(received_at,'YYYY-MM-DD') as received_at, amount_cents::text, kind
           from app.treasury_contributions where worker_id = $1 and archived_at is null order by received_at desc limit 12`,
        [workerId]
      )
      : Promise.resolve({ rows: [] })
  ]);
  return { worker: worker.rows[0] ?? null, cleaning: cleaning.rows, shifts: shifts.rows, contributions: contributions.rows };
}
