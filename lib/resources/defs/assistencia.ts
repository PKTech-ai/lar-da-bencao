import { DOC_KIND, type ResourceDef } from "@/lib/resources/types";

const FLAG = "module_assistencia";
const SCOPE = { resource: "department", department: "assistencia_social" } as const;

export const SOCIAL_AREAS = [
  "Cesta básica / distribuição", "Ajuda na confecção de sopa", "Clube de Mães", "Salão de Corte de Cabelo",
  "Brechó", "Caravana do Amor", "Desenvolvimento Profissional", "Outras ações sociais"
] as const;
export const FREQUENCIES = ["Mensal", "Quinzenal", "Semanal", "Eventual", "Anual"] as const;
export const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão", "Transferência"] as const;

export const socialVolunteers: ResourceDef = {
  key: "assistencia-voluntarios",
  table: "social_volunteers",
  title: "Voluntários do Dpto Social",
  singular: "Voluntário",
  module: "Assistência e Promoção Social",
  section: "Voluntários",
  flag: FLAG,
  scope: SCOPE,
  intro: "Vínculo de voluntário do Departamento Social. Este registro não ativa a pessoa como trabalhadora da Casa.",
  archiveLabel: "Arquivar",
  orderBy: "r.name",
  search: ["name", "phone", "email", "neighborhood", "skills"],
  filters: [{ name: "status", label: "Situação" }, { name: "area", label: "Área" }],
  fields: [
    { name: "name", label: "Nome completo", type: "text", max: 160, required: true, wide: true },
    { name: "area", label: "Área principal de apoio", type: "select", options: SOCIAL_AREAS, required: true },
    { name: "status", label: "Situação da colaboração", type: "select", options: ["Disponível", "Pausado", "Encerrado"], required: true },
    { name: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { name: "email", label: "E-mail", type: "email", hideInList: true },
    { name: "birth_date", label: "Data de nascimento", type: "date", hideInList: true },
    { name: "neighborhood", label: "Bairro / cidade", type: "text", max: 160, hideInList: true },
    { name: "document", label: "CPF / RG (opcional)", type: "text", max: 50, hideInList: true },
    { name: "address", label: "Endereço (opcional)", type: "text", max: 300, wide: true, hideInList: true },
    { name: "start_date", label: "Data de início", type: "date" },
    { name: "end_date", label: "Fim da participação", type: "date", notBeforeField: "start_date", hideInList: true },
    { name: "availability", label: "Dias / horários disponíveis", type: "text", max: 250, wide: true, placeholder: "Ex.: sábados, das 8h às 12h" },
    { name: "skills", label: "Atividades e habilidades", type: "textarea", max: 1000, wide: true, hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const basketSupporters: ResourceDef = {
  key: "assistencia-mantenedores",
  table: "social_basket_supporters",
  title: "Mantenedores da Cesta Básica",
  singular: "Mantenedor",
  module: "Assistência e Promoção Social",
  section: "Mantenedores da Cesta Básica",
  flag: FLAG,
  scope: SCOPE,
  intro: "Contribuição combinada para a cesta básica. O cadastro não equivale a um recebimento ou a uma doação já entregue.",
  archiveLabel: "Arquivar",
  orderBy: "r.name",
  search: ["name", "phone", "pledge", "notes"],
  filters: [{ name: "status", label: "Situação" }, { name: "support_type", label: "Tipo de contribuição" }],
  fields: [
    { name: "name", label: "Nome da pessoa / organização", type: "text", max: 160, required: true, wide: true },
    { name: "person_type", label: "Tipo de mantenedor", type: "select", options: ["Pessoa física", "Organização"], required: true },
    { name: "support_type", label: "Tipo de contribuição", type: "select", options: ["Itens da cesta básica", "Financeira"], required: true },
    { name: "value_cents", label: "Valor da contribuição", type: "money" },
    { name: "frequency", label: "Periodicidade", type: "select", options: FREQUENCIES, required: true },
    { name: "status", label: "Situação da colaboração", type: "select", options: ["Colaborando", "Pausado", "Encerrado"], required: true },
    { name: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { name: "birth_date", label: "Data de nascimento", type: "date", hideInList: true },
    { name: "preferred_day", label: "Dia previsto para a contribuição", type: "integer", min: 1, max: 31, hideInList: true },
    { name: "start_date", label: "Data de início", type: "date" },
    { name: "end_date", label: "Fim da colaboração", type: "date", notBeforeField: "start_date", hideInList: true },
    { name: "pledge", label: "Itens da cesta e quantidades", type: "textarea", max: 350, wide: true, hideInList: true, placeholder: "Ex.: 10 kg de arroz e 5 kg de feijão" },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const socialFamilies: ResourceDef = {
  key: "assistencia-familias",
  table: "social_families",
  title: "Famílias atendidas",
  singular: "Família",
  module: "Assistência e Promoção Social",
  section: "Cadastro social",
  flag: FLAG,
  scope: SCOPE,
  intro: "Cadastro das pessoas e famílias acompanhadas pelo Departamento Social.",
  archiveLabel: "Arquivar",
  orderBy: "r.name",
  search: ["name", "phone", "neighborhood", "notes"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "name", label: "Nome completo", type: "text", max: 160, required: true, wide: true },
    { name: "status", label: "Situação", type: "select", options: ["Em acompanhamento", "Pausado", "Encerrado"], required: true },
    { name: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { name: "people_count", label: "Pessoas na família", type: "integer", min: 1, max: 40 },
    { name: "birth_date", label: "Data de nascimento", type: "date", hideInList: true },
    { name: "document", label: "CPF / RG (opcional)", type: "text", max: 50, hideInList: true },
    { name: "neighborhood", label: "Bairro / cidade", type: "text", max: 160 },
    { name: "address", label: "Endereço", type: "text", max: 300, wide: true, hideInList: true },
    { name: "start_date", label: "Início do acompanhamento", type: "date" },
    { name: "end_date", label: "Encerramento", type: "date", notBeforeField: "start_date", hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const ranchoDeliveries: ResourceDef = {
  key: "assistencia-rancho",
  table: "social_rancho_deliveries",
  title: "Rancho — entregas",
  singular: "Entrega de rancho",
  module: "Assistência e Promoção Social",
  section: "Rancho",
  flag: FLAG,
  scope: SCOPE,
  intro: "Entrega da cesta para a família acompanhada, no mês de referência.",
  archiveLabel: "Arquivar",
  rules: "assistencia-rancho",
  orderBy: "r.delivery_date desc",
  search: ["items", "notes"],
  filters: [{ name: "family_id", label: "Família" }, { name: "status", label: "Situação" }],
  fields: [
    { name: "family_id", label: "Família", type: "reference", resource: "assistencia-familias", table: "social_families", required: true },
    { name: "reference_month", label: "Mês de referência", type: "month", required: true },
    { name: "delivery_date", label: "Data da entrega", type: "date", notFuture: true },
    { name: "status", label: "Situação", type: "select", options: ["Programada", "Entregue", "Não retirada", "Cancelada"], required: true },
    { name: "baskets", label: "Cestas entregues", type: "integer", min: 0, max: 100 },
    { name: "items", label: "Itens entregues", type: "textarea", max: 1000, wide: true, hideInList: true },
    { name: "responsible", label: "Responsável pela entrega", type: "text", max: 160 },
    { name: "notes", label: "Observações", type: "textarea", max: 1000, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "social_record", kinds: [DOC_KIND("receipt", "Comprovante de entrega")], maxPerRecord: 5 }
};

export const hygieneKits: ResourceDef = {
  key: "assistencia-kits",
  table: "social_hygiene_kits",
  title: "Kits de Higiene",
  singular: "Programação de kits",
  module: "Assistência e Promoção Social",
  section: "Kits de Higiene",
  flag: FLAG,
  scope: SCOPE,
  intro: "Programação e comprovação da entrega dos kits de higiene.",
  archiveLabel: "Arquivar",
  orderBy: "r.planned_date desc",
  search: ["responsible", "place", "notes"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "planned_date", label: "Data programada", type: "date", required: true },
    { name: "status", label: "Situação", type: "select", options: ["Programada", "Realizada", "Cancelada"], required: true },
    { name: "delivery_date", label: "Data da entrega", type: "date", notFuture: true },
    { name: "kits_delivered", label: "Quantidade de kits entregue", type: "integer", min: 0, max: 100000 },
    { name: "responsible", label: "Responsável", type: "text", max: 160, required: true },
    { name: "audience", label: "Público / famílias atendidas", type: "text", max: 250 },
    { name: "place", label: "Local", type: "text", max: 200, hideInList: true },
    { name: "notes", label: "Observações / resultados", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const socialActivities: ResourceDef = {
  key: "assistencia-atividades",
  table: "social_activities",
  title: "Controle de Atividades",
  singular: "Atividade",
  module: "Assistência e Promoção Social",
  section: "Controle de Atividades",
  flag: FLAG,
  scope: SCOPE,
  intro: "Sopa, café das crianças, corte de cabelo e demais ações: o que foi programado e o que foi realizado.",
  archiveLabel: "Arquivar",
  orderBy: "r.effective_date desc nulls last, r.planned_date desc",
  search: ["activity", "responsible", "place", "notes"],
  filters: [{ name: "activity", label: "Atividade" }, { name: "status", label: "Situação" }],
  fields: [
    { name: "activity", label: "Atividade", type: "select", options: SOCIAL_AREAS, required: true },
    { name: "status", label: "Situação", type: "select", options: ["Programada", "Realizada", "Cancelada"], required: true },
    { name: "planned_date", label: "Data programada", type: "date" },
    { name: "effective_date", label: "Data efetiva", type: "date", notFuture: true },
    { name: "quantity", label: "Quantidade realizada", type: "integer", min: 0, max: 1_000_000 },
    { name: "unit", label: "Unidade", type: "text", max: 40, placeholder: "porções, atendimentos, kits" },
    { name: "responsible", label: "Responsável", type: "text", max: 160, required: true },
    { name: "audience", label: "Público / beneficiários", type: "text", max: 250, hideInList: true },
    { name: "place", label: "Local", type: "text", max: 200, hideInList: true },
    { name: "notes", label: "Observações / resultados", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const childrenCoffeeDonors: ResourceDef = {
  key: "assistencia-cafe",
  table: "social_coffee_donors",
  title: "Café das Crianças — doadores",
  singular: "Doador",
  module: "Assistência e Promoção Social",
  section: "Café das Crianças",
  flag: FLAG,
  scope: SCOPE,
  intro: "Doadores do café das crianças, com o vínculo e a contribuição combinada.",
  archiveLabel: "Arquivar",
  orderBy: "r.name",
  search: ["name", "phone", "notes"],
  filters: [{ name: "status", label: "Situação" }, { name: "link_type", label: "Vínculo" }],
  fields: [
    { name: "name", label: "Nome da pessoa / organização", type: "text", max: 160, required: true, wide: true },
    { name: "link_type", label: "Vínculo do doador", type: "select", options: ["Trabalhador da Casa", "Frequentador", "Organização", "Outro"], required: true },
    { name: "worker_id", label: "Trabalhador vinculado", type: "worker", help: "Somente quando o doador for trabalhador ativo." },
    { name: "contribution_type", label: "Tipo de contribuição", type: "select", options: ["Itens", "Financeira"], required: true },
    { name: "value_cents", label: "Valor combinado", type: "money" },
    { name: "frequency", label: "Periodicidade", type: "select", options: FREQUENCIES, required: true },
    { name: "status", label: "Situação", type: "select", options: ["Colaborando", "Pausado", "Encerrado"], required: true },
    { name: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { name: "start_date", label: "Data de início", type: "date", required: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

const ledgerFields = [
  { name: "entry_date", label: "Data", type: "date", required: true, notFuture: true },
  { name: "direction", label: "Movimentação", type: "select", options: ["Entrada", "Saída"], required: true },
  { name: "description", label: "Descrição", type: "text", max: 200, required: true },
  { name: "category", label: "Categoria", type: "text", max: 80 },
  { name: "quantity", label: "Quantidade", type: "integer", min: 0, max: 100000 },
  { name: "amount_cents", label: "Valor", type: "money", required: true },
  { name: "payment_method", label: "Forma de pagamento", type: "select", options: PAYMENT_METHODS },
  { name: "notes", label: "Observações", type: "textarea", max: 1000, wide: true, hideInList: true }
] as const;

const sectorLedger = (sector: "brecho" | "clube_maes", label: string, resource: string, ownerType: string): ResourceDef => ({
  key: `${sector === "brecho" ? "brecho" : "clube-maes"}-caixa`,
  table: "social_sector_ledger",
  title: `${label} — Livro Caixa`,
  singular: "Lançamento",
  module: "Assistência e Promoção Social",
  section: label,
  flag: FLAG,
  scope: { resource },
  intro: `Entradas e saídas do ${label}, com comprovante. O saldo do mês vem dos lançamentos.`,
  fixed: { sector },
  orderBy: "r.entry_date desc, r.created_at desc",
  search: ["description", "category", "notes"],
  filters: [{ name: "direction", label: "Movimentação" }, { name: "payment_method", label: "Forma de pagamento" }],
  fields: [...ledgerFields],
  attachments: { ownerType, kinds: [DOC_KIND("proof", "Comprovante")], maxPerRecord: 10 }
});

export const brechoLedger = sectorLedger("brecho", "Brechó", "social_brecho", "social_brecho_proof");
export const clubeMaesLedger = sectorLedger("clube_maes", "Clube de Mães", "social_clube_maes", "social_clube_maes_proof");

export const clubPeople: ResourceDef = {
  key: "clube-maes-pessoas",
  table: "club_people",
  title: "Clube de Mães — pessoas atendidas",
  singular: "Pessoa atendida",
  module: "Assistência e Promoção Social",
  section: "Clube de Mães",
  flag: FLAG,
  scope: { resource: "social_clube_maes" },
  archiveLabel: "Arquivar",
  orderBy: "r.name",
  search: ["name", "phone", "notes"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "name", label: "Nome completo", type: "text", max: 160, required: true, wide: true },
    { name: "status", label: "Situação", type: "select", options: ["Em acompanhamento", "Pausada", "Encerrada"], required: true },
    { name: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { name: "start_date", label: "Início do acompanhamento", type: "date", required: true },
    { name: "notes", label: "Observações", type: "textarea", max: 1000, wide: true, hideInList: true }
  ]
};

export const socialPlanning: ResourceDef = {
  key: "assistencia-planejamento",
  table: "social_plan_items",
  title: "Planejamento Anual",
  singular: "Ação planejada",
  module: "Assistência e Promoção Social",
  section: "Planejamento Anual",
  flag: FLAG,
  scope: SCOPE,
  intro: "O que o departamento se compromete a fazer no ano. A execução aparece no Controle de Atividades e no Relatório Anual.",
  archiveLabel: "Arquivar",
  orderBy: "r.year desc, r.month, r.created_at",
  search: ["action", "basis", "responsible", "notes"],
  filters: [{ name: "status", label: "Situação" }, { name: "activity", label: "Atividade" }],
  fields: [
    { name: "year", label: "Ano", type: "integer", min: 1900, max: 2199, required: true },
    { name: "month", label: "Mês previsto", type: "integer", min: 1, max: 12, required: true },
    { name: "action", label: "Ação", type: "text", max: 200, required: true },
    { name: "activity", label: "Atividade relacionada", type: "select", options: SOCIAL_AREAS },
    { name: "status", label: "Situação", type: "select", options: ["Planejada", "Em andamento", "Concluída", "Cancelada"], required: true },
    { name: "basis", label: "Fundamento / objetivo", type: "text", max: 250 },
    { name: "responsible", label: "Responsável", type: "text", max: 160 },
    { name: "goal", label: "Meta", type: "text", max: 120, hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ]
};

export const clubDeliveries: ResourceDef = {
  key: "clube-maes-entregas",
  table: "club_deliveries",
  title: "Clube de Mães — entregas de enxoval",
  singular: "Entrega",
  module: "Assistência e Promoção Social",
  section: "Clube de Mães",
  flag: FLAG,
  scope: { resource: "social_clube_maes" },
  intro: "Entrega do enxoval para a pessoa acompanhada. O comprovante pode ser impresso.",
  archiveLabel: "Arquivar",
  orderBy: "r.delivery_date desc",
  search: ["items", "notes"],
  filters: [{ name: "person_id", label: "Pessoa" }],
  fields: [
    { name: "person_id", label: "Pessoa atendida", type: "reference", resource: "clube-maes-pessoas", table: "club_people", required: true },
    { name: "delivery_date", label: "Data da entrega", type: "date", required: true, notFuture: true },
    { name: "items", label: "Itens entregues", type: "textarea", max: 1000, wide: true, required: true },
    { name: "responsible", label: "Responsável", type: "text", max: 160 },
    { name: "notes", label: "Observações", type: "textarea", max: 1000, wide: true, hideInList: true }
  ]
};
