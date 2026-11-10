import Link from "next/link";
import { ShowMoreRows } from "@/components/show-more";
import { query } from "@/lib/db";
import { requireModulePage } from "@/lib/page-auth";
import { canSeeContact, contactScope } from "@/lib/workers";
import { WEEKDAYS, workerStatusLabel, workerStatusTone, type WorkerStatus } from "@/lib/worker-constants";

export default async function DoutrinaWorkersPage() {
  const actor = await requireModulePage("module_doutrina", { department: "doutrina", module: "trabalhadores" });
  // Quem só consulta a Doutrina não vê o WhatsApp dos colegas.
  const showPhone = canSeeContact(await contactScope(actor), ["doutrina"]);
  const rows = await query<{ id: string; full_name: string; phone: string | null; functions: string[]; available_days: number[]; status: WorkerStatus }>(
    `select w.id, w.full_name, w.phone, w.functions, w.available_days, w.status
       from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina'
      order by (w.status = 'active') desc, w.full_name`
  );
  return (
    <>
      <header className="module-section-head">
        <div><h2>Trabalhadores da Doutrina</h2><p>Somente trabalhadores aprovados pela Diretoria ficam ativos nas escalas.</p></div>
        <Link className="button primary" href="/sistema/trabalhadores">Cadastrar / editar fichas</Link>
      </header>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Funções</th><th>Dias</th>{showPhone ? <th>WhatsApp</th> : null}<th>Situação</th></tr></thead>
            <ShowMoreRows columns={showPhone ? 5 : 4} empty="Nenhum trabalhador vinculado à Doutrina." rows={rows.rows.map((w) => ({
              key: w.id,
              cells: [
                <strong key="n">{w.full_name}</strong>,
                w.functions.join(", ") || "—",
                w.available_days.map((d) => WEEKDAYS[d].slice(0, 3)).join(", "),
                ...(showPhone ? [w.phone ?? "—"] : []),
                <span key="s" className={`status ${workerStatusTone[w.status]}`}>{workerStatusLabel[w.status]}</span>
              ]
            }))} />
          </table>
        </div>
      </section>
    </>
  );
}
