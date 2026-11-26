import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { departmentCoordinators } from "@/lib/department-coordinators";
import { loadCultoMonth } from "@/lib/culto-data";
import { loadRecess, loadScale } from "@/lib/doutrina-data";
import { CULTO_HOURS } from "@/lib/doutrina-extras";
import { brDate } from "@/lib/monthly-saturdays";
import { DAY_HOURS, DAY_NAME, DOW_ORDER, RECESS_KINDS, TEMPLATES, isValidMonth, monthDays, recessKinds, rowOrder, scaleStatusLabel, themeLabel } from "@/lib/doutrina-scale";
import { requireModulePage } from "@/lib/page-auth";

const QUOTE = "Trabalhemos juntos e unamos os nossos esforços, a fim de que o Senhor, ao chegar, encontre acabada a obra.";
const QUOTE_SOURCE = "O Evangelho Segundo o Espiritismo — Cap. XX, item 5 — O Espírito de Verdade (Paris, 1862)";

export default async function PrintScalePage({ searchParams }: { searchParams: Promise<{ month?: string; dow?: string }> }) {
  const actor = await requireModulePage("module_doutrina", { department: "doutrina", module: "escalas" });
  const params = await searchParams;
  const ym = params.month ?? "";
  if (!isValidMonth(ym)) notFound();
  const dows = params.dow !== undefined ? [Number(params.dow)].filter((d) => TEMPLATES[d]) : [...DOW_ORDER];
  if (!dows.length) notFound();
  const scale = await loadScale(ym);
  if (!scale.month || scale.month.status === "deleted") notFound();

  const [names, coordinators, contact, recessDates, culto] = await Promise.all([
    query<{ ref: string; label: string; reference: string | null }>(
      `select 'w:' || id as ref, full_name as label, null::text as reference from app.workers
        where id in (select worker_id from app.scale_assignments where scale_month_id = $1 and worker_id is not null)
       union all
       select 's:' || id, full_name || ' (EXT.)', null from app.speakers
        where id in (select speaker_id from app.scale_assignments where scale_month_id = $1 and speaker_id is not null)
       union all
       select 't:' || id, coalesce(code || ' — ', '') || title, nullif(btrim(reference), '') from app.studies
        where id in (select study_id from app.scale_assignments where scale_month_id = $1 and study_id is not null)`,
      [scale.month.id]
    ),
    departmentCoordinators("doutrina"),
    query<{ phone: string | null }>("select phone from app.department_contacts where department_key = 'doutrina'"),
    loadRecess(ym),
    loadCultoMonth(ym)
  ]);
  const recess = recessKinds(ym, recessDates);
  const label = new Map(names.rows.map((row) => [row.ref, row.label]));
  // Referência do estudo como na Biblioteca de Estudos (ex.: ESE Cap. X — itens 1 a 4), abaixo do roteiro.
  const reference = new Map(names.rows.flatMap((row) => (row.reference ? [[row.ref, row.reference] as const] : [])));
  await appendAudit(actor, {
    category: "Impressão", action: dows.length > 1 ? "Impressão da escala mensal consolidada" : "Impressão de folha da escala",
    module: "Doutrina", section: "Escala mensal", entityType: "scale_month", entityId: scale.month.id, details: `${ym}${dows.length === 1 ? ` · ${DAY_NAME[dows[0]]}` : ""}`
  });
  const monthLabel = new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();

  return (
    <>
      <header className="module-section-head no-print">
        <div><h2>Impressão da escala</h2><p>{scaleStatusLabel[scale.month.status]}</p></div>
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
                    {rowOrder(section).map((ri, shown) => { const [rowLabel] = section.r[ri]; return (
                      <tr key={rowLabel + ri}>
                        <td>{rowLabel}</td>
                        {days.map((day) => {
                          const closed = recess.get(day);
                          if (closed) return shown ? null : <td key={day} rowSpan={section.r.length} className="recess-cell">{RECESS_KINDS[closed].sheet}</td>;
                          const prefix = `${dow}|${si}|${ri}|${day}|`;
                          const values = [...scale.assignments].filter(([k]) => k.startsWith(prefix))
                            .sort(([a], [b]) => Number(a.split("|")[4]) - Number(b.split("|")[4]))
                            .map(([, v]) => ({ text: v ? label.get(v) ?? themeLabel(v) ?? "—" : "—", reference: reference.get(v) }));
                          return (
                            <td key={day}>
                              {values.map((v, i) => <div key={i}>{v.text}{v.reference ? <div className="sheet-reference">{v.reference}</div> : null}</div>)}
                            </td>
                          );
                        })}
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ))}
            {dow === 6 ? (
              <div>
                <h3>CULTO NO LAR DOS TRABALHADORES — PENÚLTIMO SÁBADO · HORÁRIO: {CULTO_HOURS.toUpperCase()}</h3>
                <table>
                  <thead><tr><th>DATA</th><th>TRABALHADOR (LAR)</th><th>DIRIGENTE</th><th>EXPOSITOR</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>{brDate(culto.culto).slice(0, 5)}</td>
                      <td>{culto.host_name || "—"}</td>
                      <td>{culto.leader_name || "—"}</td>
                      <td>{culto.speaker_name || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="small">Responsável: {coordinators.join(" / ") || "Não informado"} · Contato: {contact.rows[0]?.phone || "Não informado"}</p>
            <p className="small muted"><em>“{QUOTE}”</em><br />{QUOTE_SOURCE}</p>
          </section>
        );
      })}
    </>
  );
}
