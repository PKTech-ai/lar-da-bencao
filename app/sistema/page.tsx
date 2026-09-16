import Link from "next/link";
import { query } from "@/lib/db";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

type Flag = { key: string; enabled: boolean };

const moduleCatalog = [
  ["Estatuto e Regimento", "institucional"], ["Organograma", "institucional"],
  ["Presidência", "presidencia"], ["Secretaria", "secretaria"],
  ["Tesouraria", "tesouraria"], ["Conselho Fiscal", "conselho_fiscal"],
  ["Doutrina", "department"], ["Infância", "department"], ["Juventude", "department"],
  ["Assistência Social", "department"], ["Patrimônio", "department"],
  ["Eventos", "department"], ["Divulgação e Livraria", "department"], ["Jurídico", "department"]
] as const;

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const flags = await query<Flag>("select key, enabled from app.feature_flags order by key");
  const enabled = new Map(flags.rows.map((flag) => [flag.key, flag.enabled]));
  const audit = await hasPermission(actor, "audit", "read");
  const attachments = await hasPermission(actor, "attachments", "read");
  const users = await hasPermission(actor, "users", "admin");

  return (
    <>
      <header className="page-heading">
        <div><h1>Ao Lar da Bênção</h1><p>Uma Casa de estudo, acolhimento e caridade.</p></div>
        <span className="production-badge">Produção · Vercel</span>
      </header>
      <section className="card notice" style={{ marginBottom: 16 }}>
        <strong>Fundação operacional v216 ativa.</strong> Identidade, MFA, banco central, autorização, auditoria e anexos usam a nova arquitetura. Os módulos da v215 serão ativados por onda após migração e UAT.
      </section>
      <div className="grid cards">
        {audit ? <Link href="/sistema/auditoria" className="card card-link"><span className="status ready">Ativo</span><h2>Dedo-duro</h2><p>Auditoria append-only, filtros e exportação controlada.</p></Link> : null}
        {attachments ? <Link href="/sistema/anexos" className="card card-link"><span className="status ready">Ativo</span><h2>Anexos privados</h2><p>Arquivos fracionados e guardados no PostgreSQL.</p></Link> : null}
        {users ? <Link href="/sistema/usuarios" className="card card-link"><span className="status ready">Ativo</span><h2>Acesso</h2><p>Contas individuais, perfis, departamentos e MFA.</p></Link> : null}
        {moduleCatalog.map(([label]) => <article className="card" key={label}><span className={enabled.get("business_modules") ? "status ready" : "status building"}>{enabled.get("business_modules") ? "Ativo" : "Migração"}</span><h2>{label}</h2><p>Fluxo preservado da v215; ativação controlada por onda.</p></article>)}
      </div>
    </>
  );
}
