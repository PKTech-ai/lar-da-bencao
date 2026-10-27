import { DepartmentAbout } from "@/components/department-about";
import { PatrimonyOpenOrders } from "@/components/modules/patrimonio-os-resumo";
import { query } from "@/lib/db";
import { buildDepartmentDashboard, workerDepartmentKey } from "@/lib/department-dashboard";
import { departmentInfoFor } from "@/lib/department-info";
import type { ModulePage } from "@/lib/module-pages";

/** Aba "Painel" dos departamentos: quadro do departamento, três indicadores e alertas. */
export async function DepartmentDashboard({ page }: { page: ModulePage }) {
  const key = workerDepartmentKey(page);
  const [counts, coordinators] = await Promise.all([
    query<{ active: number; pending: number; birthdays: number }>(
      `select count(*) filter (where w.status = 'active')::int as active,
              count(*) filter (where w.status = 'pending')::int as pending,
              count(*) filter (where w.status = 'active' and extract(month from w.birth_date) = extract(month from (now() at time zone 'America/Sao_Paulo')))::int as birthdays
         from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = $1`, [key]),
    query<{ full_name: string }>(
      `select u.full_name from app.users u join app.user_departments ud on ud.user_id = u.id and ud.department_key = $1
        where u.status = 'active' and u.role_key = 'coordenador' order by u.full_name`, [key])
  ]);
  const c = counts.rows[0] ?? { active: 0, pending: 0, birthdays: 0 };
  const alerts = c.pending ? [`${c.pending} ficha(s) aguardando a Diretoria.`] : [];
  const data = buildDepartmentDashboard({ ...c, alerts });
  const info = departmentInfoFor(page.slug);
  return (
    <>
      <div className="grid cards" style={{ marginBottom: 16 }}>
        {data.kpis.map((k) => <article key={k.label} className="card kpi"><span className="small muted">{k.label}</span><b>{k.value}</b></article>)}
      </div>
      {page.slug === "patrimonio" ? <PatrimonyOpenOrders /> : null}
      {data.alerts.length ? (
        <section className="card">
          <h2>Alertas</h2>
          <ul>{data.alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      ) : null}
      {info ? <DepartmentAbout info={info} coordinators={coordinators.rows.map((r) => r.full_name)} /> : null}
    </>
  );
}
