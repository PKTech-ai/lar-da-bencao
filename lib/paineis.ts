import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { loadScale, loadScaleOptions, reviewScale } from "@/lib/doutrina-data";
import { scaleStatusLabel } from "@/lib/doutrina-scale";
import { isFlagEnabled } from "@/lib/feature-flags";
import { cashboxData } from "@/lib/ingressos/caixa";
import { roleAllows, userRoleFor } from "@/lib/ingressos/acesso";
import { activeEvent } from "@/lib/ingressos/dados";
import { pendingFor } from "@/lib/pendencias";
import { hasPermission, pageLevel } from "@/lib/permissions";
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

// ---------- Secretaria ----------

const brShort = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const longMonth = (ym: string) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1] ?? ym}/${ym.slice(0, 4)}`;

export async function painelSecretaria(): Promise<Painel> {
  const [numbers, next, trend] = await Promise.all([
    query<{ drafts: number; pending: number; birthdays: number; year: number }>(
      `select (select count(*)::int from app.meetings where archived_at is null and status = 'Rascunho' and meeting_date <= ${TZ_TODAY}) as drafts,
              (select count(*)::int from app.workers where status = 'pending') as pending,
              (select count(*)::int from app.workers w where w.status = 'active' and w.birth_date is not null
                  and exists (select 1 from generate_series(0, 6) g where to_char(${TZ_TODAY} + g, 'MM-DD') = to_char(w.birth_date, 'MM-DD'))) as birthdays,
              (select count(*)::int from app.meetings where archived_at is null
                  and extract(year from meeting_date) = extract(year from ${TZ_TODAY})) as year`),
    query<{ title: string; meeting_date: string }>(
      `select title, to_char(meeting_date, 'YYYY-MM-DD') as meeting_date from app.meetings
        where archived_at is null and meeting_date >= ${TZ_TODAY} order by meeting_date, created_at limit 1`),
    query<{ month: string; total: number }>(
      `with m as (${MONTHS_SQL(12)})
       select m.month, (select count(*)::int from app.meetings r where r.archived_at is null and to_char(r.meeting_date, 'YYYY-MM') = m.month) as total
         from m order by m.month`)
  ]);
  const n = numbers.rows[0];
  const meeting = next.rows[0];
  return {
    kpis: [
      { label: "Próxima reunião", value: meeting ? brShort(meeting.meeting_date) : "—", hint: meeting?.title || "nenhuma marcada", href: "/sistema/secretaria/reunioes" },
      { label: "Atas em rascunho", value: String(n.drafts), hint: "de reuniões já realizadas", href: "/sistema/secretaria/reunioes" },
      { label: "Fichas aguardando", value: String(n.pending), hint: "decisão da Diretoria", href: "/sistema/admissoes" },
      { label: "Aniversários na semana", value: String(n.birthdays), href: "/sistema/secretaria/aniversariantes" }
    ],
    alertas: [
      ...(n.drafts ? [{ label: "ata(s) de reunião já realizada ainda em rascunho", count: n.drafts, href: "/sistema/secretaria/reunioes" }] : []),
      ...(n.pending ? [{ label: "ficha(s) de trabalhador aguardando a Diretoria", count: n.pending, href: "/sistema/admissoes" }] : [])
    ],
    grafico: { title: `Reuniões por mês (${n.year} neste ano)`, format: "number", labels: trend.rows.map((r) => monthLabel(r.month)), series: [{ name: "Reuniões", values: trend.rows.map((r) => r.total) }] },
    acoes: [{ label: "Nova reunião", href: "/sistema/secretaria/reunioes" }, { label: "Gravar reunião", href: "/sistema/secretaria/gravador" }]
  };
}

// ---------- Conselho Fiscal ----------

/** Mês "aguardando parecer": caixa fechado pela Tesouraria (fechar já libera ao Conselho) sem decisão vigente. */
export const AWAITING_OPINION_SQL = `
  select m.reference_month from app.treasury_months m
   where m.status = 'Fechado'
     and not exists (select 1 from app.fiscal_reviews r where r.reference_month = m.reference_month
                      and r.archived_at is null and r.status in ('Deferido', 'Indeferido'))`;

export async function painelConselho(): Promise<Painel> {
  const [awaiting, numbers] = await Promise.all([
    query<{ reference_month: string }>(`${AWAITING_OPINION_SQL} order by m.reference_month`),
    query<{ analysing: number; year: number; last: string | null; rejected: number }>(
      `select (select count(*)::int from app.fiscal_reviews where archived_at is null and status = 'Em análise') as analysing,
              (select count(*)::int from app.fiscal_reviews where archived_at is null and status in ('Deferido', 'Indeferido')
                  and left(reference_month, 4) = to_char(${TZ_TODAY}, 'YYYY')) as year,
              (select max(reference_month) from app.fiscal_reviews where archived_at is null and status in ('Deferido', 'Indeferido')) as last,
              (select count(*)::int from app.fiscal_reviews where archived_at is null and status = 'Indeferido'
                  and left(reference_month, 4) = to_char(${TZ_TODAY}, 'YYYY')) as rejected`)
  ]);
  const n = numbers.rows[0];
  const months = awaiting.rows.map((r) => r.reference_month);
  const href = "/sistema/conselhofiscal/analises";
  return {
    kpis: [
      { label: "Meses aguardando parecer", value: String(months.length), hint: months.length ? `desde ${longMonth(months[0])}` : "nenhum", href },
      { label: "Em análise", value: String(n.analysing), href },
      { label: "Pareceres neste ano", value: String(n.year), hint: n.rejected ? `${n.rejected} indeferido(s)` : undefined, href },
      { label: "Último mês com parecer", value: n.last ? longMonth(n.last) : "—", href }
    ],
    alertas: months.slice(0, 6).map((m) => ({ label: `Caixa de ${longMonth(m)} fechado pela Tesouraria, aguardando parecer`, href })),
    acoes: [{ label: "Analisar o caixa", href }]
  };
}

// ---------- Jurídico ----------

const ELECTION_DATES = [["notice_date", "Edital"], ["registration_end", "Fim das inscrições"], ["vote_date", "Votação"], ["term_start", "Posse"]] as const;

export async function painelJuridico(): Promise<Painel> {
  const [current, last] = await Promise.all([
    query<{ title: string; year: number; stage: string; notice_date: string | null; registration_end: string | null; vote_date: string | null; term_start: string | null; docs: number; today: string }>(
      `select e.title, e.year, e.stage,
              to_char(e.notice_date, 'YYYY-MM-DD') as notice_date, to_char(e.registration_end, 'YYYY-MM-DD') as registration_end,
              to_char(e.vote_date, 'YYYY-MM-DD') as vote_date, to_char(e.term_start, 'YYYY-MM-DD') as term_start,
              (select count(*)::int from app.attachments a where a.owner_type = 'legal_document' and a.owner_id = e.id::text and a.status = 'active') as docs,
              to_char(${TZ_TODAY}, 'YYYY-MM-DD') as today
         from app.elections e where e.archived_at is null and e.stage <> 'Encerrada'
        order by e.year desc, e.created_at desc limit 1`),
    query<{ biennium_label: string; year: number }>(
      `select biennium_label, year from app.elections where archived_at is null and stage in ('Posse', 'Encerrada')
        order by year desc, created_at desc limit 1`)
  ]);
  const e = current.rows[0];
  const href = "/sistema/juridico/eleicoes";
  const upcoming = e
    ? ELECTION_DATES.map(([key, label]): { label: string; date: string | null } => ({ label, date: e[key] }))
      .filter((d): d is { label: string; date: string } => Boolean(d.date && d.date >= e.today))
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    : undefined;
  const days = upcoming && e ? Math.round((Date.parse(upcoming.date) - Date.parse(e.today)) / 86_400_000) : null;
  const when = days === 0 ? "hoje" : `em ${days} dia(s)`;
  const term = last.rows[0];
  return {
    kpis: [
      { label: "Eleição em andamento", value: e ? e.stage : "Nenhuma", hint: e ? `${e.title} · ${e.year}` : undefined, href },
      { label: "Próximo prazo", value: upcoming ? brShort(upcoming.date) : "—", hint: upcoming ? `${upcoming.label} · ${when}` : undefined, href },
      { label: "Documentos da eleição", value: e ? String(e.docs) : "—", href },
      { label: "Biênio atual", value: term?.biennium_label || "—", hint: term ? `eleição de ${term.year}` : undefined }
    ],
    alertas: upcoming && days !== null && days <= 7 ? [{ label: `${upcoming.label} ${days === 0 ? "é hoje" : when} (${brShort(upcoming.date)})`, href }] : [],
    acoes: [{ label: "Eleições", href }, { label: "Relatório anual", href: "/sistema/juridico/relatorio" }]
  };
}

// ---------- Eventos ----------

export async function painelEventos(actor: Actor): Promise<Painel> {
  const [next, numbers, trend, ticketsOn, level] = await Promise.all([
    query<{ name: string; event_date: string | null; missing: number; shifts: number }>(
      `select e.name, to_char(e.event_date, 'YYYY-MM-DD') as event_date,
              (select count(*)::int from app.event_items i where i.event_id = e.id and i.archived_at is null and i.received_qty < i.planned_qty) as missing,
              (select count(*)::int from app.event_shifts s where s.event_id = e.id and s.archived_at is null) as shifts
         from app.events e
        where e.archived_at is null and e.status not in ('Realizado', 'Cancelado') and (e.event_date is null or e.event_date >= ${TZ_TODAY})
        order by e.event_date nulls last, e.name limit 1`),
    query<{ realized: number }>(
      `select count(*)::int as realized from app.events where archived_at is null and status = 'Realizado'
          and extract(year from event_date) = extract(year from ${TZ_TODAY})`),
    query<{ month: string; total: number }>(
      `with m as (${MONTHS_SQL(12)})
       select m.month, (select count(*)::int from app.events e where e.archived_at is null and e.status <> 'Cancelado'
                         and to_char(e.event_date, 'YYYY-MM') = m.month) as total
         from m order by m.month`),
    isFlagEnabled("module_eventos"),
    pageLevel(actor, "eventos")
  ]);
  const ev = next.rows[0];
  // Ingressos: caixa do evento ativo, só para quem tem papel no módulo (Coordenação, Equipe ou Consulta).
  const role = ticketsOn ? userRoleFor(level, actor.departments) : null;
  const ticketEvent = role ? await activeEvent() : null;
  const tickets = ticketEvent ? (await cashboxData(ticketEvent.id)).totals : null;
  const href = "/sistema/eventos/evento";
  const caixa = "/sistema/ingressos/caixa";
  return {
    kpis: [
      { label: "Próximo evento", value: ev ? brShort(ev.event_date) : "—", hint: ev ? ev.name : "nenhum na agenda", href: ev ? href : "/sistema/eventos/agenda" },
      { label: "Itens faltando", value: ev ? String(ev.missing) : "—", hint: "previsto maior que o recebido", href },
      { label: "Escalados", value: ev ? String(ev.shifts) : "—", hint: "no próximo evento", href },
      tickets && ticketEvent
        ? { label: "Ingressos vendidos", value: ticketEvent.goal_tickets ? `${tickets.sold}/${ticketEvent.goal_tickets}` : String(tickets.sold), hint: `${formatMoney(tickets.received_cents)} recebido`, href: caixa }
        : { label: "Eventos realizados no ano", value: String(numbers.rows[0].realized), href: "/sistema/eventos/agenda" }
    ],
    alertas: [
      ...(ev && ev.missing ? [{ label: `item(ns) ainda faltando para ${ev.name}`, count: ev.missing, href }] : []),
      ...(ev && !ev.event_date ? [{ label: `${ev.name}: data ainda a definir`, href: "/sistema/eventos/agenda" }] : []),
      ...(tickets && tickets.overdue ? [{ label: "venda(s) de ingresso a prazo vencida(s)", count: tickets.overdue, href: caixa }] : []),
      ...(tickets && tickets.in_hands_cents ? [{ label: `${formatMoney(tickets.in_hands_cents)} de ingressos com trabalhadores, aguardando acerto`, href: caixa }] : [])
    ],
    grafico: { title: "Eventos por mês", format: "number", labels: trend.rows.map((r) => monthLabel(r.month)), series: [{ name: "Eventos", values: trend.rows.map((r) => r.total) }] },
    acoes: [{ label: "Abrir o evento", href }, ticketEvent && role && roleAllows(role, "venda.criar") ? { label: "Vender ingresso", href: "/sistema/ingressos" } : { label: "Agenda de eventos", href: "/sistema/eventos/agenda" }]
  };
}

// ---------- Divulgação (Livraria) ----------

export async function painelDivulgacao(): Promise<Painel> {
  const month = currentMonth();
  const [numbers, trend] = await Promise.all([
    query<{ sales: string; copies: number; books: number; empty: number; overdue: number }>(
      `with avail as (
         select b.purpose,
                coalesce((select sum(case when m.direction = 'Entrada' then m.quantity else -m.quantity end) from app.book_stock_moves m where m.book_id = b.id and m.archived_at is null), 0)
              - coalesce((select sum(l.quantity - coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0)) from app.book_loans l where l.book_id = b.id and l.archived_at is null), 0)
              - coalesce((select sum(s.quantity) from app.book_sales s where s.book_id = b.id and s.archived_at is null), 0) as available
           from app.books b where b.archived_at is null and b.active = 'Ativo')
       select (select coalesce(sum(quantity * unit_price_cents), 0)::text from app.book_sales where archived_at is null and to_char(sale_date, 'YYYY-MM') = $1) as sales,
              (select coalesce(sum(quantity), 0)::int from app.book_sales where archived_at is null and to_char(sale_date, 'YYYY-MM') = $1) as copies,
              (select count(*)::int from avail) as books,
              (select count(*)::int from avail where available <= 0 and purpose in ('Revenda', 'Empréstimos')) as empty,
              (select count(*)::int from app.book_loans l where l.archived_at is null and l.due_date < ${TZ_TODAY}
                  and l.quantity > coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0)) as overdue`, [month]),
    query<{ month: string; total: string }>(
      `with m as (${MONTHS_SQL(6)})
       select m.month, (select coalesce(sum(s.quantity * s.unit_price_cents), 0)::text from app.book_sales s
                         where s.archived_at is null and to_char(s.sale_date, 'YYYY-MM') = m.month) as total
         from m order by m.month`)
  ]);
  const n = numbers.rows[0];
  return {
    kpis: [
      { label: "Vendas no mês", value: formatMoney(int(n.sales)), hint: `${n.copies} exemplar(es)`, href: "/sistema/divulgacao/vendas" },
      { label: "Obras ativas", value: String(n.books), href: "/sistema/divulgacao/obras" },
      { label: "Obras sem estoque", value: String(n.empty), hint: "revenda e empréstimo", href: "/sistema/divulgacao/estoque" },
      { label: "Empréstimos atrasados", value: String(n.overdue), href: "/sistema/divulgacao/emprestimos" }
    ],
    alertas: [
      ...(n.overdue ? [{ label: "empréstimo(s) de livro atrasado(s)", count: n.overdue, href: "/sistema/divulgacao/emprestimos" }] : []),
      ...(n.empty ? [{ label: "obra(s) de revenda ou empréstimo sem exemplar disponível", count: n.empty, href: "/sistema/divulgacao/estoque" }] : [])
    ],
    grafico: { title: "Vendas da Livraria por mês", format: "money", labels: trend.rows.map((r) => monthLabel(r.month)), series: [{ name: "Vendas", values: trend.rows.map((r) => int(r.total)) }] },
    acoes: [{ label: "Vender livro", href: "/sistema/divulgacao/vendas" }, { label: "Emprestar ou devolver", href: "/sistema/divulgacao/emprestimos" }]
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
