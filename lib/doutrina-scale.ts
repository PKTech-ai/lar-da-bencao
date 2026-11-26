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

/**
 * Dia sem escala, escolhido data a data na tela: recesso (a casa não abre) ou um evento da casa que toma o lugar das
 * atividades do dia. Em todos, ninguém é escalado (nem os fixos) na data inteira, e a folha mostra o nome do dia.
 * O banco aceita só estas chaves (migração 202611251800_escala_dia_especial.sql).
 */
export const RECESS_KINDS = {
  recesso: { sheet: "RECESSO", option: "Recesso (a casa não abre)", short: "recesso" },
  encerramento_evangelizacao: { sheet: "ENCERRAMENTO DA EVANGELIZAÇÃO", option: "Encerramento da Evangelização", short: "encerramento da evangelização" },
  confraternizacao: { sheet: "CONFRATERNIZAÇÃO DOS TRABALHADORES — CAFÉ DA MANHÃ", option: "Confraternização dos trabalhadores — café da manhã", short: "confraternização" }
} as const;
export type RecessKind = keyof typeof RECESS_KINDS;
export const RECESS_KIND_KEYS = Object.keys(RECESS_KINDS) as [RecessKind, ...RecessKind[]];

/** Dia sem escala gravado: data `AAAA-MM-DD` e o tipo. */
export type RecessDay = { date: string; kind: RecessKind };

/** Dias sem escala do mês → números dos dias. */
export function recessSet(ym: string, days: readonly RecessDay[]) {
  return new Set(days.filter((d) => d.date.slice(0, 7) === ym).map((d) => Number(d.date.slice(8, 10))));
}

/** Dias sem escala do mês → tipo de cada dia (para o nome na folha). */
export function recessKinds(ym: string, days: readonly RecessDay[]) {
  return new Map(days.filter((d) => d.date.slice(0, 7) === ym).map((d) => [Number(d.date.slice(8, 10)), d.kind] as const));
}

export type ScaleWorker = { id: string; name: string; functions: readonly string[]; days: readonly number[] };
export type ScaleSpeaker = { id: string; name: string };
export type ScaleStudy = { id: string; type: string; code: string; title: string };
export type Slot = { dow: number; si: number; ri: number; day: number; pos: number };

export const FREE_THEME = "free:Tema Livre";

/**
 * Tema da palestra pública digitado na tela (`txt:<texto>`). O banco aceita o mesmo formato
 * (migração 202611261200_tema_palestra.sql): até THEME_MAX caracteres, sem quebra de linha.
 */
export const TYPED_THEME = "txt:";
export const THEME_MAX = 120;

/** Texto digitado → valor gravado (`txt:...`), ou null quando curto, longo demais ou com caractere de controle. */
export function typedThemeValue(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > THEME_MAX || /[\u0000-\u001f\u007f]/.test(clean)) return null;
  return `${TYPED_THEME}${clean}`;
}

/** Texto de um tema digitado; null para os demais valores. */
export function typedThemeText(value: string) {
  return value.startsWith(TYPED_THEME) ? value.slice(TYPED_THEME.length) : null;
}

/** Nome na folha dos temas que não vêm do cadastro de estudos (tema livre e tema digitado). */
export function themeLabel(value: string) {
  if (value === FREE_THEME) return "TEMA LIVRE";
  return typedThemeText(value);
}

/** Na palestra pública o tema pode vir dos temas de palestra ou dos roteiros do ESE. */
export function themeStudyTypes(section: Pick<Section, "s">): readonly string[] {
  return section.s === "PALESTRA" ? ["PALESTRA", "ESE"] : section.s ? [section.s] : [];
}

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

const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Segunda-feira da semana (segunda a domingo) de uma data AAAA-MM-DD, mesmo quando a semana vira o mês ou o ano. */
export function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Da segunda da primeira semana ao domingo da última semana que tocam o mês. */
export function monthWeekRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = new Date(`${weekStart(slotDate(ym, lastDay))}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from: weekStart(`${ym}-01`), to: end.toISOString().slice(0, 10) };
}

export function roleOf(slot: Pick<Slot, "dow" | "si" | "ri">) {
  const section = TEMPLATES[slot.dow][slot.si];
  const row = section.r[slot.ri];
  return { section, label: row[0], type: row[1], min: row[2] };
}

/**
 * RN-ESC-001 — exclusividade semanal: psicofônico das reuniões mediúnicas de quarta e de sexta.
 * As demais funções (e a psicofonia de segunda e domingo) não entram nesta regra.
 * O banco repete a regra pelo rótulo "→ PSICOF." (migração 202611251200_psicofonico_semana.sql).
 */
export function isWeeklyPsych(slot: Pick<Slot, "dow" | "si" | "ri">) {
  return (slot.dow === 3 || slot.dow === 5) && roleOf(slot).type === "Psicofônico";
}

const WEEKDAY: Record<number, string> = { 3: "quarta-feira", 5: "sexta-feira" };

/** Mensagem da regra, com o dia da reunião em que o médium já está. Texto igual ao do banco. */
export function psychWeekMessage(bookedDate: string) {
  return `Este médium já está escalado como psicofônico na ${WEEKDAY[dowOf(bookedDate)] ?? "quarta-feira/sexta-feira"} desta semana. `
    + "Sua inclusão na outra reunião mediúnica não será permitida, respeitando o período destinado ao estudo e ao aperfeiçoamento doutrinário.";
}

/** Psicofônico de quarta ou sexta já escalado. `key` só existe para posições da escala aberta (as dos meses vizinhos vêm sem). */
export type PsychBooking = { date: string; workerId: string; key?: string };

/** Psicofônicos de quarta e sexta da escala do mês. */
export function psychBookings(ym: string, assignments: ReadonlyMap<string, string>): PsychBooking[] {
  const list: PsychBooking[] = [];
  for (const [key, value] of assignments) {
    if (!value.startsWith("w:")) continue;
    const slot = parseSlotKey(key);
    if (slot && isWeeklyPsych(slot)) list.push({ date: slotDate(ym, slot.day), workerId: value.slice(2), key });
  }
  return list;
}

export type ScaleContext = { assignments: ReadonlyMap<string, string>; outside?: readonly PsychBooking[] };

/** Índice da escala para consultar disponibilidade muitas vezes (a tela calcula para cada nome de cada posição). */
export type AvailabilityIndex = { sameDay: Map<string, string[]>; weekPsych: Map<string, PsychBooking[]> };

export function availabilityIndex(ym: string, context: ScaleContext): AvailabilityIndex {
  const sameDay = new Map<string, string[]>();
  for (const [key, value] of context.assignments) {
    const slot = value.startsWith("w:") ? parseSlotKey(key) : null;
    if (!slot) continue;
    const id = `${slot.dow}|${slot.day}|${value}`;
    if (!sameDay.has(id)) sameDay.set(id, []);
    sameDay.get(id)!.push(key);
  }
  const weekPsych = new Map<string, PsychBooking[]>();
  for (const booking of [...psychBookings(ym, context.assignments), ...(context.outside ?? [])]) {
    const id = `${booking.workerId}|${weekStart(booking.date)}`;
    if (!weekPsych.has(id)) weekPsych.set(id, []);
    weekPsych.get(id)!.push(booking);
  }
  return { sameDay, weekPsych };
}

/** Onde a pessoa já é psicofônica (quarta ou sexta) na semana da posição, em outra data. Vale para qualquer função. */
export function psychInWeek(ym: string, slot: Slot, workerId: string, context: ScaleContext,
  index: AvailabilityIndex = availabilityIndex(ym, context)): PsychBooking | null {
  const self = slotKey(slot);
  const date = slotDate(ym, slot.day);
  return (index.weekPsych.get(`${workerId}|${weekStart(date)}`) ?? [])
    .filter((b) => b.key !== self && b.date !== date)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/** Verde: disponível. Azul: já é psicofônico na quarta ou sexta da semana. Vermelho: já escalado em outra função na data. */
export type Availability = { color: "green" | "blue" | "red"; blocked: boolean; note: string; message: string };

/** Folhas em que a RN-ESC-001 aparece (quarta e sexta). Nos outros dias (domingo, segunda...) o médium é escalado só pela ficha. */
export function psychRuleDay(dow: number) {
  return dow === 3 || dow === 5;
}

/**
 * Disponibilidade de um trabalhador para uma posição, olhando a escala aberta e os meses vizinhos.
 * Bloqueia duas funções na mesma data (qualquer atividade) e o psicofônico na quarta e na sexta da mesma semana.
 * Nas demais funções da quarta e da sexta o azul só informa; nos outros dias não há azul.
 */
export function slotAvailability(ym: string, slot: Slot, workerId: string, context: ScaleContext,
  index: AvailabilityIndex = availabilityIndex(ym, context)): Availability {
  const self = slotKey(slot);
  const busy = (index.sameDay.get(`${slot.dow}|${slot.day}|w:${workerId}`) ?? []).find((key) => key !== self);
  if (busy) {
    const role = roleOf(parseSlotKey(busy)!);
    const where = `${role.section.n} → ${role.label}`;
    return {
      color: "red", blocked: true, note: `já escalado em ${where} neste dia`,
      message: `Este trabalhador já está escalado em ${where} nesta data. Ninguém exerce duas funções na mesma data: tire-o de lá antes.`
    };
  }
  const booked = psychRuleDay(slot.dow) ? psychInWeek(ym, slot, workerId, context, index) : null;
  if (booked) {
    const info = `psicofônico em ${shortDate(booked.date)} (${DAY_NAME[dowOf(booked.date)]}) · MEDIÚNICA → PSICOF.`;
    if (isWeeklyPsych(slot)) return { color: "blue", blocked: true, note: info, message: psychWeekMessage(booked.date) };
    return { color: "blue", blocked: false, note: info, message: `Já escalado nesta semana como ${info}` };
  }
  return { color: "green", blocked: false, note: "", message: "" };
}

/** Extras manuais: passistas só na linha PASSISTAS do Grupo do Passe; recepcionistas e psicofônicos sempre. */
export function canAddExtra(slot: Pick<Slot, "dow" | "si" | "ri">) {
  const { section, label, type } = roleOf(slot);
  if (type === "Passista") return /GRUPO DO PASSE/i.test(section.n) && /PASSISTAS/i.test(label);
  return type === "Recepcionista" || type === "Psicofônico";
}

/** Posição além do mínimo do modelo: só existe como adicional. */
export function isExtraPosition(slot: Pick<Slot, "dow" | "si" | "ri" | "pos">) {
  return slot.pos >= roleOf(slot).min;
}

const eligible = (w: ScaleWorker, type: string, dow: number) => w.functions.includes(type) && w.days.includes(dow);

/** Posição fixa: a mesma função de uma atividade em todas as semanas (`dia-da-semana|seção|linha|posição`). */
export type FixedPattern = Pick<Slot, "dow" | "si" | "ri" | "pos">;

export function fixedKey(p: FixedPattern) {
  return `${p.dow}|${p.si}|${p.ri}|${p.pos}`;
}

export function parseFixedKey(key: string): FixedPattern | null {
  const parts = key.split("|");
  if (parts.length !== 4) return null;
  const slot = parseSlotKey(`${parts[0]}|${parts[1]}|${parts[2]}|1|${parts[3]}`);
  return slot ? { dow: slot.dow, si: slot.si, ri: slot.ri, pos: slot.pos } : null;
}

/**
 * Regras para marcar um fixo (puras): só trabalhador, posição prevista no modelo, com a função e o dia na ficha,
 * uma função fixa por dia e, pela RN-ESC-001, nunca psicofônico fixo na quarta e na sexta ao mesmo tempo.
 */
export function validateFixed(pattern: FixedPattern, worker: ScaleWorker | undefined, current: ReadonlyMap<string, string>): string | null {
  const row = TEMPLATES[pattern.dow]?.[pattern.si]?.r[pattern.ri];
  // Além do mínimo do modelo, só onde a função aceita adicional (recepção, passistas do Grupo do Passe, psicofônicos).
  if (!row || pattern.pos > 40 || (pattern.pos >= row[2] && !canAddExtra(pattern))) return "Posição inválida para trabalhador fixo.";
  const type = row[1] === "SPEAKER" ? "Palestrante" : row[1];
  if (type === "STUDY") return "Tema e roteiro não podem ser fixos.";
  if (!worker) return "Trabalhador sem aprovação da Diretoria ou fora da Doutrina.";
  if (!worker.functions.includes(type)) return `${worker.name} não tem a função ${type} na ficha.`;
  if (row[1] !== "SPEAKER" && !worker.days.includes(pattern.dow)) return `${worker.name} não marcou ${DAY_NAME[pattern.dow].toLowerCase()} como dia disponível.`;
  for (const [key, id] of current) {
    if (id !== worker.id || key === fixedKey(pattern)) continue;
    const other = parseFixedKey(key);
    if (!other) continue;
    if (other.dow === pattern.dow) return `${worker.name} já está fixo em ${TEMPLATES[other.dow][other.si].n} neste dia.`;
    if (isWeeklyPsych(pattern) && isWeeklyPsych(other)) {
      return `${worker.name} já é fixo como psicofônico na ${WEEKDAY[other.dow]}. `
        + "Sua inclusão na outra reunião mediúnica não será permitida, respeitando o período destinado ao estudo e ao aperfeiçoamento doutrinário.";
    }
  }
  return null;
}

/**
 * Fixos antigos da pessoa no mesmo dia que não estão valendo: a ficha já não permite (a geração os ignora)
 * ou ela não aparece nessa posição em nenhuma semana da escala aberta. Não impedem fixar em outra função: dão lugar ao novo.
 */
export function supersededFixed(pattern: FixedPattern, worker: ScaleWorker | undefined, current: ReadonlyMap<string, string>,
  sheet?: { ym: string; assignments: ReadonlyMap<string, string> }) {
  if (!worker) return [];
  return [...current].flatMap(([key, id]) => {
    const other = id === worker.id && key !== fixedKey(pattern) ? parseFixedKey(key) : null;
    if (!other || other.dow !== pattern.dow) return [];
    const onSheet = !sheet || monthDays(sheet.ym, other.dow).some((day) => sheet.assignments.get(slotKey({ ...other, day })) === `w:${worker.id}`);
    return validateFixed(other, worker, new Map()) || !onSheet ? [key] : [];
  });
}

/**
 * Gera a escala do mês. `fixed` (`dia-da-semana|seção|linha|posição` → trabalhador) entra primeiro em todas as
 * ocorrências e já conta na divisão do mês; o restante segue a regra de sempre. Sem fixos, o resultado é o mesmo de antes.
 * `outside`: psicofônicos de quarta e sexta dos meses vizinhos nas semanas que viram o mês (RN-ESC-001).
 * O fixo que cairia na outra reunião da semana em que a pessoa já é psicofônica fica de fora naquele dia.
 * `closed`: dias de recesso — as posições existem, vazias, e ninguém é escalado nem conta na divisão do mês.
 */
export function buildScale(ym: string, workers: readonly ScaleWorker[], speakers: readonly ScaleSpeaker[], studies: readonly ScaleStudy[],
  fixed: ReadonlyMap<string, string> = new Map(), outside: readonly PsychBooking[] = [], closed: Pick<ReadonlySet<number>, "has"> = new Set()) {
  const assignments = new Map<string, string>();
  const count = new Map<string, number>();
  const bump = (id: string) => count.set(id, (count.get(id) ?? 0) + 1);
  const ordered = (list: ScaleWorker[]) => list.sort((a, b) => (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  // Semana → quem já é psicofônico de quarta/sexta e em que data (deste mês e dos vizinhos).
  const psychWeek = new Map<string, Map<string, string>>();
  const book = (date: string, id: string) => {
    const week = weekStart(date);
    if (!psychWeek.has(week)) psychWeek.set(week, new Map());
    psychWeek.get(week)!.set(id, date);
  };
  const bookedElsewhere = (date: string, id: string) => {
    const other = psychWeek.get(weekStart(date))?.get(id);
    return other !== undefined && other !== date;
  };
  for (const b of outside) book(b.date, b.workerId);
  // Quem é fixo já "gastou" essas escalas: não é puxado para outras vagas antes dos demais.
  const fixedPatterns = [...fixed]
    .map(([key, id]) => ({ pattern: parseFixedKey(key), id }))
    .filter((f): f is { pattern: FixedPattern; id: string } => f.pattern !== null)
    .sort((a, b) => a.pattern.si - b.pattern.si || a.pattern.ri - b.pattern.ri || a.pattern.pos - b.pattern.pos);
  for (const { pattern, id } of fixedPatterns) monthDays(ym, pattern.dow).filter((day) => !closed.has(day)).forEach(() => bump(id));
  // Psicofônico fixo na sexta não é sorteado para a quarta (e vice-versa): a quarta é preenchida antes da sexta.
  const fixedPsych = new Map<number, Set<string>>([[3, new Set()], [5, new Set()]]);
  for (const { pattern, id } of fixedPatterns) if (isWeeklyPsych(pattern)) fixedPsych.get(pattern.dow)!.add(id);

  for (const dow of [0, 1, 3, 4, 5, 6]) {
    for (const day of monthDays(ym, dow)) {
      if (closed.has(day)) {
        TEMPLATES[dow].forEach((section, si) => section.r.forEach(([, , min], ri) => {
          for (let pos = 0; pos < min; pos += 1) assignments.set(slotKey({ dow, si, ri, day, pos }), "");
        }));
        continue;
      }
      const used = new Set<string>();
      const date = slotDate(ym, day);
      // Fixos primeiro, inclusive os de posição adicional.
      for (const { pattern, id } of fixedPatterns) {
        if (pattern.dow !== dow || used.has(id)) continue;
        const psych = isWeeklyPsych(pattern);
        if (psych && bookedElsewhere(date, id)) continue;
        assignments.set(slotKey({ ...pattern, day }), `w:${id}`);
        used.add(id);
        if (psych) book(date, id);
      }
      TEMPLATES[dow].forEach((section, si) => {
        section.r.forEach(([, type, min], ri) => {
          for (let pos = 0; pos < min; pos += 1) {
            const key = slotKey({ dow, si, ri, day, pos });
            if (assignments.has(key)) continue;
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
            const psych = isWeeklyPsych({ dow, si, ri });
            // A outra reunião da semana em recesso não tem fixo para proteger.
            const pairFixed = psych && !closed.has(dow === 3 ? day + 2 : day - 2) ? fixedPsych.get(dow === 3 ? 5 : 3)! : new Set<string>();
            const pool = workers.filter((w) => eligible(w, type, dow) && !used.has(w.id)
              && !(psych && (bookedElsewhere(date, w.id) || pairFixed.has(w.id))));
            const chosen = ordered(pool)[0];
            if (!chosen) {
              assignments.set(key, "");
              continue;
            }
            assignments.set(key, `w:${chosen.id}`);
            used.add(chosen.id);
            bump(chosen.id);
            if (psych) book(date, chosen.id);
          }
        });
      });
    }
  }
  return assignments;
}

/** `same_day`: duas funções na mesma data. `psych_week`: psicofônico na quarta e na sexta da mesma semana (`outsideDates`: datas de meses vizinhos). */
export type Conflict = { id: string; type: "same_day" | "psych_week"; workerId: string; keys: string[]; outsideDates?: string[] };

export function findConflicts(assignments: ReadonlyMap<string, string>, ym?: string, outside: readonly PsychBooking[] = []): Conflict[] {
  const conflicts: Conflict[] = [];
  const sameDay = new Map<string, string[]>();
  for (const [key, value] of assignments) {
    if (!value.startsWith("w:")) continue;
    const slot = parseSlotKey(key);
    if (!slot) continue;
    const group = `${slot.dow}|${slot.day}|${value}`;
    sameDay.set(group, [...(sameDay.get(group) ?? []), key]);
  }
  for (const [group, keys] of sameDay) {
    if (keys.length > 1) conflicts.push({ id: `same:${keys.sort().join(":")}`, type: "same_day", workerId: group.split("|")[2].slice(2), keys });
  }
  if (!ym) return conflicts;
  const weeks = new Map<string, PsychBooking[]>();
  for (const booking of [...psychBookings(ym, assignments), ...outside]) {
    const group = `${booking.workerId}|${weekStart(booking.date)}`;
    weeks.set(group, [...(weeks.get(group) ?? []), booking]);
  }
  for (const [group, list] of weeks) {
    const keys = list.flatMap((b) => (b.key ? [b.key] : [])).sort();
    if (!keys.length || new Set(list.map((b) => b.date)).size < 2) continue;
    const outsideDates = list.filter((b) => !b.key).map((b) => b.date).sort();
    conflicts.push({ id: `psych:${group}`, type: "psych_week", workerId: group.split("|")[0], keys, ...(outsideDates.length ? { outsideDates } : {}) });
  }
  return conflicts;
}

/** Número do estudo pelo código ("ROT. 070" → 70); sem número, não há sequência. */
const studyNumber = (study: ScaleStudy) => {
  const match = study.code.match(/\d+/);
  return match ? Number(match[0]) : null;
};

/** Estudos que vêm depois do escolhido, pela numeração (ROT. 070 → 071, 072…), para os próximos dias da mesma linha. */
export function studySequence(studies: readonly ScaleStudy[], chosenId: string, count: number): ScaleStudy[] {
  const chosen = studies.find((s) => s.id === chosenId);
  const start = chosen ? studyNumber(chosen) : null;
  if (!chosen || start === null || chosen.type === "PALESTRA") return [];
  const next: ScaleStudy[] = [];
  let last = start;
  for (const study of studies.filter((s) => s.type === chosen.type && (studyNumber(s) ?? -1) > start).sort((a, b) => studyNumber(a)! - studyNumber(b)!)) {
    if (next.length >= count) break;
    if (studyNumber(study) === last) continue;
    next.push(study);
    last = studyNumber(study)!;
  }
  return next;
}

/**
 * Valida a pessoa ou o estudo de uma posição contra o modelo e a ficha (função, dia, aprovação).
 * Não olha o restante da escala: para a escolha manual use `validateSlotChoice`.
 */
export function validateSlotValue(
  slot: Slot,
  value: string,
  context: { assignments: ReadonlyMap<string, string>; workers: readonly ScaleWorker[]; speakers: readonly ScaleSpeaker[]; studies: readonly ScaleStudy[] }
): string | null {
  if (!value) return null;
  const { section, type } = roleOf(slot);
  if (type === "STUDY") {
    if (section.s === "PALESTRA") {
      if (value === FREE_THEME) return null;
      const text = typedThemeText(value);
      if (text !== null) return typedThemeValue(text) === value ? null : `Tema digitado inválido: use de 2 a ${THEME_MAX} caracteres.`;
    }
    const study = value.startsWith("t:") ? context.studies.find((s) => s.id === value.slice(2)) : undefined;
    return study && themeStudyTypes(section).includes(study.type) ? null : "Estudo incompatível com esta atividade.";
  }
  if (type === "SPEAKER") {
    if (value.startsWith("s:")) return context.speakers.some((s) => s.id === value.slice(2)) ? null : "Palestrante externo inativo ou inexistente.";
    const worker = value.startsWith("w:") ? context.workers.find((w) => w.id === value.slice(2)) : undefined;
    return worker?.functions.includes("Palestrante") ? null : "Trabalhador sem a função Palestrante ou sem aprovação.";
  }
  const worker = value.startsWith("w:") ? context.workers.find((w) => w.id === value.slice(2)) : undefined;
  if (!worker) return "Trabalhador sem aprovação da Diretoria ou fora da Doutrina.";
  if (!eligible(worker, type, slot.dow)) return `Trabalhador sem a função ${type} ou indisponível neste dia.`;
  return null;
}

/**
 * Escolha manual (inclusão, troca, substituição): ficha e modelo, mais a escala inteira e os meses vizinhos —
 * ninguém em duas funções na mesma data e nenhum psicofônico na quarta e na sexta da mesma semana (RN-ESC-001).
 */
export function validateSlotChoice(
  ym: string,
  slot: Slot,
  value: string,
  context: ScaleContext & { workers: readonly ScaleWorker[]; speakers: readonly ScaleSpeaker[]; studies: readonly ScaleStudy[] }
): string | null {
  const problem = validateSlotValue(slot, value, context);
  if (problem || !value.startsWith("w:")) return problem;
  const availability = slotAvailability(ym, slot, value.slice(2), context);
  return availability.blocked ? availability.message : null;
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
