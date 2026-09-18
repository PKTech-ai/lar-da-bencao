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
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-patrimonio" },
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
      { slug: "avaliacao", label: "Avaliação", resource: "eventos-avaliacao" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-eventos" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-eventos" }
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
      { slug: "clube-maes-entregas", label: "Clube de Mães — Entregas", resource: "clube-maes-entregas", access: { resource: "social_clube_maes" } },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-assistencia" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" },
      { slug: "planejamento", label: "Planejamento Anual", resource: "assistencia-planejamento" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-assistencia" }
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
      { slug: "vendas", label: "Vendas", resource: "divulgacao-vendas" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-divulgacao" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-divulgacao" }
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
      { slug: "admissoes", label: "Admissões", panel: "admissoes-atalho" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" }
    ]
  },
  {
    slug: "tesouraria",
    title: "Tesouraria",
    intro: "Caixa mensal com plano de contas, contribuições, mantenedores, extrato bancário conciliado e envio ao Conselho Fiscal.",
    flag: "module_tesouraria",
    access: { resource: "tesouraria" },
    sections: [
      { slug: "", label: "Caixa Mensal", panel: "tesouraria-mes" },
      { slug: "lancamentos", label: "Lançamentos", resource: "tesouraria-lancamentos" },
      { slug: "contribuicoes", label: "Contribuições", resource: "tesouraria-contribuicoes" },
      { slug: "mantenedores", label: "Mantenedores", resource: "tesouraria-mantenedores" },
      { slug: "doacoes", label: "Doações recebidas", resource: "tesouraria-doacoes" },
      { slug: "extrato", label: "Extrato e Conciliação", panel: "tesouraria-extrato" },
      { slug: "plano-de-contas", label: "Plano de Contas", panel: "tesouraria-contas" },
      { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" },
      { slug: "whatsapp", label: "WhatsApp", panel: "whatsapp-tesouraria" },
      { slug: "relatorio", label: "Relatório Anual", panel: "tesouraria-relatorio" }
    ]
  },
  {
    slug: "conselhofiscal",
    title: "Conselho Fiscal",
    intro: "Análise dos meses enviados pela Tesouraria, com parecer registrado e histórico.",
    flag: "module_conselho_fiscal",
    access: { resource: "conselho_fiscal" },
    sections: [
      { slug: "", label: "Análises e Pareceres", panel: "conselho-analises" }
    ]
  },
  {
    slug: "juridico",
    title: "Jurídico",
    intro: "Eleições da Casa: etapas, datas e documentos (inclusive modelos .docx).",
    flag: "module_juridico",
    access: { resource: "department", department: "juridico" },
    sections: [
      { slug: "", label: "Eleições", resource: "juridico-eleicoes" },
      { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-juridico" },
      { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-juridico" }
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
      { slug: "baixas", label: "Autorizações de Baixa", panel: "presidencia-baixas" },
      { slug: "admissoes", label: "Aprovação de Trabalhadores", panel: "admissoes-atalho" },
      { slug: "sugestoes", label: "Sugestões", panel: "sugestoes-atalho" }
    ]
  }
];

export function findModulePage(slug: string) {
  return MODULE_PAGES.find((m) => m.slug === slug);
}

/** Perfis de setor social só enxergam as abas do próprio setor (regra do mock). */
export const SECTOR_ROLE_RESOURCE: Record<string, string> = { brecho: "social_brecho", clube_maes: "social_clube_maes" };
