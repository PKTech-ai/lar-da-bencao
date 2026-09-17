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
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes-patrimonio" },
      { slug: "relatorio", label: "Relatório Anual", panel: "patrimonio-relatorio" }
    ]
  },
  {
    slug: "eventos",
    title: "Eventos",
    intro: "Agenda dos eventos da Casa, itens previstos e disponíveis, escala de trabalho e avaliação.",
    flag: "module_eventos",
    access: { resource: "department", department: "eventos" },
    sections: [
      { slug: "", label: "Agenda", resource: "eventos-agenda" },
      { slug: "itens", label: "Itens", resource: "eventos-itens" },
      { slug: "escala", label: "Escala de Trabalho", resource: "eventos-escala" },
      { slug: "avaliacao", label: "Avaliação", resource: "eventos-avaliacao" }
    ]
  },
  {
    slug: "assistencia",
    title: "Assistência e Promoção Social",
    intro: "Famílias acompanhadas, rancho, kits de higiene, atividades, voluntários, mantenedores e os setores Brechó e Clube de Mães.",
    flag: "module_assistencia",
    access: { resource: "department", department: "assistencia_social" },
    sections: [
      { slug: "", label: "Famílias", resource: "assistencia-familias" },
      { slug: "rancho", label: "Rancho", resource: "assistencia-rancho" },
      { slug: "kits", label: "Kits de Higiene", resource: "assistencia-kits" },
      { slug: "atividades", label: "Controle de Atividades", resource: "assistencia-atividades" },
      { slug: "voluntarios", label: "Voluntários", resource: "assistencia-voluntarios" },
      { slug: "mantenedores", label: "Mantenedores da Cesta", resource: "assistencia-mantenedores" },
      { slug: "cafe", label: "Café das Crianças", resource: "assistencia-cafe" },
      { slug: "brecho", label: "Brechó — Livro Caixa", resource: "brecho-caixa", access: { resource: "social_brecho" } },
      { slug: "clube-maes", label: "Clube de Mães — Livro Caixa", resource: "clube-maes-caixa", access: { resource: "social_clube_maes" } },
      { slug: "clube-maes-pessoas", label: "Clube de Mães — Pessoas", resource: "clube-maes-pessoas", access: { resource: "social_clube_maes" } },
      { slug: "clube-maes-entregas", label: "Clube de Mães — Entregas", resource: "clube-maes-entregas", access: { resource: "social_clube_maes" } }
    ]
  },
  {
    slug: "divulgacao",
    title: "Divulgação",
    intro: "Livraria: obras para empréstimo e revenda, estoque, empréstimos com devolução e vendas com comprovante.",
    flag: "module_divulgacao",
    access: { resource: "department", department: "divulgacao" },
    sections: [
      { slug: "", label: "Painel da Livraria", panel: "divulgacao-painel" },
      { slug: "obras", label: "Obras", resource: "divulgacao-obras" },
      { slug: "estoque", label: "Estoque", resource: "divulgacao-estoque" },
      { slug: "emprestimos", label: "Empréstimos", panel: "divulgacao-emprestimos" },
      { slug: "vendas", label: "Vendas", resource: "divulgacao-vendas" }
    ]
  },
  {
    slug: "secretaria",
    title: "Secretaria",
    intro: "Reuniões e atas com áudio guardado no banco, acompanhamento das admissões e aniversariantes.",
    flag: "module_secretaria",
    access: { resource: "secretaria" },
    sections: [
      { slug: "", label: "Reuniões e Atas", resource: "secretaria-reunioes" },
      { slug: "gravador", label: "Gravador", panel: "secretaria-gravador" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" }
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

/** Perfis de setor social só enxergam as abas do próprio setor (regra do mock). */
export const SECTOR_ROLE_RESOURCE: Record<string, string> = { brecho: "social_brecho", clube_maes: "social_clube_maes" };
