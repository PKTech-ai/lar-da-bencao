/**
 * Sábados fixos de cada mês: o Culto no Lar dos Trabalhadores (Doutrina) é no penúltimo sábado e a Caravana do Amor
 * (Assistência Social) no último. Todo mês tem 4 ou 5 sábados, então as duas datas nunca caem no mesmo dia. Lógica pura.
 */
import { monthDays } from "@/lib/doutrina-scale";

const iso = (ym: string, day: number) => `${ym}-${String(day).padStart(2, "0")}`;

/** Último sábado do mês (Caravana do Amor). */
export function lastSaturday(ym: string) {
  const saturdays = monthDays(ym, 6);
  return iso(ym, saturdays[saturdays.length - 1]);
}

/** Penúltimo sábado do mês (Culto no Lar dos Trabalhadores). */
export function penultimateSaturday(ym: string) {
  const saturdays = monthDays(ym, 6);
  return iso(ym, saturdays[saturdays.length - 2]);
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
] as const;

export type MonthSaturdays = { month: string; label: string; culto: string; caravana: string };

/** Os 12 meses do ano com a data do Culto no Lar e a da Caravana do Amor. */
export function yearSaturdays(year: number): MonthSaturdays[] {
  return MONTH_NAMES.map((label, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { month, label, culto: penultimateSaturday(month), caravana: lastSaturday(month) };
  });
}

export function isProgramYear(year: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2100;
}

/** Ano que a tela abre: em novembro e dezembro já mostra a programação do ano seguinte. */
export function programYear(today: string) {
  const [year, month] = today.split("-").map(Number);
  return month >= 11 ? year + 1 : year;
}

/** AAAA-MM-DD → DD/MM/AAAA. */
export function brDate(date: string) {
  return date.split("-").reverse().join("/");
}
