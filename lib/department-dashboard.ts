/** Painel genérico dos departamentos (KPIs e alertas). Módulo puro. */
import type { ModulePage } from "@/lib/module-pages";

const KEY_BY_SLUG: Record<string, string> = {
  tesouraria: "tesouraria", secretaria: "secretaria", conselhofiscal: "conselho_fiscal", presidencia: "diretoria"
};

export function workerDepartmentKey(page: ModulePage): string {
  return page.access.department ?? KEY_BY_SLUG[page.slug] ?? page.slug;
}

export function buildDepartmentDashboard(input: { active: number; pending: number; birthdays: number; alerts: string[] }) {
  return {
    kpis: [
      { label: "Trabalhadores ativos", value: String(input.active) },
      { label: "Fichas aguardando a Diretoria", value: String(input.pending) },
      { label: "Aniversariantes do mês", value: String(input.birthdays) }
    ],
    alerts: input.alerts
  };
}
