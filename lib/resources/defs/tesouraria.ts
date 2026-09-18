import { DOC_KIND, type ResourceDef } from "@/lib/resources/types";

const FLAG = "module_tesouraria";
const SCOPE = { resource: "tesouraria" } as const;

export const COST_CENTERS = [
  "Institucional / Administração", "Doutrina", "Infância", "Juventude", "Assistência e Promoção Social",
  "Patrimônio", "Eventos", "Divulgação", "Lanchonete", "Brechó", "Outros"
] as const;

export const PAYMENT_METHODS = [
  "Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Transferência Bancária", "Boleto", "Débito em Conta", "Não informado"
] as const;

export const FUND_SOURCES = ["Caixa", "Banco"] as const;
export const FREQUENCIES = ["Mensal", "Quinzenal", "Semanal", "Eventual", "Anual"] as const;

/** Lançamentos do caixa mensal (mock: livro caixa da Tesouraria com comprovantes). */
export const treasuryEntries: ResourceDef = {
  key: "tesouraria-lancamentos",
  table: "treasury_entries",
  title: "Caixa Mensal",
  singular: "Lançamento",
  module: "Tesouraria",
  section: "Caixa Mensal",
  flag: FLAG,
  scope: SCOPE,
  intro: "Entradas e saídas classificadas pelo plano de contas. Mês fechado não recebe nem altera lançamento.",
  rules: "tesouraria-lancamentos",
  orderBy: "r.entry_date desc, r.created_at desc",
  search: ["description", "reference", "notes"],
  filters: [{ name: "cost_center", label: "Centro de custo" }, { name: "payment_method", label: "Forma" }, { name: "fund_source", label: "Origem" }],
  fields: [
    { name: "entry_date", label: "Data", type: "date", required: true, notFuture: true },
    { name: "account_code", label: "Conta do plano de contas", type: "text", max: 12, required: true, help: "Use a conta analítica, por exemplo 1.01.01." },
    { name: "description", label: "Descrição", type: "text", max: 250, required: true },
    { name: "amount_cents", label: "Valor", type: "money", required: true },
    { name: "cost_center", label: "Centro de custo", type: "select", options: COST_CENTERS, required: true },
    { name: "payment_method", label: "Forma de pagamento", type: "select", options: PAYMENT_METHODS, required: true },
    { name: "fund_source", label: "Origem do recurso", type: "select", options: FUND_SOURCES, required: true },
    { name: "reference", label: "Documento / referência", type: "text", max: 120, hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 1000, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "treasury_proof", kinds: [DOC_KIND("proof", "Comprovante do lançamento")], maxPerRecord: 10 }
};

export const treasurySupporters: ResourceDef = {
  key: "tesouraria-mantenedores",
  table: "treasury_supporters",
  title: "Mantenedores",
  singular: "Mantenedor",
  module: "Tesouraria",
  section: "Mantenedores",
  flag: FLAG,
  scope: SCOPE,
  intro: "Pessoas e organizações que mantêm a Casa. O cadastro registra o combinado; o recebimento entra em “Doações recebidas”.",
  archiveLabel: "Arquivar",
  orderBy: "r.name",
  search: ["name", "phone", "notes"],
  filters: [{ name: "status", label: "Situação" }, { name: "frequency", label: "Periodicidade" }],
  fields: [
    { name: "name", label: "Nome completo", type: "text", max: 160, required: true, wide: true },
    { name: "status", label: "Situação", type: "select", options: ["Colaborando", "Pausado", "Encerrado"], required: true },
    { name: "frequency", label: "Periodicidade", type: "select", options: FREQUENCIES, required: true },
    { name: "value_cents", label: "Valor combinado", type: "money" },
    { name: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { name: "birth_date", label: "Data de nascimento", type: "date", hideInList: true },
    { name: "start_date", label: "Início da colaboração", type: "date", required: true },
    { name: "preferred_day", label: "Dia previsto", type: "integer", min: 1, max: 31, hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const treasuryDonations: ResourceDef = {
  key: "tesouraria-doacoes",
  table: "treasury_donations",
  title: "Doações recebidas",
  singular: "Doação",
  module: "Tesouraria",
  section: "Mantenedores",
  flag: FLAG,
  scope: SCOPE,
  intro: "Recebimentos dos mantenedores, com destino e comprovante.",
  rules: "tesouraria-doacoes",
  orderBy: "r.received_at desc",
  search: ["destination", "reference", "notes"],
  filters: [{ name: "supporter_id", label: "Mantenedor" }, { name: "payment_method", label: "Forma" }],
  fields: [
    { name: "supporter_id", label: "Mantenedor", type: "reference", resource: "tesouraria-mantenedores", table: "treasury_supporters", required: true },
    { name: "received_at", label: "Data do recebimento", type: "date", required: true, notFuture: true },
    { name: "amount_cents", label: "Valor recebido", type: "money", required: true },
    { name: "payment_method", label: "Forma de recebimento", type: "select", options: PAYMENT_METHODS, required: true },
    { name: "destination", label: "Destino da doação", type: "text", max: 200 },
    { name: "reference", label: "Documento / referência", type: "text", max: 120, hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 1000, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "treasury_proof", kinds: [DOC_KIND("proof", "Comprovante")], maxPerRecord: 5 }
};
