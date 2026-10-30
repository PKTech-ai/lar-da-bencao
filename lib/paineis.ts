import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { loadScale, loadScaleOptions, reviewScale } from "@/lib/doutrina-data";
import { scaleStatusLabel } from "@/lib/doutrina-scale";
import { pendingFor } from "@/lib/pendencias";
import { hasPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/resources/types";
import { monthSummary } from "@/lib/treasury";

/**
 * Painéis dos departamentos (Etapa 2 do estudo de uso): 4 números do trabalho, um gráfico de tendência,
 * "Precisa de atenção" com o caminho para resolver e duas ações rápidas.
 * Os meses e o "hoje" seguem o fuso de São Paulo, como o resto do sistema.
 */
export type Kpi = { label: string; value: string; hint?: string; href?: string };
export type Alerta = { label: string; count?: number; href: string };
export type Grafico = {
  title: string;
  format: "money" | "number" | "percent";
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
};
export type Painel = { kpis: Kpi[]; alertas: Alerta[]; grafico?: Grafico; acoes: { label: string; href: string }[] };

const TZ_TODAY = "(now() at time zone 'America/Sao_Paulo')::date";
const MONTHS_SQL = (n: number) =>
  `select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', ${TZ_TODAY}) - interval '${n - 1} months', date_trunc('month', ${TZ_TODAY}), interval '1 month') d`;

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (ym: string) => MONTH_NAMES[Number(ym.slice(5, 7)) - 1] ?? ym;
const int = (value: string | number | null | undefined) => Number(value ?? 0);
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : null);
const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

// ---------- Tesouraria ----------

export async function painelTesouraria(): Promise<Painel> {
  const month = currentMonth();
  const [summary, trend, people, open, pendingLines] = await Promise.all([
    monthSummary(month),
    query<{ month: string; income: string; expense: string }>(
      `with m as (${MONTHS_SQL(12)})
       select m.month,
              (coalesce((select sum(e.amount_cents) from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
                          where e.archived_at is null and a.nature = 'Receita' and to_char(e.entry_date, 'YYYY-MM') = m.month), 0)
               + coalesce((select sum(c.paid_cents) from app.treasury_contributions c where c.reference_month = m.month), 0))::text as income,
              coalesce((select sum(e.amount_cents) from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
                          where e.archived_at is null and a.nature = 'Despesa' and to_char(e.entry_date, 'YYYY-MM') = m.month), 0)::text as expense
         from m order by m.month`),
    query<{ expected: number; paid: number }>(
      `select count(*) filter (where coalesce(w.contribution_cents, 0) > 0)::int as expected,
              count(*) filter (where coalesce(w.contribution_cents, 0) > 0 and coalesce(c.paid_cents, 0) > 0)::int as paid
         from app.workers w left join app.treasury_contributions c on c.worker_id = w.id and c.reference_month = $1
        where w.status = 'active'`, [month]),
    query<{ count: number }>(
      `select count(*)::int as count from (
         select distinct to_char(e.entry_date, 'YYYY-MM') as month from app.treasury_entries e where e.archived_at is null
          and e.entry_date < date_trunc('month', ${TZ_TODAY})) meses
        where not exists (select 1 from app.treasury_months m where m.reference_month = meses.month and m.status <> 'Aberto')`),
    query<{ count: number }>("select count(*)::int as count from app.bank_statement_lines where status = 'pending'")
  ]);
  const p = people.rows[0];
  const missing = p.expected - p.paid;
  const t = summary.totals;
  return {
    kpis: [
      { label: "Saldo do caixa", value: formatMoney(t.closing), hint: `mês ${summary.status.toLowerCase()}`, href: "/sistema/tesouraria/caixa" },
      { label: "Entradas do mês", value: formatMoney(t.income), hint: `${formatMoney(summary.contributions.total)} de contribuições` },
      { label: "Saídas do mês", value: formatMoney(t.expense), hint: `${t.entries} lançamento(s)`, href: "/sistema/tesouraria/lancamentos" },
      { label: "Contribuições do mês", value: p.expected ? `${pct(p.paid, p.expected)}%` : "—", hint: `${p.paid} de ${p.expected} pessoas`, href: "/sistema/tesouraria/contribuicoes" }
    ],
    alertas: [
      ...(open.rows[0].count ? [{ label: "mês(es) anteriores ainda abertos no caixa", count: open.rows[0].count, href: "/sistema/tesouraria/caixa" }] : []),
      ...(pendingLines.rows[0].count ? [{ label: "linha(s) do extrato a conciliar", count: pendingLines.rows[0].count, href: "/sistema/tesouraria/extrato" }] : []),
      ...(missing > 0 ? [{ label: "contribuição(ões) do mês ainda não recebida(s)", count: missing, href: "/sistema/tesouraria/contribuicoes" }] : [])
    ],
    grafico: {
      title: "Entradas e saídas nos últimos 12 meses", format: "money",
      labels: trend.rows.map((r) => monthLabel(r.month)),
      series: [{ name: "Entradas", values: trend.rows.map((r) => int(r.income)) }, { name: "Saídas", values: trend.rows.map((r) => int(r.expense)) }]
    },
    acoes: [{ label: "Lançar entrada ou saída", href: "/sistema/tesouraria/lancamentos" }, { label: "Receber contribuição", href: "/sistema/tesouraria/contribuicoes" }]
  };
}

// ---------- Patrimônio ----------

export async function painelPatrimonio(): Promise<Painel> {
  const [numbers, trend] = await Promise.all([
    query<{ assets: number; value: string; os: number; urgent: number; disposals: number; fees: number }>(
      `select (select count(*)::int from app.patrimony_assets where archived_at is null and disposal_date is null) as assets,
              (select coalesce(sum(value_cents), 0)::text from app.patrimony_assets where archived_at is null and disposal_date is null) as value,
              (select count(*)::int from app.service_orders where status in ('open','in_progress')) as os,
              (select count(*)::int from app.service_orders where status in ('open','in_progress') and priority = 'Urgente'
                  and requested_at < now() - interval '7 days') as urgent,
              (select count(*)::int from app.patrimony_disposals where status = 'pending') as disposals,
              (select count(*)::int from app.cleaning_roster where payment_status = 'pending') as fees`),
    query<{ month: string; total: number }>(
      `with m as (${MONTHS_SQL(6)})
       select m.month, (select count(*)::int from app.service_orders o where to_char(o.requested_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = m.month) as total
         from m order by m.month`)
  ]);
  const n = numbers.rows[0];
  return {
    kpis: [
      { label: "Bens no patrimônio", value: String(n.assets), href: "/sistema/patrimonio/bens" },
      { label: "Valor cadastrado", value: formatMoney(int(n.value)) },
      { label: "Ordens de serviço abertas", value: String(n.os), href: "/sistema/patrimonio/os" },
      { label: "Baixas aguardando", value: String(n.disposals), href: "/sistema/patrimonio/baixas" }
    ],
    alertas: [
      ...(n.urgent ? [{ label: "OS urgente(s) aberta(s) há mais de 7 dias", count: n.urgent, href: "/sistema/patrimonio/os" }] : []),
      ...(n.disposals ? [{ label: "pedido(s) de baixa aguardando a Diretoria", count: n.disposals, href: "/sistema/patrimonio/baixas" }] : []),
      ...(n.fees ? [{ label: "taxa(s) de limpeza a receber", count: n.fees, href: "/sistema/patrimonio/limpeza" }] : [])
    ],
    grafico: { title: "Ordens de serviço abertas por mês", format: "number", labels: trend.rows.map((r) => monthLabel(r.month)), series: [{ name: "OS", values: trend.rows.map((r) => r.total) }] },
    acoes: [{ label: "Cadastrar bem", href: "/sistema/patrimonio/bens" }, { label: "Ordens de serviço", href: "/sistema/patrimonio/os" }]
  };
}

// ---------- Assistência ----------

export async function painelAssistencia(): Promise<Painel> {
  const month = currentMonth();
  const [numbers, trend] = await Promise.all([
    query<{ families: number; baskets: number; kits: number; volunteers: number; late: number; unseen: number }>(
      `select (select count(*)::int from app.social_families where archived_at is null and status = 'Em acompanhamento') as families,
              (select coalesce(sum(baskets), 0)::int from app.social_rancho_deliveries
                where archived_at is null and status = 'Entregue' and to_char(delivery_date, 'YYYY-MM') = $1) as baskets,
              (select coalesce(sum(kits_delivered), 0)::int from app.social_hygiene_kits
                where archived_at is null and status = 'Realizada' and to_char(delivery_date, 'YYYY-MM') = $1) as kits,
              (select count(*)::int from app.social_volunteers where archived_at is null and status = 'Disponível') as volunteers,
              (select count(*)::int from app.social_rancho_deliveries where archived_at is null and status = 'Programada' and reference_month < $1) as late,
              (select count(*)::int from app.social_families f where f.archived_at is null and f.status = 'Em acompanhamento'
                  and not exists (select 1 from app.social_rancho_deliveries r where r.family_id = f.id and r.archived_at is null
                                    and r.status = 'Entregue' and r.delivery_date >= ${TZ_TODAY} - 90)) as unseen`, [month]),
    query<{ month: string; total: number }>(
      `with m as (${MONTHS_SQL(6)})
       select m.month, (select coalesce(sum(baskets), 0)::int from app.social_rancho_deliveries r
                         where r.archived_at is null and r.status = 'Entregue' and to_char(r.delivery_date, 'YYYY-MM') = m.month) as total
         from m order by m.month`)
  ]);
  const n = numbers.rows[0];
  return {
    kpis: [
      { label: "Famílias acompanhadas", value: String(n.families), href: "/sistema/assistencia/familias" },
      { label: "Cestas entregues no mês", value: String(n.baskets), href: "/sistema/assistencia/rancho" },
      { label: "Kits entregues no mês", value: String(n.kits), href: "/sistema/assistencia/kits" },
      { label: "Voluntários disponíveis", value: String(n.volunteers), href: "/sistema/assistencia/voluntarios" }
    ],
    alertas: [
      ...(n.late ? [{ label: "entrega(s) do rancho de meses anteriores ainda programada(s)", count: n.late, href: "/sistema/assistencia/rancho" }] : []),
      ...(n.unseen ? [{ label: "família(s) sem entrega há mais de 90 dias", count: n.unseen, href: "/sistema/assistencia/familias" }] : [])
    ],
    grafico: { title: "Cestas entregues por mês", format: "number", labels: trend.rows.map((r) => monthLabel(r.month)), series: [{ name: "Cestas", values: trend.rows.map((r) => r.total) }] },
    acoes: [{ label: "Registrar entrega do rancho", href: "/sistema/assistencia/rancho" }, { label: "Famílias", href: "/sistema/assistencia/familias" }]
  };
}

// ---------- Doutrina ----------

export async function painelDoutrina(): Promise<Painel> {
  const ym = currentMonth();
  const [numbers, trend, scale, options] = await Promise.all([
    query<{ workers: number; pending: number; public: number }>(
      `select (select count(*)::int from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina' where w.status = 'active') as workers,
              (select count(*)::int from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina' where w.status = 'pending') as pending,
              (select coalesce(sum(value), 0)::int from app.attendance_counts where department_key = 'doutrina' and to_char(sheet_date, 'YYYY-MM') = $1) as public`, [ym]),
    query<{ month: string; total: number }>(
      `with m as (${MONTHS_SQL(6)})
       select m.month, (select coalesce(sum(value), 0)::int from app.attendance_counts a where a.department_key = 'doutrina' and to_char(a.sheet_date, 'YYYY-MM') = m.month) as total
         from m order by m.month`),
    loadScale(ym),
    loadScaleOptions()
  ]);
  const n = numbers.rows[0];
  const active = scale.month && scale.month.status !== "deleted" ? scale.month : null;
  const empty = active ? [...scale.assignments.values()].filter((v) => !v).length : 0;
  const review = active ? reviewScale(scale.assignments, options) : null;
  const conflicts = review ? review.conflicts.length + review.invalid.length : 0;
  return {
    kpis: [
      { label: "Participações no mês", value: String(n.public), href: "/sistema/doutrina/frequencia" },
      { label: "Vagas sem trabalhador", value: active ? String(empty) : "—", hint: "na escala deste mês", href: "/sistema/doutrina/escalas" },
      { label: "Escala do mês", value: active ? scaleStatusLabel[active.status] : "Não gerada", href: "/sistema/doutrina/escalas" },
      { label: "Trabalhadores ativos", value: String(n.workers), href: "/sistema/doutrina/trabalhadores" }
    ],
    alertas: [
      ...(!active ? [{ label: "A escala deste mês ainda não foi gerada", href: "/sistema/doutrina/escalas" }] : []),
      ...(active && empty ? [{ label: "vaga(s) sem trabalhador na escala deste mês", count: empty, href: "/sistema/doutrina/escalas" }] : []),
      ...(conflicts ? [{ label: "conflito(s) ou posição(ões) inválida(s) na escala", count: conflicts, href: "/sistema/doutrina/escalas" }] : []),
      ...(active && active.status !== "published" ? [{ label: `Escala do mês ainda não publicada (${scaleStatusLabel[active.status].toLowerCase()})`, href: "/sistema/doutrina/escalas" }] : []),
      ...(n.pending ? [{ label: "ficha(s) da Doutrina aguardando a Diretoria", count: n.pending, href: "/sistema/trabalhadores" }] : [])
    ],
    grafico: { title: "Participações por mês", format: "number", labels: trend.rows.map((r) => monthLabel(r.month)), series: [{ name: "Participações", values: trend.rows.map((r) => r.total) }] },
    acoes: [{ label: "Escala do mês", href: "/sistema/doutrina/escalas" }, { label: "Lançar frequência", href: "/sistema/doutrina/frequencia" }]
  };
}

// ---------- Evangelização (Infância e Juventude) ----------

export async function painelEvangelizacao(department: "infancia" | "juventude"): Promise<Painel> {
  const ym = currentMonth();
  const [numbers, trend, missing] = await Promise.all([
    query<{ active: number; present: number; marks: number; birthdays: number }>(
      `select (select count(*)::int from app.evangelizandos where department_key = $1 and status = 'active') as active,
              (select count(*) filter (where a.mark = 'P')::int from app.evangelizando_attendance a join app.evangelizandos e on e.id = a.evangelizando_id
                where e.department_key = $1 and to_char(a.class_date, 'YYYY-MM') = $2) as present,
              (select count(*)::int from app.evangelizando_attendance a join app.evangelizandos e on e.id = a.evangelizando_id
                where e.department_key = $1 and to_char(a.class_date, 'YYYY-MM') = $2) as marks,
              (select count(*)::int from app.evangelizandos where department_key = $1 and status = 'active'
                  and extract(month from birth_date) = extract(month from ${TZ_TODAY})) as birthdays`, [department, ym]),
    query<{ month: string; present: number; marks: number }>(
      `with m as (${MONTHS_SQL(6)})
       select m.month,
              (select count(*) filter (where a.mark = 'P')::int from app.evangelizando_attendance a join app.evangelizandos e on e.id = a.evangelizando_id
                where e.department_key = $1 and to_char(a.class_date, 'YYYY-MM') = m.month) as present,
              (select count(*)::int from app.evangelizando_attendance a join app.evangelizandos e on e.id = a.evangelizando_id
                where e.department_key = $1 and to_char(a.class_date, 'YYYY-MM') = m.month) as marks
         from m order by m.month`, [department]),
    // Domingos do mês até hoje sem chamada (recesso em janeiro e fevereiro).
    query<{ count: number }>(
      `select count(*)::int as count from generate_series(date_trunc('month', ${TZ_TODAY}), ${TZ_TODAY}, interval '1 day') d
        where extract(dow from d) = 0 and extract(month from d) not in (1, 2)
          and not exists (select 1 from app.evangelizando_attendance a join app.evangelizandos e on e.id = a.evangelizando_id
                           where e.department_key = $1 and a.class_date = d::date)`, [department])
  ]);
  const n = numbers.rows[0];
  const base = `/sistema/${department}`;
  const presence = pct(n.present, n.marks);
  return {
    kpis: [
      { label: "Evangelizandos ativos", value: String(n.active), href: `${base}/evangelizandos` },
      { label: "Presença no mês", value: presence === null ? "—" : `${presence}%`, hint: `${n.present} presença(s)`, href: `${base}/frequencia` },
      { label: "Domingos sem chamada", value: String(missing.rows[0].count), hint: "neste mês", href: `${base}/frequencia` },
      { label: "Aniversariantes do mês", value: String(n.birthdays), href: `${base}/aniversariantes` }
    ],
    alertas: missing.rows[0].count ? [{ label: "domingo(s) deste mês sem chamada lançada", count: missing.rows[0].count, href: `${base}/frequencia` }] : [],
    grafico: {
      title: "Presença por mês", format: "percent", labels: trend.rows.map((r) => monthLabel(r.month)),
      series: [{ name: "Presença", values: trend.rows.map((r) => pct(r.present, r.marks)) }]
    },
    acoes: [{ label: "Fazer a chamada", href: `${base}/frequencia` }, { label: "Evangelizandos", href: `${base}/evangelizandos` }]
  };
}

// ---------- Presidência e Visão Geral ----------

export type DepartmentCard = { label: string; value: string; hint: string; href: string };

/** Um número principal por departamento, só dos que a pessoa pode abrir. */
export async function departmentCards(actor: Actor): Promise<DepartmentCard[]> {
  const can = (resource: string, department?: string) => hasPermission(actor, resource, "read", department);
  const [tes, dou, inf, juv, ass, pat] = await Promise.all([
    can("tesouraria"), can("department", "doutrina"), can("department", "infancia"), can("department", "juventude"),
    can("department", "assistencia_social"), can("department", "patrimonio")
  ]);
  const cards: Promise<DepartmentCard | null>[] = [
    tes ? monthSummary(currentMonth()).then((s) => ({ label: "Tesouraria", value: formatMoney(s.totals.closing), hint: "saldo do caixa", href: "/sistema/tesouraria" })) : Promise.resolve(null),
    dou ? painelDoutrina().then((p) => ({ label: "Doutrina", value: p.kpis[0].value, hint: "participações no mês", href: "/sistema/doutrina" })) : Promise.resolve(null),
    inf ? painelEvangelizacao("infancia").then((p) => ({ label: "Infância", value: p.kpis[1].value, hint: "presença no mês", href: "/sistema/infancia" })) : Promise.resolve(null),
    juv ? painelEvangelizacao("juventude").then((p) => ({ label: "Juventude", value: p.kpis[1].value, hint: "presença no mês", href: "/sistema/juventude" })) : Promise.resolve(null),
    ass ? painelAssistencia().then((p) => ({ label: "Assistência Social", value: p.kpis[0].value, hint: "famílias acompanhadas", href: "/sistema/assistencia" })) : Promise.resolve(null),
    pat ? painelPatrimonio().then((p) => ({ label: "Patrimônio", value: p.kpis[2].value, hint: "ordens de serviço abertas", href: "/sistema/patrimonio" })) : Promise.resolve(null)
  ];
  return (await Promise.all(cards)).filter((c): c is DepartmentCard => Boolean(c));
}

export async function painelPresidencia(actor: Actor): Promise<Painel & { departamentos: DepartmentCard[] }> {
  const [pending, departamentos, tes] = await Promise.all([pendingFor(actor), departmentCards(actor), hasPermission(actor, "tesouraria", "read")]);
  const decisions = pending.filter((p) => ["admissoes", "baixas", "sugestoes"].includes(p.key)).reduce((s, p) => s + p.count, 0);
  const treasury = tes ? await painelTesouraria() : null;
  const pick = (label: string) => departamentos.find((d) => d.label === label);
  return {
    kpis: [
      { label: "Decisões da Diretoria", value: String(decisions), hint: "fichas, baixas e sugestões", href: "/sistema/presidencia/admissoes" },
      ...(pick("Tesouraria") ? [{ label: "Saldo do caixa", value: pick("Tesouraria")!.value, href: "/sistema/tesouraria" }] : []),
      ...(pick("Doutrina") ? [{ label: "Participações na Doutrina", value: pick("Doutrina")!.value, hint: "no mês", href: "/sistema/doutrina" }] : []),
      ...(pick("Assistência Social") ? [{ label: "Famílias acompanhadas", value: pick("Assistência Social")!.value, href: "/sistema/assistencia" }] : [])
    ].slice(0, 4),
    alertas: pending.map((p) => ({ label: p.label.charAt(0).toLowerCase() + p.label.slice(1), count: p.count, href: p.href })),
    grafico: treasury?.grafico ? { ...treasury.grafico, labels: treasury.grafico.labels.slice(-6), series: treasury.grafico.series.map((s) => ({ ...s, values: s.values.slice(-6) })), title: "Entradas e saídas nos últimos 6 meses" } : undefined,
    acoes: [{ label: "Aprovar fichas", href: "/sistema/presidencia/admissoes" }, { label: "Autorizar baixas", href: "/sistema/presidencia/baixas" }],
    departamentos
  };
}
