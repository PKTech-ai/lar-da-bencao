import { DOC_KIND, OFFICE_KIND, type ResourceDef } from "@/lib/resources/types";

/** Parecer do Conselho Fiscal sobre o mês enviado pela Tesouraria. */
export const fiscalReviews: ResourceDef = {
  key: "conselho-analises",
  table: "fiscal_reviews",
  title: "Análises e Pareceres",
  singular: "Análise",
  module: "Conselho Fiscal",
  section: "Análise mensal",
  flag: "module_conselho_fiscal",
  scope: { resource: "conselho_fiscal" },
  intro: "Análise do caixa mensal liberado pela Tesouraria. O parecer fica no histórico e não altera lançamento nenhum. Arquivar a decisão trava alterações e impede a reabertura do caixa.",
  rules: "conselho-analises",
  orderBy: "r.reference_month desc",
  search: ["analysis", "opinion", "reviewers"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "reference_month", label: "Competência analisada", type: "month", required: true },
    { name: "status", label: "Decisão", type: "select", options: ["Em análise", "Deferido", "Indeferido"], required: true },
    { name: "review_date", label: "Data da análise", type: "date", required: true, notFuture: true },
    { name: "reviewers", label: "Conselheiros presentes", type: "text", max: 300, wide: true },
    { name: "analysis", label: "Análise", type: "textarea", max: 8000, wide: true, hideInList: true },
    { name: "opinion", label: "Parecer", type: "textarea", max: 8000, wide: true, hideInList: true },
    { name: "locked_at", label: "Decisão arquivada em", type: "date", readOnly: true, hideInList: true, help: "Depois de arquivada, a decisão não muda mais e o caixa não reabre." }
  ],
  attachments: { ownerType: "fiscal_council_document", kinds: [DOC_KIND("opinion", "Parecer assinado e documentos")], maxPerRecord: 10 }
};

/** Eleições da Casa (mock `ElectionDocuments`): etapas, datas e modelos de documento. */
export const elections: ResourceDef = {
  key: "juridico-eleicoes",
  table: "elections",
  title: "Eleições",
  singular: "Eleição",
  module: "Jurídico",
  section: "Eleições",
  flag: "module_juridico",
  scope: { resource: "department", department: "juridico" },
  intro: "Cada etapa da eleição, com as datas e os documentos gerados (edital, atas, posse).",
  archiveLabel: "Arquivar",
  orderBy: "r.year desc, r.created_at desc",
  search: ["title", "notes"],
  filters: [{ name: "stage", label: "Etapa" }],
  fields: [
    { name: "title", label: "Eleição", type: "text", max: 200, required: true },
    { name: "year", label: "Ano", type: "integer", min: 1900, max: 2199, required: true },
    { name: "stage", label: "Etapa", type: "select", options: ["Edital", "Inscrições", "Homologação", "Votação", "Apuração", "Posse", "Encerrada"], required: true },
    { name: "notice_date", label: "Data do edital", type: "date" },
    { name: "registration_end", label: "Fim das inscrições", type: "date", notBeforeField: "notice_date" },
    { name: "vote_date", label: "Data da votação", type: "date", notBeforeField: "registration_end" },
    { name: "term_start", label: "Posse", type: "date", notBeforeField: "vote_date" },
    { name: "biennium_label", label: "Biênio eleito", type: "text", max: 80 },
    { name: "notes", label: "Observações", type: "textarea", max: 4000, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "legal_document", kinds: [OFFICE_KIND("document", "Documentos da eleição (PDF, imagem ou .docx)")], maxPerRecord: 30 }
};
