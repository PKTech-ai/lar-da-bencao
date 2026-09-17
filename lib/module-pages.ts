/**
 * Páginas dos módulos das ondas 2 e 3: cada aba é um cadastro do motor genérico (`resource`)
 * ou um painel próprio (`panel`, ver components/modules/panels.tsx). Módulo puro.
 */

export type SectionAccess = { resource: string; department?: string };

export type ModuleSection = {
  slug: string;
  label: string;
  resource?: string;
  panel?: string;
  /** Acesso próprio da aba (padrão: o do módulo). */
  access?: SectionAccess;
};

export type ModulePage = {
  slug: string;
  title: string;
  intro: string;
  flag: string;
  access: SectionAccess;
  sections: readonly ModuleSection[];
};

export const MODULE_PAGES: readonly ModulePage[] = [
  {
    slug: "patrimonio",
    title: "Patrimônio",
    intro: "Bens da Casa com fotos e notas fiscais, autorização de baixa pela Diretoria e escala de limpeza de domingo.",
    flag: "module_patrimonio",
    access: { resource: "department", department: "patrimonio" },
    sections: [
      { slug: "", label: "Bens", resource: "patrimonio-bens" },
      { slug: "baixas", label: "Autorização de Baixa", panel: "patrimonio-baixas" },
      { slug: "limpeza", label: "Escala de Limpeza", panel: "patrimonio-limpeza" },
      { slug: "relatorio", label: "Relatório Anual", panel: "patrimonio-relatorio" }
    ]
  },
  {
    slug: "presidencia",
    title: "Presidência",
    intro: "Painel da Diretoria: decisões pendentes e situação dos módulos.",
    flag: "module_presidencia",
    access: { resource: "presidencia" },
    sections: [
      { slug: "", label: "Painel", panel: "presidencia-painel" },
      { slug: "baixas", label: "Autorizações de Baixa", panel: "presidencia-baixas" }
    ]
  }
];

export function findModulePage(slug: string) {
  return MODULE_PAGES.find((m) => m.slug === slug);
}
