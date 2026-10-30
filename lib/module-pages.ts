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
  /** Flag própria da aba, além da do módulo. */
  flag?: string;
  /** Abas do mesmo grupo viram uma aba só, com sub-abas dentro (ex.: Assistência). */
  group?: string;
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
    intro: "Bens da Casa, baixas, limpeza de domingo e ordens de serviço.",
    flag: "module_patrimonio",
    access: { resource: "department", department: "patrimonio" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "bens", label: "Cadastro de Bens", resource: "patrimonio-bens" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-patrimonio" },
      { slug: "relatorio", label: "Relatório Anual", panel: "patrimonio-relatorio" },
      { slug: "os", label: "Ordens de Serviço", panel: "patrimonio-os" },
      { slug: "baixas", label: "Autorização de Baixa", panel: "patrimonio-baixas" },
      { slug: "limpeza", label: "Escala de Limpeza", panel: "patrimonio-limpeza" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes-patrimonio" }
    ]
  },
  {
    slug: "eventos",
    title: "Eventos",
    intro: "Agenda, itens, escala de trabalho e avaliação dos eventos.",
    flag: "module_eventos",
    access: { resource: "department", department: "eventos" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "ingressos", label: "Ingressos", panel: "ingressos-atalho" },
      // Itens, escala e avaliação ficam dentro do evento (aba "Evento").
      { slug: "evento", label: "Evento", panel: "eventos-evento" },
      { slug: "agenda", label: "Agenda de Eventos", resource: "eventos-agenda" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-eventos" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-eventos" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-eventos", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "assistencia",
    title: "Assistência e Promoção Social",
    intro: "Famílias, rancho, kits, voluntários, Brechó e Clube de Mães.",
    flag: "module_assistencia",
    access: { resource: "department", department: "assistencia_social" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "familias", label: "Famílias", resource: "assistencia-familias", group: "Famílias e entregas" },
      { slug: "rancho", label: "Rancho dos Evangelizandos", resource: "assistencia-rancho", group: "Famílias e entregas" },
      { slug: "kits", label: "Kits de Higiene", resource: "assistencia-kits", group: "Famílias e entregas" },
      { slug: "atividades", label: "Controle de Atividades", resource: "assistencia-atividades", group: "Famílias e entregas" },
      { slug: "voluntarios", label: "Cadastro de Voluntários", resource: "assistencia-voluntarios", group: "Voluntários e doadores" },
      { slug: "mantenedores", label: "Mantenedores da Cesta Básica", resource: "assistencia-mantenedores", group: "Voluntários e doadores" },
      { slug: "cafe", label: "Doadores do Café das Crianças", resource: "assistencia-cafe", group: "Voluntários e doadores" },
      { slug: "brecho", label: "Brechó — Livro Caixa", resource: "brecho-caixa", access: { resource: "social_brecho" }, group: "Setores" },
      { slug: "clube-maes", label: "Clube de Mães — Livro Caixa", resource: "clube-maes-caixa", access: { resource: "social_clube_maes" }, group: "Setores" },
      { slug: "clube-maes-pessoas", label: "Clube de Mães — Pessoas", resource: "clube-maes-pessoas", access: { resource: "social_clube_maes" }, group: "Setores" },
      { slug: "clube-maes-entregas", label: "Clube de Mães — Entregas", resource: "clube-maes-entregas", access: { resource: "social_clube_maes" }, group: "Setores" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-assistencia", group: "Relatórios" },
      { slug: "planejamento", label: "Planejamento Anual", resource: "assistencia-planejamento", group: "Relatórios" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-assistencia", group: "Equipe" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes", group: "Equipe" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-assistencia_social", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "divulgacao",
    title: "Divulgação",
    intro: "Livraria: obras, estoque, empréstimos e vendas.",
    flag: "module_divulgacao",
    access: { resource: "department", department: "divulgacao" },
    sections: [
      { slug: "", label: "Painel da Livraria", panel: "divulgacao-painel" },
      { slug: "obras", label: "Obras", resource: "divulgacao-obras" },
      { slug: "estoque", label: "Estoque", resource: "divulgacao-estoque" },
      { slug: "emprestimos", label: "Empréstimos", panel: "divulgacao-emprestimos" },
      { slug: "vendas", label: "Vendas", panel: "divulgacao-vendas" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-divulgacao" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-divulgacao" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-divulgacao", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "secretaria",
    title: "Secretaria",
    intro: "Reuniões e atas, trabalhadores, admissões e aniversariantes.",
    flag: "module_secretaria",
    access: { resource: "secretaria" },
    sections: [
      { slug: "reunioes", label: "Reuniões e Atas", resource: "secretaria-reunioes" },
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "admissoes", label: "Admissões", panel: "admissoes-atalho", flag: "module_workers" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-cadastro", flag: "module_workers" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" },
      { slug: "gravador", label: "Gravador", panel: "secretaria-gravador" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-secretaria", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "tesouraria",
    title: "Tesouraria",
    intro: "Caixa mensal, contribuições, mantenedores e extrato bancário.",
    flag: "module_tesouraria",
    access: { resource: "tesouraria" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "contribuicoes", label: "Contribuições", panel: "tesouraria-contribuicoes" },
      { slug: "mantenedores", label: "Mantenedores", resource: "tesouraria-mantenedores" },
      { slug: "plano-de-contas", label: "Plano de Contas", panel: "tesouraria-contas" },
      { slug: "caixa", label: "Caixa Mensal", panel: "tesouraria-mes" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" },
      { slug: "relatorio", label: "Relatório Anual", panel: "tesouraria-relatorio" },
      { slug: "whatsapp", label: "WhatsApp", panel: "whatsapp-tesouraria" },
      { slug: "extrato", label: "Extrato Bancário", panel: "tesouraria-extrato" },
      { slug: "lancamentos", label: "Lançamentos", resource: "tesouraria-lancamentos" },
      { slug: "doacoes", label: "Doações recebidas", resource: "tesouraria-doacoes" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-tesouraria", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "conselhofiscal",
    title: "Conselho Fiscal",
    intro: "Análise e parecer dos meses enviados pela Tesouraria.",
    flag: "module_conselho_fiscal",
    access: { resource: "conselho_fiscal" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "analises", label: "Análises e Pareceres", panel: "conselho-analises" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-conselho_fiscal", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "juridico",
    title: "Jurídico",
    intro: "Eleições da Casa: etapas, datas e documentos.",
    flag: "module_juridico",
    access: { resource: "department", department: "juridico" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "eleicoes", label: "Eleições", resource: "juridico-eleicoes" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-juridico" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-juridico" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-juridico", flag: "module_patrimonio" }
    ]
  },
  {
    slug: "presidencia",
    title: "Presidência",
    intro: "Painel da Diretoria: decisões pendentes e os números dos departamentos.",
    flag: "module_presidencia",
    access: { resource: "presidencia" },
    sections: [
      { slug: "", label: "Painel", panel: "painel" },
      { slug: "admissoes", label: "Aprovação de Trabalhadores", panel: "admissoes-atalho", flag: "module_workers" },
      { slug: "baixas", label: "Autorizações de Baixa", panel: "presidencia-baixas" },
      { slug: "sugestoes", label: "Sugestões", panel: "sugestoes-atalho" },
      { slug: "os", label: "Ordens de Serviço", panel: "os-diretoria", flag: "module_patrimonio" }
    ]
  }
];

export function findModulePage(slug: string) {
  return MODULE_PAGES.find((m) => m.slug === slug);
}

/** Perfis de setor social só enxergam as abas do próprio setor (regra do mock). */
export const SECTOR_ROLE_RESOURCE: Record<string, string> = { brecho: "social_brecho", clube_maes: "social_clube_maes" };
