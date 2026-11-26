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
import { SheetFit } from "./sheet-fit";

const QUOTE = "Trabalhemos juntos e unamos os nossos esforços, a fim de que o Senhor, ao chegar, encontre acabada a obra.";
const QUOTE_SOURCE = "O Evangelho Segundo o Espiritismo — Cap. XX, item 5 — O Espírito de Verdade (Paris, 1862)";

// Folha impressa: A4 deitada; cada dia começa numa folha nova; nenhuma tabela é cortada; se o dia não couber
// numa folha, segue na próxima com o mesmo cabeçalho. Estilo só desta página (a tela de edição usa .scale-sheet).
// Os tamanhos seguem --sp-scale, que o SheetFit reduz um pouco na hora de imprimir quando isso põe o dia numa folha só.
const s = (px: number) => `calc(${px}px * var(--sp-scale, 1))`;
const PRINT_CSS = `
@page { size: A4 landscape; margin: 8mm; }
.scale-print { display: grid; gap: 18px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.scale-print .sp-day { background: #fff; color: #14212b; padding: 18px 20px; border-radius: 16px; }
.scale-print .sp-frame { display: table; width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; }
.scale-print.sp-measuring .sp-frame { width: 281mm; min-width: 0; }
.scale-print .sp-head { display: table-header-group; break-inside: avoid; }
.scale-print .sp-body { display: table-row-group; }
.scale-print .sp-row { display: table-row; }
.scale-print .sp-cell { display: table-cell; padding: 0 0 ${s(9)}; }
.scale-print .sp-block { break-inside: avoid; page-break-inside: avoid; }
.scale-print .sp-head .sp-cell { text-align: center; padding-bottom: ${s(10)}; }
.scale-print .sp-title { font-weight: 800; font-size: ${s(16)}; line-height: 1.3; letter-spacing: .01em; color: #14212b; }
.scale-print .sp-sub { margin-top: ${s(2)}; font-size: ${s(11.5)}; line-height: 1.35; color: #56636d; }
.scale-print h3 { margin: 0 0 ${s(2)}; padding: ${s(4)} ${s(8)}; background: #e9edf2; border-radius: 6px; font-size: ${s(11.5)}; line-height: 1.3; letter-spacing: .02em; color: #14212b; break-after: avoid; }
.scale-print table { min-width: 0; width: 100%; table-layout: fixed; border-collapse: collapse; background: none; }
.scale-print col.sp-label { width: ${s(100)}; }
.scale-print th, .scale-print td { position: static; padding: ${s(3)} ${s(6)}; font-size: ${s(11.5)}; line-height: 1.25; color: #14212b; background: none; border-bottom: 1px solid #dde2e7; vertical-align: top; overflow-wrap: anywhere; }
.scale-print th { font-size: ${s(10.5)}; font-weight: 600; color: #56636d; }
.scale-print tbody tr:nth-child(even) td, .scale-print tbody tr:hover td { background: none; }
.scale-print td:first-child { font-weight: 700; }
.scale-print tr { break-inside: avoid; page-break-inside: avoid; }
.scale-print td.sp-recess { text-align: center; vertical-align: middle; font-weight: 700; letter-spacing: .06em; background: #eef0f3; }
.scale-print .sp-ref { margin-top: 1px; font-size: ${s(10)}; line-height: 1.25; color: #56636d; }
.scale-print .sp-foot { margin-top: ${s(8)}; font-size: ${s(11)}; line-height: 1.35; color: #14212b; }
.scale-print .sp-foot p { margin: 0; }
.scale-print .sp-foot .sp-quote { margin-top: ${s(6)}; color: #56636d; }
@media screen and (max-width: 720px) {
  .scale-print .sp-day { overflow-x: auto; padding: 14px; }
  .scale-print .sp-frame { min-width: 720px; }
}
@media print {
  .scale-print { display: block; }
  .scale-print .sp-day { padding: 0; border-radius: 0; }
  .scale-print .sp-day + .sp-day { break-before: page; page-break-before: always; }
}
`;

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
  const footer = (
    <div className="sp-foot">
      <p>Responsável: {coordinators.join(" / ") || "Não informado"} · Contato: {contact.rows[0]?.phone || "Não informado"}</p>
      <p className="sp-quote"><em>“{QUOTE}”</em><br />{QUOTE_SOURCE}</p>
    </div>
  );

  return (
    <>
      <header className="module-section-head no-print">
        <div><h2>Impressão da escala</h2><p>{scaleStatusLabel[scale.month.status]}</p></div>
        <div className="row-actions"><Link className="button" href="/sistema/doutrina/escalas">Voltar</Link><PrintButton /></div>
      </header>
      <div className="scale-print">
        <style>{PRINT_CSS}</style>
        <SheetFit />
        {dows.map((dow) => {
          const days = monthDays(ym, dow);
          if (!days.length) return null;
          // Cada seção (título + tabela) é um bloco que nunca se divide entre folhas; o rodapé vai junto do último bloco.
          const blocks = TEMPLATES[dow].map((section, si) => {
            const order = rowOrder(section);
            return (
              <div key={section.n + si}>
                <h3>{section.n}</h3>
                <table>
                  <colgroup><col className="sp-label" />{days.map((day) => <col key={day} />)}</colgroup>
                  <thead><tr><th>DIAS</th>{days.map((day) => <th key={day}>{String(day).padStart(2, "0")}</th>)}</tr></thead>
                  <tbody>
                    {order.map((ri, shown) => { const [rowLabel] = section.r[ri]; return (
                      <tr key={rowLabel + ri}>
                        <td>{rowLabel}</td>
                        {days.map((day) => {
                          const closed = recess.get(day);
                          if (closed) return shown ? null : <td key={day} rowSpan={order.length} className="sp-recess">{RECESS_KINDS[closed].sheet}</td>;
                          const prefix = `${dow}|${si}|${ri}|${day}|`;
                          const values = [...scale.assignments].filter(([k]) => k.startsWith(prefix))
                            .sort(([a], [b]) => Number(a.split("|")[4]) - Number(b.split("|")[4]))
                            .map(([, v]) => ({ text: v ? label.get(v) ?? themeLabel(v) ?? "—" : "—", reference: reference.get(v) }));
                          return (
                            <td key={day}>
                              {values.map((v, i) => <div key={i}>{v.text}{v.reference ? <div className="sp-ref">{v.reference}</div> : null}</div>)}
                            </td>
                          );
                        })}
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            );
          });
          if (dow === 6) blocks.push(
            <div key="culto">
              <h3>CULTO NO LAR DOS TRABALHADORES — PENÚLTIMO SÁBADO · HORÁRIO: {CULTO_HOURS.toUpperCase()}</h3>
              <table>
                <colgroup><col className="sp-label" /><col /><col /><col /></colgroup>
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
          );
          return (
            <section key={dow} className="sp-day">
              {/* O cabeçalho é um grupo de cabeçalho de tabela: o navegador o repete no alto de cada folha do mesmo dia. */}
              <div className="sp-frame">
                <div className="sp-head"><div className="sp-row"><div className="sp-cell">
                  <div className="sp-title">CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</div>
                  <div className="sp-sub">ESCALA DE TRABALHADORES — {DAY_NAME[dow]} — {monthLabel}<br />HORÁRIO: {DAY_HOURS[dow]}</div>
                </div></div></div>
                <div className="sp-body">
                  {blocks.map((block, i) => (
                    <div key={i} className="sp-row sp-block"><div className="sp-cell">{block}{i === blocks.length - 1 ? footer : null}</div></div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
