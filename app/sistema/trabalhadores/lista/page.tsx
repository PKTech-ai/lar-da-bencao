import Link from "next/link";
import { z } from "zod";
import { AutoPrint } from "@/components/auto-print";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { requireModulePage } from "@/lib/page-auth";
import { formatMoney } from "@/lib/resources/types";
import { workerStatusLabel, type WorkerStatus } from "@/lib/worker-constants";
import { birthInfo, brDateOnly } from "@/lib/worker-list-print";
import { departmentsWith, todayInSaoPaulo } from "@/lib/workers";

const filtersSchema = z.object({
  status: z.enum(["pending", "active", "inactive", "rejected"]).optional().catch(undefined),
  department: z.string().regex(/^[a-z_]+$/).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined)
});

type Row = {
  full_name: string; status: WorkerStatus; birth_date: string | null; filled_date: string | null;
  contribution_cents: string | null; contribution_due_day: number | null; departments: string[]; functions: string[];
};

/** Lista de trabalhadores para impressão, com os mesmos filtros e o mesmo alcance da tela de fichas. */
export default async function WorkerListPrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireModulePage("module_workers", { department: "any" });
  const filters = filtersSchema.parse(await searchParams);
  const scope = await departmentsWith(actor, "read");
  const [rows, labels] = await Promise.all([
    query<Row>(
      `select w.full_name, w.status, to_char(w.birth_date, 'YYYY-MM-DD') as birth_date, to_char(w.filled_date, 'YYYY-MM-DD') as filled_date,
              w.contribution_cents::text as contribution_cents, w.contribution_due_day, w.functions,
              coalesce(array_agg(wd.department_key order by wd.department_key) filter (where wd.department_key is not null), '{}') as departments
         from app.workers w
         left join app.worker_departments wd on wd.worker_id = w.id
        where ($1::text is null or w.status = $1)
          and ($2::text[] is null or exists (select 1 from app.worker_departments s where s.worker_id = w.id and s.department_key = any($2)))
          and ($3::text is null or exists (select 1 from app.worker_departments f where f.worker_id = w.id and f.department_key = $3))
        group by w.id
        order by w.full_name`,
      [filters.status ?? null, scope, filters.department ?? null]
    ),
    query<{ key: string; label: string }>("select key, label from app.departments")
  ]);
  const label = new Map(labels.rows.map((d) => [d.key, d.label]));
  const term = filters.q?.toLocaleLowerCase("pt-BR");
  const workers = rows.rows.filter((w) => !term || [w.full_name, ...w.departments.map((d) => label.get(d) ?? d), ...(w.functions ?? [])]
    .join(" ").toLocaleLowerCase("pt-BR").includes(term));
  const today = todayInSaoPaulo();
  const issuedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const total = workers.reduce((sum, w) => sum + (Number(w.contribution_cents) || 0), 0);
  const filterText = [
    filters.status ? workerStatusLabel[filters.status] : "Todas as situações",
    filters.department ? label.get(filters.department) ?? filters.department : "Todos os departamentos",
    filters.q ? `Busca: “${filters.q}”` : ""
  ].filter(Boolean).join(" · ");

  await appendAudit(actor, {
    category: "Impressão", action: "Impressão da lista de trabalhadores", module: "Secretaria", section: "Trabalhadores",
    entityType: "report", details: `${workers.length} trabalhador(es) · ${filterText}`
  });

  return (
    <>
      <AutoPrint />
      <div className="row-actions no-print" style={{ marginBottom: 12 }}>
        <Link className="button" href="/sistema/trabalhadores">Voltar</Link>
        <PrintButton label="⎙ Imprimir lista" />
      </div>
      <section className="card worker-print">
        <div className="sheet-title">CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</div>
        <h1>Lista de trabalhadores</h1>
        <p className="small">Emitida em {issuedAt} por {actor.name} · {filterText} · {workers.length} trabalhador(es)</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Nome</th><th>Emissão da ficha</th><th>Aniversário</th><th>Ano</th><th>Idade</th><th>Contribuição</th></tr>
            </thead>
            <tbody>
              {workers.map((w, i) => {
                const birth = birthInfo(w.birth_date, today);
                const cents = Number(w.contribution_cents) || 0;
                return (
                  <tr key={`${w.full_name}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{w.full_name}{w.status !== "active" ? <span className="small muted"> ({workerStatusLabel[w.status].toLowerCase()})</span> : null}</td>
                    <td>{brDateOnly(w.filled_date)}</td>
                    <td>{birth.birthday}</td>
                    <td>{birth.year}</td>
                    <td>{birth.age}</td>
                    <td>{cents ? `${formatMoney(cents)}${w.contribution_due_day ? ` · dia ${String(w.contribution_due_day).padStart(2, "0")}` : ""}` : "—"}</td>
                  </tr>
                );
              })}
              {!workers.length ? <tr><td colSpan={7}>Nenhum trabalhador com estes filtros.</td></tr> : null}
            </tbody>
            {workers.length ? (
              <tfoot><tr><td colSpan={6}><strong>Total de contribuições por mês</strong></td><td><strong>{formatMoney(total)}</strong></td></tr></tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </>
  );
}
