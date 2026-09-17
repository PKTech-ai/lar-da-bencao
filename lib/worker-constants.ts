/** Constantes da ficha de trabalhador compartilhadas entre servidor e cliente (sem dependências de banco). */
export const DOCTRINE_FUNCTIONS = [
  "Passista", "Psicofônico", "Dialogador", "Dirigente de Reunião", "Dirigente de Estudo",
  "Expositor de Estudo", "Palestrante", "Dirigente de Palestra", "Entrevistador", "Recepcionista"
] as const;

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export type WorkerStatus = "pending" | "active" | "inactive" | "rejected";

export const workerStatusLabel: Record<WorkerStatus, string> = {
  pending: "Pendente — aguardando Diretoria",
  active: "Aprovado — ativo",
  inactive: "Aprovado — inativo",
  rejected: "Reprovado"
};

export const workerStatusTone: Record<WorkerStatus, string> = {
  pending: "building",
  active: "ready",
  inactive: "",
  rejected: "danger"
};
