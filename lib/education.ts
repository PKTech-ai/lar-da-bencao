/**
 * Regras da evangelização (Infância e Juventude) — porte de classifyEvangelizando,
 * evangelizandoMatriculaStatus, CRONOGRAMA_GROUPS e PlanningRecess do mock v215. Lógica pura.
 */

export type EducationDepartment = "infancia" | "juventude";

export const EDUCATION_LABEL: Record<EducationDepartment, string> = { infancia: "Infância", juventude: "Juventude" };

export const GROUPS: Record<EducationDepartment, readonly { name: string; ages: string; min: number; max: number }[]> = {
  infancia: [
    { name: "Maternal", ages: "3 e 4 anos", min: 3, max: 4 },
    { name: "Jardim", ages: "5 e 6 anos", min: 5, max: 6 },
    { name: "1º Ciclo", ages: "7 e 8 anos", min: 7, max: 8 },
    { name: "2º Ciclo", ages: "9 e 10 anos", min: 9, max: 10 },
    { name: "3º Ciclo", ages: "11 e 12 anos", min: 11, max: 12 }
  ],
  juventude: [
    { name: "Pré-Juventude", ages: "13 e 14 anos", min: 13, max: 14 },
    { name: "Juventude", ages: "15 a 21 anos", min: 15, max: 21 }
  ]
};

export const EVANGELIZERS_PER_GROUP = 2;

export function isEducationDepartment(value: unknown): value is EducationDepartment {
  return value === "infancia" || value === "juventude";
}

export function groupNames(department: EducationDepartment) {
  return GROUPS[department].map((g) => g.name);
}

/** Idade completada até 30 de junho do ano de referência. */
export function ageAtJune30(birth: string | null | undefined, year: number) {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [y, m, d] = birth.split("-").map(Number);
  let age = year - y;
  if (m > 6 || (m === 6 && d > 30)) age -= 1;
  return age;
}

export function classify(birth: string | null | undefined, department: EducationDepartment, year: number) {
  const age = ageAtJune30(birth, year);
  if (age === null) return { age: null, group: "", valid: false, message: "Informe a data de nascimento para definir a turma." };
  const own = GROUPS[department].find((g) => age >= g.min && age <= g.max);
  if (own) {
    return { age, group: own.name, valid: true, message: `Enquadramento automático: ${own.name} — ${age} ano(s) em 30 de junho de ${year}.` };
  }
  const other = [...GROUPS.infancia, ...GROUPS.juventude].find((g) => age >= g.min && age <= g.max);
  return {
    age,
    group: other?.name ?? "Fora da faixa prevista no Regimento",
    valid: false,
    message: `A idade em 30 de junho de ${year} é ${age} ano(s), fora da faixa do Departamento da ${EDUCATION_LABEL[department]}.`
  };
}

/** Menor de 18 anos na data de hoje (exige responsável). */
export function isMinor(birth: string, today: string) {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age < 18;
}

export function guardianRequired(department: EducationDepartment, birth: string, today: string) {
  return department === "infancia" || isMinor(birth, today);
}

export type Enrollment = { manual_inactive: boolean; valid_through_year: number };

export function enrollmentStatus(e: Enrollment, year: number) {
  if (e.manual_inactive) return { active: false, reason: "Inativação manual" } as const;
  if (year > e.valid_through_year) return { active: false, reason: "Renovação anual pendente" } as const;
  return { active: true, reason: "Matrícula vigente" } as const;
}

/** Ano-alvo da renovação: o ano corrente se vencida; senão, o ano seguinte ao da validade. */
export function renewalTargetYear(e: Enrollment, currentYear: number) {
  return Math.max(currentYear, e.valid_through_year + 1);
}

export function firstSundayOfMarch(year: number) {
  const date = new Date(Date.UTC(year, 2, 1));
  while (date.getUTCDay() !== 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Domingos com aula no mês (recesso em janeiro e fevereiro; retorno no 1º domingo de março). */
export function classSundays(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = firstSundayOfMarch(y);
  const out: string[] = [];
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(y, m - 1, day));
    if (date.getUTCMonth() !== m - 1) break;
    const iso = date.toISOString().slice(0, 10);
    if (date.getUTCDay() === 0 && iso >= start) out.push(iso);
  }
  return out;
}

export function isClassSunday(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && classSundays(date.slice(0, 7)).includes(date);
}

export type Mark = "P" | "F";

export function attendanceSummary(marks: readonly { evangelizando_id: string; mark: Mark }[]) {
  const present = marks.filter((m) => m.mark === "P").length;
  const absent = marks.length - present;
  return { present, absent, marked: marks.length, rate: marks.length ? Math.round((present / marks.length) * 100) : null };
}

export const PLAN_STATUSES = ["Planejado", "Em andamento", "Realizado", "Adiado", "Cancelado"] as const;
export const SPECIAL_TYPES = ["Evento", "Passeio", "Confraternização", "Encontro com famílias", "Ação educativa", "Outro"] as const;

export function defaultPlan(department: EducationDepartment) {
  const infancia = department === "infancia";
  return {
    objective: infancia
      ? "Desenvolver a evangelização infantil de forma organizada e contínua, observando as turmas/ciclos previstos no Regimento Interno e promovendo atividades educativas e doutrinárias adequadas às crianças."
      : "Desenvolver a evangelização da Pré-Juventude e da Juventude de forma organizada e contínua, com estudo, convivência fraterna e participação nas atividades da Casa.",
    priorities: infancia
      ? "Planejamento prévio dos conteúdos; organização das turmas conforme faixa etária; dois evangelizadores por ciclo infantil; acompanhamento da frequência; integração com famílias; avaliação periódica do trabalho."
      : "Planejamento prévio dos conteúdos; grupos conforme faixa etária; dois evangelizadores por grupo; acompanhamento da frequência; integração com famílias e responsáveis.",
    expected: "Conteúdo anual previamente organizado, grupos acompanhados, equipe de evangelizadores definida e atividades especiais coerentes com a finalidade educativa e doutrinária da Casa.",
    notes: "O planejamento reflete as decisões da coordenação e da administração da Casa. Passeios e eventos são registros operacionais, sujeitos às autorizações institucionais.",
    management: [
      { month: 3, action: "Reunião anual de planejamento com a coordenação e evangelizadores.", responsible: "Coordenação", goal: "Planejamento anual aprovado internamente e responsabilidades distribuídas." },
      { month: 3, action: "Organizar matrículas, turmas e vínculos dos evangelizadores.", responsible: "Coordenação", goal: "Turmas organizadas para o início das atividades." },
      { month: 6, action: "Revisar o enquadramento etário considerando a idade em 30 de junho.", responsible: "Coordenação", goal: "Turmas conferidas e ajustadas quando necessário." },
      { month: 6, action: "Conferir se cada turma possui dois evangelizadores vinculados.", responsible: "Coordenação", goal: "Cada turma com dois evangelizadores previstos." },
      { month: 7, action: "Avaliar o primeiro semestre com a equipe.", responsible: "Coordenação e evangelizadores", goal: "Ajustes do segundo semestre definidos." },
      { month: 12, action: "Avaliação final e consolidação para o Relatório Anual.", responsible: "Coordenação", goal: "Relatório anual subsidiado pelos registros do planejamento." }
    ]
  };
}
