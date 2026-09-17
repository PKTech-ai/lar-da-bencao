/** Controle mensal de frequência da Doutrina (paridade com DOCTRINE_ATTENDANCE_CONFIG do mock). */
import { monthDays } from "@/lib/doutrina-scale";

export type AttendanceRow = { id: string; label: string } | { section: string };

export const ATTENDANCE_CONFIG: Record<number, { label: string; rows: AttendanceRow[] }> = {
  1: { label: "SEGUNDA-FEIRA", rows: [{ id: "med_internal", label: "Mediúnica — funcionamento interno" }] },
  3: {
    label: "QUARTA-FEIRA",
    rows: [
      { section: "Recepção / Atendimento" },
      { id: "rec_primeira", label: "Primeira vez" },
      { id: "rec_continuacao", label: "Continuação" },
      { id: "rec_reentrevista", label: "Reentrevista" },
      { id: "rec_sem_ficha", label: "S/Ficha" },
      { section: "Estudos e atividades" },
      { id: "ese_g1", label: "Grupo ESE — G-1" },
      { id: "ese_g2", label: "Grupo ESE — G-2" },
      { id: "ese_g3", label: "Grupo ESE — G-3" },
      { id: "esde_g1", label: "ESDE — G-1" },
      { id: "mediunica", label: "Mediúnica" },
      { id: "grupo_passe", label: "Grupo do Passe" }
    ]
  },
  4: { label: "QUINTA-FEIRA", rows: [{ id: "mep", label: "Estudo do MEP" }] },
  5: {
    label: "SEXTA-FEIRA",
    rows: [
      { section: "Atendimento público" },
      { id: "recepcao", label: "Recepção" },
      { id: "palestra", label: "Palestra Pública" },
      { id: "entrevista", label: "Entrevista" },
      { section: "Atividades complementares" },
      { id: "mediunica", label: "Mediúnica" },
      { id: "grupo_passe", label: "Grupo do Passe" }
    ]
  },
  6: { label: "SÁBADO", rows: [{ id: "estudo_obra", label: "Estudo de Obra" }, { id: "caravana_lar", label: "Caravana no Lar" }] },
  0: {
    label: "DOMINGO",
    rows: [{ id: "palestra", label: "Palestra Pública" }, { id: "mediunica", label: "Mediúnica" }, { id: "grupo_passe", label: "Grupo do Passe" }]
  }
};

export const ATTENDANCE_DOWS = [1, 3, 4, 5, 6, 0] as const;

export function rowIdsFor(dow: number) {
  return (ATTENDANCE_CONFIG[dow]?.rows ?? []).flatMap((row) => ("id" in row ? [row.id] : []));
}

/** A data pertence ao mês e o dia da semana tem a atividade. */
export function isValidAttendanceCell(ym: string, date: string, rowId: string) {
  if (!date.startsWith(`${ym}-`)) return false;
  const day = Number(date.slice(8, 10));
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return monthDays(ym, dow).includes(day) && rowIdsFor(dow).includes(rowId);
}

export type AttendanceValue = { date: string; row_id: string; value: number };

export function attendanceStats(values: readonly AttendanceValue[]) {
  const perDay = new Map<string, number>();
  for (const item of values) perDay.set(item.date, (perDay.get(item.date) ?? 0) + item.value);
  const launched = [...perDay].filter(([, total]) => total > 0).sort(([a], [b]) => a.localeCompare(b));
  const total = launched.reduce((sum, [, value]) => sum + value, 0);
  const max = launched.reduce<[string, number] | null>((best, entry) => (!best || entry[1] > best[1] ? entry : best), null);
  return {
    perDay: Object.fromEntries(perDay),
    encounters: launched.length,
    total,
    average: launched.length ? Math.round(total / launched.length) : 0,
    max: max ? { date: max[0], total: max[1] } : null
  };
}
