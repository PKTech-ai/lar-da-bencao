import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Relatório anual comum: cada departamento declara os cadastros que entram no relatório,
 * com a coluna de data usada para agrupar por mês. Lista fixa (nada vem da requisição).
 */
type ReportSource = { label: string; table: string; dateColumn: string; where?: string; sum?: { label: string; column: string } };

export const REPORT_SOURCES: Record<string, ReportSource[]> = {
  patrimonio: [
    { label: "Bens cadastrados", table: "patrimony_assets", dateColumn: "entry_date", where: "archived_at is null", sum: { label: "Valor dos bens", column: "value_cents" } },
    { label: "Baixas autorizadas", table: "patrimony_disposals", dateColumn: "disposal_date", where: "status = 'approved'" },
    { label: "Escalas de limpeza", table: "cleaning_roster", dateColumn: "clean_date", where: "status <> 'cancelled'", sum: { label: "Taxas de serviço", column: "fee_cents" } }
  ],
  assistencia_social: [
    { label: "Entregas de rancho", table: "social_rancho_deliveries", dateColumn: "delivery_date", where: "archived_at is null and status = 'Entregue'" },
    { label: "Kits de higiene", table: "social_hygiene_kits", dateColumn: "delivery_date", where: "archived_at is null and status = 'Realizada'" },
    { label: "Atividades realizadas", table: "social_activities", dateColumn: "effective_date", where: "archived_at is null and status = 'Realizada'" }
  ],
  eventos: [
    { label: "Eventos realizados", table: "events", dateColumn: "event_date", where: "archived_at is null and status = 'Realizado'" },
    { label: "Itens previstos", table: "event_items", dateColumn: "created_at", where: "archived_at is null", sum: { label: "Valor estimado", column: "value_cents" } }
  ],
  divulgacao: [
    { label: "Empréstimos", table: "book_loans", dateColumn: "loan_date", where: "archived_at is null" },
    { label: "Vendas", table: "book_sales", dateColumn: "sale_date", where: "archived_at is null" }
  ],
  secretaria: [
    { label: "Reuniões", table: "meetings", dateColumn: "meeting_date", where: "archived_at is null" }
  ],
  juridico: [
    { label: "Etapas de eleição", table: "elections", dateColumn: "notice_date", where: "archived_at is null" }
  ]
};

export async function departmentReport(department: string, year: number) {
  const sources = REPORT_SOURCES[department];
  if (!sources) throw new AppError("Este departamento ainda não tem relatório anual comum.", 404, "NOT_FOUND");
  const rows = [] as { label: string; months: number[]; total: number; sumLabel?: string; sumMonths?: number[]; sumTotal?: number }[];
  for (const source of sources) {
    const result = await query<{ month: number; total: string; amount: string }>(
      `select extract(month from ${source.dateColumn})::int as month, count(*)::text as total,
              ${source.sum ? `coalesce(sum(${source.sum.column}), 0)::text` : "'0'::text"} as amount
         from app.${source.table}
        where extract(year from ${source.dateColumn}) = $1 ${source.where ? `and ${source.where}` : ""}
        group by 1 order by 1`,
      [year]
    );
    const months = Array.from({ length: 12 }, (_, i) => Number(result.rows.find((r) => r.month === i + 1)?.total ?? 0));
    const sumMonths = Array.from({ length: 12 }, (_, i) => Number(result.rows.find((r) => r.month === i + 1)?.amount ?? 0));
    rows.push({
      label: source.label, months, total: months.reduce((a, b) => a + b, 0),
      ...(source.sum ? { sumLabel: source.sum.label, sumMonths, sumTotal: sumMonths.reduce((a, b) => a + b, 0) } : {})
    });
  }
  const workers = await query<{ status: string; total: number }>(
    `select w.status, count(*)::int as total from app.workers w
       join app.worker_departments d on d.worker_id = w.id and d.department_key = $1
      group by 1`,
    [department]
  );
  return { department, year, rows, workers: workers.rows };
}
