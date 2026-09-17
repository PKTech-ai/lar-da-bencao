import Link from "next/link";
import { query } from "@/lib/db";
import { requireModulePage } from "@/lib/page-auth";
import { WEEKDAYS, workerStatusLabel, workerStatusTone, type WorkerStatus } from "@/lib/worker-constants";

export default async function DoutrinaWorkersPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  const rows = await query<{ id: string; full_name: string; phone: string | null; functions: string[]; available_days: number[]; status: WorkerStatus }>(
    `select w.id, w.full_name, w.phone, w.functions, w.available_days, w.status
       from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina'
      order by (w.status = 'active') desc, w.full_name`
  );
  return (
    <>
      <header className="page-heading">
        <div><h1>Trabalhadores da Doutrina</h1><p>Somente trabalhadores aprovados pela Diretoria ficam ativos nas escalas.</p></div>
        <Link className="button primary" href="/sistema/trabalhadores">Cadastrar / editar fichas</Link>
      </header>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Funções</th><th>Dias</th><th>WhatsApp</th><th>Situação</th></tr></thead>
            <tbody>
              {rows.rows.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.full_name}</strong></td>
                  <td>{w.functions.join(", ") || "—"}</td>
                  <td>{w.available_days.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ")}</td>
                  <td>{w.phone ?? "—"}</td>
                  <td><span className={`status ${workerStatusTone[w.status]}`}>{workerStatusLabel[w.status]}</span></td>
                </tr>
              ))}
              {!rows.rowCount ? <tr><td colSpan={5}>Nenhum trabalhador vinculado à Doutrina.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
