import { DOC_KIND, PHOTO_KIND, type ResourceDef } from "@/lib/resources/types";

/** Cadastro de Bens (mock `PatrimonyAssets`). A baixa só é registrada pela autorização da Diretoria. */
export const patrimonyAssets: ResourceDef = {
  key: "patrimonio-bens",
  table: "patrimony_assets",
  title: "Cadastro de Bens",
  singular: "Bem patrimonial",
  module: "Patrimônio",
  section: "Cadastro de Bens",
  flag: "module_patrimonio",
  scope: { resource: "department", department: "patrimonio" },
  intro: "Tombamento, valores, movimentação e documentos dos bens da Casa. Para baixar um bem, encaminhe o memorando pela aba Autorização de Baixa.",
  fields: [
    { name: "tombamento", label: "Número de tombamento", type: "text", max: 60, required: true, unique: true, placeholder: "Ex.: LB-00001" },
    { name: "condition", label: "Situação (novo/usado)", type: "select", options: ["Novo", "Usado"], required: true },
    { name: "description", label: "Descrição do bem", type: "textarea", max: 500, required: true, wide: true },
    { name: "department_key", label: "Departamento", type: "department", required: true },
    { name: "entry_date", label: "Data da entrada", type: "date", required: true, notFuture: true },
    { name: "disposal_date", label: "Data da baixa autorizada", type: "date", readOnly: true, help: "Registrada automaticamente quando a Diretoria autoriza a baixa." },
    { name: "value_cents", label: "Valor do bem", type: "money", required: true },
    { name: "location", label: "Localização", type: "text", max: 200, placeholder: "Ex.: Salão principal" },
    { name: "responsible", label: "Responsável pelo bem", type: "text", max: 150, hideInList: true },
    { name: "notes", label: "Observações", type: "textarea", max: 2000, wide: true, hideInList: true }
  ],
  search: ["tombamento", "description", "location", "responsible", "department_key"],
  orderBy: "r.tombamento",
  filters: [{ name: "condition", label: "Situação do bem" }, { name: "department_key", label: "Departamento" }],
  attachments: { ownerType: "patrimony_asset", kinds: [PHOTO_KIND("Foto do bem"), DOC_KIND("invoice", "Nota fiscal")], maxPerRecord: 20 }
};
