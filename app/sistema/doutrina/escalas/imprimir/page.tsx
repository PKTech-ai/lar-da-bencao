import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { loadScale } from "@/lib/doutrina-data";
import { DAY_HOURS, DAY_NAME, DOW_ORDER, FREE_THEME, TEMPLATES, isValidMonth, monthDays, scaleStatusLabel } from "@/lib/doutrina-scale";
import { requireModulePage } from "@/lib/page-auth";

const QUOTE = "Trabalhemos juntos e unamos os nossos esforços, a fim de que o Senhor, ao chegar, encontre acabada a obra.";
const QUOTE_SOURCE = "O Evangelho Segundo o Espiritismo — Cap. XX, item 5 — O Espírito de Verdade (Paris, 1862)";

export default async function PrintScalePage({ searchParams }: { searchParams: Promise<{ month?: string; dow?: string }> }) {
  const actor = await requireModulePage("module_doutrina", { department: "doutrina" });
  const params = await searchParams;
  const ym = params.month ?? "";
  if (!isValidMonth(ym)) notFound();
  const dows = params.dow !== undefined ? [Number(params.dow)].filter((d) => TEMPLATES[d]) : [...DOW_ORDER];
  if (!dows.length) notFound();
  const scale = await loadScale(ym);
  if (!scale.month || scale.month.status === "deleted") notFound();

  const [names, contact] = await Promise.all([
    query<{ ref: string; label: string }>(
      `select 'w:' || id as ref, full_name as label from app.workers
        where id in (select worker_id from app.scale_assignments where scale_month_id = $1 and worker_id is not null)
       union all
       select 's:' || id, full_name || ' (EXT.)' from app.speakers
        where id in (select speaker_id from app.scale_assignments where scale_month_id = $1 and speaker_id is not null)
       union all
       select 't:' || id, coalesce(code || ' — ', '') || title from app.studies
        where id in (select study_id from app.scale_assignments where scale_month_id = $1 and study_id is not null)`,
      [scale.month.id]
    ),
    query<{ coordinator: string | null; phone: string | null }>(
      `select (select string_agg(u.full_name, ' / ' order by u.full_name) from app.users u
                 join app.user_departments ud on ud.user_id = u.id and ud.department_key = 'doutrina'
                where u.status = 'active' and u.role_key = 'coordenador') as coordinator,
              (select phone from app.department_contacts where department_key = 'doutrina') as phone`
    )
  ]);
  const label = new Map(names.rows.map((row) => [row.ref, row.label]));
  label.set(FREE_THEME, "TEMA LIVRE");
  await appendAudit(actor, {
    category: "Impressão", action: dows.length > 1 ? "Impressão da escala mensal consolidada" : "Impressão de folha da escala",
    module: "Doutrina", section: "Escala mensal", entityType: "scale_month", entityId: scale.month.id, details: `${ym}${dows.length === 1 ? ` · ${DAY_NAME[dows[0]]}` : ""}`
  });
  const monthLabel = new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();

  return (
    <>
      <header className="page-heading no-print">
        <div><h1>Impressão da escala</h1><p>{scaleStatusLabel[scale.month.status]}</p></div>
        <div className="row-actions"><Link className="button" href="/sistema/doutrina/escalas">Voltar</Link><PrintButton /></div>
      </header>
      {dows.map((dow) => {
        const days = monthDays(ym, dow);
        if (!days.length) return null;
        return (
          <section key={dow} className="card scale-sheet" style={{ breakAfter: "page", marginBottom: 16 }}>
            <div className="sheet-title">CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</div>
            <div className="sheet-sub">ESCALA DE TRABALHADORES — {DAY_NAME[dow]} — {monthLabel}<br />HORÁRIO: {DAY_HOURS[dow]}</div>
            {TEMPLATES[dow].map((section, si) => (
              <div key={section.n + si}>
                <h3>{section.n}</h3>
                <table>
                  <thead><tr><th>DIAS</th>{days.map((day) => <th key={day}>{String(day).padStart(2, "0")}</th>)}</tr></thead>
                  <tbody>
                    {section.r.map(([rowLabel], ri) => (
                      <tr key={rowLabel + ri}>
                        <td>{rowLabel}</td>
                        {days.map((day) => {
                          const prefix = `${dow}|${si}|${ri}|${day}|`;
                          const values = [...scale.assignments].filter(([k]) => k.startsWith(prefix))
                            .sort(([a], [b]) => Number(a.split("|")[4]) - Number(b.split("|")[4]))
                            .map(([, v]) => (v ? label.get(v) ?? "—" : "—"));
                          return <td key={day}>{values.map((v, i) => <div key={i}>{v}</div>)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="small">Responsável: {contact.rows[0]?.coordinator ?? "Não informado"} · Contato: {contact.rows[0]?.phone || "Não informado"}</p>
            <p className="small muted"><em>“{QUOTE}”</em><br />{QUOTE_SOURCE}</p>
          </section>
        );
      })}
    </>
  );
}
