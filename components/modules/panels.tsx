"use client";

import { BirthdaysPanel } from "@/components/modules/aniversariantes";
import { BookLoansPanel, BookshopSummary } from "@/components/modules/divulgacao-livraria";
import { MeetingRecorder } from "@/components/modules/secretaria-gravador";
import { DepartmentWorkers } from "@/components/modules/trabalhadores-departamento";
import { PresidenciaPainel } from "@/components/modules/presidencia-painel";
import { TreasuryAccountsPanel, TreasuryMonthPanel, TreasuryReportPanel, TreasuryStatementPanel } from "@/components/modules/tesouraria";
import { WhatsappQueue } from "@/components/modules/whatsapp";
import { DisposalsPanel } from "@/components/modules/patrimonio-baixas";
import { CleaningPanel } from "@/components/modules/patrimonio-limpeza";
import { PatrimonyReport } from "@/components/modules/patrimonio-relatorio";

/** Painéis próprios referenciados por nome em lib/module-pages.ts. */
export function ModulePanel({ name }: { name: string }) {
  switch (name) {
    case "patrimonio-baixas": return <DisposalsPanel area="patrimonio" />;
    case "presidencia-baixas": return <DisposalsPanel area="diretoria" />;
    case "patrimonio-limpeza": return <CleaningPanel />;
    case "patrimonio-relatorio": return <PatrimonyReport />;
    case "divulgacao-painel": return <BookshopSummary />;
    case "divulgacao-emprestimos": return <BookLoansPanel />;
    case "secretaria-gravador": return <MeetingRecorder />;
    case "aniversariantes": return <BirthdaysPanel />;
    case "aniversariantes-patrimonio": return <BirthdaysPanel department="patrimonio" />;
    case "aniversariantes-eventos": return <BirthdaysPanel department="eventos" />;
    case "aniversariantes-divulgacao": return <BirthdaysPanel department="divulgacao" />;
    case "tesouraria-mes": return <TreasuryMonthPanel />;
    case "tesouraria-extrato": return <TreasuryStatementPanel />;
    case "tesouraria-contas": return <TreasuryAccountsPanel />;
    case "tesouraria-relatorio": return <TreasuryReportPanel />;
    case "whatsapp-tesouraria": return <WhatsappQueue scope="tesouraria" />;
    case "trabalhadores-patrimonio": return <DepartmentWorkers department="patrimonio" />;
    case "trabalhadores-assistencia": return <DepartmentWorkers department="assistencia_social" />;
    case "trabalhadores-eventos": return <DepartmentWorkers department="eventos" />;
    case "trabalhadores-divulgacao": return <DepartmentWorkers department="divulgacao" />;
    case "trabalhadores-juridico": return <DepartmentWorkers department="juridico" />;
    case "presidencia-painel": return <PresidenciaPainel />;
    default: return <p className="notice">Painel em preparação.</p>;
  }
}
