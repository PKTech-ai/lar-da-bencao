/** Situação do acesso de cada conta na lista de Usuários. Módulo puro (servidor e tela). */

/** Domínio dos e-mails de mentira das contas que entram com o CPF (ver `accessEmailForCpf`). */
export const CPF_ACCESS_DOMAIN = "@acesso.lardabencao.org";

export type AccessTone = "ready" | "building" | "danger";

export type AccessSituationInput = {
  status: string;
  access_allowed: boolean;
  must_reset_password: boolean;
  last_access: string | null;
};

const BR_DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/** "Nunca entrou" ou "Último acesso em dd/mm/aaaa" (no horário de Brasília). */
export function lastAccessText(lastAccess: string | null) {
  if (!lastAccess) return "Nunca entrou";
  const date = new Date(lastAccess);
  return Number.isNaN(date.getTime()) ? "Nunca entrou" : `Último acesso em ${BR_DATE.format(date)}`;
}

/**
 * Se a pessoa consegue entrar hoje. Quem nunca entrou também tem a troca obrigatória (senha inicial é o CPF),
 * então "Aguardando nova senha" só aparece para quem já entrou e teve a senha recadastrada.
 */
export function accessState(user: AccessSituationInput): { label: string; tone: AccessTone } {
  if (user.status === "suspended") return { label: "Suspenso", tone: "danger" };
  if (user.status !== "active") return { label: "Pendente", tone: "building" };
  if (!user.access_allowed) return { label: "Fora do biênio", tone: "danger" };
  if (user.must_reset_password && user.last_access) return { label: "Aguardando nova senha", tone: "building" };
  return { label: "Acesso liberado", tone: "ready" };
}

/** O que pede atenção do Administrador vai para o alto da lista. */
export function needsAttention(user: AccessSituationInput) {
  return accessState(user).tone === "danger" || user.status !== "active";
}

/** Último acesso: o mais recente entre o login no provedor e o registrado no Dedo-duro. */
export function latestAccess(...dates: (string | Date | null | undefined)[]) {
  let best: number | null = null;
  for (const value of dates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isNaN(time) && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}
