"use client";

import { PresidenciaPainel } from "@/components/modules/presidencia-painel";
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
    case "presidencia-painel": return <PresidenciaPainel />;
    default: return <p className="notice">Painel em preparação.</p>;
  }
}
