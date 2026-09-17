import { DOC_KIND, type ResourceDef } from "@/lib/resources/types";

const FLAG = "module_divulgacao";
const SCOPE = { resource: "department", department: "divulgacao" } as const;
const BOOK_REF = { name: "book_id", label: "Obra", type: "reference", resource: "divulgacao-obras", table: "books", required: true } as const;

export const BOOK_PURPOSES = ["Empréstimos", "Revenda"] as const;
export const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão", "Transferência"] as const;

/** Inventário da Livraria (mock `Bookshop`): a mesma obra pode ter cadastro em cada destinação. */
export const books: ResourceDef = {
  key: "divulgacao-obras",
  table: "books",
  title: "Livraria — Obras",
  singular: "Obra",
  module: "Divulgação",
  section: "Livraria",
  flag: FLAG,
  scope: SCOPE,
  intro: "Cadastro das obras por destinação. A quantidade disponível vem das movimentações de estoque.",
  archiveLabel: "Arquivar",
  orderBy: "r.title",
  search: ["code", "title", "author", "isbn"],
  filters: [{ name: "purpose", label: "Destinação" }, { name: "active", label: "Situação" }],
  fields: [
    { name: "code", label: "Código do livro", type: "text", max: 50, required: true, unique: true },
    { name: "title", label: "Título da obra", type: "text", max: 200, required: true },
    { name: "purpose", label: "Destinação", type: "select", options: BOOK_PURPOSES, required: true },
    { name: "author", label: "Autor", type: "text", max: 180 },
    { name: "isbn", label: "ISBN", type: "text", max: 40, hideInList: true },
    { name: "price_cents", label: "Preço de revenda", type: "money", help: "Somente para obras de revenda." },
    { name: "active", label: "Situação", type: "select", options: ["Ativo", "Inativo"], required: true }
  ]
};

export const bookStock: ResourceDef = {
  key: "divulgacao-estoque",
  table: "book_stock_moves",
  title: "Livraria — Estoque",
  singular: "Movimentação",
  module: "Divulgação",
  section: "Livraria",
  flag: FLAG,
  scope: SCOPE,
  intro: "Entradas e baixas de exemplares. A baixa não pode passar do disponível.",
  rules: "divulgacao-estoque",
  orderBy: "r.move_date desc, r.created_at desc",
  search: ["reason", "notes"],
  filters: [{ name: "book_id", label: "Obra" }, { name: "direction", label: "Movimentação" }],
  fields: [
    BOOK_REF,
    { name: "direction", label: "Movimentação", type: "select", options: ["Entrada", "Baixa"], required: true },
    { name: "quantity", label: "Quantidade", type: "integer", min: 1, max: 1_000_000, required: true },
    { name: "move_date", label: "Data", type: "date", required: true, notFuture: true },
    { name: "reason", label: "Motivo", type: "text", max: 250, required: true },
    { name: "notes", label: "Observações", type: "textarea", max: 500, wide: true, hideInList: true }
  ]
};

export const bookLoans: ResourceDef = {
  key: "divulgacao-emprestimos",
  table: "book_loans",
  title: "Livraria — Empréstimos",
  singular: "Empréstimo",
  module: "Divulgação",
  section: "Livraria",
  flag: FLAG,
  scope: SCOPE,
  intro: "Empréstimos de obras do inventário. Registre a devolução para liberar os exemplares.",
  rules: "divulgacao-emprestimos",
  orderBy: "r.due_date, r.created_at desc",
  search: ["borrower", "contact", "notes"],
  filters: [{ name: "book_id", label: "Obra" }],
  fields: [
    BOOK_REF,
    { name: "borrower", label: "Pessoa que recebe o livro", type: "text", max: 180, required: true },
    { name: "quantity", label: "Exemplares", type: "integer", min: 1, max: 1000, required: true },
    { name: "contact", label: "Telefone / contato", type: "phone", hideInList: true },
    { name: "loan_date", label: "Data do empréstimo", type: "date", required: true, notFuture: true },
    { name: "due_date", label: "Previsão de devolução", type: "date", required: true, notBeforeField: "loan_date" },
    { name: "notes", label: "Observações", type: "textarea", max: 500, wide: true, hideInList: true }
  ]
};

export const bookSales: ResourceDef = {
  key: "divulgacao-vendas",
  table: "book_sales",
  title: "Livraria — Vendas",
  singular: "Venda",
  module: "Divulgação",
  section: "Livraria",
  flag: FLAG,
  scope: SCOPE,
  intro: "Venda de obras de revenda, com comprovante do recebimento.",
  rules: "divulgacao-vendas",
  orderBy: "r.sale_date desc, r.created_at desc",
  search: ["buyer", "notes"],
  filters: [{ name: "book_id", label: "Obra" }, { name: "payment_method", label: "Forma de recebimento" }],
  fields: [
    BOOK_REF,
    { name: "quantity", label: "Exemplares", type: "integer", min: 1, max: 1000, required: true },
    { name: "unit_price_cents", label: "Valor por exemplar", type: "money", required: true },
    { name: "sale_date", label: "Data da venda", type: "date", required: true, notFuture: true },
    { name: "payment_method", label: "Forma de recebimento", type: "select", options: PAYMENT_METHODS, required: true },
    { name: "buyer", label: "Comprador", type: "text", max: 180 },
    { name: "notes", label: "Observações", type: "textarea", max: 500, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "bookshop_proof", kinds: [DOC_KIND("proof", "Comprovante do recebimento")], maxPerRecord: 5 }
};
