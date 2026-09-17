/**
 * Motor da escala mensal da Doutrina — porte fiel de `buildDoctrineScale`, `cf` e `opts` do mock v215.
 * Lógica pura: recebe cadastros e devolve posições; persistência fica nas rotas.
 */

export type RoleType =
  | "Dirigente de Reunião" | "Passista" | "Psicofônico" | "Recepcionista" | "Entrevistador"
  | "Dirigente de Estudo" | "Expositor de Estudo" | "Dirigente de Palestra" | "SPEAKER" | "STUDY";

export type StudyType = "ESE" | "ESDE" | "MEP" | "OBRA" | "PALESTRA";
export type Section = { n: string; s?: StudyType; r: [label: string, type: RoleType, min: number][] };

export const DOW_ORDER = [3, 4, 5, 6, 0, 1] as const;
export const DAY_NAME: Record<number, string> = { 0: "DOMINGO", 1: "SEGUNDA-FEIRA", 3: "QUARTA-FEIRA", 4: "QUINTA-FEIRA", 5: "SEXTA-FEIRA", 6: "SÁBADO" };
export const DAY_HOURS: Record<number, string> = { 0: "09:00 ÀS 10:00", 1: "19:00 ÀS 20:00", 3: "20:00 ÀS 21:00", 4: "19:30 ÀS 20:30", 5: "20:00 ÀS 21:00", 6: "17:00 ÀS 18:00" };

const ese = (n: string): Section => ({ n, s: "ESE", r: [["DIRIG.", "Dirigente de Estudo", 1], ["EXP.", "Expositor de Estudo", 1], ["ROT.", "STUDY", 1]] });
const mediunica: Section = { n: "MEDIÚNICA", r: [["DIRIG.", "Dirigente de Reunião", 1], ["PASSIT.", "Passista", 1], ["PSICOF.", "Psicofônico", 4]] };
const palestra: Section = { n: "PALESTRA PÚBLICA", s: "PALESTRA", r: [["DIRIG.", "Dirigente de Palestra", 1], ["PALESTR.", "SPEAKER", 1], ["TEMA", "STUDY", 1]] };
const passe: Section = { n: "GRUPO DO PASSE", r: [["COORD.", "Passista", 1], ["PASSISTAS", "Passista", 4]] };

export const TEMPLATES: Record<number, Section[]> = {
  1: [{ n: "MEDIÚNICA — FUNCIONAMENTO INTERNO", r: [["DIRIG.", "Dirigente de Reunião", 1], ["PASSISTA", "Passista", 1], ["PSICOF.", "Psicofônico", 4]] }],
  3: [
    { n: "RECEPÇÃO", r: [["RECEP.", "Recepcionista", 2]] },
    { n: "ENTREVISTA", r: [["ENTREV.", "Entrevistador", 2]] },
    ese("GRUPO ESE — G-1"), ese("GRUPO ESE — G-2"), ese("GRUPO ESE — G-3"),
    { n: "ESTUDO ESDE — G-1", s: "ESDE", r: [["DIRIG.", "Dirigente de Estudo", 1], ["EXP.", "Expositor de Estudo", 1], ["ESTUDO", "STUDY", 1]] },
    { n: "GRUPO DO PASSE", r: [["DIRIG.", "Dirigente de Estudo", 1], ["EXP.", "Expositor de Estudo", 1], ["PASSISTAS", "Passista", 4]] },
    mediunica
  ],
  4: [{ n: "ESTUDO DO MEP", s: "MEP", r: [["DIRIG.", "Dirigente de Estudo", 1], ["EXP.", "Expositor de Estudo", 1], ["ROTEIRO", "STUDY", 1]] }],
  5: [
    { n: "RECEPÇÃO", r: [["RECEP.", "Recepcionista", 2]] },
    palestra,
    { n: "ENTREVISTA", r: [["ENTREV.", "Entrevistador", 2]] },
    mediunica,
    passe
  ],
  6: [{ n: "ESTUDO DE OBRA", s: "OBRA", r: [["DIRIG.", "Dirigente de Estudo", 1], ["EXP.", "Expositor de Estudo", 1], ["ESTUDO", "STUDY", 1]] }],
  0: [palestra, mediunica, passe]
};

export type ScaleWorker = { id: string; name: string; functions: readonly string[]; days: readonly number[] };
export type ScaleSpeaker = { id: string; name: string };
export type ScaleStudy = { id: string; type: string; code: string; title: string };
export type Slot = { dow: number; si: number; ri: number; day: number; pos: number };

export const FREE_THEME = "free:Tema Livre";

export function slotKey(slot: Slot) {
  return `${slot.dow}|${slot.si}|${slot.ri}|${slot.day}|${slot.pos}`;
}

export function parseSlotKey(key: string): Slot | null {
  const parts = key.split("|").map(Number);
  if (parts.length !== 5 || parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const [dow, si, ri, day, pos] = parts;
  if (!TEMPLATES[dow]?.[si]?.r[ri] || day < 1 || day > 31 || pos > 40) return null;
  return { dow, si, ri, day, pos };
}

export function isValidMonth(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) && Number(ym.slice(0, 4)) >= 2020 && Number(ym.slice(0, 4)) <= 2100;
}

/** Dias do mês que caem no dia da semana informado. */
export function monthDays(ym: string, dow: number) {
  const [y, m] = ym.split("-").map(Number);
  const days: number[] = [];
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(y, m - 1, day));
    if (date.getUTCMonth() !== m - 1) break;
    if (date.getUTCDay() === dow) days.push(day);
  }
  return days;
}

export function slotDate(ym: string, day: number) {
  return `${ym}-${String(day).padStart(2, "0")}`;
}

/** Segunda-feira da semana do dia (chave da alternância quarta/sexta). */
function weekKey(ym: string, day: number) {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dow = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return date.toISOString().slice(0, 10);
}

export function roleOf(slot: Pick<Slot, "dow" | "si" | "ri">) {
  const section = TEMPLATES[slot.dow][slot.si];
  const row = section.r[slot.ri];
  return { section, label: row[0], type: row[1], min: row[2] };
}

/** Extras manuais: passistas só na linha PASSISTAS do Grupo do Passe; recepcionistas e psicofônicos sempre. */
export function canAddExtra(slot: Pick<Slot, "dow" | "si" | "ri">) {
  const { section, label, type } = roleOf(slot);
  if (type === "Passista") return /GRUPO DO PASSE/i.test(section.n) && /PASSISTAS/i.test(label);
  return type === "Recepcionista" || type === "Psicofônico";
}

const eligible = (w: ScaleWorker, type: string, dow: number) => w.functions.includes(type) && w.days.includes(dow);

export function buildScale(ym: string, workers: readonly ScaleWorker[], speakers: readonly ScaleSpeaker[], studies: readonly ScaleStudy[]) {
  const assignments = new Map<string, string>();
  const count = new Map<string, number>();
  const wednesdayPsych = new Map<string, Set<string>>();
  const bump = (id: string) => count.set(id, (count.get(id) ?? 0) + 1);
  const ordered = (list: ScaleWorker[]) => list.sort((a, b) => (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));

  for (const dow of [0, 1, 3, 4, 5, 6]) {
    for (const day of monthDays(ym, dow)) {
      const used = new Set<string>();
      const week = weekKey(ym, day);
      TEMPLATES[dow].forEach((section, si) => {
        section.r.forEach(([, type, min], ri) => {
          for (let pos = 0; pos < min; pos += 1) {
            const key = slotKey({ dow, si, ri, day, pos });
            if (type === "STUDY") {
              const pool = studies.filter((s) => s.type === section.s);
              assignments.set(key, pool.length ? `t:${pool[(day + si + ri) % pool.length].id}` : "");
              continue;
            }
            if (type === "SPEAKER") {
              const internal = ordered(workers.filter((w) => w.functions.includes("Palestrante") && !used.has(w.id)));
              if ((day + si) % 2 === 0 && speakers.length) {
                assignments.set(key, `s:${speakers[(day + si) % speakers.length].id}`);
              } else if (internal[0]) {
                assignments.set(key, `w:${internal[0].id}`);
                used.add(internal[0].id);
                bump(internal[0].id);
              } else {
                assignments.set(key, "");
              }
              continue;
            }
            let pool = workers.filter((w) => eligible(w, type, dow) && !used.has(w.id));
            if (type === "Psicofônico" && dow === 5) {
              const blocked = wednesdayPsych.get(week) ?? new Set<string>();
              pool = pool.filter((w) => !blocked.has(w.id));
            }
            const chosen = ordered(pool)[0];
            if (!chosen) {
              assignments.set(key, "");
              continue;
            }
            assignments.set(key, `w:${chosen.id}`);
            used.add(chosen.id);
            bump(chosen.id);
            if (type === "Psicofônico" && dow === 3) {
              if (!wednesdayPsych.has(week)) wednesdayPsych.set(week, new Set());
              wednesdayPsych.get(week)!.add(chosen.id);
            }
          }
        });
      });
    }
  }
  return assignments;
}

export type Conflict = { id: string; type: "same_day" | "psych_pair"; workerId: string; keys: string[] };

export function findConflicts(assignments: ReadonlyMap<string, string>): Conflict[] {
  const conflicts: Conflict[] = [];
  const sameDay = new Map<string, string[]>();
  const workerSlots: [Slot, string, string][] = [];
  for (const [key, value] of assignments) {
    if (!value.startsWith("w:")) continue;
    const slot = parseSlotKey(key);
    if (!slot) continue;
    workerSlots.push([slot, key, value]);
    const group = `${slot.dow}|${slot.day}|${value}`;
    sameDay.set(group, [...(sameDay.get(group) ?? []), key]);
  }
  for (const [group, keys] of sameDay) {
    if (keys.length > 1) conflicts.push({ id: `same:${keys.sort().join(":")}`, type: "same_day", workerId: group.split("|")[2].slice(2), keys });
  }
  for (const [a, keyA, value] of workerSlots) {
    if (a.dow !== 3 || roleOf(a).type !== "Psicofônico") continue;
    for (const [b, keyB, other] of workerSlots) {
      if (other === value && b.dow === 5 && b.day === a.day + 2 && roleOf(b).type === "Psicofônico") {
        conflicts.push({ id: `psych:${keyA}::${keyB}`, type: "psych_pair", workerId: value.slice(2), keys: [keyA, keyB] });
      }
    }
  }
  return conflicts;
}

/**
 * Valida a escolha manual de uma posição. Duplicidade no mesmo dia é permitida (aparece na conferência);
 * a folga quarta/sexta do psicofônico é bloqueada, como no mock.
 */
export function validateSlotValue(
  slot: Slot,
  value: string,
  context: { assignments: ReadonlyMap<string, string>; workers: readonly ScaleWorker[]; speakers: readonly ScaleSpeaker[]; studies: readonly ScaleStudy[] }
): string | null {
  if (!value) return null;
  const { section, type } = roleOf(slot);
  if (type === "STUDY") {
    if (value === FREE_THEME && section.s === "PALESTRA") return null;
    const study = value.startsWith("t:") ? context.studies.find((s) => s.id === value.slice(2)) : undefined;
    return study && study.type === section.s ? null : "Estudo incompatível com esta atividade.";
  }
  if (type === "SPEAKER") {
    if (value.startsWith("s:")) return context.speakers.some((s) => s.id === value.slice(2)) ? null : "Palestrante externo inativo ou inexistente.";
    const worker = value.startsWith("w:") ? context.workers.find((w) => w.id === value.slice(2)) : undefined;
    return worker?.functions.includes("Palestrante") ? null : "Trabalhador sem a função Palestrante ou sem aprovação.";
  }
  const worker = value.startsWith("w:") ? context.workers.find((w) => w.id === value.slice(2)) : undefined;
  if (!worker) return "Trabalhador sem aprovação da Diretoria ou fora da Doutrina.";
  if (!eligible(worker, type, slot.dow)) return `Trabalhador sem a função ${type} ou indisponível neste dia.`;
  if (type === "Psicofônico" && (slot.dow === 3 || slot.dow === 5)) {
    const pairDow = slot.dow === 3 ? 5 : 3;
    const pairDay = slot.dow === 3 ? slot.day + 2 : slot.day - 2;
    for (const [key, other] of context.assignments) {
      if (other !== value) continue;
      const b = parseSlotKey(key);
      if (b && b.dow === pairDow && b.day === pairDay && roleOf(b).type === "Psicofônico") {
        return "Folga obrigatória: o psicofônico trabalha na quarta ou na sexta da mesma semana, não nos dois dias.";
      }
    }
  }
  return null;
}

export type ScaleStatus = "generated" | "in_review" | "pending_issues" | "checked" | "approved" | "published" | "deleted";

export const scaleStatusLabel: Record<ScaleStatus, string> = {
  generated: "Gerada automaticamente",
  in_review: "Em conferência pela Doutrina",
  pending_issues: "Conferência com pendências",
  checked: "Conferida — sem conflitos",
  approved: "Aprovada",
  published: "Publicada",
  deleted: "Escala excluída"
};
