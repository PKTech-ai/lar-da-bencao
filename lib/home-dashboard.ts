export type AgendaItem = { date: string; label: string; module: string; href: string };
export type PendingItem = { key: string; label: string; count: number; href: string; hint?: string };
export type HomeStat = { key: string; label: string; value: string; hint: string; icon: "calendar" | "check" | "people" | "org"; pending?: boolean };

const SKIP = new Set(["da", "de", "do", "das", "dos"]);

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function filterAgenda(items: AgendaItem[], today: string, periodDays: 0 | 7 | 30) {
  const end = addDays(today, periodDays);
  return items.filter((item) => item.date >= today && item.date <= end).slice(0, 6);
}

export function buildHomeStats(input: { today: string; moduleCount: number; agenda: AgendaItem[]; pending: PendingItem[] }): HomeStat[] {
  const todayCount = input.agenda.filter((item) => item.date === input.today).length;
  const pendingSum = input.pending.reduce((sum, item) => sum + item.count, 0);
  const events = input.agenda.filter((item) => item.module === "Eventos").length;
  return [
    { key: "agenda", label: "Na agenda de hoje", value: String(todayCount), hint: "Atividades programadas com data", icon: "calendar" },
    { key: "pending", label: "Pendências para acompanhar", value: String(pendingSum), hint: "Nos módulos liberados para seu perfil", icon: "check", pending: true },
    { key: "events", label: "Próximos eventos", value: String(events), hint: "Eventos futuros com data definida", icon: "people" },
    { key: "modules", label: "Módulos disponíveis", value: String(input.moduleCount), hint: "Conforme seu cadastro de acesso", icon: "org" }
  ];
}

export function sessionInitials(name: string) {
  return name.split(/\s+/).filter((part) => part && !SKIP.has(part.toLocaleLowerCase("pt-BR"))).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function sessionShowsRole(name: string, roleLabel: string) {
  const norm = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
  return norm(name) !== norm(roleLabel);
}

export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
