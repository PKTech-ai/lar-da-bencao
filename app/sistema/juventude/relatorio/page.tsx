import { AnnualReport } from "@/components/education/annual-report";
import { EducationNav } from "@/components/education/education-nav";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { allowedGroups } from "@/lib/education-data";
import { requireModulePage } from "@/lib/page-auth";
import { todayInSaoPaulo } from "@/lib/workers";

export default async function JuventudeRelatorioPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const actor = await requireModulePage("module_juventude", { department: "juventude" });
  const requested = Number((await searchParams).ano);
  const year = requested >= 2020 && requested <= 2100 ? requested : Number(todayInSaoPaulo().slice(0, 4));
  await appendAudit(actor, { category: "Acesso", action: "Consulta do relatório anual", module: "Juventude", section: "Relatório Anual", entityType: "report", entityId: String(year) });
  return (
    <>
      <header className="page-heading no-print">
        <div><h1>Relatório Anual — Juventude</h1><p>Emitido por {actor.name} a partir dos registros do sistema.</p></div>
        <form className="row-actions">
          <label>Ano<input name="ano" type="number" min={2020} max={2100} defaultValue={year} style={{ width: 110 }} /></label>
          <button className="button">Atualizar</button>
          <PrintButton />
        </form>
      </header>
      <EducationNav department="juventude" current="relatorio" />
      <AnnualReport department="juventude" year={year} groups={await allowedGroups(actor, "juventude")} />
    </>
  );
}
