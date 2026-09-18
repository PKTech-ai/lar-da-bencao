"use client";

import Link from "next/link";

import { BirthdaysPanel } from "@/components/modules/aniversariantes";
import { FiscalReviewsPanel } from "@/components/modules/conselho-fiscal";
import { BookLoansPanel, BookshopSummary } from "@/components/modules/divulgacao-livraria";
import { MeetingRecorder } from "@/components/modules/secretaria-gravador";
import { AnnualReport } from "@/components/modules/relatorio-anual";
import { DepartmentWorkers } from "@/components/modules/trabalhadores-departamento";
import { PresidenciaPainel } from "@/components/modules/presidencia-painel";
import { ContributionsPanel } from "@/components/modules/tesouraria-contribuicoes";
import { TreasuryAccountsPanel, TreasuryMonthPanel, TreasuryReportPanel, TreasuryStatementPanel } from "@/components/modules/tesouraria";
import { WhatsappQueue } from "@/components/modules/whatsapp";
import { DisposalsPanel } from "@/components/modules/patrimonio-baixas";
import { CleaningPanel } from "@/components/modules/patrimonio-limpeza";
import { PatrimonyReport } from "@/components/modules/patrimonio-relatorio";

/** Aba que leva para uma tela já existente, sem duplicar cadastro. */
function Shortcut({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <section className="card">
      <h2>{label}</h2>
      <p>{text}</p>
      <p><Link className="button primary" href={href}>Abrir {label}</Link></p>
    </section>
  );
}

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
    case "tesouraria-contribuicoes": return <ContributionsPanel />;
    case "tesouraria-extrato": return <TreasuryStatementPanel />;
    case "tesouraria-contas": return <TreasuryAccountsPanel />;
    case "tesouraria-relatorio": return <TreasuryReportPanel />;
    case "whatsapp-tesouraria": return <WhatsappQueue scope="tesouraria" />;
    case "trabalhadores-patrimonio": return <DepartmentWorkers department="patrimonio" />;
    case "trabalhadores-assistencia": return <DepartmentWorkers department="assistencia_social" />;
    case "trabalhadores-eventos": return <DepartmentWorkers department="eventos" />;
    case "trabalhadores-divulgacao": return <DepartmentWorkers department="divulgacao" />;
    case "trabalhadores-juridico": return <DepartmentWorkers department="juridico" />;
    case "relatorio-assistencia": return <AnnualReport department="assistencia_social" />;
    case "relatorio-eventos": return <AnnualReport department="eventos" />;
    case "relatorio-divulgacao": return <AnnualReport department="divulgacao" />;
    case "relatorio-secretaria": return <AnnualReport department="secretaria" />;
    case "relatorio-juridico": return <AnnualReport department="juridico" />;
    case "admissoes-atalho": return <Shortcut href="/sistema/admissoes" label="Aprovação de Trabalhadores"
      text="As fichas aguardando decisão ficam no cadastro único de Trabalhadores, com o histórico de cada admissão." />;
    case "sugestoes-atalho": return <Shortcut href="/sistema/sugestoes" label="Sugestões e elogios"
      text="Mensagens enviadas pelas pessoas da Casa, com a resposta da Diretoria." />;
    case "conselho-analises": return <FiscalReviewsPanel />;
    case "presidencia-painel": return <PresidenciaPainel />;
    default: return <p className="notice">Painel em preparação.</p>;
  }
}
