import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { EDUCATION_LABEL, GROUPS, type EducationDepartment } from "@/lib/education";
import { EVANGELIZANDO_COLUMNS, allowedGroups, withEffectiveStatus, type EvangelizandoRow } from "@/lib/education-data";
import { requireModulePage } from "@/lib/page-auth";
import { birthInfo, brDateOnly } from "@/lib/worker-list-print";
import { todayInSaoPaulo } from "@/lib/workers";

type Data = Record<string, string>;

const FLAG: Record<EducationDepartment, string> = { infancia: "module_infancia", juventude: "module_juventude" };

/**
 * Ficha de Entrevista — Tratamento Espiritual (modelo do sistema v215), em duas folhas A4.
 * Com `id`, sai preenchida com a matrícula; sem `id`, em branco. Mesmo alcance da lista de evangelizandos.
 */
export async function TreatmentPrintPage({ department, id }: { department: EducationDepartment; id?: string }) {
  const actor = await requireModulePage(FLAG[department], { department, module: "evangelizandos" });
  let data: Data = {};
  let group = "";
  let photo: string | null = null;
  if (id) {
    if (!z.string().uuid().safeParse(id).success) notFound();
    const result = await query<EvangelizandoRow>(
      `select ${EVANGELIZANDO_COLUMNS} from app.evangelizandos e where e.id = $1 and e.department_key = $2`,
      [id, department]
    );
    if (!result.rows[0]) notFound();
    const row = withEffectiveStatus(result.rows[0]);
    const groups = await allowedGroups(actor, department, "evangelizandos");
    if (groups && !groups.includes(row.current_group ?? "")) notFound();
    const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");
    const age = birthInfo(row.birth_date, todayInSaoPaulo()).age;
    group = row.current_group ?? "";
    photo = typeof row.photo_attachment_id === "string" ? row.photo_attachment_id : null;
    data = {
      name: row.full_name, birth: row.birth_date ? brDateOnly(row.birth_date) : "", age: age === "—" ? "" : `${age} ano(s)`,
      group, filled: brDateOnly(row.filled_date).replace("—", ""), guardian: text("guardian_name"), relation: text("guardian_relation"),
      phone: text("guardian_phone"), whatsapp: text("whatsapp"), address: text("address"), reference: text("point_reference"),
      father: text("father_name"), fatherContact: text("father_contact"), mother: text("mother_name"), motherContact: text("mother_contact"),
      religion: text("religion"), marital: text("marital_status")
    };
    await appendAudit(actor, {
      category: "Impressão", action: "Impressão da ficha de tratamento espiritual", module: EDUCATION_LABEL[department],
      section: "Evangelizandos", entityType: "evangelizando", entityId: row.id
    });
  }
  const label = EDUCATION_LABEL[department];
  const v = (key: string) => data[key] ?? "";

  return (
    <>
      <style>{SHEET_CSS}</style>
      <div className="row-actions no-print" style={{ marginBottom: 12 }}>
        <Link className="button" href={`/sistema/${department}/evangelizandos`}>Voltar</Link>
        <PrintButton label="⎙ Imprimir / Salvar em PDF" />
      </div>
      <div className="treat-sheet">
        <section className="treat-page">
          <div className="treat-title">
            <h1>CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</h1>
            <h2>FICHA DE ENTREVISTA - TRATAMENTO ESPIRITUAL — {label.toUpperCase()}</h2>
          </div>
          <div className="treat-cycle">
            {department === "juventude" ? "Grupo" : "Ciclo"}:{" "}
            {GROUPS[department].map((g) => (
              <span key={g.name} className="treat-check">{group === g.name ? "☒" : "☐"} {department === "infancia" ? g.name.replace(" Ciclo", "") : g.name}</span>
            ))}
          </div>

          <div className="treat-box">
            <div className="treat-box-title">Dados Pessoais</div>
            <div className="treat-profile">
              <div className="treat-photo">{photo ? <img src={`/api/attachments/${photo}/download?inline=1`} alt="Foto do evangelizando" /> : "FOTO"}</div>
              <table className="treat-table treat-summary">
                <tbody>
                  <tr><th>Nome completo</th><td>{v("name")}</td></tr>
                  <tr><th>Data de nascimento</th><td>{v("birth")}</td></tr>
                  <tr><th>Idade</th><td>{v("age")}</td></tr>
                  <tr><th>Ciclo / Turma</th><td>{v("group")}</td></tr>
                  <tr><th>Data da matrícula</th><td>{v("filled")}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="treat-subtitle">Dados do responsável e contato</div>
            <table className="treat-table treat-family">
              <colgroup><col className="l" /><col /><col className="l" /><col /></colgroup>
              <tbody>
                <tr><th>Responsável</th><td>{v("guardian")}</td><th>Parentesco</th><td>{v("relation")}</td></tr>
                <tr><th>Telefone</th><td>{v("phone")}</td><th>WhatsApp</th><td>{v("whatsapp")}</td></tr>
                <tr><th>Endereço</th><td colSpan={3}>{v("address")}</td></tr>
                <tr><th>Ponto de Ref.</th><td colSpan={3}>{v("reference")}</td></tr>
                <tr><th>Pai</th><td>{v("father")}</td><th>Contato</th><td>{v("fatherContact")}</td></tr>
                <tr><th>Mãe</th><td>{v("mother")}</td><th>Contato</th><td>{v("motherContact")}</td></tr>
                <tr><th>Religião</th><td>{v("religion")}</td><th>Estado civil</th><td>{v("marital")}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="treat-box">
            <div className="treat-box-title">Entrevista</div>
            <p><strong>Data da entrevista:</strong> ____/____/______ &nbsp; <strong>Entrevistador:</strong> <span className="treat-fill med" /> &nbsp; <strong>Idade:</strong> <span className="treat-fill short" /></p>
            <p><strong>Como está fisicamente?</strong> ( ) Normal &nbsp; ( ) Dores &nbsp; ( ) Outros: <span className="treat-fill med" /></p>
            <Obs />
            <p><strong>Como está emocionalmente?</strong> ( ) Normal &nbsp; ( ) Insônia &nbsp; ( ) Depressão &nbsp; ( ) Irritação</p>
            <p>( ) Outros <span className="treat-fill med" /> &nbsp; <strong>Obs.:</strong> <span className="treat-fill med" /></p>
            <p><strong>Possui hábitos anormais?</strong> ( ) Agitado &nbsp; ( ) Dificuldade de concentração</p>
            <p>( ) Outros <span className="treat-fill med" /> &nbsp; <strong>Obs.:</strong> <span className="treat-fill med" /></p>
          </div>

          <div className="treat-box">
            <div className="treat-box-title">Manifestações — Fatos a serem observados</div>
            {Array.from({ length: 25 }, (_, i) => <div key={i} className="treat-dateline"><span>DATA: ____/____/______ :</span><i /></div>)}
          </div>
        </section>

        <section className="treat-page">
          <div className="treat-box">
            <div className="treat-box-title">Entrevista com os Pais ou Responsáveis</div>
            <div className="treat-line"><strong>Responsável:</strong><span>{v("guardian")}</span></div>
            <div className="treat-line"><strong>Motivo do atendimento:</strong><span /></div>
            <p><strong>Como está o relacionamento familiar?</strong> ( ) Bem &nbsp; ( ) Mal &nbsp; ( ) Brigas &nbsp; ( ) Não tem</p>
            <Obs />
            <p><strong>Sente ou já sentiu influências de Espíritos?</strong> ( ) Sim &nbsp; ( ) Não &nbsp; ( ) Ouve &nbsp; ( ) Vê &nbsp; ( ) Arrepios &nbsp; ( ) Sonha</p>
            <Obs />
            <p><strong>Existem fatores marcantes em sua vida?</strong> ( ) Acidente &nbsp; ( ) Separação &nbsp; ( ) Morte de familiares</p>
            <Obs />
            <Obs label="Outras observações:" />
          </div>

          <div className="treat-box">
            <div className="treat-box-title">Diálogo Fraterno</div>
            <div className="treat-dialog-head"><strong>Dialogador(a):</strong><span /><strong>Data:</strong><span /></div>
            {Array.from({ length: 38 }, (_, i) => <div key={i} className="treat-ruled" />)}
          </div>

          <div className="treat-signature">Assinatura do Responsável</div>
        </section>
      </div>
    </>
  );
}

function Obs({ label = "Obs.:" }: { label?: string }) {
  return <div className="treat-obs"><strong>{label}</strong><i /></div>;
}

/* Papel branco com tinta preta também no modo escuro; A4 com margem de 7 mm, como no modelo v215. */
const SHEET_CSS = `
@page { size: A4 portrait; margin: 7mm; }
.treat-sheet { display: grid; gap: 16px; justify-items: center; }
.treat-page { width: 100%; max-width: 196mm; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif;
  padding: 6mm; border-radius: 6px; box-shadow: 0 2px 12px rgba(16, 42, 56, .14); }
.treat-page * { box-sizing: border-box; }
.treat-title { text-align: center; }
.treat-title h1 { font-size: 13.2pt; margin: 0; font-weight: 800; color: #111; }
.treat-title h2 { font-size: 11.2pt; margin: 2px 0 0; font-weight: 800; color: #111; }
.treat-cycle { text-align: center; font-size: 10pt; font-weight: 700; margin: 2px 0 6px; }
.treat-check { margin: 0 4px; white-space: nowrap; }
.treat-box { border: 1.4px solid #111; border-radius: 10px; padding: 9px 9px 7px; margin-top: 14px; position: relative; break-inside: avoid; }
.treat-box-title { position: absolute; top: -10px; left: 8px; background: #222; color: #fff; border-radius: 7px; padding: 2px 8px; font-weight: 700; font-size: 9.5pt; }
.treat-box p { font-size: 8.5pt; line-height: 1.32; margin: 2px 0; }
.treat-profile { display: grid; grid-template-columns: 28mm 1fr; gap: 8px; align-items: start; }
.treat-photo { width: 28mm; height: 35mm; border: 1.2px solid #111; border-radius: 5px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; background: #f8f8f8; font-size: 7.5pt; font-weight: 700; color: #555; }
.treat-photo img { width: 100%; height: 100%; object-fit: cover; }
.treat-table { width: 100%; min-width: 0; border-collapse: collapse; table-layout: fixed; margin: 0; }
.treat-table th, .treat-table td { border: 1px solid #777; padding: 2.5px 4px; font-size: 7.8pt; vertical-align: top; color: #111;
  background: #fff; text-transform: none; letter-spacing: 0; overflow-wrap: anywhere; height: auto; position: static; }
.treat-table th { background: #f0f3f1; text-align: left; font-weight: 700; }
.treat-summary th { width: 30%; }
.treat-family col.l { width: 15%; }
.treat-subtitle { margin-top: 6px; background: #efefef; border-left: 4px solid #333; padding: 3px 6px; font-size: 8pt; font-weight: 700; }
.treat-fill { display: inline-block; border-bottom: 1px solid #111; height: 13px; vertical-align: bottom; min-width: 112px; }
.treat-fill.med { min-width: 190px; }
.treat-fill.short { min-width: 80px; }
.treat-obs, .treat-dateline, .treat-line { display: flex; gap: 5px; align-items: flex-end; font-size: 8.5pt; }
.treat-obs { margin: 1px 0 4px; }
.treat-obs strong, .treat-dateline span, .treat-line strong { white-space: nowrap; }
.treat-obs i, .treat-dateline i { display: block; flex: 1; border-bottom: 1px solid #111; height: 14px; }
.treat-dateline { height: 17px; font-size: 8.2pt; }
.treat-line { min-height: 19px; }
.treat-line span { flex: 1; border-bottom: 1px solid #111; min-height: 14px; padding: 0 3px 1px; }
.treat-dialog-head { display: grid; grid-template-columns: auto 1fr auto 95px; gap: 6px; align-items: end; margin: 4px 0 5px; font-size: 8.7pt; }
.treat-dialog-head span { border-bottom: 1px solid #111; min-height: 15px; }
.treat-ruled { height: 18px; border-bottom: 1px solid #111; }
.treat-signature { width: 68%; margin: 34px auto 0; text-align: center; font-weight: 700; font-size: 9pt; border-top: 1px solid #111; padding-top: 5px; }
@media (max-width: 720px) { .treat-page { padding: 4mm; } .treat-fill.med { min-width: 120px; } }
@media print {
  .treat-sheet { display: block; }
  .treat-page { max-width: none; padding: 0; border-radius: 0; box-shadow: none; break-after: page; }
  .treat-page:last-child { break-after: auto; }
  .treat-page, .treat-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
