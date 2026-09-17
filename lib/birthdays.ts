/** Aniversariantes por período de meses (paridade com os painéis `*-aniversariantes` do mock). */
export type BirthdayPerson = { id: string; name: string; birth_date: string; kind: string; link: string };

export function birthdaysInRange(people: readonly BirthdayPerson[], year: number, fromMonth: number, toMonth: number) {
  const [start, end] = fromMonth <= toMonth ? [fromMonth, toMonth] : [toMonth, fromMonth];
  return people
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.birth_date))
    .map((p) => {
      const month = Number(p.birth_date.slice(5, 7));
      const day = Number(p.birth_date.slice(8, 10));
      return { ...p, month, day, age: year - Number(p.birth_date.slice(0, 4)) };
    })
    .filter((p) => p.month >= start && p.month <= end && p.age >= 0)
    .sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, "pt-BR"));
}
