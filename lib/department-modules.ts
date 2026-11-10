/**
 * Catálogo dos módulos que o Administrador libera em cada departamento (Usuários › Acesso).
 * A chave é o slug da aba (ver lib/module-pages.ts); "painel" é a aba sem slug. Módulo puro.
 */

export type DepartmentModule = {
  key: string;
  label: string;
  /** Só mostra informação: não há o que alterar. */
  viewOnly?: boolean;
  /** Título que agrupa módulos na tela de Acesso. */
  group?: string;
};

export type DepartmentLevel = "chamada" | "consulta" | "coordenacao";

const PAINEL: DepartmentModule = { key: "painel", label: "Painel", viewOnly: true };
const ANIVERSARIANTES: DepartmentModule = { key: "aniversariantes", label: "Aniversariantes", viewOnly: true };
const RELATORIO: DepartmentModule = { key: "relatorio", label: "Relatório Anual", viewOnly: true };
const TRABALHADORES: DepartmentModule = { key: "trabalhadores", label: "Trabalhadores" };
const OS: DepartmentModule = { key: "os", label: "Ordens de Serviço" };

export const CALL_MODULE = "chamada";
export const ATTENDANCE_MODULE = "frequencia";

const EDUCATION: readonly DepartmentModule[] = [
  PAINEL,
  { key: "evangelizandos", label: "Evangelizandos" },
  ANIVERSARIANTES,
  { key: "estudos", label: "Biblioteca de Estudos" },
  { key: CALL_MODULE, label: "Chamada da própria turma" },
  { key: ATTENDANCE_MODULE, label: "Frequência de todas as turmas" },
  { key: "cronograma", label: "Cronograma" },
  { key: "planejamento", label: "Planejamento Anual" },
  RELATORIO,
  OS,
  { key: "evangelizadores", label: "Evangelizadores (fichas)" }
];

export const DEPARTMENT_MODULES: Readonly<Record<string, readonly DepartmentModule[]>> = {
  assistencia_social: [
    PAINEL,
    OS,
    { key: "familias", label: "Famílias", group: "Famílias e entregas" },
    { key: "rancho", label: "Rancho dos Evangelizandos", group: "Famílias e entregas" },
    { key: "kits", label: "Kits de Higiene", group: "Famílias e entregas" },
    { key: "atividades", label: "Controle de Atividades", group: "Famílias e entregas" },
    { key: "voluntarios", label: "Cadastro de Voluntários", group: "Voluntários e doadores" },
    { key: "mantenedores", label: "Mantenedores da Cesta Básica", group: "Voluntários e doadores" },
    { key: "cafe", label: "Doadores do Café das Crianças", group: "Voluntários e doadores" },
    { key: "brecho", label: "Brechó — Livro Caixa", group: "Setores" },
    { key: "clube-maes", label: "Clube de Mães — Livro Caixa", group: "Setores" },
    { key: "clube-maes-pessoas", label: "Clube de Mães — Pessoas", group: "Setores" },
    { key: "clube-maes-entregas", label: "Clube de Mães — Entregas", group: "Setores" },
    { ...RELATORIO, group: "Relatórios" },
    { key: "planejamento", label: "Planejamento Anual", group: "Relatórios" },
    { ...TRABALHADORES, group: "Equipe" },
    { ...ANIVERSARIANTES, group: "Equipe" }
  ],
  conselho_fiscal: [PAINEL, { key: "analises", label: "Análises e Pareceres" }, OS],
  diretoria: [
    PAINEL,
    { key: "admissoes", label: "Aprovação de Trabalhadores" },
    { key: "baixas", label: "Autorizações de Baixa" },
    { key: "sugestoes", label: "Sugestões" },
    OS
  ],
  divulgacao: [
    { ...PAINEL, label: "Painel da Livraria" },
    { key: "obras", label: "Obras" },
    { key: "estoque", label: "Estoque" },
    { key: "emprestimos", label: "Empréstimos" },
    { key: "vendas", label: "Vendas" },
    TRABALHADORES,
    RELATORIO,
    OS
  ],
  doutrina: [
    PAINEL,
    TRABALHADORES,
    { key: "palestrantes", label: "Palestrantes Externos" },
    { key: "estudos", label: "Biblioteca de Estudos" },
    { key: "escalas", label: "Escala Mensal" },
    { key: ATTENDANCE_MODULE, label: "Frequência" },
    { key: "culto-lar", label: "Culto no Lar" },
    OS
  ],
  eventos: [
    PAINEL,
    { key: "ingressos", label: "Ingressos" },
    { key: "evento", label: "Evento" },
    { key: "agenda", label: "Agenda de Eventos" },
    TRABALHADORES,
    RELATORIO,
    OS
  ],
  infancia: EDUCATION,
  juridico: [PAINEL, { key: "eleicoes", label: "Eleições" }, RELATORIO, TRABALHADORES, OS],
  juventude: EDUCATION,
  patrimonio: [
    PAINEL,
    { key: "bens", label: "Cadastro de Bens" },
    TRABALHADORES,
    RELATORIO,
    OS,
    { key: "baixas", label: "Autorização de Baixa" },
    { key: "limpeza", label: "Escala de Limpeza" },
    ANIVERSARIANTES
  ],
  secretaria: [
    { key: "reunioes", label: "Reuniões e Atas" },
    PAINEL,
    { key: "admissoes", label: "Admissões" },
    TRABALHADORES,
    ANIVERSARIANTES,
    { key: "gravador", label: "Gravador" },
    OS
  ],
  tesouraria: [
    PAINEL,
    { key: "contribuicoes", label: "Contribuições" },
    { key: "mantenedores", label: "Mantenedores" },
    { key: "plano-de-contas", label: "Plano de Contas" },
    { key: "caixa", label: "Caixa Mensal" },
    ANIVERSARIANTES,
    RELATORIO,
    { key: "whatsapp", label: "WhatsApp" },
    { key: "extrato", label: "Extrato Bancário" },
    { key: "lancamentos", label: "Lançamentos" },
    { key: "doacoes", label: "Doações recebidas" },
    OS
  ]
};

/** Slug do módulo em /sistema/<slug> → departamento (a Presidência é o departamento Diretoria). */
export const PAGE_DEPARTMENT: Readonly<Record<string, string>> = {
  assistencia: "assistencia_social",
  conselhofiscal: "conselho_fiscal",
  divulgacao: "divulgacao",
  doutrina: "doutrina",
  eventos: "eventos",
  infancia: "infancia",
  juridico: "juridico",
  juventude: "juventude",
  patrimonio: "patrimonio",
  presidencia: "diretoria",
  secretaria: "secretaria",
  tesouraria: "tesouraria"
};

/** Módulo que libera as fichas de trabalhadores do departamento. */
export const workerModuleOf = (department: string) => (department === "infancia" || department === "juventude" ? "evangelizadores" : "trabalhadores");

export function findDepartmentModule(department: string, module: string) {
  return DEPARTMENT_MODULES[department]?.find((item) => item.key === module);
}

/** Módulo marcado para a pessoa. `edit` = também pode alterar. */
export type ModuleMark = { module: string; edit: boolean };

/** Marcas equivalentes ao acesso antigo por departamento, para quem ainda não tem marcas por módulo. */
export function marksFromLevel(department: string, level: DepartmentLevel | null | undefined): ModuleMark[] {
  const modules = DEPARTMENT_MODULES[department] ?? [];
  if (level === "chamada") return modules.some((m) => m.key === CALL_MODULE) ? [{ module: CALL_MODULE, edit: true }] : [];
  if (level === "consulta") return modules.map((m) => ({ module: m.key, edit: false }));
  if (level === "coordenacao") return modules.map((m) => ({ module: m.key, edit: !m.viewOnly }));
  return [];
}

/**
 * Resumo em app.user_departments, que o restante do sistema lê: `coordenacao` só com tudo marcado e tudo alterável;
 * `chamada` com apenas a chamada da própria turma; `null` sem nenhuma marca.
 */
export function levelFromMarks(department: string, marks: readonly ModuleMark[]): DepartmentLevel | null {
  const modules = DEPARTMENT_MODULES[department] ?? [];
  if (marks.length === 0) return null;
  if (marks.length === 1 && marks[0].module === CALL_MODULE && marks[0].edit) return "chamada";
  const everything = modules.every((m) => {
    const mark = marks.find((item) => item.module === m.key);
    return mark && (m.viewOnly || mark.edit);
  });
  return everything ? "coordenacao" : "consulta";
}

/** Nível do módulo para a pessoa: o perfil soma ao que foi marcado. */
export type ModuleLevel = "full" | "read" | null;

export function resolveModuleLevel(input: {
  module: string;
  floor: "full" | "read" | null;
  level: DepartmentLevel | null;
  marks: Readonly<Record<string, boolean>>;
}): ModuleLevel {
  const { module, floor, level, marks } = input;
  if (floor === "full") return "full";
  const fine = Object.keys(marks).length > 0;
  let person: ModuleLevel = null;
  if (fine) {
    if (module in marks) person = marks[module] ? "full" : "read";
  } else if (level === "coordenacao") {
    person = "full";
  } else if (level === "consulta") {
    person = "read";
  } else if (level === "chamada" && module === CALL_MODULE) {
    person = "full";
  }
  return person ?? floor;
}
