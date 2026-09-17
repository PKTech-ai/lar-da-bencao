import Link from "next/link";
import { query } from "@/lib/db";
import { runtimeEnvironment } from "@/lib/environment";
import { listEnabledFlags } from "@/lib/feature-flags";
import { moduleCatalog } from "@/lib/modules";
import { requirePageActor } from "@/lib/page-auth";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const flags = await listEnabledFlags();
  const audit = await hasPermission(actor, "audit", "read");
  const attachments = await hasPermission(actor, "attachments", "read");
  const users = await hasPermission(actor, "users", "admin");

  let summary = { workersActive: 0, admissionsPending: 0, evangelizandosActive: 0, scalesThisMonth: 0 };
  if (flags.get("module_home_ops")) {
    try {
      const [workers, admissions, evangelizandos, scales] = await Promise.all([
        query<{ count: string }>("select count(*)::text as count from app.workers where status='active'"),
        query<{ count: string }>("select count(*)::text as count from app.workers where status='pending'"),
        query<{ count: string }>("select count(*)::text as count from app.evangelizandos where status='active'"),
        query<{ count: string }>(`select count(*)::text as count from app.scale_months where year=extract(year from current_date)::int and month=extract(month from current_date)::int`)
      ]);
      summary = {
        workersActive: Number(workers.rows[0]?.count ?? 0),
        admissionsPending: Number(admissions.rows[0]?.count ?? 0),
        evangelizandosActive: Number(evangelizandos.rows[0]?.count ?? 0),
        scalesThisMonth: Number(scales.rows[0]?.count ?? 0)
      };
    } catch {
      // Tabelas da onda 1 podem ainda não existir no banco local.
    }
  }

  const activeModules = [];
  for (const mod of moduleCatalog) {
    if (mod.key === "home" || !flags.get(mod.flagKey)) continue;
    const allowed = mod.department
      ? await hasPermission(actor, mod.permissionResource, "read", mod.department)
      : mod.permissionResource === "department"
        ? await hasAnyDepartmentPermission(actor, "read")
        : await hasPermission(actor, mod.permissionResource, "read");
    if (allowed) activeModules.push(mod);
  }

  const wave2and3 = [
    "Assistência Social", "Patrimônio", "Eventos", "Divulgação e Livraria",
    "Secretaria", "Presidência", "Tesouraria", "Conselho Fiscal", "Jurídico"
  ];

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="op-eyebrow">LAR DA BÊNÇÃO</p>
          <h1>Ao Lar da Bênção</h1>
          <p>Uma Casa de estudo, acolhimento e caridade.</p>
        </div>
        {runtimeEnvironment().production ? <span className="production-badge">{runtimeEnvironment().label}</span> : <span className="status building">{runtimeEnvironment().label}</span>}
      </header>

      <section className="op-welcome card" style={{ marginBottom: 16 }}>
        <strong>Olá, {actor.name.split(" ")[0]}.</strong>
        <p className="muted">Fundação v216 com módulos da onda 1 no Postgres. Ondas 2 e 3 seguem no BACKLOG_OPERACIONAL.</p>
      </section>

      {flags.get("module_home_ops") ? (
        <div className="grid cards" style={{ marginBottom: 16 }}>
          <article className="card kpi"><span className="small">Trabalhadores ativos</span><b>{summary.workersActive}</b></article>
          <article className="card kpi"><span className="small">Admissões pendentes</span><b>{summary.admissionsPending}</b></article>
          <article className="card kpi"><span className="small">Evangelizandos</span><b>{summary.evangelizandosActive}</b></article>
          <article className="card kpi"><span className="small">Escalas do mês</span><b>{summary.scalesThisMonth}</b></article>
        </div>
      ) : null}

      <div className="grid cards">
        {audit ? <Link href="/sistema/auditoria" className="card card-link"><span className="status ready">Ativo</span><h2>Dedo-duro</h2><p>Auditoria append-only, filtros e exportação controlada.</p></Link> : null}
        {attachments ? <Link href="/sistema/anexos" className="card card-link"><span className="status ready">Ativo</span><h2>Anexos privados</h2><p>Arquivos fracionados e guardados no PostgreSQL.</p></Link> : null}
        {users ? <Link href="/sistema/usuarios" className="card card-link"><span className="status ready">Ativo</span><h2>Acesso</h2><p>Contas individuais, perfis, departamentos e MFA.</p></Link> : null}
        {activeModules.map((mod) => (
          <Link href={mod.href} className="card card-link" key={mod.key}>
            <span className="status ready">Ativo</span>
            <h2>{mod.label}</h2>
            <p>Fluxo operacional no Postgres (onda 1).</p>
          </Link>
        ))}
        {wave2and3.map((label) => (
          <article className="card" key={label}>
            <span className="status building">Migração</span>
            <h2>{label}</h2>
            <p>Pendente no BACKLOG_OPERACIONAL (ondas 2–3).</p>
          </article>
        ))}
      </div>
    </>
  );
}
