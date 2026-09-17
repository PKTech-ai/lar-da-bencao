import Link from "next/link";
import { query } from "@/lib/db";
import { canEditDoutrina, loadScale, loadScaleOptions, reviewScale } from "@/lib/doutrina-data";
import { scaleStatusLabel } from "@/lib/doutrina-scale";
import { doutrinaSubnav } from "@/lib/modules";
import { requireModulePage } from "@/lib/page-auth";
import { DoctrineContactForm } from "./contact-form";

export default async function DoutrinaPage() {
  const actor = await requireModulePage("module_doutrina", { department: "doutrina" });
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
  const [counts, contact, scale, options, canEdit] = await Promise.all([
    query<{ workers: number; pending: number; speakers: number; studies: number; attendance: number }>(
      `select (select count(*)::int from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina' where w.status = 'active') as workers,
              (select count(*)::int from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = 'doutrina' where w.status = 'pending') as pending,
              (select count(*)::int from app.speakers where active) as speakers,
              (select count(*)::int from app.studies where department_key = 'doutrina' and active) as studies,
              (select coalesce(sum(value), 0)::int from app.attendance_counts where department_key = 'doutrina'
                 and sheet_date >= date_trunc('month', current_date) and sheet_date < date_trunc('month', current_date) + interval '1 month') as attendance`
    ),
    query<{ coordinator: string | null; phone: string | null }>(
      `select (select string_agg(u.full_name, ' / ' order by u.full_name) from app.users u
                 join app.user_departments ud on ud.user_id = u.id and ud.department_key = 'doutrina'
                where u.status = 'active' and u.role_key = 'coordenador') as coordinator,
              (select phone from app.department_contacts where department_key = 'doutrina') as phone`
    ),
    loadScale(ym),
    loadScaleOptions(),
    canEditDoutrina(actor)
  ]);
  const c = counts.rows[0];
  const active = scale.month && scale.month.status !== "deleted" ? scale.month : null;
  const empty = active ? [...scale.assignments.values()].filter((v) => !v).length : 0;
  const review = active ? reviewScale(scale.assignments, options) : null;
  const alerts: string[] = [];
  if (!active) alerts.push("A escala deste mês ainda não foi gerada.");
  if (active && empty) alerts.push(`${empty} vaga(s) sem trabalhador na escala deste mês.`);
  if (review && (review.conflicts.length || review.invalid.length)) alerts.push(`${review.conflicts.length + review.invalid.length} conflito(s) ou posição(ões) inválida(s) na escala deste mês.`);
  if (active && active.status !== "published") alerts.push(`Escala do mês: ${scaleStatusLabel[active.status]} (ainda não publicada).`);
  if (c.pending) alerts.push(`${c.pending} ficha(s) da Doutrina aguardando a Diretoria.`);

  return (
    <>
      <header className="page-heading">
        <div><h1>Doutrina</h1><p>Painel, trabalhadores, palestrantes, biblioteca de estudos, escala, frequência e Culto no Lar.</p></div>
      </header>
      <div className="grid cards" style={{ marginBottom: 16 }}>
        <article className="card kpi"><span className="small muted">Trabalhadores ativos</span><b>{c.workers}</b></article>
        <article className="card kpi"><span className="small muted">Palestrantes externos</span><b>{c.speakers}</b></article>
        <article className="card kpi"><span className="small muted">Estudos na biblioteca</span><b>{c.studies}</b></article>
        <article className="card kpi"><span className="small muted">Escala do mês</span><b style={{ fontSize: 18 }}>{active ? scaleStatusLabel[active.status] : "Não gerada"}</b></article>
        <article className="card kpi"><span className="small muted">Participações no mês</span><b>{c.attendance}</b></article>
        <article className="card kpi"><span className="small muted">Fichas aguardando Diretoria</span><b>{c.pending}</b></article>
      </div>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Alertas</h2>
        {alerts.length ? <ul>{alerts.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="muted">Nenhum alerta.</p>}
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Responsável pelo Departamento de Doutrina</h2>
        <p className="small muted">Estas informações aparecem nas escalas impressas para contato em caso de dúvidas.</p>
        <DoctrineContactForm coordinator={contact.rows[0]?.coordinator ?? "Sem coordenador vinculado"} phone={contact.rows[0]?.phone ?? ""} canEdit={canEdit} />
      </section>
      <div className="grid cards">
        {doutrinaSubnav.map((item) => (
          <Link key={item.href} href={item.href} className="card card-link"><h2>{item.label}</h2></Link>
        ))}
      </div>
    </>
  );
}
