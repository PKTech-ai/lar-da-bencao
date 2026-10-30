import type { Actor } from "@/lib/auth";
import { DepartmentAbout } from "@/components/department-about";
import { PainelView } from "@/components/painel";
import { BookshopSummary } from "@/components/modules/divulgacao-livraria";
import { PatrimonyOpenOrders } from "@/components/modules/patrimonio-os-resumo";
import { query } from "@/lib/db";
import { buildDepartmentDashboard, workerDepartmentKey } from "@/lib/department-dashboard";
import { departmentInfoFor } from "@/lib/department-info";
import type { ModulePage } from "@/lib/module-pages";
import {
  painelAssistencia, painelConselho, painelDivulgacao, painelEventos, painelJuridico, painelPatrimonio, painelPresidencia,
  painelSecretaria, painelTesouraria, type Painel
} from "@/lib/paineis";

const PAINEIS: Record<string, (actor: Actor) => Promise<Painel>> = {
  tesouraria: painelTesouraria, patrimonio: painelPatrimonio, assistencia: painelAssistencia, secretaria: painelSecretaria,
  conselhofiscal: painelConselho, juridico: painelJuridico, eventos: painelEventos, divulgacao: painelDivulgacao
};

/**
 * Aba "Painel" dos departamentos: os números do próprio trabalho (lib/paineis.ts). Departamento sem painel próprio
 * mostra o quadro de trabalhadores com alertas.
 */
export async function DepartmentDashboard({ page, actor }: { page: ModulePage; actor: Actor }) {
  if (page.slug === "presidencia") {
    const { departamentos, ...painel } = await painelPresidencia(actor);
    return <PainelView painel={painel} departamentos={departamentos} />;
  }
  const specific = PAINEIS[page.slug];
  if (specific) {
    const [painel, coordinators] = await Promise.all([specific(actor), departmentCoordinators(workerDepartmentKey(page))]);
    const info = departmentInfoFor(page.slug);
    return (
      <>
        <PainelView painel={painel} />
        {page.slug === "patrimonio" ? <PatrimonyOpenOrders /> : null}
        {page.slug === "divulgacao" ? <BookshopSummary /> : null}
        {info ? <DepartmentAbout info={info} coordinators={coordinators} /> : null}
      </>
    );
  }
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

async function departmentCoordinators(key: string) {
  const result = await query<{ full_name: string }>(
    `select u.full_name from app.users u join app.user_departments ud on ud.user_id = u.id and ud.department_key = $1
      where u.status = 'active' and u.role_key = 'coordenador' order by u.full_name`, [key]);
  return result.rows.map((r) => r.full_name);
}
