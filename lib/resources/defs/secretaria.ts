import { DOC_KIND, type ResourceDef } from "@/lib/resources/types";

/** Reuniões e atas (mock `LarMeetings`): minuta digitada, áudio e documentos anexados. */
export const meetings: ResourceDef = {
  key: "secretaria-reunioes",
  table: "meetings",
  title: "Reuniões e Atas",
  singular: "Reunião",
  module: "Secretaria",
  section: "Reuniões e Atas",
  flag: "module_secretaria",
  scope: { resource: "secretaria" },
  intro: "Registro da reunião, minuta da ata e anexos. O áudio é gravado na aba “Gravador” e fica vinculado à reunião.",
  archiveLabel: "Arquivar",
  orderBy: "r.meeting_date desc, r.created_at desc",
  search: ["title", "place", "chair", "secretary", "participants", "decisions"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "title", label: "Título da reunião", type: "text", max: 200, required: true },
    { name: "meeting_date", label: "Data", type: "date", required: true },
    { name: "place", label: "Local", type: "text", max: 200 },
    { name: "chair", label: "Quem presidiu", type: "text", max: 160 },
    { name: "secretary", label: "Quem secretariou", type: "text", max: 160 },
    { name: "status", label: "Situação", type: "select", options: ["Rascunho", "Ata concluída"], required: true },
    { name: "participants", label: "Participantes", type: "textarea", max: 4000, wide: true, hideInList: true },
    { name: "agenda", label: "Pauta", type: "textarea", max: 4000, wide: true, hideInList: true },
    { name: "transcript", label: "Transcrição / anotações", type: "textarea", max: 100000, wide: true, hideInList: true },
    { name: "decisions", label: "Decisões", type: "textarea", max: 8000, wide: true, hideInList: true },
    { name: "minutes", label: "Minuta da ata", type: "textarea", max: 100000, wide: true, hideInList: true }
  ],
  attachments: { ownerType: "meeting_document", kinds: [DOC_KIND("minutes", "Ata assinada e documentos")], maxPerRecord: 10 }
};
