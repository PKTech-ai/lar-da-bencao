/**
 * Culto no Lar, Planejamento de Treinamentos e Caravana no Lar — regras do mock v215 (lógica pura).
 */
import { monthDays } from "@/lib/doutrina-scale";

/* ---------------- Culto no Lar ---------------- */

export function penultimateSaturday(ym: string) {
  const saturdays = monthDays(ym, 6);
  const day = saturdays.length >= 2 ? saturdays[saturdays.length - 2] : saturdays[0];
  return `${ym}-${String(day).padStart(2, "0")}`;
}

export const CULTO_LEADER_FUNCTIONS = ["Dirigente de Estudo", "Dirigente de Reunião", "Dirigente de Palestra"] as const;
export const CULTO_SPEAKER_FUNCTIONS = ["Expositor de Estudo", "Palestrante"] as const;

export type CultoRole = "requester" | "leader" | "speaker";

export function cultoEligible(role: CultoRole, functions: readonly string[]) {
  if (role === "leader") return functions.some((f) => (CULTO_LEADER_FUNCTIONS as readonly string[]).includes(f));
  if (role === "speaker") return functions.some((f) => (CULTO_SPEAKER_FUNCTIONS as readonly string[]).includes(f));
  return true;
}

export function cultoStatus(c: { house: string; leader_id: string | null; speaker_id: string | null; deleted_at?: string | Date | null }) {
  if (c.deleted_at) return "Escala excluída";
  return c.house && c.leader_id && c.speaker_id ? "Escala definida" : "Aguardando definição pela Doutrina";
}

export const CULTO_PURPOSE =
  "O Culto no Lar dos Trabalhadores é um encontro fraterno realizado no lar de um companheiro da Casa, com o propósito de confraternizar, acolher e estreitar os laços de amizade e união entre os trabalhadores. Em ambiente simples de prece, estudo e convivência, buscamos fortalecer o sentimento de família espiritual, a compreensão mútua e a alegria de servir juntos na seara do Cristo.";

/* ---------------- Planejamento de Treinamentos ---------------- */

export const TRAINING_STATES = ["Planejado", "Em andamento", "Concluído", "Cancelado"] as const;
export type TrainingState = (typeof TRAINING_STATES)[number];

export const TRAINING_CATALOG = [
  { key: "recepcao", title: "Treinamento de Recepção e Entrevista", objective: "Preparar os trabalhadores para o acolhimento, a recepção e a entrevista, conforme as orientações da Casa.", audience: "Trabalhadores da recepção e da entrevista" },
  { key: "passista", title: "Treinamento para Passista", objective: "Organizar o estudo e a preparação dos trabalhadores para a atividade de passes, conforme o programa doutrinário da Casa.", audience: "Trabalhadores da atividade de passes" },
  { key: "palestrante", title: "Treinamento para Palestrante", objective: "Desenvolver a preparação de temas, a organização da exposição e a comunicação nas palestras doutrinárias.", audience: "Palestrantes e trabalhadores em preparação" },
  { key: "mediunica", title: "Treinamento para Dirigente e Dialogador de Reunião Mediúnica", objective: "Preparar dirigentes e dialogadores para suas funções e para a organização das reuniões mediúnicas.", audience: "Dirigentes e dialogadores de reuniões mediúnicas" },
  { key: "ese", title: "Treinamento para Dirigente e Expositor do ESE", objective: "Preparar dirigentes e expositores para conduzir os estudos do Evangelho Segundo o Espiritismo.", audience: "Dirigentes e expositores do ESE" },
  { key: "obsessao", title: "Treinamento de Obsessão e Desobsessão", objective: "Estudar os temas da obsessão e desobsessão conforme o programa doutrinário e as orientações da Casa.", audience: "Trabalhadores indicados para o treinamento" }
] as const;

export type TrainingSession = { date: string; start: string; end: string; topic: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === date;
}

/** Valida encontros do ano (mensagens do mock). Retorna a primeira falha ou null. */
export function validateSessions(sessions: readonly TrainingSession[], year: number): string | null {
  const seen = new Set<string>();
  for (const [index, s] of sessions.entries()) {
    const n = index + 1;
    if (!isValidIsoDate(s.date) || Number(s.date.slice(0, 4)) !== year) return `Encontro ${n}: escolha uma data válida em ${year}.`;
    if ([s.start, s.end].some((t) => t && !TIME.test(t))) return `Encontro ${n}: informe um horário válido.`;
    if (s.end && !s.start) return `Encontro ${n}: informe o horário de início antes do término.`;
    if (s.start && s.end && s.end <= s.start) return `Encontro ${n}: o término deve ser posterior ao início, no mesmo dia.`;
    const key = `${s.date}|${s.start}`;
    if (seen.has(key)) return `Encontro ${n}: esta data e horário já estão cadastrados neste treinamento.`;
    seen.add(key);
  }
  return null;
}

export type TrainingInput = {
  title: string; status: TrainingState; participant_count: number | null; completed_at: string | null;
};

export function validateTraining(t: TrainingInput, year: number, sessionCount: number, today: string): string | null {
  if (!t.title.trim()) return "Informe o nome do treinamento.";
  if (!TRAINING_STATES.includes(t.status)) return "Selecione uma situação válida.";
  if (t.status === "Em andamento" && !sessionCount) return "Agende ao menos uma data antes de marcar o treinamento como em andamento.";
  if (t.status === "Concluído") {
    if (t.participant_count === null || !Number.isSafeInteger(t.participant_count) || t.participant_count < 0) {
      return "Informe a quantidade de participantes como um número inteiro, igual ou maior que zero.";
    }
    if (!t.completed_at || !isValidIsoDate(t.completed_at) || Number(t.completed_at.slice(0, 4)) !== year || t.completed_at > today) {
      return `Informe uma data de conclusão válida em ${year}, até a data de hoje.`;
    }
  }
  return null;
}

/** Rótulo exibido: planejado vira “A agendar” ou “Agendado” conforme os encontros. */
export function trainingStateLabel(status: string, sessionCount: number) {
  if (status && status !== "Planejado") return status;
  return sessionCount ? "Agendado" : "A agendar";
}

export type TrainingForReport = {
  id: string; year: number; title: string; responsible: string; location: string; status: string;
  completed_at: string | null; participant_count: number | null; sessions: { date: string }[];
};

/**
 * Relatório anual (mock `annualData`): cada treinamento concluído conta uma vez, no mês da conclusão;
 * participantes não são multiplicados pelos encontros.
 */
export function trainingAnnualData(trainings: readonly TrainingForReport[], months: readonly string[], today: string) {
  const requested = new Set(months);
  const years = new Set(months.map((m) => Number(m.slice(0, 4))));
  const completed: (TrainingForReport & { dates: string[] })[] = [];
  const scheduled: (TrainingForReport & { dates: string[] })[] = [];
  const pendingDates: TrainingForReport[] = [];
  for (const t of trainings) {
    const dates = t.sessions.map((s) => s.date).filter((d) => requested.has(d.slice(0, 7))).sort();
    if (t.status === "Concluído") {
      if (!t.completed_at || t.completed_at > today) {
        if (years.has(t.year)) pendingDates.push(t);
      } else if (requested.has(t.completed_at.slice(0, 7))) completed.push({ ...t, dates });
      else if (dates.length) scheduled.push({ ...t, dates });
    } else if (t.status !== "Cancelado" && dates.length) scheduled.push({ ...t, dates });
  }
  completed.sort((a, b) => a.completed_at!.localeCompare(b.completed_at!) || a.title.localeCompare(b.title, "pt-BR"));
  scheduled.sort((a, b) => (a.dates[0] ?? "").localeCompare(b.dates[0] ?? "") || a.title.localeCompare(b.title, "pt-BR"));
  return {
    completed,
    scheduled,
    pendingDates,
    participations: completed.reduce((sum, t) => sum + (t.participant_count ?? 0), 0),
    missingCounts: completed.filter((t) => t.participant_count === null).length
  };
}

/* ---------------- Agenda .ics ---------------- */

const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\;").replace(/,/g, "\\,");
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) { result += "\r\n "; size = 1; }
    result += char;
    size += bytes;
  }
  return result;
}

/** Horário “de parede” com TZID America/Sao_Paulo; encontro sem horário vira evento de dia inteiro. */
export function agendaIcs(events: readonly { uid: string; title: string; date: string; start: string; end: string; description: string; location: string }[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lar da Bencao//Treinamentos Doutrina//PT-BR", "CALSCALE:GREGORIAN"];
  const stamp = utcStamp(now);
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@lar-da-bencao`, `DTSTAMP:${stamp}`, `SUMMARY:${icsText(e.title)}`);
    const compact = e.date.replaceAll("-", "");
    if (e.start) {
      lines.push(`DTSTART;TZID=America/Sao_Paulo:${compact}T${e.start.replace(":", "")}00`);
      if (e.end) lines.push(`DTEND;TZID=America/Sao_Paulo:${compact}T${e.end.replace(":", "")}00`);
    } else {
      const next = new Date(`${e.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${compact}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll("-", "")}`);
    }
    lines.push(`DESCRIPTION:${icsText(e.description)}`, `LOCATION:${icsText(e.location)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/* ---------------- Caravana no Lar ---------------- */

export const CARAVANA_STATES = ["Planejada", "Realizada", "Cancelada"] as const;

export type CaravanaInput = { title: string; activity_date: string; responsible: string; status: string; participants: number | null };

export function validateCaravana(c: CaravanaInput, today: string): string | null {
  if (!c.title.trim() || !c.responsible.trim()) return "Informe a atividade e o responsável.";
  if (!isValidIsoDate(c.activity_date)) return "Informe uma data válida.";
  if (!(CARAVANA_STATES as readonly string[]).includes(c.status)) return "Selecione uma situação válida.";
  if (c.status === "Realizada" && c.activity_date > today) return "Uma atividade realizada não pode ter data futura.";
  if (c.participants !== null && (!Number.isSafeInteger(c.participants) || c.participants < 0 || c.participants > 1_000_000)) {
    return "Informe uma quantidade inteira de participantes.";
  }
  if (c.status === "Realizada" && c.participants === null) return "Informe a quantidade de participantes da atividade realizada.";
  return null;
}
