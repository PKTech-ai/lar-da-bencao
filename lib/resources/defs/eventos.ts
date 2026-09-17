import { DOC_KIND, PHOTO_KIND, type ResourceDef } from "@/lib/resources/types";

const FLAG = "module_eventos";
const SCOPE = { resource: "department", department: "eventos" } as const;
const EVENT_REF = { name: "event_id", label: "Evento", type: "reference", resource: "eventos-agenda", table: "events", required: true } as const;

export const EVENT_STATUS = ["A definir", "Planejado", "Em preparação", "Realizado", "Cancelado"] as const;
export const EVENT_ITEM_CATEGORIES = ["Alimentos", "Materiais e apoio", "Descartáveis", "Outros"] as const;

export const events: ResourceDef = {
  key: "eventos-agenda",
  table: "events",
  title: "Agenda de Eventos",
  singular: "Evento",
  module: "Eventos",
  section: "Agenda",
  flag: FLAG,
  scope: SCOPE,
  intro: "Eventos da Casa com data, local e responsável. Marque “Realizado” apenas com a data efetiva, até hoje.",
  archiveLabel: "Arquivar",
  rules: "eventos-agenda",
  orderBy: "coalesce(r.event_date, '9999-12-31'), r.name",
  search: ["name", "place", "responsible"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "name", label: "Nome do evento", type: "text", max: 160, required: true },
    { name: "event_date", label: "Data", type: "date" },
    { name: "event_time", label: "Horário", type: "text", max: 5, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", placeholder: "19:30" },
    { name: "place", label: "Local", type: "text", max: 200 },
    { name: "responsible", label: "Responsável", type: "text", max: 160 },
    { name: "status", label: "Situação", type: "select", options: EVENT_STATUS, required: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "event_record", kinds: [PHOTO_KIND("Fotos do evento"), DOC_KIND("document", "Documentos e orçamentos")], maxPerRecord: 30 }
};

export const eventItems: ResourceDef = {
  key: "eventos-itens",
  table: "event_items",
  title: "Itens do Evento",
  singular: "Item",
  module: "Eventos",
  section: "Itens",
  flag: FLAG,
  scope: SCOPE,
  intro: "Previsto x disponível de cada item. A diferença mostra o que ainda falta providenciar.",
  archiveLabel: "Arquivar",
  orderBy: "r.category, r.item",
  search: ["item", "responsible", "notes"],
  filters: [{ name: "event_id", label: "Evento" }, { name: "category", label: "Categoria" }],
  fields: [
    EVENT_REF,
    { name: "item", label: "Item", type: "text", max: 160, required: true },
    { name: "category", label: "Categoria", type: "select", options: EVENT_ITEM_CATEGORIES },
    { name: "unit", label: "Unidade", type: "text", max: 20, required: true, placeholder: "kg, pacote, unidade" },
    { name: "planned_qty", label: "Quantidade prevista", type: "integer", min: 0, max: 1_000_000, required: true },
    { name: "received_qty", label: "Quantidade recebida / disponível", type: "integer", min: 0, max: 1_000_000, required: true },
    { name: "value_cents", label: "Valor estimado total", type: "money" },
    { name: "responsible", label: "Responsável / doador", type: "text", max: 160 },
    { name: "notes", label: "Especificação / observações", type: "textarea", max: 500, wide: true, hideInList: true }
  ]
};

export const eventShifts: ResourceDef = {
  key: "eventos-escala",
  table: "event_shifts",
  title: "Escala de Trabalho",
  singular: "Escalado",
  module: "Eventos",
  section: "Escala",
  flag: FLAG,
  scope: SCOPE,
  intro: "Trabalhadores ativos escalados para o evento e o local de trabalho de cada um.",
  archiveLabel: "Retirar da escala",
  orderBy: "r.place, r.created_at",
  search: ["place", "notes"],
  filters: [{ name: "event_id", label: "Evento" }],
  fields: [
    EVENT_REF,
    { name: "worker_id", label: "Trabalhador ativo", type: "worker", required: true },
    { name: "place", label: "Local de trabalho", type: "text", max: 160, required: true },
    { name: "notes", label: "Observações", type: "textarea", max: 500, wide: true, hideInList: true }
  ]
};

export const eventReviews: ResourceDef = {
  key: "eventos-avaliacao",
  table: "event_reviews",
  title: "Avaliação do Evento",
  singular: "Avaliação",
  module: "Eventos",
  section: "Avaliação",
  flag: FLAG,
  scope: SCOPE,
  intro: "O que foi comprado e a sugestão para o próximo evento.",
  archiveLabel: "Arquivar",
  orderBy: "r.created_at desc",
  search: ["product", "purchased", "suggestion"],
  filters: [{ name: "event_id", label: "Evento" }],
  fields: [
    EVENT_REF,
    { name: "product", label: "Produto", type: "text", max: 160, required: true },
    { name: "purchased", label: "Comprado — quantidade e unidade", type: "text", max: 120 },
    { name: "suggestion", label: "Sugestão para o próximo evento", type: "textarea", max: 1000, wide: true }
  ]
};
